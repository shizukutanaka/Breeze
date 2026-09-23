import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SW = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

// Drive the shipped cachePut with a fake Cache/caches API.
function makeCache() {
  const stored = new Map();
  const fakeCache = {
    put: async (req, resp) => { stored.set(typeof req === 'string' ? req : req.url, resp); },
    keys: async () => [...stored.keys()].map(u => ({ url: u })),
    delete: async (k) => stored.delete(typeof k === 'string' ? k : k.url),
  };
  const caches = { open: async () => fakeCache };
  const self = { location: { origin: 'https://breeze.example' } };
  const fn = new Function('caches', 'self', 'CACHE', 'ASSETS', 'MAX_CACHE_ITEMS',
    SW.match(/function cachePut[\s\S]+?\n}/)[0].replace('function cachePut', 'return function cachePut'));
  const cachePut = fn(caches, self, 'breeze-v3.6.1', ['/', '/index.html', '/manifest.json'], 50);
  return { cachePut, stored };
}
const okResp = () => ({ status: 200, type: 'basic', headers: { get: () => '' }, clone: function() { return this; } });
const req = url => ({ url: 'https://breeze.example' + url });
// cachePut is intentionally fire-and-forget (returns undefined — the cache write runs
// in the background); flush its queued awaits before asserting.
const flush = () => new Promise(r => setTimeout(r, 0));

describe('cachePut bounds', () => {
  it('skips parameterized URLs — deep links never enter the cache', async () => {
    const { cachePut, stored } = makeCache();
    await cachePut(req('/?open=abc123'), okResp());
    await cachePut(req('/?share-target&text=hello'), okResp());
    await cachePut(req('/index.html?cv=1700000000'), okResp());
    await cachePut(req('/manifest.json?v=1'), okResp());
    await flush();
    expect(stored.size).toBe(0);
  });

  it('still caches plain shell/asset URLs', async () => {
    const { cachePut, stored } = makeCache();
    await cachePut(req('/index.html'), okResp());
    await cachePut(req('/icon-512.png'), okResp());
    await cachePut(req('/'), okResp());
    await flush();
    expect(stored.size).toBe(3);
  });

  it('trims non-shell entries to MAX_CACHE_ITEMS at runtime (not only on activate)', async () => {
    const { cachePut, stored } = makeCache();
    for (let i = 0; i < 55; i++) stored.set(`https://breeze.example/asset-${i}.png`, okResp());
    await cachePut(req('/trigger.png'), okResp()); // 56th entry → trims
    await flush();
    // shell entries are never trimmed; non-shell bounded to 50
    const nonShell = [...stored.keys()].filter(k => !['https://breeze.example/', 'https://breeze.example/index.html', 'https://breeze.example/manifest.json'].includes(k));
    expect(nonShell.length).toBeLessThanOrEqual(50);
    expect(stored.get('https://breeze.example/trigger.png')).toBeTruthy(); // newest survives
  });

  it('never evicts precached shell entries even under pressure', async () => {
    const { cachePut, stored } = makeCache();
    stored.set('https://breeze.example/', okResp());
    stored.set('https://breeze.example/index.html', okResp());
    stored.set('https://breeze.example/manifest.json', okResp());
    for (let i = 0; i < 60; i++) stored.set(`https://breeze.example/a${i}.png`, okResp());
    await cachePut(req('/x.png'), okResp());
    await flush();
    expect(stored.get('https://breeze.example/')).toBeTruthy();
    expect(stored.get('https://breeze.example/index.html')).toBeTruthy();
    expect(stored.get('https://breeze.example/manifest.json')).toBeTruthy();
  });

  it('keeps the existing response guards (non-200, opaque, no-store)', async () => {
    const { cachePut, stored } = makeCache();
    await cachePut(req('/a'), { status: 404, type: 'basic', headers: { get: () => '' }, clone() { return this; } });
    await cachePut(req('/b'), { status: 200, type: 'opaque', headers: { get: () => '' }, clone() { return this; } });
    await cachePut(req('/c'), { status: 200, type: 'basic', headers: { get: () => 'no-store' }, clone() { return this; } });
    await cachePut(req('/d'), null);
    await flush();
    expect(stored.size).toBe(0);
  });
});
