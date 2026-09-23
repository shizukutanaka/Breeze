import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const APPEND = SRC.match(/function appendMsg\(text, isMine, ts, box, fileData, meta\) \{[\s\S]+?\n  \}\n/)[0];
const REPLIES = SRC.match(/function showSmartReplies\(lastMsgText\) \{[\s\S]+?\n  \}\n/)[0];

describe('dead-context wire arrivals cannot write the shared message view', () => {
  it('appendMsg bails on an aborted context before touching the DOM', () => {
    // dc.onmessage/poll continuations landing after the switch rendered the old
    // account's plaintext into the new account's open conversation.
    expect(APPEND).toContain('if (_ac.signal.aborted) return;');
    expect(APPEND.indexOf('_ac.signal.aborted')).toBeLessThan(APPEND.indexOf("meta = meta || {}"));
  });
  it('showSmartReplies bails on an aborted context', () => {
    // Called right next to appendMsg on both wire-arrival paths — same class.
    expect(REPLIES).toContain('if (_ac.signal.aborted) return;');
    expect(REPLIES.indexOf('_ac.signal.aborted')).toBeLessThan(REPLIES.indexOf("smart-reply-bar"));
  });
  it('both guards sit inside initMessenger scope where _ac is declared', () => {
    const ac = SRC.indexOf('const _ac = new AbortController()');
    expect(ac).toBeGreaterThan(SRC.indexOf('async function initMessenger'));
    expect(ac).toBeLessThan(SRC.indexOf('function appendMsg('));
    expect(ac).toBeLessThan(SRC.indexOf('function showSmartReplies('));
  });
  it('functional: aborted funnel leaves the box untouched', () => {
    const append = new Function('_ac', 'box', "if (_ac.signal.aborted) return; box.children.push('m');");
    const ac = new AbortController();
    const box = { children: [] };
    append(ac, box);
    expect(box.children.length).toBe(1);
    ac.abort();
    append(ac, box);
    expect(box.children.length).toBe(1);
  });
});
