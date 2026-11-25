// H3 + H4 (2026-11-16): invite links carry the inviter's home
// relays, and deposits fail over to a contact's remaining known
// homes when the preferred ones are dead.
//
// Surfaces pinned here:
//  1. The invite codec (extracted from index.html): a single-relay,
//     pin-less inviter produces NO relays parameter — the link is
//     byte-identical to the pre-H3 one. With added relays (or an
//     origin pin) the parameter round-trips the full list, pins
//     included. Decoding is defensive: garbage decodes to the
//     pre-H3 hint (the link's origin alone), the link origin is
//     forced to rank 1, and junk entries are sanitized away.
//  2. The landing: resolveAndAdd stores the carried list as the
//     contact's home for a new-style link, the origin only for an
//     old-style link, and the boot path's override hint (the alias
//     form) is honoured.
//  3. Deposit failover (extracted relaySend, run against REAL
//     worker instances): when every capped target fails, the send
//     walks the contact's remaining known homes in order; a
//     successful failover IS the delivery (nothing is owed to the
//     retry queue), and the reroute is surfaced — a toast the first
//     time each relay pair reroutes, an audit entry every time.
//     Redundant copies on healthy relays are unchanged (no
//     failover, no toast), and a total failure still queues.
//  4. Signal failover: _fanoutSignal walks past a dead preferred
//     home to the next known home and audits the reroute.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import worker from '../_worker.js';
import { makeEnv } from './helpers/mockKV.js';
import { loadOrCreateRelayIdentity } from '../server/relay-identity.js';

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
const PEER2_ID = 'carolUser001';
const PEER2_PUB = PEER2_ID + 'PUBKEYxxxx';
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

// ─── Extraction harness (the step-4/5/6 pattern) ───────────────
function sliceBetween(startMarker, endMarker) {
  const start = INDEX.indexOf(startMarker);
  const end = INDEX.indexOf(endMarker);
  expect(start, `marker ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `marker ${endMarker}`).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

// fetchT seam routing by URL prefix into per-relay worker envs.
// `down` simulates a dead relay. A canned /alias/get answer serves
// the alias landing test (the directory itself is not under test).
function makeFetchT(routes) {
  const log = [];
  const routeState = new Map();
  const fetchT = async (url, opts) => {
    log.push({ url, method: opts?.method || 'GET', body: opts?.body });
    if (url.endsWith('/alias/get')) {
      return new Response(JSON.stringify({ pub: PEER_PUB, name: 'Bob' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
    const route = routes.find((r) => url.startsWith(r.prefix));
    if (!route) throw new Error('no route for ' + url);
    if (route.down) throw new Error('network down');
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
      st.sealed = globalThis._sealedDedup;
      st.msg = globalThis._msgDedup;
      globalThis._sealedDedup = prevSealed;
      globalThis._msgDedup = prevMsg;
    }
  };
  return { fetchT, log };
}

function buildWorld({ fetchT, settings = {}, origin = ORIGIN, api = API, stubs = {} }) {
  const calls = { toasts: [], announces: [], audits: [], saveSettings: 0, delivered: [], retrySaves: 0 };
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
    'myAlias', 'myName',
    'checkAndReplenishPreKeys', 'maybeStartMailboxWs', 'MS', 'CONFIG', 'dbGet', 'dbPut',
    'renderContacts', '_auditKeyTransparency',
    'updateMsgStatus', 'registerBackgroundSync',
    '_updateOutboxBadge', 'setTimeout', '_peerSealV2', '_saveRetryQueue',
    `const _nameTools = null;
     let _retryTimer = null;
     const _retryQueue = [];
     const _isOffline = false;
     ${sliceBetween('const CAPS_X3DH_V5', 'const CAPS_GROUP_V5')}
     ${sliceBetween('// ===== Relay identity pin (stage-2 step 4) =====', '// v3.6: Proactive storage quota check')}
     ${sliceBetween('// Stage-2 step 6: contacts', 'function scheduleRetry()')}
     ${sliceBetween('function scheduleRetry()', 'function _updateOutboxBadge')}
     ${sliceBetween('async function addContact', '// v3.1: Chat folder filtering')}
     ${sliceBetween('async function resolveAndAdd', '// PRESENCE POLLING')}
     ${sliceBetween('function generateInviteMessage', '// SHARE / MIGRATE SURFACING')}
     return { homeRelays, sanitizeHomeList, _encodeInviteHomeList, _decodeInviteHomeList,
       _resolveHomeCandidates, _resolveSendTargets, _depositCopy, relaySend, _fanoutSignal,
       addContact, resolveAndAdd, generateInviteMessage, _retryQueue, _failoverNoted };`);
  const world = worldFn(
    api, { 'Content-Type': 'application/json' }, fetchT, gate.postAPIRaw, verifySignature, settings,
    async () => { calls.saveSettings++; },
    (text, type) => { calls.toasts.push({ text, type }); },
    (text) => { calls.announces.push(text); },
    (kind, msg) => { calls.audits.push({ kind, msg }); },
    () => {},
    (key, ...args) => key + (args.length ? ':' + args.join(',') : ''),
    gate._relayPinGate,
    { origin, pathname: '/' },
    () => {},
    stubs.showPrompt || (async () => null),
    stubs.showConfirm || (async () => false),
    stubs.authFields || (async (fn) => { const ts = Date.now(); return { ts, sig: 'sig:' + fn(ts) }; }),
    ME_ID, ME_PUB,
    stubs.myAlias ?? null, stubs.myName ?? 'Alice',
    () => {}, () => {},
    MS, CONFIG, dbGet, dbPut,
    () => {},
    async () => ({ verdict: 'ok' }),
    (ts, status) => { calls.delivered.push({ ts, status }); },
    () => {},
    () => {},
    (fn) => { capturedTimer = fn; return 1; },
    async () => false,
    () => { calls.retrySaves++; },
  );
  return {
    ...world, gate: gate._relayPinGate, settings, calls, stores,
    setContact: (rec) => stores.contacts.set(rec.id, rec),
  };
}

const post = (env, base, p, body, ip = '203.0.113.9') => worker.fetch(new Request(base + p, {
  method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify(body),
}), env);
const plainBundle = (caps, extra = {}) => ({
  userId: PEER_ID, identityKey: PEER_ID + 'IK', signedPreKey: 'SPK',
  oneTimePreKeys: ['o0', 'o1', 'o2'], caps, ...extra,
});
const sealedQueue = async (env, base, id = PEER_ID) => {
  const r = await post(env, base, '/sealed/poll', { id });
  return (await r.json()).messages || [];
};
const payload = (ts, text = 'CT') => ({
  to: PEER_ID, from: ME_ID, fromPub: ME_PUB, fromName: 'Alice', payload: text, ts,
});
// Three live relays; `down` flips a route dead.
function threeRelays(down = {}) {
  const envA = envWith(freshIdentity());
  const envB = envWith(freshIdentity());
  const envC = envWith(freshIdentity());
  const { fetchT, log } = makeFetchT([
    { prefix: API, env: envA, down: !!down.a },
    { prefix: B_API, env: envB, down: !!down.b },
    { prefix: C_API, env: envC, down: !!down.c },
  ]);
  return { envA, envB, envC, fetchT, log };
}
const failoverToasts = (w) => w.calls.toasts.filter((x) => x.text.startsWith('relayFailover:'));
const rerouteAudits = (w) => w.calls.audits.filter((x) => x.msg.includes('rerouted'));

// ─── 1. The invite codec ───────────────────────────────────────
describe('H3 — the invite codec', () => {
  it('a pin-less single-relay inviter encodes NOTHING (the link stays pre-H3)', () => {
    const { fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: {} });
    expect(w._encodeInviteHomeList()).toBe('');
    const { url } = w.generateInviteMessage();
    expect(url).toBe(ORIGIN + '/?add=' + encodeURIComponent(ME_PUB) + '&name=Alice');
  });

  it('the alias form is likewise untouched when there is nothing to carry', () => {
    const { fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: {}, stubs: { myAlias: 'alice' } });
    expect(w.generateInviteMessage().url).toBe(ORIGIN + '/?add=@alice');
  });

  it('added relays and pins round-trip through the parameter', () => {
    const { fetchT } = threeRelays();
    const settings = {
      relayPin: 'pinA',
      relays: [{ url: B_ORIGIN, pin: 'pinB', label: 'B' }, { url: C_ORIGIN, pin: '', label: 'C' }],
    };
    const w = buildWorld({ fetchT, settings });
    const enc = w._encodeInviteHomeList();
    expect(enc).not.toBe('');
    expect(enc).not.toMatch(/[+/=]/); // base64url, URL-safe as-is
    expect(w._decodeInviteHomeList(enc, ORIGIN)).toEqual([
      { url: ORIGIN, pin: 'pinA' },
      { url: B_ORIGIN, pin: 'pinB' },
      { url: C_ORIGIN, pin: '' },
    ]);
    const { url, msg } = w.generateInviteMessage();
    expect(url).toContain('&relays=' + enc);
    expect(msg).toContain(url); // the shared message embeds the same link
  });

  it('an origin pin ALONE is worth carrying (no added relays needed)', () => {
    const { fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: { relayPin: 'pinA' } });
    const enc = w._encodeInviteHomeList();
    expect(enc).not.toBe('');
    expect(w._decodeInviteHomeList(enc, ORIGIN)).toEqual([{ url: ORIGIN, pin: 'pinA' }]);
  });

  it('decode of a missing or garbage parameter is the pre-H3 hint: the link origin alone', () => {
    const { fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: {} });
    expect(w._decodeInviteHomeList(null, B_ORIGIN)).toEqual([{ url: B_ORIGIN, pin: '' }]);
    expect(w._decodeInviteHomeList('', B_ORIGIN)).toEqual([{ url: B_ORIGIN, pin: '' }]);
    expect(w._decodeInviteHomeList('!!!not-base64!!!', B_ORIGIN)).toEqual([{ url: B_ORIGIN, pin: '' }]);
    expect(w._decodeInviteHomeList('aGVsbG8', B_ORIGIN)).toEqual([{ url: B_ORIGIN, pin: '' }]); // valid b64, not JSON
  });

  it('decode forces the link origin to rank 1 and sanitizes junk out of the carried list', () => {
    const { fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: {} });
    const junk = [
      { url: C_ORIGIN, pin: 'pc' },
      { url: 'javascript:alert(1)' },
      { url: C_ORIGIN, pin: 'dupe' },
      { url: 'not a url' },
      { url: B_ORIGIN },
      { url: 'https://relay-d.test' },
    ];
    const enc = Buffer.from(JSON.stringify(junk), 'utf8').toString('base64url');
    // Link served by A: A ranks first; the list is deduped, capped at
    // 3, and the non-http(s) entries are gone.
    expect(w._decodeInviteHomeList(enc, ORIGIN)).toEqual([
      { url: ORIGIN, pin: '' },
      { url: C_ORIGIN, pin: 'pc' },
      { url: B_ORIGIN, pin: '' },
    ]);
  });
});

// ─── 2. The landing ────────────────────────────────────────────
describe('H3 — the landing stores the carried list', () => {
  it('resolveAndAdd on a NEW-style link stores every carried home', async () => {
    const { fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: {} });
    const carried = Buffer.from(JSON.stringify([
      { url: B_ORIGIN, pin: 'pinB' }, { url: C_ORIGIN, pin: 'pinC' },
    ]), 'utf8').toString('base64url');
    await w.resolveAndAdd(B_ORIGIN + '/?add=' + PEER_PUB + '&name=Bob&relays=' + carried);
    expect(w.stores.contacts.get(PEER_ID)?.home).toEqual([
      { url: B_ORIGIN, pin: 'pinB' },
      { url: C_ORIGIN, pin: 'pinC' },
    ]);
  });

  it('resolveAndAdd on an OLD-style link stores the origin only (backward compatible)', async () => {
    const { fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: {} });
    await w.resolveAndAdd(B_ORIGIN + '/?add=' + PEER_PUB + '&name=Bob');
    expect(w.stores.contacts.get(PEER_ID)?.home).toEqual([{ url: B_ORIGIN, pin: '' }]);
  });

  it('the boot alias path: a bare @alias plus the override hint stores the hint', async () => {
    const { fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: {} });
    const hint = [{ url: B_ORIGIN, pin: 'pinB' }, { url: C_ORIGIN, pin: '' }];
    await w.resolveAndAdd('@bob', hint);
    expect(w.stores.contacts.get(PEER_ID)?.home).toEqual(hint);
  });

  it('a bare key with NO carrier stores no home (unchanged)', async () => {
    const { fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: {} });
    await w.resolveAndAdd(PEER_PUB);
    expect(w.stores.contacts.get(PEER_ID)?.home).toBeUndefined();
  });
});

// ─── 3. Deposit failover ───────────────────────────────────────
describe('H4 — deposit failover across a contact’s known homes', () => {
  it('legacy branch: dead origin, the send reroutes to the second home and is NOT owed', async () => {
    const { envB, envC, fetchT, log } = threeRelays({ a: true });
    const w = buildWorld({ fetchT, settings: {} });
    await post(envB, B_API, '/prekey/upload', plainBundle([]));
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home: [{ url: ORIGIN, pin: '' }, { url: B_ORIGIN, pin: '' }, { url: C_ORIGIN, pin: '' }] });
    const ts = Date.now();
    await w.relaySend(PEER_ID, payload(ts), PEER_PUB);
    await flush();
    // The copy landed at B; C was never tried (failover stops at the
    // first home that answers); nothing is owed to the retry queue.
    expect((await sealedQueue(envB, B_API)).length).toBe(1);
    expect(log.some((e) => e.url.startsWith(C_API + '/sealed/send'))).toBe(false);
    expect(w._retryQueue.length).toBe(0);
    // Surfaced: one toast naming both relays, one audit entry.
    expect(failoverToasts(w).length).toBe(1);
    expect(failoverToasts(w)[0].text).toContain(ORIGIN);
    expect(failoverToasts(w)[0].text).toContain(B_ORIGIN);
    expect(rerouteAudits(w).length).toBe(1);
    expect(w.calls.delivered).toContainEqual({ ts, status: 'deposited' });
  });

  it('fan-out branch: the capped target is dead, the next candidate takes the copy', async () => {
    const { envB, envC, fetchT } = threeRelays({ b: true });
    const w = buildWorld({ fetchT, settings: { fanout: 1 } });
    // B is down, so the status probe falls through to C — whose
    // bundle advertises multi-relay; fanout 1 still caps targets
    // at the (dead) first home.
    await post(envC, C_API, '/prekey/upload', plainBundle(['multi-relay']));
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home: [{ url: B_ORIGIN, pin: '' }, { url: C_ORIGIN, pin: '' }] });
    const ts = Date.now();
    await w.relaySend(PEER_ID, payload(ts), PEER_PUB);
    await flush();
    expect((await sealedQueue(envC, C_API)).length).toBe(1);
    expect(w._retryQueue.length).toBe(0);
    expect(failoverToasts(w).length).toBe(1);
    expect(failoverToasts(w)[0].text).toContain(B_ORIGIN);
    expect(failoverToasts(w)[0].text).toContain(C_ORIGIN);
  });

  it('healthy redundancy is unchanged: copies at both homes, no failover, no toast', async () => {
    const { envB, envC, fetchT } = threeRelays();
    const w = buildWorld({ fetchT, settings: { fanout: 2 } });
    await post(envB, B_API, '/prekey/upload', plainBundle(['multi-relay']));
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home: [{ url: B_ORIGIN, pin: '' }, { url: C_ORIGIN, pin: '' }] });
    await w.relaySend(PEER_ID, payload(Date.now()), PEER_PUB);
    await flush();
    expect((await sealedQueue(envB, B_API)).length).toBe(1);
    expect((await sealedQueue(envC, C_API)).length).toBe(1);
    expect(failoverToasts(w).length).toBe(0);
    expect(rerouteAudits(w).length).toBe(0);
    expect(w._retryQueue.length).toBe(0);
  });

  it('total failure still queues for retry — and stays silent about reroutes that never happened', async () => {
    const { fetchT } = threeRelays({ a: true, b: true });
    const w = buildWorld({ fetchT, settings: {} });
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home: [{ url: ORIGIN, pin: '' }, { url: B_ORIGIN, pin: '' }] });
    await w.relaySend(PEER_ID, payload(Date.now()), PEER_PUB);
    await flush();
    expect(w._retryQueue.length).toBe(1);
    expect(failoverToasts(w).length).toBe(0);
    expect(rerouteAudits(w).length).toBe(0);
  });

  it('the toast is throttled per relay pair; the audit is not', async () => {
    const { envB, fetchT } = threeRelays({ a: true });
    const w = buildWorld({ fetchT, settings: {} });
    await post(envB, B_API, '/prekey/upload', plainBundle([]));
    const home = [{ url: ORIGIN, pin: '' }, { url: B_ORIGIN, pin: '' }];
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home });
    w.setContact({ id: PEER2_ID, pubB64: PEER2_PUB, name: 'Carol', home });
    await w.relaySend(PEER_ID, payload(Date.now()), PEER_PUB);
    await w.relaySend(PEER2_ID, { ...payload(Date.now()), to: PEER2_ID }, PEER2_PUB);
    await flush();
    expect(failoverToasts(w).length).toBe(1);
    expect(rerouteAudits(w).length).toBe(2);
    expect(w._retryQueue.length).toBe(0);
  });
});

// ─── 4. Signal failover ────────────────────────────────────────
describe('H4 — signal rendezvous failover', () => {
  it('_fanoutSignal walks past a dead preferred home and audits the reroute', async () => {
    const { envC, fetchT, log } = threeRelays({ b: true });
    const w = buildWorld({ fetchT, settings: { fanout: 1 } });
    await post(envC, C_API, '/prekey/upload', plainBundle(['multi-relay']));
    w.setContact({ id: PEER_ID, pubB64: PEER_PUB, name: 'Bob', home: [{ url: B_ORIGIN, pin: '' }, { url: C_ORIGIN, pin: '' }] });
    const room = 'dm:' + [ME_ID, PEER_ID].sort().join(':');
    await w._fanoutSignal(PEER_ID, { room, sender: ME_ID, type: 'offer', data: 'sdp', ts: Date.now() });
    await flush();
    const signalPosts = log.filter((e) => e.url.endsWith('/signal')).map((e) => e.url);
    // The dead preferred home is probed (health/attest) but, being
    // unreachable, is refused by the verdict BEFORE any /signal POST
    // — nothing is ever sent to an unverified relay.
    expect(log.some((e) => e.url.startsWith(B_API))).toBe(true);
    expect(signalPosts.some((u) => u.startsWith(B_API))).toBe(false);
    expect(signalPosts.some((u) => u.startsWith(C_API))).toBe(true); // failover reached C
    expect(w.calls.audits.some((x) => x.msg.includes('Signal rerouted'))).toBe(true);
    expect(failoverToasts(w).length).toBe(0); // signals never toast
  });
});
