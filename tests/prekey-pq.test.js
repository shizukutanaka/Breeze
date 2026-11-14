// Stage-3 step 2 (docs/PQ_STAGE3_PLAN.md, design D3): the Worker stores,
// serves, and authenticates the bundle's PQ prekey pair — pqPreKey /
// pqPreKeySig, SPK-shaped — and the upload-ownership digest gains an
// appended v2 formula (9 fields) alongside the legacy v1 (7 fields).
// No client sends the PQ fields yet (that is step 3); everything here is
// additive, and a bundle without them behaves byte-identically to before.
import { describe, it, expect } from 'vitest';
import {
  handlePreKeyUpload,
  handlePreKeyFetch,
  handlePreKeyStatus,
} from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { ml_kem768 } from '../src/crypto/mlkem.js';

const toB64 = (bytes) => Buffer.from(bytes).toString('base64');
const upReq = () => apiRequest('/api/prekey/upload', {});
const fetchReq = () => apiRequest('/api/prekey/fetch', {});
const statusReq = () => apiRequest('/api/prekey/status', {});

// Build a full bundle: classical SPK pair + PQ pair, both signed by the
// same Ed25519 identity key over the RAW public-key bytes (the deployed
// signSPK doctrine). The PQ public key is a real ML-KEM-768 key (1,184
// bytes → 1,580 base64 chars) from the vendored implementation, so the
// size class exercised here is the production one.
async function pqBundle(userId) {
  const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const edIdentityKey = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey)));
  const spk = crypto.getRandomValues(new Uint8Array(32));
  const signedPreKeySig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, spk)));
  const seed = crypto.getRandomValues(new Uint8Array(64));
  const { publicKey: pqPub } = ml_kem768.keygen(seed);
  const pqPreKeySig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, pqPub)));
  return {
    ed,
    body: {
      userId,
      identityKey: userId + 'IKx25519',
      edIdentityKey,
      signedPreKey: toB64(spk),
      signedPreKeySig,
      pqPreKey: toB64(pqPub),
      pqPreKeySig,
      caps: ['x3dh-v5', 'group-v5', 'pqxdh'],
      oneTimePreKeys: ['otp-a', 'otp-b'],
    },
  };
}

// Replicates the Worker's sha256Short (hex of the first 16 SHA-256 bytes).
async function digestFields(...fields) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fields)));
  return Array.from(new Uint8Array(buf)).slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sign an upload-ownership proof the way prekeyUploadAuth does, under
// either digest formula. v2 = v1 fields with the PQ pair appended.
async function signUpload(ed, body, version) {
  const v1 = [
    body.identityKey, body.edIdentityKey || '', body.signedPreKey, body.signedPreKeySig || '',
    Array.isArray(body.oneTimePreKeys) ? body.oneTimePreKeys : [],
    Array.isArray(body.caps) ? body.caps : [],
    typeof body.x3dh === 'string' ? body.x3dh : '',
  ];
  const fields = version === 2 ? [...v1,
    typeof body.pqPreKey === 'string' ? body.pqPreKey : '',
    typeof body.pqPreKeySig === 'string' ? body.pqPreKeySig : ''] : v1;
  const digest = await digestFields(...fields);
  const ts = Date.now();
  const msg = new TextEncoder().encode(`breeze-prekey-upload:${body.userId}:${ts}:${digest}`);
  const sig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, msg)));
  return { ts, sig };
}

describe('stage-3 step 2 — PQ prekey pair storage and serving', () => {
  it('stores a well-formed PQ bundle and serves the pair via fetch and status', async () => {
    const env = makeEnv();
    const { body } = await pqBundle('pqstore01');
    expect(body.pqPreKey.length).toBe(1580); // ML-KEM-768 size class, pinned
    const up = await handlePreKeyUpload(body, env, upReq());
    expect(up.status).toBe(200);

    const stored = JSON.parse(await env.KV.get('prekey:pqstore01'));
    expect(stored.pqPreKey).toBe(body.pqPreKey);
    expect(stored.pqPreKeySig).toBe(body.pqPreKeySig);

    const fetched = await (await handlePreKeyFetch({ userId: 'pqstore01' }, env, fetchReq())).json();
    expect(fetched.pqPreKey).toBe(body.pqPreKey);
    expect(fetched.pqPreKeySig).toBe(body.pqPreKeySig);
    // The pqxdh cap rides the existing generic caps sanitization (step 2
    // adds no caps special case; negotiation itself is a later step).
    expect(fetched.caps).toEqual(['x3dh-v5', 'group-v5', 'pqxdh']);

    const status = await (await handlePreKeyStatus({ userId: 'pqstore01' }, env, statusReq())).json();
    expect(status.pqPreKey).toBe(body.pqPreKey);
    expect(status.pqPreKeySig).toBe(body.pqPreKeySig);
  });

  it('a bundle without PQ fields is stored and served without them (byte-identical legacy shape)', async () => {
    const env = makeEnv();
    const up = await handlePreKeyUpload(
      { userId: 'pqnone001', identityKey: 'pqnone001IK', signedPreKey: 'SPK', oneTimePreKeys: ['o0'] },
      env, upReq(),
    );
    expect(up.status).toBe(200);
    const stored = JSON.parse(await env.KV.get('prekey:pqnone001'));
    expect('pqPreKey' in stored).toBe(false);
    expect('pqPreKeySig' in stored).toBe(false);
    const status = await (await handlePreKeyStatus({ userId: 'pqnone001' }, env, statusReq())).json();
    expect('pqPreKey' in status).toBe(false);
  });
});

describe('stage-3 step 2 — PQ signature verification on upload', () => {
  it('rejects a tampered pqPreKey (signature no longer matches) and stores nothing', async () => {
    const env = makeEnv();
    const { body } = await pqBundle('pqtamp001');
    // Swap in a different genuine ML-KEM key; the identity signature over
    // the original no longer verifies (the MITM substitution D3 defends).
    const { publicKey: other } = ml_kem768.keygen(crypto.getRandomValues(new Uint8Array(64)));
    body.pqPreKey = toB64(other);
    const up = await handlePreKeyUpload(body, env, upReq());
    expect(up.status).toBe(400);
    expect((await up.json()).code).toBe('PQ_PREKEY_SIG_INVALID');
    expect(await env.KV.get('prekey:pqtamp001')).toBeNull();
  });

  it('rejects a pqPreKeySig made by a different identity key', async () => {
    const env = makeEnv();
    const { body } = await pqBundle('pqwrong01');
    const stranger = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const pqBytes = Uint8Array.from(atob(body.pqPreKey), c => c.charCodeAt(0));
    body.pqPreKeySig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, stranger.privateKey, pqBytes)));
    const up = await handlePreKeyUpload(body, env, upReq());
    expect(up.status).toBe(400);
    expect((await up.json()).code).toBe('PQ_PREKEY_SIG_INVALID');
  });

  it('rejects pqPreKeySig without pqPreKey (a signature nobody could ever verify)', async () => {
    const env = makeEnv();
    const { body } = await pqBundle('pqorphan1');
    delete body.pqPreKey;
    const up = await handlePreKeyUpload(body, env, upReq());
    expect(up.status).toBe(400);
    expect((await up.json()).code).toBe('PQ_PREKEY_SIG_INVALID');
  });

  it('rejects oversized PQ fields before any verification', async () => {
    const env = makeEnv();
    const { body } = await pqBundle('pqbig0001');
    const upKey = await handlePreKeyUpload({ ...body, userId: 'pqbig0001', identityKey: 'pqbig0001IKx25519', pqPreKey: 'A'.repeat(2001) }, env, upReq());
    expect(upKey.status).toBe(400);
    expect((await upKey.json()).code).toBe('FIELD_TOO_LARGE');
    const upSig = await handlePreKeyUpload({ ...body, userId: 'pqbig0002', identityKey: 'pqbig0002IKx25519', pqPreKeySig: 'A'.repeat(501) }, env, upReq());
    expect(upSig.status).toBe(400);
    expect((await upSig.json()).code).toBe('FIELD_TOO_LARGE');
  });

  it('rejects non-string PQ fields', async () => {
    const env = makeEnv();
    const { body } = await pqBundle('pqtype001');
    const upKey = await handlePreKeyUpload({ ...body, pqPreKey: { key: 'x' } }, env, upReq());
    expect(upKey.status).toBe(400);
    expect((await upKey.json()).code).toBe('INVALID_TYPE');
    const upSig = await handlePreKeyUpload({ ...body, pqPreKeySig: 12345 }, env, upReq());
    expect(upSig.status).toBe(400);
    expect((await upSig.json()).code).toBe('INVALID_TYPE');
  });
});

describe('stage-3 step 2 — upload digest v1/v2 dual acceptance', () => {
  const authEnv = () => makeEnv({ PREKEY_REQUIRE_AUTH: 'true' });

  it('legacy client: no PQ fields, v1 signature — still verifies', async () => {
    const env = authEnv();
    const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const edIdentityKey = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey)));
    const spk = crypto.getRandomValues(new Uint8Array(32));
    const body = {
      userId: 'pqauth001', identityKey: 'pqauth001IKx25519', edIdentityKey,
      signedPreKey: toB64(spk),
      signedPreKeySig: toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, spk))),
      oneTimePreKeys: ['otp-a'],
    };
    const auth = await signUpload(ed, body, 1);
    const up = await handlePreKeyUpload({ ...body, ...auth }, env, upReq());
    expect(up.status).toBe(200);
  });

  it('new client: PQ fields present, v2 signature — verifies and stores the pair', async () => {
    const env = authEnv();
    const { ed, body } = await pqBundle('pqauth002');
    const auth = await signUpload(ed, body, 2);
    const up = await handlePreKeyUpload({ ...body, ...auth }, env, upReq());
    expect(up.status).toBe(200);
    const stored = JSON.parse(await env.KV.get('prekey:pqauth002'));
    expect(stored.pqPreKey).toBe(body.pqPreKey);
    expect(stored.pqPreKeySig).toBe(body.pqPreKeySig);
  });

  it('PQ-aware client without PQ fields yet, v2 signature — verifies (v2 binds the empty append)', async () => {
    const env = authEnv();
    const { ed, body } = await pqBundle('pqauth003');
    delete body.pqPreKey;
    delete body.pqPreKeySig;
    const auth = await signUpload(ed, body, 2);
    const up = await handlePreKeyUpload({ ...body, ...auth }, env, upReq());
    expect(up.status).toBe(200);
  });

  it('PQ fields present but signed under v1 — rejected: v1 does not bind the key material', async () => {
    const env = authEnv();
    const { ed, body } = await pqBundle('pqauth004');
    const auth = await signUpload(ed, body, 1);
    const up = await handlePreKeyUpload({ ...body, ...auth }, env, upReq());
    expect(up.status).toBe(403);
    expect((await up.json()).code).toBe('SIG_INVALID');
    expect(await env.KV.get('prekey:pqauth004')).toBeNull();
  });

  it('v2 signature replayed with a swapped pqPreKey — rejected (the pair is inside the digest)', async () => {
    const env = authEnv();
    const { ed, body } = await pqBundle('pqauth005');
    const auth = await signUpload(ed, body, 2);
    const { publicKey: other } = ml_kem768.keygen(crypto.getRandomValues(new Uint8Array(64)));
    // Even with a self-consistent PQ pair attached, the captured ownership
    // signature was computed over the ORIGINAL pair and must not verify.
    const pqPreKeySig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, other)));
    const up = await handlePreKeyUpload({ ...body, pqPreKey: toB64(other), pqPreKeySig, ...auth }, env, upReq());
    expect(up.status).toBe(403);
    expect((await up.json()).code).toBe('SIG_INVALID');
  });
});
