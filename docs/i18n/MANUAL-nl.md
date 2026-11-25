# Handleiding voor Breeze

**In een andere taal lezen**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · Nederlands (deze pagina) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze is een versleutelde messenger waarvoor je geen telefoonnummer en geen registratie nodig hebt.
De inhoud van gesprekken kan alleen door de verzender en de ontvanger worden gelezen. Zelfs de server die ze vervoert, kan ze niet lezen.
Alle functies zijn gratis en er zijn geen advertenties.

Deze handleiding is een gids voor wie begint.

---

## 1. Aan de slag

### Verkrijgen

Kies op de [downloadpagina](https://github.com/shizukutanaka/Breeze/releases/latest) het bestand dat bij je machine past.

- Windows: het bestand waarvan de naam eindigt op `-win-x64.exe` (er zijn er ook voor ARM-machines)
- Mac: het bestand waarvan de naam eindigt op `-mac.dmg`
- Linux: `.AppImage` (kan zo worden uitgevoerd) of `.deb`
- Om het in de browser te gebruiken, gebruik je de versie die op je eigen server staat (de installatieprocedure staat in een apart document, de “installatiehandleiding”)

Bij elk bestand horen controlewaarden (SHA256SUMS.txt). Wie wil, kan controleren of de waarden van het gedownloade bestand overeenkomen.

> **Over de voorbeeldpagina**: er is een voorbeeld om te controleren hoe het werkt (https://breeze-469.pages.dev/). Daar staat dezelfde software, maar het voorbeeld kan zonder aankondiging veranderen of stoppen. Gebruik voor echt gebruik een versie die op je eigen server staat. Een versie op je eigen server ondervindt geen hinder als het voorbeeld stopt.

### Eerste instelling

1. Open de app.
2. Voer je naam in en druk op “Account aanmaken”. Daarmee is de voorbereiding klaar. Geen registratie en geen telefoonnummer nodig.

- Als je een eerder gemaakte identiteit wilt terughalen, open dan “Een bestaand account herstellen” en de herstelmethoden (een back-upbestand, een herstelzin enzovoort) verschijnen.
- Als het aanmaken klaar is, verschijnt er een kaart die je begeleidt om je sleutel met een wachtwoordzin te beschermen (deze verdwijnt niet na een tijdje). Volg voor een belangrijke identiteit de begeleiding en voeg de bescherming toe.

Op dat moment wordt er in je apparaat een “sleutel” gemaakt. Die is je identiteit zelf.
**Er is geen lijst met accounts op de server.** Je identiteit bevindt zich alleen in je apparaat.
Dit punt wordt belangrijk in het hoofdstuk over back-up (9).

### Over de “wegwerpidentiteit”

Als je bij het aanmaken “wegwerpidentiteit” kiest, wordt het een identiteit zonder enig middel tot herstel.
Als je dat apparaat verliest, het terugzet naar fabrieksinstellingen of de browsergegevens wist, komt die identiteit nooit meer terug.
Dat wordt ook op het scherm weergegeven. Kies dit niet voor een identiteit die je lang wilt gebruiken.

---

## 2. Verbinding maken met iemand

Druk op de knop “Vriend toevoegen” op het contactenscherm en er verschijnen drie keuzes.

- **Een contact toevoegen**: voer de ID van de andere persoon in, of scan een QR-code.
- **Een vriend uitnodigen**: kopieer de uitnodigingslink en stuur hem via je gebruikelijke contactmiddel (e-mail enz.). Als de andere persoon de link opent en een naam invoert, kunnen jullie meteen praten.
- **Een groep maken**: voer alleen een groepsnaam in om er een te maken (hoofdstuk 4).

Je eigen ID wordt in volledige vorm weergegeven als je je eigen profiel opent, en je kunt hem zo kopiëren. Geef de volledige ID door, niet alleen de korte ID.

Als de andere persoon de app ook open heeft, maak je rechtstreeks verbinding en kun je praten.

---

## 3. Gesprekken

- Je hoeft alleen een bericht te typen en te verzenden. Je kunt ook foto's, stickers en locatie sturen.
- Open de “+” naast het invoerveld en bestandsbijlagen, spraakberichten, spraakinvoer, locatiegegevens, stickers, de instelling “geen antwoord nodig” en meer verschijnen samen.
- **Bestanden verzenden**: in een-op-eengesprekken tot 50 MB. In groepen is de limiet kleiner, ongeveer 50 KB.
- Bestanden in gevaarlijke formaten, zoals uitvoerbare bestanden, worden automatisch geblokkeerd.
- Als de andere persoon de app niet open heeft, wordt het bericht versleuteld in een “wachtbak” gelegd en bezorgd zodra die de app opent. De server die de wachtbak vervoert, kan de inhoud niet lezen. Brieven die niet worden bezorgd, worden automatisch verwijderd na **maximaal 7 dagen**.
- De gespreksgeschiedenis kan naar een bestand worden geëxporteerd en geïmporteerd.

### Het scherm lezen

- **Verzendstatus**: je ziet hem aan het teken naast een bericht. ✓ betekent verzonden, een ✓ in een cirkel betekent dat het in de wachtbak is gedeponeerd, ✓✓ betekent dat het de andere persoon heeft bereikt, gelezen is een blauw teken en mislukt is een rood teken. Ze worden zowel door vorm als door kleur onderscheiden.
- **De contactenlijst**: de tijd van het laatste gesprek wordt weergegeven als de tijd voor vandaag, “Gisteren” voor gisteren, maand/dag voor dit jaar en jaar/maand/dag voor alles daarvoor. Contacten met ongelezen berichten hebben hun naam en tijd benadrukt.
- **Je eigen kaart**: bovenaan de lijst staat je eigen profielkaart; druk erop om je profiel te openen. Deze scrollt mee met de lijst.
- **Onderste tabbladen op een telefoon**: bij telefoonbreedte verschijnen onderaan het scherm de tabbladen “Contacten” en “Instellingen”.
- **De gespreksbovenkant**: via het zoekpictogram kun je binnen het gesprek zoeken. Via het menu “⋮” kun je het veiligheidsnummer controleren, meldingen dempen, vastzetten, een peiling maken en meer.

### Commando's

Typ `/` in het invoerveld en er verschijnen commandosuggesties. Typ `/help` om de lijst met beschikbare commando's te zien (71 soorten).
Sommige handelingen, zoals instellingen en het koppelen van apparaten, doe je met commando's.

---

## 4. Groepen

- Groepen kunnen tot **1.000 mensen** bevatten.
- Om een groep te maken, voer je alleen een groepsnaam in bij “Een groep maken” in “Vriend toevoegen” (je kunt er ook een maken met het commando `/newgroup`). Uitnodigen gaat via de “groepsuitnodigingslink”. Wie de link ontvangt, kan deelnemen door een naam in te voeren.
- Ook in groepen kun je bestanden sturen, maar de limiet is kleiner, ongeveer 50 KB. Spraakberichten kunnen in groepen nog niet worden verstuurd.
- Als er leden zijn die een oude versie van de app gebruiken, kan in die groep de nieuwe, veiligere methode (groep v5) niet worden gebruikt en verschijnt er een waarschuwing op het scherm. Die wordt actief zodra iedereen op de nieuwste versie zit.

---

## 5. Gesprekken (bellen)

- Je kunt een-op-een spraak- en videogesprekken voeren. Er zijn ook groepsgesprekken (tot 8 mensen).
- **Bevestigingscode voor gesprekken**: op het gespreksscherm wordt een bevestigingscode weergegeven. Lees hem aan elkaar voor en controleer of hij op beide schermen overeenkomt. Als hij niet overeenkomt, kan het zijn dat iemand onderweg meeluistert. Beëindig in dat geval het gesprek.
- Groepsgesprekken kunnen soms niet beginnen als niet ieders app op de nieuwste versie zit.

---

## 6. Meerdere apparaten en accounts

- Om dezelfde identiteit op meerdere apparaten te gebruiken, koppel je de apparaten met het commando `/link`.
- Je kunt meerdere accounts aanmaken en apart gebruiken (bijv. werk en privé). Zowel het aantal apparaten als het aantal accounts is gratis en onbeperkt.
- **Een account aanmaken**: druk op de knop “+” naast de accounttabbladen helemaal bovenaan de contactenlijst. Voer een naam in en kies een pictogram-emoji, en er wordt een nieuw account aangemaakt waar automatisch naartoe wordt overgeschakeld.
- **Van account wisselen**: de accounttabbladen worden altijd helemaal bovenaan de contactenlijst weergegeven. Druk op een tabblad om te wisselen (op een computer kun je ook wisselen met Ctrl+1–9). Druk lang op een tabblad om het te hernoemen, het pictogram te wijzigen of het te verwijderen.
- De taal wordt automatisch gekozen uit 51 talen, waaronder Engels, afgestemd op de taal van je apparaat.

---

## 7. Instellingen om veilig te blijven

Instellingen openen als een eigen scherm. Open ze op een telefoon via het tabblad “Instellingen” onderaan het scherm; op een computer via de tandwielknop op het scherm (je kunt ze ook openen met het commando `/settings`). Gebruik de terugactie om terug te keren naar het scherm waar je was.

- **Automatisch vergrendelen**: er is een instelling om automatisch te vergrendelen bij het wisselen van tabblad.
- **Wachtwoordzin voor de sleutel**: je kunt de sleutel in je apparaat beschermen met een wachtwoordzin. Bij het openen van de app wordt erom gevraagd.
- **Blokkeren**: je kunt vervelende personen blokkeren. Berichten van geblokkeerde personen komen niet aan.

---

## 8. Batterij en noodgevallen (energiemodi)

In de instelling “Energiemodus” kun je kiezen hoe de batterij wordt gebruikt.

- **Automatisch (batterijniveau)**: schakelt automatisch op basis van hoeveel batterij er nog over is.
- **Normaal**: zoals gewoonlijk.
- **Energiebesparing**: spreidt bezorgcontroles uit tot hooguit één keer per 60 seconden en stopt het aanwezigheidssignaal.
- **Noodgeval (voor rampen)**: spreidt bezorgcontroles uit tot hooguit één keer per 10 minuten. Gebruik dit bij een ramp of een andere situatie waarin je niet kunt opladen.

Wat de batterij leegtrekt, is niet de hoeveelheid communicatie, maar het aantal keren dat de radio wakker wordt. Daarom wordt de verzendende kant niet uitgespreid; alleen de luisterende kant. Verzenden gaat nog steeds meteen, zoals altijd. Als je begint met opladen, schuift het automatisch één stap terug naar de lichtere kant.

Op apparaten die het batterijniveau niet automatisch kunnen lezen (zoals een iPhone-browser), gedraagt “Automatisch” zich als Normaal, en een handmatige keuze werkt zoals gekozen.

---

## 9. Back-up en herstel (het belangrijkste hoofdstuk)

De identiteit van Breeze is alleen de sleutel in je apparaat. Er is geen lijst met accounts op de server, en ook de maker heeft jouw sleutel niet.
**Als je je apparaat verliest, verlies je ook je identiteit.** Maak voor belangrijke identiteiten altijd een back-up.

Back-up en herstel doe je vanuit de sectie “Back-up en herstel” van de instellingen (er zijn drie knoppen: “Back-up naar de cloud”, “Herstellen” en “Herstellen uit een bestand”). De eerste keer dat je een contact toevoegt, verschijnt er één keer een kaart die je aanspoort een back-up te maken.

### Een back-up maken

1. Kies in “Back-up en herstel” in de instellingen voor het maken van een back-up.
2. Stel een wachtwoordzin voor de back-up in (6 tekens of meer).
3. Kies waar je hem opslaat.
   - **Opslaan in een bestand**: bewaar het back-upbestand bij jezelf (aanbevolen).
   - **Opslaan op de relayserver**: alleen te gebruiken als de beheerder van die relay het heeft ingeschakeld. Op de standaardrelay kan het niet worden gebruikt. Er is een bewaartermijn; haal hem binnen die termijn terug.

De inhoud van de back-up is versleuteld. De server waar hij wordt bewaard, heeft alleen te maken met de cijfertekst.

### Herstellen

Herstel op een nieuw apparaat met het back-upbestand (of de back-up op de relayserver) en de wachtwoordzin die je hebt ingesteld.

### Let op

- **Als je de wachtwoordzin vergeet, is herstel niet mogelijk.** Ook de maker kan dat niet herstellen. Schrijf de wachtwoordzin ergens anders op.
- **Wegwerpidentiteiten komen niet terug, ook niet via back-up of herstel.**
- Maak de back-up opnieuw wanneer je identiteiten toevoegt of van apparaat wisselt.

---

## 10. De wachtbak en het idee achter de kosten

- Brieven voor wanneer de andere persoon offline is, worden versleuteld in de “wachtbak” van de relayserver gelegd (maximaal 7 dagen).
- De relay heeft limieten om misbruik te voorkomen (hoeveelheid en frequentie van wat er kan worden gedeponeerd). Als de limiet wordt bereikt, kun je in die periode geen nieuwe brieven deponeren, maar **reeds bezorgde brieven verdwijnen nooit**. Op het scherm worden de reden en de wachttijd weergegeven.
- De limieten kun je zelf bepalen als je het op je eigen server zet.

De reikwijdte van de gegevens die op de server achterblijven (alles wordt automatisch verwijderd en de inhoud kan niet worden gelezen):

| Item | Bewaartermijn |
|---|---|
| Niet-bezorgde brieven | Maximaal 7 dagen |
| Verbindingssignalen | 5 minuten |
| Adres- en apparaatgegevens | 90 dagen |
| Groepsinformatie en meldingsabonnementen | 30 dagen |

---

## 11. Bijwerken (desktopversie)

1. Als er een nieuwe versie is, verschijnt er een melding op het scherm.
2. Als je op “Downloaden” drukt, haalt hij de nieuwe versie op (installeert niet automatisch).
3. Als het downloaden klaar is, druk je op “Installeren” en start je opnieuw op.

Als er tijdens het bijwerken iets misgaat (de controlewaarden komen niet overeen, enz.), **stopt het bijwerken en wordt de reden op het scherm weergegeven**. Teruggaan naar een oude versie kan niet.

---

## 12. Als er iets misgaat

| Symptoom | Wat je controleert |
|---|---|
| Kan geen berichten verzenden | Controleer of de tijd op je apparaat niet afwijkt. Als de tijd afwijkt, mislukt het verzenden. |
| Komt niet aan bij de andere persoon | Tot de andere persoon de app opent, wacht het bericht in de wachtbak (maximaal 7 dagen). |
| Kan geen bestanden verzenden | Controleer of je de groottelimiet niet hebt overschreden (50 MB een-op-een, ongeveer 50 KB in groepen) en of het bestand niet als gevaarlijk formaat is geblokkeerd. |
| De bevestigingscode van het gesprek komt niet overeen | Beëindig het gesprek en bel opnieuw. Ga niet verder als hij niet overeenkomt. |
| Wachtwoordzin vergeten | Herstel is niet mogelijk. Maak een nieuwe identiteit en laat het je contacten opnieuw weten. |
| Apparaat kwijt | Als je een back-up hebt, kun je op een nieuw apparaat herstellen. Zo niet, dan wordt het een nieuwe identiteit. |
| De voorbeeldpagina opent niet | Het voorbeeld kan zonder aankondiging stoppen. Gebruik een versie die op je eigen server staat. |

Meldingen van problemen graag via de [Issue-pagina](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. De beloften van Breeze

- We tonen geen advertenties. Niet in de app, nergens.
- We volgen je niet. Geen gebruiksanalyse, geen advertentiemechanismen, geen verkoop van gegevens.
- De maker bewaart geen gegevens van gebruikers. Aan de serverkant bestaat er überhaupt geen lijst met accounts.
- Gesprekken worden tussen apparaten versleuteld. De server heeft alleen te maken met enveloppen die hij niet kan lezen.

De gedetailleerde vergelijking met andere messengers staat op de “vergelijkingspagina” van de repository, inclusief de punten waarop Breeze verliest (het aantal gebruikers, geen externe audit, enz.).

---

*Deze handleiding weerspiegelt de stand van Breeze per 2026-11-25.*
