# Changelog

## Security Hardening Batch 5 — systematic category audit (branch claude/nice-ride-T6yb0, 2026-06-09)

Exhaustive category-by-category audit of the full product (crypto modules, worker
endpoints, service worker, documentation, test coverage). Findings and fixes:

### Worker (`_worker.js`) — robustness & correctness fixes
- **Message timestamp type guard (replay-window bypass)**: `handleMsgSend` accepted a
  client-supplied `ts` of any type. A non-numeric `ts` (string/object/array/`NaN`/`Infinity`)
  made `Math.abs(now - ts)` evaluate to `NaN`, which is never `> 300000` — silently
  bypassing the ±5 min replay guard AND storing a non-numeric `msg.ts` that breaks the
  numeric poll-cursor comparison in `handleMsgPoll` (message could never be delivered or
  cleaned up). Fixed: reject a non-finite/non-numeric `ts` with 400 `INVALID_TIMESTAMP`
  before the window check; an absent `ts` still defaults to `now`.
- **Group kick TTL regression**: `handleGroupKick` was saving the updated group record
  without an `expirationTtl`, silently removing the 30-day TTL set on create/join and
  making kicked groups permanent in KV (unbounded storage growth). Fixed: added
  `{ expirationTtl: 86400 * 30 }` to the kick kvPut.
- **Push notification title length cap**: The push title (groupName or senderName) used
  the raw uncapped request field. An oversized groupName could bloat the encrypted Web
  Push payload past the RFC 8030 4096-byte per-message limit, causing silent delivery
  failures. Fixed: cap to 50 chars via sanitizeString (matches stored msg.groupName).
- **Defensive JSON.parse on KV data (initial)**: Three `JSON.parse()` calls on KV-fetched
  strings had no try/catch — a corrupt or partially-overwritten KV value would throw and
  return 500 instead of a graceful failure. Fixed: `handlePreKeyFetch` OTP parse,
  `handlePreKeyFetch` ktLog parse, `handleOGP` cache parse.
- **`safeJsonParse` — comprehensive KV hardening**: Systematic audit found ~18 additional
  unguarded `JSON.parse(kvData)` sites across 15+ handlers: `handleSignal` (poll + store),
  `handleMsgSend` inbox, `handleMsgPoll`, `handlePresence` (batch + single mem + single KV),
  `handleAliasSet`, `handleAliasGet`, `handlePortal`, `handleGroupJoin`, `handleGroupInfo`,
  `handleGroupKick`, `handlePushSubscribe`, `sendPushToUser`, `handleAccountSlots`,
  `handlePreKeyFetch` bundle, `handlePreKeyUpload` ktlog, `handleSealedSend`, `handleSealedPoll`,
  `handleDropRead`. All now call `safeJsonParse(raw, fallback)` which returns the fallback
  instead of throwing; each handler returns the correct 404/200-with-empty response on
  corrupt data rather than an unhandled 500.
- **`_presenceCache` in-memory growth cap**: The presence heartbeat handler stored one
  entry per unique userId with no eviction policy; a long-lived isolate serving many
  users could grow the map without bound. Added a prune-to-1000 cap when size exceeds
  2000 (same pattern as `_msgDedup` and `_sealedDedup`).
- **Backup and AI context type guards**: `handleBackupUpload` rejected non-string values
  with a misleading size error instead of a type error (a non-string `backup` bypasses
  the `.length` size check). Now returns 400 `INVALID_FIELD` for non-string inputs.
  `handleAI reply_suggest` similarly now rejects non-string `context` explicitly.
- **handleAI error echo cap**: Unknown `action` values were echoed verbatim in the 400
  error message; capped echoed value to 32 chars to prevent large strings being
  bounced back in error responses.
- **API endpoint count**: Health endpoint reported `endpoints: 28`; actual count is 32
  (30 switch cases + `/api/health` + `/api/webhook`). Fixed in health response, worker
  header comment, CLAUDE.md, SPEC.md §3.2 (table now lists all 32 endpoints including the
  7 previously absent: sealed/ack, drop/create, drop/read, ai, translate, abuse/record,
  abuse/report).

### Documentation (`CLAUDE.md`, `README.md`, `docs/CRYPTO-SPEC.md`, `SPEC.md`)
- All stale line/endpoint/test counts corrected:
  - `CLAUDE.md`: client 12,696→13,116 lines, worker 1,347→1,888, sw 140→145,
    endpoints 28→32, i18n keys 406→420.
  - `README.md`: validate score 32/35→33/36.
  - `CRYPTO-SPEC.md`: 347→364 tests, 32/35→33/36, worker test count 173→182,
    §7 worker tests 98→182.
  - `SPEC.md §3.2`: heading 25→32 endpoints; 7 missing endpoints added to table.
- `validate.sh` SRI gate confirmed correct (sha384 matches lang.js).

### Test Suite (`tests/`)
- **12 suites, 369 tests** passing (`npm test`); `validate.sh` 33/36 (PASSED).
- Worker: group kick TTL regression test (1); corrupt KV data resilience via
  `safeJsonParse` (7); backup type guard (1); AI handler — `reply_suggest` non-string
  context, missing context, capped error echo, `chat` non-string/oversized text (4);
  OTP corruption graceful handling (1); msg-send non-numeric `ts` type guard (1);
  msg-poll non-numeric `lastTs` cursor fallback (1).
  Total: 188 worker tests.
- Franking: empty message commit/verify (zero-length), tampered commitment bytes
  rejected (binding property), `ctEqual` returns false for different-length inputs
  without throwing. Total: 9 franking tests.
- Negotiate: empty caps array → `[]`, non-array caps treated as absent (no crash),
  `advertise([])` → `x3dh:v4 + caps:[]`. Total: 15 negotiate tests.
- Ratchet: non-v3/v4 message throws (not returns null), `MAX_SKIP*2` eviction prunes
  oversized skipped-key map keeping newest `MAX_SKIP` entries. Total: 23 ratchet tests.

---

## Security Hardening Batch 4 — competitive research (branch claude/nice-ride-T6yb0, 2026-06-08)

Surveyed comparable open-source E2E messengers (Signal, Session, SimpleX) and
WebRTC/Cloudflare security guidance to find concrete gaps. Top finding: Breeze's
safety-number (the only out-of-band MITM defense) was materially weaker than
Signal's.

### Crypto Modules (`src/crypto/`)
- **`fingerprint.js` (new) — Signal-grade safety number**: The legacy
  `index.html safetyNumber()` did a *single* SHA-256 over only 12 of 32 bytes,
  showing ~30 digits (~40 bits) — a relay attempting MITM could grind a colliding
  substitute identity key offline. The new module follows Signal's
  NumericFingerprintGenerator: **iterated SHA-512 (5200 rounds)** over
  `version ‖ identityKey ‖ stableId` per party, first 30 bytes → six 5-digit
  chunks, two fingerprints concatenated in sorted order for symmetry. Result:
  60 digits (~112 bits shown) and ~5200× higher per-candidate grinding cost.
  Optional stable-identifier binding ties keys to identities (matches Signal).
  Dependency-injected/pure; accepts base64 or raw `Uint8Array` keys.

- **`fingerprint.js` — scannable (QR) verification path**: Manual 60-digit
  comparison is error-prone (users skip digits) and only checks the truncated
  ~40-bit-per-chunk display. Added `scannable()` (encodes
  `version(1) ‖ myFp(30) ‖ peerFp(30)` as base64 — a QR payload mirroring
  Signal's CombinedFingerprints) and `verifyScannable()` which cross-matches a
  peer's scanned code (`scanned.local == my remote ∧ scanned.remote == my local`)
  in **constant time** over the full 30-byte fingerprints. Detects MITM key
  substitution, malformed/wrong-length codes, and version mismatch; binds stable
  identifiers like the digit path.

### Test Suite (`tests/`)
- **12 suites, 339 tests** passing (`npm test`); `validate.sh` 32/35 (PASSED).
- `tests/fingerprint.test.js` (17): format (60 digits / 12 groups), symmetry
  (swap local/remote), determinism, MITM-substitution visibility, stableId
  binding, iteration-count binding, base64≡bytes equivalence, full 5200-round run;
  scannable: encoding length, cross-party match, MITM reject, malformed +
  version-mismatch reject, stableId binding.
- Added 30s timeouts to 5 PoW-solving alias tests (the full-strength
  fingerprint test added CPU contention that pushed them past the 5s default).

### Documentation
- `docs/CRYPTO-SPEC.md`: new §6b (safety number), test count 322 → 333.

### Follow-up (gated on browser / two-device validation)
- Migrate index.html `safetyNumber()`/`showSafetyNumber()` onto `fingerprint.js`.
  Note: this changes the displayed number, so it needs a versioned rollout (both
  peers must upgrade to see matching numbers) — hence deferred to a browser pass.

## Security Hardening Batch 3 (branch claude/nice-ride-T6yb0, 2026-06-08)

### Worker (`_worker.js`) — security & robustness fixes
- **OGP hash cache key**: Replaced `url.slice(0, 200)` KV key with
  `sha256Short(url)` (reuses existing helper). Two URLs sharing a 200-char
  prefix no longer collide on the same cache entry. Added 2048-char URL
  length cap; inputs beyond this return 400 `URL_TOO_LONG`.
- **Abuse report `opening` size guard**: `handleAbuseReport` now rejects
  `opening` fields longer than 128 chars before crypto processing. An HMAC
  key is 32 bytes (44 base64 chars); the 128-char cap prevents DoS via large
  inputs to `hmacVerifyFrank`.
- **Push subscription sanitization**: `handlePushSubscribe` previously stored
  the full client-supplied subscription object. Now only `endpoint`, `keys`
  (`p256dh` ≤100 chars, `auth` ≤50 chars), and `expirationTime` are stored;
  extra top-level and nested fields are silently stripped.
- **OTP count fix**: `handlePreKeyUpload` stored the raw `oneTimePreKeys.length`
  as the count even though only `Math.min(length, 100)` entries are written.
  If length > 100 the fetch loop started from an over-capped index, wasting up
  to 100 KV reads. Now stores `Math.min(oneTimePreKeys.length, 100)`.
- **Webhook robustness**: `handleWebhook` call site wrapped in try/catch (it
  was the only API path outside the main try/catch at lines 230–270). Also
  added a try/catch around `JSON.parse(body)` inside the handler; invalid JSON
  now returns 400 instead of propagating as an uncaught exception.

### Test Suite (`tests/`) — additions
- **11 suites, 322 tests** passing (`npm test`); `validate.sh` 32/35 (PASSED).
- Worker: OGP URL length cap + hash key test (2), abuse report oversized-opening
  test (1), push subscription field-sanitization test (1); expired PoW test
  timeout raised to 30s. Total: 168 worker tests.
- `CRYPTO-SPEC.md`: test count updated (319 → 322), security additions updated.

---

## Security Hardening Batch 2 (branch claude/nice-ride-T6yb0, 2026-06-08)

### Crypto Modules (`src/crypto/`)
- **`group.js` — N2 two-layer group authentication (partial AFKS)**: Each encrypted group
  message now carries two Ed25519 signatures: `es` (epoch signature, long-lived per-epoch
  key signs iv‖ct‖cm‖ep‖c‖spk‖nsk) and `s` (per-message signature, fresh keypair discarded
  after use). Both signatures must verify before any key derivation — forging requires
  compromising both keys simultaneously. A leaked per-message key cannot forge other messages
  (epoch sig would fail) and vice versa. The epoch signature authenticates `spk` (per-message
  public key), enabling out-of-order delivery without tracking a signing-key-ratchet chain.
  `newSenderKey` / `rotateEpoch` now generate fresh per-message key pairs; `encryptGroupMsg`
  produces and advances the per-message keypair chain; `decryptGroupMsg` verifies both
  signatures with a legacy single-sig fallback for pre-N2 messages.

### Worker (`_worker.js`) — security fixes
- **KV injection guards**: Added `validateUserId()` to `handlePresence` (single-id path and
  batch-check path using filter), `handleAccountPurchase`, `handleWebhook` (checkout.session
  .completed, subscription.deleted, subscription.updated — Stripe metadata is user-controlled;
  invalid IDs silently skipped to prevent Stripe retries).
- **Public key field size caps**: `handlePreKeyUpload` rejects `identityKey` / `signedPreKey`
  > 5000 chars and `edIdentityKey` / `signedPreKeySig` > 500 chars (`FIELD_TOO_LARGE`);
  each OTP entry capped at 5000 chars. `handleAliasSet` rejects `pub` > 2000 chars.
- **AI prompt injection prevention**: `translate_context` action sanitizes `lang` to BCP-47
  charset `[a-zA-Z0-9-]`, max 20 chars, rejecting empty after sanitization (`invalid lang`).
- **AI summarize memory bound**: Per-message `sender` capped at 100 chars and `text` at 500
  chars before joining, bounding peak memory independent of the 4000-char aggregate truncation.
- **PoW freshness check**: `handleAliasSet` now rejects tokens with a timestamp embedded in
  the challenge (makeChallengeString format `${pub}:${ts}`) if older than 10 minutes
  (POW_EXPIRED). Backward-compatible: old-format challenges (no parseable last segment) skip
  the freshness check (`Number.isFinite(NaN)` is false).
- **Group token length cap**: `handleGroupJoin`, `handleGroupInfo`, `handleGroupKick` reject
  tokens > 128 chars (server tokens are 12 chars; oversized inputs would hit KV's 512-byte
  key limit).
- **Translate type guard**: `handleTranslate` rejects non-string `to` field (would throw
  TypeError on `.slice()`) and normalizes `from` type defensively.
- **Exported handlers**: `handleAI`, `handleTranslate` added to named exports for testing.

### Test Suite (`tests/`) — additions
- **11 suites, 319 tests** passing (`npm test`); `validate.sh` 32/35 (PASSED).
- Group: DoS guards — MAX_GAP reject, MAX_SKIP window semantics (keys beyond MAX_SKIP-1
  from target are dropped), MAX_GAP boundary acceptance (3 tests). Total: 22 group tests.
- Worker: prekey field size caps (4), webhook userId KV injection guard (3), AI handler
  input validation (6), translate input validation (4), alias pub size cap (1), PoW
  freshness check — expired-reject + fresh-accept (2). Total: 162 worker tests.
- PoW freshness test: 30s timeout added (probabilistic solve, occasionally slow on cold JIT).

### Documentation
- `docs/CRYPTO-SPEC.md`: test count updated (316 → 319), security additions list extended
  with all batch-2 hardening, worker test coverage description expanded.

---

## Security Sprint — continued (branch claude/nice-ride-T6yb0, 2026-06-08)

### Crypto Modules (`src/crypto/`) — additions
- **`ktlog.js`**: I11 key-transparency client module — `hashIK` (SHA-256 of IK JSON),
  `parseLog` (filter/sort history), `checkRollover` (compare stored vs incoming IK,
  returns 'ok'/'new'/'rolled'/'unknown' with `storedSeenInHistory` + `rolloverTs`),
  `mergeLog` (dedup by hash, keep earliest ts, cap 20). 25 tests.
- **`pow.js`**: N7 PoW challenge/solve/verify — SHA-256 brute-force, difficulty-16
  minimum, `makeChallengeString` (pub-bound, timestamp-embedded), `solve` (clamps
  16–32), `verify` (POW_REQUIRED / POW_TOO_EASY / POW_CHALLENGE_TOO_LONG /
  POW_PUB_MISMATCH / POW_INVALID). Pure, dependency-injected. 15 tests.

### Worker (`_worker.js`) — additions
- **C12 (RFC 8291 encrypted push)**: `encryptPushPayload` (P-256 ECDH + HKDF-SHA256 +
  AES-128-GCM per RFC 8291/8188) + `buildVapidJwt` (ES256 VAPID JWT). `sendPushToUser`
  now encrypts every push notification; push service sees only aes128gcm ciphertext.
  Helpers: `b64urlToBytes`, `bytesToB64url`, `concatBytes`.
- **Dead Drop, Backup, Signal, Presence, TURN, OGP**: exported for testing
  (`handleDropCreate`, `handleDropRead`, `handleBackupUpload`, `handleBackupDownload`,
  `handleSignal`, `handlePresence`, `handleOnlineCount`, `handleOGP`, `handleTurn`).

### Security Fixes — `src/crypto/` modules
- **`ratchet.js` — injected-message chain desync**: `ratchetDecrypt` previously
  advanced `recvChainKey`, `recvCounter`, and `seenMsgIds` BEFORE calling
  `subtle.decrypt`. An on-path attacker injecting a message whose ciphertext fails
  the AES-GCM auth tag would permanently desync the receive chain. Fixed: state
  advance deferred until after successful decrypt. Same fix applied to the
  skipped-key recovery path (key was deleted before decrypt). N1 `recvCounter`
  reset regression test also added.
- **`group.js` — same injected-message desync**: `decryptGroupMsg` had the same
  pattern for both the main path and the skipped-key path. Fixed identically.

### Test Suite (`tests/`) — additions
- **11 suites, 249 tests** passing (`npm test`).
- New: `ktlog.test.js` (25 tests: hashIK, parseLog, checkRollover, mergeLog);
  `push.test.js` (15 tests: RFC 8291 round-trip decrypt, VAPID JWT signature verify,
  format/header checks, b64url helpers); `pow.test.js` (15 tests: challenge format,
  solve token structure + hash bits, difficulty clamp, verify accept/reject codes).
- Ratchet extended: N1 Nr-reset regression, AEAD-auth-failure-does-not-desync,
  MAX_SKIP storage-bound (forward secrecy property of skipped-key store),
  consumed-skipped-key replay guard (key deleted on first use).
- Group extended: AEAD-auth-failure-does-not-desync, future-epoch rejection
  (epoch gate forward direction), consumed-skipped-key replay guard.
- Worker extended: Dead Drop (6), Backup (4), Signal relay (5 + sanitizeString ctrl
  chars), Presence (7), OGP SSRF guard (13 + malformed URL), TURN credentials (4),
  account slots (3), userId validation (length bounds + charset), group
  create/join/info/kick validation (7 + creator self-kick guard + post-kick join
  epoch), msg payload-size limit (1), msg poll lastTs cursor (1), msg MISSING_FIELDS
  (1), prekey 0-OTP replenish hint (1) + caps round-trip (1) + caps sanitization (1),
  push subscribe 5-device cap (1), sealed sender missing-id (1) + multi-sender (1) +
  send validation (1).

### Documentation
- `SECURITY.md` architecture table updated to reflect sprint implementations.
- `docs/INTEGRATION.md` extended with §7 (N3 negotiate wiring), §8 (I11 ktlog wiring),
  §9 (C12 push subscription client side).
- `docs/ROADMAP.md` updated: C12 done, I11 module done, N7 pow done, status notes updated.
- `docs/CRYPTO-SPEC.md` §4/§5 security fix noted; §7 worker categories expanded;
  §9 N5/N6/N7 marked done; test counts updated (ratchet 19, group 13, worker 100).

---

## Security Sprint (branch claude/nice-ride-T6yb0, 2026-06-08)

### Crypto Modules (`src/crypto/`)
- **`ratchet.js`**: Full Double Ratchet reference module — X25519/P-256 DH ratchet,
  AES-256-GCM, HKDF-SHA256; I7 skipped-key TTL expiry (7-day default); I16 key
  commitment (HKDF 'breeze-commit', constant-time verify); I1 authenticated X3DH
  (Ed25519 sign/verify SPK, DH1-4 → HKDF 'breeze-x3dh-v5', initiatorSession/
  responderSession); Nr reset fix (both Ns and Nr reset on DH ratchet step). Multi-
  bucket padding (256-byte-aligned). Browser-compatible (no Node-only APIs).
- **`group.js`**: Group sender-key ratchet — I2 forward secrecy (chain hash-ratchet,
  consumed keys dropped); I3 PCS via `rotateEpoch` (fresh chain+signing key, epoch+1);
  N2 per-message Ed25519 signatures (sign on send, verify before ratchet work);
  I16 key commitment; I7 TTL expiry on group skipped keys.
- **`atrest.js`**: I4 at-rest key wrapping — PBKDF2 ≥600k SHA-256 + AES-256-GCM;
  `wrapJWK`/`unwrapJWK`/`migrate` (legacy plaintext→wrapped, idempotent); `zeroBuffer`
  helper. Fixed browser compat: replaced `Buffer.from` with `btoa`/`atob`.
- **`franking.js`**: I17 message franking — HMAC-SHA256 commitment/opening; `commit`/
  `verify`/`verifyReport`; binding + hiding properties.
- **`negotiate.js`**: N3 version negotiation — `CAPS` constants, `advertise`/
  `parsePeerCaps`/`negotiate`; backward compat with legacy x3dh:'v5' field; 'AND' rule
  prevents peer coercion into weaker path.

### Worker (`_worker.js`)
- **G2 (I1 server half)**: `handlePreKeyUpload` verifies Ed25519 `signedPreKeySig`
  against `edIdentityKey`; PREKEY_SIG_INVALID on failure; unsigned bundles accepted
  during v4→v5 transition.
- **G3 (I3 server signal)**: `handleGroupKick` bumps + returns `epoch`; epoch
  initialized to 0 on create; `handleGroupInfo`/`handleGroupJoin` surface epoch.
  Fixed bug: kick of non-member now returns 404 (NOT_MEMBER) without epoch churn.
- **I17 relay**: `/api/abuse/record` (stores commitment, no-overwrite) + `/api/abuse/report`
  (HMAC verify, FRANK_MISMATCH on binding fail). frankId and message size limits added.
- **I11 precursor**: `ktlog:{userId}` audit log — SHA-256 of each IK appended on upload,
  capped at 10 entries; returned on fetch as `keyHistory`. Clients can detect rollovers.
- **OTP replenish hint**: `replenishOTP: true` in fetch response when remaining OTP ≤ 5.
- **Validation improvements**: frankId length limit (128), abuse report message size
  limit (256 KB), sealed sender handlers exported for testing.

### Test Suite (`tests/`)
- 8 suites, **110 tests** passing (`npm test`), validate.sh 32/35 (PASSED).
- New suites: `kat.test.js` (RFC/NIST KATs), `x3dh.test.js` (X3DH+full session),
  `group.test.js` (FS/PCS/N2), `atrest.test.js` (wrap/unwrap/migrate/zeroBuffer),
  `franking.test.js`, `negotiate.test.js`.
- Worker tests extended: G2 signed-prekey, G3 epoch, I17 franking, I11 key-history,
  sealed sender round-trip/dedup/ack, msg send/poll with timestamp/self-send/dedup.

### Documentation
- `docs/CRYPTO-SPEC.md`: formal spec of `src/crypto/` modules, wire formats, test status.
- `docs/IMPROVEMENTS.md`: I1–I20 from peer software + arXiv/ePrint survey.
- `docs/ROADMAP.md`: prioritized P0–P3 backlog with dependency graph + updated status.
- `docs/INTEGRATION.md`: turnkey browser-side integration runbook (index.html wiring
  for N1/G4/G1+G2/G3/G5/I17), with exact line references and two-device test checklists.
- `docs/CATEGORY-RESEARCH.md` / `docs/CATEGORY-RESEARCH-2.md`: 20 product categories,
  10 arxiv/GitHub references each.

## v3.6.0 (2026-03-15)

### P2P Core (Session 2)
- **DC heartbeat**: ping/pong via state channel every 10s, 3 miss → ICE restart
- **Group P2P direct delivery**: dual-path (P2P instant + sealed reliable) with dedup
- **Key change warning**: 3 decrypt failures → yellow banner + toast + audit log (Signal-style MITM detection)
- **P2P-only mode**: server unreachable → yellow banner, P2P connections still work
- **RTT-based adaptive quality**: heartbeat pong RTT feeds image compression + poll interval
- **Sealed sender retry**: retry queue uses sealed sender first (privacy-preserving)
- **File transfer progress bar**: send/receive with % + speed (MB/s) + green bar

### UX Polish (Session 2)
- **Native `<dialog>` modals**: auto inert background, focus trap, ESC, `::backdrop blur`
- **Trusted Types policy**: `breeze-sanitizer` — DOMParser sanitization, eliminates DOM XSS
- **Swipe-to-reply**: right swipe 60px on messages → reply (WhatsApp/Signal gesture)
- **Swipe-left-to-archive**: contact list left swipe → toggle archive
- **Message multi-select**: context menu "Select" → floating action bar (batch delete/forward)
- **Image auto-compress**: OffscreenCanvas → WebP, adaptive quality, 1920px max
- **Markdown tables**: `| col | col |` + separator → `<table class="md-table">`
- **Theme smooth transition**: `html.theme-transitioning` CSS class, 400ms
- **Emoji frequency sort**: usage count tracking, most-used rises to top
- **OGP favicon + site name**: Google Favicon API + og:site_name in link previews
- **Disappearing message live countdown**: `⏱5m` → `⏱30s` → fade+remove
- **Voice message duration**: loadedmetadata → `1:23` display
- **Contact typing in sidebar**: green "typing..." in preview (5s TTL)
- **Group member count in header**: `[3人]` badge
- **Copy in context menu**: clipboard + toast
- **Scroll to unread on open**: `.unread-sep` scroll target
- **Pinned message banner**: clickable, latest pin at chat top
- **PWA engagement-gated install**: visits≥2 or msgs≥3, 7-day cooldown
- **Proactive storage quota**: 80% warning before IDB fails
- **getAllRecords direction:prev**: Chrome 141+ reverse-read 68% faster
- **CSS scroll anchoring**: overflow-anchor for prepend stability

### Reliability & Edge Cases (Session 2 cont.)
- **Sealed poll crash-safe**: 5-min grace period → client ACK → worker delete
- **`/api/sealed/ack`**: 28th endpoint; crash-safe message processing confirmation
- **Clock drift detection**: serverTime in `/api/health` → ±2min drift warning
- **Worker version mismatch**: client detects server update → "Update available" toast
- **Notification action buttons**: Reply (inline text) + Mark Read from notification
- **Quick-reply from notification**: SW → postMessage → openConversation → sendMessage
- **Browser back button**: `history.pushState` on mobile → popstate → close conversation
- **IDB upgrade multi-tab**: BroadcastChannel `db-upgrade` → other tabs close DB
- **Contact context menu enhanced**: Archive + Mark Read added to right-click menu
- **Signal cleanup on poll**: consumed ICE candidates auto-deleted after 30s
- **OGP fetch timeout**: 5s AbortController (non-blocking)
- **Outbox badge**: counts both relay queue + P2P persistent queue

### Export & Sharing (Session 2 cont.)
- **`/export html`**: human-readable, self-contained HTML chat export (printable)
- **`/contacts export`/`import`**: JSON backup/restore of all contacts
- **Web Share Target**: receive shared text/URL from other apps → paste in conversation
- **QR code camera scan**: BarcodeDetector API (Chrome 83+, Safari 17.2+)
- **Print CSS enhanced**: break-inside:avoid, branding watermark, non-print elements hidden

### Security Hardening (Session 2 cont.)
- **🔴 CRITICAL: Signal encryption complete**: edit/delete/reaction ALL encrypted before relay (previously reaction sent plaintext — server could read emoji reactions)
- **🔴 CRITICAL: Group encrypted signal handler**: `msg.groupId && msg.isSignal` path added — group edit/delete/reaction decrypted and processed correctly
- **CSP `trusted-types`**: both `<meta>` and `_headers` enforce breeze-sanitizer policy
- **`safeSetHTML()`**: wired to cmdOutput (all slash command output sanitized)
- **`downloadBlob()` DRY**: all 7 download sites consolidated, auto revokeObjectURL
- **Dark/light theme-color meta**: responsive to OS preference for browser chrome
- **TURN fallback indicator**: 🟢 Direct / 🟢 STUN / 🟡 TURN + RTT + protocol
- **SR connection announcements**: screen reader notified on P2P state changes
- **Health check: AI/translate feature flags**: client knows available providers
- **Aria-labels**: 24 buttons labeled (folder tabs, dialog, select mode)
- **`.msg.sys` CSS**: centered, dashed-border system messages
- **Worker `fetchWithTimeout()`**: all external API calls (Stripe, AI, translate) protected with 10s timeout
- **Clock offset correction**: `correctedNow()` for all outgoing timestamps — anti-replay compliant
- **Stale DR session pruning**: startup cleanup of orphaned Double Ratchet sessions
- **toggleReaction → sendSignal**: DRY — reactions use unified encrypted signal path

### Reliability (Session 2 cont.)
- **Dead letter queue**: 3x failed messages → IDB persist (max 100) + `/retry` command
- **Retry queue persistence**: IDB primary + localStorage beforeunload fallback
- **Code block click-to-copy**: `pre.md-pre` click → clipboard
- **RTL auto-detection**: `dir="auto"` on all message divs (Arabic/Hebrew support)

### AI & Translation Integration
- `/api/ai` — Multi-provider AI proxy: Anthropic Claude → OpenAI → Groq
  - Actions: `chat`, `summarize`, `reply_suggest`, `translate_context`
  - KV cache: chat=1h, summarize/translate=24h
- `/api/translate` — 4-provider translation: DeepL → Google Cloud → LibreTranslate → MyMemory
- `/ai <question>` slash command — inline AI chat in conversation
- `/summarize` upgraded — AI-powered with local extractive fallback
- Smart replies AI upgrade — local instant → async AI replacement
- Message translate — 2-tier: translation API → AI context-aware fallback
- Smart language detection: JA text → EN, EN text → JA (user lang aware)

### WebRTC & P2P Hardening
- **Perfect Negotiation** (MDN spec): eliminates glare/collision deadlocks
  - `onnegotiationneeded` handler replaces manual offer creation
  - Polite/impolite peer roles with automatic rollback on collision
  - Symmetric code — same logic for both initiator and responder
  - ICE restart triggers `onnegotiationneeded` automatically
- DataChannel `negotiated:true` (id:0) — skip DCEP handshake
- `RTCPeerConnection.generateCertificate()` — fresh ECDSA P-256 per session
- `bufferedAmountLowThreshold` event-based backpressure (polling eliminated)
- `CHUNK_SIZE` 64KB → 16KB (safe cross-browser `sctp.maxMessageSize`)
- `getSafeChunkSize()` — dynamic SCTP detection with 64B margin
- ICE restart on `disconnected` (avoid full teardown), full reconnect only on `failed`
- Relay-only mode: `iceTransportPolicy: 'relay'` + srflx/prflx candidate stripping
- Unified ICE config: `getCallICEConfig()` shared by P2P + calls

### Cryptography & Protocol
- **Real QR code generator** (ISO 18004): replaced placeholder with fully scannable encoder
  - Byte mode, EC level L, versions 1-10 (up to 271 chars)
  - Reed-Solomon GF(256) error correction, proper masking
  - Pure JS, 0 dependencies, ~100 lines
- Message compression: CompressionStream `deflate-raw` before encryption (v4 protocol)
  - Adaptive threshold: 256B default, 128B on 3G, 64B on save-data
  - Backward-compatible: v3 (uncompressed) still decrypted
- Skipped message keys (Signal spec §3.4): store up to 100 skipped keys/session
  - Handles out-of-order message delivery over unreliable transport
  - Auto-prune oldest keys when buffer exceeds 200
- New padding format: `[flags:1][length:2][data...]` (v4) vs `[len:1][data]` (v3)
- Protocol version: v4 (compress+pad) with v3 and v2 backward compatibility

### Critical Bug Fixes
- **t() TDZ self-reference ×13**: `voiceMsg: t('voiceMsg')` in `const _I` triggered Temporal Dead Zone — all 13 keys silently returned key names instead of values
- **`const t` shadow in P2P edit handler**: Variable shadowed global `t()` i18n function — all subsequent `t()` calls in that scope were broken
- **showMsgMenu classList logic error**: `btn.classList.remove(...); btn.classList.add('color-r')` separated by semicolon — applied `color-r` to ALL items instead of danger items only
- **CONFIG `REPLAY_CACHE_SIZE` duplicate**: Two definitions (2000 and 200) — second silently overwrote first
- **`uiNoResults` infinite recursion**: `uiNoResults: (q) => t('uiNoResults', q)` — would stack overflow at runtime

### i18n Completeness
- 60+ hardcoded English strings → `t()` calls
- showCallUI: calling/incoming/mute/unmute/camOff/camOn
- Contact menu: Rename/Safety Number/Pin/Mute/Block/Label/Delete
- /help: 9 section headings
- /billing: all dashboard strings
- /info: all field labels + status values
- /settings: Privacy/Sound section headers + relay-only toggle
- Message: (edited), ↗ Forwarded, React, Bookmark, Translate
- EN/JA: 329/329 perfect parity (was 228)

### Settings & Privacy
- Relay-only mode toggle in `/settings` (localStorage persistent)
- ICE candidate filter: host + srflx + prflx stripped in relay-only
- `/security` shows: relay-only status, RTC cert, DataChannel config, AI/translate status

### Worker
- `/api/ai` endpoint (10 req/min rate limit)
- `/api/translate` Google Cloud Translation provider added
- `X-Breeze-Version` header synced to 3.6.0
- New env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `GOOGLE_TRANSLATE_KEY`
- Optional model override: `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GROQ_MODEL`, `OPENAI_BASE_URL`

## v3.5.0 (2026-03-13)

### Critical Fixes (R108-R115)
- 3× setInterval closure bug: `}, N);` → `}, N));` — half of initMessenger was unparseable
- Worker orphaned code: 51-line handleCheckout body in global scope → runtime crash
- Message ID collision: `myId + ':' + ts` → `genMsgId()` with sequence counter
- Desktop: WEB_ROOT = `__dirname` → `process.resourcesPath` (white screen in packaged app)
- Desktop/mobile: lang.js missing from builds (924 languages lost)
- showConfirm 3-arg call for /wipe (opts ignored → no danger styling)

### Security
- Rate limits: 23/23 endpoints (was 12/23)
- Worker: POST method enforcement (405 for non-POST API)
- Worker: Input sanitization on 5 handlers (names in KV)
- OGP fetch: 5s AbortController timeout + SSRF private IP blocking
- File type blocking: 24 dangerous extensions (.exe, .bat, .ps1, etc.)
- CORS: `'*'` fallback → `'null'` (no wildcard API access)
- Stripe webhook: event.id dedup (24h TTL) + constant-time signature
- Replay cache: 2,000-entry LRU for message dedup
- CSP, HSTS preload, Permissions-Policy headers
- PBKDF2 600K iterations lock screen

### Data Integrity
- Outbox persistence: localStorage save/restore (survives reload)
- encryptGroupMsg failure: toast + abort (was silent undefined)
- /wipe: full local + remote wipe with danger confirm dialog
- IDB QuotaExceededError: auto-cleanup old messages
- IDB connection loss: auto-reload recovery

### Performance
- DOM cache: `_DOM.get()` memoizes getElementById (131 calls)
- rAF-based render coalescing
- Adaptive networking: 2g/3g/4g poll/compress adjustment
- Deferred startup via requestIdleCallback

### UI/UX
- Landing page: 3 feature tiles (E2E, No registration, Cross-platform)
- Pricing: CSS Grid responsive 4-card layout with i18n (EN+JA)
- /help: all 50+ commands in 6 categories (was 15)
- /about: plan name + CONFIG.VERSION
- theme-color meta: dynamic on toggle + init + OS change
- `<noscript>` fallback for JS-disabled browsers
- twitter:card → summary_large_image
- Modal focus trap (Tab key containment)
- Keyboard shortcut overlay (? key)

### i18n
- 228/228 EN/JA parity (was 215)
- Pricing cards, wipe dialog, confirm dialogs, search placeholders

### Build System
- mobile/: Rebuilt from scratch — Capacitor 6.2, prepare.js with SHA256 hashes
- desktop/: lang.js in extraResources, resourcesPath fix, version 3.5.0
- deploy.sh: Rewritten for Lite/Plus/Pro pricing (was Monthly/Annual)
- build.sh: 9 commands, unified WEB_FILES array
- release.yml: lang.js in all builds, softprops/action-gh-release@v2
- dist/*: All version 3.5.0, owner shizukutanaka

### Developer Experience
- AGENTS.md (207L): AI agent rules for all tools
- CLAUDE.md (34L): Concise rules for Claude Code
- .claude/settings.json: PostToolUse hooks + permissions
- .claude/commands/: 4 custom slash commands
- validate.sh: 35 quality gates (100% pass)

## v3.0.0 – v3.4.0 (2026-02 – 2026-03)
- E2E encryption: X25519 + AES-256-GCM + Double Ratchet
- Sealed sender, sender key O(1) for groups
- WebRTC DataChannel P2P + server relay fallback
- Voice/video calls, file transfer (64KB chunks)
- Multi-account (up to 999 with Pro plan)
- 924 languages (lang.js)
- PWA + Electron + Capacitor (6 platforms)
- 36 slash commands
- Stripe billing (3 tiers)

## v1.0.0 – v2.0.0 (2026-01 – 2026-02)
- Initial P2P messenger with ECDH P-256
- Single HTML + Cloudflare Worker architecture
- Basic chat, contacts, groups
