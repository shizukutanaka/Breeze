// Outbox persistence contract: queueOutbox entries hold PLAINTEXT until flushed, so
// AGENTS.md's "no localStorage for sensitive data" rule puts them in the per-account
// IndexedDB 'settings' store instead of the old 'brz-outbox-<id>' localStorage key.
// These tests execute the real functions extracted from index.html — a regression back
// to localStorage, or a restore that drops the legacy-key migration, fails here.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function extractOutbox() {
  const start = INDEX.indexOf('function queueOutbox');
  const end = INDEX.indexOf('function dcSend');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

// Minimal IndexedDB stand-in for the 'settings' store: one backing object, request
// objects resolve on the next microtask like real IDB.
function mockDb(backing = {}) {
  return {
    _backing: backing,
    objectStoreNames: { contains: s => s === 'settings' },
    transaction() {
      return {
        objectStore: () => ({
          put(val, key) { backing[key] = val; },
          get(key) {
            const req = {};
            queueMicrotask(() => { req.result = backing[key]; if (req.onsuccess) req.onsuccess(); });
            return req;
          },
        }),
      };
    },
  };
}

function mockLocalStorage(seed = {}) {
  const m = { ...seed };
  return {
    _m: m,
    getItem: k => (k in m ? m[k] : null),
    setItem: (k, v) => { m[k] = String(v); },
    removeItem: k => { delete m[k]; },
    get length() { return Object.keys(m).length; },
    key: i => Object.keys(m)[i] ?? null,
  };
}

function build({ db, ls } = {}) {
  const _outbox = new Map();
  const src = extractOutbox();
  const fn = new Function(
    '_outbox', '_currentAccountDb', 'localStorage', '_dbg',
    `${src} return { queueOutbox, _persistOutbox, _restoreOutbox };`
  );
  return fn(_outbox, db ?? null, ls ?? mockLocalStorage(), () => {});
}

describe('outbox persistence — IndexedDB, not localStorage', () => {
  it('persists a complete snapshot to the settings store under "outbox"', () => {
    const backing = {};
    const ls = mockLocalStorage();
    const { queueOutbox } = build({ db: mockDb(backing), ls });
    queueOutbox('peerA', 'secret draft', null);
    queueOutbox('peerB', 'second draft', { kind: 'x' });
    expect(backing.outbox.peerA[0].text).toBe('secret draft');
    expect(backing.outbox.peerB[0].text).toBe('second draft');
    // The plaintext never touches localStorage.
    expect(ls._m).toEqual({});
  });

  it('is a no-op when the account DB is not open', () => {
    const { queueOutbox } = build({ db: null });
    expect(() => queueOutbox('peerA', 'x', null)).not.toThrow();
  });

  it('restores queued entries from the settings store', async () => {
    const backing = { outbox: { peerA: [{ text: 'pending', meta: null, ts: 1, attempts: 0 }] } };
    const _outboxProbe = new Map();
    const src = extractOutbox();
    const fn = new Function(
      '_outbox', '_currentAccountDb', 'localStorage', '_dbg',
      `${src} return { _restoreOutbox };`
    );
    const { _restoreOutbox } = fn(_outboxProbe, mockDb(backing), mockLocalStorage(), () => {});
    await _restoreOutbox('acct1');
    expect(_outboxProbe.get('peerA')[0].text).toBe('pending');
  });

  it('migrates a legacy localStorage outbox once, then removes every brz-outbox key', async () => {
    const backing = {};
    const legacy = { peerA: [{ text: 'old draft', ts: 2, attempts: 0 }] };
    const ls = mockLocalStorage({ 'brz-outbox-acct1': JSON.stringify(legacy), 'brz-outbox-stale': '{}' });
    const _outboxProbe = new Map();
    const src = extractOutbox();
    const fn = new Function(
      '_outbox', '_currentAccountDb', 'localStorage', '_dbg',
      `${src} return { _restoreOutbox };`
    );
    const { _restoreOutbox } = fn(_outboxProbe, mockDb(backing), ls, () => {});
    await _restoreOutbox('acct1');
    expect(_outboxProbe.get('peerA')[0].text).toBe('old draft');
    expect(backing.outbox).toEqual(legacy); // adopted into IDB
    expect(Object.keys(ls._m).some(k => k.startsWith('brz-outbox'))).toBe(false);
  });

  it('prefers the IDB record over a stale legacy key (no merge)', async () => {
    const backing = { outbox: { peerNew: [{ text: 'fresh', ts: 9, attempts: 0 }] } };
    const ls = mockLocalStorage({ 'brz-outbox-acct1': JSON.stringify({ peerOld: [{ text: 'stale' }] }) });
    const _outboxProbe = new Map();
    const src = extractOutbox();
    const fn = new Function(
      '_outbox', '_currentAccountDb', 'localStorage', '_dbg',
      `${src} return { _restoreOutbox };`
    );
    const { _restoreOutbox } = fn(_outboxProbe, mockDb(backing), ls, () => {});
    await _restoreOutbox('acct1');
    expect(_outboxProbe.has('peerNew')).toBe(true);
    expect(_outboxProbe.has('peerOld')).toBe(false);
    expect(ls._m['brz-outbox-acct1']).toBeUndefined();
  });
});

describe('outbox persistence — static contract', () => {
  it('never writes the outbox through localStorage', () => {
    expect(/localStorage\.setItem\([^)]*outbox/i.test(INDEX)).toBe(false);
    expect(/localStorage\.setItem\([^)]*_outboxKey/i.test(INDEX)).toBe(false);
    expect(INDEX).not.toContain('brz-outbox-\' + myId');
  });
});
