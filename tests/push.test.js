import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  encryptPushPayload,
  buildVapidJwt,
  b64urlToBytes,
  bytesToB64url,
  concatBytes,
} from '../_worker.js';

const subtle = globalThis.crypto.subtle;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

// Generate a fake browser push subscription key pair + auth secret
async function makeBrowserSub(endpoint = 'https://fcm.googleapis.com/fcm/send/test') {
  const kp   = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub  = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  const auth = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return {
    sub: { endpoint, keys: { p256dh: bytesToB64url(pub), auth: bytesToB64url(auth) } },
    kp, pub, auth,
  };
}

// RFC 5869 HKDF + RFC 8188 §2.2, implemented from raw HMAC so the tests are pinned to the
// SPEC rather than to the implementation:
//   PRK = HMAC-SHA-256(salt, IKM)
//   OKM = HMAC-SHA-256(PRK, info || 0x00 || 0x01)[0..L-1]
// The 0x01 is HKDF-Expand's block counter; a single block covers every length used here (<=32B).
async function rfc8188Derive(salt, ikm, infoStr, lengthBytes) {
  const hmac = async (keyBytes, data) => {
    const k = await subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await subtle.sign('HMAC', k, data));
  };
  const prk = await hmac(salt, ikm);
  const info = concatBytes(new TextEncoder().encode(infoStr), new Uint8Array([0x00, 0x01]));
  return (await hmac(prk, info)).slice(0, lengthBytes);
}

// Reverse of encryptPushPayload: decrypt a browser-side push record.
// Used only in tests to verify round-trip correctness.
async function decryptPushPayload(subtle, browserKP, clientPubRaw, authSecret, encoded) {
  // Parse RFC 8188 header
  const salt2       = encoded.slice(0, 16);
  const rs          = new DataView(encoded.buffer, encoded.byteOffset + 16, 4).getUint32(0, false);
  const idlen       = encoded[20];
  const serverPubRaw = encoded.slice(21, 21 + idlen);
  const ct           = encoded.slice(21 + idlen);

  // ECDH with server's ephemeral key
  const serverPub  = await subtle.importKey('raw', serverPubRaw, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedBits = await subtle.deriveBits({ name: 'ECDH', public: serverPub }, browserKP.privateKey, 256);

  // RFC 8291: derive IKM
  const keyinfo = concatBytes(
    new TextEncoder().encode('WebPush: info\x00'),
    clientPubRaw, serverPubRaw
  );
  const ikmKey  = await subtle.importKey('raw', new Uint8Array(sharedBits), 'HKDF', false, ['deriveBits']);
  const ikmBits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyinfo },
    ikmKey, 256
  );

  // RFC 8188 §2.2: derive CEK + nonce.
  // Computed from the RFC's own formula via RAW HMAC — deliberately NOT by calling deriveBits with
  // a hand-written info string. An earlier version of this helper mirrored the worker's info
  // strings verbatim, so it round-tripped the implementation against a copy of its own bug and
  // passed while no real browser could decrypt anything. Deriving from the spec instead means this
  // helper models a browser, and a future info-string drift fails here.
  const cekBits   = await rfc8188Derive(salt2, new Uint8Array(ikmBits), 'Content-Encoding: aes128gcm', 16);
  const nonceBits = await rfc8188Derive(salt2, new Uint8Array(ikmBits), 'Content-Encoding: nonce', 12);

  // Decrypt
  const aesKey = await subtle.importKey('raw', new Uint8Array(cekBits), 'AES-GCM', false, ['decrypt']);
  const plain  = new Uint8Array(await subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonceBits) }, aesKey, ct
  ));

  // Strip trailing delimiter (0x02 for last record)
  return new TextDecoder().decode(plain.slice(0, -1));
}

// ---------------------------------------------------------------------------
// encryptPushPayload
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RFC 8188 §2.2 CONFORMANCE GUARD.
// The shipped worker derived CEK/nonce with info='Content-Encoding: aes128gcm\x00\x01'. That
// trailing 0x01 is HKDF-Expand's block counter (RFC 5869 §2.3), which WebCrypto appends itself —
// so passing it explicitly produced ...||0x00||0x01||0x01 and a CEK/nonce that NO browser agrees
// with. Every push payload was undecryptable in production while the round-trip test passed,
// because that test hard-coded the same two wrong strings.
// These assertions compare deriveBits against the RFC's raw-HMAC definition, so the correct info
// string is pinned independently of what the implementation happens to do.
// ---------------------------------------------------------------------------
describe('RFC 8188 key derivation conformance', () => {
  const PRK_IKM = new Uint8Array(32).fill(7);
  const SALT = new Uint8Array(16).fill(9);
  const viaDeriveBits = async (info, bits) => {
    const k = await subtle.importKey('raw', PRK_IKM, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: SALT, info: new TextEncoder().encode(info) }, k, bits));
  };

  it('CEK: info must terminate at 0x00 — WebCrypto supplies the 0x01 counter', async () => {
    const spec = await rfc8188Derive(SALT, PRK_IKM, 'Content-Encoding: aes128gcm', 16);
    expect(Array.from(await viaDeriveBits('Content-Encoding: aes128gcm\x00', 128))).toEqual(Array.from(spec));
    // The shipped-then-fixed form must NOT match the spec (this is the bug, pinned).
    expect(Array.from(await viaDeriveBits('Content-Encoding: aes128gcm\x00\x01', 128))).not.toEqual(Array.from(spec));
  });

  it('nonce: same rule', async () => {
    const spec = await rfc8188Derive(SALT, PRK_IKM, 'Content-Encoding: nonce', 12);
    expect(Array.from(await viaDeriveBits('Content-Encoding: nonce\x00', 96))).toEqual(Array.from(spec));
    expect(Array.from(await viaDeriveBits('Content-Encoding: nonce\x00\x01', 96))).not.toEqual(Array.from(spec));
  });

  it('the deployed worker uses the RFC-conformant info strings', async () => {
    const src = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
    expect(src).toContain("'Content-Encoding: aes128gcm\\x00'");
    expect(src).toContain("'Content-Encoding: nonce\\x00'");
    expect(src).not.toContain("'Content-Encoding: aes128gcm\\x00\\x01'");
    expect(src).not.toContain("'Content-Encoding: nonce\\x00\\x01'");
  });
});

describe('encryptPushPayload', () => {
  it('returns null when subscription has no keys', async () => {
    const result = await encryptPushPayload(subtle, { endpoint: 'https://x.com/p' }, 'hello');
    expect(result).toBeNull();
  });

  it('returns null when keys.p256dh is missing', async () => {
    const auth   = bytesToB64url(globalThis.crypto.getRandomValues(new Uint8Array(16)));
    const result = await encryptPushPayload(
      subtle, { endpoint: 'https://x.com', keys: { auth } }, 'hi'
    );
    expect(result).toBeNull();
  });

  it('returns a Uint8Array with the correct RFC 8188 header structure', async () => {
    const { sub } = await makeBrowserSub();
    const result  = await encryptPushPayload(subtle, sub, 'hello');

    expect(result).toBeInstanceOf(Uint8Array);
    // Minimum length: 16 salt + 4 rs + 1 idlen + 65 server_pub + GCM data
    expect(result.length).toBeGreaterThan(86);
    // idlen byte (position 20) must be 65 (uncompressed P-256 key)
    expect(result[20]).toBe(65);
    // Server public key starts with 0x04 (uncompressed point marker)
    expect(result[21]).toBe(0x04);
  });

  it('rs field in header equals plaintext.length + 17', async () => {
    const { sub } = await makeBrowserSub();
    const msg     = 'test-payload';
    const result  = await encryptPushPayload(subtle, sub, msg);
    const rs      = new DataView(result.buffer).getUint32(16, false);
    expect(rs).toBe(new TextEncoder().encode(msg).length + 17);
  });

  it('encrypts a JSON object by stringifying it', async () => {
    const { sub, kp, pub, auth } = await makeBrowserSub();
    const payload = { type: 'message', body: 'Hello World' };
    const encoded = await encryptPushPayload(subtle, sub, payload);
    const decoded = await decryptPushPayload(subtle, kp, pub, auth, encoded);
    expect(decoded).toBe(JSON.stringify(payload));
  });

  it('round-trip: decrypt recovers the original plaintext', async () => {
    const { sub, kp, pub, auth } = await makeBrowserSub();
    const plaintext = 'New message from Alice';
    const encoded   = await encryptPushPayload(subtle, sub, plaintext);
    const decoded   = await decryptPushPayload(subtle, kp, pub, auth, encoded);
    expect(decoded).toBe(plaintext);
  });

  it('produces different output on each call (random salt + ephemeral key)', async () => {
    const { sub } = await makeBrowserSub();
    const a = await encryptPushPayload(subtle, sub, 'same');
    const b = await encryptPushPayload(subtle, sub, 'same');
    // Salt (first 16 bytes) should differ
    expect(bytesToB64url(a.slice(0, 16))).not.toBe(bytesToB64url(b.slice(0, 16)));
  });
});

// ---------------------------------------------------------------------------
// buildVapidJwt
// ---------------------------------------------------------------------------

describe('buildVapidJwt', () => {
  // Generate a real P-256 VAPID key pair for tests
  async function makeVapidKeys() {
    const kp  = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const pub = new Uint8Array(
      await subtle.exportKey('raw', kp.publicKey)
    );
    const jwk = await subtle.exportKey('jwk', kp.privateKey);
    const priv = b64urlToBytes(jwk.d);
    return { kp, pub, priv, pubB64url: bytesToB64url(pub), privB64url: bytesToB64url(priv) };
  }

  it('returns a three-part JWT string', async () => {
    const { pubB64url, privB64url } = await makeVapidKeys();
    const jwt = await buildVapidJwt(
      subtle, privB64url, pubB64url, 'https://fcm.googleapis.com/fcm/send/test'
    );
    expect(typeof jwt).toBe('string');
    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
  });

  it('JWT header decodes to { typ:"JWT", alg:"ES256" }', async () => {
    const { pubB64url, privB64url } = await makeVapidKeys();
    const jwt  = await buildVapidJwt(
      subtle, privB64url, pubB64url, 'https://fcm.googleapis.com/fcm/send/test'
    );
    const hdr  = JSON.parse(new TextDecoder().decode(b64urlToBytes(jwt.split('.')[0])));
    expect(hdr).toEqual({ typ: 'JWT', alg: 'ES256' });
  });

  it('JWT claims include correct aud (origin), exp, sub', async () => {
    const { pubB64url, privB64url } = await makeVapidKeys();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/test';
    const before   = Math.floor(Date.now() / 1000);
    const jwt      = await buildVapidJwt(subtle, privB64url, pubB64url, endpoint);
    const after    = Math.floor(Date.now() / 1000);
    const claims   = JSON.parse(new TextDecoder().decode(b64urlToBytes(jwt.split('.')[1])));

    expect(claims.aud).toBe('https://fcm.googleapis.com');
    expect(claims.sub).toContain('mailto:');
    expect(claims.exp).toBeGreaterThan(before + 43199);
    expect(claims.exp).toBeLessThanOrEqual(after + 43200);
  });

  it('JWT signature verifies with the VAPID public key', async () => {
    const { pub, pubB64url, privB64url } = await makeVapidKeys();
    const jwt   = await buildVapidJwt(
      subtle, privB64url, pubB64url, 'https://updates.push.services.mozilla.com/push/test'
    );
    const parts = jwt.split('.');
    const msg   = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig   = b64urlToBytes(parts[2]);

    // Re-import public key with verify usage (generateKey with ['sign'] may not set it)
    const verifyKey = await subtle.importKey(
      'raw', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );
    const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, sig, msg);
    expect(valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// utility helpers
// ---------------------------------------------------------------------------

describe('b64urlToBytes / bytesToB64url', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes  = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const b64url = bytesToB64url(bytes);
    // No padding, no +/
    expect(b64url).not.toMatch(/[+/=]/);
    expect(bytesToB64url(b64urlToBytes(b64url))).toBe(b64url);
  });

  it('correctly handles standard base64url reserved characters', () => {
    // A buffer that produces + and / in base64 → should become - and _
    const bytes  = new Uint8Array([0xfb, 0xff, 0xfe]);
    const b64    = btoa(String.fromCharCode(...bytes));         // "+//+"? depends on bytes
    const b64url = bytesToB64url(bytes);
    expect(b64url).not.toMatch(/[+/=]/);
    // Round-trip
    const decoded = b64urlToBytes(b64url);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });
});

describe('concatBytes', () => {
  it('concatenates multiple Uint8Arrays', () => {
    const result = concatBytes(
      new Uint8Array([1, 2]),
      new Uint8Array([3, 4, 5]),
      new Uint8Array([6])
    );
    expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns empty array for no args', () => {
    expect(concatBytes().length).toBe(0);
  });
});
