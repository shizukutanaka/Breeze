# Breeze — Category Research, Round 2 (Product-Surface Categories 11–20)

> Continues `docs/CATEGORY-RESEARCH.md` (categories 1–10, the core messenger axes).
> Round 2 covers the **broader product surface** — platform, UX, growth, ops,
> ecosystem, governance — that a real secure-messenger product needs. Each category:
> ~10 arXiv/GitHub/standards sources + concrete improvement points. Effort: S/M/L.

| # | Category | Status |
|---|----------|--------|
| 11 | PWA platform — service worker, offline, installability | ✅ |
| 12 | Notifications & push (privacy-preserving) | ✅ |
| 13 | Onboarding, identity UX & key verification | ✅ |
| 14 | Accessibility (a11y) | ✅ |
| 15 | Internationalization & localization | ✅ |
| 16 | Monetization & billing (privacy-preserving) | ✅ |
| 17 | Observability & privacy-preserving telemetry | ✅ |
| 18 | Anti-censorship & blocking resistance | ✅ |
| 19 | Federation & interoperability | ✅ |
| 20 | Governance, compliance & threat-model docs | ✅ |

---

## 11 — PWA platform — service worker, offline, installability

Breeze: `sw.js` (versioned precache, 50-item cap), installable PWA, no build.

1. *W3C Service Workers* ([spec](https://www.w3.org/TR/service-workers/)) → the SW is a security boundary **and** the natural place to pin app integrity (cat 8).
2. *Web App Manifest* ([W3C](https://www.w3.org/TR/appmanifest/)) → installability, shortcuts, share-target.
3. *Background Sync API* ([explainer](https://wicg.github.io/background-sync/spec/)) → **reliably flush queued outbound messages** when connectivity returns (Breeze relies on live polling).
4. *Periodic Background Sync* → fetch queued inbound while installed.
5. [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) → battle-tested caching strategies (stale-while-revalidate, precaching) — design reference for `sw.js`.
6. *Karami et al., "Awakening the Web's Sleeper Agents: Misusing Service Workers"* (arXiv/USENIX-adjacent) → SW abuse/hijack risks → validate SW update integrity.
7. *"Tales of FAVICONS and Caches: Persistent Tracking via SW/Cache"* ([arXiv 2103.06883](https://arxiv.org/abs/2103.06883)) → cache-based tracking → scope/partition caches carefully.
8. [w3c/ServiceWorker](https://github.com/w3c/ServiceWorker) → spec issues / update semantics.
9. *Storage Buckets / Persistent Storage API* → request persistent storage so the OS doesn't evict the encrypted keystore/messages.
10. [GoogleChromeLabs/pwa-* samples] → install-prompt, offline UX patterns.

**Improvements:** add **Background Sync** for reliable offline send; request
**persistent storage** so keys/messages aren't evicted; pin the app hash in the SW
(integrity, cat 8); partition caches to avoid SW/cache tracking; keep the versioned
precache but adopt Workbox-style stale-while-revalidate for assets.

## 12 — Notifications & push (privacy-preserving)

Breeze: Web Push via VAPID. Push services (Google/Apple/Mozilla) see timing + any payload.

1. *RFC 8030 — Generic Event Delivery (Web Push)* ([rfc](https://www.rfc-editor.org/rfc/rfc8030)) → the push model.
2. **RFC 8291 — Message Encryption for Web Push** ([rfc](https://www.rfc-editor.org/rfc/rfc8291)) → **encrypt payloads end-to-end** so the push service sees only ciphertext (confirm Breeze does this).
3. *RFC 8292 — VAPID* ([rfc](https://www.rfc-editor.org/rfc/rfc8292)) → already used; authenticates the app server to the push service.
4. Push as a deanonymization vector — 2023–24 disclosures that push tokens are subject to legal demands (Apple/Google can link token→account) → **minimize push, no message preview**.
5. [web-push-libs/web-push](https://github.com/web-push-libs/web-push) → RFC 8291 payload encryption reference for the Worker.
6. [UnifiedPush](https://github.com/UnifiedPush) → de-Googled push (self-hosted/ntfy) for privacy-prioritizing users.
7. [binwiederhier/ntfy](https://github.com/binwiederhier/ntfy) → simple self-hostable push backend option.
8. *"Push Notifications and Privacy"* measurement work → push timing leaks presence/activity.
9. *Declarative Web Push* (Apple, WebKit) → OS renders notification from encrypted payload without waking JS → less metadata to the app.
10. *Notification Triggers / content hiding* → show "New message" only, decrypt on open.

**Improvements:** **encrypt push payloads (RFC 8291)** and ship **no plaintext preview**
(content-hidden notifications, decrypt on open); offer **UnifiedPush/ntfy** as a
de-Googled option; document the push-token legal-exposure risk; minimize push frequency
to reduce activity-timing leakage.

## 13 — Onboarding, identity UX & key verification

Breeze: keypair identity (no phone), safety numbers, TOFU key-change warnings.

1. Abu-Salma et al., *Obstacles to the Adoption of Secure Communication Tools*, [IEEE S&P 2017](https://www.cl.cam.ac.uk/~rja14/Papers/obstacles.pdf) → usability is the adoption bottleneck.
2. Unger et al., *SoK: Secure Messaging*, [S&P 2015](https://oaklandsok.github.io/papers/unger2015.pdf) → taxonomy of trust-establishment UX.
3. Tan et al., *Can Unicorns Help Users Compare Crypto Key Fingerprints?*, [CHI 2017](https://dl.acm.org/doi/10.1145/3025453.3025733) → visual fingerprint reps beat hex.
4. Schröder et al., *When Signal Hits the Fan* ([EuroUSEC 2016](https://www.usenix.org/conference/eurousec16)) → users fail Signal's verification UX → better guidance needed.
5. Vaziripour et al., *Is that you, Alice?* (USENIX SOUPS 2017/2018) → users rarely complete authentication ceremonies → make verification in-flow.
6. *QR safety numbers* (Signal design) → scan-to-verify is the highest-success ceremony.
7. *Social/threshold recovery* (e.g. SSS, "Recovery Contacts") → recover identity without a server escrow (ties to I13).
8. [magic-wormhole/PAKE](https://github.com/magic-wormhole/magic-wormhole) → SPAKE2 short-code pairing — great UX for device linking/contact add.
9. *Seeing-is-Believing / out-of-band channels* → QR/NFC for first-contact authentication (defends I1's MITM with a human channel).
10. [signalapp/Signal-Android safety number UX] → reference flows.

**Improvements:** make **QR scan-to-verify** the default contact-add/first-contact
ceremony (a human OOB channel that closes the I1 MITM gap even before key transparency);
nudge verification in-flow with clear, non-hex visual safety numbers; add **PAKE
short-code** device pairing/contact-add (magic-wormhole style); offer **social
recovery**.

## 14 — Accessibility (a11y)

Breeze: uses `announceToSR` (live regions), but no formal a11y audit/CI.

1. *WCAG 2.2* ([W3C](https://www.w3.org/TR/WCAG22/)) → the conformance target (contrast, focus, target size).
2. *WAI-ARIA 1.2* ([W3C](https://www.w3.org/TR/wai-aria-1.2/)) → roles/states for the dynamic message list, dialogs, toasts.
3. [dequelabs/axe-core](https://github.com/dequelabs/axe-core) → **automated a11y testing — add to the new vitest/CI harness**.
4. *ARIA Authoring Practices* ([APG](https://www.w3.org/WAI/ARIA/apg/)) → patterns for menus, dialogs, live regions.
5. `prefers-reduced-motion` → Breeze has swipe/transition animations; gate them.
6. *Accessible Name & Description Computation* → label icon-only buttons (common gap).
7. [GoogleChrome/lighthouse](https://github.com/GoogleChrome/lighthouse) → a11y scoring in CI.
8. *Mobile a11y* (touch target ≥44px, screen-reader gestures) → for the PWA.
9. *Cognitive accessibility (COGA)* → plain-language errors, predictable nav.
10. *Inclusive secure-messaging* research → security ceremonies must be accessible too (safety numbers via screen reader).

**Improvements:** add **axe-core + Lighthouse a11y to CI**; full **WCAG 2.2** pass
(focus order, contrast, target size, accessible names on icon buttons); honor
`prefers-reduced-motion`; ensure the **verification ceremony is screen-reader
accessible**; keyboard-navigable message list and dialogs.

## 15 — Internationalization & localization

Breeze: `t()` system, 406 keys, EN + JA.

1. *Unicode CLDR* ([cldr](https://cldr.unicode.org/)) → locale data: dates, numbers, plural rules.
2. *ICU MessageFormat* ([unicode-org/icu](https://github.com/unicode-org/icu)) → **plurals/gender/select** that simple key lookup can't express.
3. [formatjs/formatjs](https://github.com/formatjs/formatjs) → ICU MessageFormat in JS (design reference; vanilla-friendly subset).
4. *HTML `dir`/CSS logical properties* → **RTL** support for Arabic/Hebrew/Persian.
5. *Unicode Bidi Algorithm (UAX #9)* → correct mixed-direction rendering (and bidi-spoofing safety, cf. "Trojan Source" [arXiv 2111.00169](https://arxiv.org/abs/2111.00169)).
6. *`Intl` API* (built-in) → locale-aware dates/numbers/relative-time with zero deps.
7. *Pseudolocalization* → CI check that UI doesn't truncate/hardcode strings.
8. [translate/pootle | weblate/weblate](https://github.com/WeblateOrg/weblate) → community translation workflow to scale past EN/JA.
9. *Language negotiation* (`navigator.languages`, `Accept-Language`).
10. *Trojan Source / bidi-override* defenses → sanitize bidi control chars in messages (security + i18n).

**Improvements:** adopt **ICU MessageFormat** for plurals/gender; add **RTL** support
via CSS logical properties; use built-in **`Intl`** for dates/numbers (no deps);
sanitize **bidi control characters** in rendered messages (Trojan-Source class); set up
a **community translation** pipeline (Weblate) to broaden beyond EN/JA; add
pseudolocalization to CI.

## 16 — Monetization & billing (privacy-preserving)

Breeze: Stripe plans (Lite/Plus/Pro). Risk: billing identity ↔ messaging identity linkage.

1. *Privacy Pass* ([PETS 2018](https://petsymposium.org/2018/files/papers/issue3/popets-2018-0026.pdf)) → **blind-signed access tokens**: prove "paid" without linking payment to the messaging account.
2. Chaum, *Blind Signatures for Untraceable Payments* (1982) → the primitive behind unlinkable paid access.
3. *GNU Taler* ([taler.net](https://taler.net/en/) / [git.taler.net](https://git.taler.net/)) → privacy-preserving, auditable digital payments.
4. *IETF Privacy Pass (RFC 9576–9578)* → standardized issuance/redemption for paid tokens.
5. [stripe/stripe-node] + *customer-portal* → current billing (keep, but isolate).
6. *Anonymous subscriptions* literature (e.g. "Anonymous Tokens with Private Metadata Bit", [CRYPTO 2020 / 2020/072](https://eprint.iacr.org/2020/072)) → encode plan tier in an unlinkable token.
7. *Cryptocurrency/Lightning* (optional) → pseudonymous payment rail.
8. *Account-less entitlement* → bind entitlement to a token, not to a profile the relay can see.
9. *Receipt/refund privacy* → minimize PII in billing metadata.
10. *PCI scope minimization* → keep Stripe-hosted checkout (already done) to avoid handling card data.

**Improvements:** **decouple payment from messaging identity** using **anonymous
tokens with a private metadata bit** (plan tier) issued after Stripe checkout — the
Worker verifies entitlement without learning *which* paying user is sending; this is a
genuine **metadata-privacy upgrade**, not just billing hygiene. Keep Stripe-hosted
checkout for PCI scope.

## 17 — Observability & privacy-preserving telemetry

Breeze: minimal telemetry (privacy-good) but little production error visibility.

1. Corrigan-Gibbs & Boneh, *Prio: Private, Robust, Aggregate Statistics*, [NSDI 2017 / arXiv 1703.06255](https://arxiv.org/abs/1703.06255) → aggregate metrics with no per-user data.
2. *STAR: Distributed Secret Sharing for Private Threshold Aggregation* (Cloudflare), [CCS 2022 / eprint 2022/478](https://eprint.iacr.org/2022/478) → privacy-preserving crash/usage reporting.
3. *IETF PPM / DAP (Distributed Aggregation Protocol)* ([draft](https://datatracker.ietf.org/wg/ppm/about/)) → standardized private telemetry (Divvi Up).
4. [divviup/libprio-rs](https://github.com/divviup/libprio-rs) → Prio implementation reference.
5. *Differential Privacy* (Dwork & Roth) → formal noise bounds for any released stat.
6. *Sentry/crash-report PII risks* → scrub message content, IDs, tokens from error reports.
7. [getsentry/sentry] (self-hosted) → error tracking with strict scrubbing if used.
8. *Local-only debug logs* → Breeze's `_dbg` keeps logs client-side (good) — keep opt-in.
9. *OpenTelemetry* (server side) → Worker-side latency/error metrics without user PII.
10. *Health/uptime probes* → `/api/health` exists; add structured SLO monitoring.

**Improvements:** if any client telemetry is added, use **Prio/STAR/DAP** for
privacy-preserving aggregates only; **never** ship message content/IDs in error
reports (scrub); keep `_dbg` local + opt-in; add **server-side** OpenTelemetry on the
Worker (no user PII) for latency/error SLOs. Default to collecting *nothing* from
clients.

## 18 — Anti-censorship & blocking resistance

Breeze: single Cloudflare domain — a censor can block the domain/Cloudflare.

1. *TLS Encrypted Client Hello (ECH)* ([draft-ietf-tls-esni](https://datatracker.ietf.org/doc/draft-ietf-tls-esni/)) → hide the SNI so the relay domain isn't trivially blockable.
2. Frolov et al., *Conjure: Summoning Proxies from Unused Address Space*, [CCS 2019](https://censorbib.nymity.ch/pdf/Frolov2019a.pdf) → refraction networking for blocking resistance.
3. *Snowflake* (Tor) ([FOCI/PETS](https://www.bamsoftware.com/papers/snowflake/)) → **WebRTC-based** rendezvous — directly synergistic with Breeze's existing WebRTC stack.
4. [net4people/bbs](https://github.com/net4people/bbs) → censorship-circumvention community/knowledge base.
5. *Domain fronting* (deprecated by Google/AWS 2018) → note why it's no longer reliable; ECH/refraction are successors.
6. [keroserene/snowflake](https://github.com/keroserene/snowflake) / Tor Snowflake → reusable WebRTC broker design.
7. *Pluggable Transports spec* ([PT 2.1](https://github.com/Pluggable-Transports/Pluggable-Transports-spec)) → obfs4/meek interface to pluggable circumvention.
8. *Decoy/refraction* (TapDance, [arXiv]) → ISP-level circumvention.
9. *Multiple/rotating relay endpoints* → don't pin a single hostname; support custom relay URLs.
10. *Measurement: OONI* ([ooni.org](https://ooni.org/)) → detect where Breeze is blocked.

**Improvements:** enable **ECH** on the relay to resist SNI-based blocking; support
**user-configurable / rotating relay endpoints** (don't hardcode one host); evaluate a
**Snowflake-style WebRTC rendezvous** (reuses Breeze's WebRTC) for blocking-resistant
signaling; document realistic blocking-resistance limits; use **OONI** to monitor.

## 19 — Federation & interoperability

Breeze: closed ecosystem. Regulatory pressure (EU DMA) pushes E2EE interop.

1. **IETF MIMI** — *More Instant Messaging Interoperability using HTTPS + MLS* ([draft-ietf-mimi-protocol](https://datatracker.ietf.org/doc/draft-ietf-mimi-protocol/), [WG](https://datatracker.ietf.org/wg/mimi/about/)) → the emerging interop standard, **MLS-based**.
2. *draft-ietf-mimi-content* ([datatracker](https://datatracker.ietf.org/doc/draft-ietf-mimi-content/)) → interoperable message content format.
3. *EU DMA Art. 7 messaging interoperability* → gatekeepers must open E2EE messaging — the regulatory driver.
4. *RFC 9420 — MLS* → the interop ciphersuite (reinforces I14: adopting MLS positions Breeze for interop).
5. [matrix-org/matrix-spec](https://github.com/matrix-org/matrix-spec) → federation model + bridges as an interop path.
6. *XMPP (RFC 6120) + OMEMO* → mature federation reference.
7. *"A Playbook for E2EE Messaging Interoperability"* ([TechPolicy.Press](https://www.techpolicy.press/a-playbook-for-endtoend-encrypted-messaging-interoperability/)) → security pitfalls of interop (abuse, identity, weakest-link E2EE).
8. [matrix-org/matrix-appservice-bridge](https://github.com/matrix-org/matrix-appservice-bridge) → bridge architecture.
9. *Interop identity/discovery* → cross-provider key discovery needs key transparency (cat 7 / I11).
10. *Security caveats* → interop can dilute E2EE to the weakest participant; abuse/spam crosses trust boundaries.

**Improvements:** if interop becomes a goal, **adopt MLS (I14) and track MIMI** —
that's the standards-aligned path; weigh the **security dilution** of cross-provider
E2EE (document the stance); cross-provider identity needs **key transparency** (I11).
Near-term: a clean, versioned protocol boundary so a future bridge is feasible.

## 20 — Governance, compliance & threat-model documentation

Breeze: `SECURITY.md`, `SPEC.md`; no published formal threat model or external audit.

1. Abelson et al., *Keys Under Doormats* ([2015](https://dspace.mit.edu/handle/1721.1/97690)) → the case against lawful-access backdoors — Breeze's "no backdoor" stance, documented.
2. Abelson et al., *Bugs in Our Pockets (client-side scanning)* ([arXiv 2110.07450](https://arxiv.org/abs/2110.07450)) → why Breeze should stay CSS-free (also cat 6).
3. Unger et al., *SoK: Secure Messaging* ([S&P 2015](https://oaklandsok.github.io/papers/unger2015.pdf)) → a structured **threat-model framework** to publish.
4. *GDPR data-minimization / privacy-by-design* → Breeze stores little (good) — formalize a data-retention policy.
5. [ossf/scorecard](https://github.com/ossf/scorecard) → automated supply-chain posture scoring → add to CI.
6. *securitytxt (RFC 9116)* ([securitytxt.org](https://securitytxt.org/)) → publish `/.well-known/security.txt` for disclosure.
7. [OWASP/ASVS](https://github.com/OWASP/ASVS) → application-security verification checklist to self-assess against.
8. *Third-party audit precedent* (Signal/Cure53, Threema/Kudelski) → commission an external review of the protocol + client.
9. *Reproducible builds + transparency* (cat 8) → let auditors verify the shipped artifact.
10. *Coordinated disclosure & bug bounty* → formalize beyond `SECURITY.md`.

**Improvements:** publish a **formal threat model + trust assumptions** (who can do
what: relay, network, device); add **OpenSSF Scorecard** to CI and a
**`security.txt`**; document the **no-backdoor / no-client-side-scanning** stance
(Keys Under Doormats, Bugs in Our Pockets); self-assess against **OWASP ASVS**; plan a
**third-party audit** once the Part-A crypto fixes (I1–I3) land; formalize a data
-retention/minimization policy and coordinated disclosure.

---

## Round-2 takeaways (highest-leverage, product-level)

- **#11 Background Sync + persistent storage** and **#12 encrypted, preview-less push**
  — concrete reliability/privacy wins for the PWA, small effort.
- **#13 QR scan-to-verify as default** — a *human* out-of-band channel that closes the
  I1 first-contact MITM gap today, before full key transparency ships.
- **#16 anonymous paid-access tokens** — turns billing from a metadata *liability* into
  a privacy *feature* (payment unlinkable from messaging).
- **#18 ECH + user-configurable/rotating relays + Snowflake-style WebRTC rendezvous** —
  blocking resistance that reuses Breeze's existing WebRTC stack.
- **#20 publish a formal threat model + plan an external audit** — credibility step once
  the core crypto fixes land.

Cross-reference: Round 1 (`CATEGORY-RESEARCH.md`, cats 1–10) + `IMPROVEMENTS.md`
(I1–I20) cover protocol/security depth; Round 2 covers platform, UX, growth, ops,
ecosystem, and governance breadth.
