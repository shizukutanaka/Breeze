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
| 6 | Trust & safety in E2EE — abuse, spam, moderation | ⏳ researching |
| 7 | Key lifecycle — multi-device, backup, transparency | ⬜ pending |
| 8 | Web client security & supply-chain integrity | ⬜ pending |
| 9 | Local-first storage & sync (offline, CRDT, search) | ⬜ pending |
| 10 | Serverless edge backend — scale, cost, reliability | ⬜ pending |

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

<!-- Categories 6–10 appended in subsequent loop iterations. -->
