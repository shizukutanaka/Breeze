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
// `indexedDB`/`fetchImpl` are injectable for the closed-page outbox drain; callers
// that never hit that path get a throwing stub / the real global fetch.
function loadSW({ indexedDB, fetchImpl } = {}) {
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
  new Function('self', 'clients', 'caches', 'indexedDB', 'fetch', swSource)(
    self, clients, caches,
    indexedDB || { open: () => { throw new Error('no idb in test'); } },
    fetchImpl || globalThis.fetch,
  );
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

// ─── C11 closed-page outbox drain ────────────────────────────────────────────
// In-memory IndexedDB stand-in. `stores` maps dbName → { retryQueue: [...] }.
// A name NOT in `stores` behaves like a DB that does not exist yet: the real
// open() would create it, so idbOpenExisting's upgradeneeded-abort path fires
// (we emulate: fire onupgradeneeded, then AbortError) and nothing is created.
function makeIDB(stores = {}, knownNames = null) {
  return {
    databases: knownNames === null
      ? undefined // Firefox/Safari path — no enumeration
      : () => Promise.resolve(knownNames.map(name => ({ name }))),
    open: (name) => {
      const req = {};
      setTimeout(() => {
        if (!(name in stores)) {
          req.transaction = { abort: () => {} };
          req.onupgradeneeded?.();
          req.onerror?.(new Error('AbortError'));
          return;
        }
        const data = stores[name];
        req.result = {
          close: () => {},
          transaction: (store, mode) => {
            const tx = { oncomplete: null, onerror: null };
            tx.objectStore = () => ({
              get: (key) => {
                const g = {};
                setTimeout(() => { g.result = data[key]; g.onsuccess?.({ target: g }); }, 0);
                return g;
              },
              put: (val, key) => {
                const p = {};
                setTimeout(() => { data[key] = val; p.onsuccess?.({ target: p }); tx.oncomplete?.(); }, 0);
                return p;
              },
            });
            return tx;
          },
        };
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

async function fireSync(ctx, { tag = 'breeze-outbox', windows = [] } = {}) {
  ctx.clients.matchAll = () => Promise.resolve(windows);
  let waited;
  ctx.handlers.sync({ tag, waitUntil: (p) => { waited = p; } });
  await waited;
}

const okResp = { ok: true };
const badResp = { ok: false, status: 500 };

describe('sw.js sync — outbox drain when the app is closed', () => {
  it('posts sync-outbox to open windows and does NOT drain itself', async () => {
    const postMessageCalls = [];
    const ctx = loadSW({
      indexedDB: makeIDB({ 'breeze-messenger': { retryQueue: [{ to: 'x', payload: {} }] } }),
      fetchImpl: async () => { throw new Error('must not fetch while a window is open'); },
    });
    const win = { postMessage: (m) => postMessageCalls.push(m) };
    await fireSync(ctx, { windows: [win] });
    expect(postMessageCalls).toEqual([{ type: 'sync-outbox' }]);
  });

  it('drains the persisted queue via sealed-send when no window is open', async () => {
    const stores = { 'breeze-messenger': { retryQueue: [{ to: 'alice', payload: { to: 'alice', payload: 'enc' } }] } };
    const calls = [];
    const ctx = loadSW({
      indexedDB: makeIDB(stores),
      fetchImpl: async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return okResp; },
    });
    await fireSync(ctx, { windows: [] });
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('/api/sealed/send');
    expect(calls[0].body.to).toBe('alice');
    expect(JSON.parse(calls[0].body.envelope)).toEqual({ to: 'alice', payload: 'enc' });
    expect(stores['breeze-messenger'].retryQueue).toEqual([]); // written back empty
  });

  it('falls back to /api/msg/send when the sealed endpoint rejects', async () => {
    const stores = { 'breeze-messenger': { retryQueue: [{ to: 'bob', payload: { to: 'bob', payload: 'enc' } }] } };
    const urls = [];
    const ctx = loadSW({
      indexedDB: makeIDB(stores),
      fetchImpl: async (url) => { urls.push(url); return url.includes('/sealed/') ? badResp : okResp; },
    });
    await fireSync(ctx, { windows: [] });
    expect(urls).toEqual(['/api/sealed/send', '/api/msg/send']);
    expect(stores['breeze-messenger'].retryQueue).toEqual([]);
  });

  it('keeps undelivered items in the queue for the next sync', async () => {
    const item = { to: 'carol', payload: { to: 'carol', payload: 'enc' } };
    const stores = { 'breeze-messenger': { retryQueue: [item] } };
    const ctx = loadSW({
      indexedDB: makeIDB(stores),
      fetchImpl: async () => { throw new Error('offline'); },
    });
    await fireSync(ctx, { windows: [] });
    expect(stores['breeze-messenger'].retryQueue).toEqual([item]);
  });

  it('drains breeze-acc-* databases discovered via indexedDB.databases()', async () => {
    const stores = {
      'breeze-messenger': { retryQueue: [] },
      'breeze-acc-2': { retryQueue: [{ to: 'dave', payload: { to: 'dave', payload: 'enc' } }] },
    };
    const calls = [];
    const ctx = loadSW({
      indexedDB: makeIDB(stores, ['breeze-messenger', 'breeze-acc-2']),
      fetchImpl: async (url, opts) => { calls.push(JSON.parse(opts.body).to); return okResp; },
    });
    await fireSync(ctx, { windows: [] });
    expect(calls).toEqual(['dave']);
    expect(stores['breeze-acc-2'].retryQueue).toEqual([]);
  });

  it('does not create the DB on a device where the app never ran', async () => {
    const stores = {}; // nothing exists
    let fetched = false;
    const ctx = loadSW({
      indexedDB: makeIDB(stores, []),
      fetchImpl: async () => { fetched = true; return okResp; },
    });
    await fireSync(ctx, { windows: [] });
    expect(fetched).toBe(false);
    expect(stores).toEqual({}); // the aborted upgrade left no empty DB behind
  });

  it('ignores sync events for other tags', async () => {
    const ctx = loadSW();
    let ran = false;
    ctx.handlers.sync({ tag: 'something-else', waitUntil: () => { ran = true; } });
    expect(ran).toBe(false);
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

// Fire the push handler and capture the showNotification invocation.
async function firePush(ctx, payload) {
  const calls = [];
  ctx.self.registration.showNotification = (title, opts) => { calls.push({ title, opts }); return Promise.resolve(); };
  let waited;
  ctx.handlers.push({ data: { json: () => payload }, waitUntil: (p) => { waited = p; } });
  await waited;
  return calls;
}

describe('sw.js push — relay-supplied payload fields are bounded before the OS renders them', () => {
  let ctx;
  beforeEach(() => { ctx = loadSW(); });

  it('strips bidi direction controls and invisible format chars from title and body', async () => {
    const [n] = await firePush(ctx, {
      title: 'Ali\u202Ece\u200B\uFEFF',
      body: 'meet me at \u2066evil\u2069.com\u00AD',
      tag: 't', contactId: 'c1',
    });
    expect(n.title).toBe('Alice');
    expect(n.opts.body).toBe('meet me at evil.com');
  });

  it('caps title/body length (unbounded body cannot spam a huge notification)', async () => {
    const [n] = await firePush(ctx, { title: 'T'.repeat(500), body: 'B'.repeat(5000), tag: 't' });
    expect(n.title.length).toBe(50);
    expect(n.opts.body.length).toBe(200);
  });

  it('non-string/missing fields fall back to safe defaults', async () => {
    const [n] = await firePush(ctx, { title: 7, body: {}, tag: null, contactId: 42 });
    expect(n.title).toBe('Breeze');
    expect(n.opts.body).toBe('New message');
    expect(n.opts.tag).toBe('breeze-msg');
    expect(n.opts.data.contactId).toBeUndefined();
  });

  it('a null payload cannot crash the listener (liveness: notifications keep working)', async () => {
    const [n] = await firePush(ctx, null);
    expect(n.title).toBe('Breeze');
    expect(n.opts.body).toBe('New message');
    const [m] = await firePush(ctx, 'a string');
    expect(m.title).toBe('Breeze');
  });

  it('bounds tag to a machine charset so a hostile tag cannot carry markup/whitespace', async () => {
    const [n] = await firePush(ctx, { tag: 'a<b>"\'\n'.repeat(20) + 'x'.repeat(100) });
    expect(n.opts.tag.length).toBeLessThanOrEqual(64);
    expect(/[^\w:-]/.test(n.opts.tag)).toBe(false);
    const [e] = await firePush(ctx, { tag: '<><><>' });
    expect(e.opts.tag).toBe('breeze-msg');
  });

  it('charset-bounds contactId (flows into quick-reply/mark-read postMessage)', async () => {
    const [n] = await firePush(ctx, { contactId: 'abc123+/=_-[]{};<>'.repeat(10) });
    expect(/[^a-z0-9+/=_-]/i.test(n.opts.data.contactId)).toBe(false);
    expect(n.opts.data.contactId.length).toBeLessThanOrEqual(128);
  });

  it('_UNSAFE_PUSH_RE is the byte-identical class as the worker/app copies (parity tripwire)', () => {
    const reSrc = (src, name) => src.match(new RegExp('const ' + name + ' = /(.+)/gu;'))?.[1];
    const workerSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '_worker.js'), 'utf8');
    const htmlSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'), 'utf8');
    expect(reSrc(swSource, '_UNSAFE_PUSH_RE')).toBe(reSrc(workerSrc, '_UNSAFE_DISPLAY_RE'));
    expect(reSrc(swSource, '_UNSAFE_PUSH_RE')).toBe(reSrc(htmlSrc, '_UNSAFE_DISPLAY_RE'));
  });
});
