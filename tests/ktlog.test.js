import { describe, it, expect } from 'vitest';
import { hashIK, parseLog, checkRollover, mergeLog, chainHash, appendChainEntry, verifyChain, auditBundle } from '../src/crypto/ktlog.js';

const subtle = globalThis.crypto.subtle;

// Helper: stable JSON for an identity key object
const ikJson = (n) => JSON.stringify({ crv: 'X25519', kty: 'OKP', x: `key${n}` });

describe('hashIK', () => {
  it('returns a non-empty base64 string', async () => {
    const h = await hashIK(subtle, ikJson(1));
    expect(typeof h).toBe('string');
    expect(h.length).toBeGreaterThan(20);
  });

  it('is deterministic — same input → same hash', async () => {
    const h1 = await hashIK(subtle, ikJson(1));
    const h2 = await hashIK(subtle, ikJson(1));
    expect(h1).toBe(h2);
  });

  it('different input → different hash', async () => {
    const h1 = await hashIK(subtle, ikJson(1));
    const h2 = await hashIK(subtle, ikJson(2));
    expect(h1).not.toBe(h2);
  });
});

describe('parseLog', () => {
  it('returns [] for null / undefined / non-array inputs', () => {
    expect(parseLog(null)).toEqual([]);
    expect(parseLog(undefined)).toEqual([]);
    expect(parseLog('string')).toEqual([]);
    expect(parseLog(42)).toEqual([]);
  });

  it('returns [] for empty array', () => {
    expect(parseLog([])).toEqual([]);
  });

  it('filters out entries with missing or invalid fields', () => {
    const log = parseLog([
      { ts: 1000, h: 'abc' },
      { h: 'no-ts' },
      { ts: 2000 },
      null,
      { ts: 'str', h: 'bad-ts' },
      { ts: 3000, h: '' },
    ]);
    expect(log).toHaveLength(1);
    expect(log[0]).toEqual({ ts: 1000, h: 'abc' });
  });

  it('sorts entries by ts ascending', () => {
    const log = parseLog([
      { ts: 3000, h: 'c' },
      { ts: 1000, h: 'a' },
      { ts: 2000, h: 'b' },
    ]);
    expect(log.map(e => e.h)).toEqual(['a', 'b', 'c']);
  });

  it('passes through extra fields on entries', () => {
    const log = parseLog([{ ts: 1000, h: 'abc', extra: 'data' }]);
    expect(log[0].extra).toBe('data');
  });
});

describe('checkRollover', () => {
  it('returns unknown when log is empty', async () => {
    const r = await checkRollover(subtle, ikJson(1), []);
    expect(r.status).toBe('unknown');
  });

  it('returns unknown when log is null', async () => {
    const r = await checkRollover(subtle, ikJson(1), null);
    expect(r.status).toBe('unknown');
  });

  it('returns new when storedIkJson is null (first contact)', async () => {
    const h = await hashIK(subtle, ikJson(1));
    const r = await checkRollover(subtle, null, [{ ts: 1000, h }]);
    expect(r.status).toBe('new');
    expect(r.currentHash).toBe(h);
    expect(Array.isArray(r.log)).toBe(true);
  });

  it('returns new when storedIkJson is undefined', async () => {
    const h = await hashIK(subtle, ikJson(1));
    const r = await checkRollover(subtle, undefined, [{ ts: 1000, h }]);
    expect(r.status).toBe('new');
  });

  it('returns ok when stored hash matches latest log entry', async () => {
    const ik = ikJson(1);
    const h = await hashIK(subtle, ik);
    const r = await checkRollover(subtle, ik, [{ ts: 1000, h }]);
    expect(r.status).toBe('ok');
    expect(r.currentHash).toBe(h);
  });

  it('ok even when log has multiple entries and latest matches', async () => {
    const ik = ikJson(2);
    const h1 = await hashIK(subtle, ikJson(1));
    const h2 = await hashIK(subtle, ik);
    const r = await checkRollover(subtle, ik, [
      { ts: 1000, h: h1 },
      { ts: 2000, h: h2 },
    ]);
    expect(r.status).toBe('ok');
  });

  it('returns rolled when stored hash differs from latest', async () => {
    const oldIk = ikJson(1);
    const h1    = await hashIK(subtle, oldIk);
    const h2    = await hashIK(subtle, ikJson(2));
    const r     = await checkRollover(subtle, oldIk, [
      { ts: 1000, h: h1 },
      { ts: 2000, h: h2 },
    ]);
    expect(r.status).toBe('rolled');
    expect(r.storedHash).toBe(h1);
    expect(r.currentHash).toBe(h2);
  });

  it('rolled: storedSeenInHistory is true when old hash is in the log', async () => {
    const oldIk = ikJson(1);
    const h1    = await hashIK(subtle, oldIk);
    const h2    = await hashIK(subtle, ikJson(2));
    const r     = await checkRollover(subtle, oldIk, [
      { ts: 1000, h: h1 },
      { ts: 2000, h: h2 },
    ]);
    expect(r.storedSeenInHistory).toBe(true);
  });

  it('rolled: storedSeenInHistory is false when old hash not in log (gap / log truncated)', async () => {
    const oldIk = ikJson(1);
    const h2    = await hashIK(subtle, ikJson(2));
    // log only contains the new key — old key was purged or server tampered
    const r     = await checkRollover(subtle, oldIk, [{ ts: 2000, h: h2 }]);
    expect(r.status).toBe('rolled');
    expect(r.storedSeenInHistory).toBe(false);
  });

  it('rolled: rolloverTs is the timestamp of the new (current) hash entry', async () => {
    const oldIk = ikJson(1);
    const h1    = await hashIK(subtle, oldIk);
    const h2    = await hashIK(subtle, ikJson(2));
    const r     = await checkRollover(subtle, oldIk, [
      { ts: 1000, h: h1 },
      { ts: 9999, h: h2 },
    ]);
    expect(r.rolloverTs).toBe(9999);
  });

  it('rolled: rolloverTs is null when the current hash is not in the log', async () => {
    // edge case: log doesn't include the current entry (shouldn't happen with well-formed data)
    const oldIk = ikJson(1);
    const h1    = await hashIK(subtle, oldIk);
    const hOther = await hashIK(subtle, ikJson(99));
    const r = await checkRollover(subtle, oldIk, [{ ts: 1000, h: h1 }]);
    // stored matches last entry → 'ok', not rolled — different scenario
    expect(r.status).toBe('ok');
  });
});

describe('mergeLog', () => {
  it('returns [] when both inputs are empty/null', () => {
    expect(mergeLog([], [])).toEqual([]);
    expect(mergeLog(null, null)).toEqual([]);
  });

  it('merges two disjoint logs and sorts by ts', () => {
    const a = [{ ts: 1000, h: 'a' }, { ts: 3000, h: 'c' }];
    const b = [{ ts: 2000, h: 'b' }];
    const merged = mergeLog(a, b);
    expect(merged.map(e => e.h)).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates by hash — keeps earliest timestamp', () => {
    const a = [{ ts: 1000, h: 'x' }];
    const b = [{ ts: 500, h: 'x' }]; // earlier ts for same hash
    const merged = mergeLog(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0].ts).toBe(500);
  });

  it('handles one empty input', () => {
    const a = [{ ts: 1, h: 'a' }, { ts: 2, h: 'b' }];
    expect(mergeLog(a, [])).toEqual(a);
    expect(mergeLog([], a)).toEqual(a);
  });

  it('caps at 20 entries, keeping the 20 latest', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ts: i, h: `h${i}` }));
    const merged = mergeLog(many, []);
    expect(merged).toHaveLength(20);
    expect(merged[0].ts).toBe(5);  // oldest retained is index 5
    expect(merged[19].ts).toBe(24);
  });

  it('handles malformed entries in either input gracefully', () => {
    const a = [{ ts: 1000, h: 'ok' }, null, { h: 'no-ts' }];
    const b = [{ ts: 2000 }];
    const merged = mergeLog(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0].h).toBe('ok');
  });
});

describe('N5 — hash-chained log (tamper-evident)', () => {
  // Helper: a fake base64-encoded 32-byte hash.
  const fakeH = (n) => btoa(String.fromCharCode(...new Uint8Array(32).fill(n)));

  it('chainHash is deterministic for the same prevC and h', async () => {
    const h = fakeH(1);
    const c1 = await chainHash(subtle, null, h);
    const c2 = await chainHash(subtle, null, h);
    expect(c1).toBe(c2);
  });

  it('chainHash differs for different prevC values', async () => {
    const h = fakeH(1);
    const c1 = await chainHash(subtle, null, h);           // prevC = zero vector
    const c2 = await chainHash(subtle, fakeH(2), h);       // prevC = non-zero
    expect(c1).not.toBe(c2);
  });

  it('chainHash differs for different h values', async () => {
    const c1 = await chainHash(subtle, null, fakeH(1));
    const c2 = await chainHash(subtle, null, fakeH(2));
    expect(c1).not.toBe(c2);
  });

  it('appendChainEntry creates a linked chain of entries', async () => {
    const h1 = fakeH(1), h2 = fakeH(2), h3 = fakeH(3);
    const e1 = await appendChainEntry(subtle, [], h1, 1000);
    expect(e1.h).toBe(h1);
    expect(typeof e1.c).toBe('string');
    expect(e1.c.length).toBeGreaterThan(20);

    const e2 = await appendChainEntry(subtle, [e1], h2, 2000);
    // e2.c must be chainHash(e1.c, h2)
    const expected2 = await chainHash(subtle, e1.c, h2);
    expect(e2.c).toBe(expected2);

    const e3 = await appendChainEntry(subtle, [e1, e2], h3, 3000);
    const expected3 = await chainHash(subtle, e2.c, h3);
    expect(e3.c).toBe(expected3);
  });

  it('verifyChain accepts a valid 3-entry chain', async () => {
    const h1 = fakeH(10), h2 = fakeH(11), h3 = fakeH(12);
    const e1 = await appendChainEntry(subtle, [], h1, 1000);
    const e2 = await appendChainEntry(subtle, [e1], h2, 2000);
    const e3 = await appendChainEntry(subtle, [e1, e2], h3, 3000);
    const r = await verifyChain(subtle, [e1, e2, e3]);
    expect(r.ok).toBe(true);
  });

  it('verifyChain detects a tampered chain hash', async () => {
    const h1 = fakeH(20), h2 = fakeH(21);
    const e1 = await appendChainEntry(subtle, [], h1, 1000);
    const e2 = await appendChainEntry(subtle, [e1], h2, 2000);
    // Tamper e2.c
    const bad = { ...e2, c: fakeH(99) };
    const r = await verifyChain(subtle, [e1, bad]);
    expect(r.ok).toBe(false);
    expect(r.invalidIdx).toBe(1);
  });

  it('verifyChain detects a tampered h in an entry (chain hash no longer matches)', async () => {
    const h1 = fakeH(30), h2 = fakeH(31);
    const e1 = await appendChainEntry(subtle, [], h1, 1000);
    const e2 = await appendChainEntry(subtle, [e1], h2, 2000);
    // Tamper e1.h (but leave e1.c intact → e2.c now incorrect)
    const badE1 = { ...e1, h: fakeH(99) };
    const r = await verifyChain(subtle, [badE1, e2]);
    expect(r.ok).toBe(false);
  });

  it('verifyChain skips legacy entries without c and continues the chain', async () => {
    const h1 = fakeH(40), h2 = fakeH(41);
    // e_legacy has no c field — it is from before the chain feature
    const e_legacy = { ts: 500, h: fakeH(39) };
    const e1 = await appendChainEntry(subtle, [], h1, 1000);
    const e2 = await appendChainEntry(subtle, [e1], h2, 2000);
    // Mix legacy + chained entries
    const r = await verifyChain(subtle, [e_legacy, e1, e2]);
    expect(r.ok).toBe(true);
  });

  it('verifyChain returns ok for an empty or all-legacy log', async () => {
    expect((await verifyChain(subtle, [])).ok).toBe(true);
    expect((await verifyChain(subtle, [{ ts: 1, h: fakeH(1) }])).ok).toBe(true); // no c
  });
});

describe('untrusted-relay hardening (DoS / malformed input)', () => {
  const fakeH = (n) => btoa(String.fromCharCode(...new Uint8Array(32).fill(n)));

  it('parseLog bounds a huge relay-supplied array (keeps the newest 256)', () => {
    // 5000 valid entries with ascending ts; only the last 256 should survive.
    const huge = Array.from({ length: 5000 }, (_, i) => ({ ts: i, h: `h${i}` }));
    const out = parseLog(huge);
    expect(out).toHaveLength(256);
    // slice(-256) keeps ts 4744..4999 → after sort the newest is 4999.
    expect(out[out.length - 1].ts).toBe(4999);
    expect(out[0].ts).toBe(4744);
  });

  it('verifyChain fails (does not throw) on a malformed-base64 h in a chained entry', async () => {
    const e1 = await appendChainEntry(subtle, [], fakeH(1), 1000);
    // e2 claims to be chained (has a string c) but its h is not valid base64.
    const e2 = { ts: 2000, h: '!!!not-base64!!!', c: fakeH(9) };
    const r = await verifyChain(subtle, [e1, e2]);
    expect(r.ok).toBe(false);
    expect(r.invalidIdx).toBe(1);
  });

  it('verifyChain fails on a non-string c (tampering, not legacy)', async () => {
    const e1 = await appendChainEntry(subtle, [], fakeH(1), 1000);
    const e2 = { ts: 2000, h: fakeH(2), c: 12345 }; // c present but wrong type
    const r = await verifyChain(subtle, [e1, e2]);
    expect(r.ok).toBe(false);
    expect(r.invalidIdx).toBe(1);
  });
});

describe('auditBundle (full on-fetch audit: chain integrity + rollover)', () => {
  const ikJson = (n) => JSON.stringify({ crv: 'X25519', kty: 'OKP', x: `key${n}` });
  async function chainedLog(...ns) {
    let log = [];
    for (let i = 0; i < ns.length; i++) {
      const h = await hashIK(subtle, ikJson(ns[i]));
      log = [...log, await appendChainEntry(subtle, log, h, 1000 + i)];
    }
    return log;
  }

  it("verdict 'ok' when the chain is valid and the stored key matches the latest", async () => {
    const log = await chainedLog(1);
    const r = await auditBundle(subtle, ikJson(1), log);
    expect(r.chainOk).toBe(true);
    expect(r.verdict).toBe('ok');
    expect(r.rollover.status).toBe('ok');
  });

  it("verdict 'new' on first contact (chain valid, no stored key)", async () => {
    const log = await chainedLog(1);
    const r = await auditBundle(subtle, null, log);
    expect(r.chainOk).toBe(true);
    expect(r.verdict).toBe('new');
  });

  it("verdict 'rolled' when the chain is valid but the identity key changed", async () => {
    const log = await chainedLog(1, 2);          // IK1 → IK2, properly chained
    const r = await auditBundle(subtle, ikJson(1), log); // we still pin IK1
    expect(r.chainOk).toBe(true);
    expect(r.verdict).toBe('rolled');
    expect(r.rollover.storedSeenInHistory).toBe(true);
  });

  it("verdict 'tampered' beats a clean rollover when the hash chain is broken", async () => {
    const log = await chainedLog(1, 2);
    log[1] = { ...log[1], c: log[1].c.slice(0, -2) + 'XY' }; // corrupt the chain link
    // Stored key matches the latest (rollover would say 'ok'), but the chain is broken,
    // so the relay rewrote the log → must surface as 'tampered', not 'ok'.
    const r = await auditBundle(subtle, ikJson(2), log);
    expect(r.chainOk).toBe(false);
    expect(r.chainInvalidIdx).toBe(1);
    expect(r.verdict).toBe('tampered');
  });

  it("verdict 'ok' (proceed) on an empty/unknown log", async () => {
    const r = await auditBundle(subtle, ikJson(1), []);
    expect(r.chainOk).toBe(true);     // empty chain vacuously valid
    expect(r.verdict).toBe('ok');
    expect(r.rollover.status).toBe('unknown');
  });
});
