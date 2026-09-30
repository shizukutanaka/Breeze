// Relay-supplied group rosters: safeMemberList() in index.html sanitizes the
// member list returned by /group/join, /group/info and the member poll — all
// untrusted relay output. Member entries are (id, pubB64) bindings and every
// fan-out encrypts to pubB64 under id's identity; this test compiles the real
// function extracted from index.html and runs crafted rosters through it so
// the id↔pub binding check can't silently regress.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

function extractFn() {
  const start = INDEX.indexOf('function safeMemberList');
  expect(start).toBeGreaterThan(-1);
  const end = INDEX.indexOf('\n  }\n', start);
  expect(end).toBeGreaterThan(start);
  return INDEX.slice(start, end + 5);
}

function runList(raw) {
  const src = extractFn();
  const CONFIG = { GROUP_MAX: 8 };
  const fn = new Function('CONFIG', `${src} return safeMemberList;`)(CONFIG);
  return fn(raw);
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
