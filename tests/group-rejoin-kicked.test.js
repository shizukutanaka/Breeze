import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const html = readFileSync('index.html', 'utf8');

function extract(re) {
  const m = html.match(re);
  if (!m) throw new Error('marker not found: ' + re);
  return m[0];
}

const ROSTER = [
  { id: 'myid12345678', pub: 'myid12345678' + 'A'.repeat(80), name: 'Me' },
  { id: 'peer87654321', pub: 'peer87654321' + 'B'.repeat(80), name: 'Peer' },
];

// Run the shipped processJoinToken against a stub env — it is the only path that
// re-admits a kicked member, so the kicked-flag lifecycle must be proven there.
function makePjt(store, joinData, calls = { added: [], open: [], toasts: [] }) {
  const env = {
    API: 'https://x', myId: 'myid12345678', myPubB64: 'myid12345678' + 'A'.repeat(80), myName: 'Me',
    CONFIG: { GROUP_RATCHET_V5: true, GROUP_MAX: 100 }, CAPS_GROUP_V5: 'group-v5',
    postAPIRaw: async () => ({ ok: true, json: async () => joinData }),
    dbGet: async (st, k) => store[`${st}:${k}`],
    dbPut: async (st, v, k) => { store[`${st}:${k || v.id}`] = v; },
    addContact: async (pub, name) => { calls.added.push([pub, name]); },
    renderContacts: async () => {}, openConversation: (g) => { calls.open.push(g.id); },
    startGroupMemberPoll: () => {}, showToast: (m, k) => { calls.toasts.push([m, k]); },
    auditLog: () => {}, _dbg: () => {},
    history: { replaceState: () => {} }, location: { pathname: '/' }, t: (k) => k,
    // Helpers unrelated to the kicked flag — pass-through stubs.
    safeMemberList: (raw) => (Array.isArray(raw) ? raw : []),
    _mergeStickyGroupCaps: (old, nw) => ({ members: nw, stripped: [] }),
    _computeGroupV5: () => true, _safeDisplayName: (n) => n,
  };
  const block = extract(/  async function processJoinToken\(token\) \{[\s\S]*?\n  \}\n/);
  return new Function('env', 'const {' + Object.keys(env).join(',') + '} = env; ' + block + ' return processJoinToken;')(env);
}

describe('group rejoin after unban — stale kicked flag', () => {
  it('clears kicked when the server re-admits the member (kick → unban → rejoin)', async () => {
    const store = { 'contacts:g_tok1': { id: 'g_tok1', isGroup: true, kicked: true, members: [ROSTER[0]], joinToken: 'tok1' } };
    const pjt = makePjt(store, { name: 'G', members: ROSTER, creatorId: 'peer87654321', admins: [] });
    await pjt('tok1');
    expect(store['contacts:g_tok1'].kicked).toBeUndefined();
    expect(store['contacts:g_tok1'].members.length).toBe(2);
  });

  it('rejoin still updates roster + moderation metadata', async () => {
    const store = { 'contacts:g_tok1': { id: 'g_tok1', isGroup: true, kicked: true, members: [ROSTER[0]], joinToken: 'tok1' } };
    const pjt = makePjt(store, { name: 'G', members: ROSTER, creatorId: 'peer87654321', admins: ['peer87654321'] });
    await pjt('tok1');
    const g = store['contacts:g_tok1'];
    expect(g.createdBy).toBe('peer87654321');
    expect(g.admins).toEqual(['peer87654321']);
  });

  it('a kicked record no longer satisfies the send/forward gate after rejoin', async () => {
    const store = { 'contacts:g_tok1': { id: 'g_tok1', isGroup: true, kicked: true, members: [ROSTER[0]], joinToken: 'tok1' } };
    const pjt = makePjt(store, { name: 'G', members: ROSTER, creatorId: 'peer87654321', admins: [] });
    await pjt('tok1');
    // The gate every send path applies: `contact.isGroup && contact.kicked` → blocked.
    const g = store['contacts:g_tok1'];
    expect(!!(g.isGroup && g.kicked)).toBe(false);
  });

  it('a fresh join (no existing record) is unaffected', async () => {
    const store = {};
    const calls = { added: [], open: [] };
    const pjt = makePjt(store, { name: 'G', members: ROSTER, creatorId: 'peer87654321', admins: [] }, calls);
    await pjt('tok1');
    const g = store['contacts:g_tok1'];
    expect(g).toBeTruthy();
    expect(g.isGroup).toBe(true);
    expect(g.kicked).toBeUndefined();
    expect(calls.open).toEqual(['g_tok1']);
  });

  it('source pins: the existing-branch clears kicked inside processJoinToken', () => {
    const block = extract(/  async function processJoinToken\(token\) \{[\s\S]*?\n  \}\n/);
    expect(block).toContain('delete existing.kicked');
  });
});
