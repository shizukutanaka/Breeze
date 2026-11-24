# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Læs på andre sprog**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · Dansk (denne side) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**En krypteret beskedtjeneste, der hverken kræver telefonnummer eller registrering.**
Indholdet af en samtale kan kun læses af den, der sendte den, og den, der modtager den. Ikke engang serveren, der transporterer den, kan læse den.
Alle funktioner er gratis, og der er ingen reklamer.

Dette er ikke en webside, men software, som du installerer og bruger (Windows / Mac / Linux / Android / iPhone / browser).

![Breeze Messenger-skærmbillede — hovedvinduet lige efter oprettelse af en identitet](../images/screenshot.png)

## For at bruge den placerer du den på din egen server

Breeze har ingen "driftsselskabsserver". **For at bruge Breeze skal du selv skaffe et sted (en server) og placere Breeze der. Det er den officielle måde at bruge den på.**

- Stedet kan klares inden for det gratis niveau. Den kører på Cloudflares gratis niveau, og der kræves intet kreditkort. Fremgangsmåden findes i [installationsvejledningen](SELF_HOSTING-da.md) (versioner på andre sprog kan vælges øverst i vejledningen).
- Hent appen (Windows / Mac / Linux / Android / iPhone) fra [downloadsiden](https://github.com/shizukutanaka/Breeze/releases/latest), og brug den forbundet til din egen server.
- **Om eksempelinstallationen (en ærlig bemærkning)**: Der er opsat et eksempel til at kontrollere, at det virker (https://breeze-469.pages.dev/). Det er den samme software, der er placeret der, men brug venligst din egen server til reel brug. Eksemplet kan ændres eller stoppes uden varsel. En Breeze, du har placeret på din egen server, påvirkes ikke, hvis eksemplet stoppes.

Detaljerede anvisninger findes i [manualen](MANUAL-da.md) (versioner på andre sprog kan vælges øverst i manualen).

## Sådan bruger du den (3 trin)

1. Åbn den Breeze, du har placeret på din egen server (eller adressen, du har fået oplyst af den, der placerede den), og indtast dit navn. Så er du klar (ingen registrering, intet telefonnummer nødvendigt). På det tidspunkt oprettes der en "nøgle" inde i din enhed, og den er din identitet.
2. Giv dit ID eller din QR-kode til den person, du vil tale med.
3. Hvis den anden person også har appen åben, kan I forbinde jer direkte og tale sammen. Hvis de ikke har den åben, lægges beskeden, stadig krypteret, i en "postkasse" og leveres, når de åbner appen. Serveren, der transporterer postkassen, kan ikke læse indholdet. Breve, der aldrig leveres, slettes automatisk efter højst 7 dage.

## Løfter (det, vi ikke gør)

- **Ingen reklamer.** Hverken i appen eller noget andet sted.
- **Ingen sporing.** Ingen brugsanalyse, ingen reklamemekanismer, intet salg af data — overhovedet ikke.
- **Skaberen besidder ingen brugerdata.** Der findes slet ingen liste over konti på serversiden. Din identitet er kun nøglen inde i din enhed.
- **Samtaler krypteres mellem enhederne.** Serveren håndterer kun forseglede kuverter, som den ikke kan læse.

Vi skriver også ærligt om grænserne. For at levere beskeder er der en kortvarig opbevaring på serveren (uafleverede kuverter i højst 7 dage, forbindelsessignaler i 5 minutter, optegnelser over adresser og enheder i 90 dage, gruppeoplysninger og notifikationsabonnementer i 30 dage. Alt slettes automatisk, og indholdet kan ikke læses). Cloud-backup er slået fra fra starten. Hvis du placerer Breeze på din egen server, har du også denne opbevaring under din egen kontrol.

## Et design, hvor kriminalitet ikke kan betale sig

Breeze er bygget, så misbrug koster tid og besvær for den, der misbruger. Vi siger ikke, at den "gør kriminalitet umulig". Den er designet til at "gøre det urentabelt".

- **Intet grundlag at snylte på.** Da der ikke findes en central gratis server, må også den, der misbruger, skaffe et sted med en konto i eget navn og for egne penge.
- **Det koster at sende.** Hver afsendelse kræver en lille beregning (arbejdsbevis), og mængden er begrænset. Masseafsendelser og chikane kan ikke betale sig.
- **Anmeldelser, der ikke kan bortforklares.** Den, der modtager en besked, kan anmelde selve leveringen som bevis. Afsenderen kan ikke påstå, at den ikke blev sendt.
- **Den, der placerede serveren, har magten til at stoppe det.** Det, der sker på din egen server, kan du stoppe selv. Du behøver ingens tilladelse.

## Funktioner

- Samtaler én til én og gruppesamtaler (op til 1.000 personer)
- Tale- og videoopkald
- Afsendelse af filer (op til 50MB i én-til-én-samtaler. Det er også muligt i grupper, men størrelsesgrænsen er mindre)
- Flere enheder og flere konti til forskellige formål (f.eks. arbejde og privat. Både antal enheder og konti er gratis og ubegrænsede)
- Vælges automatisk blandt 8 sprog (engelsk, japansk, koreansk, kinesisk (Taiwan), spansk, thai, indonesisk, portugisisk)
- Profiler med foto, klistermærker, deling af placering
- Kommandoer som `/help` (mere end 60 typer)

## Forskelle fra andre beskedtjenester

| | Breeze | De fleste beskedtjenester |
|---|--------|--------|
| Registrering | Ikke nødvendig (identiteten er en nøgle i din enhed) | Telefonnummer kræves |
| Server | Kan ikke læse indholdet | Forudsætter, at du stoler på driftsselskabet |
| Placere på egen server | En forudsætning (noget, du placerer og bruger) | Ikke muligt |
| Åben kildekode | Alt er åbent (MIT-licens) | Ofte lukket |
| Hvor data befinder sig | I din enhed | På driftsselskabets servere |

En detaljeret sammenligning med Signal og LINE findes på [sammenligningssiden (engelsk)](../COMPARISON.md). Hver påstand fra Breeze har en "sådan kan du kontrollere det"-metode, og punkter, hvor Breeze taber (antal brugere, at den ikke har haft en ekstern revision osv.), skjules ikke.

## Omkostninger ved at placere den på din egen server

Breeze kører inden for Cloudflares gratis grænser. Kreditkort er ikke nødvendigt.

| Post | Gratis grænse | Hvis du betaler |
|-----------|-----------|-------------|
| Sted | Cloudflare Pages (gratis) | — |
| Behandling | Op til 100.000 gange om dagen | Op til 10 millioner gange om måneden |
| Lagring | Om dagen: læsning 100.000, skrivning 1.000 | Om måneden: læsning 10 millioner, skrivning 1 million |
| Opkaldsrelæ | Gratis op til 20GB | 0,05 dollar pr. GB |
| Eget domæne | Ikke nødvendigt (en gratis adresse følger med) | 10 dollar om året |
| **I alt** | **0 dollar om måneden** (op til ca. 20–40 personer ved let brug) | **Fra 5 dollar om måneden** (ca. 100 personer ved let brug. Ved 1.000 personer 34–222 dollar om måneden, afhængigt af brug) |

Hvordan omkostningerne vokser i stor skala, og "hvorfor en enkelt operatør ikke behøver at bære hele omkostningen", er beskrevet i [overvejelser om omkostninger og bæredygtighed (engelsk)](../SUSTAINABILITY.md), og beregningerne bag findes i [omkostningsmodellen (engelsk)](../COST_MODEL.md).

Installationen starter med denne ene kommando (se [installationsvejledningen](SELF_HOSTING-da.md) for detaljer).

```bash
wrangler pages deploy . --project-name=breeze
```

## Tekniske detaljer (til udviklere)

### Krypteringsmetoder

| Rolle | Metode |
|-------|-----------|
| Nøgleudveksling | X25519 (reserve: P-256) |
| Signatur | Ed25519 (reserve: HMAC-SHA256) |
| Kryptering | AES-256-GCM |
| Nøgleafledning | HKDF-SHA256 |
| Fornyelse af samtalenøgler | Double Ratchet (samme metode som Signal) |
| Gruppenøgler | Sender Key |
| Skjule afsenderen for relæet | Sealed Sender |

Det autoritative design findes i [specifikationen SPEC.md](../../SPEC.md), og hvor svagheder rapporteres samt politikken findes i [SECURITY.md](../../SECURITY.md).

### Test og kvalitetskontrol

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Deltag i udviklingen

Fremgangsmåden og reglerne findes i [CONTRIBUTING.md](../../CONTRIBUTING.md).
Rapportér fejl på [issue-siden](https://github.com/shizukutanaka/Breeze/issues). Adfærdskodekset findes i [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Licens

MIT — som det fremgår af [LICENSE](../../LICENSE), må du frit bruge, ændre og distribuere den.
