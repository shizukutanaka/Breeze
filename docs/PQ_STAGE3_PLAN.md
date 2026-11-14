# Post-quantum key agreement — stage-3 plan (2026-11-14)

Context: stages 1–2 (docs/MAILBOX_STAGE1_PLAN.md,
docs/RELAY_STAGE2_PLAN.md) rebuilt the mailbox and made the relay
interchangeable. Both deliberately left the cryptography untouched, and
stage 2's out-of-scope section named this stage explicitly: "**PQXDH /
SPQR / MLS** — stage 3 of the recommendation; the only interaction is
capacity (larger key bundles in the same directory records)". The
crypto spec carries the same backlog items (docs/CRYPTO-SPEC.md §9:
"PQXDH / PQ ratchet (I8/I9) — backlog; pending vetted WASM ML-KEM").

On 2026-11-14 the owner made post-quantum resistance a **mandatory
requirement**, not a roadmap wish. The threat is harvest-now /
decrypt-later: a relay stores sealed envelopes today, and X25519 falls
to a cryptographically-relevant quantum computer whenever one exists,
retroactively exposing every recorded session bootstrap. The industry
answer — and the shape this stage takes — is Signal's PQXDH: keep the
authenticated X3DH exactly as deployed, and mix an ML-KEM shared
secret into the same KDF so the result is secure if **either**
primitive survives.

Like stages 1–2, every step below ships independently, keeps today's
behaviour as the default until the final rollout step, gates anything
new behind a flag or a negotiated capability, and records its outcome
here when it lands.

## Verified starting point (what the code already gives us)

Derived by reading `index.html`, `_worker.js`, `src/crypto/*`,
`tests/pq.test.js` and `docs/CRYPTO-SPEC.md` at main `1ad5520`
(stage-2 step 6, PR #404). Line numbers drift; the shapes are the
load-bearing part.

### The deployed X3DH (v5 handshake)

- Reference: `src/crypto/ratchet.js` — `x3dhInitiator` /
  `x3dhResponder` compute DH1=ECDH(IK_A,SPK_B), DH2=ECDH(EK_A,IK_B),
  DH3=ECDH(EK_A,SPK_B), optional DH4=ECDH(EK_A,OPK_B), then
  `SK = HKDF(concat(DH1..DH4), salt 0^32, info 'breeze-x3dh-v5', 32)`.
  `initiatorHandshake` verifies the SPK signature **before** deriving
  and throws on failure; `bundleFromRelay` maps relay field names to
  the handshake shape; `buildPreKeyMessage` / `parsePreKeyMessage`
  define the first-message envelope `{ v:5, t:'pkm', ik, ek, opkId,
  msg }`.
- Deployed: the same code inlined in `index.html` —
  `_x3dhInitiator` / `_x3dhResponder`, `initSessionV5Initiator`
  (fetch → caps check → SPK verify → derive), the responder mirror
  `_bootstrapResponderSessionV5` fed by `decryptFrom`'s pkm branch,
  and the one-shot `sess._pkm` wrap in `_encryptForRaw`
  (`{ v:5, t:'pkm', ik, ek, opkId, msg }`). Gated by
  `CONFIG.X3DH_V5_ENABLED: true`. Per CLAUDE.md's deployed-vs-reference
  table the authenticated X3DH is **deployed** (inline mirror), not
  reference-only.
- The ratchet bootstrap after SK is `hkdf(dh, SK, 'ratchet', 64)`
  (initiator) — unchanged by this stage: PQ changes only how SK is
  derived, never what consumes it.
- Sealed sender already handles the pkm header specially: the seal
  path relocates `pkm.ik` into the sealed metadata as `_pkik` and
  re-serializes the envelope without it.

### Pre-key bundles: shape, signatures, lifecycle

- Construction is single-point: `generatePreKeyBundle()` in
  `index.html` builds `{ signedPreKey, oneTimePreKeys[], edIdentityKey?,
  signedPreKeySig?, caps?, home? }`. The SPK is a fresh ratchet
  keypair; its private half is stored in the `identity` IDB store as
  JWK under `spk-priv`. One-time prekeys: `CONFIG.PREKEY_OTP_COUNT`
  = 20, private halves as a JWK array under `otp-priv`, index-aligned
  with the worker's echo.
- `signedPreKeySig` is an Ed25519 signature over the **raw SPK bytes**
  by the identity signing key. The worker re-verifies it on upload
  (`verifyEd25519` in `handlePreKeyUpload`, `_worker.js`) and rejects
  an invalid one (`PREKEY_SIG_INVALID`); unsigned bundles are still
  accepted during the v4→v5 transition, an invalid signature never is.
- Upload ownership uses a second, broader signature:
  `prekeyUploadAuth` signs
  `breeze-prekey-upload:{userId}:{ts}:{digest}` where the digest is
  `sha256Short(JSON.stringify([identityKey, edIdentityKey,
  signedPreKey, signedPreKeySig, oneTimePreKeys, caps, x3dh]))` —
  every attacker-malleable key field is bound. The stage-2 **home
  hint is deliberately NOT in the digest** (routing metadata, not key
  material; worker comment in `handlePreKeyUpload`). This distinction
  drives the PQ digest decision below.
- Storage (`handlePreKeyUpload`): bundle JSON at KV `prekey:{userId}`
  — `{ identityKey, edIdentityKey, signedPreKey, signedPreKeySig,
  uploadedAt, caps?, x3dh?, home? }`, TTL 1 month; OTPs individually
  at `prekey:otp:{userId}:{i}` plus a count key; a hash-chained KT
  log entry is appended per identity-key change.
- Fetch (`handlePreKeyFetch`): returns the whole bundle, consumes one
  OTP from the highest live index (delete-before-attach, the consumed
  index echoed as `oneTimePreKeyId`), bounds drain to 1 OTP per
  source IP per 24 h, and attaches `replenishOTP` (≤5 left) /
  `replenishSPK` (uploadedAt older than 25 days) / `keyHistory`.
- Rotation (`checkAndReplenishPreKeys`): on a replenish signal the
  client builds a **fresh** bundle (new SPK + new OTPs), replaces the
  private halves it holds, and uploads to **every** home relay;
  stragglers are retried as-is via `_pendingBundle`. Responders keep
  only the *current* SPK/OTP private halves — the in-flight window
  (peer fetched the old bundle, first message arrives after rotation)
  already exists for the classical keys today.
- The initiator tries the contact's home relays in preference order
  (stage-2 step 6); the first bundle passing **every** check (caps,
  fields, SPK signature) wins, and each relay tried costs one OTP
  there.

### Negotiation

- `src/crypto/negotiate.js`: `CAPS = { X3DH_V5:'x3dh-v5',
  GROUP_V5:'group-v5', FRANKING:'franking' }`, AND rule, fail-closed
  parsing (legacy bundle ⇒ no caps ⇒ features off). `index.html`
  mirrors this inline (`_parsePeerCaps`, `_peerSupportsX3dhV5`) and
  advertises additional caps from CONFIG flags (`seal-v2`,
  `multi-relay`). The worker sanitizes caps on upload (≤20 entries,
  ≤32 chars each) and the caps array is inside the signed upload
  digest.

### Sessions and groups

- Sessions persist in the `identity` IDB store as `sess:{peerId}`
  (`getSession` / `saveSession`). A session is established only when
  none exists (`encryptFor`: `initSessionV5Initiator` →
  `initSession` legacy fallback); an established session's root key is
  never re-derived from prekeys. PQ therefore lands exactly where
  PQXDH lands in Signal: at session establishment, for new sessions.
- Group sender keys (v5 hash ratchet, `ratchet.js`
  `groupSenderEncrypt/Decrypt`, `src/crypto/group.js`) are symmetric
  chain keys **distributed over the 1:1 ratchet channel**:
  `distributeSenderKey` sends `{ type:'sender_key', chainKey, epoch,
  v:5 }` via `encryptFor`. Group traffic itself is HKDF/AES-256-GCM —
  symmetric crypto, where the quantum exposure is Grover-only.

### What already exists for PQ

- `src/crypto/pq.js` (reference-only, roadmap R1) already defines the
  combiner this stage deploys: an **injected** KEM (never hand-rolled),
  `SK = HKDF(DH1‖DH2‖DH3‖DH4‖SS, salt 0^32, info, 32)` with SS last,
  `PQ_INFO = 'breeze-pqxdh-v1'`, and transcript binding — the HKDF
  info carries `sha256(pqpk ‖ ct)` hex, so a swapped ciphertext
  derives a different SK instead of a silently shared one. Its
  doctrine is fail-closed: no "PQ if available" path inside the
  module; classical-only is an explicit caller (negotiation)
  decision. `tests/pq.test.js` pins all of this — with a **mock**
  KEM, because no shipping runtime has ML-KEM yet.
- The client today only **detects** native ML-KEM (`_hasPQ` in
  `index.html`, probing `subtle.supports('encapsulateBits',
  'ML-KEM-768')` etc.) and displays it in /security; per CLAUDE.md it
  never key-agrees with it. `pq.js`'s `webCryptoKem()` adapter is a
  sketch of that future native path (WICG draft; browsers ~2027).

### Hard constraints measured, not assumed

- `index.html` is 15,303 lines; `validate.sh` fails at ≥16,000 and
  its ceiling note records the rule from stage-2 step 6: **the next
  crossing is met with a reduction pass, not another raise.** Free
  headroom today: 697 lines.
- Deployed CSP (`_headers`): `script-src 'self' 'sha256-…' 'sha256-…'`
  — hash-pinned, no `'unsafe-inline'`, and **no
  `'wasm-unsafe-eval'`**, so WebAssembly cannot compile in production
  today. Any `index.html` script change re-pins the hash
  (`node tools/csp-hash.mjs --write`).
- Worker field guards: identity/signed-pre-key fields cap at 5,000
  chars, signatures/keys at 500, OTP entries at 5,000 JSON chars;
  request/payload/envelope caps are 512 KB. ML-KEM-768 sizes (below)
  fit the existing guard *pattern* with room to spare.
- Mirror discipline (AGENTS.md): deployed crypto lives twice —
  `src/crypto/*` reference and the inline copy — cross-tested by
  `tests/mirror-drift.test.js`. Touch one, edit both, `npm test`.

## Design decisions

### D1 — ML-KEM sourcing: vendor @noble/post-quantum (pure JS)

Parameter set first: **ML-KEM-768** (FIPS 203). Sizes: public key
1,184 B (base64 1,580 chars), secret key 2,400 B — or the 64-byte
keygen seed, which is what we persist (D4) — ciphertext 1,088 B
(base64 1,452 chars), shared secret 32 B. (Signal's PQXDH chose
Kyber-1024; Breeze's existing detection and `pq.js` defaults are
already 768-shaped, the hybrid keeps X25519 alongside so the PQ half
at NIST category 3 is not the weak leg, and 768 keeps bundles and
first messages ~30% smaller. The parameter is one constant in the
vendored module if a future review wants 1024.)

Candidates, measured 2026-11-14 against the npm registry and the
actual tarballs:

| Route | Evidence | Verdict |
|---|---|---|
| **@noble/post-quantum 0.7.1, pure JS** | `ml-kem.js` = 586 lines / 27.9 KB. Full import closure (ml-kem + `_crystals.js` + hashes `sha3.js`/`utils.js`/`_u64.js` + curves `abstract/fft.js` + own `utils.js`) ≤ 3,228 lines / 133.7 KB unpruned; the three core files gzip to 16.5 KB. MIT. Deterministic `keygen(seed)`. The repo's own test suite runs **NIST ACVP vectors** (`test/acvp.test.ts`). Same author/family as the ecosystem-standard noble hashes/curves. | **Chosen.** Pure JS runs under the current CSP unchanged; verbatim-pinned vendoring fits the zero-runtime-dep, single-file doctrine; correctness is provable against official vectors (see Verification). |
| crystals-kyber-js 2.7.0 | 362 KB unpacked, 119 files, TypeScript sources (needs a build step the deployed artifact doesn't have); mixed Kyber/ML-KEM lineage. | Rejected: build step + size + provenance. |
| pqc 1.0.13 | 95 KB unpacked, 11 files, "JS Implementation of NIST PQC FIPS Standards", small maintenance/audit footprint. | Rejected: no comparable public vector/audit trail. |
| WASM (liboqs / RustCrypto builds) | Binary + JS glue; base64-inlined into a single file it inflates ×~1.37, instantiation is async against a synchronous inline script model — and the deployed CSP has no `'wasm-unsafe-eval'`, so it **cannot run in production** without a CSP change. | Rejected: blocked by our own CSP; not worth weakening the CSP for. (This also retires CRYPTO-SPEC §9's "pending vetted WASM ML-KEM" assumption.) |
| Wait for WebCrypto ML-KEM | `pq.js` header + `_hasPQ` comment: WICG draft, expected ~2027. | Rejected as the delivery path — the requirement is mandatory now. Kept as a future **adapter swap** behind the same injected-KEM interface (D2), so native support replaces the vendored copy without a protocol change when it ships. |

Vendoring rules (step 1 pins them): verbatim source of the measured
closure at version **0.7.1**, tarball integrity
`sha512-+P9981IiAnVh+rmcubozzVwrEy3XsN/tMhTnvsjV9VDaYpOnNCqWqKo2FLWxbu92YHfjGIlE5XnW175UK+ln+Q==`
recorded in the module header with the MIT license text; **no
algorithm edits** — the only local changes are import rewiring into
this repo's module shape and pruning of exports nothing imports.
Hand-rolling a lattice KEM stays forbidden (pq.js header doctrine):
if it isn't the pinned upstream code, it doesn't ship.

Line budget: the pruned inline form is estimated at ~1,900–2,500
lines (to be measured exactly in step 1 from the vendored reference,
which has identical content). That exceeds the 697-line headroom —
so the client wiring step is **preceded by a dedicated reduction
pass** (step 4) that frees at least the measured requirement with
zero behaviour change, honouring validate.sh's recorded rule instead
of raising the ceiling again.

### D2 — KEM seam: the injected interface pq.js already defines

`createPQXDH({ kem })` takes `{ name, encapsulate(pk) →
{ ct, ss }, decapsulate(sk, ct) → ss }`. Step 1 adds a
`nobleKem768()` adapter over the vendored module (noble's
`encapsulate(publicKey)` → `{ cipherText, sharedSecret }` maps
field-for-field). The deployed session code will call the same
combiner shape (inline mirror), so a future `webCryptoKem()` swap is
a one-adapter change. Fail-closed stands: the combiner throws
without a KEM and never falls back by itself.

### D3 — Bundle: a signed ML-KEM prekey, SPK-shaped

Two new bundle fields, mirroring the SPK pair exactly:

- `pqPreKey`: base64 ML-KEM-768 public key (1,580 chars).
- `pqPreKeySig`: Ed25519 signature over the **raw pqPreKey bytes**
  by the identity signing key — the `signSPK` precedent byte-for-byte
  (the worker's `verifyEd25519` base64-decodes before verifying, so
  raw bytes are what get signed). The initiator verifies it exactly
  where it verifies `signedPreKeySig`, before any derivation; the
  worker verifies on upload when present and rejects an invalid one
  (`PQ_PREKEY_SIG_INVALID`), same doctrine as `PREKEY_SIG_INVALID`.

One key, reused across encapsulations until bundle rotation — this
is PQXDH's design (a *signed prekey*, not a one-time prekey):
ML-KEM is IND-CCA, encapsulating to the same public key many times
is the intended use, and **no OTP-analogue is introduced** (no new
drain surface, no per-fetch PQ consumption). The forward-secrecy
asymmetry this leaves — the PQ prekey lives as long as the SPK does
between rotations — is the same one X3DH already accepts for the
SPK, and closing it fully is SPQR's job (out of scope, below).

Upload-digest decision: the PQ fields are **key material**, so —
unlike the home hint — they join the signed upload digest. The
digest array is **appended to**, keeping the existing seven fields
as a prefix: `[…, x3dh, pqPreKey || '', pqPreKeySig || '']`. Because
client and worker compute the digest independently, the worker step
(step 2) accepts **both** formulas (7-field v1 and 9-field v2)
before any client sends v2, and new clients tolerate old workers
only by the worker-first ordering — a client that includes the PQ
fields in its digest against a v1-only worker would be rejected,
so rollout order is worker → client, as with stage 2's additive
fields. Dropping v1 acceptance is a recorded cleanup once the fleet
has shipped (step 6 outcome notes it; it is per-upload, so the
identity-continuity root — the stored Ed25519 key — is unaffected).

### D4 — Key storage and rotation: seed in IDB, SPK cadence

`generatePreKeyBundle()` gains ML-KEM keygen alongside the SPK.
What persists is the **64-byte keygen seed** as a byte array in the
`identity` IDB store under `pq-priv` (noble keygen is deterministic
from the seed; the 2,400-byte expanded secret key is re-derived on
demand and never stored). Rotation inherits the SPK cadence exactly:
a bundle rotation mints a fresh PQ keypair and replaces `pq-priv`
with the fresh bundle, on every home relay, with `_pendingBundle`
retry — one construction point, no second lifecycle to audit. The
known in-flight window (fetch-then-rotate) is the classical one,
unchanged in kind; step 5's drills exercise it for PQ explicitly.

### D5 — Negotiation: one new cap, AND rule, classical stays explicit

- New capability string `pqxdh` (`CAPS.PQXDH` in negotiate.js, inline
  `CAPS_PQXDH` in index.html), emitted from a new
  `CONFIG.PQXDH_ENABLED` flag — the `X3DH_V5_ENABLED` pattern.
- PQ is used **iff all of**: local flag on, peer bundle caps include
  both `x3dh-v5` and `pqxdh`, `pqPreKey` present, and `pqPreKeySig`
  verifies. Anything else ⇒ today's v5 path, byte-identical. This is
  negotiation choosing classical explicitly — precisely the caller
  decision pq.js's fail-closed doctrine reserves — not a silent
  downgrade inside the crypto.
- Downgrade surface, checked against the deployed shapes: a relay
  cannot strip the KEM ciphertext from a first message (the pkm
  rides inside the ratchet payload; tampering fails AEAD / the I16
  key commitment). A relay serving a **stale** pre-PQ bundle copy
  yields a classical session — the same trust class as today's
  stale-SPK service, bounded by the KT log and by caps living inside
  the signed upload digest. Substituting a foreign `pqPreKey` fails
  `pqPreKeySig`. Stripping caps from a served bundle is an
  availability-only attack, identical to today's caps handling.

### D6 — Session derivation: pq.js's combiner, verbatim semantics

Initiator (in `initSessionV5Initiator`, after both signature
checks): collect DH1..DH4 exactly as `_x3dhInitiator` does today,
`encapsulate(pqPreKey)` → SS, then
`SK = HKDF(DH1‖DH2‖DH3‖DH4‖SS, 0^32, 'breeze-pqxdh-v1:' +
hex(sha256(pqpk ‖ ct)), 32)` — `pq.js`'s `combine()` semantics,
including SS **last** and the transcript-bound info. The classical
path keeps `info 'breeze-x3dh-v5'` untouched, so the two session
types can never derive-collide. Ratchet bootstrap from SK is
unchanged on both sides.

Wire: the pkm envelope gains one optional field, `pqct` — the
1,088-byte KEM ciphertext in the envelope's existing `arr()` byte
encoding (ik/ek convention; ≈4.3 KB of JSON text, far under the
512 KB payload cap; base64 was considered and rejected to keep one
encoding per envelope). `buildPreKeyMessage` /
`parsePreKeyMessage` learn the optional field in lockstep in the
reference module; absent `pqct` parses exactly as today.

Responder (in `_bootstrapResponderSessionV5`): `pqct` present ⇒
decapsulate with the seed-derived secret key and combine — and if
the PQ private half is unavailable (IDB loss), fail closed (return
null into the existing decrypt-failure/reset flow) rather than
deriving a classical SK that cannot match. `pqct` absent ⇒
classical X3DH exactly as today, which is also what an old
initiator talking to our new bundle produces.

### D7 — Groups: inherit, don't rebuild (explicit scope decision)

Stage 3 does **not** change the group wire format or the sender-key
ratchet. Rationale, from the verified shapes above: group chain
keys are random symmetric keys whose *distribution* rides the 1:1
ratchet channel (`distributeSenderKey` via `encryptFor`), so once
1:1 sessions are PQXDH-established, group key distribution inherits
the harvest-now/decrypt-later protection; the group ratchet itself
is HKDF/AES-256 symmetric crypto (Grover-only exposure at 256-bit
keys). A PQ group ratchet (SPQR-style) or an MLS migration is a
separate decision with its own plan — recorded here as a decision,
not an omission.

## Steps

### Step 1 — Vendor ML-KEM-768 and wire it to pq.js (reference only)

Add `src/crypto/mlkem.js`: the pinned noble closure (D1) with
attribution, version and tarball hash in the header. Add the
`nobleKem768()` adapter in `src/crypto/pq.js`. Tests
(`tests/mlkem.test.js`): NIST ACVP ML-KEM-768 vectors — keygen from
fixed seeds reproduces the expected public/secret digests,
encapsulation with fixed entropy reproduces the expected
ciphertext/shared secret, and a wrong-ciphertext decapsulation
returns a *different* secret without throwing (implicit rejection).
Extend `tests/pq.test.js` with the real KEM: initiator/responder SK
agreement through `createPQXDH`, tampered-ct ⇒ different SK.
`index.html` and `_worker.js` untouched; nothing deployed changes.

- **Done when.** Full suite green including the ACVP vectors; the
  vendored module's exact line/byte count is recorded in its header
  (it sizes step 4's reduction target); suite baseline grows from
  1,303 with zero regressions.

- **Outcome (2026-11-14).** Done. `src/crypto/mlkem.js` vendors ML-KEM-768
  from @noble/post-quantum 0.7.1 (closure: @noble/hashes 2.4.0,
  @noble/curves 2.4.0) — **2,243 lines / 89,348 bytes** as committed, the
  exact figure in its header; the header also records all three tarball
  sha512s (post-quantum's matches D1's record verbatim; all three were
  re-verified against the npm registry AND the tarballs actually used),
  the full prune list per source file, and the only local changes
  (import rewiring: `_1n`→`_1nFft` and `aobjectC` disambiguation, the
  `abytes_` alias binding, four documented judgment-call prunes).
  `nobleKem768()` adapter added to `src/crypto/pq.js` (D2 mapping;
  noble's decapsulate argument order is (ct, sk), reversed at the
  boundary). `tests/mlkem.test.js` runs the NIST ACVP ML-KEM-768
  vectors — keyGen 25 / encapsulation 25 / decapsulation 10, extracted
  verbatim into `tests/vectors/mlkem768-acvp.json` — plus deterministic
  keygen, size pins and implicit-rejection properties; `tests/pq.test.js`
  gains the real-KEM agreement and tamper cases. Suite: **1,310 → 1,321
  passed** (the plan's 1,303 baseline had already grown), zero
  regressions; `./validate.sh` PASSED unchanged. `index.html` /
  `_worker.js` untouched, as specified.

### Step 2 — Worker: store, serve, and authenticate the PQ fields

`handlePreKeyUpload` accepts optional `pqPreKey` / `pqPreKeySig`:
string type guards, size guards in the existing pattern
(`pqPreKey` ≤ 2,000 chars — 1,580 is the only valid size class —
signature ≤ 500), Ed25519 verification when both are present with
rejection on failure (`PQ_PREKEY_SIG_INVALID`), storage on the
bundle record, and the upload-digest verification accepting **both**
the v1 (7-field) and v2 (9-field, D3) formulas. Fetch/status serve
the fields as part of the bundle, unchanged otherwise. No client
sends the fields yet, so production behaviour is identical; the
Node host runs the same handlers, so both deployments are covered
by the same tests (stage-2 fixture families).

- **Done when.** Worker tests cover: well-formed PQ bundle stored
  and served; invalid `pqPreKeySig` rejected; oversized/non-string
  fields rejected; v1-digest upload from a legacy-shaped client
  still verifies; v2-digest upload verifies; suite + validate
  green.

- **Outcome (2026-11-14).** Done. `handlePreKeyUpload` accepts the
  optional pair with the SPK doctrine applied byte-for-byte: string
  type guards, size guards (`pqPreKey` ≤ 2,000 chars — 1,580 is the
  only valid size class — `pqPreKeySig` ≤ 500), and Ed25519
  verification over the raw key bytes when the pair and
  `edIdentityKey` are present, rejecting failures with
  `PQ_PREKEY_SIG_INVALID`. One corner the SPK never faces — a
  signature with no key — is rejected under the same code rather
  than stored unverifiable; an unsigned `pqPreKey` is accepted
  during transition exactly like an unsigned SPK and is inert
  (negotiation, D5, requires the signature, and initiators re-verify
  it themselves). The pair is stored on the bundle record, so fetch
  serves it with the whole bundle and status echoes it in the same
  no-OTP shape as caps/home. Caps needed no code: `pqxdh` already
  rides the generic sanitizer and the signed digest.
  Digest acceptance is one deliberate tightening of the text above:
  a body carrying **no** PQ fields verifies under either formula
  (legacy v1, or a PQ-aware client signing v2 over the empty
  append), but a body carrying PQ fields verifies under **v2 only**
  — v1 does not bind them, so accepting it there would let a
  captured v1-signed request be replayed inside its timestamp
  window with PQ fields attached. No shipped client is squeezed:
  step 3 sends the fields and the v2 digest together. Tests:
  `tests/prekey-pq.test.js`, 12 cases (round-trip through upload →
  fetch → status with a real ML-KEM-768 key, tampered key, wrong
  signer, orphan signature, oversized/non-string rejection, and
  the four digest shapes incl. v1-with-PQ-fields rejection and a
  swapped-pair replay). Suite: **1,321 → 1,333 passed**, zero
  regressions; `./validate.sh` PASSED (165/171, unchanged).
  `index.html` untouched, as specified.

### Step 3 — Client: generate, store, upload PQ key material

`generatePreKeyBundle()` mints the ML-KEM keypair (fresh seed per
rotation), stores the seed as `pq-priv`, signs the public key into
`pqPreKeySig`, and adds both fields to the bundle body and to
`prekeyUploadAuth`'s v2 digest. **No `pqxdh` cap is advertised and
no session code changes** — peers see inert fields, nobody can
initiate PQ against a responder that cannot decapsulate yet.
Verify the at-rest key wrap (`CONFIG.AT_REST_KEY_WRAP`, /keywrap)
covers the new `pq-priv` record; if it enumerates records, add it.

- **Done when.** Drills: fresh identity uploads a well-formed PQ
  bundle (worker from step 2 stores it); a rotation replaces the PQ
  keypair on all home relays with `_pendingBundle` semantics intact;
  a pre-stage-3 client fetching the same account's bundle behaves
  exactly as before; suite + validate green.

- **Outcome (2026-11-14).** Done. `src/crypto/pqkey.js` (new, 183
  lines) is the identity-level helper: `mintPQPreKey` (fresh 64-byte
  seed → `ml_kem768.keygen`), `signPQPreKey` (Ed25519 over the RAW
  public-key bytes, injected signer), `buildPQBundleFields`, the
  `pq-priv` record pair (`pqSeedRecord` / `pqSeedFromRecord` — a
  wrapped record refuses a plaintext read), seed-only re-derivation,
  and the D3 digest tail. index.html loads it at runtime per
  INTEGRATION.md §0(A) (an inline module script assigns
  `window.__breezePQKey`; CSP re-pinned — three hashes now) and
  `generatePreKeyBundle` mints inside the existing signing branch:
  sign → store the seed → attach the fields, all inside try/catch, so
  an absent or failing helper yields the classical bundle unchanged
  and self-heals on the next rotation. **No `pqxdh` cap is
  advertised** and no session code changed — the pair is served but
  inert. `prekeyUploadAuth` appends the pair to the digest ONLY when
  the bundle carries it: field-less bundles keep the exact v1 digest
  (pre-step-2 relays still verify them), PQ bundles sign v2, the only
  form step 2 accepts for them. AT_REST_KEY_WRAP: the /keywrap
  enumeration DID enumerate records (`keys`, `signing`), so `pq-priv`
  joined it — enable wraps the `{ seed }` payload under AAD context
  `'pq-priv'`, disable restores it (spk-priv/otp-priv remain outside
  the wrap — the pre-existing scope, unchanged). `sw.js` precaches
  the module closure (pqkey/mlkem/bytes) so a first offline boot
  still mints. One real bug the new tests caught pre-merge:
  WebCrypto `sign()` resolves to an ArrayBuffer, which byte coercion
  silently empties — `signPQPreKey` now normalizes and pins the
  64-byte signature size, so a mangled signer throws instead of
  emitting a pair the Worker would file as "unsigned". Tests:
  `tests/pqkey.test.js`, 18 cases — helper shapes and seed
  determinism, raw-byte signature (and the base64-text trap), seed
  record + at-rest wrap interplay incl. slot binding, the REAL
  sliced `prekeyUploadAuth` → real Worker round-trip under
  `PREKEY_REQUIRE_AUTH` (the seed and the expanded secret asserted
  absent from the wire in every encoding; pair swap ⇒ `SIG_INVALID`;
  field-less v1 parity), and the REAL sliced `generatePreKeyBundle`
  in helper-present / absent / throwing worlds incl. rotation and the
  no-`pqxdh` cap pin. Suite: **1,333 → 1,351 passed**, zero
  regressions; `./validate.sh` PASSED (165/171, unchanged).
  index.html 15,356 → 15,409 lines (+53; headroom 591 under the
  ceiling — step 4's reduction target is unaffected in kind).

### Step 4 — Reduction pass: buy the line budget for the inline KEM

Deletion-first audit of `index.html` (the FIRST-PRINCIPLES pass
validate.sh's ceiling note prescribes): unreachable code, dead i18n
keys, duplicated helpers — landed as a **pure-deletion** change
with zero behaviour change, sized to free ≥ (step 1's measured
inline-KEM lines + ~200 lines of session wiring). If the audit
cannot find the mass, this step stops and reports rather than
reaching for another ceiling raise — that becomes an explicit
decision in this step's PR, not an assumption of this plan.

- **Done when.** `wc -l index.html` leaves headroom ≥ the measured
  requirement under the 16,000 ceiling; full suite + validate.sh
  PASSED; the diff contains no logic change.

### Step 5 — Client session wiring + inline KEM (flag off)

Inline mirrors land in `index.html` (vendored KEM + pq combiner),
cross-tested against the references by the mirror-drift harness.
`CONFIG.PQXDH_ENABLED: false`. With the flag on in tests:
`initSessionV5Initiator` encapsulates and combines per D6 and puts
`pqct` in the pkm; `_bootstrapResponderSessionV5` decapsulates per
D6; cap emission joins `generatePreKeyBundle`'s caps assembly
behind the flag. With the flag off — the shipped default of this
step — behaviour is byte-identical to today.

- **Done when.** The interop drill matrix passes: (flag on/off) ×
  (peer bundle PQ / classical / cap-stripped / bad `pqPreKeySig`),
  first message decrypts in exactly the PQ-or-classical mode the
  negotiation picked; a swapped-`pqct` first message fails
  (transcript binding); the rotate-between-fetch-and-first-message
  drill recovers via the existing reset flow for PQ as it does for
  SPK; ML-KEM keygen/encaps/decaps timings are measured on a
  low-end profile and recorded (session setup is one-shot; no
  per-message cost); suite + validate green; CSP hash re-pinned.

### Step 6 — Rollout: PQXDH by default

Flip `CONFIG.PQXDH_ENABLED` to `true`. Record `pq: true` on the
session record at establishment so support/UI can distinguish
session types; surface it where /security already reports the
crypto stack (`_hasPQ` display becomes "in use" for PQ sessions),
with EN+JA i18n keys for any new user-facing string. Update
docs/CRYPTO-SPEC.md (§2 gains the PQXDH derivation, §9's I8 closes)
and CLAUDE.md's table (pq.js row: reference-only → deployed),
CHANGELOG entry per house practice. Note in this step's outcome:
the v1-digest acceptance from step 2 is retired in a follow-up
once the shipped fleet is confirmed (date/trigger recorded, not
left vague).

- **Done when.** Two fresh clients establish a PQ session by
  default (SK agreement + first-message decrypt, `pq` marker set);
  a previous-release client and a new client interoperate
  classically in both directions; full suite + validate.sh PASSED.

## Verification (across all steps)

- **KEM correctness** rests on official vectors, not round-trips:
  NIST ACVP ML-KEM-768 keyGen / encapDecap test cases run in vitest
  against the vendored reference (step 1) and — via the
  mirror-drift cross-tests — against the inline copy (step 5). A
  self-consistent-but-wrong implementation fails these; that is
  the point of choosing a vector-tested upstream.
- **Combiner correctness** is already pinned by `tests/pq.test.js`
  (SS-last, transcript binding, fail-closed construction); step 1
  re-proves it with the real KEM in place of the mock.
- **Protocol E2E** per step's drills: fetch → verify (SPK + PQ
  signatures) → establish → first message, across the interop
  matrix, including the multi-relay stale-bundle case (an initiator
  whose winning relay serves a classical bundle establishes a
  classical session; one whose winner serves the PQ bundle
  establishes PQ — both decrypt).
- **Gates**: every step lands only with the full vitest suite green
  (baseline 1,303 passed at stage-2 close) and `./validate.sh`
  PASSED; `index.html` changes re-pin the CSP hash; behaviour
  changes are called out in CHANGELOG.md per step, as with
  stages 0–2.

## Out of scope (later stages and other follow-ups own these)

- **SPQR / PQ ratchet** — per-message post-quantum ratcheting that
  would also heal *existing* long-lived sessions. Stage 3 protects
  session **establishment** (PQXDH), as Signal's rollout did;
  sessions established classically stay classical until they reset
  (see Open questions).
- **Group PQ** — beyond the inheritance in D7: no group wire-format
  change, no MLS migration, in this stage.
- **ML-KEM-1024** — parameter revisit only (D1).
- **Native WebCrypto ML-KEM** — future adapter swap (D2), not a
  blocker and not a step.
- **Delivery tokens, relay changes** — the relay stays a dumb
  directory: it stores/serves two more bundle fields and verifies
  one more signature, exactly the SPK pattern; no new endpoints.

## Open questions (unverified at plan time)

- Exact pruned size of the vendored closure as a single module —
  step 1 measures it; step 4's target depends on the number.
- Whether the reduction audit finds enough dead mass in
  `index.html` — step 4 is explicitly allowed to stop and escalate
  (D1 records why a silent ceiling raise is not pre-approved).
- `AT_REST_KEY_WRAP` coverage mechanics for the new `pq-priv`
  record — step 3 verifies whether the wrap enumerates records.
- Whether the desktop/mobile build pipeline copies any CONFIG/caps
  surface besides `index.html` (mirror-drift covers src↔index; the
  dist pipeline check rides along in step 5).
- Opportunistic re-handshake of long-lived classical sessions
  (forcing PQ onto existing contacts) — deliberately not in the
  steps; if wanted, it needs its own UX decision (it would surface
  as key-change warnings today). Default: new sessions only.
- ML-KEM performance on the lowest-end target devices — measured in
  step 5's drill; the fallback if a device class is pathological is
  a per-device flag, not a protocol change.

## Invariants for every step

- The classical path is byte-identical whenever PQ is not
  negotiated: flag off, cap absent, or field absent — each alone is
  sufficient to keep today's behaviour.
- No silent downgrade: the combiner fails closed; choosing
  classical is an explicit negotiation outcome, and a PQ-negotiated
  session that cannot complete PQ fails rather than falling back.
- No hand-rolled cryptography: the KEM is a pinned, verbatim,
  vector-tested upstream copy; local crypto code is limited to the
  already-reviewed combiner and the existing signature patterns.
- The relay never becomes a trusted party by holding PQ material:
  it stores a public key whose authenticity rests on the same
  Ed25519 identity signatures as today's SPK, and the KEM
  ciphertext's integrity rests on the transcript binding + ratchet
  AEAD, not on the relay.
- Full vitest suite + `./validate.sh` PASSED before merge, on every
  step; anything needing a client change keeps the server backward
  compatible behind an additive field or dual acceptance until the
  client fleet has shipped (the established rollout doctrine).
