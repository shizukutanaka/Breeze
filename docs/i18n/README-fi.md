# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Lue muilla kielillä**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · Suomi (tämä sivu) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Salattu viestisovellus, joka ei vaadi puhelinnumeroa eikä rekisteröitymistä.**
Keskustelun sisällön voivat lukea vain sen lähettäjä ja vastaanottaja. Edes sitä kuljettava palvelin ei voi lukea sitä.
Kaikki toiminnot ovat ilmaisia, eikä mainoksia ole.

Tämä ei ole verkkosivu, vaan ohjelmisto, jonka asennat ja jota käytät (Windows / Mac / Linux / Android / iPhone / selain).

![Breeze Messengerin kuvakaappaus — päänäkymä heti identiteetin luomisen jälkeen](../images/screenshot.png)

## Käyttöä varten sijoitat sen omalle palvelimellesi

Breezellä ei ole "ylläpitäjäyrityksen palvelinta". **Käyttääksesi sitä hankit itse sijoituspaikan (palvelimen) ja sijoitat Breezen sinne. Se on virallinen käyttötapa.**

- Sijoituspaikka mahtuu ilmaistasoon. Se toimii Cloudflaren ilmaistasolla, eikä luottokorttia tarvita. Ohjeet ovat [asennusoppaassa](SELF_HOSTING-fi.md) (muunkieliset versiot voi valita oppaan alusta).
- Hae sovellus (Windows / Mac / Linux / Android / iPhone) [lataussivulta](https://github.com/shizukutanaka/Breeze/releases/latest) ja käytä sitä yhdistettynä omaan palvelimeesi.
- **Esimerkkiasennuksesta (rehellinen huomautus)**: Toiminnan tarkistamista varten on esimerkki (https://breeze-469.pages.dev/). Se on sama ohjelmisto, mutta käytä todelliseen käyttöön omaa palvelintasi. Esimerkki voi muuttua tai pysähtyä ilman ennakkoilmoitusta. Omalle palvelimellesi sijoittamaasi Breezeen esimerkin pysähtyminen ei vaikuta.

Yksityiskohtaiset käyttöohjeet ovat [käyttöoppaassa](MANUAL-fi.md) (muunkieliset versiot voi valita oppaan alusta).

## Käyttötapa (3 vaihetta)

1. Avaa omalle palvelimellesi sijoittamasi Breeze (tai osoite, jonka sen sijoittanut henkilö on sinulle kertonut), ja syötä nimesi. Siinä kaikki – olet valmis (rekisteröitymistä tai puhelinnumeroa ei tarvita). Tällöin laitteesi sisällä luodaan "avain", ja se on identiteettisi.
2. Anna tunnuksesi tai QR-koodisi henkilölle, jonka kanssa haluat keskustella.
3. Jos myös toisella henkilöllä on sovellus auki, voitte yhdistyä suoraan ja keskustella. Jos hänellä ei ole sitä auki, viesti asetetaan edelleen salattuna "postilaatikkoon" ja toimitetaan, kun hän avaa sovelluksen. Postilaatikkoa kuljettava palvelin ei voi lukea sisältöä. Kirjeet, joita ei koskaan toimiteta, poistetaan automaattisesti viimeistään 7 päivän kuluttua.

## Lupaukset (mitä emme tee)

- **Ei mainoksia.** Ei sovelluksessa eikä missään muuallakaan.
- **Ei seurantaa.** Ei käytön analysointia, ei mainosmekanismeja, ei tietojen myyntiä – ei lainkaan.
- **Tekijällä ei ole käyttäjien tietoja.** Palvelinpuolella ei ole lainkaan tililuetteloa. Identiteettisi on vain laitteesi sisällä oleva avain.
- **Keskustelut salataan laitteiden välillä.** Palvelin käsittelee vain sinetöityjä kirjekuoria, joita se ei voi lukea.

Kirjoitamme rehellisesti myös rajoista. Viestien toimittamiseksi palvelimella on lyhytaikaista säilytystä (toimittamattomat kirjekuoret enintään 7 päivää, yhteyssignaalit 5 minuuttia, osoite- ja laitetiedot 90 päivää, ryhmätiedot ja ilmoitustilaukset 30 päivää. Kaikki poistetaan automaattisesti, eikä sisältöä voi lukea). Pilvivarmuuskopiointi on aluksi pois käytöstä. Jos sijoitat Breezen omalle palvelimellesi, myös tämä säilytys on omassa hallinnassasi.

## Ominaisuudet

- Kahdenkeskiset keskustelut ja ryhmäkeskustelut (enintään 1 000 henkilöä)
- Ääni- ja videopuhelut (ryhmäpuhelut enintään 8 henkilölle)
- Tiedostojen lähetys (kahdenkeskisissä keskusteluissa enintään 50MB. Myös ryhmissä voi lähettää, mutta kokoraja on pienempi)
- Useiden laitteiden ja useiden tilien käyttö eri tarkoituksiin (esimerkiksi työ ja yksityinen. Sekä laitteiden että tilien määrä on ilmainen ja rajoittamaton)
- 51 kieltä (englanti ja 50 kielitiedostoa), valitaan automaattisesti laitteesi kielen mukaan
- Profiilit kuvalla, tarrat, sijainnin jakaminen
- Komennot, kuten `/help` (71 tyyppiä)
- Virtatilat akun mukaan (automaattinen / normaali / virransäästö / hätätila). Kun akku vähenee, toimitustarkistuksia harvennetaan, jotta akku kestää pidempään. Turva katastrofeihin ja muihin tilanteisiin, joissa lataaminen ei ole mahdollista
- Helppolukuiset näytöt (huomio värikontrastiin, tekstin kokoon ja käyttöön pelkällä näppäimistöllä)

## Erot muihin viestisovelluksiin

| | Breeze | Useimmat viestisovellukset |
|---|--------|--------|
| Rekisteröityminen | Ei tarvita (identiteetti on laitteessasi oleva avain) | Puhelinnumero vaaditaan |
| Palvelin | Ei voi lukea sisältöä | Edellyttää, että luotat ylläpitäjäyritykseen |
| Sijoittaminen omalle palvelimelle | Edellytys (asia, jonka sijoitat ja jota käytät) | Ei mahdollista |
| Lähdekoodin avoimuus | Kaikki on avointa (MIT-lisenssi) | Usein suljettu |
| Tietojen sijainti | Laitteessasi | Ylläpitäjäyrityksen palvelimilla |

Yksityiskohtainen vertailu Signaliin ja LINEen on [vertailusivulla (englanniksi)](../COMPARISON.md). Jokaisen Breezen väitteen yhteydessä on "näin voit tarkistaa sen" -menetelmä, eikä kohtia, joissa Breeze häviää (käyttäjien määrä, se ettei ulkoista tarkastusta ole tehty jne.), piiloteta.

## Oman palvelimen kustannukset

Breeze toimii Cloudflaren ilmaistasolla. Luottokorttia ei tarvita.

| Kohde | Ilmaistaso | Maksullisena |
|-----------|-----------|-------------|
| Sijoituspaikka | Cloudflare Pages (ilmainen) | — |
| Käsittely | Enintään 100 000 kertaa päivässä | Enintään 10 miljoonaa kertaa kuukaudessa |
| Tallennus | Päivässä: luku 100 000, kirjoitus 1 000 | Kuukaudessa: luku 10 miljoonaa, kirjoitus 1 miljoona |
| Puhelujen välitys | Ilmainen 20GB:hen asti | 0,05 dollaria per GB |
| Oma verkkotunnus | Ei tarvita (ilmainen osoite tulee mukana) | 10 dollaria vuodessa |
| **Yhteensä** | **0 dollaria kuukaudessa** (kevyellä käytöllä noin 20–40 henkilöön asti) | **Alkaen 5 dollaria kuukaudessa** (kevyellä käytöllä noin 100 henkilön mittakaava. 1 000 henkilön mittakaavassa 34–222 dollaria kuukaudessa käytöstä riippuen) |

Miten kustannukset kasvavat suuressa mittakaavassa ja "miksi yhden ylläpitäjän ei tarvitse kantaa koko kustannusta", selitetään [kustannus- ja kestävyysajattelussa (englanniksi)](../SUSTAINABILITY.md), ja sen taustalla olevat laskelmat ovat [kustannusmallissa (englanniksi)](../COST_MODEL.md).

Asennus alkaa tällä yhdellä komennolla (yksityiskohdat [asennusoppaassa](SELF_HOSTING-fi.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Tekniset yksityiskohdat (kehittäjille)

### Salausmenetelmät

| Rooli | Menetelmä |
|-------|-----------|
| Avaintenvaihto | X25519 (vara: P-256) |
| Allekirjoitus | Ed25519 (vara: HMAC-SHA256) |
| Salaus | AES-256-GCM |
| Avainten johtaminen | HKDF-SHA256 |
| Keskusteluavainten uusiminen | Double Ratchet (sama menetelmä kuin Signalissa) |
| Ryhmäavaimet | Sender Key |
| Lähettäjän piilottaminen välittäjältä | Sealed Sender |

Suunnittelun auktoriteetti on [määrittely SPEC.md](../../SPEC.md), ja heikkouksien ilmoituspaikka ja käytäntö ovat [SECURITY.md](../../SECURITY.md) -tiedostossa.

### Testit ja laaduntarkistukset

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Osallistuminen kehitykseen

Menettelyt ja säännöt ovat [CONTRIBUTING.md](../../CONTRIBUTING.md) -tiedostossa.
Ilmoita vioista [Issue-sivulla](https://github.com/shizukutanaka/Breeze/issues). Käytössäännöt ovat [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) -tiedostossa.

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Lisenssi

MIT — kuten [LICENSE](../../LICENSE) -tiedostossa todetaan, voit käyttää, muokata ja jakaa sitä vapaasti.
