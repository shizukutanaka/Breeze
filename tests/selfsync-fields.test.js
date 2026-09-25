// tests/selfsync-fields.test.js — Breeze deep-behavior test: selfSync copies must keep
// the message-type fields the record supports. Found gaps: (a) the 1:1 forward path
// never called _fanOut at all — siblings missed every forwarded DM; (b) the group
// forward selfExtra dropped `forwarded` — sibling copy lost the ↗ marker; (c) a
// self-synced poll stored isPoll from the wire flag (vs the receive paths' JSON
// detection) and live-rendered raw JSON because meta.poll was never set.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The shipped store+render tail of the selfSync text branch (detection → record →
// preview → live render). Wrap async — the block awaits dbPut twice.
const blkMatch = SRC.match(/let _sp = null;[\s\S]*?appendMsg\(syncText, true, msg\.ts, null, null, \{[^}]*\}\);/);
async function execBlock(msg, target, syncText, activeId) {
  const puts = [], renders = [];
  const dbPut = async (store, v) => puts.push({ store, v });
  const activeContact = activeId ? { id: activeId } : null;
  const appendMsg = (text, mine, ts, box, fd, meta) => renders.push({ text, meta });
  const fn = new Function('msg', 'target', 'syncText', 'syncId', 'dbPut', 'activeContact', 'appendMsg', 'renderContacts',
    'return (async () => {' + blkMatch[0] + '\n})();');
  await fn(msg, target, syncText, 'sib:1700000000000', dbPut, activeContact, appendMsg, () => {});
  return { puts, renders };
}
const POLL = JSON.stringify({ type: 'poll', pollId: 'p1', question: 'Lunch?', options: ['a', 'b'], votes: [] });

describe('selfSync text-branch store (shipped block)', () => {
  it('extracts the shipped block', () => { expect(blkMatch).toBeTruthy(); });

  it('poll: detected from JSON text — record isPoll, live render gets poll object', async () => {
    const { puts, renders } = await execBlock(
      { ts: 100, isPoll: true }, { id: 'c1' }, POLL, 'c1');
    const rec = puts.find(p => p.store === 'messages').v;
    expect(rec.isPoll).toBe(true);
    expect(renders.length).toBe(1);
    expect(renders[0].meta.poll).toBeTruthy();
    expect(renders[0].meta.poll.question).toBe('Lunch?');
    expect(renders[0].meta.msgId).toBe('sib:1700000000000');
  });

  it('spoofed isPoll flag on plain text is rejected by detection', async () => {
    const { puts } = await execBlock(
      { ts: 100, isPoll: true }, { id: 'c1' }, 'just words', 'c1');
    expect(puts.find(p => p.store === 'messages').v.isPoll).toBeUndefined();
  });

  it('poll preview shows the question, not raw JSON', async () => {
    const { puts } = await execBlock(
      { ts: 100, isPoll: true }, { id: 'c1' }, POLL, null);
    const c = puts.find(p => p.store === 'contacts').v;
    expect(c.lastMsg).toBe('📊 Lunch?');
    expect(c.lastMsg).not.toContain('pollId');
  });

  it('forwarded marker persists into record and live render', async () => {
    const { puts, renders } = await execBlock(
      { ts: 100, forwarded: true }, { id: 'c1' }, 'fwd text', 'c1');
    expect(puts.find(p => p.store === 'messages').v.forwarded).toBe(true);
    expect(renders[0].meta.forwarded).toBe(true);
  });

  it('non-forwarded message leaves the field absent', async () => {
    const { puts } = await execBlock({ ts: 100 }, { id: 'c1' }, 'plain', null);
    expect(puts.find(p => p.store === 'messages').v.forwarded).toBeUndefined();
  });
});

describe('forward send paths self-sync', () => {
  it('1:1 forward calls _fanOut (siblings no longer miss forwarded DMs)', () => {
    expect(SRC).toContain('_fanOut(target, msg.text, ts, {}, { forwarded: true, sfFor: target.id, sfPub: target.pubB64, sfName: target.name })');
  });
  it('group forward selfExtra carries the forwarded marker', () => {
    expect(SRC).toContain('_fanOut(target, msg.text, ts, {}, { forwarded: true, sfFor: target.id, sfName: target.name })');
  });
});
