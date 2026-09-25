// tests/import-preview.test.js — Breeze deep-behavior test: the import tail must keep
// the contact preview marker monotone in ts and follow only what actually LANDED.
// The old code wrote lastMsg/lastMsgAt unconditionally from the file's last line, so
// (a) a pure-duplicate re-import still rewound the preview, (b) an older export
// rewound it below a newer real message, (c) a far-future ts pinned the chat on top
// forever, and (d) the write used the stale activeContact snapshot, clobbering a
// message that arrived mid-import.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Drive the exact shipped block out of index.html — fails if the guard is dropped or
// the unconditional write returns. Stubs: dbGet resolves the stored contact, dbPut
// records writes.
const tailMatch = SRC.match(/const lastNew = batch\[batch\.length - 1\];[\s\S]*?await dbPut\('contacts', _prevC\);\n      \}/);
const MS = { DAY: 86400000, HOUR: 3600000 };
// Runs the exact shipped block; dbGet resolves the stored contact, dbPut records writes.
async function execTail(batch, contact, storedContact) {
  const writes = [];
  const dbGet = async () => storedContact;
  const dbPut = async (store, val) => writes.push(val);
  const fn = new Function('batch', 'contact', 'dbGet', 'dbPut', 'MS', 'Date',
    'return (async () => {' + tailMatch[0] + '\n})();');
  await fn(batch, contact, dbGet, dbPut, MS, Date);
  return writes;
}

describe('import preview guard (shipped code)', () => {
  it('extracts the shipped preview tail', () => { expect(tailMatch).toBeTruthy(); });

  it('drops the old unconditional write entirely', () => {
    expect(SRC).not.toContain("contact.lastMsg = msgs[msgs.length - 1]");
    expect(SRC).not.toContain("contact.lastMsgAt = msgs[msgs.length - 1]");
  });

  it('pure-duplicate re-import (batch empty) writes nothing', async () => {
    const writes = await execTail([], { id: 'c1' }, { id: 'c1', lastMsg: 'real', lastMsgAt: 500 });
    expect(writes).toEqual([]);
  });

  it('older import does not rewind a newer preview', async () => {
    const writes = await execTail(
      [{ msgId: 'import:c1:100:0:0', ts: 100, text: 'old history' }],
      { id: 'c1' }, { id: 'c1', lastMsg: 'real latest', lastMsgAt: 500 });
    expect(writes).toEqual([]);
  });

  it('newer landed message updates the preview', async () => {
    const writes = await execTail(
      [{ msgId: 'import:c1:600:0:0', ts: 600, text: 'imported latest' }],
      { id: 'c1' }, { id: 'c1', lastMsg: 'older', lastMsgAt: 500 });
    expect(writes.length).toBe(1);
    expect(writes[0].lastMsg).toBe('imported latest');
    expect(writes[0].lastMsgAt).toBe(600);
  });

  it('far-future ts cannot pin the conversation on top forever', async () => {
    const writes = await execTail(
      [{ msgId: 'import:c1:x:0:0', ts: Date.now() + 2 * MS.DAY, text: 'pinned' }],
      { id: 'c1' }, { id: 'c1', lastMsg: 'real', lastMsgAt: Date.now() });
    expect(writes).toEqual([]);
  });

  it('modest future skew (within MS.DAY) still lands', async () => {
    const t = Date.now() + MS.HOUR;
    const writes = await execTail(
      [{ msgId: 'import:c1:y:0:0', ts: t, text: 'tz skew' }],
      { id: 'c1' }, { id: 'c1', lastMsg: 'older', lastMsgAt: 100 });
    expect(writes.length).toBe(1);
    expect(writes[0].lastMsgAt).toBe(t);
  });

  it('writes against the freshly-stored contact, not the stale snapshot', async () => {
    // The snapshot (contact) may hold an older lastMsgAt than the stored record if a
    // message arrived mid-import; the guard must read the stored record.
    const stored = { id: 'c1', lastMsg: 'arrived mid-import', lastMsgAt: 900, unread: 3 };
    const writes = await execTail(
      [{ msgId: 'import:c1:z:0:0', ts: 800, text: 'import' }],
      { id: 'c1', lastMsgAt: 100 }, stored);
    // 800 > stored 900? No — stored wins, nothing written, unread untouched.
    expect(writes).toEqual([]);
    expect(stored.unread).toBe(3);
  });
});
