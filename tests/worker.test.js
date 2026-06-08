import { describe, it, expect, beforeEach } from 'vitest';
import worker, {
  handleWebhook,
  handlePreKeyUpload,
  handlePreKeyFetch,
  handlePushSubscribe,
  handleGroupCreate,
  handleGroupJoin,
  handleGroupInfo,
  handleGroupKick,
  handleAbuseRecord,
  handleAbuseReport,
  handleSealedSend,
  handleSealedPoll,
  handleSealedAck,
  handleMsgSend,
  handleMsgPoll,
  validateUserId,
} from '../_worker.js';
import { makeKV, makeEnv, apiRequest, stripeSigHeader } from './helpers/mockKV.js';
import { createFranking } from '../src/crypto/franking.js';

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

  it('sets replenishOTP when OTP count drops to 5 or below', async () => {
    const env = makeEnv();
    await handlePreKeyUpload(
      { userId: 'low00001', identityKey: 'IK', signedPreKey: 'SPK', oneTimePreKeys: ['o0', 'o1', 'o2', 'o3', 'o4', 'o5'] },
      env, apiRequest('/api/prekey/upload', {}),
    );
    // Consume down to count=5 (should set replenishOTP flag on the 6th fetch).
    const r1 = await handlePreKeyFetch({ userId: 'low00001' }, env, apiRequest('/api/prekey/fetch', {}));
    expect((await r1.json()).replenishOTP).toBe(true); // count was 6 → now 5
  });
});

describe('prekey key-history audit log (I11 precursor)', () => {
  it('records an IK hash on first upload and returns it on fetch', async () => {
    const env = makeEnv();
    await handlePreKeyUpload(
      { userId: 'hist0001', identityKey: 'IK-A', signedPreKey: 'SPK' },
      env, apiRequest('/api/prekey/upload', {}),
    );
    const res = await handlePreKeyFetch({ userId: 'hist0001' }, env, apiRequest('/api/prekey/fetch', {}));
    const bundle = await res.json();
    expect(bundle.keyHistory).toBeDefined();
    expect(bundle.keyHistory.length).toBe(1);
    expect(bundle.keyHistory[0].h).toBeTruthy();
  });

  it('appends a new entry when the IK changes (rollover detection)', async () => {
    const env = makeEnv();
    const upload = (ik) => handlePreKeyUpload(
      { userId: 'hist0002', identityKey: ik, signedPreKey: 'SPK' },
      env, apiRequest('/api/prekey/upload', {}),
    );
    await upload('IK-original');
    await upload('IK-changed'); // key rollover
    const res = await handlePreKeyFetch({ userId: 'hist0002' }, env, apiRequest('/api/prekey/fetch', {}));
    const bundle = await res.json();
    expect(bundle.keyHistory.length).toBe(2);
    // The two entries have different hashes.
    expect(bundle.keyHistory[0].h).not.toBe(bundle.keyHistory[1].h);
  });

  it('does not duplicate an entry when uploading the same IK again', async () => {
    const env = makeEnv();
    const upload = () => handlePreKeyUpload(
      { userId: 'hist0003', identityKey: 'IK-stable', signedPreKey: 'SPK' },
      env, apiRequest('/api/prekey/upload', {}),
    );
    await upload();
    await upload();
    await upload();
    const res = await handlePreKeyFetch({ userId: 'hist0003' }, env, apiRequest('/api/prekey/fetch', {}));
    expect((await res.json()).keyHistory.length).toBe(1);
  });

  it('caps the log at 10 entries', async () => {
    const env = makeEnv();
    for (let i = 0; i < 15; i++) {
      await handlePreKeyUpload(
        { userId: 'hist0004', identityKey: `IK-${i}`, signedPreKey: 'SPK' },
        env, apiRequest('/api/prekey/upload', {}),
      );
    }
    const res = await handlePreKeyFetch({ userId: 'hist0004' }, env, apiRequest('/api/prekey/fetch', {}));
    expect((await res.json()).keyHistory.length).toBe(10);
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

describe('group epoch lifecycle (I3/G3 — bump on kick)', () => {
  const req = (b) => apiRequest('/api/group/x', b);
  async function setupGroup(env) {
    const create = await handleGroupCreate(
      { name: 'g', creatorId: 'creator1', creatorPub: 'cpub', creatorName: 'C' }, env, req({}));
    const { token } = await create.json();
    await handleGroupJoin({ token, memberId: 'bob00001', memberPub: 'bpub', memberName: 'B' }, env, req({}));
    await handleGroupJoin({ token, memberId: 'carol001', memberPub: 'cpub2', memberName: 'Ca' }, env, req({}));
    return token;
  }

  it('starts at epoch 0 and bumps on each kick', async () => {
    const env = makeEnv();
    const token = await setupGroup(env);
    const info0 = await (await handleGroupInfo({ token }, env, req({}))).json();
    expect(info0.epoch).toBe(0);

    const kick = await handleGroupKick({ token, kickId: 'carol001', adminId: 'creator1' }, env, req({}));
    const kj = await kick.json();
    expect(kj.ok).toBe(true);
    expect(kj.epoch).toBe(1); // bumped → remaining members rotate sender keys

    const info1 = await (await handleGroupInfo({ token }, env, req({}))).json();
    expect(info1.epoch).toBe(1);
    expect(info1.members.some((m) => m.id === 'carol001')).toBe(false); // actually removed
  });

  it('only the creator can kick (no epoch bump otherwise)', async () => {
    const env = makeEnv();
    const token = await setupGroup(env);
    const res = await handleGroupKick({ token, kickId: 'carol001', adminId: 'bob00001' }, env, req({}));
    expect(res.status).toBe(403);
    const info = await (await handleGroupInfo({ token }, env, req({}))).json();
    expect(info.epoch).toBe(0); // unchanged
  });

  it('kicking a non-member returns 404 without bumping epoch', async () => {
    const env = makeEnv();
    const token = await setupGroup(env);
    const res = await handleGroupKick({ token, kickId: 'nobody00', adminId: 'creator1' }, env, req({}));
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('NOT_MEMBER');
    const info = await (await handleGroupInfo({ token }, env, req({}))).json();
    expect(info.epoch).toBe(0); // no wasteful epoch churn
  });
});

describe('relay franking endpoints (I17 — verifiable abuse reporting)', () => {
  const F = createFranking();
  const b64 = (a) => Buffer.from(Uint8Array.from(a)).toString('base64');
  const req = (b) => apiRequest('/api/abuse/x', b);

  it('records a commitment and verifies a genuine report end-to-end', async () => {
    const env = makeEnv();
    const message = 'abusive content';
    const { commitment, opening } = await F.commit(message); // client-side franking
    const rec = await handleAbuseRecord({ frankId: 'm-001', commitment: b64(commitment) }, env, req({}));
    expect(rec.status).toBe(200);
    const rep = await handleAbuseReport({ frankId: 'm-001', message, opening: b64(opening) }, env, req({}));
    expect(rep.status).toBe(200);
    expect((await rep.json()).verified).toBe(true);
    expect(await env.KV.get('report:m-001')).toBeTruthy(); // recorded for moderation
  });

  it('rejects a report claiming a different message (binding)', async () => {
    const env = makeEnv();
    const { commitment, opening } = await F.commit('what was sent');
    await handleAbuseRecord({ frankId: 'm-002', commitment: b64(commitment) }, env, req({}));
    const rep = await handleAbuseReport({ frankId: 'm-002', message: 'a lie', opening: b64(opening) }, env, req({}));
    expect(rep.status).toBe(400);
    expect((await rep.json()).code).toBe('FRANK_MISMATCH');
  });

  it('404s a report for an unknown frankId', async () => {
    const env = makeEnv();
    const rep = await handleAbuseReport({ frankId: 'nope', message: 'x', opening: b64([1, 2, 3]) }, env, req({}));
    expect(rep.status).toBe(404);
  });

  it('does not overwrite an existing commitment for a frankId', async () => {
    const env = makeEnv();
    const a = await F.commit('first');
    await handleAbuseRecord({ frankId: 'm-003', commitment: b64(a.commitment) }, env, req({}));
    const b = await F.commit('second');
    const rec2 = await handleAbuseRecord({ frankId: 'm-003', commitment: b64(b.commitment) }, env, req({}));
    expect((await rec2.json()).existing).toBe(true);
    // The original commitment still stands.
    const rep = await handleAbuseReport({ frankId: 'm-003', message: 'first', opening: b64(a.opening) }, env, req({}));
    expect((await rep.json()).verified).toBe(true);
  });

  it('rejects an oversized frankId on record', async () => {
    const env = makeEnv();
    const { commitment } = await F.commit('x');
    const res = await handleAbuseRecord({ frankId: 'x'.repeat(129), commitment: b64(commitment) }, env, req({}));
    expect(res.status).toBe(400);
  });

  it('rejects an oversized report message (DoS guard)', async () => {
    const env = makeEnv();
    const { commitment } = await F.commit('x');
    await handleAbuseRecord({ frankId: 'm-dos', commitment: b64(commitment) }, env, req({}));
    const res = await handleAbuseReport({ frankId: 'm-dos', message: 'x'.repeat(256 * 1024 + 1), opening: b64([0]) }, env, req({}));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('MSG_TOO_LARGE');
  });
});

describe('sealed sender send / poll / ack', () => {
  const req = (b) => apiRequest('/api/sealed/x', b);

  it('queues an envelope and returns it on poll', async () => {
    const env = makeEnv();
    const send = await handleSealedSend({ to: 'bob00001', envelope: 'ENCRYPTED_PAYLOAD' }, env, req({}));
    expect(send.status).toBe(200);
    expect((await send.json()).ok).toBe(true);

    const poll = await handleSealedPoll({ id: 'bob00001' }, env, req({}));
    expect(poll.status).toBe(200);
    const { messages } = await poll.json();
    expect(messages.length).toBe(1);
    expect(messages[0].envelope).toBe('ENCRYPTED_PAYLOAD');
  });

  it('returns empty array when no sealed messages exist', async () => {
    const { messages } = await (await handleSealedPoll({ id: 'nobody1' }, makeEnv(), req({}))).json();
    expect(messages).toEqual([]);
  });

  it('ack deletes the sealed queue', async () => {
    const env = makeEnv();
    await handleSealedSend({ to: 'charlie1', envelope: 'payload' }, env, req({}));
    await handleSealedAck({ id: 'charlie1' }, env, req({}));
    const { messages } = await (await handleSealedPoll({ id: 'charlie1' }, env, req({}))).json();
    expect(messages).toEqual([]);
  });

  it('rejects ack with an invalid userId', async () => {
    const res = await handleSealedAck({ id: 'bad id!' }, makeEnv(), req({}));
    expect(res.status).toBe(400);
  });

  it('deduplicates identical envelopes sent twice (replay guard)', async () => {
    // Reset in-memory dedup map between tests
    globalThis._sealedDedup = new Map();
    const env = makeEnv();
    await handleSealedSend({ to: 'dave0001', envelope: 'SAME_PAYLOAD_XYZ' }, env, req({}));
    await handleSealedSend({ to: 'dave0001', envelope: 'SAME_PAYLOAD_XYZ' }, env, req({}));
    const { messages } = await (await handleSealedPoll({ id: 'dave0001' }, env, req({}))).json();
    expect(messages.length).toBe(1);
  });
});

describe('msg send / poll (1:1 relay path)', () => {
  const ip = '10.0.0.1';
  const req = (b) => apiRequest('/api/msg/x', b);
  // Reset per-isolate dedup map between tests.
  beforeEach(() => { globalThis._msgDedup = new Map(); });

  it('stores a message and returns it on poll', async () => {
    const env = makeEnv();
    const send = await handleMsgSend(
      { to: 'bob00001', from: 'alice001', payload: 'ENCRYPTED', ts: Date.now() },
      ip, env, req({}),
    );
    expect(send.status).toBe(200);
    expect((await send.json()).ok).toBe(true);

    const poll = await handleMsgPoll({ id: 'bob00001', lastTs: 0 }, env, req({}));
    const { messages } = await poll.json();
    expect(messages.length).toBe(1);
    expect(messages[0].payload).toBe('ENCRYPTED');
  });

  it('rejects a message with a timestamp outside ±5 min (replay guard)', async () => {
    const env = makeEnv();
    const stale = Date.now() - 6 * 60 * 1000; // 6 minutes ago
    const res = await handleMsgSend(
      { to: 'bob00001', from: 'alice001', payload: 'X', ts: stale },
      ip, env, req({}),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_TIMESTAMP');
  });

  it('rejects self-send', async () => {
    const env = makeEnv();
    const res = await handleMsgSend(
      { to: 'alice001', from: 'alice001', payload: 'X', ts: Date.now() },
      ip, env, req({}),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('SELF_SEND');
  });

  it('deduplicates an immediately repeated send (content-keyed)', async () => {
    const env = makeEnv();
    const body = { to: 'carol001', from: 'alice001', payload: 'SAME', ts: Date.now() };
    await handleMsgSend(body, ip, env, req({}));
    const r2 = await handleMsgSend(body, ip, env, req({}));
    expect((await r2.json()).dedup).toBe(true);
    const { messages } = await (await handleMsgPoll({ id: 'carol001', lastTs: 0 }, env, req({}))).json();
    expect(messages.length).toBe(1);
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
