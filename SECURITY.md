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

- **Metadata**: Sealed Sender hides the *sender* from the relay, but the relay still sees
  recipient, timing, and message size (padded to 256 B boundaries). Cover traffic / onion
  routing are deferred (see SPEC §12).
- **Symmetric franking (I17)** proves a reported ciphertext was genuinely sent, but under
  Sealed Sender it does not cryptographically bind *which* sender sent it — a malicious
  reporter cannot forge a report, but sender-binding needs asymmetric franking / Hecate
  (CRYPTO-SPEC §9 N4).
- **Opt-in hardening**: several strong defenses (authenticated X3DH v5, group forward
  secrecy, at-rest key wrapping, call-signaling E2E) are capability-negotiated and
  **default-off** to preserve interop during rollout — enable per the CONFIG flags /
  `wrangler.toml` `*_REQUIRE_AUTH` docs once your user base has upgraded.
- **Post-quantum**: key exchange is classical (X25519) today; ML-KEM hybrid is detected but
  not yet deployed (browsers ship ML-KEM ~2027).

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
- **Sealed Sender**: Server cannot identify message sender
- **Key change warning**: 3 decrypt failures → yellow banner (MITM detection)
- **P2P-only mode**: Functions without server when P2P connections are active
- **Dual-path delivery**: P2P direct + sealed sender relay with dedup

## Supported Versions

| Version | Supported |
|---------|-----------|
| 3.6.x   | ✓ Yes |
| < 3.6   | ✗ No  |
