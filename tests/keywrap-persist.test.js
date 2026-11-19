import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const html = process.env.KEYWRAP_TEST_BASE
  ? execFileSync('git', ['show', `${process.env.KEYWRAP_TEST_BASE}:index.html`], { encoding: 'utf8' })
  : readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const slice = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
const pass = 'correct wrapping passphrase';
const plain = () => ({ keys: { priv: { d: 'identity' }, pubB64: 'me' }, signing: { priv: { d: 'signing' } }, 'pq-priv': { seed: Array(64).fill(7) } });

function database(initial) {
  const records = structuredClone(initial), writes = [];
  const db = {
    records, writes, fail: null, abortCommit: false, throwPut: false, failRead: false,
    transaction(_store, mode) {
      const pending = [], staged = structuredClone(records);
      let aborted = false;
      const tx = {
        error: null,
        abort() { if (aborted) return; aborted = true; queueMicrotask(() => tx.onabort?.()); },
        objectStore: () => ({
          get(key) { const req = {}; pending.push(() => { req.result = structuredClone(records[key]); req.onsuccess?.(); }); return req; },
          put(value, key) {
            if (db.throwPut) throw new Error('DataCloneError');
            const req = {};
            pending.push(() => {
              if (key === db.fail) { tx.error = new Error('QuotaExceededError'); req.onerror?.({ target: req }); tx.abort(); }
              else { staged[key] = structuredClone(value); req.onsuccess?.(); }
            });
            writes.push([key, structuredClone(value)]);
            return req;
          },
        }),
      };
      queueMicrotask(() => {
        if (db.failRead && mode !== 'readwrite') { tx.abort(); return; }
        while (pending.length && !aborted) pending.shift()();
        if (mode === 'readwrite' && db.abortCommit) tx.abort();
        if (aborted) return;
        if (mode === 'readwrite') Object.assign(records, staged);
        tx.oncomplete?.();
      });
      return tx;
    },
  };
  return db;
}

function build(initial = plain()) {
  const db = database(initial), debug = vi.fn();
  const CONFIG = { AES_KEY_BITS: 256, IV_BYTES: 12, PBKDF2_AT_REST_ITERATIONS: 10, PREKEY_OTP_COUNT: 2 };
  const factory = new Function('db', 'CONFIG', '_dbg', `
    let _pqSeedUnlocked = null;
    const u8 = a => new Uint8Array(a);
    ${slice('const _AT_REST_AAD_DOMAIN', 'function arr(')}
    ${slice('  async function dbPut(', '  async function dbGetAll(')}
    return { dbPut, wrap: _atRestWrap, unwrap: _atRestUnwrap,
      change: typeof _keywrapChange === 'function' ? _keywrapChange : null,
      unlock: typeof _keywrapUnlock === 'function' ? _keywrapUnlock : null,
      clear: () => { _keywrapWriter = null; },
      seed: () => _pqSeedUnlocked,
      commit: typeof _keywrapCommit === 'function' ? _keywrapCommit : null,
      read: typeof _keywrapRead === 'function' ? _keywrapRead : null };
  `);
  return { ...factory(db, CONFIG, debug), db, debug, CONFIG };
}

async function bundleBuilder(w) {
  const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const seed = Array(64).fill(9);
  globalThis.__breezePQKey = { mintPQPreKey: () => ({ seed, publicKey: new Uint8Array(32), pqPreKey: 'pq-public' }), pqSeedRecord: s => ({ seed: s }) };
  const factory = new Function('dbPut', 'CONFIG', '_signingKey', '_dbg', `
    const _signingPubB64 = 'signing-public';
    const homeRelays = () => [];
    const CAPS_PROFILE = 'profile-v1';
    const CAPS_STICKER = 'sticker-v1'; const CAPS_LOC = 'loc-v1';
    const genRatchetKey = async () => ({ priv: { d: 'new-spk' }, pub: new Uint8Array(32) });
    ${slice('async function generatePreKeyBundle', 'async function createIdentity')}
    return generatePreKeyBundle;
  `);
  return factory(w.dbPut, w.CONFIG, ed, w.debug);
}

afterEach(() => { delete globalThis.__breezePQKey; });

describe('persistent keywrap policy in deployed storage and prekey generation', () => {
  it('replenishment never replaces a wrapped PQ seed with plaintext', async () => {
    const w = build();
    w.db.records.keys = { wrapped: await w.wrap({ d: 'identity' }, pass, 'keys') };
    w.db.records['pq-priv'] = { wrapped: await w.wrap({ seed: Array(64).fill(7) }, pass, 'pq-priv') };
    await w.unlock?.(pass, w.db.records.keys);
    const generate = await bundleBuilder(w);
    expect((await generate()).pqPreKey).toBe('pq-public');
    const record = w.db.records['pq-priv'];
    expect(record.seed).toBeUndefined();
    expect(record.wrapped).toBeDefined();
    expect(await w.unwrap(record.wrapped, pass, 'pq-priv')).toEqual({ seed: Array(64).fill(9) });
    expect(w.db.writes.filter(([key]) => key === 'pq-priv').every(([, value]) => !value.seed)).toBe(true);
    expect(w.seed()).toEqual(Array(64).fill(9));
  });

  it('missing unlocked material rejects rotation before replacing any private halves', async () => {
    const w = build();
    expect(await w.change(pass, true)).toBe(true);
    w.clear();
    const before = structuredClone(w.db.records);
    const generate = await bundleBuilder(w);
    await expect(generate()).rejects.toThrow('PQ persistence failed');
    expect(w.db.records).toEqual(before);
    expect(w.debug).toHaveBeenCalled();
  });

  it('keywrap off preserves plaintext storage and normal generation', async () => {
    const w = build();
    const generate = await bundleBuilder(w);
    expect((await generate()).pqPreKey).toBe('pq-public');
    expect(w.db.records['pq-priv']).toEqual({ seed: Array(64).fill(9) });
  });

  it.each(['keys', 'signing', 'pq-priv'])('protects future %s writes, including newly introduced slots', async slot => {
    const w = build({ keys: plain().keys });
    expect(await w.change(pass, true)).toBe(true);
    const input = plain()[slot];
    expect(await w.dbPut('identity', input, slot)).toBe(true);
    const record = w.db.records[slot];
    expect(record.priv).toBeUndefined();
    expect(record.seed).toBeUndefined();
    expect(await w.unwrap(record.wrapped, pass, slot)).toEqual(slot === 'pq-priv' ? input : input.priv);
    expect(await w.unwrap(record.wrapped, 'wrong', slot)).toBeNull();
    expect(await w.unwrap(record.wrapped, pass, 'wrong-slot')).toBeNull();
  });

  it('uses fresh IVs and restores write capability after boot unlock', async () => {
    const w = build();
    await w.change(pass, true);
    w.clear();
    await w.unlock(pass, w.db.records.keys);
    await w.dbPut('identity', plain()['pq-priv'], 'pq-priv');
    const first = w.db.records['pq-priv'].wrapped.iv;
    await w.dbPut('identity', plain()['pq-priv'], 'pq-priv');
    expect(w.db.records['pq-priv'].wrapped.iv).not.toBe(first);
    expect(html).toContain('await _keywrapUnlock(passphrase, stored)');
  });

  it.each([true, false])('rolls back every slot on enable=%s request failure', async enable => {
    for (const slot of ['keys', 'signing', 'pq-priv']) {
      const w = build();
      if (!enable) await w.change(pass, true);
      const before = structuredClone(w.db.records);
      w.db.fail = slot;
      expect(await w.change(pass, enable)).toBe(false);
      expect(w.db.records).toEqual(before);
    }
  });

  it.each(['abortCommit', 'throwPut', 'failRead'])('fails closed on %s', async fault => {
    const w = build(), before = structuredClone(w.db.records);
    w.db[fault] = true;
    expect(await w.change(pass, true)).toBe(false);
    expect(w.db.records).toEqual(before);
  });

  it('rejects wrong password and a differently wrapped secondary slot before any writes', async () => {
    const w = build();
    await w.change(pass, true);
    const before = structuredClone(w.db.records);
    expect(await w.change('wrong', false)).toBe(false);
    expect(w.db.records).toEqual(before);
    w.db.records.signing = { wrapped: await w.wrap({ d: 'signing' }, 'different', 'signing') };
    const mixed = structuredClone(w.db.records);
    expect(await w.change(pass, false)).toBe(false);
    expect(w.db.records).toEqual(mixed);
  });

  it('atomically disables all slots and resumes ordinary plaintext writes', async () => {
    const w = build();
    await w.change(pass, true);
    expect(await w.change(pass, false)).toBe(true);
    expect(w.db.records).toEqual(plain());
    expect(await w.dbPut('identity', { seed: [8] }, 'pq-priv')).toBe(true);
    expect(w.db.records['pq-priv']).toEqual({ seed: [8] });
  });

  it('aborts a stale snapshot instead of overwriting another tab’s enable', async () => {
    const w = build();
    const before = await w.read();
    await w.change(pass, true);
    const wrapped = structuredClone(w.db.records);
    expect(await w.commit(before, plain())).toBe(false);
    expect(w.db.records).toEqual(wrapped);
  });

  it('does not bypass protection when identity is plaintext but another slot is wrapped', async () => {
    const w = build();
    w.db.records.signing = { wrapped: await w.wrap({ d: 'signing' }, pass, 'signing') };
    const before = structuredClone(w.db.records);
    expect(await w.dbPut('identity', plain()['pq-priv'], 'pq-priv')).toBe(false);
    expect(w.db.records).toEqual(before);
  });

  it('command success is conditional on the complete transition succeeding', () => {
    const command = slice('// v3.6: /keywrap —', '// v3.3: /reply —');
    expect(command).toContain("if (!await _keywrapChange(pass, false)) { showToast(t('keyWrapChangeFailed'), 'error'); return; }");
    expect(command).toContain("if (!await _keywrapChange(pass, true)) { showToast(t('keyWrapChangeFailed'), 'error'); return; }");
  });
});
