// Stage-2 step 3 (2026-11-13): registration admission + relay identity.
//
// The admission gate (REGISTRATION_ALLOWLIST in handlePreKeyUpload)
// closes ACCOUNT CREATION on a relay to operator-listed Breeze IDs.
// Three properties are pinned here, at the handler level and again
// black-box over the Node host:
//   1. unset — the default everywhere, including the official
//      deployment — registration is open exactly as before;
//   2. set (possibly empty) — a prekey upload for an ID with no
//      stored bundle is admitted only when listed;
//   3. an existing account is NEVER gated (re-upload, deposits,
//      polls), so closing registration cannot strand anyone already
//      homed on the relay.
// The relay identity suite pins step 3's provisioning: first run
// generates a working Ed25519 pair into the relay_meta table of the
// same SQLite file, later runs load the identical key, and the
// worker's KV surface can neither read nor list it.
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handlePreKeyUpload, handlePreKeyFetch, handleSealedSend, handleSealedPoll } from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { buildRelayEnv, createRelayServer, REPO_ROOT } from '../server/node-host.js';
import { makeSqliteKV } from '../server/sqlite-kv.js';
import { loadOrCreateRelayIdentity, relayFingerprint } from '../server/relay-identity.js';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');

let tmp;
beforeAll(() => { tmp = mkdtempSync(join(tmpdir(), 'breeze-step3-')); });
afterAll(() => { rmSync(tmp, { recursive: true, force: true }); });

const uploadBody = (userId) => ({
  userId, identityKey: `${userId}IK`, signedPreKey: 'SPK', oneTimePreKeys: ['o0', 'o1'],
});
const uploadTo = (env, userId) =>
  handlePreKeyUpload(uploadBody(userId), env, apiRequest('/api/prekey/upload', {}));

describe('registration admission — worker gate', () => {
  it('unset (the default): an unknown ID registers exactly as before', async () => {
    const env = makeEnv();
    expect((await uploadTo(env, 'openalice1')).status).toBe(200);
  });

  it('set: listed IDs register, unlisted unknown IDs are refused and store nothing', async () => {
    const env = makeEnv({ REGISTRATION_ALLOWLIST: 'listedusr1, listedusr2' });
    expect((await uploadTo(env, 'listedusr1')).status).toBe(200);
    const refused = await uploadTo(env, 'stranger01');
    expect(refused.status).toBe(403);
    expect((await refused.json()).code).toBe('REGISTRATION_CLOSED');
    expect(await env.KV.get('prekey:stranger01')).toBeNull();
    const fetchRes = await handlePreKeyFetch({ userId: 'stranger01' }, env, apiRequest('/api/prekey/fetch', {}));
    expect(fetchRes.status).toBe(404);
  });

  it('set-but-empty: registration is closed to everyone new', async () => {
    const env = makeEnv({ REGISTRATION_ALLOWLIST: '' });
    const res = await uploadTo(env, 'anybody001');
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('REGISTRATION_CLOSED');
  });

  it('an existing account is never gated: re-upload and delivery survive closing', async () => {
    const env = makeEnv();
    expect((await uploadTo(env, 'homeduser1')).status).toBe(200); // registers while open
    env.REGISTRATION_ALLOWLIST = 'someoneelse'; // operator closes; homeduser1 not listed
    expect((await uploadTo(env, 'homeduser1')).status).toBe(200); // bundle refresh still fine
    const sent = await handleSealedSend(
      { to: 'homeduser1', envelope: 'STILL-DELIVERS' }, env, apiRequest('/api/sealed/send', {}));
    expect(sent.status).toBe(200);
    const polled = await handleSealedPoll({ id: 'homeduser1' }, env, apiRequest('/api/sealed/poll', {}));
    expect((await polled.json()).messages?.some((m) => m.envelope === 'STILL-DELIVERS')).toBe(true);
  });
});

describe('registration admission — host translation (buildRelayEnv)', () => {
  const build = (source) => buildRelayEnv({ db: new DatabaseSync(':memory:'), source });
  it('a bare entry sets neither variable (step-2 open default preserved)', () => {
    expect(build({}).REGISTRATION_ALLOWLIST).toBeUndefined();
  });
  it('an operator allowlist passes through untouched, empty string included', () => {
    expect(build({ REGISTRATION_ALLOWLIST: 'a,b' }).REGISTRATION_ALLOWLIST).toBe('a,b');
    expect(build({ REGISTRATION_ALLOWLIST: '' }).REGISTRATION_ALLOWLIST).toBe('');
  });
  it('REGISTRATION_OPEN wins over a packaging-supplied allowlist', () => {
    const env = build({ REGISTRATION_ALLOWLIST: '', REGISTRATION_OPEN: '1' });
    expect(env.REGISTRATION_ALLOWLIST).toBeUndefined();
  });
});

describe('relay identity — provisioning into the data file', () => {
  it('first run generates, later runs (and reopens) load the identical working pair', async () => {
    const path = join(tmp, 'identity.db');
    let db = new DatabaseSync(path);
    const first = loadOrCreateRelayIdentity(db);
    expect(first.created).toBe(true);
    expect(Buffer.from(first.publicKey, 'base64')).toHaveLength(32);
    expect(first.fingerprint).toBe(relayFingerprint(first.publicKey));
    expect(first.fingerprint).toMatch(/^([0-9A-F]{4} ){3}[0-9A-F]{4}$/);

    const again = loadOrCreateRelayIdentity(db);
    expect(again.created).toBe(false);
    expect(again.publicKey).toBe(first.publicKey);
    expect(again.privateKey).toBe(first.privateKey);
    db.close();

    db = new DatabaseSync(path); // a restart on the same file
    const reopened = loadOrCreateRelayIdentity(db);
    expect(reopened.created).toBe(false);
    expect(reopened.fingerprint).toBe(first.fingerprint);

    // The stored pair actually works as Ed25519 in the formats step 4
    // will consume (PKCS#8 private, raw public via JWK).
    const priv = createPrivateKey({ key: Buffer.from(first.privateKey, 'base64'), format: 'der', type: 'pkcs8' });
    const pub = createPublicKey({ format: 'jwk', key: {
      kty: 'OKP', crv: 'Ed25519',
      x: Buffer.from(first.publicKey, 'base64').toString('base64url'),
    } });
    const msg = new TextEncoder().encode('breeze-relay-attest:test');
    expect(verify(null, msg, pub, sign(null, msg, priv))).toBe(true);
    db.close();
  });

  it('the private key is unreachable through the worker KV surface', async () => {
    const db = new DatabaseSync(join(tmp, 'isolation.db'));
    const identity = loadOrCreateRelayIdentity(db);
    const kv = makeSqliteKV(db);
    expect(await kv.get('relay-identity-v1')).toBeNull();
    const listed = await kv.list({ prefix: '' });
    expect(listed.keys.map((k) => k.name)).not.toContain('relay-identity-v1');
    const raw = db.prepare('SELECT value FROM relay_meta WHERE key = ?').get('relay-identity-v1');
    expect(JSON.parse(raw.value).privateKey).toBe(identity.privateKey); // it IS in relay_meta
    db.close();
  });
});

describe('closed relay — black-box over the Node host', () => {
  beforeEach(() => {
    globalThis._msgDedup = new Map();
    globalThis._sealedDedup = new Map();
    globalThis._rateLimitMap = new Map();
    globalThis._queueAuthKey = new Map();
  });

  it('allowlisted register, uninvited refused, delivery to the homed account works', async () => {
    const db = new DatabaseSync(join(tmp, 'closed.db'));
    const env = buildRelayEnv({
      db, rootDir: REPO_ROOT, dbPath: join(tmp, 'closed.db'),
      source: { REGISTRATION_ALLOWLIST: 'hostalice' },
    });
    const server = createRelayServer({ env });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = async (path, body) => {
      const res = await fetch(base + path, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    };
    try {
      const alice = { userId: 'hostalice', identityKey: 'hostaliceIK', signedPreKey: 'SPK', oneTimePreKeys: ['o0'] };
      expect((await post('/api/prekey/upload', alice)).status).toBe(200);
      const mallory = { userId: 'hostmallory', identityKey: 'hostmalloryIK', signedPreKey: 'SPK' };
      const refused = await post('/api/prekey/upload', mallory);
      expect(refused.status).toBe(403);
      expect(refused.json.code).toBe('REGISTRATION_CLOSED');
      expect((await post('/api/prekey/upload', alice)).status).toBe(200); // re-upload not gated
      expect((await post('/api/sealed/send', { to: 'hostalice', envelope: 'FOR-ALICE' })).status).toBe(200);
      const polled = await post('/api/sealed/poll', { id: 'hostalice' });
      expect(polled.json.messages?.some((m) => m.envelope === 'FOR-ALICE')).toBe(true);
    } finally {
      server.closeAllConnections?.();
      await new Promise((resolve) => server.close(resolve));
      try { db.close(); } catch { /* already closed */ }
    }
  }, 20000);
});
