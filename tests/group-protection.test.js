import { describe, it, expect, vi } from 'vitest';
import { createGroupProtection } from '../src/app/group-protection.js';
import { createGroupAuthor } from '../src/app/group-author.js';
import { negotiateGroup } from '../src/crypto/negotiate.js';
import { createGroupCreate } from '../src/app/group-create.js';

const CAP = 'group-author-sig-v1', gid = 'g_protection';
const people = await Promise.all([1, 2, 3].map(async n => {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const pubB64 = Buffer.alloc(32, n).toString('base64');
  return { id: pubB64.slice(0, 12), pubB64, name: 'Member ' + n, caps: [CAP], sigPub: Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('base64'), keys };
}));
const [A, B, C] = people;
const member = p => ({ id: p.id, pubB64: p.pubB64, name: p.name, caps: p.caps });
const initial = [A, B].map(member), legacy = [...initial, { ...member(C), caps: [] }];

function harness(me = A) {
  const stores = { identity: new Map(), contacts: new Map(people.map(p => [p.id, { ...member(p), sigPub: p.sigPub }])) };
  const D = {
    pub: () => me.pubB64, ed: () => me.sigPub,
    sign: async bytes => Buffer.from(await crypto.subtle.sign('Ed25519', me.keys.privateKey, bytes)).toString('base64'),
    get: async (s, k) => structuredClone(stores[s]?.get(k)),
    put: vi.fn(async (s, v, k) => { stores[s].set(k || v.id, structuredClone(v)); return true; }),
    confirm: vi.fn(async () => true), broadcast: vi.fn(async () => {}), t: (key, ...args) => key + args.join(' '),
    verified: vi.fn(async () => ({ verified: true })), dbg: vi.fn(),
  };
  const make = () => createGroupProtection(D), gp = make();
  const group = members => ({ id: gid, name: 'Test', isGroup: true, members: structuredClone(members) });
  const setGroup = (members = initial) => stores.contacts.set(gid, group(members));
  const strict = () => stores.identity.set('ga-policy:' + gid, { strict: true, proofs: {} });
  const record = () => stores.identity.get('verify:group-protection:' + gid);
  const ga = createGroupAuthor({ get: D.get, put: D.put, pub: D.pub, sigPub: D.ed, supported: () => true, negotiate: negotiateGroup, protection: gp.guard, legacyFormat: gp.legacyFormat, dbg: D.dbg });
  return { D, gp, ga, stores, setGroup, strict, record, make, group };
}
async function anchored() {
  const a = harness(), b = harness(B);
  a.setGroup(); a.strict();
  const invite = await a.gp.invitation({ type: 'group_invite', groupId: gid, name: 'Test', members: initial });
  expect(await b.gp.invited(invite, A.pubB64)).toBe(true);
  b.setGroup(); b.strict();
  return { a, b, invite };
}

describe('authenticated group protection', () => {
  it('a local creator explicitly confirms its own authenticated signing key, with cancel as the default', async () => {
    const h = harness(); h.setGroup(); h.strict(); h.stores.contacts.get(gid).createdBy = A.id;
    h.D.confirm.mockResolvedValue(false);
    expect(await h.gp.anchorSelf(gid)).toBe(false); expect(h.record()).toBeUndefined();
    expect(h.D.confirm.mock.calls[0][1].defaultCancel).toBe(true);
    h.D.confirm.mockResolvedValue(true);
    expect(await h.gp.anchorSelf(gid)).toBe(true);
    expect(h.record().anchor).toEqual({ pub: A.pubB64, ed: A.sigPub, source: 'local-creator' });
    expect(h.D.verified).not.toHaveBeenCalled();
    expect(await h.gp.admit(h.group(initial), legacy)).toBe(true);
  });
  it('non-creators, relay roles and mismatched local signing keys cannot self-anchor', async () => {
    const h = harness(); h.setGroup(); const g = h.stores.contacts.get(gid);
    for (const fields of [{ createdBy: B.id }, { creatorId: A.id, admins: [A.id] }, { creator: A.pubB64 }]) {
      delete g.createdBy; Object.assign(g, fields);
      await expect(h.gp.anchorSelf(gid)).rejects.toThrow('local group creation required');
    }
    expect(h.D.confirm).not.toHaveBeenCalled();
    g.createdBy = A.id; h.D.ed = () => B.sigPub;
    await expect(h.gp.anchorSelf(gid)).rejects.toThrow('signing identity unavailable');
    expect(h.record()).toBeUndefined();
  });
  it('relay-supplied creator fields are discarded at join ingress and cannot authorize a self-anchor', async () => {
    const h = harness();
    const token = 'protection';
    const deps = { hasApi: () => true, groupV5: () => false, authorCaps: () => [], myId: () => A.id, myPubB64: () => A.pubB64, myName: () => A.name,
      postAPIRaw: async () => ({ ok: true, json: async () => ({ name: 'Relay', members: initial, createdBy: A.id, creatorId: A.id, admins: [A.id] }) }),
      dbGet: h.D.get, dbPut: h.D.put, renderContacts: async () => {}, openConversation: () => {}, cleanUrl: () => {}, pushInterval: () => {},
      minMs: () => 60000, dbg: h.D.dbg, showToast: vi.fn(), t: h.D.t };
    vi.useFakeTimers();
    try { await createGroupCreate(deps).processJoinToken(token); } finally { vi.clearAllTimers(); vi.useRealTimers(); }
    expect(h.D.dbg).not.toHaveBeenCalled(); expect(deps.showToast).not.toHaveBeenCalled();
    expect(h.stores.contacts.get(gid).createdBy).toBeUndefined();
    await expect(h.gp.anchorSelf(gid)).rejects.toThrow('local group creation required');
  });
  it('a local creator change during confirmation cannot establish an anchor', async () => {
    const h = harness(); h.setGroup(); h.stores.contacts.get(gid).createdBy = A.id;
    h.D.confirm.mockImplementation(async () => { h.stores.contacts.get(gid).createdBy = B.id; return true; });
    await expect(h.gp.anchorSelf(gid)).rejects.toThrow('changed during confirmation');
    expect(h.record()).toBeUndefined();
  });
  it('signs creator invitations, authenticates the sender and refuses relay role bootstrapping', async () => {
    const { a, invite } = await anchored();
    const b = harness(B);
    expect(await b.gp.invited(invite, C.pubB64)).toBe(false);
    expect(await b.gp.invited({ ...invite, name: 'tampered' }, A.pubB64)).toBe(false);
    b.setGroup(); b.strict();
    expect(await b.gp.invited(invite, A.pubB64)).toBe(false);
    b.stores.contacts.set(gid, { ...b.group(initial), createdBy: A.id, admins: [A.id] });
    expect(await b.gp.admit(b.group(initial), legacy)).toBe(false);
    expect((await b.ga.policy(gid)).strict).toBe(true);
    expect(a.record().anchor.source).toBe('invitation');
  });
  it('accepts creator-signed invitations from an explicit fresh join link, not a different group', async () => {
    const { invite } = await anchored(); const b = harness(B); b.setGroup();
    await expect(b.gp.acceptLink('g_other', JSON.stringify(invite))).rejects.toThrow();
    await b.gp.acceptLink(gid, JSON.stringify(invite));
    expect(b.record().anchor.pub).toBe(A.pubB64);
  });
  it('cancel is explicit/default, persists rejection and leaves the roster and strict floor unchanged', async () => {
    const { a } = await anchored(); a.D.confirm.mockResolvedValue(false);
    expect(await a.gp.admit(a.group(initial), legacy)).toBe(false);
    expect(a.D.confirm.mock.calls[0][1]).toMatchObject({ defaultCancel: true, danger: true });
    expect(a.stores.contacts.get(gid).members).toEqual(initial);
    expect(a.D.broadcast).not.toHaveBeenCalled();
    expect((await a.ga.policy(gid)).strict).toBe(true);
    expect(await a.make().admit(a.group(initial), legacy)).toBe(false);
    expect(a.D.confirm).toHaveBeenCalledTimes(1);
    expect(await a.gp.admit(a.group(initial), legacy, true)).toBe(false);
    expect(a.D.confirm).toHaveBeenCalledTimes(2);
  });
  it('confirm authorizes one signed roster and persistent drop/restore notices at every upgraded member', async () => {
    const { a, b } = await anchored();
    expect(await a.gp.admit(a.group(initial), legacy)).toBe(true);
    const control = a.D.broadcast.mock.calls[0][0];
    expect(await b.gp.receive(JSON.stringify(control))).toBe(true);
    for (const h of [a, b]) {
      expect((await h.ga.policy(gid)).strict).toBe(false);
      expect(await h.make().guard(gid, { strict: true })).toBe(false);
      expect(h.record().events.map(e => e.mode)).toEqual(['legacy']);
      expect(h.stores.identity.get('ga-policy:' + gid).strict).toBe(true);
    }
    await a.gp.admit(a.group(legacy), initial);
    await b.gp.receive(JSON.stringify(a.D.broadcast.mock.calls[1][0]));
    for (const h of [a, b]) {
      expect((await h.ga.policy(gid)).strict).toBe(true);
      expect(h.record().events.map(e => e.mode)).toEqual(['legacy', 'strict']);
    }
    await b.gp.receive(JSON.stringify(control));
    expect((await b.ga.policy(gid)).strict).toBe(true);
  });
  it('rejects forged signatures, changed rosters, roles and signing pins', async () => {
    const { a, b } = await anchored(); await a.gp.admit(a.group(initial), legacy);
    const control = a.D.broadcast.mock.calls[0][0];
    for (const forged of [
      { ...control, sig: Buffer.alloc(64).toString('base64') },
      { ...control, members: [...legacy, { ...member(A), id: 'forged' }] },
      { ...control, admin: C.pubB64, ed: C.sigPub },
      { ...control, groupId: 'g_other' },
    ]) {
      try { await b.gp.receive(JSON.stringify(forged)); } catch { /* malformed frames fail closed */ }
      expect((await b.ga.policy(gid)).strict).toBe(true);
      expect(b.record().seq).toBeUndefined();
    }
    b.stores.contacts.get(A.id).sigPub = C.sigPub;
    await b.gp.receive(JSON.stringify(control));
    expect((await b.ga.policy(gid)).strict).toBe(true);
  });
  it('unauthenticated roster changes never broaden an already approved exception', async () => {
    const { a, b } = await anchored(); await a.gp.admit(a.group(initial), legacy);
    await b.gp.receive(JSON.stringify(a.D.broadcast.mock.calls[0][0]));
    b.stores.contacts.get(gid).members = [...legacy, { ...member(C), pubB64: A.pubB64, id: A.id }];
    await expect(b.ga.policy(gid)).rejects.toThrow();
    b.stores.contacts.get(gid).members = initial;
    expect((await b.ga.policy(gid)).strict).toBe(true);
  });
  it('fresh authenticated capability proof tightens protection and persists the restoration notice', async () => {
    const { a } = await anchored(); await a.gp.admit(a.group(initial), legacy);
    await a.gp.proof(gid, B.pubB64);
    expect((await a.ga.policy(gid)).strict).toBe(false);
    await a.gp.proof(gid, C.pubB64);
    expect((await a.ga.policy(gid)).strict).toBe(true);
    expect(a.record().events.map(e => e.mode)).toEqual(['legacy', 'strict']);
    await a.gp.proof(gid, C.pubB64);
    expect(a.record().events).toHaveLength(2);
  });
  it('unsigned admission stays closed for relay-injected members, opens only for approval and closes on restoration', async () => {
    const { a, b } = await anchored(), deliver = vi.fn();
    const msg = { groupId: gid, from: C.id, fromPub: C.pubB64, payload: '{}' };
    b.setGroup(legacy);
    await b.ga.receive(msg, {}, deliver); expect(deliver).not.toHaveBeenCalled();
    await a.gp.admit(a.group(initial), legacy);
    await b.gp.receive(JSON.stringify(a.D.broadcast.mock.calls[0][0]));
    await b.ga.receive(msg, {}, deliver); expect(deliver).toHaveBeenCalledTimes(1);
    await b.gp.proof(gid, C.pubB64);
    await b.ga.receive(msg, {}, deliver); expect(deliver).toHaveBeenCalledTimes(1);
  });
  it('an approved pre-v5 member gets fresh v3 material, not an incompatible frozen v5 chain', async () => {
    const { a } = await anchored();
    const prior = { v: 5, epoch: 7, counter: 9, chainKey: Array(32).fill(3), authorSigV: 1 };
    expect(await a.gp.legacyFormat(gid)).toBe(false);
    await a.gp.admit(a.group(initial), legacy);
    expect(await a.gp.legacyFormat(gid)).toBe(true);
    const next = await a.ga.prepareKey(gid, prior);
    expect(next).toMatchObject({ epoch: 8, counter: 0, raw: expect.any(Array) });
    expect(next.raw).toHaveLength(32); expect(next.v).toBeUndefined(); expect(next.chainKey).toBeUndefined();
    expect(await a.ga.prepareKey(gid, next)).toEqual(next);
    await expect(a.ga.prepareKey(gid, { ...prior, epoch: 0xFFFFFFFF })).rejects.toThrow('rotation unavailable');
  });
  it('existing groups require verified contact plus explicit confirmation and recheck keys after the dialog', async () => {
    const b = harness(B); b.setGroup(); b.strict();
    b.D.verified.mockResolvedValue({ verified: false });
    await expect(b.gp.anchor(b.group(initial), A)).rejects.toThrow('verified');
    b.D.verified.mockResolvedValue({ verified: true }); b.D.confirm.mockResolvedValue(false);
    expect(await b.gp.anchor(b.group(initial), A)).toBe(false);
    b.D.confirm.mockImplementation(async () => { b.stores.contacts.get(A.id).sigPub = C.sigPub; return true; });
    await expect(b.gp.anchor(b.group(initial), A)).rejects.toThrow('changed');
    expect(b.record()).toBeUndefined();
    b.stores.contacts.get(A.id).sigPub = A.sigPub; b.D.confirm.mockResolvedValue(true);
    expect(await b.gp.anchor(b.group(initial), A)).toBe(true);
    expect(b.record().anchor).toEqual({ pub: A.pubB64, ed: A.sigPub, source: 'verified-contact' });
  });
  it('legacy groups and unsigned legacy invitations keep working without activating a strict exception', async () => {
    const h = harness(); h.setGroup();
    expect(await h.gp.invited({ type: 'group_invite', groupId: gid }, B.pubB64)).toBe(true);
    expect(await h.gp.admit(h.group(initial), legacy)).toBe(true);
    expect(h.D.confirm).not.toHaveBeenCalled();
    expect(await h.gp.guard(gid, {})).toBeNull();
    expect(await h.gp.receive('{"type":"profile"}')).toBe(false);
    expect(await h.gp.receive('not JSON')).toBe(false);
    h.D.ed = () => null;
    const invite = { type: 'group_invite', groupId: gid, members: initial };
    expect(await h.gp.invitation(invite)).toBe(invite);
    expect(h.record()).toBeUndefined();
  });
  it('empty rosters, failed writes and failed signing cannot authorize a downgrade', async () => {
    const { a } = await anchored();
    await expect(a.gp.admit(a.group(initial), [])).rejects.toThrow('roster');
    a.D.put.mockResolvedValue(false);
    await expect(a.gp.admit(a.group(initial), legacy)).rejects.toThrow('persistence');
    expect((await a.ga.policy(gid)).strict).toBe(true);
    a.D.put.mockImplementation(async (s, v, k) => { a.stores[s].set(k || v.id, structuredClone(v)); return true; });
    a.D.sign = async () => { throw new Error('signing unavailable'); };
    await expect(a.gp.admit(a.group(initial), legacy)).rejects.toThrow('signing unavailable');
    expect((await a.ga.policy(gid)).strict).toBe(true);
  });
});
