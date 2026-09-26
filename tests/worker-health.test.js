// The health payload is hand-maintained advertisement: `endpoints`, `version`,
// `protocol` and `capabilities` all describe the dispatch table but are written
// by hand — so they drift silently. The version pin is not cosmetic: index.html
// compares health.version to CONFIG.VERSION and toasts "update available" to
// every user on a mismatch, so a stale string IS the false alarm.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../_worker.js';
import { makeEnv, makeKV } from './helpers/mockKV.js';

const src = readFileSync(new URL('../_worker.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const casePaths = [...new Set([...src.matchAll(/case '(\/api\/[^']+)'/g)].map(m => m[1]))];

const getHealth = () => worker.fetch(new Request('https://breeze.test/api/health'), makeEnv()).then(r => r.json());

describe('health endpoint advertises the real surface', () => {
  it('endpoints count == dispatch cases + /api/health itself', async () => {
    const h = await getHealth();
    expect(h.endpoints).toBe(casePaths.length + 1);
  });

  it('version + protocol match the client CONFIG they are compared against', async () => {
    const h = await getHealth();
    expect(h.version).toBe(html.match(/\bVERSION:\s*'([^']+)'/)[1]);
    expect(h.protocol).toBe(+html.match(/\bPROTOCOL_VERSION:\s*(\d+)/)[1]);
  });

  it('capabilities is a non-empty list of feature slugs', async () => {
    const h = await getHealth();
    expect(Array.isArray(h.capabilities)).toBe(true);
    expect(h.capabilities.length).toBeGreaterThan(10);
    expect(h.capabilities.every(c => /^[a-z0-9-]+$/.test(c))).toBe(true);
  });
});

describe('mockKV honors TTLs (real KV semantics)', () => {
  afterEach(() => vi.useRealTimers());

  it('expires keys after expirationTtl', async () => {
    vi.useFakeTimers();
    const kv = makeKV();
    await kv.put('k', 'v', { expirationTtl: 60 });
    expect(await kv.get('k')).toBe('v');
    vi.setSystemTime(Date.now() + 61_000);
    expect(await kv.get('k')).toBeNull();
  });

  it('an overwrite without TTL clears expiry (rewrite resets TTL)', async () => {
    vi.useFakeTimers();
    const kv = makeKV();
    await kv.put('k', 'v1', { expirationTtl: 60 });
    await kv.put('k', 'v2');
    vi.setSystemTime(Date.now() + 61_000);
    expect(await kv.get('k')).toBe('v2'); // still there — second put had no TTL
  });

  it('list() skips expired keys and exposes `expiration` for the health sweeper', async () => {
    vi.useFakeTimers();
    const kv = makeKV();
    await kv.put('sig:live', 'x', { expirationTtl: 3600 });
    await kv.put('sig:soon', 'x', { expirationTtl: 60 });
    await kv.put('sig:forever', 'x');
    vi.setSystemTime(Date.now() + 61_000);
    const { keys } = await kv.list({ prefix: 'sig:' });
    const names = keys.map(k => k.name).sort();
    expect(names).toEqual(['sig:forever', 'sig:live']);
    expect(keys.find(k => k.name === 'sig:live').expiration).toBeGreaterThan(Date.now() / 1000);
    expect(keys.find(k => k.name === 'sig:forever').expiration).toBeUndefined();
  });
});
