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
out-of-order, large-gap regression, replay, TTL expiry, commitment).
**Implemented (module).** Gap: `index.html` still emits/decrypts its own inline copy
(see §8) and **lacks the `Nr` reset** — see §9.

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
kicked-member-blocked, replay, commitment, **forgery/tamper/stripped-sig reject**).
**Implemented (module).** Refinement: a signing-key *ratchet* (authentication forward
secrecy, Balbás et al.) — see §9 N2. Gap: index.html/worker port (§8).

## 6. At-rest key protection (I4)

- Wrap private JWK: PBKDF2(≥600k, SHA-256) → AES-256-GCM. Record
  `{ v, kdf:'pbkdf2', hash, iter, salt, iv, ct }`.
- Migrate legacy `{ priv:jwk }` → `{ …, wrapped }` (plaintext removed), idempotent.
- No-passphrase default path preserved (opt-in app-lock).

Impl: `src/crypto/atrest.js`. Tests: `tests/atrest.test.js` (round-trip,
wrong-passphrase reject, tamper reject, fresh salt/iv, migration, ≥600k floor).
**Implemented (module).** Gap: `index.html` `loadIdentity`/keystore migration (§8).

## 7. Worker endpoints (security-relevant)

Covered by `tests/worker.test.js`: routing/validation, rate-limit 429, prekey OTP
consume-and-decrement, push SSRF guard, Stripe webhook signature + idempotency.
**Implemented.** Gaps: §8.

## 8. Gaps — integration (needs browser / two-device validation)

These are **specified + implemented in modules but not yet wired into the live app**;
they change `index.html`/`_worker.js` runtime and must be validated in a browser:

- G1. Wire X3DH (§2/§3) into `index.html` session init (replace bare `DH(IK,IK)`).
- G2. Client: sign the SPK; persist SPK/OPK **private** keys; send `signedPreKeySig`
  + EdIK in the bundle. Worker `handlePreKeyUpload`: **verify** the signature.
- G3. Port `index.html` group functions onto `src/crypto/group.js`; worker
  `/api/group/kick` to bump + return the epoch.
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
- N3. **Protocol-version negotiation** v4↔v5 (capability flag in presence/bundle)
  for staged rollout. Designed in `docs/IMPROVEMENTS.md`; not implemented.
- N4. **PQXDH / PQ ratchet** (I8/I9), **key transparency** (I11), **franking** (I17)
  — backlog, not started.

## Test status
6 suites, 59 tests passing (`npm test`); `validate.sh` 32/35. The crypto **cores**
of X3DH, Double Ratchet, group FS/PCS, key commitment, KATs, and at-rest wrapping
are implemented and tested; remaining work is integration (§8) + N1–N4 (§9).
