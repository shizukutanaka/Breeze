// Recovery modes — the disposable mode (docs/IDENTITY_RECOVERY_PLAN.md
// §5, the second of the owner's three recovery modes, 2026-11-14).
//
// What is pinned here, executing the REAL index.html functions sliced
// against a mock IDB (the recovery-seed.test.js pattern):
//   1. Disposable creation shows NO phrase (the phrase dialog is never
//      invoked), plants NO derived signing record, keys are freshly
//      random per creation, and the keys record carries
//      recoveryMode: 'none'.
//   2. The default creation path (no disposable flag, or false) is the
//      phrase path, unchanged: phrase shown once, mode 'phrase'.
//   3. A disposable identity is refused a recovery kit — with the
//      dedicated toast, no phrase minted, no file downloaded — while a
//      legacy (modeless) identity still gets one (control).
//   4. Wiring: the setup screen's disposable entry exists and reaches
//      creation ONLY through the no-recovery confirmation; the default
//      button passes disposable=false; /security renders the recorded
//      mode; the kit guard reads the record.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSeedHelper } from '../src/crypto/seed.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const ja = JSON.parse(readFileSync(join(HERE, '..', 'locales', 'ja.json'), 'utf8'));

const seed = createSeedHelper();
globalThis.__breezeSeed = seed;

function slice(from, to) {
  const a = html.indexOf(from);
  const b = html.indexOf(to);
  expect(a, `anchor not found: ${from}`).toBeGreaterThan(-1);
  expect(b, `anchor not found: ${to}`).toBeGreaterThan(a);
  return html.slice(a, b);
}
const backupMod = readFileSync(join(HERE, '..', 'src', 'app', 'backup.js'), 'utf8');
function sliceBackup(from, to) {
  const a = backupMod.indexOf(from);
  const b = backupMod.indexOf(to);
  expect(a, `anchor not found in src/app/backup.js: ${from}`).toBeGreaterThan(-1);
  expect(b, `anchor not found in src/app/backup.js: ${to}`).toBeGreaterThan(a);
  return backupMod.slice(a, b);
}


// Minimal IndexedDB stand-in (the recovery-seed.test.js pattern).
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

// Build the real createIdentity (+ _seedIdentityMaterial) out of
// index.html. The phrase dialog stub counts its invocations and
// captures the phrase it was shown.
function buildCreate(db, { promptAnswer = 'drill-pass', api = null } = {}) {
  const toasts = [];
  const shown = { phrase: null, calls: 0 };
  const src = [
    'let myKeys = null, myPubB64 = "", myName = "", myAlias = "", myId = "", myShortId = "", _userId = "";',
    slice('function arr(u8a)', 'function uid()'),
    slice('async function _seedIdentityMaterial()', 'async function createIdentity'),
    slice('async function createIdentity(name, alias, disposable', '// DOUBLE RATCHET CRYPTO ENGINE'),
  ].join('\n');
  const factory = new Function('db', '_dbg', 'showToast', 't', '_hasX25519', '_hasEd25519',
    '_promptRecoveryPhraseNew', 'genIdentityKey', 'dbPut', 'auditLog', 'generateShortId', 'localStorage', 'API',
    src + '; return { createIdentity, get: () => ({ myPubB64, myId }) };');
  const api2 = factory(
    db, () => {}, (msg, type) => { toasts.push({ msg, type }); }, (k) => k, true, true,
    async (phrase) => { shown.calls++; shown.phrase = phrase; return promptAnswer; },
    async () => crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']),
    dbPutInto(db), () => {}, async () => 'breeze-test-test', { setItem() {} }, api,
  );
  return { ...api2, toasts, shown };
}

// Build the real createRecoveryKit out of index.html (the slice runs
// through resolveAndAdd, so it also carries restoreFromPhrase and its
// stubs — the recovery-seed.test.js buildRestoreFns pattern).
function buildKit(db, { promptNewAnswer = 'kit-pass' } = {}) {
  const toasts = [];
  const downloads = [];
  const shown = { phrase: null, calls: 0 };
  const src = [
    'let _signingKey = null, _signingPubB64 = "", myId = "";',
    slice('function arr(u8a)', 'function uid()'),
    slice('async function dbGet(store, key)', 'async function dbGetAll'),
    slice('async function dbGetAll(store)', 'async function dbGetByIndex'),
    sliceBackup('const BACKUP_FORMAT_V', 'async function backupToFile'),
    sliceBackup('async function createRecoveryKit()', '// ===== Backup & Restore (module end)'),
  ].join('\n');
  const factory = new Function('db', '_dbg', 'showToast', 't', '_DOM', '_promptRecoveryPhraseRestore',
    '_promptRecoveryPhraseNew', 'downloadBlob', 'API', 'postAPIRaw', 'authFields', 'MS', 'location', 'setTimeout',
    src + '; return { createRecoveryKit };');
  const api2 = factory(
    db, () => {}, (msg, type) => { toasts.push({ msg, type }); }, (k) => k,
    { get: () => ({ value: '' }) },
    async () => null,
    async (phrase) => { shown.calls++; shown.phrase = phrase; return promptNewAnswer; },
    (blob) => { downloads.push(blob); },
    null,
    async () => ({ ok: false }),
    async () => ({}),
    { SEC: 1000 },
    { reload: () => {} },
    () => 0,
  );
  return { ...api2, toasts, downloads, shown };
}

describe('disposable creation — no phrase, random keys, mode recorded', () => {
  it('creates a random identity labelled none, without ever showing a phrase', async () => {
    const db = mockDb();
    const create = buildCreate(db);
    expect(await create.createIdentity('Throwaway', '', true)).toBe(true);
    // The phrase step was skipped entirely: dialog never invoked.
    expect(create.shown.calls).toBe(0);
    expect(create.shown.phrase).toBeNull();
    const keysRec = db._stores.identity.get('keys');
    expect(keysRec.recoveryMode).toBe('none');
    expect(keysRec.pubB64).toBe(create.get().myPubB64);
    // No seed-derived signing record was planted (initSigning mints a
    // random one later in the real flow — derivation never happened).
    expect(db._stores.identity.get('signing')).toBeUndefined();
  });

  it('two disposable creations produce different keys (random, not derived)', async () => {
    const a = buildCreate(mockDb());
    const b = buildCreate(mockDb());
    expect(await a.createIdentity('One', '', true)).toBe(true);
    expect(await b.createIdentity('Two', '', true)).toBe(true);
    expect(a.get().myPubB64).not.toBe(b.get().myPubB64);
  });

  it('the default path stays the phrase path (no flag, and explicit false)', async () => {
    for (const args of [['Defaulted', ''], ['Explicit', '', false]]) {
      const db = mockDb();
      const create = buildCreate(db);
      expect(await create.createIdentity(...args)).toBe(true);
      expect(create.shown.calls).toBe(1);
      expect(create.shown.phrase.split(' ')).toHaveLength(24);
      expect(db._stores.identity.get('keys').recoveryMode).toBe('phrase');
      expect(db._stores.identity.get('signing')).toBeTruthy();
    }
  });
});

describe('disposable identities are outside the recovery kit', () => {
  it('refuses the kit with the dedicated toast — no phrase, no download', async () => {
    const db = mockDb();
    db._stores.identity.set('keys', { pubB64: 'AAAA', name: 'Throwaway', recoveryMode: 'none' });
    const kit = buildKit(db);
    await kit.createRecoveryKit();
    expect(kit.toasts).toEqual([{ msg: 'toastRecoveryNoneKit', type: 'error' }]);
    expect(kit.shown.calls).toBe(0);
    expect(kit.downloads).toHaveLength(0);
  });

  it('control: a legacy (modeless) identity still gets a kit', async () => {
    const db = mockDb();
    db._stores.identity.set('keys', { pubB64: 'BBBB', name: 'Legacy' });
    const kit = buildKit(db);
    await kit.createRecoveryKit();
    expect(kit.downloads).toHaveLength(1);
    expect(kit.toasts).toContainEqual({ msg: 'toastRecoveryKitCreated', type: 'success' });
  });
});

describe('disposable mode — wiring pins', () => {
  it('the setup screen offers the disposable entry next to the phrase entry', () => {
    const setup = slice('<div id="msg-setup"', '<!-- Main UI -->');
    expect(setup).toContain('id="b-msg-setup-none"');
    expect(setup).toContain('data-i18n="setupDisposable"');
  });

  it('creation runs through one flow: default passes false, disposable only behind the confirmation', () => {
    expect(html).toContain("if (!await createIdentity(name, alias, disposable)) return;");
    expect(html).toContain("_DOM.get('b-msg-setup')?.addEventListener('click', () => { _runSetupCreate(false); });");
    const reg = slice("_DOM.get('b-msg-setup-none')?.addEventListener", "_DOM.get('b-msg-setup-restore')?.addEventListener");
    expect(reg).toContain('showConfirm');
    expect(reg).toContain("t('disposableTitle')");
    expect(reg).toContain("t('disposableDesc')");
    expect(reg).toContain('_runSetupCreate(true)');
    // The confirmation is a gate, not a decoration: _runSetupCreate(true)
    // appears exactly once in the file, inside that gated handler.
    expect(html.split('_runSetupCreate(true)')).toHaveLength(2);
  });

  it('/security renders the recorded recovery mode', () => {
    expect(html).toContain("_identRec?.recoveryMode === 'none'");
    expect(html).toContain("t('secRecoveryNone')");
    expect(html).toContain("t('secRecoveryPhrase')");
    expect(html).toContain("t('secRecoveryLegacy')");
  });

  it('the kit guard reads the identity record', () => {
    const kit = sliceBackup('async function createRecoveryKit()', 'async function restoreFromPhrase');
    expect(kit).toContain("identity.recoveryMode === 'none'");
    expect(kit).toContain("t('toastRecoveryNoneKit')");
  });

  it('all new i18n keys exist in EN (inline) and JA (locales/ja.json)', () => {
    const keys = ['setupDisposable', 'disposableTitle', 'disposableDesc', 'disposableOk',
      'toastRecoveryNoneKit', 'secLblRecovery', 'secRecoveryPhrase', 'secRecoveryNone', 'secRecoveryLegacy'];
    for (const k of keys) {
      expect(html, `EN missing ${k}`).toContain(`${k}:`);
      expect(typeof ja[k], `JA missing ${k}`).toBe('string');
      expect(ja[k].length).toBeGreaterThan(0);
    }
    expect(ja.setupDisposable).toBe('使い捨て身元（復旧不可）');
  });
});
