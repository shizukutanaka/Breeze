// Sealed Sender v2 — encrypt sender metadata to the recipient's identity key.
//
// The pre-v2 "sealed" envelope carried from/fromPub/fromName (and the replyTo plaintext
// preview) in the clear inside the JSON string the relay stores — sealed only against a
// relay that chose not to parse it. v2 makes the property cryptographic:
//
//   sealed = { to, ts, payload, sv: 2, se: { ek, iv, ct } }
//
// where ct = AES-256-GCM( HKDF( ECDH(ephemeral, recipientIdentityPub), 0³²,
// 'breeze-seal-v2', 32 ), JSON(senderMeta) ) with AAD = 'breeze-seal-v2:{to}:{ts}' so a
// sealed blob cannot be spliced onto a different recipient or timestamp. The relay sees
// only {to, ts, ratchet ciphertext, sealed blob}; everything identifying the sender —
// from, fromPub, fromName, sig/sigPub, acctRoot, selfSync/sfFor/sfPub/sfName, the
// replyTo preview, disappearAt — lives inside ct.
//
// This is index.html's `sealMeta`/`unsealMeta` (grep "inline mirror of src/crypto/seal.js");
// tests/mirror-drift.test.js cross-tests the two. Deliberately NOT Signal's certificate
// scheme: Breeze has no CA — recipient-key ECIES is the strongest sealing available when
// the only long-term trust anchors are the identity keys themselves.
//
// Dependency-injected (subtle passed in) like pow.js — browser WebCrypto, Node ≥20, Miniflare.

const SEAL_INFO = 'breeze-seal-v2';

const b64 = (u8) => btoa(String.fromCharCode(...new Uint8Array(u8)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function hkdf(subtle, ikm, info, length) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: new TextEncoder().encode(info) },
    key, length * 8,
  ));
}

async function ecdhBits(subtle, privKey, peerPubRaw) {
  const peerPub = await subtle.importKey('raw', peerPubRaw, { name: 'X25519' }, false, []);
  return new Uint8Array(await subtle.deriveBits({ name: 'X25519', public: peerPub }, privKey, 256));
}

const aad = (to, ts) => new TextEncoder().encode(`${SEAL_INFO}:${to}:${ts}`);

/** Seal `meta` (a JSON-able object) to the recipient's identity public key (raw bytes or b64). */
export async function sealMeta(subtle, recipientPub, meta, to, ts) {
  const recipRaw = typeof recipientPub === 'string' ? unb64(recipientPub) : recipientPub;
  const eph = await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const ephPubRaw = new Uint8Array(await subtle.exportKey('raw', eph.publicKey));
  const shared = await ecdhBits(subtle, eph.privateKey, recipRaw);
  const key = await hkdf(subtle, shared, SEAL_INFO, 32);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(to, ts) },
    k, new TextEncoder().encode(JSON.stringify(meta)));
  return { ek: b64(ephPubRaw), iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
}

/** Open a sealed block with the recipient's identity PRIVATE key. Returns the meta object or null. */
export async function unsealMeta(subtle, identityPriv, se, to, ts) {
  try {
    const shared = await ecdhBits(subtle, identityPriv, unb64(se.ek));
    const key = await hkdf(subtle, shared, SEAL_INFO, 32);
    const k = await subtle.importKey('raw', key, { name: 'AES-GCM' }, false, ['decrypt']);
    const pt = await subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(se.iv), additionalData: aad(to, ts) },
      k, new Uint8Array(se.ct),
    );
    return JSON.parse(new TextDecoder().decode(pt));
  } catch {
    return null;
  }
}
