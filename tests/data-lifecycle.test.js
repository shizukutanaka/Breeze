// Wave-4 line-budget pass: the retention / remote-wipe / quota-cleanup
// bodies moved from index.html into src/app/data-lifecycle.js. These tests
// pin the moved behaviour against stub deps (the inline side keeps one-line
// wrappers under the original names).
import { describe, it, expect, vi } from 'vitest';
import { createDataLifecycle } from '../src/app/data-lifecycle.js';

function fakeDb(records) {
  const deleted = [];
  return {
    deleted,
    transaction: () => ({
      objectStore: () => ({ delete: (id) => deleted.push(id), clear: () => {} }),
      set oncomplete(fn) { queueMicrotask(fn); },
      set onerror(_fn) {},
    }),
    objectStoreNames: ['messages'],
  };
}

function deps(over = {}) {
  const msgs = over.msgs || [];
  return {
    settings: () => over.settings || {},
    MS: { DAY: 86400000 },
    dbGetAll: async () => msgs,
    db: () => over.db,
    replayCache: { delete: vi.fn() },
    auditLog: vi.fn(),
    dbg: vi.fn(),
    api: () => '',
    myId: () => '',
    postAPIRaw: vi.fn(),
    queueAuth: async () => ({}),
    showToast: vi.fn(),
    t: (k) => k,
    CONFIG: { TOAST_DURATION_MS: 3000 },
    reload: vi.fn(),
    ...over.extra,
  };
}

describe('data-lifecycle module (src/app/data-lifecycle.js)', () => {
  it('retention deletes only unpinned messages older than the cutoff', async () => {
    const now = Date.now();
    const msgs = [
      { msgId: 'old', ts: now - 40 * 86400000 },
      { msgId: 'old-pinned', ts: now - 40 * 86400000, pinned: true },
      { msgId: 'fresh', ts: now - 1 * 86400000 },
    ];
    const db = fakeDb();
    const D = deps({ msgs, settings: { retentionDays: 30 }, db });
    await createDataLifecycle(D).enforceRetentionPolicy();
    expect(db.deleted).toEqual(['old']);
    expect(D.replayCache.delete).toHaveBeenCalledWith('old');
    expect(D.auditLog).toHaveBeenCalledWith('settings', expect.stringContaining('deleted 1 messages'));
  });

  it('retention is a no-op when retentionDays is unset', async () => {
    const db = fakeDb();
    const D = deps({ msgs: [{ msgId: 'x', ts: 0 }], settings: {}, db });
    await createDataLifecycle(D).enforceRetentionPolicy();
    expect(db.deleted).toEqual([]);
  });

  it('cleanup keeps the newest 80% and skips pinned/bookmarked', async () => {
    const msgs = Array.from({ length: 250 }, (_, i) => ({ msgId: 'm' + i, ts: i }));
    msgs[0].pinned = true;
    msgs[1].bookmarked = true;
    const db = fakeDb();
    const D = deps({ msgs, db });
    await createDataLifecycle(D).cleanupOldMessages();
    expect(db.deleted).toHaveLength(48); // 50 oldest minus pinned + bookmarked
    expect(db.deleted).not.toContain('m0');
    expect(db.deleted).not.toContain('m1');
    expect(db.deleted).toContain('m49');
    expect(db.deleted).not.toContain('m50');
  });

  it('cleanup is a no-op below 200 messages', async () => {
    const db = fakeDb();
    const D = deps({ msgs: [{ msgId: 'a', ts: 1 }], db });
    await createDataLifecycle(D).cleanupOldMessages();
    expect(db.deleted).toEqual([]);
  });

  it('remote wipe check no-ops without an API base or identity', async () => {
    const D = deps({});
    await createDataLifecycle(D).checkRemoteWipe();
    expect(D.postAPIRaw).not.toHaveBeenCalled();
  });

  it('wiring: index.html imports the module and keeps the original names as wrappers', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain("from './src/app/data-lifecycle.js'; window.__breezeDataLifecycle = { createDataLifecycle };");
    expect(html).toContain('async function enforceRetentionPolicy() { return _dataLifecycle()?.enforceRetentionPolicy(); }');
    expect(html).toContain('async function checkRemoteWipe() { return _dataLifecycle()?.checkRemoteWipe(); }');
    expect(html).toContain('async function cleanupOldMessages() { return _dataLifecycle()?.cleanupOldMessages(); }');
    expect((html.match(/\n/g) || []).length).toBeLessThan(16000); // same count validate.sh gates on
  });
});
