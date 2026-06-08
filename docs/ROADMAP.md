# Breeze — Prioritized Improvement Roadmap

> Consolidates the full improvement backlog into a ranked, dependency-ordered plan.
> Sources: `docs/IMPROVEMENTS.md` (I1–I20), `docs/CATEGORY-RESEARCH.md` (categories
> 1–10), `docs/CATEGORY-RESEARCH-2.md` (categories 11–20).
>
> Ranking = **security/correctness impact × (1/effort) × constraint-fit**, with hard
> **dependencies** respected. Effort: S ≤ ~1 day · M ~ days · L ~ weeks. New IDs
> prefixed `C` are category-only items (no `I#` yet).

## Status legend
- ✅ done · 🔜 next · ⬜ planned
- Foundation (test harness + CI + packaging) — ✅ done (commits on `claude/nice-ride-T6yb0`).

---

## P0 — Critical (close active holes; small, testable, no wire-break risk where possible)

| ID | Item | Effort | Why now | Dep |
|----|------|--------|---------|-----|
| I1 | Authenticated X3DH — sign + verify the pre-key | S | Closes an **active first-contact MITM**; voids the premise every Signal proof needs (ePrint 2016/1013). Wire-versioned (v5) w/ v4 read path. | tests ✅ | ✅ **module + worker done**: `src/crypto/ratchet.js` (Ed25519 sign/verify SPK + x3dhInitiator/Responder DH1-4 + MITM-defense, `tests/x3dh.test.js`); worker `handlePreKeyUpload` verifies sig (G2); **pending**: wire into index.html init (browser-validated) |
| I16 | Key commitment on AEAD (HKDF commitment tag) | S | AES-GCM isn't committing → "invisible salamanders" in group/sealed/multi-key paths (ePrint 2020/1456). | — | ✅ **done** in `src/crypto/ratchet.js` + `src/crypto/group.js` (cm tag + constant-time verify; also in group messages N2); port to index.html/sealed pending |
| I15 | Stop pre-encryption compression (1:1 `encryptFor`) | S | CRIME/BREACH-class length leak; partly defeats the 256-B padding. Pure removal. | — | 🔜 module: `ratchet.js` `compressMin:Infinity` default (off); index.html wiring pending (docs/INTEGRATION.md §G4) |
| I7 | Bound **+ time-expire** skipped-key cache | S | Lingering skipped keys = FS leak + DoS (ePrint 2018/1037). Count bound already exists; add TTL. | — | ✅ **done** in `src/crypto/ratchet.js` (1:1 TTL) + `src/crypto/group.js` (group TTL, both configurable); port to index.html pending |
| I20 | Known-answer test vectors (RFC/NIST/Wycheproof) | S–M | Catches HKDF-info/nonce/tag glue bugs incl. the I15/I16 class; slots into the new harness. | tests ✅ | ✅ **done** — `tests/kat.test.js` (HKDF RFC 5869, X25519 RFC 7748, AES-256-GCM NIST + tamper-reject) |

**P0 = one focused security sprint.** All S-effort, all unit-testable against
`src/crypto/ratchet.js` + `tests/`, and I15/I16/I7/I20 don't change the handshake.
I1 is wire-versioned with a v4 read path, so it's safe to roll out.

---

## P1 — High impact, in-constraint

| ID | Item | Effort | Why | Dep |
|----|------|--------|-----|-----|
| I2 | Group forward secrecy — ratchet chain **+ signing** key | S–M | One leak exposes all group msgs today (arXiv 2301.07045). | I20 | ✅ **done** in `src/crypto/group.js` (chain ratchet + I16 commitment + N2 per-msg Ed25519 auth + I7 TTL, `tests/group.test.js`); signing-key ratchet (auth FS) blocked by WebCrypto Ed25519 key-derivation; index.html port pending |
| I3 | Group PCS — epoch bump + redistribute on kick/leave | M | Removed members keep decrypting today (ePrint 2017/666). | I2 | ✅ **done** in `src/crypto/group.js` + worker (G3): `rotateEpoch` + epoch gate + `handleGroupKick` bumps epoch; kicked-member-blocked test; index.html client-side redistribution pending |
| I4 | Encrypt identity/signing keys at rest (app-lock) | M | Plaintext JWK in IndexedDB → XSS/forensics (ePrint 2024/887). | — | ✅ **done** in `src/crypto/atrest.js` (PBKDF2≥600k, btoa/atob browser-compat, wrapJWK/unwrapJWK/migrate/zeroBuffer, +10 tests); index.html loadIdentity port pending |
| C8 | Web-app integrity ("Code Verify" / SW hash-pin) | M | Biggest *unaddressed* web-E2EE threat: host can serve malicious JS. SW is the pin point. | — |
| C13 | QR **scan-to-verify** as default ceremony | S–M | Human out-of-band channel closes the I1 MITM gap *before* key transparency. | — |
| I19 | WebRTC: relay-only privacy default + STUN self-host | S | srflx still leaks public IP to peer by default (arXiv 2510.16168). | — |

---

## P2 — Privacy, abuse & backend hardening

| ID | Item | Effort | Why | Dep |
|----|------|--------|-----|-----|
| I5 | Optional + jittered receipts; relay batching | S–M | Sealed-sender deanonymization via receipt timing (NDSS'21). | — |
| I6 | Length-bucketed padding + optional cover traffic | S–M | Flat 256-B pad leaks size buckets (Loopix). | I15 | 🟡 **padding done**: `ratchet.js` already pads to 256-byte-aligned buckets; cover traffic (fake messages) is client-side |
| C10 | Durable Objects (rate-limit/presence/signaling) + WebSocket push | M–L | Fixes the per-isolate `_rateLimitMap` undercount **and** the KV write-budget ceiling; replaces polling. | — |
| C12 | Encrypted, preview-less push (RFC 8291) | S–M | Push service sees ciphertext only; no message preview. | — |
| I17 | Verifiable abuse reporting (Hecate / AMF franking) | M–L | Consensual reporting, no backdoor (USENIX'22). | I16 | ✅ **core + relay done**: `src/crypto/franking.js` + worker `/api/abuse/record`+`/api/abuse/report` (end-to-end test in `tests/worker.test.js`); sealed-sender sender-binding (Hecate asymmetric) + client send/report UI pending |
| I18 | Anonymous anti-abuse tokens (Privacy Pass/VOPRF) | M–L | Battery-friendly, unlinkable vs PoW. | — |
| C11 | Background Sync + persistent storage | S | Reliable offline send; no keystore eviction. | — |

---

## P3 — Strategic / larger investments

| ID | Item | Effort | Why | Dep |
|----|------|--------|-----|-----|
| I8 / I9 | PQXDH handshake → Triple-Ratchet (hybrid PQ) | L | Harvest-now-decrypt-later; recurring-KEM PCS. Needs vetted WASM ML-KEM. | I1 |
| I10 | Keep PQ auth deniable; soften deniability claims | S(doc)/L | Signature PQ-auth kills deniability (ePrint 2025/1090). | I8 |
| I11 | Key-transparency log (akd/CONIKS-lite on Worker) | M–L | Automated MITM detection beyond TOFU. | I1 | 🟡 **precursor done**: worker records SHA-256 IK history per user (`ktlog:`) and returns it on fetch; client-side rollover detection + full hash-chained log pending |
| I12 | Multi-device (Device Group Key + cross-signing) | L | Most-requested; relay never sees DGK. | C9, I4 |
| C9 | Encrypt message store at rest + CRDT sync | M–L | Extends at-rest beyond keys; enables I12. | I4 |
| I13 | PIN-based encrypted backup (SVR-lite) | M | Recovery (today: lose device = lose identity). | I4 |
| I14 | MLS/TreeKEM for large/long-lived groups | L | True group FS+PCS at O(log n); positions for interop. | I2/I3 |
| C5 | SFrame (RFC 9605) + SAS for calls | M–L | E2E media through any future SFU; call-MITM defense. | — |
| C16 | Anonymous paid-access tokens (private metadata bit) | M | Unlinks billing from messaging — a metadata-privacy win. | I18 |
| C18 | Anti-censorship: ECH + rotating relays + Snowflake rendezvous | M–L | Blocking resistance reusing the WebRTC stack. | — |
| C19 | MIMI/MLS interoperability (EU DMA) | L | Standards-aligned interop. | I14 |
| C20 | Publish formal threat model + external audit | M | Credibility once P0/P1 land. | P0/P1 |
| C14 | a11y in CI (axe-core/Lighthouse) + WCAG 2.2 | S–M | Adoption + inclusivity. | — |
| C15 | i18n: ICU MessageFormat + RTL + bidi sanitization | S–M | Scale past EN/JA; Trojan-Source safety. | — |

---

## Dependency graph (critical paths)

```
tests/CI ✅ ──► I1 ──► I8/I9 ──► I10
                 └──► I11
I16 ──► I17
I4 ──► C9 ──► I12
       └──► I13
I2 ──► I3 ──► I14 ──► C19
I15 ──► I6
I18 ──► C16
```

## Recommended Sprint 1 (security, ~1 week)
**I1 + I16 + I15 + I7 + I20.** All small, all land under the existing test harness,
and together they close the active MITM (I1), the invisible-salamanders exposure (I16),
the compression side-channel (I15), and the skipped-key FS leak (I7) — with KAT vectors
(I20) guarding the lot. I15/I16/I7/I20 are non-wire-breaking; I1 is wire-versioned with
a v4 read path.

## Sprint 2 (groups + at-rest, ~1–2 weeks)
**I2 + I3 + I4**, then **C13** (QR verify) and **I19** (relay-only default) as quick
UX/privacy wins.

## Then
Backend correctness/cost (**C10**), metadata hardening (**I5/I6/C12**), and the
strategic PQ/multi-device/transparency track (**I8→I11→I12**) as larger efforts.

---

## How this maps back to the research
- **Crypto depth** (I1–I20): `docs/IMPROVEMENTS.md` + `CATEGORY-RESEARCH.md` cats 1–3.
- **Transport/media** (C5, I19): cats 4–5.
- **Trust & safety** (I16–I18): cat 6.
- **Key lifecycle** (I4, I11–I13): cat 7.
- **Client supply-chain** (C8): cat 8.
- **Storage/sync** (C9): cat 9.
- **Backend** (C10): cat 10.
- **Product surface** (C11–C20): `CATEGORY-RESEARCH-2.md` cats 11–20.
