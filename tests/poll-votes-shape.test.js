import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Extract the real shipped statements. A peer-controlled wire poll is stored
// verbatim after ingest's Array.isArray(options) check — per-option votes/text
// shapes pass through unvalidated — so each vote site must normalize votes
// before calling .filter/.push on it.
const STMT_RE = /opt\.votes = \(Array\.isArray\(opt\.votes\) \? opt\.votes : \[\]\)\.filter\(v => v !== (\w+)\);/g;
const stmts = [...SRC.matchAll(STMT_RE)].map(m => ({ text: m[0], var: m[1] }));
function runStmt(i, poll) {
  const { text, var: v } = stmts[i];
  return new Function('poll', 'myId', 'voterId', `for (const opt of poll.options) { ${text} }`)(poll, 'voterA', 'voterA');
}

describe('poll vote paths tolerate malformed wire-stored option shapes', () => {
  it('uses the normalized-votes form at every vote site (local + group + 1:1 P2P)', () => {
    expect(stmts.length).toBe(3);
    // The pre-fix unguarded form must not remain anywhere.
    expect(/opt\.votes = opt\.votes\.filter/.test(SRC)).toBe(false);
  });

  it('non-array votes do not crash and self-heal to arrays (votes:null / votes:"x" / option missing votes)', () => {
    for (let i = 0; i < stmts.length; i++) {
      const poll = { options: [{ text: 'a', votes: null }, { text: 'b', votes: 'x' }, { text: 'c' }] };
      runStmt(i, poll);
      expect(poll.options.map(o => o.votes)).toEqual([[], [], []]);
      // Now the push the sites perform is safe — before the fix this threw on votes:null.
      poll.options[0].votes.push('voterA');
      expect(poll.options[0].votes).toEqual(['voterA']);
    }
  });

  it('still removes the voter\u2019s previous vote from well-formed arrays', () => {
    const poll = { options: [{ text: 'a', votes: ['voterA', 'other'] }, { text: 'b', votes: ['voterA'] }] };
    runStmt(0, poll);
    expect(poll.options[0].votes).toEqual(['other']);
    expect(poll.options[1].votes).toEqual([]);
  });

  it('the 1:1 P2P find() wraps JSON.parse — an isPoll record with unparseable text can\u2019t crash the voter\u2019s handler', () => {
    const seg = SRC.slice(SRC.indexOf("msg.type === 'poll_vote'"), SRC.indexOf("msg.type === 'poll_vote'") + 800);
    expect(seg).toContain('try { return JSON.parse(m.text).pollId');
    expect(seg).toContain('catch { return false; }');
    expect(seg).not.toContain('allMsgs.find(m => m.isPoll && JSON.parse(m.text)');
  });

  it('the group find() stays try-wrapped (regression tripwire)', () => {
    const idx = SRC.indexOf("signal.type === 'poll_vote'");
    const seg = SRC.slice(idx, idx + 800);
    expect(seg).toContain('catch { return false; }');
  });
});
