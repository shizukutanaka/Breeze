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
import http from 'node:http';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRelayEnv, createRelayServer, REPO_ROOT } from '../server/node-host.js';
import { makeAssets, parseHeadersFile, headersForPath, isBlocked } from '../server/static-assets.js';

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

async function boot(dbPath, { trustProxy = false } = {}) {
  const db = new DatabaseSync(dbPath);
  const env = buildRelayEnv({ db, rootDir: REPO_ROOT, source: {}, dbPath });
  const server = createRelayServer({ env, trustProxy });
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
async function signWs(idn, op = 'mailbox-ws') {
  const ts = Date.now();
  const sig = toB64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, idn.ed.privateKey,
    new TextEncoder().encode(`breeze-${op}:${idn.userId}:${ts}`))));
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

    const polled = await post(host.base, '/api/sealed/poll', { id: alice.userId, ...await signWs(alice, 'sealed-poll') });
    expect(polled.json.messages?.some((m) => m.envelope === 'HOST-ENVELOPE-1')).toBe(true);
    const ack = await post(host.base, '/api/sealed/ack', { id: alice.userId, ...await signWs(alice, 'sealed-ack') });
    expect(ack.json.ok).toBe(true);
    const again = await post(host.base, '/api/sealed/poll', { id: alice.userId, ...await signWs(alice, 'sealed-poll') });
    expect(again.json.messages || []).toEqual([]);
    ws.close();
    expect(await waitFor(() => host.env.MAILBOX_DO.socketCount(alice.userId) === 0)).toBe(true);

    // A second envelope, then a full restart on the same database
    // file: queue and directory must both survive (SQLite durability).
    await post(host.base, '/api/sealed/send', { to: alice.userId, envelope: 'HOST-ENVELOPE-2' });
    await host.close();
    host = await boot(dbPath);
    const afterRestart = await post(host.base, '/api/sealed/poll', { id: alice.userId, ...await signWs(alice, 'sealed-poll') });
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
    // Modules are unversioned URLs imported by a no-cache index.html — they must
    // revalidate, and the host must answer that revalidation with a 304.
    const mod = await fetch(host.base + '/src/app/call.js');
    expect(mod.headers.get('cache-control')).toBe('no-cache');
    const etag = mod.headers.get('etag');
    expect(etag).toMatch(/^"[A-Za-z0-9_-]{27}"$/);
    const again = await fetch(host.base + '/src/app/call.js', { headers: { 'If-None-Match': etag } });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe('');
    const changed = await fetch(host.base + '/src/app/call.js', { headers: { 'If-None-Match': '"stale"' } });
    expect(changed.status).toBe(200);
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

  it('blocks repeated-slash, dot-segment, case-variant, and SQLite journal/sidecar bypasses', async () => {
    const root = join(tmp, 'assets-bypass');
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
    mkdirSync(join(root, 'sub'), { recursive: true });
    writeFileSync(join(root, '_headers'), '/*\n  X-Test: yes\n');
    writeFileSync(join(root, '_worker.js'), 'SECRET_WORKER_SOURCE');
    writeFileSync(join(root, '_routes.json'), '{"routes":[]}');
    writeFileSync(join(root, '404.html'), 'lost');
    writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), 'SECRET_MOD');
    writeFileSync(join(root, 'state.db-journal'), 'SECRET_JOURNAL');
    const customDb = join(root, 'relaydata');
    writeFileSync(customDb, 'SECRET_CUSTOM_DB');
    writeFileSync(`${customDb}-wal`, 'SECRET_CUSTOM_WAL');
    const assets = makeAssets({
      rootDir: root,
      extraBlocked: [customDb, `${customDb}-wal`, `${customDb}-shm`, `${customDb}-journal`],
    });
    const get = (p) => assets.fetch(new Request(`http://x${p}`));
    for (const p of [
      '//_worker.js',
      '///_headers',
      '/sub/../_worker.js',
      '/_WORKER.JS',
      '//node_modules/pkg/index.js',
      '/NODE_MODULES/pkg/index.js',
      '/state.db-journal',
      '//state.db-journal',
      '/relaydata',
      '/relaydata-wal',
      '//relaydata-wal',
    ]) {
      const res = await get(p);
      expect(res.status, p).toBe(404);
    }
  });

  // Round-7 re-audit of the blocklist hardening. A case-insensitive
  // filesystem (APFS, NTFS) folds more than ASCII case: U+017F (ſ) opens
  // an `s`, U+212A (Kelvin) a `k`, U+0131 (ı) an `i`. toLowerCase() leaves
  // ſ and ı alone, so `/breeze.%C5%BFqlite` matched no blocked name and
  // the filesystem then opened breeze.sqlite. The name verdict is
  // filesystem-independent, so it is asserted directly.
  it('treats Unicode case-fold aliases of blocked names as blocked', () => {
    for (const p of [
      '/_worker.j\u017F',
      '/_wor\u212Aer.js',
      '/_header\u017F',
      '/_route\u017F.json',
      '/_red\u0131rects',
      '/node_module\u017F/pkg/index.js',
      '/breeze.\u017Fqlite',
      '/breeze.sql\u0131te',
      '/state.\u017Fqlite3-wal',
      '/sub/.\u017Fecret',
    ]) expect(isBlocked(p), p).toBe(true);
    for (const p of ['/index.html', '/src/app/backup.js', '/locales/ja.json', '/dbs/readme.txt']) {
      expect(isBlocked(p), p).toBe(false);
    }
  });

  // Over the real filesystem, on whatever this suite runs on. Where the
  // filesystem is case-insensitive the alias IS the protected file; where
  // it is case-sensitive the alias is written as a decoy of its own. In
  // both cases the answer must be the 404 page, never either body.
  it('never serves a blocked file through a Unicode alias of its name', async () => {
    const root = join(tmp, 'assets-unicode-alias');
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
    mkdirSync(join(root, 'data'), { recursive: true });
    const put = (rel, body) => writeFileSync(join(root, rel), body);
    put('_headers', '/*\n  X-Test: yes\n');
    put('404.html', 'lost');
    put('index.html', '<h1>root</h1>');
    const customDb = join(root, 'data', 'relay-state.bin');
    const targets = [
      ['_worker.js', '_worker.j\u017F'],
      ['breeze.sqlite', 'breeze.\u017Fqlite'],
      ['node_modules/pkg/index.js', 'node_modules/pkg/index.j\u017F'],
      ['data/relay-state.bin', 'data/relay-\u017Ftate.bin'],
      ['data/relay-state.bin-wal', 'data/relay-\u017Ftate.bin-wal'],
    ];
    for (const [real, alias] of targets) { put(alias, 'DECOY'); put(real, 'SECRET'); }
    const assets = makeAssets({
      rootDir: root,
      extraBlocked: [customDb, `${customDb}-wal`, `${customDb}-shm`, `${customDb}-journal`],
    });
    const get = (p) => assets.fetch(new Request(`http://x${p}`));
    for (const p of [
      '/_worker.j%C5%BF',
      '/breeze.%C5%BFqlite',
      '/node_module%C5%BF/pkg/index.js',
      '/node_modules/pkg/index.j%C5%BF',
      '/data/relay-%C5%BFtate.bin',
      '/data/relay-%C5%BFtate.bin-wal',
      '/DATA/RELAY-%C5%BFTATE.BIN',
    ]) {
      const res = await get(p);
      expect(res.status, p).toBe(404);
      expect(await res.text(), p).toBe('lost');
    }
    expect((await get('/index.html')).status).toBe(200);
    expect((await get('/')).status).toBe(200);
  });
});

// TRUST_PROXY: the per-IP rate limiter is the relay's only abuse control on
// most routes. A reverse proxy APPENDS the address it saw to whatever
// X-Forwarded-For the client sent, so only the rightmost hop is trustworthy.
describe('node host — TRUST_PROXY client address', () => {
  const hit = (base, xff) => fetch(base + '/api/account/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(xff ? { 'X-Forwarded-For': xff } : {}) },
    body: '{}',
  }).then((r) => r.status);

  it('a forged leftmost hop cannot mint a fresh rate-limit bucket', async () => {
    const host = await boot(join(tmp, 'xff-forged.db'), { trustProxy: true });
    const statuses = [];
    // /api/account/delete allows 3 requests per minute per client address.
    for (let i = 0; i < 6; i++) statuses.push(await hit(host.base, `10.9.8.${i}, 198.51.100.7`));
    expect(statuses.slice(0, 3).every((s) => s !== 429)).toBe(true);
    expect(statuses.slice(3)).toEqual([429, 429, 429]);
    await host.close();
  });

  it('distinct real clients (rightmost hop) keep distinct buckets', async () => {
    const host = await boot(join(tmp, 'xff-distinct.db'), { trustProxy: true });
    for (let i = 0; i < 6; i++) expect(await hit(host.base, `203.0.113.99, 198.51.100.${i + 10}`)).not.toBe(429);
    await host.close();
  });

  it('without TRUST_PROXY the header is ignored entirely', async () => {
    const host = await boot(join(tmp, 'xff-untrusted.db'));
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push(await hit(host.base, `198.51.100.${i + 40}`));
    expect(statuses.slice(3)).toEqual([429, 429]);
    await host.close();
  });
});

describe('node host — request body size cap (OOM DoS guard)', () => {
  it('rejects oversized chunked POST streams with 413 BODY_TOO_LARGE before buffering unbounded data', async () => {
    const host = await boot(join(tmp, 'body-limit-chunked.db'));
    const res = await new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: host.port,
        path: '/api/sealed/send',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
        },
      }, (r) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => resolve({
          status: r.statusCode,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
        }));
      });
      req.on('error', () => { /* expected when server closes after 413 */ });
      const chunk = Buffer.alloc(64 * 1024, 0x61);
      // 10 * 64KB = 640KB > 512KB MAX_BODY_BYTES
      for (let i = 0; i < 10; i++) {
        if (!req.destroyed) req.write(chunk);
      }
      req.end();
    });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('BODY_TOO_LARGE');
    expect(res.body.max).toBe(524288);
    await host.close();
  });

  it('rejects oversized Content-Length POST with 413 BODY_TOO_LARGE', async () => {
    const host = await boot(join(tmp, 'body-limit-cl.db'));
    const big = 'x'.repeat(524289);
    const res = await fetch(host.base + '/api/sealed/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: big,
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.code).toBe('BODY_TOO_LARGE');
    expect(body.max).toBe(524288);
    await host.close();
  });
});
