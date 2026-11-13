// The Node relay host (stage-2 step 2, docs/RELAY_STAGE2_PLAN.md):
// one process on one origin serving the static app, the API and the
// WebSocket wake-up — the worker's identical handler code, hosted.
//
//   buildRelayEnv()     — assembles the worker's `env`: operator
//                         secrets/flags from the process environment
//                         (same names the worker reads on Cloudflare),
//                         plus the three bindings this host provides:
//                         KV (SQLite shim), MAILBOX_DO (in-process
//                         namespace over MailboxCore + SQLite) and
//                         ASSETS (static files with `_headers`
//                         applied). No _worker.js change was needed:
//                         the default export is the fetch handler and
//                         the host simply calls it, as the tests do.
//   createRelayServer() — a node:http server adapting requests to
//                         the worker's fetch handler and back, with
//                         the 'upgrade' event routed through the
//                         worker's signed handshake before the host
//                         completes the WebSocket upgrade itself.
//
// Client-IP source: the router's rate limiter keys on the
// CF-Connecting-IP header, which Cloudflare's platform sets and a
// client cannot spoof there. This host OWNS that header instead: it
// is overwritten on every adapted request with the socket's remote
// address — except when the operator sets TRUST_PROXY (they run a
// reverse proxy that sets X-Forwarded-For), in which case the first
// forwarded hop is used. An unconditionally trusted X-Forwarded-For
// would hand rate-limit evasion to anyone, so the default never
// looks at it.
//
// Supported topology: SINGLE PROCESS. That is what makes the
// worker's in-memory rate limiter and MailboxCore's per-mailbox
// serialization true; a second process would need its own database
// file and neither property would hold across the pair. Treat one
// process + one SQLite file as the whole relay (see
// server/README.md).

import http from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../_worker.js';
import { loadOrCreateRelayIdentity } from './relay-identity.js';
import { makeSqliteKV } from './sqlite-kv.js';
import { makeMailboxNamespace } from './mailbox-namespace.js';
import { makeAssets } from './static-assets.js';
import { completeWsUpgrade } from './ws-server.js';

export const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const TRUTHY = /^(1|true|yes)$/i;

export function buildRelayEnv({ db, rootDir = REPO_ROOT, source = process.env, dbPath = null } = {}) {
  const env = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'string') env[key] = value;
  }
  env.KV = makeSqliteKV(db);
  env.MAILBOX_DO = makeMailboxNamespace(db);
  env.ASSETS = makeAssets({ rootDir, extraBlocked: dbPath ? [dbPath] : [] });
  // Relay identity (stage-2 step 4): the step-3 volume key becomes the
  // worker's RELAY_PUBLIC_KEY / RELAY_PRIVATE_KEY pair, so /api/health
  // can publish the public half and /api/relay/attest can sign with it.
  // This wiring (and relay-identity.js itself) is the only host code
  // that touches the private half; on Cloudflare the operator sets the
  // same two names as secrets instead. The database key deliberately
  // wins over same-named process variables: the fingerprint in the
  // boot log (index.js loads the same record) and the key clients pin
  // must be one and the same key.
  if (db) {
    const identity = loadOrCreateRelayIdentity(db);
    env.RELAY_PUBLIC_KEY = identity.publicKey;
    env.RELAY_PRIVATE_KEY = identity.privateKey;
  }
  // Host defaults: the self-host's mailboxes run on the core (the
  // whole point of the exercise), presence with them, and the WS
  // wake-up on — each still an ordinary worker flag the operator can
  // override from the environment (e.g. MAILBOX_WS_ENABLED=false).
  if (env.MAILBOX_BACKEND === undefined) env.MAILBOX_BACKEND = 'do';
  if (env.PRESENCE_BACKEND === undefined) env.PRESENCE_BACKEND = 'do';
  if (env.MAILBOX_WS_ENABLED === undefined) env.MAILBOX_WS_ENABLED = 'true';
  // Registration admission (stage-2 step 3): REGISTRATION_ALLOWLIST passes
  // through untouched when the operator sets it — an empty string is a
  // deliberate "closed to everyone", not an unset. A bare entry sets
  // neither variable and keeps step 2's open default. REGISTRATION_OPEN
  // is the explicit opt-in to open registration and wins over an
  // allowlist a packaging file supplied, so a Docker operator can
  // re-open their relay without editing the compose file.
  if (TRUTHY.test(env.REGISTRATION_OPEN || '')) delete env.REGISTRATION_ALLOWLIST;
  return env;
}

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  }
  const remote = req.socket.remoteAddress || '';
  // Normalize the IPv4-mapped IPv6 form so one client has one bucket.
  return remote.startsWith('::ffff:') ? remote.slice(7) : (remote || 'unknown');
}

// Hop-by-hop and framing headers never cross the adaptation: Node
// owns the transport on this side, undici on the other.
const REQUEST_DROP = new Set([
  'host', 'connection', 'keep-alive', 'transfer-encoding', 'content-length',
  'te', 'trailer', 'trailers', 'proxy-connection', 'upgrade',
]);
const UPGRADE_KEEP = new Set([
  'upgrade', 'connection', 'sec-websocket-key', 'sec-websocket-version',
  'sec-websocket-protocol', 'sec-websocket-extensions',
]);

async function toFetchRequest(req, { trustProxy, forUpgrade = false }) {
  const host = req.headers.host || 'localhost';
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (REQUEST_DROP.has(name) && !(forUpgrade && UPGRADE_KEEP.has(name))) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  // The host is the platform here: it sets the client-IP header the
  // worker's rate limiter trusts, overwriting anything the client
  // sent (see the header note).
  headers.set('CF-Connecting-IP', clientIp(req, trustProxy));
  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    if (buf.length) body = buf;
  }
  return new Request(`http://${host}${req.url}`, {
    method: req.method,
    headers,
    ...(body ? { body } : {}),
  });
}

async function writeFetchResponse(res, response) {
  const headers = {};
  const setCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie() : [];
  for (const [name, value] of response.headers.entries()) {
    if (name === 'connection' || name === 'keep-alive' || name === 'transfer-encoding') continue;
    if (name === 'set-cookie' && setCookie.length) continue;
    // The attach marker is a host-internal signal (upgrade path); it
    // must never leak into an ordinary response.
    if (name === 'x-breeze-ws-attach') continue;
    headers[name] = value;
  }
  if (setCookie.length) headers['set-cookie'] = setCookie;
  res.writeHead(response.status, headers);
  if (!response.body) { res.end(); return; }
  try {
    await pipeline(Readable.fromWeb(response.body), res);
  } catch { /* client went away mid-body; nothing left to salvage */ }
}

export function createRelayServer({ env, trustProxy = false } = {}) {
  if (!env) throw new Error('createRelayServer: env is required (see buildRelayEnv)');

  const server = http.createServer((req, res) => {
    (async () => {
      const request = await toFetchRequest(req, { trustProxy });
      const response = await worker.fetch(request, env);
      await writeFetchResponse(res, response);
    })().catch((e) => {
      console.error('[relay] request failed:', e?.message ?? e);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    });
  });

  // The WebSocket wake-up route is the one upgrade the worker serves.
  // The handshake runs THROUGH the worker first (its per-IP limit and
  // the mandatory Ed25519 ownership proof in handleMailboxWs), and
  // only an authorized attach — the namespace stub's marker response
  // — is completed here on the raw socket.
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => { /* an upgrade peer can vanish at any point */ });
    (async () => {
      const { pathname } = new URL(req.url || '/', 'http://localhost');
      const upgrade = (req.headers.upgrade || '').toLowerCase();
      if (pathname !== '/api/mailbox/ws' || upgrade !== 'websocket' || !req.headers['sec-websocket-key']) {
        socket.destroy();
        return;
      }
      const request = await toFetchRequest(req, { trustProxy, forUpgrade: true });
      const response = await worker.fetch(request, env);
      const userId = response.headers.get('x-breeze-ws-attach');
      if (!userId) {
        // Gate or auth failure: answer with the worker's own HTTP
        // response (426/429/400/403 JSON) and close — no upgrade.
        const text = await response.text().catch(() => '');
        const lines = [`HTTP/1.1 ${response.status} ${http.STATUS_CODES[response.status] || ''}`];
        for (const [name, value] of response.headers.entries()) {
          if (name === 'connection' || name === 'transfer-encoding' || name === 'content-length') continue;
          if (name === 'x-breeze-ws-attach') continue;
          lines.push(`${name}: ${value}`);
        }
        lines.push(`Content-Length: ${Buffer.byteLength(text)}`, 'Connection: close', '', text);
        socket.end(lines.join('\r\n'));
        return;
      }
      if (response.body) { try { await response.body.cancel(); } catch { /* marker has no body */ } }
      const ws = completeWsUpgrade(req, socket, head);
      if (ws) env.MAILBOX_DO.attach(userId, ws);
    })().catch((e) => {
      console.error('[relay] upgrade failed:', e?.message ?? e);
      socket.destroy();
    });
  });

  return server;
}
