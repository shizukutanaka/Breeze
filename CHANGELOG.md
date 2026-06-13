# Changelog

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
