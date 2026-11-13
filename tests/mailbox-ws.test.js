import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import worker from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { makeMailboxNamespace, makeDOEnv } from './helpers/mockDO.js';

// Stage-1 step 5 (2026-11-13): WebSocket delivery. The socket attached
// to a recipient's MailboxDO is a wake-up channel only — deposits stay
// poll-delivered — so these tests pin: the feature gate (flag off or
// KV backend → the route is not served and GET keeps its pre-step-5
// 405), the mandatory ownership proof (same Ed25519 queue-auth scheme,
// op domain 'mailbox-ws', required even with QUEUE_REQUIRE_AUTH unset),
// the attach landing in the RECIPIENT's DO only, deposit → content-free
// wake-up frame for both queue families, no cross-mailbox wake, and
// delivery via poll being completely independent of the socket.
//
// Node has neither WebSocketPair nor a Response constructor that
// accepts status 101 (the fetch spec range check), so the two upgrade
// tests stub exactly those two Cloudflare globals around the call —
// everything else (router, auth, DO class, deposit handlers) is the
// production code on the mock KV/DO harness.
const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));

async function registerKey(env, id) {
  const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const edIdentityKey = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey)));
  await env.KV.put(`prekey:${id}`, JSON.stringify({ identityKey: 'x', signedPreKey: 'x', edIdentityKey }));
  return ed;
}

async function signWs(ed, id, ts = Date.now()) {
  const sig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey,
    new TextEncoder().encode(`breeze-mailbox-ws:${id}:${ts}`))));
  return { ts, sig };
}

function wsRequest(id, auth, ip) {
  const q = new URLSearchParams({ id });
  if (auth?.ts !== undefined) q.set('ts', String(auth.ts));
  if (auth?.sig !== undefined) q.set('sig', auth.sig);
  return new Request(`https://breeze.test/api/mailbox/ws?${q}`, {
    headers: { Upgrade: 'websocket', 'CF-Connecting-IP': ip },
  });
}

class FakeSocket {
  constructor() { this.sent = []; this.closed = false; }
  send(m) { this.sent.push(m); }
  close() { this.closed = true; }
}
class FakeWebSocketPair {
  constructor() { this[0] = new FakeSocket(); this[1] = new FakeSocket(); }
}
class FakeResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.webSocket = init.webSocket ?? null;
    this.headers = new Headers(init.headers);
  }
}

// Perform a signed upgrade with the CF globals stubbed; returns the
// 101 response and the recipient DO's single attached server socket.
async function attach(env, id, ip) {
  const ed = await registerKey(env, id);
  const auth = await signWs(ed, id);
  vi.stubGlobal('WebSocketPair', FakeWebSocketPair);
  vi.stubGlobal('Response', FakeResponse);
  let res;
  try {
    res = await worker.fetch(wsRequest(id, auth, ip), env);
  } finally {
    vi.unstubAllGlobals();
  }
  const instance = env.MAILBOX_DO.instances.get(id);
  const serverSocket = instance ? [...instance.state.sockets][0] : null;
  return { res, serverSocket, instance };
}

const wsEnv = (extra = {}) => makeDOEnv({ MAILBOX_WS_ENABLED: 'true', ...extra });

beforeEach(() => {
  globalThis._msgDedup = new Map();
  globalThis._sealedDedup = new Map();
  globalThis._rateLimitMap = new Map();
  globalThis._queueAuthKey = new Map();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('WebSocket delivery — feature gate', () => {
  it('flag off: GET /api/mailbox/ws keeps the pre-step-5 behaviour (405)', async () => {
    const env = makeDOEnv(); // MAILBOX_BACKEND=do, no MAILBOX_WS_ENABLED
    const res = await worker.fetch(wsRequest('wsuser01', null, '10.0.0.1'), env);
    expect(res.status).toBe(405);
    expect(env.MAILBOX_DO.instances.size).toBe(0);
  });

  it('flag on but KV mailbox backend: still not served (405)', async () => {
    const env = makeEnv({ MAILBOX_WS_ENABLED: 'true' });
    env.MAILBOX_DO = makeMailboxNamespace(env); // binding present, backend stays kv
    const res = await worker.fetch(wsRequest('wsuser02', null, '10.0.0.2'), env);
    expect(res.status).toBe(405);
    expect(env.MAILBOX_DO.instances.size).toBe(0);
  });

  it('enabled but the request is not an upgrade: 426', async () => {
    const env = wsEnv();
    const res = await worker.fetch(new Request('https://breeze.test/api/mailbox/ws?id=wsuser03'), env);
    expect(res.status).toBe(426);
    expect((await res.json()).code).toBe('UPGRADE_REQUIRED');
  });

  it('health advertises ws only under flag + DO backend', async () => {
    const on = await (await worker.fetch(new Request('https://breeze.test/api/health'), wsEnv())).json();
    expect(on.features.ws).toBe(true);
    const off = await (await worker.fetch(new Request('https://breeze.test/api/health'), makeDOEnv())).json();
    expect(off.features.ws).toBe(false);
  });
});

describe('WebSocket delivery — subscription auth (mandatory)', () => {
  it('no signature → 403 AUTH_REQUIRED even though QUEUE_REQUIRE_AUTH is unset', async () => {
    const env = wsEnv();
    const res = await worker.fetch(wsRequest('wsuser10', null, '10.0.1.1'), env);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('AUTH_REQUIRED');
    expect(env.MAILBOX_DO.instances.size).toBe(0);
  });

  it('signature from the wrong key → 403 SIG_INVALID, nothing attached', async () => {
    const env = wsEnv();
    await registerKey(env, 'wsuser11');
    const stranger = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign']);
    const auth = await signWs(stranger, 'wsuser11');
    const res = await worker.fetch(wsRequest('wsuser11', auth, '10.0.1.2'), env);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('SIG_INVALID');
    expect(env.MAILBOX_DO.instances.size).toBe(0);
  });

  it('a poll-domain signature cannot be replayed as a WS subscription (domain separation)', async () => {
    const env = wsEnv();
    const ed = await registerKey(env, 'wsuser12');
    const ts = Date.now();
    const sig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey,
      new TextEncoder().encode(`breeze-sealed-poll:wsuser12:${ts}`))));
    const res = await worker.fetch(wsRequest('wsuser12', { ts, sig }, '10.0.1.3'), env);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('SIG_INVALID');
  });

  it('valid signature but the id never registered → 403 NO_IDENTITY_KEY', async () => {
    const env = wsEnv();
    const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign']);
    const auth = await signWs(ed, 'wsuser13');
    const res = await worker.fetch(wsRequest('wsuser13', auth, '10.0.1.4'), env);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('NO_IDENTITY_KEY');
  });

  it('stale-ts handshake → 400 INVALID_TIMESTAMP', async () => {
    const env = wsEnv();
    const ed = await registerKey(env, 'wsuser14');
    const auth = await signWs(ed, 'wsuser14', Date.now() - 10 * 60 * 1000);
    const res = await worker.fetch(wsRequest('wsuser14', auth, '10.0.1.5'), env);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_TIMESTAMP');
  });

  it('handshakes are rate-limited per IP (budget spent before auth)', async () => {
    const env = wsEnv();
    const ip = '10.0.1.9';
    for (let i = 0; i < 10; i++) {
      const res = await worker.fetch(wsRequest('wsuser15', null, ip), env);
      expect(res.status).toBe(403); // AUTH_REQUIRED — admitted to auth, then rejected
    }
    const res = await worker.fetch(wsRequest('wsuser15', null, ip), env);
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('RATE_LIMITED');
  });
});

describe('WebSocket delivery — attach and wake-up', () => {
  it('valid handshake → 101 and the socket lands in the recipient DO only', async () => {
    const env = wsEnv();
    const { res, serverSocket, instance } = await attach(env, 'wsuser20', '10.0.2.1');
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
    expect(res.webSocket).not.toBe(serverSocket); // client end ≠ server end
    expect(instance.state.sockets.size).toBe(1);
    expect(env.MAILBOX_DO.instances.size).toBe(1); // no other mailbox materialised
  });

  it('a sealed deposit wakes the attached socket with a content-free frame', async () => {
    const env = wsEnv();
    const { serverSocket } = await attach(env, 'wsuser21', '10.0.2.2');
    const res = await worker.fetch(apiRequest('/api/sealed/send', { to: 'wsuser21', envelope: 'ENVELOPE-1' }), env);
    expect(res.status).toBe(200);
    expect(serverSocket.sent).toEqual([JSON.stringify({ type: 'mail', family: 'sealed' })]);
  });

  it('a plain deposit wakes with family inbox', async () => {
    const env = wsEnv();
    const { serverSocket } = await attach(env, 'wsuser22', '10.0.2.3');
    const res = await worker.fetch(apiRequest('/api/msg/send',
      { to: 'wsuser22', from: 'wspeer22', payload: 'CT', ts: Date.now() }), env);
    expect(res.status).toBe(200);
    expect(serverSocket.sent).toEqual([JSON.stringify({ type: 'mail', family: 'inbox' })]);
  });

  it('a deposit to a DIFFERENT mailbox does not wake this socket', async () => {
    const env = wsEnv();
    const { serverSocket } = await attach(env, 'wsuser23', '10.0.2.4');
    const res = await worker.fetch(apiRequest('/api/sealed/send', { to: 'wsuser24', envelope: 'NOT-YOURS' }), env);
    expect(res.status).toBe(200);
    expect(serverSocket.sent).toEqual([]);
  });

  it('deposits with nobody attached still store fine (socket is never load-bearing)', async () => {
    const env = wsEnv();
    const res = await worker.fetch(apiRequest('/api/sealed/send', { to: 'wsuser25', envelope: 'QUIET' }), env);
    expect(res.status).toBe(200);
    const poll = await worker.fetch(apiRequest('/api/sealed/poll', { id: 'wsuser25' }), env);
    expect(poll.status).toBe(200);
    expect((await poll.json()).messages).toHaveLength(1);
  });

  it('delivery stays poll-based: a deposited envelope is pollable whether or not a socket is attached', async () => {
    const env = wsEnv();
    const { serverSocket } = await attach(env, 'wsuser26', '10.0.2.6');
    await worker.fetch(apiRequest('/api/sealed/send', { to: 'wsuser26', envelope: 'VIA-POLL' }), env);
    expect(serverSocket.sent).toHaveLength(1);
    const poll = await worker.fetch(apiRequest('/api/sealed/poll', { id: 'wsuser26' }), env);
    const data = await poll.json();
    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].envelope).toBe('VIA-POLL');
  });

  it('DO keepalive: ping → pong, anything else ignored', async () => {
    const env = wsEnv();
    const { instance } = await attach(env, 'wsuser27', '10.0.2.7');
    const sock = new FakeSocket();
    await instance.webSocketMessage(sock, 'ping');
    expect(sock.sent).toEqual(['pong']);
    await instance.webSocketMessage(sock, '{"type":"mail"}');
    expect(sock.sent).toEqual(['pong']); // no new frame — inbound carries no commands
  });
});
