// Security-headers contract for the production `_headers` file. csp-hash.mjs
// already pins the script-src hash freshness; nothing pinned the rest of the
// header set — deleting Referrer-Policy or nosniff would pass every gate.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const headers = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '_headers'), 'utf8');

const csp = headers.match(/Content-Security-Policy:\s*(.+)/)[1];

describe('_headers security baseline', () => {
  it('carries the full hardened header set on /*', () => {
    for (const h of [
      'X-Content-Type-Options: nosniff',
      'X-Frame-Options: DENY',
      'Referrer-Policy: no-referrer',
      'Strict-Transport-Security: max-age=',
      'Cross-Origin-Opener-Policy: same-origin',
      'Content-Security-Policy:',
      'Permissions-Policy:',
    ]) {
      expect(headers.includes(h), `missing ${h}`).toBe(true);
    }
  });

  it('CSP keeps the hard invariants', () => {
    for (const d of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"]) {
      expect(csp.includes(d), `CSP missing ${d}`).toBe(true);
    }
  });

  it('script-src stays hash-pinned — no unsafe-inline escape hatch', () => {
    const m = csp.match(/script-src ([^;]+)/);
    expect(m[1]).not.toContain('unsafe-inline');
    expect(m[1]).toContain("'sha256-");
  });

  // index.html (no-cache) statically imports ./src/crypto/*.js and ./src/app/*.js by
  // UNVERSIONED urls. A long-lived / immutable policy on them pairs a freshly deployed
  // index.html with the previous release's modules for the cache lifetime; one missing
  // named export fails the whole module block and every bridge degrades silently.
  it('unversioned scripts and locale data always revalidate (no release skew)', () => {
    const block = (path) => {
      const lines = headers.split('\n');
      const i = lines.findIndex((l) => l.trim() === path);
      expect(i, `missing ${path} block`).toBeGreaterThanOrEqual(0);
      const out = [];
      for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) out.push(lines[j].trim());
      return out.join('\n');
    };
    for (const path of ['/*.js', '/locales/*', '/sw.js', '/index.html', '/']) {
      expect(block(path), path).toContain('Cache-Control: no-cache');
      expect(block(path), path).not.toMatch(/immutable|max-age=[1-9]/);
    }
  });

  it('API responses are never stored', () => {
    const api = headers.match(/\/api\/\*([\s\S]*?)(?=\n\/|\s*$)/);
    expect(api[0]).toContain('Cache-Control: no-store');
  });
});
