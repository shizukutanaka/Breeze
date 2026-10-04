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

  it('API responses are never stored', () => {
    const api = headers.match(/\/api\/\*([\s\S]*?)(?=\n\/|\s*$)/);
    expect(api[0]).toContain('Cache-Control: no-store');
  });
});
