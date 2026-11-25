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
- Hvis du vil bruke den i nettleseren, bruker du versjonen du har plassert på din egen server (installasjonsfremgangsmåten finnes i det separate dokumentet «Installasjonsveiledningen»). Standardoppsettet bruker Cloudflare, så en Cloudflare-konto kreves.

Hver fil leveres med en kontrollsum (SHA256SUMS.txt). Hvis du er bekymret, kan du kontrollere at summen for filen du lastet ned, stemmer.

> **Om eksempelsiden**: Et eksempel for å sjekke hvordan det fungerer (https://breeze-469.pages.dev/) er tilgjengelig. Det som ligger der, er den samme programvaren, men eksemplet kan endres eller stoppes uten varsel. Bruk en kopi du har plassert på din egen server til virkelig bruk. En kopi på din egen server påvirkes ikke hvis eksemplet stoppes.

### Første oppsett

1. Åpne appen.
2. Trykk på «Start med en tilfeldig ID». Da er du klar. Ingen registrering, intet telefonnummer nødvendig.

- Hvis du skriver inn «Navnet ditt (visningsnavn)» i feltet over knappen, starter du med det navnet. Du kan også trykke på knappen mens feltet er tomt. Du kan endre visningsnavnet senere, i profildelen av innstillingene.
- Det finnes også en måte å opprette en identitet med et navn og en Breeze-ID du velger selv. I så fall utstedes en gjenopprettingsfrase og vises på skjermen. Gjenopprettingsfrasen er ordene som lar deg hente den identiteten tilbake på en annen enhet. Skriv den ned på papir eller et trygt sted.
- Hvis du vil hente tilbake en identitet du har opprettet før, åpner du «Gjenopprett en eksisterende konto», og gjenopprettingsmetodene (gjenopprett fra en sikkerhetskopifil, gjenopprett med en gjenopprettingsfrase, gjenopprett med konto + passfrase) vises.
- Når opprettingen er ferdig, vises et kort som veileder deg til å beskytte nøkkelen din med en passfrase (det forsvinner ikke etter en stund). Følg veiledningen og legg til beskyttelsen for en viktig identitet.

Da opprettes det en «nøkkel» inne i enheten din. Den er selve identiteten din.
**Det finnes ingen liste over kontoer på serveren.** Identiteten din finnes bare inne i enheten din.
Dette blir viktig i kapitlet om sikkerhetskopiering (9).

### Om den tidligere «engangsidentiteten»

«Engangsidentiteten» — en identitet uten noen mulighet for gjenoppretting — er borte. Med de nåværende måtene å opprette en identitet på kan hver identitet beskyttes med en sikkerhetskopi.

---

## 2. Koble deg til andre

Trykk på knappen «Legg til venn» på kontaktskjermen, så vises tre valg.

- **Legg til en kontakt**: Skriv inn den andre personens ID, eller skann en QR-kode.
- **Inviter en venn**: Kopier invitasjonslenken og send den via dine vanlige kontaktveier (e-post osv.). Når den andre personen åpner lenken og skriver inn navnet sitt, kan dere snakke med en gang.
- **Opprett en gruppe**: Skriv bare inn et gruppenavn for å opprette en (kapittel 4).

Din egen ID vises i fullstendig form når du åpner din egen profil, og du kan kopiere den som den er. Gi videre den fullstendige ID-en, ikke bare den korte ID-en.

Hvis den andre personen også har appen åpen, kan dere koble dere direkte sammen og snakke.

---

## 3. Samtaler

- Bare skriv en melding og send den. Du kan også sende bilder, klistremerker og posisjon.
- Åpne «+» ved siden av inndatafeltet, så vises filvedlegg, talemeldinger, taleinndata, posisjon, klistremerker, innstillingen «svar ikke nødvendig» og mer sammen.
- **Sende filer**: Opptil 50 MB i samtaler én-til-én. I grupper er det mindre, omtrent 50 KB.
- Farlige filformater, som kjørbare filer, blokkeres automatisk.
- Hvis den andre personen ikke har appen åpen, legges meldingen, fortsatt kryptert, i en «postboks» og leveres når de åpner appen. Serveren som frakter postboksen, kan ikke lese innholdet. Brev som aldri blir levert, slettes automatisk etter **maks 7 dager**.
- Samtalehistorikk kan eksporteres til en fil og importeres.

### Lese skjermen

- **Sendestatus**: Du ser den på merket ved siden av en melding. ✓ betyr sendt, et ✓ i en sirkel betyr at den er lagt i postboksen, ✓✓ betyr at den nådde den andre personen, lest er et blått merke, og feil er et rødt merke. De skilles både på form og farge.
- **Kontaktlisten**: Tidspunktet for den siste samtalen vises som klokkeslettet for i dag, «I går» for i går, måned/dag for i år og år/måned/dag for alt tidligere. Kontakter med meldinger du ikke har lest, har navn og tidspunkt fremhevet.
- **Navn på kontakter**: Åpne «Kontaktinfo» (i høyreklikkmenyen til en kontakt, eller samtalens meny «⋮»), så kan du angi et eget navn for den kontakten (et kallenavn). Kallenavn lagres bare på denne enheten og sendes aldri til kontakten eller reléserveren. Når du angir et kallenavn, vises også navnet kontakten selv har angitt ved siden av det i en dempet farge. Du kan slå av det andre navnet med «Vis også navnet hver kontakt selv har angitt» i avsnittet «Personvern» i innstillingene.
- **Ditt eget kort**: Øverst i listen er ditt eget profilkort; trykk på det for å åpne profilen din. Det ruller sammen med listen.
- **Nederste faner på en telefon**: Ved telefonbredde vises fanene «Kontakter» og «Innstillinger» nederst på skjermen.
- **Samtaleoverskriften**: Fra søkeikonet kan du søke i samtalen. Fra menyen «⋮» kan du sjekke sikkerhetsnummeret, dempe varsler, feste, opprette en avstemning og mer.

### Kommandoer

Skriv `/` i inndatafeltet, så vises kommandoforslag. Skriv `/help` for å se en liste over kommandoer du kan bruke (71 typer).
Noen handlinger, som innstillinger og enhetslenking, gjøres via kommandoer.

---

## 4. Grupper

- En gruppe kan ha opptil **1 000 personer**.
- Du oppretter en gruppe ved bare å skrive inn et gruppenavn under «Opprett en gruppe» i «Legg til venn» (du kan også opprette en med kommandoen `/newgroup`). Invitasjoner skjer via «Gruppeinvitasjonslenke». Den som får lenken, kan bli med ved å skrive inn navnet sitt.
- Filer kan også sendes i grupper, men grensen er mindre, omtrent 50 KB. Talemeldinger kan ennå ikke sendes i grupper.
- Hvis et medlem bruker en gammel versjon av appen, kan gruppen ikke bruke den nyere, sikrere modusen (gruppe v5), og det vises en advarsel på skjermen. Den aktiveres når alle har den nyeste versjonen.

---

## 5. Samtaler (tale og video)

- Du kan ha tale- og videosamtaler én-til-én. Det finnes også gruppesamtaler (opptil 8 personer).
- **Bekreftelseskode for samtale**: En bekreftelseskode vises på samtaleskjermen. Les den høyt sammen med den andre personen og kontroller at den stemmer på begge skjermer. Hvis den ikke stemmer, kan det hende at noen avlytter samtalen. Legg på i så fall.
- Gruppesamtaler kan noen ganger ikke startes hvis ikke alles apper er den nyeste versjonen.

---

## 6. Flere enheter og kontoer

- For å bruke samme identitet på flere enheter lenker du enhetene med kommandoen `/link`.
- Du kan opprette flere kontoer og bruke dem til ulike formål (for eksempel jobb og privat). Både antall enheter og antall kontoer er gratis og ubegrenset.
- **Slik oppretter du en konto**: Trykk på knappen «+» ved siden av kontofanene helt øverst i kontaktlisten. Skriv inn et navn og velg en ikon-emoji, så opprettes en ny konto og byttes til automatisk.
- **Bytte kontoer**: Kontofanene vises alltid helt øverst i kontaktlisten. Trykk på en for å bytte (på en datamaskin kan du også bytte med Ctrl+1–9). Trykk og hold på en fane for å endre navn på den, endre ikonet eller slette den.
- Kontakter og nøkler er separate for hver konto. Utveksle kontakter på nytt for hver konto.
- Språket velges automatisk blant 51 språk, inkludert engelsk, tilpasset språket på enheten din.

---

## 7. Innstillinger for å holde deg trygg

Innstillinger åpnes som en egen skjerm. Åpne dem på en telefon fra fanen «Innstillinger» nederst på skjermen; på en datamaskin fra tannhjulknappen på skjermen (du kan også åpne dem med kommandoen `/settings`). Bruk tilbakehandlingen for å gå tilbake til skjermen du var på.

- **Automatisk lås**: Det finnes en innstilling som låser automatisk når du bytter fane.
- **Passfrase for nøkkelen**: Du kan beskytte nøkkelen inne i enheten din ved å pakke den inn i en passfrase. Du blir bedt om å skrive den inn når du åpner appen.
- **Vis også navnet hver kontakt selv har angitt**: I avsnittet «Personvern». For en kontakt du har gitt et kallenavn, kan du velge om deres eget navn vises ved siden av det (kapittel 3).
- **Blokkere**: Du kan blokkere plagsomme personer. Meldinger fra en blokkert person når deg ikke.

---

## 8. Batteri og nødsituasjoner (strømmoduser)

I innstillingen «Strømmodus» kan du velge hvordan batteriet brukes.

- **Automatisk (batterinivå)**: Bytter automatisk etter hvor mye batteri som er igjen.
- **Normal**: Som vanlig.
- **Strømsparing**: Sprer leveringskontroller ut til høyst én gang hvert 60. sekund og stopper tilstedeværelsessignalet.
- **Nødmodus (for katastrofer)**: Sprer leveringskontroller ut til høyst én gang hvert 10. minutt. Bruk den ved en katastrofe eller en annen tid da du ikke kan lade.

Det som tapper batteriet, er ikke mengden kommunikasjon, men antall ganger radioen våkner. Derfor spres ikke sendesiden ut; bare lyttesiden. Sending går fortsatt ut med en gang, som alltid. Når du begynner å lade, flyttes den automatisk ett trinn tilbake mot den lettere siden.

På enheter som ikke kan lese batterinivået automatisk (som en iPhone-nettleser), oppfører «Automatisk» seg som Normal, og et manuelt valg fungerer som valgt.

---

## 9. Sikkerhetskopiering og gjenoppretting (det viktigste kapitlet)

Din Breeze-identitet er bare nøkkelen inne i enheten din. Det finnes ingen liste over kontoer på serveren, og skaperen har ikke nøkkelen din heller.
**Hvis du mister enheten, mister du identiteten din.** Lag alltid en sikkerhetskopi for en viktig identitet.

Sikkerhetskopiering og gjenoppretting gjøres fra avsnittet «Sikkerhetskopi og gjenoppretting» i innstillingene (knappene er «Opprett sikkerhetskopi», «Gjenopprett sikkerhetskopi» og «Gjenopprett fra fil»). Første gang du legger til en kontakt, vises et kort som oppfordrer deg til å lage en sikkerhetskopi, bare én gang.

### Automatisk sikkerhetskopiering

Innstillingen «Automatisk sikkerhetskopiering» er på fra starten. Når dataene dine endres, sendes en kryptert sikkerhetskopi automatisk til reléserveren du selv driver.

- Den sender ikke ved hver endring: den venter 30 sekunder etter den siste endringen og sender alt sammen. Forsøk gjøres med minst 15 minutters mellomrom.
- Mens du er frakoblet, sendes ingenting; endringene holdes tilbake og sendes når tilkoblingen kommer tilbake og når du åpner appen.
- For automatisk sending må du skrive inn passfrasen for sikkerhetskopien én gang på den enheten (når det trengs, vises en knapp «Skriv inn passfrase» i innstillingsavsnittet). **Passfrasen lagres ikke.** Den huskes bare mens appen er åpen, og er borte når du lukker den. For en identitet med enkel gjenoppretting fungerer sendingen som den er rett etter at du har skrevet inn passfrasen ved registrering eller oppdatering.
- Hvis reléserveren ikke støtter lagring av sikkerhetskopier, kjører ikke automatisk sikkerhetskopiering. Det vises i innstillingsavsnittet.
- Tilstanden (når den siste vellykkede sendingen var, om endringer venter, om en sending mislyktes) vises i innstillingsavsnittet.

### Lage en sikkerhetskopi (manuelt)

1. Velg «Opprett sikkerhetskopi» i «Sikkerhetskopi og gjenoppretting» i innstillingene.
2. Angi en passfrase for sikkerhetskopien (minst 6 tegn).
3. Velg hvor den skal lagres.
   - **Lagre i en fil**: Oppbevar sikkerhetskopifilen hos deg selv (anbefales).
   - **Lagre på reléserveren**: Kan bare brukes hvis operatøren av det releet har aktivert det. Det kan ikke brukes på standardreleet. Det finnes en oppbevaringsfrist, så hent den tilbake innen fristen.

Innholdet i sikkerhetskopien er kryptert. Serveren der den lagres, håndterer bare kryptert tekst.

### Slik gjenoppretter du

På en ny enhet gjenoppretter du med sikkerhetskopifilen (eller sikkerhetskopien på reléserveren) og passfrasen du anga.

Hvis du nettopp har hentet identiteten din tilbake med en gjenopprettingsfrase, og en sikkerhetskopi av den identiteten finnes på reléserveren, blir den funnet automatisk, og du blir spurt med «Sikkerhetskopi funnet». Hvis du gjenoppretter den, erstattes dataene på den enheten med innholdet i sikkerhetskopien.

### Flytt til en ny enhet

Trykk på knappen «Flytt til en ny enhet» i avsnittet «Sikkerhetskopi og gjenoppretting» i innstillingene, så vises trinnene.

1. På den nåværende enheten din, sørg for at det finnes en sikkerhetskopi på reléserveren (automatisk sikkerhetskopiering, eller «Opprett sikkerhetskopi»).
2. På den nye enheten velger du en gjenopprettingsmetode på den første skjermen og skriver inn gjenopprettingsfrasen din (eller kontonavnet og passfrasen din).
3. Når identiteten din er tilbake, blir sikkerhetskopien på serveren funnet automatisk, og en gjenoppretting tilbys.

Ingen kabler eller filoverleveringer trengs.

### Merk

- **Hvis du glemmer passfrasen, er gjenoppretting umulig.** Ikke engang skaperen kan fikse det. Skriv passfrasen ned et annet sted.
- Å skrive inn passfrasen for automatisk sikkerhetskopiering trengs på hver enhet. På en ny enhet skriver du den inn én gang til.
- Lag en manuell sikkerhetskopi på nytt når identitetene dine blir flere, eller når du bytter enhet.

---

## 10. Postboksen og hvordan vi tenker om kostnader

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

## 11. Slik oppdaterer du (skrivebordsversjonen)

1. Når det finnes en ny versjon, vises et varsel på skjermen.
2. Trykk på «Last ned» for å hente den nye versjonen (den installeres ikke automatisk).
3. Når nedlastingen er ferdig, trykker du på «Installer» og starter på nytt.

Hvis noe går galt under oppdateringen (for eksempel at filkontrollen ikke stemmer), **stopper oppdateringen og viser grunnen på skjermen**. Det er ikke mulig å gå tilbake til en gammel versjon.

---

## 12. Når noe går galt

| Symptom | Hva du bør kontrollere |
|---|---|
| Kan ikke sende meldinger | Kontroller at klokken på enheten ikke er feil. Hvis tiden er feil, mislykkes sendingen. |
| Når ikke den andre personen | Det venter i postboksen til den andre personen åpner appen (maks 7 dager). |
| Kan ikke sende filer | Kontroller at du ikke overskrider størrelsesgrensen (50 MB én-til-én, omtrent 50 KB i grupper), og at filen ikke blokkeres som et farlig format. |
| Bekreftelseskoden for samtalen stemmer ikke | Legg på og ring på nytt. Ikke fortsett mens den ikke stemmer. |
| Glemt passfrasen | Gjenoppretting er umulig. Opprett en ny identitet og gi kontaktene dine beskjed på nytt. |
| Mistet enheten | Hvis du har en sikkerhetskopi, kan du gjenopprette på en ny enhet. Hvis ikke, blir det en ny identitet. |
| Eksempelsiden åpnes ikke | Eksemplet kan stoppes uten varsel. Bruk en kopi du har plassert på din egen server. |

Rapporter feil på [issue-siden](https://github.com/shizukutanaka/Breeze/issues), takk.

---

## 13. Breezes løfter

- Ingen reklame. Verken i appen eller noe annet sted.
- Ingen sporing. Ingen bruksanalyse, ingen reklamemekanismer, intet salg av data — overhodet ikke.
- Skaperen sitter ikke på brukerdata. Det finnes ingen liste over kontoer på serversiden i det hele tatt.
- Samtaler krypteres mellom enhetene. Serveren håndterer bare forseglede konvolutter den ikke kan lese.

En detaljert sammenligning med andre meldingstjenester finnes på «sammenligningssiden» i repositoriet, inkludert punkter der Breeze taper (antall brukere, at den ikke har hatt ekstern revisjon osv.).

---

*Denne manualen beskriver innholdet for Breeze per 2026-11-25.*
