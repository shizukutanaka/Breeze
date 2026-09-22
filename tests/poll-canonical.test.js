import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the real shipped _safePoll (indexOf + slice like the project's other extract tests).
const start = SRC.indexOf('  function _safePoll(p) {');
const end = SRC.indexOf('\n  }', start) + 4;
const _safePoll = new Function('src', `${SRC.slice(start, end)}; return _safePoll;`)();

describe('_safePoll — wire polls are canonicalized before storage', () => {
  it('strips pre-seeded votes entirely — legit polls always start with votes empty (votes arrive via poll_vote)', () => {
    const p = _safePoll({ type: 'poll', pollId: 'x:1', question: 'q?', options: [
      { text: 'a', votes: ['fake1', 'fake2', 'fake3'] },
      { text: 'b', votes: 'not-an-array' },
      { text: 'c' },
    ]});
    expect(p.options.map(o => o.votes)).toEqual([[], [], []]);
  });

  it('bounds options count and per-option text length', () => {
    const opts = Array.from({ length: 100 }, (_, i) => ({ text: 'opt' + i + 'X'.repeat(500), votes: [] }));
    const p = _safePoll({ type: 'poll', pollId: 'x:2', question: 'q', options: opts });
    expect(p.options.length).toBe(50);
    expect(p.options[0].text.length).toBe(200);
  });

  it('filters non-object options and bounds question/pollId/creator', () => {
    const p = _safePoll({ type: 'poll', pollId: 'P'.repeat(300), question: 'Q'.repeat(400),
      creator: 'C'.repeat(300), options: [7, null, 'str', { text: 'real' }] });
    expect(p.pollId.length).toBe(128);
    expect(p.question.length).toBe(200);
    expect(p.creator.length).toBe(128);
    expect(p.options).toEqual([{ text: 'real', votes: [] }]);
  });

  it('rejects unusable shapes (null, wrong type, missing/non-array options, empty pollId)', () => {
    expect(_safePoll(null)).toBeNull();
    expect(_safePoll({ type: 'file', pollId: 'x', options: [] })).toBeNull();
    expect(_safePoll({ type: 'poll', pollId: 'x' })).toBeNull();
    expect(_safePoll({ type: 'poll', pollId: '' })).toBeNull();
    expect(_safePoll({ type: 'poll', pollId: 7, options: [] })).toBeNull();
  });

  it('both wire ingest sites canonicalize and overwrite the stored text (tripwire)', () => {
    expect((SRC.match(/const _sp = _safePoll\(_p\); if \(_sp\) \{ meta\.isPoll = true; meta\.poll = _sp; text = JSON\.stringify\(_sp\); \}/g) || []).length).toBe(2);
    // The old verbatim-store form must not remain.
    expect(SRC).not.toContain('meta.poll = _p;');
  });
});
