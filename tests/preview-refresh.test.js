import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the real _refreshPreview so the functional tests run production code.
const fnSrc = SRC.match(/async function _refreshPreview\(contactId, deletedTs\) \{[\s\S]*?\n  \}/)?.[0];

function makeEnv(msgs, contact) {
  const puts = [];
  const env = {
    dbGet: async (store, key) => (store === 'contacts' && key === contact.id ? { ...contact } : null),
    dbGetByIndex: async () => msgs.map(m => ({ ...m })),
    dbPut: async (store, val) => { if (store === 'contacts') puts.push(val); return true; },
    _renderContactsThrottled: () => {},
    myName: 'me',
    _dbg: () => {},
  };
  const fn = new Function('dbGet', 'dbGetByIndex', 'dbPut', '_renderContactsThrottled', 'myName', '_dbg',
    `return (${fnSrc});`)(env.dbGet, env.dbGetByIndex, env.dbPut, env._renderContactsThrottled, env.myName, env._dbg);
  return { fn, puts };
}

describe('deleted-message preview leak (lastMsg survives tombstone)', () => {
  it('_refreshPreview exists and is wired at every tombstone site', () => {
    expect(fnSrc).toBeTruthy();
    // 7 call sites: deleteMsg, selfSync delete, group delete, relay delete,
    // select-del, retention prune, disappearing expiry — plus the definition.
    expect((SRC.match(/_refreshPreview\(/g) || []).length).toBeGreaterThanOrEqual(8);
  });

  it('refreshes only when the tombstoned message was the previewed one', () => {
    expect(fnSrc).toContain('c.lastMsgAt !== deletedTs');
    // Live-only recompute — tombstones of either kind can never become the preview.
    expect(fnSrc).toContain('!m.deleted && !m.purged');
  });

  it('functional: preview of a deleted message falls back to the newest live message', async () => {
    const contact = { id: 'c1', lastMsg: 'secret fragment', lastMsgAt: 200 };
    const msgs = [
      { msgId: 'a:1', contactId: 'c1', ts: 100, text: 'older live message', mine: false },
      { msgId: 'a:2', contactId: 'c1', ts: 200, text: 'secret fragment', mine: false, deleted: true },
    ];
    const { fn, puts } = makeEnv(msgs, contact);
    await fn('c1', 200);
    expect(puts.length).toBe(1);
    expect(puts[0].lastMsg).toBe('older live message');
    expect(puts[0].lastMsgAt).toBe(100);
    expect(puts[0].lastMsgSender).toBe('');
  });

  it('functional: a delete for a non-previewed message leaves the preview untouched', async () => {
    const contact = { id: 'c1', lastMsg: 'still the newest', lastMsgAt: 300 };
    const msgs = [
      { msgId: 'a:1', contactId: 'c1', ts: 150, text: 'mid', deleted: true },
      { msgId: 'a:2', contactId: 'c1', ts: 300, text: 'still the newest' },
    ];
    const { fn, puts } = makeEnv(msgs, contact);
    await fn('c1', 150);
    expect(puts.length).toBe(0);
  });

  it('functional: deleting the only message empties the preview (no residue)', async () => {
    const contact = { id: 'c1', lastMsg: 'the only text', lastMsgAt: 100, lastMsgSender: 'alice' };
    const msgs = [{ msgId: 'a:1', contactId: 'c1', ts: 100, text: 'the only text', deleted: true, senderName: 'alice' }];
    const { fn, puts } = makeEnv(msgs, contact);
    await fn('c1', 100);
    expect(puts[0].lastMsg).toBe('');
    expect(puts[0].lastMsgAt).toBe(0);
    expect(puts[0].lastMsgSender).toBe('');
  });

  it('functional: purged tombstones are skipped too (round-108 markers never preview)', async () => {
    const contact = { id: 'c1', lastMsg: 'expired', lastMsgAt: 200 };
    const msgs = [
      { msgId: 'a:1', contactId: 'c1', ts: 100, text: 'previous' },
      { msgId: 'a:2', ts: 200, deleted: true, purged: true, text: '' }, // no contactId — purge shape
    ];
    const { fn, puts } = makeEnv(msgs, contact);
    await fn('c1', 200);
    expect(puts[0].lastMsg).toBe('previous');
    expect(puts[0].lastMsgAt).toBe(100);
  });

  it('functional: group previews keep the sender prefix; poll previews show the question', async () => {
    const contact = { id: 'g1', isGroup: true, lastMsg: 'bye', lastMsgAt: 300, lastMsgSender: 'bob' };
    const msgs = [
      { msgId: 'b:1', contactId: 'g1', ts: 200, text: JSON.stringify({ question: 'lunch?', options: [] }), isPoll: true, senderName: 'carol' },
      { msgId: 'b:2', contactId: 'g1', ts: 300, text: 'bye', deleted: true, senderName: 'bob' },
    ];
    const { fn, puts } = makeEnv(msgs, contact);
    await fn('g1', 300);
    expect(puts[0].lastMsg).toBe('📊 lunch?');
    expect(puts[0].lastMsgSender).toBe('carol');
  });
});
