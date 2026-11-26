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
- To use it in a browser, you use the copy hosted on your own server (the installation steps are in the separate "Self-Hosting Guide"). The standard setup uses Cloudflare, so a Cloudflare account is required

Each file comes with a checksum (SHA256SUMS.txt). If you are concerned, you can check that the checksum of the file you downloaded matches.

### First setup

1. Open the app.
2. Press "Start with a random ID." That is all it takes to be ready. No registration, no phone number.

- If you enter "Your name (display name)" in the field above the button, you start with that name. You can also press the button with the field left empty. You can change the display name later, in the profile section of the settings.
- There is also a way to create an identity with a name and a Breeze ID you choose yourself. In that case, a recovery phrase is issued and shown on the screen. The recovery phrase is the words that let you bring that identity back on another device. Write it down on paper or somewhere safe.
- If you want to bring back an identity you made before, open "Restore an existing account" and the recovery methods (restore from a backup file, recover with a recovery phrase, restore with account + passphrase) appear.
- When creation finishes, a card appears guiding you to protect your key with a passphrase (it does not disappear after a time). For an important identity, follow the guidance and add the protection.

At that moment, a "key" is created inside your device. That is your identity itself.
**There is no list of accounts on the server.** Your identity exists only inside your device.
This point becomes important in the backup chapter (9).

### About the former "disposable identity"

The "disposable identity" — an identity with no means of recovery at all — is gone. With the current ways of creating an identity, every identity can be protected by a backup.

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
- **Names for contacts**: Open "Contact info" (in the right-click menu of a contact, or the conversation's "⋮" menu) and you can set your own name for that contact (a nickname). Nicknames are stored only on this device and are never sent to the contact or the relay server. When you set a nickname, the name the contact set for themselves is also shown next to it in a muted colour. You can turn that second name off with "Also show the name each contact set for themselves" in the "Privacy" section of the settings.
- **Your own card**: At the top of the list is your own profile card; press it to open your profile. It scrolls together with the list.
- **Bottom tabs on a phone**: At phone widths, five tabs appear at the bottom of the screen: "Chats", "Calls", "Contacts", "Profile", and "Settings". You can choose which tabs are shown, one by one, under "Bottom tabs" in the settings (Chats is always shown. Even if you hide the Settings tab, you can still open the settings from the gear button on the screen).
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
- **Call history**: One-to-one calls leave a history on this device only (the other person, whether it was outgoing / incoming / missed, the time, and the call duration. Nothing of what was said is kept). The history is never sent to a server or to the other person. Up to 200 entries are kept, with the oldest removed first. Group calls do not appear in the history.
- Open the history from the "Calls" tab on a phone. When there is a missed call you have not seen yet, a number badge appears on the Calls tab, and it clears when you open the history. From a history row you can open the conversation with that person, or call them back. You can delete the whole history with a button on the screen.
- **Call history is not part of a backup.** On a new device, the history starts empty. If you do not want a history kept, turn off "Keep a call history on this device" in the "Privacy" section of the settings, and recording itself stops.

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
- **Also show the name each contact set for themselves**: In the "Privacy" section. For a contact you have given a nickname, you can choose whether their own name is shown alongside it (chapter 3).
- **Blocking**: You can block a troublesome contact. Messages from a blocked contact will not reach you.
- **Whether to keep a call history**: With "Keep a call history on this device" in the "Privacy" section, you can stop call-history recording (chapter 5).
- **Bottom tab visibility**: In the "Bottom tabs" section, you can show or hide the phone's bottom tabs (Calls / Contacts / Profile / Settings) one by one. Chats is always shown.

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

Backup and recovery are done from the "Backup and recovery" section of the settings (the buttons are "Create Backup," "Restore Backup," and "Restore from file"). The first time you add a contact, a card urging you to make a backup appears just once.

### Automatic backup

The "Automatic backup" setting is on from the start. When your data changes, an encrypted backup is sent automatically to the relay server you host.

- It does not send on every change: it waits 30 seconds after the last change and sends everything together. Attempts are spaced at least 15 minutes apart.
- While you are offline, nothing is sent; the changes are held and sent when the connection returns and when you open the app.
- For automatic sending, you need to enter the backup passphrase once on that device (when it is needed, an "Enter passphrase" button appears in the settings section). **The passphrase is not stored.** It is remembered only while the app is open, and is gone when you close it. For a simple-recovery identity, right after you enter the passphrase at registration or update, sending works as is.
- If the relay server does not support storing backups, automatic backup does not run. That is shown in the settings section.
- The state (when the last successful send was, whether changes are waiting, whether a send failed) is shown in the settings section.

### How to make a backup (manual)

1. From "Backup and recovery" in the settings, choose "Create Backup."
2. Set a passphrase for the backup (6 characters or more).
3. Choose where to save it.
   - **Save to a file**: Keep the backup file in your own hands (recommended).
   - **Save to a relay server**: Can be used only when the operator of that relay has enabled it. It cannot be used on the default relay. There is a retention period, so retrieve it before the deadline.

The contents of the backup are encrypted. The server at the save destination only ever handles ciphertext.

### How to recover

On a new device, restore using the backup file (or the backup on the relay server) and the passphrase you set.

If you have just brought your identity back with a recovery phrase, and a backup of that identity is on the relay server, it is found automatically and you are asked with "Backup found." If you restore it, the data on that device is replaced by the contents of the backup.

### Moving to a new device

Press the "Move to a new device" button in the "Backup and recovery" section of the settings and the steps are shown.

1. On your current device, keep a backup on the relay server (automatic backup, or "Create Backup").
2. On the new device, choose a restore method on the first screen and enter your recovery phrase (or your account name and passphrase).
3. When your identity is back, the backup on the server is found automatically and a restore is offered.

No cables or file hand-offs are needed.

### Notes

- **If you forget the passphrase, recovery is impossible.** The people who made this cannot fix that either. Write the passphrase down somewhere else.
- Entering the passphrase for automatic backup is needed on each device. On a new device, enter it once more.
- Remake a manual backup when your identities increase or when you change devices.
- Call history is not part of a backup. When you change devices, the call history does not move to the new device.

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
