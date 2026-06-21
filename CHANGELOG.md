# Changelog

## decoding="async" on all display images + fix hardcoded alt — Qiita/Zenn-informed — item 102 (branch claude/nice-ride-T6yb0, 2026-06-20)

734 tests; `index.html` only. `validate.sh` PASSED (i18n EN/JA parity).

Research lens. Zenn `decoding="async"` deep-dives (`ixkaito/deep-dive-into-decoding`,
`sugamaan/9adab715…`): `loading` controls *when to fetch*, `decoding` controls
*when to decode*; `decoding="async"` keeps image decode off the main thread (sync
decode blocks the browser), and it pairs naturally with `loading="lazy"` for
below-fold images.

Socratic lens: *"Every below-fold `<img>` already has `loading="lazy"`. But does
any have `decoding="async"`? If not, the browser still decodes each image
synchronously on the main thread as it scrolls into view — janking the very
scroll `loading=lazy` was meant to smooth."*

None did. Added `decoding="async"` to every display image:

- Message image (`.msg-img`), OGP card cover + favicon + thumbnail (all already
  `loading="lazy"`).
- Compose image preview and the `?...` image previews (first-view → no `lazy`, but
  `decoding="async"` still avoids a sync-decode hitch).
- Lightbox full-size image (`createElement` → `img.decoding = 'async'`).

Also fixed a hardcoded English `img.alt = 'Full size image'` on the lightbox image
(CLAUDE.md `t()` violation) → `t('fullSizeImage')` with new EN/JA keys.

## content-visibility on message rows (render skip for off-screen) — Qiita/Zenn-informed — item 101 (branch claude/nice-ride-T6yb0, 2026-06-20)

734 tests (CSS-only — suite imports src/crypto/_worker/sw, never index.html); `index.html`. `validate.sh` PASSED.

Research lens. Qiita's `content-visibility` guides (`nolanlover0527/25dcdc97…`,
`frosted_bird/004e530c…` CSS Containment): `content-visibility: auto` skips
rendering (layout + paint) of off-screen elements until they enter the viewport
— the biggest win on long, scrollable lists; pair with `contain-intrinsic-size`
to reserve height and avoid scrollbar/layout shift.

Socratic lens: *"The contact list row `.contact` already has
`content-visibility: auto; contain-intrinsic-size: auto 60px`. The message list
`.msg` is the LONGER, more-scrolled list (up to MSG_DOM_LIMIT = 200 nodes) — yet
it only has `contain: content`, not `content-visibility`. Why is the bigger list
unoptimized?"*

No reason — oversight. The browser was laying out + painting all ~200 message
rows even when only a handful are on screen.

**Fix:**
- `.msg`: add `content-visibility: auto; contain-intrinsic-size: auto 44px`
  (≈ single-row height; the `auto` keyword then remembers each row's real size
  after first render, so scrollback that's been seen stays jump-free). Mirrors the
  existing `.contact` rule.
- **Print guard:** `@media print .msg { content-visibility: visible !important }`.
  `content-visibility: auto` skips off-screen content during printing, which would
  have dropped messages from the `/print` chat export — forced visible for print.
- Find-in-page is unaffected (`content-visibility: auto` keeps content findable by
  the browser's Ctrl+F by design).

## crash-overlay i18n + fix ghost `uiError` key — Qiita/Zenn-informed — item 100 (branch claude/nice-ride-T6yb0, 2026-06-20)

734 tests; `index.html` only. `validate.sh` PASSED (i18n EN/JA parity).

Research lens. Qiita/Zenn global-error-handling guides (`CRUD5th/7121432a…`
exception/notification design; `window.onerror` + `unhandledrejection` as the
"last line of defense"). Breeze already has both global handlers (flood limit,
fatal-error crash overlay, audit log, network-error toast suppression) — mature.
Auditing the failure-path UI itself surfaced three issues.

Socratic lens: *"The crash overlays are the LAST thing a user sees when the app
breaks. Are they even translated? And does every `t()` key they use exist?"*

- **Ghost key bug.** The init-failure overlay used `esc(t('uiError') || 'Something
  went wrong')`. There is no `uiError` key, and `t()` falls back to the **key
  string**, so `t('uiError')` returned the literal `"uiError"` — truthy — so the
  `|| 'Something went wrong'` fallback never ran. A crashing app showed the user a
  title that literally read **"uiError"**. Now uses `t('crashTitle')`.
- **Hardcoded English.** Both crash overlays had hardcoded `Something went wrong`
  / `Breeze encountered an error…` / `Clear cache` / `Reload` / `Clearing...` —
  CLAUDE.md violations a JA user would hit at the worst moment. Added `crashTitle`
  / `crashBody` / `crashClearCache` keys (EN+JA); reused existing `uiReload` and
  `clearing`. Both overlays now fully localized.
- **Duplicate avoided.** Initial fix added a `crashClearing` key; `clearing`
  already existed (EN+JA) → reused it, dropped the dup.

## passive listeners on every observer-only touch/scroll — Qiita/Zenn-informed — item 99 (branch claude/nice-ride-T6yb0, 2026-06-20)

734 tests; `index.html` only. `validate.sh` PASSED.

Research lens. Qiita's "猫でもわかるスクロールイベントパフォーマンス改善" and
`kyntk/5c16846a…` ("touch/wheel に passive: true を明示する必要があるか") plus
`nuko-suke` performance-tuning 85選: a touch/scroll listener without
`{ passive: true }` forces the browser to **block scroll** until the main thread
returns from the callback (in case it calls `preventDefault()`), causing visible
scroll jank on mobile. Chrome DevTools logs this as
"Added non-passive event listener to a scroll-blocking event."

Socratic lens: *"How many of Breeze's touch/scroll listeners are explicitly
`{ passive: true }`? And of the rest, which actually call `preventDefault()`?"*

Audit: 13 touch/scroll listeners total. 9 already declared `passive` (most
`true`, two `false` where they legitimately call `preventDefault` — pinch-zoom
on the image lightbox and the message double-tap reaction picker). **4 sites
omitted the option entirely** — all pure observers that never call
`preventDefault`:

- `visualViewport scroll` → `_adjustViewport` (viewport CSS update).
- Image lightbox `touchend` (swipe-down-to-dismiss + zoom reset).
- Image lightbox `touchend` (double-tap to zoom).
- Message-list `scroll` → toggle scroll-to-bottom FAB.

**Fix:** added `{ passive: true }` to all four. No code logic change. Now every
touch/scroll listener in the app explicitly declares its intent.

## fix peer-heartbeat interval leak on account switch — Qiita/Zenn-informed — item 98 (branch claude/nice-ride-T6yb0, 2026-06-20)

734 tests; `index.html` only (inline WebRTC teardown — not harness-testable, like item 90). `validate.sh` PASSED.

Research lens. A Qiita/Zenn memory-leak sweep (`CRUD5th/b37ca6dc…` event/ref
release; `tkdn` 4 common leaks) reiterates the #1 SPA leak: a `setInterval`
whose `clearInterval` never runs on teardown keeps its callback closure — and
everything it captures — alive forever.

Socratic lens: *"`_messengerCleanup` (the account-switch teardown) clears each
peer's `_healthTimer` and calls `pc.close()`. But `_heartbeat` (a sibling
`setInterval` on the same peer) is cleared only by the connectionstatechange
handler — and `pc.close()` does NOT fire connectionstatechange (per spec). So
after an account switch, does every peer's heartbeat keep firing?"*

Yes. The heartbeat interval kept running against a now-closed DataChannel,
pinning the old `peerState` (and its `pc`, channels, closures) so GC could never
reclaim them. Each account switch with N live peers leaked N intervals — they
accumulate across switches, wasting a timer + CPU per old peer indefinitely.

**Fix:** clear `p._heartbeat` alongside `p._healthTimer` in the teardown loop
(one line + comment), making the two per-peer timers symmetric. Verified by
inspection (the inline WebRTC peer path has no unit harness, consistent with the
call-signaling work in item 90).

## modal a11y accessible names + button i18n — Qiita/Zenn-informed — item 97 (branch claude/nice-ride-T6yb0, 2026-06-20)

734 tests; `index.html` only. `validate.sh` PASSED (incl. i18n EN/JA parity).

Research lens. A Qiita/Zenn accessibility sweep (`CRUD5th/a7a578d6…` ARIA/focus
strategy; ARIA APG dialog pattern; `24motz` live regions) reiterates: a modal
dialog needs an **accessible name**, and you should not hand-roll what native
elements give you. Breeze already uses native `<dialog>` + `showModal()` (free
role=dialog, aria-modal, focus trap, ESC, focus-restore) and a `role=menu`
context menu with arrow-key nav — but two gaps remained.

Socratic lens: *"`showPrompt`/`showConfirm` build a `<dialog>` whose only naming
comes from a plain `<div class="modal-title">`. The dialog has **no
`aria-labelledby`**, so a screen reader announces a nameless dialog; the prompt
`<input>` has only a placeholder, **no label**. And the Cancel/OK buttons are
**hardcoded English** ("Cancel", aria-label="Cancel", "OK") — violating the
project rule that ALL UI text go through `t()`."*

**Fix (33 call sites, both generic modals):**

- **Accessible name.** Each dialog gets a unique `titleId` on the title div and
  `dlg.setAttribute('aria-labelledby', titleId)`; the prompt input is
  `aria-labelledby="<titleId>"` so it inherits the prompt text as its label
  (APG dialog pattern). No redundant ARIA elsewhere — the native `<dialog>`
  already supplies role/modal/focus semantics.
- **i18n.** New `cancel` / `ok` keys (EN `Cancel`/`OK`, JA `キャンセル`/`OK`).
  Cancel button text → `t('cancel')`; OK default → `opts.okText || t('ok')`.
  Removed the now-redundant hardcoded `aria-label="Cancel"` (the translated
  button text is the accessible name).

## Service Worker cache hardening — Qiita/Zenn-informed — item 96 (branch claude/nice-ride-T6yb0, 2026-06-20)

734 tests (5 new in `tests/sw.test.js`); `sw.js` + `tests/sw.test.js`. `validate.sh` PASSED.

Research lens. A Qiita/Zenn sweep on Cloudflare KV cost, WebRTC reconnection,
IndexedDB perf, and Service Worker/PWA caching. Most surfaces were already mature
(worker presence cache + 5-min KV write batching; lossless +1ms poll cursor;
shell-preserving SW trim; complete PWA manifest). The one concrete gap was a
documented `Cache.put()` pitfall in the SW fetch handler.

Socratic lens: *"Both `cache.put()` sites guard with `if (resp.ok)`. But `resp.ok`
is TRUE for a 206 Partial Content response, and `Cache.put()` THROWS on a partial
response. The put is also unawaited and uncaught, so a 206 (range request) or a
`QuotaExceededError` (storage full) becomes an unhandled promise rejection."*

**Fix (DRY):**

- New `cachePut(request, response)` helper replaces both inline
  `if (resp.ok) { … caches.open().then(put) }` blocks. It caches **only**
  `status === 200 && type === 'basic'` responses — so 206 partials, opaque
  (cross-origin no-cors, status 0), and CORS (third-party) responses are skipped
  (we only persist our own shell), and the write is wrapped in `.catch(() => {})`
  so a `QuotaExceededError` never escapes. The page still receives every response;
  only the cache write is conditionally skipped.
- 5 new SW tests via the existing mocked-global harness: 200/basic cached;
  206 not cached (the trap — asserts `resp.ok` would have passed); opaque not
  cached; CORS not cached; `QuotaExceededError` swallowed without rejecting
  `respondWith`.

## Trusted Types enforcement (Phase 2d) — Qiita/Zenn-informed — item 95 (branch claude/nice-ride-T6yb0, 2026-06-20)

729 tests; `index.html` + `_headers` + `docs/REVIEW-2026-06.md`. `validate.sh` PASSED.

Research lens. Qiita/Zenn search surfaced Zenn's own production CSP rollout
(`team_zenn/introduced-csp-to-zenn`) plus multiple Qiita/MDN guides on
`require-trusted-types-for 'script'`. The pattern they validate — register a
`default` policy as the safety net for raw HTML sinks, then turn on enforcement —
is exactly the missing piece for Phase 2d.

Socratic lens: *"`_headers` and the `<meta>` CSP both declare `trusted-types
breeze-sanitizer`, but neither emits `require-trusted-types-for 'script'`. So
Trusted Types is **not actually enforced** — the policy is registered for show, and
the 98 raw `el.innerHTML = …` / `insertAdjacentHTML` / `outerHTML` sites bypass it
entirely. A single DOM XSS in any of those sites still wins."*

Confirmed by audit: 88 + 6 + 4 = 98 HTML sinks; ZERO script-creating sinks (no
`eval`, no `new Function`, no `setTimeout(string)`, no dynamic `<script>`, no
`srcdoc`, no `document.write`) — so a single `createHTML` policy covers the whole
attack surface.

**Fix:**

- **Register a `default` Trusted Types policy** alongside the named
  `breeze-sanitizer`. Both call the same `sanitize()` (DOMParser + tag/attr
  allowlist + `javascript:` href strip). The default is the browser's safety
  net for any raw `el.innerHTML = stringValue` site — under enforcement, those 98
  unmigrated sinks become sanitized transparently rather than throwing
  SecurityError.
- **Add `require-trusted-types-for 'script'`** to the CSP in both `_headers` and
  the inline `<meta http-equiv="Content-Security-Policy">`. Add `default` to the
  `trusted-types` allowlist so the new policy is permitted.
- **Cross-browser safety.** Browsers without TT support (Firefox, Safari) silently
  ignore the directive; behavior is unchanged for them. Chromium-based browsers
  (Chrome, Edge) now enforce — and the default policy ensures no app code breaks.
- **Hot-path cost.** The sanitizer's fast path (`if (!/</.test(html)) return html`)
  returns in one regex test for plain text (the common case after `esc()`). Only
  HTML containing `<` triggers the DOMParser walk.

This closes the last item from the Phase 2 roadmap (`docs/REVIEW-2026-06.md`).

## state review + reconcile at-rest onto canonical atrest.js + N1 ratchet fix — item 93 (branch claude/nice-ride-T6yb0, 2026-06-20)

729 tests (removed the 6 redundant ratchet.test.js cases; `atrest.test.js`'s 20 are canonical); `src/crypto/ratchet.js` + `tests/ratchet.test.js` + `index.html` + `docs/REVIEW-2026-06.md`. `validate.sh` PASSED.

Spec: `docs/REVIEW-2026-06.md` — strengths/weaknesses/improvements (長所短所改善点) of the post-Phase-2 state, prioritized. Two HIGH items implemented this pass; W4/W5 (live message-path changes needing a two-device test) tracked for a later pass.

**W2 — Phase 2c at-rest regression (self-inflicted in item 92), fixed.** Item 92 added weaker *duplicate* `wrapKeyAtRest`/`unwrapKeyAtRest` to `ratchet.js` and a divergent inline record format (`{wrapped,salt,iv,kdf:'pbkdf2-v1'}`) — **no AAD binding, no PBKDF2 DoS guard** — instead of mirroring the canonical `src/crypto/atrest.js` (item 78), violating INTEGRATION.md's "modules are the source of truth" principle.

- Reverted the `ratchet.js` additions and the 6 redundant `ratchet.test.js` tests.
- Rewrote the index.html inline at-rest helpers to **mirror `atrest.js` exactly**: record `{ v:1, kdf:'pbkdf2', hash, iter, salt, iv, ct }`; AES-GCM **AAD = `breeze-atrest-v1:<slot>`** (slot = `keys` / `signing`) so a record relocated to another slot fails to decrypt; **`iter` DoS guard** (reject non-finite / ≤0 / > 10,000,000 before deriving); `_atRestIsWrapped` / `_atRestLoadKey` / `_atRestMigrate` matching the module's `isWrapped`/`loadKey`/`migrate`.
- `loadIdentity` / `initSigning` now route through `_atRestIsWrapped` + `_atRestLoadKey(record, pass, slot)` (returns null on failure, no throw on wrong pass). `/keywrap` enable uses `_atRestMigrate` (nested `wrapped`, plaintext `priv` removed); disable unwraps with the slot context and restores plaintext.
- Canonical coverage stays in `atrest.test.js` (20 tests: round-trip, wrong-pass null, tamper null, DoS-guard fast-reject, AAD cross-context fail, migrate+loadKey context threading).

**W3 — N1 `dhRatchetStep` Nr bug (live), fixed.** The inline `dhRatchetStep` reset `sendCounter` but not `recvCounter`; a DH step starts a new receiving chain, so the first inbound message (counter 1) was misread as a replay → silent drop on the 3rd ratchet direction-flip. Added `sess.recvCounter = 0`, matching the tested `src/crypto/ratchet.js` (proof: `tests/x3dh.test.js` "full session establishment").

## at-rest identity key wrapping (Phase 2c, opt-in) — item 92 (branch claude/nice-ride-T6yb0, 2026-06-20)

`index.html` integration of at-rest wrapping (crypto core: `src/crypto/atrest.js`, item 78). `validate.sh` PASSED. *(Superseded by item 93 — see above for the reconciliation onto the canonical module; the original commit had introduced a divergent inline format since corrected.)*

Socratic lens: *"In `loadIdentity`, the ECDH private key is read directly as `stored.priv` — a plaintext JWK object from IndexedDB. Same in `initSigning` for the Ed25519 signing key. IDB is accessible to any script running in the same origin (XSS), any browser extension with `webRequest` access, and device forensics tools. Is there any key-at-rest protection?"*

No. Both private keys live as plaintext JWK in IDB. A single reflected XSS or a malicious browser extension suffices to exfiltrate them silently — no wrapping, no passphrase, no KDF.

**Integration (opt-in via `/keywrap`; preserve default no-passphrase path):**

- **`loadIdentity`** branches on a wrapped-record marker — prompts for passphrase via `showPrompt`, unwraps, caches the passphrase in `_atRestPassphrase` (ephemeral) for `initSigning`. Returns `false` (aborts startup) on wrong passphrase.
- **`initSigning`** reads `_atRestPassphrase` set by `loadIdentity`, unwraps the Ed25519 signing key if wrapped, then clears `_atRestPassphrase`. Single passphrase prompt per startup for both keys.
- **`/keywrap` command**: enable (prompts passphrase × 2 for confirmation, min 8 chars, wraps both ECDH + Ed25519 keys) / disable (prompts current passphrase to unwrap, restores plaintext).
- **`CONFIG.PBKDF2_AT_REST_ITERATIONS: 600000`** — new constant, not re-using `PBKDF2_ITERATIONS`.

## group sender-key v5 hash ratchet + epoch revocation (Phase 2b, gated, default OFF) — item 91 (branch claude/nice-ride-T6yb0, 2026-06-20)

729 tests (10 new, mutation-verified); `src/crypto/ratchet.js` + `tests/ratchet.test.js` + `index.html`. `validate.sh` PASSED.

Socratic lens: *"In `encryptGroupMsg`, the message key is `HKDF(sk.raw, counter_bytes, 'group-msg')`.
`sk.raw` never changes — it is the static group sender key. Knowing `sk.raw` and any counter lets
you compute ALL message keys for ALL past and future messages. Does `sk.raw` ever advance?"*

No. The counter is only an HKDF salt; the key material is static. An attacker who captures the
sender key (from a compromised device, a leaked IDB backup, or a future sender-key injection) can
decrypt every group message ever sent. Additionally: `epoch` is bumped on kick/leave by the server
but the admin client never reads it back or generates a fresh sender key, so a kicked member keeps
decrypting indefinitely — **epoch was a no-op**.

**Fix (gated by `CONFIG.GROUP_RATCHET_V5`, default OFF; breaking wire change for groups):**

- **Forward secrecy (hash ratchet)**: replace `HKDF(raw, counter, 'group-msg')` with:
  `msgKey = HKDF(chainKey, Ø, 'breeze-group-msg-v5')` then
  `chainKey = HKDF(chainKey, Ø, 'breeze-group-chain-v5')` — old chain key evicted after each
  message. An attacker who captures `chainKey_N` can decrypt messages N, N+1, … but NOT 0 … N-1
  (one-way ratchet; past keys are gone).

- **Epoch revocation**: on `/group/kick` the server returns the bumped epoch; the admin client
  generates a **fresh random chainKey** for the new epoch and re-distributes only to **remaining
  members**. Messages carry `ep`; a mismatch is rejected without fallback. Kicked member's stale
  key is invalid for the new epoch and cannot decrypt future messages.

- **Out-of-order tolerance**: receiver ratchets forward from `peerSK.counter` to `p.c`, caching
  intermediate keys in `peerSK.skipped[counter]` (IDB-persistent). Skip cache capped at
  `GROUP_MAX_SKIP = 50` entries; evicts oldest on overflow.

- **Sender-key distribution payload** changed to `{ type:'sender_key', groupId, chainKey, epoch, v:5 }` when flag is ON; v3 format unchanged for fallback.

- **Backward compat (v3 read path preserved)**: `decryptGroupMsg` dispatches on `p.v` — v3 messages
  continue to use the old `HKDF(raw, counter)` path during the rollout epoch.

**Tests (10, mutation-verified via `ratchet.js` pure exports):**
round-trip; multi-message sequential; forward-secrecy (old CK cannot decrypt future msg);
mutation guard (CK0 ≠ CK1 → different msg keys); out-of-order with skip cache; gap > GROUP_MAX_SKIP
rejected; epoch mismatch rejected; epoch rotation (kicked peer null, remaining peer succeeds, past
epoch still decryptable); v3 backward compat (`groupDecryptV3`); skip-cache pruning (two-pass eviction).

## authenticated call signaling — close WebRTC SDP MITM (gated, default OFF) — item 90 (branch claude/nice-ride-T6yb0, 2026-06-20)

719 tests (no new — call/WebRTC flow isn't harness-testable); `index.html` only. `validate.sh` PASSED.

Socratic lens: *"`handleSignal` has no authentication: `sender` is a self-declared string, the
`call:[sorted ids]` room is derivable by anyone who knows two public IDs, and `data` is opaque
(explicitly not validated). The call SDP offer/answer/ICE travel plaintext through it, and
receivers `JSON.parse(s.data) → setRemoteDescription/addIceCandidate` with no binding of the DTLS
fingerprint to the peer's pinned identity. Can an attacker inject a call-answer and MITM the
media?"*

Yes — the classic "WebRTC over untrusted signaling without fingerprint verification" break. An
attacker who knows both user IDs posts a `call-answer` carrying their own SDP + DTLS fingerprint
into the room; the caller's `setRemoteDescription` accepts it, the DTLS-SRTP handshake completes
with the attacker, and audio/video flows through them. This defeats the E2E guarantee for calls
(the media keys live in the SDP/DTLS fingerprint, which was never authenticated).

- **Fix (gated by `CONFIG.CALL_E2E_SIGNAL`, default OFF — breaking wire change, needs two-device
  verification before enabling)**: wrap every call signal (offer/answer/ICE, both the `/signal`
  room path and the `isCall` msg-relay notify) with `encryptFor()` to the **pinned peer**, and
  `decryptFrom()` on receipt via new `_wrapCallSignal`/`_unwrapCallSignal` helpers. A forged or
  relay-injected signal isn't encrypted under the peer's session → `decryptFrom` returns null →
  the signal is dropped (no `setRemoteDescription`, no fake ring). Decryption *is* the
  authentication: only the holder of the pinned peer's ratchet session can produce a valid
  signal, so the DTLS handshake can only complete with the real peer.
- **Default OFF** = behavior byte-identical to the legacy plaintext path (instant rollback; zero
  production risk until the operator enables it after a two-device pass). Both peers must run with
  the flag ON. (Also incidentally fixes a stuck-`ringing` state on a malformed offer.)
- **Residual (documented)**: `call-end` carries no payload and stays unauthenticated — injecting
  it only *terminates* a call (minor DoS), it cannot compromise media.

## escape provider-controlled fields in translate/AI/info innerHTML sinks — item 89 (branch claude/nice-ride-T6yb0, 2026-06-20)

719 tests (1 new, mutation-verified); `index.html` + `_worker.js` + `tests/worker.test.js`. `validate.sh` PASSED.

Socratic lens: *"The translation indicator builds innerHTML as
`…${esc(data.translated)}…${data.from} → ${data.to} · ${data.provider}…`. `data.translated` is
escaped, but the adjacent meta fields are not. Where does `data.from` come from — is any of it
attacker- or external-service-controlled?"*

`data.from` is the **detected source language echoed straight from the external translation
provider's response** (`d.detectedLanguage?.language` / `detectedSourceLanguage` /
`responseData.match.source`) and the worker returned it **unsanitized** (`from: detectedFrom`).
A malicious or compromised translation provider could return
`from: 'en"><img src=x onerror=…>'`; interpolated unescaped into innerHTML it executes under the
`script-src 'unsafe-inline'` CSP. `data.provider` is a worker-side literal (no live vector) but
sat unescaped in four innerHTML sinks; `c.labels.join(', ')` in `/info` was unescaped while the
adjacent `c.name`/`c.alias`/`c.notes` in the same array were escaped.

- **Fix (defense in depth, both ends)**:
  - Worker: strip `detectedFrom` to a short alnum/`-` BCP-47-ish tag (`[^a-zA-Z0-9-]` → '', ≤16)
    before returning — a misbehaving provider can't smuggle markup to the client.
  - Client: `esc()` the meta fields at every sink — translate indicator (`data.from`/`data.to`/
    `data.provider`), AI-context translate (`data.provider`), `/info` labels (`c.labels`), AI
    summary + AI chat (`data.provider`).
- **Test (1, mutation-verified)**: mock the provider to return an injection in
  `responseData.match.source`; assert `j.from` carries no `<>"'`, matches `^[a-zA-Z0-9-]*$`, is
  ≤16 chars, and `!== injection`. Removing the worker strip flips it red.

## remove unauthenticated plaintext edit/delete/reaction/poll_vote handlers (sealed-envelope tampering) — item 87 (branch claude/nice-ride-T6yb0, 2026-06-20)

718 tests (no new — `handleIncoming` lives in `index.html`, outside the harness); `index.html` only. `validate.sh` PASSED.

Socratic lens: *"The sealed-poll path does `handleIncoming(JSON.parse(sealed.envelope))`, and
`handleSealedSend` stores the `envelope` string verbatim with no schema check — so the envelope is
opaque, attacker-controlled JSON. `handleIncoming` then dispatches on `msg.type`. The deprecated
plaintext `type:'edit'` / `'delete'` handlers mutate the stored message DB *without any
decryption*. Can an arbitrary sender rewrite or delete a message in a victim's DB by posting a
crafted sealed envelope?"*

Yes. `POST /sealed/send {to:<victim>, envelope:'{"type":"edit","msgId":"<id>","text":"<forged>"}'}`
reaches the victim's `handleIncoming` and runs `dbPut('messages', {...stored, text: forged})` — full
message-integrity tampering (silently rewrite "see you at 5" → a scam), or `type:'delete'` to wipe
a message — with **zero sender authentication and zero decryption**. `msgId` for 1:1 is the
predictable `senderId:ts`, so an attacker trivially targets their own already-delivered messages
(retroactive deniability) and can attempt others'. `reaction`/`poll_vote` allowed the same
unauthenticated state tampering (cosmetic/informal, lower impact).

Why these handlers had **no legitimate relay sender** in v3.6, making removal safe:
- **edit/delete/reaction** — current clients send these via the **encrypted `isSignal` path**
  (handled earlier in `handleIncoming`, gated by a successful `decryptFrom` that proves the sender
  holds the ratchet session key).
- **poll_vote** — `votePoll` sends only over the **authenticated P2P DataChannel** (`peer.dc.send`),
  never the relay.
- The standard `/msg/send` relay **strips** `type`/`text`/`msgId`/`emoji`/`pollId` (the worker only
  persists whitelisted fields), so a pre-v3.6 plaintext signal can't survive that path either.
- The P2P DataChannel `onmessage` handler routes edit/delete inline (or drops them) — never to
  `handleIncoming`.

- **Fix**: remove all four deprecated plaintext handlers outright. The encrypted `isSignal` path is
  the sole authority for mutating an existing message; an undecryptable mutation is no longer
  honored. (Also eliminates two raw `el.innerHTML =` sinks, aiding the Phase 2d Trusted-Types goal.)

## handleBinaryChunk: total/seq/buffer bounds + 10-transfer cap — item 86 (branch claude/nice-ride-T6yb0, 2026-06-20)

718 tests (no new); `index.html` only. `validate.sh` PASSED.

Socratic lens: *"In `handleBinaryChunk`, the peer controls the `total` and `seq` fields that
determine `new Array(total)` allocation and array index writes, plus `nameLen`/`mimeLen` that
control `TextDecoder` slices into the buffer. A malicious peer sends `total = 2^32 - 1` (parsed
from a `getUint32` at offset 20). Is there an upper-bound check before `new Array(total)`?"*

No. `total` came from `view.getUint32(20)` with no cap — a peer could claim `total = 4294967295`
and allocate a ~34 GB sparse array per transfer. Similarly `seq >= total` was not checked
(allowing out-of-bounds writes into the array), and `28 + nameLen + mimeLen > buffer.byteLength`
was not validated (negative-length slice exposes adjacent memory as the data chunk). The
`_fileChunks` map was also unbounded, allowing 1000s of half-open transfers to pile up.

- **Fix**: `MAX_CHUNKS = Math.ceil(CONFIG.FILE_MAX / CONFIG.CHUNK_SIZE) + 1 = 3201`.
  Reject if `total === 0 || total > MAX_CHUNKS || seq >= total`. Reject if
  `28 + nameLen + mimeLen > buffer.byteLength`. Cap concurrent half-open transfers at
  `Object.keys(_fileChunks).length >= 10`.

## signing key change: prominent banner + toast (parity with enc key change) — item 85 (branch claude/nice-ride-T6yb0, 2026-06-20)

718 tests (no new); `index.html` only. `validate.sh` PASSED.

Socratic lens: *"The encryption-key-change path at ~4752 shows a yellow system-message
banner AND a showToast. The signing-key TOFU violation (contact.sigPub !== msg.sigPub at ~8569)
sets meta.tampered=true and logs a debug line, but shows no user-visible warning beyond the
subtle ⚠sig badge on the individual message. A signing key substitution is a stronger MITM
indicator — why the asymmetry?"*

No justification found. A substituted signing key lets an attacker forge signatures going
forward; it deserves the same alerting as a decryption failure.

- **Fix**: On `contact.sigPub !== msg.sigPub`, create a `div.msg.sys` in the chat box with the
  existing `keyChanged` i18n text and call `showToast(t('keyChanged', …), 'error', 8000)` and
  `announceToSR(…)` — exactly matching the encryption key-change pattern.

## emoji/title injection in renderReactions (XSS via P2P reaction) — item 84 (branch claude/nice-ride-T6yb0, 2026-06-20)

718 tests (no new); `index.html` only. `validate.sh` PASSED.

Socratic lens: *"`renderReactions` builds HTML via template literals. The `emoji` key and the
`users.join(', ')` title are both peer-supplied values that arrive over the P2P DataChannel.
Does `renderReactions` escape them before insertion?"*

No. `emoji` went into both `data-emoji="${emoji}"` (attribute injection) and
`<span class="rc">${emoji}</span>` (HTML injection). Since `script-src 'unsafe-inline'` is in
the CSP, inline event handlers like `onerror` on an injected `<img>` execute. A malicious peer
sends `emoji = '<img src=x onerror=evil()>'`; it is stored in IDB and rendered on every
message-list load.

- **Fix**: `esc(emoji)` for both sinks; `esc(users.join(', '))` for the title; `safeMsgId()`
  on the reaction span's `data-msgid`. `dataset.emoji` auto-decodes HTML entities so the click
  handler still receives the original value for IDB lookup.

## i18n: two hardcoded-English Toast strings fixed — item 83 (branch claude/nice-ride-T6yb0, 2026-06-20)

718 tests (no new); `index.html` only. `validate.sh` PASSED (137/143, 95%).

Socratic lens: *"`validate.sh` reported 'Toast i18n: 94% (<95%)'. Two showToast calls in
`index.html` embed English strings directly instead of routing through `t()`. Does `t()` support
function-valued keys with interpolated arguments?"*

Yes — `t(key, ...args)` already calls `v(...args)` when the key maps to a function. Two gaps:

1. `showToast(\`Update available: v${health.version}\`, ...)` (line ~3901) — hardcoded English
   with template literal. Added `updateAvailable: (v) => \`...\`` to EN+JA; call site uses
   `t('updateAvailable', health.version)`.

2. `showToast((t('scheduleCancelled') || 'Cancelled') + ': ' + count, ...)` (line ~10913) —
   count concatenated outside i18n, with an unnecessary `|| 'Cancelled'` fallback. Changed
   `scheduleCancelled` to `(n) => \`...\`` in EN+JA; call site simplified to
   `t('scheduleCancelled', count)`.

Score: 93% → 95%; remaining 2 warnings (`.style.X` count, total lines) are within range.

## ratchetDecrypt fails closed on unpadAndDecompress errors — item 82 (branch claude/nice-ride-T6yb0, 2026-06-20)

718 tests (1 new); `src/crypto/ratchet.js` + `tests/ratchet.test.js` only. `validate.sh` PASSED.

Socratic lens: *"`ratchetDecrypt` commits session state (counter, chain key ratchet step) before
calling `unpadAndDecompress`. `DecompressionStream` can throw on corrupted-but-authenticated
compressed data. If that exception propagates, the caller sees an exception after state has already
advanced — breaking all subsequent decryptions. Is either `unpadAndDecompress` call-site in a
try/catch?"*

No. Both call-sites (skipped-key path and main path) were unguarded.

- **Fix**: wrap both `return await unpadAndDecompress(padded)` calls in `try { ... } catch { return
  null; }` — matches the fail-closed contract: null = parse failure, never a throw after committed
  state.
- **Test (1, mutation-verified)**: mock `DecompressionStream.getReader()` to throw synchronously
  (avoids the secondary Node.js `InflateRaw` error-event that real invalid deflate bytes emit as an
  unhandled rejection in Vitest). Genuine-success branch: uncompressed flag=0 path decodes 'hello'.

## worker inline PoW pub-binding: startsWith fix + mutation test — item 81 (branch claude/nice-ride-T6yb0, 2026-06-20)

717 tests (1 new); `_worker.js` + `tests/worker.test.js` only. `validate.sh` PASSED.

Socratic lens: *"Item 79 fixed `pow.js`'s `verify()` to use `startsWith(pub + ':')`. The worker
has its own inline PoW check at line 671 that was NOT updated. Does it still use `.includes(pub)`?"*

Yes. The same substring-pub attack applies to the alias-registration endpoint in the worker:
an attacker with identity key `XPUBKEY` solves PoW for `XPUBKEY:ts`, then submits it claiming
to be `PUBKEY`. The hash is valid (it was genuinely solved) and the old `includes` check passes
(PUBKEY is a suffix of XPUBKEY). The attacker bypasses the per-identity rate-limit at the alias
endpoint.

- **Fix**: `pow.challenge.includes(pub)` → `pow.challenge.startsWith(pub + ':')` (line 671).
- **Test (1, mutation-verified)**: solve PoW for `'testPUBKEY:breeze-test'`, submit claiming
  `pub='PUBKEY'` → `POW_INVALID` (fixed) vs passes the pub check (old). Genuine-success branch
  verifies the token is still valid for `pub='testPUBKEY'`.

## responderHandshake fails closed on relay-injected bad msg field — item 80 (branch claude/nice-ride-T6yb0, 2026-06-20)

716 tests (2 new); `src/crypto/ratchet.js` + `tests/x3dh.test.js` only. `validate.sh` PASSED.

Socratic lens: *"`parsePreKeyMessage` validates that `msg` is a `string` but not that it is valid
JSON. `ratchetDecrypt` opens with a bare `JSON.parse(payload)` and also throws `'not a v3/v4
ratchet message'` for non-ratchet content. Neither exception is caught in `responderHandshake`.
What happens when a relay injects `msg: 'NOT_JSON'` into a legitimate prekey envelope?"*

- **Gap**: `responderHandshake` throws `SyntaxError` (or `'not a v3/v4 ratchet message'`)
  instead of returning null. A relay can crash the app's prekey-message handler with a single
  malformed `msg` field — no private key required, no E2E break required. Same for malformed
  `ik`/`ek` byte arrays that pass `parsePreKeyMessage`'s Array.isArray check but fail
  `importKey` inside `ecdhBits`.
- **Fix**: wrap the body of `responderHandshake` (after the `parsePreKeyMessage` null-exit) in
  try/catch → return null. No change to `ratchetDecrypt`'s existing intentional-throw semantics
  (used by callers that need to distinguish "not a ratchet message" from "decrypted but replay").
- **Tests (2, mutation-verified)**: non-JSON `msg` returns null (without fix: SyntaxError);
  valid-JSON non-ratchet `msg` returns null (without fix: throws 'not a v3/v4'). Each test
  also verifies the unmodified wire still round-trips to confirm genuine-success isolation.

## PoW pub-binding uses prefix match, not substring — item 79 (branch claude/nice-ride-T6yb0, 2026-06-20)

724 tests (1 new); `src/crypto/pow.js` + `tests/pow.test.js` only. `validate.sh` PASSED.

Socratic lens: *"The `verify` function checks `pow.challenge.includes(pub)` to ensure the challenge
embeds the identity whose endpoint is being accessed. `makeChallengeString` always produces `${pub}:…`.
If an attacker's longer pub key contains the victim's shorter pub as a suffix, their validly-solved
challenge `LONG_PUB:ts` satisfies `.includes(SHORT_PUB)`. Does the attacker's token then also pass
the SHA-256 hash check and return `{ ok: true }` for the victim's endpoint?"*

- **Gap**: yes — `includes` is a substring match. An attacker with pub key `XY` solves PoW for
  challenge `XY:ts`. A victim with pub key `Y` (a suffix of `XY`) has their endpoint accept the
  attacker's token because `'XY:ts'.includes('Y')` is true AND the hash was legitimately solved
  for `XY:ts`. The PoW rate-limit for the victim's endpoint is bypassed.
- **Severity**: defense-in-depth (endpoints also verify the identity signature), but the explicit
  purpose of the pub embedding is to prevent cross-identity replay — that contract was broken.
- **Fix**: change to `pow.challenge.startsWith(pub + ':')`. This matches how `makeChallengeString`
  formats challenges and ensures the challenge was issued *for that exact identity*, not merely a
  superstring. Empty-pub is also tightened (`startsWith(':')` = false for any normal challenge).
- **Test (1, mutation-verified)**: solved token for `'testpubkey123456789'` is used against
  a suffix pub `'pubkey123456789'` — the challenge `.includes()` that suffix (demoed in the test),
  but `.startsWith(suffix + ':')` is false. With the old `includes` check the test returns
  `{ ok: true }`; the fix makes it `POW_PUB_MISMATCH`. Genuine round-trip for the original pub
  still passes.

## atrest wrap binds AAD: domain separation + record-context — item 78 (branch claude/nice-ride-T6yb0, 2026-06-16)

713 tests (3 new); `src/crypto/atrest.js` + `tests/atrest.test.js` only. `validate.sh` PASSED.

Socratic lens (the items 76/77 binding theme applied to at-rest crypto): *"`atrest` AES-256-GCM
authenticates the ciphertext, but its encrypt/decrypt pass no `additionalData`. With no AAD, what
distinguishes an at-rest ciphertext from any other AES-GCM ciphertext, and what stops a wrapped record
being relocated between keystore slots?"* Nothing did.

- **Gap**: no domain-separation tag (cross-protocol confusion surface) and no context binding — an
  XSS attacker with IDB write access but *without* the passphrase could swap a wrapped record into a
  different slot, and the user would silently load the wrong identity on unlock.
- **Why now**: the module is a pre-wiring reference ("to be migrated onto it"), so there are no persisted
  records — the canonical wrap format can be fixed before it goes live, with no migration (same reasoning
  as items 76/77).
- **Fix**: every wrap/unwrap now sets `additionalData`. A constant `breeze-atrest-v1` domain tag is always
  applied (backward-compatible: both sides use it, so existing no-context round-trips are unchanged), and
  an optional caller `context` (e.g. account/record id) extends it. AAD is recomputed from the constant +
  caller context on unwrap — never read from the attacker-controlled record — so the binding is meaningful.
  `wrapJWK`/`unwrapJWK`/`migrate`/`loadKey` all thread the optional context.
- **Tests (3, mutation-verified)**: a record wrapped with one context fails to unwrap under a different
  context or with the context dropped, while the matching context round-trips; a no-context record won't
  unwrap once a context is supplied; `migrate`→`loadKey` thread the context end-to-end. Stripping the AAD
  makes cross-context unwrap wrongly succeed.

## push-subscribe signature now binds the subscription — item 77 (branch claude/nice-ride-T6yb0, 2026-06-16)

710 tests (2 new); `_worker.js` + `tests/worker.test.js` only. `validate.sh` PASSED.

Socratic lens (applying item 76's question to the other signed ops): *"Does each signed operation bind
all its security-relevant parameters? push-subscribe signs `breeze-push-subscribe:${userId}:${ts}` — but
the thing being registered is the `subscription` (endpoint + keys). Is that bound?"* No. The optional
Ed25519 ownership auth (item 62) exists specifically to stop an attacker registering *their own* device
under the victim's `userId` (the Web Push payload is encrypted to the subscriber-supplied p256dh, so the
attacker would decrypt the notification metadata — sender, type, contactId, timing). But because the
signature omitted the subscription, a captured/observed push-subscribe signature could be replayed with
the attacker's own endpoint + p256dh swapped in, defeating the very protection the auth was added for.

- Audited the other signed challenges while here: alias-set binds the alias, alias-delete the alias,
  portal/account-delete/backup have only `userId` as a parameter, and the backup body is E2E-AEAD
  (binding redundant — restore fails closed on tampering). push-subscribe was the one gap.
- **Fix**: the signed challenge is now `breeze-push-subscribe:${userId}:${ts}:${endpoint}:${p256dh}:${auth}`
  over the raw subscription fields the client sends. Same latent/opt-in status as item 76 (clients don't
  sign yet), so the canonical format is fixed before signing goes live.
- **Tests (2, mutation-verified)**: a subscribe whose endpoint — or whose p256dh decryption key — was
  swapped after signing is rejected `SIG_INVALID` with nothing registered, while the genuinely-signed
  subscription still registers. Reverting the bind fails them.

## group-auth signature now binds the operation's target — item 76 (branch claude/nice-ride-T6yb0, 2026-06-16)

708 tests (4 new); `_worker.js` + `tests/worker.test.js` only. `validate.sh` PASSED.

Socratic lens: *"The group-op signature covers `breeze-group-${action}:${token}:${actorId}:${ts}` — who
acts, which group, when. But not WHAT: the target. Since the relay is untrusted and sees the request, can
it swap the target while the signature still verifies?"* Yes — within the 5-min freshness window:
- **kick**: `kickId` was unsigned → relay swaps which member is removed.
- **admin**: neither `targetId` nor the sub-action (`promote`/`demote`/`unban`) was signed → relay turns a
  signed "demote X" into "promote Y" (**privilege escalation**) or "unban Z" (**ban bypass**).
- **transfer**: `newCreatorId` was unsigned → relay redirects ownership to an attacker-chosen member
  (**ownership hijack**).

The signature authenticated the actor but not the operation's parameters — a parameter-tampering gap.

- **Latent, fixed before it goes live**: the verify path only runs when a client supplies `{ts,sig}`, and
  clients don't sign yet ("flip on once clients sign"), so signing currently grants *false* security. No
  deployed client signs, so the canonical signed format can be fixed now without breaking anyone.
- **Fix**: `checkGroupAuth` takes a `bind` arg appended to the signed message
  (`…:${ts}:${bind}`). Callers bind their security-relevant params: kick→`kickId`,
  admin→`${subAction}:${targetId}`, transfer→`newCreatorId`, rename→sanitized `name`. delete/leave have
  no extra target (bind=''; the distinct `action` token already separates them). The signature now
  authenticates what is done, not just who/which-group/when.
- **Tests (4, mutation-verified)**: a kick with a relay-swapped `kickId`, an admin op with a swapped
  sub-action (promote↔demote) or `targetId`, and a transfer with a redirected `newCreatorId` are all
  rejected `SIG_INVALID` with state unchanged — while the correctly-signed target still succeeds.
  Reverting the bind in the verifier fails all four.

## sw.js contains relay-controlled notification URLs to our origin — item 75 (branch claude/nice-ride-T6yb0, 2026-06-16)

704 tests (6 new, first `tests/sw.test.js`); `sw.js` + `tests/sw.test.js` only. `validate.sh` PASSED.

Socratic lens: *"`notificationclick` feeds `data.url` — straight from the server-supplied push payload —
into `clients.openWindow()`. In Breeze's threat model the relay is untrusted; what stops a malicious
relay from making a notification tap open an arbitrary external page?"* Nothing did. `clients.openWindow()`
navigates to any cross-origin `https://` URL, so a compromised/malicious relay could push
`{url:"https://evil.example/phish"}` and turn a notification tap into a phishing redirect.

- **Confirmation**: the worker's `sendPushToUser` (`_worker.js:501`) only ever sets `title`/`body`/`tag`/
  `contactId` — it never sets `url`. So a cross-origin `url` can arise *only* outside the legitimate path,
  i.e. from a hostile relay. The SW must not honor it.
- **Fix**: new `safeAppUrl()` resolves `data.url` against our own origin and collapses anything that
  escapes it — cross-origin, protocol-relative (`//evil`), `javascript:` — to the app root before
  `openWindow()`. Separately, the three `client.url.includes(self.location.origin)` checks (a sloppy
  substring match that would also match a foreign window carrying our origin in a query param) are
  replaced with a proper `sameOrigin()` test, so an inline reply / mark-read postMessage can't be routed
  into an attacker-controlled page.
- **Tests (6, mutation-verified)**: first SW test harness — evaluates the real classic `sw.js` in a mocked
  ServiceWorkerGlobalScope and dispatches synthetic `notificationclick` events. Asserts cross-origin /
  protocol-relative / `javascript:` urls open the app root not the external page; same-origin deep-links
  (path+hash) are preserved; an existing same-origin window is focused; and a foreign window merely
  containing our origin in a query param does NOT receive the reply postMessage. Reverting either guard
  fails 5 of the 6.

## franking verify() fails closed on missing/malformed input — item 74 (branch claude/nice-ride-T6yb0, 2026-06-16)

698 tests (2 new); `src/crypto/franking.js` + `tests/franking.test.js` only. `validate.sh` 33/36.

Socratic lens: *"Does franking `verify` follow the file-wide 'never throw on untrusted input' contract
that ktlog/group/ratchet verify functions all uphold?"* No. `verify(message, commitment, opening)` did
`u8(opening)` / `toBytes(message)` / `u8(commitment)` with no guard. `u8(null)` is `Uint8Array.from(null)`,
which **throws** — so a missing `recordedCommitment` (the relay lost/expired the record) or an
attacker-supplied null on report would propagate an uncaught exception out of `verifyReport` instead of
returning a clean `false`.

- **Impact**: A crash is fail-closed (no false "authentic" verdict), so not a forgery risk — but the
  abuse-report path throwing on a missing commitment is an availability defect, and it diverges from the
  graceful-negative contract every other verify in the module suite holds.
- **Fix**: `verify` now returns `false` immediately when `message`/`commitment`/`opening` is `null`/`undefined`,
  and wraps the HMAC + compare in a try/catch returning `false` (belt-and-suspenders for any other
  malformed byte input). `verifyReport` inherits this via delegation.
- **Tests (2, mutation-verified)**: `verify` returns `false` (no throw) for null/undefined commitment,
  opening, or message; `verifyReport` returns `false` when the relay has no `recordedCommitment`.
  Reverting the guard makes both throw and fail.

## negotiate() normalizes malformed caps and fails closed — item 73 (branch claude/nice-ride-T6yb0, 2026-06-16)

696 tests (3 new); `src/crypto/negotiate.js` + `tests/negotiate.test.js` only. `validate.sh` 33/36.

Socratic lens: *"Do the sibling functions `negotiate` (1:1) and `negotiateGroup` (N-party) handle a
malformed capability value the same way?"* No. `negotiateGroup` defensively coerced each member's caps
(`Array.isArray(c) ? c : []`), but `negotiate` did `new Set(peerCaps)` directly. `new Set(<non-iterable>)`
(e.g. `new Set(42)`) **throws** — so a malformed peer caps value, which can arrive over the untrusted
relay, would crash the session-init path instead of failing closed.

- **Impact**: A crash is fail-closed (no feature wrongly enabled), so not a downgrade/forgery risk — but
  a relay-supplied non-array `caps` field crashing 1:1 negotiation is an availability defect, and the
  divergence from `negotiateGroup`'s graceful handling is an inconsistency a future caller could trip on.
- **Fix**: a shared `norm(c) = Array.isArray(c) ? c.filter(x => typeof x === 'string') : []` is applied to
  both `localCaps` and `peerCaps` in `negotiate`, and `negotiateGroup` is aligned to use the same helper
  (also guarding a non-array `memberCapsList`). Non-array → `[]` (all features off, AND-rule fail-closed);
  non-string elements are dropped so relay-injected junk can never match a capability id.
- **Tests (3, mutation-verified)**: `negotiate` returns all-false (no throw) for non-array peer caps
  (42/null/undefined/object/bool) and for a non-array local caps; junk elements in a caps array are
  dropped while the genuine string cap is still honored. Reverting the coercion makes the non-array test
  throw and fail.

## ktlog verifyChain fails closed on an all-malformed log — item 72 (branch claude/nice-ride-T6yb0, 2026-06-16)

693 tests (3 new); `src/crypto/ktlog.js` + `tests/ktlog.test.js` only. `validate.sh` 33/36.

Socratic lens: *"If a relay sends a key-transparency log whose entries are all malformed, does
`verifyChain` detect tampering or silently pass?"* It passed. `verifyChain` calls `parseLog`, which
drops entries failing its `ts`/`h` filter. When EVERY entry is malformed, `parseLog` returns `[]`, the
verification loop never runs, and the function returned `{ ok: true }` — garbage silently verified as a
clean log. This is the same fail-open the module already rejects for a non-string `c` field (line 162,
"tampering, not legacy → fail"), just via a different path.

- **Impact**: A hostile relay could replace a real append-only hash chain with malformed entries and
  still have `verifyChain` (and therefore `auditBundle`) report success — `auditBundle` would return
  `verdict: 'ok'` instead of `'tampered'`, defeating the N5 tamper-evidence layer. (This is the tested
  reference module; index.html does not yet import it, so no production impact — but it is the
  source-of-truth for the planned browser migration.)
- **Fix**: fail closed when the raw input is a non-empty array but `parseLog` drops every entry —
  `if (Array.isArray(log) && log.length > 0 && sorted.length === 0) return { ok: false, invalidIdx: 0 };`.
  A genuinely empty array (`[]`, nothing to verify) and legacy entries (valid `ts`+`h`, no `c` — they
  survive `parseLog`) are unaffected; both existing behaviors stay green.
- **Tests (3, mutation-verified)**: an all-malformed log fails (`ok:false`, `invalidIdx:0`); an empty
  `[]` still verifies ok (over-reach guard); `auditBundle` reports `verdict:'tampered'` for an
  all-malformed log. Reverting the one-line guard flips the first test to a failure.

## verifyStripeSignature freshness check fails closed on a non-numeric timestamp — item 71 (branch claude/nice-ride-T6yb0, 2026-06-16)

438 worker tests (1 new); `_worker.js` + `tests/worker.test.js` only. `validate.sh` 33/36.

Socratic lens: *"Does the Stripe webhook replay-window check enforce its ±300s tolerance for every
parseable input?"* No. The check was `if (Math.abs(Date.now()/1000 - parseInt(timestamp)) > 300) return false;`.
`parseInt('abc')` is `NaN`, and `Math.abs(now - NaN)` is `NaN`, and `NaN > 300` is `false` — so a
non-numeric (but truthy) timestamp silently SKIPS the staleness check (fail-open). The freshness check
is the replay-window guard; a guard that no-ops on malformed input is a defense-in-depth defect.

- **Impact**: Not directly exploitable — the HMAC comparison (signed over `timestamp + '.' + payload`)
  is the primary forgery gate, and a replay of a genuine Stripe event carries a real numeric timestamp
  that the `> 300` check still catches. But the replay-window check itself failed open: a test that
  produces a *valid* HMAC over a non-numeric timestamp (only the secret holder can) was accepted (200,
  slots granted) under the old code, when it should have been rejected by the freshness guard.
- **Fix**: parse explicitly and fail closed — `const tsNum = parseInt(timestamp, 10); if (!Number.isFinite(tsNum)) return false;`
  before the tolerance comparison. Mirrors the `Number.isFinite` guards already used for the PoW
  freshness check (~688), the `/msg/poll` cursor, and `disappearAt` elsewhere in the file.
- **Test (1, mutation-verified)**: a validly-signed webhook with `t=abc` is now rejected (400) with no
  billing side effect; reverting the fix flips it to 200 with slots granted (confirmed the guard is
  what rejects it).

## Group invite token: fixed-length uniform 12-char base-36 generator — item 70 (branch claude/nice-ride-T6yb0, 2026-06-16)

437 worker tests (2 new, 1 updated); `_worker.js` + `tests/worker.test.js` only. `validate.sh` 33/36.

Socratic lens: *"Does the group invite token generator always produce a fixed-length, uniformly-distributed
token?"* No. The old generator did `Array.from(bytes).map(b => b.toString(36)).join('').slice(0,12)` with
only 8 random bytes. `b.toString(36)` yields 1 char for b ∈ [0,35] and 2 chars for b ∈ [36,255]. When all
8 bytes happen to be in [0,35] (each contributes 1 char), the joined string is 8 chars and `slice(0,12)`
returns an 8-char token — not 12. An 8-char base-36 token has only ≈41 bits of entropy instead of the
expected ≈62 bits. The probability of this worst case is (36/256)^8 ≈ 0.003%, but the partial-coverage
problem is continuous: any byte in [0,35] reduces the bits contributed by that position.

- **Impact**: Token shorter than 12 chars means the KV key `grp:${token}` is shorter, and an attacker
  brute-forcing group tokens has a meaningfully smaller search space (2^41 vs. 2^62) for the rare but
  possible short tokens. Additionally, the distribution of 12-char tokens is non-uniform because the
  first byte in [0,35] maps to 1 char while bytes in [36,255] map to 2 chars, creating a bias toward
  tokens starting with digits/letters that correspond to small byte values.
- **Fix**: Replace with a uniform generator — request exactly 12 random bytes and map each to one of 36
  chars via `TOKEN_CHARS[b % 36]`. The modulo bias is (256 mod 36)/256 ≈ 1.5%, negligible for an invite
  token. Output is always exactly 12 base-36 chars with ≈62 bits of entropy.
- **Tests (2 new)**: 20 generated tokens are all exactly 12 chars matching `/^[0-9a-z]{12}$/` and unique;
  a mutation-witness test proves the old generator DID produce 8-char tokens for all-small-byte inputs
  while the new generator produces 12-char tokens for the same input.

## Explicit KV cache size guard for translate + AI handlers — item 69 (branch claude/nice-ride-T6yb0, 2026-06-16)

435 worker tests (2 new); `_worker.js` + `tests/worker.test.js` only. `validate.sh` 33/36.

Socratic lens: *"If an AI/translation provider returns a larger-than-expected response, is there an
explicit guard preventing it from being written to KV at full size?"* No. Both `handleTranslate` and
`handleAI` cached the raw API response without a size check. Inputs are bounded (2000-char text,
500-token AI limit), so the implicit bounds are low — but they are not asserted at the write site.

- **Impact**: A provider bug, configuration change, or unexpected behavior (e.g., token limit
  ignored) could produce a response 10–100× the typical size. With no guard, every such response
  gets cached for 7 days (`tr:`) or up to 3 days (`ai:`), consuming disproportionate KV storage
  per key. Accumulated across users this could exhaust the free-tier KV write budget or pollute the
  cache with oversized stale entries.
- **Fix (`handleTranslate`)**: cap `translated` to 8000 chars before constructing the cache object
  (generous 4× the 2000-char input max), then also check `serialized.length <= 64 * 1024` before the
  KV write — skip caching if the envelope is somehow still too large. The full (possibly uncapped)
  response is still returned to the caller; only the stored value is guarded.
- **Fix (`handleAI`)**: same pattern — cap `result` to 8000 chars (4× a 500-token response), then
  serialized-size check `<= 32 * 1024` before the KV write.
- **Tests (2)**: a mock provider returning a 20,000-char string produces a 8000-char response and
  does not store more than 64KB in KV; a mutation-witness test confirms the cap IS what prevents
  full-length storage.

## handlePreKeyFetch per-IP OTP consumption lock — OTP drain attack prevention — item 68 (branch claude/nice-ride-T6yb0, 2026-06-16)

433 worker tests (3 new, 1 updated); `_worker.js` + `tests/worker.test.js` only. `validate.sh` 33/36.

Socratic lens: *"Can an unauthenticated caller drain another user's one-time prekeys?"* Yes.
`handlePreKeyFetch` required only a valid `userId` — no proof of caller identity. With the rate limit
at 10 rpm per source IP, a single IP could exhaust all 100 OTPs in 10 minutes. An attacker who drains
a user's OTPs forces all future X3DH session setups to fall back to the signed pre-key only (no DH4
component), degrading forward secrecy for every new conversation.

- **Impact**: 100 OTPs × 10 rpm → drained in 10 minutes from one IP. The `replenishOTP` flag would
  fire, but the owner might be offline; in the window before replenishment every new initiator loses
  DH4 forward secrecy silently.
- **Fix**: Before consuming an OTP, hash the source IP (`CF-Connecting-IP` via `sha256Short`) and
  check `otp_lock:{targetUserId}:{ipHash}` in KV. If the key exists (24 h TTL), skip OTP consumption
  but still return the SPK-only bundle (200, no `oneTimePreKey`). Write the lock key **after**
  successful consumption. Result: each source IP can consume at most one OTP per target user per 24 h.
  Draining all 100 OTPs now requires 100 distinct source IPs.
- **Reconciliation guard**: the existing stale-count reconciliation (`if (!consumed && count > 0)`)
  was extended to `if (!consumed && count > 0 && !ipAlreadyConsumed)` — prevents the reconciliation
  from incorrectly zeroing the stored OTP count when the loop was intentionally skipped due to the
  IP lock (OTPs still exist in KV; count is accurate).
- **Batch path**: `handlePreKeyFetchBatch` delegates to `handlePreKeyFetch` with the same `request`
  object, so the per-IP lock applies to batch fetches automatically with no extra code.
- **Tests (3 new, 1 updated)**: same-IP double-fetch returns bundle but no OTP; two different IPs each
  consume one OTP independently; mutation guard (manually clearing lock re-enables consumption,
  proving the lock is what prevents the drain). The existing "consumes exactly one OTP" test updated
  to verify the new same-IP blocking behavior and cross-IP consumption separately.

## sha256Short extended from 8 to 16 bytes — KV cache key collision resistance — item 67 (branch claude/nice-ride-T6yb0, 2026-06-16)

430 worker tests (0 new, 1 updated); `_worker.js` + `tests/worker.test.js` only. `validate.sh` 33/36.

Socratic lens: *"Does `sha256Short` provide enough collision resistance for KV cache keys?"*  No.
The function kept only the first 8 bytes (16 hex chars) of SHA-256, giving 2^32 birthday-collision
resistance. For a cache serving an adversarial mix of user-supplied URLs (`ogp:`), translation payloads
(`tr:`), and AI summaries (`ai:`), an attacker who can submit ~2^16 distinct inputs has a ~50 % chance
of a cache-key collision. A collision causes one user's cached OGP card or AI summary to be served in
place of another's — an information-disclosure side-channel (wrong preview shown) and a cache-poisoning
vector (bad actor crafts a URL that collides with a legitimate key and poisons its cached value).

- **Impact**: 2^32 birthday bound → ~65,000 unique inputs needed for a 50 % collision probability.
  The KV namespace is shared across all users and URL inputs; an active attacker can reach that
  threshold in minutes. Consequence: wrong OGP metadata served to other users, or stale/poisoned AI
  summaries returned without re-fetching.
- **Fix**: change `slice(0, 8)` → `slice(0, 16)` in `sha256Short`. Output grows from 16 to 32 hex
  chars — a no-op from the KV key-limit perspective (16 extra chars vs. a 512-byte limit with
  prefix lengths of ≤6 chars + separator). Birthday bound rises to 2^64 — computationally infeasible.
- **Tests (1 updated)**: the OGP cache-hit test recomputes the expected KV key using `slice(0, 16)`
  to mirror the new output. Mutation-verified (reverting to slice(0,8) causes the key-lookup to miss
  and the test to fail).

## Monotonic timestamp bump for handleSealedSend — same-millisecond ACK race — item 66 (branch claude/nice-ride-T6yb0, 2026-06-16)

430 worker tests (2 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens: *"Does `handleSealedSend` guarantee strictly-increasing timestamps, as `handleMsgSend`
does?"* No. `handleSealedSend` pushed `{ envelope, ts: Date.now() }` without bumping on collision.
`handleSealedAck` keeps survivors with `m.ts > hwm` (strict greater-than). If a new envelope arrives
after a poll but in the **same millisecond** as the polled batch's max ts (the hwm), the new entry
shares `ts == hwm` → `m.ts > hwm` is false → the ack deletes it even though it was never polled:
a silent message loss on the "reliable" sealed path.

- **Impact**: a message in flight at the exact millisecond boundary between poll and ack is silently
  dropped. The window is sub-millisecond and requires the new KV write to land before the ack, so
  probability is low — but the sealed path is specifically designed to be the reliable fallback, so
  any loss violates that contract.
- **Fix (`handleSealedSend`)**: before pushing, compute `newTs = max(Date.now(), lastEntry.ts + 1)`
  (exact mirror of the existing fix in `handleMsgSend`). The last element always holds the max ts
  because appends are sequential; no full-scan needed.
- **Tests (2)**: two envelopes frozen to the same millisecond get distinct strictly-increasing ts
  values; the same-millisecond second envelope survives a poll+ack cycle that would have deleted it
  under the old behavior. Both mutation-verified (old code makes the survival test fail).

## validateUserId upper bound tightened from 512 to 128 — KV key overflow prevention — item 65 (branch claude/nice-ride-T6yb0, 2026-06-16)

428 worker tests (7 new, 1 updated); `_worker.js` + `tests/worker.test.js` only. `validate.sh` 33/36.

Socratic lens: *"Can a userId that passes `validateUserId` produce a composite KV key exceeding the
Cloudflare KV 512-byte key limit?"* Yes. The regex allowed IDs up to **512 chars**; the longest KV
key prefix is `prekey:otp:...:99` (14 chars), so the composite key could reach **526 bytes** —
silently causing every `kvGet` to return `null` and every `kvPut` to return `false` (write fails)
for any user with a long ID.

- **Impact**: Any endpoint that uses such an ID gets silent KV failures: `handleMsgSend` returns
  `STORE_FAILED`, `handlePreKeyUpload` stores nothing and silently drops the bundle, `handlePresence`
  batch-check returns `online: false` for the long-ID user. No real-world userId is 512 chars, so
  this had zero practical effect — but the named-field body guard at line ~266 already caps
  `userId`/`to`/`from` at 128, making the `validateUserId(512)` bound an inconsistency that could
  bite array-element paths (e.g., `ids[]` in the presence batch) or direct-call sites.
- **Fix A (`validateUserId`)**: cap at 128 chars (was 512). 128 + 14 = 142 bytes — well within the
  512-byte KV limit. Still generous: real IDs are ≤88 chars (P-256 base64).
- **Fix B (rate-limit map)**: removed duplicate `'/api/group/create': 5` and `'/api/group/join': 10`
  entries that were left behind when item 55 inserted them before the `/api/portal` entry.
  JavaScript objects silently keep the last value for duplicate keys; since the values were identical
  the behavior was unchanged, but the dead entries were misleading to future maintainers.
- **Tests (7 new, 1 updated)**: 128-char passes; 129-char and 512-char rejected; minimum 8-char
  still passes; below-minimum 7-char still rejected; `handlePreKeyUpload` rejects a 129-char userId;
  existing length-bounds test updated from `<= 512` to `<= 128`. Bound guard mutation-verified.

## Durable group kick — banned member cannot rejoin via invite token — item 64 (branch claude/nice-ride-T6yb0, 2026-06-16)

422 worker tests (5 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens on the kick flow: *"what stops a kicked member from immediately rejoining with the
same invite token?"* Nothing. `handleGroupKick` removed the target from `group.members` but left
the group's invite token intact; as long as the kicked user still knew the token (they did — it
never changes) they could call `/api/group/join` again and be re-added with no obstacle.

- **Impact**: kick was cosmetic — the "removed" member rejoined instantly. They could also rejoin
  mid-epoch and receive the next sender-key distribution, retaining full decrypt capability.
- **Fix A (`handleGroupKick`)**: write a `group.banned` array (capped at 200 entries, sanitized
  to strings) alongside the existing member-array removal. Each kick appends the kicked userId;
  duplicate entries are suppressed.
- **Fix B (`handleGroupJoin`)**: check `group.banned` before adding the caller to `members`; return
  `403 BANNED` immediately to a banned member regardless of token validity.
- **Fix C (`handleGroupAdmin`)**: add an `'unban'` action that lets the creator remove a userId
  from `group.banned`; idempotent (returns `notBanned: true` if the id wasn't banned). The action
  validator was expanded to accept `'promote' | 'demote' | 'unban'`. Added `'group-ban'` to the
  health capabilities list.
- **Tests (5)**: kicked member gets `403 BANNED` on rejoin; non-kicked member joins normally;
  creator unbans → member may rejoin; unban is idempotent; non-creator cannot unban. Ban guard
  and unban guard mutation-verified.

## Stale OTP count outlived its entries → phantom prekeys, suppressed replenish — item 63 (branch claude/nice-ride-T6yb0, 2026-06-16)

417 worker tests (3 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens on the OTP accounting: *"can `prekey:otp:${userId}:count` and its OTP entries get out
of sync?"* Yes. Upload writes the entries and `count` with a 30-day TTL; every fetch refreshes the
**count** key's TTL to a fresh 30 days but never touches the unconsumed entries, which keep their
**original** upload-time TTL. So after sporadic fetches, the entries can all expire while `count`
lingers at e.g. 8.

- **Impact**: `handlePreKeyFetch` then scans, finds nothing, but `remainingOTP` stayed at the stale
  count → `replenishOTP` stayed **false** and no OTP was delivered → new X3DH sessions silently lose
  the DH4/OTP component (forward-secrecy degradation) with no signal. Worse, `handlePreKeyStatus`
  (the owner's self-audit) reported `otpCount: 8, replenishOTP: false` — telling the owner they have
  8 OTPs when they have **zero**, so they never replenish.
- **Fix A (`handlePreKeyFetch`)**: track whether the scan consumed anything; if `count>0` but nothing
  was consumed, set `remainingOTP = 0` (honest replenish signal) and, when no entry was found at all,
  heal the stale count to 0. Don't corrupt the count on transient delete failures.
- **Fix B (`handlePreKeyStatus`)**: the entry at index `count-1` is always the next to be consumed
  and all entries from one upload share a TTL, so one extra KV read of the top entry detects full
  expiry; report `otpCount: 0` + `replenishOTP: true` and heal the count when so.
- **Tests (3)**: stale-count-with-expired-entries → fetch returns no OTP + replenish + healed count;
  status reports 0 + replenish + healed count; status still reports the real count when the top
  entry is present. Both healing paths mutation-verified.

## Optional Ed25519 ownership auth for push subscribe — item 62 (branch claude/nice-ride-T6yb0, 2026-06-15)

414 worker tests (5 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens: continuing the "knowing a userId shouldn't grant a sensitive action" sweep — does
`handlePushSubscribe` verify the caller owns the userId? No. It stored any device under
`push:${userId}` after only an SSRF check on the endpoint.

- **Leak**: the Web Push payload is encrypted to the SUBSCRIBER-supplied `p256dh`/`auth` keys, so an
  attacker who knows a victim's userId can register their **own** device and decrypt the victim's
  notification metadata (sender display name, message type, contactId, timing). They could also
  evict the victim's real devices via the 5-device cap (denial of notification).
- **Change**: `handlePushSubscribe` now accepts optional `{ ts, sig }` over
  `breeze-push-subscribe:${userId}:${ts}`, verified against the userId's registered `edIdentityKey`.
  Enforced when `PUSH_REQUIRE_AUTH=true`; verified-when-present otherwise (unsigned clients keep
  working). Added `push-auth` to the health capabilities list. This completes the optional-auth
  sweep across portal / group / backup / alias / push.
- **Tests (5)**: unsigned works (flag off); flag-on rejects unsigned (`AUTH_REQUIRED`); valid signed
  succeeds with flag on; tampered sig → `SIG_INVALID`; partial auth (sig without ts) → 400. Flag and
  signature guards mutation-verified.

## Optional Ed25519 ownership auth for alias registration — item 61 (branch claude/nice-ride-T6yb0, 2026-06-15)

409 worker tests (6 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens on the alias set/delete asymmetry: alias **delete** requires an Ed25519 ownership
signature (and checks `aliasRec.pub === bundle.identityKey`), but alias **set** only requires PoW —
which proves *work*, not *key ownership*. So a first-come registrant could point an unclaimed
`@handle` at **someone else's** identity key (impersonation) or mass-squat handles; PoW only
rate-limits this, it doesn't prevent it.

- **Change**: `handleAliasSet` now accepts optional `{ userId, ts, sig }`. When present it requires
  the signer's registered `edIdentityKey` to validly sign `breeze-alias-set:${alias}:${ts}` **and**
  that `bundle.identityKey === pub` (you can only alias your own identity key) — binding the @handle
  to the account that owns the key, exactly as alias-delete already does. Enforced outright when
  `ALIAS_REQUIRE_AUTH=true`; verified-when-present and skipped when absent otherwise (PoW-only
  clients keep working). Distinct challenge prefix prevents cross-endpoint replay. Added `alias-auth`
  to the health capabilities list.
- **Tests (6)**: legacy PoW-only works (flag off); flag-on rejects unsigned (`AUTH_REQUIRED`); valid
  signed succeeds with flag on; `PUB_MISMATCH` when the signed pub ≠ account identity key; tampered
  sig → `SIG_INVALID`; partial auth (ts without sig) → 400. Both core guards mutation-verified.

## Translation cache key collided across distinct inputs — item 60 (branch claude/nice-ride-T6yb0, 2026-06-15)

403 worker tests (2 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens on the translate cache key: *"does `text + src + tgt` uniquely identify a request?"*
No — the three fields are concatenated with **no delimiter**, and src/tgt are short, variable-length
language codes sitting right after free-form text.

- **Bug**: `("test","en","ja")` and `("teste","n","ja")` both hash `"testenja"` → identical cache
  key. The second requester is served the **first's cached translation** — wrong output, and a
  cache-poisoning vector (an attacker can pre-seed a key a victim's request will collide with).
- **Fix**: key on `JSON.stringify([text, src, tgt])`, which quotes/escapes each field so boundaries
  are unambiguous. (Audited `handleAI`'s `action + userContent + systemPrompt` key — its fixed
  action prefix and fixed per-action systemPrompt suffix bracket the variable middle, so it's
  injective and not vulnerable; left unchanged.) One-time effect: existing `tr:` cache entries miss
  once and re-populate under the new key.
- **Tests (2)**: a colliding pair now returns each input's own translation with `cached:false`
  (mutation-verified — the old concat fails this); an identical repeated request still hits the
  cache exactly once (proves legitimate caching preserved).

## OGP body-read had no time bound (slow-drip tie-up) — item 59 (branch claude/nice-ride-T6yb0, 2026-06-15)

401 worker tests (1 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens on `fetchWithTimeout`: *"what exactly does the 5s timeout protect?"* It aborts on
time-to-HEADERS and is cleared the instant headers arrive — so the subsequent 32KB body read in
`handleOGP` had **no** time bound.

- **Gap**: a slow-drip server (fast headers, then a byte-per-second body, or a chunk that never
  completes) keeps `reader.read()` trickling and ties up the worker far past the intended budget.
  The existing memory cap (truncate to 32KB) does nothing against a *time* attack.
- **Fix**: race each `reader.read()` against a remaining-time deadline so total body-read time is
  bounded; on timeout, proceed with whatever was parsed (the handler already returns `{}` / partial
  preview gracefully). Budget is operator-tunable via `OGP_READ_BUDGET_MS` (clamped 200ms–15s,
  default 5s) for slow-link self-hosters.
- **Test**: a stream that emits one chunk then never closes; with a 300ms budget the handler returns
  in ~300ms with the title still parsed from the first chunk. Mutation-verified: removing the
  deadline makes the read hang until the 5s test-runner timeout.

## Account-delete left the sealed-poll high-water mark behind — item 58 (branch claude/nice-ride-T6yb0, 2026-06-15)

400 worker tests (assertion extended); `_worker.js` only. `validate.sh` 33/36.

Socratic lens on GDPR erasure: *"does the deletion list actually cover every key keyed by this
userId?"* Enumerating all userId-keyed KV entries against `handleAccountDelete`'s `dels` array found
one miss: `sealed:${userId}:hwm`, the sealed-poll high-water mark written by `handleSealedPoll`.

- **Gap**: after a validated account deletion, `sealed:${userId}:hwm` lingered for its 300s TTL —
  residual user-linked data (it reveals the account existed and the timestamp of its last polled
  sealed message). The handler's own documented intent is to erase residual data *now* rather than
  wait for TTLs (it already deletes the 6-min-TTL `presence:` key for exactly this reason).
- **Fix**: add `kvDel(env, \`sealed:${userId}:hwm\`)` to the deletion batch.
- **Test**: the "erases every userId-keyed store" test now seeds and asserts the hwm key is null
  after deletion. Mutation-verified: removing the delete fails the test.

## Relay dedup key not released on STORE_FAILED → lost message on retry — item 57 (branch claude/nice-ride-T6yb0, 2026-06-15)

400 worker tests (3 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens on the dedup/store ordering: both relay paths (`handleMsgSend`, `handleSealedSend`)
set an in-memory dedup key **before** the KV write. Premise to test: *"what happens to that key when
the write fails?"* — It stays set.

- **Bug**: on a `STORE_FAILED` (transient KV error), the dedup key remains. The client, seeing a 500,
  retries the **identical ciphertext** — which now hits the dedup short-circuit and returns
  `{ok:true, dedup:true}`. The message is silently dropped despite never having been stored. This
  defeats the at-least-once delivery the 500→retry contract is supposed to provide, on **both** the
  1:1 inbox and the "reliable" sealed-sender path.
- **Fix**: on a failed store, `delete(dedupKey)` before returning 500, so the retry actually persists.
  Genuine duplicates (after a *successful* store) are still deduped — the key is only released on the
  failure path.
- **Tests (3)**: failed-store-then-retry persists exactly one message (msg + sealed paths); a genuine
  duplicate after a successful store is still collapsed to one. Mutation-verified: removing either
  un-mark fails the corresponding retry test while the duplicate test stays green.

## OGP link-preview corrupted multibyte UTF-8 at chunk boundaries — item 56 (branch claude/nice-ride-T6yb0, 2026-06-15)

397 worker tests (1 new); `_worker.js` only. `validate.sh` 33/36.

長所短所改善点 stocktake: the relay is in good shape — crypto well-tested, KV-failure propagation
swept, optional-auth pattern now consistent (portal/group/backup), SSRF hardened, rate limits
complete, all in-memory caches bounded. The remaining gaps are infra-bound (per-user limits and
one-time-read atomicity need Durable Objects; CI activation needs a maintainer — item 52). Hunting
for a self-contained server-side win surfaced a real correctness bug in OGP.

- **Bug**: `handleOGP` created a fresh `new TextDecoder()` per body chunk and decoded without
  `{ stream: true }`. A multibyte UTF-8 sequence (e.g. a 3-byte Japanese character `あ` = E3 81 82)
  split across a `reader.read()` boundary became two replacement characters (�) — corrupting
  non-ASCII titles/descriptions. Direct hit for a Japanese-first app's link previews.
- **Fix**: one streaming `TextDecoder` instance across the whole body (`decode(value, {stream:true})`
  per chunk + a final flush on natural end), so partial multibyte bytes are held and reassembled.
- **Test**: splits `あ` so its first two bytes land in chunk 1 and the last in chunk 2; asserts the
  extracted `<title>` decodes to `あ`. Mutation-verified: the per-chunk decoder yields `�`.

## group/create + group/join missing from rate-limit table — item 55 (branch claude/nice-ride-T6yb0, 2026-06-15)

396 worker tests (3 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens: *"what does the rate limiter actually receive vs. what it assumes?"* Every path absent
from the `limits` table defaults to 30 rpm. Both `/api/group/create` and `/api/group/join` write to
KV on every call and were absent — so the effective limit was 30 rpm instead of the more careful
rates used for other write-heavy endpoints (`prekey/upload: 5`, `backup/upload: 2`, `drop/create: 10`).

- At 30 rpm, a single IP can exhaust the Cloudflare free-tier KV write budget (1000/day) in ~33
  minutes, wedging the entire relay (all subsequent KV writes fail until midnight reset).
- Added `/api/group/create: 5` and `/api/group/join: 10` to the explicit limits table, with a
  comment explaining why.
- Tests: pin the 5 rpm create limit (rejects on 6th, passes on 5th) and the 10 rpm join limit
  (rejects on 11th). Mutation-verified: raising create limit to 60 causes the 429-at-6 test to fail.

## Backup BACKUP_REQUIRE_AUTH enforcement flag — item 54 (branch claude/nice-ride-T6yb0, 2026-06-15)

393 worker tests (5 new); `_worker.js` only. `validate.sh` 33/36.

Socratic lens: the same "optional-auth with enforcement flag" pattern used by `PORTAL_REQUIRE_AUTH`
and `GROUP_REQUIRE_AUTH` was already in the health endpoint's `capabilities` list as `'backup-auth'`,
but neither `handleBackupUpload` nor `handleBackupDownload` had a `BACKUP_REQUIRE_AUTH` enforcement
path. The gap: **knowing a userId is enough to download the encrypted backup blob and brute-force
the passphrase offline** — whereas the portal and group endpoints can be hardened the same way.

- Added `} else if (env.BACKUP_REQUIRE_AUTH === 'true') { return 403 AUTH_REQUIRED }` to both
  upload and download, after the `hasSig` branch — exactly the pattern of the other two flags.
- No behavior change when flag is unset (backward-compat preserved).
- Added comment to download explaining the security model and recommended activation order.
- **Tests (5)**: flag-on rejects unsigned upload and download; valid signed upload/download succeed
  with flag on; backward-compat path (flag unset) stays open. Mutation-verified.

## SSRF guard over-blocked fc*/fd* hostnames — item 53 (branch claude/nice-ride-T6yb0, 2026-06-15)

388 worker tests (2 new); `_worker.js` only, no client change. `validate.sh` 33/36.

A Socratic "verify the premise against real input" pass on the operator-misconfiguration /
graceful-degradation audit confirmed the env-dependent handlers degrade cleanly (`handleTranslate`
→ 502 `TRANSLATE_FAILED`, `handleAI` → 503 `NO_AI` / 502 `AI_FAILED`, `handleTurn` ships free
fallbacks, router has a catch-all 500 with request id, `503 KV_NOT_CONFIGURED`). That audit came
back clean — but the same "test the guard against actual values" lens on `isSSRFBlocked` surfaced
a real over-blocking bug.

- **Bug**: the IPv6 ULA/link-local prefix checks (`startsWith('fc')`, `startsWith('fd')`,
  `startsWith('fe80')`, `startsWith('::ffff:')`) ran against **every** host, including bare DNS
  hostnames. `'fc2.com'.startsWith('fc')` → `true`, so **FC2** (a major Japanese hosting/blog
  service) and `fdroid.org` were silently blocked from link previews (`handleOGP` returns `{}`).
- **Fix**: gate the IPv6-literal-only checks behind `host.startsWith('[')`. Verified via the URL
  parser that IPv6 literals **always** arrive bracketed (unbracketed `::1` throws) and that
  decimal/hex/octal IPv4 (`2130706433`, `0x7f000001`, `0177.0.0.1`) normalize to dotted-decimal —
  so the unconditional IPv4 checks still catch them with no regression.
- **Tests**: added "does NOT over-block fc/fd/fe80 hostnames" (fc2.com, fdroid.org, feeds.*) and a
  regression guard "still blocks real IPv6 ULA/link-local/loopback literals" (`[::1]`, `[fc00::1]`,
  `[fd12:3456::1]`, `[fe80::1]`, `[::ffff:10.0.0.1]`). Mutation-verified: removing the gate fails
  the over-block test.

## CI not enforced on GitHub — finding + activation runbook — item 52 (branch claude/nice-ride-T6yb0, 2026-06-13)

638 tests; docs-only (the actionable fixes — push workflows, merge to main — require
permissions/PR I don't have).

A Socratic "process" audit verified the assumption every prior item rests on — that the test
suite gates merges — and found it **false**:

1. The default branch (`main`) root contains **only `breeze.zip`** — no source — so
   `actions/checkout` sees no code and CI cannot run there (the Phase 0 blocker).
2. The unpacked source + 638 tests + `src/crypto/` live on the working branch, **not merged**.
3. `.github/workflows/` is `.gitignore`d on every branch because the automation account lacks
   GitHub's `workflows` scope, so the CI config exists only in the ephemeral working tree.

Net: `npm test` / `validate.sh` / syntax / zip-build do **not** run on GitHub; all the
hardening from items 26–51 is locally green but **ungated**, and the CI config itself isn't
version-controlled.

- **`docs/CI-SETUP.md` (new)**: records the finding, **preserves the canonical `ci.yml` in
  version control** (it was otherwise only inside the gitignored tree / `breeze.zip`), and
  gives the maintainer a 3-step activation runbook (merge source to `main`; add the workflow
  from a `workflows`-scoped account; verify via a no-op PR). Plus Node-version and
  first-`<script>`-extraction caveats.
- The branch is merge-ready: 638 tests green, `validate.sh` 33/36.

## Flaky pow.test.js de-flaked (test-integrity) — item 51 (branch claude/nice-ride-T6yb0, 2026-06-13)

638 tests; test-only, no production change. Three consecutive full-suite runs now green.

A Socratic "new perspective" pass first audited the cryptographic core (`src/crypto/`) — `group.js`
(37 tests: forward secrecy, epoch revocation, key-commitment, two-layer signature stripping/
tampering, legacy fallback) and `franking.js` (9 tests: binding, hiding, forged/tampered
opening+commitment) are genuinely well-covered, confirmed non-vacuous by mutation-testing the
worker's X3DH and franking guards. That left the recurring footnote: `pow.test.js` intermittently
timed out at 30s under parallel load — and an intermittently-red test corrodes trust in the whole
suite (the foundation item 50 was about).

- **Root cause**: a difficulty-16 solve is ~65k awaited `subtle.digest` calls — the suite's
  heaviest op — and the file did it twice (the shared token *and* a separate solve in the clamp
  test). Under CPU contention the 30s budget was marginal.
- **Fix (test-only — `pow.js` is browser-gated)**: solve once. `getToken()` now requests
  difficulty 0, which the module clamps up to the 16 minimum, so the single shared token also
  serves as the clamp test's evidence (its `.difficulty` is 16). Redundant second solve removed;
  solve-dependent timeouts raised 30s→60s for margin.
- **Result**: ~halved the suite's heaviest work; 3× full-run green. The "pow occasionally times
  out" caveat is retired from the docs.

## PoW anti-spam floor + challenge-bound now have negative tests — item 50 (branch claude/nice-ride-T6yb0, 2026-06-13)

638 tests (+2); test-only, no production change.

A Socratic "new perspective" turned the lens on the test suite itself — the foundation every
prior item leaned on. Mutation-testing the pre-existing security guards confirmed the X3DH
signed-prekey check (MITM protection) and the franking HMAC binding are genuinely tested
(neutralizing each fails its test). But the alias PoW guard had a coverage hole: of its three
conditions (`difficulty < 16 || challenge.length > 512 || !challenge.includes(pub)`), only the
`includes(pub)` branch had a negative test. The **difficulty-16 anti-spam floor** — the core
cost of registering an alias — was untested, so a regression weakening it (cheap alias spam /
squatting) would pass the whole suite.

- **Tests (+2)**: a validly-solved but too-easy (difficulty 8) PoW is rejected with
  `POW_INVALID` (isolating the floor branch); an oversized (>512-char) challenge is rejected.
  Mutation-verified — lowering the floor to `< 4` lets the difficulty-8 solve through and fails
  the test.

## Cross-protocol signature-replay invariant pinned — item 49 (branch claude/nice-ride-T6yb0, 2026-06-13)

636 tests (+3); test-only, no production change.

A Socratic "new perspective" pass: instead of auditing handlers individually, audit the auth
system as a whole for a cross-cutting invariant the six signed operation families (account-delete,
alias-delete, backup-upload, backup-download, portal, group×6) all depend on but which no test
enforced — **a signature minted for one operation must never authorize another**. Enumerating
every challenge string confirmed the invariant holds: each uses a distinct namespaced prefix,
backup up/down use different *verbs* (so a captured upload-auth can't be replayed to *read* the
backup), and group challenges are per-action (`breeze-group-${action}`). That's a genuine
strength — but a future endpoint reusing a prefix would silently reintroduce cross-protocol
replay with nothing to catch it.

- **Tests (+3)**: pin the invariant on the highest-impact pairs — a backup-upload sig is rejected
  by backup-download (no write-auth→read replay); a portal sig is rejected by account-delete (no
  billing-auth→delete replay, and nothing is deleted); a group-rename sig is rejected by
  group-delete (no rename-auth→delete replay, and the group survives). Mutation-verified
  (colliding the download challenge with upload makes the upload sig replay through, failing the
  test).

## Relay queues bounded by bytes, not just count — item 48 (branch claude/nice-ride-T6yb0, 2026-06-13)

633 tests (+3); server-side only, normal sends unaffected.

The 1:1 inbox and the sealed-sender queue were capped at 100 messages but **not by total
bytes**. Payloads/envelopes can be up to 256KB, so 100 of them ≈ 25.6MB — past Cloudflare
KV's **25MB value limit**. Once a queue grew that large, every `kvPut` failed (→ `STORE_FAILED`
since item 27), **wedging the queue**: an offline recipient with a near-full queue received
nothing new until they polled, and senders just got 500s.

- **Fix**: new `capQueueBytes(items, sizeOf, maxBytes=16MB)` helper, applied to both queues
  after the count cap. It evicts oldest-first (FIFO) until the approximate serialized size is
  under a 16MB budget (wide headroom below the 25MB KV cap), always keeping the newest
  just-appended message — so a normal send is never blocked; a best-effort relay drops the
  oldest undelivered instead. O(n), serializes once (size approximated from the dominant
  payload/envelope field + per-message overhead).
- **Tests (+3)**: evicts oldest until under budget keeping newest; never drops the sole/newest
  item even if it alone exceeds budget; leaves an under-budget queue untouched. (Unit-tested on
  the exported helper with a tiny budget to avoid 16MB test fixtures.)

## Open-redirect in Stripe checkout/portal URLs fixed — item 47 (branch claude/nice-ride-T6yb0, 2026-06-13)

630 tests (+2); no behavior change for legitimate single-origin requests.

`handleAccountPurchase` and `handlePortal` built Stripe `success_url`/`cancel_url`/`return_url`
from `request.headers.get('Origin') || Referer`. The `Origin` header is forgeable by a
non-browser caller, so an attacker could craft a checkout/portal session whose post-flow
redirect points at their own domain — the victim completes the trusted `checkout.stripe.com`
flow and is then bounced to `attacker.com/?billing=account-success`, a credential-harvesting
phishing page riding the Stripe trust. Stripe does not restrict redirect domains by default.

- **Fix**: derive the redirect origin from `new URL(request.url).origin` — the worker's own
  served origin — instead of the client-supplied header. Breeze serves the app and the worker
  from the same origin, so legitimate redirects are unchanged; only forged Origins are
  neutralized. Applied to both billing handlers.
- **Tests (+2)**: a request with `Origin: https://attacker.example` produces redirect URLs on
  the worker's own origin (`breeze.test`) and never `attacker.example` — for both checkout and
  portal. Mutation-verified (reintroducing the Origin-header source fails the test).

## Complete the STORE_FAILED sweep — franking commit + push subscribe — item 46 (branch claude/nice-ride-T6yb0, 2026-06-13)

628 tests (+2); no wire change for the success path.

A fresh sweep for unchecked `kvPut`/`kvDel` (after items 27/33/34/35) confirmed the rest are
intentionally best-effort (ephemeral signal relay, poll/cleanup, presence heartbeat, caches,
the process-then-mark webhook dedup) — but two still returned `{ok:true}` while a silent write
failure broke a real guarantee:

- **`handleAbuseRecord`** (franking commitment): a dropped `frank:${frankId}` write left the
  sender believing franking was recorded, but a later `handleAbuseReport` would `404`
  (no commitment) — the message silently became unreportable. (Item 35 had fixed the *report*
  write but not the *commit* write.) Now returns `500 STORE_FAILED`.
- **`handlePushSubscribe`**: returned `{ok:true, devices:N}` even when the `push:${userId}`
  write failed, so the client believed push was registered and silently received none. Now
  returns `500 STORE_FAILED`.
- **Tests (+2)**: franking commit write failure → 500; push subscribe write failure → 500.

## Group moderation caller authentication — optional Ed25519 + enforcement flag — item 45 (branch claude/nice-ride-T6yb0, 2026-06-13)

626 tests (+4); additive, backward-compatible by default.

Socratic audit of the group moderation endpoints: kick / admin / transfer / rename / leave /
delete all authorize by comparing a **client-supplied** id (`adminId`/`memberId`) against
`group.creatorId`/`group.admins` — but `creatorId` is **publicly readable via `/api/group/info`**.
With no caller signature, any group member (or anyone holding the invite token) could read
`creatorId`, claim it, and kick members, self-promote, transfer ownership to themselves, rename,
or delete the group. Unlike message content, these are server-side state changes with no
client-side crypto recourse, so the E2E model does not cover them — a genuine privilege
escalation / group-takeover.

- **Fix**: new `checkGroupAuth` helper wired into all six mutation endpoints — optional
  `{ts, sig}` (Ed25519 over `breeze-group-${action}:${token}:${actorId}:${ts}`, verified
  against the actor's registered `edIdentityKey`, ±5min). Verified when supplied (forgeries
  rejected); required when `GROUP_REQUIRE_AUTH` is set — flip that on once clients sign. Default
  (no sig + flag unset) preserves the legacy flow so current clients keep working until updated
  (same staged-rollout pattern as the portal fix, item 42). Advertised as `group-auth` in
  health capabilities.
- **Tests (+4)**: legacy unauthenticated kick works by default; flag-on rejects unauthenticated
  kick/transfer/delete with `AUTH_REQUIRED` (and mutates nothing); valid sig → 200, tampered →
  `SIG_INVALID`; partial auth → `PARTIAL_AUTH`. Mutation-verified (bypassing the sig check fails
  the tampered-sig test).

## Stripe webhook body-size DoS guard + endpoint-count doc fix — item 44 (branch claude/nice-ride-T6yb0, 2026-06-13)

622 tests (+1); no wire change for legitimate traffic.

Socratic trace of the request path: `/api/webhook` is dispatched at the top of `fetch`
(before JSON parsing, to get the raw body for Stripe signature verification) — which means
it runs **before** the global `MAX_BODY_BYTES` guard. `handleWebhook` then did
`await request.text()` with no size limit of its own, so an attacker could POST an
arbitrarily large body and force the worker to buffer it and run HMAC-SHA256 over the whole
thing before the signature check rejected it — a resource-exhaustion vector unique to this
unguarded path.

- **Fix**: `handleWebhook` now caps the body itself — `Content-Length > MAX_BODY_BYTES` →
  413 (fast path), and `body.length > MAX_BODY_BYTES` → 413 after reading (Content-Length can
  be omitted/spoofed). Stripe events are far under 512KB, so legitimate webhooks are
  unaffected; the size check runs ahead of signature verification.
- **Doc accuracy**: the served endpoint count is 43 (41 switch cases + health + webhook). The
  file header said "32 API endpoints" and `/api/health` reported `endpoints: 42` — both
  corrected to 43.
- **Tests (+1)**: a 600KB webhook body → 413 (before the invalid signature's 400).

## Rate-limit Retry-After correctness + honest "dual layer" comment — item 43 (branch claude/nice-ride-T6yb0, 2026-06-13)

621 tests (+1); no wire change.

Socratic read of the rate limiter surfaced two stated-vs-actual gaps:

- **`retryAfter` could be 0**: `60 - (Date.now()/1000 % 60) | 0` truncates, so near a minute
  boundary it yields `0` — the JSON body then said `retryAfter:0` ("retry now", while the
  bucket is still full for up to ~1s) while the header said `String(0 || 60)` = `60`. Body and
  header disagreed and the body was wrong. Fixed to `Math.max(1, Math.ceil(60 - (Date.now()/1000) % 60))`
  (range [1,60], never 0) with the header using the same value, so the two always agree.
- **Comment overclaimed "per-IP + per-userId (dual layer)"**: the bucket key is
  `${ip}:${path}:${minute}` — there is no per-userId layer. Corrected the comment to describe
  what the code does (single per-IP/path/minute, in-memory per-isolate) and noted that a true
  cross-isolate per-user limit needs a Durable Object (deferred); the 'unknown'-IP tighter cap
  (item 31) is also documented there.
- **Tests (+1)**: `retryAfter` is in [1,60] and the body value equals the `Retry-After` header
  (no 0-vs-60 split).

## Billing portal IDOR/PII exposure — optional Ed25519 auth + enforcement flag — item 42 (branch claude/nice-ride-T6yb0, 2026-06-13)

620 tests (+5); additive, backward-compatible by default.

Socratic audit of `handlePortal`: it took only `{userId}`, looked up `slots:${userId}.customerId`,
and returned a Stripe **billing-portal session URL** — a bearer link exposing the customer's
invoices (name/email/address/card last4) and allowing subscription cancellation — with **no
proof the caller owns the account**. Since userId is publicly discoverable (alias lookup /
being a contact), anyone who knew a paying user's userId could mint their billing-portal link.
`handleAccountDelete`/`handleBackupUpload`/`handleAliasDelete` all require Ed25519 ownership
proof; `handlePortal` did not.

- **Fix (item-26 pattern + enforcement flag)**: `handlePortal` now accepts optional `{ts, sig}`
  (Ed25519 over `breeze-portal:${userId}:${ts}`, verified against the user's registered
  `edIdentityKey`, ±5min). When supplied it's verified and forgeries are rejected; when absent
  it's allowed **only if `PORTAL_REQUIRE_AUTH` is unset** — set that env flag (once clients send
  the signature) to require auth outright. Default path is byte-for-byte unchanged, so the
  current client's portal button keeps working until updated (mandatory auth needs the
  browser-gated client change). Advertised as `portal-auth` in health capabilities.
- **Tests (+5)**: legacy unauthenticated works by default; flag on + no sig → `AUTH_REQUIRED`;
  valid sig → 200, tampered → `SIG_INVALID`; partial auth → `PARTIAL_AUTH`, stale ts →
  `INVALID_TIMESTAMP`; signed but no identity key → `NO_IDENTITY_KEY`. Mutation-verified
  (bypassing the sig check fails the tampered-sig test).

## Same-millisecond message loss on /msg/poll fixed server-side — item 41 (branch claude/nice-ride-T6yb0, 2026-06-13)

615 tests (+2); server-side only, backward-compatible (no client change required).

The implementation plan documented an unfixed bug: the 1:1 poll cursor uses `m.ts > lastTs`,
so a second message that stores with the *same* millisecond ts as an already-delivered one
is dropped forever. Loss path: client polls up to `lastTs=T` → a second message stores with
`ts=T` → next poll's `m.ts > T` excludes it → the 10s cleanup later purges it undelivered.
The plan's proposed fix required a client cursor change (msgId-exclusive); this lands a
**fully server-side** fix instead.

- **Fix**: `handleMsgSend` now guarantees strictly-increasing per-inbox timestamps — if an
  incoming message's ts is `<=` the last stored message's ts, it's bumped to `last + 1`.
  Appends are sequential so the last element always holds the max ts; the `m.ts > lastTs`
  cursor becomes lossless with no client change. Display order is preserved, sub-ms drift is
  invisible, and `msg.id` remains the dedup key so a bumped ts never causes a re-render.
- **Scope**: only the 1:1 path uses a ts cursor; sealed-sender clears via ACK (item 40), so
  no change needed there.
- **Tests (+2)**: a message sharing a ms with an already-polled one is still delivered;
  three same-ts sends store as strictly-increasing `[T, T+1, T+2]`. Mutation-verified
  (disabling the bump fails both).

## Sealed-sender ACK no longer drops messages sent in the poll→ack window — item 40 (branch claude/nice-ride-T6yb0, 2026-06-13)

613 tests (+4); server-side only, backward-compatible (no client change required).

Socratic read of the sealed-sender flow (the path CLAUDE.md calls "reliable") against
`handleSealedAck`: the ACK took only `{id}` and blind-deleted the entire `sealed:${id}`
queue. Trace: client polls `[m1,m2]` (grace TTL set) → a sender's `handleSealedSend`
appends `m3` → client ACKs → `kvDel` wipes the whole key, so **m3 is destroyed
undelivered**. Any envelope arriving in the poll→ack window was silently lost.

- **Fix (fully server-side)**: `handleSealedPoll` records a high-water mark
  (`sealed:${id}:hwm` = max ts of the returned batch, 5-min TTL). `handleSealedAck` keeps
  any envelope with `ts > hwm` (arrived after the poll) and clears the rest — selective
  delete instead of blind delete. No high-water mark (client never polled / pre-hwm ACK) →
  falls back to the original full delete, so existing clients are unaffected and benefit
  immediately without any change.
- **KV budget**: the hwm write happens only when a poll actually returns messages; idle
  polls still do zero KV writes.
- **Tests (+4)**: envelope sent in the poll→ack window survives (`kept:1`); fully-polled
  queue deletes (`kept:0`, hwm cleaned up); ack with no prior poll still full-deletes
  (backward compat); selective-delete KV failure → `ACK_FAILED` 500. Mutation-verified
  (forcing the blind-delete path fails the window-preservation test).

## Web Push dead-subscription cleanup removes ALL stale subs per cycle — item 39 (branch claude/nice-ride-T6yb0, 2026-06-13)

609 tests (+3); additive, no wire change.

Socratic trace of `sendPushToUser`'s "Remove expired subscriptions" comment (plural) against
its code revealed it removed only **one** when several expired together. The removal ran
*inside* the per-sub loop as `subs.filter(s => s.endpoint !== sub.endpoint)` recomputed from
the **original** array each time, so for two stale subs `[A,B]`: the A-pass wrote `[B]`, then
the B-pass wrote `subs−B = [A]` — resurrecting A. Net: one stale sub lingered every cycle,
wasting a failed delivery until eventually cleaned.

- **Fix**: accumulate stale endpoints in a `Set` during the loop and prune them in ONE
  cumulative write after it (`subs.filter(s => !stale.has(s.endpoint))`, or `kvDel` when none
  remain). Correct for any number of dead subs, and one KV write instead of N.
- **Also**: treat `404 Not Found` as dead alongside `410 Gone` (standard Web Push cleanup
  semantics; both mean the subscription no longer exists).
- **Test seam**: `sendPushToUser` is now exported for unit testing.
- **Tests (+3)**: both subs 410 → key deleted (no resurrection); one dead + one healthy →
  only the dead removed; single 404 → removed. Mutation-verified (the old in-loop filter
  fails the "removes BOTH" test). Tests use real VAPID + ECDH push keys so encryption and
  delivery reach `fetch`.

## Account deletion erases the cust:{customerId} reverse mapping — item 38 (branch claude/nice-ride-T6yb0, 2026-06-13)

606 tests (+2); additive, no wire change for existing clients.

A Socratic re-check of item 36's claim that `handleAccountDelete` "deletes all relevant
user data": enumerating every userId-keyed KV namespace against the handler showed one miss.
The handler erases `inbox/sealed/prekey/otp/ktlog/push/backup/presence/slots` (+ optional
alias/groups), but never the **reverse** `cust:{customerId} → userId` mapping — because it
deleted `slots:${userId}` without first reading the `customerId` inside it.

- **Gap**: the Stripe payment-identity → userId linkage survived account deletion (residual
  user-linked data, contra item 1's GDPR Art. 17 intent), and a later subscription webhook
  lacking `metadata.userId` could resolve the deleted account through it.
- **Fix**: read `slots:${userId}` before deletion; if it carries a `customerId`, also
  `kvDel(cust:${customerId})` and report `'cust'` in the `erased` array. Only this account's
  own mapping is touched (the customerId comes from its own billing record). Documented
  caveat: Breeze-created subscriptions also carry userId in their metadata, so users should
  still cancel via the billing portal before deleting — this only removes the relay linkage.
- **Tests (+2)**: a billing record with a customerId → `cust:` erased and `'cust'` in
  `erased`; a free-tier account (no customerId) → `'cust'` absent and an unrelated `cust:`
  mapping left untouched. Mutation-verified (disabling the `cust` delete fails the test).

## Regression test for Stripe webhook replay window (Socratic coverage audit) — item 37 (branch claude/nice-ride-T6yb0, 2026-06-13)

604 tests (+3); test-only change, no production code modified.

This round's Socratic pass interrogated four security-critical claims and found the *code*
sound in every case (Stripe constant-time double-HMAC, disappearing-message purge, OGP
redirect re-validation, CORS origin reflection — all verified accurate, no fix manufactured).
The real gap was in *coverage*: `verifyStripeSignature` documents a "5 min tolerance" replay
window (line 897), but the only test exercising it used `t=1,v1=deadbeef` — which fails on a
bad signature too, so it could not distinguish a freshness rejection from a signature
rejection. The replay-window guard had **zero isolated regression coverage**; deleting it
would have left the whole suite green.

- **Tests (+3)**: a validly-signed webhook with a 10-min-stale timestamp → 400 (no billing
  side effect); a validly-signed webhook with a far-future timestamp → 400; the *same* event
  signed with a fresh timestamp → 200 (control isolating the timestamp as the only variable).
- **Mutation-verified**: with the `> 300` freshness check disabled, the two rejection tests
  fail and the control still passes — proving they pin the guard, not an incidental path.

## Abuse-report webhook: in-memory dedup closes same-isolate race + honest comment — item 36 (branch claude/nice-ride-T6yb0, 2026-06-13)

601 tests (+1); no breaking wire change.

A Socratic follow-up to item 35: item 35's comment claimed the check-before-fire made the
"idempotent on frankId" guarantee *true* — but KV has no atomic compare-and-swap, so two
concurrent reports can both read `report:${frankId}` as absent (KV is eventually
consistent) and both fire the webhook. The item-35 comment overclaimed.

- **Fix (same-isolate race)**: added a synchronous `globalThis._frankWebhookFired`
  check-and-set — the same in-memory-dedup pattern already used by `_msgDedup`/`_sealedDedup`.
  With no `await` between `.has()` and `.set()`, concurrent retries hitting one warm isolate
  (the common duplicate source) are serialized by the event loop and only the first fires.
- **Honest comment**: the cross-isolate race remains (KV-bound, fixable only with a Durable
  Object — out of scope). The comment now states exactly what the code guarantees and notes
  the payload carries `frankId` for operator-side dedup, rather than claiming exactly-once.
- **Tests (+1)**: two concurrent reports with simulated KV read-lag (both see the record as
  absent) fire the webhook exactly once — proving the in-memory layer, not the KV check, is
  what suppresses the duplicate.

> Method note: the Explore agent proposed a "fire-then-check `at === Date.now()`" fix —
> Socratically rejected (the timestamp always advances between write and readback, so it
> would never match and wouldn't fix the race). The agent also flagged a non-issue elsewhere;
> `handleAccountPurchase` (plan whitelist) and `handlePreKeyFetchBatch` (cap 10) were
> independently re-verified as already-correct.

## Abuse-report webhook idempotency (Socratic audit) — item 35 (branch claude/nice-ride-T6yb0, 2026-06-13)

600 tests (+2); no breaking wire change.

Found by interrogating a code comment rather than trusting it: `handleAbuseReport`
documented the report as *"idempotent on frankId"*, but only the KV write was idempotent —
the moderation webhook fired on **every** call.

- **Webhook amplification**: the franking opening key `Kf` is delivered to the recipient
  inside the E2E payload, so a recipient (or a client that retries) can re-POST the same
  valid `(frankId, message, opening)` tuple. Each repeat re-fired the operator's
  `ABUSE_WEBHOOK_URL` (up to the 10/min rate limit), flooding the moderation queue with
  duplicate notifications of a single report.
- **Fix**: check `report:${frankId}` before firing. The webhook (and report stamp) now fire
  only on the first report; repeats return `{ verified: true, duplicate: true }` with no new
  webhook. The documented idempotency now holds for the webhook, not just the KV write.
- **Bonus**: the previously-unchecked `report:${frankId}` write now returns
  `500 STORE_FAILED` on KV failure (the one instance missed by the item 33/34 sweep).
- **Tests (+2)**: three identical reports fire the webhook exactly once (2nd/3rd flagged
  `duplicate:true`); report write failure returns `STORE_FAILED`.

> Note: this round also Socratically refuted two proposed "client-controlled timestamp"
> findings (presence `p.at`, signal `ts`) — both are set server-side with `Date.now()`,
> so the client never controls them and no validation was warranted.

## kvDel failure propagation: group delete, alias delete, drop one-time read — item 34 (branch claude/nice-ride-T6yb0, 2026-06-13)

598 tests (+4); no breaking wire change.

- **`handleGroupDelete`**: unchecked `kvDel` — if delete failed, group persisted but
  client believed it was gone. Now returns `500 STORE_FAILED` on kvDel failure.
- **`handleAliasDelete`**: unchecked `kvDel` — if delete failed, the alias was never freed
  but `{ ok: true, removed: true }` was returned. Now returns `500 STORE_FAILED`.
- **`handleDropRead`**: changed to **delete-before-return** (same pattern as OTP item 28).
  Previously read → delete → return: if delete failed, the ciphertext was leaked to the
  caller AND the drop remained in KV (violating one-time semantics). Now delete → return:
  if delete fails, caller gets `500 DEL_FAILED` and can retry; the drop is preserved in KV.
  On success, ciphertext is returned only after the delete confirms.
- **Tests (+4)**: group delete 500 on kvDel throw (group still in KV); drop read 500 on
  kvDel throw (drop still in KV, ciphertext not leaked); drop read success (delete-first
  confirmed); alias delete 500 on kvDel throw (alias still in KV).

## Group mutation + prekey + backup STORE_FAILED propagation — item 33 (branch claude/nice-ride-T6yb0, 2026-06-13)

594 tests (+8); no breaking wire change.

- **All group state mutations** (`handleGroupCreate`, `handleGroupJoin`, `handleGroupKick`,
  `handleGroupAdmin`, `handleGroupTransfer`, `handleGroupRename`, `handleGroupLeave`) now
  check the return value of their terminal `kvPut`. On failure the endpoint returns
  `500 STORE_FAILED` instead of silently returning success with the change never persisted.
  The security-critical cases are **kick** and **leave** — if these fail silently, the
  kicked/leaving member retains their sender-key epoch access despite the client believing
  the operation succeeded, violating the post-compromise security guarantee.
- **`handlePreKeyUpload`**: unchecked `kvPut` at `prekey:${userId}` — if it failed, the
  user's contact card was never stored, making them unreachable, but they got `{ ok: true }`.
- **`handleBackupUpload`**: unchecked `kvPut` at `backup:${userId}` — backup silently lost.
- **`handleAliasSet`**: unchecked `kvPut` at `alias:${clean}` — alias not stored but client
  showed success.
- **Tests (+8)**: group create/join/kick/leave/rename/transfer each return 500 on KV throw;
  prekey upload returns 500 on KV throw; backup upload returns 500 on KV throw.

## Webhook billing KV failure propagation — item 32 (branch claude/nice-ride-T6yb0, 2026-06-13)

586 tests (+3); no breaking wire change.

- **`handleWebhook`** previously called `kvPut` for billing state changes
  (`checkout.session.completed`, `subscription.deleted`, `subscription.updated`) without
  checking the return value. If Cloudflare KV was temporarily unavailable, the event was
  still marked as processed (line 839), preventing Stripe from retrying — the user's slot
  assignment was silently lost.
- **Fix**: each billing `kvPut` result is now checked. On failure the handler returns
  `500` immediately (before the "mark processed" write), so Stripe retries the webhook on
  its normal backoff schedule. The idempotency key is never written on 500, so the retry
  is correctly re-processed.
- **Tests (+3)**: KV failure on `checkout.session.completed` → 500 + event not marked;
  KV failure on `subscription.deleted` → 500 + event not marked; KV failure on
  `subscription.updated` → 500 + event not marked.

## Drop server-side ID generation + unknown IP rate limit cap — item 31 (branch claude/nice-ride-T6yb0, 2026-06-13)

583 tests (+8); no breaking wire change.

- **`handleDropCreate`** now supports **server-side ID generation**: when the client omits
  `id` from the request body, the server generates a UUID-derived 32-char hex ID
  (`crypto.randomUUID().replace(/-/g,'')`) and returns it as `{ ok: true, id, ttl }`.
  This completely eliminates the check-then-set collision race (Cloudflare KV has no atomic
  CAS, so two concurrent requests with the same client-provided ID could both pass the
  collision check and overwrite each other). Clients that still provide their own `id`
  continue to work unchanged.
- **Response now includes `id`** always (even for client-provided IDs), enabling callers to
  build the drop URL from the response rather than from state — a cleaner API contract.
- **STORE_FAILED propagation**: `handleDropCreate` now checks the return value of
  `kvPut` and returns `500 STORE_FAILED` on failure (consistent with items 27).
- **Health capability** `'drop-server-id'` advertised.
- **Unknown IP rate limit cap**: requests with no `CF-Connecting-IP` header (all appear as
  `'unknown'`) are now capped at `min(path_limit, 5)` rpm — previously they all shared one
  bucket at the full path limit, so a burst from one non-CF source could fill the shared
  `unknown` bucket and rate-limit all other non-CF requests on the same endpoint.
- **Tests (+8)**: server-generated ID is 32-char hex; client-provided ID echoed back;
  legacy short IDs still accepted; server-generated ID readable after create; STORE_FAILED
  on KV throw; two concurrent server-generated IDs are always distinct; unknown IP rate-
  limited after 5 rpm; normal IP not rate-limited until 21st request.

## Online counter minute-boundary fallback — item 30 (branch claude/nice-ride-T6yb0, 2026-06-13)

575 tests (+3); no breaking wire change.

- **`handleOnlineCount`** previously returned `0` at the start of each minute (before the
  first heartbeat arrived in the new window), causing a brief "0 online users" spike in
  every connected client's presence UI.
- **Fix**: `_onlineCounter` now tracks a `prev` field (the previous minute's count). At a
  minute boundary, `handleOnlineCount` returns `prev` as a fallback when the new-minute
  count is 0. `handlePresence` saves the old count into `prev` on rollover.
- **Tests (+3)**: minute-boundary returns `prev`; current-minute count wins when non-zero;
  heartbeat rollover correctly sets `prev` and resets `count` to 1.

## Language code sanitization in handleTranslate — item 29 (branch claude/nice-ride-T6yb0, 2026-06-13)

572 tests (+3); no breaking wire change.

- **`handleTranslate`** (`from`/`to` language codes) now strips all non-BCP-47 characters
  (`[^a-zA-Z0-9-]`) before forwarding to DeepL, LibreTranslate, Google Translate, and
  MyMemory. Previously only `.slice(0, 10)` was applied, which allowed `\r\n` or control
  characters to pass through and potentially inject into HTTP headers or URL parameters in
  downstream APIs. `handleAI` already used this pattern (`replace(/[^a-zA-Z0-9-]/g, '')`
  at line 2451) — `handleTranslate` is now consistent.
- **If the sanitized target code is empty** (e.g., all special chars), returns
  `{ error, code: 'INVALID_LANG' }` 400 rather than forwarding an empty string to providers.
- **Tests (+3)**: fully-special `to` → `INVALID_LANG`; `zh_CN` (underscore stripped) →
  proceeds; `from` with `\r\n` embedded → strips cleanly and proceeds.

## OTP delete-before-attach safety — item 28 (branch claude/nice-ride-T6yb0, 2026-06-13)

569 tests (+1); no breaking wire change.

- **`handlePreKeyFetch`: delete OTP slot BEFORE attaching it to the response bundle.**
  Previously the OTP value was stored in `bundle.oneTimePreKey` and then `kvDel` was called.
  If the delete threw (transient KV error), the OTP was returned to the initiator while the
  slot remained in KV — a subsequent fetch could return the same OTP to another initiator,
  causing OTP reuse. Reusing an X3DH OTP means the DH4 component is no longer per-session,
  degrading forward secrecy for both sessions.
- **Fix**: `kvDel` is now called first; if it returns `false`, the loop `continue`s to the
  next slot. The OTP value is only attached after a confirmed delete. `replenishOTP` signals
  the owner to retry if all deletes failed.
- **Test (+1)**: injected throwing KV.delete verifies the OTP is withheld and the slot
  remains intact in KV.

## KV write/delete failure propagation — item 27 (branch claude/nice-ride-T6yb0, 2026-06-13)

568 tests (+3); no breaking wire change.

- **`handleMsgSend`**: if `kvPut` returns false (KV quota/transient error), now returns
  `{ error, code: 'STORE_FAILED' }` 500 instead of `{ok: true}`. Client can retry.
- **`handleSealedSend`**: same fix — `kvPut` failure → `STORE_FAILED` 500.
- **`handleSealedAck`**: if `kvDel` returns false, now returns `{ error, code: 'ACK_FAILED' }` 500
  instead of `{ok: true}`. Previously the client would stop polling the sealed queue believing
  delivery was confirmed, while the server queue remained and expired silently after 7 days.
- **Tests (+3)**: one per fixed handler — each injects a throwing KV mock and asserts the
  correct 500 status code.

## Optional Ed25519 auth for backup upload/download — item 26 (branch claude/nice-ride-T6yb0, 2026-06-13)

565 tests (+9); no breaking wire change.

- **`/api/backup/upload` and `/api/backup/download` now accept optional `{ ts, sig }` fields.**
  When provided, both are required (`PARTIAL_AUTH` 400 if only one), freshness window ±5 min
  (`INVALID_TIMESTAMP`), and the Ed25519 signature is verified against the user's registered
  `edIdentityKey` from the prekey bundle (`SIG_INVALID` 403, `NO_IDENTITY_KEY` 403).
  When omitted, both endpoints behave exactly as before (backward-compat — no wire change).
- **Response now includes `authenticated: bool`** so clients can confirm whether the operation
  was authenticated and surface a "protected" indicator in the UI.
- **`backup-auth` added to `/api/health` capabilities** for client feature-detection during
  staged rollout.
- **Tests (+9)**: authenticated upload/download succeed; tampered sig rejected; no identity key
  on upload/download with sig; partial auth (ts-only, sig-only) rejected; stale ts rejected;
  unauthenticated path still works.

## Complete error `code` field coverage — 0 bare errors remaining (branch claude/nice-ride-T6yb0, 2026-06-13)

304 tests (0 net new — two existing tests tightened); no breaking wire change.

Every `json({ error: ... })` call in `_worker.js` now includes a `code` field.
Zero bare errors remain. New codes added:
- Group handlers: `MISSING_FIELDS`, `INVALID_NAME`, `GROUP_FULL`
- Push subscribe: `INVALID_ENDPOINT`, `UNTRUSTED_ENDPOINT`
- Franking: `MISSING_FIELDS`, `INVALID_FIELD`
- Alias set/delete, prekey upload, sealed send: `MISSING_FIELDS`, `INVALID_ALIAS`
- Backup, drop: `MISSING_FIELDS`, `INVALID_ID`, `PAYLOAD_TOO_LARGE`
- Translate, AI: `MISSING_FIELDS`, `PAYLOAD_TOO_LARGE`, `INVALID_FIELD`, `INVALID_ACTION`
- Generic request guard: `FIELD_TOO_LARGE`, `INVALID_FIELD`, `PAYLOAD_TOO_LARGE`
- Server-level: `KV_NOT_CONFIGURED`, `PRICE_NOT_CONFIGURED`, `SERVER_ERROR`

## OTP type guard at upload — prevent null entries from consuming prekey slots (branch claude/nice-ride-T6yb0, 2026-06-13)

304 tests (+2); no breaking wire change.

- **OTP non-string entries are now silently skipped at upload** — `JSON.stringify(null)` produces
  the 4-char string `'null'`, which passed the size guard and was stored. On fetch, `safeJsonParse('null')`
  returns `null`, which fails the `parsed !== null` guard — the slot is consumed (deleted) without
  delivering a key. One null entry in the `oneTimePreKeys` array permanently wasted a prekey slot
  with no error signal. Added `typeof oneTimePreKeys[i] !== 'string'` guard.
- **Count reflects the highest valid stored index** — Previously `count = Math.min(array.length, 100)`
  counted all entries including non-strings. Now `count = maxStoredIdx + 1` (only written when at
  least one key was stored), consistent with how the fetch loop uses count as an upper-bound index.
- **Tests (+2)**: null/non-string entries skipped and not stored; all-non-string array writes no
  count key and fetch correctly signals `replenishOTP`.

## Batch presence cache hit + sealed-send dedup key length fix (branch claude/nice-ride-T6yb0, 2026-06-13)

302 tests (+3); no breaking wire change.

- **Batch presence check uses in-memory cache first** — The batch `{ ids: [...], check: true }` path
  unconditionally read KV for every user ID, costing N KV reads per group presence poll even when all
  users had heartbeated recently (and their data was already in `_presenceCache`). The single-user check
  path correctly read the cache first. Now the batch path does the same: cache hit → skip KV, miss →
  fall through to KV. For a 10-member group polling every 5 s this drops ~120 KV reads/min to ~0 reads/min
  while the isolate is warm.
- **Sealed send dedup key now includes envelope length** — Dedup key was `${to}:${envelope.slice(0,32)}`;
  two envelopes with the same 32-character prefix but different total lengths (distinct messages) would match
  and the second would be silently dropped as a false duplicate. Key is now
  `${to}:${envelope.length}:${envelope.slice(0,32)}`, matching the `handleMsgSend` pattern.
- **Tests (+3)**: batch check serves from in-memory cache even when KV is empty for that user; batch
  reports stale cached heartbeat as offline; distinct same-prefix envelopes of different lengths both
  stored (length-keyed dedup regression test).

## Standalone alias delete — release alias without account deletion (branch claude/nice-ride-T6yb0, 2026-06-13)

299 tests (+6); no breaking wire change.

- **`/api/alias/delete`** — Ed25519-authenticated endpoint to release a vanity `@handle`
  while keeping identity, contacts, messages, and billing record intact. Previously the
  only way to free an alias was to delete the entire account. Challenge string
  `breeze-alias-delete:{alias}:{ts}` (distinct from the account-delete challenge) prevents
  cross-endpoint replay. Ownership double-check: `alias.pub` must equal the requester's
  `identityKey` from their prekey bundle — no third-party alias squatting. Returns
  `{ ok, removed }` — idempotent; a missing alias returns `removed: false`, not 404.
  Rate-limited at 5 req/min. Added `alias-delete` to health capabilities.
- Endpoint count updated to 43.
- **Tests (+6)**: valid delete removes KV record; no-op on nonexistent alias; 403 on
  non-owner pub; 403 on tampered signature; 400 on missing fields; 400 on stale timestamp.

## Abuse report moderation webhook (branch claude/nice-ride-T6yb0, 2026-06-13)

545 tests (+1); no breaking wire change.

- **`ABUSE_WEBHOOK_URL` env var** — when configured, a verified abuse report triggers a
  non-blocking POST to that URL with `{ type, frankId, messageLen, at }`. The payload
  contains NO message content — only metadata (frankId + size + timestamp). Previously
  verified reports sat silently in KV for 90 days with no operator notification, making
  the abuse system a dead end without a separate dashboard.
- Fire-and-forget (`catch(() => {})`) — a failed webhook never blocks the reporter.
- **Test (+1)**: verified report POSTs to the configured webhook URL with correct payload.

## Prekey status endpoint — non-destructive OTP/SPK health check (branch claude/nice-ride-T6yb0, 2026-06-13)

544 tests (+4); no breaking wire change.

- **`/api/prekey/status`** — non-destructive endpoint to check prekey health: returns
  `{ otpCount, uploadedAt, replenishOTP, replenishSPK }`. Previously the only way to
  learn `replenishOTP`/`replenishSPK` was through `/api/prekey/fetch`, which consumes an
  irreversible OTP. This endpoint reads the same KV data without touching OTPs — useful
  for clients self-auditing after reinstall/IDB loss, or checking state before deciding
  to replenish. Rate-limited at 20 req/min. Added `prekey-status` to health capabilities.
- Endpoint count updated to 42.
- **Tests (+4)**: status does not consume OTP (count same before+after); replenishOTP
  true when count ≤5; 404 when no prekeys; 400 on missing/invalid userId.

## Batch prekey fetch — one request for N session initiations (branch claude/nice-ride-T6yb0, 2026-06-13)

540 tests (+3); no breaking wire change.

- **`/api/prekey/fetch/batch`** — new endpoint that resolves up to 10 prekey bundles in
  one round-trip. Useful when joining a group: instead of N serial `/prekey/fetch` calls
  (each consuming an OTP for that user), one batch call returns `{ results: { userId:
  bundle | null } }`. OTPs ARE consumed (same as the single-fetch path) — this is a
  latency optimisation, not an OTP-free path. Deduplicates userIds before processing.
  Rate-limited at 5 req/min (stricter than single-fetch since each call can consume up
  to 10 OTPs). Added `prekey-fetch-batch` to health capabilities.
- **Tests (+3)**: batch resolves multiple bundles + maps misses to null; dedup + 10-cap
  enforced; 400 on missing/empty/all-invalid userIds.

## Push unsubscribe endpoint + comment/count fixes (branch claude/nice-ride-T6yb0, 2026-06-13)

537 tests (+4); no breaking wire change.

- **`/api/push/unsubscribe`** — new endpoint to explicitly remove a push subscription
  by endpoint URL. Previously push subscriptions could only be removed by waiting for
  the 30-day KV TTL, making "disable notifications on this device" impossible without
  re-registering. Returns `{ ok, removed }` — `removed: 0` when the endpoint wasn't
  registered (idempotent). Rate-limited at 5 req/min. Added `push-unsubscribe` to
  health capabilities.
- **Group full comment fix** — misleading `// Max 50 members` comment corrected to
  `// Max 100 members` (the enforcement code was already `>= 100`; only the comment
  was wrong — matches README and UI).
- **Endpoint count updated** to 40 across `_worker.js`, `CLAUDE.md`, `AGENTS.md`.
- **Tests (+4)**: removes endpoint + cleans up KV; returns `removed: 0` for unknown
  endpoint; ok with no subscriptions; 400 on missing fields/invalid userId.

## Key-transparency log public endpoint + OGP HTML cap fix (branch claude/nice-ride-T6yb0, 2026-06-13)

Two robustness improvements. 533 tests (+4).

- **`/api/ktlog/get`** — standalone public endpoint to fetch a user's key-history
  audit log (`{ log: [{ts,h,c}] }`). Previously the log was only available
  bundled inside `/api/prekey/fetch`, which irreversibly consumes a one-time prekey.
  Now any client can audit a peer's identity-key rotation history without side effects.
  Returns empty log (not 404) for users with no upload history. Rate-limited at 20
  req/min. Added `ktlog-get` to health capabilities.
- **OGP HTML read cap enforced per chunk** — the streaming read loop now truncates to
  32 KB *after each chunk* (`slice(0, 32768)`), so a server that sends one large chunk
  can no longer buffer beyond the cap. Previously a single oversized chunk would
  accumulate the full chunk before the loop condition fired.
- **Tests (+4)**: log empty for new user; log populated after upload; ktlog fetch does
  not consume OTPs; 400 on missing/invalid userId.

## replenishSPK signal + health capabilities update (branch claude/nice-ride-T6yb0, 2026-06-13)

Two minor but useful server-side improvements. 529 tests (+2).

- **`/api/prekey/fetch` now returns `replenishSPK: true`** when the stored bundle's
  `uploadedAt` is older than 25 days (KV TTL is 30 days). Symmetric with the existing
  `replenishOTP` signal — gives clients a 5-day window to re-upload their signed
  pre-key before becoming unreachable. No breaking change (clients that don't check
  this field are unaffected).
- **`/api/health` capabilities** now includes `batch-alias` and `group-caps`, so
  clients can feature-detect these without probing each endpoint.
- **Tests (+2)**: stale bundle (>25 days) triggers `replenishSPK`; fresh bundle does not.

## Batch alias resolution — one request for N contacts (branch claude/nice-ride-T6yb0, 2026-06-13)

`/api/alias/get` now accepts a `{ aliases: [...] }` batch payload in addition to
the existing `{ alias: string }` single-alias form. Resolves up to 50 aliases in
one round-trip instead of N, eliminating the major KV-read amplification that
occurred when a client loaded its full contact list. 527 tests (+2).

- **Batch path**: accepts `aliases` array, deduplicates after lowercase+sanitize
  (`[^a-z0-9_]` stripped), caps at 50, returns `{ results: { alias: data|null } }`.
  Missing aliases map to `null` (caller can distinguish resolved vs. not-found).
  Non-string entries are silently skipped.
- **Single-alias path unchanged** — existing clients unaffected.
- **Tests (+2)**: batch resolves multiple aliases and maps misses to `null`;
  dedup + sanitize + 50-cap enforced; both test via the public `SELF.fetch` path.

## Group rejoin refreshes member fields (caps staleness fix) (branch claude/nice-ride-T6yb0, 2026-06-10)

Follow-on to the group capability snapshot: the `handleGroupJoin` "already a
member" branch was a pure no-op, so the N3 caps recorded at first join stayed
frozen — a client that upgraded (gaining group-v5/franking) could never raise
the group floor without leaving and rejoining. 525 tests (+2); no endpoint change.

- The already-member branch now refreshes the member's mutable fields
  (`pub`/`name`/`caps`) from the rejoin request. Clients already re-call join on
  reconnect, so a capability upgrade propagates naturally. Persists only when a
  field actually changed (no wasteful KV write on every reconnect), and a legacy
  rejoin that advertises no caps does **not** erase a previously-recorded set.
  Response gains `refreshed` (bool) and now includes `epoch`.
- **Tests (+2)**: an upgraded rejoin raises the negotiateGroup floor end-to-end;
  a legacy (capless) rejoin preserves the existing capability set.

## Group member capability negotiation — unblocks negotiate.js (branch claude/nice-ride-T6yb0, 2026-06-10)

Completed the server half of N3 capability negotiation for groups. `negotiate.js`
`negotiateGroup(localCaps, memberCapsList)` computes the group capability floor
(a feature is enabled only when *every* member supports it) — but it was
effectively dead code: the relay never surfaced member capabilities, so a client
could only obtain them with one presence check per member. 523 tests (+3); no
endpoint change (enhancement to create/join/info).

- **`/api/group/create` and `/api/group/join` accept an optional `caps` array**,
  sanitized identically to the presence/bundle path (`sanitizeCaps` — ≤20
  strings, ≤32 chars, non-strings dropped), stored on the member record. Omitted
  for legacy clients.
- **`/api/group/info` surfaces them** (it already returns the member array
  wholesale), so a client computes the floor from a single call instead of N
  presence checks.
- **Tests (+3)**: caps stored on create+join and surfaced via info; the surfaced
  caps drive `negotiateGroup` end-to-end (group-v5 floor holds when all support
  it, franking floor drops when one member lacks it); non-string/oversized caps
  sanitized + field omitted for legacy clients.

## Account deletion now cleans up group memberships (branch claude/nice-ride-T6yb0, 2026-06-10)

Closed a residual-data hole in the account-deletion feature itself: there is no
reverse index (user → groups), so a deleted account's id/pub/name lingered in
every group it had joined for the 30-day group TTL — exactly the residual data
the rest of `/api/account/delete` erases. 508 tests (+2); no endpoint change
(enhancement to the existing handler).

- **`/api/account/delete` accepts an optional `groups: [token,…]`** (or
  `[{token},…]`, cap 50). The request is already Ed25519-authenticated over
  `userId`, so removing *that* user from the groups it names is legitimate
  self-removal. Per token: **creator** → the whole group is deleted (a
  creator-less group is unmoderatable; the survival path is
  `/api/group/transfer` *before* deletion); **member** → removed + epoch bump
  (PCS — the departed account can't decrypt new traffic), mirroring
  `handleGroupLeave`. Tokens where the account isn't a member are ignored.
  Response gains `groupsLeft` / `groupsDeleted` counts.
- **Tests (+2)**: member-group removal + epoch bump alongside created-group
  deletion; non-membership tokens ignored + 50-cap doesn't throw.

## Group rename — lifecycle CRUD completion (branch claude/nice-ride-T6yb0, 2026-06-10)

The group name was frozen at `create()` with no way to edit it
(create/join/info/kick/admin/transfer/leave/delete all existed; "update
metadata" was the last missing CRUD verb). 37 → 38 API endpoints, 502 → 506 tests.

- **`/api/group/rename` — creator OR any admin renames the group**: same
  authorization set as kick. Sanitized identically to `create()` (`sanitizeString`,
  ≤50 chars) so a relay-side push title can't be inflated past the RFC 8030 limit;
  rejects a name that sanitizes to empty (`INVALID_NAME`), caps oversized names at
  50 chars rather than rejecting. No epoch bump — the name is plaintext relay
  metadata (already in info responses + push titles), not key material.
- **Tests (+4)**: creator rename reflected in info, admin-can/member-cannot,
  empty-after-sanitization rejected + 50-char cap, missing-group 404.

## Group ownership transfer (branch claude/nice-ride-T6yb0, 2026-06-10)

The companion to multi-admin: `creatorId` was immutable, so if the creator
deleted their account (now possible via `/api/account/delete`) or went dark,
the creator-only operations (group delete, admin management) became permanently
impossible. 36 → 37 API endpoints, 496 → 502 tests.

- **`/api/group/transfer` — creator hands ownership to an existing member**:
  the `creator*` fields (creatorId/creatorPub/creatorName) follow the new owner,
  resolved from that member's record so `handleGroupInfo` and the 1:1 sender-key
  distribution path get the right pub/name. The incoming creator's authority
  becomes implicit (dropped from `admins`); the **outgoing** creator is retained
  as an admin so they keep moderation rights. No epoch bump — ownership is an
  authorization label, not key material (every member's sender key is unchanged).
  Guards: current-creator-only, target-must-be-member, no-op-on-self.
- **Tests (+6)**: transfer happy path (creator* fields follow, admins rebuilt),
  post-transfer authorization flip (new creator can delete, old cannot),
  transfer-to-existing-admin idempotency, non-creator rejected, non-member
  rejected, self-transfer no-op. `docs/PRODUCT-ANALYSIS.md` updated (item 7 → done).

## Multi-admin group management (branch claude/nice-ride-T6yb0, 2026-06-10)

Completed a feature that was already half-built: the `group.admins` array was
*maintained* on member removal (kick/leave filtered departing members out of it)
but nothing ever **populated** it and `kick` ignored it — so the creator was a
single point of failure for moderation. 35 → 36 API endpoints, 486 → 496 tests.

- **`/api/group/admin` — creator-only promote/demote** (`action: 'promote'|'demote'`):
  adds/removes a member to/from `group.admins`. Idempotent (re-promote/re-demote is a
  no-op). Guards: only the creator manages admins (no escalation chains — the privilege
  graph stays a flat creator→admins tree); the creator can't be promoted (their
  authority is implicit and never stored in `admins`); the target must be a member. No
  epoch bump — admin status is an authorization label, not key material.
- **`handleGroupKick` now honors `admins`**: the creator OR any promoted admin may kick.
  A regular admin can kick a regular member but **cannot** kick a fellow admin (only the
  creator can — prevents admin-vs-admin removal wars); nobody can kick the creator. Was
  previously creator-only.
- **`handleGroupInfo` now returns `creatorId` + `admins`** so clients can render
  moderation badges and gate the kick/admin UI (the server still re-authorizes every
  action server-side; the response is advisory only).
- **Tests (+10)**: promote/demote happy paths + idempotency, non-creator escalation
  blocked, creator-as-target rejected, non-member rejected, unknown action rejected,
  admin-can-kick-member, admin-cannot-kick-admin (creator can), leave strips admin
  status. `docs/PRODUCT-ANALYSIS.md` updated (item 6 → done).

## Product gap analysis + missing-feature implementation (branch claude/nice-ride-T6yb0, 2026-06-10)

Full product analysis (strengths / weaknesses / missing features) documented in
`docs/PRODUCT-ANALYSIS.md`; the top implementable gaps were closed worker-side
(all additive — zero wire change for current clients). 32 → 35 API endpoints,
472 → 486 tests.

### New endpoints
- **`/api/account/delete` — server-side data erasure (GDPR Art. 17)**: the client's
  `/wipe` deletes local data only, while the privacy policy promises full deletion;
  server KV retained inbox/sealed (7d), prekeys + push subscriptions (30d), the
  key-transparency log + encrypted backup (90d), and the billing slots record (no
  TTL). The new endpoint erases all of them immediately, plus all one-time prekeys,
  plus an optional alias release (only when the stored alias `pub` matches the
  account's registered `identityKey` — prevents third-party alias squatting).
  Auth: Ed25519 signature over `breeze-account-delete:{userId}:{ts}` (±5 min
  freshness window) verified against the `edIdentityKey` from the user's pre-key
  bundle; accounts without a registered Ed25519 key get 403 (an unauthenticated
  delete would let anyone destroy a victim's prekeys/backup). Replay after erasure
  fails closed (the verification key itself is erased). Rate limit 3/min.
- **`/api/group/leave` — member self-removal**: only admin `kick` existed; a member
  who left client-side stayed in the server registry (id/pub/name readable by anyone
  holding the invite token) for the full 30-day TTL. Leave removes the member and
  bumps the epoch like kick — PCS applies to voluntary departure too (the departed
  member must not keep decrypting new traffic). The creator cannot leave
  (`CREATOR_CANNOT_LEAVE` — a creator-less group could never be kicked/deleted).
- **`/api/group/delete` — creator-only group deletion**: completes the lifecycle
  (create/join/info/kick/leave existed; abandoned groups lingered in KV for 30 days).

### Behavior changes
- **Server-side disappearing-message enforcement (`/api/msg/poll`)**: `disappearAt`
  (absolute, send-time + timer) was only filtered at client render; an undelivered
  expired message sat in KV for up to the 7-day inbox TTL. Poll now excludes expired
  messages from delivery AND from the keep-list, purging the ciphertext on the first
  poll after expiry. No observable client change (the client already refuses to
  render expired messages).
- **Server-assigned message id (`/api/msg/send`)**: each stored message gets a
  12-hex random `id` — groundwork for an exclusive poll cursor fixing the
  same-millisecond message-loss window (two messages sharing a `ts` + a poll landing
  between them drops the second). Current clients ignore unknown fields.

### Tests (+14)
- Account deletion: full-erasure sweep across all 11 KV keys, invalid-signature
  rejection (nothing deleted), no-identity-key 403, stale/future timestamp 400,
  alias release pub-match (own alias deleted / third-party alias blocked), replay
  after erasure fails closed.
- Group leave/delete: leave removes + bumps epoch, creator-leave 400, non-member
  404, missing-group 404, creator delete (KV gone + info 404), non-creator 403.
- Msg relay: unique 12-hex id on same-ts messages; expired disappearAt purged from
  both delivery and KV, live + plain messages unaffected.

## Security Hardening Batch 5 — systematic category audit (branch claude/nice-ride-T6yb0, 2026-06-09)

Exhaustive category-by-category audit of the full product (crypto modules, worker
endpoints, service worker, documentation, test coverage). Findings and fixes:

### Worker (`_worker.js`) — robustness & correctness fixes
- **Presence heartbeat carries capabilities (`caps`) — N3 negotiation enabler**: the
  heartbeat stored only `{ pub, name, at }`, so a peer could not negotiate the protocol
  version (x3dh-v5 / group-v5) without fetching a 1:1 prekey bundle — a problem for
  groups, where a member would otherwise have to fetch every member's bundle to learn the
  group's capability floor. `handlePresence` now accepts an `advertise()` `caps` array
  (sanitized like the bundle: ≤20 string entries, ≤32 chars, non-strings dropped), stores
  it, and returns it on a single check. Backward-compatible (absent for legacy v4 clients).
- **Prekey fetch now returns the consumed OTP index (`oneTimePreKeyId`) — X3DH v5 enabler**:
  `handlePreKeyFetch` consumed the one-time pre-key at index `i` and returned its value
  but never which index it was. The X3DH v5 handshake needs that index: the initiator
  echoes it as `opkId` in the prekey message so the responder can select the matching OTP
  *private* key (`opkResolver`) and complete DH4. Without it the v5 OTP path can't work.
  Fixed: return `bundle.oneTimePreKeyId = i` alongside the OTP (only when it parsed
  cleanly; absent when OTPs are exhausted → initiator sends `opkId:null`).
- **PoW replay via future timestamp (`handleAliasSet`)**: the proof-of-work freshness
  check bounded only the *past* (`now - ts > 10min` → expired). The challenge string is
  fully client-controlled, so an attacker could embed a far-future timestamp, making
  `now - ts` negative — passing the past-only check indefinitely — and replay ONE solved
  token to register unlimited aliases (the challenge binds `pub`, not the alias). Fixed:
  also reject `ts - now > 5min` (clock-skew tolerance), keeping the replay window bounded.
  Mirrored in the `pow.js` reference module's `verify()` (new `futureSkew` option).
- **SSRF: redirect-following bypass (`handleOGP`)**: the link-preview fetcher validated
  only the *initial* URL's host against the private-IP/metadata blocklist, then fetched
  with `redirect: 'follow'`. A public URL could 302-redirect to `http://169.254.169.254/`
  (cloud metadata) or any internal host and `fetch` would chase it past the guard. Fixed:
  extracted the blocklist into `isSSRFBlocked(parsed)` and added `ssrfSafeFetch()` which
  follows redirects MANUALLY (max 3 hops), re-validating each `Location` against the same
  guard and aborting on a blocked/looping/malformed chain.
- **SSRF: inert IPv4-mapped-IPv6 guard**: the old `host.startsWith('::ffff:')` check never
  matched — the URL parser returns IPv6 literals bracketed and compresses the embedded
  IPv4 to hex (`[::ffff:10.0.0.1]` → `[::ffff:a00:1]`), so `[::1]`/`::ffff:` targets slipped
  through (the existing tests only "passed" because the outbound fetch failed in the test
  env and the catch-all returned `{}`). Fixed: strip brackets before the IPv6 prefix
  checks so `::1`, `::`, `::ffff:*`, `fc`/`fd`/`fe80` literals are actually blocked.
- **Message timestamp type guard (replay-window bypass)**: `handleMsgSend` accepted a
  client-supplied `ts` of any type. A non-numeric `ts` (string/object/array/`NaN`/`Infinity`)
  made `Math.abs(now - ts)` evaluate to `NaN`, which is never `> 300000` — silently
  bypassing the ±5 min replay guard AND storing a non-numeric `msg.ts` that breaks the
  numeric poll-cursor comparison in `handleMsgPoll` (message could never be delivered or
  cleaned up). Fixed: reject a non-finite/non-numeric `ts` with 400 `INVALID_TIMESTAMP`
  before the window check; an absent `ts` still defaults to `now`.
- **Group kick TTL regression**: `handleGroupKick` was saving the updated group record
  without an `expirationTtl`, silently removing the 30-day TTL set on create/join and
  making kicked groups permanent in KV (unbounded storage growth). Fixed: added
  `{ expirationTtl: 86400 * 30 }` to the kick kvPut.
- **Push notification title length cap**: The push title (groupName or senderName) used
  the raw uncapped request field. An oversized groupName could bloat the encrypted Web
  Push payload past the RFC 8030 4096-byte per-message limit, causing silent delivery
  failures. Fixed: cap to 50 chars via sanitizeString (matches stored msg.groupName).
- **Defensive JSON.parse on KV data (initial)**: Three `JSON.parse()` calls on KV-fetched
  strings had no try/catch — a corrupt or partially-overwritten KV value would throw and
  return 500 instead of a graceful failure. Fixed: `handlePreKeyFetch` OTP parse,
  `handlePreKeyFetch` ktLog parse, `handleOGP` cache parse.
- **`safeJsonParse` — comprehensive KV hardening**: Systematic audit found ~18 additional
  unguarded `JSON.parse(kvData)` sites across 15+ handlers: `handleSignal` (poll + store),
  `handleMsgSend` inbox, `handleMsgPoll`, `handlePresence` (batch + single mem + single KV),
  `handleAliasSet`, `handleAliasGet`, `handlePortal`, `handleGroupJoin`, `handleGroupInfo`,
  `handleGroupKick`, `handlePushSubscribe`, `sendPushToUser`, `handleAccountSlots`,
  `handlePreKeyFetch` bundle, `handlePreKeyUpload` ktlog, `handleSealedSend`, `handleSealedPoll`,
  `handleDropRead`. All now call `safeJsonParse(raw, fallback)` which returns the fallback
  instead of throwing; each handler returns the correct 404/200-with-empty response on
  corrupt data rather than an unhandled 500.
- **`_presenceCache` in-memory growth cap**: The presence heartbeat handler stored one
  entry per unique userId with no eviction policy; a long-lived isolate serving many
  users could grow the map without bound. Added a prune-to-1000 cap when size exceeds
  2000 (same pattern as `_msgDedup` and `_sealedDedup`).
- **Backup and AI context type guards**: `handleBackupUpload` rejected non-string values
  with a misleading size error instead of a type error (a non-string `backup` bypasses
  the `.length` size check). Now returns 400 `INVALID_FIELD` for non-string inputs.
  `handleAI reply_suggest` similarly now rejects non-string `context` explicitly.
- **handleAI error echo cap**: Unknown `action` values were echoed verbatim in the 400
  error message; capped echoed value to 32 chars to prevent large strings being
  bounced back in error responses.
- **API endpoint count**: Health endpoint reported `endpoints: 28`; actual count is 32
  (30 switch cases + `/api/health` + `/api/webhook`). Fixed in health response, worker
  header comment, CLAUDE.md, SPEC.md §3.2 (table now lists all 32 endpoints including the
  7 previously absent: sealed/ack, drop/create, drop/read, ai, translate, abuse/record,
  abuse/report).

### Crypto Modules (`src/crypto/`) — features & correctness fixes
- **`ratchet.js` — `bundleFromRelay` worker→handshake bundle adapter**: the relay's
  prekey-fetch JSON uses verbose field names (`identityKey/edIdentityKey/signedPreKey/
  signedPreKeySig/oneTimePreKey/oneTimePreKeyId`) while `initiatorHandshake` takes short
  ones (`ikPub/edIkPub/spkPub/spkSig/opkPub/opkId`). A hand-rolled mapping in the port is
  the #1 footgun: a field-name typo would drop the signature material and make the
  handshake skip the MITM check. `bundleFromRelay(fetched, decode?)` does the rename once,
  in a tested place (`decode` converts the relay's opaque strings to bytes; the encoding
  stays the app's concern). Added 5 `tests/x3dh.test.js` cases incl. an end-to-end check
  (mapped relay bundle drives a real handshake) and the safety check (a bundle missing
  `signedPreKeySig` still aborts — no silent bypass).
- **`ktlog.js` — combined on-fetch audit (`auditBundle`)**: the runbook (§8) called only
  `checkRollover` (detects an identity-key swap), missing `verifyChain` (detects a relay
  that rewrote/forked the append-only log). `auditBundle(subtle, storedIK, keyHistory)`
  runs BOTH and returns a single `verdict`: `tampered` (chain broken — chain integrity
  beats everything, so a hostile relay can't hide a swap behind a clean-looking key),
  `rolled` (key changed), `new` (first contact), or `ok`. Added 5 `tests/ktlog.test.js`
  cases incl. the key one — a broken chain surfaces as `tampered` even when the stored key
  matches the latest (rollover alone would have said `ok`).
- **`negotiate.js` — group capability floor (`negotiateGroup`)**: 1:1 `negotiate()` had no
  N-party equivalent, but the runbook (§7) requires "group-v5 only when ALL members
  advertise it." Added `negotiateGroup(localCaps, memberCapsList)` — the N-party AND across
  every member's caps (now obtainable from each member's presence `caps`). A single legacy
  member keeps the whole group on the backward-compatible path (no silent split where some
  members emit v5 the rest can't read); the floor is per-feature; non-array member entries
  are treated as no-caps. Added 6 `tests/negotiate.test.js` cases.
- **`atrest.js` — keystore detection + load helpers (G5 port-enabler)**: added
  `isWrapped(record)` (distinguishes passphrase-wrapped, migrated, and legacy-plaintext
  records) and `loadKey(record, passphrase?)` (returns the JWK for either form). `loadKey`
  **throws** when a wrapped record is loaded with no passphrase, so `loadIdentity` knows
  to prompt rather than silently treating a locked record as empty. Encodes the trickiest
  part of the at-rest port (INTEGRATION.md §5) as the single source of truth. Added 5
  `tests/atrest.test.js` cases (detection across forms, plaintext passthrough, unwrap of
  migrated + bare records, wrong-passphrase→null, prompt-throw).
- **`group.js` — sender-key distribution envelope (G3 port-enabler)**: added
  `buildSenderKeyDistribution(senderKey)` / `parseSenderKeyDistribution(wire)` so the
  module owns the wire format `{ v:5, t:'skd', ep, c, ck, spk }` used to hand a member's
  RECEIVE half (chain key + counter + epoch + epoch-sign PUBLIC key) to other members
  over the authenticated 1:1 channel on create/rotate. Only the public epoch-sign key
  crosses the wire — never the signing private or per-message keys. The `counter` is
  included so a mid-stream joiner can't read earlier messages (FS); the `epoch` scopes
  the key to a membership generation. `parse` never throws on the relay-supplied payload.
  Previously the browser port (INTEGRATION.md §4) would have to hand-roll this. Added 6
  `tests/group.test.js` cases (round-trip+decrypt, no-private-key-leak, FS-on-join,
  rotated-epoch scope, malformed→null, build-throws-on-missing-fields).
- **`ratchet.js` — one-call X3DH handshake; signature verification made unskippable**:
  added `initiatorHandshake` / `responderHandshake` orchestrators that wrap verify →
  derive → bootstrap → (en|de)crypt into a single call per side. Critically,
  `initiatorHandshake` **throws** if the bundle's signed-pre-key signature does not
  verify (or the signature material is absent), so CRYPTO-SPEC §2 step 2 ("MUST verify …
  abort on failure", the I1 MITM defense) is unskippable from the public API — the
  MITM-vulnerable "derive without checking" path is unreachable. The pending browser port
  calls these two functions instead of re-implementing the 6-step sequence and risking a
  dropped verify. Added 5 `tests/x3dh.test.js` cases: two-call handshake (±OPK), forged
  bundle → reject (no session), missing signature material → reject, non-prekey wire → null.
- **`ratchet.js` — X3DH v5 first-message envelope (I1 port-enabler)**: added
  `buildPreKeyMessage`/`parsePreKeyMessage` so the module owns the v5 handshake wire
  format `{ v:5, t:'pkm', ik, ek, opkId, msg }`. The responder needs the initiator's
  identity key (IK_A), ephemeral key (EK_A), and the consumed one-time-prekey index to
  derive `SK` before it can decrypt the first ciphertext; previously the module had no
  helper for this, so the pending browser port (docs/INTEGRATION.md §3) would have to
  hand-roll the format and risk drift. `parsePreKeyMessage` never throws on the
  relay-supplied payload (returns null on malformed/non-pkm input so the caller can fall
  back to a plain ratchet message). Added 5 `tests/x3dh.test.js` cases incl. a full
  first-contact handshake: Alice wraps → Bob unwraps → derives identical SK → decrypts,
  then the conversation continues with plain ratchet messages.
- **`ratchet.js` — one-packet desync DoS in the skip-ahead path**: `ratchetDecrypt`
  mutated `sess.recvChainKey` and stored skipped keys *before* the AEAD / key-commitment
  check when a message carried a counter gap (`p.c > recvCounter + 1`). An injected
  message with a valid gap but forged ciphertext therefore advanced the receive chain
  while `recvCounter` stayed put — permanently desyncing the session, so every subsequent
  legitimate message derived from the wrong chain position and failed to decrypt (a
  one-packet denial-of-service against any 1:1 session). Fixed by mirroring the `group.js`
  pattern: stage the skipped keys and the advanced chain into locals, committing them to
  the session only after a successful decrypt. Added a regression test (forged gap message
  → null, then the real gap-filling messages still decrypt); verified it fails against the
  pre-fix code ("expected null to be 'three'"). The existing no-gap injection test was
  insufficient because a same-counter forgery never enters the skip-ahead block.
- **`atrest.js` — PBKDF2 work-factor DoS**: `unwrapJWK` derived the AES key using
  `record.iter` read straight from the (XSS-writable / corruptible) IndexedDB record; a
  value like `1e12` would hang the main thread in PBKDF2. Now rejects a non-finite,
  non-positive, or above-ceiling (10M) iteration count before deriving.
- **`pow.js` — future-timestamp replay**: `verify()` bounded only the past; a client-set
  far-future challenge timestamp passed the freshness check forever. Added a `futureSkew`
  bound (default 5 min) so the replay window stays finite.

### Refactoring (`src/crypto/`) — DRY the shared primitives
- **`bytes.js` (new) — one home for the duplicated byte/encoding helpers**: `u8`, `arr`,
  `toBytes`, `concatBytes`, `b64`, `unb64`, and the constant-time `ctEqual` had been
  copy-pasted across `ratchet.js` / `group.js` / `franking.js` / `atrest.js` /
  `fingerprint.js` (4–5 copies each). Extracted to `src/crypto/bytes.js` and imported by
  all consumers — most importantly a single audited `ctEqual` instead of copies that could
  silently diverge (the comparison every commitment/signature/tag check depends on).
  `ratchet.js` still re-exposes `ctEqual` on its factory return for `group.js`'s
  `R.ctEqual`; `fingerprint.js` imports the shared `unb64`/`b64` under its historical local
  aliases so call sites are untouched. Pure refactor — no behavior change; all pre-existing
  suites stay green and a new `tests/bytes.test.js` (12) pins the shared helpers directly.

### Documentation (`CLAUDE.md`, `README.md`, `docs/CRYPTO-SPEC.md`, `SPEC.md`)
- All stale line/endpoint/test counts corrected:
  - `CLAUDE.md`: client 12,696→13,116 lines, worker 1,347→1,888, sw 140→145,
    endpoints 28→32, i18n keys 406→420.
  - `README.md`: validate score 32/35→33/36.
  - `CRYPTO-SPEC.md`: 347→364 tests, 32/35→33/36, worker test count 173→182,
    §7 worker tests 98→182.
  - `SPEC.md §3.2`: heading 25→32 endpoints; 7 missing endpoints added to table.
- `validate.sh` SRI gate confirmed correct (sha384 matches lang.js).

### Test Suite (`tests/`)
- **13 suites, 433 tests** passing (`npm test`); `validate.sh` 33/36 (PASSED).
- Worker: group kick TTL regression test (1); corrupt KV data resilience via
  `safeJsonParse` (7); backup type guard (1); AI handler — `reply_suggest` non-string
  context, missing context, capped error echo, `chat` non-string/oversized text (4);
  OTP corruption graceful handling (1); msg-send non-numeric `ts` type guard (1);
  msg-poll non-numeric `lastTs` cursor fallback (1); SSRF redirect-revalidation + IPv4-mapped-IPv6 guard (5); PoW future-ts replay guard (1).
  Total: 197 worker tests.
- Franking: empty message commit/verify (zero-length), tampered commitment bytes
  rejected (binding property), `ctEqual` returns false for different-length inputs
  without throwing. Total: 9 franking tests.
- Negotiate: empty caps array → `[]`, non-array caps treated as absent (no crash),
  `advertise([])` → `x3dh:v4 + caps:[]`. Total: 15 negotiate tests.
- Ratchet: non-v3/v4 message throws (not returns null), `MAX_SKIP*2` eviction prunes
  oversized skipped-key map keeping newest `MAX_SKIP` entries; forged gap message does not
  desync the chain (staged-commit regression). Total: 24 ratchet tests.
- At-rest: `unwrapJWK` rejects an attacker-set absurd/non-finite/non-positive iteration
  count (DoS guard — PBKDF2 hang) in <1s; ceiling-boundary record rejected while the
  legitimate record still round-trips. Total: 12 atrest tests.
- PoW: `verify()` rejects a far-future timestamp (replay-via-future-ts guard) and
  tolerates a small future ts within the skew window. Total: 21 pow tests.

---

## Security Hardening Batch 4 — competitive research (branch claude/nice-ride-T6yb0, 2026-06-08)

Surveyed comparable open-source E2E messengers (Signal, Session, SimpleX) and
WebRTC/Cloudflare security guidance to find concrete gaps. Top finding: Breeze's
safety-number (the only out-of-band MITM defense) was materially weaker than
Signal's.

### Crypto Modules (`src/crypto/`)
- **`fingerprint.js` (new) — Signal-grade safety number**: The legacy
  `index.html safetyNumber()` did a *single* SHA-256 over only 12 of 32 bytes,
  showing ~30 digits (~40 bits) — a relay attempting MITM could grind a colliding
  substitute identity key offline. The new module follows Signal's
  NumericFingerprintGenerator: **iterated SHA-512 (5200 rounds)** over
  `version ‖ identityKey ‖ stableId` per party, first 30 bytes → six 5-digit
  chunks, two fingerprints concatenated in sorted order for symmetry. Result:
  60 digits (~112 bits shown) and ~5200× higher per-candidate grinding cost.
  Optional stable-identifier binding ties keys to identities (matches Signal).
  Dependency-injected/pure; accepts base64 or raw `Uint8Array` keys.

- **`fingerprint.js` — scannable (QR) verification path**: Manual 60-digit
  comparison is error-prone (users skip digits) and only checks the truncated
  ~40-bit-per-chunk display. Added `scannable()` (encodes
  `version(1) ‖ myFp(30) ‖ peerFp(30)` as base64 — a QR payload mirroring
  Signal's CombinedFingerprints) and `verifyScannable()` which cross-matches a
  peer's scanned code (`scanned.local == my remote ∧ scanned.remote == my local`)
  in **constant time** over the full 30-byte fingerprints. Detects MITM key
  substitution, malformed/wrong-length codes, and version mismatch; binds stable
  identifiers like the digit path.

### Test Suite (`tests/`)
- **12 suites, 339 tests** passing (`npm test`); `validate.sh` 32/35 (PASSED).
- `tests/fingerprint.test.js` (17): format (60 digits / 12 groups), symmetry
  (swap local/remote), determinism, MITM-substitution visibility, stableId
  binding, iteration-count binding, base64≡bytes equivalence, full 5200-round run;
  scannable: encoding length, cross-party match, MITM reject, malformed +
  version-mismatch reject, stableId binding.
- Added 30s timeouts to 5 PoW-solving alias tests (the full-strength
  fingerprint test added CPU contention that pushed them past the 5s default).

### Documentation
- `docs/CRYPTO-SPEC.md`: new §6b (safety number), test count 322 → 333.

### Follow-up (gated on browser / two-device validation)
- Migrate index.html `safetyNumber()`/`showSafetyNumber()` onto `fingerprint.js`.
  Note: this changes the displayed number, so it needs a versioned rollout (both
  peers must upgrade to see matching numbers) — hence deferred to a browser pass.

## Security Hardening Batch 3 (branch claude/nice-ride-T6yb0, 2026-06-08)

### Worker (`_worker.js`) — security & robustness fixes
- **OGP hash cache key**: Replaced `url.slice(0, 200)` KV key with
  `sha256Short(url)` (reuses existing helper). Two URLs sharing a 200-char
  prefix no longer collide on the same cache entry. Added 2048-char URL
  length cap; inputs beyond this return 400 `URL_TOO_LONG`.
- **Abuse report `opening` size guard**: `handleAbuseReport` now rejects
  `opening` fields longer than 128 chars before crypto processing. An HMAC
  key is 32 bytes (44 base64 chars); the 128-char cap prevents DoS via large
  inputs to `hmacVerifyFrank`.
- **Push subscription sanitization**: `handlePushSubscribe` previously stored
  the full client-supplied subscription object. Now only `endpoint`, `keys`
  (`p256dh` ≤100 chars, `auth` ≤50 chars), and `expirationTime` are stored;
  extra top-level and nested fields are silently stripped.
- **OTP count fix**: `handlePreKeyUpload` stored the raw `oneTimePreKeys.length`
  as the count even though only `Math.min(length, 100)` entries are written.
  If length > 100 the fetch loop started from an over-capped index, wasting up
  to 100 KV reads. Now stores `Math.min(oneTimePreKeys.length, 100)`.
- **Webhook robustness**: `handleWebhook` call site wrapped in try/catch (it
  was the only API path outside the main try/catch at lines 230–270). Also
  added a try/catch around `JSON.parse(body)` inside the handler; invalid JSON
  now returns 400 instead of propagating as an uncaught exception.

### Test Suite (`tests/`) — additions
- **11 suites, 322 tests** passing (`npm test`); `validate.sh` 32/35 (PASSED).
- Worker: OGP URL length cap + hash key test (2), abuse report oversized-opening
  test (1), push subscription field-sanitization test (1); expired PoW test
  timeout raised to 30s. Total: 168 worker tests.
- `CRYPTO-SPEC.md`: test count updated (319 → 322), security additions updated.

---

## Security Hardening Batch 2 (branch claude/nice-ride-T6yb0, 2026-06-08)

### Crypto Modules (`src/crypto/`)
- **`group.js` — N2 two-layer group authentication (partial AFKS)**: Each encrypted group
  message now carries two Ed25519 signatures: `es` (epoch signature, long-lived per-epoch
  key signs iv‖ct‖cm‖ep‖c‖spk‖nsk) and `s` (per-message signature, fresh keypair discarded
  after use). Both signatures must verify before any key derivation — forging requires
  compromising both keys simultaneously. A leaked per-message key cannot forge other messages
  (epoch sig would fail) and vice versa. The epoch signature authenticates `spk` (per-message
  public key), enabling out-of-order delivery without tracking a signing-key-ratchet chain.
  `newSenderKey` / `rotateEpoch` now generate fresh per-message key pairs; `encryptGroupMsg`
  produces and advances the per-message keypair chain; `decryptGroupMsg` verifies both
  signatures with a legacy single-sig fallback for pre-N2 messages.

### Worker (`_worker.js`) — security fixes
- **KV injection guards**: Added `validateUserId()` to `handlePresence` (single-id path and
  batch-check path using filter), `handleAccountPurchase`, `handleWebhook` (checkout.session
  .completed, subscription.deleted, subscription.updated — Stripe metadata is user-controlled;
  invalid IDs silently skipped to prevent Stripe retries).
- **Public key field size caps**: `handlePreKeyUpload` rejects `identityKey` / `signedPreKey`
  > 5000 chars and `edIdentityKey` / `signedPreKeySig` > 500 chars (`FIELD_TOO_LARGE`);
  each OTP entry capped at 5000 chars. `handleAliasSet` rejects `pub` > 2000 chars.
- **AI prompt injection prevention**: `translate_context` action sanitizes `lang` to BCP-47
  charset `[a-zA-Z0-9-]`, max 20 chars, rejecting empty after sanitization (`invalid lang`).
- **AI summarize memory bound**: Per-message `sender` capped at 100 chars and `text` at 500
  chars before joining, bounding peak memory independent of the 4000-char aggregate truncation.
- **PoW freshness check**: `handleAliasSet` now rejects tokens with a timestamp embedded in
  the challenge (makeChallengeString format `${pub}:${ts}`) if older than 10 minutes
  (POW_EXPIRED). Backward-compatible: old-format challenges (no parseable last segment) skip
  the freshness check (`Number.isFinite(NaN)` is false).
- **Group token length cap**: `handleGroupJoin`, `handleGroupInfo`, `handleGroupKick` reject
  tokens > 128 chars (server tokens are 12 chars; oversized inputs would hit KV's 512-byte
  key limit).
- **Translate type guard**: `handleTranslate` rejects non-string `to` field (would throw
  TypeError on `.slice()`) and normalizes `from` type defensively.
- **Exported handlers**: `handleAI`, `handleTranslate` added to named exports for testing.

### Test Suite (`tests/`) — additions
- **11 suites, 319 tests** passing (`npm test`); `validate.sh` 32/35 (PASSED).
- Group: DoS guards — MAX_GAP reject, MAX_SKIP window semantics (keys beyond MAX_SKIP-1
  from target are dropped), MAX_GAP boundary acceptance (3 tests). Total: 22 group tests.
- Worker: prekey field size caps (4), webhook userId KV injection guard (3), AI handler
  input validation (6), translate input validation (4), alias pub size cap (1), PoW
  freshness check — expired-reject + fresh-accept (2). Total: 162 worker tests.
- PoW freshness test: 30s timeout added (probabilistic solve, occasionally slow on cold JIT).

### Documentation
- `docs/CRYPTO-SPEC.md`: test count updated (316 → 319), security additions list extended
  with all batch-2 hardening, worker test coverage description expanded.

---

## Security Sprint — continued (branch claude/nice-ride-T6yb0, 2026-06-08)

### Crypto Modules (`src/crypto/`) — additions
- **`ktlog.js`**: I11 key-transparency client module — `hashIK` (SHA-256 of IK JSON),
  `parseLog` (filter/sort history), `checkRollover` (compare stored vs incoming IK,
  returns 'ok'/'new'/'rolled'/'unknown' with `storedSeenInHistory` + `rolloverTs`),
  `mergeLog` (dedup by hash, keep earliest ts, cap 20). 25 tests.
- **`pow.js`**: N7 PoW challenge/solve/verify — SHA-256 brute-force, difficulty-16
  minimum, `makeChallengeString` (pub-bound, timestamp-embedded), `solve` (clamps
  16–32), `verify` (POW_REQUIRED / POW_TOO_EASY / POW_CHALLENGE_TOO_LONG /
  POW_PUB_MISMATCH / POW_INVALID). Pure, dependency-injected. 15 tests.

### Worker (`_worker.js`) — additions
- **C12 (RFC 8291 encrypted push)**: `encryptPushPayload` (P-256 ECDH + HKDF-SHA256 +
  AES-128-GCM per RFC 8291/8188) + `buildVapidJwt` (ES256 VAPID JWT). `sendPushToUser`
  now encrypts every push notification; push service sees only aes128gcm ciphertext.
  Helpers: `b64urlToBytes`, `bytesToB64url`, `concatBytes`.
- **Dead Drop, Backup, Signal, Presence, TURN, OGP**: exported for testing
  (`handleDropCreate`, `handleDropRead`, `handleBackupUpload`, `handleBackupDownload`,
  `handleSignal`, `handlePresence`, `handleOnlineCount`, `handleOGP`, `handleTurn`).

### Security Fixes — `src/crypto/` modules
- **`ratchet.js` — injected-message chain desync**: `ratchetDecrypt` previously
  advanced `recvChainKey`, `recvCounter`, and `seenMsgIds` BEFORE calling
  `subtle.decrypt`. An on-path attacker injecting a message whose ciphertext fails
  the AES-GCM auth tag would permanently desync the receive chain. Fixed: state
  advance deferred until after successful decrypt. Same fix applied to the
  skipped-key recovery path (key was deleted before decrypt). N1 `recvCounter`
  reset regression test also added.
- **`group.js` — same injected-message desync**: `decryptGroupMsg` had the same
  pattern for both the main path and the skipped-key path. Fixed identically.

### Test Suite (`tests/`) — additions
- **11 suites, 249 tests** passing (`npm test`).
- New: `ktlog.test.js` (25 tests: hashIK, parseLog, checkRollover, mergeLog);
  `push.test.js` (15 tests: RFC 8291 round-trip decrypt, VAPID JWT signature verify,
  format/header checks, b64url helpers); `pow.test.js` (15 tests: challenge format,
  solve token structure + hash bits, difficulty clamp, verify accept/reject codes).
- Ratchet extended: N1 Nr-reset regression, AEAD-auth-failure-does-not-desync,
  MAX_SKIP storage-bound (forward secrecy property of skipped-key store),
  consumed-skipped-key replay guard (key deleted on first use).
- Group extended: AEAD-auth-failure-does-not-desync, future-epoch rejection
  (epoch gate forward direction), consumed-skipped-key replay guard.
- Worker extended: Dead Drop (6), Backup (4), Signal relay (5 + sanitizeString ctrl
  chars), Presence (7), OGP SSRF guard (13 + malformed URL), TURN credentials (4),
  account slots (3), userId validation (length bounds + charset), group
  create/join/info/kick validation (7 + creator self-kick guard + post-kick join
  epoch), msg payload-size limit (1), msg poll lastTs cursor (1), msg MISSING_FIELDS
  (1), prekey 0-OTP replenish hint (1) + caps round-trip (1) + caps sanitization (1),
  push subscribe 5-device cap (1), sealed sender missing-id (1) + multi-sender (1) +
  send validation (1).

### Documentation
- `SECURITY.md` architecture table updated to reflect sprint implementations.
- `docs/INTEGRATION.md` extended with §7 (N3 negotiate wiring), §8 (I11 ktlog wiring),
  §9 (C12 push subscription client side).
- `docs/ROADMAP.md` updated: C12 done, I11 module done, N7 pow done, status notes updated.
- `docs/CRYPTO-SPEC.md` §4/§5 security fix noted; §7 worker categories expanded;
  §9 N5/N6/N7 marked done; test counts updated (ratchet 19, group 13, worker 100).

---

## Security Sprint (branch claude/nice-ride-T6yb0, 2026-06-08)

### Crypto Modules (`src/crypto/`)
- **`ratchet.js`**: Full Double Ratchet reference module — X25519/P-256 DH ratchet,
  AES-256-GCM, HKDF-SHA256; I7 skipped-key TTL expiry (7-day default); I16 key
  commitment (HKDF 'breeze-commit', constant-time verify); I1 authenticated X3DH
  (Ed25519 sign/verify SPK, DH1-4 → HKDF 'breeze-x3dh-v5', initiatorSession/
  responderSession); Nr reset fix (both Ns and Nr reset on DH ratchet step). Multi-
  bucket padding (256-byte-aligned). Browser-compatible (no Node-only APIs).
- **`group.js`**: Group sender-key ratchet — I2 forward secrecy (chain hash-ratchet,
  consumed keys dropped); I3 PCS via `rotateEpoch` (fresh chain+signing key, epoch+1);
  N2 per-message Ed25519 signatures (sign on send, verify before ratchet work);
  I16 key commitment; I7 TTL expiry on group skipped keys.
- **`atrest.js`**: I4 at-rest key wrapping — PBKDF2 ≥600k SHA-256 + AES-256-GCM;
  `wrapJWK`/`unwrapJWK`/`migrate` (legacy plaintext→wrapped, idempotent); `zeroBuffer`
  helper. Fixed browser compat: replaced `Buffer.from` with `btoa`/`atob`.
- **`franking.js`**: I17 message franking — HMAC-SHA256 commitment/opening; `commit`/
  `verify`/`verifyReport`; binding + hiding properties.
- **`negotiate.js`**: N3 version negotiation — `CAPS` constants, `advertise`/
  `parsePeerCaps`/`negotiate`; backward compat with legacy x3dh:'v5' field; 'AND' rule
  prevents peer coercion into weaker path.

### Worker (`_worker.js`)
- **G2 (I1 server half)**: `handlePreKeyUpload` verifies Ed25519 `signedPreKeySig`
  against `edIdentityKey`; PREKEY_SIG_INVALID on failure; unsigned bundles accepted
  during v4→v5 transition.
- **G3 (I3 server signal)**: `handleGroupKick` bumps + returns `epoch`; epoch
  initialized to 0 on create; `handleGroupInfo`/`handleGroupJoin` surface epoch.
  Fixed bug: kick of non-member now returns 404 (NOT_MEMBER) without epoch churn.
- **I17 relay**: `/api/abuse/record` (stores commitment, no-overwrite) + `/api/abuse/report`
  (HMAC verify, FRANK_MISMATCH on binding fail). frankId and message size limits added.
- **I11 precursor**: `ktlog:{userId}` audit log — SHA-256 of each IK appended on upload,
  capped at 10 entries; returned on fetch as `keyHistory`. Clients can detect rollovers.
- **OTP replenish hint**: `replenishOTP: true` in fetch response when remaining OTP ≤ 5.
- **Validation improvements**: frankId length limit (128), abuse report message size
  limit (256 KB), sealed sender handlers exported for testing.

### Test Suite (`tests/`)
- 8 suites, **110 tests** passing (`npm test`), validate.sh 32/35 (PASSED).
- New suites: `kat.test.js` (RFC/NIST KATs), `x3dh.test.js` (X3DH+full session),
  `group.test.js` (FS/PCS/N2), `atrest.test.js` (wrap/unwrap/migrate/zeroBuffer),
  `franking.test.js`, `negotiate.test.js`.
- Worker tests extended: G2 signed-prekey, G3 epoch, I17 franking, I11 key-history,
  sealed sender round-trip/dedup/ack, msg send/poll with timestamp/self-send/dedup.

### Documentation
- `docs/CRYPTO-SPEC.md`: formal spec of `src/crypto/` modules, wire formats, test status.
- `docs/IMPROVEMENTS.md`: I1–I20 from peer software + arXiv/ePrint survey.
- `docs/ROADMAP.md`: prioritized P0–P3 backlog with dependency graph + updated status.
- `docs/INTEGRATION.md`: turnkey browser-side integration runbook (index.html wiring
  for N1/G4/G1+G2/G3/G5/I17), with exact line references and two-device test checklists.
- `docs/CATEGORY-RESEARCH.md` / `docs/CATEGORY-RESEARCH-2.md`: 20 product categories,
  10 arxiv/GitHub references each.

## v3.6.0 (2026-03-15)

### P2P Core (Session 2)
- **DC heartbeat**: ping/pong via state channel every 10s, 3 miss → ICE restart
- **Group P2P direct delivery**: dual-path (P2P instant + sealed reliable) with dedup
- **Key change warning**: 3 decrypt failures → yellow banner + toast + audit log (Signal-style MITM detection)
- **P2P-only mode**: server unreachable → yellow banner, P2P connections still work
- **RTT-based adaptive quality**: heartbeat pong RTT feeds image compression + poll interval
- **Sealed sender retry**: retry queue uses sealed sender first (privacy-preserving)
- **File transfer progress bar**: send/receive with % + speed (MB/s) + green bar

### UX Polish (Session 2)
- **Native `<dialog>` modals**: auto inert background, focus trap, ESC, `::backdrop blur`
- **Trusted Types policy**: `breeze-sanitizer` — DOMParser sanitization, eliminates DOM XSS
- **Swipe-to-reply**: right swipe 60px on messages → reply (WhatsApp/Signal gesture)
- **Swipe-left-to-archive**: contact list left swipe → toggle archive
- **Message multi-select**: context menu "Select" → floating action bar (batch delete/forward)
- **Image auto-compress**: OffscreenCanvas → WebP, adaptive quality, 1920px max
- **Markdown tables**: `| col | col |` + separator → `<table class="md-table">`
- **Theme smooth transition**: `html.theme-transitioning` CSS class, 400ms
- **Emoji frequency sort**: usage count tracking, most-used rises to top
- **OGP favicon + site name**: Google Favicon API + og:site_name in link previews
- **Disappearing message live countdown**: `⏱5m` → `⏱30s` → fade+remove
- **Voice message duration**: loadedmetadata → `1:23` display
- **Contact typing in sidebar**: green "typing..." in preview (5s TTL)
- **Group member count in header**: `[3人]` badge
- **Copy in context menu**: clipboard + toast
- **Scroll to unread on open**: `.unread-sep` scroll target
- **Pinned message banner**: clickable, latest pin at chat top
- **PWA engagement-gated install**: visits≥2 or msgs≥3, 7-day cooldown
- **Proactive storage quota**: 80% warning before IDB fails
- **getAllRecords direction:prev**: Chrome 141+ reverse-read 68% faster
- **CSS scroll anchoring**: overflow-anchor for prepend stability

### Reliability & Edge Cases (Session 2 cont.)
- **Sealed poll crash-safe**: 5-min grace period → client ACK → worker delete
- **`/api/sealed/ack`**: 28th endpoint; crash-safe message processing confirmation
- **Clock drift detection**: serverTime in `/api/health` → ±2min drift warning
- **Worker version mismatch**: client detects server update → "Update available" toast
- **Notification action buttons**: Reply (inline text) + Mark Read from notification
- **Quick-reply from notification**: SW → postMessage → openConversation → sendMessage
- **Browser back button**: `history.pushState` on mobile → popstate → close conversation
- **IDB upgrade multi-tab**: BroadcastChannel `db-upgrade` → other tabs close DB
- **Contact context menu enhanced**: Archive + Mark Read added to right-click menu
- **Signal cleanup on poll**: consumed ICE candidates auto-deleted after 30s
- **OGP fetch timeout**: 5s AbortController (non-blocking)
- **Outbox badge**: counts both relay queue + P2P persistent queue

### Export & Sharing (Session 2 cont.)
- **`/export html`**: human-readable, self-contained HTML chat export (printable)
- **`/contacts export`/`import`**: JSON backup/restore of all contacts
- **Web Share Target**: receive shared text/URL from other apps → paste in conversation
- **QR code camera scan**: BarcodeDetector API (Chrome 83+, Safari 17.2+)
- **Print CSS enhanced**: break-inside:avoid, branding watermark, non-print elements hidden

### Security Hardening (Session 2 cont.)
- **🔴 CRITICAL: Signal encryption complete**: edit/delete/reaction ALL encrypted before relay (previously reaction sent plaintext — server could read emoji reactions)
- **🔴 CRITICAL: Group encrypted signal handler**: `msg.groupId && msg.isSignal` path added — group edit/delete/reaction decrypted and processed correctly
- **CSP `trusted-types`**: both `<meta>` and `_headers` enforce breeze-sanitizer policy
- **`safeSetHTML()`**: wired to cmdOutput (all slash command output sanitized)
- **`downloadBlob()` DRY**: all 7 download sites consolidated, auto revokeObjectURL
- **Dark/light theme-color meta**: responsive to OS preference for browser chrome
- **TURN fallback indicator**: 🟢 Direct / 🟢 STUN / 🟡 TURN + RTT + protocol
- **SR connection announcements**: screen reader notified on P2P state changes
- **Health check: AI/translate feature flags**: client knows available providers
- **Aria-labels**: 24 buttons labeled (folder tabs, dialog, select mode)
- **`.msg.sys` CSS**: centered, dashed-border system messages
- **Worker `fetchWithTimeout()`**: all external API calls (Stripe, AI, translate) protected with 10s timeout
- **Clock offset correction**: `correctedNow()` for all outgoing timestamps — anti-replay compliant
- **Stale DR session pruning**: startup cleanup of orphaned Double Ratchet sessions
- **toggleReaction → sendSignal**: DRY — reactions use unified encrypted signal path

### Reliability (Session 2 cont.)
- **Dead letter queue**: 3x failed messages → IDB persist (max 100) + `/retry` command
- **Retry queue persistence**: IDB primary + localStorage beforeunload fallback
- **Code block click-to-copy**: `pre.md-pre` click → clipboard
- **RTL auto-detection**: `dir="auto"` on all message divs (Arabic/Hebrew support)

### AI & Translation Integration
- `/api/ai` — Multi-provider AI proxy: Anthropic Claude → OpenAI → Groq
  - Actions: `chat`, `summarize`, `reply_suggest`, `translate_context`
  - KV cache: chat=1h, summarize/translate=24h
- `/api/translate` — 4-provider translation: DeepL → Google Cloud → LibreTranslate → MyMemory
- `/ai <question>` slash command — inline AI chat in conversation
- `/summarize` upgraded — AI-powered with local extractive fallback
- Smart replies AI upgrade — local instant → async AI replacement
- Message translate — 2-tier: translation API → AI context-aware fallback
- Smart language detection: JA text → EN, EN text → JA (user lang aware)

### WebRTC & P2P Hardening
- **Perfect Negotiation** (MDN spec): eliminates glare/collision deadlocks
  - `onnegotiationneeded` handler replaces manual offer creation
  - Polite/impolite peer roles with automatic rollback on collision
  - Symmetric code — same logic for both initiator and responder
  - ICE restart triggers `onnegotiationneeded` automatically
- DataChannel `negotiated:true` (id:0) — skip DCEP handshake
- `RTCPeerConnection.generateCertificate()` — fresh ECDSA P-256 per session
- `bufferedAmountLowThreshold` event-based backpressure (polling eliminated)
- `CHUNK_SIZE` 64KB → 16KB (safe cross-browser `sctp.maxMessageSize`)
- `getSafeChunkSize()` — dynamic SCTP detection with 64B margin
- ICE restart on `disconnected` (avoid full teardown), full reconnect only on `failed`
- Relay-only mode: `iceTransportPolicy: 'relay'` + srflx/prflx candidate stripping
- Unified ICE config: `getCallICEConfig()` shared by P2P + calls

### Cryptography & Protocol
- **Real QR code generator** (ISO 18004): replaced placeholder with fully scannable encoder
  - Byte mode, EC level L, versions 1-10 (up to 271 chars)
  - Reed-Solomon GF(256) error correction, proper masking
  - Pure JS, 0 dependencies, ~100 lines
- Message compression: CompressionStream `deflate-raw` before encryption (v4 protocol)
  - Adaptive threshold: 256B default, 128B on 3G, 64B on save-data
  - Backward-compatible: v3 (uncompressed) still decrypted
- Skipped message keys (Signal spec §3.4): store up to 100 skipped keys/session
  - Handles out-of-order message delivery over unreliable transport
  - Auto-prune oldest keys when buffer exceeds 200
- New padding format: `[flags:1][length:2][data...]` (v4) vs `[len:1][data]` (v3)
- Protocol version: v4 (compress+pad) with v3 and v2 backward compatibility

### Critical Bug Fixes
- **t() TDZ self-reference ×13**: `voiceMsg: t('voiceMsg')` in `const _I` triggered Temporal Dead Zone — all 13 keys silently returned key names instead of values
- **`const t` shadow in P2P edit handler**: Variable shadowed global `t()` i18n function — all subsequent `t()` calls in that scope were broken
- **showMsgMenu classList logic error**: `btn.classList.remove(...); btn.classList.add('color-r')` separated by semicolon — applied `color-r` to ALL items instead of danger items only
- **CONFIG `REPLAY_CACHE_SIZE` duplicate**: Two definitions (2000 and 200) — second silently overwrote first
- **`uiNoResults` infinite recursion**: `uiNoResults: (q) => t('uiNoResults', q)` — would stack overflow at runtime

### i18n Completeness
- 60+ hardcoded English strings → `t()` calls
- showCallUI: calling/incoming/mute/unmute/camOff/camOn
- Contact menu: Rename/Safety Number/Pin/Mute/Block/Label/Delete
- /help: 9 section headings
- /billing: all dashboard strings
- /info: all field labels + status values
- /settings: Privacy/Sound section headers + relay-only toggle
- Message: (edited), ↗ Forwarded, React, Bookmark, Translate
- EN/JA: 329/329 perfect parity (was 228)

### Settings & Privacy
- Relay-only mode toggle in `/settings` (localStorage persistent)
- ICE candidate filter: host + srflx + prflx stripped in relay-only
- `/security` shows: relay-only status, RTC cert, DataChannel config, AI/translate status

### Worker
- `/api/ai` endpoint (10 req/min rate limit)
- `/api/translate` Google Cloud Translation provider added
- `X-Breeze-Version` header synced to 3.6.0
- New env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `GOOGLE_TRANSLATE_KEY`
- Optional model override: `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `GROQ_MODEL`, `OPENAI_BASE_URL`

## v3.5.0 (2026-03-13)

### Critical Fixes (R108-R115)
- 3× setInterval closure bug: `}, N);` → `}, N));` — half of initMessenger was unparseable
- Worker orphaned code: 51-line handleCheckout body in global scope → runtime crash
- Message ID collision: `myId + ':' + ts` → `genMsgId()` with sequence counter
- Desktop: WEB_ROOT = `__dirname` → `process.resourcesPath` (white screen in packaged app)
- Desktop/mobile: lang.js missing from builds (924 languages lost)
- showConfirm 3-arg call for /wipe (opts ignored → no danger styling)

### Security
- Rate limits: 23/23 endpoints (was 12/23)
- Worker: POST method enforcement (405 for non-POST API)
- Worker: Input sanitization on 5 handlers (names in KV)
- OGP fetch: 5s AbortController timeout + SSRF private IP blocking
- File type blocking: 24 dangerous extensions (.exe, .bat, .ps1, etc.)
- CORS: `'*'` fallback → `'null'` (no wildcard API access)
- Stripe webhook: event.id dedup (24h TTL) + constant-time signature
- Replay cache: 2,000-entry LRU for message dedup
- CSP, HSTS preload, Permissions-Policy headers
- PBKDF2 600K iterations lock screen

### Data Integrity
- Outbox persistence: localStorage save/restore (survives reload)
- encryptGroupMsg failure: toast + abort (was silent undefined)
- /wipe: full local + remote wipe with danger confirm dialog
- IDB QuotaExceededError: auto-cleanup old messages
- IDB connection loss: auto-reload recovery

### Performance
- DOM cache: `_DOM.get()` memoizes getElementById (131 calls)
- rAF-based render coalescing
- Adaptive networking: 2g/3g/4g poll/compress adjustment
- Deferred startup via requestIdleCallback

### UI/UX
- Landing page: 3 feature tiles (E2E, No registration, Cross-platform)
- Pricing: CSS Grid responsive 4-card layout with i18n (EN+JA)
- /help: all 50+ commands in 6 categories (was 15)
- /about: plan name + CONFIG.VERSION
- theme-color meta: dynamic on toggle + init + OS change
- `<noscript>` fallback for JS-disabled browsers
- twitter:card → summary_large_image
- Modal focus trap (Tab key containment)
- Keyboard shortcut overlay (? key)

### i18n
- 228/228 EN/JA parity (was 215)
- Pricing cards, wipe dialog, confirm dialogs, search placeholders

### Build System
- mobile/: Rebuilt from scratch — Capacitor 6.2, prepare.js with SHA256 hashes
- desktop/: lang.js in extraResources, resourcesPath fix, version 3.5.0
- deploy.sh: Rewritten for Lite/Plus/Pro pricing (was Monthly/Annual)
- build.sh: 9 commands, unified WEB_FILES array
- release.yml: lang.js in all builds, softprops/action-gh-release@v2
- dist/*: All version 3.5.0, owner shizukutanaka

### Developer Experience
- AGENTS.md (207L): AI agent rules for all tools
- CLAUDE.md (34L): Concise rules for Claude Code
- .claude/settings.json: PostToolUse hooks + permissions
- .claude/commands/: 4 custom slash commands
- validate.sh: 35 quality gates (100% pass)

## v3.0.0 – v3.4.0 (2026-02 – 2026-03)
- E2E encryption: X25519 + AES-256-GCM + Double Ratchet
- Sealed sender, sender key O(1) for groups
- WebRTC DataChannel P2P + server relay fallback
- Voice/video calls, file transfer (64KB chunks)
- Multi-account (up to 999 with Pro plan)
- 924 languages (lang.js)
- PWA + Electron + Capacitor (6 platforms)
- 36 slash commands
- Stripe billing (3 tiers)

## v1.0.0 – v2.0.0 (2026-01 – 2026-02)
- Initial P2P messenger with ECDH P-256
- Single HTML + Cloudflare Worker architecture
- Basic chat, contacts, groups
