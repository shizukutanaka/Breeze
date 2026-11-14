// Recovery plan step 4 — the simple mode (docs/IDENTITY_RECOVERY_PLAN.md
// §4 step 4 as re-scoped by the data-principle correction, §5): the
// third of the owner's three recovery modes. The account and its
// encrypted backup live ONLY on the user's own placement; the mode is
// offered only where the connected relay opted into backup storage.
//
// What is pinned here:
//
//   Worker (the real _worker.js handlers, mock KV):
//   1. The simple endpoints sit behind the same BACKUP_STORAGE_ENABLED
//      opt-in as the legacy backup — refused by default, nothing
//      stored, nothing served.
//   2. Upload is owner-authenticated from day one: the first upload
//      binds the slot to the signing pub it proves; a later overwrite
//      by any other key is refused; the owner's own re-upload lands.
//   3. Download takes ONLY a locator — no locator, no blob (the cold
//      defect of the legacy path, §1.6 defect 1, has no counterpart
//      here): a missing/malformed locator is a 400, an unknown one
//      (a wrong passphrase derives exactly this) is the same 404 as a
//      nonexistent account.
//   4. Delete is owner-signed and idempotent.
//   5. Health advertises features.backupStorage as the exact opt-in
//      predicate the client gates the mode's entries on.
//
//   Client (the real createBackupTools from src/app/backup.js, wired
//   to the REAL worker handlers as its relay — one drill, both sides):
//   6. Enroll → wipe → COLD restore on a fresh mock IDB reproduces the
//      identity, the signing record, contacts, prekey privates and
//      messages; the mode is recorded only after the upload landed.
//   7. A wrong passphrase finds nothing and creates NOTHING; a
//      storage-disabled relay is named and creates NOTHING.
//   8. Update re-uploads under the same locator; a changed passphrase
//      is confirmed as a change and re-points the record.
//   9. /wipe's erasure removes the slot; dispatch routes a 'simple'
//      identity to the live simple restore, others to the legacy one.
//
//   Creation + wiring:
//  10. createIdentity(name, alias, 'simple') mints random keys with
//      NO phrase shown and NO mode recorded (enrollment records it).
//  11. The setup entries ship hidden and are unhidden only on the
//      relay's backupStorage report; /backup offers the simple
//      button under the same gate; /security renders the mode; all
//      new i18n keys exist in EN + JA (+ the user-facing set in the
//      other six locales).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, {
  handleBackupSimpleUpload, handleBackupSimpleDownload, handleBackupSimpleDelete,
} from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { createBackupTools } from '../src/app/backup.js';
import { createSeedHelper } from '../src/crypto/seed.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const backupMod = readFileSync(join(HERE, '..', 'src', 'app', 'backup.js'), 'utf8');
const workerSrc = readFileSync(join(HERE, '..', '_worker.js'), 'utf8');
const ja = JSON.parse(readFileSync(join(HERE, '..', 'locales', 'ja.json'), 'utf8'));
const DAY_MS = 86400 * 1000;

const LOCATOR = Buffer.alloc(32, 7).toString('base64'); // a 32-byte HMAC, base64 — the shape _simpleLocator returns
const LOCATOR_B = Buffer.alloc(32, 9).toString('base64');

async function edFixture() {
  const kp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pubRaw = await crypto.subtle.exportKey('raw', kp.publicKey);
  const pub = Buffer.from(new Uint8Array(pubRaw)).toString('base64');
  const sign = async (text) => Buffer.from(new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, kp.privateKey, new TextEncoder().encode(text)))).toString('base64');
  return { kp, pub, sign };
}
const upReq = (b) => apiRequest('/api/backup/simple-upload', b);
const dlReq = (b) => apiRequest('/api/backup/simple-download', b);
const delReq = (b) => apiRequest('/api/backup/simple-delete', b);
async function uploadBody(fx, locator = LOCATOR, backup = 'BLOB') {
  const ts = Date.now();
  return { locator, backup, pub: fx.pub, ts, sig: await fx.sign(`breeze-backup-simple-upload:${locator}:${ts}`) };
}

describe('simple-mode worker endpoints (BACKUP_STORAGE_ENABLED opt-in)', () => {
  it('upload is refused by default and stores nothing', async () => {
    const fx = await edFixture();
    const e = makeEnv();
    const res = await handleBackupSimpleUpload(await uploadBody(fx), e, upReq({}));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('BACKUP_DISABLED');
    expect(await e.KV.get(`sbackup:${LOCATOR}`)).toBeNull();
  });

  it('download and delete are refused by default too', async () => {
    const fx = await edFixture();
    const e = makeEnv();
    await e.KV.put(`sbackup:${LOCATOR}`, JSON.stringify({ backup: 'BLOB', pub: fx.pub, updatedAt: 1 }));
    const dl = await handleBackupSimpleDownload({ locator: LOCATOR }, e, dlReq({}));
    expect(dl.status).toBe(403);
    expect((await dl.json()).code).toBe('BACKUP_DISABLED');
    const ts = Date.now();
    const del = await handleBackupSimpleDelete(
      { locator: LOCATOR, ts, sig: await fx.sign(`breeze-backup-simple-delete:${LOCATOR}:${ts}`) }, e, delReq({}));
    expect(del.status).toBe(403);
    expect(await e.KV.get(`sbackup:${LOCATOR}`)).not.toBeNull();
  });

  it('opt-in upload binds the slot to the proven pub, with the 90-day retention', async () => {
    const fx = await edFixture();
    const e = makeEnv({ BACKUP_STORAGE_ENABLED: 'true' });
    const before = Date.now();
    const res = await handleBackupSimpleUpload(await uploadBody(fx), e, upReq({}));
    expect(res.status).toBe(200);
    const rec = JSON.parse(await e.KV.get(`sbackup:${LOCATOR}`));
    expect(rec.backup).toBe('BLOB');
    expect(rec.pub).toBe(fx.pub);
    const exp = e.KV.exp.get(`sbackup:${LOCATOR}`);
    expect(exp, 'stored slot carries an expiry').toBeGreaterThan(before + 89 * DAY_MS);
    expect(exp).toBeLessThan(Date.now() + 91 * DAY_MS);
  });

  it('a first upload with a bad signature is refused and binds nothing', async () => {
    const fx = await edFixture();
    const other = await edFixture();
    const e = makeEnv({ BACKUP_STORAGE_ENABLED: 'true' });
    const body = await uploadBody(fx);
    body.sig = await other.sign(`breeze-backup-simple-upload:${LOCATOR}:${body.ts}`); // signed by a different key than pub claims
    const res = await handleBackupSimpleUpload(body, e, upReq({}));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('SIG_INVALID');
    expect(await e.KV.get(`sbackup:${LOCATOR}`)).toBeNull();
  });

  it('a bound slot refuses an overwrite by another key; the owner re-upload lands', async () => {
    const fx = await edFixture();
    const stranger = await edFixture();
    const e = makeEnv({ BACKUP_STORAGE_ENABLED: 'true' });
    expect((await handleBackupSimpleUpload(await uploadBody(fx), e, upReq({}))).status).toBe(200);
    const attack = await uploadBody(stranger, LOCATOR, 'EVIL');
    attack.pub = stranger.pub; // even honestly presenting their own pub: not the owner
    const refused = await handleBackupSimpleUpload(attack, e, upReq({}));
    expect(refused.status).toBe(403);
    expect(JSON.parse(await e.KV.get(`sbackup:${LOCATOR}`)).backup).toBe('BLOB');
    const again = await handleBackupSimpleUpload(await uploadBody(fx, LOCATOR, 'BLOB2'), e, upReq({}));
    expect(again.status).toBe(200);
    expect(JSON.parse(await e.KV.get(`sbackup:${LOCATOR}`)).backup).toBe('BLOB2');
  });

  it('download serves the blob to whoever names the slot — and only then', async () => {
    const fx = await edFixture();
    const e = makeEnv({ BACKUP_STORAGE_ENABLED: 'true' });
    await handleBackupSimpleUpload(await uploadBody(fx), e, upReq({}));
    const ok = await handleBackupSimpleDownload({ locator: LOCATOR }, e, dlReq({}));
    expect(ok.status).toBe(200);
    const j = await ok.json();
    expect(j.backup).toBe('BLOB');
    expect(j.pub).toBe(fx.pub); // the client binds the restored signing record to this
    // No locator → no fetch (there is no userId-shaped path to the blob).
    expect((await handleBackupSimpleDownload({}, e, dlReq({}))).status).toBe(400);
    expect((await handleBackupSimpleDownload({ userId: 'user00001' }, e, dlReq({}))).status).toBe(400);
    // A malformed locator is a 400; a well-formed but unknown one (what a
    // wrong passphrase derives) is the same 404 as a nonexistent account.
    expect((await handleBackupSimpleDownload({ locator: 'not-a-locator' }, e, dlReq({}))).status).toBe(400);
    const unknown = await handleBackupSimpleDownload({ locator: LOCATOR_B }, e, dlReq({}));
    expect(unknown.status).toBe(404);
    expect((await unknown.json()).code).toBe('NOT_FOUND');
  });

  it('delete is owner-signed, removes the slot, and is idempotent', async () => {
    const fx = await edFixture();
    const stranger = await edFixture();
    const e = makeEnv({ BACKUP_STORAGE_ENABLED: 'true' });
    await handleBackupSimpleUpload(await uploadBody(fx), e, upReq({}));
    const ts = Date.now();
    const badDel = await handleBackupSimpleDelete(
      { locator: LOCATOR, ts, sig: await stranger.sign(`breeze-backup-simple-delete:${LOCATOR}:${ts}`) }, e, delReq({}));
    expect(badDel.status).toBe(403);
    expect(await e.KV.get(`sbackup:${LOCATOR}`)).not.toBeNull();
    const ts2 = Date.now();
    const okDel = await handleBackupSimpleDelete(
      { locator: LOCATOR, ts: ts2, sig: await fx.sign(`breeze-backup-simple-delete:${LOCATOR}:${ts2}`) }, e, delReq({}));
    expect(okDel.status).toBe(200);
    expect(await e.KV.get(`sbackup:${LOCATOR}`)).toBeNull();
    const ts3 = Date.now();
    const again = await handleBackupSimpleDelete(
      { locator: LOCATOR, ts: ts3, sig: await fx.sign(`breeze-backup-simple-delete:${LOCATOR}:${ts3}`) }, e, delReq({}));
    expect(again.status).toBe(200); // nothing to erase is still success
  });

  it('health advertises backupStorage as the exact opt-in predicate', async () => {
    const getHealth = (env) => worker.fetch(new Request('https://breeze.test/api/health'), env).then(r => r.json());
    expect((await getHealth(makeEnv())).features.backupStorage).toBe(false);
    expect((await getHealth(makeEnv({ BACKUP_STORAGE_ENABLED: 'false' }))).features.backupStorage).toBe(false);
    expect((await getHealth(makeEnv({ BACKUP_STORAGE_ENABLED: 'true' }))).features.backupStorage).toBe(true);
    expect(workerSrc).toContain('backupStorage: env.BACKUP_STORAGE_ENABLED === \'true\'');
  });
});

// ---------------------------------------------------------------------------
// Client drill — the real backup module against the real worker handlers.
// ---------------------------------------------------------------------------

function mockDb() {
  const stores = { identity: new Map(), contacts: new Map(), messages: new Map() };
  const req = (produce) => {
    const r = {};
    queueMicrotask(() => { try { r.result = produce(); if (r.onsuccess) r.onsuccess(); } catch (e) { r.error = e; if (r.onerror) r.onerror({ target: r }); } });
    return r;
  };
  return {
    _stores: stores,
    transaction(store) {
      const m = stores[store];
      return {
        objectStore: () => ({
          get: (key) => req(() => m.get(key)),
          put: (val, key) => req(() => { const k = key !== undefined ? key : val?.id; m.set(k, val); return k; }),
          getAll: () => req(() => [...m.values()]),
          getAllKeys: () => req(() => [...m.keys()]),
        }),
      };
    },
  };
}
const dbPutInto = (db) => (store, val, key) => new Promise(r => {
  const rq = db.transaction(store).objectStore(store).put(val, key);
  rq.onsuccess = () => r(true); rq.onerror = () => r(false);
});
const dbGetFrom = (db) => (store, key) => new Promise(r => {
  const rq = db.transaction(store).objectStore(store).get(key);
  rq.onsuccess = () => r(rq.result ?? null); rq.onerror = () => r(null);
});
const dbGetAllFrom = (db) => (store) => new Promise(r => {
  const rq = db.transaction(store).objectStore(store).getAll();
  rq.onsuccess = () => r(rq.result || []); rq.onerror = () => r([]);
});

// Mutable harness the global stubs close over; each test reconfigures it.
const H = {
  env: null, toasts: [], reloads: 0, promptAnswers: [], confirmAnswer: true,
  newCreds: null, restoreCreds: null, relayCalls: [],
};
function relayRouter(relay, path, body) {
  H.relayCalls.push(path);
  const req = apiRequest('/api' + path, body);
  if (path === '/backup/simple-upload') return handleBackupSimpleUpload(body, H.env, req);
  if (path === '/backup/simple-download') return handleBackupSimpleDownload(body, H.env, req);
  if (path === '/backup/simple-delete') return handleBackupSimpleDelete(body, H.env, req);
  throw new Error('unrouted relay path ' + path);
}

const GLOBAL_KEYS = ['t', 'showToast', 'showPrompt', 'showConfirm', '_dbg', '_DOM', 'MS', 'CONFIG',
  'API', 'postAPIRaw', 'arr', 'u8', '_promptSimpleRecoveryNew', '_promptSimpleRecoveryRestore', 'location'];
const savedGlobals = {};
beforeAll(() => {
  for (const k of GLOBAL_KEYS) savedGlobals[k] = globalThis[k];
  globalThis.t = (k) => k;
  globalThis.showToast = (msg, type) => { H.toasts.push({ msg, type }); };
  globalThis.showPrompt = async () => (H.promptAnswers.length ? H.promptAnswers.shift() : null);
  globalThis.showConfirm = async () => H.confirmAnswer;
  globalThis._dbg = () => {};
  globalThis._DOM = { get: () => ({ value: '' }) };
  globalThis.MS = { SEC: 1000 };
  globalThis.CONFIG = { PROTOCOL_VERSION: 3, IV_BYTES: 12, PBKDF2_AT_REST_ITERATIONS: 1000, PBKDF2_ITERATIONS: 100, AES_KEY_BITS: 256, TOAST_DURATION_MS: 5 };
  globalThis.API = 'https://relay.test';
  globalThis.postAPIRaw = async (path, body) => relayRouter({ url: 'https://relay.test' }, path, body);
  globalThis.arr = (u8a) => [...u8a];
  globalThis.u8 = (a) => new Uint8Array(a);
  globalThis._promptSimpleRecoveryNew = async () => H.newCreds;
  globalThis._promptSimpleRecoveryRestore = async () => H.restoreCreds;
  globalThis.location = { reload: () => { H.reloads++; } };
});
afterAll(() => {
  for (const k of GLOBAL_KEYS) {
    if (savedGlobals[k] === undefined) delete globalThis[k];
    else globalThis[k] = savedGlobals[k];
  }
});
beforeEach(() => {
  H.toasts = []; H.reloads = 0; H.promptAnswers = []; H.confirmAnswer = true;
  H.newCreds = null; H.restoreCreds = null; H.relayCalls = [];
  H.env = makeEnv({ BACKUP_STORAGE_ENABLED: 'true' });
});

function makeTools(db, signMessage) {
  return createBackupTools({
    db,
    dbGet: dbGetFrom(db), dbPut: dbPutInto(db), dbGetAll: dbGetAllFrom(db),
    authFields: async () => ({}),
    homeRelays: () => [{ url: 'https://relay.test' }],
    postAPIRelay: relayRouter,
    signMessage,
    myId: () => 'drilluser001',
    adoptRestoredSigning: () => {},
  });
}

async function plantAccount(db) {
  const idKeys = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const pubRaw = await crypto.subtle.exportKey('raw', idKeys.publicKey);
  const pubB64 = Buffer.from(new Uint8Array(pubRaw)).toString('base64');
  const sigKeys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const sigPubRaw = await crypto.subtle.exportKey('raw', sigKeys.publicKey);
  const signing = {
    priv: await crypto.subtle.exportKey('jwk', sigKeys.privateKey),
    pub: await crypto.subtle.exportKey('jwk', sigKeys.publicKey),
    pubB64: Buffer.from(new Uint8Array(sigPubRaw)).toString('base64'),
  };
  const keys = { pub: [...new Uint8Array(pubRaw)], priv: await crypto.subtle.exportKey('jwk', idKeys.privateKey), pubB64, name: 'Drill', alias: '' };
  const put = dbPutInto(db);
  await put('identity', keys, 'keys');
  await put('identity', signing, 'signing');
  await put('identity', { priv: { kty: 'OKP', d: 'spk' } }, 'spk-priv');
  await put('contacts', { id: 'peer00000001', pubB64: 'PEERPUBKEY', name: 'Peer' });
  await put('messages', { id: 'm1', text: 'hello', mine: false });
  const signMessage = async (text) => Buffer.from(new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, sigKeys.privateKey, new TextEncoder().encode(text)))).toString('base64');
  return { keys, signing, signMessage };
}
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

describe('simple mode — enroll → wipe → cold restore (real client, real worker)', () => {
  it('the full drill: the account comes back whole on a fresh device', async () => {
    const dbA = mockDb();
    const acct = await plantAccount(dbA);
    const toolsA = makeTools(dbA, acct.signMessage);

    expect(await toolsA.enrollSimpleRecovery('My Account!', 'correct horse battery')).toBe(true);
    const recA = dbA._stores.identity.get('keys');
    expect(recA.recoveryMode).toBe('simple');
    expect(recA.recoveryAccount).toBe('myaccount'); // normalised: case, spaces and punctuation stripped
    expect(recA.recoveryLocator).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    // The relay holds exactly one slot, under the locator — addressed by
    // neither the userId nor the public key.
    expect([...H.env.KV.store.keys()]).toEqual([`sbackup:${recA.recoveryLocator}`]);
    expect(H.toasts.map(x => x.msg)).toContain('simpleEnrolledUntil');

    // Total device loss: a fresh install, a fresh IDB, nothing but the
    // account name + passphrase the person remembers.
    const dbB = mockDb();
    const toolsB = makeTools(dbB, async () => null);
    H.restoreCreds = { account: 'myaccount', passphrase: 'correct horse battery' };
    await toolsB.restoreSimpleBackup();
    await tick();

    const recB = dbB._stores.identity.get('keys');
    expect(recB.pubB64).toBe(acct.keys.pubB64);
    expect(recB.priv).toEqual(acct.keys.priv);
    // The restore itself writes the mode back (the enrollment-time
    // payload predates the mode patch): a device restored BY the
    // simple path is a simple-mode device.
    expect(recB.recoveryMode).toBe('simple');
    expect(recB.recoveryAccount).toBe('myaccount');
    expect(recB.recoveryLocator).toBe(recA.recoveryLocator);
    expect(dbB._stores.identity.get('signing')?.pubB64).toBe(acct.signing.pubB64);
    expect(dbB._stores.identity.get('spk-priv')).toEqual({ priv: { kty: 'OKP', d: 'spk' } });
    expect(dbB._stores.contacts.get('peer00000001')?.name).toBe('Peer');
    expect(dbB._stores.messages.get('m1')?.text).toBe('hello');
    expect(H.toasts.map(x => x.msg)).toContain('backupRestored');
    expect(H.reloads).toBe(1);
  });

  it('a wrong passphrase finds nothing and creates NOTHING', async () => {
    const dbA = mockDb();
    const acct = await plantAccount(dbA);
    await makeTools(dbA, acct.signMessage).enrollSimpleRecovery('myaccount', 'correct horse battery');

    const dbC = mockDb();
    H.restoreCreds = { account: 'myaccount', passphrase: 'wrong horse battery' };
    await makeTools(dbC, async () => null).restoreSimpleBackup();
    await tick();
    expect(H.toasts.map(x => x.msg)).toContain('simpleNotFound');
    expect(dbC._stores.identity.size).toBe(0);
    expect(dbC._stores.contacts.size).toBe(0);
    expect(H.reloads).toBe(0);
  });

  it('a storage-disabled relay is named, and creates NOTHING', async () => {
    const dbA = mockDb();
    const acct = await plantAccount(dbA);
    await makeTools(dbA, acct.signMessage).enrollSimpleRecovery('myaccount', 'correct horse battery');
    H.env = makeEnv(); // the same slot exists in the other env's KV? No — disabled means refused before any read

    const dbD = mockDb();
    H.restoreCreds = { account: 'myaccount', passphrase: 'correct horse battery' };
    await makeTools(dbD, async () => null).restoreSimpleBackup();
    await tick();
    expect(H.toasts.map(x => x.msg)).toContain('backupRelayDisabled');
    expect(dbD._stores.identity.size).toBe(0);
    expect(H.reloads).toBe(0);
  });

  it('enrollment against a disabled relay records NO mode', async () => {
    H.env = makeEnv(); // storage off
    const db = mockDb();
    const acct = await plantAccount(db);
    expect(await makeTools(db, acct.signMessage).enrollSimpleRecovery('myaccount', 'correct horse battery')).toBe(false);
    expect(H.toasts.map(x => x.msg)).toContain('backupRelayDisabled');
    const rec = db._stores.identity.get('keys');
    expect(rec.recoveryMode).toBeUndefined();
    expect(rec.recoveryLocator).toBeUndefined();
  });

  it('the floors: short passphrase and short account name are refused before any upload', async () => {
    const db = mockDb();
    const acct = await plantAccount(db);
    const tools = makeTools(db, acct.signMessage);
    expect(await tools.enrollSimpleRecovery('myaccount', 'short')).toBe(false);
    expect(H.toasts.map(x => x.msg)).toContain('simplePassMin');
    expect(await tools.enrollSimpleRecovery('ab', 'correct horse battery')).toBe(false);
    expect(H.toasts.map(x => x.msg)).toContain('simpleAccountMin');
    expect(H.env.KV.store.size).toBe(0);
    expect(H.relayCalls).toHaveLength(0);
  });

  it("a disposable ('none') identity cannot enroll, via either entry", async () => {
    const db = mockDb();
    const acct = await plantAccount(db);
    db._stores.identity.get('keys').recoveryMode = 'none';
    const tools = makeTools(db, acct.signMessage);
    expect(await tools.enrollSimpleRecovery('myaccount', 'correct horse battery')).toBe(false);
    await tools.simpleBackupAction();
    expect(H.toasts.map(x => x.msg)).toEqual(['toastRecoveryNoneBackup', 'toastRecoveryNoneBackup']);
    expect(H.env.KV.store.size).toBe(0);
  });
});

describe('simple mode — update, dispatch, erasure', () => {
  async function enrolled() {
    const db = mockDb();
    const acct = await plantAccount(db);
    const tools = makeTools(db, acct.signMessage);
    await tools.enrollSimpleRecovery('myaccount', 'correct horse battery');
    H.toasts = [];
    return { db, acct, tools };
  }

  it('update with the same passphrase re-uploads under the SAME locator', async () => {
    const { db, tools } = await enrolled();
    const locator = db._stores.identity.get('keys').recoveryLocator;
    const before = JSON.parse(H.env.KV.store.get(`sbackup:${locator}`)).backup;
    H.promptAnswers = ['correct horse battery'];
    await tools.updateSimpleBackup();
    const after = JSON.parse(H.env.KV.store.get(`sbackup:${locator}`)).backup;
    expect(after).not.toBe(before); // fresh salt/IV/payload (new exportedAt)
    expect(db._stores.identity.get('keys').recoveryLocator).toBe(locator);
    expect(H.toasts.map(x => x.msg)).toContain('simpleEnrolledUntil');
  });

  it('a changed passphrase is confirmed as a change and re-points the record', async () => {
    const { db, tools } = await enrolled();
    const oldLocator = db._stores.identity.get('keys').recoveryLocator;
    H.promptAnswers = ['a brand new passphrase'];
    H.confirmAnswer = true;
    await tools.updateSimpleBackup();
    const rec = db._stores.identity.get('keys');
    expect(rec.recoveryLocator).not.toBe(oldLocator);
    // Both slots exist now: the old backup decays on its TTL under the
    // old passphrase; the new one restores with the new passphrase.
    expect(H.env.KV.store.has(`sbackup:${oldLocator}`)).toBe(true);
    expect(H.env.KV.store.has(`sbackup:${rec.recoveryLocator}`)).toBe(true);
  });

  it('declining the passphrase-change confirmation uploads nothing', async () => {
    const { db, tools } = await enrolled();
    const locator = db._stores.identity.get('keys').recoveryLocator;
    H.promptAnswers = ['a brand new passphrase'];
    H.confirmAnswer = false;
    H.relayCalls = [];
    await tools.updateSimpleBackup();
    expect(H.relayCalls).toHaveLength(0);
    expect(db._stores.identity.get('keys').recoveryLocator).toBe(locator);
  });

  it('restoreBackupSmart routes a simple identity to the live simple restore', async () => {
    const { tools } = await enrolled();
    H.promptAnswers = ['correct horse battery'];
    H.relayCalls = [];
    await tools.restoreBackupSmart();
    await tick();
    expect(H.relayCalls).toEqual(['/backup/simple-download']);
    expect(H.toasts.map(x => x.msg)).toContain('backupRestored');
  });

  it('restoreBackupSmart routes a phrase identity to the legacy cloud restore', async () => {
    const db = mockDb();
    const acct = await plantAccount(db);
    db._stores.identity.get('keys').recoveryMode = 'phrase';
    const tools = makeTools(db, acct.signMessage);
    H.promptAnswers = ['whatever-pass'];
    await tools.restoreBackupSmart();
    // The legacy path asked the relay for the userId-keyed backup (the
    // router here does not serve it) and failed on the legacy surface
    // — proof the dispatch went legacy, not simple.
    expect(H.relayCalls).toEqual(['/backup/download']);
    expect(H.toasts.map(x => x.msg)).toContain('backupWrongPass');
  });

  it('eraseSimpleBackup removes the slot (the /wipe path)', async () => {
    const { db, tools } = await enrolled();
    const locator = db._stores.identity.get('keys').recoveryLocator;
    expect(H.env.KV.store.has(`sbackup:${locator}`)).toBe(true);
    await tools.eraseSimpleBackup();
    expect(H.env.KV.store.has(`sbackup:${locator}`)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Creation with the 'simple' marker — the real createIdentity, sliced.
// ---------------------------------------------------------------------------

globalThis.__breezeSeed = createSeedHelper();
function sliceHtml(from, to) {
  const a = html.indexOf(from);
  const b = html.indexOf(to);
  expect(a, `anchor not found: ${from}`).toBeGreaterThan(-1);
  expect(b, `anchor not found: ${to}`).toBeGreaterThan(a);
  return html.slice(a, b);
}
function buildCreate(db) {
  const shown = { calls: 0 };
  const src = [
    'let myKeys = null, myPubB64 = "", myName = "", myAlias = "", myId = "", myShortId = "", _userId = "";',
    sliceHtml('function arr(u8a)', 'function uid()'),
    sliceHtml('async function _seedIdentityMaterial()', 'async function createIdentity'),
    sliceHtml('async function createIdentity(name, alias, disposable', '// DOUBLE RATCHET CRYPTO ENGINE'),
  ].join('\n');
  const factory = new Function('db', '_dbg', 'showToast', 't', '_hasX25519', '_hasEd25519',
    '_promptRecoveryPhraseNew', 'genIdentityKey', 'dbPut', 'auditLog', 'generateShortId', 'localStorage', 'API',
    src + '; return { createIdentity };');
  const api2 = factory(
    db, () => {}, () => {}, (k) => k, true, true,
    async () => { shown.calls++; return 'drill-pass'; },
    async () => crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']),
    dbPutInto(db), () => {}, async () => 'breeze-test-test', { setItem() {} }, null,
  );
  return { ...api2, shown };
}

describe("createIdentity with the 'simple' marker", () => {
  it('mints random keys, shows NO phrase, and records NO mode yet', async () => {
    const db = mockDb();
    const a = buildCreate(db);
    expect(await a.createIdentity('Simple', '', 'simple')).toBe(true);
    expect(a.shown.calls).toBe(0); // no phrase dialog — the mode's secret is the passphrase, chosen at enrollment
    const rec = db._stores.identity.get('keys');
    expect(rec.recoveryMode).toBeUndefined(); // enrollment records it, only after the upload lands
    expect(rec.recoveryAccount).toBeUndefined();
    const db2 = mockDb();
    const b = buildCreate(db2);
    await b.createIdentity('Simple', '', 'simple');
    expect(db2._stores.identity.get('keys').pubB64).not.toBe(rec.pubB64); // random keys, not seed-derived
  });
});

// ---------------------------------------------------------------------------
// Wiring pins — the gating story, in text.
// ---------------------------------------------------------------------------

const SIMPLE_KEYS = ['setupSimple', 'setupSimpleRestore', 'simpleTitle', 'simpleDesc', 'simpleOk',
  'simpleNewDesc', 'simpleAccountLabel', 'simplePassLabel', 'simpleSaved', 'simplePassEnter',
  'simpleAccountMin', 'simplePassMin', 'simpleEnrolled', 'simpleEnrolledUntil', 'simpleNotFound',
  'simpleNotEnrolled', 'simpleBackupBtn', 'simpleRestoreTitle', 'simpleRestoreDesc',
  'simplePassChangeTitle', 'simplePassChangeDesc', 'simplePassChangeOk', 'secRecoverySimple'];

describe('simple mode — wiring pins', () => {
  it('the setup entries ship hidden and are unhidden only on the relay report', () => {
    const simpleBtn = html.match(/<button[^>]*id="b-msg-setup-simple"[^>]*>/);
    const restoreBtn = html.match(/<button[^>]*id="b-msg-setup-simple-restore"[^>]*>/);
    expect(simpleBtn?.[0]).toContain('hidden');
    expect(simpleBtn?.[0]).toContain('data-i18n="setupSimple"');
    expect(restoreBtn?.[0]).toContain('hidden');
    expect(restoreBtn?.[0]).toContain('data-i18n="setupSimpleRestore"');
    // _boot's setup branch consults the relay's advertised features and
    // toggles both buttons on that one report.
    expect(html).toContain('const _sbOk = !!window._serverFeatures?.backupStorage;');
    expect(html).toContain("_DOM.get('b-msg-setup-simple')?.classList.toggle('hidden', !_sbOk);");
    expect(html).toContain("_DOM.get('b-msg-setup-simple-restore')?.classList.toggle('hidden', !_sbOk);");
  });

  it('the create handler confirms honestly, collects credentials, and enrolls after creation', () => {
    expect(html).toContain("_DOM.get('b-msg-setup-simple')?.addEventListener('click', async () => {");
    const handler = html.slice(html.indexOf("_DOM.get('b-msg-setup-simple')?.addEventListener"), html.indexOf("_DOM.get('b-msg-setup-simple-restore')?.addEventListener"));
    expect(handler).toContain("t('simpleDesc')"); // the weaker-than-phrase warning, shown before anything is made
    expect(handler).toContain('_promptSimpleRecoveryNew()');
    expect(handler).toContain("creds.passphrase.length < 8");
    expect(handler).toContain("_runSetupCreate('simple', { account, passphrase: creds.passphrase });");
    expect(html).toContain('async function _runSetupCreate(disposable, simpleCreds = null)');
    expect(html).toContain("if (disposable === 'simple' && simpleCreds) await enrollSimpleRecovery(simpleCreds.account, simpleCreds.passphrase);");
  });

  it("createIdentity's mode record stays binary: only literal true means 'none'", () => {
    expect(html).toContain("disposable === true ? { recoveryMode: 'none' } : {}");
    expect(html).toContain("if (!await createIdentity(name, alias, disposable)) return;");
  });

  it('/backup offers the simple update under the same gate; restore dispatches by recorded mode', () => {
    expect(html).toContain('data-action="backup-simple"');
    expect(html).toContain("${t('simpleBackupBtn')}");
    expect(html).toContain("window._serverFeatures?.backupStorage || _bkRec?.recoveryMode === 'simple'");
    expect(html).toContain("if (e.target.closest('[data-action=\"backup-simple\"]')) { simpleBackupAction(); return; }");
    expect(html).toContain("if (e.target.closest('[data-action=\"restore\"]')) { restoreBackupSmart(); return; }");
  });

  it('/security renders the simple mode and /wipe erases the slot', () => {
    expect(html).toContain("_identRec?.recoveryMode === 'simple' ? '<span class=\"i-g\">✓ ' + t('secRecoverySimple')");
    const wipe = html.slice(html.indexOf("if (val === '/wipe')"), html.indexOf("if (val === '/wipe')") + 4000);
    expect(wipe).toContain('await eraseSimpleBackup();');
    // The backup tools arrive in index.html through the bridge bindings.
    for (const fn of ['enrollSimpleRecovery', 'simpleBackupAction', 'restoreSimpleBackup', 'restoreBackupSmart', 'eraseSimpleBackup']) {
      expect(html, `bridge binding ${fn}`).toContain(`const ${fn} = _backupTools?.${fn} ||`);
    }
    expect(backupMod).toContain('enrollSimpleRecovery, simpleBackupAction, updateSimpleBackup, restoreSimpleBackup, restoreSimpleBackupLive, restoreBackupSmart, eraseSimpleBackup');
  });

  it('the cold-restore entry on the setup screen calls the real restore', () => {
    expect(html).toContain("_DOM.get('b-msg-setup-simple-restore')?.addEventListener('click', () => { restoreSimpleBackup(); });");
  });

  it('all new user-facing strings exist in EN and JA', () => {
    for (const k of SIMPLE_KEYS) {
      expect(html, `EN key ${k}`).toContain(`${k}:`);
      expect(ja[k], `JA key ${k}`).toBeTruthy();
    }
  });
});
