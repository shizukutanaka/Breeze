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
