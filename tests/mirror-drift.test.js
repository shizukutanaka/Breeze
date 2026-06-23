// ============================================================================
// MIRROR-DRIFT GUARD — the test that was missing.
//
// index.html and _worker.js ship HAND-MAINTAINED INLINE COPIES of the crypto in
// src/crypto/* (grep "inline mirror of src/crypto"). Every other test in this repo
// verifies the *reference* modules — NOT the inline copies that actually run in the
// browser. So a drift between the two leaves the whole suite GREEN while production
// E2E silently breaks: the worst failure mode for an E2E messenger, and until now
// nothing mechanically enforced the "keep in sync" comment.
//
// This guard closes that gap for the at-rest key-wrapping mirror by EVALUATING the
// real inline code out of index.html (the sanctioned sw.test.js pattern: readFileSync
// + new Function in a mocked scope) and asserting WIRE + BEHAVIOURAL parity with the
// tested reference src/crypto/atrest.js:
//   - a record wrapped by the reference unwraps with the inline impl, and vice-versa
//   - isWrapped / wrong-passphrase / AAD-context-binding / iter-DoS-guard all agree
// Any drift that changes the wire format, the AAD domain, the kdf label, or the guard
// breaks a cross-test here instead of breaking real users silently.
//
// To extend to other mirrors (ratchet/group/pow/…), add a block that extracts the
// inline functions the same way and cross-tests them against their src/crypto module.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createAtRest } from '../src/crypto/atrest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

// Extract the inline at-rest block from index.html. If the markers move, fail loudly
// with a clear instruction rather than silently testing nothing.
const START = 'const _AT_REST_AAD_DOMAIN';
const END = '\nfunction arr(';
const s = html.indexOf(START);
const e = html.indexOf(END, s);
if (s < 0 || e < 0) {
  throw new Error(
    'mirror-drift guard: could not locate the inline at-rest block in index.html ' +
    '(markers "const _AT_REST_AAD_DOMAIN" .. "function arr("). If the inline mirror ' +
    'was renamed/moved, update tests/mirror-drift.test.js to match.',
  );
}
const inlineBlock = html.slice(s, e);

// Evaluate the real inline source with the same dependencies index.html provides it.
const CONFIG_SHIM = { AES_KEY_BITS: 256, IV_BYTES: 12, PBKDF2_AT_REST_ITERATIONS: 600000 };
const u8 = (a) => new Uint8Array(a);
const inlineFactory = new Function(
  'crypto', 'CONFIG', 'u8', 'TextEncoder', 'TextDecoder', 'btoa', 'atob',
  inlineBlock +
    '\nreturn { _atRestWrap, _atRestUnwrap, _atRestIsWrapped, _atRestLoadKey, _atRestMigrate, _atRestAad, _AT_REST_AAD_DOMAIN, _AT_REST_MAX_ITER };',
);
const inline = inlineFactory(globalThis.crypto, CONFIG_SHIM, u8, TextEncoder, TextDecoder, globalThis.btoa, globalThis.atob);

// Reference module, configured to match the inline production parameters.
const ref = createAtRest({ iterations: 600000, hash: 'SHA-256' });

const JWK = { kty: 'OKP', crv: 'X25519', x: 'pub-bytes-b64', d: 'PRIVATE-secret-bytes' };
const PASS = 'correct horse battery staple';

describe('at-rest mirror — inline (index.html) vs reference (src/crypto/atrest.js)', () => {
  it('inline self round-trips (wrap → unwrap returns the JWK)', async () => {
    const rec = await inline._atRestWrap(JWK, PASS);
    expect(await inline._atRestUnwrap(rec, PASS)).toEqual(JWK);
  });

  it('WIRE PARITY: a reference-wrapped record unwraps with the inline impl', async () => {
    const rec = await ref.wrapJWK(JWK, PASS);
    expect(await inline._atRestUnwrap(rec, PASS)).toEqual(JWK);
  });

  it('WIRE PARITY: an inline-wrapped record unwraps with the reference impl', async () => {
    const rec = await inline._atRestWrap(JWK, PASS);
    expect(await ref.unwrapJWK(rec, PASS)).toEqual(JWK);
  });

  it('record shape is identical (v/kdf/hash + base64 fields)', async () => {
    const a = await inline._atRestWrap(JWK, PASS);
    const b = await ref.wrapJWK(JWK, PASS);
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(a.v).toBe(b.v);
    expect(a.kdf).toBe(b.kdf);
    expect(a.hash).toBe(b.hash);
    expect(a.iter).toBe(b.iter);
    expect(a.kdf).toBe('pbkdf2');
    expect(a.hash).toBe('SHA-256');
  });

  it('AAD domain tag matches (cross-decrypt would fail otherwise)', () => {
    expect(inline._AT_REST_AAD_DOMAIN).toBe('breeze-atrest-v1');
    // Same value, regardless of how each source writes it (10_000_000 vs 10000000).
    expect(inline._AT_REST_MAX_ITER).toBe(10_000_000);
  });

  it('context/AAD binding agrees: same-context unwrap works, cross-context fails — both ways', async () => {
    const recRef = await ref.wrapJWK(JWK, PASS, 'slot-A');
    expect(await inline._atRestUnwrap(recRef, PASS, 'slot-A')).toEqual(JWK);
    expect(await inline._atRestUnwrap(recRef, PASS, 'slot-B')).toBeNull();

    const recInline = await inline._atRestWrap(JWK, PASS, 'slot-A');
    expect(await ref.unwrapJWK(recInline, PASS, 'slot-A')).toEqual(JWK);
    expect(await ref.unwrapJWK(recInline, PASS, 'slot-B')).toBeNull();
  });

  it('wrong passphrase returns null in both', async () => {
    const rec = await ref.wrapJWK(JWK, PASS);
    expect(await inline._atRestUnwrap(rec, 'wrong')).toBeNull();
    const rec2 = await inline._atRestWrap(JWK, PASS);
    expect(await ref.unwrapJWK(rec2, 'wrong')).toBeNull();
  });

  it('iter DoS-guard agrees: an out-of-range iteration count is rejected by both', async () => {
    const rec = await ref.wrapJWK(JWK, PASS);
    const evil = { ...rec, iter: 1e12 };
    expect(await inline._atRestUnwrap(evil, PASS)).toBeNull();
    expect(await ref.unwrapJWK(evil, PASS)).toBeNull();
    const bad = { ...rec, iter: 0 };
    expect(await inline._atRestUnwrap(bad, PASS)).toBeNull();
    expect(await ref.unwrapJWK(bad, PASS)).toBeNull();
  });

  it('isWrapped agrees across record forms', () => {
    const wrapped = { wrapped: { kdf: 'pbkdf2' } };
    const bare = { kdf: 'pbkdf2', salt: 'x', iv: 'y', ct: 'z' };
    const plaintext = { priv: JWK };
    for (const r of [wrapped, bare, plaintext, null, {}]) {
      expect(inline._atRestIsWrapped(r)).toBe(ref.isWrapped(r));
    }
  });

  it('loadKey: wrapped record without a passphrase throws in both (caller must prompt)', async () => {
    const rec = { wrapped: await ref.wrapJWK(JWK, PASS) };
    await expect(inline._atRestLoadKey(rec, null)).rejects.toThrow();
    await expect(ref.loadKey(rec, null)).rejects.toThrow();
    // legacy plaintext returns priv directly in both
    expect(await inline._atRestLoadKey({ priv: JWK }, null)).toEqual(JWK);
    expect(await ref.loadKey({ priv: JWK }, null)).toEqual(JWK);
  });

  it('migrate: legacy { priv } → wrapped, plaintext removed, unwraps back — both impls', async () => {
    const migratedInline = await inline._atRestMigrate({ priv: JWK, slot: 1 }, PASS);
    expect(migratedInline.priv).toBeUndefined();
    expect(migratedInline.wrapped).toBeTruthy();
    expect(await ref.unwrapJWK(migratedInline.wrapped, PASS)).toEqual(JWK);

    const migratedRef = await ref.migrate({ priv: JWK, slot: 1 }, PASS);
    expect(migratedRef.priv).toBeUndefined();
    expect(await inline._atRestUnwrap(migratedRef.wrapped, PASS)).toEqual(JWK);
  });
});
