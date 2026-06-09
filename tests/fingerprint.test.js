// Numeric safety-number (key fingerprint) tests.
// Uses low iterations for fast logic tests; the 5200 default is asserted separately.
import { describe, it, expect } from 'vitest';
import { createFingerprint } from '../src/crypto/fingerprint.js';

const subtle = globalThis.crypto.subtle;
// Two distinct 32-byte "identity keys" as base64.
const KEY_A = Buffer.from(Uint8Array.from({ length: 32 }, (_, i) => i)).toString('base64');
const KEY_B = Buffer.from(Uint8Array.from({ length: 32 }, (_, i) => 255 - i)).toString('base64');

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
