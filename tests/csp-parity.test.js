// Pin: two CSPs exist — the HTTP header in _headers (production, hash-pinned
// script-src) and the <meta> CSP in index.html (packaged apps file:// where no
// header exists — script-src intentionally falls back to unsafe-inline).
// Every OTHER directive must stay identical: a directive updated on only one
// surface silently splits the security posture between web and packaged builds.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const parse = csp => {
  const map = {};
  for (const d of csp.split(';')) {
    const t = d.trim();
    if (!t) continue;
    const i = t.indexOf(' ');
    map[t.slice(0, i)] = t.slice(i + 1).trim().split(/\s+/).sort().join(' ');
  }
  return map;
};

const headers = readFileSync(join(root, '_headers'), 'utf8');
const headerCsp = parse(headers.match(/Content-Security-Policy:\s*(.+)/)[1].trim());
const html = readFileSync(join(root, 'index.html'), 'utf8');
const metaCsp = parse(html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1]);

// script-src differs by design (hashes vs unsafe-inline fallback); frame-ancestors
// is a no-op in <meta> and must only exist in the header.
const DELIBERATE_DIVERGENCE = new Set(['script-src', 'frame-ancestors']);

describe('meta CSP and header CSP diverge only where designed', () => {
  it('every non-exempt directive matches exactly', () => {
    const keys = new Set([...Object.keys(headerCsp), ...Object.keys(metaCsp)]);
    for (const k of keys) {
      if (DELIBERATE_DIVERGENCE.has(k)) continue;
      expect(metaCsp[k], `meta ${k}`).toBe(headerCsp[k]);
    }
  });

  it('the exemptions stay as designed', () => {
    // header pins the two inline script blocks by hash; no unsafe-inline
    expect(headerCsp['script-src']).toContain("'sha256-");
    expect(headerCsp['script-src']).not.toContain('unsafe-inline');
    // packaged apps can't be pinned per-deploy — meta falls back by design
    expect(metaCsp['script-src']).toContain('unsafe-inline');
    // frame-ancestors only in the header (ignored inside <meta>)
    expect(headerCsp['frame-ancestors']).toBe("'none'");
    expect(metaCsp['frame-ancestors']).toBeUndefined();
  });
});
