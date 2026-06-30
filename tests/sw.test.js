import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// sw.js is a CLASSIC service-worker script (registered via register('sw.js') with no
// {type:'module'}), so it has no exports. To test the real shipped code we evaluate the
// source inside a mocked ServiceWorkerGlobalScope and dispatch synthetic events — the same
// listeners the browser would invoke. `self`, `clients`, `caches` are injected as params;
// URL/TextEncoder/btoa/atob come from the Node global scope new Function runs in.
const swSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'sw.js'),
  'utf8',
);

const ORIGIN = 'https://breeze.app';

// Load sw.js against a fresh mock global and return the captured event handlers.
function loadSW() {
  const handlers = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    registration: { showNotification: () => {}, navigationPreload: { enable: () => Promise.resolve() } },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };
  const openWindowCalls = [];
  const postMessageCalls = [];
  const clients = {
    openWindow: (url) => { openWindowCalls.push(url); return Promise.resolve(null); },
    // matchAll is overridden per-test; default = no existing windows.
    matchAll: () => Promise.resolve([]),
    claim: () => {},
  };
  const putCalls = [];
  const state = { putRejects: false };
  const caches = {
    open: () => Promise.resolve({
      addAll: () => {},
      put: (req, resp) => {
        putCalls.push({ req, resp });
        return state.putRejects ? Promise.reject(new Error('QuotaExceededError')) : Promise.resolve();
      },
      keys: () => Promise.resolve([]),
      delete: () => {},
    }),
    keys: () => Promise.resolve([]),
    match: () => Promise.resolve(undefined),
  };
  // eslint-disable-next-line no-new-func
  new Function('self', 'clients', 'caches', swSource)(self, clients, caches);
  return { handlers, self, clients, openWindowCalls, postMessageCalls, putCalls, state };
}

// A minimal Response stand-in. Note ok===true for 206 (the exact trap the guard closes).
// cacheControl simulates a Cache-Control response header value (null = not present).
function fakeResp({ status = 200, type = 'basic', cacheControl = null } = {}) {
  const headers = { get: (name) => name.toLowerCase() === 'cache-control' ? cacheControl : null };
  return { status, type, ok: status >= 200 && status < 300, headers, clone() { return this; } };
}

// Fire the fetch handler for a navigation and return the resolved respondWith promise.
// Supplying preloadResponse avoids needing a global fetch mock (the handler awaits the
// preload first and uses it when present).
async function fireNavigate(ctx, { url = `${ORIGIN}/`, preloadResponse } = {}) {
  let responded;
  const e = {
    request: { url, mode: 'navigate', method: 'GET' },
    preloadResponse: preloadResponse !== undefined ? Promise.resolve(preloadResponse) : undefined,
    respondWith: (p) => { responded = p; },
  };
  ctx.handlers.fetch(e);
  const out = await responded;
  await new Promise((r) => setTimeout(r, 0)); // flush the fire-and-forget cachePut() microtasks
  return out;
}

// Fire a plain (non-navigation) fetch and report whether the SW handled it via
// respondWith(). Used to assert the method guard lets non-GET requests pass through.
function fireFetch(ctx, { url = `${ORIGIN}/x.js`, method = 'GET', mode = 'no-cors' } = {}) {
  let responded = false;
  ctx.handlers.fetch({
    request: { url, mode, method },
    respondWith: () => { responded = true; },
  });
  return responded;
}

// Fire notificationclick and wait for the handler's waitUntil promise to settle.
async function fireNotificationClick(ctx, { action = '', reply, data = {}, windows = [] } = {}) {
  ctx.clients.matchAll = () => Promise.resolve(windows);
  let waited;
  const e = {
    action,
    reply,
    notification: { close: () => {}, data },
    waitUntil: (p) => { waited = p; },
  };
  ctx.handlers.notificationclick(e);
  await waited;
}

describe('sw.js notificationclick — relay-controlled URL is contained to our origin', () => {
  let ctx;
  beforeEach(() => { ctx = loadSW(); });

  it('opens an arbitrary cross-origin push url as the app root, not the external page', async () => {
    // A malicious/compromised relay crafts a notification whose tap would phish the user.
    // Refused urls collapse to the literal '/' fallback (openWindow('/') = our app root).
    await fireNotificationClick(ctx, { data: { url: 'https://evil.example/phish' } });
    expect(ctx.openWindowCalls).toEqual(['/']);
  });

  it('refuses protocol-relative and javascript: urls', async () => {
    await fireNotificationClick(ctx, { data: { url: '//evil.example/x' } });
    await fireNotificationClick(ctx, { data: { url: 'javascript:alert(1)' } });
    expect(ctx.openWindowCalls).toEqual(['/', '/']);
  });

  it('preserves a legitimate same-origin deep-link (path + hash)', async () => {
    await fireNotificationClick(ctx, { data: { url: '/#contact/abc' } });
    expect(ctx.openWindowCalls).toEqual([`${ORIGIN}/#contact/abc`]);
  });

  it('defaults to the app root when no url is supplied (the normal worker payload)', async () => {
    await fireNotificationClick(ctx, { data: { contactId: 'x' } });
    expect(ctx.openWindowCalls).toEqual([`${ORIGIN}/`]);
  });

  it('focuses an existing same-origin window instead of opening a new one', async () => {
    let focused = false;
    const win = { url: `${ORIGIN}/`, focus: () => { focused = true; return win; } };
    await fireNotificationClick(ctx, { data: { url: 'https://evil.example' }, windows: [win] });
    expect(focused).toBe(true);
    expect(ctx.openWindowCalls).toEqual([]); // no new window opened
  });

  it('does not treat a foreign window that merely contains our origin in a query param as same-origin', async () => {
    // The old substring check (client.url.includes(origin)) would wrongly match this and
    // postMessage a reply into an attacker-controlled page. A proper origin test must not.
    let posted = false;
    const foreign = {
      url: `https://evil.example/?next=${ORIGIN}/`,
      focus: () => foreign,
      postMessage: () => { posted = true; },
    };
    await fireNotificationClick(ctx, { action: 'reply', reply: 'secret reply', data: { contactId: 'x' }, windows: [foreign] });
    expect(posted).toBe(false);
  });
});

describe('sw.js cachePut — guards the Cache.put() pitfalls', () => {
  let ctx;
  beforeEach(() => { ctx = loadSW(); });

  it('caches a full same-origin 200 basic response', async () => {
    const resp = fakeResp({ status: 200, type: 'basic' });
    const out = await fireNavigate(ctx, { preloadResponse: resp });
    expect(out).toBe(resp);             // response still returned to the page
    expect(ctx.putCalls.length).toBe(1); // and written to cache
  });

  it('does NOT cache a 206 Partial Content response (range request — response.ok is true)', async () => {
    const resp = fakeResp({ status: 206, type: 'basic' });
    const out = await fireNavigate(ctx, { preloadResponse: resp });
    expect(out).toBe(resp);              // still served
    expect(ctx.putCalls.length).toBe(0); // but never put() — Cache.put() would have thrown
  });

  it('does NOT cache an opaque (cross-origin no-cors) response', async () => {
    const resp = fakeResp({ status: 0, type: 'opaque' });
    await fireNavigate(ctx, { preloadResponse: resp });
    expect(ctx.putCalls.length).toBe(0);
  });

  it('does NOT cache a CORS (third-party) response', async () => {
    const resp = fakeResp({ status: 200, type: 'cors' });
    await fireNavigate(ctx, { preloadResponse: resp });
    expect(ctx.putCalls.length).toBe(0);
  });

  it('swallows a QuotaExceededError from put() without rejecting respondWith', async () => {
    ctx.state.putRejects = true;
    const resp = fakeResp({ status: 200, type: 'basic' });
    // Must resolve (not reject) — the page still gets its response; only the write is lost.
    const out = await fireNavigate(ctx, { preloadResponse: resp });
    expect(out).toBe(resp);
    expect(ctx.putCalls.length).toBe(1); // put was attempted, rejection caught internally
  });

  it('does NOT cache a response with Cache-Control: no-store (server forbids caching)', async () => {
    // A server may legitimately return a 200 basic response but mark it private/uncacheable.
    // Storing it would serve stale sensitive content to subsequent visitors from cache.
    const resp = fakeResp({ status: 200, type: 'basic', cacheControl: 'no-store' });
    const out = await fireNavigate(ctx, { preloadResponse: resp });
    expect(out).toBe(resp);              // still served to the page
    expect(ctx.putCalls.length).toBe(0); // never written to cache
  });

  it('still caches a response with other Cache-Control directives (no-cache is not no-store)', async () => {
    const resp = fakeResp({ status: 200, type: 'basic', cacheControl: 'no-cache, must-revalidate' });
    const out = await fireNavigate(ctx, { preloadResponse: resp });
    expect(out).toBe(resp);
    expect(ctx.putCalls.length).toBe(1); // no-cache does not prohibit storage
  });
});

describe('sw.js fetch — method guard (only GET is intercepted/cached)', () => {
  let ctx;
  beforeEach(() => { ctx = loadSW(); });

  it('handles a GET asset request via respondWith (stale-while-revalidate)', () => {
    expect(fireFetch(ctx, { method: 'GET' })).toBe(true);
  });

  for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    it(`does NOT intercept a ${method} request (passes through to the network)`, () => {
      // Cache.put() throws on non-GET and a cached 200 must never satisfy a mutating
      // request, so the SW must leave these to the browser's default handling.
      expect(fireFetch(ctx, { method })).toBe(false);
    });
  }
});
