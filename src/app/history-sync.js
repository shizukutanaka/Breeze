// ============================================================================
// HISTORY SYNC — SHARE_PLAN stage 4 step 3: encrypted conversation-history
// transfer from an existing device to a newly linked one.
//
// The transfer rides the exact channel new-message self-sync already uses
// (a ratchet-encrypted deposit to the sibling device's inbox, sent only to
// a device the signed registry verifies as the same account), so the relay
// sees nothing new: the same envelope shape, the same ciphertext, no
// plaintext and no new metadata fields beyond the chunk counters any
// multi-deposit flow produces. This module is the pure half: how stored
// records are packed into bounded chunks, how an incoming chunk is judged,
// and which records an import may write. The wiring (collection, crypto,
// IDB, toasts) lives in index.html.
//
// Byte-identity is the step's completion condition, so two rules are
// load-bearing here:
//   - Records travel AS STORED. Validation inspects a record but never
//     rebuilds it field by field, so key order and values survive the
//     JSON round trip exactly.
//   - An import never overwrites a record the receiving device already
//     holds. For a freshly linked device (the case this feature exists
//     for) the store is empty, so the result is the sender's conversation
//     byte for byte; for a re-link, local data wins and nothing is lost.
// ============================================================================

// Serialized-chunk budget. A chunk is ratchet-encrypted and base64'd into
// a relay deposit whose envelope cap is 512KB; 200K chars of plaintext
// leaves generous headroom for that expansion plus the envelope fields.
export const HISTORY_CHUNK_MAX = 200000;
// A single record larger than this cannot travel in one deposit at all.
// In practice it is an oversized attachment record (the 1:1 file path caps
// fileData well below this), so the sender skips it and counts the skip.
export const HISTORY_RECORD_MAX = 340000;
// Bounds on the chunk counters a receiver will honour — a hostile or
// garbled envelope must not make a device buffer unbounded state.
export const HISTORY_MAX_CHUNKS = 512;
export const HISTORY_MAX_RECORDS = 100000;

// Pack stored records into chunk payloads, in the order given. Each
// payload is the JSON string of { h: 1, records: [...] } with length at
// most maxChars, except a chunk holding one record that exceeds the
// budget on its own. Records whose own serialization exceeds
// HISTORY_RECORD_MAX are not packed; they are counted in `skipped`.
// Returns { chunks: string[], skipped: number }.
export function chunkHistoryRecords(records, maxChars = HISTORY_CHUNK_MAX) {
  const chunks = [];
  let skipped = 0;
  let cur = [];
  let curLen = 0;
  const frame = (recs) => JSON.stringify({ h: 1, records: recs }).length;
  for (const rec of records || []) {
    const recLen = JSON.stringify(rec)?.length ?? 0;
    if (!recLen || recLen > HISTORY_RECORD_MAX) { skipped++; continue; }
    if (cur.length && curLen + recLen + 1 > maxChars) {
      chunks.push(JSON.stringify({ h: 1, records: cur }));
      cur = []; curLen = 0;
    }
    cur.push(rec);
    curLen = frame(cur);
  }
  if (cur.length) chunks.push(JSON.stringify({ h: 1, records: cur }));
  return { chunks, skipped };
}

// Parse one received chunk payload. Returns its records array, or null
// for anything that is not a well-formed history chunk.
export function parseHistoryChunk(text) {
  if (typeof text !== 'string' || !text || text.length > HISTORY_RECORD_MAX + 64) return null;
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!obj || obj.h !== 1 || !Array.isArray(obj.records)) return null;
  if (obj.records.length > HISTORY_MAX_RECORDS) return null;
  return obj.records;
}

// Judge one record for import into the conversation `contactId`. Returns
// the record itself (unchanged — see the byte-identity rule above) or
// null when the record is malformed or belongs to another conversation.
// A record whose disappearing-message deadline has passed is also
// refused: transferring it would resurrect content meant to be gone.
export function historyRecordOk(rec, contactId, now = Date.now()) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return null;
  if (typeof rec.msgId !== 'string' || !rec.msgId || rec.msgId.length > 256) return null;
  if (rec.contactId !== contactId) return null;
  if (typeof rec.ts !== 'number' || !Number.isFinite(rec.ts)) return null;
  if (rec.disappearAt !== undefined
    && (typeof rec.disappearAt !== 'number' || !Number.isFinite(rec.disappearAt) || rec.disappearAt <= now)) return null;
  return rec;
}

// The records an import may write: the valid ones whose msgId the
// receiving store does not already hold. Existing records always win.
export function planHistoryImport(records, contactId, existingIds, now = Date.now()) {
  const have = existingIds instanceof Set ? existingIds : new Set(existingIds || []);
  const out = [];
  for (const rec of records || []) {
    const ok = historyRecordOk(rec, contactId, now);
    if (ok && !have.has(ok.msgId)) { have.add(ok.msgId); out.push(ok); }
  }
  return out;
}

// Canonical serialization of a conversation, for the byte-identity
// comparison: records sorted by (ts, msgId), serialized as stored.
export function canonicalHistory(records) {
  const sorted = [...(records || [])].sort((a, b) =>
    (a.ts - b.ts) || (a.msgId < b.msgId ? -1 : a.msgId > b.msgId ? 1 : 0));
  return JSON.stringify(sorted);
}
