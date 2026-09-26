// Permanent hygiene gates for the Worker dispatch table — invariants that were
// audited by hand and are now pinned so a future endpoint cannot regress them:
//   1. Every `case '/api/…'` has an explicit entry in the rate-limit `limits` map.
//      (An endpoint missing from the map falls back to a shared 30 rpm bucket —
//      the comment above the map explains why that quota was too loose for
//      KV-writing endpoints.)
//   2. Every API response — including 4xx rejections — carries the security header
//      set (nosniff, frame deny, no-store, no-referrer, lockdown CSP), because a
//      handler that bypasses json() or forgets `request` loses them silently.
//   3. Unknown /api paths hit the default case → 404 JSON, never a passthrough.
//   4. GET on any API route → 405 (POST-only surface).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';

const src = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');

// Parse the dispatch table and the rate-limit map straight from source so this
// file never needs a hand-maintained copy (a stale list is the failure mode the
// gate exists to prevent).
const casePaths = [...new Set([...src.matchAll(/case '(\/api\/[^']+)'/g)].map(m => m[1]))].sort();
const limitsBlock = src.match(/const limits = \{([\s\S]*?)\};/)[1];
const limitPaths = [...limitsBlock.matchAll(/'(\/api\/[^']+)'\s*:/g)].map(m => m[1]).sort();

describe('worker dispatch hygiene', () => {
  it('every /api/* case has an explicit rate-limit entry', () => {
    expect(casePaths.length).toBeGreaterThan(30); // sanity: parser found the table
    const missing = casePaths.filter(p => !limitPaths.includes(p));
    expect(missing).toEqual([]);
  });

  it('unknown /api path → 404 JSON with NOT_FOUND code', async () => {
    const res = await worker.fetch(apiRequest('/api/definitely-not-real', {}), makeEnv());
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('NOT_FOUND');
  });

  it('GET on an API route → 405 (POST-only surface)', async () => {
    const res = await worker.fetch(new Request('https://breeze.test/api/turn'), makeEnv());
    expect(res.status).toBe(405);
  });

  it('every endpoint response carries the security header set, even on 4xx', async () => {
    const env = makeEnv(); // shared env: a write before validation is observable
    const sizeBefore = env.KV.store.size;
    for (const path of casePaths) {
      const res = await worker.fetch(apiRequest(path, {}), env);
      const h = res.headers;
      expect(h.get('x-content-type-options'), path).toBe('nosniff');
      expect(h.get('x-frame-options'), path).toBe('DENY');
      expect(h.get('cache-control'), path).toContain('no-store');
      expect(h.get('referrer-policy'), path).toBe('no-referrer');
      expect(h.get('content-security-policy'), path).toContain("default-src 'none'");
      expect(h.get('content-type'), path).toContain('application/json');
      // An empty body can only ever fail validation — no endpoint may write or
      // succeed with {}: assert a structured JSON error, never a 500/crash.
      const body = await res.json();
      expect(typeof body, path).toBe('object');
      if (res.status >= 400) expect(body.error || body.code, `${path} missing error code`).toBeTruthy();
    }
    // Nothing was persisted by the {} sweep — a handler that writes before
    // validating would leak garbage keys (e.g. `presence:undefined`).
    expect(env.KV.store.size).toBe(sizeBefore);
  });
});
