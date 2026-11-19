// Generate tests/vectors/session-kat.json — the published,
// replayable session-level known-answer vector for Breeze's
// X3DH v5 → Double Ratchet path (SHARE_PLAN stage 7 step 2).
// Keys are generated ONCE and their private halves are published
// as JWKs inside the vector file (they are test-only keys that
// have never held a real identity), so anyone can re-derive the
// shared secret and decrypt the recorded first message with an
// independent implementation. Re-run only to rotate the vector;
// tests/session-vectors.test.js replays the committed file.
import { createRatchet } from '../src/crypto/ratchet.js';
import { writeFileSync } from 'node:fs';

const R = createRatchet();
const subtle = globalThis.crypto.subtle;
const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
const jwk = async (k) => subtle.exportKey('jwk', k);

const party = async () => ({
  ik: await R.genRatchetKey(), spk: await R.genRatchetKey(), opk: await R.genRatchetKey(), ed: await R.genSigningKey(),
});

const alice = await party();
const bob = await party();
const ek = await R.genRatchetKey();
const spkSig = await R.signSPK(bob.ed.privateKey, bob.spk.pub);

const skA = await R.x3dhInitiator({ ikPriv: alice.ik.privateKey, ekPriv: ek.privateKey, ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub, opkPubPeer: bob.opk.pub });
const skB = await R.x3dhResponder({ ikPriv: bob.ik.privateKey, spkPriv: bob.spk.privateKey, opkPriv: bob.opk.privateKey, ikPubPeer: alice.ik.pub, ekPubPeer: ek.pub });
if (hex(skA) !== hex(skB)) throw new Error('SK mismatch at generation time');

const sessA = await R.initiatorSession(skA, bob.spk.pub);
const { msgKey, nextChain } = await R.kdfChain(sessA.sendChainKey);
// Capture the session state BEFORE ratchetEncrypt advances it —
// the recorded sendChainKey must be the one firstMessageKey was
// derived from, not its successor.
const aliceSessionState = { rootKey: hex(sessA.rootKey), sendChainKey: hex(sessA.sendChainKey), ratchetPub: hex(new Uint8Array(sessA.ratchetPub)) };
const plaintext = 'Breeze audit vector #1 — session establishment';
const wire = await R.ratchetEncrypt(sessA, plaintext);

const sessB = R.responderSession(skB, bob.spk.privateKey);
const opened = await R.ratchetDecrypt(sessB, JSON.parse(JSON.stringify(wire)));
if (opened !== plaintext) throw new Error('round-trip failed at generation time');

const vector = {
  description: 'Breeze X3DH v5 (authenticated, with OPK) -> Double Ratchet first message. Test-only keys, generated once by tools/gen-session-vectors.mjs. Private keys are JWK (P-256 ECDH / Ed25519) so the derivation can be replayed independently; see tests/session-vectors.test.js.',
  curve: 'P-256 ECDH (the reference configuration; X25519 where available follows the same KDF schedule)',
  alice: {
    ikPub: hex(alice.ik.pub), ikPrivJwk: await jwk(alice.ik.privateKey),
    ekPub: hex(ek.pub), ekPrivJwk: await jwk(ek.privateKey),
  },
  bob: {
    ikPub: hex(bob.ik.pub), ikPrivJwk: await jwk(bob.ik.privateKey),
    spkPub: hex(bob.spk.pub), spkPrivJwk: await jwk(bob.spk.privateKey),
    opkPub: hex(bob.opk.pub), opkPrivJwk: await jwk(bob.opk.privateKey),
    edPub: hex(bob.ed.pub), spkSignature: hex(spkSig),
  },
  sharedSecret: hex(skA),
  aliceSession: aliceSessionState,
  firstMessageKey: hex(msgKey),
  chainKeyAfterFirst: hex(nextChain),
  plaintext,
  firstWireMessage: wire,
};
writeFileSync(new URL('../tests/vectors/session-kat.json', import.meta.url), JSON.stringify(vector, null, 2) + '\n');
console.log('session-kat.json written; SK =', vector.sharedSecret.slice(0, 16) + '…');
