import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import worker, { MailboxDO } from '../_worker.js';
import { makeDOEnv } from './helpers/mockDO.js';
import { apiRequest } from './helpers/mockKV.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function slice(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw Error('signal wake markers moved');
  return html.slice(a, b);
}
const b64 = value => Buffer.from(value).toString('base64');
async function identity(env, id) {
  const key = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  await env.KV.put(`prekey:${id}`, JSON.stringify({ edIdentityKey: b64(await crypto.subtle.exportKey('raw', key.publicKey)) }));
  return async room => {
    const ts = Date.now();
    return { ts, sig: b64(await crypto.subtle.sign('Ed25519', key.privateKey, new TextEncoder().encode(`breeze-sig:${room}:${id}:${ts}`))) };
  };
}
beforeEach(() => { globalThis._rateLimitMap = new Map(); globalThis._queueAuthKey = new Map(); });

describe('signal wake Worker / DO', () => {
  it.each([true, false])('notifies after an authenticated deposit (waitUntil=%s), persists generation and leaks no SDP', async background => {
    const env = makeDOEnv({ MAILBOX_WS_ENABLED: 'true' });
    const sign = await identity(env, 'alice001');
    const room = 'dm:alice001:bob00001';
    env.MAILBOX_DO.get(env.MAILBOX_DO.idFromName('bob00001'));
    const instance = env.MAILBOX_DO.instances.get('bob00001');
    const frames = [];
    instance.state.acceptWebSocket({ send: frame => frames.push(JSON.parse(frame)) });
    const pending = [];
    for (let i = 0; i < 2; i++) {
      const res = await worker.fetch(apiRequest('/api/signal', { room, sender: 'alice001', type: 'offer', data: 'PRIVATE-SDP', ...await sign(room) }), env,
        background ? { waitUntil: work => pending.push(work) } : undefined);
      expect(res.status).toBe(200);
    }
    await Promise.all(pending);
    expect(pending).toHaveLength(background ? 2 : 0);
    expect(frames).toEqual([{ type: 'signal' }, { type: 'signal' }]);
    expect(await instance.state.storage.get('sigGen')).toBe(2);
    // Recreate the adapter over durable storage: no in-memory counter is required.
    const restarted = new MailboxDO(instance.state, env);
    const raw = await restarted.fetch(new Request('https://mailbox.internal/op', { method: 'POST', body: JSON.stringify({ op: 'get', family: 'sealed', slot: 'queue', signalGeneration: true }) }));
    expect((await raw.json()).sigGen).toBe(2);
    for (const path of ['/api/msg/poll', '/api/sealed/poll']) {
      const poll = await worker.fetch(apiRequest(path, { id: 'bob00001' }), env);
      expect(await poll.json()).toEqual({ messages: [], sigGen: 2 });
    }
    const health = await (await worker.fetch(new Request('https://breeze.test/api/health'), env)).json();
    expect(health.features.signalWake).toBe(true);
  });
  it('waitUntil does not delay the deposit response', async () => {
    const env = makeDOEnv({ MAILBOX_WS_ENABLED: 'true' });
    const sign = await identity(env, 'alice001');
    const room = 'dm:alice001:bob00001';
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const realGet = env.MAILBOX_DO.get.bind(env.MAILBOX_DO);
    env.MAILBOX_DO.get = id => ({ fetch: async (...args) => { await held; return realGet(id).fetch(...args); } });
    let pending;
    const response = await worker.fetch(apiRequest('/api/signal', { room, sender: 'alice001', type: 'ice', ...await sign(room) }), env, { waitUntil: work => { pending = work; } });
    expect(response.status).toBe(200);
    expect(env.MAILBOX_DO.instances.size).toBe(0);
    release();
    await pending;
    expect(env.MAILBOX_DO.instances.size).toBe(1);
  });
  it('does not broadcast a generation that failed to persist', async () => {
    const env = makeDOEnv({ MAILBOX_WS_ENABLED: 'true' });
    const stub = env.MAILBOX_DO.get(env.MAILBOX_DO.idFromName('bob00001'));
    const instance = env.MAILBOX_DO.instances.get('bob00001');
    const send = vi.fn();
    instance.state.acceptWebSocket({ send });
    instance.state.storage.put = async () => { throw Error('storage down'); };
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await stub.fetch('https://mailbox.internal/op', { method: 'POST', body: JSON.stringify({ op: 'signal-wake' }) });
      expect(res.status).toBe(500);
      expect(send).not.toHaveBeenCalled();
      expect(await instance.state.storage.get('sigGen')).toBeUndefined();
      expect(log).toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it.each([
    { MAILBOX_WS_ENABLED: 'false' },
    { MAILBOX_BACKEND: 'kv', MAILBOX_WS_ENABLED: 'true' },
  ])('does not advertise or notify without both gates: %j', async flags => {
    const env = makeDOEnv(flags);
    const sign = await identity(env, 'alice001');
    const room = 'dm:alice001:bob00001';
    const ctx = { waitUntil: vi.fn() };
    expect((await worker.fetch(apiRequest('/api/signal', { room, sender: 'alice001', type: 'ice', ...await sign(room) }), env, ctx)).status).toBe(200);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(env.MAILBOX_DO.instances.size).toBe(0);
    expect((await (await worker.fetch(new Request('https://breeze.test/api/health'), env)).json()).features.signalWake).toBe(false);
  });
  it('requires authenticated DM deposits; polling, call rooms, generic rooms and unsigned legacy senders do not wake', async () => {
    const env = makeDOEnv({ MAILBOX_WS_ENABLED: 'true' });
    const sign = await identity(env, 'alice001');
    const ctx = { waitUntil: vi.fn() };
    for (const [room, type] of [['call:alice001:bob00001', 'offer'], ['other', 'offer'], ['dm:alice001:bob00001', 'poll']]) {
      expect((await worker.fetch(apiRequest('/api/signal', { room, sender: 'alice001', type, ...await sign(room) }), env, ctx)).status).toBe(200);
    }
    expect((await worker.fetch(apiRequest('/api/signal', { room: 'dm:alice001:bob00001', sender: 'alice001', type: 'offer' }), env, ctx)).status).toBe(403);
    expect((await worker.fetch(apiRequest('/api/signal', { room: 'dm:stranger:bob00001', sender: 'stranger', type: 'offer' }), env, ctx)).status).toBe(200);
    expect(ctx.waitUntil).not.toHaveBeenCalled();
    expect(env.MAILBOX_DO.instances.size).toBe(0);
  });
  it('does not wake after storage failure, and logs notification failure without failing a stored deposit', async () => {
    const env = makeDOEnv({ MAILBOX_WS_ENABLED: 'true' });
    const sign = await identity(env, 'alice001');
    const room = 'dm:alice001:bob00001';
    const put = env.KV.put.bind(env.KV);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      env.KV.put = async key => { if (key.startsWith('sig:')) throw Error('storage down'); };
      const ctx = { waitUntil: vi.fn() };
      expect((await worker.fetch(apiRequest('/api/signal', { room, sender: 'alice001', type: 'ice', ...await sign(room) }), env, ctx)).status).toBe(500);
      expect(ctx.waitUntil).not.toHaveBeenCalled();
      env.KV.put = put;
      env.MAILBOX_DO.get = () => { throw Error('DO unavailable'); };
      expect((await worker.fetch(apiRequest('/api/signal', { room, sender: 'alice001', type: 'ice', ...await sign(room) }), env)).status).toBe(200);
      expect(log).toHaveBeenCalledWith('[signal-wake]', 'DO unavailable');
    } finally { log.mockRestore(); }
  });
});

const start = new Function('MS', '_dbg', slice('  function startSignalPoll(', '\n  async function connectPeer(') + '\nreturn startSignalPoll;')({ SEC: 1000 }, () => {});
describe('signal scheduler pause / wake', () => {
  it('never pauses before establishment; pauses with no timer when connected, drains once and falls back on lost coverage', async () => {
    vi.useFakeTimers();
    try {
      let covered = true;
      const poll = vi.fn(async () => false);
      const controller = start(poll, () => covered);
      await vi.advanceTimersByTimeAsync(2000);
      expect(poll).toHaveBeenCalledTimes(1);
      controller.setConnected(true);
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(poll).toHaveBeenCalledTimes(1);
      controller.wake(); controller.wake(); controller.wake();
      await vi.advanceTimersByTimeAsync(0);
      expect(poll).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
      covered = false; controller.refresh();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(poll).toHaveBeenCalledTimes(3);
      covered = true; controller.refresh();
      controller.resetFast();
      await vi.advanceTimersByTimeAsync(2000);
      expect(poll).toHaveBeenCalledTimes(4);
      controller.stop(); controller.wake();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('coalesces in-flight wakes into one follow-up without overlap', async () => {
    vi.useFakeTimers();
    try {
      let finish;
      const poll = vi.fn(() => new Promise(resolve => { finish = resolve; }));
      const c = start(poll, () => true);
      c.setConnected(true); c.wake();
      await vi.advanceTimersByTimeAsync(0);
      c.wake(); c.wake();
      await vi.advanceTimersByTimeAsync(1000);
      expect(poll).toHaveBeenCalledTimes(1);
      finish(false);
      await vi.advanceTimersByTimeAsync(0);
      expect(poll).toHaveBeenCalledTimes(2);
      finish(false);
      await vi.advanceTimersByTimeAsync(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('retries a failed drain before pausing again', async () => {
    vi.useFakeTimers();
    try {
      const poll = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(false);
      const c = start(poll, () => true);
      c.setConnected(true); c.wake();
      await vi.advanceTimersByTimeAsync(0);
      c.refresh();
      await vi.advanceTimersByTimeAsync(2000);
      expect(poll).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});

describe('signal wake coverage and generation recovery (deployed helpers)', () => {
  function world() {
    const relay = { url: 'https://relay.test' };
    const peer = { pc: { connectionState: 'connected', signalingState: 'stable' }, dc: { readyState: 'open' }, _sigPollRelays: [relay], _sigPoll: { wake: vi.fn(), refresh: vi.fn() } };
    const features = { signalWake: true };
    const state = { open: true, id: 'self' };
    let wanted = true;
    const create = new Function('peers', '_mailWsByRelay', 'isOriginRelay', 'window', '_relayHealthByUrl', 'myId', 'mailboxWsWanted',
      slice('  const _signalGenerationByRelay = new Map();', '\n  let _pollInFlight') + '\nreturn { signalPollCovered, noteSignalGeneration, wakeSignalPolls, refreshSignalPolls };');
    const helpers = create({ peer }, new Map([[relay.url, state]]), () => true, { _serverFeatures: features }, new Map(), 'self', () => wanted);
    return { ...helpers, relay, peer, state, features, background: () => { wanted = false; } };
  }
  it('requires stable transport, all relay sockets, capability and foreground authenticated ownership', () => {
    const w = world();
    expect(w.signalPollCovered(w.peer)).toBe(true);
    for (const [target, key, value] of [[w.state, 'open', false], [w.state, 'id', 'other'], [w.features, 'signalWake', false], [w.peer.pc, 'signalingState', 'have-local-offer'], [w.peer.pc, 'connectionState', 'disconnected'], [w.peer.dc, 'readyState', 'closed']]) {
      const old = target[key]; target[key] = value;
      expect(w.signalPollCovered(w.peer)).toBe(false);
      target[key] = old;
    }
    w.peer._sigPollRelays.push({ url: 'https://uncovered.test' });
    expect(w.signalPollCovered(w.peer)).toBe(false);
    w.peer._sigPollRelays.pop(); w.background();
    expect(w.signalPollCovered(w.peer)).toBe(false);
    expect(w.signalPollCovered({})).toBe(false);
  });
  it('recovers a lost frame from a changed generation; unchanged/malformed/other-relay generations do not drain the room', () => {
    const w = world();
    w.noteSignalGeneration(w.relay, { sigGen: 0 });
    w.peer._sigPoll.wake.mockClear();
    for (const sigGen of [0, -1, '1', undefined, Infinity]) w.noteSignalGeneration(w.relay, { sigGen });
    w.noteSignalGeneration({ url: 'https://other.test' }, { sigGen: 1 });
    expect(w.peer._sigPoll.wake).not.toHaveBeenCalled();
    w.noteSignalGeneration(w.relay, { sigGen: 2 });
    expect(w.peer._sigPoll.wake).toHaveBeenCalledOnce();
    w.refreshSignalPolls();
    expect(w.peer._sigPoll.refresh).toHaveBeenCalledOnce();
  });
  it('wires both mailbox polls, WS attachment/close and the post-established counters', () => {
    expect(html).toContain('noteSignalGeneration(relay, data);');
    expect(html).toContain('noteSignalGeneration(relay, sData);');
    const ws = slice('      ws.onopen = () => {', '\n      ws.onerror =');
    expect(ws).toContain('wakeSignalPolls(relay.url);');
    expect(ws).toContain("m.type === 'signal'");
    expect(ws).toContain('refreshSignalPolls();');
    expect(html).toContain('}, () => signalPollCovered(peerState));');
    expect(html).toContain('_p2pStats?.noteSignalPoll(established)');
  });
});
