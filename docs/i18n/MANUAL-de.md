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
- Zur Nutzung im Browser verwendet man das, was auf dem eigenen Server installiert ist (die Installationsschritte stehen im separaten Dokument „Anleitung zur Installation auf dem eigenen Server“). Die Standardinstallation nutzt Cloudflare, daher ist ein Cloudflare-Konto erforderlich

Zu jeder Datei gibt es einen Prüfwert (SHA256SUMS.txt). Wenn Sie besorgt sind, können Sie prüfen, ob der Wert der heruntergeladenen Datei übereinstimmt.

> **Zur Beispielseite**: Ein Beispiel zum Ausprobieren (https://breeze-469.pages.dev/) wird bereitgestellt. Was dort installiert ist, ist dieselbe Software, aber das Beispiel kann sich ohne Ankündigung ändern oder eingestellt werden. Verwenden Sie für den echten Gebrauch bitte das, was auf Ihrem eigenen Server installiert ist. Was auf Ihrem eigenen Server installiert ist, ist nicht betroffen, wenn das Beispiel eingestellt wird.

### Erste Einrichtung

1. Öffnen Sie die App.
2. Drücken Sie „Mit einer zufälligen ID starten“. Damit ist alles bereit. Keine Registrierung, keine Telefonnummer.

- Wenn Sie „Ihr Name (Anzeigename)“ in das Feld über der Schaltfläche eingeben, starten Sie mit diesem Namen. Sie können die Schaltfläche auch bei leerem Feld drücken. Den Anzeigenamen können Sie später im Profilabschnitt der Einstellungen ändern.
- Es gibt auch einen Weg, eine Identität mit einem Namen und einer Breeze-ID zu erstellen, die Sie selbst wählen. In diesem Fall wird eine Wiederherstellungsphrase ausgegeben und auf dem Bildschirm angezeigt. Die Wiederherstellungsphrase sind die Wörter, mit denen Sie diese Identität auf einem anderen Gerät zurückholen können. Notieren Sie sie auf Papier oder an einem sicheren Ort.
- Wenn Sie eine früher erstellte Identität zurückholen möchten, öffnen Sie „Vorhandenes Konto wiederherstellen“, und die Wiederherstellungsmethoden (aus einer Sicherungsdatei wiederherstellen, mit Wiederherstellungsphrase wiederherstellen, mit Konto + Passphrase wiederherstellen) erscheinen.
- Wenn die Erstellung abgeschlossen ist, erscheint eine Karte, die Sie anleitet, Ihren Schlüssel mit einer Passphrase zu schützen (sie verschwindet nicht nach einer Zeit). Folgen Sie für eine wichtige Identität der Anleitung und fügen Sie den Schutz hinzu.

In diesem Moment wird in Ihrem Gerät ein „Schlüssel“ erzeugt. Das ist Ihre Identität selbst.
**Auf dem Server gibt es keine Liste der Konten.** Ihre Identität existiert nur in Ihrem Gerät.
Dieser Punkt wird im Kapitel zur Sicherung (9) wichtig.

### Über die frühere „Wegwerf-Identität“

Die „Wegwerf-Identität“ – eine Identität ohne jede Möglichkeit der Wiederherstellung – gibt es nicht mehr. Mit den heutigen Wegen, eine Identität zu erstellen, kann jede Identität durch eine Sicherung geschützt werden.

---

## 2. Mit dem Gegenüber verbinden

Drücken Sie die Schaltfläche „Freund hinzufügen“ auf dem Kontaktbildschirm, und drei Auswahlmöglichkeiten erscheinen.

- **Einen Kontakt hinzufügen**: Geben Sie die ID der anderen Person ein, oder lesen Sie einen QR-Code ein.
- **Einen Freund einladen**: Kopieren Sie den Einladungslink und senden Sie ihn über Ihren üblichen Kontaktweg (E-Mail usw.). Wenn die andere Person den Link öffnet und ihren Namen eingibt, können Sie sofort sprechen.
- **Eine Gruppe erstellen**: Geben Sie nur einen Gruppennamen ein, um eine zu erstellen (Kapitel 4).

Ihre eigene ID wird in ihrer vollständigen Form angezeigt, wenn Sie Ihr eigenes Profil öffnen, und Sie können sie unverändert kopieren. Sie können die vollständige ID weitergeben, nicht nur die kurze ID.

Wenn die andere Person die App ebenfalls geöffnet hat, verbinden Sie sich direkt und können sprechen.

---

## 3. Unterhaltungen

- Geben Sie einfach eine Nachricht ein und senden Sie sie. Auch Fotos, Sticker und Standortinformationen können gesendet werden.
- Öffnen Sie das „+“ neben dem Eingabefeld, und Dateianhänge, Sprachnachrichten, Spracheingabe, Standortinformationen, Sticker, die Einstellung „keine Antwort nötig“ und mehr erscheinen zusammen.
- **Dateiversand**: Im Einzelgespräch bis zu 50 MB. In Gruppen ist es kleiner, etwa 50 KB.
- Gefährliche Dateiformate wie ausführbare Dateien werden automatisch blockiert.
- Wenn die andere Person die App nicht geöffnet hat, wartet die Nachricht verschlüsselt in einem „Briefkasten“ und wird zugestellt, sobald sie die App öffnet. Der Server, der den Briefkasten transportiert, kann den Inhalt nicht lesen. Ein Brief, der nie zugestellt wird, wird nach **spätestens 7 Tagen** automatisch gelöscht.
- Der Unterhaltungsverlauf kann in eine Datei geschrieben und eingelesen werden.

### Den Bildschirm lesen

- **Sendezustand**: Er ist an der Markierung neben einer Nachricht zu erkennen. ✓ bedeutet gesendet, ein ✓ in einem Kreis bedeutet, dass sie im Briefkasten hinterlegt wurde, ✓✓ bedeutet, dass sie das Gegenüber erreicht hat, Gelesen ist eine blaue Markierung und ein Fehler eine rote. Sie unterscheiden sich auch durch die Form, nicht nur durch die Farbe.
- **Die Kontaktliste**: Die Zeit des letzten Gesprächs wird für heute als Uhrzeit, für gestern als „Gestern“, für dieses Jahr als Monat/Tag und für alles Frühere als Jahr/Monat/Tag angezeigt. Bei Kontakten mit ungelesenen Nachrichten sind Name und Zeit hervorgehoben.
- **Namen für Kontakte**: Öffnen Sie „Kontaktinfo“ (im Rechtsklickmenü eines Kontakts oder im Menü „⋮“ der Unterhaltung), und Sie können Ihren eigenen Namen für diesen Kontakt festlegen (einen Spitznamen). Spitznamen werden nur auf diesem Gerät gespeichert und niemals an den Kontakt oder den Relay-Server gesendet. Wenn Sie einen Spitznamen festlegen, wird daneben auch der Name, den der Kontakt selbst festgelegt hat, in einer gedämpften Farbe angezeigt. Diesen zweiten Namen können Sie mit „Auch den Namen anzeigen, den jeder Kontakt selbst festgelegt hat“ im Abschnitt „Privatsphäre“ der Einstellungen abschalten.
- **Ihre eigene Karte**: Oben in der Liste steht Ihre eigene Profilkarte; drücken Sie darauf, um Ihr Profil zu öffnen. Sie scrollt mit der Liste mit.
- **Untere Tabs auf einem Telefon**: Bei Telefonbreite erscheinen unten auf dem Bildschirm fünf Tabs: „Chats“, „Anrufe“, „Kontakte“, „Meine Karte“ und „Einstellungen“. Welche Tabs angezeigt werden, können Sie einzeln unter „Untere Tabs“ in den Einstellungen wählen (Chats wird immer angezeigt. Auch wenn Sie den Tab Einstellungen ausblenden, können Sie die Einstellungen weiterhin über die Zahnrad-Schaltfläche auf dem Bildschirm öffnen).
- **Der Kopf der Unterhaltung**: Über das Suchsymbol können Sie innerhalb der Unterhaltung suchen. Über das Menü „⋮“ können Sie die Sicherheitsnummer prüfen, Benachrichtigungen stummschalten, anheften, eine Umfrage erstellen und mehr.

### Befehle

Geben Sie `/` in das Eingabefeld ein, und Befehlsvorschläge erscheinen. Geben Sie `/help` ein, um eine Liste der nutzbaren Befehle zu sehen (71 Arten).
Einige Vorgänge wie Einstellungen und Geräteverknüpfung erfolgen über Befehle.

---

## 4. Gruppen

- In eine Gruppe passen bis zu **1.000 Personen**.
- Zum Erstellen geben Sie nur einen Gruppennamen unter „Gruppe erstellen“ in „Freund hinzufügen“ ein (Sie können auch mit dem Befehl `/newgroup` eine erstellen). Eingeladen wird über den „Gruppeneinladungslink“. Wer den Link erhält, kann durch Eingabe des Namens teilnehmen.
- Auch in Gruppen können Dateien gesendet werden, aber die Obergrenze ist mit etwa 50 KB kleiner. Sprachnachrichten können in Gruppen noch nicht gesendet werden.
- Wenn ein Mitglied eine alte Version der App benutzt, kann in dieser Gruppe das sicherere neue Verfahren (Gruppe v5) nicht verwendet werden, und auf dem Bildschirm erscheint ein Hinweis. Es wird wirksam, wenn alle auf die neueste Version aktualisieren.

---

## 5. Anrufe

- Einzel-Sprach- und Videoanrufe sind möglich. Es gibt auch Gruppenanrufe (bis zu 8 Personen).
- **Anruf-Prüfcode**: Auf dem Anrufbildschirm wird ein Prüfcode angezeigt. Lesen Sie ihn sich gegenseitig vor und prüfen Sie, ob er auf beiden Bildschirmen übereinstimmt. Wenn er nicht übereinstimmt, hört möglicherweise jemand unterwegs mit. Legen Sie in diesem Fall auf.
- Ein Gruppenanruf kann unter Umständen nicht beginnen, wenn nicht alle die neueste Version der App haben.
- **Anrufverlauf**: Einzelgespräche hinterlassen einen Verlauf nur auf diesem Gerät (die andere Person, ob ausgehend / eingehend / verpasst, die Uhrzeit und die Gesprächsdauer. Nichts von dem, was gesagt wurde, wird aufbewahrt). Der Verlauf wird niemals an einen Server oder an die andere Person gesendet. Es werden bis zu 200 Einträge aufbewahrt, die ältesten werden zuerst entfernt. Gruppenanrufe erscheinen nicht im Verlauf.
- Öffnen Sie den Verlauf auf einem Telefon über den Tab „Anrufe“. Wenn es einen verpassten Anruf gibt, den Sie noch nicht gesehen haben, erscheint ein Zahlenabzeichen auf dem Tab Anrufe, das verschwindet, sobald Sie den Verlauf öffnen. Aus einer Zeile des Verlaufs können Sie die Unterhaltung mit dieser Person öffnen oder sie zurückrufen. Sie können den gesamten Verlauf mit einer Schaltfläche auf dem Bildschirm löschen.
- **Der Anrufverlauf ist nicht Teil einer Sicherung.** Auf einem neuen Gerät beginnt der Verlauf leer. Wenn Sie keinen Verlauf aufbewahren möchten, schalten Sie „Einen Anrufverlauf auf diesem Gerät aufbewahren“ im Abschnitt „Datenschutz“ der Einstellungen aus, und die Aufzeichnung selbst stoppt.

---

## 6. Mehrere Geräte und Konten

- Um dieselbe Identität auf mehreren Geräten zu nutzen, verknüpfen Sie die Geräte mit dem Befehl `/link` miteinander.
- Konten können mehrfach erstellt und getrennt genutzt werden (z. B. beruflich und privat). Sowohl die Geräteanzahl als auch die Kontenanzahl ist kostenlos und unbegrenzt.
- **So erstellen Sie ein Konto**: Drücken Sie die Schaltfläche „+“ neben den Konto-Tabs ganz oben in der Kontaktliste. Geben Sie einen Namen ein und wählen Sie ein Symbol-Emoji, und ein neues Konto wird erstellt und automatisch dorthin gewechselt.
- **Konten wechseln**: Die Konto-Tabs werden immer ganz oben in der Kontaktliste angezeigt. Drücken Sie auf einen, um zu wechseln (auf einem Computer können Sie auch mit Strg+1–9 wechseln). Drücken und halten Sie einen Tab, um ihn umzubenennen, sein Symbol zu ändern oder ihn zu löschen.
- Kontakte und Schlüssel sind für jedes Konto getrennt. Tauschen Sie die Kontakte für jedes Konto erneut aus.
- Die Sprache wird automatisch aus 51 Sprachen, einschließlich Englisch, passend zur Sprache Ihres Geräts gewählt.

---

## 7. Einstellungen zur Sicherheit

Die Einstellungen öffnen sich als eigener Bildschirm. Öffnen Sie sie auf einem Telefon über den Tab „Einstellungen“ unten auf dem Bildschirm; auf einem Computer über die Zahnrad-Schaltfläche auf dem Bildschirm (Sie können sie auch mit dem Befehl `/settings` öffnen). Kehren Sie mit der Zurück-Aktion zu dem Bildschirm zurück, auf dem Sie waren.

- **Automatische Sperre**: Es gibt eine Einstellung, die beim Wechseln des Tabs automatisch sperrt.
- **Schlüssel-Passphrase**: Sie können den Schlüssel in Ihrem Gerät schützen, indem Sie ihn mit einer Passphrase umhüllen. Beim Öffnen der App wird die Eingabe verlangt.
- **Auch den Namen anzeigen, den jeder Kontakt selbst festgelegt hat**: im Abschnitt „Privatsphäre“. Für einen Kontakt, dem Sie einen Spitznamen gegeben haben, können Sie wählen, ob dessen eigener Name daneben angezeigt wird (Kapitel 3).
- **Blockieren**: Störende Gegenüber können blockiert werden. Nachrichten von blockierten Personen erreichen Sie nicht.
- **Ob ein Anrufverlauf aufbewahrt wird**: Mit „Einen Anrufverlauf auf diesem Gerät aufbewahren“ im Abschnitt „Datenschutz“ können Sie die Aufzeichnung des Anrufverlaufs stoppen (Kapitel 5).
- **Sichtbarkeit der unteren Tabs**: Im Abschnitt „Untere Tabs“ können Sie die unteren Tabs des Telefons (Anrufe / Kontakte / Meine Karte / Einstellungen) einzeln ein- oder ausblenden. Chats wird immer angezeigt.

---

## 8. Akku und Notfälle (Leistungsmodi)

In der Einstellung „Leistungsmodus“ können Sie wählen, wie der Akku verwendet wird.

- **Automatisch (Akkustand)**: Schaltet automatisch um, je nachdem, wie viel Akku noch übrig ist.
- **Normal**: Wie üblich.
- **Energiesparen**: Zieht die Empfangsprüfungen auf höchstens einmal alle 60 Sekunden auseinander und stoppt das Anwesenheitssignal.
- **Notfall (für Katastrophen)**: Zieht die Empfangsprüfungen auf höchstens einmal alle 10 Minuten auseinander. Verwenden Sie ihn in einer Katastrophe oder einer anderen Zeit, in der Sie nicht aufladen können.

Was den Akku verbraucht, ist nicht die Menge der Kommunikation, sondern die Anzahl der Male, die das Funkteil aufwacht. Darum wird die sendende Seite nicht auseinandergezogen, nur die hörende. Das Senden geht wie immer sofort hinaus. Wenn Sie zu laden beginnen, geht es automatisch einen Schritt zur leichteren Seite zurück.

Auf Geräten, die den Akkustand nicht automatisch lesen können (wie ein iPhone-Browser), verhält sich „Automatisch“ wie Normal, und eine manuelle Wahl wirkt wie gewählt.

---

## 9. Sicherung und Wiederherstellung (das wichtigste Kapitel)

Die Identität von Breeze ist nur der Schlüssel in Ihrem Gerät. Auf dem Server gibt es keine Liste der Konten, und auch die Ersteller haben Ihren Schlüssel nicht.
**Wenn Sie Ihr Gerät verlieren, verlieren Sie auch Ihre Identität.** Erstellen Sie für eine wichtige Identität unbedingt eine Sicherung.

Sicherung und Wiederherstellung erfolgen im Abschnitt „Sichern & Wiederherstellen“ der Einstellungen (die Schaltflächen sind „Sicherung erstellen“, „Sicherung wiederherstellen“ und „📂 Aus Datei wiederherstellen“). Wenn Sie zum ersten Mal einen Kontakt hinzufügen, erscheint genau einmal eine Karte, die Sie zum Erstellen einer Sicherung auffordert.

### Automatische Sicherung

Die Einstellung „Automatische Sicherung“ ist von Anfang an eingeschaltet. Wenn sich Ihre Daten ändern, wird eine verschlüsselte Sicherung automatisch an den Relay-Server gesendet, den Sie betreiben.

- Sie sendet nicht bei jeder Änderung: Sie wartet 30 Sekunden nach der letzten Änderung und sendet alles zusammen. Versuche haben mindestens 15 Minuten Abstand.
- Während Sie offline sind, wird nichts gesendet; die Änderungen werden zurückgehalten und gesendet, wenn die Verbindung zurück ist und wenn Sie die App öffnen.
- Für das automatische Senden müssen Sie die Sicherungs-Passphrase einmal auf diesem Gerät eingeben (wenn es nötig ist, erscheint im Einstellungsabschnitt eine Schaltfläche „Passphrase eingeben“). **Die Passphrase wird nicht gespeichert.** Sie wird nur erinnert, solange die App geöffnet ist, und ist weg, wenn Sie sie schließen. Bei einer Identität mit einfacher Wiederherstellung funktioniert das Senden direkt, nachdem Sie die Passphrase bei der Registrierung oder Aktualisierung eingegeben haben.
- Wenn der Relay-Server das Speichern von Sicherungen nicht unterstützt, läuft die automatische Sicherung nicht. Das wird im Einstellungsabschnitt angezeigt.
- Der Zustand (wann das letzte erfolgreiche Senden war, ob Änderungen warten, ob ein Senden fehlgeschlagen ist) wird im Einstellungsabschnitt angezeigt.

### So erstellen Sie eine Sicherung (manuell)

1. Wählen Sie im Abschnitt „Sicherung und Wiederherstellung“ der Einstellungen „Sicherung erstellen“.
2. Legen Sie eine Passphrase für die Sicherung fest (6 Zeichen oder mehr).
3. Wählen Sie den Speicherort.
   - **In eine Datei speichern**: Bewahren Sie die Sicherungsdatei in Ihren eigenen Händen auf (empfohlen).
   - **Auf einem Relay-Server speichern**: Nur nutzbar, wenn der Betreiber dieses Relays es aktiviert hat. Beim Standard-Relay ist es nicht nutzbar. Es gibt eine Aufbewahrungsfrist; holen Sie sie bis zur Frist zurück.

Der Inhalt der Sicherung ist verschlüsselt. Der Server am Speicherort behandelt nur den verschlüsselten Text.

### So stellen Sie wieder her

Stellen Sie auf einem neuen Gerät mit der Sicherungsdatei (oder der Sicherung auf dem Relay-Server) und der festgelegten Passphrase wieder her.

Wenn Sie Ihre Identität gerade mit einer Wiederherstellungsphrase zurückgeholt haben und eine Sicherung dieser Identität auf dem Relay-Server liegt, wird sie automatisch gefunden und Sie werden mit „Sicherung gefunden“ gefragt. Wenn Sie sie wiederherstellen, werden die Daten auf diesem Gerät durch den Inhalt der Sicherung ersetzt.

### Auf ein neues Gerät umziehen

Drücken Sie die Schaltfläche „Auf ein neues Gerät umziehen“ im Abschnitt „Sichern & Wiederherstellen“ der Einstellungen, und die Schritte werden angezeigt.

1. Bewahren Sie auf Ihrem aktuellen Gerät eine Sicherung auf dem Relay-Server auf (automatische Sicherung oder „Sicherung erstellen“).
2. Wählen Sie auf dem neuen Gerät auf dem ersten Bildschirm eine Wiederherstellungsmethode und geben Sie Ihre Wiederherstellungsphrase ein (oder Ihren Kontonamen und Ihre Passphrase).
3. Wenn Ihre Identität zurück ist, wird die Sicherung auf dem Server automatisch gefunden und eine Wiederherstellung angeboten.

Es sind keine Kabel und keine Dateiübergaben nötig.

### Hinweise

- **Wenn Sie die Passphrase vergessen, ist eine Wiederherstellung unmöglich.** Auch die Ersteller können das nicht beheben. Notieren Sie die Passphrase an einem anderen Ort.
- Die Eingabe der Passphrase für die automatische Sicherung ist auf jedem Gerät nötig. Geben Sie sie auf einem neuen Gerät noch einmal ein.
- Erstellen Sie eine manuelle Sicherung neu, wenn Ihre Identitäten zunehmen oder Sie das Gerät wechseln.
- Der Anrufverlauf ist nicht Teil einer Sicherung. Wenn Sie das Gerät wechseln, zieht der Anrufverlauf nicht auf das neue Gerät um.

---

## 10. Briefkasten und die Denkweise zu den Kosten

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

## 11. So aktualisieren Sie (Desktop-Version)

1. Wenn es eine neue Version gibt, erscheint ein Hinweis auf dem Bildschirm.
2. Mit „Herunterladen“ wird die neue Version geholt (sie wird nicht automatisch installiert).
3. Wenn der Download abgeschlossen ist, drücken Sie „Installieren“ und starten Sie neu.

Wenn während der Aktualisierung etwas fehlschlägt (z. B. die Dateiprüfung stimmt nicht überein), **stoppt die Aktualisierung und der Grund wird auf dem Bildschirm angezeigt**. Ein Zurücksetzen auf eine alte Version ist nicht möglich.

---

## 12. Wenn etwas nicht geht

| Symptom | Was zu prüfen ist |
|---|---|
| Eine Nachricht kann nicht gesendet werden | Prüfen Sie, ob die Uhr Ihres Geräts nicht verstellt ist. Wenn die Uhr verstellt ist, schlägt das Senden fehl. |
| Es erreicht das Gegenüber nicht | Es wartet im Briefkasten, bis das Gegenüber die App öffnet (höchstens 7 Tage). |
| Eine Datei kann nicht gesendet werden | Prüfen Sie, ob Sie die Größenobergrenze (Einzel 50 MB, Gruppen etwa 50 KB) nicht überschreiten und ob sie nicht als gefährliches Format blockiert wird. |
| Die Prüfnummern des Anrufs stimmen nicht überein | Legen Sie auf und rufen Sie erneut an. Fahren Sie nicht fort, solange sie nicht übereinstimmen. |
| Die Passphrase vergessen | Eine Wiederherstellung ist unmöglich. Erstellen Sie eine neue Identität und teilen Sie sie Ihren Gegenübern erneut mit. |
| Das Gerät verloren | Wenn Sie eine Sicherung haben, können Sie auf einem neuen Gerät wiederherstellen. Wenn nicht, wird es eine neue Identität. |
| Die Beispielseite öffnet sich nicht | Das Beispiel kann ohne Ankündigung eingestellt werden. Bitte verwenden Sie das, was auf Ihrem eigenen Server installiert ist. |

Fehlermeldungen bitte an die [Issues-Seite](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Die Versprechen von Breeze

- Keine Werbung. Weder in der App noch irgendwo sonst.
- Kein Tracking. Keine Nutzungsanalyse, keine Werbemechanismen, kein Datenverkauf – gar nichts davon.
- Die Ersteller besitzen keine Daten der Nutzer. Auf der Serverseite gibt es nicht einmal eine Liste der Konten.
- Unterhaltungen werden zwischen den Geräten verschlüsselt. Der Server behandelt nur Umschläge, die er nicht lesen kann.

Der ausführliche Vergleich mit anderen Messengern steht auf der „Vergleichsseite“ des Repositoriums, einschließlich der Punkte, bei denen Breeze schlechter abschneidet (Nutzerzahl, keine externe Prüfung erhalten zu haben usw.).

---

*Diese Anleitung spiegelt den Stand von Breeze zum 25. November 2026 wider.*
