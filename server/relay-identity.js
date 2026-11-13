// The relay identity key (stage-2 step 3, docs/RELAY_STAGE2_PLAN.md):
// an Ed25519 keypair that is THIS relay's persistent identity. Step 3
// provisions and stores it; step 4 publishes the public half in
// /api/health and lets clients pin it (design D3 — the pin
// authenticates continuity, not virtue). Nothing in this step exposes
// the key anywhere: no health field, no route, no env entry.
//
// Storage: a dedicated `relay_meta` table inside the same SQLite file
// as everything else, so the data volume stays the whole relay state
// (one file to back up, and the static layer already refuses to serve
// database files). The table is deliberately NOT part of the KV shim:
// no worker code path can read, list or overwrite the private key —
// only this module and step 4's host wiring ever touch it.
//
// Format: `publicKey` is the raw 32-byte key, base64 — the same shape
// as every other Ed25519 public key in the system (edIdentityKey) —
// and `privateKey` is the PKCS#8 DER encoding, base64. The
// fingerprint is the first 8 bytes of SHA-256(publicKey) as grouped
// uppercase hex; step 4's client display derives from the same digest.

import { createHash, generateKeyPairSync } from 'node:crypto';

const META_TABLE = 'relay_meta';
const KEY_ROW = 'relay-identity-v1';

export function relayFingerprint(publicKeyB64) {
  const digest = createHash('sha256').update(Buffer.from(publicKeyB64, 'base64')).digest();
  return digest.subarray(0, 8).toString('hex').toUpperCase().match(/.{4}/g).join(' ');
}

// Load the relay identity from the database, generating and storing
// one on first run. Returns { publicKey, privateKey, fingerprint,
// created } — `created` tells the caller to announce a NEW identity
// in the boot log (an operator whose users pinned the old fingerprint
// must notice when it changes).
export function loadOrCreateRelayIdentity(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${META_TABLE} (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);
  const row = db.prepare(`SELECT value FROM ${META_TABLE} WHERE key = ?`).get(KEY_ROW);
  if (row) {
    const stored = JSON.parse(row.value);
    return { ...stored, created: false, fingerprint: relayFingerprint(stored.publicKey) };
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  // JWK export gives the raw public key directly (`x`, base64url);
  // store it as ordinary base64 to match the system's other keys.
  const publicKeyB64 = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
  const record = {
    publicKey: publicKeyB64,
    privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
  db.prepare(`INSERT INTO ${META_TABLE} (key, value) VALUES (?, ?)`).run(KEY_ROW, JSON.stringify(record));
  return { ...record, created: true, fingerprint: relayFingerprint(record.publicKey) };
}
