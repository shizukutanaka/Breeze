// I1 — Authenticated X3DH: the responder signs its signed pre-key (SPK) with its
// long-term Ed25519 identity key, and the initiator VERIFIES that signature before
// deriving the session. These tests prove (a) both parties agree on the same root
// key, and (b) a relay that swaps in its own pre-key is detected (the signature
// fails) — the MITM that today's unsigned/unverified pre-key path allows.
import { describe, it, expect } from 'vitest';
import { createRatchet } from '../src/crypto/ratchet.js';

const R = createRatchet(); // P-256 ECDH (deterministic across Node versions)
const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');

// A full party: identity DH key (IK), signed pre-key (SPK), one-time pre-key (OPK),
// and an Ed25519 identity/signing key.
async function party() {
  return {
    ik: await R.genRatchetKey(),
    spk: await R.genRatchetKey(),
    opk: await R.genRatchetKey(),
    ed: await R.genSigningKey(),
  };
}

describe('signed pre-key signature (the authentication step)', () => {
  it('verifies a genuine signature and rejects tampering / wrong key', async () => {
    const bob = await party();
    const sig = await R.signSPK(bob.ed.privateKey, bob.spk.pub);
    expect(await R.verifySPK(bob.ed.pub, bob.spk.pub, sig)).toBe(true);

    const badSig = sig.slice(); badSig[0] ^= 0xff;
    expect(await R.verifySPK(bob.ed.pub, bob.spk.pub, badSig)).toBe(false);
    // Signature is over the SPK, so it must not validate a different pre-key.
    expect(await R.verifySPK(bob.ed.pub, bob.opk.pub, sig)).toBe(false);
  });
});

describe('X3DH key agreement', () => {
  it('initiator and responder derive the same root key (with OPK)', async () => {
    const alice = await party();
    const bob = await party();
    const ek = await R.genRatchetKey(); // Alice's ephemeral

    // Alice must verify Bob's signed pre-key before proceeding.
    const sig = await R.signSPK(bob.ed.privateKey, bob.spk.pub);
    expect(await R.verifySPK(bob.ed.pub, bob.spk.pub, sig)).toBe(true);

    const skA = await R.x3dhInitiator({
      ikPriv: alice.ik.privateKey, ekPriv: ek.privateKey,
      ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub, opkPubPeer: bob.opk.pub,
    });
    const skB = await R.x3dhResponder({
      ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey, opkPriv: bob.opk.privateKey,
      ikPubPeer: alice.ik.pub, ekPubPeer: ek.pub,
    });
    expect(hex(skA)).toBe(hex(skB));
    expect(skA.length).toBe(32);
  });

  it('agrees without a one-time pre-key (OPK exhausted)', async () => {
    const alice = await party();
    const bob = await party();
    const ek = await R.genRatchetKey();
    const skA = await R.x3dhInitiator({
      ikPriv: alice.ik.privateKey, ekPriv: ek.privateKey,
      ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub, // no opkPubPeer
    });
    const skB = await R.x3dhResponder({
      ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey, // no opkPriv
      ikPubPeer: alice.ik.pub, ekPubPeer: ek.pub,
    });
    expect(hex(skA)).toBe(hex(skB));
  });

  it('different sessions derive different root keys', async () => {
    const alice = await party(); const bob = await party();
    const ek1 = await R.genRatchetKey(); const ek2 = await R.genRatchetKey();
    const sk1 = await R.x3dhInitiator({ ikPriv: alice.ik.privateKey, ekPriv: ek1.privateKey, ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub });
    const sk2 = await R.x3dhInitiator({ ikPriv: alice.ik.privateKey, ekPriv: ek2.privateKey, ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub });
    expect(hex(sk1)).not.toBe(hex(sk2));
  });
});

describe('full session establishment (X3DH → Double Ratchet)', () => {
  it('bootstraps a session from X3DH and ratchets messages both directions', async () => {
    const alice = await party();
    const bob = await party();
    const ek = await R.genRatchetKey();

    // X3DH (with signature verification) → shared root key on both sides.
    const sig = await R.signSPK(bob.ed.privateKey, bob.spk.pub);
    expect(await R.verifySPK(bob.ed.pub, bob.spk.pub, sig)).toBe(true);
    const skA = await R.x3dhInitiator({
      ikPriv: alice.ik.privateKey, ekPriv: ek.privateKey,
      ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub, opkPubPeer: bob.opk.pub,
    });
    const skB = await R.x3dhResponder({
      ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey, opkPriv: bob.opk.privateKey,
      ikPubPeer: alice.ik.pub, ekPubPeer: ek.pub,
    });
    expect(hex(skA)).toBe(hex(skB));

    // Bootstrap Double Ratchet sessions from the X3DH secret.
    const aSess = await R.initiatorSession(skA, bob.spk.pub);
    const bSess = R.responderSession(skB, bob.spk.privateKey);

    // Alice → Bob (Bob completes the DH ratchet on receipt).
    expect(await R.ratchetDecrypt(bSess, await R.ratchetEncrypt(aSess, 'hello bob'))).toBe('hello bob');
    // Bob → Alice (DH ratchet flips direction).
    expect(await R.ratchetDecrypt(aSess, await R.ratchetEncrypt(bSess, 'hi alice'))).toBe('hi alice');
    // Alice → Bob again (another ratchet).
    expect(await R.ratchetDecrypt(bSess, await R.ratchetEncrypt(aSess, 'how are you?'))).toBe('how are you?');
    // Several in a row, same direction (symmetric chain only).
    const m4 = await R.ratchetEncrypt(bSess, 'good');
    const m5 = await R.ratchetEncrypt(bSess, 'you?');
    expect(await R.ratchetDecrypt(aSess, m4)).toBe('good');
    expect(await R.ratchetDecrypt(aSess, m5)).toBe('you?');
  });
});

describe('X3DH v5 prekey-message envelope (first-message handshake header)', () => {
  it('round-trips the handshake fields and the inner ratchet message', async () => {
    const alice = await party();
    const ek = await R.genRatchetKey();
    const inner = await R.ratchetEncrypt(
      (await R.pairFromSharedChain(new Uint8Array(32).fill(7))).sender, 'inner',
    );
    const envelope = R.buildPreKeyMessage({ ikPub: alice.ik.pub, ekPub: ek.pub, opkId: 3, ratchetMessage: inner });
    const parsed = R.parsePreKeyMessage(envelope);
    expect(hex(parsed.ikPub)).toBe(hex(new Uint8Array(alice.ik.pub)));
    expect(hex(parsed.ekPub)).toBe(hex(new Uint8Array(ek.pub)));
    expect(parsed.opkId).toBe(3);
    expect(parsed.ratchetMessage).toBe(inner);
  });

  it('carries opkId:null when the responder OPKs are exhausted', async () => {
    const alice = await party();
    const ek = await R.genRatchetKey();
    const env = R.buildPreKeyMessage({ ikPub: alice.ik.pub, ekPub: ek.pub, ratchetMessage: '{}' });
    expect(R.parsePreKeyMessage(env).opkId).toBe(null);
  });

  it('parsePreKeyMessage returns null for non-pkm / malformed payloads (no throw)', () => {
    expect(R.parsePreKeyMessage('not json')).toBe(null);
    expect(R.parsePreKeyMessage(JSON.stringify({ v: 4, d: [] }))).toBe(null); // a plain ratchet msg
    expect(R.parsePreKeyMessage(JSON.stringify({ v: 5, t: 'pkm', ik: 'x', ek: [], msg: 'm' }))).toBe(null); // ik not array
    expect(R.parsePreKeyMessage(JSON.stringify({ v: 5, t: 'pkm', ik: [], ek: [], msg: 42 }))).toBe(null); // msg not string
    expect(R.parsePreKeyMessage(null)).toBe(null);
  });

  it('buildPreKeyMessage rejects missing keys / non-string inner message', () => {
    expect(() => R.buildPreKeyMessage({ ekPub: [1], ratchetMessage: 'm' })).toThrow();
    expect(() => R.buildPreKeyMessage({ ikPub: [1], ekPub: [2], ratchetMessage: 42 })).toThrow();
  });

  it('drives a full first-contact handshake: Alice wraps, Bob unwraps → derives SK → decrypts', async () => {
    const alice = await party();
    const bob = await party();
    const ek = await R.genRatchetKey();

    // Alice verifies Bob's signed pre-key, derives SK, bootstraps her session, and
    // sends her first ratchet message wrapped in the prekey-message envelope.
    const sig = await R.signSPK(bob.ed.privateKey, bob.spk.pub);
    expect(await R.verifySPK(bob.ed.pub, bob.spk.pub, sig)).toBe(true);
    const skA = await R.x3dhInitiator({
      ikPriv: alice.ik.privateKey, ekPriv: ek.privateKey,
      ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub, opkPubPeer: bob.opk.pub,
    });
    const aSess = await R.initiatorSession(skA, bob.spk.pub);
    const firstMsg = await R.ratchetEncrypt(aSess, 'hello from first contact');
    const wire = R.buildPreKeyMessage({ ikPub: alice.ik.pub, ekPub: ek.pub, opkId: 0, ratchetMessage: firstMsg });

    // Bob receives the wire envelope, extracts the handshake fields, selects the
    // consumed OPK (opkId 0), derives the SAME SK, bootstraps his session, decrypts.
    const hs = R.parsePreKeyMessage(wire);
    expect(hs).not.toBe(null);
    const skB = await R.x3dhResponder({
      ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey, opkPriv: bob.opk.privateKey,
      ikPubPeer: hs.ikPub, ekPubPeer: hs.ekPub,
    });
    expect(hex(skB)).toBe(hex(skA));
    const bSess = R.responderSession(skB, bob.spk.privateKey);
    expect(await R.ratchetDecrypt(bSess, hs.ratchetMessage)).toBe('hello from first contact');
    // And the conversation continues with plain ratchet messages (no envelope).
    expect(await R.ratchetDecrypt(aSess, await R.ratchetEncrypt(bSess, 'hi back'))).toBe('hi back');
  });
});

describe('one-call handshake orchestration (initiatorHandshake / responderHandshake)', () => {
  // Build a published bundle for Bob (what the relay serves to Alice).
  async function bundleFor(bob, { withOpk = true } = {}) {
    const spkSig = await R.signSPK(bob.ed.privateKey, bob.spk.pub);
    return {
      ikPub: bob.ik.pub, edIkPub: bob.ed.pub, spkPub: bob.spk.pub, spkSig,
      ...(withOpk ? { opkPub: bob.opk.pub, opkId: 0 } : {}),
    };
  }

  it('completes a full first-contact handshake in two calls (with OPK)', async () => {
    const alice = await party();
    const bob = await party();
    const bundle = await bundleFor(bob);

    const { session: aSess, wire } = await R.initiatorHandshake({
      myIdentity: { ikPriv: alice.ik.privateKey, ikPub: alice.ik.pub },
      bundle, firstMessage: 'hello via orchestrator',
    });
    const { session: bSess, plaintext, opkId } = await R.responderHandshake({
      myKeys: { ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey },
      wire,
      opkResolver: (id) => (id === 0 ? bob.opk.privateKey : null),
    });
    expect(plaintext).toBe('hello via orchestrator');
    expect(opkId).toBe(0);
    // The bootstrapped sessions carry the rest of the conversation.
    expect(await R.ratchetDecrypt(aSess, await R.ratchetEncrypt(bSess, 'reply'))).toBe('reply');
  });

  it('completes the handshake when the responder OPK is exhausted (no OPK in bundle)', async () => {
    const alice = await party();
    const bob = await party();
    const bundle = await bundleFor(bob, { withOpk: false });
    const { wire } = await R.initiatorHandshake({
      myIdentity: { ikPriv: alice.ik.privateKey, ikPub: alice.ik.pub },
      bundle, firstMessage: 'no opk path',
    });
    const { plaintext } = await R.responderHandshake({
      myKeys: { ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey },
      wire, // opkResolver omitted — opkId is null so it is never called
    });
    expect(plaintext).toBe('no opk path');
  });

  it('THROWS (does not establish a session) when the bundle signature is forged — I1 MITM defense is unskippable', async () => {
    const alice = await party();
    const bob = await party();
    const mallory = await party(); // on-path relay swaps in her own pre-key
    // Bundle presents Mallory's SPK but is "signed" with a signature that cannot match
    // Bob's published Ed25519 identity. initiatorHandshake must abort BEFORE deriving.
    const forged = {
      ikPub: bob.ik.pub, edIkPub: bob.ed.pub,
      spkPub: mallory.spk.pub,
      spkSig: await R.signSPK(mallory.ed.privateKey, mallory.spk.pub),
      opkPub: mallory.opk.pub, opkId: 0,
    };
    await expect(R.initiatorHandshake({
      myIdentity: { ikPriv: alice.ik.privateKey, ikPub: alice.ik.pub },
      bundle: forged, firstMessage: 'should never be sent',
    })).rejects.toThrow(/MITM|INVALID/);
  });

  it('THROWS when the bundle lacks the signature material (cannot authenticate)', async () => {
    const alice = await party();
    const bob = await party();
    await expect(R.initiatorHandshake({
      myIdentity: { ikPriv: alice.ik.privateKey, ikPub: alice.ik.pub },
      bundle: { ikPub: bob.ik.pub, spkPub: bob.spk.pub }, // no edIkPub / spkSig
      firstMessage: 'x',
    })).rejects.toThrow();
  });

  it('responderHandshake returns null for a non-prekey (plain ratchet) wire', async () => {
    const bob = await party();
    const plainRatchet = await R.ratchetEncrypt(
      (await R.pairFromSharedChain(new Uint8Array(32).fill(9))).sender, 'plain',
    );
    const r = await R.responderHandshake({
      myKeys: { ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey },
      wire: plainRatchet,
    });
    expect(r).toBe(null);
  });
});

describe('MITM defense (why the signature matters — the I1 fix)', () => {
  it('detects a relay that swaps in its own pre-key', async () => {
    const bob = await party();
    const mallory = await party(); // malicious relay
    // Bob signs HIS spk. Mallory cannot forge Bob's Ed25519 identity, so a bundle
    // presenting Mallory's spk under Bob's identity fails verification → Alice aborts.
    const bobSig = await R.signSPK(bob.ed.privateKey, bob.spk.pub);
    expect(await R.verifySPK(bob.ed.pub, mallory.spk.pub, bobSig)).toBe(false);
    // Mallory signing with her own key also fails against Bob's published identity.
    const malSig = await R.signSPK(mallory.ed.privateKey, mallory.spk.pub);
    expect(await R.verifySPK(bob.ed.pub, mallory.spk.pub, malSig)).toBe(false);
  });
});
