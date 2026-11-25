// SHARE_PLAN stage 7 step 3 — transparency is a procedure, not a
// promise. The standing procedure (docs/transparency/README.md),
// the first published report, and the scaffolding tool are pinned
// together: the report must state the operating status honestly
// (including "not operating"), the procedure must name a source
// of truth for every field, and the tool must refuse to invent
// numbers or overwrite a published report.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(root, f), 'utf8');
const procedure = read('docs/transparency/README.md');
const first = read('docs/transparency/2026-11.md');
const tool = read('tools/transparency-report.mjs');

describe('transparency reporting', () => {
  it('the first report exists and states the status honestly', () => {
    expect(existsSync(join(root, 'docs/transparency/2026-11.md'))).toBe(true);
    expect(first).toContain('The default relay is not currently operating');
    expect(first).toContain('publishes anyway');
  });

  it('every report field has a named source of truth', () => {
    for (const src of ['platform\'s analytics', 'turnIssuedThisMonth', 'GitHub Releases', 'COST_MODEL.md', 'kv key list']) {
      expect(procedure).toContain(src);
    }
    expect(procedure).toContain('NEVER contains message content');
  });

  it('the scaffold tool never invents numbers and never overwrites', () => {
    expect(tool).toContain('TO MEASURE');
    expect(tool).toContain('refusing to overwrite a published report');
    expect(tool).toContain('turnIssuedThisMonth');
  });

  it('the worker deliberately keeps no per-request counters (documented decision)', () => {
    expect(procedure).toContain('does **not** keep its own per-request counters');
  });
});
