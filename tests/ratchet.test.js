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
});
