# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Läs på andra språk**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · Svenska (den här sidan) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**En krypterad meddelandeapp som varken kräver telefonnummer eller registrering.**
Innehållet i en konversation kan bara läsas av den som skickade den och den som tar emot den. Inte ens servern som transporterar den kan läsa den.
Alla funktioner är gratis, och det finns ingen reklam.

Det här är inte en webbsida, utan programvara som du installerar och använder (Windows / Mac / Linux / Android / iPhone / webbläsare).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## För att använda Breeze placerar du den på din egen server

Breeze har ingen "företagsserver". **För att använda Breeze tillhandahåller du själv en plats (en server) och placerar Breeze där. Det är det officiella sättet att använda den.**

- Standardinstallationen använder Cloudflare, så **ett Cloudflare-konto krävs**. Anvisningarna finns i [installationsguiden](SELF_HOSTING-sv.md) (versioner på andra språk kan väljas i början av guiden).
- Hämta appen (Windows / Mac / Linux / Android / iPhone) från [nedladdningssidan](https://github.com/shizukutanaka/Breeze/releases/latest) och använd den ansluten till din egen server.

Mer detaljerade anvisningar finns i [manualen](MANUAL-sv.md) (versioner på andra språk kan väljas i början av manualen).

## Så här använder du den (3 steg)

1. Öppna den Breeze du har placerat på din egen server (eller adressen du fått av den som placerade den), och tryck på "Börja med ett slumpmässigt ID" (du kan ange ett namn om du vill). Det är allt – du är redo (ingen registrering, inget telefonnummer behövs). Då skapas en "nyckel" inuti din enhet, och den är din identitet.
2. Ge din ID eller QR-kod till den person du vill prata med.
3. Om den andra personen också har appen öppen kan ni ansluta direkt och prata. Om de inte har den öppen placeras meddelandet, fortfarande krypterat, i en "brevlåda" och levereras när de öppnar appen. Servern som transporterar brevlådan kan inte läsa innehållet. Brev som aldrig levereras raderas automatiskt efter högst 7 dagar.

## Löften (vad vi inte gör)

- **Ingen reklam.** Varken i appen eller någon annanstans.
- **Ingen spårning.** Ingen analys av användning, inga reklammekanismer, ingen försäljning av data – över huvud taget.
- **Skaparen innehar inga användardata.** Det finns ingen lista över konton på serversidan över huvud taget. Din identitet är bara nyckeln inuti din enhet.
- **Konversationer krypteras mellan enheterna.** Servern hanterar bara förseglade kuvert som den inte kan läsa.

Vi skriver också ärligt om gränserna. För att leverera meddelanden finns det en kortvarig förvaring på servern (olevererade kuvert i högst 7 dagar, anslutningssignaler i 5 minuter, adress- och enhetsregister i 90 dagar, gruppinformation och aviseringar i 30 dagar. Allt raderas automatiskt och innehållet kan inte läsas). Säkerhetskopiering till molnet är inaktiverad från början. Om du placerar Breeze på din egen server har du även den förvaringen under din egen kontroll.

## Funktioner

- Chattar en mot en och gruppchattar (upp till 1 000 personer)
- Röstsamtal och videosamtal (gruppsamtal upp till 8 personer)
- Samtalshistorik (sparas endast på den här enheten: endast den andra personen, riktning, tid och samtalets längd — inget av det som sades. Skickas aldrig till en server eller till den andra personen)
- Skicka filer (upp till 50MB i chattar en mot en. Det går även i grupper, men storleksgränsen är mindre där)
- Flera enheter och flera konton för olika ändamål (till exempel arbete och privat. Både antal enheter och konton är gratis och obegränsade)
- Automatisk säkerhetskopiering (när något ändras sparas en krypterad säkerhetskopia automatiskt på din egen server. På en ny enhet, när du har återställt din identitet, hittas en säkerhetskopia automatiskt och erbjuds dig. Inställningarna vägleder dig också genom flytten till en ny enhet)
- Ett namn du väljer för varje kontakt (du kan byta namn på varje kontakt, lagras bara på den här enheten. Du kan också välja om namnet som varje kontakt själv har ställt in ska visas)
- 51 språk (engelska plus 50 språkfiler), väljs automatiskt för att matcha enhetens språk
- Profiler med foto, klistermärken, platsdelning
- Kommandon som `/help` (71 typer)
- Energilägen anpassade till ditt batteri (automatiskt / normalt / energisparläge / nödläge). När batteriet tar slut sprids leveranskontroller ut så att batteriet räcker längre. Ett skydd för katastrofer och andra tider då du inte kan ladda
- Nedre flikar på en telefon (Chattar / Samtal / Kontakter / Mitt kort / Inställningar. Vilka flikar som visas kan väljas i inställningarna)
- Lättlästa skärmar (uppmärksamhet på färgkontrast, textstorlek och användning med enbart tangentbordet)

## Skillnader mot andra meddelandeappar

| | Breeze | De flesta meddelandeappar |
|---|--------|--------|
| Registrering | Behövs inte (identiteten är en nyckel i din enhet) | Telefonnummer krävs |
| Server | Kan inte läsa innehållet | Förutsätter att du litar på driftsbolaget |
| Placera på egen server | En förutsättning (något du placerar och använder) | Går inte |
| Öppen källkod | Allt är öppet (MIT-licens) | Ofta sluten |
| Var data finns | I din enhet | På driftsbolagets servrar |

En detaljerad jämförelse med Signal och LINE finns på [jämförelsesidan (engelska)](../COMPARISON.md). Varje påstående från Breeze har en "så här kan du kontrollera det"-metod, och punkter där Breeze förlorar (antal användare, att den inte har genomgått någon extern granskning osv.) döljs inte.

## Kostnad för att placera på din egen server

Breeze körs inom Cloudflares gratisnivå. Inget kreditkort behövs.

| Post | Gratisnivå | Om du betalar |
|-----------|-----------|-------------|
| Plats | Cloudflare Pages (gratis) | — |
| Bearbetning | Upp till 100 000 gånger per dag | Upp till 10 miljoner gånger per månad |
| Lagring | Per dag: 100 000 läsningar, 1 000 skrivningar | Per månad: 10 miljoner läsningar, 1 miljon skrivningar |
| Samtalsrelä | Gratis upp till 20GB | 0,05 dollar per GB |
| Egen domän | Behövs inte (en gratis adress ingår) | 10 dollar per år |
| **Totalt** | **0 dollar per månad** (upp till ungefär 20–40 personer vid lätt användning) | **Från 5 dollar per månad** (ungefär 100 personer vid lätt användning. Vid 1 000 personer, 34–222 dollar per månad beroende på användning) |

Hur kostnaden växer i stor skala och "varför en enda operatör inte behöver bära hela kostnaden" beskrivs i [tankar om kostnad och hållbarhet (engelska)](../SUSTAINABILITY.md), och beräkningarna bakom finns i [kostnadsmodellen (engelska)](../COST_MODEL.md).

Installationen börjar med detta enda kommando (se [installationsguiden](SELF_HOSTING-sv.md) för detaljer).

```bash
wrangler pages deploy . --project-name=breeze
```

## Tekniska detaljer (för utvecklare)

### Krypteringsmetoder

| Roll | Metod |
|-------|-----------|
| Nyckelutbyte | X25519 (reserv: P-256) |
| Signatur | Ed25519 (reserv: HMAC-SHA256) |
| Kryptering | AES-256-GCM |
| Nyckelhärledning | HKDF-SHA256 |
| Förnyelse av konversationsnycklar | Double Ratchet (samma metod som Signal) |
| Gruppnycklar | Sender Key |
| Dölja avsändaren för reläet | Sealed Sender |

Den auktoritativa designen finns i [specifikationen SPEC.md](../../SPEC.md), och vart du rapporterar svagheter och policyn finns i [SECURITY.md](../../SECURITY.md).

### Tester och kvalitetskontroller

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Bidra till utvecklingen

Processen och reglerna finns i [CONTRIBUTING.md](../../CONTRIBUTING.md).
Rapportera buggar på [issuesidan](https://github.com/shizukutanaka/Breeze/issues). Uppförandekoden finns i [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Licens

MIT — som det står i [LICENSE](../../LICENSE) får du använda, ändra och distribuera den fritt.
