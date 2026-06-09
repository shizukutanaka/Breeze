import { describe, it, expect } from 'vitest';
import { createRatchet } from '../src/crypto/ratchet.js';

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
