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
`slots:{userId}` KV record (`{ slots, plan, customerId, updatedAt }`) is still scaffolded in the
storage schema and read/deleted on account deletion, but nothing writes a real plan into it, and
the client never checks it — every account, self-hosted or hosted, can add unlimited local
accounts today with no plan enforcement. Documentation and in-app legal text have been corrected
to stop advertising this as available rather than rebuilding it retroactively; that remains
separate, explicitly-scoped future work if it's wanted.

### Removed: peer-relay hold/deliver

When a direct DataChannel send failed, the client used to ask an arbitrary *other connected
contact* to hold the encrypted envelope and deliver it when the recipient connected to them.
The payload stayed E2E — but the holder learned the social graph (`sender → targetId`, time,
size), which is exactly the metadata Sealed Sender v2 exists to hide from the relay. And it
was redundant: the sealed-sender POST ran unconditionally on the same code path, so the peer
detour could only beat it when the recipient was reachable by a mutual peer but unreachable
by the relay. Deleted outright (hold request send, hold/deliver handlers, the `_peerRelayQueue`
store) rather than gated — an opt-in toggle leaves the contradiction one peer away.

### Other known limitations

- **Relay state has TTLs, and TTLs are a liveness property.** Device registries and group
  records are refreshed on read (once per day per record) so state that is actively *used*
  cannot expire underneath its users; prekey records self-heal — the client detects a 404 from
  `/prekey/status` and re-registers, so a long-quiet identity becomes reachable again instead
  of staying permanently unreachable to new contacts. Cloud backups are the deliberate
  exception (see below): they expire on schedule and now say so.
- **The sealed queue is a bounded, last-write-wins KV value.** Cloudflare KV offers no
  transactions, so the queue's read-modify-write can lose an envelope if two senders write to
  the same recipient in the same instant from different PoPs — and both senders would be
  answered 200, making the loss silent. The send path now **reads the key back and re-appends
  its own envelope if it is missing**, which recovers the common case for one extra read on the
  cold send path. Deliberately not the textbook fix: a key per envelope removes the race
  outright but replaces one `get` per poll with a `list` plus a `get` per message on the
  hottest path, in a relay that already throttles presence writes to survive the free tier.
  So the sealed path remains **best-effort with recovery, not exactly-once**; content-keyed
  dedup, the client retry queue and the overflow confession (`dropped: n`) still back it, and
  P2P delivery plus re-send remain the ultimate recovery paths.
- **Accepted mail is immutable.** Both queues (`inbox:{id}`, `sealed:{id}`) used to evict
  the OLDEST pending entry on overflow — since send endpoints are unauthenticated (the
  relay can't distinguish a flooder from a contact), anyone could purge a victim's
  undelivered mail in ~4 min single-IP (30/min vs the 100-entry cap). Now a full queue
  answers `429 QUEUE_FULL` and refuses the write: stored entries can never be evicted by
  a flood, and the sender's existing retry path re-sends once the recipient drains.
  Trade-off is honest — the flood can block *new* arrivals while it sustains a full
  queue, but it can never destroy mail the relay already accepted. The lost-write
  recovery re-append honors the same bound (it skips rather than evict onto a full
  queue). The **signal room** (`sig:{room}`) follows the same invariant: the 50-entry
  cap used to drop-oldest, letting anyone who could derive a room name
  (`dm:{a}:{b}` from two public ids, `call:{id}` from one) destroy an in-flight
  call handshake by flooding 51 entries. It now refuses with `429 QUEUE_FULL` —
  accepted offer/answer/ICE survive to be polled, and the client retries once
  within the drain window.
- **Configured TURN providers require the caller's signature by default.**
  `/api/turn` used to mint credentials for anyone unless `TURN_REQUIRE_AUTH=true`
  was set — an opt-in nobody knew about while a configured Cloudflare Calls key
  bills $0.05/GB (and self-hosted coturn burns operator bandwidth). An earlier
  "registered `prekey:{userId}`" gate would have been theater — registered ids
  are public, so one known id still drains the quota. A configured provider (CF
  Calls key pair, coturn HMAC secret, or static creds) now requires an Ed25519
  signature (`breeze-turn:{id}:{ts}`, verified against `prekey:{id}`) by default;
  `TURN_REQUIRE_AUTH=false` opts out, and `=true` still forces the gate even on
  the openrelay path. The openrelay fallback stays open by default — its
  credentials are already printed in `_worker.js`, so gating only that path
  would be theater.
- **Group mutations require the caller's signature by default.** Kick, admin
  (promote/demote/unban), transfer, rename, leave and delete used to verify a
  signature *when present* but accept unsigned requests unless
  `GROUP_REQUIRE_AUTH=true` was set — and every deployed client has signed them
  all along (`breeze-group-{action}:{token}:{actor}:{ts}:{bind}`). Unsigned is
  now refused `403 AUTH_REQUIRED`; `GROUP_REQUIRE_AUTH=false` opts out.
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
  The relay still sees recipient, timing, and message size (padded to 256 B boundaries);
  cover traffic / onion routing are deferred (see SPEC §12).
- **Read-receipt timing.** A receipt fired the instant a conversation opens is a precise
  timestamp of when a specific person looked at their phone, and correlating those against
  sends is a known de-anonymisation route against sealed-sender systems (NDSS'21). `/quiet N`
  holds receipts for N seconds with ±20% jitter, so the signal an observer gets is blurred.
  The stronger setting remains "hide read receipts" (send none at all); the delay is the
  middle option for people who want to keep the courtesy without the precision.
- **Symmetric franking (I17)** proves a reported ciphertext was genuinely sent, but under
  Sealed Sender it does not cryptographically bind *which* sender sent it — a malicious
  reporter cannot forge a report, but sender-binding needs asymmetric franking / Hecate
  (CRYPTO-SPEC §9 N4).
- **Defaults (v3.6.1)**: authenticated X3DH v5 and group forward secrecy are now **ON by
  default**. Both are capability-negotiated with an AND rule and fall back to the legacy path
  whenever any peer/member is un-upgraded, so first contact is authenticated and group messages
  are forward-secret without breaking older clients. Still opt-in: at-rest key wrapping (needs a
  user passphrase, `/keywrap`) and call-signaling E2E (`CALL_E2E_SIGNAL` has no capability
  negotiation yet, so enabling it requires both ends). Of the Worker-side `*_REQUIRE_AUTH`
  flags, `MSG_REQUIRE_AUTH`/`SEALED_REQUIRE_AUTH`/`PUSH_REQUIRE_AUTH` are on by default
  (opt out with `=false`); the rest remain operator choices — see `wrangler.toml`.
- **@alias resolution** is answered by the relay, which returns an unsigned `{pub}`. Since
  v3.6.1 an alias add runs the key-transparency audit first: a **tampered** hash chain blocks the
  add outright, a **rolled** key warns. This detects a relay rewriting key *history*; it cannot
  detect a relay that has served one consistent wrong key from the start (TOFU). Adding by raw
  public key or QR avoids the question entirely — there the key *is* the identity.
- **The plan/account-slot limit is not a security control.** `getAccountSlots()` reads
  `localStorage['brz-acc-slots']` and the check is a client-side `if (accs.length >= slots)
  return`. The relay stores `slots:{userId}` but gates no actual resource on it, because
  "accounts" are local browser profiles — nothing is allocated server-side per slot. Anyone can
  raise their own limit with one `localStorage.setItem`. This is noted so the limit is not
  mistaken for an enforced boundary; it is a nudge. Making it real would require the server to
  own a per-slot resource, which today it does not.
- **Presence discloses online status, not identity.** A `/presence` check answers only
  `online`. It no longer returns the account's display name (removed v3.7): the endpoint is
  unauthenticated, so anyone holding a 12-character user id could read the chosen name of
  the person behind it. Online-status itself remains visible to anyone who knows an id —
  reduce exposure by not sharing your id publicly. Presence *writes* are also unauthenticated
  by default — anyone can heartbeat as a known id and fake an "online" dot; operators can
  set `PRESENCE_REQUIRE_AUTH=true` to require an Ed25519 ownership signature
  (`breeze-presence:<id>:<ts>`, verified against `prekey:<id>`). The flag stays opt-in —
  unlike the queue flags, every already-deployed client posts unsigned heartbeats, so a
  default-on flip would make existing builds look permanently offline until they upgrade.
  Capability data (`caps`) never rode presence end-to-end (the heartbeat never sent it and
  the batch check — the only client reader — returns online only); it lives in the prekey
  bundle, read via `/prekey/status`.
- **Prekey bundles are incumbent-endorsed.** `/prekey/upload` binds `userId` to the
  `identityKey` prefix — but prefix alone can't stop a caller presenting the victim's
  *real* identityKey with the attacker's SPK + Ed key (a mixed-key poison: new sessions
  break and fresh contacts would pin the attacker's signing key). Once a bundle carries
  an `edIdentityKey`, overwriting it requires an Ed25519 signature by that incumbent
  (`breeze-prekey-upload:<id>:<ts>`) — key rotation stays self-consistent and an outsider
  can't rotate keys they don't own. First writes and legacy bundles without an Ed key
  stay open (nothing to verify against); `PREKEY_REQUIRE_AUTH=false` opts out entirely.
- **Id-keyed queues are owner-enforced by default.** `/msg/poll`, `/sealed/poll` and
  `/sealed/ack` require an Ed25519 ownership signature (`breeze-<op>:<id>:<ts>`,
  verified against the registered `prekey:{id}` bundle — same pattern as group ops)
  because an unsigned call is *destructive*: a future `lastTs` purges an inbox older
  than the multi-tab grace, and an ack blind-deletes the sealed queue. Every current
  client already signs, so enforcement is on unless an operator explicitly sets
  `SEALED_REQUIRE_AUTH=false` / `MSG_REQUIRE_AUTH=false` to keep serving pre-signing
  clients. The same applies to `/push/subscribe` and `/push/unsubscribe`: a signed
  subscribe binds the subscription's endpoint + p256dh + auth key (not just the userId)
  so a relay can't swap in its own device under a replayed signature, and a signed
  unsubscribe binds the endpoint being removed — both enforced by default now that the
  client signs them (`PUSH_REQUIRE_AUTH=false` opts out). An account that has not yet uploaded a prekey bundle has no key to verify
  against and is treated as unsigned — polls then fail-closed until onboarding
  completes its bundle upload (self-healing on the next retry).
- **A sealed queue's retention is not shortened by polling.** Polls used to rewrite the
  queue with a 5-minute "grace" TTL — a week of retention collapsed to 5 minutes on every
  poll, so going offline >5 min right after polling silently expired unprocessed mail.
  Polls no longer rewrite the queue; crash-recovery relies on the original TTL plus the
  high-water-mark + client dedup instead.
- **Data-channel signaling is authenticated AND confidential when both ends upgrade.**
  1:1 P2P negotiation posts to the unauthenticated `dm:<idA>:<idB>` room, which anyone
  who knows both ids (e.g. a shared group co-member) can poll. Since this round, posts
  are sealed when the peer advertises `dm-sig-v1` in its prekey-bundle caps: the
  `{type,data}` pair is ECIES-encrypted to the peer's identity key (the seal-v2
  primitive) and rides as an opaque `{type:'enc'}` envelope — the relay sees only
  that *some* signal passed between the pair, not which kind (ICE candidates, which
  disclose both IPs, and typing/read activity are now inside the ciphertext).
  Authenticity is layered the same as before: the Ed25519 SDP signature is produced
  first and rides inside the sealed envelope (sign-then-seal), so the MITM-injection
  defense is unchanged. A peer without the cap still gets legacy plaintext —
  delivery over privacy, matching the seal-v2 trade-off. `call:` rooms are sorted-id
  pairs like `dm:` rooms, so the same sealing covers call-offer/answer/ice/end —
  call signaling (incl. call-ICE candidates) is confidential whenever both ends
  upgrade. Two layers remain distinct: dm-sig seals *confidentiality* (anyone can
  encrypt to a public key, so it does not authenticate the sender), while
  `_wrapCallSignal`'s ratchet wrap is the *authenticity* layer — still gated by
  `CALL_E2E_SIGNAL` (off by default: it needs an established ratchet session).
  Without that flag a sealed call-end is still forgeable by anyone who knows the
  pair and the callee's public key — same injection surface as before sealing
  landed, now minus the metadata leak.
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
    devices keeps working). Keep a backup of the primary (`/backup`).
  - **Revocation lags by the sender-side cache TTL (≤5 min).** After `/unlink`, a contact who
    fetched the registry recently may fan out to the removed device for up to 5 more minutes.
  - **No history sync** (like Signal): a newly linked device starts empty; `/backup`+restore is
    the migration path. Self-sync copies only messages sent *after* linking.
  - **Secondary-device trust is anchored at link time**: `/linkto` pins the root's signing key
    obtained while physically holding both devices (same TOFU gesture as adding a contact by
    raw key), and the registry must already list the new device before it binds.
  - **Cloud backups are incumbent-endorsed.** Once a backup exists for an account,
    overwriting it requires the account's Ed25519 signature (`breeze-backup-upload:<id>:<ts>`)
    — otherwise anyone who knew a userId could replace that user's recovery blob with
    attacker ciphertext. First writes stay open (nothing stored to protect); all current
    clients already sign, so no legitimate overwrite is affected. `BACKUP_REQUIRE_AUTH=true`
    still makes even first writes signed.
  - **Cloud backups expire.** The relay keeps an uploaded backup for 90 days after its last
    upload and nothing renews it. The upload response now carries `expiresAt` and the client
    shows the date, because a safety net that quietly stopped existing is worse than no
    safety net. Re-upload before the date to keep the recovery path alive.
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

Breeze uses the following cryptographic primitives:

| Layer | Algorithm | Purpose |
|-------|-----------|---------|
| Key Exchange (1:1) | X3DH v5: Ed25519-signed SPK, DH(IK,SPK)+DH(EK,IK)+DH(EK,SPK)+DH(EK,OPK) | Authenticated first-contact key agreement (I1) |
| Key Exchange (DH) | X25519 (preferred), P-256 (fallback) | DH ratchet + X3DH DHs |
| Signing | Ed25519 | SPK signing (X3DH auth), group per-message auth (N2) |
| Encryption | AES-256-GCM | Message confidentiality |
| Key Derivation | HKDF-SHA256 | Root/chain/commitment/ratchet/X3DH KDF |
| Key Commitment | HKDF(msgKey,'breeze-commit') + constant-time verify | Invisible-salamanders defense (I16) |
| At-Rest | PBKDF2 ≥600k SHA-256 + AES-256-GCM | App-lock / identity key wrapping (I4) |
| Protocol (1:1) | Signal Double Ratchet (v4/v5) | Per-message FS; Nr reset on DH step |
| Protocol (group) | Sender Key chain-ratchet + epoch rotation | Group FS (I2) + PCS/kick (I3) |
| Group Auth | Ed25519 per-message signature | Forgery resistance within group (N2) |
| Franking | HMAC-SHA256 commitment/opening | Verifiable abuse reporting without escrow (I17) |
| Sealed Sender v2 | Ephemeral X25519 ECDH + HKDF('breeze-seal-v2') + AES-256-GCM (AAD: to+ts) | Sender anonymity vs the relay, incl. first-contact X3DH header |
| Anti-Replay | Counter + msgId dedup + TTL-expiring skipped-key cache | Replay + stale-key FS (I7) |
| Trusted Types | breeze-sanitizer policy | DOM XSS prevention |
| File Validation | Magic bytes (PE/ELF/Mach-O/shebang) | Executable upload blocking |
| Timing | Constant-time ctEqual() | Commitment + MAC comparisons |
| Memory | zeroBuffer() | Key material erasure after use |

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
