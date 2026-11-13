import { describe, it, expect } from 'vitest';
import { makeKV } from './helpers/mockKV.js';
import { makeSqliteKVFixture } from './helpers/sqlite.js';
import { makeSqliteKV } from '../server/sqlite-kv.js';
import { makeSqliteDb } from './helpers/sqlite.js';

// Stage-2 step 1 (2026-11-13): the SQLite KV shim must be contract-identical
// to the KV surface the worker's kv* helpers use (RELAY_STAGE2_PLAN fact 1):
// get / put(key, value, { expirationTtl }) / delete / list({ prefix, limit,
// cursor }). The SAME scenario suite below runs against the in-memory
// mockKV fixture and the SQLite shim, and every scenario must produce the
// same verdict on both — that identity is what lets the step-2 Node host
// plug the shim in as env.KV without re-testing every handler.
//
// Documented fixture asymmetry: mockKV's list() ignores cursors and always
// reports list_complete: true (it is a permissive fake, not a pager), so
// sub-page-size pagination is pinned against the shim alone (bottom of
// this file); the shared scenarios page with a limit >= key count, where
// both fixtures complete in one page.

const names = (page) => page.keys.map((k) => k.name).sort();

// Follow cursors the way kvListNames does, collecting every name.
async function sweep(kv, prefix, limit = 1000) {
  const out = [];
  let cursor;
  for (;;) {
    const page = await kv.list({ prefix, limit, ...(cursor ? { cursor } : {}) });
    for (const k of page.keys) out.push(k.name);
    if (page.list_complete || !page.cursor) break;
    cursor = page.cursor;
  }
  return out.sort();
}

function kvContract(label, makeFixture) {
  describe(`KV contract (${label})`, () => {
    it('put/get round-trips; missing keys read null', async () => {
      const kv = makeFixture();
      expect(await kv.get('prekey:u1')).toBeNull();
      await kv.put('prekey:u1', '{"k":1}');
      expect(await kv.get('prekey:u1')).toBe('{"k":1}');
      await kv.put('prekey:u1', '{"k":2}');
      expect(await kv.get('prekey:u1')).toBe('{"k":2}');
    });

    it('delete removes the key; deleting an absent key is a no-op', async () => {
      const kv = makeFixture();
      await kv.put('alias:a', 'u1');
      await kv.delete('alias:a');
      expect(await kv.get('alias:a')).toBeNull();
      await kv.delete('alias:a');
      expect(await kv.get('alias:a')).toBeNull();
    });

    it('a put with expirationTtl: 0 is already expired on read', async () => {
      const kv = makeFixture();
      await kv.put('sig:room', 'x', { expirationTtl: 0 });
      expect(await kv.get('sig:room')).toBeNull();
    });

    it('a put with a past absolute expiration reads as absent', async () => {
      const kv = makeFixture();
      await kv.put('sig:room', 'x', { expiration: 1 }); // 1970
      expect(await kv.get('sig:room')).toBeNull();
    });

    it('a live TTL key reads back and carries expiration metadata in list', async () => {
      const kv = makeFixture();
      const before = Math.floor(Date.now() / 1000);
      await kv.put('sig:room', 'x', { expirationTtl: 3600 });
      expect(await kv.get('sig:room')).toBe('x');
      const page = await kv.list({ prefix: 'sig:' });
      expect(page.keys).toHaveLength(1);
      const exp = page.keys[0].expiration;
      expect(typeof exp).toBe('number');
      expect(exp).toBeGreaterThanOrEqual(before + 3500);
      expect(exp).toBeLessThanOrEqual(before + 3600 + 5);
    });

    it('an overwrite WITHOUT a TTL clears the prior expiry', async () => {
      const kv = makeFixture();
      await kv.put('drop:1', 'v1', { expirationTtl: 3600 });
      await kv.put('drop:1', 'v2');
      expect(await kv.get('drop:1')).toBe('v2');
      const page = await kv.list({ prefix: 'drop:' });
      expect(page.keys).toHaveLength(1);
      expect(page.keys[0].expiration).toBeUndefined();
    });

    it('an overwrite WITH a TTL replaces a no-expiry value', async () => {
      const kv = makeFixture();
      await kv.put('drop:1', 'v1');
      await kv.put('drop:1', 'v2', { expirationTtl: 0 });
      expect(await kv.get('drop:1')).toBeNull();
    });

    it('list filters by prefix and excludes expired keys', async () => {
      const kv = makeFixture();
      await kv.put('inbox:u1', 'a');
      await kv.put('inbox:u2', 'b');
      await kv.put('sealed:u1', 'c');
      await kv.put('inbox:gone', 'd', { expirationTtl: 0 });
      const page = await kv.list({ prefix: 'inbox:' });
      expect(names(page)).toEqual(['inbox:u1', 'inbox:u2']);
      expect(page.list_complete).toBe(true);
    });

    it('a cursor-following sweep finds every key under the prefix', async () => {
      const kv = makeFixture();
      for (const n of ['u1', 'u2', 'u3', 'u4', 'u5']) await kv.put(`prekey:${n}`, 'x');
      await kv.put('alias:other', 'x');
      expect(await sweep(kv, 'prekey:')).toEqual([
        'prekey:u1', 'prekey:u2', 'prekey:u3', 'prekey:u4', 'prekey:u5',
      ]);
    });
  });
}

kvContract('mockKV', () => makeKV());
kvContract('SQLite shim', () => makeSqliteKVFixture().kv);

describe('KV shim — pagination (shim only; mockKV does not page)', () => {
  it('pages by cursor with list_complete only on the last page', async () => {
    const kv = makeSqliteKV(makeSqliteDb());
    for (const n of ['u1', 'u2', 'u3', 'u4', 'u5']) await kv.put(`pg:${n}`, 'x');
    const p1 = await kv.list({ prefix: 'pg:', limit: 2 });
    expect(p1.keys.map((k) => k.name)).toEqual(['pg:u1', 'pg:u2']);
    expect(p1.list_complete).toBe(false);
    expect(typeof p1.cursor).toBe('string');
    const p2 = await kv.list({ prefix: 'pg:', limit: 2, cursor: p1.cursor });
    expect(p2.keys.map((k) => k.name)).toEqual(['pg:u3', 'pg:u4']);
    expect(p2.list_complete).toBe(false);
    const p3 = await kv.list({ prefix: 'pg:', limit: 2, cursor: p2.cursor });
    expect(p3.keys.map((k) => k.name)).toEqual(['pg:u5']);
    expect(p3.list_complete).toBe(true);
  });

  it('list returns keys in lexicographic order, like real KV', async () => {
    const kv = makeSqliteKV(makeSqliteDb());
    await kv.put('b:2', 'x');
    await kv.put('b:10', 'x');
    await kv.put('b:1', 'x');
    const page = await kv.list({ prefix: 'b:' });
    expect(page.keys.map((k) => k.name)).toEqual(['b:1', 'b:10', 'b:2']);
  });
});
