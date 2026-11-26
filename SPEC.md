# Breeze Messenger — Detailed Specification

**Document version**: 2026-03-14 R210; header, §4.2 and §7 re-verified 2026-11-21 (R09); total codebase figure re-measured 2026-11-22 (S06); header figures, §1.2, §2.1, §3, §4.3–§4.5, §5, §9, §10.5, §11 and §12 re-measured against the current code 2026-11-25; §4.5 and the header / §1.2 / §3.1 / §4.3 / §9 / §10 / §11 figures updated again the same day for the first-run, automatic-backup and contact-name changes (PR #531–#533), and the header / §1.2 / §4.1 / §4.5 / §10 / §11 figures and §4.5 text updated again the same day for the bottom-tab expansion and the on-device call history (PR #534, #536)
**Status**: Living reference. Originally written for v3.6.0; the sections named above were re-measured against the current codebase (CONFIG VERSION 3.8.0, main as of 2026-11-25). Other sections describe the design as of v3.6.0 and may lag the code — where this document and the code disagree, the code and its tests win.
**Total codebase**: 15,999 (index.html) + 13,519 (src/ modules) + 5,213 (_worker.js) + 245 (SW) = 34,976 lines (plus the Node self-host under `server/`: 1,037 lines, not part of the historical formula)

---

## 1. Product Overview

Breeze is a serverless, end-to-end encrypted P2P messenger deployed on Cloudflare Pages (an `index.html` entry plus ES modules under `src/`; it was a single HTML file up to v3.6.0). Messages travel directly between devices via WebRTC; the server only relays connection signals. No phone number, email, or app store required.

### 1.1 Design Philosophy

| Principle | Source | Application |
|-----------|--------|-------------|
| Performance-first, data-oriented | John Carmack | _DOM cache, _H constant, MS.* time constants, CONFIG centralization |
| Clean architecture, SOLID | Robert C. Martin | Single-responsibility functions, DRY helpers (postAPIRaw, _signal, _autoHeight) |
| Simplicity, composition | Rob Pike | Single-file client plus ES modules, no build step, no framework, no external AI dependency |

### 1.2 File Inventory (601 tracked files)

| File | Size | Purpose |
|------|------|---------|
| index.html | 915 KB | Client: UI + CSS + JS (single file) |
| _worker.js | 305 KB | Cloudflare Worker: API + signals |
| server/* | — | Node self-host relay (same handler, SQLite state) |
| sw.js | 12 KB | Service Worker: offline cache + push |
| manifest.json | 2 KB | PWA manifest |
| locales/* | — | 50 UI locale files (see §11) |
| icon-192.png / icon-512.png | — | PWA icons |
| 404.html | — | Custom 404 page |
| _headers | — | Cloudflare Pages HTTP headers |
| _redirects | — | Cloudflare Pages redirects |
| robots.txt / sitemap.xml | — | SEO |
| .well-known/assetlinks.json | — | Android TWA verification |
| build.sh | — | Multi-platform build script |
| validate.sh | — | 7-gate quality validator |
| deploy.sh | — | Deployment helper |
| wrangler.toml | — | Cloudflare configuration |
| README.md / CHANGELOG.md / LICENSE / SECURITY.md | — | Documentation |
| desktop/* | — | Electron (Win/Mac/Linux) |
| mobile/* | — | Capacitor (Android/iOS) |
| dist/* | — | Flatpak/Snap packaging |
| .github/* | — | GitHub Actions CI/CD |

---

## 2. Cryptographic Protocol

### 2.1 Algorithm Stack

| Layer | Algorithm | Key Size | Standard |
|-------|-----------|----------|----------|
| Key Exchange | X25519 (fallback: P-256 ECDH) | 256-bit | RFC 7748 |
| Signing | Ed25519 (fallback: HMAC-SHA256) | 256-bit | RFC 8032 |
| Message Encryption | AES-256-GCM | 256-bit | NIST SP 800-38D |
| KDF | HKDF-SHA256 | — | RFC 5869 |
| Lock Screen KDF | PBKDF2-SHA256 | 100,000 iter (`PBKDF2_ITERATIONS`) | NIST SP 800-132 |
| At-Rest Key Wrap KDF | PBKDF2-SHA256 | 600,000 iter (`PBKDF2_AT_REST_ITERATIONS`) | NIST SP 800-132 |
| Forward Secrecy | Double Ratchet | — | Signal Protocol |
| Group Encryption | Sender Key O(1) | — | Signal Protocol |
| Sender Privacy | Sealed Sender | — | Signal Protocol |
| Anti-Spam | Proof-of-Work (hashcash) | 20-bit (`POW_DIFFICULTY`) | — |
| Replay Protection | LRU cache (2,000 entries) + IDB dedup | — | — |

### 2.2 Key Management

- **Identity Key Pair**: X25519 (or P-256), generated on first setup, stored in IDB `identity` store
- **Signed PreKey (SPK)**: Uploaded to server, rotated periodically
- **One-Time PreKeys (OTP)**: `PREKEY_OTP_COUNT` (20) keys generated; the relay's `/prekey/status` tells the client when to replenish
- **Session Rekey**: *not implemented* (removed v3.7). A threshold-based forced rekey shipped
  as dead code — it called `dhRatchetStep` with the wrong arguments, threw on every call, and
  still wrote a "Session rekeyed" audit entry. Forward secrecy comes from the per-message KDF
  chain plus the real DH step that runs whenever the peer's ratchet key changes.
- **Ratchet Keys**: Per-message ephemeral keys via Double Ratchet
- **Group Sender Key**: Per-group, per-member, epoch-based rotation

### 2.3 Message Flow

```
Sender                          Server                         Receiver
  |                                |                               |
  |-- Encrypt (AES-256-GCM) ----->|                               |
  |-- Sealed Sender envelope ----->| /api/sealed/send              |
  |                                |-- Store in KV (TTL) --------->|
  |                                |                  /api/sealed/poll
  |                                |<-- Fetch envelope ------------|
  |                                |                               |-- Decrypt
  |                                |                               |-- Verify signature
  |                                |                               |-- Replay cache check
  |                                |                               |-- Display
```

### 2.4 Post-Quantum Readiness

- ML-KEM detection: `crypto.subtle.encapsulateKey` (future browser API)
- Hybrid: X25519 + ML-KEM-768 (PQXDH) — **shipped and on by default**
  (stage 3, docs/PQ_STAGE3_PLAN.md; derivation in docs/CRYPTO-SPEC.md §2a).
  The KEM is a pinned, NIST-ACVP-verified pure-JS implementation
  (vendored @noble/post-quantum), so there is no browser-support
  dependency; native ML-KEM, when browsers ship it, remains a
  performance upgrade path only.
- Negotiation: the `pqxdh` capability is ANDed with `x3dh-v5`; a peer
  without it gets byte-identical classical X3DH v5 sessions.

---

## 3. Network Architecture

### 3.1 Connection Model

```
                    ┌──────────────┐
     ┌──────────────│  Cloudflare  │──────────────┐
     │   Signal     │   Worker     │   Signal      │
     │   Relay      │  (5,213 LOC) │   Relay       │
     │              └──────────────┘               │
     │                     │                       │
     │              ┌──────┴──────┐                │
     │              │  KV Storage │                │
     │              └─────────────┘                │
     │                                             │
  ┌──┴──┐          WebRTC P2P            ┌────────┴┐
  │User A│◄═════════════════════════════►│ User B  │
  │(16.0K)│   DataChannel (encrypted)     │(16.0K)  │
  └──────┘                               └─────────┘
```

### 3.2 Worker API Endpoints (41)

Counted 2026-11-25: 40 `case '/api/…'` branches in `_worker.js` plus `/api/health`,
which is dispatched before the switch. Rate limits are per IP per minute, from the
worker's `limits` map.

| Endpoint | Rate Limit | Purpose |
|----------|------------|---------|
| /api/health | unlimited | Health check (no auth; reports the effective TURN provider) |
| /api/signal | 60/min | WebRTC signaling relay |
| /api/msg/send | 30/min | Relay message (fallback when P2P unavailable) — **deprecated** plain path: responses carry `Deprecation: true`; removable via `PLAIN_PATH_DISABLED=true` |
| /api/msg/poll | 40/min | Poll for relay messages — **deprecated**, see /api/msg/send |
| /api/sealed/send | 30/min | Sealed Sender message |
| /api/sealed/poll | 40/min | Poll sealed messages |
| /api/sealed/ack | 40/min | Acknowledge sealed message delivery |
| /api/presence | 20/min | Online presence heartbeat |
| /api/alias/set | 10/min | Register @username |
| /api/alias/get | 30/min | Resolve @username to public key |
| /api/alias/delete | 5/min | Delete @username |
| /api/prekey/upload | 5/min | Upload PreKeys |
| /api/prekey/fetch | 10/min | Fetch target's PreKeys |
| /api/prekey/fetch/batch | 5/min | Fetch several targets' PreKeys |
| /api/prekey/status | 20/min | PreKey replenishment status |
| /api/group/create | 5/min | Create group |
| /api/group/join | 10/min | Join group via token |
| /api/group/info | 20/min | Get group metadata |
| /api/group/kick | 5/min | Remove group member |
| /api/group/admin | 10/min | Group admin operations |
| /api/group/transfer | 5/min | Transfer group ownership |
| /api/group/rename | 10/min | Rename group |
| /api/group/leave | 10/min | Leave group |
| /api/group/delete | 5/min | Delete group |
| /api/account/delete | 3/min | Delete account records (authenticated) |
| /api/device/set | 5/min | Register a linked device |
| /api/device/list | 30/min | List linked devices |
| /api/push/subscribe | 5/min | Web Push subscription |
| /api/push/unsubscribe | 5/min | Remove Web Push subscription |
| /api/turn | 10/min | TURN credential request |
| /api/backup/upload | 2/min | Encrypted backup upload |
| /api/backup/download | 5/min | Encrypted backup download |
| /api/backup/simple-upload | 2/min | Simple (account + passphrase) backup upload |
| /api/backup/simple-download | 5/min | Simple backup download |
| /api/backup/simple-delete | 5/min | Simple backup delete |
| /api/drop/create | 10/min | Create file drop (encrypted transfer) |
| /api/drop/read | 20/min | Download file drop |
| /api/abuse/record | 30/min | Record abuse metadata for reporting |
| /api/abuse/report | 10/min | Submit abuse report |
| /api/ktlog/get | 20/min | Key-transparency log lookup |
| /api/relay/attest | 20/min | Relay identity attestation (stage-2 pinning) |

### 3.3 Worker Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| KV | Yes | Cloudflare KV namespace binding |
| VAPID_PUBLIC_KEY | For push | Web Push VAPID public key |
| VAPID_PRIVATE_KEY | For push | Web Push VAPID private key |
| TURN_URL | Recommended | TURN server URL |
| TURN_SECRET | Recommended | TURN server secret |
| TURN_USERNAME | Optional | TURN static username |
| TURN_CREDENTIAL | Optional | TURN static credential |
| TURN_KEY_ID / TURN_KEY_API_TOKEN | Optional | Cloudflare Calls TURN (tried first; see docs/SELF_HOSTING.md) |
| REGISTRATION_ALLOWLIST | Optional | Restrict account creation to listed Breeze IDs |
| USAGE_QUOTA_ENABLED / _DAILY / _MONTHLY | Optional | Fair-use quota frame (default on; 10,000/day, 200,000/month) |

### 3.4 Adaptive Networking

`_adaptiveConfig` automatically adjusts based on `NetworkInformation.effectiveType`,
and is further adjusted by DataChannel RTT (`updateFromRTT`):

| Connection | Poll Interval | Image Quality |
|------------|---------------|---------------|
| Default (4g / WiFi) | 5,000 ms (`POLL_UNREAD_MS`) | 85% |
| 3g | 8,000 ms | 70% |
| 2g / Save-Data | 15,000 ms | 50% |
| RTT > 500 ms | 10,000 ms | 60% |
| RTT > 2,000 ms | 20,000 ms | 40% |

The power modes (§4.5) floor the poll interval independently of this table:
saver ≥ 60 s and emergency ≥ 10 min, with presence heartbeats stopped.

---

## 4. Client Architecture

### 4.1 IndexedDB Schema (Version 6)

| Store | Key | Indexes | Purpose |
|-------|-----|---------|---------|
| identity | string key | — | Key pairs, PreKeys, settings |
| contacts | id (keyPath) | — | Contact list |
| messages | msgId (keyPath) | contact (contactId), ts, contact_ts ([contactId, ts]) | Message history |
| audit | id (autoIncrement) | ts, type | Security audit log |
| settings | string key | — | User preferences |
| calls | id (autoIncrement) | ts, contact (contactId) | On-device call history (never synced or backed up) |

### 4.2 CONFIG Constants (excerpt — every pair below is checked against `CONFIG` in index.html by tests/spec-config-drift.test.js)

```javascript
VERSION: '3.8.0'              PROTOCOL_VERSION: 4
POLL_FAST_MS: 3000            POLL_SLOW_MS: 15000
PRESENCE_INTERVAL_MS: 30000   TYPING_THROTTLE_MS: 3000
TYPING_TIMEOUT_MS: 3000       CALL_TIMEOUT_MS: 60000
FILE_MAX: 52428800 (50MB)     GROUP_MAX: 1000
MAX_MSG_LENGTH: 4096          CHUNK_SIZE: 16384
DC_BUFFER_MAX: 262144         HEALTH_CHECK_MS: 15000
REPLAY_CACHE_SIZE: 2000       MSG_DOM_LIMIT: 200
MSG_PAD_BOUNDARY: 256         PREKEY_OTP_COUNT: 20
ICE_CANDIDATE_POOL_SIZE: 4    PBKDF2_ITERATIONS: 100000
HKDF_HASH: 'SHA-256'          AES_KEY_BITS: 256
IV_BYTES: 12                   PREFERRED_CURVE: 'X25519'
SESSION_RESET_THRESHOLD: 3
TOAST_DURATION_MS: 2000       BANNER_HIDE_MS: 2000
FADE_OUT_MS: 300              DEBOUNCE_MS: 800
DISAPPEAR_CHECK_MS: 10000     SMART_REPLY_HIDE_MS: 30000
CLEANUP_INTERVAL_MS: 3600000
POW_DIFFICULTY: 20            RECONNECT_BASE_MS: 1000
RECONNECT_MAX_MS: 60000       RECONNECT_MAX_ATTEMPTS: 8
```

### 4.3 DRY Helper Functions

Instance counts are literal call-pattern occurrences in `index.html`, grep-measured
2026-11-25 (they drift; re-grep rather than trust them).

| Helper | Replaces | Instances |
|--------|----------|-----------|
| `_DOM.get(id)` | `document.getElementById(id)` | 254 calls (memoized) |
| `_H` | `{ 'Content-Type': 'application/json' }` | constant, used for all JSON posts |
| `MS.*` | Time magic numbers (86400000 etc.) | throughout |
| `postAPIRaw(path, body)` | `fetchT(API + path, { method: 'POST', headers: _H, body: ... })` | 34 calls |
| `_signal(room, type, data)` | Signal POST (fire-and-forget) | 7 calls |
| `_signalAwait(room, type, data)` | Signal POST (returns Response) | 2 calls |
| `_dmRoom(peerId)` | `'dm:' + [myId, peerId].sort().join(':')` | 4 calls |
| `_autoHeight(el, maxPx)` | Textarea auto-resize pattern | 3 calls |
| `_updateTitle(unreadCount)` | `document.title = ...` | 4 calls |
| `_defer(fn)` | `requestIdleCallback(fn)` or `setTimeout(fn, 100)` | defined once, used for non-critical startup |

### 4.4 CSS Design System

**42 CSS Custom Properties** in `:root` (dark theme shown; the `.light` theme
overrides the colour tokens — its accent/error values were re-measured for
WCAG contrast in the 2026-11 UI pass: light `--g` #046c4e, `--gd` #065f46,
`--r` #c81e1e, `--t3` #636366; dark `--t3` is #93939f):

| Property | Purpose | Dark Value |
|----------|---------|------------|
| --bg | Background | #050505 |
| --s1 | Surface 1 | rgba(28,28,30,.85) |
| --s2 | Surface 2 | rgba(44,44,46,.7) |
| --s3 | Surface 3 | rgba(58,58,60,.6) |
| --t1 | Text primary | #f2f2f7 |
| --t2 | Text secondary | #98989d |
| --t3 | Text tertiary | #93939f |
| --g | Green accent | #34d399 |
| --gl | Green light | rgba(52,211,153,.08) |
| --gd | Green dark | #10b981 |
| --r | Red/error | #ff6b6b |
| --y | Yellow/warning | #fbbf24 |
| --blue | Blue/info | #60a5fa |
| --b1 | Border | rgba(255,255,255,.08) |
| --rad | Border radius | 16px |
| --font | Font family | -apple-system, system-ui, sans-serif |
| --mono | Monospace | 'SF Mono', ui-monospace, monospace |
| --sp-1 | Spacing scale 1 | 4px |
| --sp-2 | Spacing scale 2 | 8px |
| --sp-3 | Spacing scale 3 | 12px |
| --sp-4 | Spacing scale 4 | 16px |
| --sp-5 | Spacing scale 5 | 24px |
| --sp-6 | Spacing scale 6 | 32px |
| --sp-7 | Spacing scale 7 | 48px |
| --fs-caption | Caption/metadata font size | 12px |
| --fs-sub | Secondary text font size | 13px |
| --fs-body | Body font size | 15px |
| --fs-name | Contact/display-name font size | 16px |
| --fs-title | Title font size | 18px |
| --fs-display | Display font size | 22px |
| --rad-sm | Small border radius | 8px |
| --rad-bubble | Message-bubble border radius | 18px |
| --ease | Transition | .3s cubic-bezier(.175,.885,.32,1.275) |
| --touch | Touch min-size | 48px |

**71 CSS Utility Classes** (`.i-*` prefix, counted 2026-11-26).

**Component primitives** (UI/UX unification phase 2):

- **Badges** are one component, `.bdg`. Folder tabs, bottom tabs, folder-entry counts,
  contact-row unread counts and account-tab alerts all carry it;
  `.bdg-row`, `.bdg-count` and `.bdg-acc` carry only the placement,
  spacing and colour deltas. The former `.badge` / `.cbadge` / `.acc-badge` split
  is removed.
- **Text inputs** carry `.field` as the common base. Context modifiers
  (`.setup-input`, `.setup-input-alt`, `.contact-filter`, `.modal-input`,
  `.settings-name-input`) layer only the screen-specific presentation
  deltas (layout, spacing, border or type size). Off-scale legacy measurements are written as `calc()`
  offsets from the spacing, font and radius tokens so their computed
  values stay unchanged.
- **Buttons** use `.btn` as the base system. The purpose-specific
  variants `.tool`, `.send`, `.tab-btn` and `.folder-tab` keep their
  class names but share the same tokenised foundation: touch dimensions
  derive from `--touch`, radii from the `--rad-*` scale and typography
  from the `--fs-*` scale (`calc()` only where a legacy value sits
  between scale steps).

### 4.5 UI Structure (2026-11 UI pass)

- **Bottom tab bar (mobile)**: at ≤640px in the list view, a tab bar
  with five tabs (chats / calls / contacts / my card / settings) is
  shown; it is `role="navigation"` with `aria-current` on the active
  tab. Chats and Contacts are two modes of the sidebar list
  (`_listTab`: chats keeps recency order plus folder/label filters,
  contacts shows friends only — no groups, no archived — in name
  order), Calls is a third list mode owned by the call-history
  module, My card opens the profile panel, and Settings opens the
  settings view; selection state follows whichever entry point opened
  the screen. The Chats tab carries the unread-count badge (the
  `totalUnread` the contact renderer already computes). Which of the
  optional tabs (calls / contacts / my card / settings) are shown is
  a per-tab Settings choice (the "Bottom tabs" section,
  `_settings.tabCalls / tabContacts / tabSelf / tabSettings`, all
  default shown); the Chats tab is always shown, hiding the Settings
  tab never strands the user (the sidebar gear button still opens
  Settings), and hiding the tab of the mode currently on screen
  returns the list to Chats.
- **Input bar + more panel**: the composer keeps only +, text field,
  character count, emoji and send. Attachment, voice recording, dictation,
  location, stickers and no-reply-needed live in the "+" panel (`#msg-more-panel`);
  the no-reply-needed state also shows as a dot on the "+" button.
- **Line icons**: action buttons use a shared inline-SVG set (`.ico`,
  24×24, `stroke: currentColor`); the send icon is a line-drawn paper plane,
  matching the app icon (a pixel-art paper plane).
- **Delivery status by shape**: sent = single check, relay-queued = check
  inside a ring, delivered = double check, read = filled blue chip,
  failed = filled red chip — colour is never the only signal. Presence
  dots likewise differ by shape (online filled circle, away square,
  offline hollow circle).
- **Settings view**: settings render in a dedicated full-screen view
  (`#settings-view`) with its own history entry, opened from the mobile
  settings tab, the sidebar gear button (`#b-msg-settings`) or `/settings`
  — never into the chat log.
- **Add-contact dialog**: the "友達追加" button opens a dialog with three
  explicit choices — add contact (ID or QR), invite friend (invite link),
  create group (plain name field, no `group:` prefix knowledge needed).
- **Chat header**: a search icon (in-chat search) and an overflow menu
  routing to existing commands (`/security`, `/mute`, `/pin`, `/poll`);
  typing `/` in the composer opens a suggestion popover sourced from
  `_SLASH_COMMANDS`.
- **Self card**: the user's own profile card sits at the top of the
  contact list and scrolls with it; the profile panel shows the full
  public-key ID with a copy button, and the header name and the card open
  the same editor.
- **Power modes**: `auto` / `normal` / `saver` / `emergency` (§3.4);
  in `auto` the mode follows `navigator.getBattery()` (>50% normal,
  20–50% saver, ≤20% emergency; charging steps one level back). Listening
  is throttled, sending never is.
- **First-run screen**: the primary action is the one-tap "Start with a
  random ID" button, with an optional display-name field ("Your name
  (display name)") above it; the identity it mints carries no recovery
  mode, so it stays eligible for backup and the recovery kit. The named
  path (name + @alias) creates a phrase identity whose recovery phrase
  is shown at creation, and a "Restore an existing account" expander
  holds the three restore entries (backup file, recovery phrase,
  account + passphrase). There is no disposable / no-recovery creation
  mode (removed in PR #531); identities created by it earlier keep
  `recoveryMode: 'none'` and remain refused a backup or a kit, but no
  new one can be made. The display name is also editable later in the
  Settings profile section, writing through the profile module's own
  save path.
- **Automatic backup** (`src/app/backup.js`): a Settings toggle
  (default on) plus a status line. A hook on `dbPut` marks the backup
  dirty when the identity / contacts / messages stores change; uploads
  run through the same cloud / simple uploads as the manual buttons,
  throttled by a 30 s quiet period after the last change and a 15 min
  floor between attempts. Offline changes stay pending and flush on
  the `online` event and at boot. The backup passphrase is never
  persisted — it is armed for the session at simple-mode enrollment /
  update, or via the Settings "Enter passphrase" button — and the
  status line names the state (off / ineligible / no-server /
  need-passphrase / error / pending / ok) instead of failing silently.
  After a phrase / kit restore, a just-recovered marker makes the next
  boot probe the home relays for that identity's cloud backup and
  offer it once; nothing is written until the user confirms and the
  payload's identity matches the recovered one. A "Move to a new
  device" button in the same Settings section shows the migration
  guide built on these flows (no new mechanism).
- **Contact names**: one display-resolution path
  (`contactDisplayName` / `contactPeerName`). The local nickname —
  stored in `c.name` + `nameLocked`, the fields the context-menu
  rename has always written — wins; the name the contact set for
  themselves (`c.profileName`, kept current by profile distribution)
  is shown alongside it in a muted span in the contact list and the
  chat header while a nickname hides it, gated by the `showPeerName`
  setting (Privacy section, default on). The Contact info panel
  (contact context menu, conversation overflow menu) edits the
  nickname and can clear it; nicknames are stored only on the device
  and are never sent to the contact or the relay. Search matches both
  the nickname and the contact's own name.
- **Call history** (`src/app/call-history.js`): 1:1 calls leave a
  metadata-only record in the IndexedDB `calls` store (§4.1) — peer
  id, a name snapshot, direction (out / in / missed, where missed is
  an incoming call that ended before it was answered), video flag,
  start time and duration. Records live only on this device: nothing
  is sent to a relay or the peer, and the log is not part of any
  backup payload (device-local metadata, in the same category as the
  audit log and settings), so a new device starts with an empty
  history and call writes never trigger the automatic backup. The
  newest 200 records are kept (`CALL_HISTORY_MAX`, older ones pruned
  on write). The Calls tab renders the history into the sidebar
  list; rows open the conversation and can redial in the same mode
  (voice / video), unseen missed calls badge the tab and are marked
  seen when the list is viewed, and the history screen carries a
  clear-all button. Settings → Privacy can turn recording off
  (`_settings.callHistoryLog`, default on). Group calls are not
  logged (a join/leave room lifecycle, not a call).

---

## 5. Slash Commands

> The suggestion list `_SLASH_COMMANDS` in `index.html` holds 71 commands
> (counted 2026-11-25) and also feeds the composer's `/` suggestion popover;
> the exact set drifts as commands are added/removed — grep that array and the
> `val === '/...'` dispatch sites for the live list rather than trust this section.

### 5.1 Messaging

| Command | Description |
|---------|-------------|
| /search `<text>` | Search messages in current chat |
| /searchall `<text>` | Search across all chats |
| /reply `<id>` | Reply to specific message |
| /pin | Pin/unpin last message |
| /pins | Show pinned messages |
| /bookmarks | Show bookmarked messages |
| /poll `Q \| A \| B \| C` | Create inline poll |
| /timer `<time>` | Set disappearing messages |
| /schedule `<time> <msg>` | Schedule message |
| /reactions | Show reaction stats |
| /clear | Clear the current chat |
| /compact | Compact the message view |
| /files | List files shared in the current chat |
| /print | Print the current chat |
| /export | Export chat as JSON |
| /import | Import chat from JSON |
| /retry | Resend failed messages from the outbox |

### 5.2 Contacts & Groups

| Command | Description |
|---------|-------------|
| /info | Contact/group details |
| /note | Note on the current contact |
| /members | List group members |
| /admin | Group admin operations |
| /invite | Generate invite link |
| /add | Add a contact by ID |
| /newgroup `<name>` | Create group |
| /rename `<name>` | Rename group |
| /label `<labels>` | Tag contact with labels |
| /sort `<method>` | Sort contacts (name/unread/recent) |
| /contacts | Export / import / back up the contact list |
| /mute | Toggle mute |
| /archive | Toggle archive |
| /unblock | Unblock contact |
| /rendezvous | In-person pairing (rendezvous room) |
| /offlinepair | Pair devices offline (QR / same LAN) |
| /room `[name]` | Open a rendezvous room |

### 5.3 Security & Privacy

| Command | Description |
|---------|-------------|
| /security | Cryptographic stack details |
| /verify | Compare safety numbers |
| /lock | Lock screen with password |
| /sessions | Active session list |
| /audit | Security audit log |
| /retention `<days>` | Set message retention policy |
| /backup | Create / restore the encrypted backup |
| /keywrap | Wrap the identity key with a passphrase |
| /devices | List linked devices |
| /link / /linkto / /unlink | Link or unlink another device for this identity |
| /history | Show message history |
| /migrate | Migrate account data |
| /profile | Open the profile editor |
| /drop `<secret>` | Dead drop: one-time secret sharing |
| /gdpr | GDPR data export (Art. 15/20) |
| /wipe | Remote wipe (all devices) |
| /panic | Emergency: wipe all local data |

### 5.4 Diagnostics

| Command | Description |
|---------|-------------|
| /debug | Toggle debug mode |
| /whoami / /who | Identity + alias + public key |
| /online | Show which contacts are online |

> Note: `/network`, `/peers`, `/storage`, `/perf`, `/about`, `/uptime` (plus `/keyboard` from
> §5.5) were removed from this doc (2026-09) — `index.html` carries its own deletion note
> (v3.7, "first-principles pass"): this whole developer-diagnostic command cluster
> (`/perf /speedtest /network /peers /storage /stats /uptime /status /about /changelog
> /keyboard`) was deleted as 582 lines and ~90 i18n keys × 8 locales spent on diagnostics nobody
> messaging a friend needs — connection quality is already shown in the conversation header, and
> the changelog lives in the repo instead of being duplicated in-app. `/billing` was a separate,
> undocumented removal (see `SECURITY.md`'s "Removed: multi-account billing"). A wider
> command-reference audit against the full current command set is tracked as a follow-up in
> `docs/ASSESSMENT.md`.

### 5.5 UI & Settings

| Command | Description |
|---------|-------------|
| /theme `<dark\|light\|auto>` | Theme switch |
| /wallpaper `<color>` | Chat wallpaper |
| /settings | Open the settings view |
| /sound | Toggle notification sound |
| /focus `[min] [all]` | Focus mode (quiet window) |
| /compress | Toggle message compression |
| /stickers | Sticker packs |
| /location | Share location |
| /help | Full command list |
| /qr | Show QR code for contact sharing |
| /share | Share Breeze ID + invite link |
| /summarize | Local extractive conversation summary |

---

## 6. Billing Model

No billing is implemented. Every account gets every feature, with no plan gating and unlimited
local accounts. See [SECURITY.md](SECURITY.md)'s "Removed: multi-account billing" section — it
was built at one point and removed, but the docs kept describing it as live.

---

## 7. Platform Support

Shipped builds come from `.github/workflows/release.yml` (verified 2026-11-21): the web package, the Electron desktop builds and the Android APK. The Tauri sources are in the repo but are **not** built by the release pipeline and have no shipped builds; iOS is likewise not part of the pipeline.

| Platform | Technology | Build Command |
|----------|-----------|---------------|
| Web (PWA) | Cloudflare Pages | `wrangler pages deploy .` |
| Windows | Electron (NSIS, ~150MB) — shipped | `cd desktop && npx electron-builder --win` |
| macOS | Electron (DMG, ~150MB) — shipped | `cd desktop && npx electron-builder --mac` |
| Linux | Electron + Flatpak + Snap — shipped | `cd desktop && npx electron-builder --linux` |
| Android | Capacitor (APK) — shipped | `cd mobile && ./scripts/build-mobile.sh android` |
| Windows / macOS / Linux | Tauri — source only, not shipped | `cd tauri && npx @tauri-apps/cli build` |
| iOS | Capacitor (Xcode) — not in the release pipeline | `cd mobile && ./scripts/build-mobile.sh ios` |
| All platforms | Unified | `./build-all.sh <target>` |

---

## 8. Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: camera=self, microphone=self, geolocation=()
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; connect-src 'self' https: wss: stun: turn:;
  img-src 'self' blob: data: https:; media-src 'self' blob:; worker-src 'self' blob:
```

---

## 9. Quality Gates (validate.sh)

| Gate | Checks | Threshold |
|------|--------|-----------|
| 1. Syntax | 3 files: index.html, _worker.js, sw.js | All pass |
| 2. Security | eval=0, CSP present, no API key leaks | All pass |
| 3. i18n | Hardcoded strings < 10, toast i18n >= 95% | Met |
| 4. Code Quality | .style.X < 25, onclick=0, DRY headers=100% | Met |
| 5. Performance | Lines, RAF >= 2, Fragment >= 1, throttle | Met (index.html 15,999 lines, under the 16,000-line test cap) |
| 6. Protocol Spec | 6 crypto features verified | Met |
| 7. Required Files | 10 files exist | Met |

**Current score: 165/171, 44 checks, 0 failures — `./validate.sh` PASSED, measured 2026-11-25 (the check count grows as gates land, so re-run rather than trust this figure). Test suite at the same date: 161 files / 2,630 tests, all passing.**

---

## 10. Performance Optimizations

| Optimization | Impact |
|-------------|--------|
| _DOM.get() memoized cache | 254 getElementById calls cached with isConnected validation |
| requestAnimationFrame render coalescing | 3 render paths avoid forced layout |
| DocumentFragment batch insertion | 2 batch DOM operations |
| renderContacts throttle (200ms) | Prevents 38+ calls/cycle jank |
| MSG_DOM_LIMIT (200) | Auto-prunes oldest messages + blob revocation |
| _defer() for non-critical startup | Retention/audit intervals via requestIdleCallback |
| _perf.mark/measure | Performance API instrumentation |
| _replayCache LRU (2,000) | O(1) message dedup before IDB |
| Adaptive polling | 3g/2g: slower poll, lower compress threshold |
| Connection health monitor (15s) | Auto ICE restart on RTT > 5s |

---

## 10.5 Design System — "Airy Joy" (v3.6.0)

| Principle | Source | CSS Implementation |
|-----------|--------|-------------------|
| Frosted glass layers | iOS HIG | `--glass: blur(20px) saturate(1.5)` token; `backdrop-filter` used 32 times in the stylesheet |
| Bouncy micro-interactions | Nintendo Switch UI | `--bounce: cubic-bezier(.34,1.56,.64,1)` token |
| Spring physics feel | Web Animation Best Practices | `:active { transform: scale(.88) }` press-in |
| Haptic feedback | iOS Taptic Engine | 5 patterns: tap/send/success/error/notify |

### Animations (21 named keyframes, counted 2026-11-25)

`msgBounce` (new message, spring overshoot), `msgAppear`, `msgFlash`,
`ctxPop` (context menu), `badgePop` (notification badge), `toastBounce`,
`modalSlide`, `overlayFade`, `bannerSlide`, `offlineSlide`, `recSlide`,
`recPulse` (voice recording), `recWave` (voice waveform), `sendPulse`,
`presencePulse`, `typingAppear`, `typingBounce`, `fadeOut`, `lockShake`,
`shimmer`, `spin`.

### Platform-Specific CSS (58 selector occurrences, counted 2026-11-25)

| Target | Occurrences | Key Adaptations |
|--------|-------|----------------|
| `.is-ios` | 16 | Safe area insets, 44pt targets, rubber-band scroll, hover disabled |
| `.is-android` | 14 | Material You radii (20px), Roboto font, edge-to-edge |
| `.is-mobile` | 12 | Full-width sidebar, hidden scrollbars, selection disabled |
| `.is-desktop` | 7 | Compact targets, hover msg-copy, pointer precision |
| `.is-pwa` | 5 | Frameless, install banner hidden |
| `.is-electron` | 4 | Drag region, Mac traffic light offset |

---

## 11. i18n

- **Built-in**: English only — the inline reference table (921 keys, pure data) and runtime fallback
- **Locale files**: 50 files, `locales/<lang>.json` for am, ar, az, bn, cs, da, de, el, es, fa, fi, fr, ha, he, hi, hr, hu, id, ig, it, ja, ka, kk, km, ko, ml, ms, my, nb, nl, pa, pl, pt-BR, ro, ru, sr, sv, sw, ta, te, th, tl, tr, uk, ur, uz, vi, yo, zh-CN, zh-TW, fetched at boot and merged over English — 51 UI languages in total including English. `node tools/i18n-check.mjs` prints the live key count and per-locale coverage; at 2026-11-25 it reports all 50 locales at 100% (core and total). The active locale is auto-detected from `navigator.language` against `FULL_LOCALES`
- **External**: none — the 924-language `lang.js` table was deleted (supplied zero strings to the UI at 44% of payload; see SECURITY.md)
- **Hardcoded UI strings**: 0 (100% coverage via `t()` function)
- **Toast i18n**: 100%
- **Mechanism**: `data-i18n`, `data-i18n-html`, `data-i18n-ph` attributes + JS `t(key, ...args)`

---

## 12. Spec Compliance Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| X25519 key exchange | ✓ Implemented | Fallback: P-256 ECDH |
| Ed25519 signing | ✓ Implemented | Fallback: HMAC-SHA256 |
| Double Ratchet | ✓ Implemented | Forward secrecy |
| AES-256-GCM | ✓ Implemented | Browser-native WebCrypto |
| HKDF-SHA256 | ✓ Implemented | Browser-native WebCrypto |
| Sender Key groups O(1) | ✓ Implemented | Epoch-based rotation |
| Sealed Sender | ✓ Implemented | Server cannot see sender |
| Signal encryption | ✓ Implemented | Edit/delete/reaction encrypted before relay |
| Dead letter queue | ✓ Implemented | Failed messages stored in IDB, /retry to resend |
| Retry persistence | ✓ Implemented | IDB + localStorage beforeunload fallback |
| PreKey upload/fetch | ✓ Implemented | Auto-replenish |
| Message padding (256B) | ✓ Implemented | Hides message length |
| Replay protection | ✓ Implemented | 2,000-entry LRU + IDB |
| Safety number | ✓ Implemented | /verify command |
| TURN relay | ✓ Implemented | NAT traversal |
| Proof-of-Work | ✓ Implemented | 20-bit hashcash (`POW_DIFFICULTY`) |
| Session auto-rekey | ✗ Removed (v3.7) | shipped as dead code + false audit entry; per-message KDF chain + peer-driven DH step provide FS |
| Connection state machine | ✓ Implemented | 7 transitions |
| Connection health monitor | ✓ Implemented | 15s RTT/bandwidth |
| DataChannel backpressure | ✓ Implemented | 256 KB buffer max |
| Message outbox | ✓ Implemented | Persistent retry |
| Timing obfuscation | ✓ Implemented | Random delay |
| Rate limiter | ✓ Implemented | Per-IP, per-endpoint |
| Perfect Negotiation | ✓ v3.6.0 | MDN spec: glare-safe signaling |
| Message compression | ✓ v3.6.0 | deflate-raw adaptive threshold |
| Skipped message keys | ✓ v3.6.0 | Signal §3.4, 100 keys/session |
| iOS QR (ISO 18004) | ✓ v3.6.0 | Reed-Solomon, pure JS |
| AI/translate proxy | ✗ removed v3.6.1 | Sent decrypted plaintext to third parties — incompatible with the zero-knowledge claim. `/summarize` and smart replies remain, computed locally. |
| Tauri desktop | △ Source only | Sources are in the repo but are **not** built by the release pipeline and have no shipped builds (see §7) |
| Haptic feedback | ✓ v3.6.0 | 5 patterns + iOS Capacitor native |
| Platform-specific CSS | ✓ v3.6.0 | iOS/Android/Desktop/PWA/Electron |
| Persistent drafts | ✓ v3.6.0 | localStorage, draft preview |
| Unread separator | ✓ v3.6.0 | New Messages line |
| Voice recording UI | ✓ v3.6.0 | Timer + waveform animation |
| Pinch-to-zoom lightbox | ✓ v3.6.0 | Mobile gesture support |
| Anti-replay (Worker) | ✓ v3.6.0 | ±5min timestamp validation |
| SW stale-while-revalidate | ✓ v3.6.0 | Cache size management |
| Dead Drop (one-time secret) | ✓ v3.6.0 | /drop command, /api/drop/create + /api/drop/read |
| Inline Crypto Web Worker | ✓ v3.6.0 | Blob URL, Transferable ArrayBuffer, AES-GCM offload |
| Double HMAC timing-safe | ✓ v3.6.0 | WebCrypto HMAC-SHA256 comparison |
| IndexedDB batch getAll | ✓ v3.6.0 | 37× faster on Safari (Nolan Lawson) |
| ARIA announceToSR | ✓ v3.6.0 | Offscreen live region for screen readers |
| aria-busy batch render | ✓ v3.6.0 | Suppress SR during DOM rebuild |
| CSS contain + content-visibility | ✓ v3.6.0 | Layout perf: contact-list + msg-area |
| overscroll-behavior | ✓ v3.6.0 | Scroll chaining prevention |
| Magic bytes file validation | ✓ v3.6.0 | PE/ELF/Mach-O/shebang detection |
| State channel handler | ✓ v3.6.0 | Typing/read/presence on unreliable DC |
| Outbox badge + retry viz | ✓ v3.6.0 | Pending message count with pulse |
| Notification collapse | ✓ v3.6.0 | Same-contact grouping + unread count |
| CSP + COOP headers | ✓ v3.6.0 | Full Content-Security-Policy + Cross-Origin-Opener-Policy |
| Wallpaper presets | ✓ v3.6.0 | ocean/sunset/forest/midnight/aurora gradients |
| P2P presence dot | ✓ v3.6.0 | 3-state: offline/relay/p2p-direct (double ring) |
| Real voice waveform | ✓ v3.6.0 | AnalyserNode FFT → 5-bar visualization |
| Keyboard shortcuts | ✓ v3.6.0 | Ctrl+E emoji, Ctrl+K contacts, Ctrl+N next unread |
| SW SKIP_WAITING flow | ✓ v3.6.0 | Non-intrusive update + controllerchange reload |
| Memory zeroing | ✓ v3.6.0 | zeroBuffer() for crypto key material |
| DC heartbeat ping/pong | ✓ v3.6.0 | 10s interval, 3 miss → ICE restart |
| Group P2P dual-path | ✓ v3.6.0 | P2P direct + sealed sender + dedup |
| Key change warning | ✓ v3.6.0 | 3 decrypt fail → yellow banner + audit (Signal-style) |
| P2P-only mode | ✓ v3.6.0 | Server unreachable → yellow banner, P2P works |
| RTT adaptive quality | ✓ v3.6.0 | Heartbeat RTT → compress/poll/image quality |
| File transfer progress | ✓ v3.6.0 | Send/receive % + speed (MB/s) |
| Swipe-to-reply | ✓ v3.6.0 | Right swipe 60px → reply (WhatsApp gesture) |
| Message multi-select | ✓ v3.6.0 | Batch delete/forward with floating action bar |
| Image auto-compress | ✓ v3.6.0 | OffscreenCanvas → WebP, adaptive quality |
| Markdown tables | ✓ v3.6.0 | Pipe-separated → `<table>` rendering |
| Native `<dialog>` modals | ✓ v3.6.0 | Auto inert, focus trap, ::backdrop blur |
| Trusted Types policy | ✓ v3.6.0 | breeze-sanitizer: DOMParser sanitization |
| getAllRecords reverse | ✓ v3.6.0 | Chrome 141+ direction:prev (68% faster) |
| Disappearing msg countdown | ✓ v3.6.0 | Live ⏱ → fade+remove at expiry |
| Contact typing sidebar | ✓ v3.6.0 | Green "typing..." in contact list preview |
| Proactive storage quota | ✓ v3.6.0 | 80% warning before IDB fails |
| DRY downloadBlob helper | ✓ v3.6.0 | 5 download patterns consolidated |
| Cover traffic | △ Deferred | Privacy enhancement |
| MLS TreeKEM | △ Deferred | Large group scaling |
| Key transparency | △ Deferred | Public audit log |
| Onion routing | △ Deferred | Metadata protection |
| Post-quantum (ML-KEM) | ✓ Shipped | PQXDH hybrid on by default (stage 3); vendored pure-JS ML-KEM-768, no browser dependency |

---

*Generated: 2026-03-15 | Last re-measured: 2026-11-25 | Breeze v3.8.0 (CONFIG VERSION) | 34,976 total lines (index.html + src/ + _worker.js + sw.js) | Tests: 161 files / 2,630 passing*
