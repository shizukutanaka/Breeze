// ============================================================================
// Breeze — PQ prekey key material (stage-3 step 3, docs/PQ_STAGE3_PLAN.md D3/D4)
//
// WHAT THIS IS: the identity-level helper that mints this device's ML-KEM-768
// prekey pair for the prekey bundle — the client half of stage 3 step 3. It
// generates the keypair from a fresh 64-byte seed, has the public half signed
// by the identity Ed25519 key (pqPreKeySig, over the RAW public-key bytes —
// the signSPK precedent byte-for-byte), and shapes the two bundle fields
// (pqPreKey / pqPreKeySig) plus the at-rest seed record. Step 2's Worker
// stores, serves and verifies the pair; step 5 wires session establishment.
//
// WHAT THIS IS NOT: negotiation or session code. Nothing here advertises the
// `pqxdh` cap and nothing encapsulates/decapsulates for a session — until
// step 5 a bundle carrying these fields is inert: peers can fetch the pair
// but no shipped code path can initiate PQ against it. The KEM itself is the
// pinned vendored implementation (src/crypto/mlkem.js, stage-3 step 1) —
// never hand-rolled, per pq.js's doctrine.
//
// STORAGE (D4): only the 64-byte keygen seed persists, as a byte array in
// the `identity` IDB store under `pq-priv` — the spk-priv / otp-priv pattern
// ({ priv } / { keys } records in the same store). Noble keygen is
// deterministic from the seed, so the 2,400-byte expanded secret key is
// re-derived on demand (pqSecretKeyFromSeed) and is NEVER stored and NEVER
// leaves the device: the upload body carries the public key and its
// signature only. Rotation inherits the SPK cadence — every
// generatePreKeyBundle() mints a fresh seed and replaces the record.
//
// FAIL-SAFE: every entry point here may throw (no KEM, bad RNG, signing
// unavailable); the caller (generatePreKeyBundle in index.html) catches and
// ships the classical bundle unchanged, so a PQ failure can never break
// registration or a rotation. Choosing classical that way is the caller's
// explicit degradation, not a silent downgrade inside the crypto — the
// fields are simply absent, exactly like a pre-stage-3 client.
//
// LOADING: index.html loads this module at runtime (INTEGRATION.md §0(A))
// and exposes createPQKeyHelper() as window.__breezePQKey; the classic
// script reads it opportunistically. Tests import the module directly.
// ============================================================================
import { ml_kem768 } from './mlkem.js';
import { b64, unb64, u8, arr } from './bytes.js';

export const PQ_SEED_BYTES = 64;          // ML-KEM-768 keygen seed (D4)
export const PQ_PUBLIC_KEY_BYTES = 1184;  // FIPS 203 ML-KEM-768 sizes
export const PQ_SECRET_KEY_BYTES = 2400;
export const PQ_IDB_KEY = 'pq-priv';      // `identity` store record key

function defaultRandomBytes(n) {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

// Mint a fresh ML-KEM-768 keypair from a fresh 64-byte seed. Deterministic
// in the seed: the same seed always yields the same pair (the property D4's
// store-the-seed design and the ACVP vectors both rely on). `randomBytes`
// is injectable for tests; production uses crypto.getRandomValues.
export function mintPQPreKey(randomBytes = defaultRandomBytes) {
  const seed = u8(randomBytes(PQ_SEED_BYTES));
  if (seed.length !== PQ_SEED_BYTES) {
    throw new Error(`pqkey: RNG returned ${seed.length} bytes, need ${PQ_SEED_BYTES}`);
  }
  const { publicKey } = ml_kem768.keygen(seed);
  const pub = u8(publicKey);
  if (pub.length !== PQ_PUBLIC_KEY_BYTES) {
    throw new Error(`pqkey: ML-KEM-768 public key is ${pub.length} bytes, expected ${PQ_PUBLIC_KEY_BYTES}`);
  }
  return { seed, publicKey: pub, pqPreKey: b64(pub) };
}

// Sign the RAW public-key bytes with the identity signing key. `signRaw`
// is the injected signer — async (rawBytes) => signature bytes. In the
// browser the caller binds crypto.subtle.sign({ name: 'Ed25519' }, …) to
// the identity key (the same call generatePreKeyBundle makes for the SPK);
// tests bind any Ed25519 private key. Signing the base64 string instead
// would never verify — the Worker's verifyEd25519 base64-decodes the key
// first (the E2E-found SPK lesson, plan D3).
export async function signPQPreKey(signRaw, publicKeyBytes) {
  if (typeof signRaw !== 'function') throw new Error('pqkey: a signer must be injected');
  const sig = await signRaw(u8(publicKeyBytes));
  // WebCrypto's sign() resolves to an ArrayBuffer, which byte helpers do
  // NOT coerce (Uint8Array.from(buffer) is empty) — normalize explicitly,
  // and pin the Ed25519 size so a mangled signer fails here, not silently
  // as an empty signature the Worker would treat as "unsigned".
  const sigBytes = sig instanceof ArrayBuffer ? new Uint8Array(sig) : u8(sig);
  if (sigBytes.length !== 64) {
    throw new Error(`pqkey: Ed25519 signature is ${sigBytes.length} bytes, expected 64`);
  }
  return b64(sigBytes);
}

// One-call bundle material: mint + sign. Returns the two bundle fields and
// the seed (the caller stores the seed via pqSeedRecord BEFORE attaching
// the fields, so a bundle never advertises a key this device does not hold).
export async function buildPQBundleFields({ signRaw, randomBytes } = {}) {
  const minted = mintPQPreKey(randomBytes);
  const pqPreKeySig = await signPQPreKey(signRaw, minted.publicKey);
  return { pqPreKey: minted.pqPreKey, pqPreKeySig, seed: minted.seed };
}

// The `pq-priv` IDB record: { seed: number[] } — a byte array via arr(),
// the same encoding the identity record uses for its public key.
export function pqSeedRecord(seed) {
  const s = u8(seed);
  if (s.length !== PQ_SEED_BYTES) {
    throw new Error(`pqkey: seed is ${s.length} bytes, expected ${PQ_SEED_BYTES}`);
  }
  return { seed: arr(s) };
}

// Inverse of pqSeedRecord. Returns null for anything that is not a plain
// seed record — missing, malformed, or passphrase-WRAPPED by /keywrap
// ({ wrapped } / { kdf } forms): unwrapping needs the passphrase flow,
// which is the caller's (loadIdentity's) job, never a silent plaintext read.
export function pqSeedFromRecord(record) {
  if (!record || typeof record !== 'object') return null;
  if (record.wrapped || record.kdf) return null;
  const s = record.seed;
  if (!Array.isArray(s) || s.length !== PQ_SEED_BYTES) return null;
  if (!s.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)) return null;
  return Uint8Array.from(s);
}

// Re-derive the keypair halves from a stored seed (D4: derived on demand,
// never persisted). pqSecretKeyFromSeed is what a future responder path
// decapsulates with; it must never be uploaded, logged, or stored.
export function pqPublicKeyFromSeed(seed) {
  return u8(ml_kem768.keygen(u8(seed)).publicKey);
}
export function pqSecretKeyFromSeed(seed) {
  return u8(ml_kem768.keygen(u8(seed)).secretKey);
}

// The v2 upload-digest tail (plan D3): the PQ pair APPENDED to the v1
// field list, never inserted, so the seven legacy fields stay a prefix.
// Empty strings when the bundle carries no pair — the exact values the
// Worker binds when it verifies a field-less body under the v2 formula.
export function pqDigestTail(bundle) {
  return [
    typeof bundle?.pqPreKey === 'string' ? bundle.pqPreKey : '',
    typeof bundle?.pqPreKeySig === 'string' ? bundle.pqPreKeySig : '',
  ];
}

// A bundle "carries PQ" when either field is present — the condition under
// which step 2's Worker accepts the v2 digest ONLY (v1 does not bind the
// pair) and under which prekeyUploadAuth appends the tail.
export function bundleHasPQFields(bundle) {
  return !!(bundle && (bundle.pqPreKey || bundle.pqPreKeySig));
}

// Decode a base64 pqPreKey back to raw bytes (initiator-side verification
// in step 5 signs/checks the raw bytes). Returns null on malformed input.
export function pqPublicKeyBytes(pqPreKey) {
  if (typeof pqPreKey !== 'string' || !pqPreKey) return null;
  try {
    const bytes = unb64(pqPreKey);
    return bytes.length === PQ_PUBLIC_KEY_BYTES ? bytes : null;
  } catch { return null; }
}

// The facade index.html exposes as window.__breezePQKey (INTEGRATION.md
// §0(A)): one object so the classic script's opportunistic read stays a
// single property lookup, and a shape change here is one breaking change,
// not a scatter of globals.
export function createPQKeyHelper() {
  return {
    mintPQPreKey,
    signPQPreKey,
    buildPQBundleFields,
    pqSeedRecord,
    pqSeedFromRecord,
    pqPublicKeyFromSeed,
    pqSecretKeyFromSeed,
    pqDigestTail,
    bundleHasPQFields,
    pqPublicKeyBytes,
    PQ_SEED_BYTES,
    PQ_PUBLIC_KEY_BYTES,
    PQ_IDB_KEY,
  };
}

export default createPQKeyHelper;
