// Stage-2 step 4 (2026-11-13): relay identity key + client pinning
// (docs/RELAY_STAGE2_PLAN.md, design D3 — the pin authenticates
// continuity, not virtue).
//
// Three surfaces are pinned here:
//  1. The worker surface: /api/health advertises `relayKey` (public
//     half) only when BOTH env halves are configured, and
//     POST /api/relay/attest returns a live Ed25519 signature over
//     `breeze-relay-attest:{relayKey}:{nonce}` — bound to this key
//     and this nonce, so a signature from another relay, for another
//     nonce, or under another domain string never verifies.
//  2. The Node host wiring: buildRelayEnv exposes the step-3 volume
//     key (server/relay-identity.js) as the worker's env pair, and a
//     real HTTP round trip through createRelayServer attests with
//     the very key the boot log fingerprints.
//  3. The client pin (extracted from index.html and run against the
//     REAL worker over the extracted postAPIRaw): first contact
//     TOFU-stores the verified key in _settings.relayPin; a later
//     key change or an unverifiable attestation latches
//     _relayPinGate.blocked and postAPIRaw refuses every call; a
//     pre-step-4 relay (no key) stores nothing and blocks nothing;
//     an unreachable attestation is no evidence either way.
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
const toB64 = (bytes) => Buffer.from(bytes).toString('base64');

beforeEach(() => {
  globalThis._rateLimitMap = new Map();
  globalThis._presenceCache = new Map();
  globalThis._msgDedup = new Map();
  globalThis._sealedDedup = new Map();
  globalThis._queueAuthKey = new Map();
});

// A fresh keypair in the exact formats relay-identity.js stores.
function freshIdentity() {
  const db = new DatabaseSync(':memory:');
  const id = loadOrCreateRelayIdentity(db);
  db.close();
  return id;
}
const envWith = (id, extra = {}) => makeEnv({
  RELAY_PUBLIC_KEY: id.publicKey, RELAY_PRIVATE_KEY: id.privateKey, ...extra,
});
const getHealth = (env) => worker.fetch(new Request('https://breeze.test/api/health'), env)
  .then((r) => r.json());
const postAttest = (env, body, ip = '203.0.113.9') => worker.fetch(new Request('https://breeze.test/api/relay/attest', {
  method: 'POST', headers: { 'CF-Connecting-IP': ip }, body: JSON.stringify(body),
}), env);
async function verifyAttest(pubB64, nonce, sigB64, keyInDomain = pubB64) {
  const pub = await crypto.subtle.importKey('raw', Buffer.from(pubB64, 'base64'), { name: 'Ed25519' }, false, ['verify']);
  return crypto.subtle.verify({ name: 'Ed25519' }, pub, Buffer.from(sigB64, 'base64'),
    new TextEncoder().encode(`breeze-relay-attest:${keyInDomain}:${nonce}`));
}

describe('worker — health advertises relayKey only for a complete identity', () => {
  it('is null when no identity is configured (pre-step-4 relay)', async () => {
    const j = await getHealth(makeEnv());
    expect(j.relayKey).toBeNull();
  });

  it('carries the public half when both env halves are set', async () => {
    const id = freshIdentity();
    const j = await getHealth(envWith(id));
    expect(j.relayKey).toBe(id.publicKey);
    expect(j.capabilities).toContain('relay-attest');
    expect(j.endpoints).toBe(42); // +3: the backup simple-* endpoints (recovery plan step 4)
  });

  it('stays null when only one half is set — never advertise an unattestable key', async () => {
    const id = freshIdentity();
    expect((await getHealth(makeEnv({ RELAY_PUBLIC_KEY: id.publicKey }))).relayKey).toBeNull();
    expect((await getHealth(makeEnv({ RELAY_PRIVATE_KEY: id.privateKey }))).relayKey).toBeNull();
  });
});

describe('worker — POST /api/relay/attest', () => {
  it('signs the domain string bound to its key and the client nonce', async () => {
    const id = freshIdentity();
    const res = await postAttest(envWith(id), { nonce: 'abc123nonceXYZ' });
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.relayKey).toBe(id.publicKey);
    expect(await verifyAttest(id.publicKey, 'abc123nonceXYZ', j.sig)).toBe(true);
  });

  it('fails verification for a replayed nonce and for a wrong key', async () => {
    const id = freshIdentity();
    const other = freshIdentity();
    const j = await (await postAttest(envWith(id), { nonce: 'nonce-one-123' })).json();
    // Same signature, different nonce → not a proof for this challenge.
    expect(await verifyAttest(id.publicKey, 'nonce-two-456', j.sig)).toBe(false);
    // Same signature, verified against a different relay's key → false.
    expect(await verifyAttest(other.publicKey, 'nonce-one-123', j.sig)).toBe(false);
    // Signature minted under a domain string naming a DIFFERENT key →
    // false: the embedded key binds the attestation to this relay.
    expect(await verifyAttest(id.publicKey, 'nonce-one-123', j.sig, other.publicKey)).toBe(false);
  });

  it('answers 501 when the relay has no identity', async () => {
    const res = await postAttest(makeEnv(), { nonce: 'abc123nonceXYZ' });
    expect(res.status).toBe(501);
    expect((await res.json()).code).toBe('RELAY_IDENTITY_NOT_CONFIGURED');
  });

  it('rejects malformed nonces, including ones that would blur the signed fields', async () => {
    const env = envWith(freshIdentity());
    for (const nonce of [undefined, null, 42, '', 'short', 'has:colon: init', 'white space here', 'x'.repeat(129)]) {
      const res = await postAttest(env, { nonce });
      expect(res.status, `nonce=${JSON.stringify(nonce)}`).toBe(400);
      expect((await res.json()).code).toBe('INVALID_NONCE');
    }
  });

  it('is rate-limited like the other cheap routes (20/min per IP)', async () => {
    const env = envWith(freshIdentity());
    let last;
    for (let i = 0; i < 21; i++) last = await postAttest(env, { nonce: `nonce-${i}-abcdefgh` });
    expect(last.status).toBe(429);
  });
});

describe('node host — the volume key becomes the worker env pair', () => {
  it('buildRelayEnv wires the database identity into env', () => {
    const db = new DatabaseSync(':memory:');
    const env = buildRelayEnv({ db, rootDir: REPO_ROOT, source: {} });
    const id = loadOrCreateRelayIdentity(db);
    expect(env.RELAY_PUBLIC_KEY).toBe(id.publicKey);
    expect(env.RELAY_PRIVATE_KEY).toBe(id.privateKey);
    db.close();
  });

  it('serves health + attestation over real HTTP with the volume key', async () => {
    const db = new DatabaseSync(':memory:');
    const id = loadOrCreateRelayIdentity(db);
    const env = buildRelayEnv({ db, rootDir: REPO_ROOT, source: {} });
    const server = createRelayServer({ env });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const base = `http://127.0.0.1:${server.address().port}`;
      const health = await (await fetch(base + '/api/health')).json();
      expect(health.relayKey).toBe(id.publicKey);
      const res = await fetch(base + '/api/relay/attest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce: 'host-nonce-42' }),
      });
      expect(res.status).toBe(200);
      const j = await res.json();
      expect(await verifyAttest(id.publicKey, 'host-nonce-42', j.sig)).toBe(true);
    } finally {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      db.close();
    }
  });
});

// ─── Client pin, extracted from index.html ────────────────────────
// The extraction pattern follows tests/outbox-idb.test.js: the real
// shipped functions, executed with injected seams.
function sliceBetween(startMarker, endMarker) {
  const start = INDEX.indexOf(startMarker);
  const end = INDEX.indexOf(endMarker);
  expect(start, `marker ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `marker ${endMarker}`).toBeGreaterThan(start);
  return INDEX.slice(start, end);
}

function buildClient({ env, settings = {}, fetchTImpl = null }) {
  const calls = { fetchT: 0, saveSettings: 0, toasts: [], announces: [], audits: [] };
  // One fetchT seam for everything the extracted code does — health
  // GETs and postAPIRaw POSTs alike — routed into the REAL worker, so
  // the pin check runs the shipped client code against the shipped
  // server code, with only the transport faked.
  const API = 'https://relay.test/api';
  const baseFetchT = fetchTImpl || (async (url, opts) => {
    if (opts?.method === 'POST') {
      return worker.fetch(new Request(url, {
        method: 'POST', headers: { 'CF-Connecting-IP': '203.0.113.9' }, body: opts.body,
      }), env);
    }
    return worker.fetch(new Request(url), env);
  });
  const fetchT = async (url, opts) => { calls.fetchT++; return baseFetchT(url, opts); };
  const gateFn = new Function('API', '_H', 'fetchT',
    `${sliceBetween('const _relayPinGate', '// ═══ Title helper')}
     return { _relayPinGate, postAPIRaw };`);
  const gate = gateFn(API, { 'Content-Type': 'application/json' }, fetchT);
  const verifyFn = new Function('_hasEd25519', '_dbg',
    `${sliceBetween('async function verifySignature', '// ===== Server health check =====')}
     return verifySignature;`);
  const verifySignature = verifyFn(true, () => {});
  const pinFn = new Function(
    'API', 'fetchT', 'postAPIRaw', 'verifySignature', '_settings', 'saveSettings',
    'showToast', 'announceToSR', 'auditLog', '_dbg', 't', '_relayPinGate',
    `${sliceBetween('// ===== Relay identity pin (stage-2 step 4) =====', '// v3.6: Proactive storage quota check')}
     return { checkRelayPin, relayFingerprint };`);
  const pin = pinFn(
    API, fetchT, gate.postAPIRaw, verifySignature, settings,
    async () => { calls.saveSettings++; },
    (text, type) => { calls.toasts.push({ text, type }); },
    (text) => { calls.announces.push(text); },
    (kind, msg) => { calls.audits.push({ kind, msg }); },
    () => {},
    (key, ...args) => key + (args.length ? ':' + args.join(',') : ''),
    gate._relayPinGate,
  );
  return { ...pin, gate: gate._relayPinGate, postAPIRaw: gate.postAPIRaw, settings, calls };
}

describe('client — relay pin (extracted from index.html)', () => {
  it('TOFU: first contact verifies the attestation and stores the pin', async () => {
    const id = freshIdentity();
    const c = buildClient({ env: envWith(id) });
    await c.checkRelayPin();
    expect(c.settings.relayPin).toBe(id.publicKey);
    expect(c.calls.saveSettings).toBe(1);
    expect(c.gate.blocked).toBe(false);
    expect(c.calls.toasts.some((x) => x.text.startsWith('relayPinned:'))).toBe(true);
    // The fingerprint the client shows is the fingerprint the relay
    // prints in its boot log — same key, same derivation, byte-equal.
    expect(await c.relayFingerprint(id.publicKey)).toBe(relayFingerprint(id.publicKey));
  });

  it('returning session: matching pin + valid attestation passes quietly', async () => {
    const id = freshIdentity();
    const c = buildClient({ env: envWith(id), settings: { relayPin: id.publicKey } });
    await c.checkRelayPin();
    expect(c.gate.blocked).toBe(false);
    expect(c.settings.relayPin).toBe(id.publicKey);
    expect(c.calls.saveSettings).toBe(0); // no re-pin, no churn
    expect(c.calls.toasts).toEqual([]);
  });

  it('key change: a different advertised key latches the hard stop and refuses API calls', async () => {
    const id = freshIdentity();
    const other = freshIdentity();
    const c = buildClient({ env: envWith(other), settings: { relayPin: id.publicKey } });
    await c.checkRelayPin();
    expect(c.gate.blocked).toBe(true);
    expect(c.calls.toasts.some((x) => x.text === 'relayKeyChanged' && x.type === 'error')).toBe(true);
    expect(c.calls.announces).toContain('relayKeyChanged');
    expect(c.calls.audits.some((a) => a.kind === 'security')).toBe(true);
    // The pin is never silently re-written to the substitute's key.
    expect(c.settings.relayPin).toBe(id.publicKey);
    // And the funnel refuses: resolves null without touching fetchT.
    const before = c.calls.fetchT;
    await expect(c.postAPIRaw('/sealed/poll', {})).resolves.toBeNull();
    expect(c.calls.fetchT).toBe(before);
  });

  it('unverifiable attestation against a pinned key blocks (advertised key, absent holder)', async () => {
    const id = freshIdentity();
    const impostor = freshIdentity();
    // Health advertises id.publicKey but the private half is someone
    // else's — the substitute replays the public key without holding it.
    const env = makeEnv({ RELAY_PUBLIC_KEY: id.publicKey, RELAY_PRIVATE_KEY: impostor.privateKey });
    const c = buildClient({ env, settings: { relayPin: id.publicKey } });
    await c.checkRelayPin();
    expect(c.gate.blocked).toBe(true);
    expect(c.calls.toasts.some((x) => x.text === 'relayKeyChanged')).toBe(true);
  });

  it('first contact with an unverifiable attestation pins NOTHING and does not block', async () => {
    const id = freshIdentity();
    const impostor = freshIdentity();
    const env = makeEnv({ RELAY_PUBLIC_KEY: id.publicKey, RELAY_PRIVATE_KEY: impostor.privateKey });
    const c = buildClient({ env, settings: {} });
    await c.checkRelayPin();
    expect(c.settings.relayPin).toBeUndefined();
    expect(c.calls.saveSettings).toBe(0);
    expect(c.gate.blocked).toBe(false);
    expect(c.calls.audits.some((a) => a.kind === 'security')).toBe(true);
  });

  it('pre-step-4 relay (no key): legacy trust — nothing pinned, nothing blocked', async () => {
    const c = buildClient({ env: makeEnv(), settings: {} });
    await c.checkRelayPin();
    expect(c.settings.relayPin).toBeUndefined();
    expect(c.calls.saveSettings).toBe(0);
    expect(c.gate.blocked).toBe(false);
    expect(c.calls.toasts).toEqual([]);
  });

  it('attestation unreachable (network failure) is no evidence: a pinned client is not blocked', async () => {
    const id = freshIdentity();
    const env = envWith(id);
    const failingFetch = async (url, opts) => {
      if (opts?.method === 'POST') throw new Error('network down'); // postAPIRaw turns this into null
      return worker.fetch(new Request(url), env);
    };
    const c = buildClient({ env, settings: { relayPin: id.publicKey }, fetchTImpl: failingFetch });
    await c.checkRelayPin();
    expect(c.gate.blocked).toBe(false);
    expect(c.settings.relayPin).toBe(id.publicKey);
  });
});
