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

  return { fingerprintFor, safetyNumber, iterations, version };
}
