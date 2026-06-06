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
// hiding via PRF). This is the symmetric core; for Breeze's SEALED SENDER, bind
// the sender too via asymmetric franking / Hecate (see CRYPTO-SPEC §9 N4).
// ============================================================================
const arr = (u) => Array.from(u);
const u8 = (a) => (a instanceof Uint8Array ? a : Uint8Array.from(a));
const toBytes = (m) => (typeof m === 'string' ? new TextEncoder().encode(m) : u8(m));

export function createFranking(opts = {}) {
  const subtle = opts.subtle || globalThis.crypto.subtle;
  const getRandomValues = opts.getRandomValues || ((a) => globalThis.crypto.getRandomValues(a));

  async function hmac(keyBytes, msgBytes) {
    const key = await subtle.importKey('raw', u8(keyBytes), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await subtle.sign('HMAC', key, msgBytes));
  }
  function ctEqual(a, b) {
    const x = u8(a), y = u8(b);
    if (x.length !== y.length) return false;
    let d = 0;
    for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
    return d === 0;
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
  async function verify(message, commitment, opening) {
    const expected = await hmac(u8(opening), toBytes(message));
    return ctEqual(expected, u8(commitment));
  }

  // Relay-side report verification: the relay holds `recordedCommitment` (seen at
  // send time, optionally under its own MAC); a reporter submits the revealed
  // (message, opening). Returns true iff the report is authentic.
  async function verifyReport({ message, opening, recordedCommitment }) {
    return verify(message, recordedCommitment, opening);
  }

  return { commit, verify, verifyReport, _hmac: hmac, ctEqual };
}

export default createFranking;
