// ============================================================================
// Breeze — At-rest key protection (roadmap I4)
//
// Today identity/signing private keys are stored as PLAINTEXT JWK in IndexedDB
// (readable by XSS or device forensics). This module wraps a JWK under a key
// derived from a passphrase via PBKDF2 (>=600k iterations) + AES-256-GCM, and
// migrates legacy plaintext records. The no-passphrase default path in the app is
// preserved; this is opt-in app-lock.
//
// PBKDF2 chosen over Argon2id to stay dependency-free / no-build (Argon2id would
// need a WASM blob). 600k SHA-256 iterations is the OWASP 2023 floor.
//
// Tested reference; index.html loadIdentity()/key storage to be migrated onto it
// in a browser-validated pass.
// ============================================================================
// Use btoa/atob instead of Buffer so the module works in both Node ≥16 and browsers.
const b64 = (bytes) => { let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const u8 = (a) => (a instanceof Uint8Array ? a : Uint8Array.from(a));

// PBKDF2 work-factor ceiling for the UNWRAP path. The iteration count is read
// from the stored record, which an XSS-planted or corrupted IndexedDB entry
// controls; an absurd value (e.g. 1e12) would hang the main thread deriving the
// key. Anything above this generous ceiling (≈16× the 600k default) is rejected
// rather than executed.
const MAX_UNWRAP_ITER = 10_000_000;

export function createAtRest(opts = {}) {
  const subtle = opts.subtle || globalThis.crypto.subtle;
  const getRandomValues = opts.getRandomValues || ((a) => globalThis.crypto.getRandomValues(a));
  const cfg = { iterations: 600000, hash: 'SHA-256', ...opts };

  async function deriveWrapKey(passphrase, salt, iterations, hash) {
    const base = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'PBKDF2', salt: u8(salt), iterations, hash },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
    );
  }

  // Wrap an arbitrary JWK (or any JSON-serializable secret) under a passphrase.
  async function wrapJWK(jwk, passphrase) {
    const salt = getRandomValues(new Uint8Array(16));
    const iv = getRandomValues(new Uint8Array(12));
    const key = await deriveWrapKey(passphrase, salt, cfg.iterations, cfg.hash);
    const pt = new TextEncoder().encode(JSON.stringify(jwk));
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, pt));
    return { v: 1, kdf: 'pbkdf2', hash: cfg.hash, iter: cfg.iterations, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }

  // Unwrap a record produced by wrapJWK. Returns the JWK, or null on wrong
  // passphrase / tampering (AES-GCM auth failure).
  async function unwrapJWK(record, passphrase) {
    try {
      // Guard the attacker-controllable iteration count: a non-finite, non-positive,
      // or absurdly large value would otherwise hang the main thread in PBKDF2.
      const iter = record.iter;
      if (!Number.isFinite(iter) || iter <= 0 || iter > MAX_UNWRAP_ITER) return null;
      const key = await deriveWrapKey(passphrase, unb64(record.salt), iter, record.hash);
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(record.iv) }, key, unb64(record.ct));
      return JSON.parse(new TextDecoder().decode(new Uint8Array(pt)));
    } catch { return null; }
  }

  // Migrate a legacy plaintext keystore record { priv: <jwk>, ... } to a wrapped
  // form { ..., wrapped: <record> } with the plaintext `priv` removed. Idempotent:
  // an already-wrapped record is returned unchanged.
  async function migrate(record, passphrase) {
    if (record.wrapped || record.kdf) return record; // already wrapped
    const wrapped = await wrapJWK(record.priv, passphrase);
    const rest = { ...record };
    delete rest.priv;
    return { ...rest, wrapped };
  }

  // Detect whether a stored keystore record is passphrase-wrapped (a nested
  // { wrapped: {...} } from migrate(), or a bare wrap record from wrapJWK()) vs.
  // legacy plaintext ({ priv }). Lets loadIdentity decide whether to prompt for a
  // passphrase before reading the key (INTEGRATION.md §5). Single source of truth.
  function isWrapped(record) {
    return !!(record && (record.wrapped || record.kdf === 'pbkdf2'));
  }

  // Load the private JWK from a keystore record regardless of form:
  //   - wrapped ({ wrapped:{...} } or a bare wrap record) → unwrapJWK(passphrase)
  //   - legacy plaintext ({ priv }) → returns priv directly (passphrase ignored)
  // Returns the JWK, or null on wrong passphrase / tamper. THROWS if the record is
  // wrapped but no passphrase was supplied, so the caller knows to prompt rather than
  // silently treating a locked record as empty.
  async function loadKey(record, passphrase) {
    if (!record) return null;
    if (isWrapped(record)) {
      if (passphrase == null) throw new Error('atrest loadKey: passphrase required for a wrapped record');
      return unwrapJWK(record.wrapped || record, passphrase);
    }
    return record.priv ?? null;
  }

  // Best-effort zeroing of plaintext key material after use. JS GC may retain
  // copies; this limits exposure to memory dumps / heap dumps taken right after use.
  function zeroBuffer(buf) {
    if (buf instanceof Uint8Array) buf.fill(0);
    else if (buf instanceof ArrayBuffer) new Uint8Array(buf).fill(0);
  }

  return { wrapJWK, unwrapJWK, migrate, isWrapped, loadKey, zeroBuffer, _cfg: cfg };
}

export default createAtRest;
