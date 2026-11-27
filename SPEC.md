# Breeze Messenger — Detailed Specification

**Document version**: 2026-03-14 R210
**Status**: Living reference. Where this document and the code disagree, the code and its tests win.
**Total codebase**: not copied here; `validate.sh` prints the live `index.html` line count and enforces its ceiling, and `npm test` prints the live test counts.

---

## 1. Product Overview

Breeze is a serverless, end-to-end encrypted P2P messenger deployed on Cloudflare Pages (an `index.html` entry plus ES modules under `src/`; it was a single HTML file up to v3.6.0). Messages travel directly between devices via WebRTC; the server only relays connection signals. No phone number, email, or app store required.

### 1.1 Design Philosophy

| Principle | Source | Application |
|-----------|--------|-------------|
| Performance-first, data-oriented | John Carmack | _DOM cache, _H constant, MS.* time constants, CONFIG centralization |
| Clean architecture, SOLID | Robert C. Martin | Single-responsibility functions, DRY helpers (postAPIRaw, _signal, _autoHeight) |
| Simplicity, composition | Rob Pike | Single-file client plus ES modules, no build step, no framework, no external AI dependency |

### 1.2 File Inventory (664 tracked files)

| File | Size | Purpose |
|------|------|---------|
| index.html | 929 KB | Client: UI + CSS + JS (single file) |
| _worker.js | 305 KB | Cloudflare Worker: API + signals |
| server/* | — | Node self-host relay (same handler, SQLite state) |
| sw.js | 11 KB | Service Worker: offline cache + push |
| manifest.json | 2 KB | PWA manifest |
| locales/* | — | 81 UI locale files (see §11) |
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

The visual system is token-first: spacing, type, radius, colour, elevation,
motion and touch-target decisions live in custom properties, and composite
screens are assembled from shared component classes. Feature-specific one-off
values still exist in the stylesheet, but the scales below are the canonical
foundation for new UI. The accessibility floor is 12px for text and `--touch`
(48px) for primary touch targets, with platform- and pointer-specific
adjustments described in §10.5.

**46 custom properties are defined in `:root`** for the dark scheme. `.light`
and the light branch of `.auto-theme` override the same 17 colour/shadow
tokens; `prefers-contrast: more` strengthens `--b1` and `--t3`; Android
overrides `--font`, `--rad` and `--rad-lg`. `--kb-offset` is a local dynamic
property used by keyboard-aware layouts, not a root design token.

| Theme-overridden token | Dark value | Light value |
|---|---|---|
| `--bg` | `#050505` | `#f2f2f7` |
| `--s1` | `rgba(28,28,30,.85)` | `rgba(255,255,255,.85)` |
| `--s2` | `rgba(44,44,46,.7)` | `rgba(242,242,247,.9)` |
| `--s3` | `rgba(58,58,60,.6)` | `rgba(229,229,234,.8)` |
| `--b1` | `rgba(255,255,255,.08)` | `rgba(0,0,0,.06)` |
| `--t1` | `#f2f2f7` | `#1c1c1e` |
| `--t2` | `#98989d` | `#48484a` |
| `--t3` | `#93939f` | `#636366` |
| `--g` | `#34d399` | `#046c4e` |
| `--gd` | `#10b981` | `#065f46` |
| `--gl` | `rgba(52,211,153,.08)` | `rgba(5,150,105,.08)` |
| `--r` | `#ff6b6b` | `#c81e1e` |
| `--y` | `#fbbf24` | `#92400e` |
| `--blue` | `#60a5fa` | `#007aff` |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.3)` | `0 1px 3px rgba(0,0,0,.08)` |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,.25)` | `0 4px 16px rgba(0,0,0,.06)` |
| `--shadow-float` | `0 8px 32px rgba(0,0,0,.35)` | `0 8px 32px rgba(0,0,0,.1)` |

| Shared token | Value | Role |
|---|---|---|
| `--font` | `-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, 'Helvetica Neue', sans-serif` | UI font |
| `--mono` | `'SF Mono', ui-monospace, Menlo, Consolas, monospace` | Monospace font |
| `--sp-1` / `--sp-2` / `--sp-3` / `--sp-4` / `--sp-5` / `--sp-6` / `--sp-7` | `4px` / `8px` / `12px` / `16px` / `24px` / `32px` / `48px` | Spacing scale |
| `--fs-caption` | `12px` | Captions, metadata, minimum text size |
| `--fs-sub` | `13px` | Secondary text and previews |
| `--fs-body` | `15px` | Body and message text |
| `--fs-name` | `16px` | Names and row headings |
| `--fs-title` | `18px` | Titles and large controls |
| `--fs-display` | `22px` | Display headings |
| `--rad-sm` | `8px` | Small radius and grouped-bubble corners |
| `--rad` | `16px` | Standard radius |
| `--rad-bubble` | `18px` | Message-bubble radius |
| `--rad-lg` | `22px` | Large cards and modals |
| `--rad-full` | `9999px` | Pills and circular controls |
| `--bubble-self` | `linear-gradient(135deg, var(--g), var(--gd))` | Own-message bubble |
| `--bubble-other` | `var(--s2)` | Peer-message bubble |
| `--badge-bg` | `var(--g)` | Unread/count badge background |
| `--danger` | `var(--r)` | Danger action/state colour |
| `--ease` | `.3s cubic-bezier(.175,.885,.32,1.275)` | Standard expressive transition |
| `--ease-smooth` | `.25s ease` | Smooth state transition |
| `--bounce` | `cubic-bezier(.34,1.56,.64,1)` | Spring-like overshoot |
| `--touch` | `48px` | Primary touch-target size |
| `--glass` | `blur(20px) saturate(1.5)` | Translucent surface treatment |

`--bubble-self` is not redefined by the light theme: the light scheme keeps
the green gradient and switches the foreground on own bubbles to white.

**71 utility classes** use the `.i-*` prefix (counted as exact single-class
selector rules in the stylesheet). They are small presentation
rules for templates (layout, truncation, colour/state, spacing and reusable
output fragments); composite UI belongs to the component classes below. Some
utility names are legacy hooks rather than literal measurements — for example
`i-fs10` and `i-t3-10` now resolve to the 12px caption scale.

**Component primitives**

- **Buttons**: the general-purpose primitive is `.btn`, with `.btn-g`
  (primary), `.btn-o` (secondary), `.btn-r` (danger) and `.btn-sm` (compact).
  Composer, tab and folder controls keep their context classes (`.input-bar
  .tool`, `.input-bar .send`, `.tab-btn`, `.folder-tab`) but derive their key
  dimensions, radii and type from the same `--touch`, `--rad-*` and `--fs-*`
  tokens rather than maintaining independent measurement systems.
- **Text inputs**: `textarea`, `input[type=password]`, `input[type=text]`,
  `select` and `.field` share the base text-control rule and focus treatment.
  Screen/context classes include `.setup-input`, `.setup-input-alt`,
  `.contact-filter`, `.modal-input`, `.settings-name-input` and
  `.cloudflare-token-input`; recovery, add-contact and group forms add feature
  hooks such as `.rp-phrase`, `.add-input` and `.group-input` on top of the
  same base rather than parallel input components.
- **Badges**: `.bdg` is the single badge base. `.bdg-row`, `.bdg-count` and
  `.bdg-acc` are placement/context modifiers for list rows, folder counts and
  account-tab alerts. The account-tab alert caps its label at `99+`; chat and
  folder counts currently render their full numeric count.
- **List rows**: chats, contacts and call-history entries use the `.contact`
  row shape — circular avatar/initial on the left, name over preview in the
  centre, time and count/status metadata on the right. Unread rows strengthen
  the name, preview and time rather than relying on colour alone.
- **Message bubbles**: `.msg` uses `--rad-bubble`, `--fs-body` and
  `--shadow-sm`; `.msg.me` is right-aligned with `--bubble-self`, `.msg.them`
  is left-aligned with `--bubble-other`, and `.msg.sys` is the centred system
  pill. Consecutive messages use `.grouped` and tighten the adjacent corners
  to `--rad-sm`.
- **Composer**: `.input-bar` owns the primary row; `.input-bar .tool` is the
  circular icon control, `.input-bar .send` is the round send button, and the
  auto-growing textarea shares the bar. Secondary compose actions live in the
  `.more-panel` grid as `.more-item` tiles.
- **Dialogs and modals**: native `<dialog>` is the preferred modal primitive,
  with auto-inert content, backdrop styling, Escape dismissal and focus
  behaviour supplied by the dialog helpers; `.overlay` / `.modal` remain for
  legacy modal surfaces.
- **Settings**: `.settings-view` is the full-screen container. Inside it,
  `.settings-panel`, `.settings-section`, `.settings-card`, `.settings-row`,
  `.settings-row-main`, `.settings-action-row` and `.settings-chevron` form
  grouped profile/control rows. Markup is produced by `settingsPanelHtml()` in
  `src/app/settings-panel.js` and exposed through `window.__breezeSettingsPanel`;
  behaviour remains in delegated handlers in `index.html`.
- **Empty states**: `.empty-state` and `.empty-actions` are the shared
  empty-state presentation, normally created through `_emptyState(text,
  actions)` when actions are dynamic; `.empty-ico` is the defined optional
  icon treatment, although the present helper emits text and actions.
- **Icons**: `src/app/icons.js` is the 35-entry line-icon dictionary. Its
  `icon()`, `iconSlot()`, `createIcon()` and `hydrateIcons()` helpers produce
  or hydrate SVGs; `index.html` carries the pre-module `_ICON_SHAPES` mirror
  and the two dictionaries are pinned identical by `tests/ui-icons.test.js`.
  Dictionary shapes use a 24×24 `viewBox`; the `.ico` class renders them at
  20×20 by default (`fill: none`, `stroke: currentColor`, round caps/joins),
  with context sizes for small buttons, tabs, status icons, setup features and
  large empty/fatal states. Sanitized templates use `data-icon` slots because
  Trusted Types sanitization does not pass raw SVG through unchanged.

### 4.5 UI Structure

- **Main shell**: the messenger is a sidebar-plus-conversation layout on wide
  screens and a full-width list/conversation flow on mobile. The sidebar owns
  account tabs, folder/label filters, search and the self card; the
  conversation pane owns the header, message log and composer.
- **Bottom tab bar (mobile)**: at ≤640px in the list view, a tab bar with five
  possible tabs (chats / calls / contacts / profile / settings) is shown. It is
  `role="navigation"` with `aria-current` on the active tab. Chats and Contacts
  are two modes of the sidebar list (`_listTab`: chats keeps recency order plus
  folder/label filters; contacts shows friends only — no groups, no archived —
  in name order), Calls is a third list mode owned by the call-history module,
  Profile opens the profile panel, and Settings opens the settings view;
  selection state follows whichever entry point opened the screen. The Chats
  tab carries the total unread-count badge and the Calls tab carries the unseen
  missed-call badge. Which optional tabs are shown is a per-tab Settings choice
  (`_settings.tabCalls / tabContacts / tabSelf / tabSettings`, all default
  shown); Chats is always shown, hiding Settings never strands the user (the
  sidebar gear button remains), and hiding the tab of the mode currently on
  screen returns the list to Chats.
- **List rows**: chat, contact and call-history rows share the `.contact`
  component described in §4.4. Chats may be grouped into time sections and
  folder/label filters; contacts use name order; call-history rows add a
  same-mode redial button when the peer is still in contacts.
- **Conversation**: own messages are right-aligned and peer messages
  left-aligned using the bubble tokens in §4.4; consecutive messages tighten
  their adjacent corners. Date separators, unread separators and system
  messages are centred small pills/lines rather than bubbles.
- **Delivery status by shape**: sent = single check, relay-queued/deposited =
  check inside a ring, delivered = double check, read = double check in a
  filled blue chip, failed = a filled red retry chip — colour is never the only
  signal. Presence dots likewise differ by shape (online filled circle, away
  square, offline hollow circle; P2P adds a double-ring treatment).
- **Input bar + more panel**: the composer keeps only +, text field, character
  count, emoji and send. Attachment, voice recording, dictation, location,
  stickers and no-reply-needed live in the "+" panel (`#msg-more-panel`); the
  no-reply-needed state also shows as a dot on the "+" button. There is no
  microphone button in the primary row while the panel is closed.
- **Line icons**: action/status controls use the shared dictionary described in
  §4.4. Static markup carries `data-icon` slots; dynamic DOM uses `createIcon()`
  or `_createIcon()`, and sanitized HTML is hydrated after insertion. The send
  icon is a line-drawn paper plane, matching the product icon motif.
- **Settings view**: settings render in a dedicated full-screen view
  (`#settings-view`) with its own history entry, opened from the mobile
  settings tab, the sidebar gear button (`#b-msg-settings`) or `/settings` —
  never into the chat log. The panel order is: profile card, Privacy, Sound,
  Notifications, Share, Accounts, Backup, Relays, Bottom tabs, then the
  advanced Cloudflare section. Sections are grouped cards of icon + label +
  control rows; navigational/action rows carry a chevron, status rows reuse the
  same row shape, and the Cloudflare disconnect action is the danger row inside
  the advanced section.
- **Empty states**: empty or filtered chat-list states and empty `/search` /
  `/searchall` results use `_emptyState()` with an explanation plus a next
  action where one exists (add contact, invite, migrate, clear search, show
  all, or create group). The initial conversation area also carries a static
  empty state with an Add friend action. Call history is the current exception:
  it renders a text-only `.call-history-empty` row.
- **Add-contact dialog**: the "友達追加" button opens a dialog with three
  explicit choices — add contact (ID or QR), invite friend (invite link),
  create group (plain name field, no `group:` prefix knowledge needed).
- **Chat header**: a search icon (in-chat search) and an overflow menu routing
  to existing commands (`/security`, `/mute`, `/pin`, `/poll`); typing `/` in
  the composer opens a suggestion popover sourced from `SLASH_COMMANDS` in `src/app/slash-picker.js`.
- **Self card**: the user's own profile card sits at the top of the contact
  list and scrolls with it; the profile panel shows the full public-key ID with
  a copy button, and the header name and the card open the same editor.
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
  mode; identities created by it earlier keep `recoveryMode: 'none'`
  and remain refused a backup or a kit, but no new one can be made. The display name is also editable later in the
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

> The suggestion list `SLASH_COMMANDS` in `src/app/slash-picker.js` holds 71 commands
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
| 5. Performance | Lines, RAF >= 2, Fragment >= 1, throttle | Met (the index.html line ceiling is enforced by this gate; re-run for the live count) |
| 6. Protocol Spec | 6 crypto features verified | Met |
| 7. Required Files | 10 files exist | Met |

**Pass/fail status, score and check count are emitted by `./validate.sh` at runtime; the check count grows as gates land, so re-run rather than trust a copied figure.**

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

## 10.5 Motion, Themes, and Platform Adaptation

The "Airy Joy" visual character is implemented through translucent layered
surfaces, spring-like micro-interactions and platform-specific layout
adaptations, while reduced-motion and contrast preferences remain hard floors.

| Mechanism | Implementation |
|-----------|----------------|
| Frosted layers | `--glass: blur(20px) saturate(1.5)` consumed through standard `backdrop-filter` declarations, with `-webkit-backdrop-filter` fallbacks on key surfaces |
| Motion tokens | `--ease`, `--ease-smooth` and `--bounce` centralize the standard, smooth and spring-like timing curves |
| Press feedback | `:active` scale transitions on buttons, contacts, composer controls and call controls; composer/call primary actions use the strongest `scale(.88)` press-in |
| Haptic feedback | Five named patterns in `src/app/sound.js`: tap, send, success, error and notify; the Capacitor shell replaces them with native `Haptics` calls |
| Theme transition | `html.theme-transitioning` temporarily enables colour/surface transitions while the theme class changes |
| Reduced motion | `prefers-reduced-motion: reduce` collapses animation and transition durations and disables smooth scrolling |
| Increased contrast | `prefers-contrast: more` strengthens `--b1` and `--t3` in dark, light and automatic-light schemes; `forced-colors: active` maps own bubbles, primary buttons and the active-contact edge to system Highlight colours |

### Animations

The stylesheet contains 22 `@keyframes` blocks but 21 unique keyframe names:
`shimmer` is defined twice with the same body in the two loading-skeleton
blocks. The unique set is:

`msgBounce` (new message, spring overshoot), `msgAppear`, `msgFlash`,
`ctxPop` (context menu), `badgePop` (notification badge), `toastBounce`,
`modalSlide`, `overlayFade`, `bannerSlide`, `offlineSlide`, `recSlide`,
`recPulse` (voice recording), `recWave` (voice waveform), `sendPulse`,
`presencePulse`, `typingAppear`, `typingBounce`, `fadeOut`, `lockShake`,
`shimmer`, `spin`.

### Themes

Dark is the `:root` default. `.light` carries the explicit light scheme and
`.auto-theme` follows `prefers-color-scheme`, using the same 17 light
colour/shadow overrides listed in §4.4. The theme choice is stored as
`brz-theme` (`auto`, `dark` or `light`); choosing dark or light manually
removes `auto-theme` and toggles the `light` class directly.

### Platform-Specific CSS

Platform detection adds classes to `<html>` (`is-ios`, `is-android`,
`is-mobile` or `is-desktop`, plus `is-win`, `is-linux`, `is-mac`,
`is-pwa`, `is-electron`, `is-touch` and `is-capacitor`). `is-linux`, `is-touch`
and `is-capacitor` currently have no dedicated stylesheet rules. The other
hooks are used for the following adaptations:

| Target | Key adaptations |
|--------|----------------|
| `.is-ios` | Safe-area-aware header/sidebar/composer layout, momentum scrolling, larger touch targets, coarse-pointer hover suppression, PWA header treatment |
| `.is-android` | Safe-area/edge-to-edge layout, Material-style radii (`--rad: 20px`, `--rad-lg: 28px`), Roboto font, sidebar border removal |
| `.is-mobile` | Full-width/absolute sidebar, wider message bubbles, hidden scrollbars, selection disabled on chrome controls, larger smart replies |
| `.is-desktop` | Compact rows/buttons on precise pointers, smaller avatars, hover-revealed message copy button |
| `.is-pwa` | Frameless full-bleed layout and hidden install banner |
| `.is-electron` | Conversation-header drag region with no-drag controls; `.is-mac.is-electron` offsets the sidebar for macOS traffic lights |
| `.is-win` | Explicit `--s1` sidebar and conversation-header backgrounds |

---

## 11. i18n

- **Built-in**: English only — the inline reference table (921 keys, pure data) and runtime fallback
- **Locale files**: 81 files, `locales/<lang>.json` for af, am, ar, as, az, be, bg, bn, bs, ca, cs, cy, da, de, el, eo, es, et, eu, fa, fi, fr, fy, ga, gd, gl, gu, ha, he, hi, hr, hu, id, ig, is, it, ja, ka, kk, km, kn, ko, ky, lb, lo, lt, lv, mk, ml, mn, mr, ms, mt, my, nb, ne, nl, or, pa, pl, pt-BR, ro, ru, si, sk, sl, sr, sv, sw, ta, te, th, tl, tr, uk, ur, uz, vi, yo, zh-CN, zh-TW, fetched at boot and merged over English — 82 UI languages in total including English. `node tools/i18n-check.mjs` prints the live key count and per-locale coverage; at 2026-11-26 it reports all 81 locales at 100% (core and total). The active locale is auto-detected from `navigator.language` against `FULL_LOCALES`
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

*Generated: 2026-03-15 | Breeze v3.8.0 (CONFIG VERSION) | `validate.sh` prints the live index.html line count and `npm test` prints the live test counts*
