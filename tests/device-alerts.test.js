import { describe, it, expect, vi } from 'vitest';
import { createDeviceAlerts, activityText, activityHash } from '../src/app/device-alerts.js';
import { createDeviceLink } from '../src/app/device-link.js';
import { bindingText } from '../src/app/device-keys.js';
import worker, { handleAccountActivity, handlePreKeyStatus, handleAccountDelete } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

const minute = 60000;
async function identity() {
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const ed = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64');
  const pub = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  const sign = async text => Buffer.from(await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(text))).toString('base64');
  return { pub, ed, sign, userId: pub.slice(0, 12) };
}
async function verify(text, sig, pub) {
  try { return await crypto.subtle.verify('Ed25519', await crypto.subtle.importKey('raw', Buffer.from(pub, 'base64'), 'Ed25519', false, ['verify']), Buffer.from(sig, 'base64'), new TextEncoder().encode(text)); } catch { return false; }
}
async function event(who, kind = 'session', id = 'b'.repeat(32)) {
  const e = { userId: who.userId, pub: who.pub, ed: who.ed, kind, id, ts: Date.now() };
  e.sig = await who.sign(activityText(e)); return e;
}
async function registry(who, list, ts = Date.now()) {
  const digest = (await activityHash(JSON.stringify(list))).slice(0, 32);
  return { root: who.pub, devices: list.map(pub => ({ pub, name: '' })), ts, sig: await who.sign(`breeze-device-set:${who.userId}:${ts}:${digest}`) };
}
async function fixture() {
  const who = await identity(), rows = new Map();
  let response = null;
  const D = { myId: () => who.userId, me: () => who.pub, ed: () => who.ed, api: () => true, minute,
    get: async (store, key) => structuredClone(rows.get(store + ':' + key)),
    put: async (store, value, key) => { rows.set(store + ':' + key, structuredClone(value)); return true; },
    post: vi.fn(async () => ({ ok: true, json: async () => response })), verify, sign: who.sign, ownTs: vi.fn(), dbg: vi.fn(), t: k => k, esc: s => s,
  };
  return { who, D, rows, module: createDeviceAlerts(D), state: () => rows.get('settings:device-alerts:v1'), setResponse: v => { response = v; } };
}

describe('device alert factory and signed registry extraction', () => {
  it('retains registry verification, revision publication and persistent device list', async () => {
    const f = await fixture(), other = await identity();
    f.setResponse(await registry(f.who, [f.who.pub, other.pub]));
    expect((await f.module.registry(f.who.userId, f.who.pub)).list).toEqual([f.who.pub, other.pub]);
    expect(f.D.ownTs).toHaveBeenCalled();
    expect(f.state().events).toMatchObject([{ kind: 'linked', device: other.pub, ack: false }]);
    expect(await f.module.security()).toContain(other.pub);
    const reloaded = createDeviceAlerts(f.D);
    await reloaded.registry(f.who.userId, f.who.pub);
    expect(f.state().events).toHaveLength(1);
    await reloaded.acknowledge(f.state().events[0].id);
    await createDeviceAlerts(f.D).registry(f.who.userId, f.who.pub);
    expect(f.state().events).toMatchObject([{ ack: true }]);
  });
  it('does not alert on a primary-only list or unchanged revision, and refuses rollback', async () => {
    const f = await fixture(), first = await registry(f.who, [f.who.pub], 100);
    f.setResponse(first); await f.module.registry(f.who.userId, f.who.pub);
    expect(f.state().events).toEqual([]);
    f.setResponse(await registry(f.who, [f.who.pub], 200)); await f.module.registry(f.who.userId, f.who.pub);
    f.setResponse(first); expect((await f.module.registry(f.who.userId, f.who.pub)).ts).toBe(200);
  });
  it('rejects forged, wrong-root, empty and malformed registries', async () => {
    const f = await fixture(), other = await identity();
    for (const value of [null, {}, { ...await registry(other, [other.pub]), root: f.who.pub }, await registry(f.who, []), { ...await registry(f.who, [f.who.pub]), ts: -1 }]) {
      f.setResponse(value); expect(await f.module.registry(f.who.userId, f.who.pub)).toBeNull();
    }
    expect(f.state()).toBeUndefined();
  });
  it('uses only a linked root pin or contact pin, never a relay-supplied signing key', async () => {
    const f = await fixture(), root = await identity();
    f.setResponse(await registry(root, [root.pub, f.who.pub]));
    expect(await f.module.registry(root.userId, root.pub)).toBeNull();
    f.rows.set('identity:account', { root: root.pub, rootEd: root.ed });
    expect((await f.module.registry(root.userId, root.pub)).list).toContain(f.who.pub);
    const peer = await identity(); f.setResponse(await registry(peer, [peer.pub]));
    f.rows.set('contacts:' + peer.userId, { sigPub: peer.ed });
    expect((await f.module.registry(peer.userId, peer.pub)).list).toEqual([peer.pub]);
    expect(f.state().registries[peer.userId]).toBeUndefined();
  });
  it('does not advance its baseline when persistence fails', async () => {
    const f = await fixture(); f.setResponse(await registry(f.who, [f.who.pub])); f.D.put = async () => false;
    expect(await f.module.registry(f.who.userId, f.who.pub)).toBeNull(); expect(f.state()).toBeUndefined();
  });
  it('detects equivocation without replacing the stored device list', async () => {
    const f = await fixture(), other = await identity();
    f.setResponse(await registry(f.who, [f.who.pub], 100)); await f.module.registry(f.who.userId, f.who.pub);
    f.setResponse(await registry(f.who, [f.who.pub, other.pub], 100)); expect(await f.module.registry(f.who.userId, f.who.pub)).toBeNull();
    expect(f.state().registries[f.who.userId].list).toEqual([f.who.pub]);
  });
});

describe('account activity and key discrepancy detection', () => {
  it('authenticates binding metadata independently and retains it when a relay strips metadata', async () => {
    const f = await fixture(), secondary = await identity();
    const proof = { v: 1, root: f.who.pub, rootEd: f.who.ed, pub: secondary.pub, ed: secondary.ed, nonce: 'a'.repeat(32), issuedAt: 100 };
    proof.sig = await f.who.sign(bindingText(proof));
    const rec = await registry(f.who, [f.who.pub, secondary.pub], 100);
    rec.devices[1].binding = { ...proof, ed: f.who.ed };
    f.setResponse(rec); await f.module.registry(f.who.userId, f.who.pub);
    expect(f.state().registries[f.who.userId].bindings).toEqual({});
    rec.devices[1].binding = proof; f.setResponse(rec); await f.module.registry(f.who.userId, f.who.pub);
    expect(f.state().events.filter(e => e.kind === 'binding')).toHaveLength(1);
    delete rec.devices[1].binding;
    f.setResponse(rec); await createDeviceAlerts(f.D).registry(f.who.userId, f.who.pub);
    expect(f.state().registries[f.who.userId].bindings[secondary.pub]).toEqual(proof);
    expect(f.state().events.filter(e => e.kind === 'binding')).toHaveLength(1);
    f.setResponse(await registry(f.who, [f.who.pub], 200)); await f.module.registry(f.who.userId, f.who.pub);
    expect(f.state().events.filter(e => e.kind === 'removed')).toMatchObject([{ device: secondary.pub }]);
    expect(f.state().registries[f.who.userId].bindings).toEqual({});
    await createDeviceAlerts(f.D).registry(f.who.userId, f.who.pub);
    expect(f.state().events.filter(e => e.kind === 'removed')).toHaveLength(1);
  });
  it('prefers the protected ceremony root pin to a conflicting public contact pin', async () => {
    const f = await fixture(), root = await identity(), wrong = await identity();
    f.rows.set('identity:account', { root: root.pub, rootEd: wrong.ed });
    f.rows.set('identity:verify:device-link', { binding: { root: root.pub, rootEd: root.ed } });
    f.rows.set('contacts:' + root.userId, { sigPub: wrong.ed });
    f.setResponse(await registry(root, [root.pub, f.who.pub]));
    expect((await f.module.registry(root.userId, root.pub)).list).toContain(f.who.pub);
  });
  it.each(['session', 'push'])('authenticates a new %s and persists acknowledgement across reload', async kind => {
    const f = await fixture(), e = await event(f.who, kind);
    await f.module.observeActivities({ events: [e] }, f.who.pub, f.who.ed, 'a'.repeat(32));
    expect(f.state().events).toMatchObject([{ kind, ts: e.ts }]);
    await f.module.acknowledge(f.state().events[0].id);
    await createDeviceAlerts(f.D).observeActivities({ events: [e] }, f.who.pub, f.who.ed, 'a'.repeat(32));
    expect(f.state().events).toMatchObject([{ ack: true }]);
  });
  it('rejects forged signatures, other-account events, future dates, bad kinds and IDs', async () => {
    const f = await fixture(), other = await identity(), e = await event(f.who);
    for (const bad of [{ ...e, sig: 'AA==' }, await event(other), { ...e, ts: Date.now() + 10 * minute }, { ...e, kind: 'admin' }, { ...e, id: '<script>' }, null])
      await f.module.observeActivities({ events: [bad] }, f.who.pub, f.who.ed, 'a'.repeat(32));
    expect(f.state()).toBeUndefined();
  });
  it('has no alerts for an empty list, own reload/session, or its own push rotation', async () => {
    const f = await fixture(), own = 'a'.repeat(32), push = 'c'.repeat(64);
    await f.module.observeActivities({}, f.who.pub, f.who.ed, own);
    await f.module.observeActivities({ events: [await event(f.who, 'session', own)] }, f.who.pub, f.who.ed, own);
    await f.module.announce('push', push);
    await createDeviceAlerts(f.D).observeActivities({ events: [await event(f.who, 'push', push)] }, f.who.pub, f.who.ed, own);
    expect(f.state().events).toEqual([]);
  });
  it('does not deduplicate independent linked-root and secondary installation IDs together', async () => {
    const f = await fixture(), root = await identity();
    await f.module.observeActivities({ events: [await event(root)] }, root.pub, root.ed, 'a'.repeat(32));
    await f.module.observeActivities({ events: [await event(f.who)] }, f.who.pub, f.who.ed, 'a'.repeat(32));
    expect(f.state().events).toHaveLength(2);
  });
  it.each(['identityKey', 'edIdentityKey'])('warns on relay %s overwrite or disappearance, not ordinary prekey rotation', async field => {
    const f = await fixture(), data = { identityKey: f.who.pub, edIdentityKey: f.who.ed, uploadedAt: Date.now(), pqPreKey: 'new' };
    await f.module.observeKeys(data, f.who.pub, f.who.ed); expect(f.state()).toBeUndefined();
    await f.module.observeKeys({ ...data, [field]: 'changed' }, f.who.pub, f.who.ed);
    await f.module.observeKeys({ ...data, [field]: null }, f.who.pub, f.who.ed);
    expect(f.state().events).toHaveLength(2); expect(f.state().events[0].kind).toBe('relayKeys');
    await f.module.observeKeys({ otpCount: 4 }, f.who.pub, f.who.ed); expect(f.state().events).toHaveLength(2);
  });
  it('does not swallow failed acknowledgement or announcement persistence', async () => {
    const f = await fixture(); await f.module.observeActivities({ events: [await event(f.who)] }, f.who.pub, f.who.ed, 'a'.repeat(32));
    f.D.put = async () => false;
    await expect(f.module.acknowledge(f.state().events[0].id)).rejects.toThrow('persistence');
    expect(f.state().events[0].ack).toBe(false);
    await expect(f.module.announce('session', 'a'.repeat(32))).rejects.toThrow('persistence');
  });
  it('serializes concurrent discoveries without dropping an alert', async () => {
    const f = await fixture();
    await Promise.all(['b', 'c'].map(async id => f.module.observeActivities({ events: [await event(f.who, 'session', id.repeat(32))] }, f.who.pub, f.who.ed, 'a'.repeat(32))));
    expect(f.state().events).toHaveLength(2);
  });
  it('suppresses its own push proof even when a read races its announcement response', async () => {
    const f = await fixture(), id = 'c'.repeat(64);
    f.D.post = async (_path, body) => {
      await f.module.observeActivities({ events: [body.event] }, f.who.pub, f.who.ed, 'a'.repeat(32));
      return { ok: true };
    };
    await f.module.announce('push', id); expect(f.state().events).toEqual([]);
  });
  it('checks real Worker evidence at boot/reload and detects key overwrite even when activity authentication fails', async () => {
    const f = await fixture(), env = makeEnv(), local = new Map();
    vi.stubGlobal('localStorage', { getItem: k => local.get(k), setItem: (k, v) => local.set(k, v) });
    try {
      await env.KV.put('prekey-owner:' + f.who.userId, JSON.stringify({ identityKey: f.who.pub, edIdentityKey: f.who.ed }));
      await env.KV.put('prekey:' + f.who.userId, JSON.stringify({ identityKey: f.who.pub, edIdentityKey: f.who.ed }));
      f.D.post = (path, body) => path === '/account/activity' ? handleAccountActivity(body, env, apiRequest('/api' + path, body)) : path === '/prekey/status' ? handlePreKeyStatus(body, env, apiRequest('/api' + path, body)) : Promise.resolve({ ok: false });
      await f.module.check(); expect(f.state().events).toEqual([]);
      await f.D.post('/account/activity', { userId: f.who.userId, event: await event(f.who) });
      await createDeviceAlerts(f.D).check(); expect(f.state().events).toMatchObject([{ kind: 'session' }]);
      const other = await identity(), overwritten = JSON.stringify({ identityKey: other.pub, edIdentityKey: other.ed });
      await env.KV.put('prekey:' + f.who.userId, overwritten); await env.KV.put('prekey-owner:' + f.who.userId, overwritten);
      await f.module.check(); expect(f.state().events.map(e => e.kind)).toEqual(['session', 'relayKeys']);
    } finally { vi.unstubAllGlobals(); }
  });
  it('reuses unlink for a standalone primary whose copied identity linked another device', async () => {
    const f = await fixture(), other = await identity(), post = vi.fn(async () => ({ ok: true }));
    const deps = { dbGet: async () => null, myPubB64: () => f.who.pub, myId: () => f.who.userId, fetchDeviceList: async () => [f.who.pub, other.pub], showConfirm: async () => true, signMessage: f.who.sign, postAPIRaw: post, bustDevCache: vi.fn(), showToast: vi.fn(), t: k => k, dbg: vi.fn() };
    await createDeviceLink(deps).handleCommand('/unlink 2');
    expect(post).toHaveBeenCalledWith('/device/set', expect.objectContaining({ devices: [{ pub: f.who.pub, name: 'primary' }] }));
    deps.dbGet = async () => ({ root: other.pub }); post.mockClear();
    await createDeviceLink(deps).handleCommand('/unlink 2'); expect(post).not.toHaveBeenCalled();
  });
});

async function workerFixture() {
  const who = await identity(), env = makeEnv();
  await env.KV.put('prekey-owner:' + who.userId, JSON.stringify({ identityKey: who.pub, edIdentityKey: who.ed }));
  await env.KV.put('prekey:' + who.userId, JSON.stringify({ identityKey: who.pub, edIdentityKey: who.ed }));
  const call = body => handleAccountActivity(body, env, apiRequest('/api/account/activity', body));
  const read = async (reader = who) => { const ts = Date.now(); return call({ userId: who.userId, reader: reader.userId, ts, sig: await reader.sign(`breeze-activity-read:${reader.userId}:${ts}`) }); };
  return { who, env, call, read };
}
describe('minimal Worker account activity endpoint', () => {
  it('accepts signed session/push claims, returns original evidence, and deduplicates reloads', async () => {
    const f = await workerFixture(), e = await event(f.who);
    expect((await f.call({ userId: f.who.userId, event: e })).status).toBe(200);
    expect((await f.call({ userId: f.who.userId, event: await event(f.who) })).status).toBe(200);
    expect((await f.call({ userId: f.who.userId, event: await event(f.who, 'push') })).status).toBe(200);
    const data = await (await f.read()).json(); expect(data.events).toHaveLength(2); expect(data.events).toContainEqual(e); expect(data.complete).toBe(true);
    expect((await (await handlePreKeyStatus({ userId: f.who.userId }, f.env, apiRequest('/api/prekey/status', {}))).json()).edIdentityKey).toBe(f.who.ed);
  });
  it('does not expose claims to unauthenticated or unlinked readers', async () => {
    const f = await workerFixture(), other = await identity();
    expect((await f.call({ userId: f.who.userId })).status).toBe(403);
    await f.env.KV.put('prekey-owner:' + other.userId, JSON.stringify({ identityKey: other.pub, edIdentityKey: other.ed }));
    expect((await f.read(other)).status).toBe(403);
    const reg = await registry(f.who, [f.who.pub, other.pub]); await f.env.KV.put('devices:' + f.who.userId, JSON.stringify(reg));
    expect((await f.read(other)).status).toBe(200);
    await f.env.KV.put('devices:' + f.who.userId, JSON.stringify({ ...reg, sig: 'AA==' })); expect((await f.read(other)).status).toBe(403);
  });
  it('rejects stale, malformed, forged or wrong-owner writes', async () => {
    const f = await workerFixture(), e = await event(f.who), other = await identity();
    for (const bad of [{ ...e, sig: 'AA==' }, { ...e, id: '<script>' }, { ...e, ts: Date.now() - 10 * minute }, { ...e, kind: 'delete' }, await event(other)])
      expect((await f.call({ userId: f.who.userId, event: bad })).status).toBeGreaterThanOrEqual(400);
    expect((await f.call({ userId: '<bad>' })).status).toBe(400);
    expect((await f.read()).status).toBe(200); expect((await (await f.read()).json()).events).toEqual([]);
  });
  it('stores independent claims independently and surfaces retention/truncation', async () => {
    const f = await workerFixture();
    await Promise.all(['b', 'c'].map(async id => f.call({ userId: f.who.userId, event: await event(f.who, 'session', id.repeat(32)) })));
    expect((await (await f.read()).json()).events).toHaveLength(2);
    for (const key of f.env.KV.exp.keys()) if (key.startsWith('activity:')) f.env.KV.exp.set(key, Date.now() - 1);
    expect((await (await f.read()).json()).events).toEqual([]);
    f.env.KV.list = async () => ({ keys: [], list_complete: false }); expect((await (await f.read()).json()).complete).toBe(false);
  });
  it('returns failure when KV cannot persist a claim', async () => {
    const f = await workerFixture(); f.env.KV.put = async () => { throw Error('storage offline'); };
    expect((await f.call({ userId: f.who.userId, event: await event(f.who) })).status).toBe(503);
  });
  it('routes through a per-endpoint limit and removes claims on account erasure', async () => {
    const f = await workerFixture(), body = { userId: f.who.userId, event: await event(f.who) };
    const ctx = { waitUntil: () => {} };
    const statuses = [];
    for (let n = 0; n < 31; n++) statuses.push((await worker.fetch(apiRequest('/api/account/activity', body, { 'CF-Connecting-IP': '203.0.113.199' }), f.env, ctx)).status);
    expect(statuses[0]).toBe(200); expect(statuses.at(-1)).toBe(429);
    const ts = Date.now(), sig = await f.who.sign(`breeze-account-delete:${f.who.userId}:${ts}`);
    expect((await handleAccountDelete({ userId: f.who.userId, ts, sig }, f.env, apiRequest('/api/account/delete', {}))).status).toBe(200);
    expect([...f.env.KV.store.keys()].filter(k => k.startsWith('activity:'))).toEqual([]);
  });
});
