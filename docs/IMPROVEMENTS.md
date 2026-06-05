# Breeze — Improvement Backlog from Peer Software & Academic Literature

> Method: Breeze's actual internals were compared against peer secure-messengers
> (Signal/WhatsApp/iMessage, SimpleX, Session, Briar, Cwtch, Matrix/MLS, Threema,
> Status) and against arXiv / IACR ePrint research. Each item below names the
> **threat**, the **peer precedent**, the **academic citation**, the **Breeze
> code locus**, an **effort** estimate (S ≤ ~1 day · M ~ days · L ~ weeks), and
> whether it **fits** Breeze's constraints (serverless Cloudflare Worker +
> single-file vanilla JS, no build step, no new runtime deps).
>
> Line numbers are approximate (the app is one ~13k-line file); functions are
> named so they stay findable.

## Capability comparison (Breeze vs peers)

| Capability | Breeze today | Peer practice |
|---|---|---|
| First-contact authentication | **Broken** — `initSession` does plain `DH(IK_A,IK_B)`; signed pre-key uploaded **unsigned** and never verified → relay can MITM. TOFU only. | Signal X3DH/PQXDH, WhatsApp, Matrix, Threema: SPK is **signed by the identity key and verified** before the first DH. |
| Post-quantum | None | Signal **PQXDH** + **Triple Ratchet (SPQR)**; Apple **iMessage PQ3** — hybrid X25519 + ML-KEM, recurring KEM in the ratchet. |
| Group forward secrecy | **None** — sender key never ratchets | Signal Sender Keys hash-ratchet the chain key per message; MLS/TreeKEM FS+PCS. |
| Group member removal (PCS) | **Broken** — epoch never bumps on kick | MLS Remove / Sender-Keys epoch bump + fresh key redistribution. |
| Sender-metadata hiding | "Sealed Sender" relay | Signal Sealed Sender (sender cert + delivery token) — but see deanonymization below. |
| Receiver-metadata / unlinkability | Stable recipient id; immediate receipts | SimpleX unidirectional unlinkable queues; jittered/optional receipts. |
| Network-layer anonymity | None (relay+WebRTC see IP) | Session (onion), Briar/Cwtch (Tor). *Out of reach for this stack.* |
| Key transparency | None (TOFU) | WhatsApp/Apple auditable key directory; CONIKS/SEEMless/Parakeet. |
| At-rest key protection | **Plaintext JWK in IndexedDB** | Signal wraps DB key (Keychain/Keystore/Secure Enclave). |
| Backup / recovery | None | Signal SVR2/SVR3 (PIN + enclave guess-limit). |
| Multi-device | None | Threema Ibex Device Group Key; Matrix cross-signing. |
| Traffic-analysis resistance | Flat 256-B padding | Bucketed padding + Loopix-style cover traffic. |

---

## Tier 1 — Fix a known hole (high impact, in-constraint)

### I1. Authenticate first contact: sign & verify the pre-key bundle  ·  S · fits
- **Threat:** the relay (or any active MITM) can inject its own pre-key on first
  contact; TOFU only detects *changes*, not the initial impersonation. This voids
  the assumption every Signal-security proof depends on.
- **Peer:** Signal X3DH — SPK signed by identity key, verified by initiator.
- **Academic:** Cohn-Gordon et al., *A Formal Security Analysis of the Signal
  Protocol*, IACR ePrint [2016/1013](https://eprint.iacr.org/2016/1013) — security
  is **conditional on the SPK signature being verified**.
- **Breeze locus:** client `prekey/upload` (~index.html:4451-4465) omits
  `signedPreKeySig` and discards the SPK/OTP private keys; `initSession`
  (~4569) never fetches the bundle; worker `handlePreKeyUpload`
  (~_worker.js:975) stores an unverified sig. Fix: Ed25519-sign `spkPub` with the
  existing `_signingKey`; persist SPK/OTP privates; worker verifies on upload;
  initiator verifies before the first DH (abort → existing key-change banner).
- *Already scoped as Phase 2a in the deep plan; this is the #1 priority.*

### I2. Group forward secrecy: hash-ratchet the sender key (chain **and** signing)  ·  S–M · fits
- **Threat:** one compromise of a sender key exposes **all** past and future group
  messages; a leaked signing key forges arbitrarily.
- **Peer:** Signal Sender Keys advance the chain key by a one-way hash per message.
- **Academic:** Balbás, Collins, Gajland, *Analysis & Improvements of the Sender
  Keys Protocol*, arXiv [2301.07045](https://arxiv.org/pdf/2301.07045) / ePrint
  [2023/1385](https://eprint.iacr.org/2023/1385) — stock Sender Keys gives only
  *weak* FS and no PCS; their O(1) fixes are (a) **hash-ratchet the chain key**
  and (b) **ratchet the per-message signing key**.
- **Breeze locus:** `getGroupSenderKey`/`encryptGroupMsg`/`decryptGroupMsg`
  (~index.html:4980-5028) use `HKDF(raw, counter)` with a static `raw`. Replace
  with `msgKey=HKDF(ck,'group-msg')`, `ck=HKDF(ck,'group-chain')`, drop used keys;
  add an ephemeral signing chain.
- *Extends Phase 2b with the signing-key ratchet (new from the literature).*

### I3. Group post-compromise removal: epoch bump + redistribute on kick/leave  ·  M · fits
- **Threat:** a removed/compromised member keeps decrypting new group traffic
  indefinitely.
- **Peer:** MLS Remove proposal; Sender-Keys epoch rotation.
- **Academic:** Cohn-Gordon et al., *On Ends-to-Ends Encryption*, ePrint
  [2017/666](https://eprint.iacr.org/2017/666) (CCS'18) — PCS requires **re-keying
  on membership change**.
- **Breeze locus:** `distributeSenderKey` (~5032) ships `epoch` but it never
  increments; worker `handleGroupKick` (~_worker.js:734) drops the member but
  bumps no epoch. Fix: admin bumps epoch, generates a fresh chain key, redistributes
  to remaining members; messages carry `ep`; worker returns the new epoch.
- *Phase 2b.*

### I4. Encrypt identity/signing keys at rest (opt-in app-lock)  ·  M · fits
- **Threat:** XSS or device forensics reads the plaintext private JWKs straight
  out of IndexedDB.
- **Peer:** Signal wraps the DB key via OS keystore / Secure Enclave.
- **Academic:** Signal, *Secret Key Recovery in a Global-Scale E2E System*, ePrint
  [2024/887](https://eprint.iacr.org/2024/887) — derive the at-rest key from a
  memory-hard KDF; guess-limit PIN unlock.
- **Breeze locus:** `loadIdentity` (~4404), key store (~4444), signing key
  (~3852) all hold plaintext `priv`. Wrap with AES-GCM under a PBKDF2(≥600k)- or
  Argon2id(WASM)-derived key; consider **WebAuthn/passkey PRF** for unlock; migrate
  existing plaintext records on enable.
- *Phase 2c.*

---

## Tier 2 — Metadata-privacy reality check (Breeze over-claims here)

### I5. Blunt sealed-sender deanonymization: optional + jittered receipts, relay batching  ·  S–M · fits
- **Threat:** sealed sender hides the *sender field* but the relay still sees
  **recipient + timing**; immediate auto-receipts enable a statistical-disclosure
  attack that links pairs and deanonymizes groups.
- **Peer:** Signal acknowledges this; SimpleX/mixnets jitter and batch.
- **Academic:** Martiny et al., *Improving Signal's Sealed Sender*, NDSS 2021
  ([pdf](https://www.ndss-symposium.org/wp-content/uploads/ndss2021_1C-4_24180_paper.pdf)).
- **Breeze locus:** delivery/read-receipt send path + `sealed/poll`
  (~_worker.js sealed handlers). Make receipts **optional and randomly delayed**;
  add jitter/batching to relay delivery. Document that sealed sender ≠ unlinkability.

### I6. Bucketed padding + optional cover traffic  ·  S–M · fits
- **Threat:** a flat 256-B pad still leaks message-size buckets and send timing to
  the relay / a passive observer.
- **Peer:** SimpleX/Session bucket sizes; Loopix adds cover traffic.
- **Academic:** Piotrowska et al., *The Loopix Anonymity System*, arXiv
  [1703.00536](https://arxiv.org/abs/1703.00536) — Poisson cover traffic +
  per-message delays defeat a global passive adversary.
- **Breeze locus:** `CONFIG.MSG_PAD_BOUNDARY=256` and the padding in `encryptFor`
  (~4620) / `encryptGroupMsg`. Use size buckets (256/1024/4096/…) and optional
  decoy/keepalive sends. (Full unobservability needs a mixnet — a non-goal here.)

### I7. Bound **and time-expire** the skipped-message-key cache  ·  S · fits
- **Threat:** skipped keys retained indefinitely are both a DoS amplifier and a
  forward-secrecy leak (old keys sitting in storage).
- **Academic:** Alwen, Coretti, Dodis, *The Double Ratchet: Security Notions,
  Proofs, and Modularization*, ePrint [2018/1037](https://eprint.iacr.org/2018/1037)
  — FS comes from the symmetric chain; lingering skipped keys defeat it.
- **Breeze locus:** `decryptFrom` skipped-key logic (~4682-4704) already bounds
  count (`MAX_SKIP`/`MAX_GAP`, added earlier) but has **no time expiry**. Add a TTL
  and prune on session load.

---

## Tier 3 — Post-quantum (medium-term, partial fit)

### I8. Hybrid PQXDH handshake (X25519 + ML-KEM-768/1024)  ·  L · partial
- **Threat:** harvest-now-decrypt-later against the handshake.
- **Peer:** Signal PQXDH; Apple PQ3.
- **Academic:** Fiedler & Günther, *Security Analysis of PQXDH*, ePrint
  [2024/702](https://eprint.iacr.org/2024/702); Bhargavan et al. formal
  verification (USENIX'24) — **bind the KEM ciphertext into the transcript/AD**.
  Prerequisite: I1 (the SPK must actually be signed/verified).
- **Fit caveat:** needs a vetted single-file JS/WASM ML-KEM — tension with
  "no new deps / no build." Treat the ML-KEM blob as the one allowed exception.

### I9. Hybrid PQ ratchet via intermittent KEM (Triple Ratchet / PQ3 pattern)  ·  L · partial
- **Threat:** a one-shot PQ handshake gives no post-quantum PCS for long sessions.
- **Academic:** Signal Labs, *Triple Ratchet*, ePrint
  [2025/078](https://eprint.iacr.org/2025/078); Basin et al., *Formal Analysis of
  iMessage PQ3*, ePrint [2024/1395](https://eprint.iacr.org/2024/1395) — XOR a PQ
  secret into the HKDF chain with **recurring (not per-message) KEM** to stay within
  the padding budget.
- **Breeze locus:** the HKDF chain in `kdfChain`/`dhRatchetStep`. Do I8 first.

### I10. Don't break deniability when going PQ; don't over-claim it  ·  S (doc) / L (crypto) · fits
- **Academic:** Katsumata et al., *Comprehensive Deniability Analysis*, ePrint
  [2025/1090](https://eprint.iacr.org/2025/1090) — signature-authenticated PQ
  handshakes destroy deniability; use KEM/deniable-ring-signature auth. Collins et
  al., *Real-World Deniability in Messaging*, ePrint
  [2023/403](https://eprint.iacr.org/2023/403) — cryptographic deniability is
  practically moot; the real lever is **local transcript editing**.
- **Action:** keep PQ auth KEM-based; soften any deniability claims in docs;
  optionally allow local history editing.

---

## Tier 4 — Trust-model upgrades (strategic, higher effort)

### I11. Lightweight key-transparency log (CONIKS-lite) on the Worker  ·  M–L · fits
- **Threat:** a malicious relay silently swaps a contact's key at first contact —
  TOFU can't catch what it never saw.
- **Peer:** WhatsApp/Apple auditable key directory.
- **Academic:** CONIKS [2014/1004](https://eprint.iacr.org/2014/1004); SEEMless
  [2018/607](https://eprint.iacr.org/2018/607); Parakeet
  [2023/081](https://eprint.iacr.org/2023/081).
- **Breeze locus:** append-only KV log of `(userId → key, sig, ts)` with a Merkle
  head clients pin; auto-warn on inclusion-proof mismatch. Do after I1.

### I12. Multi-device via Device Group Key + cross-signing  ·  L · fits
- **Peer:** Threema Ibex (random DGK transferred device-to-device; mediator never
  sees it); Matrix cross-signing (master/self/user-signing keys).
- **Breeze locus:** new linking flow over the existing E2E channel; worker relays
  opaque blobs only. Enables the much-requested second device without trusting the
  relay.

### I13. PIN-based encrypted backup (SVR-lite, no enclave)  ·  M · fits
- **Peer/Academic:** Signal SVR2 ([repo](https://github.com/signalapp/SecureValueRecovery2)),
  ePrint [2024/887](https://eprint.iacr.org/2024/887).
- **Breeze locus:** client Argon2/HKDF-stretch a PIN → encrypt the identity bundle
  → store ciphertext in KV with a **worker-enforced guess-rate-limit + lockout**.
  Weaker than SGX but enables recovery (today: lose device = lose identity).

### I14. (Strategic) MLS/TreeKEM for large/long-lived groups  ·  L · fits-ish
- **Academic:** RFC 9420; ETK [2025/229](https://eprint.iacr.org/2025/229);
  Quarantined-TreeKEM [2023/1903](https://eprint.iacr.org/2023/1903) — O(log n)
  FS+PCS, but **PCS only heals once every member updates** → force periodic key
  updates and surface stale-member warnings.
- Consider only if groups grow beyond what ratcheted Sender Keys serve well.

---

## Non-goals (genuinely out of reach for Cloudflare-Worker + browser)
- **Onion routing / Tor transport** (Session, Briar, Cwtch) — needs a node network.
- **Offline/mesh transport** over Bluetooth/Wi-Fi Direct (Briar) — needs native.
- **SGX/TEE-backed SVR** — no enclave available; I13 is the in-reach approximation.
- **Full mixnet unobservability** (Nym/Loopix) — I5/I6 are the achievable subset.

## Suggested execution order (impact ÷ effort)
1. **I1** sign/verify pre-key (closes active MITM) — *do first; PQ depends on it.*
2. **I2 + I3** group FS + epoch-on-kick.
3. **I4** at-rest key encryption.
4. **I7** skipped-key TTL · **I5** receipt jitter/batching · **I6** bucketed padding.
5. **I11** key-transparency log.
6. **I8 → I9** PQXDH then hybrid PQ ratchet (with I10 deniability care).
7. Strategic: **I12** multi-device, **I13** PIN backup, **I14** MLS for big groups.

> Note on sources: primary hosts (signal.org/docs, some PDFs) intermittently
> returned HTTP 403 to the fetch tool during research; cited URLs are the canonical
> primary sources (IACR ePrint / arXiv / RFC / vendor engineering blogs) verified to
> resolve.
