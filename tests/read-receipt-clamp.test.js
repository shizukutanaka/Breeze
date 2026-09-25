import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// showReadReceipt applies the peer's read watermark: persists it to readTs and
// stamps readAt on every stored mine message with m.ts <= ts. The watermark is
// peer-controlled (relay envelope ts / P2P JSON ts) — it must be bounded or one
// forged huge ts poisons readTs and re-marks every later-sent message as read on
// every replay (open + restart restore), mooting read receipts permanently.
const FN = /function showReadReceipt\(contactId, ts\) \{([\s\S]*?)\n  \}/;

function build() {
  const m = html.match(FN);
  expect(m, 'showReadReceipt not found').toBeTruthy();
  return new Function(
    '_lastReadTs', 'dbPut', 'dbGetByIndex', 'dbGet', 'activeContact', '_DOM', 'MS', 't', '_dbg',
    'function showReadReceipt(contactId, ts) {' + m[1] + '\n  }; return showReadReceipt;'
  );
}

const MS = { SEC: 1000, MIN: 60000, DAY: 86400000 };

function run(ts, msgs, over = {}) {
  const state = {
    lastRead: {},
    puts: [],
    msgs,
    dom: { querySelectorAll: () => [] },
  };
  const fn = build()(
    state.lastRead,
    async (store, val, key) => { state.puts.push([store, val, key]); return true; },
    async () => state.msgs,
    async () => null,
    over.activeContact ?? null,
    { get: () => state.dom },
    MS,
    (k) => k,
    () => {},
  );
  fn('c1', ts);
  return state;
}

describe('showReadReceipt — forged watermark clamp', () => {
  it('extracts showReadReceipt from shipped code', () => {
    const m = html.match(FN);
    expect(m).toBeTruthy();
    expect(m[1]).toContain('_lastReadTs[contactId]');
  });

  it('clamps a far-future ts so the stored watermark stays ~now', async () => {
    const forged = Date.now() + 3650 * MS.DAY;
    const s = run(forged, []);
    await new Promise(r => setTimeout(r, 0));
    expect(s.lastRead.c1).toBeLessThanOrEqual(Date.now() + 5 * MS.MIN);
    expect(s.lastRead.c1).toBeGreaterThan(0);
  });

  it('does not stamp readAt on a message sent after the clamped watermark', async () => {
    // A message recorded with m.ts AFTER the clamped watermark could not have been
    // read by the peer at receipt time; without the clamp a forged ts marks it anyway.
    const now = Date.now();
    const msg = { msgId: 'me:1', mine: true, ts: now + 20 * MS.MIN, contactId: 'c1' };
    run(now + 3650 * MS.DAY, [msg]);
    await new Promise(r => setTimeout(r, 0));
    expect(msg.readAt).toBeUndefined();
    const past = { msgId: 'me:0', mine: true, ts: now - 1000, contactId: 'c1' };
    run(now + 3650 * MS.DAY, [past]);
    await new Promise(r => setTimeout(r, 0));
    expect(past.readAt).toBeDefined();
    expect(past.readAt).toBeLessThanOrEqual(Date.now() + 5 * MS.MIN);
  });

  it('passes a legitimate watermark through unchanged', async () => {
    const read = Date.now() - 5000;
    const msg = { msgId: 'me:2', mine: true, ts: read - 1000, contactId: 'c1' };
    run(read, [msg]);
    await new Promise(r => setTimeout(r, 0));
    expect(msg.readAt).toBe(read);
  });

  it('leaves other contacts\' messages and non-mine messages untouched', async () => {
    const now = Date.now();
    const theirs = { msgId: 'p:1', mine: false, ts: now - 1000, contactId: 'c1' };
    run(now, [theirs]);
    await new Promise(r => setTimeout(r, 0));
    expect(theirs.readAt).toBeUndefined();
  });

  it('survives a non-numeric ts without crashing or marking', async () => {
    const msg = { msgId: 'me:3', mine: true, ts: 1, contactId: 'c1' };
    const s = run('garbage', [msg]);
    await new Promise(r => setTimeout(r, 0));
    expect(msg.readAt).toBeUndefined();
    expect(s.lastRead.c1).toBe(0);
  });
});
