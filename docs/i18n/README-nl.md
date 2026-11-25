# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**In een andere taal lezen**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · Nederlands (deze pagina) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Een versleutelde messenger waarvoor je geen telefoonnummer en geen registratie nodig hebt.**
De inhoud van gesprekken kan alleen door de verzender en de ontvanger worden gelezen. Zelfs de server die ze vervoert, kan ze niet lezen.
Alle functies zijn gratis en er zijn geen advertenties.

Dit is geen webpagina, maar software die je installeert en gebruikt (Windows / Mac / Linux / Android / iPhone / browser).

![Schermafbeelding van Breeze Messenger — het hoofdvenster vlak na het aanmaken van een identiteit](../images/screenshot.png)

## Om het te gebruiken, zet je het op je eigen server

Breeze heeft geen “server van een bedrijf”. **Om het te gebruiken, regel je zelf een plek (server) en zet je Breeze daarop. Dat is de officiële manier van gebruiken.**

- Er is genoeg aan de gratis ruimte. Het draait op de gratis versie van Cloudflare en er is geen creditcard nodig. De procedure staat in de [installatiehandleiding](SELF_HOSTING-nl.md) (versies in andere talen kun je aan het begin van de handleiding kiezen).
- Haal de apps (Windows / Mac / Linux / Android / iPhone) van de [downloadpagina](https://github.com/shizukutanaka/Breeze/releases/latest) en verbind ze met je eigen server.
- **Over de voorbeeldinstallatie (eerlijke mededeling)**: er staat een voorbeeld (https://breeze-469.pages.dev/) om de werking te controleren. Het is dezelfde software, maar gebruik voor echt gebruik je eigen server. Het voorbeeld kan zonder aankondiging veranderen of stoppen. Wat je op je eigen server hebt gezet, ondervindt geen hinder van het stoppen van het voorbeeld.

Meer over het gebruik staat in de [handleiding](MANUAL-nl.md) (versies in andere talen kun je aan het begin van de handleiding kiezen).

## Gebruik (3 stappen)

1. Open de Breeze die op je eigen server staat (of op het adres dat degene die hem heeft neergezet je heeft verteld) en voer je naam in. Daarmee is de voorbereiding klaar (geen registratie en geen telefoonnummer nodig). Op dat moment wordt er in je apparaat een “sleutel” gemaakt, en die is je identiteit.
2. Geef je ID of QR-code aan de persoon met wie je wilt praten.
3. Als de andere persoon de app ook open heeft, maak je rechtstreeks verbinding en kun je praten. Als die de app niet open heeft, wordt het bericht versleuteld in een “wachtbak” gelegd en bezorgd zodra die de app opent. De server die de wachtbak vervoert, kan de inhoud niet lezen. Brieven die niet worden bezorgd, worden na maximaal 7 dagen automatisch verwijderd.

## Beloften (wat we niet doen)

- **We tonen geen advertenties.** Niet in de app, nergens.
- **We volgen je niet.** Geen gebruiksanalyse, geen advertentiemechanismen, geen verkoop van gegevens.
- **De maker bewaart geen gegevens van gebruikers.** Aan de serverkant bestaat er überhaupt geen lijst met accounts. Je identiteit is alleen de sleutel in je apparaat.
- **Gesprekken worden tussen apparaten versleuteld.** De server heeft alleen te maken met enveloppen die hij niet kan lezen.

We schrijven de reikwijdte er eerlijk bij. Om te bezorgen bewaart de server dingen korte tijd (niet-bezorgde enveloppen maximaal 7 dagen, verbindingssignalen 5 minuten, adres- en apparaatgegevens 90 dagen, groepsinformatie en meldingsabonnementen 30 dagen. Alles wordt automatisch verwijderd en de inhoud kan niet worden gelezen). Back-up naar de cloud staat in het begin uit. Als je het op je eigen server zet, valt ook die bewaring onder je eigen beheer.

## Wat het kan

- Een-op-eengesprekken en groepsgesprekken (tot 1.000 mensen)
- Spraak- en videogesprekken (groepsgesprekken tot 8 mensen)
- Bestanden verzenden (in een-op-eengesprekken tot 50 MB. In groepen kan het ook, maar de groottelimiet is kleiner)
- Meerdere apparaten en meerdere accounts (bijv. werk en privé. Zowel het aantal apparaten als het aantal accounts is gratis en onbeperkt)
- 51 talen (Engels plus 50 taalbestanden), automatisch gekozen op basis van de taal van je apparaat
- Profiel met foto, stickers, locatie delen
- Commando's zoals `/help` (71 soorten)
- Energiemodi afgestemd op je batterij (automatisch / normaal / energiebesparing / noodgeval). Naarmate de batterij leegraakt, worden bezorgcontroles uitgespreid zodat de batterij langer meegaat. Een beveiliging voor rampen en andere tijden waarin je niet kunt opladen
- Leesbare schermen (aandacht voor kleurcontrast, tekstgrootte en bediening met alleen het toetsenbord)

## Verschillen met andere messengers

| | Breeze | Veel messengers |
|---|--------|--------|
| Registratie | Niet nodig (identiteit is de sleutel in het apparaat) | Telefoonnummer vereist |
| Server | Kan de inhoud niet lezen | Vertrouwen in het bedrijf dat het draait wordt verondersteld |
| Op je eigen server zetten | Verondersteld (het is iets om neer te zetten en te gebruiken) | Kan niet |
| Openbaarheid van de code | Alles openbaar (MIT-licentie) | Vaak gesloten |
| Waar de gegevens zijn | In je apparaat | Op de servers van het bedrijf dat het draait |

De gedetailleerde vergelijking met Signal en LINE staat op de [vergelijkingspagina (Engels)](../COMPARISON.md). Bij elke bewering van Breeze staat een “manier om het te controleren”, en ook de punten waarop Breeze verliest (het aantal gebruikers, geen externe audit, enz.) staan er eerlijk bij.

## Kosten van het op je eigen server zetten

Breeze draait binnen de gratis ruimte van Cloudflare. Er is geen creditcard nodig.

| Onderdeel | Gratis bereik | In het betaalde geval |
|-----------|-----------|-------------|
| Plek | Cloudflare Pages (gratis) | — |
| Verwerking | Tot 100.000 per dag | Tot 10 miljoen per maand |
| Opslag | Lezen tot 100.000 per dag, schrijven tot 1.000 per dag | Lezen 10 miljoen per maand, schrijven 1 miljoen per maand |
| Doorschakelen van gesprekken | Gratis tot 20 GB | 0,05 dollar per 1 GB |
| Eigen domein | Niet nodig (er zit een gratis adres bij) | 10 dollar per jaar |
| **Totaal** | **0 dollar per maand** (bij licht gebruik tot ongeveer 20–40 mensen) | **Vanaf 5 dollar per maand** (bij licht gebruik schaal van ongeveer 100 mensen. Op schaal van 1.000 mensen 34 tot 222 dollar per maand, afhankelijk van het gebruik) |

Hoe de kosten groeien op grote schaal en “waarom één beheerder niet de kosten van iedereen hoeft te dragen” staan in [kosten en duurzaamheid (Engels)](../SUSTAINABILITY.md), en de oorspronkelijke berekeningen in het [kostenmodel (Engels)](../COST_MODEL.md).

De installatie begint met dit ene commando (details in de [installatiehandleiding](SELF_HOSTING-nl.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Technische details (voor ontwikkelaars)

### Versleutelingsmethoden

| Rol | Methode |
|-------|-----------|
| Sleuteluitwisseling | X25519 (reserve: P-256) |
| Handtekening | Ed25519 (reserve: HMAC-SHA256) |
| Versleuteling | AES-256-GCM |
| Sleutelafleiding | HKDF-SHA256 |
| Vernieuwing van gesprekssleutels | Double Ratchet (dezelfde methode als Signal) |
| Groepssleutels | Sender Key |
| Afzender verbergen voor de relay | Sealed Sender |

De maatgevende specificatie staat in [SPEC.md](../../SPEC.md), en het meldpunt voor kwetsbaarheden en het beleid in [SECURITY.md](../../SECURITY.md).

### Tests en kwaliteitscontroles

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Meedoen aan de ontwikkeling

De werkwijze en regels staan in [CONTRIBUTING.md](../../CONTRIBUTING.md).
Meldingen van problemen kun je kwijt op de [Issue-pagina](https://github.com/shizukutanaka/Breeze/issues). De gedragscode is [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [docs/COMPARISON.md](../COMPARISON.md).

## Licentie

MIT — zoals in [LICENSE](../../LICENSE): vrij te gebruiken, aan te passen en te verspreiden.
