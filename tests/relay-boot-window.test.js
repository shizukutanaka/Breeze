// Stage-2 step 4 follow-up (2026-11-14): the serving origin's
// boot window — _boot() fires startPresence()/startPolling() (and
// initTurn()/initPushNotifications()) BEFORE _startLiveSession()
// reaches checkRelayPin(), so a returning session's first calls
// used to race ahead of the pin verdict: the gate only refused on
// a LATCHED block, and nothing was latched yet. Step 5 closed the
// same window for added relays by verifying inside the resolver;
// the origin's check lives at session start, so the funnel now
// HOLDS (never blocks) a session's calls until its first verdict
// settles. These tests replay _boot()'s exact statement order
// against the extracted pieces:
//
//   arm → fire presence/turn (unawaited, as startPresence/initTurn
//   do) → checkRelayPin() runs later, health held back by the test
//   → while the verdict is pending, the early calls must NOT have
//   reached the network; once it settles they proceed — unless the
//   verdict is a verified mismatch, in which case they never do.
//
// The mailbox socket gets the same wait (it used to connect on
// mailboxWsWanted's not-yet-blocked alone).
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
const MY_ID = 'aliceUserId0001';
const MY_PUB = MY_ID + 'PUBKEY';
const flush = () => new Promise((r) => setTimeout(r, 30));

beforeEach(() => {
  globalThis._rateLimitMap = new Map();
  globalThis._presenceCache = new Map();
  globalThis._msgDedup = new Map();
  globalThis._sealedDedup = new Map();
  globalThis._queueAuthKey = new Map();
});

function sliceBetween(startMarker, endMarker) {
  const start = INDEX.indexOf(startMarker);
  const end = INDEX.indexOf(endMarker);
  expect(start, `marker ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `marker ${endMarker}`).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

function freshIdentity() {
  const db = new DatabaseSync(':memory:');
  const id = loadOrCreateRelayIdentity(db);
  db.close();
  return id;
}
const envWith = (id) => makeEnv({ RELAY_PUBLIC_KEY: id.publicKey, RELAY_PRIVATE_KEY: id.privateKey });

// fetchT seam into a real worker env, with a call log and a
// holdable /health: while held, the health response (and therefore
// the pin verdict) cannot land, however long the test waits.
function makeFetchT(env) {
  const log = [];
  let healthHold = null;
  const fetchT = async (url, opts) => {
    if (healthHold && url.endsWith('/health')) await healthHold;
    log.push({ url, method: opts?.method || 'GET' });
    if (opts?.method === 'POST') {
      return worker.fetch(new Request(url, {
        method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' }, body: opts.body,
      }), env);
    }
    return worker.fetch(new Request(url), env);
  };
  return {
    fetchT, log,
    holdHealth() { let release; healthHold = new Promise((r) => { release = r; }); this._release = release; },
    releaseHealth() { const r = this._release; this._release = null; healthHold = null; if (r) r(); },
    paths() { return log.map((e) => e.url.slice(API.length) + ':' + e.method); },
  };
}

function buildClient({ fetchT, settings = {} }) {
  const calls = { saveSettings: 0, toasts: [], audits: [] };
  const gateFn = new Function('API', '_H', 'fetchT',
    `${sliceBetween('const _relayPinGate', '// ═══ Title helper')}
     return { _relayPinGate, postAPIRaw };`);
  const gate = gateFn(API, { 'Content-Type': 'application/json' }, fetchT);
  const verifyFn = new Function('_hasEd25519', '_dbg',
    `${sliceBetween('async function verifySignature', '// ===== Server health check =====')}
     return verifySignature;`);
  const verifySignature = verifyFn(true, () => {});
  const step45Fn = new Function(
    'API', '_H', 'fetchT', 'postAPIRaw', 'verifySignature', '_settings', 'saveSettings',
    'showToast', 'announceToSR', 'auditLog', '_dbg', 't', '_relayPinGate',
    'location', '_closeRelayWs', 'showPrompt', 'showConfirm', 'authFields', 'myId',
    'checkAndReplenishPreKeys', 'maybeStartMailboxWs',
    `let _lastPreKeyCheck = 0;
     ${sliceBetween('// ===== Relay identity pin (stage-2 step 4) =====', '// v3.6: Proactive storage quota check')}
     return { checkRelayPin, _armRelayPinGate, _settleRelayPinGate, homeRelays, isOriginRelay, postAPIRelay };`);
  const client = step45Fn(
    API, { 'Content-Type': 'application/json' }, fetchT, gate.postAPIRaw, verifySignature, settings,
    async () => { calls.saveSettings++; },
    (text, type) => { calls.toasts.push({ text, type }); },
    () => {},
    (kind, msg) => { calls.audits.push({ kind, msg }); },
    () => {},
    (key, ...args) => key + (args.length ? ':' + args.join(',') : ''),
    gate._relayPinGate,
    { origin: ORIGIN },
    () => {},
    async () => null,
    async () => false,
    async (fn) => { const ts = Date.now(); return { ts, sig: 'sig:' + fn(ts) }; },
    MY_ID,
    () => {},
    () => {},
  );
  return { ...client, gate: gate._relayPinGate, postAPIRaw: gate.postAPIRaw, settings, calls };
}

// _boot()'s order, verbatim in effect: arm, then the unawaited
// early calls startPresence()/initTurn() fire, then (several
// statements and two awaits later) the session reaches the check.
async function bootBurst(client) {
  client._armRelayPinGate();
  const early = [
    client.postAPIRaw('/presence', { id: MY_ID, pub: MY_PUB, name: 'Alice', inst: 'i1', instSig: 's' }),
    client.postAPIRaw('/turn', { userId: MY_ID }),
  ];
  await flush();
  return early;
}

describe('origin boot window (stage-2 step 4 follow-up)', () => {
  it('holds the boot burst until the verdict, then releases it on a matching pin', async () => {
    const idA = freshIdentity();
    const seam = makeFetchT(envWith(idA));
    const client = buildClient({ fetchT: seam.fetchT, settings: { relayPin: idA.publicKey } });
    seam.holdHealth();
    const early = await bootBurst(client);
    // The verdict has not even STARTED (health is the check's first
    // move and it is held): on the pre-fix gate both calls would
    // already be in the log.
    expect(seam.paths()).toEqual([]);
    const checking = client.checkRelayPin();
    await flush();
    expect(seam.paths()).toEqual([]); // health still held — the burst still waits
    seam.releaseHealth();
    await checking;
    expect(client.gate.blocked).toBe(false);
    const results = await Promise.all(early);
    expect(results.every((r) => r !== null)).toBe(true);
    // The check's own attest call passed the gate it maintains
    // (no deadlock), and strictly before the held burst.
    expect(seam.paths()).toEqual(['/health:GET', '/relay/attest:POST', '/presence:POST', '/turn:POST']);
  });

  it('never releases the boot burst when the verdict is a verified key mismatch', async () => {
    const idA = freshIdentity();
    const idB = freshIdentity();
    const seam = makeFetchT(envWith(idB)); // the relay now presents B…
    const client = buildClient({ fetchT: seam.fetchT, settings: { relayPin: idA.publicKey } }); // …but A is pinned
    seam.holdHealth();
    const early = await bootBurst(client);
    expect(seam.paths()).toEqual([]);
    const checking = client.checkRelayPin();
    await flush();
    seam.releaseHealth();
    await checking;
    expect(client.gate.blocked).toBe(true);
    const results = await Promise.all(early);
    expect(results).toEqual([null, null]); // refused with the network-failure shape
    expect(seam.paths()).toEqual(['/health:GET']); // the burst never reached the network
    expect(client.settings.relayPin).toBe(idA.publicKey); // pin never silently re-written
  });

  it('first contact (no pin yet): the burst waits, the check TOFU-pins, the burst proceeds', async () => {
    const idA = freshIdentity();
    const seam = makeFetchT(envWith(idA));
    const client = buildClient({ fetchT: seam.fetchT, settings: {} });
    seam.holdHealth();
    const early = await bootBurst(client);
    expect(seam.paths()).toEqual([]);
    const checking = client.checkRelayPin();
    await flush();
    seam.releaseHealth();
    await checking;
    expect(client.gate.blocked).toBe(false);
    expect(client.settings.relayPin).toBe(idA.publicKey);
    expect(client.calls.saveSettings).toBeGreaterThan(0);
    const results = await Promise.all(early);
    expect(results.every((r) => r !== null)).toBe(true);
  });

  it('keyless (pre-step-4) relay: the verdict settles at health and the burst proceeds — legacy behavior', async () => {
    const seam = makeFetchT(makeEnv({}));
    const client = buildClient({ fetchT: seam.fetchT, settings: { relayPin: 'somePinnedKey' } });
    seam.holdHealth();
    const early = await bootBurst(client);
    expect(seam.paths()).toEqual([]);
    const checking = client.checkRelayPin();
    await flush();
    seam.releaseHealth();
    await checking;
    expect(client.gate.blocked).toBe(false); // no key presented: no evidence, no block (step 4's rule)
    const results = await Promise.all(early);
    expect(results.every((r) => r !== null)).toBe(true);
    expect(seam.paths()[0]).toBe('/health:GET');
  });

  it('unarmed gate (no session boot): calls pass immediately, exactly as before', async () => {
    const idA = freshIdentity();
    const seam = makeFetchT(envWith(idA));
    const client = buildClient({ fetchT: seam.fetchT, settings: {} });
    const r = await client.postAPIRaw('/turn', { userId: MY_ID });
    expect(r).not.toBe(null);
    expect(seam.paths()).toEqual(['/turn:POST']);
  });

  it('settle without a check (session setup threw first): held calls proceed, nothing hangs', async () => {
    const idA = freshIdentity();
    const seam = makeFetchT(envWith(idA));
    const client = buildClient({ fetchT: seam.fetchT, settings: {} });
    client._armRelayPinGate();
    const held = client.postAPIRaw('/turn', { userId: MY_ID });
    await flush();
    expect(seam.paths()).toEqual([]);
    client._settleRelayPinGate(); // _boot()'s guarantee when _startLiveSession() returns without reaching the check
    const r = await held;
    expect(r).not.toBe(null);
    expect(seam.paths()).toEqual(['/turn:POST']);
  });
});

describe('origin mailbox socket waits for the verdict', () => {
  function buildWs(client, { wsEnabled = true } = {}) {
    const constructed = [];
    class FakeWebSocket { constructor(url) { this.url = url; constructed.push(url); } close() {} }
    const stateFn = new Function(
      'postAPIRelay', 'homeRelays', '_pollCursorByUrl', 'queueAuth', 'handleIncoming',
      'myId', '_isOffline', 'API', 'window', '_dbg', 'showToast', 't', 'unsealMeta',
      'myKeys', 'checkAndReplenishPreKeys', 'MS',
      `${sliceBetween('let _pollTimer = null;', 'function schedulePoll')}
       return { _mailWsState };`);
    const poll = stateFn(
      client.postAPIRelay || (async () => null), client.homeRelays, new Map(),
      async () => ({}), async () => {}, MY_ID, false, API,
      { _plainDepLogged: 0 }, () => {}, () => {},
      (key, ...args) => key, async () => null, { privateKey: null }, () => {},
      { DAY: 86400000, MIN: 60000, SEC: 1000 },
    );
    const wsFn = new Function(
      '_mailWsState', '_closeRelayWs', 'mailboxWsWanted', 'isOriginRelay', 'ensureRelayVerified',
      'queueAuth', 'relayApiBase', 'myId', 'MS', '_dbg', 'WebSocket', 'pollOnce', 'schedulePoll',
      '_relayPinGate',
      `${sliceBetween('async function _maybeStartRelayWs', 'function _closeRelayWs')}
       return { _maybeStartRelayWs };`);
    const wantedFn = new Function(
      'API', '_isLeaderTab', 'document', 'window', '_relayPinGate', '_relayBlockedUrls', '_relayHealthByUrl', 'isOriginRelay',
      `${sliceBetween('function mailboxWsWanted(relay)', 'async function maybeStartMailboxWs')}
       return mailboxWsWanted;`);
    const mailboxWsWanted = wantedFn(API, true, { hidden: false },
      { _serverFeatures: wsEnabled ? { ws: true } : {} },
      client.gate, new Set(), new Map(), client.isOriginRelay);
    const ws = wsFn(
      poll._mailWsState, () => {}, mailboxWsWanted, client.isOriginRelay,
      async () => true, async () => ({ ts: 1, sig: 'sig' }),
      () => API, MY_ID, { MIN: 60000, SEC: 1000 }, () => {}, FakeWebSocket,
      () => {}, () => {}, client.gate,
    );
    return { ...ws, constructed, origin: client.homeRelays()[0] };
  }

  it('does not connect while the verdict is pending; connects after a clean settle; stays off after a block', async () => {
    const idA = freshIdentity();
    const seam = makeFetchT(envWith(idA));
    const client = buildClient({ fetchT: seam.fetchT, settings: { relayPin: idA.publicKey } });
    const ws = buildWs(client);
    client._armRelayPinGate();
    const attempt = ws._maybeStartRelayWs(ws.origin);
    await flush();
    expect(ws.constructed).toEqual([]); // verdict pending: no socket
    client._settleRelayPinGate();
    await attempt;
    expect(ws.constructed.length).toBe(1); // clean verdict: socket proceeds

    // A blocked verdict keeps the socket off (step 4's rule, now
    // also reachable when the attempt started before the verdict).
    const ws2 = buildWs(client);
    client._armRelayPinGate();
    const attempt2 = ws2._maybeStartRelayWs(ws2.origin);
    await flush();
    client.gate.blocked = true; // the verdict lands as a verified mismatch
    client._settleRelayPinGate();
    await attempt2;
    expect(ws2.constructed).toEqual([]);
  });
});
