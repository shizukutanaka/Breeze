import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { padBucketSize } from '../src/crypto/ratchet.js';
import { createGroupAuthor, groupAuthorTranscript, forwardedGroupFields } from '../src/app/group-author.js';
import { negotiateGroup } from '../src/crypto/negotiate.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function slice(start, end) {
  const s = html.indexOf(start), e = html.indexOf(end, s);
  if (s < 0 || e < 0) throw new Error(`Missing inline markers: ${start} / ${end}`);
  return html.slice(s, e);
}
function compile(source, deps) {
  return new Function(...Object.keys(deps), source)(...Object.values(deps));
}
function person(byte, name) {
  const pubB64 = Buffer.alloc(32, byte).toString('base64');
  return { id: pubB64.slice(0, 12), pubB64, name };
}
const A = person(1, 'Alice (local)'), B = person(2, 'Bob'), C = person(3, 'Charlie (local)');
const signing = new Map();
for (const p of [A, B, C]) {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  p.sigPub = Buffer.from(await crypto.subtle.exportKey('raw', keys.publicKey)).toString('base64');
  signing.set(p.id, keys);
}
const incomingSource = slice('async function handleIncoming(msg, ackOut) {', '// ===== P2P connection per contact =====');
const dcSource = slice('ch.onmessage = async (e) => {', '\n    }\n\n    // Connection open → deliver peer relay queue');
const cryptoSource = slice('async function hkdf(ikm, salt, info, length) {', '// I17 message franking.');
const groupSource = slice('async function encryptGroupMsg(groupId, text) {', '// Distribute sender key to a specific group member');
globalThis.__breezeGroupAuthor = { forwardedGroupFields };

// Bob receives; Alice and Charlie each have Sender Keys distributed to all members.
// Run the deployed encrypt/decrypt + receive functions, not the reference group.js
// (which contains a different, reference-only two-layer signature protocol).
function harness({ version = 5, members = [A, B, C], localC = true, strict = false } = {}) {
  const group = { id: 'group-abc', name: 'Local group', isGroup: true,
    members: members.map(m => ({ ...m, name: m === C ? 'Charlie (roster)' : m.name })) };
  const contacts = new Map([group, A, B, ...(localC ? [C] : [])].map(c => [c.id, structuredClone(c)]));
  const messages = new Map(), identity = new Map(), sendKeys = new Map(), cReceivedKeys = new Map();
  if (strict) identity.set('ga-policy:' + group.id, { strict: true, proofs: {} });
  const signed = new Map();
  for (const member of [A, C]) {
    const bytes = Array.from(crypto.getRandomValues(new Uint8Array(32)));
    const key = version === 5 ? { v: 5, chainKey: bytes, counter: 0, epoch: 0, skipped: {} }
      : { raw: bytes, counter: 0, epoch: 0 };
    sendKeys.set(member.id, key);
    identity.set(`gsk-peer:${group.id}:${member.id}`, structuredClone(key));
    cReceivedKeys.set(member.id, structuredClone(key));
  }
  const _dbg = vi.fn(), _replayCache = new Set(), ch = { send: vi.fn() };
  const dbGet = vi.fn(async (store, key) => structuredClone(
    (store === 'contacts' ? contacts : store === 'messages' ? messages : identity).get(key) ?? null));
  const dbPut = async (store, value, key) => {
    (store === 'contacts' ? contacts : store === 'messages' ? messages : identity)
      .set(key ?? (store === 'contacts' ? value.id : value.msgId), structuredClone(value));
    return true;
  };
  const CONFIG = { GROUP_RATCHET_V5: true, HKDF_HASH: 'SHA-256', IV_BYTES: 12,
    MSG_PAD_BOUNDARY: 256, GROUP_MAX_SKIP: 100 };
  const MS = { SEC: 1000, MIN: 60000, WEEK: 604800000 };
  const cryptoDeps = compile(`${cryptoSource} return { hkdf, _keyCommit, _cmOk };`, {
    CONFIG, _dbg, arr: a => Array.from(a), u8: a => new Uint8Array(a),
    timingSafeEqual: async (a, b) => a === b,
  });
  const makeCrypto = getGroupSenderKey => compile(`${groupSource} return { encryptGroupMsg, decryptGroupMsg };`, {
    ...cryptoDeps, CONFIG, MS, _dbg, dbGet, dbPut,
    arr: a => Array.from(a), u8: a => new Uint8Array(a),
    getGroupSenderKey, _padBucketSize: padBucketSize, // D02: encryptGroupMsg resolves the bucket helper as a free variable
    _groupAuthor: { withSend: (_gid, work) => work(), ensureDistributed: async () => {} },
  });
  const crypt = makeCrypto(async id => sendKeys.get(id));
  const charlie = makeCrypto(async id => cReceivedKeys.get(id));
  const decryptGroupMsg = vi.fn(crypt.decryptGroupMsg);
  const decryptFrom = vi.fn(async (payload, pub) => payload === `legacy:${pub}` ? 'legacy hello' : null);
  const notifications = Object.assign(vi.fn(), { permission: 'granted' });
  const broadcastToTabs = vi.fn();
  const _groupAuthor = createGroupAuthor({ get: dbGet, put: dbPut, pub: () => B.pubB64, sigPub: () => B.sigPub,
    supported: () => true, negotiate: negotiateGroup, dbg: _dbg, attributeDevice: async () => false,
    commit: async (record, auth) => {
      if (record) await dbPut('messages', record);
      if (auth.ratchet) await dbPut('identity', auth.ratchet.value, auth.ratchet.key);
      if (auth.replay) await dbPut('identity', auth.replay.value, auth.replay.key);
      return true;
    } });
  const deps = { dbGet, dbPut, dbGetAll: async () => [...contacts.values()], _replayCache,
    decryptGroupMsg, decryptFrom, _dbg, MS, activeContact: null, myName: B.name, myAlias: 'bob',
    _shouldAlert: () => true, playNotif: vi.fn(), Notification: notifications,
    appendMsg: vi.fn(), showSmartReplies: vi.fn(), _renderContactsThrottled: vi.fn(),
    broadcastToTabs, t: k => k, _myOtherDevices: async () => [], _focusActive: () => false,
    _attribDevCache: new Map(), safeMsgId: s => s, _groupAuthor,
    document: { querySelector: () => null },
  };
  const handleIncoming = compile(`${incomingSource} return handleIncoming;`, deps);
  function dc(peer = C, receive = handleIncoming) {
    return compile(`${dcSource} return ch.onmessage;`, { ...deps, contact: peer, ch,
      handleIncoming: receive, handleHeartbeat: () => false, _offlinePairing: null });
  }
  function relay(sender, payload, extra = {}) {
    return { from: sender.id, fromPub: sender.pubB64, fromName: 'Alice (forged)', ...signed.get(payload),
      payload, groupId: group.id, groupName: 'Forged group', isGroupSK: true, ts: 123, ...extra };
  }
  function frame(sender, payload, extra = {}) {
    return { type: 'group_msg', sender: sender.pubB64, name: 'Alice (forged)', payload, ...signed.get(payload),
      groupId: group.id, groupName: 'Forged group', isGroupSK: true, ts: 123,
      msgId: 'untrusted:id', ...extra };
  }
  async function encryptAs(sender, claimed, text, cryptoInstance) {
    const payload = await cryptoInstance.encryptGroupMsg(claimed.id, text);
    const p = JSON.parse(payload);
    const sig = await crypto.subtle.sign('Ed25519', signing.get(sender.id).privateKey, groupAuthorTranscript(group.id, claimed.pubB64, p.ep, p.c, payload));
    signed.set(payload, { authorSigV: 1, authorSig: Buffer.from(sig).toString('base64') });
    return payload;
  }
  return { group, contacts, messages, identity, dbGet, _replayCache, _dbg, ch, signed,
    decryptGroupMsg, decryptFrom, notifications, broadcastToTabs, handleIncoming, dc, relay, frame,
    encrypt: (sender, text = 'hello @Bob') => encryptAs(sender, sender, text, crypt),
    forgeAsC: (claimed, text = 'hello @Bob') => encryptAs(C, claimed, text, charlie) };
}
const deliverDC = (receive, frame) => receive({ data: JSON.stringify(frame) });

describe.each([3, 5])('deployed group sender binding (Sender Key v%i)', version => {
  it('drops C claiming A over C’s DC before dedup, decrypt or ACK; then accepts real A', async () => {
    const h = harness({ version });
    const payload = await h.forgeAsC(A);
    await deliverDC(h.dc(C), h.frame(A, payload, { msgId: `${A.id}:123` }));
    expect(h.messages.size).toBe(0);
    expect(h._replayCache.size).toBe(0);
    expect(h.decryptGroupMsg).not.toHaveBeenCalled();
    expect(h.dbGet).not.toHaveBeenCalled();
    expect(h.ch.send).not.toHaveBeenCalled();
    await deliverDC(h.dc(A), h.frame(A, await h.encrypt(A)));
    expect(h.messages.get(`${A.id}:123`)).toMatchObject({ text: 'hello @Bob', senderName: A.name });
    expect(h.ch.send).toHaveBeenCalledOnce();
  });

  it.each([A, C])('accepts legitimate $name DC delivery with local attribution and canonical id', async sender => {
    const h = harness({ version });
    await deliverDC(h.dc(sender), h.frame(sender, await h.encrypt(sender)));
    expect(h.messages.get(`${sender.id}:123`)).toMatchObject({ senderName: sender.name, contactId: h.group.id });
    expect(h.messages.has('untrusted:id')).toBe(false);
    expect(h.contacts.get(h.group.id).lastMsgSender).toBe(sender.name);
    expect(h.notifications).toHaveBeenCalledWith(h.group.name, expect.objectContaining({ body: `@${sender.name}: hello @Bob` }));
    expect(h.broadcastToTabs).toHaveBeenCalledWith('new-message', expect.objectContaining({ senderName: sender.name }));
    expect(h.ch.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ack', i: '123', st: 0 }));
  });

  it.each([A, C])('accepts legitimate $name relay delivery but ignores the supplied name', async sender => {
    const h = harness({ version });
    await h.handleIncoming(h.relay(sender, await h.encrypt(sender)));
    expect(h.messages.get(`${sender.id}:123`)).toMatchObject({ senderName: sender.name, text: 'hello @Bob' });
  });

  it('drops inconsistent relay sender/pub claims, even with a valid shared A ciphertext', async () => {
    const h = harness({ version });
    await h.handleIncoming(h.relay(C, await h.forgeAsC(A), { from: A.id }));
    expect(h.decryptGroupMsg).not.toHaveBeenCalled();
    expect(h.decryptFrom).not.toHaveBeenCalled();
    expect(h.messages.size).toBe(0);
  });

  it.each(['dc', 'relay'])('rejects a non-member with retained Sender-Key material on %s before any decryption', async route => {
    const h = harness({ version, members: [A, B] });
    const payload = await h.encrypt(C), ack = {};
    if (route === 'dc') await deliverDC(h.dc(C), h.frame(C, payload));
    else await h.handleIncoming(h.relay(C, payload), ack);
    expect(h.decryptGroupMsg).not.toHaveBeenCalled();
    expect(h.decryptFrom).not.toHaveBeenCalled();
    expect(h.messages.size).toBe(0);
    expect(h.ch.send).not.toHaveBeenCalled();
    expect(ack.stored).toBeUndefined();
  });

  it('rejects C forging A over the relay despite knowing A’s Sender Key, then accepts A and C controls', async () => {
    const h = harness({ version, strict: true });
    const forged = await h.forgeAsC(A, 'C authored this');
    await h.handleIncoming(h.relay(A, forged, { authorSigV: undefined, authorSig: undefined }));
    expect(h.messages.size).toBe(0);
    await h.handleIncoming(h.relay(A, await h.forgeAsC(A, 'C authored this')));
    expect(h.messages.size).toBe(0);
    expect(h.decryptGroupMsg).not.toHaveBeenCalled();
    await h.handleIncoming(h.relay(A, await h.encrypt(A, 'A control')));
    await h.handleIncoming(h.relay(C, await h.encrypt(C, 'C control')));
    expect(h.messages.get(`${A.id}:123`).text).toBe('A control');
    expect(h.messages.get(`${C.id}:123`).text).toBe('C control');
  });
});

describe('group receive compatibility and rejection controls', () => {
  it.each([undefined, null, '', C.id])('drops missing/non-full DC sender %s', async sender => {
    const h = harness();
    await deliverDC(h.dc(C), h.frame(C, await h.encrypt(C), { sender }));
    expect(h.decryptGroupMsg).not.toHaveBeenCalled();
    expect(h.messages.size).toBe(0);
    expect(h.ch.send).not.toHaveBeenCalled();
  });

  it('uses the local member record when there is no separate contact', async () => {
    const h = harness({ localC: false });
    await h.handleIncoming(h.relay(C, await h.encrypt(C), { authorSigV: undefined, authorSig: undefined }));
    expect(h.messages.get(`${C.id}:123`).senderName).toBe('Charlie (roster)');
  });

  it.each([{ members: [] }, { members: [B] }])('rejects empty/non-sender membership before either decrypt path', async ({ members }) => {
    const h = harness({ members });
    await h.handleIncoming(h.relay(C, await h.encrypt(C)));
    expect(h.decryptGroupMsg).not.toHaveBeenCalled();
    expect(h.decryptFrom).not.toHaveBeenCalled();
    expect(h.messages.size).toBe(0);
  });

  it('drops unknown groups and corrupted/empty ciphertext without persistence or ACK', async () => {
    const h = harness();
    for (const payload of ['', '{bad json', JSON.stringify({ g: true, c: 0, i: [], d: [] })]) {
      await deliverDC(h.dc(C), h.frame(C, payload));
    }
    await deliverDC(h.dc(C), h.frame(C, await h.encrypt(C), { groupId: 'unknown' }));
    expect(h.messages.size).toBe(0);
    expect(h._replayCache.size).toBe(0);
    expect(h.ch.send).not.toHaveBeenCalled();
  });

  it.each(['dc', 'relay'])('preserves legacy member encryption with local attribution on %s', async route => {
    const h = harness(), payload = `legacy:${C.pubB64}`;
    if (route === 'dc') await deliverDC(h.dc(C), h.frame(C, payload, { isGroupSK: false }));
    else await h.handleIncoming(h.relay(C, payload, { isGroupSK: false, fromPub: undefined }));
    expect(h.messages.get(`${C.id}:123`)).toMatchObject({ text: 'legacy hello', senderName: C.name });
    expect(h.decryptFrom).toHaveBeenCalledWith(payload, C.pubB64);
  });

  it('verifies the enclosed A signature, not forwarding peer C, on the deployed peer-relay DC path', async () => {
    const h = harness();
    await deliverDC(h.dc(C), { type: 'peer_relay_deliver', ...h.relay(A, await h.encrypt(A)) });
    expect(h.messages.get(`${A.id}:123`)).toMatchObject({ senderName: A.name, authorVerified: true });
    const forged = harness();
    await deliverDC(forged.dc(C), { type: 'peer_relay_deliver', ...forged.relay(A, await forged.forgeAsC(A)) });
    expect(forged.messages.size).toBe(0); expect(forged.decryptGroupMsg).not.toHaveBeenCalled();
  });

  it('labels accepted legacy messages and rejects missing signatures in strict mode without fallback', async () => {
    const h = harness(), msg = h.relay(A, await h.encrypt(A), { authorSig: undefined, authorSigV: undefined });
    await h.handleIncoming(msg);
    expect(h.messages.get(`${A.id}:123`).authorVerified).toBe(false);
    const strict = harness({ strict: true });
    await strict.handleIncoming(strict.relay(A, await strict.encrypt(A), { authorSig: undefined, authorSigV: undefined }));
    expect(strict.decryptGroupMsg).not.toHaveBeenCalled(); expect(strict.decryptFrom).not.toHaveBeenCalled();
    expect(strict.messages.size).toBe(0);
    const label = html.split('\n').find(line => line.includes("esc(t('groupAuthorLegacy'))"));
    const renderLabel = new Function('meta', 'isMine', 'activeContact', 't', 'esc', 'let content = ""; ' + label + '; return content;');
    const render = (meta, mine = false, group = true) => renderLabel(meta, mine, { isGroup: group }, key => key, value => value);
    expect(render({ authorVerified: false })).toContain('groupAuthorLegacy');
    expect(render({})).toContain('groupAuthorLegacy'); // history predating signatures
    expect(render({ authorVerified: true })).toBe('');
    expect(render({}, true)).toBe('');
    expect(render({}, false, false)).toBe('');
  });

  it.each(['edit', 'delete'])('does not let C rewrite an authenticated A message through a pairwise %s control', async type => {
    const h = harness({ strict: true });
    await h.handleIncoming(h.relay(A, await h.encrypt(A)));
    const msgId = A.id + ':123';
    h.decryptFrom.mockResolvedValue(JSON.stringify({ type, msgId, text: 'C changed it' }));
    await h.handleIncoming({ from: C.id, fromPub: C.pubB64, groupId: h.group.id, isSignal: true, payload: 'pairwise-C-control' });
    expect(h.messages.get(msgId)).toMatchObject({ text: 'hello @Bob', authorVerified: true });
    h.decryptFrom.mockResolvedValue(JSON.stringify({ type, msgId, text: 'A changed it' }));
    await h.handleIncoming({ from: A.id, fromPub: A.pubB64, groupId: h.group.id, isSignal: true, payload: 'pairwise-A-control' });
    expect(h.messages.get(msgId)).toMatchObject(type === 'edit' ? { text: 'A changed it', edited: true } : { text: '', deleted: true });
  });

  it.each([3, 5])('does not commit ratchet/replay state after authenticated AEAD failure (v%i)', async version => {
    const h = harness({ version }), payload = await h.encrypt(A), p = JSON.parse(payload);
    p.d[0] ^= 1;
    const bad = JSON.stringify(p), sig = await crypto.subtle.sign('Ed25519', signing.get(A.id).privateKey, groupAuthorTranscript(h.group.id, A.pubB64, p.ep, p.c, bad));
    const before = structuredClone(h.identity.get(`gsk-peer:${h.group.id}:${A.id}`));
    await h.handleIncoming(h.relay(A, bad, { authorSigV: 1, authorSig: Buffer.from(sig).toString('base64') }));
    expect(h.identity.get(`gsk-peer:${h.group.id}:${A.id}`)).toEqual(before);
    expect(h.identity.has(`ga-replay:${h.group.id}:${A.pubB64}`)).toBe(false);
    await h.handleIncoming(h.relay(A, payload)); expect(h.messages.size).toBe(1);
  });

  it('serializes duplicate DC/relay copies, verifies duplicate signatures before ACK, and accepts out-of-order counters', async () => {
    const h = harness(), first = await h.encrypt(A, 'first'), second = await h.encrypt(A, 'second');
    await Promise.all([h.handleIncoming(h.relay(A, second, { ts: 124 })), deliverDC(h.dc(A), h.frame(A, second, { ts: 124 }))]);
    await h.handleIncoming(h.relay(A, first));
    expect(h.messages.size).toBe(2);
    const calls = h.decryptGroupMsg.mock.calls.length, ack = {};
    await h.handleIncoming(h.relay(A, first, { authorSig: Buffer.alloc(64).toString('base64') }), ack);
    expect(ack.stored).toBeUndefined(); expect(h.decryptGroupMsg).toHaveBeenCalledTimes(calls);
  });
});
