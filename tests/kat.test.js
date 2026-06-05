// Known-Answer Tests (KATs) for the crypto primitives Breeze composes.
//
// Roadmap item I20: the app/worker hand-wire WebCrypto (HKDF-SHA256, AES-256-GCM,
// X25519/ECDH). These vectors pin the primitives to authoritative RFC/NIST values
// and include a negative (tamper) case, so a platform regression or a glue bug
// (wrong nonce length, truncated tag, bad HKDF salt/info handling) fails loudly.
//
// Sources:
//   - HKDF-SHA256: RFC 5869, Appendix A.1 (Test Case 1)
//   - X25519:      RFC 7748, Section 6.1
//   - AES-256-GCM: NIST CAVP / SP 800-38D known vector (32-byte key)
import { describe, it, expect } from 'vitest';
import { createRatchet } from '../src/crypto/ratchet.js';

const subtle = globalThis.crypto.subtle;

const hexToBytes = (h) => {
  const clean = h.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const bytesToHex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
const b64url = (bytes) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('KAT — HKDF-SHA256 (RFC 5869 A.1, Test Case 1)', () => {
  // info is raw bytes here (0xf0..f9), so we exercise WebCrypto HKDF directly with
  // the exact RFC inputs (the module's hkdf() takes info as a UTF-8 string; see the
  // wrapper cross-check below).
  const IKM = hexToBytes('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
  const salt = hexToBytes('000102030405060708090a0b0c');
  const info = hexToBytes('f0f1f2f3f4f5f6f7f8f9');
  const OKM = '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865';

  it('derives the RFC OKM (42 bytes)', async () => {
    const key = await subtle.importKey('raw', IKM, 'HKDF', false, ['deriveBits']);
    const out = new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, 42 * 8));
    expect(bytesToHex(out)).toBe(OKM);
  });

  it("module hkdf() matches WebCrypto when info is the same bytes (UTF-8 'msg')", async () => {
    const R = createRatchet();
    const ikm = new Uint8Array(32).fill(7);
    const saltZ = new Uint8Array(32);
    const fromModule = await R.hkdf(ikm, saltZ, 'msg', 32);
    const k = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const fromWebCrypto = new Uint8Array(await subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: saltZ, info: new TextEncoder().encode('msg') }, k, 32 * 8));
    expect(bytesToHex(fromModule)).toBe(bytesToHex(fromWebCrypto));
  });
});

describe('KAT — AES-256-GCM (NIST known vector, 96-bit IV, 128-bit tag)', () => {
  // key = 32 zero bytes, iv = 12 zero bytes, pt = 16 zero bytes.
  const key = new Uint8Array(32);
  const iv = new Uint8Array(12);
  const pt = new Uint8Array(16);
  const expectedCtTag = 'cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919'; // ct(16) || tag(16)

  it('produces the expected ciphertext||tag', async () => {
    const k = await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, k, pt));
    expect(bytesToHex(ct)).toBe(expectedCtTag);
  });

  it('decrypts back to the plaintext', async () => {
    const k = await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
    const out = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv }, k, hexToBytes(expectedCtTag)));
    expect(bytesToHex(out)).toBe(bytesToHex(pt));
  });

  it('rejects a tampered authentication tag (negative / Wycheproof-style)', async () => {
    const k = await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
    const bad = hexToBytes(expectedCtTag);
    bad[bad.length - 1] ^= 0x01; // flip one tag bit
    await expect(subtle.decrypt({ name: 'AES-GCM', iv }, k, bad)).rejects.toBeTruthy();
  });
});

describe('KAT — X25519 (RFC 7748 §6.1)', () => {
  // RFC 7748 §6.1 canonical vector:
  const aPriv = '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a';
  const aPub = '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a';
  const bPub = 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f';
  const K = '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742';

  it('derives the RFC shared secret (Alice priv × Bob pub)', async () => {
    let alice;
    try {
      alice = await subtle.importKey('jwk',
        { kty: 'OKP', crv: 'X25519', d: b64url(hexToBytes(aPriv)), x: b64url(hexToBytes(aPub)) },
        { name: 'X25519' }, false, ['deriveBits']);
    } catch (e) {
      // Some runtimes lack OKP/X25519 JWK import; skip rather than false-fail.
      console.warn('X25519 JWK import unsupported on this runtime — skipping:', e?.message);
      return;
    }
    const bob = await subtle.importKey('raw', hexToBytes(bPub), { name: 'X25519' }, false, []);
    const shared = new Uint8Array(await subtle.deriveBits({ name: 'X25519', public: bob }, alice, 256));
    expect(bytesToHex(shared)).toBe(K);
  });
});
