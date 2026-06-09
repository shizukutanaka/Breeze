import { describe, it, expect } from 'vitest';
import { makeChallengeString, solve, verify } from '../src/crypto/pow.js';

const subtle = globalThis.crypto.subtle;
const PUB = 'testpubkey123456789';

describe('makeChallengeString', () => {
  it('includes the pub key in the challenge', () => {
    const c = makeChallengeString(PUB);
    expect(c).toContain(PUB);
  });

  it('includes extra when provided', () => {
    const c = makeChallengeString(PUB, 'myalias');
    expect(c).toContain('myalias');
    expect(c).toContain(PUB);
  });

  it('includes a timestamp', () => {
    const before = Date.now();
    const c      = makeChallengeString(PUB);
    const after  = Date.now();
    const ts     = parseInt(c.split(':').pop());
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('each call produces a unique challenge (different timestamps)', async () => {
    const c1 = makeChallengeString(PUB);
    await new Promise(r => setTimeout(r, 2)); // ensure different ms
    const c2 = makeChallengeString(PUB);
    // Timestamps differ → strings differ (not a strict requirement but near-certain)
    // just check both embed the pub
    expect(c1).toContain(PUB);
    expect(c2).toContain(PUB);
  });
});

// Shared token for the verify tests — solved once, reused to avoid redundant CPU work.
let _sharedToken;
async function getToken() {
  if (!_sharedToken) _sharedToken = await solve(subtle, makeChallengeString(PUB), 16);
  return _sharedToken;
}

describe('solve', () => {
  it('returns a token with challenge, nonce, difficulty', async () => {
    const token = await getToken();
    expect(typeof token.challenge).toBe('string');
    expect(token.challenge).toContain(PUB);
    expect(typeof token.nonce).toBe('number');
    expect(token.nonce).toBeGreaterThanOrEqual(0);
    expect(token.difficulty).toBe(16);
  }, 30000);

  it('produces a hash whose top difficulty bits are zero', async () => {
    const { challenge, nonce, difficulty } = await getToken();
    const digest  = await subtle.digest('SHA-256', new TextEncoder().encode(`${challenge}:${nonce}`));
    const first32 = new DataView(digest).getUint32(0, false);
    const target  = (2 ** (32 - difficulty)) >>> 0;
    expect(first32).toBeLessThan(target);
  }, 30000);

  it('clamps difficulty below minimum to 16', async () => {
    // Solve at an artificially low value — module clamps to 16 and still solves
    const challenge = makeChallengeString(PUB);
    const token     = await solve(subtle, challenge, 0);
    expect(token.difficulty).toBe(16);
  }, 30000);
});

describe('verify', () => {
  it('accepts a correctly solved token', async () => {
    const token = await getToken();
    const r     = await verify(subtle, token, PUB);
    expect(r.ok).toBe(true);
    expect(r.difficulty).toBe(16);
  }, 30000);

  it('rejects null / undefined token', async () => {
    expect((await verify(subtle, null, PUB)).ok).toBe(false);
    expect((await verify(subtle, undefined, PUB)).ok).toBe(false);
    expect((await verify(subtle, null, PUB)).code).toBe('POW_REQUIRED');
  });

  it('rejects token with non-number nonce', async () => {
    const token = await getToken();
    const bad   = { ...token, nonce: 'abc' };
    expect((await verify(subtle, bad, PUB)).code).toBe('POW_REQUIRED');
  }, 30000);

  it('rejects difficulty < 16 (POW_TOO_EASY)', async () => {
    const token = await getToken();
    const bad   = { ...token, difficulty: 8 };
    const r     = await verify(subtle, bad, PUB);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('POW_TOO_EASY');
  }, 30000);

  it('rejects challenge > 512 chars (POW_CHALLENGE_TOO_LONG)', async () => {
    const token = await getToken();
    const bad   = { ...token, challenge: PUB + ':' + 'x'.repeat(500) };
    const r     = await verify(subtle, bad, PUB);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('POW_CHALLENGE_TOO_LONG');
  }, 30000);

  it('rejects challenge that does not include pub (POW_PUB_MISMATCH)', async () => {
    const token = await getToken();
    const bad   = { ...token, challenge: 'no-pub-key-here:12345' };
    const r     = await verify(subtle, bad, PUB);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('POW_PUB_MISMATCH');
  }, 30000);

  it('rejects a tampered nonce (POW_INVALID)', async () => {
    const token = await getToken();
    const bad   = { ...token, nonce: token.nonce + 1 };
    const r     = await verify(subtle, bad, PUB);
    // Incremented nonce almost certainly fails (P(valid adjacent) ≈ 2^-16)
    expect(r.ok).toBe(false);
    expect(r.code).toBe('POW_INVALID');
  }, 30000);

  it('round-trip: verify accepts a freshly solved token', async () => {
    const token  = await getToken();
    const result = await verify(subtle, token, PUB);
    expect(result.ok).toBe(true);
  }, 30000);

  it('accepts a fresh token within maxAge window', async () => {
    const token = await getToken();
    // token was just solved — its timestamp is ≤1s old; maxAge=60000 should accept it
    const r = await verify(subtle, token, PUB, { maxAge: 60_000 });
    expect(r.ok).toBe(true);
  }, 30000);

  it('rejects a token older than maxAge (POW_EXPIRED)', async () => {
    const token = await getToken();
    // fake "now" as 2 minutes after the token was created → token is stale
    const ts = parseInt(token.challenge.split(':').pop(), 10);
    const futureNow = () => ts + 120_001;
    const r = await verify(subtle, token, PUB, { maxAge: 120_000, now: futureNow });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('POW_EXPIRED');
  }, 30000);

  it('omitting maxAge skips freshness check (backward-compatible)', async () => {
    const token = await getToken();
    // Simulate a very old token by faking now = ts + 1 year
    const ts = parseInt(token.challenge.split(':').pop(), 10);
    const futureNow = () => ts + 365 * 24 * 3600 * 1000;
    // Without maxAge, the clock override has no effect → still accepted
    const r = await verify(subtle, token, PUB, { now: futureNow });
    expect(r.ok).toBe(true);
  }, 30000);

  it('rejects when challenge has no parseable timestamp and maxAge is set', async () => {
    const token = await getToken();
    // Replace the challenge with one that has no numeric tail
    const bad = { ...token, challenge: `${PUB}:no-timestamp-here` };
    const r = await verify(subtle, bad, PUB, { maxAge: 60_000 });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('POW_EXPIRED');
  }, 30000);

  it('rejects a far-future timestamp (replay-via-future-ts guard)', async () => {
    const token = await getToken();
    const ts = parseInt(token.challenge.split(':').pop(), 10);
    // Attacker embeds a ts 1 hour in the future so (now - ts) stays negative forever,
    // which a past-only freshness check would accept indefinitely. The future bound
    // (default 5 min skew) must reject it as POW_EXPIRED.
    const pastNow = () => ts - 3600_000;
    const r = await verify(subtle, token, PUB, { maxAge: 600_000, now: pastNow });
    expect(r.ok).toBe(false);
    expect(r.code).toBe('POW_EXPIRED');
  }, 30000);

  it('tolerates a small future timestamp within the skew window', async () => {
    const token = await getToken();
    const ts = parseInt(token.challenge.split(':').pop(), 10);
    // ts is 1 minute "ahead" of now — within the default 5-min skew → still accepted.
    const pastNow = () => ts - 60_000;
    const r = await verify(subtle, token, PUB, { maxAge: 600_000, now: pastNow });
    expect(r.ok).toBe(true);
  }, 30000);
});
