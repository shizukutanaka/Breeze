// Group sender-key ratchet tests (roadmap I2 forward secrecy + I3 epoch-on-kick).
import { describe, it, expect } from 'vitest';
import { createGroup } from '../src/crypto/group.js';

const G = createGroup();

describe('group message round-trip', () => {
  it('encrypts and decrypts a sequence in order', async () => {
    const sk = G.newSenderKey();
    const bob = G.receiverFrom(sk); // distributed to Bob over the 1:1 channel
    const msgs = ['hi group', '日本語 🌸', ''];
    for (const m of msgs) {
      const ct = await G.encryptGroupMsg(sk, m);
      expect(await G.decryptGroupMsg(bob, ct)).toBe(m);
    }
    expect(bob.counter).toBe(msgs.length);
  });

  it('handles out-of-order delivery (1,3,2)', async () => {
    const sk = G.newSenderKey();
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
    const sk = G.newSenderKey();
    const early = G.receiverFrom(sk);
    const c1 = await G.encryptGroupMsg(sk, 'secret-1');
    const c2 = await G.encryptGroupMsg(sk, 'secret-2');
    expect(await G.decryptGroupMsg(early, c1)).toBe('secret-1');
    expect(await G.decryptGroupMsg(early, c2)).toBe('secret-2');
    // A late joiner receives the sender key as it is NOW (chain already ratcheted
    // past c1/c2). It cannot reach the consumed counters → past msgs unreadable.
    const late = G.receiverFrom(sk); // sk.counter is 2, chainKey advanced
    expect(late.counter).toBe(2);
    expect(await G.decryptGroupMsg(late, c1)).toBe(null);
    expect(await G.decryptGroupMsg(late, c2)).toBe(null);
    const c3 = await G.encryptGroupMsg(sk, 'secret-3');
    expect(await G.decryptGroupMsg(late, c3)).toBe('secret-3'); // can read forward
  });

  it('rejects replay of an already-consumed counter', async () => {
    const sk = G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const c1 = await G.encryptGroupMsg(sk, 'one');
    const c2 = await G.encryptGroupMsg(sk, 'two');
    expect(await G.decryptGroupMsg(bob, c1)).toBe('one');
    expect(await G.decryptGroupMsg(bob, c2)).toBe('two');
    expect(await G.decryptGroupMsg(bob, c1)).toBe(null); // replay
  });
});

describe('I3 — epoch rotation on member removal (post-compromise)', () => {
  it('a kicked member cannot decrypt new-epoch messages; remaining members can', async () => {
    let sk = G.newSenderKey(); // epoch 0
    const bob = G.receiverFrom(sk);
    const carol = G.receiverFrom(sk); // will be kicked

    const m1 = await G.encryptGroupMsg(sk, 'epoch0 msg');
    expect(await G.decryptGroupMsg(bob, m1)).toBe('epoch0 msg');
    expect(await G.decryptGroupMsg(carol, m1)).toBe('epoch0 msg');

    // Kick Carol: rotate the epoch and distribute the fresh key to Bob ONLY.
    sk = G.rotateEpoch(sk); // epoch 1, new chain key
    const bobE1 = G.receiverFrom(sk);
    // (Carol is NOT given bobE1; she still holds her epoch-0 receiver state.)

    const m2 = await G.encryptGroupMsg(sk, 'epoch1 msg');
    expect(await G.decryptGroupMsg(bobE1, m2)).toBe('epoch1 msg'); // remaining member reads
    expect(await G.decryptGroupMsg(carol, m2)).toBe(null);          // kicked member cannot
  });

  it('rejects an old-epoch (stale) message after rotation', async () => {
    let sk = G.newSenderKey();
    const m0 = await G.encryptGroupMsg(sk, 'old');
    sk = G.rotateEpoch(sk);
    const bob = G.receiverFrom(sk); // epoch 1
    expect(await G.decryptGroupMsg(bob, m0)).toBe(null); // epoch 0 < bob's epoch 1
  });
});

describe('I16 — key commitment on group messages', () => {
  it('rejects a tampered commitment', async () => {
    const sk = G.newSenderKey();
    const bob = G.receiverFrom(sk);
    const obj = JSON.parse(await G.encryptGroupMsg(sk, 'committed'));
    expect(obj.cm).toBeDefined();
    obj.cm[0] ^= 0xff;
    expect(await G.decryptGroupMsg(bob, obj)).toBe(null);
  });
});
