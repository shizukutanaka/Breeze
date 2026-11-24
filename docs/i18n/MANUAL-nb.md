# Breeze-manual

**Les på andre språk**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · Norsk (denne siden) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze er en kryptert meldingstjeneste som ikke krever telefonnummer eller registrering.
Innholdet i en samtale kan bare leses av den som sendte den og den som mottar den. Ikke engang serveren som frakter den, kan lese den.
Alle funksjoner er gratis, og det er ingen reklame.

Denne manualen er en veiledning for deg som skal begynne å bruke den.

---

## 1. Komme i gang

### Skaff den

Velg filen som passer til enheten din på [nedlastingssiden](https://github.com/shizukutanaka/Breeze/releases/latest).

- Windows: filer med navn som slutter på `-win-x64.exe` (finnes også for ARM-maskiner)
- Mac: filer med navn som slutter på `-mac.dmg`
- Linux: `.AppImage` (kan kjøres direkte) eller `.deb`
- Hvis du vil bruke den i nettleseren, bruker du versjonen du har plassert på din egen server (installasjonsfremgangsmåten finnes i det separate dokumentet «Installasjonsveiledningen»)

Hver fil leveres med en kontrollsum (SHA256SUMS.txt). Hvis du er bekymret, kan du kontrollere at summen for filen du lastet ned, stemmer.

> **Om testsiden**: Testsiden som var offentlig (breeze.pages.dev), er for tiden stoppet (du får 404 hvis du åpner den). Bruk appversjonen til den er gjenopprettet. En Breeze du har plassert på din egen server, påvirkes ikke av stoppet.

### Første oppsett

1. Åpne appen.
2. Skriv inn navnet ditt. Da er du klar. Ingen registrering, intet telefonnummer nødvendig.

Da opprettes det en «nøkkel» inne i enheten din. Den er selve identiteten din.
**Det finnes ingen liste over kontoer på serveren.** Identiteten din finnes bare inne i enheten din.
Dette blir viktig i kapitlet om sikkerhetskopiering (8).

### Om «engangsidentitet»

Hvis du velger «engangsidentitet» når du oppretter den, får du en identitet som ikke kan gjenopprettes på noen måte.
Hvis du mister enheten, tilbakestiller den eller sletter nettleserdataene, er identiteten borte for alltid.
Det vises også på skjermen. Ikke velg det for en identitet du vil bruke lenge.

---

## 2. Koble deg til andre

Det finnes tre måter å koble seg til personen du vil snakke med.

- **Gi ID-en din**: Fortell ID-en din til den andre personen og la dem skrive den inn.
- **QR-kode**: Vis en invitasjons-QR-kode og la den andre personen skanne den.
- **Invitasjonslenke**: Kopier en invitasjonsmelding fra «Inviter en venn» og send den via dine vanlige kontaktveier (e-post osv.). Når den andre personen åpner lenken og skriver inn navnet sitt, kan dere snakke med en gang.

Hvis den andre personen også har appen åpen, kan dere koble dere direkte sammen og snakke.

---

## 3. Samtaler

- Bare skriv en melding og send den. Du kan også sende bilder, klistremerker og posisjon.
- **Sende filer**: Opptil 50 MB i samtaler én-til-én. I grupper er det mindre, omtrent 50 KB.
- Farlige filformater, som kjørbare filer, blokkeres automatisk.
- Hvis den andre personen ikke har appen åpen, legges meldingen, fortsatt kryptert, i en «postboks» og leveres når de åpner appen. Serveren som frakter postboksen, kan ikke lese innholdet. Brev som aldri blir levert, slettes automatisk etter **maks 7 dager**.
- Samtalehistorikk kan eksporteres til en fil og importeres.

### Kommandoer

Hvis du skriver `/help` i inndatafeltet, vises en liste over kommandoer du kan bruke (mer enn 60 typer).
Noen handlinger, som innstillinger og enhetslenking, gjøres via kommandoer.

---

## 4. Grupper

- En gruppe kan ha opptil **1 000 personer**.
- Du oppretter en ved bare å skrive inn et gruppenavn. Invitasjoner skjer via «Gruppeinvitasjonslenke». Den som får lenken, kan bli med ved å skrive inn navnet sitt.
- Filer kan også sendes i grupper, men grensen er mindre, omtrent 50 KB. Talemeldinger kan ennå ikke sendes i grupper.
- Hvis et medlem bruker en gammel versjon av appen, kan gruppen ikke bruke den nyere, sikrere modusen (gruppe v5), og det vises en advarsel på skjermen. Den aktiveres når alle har den nyeste versjonen.

---

## 5. Samtaler (tale og video)

- Du kan ha tale- og videosamtaler én-til-én. Det finnes også gruppesamtaler.
- **Bekreftelseskode for samtale**: En bekreftelseskode vises på samtaleskjermen. Les den høyt sammen med den andre personen og kontroller at den stemmer på begge skjermer. Hvis den ikke stemmer, kan det hende at noen avlytter samtalen. Legg på i så fall.
- Gruppesamtaler kan noen ganger ikke startes hvis ikke alles apper er den nyeste versjonen.

---

## 6. Flere enheter og kontoer

- For å bruke samme identitet på flere enheter lenker du enhetene med kommandoen `/link`.
- Du kan opprette flere kontoer og bruke dem til ulike formål (for eksempel jobb og privat). Både antall enheter og antall kontoer er gratis og ubegrenset.
- Språket velges automatisk blant 8: engelsk, japansk, koreansk, kinesisk (Taiwan), spansk, thai, indonesisk og portugisisk (Brasil).

---

## 7. Innstillinger for å holde deg trygg

- **Automatisk lås**: Det finnes en innstilling som låser automatisk når du bytter fane.
- **Passfrase for nøkkelen**: Du kan beskytte nøkkelen inne i enheten din ved å pakke den inn i en passfrase. Du blir bedt om å skrive den inn når du åpner appen.
- **Blokkere**: Du kan blokkere plagsomme personer. Meldinger fra en blokkert person når deg ikke.

---

## 8. Sikkerhetskopiering og gjenoppretting (det viktigste kapitlet)

Din Breeze-identitet er bare nøkkelen inne i enheten din. Det finnes ingen liste over kontoer på serveren, og skaperen har ikke nøkkelen din heller.
**Hvis du mister enheten, mister du identiteten din.** Lag alltid en sikkerhetskopi for en viktig identitet.

### Lage en sikkerhetskopi

1. Velg «Lag sikkerhetskopi».
2. Angi en passfrase for sikkerhetskopien (minst 6 tegn).
3. Velg hvor den skal lagres.
   - **Lagre i en fil**: Oppbevar sikkerhetskopifilen hos deg selv (anbefales).
   - **Lagre på reléserveren**: Kan bare brukes hvis operatøren av det releet har aktivert det. Det kan ikke brukes på standardreleet. Det finnes en oppbevaringsfrist, så hent den tilbake innen fristen.

Innholdet i sikkerhetskopien er kryptert. Serveren der den lagres, håndterer bare kryptert tekst.

### Slik gjenoppretter du

På en ny enhet gjenoppretter du med sikkerhetskopifilen (eller sikkerhetskopien på reléserveren) og passfrasen du anga.

### Merk

- **Hvis du glemmer passfrasen, er gjenoppretting umulig.** Ikke engang skaperen kan fikse det. Skriv passfrasen ned et annet sted.
- **En engangsidentitet kan ikke gjenopprettes, verken med sikkerhetskopi eller gjenoppretting.**
- Lag sikkerhetskopien på nytt når du legger til identiteter eller bytter enhet.

---

## 9. Postboksen og hvordan vi tenker om kostnader

- Brev til en person som er frakoblet, legges, kryptert, i reléserverens «postboks» (maks 7 dager).
- Releet har grenser for å hindre misbruk (hvor mye som kan legges igjen, og hvor ofte). Når en grense nås, kan du ikke legge igjen nye brev i den perioden, men **brev som allerede er levert, forsvinner aldri**. Skjermen viser grunnen og hvor lenge du må vente.
- Hvis du har plassert releet på din egen server, bestemmer du grensene selv.

Omfanget av registre som blir igjen på serversiden (alt slettes automatisk, og innholdet kan ikke leses):

| Ting | Hvor lenge det blir igjen |
|---|---|
| Uleverte brev | Maks 7 dager |
| Tilkoblingssignaler | 5 minutter |
| Registre over adresser og enheter | 90 dager |
| Gruppeinformasjon og varselabonnementer | 30 dager |

---

## 10. Slik oppdaterer du (skrivebordsversjonen)

1. Når det finnes en ny versjon, vises et varsel på skjermen.
2. Trykk på «Last ned» for å hente den nye versjonen (den installeres ikke automatisk).
3. Når nedlastingen er ferdig, trykker du på «Installer» og starter på nytt.

Hvis noe går galt under oppdateringen (for eksempel at filkontrollen ikke stemmer), **stopper oppdateringen og viser grunnen på skjermen**. Det er ikke mulig å gå tilbake til en gammel versjon.

---

## 11. Når noe går galt

| Symptom | Hva du bør kontrollere |
|---|---|
| Kan ikke sende meldinger | Kontroller at klokken på enheten ikke er feil. Hvis tiden er feil, mislykkes sendingen. |
| Når ikke den andre personen | Det venter i postboksen til den andre personen åpner appen (maks 7 dager). |
| Kan ikke sende filer | Kontroller at du ikke overskrider størrelsesgrensen (50 MB én-til-én, omtrent 50 KB i grupper), og at filen ikke blokkeres som et farlig format. |
| Bekreftelseskoden for samtalen stemmer ikke | Legg på og ring på nytt. Ikke fortsett mens den ikke stemmer. |
| Glemt passfrasen | Gjenoppretting er umulig. Opprett en ny identitet og gi kontaktene dine beskjed på nytt. |
| Mistet enheten | Hvis du har en sikkerhetskopi, kan du gjenopprette på en ny enhet. Hvis ikke, blir det en ny identitet. |
| Testsiden åpnes ikke (404) | Den er stoppet for tiden. Bruk appversjonen. |

Rapporter feil på [issue-siden](https://github.com/shizukutanaka/Breeze/issues), takk.

---

## 12. Breezes løfter

- Ingen reklame. Verken i appen eller noe annet sted.
- Ingen sporing. Ingen bruksanalyse, ingen reklamemekanismer, intet salg av data — overhodet ikke.
- Skaperen sitter ikke på brukerdata. Det finnes ingen liste over kontoer på serversiden i det hele tatt.
- Samtaler krypteres mellom enhetene. Serveren håndterer bare forseglede konvolutter den ikke kan lese.

En detaljert sammenligning med andre meldingstjenester finnes på «sammenligningssiden» i repositoriet, inkludert punkter der Breeze taper (antall brukere, at den ikke har hatt ekstern revisjon osv.).

---

*Denne manualen beskriver innholdet per Breeze v3.8.0.*
