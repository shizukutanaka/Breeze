# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**In einer anderen Sprache lesen**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · Deutsch (diese Seite) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Ein verschlüsselter Messenger – ohne Telefonnummer und ohne Registrierung.**
Den Inhalt einer Unterhaltung können nur die sendende und die empfangende Person lesen. Nicht einmal der Server, der ihn unterwegs transportiert, kann ihn lesen.
Alle Funktionen sind kostenlos, und es gibt keine Werbung.

Dies ist keine Webseite, sondern Software, die man installiert und benutzt (Windows / Mac / Linux / Android / iPhone / Browser).

![Breeze Messenger Screenshot — das Hauptfenster direkt nach dem Erstellen einer Identität](../images/screenshot.png)

## Zur Nutzung stellt man es auf den eigenen Server

Breeze hat keinen „Server einer Betreiberfirma“. **Zur Nutzung bereitet man selbst einen Ort (Server) vor, auf dem es läuft, und stellt Breeze dorthin. Das ist die offizielle Art der Nutzung.**

- Die Standardinstallation nutzt Cloudflare, daher ist **ein Cloudflare-Konto erforderlich**. Die Schritte stehen in der [Anleitung zur Installation auf dem eigenen Server](SELF_HOSTING-de.md) (weitere Sprachen können am Anfang der Anleitung gewählt werden).
- Die Apps (Windows / Mac / Linux / Android / iPhone) holt man von der [Download-Seite](https://github.com/shizukutanaka/Breeze/releases/latest) und nutzt sie verbunden mit dem eigenen Server.
- **Zur Beispielinstallation (ein ehrlicher Hinweis)**: Es gibt ein Beispiel zur Funktionsprüfung (https://breeze-469.pages.dev/). Dort läuft dieselbe Software, aber für die echte Nutzung verwenden Sie bitte Ihren eigenen Server. Das Beispiel kann sich ohne Ankündigung ändern oder eingestellt werden. Was Sie auf Ihrem eigenen Server installiert haben, ist von einer Einstellung des Beispiels nicht betroffen.

Die ausführliche Nutzung steht in der [Anleitung](MANUAL-de.md) (weitere Sprachen können am Anfang der Anleitung gewählt werden).

## Nutzung (3 Schritte)

1. Öffnen Sie das Breeze, das Sie auf Ihrem eigenen Server installiert haben (oder die Adresse, die Ihnen die installierende Person mitgeteilt hat), und drücken Sie „Mit einer zufälligen ID starten“ (Sie können einen Namen eingeben, wenn Sie möchten). Damit ist alles bereit (keine Registrierung, keine Telefonnummer). In diesem Moment wird in Ihrem Gerät ein „Schlüssel“ erzeugt, und dieser Schlüssel wird zu Ihrer Identität.
2. Geben Sie Ihre ID oder Ihren QR-Code an die Person weiter, mit der Sie sprechen möchten.
3. Wenn die andere Person die App ebenfalls geöffnet hat, verbinden Sie sich direkt und können sprechen. Wenn sie sie nicht geöffnet hat, wartet die Nachricht verschlüsselt in einem „Briefkasten“ und wird zugestellt, sobald sie die App öffnet. Der Server, der den Briefkasten transportiert, kann den Inhalt nicht lesen. Ein Brief, der nie zugestellt wird, wird nach spätestens 7 Tagen automatisch gelöscht.

## Versprechen (was wir nicht tun)

- **Keine Werbung.** Weder in der App noch irgendwo sonst.
- **Kein Tracking.** Keine Nutzungsanalyse, keine Werbemechanismen, kein Datenverkauf – gar nichts davon.
- **Die Ersteller besitzen keine Daten der Nutzer.** Auf der Serverseite gibt es nicht einmal eine Liste der Konten. Ihre Identität ist nur der Schlüssel in Ihrem Gerät.
- **Unterhaltungen werden zwischen den Geräten verschlüsselt.** Der Server behandelt nur Umschläge, die er nicht lesen kann.

Auch den Umfang schreiben wir ehrlich. Zur Zustellung bewahrt der Server Dinge für kurze Zeit auf (unzugestellte Umschläge höchstens 7 Tage, Verbindungssignale 5 Minuten, Adress- und Geräteaufzeichnungen 90 Tage, Gruppeninformationen und Benachrichtigungsabonnements 30 Tage. Alles wird automatisch gelöscht, und die Inhalte können nicht gelesen werden). Die Cloud-Sicherung ist anfangs deaktiviert. Wenn Sie es auf Ihrem eigenen Server installieren, liegt auch diese Aufbewahrung unter Ihrer eigenen Kontrolle.

## Was es kann

- Einzelunterhaltungen und Gruppenunterhaltungen (bis zu 1.000 Personen)
- Sprach- und Videoanrufe (Gruppenanrufe mit bis zu 8 Personen)
- Dateiversand (im Einzelgespräch bis zu 50 MB. Auch in Gruppen möglich, aber die Größenobergrenze ist kleiner)
- Nutzung mit mehreren Geräten und mehreren Konten (z. B. beruflich und privat. Sowohl die Geräteanzahl als auch die Kontenanzahl ist kostenlos und unbegrenzt)
- Automatische Sicherung (wenn sich etwas ändert, wird eine verschlüsselte Sicherung automatisch auf Ihrem eigenen Server gespeichert. Auf einem neuen Gerät wird nach der Wiederherstellung Ihrer Identität automatisch eine Sicherung gefunden und Ihnen angeboten. Die Einstellungen führen Sie auch durch den Umzug auf ein neues Gerät)
- Ein Name, den Sie für jeden Kontakt wählen (Sie können jeden Kontakt umbenennen, nur auf diesem Gerät gespeichert. Sie können auch wählen, ob der Name angezeigt wird, den jeder Kontakt selbst festgelegt hat)
- 51 Sprachen (Englisch plus 50 Sprachdateien), automatisch passend zur Sprache Ihres Geräts ausgewählt
- Profile mit Foto, Sticker, Standortfreigabe
- Befehlsbedienung wie `/help` (71 Arten)
- Leistungsmodi passend zu Ihrem Akku (automatisch / normal / Energiesparen / Notfall). Wenn der Akku leerer wird, werden die Empfangsprüfungen weiter auseinandergezogen, damit der Akku länger hält. Eine Vorsorge für Katastrophen und andere Zeiten, in denen Sie nicht aufladen können
- Gut lesbare Bildschirme (Achtung auf Farbkontrast, Textgröße und Bedienung nur mit der Tastatur)

## Unterschiede zu anderen Messengern

| | Breeze | Viele Messenger |
|---|--------|--------|
| Registrierung | Nicht nötig (die Identität ist der Schlüssel im Gerät) | Telefonnummer erforderlich |
| Server | Kann den Inhalt nicht lesen | Beruht auf Vertrauen in die Betreiberfirma |
| Auf dem eigenen Server installieren | Voraussetzung (etwas, das man installiert und nutzt) | Nicht möglich |
| Offenlegung des Inneren | Alles öffentlich (MIT-Lizenz) | Oft nicht öffentlich |
| Ort der Daten | In Ihrem Gerät | Auf den Servern der Betreiberfirma |

Der ausführliche Vergleich mit Signal und LINE steht auf der [Vergleichsseite (auf Englisch)](../COMPARISON.md). Zu jeder Behauptung von Breeze gibt es eine „Art, sie zu überprüfen“, und auch die Punkte, bei denen Breeze schlechter abschneidet (Nutzerzahl, keine externe Prüfung erhalten zu haben usw.), sind unverdeckt aufgeschrieben.

## Kosten der Installation auf dem eigenen Server

Breeze läuft im kostenlosen Rahmen von Cloudflare. Eine Kreditkarte ist nicht nötig.

| Posten | Kostenloser Rahmen | Bei bezahlter Nutzung |
|-----------|-----------|-------------|
| Betrieb | Cloudflare Pages (kostenlos) | — |
| Verarbeitung | Bis zu 100.000-mal pro Tag | Bis zu 10 Millionen-mal pro Monat |
| Speicherung | Pro Tag Lesen bis 100.000-mal, Schreiben bis 1.000-mal | Pro Monat Lesen 10 Millionen-mal, Schreiben 1 Million-mal |
| Anrufweiterleitung | Bis 20 GB kostenlos | 0,05 Dollar pro 1 GB |
| Eigene Domain | Nicht nötig (eine kostenlose Adresse ist dabei) | 10 Dollar pro Jahr |
| **Gesamt** | **0 Dollar pro Monat** (bei leichter Nutzung bis etwa 20–40 Personen) | **Ab 5 Dollar pro Monat** (bei leichter Nutzung etwa 100 Personen. Bei 1.000 Personen je nach Nutzung 34–222 Dollar pro Monat) |

Wie die Kosten in großem Maßstab wachsen und „warum ein einzelner Betreiber nicht die Kosten für alle tragen muss“, steht in den [Überlegungen zu Kosten und Nachhaltigkeit (auf Englisch)](../SUSTAINABILITY.md); die zugrunde liegenden Berechnungen stehen im [Kostenmodell (auf Englisch)](../COST_MODEL.md).

Die Installation beginnt mit diesem einen Befehl (Details in der [Anleitung zur Installation auf dem eigenen Server](SELF_HOSTING-de.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Technische Details (für Entwickler)

### Verschlüsselungsverfahren

| Aufgabe | Verfahren |
|-------|-----------|
| Schlüsselaustausch | X25519 (Reserve: P-256) |
| Signatur | Ed25519 (Reserve: HMAC-SHA256) |
| Verschlüsselung | AES-256-GCM |
| Schlüsselableitung | HKDF-SHA256 |
| Aktualisierung der Gesprächsschlüssel | Double Ratchet (dasselbe Verfahren wie Signal) |
| Gruppenschlüssel | Sender Key |
| Absender vor dem Relay verbergen | Sealed Sender |

Das maßgebliche Dokument des Entwurfs ist die [Spezifikation SPEC.md](../../SPEC.md); die Meldestelle für Schwachstellen und die Richtlinie stehen in [SECURITY.md](../../SECURITY.md).

### Tests und Qualitätsprüfungen

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Am Entwickeln teilnehmen

Ablauf und Regeln stehen in [CONTRIBUTING.md](../../CONTRIBUTING.md).
Fehlermeldungen bitte auf die [Issues-Seite](https://github.com/shizukutanaka/Breeze/issues). Der Verhaltenskodex ist [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Lizenz

MIT — wie in [LICENSE](../../LICENSE) angegeben, frei zu nutzen, zu ändern und weiterzugeben.
