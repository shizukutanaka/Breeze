// ============================================================================
// Breeze — Message-store encryption at rest (roadmap C9 / defect D23)
//
// Message bodies used to sit in IndexedDB as plaintext `text`: the I4 keywrap
// protected the identity keys, but anyone (or anything) able to read the
// messages store — device forensics, a forensic image, XSS with IDB read —
// could read the whole history. This module seals a record's `text` under a
// dedicated AES-256-GCM store key. The key itself is ordinary keywrap
// material: it lives in the identity store as the 'msgkey' slot, stored as a
// plaintext JWK when app-lock is off and wrapped under the I4 passphrase key
// (src/crypto/atrest.js) when app-lock is on — no new key management.
//
// Wire format of a sealed record: { ...rec, text: '', enc: { v: 1, iv, ct } }
// with iv/ct base64. The AES-GCM AAD binds the ciphertext to the record's
// msgId under a domain tag, so a ciphertext relocated to a different record
// (or produced by another subsystem) fails to open instead of silently
// decoding. Records without `enc` are legacy plaintext and pass through
// unchanged, which is what makes the migration gradual: the read path opens
// what it can and the caller re-seals legacy records opportunistically.
//
// Tested reference; index.html carries a hand-maintained inline mirror
// (grep "inline mirror of src/crypto/msgstore") and tests/msgstore.test.js
// cross-tests the two, per the mirror-drift doctrine.
// ============================================================================
import { b64, unb64 } from './bytes.js';

const AAD_DOMAIN = 'breeze-msgstore-v1';
const aadBytes = (msgId) => new TextEncoder().encode(`${AAD_DOMAIN}:${msgId}`);

export function createMsgStore(opts = {}) {
  const subtle = opts.subtle || globalThis.crypto.subtle;
  const getRandomValues = opts.getRandomValues || ((a) => globalThis.crypto.getRandomValues(a));

  function isSealed(rec) {
    return !!(rec && rec.enc && rec.enc.v === 1 && typeof rec.enc.iv === 'string' && typeof rec.enc.ct === 'string');
  }

  // Seal a record's text under `key` (an AES-GCM CryptoKey). Returns a NEW
  // record; the input is not mutated. Records that are already sealed, have
  // no msgId, or carry no non-empty string text are returned unchanged.
  async function sealRecord(key, rec) {
    if (!key || !rec || isSealed(rec) || !rec.msgId || typeof rec.text !== 'string' || rec.text === '') return rec;
    const iv = getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aadBytes(rec.msgId) }, key, new TextEncoder().encode(rec.text),
    ));
    return { ...rec, text: '', enc: { v: 1, iv: b64(iv), ct: b64(ct) } };
  }

  // Open a sealed record. Returns a NEW record with the plaintext restored
  // and `enc` removed. Legacy (unsealed) records pass through unchanged.
  // On ANY failure — wrong key, tampered ciphertext, AAD/msgId mismatch,
  // malformed enc — returns null so the caller can fail closed instead of
  // displaying a forgery as an empty message.
  async function openRecord(key, rec) {
    if (!rec || !isSealed(rec)) return rec;
    if (!key) return null;
    try {
      const pt = await subtle.decrypt(
        { name: 'AES-GCM', iv: unb64(rec.enc.iv), additionalData: aadBytes(rec.msgId) }, key, unb64(rec.enc.ct),
      );
      const { enc: _enc, ...rest } = rec;
      return { ...rest, text: new TextDecoder().decode(new Uint8Array(pt)) };
    } catch { return null; }
  }

  return { sealRecord, openRecord, isSealed, AAD_DOMAIN };
}

export default createMsgStore;
