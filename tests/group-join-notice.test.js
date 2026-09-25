// Regression test (round 121): roster-poll member growth must be VISIBLE.
// The roster is relay-asserted and /group/join takes no signature, so a
// relay-injected member would sit silently in group.members and collect sender
// keys on the next distributeSenderKey sweep. Bearer-token groups stay safe only
// while joins are visible — every growth tick must surface in-chat (.msg sys),
// on toast (t('memberJoined')), and in auditLog('security').
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const src = readFileSync('index.html', 'utf8');

// Extract the poll callback body — same regex family as the roster poll tests.
const m = src.match(/const poll = setInterval\(async \(\) => \{\s*try \{([\s\S]*?)\n      \} catch\(e\) \{ _dbg\(e\); \}\n    \}, 5000\)/);
const BLOCK = m ? m[1] : '';

function runPoll(env) {
  return new Function('env', `
    const {token, groupId, myId, postAPIRaw, dbGet, dbPut, clearInterval, _mergeStickyGroupCaps, safeMemberList,
      auditLog, _safeDisplayName, showToast, t, _DOM, document, esc, safeSetHTML, addContact, renderContacts,
      CONFIG, _dbg} = env;
    const activeContact = env.activeContact;
    return (async () => { ${BLOCK} })();
  `)(env);
}

const groupFixture = () => ({ members: [{ id: 'me' }, { id: 'u1' }], createdBy: 'me', admins: [], bannedIds: [], name: 'G' });
const rosterData = (members, extra = {}) => ({ members, creatorId: 'me', admins: [], banned: [], name: 'G', ...extra });

function mkEnv({ data, group, activeContact = null }) {
  const calls = { toasts: [], audits: [], appended: [], dbPuts: [], added: [] };
  const box = { appended: calls.appended, scrollTop: 0, scrollHeight: 0,
    appendChild(el) { this.appended.push(el); } };
  const env = {
    token: 'tok', groupId: 'g1', myId: 'me',
    postAPIRaw: async () => ({ ok: true, json: async () => data }),
    dbGet: async (store, key) => (store === 'contacts' && key === 'g1' ? group : null),
    dbPut: async (store, rec) => { calls.dbPuts.push(rec); },
    clearInterval: () => {},
    _mergeStickyGroupCaps: (old, list) => ({ members: list, stripped: [] }),
    safeMemberList: (raw) => raw,
    auditLog: (cat, msg) => calls.audits.push([cat, msg]),
    _safeDisplayName: (s, n) => String(s).slice(0, n || 64),
    showToast: (msg, type) => calls.toasts.push([msg, type]),
    t: (k, ...a) => `${k}|${a.join(',')}`,
    _DOM: { get: (id) => (id === 'msg-messages' ? box : (id === 'msg-conv-name' ? { textContent: '' } : null)) },
    document: { createElement: () => ({ className: '', innerHTML: '' }) },
    esc: (s) => String(s),
    safeSetHTML: (el, html) => { el.innerHTML = html; },
    addContact: async (pub, name) => { calls.added.push([pub, name]); },
    renderContacts: () => {},
    CONFIG: { GROUP_MAX: 64 },
    _dbg: () => {},
    activeContact,
  };
  return { env, calls };
}

describe('roster poll join visibility', () => {
  it('announces a new member in-chat, on toast, and in audit', async () => {
    const group = groupFixture();
    const data = rosterData([{ id: 'me', pub: 'pM' }, { id: 'u1', pub: 'p1' }, { id: 'n1', pub: 'pn1', name: 'Newbie' }]);
    const { env, calls } = mkEnv({ data, group, activeContact: { id: 'g1' } });
    await runPoll(env);
    expect(calls.toasts.some(([m2]) => m2.startsWith('memberJoined|') && m2.includes('Newbie'))).toBe(true);
    expect(calls.audits.some(([c, msg]) => c === 'security' && msg.includes('joined') && msg.includes('n1'))).toBe(true);
    expect(calls.appended.some(el => el.className === 'msg sys' && el.innerHTML.includes('memberJoined'))).toBe(true);
    expect(calls.dbPuts.length).toBe(1);
  });

  it('still notifies when the group chat is closed (audit + toast, no in-chat bubble)', async () => {
    const group = groupFixture();
    const data = rosterData([{ id: 'me', pub: 'pM' }, { id: 'u1', pub: 'p1' }, { id: 'n1', pub: 'pn1', name: 'Newbie' }]);
    const { env, calls } = mkEnv({ data, group, activeContact: { id: 'other-group' } });
    await runPoll(env);
    expect(calls.toasts.some(([m2]) => m2.startsWith('memberJoined|'))).toBe(true);
    expect(calls.audits.some(([c]) => c === 'security')).toBe(true);
    expect(calls.appended.length).toBe(0);
  });

  it('fires no join notice for an unchanged roster', async () => {
    const group = groupFixture();
    const data = rosterData([{ id: 'me' }, { id: 'u1' }]);
    const { env, calls } = mkEnv({ data, group, activeContact: { id: 'g1' } });
    await runPoll(env);
    expect(calls.toasts.length).toBe(0);
    expect(calls.dbPuts.length).toBe(0);
  });

  it('fires no join notice on a meta-only change (rename)', async () => {
    const group = groupFixture();
    const data = rosterData([{ id: 'me' }, { id: 'u1' }], { name: 'Renamed' });
    const { env, calls } = mkEnv({ data, group, activeContact: { id: 'g1' } });
    await runPoll(env);
    expect(calls.dbPuts.length).toBe(1);
    expect(calls.toasts.some(([m2]) => m2.startsWith('memberJoined|'))).toBe(false);
    expect(calls.audits.some(([c, msg]) => c === 'security' && msg.includes('joined'))).toBe(false);
  });

  it('summarizes mass joins with a +N suffix', async () => {
    const group = groupFixture();
    const members = [{ id: 'me' }, { id: 'u1' }, ...Array.from({ length: 7 }, (_, i) => ({ id: `n${i}`, pub: `pn${i}`, name: `J${i}` }))];
    const { env, calls } = mkEnv({ data: rosterData(members), group, activeContact: { id: 'g1' } });
    await runPoll(env);
    const joined = calls.toasts.find(([m2]) => m2.startsWith('memberJoined|'));
    expect(joined).toBeTruthy();
    expect(joined[0]).toContain('+2');
    expect(joined[0]).not.toContain('J6');
  });

  it('pins: notice path uses memberJoined i18n, .msg sys bubble, and security audit', () => {
    expect(src).toContain("showToast(t('memberJoined', nm), 'info')");
    expect(src).toContain("d.className = 'msg sys'");
    expect(src).toContain('member(s) joined');
    expect(src).toMatch(/memberJoined: "\{0\} joined the group"/);
  });
});
