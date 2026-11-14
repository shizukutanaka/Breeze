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
(`src/crypto/ratchet.js`). One-call orchestration `initiatorHandshake` /
`responderHandshake` wraps verify → derive → bootstrap → (en|de)crypt; crucially
`initiatorHandshake` **throws** when the bundle signature does not verify, so step 2's
"MUST verify ... abort on failure" is *unskippable* from the public API (the
MITM-vulnerable derive-without-checking path is unreachable). Tests:
`tests/x3dh.test.js` — agreement (±OPK), per-session uniqueness, the **MITM defense**
(swapped pre-key fails verify), and orchestration (two-call handshake ±OPK, forged-bundle
abort, missing-signature abort, non-prekey wire → null). `bundleFromRelay(fetched, decode?)`
maps the relay's verbose prekey-fetch JSON
(`identityKey/edIdentityKey/signedPreKey/signedPreKeySig/oneTimePreKey/oneTimePreKeyId`)
to the handshake bundle shape (`ikPub/edIkPub/spkPub/spkSig/opkPub/opkId`) in one tested
place — a field-name typo in the port can't silently drop the signature material and skip
the MITM check (tested end-to-end: mapped relay bundle drives a real handshake; a bundle
missing `signedPreKeySig` still aborts). Worker `handlePreKeyFetch` returns
`oneTimePreKeyId` (the consumed OTP index → the initiator's `opkId`).
**Implemented (module).** Gap: index.html init (worker verify-on-upload already shipped).

## 2a. PQXDH — post-quantum hybrid key agreement (stage 3)

X3DH v5 (§2) with an ML-KEM-768 secret folded into the same derivation, so a
session survives the break of *either* primitive (harvest-now/decrypt-later
resistance). Design record: `docs/PQ_STAGE3_PLAN.md` (D1–D7); shipped in
stage-3 steps 1–5 and **on by default since step 6**
(`CONFIG.PQXDH_ENABLED: true`).

1. **Bundle.** The responder's bundle gains two fields alongside the SPK:
   `pqPreKey` (ML-KEM-768 public key, 1,184 bytes) and
   `pqPreKeySig = Ed25519(EdIK_B, pqPreKey)` over the RAW public-key bytes —
   the SPK construction exactly. Both ride inside the signed upload digest
   (the v2 9-field form; a v1-signed upload carrying PQ fields is refused,
   so a captured v1 request cannot be replayed with PQ material attached).
2. **Negotiation (AND rule).** PQ is used iff ALL of: the local flag is on,
   the peer's caps include both `x3dh-v5` and `pqxdh`, `pqPreKey` is
   present, and `pqPreKeySig` verifies. Anything else ⇒ §2 classical,
   byte-identical — negotiation choosing classical explicitly, never a
   silent downgrade inside the crypto.
3. **Derivation.** The initiator encapsulates to `pqPreKey` → `SS`
   (32 bytes) and computes
   `SK = HKDF(DH1‖DH2‖DH3‖[DH4]‖SS, salt=0^32, info='breeze-pqxdh-v1:' + hex(SHA-256(pqpk‖ct)), 32)`
   — the KEM secret LAST, the info transcript-bound to the PQ public key
   and the ciphertext. The classical path keeps `info='breeze-x3dh-v5'`,
   so the two session types can never derive-collide. The responder
   decapsulates and combines identically; a `pqct`-carrying first message
   whose PQ private half is unavailable FAILS CLOSED (no classical
   fallback — it could never match the initiator's SK).
4. **Wire.** The §3 first-message envelope gains one optional field,
   `pqct` — the 1,088-byte KEM ciphertext in the envelope's `arr()` byte
   encoding. Absent ⇒ the envelope is byte-identical to §3.
5. **Key material.** Only the 64-byte ML-KEM keygen **seed** persists
   (IDB `identity` store, key `pq-priv`); the expanded secret key is
   re-derived on demand and never stored or sent. Rotation inherits the
   SPK cadence (one bundle construction). `/keywrap` wraps the seed with
   the identity keys; at boot the passphrase flow unwraps it into memory
   ONLY (step 6) — the stored record stays wrapped, so a wrapped device
   answers PQ sessions without weakening at-rest protection.
6. **Implementation.** The KEM is vendored `@noble/post-quantum`
   ML-KEM-768 (pinned; correctness rests on the NIST ACVP vectors in
   `tests/mlkem.test.js`, not on round-trips), deployed as the ESM facade
   `src/crypto/pqxdh.js` over the single-sourced combiner
   `src/crypto/pq.js` — injected, never hand-rolled, never inlined.
   Sessions established via PQXDH carry `pq: true` on the session record
   (surfaced by `/security`). Groups are unchanged (§5): sender-key
   distribution rides the 1:1 sessions, so it inherits this protection;
   a PQ group ratchet (SPQR-class) is a separate decision (§9, I9).

**Implemented and deployed** (client wiring in `index.html`; worker
storage/verification shipped in stage-3 step 2).

## 2b. Account seed and recovery phrase (recovery plan step 3)

The recovery anchor of docs/IDENTITY_RECOVERY_PLAN.md §3.1, implemented
in `src/crypto/seed.js` (deployed as ESM, `window.__breezeSeed`) over the
canonical BIP39 English wordlist vendored verbatim as data in
`src/crypto/wordlist.js`. Standard constructions only; no curve
arithmetic exists in the codebase — private keys enter WebCrypto as
PKCS#8 and public keys are read back from the imported key.

1. **Entropy / phrase.** The account seed is 32 bytes from
   `crypto.getRandomValues`. The phrase is the BIP39 mnemonic: entropy
   bits followed by the first 8 bits of SHA-256(entropy) (the full
   checksum byte at 256-bit entropy), split into 24 × 11-bit wordlist
   indices, space-joined. Parsing reverses it (NFKD, lowercase,
   whitespace split) and REQUIRES the checksum — a mistyped word is
   rejected before any key exists.
2. **Master seed.** PBKDF2-HMAC-SHA512, 2,048 iterations, 64-byte
   output: password = the mnemonic sentence (NFKD), salt =
   `"mnemonic" + passphrase` (NFKD). The passphrase is BIP39's optional
   second factor: an empty passphrase is valid and yields a DIFFERENT
   master from every non-empty one. A wrong passphrase is therefore
   undetectable at derivation time (it names a different, empty
   account) — the client's one check is §5 below.
3. **Per-key derivation.** HKDF-SHA256 (IKM = master seed, salt =
   0^32, 32-byte output), one info string per key — domain separation
   is the info string, and a future key type takes a new one:
   - identity (X25519): `breeze-seed-v1:x25519-identity`
   - signing (Ed25519): `breeze-seed-v1:ed25519-signing`
   - recovery-kit AES key: `breeze-seed-v1:recovery-kit`
4. **Key construction.** Each 32-byte output is used verbatim as the
   curve's private seed inside an RFC 8410 PKCS#8 v1 envelope
   (X25519 OID 1.3.101.110, Ed25519 OID 1.3.101.112) and imported via
   WebCrypto (`deriveBits` / `sign`); the public half comes from the
   imported private key's JWK `x`. X25519 clamping happens inside the
   algorithm (RFC 7748), so stored JWKs have exactly the shapes a
   generated key's JWKs have — `loadIdentity`/`initSigning` cannot
   tell a derived record from a generated one. Only the derived key
   RECORDS are stored; the seed and phrase are never persisted, never
   sent anywhere, and never proved to a relay — the derived keys do
   the proving. Seed-derived `keys` records carry
   `recoveryMode: 'phrase'`.
5. **The passphrase guard (restore-time).** When the user restores
   with their @alias typed, the derived identity public key is checked
   against the relay's alias record BEFORE anything is written: a
   mismatch (wrong word the checksum cannot catch is impossible —
   this catches the wrong-PASSPHRASE case) refuses the restore. With
   no alias typed there is no reference to check against, the BIP39
   property above applies, and the restore yields whatever account
   the (phrase, passphrase) pair names.
6. **Recovery kit (legacy identities).** Accounts whose keys are
   random cannot be re-derived; their anchor form is the step-1
   backup payload (identity record + contacts + full key material)
   encrypted under the kit key of item 3: AES-256-GCM, random 12-byte
   IV, additionalData = the ASCII string `breeze-recovery-kit-v1`,
   envelope `{ kitV: 1, iv, data }` (base64). Unwrap returns null on
   any failure — the kit file alone is an offline oracle for the
   (phrase, passphrase) PAIR jointly; neither factor alone opens it,
   and the phrase alone carries 256 bits.

**Implemented and deployed** (creation branch, first-run phrase entry,
and the kit in `index.html`; drills in `tests/recovery-seed.test.js` —
BIP39 vectors, node:crypto cross-derivation, create/wipe/restore and
kit round-trips).

## 3. Session establishment (X3DH → Double Ratchet)

- Initiator seeds the ratchet using `SPK_B` as the first DH-ratchet partner:
  `derived = HKDF(DH(rk_A, SPK_B), SK, 'ratchet', 64)`; sendChainKey = `derived[32:64]`.
- Responder holds `SPK_B` private as its initial ratchet key; the initiator's first
  message (carrying `rk_A`) triggers the matching DH step → responder's recv chain.
- **First-message ("prekey message") envelope:** the initiator's FIRST message is
  wrapped so the responder can derive `SK` before decrypting:
  `{ v:5, t:'pkm', ik:[IK_A], ek:[EK_A], opkId:<id|null>, [pqct:[ML-KEM ct]], msg:<ratchet JSON> }`.
  `pqct` is present only on a PQXDH-negotiated session (§2a).
  `opkId` identifies the consumed one-time pre-key (`null` when OPKs are exhausted).
  Every subsequent message is a plain ratchet message.

Impl: `initiatorSession/responderSession` + `dhRatchetStep`;
`buildPreKeyMessage`/`parsePreKeyMessage` for the first-message envelope (the single
source of truth for the v5 handshake header — the browser port calls these, never
hand-rolls the format). Tests (`tests/x3dh.test.js`): full bidirectional conversation
with direction-flipping DH ratchets; envelope round-trip, `opkId:null`, malformed
payload → null (no throw), and a full first-contact handshake (Alice wraps → Bob
unwraps → derives identical SK → decrypts).
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

**Sender-key distribution envelope:** when a member creates/rotates a sender key it
hands the RECEIVE half to each other member over the authenticated 1:1 channel via
`buildSenderKeyDistribution(senderKey)` → `{ v:5, t:'skd', ep, c, ck:[chainKey],
spk:[epochSignPub] }` and `parseSenderKeyDistribution(wire)` → a receiver key (same
shape as `receiverFrom`). Only the epoch sign PUBLIC key crosses the wire — never the
signing private or per-message keys. The current `counter` is included so a mid-stream
joiner cannot read earlier messages (forward secrecy); the `epoch` scopes the key to a
membership generation. Single source of truth for the browser port's `distributeSenderKey`.

Impl: `src/crypto/group.js`. Tests: `tests/group.test.js` (FS, epoch rotation,
kicked-member-blocked, replay, commitment, **forgery/tamper/stripped-es/stripped-s
reject**, out-of-order with two-layer sigs, AEAD-auth-failure-does-not-desync,
sender-key distribution round-trip + no-private-key-leak + FS-on-join + epoch scope).
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

- Load helpers: `isWrapped(record)` detects wrapped vs. legacy-plaintext records;
  `loadKey(record, passphrase?)` returns the JWK for either form (and **throws** when a
  wrapped record is loaded with no passphrase, so `loadIdentity` knows to prompt rather
  than silently treating a locked record as empty). Single source of truth for the §8 port.

Impl: `src/crypto/atrest.js`. Tests: `tests/atrest.test.js` (round-trip,
wrong-passphrase reject, tamper reject, fresh salt/iv, migration, ≥600k floor,
iter-DoS ceiling, isWrapped/loadKey detection + unwrap + prompt-throw).
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

Covered by `tests/worker.test.js` (197 tests):
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
- Push subscribe: trusted endpoint allow/deny.
- Push encryption (C12): RFC 8291 round-trip decrypt, VAPID JWT ES256 verify.
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
  **PQXDH** (I8) — ✅ implemented and deployed (§2a; stage 3, on by
  default since step 6 — the vetted-ML-KEM premise was met by the pinned
  pure-JS @noble/post-quantum, ACVP-verified, not WASM). **PQ ratchet**
  (I9, SPQR-class per-message PQ ratcheting) — still backlog, a separate
  decision with its own plan.

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
13 suites, **433 tests** passing (`npm test`); `validate.sh` 33/36. All `src/crypto/`
modules have test suites: bytes (12), ratchet (24), group (31), atrest (17), franking (9),
negotiate (21), ktlog (42), pow (21), x3dh (21), kat (6), push (15), fingerprint (17);
worker (197). `src/crypto/bytes.js` is the shared byte/encoding + constant-time-compare
helper module (`u8`/`arr`/`toBytes`/`concatBytes`/`b64`/`unb64`/`ctEqual`) consumed by the
others — one audited `ctEqual` rather than copies that can drift.
Worker coverage: routing, rate-limit, userId validation (length bounds + charset),
prekey (0-OTP replenish hint + caps round-trip + caps sanitization + x3dh legacy
field + N5 chain hash round-trip + tamper detection + upload/fetch malformed-id guard
+ field size caps: identityKey/edIdentityKey/signedPreKey/signedPreKeySig/OTP entries),
group create/join/info/kick/epoch (self-kick guard + post-kick join epoch + malformed-id
guards + token length cap), franking relay
(opening DoS guard), sealed sender (multi-sender + missing-id + send validation +
malformed-to guard), msg send/poll (payload-size limit + lastTs cursor + MISSING_FIELDS
+ malformed-id guards), alias PoW (PoW freshness check + pub size cap), key-history
log (N5 chain), dead drop, backup (malformed-id guard), signal relay (sanitizeString
strip ctrl chars + data size cap), presence (heartbeat + malformed-id guards + batch
filter), online count, push subscribe (SSRF + 5-device
cap + malformed-id guard + subscription field sanitization), push encryption (RFC 8291),
TURN credentials (malformed-id guard), body size enforcement (Content-Length spoof).
Security additions: ratchet MAX_SKIP storage-bound (forward secrecy), consumed-
skipped-key replay guard (ratchet + group), group future-epoch rejection, N3 caps +
x3dh legacy compat persistence in worker prekey bundle (v5 capability advertisement
flow complete), PoW freshness check (maxAge), N5 hash-chained key-transparency log,
validateUserId() on all KV-key-constructing handlers including presence heartbeat/check
and OTP write path (KV key injection prevention), Origin:null CORS
bypass blocked (sandboxed iframe protection), actual body size enforcement (Content-Length
spoof bypass fix), signal data size cap (64KB DoS guard), batch presence id filter via
validateUserId (JS coercion + KV injection guard), public key field size caps (identityKey/
signedPreKey ≤5000 chars, edIdentityKey/signedPreKeySig ≤500 chars, alias pub ≤2000
chars), OTP per-entry size cap (5000 chars), group token length cap (128 chars), PoW
freshness check in handleAliasSet (10 min maxAge, backward-compatible with old-format
challenges), N2 two-layer group authentication (partial AFKS: epoch sig + per-message
sig, both required; forging requires simultaneous compromise of both keys),
abuse report `opening` field size cap (128 chars, HMAC key is 44 base64 chars),
push subscription object sanitization (whitelist endpoint/keys/expirationTime, cap
p256dh ≤100 chars, auth ≤50 chars; extra fields stripped before KV storage).
Remaining: browser integration (§8) + N1 index.html Nr fix (module has regression
test) + N4 sealed-sender franking (§9).
