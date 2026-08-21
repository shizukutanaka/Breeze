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
- **Subresource Integrity** pins the one external script (`lang.js`).
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

### Other known limitations

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
- **Symmetric franking (I17)** proves a reported ciphertext was genuinely sent, but under
  Sealed Sender it does not cryptographically bind *which* sender sent it — a malicious
  reporter cannot forge a report, but sender-binding needs asymmetric franking / Hecate
  (CRYPTO-SPEC §9 N4).
- **Defaults (v3.6.1)**: authenticated X3DH v5 and group forward secrecy are now **ON by
  default**. Both are capability-negotiated with an AND rule and fall back to the legacy path
  whenever any peer/member is un-upgraded, so first contact is authenticated and group messages
  are forward-secret without breaking older clients. Still opt-in: at-rest key wrapping (needs a
  user passphrase, `/keywrap`) and call-signaling E2E (`CALL_E2E_SIGNAL` has no capability
  negotiation yet, so enabling it requires both ends). Worker-side `*_REQUIRE_AUTH` flags remain
  operator choices — see `wrangler.toml`.
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
