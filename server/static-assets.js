// The env.ASSETS binding for the Node relay host (stage-2 step 2):
// static files served from the repository root — the same directory
// Cloudflare Pages serves (wrangler.toml: pages_build_output_dir
// ".") — with the `_headers` file applied by this layer.
//
// `_headers` and the `/api/*`-vs-static split are Pages features, not
// worker code: on the official deployment the platform attaches the
// CSP and cache rules, so a Node host that skipped them would run
// the identical client with weaker headers than the official one.
// The rules are parsed once at startup and matched against the
// request path (`*` is the Pages splat; blocks apply in file order
// and a later matching block wins per header name — the file relies
// on this: `/*.js` grants week-long caching, the later `/sw.js`
// block takes it back to no-cache).
//
// What is NOT served, by construction: the Pages platform files
// (`_worker.js`, `_headers`, `_routes.json`, `_redirects` — Pages
// never serves them either), dotfiles and dot-directories (`.git`,
// `.env*`), `node_modules/`, and database files (`*.db`, `*.sqlite*`,
// WAL/SHM sidecars) — the relay's SQLite state must never become a
// download, wherever the operator points BREEZE_DB_PATH. A missing
// path answers the repo's 404.html with status 404, as Pages does.

import { readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, normalize, extname, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.xml': 'application/xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const PLATFORM_FILES = new Set(['/_worker.js', '/_headers', '/_routes.json', '/_redirects']);
const BLOCKED_BASENAME = /(^|\/)\./; // any dotfile / dot-directory segment
const BLOCKED_EXT = /\.(db|sqlite|sqlite3)$|\.(sqlite|db)-(wal|shm)$/i;

// Parse the Pages `_headers` format: a path pattern line followed by
// indented `Name: value` lines, repeated. Exported for the tests.
export function parseHeadersFile(text) {
  const rules = [];
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
    } else if (current) {
      const idx = line.indexOf(':');
      if (idx > 0) current.headers.push([line.slice(0, idx).trim(), line.slice(idx + 1).trim()]);
    }
  }
  // Precompile the splat matcher: `*` matches any run (including `/`),
  // everything else is literal.
  for (const rule of rules) {
    const src = rule.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    rule.regex = new RegExp(`^${src}$`);
  }
  return rules;
}

// The headers every matching block contributes to `path`, in file
// order, later blocks winning per (case-insensitive) header name.
export function headersForPath(rules, path) {
  const out = new Map(); // lowercase name → [name, value]
  for (const rule of rules) {
    if (!rule.regex.test(path)) continue;
    for (const [name, value] of rule.headers) out.set(name.toLowerCase(), [name, value]);
  }
  return [...out.values()];
}

function isBlocked(path) {
  if (PLATFORM_FILES.has(path)) return true;
  if (BLOCKED_BASENAME.test(path)) return true;
  if (path === '/node_modules' || path.startsWith('/node_modules/')) return true;
  if (BLOCKED_EXT.test(path)) return true;
  return false;
}

// Build the ASSETS binding: { fetch(request) → Response } over
// rootDir, applying the `_headers` rules read from that same root.
// `extraBlocked` lets the host add absolute paths (its database file)
// to the never-serve list even under an unlisted extension.
export function makeAssets({ rootDir, extraBlocked = [] }) {
  const rules = parseHeadersFile(readFileSync(join(rootDir, '_headers'), 'utf8'));
  const blockedAbs = new Set(extraBlocked.map((p) => normalize(p)));

  async function serve(path, method) {
    const headers = new Headers();
    for (const [name, value] of headersForPath(rules, path)) headers.set(name, value);

    let filePath = null;
    let status = 200;
    if (!isBlocked(path)) {
      const candidate = normalize(join(rootDir, '.' + path));
      // Confine to rootDir: a normalized `..` escape is a 404, never a serve.
      if (candidate === rootDir || candidate.startsWith(rootDir + sep)) {
        if (blockedAbs.has(candidate)) {
          filePath = null;
        } else {
          try {
            const st = await stat(candidate);
            if (st.isDirectory()) {
              const idx = join(candidate, 'index.html');
              try { if ((await stat(idx)).isFile()) filePath = idx; } catch { /* no index */ }
            } else if (st.isFile()) {
              filePath = candidate;
            }
          } catch { /* missing → 404 below */ }
        }
      }
    }
    if (!filePath) {
      status = 404;
      try {
        const body = await readFile(join(rootDir, '404.html'));
        headers.set('Content-Type', 'text/html; charset=utf-8');
        headers.set('Content-Length', String(body.length));
        return new Response(method === 'HEAD' ? null : body, { status, headers });
      } catch {
        headers.set('Content-Type', 'text/plain; charset=utf-8');
        return new Response(method === 'HEAD' ? null : 'Not found', { status, headers });
      }
    }
    const body = await readFile(filePath);
    headers.set('Content-Type', MIME[extname(filePath).toLowerCase()] || 'application/octet-stream');
    headers.set('Content-Length', String(body.length));
    return new Response(method === 'HEAD' ? null : body, { status, headers });
  }

  return {
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Not found', { status: 404 });
      }
      let path;
      try { path = decodeURIComponent(new URL(request.url).pathname); } catch {
        return new Response('Not found', { status: 404 });
      }
      return serve(path, request.method);
    },
  };
}
