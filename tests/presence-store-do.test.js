import { describe, it, expect, beforeEach } from 'vitest';
import { makeKV, makeEnv, apiRequest } from './helpers/mockKV.js';
import { makeMailboxNamespace, makePresenceDOEnv } from './helpers/mockDO.js';
import {
  presenceStore, erasePresence, mailboxStore,
  handlePresence, handlePreKeyUpload, handleAccountDelete,
} from '../_worker.js';

// Stage-1 step 4 (2026-11-13): the presence record behind the
// PresenceStore seam, with the recipient's own MailboxDO as the second
// backend. These tests pin: the store contract against the DO
// implementation (real MailboxDO class on in-memory storage), backend
// selection (flag + binding, KV default, KV fallback), drain migration
// of the presence record on first DO access, the INDEPENDENCE of the
// presence and mailbox flags/drains (one concern's first access must
// never move the other's data), the presence handlers running unchanged
// on the DO backend, and dual-store erasure on account deletion.
beforeEach(() => {
  globalThis._presenceCache = new Map();
  globalThis._presenceVerified = new Map();
});

const req = (b) => apiRequest('/api/presence', b);
const toB64 = (u8) => Buffer.from(u8).toString('base64');
const rec = (at, extra = {}) => JSON.stringify({ pub: 'p', name: 'X', at, ...extra });
const doStorage = (env, userId) => env.MAILBOX_DO.instances.get(userId).state.storage.map;

describe('PresenceStore (DO-backed)', () => {
  it('round-trips the record through DO storage, KV untouched', async () => {
    const env = makePresenceDOEnv();
    const st = presenceStore(env, 'user42');
    expect(await st.write(rec(123), 360)).toBe(true);
    expect(await st.read()).toBe(rec(123));
    expect(env.KV.store.has('presence:user42')).toBe(false);
    const entry = doStorage(env, 'user42').get('presence');
    expect(entry.v).toBe(rec(123));
    expect(entry.exp).toBeGreaterThan(Date.now());
    expect(entry.exp).toBeLessThanOrEqual(Date.now() + 360 * 1000);
    expect(await st.delete()).toBe(true);
    expect(await st.read()).toBeNull();
    expect(await st.delete()).toBe(true); // idempotent
  });

  it('honours the caller TTL: an already-expired entry reads as absent', async () => {
    const env = makePresenceDOEnv();
    const st = presenceStore(env, 'user42');
    await st.write(rec(1), 0); // exp = now → expired on read
    expect(await st.read()).toBeNull();
    await st.write(rec(2), 3600);
    expect(await st.read()).toBe(rec(2));
  });

  it('reads of an absent record return null', async () => {
    const env = makePresenceDOEnv();
    expect(await presenceStore(env, 'ghost').read()).toBeNull();
  });

  it('one DO instance per user serves both the mailbox and presence', async () => {
    const env = makePresenceDOEnv({ MAILBOX_BACKEND: 'do' });
    await presenceStore(env, 'user42').write(rec(1), 360);
    await mailboxStore(env, 'inbox', 'user42').writeQueue('q', 60);
    expect(env.MAILBOX_DO.instances.size).toBe(1);
    expect(doStorage(env, 'user42').get('inbox:queue').v).toBe('q');
  });

  it('DO failures surface as null / false, never as throws', async () => {
    const env = makePresenceDOEnv();
    env.MAILBOX_DO = { idFromName: (n) => ({ name: n }), get: () => { throw new Error('do down'); } };
    const st = presenceStore(env, 'u1');
    expect(await st.read()).toBeNull();
    expect(await st.write(rec(1), 60)).toBe(false);
    expect(await st.delete()).toBe(false);
  });
});

describe('PresenceStore backend selection', () => {
  it('defaults to KV even when the DO binding is present', async () => {
    const env = makeEnv(); // no PRESENCE_BACKEND
    env.MAILBOX_DO = makeMailboxNamespace(env);
    expect(await presenceStore(env, 'user42').write(rec(1), 360)).toBe(true);
    expect(env.KV.store.get('presence:user42')).toBe(rec(1));
    expect(env.MAILBOX_DO.instances.size).toBe(0);
  });

  it('falls back to KV when PRESENCE_BACKEND=do but the binding is absent', async () => {
    const env = makeEnv({ PRESENCE_BACKEND: 'do' }); // no MAILBOX_DO binding
    const st = presenceStore(env, 'user42');
    await st.write(rec(1), 360);
    expect(env.KV.store.get('presence:user42')).toBe(rec(1));
    expect(await st.read()).toBe(rec(1));
  });
});

describe('presence drain migration (KV → DO on first access)', () => {
  it('seeds the DO from the KV record, then deletes the KV copy', async () => {
    const kv = makeKV({ 'presence:u1': rec(999) });
    const env = { KV: kv, MIN_POW_DIFFICULTY: '8', PRESENCE_BACKEND: 'do' };
    env.MAILBOX_DO = makeMailboxNamespace(env);
    expect(await presenceStore(env, 'u1').read()).toBe(rec(999));
    expect(await kv.get('presence:u1')).toBeNull();
    const storage = doStorage(env, 'u1');
    expect(storage.get('presence').v).toBe(rec(999));
    expect(storage.get('presenceSeeded')).toBe(1);
    // The seeded expiry is the presence TTL (6 min), NOT the mailbox week.
    expect(storage.get('presence').exp).toBeLessThanOrEqual(Date.now() + 360 * 1000);
  });

  it('a stale KV record drains without resurrecting the user as online', async () => {
    const kv = makeKV({ 'presence:goneuser1': rec(Date.now() - 420000) }); // older than PRESENCE_FRESH
    const env = { KV: kv, MIN_POW_DIFFICULTY: '8', PRESENCE_BACKEND: 'do' };
    env.MAILBOX_DO = makeMailboxNamespace(env);
    const r = await handlePresence({ id: 'goneuser1', check: true }, env, req({}));
    expect((await r.json()).online).toBe(false);
  });
});

describe('presence and mailbox drains are independent', () => {
  it('a presence first access never moves the mailbox (PRESENCE=do, mailboxes stay KV)', async () => {
    const record = rec(Date.now());
    const kv = makeKV({
      'presence:u1': record,
      'inbox:u1': '[{"from":"a","ts":1}]', 'inbox:u1:hwm': '5',
    });
    const env = { KV: kv, MIN_POW_DIFFICULTY: '8', PRESENCE_BACKEND: 'do' }; // no MAILBOX_BACKEND
    env.MAILBOX_DO = makeMailboxNamespace(env);
    expect(await presenceStore(env, 'u1').read()).toBe(record);
    // Presence drained…
    expect(await kv.get('presence:u1')).toBeNull();
    // …but the mailbox is untouched in KV and still served from KV.
    expect(await kv.get('inbox:u1')).toBe('[{"from":"a","ts":1}]');
    expect(await mailboxStore(env, 'inbox', 'u1').readQueue()).toBe('[{"from":"a","ts":1}]');
    expect(doStorage(env, 'u1').has('inbox:queue')).toBe(false);
  });

  it('a mailbox first access never moves presence (MAILBOX=do, presence stays KV)', async () => {
    const kv = makeKV({
      'presence:u1': rec(4242),
      'inbox:u1': '[{"from":"a","ts":1}]',
    });
    const env = { KV: kv, MIN_POW_DIFFICULTY: '8', MAILBOX_BACKEND: 'do' }; // no PRESENCE_BACKEND
    env.MAILBOX_DO = makeMailboxNamespace(env);
    expect(await mailboxStore(env, 'inbox', 'u1').readQueue()).toBe('[{"from":"a","ts":1}]');
    expect(await kv.get('inbox:u1')).toBeNull(); // mailbox drained
    // …but presence is untouched: still in KV, nothing in the DO.
    expect(await kv.get('presence:u1')).toBe(rec(4242));
    expect(await presenceStore(env, 'u1').read()).toBe(rec(4242));
    expect(doStorage(env, 'u1').has('presence')).toBe(false);
  });
});

describe('presence handlers on the DO backend', () => {
  it('heartbeat lands in the DO, checks read it back, KV stays empty', async () => {
    const env = makePresenceDOEnv();
    await env.KV.put('prekey:user00001', JSON.stringify({ spkPub: 'x' })); // registered (gate default-on)
    const res = await handlePresence({ id: 'user00001', pub: 'mypub', name: 'Alice' }, env, req({}));
    expect(res.status).toBe(200);
    expect(env.KV.store.has('presence:user00001')).toBe(false);
    expect(doStorage(env, 'user00001').get('presence').v).toContain('mypub');
    // Cold isolate: the check must come from the store, not the memory cache.
    globalThis._presenceCache = new Map();
    const j = await (await handlePresence({ id: 'user00001', check: true }, env, req({}))).json();
    expect(j.online).toBe(true);
    expect(j.name).toBeUndefined(); // the no-name-disclosure rule holds on this backend too
    const batch = await (await handlePresence({ ids: ['user00001', 'ghostuser9'], check: true }, env, req({}))).json();
    expect(batch.online).toEqual({ user00001: true, ghostuser9: false });
  });

  it('a record written under KV is still visible after the flag flips to DO', async () => {
    const kv = makeKV();
    const kvEnv = { KV: kv, MIN_POW_DIFFICULTY: '8' };
    await kv.put('prekey:flipuser1', JSON.stringify({ spkPub: 'x' }));
    await handlePresence({ id: 'flipuser1', pub: 'p', name: 'F' }, kvEnv, req({}));
    expect(kv.store.has('presence:flipuser1')).toBe(true);
    // Flip: same KV, DO backend on, cold isolate caches.
    const doEnv = { KV: kv, MIN_POW_DIFFICULTY: '8', PRESENCE_BACKEND: 'do' };
    doEnv.MAILBOX_DO = makeMailboxNamespace(doEnv);
    globalThis._presenceCache = new Map();
    globalThis._presenceVerified = new Map();
    const j = await (await handlePresence({ id: 'flipuser1', check: true }, doEnv, req({}))).json();
    expect(j.online).toBe(true);
    expect(await kv.get('presence:flipuser1')).toBeNull(); // drained by the check itself
  });

  it('inst conflict detection reads the previous record from the DO store', async () => {
    const env = makePresenceDOEnv();
    const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
    await env.KV.put('prekey:cloneuser7', JSON.stringify({ edIdentityKey: toB64(raw) }));
    const sign = async (inst) => toB64(new Uint8Array(await crypto.subtle.sign(
      { name: 'Ed25519' }, kp.privateKey, new TextEncoder().encode(`breeze-inst:cloneuser7:${inst}`))));
    const beat = (inst, sig) => handlePresence({ id: 'cloneuser7', pub: 'p', name: 'X', inst, instSig: sig }, env, req({}));
    await beat('aaaa1111', await sign('aaaa1111'));
    // Cold isolate: no memory copy of the first record — the conflict check
    // must find it in the DO store.
    globalThis._presenceCache = new Map();
    const second = await (await beat('bbbb2222', await sign('bbbb2222'))).json();
    expect(second.conflict).toBe(true);
  });

  it('a DO outage degrades checks to offline instead of throwing', async () => {
    const env = makePresenceDOEnv();
    env.MAILBOX_DO = { idFromName: (n) => ({ name: n }), get: () => { throw new Error('do down'); } };
    const r = await handlePresence({ id: 'someuser42', check: true }, env, req({}));
    expect(r.status).toBe(200);
    expect((await r.json()).online).toBe(false);
  });
});

describe('erasePresence / account deletion on the DO backend', () => {
  async function registeredAccount(env, userId) {
    const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const edPub = new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey));
    const spk = crypto.getRandomValues(new Uint8Array(32));
    const spkSig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, spk));
    await handlePreKeyUpload({
      userId, identityKey: userId + '-IK',
      edIdentityKey: toB64(edPub), signedPreKey: toB64(spk), signedPreKeySig: toB64(spkSig),
      oneTimePreKeys: ['otp0'],
    }, env, apiRequest('/api/prekey/upload', {}));
    return { ed };
  }
  const signDelete = async (ed, userId, ts) => toB64(new Uint8Array(await crypto.subtle.sign(
    { name: 'Ed25519' }, ed.privateKey, new TextEncoder().encode(`breeze-account-delete:${userId}:${ts}`))));

  it('erases a presence record that lives only in KV (never drained)', async () => {
    const env = makePresenceDOEnv();
    const userId = 'delpres01';
    const { ed } = await registeredAccount(env, userId);
    await env.KV.put(`presence:${userId}`, rec(Date.now()));
    const ts = Date.now();
    const res = await handleAccountDelete({ userId, ts, sig: await signDelete(ed, userId, ts) }, env, req({}));
    expect(res.status).toBe(200);
    expect((await res.json()).erased).toContain('presence');
    expect(await env.KV.get(`presence:${userId}`)).toBeNull();
  });

  it('erases a presence record that lives in the DO', async () => {
    const env = makePresenceDOEnv();
    const userId = 'delpres02';
    const { ed } = await registeredAccount(env, userId);
    const beat = await handlePresence({ id: userId, pub: 'p', name: 'D' }, env, req({}));
    expect(beat.status).toBe(200);
    expect(doStorage(env, userId).has('presence')).toBe(true);
    const ts = Date.now();
    const res = await handleAccountDelete({ userId, ts, sig: await signDelete(ed, userId, ts) }, env, req({}));
    expect(res.status).toBe(200);
    expect(doStorage(env, userId).has('presence')).toBe(false);
    expect(await env.KV.get(`presence:${userId}`)).toBeNull();
    // And a later cold-isolate check agrees the user is gone.
    globalThis._presenceCache = new Map();
    const j = await (await handlePresence({ id: userId, check: true }, env, req({}))).json();
    expect(j.online).toBe(false);
  });

  it('erasePresence on the KV backend returns just the KV deletion', async () => {
    const env = makeEnv();
    await presenceStore(env, 'u9').write(rec(1), 360);
    await Promise.all(erasePresence(env, 'u9'));
    expect(await env.KV.get('presence:u9')).toBeNull();
  });
});
