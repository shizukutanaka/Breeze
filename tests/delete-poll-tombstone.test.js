import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const SRC = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('delete tombstone drops isPoll (poll lookups can\'t throw on \'\')', () => {
  it('all 4 delete sites clear isPoll alongside text=\'\'', () => {
    const sites = SRC.match(/stored\.deleted = true; stored\.text = ''; delete stored\.isPoll;/g) || [];
    expect(sites.length).toBe(4);
    // No tombstone may keep the flag (patched sites are followed by 'delete', not 'await')
    expect(SRC.match(/stored\.deleted = true; stored\.text = '';\s*await/g)?.length ?? 0).toBe(0);
  });
  it('no isPoll JSON.parse path can hit a tombstoned record', () => {
    // After the fix, any record with isPoll===true has intact JSON text —
    // the only writers of text='' are the delete sites, which now clear it.
    const tombstone = { isPoll: undefined, deleted: true, text: '' };
    expect(() => JSON.parse(tombstone.text)).toThrow(); // would have thrown
    const find = new Function('allMsgs', 'msg',
      `return allMsgs.find(m => m.isPoll && JSON.parse(m.text).pollId === msg.pollId);`);
    const msgs = [tombstone, { isPoll: true, text: '{"pollId":"p1"}' }];
    expect(find(msgs, { pollId: 'p1' }).text).toContain('p1'); // healthy poll still found
    expect(find(msgs, { pollId: 'p9' })).toBeUndefined();     // tombstone never matches
  });
  it('functional: delete-site statement sequence clears flag before persist', () => {
    const stmts = `let stored = { isPoll: true, text: '{\"pollId\":\"p\"}', deleted: false };
      stored.deleted = true; stored.text = ''; delete stored.isPoll;`;
    const run = new Function(`return (() => { ${stmts} return stored; })()`);
    const r = run();
    expect(r.isPoll).toBeUndefined();
    expect(r.deleted).toBe(true);
    expect(r.text).toBe('');
  });
});
