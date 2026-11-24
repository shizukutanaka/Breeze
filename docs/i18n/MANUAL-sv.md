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
- Om du vill använda den i webbläsaren använder du den version du har placerat på din egen server (installationsanvisningarna finns i det separata dokumentet "Installationsguiden")

Varje fil levereras med en kontrollsumma (SHA256SUMS.txt). Om du är orolig kan du kontrollera att summan för den fil du laddade ner stämmer.

> **Om testsidan**: Testsidan som var offentlig (breeze.pages.dev) är för närvarande stoppad (du får 404 om du öppnar den). Använd appversionen tills den är återställd. En Breeze som du har placerat på din egen server påverkas inte av stoppet.

### Första inställningarna

1. Öppna appen.
2. Ange ditt namn. Det är allt – du är redo. Ingen registrering, inget telefonnummer behövs.

Då skapas en "nyckel" inuti din enhet. Den är din identitet i sig.
**Det finns ingen lista över konton på servern.** Din identitet finns bara inuti din enhet.
Detta blir viktigt i kapitlet om säkerhetskopiering (8).

### Om "engångsidentitet"

Om du väljer "engångsidentitet" vid skapandet får du en identitet som inte kan återställas på något sätt.
Om du tappar den enheten, återställer den eller raderar webbläsarens data försvinner identiteten för alltid.
Det visas också på skärmen. Välj det inte för en identitet du tänker använda länge.

---

## 2. Ansluta till andra

Det finns tre sätt att ansluta till den person du vill prata med.

- **Ge ditt ID**: Berätta ditt ID för den andra personen och låt dem ange det.
- **QR-kod**: Visa en QR-kod för inbjudan och låt den andra personen skanna den.
- **Inbjudningslänk**: Kopiera ett inbjudningsmeddelande från "Bjud in en vän" och skicka det med dina vanliga kontaktvägar (e-post osv.). När den andra personen öppnar länken och anger sitt namn kan ni prata direkt.

Om den andra personen också har appen öppen kan ni ansluta direkt och prata.

---

## 3. Konversationer

- Skriv bara ett meddelande och skicka det. Du kan också skicka foton, klistermärken och platsinformation.
- **Skicka filer**: Upp till 50 MB i konversationer en mot en. I grupper är det mindre, ungefär 50 KB.
- Farliga filformat, som körbara filer, blockeras automatiskt.
- Om den andra personen inte har appen öppen placeras meddelandet, fortfarande krypterat, i en "brevlåda" och levereras när de öppnar appen. Servern som transporterar brevlådan kan inte läsa innehållet. Brev som aldrig levereras raderas automatiskt efter **högst 7 dagar**.
- Konversationshistorik kan exporteras till en fil och importeras.

### Kommandon

Om du skriver `/help` i inmatningsfältet visas en lista över kommandon du kan använda (mer än 60 typer).
Vissa åtgärder, som inställningar och enhetslänkning, görs via kommandon.

---

## 4. Grupper

- En grupp kan ha upp till **1 000 personer**.
- Du skapar en genom att bara ange ett gruppnamn. Inbjudningar sker via "Gruppinbjudningslänk". Den som får länken kan gå med genom att ange sitt namn.
- Filer kan också skickas i grupper, men gränsen är mindre, ungefär 50 KB. Röstmeddelanden kan ännu inte skickas i grupper.
- Om en medlem använder en gammal version av appen kan gruppen inte använda det nyare, säkrare läget (grupp v5), och en varning visas på skärmen. Det aktiveras när alla har den senaste versionen.

---

## 5. Samtal

- Du kan ha röst- och videosamtal en mot en. Det finns även gruppsamtal.
- **Samtalsbekräftelsekod**: En bekräftelsekod visas på samtalsskärmen. Läs den högt med den andra personen och kontrollera att den stämmer på båda skärmarna. Om den inte stämmer kan någon avlyssna samtalet i smyg. Lägg på i så fall.
- Gruppsamtal kan ibland inte startas om inte allas appar är den senaste versionen.

---

## 6. Flera enheter och konton

- För att använda samma identitet på flera enheter länkar du enheterna med kommandot `/link`.
- Du kan skapa flera konton och använda dem för olika ändamål (till exempel arbete och privat). Både antal enheter och konton är gratis och obegränsade.
- Språket väljs automatiskt bland 8: engelska, japanska, koreanska, kinesiska (Taiwan), spanska, thailändska, indonesiska och portugisiska (Brasilien).

---

## 7. Inställningar för att vara säker

- **Automatiskt lås**: Det finns en inställning som låser automatiskt när du byter flik.
- **Nyckelns lösenfras**: Du kan skydda nyckeln inuti din enhet genom att slå in den i en lösenfras. Du ombeds ange den när du öppnar appen.
- **Blockera**: Du kan blockera besvärliga personer. Meddelanden från en blockerad person når dig inte.

---

## 8. Säkerhetskopiering och återställning (det viktigaste kapitlet)

Din Breeze-identitet är bara nyckeln inuti din enhet. Det finns ingen lista över konton på servern, och skaparen har inte din nyckel heller.
**Om du tappar din enhet tappar du din identitet.** Skapa alltid en säkerhetskopia för en viktig identitet.

### Skapa en säkerhetskopia

1. Välj "Skapa säkerhetskopia".
2. Ställ in en lösenfras för säkerhetskopian (minst 6 tecken).
3. Välj var den ska sparas.
   - **Spara i en fil**: Behåll säkerhetskopian hos dig själv (rekommenderas).
   - **Spara på reläservern**: Kan bara användas om operatören för det reläet har aktiverat det. Det kan inte användas på standardreläet. Det finns en lagringsfrist, så hämta tillbaka den innan fristen går ut.

Säkerhetskopians innehåll är krypterat. Servern där den sparas hanterar bara krypterad text.

### Så här återställer du

På en ny enhet återställer du med säkerhetskopian (eller säkerhetskopian på reläservern) och den lösenfras du ställde in.

### Observera

- **Om du glömmer lösenfrasen går det inte att återställa.** Inte ens skaparen kan fixa det. Skriv ner lösenfrasen någon annanstans.
- **En engångsidentitet kan inte återställas, varken via säkerhetskopia eller återställning.**
- Gör om säkerhetskopian när du lägger till identiteter eller byter enhet.

---

## 9. Brevlådan och hur vi tänker om kostnader

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

## 10. Så här uppdaterar du (skrivbordsversionen)

1. När det finns en ny version visas ett meddelande på skärmen.
2. Tryck på "Ladda ner" för att hämta den nya versionen (den installeras inte automatiskt).
3. När nedladdningen är klar trycker du på "Installera" och startar om.

Om något går fel under uppdateringen (till exempel att filkontrollen inte stämmer) **stoppar uppdateringen och visar anledningen på skärmen**. Det går inte att gå tillbaka till en gammal version.

---

## 11. När något går fel

| Symptom | Vad du ska kontrollera |
|---|---|
| Kan inte skicka meddelanden | Kontrollera att enhetens klocka inte är fel. Om tiden är fel misslyckas sändningen. |
| Når inte den andra personen | Det väntar i brevlådan tills den andra personen öppnar appen (högst 7 dagar). |
| Kan inte skicka filer | Kontrollera att du inte överskrider storleksgränsen (50 MB en mot en, ungefär 50 KB i grupper) och att filen inte blockeras som ett farligt format. |
| Samtalets bekräftelsekod stämmer inte | Lägg på och ring igen. Fortsätt inte medan den inte stämmer. |
| Glömt lösenfrasen | Återställning är omöjlig. Skapa en ny identitet och meddela dina kontakter igen. |
| Tappat enheten | Om du har en säkerhetskopia kan du återställa på en ny enhet. Annars blir det en ny identitet. |
| Testsidan öppnas inte (404) | Den är för närvarande stoppad. Använd appversionen. |

Rapportera buggar på [issuesidan](https://github.com/shizukutanaka/Breeze/issues), tack.

---

## 12. Breezes löften

- Ingen reklam. Varken i appen eller någon annanstans.
- Ingen spårning. Ingen analys av användning, inga reklammekanismer, ingen försäljning av data – över huvud taget.
- Skaparen innehar inga användardata. Det finns ingen lista över konton på serversidan över huvud taget.
- Konversationer krypteras mellan enheterna. Servern hanterar bara förseglade kuvert som den inte kan läsa.

En detaljerad jämförelse med andra meddelandeappar finns på "jämförelsesidan" i repositoriet, inklusive punkter där Breeze förlorar (antal användare, att den inte har genomgått någon extern granskning osv.).

---

*Den här manualen beskriver läget vid Breeze v3.8.0.*
