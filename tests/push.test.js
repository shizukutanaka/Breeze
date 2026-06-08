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

  // RFC 8188: derive CEK + nonce
  const ikm2Key   = await subtle.importKey('raw', new Uint8Array(ikmBits), 'HKDF', false, ['deriveBits']);
  const cekBits   = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt2,
      info: new TextEncoder().encode('Content-Encoding: aes128gcm\x00\x01') },
    ikm2Key, 128
  );
  const nonceBits = await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt2,
      info: new TextEncoder().encode('Content-Encoding: nonce\x00\x01') },
    ikm2Key, 96
  );

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
