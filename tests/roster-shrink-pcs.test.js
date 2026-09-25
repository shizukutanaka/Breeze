import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// The group roster poll (startGroupMemberPoll) reconciles membership BOTH ways against
// the server roster — but historically stopped at the roster field. The kick/leave
// notices that trigger epoch rotation are best-effort E2E (relay drop, TTL, reorder),
// so a device that missed the notice still learned the member was gone — yet kept its
// PRE-SHRINK chain key. The departed member, who holds that key, keeps decrypting every
// future send (PCS gap). The poll must carry the notice semantics: shrink → rotate my
// chain key + redistribute; ME gone → kicked flag (gate my sends).
const POLL_BODY = /const poll = setInterval\(async \(\) => \{\s*try \{([\s\S]*?)\n      \} catch\(e\) \{ _dbg\(e\); \}\n    \}, 5000\)/;

function buildPoll(env) {
  const m = html.match(POLL_BODY);
  expect(m, 'roster poll body not found').toBeTruthy();
  const body =
    'let activeContact = env.activeContact;\n' +
    'const {token, groupId, postAPIRaw, dbGet, dbPut, _mergeStickyGroupCaps, safeMemberList, _DOM, addContact, renderContacts, clearInterval, _dbg, myId, _rotateGroupEpoch, _redistSenderKey, showToast, t, CONFIG} = env;\n' +
    'const poll = {};\n' +
    'return (async () => { try {' + m[1] + '\n      } catch(e) { _dbg(e); } })().then(() => ({ activeContact }));';
  return new Function('env', body)(env);
}

function makeEnv({ serverMembers, groupMembers, gskEpoch = 4, activeContactId = null, extraData = {} }) {
  const calls = { rot: [], redist: [], puts: [], toasts: [], renders: 0 };
  const group = { id: 'g_tok', isGroup: true, joinToken: 'tok', members: groupMembers, unread: 0, name: 'G', createdBy: 'me', admins: [], bannedIds: [] };
  const env = {
    token: 'tok', groupId: 'g_tok', myId: 'me',
    postAPIRaw: async () => ({ ok: true, json: async () => ({ members: serverMembers, creatorId: 'me', admins: [], ...extraData }) }),
    dbGet: async (store, key) => store === 'contacts' ? (key === 'g_tok' ? group : null) : ({ epoch: gskEpoch }),
    dbPut: async (s, v) => { calls.puts.push([s, v]); return true; },
    _mergeStickyGroupCaps: (old, server) => ({ members: server, stripped: [] }),
    safeMemberList: (m) => Array.isArray(m) ? m : [],
    _DOM: { get: () => ({ textContent: '' }) },
    addContact: async () => {},
    renderContacts: () => { calls.renders++; },
    clearInterval: () => {},
    _dbg: () => {},
    _rotateGroupEpoch: async (g, e) => { calls.rot.push(e); return true; },
    _redistSenderKey: (g, tag) => { calls.redist.push(tag); },
    showToast: (txt, kind) => { calls.toasts.push([txt, kind]); },
    t: (k, n) => k + ':' + n,
    CONFIG: { GROUP_MAX: 64 },
    activeContact: activeContactId ? { id: activeContactId, name: 'G' } : null,
  };
  return { env, calls, group };
}

const mbr = (id) => ({ id, pubB64: 'pub_' + id, name: id });

describe('roster poll shrink → PCS (shipped callback, driven)', () => {
  it('extracts the setInterval poll callback', () => {
    expect(html.match(POLL_BODY)).toBeTruthy();
  });

  it('member removed → rotates my chain key to next epoch + redistributes', async () => {
    const { env, calls } = makeEnv({
      groupMembers: [mbr('me'), mbr('a'), mbr('b')],
      serverMembers: [mbr('me'), mbr('a')],
    });
    await buildPoll(env);
    expect(calls.rot).toEqual([5]);           // gskEpoch(4) + 1
    expect(calls.redist).toEqual(['roster-shrink-redist']);
  });

  it('I am the removed member → kicked flag persisted, toast, conversation closed', async () => {
    const { env, calls } = makeEnv({
      groupMembers: [mbr('me'), mbr('a'), mbr('b')],
      serverMembers: [mbr('a'), mbr('b')],
      activeContactId: 'g_tok',
    });
    const out = await buildPoll(env);
    const put = calls.puts.find(([, v]) => v.id === 'g_tok');
    expect(put && put[1].kicked).toBe(true);
    expect(calls.toasts.some(([txt]) => txt.startsWith('toastKickedFromGroup'))).toBe(true);
    expect(out.activeContact).toBe(null);     // open conversation closed
    expect(calls.rot).toEqual([]);            // no key rotation for a group I'm out of
    expect(calls.redist).toEqual([]);
  });

  it('growth-only change → no rotation (joiner does not need PCS)', async () => {
    const { env, calls } = makeEnv({
      groupMembers: [mbr('me'), mbr('a')],
      serverMembers: [mbr('me'), mbr('a'), mbr('c')],
    });
    await buildPoll(env);
    expect(calls.rot).toEqual([]);
    expect(calls.redist).toEqual([]);
  });

  it('unchanged roster+meta → no writes at all', async () => {
    const { env, calls } = makeEnv({
      groupMembers: [mbr('me'), mbr('a')],
      serverMembers: [mbr('me'), mbr('a')],
    });
    await buildPoll(env);
    expect(calls.puts).toEqual([]);
    expect(calls.rot).toEqual([]);
    expect(calls.redist).toEqual([]);
  });
});

describe('shrink-handling pins', () => {
  it('poll computes removed members and branches on me-gone first', () => {
    const i = html.indexOf('roster-shrink-redist');
    expect(i).toBeGreaterThan(0);
    const region = html.slice(i - 1200, i);
    expect(region).toContain('removed.some(o => o.id === myId)');
    expect(region).toContain('group.kicked = true');
  });

  it('rotation feeds the CURRENT stored epoch + 1 (monotonic, per-sender counter)', () => {
    expect(html).toMatch(/_rotateGroupEpoch\(group, \(\(cur\?\.epoch\) \|\| 0\) \+ 1\)/);
  });

  it('kick/leave notice epoch guards still untouched (rotation only, not removal)', () => {
    expect(html).toContain('if (current && (current.epoch || 0) >= epoch) return;');
  });
});
