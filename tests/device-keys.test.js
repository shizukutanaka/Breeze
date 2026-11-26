import { afterEach, describe, expect, it, vi } from 'vitest';
import { offerText, bindingText, verifyOffer, verifyBinding, verifyBindingRegistry, deviceToken, readDeviceToken } from '../src/app/device-keys.js';
import { createDeviceLink } from '../src/app/device-link.js';
import { vaultSlot } from '../src/app/vault.js';

async function identity() {
  const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const ed = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64');
  const pub = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  const sign = async text => Buffer.from(await crypto.subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(text))).toString('base64');
  return { pub, ed, sign };
}
async function offer(who) {
  const value = { v: 1, pub: who.pub, ed: who.ed, nonce: 'a'.repeat(32) };
  return { ...value, sig: await who.sign(offerText(value)) };
}
async function binding(root, secondary) {
  const { sig, ...fields } = await offer(secondary);
  const value = { ...fields, root: root.pub, rootEd: root.ed, issuedAt: Date.now() };
  return { ...value, sig: await root.sign(bindingText(value)) };
}
async function registry(root, cert) {
  const devices = [{ pub: root.pub }, { pub: cert.pub, binding: cert }], ts = cert.issuedAt;
  const digest = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(devices.map(d => d.pub))))).subarray(0, 16).toString('hex');
  return { root: root.pub, devices, ts, sig: await root.sign(`breeze-device-set:${root.pub.slice(0, 12)}:${ts}:${digest}`) };
}
const expected = b => ({ root: b.root, rootEd: b.rootEd, pub: b.pub, ed: b.ed, nonce: b.nonce });
const node = () => ({ children: [], append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); } });
function fixture(who, rec = null) {
  vi.stubGlobal('navigator', { locks: { request: async (_key, work) => work() } });
  vi.stubGlobal('document', { createElement: node });
  const rows = new Map(), panels = [];
  const D = {
    myPubB64: () => who.pub, myId: () => who.pub.slice(0, 12), sigPub: () => who.ed, signMessage: who.sign,
    dbGet: async (store, key) => structuredClone(rows.get(store + ':' + key)),
    dbPut: vi.fn(async (store, value, key) => { rows.set(store + ':' + key, structuredClone(value)); return true; }),
    postAPIRaw: vi.fn(async (path, body) => { if (path === '/device/set') rec = body; return { ok: true, json: async () => rec }; }),
    fetchDeviceList: async () => rec?.devices.map(d => d.pub) || null,
    showConfirm: vi.fn(async () => true), showToast: vi.fn(), refreshDeviceRole: vi.fn(), bustDevCache: vi.fn(), dbg: vi.fn(),
    t: key => key, cmdPanel: () => { const box = node(), panel = node(); panels.push(panel); return [box, panel]; },
  };
  return { D, rows, panels, module: createDeviceLink(D) };
}
afterEach(() => vi.unstubAllGlobals());

describe('device-key offer and certificate transcripts', () => {
  it('round-trips version-gated offers and verifies signing-key possession', async () => {
    const o = await offer(await identity());
    expect(await verifyOffer(readDeviceToken('offer', deviceToken('offer', o)))).toBe(true);
    for (const bad of [null, {}, { ...o, v: 2 }, { ...o, nonce: '' }, { ...o, pub: (await identity()).pub }, { ...o, ed: (await identity()).ed }, { ...o, sig: 'AA==' }]) expect(await verifyOffer(bad)).toBe(false);
    for (const token of ['', 'breeze-device-offer:v2:e30=', 'x'.repeat(2049), 'breeze-device-offer:v1:////']) expect(() => readDeviceToken('offer', token)).toThrow();
  });
  it('binds both device keys, both root keys, challenge and issuance time', async () => {
    const root = await identity(), device = await identity(), cert = await binding(root, device);
    expect(await verifyBinding(cert, expected(cert))).toBe(true);
    for (const [key, value] of Object.entries({ v: 2, pub: root.pub, ed: root.ed, root: device.pub, rootEd: device.ed, nonce: 'b'.repeat(32), issuedAt: cert.issuedAt + 1, sig: 'AA==' })) expect(await verifyBinding({ ...cert, [key]: value }, expected(cert))).toBe(false);
    expect(await verifyBinding(cert, { root: root.pub, rootEd: device.ed })).toBe(false);
    expect(await verifyBinding(cert)).toBe(false);
    expect(await verifyBinding(null, expected(cert))).toBe(false);
  });
  it('requires an authentic registry listing both devices at or after certificate issuance', async () => {
    const root = await identity(), cert = await binding(root, await identity()), rec = await registry(root, cert);
    expect(await verifyBindingRegistry(rec, cert)).toBe(true);
    for (const bad of [null, {}, { ...rec, sig: 'AA==' }, { ...rec, ts: rec.ts - 1 }, { ...rec, devices: [rec.devices[0]] }, { ...rec, devices: [...rec.devices, rec.devices[1]] }, { ...rec, root: cert.pub }]) expect(await verifyBindingRegistry(bad, cert)).toBe(false);
    expect(await verifyBindingRegistry(rec, { ...cert, ed: root.ed })).toBe(false);
  });
});

describe('authenticated linking factory', () => {
  it('persists an offer before displaying it and publishes a verifiable root binding', async () => {
    const secondary = await identity(), root = await identity(), s = fixture(secondary);
    await s.module.handleCommand('/link keys');
    const token = s.panels[0].children[1].textContent, o = readDeviceToken('offer', token);
    expect(await verifyOffer(o)).toBe(true); expect(s.D.postAPIRaw).not.toHaveBeenCalled();
    expect(s.rows.get('identity:verify:device-link').offer).toEqual(o);
    const p = fixture(root); p.D.showConfirm.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await p.module.linkDevicePub(token);
    const cert = readDeviceToken('binding', p.panels[0].children[1].textContent);
    expect(await verifyBinding(cert, { root: root.pub, rootEd: root.ed, pub: secondary.pub, ed: secondary.ed, nonce: o.nonce })).toBe(true);
    expect(p.D.postAPIRaw).toHaveBeenCalledWith('/device/set', expect.objectContaining({ devices: expect.arrayContaining([expect.objectContaining({ pub: secondary.pub, binding: cert })]) }));
    expect(vaultSlot('identity', 'verify:device-link')).toBe(true);
    expect(vaultSlot('identity', 'verify:device-binding:' + secondary.pub)).toBe(true);
  });
  it('pins the directly transferred root key, ignores relay rootEd and consumes the offer across reload', async () => {
    const root = await identity(), secondary = await identity(), cert = await binding(root, secondary), rec = await registry(root, cert);
    rec.rootEd = (await identity()).ed;
    const f = fixture(secondary, rec); f.rows.set('identity:verify:device-link', { offer: await offer(secondary) });
    const token = deviceToken('binding', cert);
    await f.module.linkToRoot(token);
    expect(f.rows.get('identity:account')).toEqual({ root: root.pub, rootEd: root.ed, isPrimary: false });
    expect(f.rows.get('identity:verify:device-link')).toEqual({ binding: cert });
    expect(f.D.refreshDeviceRole).toHaveBeenCalledOnce();
    await createDeviceLink(f.D).linkToRoot(token);
    expect(f.D.refreshDeviceRole).toHaveBeenCalledOnce(); expect(f.D.showToast).toHaveBeenLastCalledWith('dkInvalid', 'error');
    await createDeviceLink(f.D).linkToRoot(root.pub);
    expect(f.D.refreshDeviceRole).toHaveBeenCalledOnce(); expect(f.rows.get('identity:account').rootEd).toBe(root.ed);
  });
  it.each(['wrong-device', 'forged', 'wrong-nonce', 'removed', 'changed-root', 'denied', 'storage'])('fails closed for %s without activating the link', async mode => {
    const root = await identity(), secondary = await identity(), cert = await binding(root, secondary), rec = await registry(root, cert);
    const f = fixture(secondary, rec); f.rows.set('identity:verify:device-link', { offer: await offer(secondary) });
    if (mode === 'wrong-device') f.D.myPubB64 = () => root.pub;
    if (mode === 'forged') cert.sig = 'AA==';
    if (mode === 'wrong-nonce') f.rows.get('identity:verify:device-link').offer.nonce = 'b'.repeat(32);
    if (mode === 'removed') rec.devices.pop();
    if (mode === 'changed-root') f.rows.get('identity:verify:device-link').binding = { ...cert, rootEd: secondary.ed };
    if (mode === 'denied') f.D.showConfirm.mockResolvedValue(false);
    if (mode === 'storage') f.D.dbPut.mockResolvedValue(false);
    await f.module.linkToRoot(deviceToken('binding', cert));
    expect(f.rows.has('identity:account')).toBe(false); expect(f.D.refreshDeviceRole).not.toHaveBeenCalled();
  });
  it('recovers safely when account persistence fails after protected certificate persistence', async () => {
    const root = await identity(), secondary = await identity(), cert = await binding(root, secondary), rec = await registry(root, cert), f = fixture(secondary, rec);
    f.rows.set('identity:verify:device-link', { offer: await offer(secondary) });
    const put = f.D.dbPut.getMockImplementation();
    f.D.dbPut.mockImplementation((store, value, key) => key === 'account' ? false : put(store, value, key));
    await f.module.linkToRoot(deviceToken('binding', cert));
    expect(f.rows.get('identity:verify:device-link').binding).toEqual(cert); expect(f.D.refreshDeviceRole).not.toHaveBeenCalled();
    f.D.dbPut.mockImplementation(put); await f.module.linkToRoot(deviceToken('binding', cert));
    expect(f.rows.get('identity:verify:device-link')).toEqual({ binding: cert }); expect(f.D.refreshDeviceRole).toHaveBeenCalledOnce();
  });
  it('retains legacy raw-key fan-out without issuing an authenticated binding', async () => {
    const root = await identity(), secondary = await identity(), cert = await binding(root, secondary), f = fixture(secondary, { ...await registry(root, cert), rootEd: root.ed });
    await f.module.linkToRoot(root.pub);
    expect(f.rows.get('identity:account').rootEd).toBe(root.ed);
    expect(f.rows.has('identity:verify:device-link')).toBe(false);
    f.rows.set('contacts:' + root.pub.slice(0, 12), { pubB64: root.pub, sigPub: root.ed });
    await f.module.linkToRoot(root.pub); expect(f.rows.get('identity:account').rootEd).toBe(root.ed);
  });
  it('rejects malformed offers and refuses authenticated operations without Web Locks', async () => {
    const f = fixture(await identity());
    await f.module.linkDevicePub('breeze-device-offer:v1:broken'); expect(f.D.postAPIRaw).not.toHaveBeenCalled();
    vi.stubGlobal('navigator', {}); await f.module.handleCommand('/link keys');
    expect(f.D.dbPut).not.toHaveBeenCalled(); expect(f.panels).toEqual([]);
  });
  it('does not store offers or publish bindings when signing fails', async () => {
    const f = fixture(await identity()); f.D.signMessage = async () => null;
    await f.module.handleCommand('/link keys'); expect(f.D.dbPut).not.toHaveBeenCalled();
    f.D.showConfirm.mockResolvedValue(true);
    await f.module.linkDevicePub(deviceToken('offer', await offer(await identity())));
    expect(f.D.postAPIRaw).not.toHaveBeenCalledWith('/device/set', expect.anything()); expect(f.panels).toEqual([]);
  });
});
