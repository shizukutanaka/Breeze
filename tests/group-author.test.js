import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { groupAuthorTranscript, verifyGroupAuthor, createGroupAuthor, commitGroupAcceptance, readGroupAuthorRecord, forwardedGroupFields, GROUP_AUTHOR_CAP as CAP } from '../src/app/group-author.js';
import { negotiateGroup } from '../src/crypto/negotiate.js';

const vector = JSON.parse(readFileSync(new URL('./vectors/group-author-v1.json', import.meta.url), 'utf8'));
const b64 = bytes => Buffer.from(bytes).toString('base64');
const A = { id: 'AQEBAQEBAQEB', pubB64: b64(Buffer.alloc(32, 1)), name: 'Alice' };
const B = { id: 'AgICAgICAgIC', pubB64: b64(Buffer.alloc(32, 2)), name: 'Bob' };
const C = { id: 'AwMDAwMDAwMD', pubB64: b64(Buffer.alloc(32, 3)), name: 'Charlie' };
const keys = new Map();
for (const p of [A, B, C]) {
  const k = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  keys.set(p.id, k);
  p.sigPub = b64(await crypto.subtle.exportKey('raw', k.publicKey));
}
const payload = (c = 0, ep = 0) => JSON.stringify({ v: 5, g: true, ep, c, i: [1], d: [2] });

function setup({ supported = true } = {}) {
  const group = { id: 'g_test', isGroup: true, members: [A, B, C] };
  const stores = { contacts: new Map([group, A, B, C].map(c => [c.id, structuredClone(c)])), identity: new Map(), messages: new Map() };
  const get = vi.fn(async (s, k) => structuredClone(stores[s].get(k) ?? null));
  const put = vi.fn(async (s, v, k) => { stores[s].set(k || v.msgId || v.id, structuredClone(v)); return true; });
  const commit = vi.fn(async (rec, auth) => {
    if (auth.replay) await put('identity', auth.replay.value, auth.replay.key);
    if (auth.ratchet) await put('identity', auth.ratchet.value, auth.ratchet.key);
    if (rec) await put('messages', rec);
    return true;
  });
  const deps = { get, put, all: async s => [...stores[s].values()].map(v => structuredClone(v)), commit, supported: () => supported, negotiate: negotiateGroup, attributeDevice: async () => false, dbg: vi.fn(), distribute: vi.fn(async () => {}) };
  const instance = who => createGroupAuthor({ ...deps, pub: () => who.pubB64, sigPub: () => who.sigPub,
    sign: async bytes => new Uint8Array(await crypto.subtle.sign('Ed25519', keys.get(who.id).privateKey, bytes)) });
  const alice = instance(A), bob = instance(B), charlie = instance(C);
  const deliver = vi.fn(async auth => { await auth.commit({ msgId: 'message', text: 'hello', authorVerified: auth.verified }); });
  async function envelope(author = A, ct = payload()) {
    const p = JSON.parse(ct);
    const fields = { authorSigV: 1, authorSig: b64(await crypto.subtle.sign('Ed25519', keys.get(author.id).privateKey, groupAuthorTranscript(group.id, author.pubB64, p.ep, p.c, ct))) };
    return { from: author.id, fromPub: author.pubB64, groupId: group.id, payload: ct, isGroupSK: true, ...fields };
  }
  return { group, stores, deps, get, put, commit, instance, alice, bob, charlie, envelope, deliver };
}

describe('BreezeGroupAuthor/v1 byte contract', () => {
  it('matches the published binary and independent RFC8032-key signature vector', async () => {
    expect(Buffer.from(groupAuthorTranscript(vector.groupId, vector.author, vector.epoch, vector.counter, vector.payload)).toString('hex')).toBe(vector.transcriptHex);
    expect(await verifyGroupAuthor(vector.groupId, vector.author, vector.payload, 1, vector.authorSig, vector.sigPub)).toBe(true);
    const key = await crypto.subtle.importKey('pkcs8', Buffer.from('302e020100300506032b657004220420' + vector.seedHex, 'hex'), 'Ed25519', false, ['sign']);
    expect(b64(await crypto.subtle.sign('Ed25519', key, groupAuthorTranscript(vector.groupId, vector.author, vector.epoch, vector.counter, vector.payload)))).toBe(vector.authorSig);
  });
  it.each([-1, 1.5, NaN, Infinity, 0x100000000])('rejects invalid uint32 %s', n => {
    expect(() => groupAuthorTranscript('g', A.pubB64, n, 0, 'p')).toThrow();
    expect(() => groupAuthorTranscript('g', A.pubB64, 0, n, 'p')).toThrow();
  });
  it.each(['', 'g'.repeat(65), '海'.repeat(22), null, {}])('rejects malformed/oversized group %s', g => {
    expect(() => groupAuthorTranscript(g, A.pubB64, 0, 0, 'p')).toThrow();
  });
  it('validates payload/signature/key bounds before expensive verification', async () => {
    const spy = vi.spyOn(crypto.subtle, 'importKey');
    for (const [ct, sig, pin] of [[payload(), 'x'.repeat(100000), A.sigPub], ['x'.repeat(262145), vector.authorSig, A.sigPub], [payload(-1), vector.authorSig, A.sigPub], [payload(), vector.authorSig, 'bad']]) {
      expect(await verifyGroupAuthor('g', A.pubB64, ct, 1, sig, pin)).toBe(false);
    }
    expect(spy).not.toHaveBeenCalled(); spy.mockRestore();
  });
});

describe('pinned authors, strict negotiation and compatibility', () => {
  it.each(['pin', 'checkpoint', 'members'])('activates after a late %s without another capability or policy read', async input => {
    const h = setup(); let authorized = input !== 'checkpoint';
    h.deps.authorized = async () => authorized;
    const receiver = h.instance(B);
    await receiver.bindCapability(h.group.id, A.pubB64, await h.alice.capability(h.group.id));
    if (input === 'pin') h.stores.contacts.get(A.id).sigPub = undefined;
    if (input === 'members') h.stores.contacts.get(h.group.id).members.push({ pubB64: 'unknown' });
    await receiver.bindCapability(h.group.id, C.pubB64, await h.charlie.capability(h.group.id));
    expect(h.stores.identity.get('ga-policy:' + h.group.id).strict).not.toBe(true);
    if (input === 'pin') h.stores.contacts.get(A.id).sigPub = A.sigPub;
    if (input === 'members') h.stores.contacts.get(h.group.id).members.pop();
    authorized = true;
    await receiver.inputsChanged(input === 'checkpoint' ? 'identity' : 'contacts', 'verify:device-authority:' + C.pubB64);
    expect(h.stores.identity.get('ga-policy:' + h.group.id).strict).toBe(true);
  });
  it('rechecks inputs arriving during a scan and ignores unrelated writes', async () => {
    const h = setup(); let calls = 0;
    h.deps.all = vi.fn(async () => {
      if (++calls === 1) queueMicrotask(() => receiver.inputsChanged('identity', 'verify:device-consent:root:device'));
      return [];
    });
    const receiver = h.instance(B);
    await receiver.inputsChanged('messages', 'message');
    await receiver.inputsChanged('identity', 'sess:peer');
    expect(h.deps.all).not.toHaveBeenCalled();
    await receiver.inputsChanged('contacts', 'group');
    expect(h.deps.all).toHaveBeenCalledTimes(2);
  });
  it('recovers from input scan errors without enabling an incomplete policy', async () => {
    const h = setup(); h.deps.all = vi.fn().mockRejectedValueOnce(new Error('read failed')).mockResolvedValue([h.group]);
    const receiver = h.instance(B);
    await expect(receiver.inputsChanged('contacts', A.id)).rejects.toThrow('read failed');
    await receiver.inputsChanged('identity', 'ga-policy:' + h.group.id);
    expect(h.stores.identity.get('ga-policy:' + h.group.id)?.strict).not.toBe(true);
    expect(h.deps.all).toHaveBeenCalledTimes(2);
  });
  it('keeps mixed groups unsigned, but signs before a capable peer activates strict on the first distribution', async () => {
    const h = setup();
    expect(await h.alice.sign(h.group.id, payload())).toEqual({});
    await h.bob.receive({ from: A.id, groupId: h.group.id, payload: payload() }, {}, h.deliver);
    expect(h.stores.messages.get('message').authorVerified).toBe(false);
    for (const member of h.stores.contacts.get(h.group.id).members) member.caps = [CAP];
    const first = await h.alice.sign(h.group.id, payload());
    expect(first.authorSigV).toBe(1);
    expect((await h.alice.policy(h.group.id)).strict).not.toBe(true);
    await h.bob.bindCapability(h.group.id, A.pubB64, await h.alice.capability(h.group.id));
    await h.bob.bindCapability(h.group.id, C.pubB64, await h.charlie.capability(h.group.id));
    const fields = await h.alice.sign(h.group.id, payload());
    expect(fields.authorSigV).toBe(1);
    expect(await verifyGroupAuthor(h.group.id, A.pubB64, payload(), fields.authorSigV, fields.authorSig, A.sigPub)).toBe(true);
  });
  it('establishes missing pins only through a separate verified-prekey dependency before accepting a capability', async () => {
    const h = setup(); h.stores.contacts.get(A.id).sigPub = undefined;
    const proof = await h.alice.capability(h.group.id);
    await h.bob.bindCapability(h.group.id, A.pubB64, proof);
    expect(h.stores.identity.has('ga-policy:' + h.group.id)).toBe(false);
    h.deps.establishPin = vi.fn(async pub => { expect(pub).toBe(A.pubB64); h.stores.contacts.get(A.id).sigPub = A.sigPub; });
    const receiver = h.instance(B);
    await receiver.bindCapability(h.group.id, A.pubB64, proof);
    expect(h.deps.establishPin).toHaveBeenCalledOnce();
    expect(h.stores.identity.get('ga-policy:' + h.group.id).proofs[A.pubB64]).toBe(A.sigPub);
  });
  it.each(['group', 'author', 'ciphertext', 'counter', 'epoch', 'reserialization', 'signature', 'version'])('rejects altered %s before delivery', async what => {
    const h = setup(), msg = await h.envelope();
    if (what === 'group') { msg.groupId = 'g_other'; h.stores.contacts.set('g_other', { ...h.group, id: 'g_other' }); }
    if (what === 'author') { msg.from = C.id; msg.fromPub = C.pubB64; }
    if (what === 'ciphertext') msg.payload = msg.payload.replace('"d":[2]', '"d":[3]');
    if (what === 'counter') msg.payload = payload(1);
    if (what === 'epoch') msg.payload = payload(0, 1);
    if (what === 'reserialization') msg.payload = JSON.stringify(JSON.parse(msg.payload), null, 1);
    if (what === 'signature') msg.authorSig = b64(Buffer.alloc(64));
    if (what === 'version') msg.authorSigV = 2;
    await h.bob.receive(msg, {}, h.deliver);
    expect(h.deliver).not.toHaveBeenCalled(); expect(h.commit).not.toHaveBeenCalled();
  });
  it('never accepts a message key or an untrusted roster pin in place of a local contact pin', async () => {
    const h = setup(), msg = await h.envelope();
    h.stores.contacts.get(A.id).sigPub = C.sigPub;
    msg.sigPub = A.sigPub;
    h.group.members[0].sigPub = A.sigPub;
    await h.bob.receive(msg, {}, h.deliver);
    expect(h.deliver).not.toHaveBeenCalled();
    h.stores.contacts.delete(A.id);
    await h.bob.receive(msg, {}, h.deliver);
    expect(h.deliver).not.toHaveBeenCalled();
  });
  it('requires authenticated capability proof from every member, then persists strict across reload/roster changes', async () => {
    const h = setup();
    for (const m of h.group.members) m.caps = [CAP];
    expect((await h.bob.policy(h.group.id)).strict).not.toBe(true);
    await h.bob.bindCapability(h.group.id, A.pubB64, await h.alice.capability(h.group.id));
    expect((await h.bob.policy(h.group.id)).strict).not.toBe(true);
    await h.bob.bindCapability(h.group.id, C.pubB64, await h.charlie.capability(h.group.id));
    expect((await h.bob.policy(h.group.id)).strict).toBe(true);
    h.stores.contacts.get(h.group.id).members.push({ id: 'legacy', pubB64: 'legacy' });
    const reloaded = h.instance(B), msg = await h.envelope(); delete msg.authorSig; delete msg.authorSigV;
    await reloaded.receive(msg, {}, h.deliver);
    expect((await reloaded.policy(h.group.id)).strict).toBe(true);
    expect(h.deliver).not.toHaveBeenCalled();
  });
  it('does not trust capability proofs signed by another member or borrowed from another group', async () => {
    const h = setup();
    h.stores.contacts.set('other', { ...h.group, id: 'other' });
    await h.bob.bindCapability(h.group.id, A.pubB64, await h.charlie.capability(h.group.id));
    await h.bob.bindCapability(h.group.id, A.pubB64, await h.alice.capability('other'));
    await h.bob.bindCapability(h.group.id, A.pubB64, { ...await h.alice.capability(h.group.id), authorCaps: CAP });
    expect(h.stores.identity.has('ga-policy:' + h.group.id)).toBe(false);
  });
  it('checks distribution when a different tab activated a strict sender epoch', async () => {
    const h = setup();
    h.deps.redistributionNeeded = vi.fn(async () => true);
    const sender = h.instance(B), key = { epoch: 4, authorSigV: 1 };
    h.deps.distribute.mockRejectedValueOnce(new Error('distribution failed'));
    await expect(sender.ensureDistributed(h.group.id, key)).rejects.toThrow('distribution failed');
    await sender.ensureDistributed(h.group.id, key);
    expect(h.deps.distribute).toHaveBeenCalledTimes(2);
    expect(h.deps.redistributionNeeded).toHaveBeenCalledWith(h.group.id, 4);
    h.deps.redistributionNeeded.mockResolvedValue(false);
    await sender.ensureDistributed(h.group.id, key);
    expect(h.deps.distribute).toHaveBeenCalledTimes(2);
  });
  it('rotates fresh sender material once before strict use, with durable epoch and redistribution', async () => {
    const h = setup(); h.stores.identity.set('ga-policy:' + h.group.id, { strict: true });
    const old = { v: 5, epoch: 4, chainKey: Array(32).fill(1), counter: 10 };
    const key = await h.bob.prepareKey(h.group.id, old);
    expect(key).toMatchObject({ epoch: 5, counter: 0, authorSigV: 1 });
    expect(key.chainKey).not.toEqual(old.chainKey);
    expect(await h.bob.prepareKey(h.group.id, key)).toEqual(key);
    await h.bob.ensureDistributed(h.group.id); await h.bob.ensureDistributed(h.group.id);
    expect(h.deps.distribute).toHaveBeenCalledOnce();
  });
  it('accepts unsigned legacy with explicit unverified status; no signing runtime cannot send in strict mode', async () => {
    const h = setup({ supported: false }), msg = { from: A.id, groupId: h.group.id, payload: payload() };
    expect(await h.bob.sign(h.group.id, msg.payload)).toEqual({});
    await h.bob.receive(msg, {}, h.deliver);
    expect(h.stores.messages.get('message').authorVerified).toBe(false);
    h.stores.identity.set('ga-policy:' + h.group.id, { strict: true });
    await expect(h.bob.sign(h.group.id, msg.payload)).rejects.toThrow('strict');
    h.deliver.mockClear(); await h.bob.receive(msg, {}, h.deliver); expect(h.deliver).not.toHaveBeenCalled();
  });
  it('fails closed on policy read failure and failed persistence', async () => {
    const h = setup();
    h.get.mockRejectedValue(new Error('read failed'));
    await h.bob.receive({ from: A.id, groupId: h.group.id, payload: payload() }, {}, h.deliver);
    expect(h.deliver).not.toHaveBeenCalled();
    await expect(h.bob.policy(h.group.id)).rejects.toThrow('read failed');
    const clean = setup(); clean.put.mockResolvedValue(false);
    clean.stores.identity.set('ga-policy:' + clean.group.id, { strict: true });
    await expect(clean.bob.prepareKey(clean.group.id, { v: 5, epoch: 0 })).rejects.toThrow('persistence');
  });
});

describe('bounded durable replay acceptance', () => {
  it('serializes direct/relay races and acknowledges only a previously durably accepted tuple', async () => {
    const h = setup(), msg = await h.envelope(), acks = [{}, {}];
    await Promise.all([h.bob.receive(msg, acks[0], h.deliver), h.bob.receive({ ...msg, ts: 999 }, acks[1], h.deliver)]);
    expect(h.deliver).toHaveBeenCalledOnce(); expect(acks.some(ack => ack.stored)).toBe(true);
    h.deliver.mockClear(); await h.instance(B).receive(msg, {}, h.deliver); expect(h.deliver).not.toHaveBeenCalled();
    const changed = await h.envelope(A, payload().replace('"d":[2]', '"d":[3]')), ack = {};
    await h.bob.receive(changed, ack, h.deliver);
    expect(h.deliver).not.toHaveBeenCalled(); expect(ack.stored).not.toBe(true);
  });
  it('does not burn replay state on failed decryption or failed durable acceptance', async () => {
    const h = setup(), msg = await h.envelope();
    await h.bob.receive(msg, {}, async () => null);
    expect(h.stores.identity.size).toBe(0);
    h.commit.mockRejectedValueOnce(new Error('quota exceeded'));
    await h.bob.receive(msg, {}, h.deliver);
    expect(h.stores.identity.size).toBe(0);
    await h.bob.receive(msg, {}, h.deliver);
    expect(h.stores.messages.get('message').authorVerified).toBe(true);
  });
  it('accepts out of order, bounds the window, and rejects old epochs/counters', async () => {
    const h = setup();
    for (const c of [1025, 1024, 2, 1]) await h.bob.receive(await h.envelope(A, payload(c)), {}, h.deliver);
    expect(h.deliver).toHaveBeenCalledTimes(3);
    const replay = h.stores.identity.get('ga-replay:' + h.group.id + ':' + A.pubB64);
    expect(replay.seen).toEqual([1025, 1024, 2]);
    await h.bob.receive(await h.envelope(A, payload(0, 1)), {}, h.deliver);
    await h.bob.receive(await h.envelope(A, payload(1026)), {}, h.deliver);
    expect(h.deliver).toHaveBeenCalledTimes(4);
  });
  it('forwards enclosed authors and signature fields, not the forwarding peer name/key', async () => {
    const h = setup(), msg = await h.envelope();
    const forwarded = { from: msg.from, payload: msg.payload, ...forwardedGroupFields(msg), sigPub: C.sigPub, fromName: 'Charlie' };
    await h.bob.receive(forwarded, {}, h.deliver); expect(h.deliver).toHaveBeenCalledOnce();
    expect(forwardedGroupFields({ ...msg, sigPub: C.sigPub })).not.toHaveProperty('sigPub');
  });
});

function database() {
  const records = { identity: new Map(), messages: new Map() };
  const db = { records, fail: false, transaction() {
    const staged = structuredClone(records), queue = []; let aborted = false;
    const tx = { error: null, abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); }, objectStore: store => ({
      get(key) { const req = {}; queue.push(() => { req.result = structuredClone(records[store].get(key)); req.onsuccess?.(); }); return req; },
      put(value, key) { if (db.fail) { tx.error = new Error('QuotaExceededError'); tx.abort(); return; } staged[store].set(key || value.msgId, structuredClone(value)); },
    }) };
    queueMicrotask(() => { while (queue.length && !aborted) queue.shift()(); if (!aborted) { Object.assign(records, staged); tx.oncomplete?.(); } });
    return tx;
  } };
  return db;
}
describe('real acceptance transaction', () => {
  const auth = () => ({ counter: 0, replay: { key: 'replay', value: { epoch: 0, high: 0, seen: [0], ids: { 0: 'message' } } }, ratchet: { key: 'sk', expected: undefined, value: { counter: 1 } } });
  it('commits message + ratchet + replay together and rejects a second transaction consuming the same counter', async () => {
    const db = database();
    await expect(commitGroupAcceptance(db, { msgId: 'message' }, auth())).resolves.toBe(true);
    expect(db.records.messages.size).toBe(1); expect(db.records.identity.size).toBe(2);
    await expect(commitGroupAcceptance(db, { msgId: 'duplicate' }, auth())).rejects.toThrow();
    expect(db.records.messages.size).toBe(1);
    expect(await readGroupAuthorRecord(db, 'identity', 'sk')).toEqual({ counter: 1 });
  });
  it('rolls every write back on storage failure or a changed ratchet snapshot', async () => {
    const db = database(); db.fail = true;
    await expect(commitGroupAcceptance(db, { msgId: 'message' }, auth())).rejects.toThrow();
    expect(db.records.messages.size + db.records.identity.size).toBe(0);
    db.fail = false; db.records.identity.set('sk', { counter: 2 });
    await expect(commitGroupAcceptance(db, { msgId: 'message' }, auth())).rejects.toThrow();
    expect(db.records.identity.get('sk')).toEqual({ counter: 2 }); expect(db.records.messages.size).toBe(0);
  });
});
