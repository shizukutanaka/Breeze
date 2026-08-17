// Local E2E server: serves the REAL, UNMODIFIED index.html/sw.js/lang.js/assets from
// the repo root over plain HTTP, and proxies /api/* to the actual _worker.js Worker
// code (its default export's fetch(request, env, ctx)) backed by an in-memory KV —
// the same mockKV.js helper the vitest worker tests already use. This lets Playwright
// drive the shipped artifact against real application logic, not a re-implementation.
//
// The ONLY departure from the shipped bytes: index.html's `const API = ...` line
// detects "no backend" on localhost/127.0.0.1 (so a plain `file://` open never spams
// a nonexistent server). For E2E we WANT the local server treated as the real API, so
// this script rewrites just that one line when serving index.html — a serve-time
// transform for the test harness only; the committed file is never touched.
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../../_worker.js';
import { makeEnv } from '../helpers/mockKV.js';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const PORT = Number(process.env.E2E_PORT || 8787);

// One shared env for the whole server lifetime: every request (from every browser
// context in the test run) hits the SAME in-memory KV, exactly like a real deployment
// where all clients talk to the same Worker/KV — required for sealed-sender relay,
// prekey exchange, and group state to actually work between two "different" browsers.
const env = makeEnv();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const API_LINE_RE = /^const API = location\.hostname === 'localhost' \|\| location\.hostname === '127\.0\.0\.1' \? '' : location\.origin \+ '\/api';$/m;

// Apply the REAL production CSP (from _headers' `/*` block) as an actual HTTP header,
// not just the <meta> tag already in index.html. Production (Cloudflare Pages) sends
// both; a meta-tag-only CSP can't express frame-ancestors (browsers correctly warn and
// ignore it), which would otherwise show up as a spurious, environment-only console
// warning in every E2E run that production never actually has.
const _headersFile = await readFile(join(ROOT, '_headers'), 'utf8').catch(() => '');
const _cspMatch = _headersFile.match(/^\s*Content-Security-Policy:\s*(.+)$/m);
const REAL_CSP = _cspMatch ? _cspMatch[1].trim() : null;

// Rewrite script-src's sha256 entries to match the body actually being served. Mirrors what
// tools/csp-hash.mjs does for the real file; kept here so the harness stays self-consistent.
function repinCsp(csp, html) {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  if (!hashes.length) return csp;
  return csp.replace(/script-src [^;]+/, `script-src 'self' ${hashes.join(' ')}`);
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const filePath = join(ROOT, rel.replace(/^\/+/, ''));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  try {
    let body = await readFile(filePath, rel.endsWith('.html') || rel.endsWith('.js') ? 'utf8' : undefined);
    const headers = { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' };
    if (rel === '/index.html') {
      if (!API_LINE_RE.test(body)) {
        throw new Error('E2E server: index.html\'s API-detection line moved/changed — update server.mjs\'s API_LINE_RE to match, or this test harness will silently run with no backend.');
      }
      body = body.replace(API_LINE_RE, "const API = '/api';");
      // script-src is hash-pinned in _headers (no 'unsafe-inline'), and the patch above changed
      // the script bytes — so the shipped hash no longer matches what we are about to serve.
      // Recompute it for THIS body, exactly as production's hash matches production's file.
      // Without this the browser refuses the whole bundle and every spec fails with an invisible
      // UI. The security property under test is preserved: the policy is still hash-pinned with
      // no 'unsafe-inline'; only the digest tracks the patched bytes.
      if (REAL_CSP) headers['Content-Security-Policy'] = repinCsp(REAL_CSP, body);
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end('not found: ' + rel);
  }
}

async function nodeReqToFetchRequest(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  return new Request('http://e2e.local' + req.url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
}

const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://e2e.local').pathname;
  if (pathname.startsWith('/api/')) {
    try {
      const request = await nodeReqToFetchRequest(req);
      const response = await worker.fetch(request, env, { waitUntil() {}, passThroughOnException() {} });
      const buf = Buffer.from(await response.arrayBuffer());
      const headers = {};
      response.headers.forEach((v, k) => { headers[k] = v; });
      res.writeHead(response.status, headers);
      res.end(buf);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'e2e-server worker.fetch threw', detail: String(e) }));
    }
    return;
  }
  await serveStatic(req, res, pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[e2e-server] listening on http://127.0.0.1:${PORT}`);
});
