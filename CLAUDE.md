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

**Deployed vs reference-only** — NOT every `src/crypto/*` module ships. Confusing the two can
make the codebase look more capable than the artifact is, so the table below is the authority
on what actually runs. (One correction, measured: the deployed safety number is **not** weak.
Each displayed group is `(b[2i]<<8|b[2i+1]) % 100000`, and a 16-bit value maxes at 65535 <
100000, so the modulo is the IDENTITY — all 12 bytes = **96 bits** are shown, ~2^96 work to
grind a colliding key. `fingerprint.js` adds iterations, 60 digits and identifier binding, but
is an enhancement, not a fix; see its header for why it must ride along with a capability
negotiation rather than migrate the display on its own.)

| Module | Status | Mirror-drift guarded |
|---|---|---|
| `atrest.js`, `pow.js`, `ratchet.js` (KDF + group v5) | **deployed** (inline mirror; `GROUP_RATCHET_V5` default **ON** since v3.6.1 — the N-party AND-rule negotiation holds a group on v3 whenever any member is legacy) | ✅ yes |
| `ratchet.js` authenticated X3DH (v5 handshake, `CONFIG.X3DH_V5_ENABLED`, default **ON** since v3.6.1) | **deployed** (inline mirror; SPK signing now matches the reference — signs raw SPK bytes, not the base64 string via signMessage/verifySignature. That divergence was a real bug, not deliberate: the Worker's own verifyEd25519 in handlePreKeyUpload base64-decodes before checking, so a UTF-8-string signature always failed it — E2E-found) | ✅ yes |
| `ktlog.js` audit path (`_auditKeyHistory`, wired into `initSessionV5Initiator` — warns, doesn't block) | **deployed** (inline mirror of the full `auditBundle`: `verifyChain` hash-chain tamper check + `checkRollover`; verdict `tampered`>`rolled`>`new`>`ok`, and a tampered chain is NOT pinned. Only the log-APPEND path `appendChainEntry` stays reference-only — the client verifies, the Worker appends) | ✅ yes (full auditBundle parity, incl. tampered-chain) |
| `ratchet.js` **key commitment (I16)** — `keyCommitment` + its `p.cm` checks | **deployed** (inline `_keyCommit`/`_cmOk`; AES-GCM is not key-committing, so `cm = HKDF(msgKey, 0³², 'breeze-commit', 32)` binds each ciphertext to ONE key — invisible-salamanders/AEAD-partitioning defense, and the wire groundwork for franking I17. Wire MUST stay `arr()` to match the reference — an early inline draft shipped base64 and mirror-drift caught it. Verify-if-present, so legacy senders with no `cm` still decrypt) | ✅ yes (byte-parity + wire shape + tamper-rejected + legacy-accepted) |
| `fingerprint.js` (Signal iterated safety number) | reference-only — an **enhancement**, not a fix: the deployed number already shows 96 bits (see note above). Deploy only alongside a capability negotiation, or two client versions show different numbers and users read that as a MITM alarm | tripwire only |
| `franking.js` **commitment (I17)** — `Cf = HMAC(Kf, plaintext)` | **deployed** (inline `_frankKey`/`_frankCommit` + report UI; relay verifies via `hmacVerifyFrank`). Deliberate divergence from the reference: **Kf is DERIVED** `HKDF(msgKey,0³²,'breeze-frank',32)` instead of drawn randomly and shipped — both sides already hold `msgKey`, so only the opaque `frankId` goes on the wire and old clients ignore it. Limit: symmetric franking can't bind a *malicious* sender (they can skip `/abuse/record`); it stops forged reports | ✅ yes (commitment parity + binding); factory/`verifyReport` still tripwire-only |
| `pq.js` (PQXDH hybrid X25519+ML-KEM-768) | reference-only (roadmap R1) — KEM is **injected**, never hand-rolled; blocked on browsers shipping ML-KEM (~2027). The client today only *detects* ML-KEM (`_hasPQ`), it never key-agrees with it | tripwire only |
| `seal.js` **Sealed Sender v2** — `sealMeta`/`unsealMeta` | **deployed** (inline mirror; ECIES-style: ephemeral X25519 → HKDF `breeze-seal-v2` → AES-GCM, AAD binds to+ts). Sender metadata — incl. the X3DH pkm header's `ik`, relocated as `_pkik` (wiretap-E2E-found first-contact leak) — is encrypted to the recipient; caps-gated (`seal-v2` via `/prekey/status`, no OTP cost); `/msg` fallback + retry queue stay legacy | ✅ yes (cross-seal/unseal both directions + AAD parity + leak check) |
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
Always run after changes: `./validate.sh` (style/convention gate, currently 39 checks — 38 pass + 1 informational size warning). It also gates dead i18n keys and unreachable functions.
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
