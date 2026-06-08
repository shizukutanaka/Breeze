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
{ v:5, g:true, ep:epoch, c:counter, i:[iv], d:[ct‖tag], cm:[keyCommitment], s:[ed25519Sig] }
```
- FS (I2): chain hash-ratchets per message; consumed chain dropped.
- PCS (I3): kick → `rotateEpoch` (fresh chain key, `epoch+1`) distributed to remaining
  members only; decrypt gates on `ep` (old/future epoch ⇒ reject).
- Auth (N2): each message is **Ed25519-signed** by the sender; `s` covers
  `iv‖ct‖cm‖ep‖counter`. The signing public key travels with the sender key; the
  private key never does. Verified before any ratchet work (also a DoS guard), so a
  member holding only the symmetric chain key cannot forge another member's messages.
- Carries `cm` (I16); bounded out-of-order recovery + replay reject.

Impl: `src/crypto/group.js`. Tests: `tests/group.test.js` (FS, epoch rotation,
kicked-member-blocked, replay, commitment, **forgery/tamper/stripped-sig reject**,
AEAD-auth-failure-does-not-desync).
**Implemented (module).** Security fix: chain advance deferred until after AEAD
auth succeeds (same injected-message desync fix as §4). Refinement: signing-key
*ratchet* (authentication forward secrecy, Balbás et al.) — see §9 N2.
Gap: index.html/worker port (§8).

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
client commitment → relay verifies; binding reject, unknown-id 404, no-overwrite).
**Implemented (core + relay).** Gap: bind the **sender** under sealed sender via
asymmetric franking / Hecate (§9 N4); client send/report UI wiring (browser).

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
- N2. **Group per-message authentication** — ✅ implemented (Ed25519 signature per
  message, §5). Remaining refinement: ratchet the *signing* key per message
  (authentication forward secrecy; Balbás et al.) so a leaked signing key can't
  forge past/future. Not yet done.
- N3. **Protocol-version negotiation** v4↔v5 — ✅ implemented in
  `src/crypto/negotiate.js` (`advertise`/`parsePeerCaps`/`negotiate`, 12 tests).
  Pending: wire the `advertise()` output into presence/bundle in `index.html`
  and call `negotiate()` before session init to select v4 vs v5 path.
- N4. **Franking core** (I17) — ✅ implemented (§6a); remaining: sealed-sender
  sender-binding (asymmetric franking / Hecate) + relay record/report endpoints (§8).
  **PQXDH / PQ ratchet** (I8/I9) — backlog; pending vetted WASM ML-KEM.

- N5. **Key transparency** (I11) — ✅ worker precursor done (`ktlog:` SHA-256 IK
  log, returned in prekey bundles); `src/crypto/ktlog.js` module done
  (`hashIK`/`parseLog`/`checkRollover`/`mergeLog`, 25 tests). Pending: full
  hash-chained log + `index.html` rollover-detection wiring (§8 I11 runbook).

- N6. **RFC 8291 push encryption** (C12) — ✅ `encryptPushPayload` + `buildVapidJwt`
  implemented in `_worker.js`; `sendPushToUser` now fully encrypts. 15 tests
  including round-trip decrypt + ES256 signature verify (`tests/push.test.js`).

- N7. **PoW challenge/solve/verify** — ✅ `src/crypto/pow.js`
  (`makeChallengeString`/`solve`/`verify`, 15 tests).

## Test status
11 suites, **227 tests** passing (`npm test`); `validate.sh` 32/35. All `src/crypto/`
modules have test suites: ratchet (19), group (13), atrest (10), franking (6),
negotiate (12), ktlog (25), pow (15), x3dh (6), kat (6), push (15); worker (100).
Worker coverage: routing, rate-limit, prekey, group create/join/info/kick/epoch,
account slots, franking relay, sealed sender, msg send/poll (including payload-size
limit + lastTs cursor), alias PoW, key-history log, dead drop, backup, signal relay,
presence, online count, OGP SSRF guard, push subscribe, push encryption (RFC 8291),
TURN credentials, webhook.
Remaining: browser integration (§8) + N1 index.html Nr fix (module has regression
test) + N2 signing-key ratchet + N4 sealed-sender franking (§9).
