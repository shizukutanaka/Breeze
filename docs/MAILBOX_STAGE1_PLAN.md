# Mailbox redesign — stage-1 plan (2026-11-13)

Context: the server-rethink recommendation (2026-11-13) concluded that the
relay's remaining jobs are (a) rendezvous, (b) store-and-forward mailboxes,
(c) the key directory — and that the highest-value fix is not more P2P but
repairing the mailbox: today each recipient's queue is **one KV value**
mutated read-modify-write, which inherits KV's three structural limits:

- the free tier's **1,000 KV writes/day** ceiling (presence heartbeats
  alone can consume ~288/day/user),
- **1 write/second per key**, serialising concurrent sends to one
  recipient,
- **eventual consistency**, which forced the read-back/re-append
  recovery protocols in both send handlers (PR #388/#389 territory) —
  recovery, never exactly-once.

The target shape: **one Durable Object per recipient mailbox** (strong
consistency, ordering, per-mailbox limits, hibernatable WebSocket
notification), KV demoted to the key directory (prekey bundles / ktlog /
alias / devices), sealed sender completed. This document stages that
migration so every step ships independently and can be rolled back.

## Step 1 — storage abstraction (this PR, done)

All mailbox reads/writes now go through the **MailboxStore** handle in
`_worker.js` (`mailboxStore` / `mailboxStoreForKey` / `listMailboxKeys` /
`eraseMailboxes`). No behaviour change: same keys, same TTLs, same
return contracts (read → `string|null`, write/delete → `boolean`).

Moved behind the store:

| Consumer | Keys |
|---|---|
| `handleMsgSend`, `handleMsgPoll` | `inbox:{id}`, `inbox:{id}:hwm` |
| `handleSealedSend`, `handleSealedPoll`, `handleSealedAck` | `sealed:{id}`, `sealed:{id}:hwm`, `sealed:{id}:dropped` |
| `handleAccountDelete` | both families erased via `eraseMailboxes`; sent-copies sweep lists the `inbox` family via `listMailboxKeys` |

Deliberately **not** moved in this step (each is a different storage
shape, addressed by its own later step or none):

- `sig:{room}` rendezvous — a consume-on-read room queue, not a mailbox;
  it gets its own treatment if/when rendezvous moves to Durable Objects.
- `drop:{id}` dead drops — single-key one-shot values; no queue semantics.
- `prekey:*`, `ktlog:`, `alias:`, `devices:`, `grp:`, `push:`, `backup:`,
  `frank:`/`report:`, `presence:` — the directory/control plane. They stay
  on the `kv*` helpers; demoting KV to *only* this plane is step 4.

The store surface a future backend must honour:

```
readQueue()            -> string | null
writeQueue(value, ttlSec)   -> boolean
deleteQueue()          -> boolean
readHwm() / writeHwm(value, ttlSec) / deleteHwm()
readDropped() / writeDropped(value, ttlSec) / deleteDropped()
```

## Step 2 — Durable Object backend

- One DO class (`MailboxDO`), one instance per recipient
  (`idFromName(userId)`), holding queue + hwm + dropped in DO storage so
  a send becomes a single serialized, transactional append. Inside the
  DO, the read-back recovery protocols are unnecessary and are skipped;
  the strict-monotonic-ts invariants they protect are enforced by
  serialization instead.
- Both queue families live in the same DO (one mailbox per recipient,
  not per family) so account erasure and per-mailbox limits span the
  whole mailbox.
- Backend selection by env flag (`MAILBOX_BACKEND=kv|do`), default `kv`.
  Migration per mailbox is drain-based and safe at any moment because
  queues are TTL-bounded (7 days): on first DO access for a recipient,
  seed the DO from the KV queue if present, then serve from the DO and
  delete the KV copy. No dual-write window, no client-visible change.
- The vitest suite must pass against **both** backends: the worker tests
  already run against a mock KV; add an in-memory DO-storage fake behind
  the same MailboxStore surface and run the queue handler tests against
  it (the handlers are backend-agnostic after step 1 — that is the
  point of the seam).
- Deployment changes: `wrangler.toml` gains the DO binding + migration
  tag. Rollback = flip the flag back before the KV copies are deleted,
  or accept ≤7-day-old queue state as the rollback window (document the
  choice at rollout time, not here).

## Step 3 — sealed sender completion (server-side parts implemented, 2026-11-13)

Independent of step 2's backend, in the mailbox layer:

- **Delivery tokens** (Signal's model): submission to a mailbox requires
  a token derived from the recipient's profile/identity key, derivable
  only by contacts; blocking a sender rotates the key material the token
  derives from. This is what makes *unauthenticated* deposit
  accountable once sender identity is fully sealed. Needs a client
  release to derive and attach tokens — server accepts tokenless
  deposits until a flag flips (same rollout doctrine as
  `QUEUE_REQUIRE_AUTH`).
- **Per-mailbox rate/size limits**: deposit frequency and queue byte
  caps enforced per mailbox (inside the DO after step 2 — the natural
  home for the per-user limits the code has long noted KV cannot do).
- **Padding audit**: sealed v2 already pads ciphertext client-side to
  256-byte boundaries; verify the *stored record* doesn't re-leak exact
  sizes via queue JSON framing, and bucket-pad at the store layer if it
  does. Constant-rate cover traffic stays out of scope (battery/bandwidth
  cost; no mainstream messenger ships it always-on).

- **Outcome (2026-11-13).** The three bullets live in different places,
  and only the first could be completed from the server side:

  1. *Per-mailbox limits — implemented (frequency half).* The
     MailboxStore gains `checkDeposit()`; the DO backend enforces
     `DEPOSIT_LIMIT` (120 deposits/minute, 1,200/hour — one window
     spanning both families, per step 2's "per-mailbox limits span the
     whole mailbox") atomically inside the recipient's DO, and
     `handleSealedSend` answers 429 `MAILBOX_RATE_LIMITED` past the
     cap, un-marking the dedup key on denial so a retry is judged by
     the gate rather than swallowed as a duplicate of a message that
     was never stored. The KV backend is a documented no-op: a KV
     counter would spend the scarce write quota on a check eventual
     consistency makes racy — enforcement exists exactly when
     `MAILBOX_BACKEND=do`. The gate fails open on DO RPC failure (a
     mitigation layer, not a correctness invariant; the queue caps
     still bound storage). The plain path is deliberately not gated —
     stage 0 froze it byte-for-byte pending removal. The *size* half
     of the bullet needed no new mechanism: the per-message cap
     (256 KB per envelope) and the queue caps (100 entries / 16 MB via
     `capQueueBytes`, FIFO eviction with the loss surfaced to the
     recipient through the `dropped` counter) already bind every
     mailbox on both backends — audited, not rebuilt.
  2. *Padding audit — done; one Low finding; the fix is client-side.*
     The queue JSON framing itself is clean: per-entry overhead is
     constant (field names plus a 13-digit `ts`), so framing does not
     re-leak sizes, and the message payload stays bucketed as designed
     (ratchet v4 / group v5 pad plaintext to 256-byte boundaries
     before encryption). But the sealed *metadata* block is not
     padded: `sealMeta` encrypts `JSON.stringify(meta)` directly and
     `se.ct` travels as a number array, so the stored record reveals
     the exact metadata length (array length = JSON byte length + the
     16-byte GCM tag) — display-name length and the presence/length of
     optional fields such as a replyTo preview are inferable by the
     relay. **Severity Low**: length only, the observer is the relay
     (which already sees recipient, timing, and volume), no content
     and no sender identity. Store-layer padding cannot fix it
     without breaking the send path's byte-equality read-back check
     and the dedup key; the real fix pads the metadata before
     encryption in `sealMeta` (both mirrors — index.html and
     `src/crypto/seal.js` — with a framing the decrypt side can
     strip). Recorded here as a client follow-up; not done in this
     step. **Fixed client-side (2026-11-13):** `sealMeta` now frames
     the metadata plaintext as `[0x01][len:2 BE][JSON][0x00 …]`
     padded to a 256-byte bucket (the same granularity as the
     message body) before encryption, in both mirrors. The frame
     lives inside the plaintext, so key/AAD derivation is unchanged
     and pre-padding blobs still open — legacy plaintext is raw JSON
     and always starts with `{` (0x7B), the frame with marker 0x01;
     `unsealMeta` dispatches on the first byte. What the relay can
     now see is only the bucket (256-byte granularity), no longer
     the exact length. Pinned by tests in `tests/seal.test.js`
     (bucket lengths, legacy open) and `tests/mirror-drift.test.js`
     (cross-mirror bucket parity, legacy open with both impls).
  3. *Delivery tokens — client-required, unchanged.* Nothing
     server-side can begin: the token derives from recipient key
     material only contacts hold, senders must attach it and the
     recipient side must expect it, so a client release leads (the
     bullet above already says so). The server continues to accept
     tokenless deposits; the flag flip comes after the fleet ships
     token support. In the meantime the frequency gate above makes
     unauthenticated deposit at least rate-accountable per mailbox.

## Step 4 — KV demoted to the key directory (implemented, 2026-11-13)

- After step 2, KV holds only directory/control data: `prekey:*`,
  `ktlog:`, `alias:`, `devices:`, `grp:`, `push:`, `backup:`, `frank:`/
  `report:`. The mailbox write pressure on the 1,000 writes/day free
  ceiling disappears; what remains is dominated by **presence**
  heartbeats (~288/day/user worst case).
- Presence is not a mailbox, but it is the same write-budget problem:
  evaluate moving presence into the recipient's DO (or a presence DO)
  in this step, keeping the 5-minute KV write throttle until then.
- **Outcome:** presence moved into the recipient's own MailboxDO
  behind a `PresenceStore` seam and a separate `PRESENCE_BACKEND`
  flag (default `kv`, binding-gated fallback, drain migration through
  an independent `presenceSeeded` marker so the two flags' migrations
  never touch each other's data). A dedicated presence DO was
  evaluated and rejected — a single overwritten record per user needs
  nothing the recipient's DO lacks, and a new class + binding +
  migration is deployment surface for zero capability. The 5-minute
  write throttle is kept on both backends: DO storage writes are
  metered too, so the throttle now bounds DO writes instead of KV
  writes. With both flags at `do`, KV holds the directory/control
  plane plus the two one-shot shapes step 1 deferred by name
  (`sig:{room}`, `drop:{id}`). Details in CHANGELOG.md (stage-1
  step 4 entry) and `tests/presence-store-do.test.js`.

## Step 5 — WebSocket delivery (client work, planned here only)

- With mailboxes in DOs, a hibernatable WebSocket per recipient replaces
  the 3 s / 15 s polling loop for foreground delivery; polling stays as
  the fallback for background/PWA contexts. This is a client change and
  ships as its own release; the server side is just the DO upgrade
  protocol.

## Later (stage 2 of the recommendation, not this plan)

- The same MailboxStore surface is the portability seam for the
  self-host Node entrypoint: a SQLite-backed implementation behind the
  identical interface, so the handlers run unchanged off-Cloudflare.
- Redundant deposit to 2+ mailboxes (client-side, dedup by message id)
  answers the "server dies → contacts stranded" failure mode.

## Invariants for every step

- The crypto protocols (X3DH, Double Ratchet, group sender keys) are
  untouched by all steps above.
- Full vitest suite + `./validate.sh` PASSED on the shipping backend(s)
  before merge; behaviour changes are called out in CHANGELOG.md per
  step, as with stage-0.
- Any step that needs a client change keeps the server backward
  compatible behind a flag until the client fleet has shipped
  (established rollout doctrine for the auth flags).
