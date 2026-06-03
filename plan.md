# Breeze — Hardening Plan

Living plan for the code-review follow-up work. The app ships as a single
bundle inside `breeze.zip` (the only tracked file); fixes are made by extracting
the zip, editing the source, and re-packing it.

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

## 2. This iteration — 🛠️

Contained, backward-compatible fixes (no wire-format change). Verified by static
reasoning + targeted Node harnesses; **full E2E validation still pending** (see §5).

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

- **X3DH not authenticated** (`index.html` ~4452 / 4559): signed pre-key uploaded
  without `signedPreKeySig`; `initSession` derives the root key from `IK_A×IK_B`
  with no signed-prekey verification → MITM on first contact. Needs the client to
  compute/verify the prekey signature and the worker contract already expects
  `signedPreKeySig`.
- **Group sender keys never ratchet** (`index.html` ~4969): the 32-byte sender key
  is generated once and only used as an HKDF salt input by counter → no forward
  secrecy; a leaked sender key exposes all past/future group messages. Needs an
  epoch/ratchet scheme for sender keys.
- **KDF zero-salt** (`index.html` `kdfChain` ~4529): message and chain keys are
  separated only by an `info` label over a constant zero salt. Aligning with the
  Double-Ratchet symmetric-KDF construction changes derived key bytes → wire break.

## 4. Deferred — needs design/validation — 🔎

- **Same-millisecond message loss** (`index.html` ~8243 + `_worker.js` ~366): the
  poll cursor advances on strict `>` ts, so a later message sharing the exact ms
  is excluded and then GC'd. A correct fix means making the cursor exclusive **by
  msgId** (not ts) with overlap + client `_replayCache` dedup; risky to change
  blind because the naive fix causes either duplicate delivery or further loss.

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
2. 🛠️ This iteration (§2 A–E) — contained, no wire change.
3. ⏸️ §4 cursor redesign — separate, well-tested change.
4. ⏸️ §3 protocol items — only behind a negotiated protocol-version bump.
