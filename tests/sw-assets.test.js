import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// R01 (wave-6 re-audit): sw.js precaches ASSETS so a first OFFLINE boot can
// still load the app. index.html statically imports its bridges in single
// <script type="module"> blocks — one failed import fails the WHOLE block,
// so every module in the static import closure must be in the precache.
// D17's modal-a11y.js was imported but never added to ASSETS: a first
// offline boot would have lost every app bridge, not just modal a11y.
// This pin recomputes the closure from the real sources so the next
// imported-but-not-precached module fails here instead of in production.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function staticSpecs(source) {
  const specs = [];
  const re = /(?:from\s+|import\s+)['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(source))) specs.push(m[1]);
  return specs;
}

function importClosure() {
  const seen = new Set();
  const queue = staticSpecs(readFileSync(join(root, 'index.html'), 'utf8'))
    .map(s => join('/', s).replace(/\\/g, '/'));
  // normalize: join('/', './src/x.js') -> '/src/x.js'
  const pending = queue.map(p => p.replace('/./', '/'));
  while (pending.length) {
    const p = pending.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    const file = join(root, p);
    if (!existsSync(file)) continue;
    for (const s of staticSpecs(readFileSync(file, 'utf8'))) {
      const dir = p.slice(0, p.lastIndexOf('/'));
      const parts = (dir + '/' + s).split('/');
      const out = [];
      for (const part of parts) {
        if (part === '.' || part === '') { if (out.length === 0) out.push(''); continue; }
        if (part === '..') out.pop(); else out.push(part);
      }
      pending.push(out.join('/'));
    }
  }
  return seen;
}

function precacheAssets() {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const block = sw.match(/const ASSETS = \[([\s\S]*?)\];/);
  expect(block, 'sw.js ASSETS array not found').toBeTruthy();
  // Strip // comments first: quoted words inside comments are not entries.
  const code = block[1].replace(/\/\/[^\n]*/g, '');
  return new Set([...code.matchAll(/'([^']+)'/g)].map(x => x[1]));
}

describe('sw.js precache covers the static import closure of index.html (R01)', () => {
  it('every statically imported module is in ASSETS — one miss fails the whole module block offline', () => {
    const closure = importClosure();
    const assets = precacheAssets();
    expect(closure.size).toBeGreaterThan(20);
    for (const mod of closure) {
      expect(assets.has(mod), `${mod} is statically imported by index.html but missing from sw.js ASSETS`).toBe(true);
    }
  });

  it('includes the D17 modal-a11y bridge (the wave-6 R01 regression)', () => {
    expect(precacheAssets().has('/src/app/modal-a11y.js')).toBe(true);
  });

  it('every ASSETS entry still names a real file (no stale precache entries)', () => {
    for (const a of precacheAssets()) {
      if (a === '/') continue;
      expect(existsSync(join(root, a)), `${a} in ASSETS does not exist`).toBe(true);
    }
  });
});
