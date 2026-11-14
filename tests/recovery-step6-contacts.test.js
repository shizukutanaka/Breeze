// Recovery plan step 6 — contacts export encryption
// (docs/IDENTITY_RECOVERY_PLAN.md §4 step 6, §2 item 6).
//
// /contacts export used to download the address book as PLAINTEXT JSON.
// Step 6 folds it into the encrypted backup format: the export is the
// {s,i,d} PBKDF2 + AES-256-GCM envelope encrypt() writes, carrying a
// contacts-only payload. This suite drives the REAL createBackupTools
// factory (src/app/backup.js) with the REAL encrypt/decrypt sliced from
// index.html, and pins:
//   1. The exported file contains no plaintext contact data (the raw
//      bytes are searched for names, pubkeys and notes).
//   2. Export → import round-trips the address book field-for-field.
//   3. Wrong passphrase imports nothing; short export passphrase is
//      refused before any file exists.
//   4. A full backup file fed to /contacts import yields its contacts
//      only — identity/key material is never imported by this path.
//   5. Legacy plaintext exports (pre-step-6 files) still import — the
//      migration path; nothing produces that shape any more.
//   6. The importer's per-contact validation is unchanged (bad pubkey
//      skipped, caps applied, duplicates skipped).
//   7. index.html no longer builds a plaintext contacts download.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackupTools } from '../src/app/backup.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const backupMod = readFileSync(join(HERE, '..', 'src', 'app', 'backup.js'), 'utf8');

function sliceHtml(startMarker, endMarker) {
  const a = html.indexOf(startMarker);
  const b = html.indexOf(endMarker, a);
  if (a < 0 || b < 0) throw new Error(`slice markers not found: ${startMarker} → ${endMarker}`);
  return html.slice(a, b);
}

// The real encrypt/decrypt (+ deriveKey) from index.html.
const cryptoFactory = new Function('CONFIG', 'arr', 'u8', '_dbg',
  sliceHtml('async function deriveKey', '// v3.6 Phase 2c') + '; return { encrypt, decrypt };');
const TEST_CONFIG = { IV_BYTES: 12, PBKDF2_ITERATIONS: 100, AES_KEY_BITS: 256, GROUP_MAX: 100, VERSION: 'test' };
const { encrypt, decrypt } = cryptoFactory(
  TEST_CONFIG,
  (u8a) => [...u8a],
  (a) => new Uint8Array(a),
  () => {},
);

// ── Mock IDB (the recovery-simple harness shape) ─────────────────────
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

// ── Harness ──────────────────────────────────────────────────────────
const H = { toasts: [], promptAnswers: [], downloads: [], renders: 0, audits: [] };
const GLOBAL_KEYS = ['t', 'showToast', 'showPrompt', '_dbg', 'CONFIG', 'MS', 'encrypt', 'decrypt', 'downloadBlob'];
const savedGlobals = {};
beforeAll(() => {
  for (const k of GLOBAL_KEYS) savedGlobals[k] = globalThis[k];
  globalThis.t = (k, ...args) => (args.length ? `${k}:${args.join(':')}` : k);
  globalThis.showToast = (msg, type) => { H.toasts.push({ msg, type }); };
  globalThis.showPrompt = async () => (H.promptAnswers.length ? H.promptAnswers.shift() : null);
  globalThis._dbg = () => {};
  globalThis.CONFIG = TEST_CONFIG;
  globalThis.MS = { SEC: 1000 };
  globalThis.encrypt = encrypt;
  globalThis.decrypt = decrypt;
  // downloadBlob is fire-and-forget in production (the caller does not
  // await it), so the capture must push SYNCHRONOUSLY; the blob's text is
  // read through `ready` by the assertions that need it.
  globalThis.downloadBlob = (blob, filename) => {
    const rec = { blob, filename, text: null, ready: null };
    rec.ready = blob.text().then(t => { rec.text = t; });
    H.downloads.push(rec);
  };
});
afterAll(() => {
  for (const k of GLOBAL_KEYS) {
    if (savedGlobals[k] === undefined) delete globalThis[k];
    else globalThis[k] = savedGlobals[k];
  }
});
beforeEach(() => { H.toasts = []; H.promptAnswers = []; H.downloads = []; H.renders = 0; H.audits = []; });

function makeTools(db) {
  return createBackupTools({
    db,
    dbGet: dbGetFrom(db), dbPut: dbPutInto(db), dbGetAll: dbGetAllFrom(db),
    authFields: async () => ({}),
    homeRelays: () => [],
    postAPIRelay: async () => null,
    signMessage: async () => null,
    renderContacts: async () => { H.renders++; },
    auditLog: (type, detail) => { H.audits.push({ type, detail }); },
    myId: () => 'step6user01',
    adoptRestoredSigning: () => {},
  });
}

const ALICE = { id: 'alice000001', pubB64: 'QUxJQ0VQPQ==', name: 'Alice Aardvark', alias: 'alice', isGroup: false, members: [], labels: ['friend', 'work'], notes: 'private note about alice', addedAt: 1700000000000, pinned: true, unread: 3 };
const GROUP = { id: 'grp1234567', pubB64: undefined, name: 'Study Group', alias: null, isGroup: true, members: [{ id: 'alice000001', pubB64: 'QUxJQ0VQPQ==' }], labels: [], notes: null, addedAt: 1700000001000, pinned: false, unread: 0 };

async function seedContacts(db) {
  const put = dbPutInto(db);
  await put('contacts', { ...ALICE });
  await put('contacts', { ...GROUP });
}

const fileOf = (text) => ({ text: async () => text });

describe('step 6 — encrypted contacts export', () => {
  it('the exported file is an encrypted envelope containing NO plaintext contact data', async () => {
    const db = mockDb();
    await seedContacts(db);
    const tools = makeTools(db);
    H.promptAnswers = ['correct horse'];
    await tools.exportContactsEncrypted();
    expect(H.downloads).toHaveLength(1);
    const dl = H.downloads[0];
    await dl.ready;
    expect(dl.filename).toMatch(/^breeze-contacts-\d{4}-\d{2}-\d{2}\.json$/);
    // The envelope shape, not the plaintext shape.
    const parsed = JSON.parse(dl.text);
    expect(Array.isArray(parsed.s)).toBe(true);
    expect(Array.isArray(parsed.i)).toBe(true);
    expect(Array.isArray(parsed.d)).toBe(true);
    expect(parsed.contacts).toBeUndefined();
    // The point of the step: nothing about the social graph is readable
    // in the file at rest.
    for (const needle of ['Alice Aardvark', 'QUxJQ0VQPQ==', 'private note about alice', 'Study Group', 'friend']) {
      expect(dl.text).not.toContain(needle);
    }
    // And it opens with the passphrase into the contacts-only payload.
    const data = JSON.parse(await decrypt('correct horse', parsed));
    expect(data.contactsOnly).toBe(true);
    expect(data.backupV).toBe(2);
    expect(data.identity).toBeUndefined();
    expect(data.keyMaterial).toBeUndefined();
    expect(data.contacts).toHaveLength(2);
    const alice = data.contacts.find(c => c.id === 'alice000001');
    expect(alice).toMatchObject({ name: 'Alice Aardvark', alias: 'alice', pubB64: 'QUxJQ0VQPQ==', notes: 'private note about alice', pinned: true });
    expect(alice.labels).toEqual(['friend', 'work']);
    expect(H.toasts.at(-1).msg).toBe('toastExportedContacts:2');
  });

  it('refuses a short passphrase and downloads nothing', async () => {
    const db = mockDb();
    await seedContacts(db);
    const tools = makeTools(db);
    H.promptAnswers = ['abc'];
    await tools.exportContactsEncrypted();
    expect(H.downloads).toHaveLength(0);
    expect(H.toasts.at(-1).msg).toBe('backupPassMin');
  });

  it('a cancelled passphrase prompt downloads nothing', async () => {
    const db = mockDb();
    await seedContacts(db);
    const tools = makeTools(db);
    H.promptAnswers = [null];
    await tools.exportContactsEncrypted();
    expect(H.downloads).toHaveLength(0);
  });
});

describe('step 6 — encrypted contacts import', () => {
  async function exportFile(db, pass = 'correct horse') {
    const tools = makeTools(db);
    H.promptAnswers = [pass];
    await tools.exportContactsEncrypted();
    await H.downloads[0].ready;
    return H.downloads[0].text;
  }

  it('round-trips the address book into a fresh store, field for field', async () => {
    const dbA = mockDb();
    await seedContacts(dbA);
    const text = await exportFile(dbA);
    const dbB = mockDb();
    const toolsB = makeTools(dbB);
    H.promptAnswers = ['correct horse'];
    await toolsB.importContactsFile(fileOf(text));
    const alice = dbB._stores.contacts.get('alice000001');
    expect(alice).toMatchObject({ name: 'Alice Aardvark', alias: 'alice', pubB64: 'QUxJQ0VQPQ==', notes: 'private note about alice', pinned: true, unread: 0 });
    expect(alice.labels).toEqual(['friend', 'work']);
    const grp = dbB._stores.contacts.get('grp1234567');
    expect(grp.isGroup).toBe(true);
    expect(grp.members).toHaveLength(1);
    expect(H.renders).toBe(1);
    expect(H.toasts.at(-1).msg).toBe('toastContactsImported:2:0');
  });

  it('a wrong passphrase imports nothing', async () => {
    const dbA = mockDb();
    await seedContacts(dbA);
    const text = await exportFile(dbA);
    const dbB = mockDb();
    const toolsB = makeTools(dbB);
    H.promptAnswers = ['wrong horse'];
    await toolsB.importContactsFile(fileOf(text));
    expect(dbB._stores.contacts.size).toBe(0);
    expect(H.toasts.at(-1).msg).toBe('toastWrongPassphrase');
  });

  it('re-importing skips existing contacts instead of duplicating them', async () => {
    const dbA = mockDb();
    await seedContacts(dbA);
    const text = await exportFile(dbA);
    const dbB = mockDb();
    const toolsB = makeTools(dbB);
    H.promptAnswers = ['correct horse'];
    await toolsB.importContactsFile(fileOf(text));
    H.promptAnswers = ['correct horse'];
    await toolsB.importContactsFile(fileOf(text));
    expect(dbB._stores.contacts.size).toBe(2);
    expect(H.toasts.at(-1).msg).toBe('toastContactsImported:0:2');
  });

  it('a full backup file yields its contacts only — identity is never imported here', async () => {
    const dbB = mockDb();
    const toolsB = makeTools(dbB);
    const payload = JSON.stringify({
      backupV: 2,
      identity: { pubB64: 'SOMEIDENTITY', name: 'Should Not Land' },
      contacts: [{ id: 'bob00000001', pubB64: 'Qk9CUFI=', name: 'Bob', alias: null, isGroup: false, members: [], labels: [], notes: null, addedAt: 1, pinned: false }],
      keyMaterial: { signing: { priv: 'nope' } },
    });
    const enc = await encrypt('correct horse', payload);
    H.promptAnswers = ['correct horse'];
    await toolsB.importContactsFile(fileOf(JSON.stringify(enc)));
    expect(dbB._stores.contacts.get('bob00000001')?.name).toBe('Bob');
    expect(dbB._stores.identity.size).toBe(0);
  });

  it('per-contact validation is unchanged: bad pubkeys skipped, fields capped', async () => {
    const dbB = mockDb();
    const toolsB = makeTools(dbB);
    const payload = JSON.stringify({
      backupV: 2, contactsOnly: true,
      contacts: [
        { id: 'badpub00001', pubB64: 'not!!base64', name: 'Bad' },
        { id: 'longname001', pubB64: 'TE9ORw==', name: 'x'.repeat(200), notes: 'y'.repeat(5000) },
      ],
    });
    const enc = await encrypt('correct horse', payload);
    H.promptAnswers = ['correct horse'];
    await toolsB.importContactsFile(fileOf(JSON.stringify(enc)));
    expect(dbB._stores.contacts.has('badpub00001')).toBe(false);
    const capped = dbB._stores.contacts.get('longname001');
    expect(capped.name).toHaveLength(64);
    expect(capped.notes).toHaveLength(1024);
    expect(H.toasts.at(-1).msg).toBe('toastContactsImported:1:1');
  });
});

describe('step 6 — legacy plaintext migration path', () => {
  it('a pre-step-6 plaintext export still imports', async () => {
    const db = mockDb();
    const tools = makeTools(db);
    const legacy = JSON.stringify({
      version: '3.6.1', type: 'contacts', exportedAt: '2026-01-01T00:00:00.000Z',
      contacts: [{ id: 'carol000001', pubB64: 'Q0FST0w=', name: 'Carol', alias: 'carol', isGroup: false, members: [], labels: ['old'], notes: 'from a plaintext era', addedAt: 5, pinned: false }],
    });
    await tools.importContactsFile(fileOf(legacy));
    const carol = db._stores.contacts.get('carol000001');
    expect(carol?.name).toBe('Carol');
    expect(carol?.notes).toBe('from a plaintext era');
    expect(H.toasts.at(-1).msg).toBe('toastContactsImported:1:0');
  });

  it('a garbage file is refused and imports nothing', async () => {
    const db = mockDb();
    const tools = makeTools(db);
    await tools.importContactsFile(fileOf('{"hello":"world"}'));
    expect(db._stores.contacts.size).toBe(0);
    expect(H.toasts.at(-1).msg).toBe('toastInvalidFile');
  });
});

describe('step 6 — the plaintext export path is gone (source pins)', () => {
  it('index.html builds no plaintext contacts download any more', () => {
    expect(html).not.toContain("type: 'contacts'");
    expect(html).not.toContain('Contact export: ');
    // The command delegates to the encrypted exporter in the module.
    expect(html).toContain('await exportContactsEncrypted();');
    expect(html).toContain('await importContactsFile(ev.target.files[0]);');
  });

  it('the module produces only the encrypted envelope for contacts', () => {
    expect(backupMod).toContain('contactsOnly: true');
    expect(backupMod).toContain('exportContactsEncrypted');
    expect(backupMod).toContain('importContactsFile');
  });
});
