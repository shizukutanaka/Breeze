// Regression test (round 122): roster poll resilience + privilege-change visibility.
// Three defects in startGroupMemberPoll:
//  (1) `!resp.ok` killed the poll on ANY HTTP error — one transient 5xx/429 froze
//      roster convergence for the whole session (silent stale membership; the
//      kick/leave + join-visibility logic living in this callback dies with it).
//  (2) An empty `members` roster overwrote group.members=[] — a malformed/malicious
//      response wiped local membership (a member always sees itself in a real roster).
//  (3) creatorId/admins changes were applied silently — relay-asserted privilege data
//      drives isPrivileged on incoming group signals, so an invisible admin elevation
//      let a forged member's kick/meta notices pass locally.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('index.html', 'utf8');

const m = src.match(/const poll = setInterval\(async \(\) => \{\s*try \{([\s\S]*?)\n      \} catch\(e\) \{ _dbg\(e\); \}\n    \}, 5000\)/);
const BLOCK = m ? m[1] : '';

function runPoll(env) {
  return new Function('env', `
    const {token, groupId, myId, postAPIRaw, dbGet, dbPut, clearInterval, _mergeStickyGroupCaps, safeMemberList,
      auditLog, _safeDisplayName, showToast, t, _DOM, document, esc, safeSetHTML, addContact, renderContacts,
      CONFIG, _dbg, _memberName, poll} = env;
    const activeContact = env.activeContact;
    return (async () => { ${BLOCK} })();
  `)(env);
}

const groupFixture = (over = {}) => ({ members: [{ id: 'me' }, { id: 'u1', name: 'Uma' }], createdBy: 'me', admins: [], bannedIds: [], name: 'G', ...over });
const rosterData = (members, extra = {}) => ({ members, creatorId: 'me', admins: [], banned: [], name: 'G', ...extra });

function mkEnv({ resp, group, activeContact = null }) {
  const calls = { toasts: [], audits: [], dbPuts: [], intervals: 0, added: [] };
  const env = {
    token: 'tok', groupId: 'g1', myId: 'me', poll: {},
    postAPIRaw: async () => resp,
    dbGet: async (store, key) => (store === 'contacts' && key === 'g1' ? group : null),
    dbPut: async (store, rec) => { calls.dbPuts.push(rec); },
    clearInterval: () => { calls.intervals++; },
    _mergeStickyGroupCaps: (old, list) => ({ members: list, stripped: [] }),
    safeMemberList: (raw) => raw,
    auditLog: (cat, msg) => calls.audits.push([cat, msg]),
    _safeDisplayName: (s, n) => String(s).slice(0, n || 64),
    showToast: (msg, type) => calls.toasts.push([msg, type]),
    t: (k, ...a) => `${k}|${a.join(',')}`,
    _DOM: { get: (id) => (id === 'msg-messages' ? { appendChild() {}, scrollTop: 0, scrollHeight: 0 } : (id === 'msg-conv-name' ? { textContent: '' } : null)) },
    document: { createElement: () => ({ className: '', innerHTML: '' }) },
    esc: (s) => String(s),
    safeSetHTML: (el, html) => { el.innerHTML = html; },
    addContact: async (pub, name) => { calls.added.push([pub, name]); },
    renderContacts: () => {},
    CONFIG: { GROUP_MAX: 64 },
    _dbg: () => {},
    _memberName: (members, id) => (((members || []).find(mm => mm.id === id)) || {}).name || id,
    activeContact,
  };
  return { env, calls };
}

const ok = (data) => ({ ok: true, status: 200, json: async () => data });
const err = (status) => ({ ok: false, status, json: async () => ({}) });

describe('roster poll resilience', () => {
  it('survives a null response (network error) and keeps polling', async () => {
    const { env, calls } = mkEnv({ resp: null, group: groupFixture() });
    await runPoll(env);
    expect(calls.intervals).toBe(0);
  });

  it('survives transient 5xx and 429 errors', async () => {
    for (const status of [500, 502, 503, 429]) {
      const { env, calls } = mkEnv({ resp: err(status), group: groupFixture() });
      await runPoll(env);
      expect(calls.intervals).toBe(0);
    }
  });

  it('stops polling only on definitive 4xx failures', async () => {
    for (const status of [400, 403, 404, 410]) {
      const { env, calls } = mkEnv({ resp: err(status), group: groupFixture() });
      await runPoll(env);
      expect(calls.intervals).toBe(1);
    }
  });

  it('ignores an empty roster instead of wiping group.members', async () => {
    const group = groupFixture();
    const { env, calls } = mkEnv({ resp: ok(rosterData([])), group });
    await runPoll(env);
    expect(calls.dbPuts.length).toBe(0);
    expect(group.members.length).toBe(2);
    expect(calls.toasts.length).toBe(0);
  });

  it('announces a creator transfer detected by the poll', async () => {
    const group = groupFixture();
    const data = rosterData([{ id: 'me' }, { id: 'u1', pub: 'p1', name: 'Uma' }], { creatorId: 'u1' });
    const { env, calls } = mkEnv({ resp: ok(data), group });
    await runPoll(env);
    expect(group.createdBy).toBe('u1');
    expect(calls.toasts.some(([m2]) => m2.startsWith('transferredOwnership|') && m2.includes('Uma'))).toBe(true);
    expect(calls.audits.some(([c, msg]) => c === 'security' && msg.includes('creator'))).toBe(true);
  });

  it('announces admin promote and demote detected by the poll', async () => {
    // Promote u1
    let group = groupFixture();
    let data = rosterData([{ id: 'me' }, { id: 'u1', pub: 'p1', name: 'Uma' }], { admins: ['u1'] });
    let { env, calls } = mkEnv({ resp: ok(data), group });
    await runPoll(env);
    expect(calls.toasts.some(([m2]) => m2.startsWith('promotedAdmin|') && m2.includes('Uma'))).toBe(true);
    // Demote u1
    group = groupFixture({ admins: ['u1'] });
    data = rosterData([{ id: 'me' }, { id: 'u1', pub: 'p1', name: 'Uma' }], { admins: [] });
    ({ env, calls } = mkEnv({ resp: ok(data), group }));
    await runPoll(env);
    expect(calls.toasts.some(([m2]) => m2.startsWith('demotedAdmin|') && m2.includes('Uma'))).toBe(true);
  });

  it('stays silent when creatorId is first learned (no prior value)', async () => {
    const group = groupFixture();
    delete group.createdBy;
    const data = rosterData([{ id: 'me' }, { id: 'u1' }], { creatorId: 'me' });
    const { env, calls } = mkEnv({ resp: ok(data), group });
    await runPoll(env);
    expect(group.createdBy).toBe('me');
    expect(calls.toasts.some(([m2]) => m2.startsWith('transferredOwnership|'))).toBe(false);
  });

  it('pins: 4xx-only stop, empty-roster guard, and privilege-diff notices', () => {
    expect(src).toContain('resp.status >= 400 && resp.status < 500 && resp.status !== 429');
    expect(src).toContain('!newMembers.length');
    expect(src).toContain('const _prevAdmins = group.admins || []; const _prevCreator = group.createdBy;');
    expect(src).toContain("showToast(t('promotedAdmin', _memberName(newMembers, _pid))");
    expect(src).toContain("showToast(t('demotedAdmin', _memberName(oldMembers, _did))");
    expect(src).toContain("showToast(t('transferredOwnership', _memberName(newMembers, group.createdBy))");
  });
});
