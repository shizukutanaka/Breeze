import { describe, it, expect } from 'vitest';
import { createRatchet, wrapKeyAtRest, unwrapKeyAtRest } from '../src/crypto/ratchet.js';

const R = createRatchet(); // Node WebCrypto, P-256 default
const randomChain = () => crypto.getRandomValues(new Uint8Array(32));

describe('HKDF + KDF chain primitives', () => {
  it('hkdf is deterministic and length-correct', async () => {
    const ikm = new Uint8Array(32).fill(7);
    const a = await R.hkdf(ikm, new Uint8Array(32), 'msg', 32);
    const b = await R.hkdf(ikm, new Uint8Array(32), 'msg', 32);
    expect(a.length).toBe(32);
    expect([...a]).toEqual([...b]);
  });

  it('kdfChain derives distinct msg/next keys and is domain-separated', async () => {
    const ck = randomChain();
    const { msgKey, nextChain } = await R.kdfChain(ck);
    expect(msgKey.length).toBe(32);
    expect(nextChain.length).toBe(32);
    expect([...msgKey]).not.toEqual([...nextChain]);
    // Advancing twice produces a different chain key each step.
    const step2 = await R.kdfChain(nextChain);
    expect([...step2.nextChain]).not.toEqual([...nextChain]);
  });
});

describe('symmetric ratchet round-trip', () => {
  it('encrypts and decrypts a sequence of messages in order', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const msgs = ['hello', 'how are you?', '日本語のメッセージ 🌸', ''];
    for (const m of msgs) {
      const ct = await R.ratchetEncrypt(sender, m);
      const pt = await R.ratchetDecrypt(receiver, ct);
      expect(pt).toBe(m);
    }
    expect(receiver.recvCounter).toBe(msgs.length);
  });

  it('round-trips a large message with compression enabled', async () => {
    const Rc = createRatchet({ compressMin: 64 });
    const { sender, receiver } = Rc.pairFromSharedChain(randomChain());
    const big = 'A'.repeat(5000); // highly compressible
    const ct = await Rc.ratchetEncrypt(sender, big);
    expect(JSON.parse(ct).d.length).toBeLessThan(5000); // actually compressed
    expect(await Rc.ratchetDecrypt(receiver, ct)).toBe(big);
  });
});

describe('out-of-order & skipped keys', () => {
  it('decrypts messages delivered out of order (1,3,2)', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'one');
    const c2 = await R.ratchetEncrypt(sender, 'two');
    const c3 = await R.ratchetEncrypt(sender, 'three');
    expect(await R.ratchetDecrypt(receiver, c1)).toBe('one');
    expect(await R.ratchetDecrypt(receiver, c3)).toBe('three'); // skips #2, stores its key
    expect(await R.ratchetDecrypt(receiver, c2)).toBe('two');   // recovered from skipped key
  });

  it('recovers across a large-but-bounded gap (regression for chain desync)', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    // Burn 150 messages on the sender, deliver only #1 then #151.
    const first = await R.ratchetEncrypt(sender, 'first');
    let last;
    for (let i = 0; i < 150; i++) last = await R.ratchetEncrypt(sender, 'm' + i);
    expect(await R.ratchetDecrypt(receiver, first)).toBe('first');
    // #151 jumps the counter by 150; chain must stay aligned (not desync).
    expect(await R.ratchetDecrypt(receiver, last)).toBe('m149');
    // A subsequent in-order message still decrypts (proves recvChainKey is aligned).
    const next = await R.ratchetEncrypt(sender, 'after');
    expect(await R.ratchetDecrypt(receiver, next)).toBe('after');
  });

  it('expires retained skipped keys after the TTL (forward secrecy, I7)', async () => {
    let clock = 1000;
    const Rt = createRatchet({ skippedKeyTTL: 5000, now: () => clock });
    const { sender, receiver } = Rt.pairFromSharedChain(randomChain());
    const c1 = await Rt.ratchetEncrypt(sender, 'one');
    const c2 = await Rt.ratchetEncrypt(sender, 'two');
    const c3 = await Rt.ratchetEncrypt(sender, 'three');
    expect(await Rt.ratchetDecrypt(receiver, c1)).toBe('one');
    expect(await Rt.ratchetDecrypt(receiver, c3)).toBe('three'); // stores skipped key for #2 at t=1000
    clock += 10000; // advance well past the 5s TTL
    expect(await Rt.ratchetDecrypt(receiver, c2)).toBe(null); // expired → unrecoverable
  });

  it('still recovers a skipped key that arrives within the TTL', async () => {
    let clock = 1000;
    const Rt = createRatchet({ skippedKeyTTL: 60000, now: () => clock });
    const { sender, receiver } = Rt.pairFromSharedChain(randomChain());
    const c1 = await Rt.ratchetEncrypt(sender, 'one');
    const c2 = await Rt.ratchetEncrypt(sender, 'two');
    expect(await Rt.ratchetDecrypt(receiver, c2)).toBe('two'); // skips #1
    clock += 1000; // within TTL
    expect(await Rt.ratchetDecrypt(receiver, c1)).toBe('one'); // recovered
  });

  it('rejects an absurd forged gap (> MAX_GAP) without advancing the chain', async () => {
    const Rsmall = createRatchet({ MAX_GAP: 50 });
    const { sender, receiver } = Rsmall.pairFromSharedChain(randomChain());
    const c1 = await Rsmall.ratchetEncrypt(sender, 'one');
    expect(await Rsmall.ratchetDecrypt(receiver, c1)).toBe('one');
    // Forge a message claiming counter far beyond MAX_GAP.
    const forged = JSON.parse(await Rsmall.ratchetEncrypt(sender, 'x'));
    forged.c = 5000;
    expect(await Rsmall.ratchetDecrypt(receiver, forged)).toBe(null);
    // Chain not desynced: the legitimate next message still works.
    const c2 = await Rsmall.ratchetEncrypt(sender, 'two'); // sender counter is now 3
    // align receiver expectation: counter 3 is a gap of 1 from recvCounter(1)
    expect(await Rsmall.ratchetDecrypt(receiver, c2)).toBe('two');
  });

  it('MAX_SKIP storage bound: keys older than MAX_SKIP positions are dropped (forward secrecy)', async () => {
    // With MAX_SKIP=5 and a gap of 10, only the last 5 skipped keys are retained.
    // Keys for earlier positions are intentionally discarded for forward secrecy.
    const Rs = createRatchet({ MAX_SKIP: 5, MAX_GAP: 200 });
    const { sender, receiver } = Rs.pairFromSharedChain(randomChain());
    const msgs = [];
    for (let i = 0; i < 11; i++) msgs.push(await Rs.ratchetEncrypt(sender, `msg${i + 1}`));
    // Deliver only message #11 (counter=11): gap of 10, stores keys for #6–#10 only.
    expect(await Rs.ratchetDecrypt(receiver, msgs[10])).toBe('msg11');
    // Messages #6–#10 are recoverable from skipped keys.
    for (let i = 5; i < 10; i++) {
      expect(await Rs.ratchetDecrypt(receiver, msgs[i])).toBe(`msg${i + 1}`);
    }
    // Messages #1–#5 are unrecoverable (forward-secrecy drop, never stored).
    for (let i = 0; i < 5; i++) {
      expect(await Rs.ratchetDecrypt(receiver, msgs[i])).toBe(null);
    }
  });

  it('consumed skipped key cannot be replayed (key deleted after first use)', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'one');
    const c2 = await R.ratchetEncrypt(sender, 'two');
    const c3 = await R.ratchetEncrypt(sender, 'three');
    expect(await R.ratchetDecrypt(receiver, c1)).toBe('one');
    expect(await R.ratchetDecrypt(receiver, c3)).toBe('three'); // stores skipped key for #2
    expect(await R.ratchetDecrypt(receiver, c2)).toBe('two');   // consumes skipped key #2
    // Second delivery of #2: key is deleted → must not decrypt again.
    expect(await R.ratchetDecrypt(receiver, c2)).toBe(null);
  });
});

describe('AEAD auth failure does not desync chain (injected-message resistance)', () => {
  it('returns null and preserves chain state when ciphertext auth fails', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const legitMsg = await R.ratchetEncrypt(sender, 'real message');
    // Craft an injection: same counter and ratchetPub, but corrupted ciphertext.
    const crafted = JSON.parse(legitMsg);
    crafted.d[0] ^= 0xff; // flip a byte → AES-GCM auth tag mismatch
    delete crafted.cm;    // strip commitment so the cm-check doesn't catch it first
    // Injected crafted message must return null, NOT throw or advance chain.
    expect(await R.ratchetDecrypt(receiver, crafted)).toBe(null);
    // The legitimate message must still decrypt correctly (chain not desynced).
    expect(await R.ratchetDecrypt(receiver, legitMsg)).toBe('real message');
  });

  it('a forged message with a counter GAP does not desync the chain (staged-commit regression)', async () => {
    // Regression: the skip-ahead block used to mutate recvChainKey/skippedKeys BEFORE
    // the AEAD check, so an injected message with a valid counter gap but corrupted
    // ciphertext advanced the receive chain while recvCounter stayed put — permanently
    // desyncing the session (one-packet DoS). State must only advance after a real decrypt.
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'one');
    const c2 = await R.ratchetEncrypt(sender, 'two');
    const c3 = await R.ratchetEncrypt(sender, 'three');
    const c4 = await R.ratchetEncrypt(sender, 'four');
    expect(await R.ratchetDecrypt(receiver, c1)).toBe('one');
    expect(await R.ratchetDecrypt(receiver, c2)).toBe('two'); // recvCounter = 2

    // Forge a message claiming counter 4 (gap of 1 over recvCounter+1=3) with corrupted
    // ciphertext + stripped commitment so only the AEAD tag rejects it.
    const forged = JSON.parse(c4);
    forged.d[0] ^= 0xff;
    delete forged.cm;
    expect(await R.ratchetDecrypt(receiver, forged)).toBe(null);

    // The chain must NOT be desynced: the legit gap-filling message #3 still decrypts,
    // then #4. With the pre-fix code, recvChainKey had jumped ahead and these returned null.
    expect(await R.ratchetDecrypt(receiver, c3)).toBe('three');
    expect(await R.ratchetDecrypt(receiver, c4)).toBe('four');
  });
});

describe('replay & duplicate protection', () => {
  it('rejects a replayed counter that has already advanced', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'one');
    const c2 = await R.ratchetEncrypt(sender, 'two');
    expect(await R.ratchetDecrypt(receiver, c1)).toBe('one');
    expect(await R.ratchetDecrypt(receiver, c2)).toBe('two');
    // Replaying #1 (counter <= recvCounter, no skipped key) is rejected.
    expect(await R.ratchetDecrypt(receiver, c1)).toBe(null);
  });

  it('rejects a duplicate of the most recent message (same msgId)', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'one');
    expect(await R.ratchetDecrypt(receiver, c1)).toBe('one');
    // Exact duplicate delivery: counter equals recvCounter -> replay path -> null.
    expect(await R.ratchetDecrypt(receiver, c1)).toBe(null);
  });

  it('rejects a NaN counter that would corrupt sess.recvCounter (relay-tamper guard)', async () => {
    // The counter `c` is not inside the AES-GCM AEAD, so a relay can change it without
    // invalidating the auth tag.  A NaN counter bypasses both the replay check
    // (p.c <= NaN is false) and the gap guard (p.c > NaN+1 is false), then writes
    // NaN into sess.recvCounter — permanently breaking future replay detection.
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'legit');
    const tampered = { ...JSON.parse(c1), c: NaN };
    expect(await R.ratchetDecrypt(receiver, tampered)).toBe(null);
    // Session must not be corrupted — recvCounter stays at 0.
    expect(receiver.recvCounter).toBe(0);
    // The original message can still decrypt.
    expect(await R.ratchetDecrypt(receiver, c1)).toBe('legit');
  });

  it('rejects an Infinity counter (same relay-tamper guard)', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'legit');
    const tampered = { ...JSON.parse(c1), c: Infinity };
    expect(await R.ratchetDecrypt(receiver, tampered)).toBe(null);
    expect(receiver.recvCounter).toBe(0);
  });

  it('rejects a negative counter', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'legit');
    const tampered = { ...JSON.parse(c1), c: -1 };
    expect(await R.ratchetDecrypt(receiver, tampered)).toBe(null);
  });

  it('rejects c=0 (session-desync guard: c=0 advances recvChainKey without advancing recvCounter)', async () => {
    // Senders always start at c=1; c=0 is never legitimate. A c=0 message passes
    // the replay check (recvCounter>0 guard exempts the initial state) and the gap
    // check (0 > 1 is false), then derives msgKey from the same chain position as
    // the real c=1 — consuming recvChainKey. If it authenticated, recvCounter would
    // stay 0 while recvChainKey advanced, making the real c=1 derive the wrong key.
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const c1 = await R.ratchetEncrypt(sender, 'legit');
    const tampered = { ...JSON.parse(c1), c: 0 };
    expect(await R.ratchetDecrypt(receiver, tampered)).toBe(null);
    expect(receiver.recvCounter).toBe(0); // session not corrupted
    // The real c=1 must still decrypt correctly.
    expect(await R.ratchetDecrypt(receiver, c1)).toBe('legit');
  });
});

describe('key commitment (I16 — anti invisible-salamander)', () => {
  it('emits a commitment and round-trips when it matches', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const obj = JSON.parse(await R.ratchetEncrypt(sender, 'committed hi'));
    expect(obj.cm).toBeDefined();
    expect(obj.cm.length).toBe(32);
    expect(await R.ratchetDecrypt(receiver, obj)).toBe('committed hi');
  });

  it('rejects a message whose commitment does not match the key', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const obj = JSON.parse(await R.ratchetEncrypt(sender, 'secret'));
    obj.cm[0] ^= 0xff; // commitment no longer matches the derived message key
    expect(await R.ratchetDecrypt(receiver, obj)).toBe(null);
  });

  it('still decrypts legacy messages with no commitment field (back-compat)', async () => {
    const { sender, receiver } = R.pairFromSharedChain(randomChain());
    const obj = JSON.parse(await R.ratchetEncrypt(sender, 'legacy'));
    delete obj.cm;
    expect(await R.ratchetDecrypt(receiver, obj)).toBe('legacy');
  });

  it('commitment is a deterministic function of the key', async () => {
    const mk = crypto.getRandomValues(new Uint8Array(32));
    const a = await R.keyCommitment(mk);
    const b = await R.keyCommitment(mk);
    expect(R.ctEqual(a, b)).toBe(true);
    expect(R.ctEqual(a, await R.keyCommitment(crypto.getRandomValues(new Uint8Array(32))))).toBe(false);
  });
});

describe('DH ratchet primitives', () => {
  it('produces a shared secret via ECDH (both directions agree)', async () => {
    const a = await R.genRatchetKey();
    const b = await R.genRatchetKey();
    const ab = await R.ecdhBits(a.privateKey, b.pub);
    const ba = await R.ecdhBits(b.privateKey, a.pub);
    expect([...ab]).toEqual([...ba]);
  });

  it('dhRatchetStep evolves the root key and resets the send counter', async () => {
    const a = await R.genRatchetKey();
    const peer = await R.genRatchetKey();
    const sess = {
      rootKey: new Uint8Array(32).fill(9),
      ratchetPriv: a.privateKey, ratchetPub: [...a.pub], sendCounter: 5,
    };
    const before = [...sess.rootKey];
    await R.dhRatchetStep(sess, peer.pub);
    expect([...sess.rootKey]).not.toEqual(before);
    expect(sess.sendCounter).toBe(0);
    expect(sess.recvChainKey?.length).toBe(32);
    expect(sess.sendChainKey?.length).toBe(32);
  });

  it('N1 regression: dhRatchetStep also resets recvCounter (Nr) to 0', async () => {
    // Bug in index.html: only sendCounter (Ns) was reset; recvCounter (Nr) was not,
    // so the first message on a new receiving chain (counter=1) could be misclassified
    // as a replay of the last message from the old chain. The module is fixed; this
    // test guards against regression.
    const a = await R.genRatchetKey();
    const peer = await R.genRatchetKey();
    const sess = {
      rootKey: new Uint8Array(32).fill(9),
      ratchetPriv: a.privateKey, ratchetPub: [...a.pub],
      sendCounter: 5, recvCounter: 42, // simulates a chain that's been active
    };
    await R.dhRatchetStep(sess, peer.pub);
    expect(sess.sendCounter).toBe(0); // Ns reset
    expect(sess.recvCounter).toBe(0); // Nr reset — the N1 fix
  });
});

describe('ratchetDecrypt error handling', () => {
  it('throws for a non-v3/v4 message (distinct from null return)', async () => {
    const { receiver } = R.pairFromSharedChain(randomChain());
    await expect(R.ratchetDecrypt(receiver, JSON.stringify({ v: 2, i: [1], d: [2], rk: [3] }))).rejects.toThrow('not a v3/v4 ratchet message');
    await expect(R.ratchetDecrypt(receiver, JSON.stringify({ v: 4, d: [2], c: 1 }))).rejects.toThrow('not a v3/v4 ratchet message'); // missing rk
  });

  // Item 82: ratchetDecrypt's unpadAndDecompress call must be in try/catch.
  // DecompressionStream rejects on bad deflate bytes; without the guard the exception
  // propagates AFTER session state (counter, chain key) has already been committed.
  // We verify the contract via a mock that makes getReader() throw synchronously — this
  // causes unpadAndDecompress (async fn) to reject cleanly without touching Node's zlib
  // internals, which fire a secondary InflateRaw error event that Vitest counts as an
  // unhandled rejection even when the primary rejection is correctly asserted.
  it('unpadAndDecompress rejects on decompressor failure (try/catch in ratchetDecrypt is load-bearing)', async () => {
    const OrigDS = globalThis.DecompressionStream;
    globalThis.DecompressionStream = class {
      constructor() {
        this.writable = { getWriter: () => ({ write: () => {}, close: () => {} }) };
        this.readable = { getReader: () => { throw new Error('mock: decompression error'); } };
      }
    };
    const compressedFlag = new Uint8Array(256);
    compressedFlag[0] = 0x01; // compressed flag — routes through DecompressionStream
    new DataView(compressedFlag.buffer).setUint16(1, 5);
    compressedFlag.set([0x00, 0x01, 0x02, 0x03, 0x04], 3);
    try {
      await expect(R.unpadAndDecompress(compressedFlag)).rejects.toBeDefined();
    } finally {
      globalThis.DecompressionStream = OrigDS;
    }
    // Genuine: uncompressed path (flag=0) never touches DecompressionStream.
    const okPadded = new Uint8Array(256);
    okPadded[0] = 0x00; // no compression
    new DataView(okPadded.buffer).setUint16(1, 5);
    okPadded.set([0x68, 0x65, 0x6c, 0x6c, 0x6f], 3); // 'hello'
    expect(await R.unpadAndDecompress(okPadded)).toBe('hello');
  });
});

describe('skipped-key cache pruning (MAX_SKIP * 2 eviction)', () => {
  it('prunes oversized skippedKeys map, keeping the newest MAX_SKIP entries', async () => {
    const Rs = createRatchet({ MAX_SKIP: 5, MAX_GAP: 2000 });
    const { sender, receiver } = Rs.pairFromSharedChain(randomChain());
    // Encrypt enough messages to fill the skipped-key cache beyond MAX_SKIP*2.
    // Deliver only the last one so the gap walk fills skipped keys.
    const msgs = [];
    for (let i = 0; i < 12; i++) msgs.push(await Rs.ratchetEncrypt(sender, `m${i}`));
    // Deliver msg #12 (index 11): gap = 11, stores keys #7–#11 (MAX_SKIP=5 → gap-i < 5)
    expect(await Rs.ratchetDecrypt(receiver, msgs[11])).toBe('m11');
    // Now fill the cache to trigger the prune. We need skippedKeys.length > MAX_SKIP*2=10.
    // Reset the receiver to simulate a fresh accumulation.
    const { sender: s2, receiver: r2 } = Rs.pairFromSharedChain(randomChain());
    const bigMsgs = [];
    for (let i = 0; i < 25; i++) bigMsgs.push(await Rs.ratchetEncrypt(s2, `big${i}`));
    // Deliver #25 — with MAX_SKIP=5 only the last 5 skipped keys are stored (prune fires)
    expect(await Rs.ratchetDecrypt(r2, bigMsgs[24])).toBe('big24');
    // Keys near the end (within MAX_SKIP) are retained
    expect(await Rs.ratchetDecrypt(r2, bigMsgs[23])).toBe('big23');
    expect(await Rs.ratchetDecrypt(r2, bigMsgs[22])).toBe('big22');
    // Keys far back are dropped (forward secrecy)
    expect(await Rs.ratchetDecrypt(r2, bigMsgs[0])).toBe(null);
    expect(await Rs.ratchetDecrypt(r2, bigMsgs[5])).toBe(null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group Sender Key — v5 hash ratchet (Phase 2b)
// ─────────────────────────────────────────────────────────────────────────────

// Build a fresh sender-key state (what the admin stores as gsk:groupId).
function freshSK(epoch = 0) {
  return {
    chainKey: Array.from(crypto.getRandomValues(new Uint8Array(32))),
    counter: 0,
    epoch,
    v: 5,
    skipped: {},
  };
}
// Clone peerSK as received from distributeSenderKey.
function peerFromSK(sk) {
  return { chainKey: [...sk.chainKey], counter: 0, epoch: sk.epoch, v: 5, skipped: {} };
}

describe('group sender-key v5 hash ratchet', () => {
  it('round-trip: single message', async () => {
    const sk0 = freshSK();
    const { ciphertext, nextSk } = await R.groupSenderEncrypt(sk0, 'hello group');
    expect(nextSk.counter).toBe(1);
    const peerSk = peerFromSK(sk0);
    const res = await R.groupSenderDecrypt(peerSk, ciphertext);
    expect(res).not.toBeNull();
    expect(res.plaintext).toBe('hello group');
    expect(res.nextPeerSk.counter).toBe(1);
  });

  it('round-trip: multiple sequential messages (ratchet advances)', async () => {
    let sk = freshSK();
    let peerSk = peerFromSK(sk);
    const texts = ['first', 'second', 'third'];
    for (const text of texts) {
      const { ciphertext, nextSk } = await R.groupSenderEncrypt(sk, text);
      const res = await R.groupSenderDecrypt(peerSk, ciphertext);
      expect(res.plaintext).toBe(text);
      sk = nextSk;
      peerSk = res.nextPeerSk;
    }
    expect(sk.counter).toBe(3);
    expect(peerSk.counter).toBe(3);
  });

  it('forward secrecy: knowing CK0 cannot decrypt msg1 once CK0 is discarded', async () => {
    const sk0 = freshSK();
    // Encrypt msg0 — chain advances to CK1
    const { ciphertext: ct0, nextSk: sk1 } = await R.groupSenderEncrypt(sk0, 'msg0');
    // Encrypt msg1 — chain advances to CK2
    const { ciphertext: ct1 } = await R.groupSenderEncrypt(sk1, 'msg1');
    // Peer who only has CK1 (missed msg0): can't go back to decrypt msg0
    const peerAtCK1 = { chainKey: [...sk1.chainKey], counter: 1, epoch: 0, v: 5, skipped: {} };
    // Decrypting ct0 (c=0 < counter=1) with no skip-cache entry → null
    const r0 = await R.groupSenderDecrypt(peerAtCK1, ct0);
    expect(r0).toBeNull();
    // But ct1 (c=1) decrypts correctly
    const r1 = await R.groupSenderDecrypt(peerAtCK1, ct1);
    expect(r1).not.toBeNull();
    expect(r1.plaintext).toBe('msg1');
  });

  it('mutation guard: forward secrecy breaks if chain keys are not advanced', async () => {
    // If we did NOT advance the chain key (kept CK0), then CK0 could derive msgKey1 too.
    // This test verifies the one-way property holds: HKDF(CK0, 'msg') !== HKDF(CK1, 'msg').
    const sk0 = freshSK();
    const { nextSk: sk1 } = await R.groupSenderEncrypt(sk0, 'msg0');
    const msgKey_from_CK0 = await R.hkdf(new Uint8Array(sk0.chainKey), new Uint8Array(32), 'breeze-group-msg-v5', 32);
    const msgKey_from_CK1 = await R.hkdf(new Uint8Array(sk1.chainKey), new Uint8Array(32), 'breeze-group-msg-v5', 32);
    // msg1 is encrypted with CK1-derived key; CK0-derived key is different
    expect(Array.from(msgKey_from_CK0)).not.toEqual(Array.from(msgKey_from_CK1));
  });

  it('out-of-order: receive msg2 before msg1, then msg1 from skip cache', async () => {
    let sk = freshSK();
    let peerSk = peerFromSK(sk);
    // Encrypt three messages
    const { ciphertext: ct0, nextSk: sk1 } = await R.groupSenderEncrypt(sk,  'msg0');
    const { ciphertext: ct1, nextSk: sk2 } = await R.groupSenderEncrypt(sk1, 'msg1');
    const { ciphertext: ct2 }              = await R.groupSenderEncrypt(sk2, 'msg2');
    // Receive msg0 first (normal)
    const r0 = await R.groupSenderDecrypt(peerSk, ct0); peerSk = r0.nextPeerSk;
    expect(r0.plaintext).toBe('msg0');
    // Receive msg2 out-of-order (should cache key for msg1, then decrypt msg2)
    const r2 = await R.groupSenderDecrypt(peerSk, ct2); peerSk = r2.nextPeerSk;
    expect(r2.plaintext).toBe('msg2');
    expect(peerSk.skipped[1]).toBeDefined(); // msg1's key is in the skip cache
    // Receive msg1 late — must come from skip cache
    const r1 = await R.groupSenderDecrypt(peerSk, ct1); peerSk = r1.nextPeerSk;
    expect(r1.plaintext).toBe('msg1');
    expect(peerSk.skipped[1]).toBeUndefined(); // consumed
  });

  it('rejects a gap larger than GROUP_MAX_SKIP', async () => {
    const Rs = createRatchet({ GROUP_MAX_SKIP: 5 });
    const sk = freshSK();
    // Skip 6 messages (beyond maxSkip=5)
    let senderSk = sk;
    for (let i = 0; i < 6; i++) {
      const { nextSk } = await Rs.groupSenderEncrypt(senderSk, `skip${i}`);
      senderSk = nextSk;
    }
    const { ciphertext: ct6 } = await Rs.groupSenderEncrypt(senderSk, 'msg6');
    const peerSk = peerFromSK(sk);
    // Gap of 6 > maxSkip 5 → reject
    const res = await Rs.groupSenderDecrypt(peerSk, ct6);
    expect(res).toBeNull();
  });

  it('rejects messages from a different epoch', async () => {
    const sk = freshSK(1); // epoch 1
    const { ciphertext } = await R.groupSenderEncrypt(sk, 'hello');
    // Peer with epoch 0 — mismatch → reject
    const peerOldEpoch = peerFromSK({ ...sk, epoch: 0 });
    const res = await R.groupSenderDecrypt(peerOldEpoch, ciphertext);
    expect(res).toBeNull();
  });

  it('epoch rotation: new epoch chainKey decrypts correctly; old epoch cannot decrypt new messages', async () => {
    const sk0 = freshSK(0);
    const { ciphertext: ct_epoch0 } = await R.groupSenderEncrypt(sk0, 'epoch0 msg');
    // Admin generates a fresh chain key for epoch 1 (on kick)
    const sk1 = { chainKey: Array.from(crypto.getRandomValues(new Uint8Array(32))), counter: 0, epoch: 1, v: 5, skipped: {} };
    const { ciphertext: ct_epoch1 } = await R.groupSenderEncrypt(sk1, 'epoch1 msg');
    // Remaining member receives new sender key (epoch 1) and can decrypt it
    const peerEpoch1 = peerFromSK(sk1);
    const r1 = await R.groupSenderDecrypt(peerEpoch1, ct_epoch1);
    expect(r1).not.toBeNull();
    expect(r1.plaintext).toBe('epoch1 msg');
    // Kicked member only has epoch 0 key — cannot decrypt epoch 1 message
    const kickedPeer = peerFromSK(sk0); // epoch 0
    const rKicked = await R.groupSenderDecrypt(kickedPeer, ct_epoch1);
    expect(rKicked).toBeNull();
    // Kicked member CAN still decrypt epoch 0 message (past messages decryptable,
    // but that's acceptable — revocation prevents FUTURE message decryption)
    const rPast = await R.groupSenderDecrypt(kickedPeer, ct_epoch0);
    expect(rPast).not.toBeNull();
    expect(rPast.plaintext).toBe('epoch0 msg');
  });

  it('v3 backward compat: groupDecryptV3 decodes old static-raw-key messages', async () => {
    // Simulate what the v3 encryptGroupMsg does
    const rawKey = Array.from(crypto.getRandomValues(new Uint8Array(32)));
    const counter = 3;
    const msgKeyBits = await R.hkdf(new Uint8Array(rawKey), new Uint8Array(new Uint32Array([counter]).buffer), 'group-msg', 32);
    const text = 'legacy message';
    const raw = new TextEncoder().encode(text);
    const padded = new Uint8Array(Math.ceil((raw.length + 2) / 256) * 256);
    new DataView(padded.buffer).setUint16(0, raw.length);
    padded.set(raw, 2);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const importedKey = await crypto.subtle.importKey('raw', msgKeyBits, { name: 'AES-GCM' }, false, ['encrypt']);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, importedKey, padded));
    const ciphertext = JSON.stringify({ v: 3, g: true, i: Array.from(iv), d: Array.from(ct), c: counter, ep: 0 });
    // groupDecryptV3 should decode it
    const peerSk = { raw: rawKey };
    const result = await R.groupDecryptV3(peerSk, ciphertext);
    expect(result).toBe(text);
  });

  it('skip cache is pruned at maxSkip entries (eviction fires on a second ratchet-forward pass)', async () => {
    // Eviction only fires when the cache already has entries AND a new ratchet-forward
    // pass pushes it over maxSkip. Two passes are required:
    //   Pass 1: deliver msg3 (gap=3=maxSkip) → caches [0,1,2], no eviction (3 ≤ 3)
    //   Pass 2: deliver msg7 (gap=3 from counter=4) → adds [4,5,6] one by one; each
    //           addition briefly pushes cache to 4 entries, evicting the oldest → final [4,5,6]
    const Rs = createRatchet({ GROUP_MAX_SKIP: 3 });
    const sk = freshSK();
    let senderSk = sk;
    const cts = [];
    for (let i = 0; i < 8; i++) {
      const { ciphertext, nextSk } = await Rs.groupSenderEncrypt(senderSk, `m${i}`);
      cts.push(ciphertext); senderSk = nextSk;
    }
    let peerSk = peerFromSK(sk);
    // Pass 1: gap=3 (=maxSkip) → succeeds, caches skipped[0,1,2]
    const r3 = await Rs.groupSenderDecrypt(peerSk, cts[3]);
    expect(r3.plaintext).toBe('m3');
    peerSk = r3.nextPeerSk;
    expect(Object.keys(peerSk.skipped).map(Number).sort((a,b)=>a-b)).toEqual([0, 1, 2]);
    // Pass 2: gap=3 again (counter=4, targetC=7) — evicts entries 0,1,2 as 4,5,6 are added
    const r7 = await Rs.groupSenderDecrypt(peerSk, cts[7]);
    expect(r7).not.toBeNull();
    expect(r7.plaintext).toBe('m7');
    peerSk = r7.nextPeerSk;
    expect(Object.keys(peerSk.skipped).length).toBeLessThanOrEqual(3);
    expect(peerSk.skipped[0]).toBeUndefined(); // oldest evicted
  });
});

// ── Phase 2c: at-rest key wrapping ────────────────────────────────────────────
// Use a low PBKDF2 iteration count so tests run fast without compromising the
// correctness check (the crypto path is identical; only the work factor differs).
const subtle = globalThis.crypto.subtle;
const fastOpts = { PBKDF2_AT_REST_ITERATIONS: 1000 };

describe('at-rest key wrapping (Phase 2c)', () => {
  it('wrapKeyAtRest produces a record with the expected shape', async () => {
    const jwk = { kty: 'oct', k: 'test-key-material', alg: 'A256GCM', ext: true };
    const rec = await wrapKeyAtRest(subtle, jwk, 'passphrase', fastOpts);
    expect(rec.kdf).toBe('pbkdf2-v1');
    expect(Array.isArray(rec.wrapped)).toBe(true);
    expect(Array.isArray(rec.salt)).toBe(true);
    expect(Array.isArray(rec.iv)).toBe(true);
    expect(rec.salt.length).toBe(16);
    expect(rec.iv.length).toBe(12);
    expect(rec.wrapped.length).toBeGreaterThan(0);
  });

  it('wrap → unwrap round-trips a JWK object', async () => {
    const jwk = { kty: 'EC', crv: 'P-256', x: 'x-val', y: 'y-val', d: 'd-val', use: 'sig', ext: true };
    const rec = await wrapKeyAtRest(subtle, jwk, 'correct-pass', fastOpts);
    const recovered = await unwrapKeyAtRest(subtle, rec, 'correct-pass', fastOpts);
    expect(recovered).toEqual(jwk);
  });

  it('wrap → unwrap preserves a realistic ECDH JWK', async () => {
    // Generate a real P-256 key pair and round-trip the private JWK
    const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']);
    const privJwk = await subtle.exportKey('jwk', kp.privateKey);
    const rec = await wrapKeyAtRest(subtle, privJwk, 'secret', fastOpts);
    const recovered = await unwrapKeyAtRest(subtle, rec, 'secret', fastOpts);
    // Recovered JWK should reimport without error
    await expect(
      subtle.importKey('jwk', recovered, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey', 'deriveBits']),
    ).resolves.toBeDefined();
  });

  it('unwrapKeyAtRest throws on wrong passphrase', async () => {
    const jwk = { kty: 'oct', k: 'secret-key-bytes' };
    const rec = await wrapKeyAtRest(subtle, jwk, 'correct', fastOpts);
    await expect(unwrapKeyAtRest(subtle, rec, 'wrong', fastOpts)).rejects.toThrow();
  });

  it('two wraps of the same JWK produce different ciphertexts (random salt/iv)', async () => {
    const jwk = { kty: 'oct', k: 'key' };
    const rec1 = await wrapKeyAtRest(subtle, jwk, 'pass', fastOpts);
    const rec2 = await wrapKeyAtRest(subtle, jwk, 'pass', fastOpts);
    // Salt must differ (random)
    expect(rec1.salt).not.toEqual(rec2.salt);
    // Ciphertext must differ (different salt → different AES-GCM key)
    expect(rec1.wrapped).not.toEqual(rec2.wrapped);
  });

  it('mutation guard: flipping a ciphertext byte causes unwrap to throw', async () => {
    const jwk = { kty: 'oct', k: 'integrity-test' };
    const rec = await wrapKeyAtRest(subtle, jwk, 'pass', fastOpts);
    const tampered = { ...rec, wrapped: rec.wrapped.map((b, i) => (i === 0 ? b ^ 0xff : b)) };
    await expect(unwrapKeyAtRest(subtle, tampered, 'pass', fastOpts)).rejects.toThrow();
  });
});
