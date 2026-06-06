import { describe, it, expect, beforeEach } from 'vitest';
import worker, {
  handleWebhook,
  handlePreKeyUpload,
  handlePreKeyFetch,
  handlePushSubscribe,
  validateUserId,
} from '../_worker.js';
import { makeKV, makeEnv, apiRequest, stripeSigHeader } from './helpers/mockKV.js';

// base64 helper for building signed prekey bundles in tests.
const toB64 = (bytes) => Buffer.from(bytes).toString('base64');

// The worker's in-memory rate limiter lives on globalThis; reset between tests
// so per-test request counts start clean.
beforeEach(() => { globalThis._rateLimitMap = new Map(); });

describe('routing & request validation (export default fetch)', () => {
  it('serves /api/health ok when KV is bound', async () => {
    const res = await worker.fetch(new Request('https://breeze.test/api/health'), makeEnv());
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.kv).toBe(true);
  });

  it('rejects non-POST on API routes with 405', async () => {
    const res = await worker.fetch(new Request('https://breeze.test/api/presence'), makeEnv());
    expect(res.status).toBe(405);
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = new Request('https://breeze.test/api/presence', {
      method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.1' }, body: '{not json',
    });
    const res = await worker.fetch(req, makeEnv());
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed userId', async () => {
    const res = await worker.fetch(apiRequest('/api/presence', { userId: 'bad id!!' }), makeEnv());
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_USER_ID');
  });

  it('rejects oversized bodies (413) via Content-Length', async () => {
    const req = new Request('https://breeze.test/api/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.2', 'Content-Length': String(2 * 1024 * 1024) },
      body: JSON.stringify({ userId: 'abc123' }),
    });
    const res = await worker.fetch(req, makeEnv());
    expect(res.status).toBe(413);
  });

  it('returns 503 when KV is not bound', async () => {
    const res = await worker.fetch(apiRequest('/api/presence', { userId: 'abc12345' }), {});
    expect(res.status).toBe(503);
  });
});

describe('rate limiting', () => {
  it('returns 429 with Retry-After once the per-path limit is exceeded', async () => {
    const env = makeEnv();
    const limit = 20; // /api/presence limit
    let last;
    for (let i = 0; i < limit + 1; i++) {
      last = await worker.fetch(apiRequest('/api/presence', { userId: 'abc123' }), env);
    }
    expect(last.status).toBe(429);
    expect(last.headers.get('Retry-After')).toBeTruthy();
    expect((await last.json()).code).toBe('RATE_LIMITED');
  });
});

describe('userId validation helper', () => {
  it('accepts plausible ids and rejects junk', () => {
    expect(validateUserId('abc123DEF')).toBeTruthy();
    expect(validateUserId('has space')).toBeFalsy();
    expect(validateUserId('bad!')).toBeFalsy();
  });
});

describe('prekey upload + fetch (OTP consumption)', () => {
  it('consumes exactly one one-time prekey per fetch and decrements the count', async () => {
    const env = makeEnv();
    const up = await handlePreKeyUpload(
      { userId: 'alice0001', identityKey: 'IK', signedPreKey: 'SPK', signedPreKeySig: 'SIG', oneTimePreKeys: ['o0', 'o1', 'o2'] },
      env, apiRequest('/api/prekey/upload', {}),
    );
    expect(up.status).toBe(200);
    expect(await env.KV.get('prekey:otp:alice0001:count')).toBe('3');

    const res1 = await handlePreKeyFetch({ userId: 'alice0001' }, env, apiRequest('/api/prekey/fetch', {}));
    const b1 = await res1.json();
    expect(b1.identityKey).toBe('IK');
    expect(b1.oneTimePreKey).toBeDefined();
    expect(await env.KV.get('prekey:otp:alice0001:count')).toBe('2');

    // Second fetch consumes a different OTP.
    const res2 = await handlePreKeyFetch({ userId: 'alice0001' }, env, apiRequest('/api/prekey/fetch', {}));
    const b2 = await res2.json();
    expect(b2.oneTimePreKey).toBeDefined();
    expect(b2.oneTimePreKey).not.toEqual(b1.oneTimePreKey);
    expect(await env.KV.get('prekey:otp:alice0001:count')).toBe('1');
  });

  it('404s when no bundle exists', async () => {
    const res = await handlePreKeyFetch({ userId: 'nobody0001' }, makeEnv(), apiRequest('/api/prekey/fetch', {}));
    expect(res.status).toBe(404);
  });
});

describe('prekey signed-prekey signature verification (I1/G2)', () => {
  // Build a signed prekey bundle: an Ed25519 identity key signs the (raw) SPK bytes.
  async function signedBundle(userId) {
    const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const edPub = new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey));
    const spk = crypto.getRandomValues(new Uint8Array(32)); // raw SPK public bytes
    const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, spk));
    return {
      userId, identityKey: 'IKx25519',
      edIdentityKey: toB64(edPub), signedPreKey: toB64(spk), signedPreKeySig: toB64(sig),
      ed, spk,
    };
  }

  it('accepts a validly signed bundle and returns the ed identity key on fetch', async () => {
    const env = makeEnv();
    const b = await signedBundle('signer001');
    const up = await handlePreKeyUpload(b, env, apiRequest('/api/prekey/upload', {}));
    expect(up.status).toBe(200);
    const res = await handlePreKeyFetch({ userId: 'signer001' }, env, apiRequest('/api/prekey/fetch', {}));
    const bundle = await res.json();
    expect(bundle.edIdentityKey).toBe(b.edIdentityKey);
    expect(bundle.signedPreKeySig).toBe(b.signedPreKeySig);
  });

  it('rejects a bundle whose signature does not match (MITM injection)', async () => {
    const env = makeEnv();
    const b = await signedBundle('signer002');
    // Attacker swaps in a different SPK but cannot forge the Ed25519 signature.
    b.signedPreKey = toB64(crypto.getRandomValues(new Uint8Array(32)));
    const up = await handlePreKeyUpload(b, env, apiRequest('/api/prekey/upload', {}));
    expect(up.status).toBe(400);
    expect((await up.json()).code).toBe('PREKEY_SIG_INVALID');
  });

  it('still accepts a legacy unsigned bundle (v4 transition)', async () => {
    const env = makeEnv();
    const up = await handlePreKeyUpload(
      { userId: 'legacy001', identityKey: 'IK', signedPreKey: 'SPK', oneTimePreKeys: ['o0'] },
      env, apiRequest('/api/prekey/upload', {}),
    );
    expect(up.status).toBe(200);
  });
});

describe('push subscribe SSRF guard', () => {
  const base = (endpoint) => ({ userId: 'bob000001', subscription: { endpoint } });

  it('rejects non-HTTPS endpoints', async () => {
    const res = await handlePushSubscribe(base('http://fcm.googleapis.com/x'), makeEnv(), apiRequest('/api/push/subscribe', {}));
    expect(res.status).toBe(400);
  });

  it('rejects untrusted hosts (SSRF target)', async () => {
    const res = await handlePushSubscribe(base('https://169.254.169.254/latest/meta-data'), makeEnv(), apiRequest('/api/push/subscribe', {}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Untrusted/);
  });

  it('accepts a trusted FCM endpoint', async () => {
    const res = await handlePushSubscribe(base('https://fcm.googleapis.com/fcm/send/abc'), makeEnv(), apiRequest('/api/push/subscribe', {}));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

describe('webhook signature + idempotency', () => {
  const secret = 'whsec_test_123';
  const env = () => makeEnv({ STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: secret });
  const event = JSON.stringify({
    id: 'evt_abc', type: 'checkout.session.completed',
    data: { object: { metadata: { userId: 'user00001', type: 'account_plan', slots: '4', plan: 'plus' } } },
  });

  function webhookReq(payload, sig) {
    return new Request('https://breeze.test/api/webhook', {
      method: 'POST', headers: { 'stripe-signature': sig }, body: payload,
    });
  }

  it('rejects an invalid signature with 400', async () => {
    const res = await handleWebhook(webhookReq(event, 't=1,v1=deadbeef'), env());
    expect(res.status).toBe(400);
  });

  it('processes a valid event then dedupes a retry (process-then-mark)', async () => {
    const e = env();
    const sig = await stripeSigHeader(event, secret);
    const res1 = await handleWebhook(webhookReq(event, sig), e);
    expect(res1.status).toBe(200);
    expect(await res1.text()).toBe('ok');
    // Slot was granted.
    const slots = JSON.parse(await e.KV.get('slots:user00001'));
    expect(slots.slots).toBe(4);
    // A retry of the same event id is swallowed as already processed.
    const res2 = await handleWebhook(webhookReq(event, await stripeSigHeader(event, secret)), e);
    expect(res2.status).toBe(200);
    expect(await res2.text()).toBe('Already processed');
  });
});
