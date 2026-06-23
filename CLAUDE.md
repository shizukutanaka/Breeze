# Breeze Messenger — Claude Code Rules

Strictly follow ./AGENTS.md for full rules. Key points below.

## Architecture
**Deployed runtime** (ships to the browser as-is — keep single-file, framework-free,
zero runtime deps, vanilla JS): index.html (CSS+HTML+JS), _worker.js (Cloudflare
Worker), sw.js.
**Dev/test tree** (NOT shipped as modules): `src/crypto/*.js` are ESM **reference
implementations** of the crypto, exercised by `tests/` (vitest) + CI; `build.sh`
packages `breeze.zip`; `package.json` carries dev-only deps (vitest).

⚠ **MIRROR-DRIFT HAZARD**: index.html and _worker.js carry **hand-maintained inline
copies** of `src/crypto/*` (grep `inline mirror of src/crypto`). The 700+ tests verify
the *references*, NOT the inline copies — so a drift leaves tests GREEN while production
E2E silently breaks. When you touch ratchet/atrest/group/pow/franking/fingerprint/
negotiate logic, edit BOTH the inline copy AND `src/crypto/*`, then run `npm test`.

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
- No eval(); no new *runtime* deps; no separate .css/.js in the deployed artifact
  (the `src/crypto/*.js` ESM references are dev/test-only — not loaded by the browser)
- No .style.xxx for static styles — use CSS class
- No secrets in code — Worker env vars only
- No `a.href = URL.createObjectURL` — use `downloadBlob()`

## Validate
Always run after changes: `./validate.sh` (style/convention gate, currently 35/36 — 1 size warning)
Syntax check: `node -c _worker.js && node -c sw.js`
Crypto/worker changes: `npm test` (vitest) is the real correctness gate — validate.sh
only greps conventions, it never runs an encrypt/decrypt round-trip.

## P2P Architecture
- Dual-path: P2P DataChannel (instant) + Sealed Sender relay (reliable)
- Group: Sender Key O(1) + P2P direct + dedup via _replayCache
- Heartbeat: ping/pong 10s via state channel, 3 miss → ICE restart
- Sealed poll: 5min grace period + ACK pattern (crash-safe)
- Connection display: Direct/STUN/TURN + RTT + protocol

## Compaction
When compacting, preserve: current file paths, test/validation results, billing plan structure (Lite/Plus/Pro), crypto protocol decisions, i18n EN+JA parity (verify parity, not a fixed number — the count drifts every session).

## Key Files
- AGENTS.md — Full rules + examples (210 lines)
- SPEC.md — 75 compliance items (543 lines)
- CONTRIBUTING.md — Dev guide
- CHANGELOG.md — v3.6.0 session 2 changes (186 lines)
