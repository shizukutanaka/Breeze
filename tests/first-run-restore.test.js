// Recovery plan step 2 (docs/IDENTITY_RECOVERY_PLAN.md §4): the first-run
// setup screen (#msg-setup) had NO restore entry at all — restoreBackup was
// reachable only from inside the app (/backup panel, sidebar drag-drop),
// i.e. only by someone who already had an identity, never by the person
// whose devices are gone. Step 2 wires the setup screen's restore button to
// the SAME restoreFromFilePicker → restoreBackup path. These tests execute
// the REAL restoreBackup sliced from index.html against a mock IndexedDB,
// starting from the first-run state (empty stores), and pin:
//   - the v2 drill: file → passphrase → identity, contacts AND the full key
//     material (step 1) land; success toast; the delayed reload that hands
//     over to _boot()'s normal has-identity flow;
//   - the v1 drill: identity + contacts land, no key material exists to
//     restore, and the legacy warning (device management NOT restored —
//     the SECURITY.md limit) is shown with a longer read window;
//   - failure creates NOTHING: wrong passphrase and a tampered file both
//     end at the wrong-passphrase toast with empty stores and no reload;
//   - a file that is not a Breeze backup at all is named as such
//     (toastInvalidBackup), distinct from a passphrase failure;
//   - cancelling the passphrase prompt is a silent no-op.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const ja = JSON.parse(readFileSync(join(HERE, '..', 'locales', 'ja.json'), 'utf8'));

function slice(from, to) {
  const a = html.indexOf(from);
  const b = html.indexOf(to);
  expect(a, `anchor not found: ${from}`).toBeGreaterThan(-1);
  expect(b, `anchor not found: ${to}`).toBeGreaterThan(a);
  return html.slice(a, b);
}

// Minimal IndexedDB stand-in (the backup-keymaterial.test.js pattern).
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
          // The contacts store has keyPath 'id', so dbPut calls put(val) with
          // no explicit key there — key the record by val.id like real IDB.
          put: (val, key) => req(() => { const k = key !== undefined ? key : val?.id; m.set(k, val); return k; }),
          getAllKeys: () => req(() => [...m.keys()]),
        }),
      };
    },
  };
}

const CONFIG = { PBKDF2_ITERATIONS: 100000, IV_BYTES: 12, AES_KEY_BITS: 256 };
const PASS = 'drill-passphrase';

// Build the real restoreBackup (+ its real dependencies) out of index.html,
// with the UI surface stubbed: showPrompt answers the passphrase, showToast
// records, setTimeout records instead of firing, location.reload counts.
function buildRestore(db, promptResult = PASS) {
  const toasts = [];
  const timers = [];
  let reloads = 0;
  const src = [
    slice('function arr(u8a)', 'function uid()'),
    slice('async function deriveKey', '// v3.6 Phase 2c'),
    slice('function _atRestIsWrapped', '// Loads the private JWK'),
    slice('async function dbGet(store, key)', 'async function dbGetAll'),
    slice('const BACKUP_FORMAT_V', 'async function backupToFile'),
    slice('async function restoreBackup(file)', 'async function resolveAndAdd'),
  ].join('\n');
  const factory = new Function('db', 'CONFIG', '_dbg', 'showPrompt', 'showToast', 't', 'MS', 'location', 'setTimeout',
    src + '; return { encrypt, restoreBackup };');
  const api = factory(
    db, CONFIG, () => {},
    async () => promptResult,
    (msg, type, duration) => { toasts.push({ msg, type, duration }); },
    (k) => k,
    { SEC: 1000 },
    { reload: () => { reloads++; } },
    (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
  );
  return { api, toasts, timers, reloadCount: () => reloads };
}

const b64 = (s) => Buffer.from(s).toString('base64');
const IDENTITY = { pub: { kty: 'EC' }, priv: { kty: 'EC' }, pubB64: b64('identity-pub'), name: 'Drill', alias: 'drill' };
const CONTACT = { id: 'c1', pubB64: b64('contact-pub'), name: 'Peer' };
const KEY_MATERIAL = {
  signing: { priv: { kty: 'OKP' }, pub: { kty: 'OKP' }, pubB64: b64('signing-pub') },
  account: { root: IDENTITY.pubB64, rootEd: b64('signing-pub'), isPrimary: true },
  spkPriv: { priv: { kty: 'EC' } },
  otpPriv: { keys: [{ kty: 'EC' }] },
  pqPriv: { seed: Array.from({ length: 64 }, (_, i) => i) },
};
const fileOf = (text) => ({ text: async () => text });

async function backupFile(api, payload, pass = PASS) {
  const enc = await api.encrypt(pass, JSON.stringify(payload));
  return fileOf(JSON.stringify(enc));
}

describe('first-run restore — the drill (empty stores, no identity yet)', () => {
  it('v2 backup: identity, contacts and the full key material land; reload follows', async () => {
    const db = mockDb();
    const { api, toasts, timers, reloadCount } = buildRestore(db);
    const file = await backupFile(api, { backupV: 2, identity: IDENTITY, contacts: [CONTACT], keyMaterial: KEY_MATERIAL, exportedAt: new Date().toISOString() });
    await api.restoreBackup(file);

    const id = db._stores.identity;
    expect(id.get('keys')).toEqual(IDENTITY);
    expect(id.get('signing')).toEqual(KEY_MATERIAL.signing);
    expect(id.get('account')).toEqual(KEY_MATERIAL.account);
    expect(id.get('spk-priv')).toEqual(KEY_MATERIAL.spkPriv);
    expect(id.get('otp-priv')).toEqual(KEY_MATERIAL.otpPriv);
    expect(id.get('pq-priv')).toEqual(KEY_MATERIAL.pqPriv);
    expect(db._stores.contacts.get('c1')).toEqual(CONTACT);

    expect(toasts).toEqual([{ msg: 'toastRestoredReload', type: 'success', duration: undefined }]);
    expect(timers).toHaveLength(1);
    expect(timers[0].delay).toBe(1500); // 1.5 * MS.SEC, the established toast-then-reload delay
    expect(reloadCount()).toBe(0);
    timers[0].fn(); // the reload _boot() will re-enter with the identity present
    expect(reloadCount()).toBe(1);
  });

  it('v1 backup: identity + contacts land, the legacy limit is announced, reload waits longer', async () => {
    const db = mockDb();
    const { api, toasts, timers } = buildRestore(db);
    // The pre-step-1 file shape: no backupV, no keyMaterial.
    const file = await backupFile(api, { identity: IDENTITY, contacts: [CONTACT], exportedAt: new Date().toISOString() });
    await api.restoreBackup(file);

    expect(db._stores.identity.get('keys')).toEqual(IDENTITY);
    expect(db._stores.contacts.get('c1')).toEqual(CONTACT);
    expect(db._stores.identity.has('signing')).toBe(false);
    expect(db._stores.identity.has('account')).toBe(false);

    expect(toasts).toContainEqual({ msg: 'toastRestoredReload', type: 'success', duration: undefined });
    expect(toasts).toContainEqual({ msg: 'toastRestoredLegacy', type: 'warn', duration: 9000 });
    expect(timers).toHaveLength(1);
    expect(timers[0].delay).toBe(6000); // held so the limit notice can be read
  });
});

describe('first-run restore — failure creates nothing', () => {
  it('wrong passphrase: no writes, no reload, wrong-passphrase toast', async () => {
    const db = mockDb();
    const maker = buildRestore(db); // encrypt() never consults the prompt stub
    const file = await backupFile(maker.api, { backupV: 2, identity: IDENTITY, contacts: [CONTACT], keyMaterial: KEY_MATERIAL });
    const wrong = buildRestore(db, 'not-the-passphrase');
    await wrong.api.restoreBackup(file);
    expect(db._stores.identity.size).toBe(0);
    expect(db._stores.contacts.size).toBe(0);
    expect(wrong.toasts).toEqual([{ msg: 'toastWrongPassphrase', type: 'error', duration: undefined }]);
    expect(wrong.timers).toHaveLength(0);
  });

  it('tampered file: GCM refuses, no writes, wrong-passphrase toast', async () => {
    const db = mockDb();
    const { api, toasts, timers } = buildRestore(db);
    const enc = await api.encrypt(PASS, JSON.stringify({ backupV: 2, identity: IDENTITY, contacts: [CONTACT], keyMaterial: KEY_MATERIAL }));
    enc.d[10] ^= 0xff; // flip one ciphertext byte
    await api.restoreBackup(fileOf(JSON.stringify(enc)));
    expect(db._stores.identity.size).toBe(0);
    expect(db._stores.contacts.size).toBe(0);
    expect(toasts).toEqual([{ msg: 'toastWrongPassphrase', type: 'error', duration: undefined }]);
    expect(timers).toHaveLength(0);
  });

  it('not a backup at all: named invalid, distinct from a passphrase failure', async () => {
    const db = mockDb();
    const { api, toasts, timers } = buildRestore(db);
    await api.restoreBackup(fileOf('this is not json'));
    await api.restoreBackup(fileOf('{"hello":1}'));
    // Valid envelope shape but the plaintext is not a backup payload.
    const enc = await api.encrypt(PASS, JSON.stringify({ contacts: [] }));
    await api.restoreBackup(fileOf(JSON.stringify(enc)));
    expect(toasts).toEqual([
      { msg: 'toastInvalidBackup', type: 'error', duration: undefined },
      { msg: 'toastInvalidBackup', type: 'error', duration: undefined },
      { msg: 'toastInvalidBackup', type: 'error', duration: undefined },
    ]);
    expect(db._stores.identity.size).toBe(0);
    expect(db._stores.contacts.size).toBe(0);
    expect(timers).toHaveLength(0);
  });

  it('passphrase prompt cancelled: silent no-op', async () => {
    const db = mockDb();
    const { api, toasts, timers } = buildRestore(db, null);
    const file = await backupFile(api, { backupV: 2, identity: IDENTITY, contacts: [CONTACT], keyMaterial: KEY_MATERIAL });
    await api.restoreBackup(file);
    expect(db._stores.identity.size).toBe(0);
    expect(db._stores.contacts.size).toBe(0);
    expect(toasts).toHaveLength(0);
    expect(timers).toHaveLength(0);
  });
});

describe('first-run restore — wiring pins', () => {
  it('the setup screen offers restore next to create, labelled by i18n', () => {
    const setup = slice('<div id="msg-setup"', '<!-- Main UI -->');
    expect(setup).toContain('id="b-msg-setup"');
    expect(setup).toContain('id="b-msg-setup-restore"');
    expect(setup).toContain('data-i18n="setupRestore"');
  });

  it('the setup restore button drives the existing picker + restore path', () => {
    expect(html).toContain("_DOM.get('b-msg-setup-restore')?.addEventListener('click', () => { restoreFromFilePicker(); });");
  });

  it('both new keys exist in EN (inline) and JA (locales/ja.json)', () => {
    expect(html).toContain("setupRestore: 'Restore from a backup file'");
    expect(html).toContain("toastRestoredLegacy: 'Restored from an older backup:");
    expect(ja.setupRestore).toBe('バックアップファイルから復元');
    expect(typeof ja.toastRestoredLegacy).toBe('string');
    expect(ja.toastRestoredLegacy.length).toBeGreaterThan(0);
  });
});
