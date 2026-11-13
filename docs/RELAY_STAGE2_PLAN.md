# Relay placement — stage-2 plan (2026-11-13)

Context: stage 1 (docs/MAILBOX_STAGE1_PLAN.md) rebuilt the mailbox on
the official Cloudflare deployment — MailboxStore abstraction, per-
recipient Durable Object backend, per-mailbox deposit limits, presence
behind its own seam, WebSocket wake-up — and closed with two sentences
pointing here: the same seams are the portability layer for a
self-hosted relay, and redundant deposit answers the "server dies →
contacts stranded" failure mode. This document is stage 2 of the
server-rethink recommendation (2026-11-13): **the relay's remaining
jobs (rendezvous, store-and-forward mailbox, key directory) stay dumb
and interchangeable, and the user chooses where the relay runs** —
the official serverless deployment, a self-hosted Node relay
(Docker + SQLite), or several of those at once.

Like stage 1, every step below ships independently, keeps today's
behaviour as the default, gates anything new behind a flag or an
explicit user setting, and records its outcome here (or in its own
step document) when it lands.

## Verified starting point (what the code already gives us)

Derived by reading `_worker.js` (3,974 lines), `index.html`, `sw.js`
and `wrangler.toml` at stage-1 completion (main `aa554b0`). Line
numbers drift; the shapes are the load-bearing part.

1. **Two storage seams carry everything.** The directory/control
   plane (prekey bundles, ktlog, alias, devices, groups, push
   subscriptions, backups, frank/report, `sig:{room}`, `drop:{id}`)
   is touched only through the `kv*` helpers — five call sites total,
   one of them direct (`env.KV.list` in the health handler's `sig:`
   cleanup). The total KV API surface used is: `get(key)`,
   `put(key, value, { expirationTtl })`, `delete(key)`,
   `list({ prefix, limit, cursor })` → `{ keys: [{ name, expiration }],
   list_complete, cursor }`. Mailboxes go through the MailboxStore
   surface (queue/hwm/dropped × read/write/delete, plus
   `checkDeposit()`); presence through PresenceStore (read/write/
   delete).
2. **The portability seam that matters is the Durable Object's op
   protocol, not just the store surface.** `MailboxDO.fetch` executes
   `{ op: 'get'|'put'|'del'|'deposit', family: 'inbox'|'sealed'|
   'presence', slot, value?, ttlSec?, userId }` serialized per
   instance, over single-key `state.storage` get/put/delete of
   `{ v, exp }` entries (plus the `deposits` timestamp log and the
   `seeded`/`presenceSeeded` markers). No storage `list`, no
   transactions API, no alarms are used anywhere in the class.
3. **Atomicity is a host property, not a surface property.**
   `checkDeposit()`'s check-and-record is atomic because the DO
   serializes requests per instance. A backend that issues the same
   reads/writes as separate statements across awaits in a
   multi-process host silently loses that property. Any stage-2
   backend must provide **per-mailbox serialization** itself
   (decision D1).
4. **Everything above the seams is portable Fetch + WebCrypto.** The
   router (37 POST routes, `/api/health`, the one WebSocket upgrade
   route), all handlers, queue/prekey/group auth, PoW, franking, Web
   Push (WebCrypto VAPID + `fetch` to the push service) and TURN
   credential issuance (HMAC) use only standard `Request`/`Response`/
   `URL` and `crypto.subtle`. No `caches`, no `waitUntil`, no
   scheduled handlers.
5. **The Cloudflare-only surface is narrow and enumerable.**
   (a) `env.ASSETS.fetch` — one call site — serves the static app;
   `_routes.json` routes only `/api/*` to the worker, and `_headers`
   (the CSP!) is a Pages feature, not worker code. (b) The
   `env.MAILBOX_DO` namespace (`idFromName`/`get`/stub `fetch`) and
   the `MailboxDO` class's `state.storage`, `state.acceptWebSocket`,
   `state.getWebSockets`, `WebSocketPair`, and hibernation.
   (c) The `CF-Connecting-IP` header, read once, feeds the router's
   rate limiter. The limiter itself is already in-memory.
6. **The client has exactly one API funnel and no baked-in relay.**
   Every call goes through `postAPIRaw` / `_signal()` →
   `fetchT(API + path)`, health/feature detection through
   `fetchT(API + '/health')`; `API` is a `const` derived from
   `location.origin` (empty on localhost). No production relay URL is
   hardcoded in the client, the worker or `sw.js`. The shipped CSP
   already allows it (`connect-src 'self' https: wss: …` in
   `_headers`) and the worker's CORS already echoes any real browser
   `Origin` — cross-origin relay use is permitted by today's
   artefacts, unused by today's client.
7. **Settings and identity already live in the right places.** The
   `_settings` object is persisted whole to the per-account
   IndexedDB `settings` store (key `app`); each account has its own
   database, so anything added to `_settings` is per-identity by
   construction. Identity keys live in the `identity` store
   (optionally passphrase-wrapped). The relay itself has **no
   identity key today** — the VAPID key pair is push-only (P-256),
   though `/api/health` already publishes it plus a `features` /
   `capabilities` block (the `features.ws` precedent from stage-1
   step 5) that a relay identity and multi-relay capability plug
   into without new plumbing.
8. **Rendezvous already smuggles the home relay — once.** Invite
   links are built on `location.origin` (`?add=@alias` /
   `?add=<pub>&name=…`), so the inviter's serving origin *is* in the
   link a contact arrives through; the contact record then stores
   only id/pubkey/name and forgets it. The prekey bundle record
   (`prekey:{id}`: identityKey, edIdentityKey, signedPreKey(+Sig),
   uploadedAt, sanitized `caps`, legacy `x3dh`) is the other natural
   carrier; its signed-upload digest binds an enumerated field list,
   so authenticating a new field is a deliberate wire decision, not
   an accident.
9. **Delivery semantics are already redundancy-tolerant.**
   Queue entries are `{ envelope, ts }` where `ts` is assigned by
   the relay and is only a *per-queue cursor* (poll high-water mark,
   ACK clears `ts <= hwm`, 5-minute poll grace). Ordering and display
   derive from the payload's own timestamp and the ratchet's message
   numbers, which already tolerate the out-of-order arrival the
   P2P/relay paths produce. The recipient drops duplicates by msgId
   (`from` + payload ts): in-memory replay cache first, then the
   IndexedDB `messages` existence check ("already persisted"), i.e.
   dedup survives restarts. Server-side send dedup is content-keyed
   and per-isolate — a loss-prevention hint, never a guarantee
   anything rests on.
10. **The test suite is a portable contract.** vitest imports
    `_worker.js` directly (named exports kept for exactly this) and
    drives it with `tests/helpers/mockKV.js` / `mockDO.js` env
    fixtures. Any host that can construct the same `env` shape can
    be verified by the same suite, plus black-box drills over HTTP.

## Design decisions

- **D1 — One mailbox core, two transports.** Stage 2 does not write
  a third MailboxStore backend behind the worker-side handle. It
  factors the *execution* half of `MailboxDO.fetch` (op dispatch,
  `{ v, exp }` semantics, deposit gate, wake-up fan-out) into a
  mailbox-core module whose storage is an injected single-key
  get/put/delete and whose calls are serialized per userId. The DO
  class becomes a thin adapter (state.storage + hibernation
  registry); the Node host runs the same core over SQLite, in
  process. This preserves the one property the surface cannot
  express — per-mailbox serialization (fact 3) — by construction,
  on both hosts.
- **D2 — Relays never talk to each other.** No federation, no
  server-to-server protocol. All fan-out (bundle upload, deposit,
  rendezvous) is performed by clients, which are the only parties
  that know the full picture anyway. This is the load-bearing
  simplification of the whole stage: a relay stays a dumb,
  interchangeable mailbox exactly as the recommendation requires,
  and "2+ relays" needs no consensus, no shared state, no relay
  identity federation.
- **D3 — The pin authenticates continuity, not virtue.** A relay
  identity key (new, Ed25519) lets a client verify it is talking to
  the same operator it first trusted (TOFU + fingerprint, the
  key-change-warning pattern the client already uses for peers).
  It does not make a relay honest: a pinned-but-hostile relay still
  sees exactly the metadata SECURITY.md already documents. The pin
  exists so a *substituted* relay (DNS/hosting takeover, a lookalike
  URL in a forwarded invite) is detected instead of silently
  adopted.
- **D4 — Redundancy changes no delivery semantics.** Per-relay
  queues stay independent: per-relay ts cursors, per-relay ACKs,
  per-relay deposit limits. The recipient merges N relays' polls
  through the dedup that already exists (fact 9); the sender
  encrypts once and deposits identical bytes everywhere. Nothing
  is exactly-once today and nothing becomes exactly-once; what
  changes is only that one relay's death stops being a single
  point of stranding.

## Step 1 — SQLite storage plane (server-side library only)

- **Purpose.** Give the worker's two seams (fact 1) and the mailbox
  op protocol (fact 2) a SQLite-backed execution that is contract-
  identical to KV and the DO, before any server exists to run it.
- **Scope.**
  - A KV shim implementing exactly the surface of fact 1 over one
    SQLite table (`key TEXT PRIMARY KEY, value TEXT, exp INTEGER`),
    honouring `expirationTtl` on put, lazy expiry on get, and
    `list` returning `{ name, expiration }` pages with a cursor —
    including the health handler's direct `list` use.
  - The mailbox core of D1: op protocol in, `{ v, exp }` semantics,
    deposit gate and wake-up callback, serialized per userId;
    storage injected. `MailboxDO` refactored to an adapter over
    the core (Cloudflare behaviour unchanged — this is the step's
    main risk and the reason it goes first, alone).
  - A storage-driver decision, recorded in the step's outcome:
    `node:sqlite` (built into current Node LTS, zero-dependency —
    the repo's deployed-artifact rule is about the client, but the
    same taste is preferred server-side) vs. a native driver
    package. Exact Node baseline is **unverified** — pin it here
    by experiment, including Fetch-global parity (`Response.json`
    is used inside the DO code paths).
- **Default-unchanged guarantee.** Nothing is wired to a running
  server; the Cloudflare deployment's bindings are untouched.
  The DO adapter refactor must be behaviour-identical: the full
  stage-1 suite (mailbox-store, mailbox-store-do, deposit limits,
  presence-do, mailbox-ws) passes unmodified against it.
- **Verification.** Existing suite green; new contract fixtures run
  the *same* mailbox/KV test files against (a) mockKV/mockDO,
  (b) the SQLite shim + core, and diff the verdicts; a deposit-gate
  race test (parallel deposits to one mailbox) proves D1's
  serialization on the SQLite core. `./validate.sh` PASSED.
- **Done when.** Suite + validate green on both fixture families,
  the driver decision and Node baseline are written into this
  step's outcome, and no production path references SQLite yet.

## Step 2 — Node entrypoint (one process: static + API + WSS)

- **Purpose.** A self-host *entry* for the identical handler code:
  one Node process on one origin serving the static app, the API
  and the WebSocket wake-up — so a self-hosted install behaves,
  from the client's same-origin `API` derivation, exactly like the
  official deployment does today.
- **Scope.**
  - An entry module (new `server/` directory) that builds `env`
    (KV shim and mailbox core from step 1; secrets/flags from
    process environment, reusing existing flag names where they
    overlap), adapts `node:http` requests to the worker's
    `fetch` handler and back, and serves static files itself —
    applying `_headers` (CSP and cache rules are Pages features
    today; the Node static layer must reproduce them or the
    self-hosted client runs with weaker headers than the official
    one) and the `_routes.json` split (`/api/*` → worker, rest →
    static).
  - WebSocket upgrade: the router's existing signed handshake
    (stage-1 step 5) is preserved; the transport terminates at
    the mailbox core's in-process socket registry instead of a
    DO. No hibernation analogue exists or is needed in a
    long-lived process; a process restart drops sockets, which
    step 5 of stage 1 already makes safe (reconnect + catch-up
    poll). Which WebSocket server mechanism (built-in vs. minimal
    hand-rolled upgrade) is chosen is recorded in the outcome —
    the zero-dependency preference of D1/step 1 applies.
  - Client-IP source for the rate limiter replaces
    `CF-Connecting-IP`: socket address by default; a forwarded
    header is trusted only when the operator explicitly
    configures the proxy that sets it (an unconditionally trusted
    `X-Forwarded-For` would hand rate-limit evasion to anyone).
  - **Single-process is the supported topology**, stated in the
    operator docs: it is what makes the in-memory rate limiter
    and D1's per-mailbox serialization true. Multi-process Node
    is out of scope (below).
- **Default-unchanged guarantee.** The Cloudflare deployment does
  not reference the Node entry at all; the official service is
  byte-for-byte unaffected. The entry ships as additional files
  only.
- **Verification.** Boot the entry on localhost; run the worker
  test suite black-box over HTTP against it (health, prekey
  upload/fetch, sealed deposit/poll/ack between two identities,
  WS wake-up frame on deposit); confirm response headers on
  `/` and `/index.html` match the `_headers` contract tests;
  restart the process and confirm queued mail and bundles survive
  (SQLite durability). `./validate.sh` PASSED (it must learn the
  new files exist, no more).
- **Done when.** The black-box drill passes end to end on a clean
  checkout, and the entry starts with nothing but environment
  variables — no code edits — as configuration.


## Step 3 — Docker packaging and the closed-by-default operator surface

- **Purpose.** Make step 2 installable by a non-developer (the
  recommendation's VPS / home-server / Umbrel audience) and safe
  to expose: a self-host that is open to the world by default
  would recreate the spam/abuse economics the official relay's
  limits exist to control.
- **Scope.**
  - `Dockerfile` + a compose example: the Node entry, the static
    app, one data volume holding the SQLite file (and, from
    step 4, the relay identity key). TLS is terminated by the
    operator's reverse proxy by default (browsers reach the
    relay over HTTPS/WSS only, per the recommendation); the
    image itself serves plain HTTP on its port and says so.
  - First-run provisioning: generate the relay identity key
    (step 4) into the data volume if absent; print its
    fingerprint in the first-boot log so the operator can give
    it to their users out-of-band.
  - **Closed by default.** There is no existing allowlist or
    operator-token mechanism in the worker (verified — the
    `*_REQUIRE_AUTH` flags gate *signatures*, not *admission*),
    so this step adds one: an operator-controlled admission
    rule (invite token or explicit userId allowlist, operator's
    choice of the two shapes — decision recorded in the outcome)
    that gates *account creation* on the relay (prekey upload for
    an unknown userId). Deposits to existing mailboxes,
    rendezvous and polls are unaffected — closing registration
    must not break delivery to people already homed there.
    Opening registration is an explicit operator setting, never
    the default.
  - `docs/SELF_HOSTING.md` is rewritten in this step: its current
    claim ("there's no Docker container needed") stops being the
    whole truth the moment this step lands. Backup/restore is
    documented as "copy the data volume" — the SQLite file plus
    key is the entire relay state (fact: every other store is
    derived from or expires out of these).
- **Default-unchanged guarantee.** Packaging only; the official
  deployment and the step-2 entry's defaults are untouched
  (admission gating ships in the *packaging's* default config,
  not as a worker behaviour change — the official relay's
  registration stays as it is).
- **Verification.** Fresh-container drill on a clean machine:
  build, run, register two users (admission on: a third,
  uninvited registration is refused), exchange a sealed message
  end to end, restart the container, confirm delivery state and
  identity fingerprint survive; restore the volume into a second
  container and confirm it serves identically.
- **Done when.** The drill passes and SELF_HOSTING.md describes
  the Docker path as it actually behaves, including the closed
  default and the backup story.

## Step 4 — Relay identity key and client pinning

- **Purpose.** D3: a client can tell "the relay I chose" from "a
  relay I was handed", for self-hosted and official relays alike.
- **Scope.**
  - Server: an Ed25519 relay identity keypair. On Cloudflare it
    is an env secret; on Node it is the step-3 volume key.
    `/api/health` gains an additive `relayKey` field (public
    half) — old clients ignore unknown health fields, as they
    already do. A small POST route (working name
    `/api/relay/attest`) returns the relay's signature over
    `breeze-relay-attest:{relayKey}:{nonce}` for a client-chosen
    nonce, so the pin verifies a *live holder* of the key, not a
    copied string. Rate-limited like the other cheap routes.
  - Client: on first contact with a relay URL, fetch health +
    attestation, store the pin (relay URL → relayKey) in
    `_settings` (fact 7 — per-account by construction), and show
    the fingerprint (first bytes of SHA-256(relayKey), formatted
    like the existing peer safety-number displays) wherever the
    relay is added (step 5's UI) for out-of-band comparison. On
    every later connect, re-verify; **on mismatch, refuse API
    calls to that relay and raise the existing key-change
    warning pattern** — never silently re-pin. A relay that
    cannot attest (pre-step-4 server) is usable only as the
    serving origin (today's implicit trust), never as an *added*
    relay — that asymmetry is what keeps old deployments working
    while making added relays strict from day one.
  - Mirrors: the client change is index.html-only surface (no
    crypto-module mirror is touched — attestation verification
    uses the same Ed25519 verify the client already ships for
    queue auth).
- **Default-unchanged guarantee.** Server side is purely
  additive; a client that never adds a relay behaves exactly as
  today (its serving origin is trusted as today — pinning it
  too, via TOFU on first run, is allowed but not required by
  this step; the decision is recorded in the outcome).
- **Verification.** Suite: health carries `relayKey`; attestation
  verifies against it and fails for a wrong key / replayed nonce
  domain; client tests pin TOFU-store, mismatch-blocks-calls,
  and no-attestation-added-relay-refused. Drill: step-3 container
  + client — add relay, note fingerprint, rotate the volume key,
  confirm the client blocks and warns instead of following.
- **Done when.** Both drills pass and the pin's threat statement
  (D3) is in SECURITY.md next to the metadata table it extends.

## Step 5 — Client multi-relay configuration (own home relays)

- **Purpose.** The user can name 1+ relays as *their* home relays
  — where their mailbox, bundle and presence live — starting
  with their own account's traffic only. Sending to contacts is
  still single-relay until step 6.
- **Scope.**
  - `_settings.relays`: an ordered list of `{ url, pin, label }`
    (pin from step 4). The `API` const becomes a resolver at the
    existing funnel (fact 6): own-account endpoints (sealed/plain
    poll + ack, presence, prekey upload/status, backup, push
    subscribe, mailbox WS, health) are issued per home relay;
    everything else uses the primary (first) relay until step 6.
    Default value of the list is exactly one entry — the serving
    origin — so an untouched install is behaviour-identical,
    including the localhost derivation.
  - Per-relay feature detection reuses health (`features.ws`,
    `capabilities`): a home relay without WS simply gets polled;
    a home relay that is down degrades to the remaining relays
    for *receiving* redundancy of one's own uploads (bundle
    re-upload on the existing 404/expiry path already retries —
    it now retries across relays).
  - Push: the client subscribes per home relay (each relay's
    health publishes its own VAPID key); a push remains only a
    wake-up hint, as today.
  - UI: a relays section in the existing settings surface plus
    add/remove via the add-flow (paste URL → attestation +
    fingerprint display → confirm), with EN+JA i18n keys per
    repo convention. Per AGENTS.md, new CONFIG constants and
    endpoint changes are ask-first items in implementation PRs;
    this plan is the proposal those PRs cite.
  - **Unverified:** the desktop (Tauri) build's origin handling
    for the `API` derivation was not confirmed by this plan's
    reading — step 5's implementation must check the resolver
    against the desktop shell before merge.
- **Default-unchanged guarantee.** No setting touched → the
  resolver returns the legacy `API` value for every call; this
  is pinned by tests comparing request URLs before/after.
- **Verification.** Suite green incl. resolver and fan-out tests
  (bundle upload lands on both relays; poll merges both queues
  with per-relay ACKs; one relay 500s → the other still
  delivers). Two-relay localhost drill (two step-2 entries on
  different ports) with one client account homed on both.
- **Done when.** The drill passes with the primary relay stopped
  mid-session and the account still receives via the second,
  and default installs show zero behavioural diff in the suite.

## Step 6 — Contact home relays and redundant deposit

- **Purpose.** The recommendation's payoff: a message is
  deposited at 2+ of the *recipient's* home relays, so a dead
  relay never strands a contact (the SimpleX failure mode), and
  a sender can reach contacts whose home is not the sender's
  relay at all.
- **Scope.**
  - **Home advertisement, ranked by trust.** Contact records gain
    an optional `home` list (relay URLs + pins where known),
    captured from: (1) the invite origin at add time (fact 8 —
    the inviter's link already carries it; today it is dropped),
    (2) a value the user confirms in the contact's settings,
    (3) an optional `home` hint in the prekey bundle, used only
    to bootstrap contacts added by bare id/alias. The hint is
    deliberately **not** added to the signed-upload digest in
    this step: a hostile relay rewriting it can only redirect
    deposits toward a relay that cannot decrypt them
    (availability, not confidentiality), the ranked carriers
    above override it, and the recipient still polls their real
    relays — the residual risk and the signed-upgrade path are
    recorded in the outcome rather than silently accepted.
  - **Sender fan-out.** Sending encrypts once and deposits the
    identical envelope bytes to each of the contact's home
    relays (default 2, setting may raise to 3 — cost accounting:
    recipient poll load and sender upload both scale with the
    count). Per-relay outcomes are independent: success on any
    one marks the message sent in the outbox; failures retry
    per relay through the existing retry queue; a relay's
    429 `MAILBOX_RATE_LIMITED` defers only that relay's copy
    (limits are per-mailbox-per-relay by D4, so fan-out does not
    multiply pressure on any single mailbox). Prekey fetch
    tries the contact's relays in order and consumes a one-time
    prekey on exactly the one that answers (each relay's bundle
    copy has an independent OTP pool). Rendezvous (`/api/signal`)
    is deposited at the callee's relays the same way — a call
    offer is just another directed message for placement
    purposes. Group sends fan out per member's home list over
    the same mailbox path groups already use.
  - **Recipient side: no protocol change.** Polls already run
    per home relay (step 5) with per-relay hwm/ACK; duplicates
    arriving from two relays meet the existing msgId dedup
    (fact 9). This step adds the tests that make that load-
    bearing claim a pinned one: duplicate interleavings
    (A-then-B, B-then-A, same batch), and the exact-duplicate
    ciphertext's ratchet behaviour — **unverified until these
    tests exist**: whether a duplicate decrypts and dedups, or
    throws in the ratchet and is dropped as undecryptable, both
    end with the user seeing the message once, but only the
    first keeps the copy ACK-able on both relays, so the tests
    decide which handling the client ships.
  - **Capability signal.** Senders learn a peer's client
    supports multi-relay via the existing negotiation surface
    (bundle `caps` for the peer, health `capabilities` for a
    relay). A sender whose peer is pre-step-6 deposits only to
    the first home relay — byte-identical to today.
- **Default-unchanged guarantee.** Contacts without a `home`
  list are served by the account's own relays exactly as today;
  nothing about a single-relay deployment's wire traffic
  changes.
- **Verification.** Suite green incl. the dedup-interleaving
  tests; two-relay drill with *different* operators (official-
  shape entry + step-3 container): conversation starts, primary
  relay is killed mid-conversation, delivery continues via the
  second with no duplicates rendered; primary's volume is then
  destroyed (permanent death) and new sessions still initiate
  via the surviving relay's bundle copy.
- **Done when.** Both drills pass. With this step the
  recommendation's stage 2 is complete: placement is a user
  choice, and no single relay's death strands a contact who
  had two homes.

## Out of scope (stage 3 and other follow-ups own these)

- **PQXDH / SPQR / MLS** — stage 3 of the recommendation; the
  only interaction is capacity (larger key bundles in the same
  directory records), noted there, not here.
- **Delivery tokens** (stage-1 step 3's client-led remainder) —
  orthogonal: they govern *unauthenticated deposit* on one
  relay; they compose with fan-out per relay but neither needs
  the other.
- **Public/anonymous self-host operation** — step 3 makes
  closed the default and opening an explicit operator choice;
  abuse economics of open relays get no new machinery here.
- **Multi-process / clustered Node**, and any hosted multi-tenant
  variant — single-process is the supported topology (step 2).
- **libp2p, WebTransport, hashed-contact discovery** — already
  rejected in the recommendation; not reopened.
- **Relay-to-relay anything** — excluded by D2, permanently for
  this design.

## Open questions (unverified at plan time)

- Exact Node LTS baseline and `node:sqlite` maturity (step 1
  pins both by experiment), including Fetch-global parity with
  the worker code paths that use `Response.json`.
- The WebSocket server mechanism for the Node entry under the
  zero-dependency preference (step 2 records the choice).
- Desktop (Tauri) origin handling for the step-5 resolver.
- Exact-duplicate ciphertext behaviour in the ratchet
  (step 6's tests decide).
- Umbrel / one-click appliance packaging specifics — a
  stretch goal of step 3's compose example, not a completion
  criterion.

## Invariants for every step

- The crypto protocols (X3DH, Double Ratchet, group sender keys)
  are untouched by all steps above; placement is a transport
  property, never a cryptographic one.
- Full vitest suite + `./validate.sh` PASSED before merge, on
  every backend/host a step touches; behaviour changes are
  called out in CHANGELOG.md per step, as with stages 0–1.
- Anything that needs a client change keeps the server backward
  compatible behind a flag or an additive field until the client
  fleet has shipped (the established rollout doctrine).
- A relay — official or self-hosted — never becomes a trusted
  party by being chosen: E2E encryption, sealed sender and the
  metadata limits in SECURITY.md hold identically on every
  placement this plan creates.
