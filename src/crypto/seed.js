// ============================================================================
// Breeze — account seed & recovery phrase (recovery plan step 3,
// docs/IDENTITY_RECOVERY_PLAN.md §3.1)
//
// WHAT THIS IS: the recovery anchor. A 32-byte account seed, shown to the
// user ONCE as a 24-word BIP39 recovery phrase, plus a user passphrase as
// the second factor. From (phrase, passphrase) this module either
// REGENERATES a seed-derived identity byte-for-byte, or UNLOCKS a recovery
// kit carrying a legacy (random-key) identity's full key material. The
// seed is never stored by this module, never sent to a relay, and never
// proved to anyone — it derives or unlocks keys locally, and the keys do
// the proving (plan §3.1).
//
// CONSTRUCTION (standard parts only — no hand-rolled cryptography; the
// full spec is docs/CRYPTO-SPEC.md §2b):
//   phrase  = BIP39 mnemonic over the vendored canonical English wordlist
//             (src/crypto/wordlist.js): 256-bit entropy + 8-bit checksum
//             (first byte of SHA-256(entropy)) → 24 × 11-bit indices.
//   master  = PBKDF2-HMAC-SHA512(password = mnemonic (NFKD),
//             salt = "mnemonic" + passphrase (NFKD), 2048 iterations,
//             64 bytes) — the BIP39 seed derivation, whose optional
//             passphrase IS the plan's second factor.
//   keys    = HKDF-SHA256(ikm = master, salt = 0^32, info per key):
//               'breeze-seed-v1:x25519-identity' → X25519 private seed
//               'breeze-seed-v1:ed25519-signing' → Ed25519 private seed
//               'breeze-seed-v1:recovery-kit'    → kit AES-256-GCM key
//   Each 32-byte key seed enters WebCrypto as a PKCS#8 private key (the
//   fixed RFC 8410 prefix + seed); the public half is read back from the
//   imported key's JWK, so no curve arithmetic exists in this codebase —
//   key agreement and signing stay WebCrypto's, exactly as everywhere
//   else in the app. X25519 clamping happens inside the algorithm, per
//   RFC 7748; the HKDF output is used as the raw private seed verbatim.
//
// RECOVERY KIT (existing identities, whose keys are random and cannot be
// re-derived): the caller hands wrapKit the step-1 backup payload
// (identity record + contacts + keyMaterial); wrapKit encrypts it under
// the kit key above with a random IV and the AAD domain tag
// 'breeze-recovery-kit-v1'. unwrapKit returns the payload, or null on ANY
// failure — wrong phrase, wrong passphrase, tampered or malformed kit
// (AES-GCM authentication). A kit file alone is an offline guessing
// oracle for (phrase, passphrase) jointly; neither factor alone opens it,
// and the phrase alone carries 256 bits.
//
// FAIL DOCTRINE: phraseToEntropy returns null for a malformed phrase or
// a checksum mismatch (a mistyped word is caught before any key is
// derived). Derivation functions throw on missing WebCrypto curves — the
// caller (index.html) treats that as "seed flow unavailable" and aborts
// BEFORE anything is written, never falling back to random keys behind
// a phrase the user believes can restore them.
//
// LOADING: index.html loads this module at runtime (INTEGRATION.md
// §0(A)) and exposes createSeedHelper() as window.__breezeSeed; the
// classic script reads it opportunistically. Tests import it directly.
// ============================================================================
import { BIP39_ENGLISH_WORDLIST } from './wordlist.js';
import { b64, unb64, u8, arr } from './bytes.js';

export const SEED_ENTROPY_BYTES = 32;   // plan §3.1: the 32-byte account seed
export const SEED_PHRASE_WORDS = 24;     // 256-bit entropy + 8-bit checksum

const WORD_INDEX = new Map(BIP39_ENGLISH_WORDLIST.map((w, i) => [w, i]));
const te = new TextEncoder();
const subtle = () => globalThis.crypto.subtle;

// RFC 8410 PKCS#8 v1 prefixes: SEQUENCE { version, AlgorithmIdentifier
// (OID only), OCTET STRING wrapping the 32-byte CurvePrivateKey }.
const PKCS8_PREFIX = {
  X25519: [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20],
  Ed25519: [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20],
};
const KIT_AAD = te.encode('breeze-recovery-kit-v1');

function defaultRandomBytes(n) {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function randomEntropy(randomBytes = defaultRandomBytes) {
  const ent = u8(randomBytes(SEED_ENTROPY_BYTES));
  if (ent.length !== SEED_ENTROPY_BYTES) {
    throw new Error(`seed: RNG returned ${ent.length} bytes, need ${SEED_ENTROPY_BYTES}`);
  }
  return ent;
}

async function sha256(bytes) {
  return new Uint8Array(await subtle().digest('SHA-256', u8(bytes)));
}

const bitAt = (data, pos) => (data[pos >> 3] >> (7 - (pos & 7))) & 1;

// BIP39: entropy bits followed by the first (entropyBits/32) bits of
// SHA-256(entropy) — one full checksum byte at 256-bit entropy — split
// into 11-bit word indices.
export async function entropyToPhrase(entropy) {
  const ent = u8(entropy);
  if (ent.length !== SEED_ENTROPY_BYTES) {
    throw new Error(`seed: entropy is ${ent.length} bytes, expected ${SEED_ENTROPY_BYTES}`);
  }
  const data = new Uint8Array(SEED_ENTROPY_BYTES + 1);
  data.set(ent);
  data[SEED_ENTROPY_BYTES] = (await sha256(ent))[0];
  const words = [];
  for (let i = 0; i < SEED_PHRASE_WORDS; i++) {
    let v = 0;
    for (let k = 0; k < 11; k++) v = (v << 1) | bitAt(data, i * 11 + k);
    words.push(BIP39_ENGLISH_WORDLIST[v]);
  }
  return words.join(' ');
}

// Inverse of entropyToPhrase. Returns the 32-byte entropy, or null for
// anything that is not a well-formed phrase for THIS wordlist with a
// valid checksum — wrong word count, an unknown word, or a checksum
// mismatch (the mistyped-word case). Normalization follows BIP39:
// NFKD, lowercase, whitespace-split.
export async function phraseToEntropy(phrase) {
  if (typeof phrase !== 'string') return null;
  const words = phrase.normalize('NFKD').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length !== SEED_PHRASE_WORDS) return null;
  const data = new Uint8Array(SEED_ENTROPY_BYTES + 1);
  for (let i = 0; i < SEED_PHRASE_WORDS; i++) {
    const v = WORD_INDEX.get(words[i]);
    if (v === undefined) return null;
    for (let k = 0; k < 11; k++) {
      const pos = i * 11 + k;
      if ((v >> (10 - k)) & 1) data[pos >> 3] |= 1 << (7 - (pos & 7));
    }
  }
  const ent = data.slice(0, SEED_ENTROPY_BYTES);
  return (await sha256(ent))[0] === data[SEED_ENTROPY_BYTES] ? ent : null;
}

// The BIP39 seed: PBKDF2-HMAC-SHA512 over the mnemonic sentence, salt
// "mnemonic" + passphrase. The passphrase is BIP39's own optional second
// factor — an empty passphrase is valid but yields a different master
// (and therefore different keys) from any non-empty one.
export async function masterSeed(entropy, passphrase = '') {
  const mnemonic = await entropyToPhrase(entropy);
  const km = await subtle().importKey('raw', te.encode(mnemonic.normalize('NFKD')), 'PBKDF2', false, ['deriveBits']);
  const salt = te.encode('mnemonic' + String(passphrase ?? '').normalize('NFKD'));
  return new Uint8Array(await subtle().deriveBits(
    { name: 'PBKDF2', salt, iterations: 2048, hash: 'SHA-512' }, km, 512));
}

async function hkdf32(ikm, info) {
  const key = await subtle().importKey('raw', u8(ikm), 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode(info) }, key, 256));
}

// The two per-key private seeds, domain-separated by HKDF info string
// (CRYPTO-SPEC §2b): the identity and signing keys can never collide,
// and a future key type takes a new info string, never a reuse.
export async function deriveKeySeeds(entropy, passphrase = '') {
  const master = await masterSeed(entropy, passphrase);
  return {
    identitySeed: await hkdf32(master, 'breeze-seed-v1:x25519-identity'),
    signingSeed: await hkdf32(master, 'breeze-seed-v1:ed25519-signing'),
  };
}

async function importSeedKey(curve, seed, usages) {
  const pkcs8 = new Uint8Array([...PKCS8_PREFIX[curve], ...u8(seed)]);
  return subtle().importKey('pkcs8', pkcs8, { name: curve }, true, usages);
}

// Derive the full identity material for a seed-based account, in exactly
// the shapes the app already stores: the identity key pair (live
// CryptoKeys for the create path), the identity record fields
// (priv JWK / raw public bytes / pubB64), and the `signing` IDB record
// ({ priv, pub, pubB64 } — the record initSigning() loads). Same inputs
// ⇒ byte-identical outputs, on every call and every device.
export async function deriveIdentityMaterial(entropy, passphrase = '') {
  const { identitySeed, signingSeed } = await deriveKeySeeds(entropy, passphrase);
  const idPriv = await importSeedKey('X25519', identitySeed, ['deriveBits']);
  const idPrivJwk = await subtle().exportKey('jwk', idPriv);
  const idPub = await subtle().importKey('jwk',
    { kty: idPrivJwk.kty, crv: idPrivJwk.crv, x: idPrivJwk.x }, { name: 'X25519' }, true, []);
  const idPubRaw = new Uint8Array(await subtle().exportKey('raw', idPub));

  const sgPriv = await importSeedKey('Ed25519', signingSeed, ['sign']);
  const sgPrivJwk = await subtle().exportKey('jwk', sgPriv);
  const sgPubJwk = { kty: sgPrivJwk.kty, crv: sgPrivJwk.crv, x: sgPrivJwk.x };
  const sgPub = await subtle().importKey('jwk', sgPubJwk, { name: 'Ed25519' }, true, ['verify']);
  const sgPubRaw = new Uint8Array(await subtle().exportKey('raw', sgPub));

  return {
    identityKeyPair: { privateKey: idPriv, publicKey: idPub },
    identityPrivJwk: idPrivJwk,
    identityPubRaw: idPubRaw,
    identityPubArr: arr(idPubRaw),
    identityPubB64: b64(idPubRaw),
    signingKeyPair: { privateKey: sgPriv, publicKey: sgPub },
    signingRecord: { priv: sgPrivJwk, pub: sgPubJwk, pubB64: b64(sgPubRaw) },
  };
}

async function kitKey(entropy, passphrase) {
  const master = await masterSeed(entropy, passphrase);
  const bits = await hkdf32(master, 'breeze-seed-v1:recovery-kit');
  return subtle().importKey('raw', bits, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Wrap a recovery-kit payload (the step-1 backup payload object) under
// the (seed, passphrase) anchor. The envelope is self-describing and
// minimal: { kitV, iv, data } in base64; the key itself is re-derived
// at unwrap time, so no KDF parameters travel with the file.
export async function wrapKit(entropy, passphrase, payload, randomBytes = defaultRandomBytes) {
  const key = await kitKey(entropy, passphrase);
  const iv = u8(randomBytes(12));
  if (iv.length !== 12) throw new Error(`seed: RNG returned ${iv.length} IV bytes, need 12`);
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: KIT_AAD }, key, te.encode(JSON.stringify(payload)));
  return { kitV: 1, iv: b64(iv), data: b64(new Uint8Array(ct)) };
}

// Inverse of wrapKit. Returns the payload object, or null on ANY
// failure — malformed envelope, wrong phrase, wrong passphrase, or a
// tampered ciphertext (AES-GCM). Nothing is partially returned.
export async function unwrapKit(entropy, passphrase, kit) {
  try {
    if (!kit || typeof kit !== 'object' || kit.kitV !== 1 ||
        typeof kit.iv !== 'string' || typeof kit.data !== 'string') return null;
    const key = await kitKey(entropy, passphrase);
    const pt = await subtle().decrypt(
      { name: 'AES-GCM', iv: unb64(kit.iv), additionalData: KIT_AAD }, key, unb64(kit.data));
    return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
  } catch { return null; }
}

// The facade index.html exposes as window.__breezeSeed (INTEGRATION.md
// §0(A)): one object, so the classic script's opportunistic read stays a
// single property lookup.
export function createSeedHelper() {
  return {
    randomEntropy,
    entropyToPhrase,
    phraseToEntropy,
    masterSeed,
    deriveKeySeeds,
    deriveIdentityMaterial,
    wrapKit,
    unwrapKit,
    SEED_ENTROPY_BYTES,
    SEED_PHRASE_WORDS,
  };
}

export default createSeedHelper;
