import { describe, it, expect, vi } from 'vitest';
import { createDeviceRevocation, checkpointText, verifyCheckpoint, verifyCheckpointHead, deviceConsentText } from '../src/app/device-revocation.js';
import { bindingText } from '../src/app/device-keys.js';
import { createGroupAuthor, verifyGroupAuthor } from '../src/app/group-author.js';
import { negotiateGroup } from '../src/crypto/negotiate.js';

const b64 = bytes => Buffer.from(bytes).toString('base64');
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
