# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Más nyelven olvasás**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · Magyar (ez az oldal) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Telefonszám és regisztráció nélkül használható, titkosított üzenetküldő.**
A beszélgetések tartalmát csak a küldő és a fogadó olvashatja. Még az útközben továbbító szerver sem.
Minden funkció ingyenes, és nincsenek hirdetések.

Ez nem egy weboldal, hanem telepítve használható szoftver (Windows / Mac / Linux / Android / iPhone / böngésző).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## A használathoz a saját szerverére kell telepítenie

A Breeze-nek nincs „üzemeltető vállalati szervere”. **A használatához Önnek kell tárhelyet (szervert) biztosítania, és oda kell telepítenie a Breeze-t. Ez a hivatalos használati mód.**

- A tárhelyhez elegendő az ingyenes szint. A Cloudflare ingyenes keretén fut, bankkártya sem kell hozzá. Az eljárás a [telepítési útmutatóban](SELF_HOSTING-hu.md) található (a többnyelvű változatok az útmutató elején választhatók).
- Az alkalmazást (Windows / Mac / Linux / Android / iPhone) a [letöltési oldalról](https://github.com/shizukutanaka/Breeze/releases/latest) szerezheti be, és a saját szerveréhez csatlakozva használhatja.
- **A mintatelepítésről (őszinte tájékoztatás)**: Működés-ellenőrzés céljából elhelyeztünk egy mintát (https://breeze-469.pages.dev/). Ugyanaz a szoftver fut rajta, de valós használatra kérjük, használja a saját szerverét. A minta előzetes értesítés nélkül megváltozhat vagy leállhat. A saját szerverére telepített példányt a minta leállása nem érinti.

A részletes használati leírás a [kézikönyvben](MANUAL-hu.md) található (a többnyelvű változatok a kézikönyv elején választhatók).

## Használat (3 lépés)

1. Nyissa meg a saját szerverére telepített Breeze-t (vagy azt a címet, amelyet a telepítést végző személy adott meg), és adja meg a nevét. Ezzel kész is a beállítás (sem regisztráció, sem telefonszám nem kell). Ekkor az eszközön belül létrejön egy „kulcs”, amely az Ön személyazonossága lesz.
2. Adja át a saját azonosítóját vagy QR-kódját annak, akivel beszélni szeretne.
3. Ha a másik fél is megnyitotta az alkalmazást, közvetlenül kapcsolódhatnak és beszélgethetnek. Ha a másik fél nem nyitotta meg, az üzenet titkosítva a „letéti dobozban” marad, és akkor kézbesül, amikor megnyitja. A letéti dobozt továbbító szerver nem tudja elolvasni a tartalmat. A kézbesítetlen levelek legfeljebb 7 nap után automatikusan törlődnek.

## Ígéretek (amit nem teszünk)

- **Nem jelenítünk meg hirdetéseket.** Sem az alkalmazásban, sem sehol máshol.
- **Nem követjük nyomon.** Nincs használatelemzés, hirdetési mechanizmus és adatkereskedelem.
- **A készítő nem rendelkezik a felhasználók adataival.** A szerver oldalon egyáltalán nincs fióklista. A személyazonosság kizárólag az Ön eszközén lévő kulcs.
- **A beszélgetések eszközök között titkosítottak.** A szerver csak olvashatatlan borítékokat kezel.

Az őszinteség kedvéért a határokat is leírjuk. A kézbesítés érdekében a szerveren rövid ideig tartó tárolás történik (a kézbesítetlen borítékok legfeljebb 7 napig, a kapcsolódási jelek 5 percig, a cím- és eszköznyilvántartás 90 napig, a csoportinformációk és az értesítési feliratkozások 30 napig; mindegyik automatikusan törlődik, és a tartalom nem olvasható). A felhőbe történő biztonsági mentés alapértelmezés szerint ki van kapcsolva. Ha a saját szerverére telepíti, ez a tárolás is az Ön kezelése alá kerül.

## Amire képes

- Egyéni beszélgetések és csoportos beszélgetések (legfeljebb 1 000 fő)
- Hanghívások és videohívások (csoportos hívások legfeljebb 8 főig)
- Fájlküldés (egyéni beszélgetésben legfeljebb 50 MB. Csoportban is küldhető, de ott kisebb a méretkorlát.)
- Több eszköz és több fiók külön használata (például munkahelyi és magán; az eszközök és a fiókok száma is ingyenes és korlátlan)
- 51 nyelv (angol plusz 50 nyelvi fájl), automatikusan kiválasztva az eszköz nyelvéhez igazodva
- Fotóval ellátott profil, matricák, helymegosztás
- Parancsok használata, például `/help` (71 féle)
- Az akkumulátorhoz igazodó energiamódok (automatikus / normál / energiatakarékos / vészhelyzeti). Ahogy merül az akkumulátor, a kézbesítési ellenőrzések ritkulnak, hogy az akkumulátor tovább tartson. Védelem katasztrófákra és más olyan helyzetekre, amikor nem tud tölteni
- Jól olvasható képernyők (figyelem a színkontrasztra, a szövegméretre és a csak billentyűzettel történő kezelésre)

## Miben különbözik a többi üzenetküldőtől

| | Breeze | A legtöbb üzenetküldő |
|---|--------|--------|
| Regisztráció | Nem szükséges (a személyazonosság az eszközön lévő kulcs) | Telefonszám szükséges |
| Szerver | Nem tudja olvasni a tartalmat | Az üzemeltető vállalatba vetett bizalomra épül |
| Saját szerverre telepítés | Előfeltétel (telepítve használandó) | Nem lehetséges |
| A tartalom nyilvánossága | Minden nyilvános (MIT licenc) | Sok a nem nyilvános |
| Az adatok helye | Az Ön eszközén belül | Az üzemeltető vállalat szerverén |

A Signal és a LINE részletes összehasonlítása az [összehasonlító oldalon (angolul)](../COMPARISON.md) található. A Breeze minden állításához tartozik egy-egy „ellenőrzési mód”, és azt is nyíltan leírjuk, amiben a Breeze alulmarad (például a felhasználók száma, vagy hogy nem esett át külső auditon).

## A saját szerveres telepítés költsége

A Breeze a Cloudflare ingyenes keretén belül fut. Bankkártya sem kell hozzá.

| Tétel | Ingyenes keret | Fizetős esetben |
|-----------|-----------|-------------|
| Tárhely | Cloudflare Pages (ingyenes) | — |
| Feldolgozás | Naponta legfeljebb 100 000 alkalom | Havonta legfeljebb 10 000 000 alkalom |
| Tárolás | Naponta olvasás legfeljebb 100 000, írás legfeljebb 1 000 alkalom | Havonta olvasás legfeljebb 10 000 000, írás legfeljebb 1 000 000 alkalom |
| Hívásátirányítás | 20 GB-ig ingyenes | GB-onként 0,05 dollár |
| Egyedi domain | Nem szükséges (ingyenes cím jár hozzá) | Évi 10 dollár |
| **Összesen** | **Havi 0 dollár** (könnyű használat mellett körülbelül 20–40 főig) | **Havi 5 dollártól** (könnyű használat mellett körülbelül 100 fős nagyságrend; 1 000 fős nagyságrendnél a használattól függően havi 34–222 dollár) |

A költségek nagyobb lépték melletti alakulásáról és arról, hogy „miért nem kell egyetlen üzemeltetőnek az összes költséget viselnie”, a [költségekről és fenntarthatóságról szóló írás (angolul)](../SUSTAINABILITY.md) szól, az alapul szolgáló számítások pedig a [költségmodellben (angolul)](../COST_MODEL.md) találhatók.

A telepítés ezzel az egyetlen paranccsal kezdődik (részletek: [telepítési útmutató](SELF_HOSTING-hu.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Műszaki részletek (fejlesztőknek)

### A titkosítás módszerei

| Szerep | Módszer |
|-------|-----------|
| Kulcscsere | X25519 (tartalék: P-256) |
| Aláírás | Ed25519 (tartalék: HMAC-SHA256) |
| Titkosítás | AES-256-GCM |
| Kulcslevezetés | HKDF-SHA256 |
| A beszélgetési kulcs megújítása | Double Ratchet (ugyanaz a módszer, mint a Signal esetében) |
| Csoportkulcs | Sender Key |
| A küldő elrejtése a közvetítő elől | Sealed Sender |

A tervezés mérvadó dokumentuma a [SPEC.md specifikáció](../../SPEC.md), a gyengeségek bejelentésének helye és az irányelvek pedig a [SECURITY.md](../../SECURITY.md) dokumentumban találhatók.

### Tesztek és minőségellenőrzés

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Részvétel a fejlesztésben

A folyamat és a szabályok a [CONTRIBUTING.md](../../CONTRIBUTING.md) dokumentumban találhatók.
Hibajelentés az [Issues oldalon](https://github.com/shizukutanaka/Breeze/issues) tehető. A magatartási kódex a [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Licenc

MIT — a [LICENSE](../../LICENSE) szerint szabadon használható, módosítható és terjeszthető.
