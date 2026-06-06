// ============================================================================
// Breeze — Group sender-key ratchet (reference module)
//
// Fixes the two group-crypto holes (roadmap I2 + I3):
//   I2 Forward secrecy: today the sender key never ratchets, so one leak exposes
//      every past/future group message. Here the chain key hash-ratchets per
//      message (msgKey = HKDF(ck,'group-msg'); ck = HKDF(ck,'group-chain')), and
//      consumed chain state is dropped — past keys become unrecoverable.
//   I3 Post-compromise removal: today `epoch` never changes, so a kicked member
//      keeps decrypting. Here a kick bumps the epoch with a fresh chain key
//      distributed only to remaining members; messages carry `ep`, and a member
//      without that epoch's key cannot read it.
//
// Also carries the I16 key-commitment tag. O(1) per message (two HKDFs);
// redistribution is O(members) only on membership change.
//
// This is the tested reference; index.html's inline group functions
// (getGroupSenderKey/encryptGroupMsg/decryptGroupMsg/distributeSenderKey) should
// be migrated onto it in a browser-validated pass.
// ============================================================================
import { createRatchet } from './ratchet.js';

const arr = (u) => Array.from(u);
const u8 = (a) => (a instanceof Uint8Array ? a : Uint8Array.from(a));

export function createGroup(opts = {}) {
  const R = opts.ratchet || createRatchet(opts);
  const subtle = opts.subtle || globalThis.crypto.subtle;
  const getRandomValues = opts.getRandomValues || ((a) => globalThis.crypto.getRandomValues(a));
  const cfg = { MAX_SKIP: 1000, MAX_GAP: 5000, ...opts };
  const zeros = new Uint8Array(32);

  // A sender key: a chain key + message counter, scoped to an epoch.
  function newSenderKey(epoch = 0) {
    return { chainKey: arr(getRandomValues(new Uint8Array(32))), counter: 0, epoch };
  }

  // Bump epoch with a fresh chain key — call on member removal, then distribute
  // the result to the REMAINING members only (the kicked member never receives it).
  function rotateEpoch(senderKey) {
    return { chainKey: arr(getRandomValues(new Uint8Array(32))), counter: 0, epoch: (senderKey?.epoch ?? 0) + 1 };
  }

  // A receiver copy of someone's sender key (as distributed over the 1:1 channel).
  // Carries the sender's CURRENT counter: a member who receives the key mid-stream
  // starts at the current iteration and therefore cannot reach earlier counters
  // (forward secrecy for pre-distribution messages).
  function receiverFrom(senderKey) {
    return { chainKey: senderKey.chainKey.slice(), counter: senderKey.counter, epoch: senderKey.epoch, skipped: {} };
  }

  async function deriveGroupMsgKey(chainKey) {
    const msgKey = await R.hkdf(u8(chainKey), zeros, 'group-msg', 32);
    const nextChain = await R.hkdf(u8(chainKey), zeros, 'group-chain', 32);
    return { msgKey, nextChain };
  }

  async function frameDecrypt(msgKey, iv, ct) {
    const key = await subtle.importKey('raw', u8(msgKey), { name: 'AES-GCM' }, false, ['decrypt']);
    const padded = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: u8(iv) }, key, u8(ct)));
    return R.unpadAndDecompress(padded);
  }

  // Encrypt a group message; ratchets the sender's chain forward (forward secrecy).
  async function encryptGroupMsg(senderKey, text) {
    const { msgKey, nextChain } = await deriveGroupMsgKey(senderKey.chainKey);
    senderKey.chainKey = arr(nextChain); // advance + drop old chain key
    senderKey.counter++;
    const { iv, ct } = await R.frameEncrypt(msgKey, text);
    const cm = await R.keyCommitment(msgKey);
    return JSON.stringify({ v: 5, g: true, ep: senderKey.epoch, c: senderKey.counter, i: arr(iv), d: arr(ct), cm: arr(cm) });
  }

  // Decrypt with the receiver copy of the sender's key. Returns plaintext, or null
  // on wrong/old epoch, replay, or gap-too-large.
  async function decryptGroupMsg(peerKey, payload) {
    const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!p.g) return null;
    // I3: epoch gate. Old epoch (we've rotated past it) or a future epoch we don't
    // hold a key for → cannot/should not decrypt.
    if (p.ep !== peerKey.epoch) return null;

    // Replay / out-of-order recovery via stored skipped keys.
    if (p.c <= peerKey.counter) {
      const sk = peerKey.skipped?.['c:' + p.c];
      if (sk) {
        delete peerKey.skipped['c:' + p.c];
        if (p.cm && !R.ctEqual(await R.keyCommitment(u8(sk)), p.cm)) return null;
        return frameDecrypt(sk, p.i, p.d);
      }
      return null; // replay
    }

    const gap = p.c - peerKey.counter - 1;
    if (gap > cfg.MAX_GAP) return null; // reject absurd forged jumps (DoS guard)

    if (!peerKey.skipped) peerKey.skipped = {};
    let ck = u8(peerKey.chainKey);
    let targetKey = null;
    for (let n = peerKey.counter + 1; n <= p.c; n++) {
      const { msgKey, nextChain } = await deriveGroupMsgKey(ck);
      if (n === p.c) targetKey = msgKey;
      else if (p.c - n < cfg.MAX_SKIP) peerKey.skipped['c:' + n] = arr(msgKey); // retain recent skipped only
      ck = nextChain;
    }
    peerKey.chainKey = arr(ck); // advance + drop consumed chain (forward secrecy)
    peerKey.counter = p.c;

    // I16 key commitment check before trusting the AEAD.
    if (p.cm && !R.ctEqual(await R.keyCommitment(targetKey), p.cm)) return null;
    return frameDecrypt(targetKey, p.i, p.d);
  }

  return { newSenderKey, rotateEpoch, receiverFrom, encryptGroupMsg, decryptGroupMsg, _cfg: cfg };
}

export default createGroup;
