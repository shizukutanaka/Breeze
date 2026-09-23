import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('wire edit preserves poll parseability', () => {
  it('all 3 receive-edit sites gate on poll-parseable text', () => {
    const sites = SRC.match(/!stored\.isPoll \|\| \(\(\) => \{ try \{ const _po = JSON\.parse/g) || [];
    expect(sites.length).toBe(2); // group + 1:1 predicate sites
    expect(SRC.match(/if \(stored\.isPoll\) \{ try \{ const _po = JSON\.parse\(_newText\)/g)?.length).toBe(1); // self-sync site
    expect(SRC.match(/stored\.text = signal\.text\.slice\(0, 65536\); stored\.edited = true/g).length).toBe(2); // writes still bounded
  });
  it('functional: the predicate accepts object JSON, rejects scalars/non-JSON', () => {
    const chk = new Function('stored', 'signal',
      `return (!stored.isPoll || (() => { try { const _po = JSON.parse(signal.text.slice(0, 65536)); return !!(_po && typeof _po === 'object'); } catch { return false; } })());`);
    const poll = { isPoll: true };
    expect(chk(poll, { text: '{"type":"poll","pollId":"p1","options":[]}' })).toBe(true);  // legit edited poll JSON
    expect(chk(poll, { text: 'hello not json' })).toBe(false);                              // malformed edit
    expect(chk(poll, { text: '"a json string"' })).toBe(false);                             // scalar — .pollId would be undefined
    expect(chk(poll, { text: 'null' })).toBe(false);                                        // null object guard
    expect(chk(poll, { text: '123' })).toBe(false);
    expect(chk({ isPoll: false }, { text: 'anything' })).toBe(true);                        // non-poll: untouched
  });
  it('functional: self-sync site keeps isPoll record on bad edit, applies good edit', () => {
    const body = SRC.match(/const _newText = signal\.text\.slice\(0, 65536\);[\s\S]+?if \(_editOk\) \{ stored\.text = _newText; stored\.edited = true; await dbPut\('messages', stored\); \}/)[0];
    const run = async (stored, text) => {
      let saved = null;
      const dbPut = async (s, v) => { saved = v; };
      await new Function('stored', 'signal', 'dbPut', `return (async()=>{ ${body} })()`)(stored, { text }, dbPut);
      return { stored, saved };
    };
    return (async () => {
      const bad = await run({ isPoll: true, text: '{"pollId":"p"}' }, 'corrupted text');
      expect(bad.saved).toBeNull();           // rejected — poll survives
      const good = await run({ isPoll: true, text: '{"pollId":"p"}' }, '{"pollId":"p","question":"new"}');
      expect(good.saved.text).toBe('{"pollId":"p","question":"new"}');
      const plain = await run({ text: 'x' }, 'edited');
      expect(plain.saved.edited).toBe(true);  // non-poll path untouched
    })();
  });
});
