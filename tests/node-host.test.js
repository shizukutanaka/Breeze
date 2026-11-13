// Stage-2 step 2 (2026-11-13): the Node relay host, black-box over
// real HTTP. Everything stage 1 tested through mock fixtures is
// re-verified here against the actual entry composition — a real
// node:http server, the real worker fetch handler, the SQLite-backed
// bindings (KV shim + in-process MAILBOX_DO namespace over
// MailboxCore) and the real RFC 6455 transport — because the seams
// between those pieces are exactly what a fixture cannot see:
// header adaptation, the CF-Connecting-IP overwrite, the _headers
// rules on static responses, the upgrade dispatch through the
// worker's signed handshake, and SQLite durability across a restart.
//
// The server runs in-process (createRelayServer), so the worker's
// globalThis rate-limit/dedup maps are this process's too; the
// beforeEach resets them like every other suite, and the drill keeps
// per-IP request counts far under the router's per-minute limits.
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRelayEnv, createRelayServer, REPO_ROOT } from '../server/node-host.js';
import { makeAssets, parseHeadersFile, headersForPath } from '../server/static-assets.js';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
const toB64 = (bytes) => Buffer.from(bytes).toString('base64');

let tmp;
beforeAll(() => { tmp = mkdtempSync(join(tmpdir(), 'breeze-node-host-')); });
afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });
beforeEach(() => {
  globalThis._msgDedup = new Map();
  globalThis._sealedDedup = new Map();
  globalThis._rateLimitMap = new Map();
  globalThis._queueAuthKey = new Map();
});

async function boot(dbPath) {
  const db = new DatabaseSync(dbPath);
  const env = buildRelayEnv({ db, rootDir: REPO_ROOT, source: {}, dbPath });
  const server = createRelayServer({ env });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    env, db, server, port,
    base: `http://127.0.0.1:${port}`,
    async close() {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      try { db.close(); } catch { /* already closed */ }
    },
  };
}

async function post(base, path, body) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null), headers: res.headers };
}

async function makeIdentity(userId) {
  const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const edIdentityKey = toB64(new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey)));
  return { userId, ed, edIdentityKey, identityKey: `${userId}IKhost` };
}
const upload = (base, idn) => post(base, '/api/prekey/upload', {
  userId: idn.userId, identityKey: idn.identityKey, edIdentityKey: idn.edIdentityKey,
  signedPreKey: 'SPKhost', oneTimePreKeys: ['o0', 'o1', 'o2'],
});
async function signWs(idn) {
  const ts = Date.now();
  const sig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, idn.ed.privateKey,
    new TextEncoder().encode(`breeze-mailbox-ws:${idn.userId}:${ts}`))));
  return { ts, sig };
}
const wsUrl = (host, idn, auth) =>
  `ws://127.0.0.1:${host.port}/api/mailbox/ws?id=${idn.userId}&ts=${auth.ts}&sig=${encodeURIComponent(auth.sig)}`;
async function waitFor(fn, ms = 3000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  return fn();
}

describe('Node host — API drill (two identities, sealed round trip, WS wake-up)', () => {
  it('health, prekey upload/fetch, sealed deposit → wake → poll → ack, durable across restart', async () => {
    const dbPath = join(tmp, 'drill.db');
    let host = await boot(dbPath);
    const alice = await makeIdentity('hostalice');
    const bob = await makeIdentity('hostbob001');

    const health = await (await fetch(host.base + '/api/health')).json();
    expect(health.ok).toBe(true);
    expect(health.features.ws).toBe(true); // host defaults: core backend + WS on

    expect((await upload(host.base, alice)).status).toBe(200);
    expect((await upload(host.base, bob)).status).toBe(200);
    const fetched = await post(host.base, '/api/prekey/fetch', { userId: bob.userId });
    expect(fetched.status).toBe(200);
    expect(fetched.json.identityKey).toBe(bob.identityKey);

    // Signed WS attach for alice; a deposit must wake exactly her.
    const auth = await signWs(alice);
    const ws = new WebSocket(wsUrl(host, alice, auth));
    const frames = [];
    let pong = false;
    ws.addEventListener('message', (ev) => {
      if (ev.data === 'pong') { pong = true; return; }
      frames.push(JSON.parse(ev.data));
    });
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    expect(host.env.MAILBOX_DO.socketCount(alice.userId)).toBe(1);
    ws.send('ping');
    expect(await waitFor(() => pong)).toBe(true);

    const sent = await post(host.base, '/api/sealed/send', { to: alice.userId, envelope: 'HOST-ENVELOPE-1' });
    expect(sent.status).toBe(200);
    expect(await waitFor(() => frames.some((f) => f.type === 'mail' && f.family === 'sealed'))).toBe(true);

    const polled = await post(host.base, '/api/sealed/poll', { id: alice.userId });
    expect(polled.json.messages?.some((m) => m.envelope === 'HOST-ENVELOPE-1')).toBe(true);
    const ack = await post(host.base, '/api/sealed/ack', { id: alice.userId });
    expect(ack.json.ok).toBe(true);
    const again = await post(host.base, '/api/sealed/poll', { id: alice.userId });
    expect(again.json.messages || []).toEqual([]);
    ws.close();
    expect(await waitFor(() => host.env.MAILBOX_DO.socketCount(alice.userId) === 0)).toBe(true);

    // A second envelope, then a full restart on the same database
    // file: queue and directory must both survive (SQLite durability).
    await post(host.base, '/api/sealed/send', { to: alice.userId, envelope: 'HOST-ENVELOPE-2' });
    await host.close();
    host = await boot(dbPath);
    const afterRestart = await post(host.base, '/api/sealed/poll', { id: alice.userId });
    expect(afterRestart.json.messages?.some((m) => m.envelope === 'HOST-ENVELOPE-2')).toBe(true);
    const bundleAfter = await post(host.base, '/api/prekey/fetch', { userId: alice.userId });
    expect(bundleAfter.json.identityKey).toBe(alice.identityKey);
    await host.close();
  }, 20000);

  it('refuses a WebSocket attach whose signature belongs to another identity', async () => {
    const host = await boot(join(tmp, 'ws-auth.db'));
    const alice = await makeIdentity('guardalice');
    const mallory = await makeIdentity('guardbob01');
    await upload(host.base, alice);
    const bad = await signWs(mallory); // mallory's key, alice's id
    const outcome = await new Promise((resolve) => {
      const w = new WebSocket(wsUrl(host, alice, bad));
      const t = setTimeout(() => resolve('timeout'), 3000);
      w.addEventListener('open', () => { clearTimeout(t); w.close(); resolve('opened'); });
      w.addEventListener('error', () => { clearTimeout(t); resolve('error'); });
    });
    expect(outcome).toBe('error');
    expect(host.env.MAILBOX_DO.socketCount(alice.userId)).toBe(0);
    await host.close();
  }, 10000);
});

describe('Node host — static layer reproduces the _headers contract', () => {
  it('serves / and /index.html with the _headers security set and no-cache', async () => {
    const host = await boot(join(tmp, 'static.db'));
    for (const path of ['/', '/index.html']) {
      const res = await fetch(host.base + path);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
      expect(res.headers.get('cache-control')).toBe('no-cache');
    }
    // The later, specific /sw.js block must beat the /*.js cache rule.
    const sw = await fetch(host.base + '/sw.js');
    expect(sw.headers.get('cache-control')).toBe('no-cache');
    const manifest = await fetch(host.base + '/manifest.json');
    expect(manifest.headers.get('cache-control')).toBe('public, max-age=86400');
    await host.close();
  });

  it('never serves platform files, dotfiles or database files', async () => {
    const host = await boot(join(tmp, 'blocked.db'));
    for (const path of ['/_worker.js', '/_headers', '/.env.example', '/breeze-relay.db', '/data.sqlite-wal']) {
      const res = await fetch(host.base + path);
      expect(res.status, path).toBe(404);
    }
    const missing = await fetch(host.base + '/no-such-page');
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('404'); // the repo's 404.html
    await host.close();
  });

  it('_headers engine: file order wins per header, splats match by pattern', () => {
    const rules = parseHeadersFile(
      '/*\n  X-A: all\n  Cache-Control: none\n/*.js\n  Cache-Control: long\n/sw.js\n  Cache-Control: no-cache\n',
    );
    const forSw = Object.fromEntries(headersForPath(rules, '/sw.js'));
    expect(forSw['Cache-Control']).toBe('no-cache');
    expect(forSw['X-A']).toBe('all');
    const forJs = Object.fromEntries(headersForPath(rules, '/app.js'));
    expect(forJs['Cache-Control']).toBe('long');
    const forHtml = Object.fromEntries(headersForPath(rules, '/index.html'));
    expect(forHtml['Cache-Control']).toBe('none');
  });

  it('assets layer confines paths to its root', async () => {
    const root = join(tmp, 'assets-root');
    mkdirSync(join(root, 'sub'), { recursive: true });
    writeFileSync(join(root, '_headers'), '/*\n  X-Test: yes\n');
    writeFileSync(join(root, 'index.html'), '<h1>root</h1>');
    writeFileSync(join(root, '404.html'), 'lost');
    writeFileSync(join(root, 'secret.db'), 'not a download');
    writeFileSync(join(tmp, 'outside.txt'), 'outside');
    const assets = makeAssets({ rootDir: root });
    const get = (p) => assets.fetch(new Request(`http://x${p}`));
    expect((await get('/')).status).toBe(200);
    expect((await get('/')).headers.get('x-test')).toBe('yes');
    expect((await get('/secret.db')).status).toBe(404);
    expect((await get('/%2e%2e/outside.txt')).status).toBe(404);
    expect((await get('/sub/../index.html')).status).toBe(200); // normalizes INSIDE the root
    const head = await assets.fetch(new Request('http://x/', { method: 'HEAD' }));
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });
});
