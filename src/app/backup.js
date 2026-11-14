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
// API, postAPIRaw, arr, u8, encrypt, decrypt, downloadBlob and the recovery
// prompt dialogs) resolve from the global scope, exactly as they did
// inline. Behaviour is unchanged — this is a move, not a rewrite.
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
    if (aliasWanted && !aliasAdopted && API) {
      try {
        D.adoptRestoredSigning(m);
        const resp = await postAPIRaw('/alias/set', { alias: aliasWanted, pub: m.identityPubB64, name, userId: D.myId(),
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
  return { backupToFile, restoreFromFilePicker, restoreBackup, createRecoveryKit, restoreFromPhrase, createCloudBackup, restoreCloudBackup };
}
