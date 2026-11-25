# Auditing Breeze — a map for external reviewers

*Prepared 2026-11-20 (SHARE_PLAN stage 7 step 2). Breeze has not
yet had an independent external audit; this document exists to
make one possible from the repository alone.*

## Start here

1. `docs/CRYPTO-SPEC.md` — the protocol specification: X3DH v5,
   PQXDH, Double Ratchet, group sender keys, at-rest protection,
   franking, safety numbers, call signalling, worker endpoints,
   and the known-gaps sections (§8/§9), which are kept current.
2. `CLAUDE.md`, the *Deployed vs reference-only* table — the
   authority on which `src/crypto/` modules actually run in the
   shipped client, and in what form (inline mirror in
   `index.html`, runtime-imported ESM, or reference-only).
   Confusing the two classes is the easiest way to misread this
   codebase, in either direction.
3. `docs/COMPARISON.md` — the public claims, each with its
   verification path.

## Reproduce everything

```bash
npm ci
npm test        # the full suite (it prints the live test count)
./validate.sh   # structural/convention gates; must print PASSED
```

No network, account, or service is needed. The worker is tested
in-process against mock KV/DO stores (`tests/helpers/`).

## Test vectors (known answers)

| File | Covers | Replay |
|---|---|---|
| `tests/vectors/session-kat.json` | A full X3DH v5 session establishment (with OPK) → Double Ratchet first message: test-only private keys (JWK), the shared secret, first chain/message keys, and a recorded wire message | `tests/session-vectors.test.js`; regenerate with `tools/gen-session-vectors.mjs` |
| `tests/vectors/mlkem768-acvp.json` | ML-KEM-768 against NIST ACVP vectors | `tests/mlkem.test.js` |
| `tests/vectors/rendezvous-codes.json` | Offline pairing / rendezvous code derivation | `tests/rendezvous.test.js` |
| (inline) `tests/kat.test.js` | HKDF-SHA256 (RFC 5869), AES-256-GCM (NIST), X25519 (RFC 7748) known answers | — |

## Module map (`src/crypto/`)

| Module | Role | Status (see CLAUDE.md table for the binding version) |
|---|---|---|
| `ratchet.js` | X3DH v5, Double Ratchet, group sender keys v5, key commitment | deployed (inline mirror) |
| `pq.js` / `pqxdh.js` / `pqkey.js` / `mlkem.js` | PQXDH hybrid (X25519 + ML-KEM-768) | deployed (ESM) |
| `seal.js` | Sealed Sender v2 metadata encryption | deployed (inline mirror) |
| `negotiate.js` | Capability negotiation (v4↔v5, PQ, group AND-rule) | deployed (inline) |
| `ktlog.js` | Key-transparency hash chain (audit path) | deployed (inline mirror) |
| `atrest.js` | At-rest key wrapping | deployed (inline mirror) |
| `msgstore.js` | Message-body encryption at rest (AES-256-GCM under the keywrap `msgkey` slot, per-record AAD) | deployed (inline mirror) |
| `pow.js` | Proof-of-work anti-spam | deployed (inline mirror) |
| `franking.js` | Message franking for abuse reports (commitment deployed; full report verification reference-only) | partial |
| `fingerprint.js` | Iterated safety numbers | reference-only (enhancement; the deployed number is already 96-bit — see CLAUDE.md) |
| `seed.js` / `wordlist.js` | Account seed & BIP39 recovery phrase | deployed (ESM) |
| `group.js` | Group state helpers | see spec §5 |
| `bytes.js` | Shared byte/encoding + constant-time compare helpers | deployed |

Inline↔reference parity is enforced by
`tests/mirror-drift.test.js`: the shipped single-file client and
the reference modules are cross-tested so they cannot silently
diverge.

## Scope notes for a reviewer

- **In scope:** the client crypto and session protocols, the
  relay worker's handling of sealed envelopes (it is designed to
  be unable to read content — verify that claim against
  `_worker.js`), capability negotiation and downgrade behaviour,
  at-rest storage.
- **Out of scope / platform-given:** WebRTC media encryption
  (DTLS-SRTP from the browser), WebCrypto primitive correctness,
  the hosting platform (Cloudflare) itself.
- **Known limitations, stated by us:** no continuous PQ
  re-keying (SPQR-class) yet; franking cannot bind a *malicious*
  sender; real-device / real-network validation is thinner than
  the in-process drill coverage (see `docs/COMPARISON.md`,
  "Where Breeze loses").

## Reporting

Please use
[GitHub Security Advisories](https://github.com/shizukutanaka/Breeze/security/advisories/new)
for vulnerability reports (see `SECURITY.md`). Protocol-design
questions and vector mismatches are welcome as regular issues —
a vector that does not replay is a bug by definition here.
