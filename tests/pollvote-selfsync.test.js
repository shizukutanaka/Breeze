import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// poll_vote is in sendSignal's persistentTypes, so a vote fans out to my other
// devices as an isSignal selfSync. The selfSync signal chain historically only
// handled edit/delete/reaction — and since votes address a poll by pollId (not
// msgId), the stored-message early return would swallow them anyway. A vote on
// device A must land on device B or the sibling shows a stale/un-voted poll.
const APPLY_FN = /async function _applyPollVote\(pollMsg, voterId, optionIndex\) \{([\s\S]*?)\n  \}/;

function buildApply() {
  const m = html.match(APPLY_FN);
  expect(m, '_applyPollVote not found').toBeTruthy();
  return new Function(
    'pollMsg', 'voterId', 'optionIndex', 'dbPut', 'safeMsgId', 'document', 'safeSetHTML', 'renderPollHtml',
    'return (async function _applyPollVote(pollMsg, voterId, optionIndex) {' + m[1] + '\n  })(pollMsg, voterId, optionIndex);'
  );
}

function makePoll(extra = {}) {
  return { pollId: 'p1', question: 'Q?', options: [
    { text: 'a', votes: ['other'] }, { text: 'b', votes: [] }, { text: 'c', votes: ['me'] },
  ], ...extra };
}

function runApply(pollObj, voterId, optionIndex) {
  const pollMsg = { msgId: 'p:1', contactId: 'c1', isPoll: true, text: JSON.stringify(pollObj) };
  const puts = [];
  const renders = [];
  const fn = buildApply();
  return fn(
    pollMsg, voterId, optionIndex,
    async (s, v) => { puts.push([s, v]); return true; },
    (id) => id,
    { querySelector: () => ({}) },
    (el, h) => renders.push(h),
    (poll, id) => '<poll>' + poll.options.map(o => o.votes.join(',')).join('|') + '</poll>',
  ).then(() => ({ pollMsg, puts, renders, poll: JSON.parse(pollMsg.text) }));
}

describe('_applyPollVote — shipped vote applier', () => {
  it('extracts _applyPollVote from shipped code', () => {
    const m = html.match(APPLY_FN);
    expect(m).toBeTruthy();
    expect(m[1]).toContain('opt.votes.filter');
  });

  it('replaces the voter\'s prior vote atomically and persists the poll JSON', async () => {
    const r = await runApply(makePoll(), 'me', 1);
    expect(r.poll.options[0].votes).toEqual(['other']);     // prior 'me' vote removed
    expect(r.poll.options[1].votes).toEqual(['me']);        // new vote landed
    expect(r.poll.options[2].votes).toEqual([]);            // old slot cleared
    expect(r.puts.length).toBe(1);
    expect(r.puts[0][1].msgId).toBe('p:1');
    expect(r.renders.length).toBe(1);                        // live re-render
  });

  it('clears the voter\'s vote when optionIndex is out of range', async () => {
    const r = await runApply(makePoll(), 'me', 99);
    expect(r.poll.options[2].votes).toEqual([]);
    expect(r.poll.options.flatMap(o => o.votes)).not.toContain('me');
  });

  it('ignores non-integer optionIndex values', async () => {
    const r = await runApply(makePoll(), 'me', '0');
    expect(r.poll.options.flatMap(o => o.votes)).not.toContain('me');
  });
});

describe('poll_vote coverage — all three paths route through _applyPollVote', () => {
  it('group signal path votes with the verified member pub prefix', () => {
    const m = html.match(/signal\.type === 'poll_vote'\) \{[\s\S]*?_applyPollVote\(pollMsg, \(senderPub \|\| ''\)\.slice\(0, 12\), signal\.optionIndex\)/);
    expect(m, 'group poll_vote does not route through _applyPollVote').toBeTruthy();
  });

  it('P2P path binds poll to THIS conversation and votes as contact.id', () => {
    const m = html.match(/msg\.type === 'poll_vote'\) \{[\s\S]*?contactId === contact\.id[\s\S]*?_applyPollVote\(pollMsg, contact\.id, msg\.optionIndex\)/);
    expect(m, 'P2P poll_vote lost its contact binding or voter').toBeTruthy();
    // JSON.parse inside the find must be try/catch'd like the group path —
    // a record flagged isPoll with non-JSON text must not crash the handler.
    expect(html).toMatch(/m\.isPoll && m\.contactId === contact\.id && \(\(\) => \{ try \{ return JSON\.parse\(m\.text\)\.pollId === msg\.pollId; \} catch \{ return false; \} \}\)\(\)/);
  });

  it('selfSync applies my vote BEFORE the stored-message gate (votes have no msgId)', () => {
    // Inside the selfSync isSignal block, poll_vote must be handled before
    // `const stored = await dbGet('messages', smId)` — a vote carries pollId,
    // so smId would be '' and the early return would swallow it.
    const isSig = html.indexOf('if (msg.isSignal) {', html.indexOf('msg.selfSync'));
    const pvIdx = html.indexOf("signal.type === 'poll_vote'", isSig);
    const storedIdx = html.indexOf("const stored = await dbGet('messages', smId)", isSig);
    expect(pvIdx).toBeGreaterThan(isSig);
    expect(pvIdx).toBeLessThan(storedIdx);
    // voter = myId (registry-verified self), not the signal's claimed userId
    const block = html.slice(isSig, storedIdx);
    expect(block).toContain('_applyPollVote(pv, myId, signal.optionIndex)');
  });

  it('persistentTypes still carries poll_vote so votes fan out', () => {
    expect(html).toMatch(/persistentTypes = \['edit', 'delete', 'reaction', 'poll_vote'\]/);
  });
});
