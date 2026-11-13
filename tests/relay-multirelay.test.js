// Stage-2 step 5 (2026-11-14): client multi-relay — home relays,
// per-relay pins, and fan-out of the account's OWN traffic
// (docs/RELAY_STAGE2_PLAN.md Step 5).
//
// Surfaces pinned here:
//  1. The resolver + settings shape (extracted from index.html):
//     with no added relays, homeRelays() is exactly the serving
//     origin and a call through postAPIRelay is byte-identical to
//     the legacy postAPIRaw call. An added relay is attested before
//     it is stored (attestNewRelay's verdict matrix), and its pin is
//     enforced INDEPENDENTLY of the origin's: a key change, or a
//     pinned key that stops being presented, latches THAT relay off
//     (warning fired, pin never rewritten) while the origin keeps
//     working; an unreachable relay latches nothing and is
//     re-checked on the next call.
//  2. The fan-out (extracted poll / replenish / presence, run
//     against two REAL worker instances): one poll cycle merges
//     both relays' queues and ACKs each relay for its own
//     envelopes; a 500-ing relay neither blocks the other's
//     deliveries nor latches; a missing bundle on ONE relay rotates
//     ONE bundle onto BOTH (the upload replaces, so anything less
//     strands the other relay with discarded private halves), and a
//     failed upload is retried as the SAME bundle, not a new
//     rotation; the presence beat lands on both relays.
//  3. The plan's done-when, as a live drill: two real Node hosts,
//     deposits on both, the PRIMARY stopped mid-session — the
//     account still receives via the second relay.
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import worker from '../_worker.js';
import { makeEnv } from './helpers/mockKV.js';
import { buildRelayEnv, createRelayServer, REPO_ROOT } from '../server/node-host.js';
import { loadOrCreateRelayIdentity, relayFingerprint } from '../server/relay-identity.js';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
const ROOT = path.resolve(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const ORIGIN = 'https://relay-a.test';
const API = ORIGIN + '/api';
const B_ORIGIN = 'https://relay-b.test';
const B_API = B_ORIGIN + '/api';
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

function freshIdentity() {
  const db = new DatabaseSync(':memory:');
  const id = loadOrCreateRelayIdentity(db);
  db.close();
  return id;
}
const envWith = (id, extra = {}) => makeEnv({
  RELAY_PUBLIC_KEY: id.publicKey, RELAY_PRIVATE_KEY: id.privateKey, ...extra,
});

// ─── Extraction harness (the step-4 pattern) ─────────────────────
function sliceBetween(startMarker, endMarker) {
  const start = INDEX.indexOf(startMarker);
  const end = INDEX.indexOf(endMarker);
  expect(start, `marker ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `marker ${endMarker}`).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

// fetchT seam routing by URL prefix into per-relay worker envs (or
// real HTTP for the drill), with a call log. `down` simulates a dead
// relay; `fail500` a live-but-broken one.
function makeFetchT(routes) {
  const log = [];
  const fetchT = async (url, opts) => {
    log.push({ url, method: opts?.method || 'GET', body: opts?.body });
    const route = routes.find((r) => url.startsWith(r.prefix));
    if (!route) throw new Error('no route for ' + url);
    if (route.down) throw new Error('network down');
    if (route.fail500) return new Response('boom', { status: 500 });
    if (route.real) return fetch(url, opts);
    if (opts?.method === 'POST') {
      return worker.fetch(new Request(url, {
        method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' }, body: opts.body,
      }), route.env);
    }
    return worker.fetch(new Request(url), route.env);
  };
  return { fetchT, log };
}

function buildClient({ fetchT, settings = {}, origin = ORIGIN, api = API, stubs = {} }) {
  const calls = { saveSettings: 0, toasts: [], announces: [], audits: [], closedWs: [], replenish: 0, wsStarts: 0 };
  const gateFn = new Function('API', '_H', 'fetchT',
    `${sliceBetween('const _relayPinGate', '// ═══ Title helper')}
     return { _relayPinGate, postAPIRaw };`);
  const gate = gateFn(api, { 'Content-Type': 'application/json' }, fetchT);
  const verifyFn = new Function('_hasEd25519', '_dbg',
    `${sliceBetween('async function verifySignature', '// ===== Server health check =====')}
     return verifySignature;`);
  const verifySignature = verifyFn(true, () => {});
  const step5Fn = new Function(
    'API', '_H', 'fetchT', 'postAPIRaw', 'verifySignature', '_settings', 'saveSettings',
    'showToast', 'announceToSR', 'auditLog', '_dbg', 't', '_relayPinGate',
    'location', '_closeRelayWs', 'showPrompt', 'showConfirm', 'authFields', 'myId',
    'checkAndReplenishPreKeys', 'maybeStartMailboxWs',
    `let _lastPreKeyCheck = 0;
     ${sliceBetween('// ===== Relay identity pin (stage-2 step 4) =====', '// v3.6: Proactive storage quota check')}
     return { homeRelays, isOriginRelay, relayApiBase, postAPIRelay, ensureRelayVerified,
       attestNewRelay, addHomeRelay, removeHomeRelay, _addRelayFlow, _unsubscribePushAll,
       checkRelayPin, _relayBlockedUrls, _relayHealthByUrl, _pollCursorByUrl };`);
  const client = step5Fn(
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
    MY_ID,
    () => { calls.replenish++; },
    () => { calls.wsStarts++; },
  );
  return { ...client, gate: gate._relayPinGate, postAPIRaw: gate.postAPIRaw, settings, calls };
}

function buildPoll(client, { handleIncoming, checkAndReplenishPreKeys }) {
  const pollFn = new Function(
    'postAPIRelay', 'homeRelays', '_pollCursorByUrl', 'queueAuth', 'handleIncoming',
    'myId', '_isOffline', 'API', 'window', '_dbg', 'showToast', 't', 'unsealMeta',
    'myKeys', 'checkAndReplenishPreKeys', 'MS',
    `${sliceBetween('let _pollTimer = null;', 'function schedulePoll')}
     return { pollOnce, _mailWsState, _anyMailWsOpen };`);
  return pollFn(
    client.postAPIRelay, client.homeRelays, client._pollCursorByUrl,
    async () => ({}), handleIncoming, MY_ID, false, API,
    { _plainDepLogged: 0 }, () => {},
    () => {}, (key, ...args) => key + (args.length ? ':' + args.join(',') : ''),
    async () => null, { privateKey: null }, checkAndReplenishPreKeys,
    { DAY: 86400000, MIN: 60000 },
  );
}

function buildReplenish(client, { generatePreKeyBundle }) {
  const fn = new Function(
    'postAPIRelay', 'homeRelays', 'generatePreKeyBundle', 'prekeyUploadAuth',
    'myId', 'myPubB64', 'API', 'MS', '_dbg',
    `let _pendingBundle = null;
     ${sliceBetween('let _lastPreKeyCheck = 0;', '// v3.3: Adaptive polling')}
     return { checkAndReplenishPreKeys, getPending: () => _pendingBundle,
       resetTimer: () => { _lastPreKeyCheck = 0; } };`);
  return fn(
    client.postAPIRelay, client.homeRelays, generatePreKeyBundle,
    async () => ({}), MY_ID, MY_PUB, API, { MIN: 60000 }, () => {},
  );
}

// A serial number early in every envelope: the worker's send dedup
// is keyed on (to, length, first-32-chars) and its map is
// process-global, so two near-identical deposits would dedup
// against each other across the two in-process worker instances
// (two real relays never share that map).
let _depN = 0;
const depositSealed = (env, base, payload) => worker.fetch(new Request(base + '/sealed/send', {
  method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.10' },
  body: JSON.stringify({ to: MY_ID, envelope: JSON.stringify({ to: MY_ID, n: ++_depN, ts: Date.now(), payload }) }),
}), env);
const sealedPollCount = async (env, base) => {
  const r = await worker.fetch(new Request(base + '/sealed/poll', {
    method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.10' }, body: JSON.stringify({ id: MY_ID }),
  }), env);
  return (await r.json()).messages.length;
};

describe('resolver + settings shape', () => {
  it('default settings resolve to exactly the serving origin, and its calls are the legacy calls byte for byte', async () => {
    const idA = freshIdentity();
    const { fetchT, log } = makeFetchT([{ prefix: API, env: envWith(idA) }]);
    const c = buildClient({ fetchT, settings: {} });
    expect(c.homeRelays()).toEqual([{ url: ORIGIN, pin: '', label: '' }]);
    const legacy = await c.postAPIRaw('/prekey/status', { userId: MY_ID });
    const viaRelay = await c.postAPIRelay(c.homeRelays()[0], '/prekey/status', { userId: MY_ID });
    expect(legacy && viaRelay).toBeTruthy();
    const posts = log.filter((x) => x.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[1]).toEqual(posts[0]); // same URL, same body — the pre-step-5 path untouched
  });

  it('a stored origin entry merges into the first slot; relayPin stays the origin pin of record', () => {
    const idA = freshIdentity();
    const { fetchT } = makeFetchT([{ prefix: API, env: envWith(idA) }]);
    const c = buildClient({
      fetchT,
      settings: { relayPin: idA.publicKey, relays: [{ url: ORIGIN + '/', pin: 'ignoredPin', label: 'home' }] },
    });
    const list = c.homeRelays();
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ url: ORIGIN, pin: idA.publicKey, label: 'home' });
    expect(c.relayApiBase(list[0])).toBe(API);
    expect(c.relayApiBase({ url: B_ORIGIN, pin: '', label: '' })).toBe(B_API);
  });

  it('attestNewRelay classifies: ok + fingerprint / keyless / invalid / self / duplicate', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const routes = [
      { prefix: API, env: envWith(idA) },
      { prefix: B_API, env: envWith(idB) },
    ];
    const { fetchT } = makeFetchT(routes);
    const c = buildClient({ fetchT, settings: {} });
    const ok = await c.attestNewRelay(B_ORIGIN + '/some/path?x=1');
    expect(ok.url).toBe(B_ORIGIN); // normalized to the origin
    expect(ok.relayKey).toBe(idB.publicKey);
    expect(ok.fingerprint).toBe(relayFingerprint(idB.publicKey));
    routes[1].env = makeEnv(); // B loses its identity → keyless
    expect((await c.attestNewRelay(B_ORIGIN)).error).toBe('keyless');
    expect((await c.attestNewRelay('not a url')).error).toBe('invalid');
    expect((await c.attestNewRelay('ftp://relay-b.test')).error).toBe('invalid');
    expect((await c.attestNewRelay(ORIGIN)).error).toBe('self');
    await c.addHomeRelay({ url: B_ORIGIN, pin: idB.publicKey, label: 'b' });
    expect((await c.attestNewRelay(B_ORIGIN)).error).toBe('duplicate');
  });

  it('the add-flow stores only after attestation + fingerprint confirmation; refusal stores nothing', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const { fetchT } = makeFetchT([
      { prefix: API, env: envWith(idA) },
      { prefix: B_API, env: envWith(idB) },
    ]);
    const settings = {};
    const yes = buildClient({ fetchT, settings, stubs: {
      showPrompt: async () => B_ORIGIN, showConfirm: async () => true } });
    await yes._addRelayFlow();
    expect(settings.relays).toEqual([{ url: B_ORIGIN, pin: idB.publicKey, label: 'relay-b.test' }]);
    expect(yes.calls.toasts.some((x) => x.text.startsWith('relayAdded:'))).toBe(true);
    expect(yes.calls.replenish).toBe(1); // takes effect immediately, not at the next tick
    expect(yes.calls.wsStarts).toBe(1);

    const settings2 = {};
    const no = buildClient({ fetchT, settings: settings2, stubs: {
      showPrompt: async () => B_ORIGIN, showConfirm: async () => false } });
    await no._addRelayFlow();
    expect(settings2.relays).toBeUndefined();
  });

  it('removeHomeRelay forgets the relay everywhere (settings, verdicts, socket, poll cursor)', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const { fetchT } = makeFetchT([
      { prefix: API, env: envWith(idA) },
      { prefix: B_API, env: envWith(idB) },
    ]);
    const settings = { relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] };
    const c = buildClient({ fetchT, settings });
    c._pollCursorByUrl.set(B_ORIGIN, 123);
    await c.removeHomeRelay(B_ORIGIN);
    expect(settings.relays).toEqual([]);
    expect(c.homeRelays()).toHaveLength(1);
    expect(c.calls.closedWs).toContain(B_ORIGIN);
    expect(c._pollCursorByUrl.has(B_ORIGIN)).toBe(false);
  });
});

describe('per-relay pins — independence', () => {
  const twoRelays = (settings) => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const routes = [
      { prefix: API, env: envWith(idA) },
      { prefix: B_API, env: envWith(idB) },
    ];
    const { fetchT, log } = makeFetchT(routes);
    const c = buildClient({ fetchT, settings: settings(idA, idB) });
    return { c, routes, log, idA, idB };
  };

  it("B's key change latches B only: warning fires, pin unrewritten, origin unaffected", async () => {
    const { c, routes, idA } = twoRelays((a, b) => ({
      relayPin: a.publicKey, relays: [{ url: B_ORIGIN, pin: b.publicKey, label: 'b' }],
    }));
    routes[1].env = envWith(freshIdentity()); // B's key is swapped
    await expect(c.postAPIRelay(c.homeRelays()[1], '/prekey/status', { userId: MY_ID })).resolves.toBeNull();
    expect(c._relayBlockedUrls.has(B_ORIGIN)).toBe(true);
    expect(c.calls.toasts.some((x) => x.text === 'relayKeyChanged' && x.type === 'error')).toBe(true);
    expect(c.calls.audits.some((x) => x.kind === 'security' && x.msg.includes(B_ORIGIN))).toBe(true);
    expect(c.settings.relays[0].pin).not.toBe(''); // never silently re-pinned
    expect(c.calls.closedWs).toContain(B_ORIGIN); // its wake-up socket is dropped too
    // The origin never noticed: gate untouched, calls still flow.
    expect(c.gate.blocked).toBe(false);
    const okResp = await c.postAPIRelay(c.homeRelays()[0], '/prekey/status', { userId: MY_ID });
    expect(okResp).toBeTruthy();
    expect(idA.publicKey).toBe(c.settings.relayPin);
  });

  it('a pinned relay that stops presenting a key at all is likewise latched (no silent downgrade)', async () => {
    const { c, routes } = twoRelays((a, b) => ({
      relayPin: a.publicKey, relays: [{ url: B_ORIGIN, pin: b.publicKey, label: 'b' }],
    }));
    routes[1].env = makeEnv(); // keyless now
    await expect(c.postAPIRelay(c.homeRelays()[1], '/prekey/status', { userId: MY_ID })).resolves.toBeNull();
    expect(c._relayBlockedUrls.has(B_ORIGIN)).toBe(true);
    expect(c.calls.toasts.some((x) => x.text === 'relayKeyChanged')).toBe(true);
  });

  it('an unreachable added relay refuses the call but latches NOTHING — and recovers on re-check', async () => {
    const { c, routes, log } = twoRelays((a, b) => ({
      relayPin: a.publicKey, relays: [{ url: B_ORIGIN, pin: b.publicKey, label: 'b' }],
    }));
    routes[1].down = true;
    await expect(c.postAPIRelay(c.homeRelays()[1], '/prekey/status', { userId: MY_ID })).resolves.toBeNull();
    expect(c._relayBlockedUrls.has(B_ORIGIN)).toBe(false);
    expect(c.calls.toasts).toEqual([]);
    routes[1].down = false; // B is back — the next call re-verifies and flows
    const resp = await c.postAPIRelay(c.homeRelays()[1], '/prekey/status', { userId: MY_ID });
    expect(resp).toBeTruthy();
    expect(log.some((x) => x.url === B_API + '/relay/attest')).toBe(true);
  });

  it("B's verification never consults the origin's pin (a wrong origin pin cannot break B)", async () => {
    const { c } = twoRelays((_a, b) => ({
      relayPin: 'notTheOriginKey', relays: [{ url: B_ORIGIN, pin: b.publicKey, label: 'b' }],
    }));
    const resp = await c.postAPIRelay(c.homeRelays()[1], '/prekey/status', { userId: MY_ID });
    expect(resp).toBeTruthy();
    expect(c._relayBlockedUrls.size).toBe(0);
  });
});

describe('fan-out — poll merges every home relay (real workers)', () => {
  it('delivers from both relays, ACKs each relay for its own envelopes, drops nothing', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const { fetchT } = makeFetchT([{ prefix: API, env: envA }, { prefix: B_API, env: envB }]);
    const c = buildClient({ fetchT, settings: {
      relayPin: idA.publicKey, relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] } });
    await depositSealed(envA, API, 'from-A');
    await depositSealed(envB, B_API, 'from-B');
    const received = [];
    let replenishCalls = 0;
    const poll = buildPoll(c, {
      handleIncoming: async (env) => { received.push(env.payload); },
      checkAndReplenishPreKeys: () => { replenishCalls++; },
    });
    await poll.pollOnce();
    expect(received.sort()).toEqual(['from-A', 'from-B']);
    expect(replenishCalls).toBe(1); // once per cycle, not once per relay
    await flush(); // the ACKs are fire-and-forget by design
    expect(await sealedPollCount(envA, API)).toBe(0);
    expect(await sealedPollCount(envB, B_API)).toBe(0);
  });

  it('one relay hard-failing (500) neither starves the other nor latches anything', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA);
    const routes = [{ prefix: API, env: envA }, { prefix: B_API, env: envWith(idB), fail500: true }];
    const { fetchT } = makeFetchT(routes);
    const c = buildClient({ fetchT, settings: {
      relayPin: idA.publicKey, relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] } });
    await depositSealed(envA, API, 'still-arrives');
    const received = [];
    const poll = buildPoll(c, {
      handleIncoming: async (env) => { received.push(env.payload); },
      checkAndReplenishPreKeys: () => {},
    });
    await poll.pollOnce();
    expect(received).toEqual(['still-arrives']);
    expect(c._relayBlockedUrls.size).toBe(0);
    expect(c.calls.toasts).toEqual([]);
  });
});

describe('fan-out — prekey bundle is one identity on every home relay', () => {
  it('a bundle missing on ONE relay rotates ONE bundle onto BOTH', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const { fetchT, log } = makeFetchT([{ prefix: API, env: envA }, { prefix: B_API, env: envB }]);
    // A already holds a (stale) bundle; B has none (just added).
    await worker.fetch(new Request(API + '/prekey/upload', {
      method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' },
      body: JSON.stringify({ userId: MY_ID, identityKey: MY_PUB, signedPreKey: 'SPK-stale', oneTimePreKeys: ['s0'] }),
    }), envA);
    const c = buildClient({ fetchT, settings: {
      relayPin: idA.publicKey, relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] } });
    let generations = 0;
    const rep = buildReplenish(c, {
      generatePreKeyBundle: async () => ({ signedPreKey: 'SPK-gen-' + (++generations), oneTimePreKeys: ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9'] }),
    });
    await rep.checkAndReplenishPreKeys();
    expect(generations).toBe(1); // ONE rotation, not one per relay
    const uploads = log.filter((x) => x.url.endsWith('/prekey/upload'));
    expect(uploads.map((x) => x.url).sort()).toEqual([API + '/prekey/upload', B_API + '/prekey/upload']);
    const storedA = JSON.parse(envA.KV.store.get('prekey:' + MY_ID));
    const storedB = JSON.parse(envB.KV.store.get('prekey:' + MY_ID));
    expect(storedA.signedPreKey).toBe('SPK-gen-1'); // A's stale bundle was replaced too
    expect(storedB.signedPreKey).toBe('SPK-gen-1');
    expect(rep.getPending()).toBeNull();
  });

  it("a failed upload is retried as the SAME bundle on the next cycle — never a fresh rotation", async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const envA = envWith(idA); const envB = envWith(idB);
    const routes = [{ prefix: API, env: envA }, { prefix: B_API, env: envB }];
    const base = makeFetchT(routes);
    let bUploadsDown = true;
    const fetchT = async (url, opts) => {
      if (bUploadsDown && url === B_API + '/prekey/upload') throw new Error('upload lost');
      return base.fetchT(url, opts);
    };
    const c = buildClient({ fetchT, settings: {
      relayPin: idA.publicKey, relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] } });
    let generations = 0;
    const rep = buildReplenish(c, {
      generatePreKeyBundle: async () => ({ signedPreKey: 'SPK-gen-' + (++generations), oneTimePreKeys: ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9'] }),
    });
    await rep.checkAndReplenishPreKeys();
    expect(generations).toBe(1);
    expect(rep.getPending()?.relays.has(B_ORIGIN)).toBe(true);
    expect(envB.KV.store.get('prekey:' + MY_ID)).toBeUndefined();
    bUploadsDown = false;
    rep.resetTimer();
    await rep.checkAndReplenishPreKeys();
    expect(generations).toBe(1); // healed with the pending bundle — no second rotation
    expect(rep.getPending()).toBeNull();
    const storedB = JSON.parse(envB.KV.store.get('prekey:' + MY_ID));
    expect(storedB.signedPreKey).toBe('SPK-gen-1');
  });
});

describe('fan-out — presence + push unsubscribe reach every home relay', () => {
  it('the presence beat POSTs to both relays', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const { fetchT, log } = makeFetchT([
      { prefix: API, env: envWith(idA) }, { prefix: B_API, env: envWith(idB) }]);
    const c = buildClient({ fetchT, settings: {
      relayPin: idA.publicKey, relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] } });
    const presenceFn = new Function(
      'API', 'dbGet', 'dbPut', 'signMessage', 'homeRelays', 'postAPIRelay', 'showToast',
      't', '_dbg', 'MS', 'CONFIG', 'document', '_ac', 'activeContact', 'updateConvStatus',
      'myId', 'myPubB64', 'myName',
      `${sliceBetween('// ===== Presence heartbeat', '// v3.3: Shared lock screen function')}
       return { startPresence };`);
    const presence = presenceFn(
      API, async () => ({ v: 'inst1234abcd' }), async () => {}, async () => 'c2ln',
      c.homeRelays, c.postAPIRelay, () => {}, (k) => k, () => {},
      { MIN: 60000 }, { PRESENCE_INTERVAL_MS: 3600000, PRESENCE_BG_INTERVAL_MS: 3600000 },
      { hidden: false, addEventListener: () => {} }, { signal: undefined }, null, () => {},
      MY_ID, MY_PUB, 'Alice',
    );
    presence.startPresence();
    await flush();
    const beats = log.filter((x) => x.url.endsWith('/presence')).map((x) => x.url);
    expect(beats.sort()).toEqual([API + '/presence', B_API + '/presence']);
  });

  it('push unsubscribe is fanned out to every home relay', async () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const { fetchT, log } = makeFetchT([
      { prefix: API, env: envWith(idA) }, { prefix: B_API, env: envWith(idB) }]);
    const c = buildClient({ fetchT, settings: {
      relayPin: idA.publicKey, relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] } });
    await c._unsubscribePushAll({ endpoint: 'https://push.example/sub1' });
    const unsubs = log.filter((x) => x.url.endsWith('/push/unsubscribe')).map((x) => x.url);
    expect(unsubs.sort()).toEqual([API + '/push/unsubscribe', B_API + '/push/unsubscribe']);
  });
});

describe('mailbox WS gate is per relay', () => {
  it("the origin uses the legacy formula; an added relay needs its own health's ws flag and no pin block", () => {
    const idA = freshIdentity(); const idB = freshIdentity();
    const { fetchT } = makeFetchT([
      { prefix: API, env: envWith(idA) }, { prefix: B_API, env: envWith(idB) }]);
    const c = buildClient({ fetchT, settings: {
      relayPin: idA.publicKey, relays: [{ url: B_ORIGIN, pin: idB.publicKey, label: 'b' }] } });
    const gateFn = new Function(
      'API', '_isLeaderTab', 'document', 'window', '_relayPinGate', '_relayBlockedUrls',
      '_relayHealthByUrl', 'isOriginRelay',
      `${sliceBetween('function mailboxWsWanted(relay)', 'async function maybeStartMailboxWs')}
       return { mailboxWsWanted };`);
    const health = new Map();
    const { mailboxWsWanted } = gateFn(
      API, true, { hidden: false }, { _serverFeatures: { ws: true } }, c.gate,
      c._relayBlockedUrls, health, c.isOriginRelay);
    const [origin, added] = c.homeRelays();
    expect(mailboxWsWanted(origin)).toBe(true);
    expect(mailboxWsWanted(added)).toBe(false); // no health seen yet → no socket
    health.set(B_ORIGIN, { features: { ws: true } });
    expect(mailboxWsWanted(added)).toBe(true);
    health.set(B_ORIGIN, { features: { ws: false } });
    expect(mailboxWsWanted(added)).toBe(false);
    health.set(B_ORIGIN, { features: { ws: true } });
    c._relayBlockedUrls.add(B_ORIGIN);
    expect(mailboxWsWanted(added)).toBe(false); // pin-blocked: no socket either
  });
});

describe('live drill — two Node hosts, primary stopped mid-session', () => {
  it('still receives via the second relay after the primary is stopped', async () => {
    const dbA = new DatabaseSync(':memory:');
    const dbB = new DatabaseSync(':memory:');
    const idB = loadOrCreateRelayIdentity(dbB);
    const serverA = createRelayServer({ env: buildRelayEnv({ db: dbA, rootDir: REPO_ROOT, source: {} }) });
    const serverB = createRelayServer({ env: buildRelayEnv({ db: dbB, rootDir: REPO_ROOT, source: {} }) });
    await new Promise((r) => serverA.listen(0, '127.0.0.1', r));
    await new Promise((r) => serverB.listen(0, '127.0.0.1', r));
    const baseA = `http://127.0.0.1:${serverA.address().port}`;
    const baseB = `http://127.0.0.1:${serverB.address().port}`;
    const closeServer = async (s) => { s.closeAllConnections?.(); await new Promise((r) => s.close(r)); };
    try {
      const { fetchT } = makeFetchT([{ prefix: baseA, real: true }, { prefix: baseB, real: true }]);
      const c = buildClient({ fetchT, settings: {}, origin: baseA, api: baseA + '/api' });
      // Add B the way the UI does: attestation first, fingerprint shown.
      const att = await c.attestNewRelay(baseB);
      expect(att.error).toBeUndefined();
      expect(att.fingerprint).toBe(relayFingerprint(idB.publicKey));
      await c.addHomeRelay({ url: att.url, pin: att.relayKey, label: 'second', health: att.health });
      expect(c.homeRelays()).toHaveLength(2);

      const depositHttp = (base, payload) => fetch(base + '/api/sealed/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: MY_ID, envelope: JSON.stringify({ to: MY_ID, n: ++_depN, ts: Date.now(), payload }) }),
      });
      const received = [];
      const poll = buildPoll(c, {
        handleIncoming: async (env) => { received.push(env.payload); },
        checkAndReplenishPreKeys: () => {},
      });
      // buildPoll is wired to the mock ORIGIN/API for its own params;
      // the poll cycle itself only speaks through the client's
      // resolver, which is bound to the live hosts above.
      await depositHttp(baseA, 'via-primary');
      await depositHttp(baseB, 'via-second');
      await poll.pollOnce();
      expect(received.sort()).toEqual(['via-primary', 'via-second']);
      await flush();
      const drain = async (base) => (await (await fetch(base + '/api/sealed/poll', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: MY_ID }),
      })).json()).messages.length;
      expect(await drain(baseA)).toBe(0);
      expect(await drain(baseB)).toBe(0);

      // The primary dies mid-session. The second relay keeps serving.
      await closeServer(serverA);
      await depositHttp(baseB, 'after-primary-death');
      received.length = 0;
      await poll.pollOnce();
      expect(received).toEqual(['after-primary-death']);
    } finally {
      await closeServer(serverA).catch(() => {});
      await closeServer(serverB).catch(() => {});
      dbA.close(); dbB.close();
    }
  });
});
