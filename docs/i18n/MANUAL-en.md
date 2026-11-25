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

> **About the sample page**: A sample for checking how it works (https://breeze-469.pages.dev/) is provided. What is hosted there is the same software, but the sample may change or stop without notice. For real use, please use a copy hosted on your own server. A copy hosted on your own server is not affected if the sample stops.

### First setup

1. Open the app.
2. Enter your name and press "Create account." That is all it takes to be ready. No registration, no phone number.

- If you want to bring back an identity you made before, open "Restore an existing account" and the recovery methods (a backup file, a recovery phrase, and so on) appear.
- When creation finishes, a card appears guiding you to protect your key with a passphrase (it does not disappear after a time). For an important identity, follow the guidance and add the protection.

At that moment, a "key" is created inside your device. That is your identity itself.
**There is no list of accounts on the server.** Your identity exists only inside your device.
This point becomes important in the backup chapter (9).

### About "disposable identities"

If you choose "disposable identity" at creation time, you get an identity with no means of recovery at all.
If you lose that device, reset it, or erase the browser's data, that identity will never come back.
That is also stated on the screen. Do not choose it for an identity you will use for a long time.

---

## 2. Connecting with someone

Press the "Add friend" button on the contacts screen and three choices appear.

- **Add a contact**: Enter the other person's ID, or scan a QR code.
- **Invite a friend**: Copy the invitation link and send it by your usual means of contact (email, etc.). When the other person opens the link and enters their name, you can talk right away.
- **Create a group**: Just enter a group name to create one (chapter 4).

Your own ID is shown in its complete form when you open your own profile, and you can copy it as is. You can hand over the complete ID, not just the short ID.

If the other person also has the app open, you connect directly and can talk.

---

## 3. Conversations

- Just type a message and send it. You can also send photos, stickers, and location information.
- Open the "+" next to the input field and file attachments, voice messages, voice input, location information, stickers, the "no reply needed" setting, and more appear together.
- **File sending**: Up to 50MB in one-to-one conversations. In groups it is smaller, about 50KB.
- Dangerous file formats, such as executable files, are blocked automatically.
- When the other person does not have the app open, your message waits, still encrypted, in a "mailbox," and is delivered when they open the app. The server carrying the mailbox cannot read the contents. A letter that is never delivered is automatically deleted after **at most 7 days**.
- Conversation history can be written out to a file and imported.

### Reading the screen

- **Sending status**: You can tell from the mark next to a message. ✓ means sent, a ✓ inside a circle means it has been deposited in the mailbox, ✓✓ means it reached the other person, read is a blue mark, and failure is a red mark. They are distinguished by shape as well as colour.
- **The contact list**: The time you last talked is shown as the time for today, "Yesterday" for yesterday, month/day for this year, and year/month/day for anything earlier. Contacts with messages you have not read have their name and time emphasised.
- **Your own card**: At the top of the list is your own profile card; press it to open your profile. It scrolls together with the list.
- **Bottom tabs on a phone**: At phone widths, "Contacts" and "Settings" tabs appear at the bottom of the screen.
- **The conversation header**: From the search icon you can search within the conversation. From the "⋮" menu you can check the safety number, mute notifications, pin, create a poll, and more.

### Commands

Type `/` in the input field and command suggestions appear. Type `/help` to see a list of the commands you can use (71 kinds).
Some operations, such as settings and device linking, are done from commands.

---

## 4. Groups

- A group can hold up to **1,000 people**.
- To create one, just enter a group name under "Create a group" in "Add friend" (you can also create one with the `/newgroup` command). Invitations are done from the "group invitation link." People who receive the link can join by entering their name.
- Files can be sent in groups too, but the limit is smaller, about 50KB. Voice messages cannot be sent in groups yet.
- If a member is using an old version of the app, the safer new method (group v5) cannot be used in that group, and a warning appears on the screen. It becomes effective when everyone updates to the latest version.

---

## 5. Calls

- You can make one-to-one voice calls and video calls. There are group calls (up to 8 people) too.
- **Call verification code**: A verification code is displayed on the call screen. Read it out with the other person and check that it matches on both screens. If it does not match, someone may be eavesdropping in between. In that case, end the call.
- A group call may not be able to start unless everyone's app is the latest version.

---

## 6. Multiple devices and accounts

- To use the same identity on multiple devices, link the devices together with the `/link` command.
- You can create multiple accounts and use them separately (for example, work and personal). Both the number of devices and the number of accounts are free and unlimited.
- **How to create an account**: Press the "+" button next to the account tabs at the very top of the contact list. Enter a name and choose an icon emoji, and a new account is created and switched to automatically.
- **Switching accounts**: The account tabs are always shown at the very top of the contact list. Press one to switch (on a computer you can also switch with Ctrl+1–9). Press and hold a tab to rename it, change its icon, or delete it.
- Contacts and keys are separate for each account. Exchange contacts again for each account.
- The language is selected automatically from 51 languages, including English, matched to your device's language.

---

## 7. Settings to stay safe

Settings open as their own screen. On a phone, open them from the "Settings" tab at the bottom of the screen; on a computer, from the gear button on the screen (you can also open them with the `/settings` command). Use the back action to return to the screen you were on.

- **Auto-lock**: There is a setting that locks automatically when you switch tabs.
- **Key passphrase**: You can protect the key inside your device by wrapping it in a passphrase. You will be asked to enter it when you open the app.
- **Blocking**: You can block a troublesome contact. Messages from a blocked contact will not reach you.

---

## 8. Battery and emergencies (power modes)

In the "Power mode" setting, you can choose how the battery is used.

- **Automatic (battery level)**: Switches automatically according to how much battery is left.
- **Normal**: Business as usual.
- **Power saving**: Spaces delivery checks out to at most once every 60 seconds, and stops the presence signal.
- **Emergency (for disasters)**: Spaces delivery checks out to at most once every 10 minutes. Use it in a disaster or other time when you cannot recharge.

What drains the battery is not the amount of communication but the number of times the radio wakes up. So the sending side is not spaced out; only the listening side is. Sending still goes out right away, as always. When you start charging, it automatically moves back one step toward the lighter side.

On devices that cannot read the battery level automatically (such as an iPhone browser), "Automatic" behaves as Normal, and a manual choice works as chosen.

---

## 9. Backup and recovery (the most important chapter)

Your Breeze identity is only the key inside your device. There is no list of accounts on the server, and the people who made this do not have your key either.
**If you lose your device, you lose your identity too.** For an important identity, always make a backup.

Backup and recovery are done from the "Backup and recovery" section of the settings (there are three buttons: "Back up to the cloud," "Restore," and "Restore from a file"). The first time you add a contact, a card urging you to make a backup appears just once.

### How to make a backup

1. From "Backup and recovery" in the settings, choose to create a backup.
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

## 10. The mailbox and how costs work

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

## 11. How to update (desktop version)

1. When there is a new version, a notice appears on the screen.
2. Press "Download" to go and get the new version (it is not installed automatically).
3. When the download finishes, press "Install" and restart.

If something fails during the update (for example, the file check does not match), **the update stops and the reason is shown on the screen**. Rolling back to an old version is not possible.

---

## 12. When something is wrong

| Symptom | What to check |
|---|---|
| A message cannot be sent | Check that your device's clock is not off. If the clock is off, sending fails. |
| It does not reach the other person | It waits in the mailbox until the other person opens the app (at most 7 days). |
| A file cannot be sent | Check that you are not over the size limit (50MB one-to-one, about 50KB in groups) and that it is not blocked as a dangerous format. |
| The call verification codes do not match | End the call and call again. Do not continue while they do not match. |
| You forgot the passphrase | Recovery is impossible. Create a new identity and tell your contacts again. |
| You lost your device | If you have a backup, you can recover on a new device. If not, it will be a new identity. |
| The sample page does not open | The sample may stop without notice. Please use a copy hosted on your own server. |

Please report bugs to the [Issues page](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Breeze's promises

- No ads. Not in the app, not anywhere.
- No tracking. No usage analytics, no advertising machinery, no selling of data — none at all.
- The people who made this do not hold users' data. There is no list of accounts on the server side at all.
- Conversations are encrypted between devices. The server only ever handles envelopes it cannot read.

A detailed comparison with other messengers is written in the repository's "comparison page," including the points where Breeze loses (the number of users, not having received an external audit, and so on).

---

*This manual reflects the state of Breeze as of 2026-11-25.*
