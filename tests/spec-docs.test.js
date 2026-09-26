// SPEC.md is the operator-facing reference — its §3.2 endpoint table and §3.3
// env-var table describe `_worker.js` to deployers. Both tables had silently
// drifted (26 rows labeled "32", most limits "default", 13 endpoints missing,
// 6+ env vars undocumented) because nothing pinned them to the code. This
// file is the pin: every dispatch case must appear in the table with the
// exact `limits` value, and every env.* read must be documented.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spec = readFileSync(join(root, 'SPEC.md'), 'utf8');
const worker = readFileSync(join(root, '_worker.js'), 'utf8');

function section(name) {
  const i = spec.indexOf(name);
  if (i < 0) throw new Error(`SPEC.md section ${name} not found`);
  const rest = spec.slice(i + name.length);
  const end = rest.search(/\n###\s|\n##\s/);
  return end < 0 ? rest : rest.slice(0, end);
}

// The table itself — "| /api/x | N/min | ..." or "| /api/x | unlimited | ..." rows.
const table = new Map();
for (const m of section('3.2').matchAll(/\|\s*(\/api\/[\w/-]+)\s*\|\s*(\d+|unlimited)\/??m?i?n?\s*\|/g)) {
  table.set(m[1], m[2] === 'unlimited' ? 'unlimited' : Number(m[2]));
}

// The code's truth: the `limits` map and the dispatch switch.
const limits = new Map();
for (const m of worker.matchAll(/^\s*'(\/api\/[\w/-]+)':\s*(\d+),/gm)) {
  limits.set(m[1], Number(m[2]));
}
const dispatch = new Set();
for (const m of worker.matchAll(/case '(\/api\/[\w/-]+)'/g)) dispatch.add(m[1]);
// /api/health is answered before the switch and intentionally unlimited.
dispatch.add('/api/health');

describe('SPEC.md §3.2 endpoint table ↔ _worker.js', () => {
  it('documents every dispatch case', () => {
    for (const p of dispatch) {
      expect(table.has(p), `${p} missing from §3.2 table`).toBe(true);
    }
  });

  it('documents no dead endpoints', () => {
    for (const p of table.keys()) {
      expect(dispatch.has(p), `${p} in §3.2 but not dispatched`).toBe(true);
    }
  });

  it('rate limits match the limits map verbatim', () => {
    for (const [p, n] of limits) {
      expect(table.get(p), `${p}: SPEC says ${table.get(p)}/min, code says ${n}/min`).toBe(n);
    }
  });

  it('health is the only unlimited endpoint', () => {
    const unl = [...section('3.2').matchAll(/\|\s*(\/api\/[\w/-]+)\s*\|\s*unlimited/g)].map(m => m[1]);
    expect(unl).toEqual(['/api/health']);
    expect([...limits.keys()].sort()).not.toContain('/api/health');
  });
});

describe('SPEC.md §3.3 env-var table ↔ env.* reads', () => {
  const envReads = new Set();
  for (const m of worker.matchAll(/env\.([A-Z][A-Z0-9_]+)/g)) envReads.add(m[1]);
  const sec = section('3.3');
  // Family rows like `*_REQUIRE_AUTH` document every flag in that family at once.
  const wildcards = [...sec.matchAll(/\*(_[A-Z0-9_]+)/g)].map(m => m[1]);

  it.each([...envReads])('%s is documented', (name) => {
    const covered = sec.includes(name) || wildcards.some(w => name.endsWith(w));
    expect(covered).toBe(true);
  });
});
