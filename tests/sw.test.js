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
  const caches = { open: () => Promise.resolve({ addAll: () => {}, put: () => {}, keys: () => Promise.resolve([]), delete: () => {} }), keys: () => Promise.resolve([]), match: () => Promise.resolve(undefined) };
  // eslint-disable-next-line no-new-func
  new Function('self', 'clients', 'caches', swSource)(self, clients, caches);
  return { handlers, self, clients, openWindowCalls, postMessageCalls };
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
