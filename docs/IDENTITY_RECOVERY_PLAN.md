# Identity, addressing, and recovery — plan (2026-11-14)

Context: stages 1–2 (docs/MAILBOX_STAGE1_PLAN.md,
docs/RELAY_STAGE2_PLAN.md) rebuilt delivery and relay placement,
stage 3 (docs/PQ_STAGE3_PLAN.md) is adding post-quantum key
agreement, and docs/SHARE_PLAN.md stages 4+ attack migration
friction. None of them asks what an identity *is* in Breeze, what
serves as an "address", or what happens when a person loses every
device. On 2026-11-14 the owner asked exactly that: how are
individuals distinguished, how are addresses managed, what is the
backup/recovery story — and whether an address is needed at all.

This plan audits the current answers in code, then re-examines each
component with the owner's working method — (1) who placed this
requirement and why (is it imported custom from other messengers?),
(2) if we deleted it, who concretely suffers, in which situation?,
(3) if it stays, what is its smallest form? — and designs recovery
with **total device loss as the base case**. Like the earlier
plans, every step ships independently and records its outcome here.

## 1. Verified starting point (audit at main `8361bbfa`)

Derived by reading `index.html`, `_worker.js`,
`src/crypto/atrest.js`, `SECURITY.md` and `docs/SHARE_PLAN.md`.
Line numbers drift; the shapes are the load-bearing part.

### 1.1 Identity — a key pair, nothing else

- `createIdentity()` generates the identity key with WebCrypto
  `generateKey` (X25519, P-256 fallback) — **random, not derived**.
  The private half is stored as a JWK in the IndexedDB `identity`
  store, record `keys`: `{pub, priv, pubB64, name, alias}`.
- A second, independent key pair — Ed25519, from `initSigning()` —
  lives in record `signing` and does the *authenticating*: message
  signatures, the SPK signature in the prekey bundle, alias /
  device-registry / backup auth signatures, and (stage 3) the PQ
  prekey signature.
- There is **no seed and no recovery phrase anywhere** (codebase-wide
  search for mnemonic / seed phrase / BIP39: zero hits). Nothing
  about the identity can be regenerated; it exists only as stored
  key material.
- `userId` = first 12 chars of the base64 public key. A human
  short ID `breeze-xxxx-xxxx` is derived from SHA-256(pubB64).
  Both are *derived from* the key — the key is the identity;
  everything else is a view of it.
- Optional at-rest wrapping encrypts both key records under a
  user passphrase (slot-bound AAD, `src/crypto/atrest.js`,
  `/keywrap`). This protects a *live* install; it is not recovery.
- Further key material sits in sibling records of the same store:
  `spk-priv` (signed-prekey private), `otp-priv` (one-time prekey
  privates), `sess:<peerId>` (ratchet sessions), `gsk:` (group
  sender keys), `account` (`{root, rootEd, isPrimary}` — the
  multi-device binding), `inst` (per-install instance id,
  deliberately excluded from backups for clone detection).

### 1.2 What serves as an "address"

| Form | Where it lives | Who hands it out |
|---|---|---|
| Raw public key (44-char base64) | the identity itself | nobody — self-generated |
| `userId` (12 chars) | derived; relay records keyed by it | nobody |
| Short ID `breeze-xxxx-xxxx` | derived, display only | nobody |
| `@alias` (3–20 chars) | **relay KV** `alias:{name}` → `{pub, name, setAt}` | first-come, on the relay |
| Invite link `?add=<pub>&name=` / QR | carried by the user | the user |
| Contact record | **device-local only** (IDB `contacts`) | the user |

There is **no server-side address book**. The relay holds an alias
table, a device registry, prekey bundles, presence and group
rosters — routing and verification state, not contacts. That line
exists today by accident of implementation; §2 makes it a rule.

### 1.3 Discovery — `@alias`, and its shape

- Registration (`handleAliasSet`): a proof-of-work (difficulty ≥ 20,
  challenge bound to the pubkey) is required and really verified.
  An Ed25519 ownership signature is verified **when present** and
  mandatory only when the operator sets `ALIAS_REQUIRE_AUTH`.
- Storage: `kvPut(alias:{clean}, …)` with **no TTL — aliases are
  permanent**. Deletion requires a signature from the account's
  signing key. Renaming releases the old handle (client best-effort).
- Resolution (`handleAliasGet`) is unauthenticated, single or batch
  (≤ 50), and returns `{pub, name}`. It is an existence-and-key
  oracle — by design, since a handle is meant to be shared — and
  the client defends the *binding*, not the lookup: alias-resolved
  adds are audited against the key-transparency log (hash-chained
  per-account key history appended by the worker on prekey upload;
  `src/crypto/ktlog.js`). A tampered chain refuses the add; a
  rolled key warns. Raw-key and QR adds skip this because there the
  key *is* the identity.
- Consequences of permanence: if the signing key is lost, the
  handle can never be released or re-pointed. It keeps resolving to
  a dead key forever, and nobody — including the owner — can
  reclaim it.

### 1.4 Contacts — device-local, TOFU-pinned

- Contacts live only in the device's IDB `contacts` store: id,
  pubB64, display name, alias, the TOFU-pinned signing key
  (`sigPub`), notes/labels/pin/mute/block/archive, and for groups
  the member list. Nothing about a user's social graph is uploaded
  as a contact list.
- `/contacts export` downloads the list as **plaintext JSON**
  (names + public keys + metadata, unencrypted). It is the one
  place the social graph leaves the device unprotected.

### 1.5 Devices — a root-signed registry, copy-paste linking

- The account is a device registry on the relay
  (KV `devices:{accountId}`, 1–10 devices), signed by the root
  device's Ed25519 key (`breeze-device-set:<id>:<ts>:<digest>`).
  Any client can read it, but senders verify the signature against
  the root key pinned at link time and fail closed to
  single-device delivery if it does not verify (SECURITY.md).
- Linking is manual key transport: `/link` shows this device's
  public key to copy; on the primary, `/link <pub>` adds it;
  on the secondary, `/linkto <root pub>` binds and pins the
  root's signing key. `/unlink` is primary-only; group sending
  is primary-only.
- Linked devices self-sync messages sent *after* linking. There
  is **no history sync** (SECURITY.md says so, "like Signal").
- **Root loss = device-management loss** (SECURITY.md): only the
  root signing key can change the registry. Surviving devices
  keep messaging; no device can ever be added or removed again.

### 1.6 Backup and restore — what actually exists

Two mechanisms exist. Neither covers the scenario it is for.

**File backup** (`backupToFile` → `restoreBackup`):
`{identity: <the 'keys' record only>, contacts}`, encrypted with
the user's passphrase (PBKDF2 + AES-256-GCM; the cloud path uses
600k iterations), downloaded as a `.json`. Restore is reachable
only *inside* the app — the `/backup` panel buttons and drag-drop
onto the sidebar. **The first-run setup screen (`#msg-setup`)
offers name + alias + Create and no restore entry at all.**

**Cloud backup** (`createCloudBackup` → `restoreCloudBackup`):
`{v, identity: <'keys' record>, contacts, messages}` encrypted the
same way, uploaded to *every* home relay; the worker stores it in
KV as `backup:{userId}` (the code comments still say "R2" — the
store is KV), max 5 MB, **TTL 90 days from last upload**, with the
expiry date surfaced to the user on upload. Upload/download are
signed with the signing key, verified when present;
`BACKUP_REQUIRE_AUTH` can make signatures mandatory.

The structural defects, in order of severity:

1. **Cloud restore cannot run cold.** `restoreCloudBackup()` builds
   its request from `myId` and `signMessage()` — it needs the live
   identity and signing key, i.e. the very things whose loss is
   the recovery scenario. On a fresh install there is nothing to
   sign with and no `myId` to ask for. Meanwhile, with
   `BACKUP_REQUIRE_AUTH` off (the default), the worker serves the
   blob to *anyone who presents the userId* — and the userId is
   derivable from the public key, which `alias/get` hands out.
   The owner cannot fetch their backup when it matters; a stranger
   can fetch it any time and brute-force the passphrase offline
   (600k PBKDF2 slows this; the 6-character minimum passphrase is
   the weak end of that trade).
2. **Both backups omit the signing key** — and the `account`,
   `gsk:`, `spk-priv`, `otp-priv` records. A "successful" restore
   brings back the DH identity (same public key, same userId,
   alias still resolves) but `initSigning()` then mints a **new**
   Ed25519 key. Everything the old signing key anchored silently
   breaks: the bundle's `edIdentityKey` changes under contacts
   who TOFU-pinned the old one; device-registry updates are signed
   by a key no verifier accepts, so the root-loss of §1.5 is
   **not** healed — even though SECURITY.md's advice for exactly
   that loss is "keep a backup of the primary (`/backup`)".
   The documented recovery path does not do what the document
   promises.
3. **Sessions are absent** (correctly — see §2 item 10), so every
   1:1 ratchet re-bootstraps from fresh prekeys after a restore.
   That works, but messages that were sealed to the lost device's
   SPK/one-time prekeys in the meantime are undecryptable
   (`otp-priv` is gone). The loss window is the offline period.
4. **Group sender keys are absent.** Membership survives (contact
   records + the relay-side group roster), and sending/receiving
   resume as sender keys re-distribute, but group state restarts
   and group history exists only if the cloud backup's `messages`
   came back.
5. **The file backup has no messages at all**, and its passphrase
   minimum is 4 characters (the cloud path requires 6).

### 1.7 Total device loss — the full matrix

| Asset | No backup | File backup | Cloud backup (if reachable) |
|---|---|---|---|
| Identity (DH key / address) | **gone forever** | restored | restored |
| Signing key (root authority) | gone | **gone (not included)** | **gone (not included)** |
| `@alias` | points at dead key, **permanently** | resolves again; re-auth uses a *new* signing key | same |
| Contacts | gone | restored | restored |
| Message history | gone | **gone** | restored |
| Sessions / in-flight mail | gone | re-handshake; offline window lost | same |
| Group membership | gone (roster lingers relay-side) | restored; sender keys restart | same |
| Device management | gone | **still gone** (see §1.6-2) | still gone |

With no backup the person returns as a stranger: new key, new
address, re-added out-of-band one contact at a time — and their
old handle stays burned. The operator cannot help. That is the
honest consequence of the (correct) no-server-account design;
today it is nowhere said out loud at signup.

## 2. The re-examination — keep / delete / shrink

Each component, the three questions, and the verdict.

1. **Phone number / email / server account — absent; keep it
   absent.** Who wanted it? Teleco-era custom: Signal rents an
   identifier from the phone network, LINE/WhatsApp inherit it.
   It buys server-anchored recovery at the price of a permanent,
   correlatable, SIM-swappable identifier. Breeze's identity is
   already complete without it. The recovery anchor it provides
   must be replaced (§3), not the identifier restored.
2. **The public key as address — keep; delete "address" as a
   user-facing concept.** The key is the identity; it cannot be
   deleted. But no user should ever have to *handle* it as a
   string. The product already has the humane forms (name, @alias,
   QR, invite link, short ID); the remaining raw-key handling —
   `/link` copy-paste, raw-pub contact adds — is scheduled for
   removal via SHARE_PLAN stage 4 steps 2/4. Answer to the
   owner's question: an address is needed exactly once, inside
   the cryptography; a person should never have to type one.
3. **`userId` (12 chars) — keep as an internal identifier only.**
   It keys relay records; it is not a handle and should not
   become one (it is short enough to enumerate for presence
   probes — SECURITY.md already notes presence answers anyone
   holding an id).
4. **`@alias` — shrink.** Who wanted it? Users need a memorable
   way to be found (the LINE ID habit). Delete it and discovery
   falls back to links/QR/short ID — workable in person,
   painful remotely (SHARE_PLAN group B names exact-match @ as
   the remaining friction even *with* aliases). So it stays, at
   its smallest:
   - signature-mandatory registration (`ALIAS_REQUIRE_AUTH` on
     by default), not verified-when-present;
   - a TTL, renewed by the account's normal activity (prekey
     upload / presence), so dead handles recycle instead of
     burning (§1.3);
   - exact-match only, forever — no prefix search (enumeration
     defence, agreeing with SHARE_PLAN group B).

> **Restoration note (2026-11-14).** The original draft of this
> plan ended mid-sentence at the bullet above: the file as
> merged in PR #413 carried a literal truncation marker, and
> the rest of §2, the §3 design and the step list were never
> committed. The original working clone was checked for a
> surviving draft (working tree clean, no stash, no uncommitted
> diff, no dangling git objects) — none exists. Everything from
> this note through the end of §4 is therefore a
> **reconstruction** from the decisions recorded when the plan
> was commissioned, not the original wording. §5
> (implementation outcomes) is original.

5. **A relay-side address book — never build one.** §1.2 notes
   the absence exists today by accident of implementation; this
   makes it a rule. The relay holds routing and verification
   state (alias table, device registry, prekey bundles,
   presence, group rosters) and nothing that resembles a social
   graph. A user's contacts exist on their devices only; no
   feature may upload them as an address book, however
   convenient sync would be. Any proposal that needs one must
   argue against this invariant first.
6. **Contacts — keep device-local; retire the plaintext
   export.** The list itself stays (§1.4). What goes is
   `/contacts export` as plaintext JSON — the one place the
   social graph leaves the device unprotected. The export folds
   into the encrypted backup format (step 6), so a contacts
   file at rest is exactly as protected as a backup.
7. **Device linking — keep the root-signed registry; delete
   the copy-paste key transport.** The registry's shape is
   right (§1.5): authority is a key, changes are signed,
   verifiers fail closed. The transport is the defect — humans
   pasting raw keys is the "address" anti-pattern of item 2 in
   its worst form. `/link` / `/linkto` copy-paste is replaced
   by QR exchange (SHARE_PLAN stage 4 is the canonical
   schedule); the registry and its signatures do not change.
8. **Backups — the scope is the identity, all of it.** A backup
   that omits the signing key is not a backup of the account;
   it is a backup of the address (§1.6 defect 2). Both
   producers carry the full key material — signing key,
   `account`, `spk-priv`, `otp-priv`, group sender keys, the
   stage-3 PQ seed — inside the existing encrypted envelope
   (step 1, done). The file backup's 4-character passphrase
   minimum (§1.6 defect 5) belongs to this item's honesty: the
   minimum is the security of the kit, and is raised with the
   seed work (step 3), not silently.
9. **Cloud backup — cold restore must be possible, and the
   blob must not be a stranger's oracle.** §1.6 defect 1 is two
   defects wearing one coat: restore requires the lost keys
   (so the owner is locked out), while fetch requires nothing
   (so anyone holding a derivable userId gets an offline
   passphrase-guessing oracle). The fix pairs them: fetch is
   authenticated by the recovery anchor of §3 — knowledge of
   the seed/passphrase, not possession of the lost keys — and
   `BACKUP_REQUIRE_AUTH` stops being an operator option that
   defaults to open (step 4).
10. **Sessions — keep them out of backups, deliberately.** A
    restored ratchet forks: two live branches of the same
    chain are worse than a fresh handshake, for correctness and
    for forward secrecy. Sessions re-bootstrap from restored
    prekey material; with `spk-priv` / `otp-priv` in the kit
    (item 8) the offline window of §1.6 defect 3 closes for
    mail sealed to current prekeys. `inst` stays out for the
    reason it was excluded before: it is clone detection, and
    a restore must look like a migration, not a copy.

## 3. The design — the recovery anchor

The base case is §1.7's worst column: every device gone,
nothing left but what the person can carry in their head or
keep on paper. Recovery must work from that column, not from a
surviving device (a surviving device is the easy case —
re-link and transfer, §3.3).

### 3.1 The anchor: a seed, not an account

What replaces the phone number's recovery role is a **32-byte
account seed**, shown to the user once as a recovery phrase,
plus the passphrase they already use for at-rest wrapping. The
seed is the only secret that lives outside the key store; it
is never sent to a relay, and possession of it is never proved
to anyone — it *derives* or *unlocks* keys locally, and the
keys do the proving.

- **New identities** are derived deterministically from the
  seed: both key pairs (X25519 identity, Ed25519 signing) are
  regenerated byte-for-byte from the phrase, so a fresh
  install plus the phrase *is* the account — same key, same
  address, same root authority, nothing to restore from
  anyone.
- **Existing identities** cannot be re-derived (their keys are
  random, §1.1), so the seed takes the other form: a
  **recovery kit** — the full key material of item 8, wrapped
  under a key derived from seed + passphrase. The phrase the
  user keeps unlocks the kit; the kit is the backup of §2
  item 8 with its passphrase replaced by the anchor. One
  artefact to keep, one secret to remember, for both
  generations of account.

### 3.2 What the anchor does not touch

- **Sessions are not recoverable, by design** (§2 item 10).
  Recovery restores identity, contacts, keys and history —
  conversations re-handshake.
- **The relay learns nothing new.** No seed-derived value is
  an identifier: userId, alias and registry stay keyed by the
  public key exactly as today. The anchor exists only on the
  client; a relay compromise yields no recovery material.
- **Addressing does not come back.** Recovery restores the
  key; it does not reintroduce anything a user must type
  (§2 item 2). The first-run screen gains a restore entry
  (step 2) that accepts the phrase or a kit/backup file —
  that is the only new surface.

### 3.3 History: two layers, neither sufficient alone

- **Live transfer**: with a surviving device, history moves
  device-to-device over the existing encrypted channel when
  the new device links — the answer to "I got a new phone".
- **Encrypted backup**: with no surviving device, history is
  whatever the last backup held (cloud messages, or the kit's
  file). The layers compose: the backup restores the account
  and the older history; sessions still re-bootstrap (§2
  item 10).

## 4. Steps

Each step ships independently and records its outcome in §5.

1. **Fix the backup scope** — both producers emit the full key
   material inside the existing envelope (§2 item 8). **Done**
   (PR #418; outcome in §5).
2. **First-run recovery entry** — the setup screen
   (`#msg-setup`) offers restore (file / cloud / phrase)
   alongside Create, so recovery is reachable without an
   existing identity (§1.6).
3. **Seed and deterministic derivation** — new identities
   derive from the account seed and show the recovery phrase
   once; existing identities get the recovery-kit wrap (§3.1).
   The file backup's passphrase minimum is raised as part of
   this step (§2 item 8).
4. **Cloud cold recovery + auth defaults** — cloud
   fetch/restore runs from the anchor on a fresh install (no
   live identity required), and backup fetch authentication is
   mandatory by default (§2 item 9).
5. **Alias minimization** — signature-mandatory registration
   by default, TTL with activity renewal, re-claim after
   expiry (§2 item 4).
6. **Contacts export encryption** — `/contacts export` folds
   into the encrypted backup format; the plaintext JSON export
   is removed (§2 item 6).

## 5. Implementation outcomes

> Note (2026-11-14, step-1 implementer): the plan text above as committed
> ends mid-sentence in §2 item 4 — the merged file carries a literal
> truncation marker, and the §3 design / step list were never committed.
> The steps below are implemented from the tasking record, which
> summarises the full design; outcomes are recorded here as they land.
> (Update: the missing text has since been reconstructed from that
> same record — see the restoration note in §2. The truncation
> described here is the pre-restoration state.)

### Step 1 — Fix the backup scope (DONE)

Both backup producers (file `backupToFile`, cloud `createCloudBackup`)
now emit format v2: the payload gains `backupV: 2` and a `keyMaterial`
block holding the records §1.6 defect 2 found missing — `signing`
(the Ed25519 root key), `account`, `spk-priv`, `otp-priv`, `pq-priv`
(the stage-3 PQ seed record), and every `gsk:` group sender key.
Both restore paths validate each entry's shape and write the records
back into the identity store (`_collectBackupKeyMaterial` /
`_restoreBackupKeyMaterial` in index.html). The encryption envelope
is unchanged (file: existing PBKDF2 + AES-256-GCM `encrypt()`; cloud:
its existing 600k-iteration variant); only the plaintext scope grew.

Decisions worth recording:

- **Records travel as stored**, including /keywrap-wrapped forms for
  the slots keywrap covers (keys/signing/pq-priv). The wrapped form
  is self-contained — KDF parameters and the slot-bound AAD travel
  with it, and the AAD binds the slot name, not the device — so it
  unwraps on the new install with the at-rest passphrase exactly as
  on the old one. The backup's own passphrase remains the outer layer.
- **Sessions (`sess:`) stay out** (§2: a restored ratchet forks).
  Every 1:1 session re-bootstraps from the restored prekey material;
  with `spk-priv`/`otp-priv` restored, the offline window of §1.6
  defect 3 closes for messages sealed to the *current* prekeys.
  **`inst` stays out** — it is clone detection, and SECURITY.md's
  "restore is migration" warning depends on it differing.
- **Backward compatibility**: v1 backups (no `keyMaterial`) restore
  exactly the pre-step-1 scope — identity, contacts, and (cloud)
  messages — without error. Honest limit: a v1 restore still does
  NOT bring back the signing key, account binding, prekey privates,
  group sender keys or the PQ seed; `initSigning()` mints a new
  signing key, so device management and TOFU-pinned signatures are
  not healed by old backups. Only backups written after this step
  are complete recovery kits.
- **Tamper rejection** is the envelope's AES-GCM authentication,
  unchanged: a flipped ciphertext byte or a wrong passphrase yields
  no plaintext and no writes (pinned by test).

Evidence: `tests/backup-keymaterial.test.js` (9 tests) runs the real
index.html helpers — the collect/restore pair, the file backup's own
`encrypt`/`decrypt`, and the real `dbGet`/`dbPut` — through the full
drill: populate → collect → encrypt → wipe → restore, then verifies
the restored signing key signs/verifies (device-management
authority), the restored PQ seed re-derives the same ML-KEM keypair
and decapsulates a fresh ciphertext, sessions/inst never appear in
the payload, v1 payloads restore the old scope, malformed entries
are skipped while valid siblings land, and wrapped forms round-trip
byte-identical.

Not in this step (unchanged, by design): the file backup's
4-character passphrase minimum vs the cloud path's 6 (§1.6 defect
5), the missing first-run restore entry (step 2), and the cloud
cold-restore impossibility (§1.6 defect 1 — step 4; restore still
requires the live identity to fetch the blob).
