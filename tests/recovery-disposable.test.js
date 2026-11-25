// Recovery modes — the disposable mode's REMOVAL (2026-11-25) and the
// read-side protection that stays for identities created with it.
//
// History: the disposable mode (docs/IDENTITY_RECOVERY_PLAN.md §5) was
// the second of the owner's three recovery modes: creation skipped the
// phrase, used random keys, and recorded recoveryMode: 'none'. The owner
// removed the creation entry — new identities are never offered it.
//
// What is pinned here, executing the REAL index.html functions sliced
// against a mock IDB (the recovery-seed.test.js pattern):
//   1. Creation never writes 'none' any more: no setup-screen entry, no
//      handler, and createIdentity's record spread has no 'none' arm.
//      The one-tap 'random' start (the entry that replaced it) uses the
//      same random generation, shows no phrase, and records NO mode —
//      modeless, so the identity stays backup/kit-eligible, unlike the
//      old disposable opt-out.
//   2. The default creation path (no flag, or false) is still the
//      phrase path, unchanged: phrase shown once, mode 'phrase'.
//   3. EXISTING data is untouched by the removal: an identity record
//      that already carries recoveryMode: 'none' is still refused a
//      recovery kit — with the dedicated toast, no phrase minted, no
//      file downloaded — while a legacy (modeless) identity still gets
//      one (control). /security still renders the recorded mode.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
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
    '_promptRecoveryPhraseNew', 'genIdentityKey', 'dbPut', 'auditLog', 'generateShortId', 'localStorage', 'API', '_initMsgStoreKey',
    src + '; return { createIdentity, get: () => ({ myPubB64, myId }) };');
  const api2 = factory(
    db, () => {}, (msg, type) => { toasts.push({ msg, type }); }, (k) => k, true, true,
    async (phrase) => { shown.calls++; shown.phrase = phrase; return promptAnswer; },
    async () => crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']),
    dbPutInto(db), () => {}, async () => 'breeze-test-test', { setItem() {} }, api, async () => true,
  );
  return { ...api2, toasts, shown };
}

// Build the real createRecoveryKit out of src/app/backup.js (the slice
// runs through restoreFromPhrase and its stubs — the
// recovery-seed.test.js buildRestoreFns pattern).
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

describe('random creation (the one-tap start) — random keys, no phrase, NO mode recorded', () => {
  it('creates a random identity without ever showing a phrase, and leaves the record modeless', async () => {
    const db = mockDb();
    const create = buildCreate(db);
    expect(await create.createIdentity('Quick Start', '', 'random')).toBe(true);
    // The phrase step was skipped entirely: dialog never invoked.
    expect(create.shown.calls).toBe(0);
    expect(create.shown.phrase).toBeNull();
    const keysRec = db._stores.identity.get('keys');
    // Modeless — NOT 'none'. A modeless record stays eligible for a
    // backup / recovery kit; 'none' was the removed permanent opt-out.
    expect(keysRec.recoveryMode).toBeUndefined();
    expect(keysRec.pubB64).toBe(create.get().myPubB64);
    // No seed-derived signing record was planted.
    expect(db._stores.identity.get('signing')).toBeUndefined();
  });

  it('two random creations produce different keys (random, not derived)', async () => {
    const a = buildCreate(mockDb());
    const b = buildCreate(mockDb());
    expect(await a.createIdentity('One', '', 'random')).toBe(true);
    expect(await b.createIdentity('Two', '', 'random')).toBe(true);
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

describe('existing disposable identities are outside the recovery kit (unchanged read side)', () => {
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

describe('disposable mode — removal pins', () => {
  it('the setup screen offers no disposable entry, and no handler reaches creation with it', () => {
    const setup = slice('<div id="msg-setup"', '<!-- Main UI -->');
    expect(setup).not.toContain('b-msg-setup-none');
    expect(setup).not.toContain('setupDisposable');
    expect(html).not.toContain("_DOM.get('b-msg-setup-none')");
    expect(html).not.toContain('_runSetupCreate(true)');
    expect(html).not.toContain("t('disposableTitle')");
  });

  it("createIdentity's record never writes 'none' any more", () => {
    const fn = slice('async function createIdentity(name, alias, disposable', '// DOUBLE RATCHET CRYPTO ENGINE');
    expect(fn).not.toContain("recoveryMode: 'none'");
    expect(fn).toContain("seedMat ? { recoveryMode: 'phrase' } : {}");
  });

  it('/security still renders the recorded recovery mode (existing records)', () => {
    const panels = readFileSync(new URL('../src/app/info-panels.js', import.meta.url), 'utf8');
    expect(panels).toContain("_identRec?.recoveryMode === 'none'");
    expect(panels).toContain("D.t('secRecoveryNone')");
    expect(panels).toContain("D.t('secRecoveryPhrase')");
    expect(panels).toContain("D.t('secRecoveryLegacy')");
  });

  it('the kit guard still reads the identity record (existing records)', () => {
    const kit = sliceBackup('async function createRecoveryKit()', 'async function restoreFromPhrase');
    expect(kit).toContain("identity.recoveryMode === 'none'");
    expect(kit).toContain("t('toastRecoveryNoneKit')");
  });

  it('the creation-entry i18n keys are gone everywhere; the read-side keys remain', () => {
    const removed = ['setupDisposable', 'disposableTitle', 'disposableDesc', 'disposableOk'];
    for (const k of removed) {
      expect(html, `EN still defines ${k}`).not.toContain(`${k}:`);
      expect(ja[k], `JA still defines ${k}`).toBeUndefined();
    }
    const kept = ['toastRecoveryNoneKit', 'toastRecoveryNoneBackup', 'secLblRecovery', 'secRecoveryPhrase', 'secRecoveryNone', 'secRecoveryLegacy'];
    for (const k of kept) {
      expect(html, `EN missing ${k}`).toContain(`${k}:`);
      expect(typeof ja[k], `JA missing ${k}`).toBe('string');
      expect(ja[k].length).toBeGreaterThan(0);
    }
    // Key sets stay consistent across every locale file: no locale may
    // still carry a removed key, and every locale carries the kept ones.
    for (const f of readdirSync(join(HERE, '..', 'locales')).filter(x => x.endsWith('.json'))) {
      const loc = JSON.parse(readFileSync(join(HERE, '..', 'locales', f), 'utf8'));
      for (const k of removed) expect(loc[k], `${f} still defines ${k}`).toBeUndefined();
      for (const k of kept) expect(typeof loc[k], `${f} missing ${k}`).toBe('string');
    }
  });
});
