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

describe('legacy single-sig path (epoch-only, no per-message key)', () => {
  it('decryptGroupMsg accepts a legacy message signed only with the epoch key', async () => {
    // Old-format clients that don't generate per-message keys use the fallback path:
    //   encryptGroupMsg branches to `signPriv`-only and omits es/spk/nsk.
    // decryptGroupMsg's legacy branch (no p.es) verifies p.s against peerKey.signPub.
    const sk = await G.newSenderKey();
    // Strip per-message keys to force the fallback branch in encryptGroupMsg.
    delete sk.msgSignKey;
    delete sk.nextMsgSignKey;
    const bob = G.receiverFrom(sk);
    const wire = await G.encryptGroupMsg(sk, 'legacy message');
    const obj = JSON.parse(wire);
    // Fallback path: no es/spk/nsk fields, only s (epoch sig over signed bytes).
    expect(obj.es).toBeUndefined();
    expect(obj.spk).toBeUndefined();
    expect(obj.s).toBeDefined(); // epoch-key sig still present
    expect(await G.decryptGroupMsg(bob, wire)).toBe('legacy message');
  });

  it('rejects a legacy message when the single sig is tampered', async () => {
    const sk = await G.newSenderKey();
    delete sk.msgSignKey;
    delete sk.nextMsgSignKey;
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'x'));
    obj.s[0] ^= 0xff; // corrupt the epoch sig
    expect(await G.decryptGroupMsg(bob, JSON.stringify(obj))).toBe(null);
  });

  it('rejects a legacy message with no s field at all', async () => {
    const sk = await G.newSenderKey();
    delete sk.msgSignKey;
    delete sk.nextMsgSignKey;
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'x'));
    delete obj.s;
    expect(await G.decryptGroupMsg(bob, JSON.stringify(obj))).toBe(null);
  });
});

describe('DoS guards — MAX_GAP and MAX_SKIP', () => {
  it('rejects a message whose counter jump exceeds MAX_GAP', async () => {
    const Gdos = createGroup({ MAX_GAP: 3 });
    const sk = await Gdos.newSenderKey();
    const bob = Gdos.receiverFrom(sk);
    // Encrypt 5 messages; bob.counter stays at 0 (nothing delivered yet).
    for (let i = 0; i < 5; i++) await Gdos.encryptGroupMsg(sk, `m${i}`);
    // sk.counter is now 5; gap = 5 - 0 - 1 = 4 > MAX_GAP(3) → reject.
    const last = await Gdos.encryptGroupMsg(sk, 'too far');
    expect(await Gdos.decryptGroupMsg(bob, last)).toBe(null);
  });

  it('stores only keys within MAX_SKIP window; distant keys are silently dropped', async () => {
    // Condition: `p.c - n < MAX_SKIP` — stores skipped keys where gap-to-target < MAX_SKIP.
    // MAX_SKIP=3: with p.c=6, counter=0, stores n=4 (gap 2) and n=5 (gap 1); n=1-3 dropped.
    const Gskip = createGroup({ MAX_SKIP: 3 });
    const sk = await Gskip.newSenderKey();
    const bob = Gskip.receiverFrom(sk);
    const c1 = await Gskip.encryptGroupMsg(sk, 'one');
    const c2 = await Gskip.encryptGroupMsg(sk, 'two');
    const c3 = await Gskip.encryptGroupMsg(sk, 'three');
    const c4 = await Gskip.encryptGroupMsg(sk, 'four');
    const c5 = await Gskip.encryptGroupMsg(sk, 'five');
    const c6 = await Gskip.encryptGroupMsg(sk, 'six');
    // Deliver c6 first: stores c4 (gap=2 < 3) and c5 (gap=1 < 3); c1-c3 are dropped.
    expect(await Gskip.decryptGroupMsg(bob, c6)).toBe('six');
    expect(await Gskip.decryptGroupMsg(bob, c5)).toBe('five');  // gap=1, within window
    expect(await Gskip.decryptGroupMsg(bob, c4)).toBe('four');  // gap=2, within window
    expect(await Gskip.decryptGroupMsg(bob, c3)).toBe(null);    // gap=3, beyond MAX_SKIP
    expect(await Gskip.decryptGroupMsg(bob, c2)).toBe(null);    // gap=4, beyond MAX_SKIP
    expect(await Gskip.decryptGroupMsg(bob, c1)).toBe(null);    // gap=5, beyond MAX_SKIP
  });

  it('accepts a message exactly at MAX_GAP boundary', async () => {
    const Gdos = createGroup({ MAX_GAP: 3 });
    const sk = await Gdos.newSenderKey();
    const bob = Gdos.receiverFrom(sk);
    for (let i = 0; i < 3; i++) await Gdos.encryptGroupMsg(sk, `skip${i}`);
    // sk.counter = 3; gap = 3 - 0 - 1 = 2 ≤ MAX_GAP(3) → accepted.
    const c4 = await Gdos.encryptGroupMsg(sk, 'boundary');
    expect(await Gdos.decryptGroupMsg(bob, c4)).toBe('boundary');
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

describe('malformed-input hardening (returns null, never throws)', () => {
  const Gh = createGroup();

  it('returns null on malformed JSON instead of throwing', async () => {
    const sk = await Gh.newSenderKey();
    const bob = Gh.receiverFrom(sk);
    expect(await Gh.decryptGroupMsg(bob, '{not valid json')).toBe(null);
    expect(await Gh.decryptGroupMsg(bob, 'null')).toBe(null);
  });

  it('returns null on a non-group / non-object payload', async () => {
    const sk = await Gh.newSenderKey();
    const bob = Gh.receiverFrom(sk);
    expect(await Gh.decryptGroupMsg(bob, JSON.stringify({ v: 4, d: [1, 2] }))).toBe(null); // no g
    expect(await Gh.decryptGroupMsg(bob, '42')).toBe(null);
    expect(await Gh.decryptGroupMsg(bob, JSON.stringify([1, 2, 3]))).toBe(null);
  });

  it('returns null on non-numeric epoch/counter (no throw on the no-signPub path)', async () => {
    const sk = await Gh.newSenderKey();
    const bob = Gh.receiverFrom(sk);
    delete bob.signPub; // exercise the path that skips the signature gate
    expect(await Gh.decryptGroupMsg(bob, JSON.stringify({ g: true, ep: 0, c: 'x', i: [], d: [] }))).toBe(null);
    expect(await Gh.decryptGroupMsg(bob, JSON.stringify({ g: true, ep: null, c: 1, i: [], d: [] }))).toBe(null);
  });

  it('returns null for NaN / Infinity epoch or counter (Number.isFinite guard)', async () => {
    // typeof NaN === 'number' — without Number.isFinite, a NaN epoch/counter would
    // slip through the old typeof-only guard and break the ratchet loop silently.
    const sk = await G.newSenderKey();
    const bob = G.receiverFrom(sk);
    expect(await G.decryptGroupMsg(bob, JSON.stringify({ g: true, ep: NaN, c: 0, i: [], d: [] }))).toBe(null);
    expect(await G.decryptGroupMsg(bob, JSON.stringify({ g: true, ep: 0, c: Infinity, i: [], d: [] }))).toBe(null);
    expect(await G.decryptGroupMsg(bob, JSON.stringify({ g: true, ep: Infinity, c: 1, i: [], d: [] }))).toBe(null);
  });
});

describe('sender-key distribution envelope (buildSenderKeyDistribution / parse)', () => {
  it('round-trips a sender key into a working receiver via the wire envelope', async () => {
    const sk = await G.newSenderKey();
    // Distribute over the (E2E-encrypted) 1:1 channel: serialize → parse on the peer.
    const wire = G.buildSenderKeyDistribution(sk);
    const bob = G.parseSenderKeyDistribution(wire);
    expect(bob).not.toBe(null);
    // The reconstructed receiver decrypts messages from the original sender key.
    expect(await G.decryptGroupMsg(bob, await G.encryptGroupMsg(sk, 'distributed hi'))).toBe('distributed hi');
    expect(await G.decryptGroupMsg(bob, await G.encryptGroupMsg(sk, '日本語'))).toBe('日本語');
  });

  it('never leaks the signing private key (only the epoch public key is on the wire)', async () => {
    const sk = await G.newSenderKey();
    const wire = JSON.parse(G.buildSenderKeyDistribution(sk));
    expect(wire.spk).toBeDefined();      // epoch sign PUBLIC key
    expect(wire.signPriv).toBeUndefined();
    expect(wire.msgSignKey).toBeUndefined();
    expect(wire.nextMsgSignKey).toBeUndefined();
    // The serialized envelope carries no CryptoKey objects at all.
    expect(JSON.stringify(wire)).not.toContain('CryptoKey');
  });

  it('carries the current counter so a mid-stream joiner cannot read earlier messages (FS)', async () => {
    const sk = await G.newSenderKey();
    await G.encryptGroupMsg(sk, 'before-join-1');
    await G.encryptGroupMsg(sk, 'before-join-2'); // sk.counter advances to 2
    // Distribute AFTER two messages: the joiner's receiver starts at counter 2.
    const late = G.parseSenderKeyDistribution(G.buildSenderKeyDistribution(sk));
    expect(late.counter).toBe(2);
    const fresh = await G.encryptGroupMsg(sk, 'after-join'); // counter 3
    expect(await G.decryptGroupMsg(late, fresh)).toBe('after-join');
  });

  it('distributes the rotated epoch so kicked-epoch receivers are correctly scoped', async () => {
    let sk = await G.newSenderKey();          // epoch 0
    sk = await G.rotateEpoch(sk);             // epoch 1 (kick)
    const wire = JSON.parse(G.buildSenderKeyDistribution(sk));
    expect(wire.ep).toBe(1);
    const bob = G.parseSenderKeyDistribution(JSON.stringify(wire));
    expect(bob.epoch).toBe(1);
    expect(await G.decryptGroupMsg(bob, await G.encryptGroupMsg(sk, 'epoch1'))).toBe('epoch1');
  });

  it('parse returns null on malformed / non-skd payloads (no throw)', () => {
    expect(G.parseSenderKeyDistribution('not json')).toBe(null);
    expect(G.parseSenderKeyDistribution(JSON.stringify({ v: 4, t: 'skd', ck: [], spk: [], ep: 0, c: 0 }))).toBe(null);
    expect(G.parseSenderKeyDistribution(JSON.stringify({ v: 5, t: 'skd', ck: 'x', spk: [], ep: 0, c: 0 }))).toBe(null);
    expect(G.parseSenderKeyDistribution(JSON.stringify({ v: 5, t: 'skd', ck: [], spk: [], ep: 'a', c: 0 }))).toBe(null);
    expect(G.parseSenderKeyDistribution(null)).toBe(null);
  });

  it('parse returns null for NaN / Infinity epoch or counter (Number.isFinite guard)', () => {
    // NaN has typeof 'number' — without Number.isFinite, a NaN epoch would create a
    // broken receiver key where every decryption fails silently (NaN !== NaN is always true).
    const good = { v: 5, t: 'skd', ck: [], spk: [], ep: 0, c: 0 };
    expect(G.parseSenderKeyDistribution(JSON.stringify({ ...good, ep: NaN }))).toBe(null);
    expect(G.parseSenderKeyDistribution(JSON.stringify({ ...good, c: Infinity }))).toBe(null);
    expect(G.parseSenderKeyDistribution(JSON.stringify({ ...good, ep: -Infinity }))).toBe(null);
  });

  it('build throws when the sender key is missing chainKey/signPub', () => {
    expect(() => G.buildSenderKeyDistribution({ counter: 0, epoch: 0 })).toThrow();
    expect(() => G.buildSenderKeyDistribution(null)).toThrow();
  });
});
