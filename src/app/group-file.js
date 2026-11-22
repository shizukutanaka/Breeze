// Breeze D25 wave 9 — group file transfer.
// Files join stickers and location on the group sender-key text channel:
// the wire is a {gfile} JSON document carrying the same {type:'file',
// name, mime, data} record the 1:1 path stores, so the existing message
// record shape and the appendMsg file renderer (esc()'d name, blob URL)
// serve groups unchanged. 1:1 keeps its own paths (P2P binary, ratchet
// relay); group voice stays refused — it has no transport here either.
//
// Size budget (measured model; tests/group-file.test.js re-measures the
// real thing): encryptGroupMsg JSON-encodes every ciphertext byte as a
// decimal number via arr() — 658/256 ≈ 2.57 digits + 1 comma ≈ 3.57
// chars/byte — over a plaintext padded to 4096-byte buckets (+2 length
// prefix, +16 GCM tag). The Worker caps the relay payload at 262,144
// chars (256 * 1024, _worker.js handleMsg), and relay deposits are the
// fallback for every member (and the only path for secondary senders),
// so the ciphertext must fit it. Allowing a padded size of 69,632
// (17 buckets) gives an expected ciphertext of ≈ 3.57 * 69,648 + ~250
// chars of JSON scaffolding ≈ 248.9K chars — ~13.2K under the cap, and
// the digit-length sum is concentrated (σ ≈ 150 chars), so the margin
// is ~88σ. Wire budget: 69,630 UTF-8 bytes; fixed JSON is 55 chars,
// the name is capped at 128 chars (≤ 512 UTF-8 bytes), mime at 64, which
// leaves 68,996 base64 chars = 51,747 raw bytes.

export const GROUP_FILE_DATA_MAX = 68996; // base64 chars
export const GROUP_FILE_RAW_MAX = 51747;  // raw bytes (= DATA_MAX * 3/4)
export const GROUP_FILE_TEXT_MAX = 69312; // decrypted wire chars (receive cap)

const B64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const MIME_RE = /^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]*$/;

// The one sanitizer both directions share: whatever survives this is
// safe to store and render — bounded name/mime, strictly-shaped base64,
// and the data cap that keeps the ciphertext inside the relay envelope.
export function sanitizeGroupFile(o) {
  if (!o || typeof o !== 'object') return null;
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, 128) : '';
  const mime = typeof o.mime === 'string' && o.mime.length <= 64 && MIME_RE.test(o.mime)
    ? o.mime : 'application/octet-stream';
  const data = typeof o.data === 'string' ? o.data : '';
  if (!data || data.length > GROUP_FILE_DATA_MAX || data.length % 4 !== 0 || !B64_RE.test(data)) return null;
  return { type: 'file', name: name || 'file', mime, data };
}

// Group wire text (inside the sender-key ciphertext). The {gfile}
// marker keeps it distinct from ordinary text, {gctl}, {stk} and {loc}.
export function groupTextForFile(file) {
  const clean = sanitizeGroupFile(file);
  if (!clean) return null;
  return JSON.stringify({ gfile: clean });
}

export function parseGroupFileText(text) {
  if (typeof text !== 'string' || !text.startsWith('{"gfile":')) return null;
  let obj;
  try { obj = JSON.parse(text); } catch { return null; }
  if (!obj || typeof obj !== 'object' || !obj.gfile) return null;
  return sanitizeGroupFile(obj.gfile);
}

// Sender side (the _sendFile group branch delegates here with the
// initMessenger closure as deps, the location-share factory pattern).
// Images compress exactly like 1:1 (the caller passes _compressImage);
// oversize files refuse honestly with groupFileTooLarge, before
// anything is stored or drawn. Secondaries are supported: the shared
// transport skips its direct leg for them and deposits via relay.
export async function sendGroupFile(D, contact, file) {
  try {
    file = await D.compressImage(file);
    const ab = await file.arrayBuffer();
    if (ab.byteLength > GROUP_FILE_RAW_MAX) { D.showToast(D.t('groupFileTooLarge'), 'error'); return; }
    const clean = sanitizeGroupFile({ name: file.name, mime: file.type, data: D.bufToB64(ab) });
    if (!clean) { D.showToast(D.t('groupFileTooLarge'), 'error'); return; }
    let ts = D.correctedNow();
    if (ts <= D.lastTs()) ts = D.lastTs() + 1;
    D.setLastTs(ts);
    const msgId = D.myId() + ':' + ts;
    const label = '📎 ' + clean.name;
    const fileData = JSON.stringify(clean);
    const sent = await D.sendGroupTransport(contact, groupTextForFile(clean), ts, msgId, async () => {
      await D.dbPut('messages', { msgId, contactId: contact.id, text: label, mine: true, ts, fileData, senderName: D.myName() });
      D.appendMsg(label, true, ts, null, fileData, { msgId, senderName: D.myName() });
    });
    if (!sent) { D.showToast(D.t('toastSendFail'), 'error'); return; }
    contact.lastMsg = label; contact.lastMsgAt = ts;
    const stored = await D.dbGet('contacts', contact.id).catch(() => null);
    if (stored) { stored.lastMsg = label; stored.lastMsgAt = ts; await D.dbPut('contacts', stored); }
    D.renderContacts();
  } catch(e) { D.dbg(e, 'group-file-send'); }
}
