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
// N2 two-layer authentication (partial AFKS):
//   Each message carries TWO Ed25519 signatures:
//     es — epoch signature: long-lived per-epoch key signs (content + spk + nsk).
//          Lets the receiver authenticate the per-message key without needing to
//          track a signing-key-ratchet chain, so out-of-order delivery works.
//     s  — per-message signature: a fresh keypair used once then discarded.
//          Forging requires *both* keys: an attacker who leaks only the per-message
//          key cannot fabricate es; an attacker who leaks only the epoch key cannot
//          fabricate s without the ephemeral private key (already deleted).
//   The epoch signing key (signPriv / signPub) plays the same role as before;
//   spk and nsk carry the per-message public keys and are included in signed bytes.
//
// This is the tested reference; index.html's inline group functions
// (getGroupSenderKey/encryptGroupMsg/decryptGroupMsg/distributeSenderKey) should
// be migrated onto it in a browser-validated pass.
// ============================================================================
import { createRatchet } from './ratchet.js';

const arr = (u) => Array.from(u);
const u8 = (a) => (a instanceof Uint8Array ? a : Uint8Array.from(a));
const concatBytes = (parts) => {
  const len = parts.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(len); let o = 0;
  for (const a of parts) { out.set(a, o); o += a.length; }
  return out;
};

export function createGroup(opts = {}) {
  const R = opts.ratchet || createRatchet(opts);
  const subtle = opts.subtle || globalThis.crypto.subtle;
  const getRandomValues = opts.getRandomValues || ((a) => globalThis.crypto.getRandomValues(a));
  const cfg = { MAX_SKIP: 1000, MAX_GAP: 5000, skippedKeyTTL: 7 * 24 * 60 * 60 * 1000, ...opts };
  const now = opts.now || (() => Date.now());
  const zeros = new Uint8Array(32);

  // --- N2: two-layer sender authentication ---
  // - Epoch key (signPriv / signPub): stable within an epoch, distributed over the
  //   1:1 channel. Used to sign `es`, which covers the per-message public key so
  //   the receiver can authenticate it without in-order state.
  // - Per-message key (msgSignKey / nextMsgSignKey): fresh for every message; the
  //   private half is discarded after signing. Used to sign `s` (content auth).
  //   Both `es` and `s` must verify for a message to be accepted, so an attacker
  //   needs both keys simultaneously to forge — limiting the damage of either leak.
  async function genSign() {
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    return { signPriv: kp.privateKey, signPub: arr(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))) };
  }
  async function genMsgSignKey() {
    const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    return {
      priv: kp.privateKey,
      pub: arr(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))),
    };
  }

  // Canonical signed bytes — covers all mutable fields plus the per-message public
  // keys so neither content nor key substitution can go undetected.
  // Format: iv ‖ ct ‖ cm ‖ epoch(u32be) ‖ counter(u32be) ‖ spk ‖ nsk
  function signedBytes(p) {
    const meta = new Uint8Array(8);
    const dv = new DataView(meta.buffer);
    dv.setUint32(0, p.ep >>> 0); dv.setUint32(4, p.c >>> 0);
    const spkB = p.spk ? u8(p.spk) : new Uint8Array(0);
    const nskB = p.nsk ? u8(p.nsk) : new Uint8Array(0);
    return concatBytes([u8(p.i), u8(p.d), u8(p.cm || []), meta, spkB, nskB]);
  }

  // Verify the epoch signature es (covers content + spk + nsk).
  async function verifyEpochSig(epochPubRaw, p) {
    try {
      if (!p.es) return false;
      const pub = await subtle.importKey('raw', u8(epochPubRaw), { name: 'Ed25519' }, false, ['verify']);
      return await subtle.verify({ name: 'Ed25519' }, pub, u8(p.es), signedBytes(p));
    } catch { return false; }
  }
  // Verify the per-message signature s with the included spk.
  async function verifyMsgSig(p) {
    try {
      if (!p.s || !p.spk) return false;
      const pub = await subtle.importKey('raw', u8(p.spk), { name: 'Ed25519' }, false, ['verify']);
      return await subtle.verify({ name: 'Ed25519' }, pub, u8(p.s), signedBytes(p));
    } catch { return false; }
  }

  // A sender key: a chain key + message counter + two-layer signing state, epoch-scoped.
  async function newSenderKey(epoch = 0) {
    const epochKey  = await genSign();
    const msgKey0   = await genMsgSignKey();
    const msgKey1   = await genMsgSignKey();
    return {
      chainKey: arr(getRandomValues(new Uint8Array(32))), counter: 0, epoch,
      signPriv: epochKey.signPriv, signPub: epochKey.signPub,
      msgSignKey: msgKey0, nextMsgSignKey: msgKey1,
    };
  }

  // Bump epoch with fresh chain key and fresh signing keys — call on member removal,
  // then distribute to the REMAINING members only (kicked member never receives it).
  async function rotateEpoch(senderKey) {
    const epochKey = await genSign();
    const msgKey0  = await genMsgSignKey();
    const msgKey1  = await genMsgSignKey();
    return {
      chainKey: arr(getRandomValues(new Uint8Array(32))), counter: 0,
      epoch: (senderKey?.epoch ?? 0) + 1,
      signPriv: epochKey.signPriv, signPub: epochKey.signPub,
      msgSignKey: msgKey0, nextMsgSignKey: msgKey1,
    };
  }

  // Receiver copy of the sender's key (distributed over the authenticated 1:1 channel).
  // Carries the sender's CURRENT counter (mid-stream joiners can't reach earlier
  // counters — forward secrecy) and the epoch signing PUBLIC key only.
  function receiverFrom(senderKey) {
    return {
      chainKey: senderKey.chainKey.slice(), counter: senderKey.counter, epoch: senderKey.epoch,
      signPub: senderKey.signPub, skipped: {},
    };
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
    const env = {
      v: 5, g: true, ep: senderKey.epoch, c: senderKey.counter,
      i: arr(iv), d: arr(ct), cm: arr(cm),
    };

    // N2: two-layer signing.
    if (senderKey.msgSignKey && senderKey.signPriv) {
      const spk = senderKey.msgSignKey.pub;
      const nsk = senderKey.nextMsgSignKey.pub;
      env.spk = spk;
      env.nsk = nsk;
      const sb  = signedBytes(env); // covers iv, ct, cm, ep, c, spk, nsk
      env.s  = arr(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, senderKey.msgSignKey.priv, sb)));
      env.es = arr(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, senderKey.signPriv, sb)));
      // Advance per-message signing key: discard current, promote next, pre-generate new next.
      senderKey.msgSignKey     = senderKey.nextMsgSignKey;
      senderKey.nextMsgSignKey = await genMsgSignKey();
    } else if (senderKey.signPriv) {
      // Fallback: epoch-only signature (no per-message key available — shouldn't happen
      // for new sender keys, but kept for safety during transition).
      env.s = arr(new Uint8Array(await subtle.sign({ name: 'Ed25519' }, senderKey.signPriv, signedBytes(env))));
    }
    return JSON.stringify(env);
  }

  // Decrypt with the receiver copy of the sender's key. Returns plaintext, or null
  // on wrong/old epoch, replay, or gap-too-large.
  async function decryptGroupMsg(peerKey, payload) {
    // Group messages arrive from many peers via the relay; a malformed or
    // non-group payload must yield null (the documented contract), never throw.
    let p;
    try { p = typeof payload === 'string' ? JSON.parse(payload) : payload; }
    catch { return null; }
    if (!p || typeof p !== 'object' || !p.g) return null;
    // Reject non-numeric epoch/counter early: without them the ratchet math below
    // would derive from a null key and throw (the no-signPub path skips the
    // signature gate that would otherwise catch this).
    if (typeof p.ep !== 'number' || typeof p.c !== 'number') return null;
    // I3: epoch gate. Old epoch (we've rotated past it) or a future epoch we don't
    // hold a key for → cannot/should not decrypt.
    if (p.ep !== peerKey.epoch) return null;

    // I7 (group): time-expire stale skipped message keys — retaining them indefinitely
    // is a forward-secrecy leak (old symmetric keys in memory) and a DoS amplifier.
    if (peerKey.skipped) {
      const cutoff = now() - cfg.skippedKeyTTL;
      for (const k of Object.keys(peerKey.skipped)) {
        if ((peerKey.skipped[k]?.t ?? 0) < cutoff) delete peerKey.skipped[k];
      }
    }

    // N2: verify signatures before any key-ratchet work (DoS guard + auth check).
    // Two-layer path: verify epoch sig (es) then per-message sig (s with spk).
    // Epoch sig authenticates spk so out-of-order delivery works without state.
    // Legacy path (no es/spk): fall back to single-sig with epoch key (s only).
    if (peerKey.signPub) {
      if (p.es !== undefined) {
        // Two-layer mode: both must pass.
        if (!(await verifyEpochSig(peerKey.signPub, p))) return null;
        if (!(await verifyMsgSig(p))) return null;
      } else {
        // Legacy single-sig mode (old messages without per-message keys).
        if (!p.s) return null;
        const pub = await subtle.importKey('raw', u8(peerKey.signPub), { name: 'Ed25519' }, false, ['verify']);
        if (!(await subtle.verify({ name: 'Ed25519' }, pub, u8(p.s), signedBytes(p)))) return null;
      }
    }

    // Replay / out-of-order recovery via stored skipped keys.
    if (p.c <= peerKey.counter) {
      const sk = peerKey.skipped?.['c:' + p.c];
      if (sk) {
        const skBytes = sk.k !== undefined ? u8(sk.k) : u8(sk);
        if (p.cm && !R.ctEqual(await R.keyCommitment(skBytes), p.cm)) return null;
        let result;
        try { result = await frameDecrypt(skBytes, p.i, p.d); } catch { return null; }
        // Delete the consumed skipped key only after successful decrypt.
        delete peerKey.skipped['c:' + p.c];
        return result;
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
      // Retain recent skipped keys with timestamp for TTL expiry (I7-group).
      else if (p.c - n < cfg.MAX_SKIP) peerKey.skipped['c:' + n] = { k: arr(msgKey), t: now() };
      ck = nextChain;
    }

    // I16 key commitment check before trusting the AEAD.
    if (p.cm && !R.ctEqual(await R.keyCommitment(targetKey), p.cm)) return null;
    let result;
    try { result = await frameDecrypt(targetKey, p.i, p.d); } catch { return null; }
    // Advance chain state only after successful decrypt — injected messages whose
    // ciphertext fails the AES-GCM auth tag must not desync the sender-key state.
    peerKey.chainKey = arr(ck);
    peerKey.counter = p.c;
    return result;
  }

  // --- Sender-key distribution envelope --------------------------------------
  // When a member creates or rotates a sender key, it hands the RECEIVE half (current
  // chain key + counter + epoch + epoch-signature PUBLIC key) to each other member over
  // the authenticated 1:1 channel. This serializes exactly that half — never the signing
  // PRIVATE key, never the per-message signing keys — into a typed, versioned envelope,
  // and parses it back into a receiver key usable by decryptGroupMsg. Single source of
  // truth for the browser port's `distributeSenderKey` wire format (INTEGRATION.md §4).
  //
  // Shape: { v:5, t:'skd', ep:epoch, c:counter, ck:[chainKey], spk:[epochSignPub] }
  function buildSenderKeyDistribution(senderKey) {
    if (!senderKey || senderKey.chainKey == null || senderKey.signPub == null) {
      throw new Error('buildSenderKeyDistribution: senderKey missing chainKey/signPub');
    }
    return JSON.stringify({
      v: 5, t: 'skd',
      ep: senderKey.epoch ?? 0,
      c: senderKey.counter ?? 0,
      ck: arr(u8(senderKey.chainKey)),
      spk: arr(u8(senderKey.signPub)),
    });
  }

  // Parse a distribution envelope into a fresh receiver key (same shape as
  // receiverFrom). Returns null on malformed / non-skd input (never throws — the
  // payload arrives over the untrusted relay, even if E2E-encrypted to us).
  function parseSenderKeyDistribution(payload) {
    let p;
    try { p = typeof payload === 'string' ? JSON.parse(payload) : payload; }
    catch { return null; }
    if (!p || typeof p !== 'object' || p.v !== 5 || p.t !== 'skd') return null;
    if (!Array.isArray(p.ck) || !Array.isArray(p.spk)) return null;
    if (typeof p.ep !== 'number' || typeof p.c !== 'number') return null;
    return { chainKey: p.ck.slice(), counter: p.c, epoch: p.ep, signPub: p.spk.slice(), skipped: {} };
  }

  return {
    newSenderKey, rotateEpoch, receiverFrom, encryptGroupMsg, decryptGroupMsg,
    buildSenderKeyDistribution, parseSenderKeyDistribution, _cfg: cfg,
  };
}

export default createGroup;
