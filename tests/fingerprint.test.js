// Numeric safety-number (key fingerprint) tests.
// Uses low iterations for fast logic tests; the 5200 default is asserted separately.
import { describe, it, expect } from 'vitest';
import { createFingerprint } from '../src/crypto/fingerprint.js';

const subtle = globalThis.crypto.subtle;
// Two distinct 32-byte "identity keys" as base64.
const KEY_A = Buffer.from(Uint8Array.from({ length: 32 }, (_, i) => i)).toString('base64');
const KEY_B = Buffer.from(Uint8Array.from({ length: 32 }, (_, i) => 255 - i)).toString('base64');

// ---------------------------------------------------------------------------
// AUTHORITATIVE CONFORMANCE VECTORS — libsignal's own NumericFingerprintGeneratorTest.
// These are the strongest correctness evidence this module can have: if our iterated
// hash, the 2-byte big-endian version prefix, the stable-identifier binding, the 30-byte
// truncation, the 5-byte->5-digit chunking, or the sorted concatenation drifts by a single
// byte, these digits change and the test fails.
//
// They also pin a fix: an earlier revision seeded the loop with SHA-512(version||key||id)
// instead of the BARE concatenation libsignal uses. That cost one extra round and made the
// output diverge from Signal's, so these vectors could not have passed.
// ---------------------------------------------------------------------------
describe('libsignal conformance vectors (NumericFingerprintGeneratorTest)', () => {
  // 33-byte serialized identity keys (0x05 DJB type prefix + 32-byte public key).
  const ALICE_IDENTITY = new Uint8Array([
    0x05, 0x06, 0x86, 0x3b, 0xc6, 0x6d, 0x02, 0xb4, 0x0d, 0x27, 0xb8, 0xd4, 0x9c, 0xa7, 0xc0, 0x9e, 0x92,
    0x39, 0x23, 0x6f, 0x9d, 0x7d, 0x25, 0xd6, 0xfc, 0xca, 0x5c, 0xe1, 0x3c, 0x70, 0x64, 0xd8, 0x68,
  ]);
  const BOB_IDENTITY = new Uint8Array([
    0x05, 0xf7, 0x81, 0xb6, 0xfb, 0x32, 0xfe, 0xd9, 0xba, 0x1c, 0xf2, 0xde, 0x97, 0x8d, 0x4d, 0x5d, 0xa2,
    0x8d, 0xc3, 0x40, 0x46, 0xae, 0x81, 0x44, 0x02, 0xb5, 0xc0, 0xdb, 0xd9, 0x6f, 0xda, 0x90, 0x7b,
  ]);
  const ALICE_ID = '+14152222222';
  const BOB_ID = '+14153333333';
  const DISPLAYABLE_FINGERPRINT = '300354477692869396892869876765458257569162576843440918079131';

  const F = () => createFingerprint({ subtle, iterations: 5200, version: 0 });

  it('reproduces libsignal DISPLAYABLE_FINGERPRINT exactly (60 digits)', async () => {
    const sn = await F().safetyNumber(ALICE_IDENTITY, BOB_IDENTITY, { localId: ALICE_ID, remoteId: BOB_ID });
    expect(sn.replace(/ /g, '')).toBe(DISPLAYABLE_FINGERPRINT);
  });

  it('is symmetric — Bob computes the identical number from his own perspective', async () => {
    const fromBob = await F().safetyNumber(BOB_IDENTITY, ALICE_IDENTITY, { localId: BOB_ID, remoteId: ALICE_ID });
    expect(fromBob.replace(/ /g, '')).toBe(DISPLAYABLE_FINGERPRINT);
  });

  it('binds the stable identifier — a different phone number changes the number', async () => {
    const other = await F().safetyNumber(ALICE_IDENTITY, BOB_IDENTITY, { localId: ALICE_ID, remoteId: '+14153333334' });
    expect(other.replace(/ /g, '')).not.toBe(DISPLAYABLE_FINGERPRINT);
  });

  it('binds the identity key — flipping one key bit changes the number (MITM detection)', async () => {
    const tampered = new Uint8Array(BOB_IDENTITY);
    tampered[1] ^= 0x01;
    const other = await F().safetyNumber(ALICE_IDENTITY, tampered, { localId: ALICE_ID, remoteId: BOB_ID });
    expect(other.replace(/ /g, '')).not.toBe(DISPLAYABLE_FINGERPRINT);
  });

  it('seeds the iteration from the BARE concatenation, not a pre-hash of it', async () => {
    // Independent re-implementation of libsignal's loop; must agree byte for byte.
    const enc = new TextEncoder();
    const version = new Uint8Array([0, 0]);
    const cat = (...a) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let k = 0; for (const x of a) { o.set(x, k); k += x.length; } return o; };
    const ref = async (key, id) => {
      let hash = cat(version, key, enc.encode(id));
      for (let i = 0; i < 5200; i++) hash = new Uint8Array(await subtle.digest('SHA-512', cat(hash, key)));
      return hash.slice(0, 30);
    };
    const digits = (b) => { let s = ''; for (let i = 0; i < 6; i++) { const o = i * 5; s += String((b[o] * 2 ** 32 + b[o + 1] * 2 ** 24 + b[o + 2] * 2 ** 16 + b[o + 3] * 2 ** 8 + b[o + 4]) % 100000).padStart(5, '0'); } return s; };
    const a = digits(await ref(ALICE_IDENTITY, ALICE_ID));
    const b = digits(await ref(BOB_IDENTITY, BOB_ID));
    expect((a < b ? a + b : b + a)).toBe(DISPLAYABLE_FINGERPRINT);
  });
});

describe('createFingerprint', () => {
  it('falls back to globalThis.crypto.subtle when none is injected', () => {
    const f = createFingerprint();
    expect(typeof f.safetyNumber).toBe('function');
  });

  it('exposes the Signal default of 5200 iterations and version 0', () => {
    const f = createFingerprint({ subtle });
    expect(f.iterations).toBe(5200);
    expect(f.version).toBe(0);
  });
});

describe('safety number format', () => {
  const f = createFingerprint({ subtle, iterations: 8 });

  it('produces 60 digits in 12 space-separated 5-digit groups', async () => {
    const sn = await f.safetyNumber(KEY_A, KEY_B);
    const groups = sn.split(' ');
    expect(groups).toHaveLength(12);
    for (const g of groups) expect(g).toMatch(/^\d{5}$/);
    expect(sn.replace(/ /g, '')).toHaveLength(60);
  });

  it('a single-party fingerprint is 30 digits', async () => {
    const fp = await f.fingerprintFor(KEY_A);
    expect(fp).toMatch(/^\d{30}$/);
  });
});

describe('safety number security properties', () => {
  const f = createFingerprint({ subtle, iterations: 8 });

  it('is symmetric: swapping local/remote yields the same number', async () => {
    const ab = await f.safetyNumber(KEY_A, KEY_B);
    const ba = await f.safetyNumber(KEY_B, KEY_A);
    expect(ab).toBe(ba);
  });

  it('is deterministic for the same inputs', async () => {
    const x = await f.safetyNumber(KEY_A, KEY_B);
    const y = await f.safetyNumber(KEY_A, KEY_B);
    expect(x).toBe(y);
  });

  it('changes when an identity key changes (MITM substitution is visible)', async () => {
    const KEY_C = Buffer.from(Uint8Array.from({ length: 32 }, (_, i) => (i * 7) & 0xff)).toString('base64');
    const original = await f.safetyNumber(KEY_A, KEY_B);
    const mitm = await f.safetyNumber(KEY_A, KEY_C); // relay swapped B's key
    expect(mitm).not.toBe(original);
  });

  it('binds the stable identifier: same keys, different IDs → different number', async () => {
    const noId = await f.safetyNumber(KEY_A, KEY_B);
    const withId = await f.safetyNumber(KEY_A, KEY_B, { localId: 'alice', remoteId: 'bob' });
    expect(withId).not.toBe(noId);
  });

  it('iteration count is bound into the output (5200 ≠ 8 rounds)', async () => {
    const few = createFingerprint({ subtle, iterations: 8 });
    const more = createFingerprint({ subtle, iterations: 16 });
    expect(await few.safetyNumber(KEY_A, KEY_B)).not.toBe(await more.safetyNumber(KEY_A, KEY_B));
  });

  it('accepts raw Uint8Array keys equivalently to base64', async () => {
    const bytesA = Uint8Array.from(atob(KEY_A), (c) => c.charCodeAt(0));
    const bytesB = Uint8Array.from(atob(KEY_B), (c) => c.charCodeAt(0));
    const fromBytes = await f.safetyNumber(bytesA, bytesB);
    const fromB64 = await f.safetyNumber(KEY_A, KEY_B);
    expect(fromBytes).toBe(fromB64);
  });
});

describe('input validation', () => {
  const f = createFingerprint({ subtle, iterations: 8 });

  it('throws (rejected promise) for a key that is neither Uint8Array nor base64 string', async () => {
    await expect(f.fingerprintFor(12345)).rejects.toThrow();
    await expect(f.safetyNumber(KEY_A, null)).rejects.toThrow();
  });

  it('version > 255 wraps the stored byte but still produces consistent output', async () => {
    const fHigh = createFingerprint({ subtle, iterations: 8, version: 256 });
    const code = await fHigh.scannable(KEY_A, KEY_B);
    // version byte should be 256 & 0xff = 0 — same as default version 0 stored byte
    const bytes = Uint8Array.from(atob(code), (c) => c.charCodeAt(0));
    expect(bytes[0]).toBe(0);
    // But fingerprint hash differs (versionBytes = [0x01, 0x00] vs [0x00, 0x00])
    const f0 = createFingerprint({ subtle, iterations: 8, version: 0 });
    expect(code).not.toBe(await f0.scannable(KEY_A, KEY_B));
    // verifyScannable with fHigh must match: same version byte (0), same hash
    const bobCode = await fHigh.scannable(KEY_B, KEY_A);
    expect((await fHigh.verifyScannable(bobCode, KEY_A, KEY_B)).match).toBe(true);
  });
});

describe('full-strength run (5200 iterations) completes and is well-formed', () => {
  it('produces a valid 60-digit number at the production iteration count', async () => {
    const f = createFingerprint({ subtle }); // default 5200
    const sn = await f.safetyNumber(KEY_A, KEY_B);
    expect(sn.replace(/ /g, '')).toMatch(/^\d{60}$/);
  }, 30000); // 5200×2 sequential SHA-512 awaits — generous timeout for cold CI
});

describe('scannable (QR) safety number', () => {
  const f = createFingerprint({ subtle, iterations: 8 });

  it('encodes version(1) + two 30-byte fingerprints = 61 bytes base64', async () => {
    const code = await f.scannable(KEY_A, KEY_B);
    const bytes = Uint8Array.from(atob(code), (c) => c.charCodeAt(0));
    expect(bytes).toHaveLength(61);
    expect(bytes[0]).toBe(0); // version
  });

  it('cross-matches between the two parties (genuine, no MITM)', async () => {
    // Alice's perspective: local = A, remote = B.
    const aliceCode = await f.scannable(KEY_A, KEY_B);
    // Bob's perspective: local = B, remote = A.
    const bobCode = await f.scannable(KEY_B, KEY_A);
    // Alice scans Bob's code and verifies against her own (local=A, remote=B).
    expect((await f.verifyScannable(bobCode, KEY_A, KEY_B)).match).toBe(true);
    // Bob scans Alice's code and verifies against his own (local=B, remote=A).
    expect((await f.verifyScannable(aliceCode, KEY_B, KEY_A)).match).toBe(true);
  });

  it('rejects a code where the peer key was substituted (MITM)', async () => {
    const KEY_M = Buffer.from(Uint8Array.from({ length: 32 }, (_, i) => (i * 13) & 0xff)).toString('base64');
    // Bob's real code is (local=B, remote=A). A MITM relay shows Alice a code
    // built from the attacker's key instead of Bob's.
    const mitmCode = await f.scannable(KEY_M, KEY_A); // attacker poses as "Bob"
    const res = await f.verifyScannable(mitmCode, KEY_A, KEY_B); // Alice expects real B
    expect(res.match).toBe(false);
    expect(res.code).toBe('NO_MATCH');
  });

  it('rejects a malformed base64 / wrong-length code', async () => {
    expect((await f.verifyScannable('!!!notb64', KEY_A, KEY_B)).code).toBe('MALFORMED');
    expect((await f.verifyScannable(btoa('short'), KEY_A, KEY_B)).code).toBe('MALFORMED');
  });

  it('rejects a version mismatch', async () => {
    const v1 = createFingerprint({ subtle, iterations: 8, version: 1 });
    const code = await v1.scannable(KEY_A, KEY_B); // version byte = 1
    const res = await f.verifyScannable(code, KEY_B, KEY_A); // f is version 0
    expect(res.code).toBe('VERSION_MISMATCH');
  });

  it('binds stable identifiers in the scannable path too', async () => {
    const bobCode = await f.scannable(KEY_B, KEY_A, { localId: 'bob', remoteId: 'alice' });
    // Alice verifies with matching ids → match
    const ok = await f.verifyScannable(bobCode, KEY_A, KEY_B, { localId: 'alice', remoteId: 'bob' });
    expect(ok.match).toBe(true);
    // Alice verifies with wrong ids → no match
    const bad = await f.verifyScannable(bobCode, KEY_A, KEY_B, { localId: 'alice', remoteId: 'eve' });
    expect(bad.match).toBe(false);
  });
});
