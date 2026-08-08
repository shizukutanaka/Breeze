# Breeze Messenger — Claude Code Rules

Strictly follow ./AGENTS.md for full rules. Key points below.

## Architecture
**Deployed runtime** (ships to the browser as-is — keep single-file, framework-free,
zero runtime deps, vanilla JS): index.html (CSS+HTML+JS), _worker.js (Cloudflare
Worker), sw.js.
**Dev/test tree** (NOT shipped as modules): `src/crypto/*.js` are ESM **reference
implementations** of the crypto, exercised by `tests/` (vitest) + CI; `build.sh`
packages `breeze.zip`; `package.json` carries dev-only deps (vitest).

⚠ **MIRROR-DRIFT HAZARD**: some `src/crypto/*` modules have **hand-maintained inline
copies** in index.html/_worker.js (grep `inline mirror of src/crypto`). The tests verify
the *references*, NOT the inline copies — so a drift leaves tests GREEN while production
E2E silently breaks. When you touch a **deployed** module's logic, edit BOTH the inline
copy AND `src/crypto/*`, then run `npm test`. `tests/mirror-drift.test.js` cross-tests the
inline copies against the references and will catch a drift.

**Deployed vs reference-only** — NOT every `src/crypto/*` module ships. Confusing the two
makes the codebase look more secure than the artifact is (e.g. the deployed safety number
is a single SHA-256 over 12 bytes; `fingerprint.js`'s iterated 5200×SHA-512 is un-deployed):

| Module | Status | Mirror-drift guarded |
|---|---|---|
| `atrest.js`, `pow.js`, `ratchet.js` (KDF + group v5) | **deployed** (inline mirror) | ✅ yes |
| `ratchet.js` authenticated X3DH (v5 handshake, `CONFIG.X3DH_V5_ENABLED`, default **off**) | **deployed** (inline mirror; SPK signing now matches the reference — signs raw SPK bytes, not the base64 string via signMessage/verifySignature. That divergence was a real bug, not deliberate: the Worker's own verifyEd25519 in handlePreKeyUpload base64-decodes before checking, so a UTF-8-string signature always failed it — E2E-found) | ✅ yes |
| `ktlog.js` audit path (`_auditKeyHistory`, wired into `initSessionV5Initiator` — warns, doesn't block) | **deployed** (inline mirror of the full `auditBundle`: `verifyChain` hash-chain tamper check + `checkRollover`; verdict `tampered`>`rolled`>`new`>`ok`, and a tampered chain is NOT pinned. Only the log-APPEND path `appendChainEntry` stays reference-only — the client verifies, the Worker appends) | ✅ yes (full auditBundle parity, incl. tampered-chain) |
| `ratchet.js` **key commitment (I16)** — `keyCommitment` + its `p.cm` checks | **deployed** (inline `_keyCommit`/`_cmOk`; AES-GCM is not key-committing, so `cm = HKDF(msgKey, 0³², 'breeze-commit', 32)` binds each ciphertext to ONE key — invisible-salamanders/AEAD-partitioning defense, and the wire groundwork for franking I17. Wire MUST stay `arr()` to match the reference — an early inline draft shipped base64 and mirror-drift caught it. Verify-if-present, so legacy senders with no `cm` still decrypt) | ✅ yes (byte-parity + wire shape + tamper-rejected + legacy-accepted) |
| `fingerprint.js` (Signal iterated safety number) | reference-only (roadmap) | tripwire only |
| `franking.js` | reference-only (roadmap) | tripwire only |
| `pq.js` (PQXDH hybrid X25519+ML-KEM-768) | reference-only (roadmap R1) — KEM is **injected**, never hand-rolled; blocked on browsers shipping ML-KEM (~2027). The client today only *detects* ML-KEM (`_hasPQ`), it never key-agrees with it | tripwire only |
| `negotiate.js` | **fully inline**: both `negotiate()` (2-party, `_peerSupportsX3dhV5`) and `negotiateGroup()` (N-party AND rule, `_negotiateGroupCaps`/`_computeGroupV5`, wired into `getGroupSenderKey`'s lazy format-freeze + the kick re-negotiation trigger) hand-ported next to the X3DH block. `_capabilities` stays separate (local crypto/idb presence checks, unrelated concept despite the similar name) | ✅ yes (both) |

"Reference-only" = tested + ready but never wired in; deploying any is a **breaking** wire/
display change needing coordinated rollout. `tests/mirror-drift.test.js`'s reference-drift
block pins this status: when a roadmap module gets deployed its marker starts matching,
the tripwire test fails, and you must update this table + add a real mirror-drift guard.

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
