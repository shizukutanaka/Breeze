# Breeze-manual

**Læs på andre sprog**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · Dansk (denne side) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze er en krypteret beskedtjeneste, der hverken kræver telefonnummer eller registrering.
Indholdet af en samtale kan kun læses af den, der sendte den, og den, der modtager den. Ikke engang serveren, der transporterer den, kan læse den.
Alle funktioner er gratis, og der er ingen reklamer.

Denne manual er en vejledning til dig, der skal i gang med at bruge den.

---

## 1. Kom godt i gang

### Anskaf den

Vælg den fil på [downloadsiden](https://github.com/shizukutanaka/Breeze/releases/latest), der passer til din enhed.

- Windows: filer med navne, der slutter med `-win-x64.exe` (findes også til ARM-maskiner)
- Mac: filer med navne, der slutter med `-mac.dmg`
- Linux: `.AppImage` (kan køres direkte) eller `.deb`
- Hvis du vil bruge den i browseren, bruger du den version, du har placeret på din egen server (installationsfremgangsmåden findes i det separate dokument "Installationsvejledningen"). Standardopsætningen bruger Cloudflare, så der kræves en Cloudflare-konto.

Hver fil leveres med en kontrolsum (SHA256SUMS.txt). Hvis du er bekymret, kan du kontrollere, at summen for den fil, du har downloadet, stemmer.

> **Om eksempelsiden**: Et eksempel til at tjekke, hvordan det virker (https://breeze-469.pages.dev/), er stillet til rådighed. Det, der ligger der, er den samme software, men eksemplet kan ændre sig eller stoppe uden varsel. Brug til virkelig brug en version, du har placeret på din egen server. En version på din egen server påvirkes ikke, hvis eksemplet stopper.

### Første opsætning

1. Åbn appen.
2. Tryk på "Start med et tilfældigt ID". Så er du klar. Ingen registrering, intet telefonnummer nødvendigt.

- Hvis du indtaster "Dit navn (visningsnavn)" i feltet over knappen, starter du med det navn. Du kan også trykke på knappen, mens feltet er tomt. Du kan ændre visningsnavnet senere i profilafsnittet i indstillingerne.
- Der findes også en måde at oprette en identitet med et navn og et Breeze-ID, som du selv vælger. I så fald udstedes der en gendannelsesfrase, som vises på skærmen. Gendannelsesfrasen er de ord, der lader dig hente den identitet tilbage på en anden enhed. Skriv den ned på papir eller et sikkert sted.
- Hvis du vil gendanne en identitet, du har oprettet før, skal du åbne "Gendan en eksisterende konto", så vises gendannelsesmetoderne (gendan fra en sikkerhedskopifil, gendan med en gendannelsesfrase, gendan med konto + adgangsfrase).
- Når oprettelsen er færdig, vises et kort, der vejleder dig til at beskytte din nøgle med en adgangsfrase (det forsvinder ikke efter et stykke tid). Følg vejledningen og tilføj beskyttelsen til en vigtig identitet.

På det tidspunkt oprettes der en "nøgle" inde i din enhed. Den er selve din identitet.
**Der findes ingen liste over konti på serveren.** Din identitet findes kun inde i din enhed.
Dette bliver vigtigt i kapitlet om sikkerhedskopiering (9).

### Om den tidligere "engangsidentitet"

"Engangsidentiteten" — en identitet uden nogen mulighed for gendannelse — er væk. Med de nuværende måder at oprette en identitet på kan hver identitet beskyttes med en sikkerhedskopi.

---

## 2. Forbind dig med andre

Tryk på knappen "Tilføj ven" på kontaktskærmen, så vises tre valgmuligheder.

- **Tilføj en kontakt**: Indtast den anden persons ID, eller scan en QR-kode.
- **Inviter en ven**: Kopiér invitationslinket, og send det via dine sædvanlige kontaktveje (e-mail osv.). Når den anden person åbner linket og indtaster sit navn, kan I tale med det samme.
- **Opret en gruppe**: Indtast blot et gruppenavn for at oprette en (kapitel 4).

Dit eget ID vises i sin fulde form, når du åbner din egen profil, og du kan kopiere det, som det er. Du kan give det fulde ID videre, ikke kun det korte ID.

Hvis den anden person også har appen åben, kan I forbinde jer direkte og tale sammen.

---

## 3. Samtaler

- Skriv blot en besked og send den. Du kan også sende fotos, klistermærker og placering.
- Åbn "+" ved siden af indtastningsfeltet, så vises filvedhæftninger, talebeskeder, taleindtastning, placering, klistermærker, indstillingen "intet svar nødvendigt" og mere samlet.
- **Afsendelse af filer**: Op til 50 MB i én-til-én-samtaler. I grupper er det mindre, ca. 50 KB.
- Farlige filformater, som eksekverbare filer, blokeres automatisk.
- Hvis den anden person ikke har appen åben, lægges beskeden, stadig krypteret, i en "postkasse" og leveres, når de åbner appen. Serveren, der transporterer postkassen, kan ikke læse indholdet. Breve, der aldrig leveres, slettes automatisk efter **højst 7 dage**.
- Samtalehistorik kan eksporteres til en fil og importeres.

### Sådan læser du skærmen

- **Afsendelsesstatus**: Du kan se det på mærket ved siden af en besked. ✓ betyder sendt, et ✓ i en cirkel betyder, at den er lagt i postkassen, ✓✓ betyder, at den nåede den anden person, læst er et blåt mærke, og fejl er et rødt mærke. De adskilles også ved form, ikke kun farve.
- **Kontaktlisten**: Tidspunktet for jeres seneste samtale vises som klokkeslæt for i dag, "I går" for i går, måned/dag for i år og år/måned/dag for alt tidligere. Kontakter med beskeder, du ikke har læst, har navn og tid fremhævet.
- **Navne til kontakter**: Åbn "Kontaktoplysninger" (i højreklikmenuen for en kontakt eller samtalens menu "⋮"), så kan du angive dit eget navn til den kontakt (et kaldenavn). Kaldenavne gemmes kun på denne enhed og sendes aldrig til kontakten eller relæserveren. Når du angiver et kaldenavn, vises det navn, kontakten selv har angivet, også ved siden af det i en dæmpet farve. Du kan slå det andet navn fra med "Vis også det navn, hver kontakt selv har angivet" i afsnittet "Privatliv" i indstillingerne.
- **Dit eget kort**: Øverst på listen er dit eget profilkort; tryk på det for at åbne din profil. Det ruller sammen med listen.
- **Nederste faner på en telefon**: Ved telefonbredde vises fanerne "Kontakter" og "Indstillinger" nederst på skærmen.
- **Samtaleoverskriften**: Fra søgeikonet kan du søge i samtalen. Fra menuen "⋮" kan du kontrollere sikkerhedsnummeret, slå notifikationer fra, fastgøre, oprette en afstemning og mere.

### Kommandoer

Hvis du skriver `/` i indtastningsfeltet, vises kommandokandidater. Skriv `/help` for at se en liste over de kommandoer, du kan bruge (71 typer).
Nogle handlinger, som indstillinger og enhedslinkning, udføres via kommandoer.

---

## 4. Grupper

- En gruppe kan have op til **1.000 personer**.
- Du opretter en ved blot at indtaste et gruppenavn under "Opret en gruppe" i "Tilføj ven" (du kan også oprette en med kommandoen `/newgroup`). Invitationer sker via "Gruppeinvitationslink". Den, der modtager linket, kan deltage ved at indtaste sit navn.
- Filer kan også sendes i grupper, men grænsen er mindre, ca. 50 KB. Talebeskeder kan endnu ikke sendes i grupper.
- Hvis et medlem bruger en gammel version af appen, kan gruppen ikke bruge den nyere, sikrere tilstand (gruppe v5), og der vises en advarsel på skærmen. Den aktiveres, når alle har den nyeste version.

---

## 5. Opkald

- Du kan have tale- og videoopkald én til én. Der findes også gruppeopkald (op til 8 personer).
- **Bekræftelseskode til opkald**: En bekræftelseskode vises på opkaldsskærmen. Læs den højt sammen med den anden person, og kontrollér, at den stemmer på begge skærme. Hvis den ikke stemmer, kan nogen aflytte opkaldet. Læg på i så fald.
- Gruppeopkald kan nogle gange ikke startes, hvis ikke alles apps er den nyeste version.

---

## 6. Flere enheder og konti

- For at bruge den samme identitet på flere enheder linker du enhederne med kommandoen `/link`.
- Du kan oprette flere konti og bruge dem til forskellige formål (f.eks. arbejde og privat). Både antal enheder og konti er gratis og ubegrænsede.
- **Sådan opretter du en konto**: Tryk på knappen "+" ved siden af kontofanerne allerøverst på kontaktlisten. Indtast et navn, og vælg en ikon-emoji, så oprettes en ny konto, og der skiftes automatisk til den.
- **Skift af konto**: Kontofanerne vises altid allerøverst på kontaktlisten. Tryk på en for at skifte (på en computer kan du også skifte med Ctrl+1–9). Tryk og hold på en fane for at omdøbe den, ændre dens ikon eller slette den.
- Kontakter og nøgler er adskilte for hver konto. Udveksl kontakter igen for hver konto.
- Sproget vælges automatisk blandt 51 sprog, herunder engelsk, så det passer til din enheds sprog.

---

## 7. Indstillinger til at holde dig sikker

Indstillinger åbnes som deres egen skærm. På en telefon åbner du dem fra fanen "Indstillinger" nederst på skærmen; på en computer fra tandhjulsknappen på skærmen (du kan også åbne dem med kommandoen `/settings`). Brug tilbage-handlingen for at vende tilbage til den skærm, du var på.

- **Automatisk lås**: Der findes en indstilling, der låser automatisk, når du skifter fane.
- **Adgangsfrase til nøglen**: Du kan beskytte nøglen inde i din enhed ved at pakke den ind i en adgangsfrase. Du bliver bedt om at indtaste den, når du åbner appen.
- **Vis også det navn, hver kontakt selv har angivet**: I afsnittet "Privatliv". For en kontakt, du har givet et kaldenavn, kan du vælge, om deres eget navn vises ved siden af det (kapitel 3).
- **Blokér**: Du kan blokere besværlige personer. Beskeder fra en blokeret person når dig ikke.

---

## 8. Batteri og nødsituationer (strømtilstande)

I indstillingen "Strømtilstand" kan du vælge, hvordan batteriet bruges.

- **Automatisk (batteriniveau)**: Skifter automatisk efter, hvor meget batteri der er tilbage.
- **Normal**: Som sædvanlig.
- **Strømbesparende**: Spreder leveringstjek ud til højst én gang hvert 60. sekund og stopper tilstedeværelsessignalet.
- **Nødstilstand (til katastrofer)**: Spreder leveringstjek ud til højst én gang hvert 10. minut. Brug den ved en katastrofe eller andre tidspunkter, hvor du ikke kan oplade.

Det, der dræner batteriet, er ikke mængden af kommunikation, men antallet af gange, radioen vågner. Derfor spredes afsendelsessiden ikke ud; kun lyttesiden gør. Afsendelse går stadig ud med det samme, som altid. Når du begynder at oplade, flytter den automatisk et trin tilbage mod den lettere side.

På enheder, der ikke automatisk kan aflæse batteriniveauet (som en iPhone-browser), opfører "Automatisk" sig som Normal, og et manuelt valg virker som valgt.

---

## 9. Sikkerhedskopiering og gendannelse (det vigtigste kapitel)

Din Breeze-identitet er kun nøglen inde i din enhed. Der findes ingen liste over konti på serveren, og skaberen har heller ikke din nøgle.
**Hvis du mister din enhed, mister du din identitet.** Lav altid en sikkerhedskopi til en vigtig identitet.

Sikkerhedskopiering og gendannelse sker fra afsnittet "Sikkerhedskopi & gendannelse" i indstillingerne (knapperne er "Opret sikkerhedskopi", "Gendan sikkerhedskopi" og "Gendan fra fil"). Første gang du tilføjer en kontakt, vises et kort, der opfordrer dig til at lave en sikkerhedskopi, kun én gang.

### Automatisk sikkerhedskopi

Indstillingen "Automatisk sikkerhedskopi" er slået til fra starten. Når dine data ændrer sig, sendes en krypteret sikkerhedskopi automatisk til den relæserver, du selv hoster.

- Den sender ikke ved hver ændring: den venter 30 sekunder efter den seneste ændring og sender alt samlet. Forsøg foretages med mindst 15 minutters mellemrum.
- Mens du er offline, sendes der ingenting; ændringerne holdes tilbage og sendes, når forbindelsen vender tilbage, og når du åbner appen.
- Til automatisk afsendelse skal du indtaste adgangsfrasen til sikkerhedskopien én gang på den enhed (når det er nødvendigt, vises en knap "Indtast adgangsfrase" i indstillingsafsnittet). **Adgangsfrasen gemmes ikke.** Den huskes kun, mens appen er åben, og er væk, når du lukker den. For en identitet med enkel gendannelse fungerer afsendelsen, som den er, lige efter du har indtastet adgangsfrasen ved registrering eller opdatering.
- Hvis relæserveren ikke understøtter lagring af sikkerhedskopier, kører den automatiske sikkerhedskopi ikke. Det vises i indstillingsafsnittet.
- Tilstanden (hvornår den seneste vellykkede afsendelse var, om ændringer venter, om en afsendelse mislykkedes) vises i indstillingsafsnittet.

### Lav en sikkerhedskopi (manuelt)

1. Vælg "Opret sikkerhedskopi" i "Sikkerhedskopi & gendannelse" i indstillingerne.
2. Angiv en adgangsfrase til sikkerhedskopien (mindst 6 tegn).
3. Vælg, hvor den skal gemmes.
   - **Gem i en fil**: Opbevar sikkerhedskopifilen hos dig selv (anbefales).
   - **Gem på relæserveren**: Kan kun bruges, hvis operatøren af det relæ har aktiveret det. Det kan ikke bruges på standardrelæet. Der er en opbevaringsfrist, så hent den tilbage inden fristen.

Sikkerhedskopiens indhold er krypteret. Serveren, hvor den gemmes, håndterer kun krypteret tekst.

### Sådan gendanner du

På en ny enhed gendanner du med sikkerhedskopifilen (eller sikkerhedskopien på relæserveren) og den adgangsfrase, du angav.

Hvis du lige har hentet din identitet tilbage med en gendannelsesfrase, og der findes en sikkerhedskopi af den identitet på relæserveren, bliver den fundet automatisk, og du bliver spurgt med "Sikkerhedskopi fundet". Hvis du gendanner den, erstattes dataene på den enhed med sikkerhedskopiens indhold.

### Flyt til en ny enhed

Tryk på knappen "Flyt til en ny enhed" i afsnittet "Sikkerhedskopi & gendannelse" i indstillingerne, så vises trinnene.

1. På din nuværende enhed skal du sørge for, at der findes en sikkerhedskopi på relæserveren (automatisk sikkerhedskopi eller "Opret sikkerhedskopi").
2. På den nye enhed vælger du en gendannelsesmetode på den første skærm og indtaster din gendannelsesfrase (eller dit kontonavn og din adgangsfrase).
3. Når din identitet er tilbage, findes sikkerhedskopien på serveren automatisk, og en gendannelse tilbydes.

Der er ikke brug for kabler eller filoverdragelser.

### Bemærk

- **Hvis du glemmer adgangsfrasen, er gendannelse umulig.** Ikke engang skaberen kan rette det. Skriv adgangsfrasen ned et andet sted.
- Indtastning af adgangsfrasen til automatisk sikkerhedskopi er nødvendig på hver enhed. På en ny enhed indtaster du den én gang til.
- Lav en manuel sikkerhedskopi om, når dine identiteter bliver flere, eller når du skifter enhed.

---

## 10. Postkassen og hvordan vi tænker om omkostninger

- Breve til en person, der er offline, lægges, krypteret, i relæserverens "postkasse" (højst 7 dage).
- Relæet har grænser for at forhindre misbrug (hvor meget der kan efterlades, og hvor ofte). Når en grænse nås, kan du ikke efterlade nye breve i den periode, men **breve, der allerede er leveret, forsvinder aldrig**. Skærmen viser grunden og, hvor længe du skal vente.
- Hvis du har placeret relæet på din egen server, bestemmer du selv grænserne.

Omfanget af optegnelser, der bliver tilbage på serversiden (alt slettes automatisk, og indholdet kan ikke læses):

| Ting | Hvor længe det bliver tilbage |
|---|---|
| Uafleverede breve | Højst 7 dage |
| Forbindelsessignaler | 5 minutter |
| Optegnelser over adresser og enheder | 90 dage |
| Gruppeoplysninger og notifikationsabonnementer | 30 dage |

---

## 11. Sådan opdaterer du (desktopversionen)

1. Når der findes en ny version, vises en meddelelse på skærmen.
2. Tryk på "Download" for at hente den nye version (den installeres ikke automatisk).
3. Når downloaden er færdig, trykker du på "Installer" og genstarter.

Hvis noget går galt under opdateringen (f.eks. at filkontrollen ikke stemmer), **stopper opdateringen og viser grunden på skærmen**. Det er ikke muligt at gå tilbage til en gammel version.

---

## 12. Når noget går galt

| Symptom | Hvad du bør kontrollere |
|---|---|
| Kan ikke sende beskeder | Kontrollér, at enhedens ur ikke er forkert. Hvis tiden er forkert, mislykkes afsendelsen. |
| Når ikke den anden person | Det venter i postkassen, indtil den anden person åbner appen (højst 7 dage). |
| Kan ikke sende filer | Kontrollér, at du ikke overskrider størrelsesgrænsen (50 MB én til én, ca. 50 KB i grupper), og at filen ikke blokeres som et farligt format. |
| Opkaldets bekræftelseskode stemmer ikke | Læg på, og ring op igen. Fortsæt ikke, mens den ikke stemmer. |
| Glemt adgangsfrasen | Gendannelse er umulig. Opret en ny identitet, og giv dine kontakter besked igen. |
| Mistet enheden | Hvis du har en sikkerhedskopi, kan du gendanne på en ny enhed. Hvis ikke, bliver det en ny identitet. |
| Eksempelsiden åbner ikke | Eksemplet kan stoppe uden varsel. Brug en version, du har placeret på din egen server. |

Rapportér venligst fejl på [issue-siden](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Breezes løfter

- Ingen reklamer. Hverken i appen eller noget andet sted.
- Ingen sporing. Ingen brugsanalyse, ingen reklamemekanismer, intet salg af data — overhovedet ikke.
- Skaberen besidder ingen brugerdata. Der findes slet ingen liste over konti på serversiden.
- Samtaler krypteres mellem enhederne. Serveren håndterer kun forseglede kuverter, som den ikke kan læse.

En detaljeret sammenligning med andre beskedtjenester findes på "sammenligningssiden" i repositoriet, inklusive punkter, hvor Breeze taber (antal brugere, at den ikke har haft en ekstern revision osv.).

---

*Denne manual afspejler Breezes tilstand pr. 2026-11-25.*
