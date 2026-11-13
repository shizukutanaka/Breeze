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
- **Outcome (2026-11-13).** Shipped as designed; three
  letter-of-the-plan points were resolved against the code and are
  recorded here rather than silently adopted, and the open driver
  question is answered by experiment:
  1. *The mailbox core is an exported class in `_worker.js`, not a
     separate file.* The deployed worker is a single self-contained
     module with zero imports (Pages advanced mode), and a new
     imported file would change the deployed artefact's shape in
     the one step whose guarantee is that the deployment stays
     untouched. `MailboxCore` therefore sits next to `MailboxDO` as
     a named export — the step-2 host will import it from there,
     exactly as the test suite already imports the handlers.
     `MailboxDO` is now the thin adapter D1 describes: it
     contributes `state.storage`, the hibernation registry (as the
     core's queue-changed callback) and the two KV drain migrations
     (as seed hooks). Its storage layout and RPC answers are
     unchanged, and the full stage-1 suite passes unmodified
     against it.
  2. *"Serialized per userId" is one core per recipient, serialized
     per instance.* The host keeps the per-user registry (as the
     DO namespace does today) and each core's `execute()` chains
     its own ops; the raw storage keys stay the DO's per-instance
     layout, and per-user namespacing becomes the storage
     adapter's job (`server/sqlite-mailbox-storage.js`, key
     prefix). The deposit-gate race test — 130 parallel deposits
     admitting exactly 120 — runs against BOTH the SQLite core and
     the refactored DO adapter.
  3. *Contract fixtures are shared scenario suites, not the
     existing test files re-run.* The stage-1 files are written
     against surfaces hardwired to their fixtures, so the contract
     is re-expressed as suites instantiated once per fixture
     family with identical expectations
     (`tests/sqlite-kv-contract.test.js`,
     `tests/mailbox-core-contract.test.js`) — the verdict-diff in
     executable form. One fixture asymmetry is documented in the
     suite: mockKV's `list()` ignores cursors (always
     `list_complete`), so pagination below the page size is pinned
     against the shim alone.
  - *Driver decision: `node:sqlite`, zero-dependency; baseline
    pinned at Node ≥ 24.* Verified by experiment on Node v24.22.1:
    `node:sqlite` imports unflagged with no warning and
    `DatabaseSync` covers the shim's needs. `Response.json` exists
    there too, but the parity question never reaches the op
    protocol: `execute()` returns `{ status, body }` and only the
    DO adapter touches `Response`. (Node 22.x ships the module
    behind `--experimental-sqlite`; nothing older has it.) One
    harness caveat: vitest 2 / vite 5 cannot resolve a static
    `node:sqlite` import — its builtin list predates the module —
    so test fixtures load the driver via `createRequire`; the
    library modules never import it (hosts pass an open
    `DatabaseSync` in), and plain `node` resolves it fine.
  - *SQLite storage values are JSON.* DO storage structured-
    clones, but the protocol's own values are JSON-shaped by
    construction (`{ v, exp }` entries, the deposits array), so
    the adapter's JSON round-trip is lossless for everything the
    core stores.
  - No production path references SQLite: Cloudflare bindings,
    `wrangler.toml` and the client are untouched, and nothing
    outside the contract tests imports `server/*.js` yet.

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
- **Outcome (2026-11-13).** Shipped as designed; the open WebSocket
  question is answered, and three letter-of-the-plan points were
  resolved against the code and are recorded here:
  1. *WebSocket mechanism: a minimal hand-rolled RFC 6455 server*
     (`server/ws-server.js`), zero-dependency. Node ships a
     WebSocket client but no server, and the relay's socket carries
     one tiny text protocol, so the server half is just the opening
     handshake plus a frame codec: masked client frames enforced
     (unmasked → 1002), fragmented messages reassembled under a
     1 MiB cap (→ 1009), protocol ping → pong alongside the
     application-level 'ping'/'pong' the mailbox protocol already
     had, close echoed and ended. No extensions, no subprotocols —
     the worker's route negotiates none.
  2. *No `_worker.js` change at all* — stronger than this step's
     "export tidying only" allowance. The existing `export default`
     fetch object is directly callable by a host, so
     `server/node-host.js` imports it and calls it exactly as the
     test suite does; the deployed artefact is byte-for-byte
     untouched. The Cloudflare-only surface is composed around it:
     `env.KV` is the step-1 SQLite shim, `env.MAILBOX_DO` is an
     in-process namespace (`server/mailbox-namespace.js`) running
     one MailboxCore per recipient over the step-1 storage plane,
     and `env.ASSETS` is a static layer (`server/static-assets.js`)
     — the worker's own non-`/api/` branch does the routing, so
     the `_routes.json` split is the production code path, not a
     reimplementation.
  3. *The WebSocket attach crosses the host boundary via a marker
     response.* A Fetch `Response` in Node cannot carry a 101
     status or hand back a socket, so when the worker's signed
     handshake (`handleMailboxWs`, run verbatim — per-IP limit and
     mandatory Ed25519 proof included) reaches the namespace stub
     with an upgrade, the stub answers `200` +
     `X-Breeze-Ws-Attach: <userId>`; the host's `upgrade` handler
     completes the RFC 6455 handshake on the raw socket and
     registers it in the namespace's per-user socket set, which is
     where the core's queue-changed callback fans out — the
     in-process registry this step's scope names, with the DO's
     exact frame and ping/pong semantics. Gate/auth failures come
     back as the worker's own HTTP response on the raw socket; no
     socket is registered. The marker header is stripped from any
     ordinary (non-upgrade) response.
  - *Client IP:* the host owns `CF-Connecting-IP` — it is
    overwritten on every adapted request with the socket's remote
    address (IPv4-mapped forms normalized). `X-Forwarded-For` is
    honoured (first hop) only with `TRUST_PROXY` set, i.e. when
    the operator declares the proxy that sets it.
  - *Environment composition:* process-environment strings pass
    through under the same names the worker reads on Cloudflare;
    the host defaults `MAILBOX_BACKEND=do`, `PRESENCE_BACKEND=do`
    and `MAILBOX_WS_ENABLED=true` (a self-host's mailboxes are
    meant to run on the core), each still an ordinary flag the
    operator can override. Cloudflare's defaults are untouched.
  - *Static layer:* `_headers` is parsed once (file order; a later
    matching block wins per header — `/sw.js` ends up `no-cache`,
    not the `/*.js` immutable rule) and matched per request path.
    Never served: the Pages platform files, dotfiles/dot-dirs,
    `node_modules/`, and database files (`*.db`, `*.sqlite*`,
    WAL/SHM sidecars) plus the configured database path explicitly
    — the relay's state must never become a download. Missing
    paths answer the repo's `404.html`. `_headers` is applied by
    the static layer only; API responses keep the worker's own
    header set (its cache control is the stricter superset).
  - *Operator surface:* `server/README.md` documents running the
    entry, its configuration and the single-process topology
    (the `docs/SELF_HOSTING.md` rewrite stays step 3's, as
    planned). `validate.sh` learned one Gate-1 check: syntax of
    the `server/*.js` files.
  - *Verification:* the drill is pinned in the suite
    (`tests/node-host.test.js`, 6 tests): health with `ws:true`,
    prekey upload/fetch for two identities, sealed
    deposit → wake-up frame → poll → ack → empty poll, an attach
    signed by the wrong key refused with zero sockets registered,
    a process-level restart on the same database file proving
    queue and bundle durability, and the static contract (`/` and
    `/index.html` carry the `_headers` security set with
    `no-cache`; platform/dot/database files 404). The same drill
    was also run manually against `node server/index.js` itself,
    including a SIGTERM restart.


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
- **Outcome (2026-11-13).** Shipped; the open admission-shape
  question is decided, and the packaging was verified with one
  recorded substitution (no Docker on the verification machine):
  1. *Admission shape: the explicit userId allowlist.* Of the two
     shapes the scope allowed, the allowlist
     (`REGISTRATION_ALLOWLIST`, comma/whitespace-separated Breeze
     IDs) is the one that works with the client as it ships today:
     an invite token would need a presentation channel the client
     does not have (adding one is a client change, outside this
     step's packaging scope), and it would mint a new secret for
     operators to distribute and users to leak. A userId is a
     public identifier contacts already exchange — the operator
     collects IDs out-of-band over the same channel an invite link
     already travels, and the unmodified client registers as soon
     as its ID is listed.
  2. *The mechanism is an env-gated check in `handlePreKeyUpload`;
     the closed default lives in the packaging, not the worker.*
     Account creation happens at exactly one place — a prekey
     upload for a userId with no stored bundle — so the gate sits
     there: listed IDs and every existing account pass untouched;
     an unlisted unknown ID gets `403 REGISTRATION_CLOSED` and
     stores nothing. With the variable unset the handler is
     behaviour-identical to before (the official relay and a bare
     `node server/index.js` both stay open, as this step's
     guarantee requires). The compose file always passes the
     variable (operator's `BREEZE_ALLOWLIST`, empty by default), so
     the packaged relay is closed by default; `REGISTRATION_OPEN=1`
     on the Node host is the explicit opt-in back to open and wins
     over a packaging-supplied allowlist. One corner, recorded:
     bundles expire (TTL one month), so a homed user whose bundle
     has lapsed counts as a *new* registration and must be listed
     to re-register — operators should list their community, which
     is what the list is; deposits, rendezvous and polls are never
     gated either way.
  3. *The relay identity lives inside the SQLite file* (a
     dedicated `relay_meta` table), not as a sibling key file in
     the volume. The volume stays literally one file — backup is
     copying it — and the table is unreachable through `env.KV`
     (pinned by test), so no worker surface can read, list or
     overwrite the private key; the static layer already refuses
     to serve the database file itself. The fingerprint (SHA-256
     of the raw public key, first 8 bytes, grouped hex) prints on
     **every** boot, not just the first — an operator needs it
     whenever a user asks — with a `NEW key generated` marker on
     the provisioning boot. Generation and storage are all this
     step does with the key: no health field, no env entry, no
     route (that is step 4, as scoped).
  4. *Docker verification substituted, and recorded as such.*
     The verification VM has no Docker binary, so the fresh-
     container drill was replaced by: static checks (the compose
     file parses; the `node:24-alpine` base tag exists; the
     image's user/volume/healthcheck contract reviewed; the
     `.dockerignore` excludes no runtime path), plus the plan's
     whole drill run against the real entrypoint under the
     packaging's own environment — first boot provisions the key
     and announces CLOSED registration, two listed users register,
     an uninvited third is refused, a sealed message is deposited
     and polled, a restart on the same volume keeps the
     fingerprint and the un-acked delivery state, and a restored
     copy of the volume serves identically with the same
     fingerprint (14/14). The literal `docker build` + fresh-
     container run on a clean machine remains the one unverified
     item; the image runs the identical entrypoint and environment
     the drill exercised.

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

**Outcome (2026-11-13).** Landed as planned, with six readings
recorded where the plan met the code:

- **Server.** `_worker.js` health gains the additive `relayKey`
  field (the public half, only when BOTH env halves are set — a
  half-configured relay advertises nothing, because a key it
  cannot attest with must never be published) and the
  `'relay-attest'` capability; `POST /api/relay/attest` is new
  (endpoint count 38 → 39, limits map 20/min). The signed string
  is exactly the planned `breeze-relay-attest:{relayKey}:{nonce}`;
  the nonce accepts 8–128 chars of `[A-Za-z0-9_-]` only (400
  `INVALID_NONCE` — the charset doubles as the signed fields'
  separator discipline); no identity → 501
  `RELAY_IDENTITY_NOT_CONFIGURED`. On the Node host,
  `buildRelayEnv` loads the step-3 volume key from the database
  and exposes it as the env pair (the database wins over
  same-named process env — one source of truth), so a self-host
  attests with the key its boot log fingerprints. The Cloudflare
  key-generation procedure (a node one-liner emitting exactly
  relay-identity.js's formats) is documented in `.env.example`
  and `wrangler.toml`, and its output was verified end-to-end.
- **Reading 1 — fingerprint format.** The plan's "same style as
  the existing safety-number display" is loose; step 4 uses the
  format step 3 already shipped (SHA-256, first 8 bytes,
  uppercase grouped hex). The out-of-band comparison only works
  if the operator's boot log and the client display are
  byte-identical strings; a test pins the two derivations equal.
- **Reading 2 — what latches the hard stop.** Positive evidence
  of substitution only: (a) the advertised key differs from the
  pin, or (b) an attestation signature is present and fails
  against the pin. An *unreachable* attestation (network
  failure, 404/429/5xx — no signature at all) is no evidence:
  nothing blocks and nothing pins, so an attacker who can only
  drop packets gains nothing and a flaky network locks nobody
  out. A first contact whose attestation fails verification
  pins nothing and blocks nothing (the serving origin keeps its
  implicit trust; the strict refusal is scoped to *added*
  relays, which is step 5).
- **Reading 3 — pin target and storage.** The pin lives in
  `_settings.relayPin` (per account, settings IDB store), as
  planned. Scope is the one currently-connected relay (per the
  step's brief). The plan marked TOFU-pinning the serving
  origin "allowed but not required": step 4 **does** pin it —
  first contact pins after a verified attestation, every later
  session re-verifies, and a mismatch hard-stops. The gate sits
  at `postAPIRaw` and also covers the direct `_signal` /
  `_signalAwait` calls and the wake-up socket
  (`mailboxWsWanted`), so "refuse API calls to that relay" is
  not funnel-only. `/security` gains a pin-state/fingerprint
  line; 4 i18n keys were added in EN and JA.
- **Reading 4 — the boot window.** The pin check runs inside
  `_startLiveSession` right after `loadSettings()` (the first
  point the account's settings exist). `_boot()` starts
  presence and polling before the session, so a few calls in
  the first moments of the first session after an account
  switch can precede the verdict. Recorded as a known window —
  exposure comparable to the implicit trust a keyless relay
  always had — and left for a later step rather than
  restructuring the boot order here.
- **Reading 5 — CSP re-pin procedure.** The brief named
  `scripts/fix-csp-hashes.mjs` + `npm run check-csp`; neither
  exists in this repo. The repo's real procedure —
  `node tools/csp-hash.mjs --write` (rewrites `_headers` and
  `tauri.conf.json`) with `--check` as the validate.sh gate —
  was used.
- **Reading 6 — SECURITY.md placement and the mirror.** There
  is no literal metadata table in SECURITY.md; the D3
  statement extends the Metadata bullet under "Other known
  limitations", its nearest equivalent. The client change is
  new logic, not a copy of any `src/crypto/*` module, so no
  mirror pair exists to update. The pin check reads health
  via `fetchT` directly, following the boot health check's
  existing precedent (health is a GET; the client has no GET
  funnel), despite AGENTS.md's general postAPIRaw rule.
- **Re-trust.** There is deliberately no in-app re-trust
  button in this step (step 5's relay management owns it). A
  genuine rotation (volume loss) is a breaking event,
  documented in SELF_HOSTING.md: announce the new fingerprint
  out-of-band; users clear the account's stored data and
  re-pin on first contact.
- **Verification.** vitest 1243 → **1260 passed / 64 files**
  (new `tests/relay-attest.test.js`, 17 tests: health
  advertisement conditions; attestation valid / wrong key /
  replayed nonce / foreign domain string; 501 and the nonce
  rejection matrix; the 20/min limit; host wiring and a real-
  HTTP round trip; the client pin extracted from index.html
  and run against the real worker — TOFU store, quiet match,
  key-change block with the funnel refusing offline,
  advertised-but-unheld key, legacy keyless relay, dead
  attestation channel). `./validate.sh` **PASSED (165/171 —
  identical to baseline)**; CSP `--check` OK. The entrypoint
  drill was re-run for this step (`node server/index.js`):
  boot-log fingerprint == the fingerprint derived from
  health's `relayKey` == the client's display derivation;
  the attestation verified over curl; a restart on the same
  database served the identical key. **Recorded gaps:** no
  browser E2E exists in this environment (extraction tests
  against the real worker stand in for it), and the Docker
  image was not rebuilt — this step changes no packaging;
  the host wiring is covered in-process and by the drill.
  The plan's "rotate the volume key" drill is covered at the
  client level by the key-change test (a different advertised
  key is exactly what a rotated volume presents).

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

**Outcome (2026-11-14).** Landed, with eight readings recorded
where the plan met the code:

- **What shipped.** `index.html` only (plus CSP re-pins, locales
  and tests; no worker, endpoint or CONFIG change): a "Home
  relays" block next to step 4's pin code — `homeRelays()` (the
  resolver's source list), `relayApiBase()` (relay → API base),
  `postAPIRelay()` (the funnel, addressed per relay),
  `ensureRelayVerified()` (per-relay pin verdicts),
  `attestNewRelay()` / `addHomeRelay()` / `removeHomeRelay()`,
  and the `/settings` Relays section with the add-flow (paste
  URL → attestation → fingerprint → confirm). Fan-out covers
  the plan's list in full: poll + sealed ACK, presence beat,
  prekey status/upload (initial registration included), backup
  upload/download, push subscribe/unsubscribe, one mailbox
  wake-up socket per relay, and per-relay health.
- **Reading 1 — the stored list vs the effective list.** The
  plan's "`_settings.relays`: an ordered list … default exactly
  one entry — the serving origin" is realised as: storage holds
  only the ADDED relays (`relays: []` by default, entries
  `{ url, pin, label }` as planned), and `homeRelays()` resolves
  the effective list with the serving origin always first — an
  untouched install resolves to exactly one entry, as required.
  The origin's pin is NOT migrated into a list entry: it stays
  in step 4's `_settings.relayPin` (step-4 storage, tests and
  `/security` untouched); a stored entry naming the origin
  merges into the first slot (label; pin only if `relayPin` is
  unset). Storing the origin in the list would have made the
  default a migration instead of a constant.
- **Reading 2 — the resolver returns the legacy const for the
  origin, which also closes the plan's Unverified item.**
  `relayApiBase(origin)` returns the existing `API` value
  untouched — never `location.origin + '/api'` — so the
  localhost derivation (API is `''` on localhost) and every
  other shell keep byte-identical behaviour. The desktop check
  the plan required before merge: Tauri serves the app from
  `tauri://localhost` (Windows `http://tauri.localhost`) with
  `frontendDist ../../`, Electron loads a remote `BREEZE_URL`
  or the file — in both shells the origin entry IS today's
  derivation by construction, and both shells' CSP
  (`connect-src https: wss:`) admits added relays, which are
  addressed `<origin>/api` (the only prefix the worker
  routes).
- **Reading 3 — pins per relay, and step 4's boot window.**
  Verdict rules are step 4's, scoped per relay: a differing
  advertised key, a failing attestation, or a pinned key no
  longer presented at all latch THAT relay off for the session
  (`_relayBlockedUrls`; warning toast + announcement + audit,
  its socket closed, pin never rewritten); an unreachable relay
  latches nothing and is re-checked on the next call. Added
  relays are verified LAZILY, inside the resolver, before their
  first call of the session — which closes step 4's recorded
  boot window for them by construction: an added relay exists
  only via `_settings` (loaded inside the session), and its
  first call awaits the verdict. The origin's window is
  unchanged and still recorded: the primary path is the legacy
  path byte for byte, and reordering `_boot()` remains out of
  scope.
- **Reading 4 — a keyless relay cannot be added.** The
  add-flow's attestation classifies `keyless` as a refusal, not
  a pin-less entry: step 4's asymmetry (implicit trust is the
  serving origin's legacy role only) becomes a product rule —
  a relay that cannot be pinned cannot be a home relay.
- **Reading 5 — push fan-out is bounded by the VAPID binding.**
  The plan says "subscribes per home relay (each relay's
  health publishes its own VAPID key)"; the code fact is that
  a browser push subscription is bound to exactly ONE
  `applicationServerKey`, so a subscription created against
  the primary's key can only be REGISTERED with added relays
  whose health publishes that same key — a different-key relay
  could never wake this browser with it (the push service
  rejects a mismatched sender), and for those relays the
  mailbox socket/poll remains the wake-up path, push being
  only a hint as the plan itself notes. When the bound key
  cannot be read back (`sub.options.applicationServerKey`
  unsupported), registration is primary-only — the pre-step-5
  behaviour. Unsubscribe fans out to all home relays (the
  account-switch call site snapshots the list first, before
  `_settings` becomes the next account's).
- **Reading 6 — a bundle rotation lands on ALL home relays,
  and a straggler is healed with the SAME bundle.** The
  worker's upload REPLACES the stored bundle, and
  `generatePreKeyBundle()` replaces the local private halves —
  so the plan's "retries across relays" has a hard form: a
  rotation triggered by any one relay (404/expiry, OTP drain,
  SPK age) must be uploaded to every home relay, or the others
  keep serving prekeys whose private halves this device just
  discarded. A relay whose upload fails is recorded in
  `_pendingBundle` and retried with that exact bundle on the
  next replenish cycle, before any new rotation. Recorded
  bound: the pending state is in-memory — if the app closes
  first, the straggler keeps the older bundle until the next
  natural rotation trigger (its own OTP drain / SPK age /
  expiry), never a wrong-key state, just a staleness window.
- **Reading 7 — per-relay cursors and sockets.** The plain
  poll cursor is per relay (`_pollCursorByUrl`): a relay's
  queue ts is its own clock (the step-2 fact the plan's
  design rests on), so a single shared cursor would silently
  skip messages on the other relay. The single mailbox socket
  became one per relay (`_mailWsByRelay`); `schedulePoll`'s
  cadence reads "any socket open", and an added relay's socket
  gates on ITS OWN health's `features.ws` (captured during its
  pin verification) plus its pin verdict — a relay without WS
  is simply polled, as planned.
- **Reading 8 — what stayed primary-only.** The funnel gained
  the resolver (`postAPIRelay` delegates to `postAPIRaw` for
  the origin, inheriting the step-4 gate), but the calls the
  plan leaves to step 6 stayed put, and the code showed more
  of them than the plan named: `_signal` / `_signalAwait`
  (contact rendezvous), sealed/plain send, prekey fetch
  (+batch), a PEER's prekey status, contacts' presence check,
  `/alias/*`, `/group/*`, `/turn`, `/drop/*`, `/device/*`,
  `/account/delete`, and the remote-wipe poll (whose sender
  side is likewise primary-only, so the pair stays coherent).
  Removals are local-only: removing a relay deletes nothing on
  it — it keeps what it holds and stops receiving copies (the
  remove confirmation says so).
- **Verification.** vitest 1260 → **1277 passed / 65 files**
  (new `tests/relay-multirelay.test.js`, 17 tests: default
  resolution + byte-identical legacy calls; stored-origin
  merge; the add-flow verdict matrix and its confirm gate;
  removal bookkeeping; pin independence — B's key change and
  B going keyless latch B only, an unreachable B latches
  nothing and recovers, a wrong origin pin cannot break B;
  poll merging two real workers' queues with per-relay ACKs
  draining both; a 500-ing relay starving nobody and latching
  nothing; one rotation landing one bundle on both relays and
  a failed upload healed with the same bundle; presence and
  push-unsubscribe fan-out; the per-relay WS gate). The plan's
  done-when drill is an automated test in the same file: two
  real Node hosts (`createRelayServer`), one account homed on
  both, deposits on both received, the PRIMARY stopped
  mid-session, and delivery continuing via the second relay.
  `./validate.sh` **PASSED (165/171 — identical to baseline)**;
  CSP re-pinned via `node tools/csp-hash.mjs --write`,
  `--check` OK. i18n: 15 keys, EN + JA at 100%, and the six
  partial locales (es, id, ko, pt-BR, th, zh-TW) translated
  too, holding their 95% core-coverage floor. **Recorded
  gap:** no browser E2E exists in this environment — the
  extracted client against real workers, plus the live
  two-host drill, stand in for it (step 4's precedent).

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
