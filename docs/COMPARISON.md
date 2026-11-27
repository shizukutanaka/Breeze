# How Breeze compares — and how to check every claim

*Last verified against the code: 2026-11-20 (app version 3.7.0).*

This page exists so you do not have to trust it. Every Breeze claim
below names the test file or source anchor that proves it, and the
whole suite runs offline:

```bash
git clone https://github.com/shizukutanaka/Breeze
cd Breeze && npm ci && npm test
```

Claims about Signal and LINE cite their sources ([S1]–[L2] at the
bottom) and describe those products as documented there, not as we
would like them to be. Where Breeze loses, this page says so.

## The table

| Topic | Breeze | Verify it | Signal | LINE |
|---|---|---|---|---|
| Registration | A key pair only. No phone number, no email | `tests/registration-admission.test.js`; identity creation in `index.html` never asks for either | Phone number required (usernames hide the number, registration still needs it) [S1] | Phone number (or a linked account) |
| Central server | None required. Relays are replaceable and self-hostable; each contact can have a different home relay; sealed mail can be deposited on several relays at once | `tests/relay-multirelay.test.js`, `tests/relay-discovery.test.js` | Central: the official service is the only fabric (self-hosting does not federate) | Central: official fabric only |
| E2EE scope | All 1:1 and group messages (groups up to 1,000). Call signalling is end-to-end encrypted by default | `CONFIG.GROUP_MAX` in `index.html`; `tests/group-scale.test.js`; `tests/call-signal.test.js` (`CALL_E2E_SIGNAL` defaults on) | Everything incl. calls, groups up to 1,000; the service does not even hold group membership [S2] | Letter Sealing covers 1:1 and groups up to 50 (text/location/media) and 1:1 calls only; group calls, meetings, albums and notes are transport-encrypted only; a bot joining ends the protection [L2] |
| Post-quantum | On by default: PQXDH — ML-KEM-768 mixed into X3DH, hybrid with X25519 | `tests/pqxdh.test.js`, `tests/mlkem.test.js` (includes ACVP vectors); `PQXDH_ENABLED: true` in `index.html` | Deployed: PQXDH (2023) plus SPQR / Triple Ratchet (2025), which keeps re-keying with ML-KEM continuously [S3] | No post-quantum plan in the published Encryption Report 2025 [L2] |
| Ads / tracking | None — and the operator could not add content-based tracking if it wanted: relays hold sealed envelopes only | `tests/data-principle.test.js`; the relay handlers in `_worker.js` store no plaintext | None (non-profit, donations) [P1] | Ads are a core business; URL previews are generated server-side [L1][L2] |
| Group size | 1,000 (sender keys, distributed on a schedule rather than per message) | `tests/group-scale.test.js` (send drill at n=100/300/1,000) | 1,000 [S2] | Large groups exist, but E2EE stops at 50 [L2] |
| Calls | 1:1 voice/video, plus group voice calls up to 8 (full mesh, signalling E2EE) | `tests/call-signal.test.js`, `tests/group-call.test.js`; `GCALL_MAX_PARTICIPANTS` in `src/app/group-call.js` | 1:1 and group calls | 1:1 and group calls (E2EE: 1:1 only [L2]) |
| Self-hosting | Yes: Cloudflare, Docker or plain Node; registration can be closed with an allowlist | `docs/SELF_HOSTING.md`; `REGISTRATION_ALLOWLIST` in `_worker.js`; `tests/node-host.test.js` | Practically no | No |
| Moving in | Invite links, QR, `@alias@relay` addresses; chat-history import for LINE / WhatsApp / Telegram exports | `src/app/import-parsers.js` (`parseLINE` / `parseWhatsApp` / `parseTelegram`); `tests/relay-discovery.test.js` | Usernames, QR, group links; the phone-number wall remains [S1] | Platform-internal only |
| What it costs to run | The app is free (MIT). The distributed builds ship with no server configured — you add your own relay (self-hosted, or an operator's). An operator may offer a free entrance up to a fair-use quota on their relay; past that, cost sits with each user's own placement — never with a central operator | `docs/COST_MODEL.md` (the measured model), `tests/mailbox-usage-quota.test.js` | Non-profit + donations | Ads, payments, paid official accounts |

## Where Breeze loses — stated plainly

- **Scale and track record.** Signal serves ~70M monthly users
  [P1]; LINE serves 100M accounts in Japan alone [L1]. Breeze has
  neither the user base nor a decade of incident history.
- **Post-quantum depth.** Signal's SPQR re-keys continuously
  (Triple Ratchet) [S3]. Breeze's PQXDH protects the session
  setup; continuous PQ re-keying is not implemented.
- **External audit.** Signal's protocols are publicly analysed.
  Breeze's cryptography is specified in `docs/CRYPTO-SPEC.md` and
  covered by the test suite, but has **not** had an independent
  external audit. Treat it accordingly.
- **Everyday thickness.** LINE is a daily-life platform
  (payments, official accounts, services). Breeze is a messenger
  and only a messenger.
- **Unverified on real devices.** Two-device calls, three-party
  group calls and real-network WebRTC paths are covered by
  in-process drills, not by a public real-device test programme.

## Keeping this page honest

`tests/comparison-claims.test.js` pins the load-bearing numbers
above (group maximum, call-signalling default, PQ default, group
call cap, self-host allowlist, the three import parsers) to the
code. If the code changes and this page does not, the test suite
fails. If you find a claim here that the code does not back,
please open an issue — that is exactly the failure this page is
designed to make visible.

## Sources

- [S1] Signal registration requires a phone number; usernames
  exist to hide it. EFF Surveillance Self-Defense, Signal guide:
  https://ssd.eff.org/module/creating-and-managing-signal-groups
- [S2] Signal group chats (1,000 members; the service does not
  hold group state): https://support.signal.org/hc/en-us/articles/360007319331-Group-chats
- [S3] Signal PQXDH (2023-09-19) and SPQR / Triple Ratchet
  (2025-10-02): https://signal.org/blog/pqxdh/ and
  https://signal.org/blog/spqr/
- [L1] LINE user scale: LY Corporation announcements as compiled
  at https://signal-base.net/media/sns-riyousha-suu-data
- [L2] LINE Encryption Report 2025 (Letter Sealing scope):
  https://www.lycorp.co.jp/en/privacy-security/security/transparency/encryption-report/2025/
- [P1] Signal ~70M monthly users (2025-04, as quoted from M.
  Whittaker) — see docs/SHARE_PLAN.md §8 for the full citation
  trail behind every row of the internal analysis this page is
  drawn from.
