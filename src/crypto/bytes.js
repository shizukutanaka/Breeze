// ============================================================================
// Breeze — shared byte/encoding helpers for the crypto modules.
//
// These trivial-but-load-bearing primitives were previously copy-pasted across
// ratchet.js / group.js / franking.js / atrest.js / fingerprint.js. Consolidating
// them here removes the drift risk — most importantly for `ctEqual`, the
// constant-time comparison every commitment/signature/tag check depends on: one
// audited implementation beats five copies that can silently diverge.
//
// Pure and dependency-free (only btoa/atob/TextEncoder, available in browsers,
// Node ≥16, and Miniflare), so every consumer keeps working unchanged.
// ============================================================================

// Uint8Array view of a Uint8Array / Array / array-like, without copying when possible.
export const u8 = (a) => (a instanceof Uint8Array ? a : Uint8Array.from(a));

// Plain Array of byte values (for JSON-serializable wire payloads).
export const arr = (u) => Array.from(u);

// UTF-8 encode a string, or normalize bytes to a Uint8Array.
export const toBytes = (m) => (typeof m === 'string' ? new TextEncoder().encode(m) : u8(m));

// Concatenate an array of Uint8Arrays into one. Accepts any array of byte arrays.
export const concatBytes = (parts) => {
  const len = parts.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of parts) { out.set(a, o); o += a.length; }
  return out;
};

// base64 of a byte array (chunk-free; inputs here are ≤64 B so no call-stack risk).
export const b64 = (bytes) => {
  let s = '';
  u8(bytes).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
};

// Bytes from a base64 string.
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// Constant-time equality over two byte arrays. Normalizes inputs first, so it accepts
// Uint8Arrays or plain number arrays. Returns false (fast) on a length mismatch — the
// length itself is not secret. The XOR-accumulate loop does not early-exit, so timing
// does not leak where the first differing byte is.
export function ctEqual(a, b) {
  const x = u8(a), y = u8(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
