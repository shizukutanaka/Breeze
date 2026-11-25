# Oma palvelin -opas (Self-Hosting)

**Lue muilla kielillä**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · Suomi (tämä sivu) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Breeze-välittäjän käyttämiseen on kaksi tapaa:

1. **Oma palvelin (Node + Docker)** — välittäjä omalla koneellasi tai
   VPS:llä: yksi kontti, yksi datavolyymi, rekisteröityminen suljettu
   oletuksena. Aloita tästä, jos välittäjä on sinulle ja omillesi.
2. **Cloudflare** — virallisen tyylinen käyttöönotto Cloudflaren
   ilmaistasolla (välittäjä, jota Breeze itse käyttää). Aloita sieltä, jos haluat
   julkisen välittäjän ilman ylläpidettävää palvelinta.

Molemmat käyttävät identtistä käsittelijäkoodia; välittäjä on tyhmä,
vaihdettavissa oleva postilaatikko kummassakin tapauksessa, ja jokainen asiakas toimii
jokaisen välittäjän kanssa.

## Oma palvelin Dockerilla

```bash
# 1. Get the code
git clone https://github.com/shizukutanaka/Breeze.git && cd Breeze

# 2. Start it, with your own Breeze ID admitted (see "Registration"
#    below for how to find it — you can also start closed-to-everyone
#    and add IDs later)
BREEZE_ALLOWLIST=<your Breeze ID> docker compose up -d

# 3. Watch the first-boot log — it prints your relay identity
#    fingerprint; write it down (see "Relay identity")
docker compose logs breeze
```

Välittäjä palvelee tavallista HTTP:tä portissa 8787 kontin sisällä.
**Päätä TLS käänteisen välityspalvelimen takana sen edessä** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): selaimet käyttävät välittäjää vain
HTTPS/WSS:n yli. Kun teet niin, aseta `TRUST_PROXY: "true"` tiedostossa
`docker-compose.yml`, jotta nopeusrajoitus avautuu todellisen asiakkaan
osoitteeseen — äläkä koskaan aseta sitä ilman tällaista välityspalvelinta, koska otsake,
johon se luottaa, on kenen tahansa väärennettävissä, joka pääsee sisääntuloon suoraan.

Käytä täsmälleen **yhtä** konttia datavolyymia vasten: nopeus-
rajoitin on muistissa prosessia kohden ja jokaisen postilaatikon toiminnot
sarjoitetaan kyseisen prosessin sisällä, joten toinen replika ei säilyttäisi
kumpaakaan ominaisuutta. Skaalaa antamalla yhdelle prosessille isompi kone.

### Rekisteröityminen: suljettu oletuksena

Itse ylläpidetty välittäjä, johon kuka tahansa internetissä voisi rekisteröityä,
loisi uudelleen roskaposti-/väärinkäyttötalouden, jota virallisen välittäjän rajat
on tarkoitettu hallitsemaan, joten **Docker-pakkaus toimitetaan suljettuna**: compose-
tiedosto välittää `REGISTRATION_ALLOWLIST`-listan (mahdollisesti tyhjän), ja
vain sillä olevat Breeze-tunnukset voivat *luoda tilejä* (ensimmäinen prekey-
lataus). Rekisteröitymisen sulkeminen ei koskaan vaikuta ihmisiin, jotka jo asuvat
välittäjällä — heidän latauksensa, talletuksensa, kohtaamisensa ja kyselynsä eivät ole
estettyjä — ja rekisteröitymisen avaaminen on nimenomainen valinta, ei koskaan
oletus.

- **Breeze-tunnuksesi** on 12 merkin tunniste kutsu-
  linkissäsi (sen `pub`-arvon ensimmäiset 12 merkkiä). Kysy jokaiselta henkilöltä,
  jonka kutsut, hänen tunnustaan samalla tavalla — tunnus on julkinen tunniste,
  jota yhteyshenkilöt jo vaihtavat, ei salaisuus.
- **Päästä ihmisiä sisään** listaamalla heidän tunnuksensa: aseta
  `BREEZE_ALLOWLIST=id1,id2,…` kuoreesi tai `.env`-tiedostoon tiedoston
  `docker-compose.yml` viereen, sitten `docker compose up -d` uudelleen.
- **Aloita nyt, päästä sisään myöhemmin**: ilman asetettua `BREEZE_ALLOWLIST`-arvoa
  välittäjä toimii suljettuna kaikilta — käynnistysloki sanoo niin — eikä kukaan
  voi rekisteröityä, ennen kuin lisäät tunnuksia.
- **Avoin välittäjä** (kuka tahansa voi rekisteröityä): poista kommentti
  `REGISTRATION_OPEN: "1"` tiedostossa `docker-compose.yml`. Omistat
  väärinkäyttötalouden, jos teet niin.

### Käyttökiintiö: kytke se pois omalla välittäjälläsi

Worker toimitetaan **oikeudenmukaisen käytön kiintiö** käytössä: per
postilaatikko, enintään 10 000 talletusta/päivä ja 200 000/kuukausi (talletus on
yksi täysi toimitussykli — katso `docs/COST_MODEL.md` §10
käytännöstä ja luvuista). Tämä kehys on olemassa *jaettua oletus-
välittäjää* varten, jota käytetään ilmaisena sisäänkäyntinä, jonka muuttuvat kustannukset
ylläpitäjä muuten kantaisi kaikkien puolesta. **Välittäjällä, jota käytät
itsellesi ja omillesi, kehys on turha — kytke
se pois**:

```bash
USAGE_QUOTA_ENABLED=false
```

Aseta se sinne, mistä välittäjäsi lukee ympäristönsä (kuori tai
`.env` tiedoston `docker-compose.yml` vieressä, Node-prosessin ympäristö
tai Cloudflare Pages -salaisuudet). Kaksi naapurivalitsinta on olemassa, jos
käytät yhteisövälittäjää ja *haluat* kehyksen:
`USAGE_QUOTA_DAILY` ja `USAGE_QUOTA_MONTHLY` säätävät kattoja uudelleen.
Huomioita, joilla on merkitystä:

- Kiintiö pannaan täytäntöön vain, kun postilaatikot asuvat Durable
  Objects -objekteissa (`MAILBOX_BACKEND=do`, tämän isännän oletus); 
  KV-taustalla se on dokumentoitu no-op.
- Katon ylittäneet lähettäjät saavat nimenomaisen `429 USAGE_QUOTA_EXCEEDED`
  (ikkunan ja sen rajan kanssa) hiljaisen pudotuksen sijaan — viesti
  pysyy lähettäjän lähteissä, ja vastaanottaja pysyy
  tavoitettavissa P2P:n yli ja minkä tahansa muun kotivälittäjän kautta.

### Välittäjän identiteetti

Ensimmäisellä käynnistyksellä välittäjä luo pysyvän Ed25519-identiteettiavaimen
*datavolyymin sisällä* ja tulostaa sen sormenjäljen lokiin:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Sormenjälki tunnistaa *sinun* välittäjäsi: anna se käyttäjillesi
kaistan ulkopuolella (henkilökohtaisesti, toista kanavaa pitkin), jotta he voivat tunnistaa
heille annetun välittäjän siksi, jota sinä käytät. Sama sormenjälki
tulostuu joka käynnistyksellä; jos se koskaan muuttuu, datavolyymi
vaihtui — tutki asia, ennen kuin kehotat käyttäjiä luottamaan uuteen.

Asiakkaat varmistavat ja kiinnittävät tämän avaimen automaattisesti (vaihe 2, vaihe 4): 
ensimmäisessä yhteydenotossa asiakas haastaa välittäjän allekirjoittamaan avaimella
(`/api/relay/attest`), tallentaa varmistetun avaimen tilin mukana ja
varmistaa uudelleen jokaisessa myöhemmässä istunnossa. Sormenjälki, jonka asiakas näyttää
(kohdassa `/security` ja ensimmäisen kiinnityksen yhteydessä ponnahdusilmoituksessa) on johdettu
samasta avaimesta — vertaa sitä yllä olevaan käynnistyslokiriviin. Jos avain
koskaan muuttuu, asiakkaat **lakkaavat puhumasta välittäjälle** ja varoittavat
käyttäjää; ne eivät koskaan kiinnitä uudelleen hiljaa. Käsittele sormenjäljen muutosta
rikkovana tapahtumana: sovelluksessa ei ole "luota uuteen avaimeen" -painiketta
vaiheessa 4, joten todellisen volyymimenetyksen jälkeen käyttäjiesi on tyhjennettävä
sovelluksen tallennetut tiedot tililleen ja kiinnitettävä uudelleen ensimmäisessä yhteydenotossa —
ilmoita uusi sormenjälki kaistan ulkopuolella ensin, tai he eivät voi erottaa
uutta avaintasi hyökkääjän avaimesta.

### Varmuuskopiointi ja palautus

**Datavolyymi on koko välittäjän tila**: yksi SQLite-tiedosto,
joka sisältää hakemiston, postilaatikot ja välittäjän identiteettiavaimen.
Mitään muuta ei tarvitse varmuuskopioida.

```bash
# Back up: copy the database out of the (stopped) container
docker compose stop
docker cp "$(docker compose ps -aq breeze)":/data/breeze-relay.db ./breeze-relay-backup.db
docker compose start

# Restore: copy the backup back in as /data/breeze-relay.db before
# starting, and the relay serves identically — same fingerprint.
docker compose stop
docker cp ./breeze-relay-backup.db "$(docker compose ps -aq breeze)":/data/breeze-relay.db
docker compose start
```

### Päivittäminen

```bash
git pull origin main
docker compose up -d --build
```

Tila asuu volyymissa, ei imagessa, joten päivittäminen ei koskaan koske
käyttäjiesi tietoja.

## Oma palvelin paljaalla Nodella (ei Dockeria)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Määritys on vain ympäristömuuttujia — `server/README.md`
luettelee ne kaikki. Kaksi eroa Docker-polkuun:

- **Datatiedosto** on oletuksena `./breeze-relay.db` (ohita arvolla
  `BREEZE_DB_PATH`); se on sama yhden tiedoston tila, välittäjän identiteetti
  mukaan lukien. Varmuuskopioi se samalla tavalla: pysäytä, kopioi, käynnistä uudelleen.
- **Rekisteröityminen on avoin, ellet sulje sitä**: suljettu oletus
  on Docker-pakkauksen ominaisuus. Sulkeaksesi paljaan sisääntulon, aseta
  `REGISTRATION_ALLOWLIST=id1,id2` (tai tyhjä arvo
  suljettu-kaikilta); `REGISTRATION_OPEN=1` avaa sen uudelleen nimenomaisesti.

## Cloudflare-käyttöönotto

### Vähimmäiskäyttöönotto ($0/kuukausi, 5 minuuttia)

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Deploy
wrangler pages deploy . --project-name=breeze

# 4. Create a KV namespace and declare it in wrangler.toml
wrangler kv:namespace create KV
# Copy the new namespace's ID and put it in wrangler.toml, replacing the
# id in the [[kv_namespaces]] section (binding = "KV"). Pages takes its
# bindings from wrangler.toml; a binding set only in the Dashboard is
# NOT applied while a wrangler.toml exists.
# Then deploy again so the binding takes effect:
wrangler pages deploy . --project-name=breeze

# 5. Visit your deployment's URL (https://<your-project>.pages.dev)
```

**Siinä kaikki.** Kaikki ominaisuudet toimivat paitsi push-ilmoitukset. Huomaa,
että rekisteröityminen Cloudflare-käyttöönotossa on **avoin**, ellet
aseta `REGISTRATION_ALLOWLIST`-arvoa itse (katso `.env.example`); 
suljettu-oletuksena-pakkaus on yllä oleva Docker-polku.

### Mikä toimii $0:lla

| Ominaisuus | Tila | Huomautukset |
|---------|--------|-------|
| E2E-salattu keskustelu | ✓ | Täysi Double Ratchet |
| P2P-viestit | ✓ | WebRTC DataChannel |
| Ääni-/videopuhelut | ✓ | WebRTC + ilmainen STUN |
| TURN-välittäjä | ✓ | Open Relay (20GB/kuukausi ilmaiseksi) |
| Ryhmät (1 000 jäsentä) | ✓ | Sender Key O(1) |
| Tiedostonsiirto | ✓ | Enintään 50MB P2P:n kautta |
| 51 kieltä | ✓ | Englanti sisäänrakennettuna + 50 täyttä lokaalitiedostoa, tunnistetaan automaattisesti |
| Offline/PWA | ✓ | Service Worker |
| Push-ilmoitukset | ✗ | Vaatii VAPID-avaimet |

Usean tilin laskutus (Lite/Plus/Pro) ei ole saatavilla — katso
[SECURITY.md](../../SECURITY.md)-tiedoston osio "Removed: multi-account billing". Jokainen tili saa
rajoittamattomat paikalliset alatilat ilmaiseksi ilman suunnitelmarajoitusta.

### Ilmaistason rajat

| Resurssi | Ilmaistaso | Käyttö aktiivista käyttäjää kohden |
|----------|-----------|----------------------|
| Worker-pyynnöt | 100 000/päivä | ~500/päivä (kysely + signalointi) |
| KV-luvut | 100 000/päivä | ~200/päivä |
| KV-kirjoitukset | 1 000/päivä | ~350/päivä (optimoitu) |
| KV-tallennus | 1 GB | ~10 KB/käyttäjä |
| Staattiset resurssit | Rajoittamaton | ~894 KB (yksi HTML) |

**Tukee ~3 samanaikaista aktiivista käyttäjää ilmaistasolla.**

### Valinnaisten ominaisuuksien lisääminen

#### Push-ilmoitukset (ilmaiseksi)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN-palvelin (rajoittaviin verkkoihin)

TURN on tapa, jolla puhelut ja vain-välittäjä- (IP:n piilottavat) yhteydet ylittävät
rajoittavat NAT:t. Minkä TURN:n välittäjäsi jakaa, on **sinun** valintasi
ylläpitäjänä — Worker yrittää järjestyksessä:

```bash
# Option A: Cloudflare Calls ($0.05/GB, global anycast)
wrangler pages secret put TURN_KEY_ID
wrangler pages secret put TURN_KEY_API_TOKEN

# Option B: your own coturn (HMAC time-limited credentials — the Worker
# mints a 24h username/credential per registered user from the secret)
#   coturn: use-auth-secret, static-auth-secret=<same secret>
wrangler pages secret put TURN_URL      # turn:your-server:3478
wrangler pages secret put TURN_SECRET

# Option C: static credentials (metered.ca, Twilio, …)
wrangler pages secret put TURN_URL
wrangler pages secret put TURN_USERNAME
wrangler pages secret put TURN_CREDENTIAL

# Option D: No config → free Open Relay (20GB/month). This is a third
# party's PUBLIC quota, shared with every unconfigured relay — fine for
# a first run, not a foundation. Opt out explicitly and callers get
# STUN only (some restrictive-NAT calls will then fail, visibly):
wrangler pages secret put TURN_OPENRELAY_FALLBACK   # set to: false
```

**Varmista, mitä todella määritit:** `GET /api/health` raportoi
tehollisen tilan arvona `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Vanhempi `turn`-totuusarvo heijastaa vain
`TURN_URL`-arvoa, joten se näyttää `false` suositellulle vaihtoehdolle A — käytä
`turnProvider`-arvoa. Asiakkaat näyttävät saman tarjoajan kohdassa `/security`, joten
Open Relay -varalla oleva käyttäjä näkee, että kolmas osapuoli välittää hänen
puhelumediaansa (vain metatiedot — media itse on DTLS-SRTP-salattua).

#### Todennuksen koventaminen ja tavallinen välittäjäpolku

Prekey-lataukset säilyttävät nyt allekirjoitusomistajuuden erikseen kohdassa
`prekey-owner:<userId>` **ilman TTL:ää**. Olemassa oleva pakettiomistajuus siirtyy laiskasti
seuraavassa latauksessa, ennen kuin korvaava hyväksytään. Uudet Ed25519-paketit myös
luovat kyseisen tietueen. Säilytä nämä tietueet, kun karsit vanhentuneita prekey-paketteja:
paketin vanhenemisen odottaminen ei saa sallia uutta omistajaa. Kierto vaatii
edellisen omistajan allekirjoittaman latauksen, joka sitoo uuden avaimen olemassa olevaan lataus-
tiivisteeseen. Todennuksella varustettu `/account/delete` poistaa molemmat tietueet ja voi todentaa
omistajaa vasten myös paketin vanhenemisen jälkeen. Kadonneen omistaja-avaimen palautusta ei ole.

Tileillä, joilla tämä tietue on, latauksen ja viesti-/sinetöidyn kyselyn, sinetöidyn ACK:n ja
postilaatikon WebSocket-todisteiden on käytettävä pysyvää omistajaa. **Allekirjoittamattomat pyynnöt hylätään
myös arvoilla `PREKEY_REQUIRE_AUTH=false` tai `QUEUE_REQUIRE_AUTH=false`.**
Nämä liput säilyttävät olemassa olevat oletuksensa ja vanhan semantiikkansa tileillä
ilman omistajaa; nimenomainen `false`-hyväksyntä allekirjoittamattomille lataus-/jonopyynnöille
kirjaa sisältövapaan vanhentumisvaroituksen. Muut todennusliput ovat muuttumattomia.
Postilaatikon WebSocketit vaativat edelleen allekirjoituksia kaikilta.

Asiakas odottaa allekirjoituksen alustusta ennen jonotoimintaa, mukaan lukien
palaavan tilin käynnistys, johtajan ylennys ja uudelleenyhteys. Jaettu odotus on
rajattu viiteen sekuntiin. Tukemattomat suoritusympäristöt jatkavat allekirjoittamattomina välittömästi;
juuttunut IDB/avaimen purku jatkaa allekirjoittamattomana rajan jälkeen ja allekirjoittaa sitten, kun on valmis.
Tämä pitää kyselysilmukan elossa, **ei** ohituksena: omistajan tukemat tilit eivät voi
vastaanottaa välittäjältä, ennen kuin niiden allekirjoitusavain on käyttökelpoinen. Ota käyttöön päivitetyt asiakas-
resurssit yhdessä Workerin kanssa välttääksesi vanhan käynnistyskilpailun.

Siirto ei voi palauttaa omistajuutta paketista, joka vanheni **ennen** kuin sen
omistaja säilytettiin. Ensimmäinen rekisteröityminen pysyy TOFU:na. Omistajuustietueet käyttävät
olemassa olevaa KV-taustaa: tapahtumallista johdonmukaisuutta ja samanaikaisia kirjoituksia ei tehdä
linearisoitaviksi tällä muutoksella. Todisteet säilyttävät olemassa olevan viiden minuutin tuoreus-
ikkunan ja toiminto-/kuormasidonnaisuuden; identtiset uusintayritykset ikkunan sisällä eivät ole
kertakäyttöinen nonce-protokolla.

Läsnäolokirjoitukset ja TURN-tunnistetietojen myöntäminen vaativat jo *rekisteröidyn*
tilin (prekey-paketti läsnä) oletuksena, ja jokainen asiakas rekisteröityy
automaattisesti. Läsnäolon sydämenlyönnit kantavat lisäksi Ed25519-omistajuustodisteen
(sydämenlyönti allekirjoittaa tallentamansa kentät), jonka Worker varmistaa
aina, kun sellainen esitetään — `PRESENCE_SIGN_REQUIRE_AUTH=true` tekee kyseisen
todisteen pakolliseksi. Loput Ed25519-allekirjoitusliput pysyvät opt-in-valintoina;
`wrangler.toml` dokumentoi jokaisen ja miksi (asiakkaat suoritusympäristöissä ilman
WebCrypto Ed25519:ää eivät voi allekirjoittaa lainkaan).

Vanha tavallinen välittäjäpolku (`/api/msg/send`, `/api/msg/poll`) on vanhentunut: sen
vastaukset kantavat `Deprecation: true` -otsaketta, ja sinetöity polku on
oletusreitti jokaiselle nykyiselle asiakkaalle. Kun olet varmistanut, ettei yksikään elävä
asiakas enää tarvitse varaa, kytke se pois kokonaan:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Oma verkkotunnus

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Skaalaus ilmaistason yli

Kun kasvat ulos ilmaistasosta ($5/kuukausi Workers Paid -suunnitelma):

| Resurssi | Maksullinen suunnitelma |
|----------|-----------|
| Worker-pyynnöt | 10 miljoonaa/kuukausi |
| KV-kirjoitukset | 1 miljoona/kuukausi |
| KV-tallennus | 1 GB sisältyy |
| CPU-aika | 30 sekuntia/pyyntö |

Tämä tukee **tuhansia samanaikaisia käyttäjiä**.

### Päivittäminen

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Ei koontivaihetta. Ei asennettavia riippuvuuksia. Ota vain käyttöön.
