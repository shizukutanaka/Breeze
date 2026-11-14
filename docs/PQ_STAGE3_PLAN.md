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

- **Outcome (2026-11-14).** STOPPED per this step's own condition —
  the audit cannot find the mass. The step's PR lands the provable
  deletions and records the decision Step 5 now needs; it does not
  reach for another ceiling raise, and Step 5 must not be sized on
  the assumption that the budget exists. Requirement: headroom ≥
  2,443 (Step 1's measured 2,243 vendored-KEM lines + ~200 wiring),
  i.e. `index.html` ≤ 13,557 lines, i.e. ≥ 1,852 lines of pure
  deletion from the 15,409-line start. Measured yield of a
  deletion-first audit (transitive reachability over all 380
  inventoried functions in the main script — masking-aware,
  cross-checked by grep over the whole tree and the full suite):
  **50 lines** (15,409 → 15,359; headroom 591 → 641; shortfall
  1,802). Per category: unreachable functions — `fetchRetry`
  (20 lines incl. its header comment; never called, only its own
  log string names it) and the `safeRedirect`/`safeOpen` pair plus
  `SAFE_REDIRECT_DOMAINS` (24 lines; sole consumer billing is gone
  and the allowlist is empty, so the pair guarded nothing — a
  future redirect re-adds them with its consumer); dead i18n keys —
  0 unreferenced (gate-enforced), but 4 shadowed duplicate EN keys
  (`copy`/`forward`/`unmute`/`read`, identical values, first
  occurrence dead) that `tools/i18n-check.mjs` cannot see because
  it collapses the object literal; duplicated helpers — 0
  same-scope duplicate declarations; dead CSS — `.i-abs` and
  `.i-search-hl` (2 lines; three further candidates,
  `.toast-success/-error/-info`, proved live via the dynamic
  `'toast-' + type` construction). Explicitly NOT deleted:
  `dcSend` (unreachable in production but pinned as the extraction
  landmark of `tests/outbox-idb.test.js`), and two audit false
  positives verified live by inspection (the
  `migrateToMultiAccount` IIFE, which executes at load; the
  Electron `window.Notification` class constructor). Considered
  and rejected as mass: the script's 2,350 comment-only and 645
  blank lines — deleting documentation to hit a numeric target
  would gut the audit trail the house style deliberately keeps,
  and comments on live code are not dead mass in this step's
  categories; reachable feature code (deletion = behaviour change,
  forbidden here). Verification: full suite **1,351 passed**
  (baseline re-run on the identical tree after one flaked run),
  `./validate.sh` PASSED (165/171, unchanged), CSP hash re-pinned
  (`tools/csp-hash.mjs --write`, `_headers` + tauri.conf.json
  synced), the diff is 50 deletions / 0 insertions in `index.html`
  — no logic change. **Decision Step 5 needs (explicit, not
  assumed):** (a) re-measure the inline requirement (an
  inline-specific minimized KEM form is unmeasured; the 2,243
  figure is the reference module's), or (b) an owner decision on
  the 16,000 ceiling, or (c) re-scope Step 5's "inline" in light
  of Step 3's deployed module-loading precedent
  (`src/crypto/pqkey.js`). Until one is taken, Step 5 does not
  start.

  **Decision taken (2026-11-14, technical judgment): option (c).**
  Step 5 is implemented in Step 3's module-deployment shape, not as
  an inline mirror. Grounds: Step 1's `src/crypto/mlkem.js` and
  Step 3's `src/crypto/pqkey.js` are already deployed as ESM with no
  inline mirror (recorded as such in CLAUDE.md's deployed-vs-
  reference table), and Step 3 connects to the app body through the
  `window.__breezePQKey` bridge — the deployment route is proven in
  production shape, and pq.js's combiner follows it through a new
  facade (`src/crypto/pqxdh.js`). Step 5's `index.html` change is
  therefore session wiring only (measured +110 lines against the
  641-line headroom), and neither (a)'s re-measurement nor (b)'s
  ceiling decision is needed. Step 5's premise below is updated to
  this route.

### Step 5 — Client session wiring (flag off)

Per the Step 4 decision above, the KEM + combiner are NOT inlined:
`src/crypto/pqxdh.js` — a small facade over pq.js's combiner and
the `nobleKem768()` adapter — is deployed as ESM and runtime-
imported by `index.html` (exposed as `window.__breezePQXDH`, the
`__breezePQKey` precedent); `index.html` carries session wiring
only. `CONFIG.PQXDH_ENABLED: false`. With the flag on in tests:
`initSessionV5Initiator` encapsulates and combines per D6 and puts
`pqct` in the pkm; `_bootstrapResponderSessionV5` decapsulates per
D6; cap emission joins `generatePreKeyBundle`'s caps assembly
behind the flag. With the flag off — the shipped default of this
step — behaviour is byte-identical to today. Parity is pinned at
the seams that can drift (the inline negotiation/signature gate
and the responder bootstrap, against negotiate.js + the pq.js
combiner with the real KEM) by the mirror-drift harness's PQXDH
block; the combiner itself stays single-sourced in pq.js.

- **Done when.** The interop drill matrix passes: (flag on/off) ×
  (peer bundle PQ / classical / cap-stripped / bad `pqPreKeySig`),
  first message decrypts in exactly the PQ-or-classical mode the
  negotiation picked; a swapped-`pqct` first message fails
  (transcript binding); the rotate-between-fetch-and-first-message
  drill recovers via the existing reset flow for PQ as it does for
  SPK; ML-KEM keygen/encaps/decaps timings are measured on a
  low-end profile and recorded (session setup is one-shot; no
  per-message cost); suite + validate green; CSP hash re-pinned.

- **Outcome (2026-11-14).** Landed in the module-deployment shape
  decided at Step 4. What changed: **new `src/crypto/pqxdh.js`**
  (~110 lines) — the session facade over pq.js's combiner +
  `nobleKem768()`: `initiateSK(dhParts, pqPreKeyPub)` and
  `respondSK(dhParts, pqPrivRecord, pqct)`, fail-closed by
  construction (a missing/wrapped seed record or a wrong-size
  ciphertext returns `null`, never a classical secret; DH-part
  counts outside 3–4 throw, so a DH mix-up is an error, not a
  weaker SK). **`src/crypto/negotiate.js`**: `CAPS.PQXDH` and
  `negotiate().usePqxdh` (the D5 AND rule). **`src/crypto/
  ratchet.js`**: `buildPreKeyMessage`/`parsePreKeyMessage` carry
  the optional `pqct` in the same `arr()` byte encoding as `ik`/
  `ek`, present only when set (classical envelopes are
  byte-identical in shape). **`index.html`** (+110 lines, 15,359 →
  15,469; headroom 531): the module import +
  `window.__breezePQXDH`; `CONFIG.PQXDH_ENABLED: false`;
  `generatePreKeyBundle` advertises `pqxdh` only when the flag is
  on AND the bundle actually minted its pair; the X3DH block gains
  `CAPS_PQXDH`, `_peerSupportsPqxdh` (AND rule), parts-returning
  refactors of the two X3DH derivations (classical outputs
  unchanged — the pre-existing parity guard pins byte equality),
  `_pqxdhInitiator` (presence → size → Ed25519 verification of
  `pqPreKeySig` over the raw public-key bytes → encapsulate; any
  failure degrades to classical `null`), and `_pqxdhResponder`;
  `initSessionV5Initiator` recomputes the DH parts and swaps the
  SK + carries `pqct` in `_pkm` → the sealed pkm envelope;
  `_bootstrapResponderSessionV5` branches on `flag && pqct`: a PQ
  private half that cannot answer returns `null` (fail-closed
  into the existing decrypt-failure path) instead of deriving
  classically; with the flag off a `pqct` is ignored and the
  classical derivation runs byte-identically (pinned). **`sw.js`**
  precaches the facade closure (`pqxdh.js`, `pq.js`). **Tests:
  1,390 passed (baseline 1,364; +26, zero regressions)** —
  `tests/pqxdh.test.js` (new, 16: facade agreement with the real
  KEM in both cross directions, fail-closed shapes, first-message
  composition incl. swapped-`pqct` failure, sliced-bundle cap
  emission, structural pins), mirror-drift's new 'PQXDH mirror'
  block (7: negotiation parity over the flag × caps matrix,
  real-KEM SK agreement both directions, the initiator downgrade
  matrix — swapped key / foreign signature / incomplete pair /
  missing facade — fail-closed bootstrap, flag-off classical
  bootstrap, and the fetch-rotate-recover drill), negotiate +3,
  x3dh +2 (envelope round-trip; malformed `pqct` parses as
  absent); the two pq.js reference-only pins retired with a
  graduation note (the markers never appear in the single-file
  artifacts by design of this deployment route, exactly as with
  `mlkem.js`). `./validate.sh` PASSED (165/171); CSP hash
  re-pinned (`_headers` + tauri.conf.json). **Timings** (this
  development VM — 1.5 shared vCPUs, the low-end proxy; Node 24,
  n=60): keygen-from-seed ≈ 1.8 ms, encapsulate ≈ 1.23 ms,
  decapsulate ≈ 0.66 ms — orders under D4's 50/20 ms bars, and
  session setup is one-shot (no per-message cost). **Security
  review.** Downgrade surface: the `pqxdh` cap and the PQ fields
  ride inside the step-2 signed upload digest, so a relay cannot
  strip or alter them on a v2 upload without invalidating the
  signature (a v1-signed replay carrying PQ fields is refused at
  upload — step 2); a network attacker between two PQ-capable
  peers can at most withhold delivery. Stripping the cap from a
  *served* bundle makes the initiator classical for that attempt —
  the same trust class as today's stale-SP K handling (bounded by
  the KT audit path + SPK/PQ rotation cadence), not a new class.
  Signature verification is mandatory on the initiator path (every
  failure is a classical degrade, never an unverified
  encapsulation); the responder is fail-closed rather than
  fail-classical when a `pqct` arrives. Flag default OFF verified
  in the shipped CONFIG and pinned by test. No new runtime
  dependencies; no new user-facing strings; the new CONFIG
  constant is the one D5 itself specifies. **Residual risks /
  known limitations:** (1) a device whose `pq-priv` is
  /keywrap-wrapped cannot answer PQ sessions until a boot-time
  unwrap exists — `loadIdentity` unwraps `keys`/`signing` only,
  so such devices fail closed on PQ pkms (classical sessions
  unaffected); follow-up: extend the at-rest unlock path to
  `pq-priv`. (2) If the ESM facade fails to load, the client
  degrades to classical bundles/sessions — the module ships
  same-origin (precached by sw.js) so a relay cannot strip it,
  but the degradation is silent by the step-3 doctrine; support
  can distinguish via the session record once Step 6 records
  `pq: true`. (3) Old-bundle staleness: initiating against a
  rotated bundle yields an SK mismatch that surfaces as a
  first-message decrypt failure and recovers through the existing
  reset/re-fetch flow — drilled at unit level; the manual
  two-device run (docs/INTEGRATION.md) remains the end-to-end
  confirmation, extended to the PQ path once Step 6 flips the
  flag.

### Step 6 — Rollout: PQXDH by default

Flip `CONFIG.PQXDH_ENABLED` to `true`. Record `pq: true` on the
session record at establishment so support/UI can distinguish
session types; surface it where /security already reports the
crypto stack (`_hasPQ` display becomes "in use" for PQ sessions),
with EN+JA i18n keys for any new user-facing string. Update
docs/CRYPTO-SPEC.md (§2 gains the PQXDH derivation, §9's I8 closes)
and CLAUDE.md's table (pq.js row: reference-only → deployed —
done early in step 5, which deployed the code path behind the
flag), CHANGELOG entry per house practice. Note in this step's outcome:
the v1-digest acceptance from step 2 is retired in a follow-up
once the shipped fleet is confirmed (date/trigger recorded, not
left vague).

- **Done when.** Two fresh clients establish a PQ session by
  default (SK agreement + first-message decrypt, `pq` marker set);
  a previous-release client and a new client interoperate
  classically in both directions; full suite + validate.sh PASSED.

- **Outcome (2026-11-14).** Done — stage 3 is complete. The flip
  itself is one line; most of this step is the prerequisite step 5's
  residual risk (1) demanded, plus the surfacing. **Prerequisite:
  the keywrap boot unlock (closes step-5 residual (1)).**
  `loadIdentity`'s passphrase flow now extends to `pq-priv` via a
  new `_unlockPqSeed`: when the stored record is /keywrap-wrapped,
  the passphrase `loadIdentity` already collected (or one cancellable
  prompt in the partial-disable state — plaintext `keys` beside a
  wrapped `pq-priv`) unwraps the seed into a memory-only variable,
  and `_pqxdhResponder` answers from it when the stored record is
  wrapped. A plaintext record (the latest mint — a rotation replaces
  it) always wins over the boot seed. The stored record is NEVER
  rewritten by the unlock and the wrap is never read through at
  session time, so at-rest protection is unchanged (the seed's
  memory exposure is the `_signingKey` class: held only after the
  user's own unlock, for the boot's lifetime). A wrong passphrase or
  a cancelled prompt holds nothing; the unlock never blocks sign-in
  and PQ simply stays fail-closed for that boot. **The flip.**
  `CONFIG.PQXDH_ENABLED: true`; negotiation is D5's AND rule
  unchanged, so non-`pqxdh` peers keep byte-identical classical v5.
  **Markers + surfacing.** `initSessionV5Initiator` and
  `_bootstrapResponderSessionV5`'s PQ branch record `pq: true` on
  the session record (persisted by `saveSession`); `/security`'s PQ
  section gains a PQXDH line reporting the ACTIVE session's marker,
  and the stack Status names the software KEM
  (`secPQSoftware`) instead of "planned" when the browser lacks
  native ML-KEM — 3 new i18n keys, EN + JA. **Docs.**
  `docs/CRYPTO-SPEC.md` gains §2a (the PQXDH derivation, negotiation,
  wire and key-material rules), §3's envelope gains `pqct`, and §9's
  I8 closes (I9, the PQ ratchet, remains a separate decision);
  `SPEC.md` §2.4 and its compliance row, and CLAUDE.md's pq.js row,
  now state the shipped default. **Tests: 1,401 passed (baseline
  1,390; +11, zero regressions)** — mirror-drift: the DEFAULT-ON
  DRILL (two fresh inline clients: fetch → verify → PQ session, SK
  agreement against the reference combiner, `pq` markers both
  sides, first message decrypts), DEFAULT-ON INTEROP (a
  previous-release bundle — no cap, no PQ fields — yields a
  classical session with no marker, no `pqct`, classical SK parity;
  the reverse direction is step 5's flag-off pin), the KEYWRAP
  DRILL (wrapped record: locked boot fails closed, boot-unlocked
  seed derives the initiator's SK, stored record byte-identical
  afterwards), and the PRECEDENCE pin (plaintext mint wins over a
  stale boot seed); tests/pqxdh.test.js: the real inline
  `_unlockPqSeed` sliced and driven (passphrase reuse, wrong
  passphrase, partial-disable prompt, cancel, plaintext/absent
  no-ops, seed-length guard) and the shipped-default structural pin
  flipped to ON. `./validate.sh` PASSED (165/171, baseline score);
  CSP hash re-pinned; `index.html` 15,469 → 15,529 lines (headroom
  471 under the 16,000 ceiling). **v1-digest retirement (step 2
  follow-up, scheduled here as required):** step 2's acceptance of
  the v1 upload digest is retired in a follow-up once the first
  release shipping this step has been live for 30 days — the point
  at which the shipped fleet can be taken to have rotated onto
  v2-signed uploads; until then both forms stay accepted, as step 2
  designed. **Security review.** Newly enabled surface: the PQ path
  step 5 analysed (caps + PQ fields inside the signed upload
  digest, mandatory initiator-side `pqPreKeySig` verification,
  responder fail-closed) is now the default for capable peers — no
  new mechanism, only wider exercise of it. The boot unlock adds
  no at-rest weakness (above) and no new network surface. The
  standing D5 caveat is worth restating at rollout: PQXDH here is
  negotiated, not mandatory — a relay serving a stale or
  cap-stripped bundle still yields a classical session (the
  pre-existing stale-SPK trust class, bounded by the KT audit path
  and rotation cadence). **Residual risks.** (1) The manual
  two-device run (docs/INTEGRATION.md) extended to the PQ path
  remains unexecuted — the drills above are inline/unit-level
  evidence, as with every prior step; the two-device confirmation
  is still owed and is the first thing to run against a deployment
  of this build. (2) The step-5 residual (2) (silent classical
  degradation if the ESM facade fails to load) is now DETECTABLE
  via the `pq: true` marker and the /security PQXDH line, as step 5
  anticipated; the degradation behaviour itself is unchanged.
  **Stage 3 complete:** all six steps landed — vendored ML-KEM-768
  (ACVP-verified), worker PQ fields with signed-digest binding,
  client key material, the reduction-pass decision, session wiring
  behind the flag, and this default-on rollout with the keywrap
  prerequisite closed.

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
