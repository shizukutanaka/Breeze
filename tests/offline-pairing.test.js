import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createOfflinePairing, createInviteCodec, packInvite, unpackInvite, pairingFingerprint, makePairMaterial } from '../src/app/offline-pairing.js';
import { canonical } from '../src/app/rendezvous.js';
import { pairingPreKeyMatches, padBucketSize } from '../src/crypto/ratchet.js';
import { createPQSessionHelper } from '../src/crypto/pqxdh.js';

const MS = { MIN: 60000, WEEK: 604800000 };
const b64 = b => Buffer.from(b).toString('base64');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inline = html.slice(html.indexOf('  async function hkdf('), html.indexOf('  // --- Safety Number (v3) ---'));
const devices = [];
async function device(pq = true) {
  const ik = await crypto.subtle.generateKey('X25519', true, ['deriveBits']);
  const ed = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const pub = b64(await crypto.subtle.exportKey('raw', ik.publicKey));
  const sigPub = b64(await crypto.subtle.exportKey('raw', ed.publicKey));
  const store = new Map(), allocated = [], changes = [], errors = [];
  const get = async (s, id) => structuredClone(store.get(s + ':' + id) ?? null);
  const put = async (s, value, id = value.id) => { store.set(s + ':' + id, structuredClone(value)); return true; };
  const signRaw = bytes => crypto.subtle.sign('Ed25519', ed.privateKey, bytes);
  const sign = async text => b64(await signRaw(new TextEncoder().encode(text)));
  const verify = async (text, signature, key) => {
    try {
      const imported = await crypto.subtle.importKey('raw', Buffer.from(key, 'base64'), 'Ed25519', false, ['verify']);
      return await crypto.subtle.verify('Ed25519', imported, Buffer.from(signature, 'base64'), new TextEncoder().encode(text));
    } catch { return false; }
  };
  const api = vi.fn(() => { throw new Error('Unexpected relay request'); });
  const CONFIG = { X3DH_V5_ENABLED: true, PQXDH_ENABLED: pq, PREFERRED_CURVE: 'X25519', HKDF_HASH: 'SHA-256', IV_BYTES: 12, MSG_PAD_BOUNDARY: 256, REPLAY_CACHE_SIZE: 200, SESSION_RESET_THRESHOLD: 3 };
  const R = new Function('CONFIG', '_hasX25519', '_hasEd25519', 'dbGet', 'dbPut', 'myKeys', 'myPubB64', 'API', '_dbg', 'arr', 'u8', 'bufToB64', 'zeroBuffer', 'workerCrypto', 'timingSafeEqual', 'MS', 'postAPIRaw', '_padBucketSize', '_settings', inline + '\nreturn { initSessionV5Initiator, saveSession, getSession, encryptFor, decryptFrom, _withPeerLock, pairingPreKeyMatches };')(
    CONFIG, true, true, get, put, ik, pub, null, (...e) => errors.push(e), Array.from, x => new Uint8Array(x), b64, () => {}, async () => null, async (a, b) => a === b, MS, api, padBucketSize, { ktBlockOnTamper: false },
  );
  const D = { MS, me: () => pub, sigPub: () => sigPub, name: () => 'Sample <name>', caps: () => ['x3dh-v5', ...(pq ? ['pqxdh'] : [])], signRaw, sign, verify,
    get, put, remove: async (s, id) => store.delete(s + ':' + id), contacts: async () => [...store].filter(([k]) => k.startsWith('contacts:')).map(([, v]) => structuredClone(v)),
    session: R.getSession, saveSession: R.saveSession, initiate: R.initSessionV5Initiator, exclusive: R._withPeerLock, blockPeer: vi.fn(), closePeer: vi.fn(),
    encrypt: (text, peer) => R.encryptFor(text, peer, undefined, true), decrypt: (wire, peer, material) => R.decryptFrom(wire, peer, undefined, material), matchPreKey: R.pairingPreKeyMatches,
    changed: c => changes.push(structuredClone(c)), log: e => errors.push(e),
    material: async opts => { const m = await makePairMaterial(opts); allocated.push(m); return m; },
  };
  const manager = createOfflinePairing(D);
  const d = { pub, sigPub, D, R, store, get, put, api, allocated, changes, errors, manager };
  devices.push(d);
  return d;
}
async function pair(a, b) {
  const ai = await a.manager.invite(), bi = await b.manager.invite();
  const ap = await a.manager.inspect(bi.code), bp = await b.manager.inspect(ai.code);
  expect(ap.fingerprint).toBe(bp.fingerprint);
  expect(ap.fingerprint).toMatch(/^(\d{5} ){5}\d{5}$/);
  return [await a.manager.confirm(ap), await b.manager.confirm(bp)];
}
afterEach(async () => {
  for (const d of devices.splice(0)) for (const c of await d.D.contacts()) await d.manager.cancel(c);
  vi.useRealTimers(); vi.unstubAllGlobals();
});

describe('offline identity invite', () => {
  it('round-trips compressed signed invites and sanitizes the display name', async () => {
    const a = await device(), b = await device();
    const { code, envelope } = await a.manager.invite();
    expect(code).toMatch(/^breeze-inv1z:/);
    expect(envelope.name).toBe('Sample name');
    expect((await b.manager.inspect(code)).remote).toEqual(envelope);
    expect(await b.D.contacts()).toEqual([]);
    expect(a.api).not.toHaveBeenCalled(); expect(b.api).not.toHaveBeenCalled();
  });
  it('rejects tampered fields, wrong signing keys, expiry, wrong kind, unsupported caps and malformed/oversize input', async () => {
    const a = await device(), b = await device(), attacker = await device();
    const { envelope: e } = await a.manager.invite();
    for (const change of [{ name: 'fake' }, { pub: b.pub }, { sigPub: attacker.sigPub }, { caps: ['x3dh-v5'] }, { nonce: 'a'.repeat(22) }, { exp: Date.now() - 1 }, { exp: Date.now() + 31 * MS.MIN }, { kind: 'offer' }, { extra: true }]) {
      await expect(b.manager.inspect(await packInvite({ ...e, ...change }))).rejects.toThrow('opInvalid');
    }
    for (const code of ['', 'breeze-inv1z:!', 'x'.repeat(16385), 'breeze-inv1z:eA']) await expect(b.manager.inspect(code)).rejects.toThrow();
    await expect(packInvite({ payload: 'x'.repeat(17000) })).rejects.toThrow();
    const bomb = 'breeze-inv1z:' + (await import('node:zlib')).deflateRawSync(Buffer.from(' '.repeat(20000))).toString('base64url');
    await expect(unpackInvite(bomb)).rejects.toThrow();
    const forged = { ...e }; delete forged.sig; forged.sig = await attacker.D.sign(canonical(forged));
    await expect(b.manager.inspect(await packInvite(forged))).rejects.toThrow();
  });
  it('requires explicit confirmation, records verification and rejects used nonces', async () => {
    const a = await device(), b = await device();
    const offer = await b.manager.invite(), candidate = await a.manager.inspect(offer.code);
    expect(await a.D.contacts()).toHaveLength(0);
    await expect(a.manager.confirm({ ...candidate, fingerprint: 'wrong' })).rejects.toThrow();
    const c = await a.manager.confirm(candidate);
    expect(c.sigPub).toBe(b.sigPub); expect(c.offlineVerified).toBe(true);
    expect(c.offlinePairing).toMatchObject({ state: 'pending', kt: 'unavailable', manualOnly: true });
    await expect(a.manager.inspect(offer.code)).rejects.toThrow();
    expect(await a.R.encryptFor('must not send', b.pub)).toBeNull();
  });
  it('never replaces an existing pin or identity, and only adds verification to an existing session', async () => {
    const a = await device(), b = await device(), attacker = await device();
    const invite = await b.manager.invite(), id = b.pub.slice(0, 12);
    for (const record of [{ id, pubB64: b.pub, sigPub: attacker.sigPub }, { id, pubB64: attacker.pub, sigPub: b.sigPub }]) {
      await a.put('contacts', record);
      await expect(a.manager.inspect(invite.code)).rejects.toThrow();
      expect(await a.get('contacts', id)).toEqual(record);
    }
    await a.put('contacts', { id, pubB64: b.pub, sigPub: b.sigPub, name: 'Keep my name' });
    await a.put('identity', { sentinel: 'existing session' }, 'sess:' + id);
    const c = await a.manager.confirm(await a.manager.inspect(invite.code));
    expect(c.name).toBe('Keep my name'); expect(c.offlinePairing.state).toBe('paired'); expect(c.offlinePairing.manualOnly).toBe(false);
    expect(await a.get('identity', 'sess:' + id)).toEqual({ sentinel: 'existing session' });
  });
  it('fingerprint binds both identities, signing keys and nonces, independent of exchange direction', async () => {
    const a = (await (await device()).manager.invite()).envelope, b = (await (await device()).manager.invite()).envelope;
    const n = await pairingFingerprint(a, b);
    expect(await pairingFingerprint(b, a)).toBe(n);
    for (const field of ['pub', 'sigPub', 'nonce']) expect(await pairingFingerprint({ ...a, [field]: 'changed' }, b)).not.toBe(n);
  });
  it('rejects orphaned sessions rather than associating them with an unbound identity', async () => {
    const a = await device(), b = await device(), id = b.pub.slice(0, 12);
    await a.put('identity', { sentinel: 'unbound' }, 'sess:' + id);
    await expect(a.manager.confirm(await a.manager.inspect((await b.manager.invite()).code))).rejects.toThrow('opInvalid');
    expect(await a.get('contacts', id)).toBeNull();
    expect(await a.get('identity', 'sess:' + id)).toEqual({ sentinel: 'unbound' });
  });
  it('does not report verification when persisting it fails', async () => {
    const a = await device(), b = await device();
    const candidate = await a.manager.inspect((await b.manager.invite()).code);
    a.D.put = async () => false;
    await expect(a.manager.confirm(candidate)).rejects.toThrow('opInvalid');
    expect(await a.D.contacts()).toEqual([]); expect(a.changes).toEqual([]);
  });
});

for (const pq of [false, true]) describe(`real inline offline bootstrap, pq=${pq}`, () => {
  async function connection() {
    vi.stubGlobal('__breezePQXDH', createPQSessionHelper());
    const a = await device(pq), b = await device(pq), [ac, bc] = await pair(a, b), bus = [];
    const ad = { send: text => bus.push({ from: a, to: b, contact: bc, dc: bd, msg: JSON.parse(text) }) };
    const bd = { send: text => bus.push({ from: b, to: a, contact: ac, dc: ad, msg: JSON.parse(text) }) };
    const step = async () => { const frame = bus.shift(); await frame.to.manager.receive(frame.contact, frame.msg, frame.dc); return frame; };
    await Promise.all([a.manager.start(ac, ad), b.manager.start(bc, bd)]);
    return { a, b, ac, bc, bus, ad, bd, step };
  }
  it('elects exactly one initiator, confirms both directions, then delivers using the same ratchet with no relay/OTP/KT', async () => {
    const { a, b, ac, bc, bus, step } = await connection();
    expect(await a.R.encryptFor('blocked before confirmation', b.pub)).toBeNull();
    let pkms = 0, confirmations = 0;
    for (let n = 0; bus.length && n < 20; n++) {
      const frame = await step();
      if (frame.msg.type === 'pair-confirm') {
        confirmations++;
        const wire = JSON.parse(frame.msg.payload);
        if (wire.t === 'pkm') { pkms++; expect(wire.opkId).toBeNull(); expect(!!wire.pqct).toBe(pq); expect(frame.from.pub < frame.to.pub).toBe(true); }
      }
    }
    expect(bus).toHaveLength(0); expect(pkms).toBe(1); expect(confirmations).toBe(2);
    for (const [x, contact] of [[a, ac], [b, bc]]) {
      expect((await x.get('contacts', contact.id)).offlinePairing.state).toBe('paired');
      expect(!!(await x.D.session(contact.id)).pq).toBe(pq);
      expect(x.api).not.toHaveBeenCalled();
      for (const material of x.allocated) if (material.pqRecord) expect(material.pqRecord.seed.every(n => n === 0)).toBe(true);
    }
    expect(await b.R.decryptFrom(await a.R.encryptFor('hello offline', b.pub), a.pub)).toBe('hello offline');
    expect(await a.R.decryptFrom(await b.R.encryptFor('reply offline', a.pub), b.pub)).toBe('reply offline');
    expect(await a.R.decryptFrom('{"broken":true}', b.pub)).toBeNull();
    expect(await a.R.decryptFrom('{"broken":true}', b.pub)).toBeNull();
    expect(await a.R.decryptFrom('{"broken":true}', b.pub)).toBeNull();
    expect(await b.R.decryptFrom(await a.R.encryptFor('still authenticated', b.pub), a.pub)).toBe('still authenticated');
  });
  it('rejects wrong-recipient/transcript/signature bundles and invalid signed PQ material', async () => {
    const { a, b, ac, bus, ad } = await connection();
    const original = bus.find(f => f.to === a).msg;
    for (const change of [{ to: 'wrong' }, { fingerprint: 'wrong' }, { sig: 'wrong' }]) await expect(a.manager.receive(ac, { ...original, ...change }, ad)).rejects.toThrow();
    if (pq) {
      const bad = structuredClone(original); bad.bundle.pqPreKey = b64(new Uint8Array(1184)); delete bad.sig; bad.sig = await b.D.sign(canonical(bad));
      await expect(a.manager.receive(ac, bad, ad)).rejects.toThrow();
    }
    expect((await a.get('contacts', ac.id)).offlinePairing.state).toBe('pending');
    expect(await a.D.session(ac.id)).toBeNull();
  });
  it('destroys dedicated material on cancel and prevents ordinary traffic while pending', async () => {
    const { a, ac, ad } = await connection();
    expect(await a.manager.receive(ac, { type: 'msg' }, ad)).toBe(true);
    await a.manager.cancel(ac);
    expect((await a.get('contacts', ac.id)).offlinePairing.state).toBe('cancelled');
    expect(await a.D.session(ac.id)).toBeNull();
    expect(a.D.closePeer).toHaveBeenCalled();
    for (const m of a.allocated) if (m.pqRecord) expect(m.pqRecord.seed.every(n => n === 0)).toBe(true);
  });
});

describe('pairing prekey mirror and expiry', () => {
  it('cross-checks exact incoming identity, no-OTP and negotiated PQ requirements against the reference', () => {
    const start = html.indexOf('  function pairingPreKeyMatches('), end = html.indexOf('\n  async function _bootstrapResponderSessionV5', start);
    const mirror = new Function(html.slice(start, end) + ';return pairingPreKeyMatches;')();
    const identity = new Uint8Array(32).fill(1), good = { v: 5, t: 'pkm', ik: Array.from(identity), ek: Array(32).fill(2), opkId: null, msg: 'encrypted' };
    for (const pq of [false, true]) for (const p of [good, { ...good, pqct: Array(1088).fill(3) }, { ...good, opkId: 1 }, { ...good, ik: Array(32).fill(9) }, { ...good, ek: [] }, null]) expect(mirror(p, identity, pq)).toBe(pairingPreKeyMatches(p, identity, pq));
    expect(mirror(good, identity, false)).toBe(true); expect(mirror(good, identity, true)).toBe(false);
  });
  it('expires pending pairing and clears retained secrets/session without fetching anything', async () => {
    vi.useFakeTimers(); vi.stubGlobal('__breezePQXDH', createPQSessionHelper());
    const a = await device(), b = await device(), [ac] = await pair(a, b);
    await a.manager.start(ac, { send() {} });
    await vi.advanceTimersByTimeAsync(30 * MS.MIN + 1);
    expect((await a.get('contacts', ac.id)).offlinePairing.state).toBe('cancelled');
    expect(a.allocated[0].pqRecord.seed.every(n => n === 0)).toBe(true);
    expect(await a.D.session(ac.id)).toBeNull(); expect(a.api).not.toHaveBeenCalled();
  });
});
