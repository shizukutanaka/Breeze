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
import { makeChallengeString, solve as powSolve, verify as powVerify } from '../src/crypto/pow.js';
import { createRatchet } from '../src/crypto/ratchet.js';

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

// ---------------------------------------------------------------------------
// PoW mirror — a 3-way CROSS-COMPONENT contract: the client solves (inline
// generatePoW in index.html), the worker verifies (inline in _worker.js), and
// src/crypto/pow.js is the tested reference. The worker's verify is covered by
// worker.test.js, but the CLIENT's inline solve is tested nowhere — so a drift in
// the hash input ("challenge:nonce"), the big-endian getUint32(0,false) byte order,
// or the target math would let the client produce tokens the worker rejects (legit
// users locked out of alias/group actions) with every existing test still green.
// ---------------------------------------------------------------------------
const POW_START = 'async function generatePoW(challenge, difficulty) {';
const POW_END = '\n// v3.5: Business-grade file type validation';
const ps = html.indexOf(POW_START);
const pe = html.indexOf(POW_END, ps);
if (ps < 0 || pe < 0) {
  throw new Error(
    'mirror-drift guard: could not locate inline generatePoW in index.html ' +
    '(markers "async function generatePoW" .. "// v3.5: Business-grade file type validation"). ' +
    'If it moved, update tests/mirror-drift.test.js.',
  );
}
const powBlock = html.slice(ps, pe);
const inlineGeneratePoW = new Function(
  'crypto', 'CONFIG', '_dbg',
  powBlock + '\nreturn generatePoW;',
)(globalThis.crypto, { POW_DIFFICULTY: 16 }, () => {});

const subtle = globalThis.crypto.subtle;

describe('PoW mirror — inline generatePoW (index.html) vs reference (src/crypto/pow.js)', () => {
  // Difficulty-16 solving averages ~65k SHA-256 hashes; under parallel suite load this
  // can exceed vitest's 5s default, so these solve-bound tests get a generous timeout.
  // (The reference solver clamps difficulty to a 16-bit floor, so the work can't be reduced.)
  const SOLVE_TIMEOUT = 30000;

  it('finds the IDENTICAL minimal nonce as the reference solver (byte-order + hash-input parity)', async () => {
    // Both scan nonce upward from 0, so for a fixed challenge+difficulty the first
    // satisfying nonce MUST match — unless the hash input string, the text encoding,
    // or the big-endian getUint32 byte order has drifted between the two.
    const challenge = makeChallengeString('PUBKEY_aaaa', 'alias-bob');
    const inlineTok = await inlineGeneratePoW(challenge, 16);
    const refTok = await powSolve(subtle, challenge, 16);
    expect(inlineTok.nonce).toBe(refTok.nonce);
    expect(inlineTok.difficulty).toBe(refTok.difficulty);
  }, SOLVE_TIMEOUT);

  it("a client-solved token is ACCEPTED by the reference verify (what the worker runs)", async () => {
    const pub = 'PUBKEY_bbbb';
    const challenge = makeChallengeString(pub, 'group-create');
    const tok = await inlineGeneratePoW(challenge, 16);
    const res = await powVerify(subtle, tok, pub, { maxAge: 10 * 60 * 1000 });
    expect(res.ok).toBe(true);
  }, SOLVE_TIMEOUT);

  it("the client token still binds the identity (verify rejects it for a different pub)", async () => {
    const challenge = makeChallengeString('PUBKEY_cccc');
    const tok = await inlineGeneratePoW(challenge, 16);
    const res = await powVerify(subtle, tok, 'PUBKEY_dddd');
    expect(res.ok).toBe(false);
    expect(res.code).toBe('POW_PUB_MISMATCH');
  }, SOLVE_TIMEOUT);
});

// ---------------------------------------------------------------------------
// Ratchet KDF mirror — the ratchet primitive guard.
//
// The inline hkdf and kdfChain (index.html DOUBLE RATCHET CRYPTO ENGINE block)
// are the roots of every ratchet message-key derivation: hkdf(ck,'msg') =
// message key, hkdf(ck,'chain') = next chain key. If either info string, salt,
// hash, or KDF length drifts, all 1:1 messages in production silently fail to
// decrypt — the worst possible breakage, and the hardest to diagnose.
//
// Unlike at-rest/PoW, encryptFor/decryptFrom couple IDB session storage and
// cannot be evaluated standalone. The guard therefore extracts only the two
// PURE KDF primitives (hkdf + kdfChain) and cross-tests them three ways:
//   1. Byte-exact hkdf parity (same input → same bits)
//   2. Byte-exact kdfChain parity (same chainKey → same msgKey + nextChain)
//   3. Wire-compat encrypt: inline-derived msgKey → AES-GCM frame → reference
//      ratchetDecrypt recovers plaintext (proves the KDF + frame contract holds)
//   4. Wire-compat decrypt: reference ratchetEncrypt → inline-derived msgKey
//      → raw AES-GCM decrypt succeeds (the reverse direction)
// Any drift in info strings ("msg"/"chain"), the 0^32 HKDF salt, SHA-256, or
// the 32-byte output length breaks test 1 or 2. A frame-format drift (padding
// layout, DataView offset) breaks tests 3 or 4.
// ---------------------------------------------------------------------------
const RATCHET_HKDF_START = '  // --- HKDF helper (RFC 5869) ---';
const RATCHET_HKDF_END = '\n  // --- Session store';
const RATCHET_KDF_START = '  // --- KDF Chain: advance chain key, derive message key ---';
const RATCHET_KDF_END = '\n  // --- DH Ratchet Step ---';

const rhs = html.indexOf(RATCHET_HKDF_START);
const rhe = html.indexOf(RATCHET_HKDF_END, rhs);
const rks = html.indexOf(RATCHET_KDF_START);
const rke = html.indexOf(RATCHET_KDF_END, rks);

if (rhs < 0 || rhe < 0 || rks < 0 || rke < 0) {
  throw new Error(
    'mirror-drift guard: could not locate inline hkdf/kdfChain in index.html ' +
    '(markers "// --- HKDF helper (RFC 5869) ---" .. "// --- Session store" and ' +
    '"// --- KDF Chain: advance chain key" .. "// --- DH Ratchet Step ---"). ' +
    'If the ratchet block moved, update tests/mirror-drift.test.js.',
  );
}

const inlineKdfFactory = new Function(
  'crypto', 'CONFIG', '_dbg',
  html.slice(rhs, rhe) + '\n' + html.slice(rks, rke) +
    '\nreturn { hkdf, kdfChain };',
);
const inlineKdf = inlineKdfFactory(
  globalThis.crypto,
  { HKDF_HASH: 'SHA-256', MSG_PAD_BOUNDARY: 256, IV_BYTES: 12 },
  () => {},
);

const refR = createRatchet({ hasX25519: false }); // P-256; deterministic across Node versions

describe('Ratchet KDF mirror — inline (index.html) vs reference (src/crypto/ratchet.js)', () => {
  const CK = new Uint8Array(32).fill(0x42); // fixed test chain key

  it('KDF PARITY: hkdf produces byte-identical output (same ikm/salt/info/len)', async () => {
    const ikm = new Uint8Array(32).fill(0x11);
    const salt = new Uint8Array(32).fill(0x22);
    const info = 'breeze-ratchet-mirror-test';
    const inlineOut = await inlineKdf.hkdf(ikm, salt, info, 32);
    const refOut = await refR.hkdf(ikm, salt, info, 32);
    expect(Array.from(inlineOut)).toEqual(Array.from(refOut));
  });

  it('KDF PARITY: kdfChain produces byte-identical (msgKey, nextChain) — info strings "msg"/"chain", 0^32 salt', async () => {
    const inlineResult = await inlineKdf.kdfChain(CK);
    const refResult = await refR.kdfChain(CK);
    expect(Array.from(inlineResult.msgKey)).toEqual(Array.from(refResult.msgKey));
    expect(Array.from(inlineResult.nextChain)).toEqual(Array.from(refResult.nextChain));
  });

  it('WIRE COMPAT: inline-kdfChain msgKey → AES-GCM frame → reference ratchetDecrypt recovers plaintext', async () => {
    // Build a receiver session sharing CK as the receive chain key (no DH step)
    const { receiver } = refR.pairFromSharedChain(CK);

    // Derive the first msgKey with INLINE kdfChain
    const { msgKey: inlineMK } = await inlineKdf.kdfChain(CK);

    // Build a v4 frame in inline-style: [flags:1][len:2][data...] padded to 256 bytes
    const text = 'ratchet mirror wire-compat check';
    const raw = new TextEncoder().encode(text);
    const padded = new Uint8Array(256);
    padded[0] = 0x00; // flags: uncompressed
    new DataView(padded.buffer).setUint16(1, raw.length);
    padded.set(raw, 3);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const aesKey = await globalThis.crypto.subtle.importKey('raw', inlineMK, { name: 'AES-GCM' }, false, ['encrypt']);
    const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, padded));

    // Wire format: v4, no key commitment (inline-style)
    const wire = JSON.stringify({ v: 4, i: Array.from(iv), d: Array.from(ct), rk: [1, 2, 3], c: 1 });

    // Reference ratchetDecrypt should recover plaintext iff kdfChain parity holds
    const plaintext = await refR.ratchetDecrypt(receiver, wire);
    expect(plaintext).toBe(text);
  });

  it('WIRE COMPAT: reference ratchetEncrypt frame → inline-kdfChain msgKey decrypts correctly', async () => {
    const { sender } = refR.pairFromSharedChain(CK);

    // Reference encrypts (uses reference kdfChain internally)
    const wire = await refR.ratchetEncrypt(sender, 'hello from reference ratchet');

    // Derive the SAME first msgKey with INLINE kdfChain
    const { msgKey: inlineMK } = await inlineKdf.kdfChain(CK);

    // Raw AES-GCM decrypt with inline-derived key
    const p = JSON.parse(wire);
    const aesKey = await globalThis.crypto.subtle.importKey('raw', inlineMK, { name: 'AES-GCM' }, false, ['decrypt']);
    const padded = new Uint8Array(await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(p.i) }, aesKey, new Uint8Array(p.d),
    ));

    // Unpad v4 frame: [flags:1][len:2][data...]
    const dataLen = new DataView(padded.buffer).getUint16(1);
    const decoded = new TextDecoder().decode(padded.slice(3, 3 + dataLen));
    expect(decoded).toBe('hello from reference ratchet');
  });

  it('wire format: v4 tag, counter starts at 1, array-encoded i/d/rk fields', async () => {
    const { sender } = refR.pairFromSharedChain(CK);
    const wire = await refR.ratchetEncrypt(sender, 'v4 shape check');
    const p = JSON.parse(wire);
    expect(p.v).toBe(4);
    expect(p.c).toBe(1);
    expect(Array.isArray(p.i)).toBe(true);
    expect(Array.isArray(p.d)).toBe(true);
    expect(Array.isArray(p.rk)).toBe(true);
  });
});
