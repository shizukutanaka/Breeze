# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Breeze, please report it responsibly.

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please use [GitHub Security Advisories](https://github.com/shizukutanaka/Breeze/security/advisories/new) to report privately.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

### Response Timeline

- **Acknowledgment:** Within 48 hours
- **Assessment:** Within 7 days
- **Fix:** Within 30 days for critical issues

## Threat Model & Limitations

### Message requests and stranger quarantine

Unknown direct senders are gated before message decryption, session creation, file/media handling, link rendering, receipts and call ringing. Their ciphertext envelopes live in `settings:requests:v1`, not the message/contact stores. The Requests view survives reloads. Names and ID prefixes are unverified labels, not authentication. Accept atomically creates the contact and then replays the queue through the normal receive checks; interrupted replay resumes on reload with ordinary message deduplication. Explicit contact addition and confirmed offline pairing also authorize queued traffic. Joined-group members and authenticated linked-device fan-out retain their existing authorization checks; a stranger cannot bypass quarantine merely by setting a group or self-sync flag.

Limits per account: 20 senders, 20 envelopes per sender, 100 total envelopes, 2 MiB of serialized envelopes total, 128 KiB per envelope, and seven days from a request's first arrival (`MS.DAY`). Excess input is dropped, not decrypted. Expiry is enforced on subsequent access, including boot, not while the app is closed. Delete forgets the queue but permits a later request. Block persists the full identity key, forgets its queue and silently drops future application messages. Up to 1,000 blocks are retained; at capacity a new block fails visibly rather than evicting an old block. Unblock is explicit. Quarantine is ciphertext, but sender keys/names/timestamps and blocks are local plaintext metadata; this is not the separate key-vault feature. Clearing browser data or restoring an older account backup can erase this local policy. Web Locks are required for serialized acceptance/replay across tabs; unsupported replay fails closed.

Unaccepted contacts have no conversation, so typing, read and application-delivery receipts are not emitted. Relay mailbox consumption/ACKs, prekey publication and sealed-envelope opening remain necessary transport operations; sender metadata inside a sealed envelope is opened to decide admission, but its message payload is not decrypted. A relay can still observe recipient availability, polling and timing. An additive, signed `privatePresence` flag keeps public single/batch presence queries offline while retaining account-clone detection and alias renewal. Legacy clients/relays may still publish presence; a new client's signed private heartbeat is rejected by an old relay rather than downgraded to public. Existing public presence may remain visible until that relay's freshness window expires. No new endpoint is introduced.

Foreground request notifications are generic. Background pushes have no trustworthy sender classification (especially sealed pushes), so **all** push notifications use generic EN/JA text, no relay-supplied title/body/link and no quick-reply/read actions. This intentionally also limits notifications for accepted contacts; a blocked sealed push may still produce a generic wake notification, but its application message is dropped. Retained notification actions from older installations are ignored unless they resolve to an existing, unblocked contact. Browser permission prompts, relay metadata and OS-level notification timing are not hidden. Pushes and request floods can still consume bounded resources; this is consent gating, not proof-of-personhood or global spam prevention.

Being honest about what Breeze's end-to-end encryption does and does not defend against:

### Web-delivery code integrity (the structural limit of any browser-delivered E2EE app)

The strongest defense Breeze offers has an inherent ceiling: **the encryption runs in code the
server delivers on every page load.** A server compromise (or a compelled operator) could serve a
one-time, targeted `index.html` that exfiltrates keys or plaintext — and, unlike a native app,
there is no OS-level signature check to catch it. This is a property of *all* web-delivered secure
messengers, not a Breeze-specific bug; it is why in-browser E2EE is best described as protecting
against *passive* relay/network adversaries and honest-but-curious infrastructure, not a
fully-compromised or hostile server.

Mitigations, in order of assurance:
- **Native builds** (Tauri / Electron / Capacitor) ship the reviewed artifact as a
  signed, self-contained binary — no per-load code delivery. For a threat model that
  includes a hostile server, prefer the native app over the web PWA.
- **Reproducible artifact**: `build.sh` produces `breeze.zip`; publishing and pinning its
  SHA-256 lets a motivated user diff the served page against a known-reviewed build.
- **Zero external scripts.** The app loads no third-party or separate script file at all, so
  there is no supply-chain surface to pin with SRI. This replaced an SRI-pinned `lang.js`
  (the 924-language table, deleted — see "Removed: the 924-language table" below);
  `validate.sh` now gates on the absence of any external `<script src>` rather than on a hash.
- **Hash-pinned `script-src`** (no `'unsafe-inline'`): the browser executes only the inline
  bundle whose SHA-256 was published in `_headers`. An injected `<script>` or `onerror=`
  payload is refused, so an HTML-injection bug can no longer reach the identity private key in
  IndexedDB. `tools/csp-hash.mjs --check` runs in `validate.sh`, so a stale hash blocks the
  deploy rather than the app; `tests/e2e/csp.spec.js` boots the app under the real policy and
  proves a corrupted hash is fatal. Note this raises the bar for *injection*, not for a
  *compromised server*, which can simply publish a new hash — see the ceiling above.
- **Roadmap**: web-app code transparency (e.g. WEBCAT-style enrollment / signed,
  append-only web-app manifests) to give the PWA a verifiable-code guarantee closer to
  the native builds. Tracked, not yet deployed.

### Removed: server-side link previews (v3.6.1)

Rendering a message containing a URL used to POST that URL to the relay for an Open Graph
preview — **including messages you received**. So the relay learned link contents out of
end-to-end encrypted messages, for a recipient who never chose to share them, and the
sender-side variant reported every link before it was even sent. It was also the only
server-side fetch of user-supplied URLs in the product, i.e. the entire SSRF surface
(`isSSRFBlocked`/`ssrfSafeFetch` existed solely to contain it). Deleted; links still render
as clickable links, without a preview card.

### Removed: server-side AI and translation (v3.6.1)

Breeze previously proxied message text to third-party LLM and translation providers
(Anthropic/OpenAI/Groq, DeepL/Google/LibreTranslate/MyMemory) for translation, summaries, smart
replies and an `/ai` command. Those features decrypted a message and sent the **plaintext off the
device**, which is flatly incompatible with the zero-knowledge property the rest of this document
describes — a user could not tell, from the security model, that tapping "translate" published
their message to a third party. The endpoints and all client wiring have been deleted rather than
gated: an opt-in toggle still leaves the contradiction one tap away, and a relay that *can* read
plaintext is a different threat model from one that cannot.

`/summarize` and smart replies survive, computed **locally** on-device with no network egress.

### Removed: the 924-language table (`lang.js`)

`lang.js` shipped 924 languages × 25 core UI strings (569 KB — 44% of the app's total
payload) and was fetched by every user on every cold load. Measured, it supplied **zero**
strings to the UI: `t()` resolves `full locale → English → lang.js`, and the inline English
table is the complete reference (every key the app uses is guaranteed present by
`tools/i18n-check.mjs`), so English short-circuited it every time. 18 of its 25 keys were
shadowed that way; the other 7 are never passed to `t()` anywhere in the app.

An earlier fix had repaired the *detection* half of this (`detectLang()` re-runs when the
async file lands, so `LANG` really did become e.g. `sw`) and stopped there — the strings
still never rendered, which is the outcome that fix existed to deliver. Verified in a real
browser before and after: a Swahili-locale client showed an English UI either way.

Deleted rather than repaired, because repairing it could only ever reach ~25 of 667 strings
(3.7%) — a 96%-English UI with 25 foreign words reads as broken, not translated. The seven
locales with complete translation files (`ja`, `ko`, `zh-TW`, `es`, `th`, `id`, `pt-BR`)
are unaffected and still fully work. RTL for Arabic/Hebrew/Persian/Urdu also still works:
it never needed the table, only `navigator.language`, and now reads that directly.

### Removed: multi-account billing

README, `.env.example`, and the in-app Terms of Service/Privacy Policy described a working
Free/Lite/Plus/Pro multi-account subscription system (Stripe Checkout, webhook fulfillment,
Customer Portal). It's gone from the code — `index.html` still carries comments confirming it
once existed ("the billing system is gone but the TURN fetch must remain") — but the removal was
never documented the way the AI/translation and link-preview removals were, so the docs and
in-app legal text kept describing it as live. Today there is no checkout, webhook, or portal
route anywhere in `_worker.js`, and no call to `api.stripe.com` anywhere in the repo. The
`slots:{userId}` KV record that once scaffolded plans was removed from the Worker entirely
(D29) — no route reads, writes, or deletes it — and the client never checked it: every
account, self-hosted or hosted, can add unlimited local accounts today with no plan
enforcement. Documentation and in-app legal text have been corrected
to stop advertising this as available rather than rebuilding it retroactively; that remains
separate, explicitly-scoped future work if it's wanted.

### Other known limitations

- **Relay state has TTLs, and TTLs are a liveness property.** Device registries and group
  records are refreshed on read (once per day per record) so state that is actively *used*
  cannot expire underneath its users; prekey records self-heal — the client detects a 404 from
  `/prekey/status` and re-registers, so a long-quiet identity becomes reachable again instead
  of staying permanently unreachable to new contacts. Cloud backups are the deliberate
  exception (see below): they expire on schedule and now say so.
- **Account deletion erases beyond the userId-keyed stores (stage-0, 2026-11-13).**
  `/api/account/delete` additionally (a) sweeps every group roster for the deleted id —
  including groups the deleting device never declared — removing the member (epoch bump)
  or deleting creator-owned groups; (b) removes the account's *sent* copies from other
  users' plain-path inboxes (plain entries carry `from` in the clear); and (c) deletes
  `frank:{id}`/`report:{id}` records for the frankIds the client supplies (senders persist
  each sent message's frankId locally for this). Two honest limits: sealed-queue copies
  cannot be swept — sealed sender means the relay cannot tell who sent an envelope, so
  undelivered sealed copies expire with the 7-day queue TTL instead — and a moderation
  webhook that already fired for a report lives outside KV and is not recalled.
- **The sealed queue is a bounded value whose append semantics depend on the mailbox
  backend (D16, two stages).** The append is one composite store operation; what it
  guarantees is stated per tier, because the two backends genuinely differ:
  - **Durable Object backend (`MAILBOX_BACKEND=do`): exactly-once.** The append runs as a
    single operation inside the recipient's per-mailbox serialized core — the dedup check,
    the strictly-increasing timestamp assignment, the caps and the overflow accounting are
    one atomic step, so no second writer can interleave and erase an envelope, and a
    retransmitted envelope is deduplicated from the stored queue itself, across isolates.
    The same serialization makes the poll's recovery-count claim atomic: exactly one poll
    surfaces a given count.
  - **KV backend (default): best-effort with verified recovery, not exactly-once.**
    Cloudflare KV offers no transactions, so the queue's read-modify-write can lose an
    envelope if two senders write to the same recipient in the same instant from different
    PoPs — and both senders would be answered 200, making the loss silent. The append
    therefore **reads the key back and re-appends its own envelope if it is missing**,
    which recovers the common case for one extra read on the cold send path. Since D16
    stage 1 the repair is itself verified: the append re-reads after every re-append and
    retries (bounded), and a send whose envelope still cannot be confirmed fails honestly
    (`STORE_UNCONFIRMED`) so the sender's outbox retries, instead of a 200 for a delivery
    that never landed. Every repair is also counted per mailbox and confessed to the
    recipient's next poll (`recovered: n`, shown in `/security`) — the track record from
    which a per-envelope key split will be decided for mailboxes where loss is actually
    observed. Deliberately not the textbook fix on this tier: a key per envelope removes
    the race outright but replaces one `get` per poll with a `list` plus a `get` per
    message on the hottest path, in a relay that already throttles presence writes to
    survive the free tier.
  On both tiers, content-keyed dedup, the client retry queue and the overflow confession
  (`dropped: n`) still back the path, and P2P delivery plus re-send remain the ultimate
  recovery paths.
- **Metadata**: Sealed Sender **v2** hides the sender from the relay *cryptographically*:
  all sender-identifying fields (id, public key, display name, signature keys, the reply
  preview, multi-device markers — and the X3DH bootstrap header's initiator identity key,
  which used to expose the sender on first contact) are encrypted to the recipient's
  identity key (ephemeral ECDH → HKDF `breeze-seal-v2` → AES-256-GCM; AAD binds
  recipient+timestamp against splicing). The relay stores only {recipient, timestamp,
  ratchet ciphertext, sealed blob}. **Honesty note**: pre-v2 envelopes carried the sender in
  cleartext inside the stored JSON — "the Worker doesn't parse it" was an implementation
  choice, not a guarantee; treat pre-v2 traffic as sender-visible to the relay. v2 is
  capability-negotiated (`seal-v2` in the prekey-bundle caps, read via `/prekey/status`
  which consumes no one-time prekey): messages to un-upgraded peers, the `/msg` fallback
  path, and the offline retry queue still use legacy envelopes and remain sender-visible.
  The relay still sees recipient, timing, and message size (padded to size buckets —
  256 / 1024 / 4096 B, then multiples of 4096, since D02 — so only the bucket leaks).
  Cover traffic was considered and rejected in D02 (constant dummy traffic would burn the
  default relay's free quota and put relay costs on the creator); onion routing is
  deferred (see SPEC §12).
- **Relay identity (stage-2 step 4)**: the relay holds a persistent Ed25519 key
  (`relayKey` in `/api/health`). On first contact a client verifies the key by
  challenge — the relay must sign `breeze-relay-attest:{relayKey}:{nonce}` for
  a client-chosen nonce (`POST /api/relay/attest`) — and pins the verified key
  per account. Later contacts re-verify; a changed key or a signature that
  fails against the pinned key stops all relay calls for that account (API,
  signaling, and the wake-up socket) until the user re-trusts it out-of-band.
  The threat this answers is a *substituted* relay: someone who controls the
  address a user was handed can present a well-formed fake, but cannot hold
  the pinned key. **The pin authenticates continuity, not virtue** — a pinned
  but hostile relay still sees everything the Metadata bullet above lists;
  pinning never makes a relay trustworthy, only recognizable. Relays that
  predate step 4 advertise no key and are used exactly as before (implicit
  trust, no pin).
- **The plain relay path is deprecated (stage-0, 2026-11-13).** `/api/msg/send` and
  `/api/msg/poll` store sender id, display name, public key, group name and message-type
  flags in plaintext — everything sealed v2 exists to hide. Every plain-path response now
  carries a `Deprecation: true` header, and operators can disable the path outright with
  `PLAIN_PATH_DISABLED=true` (410 `PLAIN_PATH_DISABLED`). The handlers may be deleted once
  (1) every client an operator serves negotiates `seal-v2`, (2) the operator has run with
  `PLAIN_PATH_DISABLED=true` for a full inbox TTL (7 days) with no delivery failures —
  proof no live client still depends on the fallback — and (3) the client's
  legacy-envelope resend path has aged out. Note the one functional casualty of disabling:
  `/wipe`'s self-addressed remote-wipe signal travels the plain path, so with the path
  disabled that signal silently no-ops (the wipe itself still proceeds locally).
- **Read-receipt timing.** A receipt fired the instant a conversation opens is a precise
  timestamp of when a specific person looked at their phone, and correlating those against
  sends is a known de-anonymisation route against sealed-sender systems (NDSS'21). Since D01
  a fresh install holds receipts for 120 seconds with ±20% jitter by default, so the signal an
  observer gets is blurred without anyone opting in; `/quiet N` adjusts the hold (0 restores
  instant receipts; saved settings are never rewritten, so the new default reaches fresh
  installs only). The stronger setting remains "hide read receipts" (send none at all); the
  delay is the middle option for people who want to keep the courtesy without the precision.
- **Franking (I17)** proves a reported ciphertext was genuinely sent. The original symmetric
  commitment did not cryptographically bind *which* sender sent it under Sealed Sender; since
  D08 the sender additionally signs the commitment with their Ed25519 identity key (AMF,
  Tyagi et al. — CRYPTO-SPEC §6a), so a verified report is bound to its sender and a reporter
  cannot forge or re-attribute one. The residual limit is the mirror image: an adversarial
  client can withhold its AMF tag, which makes its messages unreportable rather than
  forgeable; reports from pre-AMF clients still verify at the symmetric level only.
- **Defaults (v3.7.1)**: authenticated X3DH v5 and group forward secrecy are **ON by
  default**. Both are capability-negotiated with an AND rule and fall back to the legacy path
  whenever any peer/member is un-upgraded, so first contact is authenticated and group messages
  are forward-secret without breaking older clients. Call-signaling E2E (`CALL_E2E_SIGNAL`) is
  likewise on by default and capability-negotiated (`CAPS_CALL_E2E` in the prekey-bundle
  caps), so it engages only when both ends advertise it. Still opt-in: at-rest key wrapping
  (needs a user passphrase, `/keywrap`). Worker-side auth gates: the two
  registration gates (`PRESENCE_REQUIRE_AUTH`, `TURN_REQUIRE_AUTH` — prekey-bundle existence
  only, no signature) are **on by default** since the 2026-11-13 stage-0 hardening; the
  Ed25519-signature `*_REQUIRE_AUTH` flags remain operator choices, because clients on
  runtimes without WebCrypto Ed25519 cannot sign at all and a mandatory default would cut
  them off — see `wrangler.toml`.
- **Durable relay ownership:** `prekey-owner:<userId>` retains the Ed25519 owner
  without expiration. Uploads lazily migrate an existing bundle's key, reject
  unsigned replacement regardless of flags, and require the old owner's proof
  to rotate. Owner-backed queue reads/ACKs and mailbox subscriptions verify this
  key even after bundle expiry; unsigned access is rejected. Unsigned-runtime
  accounts without an owner keep the previous behavior. Authenticated account
  erasure removes ownership; loss of the owner private key has no reset path.
  The client bounds signing initialization to five seconds before continuing
  unsigned polls: those polls remain unauthorized for owner-backed accounts
  until signing recovers. First registration and already-expired, unmigrated
  accounts remain TOFU. KV consistency/concurrent-write limitations and the
  existing five-minute replay window are unchanged; proofs are not single-use.
- **@alias resolution** is answered by the relay, which returns an unsigned `{pub}`. Since
  v3.6.1 an alias add runs the key-transparency audit first: a **tampered** hash chain blocks the
  add outright, a **rolled** key warns. This detects a relay rewriting key *history*; it cannot
  detect a relay that has served one consistent wrong key from the start (TOFU). Adding by raw
  public key or QR avoids the question entirely — there the key *is* the identity.
- **The plan/account-slot limit is not a security control.** `getAccountSlots()` reads
  `localStorage['brz-acc-slots']` and the check is a client-side `if (accs.length >= slots)
  return`. The relay keeps no per-account slot record at all (the legacy `slots:{userId}` KV
  entry was removed in D29) and gates no actual resource on it, because
  "accounts" are local browser profiles — nothing is allocated server-side per slot. Anyone can
  raise their own limit with one `localStorage.setItem`. This is noted so the limit is not
  mistaken for an enforced boundary; it is a nudge. Making it real would require the server to
  own a per-slot resource, which today it does not.
- **Presence discloses online status, not identity.** A `/presence` check answers only
  `online` plus protocol capabilities. It no longer returns the account's display name
  (removed v3.7): the endpoint is unauthenticated, so anyone holding a 12-character user id
  could read the chosen name of the person behind it. Online-status itself remains visible to
  anyone who knows an id — reduce exposure by not sharing your id publicly.
- **An invite token is effectively group membership.** `/group/info` returns the full member
  list (ids, public keys, names) to any token holder without joining — but restricting that
  read would not help: `/group/join` accepts the same token with no signature and no approval,
  and its response contains the roster anyway, along with message access. Gating the weaker
  read while the stronger write stays open is a control that looks like security and is not;
  it was implemented, measured, and reverted for exactly that reason. **Treat an invite link
  as equivalent to membership**: share it the way you would add someone to the group, and
  rotate the group to revoke. Making this genuinely restrictive means gating *join* (e.g.
  admin approval), which is a product decision rather than a privacy patch.
- **Post-quantum**: key exchange is classical (X25519) today; ML-KEM hybrid is detected but
  not yet deployed (browsers ship ML-KEM ~2027).
- **Multi-device (Phase 1)**: a linked device is a full Breeze identity with its own ratchets;
  the account is a **root-Ed25519-signed device registry** on the relay, re-verified by every
  sender before fan-out. Consequences to understand:
  - **The relay cannot inject a device** — an unverifiable or unsigned registry makes senders
    fall back to single-device (fail-closed on trust, fail-open on delivery). But the relay
    *can withhold* the registry, silently degrading an account to single-device delivery.
  - **Root loss = device-management loss.** Only the root key signs the registry; if the
    primary device is lost, devices can no longer be added or removed (messaging on surviving
    devices keeps working). Keep a backup of the primary (`/backup`). Since recovery-plan
    step 1, backups carry the root signing key and the account record, so restoring one
    on a new device restores device management too; backups written before then carry
    neither and do not heal root loss.
  - **Revocation lags by the sender-side cache TTL (≤5 min).** After `/unlink`, a contact who
    fetched the registry recently may fan out to the removed device for up to 5 more minutes.
  - **No history sync** (like Signal): a newly linked device starts empty; `/backup`+restore is
    the migration path. Self-sync copies only messages sent *after* linking.
  - **Secondary-device trust is anchored at link time**: `/linkto` pins the root's signing key
    obtained while physically holding both devices (same TOFU gesture as adding a contact by
    raw key), and the registry must already list the new device before it binds.
  - **Cloud backups are opt-in, and expire.** A relay stores backups only when its operator
    enables backup storage (`BACKUP_STORAGE_ENABLED=true` — a relay run for the operator's
    own accounts); the shared default relay stores none at all, and clients are told so
    plainly rather than allowed to believe a backup exists there. Where storage is enabled,
    the relay keeps an uploaded backup for 90 days after its last
    upload and nothing renews it. The upload response now carries `expiresAt` and the client
    shows the date, because a safety net that quietly stopped existing is worse than no
    safety net. Re-upload before the date to keep the recovery path alive.
  - **Simple-mode recovery (account + passphrase) is the weakest of the three modes, by
    design and disclosed as such.** On a relay with backup storage enabled, a user may
    instead recover from a self-chosen account name + passphrase (≥8 chars): the backup
    (the same encrypted v2 payload) is stored under a locator derived from that pair
    (PBKDF2-HMAC-SHA256, 600k iterations; spec in `docs/CRYPTO-SPEC.md` §2c), never under
    the userId or public key. Uploads and deletions require an Ed25519 signature by the
    identity's signing key — the first upload binds the slot to that key — so knowing a
    locator grants no write access to anyone else's backup. Download takes the locator
    alone: it is a capability, computable only by someone who knows the account name and
    passphrase at one 600k-iteration PBKDF2 per guess, and a wrong passphrase derives a
    different locator, indistinguishable from a nonexistent account (no existence
    oracle). Honest limits: the mode's strength is exactly the passphrase's entropy —
    weaker than the 256-bit recovery phrase, which remains the recommended default, and
    the setup flow says so before anything is created. The placement's operator sees the
    ciphertext, the owner public key, the blob size and update times — never the
    plaintext, the passphrase, or the account name (only its keyed hash). Slots expire
    after 90 days unless refreshed by an update; `/wipe` deletes the slot with an
    owner-signed request. The mode is never offered against a relay that has not opted
    into backup storage, so it does not exist on the shared default relay.
  - **Backup restore is migration, not multi-device.** Restoring a backup clones the
    identity; running the original and the clone simultaneously forks every Double-Ratchet
    session and corrupts conversations — the exact failure `/link` exists to prevent. The
    presence heartbeat carries a per-install instance id (deliberately excluded from
    backups), and the relay flags the same identity heartbeating from two live installs;
    the client then warns the user to retire one install or use `/link`. Detection is
    best-effort (isolate-local cache, ≤5-min-stale KV): a miss is possible, a flag is
    always real. It is a safety net, not a lock — the relay cannot prevent concurrent use.
  - **Mutations follow messages.** Edit/delete/reaction signals fan out to the contact's
    devices and self-sync to the sender's own devices. A registry-verified sibling device may
    mutate messages marked `mine` — it *is* the same account holder — while a contact remains
    restricted to mutating only their own messages (the `stored.mine` guard). Signal delivery
    is best-effort via the same queues as messages.
  - **Sender attribution is registry-gated, never claim-gated.** A secondary device names its
    account root in the envelope (`acctRoot`), but the recipient attributes the message to that
    account only after re-verifying the root-signed registry (with the root's *pinned* signing
    key) lists the sending device's pub — and the ratchet decrypt must then succeed against
    that exact pub. A forged claim fails the registry check and falls back to today's
    stranger-contact path. Attributed senders skip the per-contact Ed25519 TOFU pin (their key
    legitimately differs from the root's); identity is carried by the registry, not the pin.
  - **The registry is publicly readable** (senders must fetch it): anyone who knows an
    accountId can learn the account's *device count* and device public keys. This is metadata
    of the same class as Signal's public prekey bundles — it reveals nothing about message
    content, contacts, or traffic.

## Security Architecture

### First-session identity binding

Relay-fetched and offline-injected bundles must match the contact's exact encryption public key and,
when present, its pinned Ed25519 signing key. Identity mismatches stop the send with
a localized warning: they do not trigger another relay lookup or legacy bootstrap.
Without a signing pin, a relay bundle key is TOFU-pinned only after its signed prekey
verifies; offline bundles still require the pairing's existing pin. Incoming signed
text likewise pins only after successful verification.
Before bootstrapping a received first message, `pkm.ik` must equal the expected
peer encryption key, including messages forwarded through a peer relay. A mismatch
is dropped before a session or message is saved. These checks do not authenticate
a person's name or replace out-of-band identity verification; KT remains warn-only.

Breeze uses the following cryptographic primitives:

| Layer | Algorithm | Purpose |
|-------|-----------|---------|
| Key Exchange (1:1) | X3DH v5: Ed25519-signed SPK, DH(IK,SPK)+DH(EK,IK)+DH(EK,SPK)+DH(EK,OPK) | Authenticated first-contact key agreement (I1) |
| Key Exchange (DH) | X25519 (preferred), P-256 (fallback) | DH ratchet + X3DH DHs |
| Signing | Ed25519 | SPK signing (X3DH auth), signed 1:1 text |
| Encryption | AES-256-GCM | Message confidentiality |
| Key Derivation | HKDF-SHA256 | Root/chain/commitment/ratchet/X3DH KDF |
| Key Commitment | HKDF(msgKey,'breeze-commit') + constant-time verify | Invisible-salamanders defense (I16) |
| At-Rest | PBKDF2 ≥600k SHA-256 + AES-256-GCM | App-lock / identity key wrapping (I4) |
| Protocol (1:1) | Signal Double Ratchet (v4/v5) | Per-message FS; Nr reset on DH step |
| Protocol (group) | Sender Key chain-ratchet + epoch rotation | Group FS (I2) + PCS/kick (I3) |
| Group Auth | Peer-bound direct frames + symmetric Sender Keys | Membership/transport checks; no deployed per-message author signature (N2) |
| Franking | HMAC-SHA256 commitment/opening | Verifiable abuse reporting without escrow (I17) |
| Sealed Sender v2 | Ephemeral X25519 ECDH + HKDF('breeze-seal-v2') + AES-256-GCM (AAD: to+ts) | Sender anonymity vs the relay, incl. first-contact X3DH header |
| Anti-Replay | Counter + msgId dedup + TTL-expiring skipped-key cache | Replay + stale-key FS (I7) |
| Trusted Types | breeze-sanitizer policy | DOM XSS prevention |
| File Validation | Magic bytes (PE/ELF/Mach-O/shebang) | Executable upload blocking |
| Timing | Constant-time ctEqual() | Commitment + MAC comparisons |
| Memory | zeroBuffer() | Key material erasure after use |

Group receive checks membership before either Sender-Key or legacy decryption. Direct
`group_msg` frames must match the connected peer's full public key; explicitly forwarded
frames do not gain group-author authentication from the forwarder's identity. Group
attribution uses local contact/member names, not received display names. Relay sender
and public-key fields must be consistent with the local member record, but are not
an author proof: another member receives the same Sender-Key material and can forge
a ciphertext as that sender with consistent fields. Sealed Sender does not remove
this insider attack. The Ed25519 author signatures in reference `src/crypto/group.js`
are not deployed by these checks; per-message author signatures need a separately
negotiated protocol upgrade. Local names likewise do not establish a human identity.

## Security Headers

| Header | Value |
|--------|-------|
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'sha256-…'` (hash-pinned — **no `'unsafe-inline'`**), `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `require-trusted-types-for 'script'` |
| Cross-Origin-Opener-Policy | same-origin |
| Permissions-Policy | camera=(self), microphone=(self), geolocation=() |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |

## Design Principles

- **Zero-knowledge server**: Worker relays signals only; cannot read message content
- **No phone/email**: Identity = cryptographic key pair
- **Client-side encryption**: All crypto operations in browser WebCrypto API
- **Forward secrecy**: Every message uses a unique ephemeral key via Double Ratchet
- **Sealed Sender v2**: sender metadata encrypted to the recipient (ECIES-style); the server cannot identify the sender of a v2 envelope — legacy envelopes (old peers, `/msg` fallback, retry queue) remain sender-visible
- **Key change warning**: 3 decrypt failures → yellow banner (MITM detection)
- **P2P-only mode**: Functions without server when P2P connections are active
- **Dual-path delivery**: P2P direct + sealed sender relay with dedup

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.6.x   | ✓ Yes |
| < 3.6   | ✗ No  |
