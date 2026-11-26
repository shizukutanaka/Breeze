# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Read in another language**: [日本語](../../README.md) · English (this page) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**An encrypted messenger — no phone number, no registration.**
Only the sender and the receiver can read the contents of a conversation. Not even the server that carries it in between can read it.
Every feature is free, and there are no ads.

This is not a web page; it is software you install and use (Windows / Mac / Linux / Android / iPhone / browser).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## To use Breeze, you host it on your own server

Breeze has no "operating company's server." **To use it, you provide a place to run it (a server) yourself, and you put Breeze there. That is the intended way to use it.**

- The standard setup uses Cloudflare, so **a Cloudflare account is required**. The steps are in the [Self-Hosting Guide](SELF_HOSTING-en.md) (you can choose other languages from the top of the guide).
- Get the apps (Windows / Mac / Linux / Android / iPhone) from the [download page](https://github.com/shizukutanaka/Breeze/releases/latest) and use them connected to your own server.

For detailed usage, see the [Manual](MANUAL-en.md) (you can choose other languages from the top of the manual).

## How to use (3 steps)

1. Open the Breeze you hosted on your own server (or the address you were told by the person who hosted it), and press "Start with a random ID" (you can enter a name if you like). That is all it takes to be ready (no registration, no phone number). At that moment, a "key" is created inside your device, and that key becomes your identity.
2. Give your ID or QR code to the person you want to talk to.
3. If the other person also has the app open, you connect directly and can talk. When they do not have it open, your message waits, still encrypted, in a "mailbox," and is delivered when they open the app. The server carrying the mailbox cannot read the contents. A letter that is never delivered is automatically deleted after at most 7 days.

## Promises (what we will not do)

- **No ads.** Not in the app, not anywhere.
- **No tracking.** No usage analytics, no advertising machinery, no selling of data — none at all.
- **The people who made this do not hold users' data.** There is no list of accounts on the server side at all. Your identity is only the key inside your device.
- **Conversations are encrypted between devices.** The server only ever handles envelopes it cannot read.

We also state the scope honestly. In order to deliver messages, the server holds things briefly (undelivered envelopes for at most 7 days, connection signals for 5 minutes, address and device records for 90 days, group information and notification subscriptions for 30 days. All of these are deleted automatically, and the contents cannot be read). Cloud backup is disabled at first. If you host it on your own server, that holding is under your own control too.

## What it can do

- One-to-one conversations and group conversations (up to 1,000 people)
- Voice calls and video calls (group calls up to 8 people)
- Call history (kept only on this device: the other person, direction, time, and call duration only — nothing of what was said. Never sent to a server or to the other person)
- File sending (up to 50MB one-to-one. Groups can send files too, but the size limit is smaller)
- Use across multiple devices and multiple accounts (for example, work and personal. Both the number of devices and the number of accounts are free and unlimited)
- Automatic backup (when something changes, an encrypted backup is saved automatically to your own server. On a new device, once you recover your identity, a backup is found automatically and offered to you. Settings also guide you through moving to a new device)
- A name you choose for each contact (you can rename each contact, stored only on this device. You can also choose whether the name each contact set for themselves is shown)
- 51 languages (English plus 50 language files), selected automatically to match your device's language
- Profiles with a photo, stickers, location sharing
- Command operations such as `/help` (71 kinds)
- Power modes matched to your battery (automatic / normal / power saving / emergency). As the battery runs down, delivery checks are spaced out so the battery lasts longer. A safeguard for disasters and other times when you cannot recharge
- Bottom tabs on a phone (Chats / Calls / Contacts / Profile / Settings. Which tabs are shown can be chosen in the settings)
- Readable screens (attention to colour contrast, text size, and operating with the keyboard alone)

## Differences from other messengers

| | Breeze | Many messengers |
|---|--------|--------|
| Registration | Not needed (your identity is the key inside your device) | Phone number required |
| Server | Cannot read the contents | Premised on trusting the operating company |
| Hosting on your own server | The premise (it is something you host and use) | Not possible |
| Disclosure of the internals | Everything is public (MIT license) | Often not public |
| Where the data lives | Inside your device | On the operating company's servers |

A detailed comparison with Signal and LINE is on the [comparison page (in English)](../COMPARISON.md). Every claim Breeze makes comes with a "way to verify it," and the points where Breeze loses (the number of users, not having received an external audit, and so on) are written without hiding them.

## The cost of hosting on your own server

Breeze runs within Cloudflare's free tier. No credit card is required.

| Item | Free tier | If paid |
|-----------|-----------|-------------|
| Hosting | Cloudflare Pages (free) | — |
| Processing | Up to 100,000 times a day | Up to 10 million times a month |
| Storage | Per day, up to 100,000 reads and 1,000 writes | Per month, 10 million reads and 1 million writes |
| Call relaying | Free up to 20GB | 0.05 dollars per 1GB |
| Custom domain | Not needed (a free address comes with it) | 10 dollars a year |
| **Total** | **$0 a month** (up to roughly 20–40 people with light use) | **From $5 a month** (about 100 people in scale with light use. At a scale of 1,000 people, $34–222 a month depending on use) |

How costs grow at a large scale, and "why a single operator does not have to carry the costs for everyone," are in [the thinking on costs and sustainability (in English)](../SUSTAINABILITY.md); the calculations behind them are in the [cost model (in English)](../COST_MODEL.md).

Installation starts from this one command (for details, see the [Self-Hosting Guide](SELF_HOSTING-en.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Technical details (for developers)

### Encryption methods

| Role | Method |
|-------|-----------|
| Key exchange | X25519 (fallback: P-256) |
| Signing | Ed25519 (fallback: HMAC-SHA256) |
| Encryption | AES-256-GCM |
| Key derivation | HKDF-SHA256 |
| Conversation key updates | Double Ratchet (the same method as Signal) |
| Group keys | Sender Key |
| Hiding the sender from the relay | Sealed Sender |

The authoritative document for the design is the [specification, SPEC.md](../../SPEC.md); where to report weaknesses, and the policy, are in [SECURITY.md](../../SECURITY.md).

### Tests and quality checks

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Contributing

How to proceed and the conventions are in [CONTRIBUTING.md](../../CONTRIBUTING.md).
Please report bugs to the [Issues page](https://github.com/shizukutanaka/Breeze/issues). The code of conduct is [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## License

MIT — as stated in [LICENSE](../../LICENSE), you are free to use it, fix it, and distribute it.
