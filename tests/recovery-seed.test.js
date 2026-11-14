// Recovery plan step 3 (docs/IDENTITY_RECOVERY_PLAN.md §3.1/§4): the
// account seed, the recovery phrase, and deterministic derivation.
//
// Three layers are pinned here:
//   1. The vendored BIP39 English wordlist is the canonical list — count,
//      order, uniqueness, and the BIP39 test vectors over it (an error
//      anywhere in the 2,048 words breaks a vector or the checksum).
//   2. src/crypto/seed.js derives keys with STANDARD constructions only,
//      cross-checked against node:crypto's independent implementations
//      (pbkdf2Sync for the BIP39 master seed, hkdfSync + createPrivateKey
//      for the per-key seeds and public keys) — the WebCrypto path and
//      the Node path must agree byte-for-byte.
//   3. The index.html wiring, executed by slicing the REAL functions out
//      of index.html against a mock IDB: create → wipe → phrase-restore
//      reproduces the identity and signing keys byte-for-byte; the
//      recovery-kit round trip restores a legacy (random-key) identity;
//      a bad phrase, a wrong kit passphrase, and a wrong passphrase
//      caught by the alias guard all create NOTHING.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pbkdf2Sync, hkdfSync, createPrivateKey, createPublicKey } from 'node:crypto';
import { createSeedHelper } from '../src/crypto/seed.js';
import { BIP39_ENGLISH_WORDLIST } from '../src/crypto/wordlist.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');
const ja = JSON.parse(readFileSync(join(HERE, '..', 'locales', 'ja.json'), 'utf8'));
const sw = readFileSync(join(HERE, '..', 'sw.js'), 'utf8');

const seed = createSeedHelper();
// The index.html wiring reads the facade opportunistically off the
// global — install the real one, exactly as the module script does.
globalThis.__breezeSeed = seed;
const ZEROS = new Uint8Array(32);
const FFS = new Uint8Array(32).fill(0xff);

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


// Minimal IndexedDB stand-in (the backup-keymaterial.test.js pattern,
// plus getAll for dbGetAll).
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

describe('BIP39 wordlist — the canonical list, vendored verbatim', () => {
  it('has 2,048 unique words in alphabetical order', () => {
    expect(BIP39_ENGLISH_WORDLIST).toHaveLength(2048);
    expect(new Set(BIP39_ENGLISH_WORDLIST).size).toBe(2048);
    expect([...BIP39_ENGLISH_WORDLIST].sort()).toEqual(BIP39_ENGLISH_WORDLIST);
  });

  it('matches the canonical anchors (first / 220 / last)', () => {
    expect(BIP39_ENGLISH_WORDLIST[0]).toBe('abandon');
    expect(BIP39_ENGLISH_WORDLIST[3]).toBe('about');
    expect(BIP39_ENGLISH_WORDLIST[220]).toBe('breeze');
    expect(BIP39_ENGLISH_WORDLIST[2047]).toBe('zoo');
  });
});

describe('seed facade — BIP39 vectors and phrase handling', () => {
  it('entropy 0x00… → "abandon" ×23 + "art" (BIP39 test vector)', async () => {
    expect(await seed.entropyToPhrase(ZEROS)).toBe([...Array(23).fill('abandon'), 'art'].join(' '));
  });

  it('entropy 0xff… → "zoo" ×23 + "vote" (BIP39 test vector)', async () => {
    expect(await seed.entropyToPhrase(FFS)).toBe([...Array(23).fill('zoo'), 'vote'].join(' '));
  });

  it('phrase → entropy round-trips (zeros, ff, random)', async () => {
    for (const ent of [ZEROS, FFS, seed.randomEntropy()]) {
      expect(await seed.phraseToEntropy(await seed.entropyToPhrase(ent))).toEqual(ent);
    }
  });

  it('a mistyped word fails the checksum → null (nothing is derived)', async () => {
    const phrase = await seed.entropyToPhrase(ZEROS);
    expect(await seed.phraseToEntropy(phrase.replace(/art$/, 'abandon'))).toBeNull();
    const swapped = phrase.split(' '); swapped[5] = 'zoo';
    expect(await seed.phraseToEntropy(swapped.join(' '))).toBeNull();
  });

  it('unknown words and wrong word counts → null', async () => {
    const phrase = await seed.entropyToPhrase(ZEROS);
    expect(await seed.phraseToEntropy(phrase.replace('abandon', 'notaword'))).toBeNull();
    expect(await seed.phraseToEntropy(phrase.split(' ').slice(0, 23).join(' '))).toBeNull();
    expect(await seed.phraseToEntropy('')).toBeNull();
    expect(await seed.phraseToEntropy(null)).toBeNull();
  });

  it('masterSeed matches node:crypto pbkdf2Sync (independent PBKDF2-HMAC-SHA512)', async () => {
    const phrase = await seed.entropyToPhrase(ZEROS);
    const expected = pbkdf2Sync(phrase.normalize('NFKD'), 'mnemonic' + 'TREZOR', 2048, 64, 'sha512');
    expect(Buffer.from(await seed.masterSeed(ZEROS, 'TREZOR'))).toEqual(expected);
  });
});

describe('seed facade — deterministic derivation', () => {
  // Independent re-derivation with node:crypto: HKDF for the per-key
  // seeds, PKCS#8 + createPrivateKey/createPublicKey for the public keys.
  function nodeDerivedPub(master, info, oidPrefix) {
    const seedBytes = Buffer.from(hkdfSync('sha512'.replace('512', '256'), master, new Uint8Array(32), Buffer.from(info), 32));
    const der = Buffer.concat([Buffer.from(oidPrefix), seedBytes]);
    const priv = createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
    const spki = createPublicKey(priv).export({ format: 'der', type: 'spki' });
    return new Uint8Array(spki.subarray(spki.length - 32));
  }
  const X25519_PKCS8 = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20];
  const ED25519_PKCS8 = [0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20];

  it('identity + signing public keys match an independent node:crypto derivation', async () => {
    const phrase = await seed.entropyToPhrase(ZEROS);
    const master = pbkdf2Sync(phrase.normalize('NFKD'), 'mnemonic' + 'pass1', 2048, 64, 'sha512');
    const m = await seed.deriveIdentityMaterial(ZEROS, 'pass1');
    expect(m.identityPubRaw).toEqual(nodeDerivedPub(master, 'breeze-seed-v1:x25519-identity', X25519_PKCS8));
    // signingRecord.pubB64 is the base64 of the raw Ed25519 public key.
    const sgRaw = new Uint8Array(Buffer.from(m.signingRecord.pubB64, 'base64'));
    expect(sgRaw).toEqual(nodeDerivedPub(master, 'breeze-seed-v1:ed25519-signing', ED25519_PKCS8));
  });

  it('same phrase + passphrase ⇒ byte-identical keys, every call', async () => {
    const a = await seed.deriveIdentityMaterial(FFS, 'pw');
    const b = await seed.deriveIdentityMaterial(FFS, 'pw');
    expect(a.identityPubB64).toBe(b.identityPubB64);
    expect(a.identityPrivJwk).toEqual(b.identityPrivJwk);
    expect(a.signingRecord).toEqual(b.signingRecord);
  });

  it('a different passphrase derives a different account (BIP39 second factor)', async () => {
    const a = await seed.deriveIdentityMaterial(ZEROS, 'one');
    const b = await seed.deriveIdentityMaterial(ZEROS, 'two');
    const c = await seed.deriveIdentityMaterial(ZEROS, '');
    expect(a.identityPubB64).not.toBe(b.identityPubB64);
    expect(a.identityPubB64).not.toBe(c.identityPubB64);
    expect(a.signingRecord.pubB64).not.toBe(b.signingRecord.pubB64);
  });

  it('derived keys actually work: X25519 DH agrees, Ed25519 signs/verifies', async () => {
    const a = await seed.deriveIdentityMaterial(ZEROS, 'pw');
    const b = await seed.deriveIdentityMaterial(FFS, 'pw');
    const s1 = await crypto.subtle.deriveBits({ name: 'X25519', public: b.identityKeyPair.publicKey }, a.identityKeyPair.privateKey, 256);
    const s2 = await crypto.subtle.deriveBits({ name: 'X25519', public: a.identityKeyPair.publicKey }, b.identityKeyPair.privateKey, 256);
    expect(new Uint8Array(s1)).toEqual(new Uint8Array(s2));
    const data = new TextEncoder().encode('breeze');
    const sig = await crypto.subtle.sign({ name: 'Ed25519' }, a.signingKeyPair.privateKey, data);
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, a.signingKeyPair.publicKey, sig, data)).toBe(true);
  });
});

describe('seed facade — recovery kit wrap/unwrap', () => {
  const PAYLOAD = { backupV: 2, identity: { pubB64: 'aWRlbnRpdHk=' }, contacts: [], keyMaterial: { signing: { pubB64: 'c2ln' } } };

  it('round-trips the payload', async () => {
    const kit = await seed.wrapKit(ZEROS, 'kit-pass', PAYLOAD);
    expect(kit.kitV).toBe(1);
    expect(await seed.unwrapKit(ZEROS, 'kit-pass', kit)).toEqual(PAYLOAD);
  });

  it('wrong passphrase, wrong phrase, tampering, malformed → null', async () => {
    const kit = await seed.wrapKit(ZEROS, 'kit-pass', PAYLOAD);
    expect(await seed.unwrapKit(ZEROS, 'other-pass', kit)).toBeNull();
    expect(await seed.unwrapKit(FFS, 'kit-pass', kit)).toBeNull();
    const tampered = { ...kit, data: kit.data.slice(0, -4) + 'AAAA' };
    expect(await seed.unwrapKit(ZEROS, 'kit-pass', tampered)).toBeNull();
    expect(await seed.unwrapKit(ZEROS, 'kit-pass', { kitV: 2, iv: kit.iv, data: kit.data })).toBeNull();
    expect(await seed.unwrapKit(ZEROS, 'kit-pass', null)).toBeNull();
    expect(await seed.unwrapKit(ZEROS, 'kit-pass', '{"not":"a kit"}')).toBeNull();
  });
});

// Build the real createIdentity (+ _seedIdentityMaterial) out of
// index.html against the mock DB. The phrase dialog is stubbed: it
// captures the phrase it was shown and answers `promptAnswer`.
function buildCreate(db, { promptAnswer = 'drill-pass', api = null } = {}) {
  const toasts = [];
  const shown = { phrase: null };
  const src = [
    'let myKeys = null, myPubB64 = "", myName = "", myAlias = "", myId = "", myShortId = "", _userId = "";',
    slice('function arr(u8a)', 'function uid()'),
    slice('async function _seedIdentityMaterial()', 'async function createIdentity'),
    slice('async function createIdentity(name, alias, disposable', '// DOUBLE RATCHET CRYPTO ENGINE'),
  ].join('\n');
  const factory = new Function('db', '_dbg', 'showToast', 't', '_hasX25519', '_hasEd25519',
    '_promptRecoveryPhraseNew', 'genIdentityKey', 'dbPut', 'auditLog', 'generateShortId', 'localStorage', 'API',
    src + '; return { createIdentity, get: () => ({ myPubB64, myId }) };');
  const dbPut = (store, val, key) => new Promise(r => {
    const rq = db.transaction(store).objectStore(store).put(val, key);
    rq.onsuccess = () => r(true); rq.onerror = () => r(false);
  });
  const api2 = factory(
    db, () => {}, (msg, type) => { toasts.push({ msg, type }); }, (k) => k, true, true,
    async (phrase) => { shown.phrase = phrase; return promptAnswer; },
    async () => crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']),
    dbPut, () => {}, async () => 'breeze-test-test', { setItem() {} }, api,
  );
  return { ...api2, toasts, shown };
}

// Build the real restoreFromPhrase + createRecoveryKit out of index.html.
function buildRestoreFns(db, { promptResult = null, promptNewAnswer = 'kit-pass', domValues = {}, api = null, postAPIRaw = null } = {}) {
  const toasts = [];
  const timers = [];
  const downloads = [];
  const shown = { phrase: null };
  let reloads = 0;
  const src = [
    'let _signingKey = null, _signingPubB64 = "", myId = "";',
    'const D = { myId: () => myId, adoptRestoredSigning: (m) => { _signingKey = m.signingKeyPair; _signingPubB64 = m.signingRecord.pubB64; myId = m.identityPubB64.slice(0, 12); } };',
    slice('function arr(u8a)', 'function uid()'),
    slice('async function dbGet(store, key)', 'async function dbGetAll'),
    slice('async function dbGetAll(store)', 'async function dbGetByIndex'),
    sliceBackup('const BACKUP_FORMAT_V', 'async function backupToFile'),
    sliceBackup('async function createRecoveryKit()', '// ===== Backup & Restore (module end)'),
  ].join('\n');
  const factory = new Function('db', '_dbg', 'showToast', 't', '_DOM', '_promptRecoveryPhraseRestore',
    '_promptRecoveryPhraseNew', 'downloadBlob', 'API', 'postAPIRaw', 'authFields', 'MS', 'location', 'setTimeout',
    src + '; return { restoreFromPhrase, createRecoveryKit };');
  const api2 = factory(
    db, () => {}, (msg, type) => { toasts.push({ msg, type }); }, (k) => k,
    { get: (id) => ({ value: domValues[id] ?? '' }) },
    async () => promptResult,
    async (phrase) => { shown.phrase = phrase; return promptNewAnswer; },
    (blob) => { downloads.push(blob); },
    api,
    postAPIRaw || (async () => ({ ok: false })),
    async () => ({}),
    { SEC: 1000 },
    { reload: () => { reloads++; } },
    (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
  );
  return { ...api2, toasts, timers, downloads, shown, reloadCount: () => reloads };
}

const PASS = 'drill-pass';

describe('index.html — seed-derived creation and phrase restore (the drill)', () => {
  it('create → wipe → phrase restore reproduces identity + signing byte-for-byte', async () => {
    const db = mockDb();
    const create = buildCreate(db, { promptAnswer: PASS });
    expect(await create.createIdentity('Drill', '')).toBe(true);
    const idStore = db._stores.identity;
    const keysRec = idStore.get('keys');
    const signRec = idStore.get('signing');
    expect(keysRec.recoveryMode).toBe('phrase');
    expect(keysRec.pubB64).toBe(create.get().myPubB64);
    expect(signRec.pubB64).toBeTruthy();
    expect(create.shown.phrase.split(' ')).toHaveLength(24);

    // Total device loss: everything goes.
    idStore.clear(); db._stores.contacts.clear();

    const restore = buildRestoreFns(db, {
      promptResult: { phrase: create.shown.phrase, passphrase: PASS, kitFile: null },
      domValues: { 'msg-name': 'Drill', 'msg-alias': '' },
    });
    await restore.restoreFromPhrase();
    const keys2 = idStore.get('keys');
    const sign2 = idStore.get('signing');
    expect(keys2.pubB64).toBe(keysRec.pubB64);
    expect(keys2.priv).toEqual(keysRec.priv);
    expect(keys2.pub).toEqual(keysRec.pub);
    expect(keys2.recoveryMode).toBe('phrase');
    expect(sign2).toEqual(signRec);
    expect(restore.toasts).toContainEqual({ msg: 'toastRestoredReload', type: 'success' });
    expect(restore.timers).toHaveLength(1);
  });

  it('cancelling the phrase dialog creates nothing and reports false', async () => {
    const db = mockDb();
    const create = buildCreate(db, { promptAnswer: null });
    expect(await create.createIdentity('Drill', '')).toBe(false);
    expect(db._stores.identity.size).toBe(0);
  });

  it('a bad phrase at restore creates nothing (checksum catches the typo)', async () => {
    const db = mockDb();
    const restore = buildRestoreFns(db, {
      promptResult: { phrase: Array(24).fill('abandon').join(' '), passphrase: PASS, kitFile: null },
    });
    await restore.restoreFromPhrase();
    expect(db._stores.identity.size).toBe(0);
    expect(restore.toasts).toEqual([{ msg: 'toastRecoveryBadPhrase', type: 'error' }]);
    expect(restore.timers).toHaveLength(0);
  });

  it('a wrong passphrase caught by the alias guard creates nothing', async () => {
    // Create an account with alias 'drill' (API stubbed off during create;
    // the relay record is simulated at restore time instead).
    const db = mockDb();
    const create = buildCreate(db, { promptAnswer: PASS });
    await create.createIdentity('Drill', '');
    const pubB64 = create.get().myPubB64;
    db._stores.identity.clear();

    const postAPIRaw = async (path, body) => {
      if (path === '/alias/get' && body.alias === 'drill') {
        return { ok: true, json: async () => ({ pub: pubB64, name: 'Drill' }) };
      }
      return { ok: false };
    };
    const restore = buildRestoreFns(db, {
      promptResult: { phrase: create.shown.phrase, passphrase: 'WRONG-pass', kitFile: null },
      domValues: { 'msg-name': 'Drill', 'msg-alias': 'drill' },
      api: 'https://relay.invalid', postAPIRaw,
    });
    await restore.restoreFromPhrase();
    expect(db._stores.identity.size).toBe(0);
    expect(restore.toasts).toEqual([{ msg: 'toastRecoveryMismatch', type: 'error' }]);
    expect(restore.timers).toHaveLength(0);
  });

  it('the correct passphrase + alias restores and adopts the alias', async () => {
    const db = mockDb();
    const create = buildCreate(db, { promptAnswer: PASS });
    await create.createIdentity('Drill', '');
    const pubB64 = create.get().myPubB64;
    db._stores.identity.clear();
    const postAPIRaw = async (path, body) => {
      if (path === '/alias/get' && body.alias === 'drill') {
        return { ok: true, json: async () => ({ pub: pubB64, name: 'Drill' }) };
      }
      return { ok: false };
    };
    const restore = buildRestoreFns(db, {
      promptResult: { phrase: create.shown.phrase, passphrase: PASS, kitFile: null },
      domValues: { 'msg-name': 'Drill', 'msg-alias': 'drill' },
      api: 'https://relay.invalid', postAPIRaw,
    });
    await restore.restoreFromPhrase();
    expect(db._stores.identity.get('keys').pubB64).toBe(pubB64);
    expect(db._stores.identity.get('keys').alias).toBe('drill');
  });

  it('phrase restore refuses when an identity already exists', async () => {
    const db = mockDb();
    db._stores.identity.set('keys', { pubB64: 'existing' });
    const restore = buildRestoreFns(db, { promptResult: null });
    await restore.restoreFromPhrase();
    expect(restore.toasts).toEqual([{ msg: 'toastRecoveryHasIdentity', type: 'error' }]);
    expect(db._stores.identity.get('keys').pubB64).toBe('existing');
  });
});

describe('index.html — recovery kit for a legacy (random-key) identity', () => {
  const LEGACY_KEYS = { pub: [1, 2, 3], priv: { kty: 'OKP', crv: 'X25519' }, pubB64: 'bGVnYWN5LXB1Yg==', name: 'Legacy', alias: 'legacy' };
  const LEGACY_SIGNING = { priv: { kty: 'OKP' }, pub: { kty: 'OKP' }, pubB64: 'bGVnYWN5LXNpZw==' };
  const CONTACT = { id: 'c1', pubB64: 'Y29udGFjdA==', name: 'Peer' };

  function legacyDb() {
    const db = mockDb();
    db._stores.identity.set('keys', LEGACY_KEYS);
    db._stores.identity.set('signing', LEGACY_SIGNING);
    db._stores.contacts.set('c1', CONTACT);
    return db;
  }

  it('kit create → fresh install → kit restore brings back the legacy identity whole', async () => {
    const db = legacyDb();
    const kitSide = buildRestoreFns(db, { promptNewAnswer: 'kit-pass' });
    await kitSide.createRecoveryKit();
    expect(kitSide.downloads).toHaveLength(1);
    expect(kitSide.shown.phrase.split(' ')).toHaveLength(24);
    const kitText = await kitSide.downloads[0].text();
    expect(JSON.parse(kitText).kitV).toBe(1);
    expect(kitText).not.toContain(LEGACY_KEYS.pubB64); // the payload is encrypted, not embedded

    const fresh = mockDb();
    const restore = buildRestoreFns(fresh, {
      promptResult: { phrase: kitSide.shown.phrase, passphrase: 'kit-pass', kitFile: { text: async () => kitText } },
    });
    await restore.restoreFromPhrase();
    expect(fresh._stores.identity.get('keys')).toEqual(LEGACY_KEYS);
    expect(fresh._stores.identity.get('signing')).toEqual(LEGACY_SIGNING);
    expect(fresh._stores.contacts.get('c1')).toEqual(CONTACT);
    expect(restore.toasts).toContainEqual({ msg: 'toastRestoredReload', type: 'success' });
  });

  it('wrong kit passphrase / wrong phrase / not-a-kit create nothing', async () => {
    const db = legacyDb();
    const kitSide = buildRestoreFns(db, { promptNewAnswer: 'kit-pass' });
    await kitSide.createRecoveryKit();
    const kitText = await kitSide.downloads[0].text();
    const phrase = kitSide.shown.phrase;

    for (const attempt of [
      { phrase, passphrase: 'WRONG', kitFile: { text: async () => kitText } },
      { phrase: await seed.entropyToPhrase(FFS), passphrase: 'kit-pass', kitFile: { text: async () => kitText } },
    ]) {
      const fresh = mockDb();
      const restore = buildRestoreFns(fresh, { promptResult: attempt });
      await restore.restoreFromPhrase();
      expect(fresh._stores.identity.size).toBe(0);
      expect(fresh._stores.contacts.size).toBe(0);
      expect(restore.toasts).toEqual([{ msg: 'toastRecoveryKitFailed', type: 'error' }]);
      expect(restore.timers).toHaveLength(0);
    }

    const fresh = mockDb();
    const notKit = buildRestoreFns(fresh, {
      promptResult: { phrase, passphrase: 'kit-pass', kitFile: { text: async () => '{"hello":1}' } },
    });
    await notKit.restoreFromPhrase();
    expect(fresh._stores.identity.size).toBe(0);
    expect(notKit.toasts).toEqual([{ msg: 'toastRecoveryKitFailed', type: 'error' }]);
  });
});

describe('recovery step 3 — wiring pins', () => {
  it('the module script loads seed.js and exposes window.__breezeSeed', () => {
    expect(html).toContain("import { createSeedHelper } from './src/crypto/seed.js';");
    expect(html).toContain('window.__breezeSeed = createSeedHelper();');
  });

  it('the setup screen offers phrase recovery next to file restore', () => {
    const setup = slice('<div id="msg-setup"', '<!-- Main UI -->');
    expect(setup).toContain('id="b-msg-setup-phrase"');
    expect(setup).toContain('data-i18n="setupPhrase"');
    expect(html).toContain("_DOM.get('b-msg-setup-phrase')?.addEventListener('click', () => { restoreFromPhrase(); });");
  });

  it('seed-derived records carry recoveryMode, random ones do not', () => {
    expect(html).toContain("recoveryMode: 'phrase'");
    const create = slice('async function createIdentity(name, alias, disposable', '// DOUBLE RATCHET CRYPTO ENGINE');
    expect(create).toContain('...(seedMat ? { recoveryMode:');
  });

  it('the /backup panel offers the recovery kit and the handler is wired', () => {
    expect(html).toContain('data-action="recovery-kit"');
    expect(html).toContain('if (e.target.closest(\'[data-action="recovery-kit"]\')) { createRecoveryKit(); return; }');
  });

  it('the file backup passphrase minimum is 6, level with cloud (plan §2 item 8)', () => {
    const backup = sliceBackup('async function backupToFile()', 'function restoreFromFilePicker()');
    expect(backup).toContain('pass.length < 6');
    expect(backup).toContain("t('backupPassMin')");
    expect(backup).not.toContain('toastMin4Chars');
  });

  it('sw.js precaches the seed module closure for offline first boot', () => {
    expect(sw).toContain("'/src/crypto/seed.js'");
    expect(sw).toContain("'/src/crypto/wordlist.js'");
  });

  it('all new i18n keys exist in EN (inline) and JA (locales/ja.json)', () => {
    const keys = ['setupPhrase', 'recoveryPhraseTitle', 'recoveryPhraseDesc', 'recoveryPassLabel',
      'recoverySaved', 'recoveryRestoreTitle', 'recoveryPhraseLabel', 'recoveryKitFileLabel',
      'recoveryKitBtn', 'toastRecoveryBadPhrase', 'toastRecoveryKitFailed', 'toastRecoveryInvalidKit',
      'toastRecoveryUnavailable', 'toastRecoveryKitCreated', 'toastRecoveryHasIdentity', 'toastRecoveryMismatch'];
    for (const k of keys) {
      expect(html, `EN missing ${k}`).toContain(`${k}:`);
      expect(typeof ja[k], `JA missing ${k}`).toBe('string');
      expect(ja[k].length).toBeGreaterThan(0);
    }
    expect(ja.setupPhrase).toBe('復旧フレーズで復元');
  });
});
