# Breeze kézikönyv

**Más nyelven olvasás**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · Magyar (ez az oldal) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


A Breeze egy titkosított üzenetküldő, amelyhez sem telefonszám, sem regisztráció nem kell.
A beszélgetések tartalmát csak a küldő és a fogadó olvashatja. Még az útközben továbbító szerver sem.
Minden funkció ingyenes, és nincsenek hirdetések.

Ez a kézikönyv a kezdő felhasználóknak szóló útmutató.

---

## 1. Kezdés

### Beszerzés

A [letöltési oldalról](https://github.com/shizukutanaka/Breeze/releases/latest) válassza ki a gépének megfelelőt.

- Windows: a neve `-win-x64.exe` végződésű (ARM gépekhez való is van)
- Mac: a neve `-mac.dmg` végződésű
- Linux: `.AppImage` (azonnal futtatható) vagy `.deb`
- Böngészőben való használathoz a saját szerverére telepített példányt használja (a telepítés módját a külön „telepítési útmutató” írja le)

Minden fájlhoz tartozik egy ellenőrző szám (SHA256SUMS.txt). Aki aggódik, ellenőrizheti, hogy a letöltött fájl száma egyezik-e.

> **A mintáról**: A működés kipróbálására szolgáló minta (https://breeze-469.pages.dev/) rendelkezésre áll. Az ott lévő ugyanaz a szoftver, de a minta előzetes értesítés nélkül megváltozhat vagy leállhat. Valódi használatra a saját szerverére telepített példányt használja. A saját szerverén lévő példányt a minta leállása nem érinti.

### Első beállítás

1. Nyissa meg az alkalmazást.
2. Adja meg a nevét, és nyomja meg a „Fiók létrehozása” gombot. Ezzel kész is a beállítás. Sem regisztráció, sem telefonszám nem kell.

- Ha egy korábban létrehozott személyazonosságot szeretne visszahozni, nyissa meg a „Meglévő fiók visszaállítása” lehetőséget, és megjelennek a helyreállítási módok (biztonsági mentés fájlja, helyreállító jelmondat stb.).
- Amikor a létrehozás befejeződik, megjelenik egy kártya, amely útmutatást ad a kulcs jelmondattal való védelméhez (nem tűnik el egy idő után). Fontos személyazonosság esetén kövesse az útmutatást, és adja hozzá a védelmet.

Ekkor az eszközön belül létrejön egy „kulcs”. Ez maga az Ön személyazonossága.
**A fiókok listája nincs meg a szerveren.** A személyazonosság csak az Ön eszközén belül létezik.
Ez a pont lesz fontos a biztonsági mentésről szóló fejezetben (9).

### Az „eldobható személyazonosságról”

Ha a létrehozáskor az „eldobható személyazonosságot” választja, olyan személyazonosság jön létre, amelynek semmilyen helyreállítási módja nincs.
Ha elveszíti azt az eszközt, visszaállítja a gyári állapotot, vagy törli a böngésző adatait, az a személyazonosság soha többé nem állítható vissza.
Ez a képernyőn is megjelenik. Hosszú távon használt személyazonossághoz ne ezt válassza.

---

## 2. Kapcsolódás a másik félhez

Nyomja meg a névjegyek képernyőjén az „Ismerős hozzáadása” gombot, és három választási lehetőség jelenik meg.

- **Névjegy hozzáadása**: Adja meg a másik fél azonosítóját, vagy olvasson be egy QR-kódot.
- **Ismerős meghívása**: Másolja ki a meghívó hivatkozást, és küldje el a szokásos elérhetőségén (például e-mailben). Ha a másik fél megnyitja a hivatkozást és megadja a nevét, máris beszélgethetnek.
- **Csoport létrehozása**: Csak egy csoportnevet kell megadni a létrehozáshoz (4. fejezet).

A saját azonosítója teljes formájában jelenik meg, amikor megnyitja a saját profilját, és úgy, ahogy van, kimásolható. A teljes azonosítót adhatja át, nem csak a rövid azonosítót.

Ha a másik fél is megnyitotta az alkalmazást, közvetlenül kapcsolódhatnak és beszélgethetnek.

---

## 3. Beszélgetés

- Csak írja be az üzenetet és küldje el. Fotó, matrica és hely is küldhető.
- Nyissa meg a beviteli mező melletti „+” jelet, és együtt jelennek meg a fájlmellékletek, a hangüzenetek, a hangbevitel, a helyadatok, a matricák, a „válasz nem szükséges” beállítás és még mások.
- **Fájlküldés**: egyéni beszélgetésben legfeljebb 50 MB-ig. Csoportban kisebb, körülbelül 50 KB-ig.
- A veszélyes formátumú fájlok, például a futtatható fájlok, automatikusan letiltásra kerülnek.
- Ha a másik fél nem nyitotta meg az alkalmazást, az üzenet titkosítva a „letéti dobozban” marad, és akkor kézbesül, amikor megnyitja. A letéti dobozt továbbító szerver nem tudja elolvasni a tartalmat. A kézbesítetlen levelek **legfeljebb 7 nap** után automatikusan törlődnek.
- A beszélgetések előzményei fájlba írhatók és beolvashatók.

### A képernyő olvasása

- **Küldési állapot**: Az üzenet melletti jelről ismerhető fel. A ✓ azt jelenti, elküldve, a körben lévő ✓ azt, hogy a letéti dobozba került, a ✓✓ azt, hogy megérkezett a másik félhez, az olvasott kék jel, a sikertelen pedig piros jel. Alakjuk is megkülönbözteti őket, nem csak a színük.
- **A névjegyzék**: A legutóbbi beszélgetés ideje ma esetén óra-perc formában, tegnap esetén „Tegnap”, idén esetén hónap/nap, korábbinál év/hónap/nap formában jelenik meg. Azoknál a névjegyeknél, amelyektől olvasatlan üzenet van, a név és az idő ki van emelve.
- **A saját kártyája**: A lista tetején a saját profilkártyája található; nyomja meg a profil megnyitásához. A listával együtt görgetődik.
- **Alsó lapok telefonon**: Telefonszélességben a képernyő alján a „Névjegyek” és a „Beállítások” lap jelenik meg.
- **A beszélgetés fejléc**: A keresés ikonból a beszélgetésen belül kereshet. A „⋮” menüből ellenőrizheti a biztonsági számot, némíthatja az értesítéseket, kitűzhet, szavazást hozhat létre és még sok mást.

### Parancsok

Ha a beviteli mezőbe `/` jelet ír, megjelennek a parancsjelöltek. Írja be, hogy `/help`, a használható parancsok listájához (71 féle).
Egyes műveletek, például a beállítások és az eszközök összekapcsolása, parancsokból végezhetők.

---

## 4. Csoportok

- Egy csoportba legfeljebb **1 000 fő** léphet be.
- A létrehozáshoz csak egy csoportnevet kell megadni az „Ismerős hozzáadása” menü „Csoport létrehozása” pontjában (a `/newgroup` paranccsal is létrehozható). A meghívás a „csoportmeghívó hivatkozásból” történik. Aki megkapta a hivatkozást, a neve megadásával csatlakozhat.
- Csoportban is küldhető fájl, de a korlát kisebb, körülbelül 50 KB. Hangüzenet csoportban még nem küldhető.
- Ha egy tag az alkalmazás régi változatát használja, abban a csoportban nem használható a biztonságosabb új módszer (csoport v5), és figyelmeztetés jelenik meg a képernyőn. Akkor kapcsol be, amikor mindenki a legújabb változatra frissít.

---

## 5. Hívások

- Egyéni hanghívás és videohívás lehetséges. Csoportos hívás is van (legfeljebb 8 főig).
- **Hívásellenőrző kód**: A hívás képernyőjén ellenőrző kód jelenik meg. Olvassák fel egymásnak a másik féllel, és ellenőrizzék, hogy mindkét képernyőn egyezik-e. Ha nem egyezik, lehet, hogy valaki útközben lehallgat. Ilyenkor bontsa a hívást.
- A csoportos hívás esetenként nem indítható el, ha nem mindenki alkalmazása a legújabb változat.

---

## 6. Több eszköz és fiók

- Ahhoz, hogy ugyanazt a személyazonosságot több eszközön használja, a `/link` paranccsal kapcsolja össze az eszközöket.
- Több fiók is létrehozható és külön használható (például munkahelyi és magán). Mind az eszközök, mind a fiókok száma ingyenes és korlátlan.
- **Fiók létrehozása**: Nyomja meg a „+” gombot a fióklapok mellett a névjegyzék legtetején. Adjon meg egy nevet, és válasszon egy ikon-emojit; ekkor új fiók jön létre, és a rendszer automatikusan átvált rá.
- **Fiókváltás**: A fióklapok mindig a névjegyzék legtetején láthatók. Nyomja meg az egyiket a váltáshoz (számítógépen a Ctrl+1–9 billentyűkkel is válthat). Nyomja meg hosszan egy lapot az átnevezéséhez, az ikonja megváltoztatásához vagy a törléséhez.
- A nyelv automatikusan kerül kiválasztásra 51 nyelv közül, az angolt is beleértve, az eszköz nyelvéhez igazodva.

---

## 7. A biztonságot megőrző beállítások

A beállítások saját képernyőként nyílnak meg. Telefonon a képernyő alján lévő „Beállítások” lapról nyissa meg; számítógépen a képernyőn lévő fogaskerék gombról (a `/settings` paranccsal is megnyitható). A vissza művelettel térhet vissza arra a képernyőre, amelyen volt.

- **Automatikus zárolás**: Van olyan beállítás, amely lapváltáskor automatikusan zárol.
- **Kulcs jelmondata**: Az eszközön belüli kulcs jelmondatba csomagolva védhető. Az alkalmazás megnyitásakor be kell írni.
- **Letiltás**: A zaklató feleket le lehet tiltani. A letiltott féltől nem érkezik kapcsolat.

---

## 8. Akkumulátor és vészhelyzetek (energiamódok)

Az „Energiamód” beállításban kiválaszthatja, hogyan használja a rendszer az akkumulátort.

- **Automatikus (akkumulátorszint)**: Automatikusan vált attól függően, mennyi töltés maradt.
- **Normál**: A megszokott módon.
- **Energiatakarékos**: A kézbesítési ellenőrzéseket legfeljebb 60 másodpercenkéntire ritkítja, és leállítja a jelenléti jelet.
- **Vészhelyzeti (katasztrófákra)**: A kézbesítési ellenőrzéseket legfeljebb 10 percenkéntire ritkítja. Katasztrófa esetén vagy máskor használja, amikor nem tud tölteni.

Az akkumulátort nem a kommunikáció mennyisége meríti, hanem az, hogy a rádió hányszor ébred fel. Ezért a küldési oldalt nem ritkítjuk; csak a hallgatási oldalt. A küldés továbbra is azonnal kimegy, mint mindig. Amikor tölteni kezd, automatikusan egy lépést visszalép a könnyebb oldal felé.

Azokon az eszközökön, amelyek nem tudják automatikusan leolvasni az akkumulátor szintjét (például iPhone böngészőben), az „Automatikus” Normálként viselkedik, és a kézi választás a választott módon működik.

---

## 9. Biztonsági mentés és helyreállítás (ez a legfontosabb fejezet)

A Breeze személyazonossága csak az Ön eszközén belüli kulcs. A szerveren nincs fióklista, és a készítőnél sincs meg az Ön kulcsa.
**Ha elveszíti az eszközt, a személyazonosság is elveszik.** Fontos személyazonossághoz mindenképpen készítsen biztonsági mentést.

A biztonsági mentés és a helyreállítás a beállítások „Biztonsági mentés és helyreállítás” szakaszából végezhető (három gomb van: „Biztonsági mentés a felhőbe”, „Helyreállítás” és „Helyreállítás fájlból”). Amikor először ad hozzá névjegyet, csak egyszer jelenik meg egy kártya, amely biztonsági mentés készítésére buzdít.

### A biztonsági mentés elkészítése

1. A beállítások „Biztonsági mentés és helyreállítás” szakaszából válassza a biztonsági mentés létrehozását.
2. Állítson be egy jelmondatot a biztonsági mentéshez (legalább 6 karakter).
3. Válassza ki a mentés helyét.
   - **Mentés fájlba**: A biztonsági mentés fájlját saját magánál tárolja (ajánlott).
   - **Mentés közvetítő szerverre**: Csak akkor használható, ha az adott közvetítő üzemeltetője engedélyezte. Az alapértelmezett közvetítőn nem használható. Van megőrzési határidő, ezért a határidőig állítsa vissza.

A biztonsági mentés tartalma titkosított. A mentési hely szervere csak a titkosított szöveget kezeli.

### A helyreállítás módja

Új eszközön a biztonsági mentés fájljával (vagy a közvetítő szerveren lévő mentéssel) és a beállított jelmondattal állíthatja vissza.

### Figyelmeztetések

- **Ha elfelejti a jelmondatot, a visszaállítás nem lehetséges.** A készítő sem tudja kijavítani. A jelmondatot írja fel egy másik helyre.
- **Az eldobható személyazonosság sem biztonsági mentéssel, sem helyreállítással nem hozható vissza.**
- A biztonsági mentést készítse el újra, amikor a személyazonosságok száma nő, vagy eszközt cserél.

---

## 10. A letéti doboz és a költségek szemlélete

- Amikor a másik fél offline van, a levelek a közvetítő szerver „letéti dobozában” maradnak titkosítva (legfeljebb 7 napig).
- A közvetítésnek a visszaélések megelőzésére korlátai vannak (a letétbe helyezhető mennyiség és gyakoriság). A korlát elérésekor az adott időszakban nem helyezhető letétbe új levél, de a **már megérkezett levelek nem tűnnek el**. A képernyőn megjelenik az ok és a várakozási idő.
- A korlátot, ha a saját szerverére telepítette, Ön maga döntheti el.

A szerver oldalon megmaradó nyilvántartás köre (mindegyik automatikusan törlődik, és a tartalom nem olvasható):

| Dolog | Megmaradási idő |
|---|---|
| Kézbesítetlen levél | Legfeljebb 7 nap |
| Kapcsolódási jel | 5 perc |
| Cím- és eszköznyilvántartás | 90 nap |
| Csoportinformációk és értesítési feliratkozások | 30 nap |

---

## 11. A frissítés módja (asztali változat)

1. Ha van új változat, értesítés jelenik meg a képernyőn.
2. A „Letöltés” gomb megnyomásával az új változat letöltődik (automatikusan nem települ).
3. Amikor a letöltés kész, nyomja meg a „Telepítés” gombot, és indítsa újra.

Ha a frissítés közben hiba történik (például az ellenőrző szám nem egyezik), a frissítés **leáll, és az ok megjelenik a képernyőn**. Régebbi változatra való visszaállítás nem lehetséges.

---

## 12. Ha gond van

| Tünet | Amit ellenőrizni kell |
|---|---|
| Nem küldhető üzenet | Ellenőrizze, hogy az eszköz órája nem tér-e el. Ha az idő eltolódott, a küldés sikertelen lesz. |
| Nem érkezik meg a másik félhez | Amíg a másik fél nem nyitja meg az alkalmazást, a letéti dobozban várakozik (legfeljebb 7 nap). |
| Nem küldhető fájl | Ellenőrizze, hogy nem lépte-e túl a méretkorlátot (egyéni: 50 MB, csoport: körülbelül 50 KB), és nem lett-e veszélyes formátumként letiltva. |
| A hívás ellenőrző kódja nem egyezik | Bontsa a hívást, és hívjon újra. Ne folytassa egyezés nélkül. |
| Elfelejtette a jelmondatot | A visszaállítás nem lehetséges. Hozzon létre új személyazonosságot, és értesítse újra a másik felet. |
| Elvesztette az eszközt | Ha van biztonsági mentés, új eszközön helyreállítható. Ha nincs, új személyazonosság lesz. |
| A mintaoldal nem nyílik meg | A minta előzetes értesítés nélkül leállhat. A saját szerverére telepített példányt használja. |

A hibajelentéseket az [Issues oldalra](https://github.com/shizukutanaka/Breeze/issues) kérjük küldeni.

---

## 13. A Breeze ígéretei

- Nem jelenítünk meg hirdetéseket. Sem az alkalmazásban, sem sehol máshol.
- Nem követünk nyomon. Nincs használatelemzés, hirdetési mechanizmus és adatkereskedelem.
- A készítő nem rendelkezik a felhasználók adataival. A szerver oldalon egyáltalán nincs fióklista.
- A beszélgetések eszközök között titkosítottak. A szerver csak olvashatatlan borítékokat kezel.

A többi üzenetküldővel való részletes összehasonlítás a tárhely „összehasonlító oldalán” található megírva, beleértve azokat a pontokat is, amelyekben a Breeze alulmarad (a felhasználók száma, a külső audit hiánya stb.).

---

*Ez a kézikönyv a Breeze 2026-11-25-i állapotát tükrözi.*
