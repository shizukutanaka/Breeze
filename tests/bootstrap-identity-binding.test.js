import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRatchet, padBucketSize } from '../src/crypto/ratchet.js';
import { createPQSessionHelper } from '../src/crypto/pqxdh.js';
import { mintPQPreKey } from '../src/crypto/pqkey.js';

globalThis._deviceRevocation = { allowed: async () => null, admit: async () => true, wrap: async body => body, unwrap: async body => body, targets: async () => null };
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const ratchet = createRatchet({ hasX25519: true, PREFERRED_CURVE: 'X25519' });
const b64 = bytes => Buffer.from(bytes).toString('base64');
function slice(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('Missing inline bootstrap marker');
  return html.slice(a, b);
}
const cryptoSource = slice('  async function genRatchetKey() {', '\n  // --- Init session (first contact) ---')
  + slice('  async function _encryptForRaw(', '\n  // --- Decrypt with Double Ratchet ---')
  + slice('  async function _decryptFromRaw(', '\n  // --- Safety Number (v3) ---');
const incomingSource = slice('  async function handleIncoming(msg, ackOut) {', '// ===== P2P connection per contact =====');
const forwardSource = slice("          if (msg.type === 'peer_relay_deliver') {", "          if (msg.type === 'msg') {");

afterEach(() => { delete globalThis.__breezePQXDH; });

async function world({ keys, contact, bundles = [], spk, pqSeed, pq = false } = {}) {
  keys ||= await ratchet.genRatchetKey();
  const records = { contacts: new Map(), identity: new Map(), messages: new Map() };
  if (contact) records.contacts.set(contact.id, structuredClone(contact));
  if (spk) records.identity.set('spk-priv', { priv: await crypto.subtle.exportKey('jwk', spk.privateKey) });
  if (pqSeed) records.identity.set('pq-priv', { seed: Array.from(pqSeed) });
  const sessions = new Map(), warnings = [], logs = [];
  let fetchIndex = 0;
  const fetchBundle = vi.fn(async () => {
    const bundle = bundles[fetchIndex++];
    return bundle ? { ok: true, json: async () => bundle } : null;
  });
  const legacy = vi.fn(async () => null);
  const D = {
    _requests: { admit: async () => true },
    crypto, CONFIG: { X3DH_V5_ENABLED: true, PQXDH_ENABLED: pq, PREFERRED_CURVE: 'X25519',
      REPLAY_CACHE_SIZE: 2000, MSG_PAD_BOUNDARY: 256, IV_BYTES: 12, SESSION_RESET_THRESHOLD: 3 },
    API: 'https://relay.test/api', _hasX25519: true, _hasEd25519: true,
    myKeys: keys, myPubB64: b64(keys.pub), myId: b64(keys.pub).slice(0, 12),
    hkdf: ratchet.hkdf, arr: x => Array.from(x), u8: x => new Uint8Array(x),
    dbGet: async (store, key) => records[store]?.get(key) ?? null,
    dbPut: vi.fn(async (store, value, key) => { records[store]?.set(key ?? value.id ?? value.msgId, value); return true; }),
    dbGetAll: async store => [...records[store].values()],
    getSession: async id => sessions.get(id), saveSession: vi.fn(async (id, sess) => sessions.set(id, sess)),
    initSession: legacy, initSessionResponder: legacy, _atRestIsWrapped: () => false, _pqSeedUnlocked: null,
    sanitizeHomeList: list => list || [], isOriginRelay: entry => entry.url === 'https://relay.test',
    _servingRelayUrl: () => 'https://relay.test', postAPIRaw: fetchBundle, _contactRelayPost: fetchBundle,
    _seedRelayInfo: vi.fn(), _dbg: (...args) => logs.push(args), showToast: (...args) => warnings.push(args), t: key => key,
    _decryptFailures: {}, MS: { SEC: 1000, MIN: 60000, WEEK: 604800000 }, workerCrypto: async () => null,
    zeroBuffer: x => x.fill(0), _keyCommit: async key => Array.from(await ratchet.keyCommitment(key)),
    _cmOk: async (p, key) => !p.cm || Buffer.from(p.cm).equals(Buffer.from(await ratchet.keyCommitment(key))),
    _withPeerLock: (_id, fn) => fn(),
    _replayCache: new Set(), decryptGroupMsg: async () => null, addContact: vi.fn(),
    verifySignature: vi.fn(async () => true), safeMsgId: x => x, activeContact: null, _shouldAlert: () => false,
    playNotif() {}, Notification: undefined, announceToSR() {}, appendMsg() {}, showSmartReplies() {},
    _renderContactsThrottled() {}, broadcastToTabs() {}, _myOtherDevices: async () => [],
    _focusActive: () => false, _attribDevCache: new Map(),
    _padBucketSize: padBucketSize, // D02: the inline encrypt path resolves the bucket helper as a free variable
    _settings: { ktBlockOnTamper: false }, // D05: initSessionV5Initiator reads the opt-in KT block flag
  };
  const api = new Function('D', `with (D) {
    ${cryptoSource}
    function decryptFrom(...args) { return _decryptFromRaw(...args); }
    ${incomingSource}
    return { initSessionV5Initiator, encrypt: _encryptForRaw, decrypt: _decryptFromRaw, handleIncoming,
      forward: async msg => { ${forwardSource} } };
  }`)(D);
  return { ...api, D, records, sessions, warnings, logs, fetchBundle, legacy };
}

async function fixture(pq = false) {
  const alice = await ratchet.genRatchetKey(), bob = await ratchet.genRatchetKey();
  const spk = await ratchet.genRatchetKey(), ed = await ratchet.genSigningKey();
  const bundle = { identityKey: b64(bob.pub), edIdentityKey: b64(ed.pub), signedPreKey: b64(spk.pub),
    signedPreKeySig: b64(await ratchet.signSPK(ed.privateKey, new Uint8Array(spk.pub))), caps: ['x3dh-v5'] };
  let kem;
  if (pq) {
    globalThis.__breezePQXDH = createPQSessionHelper();
    kem = await mintPQPreKey();
    bundle.pqPreKey = b64(kem.publicKey);
    bundle.pqPreKeySig = b64(await ratchet.signSPK(ed.privateKey, kem.publicKey));
    bundle.caps.push('pqxdh');
  }
  const contact = key => ({ id: b64(key.pub).slice(0, 12), pubB64: b64(key.pub), name: 'Contact' });
  return { alice, bob, spk, bundle, kem, aContact: contact(alice), bContact: contact(bob) };
}

describe('deployed bootstrap identity binding', () => {
  it.each([['identityKey', false], ['edIdentityKey', false], ['identityKey', true], ['edIdentityKey', true]])('rejects a different %s, injected=%s, without relay/legacy fallback', async (field, supplied) => {
    const f = await fixture();
    f.bContact.sigPub = f.bundle.edIdentityKey;
    f.bContact.home = [{ url: 'https://other-relay.test' }];
    const foreign = { ...f.bundle };
    if (field === 'identityKey') foreign.identityKey = b64(f.alice.pub);
    else f.bContact.sigPub = b64((await ratchet.genSigningKey()).pub);
    const w = await world({ keys: f.alice, contact: f.bContact,
      bundles: [foreign, f.bundle] });
    if (supplied) w.D.API = null;
    expect(supplied ? await w.initSessionV5Initiator(f.bContact.pubB64, foreign) : await w.encrypt('must not send', f.bContact.pubB64)).toBe(supplied ? false : null);
    expect(w.fetchBundle).toHaveBeenCalledTimes(supplied ? 0 : 1);
    expect(w.legacy).not.toHaveBeenCalled();
    expect(w.sessions.size).toBe(0);
    expect(w.D._seedRelayInfo).not.toHaveBeenCalled();
    expect(w.warnings[0][0]).toBe('identityBindingFailed');
    expect(w.logs.some(args => args.join(' ').includes('identity binding rejected'))).toBe(true);
  });

  it('pins the bundle signing key only after its SPK signature verifies', async () => {
    const f = await fixture();
    const invalid = { ...f.bundle, signedPreKeySig: b64(new Uint8Array(64)) };
    const w = await world({ keys: f.alice, contact: f.bContact, bundles: [invalid] });
    expect(await w.initSessionV5Initiator(f.bContact.pubB64)).toBeNull();
    expect(w.records.contacts.get(f.bContact.id).sigPub).toBeUndefined();
    const valid = await world({ keys: f.alice, contact: f.bContact, bundles: [f.bundle] });
    expect(await valid.initSessionV5Initiator(f.bContact.pubB64)).toBeTruthy();
    expect(valid.records.contacts.get(f.bContact.id).sigPub).toBe(f.bundle.edIdentityKey);
  });

  it('preserves the absent-bundle result without inventing an identity failure', async () => {
    const f = await fixture();
    const w = await world({ keys: f.alice, contact: f.bContact });
    expect(await w.initSessionV5Initiator(f.bContact.pubB64)).toBeNull();
    expect(w.warnings).toEqual([]);
  });

  it.each([false, true])('valid injected classical/PQ=%s bootstrap works without API access', async pq => {
    const f = await fixture(pq);
    f.bContact.sigPub = f.bundle.edIdentityKey;
    const a = await world({ keys: f.alice, contact: f.bContact, pq });
    const b = await world({ keys: f.bob, contact: f.aContact, spk: f.spk, pqSeed: f.kem?.seed, pq });
    a.D.API = null;
    const sess = await a.initSessionV5Initiator(f.bContact.pubB64, f.bundle);
    expect(sess).toBeTruthy();
    a.sessions.set(f.bContact.id, sess);
    const wire = await a.encrypt('injected', f.bContact.pubB64);
    expect(JSON.parse(wire).pqct !== undefined).toBe(pq);
    expect(await b.decrypt(wire, f.aContact.pubB64)).toBe('injected');
    expect(a.fetchBundle).not.toHaveBeenCalled();
    expect(a.legacy).not.toHaveBeenCalled();
    expect(a.warnings).toEqual([]);
  });

  it.each([false, true])('valid classical/PQ=%s first messages and established sessions still decrypt', async pq => {
    const f = await fixture(pq);
    const a = await world({ keys: f.alice, contact: f.bContact, bundles: [f.bundle], pq });
    const b = await world({ keys: f.bob, contact: f.aContact, spk: f.spk, pqSeed: f.kem?.seed, pq });
    const first = await a.encrypt('first', f.bContact.pubB64);
    expect(JSON.parse(first).pqct !== undefined).toBe(pq);
    expect(await b.decrypt(first, f.aContact.pubB64)).toBe('first');
    const established = b.sessions.get(f.aContact.id);
    const stranger = await world({ contact: f.bContact, bundles: [f.bundle], pq });
    const foreign = await stranger.encrypt('not Alice', f.bContact.pubB64);
    expect(await b.decrypt(foreign, f.aContact.pubB64)).toBeNull();
    expect(b.sessions.get(f.aContact.id)).toBe(established);
    const second = await a.encrypt('second', f.bContact.pubB64);
    expect(await b.decrypt(second, f.aContact.pubB64)).toBe('second');
    expect(a.fetchBundle).toHaveBeenCalledTimes(1);
    expect(b.warnings).toEqual([]);
  });

  it.each([false, true])('drops foreign first-message identity through forwarding=%s without saving session/message', async forwarded => {
    const f = await fixture();
    const claimed = await ratchet.genRatchetKey();
    const contact = { id: b64(claimed.pub).slice(0, 12), pubB64: b64(claimed.pub), name: 'Claimed' };
    const a = await world({ keys: f.alice, contact: f.bContact, bundles: [f.bundle] });
    const b = await world({ keys: f.bob, contact, spk: f.spk });
    const payload = await a.encrypt('foreign identity', f.bContact.pubB64);
    const msg = { from: contact.id, fromPub: contact.pubB64, payload, ts: 123 };
    if (forwarded) await b.forward({ ...msg, type: 'peer_relay_deliver' });
    else await b.handleIncoming(msg);
    expect(b.sessions.size).toBe(0);
    expect(b.D.saveSession).not.toHaveBeenCalled();
    expect(b.records.messages.size).toBe(0);
    expect(b.legacy).not.toHaveBeenCalled();
    expect(b.warnings[0][0]).toBe('identityBindingFailed');
  });

  it('allows a correctly attributed forwarded first message', async () => {
    const f = await fixture();
    const a = await world({ keys: f.alice, contact: f.bContact, bundles: [f.bundle] });
    const b = await world({ keys: f.bob, contact: f.aContact, spk: f.spk });
    await b.forward({ type: 'peer_relay_deliver', from: f.aContact.id, ts: 123,
      payload: await a.encrypt('forwarded', f.bContact.pubB64) });
    expect(b.records.messages.get(f.aContact.id + ':123').text).toBe('forwarded');
  });

  it.each([false, null, true])('incoming text pins a first signing key only on true verification, not %s', async verified => {
    const f = await fixture();
    const w = await world({ contact: f.aContact });
    w.D.verifySignature.mockResolvedValue(verified);
    const msg = { from: f.aContact.id, fromPub: f.aContact.pubB64, payload: 'not-used', ts: 123,
      sig: 'signature', sigPub: 'signing-key' };
    const textSource = slice('      // v3.3: Verify Ed25519 signature if present.', "      await dbPut('messages', { msgId, contactId, text, mine: false");
    await new Function('D', 'msg', 'contact', `with(D) { return (async () => {
      // _frank mirrors the production local declared just above the slice
      // (const _frank = {} before decryptFrom); the D08 AMF check inside the
      // sliced region reads it. Empty = this message carries no franking tag.
      const text = 'signed text', meta = {}, _attribPub = null, contactId = contact.id, _frank = {};
      ${textSource}
    })(); }`)(w.D, msg, w.records.contacts.get(f.aContact.id));
    expect(w.records.contacts.get(f.aContact.id).sigPub).toBe(verified === true ? 'signing-key' : undefined);
  });
});
