# Breeze Messenger

[![CI](https://github.com/shizukutanaka/Breeze/actions/workflows/ci.yml/badge.svg)](https://github.com/shizukutanaka/Breeze/actions/workflows/ci.yml)
[![Release](https://github.com/shizukutanaka/Breeze/actions/workflows/release.yml/badge.svg)](https://github.com/shizukutanaka/Breeze/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/shizukutanaka?style=flat&logo=github)](https://github.com/sponsors/shizukutanaka)
[![Deploy to Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare%20Pages-F38020?logo=cloudflare)](https://dash.cloudflare.com/?to=/:account/pages/new/provider/polaris)

End-to-end encrypted P2P messenger. No phone number. No registration. No app store required.

> **Single HTML file** — deploys to Cloudflare Pages in 60 seconds. Runs at **$0/month**.

## Demo

Try the hosted version: **[breeze.pages.dev](https://breeze.pages.dev)**

```
1. Open in browser → enter your name → identity created (no server involved)
2. Share your Breeze ID or QR code with a friend
3. Messages flow directly between devices via WebRTC (P2P)
4. If P2P fails, sealed sender relay ensures delivery (server cannot read content)
```

## Quick Start

1. Deploy to Cloudflare Pages: `wrangler pages deploy . --project-name=breeze`
2. Open in browser → enter your name → share your Breeze ID
3. Add contacts by public key, @alias, or invite link

## Why Breeze?

| | Breeze | Others |
|---|--------|--------|
| **Registration** | None — identity = crypto key pair | Phone number required |
| **Server trust** | Zero-knowledge relay (can't read messages) | Trust the company |
| **Self-hosting** | 60-second deploy, $0/month | Not possible |
| **Open source** | MIT — fork, modify, sell | Proprietary or AGPL |
| **Architecture** | Single HTML file (13K lines) | Millions of lines, build systems |
| **Dependencies** | Zero (vanilla JS + WebCrypto) | Hundreds of npm packages |
| **Data location** | Your browser's IndexedDB | Their servers |

## Features

- **E2E encryption**: X25519 key exchange + AES-256-GCM + Double Ratchet + Ed25519 signing
- **P2P messaging**: WebRTC DataChannel with Perfect Negotiation + DC heartbeat
- **Voice/video calls**: WebRTC with TURN relay + real-time waveform
- **Groups**: Sender Key (O(1)) + Sealed Sender + dual-path P2P delivery
- **Files**: Up to 50MB, encrypted, auto-compress images (WebP), progress bar
- **Multi-account**: Work/personal separation (Free=1, Lite=2, Plus=4, Pro=unlimited)
- **924 languages**: Lazy-loaded, auto-detected
- **70 slash commands**: /help, /search, /export [json|csv|html|all], /schedule [list|cancel], /contacts, /compress, /retry, /security, /network, /peers, etc.
- **PWA**: Engagement-gated install, works offline, push notifications
- **6 platforms**: Web, Electron, Tauri (~5MB), Android (Capacitor), iOS
- **Security**: Trusted Types, CSP+COOP, magic bytes validation, key change warning
- **UX**: Swipe gestures, multi-select, markdown tables, smooth theme transition

## Architecture

```
Client (E2E encrypted)
  ├── IndexedDB (messages, contacts, keys)
  ├── WebRTC P2P (direct messaging)
  └── Worker API (signal relay only)

Cloudflare Worker
  ├── Signal relay (/api/signal)
  ├── Message relay (/api/msg/send, /poll)
  ├── Sealed Sender (/api/sealed/send, /poll)
  ├── Groups (create/join/info/rename/kick/admin/transfer/leave/delete)
  ├── Account management (slots, purchase, portal, delete)
  ├── Presence + TURN + Push
  └── Stripe billing

KV Storage
  ├── Signals, messages (TTL: ephemeral)
  ├── Licenses, slots (persistent)
  └── Aliases, PreKeys (persistent)
```

## Deploy

### $0 Self-Hosting (5 minutes)

Breeze runs entirely on Cloudflare's free tier. No credit card required.

```bash
# 1. Deploy
wrangler pages deploy . --project-name=breeze

# 2. Create KV namespace
wrangler kv:namespace create KV
# Add binding in Pages > Settings > Functions > KV

# 3. Done! Open https://breeze.pages.dev
```

That's it. TURN relay, translation, and all core features work with zero configuration.
See [.env.example](.env.example) for optional features (billing, AI, push notifications).
Full guide: [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md)

### Full Deployment (with billing + AI)

```bash
# Secrets (only if you want billing/AI/push)
wrangler secret put STRIPE_SECRET_KEY      # Billing
wrangler secret put VAPID_PUBLIC_KEY       # Push notifications
wrangler secret put GROQ_API_KEY           # AI (free tier)
# See .env.example for all options
```

### Desktop (Electron)

```bash
./build.sh desktop   # All platforms
./build.sh win       # Windows only
./build.sh mac       # macOS only
./build.sh linux     # Linux only
```

### Mobile (Capacitor)

```bash
./build.sh android   # APK
./build.sh ios       # Xcode project (macOS required)
```

## Cryptographic Stack

| Layer | Algorithm | Standard |
|-------|-----------|----------|
| Key Exchange | X25519 (fallback: P-256) | RFC 7748 |
| Signing | Ed25519 (fallback: HMAC-SHA256) | RFC 8032 |
| Encryption | AES-256-GCM | NIST SP 800-38D |
| KDF | HKDF-SHA256 | RFC 5869 |
| Ratchet | Double Ratchet | Signal Protocol |
| Group | Sender Key (O(1)) | Signal Protocol |
| Sender Privacy | Sealed Sender | Signal Protocol |

## Quality Gates

Run `./validate.sh` or `./build.sh validate`:

- Gate 1: Syntax (3 files)
- Gate 2: Security (eval, innerHTML, CSP, API keys)
- Gate 3: i18n (hardcoded strings, toast coverage)
- Gate 4: Code Quality (.style.X, onclick, DRY, DOM cache)
- Gate 5: Performance (lines, RAF, Fragment, throttle)
- Gate 6: Protocol Spec (6 crypto features)
- Gate 7: Required Files (10 files)

Current score: **33/36 (93%)**

## Development & Tests

The application source lives directly in the repository tree (`index.html`,
`_worker.js`, `sw.js`, …). The Cloudflare Pages build output dir is the repo
root (see `wrangler.toml`), so there is no bundling step.

```bash
npm ci            # install dev dependencies (vitest)
npm test          # run the unit test suite
./build.sh zip    # produce breeze.zip (build artifact, git-ignored)
```

Unit tests (`tests/`) cover the Cloudflare worker's security-critical logic
(rate limiting, proof-of-work, webhook idempotency, SSRF guard, prekey OTP
consumption) and the Double Ratchet crypto core (`src/crypto/ratchet.js`:
round-trip, out-of-order/skipped keys, large-gap recovery, replay rejection).
CI runs syntax checks, `npm test`, `validate.sh`, and uploads `breeze.zip`.

> `breeze.zip` is a build artifact (produced by `./build.sh zip`), not tracked
> in git. The repository tree is the source of truth.

## Business Model

Breeze uses an **open-core** model: the full messenger is MIT-licensed and free to self-host.

| Feature | Free (self-host) | Hosted (breeze.pages.dev) |
|---------|-----------------|--------------------------|
| E2E encrypted messaging | ✓ | ✓ |
| P2P + sealed sender | ✓ | ✓ |
| Voice/video calls | ✓ | ✓ |
| Groups (100 members) | ✓ | ✓ |
| 924 languages | ✓ | ✓ |
| Multi-account | 1 account | Lite: 2 / Plus: 4 / Pro: ∞ |
| AI assistant | Bring your own key | Included (Groq free) |
| Custom domain | ✓ | ✗ |
| Your own KV | ✓ | Shared |

### Pricing (hosted instance only)

| Plan | Price | Accounts | Extras |
|------|-------|----------|--------|
| Free | $0/month | 1 | Core features |
| Lite | $0.99/month | 2 | — |
| Plus | $5.99/month | 4 | Priority relay |
| Pro | $19.99/month | Unlimited | Priority relay + TURN |

Revenue goes to: infrastructure costs → development → security audits.

## Running Costs

| Component | Free Tier | Paid ($5/mo) |
|-----------|-----------|-------------|
| Hosting | Cloudflare Pages Free | — |
| Worker | 100K req/day | 10M req/mo |
| KV | 100K reads + 1K writes/day | 10M reads + 1M writes/mo |
| TURN | Open Relay (20GB free) | Cloudflare Calls ($0.05/GB) |
| STUN | Cloudflare + Google (free) | — |
| Translation | MyMemory (5K chars/day) | DeepL ($0) |
| AI | Groq free (30 RPM) | Anthropic/OpenAI |
| Push | Web Push VAPID (free) | — |
| Domain | *.pages.dev (free) | Custom ($10/yr) |
| **Total** | **$0/month** | **$5/month** |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

- Report bugs: [Issue Tracker](https://github.com/shizukutanaka/Breeze/issues)
- Security: [SECURITY.md](SECURITY.md) (private disclosure)
- Code of Conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Sponsors

Breeze is built and maintained by volunteers. If you find it useful, please consider sponsoring:

- [GitHub Sponsors](https://github.com/sponsors/shizukutanaka)
- [Ko-fi](https://ko-fi.com/breeze_messenger)
- Use the hosted version at [breeze.pages.dev](https://breeze.pages.dev/?pricing)

## License

MIT — see [LICENSE](LICENSE)
