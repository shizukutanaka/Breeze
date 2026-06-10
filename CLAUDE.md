# Breeze Messenger — Claude Code Rules

Strictly follow ./AGENTS.md for full rules. Key points below.

## Architecture
Single-file app: index.html (CSS+HTML+JS), _worker.js (Cloudflare Worker), sw.js.
No build step. No framework. No npm dependencies. Vanilla JS only.
v3.6.0: 13,116 client + ~2,200 worker + 145 SW lines. 36 API endpoints. 420 i18n keys (EN+JA).

## Must Use
- `t('key')` for ALL UI text (never hardcode English)
- `_DOM.get('id')` for DOM (never raw getElementById)
- `postAPIRaw(path, body)` for API calls (never raw fetchT)
- `esc()` for user text in innerHTML (XSS prevention)
- `safeSetHTML(el, html)` for command output (Trusted Types)
- `downloadBlob(blob, name)` for file downloads (DRY + auto cleanup)
- `MS.HOUR`, `MS.DAY` for time (never magic numbers)
- `.swiping` / `.swipe-back` CSS for touch animations (not .style.transition)
- `_H` constant for JSON headers
- `sanitizeString()` in Worker for all user KV inputs

## Never
- No hardcoded colors, English strings, or magic numbers
- No eval(), no new dependencies, no separate .css/.js files
- No .style.xxx for static styles — use CSS class
- No secrets in code — Worker env vars only
- No `a.href = URL.createObjectURL` — use `downloadBlob()`

## Validate
Always run after changes: `./validate.sh` (must pass 35/35)
Syntax check: `node -c _worker.js && node -c sw.js`

## P2P Architecture
- Dual-path: P2P DataChannel (instant) + Sealed Sender relay (reliable)
- Group: Sender Key O(1) + P2P direct + dedup via _replayCache
- Heartbeat: ping/pong 10s via state channel, 3 miss → ICE restart
- Sealed poll: 5min grace period + ACK pattern (crash-safe)
- Connection display: Direct/STUN/TURN + RTT + protocol

## Compaction
When compacting, preserve: current file paths, test/validation results, billing plan structure (Lite/Plus/Pro), crypto protocol decisions, i18n key count (406).

## Key Files
- AGENTS.md — Full rules + examples (210 lines)
- SPEC.md — 75 compliance items (543 lines)
- CONTRIBUTING.md — Dev guide
- CHANGELOG.md — v3.6.0 session 2 changes (186 lines)
