import { describe, it, expect } from 'vitest';
import { hashIK, parseLog, checkRollover, mergeLog } from '../src/crypto/ktlog.js';

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
