# Breeze-manualen

**Läs på andra språk**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · Svenska (den här sidan) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze är en krypterad meddelandeapp som varken kräver telefonnummer eller registrering.
Innehållet i en konversation kan bara läsas av den som skickade den och den som tar emot den. Inte ens servern som transporterar den kan läsa den.
Alla funktioner är gratis, och det finns ingen reklam.

Den här manualen är en guide för dig som ska börja använda den.

---

## 1. Komma igång

### Hämta den

Välj den fil som passar din enhet på [nedladdningssidan](https://github.com/shizukutanaka/Breeze/releases/latest).

- Windows: filer vars namn slutar med `-win-x64.exe` (det finns även för ARM-enheter)
- Mac: filer vars namn slutar med `-mac.dmg`
- Linux: `.AppImage` (kan köras direkt) eller `.deb`
- Om du vill använda den i webbläsaren använder du den version du har placerat på din egen server (installationsanvisningarna finns i det separata dokumentet "Installationsguiden"). Standardinstallationen använder Cloudflare, så ett Cloudflare-konto krävs.

Varje fil levereras med en kontrollsumma (SHA256SUMS.txt). Om du är orolig kan du kontrollera att summan för den fil du laddade ner stämmer.

### Första inställningarna

1. Öppna appen.
2. Tryck på "Börja med ett slumpmässigt ID". Det är allt – du är redo. Ingen registrering, inget telefonnummer behövs.

- Om du anger "Ditt namn (visningsnamn)" i fältet ovanför knappen börjar du med det namnet. Du kan också trycka på knappen med fältet tomt. Du kan ändra visningsnamnet senare, i profilavsnittet i inställningarna.
- Det finns också ett sätt att skapa en identitet med ett namn och ett Breeze-ID som du väljer själv. I så fall utfärdas en återställningsfras och visas på skärmen. Återställningsfrasen är orden som låter dig ta tillbaka den identiteten på en annan enhet. Skriv ner den på papper eller någonstans säkert.
- Om du vill ta tillbaka en identitet som du har skapat tidigare öppnar du "Återställ ett befintligt konto", så visas återställningsmetoderna (återställ från en säkerhetskopia, återställ med en återställningsfras, återställ med konto + lösenfras).
- När skapandet är klart visas ett kort som vägleder dig att skydda din nyckel med en lösenfras (det försvinner inte efter en stund). Följ vägledningen och lägg till skyddet för en viktig identitet.

Då skapas en "nyckel" inuti din enhet. Den är din identitet i sig.
**Det finns ingen lista över konton på servern.** Din identitet finns bara inuti din enhet.
Detta blir viktigt i kapitlet om säkerhetskopiering (9).

### Om den tidigare "engångsidentiteten"

"Engångsidentiteten" — en identitet som inte kan återställas på något sätt — är borta. Med de nuvarande sätten att skapa en identitet kan varje identitet skyddas med en säkerhetskopia.

---

## 2. Ansluta till andra

Tryck på knappen "Lägg till vän" på kontaktskärmen, så visas tre val.

- **Lägg till en kontakt**: Ange den andra personens ID eller skanna en QR-kod.
- **Bjud in en vän**: Kopiera inbjudningslänken och skicka den med dina vanliga kontaktvägar (e-post osv.). När den andra personen öppnar länken och anger sitt namn kan ni prata direkt.
- **Skapa en grupp**: Ange bara ett gruppnamn för att skapa en (kapitel 4).

Ditt eget ID visas i sin fullständiga form när du öppnar din egen profil, och du kan kopiera det som det är. Lämna över det fullständiga ID:t, inte bara det korta ID:t.

Om den andra personen också har appen öppen kan ni ansluta direkt och prata.

---

## 3. Konversationer

- Skriv bara ett meddelande och skicka det. Du kan också skicka foton, klistermärken och platsinformation.
- Öppna "+" bredvid inmatningsfältet, så visas filbilagor, röstmeddelanden, röstinmatning, platsinformation, klistermärken, inställningen "inget svar behövs" och mer tillsammans.
- **Skicka filer**: Upp till 50 MB i konversationer en mot en. I grupper är det mindre, ungefär 50 KB.
- Farliga filformat, som körbara filer, blockeras automatiskt.
- Om den andra personen inte har appen öppen placeras meddelandet, fortfarande krypterat, i en "brevlåda" och levereras när de öppnar appen. Servern som transporterar brevlådan kan inte läsa innehållet. Brev som aldrig levereras raderas automatiskt efter **högst 7 dagar**.
- Konversationshistorik kan exporteras till en fil och importeras.

### Läsa skärmen

- **Sändningsstatus**: Du ser den på märket bredvid ett meddelande. ✓ betyder skickat, ett ✓ i en cirkel betyder att det har lagts i brevlådan, ✓✓ betyder att det nådde den andra personen, läst är ett blått märke och misslyckande är ett rött märke. De skiljs åt genom form såväl som färg.
- **Kontaktlistan**: Tiden för det senaste samtalet visas som tiden för i dag, "I går" för i går, månad/dag för i år och år/månad/dag för allt tidigare. Kontakter med meddelanden som du inte har läst har namn och tid framhävda.
- **Namn på kontakter**: Öppna "Kontaktinfo" (i högerklicksmenyn för en kontakt, eller konversationens meny "⋮") så kan du ange ett eget namn för den kontakten (ett smeknamn). Smeknamn lagras bara på den här enheten och skickas aldrig till kontakten eller reläservern. När du anger ett smeknamn visas också namnet som kontakten själv har ställt in bredvid det i en dämpad färg. Du kan stänga av det andra namnet med "Visa också namnet som varje kontakt själv har ställt in" i avsnittet "Integritet" i inställningarna.
- **Ditt eget kort**: Överst i listan finns ditt eget profilkort; tryck på det för att öppna din profil. Det rullar tillsammans med listan.
- **Nedre flikar på en telefon**: Vid telefonbredd visas fem flikar längst ner på skärmen: ”Chattar”, ”Samtal”, ”Kontakter”, ”Mitt kort” och ”Inställningar”. Vilka flikar som visas kan du välja en i taget under ”Nedre flikar” i inställningarna (Chattar visas alltid. Även om du döljer fliken Inställningar kan du fortfarande öppna inställningarna från kugghjulsknappen på skärmen).
- **Konversationens rubrik**: Från sökikonen kan du söka i konversationen. Från menyn "⋮" kan du kontrollera säkerhetsnumret, tysta aviseringar, fästa, skapa en omröstning och mer.

### Kommandon

Skriv `/` i inmatningsfältet, så visas kommandoförslag. Skriv `/help` för att se en lista över kommandon du kan använda (71 typer).
Vissa åtgärder, som inställningar och enhetslänkning, görs via kommandon.

---

## 4. Grupper

- En grupp kan ha upp till **1 000 personer**.
- Du skapar en grupp genom att bara ange ett gruppnamn under "Skapa en grupp" i "Lägg till vän" (du kan också skapa en med kommandot `/newgroup`). Inbjudningar sker via "Gruppinbjudningslänk". Den som får länken kan gå med genom att ange sitt namn.
- Filer kan också skickas i grupper, men gränsen är mindre, ungefär 50 KB. Röstmeddelanden kan ännu inte skickas i grupper.
- Om en medlem använder en gammal version av appen kan gruppen inte använda det nyare, säkrare läget (grupp v5), och en varning visas på skärmen. Det aktiveras när alla har den senaste versionen.

---

## 5. Samtal

- Du kan ha röst- och videosamtal en mot en. Det finns även gruppsamtal (upp till 8 personer).
- **Samtalsbekräftelsekod**: En bekräftelsekod visas på samtalsskärmen. Läs den högt med den andra personen och kontrollera att den stämmer på båda skärmarna. Om den inte stämmer kan någon avlyssna samtalet i smyg. Lägg på i så fall.
- Gruppsamtal kan ibland inte startas om inte allas appar är den senaste versionen.
- **Samtalshistorik**: Enskilda samtal lämnar en historik endast på den här enheten (den andra personen, om det var utgående / inkommande / missat, tiden och samtalets längd. Inget av det som sades sparas). Historiken skickas aldrig till en server eller till den andra personen. Upp till 200 poster sparas, och de äldsta tas bort först. Gruppsamtal visas inte i historiken.
- Öppna historiken på en telefon från fliken ”Samtal”. När det finns ett missat samtal som du ännu inte har sett visas ett siffermärke på fliken Samtal, och det försvinner när du öppnar historiken. Från en rad i historiken kan du öppna konversationen med den personen eller ringa tillbaka. Du kan radera hela historiken med en knapp på skärmen.
- **Samtalshistoriken ingår inte i en säkerhetskopia.** På en ny enhet börjar historiken tom. Om du inte vill att en historik sparas, stäng av ”Behåll en samtalshistorik på den här enheten” i avsnittet ”Integritet” i inställningarna, så stoppas själva inspelningen.

---

## 6. Flera enheter och konton

- För att använda samma identitet på flera enheter länkar du enheterna med kommandot `/link`.
- Du kan skapa flera konton och använda dem för olika ändamål (till exempel arbete och privat). Både antal enheter och konton är gratis och obegränsade.
- **Så här skapar du ett konto**: Tryck på knappen "+" bredvid kontoflikarna högst upp i kontaktlistan. Ange ett namn och välj en ikon-emoji, så skapas ett nytt konto och växlas till automatiskt.
- **Byta konton**: Kontoflikarna visas alltid högst upp i kontaktlistan. Tryck på en för att byta (på en dator kan du också byta med Ctrl+1–9). Tryck och håll på en flik för att byta namn på den, ändra dess ikon eller ta bort den.
- Kontakter och nycklar är separata för varje konto. Byt kontakter på nytt för varje konto.
- Språket väljs automatiskt bland 51 språk, inklusive engelska, anpassat till enhetens språk.

---

## 7. Inställningar för att vara säker

Inställningar öppnas som en egen skärm. Öppna dem på en telefon från fliken "Inställningar" längst ned på skärmen; på en dator från kugghjulsknappen på skärmen (du kan också öppna dem med kommandot `/settings`). Använd tillbakaåtgärden för att återgå till skärmen du var på.

- **Automatiskt lås**: Det finns en inställning som låser automatiskt när du byter flik.
- **Nyckelns lösenfras**: Du kan skydda nyckeln inuti din enhet genom att slå in den i en lösenfras. Du ombeds ange den när du öppnar appen.
- **Visa också namnet som varje kontakt själv har ställt in**: I avsnittet "Integritet". För en kontakt som du har gett ett smeknamn kan du välja om deras eget namn visas bredvid det (kapitel 3).
- **Blockera**: Du kan blockera besvärliga personer. Meddelanden från en blockerad person når dig inte.
- **Om en samtalshistorik ska behållas**: Med ”Behåll en samtalshistorik på den här enheten” i avsnittet ”Integritet” kan du stoppa inspelningen av samtalshistorik (kapitel 5).
- **De nedre flikarnas synlighet**: I avsnittet ”Nedre flikar” kan du visa eller dölja telefonens nedre flikar (Samtal / Kontakter / Mitt kort / Inställningar) en i taget. Chattar visas alltid.

---

## 8. Batteri och nödsituationer (energilägen)

I inställningen "Energiläge" kan du välja hur batteriet används.

- **Automatiskt (batterinivå)**: Växlar automatiskt efter hur mycket batteri som finns kvar.
- **Normalt**: Som vanligt.
- **Energisparläge**: Sprider ut leveranskontroller till högst en gång var 60:e sekund och stoppar närvarosignalen.
- **Nödläge (för katastrofer)**: Sprider ut leveranskontroller till högst en gång var 10:e minut. Använd det vid en katastrof eller annan tid då du inte kan ladda.

Det som drar batteri är inte mängden kommunikation utan antalet gånger radion vaknar. Därför sprids inte den sändande sidan ut; bara den lyssnande sidan. Sändning går fortfarande ut direkt, som alltid. När du börjar ladda flyttas det automatiskt ett steg tillbaka mot den lättare sidan.

På enheter som inte kan läsa batterinivån automatiskt (som en iPhone-webbläsare) beter sig "Automatiskt" som Normalt, och ett manuellt val fungerar som valt.

---

## 9. Säkerhetskopiering och återställning (det viktigaste kapitlet)

Din Breeze-identitet är bara nyckeln inuti din enhet. Det finns ingen lista över konton på servern, och skaparen har inte din nyckel heller.
**Om du tappar din enhet tappar du din identitet.** Skapa alltid en säkerhetskopia för en viktig identitet.

Säkerhetskopiering och återställning görs från avsnittet "Säkerhetskopiering & återställning" i inställningarna (knapparna är "Skapa säkerhetskopia", "Återställ säkerhetskopia" och "Återställ från fil"). Första gången du lägger till en kontakt visas ett kort som uppmanar dig att göra en säkerhetskopia, bara en gång.

### Automatisk säkerhetskopiering

Inställningen "Automatisk säkerhetskopiering" är på från början. När dina data ändras skickas en krypterad säkerhetskopia automatiskt till den reläserver du själv driver.

- Den skickar inte vid varje ändring: den väntar 30 sekunder efter den sista ändringen och skickar allt tillsammans. Försök görs med minst 15 minuters mellanrum.
- Medan du är offline skickas ingenting; ändringarna hålls kvar och skickas när anslutningen kommer tillbaka och när du öppnar appen.
- För automatisk sändning behöver du ange lösenfrasen för säkerhetskopian en gång på den enheten (när det behövs visas en knapp "Ange lösenfras" i inställningsavsnittet). **Lösenfrasen lagras inte.** Den koms bara ihåg medan appen är öppen och är borta när du stänger den. För en identitet med enkel återställning fungerar sändningen som den är direkt efter att du har angett lösenfrasen vid registrering eller uppdatering.
- Om reläservern inte stöder lagring av säkerhetskopior körs inte den automatiska säkerhetskopieringen. Det visas i inställningsavsnittet.
- Tillståndet (när den senaste lyckade sändningen var, om ändringar väntar, om en sändning misslyckades) visas i inställningsavsnittet.

### Skapa en säkerhetskopia (manuellt)

1. Välj "Skapa säkerhetskopia" i "Säkerhetskopiering & återställning" i inställningarna.
2. Ställ in en lösenfras för säkerhetskopian (minst 6 tecken).
3. Välj var den ska sparas.
   - **Spara i en fil**: Behåll säkerhetskopian hos dig själv (rekommenderas).
   - **Spara på reläservern**: Kan bara användas om operatören för det reläet har aktiverat det. Det kan inte användas på standardreläet. Det finns en lagringsfrist, så hämta tillbaka den innan fristen går ut.

Säkerhetskopians innehåll är krypterat. Servern där den sparas hanterar bara krypterad text.

### Så här återställer du

På en ny enhet återställer du med säkerhetskopian (eller säkerhetskopian på reläservern) och den lösenfras du ställde in.

Om du just har tagit tillbaka din identitet med en återställningsfras, och en säkerhetskopia av den identiteten finns på reläservern, hittas den automatiskt och du tillfrågas med "Säkerhetskopia hittad". Om du återställer den ersätts data på den enheten med säkerhetskopians innehåll.

### Flytta till en ny enhet

Tryck på knappen "Flytta till en ny enhet" i avsnittet "Säkerhetskopiering & återställning" i inställningarna, så visas stegen.

1. På din nuvarande enhet, se till att det finns en säkerhetskopia på reläservern (automatisk säkerhetskopiering, eller "Skapa säkerhetskopia").
2. På den nya enheten väljer du en återställningsmetod på den första skärmen och anger din återställningsfras (eller ditt kontonamn och lösenfras).
3. När din identitet är tillbaka hittas säkerhetskopian på servern automatiskt och en återställning erbjuds.

Inga kablar eller filöverlämningar behövs.

### Observera

- **Om du glömmer lösenfrasen går det inte att återställa.** Inte ens skaparen kan fixa det. Skriv ner lösenfrasen någon annanstans.
- Att ange lösenfrasen för automatisk säkerhetskopiering behövs på varje enhet. På en ny enhet anger du den en gång till.
- Gör om en manuell säkerhetskopia när dina identiteter blir fler eller när du byter enhet.
- Samtalshistoriken ingår inte i en säkerhetskopia. När du byter enhet följer samtalshistoriken inte med till den nya enheten.

---

## 10. Brevlådan och hur vi tänker om kostnader

- Brev till en person som är offline placeras, krypterade, i reläserverns "brevlåda" (högst 7 dagar).
- Reläet har gränser för att förhindra missbruk (hur mycket som kan lämnas och hur ofta). När en gräns nås kan du inte lämna nya brev under den perioden, men **brev som redan har levererats försvinner aldrig**. Skärmen visar anledningen och hur länge du ska vänta.
- Om du har placerat reläet på din egen server bestämmer du gränserna själv.

Omfattningen av de register som blir kvar på serversidan (allt raderas automatiskt och innehållet kan inte läsas):

| Sak | Hur länge det blir kvar |
|---|---|
| Olevererade brev | Högst 7 dagar |
| Anslutningssignaler | 5 minuter |
| Adress- och enhetsregister | 90 dagar |
| Gruppinformation och aviseringar | 30 dagar |

---

## 11. Så här uppdaterar du (skrivbordsversionen)

1. När det finns en ny version visas ett meddelande på skärmen.
2. Tryck på "Ladda ner" för att hämta den nya versionen (den installeras inte automatiskt).
3. När nedladdningen är klar trycker du på "Installera" och startar om.

Om något går fel under uppdateringen (till exempel att filkontrollen inte stämmer) **stoppar uppdateringen och visar anledningen på skärmen**. Det går inte att gå tillbaka till en gammal version.

---

## 12. När något går fel

| Symptom | Vad du ska kontrollera |
|---|---|
| Kan inte skicka meddelanden | Kontrollera att enhetens klocka inte är fel. Om tiden är fel misslyckas sändningen. |
| Når inte den andra personen | Det väntar i brevlådan tills den andra personen öppnar appen (högst 7 dagar). |
| Kan inte skicka filer | Kontrollera att du inte överskrider storleksgränsen (50 MB en mot en, ungefär 50 KB i grupper) och att filen inte blockeras som ett farligt format. |
| Samtalets bekräftelsekod stämmer inte | Lägg på och ring igen. Fortsätt inte medan den inte stämmer. |
| Glömt lösenfrasen | Återställning är omöjlig. Skapa en ny identitet och meddela dina kontakter igen. |
| Tappat enheten | Om du har en säkerhetskopia kan du återställa på en ny enhet. Annars blir det en ny identitet. |

Rapportera buggar på [issuesidan](https://github.com/shizukutanaka/Breeze/issues), tack.

---

## 13. Breezes löften

- Ingen reklam. Varken i appen eller någon annanstans.
- Ingen spårning. Ingen analys av användning, inga reklammekanismer, ingen försäljning av data – över huvud taget.
- Skaparen innehar inga användardata. Det finns ingen lista över konton på serversidan över huvud taget.
- Konversationer krypteras mellan enheterna. Servern hanterar bara förseglade kuvert som den inte kan läsa.

En detaljerad jämförelse med andra meddelandeappar finns på "jämförelsesidan" i repositoriet, inklusive punkter där Breeze förlorar (antal användare, att den inte har genomgått någon extern granskning osv.).

---

*Den här manualen beskriver läget för Breeze per 2026-11-25.*
