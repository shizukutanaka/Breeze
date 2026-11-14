// Stage-3 step 3 (docs/PQ_STAGE3_PLAN.md, design D3/D4): the CLIENT mints
// PQ key material. src/crypto/pqkey.js is the detached helper — it builds
// the signed ML-KEM-768 prekey pair for the bundle and shapes the at-rest
// seed record; index.html loads it as an ESM (INTEGRATION.md §0(A)) and
// generatePreKeyBundle attaches the pair opportunistically. These tests
// pin: the helper's shapes, the REAL client auth (sliced from index.html)
// emitting the v2 digest the step-2 Worker demands, the full
// generate → upload → fetch round-trip through the real Worker, the seed
// never leaving the device, and the degradation contract (helper absent
// or failing ⇒ the bundle is the classical one, byte for byte in shape).
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mintPQPreKey, signPQPreKey, buildPQBundleFields,
  pqSeedRecord, pqSeedFromRecord, pqPublicKeyFromSeed, pqSecretKeyFromSeed,
  pqDigestTail, bundleHasPQFields, pqPublicKeyBytes, createPQKeyHelper,
  PQ_SEED_BYTES, PQ_PUBLIC_KEY_BYTES,
} from '../src/crypto/pqkey.js';
import { createAtRest } from '../src/crypto/atrest.js';
import { ml_kem768 } from '../src/crypto/mlkem.js';
import { handlePreKeyUpload, handlePreKeyFetch } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const toB64 = (bytes) => Buffer.from(bytes).toString('base64');
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function sliceBetween(startMarker, endMarker) {
  const a = html.indexOf(startMarker);
  const b = html.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error(`slice markers not found: ${startMarker} .. ${endMarker}`);
  return html.slice(a, b);
}

// The client's real auth block (signMessage → prekeyUploadAuth), sliced
// verbatim and bound to a real Ed25519 identity.
function buildClientAuth(ed, userId) {
  const fn = new Function('_signingKey', 'myId', '_dbg',
    `${sliceBetween('async function signMessage', 'async function verifySignature')}
     return { prekeyUploadAuth };`);
  return fn({ privateKey: ed.privateKey }, userId, () => {});
}

// The real generatePreKeyBundle, sliced verbatim, over an in-memory IDB.
// `configExtra` merges into the CONFIG shim (stage-3 step 5 tests flip
// PQXDH_ENABLED through it; the default shim leaves it off, which is also
// what pins the step-3 "no pqxdh cap" assertions below).
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
  const pubB64 = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey)));
  return { ed, pubB64 };
};

afterEach(() => { delete globalThis.__breezePQKey; });

describe('pqkey helper — minting and signing', () => {
  it('mints an ML-KEM-768 pair: 64-byte seed, 1,184-byte public key (1,580 base64 chars)', () => {
    const m = mintPQPreKey();
    expect(m.seed.length).toBe(PQ_SEED_BYTES);
    expect(m.publicKey.length).toBe(PQ_PUBLIC_KEY_BYTES);
    expect(m.pqPreKey.length).toBe(1580);
    expect(fromB64(m.pqPreKey)).toEqual(m.publicKey);
  });

  it('is deterministic in the seed — the property store-the-seed rests on', () => {
    const seed = new Uint8Array(64).fill(7);
    const fixed = () => seed.slice();
    const a = mintPQPreKey(fixed);
    const b = mintPQPreKey(fixed);
    expect(a.pqPreKey).toBe(b.pqPreKey);
    // …and matches the vendored keygen directly (no re-implementation drift).
    expect(a.publicKey).toEqual(new Uint8Array(ml_kem768.keygen(seed).publicKey));
    expect(pqPublicKeyFromSeed(seed)).toEqual(a.publicKey);
    expect(pqSecretKeyFromSeed(seed).length).toBe(2400);
  });

  it('rejects a short RNG output instead of minting a weak key', () => {
    expect(() => mintPQPreKey(() => new Uint8Array(10))).toThrow(/RNG returned 10 bytes/);
  });

  it('signs the RAW public-key bytes — the signature verifies over them, not over base64', async () => {
    const { ed, pubB64 } = await newIdentity();
    const fields = await buildPQBundleFields({
      signRaw: (bytes) => crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, bytes),
    });
    // A real Ed25519 signature: 64 bytes → 88 base64 chars. (An early cut
    // coerced WebCrypto's ArrayBuffer result to an EMPTY string here —
    // which the Worker would have filed as an "unsigned" pair.)
    expect(fields.pqPreKeySig.length).toBe(88);
    const pub = await crypto.subtle.importKey('raw', fromB64(pubB64), { name: 'Ed25519' }, false, ['verify']);
    const rawBytes = fromB64(fields.pqPreKey);
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, pub, fromB64(fields.pqPreKeySig), rawBytes)).toBe(true);
    // The E2E-found SPK trap: a signature over the base64 TEXT must not verify.
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, pub, fromB64(fields.pqPreKeySig),
      new TextEncoder().encode(fields.pqPreKey))).toBe(false);
    // signPQPreKey alone rejects a missing signer (fail-closed construction).
    await expect(signPQPreKey(null, rawBytes)).rejects.toThrow(/signer must be injected/);
  });

  it('digest tail and presence shapes match the step-2 contract', () => {
    expect(pqDigestTail({})).toEqual(['', '']);
    expect(pqDigestTail({ pqPreKey: 'K', pqPreKeySig: 'S' })).toEqual(['K', 'S']);
    expect(pqDigestTail({ pqPreKey: 42, pqPreKeySig: null })).toEqual(['', '']);
    expect(bundleHasPQFields({})).toBe(false);
    expect(bundleHasPQFields({ pqPreKey: 'K' })).toBe(true);
    expect(bundleHasPQFields({ pqPreKeySig: 'S' })).toBe(true);
    const m = mintPQPreKey();
    expect(pqPublicKeyBytes(m.pqPreKey)).toEqual(m.publicKey);
    expect(pqPublicKeyBytes('not base64!!')).toBeNull();
    expect(pqPublicKeyBytes(toB64(new Uint8Array(32)))).toBeNull(); // wrong size class
  });
});

describe('pqkey helper — seed record (D4 at-rest shape)', () => {
  it('round-trips through the { seed: number[] } IDB record', () => {
    const { seed } = mintPQPreKey();
    const rec = pqSeedRecord(seed);
    expect(Array.isArray(rec.seed)).toBe(true);
    expect(rec.seed.length).toBe(64);
    expect(pqSeedFromRecord(rec)).toEqual(seed);
    // …and the recovered seed re-derives the SAME public key.
    expect(pqPublicKeyFromSeed(pqSeedFromRecord(rec))).toEqual(mintPQPreKey(() => seed.slice()).publicKey);
  });

  it('refuses malformed and WRAPPED records (never a silent plaintext read of a locked seed)', async () => {
    expect(pqSeedFromRecord(null)).toBeNull();
    expect(pqSeedFromRecord({})).toBeNull();
    expect(pqSeedFromRecord({ seed: [1, 2, 3] })).toBeNull();
    expect(pqSeedFromRecord({ seed: new Array(64).fill(300) })).toBeNull();
    const atRest = createAtRest();
    const { seed } = mintPQPreKey();
    const wrapped = await atRest.wrapJWK({ seed: Array.from(seed) }, 'passphrase-1', 'pq-priv');
    expect(pqSeedFromRecord({ wrapped })).toBeNull();
    // The /keywrap payload shape: unwrap returns the { seed } object itself.
    const payload = await atRest.unwrapJWK(wrapped, 'passphrase-1', 'pq-priv');
    expect(pqSeedFromRecord(payload)).toEqual(seed);
    // Slot binding: the same record under a different AAD context stays locked.
    expect(await atRest.unwrapJWK(wrapped, 'passphrase-1', 'signing')).toBeNull();
  });
});

describe('stage-3 step 3 — real client auth + real Worker round-trip', () => {
  const USER = 'pqstep3001';

  async function classicalBody(ed, pubB64) {
    const spk = crypto.getRandomValues(new Uint8Array(32));
    return {
      userId: USER,
      identityKey: USER + 'IKx25519',
      edIdentityKey: pubB64,
      signedPreKey: toB64(spk),
      signedPreKeySig: toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, spk))),
      oneTimePreKeys: ['otp-a', 'otp-b'],
      caps: ['x3dh-v5', 'group-v5'],
    };
  }

  it('generate → upload (v2) → fetch: the pair is stored and served; the seed never leaves the device', async () => {
    const { ed, pubB64 } = await newIdentity();
    const { prekeyUploadAuth } = buildClientAuth(ed, USER);
    const fields = await buildPQBundleFields({
      signRaw: (bytes) => crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, bytes),
    });
    const body = { ...(await classicalBody(ed, pubB64)), pqPreKey: fields.pqPreKey, pqPreKeySig: fields.pqPreKeySig };
    const auth = await prekeyUploadAuth(USER, body.identityKey, body);
    expect(auth.sig).toBeTruthy();

    const wire = JSON.stringify({ ...body, ...auth });
    // The seed — in every encoding — and the expanded secret key stay home.
    expect(wire).not.toContain(toB64(fields.seed));
    expect(wire).not.toContain(toB64(pqSecretKeyFromSeed(fields.seed)));
    expect(wire).not.toContain('"seed"');
    expect(Object.keys(body)).not.toContain('seed');

    const env = makeEnv({ PREKEY_REQUIRE_AUTH: 'true' });
    const up = await handlePreKeyUpload({ ...body, ...auth }, env, apiRequest('/api/prekey/upload', {}));
    expect(up.status).toBe(200); // 200 here PROVES the real client emitted v2: step 2 rejects v1 for PQ bodies
    const stored = JSON.parse(await env.KV.get(`prekey:${USER}`));
    expect(stored.pqPreKey).toBe(fields.pqPreKey);
    expect(stored.pqPreKeySig).toBe(fields.pqPreKeySig);

    const fetched = await (await handlePreKeyFetch({ userId: USER }, env, apiRequest('/api/prekey/fetch', {}))).json();
    expect(fetched.pqPreKey).toBe(fields.pqPreKey);
    expect(fetched.pqPreKeySig).toBe(fields.pqPreKeySig);
  });

  it('the v2 signature binds the pair: swapping pqPreKey after signing is rejected', async () => {
    const { ed, pubB64 } = await newIdentity();
    const { prekeyUploadAuth } = buildClientAuth(ed, USER);
    const fields = await buildPQBundleFields({
      signRaw: (bytes) => crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, bytes),
    });
    const body = { ...(await classicalBody(ed, pubB64)), pqPreKey: fields.pqPreKey, pqPreKeySig: fields.pqPreKeySig };
    const auth = await prekeyUploadAuth(USER, body.identityKey, body);
    // A DIFFERENT genuine pair, self-consistently signed by the same
    // identity — so the Worker's pair check passes and only the ownership
    // digest (computed over the ORIGINAL pair) can catch the swap.
    const other = await buildPQBundleFields({
      signRaw: (bytes) => crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, bytes),
    });
    const env = makeEnv({ PREKEY_REQUIRE_AUTH: 'true' });
    const up = await handlePreKeyUpload(
      { ...body, pqPreKey: other.pqPreKey, pqPreKeySig: other.pqPreKeySig, ...auth },
      env, apiRequest('/api/prekey/upload', {}));
    expect(up.status).toBe(403);
    expect((await up.json()).code).toBe('SIG_INVALID');
    expect(await env.KV.get(`prekey:${USER}`)).toBeNull();
  });

  it('a field-less bundle from the real client still signs v1 and verifies (pre-step-2 relays keep working)', async () => {
    const { ed, pubB64 } = await newIdentity();
    const { prekeyUploadAuth } = buildClientAuth(ed, USER);
    const body = await classicalBody(ed, pubB64);
    const auth = await prekeyUploadAuth(USER, body.identityKey, body);
    const env = makeEnv({ PREKEY_REQUIRE_AUTH: 'true' });
    const up = await handlePreKeyUpload({ ...body, ...auth }, env, apiRequest('/api/prekey/upload', {}));
    expect(up.status).toBe(200);
    const stored = JSON.parse(await env.KV.get(`prekey:${USER}`));
    expect('pqPreKey' in stored).toBe(false);
  });
});

describe('stage-3 step 3 — generatePreKeyBundle wiring (real function, sliced)', () => {
  it('helper present: signed pair attached, seed stored, NO pqxdh cap advertised', async () => {
    const { ed, pubB64 } = await newIdentity();
    globalThis.__breezePQKey = createPQKeyHelper();
    const { generatePreKeyBundle, stores } = buildBundleBuilder(ed, pubB64);
    const bundle = await generatePreKeyBundle();
    expect(bundle.pqPreKey.length).toBe(1580);
    // The attached signature verifies over the raw public-key bytes.
    const pub = await crypto.subtle.importKey('raw', fromB64(pubB64), { name: 'Ed25519' }, false, ['verify']);
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, pub, fromB64(bundle.pqPreKeySig), fromB64(bundle.pqPreKey))).toBe(true);
    // The seed record holds THIS bundle's key — and only the seed.
    const rec = stores.get('identity:pq-priv');
    expect(Object.keys(rec)).toEqual(['seed']);
    expect(pqPublicKeyFromSeed(pqSeedFromRecord(rec))).toEqual(fromB64(bundle.pqPreKey));
    // Negotiation stays OFF: caps are exactly the classical set.
    expect(bundle.caps).toEqual(['x3dh-v5', 'group-v5', 'seal-v2', 'multi-relay']);
    expect(bundle.caps).not.toContain('pqxdh');
  });

  it('rotation replaces the PQ keypair and the stored seed (SPK cadence, D4)', async () => {
    const { ed, pubB64 } = await newIdentity();
    globalThis.__breezePQKey = createPQKeyHelper();
    const { generatePreKeyBundle, stores } = buildBundleBuilder(ed, pubB64);
    const first = await generatePreKeyBundle();
    const firstSeed = pqSeedFromRecord(stores.get('identity:pq-priv'));
    const second = await generatePreKeyBundle();
    expect(second.pqPreKey).not.toBe(first.pqPreKey);
    expect(pqSeedFromRecord(stores.get('identity:pq-priv'))).not.toEqual(firstSeed);
    expect(pqPublicKeyFromSeed(pqSeedFromRecord(stores.get('identity:pq-priv')))).toEqual(fromB64(second.pqPreKey));
  });

  it('helper ABSENT: the bundle is the classical one and no pq-priv is written (degradation)', async () => {
    const { ed, pubB64 } = await newIdentity();
    delete globalThis.__breezePQKey;
    const { generatePreKeyBundle, stores } = buildBundleBuilder(ed, pubB64);
    const bundle = await generatePreKeyBundle();
    expect('pqPreKey' in bundle).toBe(false);
    expect('pqPreKeySig' in bundle).toBe(false);
    expect(stores.has('identity:pq-priv')).toBe(false);
    // Classical construction is untouched: SPK + OTPs + signing + caps.
    expect(bundle.signedPreKey).toBeTruthy();
    expect(bundle.oneTimePreKeys).toHaveLength(3);
    expect(bundle.edIdentityKey).toBe(pubB64);
    expect(bundle.signedPreKeySig).toBeTruthy();
  });

  it('helper THROWS: bundle building still succeeds classically (a PQ failure breaks nothing)', async () => {
    const { ed, pubB64 } = await newIdentity();
    globalThis.__breezePQKey = { mintPQPreKey() { throw new Error('KEM exploded'); } };
    const { generatePreKeyBundle, stores } = buildBundleBuilder(ed, pubB64);
    const bundle = await generatePreKeyBundle();
    expect('pqPreKey' in bundle).toBe(false);
    expect(stores.has('identity:pq-priv')).toBe(false);
    expect(bundle.signedPreKey).toBeTruthy();
    expect(bundle.signedPreKeySig).toBeTruthy();
  });
});

describe('stage-3 step 3 — /keywrap covers pq-priv (structural pins)', () => {
  const handler = sliceBetween("if (val === '/keywrap'", '// v3.3: /reply');

  it('enable path wraps the seed payload under the pq-priv AAD slot', () => {
    expect(handler).toContain("await _atRestWrap({ seed: storedPq2.seed }, pass, 'pq-priv')");
    expect(handler).toContain("dbGet('identity', 'pq-priv')");
  });

  it('disable path unwraps it back to the plain { seed } record', () => {
    expect(handler).toContain("await _atRestUnwrap(storedPq.wrapped || storedPq, pass, 'pq-priv')");
    expect(handler).toContain("await dbPut('identity', { seed: pqPayload.seed }, 'pq-priv')");
  });

  it('the runtime-import module script is in place (INTEGRATION.md §0(A))', () => {
    expect(html).toContain("import { createPQKeyHelper } from './src/crypto/pqkey.js';");
    expect(html).toContain('window.__breezePQKey = createPQKeyHelper();');
  });

  it('sw.js precaches the helper module closure for offline first boot', () => {
    const sw = readFileSync(join(HERE, '..', 'sw.js'), 'utf8');
    for (const p of ['/src/crypto/pqkey.js', '/src/crypto/mlkem.js', '/src/crypto/bytes.js']) {
      expect(sw).toContain(`'${p}'`);
    }
  });
});
