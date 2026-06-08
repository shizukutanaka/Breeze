// Key-transparency log — client-side rollover detector (I11)
//
// The worker logs SHA-256(IK) on each prekey upload (ktlog:<userId>) and
// returns `bundle.keyHistory` on fetch.  This module lets the client:
//   1. Hash an incoming identity key and compare it to the stored pin.
//   2. Detect unexpected key rollovers (possible MITM).
//   3. Merge log fragments received at different times.
//
// All functions are pure / dependency-injected (subtle passed in) so they
// work in browser (WebCrypto), Node ≥20, and Miniflare without modification.

/**
 * SHA-256(ikJsonString) → base64 string.
 * Matches the hash produced by the worker in handlePreKeyUpload.
 */
export async function hashIK(subtle, ikJsonString) {
  const bytes = new TextEncoder().encode(ikJsonString);
  const digest = await subtle.digest('SHA-256', bytes);
  let s = '';
  new Uint8Array(digest).forEach(b => { s += String.fromCharCode(b); });
  return btoa(s);
}

/**
 * Parse and sort key-history entries from a raw prekey bundle.
 * Invalid / missing entries are silently dropped.
 * Returns entries sorted ascending by timestamp.
 */
export function parseLog(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(e => e && typeof e.ts === 'number' && typeof e.h === 'string' && e.h.length > 0)
    .sort((a, b) => a.ts - b.ts);
}

/**
 * Check whether the incoming prekey bundle presents a known or rolled key.
 *
 * @param {SubtleCrypto} subtle
 * @param {string|null}  storedIkJson  JSON string of the locally-pinned identity key,
 *                                     or null on first contact.
 * @param {Array}        incomingLog   bundle.keyHistory array from the worker.
 *
 * @returns {Promise<{
 *   status: 'ok' | 'new' | 'rolled' | 'unknown',
 *   currentHash?: string,
 *   storedHash?: string,
 *   storedSeenInHistory?: boolean,
 *   rolloverTs?: number|null,
 *   log?: Array,
 * }>}
 *
 * Callers should treat 'rolled' as an MITM signal (show the key-change banner)
 * unless storedSeenInHistory is true AND the rollover timestamp is recent and
 * expected (e.g. a known device-reset).
 */
export async function checkRollover(subtle, storedIkJson, incomingLog) {
  const log = parseLog(incomingLog);
  if (!log.length) return { status: 'unknown' };

  const currentHash = log[log.length - 1].h;

  if (storedIkJson === null || storedIkJson === undefined) {
    return { status: 'new', currentHash, log };
  }

  const storedHash = await hashIK(subtle, storedIkJson);

  if (storedHash === currentHash) {
    return { status: 'ok', currentHash, log };
  }

  const storedEntryIdx = log.findIndex(e => e.h === storedHash);
  const rolloverEntry  = log.find(e => e.h === currentHash);

  return {
    status: 'rolled',
    storedHash,
    currentHash,
    storedSeenInHistory: storedEntryIdx >= 0,
    rolloverTs: rolloverEntry?.ts ?? null,
    log,
  };
}

/**
 * Merge two raw key-history arrays.
 * Deduplicates by hash (keeps earliest timestamp for each hash),
 * sorts ascending by timestamp, and caps at 20 entries.
 */
export function mergeLog(existingLog, incomingLog) {
  const combined = [...parseLog(existingLog), ...parseLog(incomingLog)];
  const byHash = new Map();
  for (const e of combined) {
    const prev = byHash.get(e.h);
    if (!prev || e.ts < prev.ts) byHash.set(e.h, e);
  }
  return [...byHash.values()].sort((a, b) => a.ts - b.ts).slice(-20);
}
