// Stage-3 step 5 (docs/PQ_STAGE3_PLAN.md D2/D5/D6): the PQXDH session
// facade (src/crypto/pqxdh.js) — the deployed ESM bridge index.html's v5
// session wiring calls as window.__breezePQXDH. The KEM is the REAL vendored
// ML-KEM-768 (no mocks): the combiner's correctness argument is "the pinned
// upstream, vector-verified in tests/mlkem.test.js", so these tests pin the
// FACADE's contracts around it — DH-part discipline, seed-record handling,
// fail-closed responder semantics, SK agreement with the pq.js reference in
// both directions, and a full first-message composition through the
// ratchet.js session bootstrap (initiatorSession/responderSession).
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPQSessionHelper, PQ_CIPHERTEXT_BYTES } from '../src/crypto/pqxdh.js';
import { createPQXDH, nobleKem768 } from '../src/crypto/pq.js';
import { createRatchet } from '../src/crypto/ratchet.js';
import {
  mintPQPreKey, pqSeedRecord, pqPublicKeyFromSeed, pqSecretKeyFromSeed, createPQKeyHelper,
} from '../src/crypto/pqkey.js';
import { createAtRest } from '../src/crypto/atrest.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const R = createRatchet();
const helper = createPQSessionHelper();
const hex = (b) => Buffer.from(b).toString('hex');

// A full classical cast: Alice and Bob with IK/SPK/(OPK), plus Bob's PQ pair.
async function cast({ opk = true } = {}) {
  const alice = { ik: await R.genRatchetKey(), ek: await R.genRatchetKey() };
  const bob = {
    ik: await R.genRatchetKey(), spk: await R.genRatchetKey(),
    opk: opk ? await R.genRatchetKey() : null,
    pq: mintPQPreKey(),
  };
  const partsA = [
    await R.ecdhBits(alice.ik.privateKey, bob.spk.pub),
    await R.ecdhBits(alice.ek.privateKey, bob.ik.pub),
    await R.ecdhBits(alice.ek.privateKey, bob.spk.pub),
  ];
  const partsB = [
    await R.ecdhBits(bob.spk.privateKey, alice.ik.pub),
    await R.ecdhBits(bob.ik.privateKey, alice.ek.pub),
    await R.ecdhBits(bob.spk.privateKey, alice.ek.pub),
  ];
  if (opk) {
    partsA.push(await R.ecdhBits(alice.ek.privateKey, bob.opk.pub));
    partsB.push(await R.ecdhBits(bob.opk.privateKey, alice.ek.pub));
  }
  return { alice, bob, partsA, partsB };
}

describe('pqxdh facade — initiate/respond with the real KEM', () => {
  it('initiator and responder derive the SAME 32-byte SK (4 DH parts, with OPK)', async () => {
    const { bob, partsA, partsB } = await cast();
    const { sk, ct } = await helper.initiateSK(partsA, bob.pq.publicKey);
    expect(sk.length).toBe(32);
    expect(ct).toHaveLength(PQ_CIPHERTEXT_BYTES);
    const skB = await helper.respondSK(partsB, pqSeedRecord(bob.pq.seed), ct);
    expect(hex(skB)).toBe(hex(sk));
  });

  it('agrees in the 3-part form too (OPKs exhausted)', async () => {
    const { bob, partsA, partsB } = await cast({ opk: false });
    const { sk, ct } = await helper.initiateSK(partsA, bob.pq.publicKey);
    const skB = await helper.respondSK(partsB, pqSeedRecord(bob.pq.seed), ct);
    expect(hex(skB)).toBe(hex(sk));
  });

  it('cross-agrees with the pq.js reference in both directions', async () => {
    const { bob, partsA, partsB } = await cast();
    const ref = createPQXDH({ kem: nobleKem768() });
    // facade initiates → reference responds
    const a = await helper.initiateSK(partsA, bob.pq.publicKey);
    const refResp = await ref.respond({
      dhParts: partsB, pqPreKeyPriv: pqSecretKeyFromSeed(bob.pq.seed),
      pqPreKeyPub: pqPublicKeyFromSeed(bob.pq.seed), ct: a.ct,
    });
    expect(hex(refResp.sk)).toBe(hex(a.sk));
    // reference initiates → facade responds
    const b = await ref.initiate({ dhParts: partsA, pqPreKeyPub: bob.pq.publicKey });
    const facResp = await helper.respondSK(partsB, pqSeedRecord(bob.pq.seed), b.ct);
    expect(hex(facResp)).toBe(hex(b.sk));
  });

  it('the PQ SK is domain-separated from the classical X3DH SK over the same keys', async () => {
    const { alice, bob, partsA } = await cast();
    const classical = await R.x3dhInitiator({
      ikPriv: alice.ik.privateKey, ekPriv: alice.ek.privateKey,
      ikPubPeer: bob.ik.pub, spkPubPeer: bob.spk.pub, opkPubPeer: bob.opk.pub,
    });
    const { sk } = await helper.initiateSK(partsA, bob.pq.publicKey);
    expect(hex(sk)).not.toBe(hex(classical));
  });

  it('a swapped ciphertext yields a DIFFERENT SK (transcript binding, not a shared one)', async () => {
    const { bob, partsA, partsB } = await cast();
    const first = await helper.initiateSK(partsA, bob.pq.publicKey);
    const second = await helper.initiateSK(partsA, bob.pq.publicKey);
    const skSwapped = await helper.respondSK(partsB, pqSeedRecord(bob.pq.seed), second.ct);
    expect(hex(skSwapped)).not.toBe(hex(first.sk));
  });
});

describe('pqxdh facade — fail-closed shapes', () => {
  it('respondSK returns null when the PQ private half is unavailable', async () => {
    const { bob, partsA, partsB } = await cast();
    const { ct } = await helper.initiateSK(partsA, bob.pq.publicKey);
    expect(await helper.respondSK(partsB, null, ct)).toBeNull();
    expect(await helper.respondSK(partsB, {}, ct)).toBeNull();
    expect(await helper.respondSK(partsB, { seed: [1, 2, 3] }, ct)).toBeNull();
    // A /keywrap-wrapped record is NOT a silent plaintext read.
    const atRest = createAtRest();
    const wrapped = await atRest.wrapJWK({ seed: Array.from(bob.pq.seed) }, 'passphrase-1', 'pq-priv');
    expect(await helper.respondSK(partsB, { wrapped }, ct)).toBeNull();
  });

  it('respondSK returns null for a ciphertext that is not ML-KEM-768-sized', async () => {
    const { bob, partsB } = await cast();
    expect(await helper.respondSK(partsB, pqSeedRecord(bob.pq.seed), [1, 2, 3])).toBeNull();
    expect(await helper.respondSK(partsB, pqSeedRecord(bob.pq.seed), new Array(1087).fill(0))).toBeNull();
  });

  it('initiateSK throws on a wrong-size public key and on DH-part counts outside 3–4', async () => {
    const { partsA } = await cast();
    await expect(helper.initiateSK(partsA, new Uint8Array(32))).rejects.toThrow(/expected 1184/);
    await expect(helper.initiateSK(partsA.slice(0, 2), mintPQPreKey().publicKey)).rejects.toThrow(/3–4 X3DH/);
    await expect(helper.initiateSK([], mintPQPreKey().publicKey)).rejects.toThrow(/3–4 X3DH/);
  });
});

describe('stage-3 step 5 — first-message composition (PQ SK → ratchet sessions)', () => {
  it('the first message decrypts under the PQ-established sessions', async () => {
    const { bob, partsA, partsB } = await cast();
    const { sk: skA, ct } = await helper.initiateSK(partsA, bob.pq.publicKey);
    const skB = await helper.respondSK(partsB, pqSeedRecord(bob.pq.seed), ct);
    const aliceSess = await R.initiatorSession(skA, bob.spk.pub);
    const bobSess = R.responderSession(skB, bob.spk.privateKey);
    const wire = await R.ratchetEncrypt(aliceSess, 'first contact, post-quantum');
    expect(await R.ratchetDecrypt(bobSess, wire)).toBe('first contact, post-quantum');
  });

  it('a swapped pqct makes the first message FAIL (never silently classical)', async () => {
    const { bob, partsA, partsB } = await cast();
    const first = await helper.initiateSK(partsA, bob.pq.publicKey);
    const second = await helper.initiateSK(partsA, bob.pq.publicKey);
    const skWrong = await helper.respondSK(partsB, pqSeedRecord(bob.pq.seed), second.ct);
    const aliceSess = await R.initiatorSession(first.sk, bob.spk.pub);
    const bobSess = R.responderSession(skWrong, bob.spk.privateKey);
    const wire = await R.ratchetEncrypt(aliceSess, 'first contact, post-quantum');
    let out = 'decrypted';
    try { out = await R.ratchetDecrypt(bobSess, wire); } catch { out = null; }
    expect(out).toBeNull();
  });
});

// The real generatePreKeyBundle, sliced verbatim (the tests/pqkey.test.js
// harness pattern), to pin step 5's cap emission against the actual code.
function sliceBetween(startMarker, endMarker) {
  const a = html.indexOf(startMarker);
  const b = html.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error(`slice markers not found: ${startMarker} .. ${endMarker}`);
  return html.slice(a, b);
}
function buildBundleBuilder(ed, signingPubB64, configExtra = {}) {
  const stores = new Map();
  const dbPut = async (store, value, key) => { stores.set(`${store}:${key}`, value); };
  let n = 0;
  const genRatchetKey = async () => ({
    priv: { fakeJwk: ++n },
    pub: crypto.getRandomValues(new Uint8Array(32)).buffer,
  });
  const fn = new Function(
    'genRatchetKey', 'dbPut', 'CONFIG', '_signingKey', '_signingPubB64',
    'CAPS_X3DH_V5', 'CAPS_GROUP_V5', 'CAPS_SEAL_V2', 'CAPS_MULTI_RELAY', 'CAPS_PQXDH',
    'homeRelays', '_dbg',
    `${sliceBetween('async function generatePreKeyBundle', 'async function createIdentity')}
     return { generatePreKeyBundle };`);
  const { generatePreKeyBundle } = fn(
    genRatchetKey, dbPut,
    { PREKEY_OTP_COUNT: 3, X3DH_V5_ENABLED: true, GROUP_RATCHET_V5: true, SEAL_V2_ENABLED: true, MULTI_RELAY_ENABLED: true, ...configExtra },
    { privateKey: ed.privateKey }, signingPubB64,
    'x3dh-v5', 'group-v5', 'seal-v2', 'multi-relay', 'pqxdh',
    () => [], () => {},
  );
  return { generatePreKeyBundle, stores };
}
const newIdentity = async () => {
  const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pubB64 = Buffer.from(new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey))).toString('base64');
  return { ed, pubB64 };
};
afterEach(() => { delete globalThis.__breezePQKey; });

describe('stage-3 step 5 — pqxdh cap emission (real generatePreKeyBundle, sliced)', () => {
  it('flag ON + pair minted: caps gain pqxdh after the classical set', async () => {
    const { ed, pubB64 } = await newIdentity();
    globalThis.__breezePQKey = createPQKeyHelper();
    const { generatePreKeyBundle } = buildBundleBuilder(ed, pubB64, { PQXDH_ENABLED: true });
    const bundle = await generatePreKeyBundle();
    expect(bundle.pqPreKey).toBeTruthy();
    expect(bundle.caps).toEqual(['x3dh-v5', 'group-v5', 'seal-v2', 'multi-relay', 'pqxdh']);
  });

  it('flag ON + helper absent: no pair, and NO pqxdh cap (never advertise an unservable capability)', async () => {
    const { ed, pubB64 } = await newIdentity();
    delete globalThis.__breezePQKey;
    const { generatePreKeyBundle } = buildBundleBuilder(ed, pubB64, { PQXDH_ENABLED: true });
    const bundle = await generatePreKeyBundle();
    expect('pqPreKey' in bundle).toBe(false);
    expect(bundle.caps).toEqual(['x3dh-v5', 'group-v5', 'seal-v2', 'multi-relay']);
  });

  it('flag OFF (the shipped default) + pair minted: pair served, cap withheld (step-3 state)', async () => {
    const { ed, pubB64 } = await newIdentity();
    globalThis.__breezePQKey = createPQKeyHelper();
    const { generatePreKeyBundle } = buildBundleBuilder(ed, pubB64, { PQXDH_ENABLED: false });
    const bundle = await generatePreKeyBundle();
    expect(bundle.pqPreKey).toBeTruthy();
    expect(bundle.caps).not.toContain('pqxdh');
  });
});

describe('stage-3 step 5 — deployment shape (structural pins)', () => {
  it('index.html runtime-imports the facade and exposes it as window.__breezePQXDH', () => {
    expect(html).toContain("import { createPQSessionHelper } from './src/crypto/pqxdh.js';");
    expect(html).toContain('window.__breezePQXDH = createPQSessionHelper();');
  });

  it('the shipped flag default is OFF', () => {
    expect(html).toContain('PQXDH_ENABLED: false');
  });

  it('sw.js precaches the facade closure for offline boots', () => {
    const sw = readFileSync(join(HERE, '..', 'sw.js'), 'utf8');
    for (const p of ['/src/crypto/pqxdh.js', '/src/crypto/pq.js']) {
      expect(sw).toContain(`'${p}'`);
    }
  });
});
