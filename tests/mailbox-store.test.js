import { describe, it, expect } from 'vitest';
import { makeKV, makeEnv } from './helpers/mockKV.js';
import { mailboxStore, mailboxStoreForKey, listMailboxKeys, eraseMailboxes } from '../_worker.js';

// Stage-1 step 1 (2026-11-13): the MailboxStore is the seam every queue
// read/write now goes through, ahead of the per-recipient Durable Object
// implementation. These tests pin the KV-backed implementation's contract:
// exact key layout (the on-disk format does not change in this step),
// kv*-helper success/failure semantics, and TTL pass-through.
describe('MailboxStore (KV-backed)', () => {
  it('binds queue, hwm and dropped to the family key layout', async () => {
    const env = makeEnv();
    const mb = mailboxStore(env, 'sealed', 'user42');
    expect(mb.queueKey).toBe('sealed:user42');
    await mb.writeQueue('[{"envelope":"e","ts":1}]', 7 * 24 * 3600);
    await mb.writeHwm('1', 300);
    await mb.writeDropped('2', 7 * 24 * 3600);
    expect(env.KV.store.get('sealed:user42')).toBe('[{"envelope":"e","ts":1}]');
    expect(env.KV.store.get('sealed:user42:hwm')).toBe('1');
    expect(env.KV.store.get('sealed:user42:dropped')).toBe('2');
    expect(await mb.readQueue()).toBe('[{"envelope":"e","ts":1}]');
    expect(await mb.readHwm()).toBe('1');
    expect(await mb.readDropped()).toBe('2');
  });

  it('plain and sealed families are independent mailboxes', async () => {
    const env = makeEnv();
    await mailboxStore(env, 'inbox', 'user42').writeQueue('plain', 60);
    await mailboxStore(env, 'sealed', 'user42').writeQueue('sealed', 60);
    expect(await mailboxStore(env, 'inbox', 'user42').readQueue()).toBe('plain');
    expect(await mailboxStore(env, 'sealed', 'user42').readQueue()).toBe('sealed');
  });

  it('reads of absent keys return null; deletes are idempotent-true', async () => {
    const env = makeEnv();
    const mb = mailboxStore(env, 'inbox', 'ghost');
    expect(await mb.readQueue()).toBeNull();
    expect(await mb.readHwm()).toBeNull();
    expect(await mb.readDropped()).toBeNull();
    expect(await mb.deleteQueue()).toBe(true);
    expect(await mb.deleteHwm()).toBe(true);
    expect(await mb.deleteDropped()).toBe(true);
  });

  it('writeQueue records the caller TTL on the KV entry', async () => {
    const env = makeEnv();
    const mb = mailboxStore(env, 'inbox', 'user42');
    const before = Date.now();
    await mb.writeQueue('v', 300);
    const exp = env.KV.exp.get('inbox:user42');
    expect(exp).toBeGreaterThanOrEqual(before + 300 * 1000);
    expect(exp).toBeLessThanOrEqual(Date.now() + 300 * 1000);
  });

  it('mailboxStoreForKey binds to a listed key name (deletion sweep)', async () => {
    const kv = makeKV({ 'inbox:peer9': '[{"from":"x"}]', 'inbox:peer9:hwm': '5' });
    const env = { KV: kv };
    const mb = mailboxStoreForKey(env, 'inbox:peer9');
    expect(await mb.readQueue()).toBe('[{"from":"x"}]');
    expect(await mb.readHwm()).toBe('5');
    await mb.writeQueue('[]', 60);
    expect(kv.store.get('inbox:peer9')).toBe('[]');
    await mb.deleteQueue();
    expect(kv.store.has('inbox:peer9')).toBe(false);
  });

  it('listMailboxKeys returns the family incl. satellites, nothing else', async () => {
    const kv = makeKV({
      'inbox:a': '[]', 'inbox:a:hwm': '1', 'inbox:b': '[]',
      'sealed:a': '[]', 'grp:t': '{}',
    });
    const env = { KV: kv };
    const names = await listMailboxKeys(env, 'inbox');
    expect(new Set(names)).toEqual(new Set(['inbox:a', 'inbox:a:hwm', 'inbox:b']));
  });

  it('eraseMailboxes deletes exactly the five mailbox keys', async () => {
    const kv = makeKV({
      'inbox:u1': '[]', 'inbox:u1:hwm': '9', 'inbox:u1:dropped': '2',
      'sealed:u1': '[]', 'sealed:u1:hwm': '9', 'sealed:u1:dropped': '3',
      'inbox:u2': '[]', 'prekey:u1': '{}', 'presence:u1': '{}',
    });
    const env = { KV: kv };
    const results = eraseMailboxes(env, 'u1');
    expect(results).toHaveLength(6);
    expect(await Promise.all(results)).toEqual([true, true, true, true, true, true]);
    for (const k of ['inbox:u1', 'inbox:u1:hwm', 'inbox:u1:dropped', 'sealed:u1', 'sealed:u1:hwm', 'sealed:u1:dropped']) {
      expect(kv.store.has(k), k).toBe(false);
    }
    // Untouched: another user's mailbox and non-mailbox keys of the same user.
    expect(kv.store.has('inbox:u2')).toBe(true);
    expect(kv.store.has('prekey:u1')).toBe(true);
    expect(kv.store.has('presence:u1')).toBe(true);
  });

  it('KV failures surface as null / false, never as throws', async () => {
    const boom = {
      async get() { throw new Error('kv down'); },
      async put() { throw new Error('kv down'); },
      async delete() { throw new Error('kv down'); },
    };
    const mb = mailboxStore({ KV: boom }, 'sealed', 'u1');
    expect(await mb.readQueue()).toBeNull();
    expect(await mb.writeQueue('v', 60)).toBe(false);
    expect(await mb.deleteQueue()).toBe(false);
    expect(await mb.readHwm()).toBeNull();
    expect(await mb.writeHwm('1', 60)).toBe(false);
    expect(await mb.deleteHwm()).toBe(false);
    expect(await mb.readDropped()).toBeNull();
    expect(await mb.writeDropped('1', 60)).toBe(false);
    expect(await mb.deleteDropped()).toBe(false);
  });
});
