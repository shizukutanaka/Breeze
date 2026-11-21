// Message franking core tests (roadmap I17): verifiable abuse reporting.
import { describe, it, expect } from 'vitest';
import { createFranking } from '../src/crypto/franking.js';

const F = createFranking();

describe('commit / verify', () => {
  it('a genuine report verifies (the reported plaintext was really sent)', async () => {
    const msg = 'abusive message';
    const { commitment, opening } = await F.commit(msg);
    expect(await F.verify(msg, commitment, opening)).toBe(true);
    // Relay-side report flow: relay recorded `commitment` at send time.
    expect(await F.verifyReport({ message: msg, opening, recordedCommitment: commitment })).toBe(true);
  });

  it('rejects a report claiming a different message (binding)', async () => {
    const { commitment, opening } = await F.commit('what was actually sent');
    expect(await F.verify('a message that was NOT sent', commitment, opening)).toBe(false);
  });

  it('rejects a wrong / forged opening', async () => {
    const msg = 'hello';
    const { commitment } = await F.commit(msg);
    const wrongOpening = Array.from(crypto.getRandomValues(new Uint8Array(32)));
    expect(await F.verify(msg, commitment, wrongOpening)).toBe(false);
  });

  it('a tampered opening fails', async () => {
    const msg = 'hello';
    const { commitment, opening } = await F.commit(msg);
    const bad = opening.slice(); bad[0] ^= 0xff;
    expect(await F.verify(msg, commitment, bad)).toBe(false);
  });

  it('fresh randomness per commit (hiding — same message → different commitments)', async () => {
    const a = await F.commit('same');
    const b = await F.commit('same');
    expect(a.commitment).not.toEqual(b.commitment);
    expect(a.opening).not.toEqual(b.opening);
    // Each still verifies against its own opening.
    expect(await F.verify('same', a.commitment, a.opening)).toBe(true);
    expect(await F.verify('same', b.commitment, b.opening)).toBe(true);
    // …but not cross-wise.
    expect(await F.verify('same', a.commitment, b.opening)).toBe(false);
  });

  it('works on binary messages and unicode', async () => {
    const bin = crypto.getRandomValues(new Uint8Array(200));
    const r1 = await F.commit(bin);
    expect(await F.verify(bin, r1.commitment, r1.opening)).toBe(true);
    const uni = '通報テスト 🚩';
    const r2 = await F.commit(uni);
    expect(await F.verify(uni, r2.commitment, r2.opening)).toBe(true);
  });

  it('works on an empty message (zero-length content)', async () => {
    const { commitment, opening } = await F.commit('');
    expect(await F.verify('', commitment, opening)).toBe(true);
    expect(await F.verify('not empty', commitment, opening)).toBe(false);
  });

  it('rejects a tampered commitment (binding — commit flipped)', async () => {
    const msg = 'tamper test';
    const { commitment, opening } = await F.commit(msg);
    const bad = commitment.slice(); bad[0] ^= 0xff;
    expect(await F.verify(msg, bad, opening)).toBe(false);
  });

  it('ctEqual returns false for different-length inputs (no throw)', () => {
    const a = new Uint8Array(32).fill(1);
    const b = new Uint8Array(16).fill(1);
    expect(F.ctEqual(a, b)).toBe(false);
    expect(F.ctEqual(b, a)).toBe(false);
    expect(F.ctEqual(new Uint8Array(0), new Uint8Array(0))).toBe(true);
  });

  // Item 74: verify must fail CLOSED (false, no throw) on missing/malformed input. The relay
  // may lack a recordedCommitment, and a reporter's (message, opening) is attacker-supplied;
  // u8(null)/toBytes(null) would otherwise throw an uncaught exception out of the handler.
  it('returns false (does not throw) on null/undefined commitment, opening, or message', async () => {
    const { commitment, opening } = await F.commit('hello');
    expect(await F.verify('hello', null, opening)).toBe(false);        // missing commitment
    expect(await F.verify('hello', undefined, opening)).toBe(false);
    expect(await F.verify('hello', commitment, null)).toBe(false);     // missing opening
    expect(await F.verify('hello', commitment, undefined)).toBe(false);
    expect(await F.verify(null, commitment, opening)).toBe(false);     // missing message
  });

  it('verifyReport returns false (does not throw) when the relay has no recordedCommitment', async () => {
    const { opening } = await F.commit('abuse');
    // Relay lost / never recorded the commitment → undefined. Must be a clean false.
    expect(await F.verifyReport({ message: 'abuse', opening, recordedCommitment: undefined })).toBe(false);
  });
});

// D08: asymmetric extension (AMF) — the sender's Ed25519 identity key signs
// the commitment context, so a verified report binds the SENDER (the
// symmetric core above cannot: anyone holding the opening can present it,
// and a malicious sender could commit to a message they never sent).
describe('AMF sender binding (D08)', () => {
  const b64 = (a) => Buffer.from(Uint8Array.from(a)).toString('base64');
  async function identity() {
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    return { priv: pair.privateKey, pubRaw: new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)) };
  }

  it('amfMessage is the canonical domain-separated string', () => {
    expect(F.amfMessage('fid12345', 'QUJD')).toBe('breeze-amf-v1:fid12345:QUJD');
  });

  it('a genuine tag verifies (roundtrip)', async () => {
    const id = await identity();
    const { commitment } = await F.commit('abusive message');
    const sig = await F.amfSign(id.priv, 'fid-0001', b64(commitment));
    expect(await F.amfVerify(id.pubRaw, sig, 'fid-0001', b64(commitment))).toBe(true);
  });

  it('recipient-side check catches a sender who signed a commitment to a DIFFERENT message', async () => {
    // The sender encrypts message A to the recipient but signs the commitment
    // to message B (fabrication attempt: later "prove" B was sent). The
    // recipient recomputes the commitment from the RECEIVED plaintext and the
    // tag no longer matches — the message's report capability is dropped.
    const id = await identity();
    const sent = await F.commit('what was actually sent');       // A: opening ships to recipient
    const fabricated = await F.commit('what the sender wishes they had sent'); // B
    const sig = await F.amfSign(id.priv, 'fid-0002', b64(fabricated.commitment));
    // Recipient side: commitment recomputed from (opening, received plaintext A).
    const recomputed = await F._hmac(Uint8Array.from(sent.opening), new TextEncoder().encode('what was actually sent'));
    expect(b64(recomputed)).toBe(b64(sent.commitment)); // sanity: A's own commitment
    expect(await F.amfVerify(id.pubRaw, sig, 'fid-0002', b64(recomputed))).toBe(false);
    // …while the tag DOES match B's commitment — the mismatch is the detection.
    expect(await F.amfVerify(id.pubRaw, sig, 'fid-0002', b64(fabricated.commitment))).toBe(true);
  });

  it('a tag from a different signer does not verify (no forged attribution)', async () => {
    const sender = await identity();
    const attacker = await identity();
    const { commitment } = await F.commit('abusive message');
    const forged = await F.amfSign(attacker.priv, 'fid-0003', b64(commitment));
    expect(await F.amfVerify(sender.pubRaw, forged, 'fid-0003', b64(commitment))).toBe(false);
  });

  it('verifyAmfReport binds a genuine report to the sender end-to-end', async () => {
    const id = await identity();
    const msg = 'abusive message';
    const { commitment, opening } = await F.commit(msg);
    const sig = await F.amfSign(id.priv, 'fid-0004', b64(commitment));
    expect(await F.verifyAmfReport({ message: msg, opening, recordedCommitment: commitment, frankId: 'fid-0004', sig, senderPub: id.pubRaw })).toBe(true);
  });

  it('verifyAmfReport rejects when the HMAC half fails even with a genuine tag', async () => {
    const id = await identity();
    const { commitment, opening } = await F.commit('real message');
    const sig = await F.amfSign(id.priv, 'fid-0005', b64(commitment));
    // Reporter swaps in a different message under the same opening.
    expect(await F.verifyAmfReport({ message: 'invented message', opening, recordedCommitment: commitment, frankId: 'fid-0005', sig, senderPub: id.pubRaw })).toBe(false);
  });

  it('amfVerify fails closed (false, no throw) on malformed input', async () => {
    const id = await identity();
    const { commitment } = await F.commit('x');
    const sig = await F.amfSign(id.priv, 'fid-0006', b64(commitment));
    expect(await F.amfVerify(null, sig, 'fid-0006', b64(commitment))).toBe(false);
    expect(await F.amfVerify(id.pubRaw, null, 'fid-0006', b64(commitment))).toBe(false);
    expect(await F.amfVerify(id.pubRaw, [1, 2, 3], 'fid-0006', b64(commitment))).toBe(false);
    expect(await F.amfVerify(id.pubRaw, sig, 'fid-0006', 'not-a-commitment')).toBe(false);
    expect(await F.amfVerify(new Uint8Array(10), sig, 'fid-0006', b64(commitment))).toBe(false);
  });
});
