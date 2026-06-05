# Breeze — Category-by-Category Research & Improvements

> Goal (per `/loop`): enumerate **10 product categories** of Breeze and, for each,
> gather ~10 related references from **arXiv** and **GitHub** and extract concrete
> improvement points. Complements `docs/IMPROVEMENTS.md` (items I1–I20), which is
> referenced where relevant. Effort tags: S ≤ ~1 day · M ~ days · L ~ weeks.

## Category index & status

| # | Category | Status |
|---|----------|--------|
| 1 | 1:1 cryptographic protocol & key agreement | ✅ done |
| 2 | Secure group messaging | ✅ done |
| 3 | Metadata privacy, anonymity & traffic analysis | ✅ done |
| 4 | P2P transport & connectivity (WebRTC/NAT/ICE) | ✅ done |
| 5 | Real-time media — voice/video calls | ✅ done |
| 6 | Trust & safety in E2EE — abuse, spam, moderation | ✅ done |
| 7 | Key lifecycle — multi-device, backup, transparency | ✅ done |
| 8 | Web client security & supply-chain integrity | ✅ done |
| 9 | Local-first storage & sync (offline, CRDT, search) | ✅ done |
| 10 | Serverless edge backend — scale, cost, reliability | ✅ done |

---

## 1 — 1:1 cryptographic protocol & key agreement

Breeze: X25519+Ed25519, AES-256-GCM, HKDF-SHA256, Double Ratchet; X3DH only partial
(unsigned/unverified pre-key); no post-quantum. Cross-ref: I1, I7, I8, I9, I10, I16, I20.

**arXiv / IACR ePrint**
1. Cohn-Gordon et al., *Formal Security Analysis of Signal*, [2016/1013](https://eprint.iacr.org/2016/1013) → security is conditional on **verifying the signed pre-key** — Breeze's #1 fix (I1).
2. Alwen–Coretti–Dodis, *The Double Ratchet: Security Notions & Modularization*, [2018/1037](https://eprint.iacr.org/2018/1037) → PCS comes only from the DH ratchet; **bound & time-expire skipped keys** (I7).
3. Fiedler–Günther, *Security Analysis of PQXDH*, [2024/702](https://eprint.iacr.org/2024/702) → hybrid X25519+ML-KEM handshake; **bind KEM ciphertext into HKDF AD** (I8).
4. Signal Labs, *Triple Ratchet (SPQR)*, [2025/078](https://eprint.iacr.org/2025/078) → **intermittent KEM** mixed into the chain for PQ-FS/PCS at low bandwidth (I9).
5. Basin et al., *Formal Analysis of iMessage PQ3*, [2024/1395](https://eprint.iacr.org/2024/1395) → recurring KEM gives PQ post-compromise security (I9).
6. Katsumata et al., *Comprehensive Deniability Analysis (X3DH/PQXDH)*, [2025/1090](https://eprint.iacr.org/2025/1090) → use **KEM/ring-sig auth**, not signatures, to keep PQ deniability (I10).
7. Dodis et al., *Invisible Salamanders / Encryptment*, [2019/016](https://eprint.iacr.org/2019/016) → AES-GCM isn't key-committing; **add a commitment tag** (I16).

**GitHub (reference implementations to test/learn against)**
8. [signalapp/libsignal](https://github.com/signalapp/libsignal) → canonical X3DH/PQXDH/Double-Ratchet; mine its test vectors for `src/crypto/ratchet.js`.
9. [matrix-org/vodozemac](https://github.com/matrix-org/vodozemac) → audited Rust Olm/Megolm ratchet — design reference for a vetted ratchet.
10. [cryspen/libcrux](https://github.com/cryspen/libcrux) / [PQClean ML-KEM](https://github.com/PQClean/PQClean) → formally-verified ML-KEM for the PQXDH blob (the one allowed WASM dep).
11. [C2SP/wycheproof](https://github.com/C2SP/wycheproof) → known-answer + malformed-input vectors for HKDF/AES-GCM/X25519 (I20).

**Improvement points:** verify the signed pre-key (I1); bound+TTL skipped keys (I7);
adopt PQXDH→Triple-Ratchet with KEM-bound AD and deniable auth (I8/I9/I10);
key-commitment tag on every AEAD (I16); embed KAT vectors (I20).

---

## 2 — Secure group messaging

Breeze: Sender Keys, O(1) fanout, but **no chain ratchet (no FS)** and **no epoch bump on kick (no PCS)**. Cross-ref: I2, I3, I14.

**arXiv / IACR ePrint**
1. Balbás–Collins–Gajland, *Analysis & Improvements of Sender Keys*, [2301.07045](https://arxiv.org/abs/2301.07045) / [2023/1385](https://eprint.iacr.org/2023/1385) → **hash-ratchet the chain key + ratchet the signing key** (I2).
2. Cohn-Gordon et al., *On Ends-to-Ends Encryption (Sender Keys model)*, [2017/666](https://eprint.iacr.org/2017/666) → PCS requires **re-key on membership change** (I3).
3. *RFC 9420 — Messaging Layer Security (MLS/TreeKEM)* ([datatracker](https://datatracker.ietf.org/doc/rfc9420/)) → O(log n) FS+PCS groups (I14).
4. *External-Operations TreeKEM (ETK) & MLS security*, [2025/229](https://eprint.iacr.org/2025/229) → safe external joins/admin ops.
5. *Quarantined TreeKEM*, [2023/1903](https://eprint.iacr.org/2023/1903) → **inactive members block PCS healing** → force periodic updates / quarantine.
6. Alwen et al., *CoCoA / Server-Aided Continuous Group Key Agreement* (e.g. [2022/251](https://eprint.iacr.org/2022/251)) → bandwidth-efficient group updates at scale.
7. Chase–Perrin–Zaverucha, *zkgroup / anonymous credentials for private groups*, [2019/1416](https://eprint.iacr.org/2019/1416) → **anonymous group membership** (hide the member list from the relay).

**GitHub**
8. [openmls/openmls](https://github.com/openmls/openmls) → production MLS reference for an eventual I14 migration.
9. [cisco/mlspp](https://github.com/cisco/mlspp) → C++ MLS for interop/test vectors.
10. [signalapp/libsignal (zkgroup)](https://github.com/signalapp/libsignal) → anonymous group-membership credential design.
11. [matrix-org/matrix-rust-sdk](https://github.com/matrix-org/matrix-rust-sdk) (Megolm) → real-world sender-key group ratchet to compare.

**Improvement points:** ratchet chain+signing keys (I2); epoch bump + redistribution
on kick/leave (I3); periodic forced updates & stale-member warnings (Quarantined-TreeKEM);
consider MLS for large/long-lived groups (I14); explore zkgroup-style anonymous
membership so the Worker can't enumerate a group's members.

---

## 3 — Metadata privacy, anonymity & traffic analysis

Breeze: "Sealed Sender" relay + 256-B padding; relay still sees recipient+timing. Cross-ref: I5, I6, I15, I19.

**arXiv / academic**
1. Martiny et al., *Improving Signal's Sealed Sender*, [NDSS 2021](https://www.ndss-symposium.org/wp-content/uploads/ndss2021_1C-4_24180_paper.pdf) → receipt-timing **statistical disclosure** deanonymization → jitter/optional receipts (I5).
2. Piotrowska et al., *The Loopix Anonymity System*, [1703.00536](https://arxiv.org/abs/1703.00536) → Poisson cover traffic + per-hop delays (I6).
3. Diaz et al., *The Nym Network* (mixnet) ([nym whitepaper](https://nymtech.net/nym-whitepaper.pdf)) → incentivized mixnet — possible transport for high-threat users.
4. Angel–Setty, *Pung: Unobservable communication (PIR)*, [OSDI 2016](https://www.usenix.org/conference/osdi16/technical-sessions/presentation/angel) → fully metadata-private mailbox via PIR.
5. Cheng et al., *Talek: PIR Messaging*, [SOSP/ePrint 2016/1141](https://eprint.iacr.org/2016/1141) → practical private group messaging.
6. van den Hooff et al., *Vuvuzela* & *Karaoke* ([OSDI 2018](https://www.usenix.org/conference/osdi18/presentation/lazar)) → differential-privacy bounds on communication metadata.
7. Kelsey, *Compression & Information Leakage of Plaintext*, FSE 2002 → **stop compressing message bodies** (I15).

**GitHub**
8. [simplex-chat/simplex-chat](https://github.com/simplex-chat/simplex-chat) → no-user-ID unidirectional **unlinkable queues** — strongest deployable metadata model.
9. [nymtech/nym](https://github.com/nymtech/nym) → mixnet client for an optional high-anonymity transport.
10. [oxen-io/session-*](https://github.com/oxen-io) → onion-routed delivery (out of stack reach, but design reference).
11. [brave/brave-browser WebRTC mDNS] / [w3c/webrtc-pc](https://github.com/w3c/webrtc-pc) → ICE candidate IP-handling (I19).

**Improvement points:** optional + randomly-delayed receipts and relay batching (I5);
length-bucketed padding + optional cover traffic (I6); drop pre-encryption compression
(I15); relay-only default for IP privacy (I19); longer-term, evaluate a SimpleX-style
unlinkable-queue relay redesign or an optional Nym transport for high-threat users.

---
## 4 — P2P transport & connectivity (WebRTC / NAT / ICE)

Breeze: WebRTC DataChannels + Cloudflare relay fallback (dual-path); STUN
(Google/Mozilla) + optional TURN; backpressure via `DC_BUFFER_MAX/LOW`;
heartbeat ping/pong → ICE restart; suppresses non-mDNS host candidates. Already
fairly mature — focus is incremental robustness.

**IETF / academic**
1. *RFC 8445 — ICE* ([rfc-editor](https://www.rfc-editor.org/rfc/rfc8445)) → connectivity-check state machine; baseline for diagnosing failed P2P.
2. *RFC 8838 — Trickle ICE* ([rfc-editor](https://www.rfc-editor.org/rfc/rfc8838)) → send candidates incrementally → **lower call/connect setup latency**; confirm Breeze trickles rather than waiting for full gathering.
3. *RFC 8831 / 8832 — WebRTC Data Channels over SCTP & DCEP* ([rfc 8831](https://www.rfc-editor.org/rfc/rfc8831)) → ordered/unordered + reliability config; use **unordered+partial-reliability** for real-time, reliable for files.
4. *RFC 8656 (TURN) / RFC 8489 (STUN)* → relay fallback; TURN cost scales with relayed traffic (informs item 10).
5. *Google Congestion Control (GCC)*, draft-ietf-rmcat-gcc + transport-wide-cc → **bandwidth estimation for large DataChannel transfers** (files), not just media.
6. *Perfect Negotiation* pattern (W3C WebRTC §, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation)) → **glare-free renegotiation** (polite/impolite peer) — eliminates offer/answer races on reconnection.

**GitHub**
7. [feross/simple-peer](https://github.com/feross/simple-peer) → minimal, battle-tested WebRTC wrapper — reference for connection lifecycle/edge cases.
8. [libp2p/specs (WebRTC)](https://github.com/libp2p/specs/tree/master/webrtc) → **WebRTC-direct + certhash** enables browser P2P with *no* dedicated signaling server — reduces relay dependence.
9. [pion/webrtc](https://github.com/pion/webrtc) → well-documented Go stack; reference for a future SFU/relay or server-side peer.
10. [libp2p hole-punching (DCUtR)](https://github.com/libp2p/specs/blob/master/relay/DCUtR.md) + [Tailscale "How NAT traversal works"](https://tailscale.com/blog/how-nat-traversal-works) → practical NAT-traversal success techniques (simultaneous open, relay-assisted hole punching).
11. [w3c/webtransport](https://github.com/w3c/webtransport) → WebTransport over HTTP/3 — an alternative low-latency relay transport to evaluate vs the current Worker fetch relay.

**Improvement points:** adopt the **Perfect Negotiation** pattern for race-free
reconnect; verify **trickle ICE** is used; tune DataChannel reliability per traffic
type (unordered/partial for chat presence, reliable for files); add **GCC-style flow
control** for big file transfers; offer **connection migration** on network change
(beyond ICE restart); evaluate **libp2p WebRTC-direct/certhash** to cut signaling
dependence and **WebTransport** as a relay-transport upgrade. (Backpressure and ICE
restart are already implemented — keep.)

## 5 — Real-time media — voice/video calls

Breeze: pure P2P 1:1 calls over WebRTC (DTLS-SRTP), per-session ECDSA cert, RTT/quality
display. 1:1 media is already E2E hop-free; gaps appear for **group calls** and
**call authentication**.

**IETF / academic**
1. *RFC 8826 / 8827 — WebRTC Security (Architecture)* ([rfc 8827](https://www.rfc-editor.org/rfc/rfc8827)) → the trust model; confirms 1:1 DTLS-SRTP is E2E only without an SFU.
2. *RFC 5764 — DTLS-SRTP* ([rfc-editor](https://www.rfc-editor.org/rfc/rfc5764)) → keying for SRTP; what Breeze relies on today.
3. **RFC 9605 — SFrame** ([rfc-editor](https://www.rfc-editor.org/rfc/rfc9605)) → **E2E media that survives an SFU/relay** (server sees only metadata) — required if Breeze ever adds group calls or server-mixed media.
4. *W3C WebRTC Encoded Transform / Insertable Streams* ([spec](https://www.w3.org/TR/webrtc-encoded-transform/)) → the **browser mechanism** to apply SFrame in a vanilla-JS app (no native code).
5. *RFC 6189 — ZRTP* ([rfc-editor](https://www.rfc-editor.org/rfc/rfc6189)) → **Short Authentication String (SAS)**: verbal/visual call-MITM defense independent of the identity-key store — strong defense-in-depth.
6. *RFC 6716 — Opus* + DTX → bandwidth-adaptive audio; enable **DTX** to cut silence bandwidth.
7. *RFC 8627 (FlexFEC) / RFC 2198 (RED)* → **loss resilience** for lossy mobile networks.
8. *MLS for group-call keys* (RFC 9420 + SFrame), as used by Element Call → scalable group-call key management.

**GitHub**
9. [w3c/webrtc-encoded-transform samples](https://github.com/w3c/webrtc-encoded-transform) / [WebRTC samples e2ee](https://github.com/webrtc/samples) → working Insertable-Streams E2EE demo to copy.
10. [jitsi/jitsi-meet](https://github.com/jitsi/jitsi-meet) → production E2EE group calls via insertable streams — closest reference design.
11. [sframe-wg/sframe](https://github.com/sframe-wg/sframe) / [cisco/libsframe] → SFrame reference implementations.

**Improvement points:** keep 1:1 DTLS-SRTP (already E2E); add a **ZRTP-style SAS**
for call authentication (defends against identity-key compromise/MITM on calls);
if/when group or SFU-mixed calls are added, use **SFrame via Encoded Transform** to
keep media E2E through the server, with **MLS** for group-call keys; adopt
**transport-cc/GCC** adaptive bitrate, **FEC/RED** for loss, and **Opus DTX** to
reduce bandwidth.

## 6 — Trust & safety in E2EE — abuse, spam, moderation

Breeze: PoW + Worker rate limits; no abuse reporting; no content scanning (a feature,
not a bug). Cross-ref: I16, I17, I18. Principle: preserve E2EE while enabling
*consensual* reporting.

**arXiv / academic**
1. Grubbs–Lu–Ristenpart, *Message Franking via Committing AEAD*, [2017/664](https://eprint.iacr.org/2017/664) → verifiable reporting without plaintext escrow (I17).
2. Tyagi et al., *Asymmetric Message Franking*, [2019/565](https://eprint.iacr.org/2019/565) → franking compatible with **sealed sender**.
3. Issa–Alhaddad–Varia, *Hecate*, [2021/1686](https://eprint.iacr.org/2021/1686) → fast sealed-sender abuse reporting + source tracing, keeps deniability for unreported msgs.
4. Tyagi–Miers–Ristenpart, *Traceback for E2E Messaging*, [2019/981](https://eprint.iacr.org/2019/981) → trace virally-forwarded abusive content without breaking E2E.
5. Davidson et al., *Privacy Pass*, [PETS 2018](https://petsymposium.org/2018/files/papers/issue3/popets-2018-0026.pdf) → **anonymous anti-abuse tokens** vs CPU-taxing PoW (I18).
6. Albertini et al., *Abuse & Fix AE Without Key Commitment*, [2020/1456](https://eprint.iacr.org/2020/1456) → committing-AEAD fix that franking depends on (I16).
7. Abelson et al., *Bugs in Our Pockets: Risks of Client-Side Scanning*, [arXiv 2110.07450](https://arxiv.org/abs/2110.07450) → why CSS is dangerous → **keep Breeze CSS-free**, document the stance.
8. Struppek et al., *Learning to Break Deep Perceptual Hashing (NeuralHash)*, [arXiv 2111.06628](https://arxiv.org/abs/2111.06628) → perceptual-hash scanning is evadable/forgeable — reinforces the anti-CSS position.

**GitHub**
9. [raphaelrobert/privacypass](https://github.com/raphaelrobert/privacypass) / [cloudflare/pat-app](https://github.com/cloudflare/pat-app) → Privacy Pass / Private Access Token references for the Worker issuer.
10. [matrix-org/mjolnir](https://github.com/matrix-org/mjolnir) → community **policy/ban lists** — opt-in, decentralized moderation for groups (no central authority).
11. [signalapp/libsignal](https://github.com/signalapp/libsignal) → committing-AEAD / franking primitives reference.

**Improvement points:** add **committing AEAD** (I16) → **AMF/Hecate franking** for
verifiable, backdoor-free reporting (I17); **anonymous tokens** to complement PoW
(I18); user-side **block/mute + report-with-proof**; opt-in **policy lists**
(mjolnir-style) for group moderation; explicitly **reject client-side scanning** and
say so in SECURITY.md (Abelson/Struppek).

## 7 — Key lifecycle — multi-device, backup, transparency

Breeze: single device; keys plaintext at rest; pure TOFU. Cross-ref: I4, I11, I12, I13.

**arXiv / academic**
1. Melara et al., *CONIKS*, [2014/1004](https://eprint.iacr.org/2014/1004) → privacy-preserving verifiable key directory (lightweight KT) (I11).
2. Chase et al., *SEEMless*, [2018/607](https://eprint.iacr.org/2018/607) → scalable append-only key transparency.
3. Malvai et al., *Parakeet*, [2023/081](https://eprint.iacr.org/2023/081) → production-scale KT (deployed by WhatsApp).
4. Signal, *Secret Key Recovery (SVR2/3)*, [2024/887](https://eprint.iacr.org/2024/887) → PIN backup with enclave guess-limits (I13).
5. Unger et al., *SoK: Secure Messaging*, [IEEE S&P 2015](https://oaklandsok.github.io/papers/unger2015.pdf) → framework for trust establishment + multi-device trade-offs.
6. *Threema Ibex multi-device* ([blog](https://threema.com/en/blog/ibex)) → **Device Group Key** the server never sees (I12).
7. *Matrix cross-signing* ([spec](https://spec.matrix.org/latest/client-server-api/#cross-signing)) → master/self/user-signing keys endorse new devices (I12).

**GitHub**
8. [google/keytransparency](https://github.com/google/keytransparency) → reference KT server.
9. [facebook/akd](https://github.com/facebook/akd) → Auditable Key Directory (the library behind WhatsApp KT) — directly adaptable to a Worker+KV log.
10. [signalapp/SecureValueRecovery2](https://github.com/signalapp/SecureValueRecovery2) → SVR2 design for PIN backup.
11. [matrix-org/vodozemac](https://github.com/matrix-org/vodozemac) → cross-signing + device-key handling reference.

**Improvement points:** encrypt keys at rest (I4); **multi-device via DGK +
cross-signing** (I12); **PIN-based encrypted backup** with Worker-enforced
guess-limit (I13); **akd/CONIKS-style key-transparency log** on the Worker so a
malicious relay can't silently swap keys (I11). Order: I4 → I11 → I12/I13.

## 8 — Web client security & supply-chain integrity

Breeze: single-file inline app; CSP + Trusted Types (`safeSetHTML`); SRI on `lang.js`.
The hardest web-E2EE problem: **the server can serve malicious JS**.

**Academic / standards**
1. *W3C Trusted Types* ([spec](https://www.w3.org/TR/trusted-types/)) → enforce `require-trusted-types-for 'script'` to kill DOM-XSS sinks (Breeze already has a sanitizer policy — enforce it; cf. Phase 2d).
2. *W3C CSP Level 3* ([spec](https://www.w3.org/TR/CSP3/)) → tighten script-src; the inline single-file design forces `'unsafe-inline'` via hash/nonce — pin via hash.
3. *Subresource Integrity* ([W3C SRI](https://www.w3.org/TR/SRI/)) → already on `lang.js`; extend to every external asset.
4. *Reproducible Builds* ([reproducible-builds.org](https://reproducible-builds.org/)) → deterministic build of `breeze.zip` so third parties can verify the published artifact matches source.
5. *Binary/Code Transparency* (e.g. Google's, [arXiv 2011.04551 — "Contour"/transparency]) → publish app-hash to an append-only log so a targeted malicious build is detectable.
6. "JavaScript Cryptography Considered Harmful" (classic) → the threat model code-signing addresses; counter it with verified delivery, not avoidance.

**GitHub**
7. [facebookincubator/meta-code-verify](https://github.com/facebookincubator/meta-code-verify) → **WhatsApp/Messenger Web "Code Verify"**: a browser extension that checks the loaded JS against a published, Cloudflare-audited hash — *the* answer to "is the served app authentic?" Adapt for Breeze's single file.
8. [sigstore/cosign](https://github.com/sigstore/cosign) → sign `breeze.zip` + publish provenance (SLSA) to a transparency log.
9. [C2SP/wycheproof](https://github.com/C2SP/wycheproof) → crypto KATs (I20) — also a supply-chain check on the WebCrypto glue.
10. [OWASP/ASVS](https://github.com/OWASP/ASVS) + [CSP Evaluator](https://github.com/google/csp-evaluator) → audit checklist for the client.

**Improvement points:** ship a **Code-Verify-style integrity check** (publish a signed
hash of the single-file app; a verifier extension or the **service worker** pins the
hash and refuses unverified updates) — closes the fundamental "server serves bad JS"
hole for web E2EE; **enforce Trusted Types**; **reproducible build + Sigstore
provenance** for `breeze.zip` with a **binary-transparency** log; tighten CSP via
script hashes; keep SRI. (The service worker is a natural pin point — it already
controls caching/updates.)

## 9 — Local-first storage & sync (offline, CRDT, search)

Breeze: IndexedDB (keys plaintext — I4), message store, PWA offline; single device.

**Academic**
1. Kleppmann et al., *Local-First Software* ([Ink & Switch 2019](https://www.inkandswitch.com/local-first/)) → principles for offline-first, multi-device-convergent apps.
2. Shapiro et al., *Conflict-free Replicated Data Types (CRDTs)*, [INRIA 2011](https://hal.inria.fr/inria-00609399/document) → conflict-free multi-replica convergence (needed for multi-device, cat 7).
3. Kleppmann, *A Highly-Available Move Operation for Replicated Trees*, [arXiv 2103.04828](https://arxiv.org/abs/2103.04828) → ordered lists/trees (message threads, folders) under concurrency.
4. Fuller et al., *SoK: Cryptographically Protected Database Search*, [arXiv 1703.02014](https://arxiv.org/abs/1703.02014) → encrypted-search trade-offs (client-side search over decrypted data is the safe path).
5. *E2EE message-history backup* (WhatsApp/Signal designs) → encrypted, key-separated history export.

**GitHub**
6. [yjs/yjs](https://github.com/yjs/yjs) → high-perf CRDT (design reference for multi-device state/read-receipt/edit convergence; vanilla-JS-friendly).
7. [automerge/automerge](https://github.com/automerge/automerge) → CRDT with rich history — reference for editable, mergeable transcripts (also enables I10 "local transcript editing" deniability).
8. [rhashimoto/wa-sqlite](https://github.com/rhashimoto/wa-sqlite) / [jlongster/absurd-sql](https://github.com/jlongster/absurd-sql) → SQLite-over-IndexedDB for a robust local store + **full-text search**.
9. [dexie/Dexie.js](https://github.com/dexie/Dexie.js) → ergonomic IndexedDB + encryption addon reference.
10. [localfirstweb/awesome-local-first](https://github.com/localfirstweb/awesome-local-first) → ecosystem index.

**Improvement points:** **encrypt the message store at rest** (extend I4 from identity
keys to IndexedDB message bodies via a derived DB key); adopt a **CRDT model**
(Yjs/Automerge) so the multi-device feature (cat 7) converges read-state/edits/deletes
without conflicts; consider **wa-sqlite** for durable local storage + **client-side
full-text search** over plaintext the client already holds; add **E2EE history
backup/export** (ties to I13). Single-device today → local-first unlocks multi-device.

## 10 — Serverless edge backend — scale, cost, reliability

Breeze: Cloudflare Pages Functions + KV; **in-memory per-isolate rate limiter**
(`globalThis._rateLimitMap`); long-polling (`/msg/poll`, `/sealed/poll`); free-tier
KV budget (~1000 writes/day) is a real constraint.

**Academic**
1. Shahrad et al., *Serverless in the Wild* (Azure Functions trace), [ATC 2020 / arXiv 2003.03423](https://arxiv.org/abs/2003.03423) → invocation/cold-start patterns informing keep-warm & batching.
2. Sreekanti et al., *Cloudburst: Stateful Functions-as-a-Service*, [arXiv 2001.04592](https://arxiv.org/abs/2001.04592) → patterns for consistent state over stateless functions.
3. Jia & Witchel, *Boki: Stateful Serverless with Shared Logs*, [SOSP 2021](https://www.cs.utexas.edu/~zjia/boki-sosp21.pdf) → durable consistency for serverless — model for ordered message logs.
4. *GCRA / sliding-window rate limiting* (leaky-bucket theory) → accurate limiter vs the current minute-bucket that undercounts across isolates.

**GitHub / docs**
5. [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/) → **strongly-consistent coordination**: move rate-limiting, presence, and signaling rendezvous to a DO (fixes the per-isolate `_rateLimitMap` undercount).
6. [cloudflare/workers-chat-demo](https://github.com/cloudflare/workers-chat-demo) → canonical **DO + hibernatable WebSockets** chat — replace long-polling with push (lower latency, **far fewer KV writes**).
7. [Cloudflare R2](https://developers.cloudflare.com/r2/) → object storage for backup blobs / large files instead of KV.
8. [Cloudflare D1](https://developers.cloudflare.com/d1/) → relational store for group membership (vs JSON-in-KV).
9. [upstash/ratelimit](https://github.com/upstash/ratelimit) → GCRA/sliding-window algorithm reference.
10. [Cloudflare Queues](https://developers.cloudflare.com/queues/) → async fan-out for push/relay delivery.

**Improvement points:** migrate rate-limiting + presence + signaling to **Durable
Objects** for cross-isolate correctness (the in-memory limiter undercounts today);
adopt **hibernatable WebSockets** to replace `/msg/poll` + `/sealed/poll` polling →
lower latency and **drastically fewer KV writes** (eases the free-tier budget);
**R2** for backup/large files, **D1** for group data; **GCRA** rate limiting. These
are correctness + cost wins tied to concrete limits already visible in `_worker.js`.

---

## Summary — top cross-category improvements

The 10-category sweep reinforces `docs/IMPROVEMENTS.md` and surfaces several
**newly-prominent, in-scope** items:

- **Web app integrity / Code Verify** (cat 8) — arguably the biggest *unaddressed*
  threat for a web E2EE app: without it, the host can serve malicious JS that
  defeats every protocol fix. Service-worker hash-pinning is a tractable first step.
- **Durable Objects + WebSocket push** (cat 10) — fixes the per-isolate rate-limiter
  correctness bug *and* the KV-write cost ceiling at once.
- **Encrypt the message store at rest + CRDT multi-device** (cat 9 + cat 7) —
  extends at-rest protection beyond keys and unlocks the most-requested feature.
- **SFrame + SAS for calls** (cat 5) — E2E media through any future group/SFU path,
  plus call-MITM defense.
- **Franking + anonymous tokens** (cat 6) — consensual abuse reporting and
  battery-friendly anti-spam without weakening E2EE.

Together with Part A/B of `IMPROVEMENTS.md`, this gives a full-surface backlog:
protocol (I1–I20), transport/media (cat 4–5), trust & safety (cat 6), key lifecycle
(cat 7), client supply-chain (cat 8), storage/sync (cat 9), and backend (cat 10).
