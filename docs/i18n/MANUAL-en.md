# Breeze Manual

**Read in another language**: [日本語](../MANUAL-ja.md) · English (this page) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze is an encrypted messenger with no phone number and no registration.
Only the sender and the receiver can read the contents of a conversation. Not even the server that carries it in between can read it.
Every feature is free, and there are no ads.

This manual is a guide for people getting started.

---

## 1. Getting started

### Getting the app

Choose the one that matches your machine from the [download page](https://github.com/shizukutanaka/Breeze/releases/latest).

- Windows: the one whose name ends in `-win-x64.exe` (there is also one for ARM machines)
- Mac: the one whose name ends in `-mac.dmg`
- Linux: `.AppImage` (you can run it as is) or `.deb`
- To use it in a browser, you use the copy hosted on your own server (the installation steps are in the separate "Self-Hosting Guide")

Each file comes with a checksum (SHA256SUMS.txt). If you are concerned, you can check that the checksum of the file you downloaded matches.

> **About the trial page**: The trial page that was published (breeze.pages.dev) is currently stopped (opening it gives a 404). Until it is restored, please use the app version. A copy hosted on your own server is not affected by this stoppage.

### First setup

1. Open the app.
2. Enter your name. That is all it takes to be ready. No registration, no phone number.

At that moment, a "key" is created inside your device. That is your identity itself.
**There is no list of accounts on the server.** Your identity exists only inside your device.
This point becomes important in the backup chapter (8).

### About "disposable identities"

If you choose "disposable identity" at creation time, you get an identity with no means of recovery at all.
If you lose that device, reset it, or erase the browser's data, that identity will never come back.
That is also stated on the screen. Do not choose it for an identity you will use for a long time.

---

## 2. Connecting with someone

There are three ways to connect with the person you want to talk to.

- **Give your ID**: Tell the other person your ID and have them enter it.
- **QR code**: Show the invitation QR code and have the other person scan it.
- **Invitation link**: Copy the invitation message from "Invite a friend" and send it by your usual means of contact (email, etc.). When the other person opens the link and enters their name, you can talk right away.

If the other person also has the app open, you connect directly and can talk.

---

## 3. Conversations

- Just type a message and send it. You can also send photos, stickers, and location information.
- **File sending**: Up to 50MB in one-to-one conversations. In groups it is smaller, about 50KB.
- Dangerous file formats, such as executable files, are blocked automatically.
- When the other person does not have the app open, your message waits, still encrypted, in a "mailbox," and is delivered when they open the app. The server carrying the mailbox cannot read the contents. A letter that is never delivered is automatically deleted after **at most 7 days**.
- Conversation history can be written out to a file and imported.

### Commands

Type `/help` in the input field to see a list of the commands you can use (more than 60 kinds).
Some operations, such as settings and device linking, are done from commands.

---

## 4. Groups

- A group can hold up to **1,000 people**.
- To create one, just enter a group name. Invitations are done from the "group invitation link." People who receive the link can join by entering their name.
- Files can be sent in groups too, but the limit is smaller, about 50KB. Voice messages cannot be sent in groups yet.
- If a member is using an old version of the app, the safer new method (group v5) cannot be used in that group, and a warning appears on the screen. It becomes effective when everyone updates to the latest version.

---

## 5. Calls

- You can make one-to-one voice calls and video calls. There are group calls too.
- **Call verification code**: A verification code is displayed on the call screen. Read it out with the other person and check that it matches on both screens. If it does not match, someone may be eavesdropping in between. In that case, end the call.
- A group call may not be able to start unless everyone's app is the latest version.

---

## 6. Multiple devices and accounts

- To use the same identity on multiple devices, link the devices together with the `/link` command.
- You can create multiple accounts and use them separately (for example, work and personal). Both the number of devices and the number of accounts are free and unlimited.
- The language is selected automatically from 8 languages: English, Japanese, Korean, Chinese (Taiwan), Spanish, Thai, Indonesian, and Portuguese (Brazil).

---

## 7. Settings to stay safe

- **Auto-lock**: There is a setting that locks automatically when you switch tabs.
- **Key passphrase**: You can protect the key inside your device by wrapping it in a passphrase. You will be asked to enter it when you open the app.
- **Blocking**: You can block a troublesome contact. Messages from a blocked contact will not reach you.

---

## 8. Backup and recovery (the most important chapter)

Your Breeze identity is only the key inside your device. There is no list of accounts on the server, and the people who made this do not have your key either.
**If you lose your device, you lose your identity too.** For an important identity, always make a backup.

### How to make a backup

1. Choose "Create backup."
2. Set a passphrase for the backup (6 characters or more).
3. Choose where to save it.
   - **Save to a file**: Keep the backup file in your own hands (recommended).
   - **Save to a relay server**: Can be used only when the operator of that relay has enabled it. It cannot be used on the default relay. There is a retention period, so retrieve it before the deadline.

The contents of the backup are encrypted. The server at the save destination only ever handles ciphertext.

### How to recover

On a new device, restore using the backup file (or the backup on the relay server) and the passphrase you set.

### Notes

- **If you forget the passphrase, recovery is impossible.** The people who made this cannot fix that either. Write the passphrase down somewhere else.
- **A disposable identity cannot be brought back, by backup or by recovery.**
- Remake the backup when your identities increase or when you change devices.

---

## 9. The mailbox and how costs work

- Letters for when the other person is offline are kept, still encrypted, in the relay server's "mailbox" (at most 7 days).
- The relay has caps to prevent misuse (the amount and frequency that can be deposited). When a cap is reached, you cannot deposit new letters for that period, but **letters that have already arrived never disappear**. The screen shows the reason and how long to wait.
- If you host it on your own server, you decide the caps yourself.

The scope of the records that remain on the server side (all are deleted automatically, and the contents cannot be read):

| Thing | How long it remains |
|---|---|
| Undelivered letters | At most 7 days |
| Connection signals | 5 minutes |
| Address and device records | 90 days |
| Group information and notification subscriptions | 30 days |

---

## 10. How to update (desktop version)

1. When there is a new version, a notice appears on the screen.
2. Press "Download" to go and get the new version (it is not installed automatically).
3. When the download finishes, press "Install" and restart.

If something fails during the update (for example, the file check does not match), **the update stops and the reason is shown on the screen**. Rolling back to an old version is not possible.

---

## 11. When something is wrong

| Symptom | What to check |
|---|---|
| A message cannot be sent | Check that your device's clock is not off. If the clock is off, sending fails. |
| It does not reach the other person | It waits in the mailbox until the other person opens the app (at most 7 days). |
| A file cannot be sent | Check that you are not over the size limit (50MB one-to-one, about 50KB in groups) and that it is not blocked as a dangerous format. |
| The call verification codes do not match | End the call and call again. Do not continue while they do not match. |
| You forgot the passphrase | Recovery is impossible. Create a new identity and tell your contacts again. |
| You lost your device | If you have a backup, you can recover on a new device. If not, it will be a new identity. |
| The trial page does not open (404) | It is currently stopped. Please use the app version. |

Please report bugs to the [Issues page](https://github.com/shizukutanaka/Breeze/issues).

---

## 12. Breeze's promises

- No ads. Not in the app, not anywhere.
- No tracking. No usage analytics, no advertising machinery, no selling of data — none at all.
- The people who made this do not hold users' data. There is no list of accounts on the server side at all.
- Conversations are encrypted between devices. The server only ever handles envelopes it cannot read.

A detailed comparison with other messengers is written in the repository's "comparison page," including the points where Breeze loses (the number of users, not having received an external audit, and so on).

---

*This manual reflects the state of Breeze v3.8.0.*
