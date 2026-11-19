import { describe, it, expect, vi, afterEach } from 'vitest';
import worker, { handlePreKeyUpload, handleMsgPoll, handleSealedPoll, handleSealedAck, handleAccountDelete } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { makeDOEnv } from './helpers/mockDO.js';

const id = 'owner001';
const b64 = bytes => Buffer.from(bytes).toString('base64');
const req = () => apiRequest('/api/test', {});
async function key() {
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  return { pair, pub: b64(await crypto.subtle.exportKey('raw', pair.publicKey)) };
}
async function sign(k, challenge, ts = Date.now()) {
  return { ts, sig: b64(await crypto.subtle.sign('Ed25519', k.pair.privateKey, new TextEncoder().encode(challenge(ts)))) };
}
async function bundle(k) {
  const spk = crypto.getRandomValues(new Uint8Array(32));
  return { userId: id, identityKey: id + 'encryption', edIdentityKey: k.pub,
    signedPreKey: b64(spk), signedPreKeySig: b64(await crypto.subtle.sign('Ed25519', k.pair.privateKey, spk)) };
}
async function upload(env, body, k) {
  const fields = [body.identityKey, body.edIdentityKey || '', body.signedPreKey, body.signedPreKeySig || '', body.oneTimePreKeys || [], body.caps || [], body.x3dh || ''];
  const digest = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(fields)))).subarray(0, 16).toString('hex');
  return handlePreKeyUpload({ ...body, ...(k ? await sign(k, ts => `breeze-prekey-upload:${id}:${ts}:${digest}`) : {}) }, env, req());
}
afterEach(() => vi.restoreAllMocks());

describe('persistent prekey ownership', () => {
  it.each([undefined, 'false', 'true'])('survives bundle expiry; unsigned/new-owner uploads fail regardless of flag %s', async flag => {
    const env = makeEnv({ PREKEY_REQUIRE_AUTH: flag });
    const owner = await key(); const attacker = await key();
    expect((await upload(env, await bundle(owner), owner)).status).toBe(200);
    expect(env.KV.exp.has(`prekey-owner:${id}`)).toBe(false);
    env.KV.exp.set(`prekey:${id}`, Date.now() - 1);
    expect(await env.KV.get(`prekey:${id}`)).toBeNull();
    expect((await upload(env, await bundle(owner))).status).toBe(403);
    expect((await upload(env, await bundle(attacker), attacker)).status).toBe(403);
    expect((await upload(env, await bundle(owner), owner)).status).toBe(200);
    expect(JSON.parse(await env.KV.get(`prekey-owner:${id}`)).edIdentityKey).toBe(owner.pub);
  });

  it('migrates an existing bundle before rejecting an unsigned replacement', async () => {
    const env = makeEnv(); const owner = await key();
    await env.KV.put(`prekey:${id}`, JSON.stringify(await bundle(owner)), { expirationTtl: 60 });
    expect((await upload(env, await bundle(await key()))).status).toBe(403);
    expect(JSON.parse(await env.KV.get(`prekey-owner:${id}`)).edIdentityKey).toBe(owner.pub);
    expect(env.KV.exp.has(`prekey-owner:${id}`)).toBe(false);
  });

  it('allows only previous-owner-authorized rotation; queues use the new durable key, not stale bundle/cache', async () => {
    const env = makeEnv(); const a = await key(); const b = await key();
    expect((await upload(env, await bundle(a), a)).status).toBe(200);
    expect((await upload(env, await bundle(b), a)).status).toBe(200);
    await env.KV.put(`prekey:${id}`, JSON.stringify(await bundle(a)));
    globalThis._queueAuthKey = new Map([[id, a.pub]]);
    for (const [handler, op] of [[handleMsgPoll, 'msg-poll'], [handleSealedPoll, 'sealed-poll'], [handleSealedAck, 'sealed-ack']]) {
      expect((await handler({ id, ...await sign(a, ts => `breeze-${op}:${id}:${ts}`) }, env, req())).status).toBe(403);
      expect((await handler({ id, ...await sign(b, ts => `breeze-${op}:${id}:${ts}`) }, env, req())).status).toBe(200);
    }
  });

  it('does not let a signed request remove the ownership key', async () => {
    const env = makeEnv(); const owner = await key(); const body = await bundle(owner);
    expect((await upload(env, body, owner)).status).toBe(200);
    expect((await upload(env, { ...body, edIdentityKey: '', signedPreKeySig: '' }, owner)).status).toBe(403);
  });

  it.each([makeEnv, makeDOEnv])('rejects unsigned, forged, partial, stale and cross-operation queue proofs on both backends', async factory => {
    const env = factory({ QUEUE_REQUIRE_AUTH: 'false' }); const owner = await key(); const attacker = await key();
    await upload(env, await bundle(owner), owner);
    env.KV.exp.set(`prekey:${id}`, Date.now() - 1);
    for (const [handler, op] of [[handleMsgPoll, 'msg-poll'], [handleSealedPoll, 'sealed-poll'], [handleSealedAck, 'sealed-ack']]) {
      for (const auth of [{}, { ts: Date.now() }, { sig: 'partial' },
        await sign(attacker, ts => `breeze-${op}:${id}:${ts}`),
        await sign(owner, ts => `breeze-${op}:${id}:${ts}`, Date.now() - 10 * 60 * 1000),
        await sign(owner, ts => `breeze-other-op:${id}:${ts}`)]) {
        const response = await handler({ id, ...auth }, env, req());
        expect(response.status).toBeGreaterThanOrEqual(400);
      }
      expect((await handler({ id, ...await sign(owner, ts => `breeze-${op}:${id}:${ts}`) }, env, req())).status).toBe(200);
    }
  });

  it('authenticates mailbox WS from the owner after bundle expiry', async () => {
    const env = makeDOEnv({ MAILBOX_WS_ENABLED: 'true' }); const owner = await key();
    await upload(env, await bundle(owner), owner);
    env.KV.exp.set(`prekey:${id}`, Date.now() - 1);
    globalThis._rateLimitMap = new Map();
    const attach = vi.fn(async () => new Response('attached', { status: 202 }));
    vi.spyOn(env.MAILBOX_DO, 'get').mockReturnValue({ fetch: attach });
    const auth = await sign(owner, ts => `breeze-mailbox-ws:${id}:${ts}`);
    const r = await worker.fetch(new Request(`https://breeze.test/api/mailbox/ws?id=${id}&ts=${auth.ts}&sig=${encodeURIComponent(auth.sig)}`, { headers: { Upgrade: 'websocket' } }), env);
    expect(r.status).toBe(202);
    expect(attach).toHaveBeenCalledTimes(1);
    const unsigned = await worker.fetch(new Request(`https://breeze.test/api/mailbox/ws?id=${id}`, { headers: { Upgrade: 'websocket' } }), env);
    expect(unsigned.status).toBe(403);
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('preserves unsigned no-key accounts and warns only for explicit opt-out acceptance', async () => {
    const env = makeEnv({ PREKEY_REQUIRE_AUTH: 'false', QUEUE_REQUIRE_AUTH: 'false' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const body = { userId: id, identityKey: id + 'legacy', signedPreKey: 'legacy' };
    expect((await upload(env, body)).status).toBe(200);
    expect((await upload(env, body)).status).toBe(200);
    expect(await env.KV.get(`prekey-owner:${id}`)).toBeNull();
    for (const handler of [handleMsgPoll, handleSealedPoll, handleSealedAck]) expect((await handler({ id }, env, req())).status).toBe(200);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deprecated unsigned'));
  });

  it('fails closed on ownership read/write failures and corrupt records', async () => {
    const owner = await key(); const body = await bundle(owner);
    for (const mode of ['read', 'write', 'corrupt']) {
      const env = makeEnv();
      if (mode === 'read') vi.spyOn(env.KV, 'get').mockRejectedValue(new Error('offline'));
      if (mode === 'write') vi.spyOn(env.KV, 'put').mockRejectedValue(new Error('offline'));
      if (mode === 'corrupt') await env.KV.put(`prekey-owner:${id}`, 'broken');
      expect((await upload(env, body, owner)).status).toBe(503);
      if (mode !== 'write') expect((await handleMsgPoll({ id }, env, req())).status).toBe(503);
    }
  });

  it('allows authenticated account erasure after expiry and removes the permanent owner', async () => {
    const env = makeEnv(); const owner = await key();
    await upload(env, await bundle(owner), owner);
    await env.KV.put('alias:owner_alias', JSON.stringify({ pub: id + 'encryption' }));
    env.KV.exp.set(`prekey:${id}`, Date.now() - 1);
    const auth = await sign(owner, ts => `breeze-account-delete:${id}:${ts}`);
    expect((await handleAccountDelete({ userId: id, alias: 'owner_alias', ...auth }, env, req())).status).toBe(200);
    expect(await env.KV.get(`prekey-owner:${id}`)).toBeNull();
    expect(await env.KV.get('alias:owner_alias')).toBeNull();
  });
});
