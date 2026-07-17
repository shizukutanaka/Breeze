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
import { checkRollover, auditBundle, appendChainEntry } from '../src/crypto/ktlog.js';
import { negotiateGroup } from '../src/crypto/negotiate.js';

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
  // Two-solver tests run the inline and reference in parallel (Promise.all) to halve
  // wall-clock time: both scan from nonce=0 independently, so parallel is always safe.
  const SOLVE_TIMEOUT = 60000;

  it('finds the IDENTICAL minimal nonce as the reference solver (byte-order + hash-input parity)', async () => {
    // Both scan nonce upward from 0, so for a fixed challenge+difficulty the first
    // satisfying nonce MUST match — unless the hash input string, the text encoding,
    // or the big-endian getUint32 byte order has drifted between the two.
    const challenge = makeChallengeString('PUBKEY_aaaa', 'alias-bob');
    const [inlineTok, refTok] = await Promise.all([
      inlineGeneratePoW(challenge, 16),
      powSolve(subtle, challenge, 16),
    ]);
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

// ---------------------------------------------------------------------------
// Group sender-key mirror — the multicast guard.
//
// Inline encryptGroupMsg/decryptGroupMsg/getGroupSenderKey (index.html) and the
// reference groupSenderEncrypt/groupSenderDecrypt/groupDecryptV3 (ratchet.js)
// must agree on the hash-ratchet KDF ('breeze-group-msg-v5' / 'breeze-group-chain-v5'),
// the v3 legacy KDF ('group-msg' with the counter as a Uint32 salt), the wire
// shape ({ v, g, i, d, c, ep }), and the [len:2][data] padding. A drift here is
// even worse than 1:1: ONE divergent member silently fails to decrypt EVERY group
// message while the rest of the group is fine — looks like a flaky peer, not a bug.
//
// The inline functions are IDB-coupled, so the guard injects an in-memory
// dbGet/dbPut and the already-extracted inline hkdf, then cross-tests both ways
// for v5, plus the v3 legacy path. Pre-seeding the keystore makes getGroupSenderKey
// return the shared chain key instead of generating a random one.
// ---------------------------------------------------------------------------
const GROUP_START = '  async function getGroupSenderKey(groupId) {';
const GROUP_END = '\n  // Distribute sender key to a specific group member';
const gs = html.indexOf(GROUP_START);
const ge = html.indexOf(GROUP_END, gs);
if (gs < 0 || ge < 0) {
  throw new Error(
    'mirror-drift guard: could not locate inline group sender-key functions in index.html ' +
    '(markers "async function getGroupSenderKey" .. "// Distribute sender key to a specific member"). ' +
    'If the group block moved, update tests/mirror-drift.test.js.',
  );
}

// In-memory IDB stub: the inline functions only touch the 'identity' store via
// dbGet/dbPut, so a Map keyed by `key` faithfully stands in for IndexedDB here.
function makeGroupInline(config) {
  const store = new Map();
  const dbGet = async (_s, key) => (store.has(key) ? store.get(key) : null);
  const dbPut = async (_s, val, key) => { store.set(key, val); };
  // getGroupSenderKey calls _computeGroupV5 as a free variable — inject the already-bound
  // version from an X3DH-inline instance sharing the same config, rather than duplicating
  // the negotiation code's extraction here (both live in the same source window anyway).
  const { _computeGroupV5 } = makeX3dhInline(null, config, 'me');
  const factory = new Function(
    'crypto', 'CONFIG', 'dbGet', 'dbPut', 'hkdf', 'arr', 'u8', '_dbg', 'TextEncoder', 'TextDecoder', '_computeGroupV5',
    html.slice(gs, ge) +
      '\nreturn { getGroupSenderKey, encryptGroupMsg, decryptGroupMsg };',
  );
  const api = factory(
    globalThis.crypto, config, dbGet, dbPut, inlineKdf.hkdf,
    (a) => Array.from(a), (a) => new Uint8Array(a), () => {}, TextEncoder, TextDecoder, _computeGroupV5,
  );
  return { ...api, store };
}

describe('Group sender-key mirror — inline (index.html) vs reference (src/crypto/ratchet.js)', () => {
  const CK = Array.from(new Uint8Array(32).fill(0x55)); // shared v5 chain key
  const RAW = Array.from(new Uint8Array(32).fill(0x77)); // shared v3 raw key
  const freshV5 = () => ({ chainKey: [...CK], counter: 0, epoch: 0, v: 5, skipped: {} });

  it('WIRE PARITY (v5): reference groupSenderEncrypt → inline decryptGroupMsg recovers plaintext', async () => {
    const text = 'group hash-ratchet wire-compat';
    const { ciphertext } = await refR.groupSenderEncrypt(freshV5(), text);

    const inline = makeGroupInline({ GROUP_RATCHET_V5: true, GROUP_MAX_SKIP: 50, MSG_PAD_BOUNDARY: 256, IV_BYTES: 12 });
    inline.store.set('gsk-peer:G:S', freshV5());
    expect(await inline.decryptGroupMsg('G', 'S', ciphertext)).toBe(text);
  });

  it('WIRE PARITY (v5): inline encryptGroupMsg → reference groupSenderDecrypt recovers plaintext', async () => {
    const text = 'inline group → reference decrypt';
    const inline = makeGroupInline({ GROUP_RATCHET_V5: true, GROUP_MAX_SKIP: 50, MSG_PAD_BOUNDARY: 256, IV_BYTES: 12 });
    inline.store.set('gsk:G', freshV5());
    const ciphertext = await inline.encryptGroupMsg('G', text);

    const res = await refR.groupSenderDecrypt(freshV5(), ciphertext);
    expect(res?.plaintext).toBe(text);
  });

  it('v5 wire shape: { v:5, g:true, ep:0, array i/d, c:0 for first message }', async () => {
    const inline = makeGroupInline({ GROUP_RATCHET_V5: true, GROUP_MAX_SKIP: 50, MSG_PAD_BOUNDARY: 256, IV_BYTES: 12 });
    inline.store.set('gsk:G', freshV5());
    const p = JSON.parse(await inline.encryptGroupMsg('G', 'shape'));
    expect(p.v).toBe(5);
    expect(p.g).toBe(true);
    expect(p.ep).toBe(0);
    expect(p.c).toBe(0); // counter is post-incremented then sent as counter-1
    expect(Array.isArray(p.i)).toBe(true);
    expect(Array.isArray(p.d)).toBe(true);
  });

  it('FORWARD SECRECY parity: second inline message ratchets the chain (c increments, both decrypt)', async () => {
    const inline = makeGroupInline({ GROUP_RATCHET_V5: true, GROUP_MAX_SKIP: 50, MSG_PAD_BOUNDARY: 256, IV_BYTES: 12 });
    inline.store.set('gsk:G', freshV5());
    const c1 = await inline.encryptGroupMsg('G', 'first');
    const c2 = await inline.encryptGroupMsg('G', 'second');
    expect(JSON.parse(c1).c).toBe(0);
    expect(JSON.parse(c2).c).toBe(1);
    // Reference receiver ratchets forward in order and decrypts both
    let peer = freshV5();
    const r1 = await refR.groupSenderDecrypt(peer, c1);
    expect(r1?.plaintext).toBe('first');
    const r2 = await refR.groupSenderDecrypt(r1.nextPeerSk, c2);
    expect(r2?.plaintext).toBe('second');
  });

  it('WIRE PARITY (v3 legacy): inline v3 encrypt → reference groupDecryptV3 recovers plaintext', async () => {
    const text = 'legacy static-key group message';
    const inline = makeGroupInline({ GROUP_RATCHET_V5: false, GROUP_MAX_SKIP: 50, MSG_PAD_BOUNDARY: 256, IV_BYTES: 12 });
    inline.store.set('gsk:G', { raw: [...RAW], counter: 0, epoch: 0 });
    const ciphertext = await inline.encryptGroupMsg('G', text);
    expect(JSON.parse(ciphertext).v).toBe(3);
    expect(await refR.groupDecryptV3({ raw: [...RAW] }, ciphertext)).toBe(text);
  });

  it('EPOCH binding parity: a message from a different epoch is rejected by inline decrypt', async () => {
    const { ciphertext } = await refR.groupSenderEncrypt({ ...freshV5(), epoch: 1 }, 'epoch-1 msg');
    const inline = makeGroupInline({ GROUP_RATCHET_V5: true, GROUP_MAX_SKIP: 50, MSG_PAD_BOUNDARY: 256, IV_BYTES: 12 });
    inline.store.set('gsk-peer:G:S', freshV5()); // peer still on epoch 0
    expect(await inline.decryptGroupMsg('G', 'S', ciphertext)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// X3DH v5 mirror — the authenticated-first-contact guard.
//
// Inline _x3dhInitiator/_x3dhResponder (index.html, gated behind CONFIG.X3DH_V5_ENABLED)
// must agree with reference x3dhInitiator/x3dhResponder (ratchet.js) on the DH
// combination order (IK×SPK, EK×IK, EK×SPK, [EK×OPK]) and the HKDF info string
// ('breeze-x3dh-v5'). A drift here means an initiator on one code path and a
// responder on the other derive different root keys — first contact silently
// never completes, indistinguishable from a network problem.
//
// Deliberate, DOCUMENTED non-mirror: the inline SPK signing convention signs the
// base64 STRING via the existing signMessage/verifySignature (to match what the
// already-deployed Worker's verifyEd25519 enforces at upload time), while
// ratchet.js's signSPK/verifySPK sign the RAW bytes. This is intentional — see the
// comment above the inline X3DH block in index.html — so it is NOT cross-tested
// against refR.signSPK/verifySPK below; only the DH/HKDF math is.
// ---------------------------------------------------------------------------
const X3DH_START = '  async function genRatchetKey() {';
const X3DH_END = '\n  // --- Init session (first contact) ---';
const x3s = html.indexOf(X3DH_START);
const x3e = html.indexOf(X3DH_END, x3s);
if (x3s < 0 || x3e < 0) {
  throw new Error(
    'mirror-drift guard: could not locate the inline X3DH block in index.html ' +
    '(markers "async function genRatchetKey() {" .. "// --- Init session (first contact) ---"). ' +
    'If the block moved, update tests/mirror-drift.test.js.',
  );
}

function makeX3dhInline(myKeys, config, myId) {
  const idb = new Map();
  const dbGet = async (_s, key) => (idb.has(key) ? idb.get(key) : null);
  const dbPut = async (_s, val, key) => { idb.set(key, val); };
  const factory = new Function(
    'crypto', 'CONFIG', '_hasX25519', 'dbGet', 'dbPut', '_dbg', 'hkdf', 'arr', 'u8', 'myKeys', 'myId',
    html.slice(x3s, x3e) +
      '\nreturn { genRatchetKey, ecdhBits, _x3dhInitiator, _x3dhResponder, _parsePeerCaps, _peerSupportsX3dhV5, _negotiateGroupCaps, _computeGroupV5, _importEcdhPriv, _loadSpkPriv, _resolveOtpPriv, _bootstrapResponderSessionV5 };',
  );
  const api = factory(
    globalThis.crypto, config || {}, false /* P-256, matches refR below for determinism */,
    dbGet, dbPut, () => {}, inlineKdf.hkdf, (a) => Array.from(a), (a) => new Uint8Array(a),
    myKeys || {}, myId || 'me',
  );
  return { ...api, idb };
}

describe('X3DH v5 mirror — inline (index.html) vs reference (src/crypto/ratchet.js)', () => {
  it('KEY AGREEMENT PARITY: reference x3dhInitiator and inline _x3dhResponder derive the same root key (with OPK)', async () => {
    const inline = makeX3dhInline();
    const alice = { ik: await refR.genRatchetKey() };
    const bob = { ik: await refR.genRatchetKey(), spk: await refR.genRatchetKey(), opk: await refR.genRatchetKey() };
    const ek = await refR.genRatchetKey();
    const skRef = await refR.x3dhInitiator({
      ikPriv: alice.ik.privateKey, ekPriv: ek.privateKey,
      ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub, opkPubPeer: bob.opk.pub,
    });
    const skInline = await inline._x3dhResponder({
      ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey, opkPriv: bob.opk.privateKey,
      ikPubPeer: alice.ik.pub, ekPubPeer: ek.pub,
    });
    expect(Buffer.from(skInline).toString('hex')).toBe(Buffer.from(skRef).toString('hex'));
  });

  it('KEY AGREEMENT PARITY: inline _x3dhInitiator and reference x3dhResponder derive the same root key (no OPK)', async () => {
    const inline = makeX3dhInline();
    const alice = { ik: await inline.genRatchetKey() };
    const bob = { ik: await refR.genRatchetKey(), spk: await refR.genRatchetKey() };
    const ek = await inline.genRatchetKey();
    const skInline = await inline._x3dhInitiator({
      ikPriv: alice.ik.privateKey, ekPriv: ek.privateKey,
      ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub,
    });
    const skRef = await refR.x3dhResponder({
      ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey,
      ikPubPeer: alice.ik.pub, ekPubPeer: ek.pub,
    });
    expect(Buffer.from(skInline).toString('hex')).toBe(Buffer.from(skRef).toString('hex'));
  });

  it('capability negotiation: requires BOTH the local flag on and the peer advertising x3dh-v5', () => {
    const on = makeX3dhInline(null, { X3DH_V5_ENABLED: true });
    expect(on._peerSupportsX3dhV5({ identityKey: 'x', signedPreKey: 'y' })).toBe(false); // peer silent on caps
    expect(on._peerSupportsX3dhV5({ identityKey: 'x', signedPreKey: 'y', caps: ['x3dh-v5'] })).toBe(true);
    const off = makeX3dhInline(null, { X3DH_V5_ENABLED: false });
    expect(off._peerSupportsX3dhV5({ identityKey: 'x', signedPreKey: 'y', caps: ['x3dh-v5'] })).toBeFalsy(); // local flag off
  });

  it('RESPONDER BOOTSTRAP: _bootstrapResponderSessionV5 derives the same root key as reference x3dhResponder', async () => {
    const bobIk = await refR.genRatchetKey();
    // _bootstrapResponderSessionV5 closes over myKeys from index.html's outer scope;
    // the factory binds it via the myKeys parameter injected in makeX3dhInline.
    const inline = makeX3dhInline({ privateKey: bobIk.privateKey });
    // refR.genRatchetKey() doesn't export a JWK priv (only inline's does), and
    // _loadSpkPriv needs to re-import from a stored JWK — so generate the SPK via
    // the inline instance itself, whose live privateKey is still usable with refR below.
    const bobSpk = await inline.genRatchetKey();
    inline.idb.set('spk-priv', { priv: bobSpk.priv }); // dbGet/dbPut shim ignores the store name, keys on `key` alone
    const alice = { ik: await refR.genRatchetKey() };
    const ek = await refR.genRatchetKey();
    const pkm = { ik: Array.from(new Uint8Array(alice.ik.pub)), ek: Array.from(new Uint8Array(ek.pub)), opkId: null };
    const bootstrapped = await inline._bootstrapResponderSessionV5(pkm);
    const skRef = await refR.x3dhResponder({
      ikPriv: bobIk.privateKey, spkPriv: bobSpk.privateKey,
      ikPubPeer: alice.ik.pub, ekPubPeer: ek.pub,
    });
    expect(bootstrapped).not.toBeNull();
    expect(Buffer.from(bootstrapped.rootKey).toString('hex')).toBe(Buffer.from(skRef).toString('hex'));
  });
});

// ---------------------------------------------------------------------------
// Group-v5 negotiation mirror — the N-party generalization of the X3DH AND rule.
//
// Inline _negotiateGroupCaps/_computeGroupV5 (index.html, lands in the same source
// window as the X3DH block above) must agree with reference negotiateGroup()
// (negotiate.js): a group uses the v5 hash-ratchet sender key only when the LOCAL
// flag is on AND every OTHER member's record advertises 'group-v5'. A drift here
// is the group-message analog of the X3DH drift above: one legacy member silently
// can never decrypt anything the moment the group freezes into v5 format.
// ---------------------------------------------------------------------------
describe('Group-v5 negotiation mirror — inline (index.html) vs reference (src/crypto/negotiate.js)', () => {
  it('PARITY — ALL-V5: local + every member advertise group-v5', () => {
    const inline = makeX3dhInline(null, { GROUP_RATCHET_V5: true }, 'me');
    const local = ['group-v5'], members = [['group-v5'], ['group-v5']];
    expect(inline._negotiateGroupCaps(local, members).useGroupV5).toBe(true);
    expect(negotiateGroup(local, members).useGroupV5).toBe(true);
  });

  it('PARITY — ONE-LEGACY-MEMBER: a single member with no caps blocks the whole group', () => {
    const inline = makeX3dhInline(null, { GROUP_RATCHET_V5: true }, 'me');
    const local = ['group-v5'], members = [['group-v5'], []];
    expect(inline._negotiateGroupCaps(local, members).useGroupV5).toBe(false);
    expect(negotiateGroup(local, members).useGroupV5).toBe(false);
  });

  it('PARITY — EMPTY-MEMBER-LIST ("just us"): the local flag alone decides', () => {
    const inline = makeX3dhInline(null, { GROUP_RATCHET_V5: true }, 'me');
    expect(inline._negotiateGroupCaps(['group-v5'], []).useGroupV5).toBe(true);
    expect(negotiateGroup(['group-v5'], []).useGroupV5).toBe(true);
  });

  it('_computeGroupV5 fails CLOSED on a legacy member record (no caps field)', () => {
    const inline = makeX3dhInline(null, { GROUP_RATCHET_V5: true }, 'me');
    expect(inline._computeGroupV5({ members: [{ id: 'me' }, { id: 'legacy' }] })).toBe(false);
  });

  it('_computeGroupV5: local flag off is always false regardless of member caps', () => {
    const inline = makeX3dhInline(null, { GROUP_RATCHET_V5: false }, 'me');
    expect(inline._computeGroupV5({ members: [{ id: 'me' }, { id: 'p', caps: ['group-v5'] }] })).toBe(false);
  });

  it('_computeGroupV5: all members (incl. self, excluded from the check) advertising -> true', () => {
    const inline = makeX3dhInline(null, { GROUP_RATCHET_V5: true }, 'me');
    expect(inline._computeGroupV5({ members: [{ id: 'me' }, { id: 'p1', caps: ['group-v5'] }, { id: 'p2', caps: ['group-v5'] }] })).toBe(true);
  });
});

describe('getGroupSenderKey freezes format from the negotiated decision, not the raw CONFIG flag', () => {
  it('all-v5 group: fresh key comes back v5 (chainKey) and group.groupV5 is cached true', async () => {
    const inline = makeGroupInline({ GROUP_RATCHET_V5: true, GROUP_MAX_SKIP: 50, MSG_PAD_BOUNDARY: 256, IV_BYTES: 12 });
    inline.store.set('g1', { id: 'g1', members: [{ id: 'me' }, { id: 'p1', caps: ['group-v5'] }] });
    const key = await inline.getGroupSenderKey('g1');
    expect(key.v).toBe(5);
    expect(Array.isArray(key.chainKey)).toBe(true);
    expect(inline.store.get('g1').groupV5).toBe(true);
  });

  it('one legacy member: fresh key falls back to v3 (.raw) despite the local flag being on', async () => {
    const inline = makeGroupInline({ GROUP_RATCHET_V5: true, GROUP_MAX_SKIP: 50, MSG_PAD_BOUNDARY: 256, IV_BYTES: 12 });
    inline.store.set('g2', { id: 'g2', members: [{ id: 'me' }, { id: 'legacy' }] }); // no caps = legacy
    const key = await inline.getGroupSenderKey('g2');
    expect(key.v).toBeUndefined();
    expect(Array.isArray(key.raw)).toBe(true);
    expect(inline.store.get('g2').groupV5).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// REFERENCE-DRIFT tracking — the inverse of the mirror-drift guard.
//
// Mirror-drift (above) asserts "inline MUST stay equal to its reference". But
// several src/crypto modules are the opposite problem: fully written + tested
// references that were NEVER wired into the deployed index.html/_worker.js
// (each says "to be migrated … in a browser-validated pass"). Green tests +
// polished docs make the codebase LOOK more secure than the shipped artifact —
// e.g. the deployed safety number is still a single SHA-256 over 12 bytes while
// fingerprint.js implements Signal's iterated 5200×SHA-512 (un-deployed).
//
// This guard pins that "reference-only" status. Each marker below is a string
// that WILL necessarily appear in the deployed file once its module is migrated
// (an HKDF info string or an exported function name). The moment one starts
// matching, this test fails — the cue to (a) update CLAUDE.md's deployed-vs-
// reference-only list and (b) add a real mirror-drift guard above for the newly
// shipped code, so it never goes to production unguarded. See CLAUDE.md.
// ---------------------------------------------------------------------------
const worker = readFileSync(join(HERE, '..', '_worker.js'), 'utf8');
const deployed = html + '\n' + worker;

describe('reference-drift tracking — modules that are tested references, NOT yet deployed', () => {
  const REFERENCE_ONLY = [
    { module: 'fingerprint.js (Signal iterated 5200×SHA-512 safety number)', marker: 'fingerprintBytes' },
    { module: 'franking.js (abuse-report message franking)', marker: 'createFranking' },
    { module: 'franking.js verifyReport path', marker: 'verifyReport' },
    // ktlog.js's audit path (verifyChain + checkRollover) GRADUATED to deployed — the inline
    // _auditKeyHistory now ports the full auditBundle; see the "KTLog audit mirror" block above
    // for its real parity guard. Only the log-APPEND path stays reference-only: the client just
    // verifies the chain, the worker is what appends entries (appendChainEntry).
    { module: 'ktlog.js (key-transparency log-append path)', marker: 'appendChainEntry' },
    // ratchet.js authenticated X3DH (v5 prekey handshake) graduated to deployed —
    // see the "X3DH v5 mirror" describe block above and CLAUDE.md's status table.
  ];
  for (const { module, marker } of REFERENCE_ONLY) {
    it(`${module} is still reference-only (marker "${marker}" absent from deployed index.html/_worker.js)`, () => {
      expect(deployed.includes(marker)).toBe(false);
    });
  }

  // Behavioural pin on the un-migrated safety number. This deliberately locks the
  // CURRENT (weaker) inline algorithm: a single SHA-256 over the sorted pubkeys,
  // displayed as 6 space-separated 5-digit groups (~30 digits). It is NOT an
  // endorsement — it's a tripwire: migrating onto fingerprint.js (60 digits,
  // iterated SHA-512) changes this output and fails the test, forcing a deliberate,
  // documented swap rather than a silent drift in a security-display string.
  it('inline safetyNumber still uses the legacy single-SHA-256 format (6×5 digits)', () => {
    const sn = html.indexOf('async function safetyNumber(peerPubB64)');
    const body = html.slice(sn, html.indexOf('\n  }', sn));
    expect(body).toContain("digest('SHA-256'");      // single hash, not iterated SHA-512
    expect(body).not.toContain('SHA-512');
    expect(body).toContain("for (let i = 0; i < 6; i++)"); // 6 displayed groups
    expect(body).not.toContain('fingerprintBytes');  // reference fn not inlined
  });
});

// ---------------------------------------------------------------------------
// Unpad/decompress mirror + v3-legacy coverage.
//
// The deployed inline _unpadAndDecompress(padded, version) decodes BOTH the v4
// frame ([flags:1][len:2 BE][data], reference-mirrored) AND a v3 LEGACY frame
// ([len:1][data] short, or [0xff][len:2 LE][data] for >254-byte messages) that
// the reference unpadAndDecompress does NOT implement at all. So the v3 decode
// path — what renders old-format history and messages from not-yet-upgraded
// peers — is exercised by no test anywhere: a regression there silently blanks
// those messages while every green test stays green. This block mirrors the v4
// path against the reference and pins the two v3 legacy layouts behaviourally.
// ---------------------------------------------------------------------------
const UNPAD_START = '  async function _unpadAndDecompress(padded, version) {';
const UNPAD_END = '\n  // --- Safety Number';
const us = html.indexOf(UNPAD_START);
const ue = html.indexOf(UNPAD_END, us);
if (us < 0 || ue < 0) {
  throw new Error(
    'mirror-drift guard: could not locate inline _unpadAndDecompress in index.html ' +
    '(markers "async function _unpadAndDecompress" .. "// --- Safety Number"). ' +
    'If it moved, update tests/mirror-drift.test.js.',
  );
}
const inlineUnpad = new Function(
  'TextDecoder', 'DecompressionStream', '_dbg',
  html.slice(us, ue) + '\nreturn _unpadAndDecompress;',
)(TextDecoder, globalThis.DecompressionStream, () => {});

describe('Unpad mirror — inline _unpadAndDecompress (index.html) vs reference + v3 legacy', () => {
  it('v4 PARITY: inline(padded, 4) === reference unpadAndDecompress(padded) for an uncompressed frame', async () => {
    const text = 'unpad v4 parity check';
    const raw = new TextEncoder().encode(text);
    const padded = new Uint8Array(256);
    padded[0] = 0x00; // uncompressed
    new DataView(padded.buffer).setUint16(1, raw.length); // big-endian, matches both impls
    padded.set(raw, 3);
    expect(await inlineUnpad(padded, 4)).toBe(text);
    expect(await refR.unpadAndDecompress(padded)).toBe(text);
  });

  it('v3 LEGACY (short [len:1][data]): inline decodes a sub-255-byte message', async () => {
    const text = 'legacy v3 short-form message';
    const raw = new TextEncoder().encode(text);
    const padded = new Uint8Array(256);
    padded[0] = raw.length; // single-byte length prefix
    padded.set(raw, 1);
    expect(await inlineUnpad(padded, 3)).toBe(text);
  });

  it('v3 LEGACY (long [0xff][len:2 LE][data]): inline decodes a >254-byte message', async () => {
    const text = 'x'.repeat(300); // forces the 0xff extended-length path
    const raw = new TextEncoder().encode(text);
    const padded = new Uint8Array(Math.ceil((raw.length + 3) / 256) * 256);
    padded[0] = 0xff;
    // inline reads the length via new Uint16Array(slice.buffer)[0] → host (little-endian) order
    padded[1] = raw.length & 0xff;
    padded[2] = (raw.length >> 8) & 0xff;
    padded.set(raw, 3);
    expect(await inlineUnpad(padded, 3)).toBe(text);
  });

  it('v4 round-trips a frame produced by the reference frameEncrypt (full encode→decode)', async () => {
    const text = 'frameEncrypt → inline unpad';
    const msgKey = new Uint8Array(32).fill(0x09);
    const { iv, ct } = await refR.frameEncrypt(msgKey, text);
    const aesKey = await globalThis.crypto.subtle.importKey('raw', msgKey, { name: 'AES-GCM' }, false, ['decrypt']);
    const padded = new Uint8Array(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct));
    expect(await inlineUnpad(padded, 4)).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// Bare-IK session bootstrap — first-contact convergence guard.
//
// initSession() treats a fresh LOCAL ephemeral ratchet key as "our current ratchet
// key", which is correct for whoever sends first (their sendChainKey is DH(their
// ephemeral, peer's IDENTITY key)). Before initSessionResponder existed, the
// RECEIVING side of a brand-new contact also bootstrapped via initSession() — its
// own, DIFFERENT ephemeral — so dhRatchetStep DH'd the wrong keypair against the
// sender's ephemeral and NEVER decrypted the first message (or any message after
// it, since the mismatch never self-corrects). This is a correctness/availability
// bug, not a mirror-drift one — there's no reference module for the bare-IK path —
// so it's guarded here by exercising the real encryptFor/decryptFrom/initSession/
// initSessionResponder end to end for a from-scratch pair of identities.
// ---------------------------------------------------------------------------
const BOOTSTRAP_START = 'async function hkdf(ikm, salt, info, length)';
const BOOTSTRAP_END = '\n  // --- Safety Number (v3) ---';
const bs = html.indexOf(BOOTSTRAP_START);
const be = html.indexOf(BOOTSTRAP_END, bs);
if (bs < 0 || be < 0) {
  throw new Error(
    'mirror-drift guard: could not locate the inline session-bootstrap block in index.html ' +
    '(markers "async function hkdf(ikm, salt, info, length)" .. "// --- Safety Number (v3) ---"). ' +
    'If the block moved, update tests/mirror-drift.test.js.',
  );
}

function makeSessionDevice(myKeys, myPubB64) {
  const idb = new Map();
  const dbGet = async (store, key) => idb.get(store + ':' + key) ?? null;
  const dbPut = async (store, val, key) => { idb.set(store + ':' + key, val); return true; };
  const CONFIG = { PREFERRED_CURVE: 'X25519', X3DH_V5_ENABLED: false, IV_BYTES: 12, MSG_PAD_BOUNDARY: 256, REPLAY_CACHE_SIZE: 200, SESSION_RESET_THRESHOLD: 3, HKDF_HASH: 'SHA-256' };
  const factory = new Function(
    'CONFIG', '_hasX25519', 'dbGet', 'dbPut', 'zeroBuffer', 'workerCrypto', 'postAPIRaw', 'API',
    '_signingKey', '_signingPubB64', 'signMessage', 'verifySignature', 'myKeys', 'myPubB64', '_dbg', 'arr', 'u8',
    html.slice(bs, be) + '\nreturn { encryptFor, decryptFrom };',
  );
  const R = factory(
    CONFIG, true, dbGet, dbPut, () => {}, async () => null, async () => { throw new Error('not used'); }, null,
    null, '', async () => null, async () => true, myKeys, myPubB64, () => {},
    (a) => Array.from(a), (a) => new Uint8Array(a),
  );
  return R;
}

async function genSessionIdentity() {
  const kp = await globalThis.crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const pubRaw = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', kp.publicKey));
  return { keys: kp, pubB64: Buffer.from(pubRaw).toString('base64') };
}

describe('Bare-IK session bootstrap — inline encryptFor/decryptFrom convergence for brand-new contacts', () => {
  it('a brand-new contact\'s first message decrypts correctly', async () => {
    const alice = await genSessionIdentity();
    const bob = await genSessionIdentity();
    const A = makeSessionDevice(alice.keys, alice.pubB64);
    const B = makeSessionDevice(bob.keys, bob.pubB64);
    const wire = await A.encryptFor('hello bob, fresh contact', bob.pubB64);
    expect(await B.decryptFrom(wire, alice.pubB64)).toBe('hello bob, fresh contact');
  });

  it('converges regardless of which side speaks first', async () => {
    const carol = await genSessionIdentity();
    const dave = await genSessionIdentity();
    const C = makeSessionDevice(carol.keys, carol.pubB64);
    const D = makeSessionDevice(dave.keys, dave.pubB64);
    const wire = await D.encryptFor('dave speaks first', carol.pubB64);
    expect(await C.decryptFrom(wire, dave.pubB64)).toBe('dave speaks first');
  });

  it('survives several back-and-forth turns after first contact (ratchet keeps converging)', async () => {
    const alice = await genSessionIdentity();
    const bob = await genSessionIdentity();
    const A = makeSessionDevice(alice.keys, alice.pubB64);
    const B = makeSessionDevice(bob.keys, bob.pubB64);
    expect(await B.decryptFrom(await A.encryptFor('msg 1', bob.pubB64), alice.pubB64)).toBe('msg 1');
    expect(await A.decryptFrom(await B.encryptFor('reply 1', alice.pubB64), bob.pubB64)).toBe('reply 1');
    for (let i = 0; i < 3; i++) {
      expect(await B.decryptFrom(await A.encryptFor('A-' + i, bob.pubB64), alice.pubB64)).toBe('A-' + i);
      expect(await A.decryptFrom(await B.encryptFor('B-' + i, alice.pubB64), bob.pubB64)).toBe('B-' + i);
    }
  });
});

// ---------------------------------------------------------------------------
// KTLog audit mirror — full graduation of ktlog.js's auditBundle (I11).
//
// The inline _auditKeyHistory (wired into initSessionV5Initiator) now ports BOTH the
// hash-chain tamper check (verifyChain) AND rollover detection (checkRollover), matching
// the reference auditBundle. This cross-tests the inline function against auditBundle for
// parity on all four verdicts: ok / new / rolled / tampered.
// ---------------------------------------------------------------------------
const KTLOG_START = '  async function _auditKeyHistory(storedIkB64, keyHistory) {';
const KTLOG_END = '\n  async function _importEcdhPriv(jwk) {';
const kts = html.indexOf(KTLOG_START);
const kte = html.indexOf(KTLOG_END, kts);
if (kts < 0 || kte < 0) {
  throw new Error(
    'mirror-drift guard: could not locate the inline _auditKeyHistory function in index.html ' +
    '(markers "async function _auditKeyHistory(storedIkB64, keyHistory) {" .. "async function _importEcdhPriv(jwk) {"). ' +
    'If it moved, update tests/mirror-drift.test.js.',
  );
}
const inlineAuditKeyHistory = new Function('crypto', html.slice(kts, kte) + '\nreturn _auditKeyHistory;')(globalThis.crypto);

describe('KTLog audit mirror — inline _auditKeyHistory (index.html) vs reference auditBundle (src/crypto/ktlog.js)', () => {
  const subtle = globalThis.crypto.subtle;
  const sha256b64 = async (bytes) => Buffer.from(await subtle.digest('SHA-256', bytes)).toString('base64');
  // Build a valid hash-chained log the same way the worker does (appendChainEntry).
  async function chainedLog(ikStrings, baseTs = 1000) {
    const out = [];
    for (let i = 0; i < ikStrings.length; i++) {
      const h = await sha256b64(new TextEncoder().encode(ikStrings[i]));
      out.push(await appendChainEntry(subtle, out, h, baseTs + i * 1000));
    }
    return out;
  }

  it('PARITY: first contact (no stored key) -> new', async () => {
    const log = await chainedLog(['ik-v1']);
    const ref = await auditBundle(subtle, null, log);
    const inline = await inlineAuditKeyHistory(null, log);
    expect(ref.verdict).toBe('new');
    expect(inline.verdict).toBe(ref.verdict);
  });

  it('PARITY: stored key matches the latest chained entry -> ok', async () => {
    const log = await chainedLog(['ik-v1']);
    const ref = await auditBundle(subtle, 'ik-v1', log);
    const inline = await inlineAuditKeyHistory('ik-v1', log);
    expect(ref.verdict).toBe('ok');
    expect(inline.verdict).toBe(ref.verdict);
  });

  it('PARITY: rollover to a newer chained key -> rolled + storedSeenInHistory', async () => {
    const log = await chainedLog(['ik-v1', 'ik-v2']);
    const ref = await auditBundle(subtle, 'ik-v1', log);
    const inline = await inlineAuditKeyHistory('ik-v1', log);
    expect(ref.verdict).toBe('rolled');
    expect(inline.verdict).toBe('rolled');
    expect(inline.storedSeenInHistory).toBe(ref.rollover.storedSeenInHistory);
    expect(inline.storedSeenInHistory).toBe(true);
  });

  it('PARITY: rollover from a key never seen in the log -> rolled, storedSeenInHistory false', async () => {
    const log = await chainedLog(['ik-v1']);
    const ref = await auditBundle(subtle, 'some-unrelated-key', log);
    const inline = await inlineAuditKeyHistory('some-unrelated-key', log);
    expect(ref.verdict).toBe('rolled');
    expect(inline.verdict).toBe('rolled');
    expect(inline.storedSeenInHistory).toBe(false);
    expect(ref.rollover.storedSeenInHistory).toBe(false);
  });

  it('PARITY: a tampered chain link -> tampered (the key point of the full port)', async () => {
    const log = await chainedLog(['ik-v1', 'ik-v2']);
    log[1].c = await sha256b64(new TextEncoder().encode('forged-chain-value')); // relay rewrote the append-only log
    const ref = await auditBundle(subtle, 'ik-v1', log);
    const inline = await inlineAuditKeyHistory('ik-v1', log);
    expect(ref.verdict).toBe('tampered');
    expect(inline.verdict).toBe('tampered');
  });

  it('PARITY: non-empty raw log that parses to nothing -> tampered (fail closed)', async () => {
    const log = [{ ts: 'not-a-number', h: 123 }]; // all entries malformed
    const ref = await auditBundle(subtle, 'ik-v1', log);
    const inline = await inlineAuditKeyHistory('ik-v1', log);
    expect(ref.verdict).toBe('tampered');
    expect(inline.verdict).toBe('tampered');
  });

  it('PARITY: legacy pre-chain entries (no c) still audit for rollover', async () => {
    const h1 = await sha256b64(new TextEncoder().encode('ik-v1'));
    const h2 = await sha256b64(new TextEncoder().encode('ik-v2'));
    const log = [{ ts: 1000, h: h1 }, { ts: 2000, h: h2 }]; // no c fields = legacy
    const ref = await auditBundle(subtle, 'ik-v1', log);
    const inline = await inlineAuditKeyHistory('ik-v1', log);
    expect(ref.verdict).toBe('rolled');
    expect(inline.verdict).toBe('rolled');
  });
});
