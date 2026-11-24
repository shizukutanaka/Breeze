# Breeze-käyttöopas

**Lue muilla kielillä**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · Suomi (tämä sivu) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze on salattu viestisovellus, joka ei vaadi puhelinnumeroa eikä rekisteröitymistä.
Keskustelun sisällön voivat lukea vain sen lähettäjä ja vastaanottaja. Edes sitä kuljettava palvelin ei voi lukea sitä.
Kaikki toiminnot ovat ilmaisia, eikä mainoksia ole.

Tämä opas on tarkoitettu käytön aloittaville.

---

## 1. Aloittaminen

### Hankinta

Valitse laitteellesi sopiva tiedosto [lataussivulta](https://github.com/shizukutanaka/Breeze/releases/latest).

- Windows: tiedostot, joiden nimi päättyy `-win-x64.exe` (saatavilla myös ARM-laitteille)
- Mac: tiedostot, joiden nimi päättyy `-mac.dmg`
- Linux: `.AppImage` (voidaan suorittaa sellaisenaan) tai `.deb`
- Jos haluat käyttää selaimessa, käytä omalle palvelimellesi sijoittamaasi versiota (asennusohjeet ovat erillisessä asiakirjassa "Asennusopas")

Jokaisen tiedoston mukana on tarkistusluku (SHA256SUMS.txt). Jos olet huolissasi, voit tarkistaa, että lataamasi tiedoston luku täsmää.

> **Kokeilusivusta**: Julkinen kokeilusivu (breeze.pages.dev) on tällä hetkellä pysäytetty (sen avaaminen antaa 404). Käytä sovellusversiota, kunnes se palautetaan. Omalle palvelimellesi sijoittamaasi Breezeen pysähtyminen ei vaikuta.

### Ensiasetukset

1. Avaa sovellus.
2. Syötä nimesi. Siinä kaikki – olet valmis. Rekisteröitymistä tai puhelinnumeroa ei tarvita.

Tällöin laitteesi sisällä luodaan "avain". Se on itse identiteettisi.
**Palvelimella ei ole tililuetteloa.** Identiteettisi on vain laitteesi sisällä.
Tämä tulee tärkeäksi varmuuskopiointiluvussa (8).

### "Kertakäyttöidentiteetistä"

Jos valitset luomisen yhteydessä "kertakäyttöidentiteetin", saat identiteetin, jota ei voi palauttaa millään tavalla.
Jos kadotat laitteen, palautat sen tehdasasetuksiin tai poistat selaimen tiedot, identiteetti on mennyttä ikuisesti.
Tämä näkyy myös näytöllä. Älä valitse sitä identiteetille, jota aiot käyttää pitkään.

---

## 2. Yhteys toiseen henkilöön

On kolme tapaa yhdistyä henkilöön, jonka kanssa haluat keskustella.

- **Anna tunnuksesi**: Kerro tunnuksesi toiselle henkilölle ja anna hänen syöttää se.
- **QR-koodi**: Näytä kutsun QR-koodi ja anna toisen henkilön lukea se.
- **Kutsulinkki**: Kopioi kutsuviesti kohdasta "Kutsu ystävä" ja lähetä se tavallisella yhteydenpitotavallasi (sähköposti jne.). Kun toinen henkilö avaa linkin ja syöttää nimensä, voitte keskustella heti.

Jos myös toisella henkilöllä on sovellus auki, voitte yhdistyä suoraan ja keskustella.

---

## 3. Keskustelut

- Kirjoita vain viesti ja lähetä se. Voit lähettää myös kuvia, tarroja ja sijainnin.
- **Tiedostojen lähetys**: Kahdenkeskisissä keskusteluissa enintään 50 MB. Ryhmissä se on pienempi, noin 50 KB.
- Vaaralliset tiedostomuodot, kuten suoritettavat tiedostot, estetään automaattisesti.
- Jos toisella henkilöllä ei ole sovellusta auki, viesti asetetaan edelleen salattuna "postilaatikkoon" ja toimitetaan, kun hän avaa sovelluksen. Postilaatikkoa kuljettava palvelin ei voi lukea sisältöä. Kirjeet, joita ei koskaan toimiteta, poistetaan automaattisesti **viimeistään 7 päivän** kuluttua.
- Keskusteluhistorian voi viedä tiedostoon ja tuoda siitä.

### Komennot

Jos syötät syöttökenttään `/help`, näet luettelon käytettävistä komennoista (yli 60 tyyppiä).
Jotkin toiminnot, kuten asetukset ja laitteiden linkitys, tehdään komennoilla.

---

## 4. Ryhmät

- Ryhmässä voi olla enintään **1 000 henkilöä**.
- Luot ryhmän syöttämällä vain ryhmän nimen. Kutsut tehdään "Ryhmäkutsulinkillä". Linkin saanut henkilö voi liittyä syöttämällä nimensä.
- Myös ryhmissä voi lähettää tiedostoja, mutta raja on pienempi, noin 50 KB. Ääniviestejä ei vielä voi lähettää ryhmissä.
- Jos jäsen käyttää sovelluksen vanhaa versiota, ryhmä ei voi käyttää uudempaa, turvallisempaa tilaa (ryhmä v5), ja näytöllä näkyy varoitus. Se otetaan käyttöön, kun kaikilla on uusin versio.

---

## 5. Puhelut

- Voit soittaa kahdenkeskisiä ääni- ja videopuheluita. Myös ryhmäpuheluita on.
- **Puhelun vahvistuskoodi**: Puhelunäytöllä näkyy vahvistuskoodi. Lukekaa se ääneen toisen henkilön kanssa ja tarkistakaa, että se täsmää molemmilla näytöillä. Jos se ei täsmää, joku saattaa salakuunnella puhelua. Katkaise puhelu siinä tapauksessa.
- Ryhmäpuheluita ei joskus voi aloittaa, jos kaikkien sovellukset eivät ole uusinta versiota.

---

## 6. Useat laitteet ja tilit

- Käyttääksesi samaa identiteettiä useilla laitteilla linkität laitteet komennolla `/link`.
- Voit luoda useita tilejä ja käyttää niitä eri tarkoituksiin (esimerkiksi työ ja yksityinen). Sekä laitteiden että tilien määrä on ilmainen ja rajoittamaton.
- Kieli valitaan automaattisesti 8 kielestä: englanti, japani, korea, kiina (Taiwan), espanja, thai, indonesia ja portugali (Brasilia).

---

## 7. Turvallisuutta ylläpitävät asetukset

- **Automaattinen lukitus**: On asetus, joka lukitsee automaattisesti, kun vaihdat välilehteä.
- **Avaimen tunnuslause**: Voit suojata laitteesi sisällä olevan avaimen käärimällä sen tunnuslauseeseen. Sinua pyydetään syöttämään se, kun avaat sovelluksen.
- **Esto**: Voit estää häiritsevät henkilöt. Estetyn henkilön viestit eivät tavoita sinua.

---

## 8. Varmuuskopiointi ja palautus (tärkein luku)

Breeze-identiteettisi on vain laitteesi sisällä oleva avain. Palvelimella ei ole tililuetteloa, eikä tekijälläkään ole avaintasi.
**Jos kadotat laitteesi, menetät identiteettisi.** Tee tärkeälle identiteetille aina varmuuskopio.

### Varmuuskopion tekeminen

1. Valitse "Tee varmuuskopio".
2. Aseta varmuuskopion tunnuslause (vähintään 6 merkkiä).
3. Valitse tallennuspaikka.
   - **Tallenna tiedostoon**: Säilytä varmuuskopiotiedosto itselläsi (suositeltu).
   - **Tallenna välityspalvelimelle**: Voidaan käyttää vain, jos kyseisen välittäjän ylläpitäjä on ottanut sen käyttöön. Sitä ei voi käyttää oletusvälittäjällä. Säilytykselle on määräaika, joten nouda se takaisin ennen määräaikaa.

Varmuuskopion sisältö on salattu. Palvelin, jolle se tallennetaan, käsittelee vain salattua tekstiä.

### Palauttaminen

Palauta uudella laitteella varmuuskopiotiedostolla (tai välityspalvelimen varmuuskopiolla) ja asettamallasi tunnuslauseella.

### Huomioita

- **Jos unohdat tunnuslauseen, palautus on mahdotonta.** Tekijäkään ei voi korjata sitä. Kirjoita tunnuslause muistiin toiseen paikkaan.
- **Kertakäyttöidentiteettiä ei voi palauttaa, ei varmuuskopiolla eikä palautuksella.**
- Tee varmuuskopio uudelleen, kun lisäät identiteettejä tai vaihdat laitetta.

---

## 9. Postilaatikko ja kustannusajattelu

- Kirjeet henkilölle, joka on offline-tilassa, asetetaan salattuna välityspalvelimen "postilaatikkoon" (enintään 7 päivää).
- Välittäjällä on rajat väärinkäytön estämiseksi (kuinka paljon voi jättää ja kuinka usein). Kun raja saavutetaan, et voi jättää uusia kirjeitä kyseisenä aikana, mutta **jo toimitetut kirjeet eivät koskaan katoa**. Näytöllä näkyy syy ja kuinka kauan on odotettava.
- Jos olet sijoittanut välittäjän omalle palvelimellesi, päätät rajat itse.

Palvelinpuolelle jäävien tietojen laajuus (kaikki poistetaan automaattisesti, eikä sisältöä voi lukea):

| Asia | Kuinka kauan säilyy |
|---|---|
| Toimittamattomat kirjeet | Enintään 7 päivää |
| Yhteyssignaalit | 5 minuuttia |
| Osoite- ja laitetiedot | 90 päivää |
| Ryhmätiedot ja ilmoitustilaukset | 30 päivää |

---

## 10. Päivittäminen (työpöytäversio)

1. Kun uusi versio on saatavilla, näytölle tulee ilmoitus.
2. Paina "Lataa" hakeaksesi uuden version (sitä ei asenneta automaattisesti).
3. Kun lataus on valmis, paina "Asenna" ja käynnistä uudelleen.

Jos päivityksen aikana menee jotain pieleen (esimerkiksi tiedoston tarkistus ei täsmää), **päivitys pysähtyy ja syy näkyy näytöllä**. Vanhaan versioon ei voi palata.

---

## 11. Kun jokin menee pieleen

| Oire | Mitä tarkistaa |
|---|---|
| Viestejä ei voi lähettää | Tarkista, ettei laitteesi kello ole väärässä. Jos aika on väärä, lähetys epäonnistuu. |
| Ei tavoita toista henkilöä | Se odottaa postilaatikossa, kunnes toinen henkilö avaa sovelluksen (enintään 7 päivää). |
| Tiedostoja ei voi lähettää | Tarkista, ettet ylitä kokorajaa (kahdenkeskisissä 50 MB, ryhmissä noin 50 KB) ja ettei tiedostoa estetä vaarallisena muotona. |
| Puhelun vahvistuskoodi ei täsmää | Katkaise puhelu ja soita uudelleen. Älä jatka, kun se ei täsmää. |
| Unohtunut tunnuslause | Palautus on mahdotonta. Luo uusi identiteetti ja kerro yhteyshenkilöillesi uudelleen. |
| Kadonnut laite | Jos sinulla on varmuuskopio, voit palauttaa uudella laitteella. Jos ei, siitä tulee uusi identiteetti. |
| Kokeilusivu ei aukea (404) | Se on tällä hetkellä pysäytetty. Käytä sovellusversiota. |

Ilmoita vioista [Issue-sivulla](https://github.com/shizukutanaka/Breeze/issues), kiitos.

---

## 12. Breezen lupaukset

- Ei mainoksia. Ei sovelluksessa eikä missään muuallakaan.
- Ei seurantaa. Ei käytön analysointia, ei mainosmekanismeja, ei tietojen myyntiä – ei lainkaan.
- Tekijällä ei ole käyttäjien tietoja. Palvelinpuolella ei ole lainkaan tililuetteloa.
- Keskustelut salataan laitteiden välillä. Palvelin käsittelee vain sinetöityjä kirjekuoria, joita se ei voi lukea.

Yksityiskohtainen vertailu muihin viestisovelluksiin on arkiston "vertailusivulla", mukaan lukien kohdat, joissa Breeze häviää (käyttäjien määrä, se ettei ulkoista tarkastusta ole tehty jne.).

---

*Tämä opas kuvaa sisältöä Breeze v3.8.0:n ajankohdan mukaisesti.*
