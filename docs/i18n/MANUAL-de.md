# Breeze Anleitung

**In einer anderen Sprache lesen**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · Deutsch (diese Seite) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze ist ein verschlüsselter Messenger ohne Telefonnummer und ohne Registrierung.
Den Inhalt einer Unterhaltung können nur die sendende und die empfangende Person lesen. Nicht einmal der Server, der ihn unterwegs transportiert, kann ihn lesen.
Alle Funktionen sind kostenlos, und es gibt keine Werbung.

Diese Anleitung ist ein Leitfaden für Menschen, die anfangen, es zu benutzen.

---

## 1. Anfangen

### Beschaffung

Wählen Sie auf der [Download-Seite](https://github.com/shizukutanaka/Breeze/releases/latest) die eine Datei, die zu Ihrem Gerät passt.

- Windows: die, deren Name auf `-win-x64.exe` endet (es gibt auch eine für ARM-Geräte)
- Mac: die, deren Name auf `-mac.dmg` endet
- Linux: `.AppImage` (so ausführbar) oder `.deb`
- Zur Nutzung im Browser verwendet man das, was auf dem eigenen Server installiert ist (die Installationsschritte stehen im separaten Dokument „Anleitung zur Installation auf dem eigenen Server“)

Zu jeder Datei gibt es einen Prüfwert (SHA256SUMS.txt). Wenn Sie besorgt sind, können Sie prüfen, ob der Wert der heruntergeladenen Datei übereinstimmt.

> **Zur Testseite**: Die veröffentlichte Testseite (breeze.pages.dev) ist derzeit eingestellt (beim Öffnen erscheint 404). Bitte verwenden Sie bis zur Wiederherstellung die App-Version. Was auf Ihrem eigenen Server installiert ist, ist von dieser Einstellung nicht betroffen.

### Erste Einrichtung

1. Öffnen Sie die App.
2. Geben Sie Ihren Namen ein. Damit ist alles bereit. Keine Registrierung, keine Telefonnummer.

In diesem Moment wird in Ihrem Gerät ein „Schlüssel“ erzeugt. Das ist Ihre Identität selbst.
**Auf dem Server gibt es keine Liste der Konten.** Ihre Identität existiert nur in Ihrem Gerät.
Dieser Punkt wird im Kapitel zur Sicherung (8) wichtig.

### Über die „Wegwerf-Identität“

Wenn Sie bei der Erstellung „Wegwerf-Identität“ wählen, erhalten Sie eine Identität ohne jede Möglichkeit der Wiederherstellung.
Wenn Sie dieses Gerät verlieren, es zurücksetzen oder die Browserdaten löschen, kommt diese Identität nie zurück.
Das wird auch auf dem Bildschirm angezeigt. Wählen Sie sie nicht für eine Identität, die Sie lange benutzen.

---

## 2. Mit dem Gegenüber verbinden

Es gibt drei Wege, sich mit der Person zu verbinden, mit der Sie sprechen möchten.

- **ID weitergeben**: Teilen Sie Ihre ID der anderen Person mit und lassen Sie sie eingeben.
- **QR-Code**: Zeigen Sie den Einladungs-QR-Code und lassen Sie ihn von der anderen Person einlesen.
- **Einladungslink**: Kopieren Sie die Einladungsnachricht unter „Freund einladen“ und senden Sie sie über Ihren üblichen Kontaktweg (E-Mail usw.). Wenn die andere Person den Link öffnet und ihren Namen eingibt, können Sie sofort sprechen.

Wenn die andere Person die App ebenfalls geöffnet hat, verbinden Sie sich direkt und können sprechen.

---

## 3. Unterhaltungen

- Geben Sie einfach eine Nachricht ein und senden Sie sie. Auch Fotos, Sticker und Standortinformationen können gesendet werden.
- **Dateiversand**: Im Einzelgespräch bis zu 50 MB. In Gruppen ist es kleiner, etwa 50 KB.
- Gefährliche Dateiformate wie ausführbare Dateien werden automatisch blockiert.
- Wenn die andere Person die App nicht geöffnet hat, wartet die Nachricht verschlüsselt in einem „Briefkasten“ und wird zugestellt, sobald sie die App öffnet. Der Server, der den Briefkasten transportiert, kann den Inhalt nicht lesen. Ein Brief, der nie zugestellt wird, wird nach **spätestens 7 Tagen** automatisch gelöscht.
- Der Unterhaltungsverlauf kann in eine Datei geschrieben und eingelesen werden.

### Befehle

Wenn Sie `/help` in das Eingabefeld eingeben, erscheint eine Liste der nutzbaren Befehle (über 60 Arten).
Einige Vorgänge wie Einstellungen und Geräteverknüpfung erfolgen über Befehle.

---

## 4. Gruppen

- In eine Gruppe passen bis zu **1.000 Personen**.
- Zum Erstellen geben Sie nur einen Gruppennamen ein. Eingeladen wird über den „Gruppeneinladungslink“. Wer den Link erhält, kann durch Eingabe des Namens teilnehmen.
- Auch in Gruppen können Dateien gesendet werden, aber die Obergrenze ist mit etwa 50 KB kleiner. Sprachnachrichten können in Gruppen noch nicht gesendet werden.
- Wenn ein Mitglied eine alte Version der App benutzt, kann in dieser Gruppe das sicherere neue Verfahren (Gruppe v5) nicht verwendet werden, und auf dem Bildschirm erscheint ein Hinweis. Es wird wirksam, wenn alle auf die neueste Version aktualisieren.

---

## 5. Anrufe

- Einzel-Sprach- und Videoanrufe sind möglich. Es gibt auch Gruppenanrufe.
- **Anruf-Prüfcode**: Auf dem Anrufbildschirm wird ein Prüfcode angezeigt. Lesen Sie ihn sich gegenseitig vor und prüfen Sie, ob er auf beiden Bildschirmen übereinstimmt. Wenn er nicht übereinstimmt, hört möglicherweise jemand unterwegs mit. Legen Sie in diesem Fall auf.
- Ein Gruppenanruf kann unter Umständen nicht beginnen, wenn nicht alle die neueste Version der App haben.

---

## 6. Mehrere Geräte und Konten

- Um dieselbe Identität auf mehreren Geräten zu nutzen, verknüpfen Sie die Geräte mit dem Befehl `/link` miteinander.
- Konten können mehrfach erstellt und getrennt genutzt werden (z. B. beruflich und privat). Sowohl die Geräteanzahl als auch die Kontenanzahl ist kostenlos und unbegrenzt.
- **So erstellen Sie ein Konto**: Öffnen Sie die Einstellungen und tippen Sie im Abschnitt „Konto“ auf die Schaltfläche „Konto hinzufügen“. Geben Sie einen Namen ein und wählen Sie ein Emoji als Symbol aus, und das neue Konto wird erstellt und automatisch zu ihm gewechselt.
- **So wechseln Sie zwischen Konten**: Wenn Sie zwei oder mehr Konten haben, erscheinen ganz oben in der Kontaktliste Konto-Tabs. Tippen Sie auf einen Tab, um zu wechseln (auf einem Computer können Sie auch Ctrl+1–9 verwenden). Halten Sie einen Tab lange gedrückt, um ihn umzubenennen, sein Symbol zu ändern oder ihn zu löschen.
- Jedes Konto hat seine eigenen Kontakte und Schlüssel. Tauschen Sie Kontakte für jedes Konto getrennt aus.
- Die Sprache wird automatisch aus 8 Sprachen gewählt: Englisch, Japanisch, Koreanisch, Chinesisch (Taiwan), Spanisch, Thailändisch, Indonesisch und Portugiesisch (Brasilien).

---

## 7. Einstellungen zur Sicherheit

- **Automatische Sperre**: Es gibt eine Einstellung, die beim Wechseln des Tabs automatisch sperrt.
- **Schlüssel-Passphrase**: Sie können den Schlüssel in Ihrem Gerät schützen, indem Sie ihn mit einer Passphrase umhüllen. Beim Öffnen der App wird die Eingabe verlangt.
- **Blockieren**: Störende Gegenüber können blockiert werden. Nachrichten von blockierten Personen erreichen Sie nicht.

---

## 8. Sicherung und Wiederherstellung (das wichtigste Kapitel)

Die Identität von Breeze ist nur der Schlüssel in Ihrem Gerät. Auf dem Server gibt es keine Liste der Konten, und auch die Ersteller haben Ihren Schlüssel nicht.
**Wenn Sie Ihr Gerät verlieren, verlieren Sie auch Ihre Identität.** Erstellen Sie für eine wichtige Identität unbedingt eine Sicherung.

### So erstellen Sie eine Sicherung

1. Wählen Sie „Sicherung erstellen“.
2. Legen Sie eine Passphrase für die Sicherung fest (6 Zeichen oder mehr).
3. Wählen Sie den Speicherort.
   - **In eine Datei speichern**: Bewahren Sie die Sicherungsdatei in Ihren eigenen Händen auf (empfohlen).
   - **Auf einem Relay-Server speichern**: Nur nutzbar, wenn der Betreiber dieses Relays es aktiviert hat. Beim Standard-Relay ist es nicht nutzbar. Es gibt eine Aufbewahrungsfrist; holen Sie sie bis zur Frist zurück.

Der Inhalt der Sicherung ist verschlüsselt. Der Server am Speicherort behandelt nur den verschlüsselten Text.

### So stellen Sie wieder her

Stellen Sie auf einem neuen Gerät mit der Sicherungsdatei (oder der Sicherung auf dem Relay-Server) und der festgelegten Passphrase wieder her.

### Hinweise

- **Wenn Sie die Passphrase vergessen, ist eine Wiederherstellung unmöglich.** Auch die Ersteller können das nicht beheben. Notieren Sie die Passphrase an einem anderen Ort.
- **Eine Wegwerf-Identität kommt weder durch Sicherung noch durch Wiederherstellung zurück.**
- Erstellen Sie die Sicherung neu, wenn Ihre Identitäten zunehmen oder Sie das Gerät wechseln.

---

## 9. Briefkasten und die Denkweise zu den Kosten

- Briefe für die Zeit, in der das Gegenüber offline ist, werden verschlüsselt im „Briefkasten“ des Relay-Servers aufbewahrt (höchstens 7 Tage).
- Das Relay hat Obergrenzen zur Missbrauchsverhinderung (Menge und Häufigkeit des Hinterlegens). Wenn die Obergrenze erreicht ist, können in diesem Zeitraum keine neuen Briefe hinterlegt werden, aber **bereits angekommene Briefe verschwinden niemals**. Auf dem Bildschirm werden der Grund und die Wartezeit angezeigt.
- Wenn Sie es auf Ihrem eigenen Server installieren, entscheiden Sie die Obergrenzen selbst.

Umfang der Aufzeichnungen, die auf der Serverseite bleiben (alle werden automatisch gelöscht, und die Inhalte können nicht gelesen werden):

| Sache | Bleibdauer |
|---|---|
| Unzugestellte Briefe | Höchstens 7 Tage |
| Verbindungssignale | 5 Minuten |
| Adress- und Geräteaufzeichnungen | 90 Tage |
| Gruppeninformationen und Benachrichtigungsabonnements | 30 Tage |

---

## 10. So aktualisieren Sie (Desktop-Version)

1. Wenn es eine neue Version gibt, erscheint ein Hinweis auf dem Bildschirm.
2. Mit „Herunterladen“ wird die neue Version geholt (sie wird nicht automatisch installiert).
3. Wenn der Download abgeschlossen ist, drücken Sie „Installieren“ und starten Sie neu.

Wenn während der Aktualisierung etwas fehlschlägt (z. B. die Dateiprüfung stimmt nicht überein), **stoppt die Aktualisierung und der Grund wird auf dem Bildschirm angezeigt**. Ein Zurücksetzen auf eine alte Version ist nicht möglich.

---

## 11. Wenn etwas nicht geht

| Symptom | Was zu prüfen ist |
|---|---|
| Eine Nachricht kann nicht gesendet werden | Prüfen Sie, ob die Uhr Ihres Geräts nicht verstellt ist. Wenn die Uhr verstellt ist, schlägt das Senden fehl. |
| Es erreicht das Gegenüber nicht | Es wartet im Briefkasten, bis das Gegenüber die App öffnet (höchstens 7 Tage). |
| Eine Datei kann nicht gesendet werden | Prüfen Sie, ob Sie die Größenobergrenze (Einzel 50 MB, Gruppen etwa 50 KB) nicht überschreiten und ob sie nicht als gefährliches Format blockiert wird. |
| Die Prüfnummern des Anrufs stimmen nicht überein | Legen Sie auf und rufen Sie erneut an. Fahren Sie nicht fort, solange sie nicht übereinstimmen. |
| Die Passphrase vergessen | Eine Wiederherstellung ist unmöglich. Erstellen Sie eine neue Identität und teilen Sie sie Ihren Gegenübern erneut mit. |
| Das Gerät verloren | Wenn Sie eine Sicherung haben, können Sie auf einem neuen Gerät wiederherstellen. Wenn nicht, wird es eine neue Identität. |
| Die Testseite öffnet sich nicht (404) | Sie ist derzeit eingestellt. Bitte verwenden Sie die App-Version. |

Fehlermeldungen bitte an die [Issues-Seite](https://github.com/shizukutanaka/Breeze/issues).

---

## 12. Die Versprechen von Breeze

- Keine Werbung. Weder in der App noch irgendwo sonst.
- Kein Tracking. Keine Nutzungsanalyse, keine Werbemechanismen, kein Datenverkauf – gar nichts davon.
- Die Ersteller besitzen keine Daten der Nutzer. Auf der Serverseite gibt es nicht einmal eine Liste der Konten.
- Unterhaltungen werden zwischen den Geräten verschlüsselt. Der Server behandelt nur Umschläge, die er nicht lesen kann.

Der ausführliche Vergleich mit anderen Messengern steht auf der „Vergleichsseite“ des Repositoriums, einschließlich der Punkte, bei denen Breeze schlechter abschneidet (Nutzerzahl, keine externe Prüfung erhalten zu haben usw.).

---

*Diese Anleitung entspricht dem Stand von Breeze v3.8.0.*
