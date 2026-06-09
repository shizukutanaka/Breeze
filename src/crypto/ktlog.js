// Key-transparency log — client-side rollover detector (I11)
//
// The worker logs SHA-256(IK) on each prekey upload (ktlog:<userId>) and
// returns `bundle.keyHistory` on fetch.  This module lets the client:
//   1. Hash an incoming identity key and compare it to the stored pin.
//   2. Detect unexpected key rollovers (possible MITM).
//   3. Merge log fragments received at different times.
//   4. (N5) Verify the hash-chain binding between successive log entries,
//      making the append-only property detectable by clients.
//
// Chain format: each entry { ts, h, c? } where c = SHA-256(prevC ‖ h) (both
// base64-decoded to bytes). Entries without c are legacy (pre-chain) and are
// skipped during verification. The chain starts fresh from the first entry
// with a c field, using a 32-byte zero vector as the initial prevC.
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
 *
 * The input is RELAY-SUPPLIED (bundle.keyHistory) and therefore untrusted: a
 * malicious relay could return a huge array to force an O(n log n) sort DoS on
 * the client at prekey-fetch time. The worker only ever stores ≤10 entries, so
 * we bound the input to MAX_LOG_ENTRIES (generous headroom) before processing.
 */
const MAX_LOG_ENTRIES = 256;

export function parseLog(raw) {
  if (!Array.isArray(raw)) return [];
  const bounded = raw.length > MAX_LOG_ENTRIES ? raw.slice(-MAX_LOG_ENTRIES) : raw;
  return bounded
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

// --- N5: hash-chained log (tamper-evident append-only log) ---

const _b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const _b64e = (u) => { let s = ''; u.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };

/**
 * Compute one step of the chain: SHA-256(prevC ‖ h) where prevC and h are base64.
 * prevC is null for the first entry (treated as 32 zero bytes).
 */
export async function chainHash(subtle, prevC, h) {
  const prev = prevC ? _b64d(prevC) : new Uint8Array(32);
  const hb   = _b64d(h);
  const buf  = new Uint8Array(prev.length + hb.length);
  buf.set(prev, 0);
  buf.set(hb, prev.length);
  return _b64e(new Uint8Array(await subtle.digest('SHA-256', buf)));
}

/**
 * Create a new chain entry to append to a sorted log.
 * sortedLog is the output of parseLog() — already validated and sorted.
 * Returns { ts, h, c } ready to push onto the log array.
 */
export async function appendChainEntry(subtle, sortedLog, h, ts = Date.now()) {
  const last = sortedLog.length ? sortedLog[sortedLog.length - 1] : null;
  const prevC = last?.c ?? null;
  const c = await chainHash(subtle, prevC, h);
  return { ts, h, c };
}

/**
 * Verify the chain hashes of a key-history log.
 * Entries without a c field are legacy (unchained) and are skipped.
 * Once the chain starts (first entry with c), subsequent chained entries must
 * link correctly; a break returns { ok: false, invalidIdx }.
 *
 * @returns {{ ok: boolean, invalidIdx?: number }}
 */
export async function verifyChain(subtle, log) {
  const sorted = parseLog(log);
  let prevC = null;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    // Legacy (pre-chain) entries have no c — skip. A present-but-non-string c is
    // malformed (tampering), not legacy, so it must fail rather than be skipped.
    if (e.c === undefined || e.c === null) continue;
    if (typeof e.c !== 'string') return { ok: false, invalidIdx: i };
    let expected;
    try {
      // chainHash base64-decodes prevC and e.h; a relay that injects malformed
      // base64 would otherwise throw an uncaught exception. Treat it as a broken
      // chain instead of crashing the verification.
      expected = await chainHash(subtle, prevC, e.h);
    } catch {
      return { ok: false, invalidIdx: i };
    }
    if (expected !== e.c) return { ok: false, invalidIdx: i };
    prevC = e.c;
  }
  return { ok: true };
}
