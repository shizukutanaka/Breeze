// Group-invite member binding: the invite handler in index.html stores
// invite.members verbatim into the group contact, and every group fan-out
// (sender-key distribution, message sends, kick notices) encrypts to
// member.pubB64 under member.id's identity. A crafted invite could bind a
// victim member's id to an attacker-controlled pub — this test executes the
// real filter expression extracted from index.html so it can't regress.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Extract `const inviteMembers = ... ;` up to the line before the group_invite check.
function extractFilter() {
  const start = INDEX.indexOf('const inviteMembers = (Array.isArray(invite.members)');
  const end = INDEX.indexOf("if (invite.type === 'group_invite'");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

function runFilter(members) {
  const src = extractFilter();
  const CONFIG = { GROUP_MAX: 8 };
  const fn = new Function('invite', 'CONFIG', `${src} return inviteMembers;`);
  return fn({ members }, CONFIG);
}

describe('group invite member binding', () => {
  it('keeps well-formed members', () => {
    const pub = 'ABCDEFGHIJKL' + 'x'.repeat(30);
    const out = runFilter([{ id: 'ABCDEFGHIJKL', pubB64: pub, name: 'Alice' }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ id: 'ABCDEFGHIJKL', pubB64: pub, name: 'Alice' });
  });

  it('drops entries whose id does not match pubB64 (id/pub mismatch injection)', () => {
    const victimId = 'VICTIMID0000';
    const attackerPub = 'ATTACKERPUB0' + 'y'.repeat(30);
    const out = runFilter([{ id: victimId, pubB64: attackerPub }]);
    expect(out).toHaveLength(0);
  });

  it('drops non-string or oversized fields', () => {
    const good = 'ABCDEFGHIJKL' + 'x'.repeat(30);
    const out = runFilter([
      null,
      { id: 'ABCDEFGHIJKL' }, // missing pubB64
      { id: 'ABCDEFGHIJKL', pubB64: 12345 },
      { id: 'A'.repeat(80), pubB64: good }, // id too long
      { id: 'ABCDEFGHIJKL', pubB64: good + 'z'.repeat(200) }, // pub too long
    ]);
    expect(out).toHaveLength(0);
  });

  it('strips unexpected member fields and caps name length', () => {
    const pub = 'ABCDEFGHIJKL' + 'x'.repeat(30);
    const out = runFilter([{ id: 'ABCDEFGHIJKL', pubB64: pub, name: 'N'.repeat(200), evil: '⚠' }]);
    expect(out[0].name).toHaveLength(64);
    expect(out[0].evil).toBeUndefined();
  });

  it('enforces the GROUP_MAX cap', () => {
    const pub = 'ABCDEFGHIJKL' + 'x'.repeat(30);
    const many = Array.from({ length: 50 }, () => ({ id: 'ABCDEFGHIJKL', pubB64: pub }));
    expect(runFilter(many)).toHaveLength(8);
  });
});
