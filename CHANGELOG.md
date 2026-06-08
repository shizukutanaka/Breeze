# Changelog

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

### Test Suite (`tests/`) — additions
- **11 suites, 212 tests** passing (`npm test`).
- New: `ktlog.test.js` (25 tests: hashIK, parseLog, checkRollover, mergeLog);
  `push.test.js` (15 tests: RFC 8291 round-trip decrypt, VAPID JWT signature verify,
  format/header checks, b64url helpers); `pow.test.js` (15 tests: challenge format,
  solve token structure + hash bits, difficulty clamp, verify accept/reject codes).
- Worker extended: Dead Drop (6 tests: create/collision/size-limits/TTL/one-time-read),
  Backup (4 tests: store/overwrite/5MB-limit/404), Signal relay (5 tests: store/poll/
  filter-own/empty-room/50-cap), Presence (7 tests: heartbeat/check/batch/online-counter),
  OGP SSRF guard (11 private/internal URLs → 200+{}, missing URL → 400, KV cache hit),
  TURN credentials (4 tests: missing-userId/400, no-env openrelay, HMAC custom, static).

### Documentation
- `SECURITY.md` architecture table updated to reflect sprint implementations.
- `docs/INTEGRATION.md` extended with §7 (N3 negotiate wiring), §8 (I11 ktlog wiring),
  §9 (C12 push subscription client side).
- `docs/ROADMAP.md` updated: C12 done, I11 module done, N7 pow done, status notes updated.
- `docs/CRYPTO-SPEC.md` §7 worker test categories expanded; §9 N5/N6/N7 marked done.

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
