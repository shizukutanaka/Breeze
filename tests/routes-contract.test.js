// Pin: _routes.json scopes function invocations to /api/* so static assets
// skip the Worker hop — a mis-scoped include/exclude either breaks an
// endpoint or silently puts every asset back through the function.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const routes = JSON.parse(readFileSync(join(root, '_routes.json'), 'utf8'));
const worker = readFileSync(join(root, '_worker.js'), 'utf8');
const build = readFileSync(join(root, 'build.sh'), 'utf8');

const endpoints = [...worker.matchAll(/case '(\/api\/[^']+)'/g)].map(m => m[1]);
expect(endpoints.length).toBeGreaterThan(0);

// _routes.json globs: '/api/*' matches '/api/x' (any depth) but NOT bare '/api'.
const covered = p => routes.include.some(g =>
  g.endsWith('/*') ? p.startsWith(g.slice(0, -1)) : p === g);
const excluded = p => routes.exclude.some(g =>
  g.endsWith('/*') ? p.startsWith(g.slice(0, -1)) : p === g);

describe('_routes.json scopes the function to API traffic only', () => {
  it('has the required version field and an include list', () => {
    expect(routes.version).toBe(1);
    expect(Array.isArray(routes.include)).toBe(true);
    expect(routes.include.length).toBeGreaterThan(0);
  });

  it('every Worker endpoint is covered by include and shadowed by no exclude', () => {
    for (const ep of endpoints) {
      expect(covered(ep), `${ep} not covered by include`).toBe(true);
      expect(excluded(ep), `${ep} shadowed by exclude`).toBe(false);
    }
  });

  it('static assets bypass the function (no broad include)', () => {
    for (const g of routes.include) {
      expect(g).not.toBe('/*');
      expect(g).not.toBe('/');
    }
  });
});

describe('deployable bundle carries the Pages knobs', () => {
  it.each(['_routes.json', '_redirects'])('build.sh WEB_FILES includes %s', f => {
    expect(build.match(/WEB_FILES=\(([^)]*)\)/)[1]).toContain(f);
  });
});
