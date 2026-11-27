// Multi-account isolation (2026-11-27): per-account data must never
// ride device-global storage keys. The audit found two live leaks —
// composer drafts and the retry queue's emergency localStorage copy
// both used one shared key for every account, so account A's unsent
// draft (same contact) surfaced in account B's composer, and A's
// queued sends could be restored (and retried) under B. Both are now
// account-scoped, with the legacy shared value claimed once by the
// first account that inits (the outbox migration pattern).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function makeLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

// Extract the drafts block (from `let _drafts` through the
// _persistDrafts definition) and run it against a stubbed environment.
function runDraftsBlock(localStorage, accountId) {
  const start = INDEX.indexOf('let _drafts = {};');
  expect(start, 'drafts block present').toBeGreaterThan(-1);
  const persistAt = INDEX.indexOf('function _persistDrafts()', start);
  const lineEnd = INDEX.indexOf('\n', persistAt);
  const block = INDEX.slice(start, lineEnd);
  const factory = new Function('localStorage', 'getActiveAccountId', `
    ${block}
    return { get drafts() { return _drafts; }, persist: _persistDrafts, setDrafts: (d) => { _drafts = d; } };
  `);
  return factory(localStorage, () => accountId);
}

describe('multi-account isolation: drafts', () => {
  it('accounts read and persist only their own scoped key', () => {
    const ls = makeLocalStorage({
      'brz-drafts-A': JSON.stringify({ contact1: 'draft from A' }),
      'brz-drafts-B': JSON.stringify({ contact1: 'draft from B' }),
    });
    const a = runDraftsBlock(ls, 'A');
    expect(a.drafts).toEqual({ contact1: 'draft from A' });
    const b = runDraftsBlock(ls, 'B');
    expect(b.drafts).toEqual({ contact1: 'draft from B' });
    b.setDrafts({ contact1: 'B edited' });
    b.persist();
    expect(JSON.parse(ls.store.get('brz-drafts-B'))).toEqual({ contact1: 'B edited' });
    expect(JSON.parse(ls.store.get('brz-drafts-A'))).toEqual({ contact1: 'draft from A' });
    expect(ls.store.has('brz-drafts')).toBe(false);
  });

  it('the legacy shared key is claimed once by the first account and removed', () => {
    const ls = makeLocalStorage({ 'brz-drafts': JSON.stringify({ contact1: 'legacy draft' }) });
    const first = runDraftsBlock(ls, 'A');
    expect(first.drafts).toEqual({ contact1: 'legacy draft' });
    expect(ls.store.has('brz-drafts')).toBe(false);
    expect(ls.store.get('brz-drafts-A')).toBe(JSON.stringify({ contact1: 'legacy draft' }));
    const second = runDraftsBlock(ls, 'B');
    expect(second.drafts).toEqual({});
  });
});

describe('multi-account isolation: retry queue emergency copy', () => {
  it('the beforeunload save writes the account-scoped key', () => {
    const at = INDEX.indexOf("localStorage.setItem('brz-retry-queue-' + getActiveAccountId()");
    expect(at, 'scoped emergency save present').toBeGreaterThan(-1);
    expect(INDEX).not.toContain("localStorage.setItem('brz-retry-queue',");
  });

  it('the restore reads scoped first, then the legacy key, and clears both', () => {
    const loadAt = INDEX.indexOf('async function _loadRetryQueue()');
    expect(loadAt).toBeGreaterThan(-1);
    const block = INDEX.slice(loadAt, loadAt + 1600);
    expect(block).toContain("typeof getActiveAccountId === 'function' ? getActiveAccountId() : '0'");
    expect(block).toContain("localStorage.getItem('brz-retry-queue-' + _rqAcct)");
    expect(block).toContain("localStorage.getItem('brz-retry-queue')");
    expect(block).toContain("localStorage.removeItem('brz-retry-queue')");
    expect(block).toContain("localStorage.removeItem('brz-retry-queue-' + _rqAcct)");
    const scopedAt = block.indexOf("getItem('brz-retry-queue-'");
    const legacyAt = block.indexOf("getItem('brz-retry-queue')");
    expect(scopedAt).toBeLessThan(legacyAt);
  });
});
