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
- Jos haluat käyttää selaimessa, käytä omalle palvelimellesi sijoittamaasi versiota (asennusohjeet ovat erillisessä asiakirjassa "Asennusopas"). Vakioasennus käyttää Cloudflarea, joten Cloudflare-tili vaaditaan.

Jokaisen tiedoston mukana on tarkistusluku (SHA256SUMS.txt). Jos olet huolissasi, voit tarkistaa, että lataamasi tiedoston luku täsmää.

### Ensiasetukset

1. Avaa sovellus.
2. Paina "Aloita satunnaisella tunnuksella". Siinä kaikki – olet valmis. Rekisteröitymistä tai puhelinnumeroa ei tarvita.

- Jos syötät kenttään painikkeen yläpuolella "Nimesi (näyttönimi)", aloitat sillä nimellä. Voit myös painaa painiketta kentän ollessa tyhjä. Näyttönimen voi vaihtaa myöhemmin asetusten profiiliosiossa.
- On myös tapa luoda identiteetti nimellä ja Breeze-tunnuksella, jonka valitset itse. Tällöin annetaan palautuslause, joka näytetään näytöllä. Palautuslause on sanat, joilla voit tuoda identiteetin takaisin toisella laitteella. Kirjoita se muistiin paperille tai turvalliseen paikkaan.
- Jos haluat palauttaa aiemmin tekemäsi identiteetin, avaa "Palauta olemassa oleva tili", niin palautustavat (palauta varmuuskopiotiedostosta, palauta palautuslauseella, palauta tilillä + tunnuslauseella) tulevat näkyviin.
- Kun luominen on valmis, näkyviin tulee kortti, joka ohjaa sinua suojaamaan avaimesi tunnuslauseella (se ei katoa ajan kuluttua). Tärkeän identiteetin kohdalla noudata ohjetta ja lisää suojaus.

Tällöin laitteesi sisällä luodaan "avain". Se on itse identiteettisi.
**Palvelimella ei ole tililuetteloa.** Identiteettisi on vain laitteesi sisällä.
Tämä tulee tärkeäksi varmuuskopiointiluvussa (9).

### Entisestä "kertakäyttöidentiteetistä"

"Kertakäyttöidentiteetti" — identiteetti, jota ei voi palauttaa millään tavalla — on poistunut. Nykyisillä identiteetin luomistavoilla jokainen identiteetti voidaan suojata varmuuskopiolla.

---

## 2. Yhteys toiseen henkilöön

Paina yhteystietonäytöllä painiketta "Lisää ystävä", niin kolme vaihtoehtoa tulee näkyviin.

- **Lisää yhteystieto**: Syötä toisen henkilön tunnus tai lue QR-koodi.
- **Kutsu ystävä**: Kopioi kutsulinkki ja lähetä se tavallisella yhteydenpitotavallasi (sähköposti jne.). Kun toinen henkilö avaa linkin ja syöttää nimensä, voitte keskustella heti.
- **Luo ryhmä**: Luo ryhmä syöttämällä vain ryhmän nimi (luku 4).

Oma tunnuksesi näkyy täydellisessä muodossaan, kun avaat oman profiilisi, ja voit kopioida sen sellaisenaan. Voit luovuttaa täydellisen tunnuksen, et vain lyhyttä tunnusta.

Jos myös toisella henkilöllä on sovellus auki, voitte yhdistyä suoraan ja keskustella.

---

## 3. Keskustelut

- Kirjoita vain viesti ja lähetä se. Voit lähettää myös kuvia, tarroja ja sijainnin.
- Avaa syöttökentän vieressä oleva "+", niin tiedostoliitteet, ääniviestit, äänisyöttö, sijaintitiedot, tarrat, asetus "vastausta ei tarvita" ja muuta tulee näkyviin yhdessä.
- **Tiedostojen lähetys**: Kahdenkeskisissä keskusteluissa enintään 50 MB. Ryhmissä se on pienempi, noin 50 KB.
- Vaaralliset tiedostomuodot, kuten suoritettavat tiedostot, estetään automaattisesti.
- Jos toisella henkilöllä ei ole sovellusta auki, viesti asetetaan edelleen salattuna "postilaatikkoon" ja toimitetaan, kun hän avaa sovelluksen. Postilaatikkoa kuljettava palvelin ei voi lukea sisältöä. Kirjeet, joita ei koskaan toimiteta, poistetaan automaattisesti **viimeistään 7 päivän** kuluttua.
- Keskusteluhistorian voi viedä tiedostoon ja tuoda siitä.

### Näytön lukeminen

- **Lähetystila**: Sen näkee viestin vieressä olevasta merkistä. ✓ tarkoittaa lähetettyä, ympyrässä oleva ✓ tarkoittaa, että se on talletettu postilaatikkoon, ✓✓ tarkoittaa, että se tavoitti toisen henkilön, luettu on sininen merkki ja epäonnistuminen punainen merkki. Ne erotetaan myös muodolla, ei vain värillä.
- **Yhteystietoluettelo**: Viimeisimmän keskustelun aika näkyy kellonaikana tälle päivälle, "Eilen" eiliselle, kuukausi/päivä tälle vuodelle ja vuosi/kuukausi/päivä sitä vanhemmille. Yhteyshenkilöillä, joilta on lukemattomia viestejä, nimi ja aika ovat korostettuina.
- **Yhteyshenkilöiden nimet**: Avaa "Yhteystiedot" (yhteyshenkilön oikean napsautuksen valikosta tai keskustelun valikosta "⋮"), niin voit asettaa oman nimesi kyseiselle yhteyshenkilölle (lempinimen). Lempinimet tallennetaan vain tähän laitteeseen, eikä niitä lähetetä koskaan yhteyshenkilölle tai välityspalvelimelle. Kun asetat lempinimen, yhteyshenkilön itse asettama nimi näytetään myös sen vieressä hillityllä värillä. Voit kytkeä toisen nimen pois päältä asetusten "Yksityisyys"-osion kohdalla "Näytä myös nimi, jonka kukin yhteyshenkilö on itse asettanut".
- **Oma korttisi**: Luettelon yläosassa on oma profiilikorttisi; avaa profiilisi painamalla sitä. Se vierii luettelon mukana.
- **Alavälilehdet puhelimessa**: Puhelimen leveydellä näytön alareunaan ilmestyy viisi välilehteä: ”Keskustelut”, ”Puhelut”, ”Yhteystiedot”, ”Oma kortti” ja ”Asetukset”. Mitkä välilehdet näytetään, voit valita yksi kerrallaan asetusten kohdassa ”Alavälilehdet” (Keskustelut näytetään aina. Vaikka piilottaisit Asetukset-välilehden, voit silti avata asetukset näytön rataskuvakepainikkeesta).
- **Keskustelun otsikko**: Hakukuvakkeesta voit hakea keskustelusta. Valikosta "⋮" voit tarkistaa turvanumeron, mykistää ilmoitukset, kiinnittää, luoda äänestyksen ja muuta.

### Komennot

Jos syötät syöttökenttään `/`, komentoehdotukset tulevat näkyviin. Syötä `/help` nähdäksesi luettelon käytettävistä komennoista (71 tyyppiä).
Jotkin toiminnot, kuten asetukset ja laitteiden linkitys, tehdään komennoilla.

---

## 4. Ryhmät

- Ryhmässä voi olla enintään **1 000 henkilöä**.
- Luot ryhmän syöttämällä vain ryhmän nimen kohdassa "Luo ryhmä" valikossa "Lisää ystävä" (voit luoda sen myös komennolla `/newgroup`). Kutsut tehdään "Ryhmäkutsulinkillä". Linkin saanut henkilö voi liittyä syöttämällä nimensä.
- Myös ryhmissä voi lähettää tiedostoja, mutta raja on pienempi, noin 50 KB. Ääniviestejä ei vielä voi lähettää ryhmissä.
- Jos jäsen käyttää sovelluksen vanhaa versiota, ryhmä ei voi käyttää uudempaa, turvallisempaa tilaa (ryhmä v5), ja näytöllä näkyy varoitus. Se otetaan käyttöön, kun kaikilla on uusin versio.

---

## 5. Puhelut

- Voit soittaa kahdenkeskisiä ääni- ja videopuheluita. Myös ryhmäpuheluita on (enintään 8 henkilölle).
- **Puhelun vahvistuskoodi**: Puhelunäytöllä näkyy vahvistuskoodi. Lukekaa se ääneen toisen henkilön kanssa ja tarkistakaa, että se täsmää molemmilla näytöillä. Jos se ei täsmää, joku saattaa salakuunnella puhelua. Katkaise puhelu siinä tapauksessa.
- Ryhmäpuheluita ei joskus voi aloittaa, jos kaikkien sovellukset eivät ole uusinta versiota.
- **Puheluhistoria**: Kahdenkeskiset puhelut jättävät historian vain tähän laitteeseen (toinen henkilö, oliko puhelu lähtevä / saapuva / vastaamaton, kellonaika ja puhelun kesto. Mitään puhutusta ei säilytetä). Historiaa ei koskaan lähetetä palvelimelle tai toiselle henkilölle. Enintään 200 merkintää säilytetään, ja vanhimmat poistetaan ensin. Ryhmäpuhelut eivät näy historiassa.
- Avaa historia puhelimessa ”Puhelut”-välilehdeltä. Kun on vastaamaton puhelu, jota et ole vielä nähnyt, Puhelut-välilehdessä näkyy numeromerkki, joka katoaa, kun avaat historian. Historian riviltä voit avata keskustelun kyseisen henkilön kanssa tai soittaa takaisin. Voit poistaa koko historian näytön painikkeella.
- **Puheluhistoria ei sisälly varmuuskopioon.** Uudella laitteella historia alkaa tyhjänä. Jos et halua, että historiaa säilytetään, kytke asetusten ”Yksityisyys”-osion ”Säilytä puheluhistoria tässä laitteessa” pois päältä, niin tallennus itse pysähtyy.

---

## 6. Useat laitteet ja tilit

- Käyttääksesi samaa identiteettiä useilla laitteilla linkität laitteet komennolla `/link`.
- Voit luoda useita tilejä ja käyttää niitä eri tarkoituksiin (esimerkiksi työ ja yksityinen). Sekä laitteiden että tilien määrä on ilmainen ja rajoittamaton.
- **Tilin luominen**: Paina painiketta "+" tilivälilehtien vieressä yhteystietoluettelon aivan yläosassa. Syötä nimi ja valitse kuvake-emoji, niin uusi tili luodaan ja siihen vaihdetaan automaattisesti.
- **Tilien vaihtaminen**: Tilivälilehdet näkyvät aina yhteystietoluettelon aivan yläosassa. Vaihda painamalla yhtä (tietokoneella voit vaihtaa myös näppäimillä Ctrl+1–9). Paina välilehteä pitkään nimetäksesi sen uudelleen, vaihtaaksesi sen kuvakkeen tai poistaaksesi sen.
- Yhteystiedot ja avaimet ovat erilliset jokaisella tilillä. Vaihda yhteystietoja uudelleen jokaisella tilillä.
- Kieli valitaan automaattisesti 51 kielestä, englanti mukaan lukien, laitteesi kielen mukaan.

---

## 7. Turvallisuutta ylläpitävät asetukset

Asetukset avautuvat omana näyttönään. Puhelimessa avaa ne näytön alareunan välilehdeltä "Asetukset"; tietokoneella näytön rataskuvakepainikkeesta (voit avata ne myös komennolla `/settings`). Palaa edelliselle näytölle takaisin-toiminnolla.

- **Automaattinen lukitus**: On asetus, joka lukitsee automaattisesti, kun vaihdat välilehteä.
- **Avaimen tunnuslause**: Voit suojata laitteesi sisällä olevan avaimen käärimällä sen tunnuslauseeseen. Sinua pyydetään syöttämään se, kun avaat sovelluksen.
- **Näytä myös nimi, jonka kukin yhteyshenkilö on itse asettanut**: "Yksityisyys"-osiossa. Yhteyshenkilölle, jolle olet antanut lempinimen, voit valita, näytetäänkö heidän oma nimensä sen rinnalla (luku 3).
- **Esto**: Voit estää häiritsevät henkilöt. Estetyn henkilön viestit eivät tavoita sinua.
- **Säilytetäänkö puheluhistoria**: Asetusten ”Yksityisyys”-osion kohdalla ”Säilytä puheluhistoria tässä laitteessa” voit pysäyttää puheluhistorian tallennuksen (luku 5).
- **Alavälilehtien näkyvyys**: Kohdassa ”Alavälilehdet” voit näyttää tai piilottaa puhelimen alavälilehdet (Puhelut / Yhteystiedot / Oma kortti / Asetukset) yksi kerrallaan. Keskustelut näytetään aina.

---

## 8. Akku ja hätätilanteet (virtatilat)

Asetuksessa "Virtatila" voit valita, miten akkua käytetään.

- **Automaattinen (akun taso)**: Vaihtaa automaattisesti sen mukaan, kuinka paljon akkua on jäljellä.
- **Normaali**: Kuten tavallisesti.
- **Virransäästö**: Harventaa toimitustarkistukset enintään kerran 60 sekunnissa ja pysäyttää läsnäolosignaalin.
- **Hätätila (katastrofeihin)**: Harventaa toimitustarkistukset enintään kerran 10 minuutissa. Käytä sitä katastrofissa tai muulloin, kun et voi ladata.

Akkua kuluttaa ei viestinnän määrä vaan se, kuinka monta kertaa radio herää. Siksi lähetyspuolta ei harvenneta; vain kuuntelupuoli harvennetaan. Lähetys lähtee silti heti, kuten aina. Kun aloitat lataamisen, se siirtyy automaattisesti yhden askeleen takaisin kevyempään suuntaan.

Laitteilla, jotka eivät voi lukea akun tasoa automaattisesti (kuten iPhone-selain), "Automaattinen" toimii kuten Normaali, ja manuaalinen valinta toimii valitulla tavalla.

---

## 9. Varmuuskopiointi ja palautus (tärkein luku)

Breeze-identiteettisi on vain laitteesi sisällä oleva avain. Palvelimella ei ole tililuetteloa, eikä tekijälläkään ole avaintasi.
**Jos kadotat laitteesi, menetät identiteettisi.** Tee tärkeälle identiteetille aina varmuuskopio.

Varmuuskopiointi ja palautus tehdään asetusten osiosta "Varmuuskopiointi & palautus" (painikkeet ovat "Luo varmuuskopio", "Palauta varmuuskopio" ja "Palauta tiedostosta"). Kun lisäät yhteystiedon ensimmäisen kerran, näkyviin tulee vain kerran kortti, joka kehottaa tekemään varmuuskopion.

### Automaattinen varmuuskopiointi

Asetus "Automaattinen varmuuskopiointi" on päällä alusta alkaen. Kun tietosi muuttuvat, salattu varmuuskopio lähetetään automaattisesti itse ylläpitämällesi välityspalvelimelle.

- Se ei lähetä jokaisesta muutoksesta: se odottaa 30 sekuntia viimeisen muutoksen jälkeen ja lähettää kaiken yhdessä. Yritysten välillä on vähintään 15 minuuttia.
- Kun olet offline-tilassa, mitään ei lähetetä; muutokset pidetään tallessa ja lähetetään, kun yhteys palaa ja kun avaat sovelluksen.
- Automaattista lähetystä varten sinun on syötettävä varmuuskopion tunnuslause kerran kyseisellä laitteella (kun sitä tarvitaan, asetusosioon tulee näkyviin painike "Syötä tunnuslause"). **Tunnuslausetta ei tallenneta.** Se muistetaan vain sovelluksen ollessa auki, ja se katoaa, kun suljet sen. Yksinkertaisen palautuksen identiteetillä lähetys toimii sellaisenaan heti sen jälkeen, kun olet syöttänyt tunnuslauseen rekisteröinnin tai päivityksen yhteydessä.
- Jos välityspalvelin ei tue varmuuskopioiden tallentamista, automaattinen varmuuskopiointi ei toimi. Se näkyy asetusosiossa.
- Tila (milloin viimeisin onnistunut lähetys oli, odottaako muutoksia, epäonnistuiko lähetys) näkyy asetusosiossa.

### Varmuuskopion tekeminen (manuaalinen)

1. Valitse asetusten kohdasta "Varmuuskopiointi & palautus" vaihtoehto "Luo varmuuskopio".
2. Aseta varmuuskopion tunnuslause (vähintään 6 merkkiä).
3. Valitse tallennuspaikka.
   - **Tallenna tiedostoon**: Säilytä varmuuskopiotiedosto itselläsi (suositeltu).
   - **Tallenna välityspalvelimelle**: Voidaan käyttää vain, jos kyseisen välittäjän ylläpitäjä on ottanut sen käyttöön. Sitä ei voi käyttää oletusvälittäjällä. Säilytykselle on määräaika, joten nouda se takaisin ennen määräaikaa.

Varmuuskopion sisältö on salattu. Palvelin, jolle se tallennetaan, käsittelee vain salattua tekstiä.

### Palauttaminen

Palauta uudella laitteella varmuuskopiotiedostolla (tai välityspalvelimen varmuuskopiolla) ja asettamallasi tunnuslauseella.

Jos olet juuri tuonut identiteettisi takaisin palautuslauseella ja kyseisen identiteetin varmuuskopio on välityspalvelimella, se löydetään automaattisesti ja sinulta kysytään ilmoituksella "Varmuuskopio löytyi". Jos palautat sen, laitteen tiedot korvataan varmuuskopion sisällöllä.

### Siirry uuteen laitteeseen

Paina asetusten "Varmuuskopiointi & palautus" -osion painiketta "Siirry uuteen laitteeseen", niin vaiheet näytetään.

1. Varmista nykyisellä laitteellasi, että välityspalvelimella on varmuuskopio (automaattinen varmuuskopiointi tai "Luo varmuuskopio").
2. Valitse uudella laitteella ensimmäisellä näytöllä palautustapa ja syötä palautuslauseesi (tai tilisi nimi ja tunnuslause).
3. Kun identiteettisi on takaisin, palvelimella oleva varmuuskopio löydetään automaattisesti ja palautusta tarjotaan.

Kaapeleita tai tiedostojen luovutuksia ei tarvita.

### Huomioita

- **Jos unohdat tunnuslauseen, palautus on mahdotonta.** Tekijäkään ei voi korjata sitä. Kirjoita tunnuslause muistiin toiseen paikkaan.
- Automaattisen varmuuskopioinnin tunnuslause on syötettävä jokaisella laitteella. Syötä se uudella laitteella vielä kerran.
- Tee manuaalinen varmuuskopio uudelleen, kun identiteettisi lisääntyvät tai kun vaihdat laitetta.
- Puheluhistoria ei sisälly varmuuskopioon. Kun vaihdat laitetta, puheluhistoria ei siirry uuteen laitteeseen.

---

## 10. Postilaatikko ja kustannusajattelu

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

## 11. Päivittäminen (työpöytäversio)

1. Kun uusi versio on saatavilla, näytölle tulee ilmoitus.
2. Paina "Lataa" hakeaksesi uuden version (sitä ei asenneta automaattisesti).
3. Kun lataus on valmis, paina "Asenna" ja käynnistä uudelleen.

Jos päivityksen aikana menee jotain pieleen (esimerkiksi tiedoston tarkistus ei täsmää), **päivitys pysähtyy ja syy näkyy näytöllä**. Vanhaan versioon ei voi palata.

---

## 12. Kun jokin menee pieleen

| Oire | Mitä tarkistaa |
|---|---|
| Viestejä ei voi lähettää | Tarkista, ettei laitteesi kello ole väärässä. Jos aika on väärä, lähetys epäonnistuu. |
| Ei tavoita toista henkilöä | Se odottaa postilaatikossa, kunnes toinen henkilö avaa sovelluksen (enintään 7 päivää). |
| Tiedostoja ei voi lähettää | Tarkista, ettet ylitä kokorajaa (kahdenkeskisissä 50 MB, ryhmissä noin 50 KB) ja ettei tiedostoa estetä vaarallisena muotona. |
| Puhelun vahvistuskoodi ei täsmää | Katkaise puhelu ja soita uudelleen. Älä jatka, kun se ei täsmää. |
| Unohtunut tunnuslause | Palautus on mahdotonta. Luo uusi identiteetti ja kerro yhteyshenkilöillesi uudelleen. |
| Kadonnut laite | Jos sinulla on varmuuskopio, voit palauttaa uudella laitteella. Jos ei, siitä tulee uusi identiteetti. |

Ilmoita vioista [Issue-sivulla](https://github.com/shizukutanaka/Breeze/issues), kiitos.

---

## 13. Breezen lupaukset

- Ei mainoksia. Ei sovelluksessa eikä missään muuallakaan.
- Ei seurantaa. Ei käytön analysointia, ei mainosmekanismeja, ei tietojen myyntiä – ei lainkaan.
- Tekijällä ei ole käyttäjien tietoja. Palvelinpuolella ei ole lainkaan tililuetteloa.
- Keskustelut salataan laitteiden välillä. Palvelin käsittelee vain sinetöityjä kirjekuoria, joita se ei voi lukea.

Yksityiskohtainen vertailu muihin viestisovelluksiin on arkiston "vertailusivulla", mukaan lukien kohdat, joissa Breeze häviää (käyttäjien määrä, se ettei ulkoista tarkastusta ole tehty jne.).

---

*Tämä opas vastaa Breezen tilaa 25.11.2026.*
