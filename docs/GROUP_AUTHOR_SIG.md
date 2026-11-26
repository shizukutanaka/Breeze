# Deployed group author signatures, v1

Part B deploys `src/app/group-author.js` through `window.__breezeGroupAuthor`, with no
crypto mirror or dependencies. `group-v5` remains the separate Sender-Key format floor.
This does not deploy the two-layer reference protocol in `src/crypto/group.js`.

## Wire and transcript

Every strict-group primary sender adds `authorSigV: 1` and `authorSig` (canonical base64,
64-byte Ed25519 signature). The existing Ed25519 identity key signs these bytes:

```
UTF8("BreezeGroupAuthor/v1")                          // no NUL or length prefix
U32BE(byteLength(UTF8(groupId))) || UTF8(groupId)
U32BE(byteLength(UTF8(fullAuthorPubB64))) || UTF8(fullAuthorPubB64)
U32BE(epoch) || U32BE(counter)
U32BE(byteLength(UTF8(exactPayloadString))) || UTF8(exactPayloadString)
```

The author is the full encryption public-key base64 STRING, not decoded key bytes,
short contact ID, display name, or signing key. The exact ciphertext JSON string is
signed, including IV, version, key commitment and ciphertext. Reserializing JSON breaks
the signature. Group IDs are nonempty and at most 64 UTF-8 bytes, author fields at most
128 bytes (verification additionally requires a canonical 32-byte public key), payloads
at most 256 KiB UTF-8, and epoch/counter are integers in `[0, 2^32-1]`. The sender rotates
instead of emitting the exhausted counter `2^32-1`. Malformed signature/header/length
checks precede Ed25519 import/verification. Public vector source:
[`tests/vectors/group-author-v1.json`](../tests/vectors/group-author-v1.json), including
Unicode byte lengths, nonzero big-endian numbers, binary hex and a deterministic
signature using the public RFC 8032 test seed (NOT a real account key).

## Trust and strict activation

Verification resolves only an exact local member/contact encryption-key match and its
pinned `sigPub`. Group roster signing keys and envelope `sigPub` are not authority.
For the account's own root, the link-time pinned `identity/account.rootEd` is equivalent
local authority. Never TOFU-pin from a group message.

Local support and EVERY member must support `group-author-sig-v1`. Missing/unknown caps
are false in both inline `_negotiateGroupCaps` and reference `negotiateGroup` (cross-tested).
Relay `/group/info`/prekey caps are hints, not authenticated downgrade protection. A
member proves support by adding `authorCaps: ['group-author-sig-v1']` and `authorCapSig`
inside its existing authenticated 1:1 Sender-Key distribution. `authorCapSig` signs:

```
UTF8("BreezeGroupAuthor/cap/v1") || LP32BE(UTF8(groupId)) || LP32BE(UTF8(fullAuthorPubB64))
```

Before a group is strict, send signed traffic only when all members advertise the new
capability. Mixed/unknown-capability groups stay unsigned for no-signing interoperability.
These relay hints can enable opportunistic signing, never activate/downgrade strict mode.
During authenticated Sender-Key distribution, a missing contact signing pin may be
established through the existing separately verified prekey-bundle fetch, never from the
group envelope, roster or capability proof. Failed key establishment does not count as
support. This also lets the first sender sign while its peer activates strict on that
distribution, without dropping the first message during asymmetric negotiation.
Verify that proof using the already pinned local signing key. It binds support to this
group and full author. Only authenticated proofs count toward AND; seeing a signed
message alone is not a capability declaration. Every participant must have distributed
a key/proof before strict activation; receive-only members can keep a group legacy.
Strict is persisted as `identity['ga-policy:' + groupId]`, never cleared by missing caps,
signing/runtime loss, restart or admitting a legacy member. New strict epochs use fresh
random material, persisted before distribution; rotation forces redistribution even when
activation occurs between initial distribution and encryption. Sending failure uses the
existing send-failed toast rather than silently removing a signature.

Missing signatures are accepted ONLY in legacy mode; invalid/partial/unknown-version
signatures always reject. Unsigned received history stores `authorVerified:false` and
renders localized **Legacy — author not verified**, including older received group history
without a recorded verification status. English and Japanese are supplied;
other locales carry explicit English fallback text pending native review. No claim of
verified human identity is made. A legacy group remains vulnerable to an insider who
strips the signature and forges using another member's symmetric Sender Key.

## State, transport and bounds

The gate runs before decryption, dedup, writes or delivery ACK, including explicitly
forwarded traffic. Local names remain authoritative. Sender-Key hash-ratchet changes
are staged until acceptance. Message text still passes through `_msgSealRecord` before
an atomic IDB transaction commits message, receiver key and replay window together.
Commit failure leaves the receiver state reusable. Backup-dirty notifications still run.
Web Locks plus in-process queues serialize sender-key creation, counter allocation and
receiver acceptance across tabs. The commit transaction rechecks the ratchet snapshot
and replay state; conflicting transactions abort rather than roll state backward.

Replay state is keyed by group/FULL author and stores current epoch, high counter and
at most 1024 accepted counters/message IDs. Older epochs and counters outside the window
reject; out-of-order keys remain bounded by the existing GROUP_MAX_SKIP limit. Successful
control acceptance consumes replay state but is not rendered as a chat message. A stable
SHA-256 transcript tuple is stored alongside messages, retaining existing `member:ts`
message IDs for reply/edit compatibility while preventing a changed outer timestamp
from bypassing replay checks. Same-timestamp ID collisions do not ACK a different tuple.

DC, plain relay, sealed v1/v2, call controls and linked-device copies carry the same
fields. The plain `/msg` allowlist validates/preserves them; `/sealed/send` stores the
whole opaque envelope and has no inner allowlist to update. Old sealed relays therefore
already pass them through. Old **plain** relays must upgrade their allowlist; stripped
signatures fail strict delivery, never downgrade it. Peer relays preserve only enclosed
group fields; their own name/key cannot replace the signed author. Transport queue cleanup
ACKs remain batch-level (and follow processing); direct delivery ACKs require durable
acceptance or a verified, durably accepted duplicate. Expiry, timestamps, reply previews,
group names and other outer metadata are NOT authenticated by this version.
Edits/deletes remain separately pairwise-encrypted controls, not Sender-Key ciphertexts;
their authenticated sender must match the original message author before history changes.

## Explicitly deferred

- Membership consensus. A sticky strict floor now permits an exact-roster legacy
  exception only through the pinned admin's sequenced signature and explicit
  default-cancel warning. New signed invitations establish admin anchors; existing
  groups require contact verification and explicit group-screen confirmation, never
  relay roles. Persistent notices track reduced/restored protection. See the
  authenticated legacy-admission section of [CRYPTO-SPEC.md](CRYPTO-SPEC.md).
- Root-signed device **signing-key** bindings. The current registry binds encryption
  keys only. Secondary senders are unsigned/visibly legacy until separately pinned;
  they cannot send into strict groups. Root copies still reach linked devices using
  the root pin established at linking. No new device-key wire/TOFU scheme is invented.
- Signing runtimes without Web Locks stay legacy-only, rather than risk cross-tab
  counter reuse. Without Ed25519, signed traffic cannot be accepted.
- AFKS/per-message signing-key ratchets, explicit epoch-consensus protocol, selective
  relay ACKs and large-scale performance/physical-device acceptance are not claimed.
  One Ed25519 identity signature per ciphertext is the bounded deployable essential.

Tests: `tests/group-author*.test.js`, `tests/group-sender-auth.test.js`, and the
author-capability parity block in `tests/mirror-drift.test.js`; run `npx vitest run`.
