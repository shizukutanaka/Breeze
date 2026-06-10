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

  it('rejects an absurd iteration count without hanging (DoS guard on attacker-set iter)', async () => {
    const rec = await A.wrapJWK(sampleJWK, 'pw');
    // A tampered/corrupt record could carry iter=1e12, hanging PBKDF2 on the main
    // thread. The unwrap must reject it fast (before deriving) rather than execute it.
    for (const badIter of [1e12, Infinity, NaN, -1, 0, '1000', undefined]) {
      const tampered = { ...rec, iter: badIter };
      const t0 = Date.now();
      expect(await A.unwrapJWK(tampered, 'pw')).toBe(null);
      expect(Date.now() - t0).toBeLessThan(1000); // returned quickly, did not run PBKDF2
    }
  });

  it('still unwraps a record at exactly the ceiling boundary is rejected above it', async () => {
    // A record whose iter is just over the ceiling is rejected; the legitimate
    // record (cfg.iterations = 1000, well under the ceiling) still round-trips.
    const rec = await A.wrapJWK(sampleJWK, 'pw');
    expect(await A.unwrapJWK({ ...rec, iter: 10_000_001 }, 'pw')).toBe(null);
    expect(await A.unwrapJWK(rec, 'pw')).toEqual(sampleJWK);
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

describe('keystore record detection + load (isWrapped / loadKey — G5 port-enabler)', () => {
  it('isWrapped distinguishes wrapped, migrated, and legacy-plaintext records', async () => {
    const wrapRec = await A.wrapJWK(sampleJWK, 'pw');           // bare wrap record
    const migrated = await A.migrate({ priv: sampleJWK, pubB64: 'P' }, 'pw'); // { wrapped }
    expect(A.isWrapped(wrapRec)).toBe(true);
    expect(A.isWrapped(migrated)).toBe(true);
    expect(A.isWrapped({ priv: sampleJWK })).toBe(false);       // legacy plaintext
    expect(A.isWrapped(null)).toBe(false);
    expect(A.isWrapped({})).toBe(false);
  });

  it('loadKey returns plaintext priv directly (no passphrase needed)', async () => {
    expect(await A.loadKey({ priv: sampleJWK, pubB64: 'P' })).toEqual(sampleJWK);
    expect(await A.loadKey({ priv: sampleJWK }, 'ignored')).toEqual(sampleJWK);
    expect(await A.loadKey(null)).toBe(null);
  });

  it('loadKey unwraps a migrated record with the correct passphrase', async () => {
    const migrated = await A.migrate({ priv: sampleJWK, pubB64: 'P' }, 'pw');
    expect(await A.loadKey(migrated, 'pw')).toEqual(sampleJWK);
    expect(await A.loadKey(migrated, 'wrong')).toBe(null); // wrong passphrase → null (no throw)
  });

  it('loadKey unwraps a bare wrap record too', async () => {
    const wrapRec = await A.wrapJWK(sampleJWK, 'pw');
    expect(await A.loadKey(wrapRec, 'pw')).toEqual(sampleJWK);
  });

  it('loadKey THROWS when a wrapped record is loaded without a passphrase (prompt signal)', async () => {
    const migrated = await A.migrate({ priv: sampleJWK, pubB64: 'P' }, 'pw');
    await expect(A.loadKey(migrated)).rejects.toThrow(/passphrase required/);
  });
});

describe('security floor', () => {
  it('defaults to >= 600k PBKDF2 iterations', () => {
    expect(createAtRest()._cfg.iterations).toBeGreaterThanOrEqual(600000);
  });
});

describe('zeroBuffer', () => {
  it('fills a Uint8Array with zeros', () => {
    const buf = new Uint8Array([1, 2, 3, 4]);
    A.zeroBuffer(buf);
    expect(Array.from(buf)).toEqual([0, 0, 0, 0]);
  });

  it('fills an ArrayBuffer with zeros', () => {
    const ab = new Uint8Array([5, 6, 7]).buffer;
    A.zeroBuffer(ab);
    expect(Array.from(new Uint8Array(ab))).toEqual([0, 0, 0]);
  });
});
