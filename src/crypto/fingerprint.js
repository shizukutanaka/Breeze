// ============================================================================
// Breeze — Numeric safety number (key fingerprint) for out-of-band MITM check
//
// Research-driven hardening of the original index.html `safetyNumber()`, which
// did a SINGLE SHA-256 over 12 of 32 bytes (~30 displayed digits). That is weak:
// a malicious relay performing MITM only needs to find a substituted identity
// key whose 12-byte truncated single-hash collides — feasible to grind offline.
//
// This module follows Signal's NumericFingerprintGenerator:
//   - ITERATED hash (default 5200 rounds of SHA-512 over `hash ‖ key`), which
//     makes precomputing a colliding key ~5200x more expensive per candidate.
//   - Per-party fingerprint binds (version ‖ identityKey ‖ stableIdentifier).
//   - 60 displayed digits total (30 per party) instead of 30 — Signal-equivalent
//     verification strength (~112 bits shown vs the old ~40 bits).
//   - The two per-party fingerprints are concatenated in sorted order, so BOTH
//     participants compute the identical string regardless of who is "local"
//     (preserves the symmetry the old `[a,b].sort()` relied on).
//
// Dependency-injected (subtle passed in): works in browser WebCrypto, Node ≥20
// globalThis.crypto, and Miniflare. Pure — no DOM, no storage.
//
// Tested reference; index.html showSafetyNumber()/safetyNumber() to be migrated
// onto it in a browser-validated pass.
// ============================================================================

const DEFAULT_ITERATIONS = 5200; // Signal's NumericFingerprintGenerator constant
const FINGERPRINT_VERSION = 0;
const DIGITS_PER_PARTY = 30;     // 6 chunks of 5 digits, one per 5 fingerprint bytes

const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };

// Constant-time byte-array equality (no early-exit on first mismatch). Length is
// not secret here (fixed 30-byte fingerprints), but we still avoid short-circuit.
function ctEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function concat(...arrs) {
  let total = 0;
  for (const a of arrs) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

// 5 fingerprint bytes → a 5-digit chunk (Signal's byteArray5ToLong % 100000).
// A 40-bit value is well within JS's exact-integer range (2^53), so no BigInt.
function chunk5(bytes, off) {
  const v = bytes[off] * 2 ** 32
          + bytes[off + 1] * 2 ** 24
          + bytes[off + 2] * 2 ** 16
          + bytes[off + 3] * 2 ** 8
          + bytes[off + 4];
  return String(v % 100000).padStart(5, '0');
}

// 30 fingerprint bytes → 30-digit display string (6 × 5-digit chunks).
function displayDigits(fpBytes) {
  let out = '';
  for (let i = 0; i < DIGITS_PER_PARTY / 5; i++) out += chunk5(fpBytes, i * 5);
  return out;
}

/**
 * @param {object} opts
 *   subtle:     SubtleCrypto (defaults to globalThis.crypto.subtle)
 *   iterations: hash rounds (default 5200; lower only for tests)
 *   version:    fingerprint format version (default 0), bound into the hash
 */
export function createFingerprint(opts = {}) {
  const subtle = opts.subtle || globalThis.crypto.subtle;
  if (!subtle) throw new Error('subtle required');
  const iterations = opts.iterations ?? DEFAULT_ITERATIONS;
  const version = opts.version ?? FINGERPRINT_VERSION;
  const enc = new TextEncoder();
  const versionBytes = new Uint8Array([(version >> 8) & 0xff, version & 0xff]);

  function toBytes(key) {
    if (key instanceof Uint8Array) return key;
    if (typeof key === 'string') return b64ToBytes(key);
    throw new Error('key must be Uint8Array or base64 string');
  }

  // Iterated hash: H_0 = SHA-512(version ‖ key ‖ identifier);
  //                H_n = SHA-512(H_{n-1} ‖ key). First 30 bytes are the fingerprint.
  async function fingerprintBytes(key, identifier = '') {
    const keyBytes = toBytes(key);
    const idBytes = typeof identifier === 'string' ? enc.encode(identifier) : toBytes(identifier);
    let hash = new Uint8Array(await subtle.digest('SHA-512', concat(versionBytes, keyBytes, idBytes)));
    for (let i = 0; i < iterations; i++) {
      hash = new Uint8Array(await subtle.digest('SHA-512', concat(hash, keyBytes)));
    }
    return hash.slice(0, DIGITS_PER_PARTY);
  }

  /** 30-digit fingerprint for a single party (no grouping). */
  async function fingerprintFor(key, identifier = '') {
    return displayDigits(await fingerprintBytes(key, identifier));
  }

  /**
   * 60-digit safety number for a pair, grouped into 12 space-separated 5-digit
   * blocks (Signal's display format). Symmetric: swapping (local, remote) yields
   * the same string. Optional stable identifiers (e.g. user IDs) bind the keys to
   * identities, matching Signal — omit them and the binding is key-only.
   */
  async function safetyNumber(localKey, remoteKey, { localId = '', remoteId = '' } = {}) {
    const [a, b] = await Promise.all([
      fingerprintFor(localKey, localId),
      fingerprintFor(remoteKey, remoteId),
    ]);
    const combined = a < b ? a + b : b + a; // sorted → both sides agree
    return combined.match(/.{5}/g).join(' ');
  }

  /**
   * Scannable (QR) safety number — the stronger verification path. Manually
   * comparing 60 digits is error-prone (users skip digits); a QR scan compares
   * the FULL 30-byte fingerprints instead of the 40-bit-per-chunk truncation.
   *
   * Encodes `version(1) ‖ myFingerprint(30) ‖ peerFingerprint(30)` as base64
   * (mirrors Signal's CombinedFingerprints, sans protobuf). This is order-
   * SPECIFIC: it embeds who is local — verification uses the cross-match below.
   */
  async function scannable(localKey, remoteKey, { localId = '', remoteId = '' } = {}) {
    const [l, r] = await Promise.all([
      fingerprintBytes(localKey, localId),
      fingerprintBytes(remoteKey, remoteId),
    ]);
    return bytesToB64(concat(new Uint8Array([version & 0xff]), l, r));
  }

  /**
   * Verify a scannable code obtained out-of-band from the peer (e.g. via QR).
   * The peer's code embeds (their local = peer's key, their remote = my key), so
   * a genuine match requires: scanned.local == my remote AND scanned.remote ==
   * my local, with matching version. Any MITM-substituted key breaks the cross-
   * match. Comparison is constant-time. Pass the SAME (localKey, remoteKey, ids)
   * you would pass to scannable()/safetyNumber() from your own perspective.
   *
   * @returns {Promise<{ match: boolean, code?: string }>}
   */
  async function verifyScannable(scannedB64, localKey, remoteKey, { localId = '', remoteId = '' } = {}) {
    let scanned;
    try { scanned = b64ToBytes(scannedB64); } catch { return { match: false, code: 'MALFORMED' }; }
    if (scanned.length !== 1 + 2 * DIGITS_PER_PARTY) return { match: false, code: 'MALFORMED' };
    if (scanned[0] !== (version & 0xff)) return { match: false, code: 'VERSION_MISMATCH' };
    const sLocal  = scanned.slice(1, 1 + DIGITS_PER_PARTY);                   // peer's local  = fp(peer)
    const sRemote = scanned.slice(1 + DIGITS_PER_PARTY, 1 + 2 * DIGITS_PER_PARTY); // peer's remote = fp(me)
    const [myLocal, myRemote] = await Promise.all([
      fingerprintBytes(localKey, localId),   // fp(me)
      fingerprintBytes(remoteKey, remoteId), // fp(peer)
    ]);
    const match = ctEqual(sLocal, myRemote) && ctEqual(sRemote, myLocal);
    return match ? { match: true } : { match: false, code: 'NO_MATCH' };
  }

  return { fingerprintFor, safetyNumber, scannable, verifyScannable, iterations, version };
}
