// Relay-supplied group rosters: safeMemberList() (src/app/group-create.js
// since the stage 5 step 4 line-budget move) sanitizes the member list
// returned by /group/join, /group/info and the member poll — all
// untrusted relay output. Member entries are (id, pubB64) bindings and
// every fan-out encrypts to pubB64 under id's identity; this test runs
// crafted rosters through the real export so the id↔pub binding check
// can't silently regress.
import { describe, it, expect } from 'vitest';
import { safeMemberList } from '../src/app/group-create.js';

function runList(raw) {
  return safeMemberList(raw, 8); // the cap argument tracks CONFIG.GROUP_MAX
}

const goodPub = (id) => id + 'x'.repeat(32);

describe('safeMemberList — relay roster sanitization', () => {
  it('keeps well-formed members', () => {
    const out = runList([{ id: 'ABCDEFGHIJKL', pub: goodPub('ABCDEFGHIJKL'), name: 'Alice' }]);
    expect(out).toHaveLength(1);
    expect(out[0].pubB64).toBe(goodPub('ABCDEFGHIJKL'));
  });

  it('drops members whose id does not match their pub (binding injection)', () => {
    const out = runList([{ id: 'VICTIMID0000', pub: goodPub('ATTACKERPUB0') }]);
    expect(out).toHaveLength(0);
  });

  it('drops members with missing or malformed pubs', () => {
    const out = runList([
      { id: 'ABCDEFGHIJKL' },                                     // no pub
      { id: 'ABCDEFGHIJKL', pub: 'not base64!!!' },               // bad charset
      { id: 'ABCDEFGHIJKL', pub: 'ABC' },                         // too short to contain id
      { id: 'ABCDEFGHIJKL', pub: goodPub('ABCDEFGHIJKL') + '😈' }, // bad charset
    ]);
    expect(out).toHaveLength(0);
  });

  it('enforces the GROUP_MAX cap', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: 'ABCDEFGHIJKL', pub: goodPub('ABCDEFGHIJKL') }));
    expect(runList(many)).toHaveLength(8);
  });

  it('keeps caps but sanitizes entries', () => {
    const out = runList([{ id: 'ABCDEFGHIJKL', pub: goodPub('ABCDEFGHIJKL'), caps: ['group-v5', 7, 'x'.repeat(64)] }]);
    expect(out[0].caps).toEqual(['group-v5', 'x'.repeat(32)]);
  });
});
