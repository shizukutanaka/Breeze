// sw.js Web Push handler — the payload is relay-supplied and cannot be trusted:
// a self-hosted/compromised relay is under no obligation to honor the worker's
// 50-char title cap, and a non-string field would make showNotification throw
// (silently swallowing the push inside waitUntil).
// The suite evaluates the real sw.js with a mocked SW global scope and captures
// the registered 'push'/'notificationclick' listeners.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'sw.js'), 'utf8');

function makeSwEnv() {
  const handlers = {};
  const shown = [];
  const opened = [];
  const posted = [];
  const self = {
    location: { origin: 'https://app.example' },
    addEventListener: (t, f) => { handlers[t] = f; },
    skipWaiting: () => {},
    registration: { showNotification: (t, o) => { shown.push({ title: t, opts: o }); return Promise.resolve(); } },
    clients: { claim: () => Promise.resolve(), matchAll: () => Promise.resolve([]), openWindow: (u) => { opened.push(u); return Promise.resolve(); } },
  };
  const caches = { open: () => Promise.resolve({ addAll: () => Promise.resolve(), keys: () => Promise.resolve([]), put: () => Promise.resolve(), delete: () => Promise.resolve() }), keys: () => Promise.resolve([]), match: () => Promise.resolve(undefined), delete: () => Promise.resolve() };
  // eslint-disable-next-line no-new-func -- test harness evaluates the artifact under a mocked scope
  new Function('self', 'caches', 'clients', 'navigator', SRC)(
    self, caches, self.clients, { language: 'en' },
  );
  const firePush = async (payload) => {
    let waited;
    handlers.push({ data: { json: () => payload }, waitUntil: (p) => { waited = p; } });
    await waited;
    return shown[shown.length - 1];
  };
  const fireClick = async (notification, action = '', reply = '') => {
    let waited;
    handlers.notificationclick({
      notification: { close: () => {}, data: notification },
      action, reply, waitUntil: (p) => { waited = p; },
    });
    await waited;
    return { opened, posted };
  };
  return { handlers, shown, opened, firePush, fireClick };
}

describe('sw push payload sanitization', () => {
  let sw;
  beforeEach(() => { sw = makeSwEnv(); });

  it('renders a well-formed payload verbatim', async () => {
    const n = await sw.firePush({ title: 'Alice', body: 'hi', tag: 'breeze-a', url: '/', contactId: 'alice0000001' });
    expect(n.title).toBe('Alice');
    expect(n.opts.body).toBe('hi');
    expect(n.opts.tag).toBe('breeze-a');
    expect(n.opts.data.contactId).toBe('alice0000001');
  });

  it('caps oversized title/body/tag (hostile relay cannot push megabyte notifications)', async () => {
    const n = await sw.firePush({ title: 'T'.repeat(5000), body: 'B'.repeat(5000), tag: 'x'.repeat(500) });
    expect(n.title.length).toBe(100);
    expect(n.opts.body.length).toBe(300);
    expect(n.opts.tag.length).toBe(64);
  });

  it('coerces non-string fields instead of throwing (push must not be silently swallowed)', async () => {
    const n = await sw.firePush({ title: { evil: 1 }, body: 42, tag: null });
    expect(n.title).toBe('[object Object]');
    expect(n.opts.body).toBe('42');
    expect(n.opts.tag).toBe('breeze-msg'); // null → '' → default
  });

  it('falls back to defaults when the payload is not JSON', async () => {
    let waited;
    sw.handlers.push({ data: { json: () => { throw new Error('not json'); } }, waitUntil: (p) => { waited = p; } });
    await waited;
    const n = sw.shown[0];
    expect(n.title).toBe('Breeze');
    expect(n.opts.body).toBe('New message');
  });

  it('drops a contactId that fails the userId charset (smuggled-identifier guard)', async () => {
    for (const bad of ['<script>', 'a b', 'x'.repeat(200), 'short', 42, { id: 'x' }]) {
      const n = await sw.firePush({ title: 't', body: 'b', contactId: bad });
      expect(n.opts.data.contactId).toBeUndefined();
    }
  });

  it('notificationclick routes url through safeAppUrl (cross-origin collapses to root)', async () => {
    await sw.fireClick({ url: 'https://evil.example/phish', contactId: 'alice0000001' });
    expect(sw.opened[0]).toBe('/');
    await sw.fireClick({ url: '/chat' });
    expect(sw.opened[1]).toBe('https://app.example/chat');
  });
});
