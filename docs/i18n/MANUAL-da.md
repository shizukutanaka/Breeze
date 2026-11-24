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
- Hvis du vil bruge den i browseren, bruger du den version, du har placeret på din egen server (installationsfremgangsmåden findes i det separate dokument "Installationsvejledningen")

Hver fil leveres med en kontrolsum (SHA256SUMS.txt). Hvis du er bekymret, kan du kontrollere, at summen for den fil, du har downloadet, stemmer.

> **Om testsiden**: Testsiden, der var offentlig (breeze.pages.dev), er i øjeblikket stoppet (du får 404, hvis du åbner den). Brug appversionen, indtil den er genoprettet. En Breeze, du har placeret på din egen server, påvirkes ikke af stoppet.

### Første opsætning

1. Åbn appen.
2. Indtast dit navn. Så er du klar. Ingen registrering, intet telefonnummer nødvendigt.

På det tidspunkt oprettes der en "nøgle" inde i din enhed. Den er selve din identitet.
**Der findes ingen liste over konti på serveren.** Din identitet findes kun inde i din enhed.
Dette bliver vigtigt i kapitlet om sikkerhedskopiering (8).

### Om "engangsidentitet"

Hvis du vælger "engangsidentitet" ved oprettelsen, får du en identitet, der ikke kan gendannes på nogen måde.
Hvis du mister enheden, nulstiller den eller sletter browserens data, er identiteten væk for altid.
Det vises også på skærmen. Vælg det ikke til en identitet, du vil bruge i lang tid.

---

## 2. Forbind dig med andre

Der er tre måder at forbinde sig med den person, du vil tale med.

- **Giv dit ID**: Fortæl dit ID til den anden person, og lad dem indtaste det.
- **QR-kode**: Vis en invitations-QR-kode, og lad den anden person scanne den.
- **Invitationslink**: Kopiér en invitationsbesked fra "Inviter en ven", og send den via dine sædvanlige kontaktveje (e-mail osv.). Når den anden person åbner linket og indtaster sit navn, kan I tale med det samme.

Hvis den anden person også har appen åben, kan I forbinde jer direkte og tale sammen.

---

## 3. Samtaler

- Skriv blot en besked og send den. Du kan også sende fotos, klistermærker og placering.
- **Afsendelse af filer**: Op til 50 MB i én-til-én-samtaler. I grupper er det mindre, ca. 50 KB.
- Farlige filformater, som eksekverbare filer, blokeres automatisk.
- Hvis den anden person ikke har appen åben, lægges beskeden, stadig krypteret, i en "postkasse" og leveres, når de åbner appen. Serveren, der transporterer postkassen, kan ikke læse indholdet. Breve, der aldrig leveres, slettes automatisk efter **højst 7 dage**.
- Samtalehistorik kan eksporteres til en fil og importeres.

### Kommandoer

Hvis du skriver `/help` i indtastningsfeltet, vises en liste over kommandoer, du kan bruge (mere end 60 typer).
Nogle handlinger, som indstillinger og enhedslinkning, udføres via kommandoer.

---

## 4. Grupper

- En gruppe kan have op til **1.000 personer**.
- Du opretter en ved blot at indtaste et gruppenavn. Invitationer sker via "Gruppeinvitationslink". Den, der modtager linket, kan deltage ved at indtaste sit navn.
- Filer kan også sendes i grupper, men grænsen er mindre, ca. 50 KB. Talebeskeder kan endnu ikke sendes i grupper.
- Hvis et medlem bruger en gammel version af appen, kan gruppen ikke bruge den nyere, sikrere tilstand (gruppe v5), og der vises en advarsel på skærmen. Den aktiveres, når alle har den nyeste version.

---

## 5. Opkald

- Du kan have tale- og videoopkald én til én. Der findes også gruppeopkald.
- **Bekræftelseskode til opkald**: En bekræftelseskode vises på opkaldsskærmen. Læs den højt sammen med den anden person, og kontrollér, at den stemmer på begge skærme. Hvis den ikke stemmer, kan nogen aflytte opkaldet. Læg på i så fald.
- Gruppeopkald kan nogle gange ikke startes, hvis ikke alles apps er den nyeste version.

---

## 6. Flere enheder og konti

- For at bruge den samme identitet på flere enheder linker du enhederne med kommandoen `/link`.
- Du kan oprette flere konti og bruge dem til forskellige formål (f.eks. arbejde og privat). Både antal enheder og konti er gratis og ubegrænsede.
- Sproget vælges automatisk blandt 8: engelsk, japansk, koreansk, kinesisk (Taiwan), spansk, thai, indonesisk og portugisisk (Brasilien).

---

## 7. Indstillinger til at holde dig sikker

- **Automatisk lås**: Der findes en indstilling, der låser automatisk, når du skifter fane.
- **Adgangsfrase til nøglen**: Du kan beskytte nøglen inde i din enhed ved at pakke den ind i en adgangsfrase. Du bliver bedt om at indtaste den, når du åbner appen.
- **Blokér**: Du kan blokere besværlige personer. Beskeder fra en blokeret person når dig ikke.

---

## 8. Sikkerhedskopiering og gendannelse (det vigtigste kapitel)

Din Breeze-identitet er kun nøglen inde i din enhed. Der findes ingen liste over konti på serveren, og skaberen har heller ikke din nøgle.
**Hvis du mister din enhed, mister du din identitet.** Lav altid en sikkerhedskopi til en vigtig identitet.

### Lav en sikkerhedskopi

1. Vælg "Lav sikkerhedskopi".
2. Angiv en adgangsfrase til sikkerhedskopien (mindst 6 tegn).
3. Vælg, hvor den skal gemmes.
   - **Gem i en fil**: Opbevar sikkerhedskopifilen hos dig selv (anbefales).
   - **Gem på relæserveren**: Kan kun bruges, hvis operatøren af det relæ har aktiveret det. Det kan ikke bruges på standardrelæet. Der er en opbevaringsfrist, så hent den tilbage inden fristen.

Sikkerhedskopiens indhold er krypteret. Serveren, hvor den gemmes, håndterer kun krypteret tekst.

### Sådan gendanner du

På en ny enhed gendanner du med sikkerhedskopifilen (eller sikkerhedskopien på relæserveren) og den adgangsfrase, du angav.

### Bemærk

- **Hvis du glemmer adgangsfrasen, er gendannelse umulig.** Ikke engang skaberen kan rette det. Skriv adgangsfrasen ned et andet sted.
- **En engangsidentitet kan ikke gendannes, hverken med sikkerhedskopi eller gendannelse.**
- Lav sikkerhedskopien om, når du tilføjer identiteter eller skifter enhed.

---

## 9. Postkassen og hvordan vi tænker om omkostninger

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

## 10. Sådan opdaterer du (desktopversionen)

1. Når der findes en ny version, vises en meddelelse på skærmen.
2. Tryk på "Download" for at hente den nye version (den installeres ikke automatisk).
3. Når downloaden er færdig, trykker du på "Installer" og genstarter.

Hvis noget går galt under opdateringen (f.eks. at filkontrollen ikke stemmer), **stopper opdateringen og viser grunden på skærmen**. Det er ikke muligt at gå tilbage til en gammel version.

---

## 11. Når noget går galt

| Symptom | Hvad du bør kontrollere |
|---|---|
| Kan ikke sende beskeder | Kontrollér, at enhedens ur ikke er forkert. Hvis tiden er forkert, mislykkes afsendelsen. |
| Når ikke den anden person | Det venter i postkassen, indtil den anden person åbner appen (højst 7 dage). |
| Kan ikke sende filer | Kontrollér, at du ikke overskrider størrelsesgrænsen (50 MB én til én, ca. 50 KB i grupper), og at filen ikke blokeres som et farligt format. |
| Opkaldets bekræftelseskode stemmer ikke | Læg på, og ring op igen. Fortsæt ikke, mens den ikke stemmer. |
| Glemt adgangsfrasen | Gendannelse er umulig. Opret en ny identitet, og giv dine kontakter besked igen. |
| Mistet enheden | Hvis du har en sikkerhedskopi, kan du gendanne på en ny enhed. Hvis ikke, bliver det en ny identitet. |
| Testsiden åbner ikke (404) | Den er i øjeblikket stoppet. Brug appversionen. |

Rapportér venligst fejl på [issue-siden](https://github.com/shizukutanaka/Breeze/issues).

---

## 12. Breezes løfter

- Ingen reklamer. Hverken i appen eller noget andet sted.
- Ingen sporing. Ingen brugsanalyse, ingen reklamemekanismer, intet salg af data — overhovedet ikke.
- Skaberen besidder ingen brugerdata. Der findes slet ingen liste over konti på serversiden.
- Samtaler krypteres mellem enhederne. Serveren håndterer kun forseglede kuverter, som den ikke kan læse.

En detaljeret sammenligning med andre beskedtjenester findes på "sammenligningssiden" i repositoriet, inklusive punkter, hvor Breeze taber (antal brugere, at den ikke har haft en ekstern revision osv.).

---

*Denne manual beskriver indholdet pr. Breeze v3.8.0.*
