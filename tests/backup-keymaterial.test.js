// Recovery plan step 1 (docs/IDENTITY_RECOVERY_PLAN.md §1.6 defect 2): backups
// carried only the DH identity record, so a restore brought back the address but
// silently minted a NEW Ed25519 signing key — device-registry root authority,
// bundle/alias/backup signatures, prekey private halves, group sender keys and
// the PQ seed were all left behind. These tests execute the REAL helpers sliced
// from index.html (collect/restore + the file backup's own encrypt/decrypt +
// the real dbGet/dbPut) against a mock IndexedDB and pin:
//   - the round-trip drill: populate → collect → encrypt → wipe → restore →
//     identity authority (sign/verify), PQ responder (encap/decap) and every
//     record come back byte-identical;
//   - sessions (sess:) and the instance id (inst) are NEVER collected;
//   - v1 backups (no keyMaterial) restore exactly the old scope, no throw;
//   - a tampered or wrong-passphrase backup decrypts to nothing and writes
//     nothing (AES-GCM authentication is the rejection mechanism);
//   - malformed key-material entries are skipped, valid siblings still land;
//   - /keywrap-wrapped record forms round-trip as stored.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mintPQPreKey, pqPublicKeyFromSeed, pqSecretKeyFromSeed } from '../src/crypto/pqkey.js';
import { ml_kem768 } from '../src/crypto/mlkem.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'index.html'), 'utf8');

function slice(from, to) {
  const a = html.indexOf(from);
  const b = html.indexOf(to);
  expect(a, `anchor not found: ${from}`).toBeGreaterThan(-1);
  expect(b, `anchor not found: ${to}`).toBeGreaterThan(a);
  return html.slice(a, b);
}

// Minimal IndexedDB stand-in: per-store Maps, request objects resolve on the
// next microtask like real IDB (the outbox-idb.test.js pattern, extended with
// put/getAllKeys for the dbPut and gsk:-enumeration paths).
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
          put: (val, key) => req(() => { m.set(key, val); return key; }),
          getAllKeys: () => req(() => [...m.keys()]),
        }),
      };
    },
  };
}

const CONFIG = { PBKDF2_ITERATIONS: 100000, IV_BYTES: 12, AES_KEY_BITS: 256 };

function build(db) {
  const src = [
    slice('function arr(u8a)', 'function uid()'),
    slice('async function deriveKey', '// v3.6 Phase 2c'),
    slice('function _atRestIsWrapped', '// Loads the private JWK'),
    slice('async function dbGet(store, key)', 'async function dbGetAll'),
    slice('const BACKUP_FORMAT_V', 'async function backupToFile'),
  ].join('\n');
  const factory = new Function('db', 'CONFIG', '_dbg',
    src + '; return { encrypt, decrypt, _collectBackupKeyMaterial, _restoreBackupKeyMaterial, BACKUP_FORMAT_V };');
  return factory(db, CONFIG, () => {});
}

const b64 = (bytes) => Buffer.from(bytes).toString('base64');

async function makeKeyMaterial() {
  // DH identity key (X25519 JWKs, the genRatchetKey / createIdentity shapes)
  const idKp = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const idPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', idKp.publicKey));
  const idPrivJwk = await crypto.subtle.exportKey('jwk', idKp.privateKey);
  const idPubJwk = await crypto.subtle.exportKey('jwk', idKp.publicKey);
  const pubB64 = b64(idPubRaw);
  // Ed25519 signing key (the initSigning record shape)
  const sigKp = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const sigPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', sigKp.publicKey));
  const signing = {
    priv: await crypto.subtle.exportKey('jwk', sigKp.privateKey),
    pub: await crypto.subtle.exportKey('jwk', sigKp.publicKey),
    pubB64: b64(sigPubRaw),
  };
  // Prekey private halves (spk-priv { priv }, otp-priv { keys })
  const spkKp = await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
  const spkPriv = { priv: await crypto.subtle.exportKey('jwk', spkKp.privateKey) };
  const otpPriv = { keys: [idPrivJwk, await crypto.subtle.exportKey('jwk', spkKp.privateKey)] };
  // PQ seed (deterministic RNG so the expected public key is stable)
  const minted = mintPQPreKey((n) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) & 0xff));
  const pqPriv = { seed: Array.from(minted.seed) };
  return {
    keys: { pub: idPubJwk, priv: idPrivJwk, pubB64, name: 'Drill', alias: 'drill' },
    signing,
    account: { root: pubB64, rootEd: signing.pubB64, isPrimary: true },
    spkPriv, otpPriv, pqPriv,
    pqPublicKey: minted.publicKey,
    gsk: {
      'group-alpha': { chainKey: Array.from({ length: 32 }, (_, i) => i), counter: 4, epoch: 1, v: 5, skipped: {} },
      'group-beta': { chainKey: Array.from({ length: 32 }, (_, i) => 255 - i), counter: 0, epoch: 2, v: 5, skipped: {} },
    },
  };
}

function seedStore(db, km) {
  const id = db._stores.identity;
  id.set('keys', km.keys);
  id.set('signing', km.signing);
  id.set('account', km.account);
  id.set('spk-priv', km.spkPriv);
  id.set('otp-priv', km.otpPriv);
  id.set('pq-priv', km.pqPriv);
  for (const [gid, rec] of Object.entries(km.gsk)) id.set('gsk:' + gid, rec);
  // Records that must NEVER enter a backup:
  id.set('sess:peer-one', { rootKey: [1, 2, 3], counter: 9 });
  id.set('inst', { id: 'install-xyz' });
}

describe('backup key material — collect', () => {
  it('collects signing/account/prekey privates/gsk/pq and excludes sessions + inst', async () => {
    const db = mockDb();
    const km = await makeKeyMaterial();
    seedStore(db, km);
    const api = build(db);
    const out = await api._collectBackupKeyMaterial();
    expect(out.signing).toEqual(km.signing);
    expect(out.account).toEqual(km.account);
    expect(out.spkPriv).toEqual(km.spkPriv);
    expect(out.otpPriv).toEqual(km.otpPriv);
    expect(out.pqPriv).toEqual(km.pqPriv);
    expect(out.gsk).toEqual(km.gsk);
    const flat = JSON.stringify(out);
    expect(flat).not.toContain('sess:');
    expect(flat).not.toContain('install-xyz');
    expect(api.BACKUP_FORMAT_V).toBe(2);
  });

  it('collects nothing (empty object) from a store with no key material', async () => {
    const api = build(mockDb());
    expect(await api._collectBackupKeyMaterial()).toEqual({});
  });
});

describe('backup key material — the round-trip drill', () => {
  it('backup → encrypt → wipe → restore: authority, PQ and every record return', async () => {
    const km = await makeKeyMaterial();
    const dbA = mockDb();
    seedStore(dbA, km);
    const a = build(dbA);
    const keyMaterial = await a._collectBackupKeyMaterial();
    // The exact payload shape backupToFile writes, through the REAL file-backup
    // encrypt() (PBKDF2 + AES-256-GCM), across a JSON file boundary.
    const payload = { backupV: a.BACKUP_FORMAT_V, identity: km.keys, contacts: [], keyMaterial, exportedAt: new Date().toISOString() };
    const enc = await a.encrypt('drill-passphrase', JSON.stringify(payload));
    const fileText = JSON.stringify(enc);

    // Fresh device: empty store, decrypt with the real decrypt().
    const dbB = mockDb();
    const b = build(dbB);
    const data = JSON.parse(await b.decrypt('drill-passphrase', JSON.parse(fileText)));
    expect(data.backupV).toBe(2);
    dbB._stores.identity.set('keys', data.identity);
    const restored = await b._restoreBackupKeyMaterial(data.keyMaterial);
    expect(restored).toBe(7); // signing, account, spk-priv, otp-priv, pq-priv, 2× gsk

    const idB = dbB._stores.identity;
    expect(idB.get('signing')).toEqual(km.signing);
    expect(idB.get('account')).toEqual(km.account);
    expect(idB.get('spk-priv')).toEqual(km.spkPriv);
    expect(idB.get('otp-priv')).toEqual(km.otpPriv);
    expect(idB.get('pq-priv')).toEqual(km.pqPriv);
    expect(idB.get('gsk:group-alpha')).toEqual(km.gsk['group-alpha']);
    expect(idB.get('gsk:group-beta')).toEqual(km.gsk['group-beta']);
    expect(idB.has('sess:peer-one')).toBe(false);
    expect(idB.has('inst')).toBe(false);

    // Device-management authority: the restored signing key signs a
    // device-registry-shaped string and the restored public key verifies it —
    // the root loss §1.6 defect 2 said a restore could NOT heal.
    const sig = idB.get('signing');
    const priv = await crypto.subtle.importKey('jwk', sig.priv, { name: 'Ed25519' }, false, ['sign']);
    const pub = await crypto.subtle.importKey('jwk', sig.pub, { name: 'Ed25519' }, true, ['verify']);
    const msg = new TextEncoder().encode('breeze-device-set:drill:1700000000000:digest');
    const signature = await crypto.subtle.sign({ name: 'Ed25519' }, priv, msg);
    expect(await crypto.subtle.verify({ name: 'Ed25519' }, pub, signature, msg)).toBe(true);

    // PQ responder: the restored seed re-derives the same keypair, and a
    // ciphertext encapsulated to it decapsulates to the same shared secret.
    const seed = Uint8Array.from(idB.get('pq-priv').seed);
    expect(pqPublicKeyFromSeed(seed)).toEqual(km.pqPublicKey);
    const { cipherText, sharedSecret } = ml_kem768.encapsulate(km.pqPublicKey);
    expect(ml_kem768.decapsulate(cipherText, pqSecretKeyFromSeed(seed))).toEqual(sharedSecret);

    // Prekey private halves are importable (a responder can use them at once).
    const spkPriv = await crypto.subtle.importKey('jwk', idB.get('spk-priv').priv, { name: 'X25519' }, false, ['deriveBits']);
    expect(spkPriv.type).toBe('private');
  });

  it('cloud-shaped payload (same keyMaterial block) restores identically', async () => {
    const km = await makeKeyMaterial();
    const dbA = mockDb();
    seedStore(dbA, km);
    const a = build(dbA);
    const keyMaterial = await a._collectBackupKeyMaterial();
    // createCloudBackup's payload shape — v is the PROTOCOL version; the backup
    // format rides in backupV + keyMaterial, shared with the file path.
    const data = { v: 4, backupV: a.BACKUP_FORMAT_V, identity: km.keys, contacts: [], messages: [], keyMaterial, exportedAt: Date.now() };
    const dbB = mockDb();
    const b = build(dbB);
    expect(await b._restoreBackupKeyMaterial(data.keyMaterial)).toBe(7);
    expect(dbB._stores.identity.get('signing')).toEqual(km.signing);
    expect(dbB._stores.identity.get('pq-priv')).toEqual(km.pqPriv);
  });
});

describe('backup key material — compatibility and rejection', () => {
  it('v1 backups (no keyMaterial) restore the old scope only, without throwing', async () => {
    const db = mockDb();
    const b = build(db);
    expect(await b._restoreBackupKeyMaterial(undefined)).toBe(0);
    expect(await b._restoreBackupKeyMaterial(null)).toBe(0);
    expect(db._stores.identity.size).toBe(0);
  });

  it('a tampered backup decrypts to nothing — and nothing is written', async () => {
    const km = await makeKeyMaterial();
    const dbA = mockDb();
    seedStore(dbA, km);
    const a = build(dbA);
    const payload = { backupV: 2, identity: km.keys, contacts: [], keyMaterial: await a._collectBackupKeyMaterial() };
    const enc = await a.encrypt('drill-passphrase', JSON.stringify(payload));
    const tampered = JSON.parse(JSON.stringify(enc));
    tampered.d[10] ^= 0xff; // flip one ciphertext byte — GCM must refuse
    const dbB = mockDb();
    const b = build(dbB);
    // The inline decrypt() swallows the GCM failure and yields undefined;
    // restoreBackup's JSON.parse(undefined) throws before any write, which the
    // outer catch turns into the wrong-passphrase toast. Pin both halves.
    expect(await b.decrypt('drill-passphrase', tampered)).toBeUndefined();
    expect(await b.decrypt('wrong-passphrase', enc)).toBeUndefined();
    expect(dbB._stores.identity.size).toBe(0);
  });

  it('malformed entries are skipped; valid siblings still land', async () => {
    const km = await makeKeyMaterial();
    const db = mockDb();
    const b = build(db);
    const restored = await b._restoreBackupKeyMaterial({
      signing: { pubB64: 42 },                                   // not a string pubB64
      account: { root: km.account.root, rootEd: null, isPrimary: true },
      spkPriv: { nope: true },                                   // no priv JWK
      otpPriv: { keys: 'not-an-array' },
      pqPriv: { seed: [1, 2, 3] },                               // wrong seed length
      gsk: { 'good-group': km.gsk['group-alpha'], 'bad-group': [1, 2] },
    });
    expect(restored).toBe(2); // account + the one valid gsk entry
    const id = db._stores.identity;
    expect(id.has('signing')).toBe(false);
    expect(id.has('spk-priv')).toBe(false);
    expect(id.has('otp-priv')).toBe(false);
    expect(id.has('pq-priv')).toBe(false);
    expect(id.get('account')).toEqual({ root: km.account.root, rootEd: null, isPrimary: true });
    expect(id.get('gsk:good-group')).toEqual(km.gsk['group-alpha']);
    expect(id.has('gsk:bad-group')).toBe(false);
  });

  it('/keywrap-wrapped record forms round-trip as stored', async () => {
    const km = await makeKeyMaterial();
    const wrapped = { v: 1, kdf: 'pbkdf2', hash: 'SHA-256', iter: 600000, salt: 'AA==', iv: 'AA==', ct: 'AA==' };
    const dbA = mockDb();
    seedStore(dbA, km);
    dbA._stores.identity.set('signing', { pub: km.signing.pub, pubB64: km.signing.pubB64, wrapped });
    dbA._stores.identity.set('pq-priv', { wrapped });
    const a = build(dbA);
    const keyMaterial = await a._collectBackupKeyMaterial();
    const dbB = mockDb();
    const b = build(dbB);
    await b._restoreBackupKeyMaterial(keyMaterial);
    expect(dbB._stores.identity.get('signing')).toEqual({ pub: km.signing.pub, pubB64: km.signing.pubB64, wrapped });
    expect(dbB._stores.identity.get('pq-priv')).toEqual({ wrapped });
  });
});

describe('backup key material — wiring pins', () => {
  it('both backup producers emit backupV + keyMaterial; both restore paths consume it', () => {
    expect(html.match(/_collectBackupKeyMaterial\(\)/g)).toHaveLength(3); // def + file + cloud
    expect(html.match(/_restoreBackupKeyMaterial\(data\.keyMaterial\)/g)).toHaveLength(2);
    expect(html.match(/backupV: BACKUP_FORMAT_V/g)).toHaveLength(2);
  });
});
