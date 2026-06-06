// At-rest key wrapping tests (roadmap I4).
import { describe, it, expect } from 'vitest';
import { createAtRest } from '../src/crypto/atrest.js';

// Use low iterations for fast tests; the security floor is asserted separately.
const A = createAtRest({ iterations: 1000 });

const sampleJWK = { kty: 'EC', crv: 'P-256', d: 'abc-private', x: 'pub-x', y: 'pub-y', ext: true };

describe('wrap / unwrap', () => {
  it('round-trips a JWK with the correct passphrase', async () => {
    const rec = await A.wrapJWK(sampleJWK, 'correct horse battery staple');
    const out = await A.unwrapJWK(rec, 'correct horse battery staple');
    expect(out).toEqual(sampleJWK);
  });

  it('produces a record with no plaintext key material', async () => {
    const rec = await A.wrapJWK(sampleJWK, 'pw');
    expect(rec.kdf).toBe('pbkdf2');
    expect(rec.salt && rec.iv && rec.ct).toBeTruthy();
    // The private scalar must not appear anywhere in the serialized record.
    expect(JSON.stringify(rec)).not.toContain('abc-private');
  });

  it('rejects a wrong passphrase (returns null, no throw)', async () => {
    const rec = await A.wrapJWK(sampleJWK, 'right');
    expect(await A.unwrapJWK(rec, 'wrong')).toBe(null);
  });

  it('rejects a tampered ciphertext', async () => {
    const rec = await A.wrapJWK(sampleJWK, 'pw');
    const ctBytes = Buffer.from(rec.ct, 'base64'); ctBytes[0] ^= 0xff;
    rec.ct = ctBytes.toString('base64');
    expect(await A.unwrapJWK(rec, 'pw')).toBe(null);
  });

  it('uses a fresh salt+iv each time (records differ for same input)', async () => {
    const a = await A.wrapJWK(sampleJWK, 'pw');
    const b = await A.wrapJWK(sampleJWK, 'pw');
    expect(a.salt).not.toBe(b.salt);
    expect(a.ct).not.toBe(b.ct);
  });
});

describe('migration of legacy plaintext records', () => {
  it('wraps a legacy { priv } record, removing the plaintext', async () => {
    const legacy = { priv: sampleJWK, pubB64: 'PUBKEY', name: 'alice' };
    const migrated = await A.migrate(legacy, 'pw');
    expect(migrated.priv).toBeUndefined();
    expect(migrated.pubB64).toBe('PUBKEY'); // non-secret fields preserved
    expect(migrated.wrapped).toBeDefined();
    expect(await A.unwrapJWK(migrated.wrapped, 'pw')).toEqual(sampleJWK);
  });

  it('is idempotent on an already-wrapped record', async () => {
    const legacy = { priv: sampleJWK, pubB64: 'X' };
    const once = await A.migrate(legacy, 'pw');
    const twice = await A.migrate(once, 'pw');
    expect(twice).toBe(once); // unchanged reference / no re-wrap
  });
});

describe('security floor', () => {
  it('defaults to >= 600k PBKDF2 iterations', () => {
    expect(createAtRest()._cfg.iterations).toBeGreaterThanOrEqual(600000);
  });
});
