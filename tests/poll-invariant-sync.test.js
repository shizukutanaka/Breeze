import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('isPoll => parseable invariant: sync writer + last bare reader', () => {
  it('self-sync mirrors isPoll only when syncText parses to an object', () => {
    expect(SRC).toContain('const syncPollOk = (() => { try { const p = JSON.parse(syncText); return p !== null && typeof p === \'object\'; } catch { return false; } })();');
    expect(SRC).toContain('isPoll: (msg.isPoll && syncPollOk) || undefined');
  });
  it('no bare JSON.parse(m.text) remains inside a .find( poll lookup', () => {
    expect(SRC).toContain("allMsgs.find(m => m.isPoll && (() => { try { return JSON.parse(m.text).pollId === msg.pollId; } catch { return false; } })());");
    expect(SRC).not.toContain("allMsgs.find(m => m.isPoll && JSON.parse(m.text).pollId === msg.pollId);");
  });
  it('functional: poisoned isPoll record cannot crash the vote lookup', () => {
    const allMsgs = [
      { isPoll: true, text: 'not json' },                       // poison record
      { isPoll: true, text: JSON.stringify({ pollId: 'p1' }) },  // real poll
      { isPoll: true, text: 'null' },                            // parses but null
    ];
    const find = (pollId) => allMsgs.find(m => m.isPoll && (() => { try { return JSON.parse(m.text).pollId === pollId; } catch { return false; } })());
    expect(find('p1')?.text).toContain('p1');
    expect(find('nope')).toBeUndefined();
    // writer-side: isPoll only when text parses to an object
    const syncPollOk = (syncText) => { try { const p = JSON.parse(syncText); return p !== null && typeof p === 'object'; } catch { return false; } };
    const isPoll = (claimed, syncText) => (claimed && syncPollOk(syncText)) || undefined;
    expect(isPoll(true, '{"pollId":"x"}')).toBe(true);
    expect(isPoll(true, 'junk')).toBeUndefined();
    expect(isPoll(true, '42')).toBeUndefined();
    expect(isPoll(true, 'null')).toBeUndefined();
    expect(isPoll(false, '{"pollId":"x"}')).toBeUndefined();
  });
});
