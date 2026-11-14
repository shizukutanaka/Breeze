// Stage-2 step 6 (2026-11-14): contacts' home relays + redundant
// deposit (docs/RELAY_STAGE2_PLAN.md Step 6).
//
// Surfaces pinned here:
//  1. The worker half of the home hint: /prekey/upload stores a
//     sanitized `home` list on the bundle; /prekey/fetch (whole
//     bundle) and /prekey/status (no OTP spent) serve it back; an
//     upload without one keeps the pre-step-6 bundle shape. The hint
//     is NOT part of the signed upload digest — proven by reusing one
//     signature across two uploads whose home differs.
//  2. The plan's open question, settled against src/crypto/ratchet.js
//     (the deployed mirror's reference): an exact-duplicate
//     ciphertext decrypts once; the second decrypt returns null and
//     the session is undamaged (the next message still decrypts).
//     Together with the client's pre-decrypt dedup (msgId against the
//     persistent store), this is what makes per-copy ACKs safe.
//  3. The client fan-out (extracted from index.html): targets resolve
//     stored home → bundle hint, the 'multi-relay' cap gates the
//     count (legacy peers get their first home only; no home info at
//     all keeps the verbatim legacy path), every copy is the SAME
//     wire bytes, a pin mismatch skips a relay silently, a keyless
//     relay still receives sealed copies, an owed copy rides the
//     retry queue with its wire bytes, and one relay's
//     MAILBOX_RATE_LIMITED defers only its own copy.
//  4. The carriers: addContact's hint rules, resolveAndAdd's URL
//     origin, the contact-settings ceremony, and the bundle's own
//     caps + home advertisement.
//  5. Signal fan-out + merged poll, the recipient-side interleave
//     (identical copies on two relays, one store, both queues ACKed
//     dry), and prekey fetch trying a contact's relays in order.
//  6. The plan's done-when as live drills against two relay
//     PROCESSES (server/index.js children — separate processes
//     because the worker's send-dedup map is isolate-global, so two
//     in-process instances would dedup a fan-out's second copy
//     against the first; real relays never share that map):
//     a conversation continues via the second relay after the first
//     is killed mid-conversation, and a new session is established
//     from the surviving relay's bundle copy after the primary's
//     volume is destroyed.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import worker, { mailboxStore } from '../_worker.js';
import { makeEnv } from './helpers/mockKV.js';
import { makeDOEnv } from './helpers/mockDO.js';
import { REPO_ROOT } from '../server/node-host.js';
import { loadOrCreateRelayIdentity, relayFingerprint } from '../server/relay-identity.js';
import { createRatchet } from '../src/crypto/ratchet.js';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const ORIGIN = 'https://relay-a.test';
const API = ORIGIN + '/api';
const B_ORIGIN = 'https://relay-b.test';
const B_API = B_ORIGIN + '/api';
const C_ORIGIN = 'https://relay-c.test';
const C_API = C_ORIGIN + '/api';
const ME_ID = 'aliceUser001';
const ME_PUB = ME_ID + 'PUBKEYxxxx';
const PEER_ID = 'bobUser00001';
const PEER_PUB = PEER_ID + 'PUBKEYxxxx';
const flush = () => new Promise((r) => setTimeout(r, 30));
const MS = { MIN: 60000, HOUR: 3600000, DAY: 86400000 };
const CONFIG = { X3DH_V5_ENABLED: true, GROUP_RATCHET_V5: true, SEAL_V2_ENABLED: true, MULTI_RELAY_ENABLED: true, PREKEY_OTP_COUNT: 3 };

beforeEach(() => {
  globalThis._rateLimitMap = new Map();
  globalThis._presenceCache = new Map();
  globalThis._msgDedup = new Map();
  globalThis._sealedDedup = new Map();
  globalThis._queueAuthKey = new Map();
});

function freshIdentity() {
  const db = new DatabaseSync(':memory:');
  const id = loadOrCreateRelayIdentity(db);
  db.close();
  return id;
}
const envWith = (id, extra = {}) => makeEnv({
  RELAY_PUBLIC_KEY: id.publicKey, RELAY_PRIVATE_KEY: id.privateKey, ...extra,
});

// ─── Extraction harness (the step-4/5 pattern) ───────────────────
function sliceBetween(startMarker, endMarker) {
  const start = INDEX.indexOf(startMarker);
  const end = INDEX.indexOf(endMarker);
  expect(start, `marker ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `marker ${endMarker}`).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

function makeFetchT(routes) {
  const log = [];
  // The worker's send-dedup maps are isolate-global; two in-process
  // instances would share them and dedup a fan-out's second copy
  // against its first. Each route therefore gets its OWN maps,
  // swapped in for the duration of its calls — the separate-isolate
  // reality of real relays. (Fan-out deposits are sequential, so the
  // swap never races within this suite.)
  const routeState = new Map();
  const fetchT = async (url, opts) => {
    log.push({ url, method: opts?.method || 'GET', body: opts?.body });
    const route = routes.find((r) => url.startsWith(r.prefix));
    if (!route) throw new Error('no route for ' + url);
    if (route.down) throw new Error('network down');
    if (route.fail500) return new Response('boom', { status: 500 });
    if (route.real) return fetch(url, opts);
    let st = routeState.get(route);
    if (!st) { st = { sealed: new Map(), msg: new Map() }; routeState.set(route, st); }
    const prevSealed = globalThis._sealedDedup;
    const prevMsg = globalThis._msgDedup;
    globalThis._sealedDedup = st.sealed;
    globalThis._msgDedup = st.msg;
    try {
      if (opts?.method === 'POST') {
        return await worker.fetch(new Request(url, {
          method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' }, body: opts.body,
        }), route.env);
      }
      return await worker.fetch(new Request(url), route.env);
    } finally {
      st.sealed = globalThis._sealedDedup; // the worker prunes by replacing the map
      st.msg = globalThis._msgDedup;
      globalThis._sealedDedup = prevSealed;
      globalThis._msgDedup = prevMsg;
    }
  };
  return { fetchT, log };
}

// One extracted "world": the step-4/5 relay machinery, the step-6
// block + relaySend + scheduleRetry, the signal pair, the contact
// carriers, the bundle builder and the X3DH initiator, sharing one
// in-memory IDB and one settings object.
function buildWorld({ fetchT, settings = {}, origin = ORIGIN, api = API, stubs = {} }) {
  const calls = { toasts: [], announces: [], audits: [], saveSettings: 0, closedWs: [], delivered: [], retrySaves: 0 };
  const stores = { contacts: new Map(), identity: new Map(), settings: new Map() };
  const dbGet = async (store, key) => {
    const s = stores[store];
    if (!s) return null;
    const v = s.get(key);
    return v === undefined ? null : v;
  };
  const dbPut = async (store, value, key) => {
    const s = stores[store];
    if (s) s.set(key ?? value?.id ?? value?.key, value);
  };
  const gateFn = new Function('API', '_H', 'fetchT',
    `${sliceBetween('const _relayPinGate', '// ═══ Title helper')}
     return { _relayPinGate, postAPIRaw };`);
  const gate = gateFn(api, { 'Content-Type': 'application/json' }, fetchT);
  const verifyFn = new Function('_hasEd25519', '_dbg',
    `${sliceBetween('async function verifySignature', '// ===== Server health check =====')}
     return verifySignature;`);
  const verifySignature = verifyFn(true, () => {});
  let capturedTimer = null;
  const worldFn = new Function(
    'API', '_H', 'fetchT', 'postAPIRaw', 'verifySignature', '_settings', 'saveSettings',
    'showToast', 'announceToSR', 'auditLog', '_dbg', 't', '_relayPinGate',
    'location', '_closeRelayWs', 'showPrompt', 'showConfirm', 'authFields', 'myId', 'myPubB64',
    'checkAndReplenishPreKeys', 'maybeStartMailboxWs', 'MS', 'CONFIG', 'dbGet', 'dbPut',
    'renderContacts', '_signalAuth', '_auditKeyHistory', '_auditKeyTransparency',
    'showKeyChangeWarning', 'genRatchetKey', '_x3dhInitiator', 'ecdhBits', 'hkdf', 'myKeys',
    '_hasEd25519', '_signingKey', '_signingPubB64', 'updateMsgStatus', 'registerBackgroundSync',
    '_updateOutboxBadge', 'setTimeout', '_peerSealV2', '_saveRetryQueue',
    `let _retryTimer = null;
     const _retryQueue = [];
     const _isOffline = false;
     ${sliceBetween('const CAPS_X3DH_V5', 'function _negotiateGroupCaps')}
     ${sliceBetween('// ===== Relay identity pin (stage-2 step 4) =====', '// v3.6: Proactive storage quota check')}
     ${sliceBetween('// Stage-2 step 6: contacts', 'function scheduleRetry()')}
     ${sliceBetween('function scheduleRetry()', 'function _updateOutboxBadge')}
     ${sliceBetween('function _signal(room, type, data)', '// DRY: DM room key')}
     ${sliceBetween('async function addContact', '// v3.1: Chat folder filtering')}
     ${sliceBetween('async function resolveAndAdd', '// PRESENCE POLLING')}
     ${sliceBetween('async function generatePreKeyBundle', 'async function createIdentity')}
     ${sliceBetween('async function initSessionV5Initiator', '// Derive the X3DH root key from a pkm envelope')}
     return { homeRelays, isOriginRelay, relayApiBase, postAPIRelay, _relayBlockedUrls, _pollCursorByUrl,
       sanitizeHomeList, _fanoutCount, _resolveSendTargets, _depositCopy, _buildWire, relaySend,
       _signal, _signalAwait, _signalPeerId, addContact, _setContactHomeFlow, resolveAndAdd,
       generatePreKeyBundle, initSessionV5Initiator, _retryQueue, relayFingerprint };`);
  const world = worldFn(
    api, { 'Content-Type': 'application/json' }, fetchT, gate.postAPIRaw, verifySignature, settings,
    async () => { calls.saveSettings++; },
    (text, type) => { calls.toasts.push({ text, type }); },
    (text) => { calls.announces.push(text); },
    (kind, msg) => { calls.audits.push({ kind, msg }); },
    () => {},
    (key, ...args) => key + (args.length ? ':' + args.join(',') : ''),
    gate._relayPinGate,
    { origin },
    (url) => { calls.closedWs.push(url); },
    stubs.showPrompt || (async () => null),
    stubs.showConfirm || (async () => false),
    stubs.authFields || (async (fn) => { const ts = Date.now(); return { ts, sig: 'sig:' + fn(ts) }; }),
    ME_ID, ME_PUB,
    () => {}, () => {},
    MS, CONFIG, dbGet, dbPut,
    () => {},
    stubs._signalAuth || (async () => ({})),
    async () => ({ verdict: 'ok' }),
    async () => ({ verdict: 'ok' }),
    () => {},
    async () => ({ privateKey: {}, pub: new Uint8Array(32) }),
    async () => new Uint8Array(32),
    async () => new Uint8Array(32),
    async () => new Uint8Array(64),
    { privateKey: {} },
    true, null, '',
    (ts, status) => { calls.delivered.push({ ts, status }); },
    () => {},
    () => {},
    (fn) => { capturedTimer = fn; return 1; },
    async () => false,
    () => { calls.retrySaves++; },
  );
  return {
    ...world, gate: gate._relayPinGate, postAPIRaw: gate.postAPIRaw, settings, calls, stores,
    fireRetry: async () => { const fn = capturedTimer; capturedTimer = null; if (fn) await fn(); },
    setContact: (rec) => stores.contacts.set(rec.id, rec),
  };
}

// The recipient poll, extracted exactly as in the step-5 suite.
function buildPoll(world, { handleIncoming, myId = ME_ID, api = API }) {
  const pollFn = new Function(
    'postAPIRelay', 'homeRelays', '_pollCursorByUrl', 'queueAuth', 'handleIncoming',
    'myId', '_isOffline', 'API', 'window', '_dbg', 'showToast', 't', 'unsealMeta',
    'myKeys', 'checkAndReplenishPreKeys', 'MS',
    `${sliceBetween('let _pollTimer = null;', 'function schedulePoll')}
     return { pollOnce };`);
  return pollFn(
    world.postAPIRelay, world.homeRelays, world._pollCursorByUrl,
    async () => ({}), handleIncoming, myId, false, api,
    { _plainDepLogged: 0 }, () => {},
    () => {}, (key, ...args) => key + (args.length ? ':' + args.join(',') : ''),
    async () => null, { privateKey: null }, () => {},
    { DAY: 86400000, MIN: 60000 },
  );
}

const post = (env, base, p, body, ip = '203.0.113.9') => worker.fetch(new Request(base + p, {
  method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify(body),
}), env);
const uploadBundle = (env, base, body) => post(env, base, '/prekey/upload', body);
const sealedQueue = async (env, base, id = PEER_ID) => {
  const r = await post(env, base, '/sealed/poll', { id });
  return (await r.json()).messages || [];
};
// A bundle good enough for the worker's unsigned path (identityKey
// must start with the userId — the worker's binding rule).
const plainBundle = (caps, extra = {}) => ({
  userId: PEER_ID, identityKey: PEER_ID + 'IK', signedPreKey: 'SPK',
  oneTimePreKeys: ['o0', 'o1', 'o2'], caps, ...extra,
});
const payload = (ts, text = 'CT') => ({
  to: PEER_ID, from: ME_ID, fromPub: ME_PUB, fromName: 'Alice', payload: text, ts,
});

// ─── 1. Worker: the bundle home hint ─────────────────────────────
describe('worker — bundle home hint', () => {
  it('upload stores a sanitized hint; fetch and status serve it back', async () => {
    const env = makeEnv();
    const up = await uploadBundle(env, API, plainBundle(['x3dh-v5', 'multi-relay'], {
      home: [
        { url: 'https://relay-b.test/some/path?x=1', pin: 'pinB' }, // path dropped → origin
        { url: 'https://relay-b.test', pin: 'dupe' },               // duplicate origin dropped
        { url: 'ftp://relay-x.test', pin: 'no' },                   // non-http(s) dropped
        { url: 'https://relay-c.test' },                            // pin optional
        { url: 'https://relay-d.test', pin: 'third' },              // 3rd VALID entry — inside the cap
        { url: 'https://relay-e.test', pin: 'over-cap' },           // 4th valid entry — over the cap
      ],
    }));
    expect(up.status).toBe(200);
    const fetched = await (await post(env, API, '/prekey/fetch', { userId: PEER_ID })).json();
    expect(fetched.home).toEqual([
      { url: 'https://relay-b.test', pin: 'pinB' },
      { url: 'https://relay-c.test' },
      { url: 'https://relay-d.test', pin: 'third' },
    ]);
    const status = await (await post(env, API, '/prekey/status', { userId: PEER_ID })).json();
    expect(status.home).toEqual(fetched.home);
    expect(status.caps).toContain('multi-relay');
  });

  it('an upload without a hint keeps the pre-step-6 bundle shape', async () => {
    const env = makeEnv();
    await uploadBundle(env, API, plainBundle(['x3dh-v5']));
    const fetched = await (await post(env, API, '/prekey/fetch', { userId: PEER_ID })).json();
    expect(fetched.home).toBeUndefined();
    const status = await (await post(env, API, '/prekey/status', { userId: PEER_ID })).json();
    expect(status.home).toBeUndefined();
  });

  it('the hint is NOT in the signed upload digest (one signature, two different hints)', async () => {
    const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const edPub = new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey));
    const b64 = (u8) => Buffer.from(u8).toString('base64');
    const spkPub = crypto.getRandomValues(new Uint8Array(32));
    const spkSig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, spkPub));
    const body = {
      userId: PEER_ID, identityKey: PEER_ID + b64(crypto.getRandomValues(new Uint8Array(32))),
      edIdentityKey: b64(edPub), signedPreKey: b64(spkPub), signedPreKeySig: b64(spkSig),
      oneTimePreKeys: ['o0', 'o1'], caps: ['x3dh-v5', 'multi-relay'],
    };
    // The client's digest (prekeyUploadAuth's field list — no home).
    const digestBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([
      body.identityKey, body.edIdentityKey, body.signedPreKey, body.signedPreKeySig,
      body.oneTimePreKeys, body.caps, '',
    ])));
    const digest = Array.from(new Uint8Array(digestBuf)).slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
    const ts = Date.now();
    const sig = b64(new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey,
      new TextEncoder().encode(`breeze-prekey-upload:${PEER_ID}:${ts}:${digest}`))));
    const env = makeEnv();
    const first = await uploadBundle(env, API, { ...body, ts, sig, home: [{ url: B_ORIGIN, pin: 'p1' }] });
    expect(first.status).toBe(200);
    // Same ts + same signature, DIFFERENT home: verifies iff home is
    // outside the digest — and the new hint replaces the old.
    const second = await uploadBundle(env, API, { ...body, ts, sig, home: [{ url: C_ORIGIN, pin: 'p2' }] });
    expect(second.status).toBe(200);
    const status = await (await post(env, API, '/prekey/status', { userId: PEER_ID })).json();
    expect(status.home).toEqual([{ url: C_ORIGIN, pin: 'p2' }]);
  });
});

// ─── Worker: the sealed dedup key (a step-6 drill finding) ───────
describe('worker — sealed dedup must not eat distinct messages', () => {
  it('two distinct envelopes of equal length sharing a 32-byte head BOTH queue; identical bytes still dedup', async () => {
    const env = makeEnv();
    // The client's real wire shape: the head is routing metadata, so
    // same-length messages within the same hour share their first 32
    // bytes — the old prefix key dropped the second as a "duplicate".
    const e1 = JSON.stringify({ to: PEER_ID, ts: 1700000002001, payload: 'CIPHERTEXT-AAAA', sv: 2, se: 'SEALEDMETA1' });
    const e2 = JSON.stringify({ to: PEER_ID, ts: 1700000002002, payload: 'CIPHERTEXT-BBBB', sv: 2, se: 'SEALEDMETA2' });
    expect(e1.length).toBe(e2.length);
    expect(e1.slice(0, 32)).toBe(e2.slice(0, 32));
    await post(env, API, '/sealed/send', { to: PEER_ID, envelope: e1 });
    await post(env, API, '/sealed/send', { to: PEER_ID, envelope: e2 });
    const dup = await post(env, API, '/sealed/send', { to: PEER_ID, envelope: e1 });
    expect((await dup.json()).dedup).toBe(true); // a genuine retransmission still dedups
    expect(await sealedQueue(env, API)).toHaveLength(2);
  });
});

// ─── 2. The duplicate-ciphertext question, settled ───────────────
describe('ratchet — an exact duplicate of a ciphertext', () => {
  it('decrypts once; the copy returns null and the session is undamaged', async () => {
    const R = createRatchet();
    const chain = Array.from(crypto.getRandomValues(new Uint8Array(32)));
    const { sender, receiver } = R.pairFromSharedChain(chain);
    const ct1 = await R.ratchetEncrypt(sender, 'first');
    expect(await R.ratchetDecrypt(receiver, ct1)).toBe('first');
    // The fan-out's second copy of the SAME bytes arrives (from the
    // other relay): rejected as a replay, not decrypted twice.
    expect(await R.ratchetDecrypt(receiver, ct1)).toBeNull();
    // …and the session is not desynced by the attempt.
    const ct2 = await R.ratchetEncrypt(sender, 'second');
    expect(await R.ratchetDecrypt(receiver, ct2)).toBe('second');
    expect(receiver.recvCounter).toBe(2);
  });
});

// ─── 3. Client fan-out ───────────────────────────────────────────
describe('client — redundant deposit at the contact\u2019s home relays', () => {
  const twoRelayWorld = async ({ caps = ['x3dh-v5', 'multi-relay'], settings = {}, contactHome, bundleOn = 'A' } = {}) => {
    const idA = freshIdentity(); const idB = freshIdentity(); const idC = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB); const envC = envWith(idC);
    const routes = [
      { prefix: API, env: envA },
      { prefix: B_API, env: envB },
      { prefix: C_API, env: envC },
    ];
    const { fetchT, log } = makeFetchT(routes);
    const w = buildWorld({ fetchT, settings });
    // The contact's bundle (their caps + hint source) sits on one relay.
    const bundleEnv = bundleOn === 'A' ? envA : envB;
    const bundleBase = bundleOn === 'A' ? API : B_API;
    await uploadBundle(bundleEnv, bundleBase, plainBundle(caps));
    if (contactHome) w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home: contactHome(idA, idB, idC) });
    else w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob' });
    return { w, routes, log, envA, envB, envC, idA, idB, idC };
  };
  const sealedPosts = (log, prefix) => log.filter((x) => x.url === prefix + '/sealed/send');

  it('no home info anywhere: the legacy primary path runs, byte for byte', async () => {
    const { w, log, envB } = await twoRelayWorld({ contactHome: null });
    await w.relaySend(PEER_ID, payload(1700000000001), null);
    expect(sealedPosts(log, API)).toHaveLength(1);
    expect(sealedPosts(log, B_API)).toHaveLength(0);
    expect(sealedPosts(log, C_API)).toHaveLength(0);
    expect(await sealedQueue(envB, B_API)).toHaveLength(0);
    // Deposit marking still comes from the primary's ack, as before —
    // a relay ack proves the deposit, never the peer's receipt (D4 fix:
    // 'delivered' is reserved for the recipient device's own ack).
    expect(w.calls.delivered).toEqual([{ ts: 1700000000001, status: 'deposited' }]);
  });

  it('no contact record (a device id, a stranger): the bundle\u2019s hint is NOT chased — primary only', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const { fetchT, log } = makeFetchT([{ prefix: API, env: envA }, { prefix: B_API, env: envB }]);
    const w = buildWorld({ fetchT, settings: {} });
    // A bundle exists for the id (as a linked device's would) and it
    // advertises a home — but there is no CONTACT record, so the
    // send keeps the primary path exactly (self-sync is step 5's
    // funnel's business, not the contact funnel's).
    await uploadBundle(envA, API, plainBundle(['x3dh-v5', 'multi-relay'], {
      home: [{ url: B_ORIGIN, pin: idB.publicKey }],
    }));
    await w.relaySend(PEER_ID, payload(1700000000011), null);
    expect(sealedPosts(log, API)).toHaveLength(1);
    expect(sealedPosts(log, B_API)).toHaveLength(0);
  });

  it('multi-relay peer: the SAME wire bytes land at both homes; one ack marks delivery once', async () => {
    const { w, log, envB, envC } = await twoRelayWorld({
      contactHome: (a, b, c) => [{ url: B_ORIGIN, pin: b.publicKey }, { url: C_ORIGIN, pin: c.publicKey }],
    });
    await w.relaySend(PEER_ID, payload(1700000000002), null);
    const atB = sealedPosts(log, B_API);
    const atC = sealedPosts(log, C_API);
    expect(atB).toHaveLength(1);
    expect(atC).toHaveLength(1);
    expect(atB[0].body).toBe(atC[0].body); // identical sealed bytes — the fan-out's premise
    expect(sealedPosts(log, API)).toHaveLength(0); // the primary is not a target here
    expect(await sealedQueue(envB, B_API)).toHaveLength(1);
    expect(await sealedQueue(envC, C_API)).toHaveLength(1);
    expect(w.calls.delivered).toEqual([{ ts: 1700000000002, status: 'deposited' }]); // exactly once
  });

  it('legacy peer (no multi-relay cap): first home only', async () => {
    const { w, log } = await twoRelayWorld({
      caps: ['x3dh-v5'],
      contactHome: (a, b, c) => [{ url: B_ORIGIN, pin: b.publicKey }, { url: C_ORIGIN, pin: c.publicKey }],
    });
    await w.relaySend(PEER_ID, payload(1700000000003), null);
    expect(sealedPosts(log, B_API)).toHaveLength(1);
    expect(sealedPosts(log, C_API)).toHaveLength(0);
    expect(sealedPosts(log, API)).toHaveLength(0);
  });

  it('the fanout setting bounds the copies; homes bound it too', async () => {
    const one = await twoRelayWorld({
      settings: { fanout: 1 },
      contactHome: (a, b, c) => [{ url: B_ORIGIN, pin: b.publicKey }, { url: C_ORIGIN, pin: c.publicKey }],
    });
    await one.w.relaySend(PEER_ID, payload(1700000000004), null);
    expect(sealedPosts(one.log, B_API)).toHaveLength(1);
    expect(sealedPosts(one.log, C_API)).toHaveLength(0);

    const three = await twoRelayWorld({
      settings: { fanout: 3 },
      contactHome: (a, b, c) => [{ url: B_ORIGIN, pin: b.publicKey }, { url: C_ORIGIN, pin: c.publicKey }],
    });
    await three.w.relaySend(PEER_ID, payload(1700000000005), null);
    expect(sealedPosts(three.log, B_API)).toHaveLength(1);
    expect(sealedPosts(three.log, C_API)).toHaveLength(1); // only two homes exist
  });

  it('hint-only resolution: the bundle\u2019s advertised home receives the copy', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const { fetchT, log } = makeFetchT([{ prefix: API, env: envA }, { prefix: B_API, env: envB }]);
    const w = buildWorld({ fetchT, settings: {} });
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob' }); // no stored home
    await uploadBundle(envA, API, plainBundle(['x3dh-v5', 'multi-relay'], {
      home: [{ url: B_ORIGIN, pin: idB.publicKey }],
    }));
    await w.relaySend(PEER_ID, payload(1700000000006), null);
    expect(sealedPosts(log, B_API)).toHaveLength(1);
    expect(sealedPosts(log, API)).toHaveLength(0);
    // …and the hint was used, not persisted over the record.
    expect(w.stores.contacts.get(PEER_ID).home).toBeUndefined();
  });

  it('a pin mismatch skips that relay silently — no latch, no toast, no re-pin', async () => {
    const { w, log, envB, envC } = await twoRelayWorld({
      contactHome: (a, b, c) => [{ url: B_ORIGIN, pin: 'wrongPinwrongPin' }, { url: C_ORIGIN, pin: c.publicKey }],
    });
    await w.relaySend(PEER_ID, payload(1700000000007), null);
    expect(sealedPosts(log, B_API)).toHaveLength(0);
    expect(await sealedQueue(envB, B_API)).toHaveLength(0);
    expect(sealedPosts(log, C_API)).toHaveLength(1);
    expect(await sealedQueue(envC, C_API)).toHaveLength(1);
    expect(w._relayBlockedUrls.has(B_ORIGIN)).toBe(false); // MY relays' latch is not involved
    expect(w.calls.toasts).toEqual([]);
    expect(w.stores.contacts.get(PEER_ID).home[0].pin).toBe('wrongPinwrongPin'); // untouched
    expect(w._retryQueue).toHaveLength(0); // withheld, not owed — retry cannot cure a key substitution
  });

  it('a keyless relay still receives sealed copies (legacy relay, availability wins)', async () => {
    const idA = freshIdentity();
    const envA = envWith(idA); const envB = makeEnv(); // B has no identity at all
    const { fetchT, log } = makeFetchT([{ prefix: API, env: envA }, { prefix: B_API, env: envB }]);
    const w = buildWorld({ fetchT, settings: {} });
    await uploadBundle(envA, API, plainBundle(['x3dh-v5', 'multi-relay']));
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home: [{ url: B_ORIGIN, pin: '' }] });
    await w.relaySend(PEER_ID, payload(1700000000008), null);
    expect(sealedPosts(log, B_API)).toHaveLength(1);
    expect(await sealedQueue(envB, B_API)).toHaveLength(1);
  });

  it('an owed copy rides the retry queue with its wire bytes and lands identically', async () => {
    const { w, routes, envB, envC } = await twoRelayWorld({
      contactHome: (a, b, c) => [{ url: B_ORIGIN, pin: b.publicKey }, { url: C_ORIGIN, pin: c.publicKey }],
    });
    routes[2].down = true; // C unreachable for the first attempt
    await w.relaySend(PEER_ID, payload(1700000000009), null);
    expect(await sealedQueue(envB, B_API)).toHaveLength(1);
    expect(w._retryQueue).toHaveLength(1);
    const item = w._retryQueue[0];
    expect(item.relays.map((r) => r.url)).toEqual([C_ORIGIN]);
    expect(typeof item.wire).toBe('string');
    // The queued item survives the persistence round-trip shape.
    const restored = { ...JSON.parse(JSON.stringify(item)) };
    expect(restored.wire).toBe(item.wire);
    expect(restored.relays).toEqual(item.relays);
    routes[2].down = false;
    await w.fireRetry();
    expect(w._retryQueue).toHaveLength(0);
    const atC = await sealedQueue(envC, C_API);
    expect(atC).toHaveLength(1);
    const atB = await sealedQueue(envB, B_API);
    expect(atC[0].envelope).toBe(atB[0].envelope); // the retried copy is the same bytes
  });

  it('one relay\u2019s MAILBOX_RATE_LIMITED defers only its own copy', async () => {
    const idA = freshIdentity(); const idB = freshIdentity(); const idC = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const envC = makeDOEnv({ MAILBOX_BACKEND: 'do', RELAY_PUBLIC_KEY: idC.publicKey, RELAY_PRIVATE_KEY: idC.privateKey });
    const { fetchT, log } = makeFetchT([
      { prefix: API, env: envA }, { prefix: B_API, env: envB }, { prefix: C_API, env: envC },
    ]);
    const w = buildWorld({ fetchT, settings: {} });
    await uploadBundle(envB, B_API, plainBundle(['x3dh-v5', 'multi-relay']));
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob',
      home: [{ url: B_ORIGIN, pin: idB.publicKey }, { url: C_ORIGIN, pin: idC.publicKey }] });
    // Fill C's sealed mailbox to the per-mailbox cap (120/min).
    const mb = mailboxStore(envC, 'sealed', PEER_ID);
    await mb.checkDeposit();
    const now = Date.now();
    envC.MAILBOX_DO.instances.get(PEER_ID).state.storage.map.set('deposits',
      Array.from({ length: 120 }, (_, i) => now - 59000 + i * 400));
    await w.relaySend(PEER_ID, payload(1700000000010), null);
    expect(sealedPosts(log, B_API)).toHaveLength(1); // B unaffected
    expect(w.calls.delivered).toEqual([{ ts: 1700000000010, status: 'deposited' }]); // B's ack counts (as a deposit)
    expect(w._retryQueue).toHaveLength(1);
    expect(w._retryQueue[0].relays.map((r) => r.url)).toEqual([C_ORIGIN]); // only C is owed
  });
});

// ─── 4. The carriers ─────────────────────────────────────────────
describe('client — home carriers', () => {
  const bareWorld = () => {
    const idA = freshIdentity();
    const { fetchT } = makeFetchT([{ prefix: API, env: envWith(idA) }, { prefix: B_API, env: envWith(freshIdentity()) }]);
    return buildWorld({ fetchT, settings: {} });
  };

  it('addContact stores the carrier\u2019s hint; an existing home is never overwritten by a later carrier', async () => {
    const w = bareWorld();
    await w.addContact(PEER_PUB, 'Bob', [{ url: B_ORIGIN }]);
    expect(w.stores.contacts.get(PEER_ID).home).toEqual([{ url: B_ORIGIN, pin: '' }]);
    await w.addContact(PEER_PUB, 'Bob', [{ url: C_ORIGIN }]); // second carrier loses
    expect(w.stores.contacts.get(PEER_ID).home).toEqual([{ url: B_ORIGIN, pin: '' }]);
    // A home-less record adopts a later hint.
    const OTHER_PUB = 'carolUser001' + 'PUBKEYxxxx';
    await w.addContact(OTHER_PUB, 'Carol');
    expect(w.stores.contacts.get('carolUser001').home).toBeUndefined();
    await w.addContact(OTHER_PUB, 'Carol', [{ url: C_ORIGIN, pin: 'pc' }]);
    expect(w.stores.contacts.get('carolUser001').home).toEqual([{ url: C_ORIGIN, pin: 'pc' }]);
  });

  it('resolveAndAdd stores a pasted invite URL\u2019s origin; a bare key stores nothing', async () => {
    const w = bareWorld();
    await w.resolveAndAdd('https://relay-b.test/?add=' + PEER_PUB + '&name=Bob');
    expect(w.stores.contacts.get(PEER_ID).home).toEqual([{ url: B_ORIGIN, pin: '' }]);
    const OTHER_PUB = 'daveUser0001' + 'PUBKEYxxxx';
    await w.resolveAndAdd(OTHER_PUB);
    expect(w.stores.contacts.get('daveUser0001').home).toBeUndefined();
  });

  it('the contact-settings ceremony: attested set stores the pin, blank clears, unreachable refuses', async () => {
    const idB = freshIdentity();
    const { fetchT } = makeFetchT([
      { prefix: API, env: envWith(freshIdentity()) },
      { prefix: B_API, env: envWith(idB) },
    ]);
    const contact = { id: PEER_ID, pubB64: PEER_PUB, name: 'Bob' };
    const yes = buildWorld({ fetchT, settings: {}, stubs: {
      showPrompt: async () => B_ORIGIN, showConfirm: async () => true } });
    yes.setContact(contact);
    await yes._setContactHomeFlow(contact);
    expect(contact.home).toEqual([{ url: B_ORIGIN, pin: idB.publicKey }]); // attested key pinned
    expect(yes.calls.audits.some((a) => a.msg.includes('Home relay set'))).toBe(true);

    const clearer = buildWorld({ fetchT, settings: {}, stubs: {
      showPrompt: async () => '', showConfirm: async () => true } });
    const withHome = { id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home: [{ url: B_ORIGIN, pin: idB.publicKey }] };
    clearer.setContact(withHome);
    await clearer._setContactHomeFlow(withHome);
    expect(withHome.home).toBeUndefined();

    const down = buildWorld({ fetchT, settings: {}, stubs: {
      showPrompt: async () => 'https://down-relay.test', showConfirm: async () => true } });
    const untouched = { id: PEER_ID, pubB64: PEER_PUB, name: 'Bob' };
    down.setContact(untouched);
    await down._setContactHomeFlow(untouched);
    expect(untouched.home).toBeUndefined();
    expect(down.calls.toasts.some((x) => x.text === 'relayAddUnreachable')).toBe(true);
  });

  it('generatePreKeyBundle advertises multi-relay and carries the home hint', async () => {
    const idB = freshIdentity();
    const { fetchT } = makeFetchT([
      { prefix: API, env: envWith(freshIdentity()) },
      { prefix: B_API, env: envWith(idB) },
    ]);
    const w = buildWorld({ fetchT, settings: { relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] } });
    const bundle = await w.generatePreKeyBundle();
    expect(bundle.caps).toContain('multi-relay');
    expect(bundle.home).toEqual([
      { url: ORIGIN }, // the serving origin, pinless here (no relayPin set)
      { url: B_ORIGIN, pin: idB.publicKey },
    ]);
    const solo = buildWorld({ fetchT, settings: {} });
    const soloBundle = await solo.generatePreKeyBundle();
    expect(soloBundle.home).toEqual([{ url: ORIGIN }]); // a one-relay account still names its home
  });
});

// ─── 5. Signal fan-out + merged poll ─────────────────────────────
describe('client — signal rendezvous across the peer\u2019s relays', () => {
  const room = 'dm:' + [ME_ID, PEER_ID].sort().join(':');
  const setup = async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const { fetchT, log } = makeFetchT([{ prefix: API, env: envA }, { prefix: B_API, env: envB }]);
    const w = buildWorld({ fetchT, settings: {} });
    await uploadBundle(envA, API, plainBundle(['x3dh-v5', 'multi-relay']));
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home: [{ url: B_ORIGIN, pin: idB.publicKey }] });
    return { w, envA, envB, log };
  };
  const pollAsPeer = (env, base) => post(env, base, '/signal', { room, sender: PEER_ID, type: 'poll', data: '' });

  it('_signal deposits at the peer\u2019s home relay as well as the primary', async () => {
    const { w, envA, envB } = await setup();
    await w._signal(room, 'offer', 'SDP-OFFER-1');
    await flush();
    const atA = await (await pollAsPeer(envA, API)).json();
    const atB = await (await pollAsPeer(envB, B_API)).json();
    expect(atA.messages.map((m) => m.data)).toEqual(['SDP-OFFER-1']);
    expect(atB.messages.map((m) => m.data)).toEqual(['SDP-OFFER-1']);
  });

  it('_signalAwait poll merges both relays and dedups the identical signal', async () => {
    const { w, envA, envB } = await setup();
    // The peer's client deposited the same signed signal at both relays.
    const body = { room, sender: PEER_ID, type: 'answer', data: 'SDP-ANSWER-1' };
    await post(envA, API, '/signal', body);
    await post(envB, B_API, '/signal', body);
    const resp = await w._signalAwait(room, 'poll', '');
    const merged = await resp.json();
    expect(merged.messages).toHaveLength(1);
    expect(merged.messages[0].data).toBe('SDP-ANSWER-1');
  });
});

// ─── Recipient interleave: identical copies, one store ───────────
describe('recipient — poll interleave of identical copies', () => {
  it('stores once, ACKs both queues dry, and a second-relay-only message still arrives', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const routes = [{ prefix: API, env: envA }, { prefix: B_API, env: envB }];
    const { fetchT } = makeFetchT(routes);
    // BOB, homed on A (origin) + B (added, pinned).
    const bob = buildWorld({ fetchT, settings: { relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] } });
    // The dedup contract of the real handleIncoming, replicated:
    // existence is checked BEFORE any decryption, keyed by
    // `${from}:${ts}` — identical across the fan-out's copies.
    const stored = new Map();
    const delivered = [];
    const handleIncoming = async (env) => {
      const msgId = env.from + ':' + env.ts;
      if (stored.has(msgId)) return;
      stored.set(msgId, env);
      delivered.push(env.payload);
    };
    const poll = buildPoll(bob, { handleIncoming, myId: PEER_ID });
    // The SAME envelope bytes deposited at both relays. (The dedup
    // map reset between deposits models reality: it is isolate-global
    // in-process, per-process on real relays.)
    const envelope = JSON.stringify({ to: PEER_ID, from: ME_ID, ts: 1700000001000, payload: 'CT-SAME' });
    await post(envA, API, '/sealed/send', { to: PEER_ID, envelope });
    globalThis._sealedDedup = new Map();
    await post(envB, B_API, '/sealed/send', { to: PEER_ID, envelope });
    globalThis._sealedDedup = new Map();
    await post(envB, B_API, '/sealed/send', { to: PEER_ID, envelope: JSON.stringify({ to: PEER_ID, from: ME_ID, ts: 1700000001001, payload: 'CT-B-ONLY' }) });
    await poll.pollOnce();
    await flush();
    expect(delivered).toEqual(['CT-SAME', 'CT-B-ONLY']); // the duplicate stored exactly once
    expect(await sealedQueue(envA, API)).toHaveLength(0); // ACKed dry
    expect(await sealedQueue(envB, B_API)).toHaveLength(0);
  });
});

// ─── Prekey fetch across a contact's relays ──────────────────────
describe('client — prekey fetch tries the contact\u2019s relays in order', () => {
  const makeSignedBundle = async ({ badSig = false } = {}) => {
    const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
    const edPub = new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey));
    const b64 = (u8) => Buffer.from(u8).toString('base64');
    const spkPub = crypto.getRandomValues(new Uint8Array(32));
    const signer = badSig
      ? (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])).privateKey
      : ed.privateKey;
    const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, signer, spkPub));
    return {
      userId: PEER_ID, identityKey: PEER_ID + b64(crypto.getRandomValues(new Uint8Array(32))),
      edIdentityKey: b64(edPub), signedPreKey: b64(spkPub), signedPreKeySig: b64(sig),
      oneTimePreKeys: Array.from({ length: 10 }, (_, i) => 'otp' + i),
      caps: ['x3dh-v5', 'multi-relay'],
    };
  };
  const plantBundle = async (env, bundle) => {
    // Direct KV planting models a relay whose stored copy is stale or
    // hostile (an upload path would reject a bad SPK signature).
    await env.KV.put('prekey:' + PEER_ID, JSON.stringify({ ...bundle, uploadedAt: Date.now() }));
    await env.KV.put('prekey:otp:' + PEER_ID + ':count', '10');
    for (let i = 0; i < 10; i++) await env.KV.put('prekey:otp:' + PEER_ID + ':' + i, 'otp' + i);
  };
  const otpCount = async (env, base) => (await (await post(env, base, '/prekey/status', { userId: PEER_ID })).json()).otpCount;

  it('a copy that fails SPK verification falls through to the next relay\u2019s valid copy', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const { fetchT, log } = makeFetchT([{ prefix: API, env: envA }, { prefix: B_API, env: envB }]);
    const w = buildWorld({ fetchT, settings: {} });
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob',
      home: [{ url: B_ORIGIN, pin: idB.publicKey }, { url: ORIGIN, pin: '' }] });
    await plantBundle(envB, await makeSignedBundle({ badSig: true }));
    await uploadBundle(envA, API, await makeSignedBundle());
    const session = await w.initSessionV5Initiator(PEER_PUB);
    expect(session).toBeTruthy();
    const fetches = log.filter((x) => x.url.endsWith('/prekey/fetch')).map((x) => x.url);
    expect(fetches).toEqual([B_API + '/prekey/fetch', API + '/prekey/fetch']); // B tried first, A won
  });

  it('an unreachable first relay spends nothing; the survivor\u2019s OTP is the one consumed', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const routes = [{ prefix: API, env: envA }, { prefix: B_API, env: envB, down: true }];
    const { fetchT } = makeFetchT(routes);
    const w = buildWorld({ fetchT, settings: {} });
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob',
      home: [{ url: B_ORIGIN, pin: idB.publicKey }, { url: ORIGIN, pin: '' }] });
    await uploadBundle(envA, API, await makeSignedBundle());
    await plantBundle(envB, await makeSignedBundle());
    const session = await w.initSessionV5Initiator(PEER_PUB);
    expect(session).toBeTruthy();
    expect(await otpCount(envA, API)).toBe(9);
    expect(await otpCount(envB, B_API)).toBe(10); // never reached, nothing spent
  });
});

// ─── 6. Live drills — two relay PROCESSES ────────────────────────
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });
}
function startRelay(dbPath, port) {
  return spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', BREEZE_DB_PATH: dbPath },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
async function waitHealth(base, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(base + '/api/health');
      if (r.ok) return await r.json();
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('relay did not come up: ' + base);
}
const stopRelay = (child) => new Promise((resolve) => {
  if (!child || child.exitCode !== null) return resolve();
  child.once('exit', () => resolve());
  child.kill('SIGKILL');
  setTimeout(resolve, 2000).unref();
});
const httpPost = async (base, p, body) => {
  const r = await fetch(base + '/api' + p, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
};
// A real, verifiable bundle for BOB (the fetch drill checks the SPK
// signature for real; only the session derivation is stubbed in the
// extracted initiator, as in the in-process fetch tests).
async function makeBobBundle(home) {
  const ed = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const edPub = new Uint8Array(await crypto.subtle.exportKey('raw', ed.publicKey));
  const b64 = (u8) => Buffer.from(u8).toString('base64');
  const spkPub = crypto.getRandomValues(new Uint8Array(32));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, ed.privateKey, spkPub));
  return {
    userId: PEER_ID, identityKey: PEER_ID + b64(crypto.getRandomValues(new Uint8Array(32))),
    edIdentityKey: b64(edPub), signedPreKey: b64(spkPub), signedPreKeySig: b64(sig),
    oneTimePreKeys: Array.from({ length: 10 }, (_, i) => 'otp' + i),
    caps: ['x3dh-v5', 'seal-v2', 'group-v5', 'multi-relay'], home,
  };
}

describe('live drills — two relay processes', () => {
  it('done-when: the conversation continues via the second relay after the first is killed mid-conversation', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'breeze-step6-drill1-'));
    const [portA, portB] = [await freePort(), await freePort()];
    const baseA = `http://127.0.0.1:${portA}`;
    const baseB = `http://127.0.0.1:${portB}`;
    const procA = startRelay(path.join(dir, 'a.db'), portA);
    const procB = startRelay(path.join(dir, 'b.db'), portB);
    try {
      const healthA = await waitHealth(baseA);
      const healthB = await waitHealth(baseB);
      const home = [{ url: baseA, pin: healthA.relayKey }, { url: baseB, pin: healthB.relayKey }];
      // BOB is homed on both relays: the same bundle (with the hint) on each.
      const bobBundle = {
        userId: PEER_ID, identityKey: PEER_ID + 'IK', signedPreKey: 'SPK',
        oneTimePreKeys: ['o0', 'o1', 'o2'], caps: ['x3dh-v5', 'multi-relay'], home,
      };
      expect((await httpPost(baseA, '/prekey/upload', bobBundle)).status).toBe(200);
      expect((await httpPost(baseB, '/prekey/upload', bobBundle)).status).toBe(200);

      const aliceFetch = makeFetchT([{ prefix: baseA, real: true }, { prefix: baseB, real: true }]);
      const alice = buildWorld({ fetchT: aliceFetch.fetchT, settings: {}, origin: baseA, api: baseA + '/api' });
      alice.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home });
      const bobFetch = makeFetchT([{ prefix: baseA, real: true }, { prefix: baseB, real: true }]);
      const bob = buildWorld({ fetchT: bobFetch.fetchT, settings: { relays: [{ url: baseB, pin: healthB.relayKey, label: 'b' }] }, origin: baseA, api: baseA + '/api' });
      const stored = new Set();
      const delivered = [];
      const bobPoll = buildPoll(bob, {
        myId: PEER_ID, api: baseA + '/api',
        handleIncoming: async (env) => {
          const msgId = env.from + ':' + env.ts; // the client's pre-decrypt dedup key
          if (stored.has(msgId)) return;
          stored.add(msgId);
          delivered.push(env.payload);
        },
      });

      // Message 1: fanned out to BOTH of BOB's home relays, same bytes.
      await alice.relaySend(PEER_ID, { to: PEER_ID, from: ME_ID, fromPub: ME_PUB, payload: 'CT-ONE', ts: 1700000002001 }, null);
      const sends = aliceFetch.log.filter((x) => x.url.endsWith('/sealed/send'));
      expect(sends).toHaveLength(2);
      expect(sends[0].body).toBe(sends[1].body);
      await bobPoll.pollOnce();
      await flush();
      expect(delivered).toEqual(['CT-ONE']); // both copies arrived; stored once

      // The first relay dies mid-conversation.
      await stopRelay(procA);

      // Message 2: the dead relay's copy is owed to the retry queue;
      // the second relay delivers, and the conversation continues.
      await alice.relaySend(PEER_ID, { to: PEER_ID, from: ME_ID, fromPub: ME_PUB, payload: 'CT-TWO', ts: 1700000002002 }, null);
      expect(alice._retryQueue).toHaveLength(1);
      expect(alice._retryQueue[0].relays.map((r) => r.url)).toEqual([baseA]);
      await bobPoll.pollOnce();
      await flush();
      expect(delivered).toEqual(['CT-ONE', 'CT-TWO']); // no duplicates, nothing lost
    } finally {
      await stopRelay(procA);
      await stopRelay(procB);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('drill 2: primary volume destroyed — a new session starts from the surviving relay\u2019s bundle copy', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'breeze-step6-drill2-'));
    const [portA, portB] = [await freePort(), await freePort()];
    const baseA = `http://127.0.0.1:${portA}`;
    const baseB = `http://127.0.0.1:${portB}`;
    const dbA = path.join(dir, 'a.db');
    const procA = startRelay(dbA, portA);
    const procB = startRelay(path.join(dir, 'b.db'), portB);
    try {
      const healthA = await waitHealth(baseA);
      const healthB = await waitHealth(baseB);
      const home = [{ url: baseA, pin: healthA.relayKey }, { url: baseB, pin: healthB.relayKey }];
      const bundle = await makeBobBundle(home);
      expect((await httpPost(baseA, '/prekey/upload', bundle)).status).toBe(200);
      expect((await httpPost(baseB, '/prekey/upload', bundle)).status).toBe(200);
      expect((await httpPost(baseB, '/prekey/status', { userId: PEER_ID })).json.otpCount).toBe(10);

      // The primary's whole volume is destroyed.
      await stopRelay(procA);
      fs.rmSync(dbA, { force: true });

      const aliceFetch = makeFetchT([{ prefix: baseA, real: true }, { prefix: baseB, real: true }]);
      const alice = buildWorld({ fetchT: aliceFetch.fetchT, settings: {}, origin: baseA, api: baseA + '/api' });
      alice.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home });
      const session = await alice.initSessionV5Initiator(PEER_PUB);
      expect(session).toBeTruthy(); // established from the SURVIVING relay's copy
      expect(typeof session._pkm.opkId).toBe('number'); // a real OTP was consumed and echoed
      expect((await httpPost(baseB, '/prekey/status', { userId: PEER_ID })).json.otpCount).toBe(9);
    } finally {
      await stopRelay(procA);
      await stopRelay(procB);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);
});
