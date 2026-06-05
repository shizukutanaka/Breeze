// ============================================================================
// Breeze — Double Ratchet crypto core (extracted reference module)
//
// This is a faithful, dependency-injected extraction of the security-critical
// ratchet primitives that currently live inline in index.html (the
// `DOUBLE RATCHET CRYPTO ENGINE` block). It exists so the ratchet math, the
// v4 message framing, and the out-of-order / replay / large-gap handling can be
// unit-tested in isolation (see tests/ratchet.test.js).
//
// The constructions here mirror index.html exactly:
//   - hkdf(ikm, salt, info, len)        : HKDF-SHA256
//   - kdfChain(ck)                      : msgKey=HKDF(ck,0^32,'msg'); next=HKDF(ck,0^32,'chain')
//   - v4 frame                          : padded=[flags:1][len:2][data...], pad→256, AES-256-GCM
//   - skipped-key / replay / MAX_GAP    : ported verbatim from decryptFrom
//
// NOTE: index.html still contains the canonical inline copy. Wiring index.html
// to import this module (eliminating the duplication) is a follow-up step that
// must be validated in a browser; until then, keep changes here in sync with the
// inline implementation. Phase 2 protocol work (authenticated X3DH, group
// ratchet) should land in this module first, under test.
// ============================================================================

const DEFAULTS = {
  HKDF_HASH: 'SHA-256',
  PREFERRED_CURVE: 'P-256', // tests default to P-256 (deterministic across Node versions)
  hasX25519: false,
  MSG_PAD_BOUNDARY: 256,
  IV_BYTES: 12,
  REPLAY_CACHE_SIZE: 2000,
  MAX_SKIP: 100,
  MAX_GAP: 2000,
  skippedKeyTTL: 7 * 24 * 60 * 60 * 1000, // I7: expire retained skipped keys after 7 days (forward secrecy)
  compressMin: Infinity, // disable compression by default for deterministic tests
};

const arr = (u) => Array.from(u);
const u8 = (a) => (a instanceof Uint8Array ? a : Uint8Array.from(a));

export function createRatchet(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const subtle = cfg.subtle || globalThis.crypto.subtle;
  const getRandomValues = cfg.getRandomValues || ((a) => globalThis.crypto.getRandomValues(a));
  const dbg = cfg.dbg || (() => {});
  const now = cfg.now || (() => Date.now());

  // --- HKDF (RFC 5869) ---
  async function hkdf(ikm, salt, info, length) {
    const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await subtle.deriveBits(
      { name: 'HKDF', hash: cfg.HKDF_HASH, salt, info: new TextEncoder().encode(info) }, key, length * 8,
    ));
  }

  // --- KDF chain: advance chain key, derive message key ---
  async function kdfChain(chainKey) {
    const msgKey = await hkdf(chainKey, new Uint8Array(32), 'msg', 32);
    const nextChain = await hkdf(chainKey, new Uint8Array(32), 'chain', 32);
    return { msgKey, nextChain };
  }

  function curveAlgo() {
    return cfg.hasX25519 ? { name: 'X25519' } : { name: 'ECDH', namedCurve: 'P-256' };
  }

  async function genRatchetKey() {
    const algo = cfg.hasX25519 ? { name: cfg.PREFERRED_CURVE } : { name: 'ECDH', namedCurve: 'P-256' };
    const usages = cfg.hasX25519 ? ['deriveBits'] : ['deriveKey', 'deriveBits'];
    const kp = await subtle.generateKey(algo, true, usages);
    return {
      pub: new Uint8Array(await subtle.exportKey('raw', kp.publicKey)),
      privateKey: kp.privateKey,
      publicKey: kp.publicKey,
    };
  }

  async function ecdhBits(privKey, peerPubRaw) {
    const algo = curveAlgo();
    const peerPub = await subtle.importKey('raw', peerPubRaw, algo, false, []);
    const deriveAlgo = cfg.hasX25519 ? { name: 'X25519', public: peerPub } : { name: 'ECDH', public: peerPub };
    return new Uint8Array(await subtle.deriveBits(deriveAlgo, privKey, 256));
  }

  // --- DH ratchet step (mirrors dhRatchetStep) ---
  async function dhRatchetStep(sess, peerPubRaw) {
    const dh = await ecdhBits(sess.ratchetPriv, peerPubRaw);
    let derived = await hkdf(dh, sess.rootKey, 'ratchet', 64);
    sess.rootKey = derived.slice(0, 32);
    sess.recvChainKey = derived.slice(32, 64);
    sess.peerRatchetPub = arr(new Uint8Array(peerPubRaw));
    const newRK = await genRatchetKey();
    const dh2 = await ecdhBits(newRK.privateKey, peerPubRaw);
    derived = await hkdf(dh2, sess.rootKey, 'ratchet', 64);
    sess.rootKey = derived.slice(0, 32);
    sess.sendChainKey = derived.slice(32, 64);
    sess.ratchetPub = arr(new Uint8Array(newRK.pub));
    sess.ratchetPriv = newRK.privateKey;
    sess.sendCounter = 0;
  }

  // --- Message framing (v4): [flags:1][len:2][data], pad→boundary, AES-256-GCM ---
  async function frameEncrypt(msgKey, text) {
    let raw = new TextEncoder().encode(text);
    let compressed = false;
    if (raw.length >= cfg.compressMin && typeof CompressionStream !== 'undefined') {
      try {
        const cs = new CompressionStream('deflate-raw');
        const w = cs.writable.getWriter(); const r = cs.readable.getReader();
        w.write(raw); w.close();
        const chunks = []; let done = false;
        while (!done) { const { value, done: d } = await r.read(); if (value) chunks.push(value); done = d; }
        const deflated = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
        let off = 0; for (const c of chunks) { deflated.set(c, off); off += c.length; }
        if (deflated.length < raw.length * 0.9) { raw = deflated; compressed = true; }
      } catch (e) { dbg(e, 'compress'); }
    }
    const padded = new Uint8Array(Math.ceil((raw.length + 3) / cfg.MSG_PAD_BOUNDARY) * cfg.MSG_PAD_BOUNDARY);
    padded[0] = compressed ? 0x01 : 0x00;
    new DataView(padded.buffer).setUint16(1, raw.length);
    padded.set(raw, 3);
    const iv = getRandomValues(new Uint8Array(cfg.IV_BYTES));
    const key = await subtle.importKey('raw', msgKey, { name: 'AES-GCM' }, false, ['encrypt']);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, key, padded));
    return { iv, ct };
  }

  async function unpadAndDecompress(padded) {
    const flags = padded[0];
    const dataLen = new DataView(padded.buffer, padded.byteOffset).getUint16(1);
    let raw = padded.slice(3, 3 + dataLen);
    if (flags & 0x01) {
      const ds = new DecompressionStream('deflate-raw');
      const w = ds.writable.getWriter(); const r = ds.readable.getReader();
      w.write(raw); w.close();
      const chunks = []; let done = false;
      while (!done) { const { value, done: d } = await r.read(); if (value) chunks.push(value); done = d; }
      const out = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0));
      let off = 0; for (const c of chunks) { out.set(c, off); off += c.length; }
      raw = out;
    }
    return new TextDecoder().decode(raw);
  }

  // --- I16: key commitment (defeats "invisible salamanders" / partitioning) ---
  // AES-GCM is not key-committing: a single ciphertext can be crafted to open
  // validly under two different keys. We bind each message to exactly one key by
  // shipping cm = HKDF(msgKey, 0^32, 'breeze-commit', 32) and verifying it (in
  // constant time) before trusting the AEAD result. Matters most for the group /
  // sealed-sender multi-key paths; also the building block for franking (I17).
  async function keyCommitment(msgKey) {
    return hkdf(u8(msgKey), new Uint8Array(32), 'breeze-commit', 32);
  }
  function ctEqual(a, b) {
    const x = u8(a), y = u8(b);
    if (x.length !== y.length) return false;
    let d = 0;
    for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
    return d === 0;
  }

  // --- Encrypt one message on the send chain (mirrors encryptFor's ratchet body) ---
  async function ratchetEncrypt(sess, text) {
    const { msgKey, nextChain } = await kdfChain(sess.sendChainKey);
    sess.sendChainKey = nextChain;
    sess.sendCounter = (sess.sendCounter || 0) + 1;
    const { iv, ct } = await frameEncrypt(msgKey, text);
    const cm = await keyCommitment(msgKey);
    return JSON.stringify({ v: 4, i: arr(iv), d: arr(ct), rk: sess.ratchetPub, c: sess.sendCounter, cm: arr(cm) });
  }

  // --- Decrypt one message (mirrors decryptFrom's v3/v4 ratchet branch) ---
  // Returns the plaintext string, or null on replay/duplicate/gap-too-large.
  async function ratchetDecrypt(sess, payload) {
    const p = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!((p.v === 3 || p.v === 4) && p.rk)) throw new Error('not a v3/v4 ratchet message');

    // I7: time-expire stale skipped message keys. Retaining them indefinitely is
    // both a forward-secrecy leak (old keys sitting in storage) and a DoS amplifier.
    if (sess.skippedKeys) {
      const cutoff = now() - cfg.skippedKeyTTL;
      for (const k of Object.keys(sess.skippedKeys)) {
        if ((sess.skippedKeys[k]?.t ?? 0) < cutoff) delete sess.skippedKeys[k];
      }
    }

    const peerRK = new Uint8Array(p.rk);
    if (!sess.peerRatchetPub || JSON.stringify(p.rk) !== JSON.stringify(sess.peerRatchetPub)) {
      if (!sess.ratchetPriv) {
        const rk = await genRatchetKey();
        sess.ratchetPriv = rk.privateKey;
        sess.ratchetPub = arr(new Uint8Array(rk.pub));
      }
      await dhRatchetStep(sess, peerRK);
    }

    // Replay check (with skipped-key recovery for out-of-order delivery)
    if (p.c <= sess.recvCounter && sess.recvCounter > 0) {
      const skKey = 'p:' + p.c;
      if (sess.skippedKeys?.[skKey]) {
        const mkData = sess.skippedKeys[skKey].k;
        delete sess.skippedKeys[skKey];
        if (p.cm && !ctEqual(await keyCommitment(mkData), p.cm)) { dbg(null, 'key commitment mismatch'); return null; }
        const key = await subtle.importKey('raw', u8(mkData), { name: 'AES-GCM' }, false, ['decrypt']);
        const padded = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: u8(p.i) }, key, u8(p.d)));
        return unpadAndDecompress(padded);
      }
      dbg(null, 'replay rejected');
      return null;
    }

    const msgId = arr(u8(p.d).slice(0, 8)).join('');
    if (sess.seenMsgIds?.includes(msgId)) { dbg(null, 'duplicate rejected'); return null; }

    // Store skipped message keys for out-of-order delivery (Signal spec §3.4)
    if (p.c > sess.recvCounter + 1) {
      const gap = p.c - sess.recvCounter - 1;
      // Reject absurd gaps rather than desyncing the chain (regression: the advance
      // was previously capped at MAX_SKIP while recvCounter jumped to p.c, permanently
      // misaligning the receive chain so every later message failed).
      if (gap > cfg.MAX_GAP) { dbg(null, 'ratchet gap too large (' + gap + '), rejecting'); return null; }
      if (!sess.skippedKeys) sess.skippedKeys = {};
      let tmpChain = sess.recvChainKey;
      for (let i = 0; i < gap; i++) {
        const { msgKey: skMk, nextChain: skNext } = await kdfChain(tmpChain);
        const skIdx = sess.recvCounter + 1 + i;
        if (gap - i <= cfg.MAX_SKIP) sess.skippedKeys['p:' + skIdx] = { k: arr(skMk), t: now() };
        tmpChain = skNext;
      }
      sess.recvChainKey = tmpChain;
      const skKeys = Object.keys(sess.skippedKeys);
      if (skKeys.length > cfg.MAX_SKIP * 2) {
        for (const k of skKeys.slice(0, skKeys.length - cfg.MAX_SKIP)) delete sess.skippedKeys[k];
      }
    }

    const { msgKey, nextChain } = await kdfChain(sess.recvChainKey);
    // I16: verify key commitment before advancing dedup state / trusting the AEAD.
    if (p.cm && !ctEqual(await keyCommitment(msgKey), p.cm)) { dbg(null, 'key commitment mismatch'); return null; }
    sess.recvChainKey = nextChain;
    sess.recvCounter = p.c;
    if (!sess.seenMsgIds) sess.seenMsgIds = [];
    sess.seenMsgIds.push(msgId);
    if (sess.seenMsgIds.length > cfg.REPLAY_CACHE_SIZE) sess.seenMsgIds = sess.seenMsgIds.slice(-cfg.REPLAY_CACHE_SIZE);

    const key = await subtle.importKey('raw', msgKey, { name: 'AES-GCM' }, false, ['decrypt']);
    const padded = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: u8(p.i) }, key, u8(p.d)));
    return unpadAndDecompress(padded);
  }

  // Test/utility: build a pair of sessions that share an initial symmetric chain,
  // so the send/receive ratchet can be exercised without the DH bootstrap. The
  // shared `rk` is fixed so ratchetDecrypt does not trigger a DH ratchet step.
  function pairFromSharedChain(chainKey, sharedRk = [1, 2, 3]) {
    const sender = {
      sendChainKey: u8(chainKey).slice(), sendCounter: 0,
      ratchetPub: sharedRk, recvCounter: 0,
    };
    const receiver = {
      recvChainKey: u8(chainKey).slice(), recvCounter: 0,
      peerRatchetPub: sharedRk, seenMsgIds: [], skippedKeys: {},
    };
    return { sender, receiver };
  }

  return {
    hkdf, kdfChain, genRatchetKey, ecdhBits, dhRatchetStep,
    frameEncrypt, unpadAndDecompress, ratchetEncrypt, ratchetDecrypt,
    keyCommitment, ctEqual, pairFromSharedChain, _cfg: cfg,
  };
}

export default createRatchet;
