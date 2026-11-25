import { describe, it, expect, beforeEach } from 'vitest';
import { handleMsgSend, handleSealedSend, handleSealedPoll } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

const sig = Buffer.alloc(64, 7).toString('base64');
const req = () => apiRequest('/api/msg', {});
beforeEach(() => { delete globalThis._msgDedup; delete globalThis._sealedDedup; });
describe('relay preservation of opaque group author fields', () => {
  it('the /msg field allowlist preserves signature/version without altering payload bytes', async () => {
    const env = makeEnv();
    const payload = '{ "v":3, "g":true }';
    expect((await handleMsgSend({ to: 'bob00001', from: 'alice001', payload, ts: Date.now(), groupId: 'g_1', isGroupSK: true, authorSigV: 1, authorSig: sig }, 'ip', env, req())).status).toBe(200);
    const stored = JSON.parse(await env.KV.get('inbox:bob00001'));
    expect(stored[0]).toMatchObject({ payload, authorSigV: 1, authorSig: sig, groupId: 'g_1' });
  });
  it.each([{ authorSig: 'x'.repeat(10000), authorSigV: 1 }, { authorSigV: 1 }, { authorSig: sig }, { authorSigV: 2, authorSig: sig }])('rejects malformed partial/oversized signature fields without storing: %s', async fields => {
    const env = makeEnv();
    expect((await handleMsgSend({ to: 'bob00001', from: 'alice001', payload: 'ciphertext', ...fields }, 'ip', env, req())).status).toBe(400);
    expect(await env.KV.get('inbox:bob00001')).toBeNull();
  });
  it('legacy unsigned /msg remains compatible', async () => {
    const env = makeEnv();
    expect((await handleMsgSend({ to: 'bob00001', from: 'alice001', payload: 'ciphertext' }, 'ip', env, req())).status).toBe(200);
    expect(JSON.parse(await env.KV.get('inbox:bob00001'))[0]).not.toHaveProperty('authorSig');
  });
  it.each([1, 2])('the old opaque sealed relay passes signature fields through unchanged (seal-v%i)', async version => {
    const env = makeEnv();
    const inner = { from: 'alice001', groupId: 'g_1', isGroupSK: true, authorSigV: 1, authorSig: sig };
    const envelope = JSON.stringify(version === 1 ? { ...inner, payload: 'ciphertext' } : { sv: 2, se: JSON.stringify(inner), payload: 'ciphertext', ts: 1 });
    expect((await handleSealedSend({ to: 'bob00001', envelope }, env, req())).status).toBe(200);
    const poll = await (await handleSealedPoll({ id: 'bob00001' }, env, req())).json();
    expect(poll.messages[0].envelope).toBe(envelope);
  });
});
