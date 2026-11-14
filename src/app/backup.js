// ============================================================================
// BACKUP & RESTORE — the encrypted file backup, the recovery kit and phrase
// restore, and the (opt-in relay) cloud backup, extracted from index.html's
// initMessenger closure (modularization: index.html carries a hard line
// budget in validate.sh, and this subsystem is ~400 lines of it).
//
// Why a factory: these were closure functions. Everything they used from
// the closure arrives via the deps object D — stable references destructured
// below (the IDB handle and its helpers, the relay/signing plumbing), plus
// the few REASSIGNED identity bindings behind accessors: D.myId() reads
// the live value, and D.adoptRestoredSigning(m) performs the one write-back
// phrase restore needs (it adopts the restored signing key and id for the
// immediately following alias claim, exactly as the inline code did).
// Top-level app globals (t, showToast, showPrompt, _dbg, _DOM, MS, CONFIG,
// API, postAPIRaw, arr, u8, encrypt, decrypt, downloadBlob, generatePoW and
// the recovery prompt dialogs) resolve from the global scope, exactly as
// they did inline. Behaviour is unchanged — this is a move, not a rewrite.
// ============================================================================

export function createBackupTools(D) {
  const { db, dbGet, dbPut, dbGetAll, authFields, homeRelays, postAPIRelay, signMessage } = D;

  // ===== Backup & Restore =====
  // Recovery plan step 1 (docs/IDENTITY_RECOVERY_PLAN.md §1.6 defect 2): a backup that
  // carries only the DH identity record restores the address but NOT the authority —
  // the Ed25519 signing key (device-registry root; bundle/alias/backup signatures),
  // the account binding, the prekey private halves and the group sender keys were
  // left behind, so a "successful" restore silently minted a NEW signing key and the
  // documented recovery path did not heal root loss. Format-v2 payloads carry the
  // missing key material in `keyMaterial`; v1 payloads (no `keyMaterial`) restore
  // exactly as before and simply lack it. Records are carried AS STORED — including
  // /keywrap-wrapped forms for the slots keywrap covers (keys/signing/pq-priv): the
  // wrapped form is self-contained (KDF parameters and the slot-bound AAD travel
  // with it, and the AAD binds the slot name, not the device), so it unwraps on the
  // new install with the at-rest passphrase exactly as on the old one. Sessions
  // (sess:) are deliberately NOT carried — a restored ratchet would fork (plan §2);
  // every 1:1 session re-bootstraps from the restored prekey material instead. The
  // per-install instance id (inst) is clone detection and is likewise excluded.
  const BACKUP_FORMAT_V = 2;
  async function _collectBackupKeyMaterial() {
    const out = {};
    try {
      const signing = await dbGet('identity', 'signing');
      if (signing) out.signing = signing;
      const account = await dbGet('identity', 'account');
      if (account) out.account = account;
      const spkPriv = await dbGet('identity', 'spk-priv');
      if (spkPriv) out.spkPriv = spkPriv;
      const otpPriv = await dbGet('identity', 'otp-priv');
      if (otpPriv) out.otpPriv = otpPriv;
      const pqPriv = await dbGet('identity', 'pq-priv');
      if (pqPriv) out.pqPriv = pqPriv;
      // Group sender keys live under one IDB key per group (gsk:<groupId>) — the
      // session-pruning enumeration precedent, filtered to that prefix only.
      const idKeys = await new Promise(r => { try { const req = db.transaction('identity').objectStore('identity').getAllKeys(); req.onsuccess = () => r(req.result || []); req.onerror = () => r([]); } catch(e) { _dbg(e, 'backup-gsk-keys'); r([]); } });
      const gsk = {};
      for (const k of idKeys) {
        if (typeof k !== 'string' || !k.startsWith('gsk:')) continue;
        const rec = await dbGet('identity', k);
        if (rec) gsk[k.slice(4)] = rec;
      }
      if (Object.keys(gsk).length) out.gsk = gsk;
    } catch(e) { _dbg(e, 'backup-collect'); }
    return out;
  }
  // Shape guards for restored key material — a malformed or hostile backup entry is
  // skipped (and logged), never written into the identity store. Mirrors the contact
  // validation restoreBackup already applies.
  function _backupRecOk(rec, kind) {
    const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
    if (!isObj(rec)) return false;
    if (kind === 'signing') return typeof rec.pubB64 === 'string' && rec.pubB64.length <= 128 &&
      (isObj(rec.wrapped) || (isObj(rec.priv) && isObj(rec.pub)));
    if (kind === 'account') return typeof rec.root === 'string' && rec.root.length <= 128 &&
      (rec.rootEd == null || (typeof rec.rootEd === 'string' && rec.rootEd.length <= 128)) &&
      (rec.isPrimary === undefined || typeof rec.isPrimary === 'boolean');
    if (kind === 'spkPriv') return isObj(rec.priv);
    if (kind === 'otpPriv') return Array.isArray(rec.keys) && rec.keys.length <= 1000 && rec.keys.every(isObj);
    if (kind === 'pqPriv') return isObj(rec.wrapped) ||
      (Array.isArray(rec.seed) && rec.seed.length === 64 && rec.seed.every(b => Number.isInteger(b) && b >= 0 && b <= 255));
    return false;
  }
  async function _restoreBackupKeyMaterial(km) {
    if (!km || typeof km !== 'object') return 0;
    let restored = 0;
    const put = async (rec, kind, slot) => {
      if (rec === undefined) return;
      if (!_backupRecOk(rec, kind)) { _dbg(null, 'backup-restore: skipping malformed ' + kind); return; }
      if (await dbPut('identity', rec, slot)) restored++;
    };
    await put(km.signing, 'signing', 'signing');
    await put(km.account, 'account', 'account');
    await put(km.spkPriv, 'spkPriv', 'spk-priv');
    await put(km.otpPriv, 'otpPriv', 'otp-priv');
    await put(km.pqPriv, 'pqPriv', 'pq-priv');
    if (km.gsk && typeof km.gsk === 'object' && !Array.isArray(km.gsk)) {
      let n = 0;
      for (const [gid, rec] of Object.entries(km.gsk)) {
        if (n++ >= 500) { _dbg(null, 'backup-restore: gsk entry cap reached'); break; }
        if (typeof gid !== 'string' || !gid || gid.length > 128 || !rec || typeof rec !== 'object' || Array.isArray(rec)) { _dbg(null, 'backup-restore: skipping malformed gsk entry'); continue; }
        if (await dbPut('identity', rec, 'gsk:' + gid)) restored++;
      }
    }
    return restored;
  }

  async function backupToFile() {
    const identity = await dbGet('identity', 'keys');
    const contacts = await dbGetAll('contacts');
    if (!identity) { showToast(t('toastNoIdentityBackup'), 'error'); return; }
    if (identity.recoveryMode === 'none') { showToast(t('toastRecoveryNoneBackup'), 'error'); return; }

    const pass = await showPrompt(t('backupPassSet'), '', { type: 'password', okText: t('encrypt'), autocomplete: 'new-password' });
    // Recovery plan §2 item 8 / step 3: the file backup's passphrase
    // minimum rises 4 → 6, level with the cloud path — the minimum IS the
    // security of a kit that now carries the full key material (step 1).
    // Creation-side only: restore accepts whatever opened an old backup.
    if (!pass || pass.length < 6) { showToast(t('backupPassMin'), 'error'); return; }

    const keyMaterial = await _collectBackupKeyMaterial();
    const data = JSON.stringify({ backupV: BACKUP_FORMAT_V, identity, contacts, keyMaterial, exportedAt: new Date().toISOString() });
    const enc = await encrypt(pass, data);
    const blob = new Blob([JSON.stringify(enc)], { type: 'application/json' });
    downloadBlob(blob, 'breeze-backup-' + new Date().toISOString().slice(0, 10) + '.json');
  }

  // Restoring used to require knowing you could drag a file onto the sidebar. Same file, same
  // decryption path — just an entry point a person can find.
  function restoreFromFilePicker() {
    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = 'application/json,.json';
    picker.onchange = async () => { const f = picker.files?.[0]; if (f) await restoreBackup(f); };
    picker.click();
  }

  async function restoreBackup(file) {
    const pass = await showPrompt(t('backupPassEnter'), '', { type: 'password', okText: t('decrypt'), autocomplete: 'current-password' });
    if (!pass) return;
    // "Not a Breeze backup at all" (unreadable, not JSON, not the {s,i,d}
    // envelope encrypt() writes) is a different failure from "a backup whose
    // passphrase does not open it" — name the one that happened. Either way
    // nothing is written: every store write below sits behind a successful
    // decrypt AND the identity check, which is what lets the first-run screen
    // (step 2) offer this entry with no identity yet — a failed attempt
    // creates nothing and leaves the setup screen exactly as it was.
    let enc;
    try { enc = JSON.parse(await file.text()); } catch(e) { _dbg(e, 'restore'); showToast(t('toastInvalidBackup'), 'error'); return; }
    if (!enc || !Array.isArray(enc.s) || !Array.isArray(enc.i) || !Array.isArray(enc.d)) { showToast(t('toastInvalidBackup'), 'error'); return; }
    try {
      const decrypted = await decrypt(pass, enc);
      const data = JSON.parse(decrypted);
      if (!data.identity?.pubB64) { showToast(t('toastInvalidBackup'), 'error'); return; }

      await dbPut('identity', data.identity, 'keys');
      for (const c of (data.contacts || [])) {
        // Validate required fields before storing — a malformed backup entry could corrupt the DB
        if (typeof c?.id !== 'string' || !c.id || c.id.length > 64 ||
            typeof c?.pubB64 !== 'string' || !c.pubB64 || c.pubB64.length > 128 ||
            !/^[A-Za-z0-9+/=]+$/.test(c.pubB64)) continue;
        await dbPut('contacts', c);
      }
      // Format v2 only: the key material (signing/account/prekey privates/gsk/pq).
      // Absent in v1 backups — those restore exactly the pre-step-1 scope.
      const legacy = !data.keyMaterial;
      await _restoreBackupKeyMaterial(data.keyMaterial);

      showToast(t('toastRestoredReload'), 'success');
      // A v1 restore brings back the address and contacts but NOT device
      // management: initSigning() mints a new signing key at boot (the limit
      // SECURITY.md records for pre-step-1 backups). Say so before the
      // reload, and hold the reload long enough for it to be read.
      if (legacy) showToast(t('toastRestoredLegacy'), 'warn', 9000);
      setTimeout(() => location.reload(), legacy ? 6 * MS.SEC : 1.5 * MS.SEC);
    } catch(e) { _dbg(e,'restore'); showToast(t('toastWrongPassphrase'), 'error'); }
  }

  // Recovery plan step 3 (docs/IDENTITY_RECOVERY_PLAN.md §3.1/§4): create a
  // recovery kit for an EXISTING identity. Pre-step-3 identities have
  // random keys that no phrase can re-derive, so the seed takes its other
  // form: a fresh phrase is minted and shown once, and the step-1 backup
  // payload (identity record + contacts + the full key material) is
  // wrapped under a key derived from seed + the recovery passphrase the
  // user sets in the phrase dialog (src/crypto/seed.js wrapKit). The kit
  // file alone opens nothing; phrase alone opens nothing; together they
  // are the account. Available to every recoverable identity (a
  // seed-derived account may also hold a kit as a second artefact — its
  // phrase alone already restores it, so for those this is
  // belt-and-braces, not a requirement). Disposable ('none') identities
  // are refused below: a kit would silently undo their chosen opt-out.
  async function createRecoveryKit() {
    const seedH = globalThis.__breezeSeed;
    if (!seedH) { showToast(t('toastRecoveryUnavailable'), 'error'); return; }
    const identity = await dbGet('identity', 'keys');
    if (!identity) { showToast(t('toastNoIdentityBackup'), 'error'); return; }
    if (identity.recoveryMode === 'none') { showToast(t('toastRecoveryNoneKit'), 'error'); return; }
    try {
      const entropy = seedH.randomEntropy();
      const phrase = await seedH.entropyToPhrase(entropy);
      const pass = await _promptRecoveryPhraseNew(phrase, t('recoveryKitBtn'));
      if (pass === null) return;
      const contacts = await dbGetAll('contacts');
      const keyMaterial = await _collectBackupKeyMaterial();
      const payload = { backupV: BACKUP_FORMAT_V, identity, contacts, keyMaterial, exportedAt: new Date().toISOString() };
      const kit = await seedH.wrapKit(entropy, pass, payload);
      downloadBlob(new Blob([JSON.stringify(kit)], { type: 'application/json' }), 'breeze-recovery-kit-' + new Date().toISOString().slice(0, 10) + '.json');
      showToast(t('toastRecoveryKitCreated'), 'success');
    } catch(e) { _dbg(e, 'recovery-kit'); showToast(t('toastRecoveryUnavailable'), 'error'); }
  }

  // Recovery plan step 3: first-run restore from the recovery phrase — the
  // setup screen's phrase entry (plan §4 step 2 named it as landing here).
  // Two shapes, one anchor:
  //   - seed-derived account: the phrase + passphrase RE-DERIVE the
  //     identity and signing keys byte-for-byte; the records written are
  //     exactly what creation wrote (name/alias come from the setup
  //     fields; the alias claim is re-attempted and adopted only when the
  //     relay accepts it — the relay-side record never stopped pointing
  //     at this key).
  //   - legacy account: the phrase + passphrase UNLOCK the recovery-kit
  //     file the user picks in the same dialog; the payload inside is the
  //     step-1 backup payload and lands through the same writes
  //     restoreBackup performs (identity, validated contacts, key
  //     material via _restoreBackupKeyMaterial).
  // Every write sits behind a successful derivation or kit open, so a
  // wrong phrase, wrong passphrase or tampered kit creates NOTHING — the
  // step-2 doctrine, pinned by test. Success reloads into _boot()'s
  // normal has-identity flow (the step-2 pattern); prekey material that
  // is not restored (derived path) is re-minted by that flow, exactly as
  // after a v1 file restore.
  async function restoreFromPhrase() {
    const seedH = globalThis.__breezeSeed;
    if (!seedH) { showToast(t('toastRecoveryUnavailable'), 'error'); return; }
    if (await dbGet('identity', 'keys')) { showToast(t('toastRecoveryHasIdentity'), 'error'); return; }
    const res = await _promptRecoveryPhraseRestore();
    if (!res) return;
    const entropy = await seedH.phraseToEntropy(res.phrase || '');
    if (!entropy) { showToast(t('toastRecoveryBadPhrase'), 'error'); return; }
    if (res.kitFile) {
      let kit;
      try { kit = JSON.parse(await res.kitFile.text()); } catch(e) { _dbg(e, 'kit-parse'); showToast(t('toastRecoveryInvalidKit'), 'error'); return; }
      const data = await seedH.unwrapKit(entropy, res.passphrase || '', kit);
      if (!data) { showToast(t('toastRecoveryKitFailed'), 'error'); return; }
      if (!data.identity?.pubB64) { showToast(t('toastRecoveryInvalidKit'), 'error'); return; }
      await dbPut('identity', data.identity, 'keys');
      for (const c of (data.contacts || [])) {
        if (typeof c?.id !== 'string' || !c.id || c.id.length > 64 ||
            typeof c?.pubB64 !== 'string' || !c.pubB64 || c.pubB64.length > 128 ||
            !/^[A-Za-z0-9+/=]+$/.test(c.pubB64)) continue;
        await dbPut('contacts', c);
      }
      await _restoreBackupKeyMaterial(data.keyMaterial);
      showToast(t('toastRestoredReload'), 'success');
      setTimeout(() => location.reload(), 1.5 * MS.SEC);
      return;
    }
    let m;
    try { m = await seedH.deriveIdentityMaterial(entropy, res.passphrase || ''); }
    catch(e) { _dbg(e, 'phrase-derive'); showToast(t('toastRecoveryUnavailable'), 'error'); return; }
    const name = _DOM.get('msg-name').value.trim().slice(0, 64) || 'Anonymous';
    const aliasWanted = (_DOM.get('msg-alias').value.trim() || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    // The passphrase guard: BIP39 cannot detect a wrong PASSPHRASE (it
    // silently derives a different, empty account — every mnemonic wallet
    // shares this property). But when the user typed their @alias, the
    // relay's record for it still names the ORIGINAL key: a derived key
    // that does not match means the phrase/passphrase pair is not the one
    // that made this account, so refuse BEFORE writing anything. A match
    // adopts the alias outright (no re-claim needed — the record never
    // stopped pointing here).
    let aliasAdopted = '';
    if (aliasWanted && API) {
      let resolved = null;
      try {
        const r = await postAPIRaw('/alias/get', { alias: aliasWanted });
        if (r.ok) resolved = (await r.json())?.pub || null;
      } catch(e) { _dbg(e, 'phrase-alias-resolve'); }
      if (resolved && resolved !== m.identityPubB64) { showToast(t('toastRecoveryMismatch'), 'error'); return; }
      if (resolved) aliasAdopted = aliasWanted;
    }
    await dbPut('identity', { pub: m.identityPubArr, priv: m.identityPrivJwk, pubB64: m.identityPubB64, name, alias: aliasAdopted, recoveryMode: 'phrase' }, 'keys');
    await dbPut('identity', m.signingRecord, 'signing');
    // No alias typed, or the relay could not be asked: best-effort claim,
    // signed with the just-restored signing key (authFields signs via
    // _signingKey/myId, set only for this call — the reload immediately
    // after hands over to the normal boot). Adopted into the record only
    // when the relay accepts; the phrase, not the handle, restored it.
    // Step 5: the claim now also carries the PoW the Worker has always
    // required — without it this call could only ever fail POW_REQUIRED
    // (and, signature registration being mandatory now, the signature
    // verifies only where a prekey bundle for the restored identity is
    // still registered; where it has lapsed too, the claim stays
    // best-effort and the reloaded boot's ordinary flow owns the handle).
    if (aliasWanted && !aliasAdopted && API) {
      try {
        D.adoptRestoredSigning(m);
        const powToken = await generatePoW(m.identityPubB64 + ':' + aliasWanted + ':' + Date.now(), CONFIG.POW_DIFFICULTY);
        const resp = await postAPIRaw('/alias/set', { alias: aliasWanted, pub: m.identityPubB64, name, pow: powToken, userId: D.myId(),
          ...(await authFields(ts => `breeze-alias-set:${aliasWanted.toLowerCase().replace(/[^a-z0-9_]/g, '')}:${ts}`)) });
        if (resp.ok) {
          const rec = await dbGet('identity', 'keys');
          if (rec) { rec.alias = aliasWanted; await dbPut('identity', rec, 'keys'); }
        }
      } catch(e) { _dbg(e, 'phrase-alias'); }
    }
    showToast(t('toastRestoredReload'), 'success');
    setTimeout(() => location.reload(), 1.5 * MS.SEC);
  }

  // ===== Simple-mode backup (recovery plan step 4 — the third mode) =====
  //
  // The account-linked simple mode. The backup is the cloud backup's own
  // payload and envelope (format v2: identity + contacts + messages +
  // full key material, PBKDF2/AES-256-GCM under the passphrase), but it
  // is ADDRESSED differently: not by userId — which a cold client does
  // not have and a stranger can derive from a public key — but by a
  // LOCATOR derived from the two things the person remembers, the
  // recovery account name and the recovery passphrase (CRYPTO-SPEC
  // §2c). A fresh install recomputes the locator and fetches cold; a
  // wrong passphrase derives a different locator and finds nothing, so
  // the relay is never an offline-guessing oracle for this mode
  // (plan §1.6 defect 1, §2 item 9). Uploads are signed with the
  // account's signing key and the worker binds the slot to that key:
  // overwriting someone else's recovery net takes their key, not just
  // their locator. Storage exists only on relays whose operator opted
  // in (BACKUP_STORAGE_ENABLED) — the user's own placement, never the
  // creator's default relay, which is also why the setup//backup
  // entries are gated on the relay's health features.
  const SIMPLE_MIN_PASSPHRASE = 8; // the passphrase is this mode's ONLY secret — longer floor than the file/cloud 6

  // The account clue: a public, alias-shaped name the user picks (and
  // must remember — it is half of the fetch capability). Normalised
  // exactly one way everywhere it is used, so the locator derived at
  // enrollment is the locator derived at cold restore.
  function _simpleAccount(v) {
    return (typeof v === 'string' ? v : '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
  }

  // locator = base64( HMAC-SHA256( K, 'breeze-simple-locator' ) ) with
  // K = PBKDF2-HMAC-SHA256(passphrase, 'breeze-simple-locator-v1:' +
  // account, 600k). Domain-separated from the blob's own encryption
  // key (which uses a random per-backup salt): the locator can name
  // the slot and nothing more — it neither decrypts nor is derivable
  // from the ciphertext.
  async function _simpleLocator(account, passphrase) {
    const te = new TextEncoder();
    const km = await crypto.subtle.importKey('raw', te.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: te.encode('breeze-simple-locator-v1:' + account), iterations: CONFIG.PBKDF2_AT_REST_ITERATIONS, hash: 'SHA-256' },
      km, 256);
    const hkey = await crypto.subtle.importKey('raw', bits, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = await crypto.subtle.sign('HMAC', hkey, te.encode('breeze-simple-locator'));
    return btoa(String.fromCharCode(...new Uint8Array(mac)));
  }

  // The payload + envelope, byte-for-byte the cloud backup's (kept as
  // a twin rather than a refactor of createCloudBackup: that function's
  // body is slice-pinned by the data-principle suite, and the two
  // producers must not drift in format — the restore side below reads
  // both).
  async function _simpleEncryptPayload(passphrase) {
    const identity = await dbGet('identity', 'keys');
    const contacts = await dbGetAll('contacts');
    const messages = await dbGetAll('messages');
    const keyMaterial = await _collectBackupKeyMaterial();
    const data = JSON.stringify({ v: CONFIG.PROTOCOL_VERSION, backupV: BACKUP_FORMAT_V, identity, contacts, messages, keyMaterial, exportedAt: Date.now() });
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_BYTES));
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: CONFIG.PBKDF2_AT_REST_ITERATIONS, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: CONFIG.AES_KEY_BITS }, false, ['encrypt']);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(data));
    return JSON.stringify({ s: arr(salt), i: arr(iv), d: arr(new Uint8Array(ct)), v: CONFIG.PROTOCOL_VERSION, iter: CONFIG.PBKDF2_AT_REST_ITERATIONS });
  }

  // Upload one encrypted payload under its locator to every home relay
  // (the createCloudBackup fan-out: one signed body, relay-independent;
  // one success is enough). Returns the locator with the verdict.
  async function _uploadSimpleBackup(account, passphrase) {
    const locator = await _simpleLocator(account, passphrase);
    const backup = await _simpleEncryptPayload(passphrase);
    const signing = await dbGet('identity', 'signing');
    const pub = signing?.pubB64 || '';
    const ts = Date.now();
    const sig = await signMessage(`breeze-backup-simple-upload:${locator}:${ts}`);
    if (!pub || !sig) return { ok: false, locator, relayDisabled: false };
    const body = { locator, backup, pub, ts, sig };
    let firstOk = null; let relayDisabled = false;
    for (const relay of homeRelays()) {
      const resp = await postAPIRelay(relay, '/backup/simple-upload', body);
      if (resp?.ok && !firstOk) firstOk = resp;
      else if (resp && !relayDisabled) { const ej = await resp.json().catch(() => null); if (ej?.code === 'BACKUP_DISABLED') relayDisabled = true; }
    }
    if (!firstOk) return { ok: false, locator, relayDisabled };
    const info = await firstOk.json().catch(() => null);
    return { ok: true, locator, expiresAt: info?.expiresAt || null };
  }

  // Enrollment: the mode is recorded ONLY after the backup actually
  // landed (a refused upload leaves the identity modeless and
  // kit-eligible, with the refusal named — never 'simple' on paper and
  // nothing on the relay).
  async function enrollSimpleRecovery(accountRaw, passphrase) {
    const identity = await dbGet('identity', 'keys');
    if (!identity) { showToast(t('toastNoIdentityBackup'), 'error'); return false; }
    if (identity.recoveryMode === 'none') { showToast(t('toastRecoveryNoneBackup'), 'error'); return false; }
    const account = _simpleAccount(accountRaw);
    if (account.length < 3) { showToast(t('simpleAccountMin'), 'error'); return false; }
    if (!passphrase || passphrase.length < SIMPLE_MIN_PASSPHRASE) { showToast(t('simplePassMin'), 'error'); return false; }
    try {
      const up = await _uploadSimpleBackup(account, passphrase);
      if (!up.ok) { showToast(t(up.relayDisabled ? 'backupRelayDisabled' : 'backupFailed'), 'error'); return false; }
      identity.recoveryMode = 'simple';
      identity.recoveryAccount = account;
      identity.recoveryLocator = up.locator;
      await dbPut('identity', identity, 'keys');
      showToast(up.expiresAt ? t('simpleEnrolledUntil', new Date(up.expiresAt).toLocaleDateString()) : t('simpleEnrolled'), 'success');
      return true;
    } catch(e) { _dbg(e, 'simple-enroll'); showToast(t('backupFailed'), 'error'); return false; }
  }

  // The /backup entry: enroll (any recoverable identity) or update
  // (an identity already in the simple mode). Disposable identities
  // are refused — a backup is a recovery promise, and 'none' is the
  // promise that none exists (the kit guard's doctrine).
  async function simpleBackupAction() {
    const identity = await dbGet('identity', 'keys');
    if (!identity) { showToast(t('toastNoIdentityBackup'), 'error'); return; }
    if (identity.recoveryMode === 'none') { showToast(t('toastRecoveryNoneBackup'), 'error'); return; }
    if (identity.recoveryMode === 'simple') { await updateSimpleBackup(); return; }
    const creds = await _promptSimpleRecoveryNew();
    if (!creds) return;
    await enrollSimpleRecovery(creds.account, creds.passphrase);
  }

  // Update: re-upload under the SAME locator (same account + same
  // passphrase). A different passphrase derives a different locator —
  // that is a passphrase CHANGE (the old backup stays under the old
  // locator until its 90-day TTL), and it is confirmed as one rather
  // than happening by typo.
  async function updateSimpleBackup() {
    const identity = await dbGet('identity', 'keys');
    if (!identity?.recoveryAccount) { showToast(t('simpleNotEnrolled'), 'error'); return; }
    const passphrase = await showPrompt(t('simplePassEnter'), '', { type: 'password', autocomplete: 'current-password' });
    if (!passphrase) return;
    try {
      const locator = await _simpleLocator(identity.recoveryAccount, passphrase);
      if (identity.recoveryLocator && locator !== identity.recoveryLocator) {
        if (!await showConfirm(t('simplePassChangeTitle'), { desc: t('simplePassChangeDesc'), okText: t('simplePassChangeOk'), danger: true })) return;
      }
      const up = await _uploadSimpleBackup(identity.recoveryAccount, passphrase);
      if (!up.ok) { showToast(t(up.relayDisabled ? 'backupRelayDisabled' : 'backupFailed'), 'error'); return; }
      identity.recoveryLocator = up.locator;
      await dbPut('identity', identity, 'keys');
      showToast(up.expiresAt ? t('simpleEnrolledUntil', new Date(up.expiresAt).toLocaleDateString()) : t('simpleEnrolled'), 'success');
    } catch(e) { _dbg(e, 'simple-update'); showToast(t('backupFailed'), 'error'); }
  }

  // Decrypt one simple/cloud envelope and parse its payload — the
  // restoreCloudBackup decryption, shared by both simple restore
  // paths (the iteration floor is the same anti-downgrade guard).
  async function _simpleDecryptPayload(passphrase, backupStr) {
    const b = JSON.parse(backupStr);
    const salt = u8(b.s); const iv = u8(b.i); const ct = u8(b.d);
    const bIter = (typeof b.iter === 'number' && b.iter >= CONFIG.PBKDF2_ITERATIONS && b.iter <= 10000000) ? b.iter : CONFIG.PBKDF2_ITERATIONS;
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: bIter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: CONFIG.AES_KEY_BITS }, false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // The restore writes, shared by the cold and live simple paths —
  // restoreCloudBackup's scope (identity, key material, validated
  // contacts, messages), behind the caller's identity check.
  async function _applySimplePayload(data) {
    if (data.identity) await dbPut('identity', data.identity, 'keys');
    await _restoreBackupKeyMaterial(data.keyMaterial);
    if (data.contacts) for (const c of data.contacts) {
      if (typeof c?.id !== 'string' || !c.id || c.id.length > 64 ||
          typeof c?.pubB64 !== 'string' || !c.pubB64 || c.pubB64.length > 128 ||
          !/^[A-Za-z0-9+/=]+$/.test(c.pubB64)) continue;
      await dbPut('contacts', c);
    }
    if (data.messages) for (const m of data.messages) await dbPut('messages', m);
  }

  // The shared tail of both simple restores: decrypt, check, write,
  // reload. The identity check sits before ANY write (the step-2
  // doctrine): a payload that is not a Breeze account backup — or whose
  // signing record does not match the key that owns the slot — creates
  // nothing. ownerPub may be null (then only the envelope's own GCM
  // authentication gates, exactly as the legacy restore). `mode` is
  // the { account, locator } this restore just proved knowledge of:
  // the enrollment-time payload predates the mode patch on the record
  // (the mode is recorded only once the upload lands), so the restore
  // writes the mode back onto the restored record itself — a device
  // restored BY the simple path is a simple-mode device.
  async function _finishSimpleRestore(passphrase, backupStr, ownerPub, mode) {
    let data;
    try { data = await _simpleDecryptPayload(passphrase, backupStr); }
    catch(e) { _dbg(e, 'simple-restore-decrypt'); showToast(t('backupWrongPass'), 'error'); return; }
    if (!data?.identity?.pubB64) { showToast(t('toastInvalidBackup'), 'error'); return; }
    const slotPub = data.keyMaterial?.signing?.pubB64;
    if (ownerPub && slotPub && ownerPub !== slotPub) { showToast(t('toastInvalidBackup'), 'error'); return; }
    await _applySimplePayload(data);
    if (mode) {
      const rec = await dbGet('identity', 'keys');
      if (rec) {
        rec.recoveryMode = 'simple';
        rec.recoveryAccount = mode.account;
        rec.recoveryLocator = mode.locator;
        await dbPut('identity', rec, 'keys');
      }
    }
    showToast(t('backupRestored'), 'success');
    setTimeout(() => location.reload(), CONFIG.TOAST_DURATION_MS);
  }

  // COLD restore — the setup screen's simple entry, and this step's
  // reason to exist. No identity, no signing key, nothing but the
  // account name + passphrase the person remembers: derive the
  // locator, ask the serving relay (a fresh install knows no other),
  // and land the account whole. Failures create NOTHING.
  async function restoreSimpleBackup() {
    if (await dbGet('identity', 'keys')) { showToast(t('toastRecoveryHasIdentity'), 'error'); return; }
    const creds = await _promptSimpleRecoveryRestore();
    if (!creds) return;
    const account = _simpleAccount(creds.account);
    if (account.length < 3 || !creds.passphrase) { showToast(t('simpleNotFound'), 'error'); return; }
    try {
      const locator = await _simpleLocator(account, creds.passphrase);
      const resp = await postAPIRaw('/backup/simple-download', { locator });
      if (!resp?.ok) {
        const ej = resp ? await resp.json().catch(() => null) : null;
        showToast(t(ej?.code === 'BACKUP_DISABLED' ? 'backupRelayDisabled' : 'simpleNotFound'), 'error');
        return;
      }
      const { backup, pub } = await resp.json();
      await _finishSimpleRestore(creds.passphrase, backup, pub, { account, locator });
    } catch(e) { _dbg(e, 'simple-restore'); showToast(t('backupFailed'), 'error'); }
  }

  // LIVE restore for a simple-mode identity (the /backup restore
  // button routes here): the account name comes from the record, only
  // the passphrase is prompted, and the home relays are asked in turn.
  // A passphrase that does not reproduce the recorded locator is the
  // wrong one — it names a different (empty) slot — and is refused
  // before any fetch.
  async function restoreSimpleBackupLive() {
    const identity = await dbGet('identity', 'keys');
    if (!identity?.recoveryAccount) { showToast(t('simpleNotEnrolled'), 'error'); return; }
    const passphrase = await showPrompt(t('simplePassEnter'), '', { type: 'password', autocomplete: 'current-password' });
    if (!passphrase) return;
    try {
      const locator = await _simpleLocator(identity.recoveryAccount, passphrase);
      if (identity.recoveryLocator && locator !== identity.recoveryLocator) { showToast(t('simpleNotFound'), 'error'); return; }
      let resp = null;
      for (const relay of homeRelays()) {
        resp = await postAPIRelay(relay, '/backup/simple-download', { locator });
        if (resp?.ok) break;
      }
      if (!resp?.ok) {
        const ej = resp ? await resp.json().catch(() => null) : null;
        showToast(t(ej?.code === 'BACKUP_DISABLED' ? 'backupRelayDisabled' : 'simpleNotFound'), 'error');
        return;
      }
      const { backup, pub } = await resp.json();
      await _finishSimpleRestore(passphrase, backup, pub, { account: identity.recoveryAccount, locator });
    } catch(e) { _dbg(e, 'simple-restore-live'); showToast(t('backupFailed'), 'error'); }
  }

  // The /backup restore button's dispatch: a simple-mode identity
  // restores through its own path; every other identity keeps the
  // legacy cloud restore, byte for byte.
  async function restoreBackupSmart() {
    const identity = await dbGet('identity', 'keys').catch(() => null);
    if (identity?.recoveryMode === 'simple') { await restoreSimpleBackupLive(); return; }
    await restoreCloudBackup();
  }

  // Erasure (called by /wipe): the slot is locator-keyed, so account
  // deletion cannot find it from the userId — only this device knows
  // the locator, and the owner signature authorises the delete.
  // Best-effort and silent: the wipe proceeds regardless.
  async function eraseSimpleBackup() {
    try {
      const identity = await dbGet('identity', 'keys');
      if (identity?.recoveryMode !== 'simple' || !identity.recoveryLocator) return;
      const locator = identity.recoveryLocator;
      const ts = Date.now();
      const sig = await signMessage(`breeze-backup-simple-delete:${locator}:${ts}`);
      if (!sig) return;
      for (const relay of homeRelays()) {
        await postAPIRelay(relay, '/backup/simple-delete', { locator, ts, sig }).catch(() => null);
      }
    } catch(e) { _dbg(e, 'simple-erase'); }
  }

  // v3 PRO: ENCRYPTED CLOUD BACKUP
  //
  // Identity + contacts + message history → PBKDF2/AES-256-GCM encrypt
  // → upload to /api/backup on the home relays. A relay stores the
  // ciphertext only, and only when its operator enabled backup storage
  // (BACKUP_STORAGE_ENABLED — the default relay does not); a refusal is
  // surfaced as such, never as a generic failure. Only the user's
  // passphrase can decrypt.
  async function createCloudBackup() {
    // Disposable identities export nothing (the kit guard's doctrine, extended
    // to both backup producers): a backup is a recovery promise by construction.
    const idRec = await dbGet('identity', 'keys');
    if (idRec?.recoveryMode === 'none') { showToast(t('toastRecoveryNoneBackup'), 'error'); return; }
    const passphrase = await showPrompt(t('backupPassPrompt'), '', { type: 'password', autocomplete: 'current-password' });
    if (!passphrase || passphrase.length < 6) { showToast(t('backupPassMin'), 'error'); return; }
    try {
      const identity = await dbGet('identity', 'keys');
      const contacts = await dbGetAll('contacts');
      const messages = await dbGetAll('messages');
      const keyMaterial = await _collectBackupKeyMaterial();
      const data = JSON.stringify({ v: CONFIG.PROTOCOL_VERSION, backupV: BACKUP_FORMAT_V, identity, contacts, messages, keyMaterial, exportedAt: Date.now() });
      // Encrypt with PBKDF2 + AES-256-GCM
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(CONFIG.IV_BYTES));
      const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: CONFIG.PBKDF2_AT_REST_ITERATIONS, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: CONFIG.AES_KEY_BITS }, false, ['encrypt']);
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(data));
      const backup = { s: arr(salt), i: arr(iv), d: arr(new Uint8Array(ct)), v: CONFIG.PROTOCOL_VERSION, iter: CONFIG.PBKDF2_AT_REST_ITERATIONS };
      // Upload. Signs ownership (ts+sig), same convention as group actions — lets an operator enable BACKUP_REQUIRE_AUTH (see wrangler.toml).
      if (API) {
        const upTs = Date.now();
        const upBody = { userId: D.myId(), backup: JSON.stringify(backup), ts: upTs };
        const upSig = await signMessage(`breeze-backup-upload:${D.myId()}:${upTs}`);
        if (upSig) upBody.sig = upSig;
        // Stage-2 step 5: the same signed body lands on every home relay —
        // the backup's whole point is surviving the loss of one relay, and
        // the upload signature is relay-independent. One success is enough
        // (the toast still reports failure when NO relay took it), and the
        // retention date shown is the first success's.
        let firstOk = null; let relayDisabled = false;
        for (const relay of homeRelays()) {
          const resp = await postAPIRelay(relay, '/backup/upload', upBody);
          if (resp?.ok && !firstOk) firstOk = resp;
          else if (resp && !relayDisabled) { const ej = await resp.json().catch(() => null); if (ej?.code === 'BACKUP_DISABLED') relayDisabled = true; }
        }
        if (firstOk) {
          // Surface the retention deadline the relay just told us: a cloud backup is deleted
          // 90 days after its last upload and nothing renews it, so "I have a backup" quietly
          // stops being true. Say the date instead of letting the user find out on the day
          // they actually need it.
          const info = await firstOk.json().catch(() => null);
          showToast(info?.expiresAt
            ? t('backupCreatedUntil', new Date(info.expiresAt).toLocaleDateString())
            : t('backupCreated'), 'success');
        }
        else showToast(t(relayDisabled ? 'backupRelayDisabled' : 'backupFailed'), 'error');
      }
    } catch(e) { _dbg(e, 'backup'); showToast(t('backupFailed') + ': ' + e.message, 'error'); }
  }

  async function restoreCloudBackup() {
    const passphrase = await showPrompt(t('backupPassPrompt'), '', { type: 'password', autocomplete: 'current-password' });
    if (!passphrase) return;
    try {
      const dlTs = Date.now();
      const dlBody = { userId: D.myId(), ts: dlTs };
      const dlSig = await signMessage(`breeze-backup-download:${D.myId()}:${dlTs}`);
      if (dlSig) dlBody.sig = dlSig;
      // Stage-2 step 5: the first home relay that HOLDS a backup serves
      // it — the primary may be gone (that is the scenario this feature
      // exists for) while an added relay still has its copy.
      let resp = null;
      for (const relay of homeRelays()) {
        resp = await postAPIRelay(relay, '/backup/download', dlBody);
        if (resp?.ok) break;
      }
      if (!resp?.ok) { const ej = resp ? await resp.json().catch(() => null) : null; showToast(t(ej?.code === 'BACKUP_DISABLED' ? 'backupRelayDisabled' : 'backupFailed'), 'error'); return; }
      const { backup } = await resp.json();
      const b = JSON.parse(backup);
      const salt = u8(b.s); const iv = u8(b.i); const ct = u8(b.d);
      // Read iteration count from the backup. New backups store 600k; old backups have no
      // field and fall back to 100k. Enforce a floor of PBKDF2_ITERATIONS so a compromised
      // server cannot inject iter:1 and make offline brute-force nearly free.
      const bIter = (typeof b.iter === 'number' && b.iter >= CONFIG.PBKDF2_ITERATIONS && b.iter <= 10000000) ? b.iter : CONFIG.PBKDF2_ITERATIONS;
      const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
      const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: bIter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: CONFIG.AES_KEY_BITS }, false, ['decrypt']);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
      const data = JSON.parse(new TextDecoder().decode(pt));
      // Restore
      if (data.identity) await dbPut('identity', data.identity, 'keys');
      // Format v2 only: the key material (signing/account/prekey privates/gsk/pq).
      await _restoreBackupKeyMaterial(data.keyMaterial);
      if (data.contacts) for (const c of data.contacts) {
        // Validate required fields before storing — a malformed backup entry could corrupt the DB
        if (typeof c?.id !== 'string' || !c.id || c.id.length > 64 ||
            typeof c?.pubB64 !== 'string' || !c.pubB64 || c.pubB64.length > 128 ||
            !/^[A-Za-z0-9+/=]+$/.test(c.pubB64)) continue;
        await dbPut('contacts', c);
      }
      if (data.messages) for (const m of data.messages) await dbPut('messages', m);
      showToast(t('backupRestored'), 'success');
      setTimeout(() => location.reload(), CONFIG.TOAST_DURATION_MS);
    } catch(e) { _dbg(e, 'restore'); showToast(t('backupWrongPass'), 'error'); }
  }
  // ===== Backup & Restore (module end) =====
  return { backupToFile, restoreFromFilePicker, restoreBackup, createRecoveryKit, restoreFromPhrase, createCloudBackup, restoreCloudBackup,
    enrollSimpleRecovery, simpleBackupAction, updateSimpleBackup, restoreSimpleBackup, restoreSimpleBackupLive, restoreBackupSmart, eraseSimpleBackup };
}
