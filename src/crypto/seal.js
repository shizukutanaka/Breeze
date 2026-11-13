// Sealed Sender v2 — encrypt sender metadata to the recipient's identity key.
//
// The pre-v2 "sealed" envelope carried from/fromPub/fromName (and the replyTo plaintext
// preview) in the clear inside the JSON string the relay stores — sealed only against a
// relay that chose not to parse it. v2 makes the property cryptographic:
//
//   sealed = { to, ts, payload, sv: 2, se: { ek, iv, ct } }
//
// where ct = AES-256-GCM( HKDF( ECDH(ephemeral, recipientIdentityPub), 0³²,
// 'breeze-seal-v2', 32 ), framed(senderMeta) ) with AAD = 'breeze-seal-v2:{to}:{ts}' so a
// sealed blob cannot be spliced onto a different recipient or timestamp. The relay sees
// only {to, ts, ratchet ciphertext, sealed blob}; everything identifying the sender —
// from, fromPub, fromName, sig/sigPub, acctRoot, selfSync/sfFor/sfPub/sfName, the
// replyTo preview, disappearAt — lives inside ct. The plaintext is framed and padded
// to a 256-byte bucket before encryption (see padSealMeta below): without it, ct's
// length disclosed the exact metadata JSON length to the relay (step-3 padding audit).
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

// Metadata padding frame — the message body has always been bucket-padded
// (ratchet v4 / group v5 pad plaintext to 256-byte boundaries); the sealed
// metadata was not, so se.ct's array length revealed the exact JSON byte
// length (+16 GCM tag) to the relay: display-name length and the
// presence/length of optional fields (e.g. a replyTo preview) were
// inferable. Severity Low (length only; the observer is the relay, which
// already sees recipient, timing and volume) — fixed here, in the
// plaintext, so key/AAD derivation is untouched and pre-padding blobs
// still open: legacy plaintext is raw JSON and always starts with '{'
// (0x7B), the frame starts with the marker byte instead.
//   framed = [0x01][len:2 BE][JSON bytes][0x00 …], total a multiple of 256.
const SEAL_PAD_MARKER = 0x01;
const SEAL_PAD_BOUNDARY = 256;

function padSealMeta(jsonBytes) {
  if (jsonBytes.length > 0xffff) return jsonBytes; // too long to length-prefix: seal legacy-shaped
  const total = Math.ceil((jsonBytes.length + 3) / SEAL_PAD_BOUNDARY) * SEAL_PAD_BOUNDARY;
  const framed = new Uint8Array(total);
  framed[0] = SEAL_PAD_MARKER;
  new DataView(framed.buffer).setUint16(1, jsonBytes.length);
  framed.set(jsonBytes, 3);
  return framed;
}

function unpadSealMeta(ptBytes) {
  if (ptBytes[0] !== SEAL_PAD_MARKER) return ptBytes; // legacy blob: raw JSON
  const len = new DataView(ptBytes.buffer, ptBytes.byteOffset).getUint16(1);
  if (3 + len > ptBytes.length) throw new Error('seal frame length out of range');
  return ptBytes.slice(3, 3 + len);
}

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
    k, padSealMeta(new TextEncoder().encode(JSON.stringify(meta))));
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
    return JSON.parse(new TextDecoder().decode(unpadSealMeta(new Uint8Array(pt))));
  } catch {
    return null;
  }
}
