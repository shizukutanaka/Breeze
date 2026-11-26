// Automatic backup, post-recovery auto-restore and the migration
// guide (feat/auto-backup-migration).
//
// What is pinned here:
//
//   Client (the real createBackupTools from src/app/backup.js, wired
//   to the REAL worker handlers as its relay — the recovery-simple
//   drill pattern):
//   1. Throttling: a burst of change notifications produces ONE
//      upload after the debounce quiet period, and a further change
//      inside the minimum interval does not upload until the floor
//      has passed — then it does.
//   2. Offline: a change made offline uploads nothing and stays
//      pending (persisted); the reconnect flush uploads it.
//   3. Gates: settings-off, a backup-less relay, and a session with
//      no armed passphrase each stop the run WITHOUT an upload, and
//      each names itself in getAutoBackupStatus.
//   4. Disposable ('none') identities never upload; the pending debt
//      is cleared (it can never become real) and arming is refused
//      with the existing dedicated toast.
//   5. Simple mode: enrollment arms the session passphrase, and a
//      later change re-uploads under the SAME locator. If the cached
//      passphrase no longer derives the recorded locator (changed
//      elsewhere), the automatic path refuses to fork the backup:
//      no upload, the bad secret is dropped, the state is 'error'.
//   6. Post-recovery restore: with the one-shot justRecovered marker
//      set, checkAutoRestore probes the relay, asks ONCE, and only
//      then restores (contacts come back, a reload is scheduled).
//      Declining writes nothing and consumes the marker; no marker
//      means no probe at all; a backup whose payload names a
//      DIFFERENT identity writes nothing.
//
//   Wiring (index.html / locales slices):
//   7. dbPut notifies the hook for the backup-carried stores; the
//      settings panel carries the toggle, the status line, the arm
//      button and the migration entry; the boot path calls the
//      check + flush; the new i18n keys exist in EN + JA (real
//      translation) and in the other locales (English value).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  handleBackupUpload, handleBackupDownload,
  handleBackupSimpleUpload, handleBackupSimpleDownload, handleBackupSimpleDelete,
} from '../_worker.js';
import { makeEnv, apiRequest } from './helpers/mockKV.js';
import { createBackupTools } from '../src/app/backup.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const backupMod = readFileSync(join(HERE, '..', 'src', 'app', 'backup.js'), 'utf8');
const ja = JSON.parse(readFileSync(join(HERE, '..', 'locales', 'ja.json'), 'utf8'));
const de = JSON.parse(readFileSync(join(HERE, '..', 'locales', 'de.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Harness — the recovery-simple drill, plus a settings store, the
// auto-backup dep switches, and an online switch.
// ---------------------------------------------------------------------------

function mockDb() {
  const stores = { identity: new Map(), contacts: new Map(), messages: new Map(), settings: new Map() };
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

const H = {
  env: null, toasts: [], reloads: 0, promptAnswers: [], confirmAnswer: true, confirmCalls: 0,
  relayCalls: [], autoEnabled: true, serverReady: true, online: true,
};
function relayRouter(relay, path, body) {
  H.relayCalls.push(path);
  const req = apiRequest('/api' + path, body);
  if (path === '/backup/upload') return handleBackupUpload(body, H.env, req);
  if (path === '/backup/download') return handleBackupDownload(body, H.env, req);
  if (path === '/backup/simple-upload') return handleBackupSimpleUpload(body, H.env, req);
  if (path === '/backup/simple-download') return handleBackupSimpleDownload(body, H.env, req);
  if (path === '/backup/simple-delete') return handleBackupSimpleDelete(body, H.env, req);
  throw new Error('unrouted relay path ' + path);
}
const uploads = (path) => H.relayCalls.filter(p => p === path).length;

const GLOBAL_KEYS = ['t', 'showToast', 'showPrompt', 'showConfirm', '_dbg', '_DOM', 'MS', 'CONFIG',
  'API', 'postAPIRaw', 'arr', 'u8', '_promptSimpleRecoveryNew', '_promptSimpleRecoveryRestore', 'location'];
const savedGlobals = {};
let savedNavigator;
beforeAll(() => {
  for (const k of GLOBAL_KEYS) savedGlobals[k] = globalThis[k];
  savedNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { get: () => ({ onLine: H.online }), configurable: true });
  globalThis.t = (k) => k;
  globalThis.showToast = (msg, type) => { H.toasts.push({ msg, type }); };
  globalThis.showPrompt = async () => (H.promptAnswers.length ? H.promptAnswers.shift() : null);
  globalThis.showConfirm = async () => { H.confirmCalls++; return H.confirmAnswer; };
  globalThis._dbg = () => {};
  globalThis._DOM = { get: () => ({ value: '' }) };
  globalThis.MS = { SEC: 1000, MIN: 60000, HOUR: 3600000, DAY: 86400000, WEEK: 604800000 };
  globalThis.CONFIG = { PROTOCOL_VERSION: 3, IV_BYTES: 12, PBKDF2_AT_REST_ITERATIONS: 1000, PBKDF2_ITERATIONS: 100, AES_KEY_BITS: 256, TOAST_DURATION_MS: 5 };
  globalThis.API = 'https://relay.test';
  globalThis.postAPIRaw = async (path, body) => relayRouter({ url: 'https://relay.test' }, path, body);
  globalThis.arr = (u8a) => [...u8a];
  globalThis.u8 = (a) => new Uint8Array(a);
  globalThis._promptSimpleRecoveryNew = async () => null;
  globalThis._promptSimpleRecoveryRestore = async () => null;
  globalThis.location = { reload: () => { H.reloads++; } };
});
afterAll(() => {
  for (const k of GLOBAL_KEYS) {
    if (savedGlobals[k] === undefined) delete globalThis[k];
    else globalThis[k] = savedGlobals[k];
  }
  if (savedNavigator) Object.defineProperty(globalThis, 'navigator', savedNavigator);
  else delete globalThis.navigator;
});
beforeEach(() => {
  H.toasts = []; H.reloads = 0; H.promptAnswers = []; H.confirmAnswer = true; H.confirmCalls = 0;
  H.relayCalls = []; H.autoEnabled = true; H.serverReady = true; H.online = true;
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
    autoBackupEnabled: () => H.autoEnabled,
    backupServerReady: () => H.serverReady,
    autoBackupTiming: { debounceMs: 40, minIntervalMs: 400 },
  });
}

async function plantAccount(db, mode) {
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
  if (mode) keys.recoveryMode = mode;
  const put = dbPutInto(db);
  await put('identity', keys, 'keys');
  await put('identity', signing, 'signing');
  await put('identity', { priv: { kty: 'OKP', d: 'spk' } }, 'spk-priv');
  await put('contacts', { id: 'peer00000001', pubB64: 'PEERPUBKEY', name: 'Peer' });
  await put('messages', { id: 'm1', text: 'hello', mine: false });
  const signMessage = async (text) => Buffer.from(new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' }, sigKeys.privateKey, new TextEncoder().encode(text)))).toString('base64');
  // The legacy backup endpoints verify against the registered bundle.
  await H.env.KV.put('prekey:drilluser001', JSON.stringify({ edIdentityKey: signing.pubB64 }));
  return { keys, signing, signMessage };
}
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------

describe('automatic backup — throttling', () => {
  it('a burst of changes uploads once after the quiet period; the min interval gates the next', async () => {
    const db = mockDb();
    const acct = await plantAccount(db, 'phrase');
    const tools = makeTools(db, acct.signMessage);
    H.promptAnswers = ['passphrase-1'];
    expect(await tools.armAutoBackup()).toBe(true);

    tools.notifyBackupDataChanged();
    tools.notifyBackupDataChanged();
    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/upload')).toBe(1);
    const st1 = await tools.getAutoBackupStatus();
    expect(st1.state).toBe('ok');
    expect(st1.lastOkAt).toBeGreaterThan(0);

    // A new change inside the minimum interval: the debounce fires,
    // the floor refuses, and the upload lands only after it passes.
    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/upload')).toBe(1);
    await tick(600);
    expect(uploads('/backup/upload')).toBe(2);
  });
});

describe('automatic backup — offline hold', () => {
  it('an offline change uploads nothing, stays pending, and the reconnect flush sends it', async () => {
    const db = mockDb();
    const acct = await plantAccount(db, 'phrase');
    const tools = makeTools(db, acct.signMessage);
    H.promptAnswers = ['passphrase-1'];
    expect(await tools.armAutoBackup()).toBe(true);

    H.online = false;
    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/upload')).toBe(0);
    expect((await tools.getAutoBackupStatus()).state).toBe('pending');
    const persisted = await dbGetFrom(db)('settings', 'autoBackupState');
    expect(persisted.pending).toBe(true);

    H.online = true;
    tools.flushAutoBackup();
    await tick(80);
    expect(uploads('/backup/upload')).toBe(1);
    expect((await tools.getAutoBackupStatus()).state).toBe('ok');
  });
});

describe('automatic backup — gates', () => {
  it('settings off: no upload, status names it', async () => {
    const db = mockDb();
    const acct = await plantAccount(db, 'phrase');
    const tools = makeTools(db, acct.signMessage);
    H.autoEnabled = false;
    H.promptAnswers = ['passphrase-1'];
    await tools.armAutoBackup();
    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/upload')).toBe(0);
    expect((await tools.getAutoBackupStatus()).state).toBe('off');
  });

  it('no backup server: no upload, status names it', async () => {
    const db = mockDb();
    const acct = await plantAccount(db, 'phrase');
    const tools = makeTools(db, acct.signMessage);
    H.serverReady = false;
    H.promptAnswers = ['passphrase-1'];
    await tools.armAutoBackup();
    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/upload')).toBe(0);
    expect((await tools.getAutoBackupStatus()).state).toBe('noserver');
  });

  it('no armed passphrase: no upload, status asks for one', async () => {
    const db = mockDb();
    const acct = await plantAccount(db, 'phrase');
    const tools = makeTools(db, acct.signMessage);
    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/upload')).toBe(0);
    expect((await tools.getAutoBackupStatus()).state).toBe('needpass');
  });

  it("disposable ('none') identities never upload and the debt is cleared", async () => {
    const db = mockDb();
    const acct = await plantAccount(db, 'none');
    const tools = makeTools(db, acct.signMessage);
    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/upload')).toBe(0);
    expect(uploads('/backup/simple-upload')).toBe(0);
    expect((await tools.getAutoBackupStatus()).state).toBe('ineligible');
    const persisted = await dbGetFrom(db)('settings', 'autoBackupState');
    expect(persisted.pending).toBe(false);
    // Arming is refused with the dedicated toast, before any prompt.
    expect(await tools.armAutoBackup()).toBe(false);
    expect(H.toasts.map(x => x.msg)).toContain('toastRecoveryNoneBackup');
  });
});

describe('automatic backup — simple mode', () => {
  it('enrollment arms the session; a change re-uploads under the same locator', async () => {
    const db = mockDb();
    const acct = await plantAccount(db);
    const tools = makeTools(db, acct.signMessage);
    expect(await tools.enrollSimpleRecovery('myaccount', 'correct horse battery')).toBe(true);
    const rec = db._stores.identity.get('keys');
    const slotKey = 'sbackup:' + rec.recoveryLocator;
    const before = JSON.parse(await H.env.KV.get(slotKey)).backup;
    expect(uploads('/backup/simple-upload')).toBe(1);

    await dbPutInto(db)('contacts', { id: 'peer00000002', pubB64: 'PEER2PUBKEY', name: 'Peer Two' });
    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/simple-upload')).toBe(2);
    const after = JSON.parse(await H.env.KV.get(slotKey)).backup;
    expect(after).not.toBe(before); // same slot, new ciphertext — the new contact is in
    expect((await tools.getAutoBackupStatus()).state).toBe('ok');
  });

  it('a cached passphrase that no longer derives the recorded locator never forks the backup', async () => {
    const db = mockDb();
    const acct = await plantAccount(db);
    const tools = makeTools(db, acct.signMessage);
    expect(await tools.enrollSimpleRecovery('myaccount', 'correct horse battery')).toBe(true);
    expect(uploads('/backup/simple-upload')).toBe(1);
    // The passphrase was changed on another device: the record now
    // names a locator this device's secret does not derive.
    const rec = db._stores.identity.get('keys');
    rec.recoveryLocator = Buffer.alloc(32, 9).toString('base64');
    await dbPutInto(db)('identity', rec, 'keys');

    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/simple-upload')).toBe(1); // refused — no forked slot
    expect((await tools.getAutoBackupStatus()).state).toBe('error');
    // The bad secret was dropped: the next run stops at needpass.
    tools.notifyBackupDataChanged();
    await tick(150);
    expect(uploads('/backup/simple-upload')).toBe(1);
    expect((await tools.getAutoBackupStatus()).state).toBe('needpass');
  });
});

describe('post-recovery automatic restore', () => {
  async function plantCloudBackup() {
    const dbA = mockDb();
    const acct = await plantAccount(dbA, 'phrase');
    const toolsA = makeTools(dbA, acct.signMessage);
    H.promptAnswers = ['passphrase-1'];
    await toolsA.createCloudBackup();
    expect(await H.env.KV.get('backup:drilluser001')).not.toBeNull();
    return acct;
  }
  async function freshDeviceDb(acct) {
    // A new device after phrase recovery: the identity records are
    // back, the address book and history are not.
    const dbB = mockDb();
    const put = dbPutInto(dbB);
    await put('identity', acct.keys, 'keys');
    await put('identity', acct.signing, 'signing');
    await put('settings', { at: Date.now() }, 'justRecovered');
    return dbB;
  }

  it('asks once before restoring; declining writes nothing and consumes the marker', async () => {
    const acct = await plantCloudBackup();
    const dbB = await freshDeviceDb(acct);
    const toolsB = makeTools(dbB, acct.signMessage);
    H.confirmAnswer = false;
    expect(await toolsB.checkAutoRestore()).toBe(false);
    expect(H.confirmCalls).toBe(1);
    expect(dbB._stores.contacts.size).toBe(0);
    expect(await dbGetFrom(dbB)('settings', 'justRecovered')).toBeNull();
    // The marker is one-shot: a second boot does not ask again.
    expect(await toolsB.checkAutoRestore()).toBe(false);
    expect(H.confirmCalls).toBe(1);
  });

  it('confirming restores the backup and schedules the reload', async () => {
    const acct = await plantCloudBackup();
    const dbB = await freshDeviceDb(acct);
    const toolsB = makeTools(dbB, acct.signMessage);
    H.confirmAnswer = true;
    H.promptAnswers = ['passphrase-1'];
    expect(await toolsB.checkAutoRestore()).toBe(true);
    expect(dbB._stores.contacts.get('peer00000001')?.name).toBe('Peer');
    expect(dbB._stores.messages.get('m1')?.text).toBe('hello');
    await tick(30);
    expect(H.reloads).toBe(1);
  });

  it('no marker: no probe, no prompt', async () => {
    const acct = await plantCloudBackup();
    const dbB = mockDb();
    const put = dbPutInto(dbB);
    await put('identity', acct.keys, 'keys');
    await put('identity', acct.signing, 'signing');
    const toolsB = makeTools(dbB, acct.signMessage);
    expect(await toolsB.checkAutoRestore()).toBe(false);
    expect(uploads('/backup/download')).toBe(0);
    expect(H.confirmCalls).toBe(0);
  });

  it("a backup naming a different identity writes nothing", async () => {
    const acctA = await plantCloudBackup(); // slot holds A's payload; bundle verifies A
    const dbB = mockDb();
    const acctB = await plantAccount(dbB, 'phrase'); // a different identity entirely
    // B's bundle now verifies B's signatures under the same userId —
    // the download succeeds, so only the payload check can refuse.
    await H.env.KV.put('prekey:drilluser001', JSON.stringify({ edIdentityKey: acctB.signing.pubB64 }));
    await dbPutInto(dbB)('settings', { at: Date.now() }, 'justRecovered');
    dbB._stores.contacts.clear(); dbB._stores.messages.clear();
    const toolsB = makeTools(dbB, acctB.signMessage);
    H.confirmAnswer = true;
    H.promptAnswers = ['passphrase-1'];
    expect(await toolsB.checkAutoRestore()).toBe(false);
    expect(dbB._stores.contacts.size).toBe(0);
    expect(H.toasts.map(x => x.msg)).toContain('toastInvalidBackup');
    expect(acctA.keys.pubB64).not.toBe(acctB.keys.pubB64);
  });
});

describe('migration guide', () => {
  it('shows the steps dialog', async () => {
    const db = mockDb();
    const acct = await plantAccount(db, 'phrase');
    const tools = makeTools(db, acct.signMessage);
    await tools.showMigrationGuide();
    expect(H.confirmCalls).toBe(1);
  });
});

describe('wiring (index.html / locales)', () => {
  it('dbPut notifies the hook, and the hook is registered at backup wiring time', () => {
    expect(html.split('_notifyBackupDirty(store, key)').length - 1).toBeGreaterThanOrEqual(2);
    expect(html).toContain('_groupPolicyNotify?.(store, key)');
    expect(html).toContain('_groupAuthor?.inputsChanged(store, key)');
    expect(html).toContain('_autoBackupNotify = () => _backupTools.notifyBackupDataChanged()');
    expect(html).toContain("window.addEventListener('online', () => flushAutoBackup()");
  });
  it('the boot path runs the restore check and the pending flush', () => {
    expect(html).toContain('checkAutoRestore();');
    expect(html).toContain('flushAutoBackup();');
  });
  it('settings carries the toggle, status line, arm button and migration entry', () => {
    expect(html).toContain('data-setting="auto-backup"');
    expect(html).toContain("if (s === 'auto-backup') { _settings.autoBackup = cb.checked; saveSettings(); return; }");
    expect(html).toContain('data-autobackup-status');
    expect(html).toContain('data-action="autobackup-arm"');
    expect(html).toContain('data-action="migrate-device"');
    expect(html).toContain('autoBackup: true,');
  });
  it('phrase restore marks the account just-recovered (both paths)', () => {
    expect(backupMod.split('await _markJustRecovered();').length - 1).toBe(2);
    expect(backupMod).toContain("dbPut('settings', { at: Date.now() }, 'justRecovered')");
  });
  it('the new keys exist in EN, JA (translated) and the other locales (English value)', () => {
    for (const k of ['autoBackupLabel', 'autoBackupLast', 'autoBackupNever', 'autoBackupOff', 'autoBackupNoServer',
      'autoBackupNeedPass', 'autoBackupPending', 'autoBackupError', 'autoBackupArmBtn',
      'autoRestoreFoundTitle', 'autoRestoreFoundDesc', 'migrateDeviceBtn', 'migrateGuideTitle', 'migrateGuideDesc']) {
      expect(html, k).toContain(k + ':');
      expect(ja[k], k).toBeTruthy();
      expect(de[k], k).toBeTruthy();
    }
    expect(ja.autoBackupLabel).toBe('自動バックアップ');
    expect(de.autoBackupLabel).toBe('Automatic backup');
    expect(ja.autoBackupLast).toContain('{0}');
  });
});
