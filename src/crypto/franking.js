// ============================================================================
// Breeze — Message franking core (roadmap I17)
//
// Lets a recipient REPORT an abusive end-to-end message such that the relay can
// cryptographically verify the reported plaintext was genuinely the one sent —
// without any plaintext escrow / backdoor, and without the relay learning the
// content of un-reported messages.
//
// Construction (compactly-committing, à la Facebook / Grubbs–Lu–Ristenpart 2017):
//   - sender draws a random franking key Kf (the "opening") and computes
//     commitment Cf = HMAC-SHA256(Kf, message).
//   - Cf is attached to the message in the clear (the relay records it at send
//     time); Kf is sent ENCRYPTED inside the E2E payload, so only the recipient
//     learns it.
//   - To report, the recipient reveals (message, Kf). The relay recomputes
//     HMAC(Kf, message) and checks it equals the Cf it recorded → proof the
//     message was really sent (binding), while un-reported messages stay hidden
//     (HMAC is hiding under a secret key).
//
// HMAC is a secure commitment for franking (binding via collision-resistance,
// hiding via PRF). That is the symmetric core; the AMF extension below binds
// the SENDER too (Tyagi et al., Asymmetric Message Franking, CRYPTO 2019 —
// the sender-binding half of the Hecate model, CRYPTO-SPEC §6a): the sender's
// Ed25519 identity key signs the commitment context, and the tag travels
// INSIDE the E2E payload next to the opening, so the relay learns nothing
// new at send time and un-reported messages keep their deniability. The tag
// becomes verifiable only at report time, when the relay re-checks it
// against the sender's registered identity key: a verified report then
// attributes the message to that sender, and a sender who committed to a
// different message than the one delivered is caught by the recipient's own
// check (the commitment is recomputed from the received plaintext).
// ============================================================================
import { arr, u8, toBytes, ctEqual, b64 } from './bytes.js';

export function createFranking(opts = {}) {
  const subtle = opts.subtle || globalThis.crypto.subtle;
  const getRandomValues = opts.getRandomValues || ((a) => globalThis.crypto.getRandomValues(a));

  async function hmac(keyBytes, msgBytes) {
    const key = await subtle.importKey('raw', u8(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await subtle.sign('HMAC', key, msgBytes));
  }

  // Sender side: commit to a message. Returns { commitment, opening }.
  // Ship `commitment` in the clear (relay records it); send `opening` inside the
  // E2E ciphertext to the recipient.
  async function commit(message) {
    const opening = getRandomValues(new Uint8Array(32));
    const commitment = await hmac(opening, toBytes(message));
    return { commitment: arr(commitment), opening: arr(opening) };
  }

  // Verify a (message, commitment, opening) triple. Used by the relay on report,
  // and by the recipient to sanity-check before reporting.
  // Fails CLOSED (returns false, never throws) on missing/malformed input: the relay may
  // have no recordedCommitment (record lost/expired) and a reporter's (message, opening) is
  // attacker-supplied. `u8(null)`/`toBytes(null)` would otherwise throw an uncaught
  // exception — every sibling verify in this codebase (ktlog.verifyChain, group/ratchet
  // decrypt) returns a clean negative on bad input rather than propagating one.
  async function verify(message, commitment, opening) {
    if (message == null || commitment == null || opening == null) return false;
    try {
      const expected = await hmac(u8(opening), toBytes(message));
      return ctEqual(expected, u8(commitment));
    } catch { return false; }
  }

  // Relay-side report verification: the relay holds `recordedCommitment` (seen at
  // send time, optionally under its own MAC); a reporter submits the revealed
  // (message, opening). Returns true iff the report is authentic.
  async function verifyReport({ message, opening, recordedCommitment }) {
    return verify(message, recordedCommitment, opening);
  }

  // --- AMF extension (D08): sender binding ---------------------------------
  // The canonical string every side signs/verifies byte-identically. The
  // commitment enters in its base64 wire form (the string the relay records),
  // so the tag binds exactly the value a report is checked against.
  const AMF_DOMAIN = 'breeze-amf-v1';
  function amfMessage(frankId, commitmentB64) {
    return `${AMF_DOMAIN}:${frankId}:${commitmentB64}`;
  }

  // Sender side: sign the commitment context with the Ed25519 identity
  // signing key. Returns the signature as a byte array (arr() convention).
  async function amfSign(signKey, frankId, commitmentB64) {
    const sig = await subtle.sign({ name: 'Ed25519' }, signKey, toBytes(amfMessage(frankId, commitmentB64)));
    return arr(new Uint8Array(sig));
  }

  // Verify an AMF tag under the sender's raw Ed25519 identity public key.
  // Used by the recipient at receipt time (against the commitment recomputed
  // from the received plaintext) and by the relay at report time (against
  // the recorded commitment). Fails CLOSED (false, never throws), like
  // verify() above: every input here is peer- or reporter-supplied.
  async function amfVerify(senderPubRaw, sig, frankId, commitmentB64) {
    if (senderPubRaw == null || sig == null || !frankId || !commitmentB64) return false;
    try {
      const pub = await subtle.importKey('raw', u8(senderPubRaw), { name: 'Ed25519' }, false, ['verify']);
      return await subtle.verify({ name: 'Ed25519' }, pub, u8(sig), toBytes(amfMessage(frankId, commitmentB64)));
    } catch { return false; }
  }

  // Relay-side AMF report verification: the HMAC opening must match the
  // recorded commitment AND the tag must be the claimed sender's signature
  // over that same commitment. Either half failing rejects the report as
  // unbound — the first stops forged content, the second stops forged
  // attribution and binds a genuine sender to the reported message.
  async function verifyAmfReport({ message, opening, recordedCommitment, frankId, sig, senderPub }) {
    if (!await verify(message, recordedCommitment, opening)) return false;
    return amfVerify(senderPub, sig, frankId, b64(u8(recordedCommitment)));
  }

  return { commit, verify, verifyReport, amfMessage, amfSign, amfVerify, verifyAmfReport, _hmac: hmac, ctEqual };
}

export default createFranking;
