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

  it('keeps sanitized caps so invitees can negotiate group-v5', () => {
    const pub = 'ABCDEFGHIJKL' + 'x'.repeat(30);
    const out = runFilter([
      { id: 'ABCDEFGHIJKL', pubB64: pub, caps: ['group-v5', 7, 'c'.repeat(40)] },
      { id: 'ABCDEFGHIJKL', pubB64: pub, caps: 'group-v5' },
    ]);
    expect(out[0].caps).toEqual(['group-v5', 'c'.repeat(32)]);
    expect(out[1].caps).toBeUndefined();
  });

  it('enforces the GROUP_MAX cap', () => {
    const pub = 'ABCDEFGHIJKL' + 'x'.repeat(30);
    const many = Array.from({ length: 50 }, () => ({ id: 'ABCDEFGHIJKL', pubB64: pub }));
    expect(runFilter(many)).toHaveLength(8);
  });
});

// Round-7 re-audit: the invite handler took invite.groupId as the
// contacts-store key with no namespace check. Contact ids are the
// first 12 chars of a public key (public information) and group ids
// are always minted as 'g_…', so a contact could send an invite whose
// groupId is a third party's contact id. The fake group then occupies
// that id: addContact() finds "an existing record" and returns, so the
// real person can never be added, and the chat the id opens is a
// group whose name and members the attacker chose. Runs the REAL
// handler and the REAL addContact, sliced from index.html, over one
// in-memory contacts store.
describe('group invite id namespace', () => {
  function slice(startMarker, endMarker) {
    const start = INDEX.indexOf(startMarker);
    const end = INDEX.indexOf(endMarker, start);
    expect(start, startMarker).toBeGreaterThan(-1);
    expect(end, endMarker).toBeGreaterThan(start);
    return INDEX.slice(start, end);
  }

  const MALLORY_PUB = 'MALLORYPUB00' + 'm'.repeat(32);
  const TARGET_PUB = 'TARGETPUB000' + 't'.repeat(32);
  const mallory = { id: MALLORY_PUB.slice(0, 12), pubB64: MALLORY_PUB, name: 'Mallory', unread: 0 };

  function world() {
    const contacts = new Map([[mallory.id, { ...mallory }]]);
    const dbGet = async (store, key) => (store === 'contacts' ? contacts.get(key) : undefined);
    const dbPut = async (store, value) => { if (store === 'contacts') contacts.set(value.id, value); return true; };
    const onInvite = new Function(
      'dbGet', 'dbPut', 'decryptFrom', 'CONFIG', '_focusActive', 'playNotif', '_renderContactsThrottled', '_dbg',
      `return async function (msg) { ${slice('if (msg.isGroupInvite) {', '// === Group message ===')} };`,
    )(dbGet, dbPut, async (payload) => payload, { GROUP_MAX: 8 }, () => true, () => {}, () => {}, (e) => { throw e; });
    const addContact = new Function(
      'dbGet', 'dbPut', 'sanitizeHomeList', '_profileUI', 'auditLog', 'renderContacts', '_dbg',
      // Batch-2 fix (d): addContact now also consults _settings /
      // dbGetAll / saveSettings / _showBackupNudgeCard for the one-time
      // first-contact backup nudge. The world has 2 contacts by the time
      // it runs, so the nudge correctly stays silent here.
      '_settings', 'dbGetAll', 'saveSettings', '_showBackupNudgeCard',
      `const _nameTools = null, _requests = null; ${slice("async function addContact(pubB64, name, homeHint, alias = '') {", '// Stage-2 step 6: the contact-settings carrier')} return addContact;`,
    )(dbGet, dbPut, () => [], null, () => {}, async () => {}, (e) => { throw e; },
      { backupNudgeShown: false }, async () => [...contacts.values()], () => {}, () => {});
    const invite = (groupId) => onInvite({
      isGroupInvite: true, from: mallory.id,
      payload: JSON.stringify({ type: 'group_invite', groupId, name: 'Target', members: [{ id: mallory.id, pubB64: MALLORY_PUB, name: 'Mallory' }] }),
    });
    return { contacts, invite, addContact };
  }

  it('an invite cannot occupy a contact id', async () => {
    const { contacts, invite, addContact } = world();
    const targetId = TARGET_PUB.slice(0, 12);
    await invite(targetId);
    expect(contacts.has(targetId)).toBe(false);
    await addContact(TARGET_PUB, 'Target');
    expect(contacts.get(targetId)).toMatchObject({ id: targetId, pubB64: TARGET_PUB, name: 'Target' });
    expect(contacts.get(targetId).isGroup).toBeUndefined();
  });

  it('rejects every id outside the group namespace', async () => {
    const { contacts, invite } = world();
    for (const id of ['', 'g_', 'G_abc', 'x_abc', 'g_a b', 'g_a/b', 'g_' + 'a'.repeat(63), ' g_abc', 'g_abc\n', '__proto__']) await invite(id);
    await invite({ toString: () => 'g_abc' });
    expect([...contacts.keys()]).toEqual([mallory.id]);
  });

  it('still accepts real group ids (peer-created and relay-created)', async () => {
    const { contacts, invite } = world();
    await invite('g_m3k9x2abq1z7yf');   // 'g_' + uid()
    await invite('g_0a1b2c3d4e5f');     // 'g_' + 12-char join token
    expect(contacts.get('g_m3k9x2abq1z7yf')).toMatchObject({ isGroup: true, name: 'Target', pubB64: '' });
    expect(contacts.get('g_0a1b2c3d4e5f').members).toEqual([{ id: mallory.id, pubB64: MALLORY_PUB, name: 'Mallory' }]);
  });

  it('never overwrites a group that already exists', async () => {
    const { contacts, invite } = world();
    contacts.set('g_existing1', { id: 'g_existing1', name: 'Real', isGroup: true, members: [] });
    await invite('g_existing1');
    expect(contacts.get('g_existing1').name).toBe('Real');
  });
});
