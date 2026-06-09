# Breeze Messenger — Detailed Specification v3.6.0

**Document version**: 2026-03-14 R210
**Status**: Production-ready
**Total codebase**: 13,116 (client) + 1,930 (worker) + 145 (SW) = 15,191 lines

---

## 1. Product Overview

Breeze is a serverless, end-to-end encrypted P2P messenger deployed as a single HTML file on Cloudflare Pages. Messages travel directly between devices via WebRTC; the server only relays connection signals. No phone number, email, or app store required.

### 1.1 Design Philosophy

| Principle | Source | Application |
|-----------|--------|-------------|
| Performance-first, data-oriented | John Carmack | _DOM cache, _H constant, MS.* time constants, CONFIG centralization |
| Clean architecture, SOLID | Robert C. Martin | Single-responsibility functions, DRY helpers (postAPIRaw, _signal, _autoHeight) |
| Simplicity, composition | Rob Pike | Single HTML file, no build step, no framework, no external AI dependency |

### 1.2 File Inventory (83 files)

| File | Size | Purpose |
|------|------|---------|
| index.html | 476 KB | Client: UI + CSS + JS (single file) |
| _worker.js | 45 KB | Cloudflare Worker: API + billing + signals |
| sw.js | 3 KB | Service Worker: offline cache + push |
| lang.js | 570 KB | 924 languages (lazy-loaded) |
| manifest.json | 2 KB | PWA manifest |
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
| Lock Screen KDF | PBKDF2-SHA256 | 600,000 iter | NIST SP 800-132 |
| Forward Secrecy | Double Ratchet | — | Signal Protocol |
| Group Encryption | Sender Key O(1) | — | Signal Protocol |
| Sender Privacy | Sealed Sender | — | Signal Protocol |
| Anti-Spam | Proof-of-Work (hashcash) | 16-bit | — |
| Replay Protection | LRU cache (2,000 entries) + IDB dedup | — | — |

### 2.2 Key Management

- **Identity Key Pair**: X25519 (or P-256), generated on first setup, stored in IDB `identity` store
- **Signed PreKey (SPK)**: Uploaded to server, rotated periodically
- **One-Time PreKeys (OTP)**: 10 keys generated, auto-replenished when < 5 remain
- **Session Rekey**: After 500 messages OR 1 hour (CONFIG.REKEY_MSG_THRESHOLD / REKEY_TIME_MS)
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
- Planned hybrid: X25519 + ML-KEM-768
- Status: monitoring, no runtime dependency

---

## 3. Network Architecture

### 3.1 Connection Model

```
                    ┌──────────────┐
     ┌──────────────│  Cloudflare  │──────────────┐
     │   Signal     │   Worker     │   Signal      │
     │   Relay      │  (1,063 LOC) │   Relay       │
     │              └──────────────┘               │
     │                     │                       │
     │              ┌──────┴──────┐                │
     │              │  KV Storage │                │
     │              └─────────────┘                │
     │                                             │
  ┌──┴──┐          WebRTC P2P            ┌────────┴┐
  │User A│◄═════════════════════════════►│ User B  │
  │(10K) │   DataChannel (encrypted)     │ (10K)   │
  └──────┘                               └─────────┘
```

### 3.2 Worker API Endpoints (32)

| Endpoint | Rate Limit | Purpose |
|----------|------------|---------|
| /api/signal | 60/min | WebRTC signaling relay |
| /api/msg/send | 30/min | Relay message (fallback when P2P unavailable) |
| /api/msg/poll | 40/min | Poll for relay messages |
| /api/sealed/send | 30/min | Sealed Sender message |
| /api/sealed/poll | 40/min | Poll sealed messages |
| /api/presence | 20/min | Online presence heartbeat |
| /api/alias/set | default | Register @username |
| /api/alias/get | default | Resolve @username to public key |
| /api/prekey/upload | 5/min | Upload PreKeys |
| /api/prekey/fetch | default | Fetch target's PreKeys |
| /api/group/create | default | Create group |
| /api/group/join | default | Join group via token |
| /api/group/info | default | Get group metadata |
| /api/group/kick | default | Remove group member |
| /api/push/subscribe | default | Web Push subscription |
| /api/turn | default | TURN credential request |
| /api/ogp | 20/min | Open Graph Protocol link preview |
| /api/online | default | Online user count |
| /api/portal | default | Stripe customer portal |
| /api/account/purchase | default | Additional account purchase |
| /api/account/slots | default | Account slot query |
| /api/backup/upload | 2/min | Encrypted backup upload |
| /api/backup/download | 5/min | Encrypted backup download |
| /api/sealed/ack | default | Acknowledge sealed message delivery |
| /api/drop/create | default | Create file drop (encrypted transfer) |
| /api/drop/read | default | Download file drop |
| /api/ai | 5/min | AI assistant (operator-gated) |
| /api/translate | 10/min | Message translation (operator-gated) |
| /api/abuse/record | default | Record abuse metadata for reporting |
| /api/abuse/report | default | Submit abuse report |
| /api/health | unlimited | Health check (no auth) |
| /api/webhook | unlimited | Stripe webhook receiver |

### 3.3 Worker Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| KV | Yes | Cloudflare KV namespace binding |
| STRIPE_SECRET_KEY | For billing | Stripe API secret |
| STRIPE_WEBHOOK_SECRET | For billing | Stripe webhook verification |
| STRIPE_PRICE_LITE | For billing | Lite plan price ID ($0.99/mo) |
| STRIPE_PRICE_PLUS | For billing | Plus plan price ID ($5.99/mo) |
| STRIPE_PRICE_PRO | For billing | Pro plan price ID ($19.99/mo) |
| VAPID_PUBLIC_KEY | For push | Web Push VAPID public key |
| VAPID_PRIVATE_KEY | For push | Web Push VAPID private key |
| TURN_URL | Recommended | TURN server URL |
| TURN_SECRET | Recommended | TURN server secret |
| TURN_USERNAME | Optional | TURN static username |
| TURN_CREDENTIAL | Optional | TURN static credential |

### 3.4 Adaptive Networking

`_adaptiveConfig` automatically adjusts based on `NetworkInformation.effectiveType`:

| Connection | Compress Threshold | Poll Interval | Image Quality |
|------------|-------------------|---------------|---------------|
| 4g / WiFi | 256 bytes | 5,000 ms | 85% |
| 3g | 128 bytes | 8,000 ms | 70% |
| 2g / Save-Data | 64 bytes | 15,000 ms | 50% |

---

## 4. Client Architecture

### 4.1 IndexedDB Schema (Version 5)

| Store | Key | Indexes | Purpose |
|-------|-----|---------|---------|
| identity | string key | — | Key pairs, PreKeys, settings |
| contacts | id (keyPath) | — | Contact list |
| messages | msgId (keyPath) | contact (contactId), ts, contact_ts ([contactId, ts]) | Message history |
| audit | id (autoIncrement) | ts, type | Security audit log |
| settings | string key | — | User preferences |

### 4.2 CONFIG Constants (45 unique)

```javascript
VERSION: '3.5.0'              PROTOCOL_VERSION: 4
POLL_FAST_MS: 3000            POLL_SLOW_MS: 15000
PRESENCE_INTERVAL_MS: 10000   TYPING_THROTTLE_MS: 2000
TYPING_TIMEOUT_MS: 5000       CALL_TIMEOUT_MS: 60000
FILE_MAX: 52428800 (50MB)     GROUP_MAX: 100
MAX_MSG_LENGTH: 10000         CHUNK_SIZE: 16384
DC_BUFFER_MAX: 262144         HEALTH_CHECK_MS: 15000
REPLAY_CACHE_SIZE: 2000       MSG_DOM_LIMIT: 200
MSG_PAD_BOUNDARY: 256         PREKEY_OTP_COUNT: 10
ICE_CANDIDATE_POOL_SIZE: 2    PBKDF2_ITERATIONS: 600000
HKDF_HASH: 'SHA-256'          AES_KEY_BITS: 256
IV_BYTES: 12                   PREFERRED_CURVE: 'X25519'
SESSION_RESET_THRESHOLD: 3
TOAST_DURATION_MS: 2000       BANNER_HIDE_MS: 2000
FADE_OUT_MS: 300              DEBOUNCE_MS: 800
DISAPPEAR_CHECK_MS: 30000     SMART_REPLY_HIDE_MS: 30000
CLEANUP_INTERVAL_MS: 3600000  AUTO_BACKUP_MS: 86400000
POW_DIFFICULTY: 16            REKEY_MSG_THRESHOLD: 500
REKEY_TIME_MS: 3600000        RECONNECT_BASE_MS: 1000
RECONNECT_MAX_MS: 60000       RECONNECT_MAX_ATTEMPTS: 8
COMPRESS_MIN_BYTES: 256
```

### 4.3 DRY Helper Functions

| Helper | Replaces | Instances |
|--------|----------|-----------|
| `_DOM.get(id)` | `document.getElementById(id)` | 131 calls (memoized) |
| `_H` | `{ 'Content-Type': 'application/json' }` | 50+ refs |
| `MS.*` | Time magic numbers (86400000 etc.) | 45 refs |
| `postAPIRaw(path, body)` | `fetchT(API + path, { method: 'POST', headers: _H, body: ... })` | 34 calls |
| `postAPI(path, body)` | Same, returns parsed JSON | 2 calls |
| `_signal(room, type, data)` | Signal POST (fire-and-forget) | 12 calls |
| `_signalAwait(room, type, data)` | Signal POST (returns Response) | 3 calls |
| `_dmRoom(peerId)` | `'dm:' + [myId, peerId].sort().join(':')` | 4 calls |
| `_autoHeight(el, maxPx)` | Textarea auto-resize pattern | 3 calls |
| `_updateTitle(unreadCount)` | `document.title = ...` | 3 calls |
| `_defer(fn)` | `requestIdleCallback(fn)` or `setTimeout(fn, 100)` | 2 calls |

### 4.4 CSS Design System

**17 CSS Custom Properties:**

| Property | Purpose | Dark Value |
|----------|---------|------------|
| --bg | Background | #0a0a0a |
| --s1 | Surface 1 | #111 |
| --s2 | Surface 2 | #1a1a1a |
| --s3 | Surface 3 | #222 |
| --t1 | Text primary | #f5f5f5 |
| --t2 | Text secondary | #aaa |
| --t3 | Text tertiary | #666 |
| --g | Green accent | #10b981 |
| --gl | Green light | #34d399 |
| --gd | Green dark | #059669 |
| --r | Red/error | #ef4444 |
| --b1 | Border | #222 |
| --rad | Border radius | 8px |
| --font | Font family | system-ui |
| --mono | Monospace | 'SF Mono', monospace |
| --ease | Transition | all .15s ease |
| --touch | Touch min-size | 44px |

**83 CSS Utility Classes** (`.i-*` prefix):
Layout (12), Typography (18), Color (8), Spacing (10), State (6), Component-specific (29).

---

## 5. Slash Commands (52 exact + 18 startsWith = 70 total)

### 5.1 Messaging

| Command | Description |
|---------|-------------|
| /search `<text>` | Search messages in current chat |
| /searchall `<text>` | Search across all chats |
| /reply `<id>` | Reply to specific message |
| /pin | Pin/unpin last message |
| /pins | Show pinned messages |
| /poll `Q \| A \| B \| C` | Create inline poll |
| /timer `<time>` | Set disappearing messages |
| /schedule `<time> <msg>` | Schedule message |
| /reactions | Show reaction stats |
| /export | Export chat as JSON |
| /import | Import chat from JSON |

### 5.2 Contacts & Groups

| Command | Description |
|---------|-------------|
| /info | Contact/group details |
| /members | List group members |
| /invite | Generate invite link |
| /newgroup `<name>` | Create group |
| /rename `<name>` | Rename group |
| /label `<labels>` | Tag contact with labels |
| /sort `<method>` | Sort contacts (name/unread/recent) |
| /mute | Toggle mute |
| /archive | Toggle archive |
| /unblock | Unblock contact |

### 5.3 Security & Privacy

| Command | Description |
|---------|-------------|
| /security | Cryptographic stack details |
| /verify | Compare safety numbers |
| /lock | Lock screen with password |
| /sessions | Active session list |
| /audit | Security audit log |
| /retention `<days>` | Set message retention policy |
| /gdpr | GDPR data export (Art. 15/20) |
| /wipe | Remote wipe (all devices) |
| /panic | Emergency: wipe all local data |

### 5.4 Diagnostics

| Command | Description |
|---------|-------------|
| /network | Connection health dashboard |
| /peers | P2P peer RTT + bandwidth stats |
| /storage | IndexedDB + SW + quota stats |
| /perf | Performance API dashboard |
| /billing | Account slots + billing info |
| /about | Version + protocol + build info |
| /uptime | Session uptime |
| /debug | Toggle debug mode |
| /whoami | Identity + alias + public key |

### 5.5 UI & Settings

| Command | Description |
|---------|-------------|
| /theme `<dark\|light\|auto>` | Theme switch |
| /wallpaper `<color>` | Chat wallpaper |
| /settings | Open settings panel |
| /sound | Toggle notification sound |
| /help | Full command list |
| /keyboard | Keyboard shortcuts |
| /qr | Show QR code for contact sharing |
| /share | Share Breeze ID + invite link |
| /summarize | Local extractive conversation summary |

---

## 6. Billing Model

| Item | Price | Type | Stripe |
|------|-------|------|--------|
| 1st account | Free | — | — |
| Lite (+1 account) | $0.99/month | Subscription | STRIPE_PRICE_LITE |
| Plus (+3 accounts) | $5.99/month | Subscription | STRIPE_PRICE_PLUS |
| Pro (unlimited) | $19.99/month | Subscription | STRIPE_PRICE_PRO |

All features included for every account. No feature gating. No Pro tier.

---

## 7. Platform Support (11 targets)

| Platform | Technology | Build Command |
|----------|-----------|---------------|
| Web (PWA) | Cloudflare Pages | `wrangler pages deploy .` |
| Windows | Tauri (NSIS + MSI, ~5MB) | `cd tauri && npx @tauri-apps/cli build` |
| macOS | Tauri (DMG universal, ~8MB) | `cd tauri && npx @tauri-apps/cli build` |
| Linux | Tauri (AppImage/deb/rpm, ~5MB) | `cd tauri && npx @tauri-apps/cli build` |
| Windows (alt) | Electron (NSIS, ~150MB) | `cd desktop && npx electron-builder --win` |
| macOS (alt) | Electron (DMG, ~150MB) | `cd desktop && npx electron-builder --mac` |
| Linux (alt) | Electron + Flatpak + Snap | `cd desktop && npx electron-builder --linux` |
| Android | Capacitor (APK) | `cd mobile && ./scripts/build-mobile.sh android` |
| iOS | Capacitor (Xcode) | `cd mobile && ./scripts/build-mobile.sh ios` |
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
| 5. Performance | Lines < 12K, RAF >= 2, Fragment >= 1, throttle | Met |
| 6. Protocol Spec | 6 crypto features verified | Met |
| 7. Required Files | 10 files exist | Met |

**Current score: 35/35 (100%)**

---

## 10. Performance Optimizations

| Optimization | Impact |
|-------------|--------|
| _DOM.get() memoized cache | 131 getElementById calls cached with isConnected validation |
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
| Frosted glass layers | iOS HIG | `backdrop-filter: blur(20px) saturate(1.5)` on 7 surfaces |
| Bouncy micro-interactions | Nintendo Switch UI | `cubic-bezier(.34,1.56,.64,1)` on 20+ elements |
| Spring physics feel | Web Animation Best Practices | `:active { transform: scale(.88) }` press-in |
| Haptic feedback | iOS Taptic Engine | 5 patterns: tap/send/success/error/notify |

### Animations (8 named keyframes)

| Animation | Trigger | Feel |
|-----------|---------|------|
| `msgBounce` | New message | Spring overshoot entry |
| `ctxPop` | Context menu open | Pop from center |
| `badgePop` | Notification badge | Scale from 0 |
| `toastBounce` | Toast notification | Spring drop-in |
| `modalSlide` | Modal open | Slide up + bounce |
| `overlayFade` | Overlay open | Fade in |
| `recPulse` | Voice recording | Breathing pulse |
| `recWave` | Voice waveform | Equalizer bars |

### Platform-Specific CSS (54 rules)

| Target | Rules | Key Adaptations |
|--------|-------|----------------|
| `.is-ios` | 16 | Safe area insets, 44pt targets, rubber-band scroll, hover disabled |
| `.is-android` | 15 | Material You radii (20px), Roboto font, edge-to-edge |
| `.is-mobile` | 8 | Full-width sidebar, hidden scrollbars, selection disabled |
| `.is-desktop` | 7 | Compact targets, hover msg-copy, pointer precision |
| `.is-pwa` | 5 | Frameless, install banner hidden |
| `.is-electron` | 3 | Drag region, Mac traffic light offset |

---

## 11. i18n

- **Built-in**: English (372 keys), Japanese (372 keys)
- **External**: 924 languages via lang.js (lazy-loaded, 570 KB, gzip ~33 KB)
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
| Proof-of-Work | ✓ Implemented | 16-bit hashcash |
| Session auto-rekey | ✓ Implemented | 500 msgs / 1 hour |
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
| AI/translate proxy | ✓ v3.6.0 | Claude/GPT/Groq + DeepL/Google/Libre |
| Tauri desktop | ✓ v3.6.0 | Rust binary ~5MB |
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
| Post-quantum (ML-KEM) | △ Deferred | Browser support ~2027 |

---

*Generated: 2026-03-15 | Breeze v3.6.0 | 13,943 total lines*
