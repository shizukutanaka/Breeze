// Group sender-key tests: I2 forward secrecy, I3 epoch-on-kick, I16 commitment,
// N2 per-message sender authentication, I7-group skipped-key TTL.
import { describe, it, expect } from 'vitest';
import { createGroup } from '../src/crypto/group.js';

const G = createGroup();

describe('group message round-trip', () => {
  it('encrypts and decrypts a sequence in order', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const msgs = ['hi group', '日本語 🌸', ''];
    for (const m of msgs) {
      expect(await G.decryptGroupMsg(bob, await G.encryptGroupMsg(sk, m))).toBe(m);
    }
    expect(bob.counter).toBe(msgs.length);
  });

  it('handles out-of-order delivery (1,3,2)', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const c1 = await G.encryptGroupMsg(sk, 'one');
    const c2 = await G.encryptGroupMsg(sk, 'two');
    const c3 = await G.encryptGroupMsg(sk, 'three');
    expect(await G.decryptGroupMsg(bob, c1)).toBe('one');
    expect(await G.decryptGroupMsg(bob, c3)).toBe('three'); // stores skipped key for #2
    expect(await G.decryptGroupMsg(bob, c2)).toBe('two');   // recovered
  });
});

describe('I2 — forward secrecy', () => {
  it('a member joining with the current (advanced) key cannot read past messages', async () => {
    const sk = await G.newSenderKey();
    const early = G.receiverFrom(sk);
    const c1 = await G.encryptGroupMsg(sk, 'secret-1');
    const c2 = await G.encryptGroupMsg(sk, 'secret-2');
    expect(await G.decryptGroupMsg(early, c1)).toBe('secret-1');
    expect(await G.decryptGroupMsg(early, c2)).toBe('secret-2');
    const late = G.receiverFrom(sk); // key as it is now (chain ratcheted past c1/c2)
    expect(late.counter).toBe(2);
    expect(await G.decryptGroupMsg(late, c1)).toBe(null);
    expect(await G.decryptGroupMsg(late, c2)).toBe(null);
    expect(await G.decryptGroupMsg(late, await G.encryptGroupMsg(sk, 'secret-3'))).toBe('secret-3');
  });

  it('rejects replay of an already-consumed counter', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const c1 = await G.encryptGroupMsg(sk, 'one');
    await G.encryptGroupMsg(sk, 'two');
    expect(await G.decryptGroupMsg(bob, c1)).toBe('one');
    expect(await G.decryptGroupMsg(bob, c1)).toBe(null); // replay
  });
});

describe('I3 — epoch rotation on member removal (post-compromise)', () => {
  it('a kicked member cannot decrypt new-epoch messages; remaining members can', async () => {
    let sk = await G.newSenderKey(); // epoch 0
    const bob = G.receiverFrom(sk);
    const carol = G.receiverFrom(sk); // will be kicked
    const m1 = await G.encryptGroupMsg(sk, 'epoch0 msg');
    expect(await G.decryptGroupMsg(bob, m1)).toBe('epoch0 msg');
    expect(await G.decryptGroupMsg(carol, m1)).toBe('epoch0 msg');

    sk = await G.rotateEpoch(sk); // kick Carol: new epoch, fresh key to Bob only
    const bobE1 = G.receiverFrom(sk);
    const m2 = await G.encryptGroupMsg(sk, 'epoch1 msg');
    expect(await G.decryptGroupMsg(bobE1, m2)).toBe('epoch1 msg');
    expect(await G.decryptGroupMsg(carol, m2)).toBe(null); // kicked member blocked
  });

  it('rejects an old-epoch (stale) message after rotation', async () => {
    let sk = await G.newSenderKey();
    const m0 = await G.encryptGroupMsg(sk, 'old');
    sk = await G.rotateEpoch(sk);
    const bob = G.receiverFrom(sk);
    expect(await G.decryptGroupMsg(bob, m0)).toBe(null);
  });

  it('rejects a future-epoch message the receiver has no key for', async () => {
    // A receiver holding epoch 0 cannot decrypt a message from epoch 1 even if
    // the epoch field is not tampered — the epoch gate must reject both directions.
    let sk0 = await G.newSenderKey(); // epoch 0
    const bob = G.receiverFrom(sk0);  // bob holds epoch 0 receiver
    const sk1 = await G.rotateEpoch(sk0); // epoch 1 (bob never received this key)
    const future = await G.encryptGroupMsg(sk1, 'future msg');
    expect(await G.decryptGroupMsg(bob, future)).toBe(null);
  });

  it('consumed skipped group key cannot be replayed after first use', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const c1 = await G.encryptGroupMsg(sk, 'one');
    const c2 = await G.encryptGroupMsg(sk, 'two');
    const c3 = await G.encryptGroupMsg(sk, 'three');
    expect(await G.decryptGroupMsg(bob, c1)).toBe('one');
    expect(await G.decryptGroupMsg(bob, c3)).toBe('three'); // stores skipped key for #2
    expect(await G.decryptGroupMsg(bob, c2)).toBe('two');   // consumes skipped key
    // Second delivery of #2: key deleted → null (no replay).
    expect(await G.decryptGroupMsg(bob, c2)).toBe(null);
  });
});

describe('I16 — key commitment on group messages', () => {
  it('rejects a tampered commitment', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'committed'));
    expect(obj.cm).toBeDefined();
    obj.cm[0] ^= 0xff;
    // Tampering cm changes the signed bytes too, so the signature also fails — either
    // way the message is rejected.
    expect(await G.decryptGroupMsg(bob, obj)).toBe(null);
  });
});

describe('I7 (group) — skipped-key TTL: stale keys are expired', () => {
  it('expires a skipped key past TTL; fresh keys within TTL are still recoverable', async () => {
    const TTL = 60_000; // 1 minute for this test
    let fakeNow = Date.now();
    const Gttl = createGroup({ skippedKeyTTL: TTL, now: () => fakeNow });

    const sk = await Gttl.newSenderKey();
    const bob = Gttl.receiverFrom(sk);

    // Encrypt three messages; deliver c3 first → c1 and c2 stored as skipped keys.
    const c1 = await Gttl.encryptGroupMsg(sk, 'msg1');
    const c2 = await Gttl.encryptGroupMsg(sk, 'msg2');
    const c3 = await Gttl.encryptGroupMsg(sk, 'msg3');
    expect(await Gttl.decryptGroupMsg(bob, c3)).toBe('msg3'); // c1,c2 now in skipped

    // c2 is within TTL — should still be recoverable.
    fakeNow += TTL - 1;
    const c4 = await Gttl.encryptGroupMsg(sk, 'msg4');
    expect(await Gttl.decryptGroupMsg(bob, c4)).toBe('msg4'); // triggers TTL prune (c1,c2 kept)
    expect(await Gttl.decryptGroupMsg(bob, c2)).toBe('msg2'); // still there

    // Now advance past TTL and store c1 as expired.
    const sk2 = await Gttl.newSenderKey();
    const bob2 = Gttl.receiverFrom(sk2);
    const a1 = await Gttl.encryptGroupMsg(sk2, 'a1');
    const a2 = await Gttl.encryptGroupMsg(sk2, 'a2');
    const a3 = await Gttl.encryptGroupMsg(sk2, 'a3');
    await Gttl.decryptGroupMsg(bob2, a3); // populates skipped[a1,a2] at time fakeNow
    fakeNow += TTL + 1; // advance past TTL
    const a4 = await Gttl.encryptGroupMsg(sk2, 'a4');
    await Gttl.decryptGroupMsg(bob2, a4); // triggers TTL prune → a1 and a2 deleted
    expect(await Gttl.decryptGroupMsg(bob2, a1)).toBe(null); // key expired
    expect(await Gttl.decryptGroupMsg(bob2, a2)).toBe(null); // key expired
  });
});

describe('N2 — two-layer sender authentication (partial AFKS)', () => {
  it('attaches both epoch sig (es) and per-message sig (s), plus spk and nsk', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'authentic'));
    expect(obj.s).toBeDefined();    // per-message sig
    expect(obj.es).toBeDefined();   // epoch sig
    expect(obj.spk).toBeDefined();  // current per-message public key
    expect(obj.nsk).toBeDefined();  // next per-message public key
    expect(bob.signPub).toBeDefined();
    expect(await G.decryptGroupMsg(bob, obj)).toBe('authentic');
  });

  it('rejects a message forged by another member (different epoch key)', async () => {
    const alice = await G.newSenderKey();
    const bob = G.receiverFrom(alice); // bob expects messages signed by Alice's epoch key
    // Mallory holds the same group CHAIN key but has a different epoch signing key.
    const mallory = await G.newSenderKey();
    mallory.chainKey = alice.chainKey.slice(); // same symmetric chain
    mallory.counter = alice.counter;
    const forged = JSON.parse(await G.encryptGroupMsg(mallory, 'i am alice'));
    // Mallory's es is signed with her own epoch key; bob verifies with alice's → reject.
    expect(await G.decryptGroupMsg(bob, forged)).toBe(null);
  });

  it('rejects when epoch sig (es) is stripped — per-message sig alone is not enough', async () => {
    // Security property: even with a valid per-message signature, a message without
    // the epoch sig is rejected. Prevents forgery with only a per-message key.
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'x'));
    const noEpochSig = { ...obj }; delete noEpochSig.es;
    // Falls back to legacy path (no es field) → requires s to verify against epoch pub.
    // Since spk != epoch pub, verification fails.
    expect(await G.decryptGroupMsg(bob, noEpochSig)).toBe(null);
  });

  it('rejects when per-message sig (s) is stripped — epoch sig alone is not enough', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'x'));
    const noMsgSig = { ...obj }; delete noMsgSig.s;
    expect(await G.decryptGroupMsg(bob, noMsgSig)).toBe(null);
  });

  it('rejects tampered epoch sig (es)', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'x'));
    const badEs = { ...obj, es: obj.es.slice() }; badEs.es[0] ^= 0xff;
    expect(await G.decryptGroupMsg(bob, badEs)).toBe(null);
  });

  it('rejects tampered per-message sig (s)', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'x'));
    const badS = { ...obj, s: obj.s.slice() }; badS.s[0] ^= 0xff;
    expect(await G.decryptGroupMsg(bob, badS)).toBe(null);
  });

  it('rejects ciphertext tampering (both sigs cover ct)', async () => {
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'integrity'));
    obj.d[0] ^= 0xff; // flip a ciphertext byte — invalidates both es and s
    expect(await G.decryptGroupMsg(bob, obj)).toBe(null);
  });

  it('epoch sig authenticates spk so out-of-order messages verify correctly', async () => {
    // All three messages use fresh per-message signing keys. Bob can verify each
    // because the epoch sig (with the static epoch pub) binds the per-message key.
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const c1 = await G.encryptGroupMsg(sk, 'first');
    const c2 = await G.encryptGroupMsg(sk, 'second');
    const c3 = await G.encryptGroupMsg(sk, 'third');
    // Deliver out-of-order: 1, 3, 2
    expect(await G.decryptGroupMsg(bob, c1)).toBe('first');
    expect(await G.decryptGroupMsg(bob, c3)).toBe('third');
    expect(await G.decryptGroupMsg(bob, c2)).toBe('second');
  });
});

describe('AEAD auth failure does not desync group sender-key state', () => {
  it('returns null and preserves chain state when ciphertext auth fails', async () => {
    const G2 = createGroup({ ratchet: (await import('../src/crypto/ratchet.js')).createRatchet() });
    const sk = await G2.newSenderKey();
    const bob = G2.receiverFrom(sk);
    const legitMsg = await G2.encryptGroupMsg(sk, 'real group message');
    // Craft an injected message: tamper ciphertext + remove cm and per-message sig.
    // The epoch sig (es) covers ct, so it also fails — message is rejected before
    // any chain state is modified, preserving chain alignment for the legit message.
    const crafted = JSON.parse(legitMsg);
    crafted.d[0] ^= 0xff;
    delete crafted.cm;
    delete crafted.s;
    expect(await G2.decryptGroupMsg(bob, crafted)).toBe(null);
    // Legitimate message must still decrypt (state not desynced by the injection).
    expect(await G2.decryptGroupMsg(bob, legitMsg)).toBe('real group message');
  });
});
