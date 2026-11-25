// SHARE_PLAN stage 7 step 2 — replay the published session
// vector. tests/vectors/session-kat.json records test-only keys
// (JWK), the X3DH shared secret both sides must derive, the
// first chain/message keys, and Alice's first wire message. An
// external auditor (or an independent implementation) can replay
// the same derivation; this test is the in-repo replay.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRatchet } from '../src/crypto/ratchet.js';

const v = JSON.parse(readFileSync(new URL('./vectors/session-kat.json', import.meta.url), 'utf8'));
const R = createRatchet();
const subtle = globalThis.crypto.subtle;
const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const ecPriv = (j) => subtle.importKey('jwk', j, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits', 'deriveKey']);

describe('published session vector (X3DH v5 → Double Ratchet)', () => {
  it('both sides re-derive the recorded shared secret from the recorded keys', async () => {
    const skA = await R.x3dhInitiator({
      ikPriv: await ecPriv(v.alice.ikPrivJwk), ekPriv: await ecPriv(v.alice.ekPrivJwk),
      ikPubPeer: unhex(v.bob.ikPub), spkPubPeer: unhex(v.bob.spkPub), opkPubPeer: unhex(v.bob.opkPub),
    });
    const skB = await R.x3dhResponder({
      ikPriv: await ecPriv(v.bob.ikPrivJwk), spkPriv: await ecPriv(v.bob.spkPrivJwk), opkPriv: await ecPriv(v.bob.opkPrivJwk),
      ikPubPeer: unhex(v.alice.ikPub), ekPubPeer: unhex(v.alice.ekPub),
    });
    expect(hex(skA)).toBe(v.sharedSecret);
    expect(hex(skB)).toBe(v.sharedSecret);
  });

  it("Bob's signed pre-key signature verifies against the recorded Ed25519 key", async () => {
    expect(await R.verifySPK(unhex(v.bob.edPub), unhex(v.bob.spkPub), unhex(v.bob.spkSignature))).toBe(true);
  });

  it('the first chain step yields the recorded message key', async () => {
    const { msgKey, nextChain } = await R.kdfChain(unhex(v.aliceSession.sendChainKey));
    expect(hex(msgKey)).toBe(v.firstMessageKey);
    expect(hex(nextChain)).toBe(v.chainKeyAfterFirst);
  });

  it("Bob's fresh responder session decrypts Alice's recorded first message", async () => {
    const sessB = R.responderSession(unhex(v.sharedSecret), await ecPriv(v.bob.spkPrivJwk));
    const opened = await R.ratchetDecrypt(sessB, JSON.parse(JSON.stringify(v.firstWireMessage)));
    expect(opened).toBe(v.plaintext);
  });
});
