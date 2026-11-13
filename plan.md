# Breeze — Hardening Plan

Living plan for the code-review follow-up work. The app source (`index.html`,
`_worker.js`, `sw.js`, plus the `src/crypto/*` references) is tracked in this
repo and edited in place; `build.sh` packages the shipped `breeze.zip` from it.
(An earlier version of this plan described a zip-only workflow — superseded.)

**Status legend:** ✅ done · 🛠️ in this iteration · ⏸️ deferred (needs protocol
version bump or design/validation) · 🔎 needs more investigation

---

## 1. Shipped in PR #1 (merged) — ✅

| # | File | Issue | Fix |
|---|------|-------|-----|
| 1 | `_worker.js` | Rate limiter read bare globals (`_rateLimitMap`) → `ReferenceError` under ESM strict mode before the try/catch → **every rate-limited API request 500'd** when KV was bound | `globalThis._rateLimitMap ||= …`; dropped unreliable Workers `setInterval` for opportunistic pruning |
| 2 | `_worker.js` | Message dedup keyed on a 10 s time bucket dropped distinct messages sent within 10 s | Re-keyed dedup on payload content |
| 3 | `_worker.js` | Alias Proof-of-Work never verified (presence-only check) | Re-derive `SHA-256(challenge:nonce)`, enforce difficulty, bind challenge to pubkey |
| 4 | `_worker.js` | Stripe webhook marked event processed **before** handling → lost slot grants on retry | Process-then-mark |
| 5 | `_worker.js` | OGP SSRF guard only blocked `127.0.0.1` | Broadened to `127.0.0.0/8` |
| 6 | `sw.js` | Cache-trim evicted the precached app shell first → broken offline launch | Preserve `ASSETS`, trim only runtime entries |
| 7 | `index.html` | Unguarded `JSON.parse` on poll messages blanked the whole conversation | Wrapped in safe parse |
| 8 | packaging | Missing root `icon-192/512.png` → atomic SW `addAll()` install failed; `build.sh` exited 1 | Added icons at root |

---

## 2. This iteration — ✅

Contained, backward-compatible fixes (no wire-format change). Verified by static
reasoning + targeted Node harnesses; **full E2E validation still pending** (see §5).

**Status (audited 2026-11-12):** all five items were found already implemented
in the deployed code — they landed with the source import and the v3.6
hardening passes, before this plan was updated. This iteration therefore did
not rewrite working crypto/lifecycle code; it verified each item against the
approach below and pinned the behaviours with regression tests
(`tests/hardening-iteration2.test.js`; A is additionally covered behaviourally
by `tests/ratchet.test.js` against the reference port in `src/crypto/ratchet.js`).
The two-device manual pass in §5 is still outstanding.

Where each item lives now:

- **A** — `index.html` `_decryptFromRaw`: `MAX_GAP = 2000` reject, staged
  full-gap advance (receive state committed only after the key-commitment and
  AEAD checks pass), retention of the most recent `MAX_SKIP = 100` skipped
  keys, timestamped for the TTL expiry pass.
- **B** — `index.html` `peerState.transition`: the `CLOSED` branch clears
  `_healthTimer` / `_heartbeat` / `_sigPoll`; all three intervals are stored
  on `peerState` at creation (`peerState._sigPoll = sigPoll`).
- **C** — `index.html` service-worker registration: `hadController` captured
  at load; `controllerchange` reloads only when the page was already
  controlled (plus a `refreshing` re-entry guard).
- **D** — `index.html` error boundary: `_FATAL_WINDOW_MS` (60 s) sliding-window
  reset of `_fatalErrors`/`_errorCount` in both the `error` and
  `unhandledrejection` handlers.
- **E** — `index.html` `handleIncoming`: TOFU pin of `contact.sigPub` on first
  sighting; a mismatch flags `meta.tampered` and raises the key-change
  warning, and verification runs only when not tampered. The signed-SDP path
  in the signaling poll enforces the same pin.

| # | File / anchor | Issue | Approach |
|---|---------------|-------|----------|
| A | `index.html` `decryptFrom` (~4673) | **Ratchet desync.** Skipped-key loop capped advance at `MAX_SKIP` but still set `recvCounter = p.c`, so once a >100-message gap appeared the receive chain was misaligned and **all subsequent messages failed to decrypt permanently** | Advance the chain by the *full* gap (bounded by a hard DoS limit) so `recvCounter` only jumps when key material actually aligns; retain at most `MAX_SKIP` skipped keys; reject absurd gaps instead of desyncing |
| B | `index.html` `peerState.transition` (~8595) + sigPoll (~8948) | **Interval leaks.** The 10 s heartbeat and the 2 s signaling-poll `setInterval`s were not cleared on teardown/reconnect, so flaky links accumulated zombie loops hammering `/signal` and pinging dead channels | Centralize cleanup in the `CLOSED` transition (every teardown path already calls it); store `_sigPoll` on `peerState` |
| C | `index.html` `controllerchange` (~2241) | First-ever SW (uses `skipWaiting` + `clients.claim`) claims the page on first visit → unexpected full reload mid-session | Only reload when replacing an **existing** controller (guard on `hadController` captured at load) |
| D | `index.html` error boundary (~2362) | `_fatalErrors` accrues for the whole session and never resets → 3 unrelated benign errors over hours spuriously trigger the crash overlay | Sliding window: reset the counter when the previous error was >60 s ago, so only a genuine burst trips the overlay |
| E | `index.html` signature check (~8537) | **Forgeable "verified" badge.** Per-message Ed25519 signature was checked against the `sigPub` carried *in the same message*, never bound to the contact's identity | TOFU: pin `contact.sigPub` on first sighting; on later messages require it to match, else flag key-change/tampered (no wire change — purely client-side trust state) |

---

## 3. Deferred — protocol / wire-format changes (need a version bump) — ⏸️

These are real weaknesses but changing them alters the on-the-wire crypto format,
which would break communication between updated and not-yet-updated clients of a
**deployed** messenger. They must ship behind a protocol-version negotiation with
a coordinated rollout and the project's E2E suite — **not** unilaterally.

**Status (audited 2026-11-13):** the first two items were found already
implemented in the deployed code — authenticated X3DH (v5) and the group
sender-key ratchet (v5) shipped behind the N3 caps negotiation
(`CONFIG.X3DH_V5_ENABLED` / `CONFIG.GROUP_RATCHET_V5`, both default ON), so the
"unilateral wire break" this section feared never happened: legacy peers simply
negotiate down. Only the KDF zero-salt item remains deferred.

- **X3DH not authenticated** — ✅ **implemented (v5).** The client computes and
  uploads `signedPreKeySig` (`index.html` ~4540), the worker contract accepts it,
  and the receiving side verifies the signature with Ed25519 before deriving
  (~4815). Gated by caps negotiation (`X3DH_V5_ENABLED: true`, ~1211): peers
  without the capability fall back to the legacy agreement instead of breaking.
- **Group sender keys never ratchet** — ✅ **implemented (v5).** Sender keys now
  hash-ratchet per message (`src/crypto/group.js` receiver/encrypt chain,
  ~131–151) with epoch rotation, negotiated by the caps AND rule across all
  group members (`GROUP_RATCHET_V5: true`, ~1206); a group with a legacy member
  stays on v3 until every member advertises the capability.
- **KDF zero-salt** (`index.html` `kdfChain` ~4670): message and chain keys are
  separated only by an `info` label over a constant zero salt. Aligning with the
  Double-Ratchet symmetric-KDF construction changes derived key bytes → wire break.
  Still ⏸️: no evidence of practical harm (zero salt is the RFC 5869 default and
  the `info` labels domain-separate), so this is a standardisation decision, not
  an incident — if taken, it needs the same caps-negotiated migration pattern as
  the two items above (dual derivation, per-chain attribute, no mid-chain switch).

## 4. Same-millisecond message loss — ✅ closed worker-side (2026-11-13)

The original scenario — the poll cursor advances on strict `>` ts, so a later
message sharing the exact ms was excluded and then GC'd — was first closed by
server-side ts bumping on both relay paths (`handleMsgSend` `_worker.js` ~456,
`handleSealedSend` ~2809): every append is stored strictly above the queue tail,
so the ts cursor stays lossless with **no client change** (pinned by Item 41 /
Item 66 in `tests/worker.test.js`). The msgId-exclusive cursor redesign once
planned here is therefore not needed for losslessness; `msg.id` remains what it
already was — the dedup key.

An audit on 2026-11-13 then found the protection's anchor was the *current
queue state*, which left a residual class, all fixed worker-side in the same
pass (regression tests flipped from known-limitation pins to fixed-outcome
assertions):

- **Post-drain invisibility (plain path).** Once the inbox drained and its KV
  key was deleted, no high-water mark survived, so a below-cursor arrival was
  stored unbumped, never delivered, and purged. Fix: a persistent per-inbox
  high-water mark (`inbox:{id}:hwm`, advanced on send and on poll,
  `handleMsgPoll` ~664) that send bumps past.
- **Race-recovered envelope ack-deleted unpolled (sealed path).** The
  lost-write recovery re-appended with the stale pre-race ts, which could equal
  the winner's ts and thus the recorded hwm. Fix: the re-append ts is
  recomputed from the read-back tail (`max(newTs, tail+1)`).
- **Plain path had no lost-write recovery.** Concurrent sends to one recipient
  could clobber each other silently. Fix: `handleMsgSend` now reads its write
  back and re-appends by `msg.id`, mirroring the sealed path.

---

## 5. Validation

No automated E2E/browser harness is available in this environment, so changes are
verified by:
- `node -c` syntax checks on `_worker.js`, `sw.js`, and the extracted inline script.
- Targeted Node harnesses for isolated logic (rate-limiter, PoW round-trip,
  ratchet gap math).
- `./validate.sh` quality gates (run in `build.sh validate`).

Before relying on §2 in production, run a two-device manual pass: large offline
backlog (>100 messages) to exercise the ratchet gap fix (A); repeated
reconnect/flaky-link cycling to confirm no interval growth (B); first-install in a
fresh profile to confirm no reload loop (C); and a contact key-change to confirm
the TOFU badge behaviour (E).

## 6. Sequencing

1. ✅ PR #1 (§1) — merged.
2. ✅ This iteration (§2 A–E) — audited: already deployed; regression tests added, no wire change.
3. ✅ §4 same-ms loss — closed worker-side (server ts bump; residual anchor class
   fixed 2026-11-13). No cursor redesign needed.
4. ⏸️ §3 KDF zero-salt — the only §3 item left (X3DH v5 and group ratchet v5
   already deployed behind caps negotiation); only behind a negotiated
   protocol-version bump.
