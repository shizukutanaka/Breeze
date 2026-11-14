import { describe, it, expect, beforeEach } from 'vitest';
import { makeKV, makeEnv, apiRequest } from './helpers/mockKV.js';
import { makeMailboxNamespace, makeDOEnv } from './helpers/mockDO.js';
import {
  mailboxStore, mailboxStoreForKey, eraseMailboxes,
  handleMsgSend, handleMsgPoll, handleSealedSend, handleSealedPoll, handleSealedAck,
} from '../_worker.js';

// Stage-1 step 2 (2026-11-13): the Durable Object backend behind the same
// MailboxStore surface. These tests pin: the store contract against the DO
// implementation (real MailboxDO class on in-memory storage), drain
// migration from KV on first access, backend selection (flag + binding,
// KV default, KV fallback), and the queue handlers running unchanged
// against the DO backend — the plan's "suite must pass on both backends"
// requirement at the layers this step touches.
beforeEach(() => {
  globalThis._msgDedup = new Map();
  globalThis._sealedDedup = new Map();
});

const req = (b) => apiRequest('/api/x', b);

describe('MailboxStore (DO-backed)', () => {
  it('round-trips queue, hwm and dropped through DO storage, KV untouched', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'sealed', 'user42');
    expect(mb.queueKey).toBe('sealed:user42');
    expect(await mb.writeQueue('[{"envelope":"e","ts":1}]', 7 * 24 * 3600)).toBe(true);
    expect(await mb.writeHwm('1', 300)).toBe(true);
    expect(await mb.writeDropped('2', 7 * 24 * 3600)).toBe(true);
    expect(await mb.readQueue()).toBe('[{"envelope":"e","ts":1}]');
    expect(await mb.readHwm()).toBe('1');
    expect(await mb.readDropped()).toBe('2');
    // Nothing landed in KV — the DO holds the mailbox now.
    expect(env.KV.store.size).toBe(0);
    const storage = env.MAILBOX_DO.instances.get('user42').state.storage.map;
    expect(storage.get('sealed:queue').v).toBe('[{"envelope":"e","ts":1}]');
    expect(storage.get('sealed:hwm').v).toBe('1');
    expect(storage.get('sealed:dropped').v).toBe('2');
  });

  it('both families share ONE DO instance per recipient', async () => {
    const env = makeDOEnv();
    await mailboxStore(env, 'inbox', 'user42').writeQueue('plain', 60);
    await mailboxStore(env, 'sealed', 'user42').writeQueue('sealed', 60);
    expect(env.MAILBOX_DO.instances.size).toBe(1);
    const storage = env.MAILBOX_DO.instances.get('user42').state.storage.map;
    expect(storage.get('inbox:queue').v).toBe('plain');
    expect(storage.get('sealed:queue').v).toBe('sealed');
    await mailboxStore(env, 'inbox', 'someoneelse').writeQueue('x', 60);
    expect(env.MAILBOX_DO.instances.size).toBe(2);
  });

  it('reads of absent slots return null; deletes are idempotent-true', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'inbox', 'ghost');
    expect(await mb.readQueue()).toBeNull();
    expect(await mb.readHwm()).toBeNull();
    expect(await mb.readDropped()).toBeNull();
    expect(await mb.deleteQueue()).toBe(true);
    expect(await mb.deleteHwm()).toBe(true);
    expect(await mb.deleteDropped()).toBe(true);
  });

  it('honours the caller TTL: an already-expired entry reads as absent', async () => {
    const env = makeDOEnv();
    const mb = mailboxStore(env, 'inbox', 'user42');
    await mb.writeQueue('stale', 0); // exp = now → expired on read
    expect(await mb.readQueue()).toBeNull();
    await mb.writeQueue('fresh', 3600);
    expect(await mb.readQueue()).toBe('fresh');
    await mb.writeQueue('forever'); // no TTL → no expiry recorded
    const entry = env.MAILBOX_DO.instances.get('user42').state.storage.map.get('inbox:queue');
    expect(entry.exp).toBeNull();
    expect(await mb.readQueue()).toBe('forever');
  });

  it('mailboxStoreForKey routes to the named recipient\'s DO (deletion sweep)', async () => {
    const env = makeDOEnv();
    await mailboxStore(env, 'inbox', 'peer9').writeQueue('[{"from":"x"}]', 60);
    const mb = mailboxStoreForKey(env, 'inbox:peer9');
    expect(await mb.readQueue()).toBe('[{"from":"x"}]');
    await mb.deleteQueue();
    expect(await mailboxStore(env, 'inbox', 'peer9').readQueue()).toBeNull();
  });

  it('DO failures surface as null / false, never as throws', async () => {
    const env = makeDOEnv();
    env.MAILBOX_DO = { idFromName: (n) => ({ name: n }), get: () => { throw new Error('do down'); } };
    const mb = mailboxStore(env, 'sealed', 'u1');
    expect(await mb.readQueue()).toBeNull();
    expect(await mb.writeQueue('v', 60)).toBe(false);
    expect(await mb.deleteQueue()).toBe(false);
  });
});

describe('MailboxStore backend selection', () => {
  it('defaults to KV even when the DO binding is present', async () => {
    const env = makeEnv(); // no MAILBOX_BACKEND
    env.MAILBOX_DO = makeMailboxNamespace(env);
    await mailboxStore(env, 'inbox', 'user42').writeQueue('kv-value', 60);
    expect(env.KV.store.get('inbox:user42')).toBe('kv-value');
    expect(env.MAILBOX_DO.instances.size).toBe(0);
  });

  it('falls back to KV when MAILBOX_BACKEND=do but the binding is absent', async () => {
    const env = makeEnv({ MAILBOX_BACKEND: 'do' }); // no MAILBOX_DO binding
    const mb = mailboxStore(env, 'inbox', 'user42');
    await mb.writeQueue('kv-value', 60);
    expect(env.KV.store.get('inbox:user42')).toBe('kv-value');
    expect(await mb.readQueue()).toBe('kv-value');
  });
});

describe('drain migration (KV → DO on first access)', () => {
  it('seeds the DO from the KV mailbox, then deletes the KV copies', async () => {
    const kv = makeKV({
      'inbox:u1': '[{"from":"a","ts":1}]', 'inbox:u1:hwm': '5',
      'sealed:u1': '[{"envelope":"e","ts":2}]', 'sealed:u1:hwm': '7', 'sealed:u1:dropped': '3',
      'prekey:u1': '{}',
    });
    const env = { KV: kv, MIN_POW_DIFFICULTY: '8', MAILBOX_BACKEND: 'do' };
    env.MAILBOX_DO = makeMailboxNamespace(env);

    // First access is through the SEALED store — the drain takes over the
    // WHOLE mailbox (both families), not just the family touched.
    expect(await mailboxStore(env, 'sealed', 'u1').readQueue()).toBe('[{"envelope":"e","ts":2}]');
    expect(await mailboxStore(env, 'inbox', 'u1').readQueue()).toBe('[{"from":"a","ts":1}]');
    expect(await mailboxStore(env, 'inbox', 'u1').readHwm()).toBe('5');
    expect(await mailboxStore(env, 'sealed', 'u1').readHwm()).toBe('7');
    expect(await mailboxStore(env, 'sealed', 'u1').readDropped()).toBe('3');

    // KV copies are gone; non-mailbox keys are untouched.
    for (const k of ['inbox:u1', 'inbox:u1:hwm', 'sealed:u1', 'sealed:u1:hwm', 'sealed:u1:dropped']) {
      expect(kv.store.has(k), k).toBe(false);
    }
    expect(kv.store.get('prekey:u1')).toBe('{}');

    // Later writes go to the DO only — no dual-write window reopens.
    await mailboxStore(env, 'inbox', 'u1').writeQueue('[{"from":"b","ts":9}]', 60);
    expect(kv.store.has('inbox:u1')).toBe(false);
    expect(await mailboxStore(env, 'inbox', 'u1').readQueue()).toBe('[{"from":"b","ts":9}]');
  });

  it('eraseMailboxes under the DO backend erases DO and not-yet-drained KV copies', async () => {
    const env = makeDOEnv();
    // Drained mailbox: lives in the DO.
    await mailboxStore(env, 'inbox', 'drained').writeQueue('[]', 60);
    await mailboxStore(env, 'sealed', 'drained').writeQueue('[]', 60);
    // Undrained mailbox: lives only in KV (seeded directly, never accessed).
    env.KV.store.set('inbox:undrained', '[]');
    env.KV.store.set('sealed:undrained:hwm', '9');

    const results = eraseMailboxes(env, 'drained');
    expect(results).toHaveLength(12); // 6 DO + 6 KV belt-and-braces
    expect(await Promise.all(results)).toEqual(Array(12).fill(true));
    expect(await Promise.all(eraseMailboxes(env, 'undrained'))).toEqual(Array(12).fill(true));

    expect(await mailboxStore(env, 'inbox', 'drained').readQueue()).toBeNull();
    expect(await mailboxStore(env, 'sealed', 'drained').readQueue()).toBeNull();
    expect(env.KV.store.has('inbox:undrained')).toBe(false);
    expect(env.KV.store.has('sealed:undrained:hwm')).toBe(false);
  });
});

describe('queue handlers on the DO backend', () => {
  it('sealed send → poll → ack round-trips through the DO', async () => {
    const env = makeDOEnv();
    const send = await handleSealedSend({ to: 'bob00001', envelope: 'ENCRYPTED_PAYLOAD' }, env, req({}));
    expect(send.status).toBe(200);
    const { messages } = await (await handleSealedPoll({ id: 'bob00001' }, env, req({}))).json();
    expect(messages.length).toBe(1);
    expect(messages[0].envelope).toBe('ENCRYPTED_PAYLOAD');
    await handleSealedAck({ id: 'bob00001' }, env, req({}));
    const after = await (await handleSealedPoll({ id: 'bob00001' }, env, req({}))).json();
    expect(after.messages).toEqual([]);
    expect(env.KV.store.has('sealed:bob00001')).toBe(false);
  });

  it('plain send → poll delivers both same-millisecond messages through the DO', async () => {
    const env = makeDOEnv();
    const ts = Date.now();
    const ip = '10.0.0.1';
    await handleMsgSend({ to: 'bob00001', from: 'alice001', payload: 'CT-A', ts }, ip, env, req({}));
    await handleMsgSend({ to: 'bob00001', from: 'alice001', payload: 'CT-B', ts }, ip, env, req({}));
    const poll = await handleMsgPoll({ id: 'bob00001', lastTs: 0 }, env, req({}));
    const { messages } = await poll.json();
    expect(messages.map(m => m.payload)).toEqual(['CT-A', 'CT-B']);
    expect(messages[1].ts).toBeGreaterThan(messages[0].ts); // strict-monotonic bump held on DO storage
  });

  it('a message queued under KV is delivered after the backend flips to DO (handler-level drain)', async () => {
    const kvEnv = makeEnv();
    await handleSealedSend({ to: 'carol001', envelope: 'QUEUED_ON_KV' }, kvEnv, req({}));
    expect(kvEnv.KV.store.has('sealed:carol001')).toBe(true);

    const doEnv = { KV: kvEnv.KV, MIN_POW_DIFFICULTY: '8', MAILBOX_BACKEND: 'do' };
    doEnv.MAILBOX_DO = makeMailboxNamespace(doEnv);
    const { messages } = await (await handleSealedPoll({ id: 'carol001' }, doEnv, req({}))).json();
    expect(messages.length).toBe(1);
    expect(messages[0].envelope).toBe('QUEUED_ON_KV');
    expect(kvEnv.KV.store.has('sealed:carol001')).toBe(false); // drained
  });
});
