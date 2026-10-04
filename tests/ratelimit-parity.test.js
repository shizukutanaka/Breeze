// Rate-limit parity: every `case '/api/...'` in the worker switch must have an
// explicit entry in the `limits` map, and no map key may dangle without an
// endpoint. The map's own comment explains why this matters: the 30 rpm
// fallback let write-heavy endpoints (group/create, group/join) exhaust the
// free-tier KV write quota (1000/day) in ~33 minutes from one IP — a new
// endpoint added without a limit silently inherits that exposure.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const worker = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '_worker.js'), 'utf8');

const cases = new Set(
  [...worker.matchAll(/case '(\/api\/[^']*)'/g)].map(m => m[1]));

const limitsBlock = worker
  .slice(worker.indexOf('const limits = {'), worker.indexOf('};', worker.indexOf('const limits = {')));
const limits = new Set(
  [...limitsBlock.matchAll(/'(\/api\/[^']*)'\s*:/g)].map(m => m[1]));

describe('worker endpoint ↔ rate-limit map parity', () => {
  it('every endpoint has an explicit limit — nothing silently inherits the 30 rpm default', () => {
    expect([...cases].filter(c => !limits.has(c))).toEqual([]);
  });

  it('every limit key maps to a real endpoint (no stale entries)', () => {
    expect([...limits].filter(l => !cases.has(l))).toEqual([]);
  });
});
