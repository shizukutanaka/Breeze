# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Les på andre språk**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · Norsk (denne siden) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**En kryptert meldingstjeneste som ikke krever telefonnummer eller registrering.**
Innholdet i en samtale kan bare leses av den som sendte den og den som mottar den. Ikke engang serveren som frakter den, kan lese den.
Alle funksjoner er gratis, og det er ingen reklame.

Dette er ikke en nettside, men programvare du installerer og bruker (Windows / Mac / Linux / Android / iPhone / nettleser).

![Breeze Messenger-skjermbilde — hovedvinduet rett etter at en identitet er opprettet](../images/screenshot.png)

## For å bruke den, plasserer du den på din egen server

Breeze har ingen «driftsselskapsserver». **For å bruke Breeze må du selv skaffe et sted (en server) og plassere Breeze der. Det er den offisielle måten å bruke den på.**

- Stedet holder innenfor gratisgrensen. Den kjører på Cloudflares gratisnivå, og du trenger ikke kredittkort. Fremgangsmåten finner du i [installasjonsveiledningen](SELF_HOSTING-nb.md) (versjoner på andre språk kan velges øverst i veiledningen).
- Ta appen (Windows / Mac / Linux / Android / iPhone) fra [nedlastingssiden](https://github.com/shizukutanaka/Breeze/releases/latest), og bruk den koblet til din egen server.
- **Om eksempelinstallasjonen (en ærlig merknad)**: Det er satt opp et eksempel for å kontrollere at det virker (https://breeze-469.pages.dev/). Det er den samme programvaren som er plassert der, men bruk din egen server til faktisk bruk. Eksemplet kan endres eller stoppes uten varsel. En Breeze du har plassert på din egen server, påvirkes ikke dersom eksemplet stoppes.

Detaljerte bruksanvisninger finner du i [manualen](MANUAL-nb.md) (versjoner på andre språk kan velges øverst i manualen).

## Slik bruker du den (3 trinn)

1. Åpne Breeze-en du har plassert på din egen server (eller adressen du har fått oppgitt av den som plasserte den), og skriv inn navnet ditt. Da er du klar (ingen registrering, intet telefonnummer nødvendig). Da opprettes det en «nøkkel» inne i enheten din, og den er identiteten din.
2. Gi ID-en din eller QR-koden til personen du vil snakke med.
3. Hvis den andre personen også har appen åpen, kan dere koble dere direkte sammen og snakke. Hvis de ikke har den åpen, legges meldingen, fortsatt kryptert, i en «postboks» og leveres når de åpner appen. Serveren som frakter postboksen, kan ikke lese innholdet. Brev som aldri blir levert, slettes automatisk etter maks 7 dager.

## Løfter (det vi ikke gjør)

- **Ingen reklame.** Verken i appen eller noe annet sted.
- **Ingen sporing.** Ingen bruksanalyse, ingen reklamemekanismer, intet salg av data — overhodet ikke.
- **Skaperen sitter ikke på brukerdata.** Det finnes ingen liste over kontoer på serversiden i det hele tatt. Identiteten din er bare nøkkelen inne i enheten din.
- **Samtaler krypteres mellom enhetene.** Serveren håndterer bare forseglede konvolutter den ikke kan lese.

Vi skriver også ærlig om grensene. For å levere meldinger finnes det en kortvarig oppbevaring på serveren (uleverte konvolutter i maks 7 dager, tilkoblingssignaler i 5 minutter, registre over adresser og enheter i 90 dager, gruppeinformasjon og varselabonnementer i 30 dager. Alt slettes automatisk, og innholdet kan ikke leses). Sikkerhetskopiering til skyen er slått av fra starten. Hvis du plasserer Breeze på din egen server, har du også denne oppbevaringen under din egen kontroll.

## Funksjoner

- Samtaler én-til-én og gruppesamtaler (opptil 1 000 personer)
- Tale- og videosamtaler (gruppesamtaler opptil 8 personer)
- Sende filer (opptil 50MB i én-til-én-samtaler. Det går også i grupper, men størrelsesgrensen er mindre)
- Flere enheter og flere kontoer til ulike formål (for eksempel jobb og privat. Både antall enheter og antall kontoer er gratis og ubegrenset)
- 51 språk (engelsk pluss 50 språkfiler), velges automatisk for å passe til enhetens språk
- Profiler med bilde, klistremerker, posisjonsdeling
- Kommandoer som `/help` (71 typer)
- Strømmoduser tilpasset batteriet ditt (automatisk / normal / strømsparing / nødmodus). Etter hvert som batteriet tømmes, spres leveringskontroller ut slik at batteriet varer lenger. En sikring for katastrofer og andre tider da du ikke kan lade
- Lettleste skjermer (oppmerksomhet på fargekontrast, tekststørrelse og betjening med bare tastaturet)

## Forskjeller fra andre meldingstjenester

| | Breeze | De fleste meldingstjenester |
|---|--------|--------|
| Registrering | Ikke nødvendig (identiteten er en nøkkel i enheten din) | Telefonnummer kreves |
| Server | Kan ikke lese innholdet | Forutsetter at du stoler på driftsselskapet |
| Plassere på egen server | En forutsetning (noe du plasserer og bruker) | Ikke mulig |
| Åpen kildekode | Alt er åpent (MIT-lisens) | Ofte lukket |
| Hvor dataene er | I enheten din | På driftsselskapets servere |

En detaljert sammenligning med Signal og LINE finner du på [sammenligningssiden (engelsk)](../COMPARISON.md). Hvert utsagn fra Breeze har en «slik kan du kontrollere det»-metode, og punkter der Breeze taper (antall brukere, at den ikke har hatt ekstern revisjon osv.) skjules ikke.

## Kostnaden ved å plassere den på din egen server

Breeze kjører innenfor Cloudflares gratisgrenser. Kredittkort er ikke nødvendig.

| Post | Gratisgrense | Hvis du betaler |
|-----------|-----------|-------------|
| Sted | Cloudflare Pages (gratis) | — |
| Behandling | Opptil 100 000 ganger per dag | Opptil 10 millioner ganger per måned |
| Lagring | Per dag: lesing 100 000, skriving 1 000 | Per måned: lesing 10 millioner, skriving 1 million |
| Samtalerelé | Gratis opptil 20GB | 0,05 dollar per GB |
| Eget domene | Ikke nødvendig (gratis adresse følger med) | 10 dollar per år |
| **Totalt** | **0 dollar per måned** (opptil omtrent 20–40 personer ved lett bruk) | **Fra 5 dollar per måned** (omtrent 100 personer ved lett bruk. Ved 1 000 personer 34–222 dollar per måned, avhengig av bruk) |

Hvordan kostnaden vokser i stor skala, og «hvorfor én enkelt operatør slipper å bære hele kostnaden», er beskrevet i [tanker om kostnad og bærekraft (engelsk)](../SUSTAINABILITY.md), og beregningene bak finnes i [kostnadsmodellen (engelsk)](../COST_MODEL.md).

Installasjonen starter med denne ene kommandoen (se [installasjonsveiledningen](SELF_HOSTING-nb.md) for detaljer).

```bash
wrangler pages deploy . --project-name=breeze
```

## Tekniske detaljer (for utviklere)

### Krypteringsmetoder

| Rolle | Metode |
|-------|-----------|
| Nøkkelutveksling | X25519 (reserve: P-256) |
| Signatur | Ed25519 (reserve: HMAC-SHA256) |
| Kryptering | AES-256-GCM |
| Nøkkelutledning | HKDF-SHA256 |
| Fornyelse av samtalenøkler | Double Ratchet (samme metode som Signal) |
| Gruppenøkler | Sender Key |
| Skjule avsenderen for releet | Sealed Sender |

Den autoritative utformingen finnes i [spesifikasjonen SPEC.md](../../SPEC.md), og hvor du rapporterer svakheter samt policyen finnes i [SECURITY.md](../../SECURITY.md).

### Tester og kvalitetskontroller

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Bidra til utviklingen

Fremgangsmåte og regler finnes i [CONTRIBUTING.md](../../CONTRIBUTING.md).
Rapporter feil på [issue-siden](https://github.com/shizukutanaka/Breeze/issues). Retningslinjene for oppførsel finnes i [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Lisens

MIT — som det står i [LICENSE](../../LICENSE), kan du bruke, endre og distribuere den fritt.
