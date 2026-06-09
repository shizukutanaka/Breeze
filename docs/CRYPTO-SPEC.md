# Breeze Crypto Module Specification (`src/crypto/`)

> Specifies the tested crypto reference modules and their wire formats, then maps
> each requirement to its implementation status. "Gap" = specified but not yet
> implemented. Complements the repo `SPEC.md` (product/compliance) and
> `docs/ROADMAP.md` (prioritized backlog). Status as of this commit.

## 1. Primitives & key types

| Element | Spec |
|---------|------|
| DH / ECDH | X25519 preferred; P-256 fallback (`hasX25519` flag). `deriveBits` 256-bit. |
| Signatures | Ed25519 (identity/long-term), for pre-key authentication. |
| KDF | HKDF-SHA256 (`hkdf(ikm, salt, info, len)`). |
| AEAD | AES-256-GCM, 96-bit IV, 128-bit tag. |
| Identity keys | X25519 IK (DH) + Ed25519 EdIK (signing) — **separate** keys. |
| Pre-keys | Signed pre-key SPK (X25519) + one-time pre-keys OPK (X25519). |

Conformance: pinned by `tests/kat.test.js` against RFC 5869 (HKDF), RFC 7748
(X25519), NIST (AES-256-GCM) + a tamper-reject negative. **Implemented.**

## 2. X3DH v5 (authenticated key agreement)

1. Responder publishes bundle `{ IK_B, EdIK_B, SPK_B, Sig_B = Ed25519(EdIK_B, SPK_B), [OPK_B] }`.
2. Initiator **MUST** verify `Sig_B` over `SPK_B` with `EdIK_B`; abort on failure.
3. Initiator generates ephemeral `EK_A` and computes:
   - DH1 = DH(IK_A, SPK_B), DH2 = DH(EK_A, IK_B), DH3 = DH(EK_A, SPK_B), [DH4 = DH(EK_A, OPK_B)]
   - `SK = HKDF(DH1‖DH2‖DH3‖[DH4], salt=0^32, info='breeze-x3dh-v5', 32)`
4. Responder derives the same `SK` from its private SPK/IK/OPK and the initiator's IK/EK.

Impl: `genSigningKey/signSPK/verifySPK`, `x3dhInitiator/x3dhResponder`
(`src/crypto/ratchet.js`). Tests: `tests/x3dh.test.js` — agreement (±OPK),
per-session uniqueness, and the **MITM defense** (swapped pre-key fails verify).
**Implemented (module).** Gap: index.html init + worker verify-on-upload (§8).

## 3. Session establishment (X3DH → Double Ratchet)

- Initiator seeds the ratchet using `SPK_B` as the first DH-ratchet partner:
  `derived = HKDF(DH(rk_A, SPK_B), SK, 'ratchet', 64)`; sendChainKey = `derived[32:64]`.
- Responder holds `SPK_B` private as its initial ratchet key; the initiator's first
  message (carrying `rk_A`) triggers the matching DH step → responder's recv chain.

Impl: `initiatorSession/responderSession` + `dhRatchetStep`. Test: full bidirectional
conversation with direction-flipping DH ratchets (`tests/x3dh.test.js`).
**Implemented (module).**

## 4. Double Ratchet message format (1:1)

```
{ v:4, i:[iv], d:[ciphertext‖tag], rk:[ratchetPub], c:counter, cm:[keyCommitment] }
```
- Symmetric chain: `msgKey=HKDF(ck,0^32,'msg')`, `ck=HKDF(ck,0^32,'chain')`.
- Frame (inside AEAD): `[flags:1][len:2][data]`, padded to 256 B. (`flags.bit0`=compressed.)
- DH ratchet step on new `rk`: resets **both** `Ns` and `Nr`.
- Replay: reject `c ≤ Nr` (unless a skipped key exists); dedup by msgId (first 8 ct bytes).
- Skipped keys: bounded (`MAX_SKIP`), reject gaps `> MAX_GAP`, **TTL-expired** (I7).
- Key commitment `cm = HKDF(msgKey,0^32,'breeze-commit',32)`, verified constant-time
  before trusting the AEAD (I16).

Impl: `ratchetEncrypt/ratchetDecrypt`. Tests: `tests/ratchet.test.js` (round-trip,
out-of-order, large-gap regression, replay, TTL expiry, commitment, N1 Nr-reset
regression, AEAD-auth-failure-does-not-desync).
**Implemented (module).** Security fix: state advance deferred until after AEAD
auth succeeds (injected message with corrupt ciphertext no longer desyncs chain).
Gap: `index.html` still emits/decrypts its own inline copy (see §8) and **lacks
the `Nr` reset** — see §9.

## 5. Group sender keys

```
{ v:5, g:true, ep:epoch, c:counter, i:[iv], d:[ct‖tag], cm:[keyCommitment],
  s:[perMsgSig], es:[epochSig], spk:[perMsgPub], nsk:[nextPerMsgPub] }
```
- FS (I2): chain hash-ratchets per message; consumed chain dropped.
- PCS (I3): kick → `rotateEpoch` (fresh chain key, `epoch+1`) distributed to remaining
  members only; decrypt gates on `ep` (old/future epoch ⇒ reject).
- Auth (N2): **two-layer Ed25519 signatures** (partial AFKS):
  - `es` — epoch signature: long-lived per-epoch key signs `iv‖ct‖cm‖ep‖c‖spk‖nsk`.
    Lets the receiver authenticate the per-message key without tracking a ratchet
    chain, so out-of-order delivery works.
  - `s`  — per-message signature: fresh keypair used once then discarded, signs the
    same bytes. Forging requires both keys simultaneously — leaking either alone is
    insufficient. Both must verify before any key derivation (DoS guard).
  - `spk` / `nsk` — current and next per-message signing public keys, covered by both
    signatures to prevent key substitution.
- Carries `cm` (I16); bounded out-of-order recovery + replay reject.

Impl: `src/crypto/group.js`. Tests: `tests/group.test.js` (FS, epoch rotation,
kicked-member-blocked, replay, commitment, **forgery/tamper/stripped-es/stripped-s
reject**, out-of-order with two-layer sigs, AEAD-auth-failure-does-not-desync).
**Implemented (module).** Security fix: chain advance deferred until after AEAD
auth succeeds (same injected-message desync fix as §4).
Gap: index.html/worker port (§8). Remaining N2 refinement: full per-message signing-
key ratchet (pure AFKS, Balbás et al.) requires either in-order delivery guarantee or
WebCrypto hierarchical key derivation — neither available; two-layer scheme is the
practical maximum with WebCrypto + arbitrary message ordering.

## 6. At-rest key protection (I4)

- Wrap private JWK: PBKDF2(≥600k, SHA-256) → AES-256-GCM. Record
  `{ v, kdf:'pbkdf2', hash, iter, salt, iv, ct }`.
- Migrate legacy `{ priv:jwk }` → `{ …, wrapped }` (plaintext removed), idempotent.
- No-passphrase default path preserved (opt-in app-lock).

Impl: `src/crypto/atrest.js`. Tests: `tests/atrest.test.js` (round-trip,
wrong-passphrase reject, tamper reject, fresh salt/iv, migration, ≥600k floor).
**Implemented (module).** Gap: `index.html` `loadIdentity`/keystore migration (§8).

## 6a. Message franking — verifiable abuse reporting (I17)

- Sender draws a random opening `Kf` and computes `Cf = HMAC-SHA256(Kf, message)`.
  `Cf` is attached in the clear (relay records it at send time); `Kf` is sent
  **encrypted** inside the E2E payload (recipient-only).
- To report, the recipient reveals `(message, Kf)`; the relay checks
  `HMAC(Kf, message) == Cf` → proof the message was genuinely sent. No plaintext
  escrow; un-reported messages stay hidden (HMAC hiding under a secret key).

Impl: client core `src/crypto/franking.js` (`commit`/`verify`/`verifyReport`) +
**relay endpoints** `_worker.js` `/api/abuse/record` (store `Cf`) and
`/api/abuse/report` (verify revealed `(message, Kf)` against the recorded `Cf`).
Tests: `tests/franking.test.js` (core) + `tests/worker.test.js` (end-to-end:
client commitment → relay verifies; binding reject, unknown-id 404, no-overwrite,
oversized-message + oversized-opening DoS guards).
**Implemented (core + relay).** Gap: bind the **sender** under sealed sender via
asymmetric franking / Hecate (§9 N4); client send/report UI wiring (browser).

## 6b. Safety number — out-of-band MITM verification (key fingerprint)

Two users compare a 60-digit number over an independent channel (voice, in
person, QR). Matching numbers prove neither party's identity key was swapped by
a malicious relay — the only protocol-level defense against an active MITM that
substitutes pre-key bundles (X3DH alone cannot prevent it without a trust root).

Algorithm (`src/crypto/fingerprint.js`, faithful to Signal's
NumericFingerprintGenerator):
- Per party: `H₀ = SHA-512(version ‖ identityKey ‖ stableId)`, then
  `Hₙ = SHA-512(Hₙ₋₁ ‖ identityKey)` for **5200 iterations**; the first 30 bytes
  → six 5-digit chunks (`byteArray5 % 100000`) = 30 digits per party.
- The two per-party fingerprints are concatenated in **sorted** order, so both
  participants compute the identical 60-digit string regardless of who is local.
- The iterated hash makes grinding a colliding substitute key ~5200× more
  expensive per candidate; 60 shown digits ≈ 112 bits vs the legacy single-hash
  `safetyNumber()` in index.html (one SHA-256 over 12 bytes, ~40 bits shown).

Impl: `src/crypto/fingerprint.js` (`createFingerprint` → `safetyNumber` /
`fingerprintFor` / `scannable` / `verifyScannable`). The scannable path is the
stronger verification: `scannable()` encodes `version(1) ‖ myFp(30) ‖ peerFp(30)`
as base64 (a QR payload, mirroring Signal's CombinedFingerprints) and
`verifyScannable()` cross-matches a peer's scanned code (scanned.local == my
remote ∧ scanned.remote == my local) in constant time — comparing the full
30-byte fingerprints rather than the 40-bit-per-chunk display truncation, so it
is immune to the digit-skipping errors of manual comparison. Tests:
`tests/fingerprint.test.js` (17 — format, symmetry, determinism, MITM-substitution
visibility, stableId binding, iteration binding, bytes≡base64, full 5200-round
run; scannable: encoding length, cross-party match, MITM reject, malformed/
version-mismatch reject, stableId binding). **Implemented (module).** Gap: migrate
index.html `safetyNumber()`/`showSafetyNumber()` onto it (browser-validated pass).

## 7. Worker endpoints (security-relevant)

Covered by `tests/worker.test.js` (98 tests):
- Routing & validation, rate-limit 429, userId format check.
- Prekey: OTP consume-and-decrement, replenish hint (≤5 remaining), Ed25519
  SPK signature verify (PREKEY_SIG_INVALID on tamper), key-history audit log
  (I11 precursor: SHA-256 IK log, rollover detection on duplicate/change).
- Group: create/join/info (validation, idempotency), kick with epoch bump,
  NOT_MEMBER guard, I3 epoch gate, creator-only enforcement.
- Franking: record (no-overwrite), report (HMAC verify, FRANK_MISMATCH),
  frankId/message size limits.
- Sealed sender: queue+poll round-trip, ack deletion, dedup.
- Msg: store+poll, INVALID_TIMESTAMP, SELF_SEND, content-keyed dedup.
- Alias: PoW challenge-pub binding, difficulty-16 min, ALIAS_TAKEN, get.
- Dead Drop: one-time read-then-delete, collision, TTL clamping, size limits.
- Backup: upload/download round-trip, 5MB limit, 404 on missing.
- Signal relay: store/poll, filters own-signals, 50-msg cap.
- Presence: heartbeat + single/batch check, online counter.
- Account slots: free default, stored plan, missing userId.
- OGP SSRF guard: 11 private/internal URL patterns blocked (return 200+{}).
- Push subscribe: trusted endpoint allow/deny.
- Push encryption (C12): RFC 8291 round-trip decrypt, VAPID JWT ES256 verify.
- Webhook: Stripe signature verify + idempotency.
- TURN credentials: missing-userId, openrelay fallback, HMAC, static.
**Implemented.** Gaps: §8.

## 8. Gaps — integration (needs browser / two-device validation)

These are **specified + implemented in modules but not yet wired into the live app**;
they change `index.html`/`_worker.js` runtime and must be validated in a browser:

- G1. Wire X3DH (§2/§3) into `index.html` session init (replace bare `DH(IK,IK)`).
- G2. ✅ **Worker side done**: `handlePreKeyUpload` now verifies `signedPreKeySig`
  against `edIdentityKey` (Ed25519) and rejects invalid signatures
  (`PREKEY_SIG_INVALID`), accepting unsigned bundles during the v4→v5 transition;
  fetch returns the ed identity key + sig. **Pending (client/browser)**: sign the
  SPK, persist SPK/OPK **private** keys, send `signedPreKeySig` + EdIK, and verify
  on the initiator side.
- G3. ✅ **Worker side done**: `/api/group/kick` bumps + returns `epoch`; create
  starts at 0; join/info surface the current `epoch` so members know to rotate.
  **Pending (client/browser)**: port `index.html` group functions onto
  `src/crypto/group.js` and rotate sender keys when the epoch advances.
- G4. Port `index.html` `encryptFor`/`decryptFrom` onto `src/crypto/ratchet.js`
  (single source of truth) — and drop pre-encryption compression (I15).
- G5. `loadIdentity`/keystore → `src/crypto/atrest.js` wrapping + migration (I4).

## 9. Gaps — not yet implemented (module-level)

- N1. **`index.html` DH-ratchet `Nr` reset bug.** This spec exercise found that
  `dhRatchetStep` in `index.html` (`sess.sendCounter = 0` only) does **not** reset
  the receive counter, so the first message of a new receiving chain can be
  misclassified as a replay. The module is fixed (§4); `index.html` is not — fix
  when porting (G4). **Real correctness bug.**
- N2. **Group per-message authentication** — ✅ implemented as two-layer Ed25519
  (epoch sig `es` + per-message sig `s`, §5). Partial AFKS: forging requires
  compromising both keys simultaneously; a leaked per-message key cannot forge other
  messages (epoch sig would fail) and vice versa. Pure per-message signing-key ratchet
  (full Balbás et al. AFKS) is not achievable with WebCrypto + arbitrary message
  ordering: out-of-order delivery requires the epoch sig to authenticate the per-message
  key, which necessitates a stable long-lived epoch key — i.e. the two-layer design.
- N3. **Protocol-version negotiation** v4↔v5 — ✅ implemented in
  `src/crypto/negotiate.js` (`advertise`/`parsePeerCaps`/`negotiate`, 12 tests).
  ✅ **Worker side done**: `handlePreKeyUpload` now persists `caps` from the bundle
  (sanitized: each string capped at 32 chars, array capped at 20 entries); `caps` is
  returned on fetch so the initiator can call `parsePeerCaps(bundle)` and `negotiate()`
  to select v4 vs v5 path. Pending: wire `advertise()` into presence/bundle in
  `index.html` and call `negotiate()` before session init.
- N4. **Franking core** (I17) — ✅ implemented (§6a); remaining: sealed-sender
  sender-binding (asymmetric franking / Hecate) + relay record/report endpoints (§8).
  **PQXDH / PQ ratchet** (I8/I9) — backlog; pending vetted WASM ML-KEM.

- N5. **Key transparency** (I11) — ✅ `src/crypto/ktlog.js` module done with full
  hash-chained log (`chainHash`/`appendChainEntry`/`verifyChain`, 34 tests). Each
  prekey-history entry now carries `c = SHA-256(prevC ‖ h)` binding it to its
  predecessor; `verifyChain` detects gaps/tampering; legacy entries without `c` are
  skipped (backward-compatible transition). Worker `handlePreKeyUpload` computes and
  stores chain hashes. Pending: `index.html` rollover-detection wiring (§8 I11 runbook).

- N6. **RFC 8291 push encryption** (C12) — ✅ `encryptPushPayload` + `buildVapidJwt`
  implemented in `_worker.js`; `sendPushToUser` now fully encrypts. 15 tests
  including round-trip decrypt + ES256 signature verify (`tests/push.test.js`).

- N7. **PoW challenge/solve/verify** — ✅ `src/crypto/pow.js`
  (`makeChallengeString`/`solve`/`verify`, 19 tests). Freshness check: optional
  `{ maxAge, now }` parameter rejects tokens older than `maxAge` ms with
  `POW_EXPIRED`, preventing indefinite replay of a solved token.

## Test status
12 suites, **346 tests** passing (`npm test`); `validate.sh` 32/35. All `src/crypto/`
modules have test suites: ratchet (21), group (25), atrest (10), franking (6),
negotiate (12), ktlog (37), pow (19), x3dh (6), kat (6), push (15), fingerprint (17);
worker (172).
Worker coverage: routing, rate-limit, userId validation (length bounds + charset),
prekey (0-OTP replenish hint + caps round-trip + caps sanitization + x3dh legacy
field + N5 chain hash round-trip + tamper detection + upload/fetch malformed-id guard
+ field size caps: identityKey/edIdentityKey/signedPreKey/signedPreKeySig/OTP entries),
group create/join/info/kick/epoch (self-kick guard + post-kick join epoch + malformed-id
guards + token length cap), account slots (malformed-id guard), franking relay
(opening DoS guard), sealed sender (multi-sender + missing-id + send validation +
malformed-to guard), msg send/poll (payload-size limit + lastTs cursor + MISSING_FIELDS
+ malformed-id guards), alias PoW (PoW freshness check + pub size cap), key-history
log (N5 chain), dead drop, backup (malformed-id guard), signal relay (sanitizeString
strip ctrl chars + data size cap), presence (heartbeat + malformed-id guards + batch
filter), online count, OGP SSRF guard (11 blocked patterns + IPv4-mapped IPv6 bypass
+ malformed URL + URL length cap + hash cache key), push subscribe (SSRF + 5-device
cap + malformed-id guard + subscription field sanitization), push encryption (RFC 8291),
TURN credentials (malformed-id guard), webhook (signature verify + idempotency + userId
KV injection guard), body size enforcement (Content-Length spoof), AI handler input
validation (lang injection strip + empty lang reject + oversized summarize fields +
unknown action), translate handler (missing-field + type guards).
Security additions: ratchet MAX_SKIP storage-bound (forward secrecy), consumed-
skipped-key replay guard (ratchet + group), group future-epoch rejection, N3 caps +
x3dh legacy compat persistence in worker prekey bundle (v5 capability advertisement
flow complete), PoW freshness check (maxAge), N5 hash-chained key-transparency log,
validateUserId() on all KV-key-constructing handlers including presence heartbeat/check,
account purchase, webhook (checkout/subscription.deleted/updated metadata) and OTP
write path (KV key injection prevention + Stripe metadata hygiene), Origin:null CORS
bypass blocked (sandboxed iframe protection), actual body size enforcement (Content-Length
spoof bypass fix), signal data size cap (64KB DoS guard), batch presence id filter via
validateUserId (JS coercion + KV injection guard), public key field size caps (identityKey/
signedPreKey ≤5000 chars, edIdentityKey/signedPreKeySig ≤500 chars, alias pub ≤2000
chars), OTP per-entry size cap (5000 chars), group token length cap (128 chars), AI
handler lang prompt-injection prevention (BCP-47 charset sanitization), AI summarize
per-field bounds (sender ≤100 chars, text ≤500 chars), translate `to` type guard, PoW
freshness check in handleAliasSet (10 min maxAge, backward-compatible with old-format
challenges), N2 two-layer group authentication (partial AFKS: epoch sig + per-message
sig, both required; forging requires simultaneous compromise of both keys), OGP URL
length cap (2048 chars) + sha256Short hash cache key (fixes URL prefix-collision bug),
abuse report `opening` field size cap (128 chars, HMAC key is 44 base64 chars),
push subscription object sanitization (whitelist endpoint/keys/expirationTime, cap
p256dh ≤100 chars, auth ≤50 chars; extra fields stripped before KV storage).
Remaining: browser integration (§8) + N1 index.html Nr fix (module has regression
test) + N4 sealed-sender franking (§9).
