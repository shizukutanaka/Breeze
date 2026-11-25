import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createDeviceRevocation, createDeviceRevocationHost, checkpointText, verifyCheckpoint, verifyCheckpointHead, deviceConsentText } from '../src/app/device-revocation.js';
import { createDeviceLink } from '../src/app/device-link.js';
import { createGroupLive } from '../src/app/group-live.js';
import { bindingText } from '../src/app/device-keys.js';
import { createGroupAuthor, verifyGroupAuthor } from '../src/app/group-author.js';
import { negotiateGroup } from '../src/crypto/negotiate.js';

const b64 = bytes => Buffer.from(bytes).toString('base64');
afterEach(() => vi.unstubAllGlobals());
async function person() {
  const keys = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const pub = b64(crypto.getRandomValues(new Uint8Array(32))), ed = b64(await crypto.subtle.exportKey('raw', keys.publicKey));
  const signBytes = async bytes => new Uint8Array(await crypto.subtle.sign('Ed25519', keys.privateKey, bytes));
  return { pub, ed, signBytes, sign: async text => b64(await signBytes(new TextEncoder().encode(text))) };
}
async function certificate(root, device) {
  const c = { v: 1, root: root.pub, rootEd: root.ed, pub: device.pub, ed: device.ed, nonce: 'a'.repeat(32), issuedAt: Date.now() };
  c.sig = await root.sign(bindingText(c)); c.deviceSig = await device.sign(deviceConsentText(c)); return c;
}
function setup(who) {
  const rows = new Map();
  const get = async (s, k) => structuredClone(rows.get(s + ':' + k));
  const put = vi.fn(async (s, v, k) => { rows.set(s + ':' + k, structuredClone(v)); return true; });
  const D = { get, put, pub: () => who.pub, ed: () => who.ed, sign: who.sign, lock: async (_key, work) => work(), capable: async () => true, notice: vi.fn(), changed: vi.fn() };
  return { rows, D, authority: createDeviceRevocation(D), contact: p => rows.set('contacts:' + p.pub.slice(0, 12), { id: p.pub.slice(0, 12), pubB64: p.pub, sigPub: p.ed }) };
}
async function scenario() {
  const root = await person(), device = await person(), peer = await person(), cert = await certificate(root, device);
  const primary = setup(root), secondary = setup(device), remote = setup(peer);
  secondary.rows.set('identity:verify:device-link', { binding: cert }); secondary.contact(peer); remote.contact(root);
  const cp = await primary.authority.issue([{ pub: root.pub }, { pub: device.pub, binding: cert }]);
  await secondary.authority.accept(cp); await remote.authority.accept(cp);
  await primary.authority.acceptConsent(cert, device.pub); await secondary.authority.acceptConsent(cert, device.pub); await remote.authority.acceptConsent(cert, device.pub);
  return { root, device, peer, cert, cp, primary, secondary, remote };
}

describe('signed account checkpoints and monotonic revocation', () => {
  it('rejects forged, malformed, duplicate and foreign-root authority', async () => {
    const s = await scenario();
    expect(await verifyCheckpoint(s.cp, s.root.pub, s.root.ed)).toBe(true);
    expect(await verifyCheckpointHead(s.cp.head, s.root.pub, s.root.ed)).toBe(true);
    for (const bad of [null, {}, { ...s.cp, epoch: 0 }, { ...s.cp, sig: 'AA==' }, { ...s.cp, rootEd: s.peer.ed }, { ...s.cp, devices: [...s.cp.devices, s.cp.devices[1]] }, { ...s.cp, revoked: [s.device.pub] }, { ...s.cp, devices: [{ pub: s.root.pub }, { pub: s.device.pub, binding: { ...s.cert, ed: s.peer.ed } }] }]) {
      expect(await verifyCheckpoint(bad, s.root.pub, s.root.ed)).toBe(false);
    }
    await expect(s.remote.authority.accept({ ...s.cp, epoch: 99 })).rejects.toThrow();
    expect((await s.remote.authority.state(s.root.pub)).epoch).toBe(1);
    expect(() => checkpointText({ ...s.cp, revoked: Array(257).fill(s.peer.pub) })).toThrow();
  });
  it('rejects revoked 1:1 session peers even when they omit their root claim, survives reload and blocks rollback', async () => {
    const s = await scenario();
    expect(await s.remote.authority.allowed(s.device.pub)).toBe(true);
    expect(await s.remote.authority.authorPin(s.device.pub)).toBe(s.device.ed);
    const revoked = await s.primary.authority.issue([{ pub: s.root.pub }]);
    await s.remote.authority.accept(revoked);
    const reload = createDeviceRevocation(s.remote.D);
    expect(await reload.allowed(s.device.pub)).toBe(false);
    expect(await reload.allowed(s.device.pub, s.root.pub)).toBe(false);
    expect(await reload.allowed(s.device.pub, s.device.pub)).toBe(false);
    expect(await reload.authorPin(s.device.pub)).toBe(null);
    await expect(reload.accept(s.cp)).rejects.toThrow();
    await expect(s.primary.authority.issue(s.cp.devices)).rejects.toThrow();
    expect(await reload.allowed(s.root.pub, s.root.pub)).toBe(true);
    expect(await reload.allowed(s.peer.pub)).toBe(null);
  });
  it('authenticates withheld-checkpoint evidence, quarantines device traffic and recovers only with the matching checkpoint', async () => {
    const s = await scenario(), revoked = await s.primary.authority.issue([{ pub: s.root.pub }]);
    await expect(s.remote.authority.acceptHead({ ...revoked.head, epoch: 100 })).rejects.toThrow();
    expect(await s.remote.authority.allowed(s.device.pub)).toBe(true);
    await s.remote.authority.acceptHead(revoked.head);
    expect(s.remote.D.notice).toHaveBeenCalledWith('checkpoint', s.root.pub, 2);
    expect(await s.remote.authority.allowed(s.device.pub)).toBe(false);
    await expect(s.remote.authority.accept(s.cp)).rejects.toThrow('withheld');
    await s.remote.authority.accept(revoked);
    expect((await s.remote.authority.state(s.root.pub)).epoch).toBe(2);
    expect(await s.remote.authority.allowed(s.device.pub)).toBe(false);
  });
  it('carries revocation over authenticated plaintext envelopes and preserves legacy bytes', async () => {
    const s = await scenario(); s.primary.contact(s.peer);
    s.primary.D.capable = async () => false;
    const legacy = createDeviceRevocation(s.primary.D);
    expect(await legacy.wrap('original text', s.peer.pub)).toBe('original text');
    expect(await s.remote.authority.unwrap('original text', s.root.pub)).toBe('original text');
    s.primary.D.capable = async () => true;
    const revoked = await s.primary.authority.issue([{ pub: s.root.pub }]);
    const wire = await s.primary.authority.wrap('next message', s.peer.pub);
    expect(await s.remote.authority.unwrap(wire, s.root.pub)).toBe('next message');
    expect((await s.remote.authority.state(s.root.pub)).sig).toBe(revoked.sig);
    expect(await s.remote.authority.allowed(s.device.pub)).toBe(false);
    await expect(s.remote.authority.unwrap(JSON.stringify({ breezeDeviceAuthority: 1, body: 'forged', checkpoints: [{ ...revoked, epoch: 50 }], heads: [] }), s.root.pub)).rejects.toThrow();
  });
  it('fails closed on checkpoint storage failure and serializes concurrent root epochs', async () => {
    const s = await scenario();
    const issued = await Promise.all([s.primary.authority.issue(s.cp.devices), s.primary.authority.issue(s.cp.devices)]);
    expect(issued.map(c => c.epoch)).toEqual([2, 3]);
    s.remote.D.put.mockResolvedValue(false);
    await expect(s.remote.authority.accept(issued[1])).rejects.toThrow('persistence');
    expect((await s.remote.authority.state(s.root.pub)).epoch).toBe(1);
  });
  it('does not let a malicious root revoke an unrelated contact by inventing a device binding', async () => {
    const s = await scenario(), unrelated = await person(); s.remote.contact(unrelated);
    const forged = { v: 1, root: s.root.pub, rootEd: s.root.ed, pub: unrelated.pub, ed: unrelated.ed, nonce: 'b'.repeat(32), issuedAt: Date.now() };
    forged.sig = await s.root.sign(bindingText(forged));
    await s.remote.authority.accept(await s.primary.authority.issue([...s.cp.devices, { pub: unrelated.pub, binding: forged }]));
    await s.remote.authority.accept(await s.primary.authority.issue(s.cp.devices));
    expect(await s.remote.authority.allowed(unrelated.pub)).toBe(null);
    await expect(s.remote.authority.acceptConsent({ ...forged, deviceSig: s.cert.deviceSig })).rejects.toThrow();
  });
  it('invalidates device authority when its root signing pin changes', async () => {
    const s = await scenario(), replacement = await person();
    s.remote.contact({ pub: s.root.pub, ed: replacement.ed });
    expect(await s.remote.authority.allowed(s.device.pub)).toBe(false);
    expect(await s.remote.authority.authorPin(s.device.pub, s.root.pub)).toBe(null);
    await expect(s.remote.authority.accept(s.cp)).rejects.toThrow();
  });
});

describe('certified group authors and unlink sender-key rotation', () => {
  it('signs and verifies using the certified device key, then rejects the same device after revocation', async () => {
    const s = await scenario();
    const peerCP = await s.remote.authority.issue([{ pub: s.peer.pub }]); await s.secondary.authority.accept(peerCP);
    const group = { id: 'g_certified', isGroup: true, members: [{ id: s.root.pub.slice(0, 12), pubB64: s.root.pub }, { id: s.peer.pub.slice(0, 12), pubB64: s.peer.pub }] };
    const make = (f, p) => {
      f.rows.set('contacts:' + group.id, group); f.rows.set('identity:ga-policy:' + group.id, { strict: true });
      return createGroupAuthor({ get: f.D.get, put: f.D.put, pub: () => p.pub, sigPub: () => p.ed, supported: () => true, authorized: g => f.authority.certified(g), devicePin: (pub, root) => f.authority.authorPin(pub, root), allowed: (pub, root) => f.authority.allowed(pub, root), sign: p.signBytes, negotiate: negotiateGroup, attributeDevice: (root, pub) => f.authority.allowed(pub, root), dbg: vi.fn() });
    };
    const sender = make(s.secondary, s.device), receiver = make(s.remote, s.peer);
    const payload = JSON.stringify({ v: 5, g: true, ep: 0, c: 1, i: [1], d: [2] });
    const fields = await sender.sign(group.id, payload);
    expect(await verifyGroupAuthor(group.id, s.device.pub, payload, fields.authorSigV, fields.authorSig, s.device.ed)).toBe(true);
    const msg = { ...fields, from: s.device.pub.slice(0, 12), fromPub: s.device.pub, acctRoot: s.root.pub, groupId: group.id, payload };
    const deliver = vi.fn(); await receiver.receive(msg, {}, deliver); expect(deliver).toHaveBeenCalledOnce();
    const revoked = await s.primary.authority.issue([{ pub: s.root.pub }]); await s.remote.authority.accept(revoked);
    await receiver.receive(msg, {}, deliver); expect(deliver).toHaveBeenCalledOnce();
    await s.secondary.authority.accept(revoked); await expect(sender.sign(group.id, payload)).rejects.toThrow();
  });
  it.each([3, 5])('rotates v%s sender keys exactly once per checkpoint, including when a peer learns an unlink', async v => {
    const s = await scenario(), group = { members: [{ pubB64: s.root.pub }, { pubB64: s.peer.pub }] };
    const bytes = Array(32).fill(7), stored = v === 5 ? { v: 5, chainKey: bytes, epoch: 9, counter: 7, skipped: { old: [1] } } : { raw: bytes, epoch: 9, counter: 7 };
    expect(await s.remote.authority.keyFor(group, stored)).toBe(stored);
    await s.remote.authority.accept(await s.primary.authority.issue([{ pub: s.root.pub }]));
    const next = await s.remote.authority.keyFor(group, stored);
    expect(next.epoch).toBe(10); expect(next.counter).toBe(0); expect(next.chainKey || next.raw).not.toEqual(bytes);
    expect(next.skipped || {}).toEqual({}); expect(await s.remote.authority.keyFor(group, next)).toBe(next);
    expect(await s.remote.authority.allowed(s.device.pub, s.root.pub)).toBe(false);
  });
});

describe('deployed device-authority boundaries', () => {
  it('rejects revoked receive, encryption and session bootstrap before application side effects', async () => {
    const s = await scenario(), html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const section = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a)));
    const raw = vi.fn(async () => 'hello'), requests = { admit: vi.fn(async () => true) };
    const compile = (code, tail) => new Function('_deviceRevocation', '_withPeerLock', '_encryptForRaw', '_decryptFromRaw', '_dbg', '_requests', code + tail)(
      { ...s.remote.authority, admit: async m => await s.remote.authority.allowed(m.fromPub, m.acctRoot) !== false }, (_id, fn) => fn(), raw, raw, vi.fn(), requests);
    const decrypt = compile(section('async function decryptFrom(', 'async function _decryptFromRaw('), ';return decryptFrom;');
    expect(await decrypt('ciphertext', s.device.pub)).toBe('hello');
    await s.remote.authority.accept(await s.primary.authority.issue([{ pub: s.root.pub }])); raw.mockClear();
    expect(await decrypt('ciphertext', s.device.pub)).toBe(null);
    const encrypt = compile(section('async function encryptFor(', 'async function _encryptForRaw('), ';return encryptFor;');
    expect(await encrypt('secret', s.device.pub)).toBe(null);
    const receive = compile(section('async function handleIncoming(msg, ackOut) {', '// ===== P2P connection per contact ====='), ';return handleIncoming;');
    const ack = {}; await receive({ from: s.device.pub.slice(0, 12), fromPub: s.device.pub }, ack);
    expect(raw).not.toHaveBeenCalled(); expect(requests.admit).not.toHaveBeenCalled(); expect(ack.stored).toBeUndefined();
  });
  it('bounds authenticated envelopes, rejects malformed metadata and keeps no-Web-Locks legacy sends unchanged', async () => {
    const s = await scenario();
    await expect(s.remote.authority.unwrap(JSON.stringify({ breezeDeviceAuthority: 1, body: 'x', checkpoints: {}, heads: [] }), s.root.pub)).rejects.toThrow();
    await expect(s.remote.authority.unwrap(JSON.stringify({ breezeDeviceAuthority: 1, body: 'x'.repeat(65536), checkpoints: [], heads: [] }), s.root.pub)).rejects.toThrow('bounds');
    await expect(s.primary.authority.wrap('x'.repeat(65535), s.peer.pub)).rejects.toThrow('frame');
    const wire = await s.primary.authority.wrap('hello', s.peer.pub); expect(Buffer.byteLength(wire)).toBeLessThanOrEqual(65535);
    vi.stubGlobal('navigator', {});
    const host = createDeviceRevocationHost({ ...s.primary.D, all: async () => [], peerInfo: vi.fn(), dbg: vi.fn() });
    expect(await host.capable(s.peer.pub)).toBe(false); expect(await host.wrap('legacy', s.peer.pub)).toBe('legacy');
    const stored = { epoch: 1 }; expect(await host.keyFor({}, stored)).toBe(stored);
    expect(await host.checkpoint([])).toBeUndefined(); expect(await host.certified({})).toBe(true);
    await s.primary.authority.issue([{ pub: s.root.pub }]);
    await expect(host.keyFor({}, stored)).rejects.toThrow('Web Locks');
  });
  it('unlink rotates and redistributes the real group Sender Key only to remaining device mailboxes', async () => {
    const s = await scenario(), other = await person(), cert = await certificate(s.root, other);
    vi.stubGlobal('navigator', { locks: { request: async (_key, fn) => fn() } });
    const cp = await s.primary.authority.issue([...s.cp.devices, { pub: other.pub, binding: cert }]);
    const group = { id: 'unlink-group', isGroup: true, members: [{ id: s.root.pub.slice(0, 12), pubB64: s.root.pub }] };
    s.primary.rows.set('contacts:' + group.id, group);
    s.primary.rows.set('identity:gsk:' + group.id, { v: 5, chainKey: Array(32).fill(3), epoch: 4, counter: 3, authorSigV: 1 });
    const send = vi.fn(), dbg = vi.fn(); let author, live;
    const host = createDeviceRevocationHost({ ...s.primary.D, all: async () => [group], peerInfo: async () => ({ caps: ['device-revocation-v1'] }), groupAuthor: () => author, dbg,
      encrypt: async (body, pub) => host.wrap(body, pub), send });
    author = createGroupAuthor({ ...s.primary.D, sigPub: () => s.root.ed, supported: () => true, negotiate: negotiateGroup, dbg,
      revocationKey: (g, sk) => host.keyFor(g, sk), distribute: gid => live.distributeOwnKey(gid) });
    live = createGroupLive({ myPubB64: () => s.root.pub, myId: () => s.root.pub.slice(0, 12), myName: () => 'Root', acctRoot: () => null,
      myOtherDevices: () => host.targets(s.root.pub), getSenderKey: gid => s.primary.D.get('identity', 'gsk:' + gid), groupRatchetV5: () => true,
      skRedistEvery: () => 10, encryptFor: async (body, pub) => host.wrap(body, pub), relaySend: send, dbg });
    const post = vi.fn(async () => ({ ok: true, json: async () => ({ devices: cp.devices }) }));
    const link = createDeviceLink({ dbGet: s.primary.D.get, dbPut: s.primary.D.put, myPubB64: () => s.root.pub, myId: () => s.root.pub.slice(0, 12), sigPub: () => s.root.ed,
      signMessage: s.root.sign, fetchDeviceList: async () => cp.devices.map(d => d.pub), checkpoint: devices => host.checkpoint(devices), postAPIRaw: post,
      showConfirm: async () => true, showToast: vi.fn(), t: k => k, bustDevCache: vi.fn(), dbg });
    await link.handleCommand('/unlink 2');
    expect((await host.state(s.root.pub)).revoked).toContain(s.device.pub);
    const sk = await s.primary.D.get('identity', 'gsk:' + group.id); expect(sk.epoch).toBe(5); expect(sk.counter).toBe(0); expect(sk.chainKey).not.toEqual(Array(32).fill(3));
    const deliveries = send.mock.calls.filter(([, msg]) => msg.isSenderKey);
    expect(deliveries.map(([, , pub]) => pub)).toEqual([other.pub]);
    expect(JSON.parse(JSON.parse(deliveries[0][1].payload).body).chainKey).toEqual(sk.chainKey);
    expect(send.mock.calls.some(([, , pub]) => pub === s.device.pub)).toBe(false);
    expect(post).toHaveBeenCalledWith('/device/set', expect.objectContaining({ devices: expect.not.arrayContaining([expect.objectContaining({ pub: s.device.pub })]) }));
    await author.rotate(group.id); expect((await s.primary.D.get('identity', 'gsk:' + group.id)).epoch).toBe(5);
  });
  it('lets only the root bootstrap checkpoint delivery to its devices, deferring other unready sessions', async () => {
    const s = await scenario();
    vi.stubGlobal('navigator', { locks: { request: async (_key, fn) => fn() } });
    const encrypt = vi.fn(async () => 'ciphertext'), send = vi.fn(), dbg = vi.fn();
    const deps = { peerInfo: async () => ({ caps: ['device-revocation-v1'] }), encrypt, send, dbg };
    const primary = createDeviceRevocationHost({ ...s.primary.D, ...deps, all: async () => [{ pubB64: s.peer.pub }] });
    await primary.broadcast();
    expect(encrypt).toHaveBeenCalledTimes(1); expect(encrypt).toHaveBeenCalledWith(expect.any(String), s.device.pub);
    encrypt.mockClear(); send.mockClear();
    const secondary = createDeviceRevocationHost({ ...s.secondary.D, ...deps, all: async () => [{ pubB64: s.root.pub }] });
    await secondary.broadcast();
    expect(encrypt).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
    s.secondary.rows.set('identity:sess:' + s.root.pub.slice(0, 12), { sendCounter: 1, recvCounter: 0 });
    await secondary.broadcast();
    expect(encrypt).not.toHaveBeenCalled();
    const piggyback = JSON.parse(await secondary.wrap('next message', s.root.pub));
    expect(piggyback.body).toBe('next message'); expect(piggyback.consents).toContainEqual(s.cert);
    s.secondary.rows.set('identity:sess:' + s.root.pub.slice(0, 12), { sendCounter: 1, recvCounter: 1 });
    await secondary.broadcast();
    expect(encrypt).toHaveBeenCalledTimes(1); expect(encrypt).toHaveBeenCalledWith(expect.any(String), s.root.pub);
    expect(send).toHaveBeenCalledTimes(1); expect(send).toHaveBeenCalledWith(s.root.pub.slice(0, 12), expect.objectContaining({ isProfile: true, payload: 'ciphertext' }), s.root.pub);
    expect(dbg).not.toHaveBeenCalled();
    encrypt.mockClear();
    const get = async (store, key) => { if (key.startsWith('sess:')) throw new Error('session unavailable'); return s.secondary.D.get(store, key); };
    await createDeviceRevocationHost({ ...s.secondary.D, ...deps, get, all: async () => [] }).broadcast();
    expect(encrypt).not.toHaveBeenCalled(); expect(dbg).toHaveBeenCalledWith(expect.any(Error), 'device checkpoint distribution');
  });
  it('gossips shared group authority to its own devices before they have sent consent back', async () => {
    const s = await scenario();
    vi.stubGlobal('navigator', { locks: { request: async (_key, fn) => fn() } });
    s.primary.contact(s.peer);
    const peer = setup(s.peer), cp = await peer.authority.own();
    await s.primary.authority.accept(cp);
    s.primary.rows.delete('identity:verify:device-owner:' + s.device.pub);
    const group = { isGroup: true, members: [{ pubB64: s.root.pub }, { pubB64: s.peer.pub }] };
    const host = createDeviceRevocationHost({ ...s.primary.D, all: async () => [group], peerInfo: async () => ({ caps: ['device-revocation-v1'] }) });
    const wrapped = JSON.parse(await host.wrap('sender key', s.device.pub));
    expect(wrapped.checkpoints.map(c => c.root)).toContain(s.peer.pub);
    expect(await s.primary.D.get('identity', 'verify:device-owner:' + s.device.pub)).toBeUndefined();
  });
});
