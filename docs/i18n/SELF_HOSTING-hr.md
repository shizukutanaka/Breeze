# Vodič za vlastito hostanje

**Pročitajte na drugom jeziku / Read in another language**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · Hrvatski (ova stranica)


Postoje dva načina da se pokrene Breeze relej:

1. **Vlastito hostanje (Node + Docker)** — relej na vašem stroju ili
   VPS-u: jedan spremnik, jedan volumen podataka, registracija je
   zadano zatvorena. Počnite ovdje ako je relej za vas i vaše ljude.
2. **Cloudflare** — postavljanje u službenom stilu na besplatnom planu
   Cloudflarea (relej koji sam Breeze pokreće). Počnite ondje ako želite
   javni relej bez poslužitelja koji treba održavati.

Oba pokreću identičan kod rukovatelja; relej je u oba slučaja jednostavan,
zamjenjiv poštanski spremnik, a svaki klijent radi sa svakim relejem.

## Vlastito hostanje s Dockerom

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

Relej poslužuje običan HTTP na portu 8787 unutar spremnika.
**Završite TLS na obrnutom proxyju ispred njega** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): preglednici će relej koristiti samo
preko HTTPS/WSS. Kad to učinite, postavite `TRUST_PROXY: "true"` u
`docker-compose.yml` tako da ograničavanje brzine ključa po stvarnoj adresi
klijenta — i nikada to ne postavljajte bez takvog proxyja, jer zaglavlje
kojem vjeruje može krivotvoriti svatko tko može izravno doći do ulaza.

Pokrenite točno **jedan** spremnik na volumen podataka: ograničivač
brzine u memoriji je po procesu i operacije svakog poštanskog spremnika
serijalizirane su unutar tog procesa, pa druga replika ne bi imala
nijedno od tih svojstava. Skalirajte tako da tom jednom procesu
date veći stroj.

### Registracija: zadano zatvorena

Vlastito hostani relej na kojem bi se svatko s interneta mogao
registrirati ponovno bi stvorio ekonomiju neželjene pošte/zloporabe koju
granice službenog releja postoje da kontroliraju, pa se **Docker
pakiranje isporučuje zatvoreno**: datoteka compose prosljeđuje `REGISTRATION_ALLOWLIST`
(može biti prazan) i samo Breeze ID-ovi na njemu mogu *stvarati račune*
(prvo učitavanje prekeya). Zatvaranje registracije nikada ne utječe na ljude
koji su već smješteni na releju — njihova učitavanja, depoziti, sastanci i
upiti nisu ograđeni — a otvaranje registracije izričit je izbor, nikada
zadano.

- **Vaš Breeze ID** identifikator je od 12 znakova u vašoj poveznici pozivnice
  (prvih 12 znakova njezine `pub` vrijednosti). Od svake osobe koju pozovete
  zatražite njezin na isti način — ID je javni identifikator koji kontakti
  već razmjenjuju, nije tajna.
- **Primite ljude** tako da navedete njihove ID-ove: postavite
  `BREEZE_ALLOWLIST=id1,id2,…` u svojoj ljusci ili `.env` datoteci pokraj
  `docker-compose.yml`, zatim ponovno `docker compose up -d`.
- **Počnite sada, primite kasnije**: bez postavljenog `BREEZE_ALLOWLIST`-a,
  relej radi zatvoren za sve — zapisnik pokretanja to kaže — i nitko se ne može
  registrirati dok ne dodate ID-ove.
- **Otvoreni relej** (svatko se može registrirati): otkomentirajte
  `REGISTRATION_OPEN: "1"` u `docker-compose.yml`. Ako to učinite, ekonomija
  zloporabe je vaša.

### Kvota korištenja: isključite je na svom releju

Radnik se isporučuje s omogućenim **kvotom poštenog korištenja**: po
poštanskom spremniku, najviše 10.000 depozita dnevno i 200.000 mjesečno
(depozit je jedan potpun ciklus dostave — vidjeti `docs/COST_MODEL.md`
§10 za politiku i brojeve). Taj okvir postoji za *zajednički zadani
relej*, koji se pokreće kao besplatni ulaz čije bi promjenjive troškove
operater inače snosio za sve. **Na releju koji pokrećete za sebe i svoje
ljude, okvir je besmislen — isključite ga**:

```bash
USAGE_QUOTA_ENABLED=false
```

Postavite ga gdje god vaš relej čita svoje okruženje (ljuska ili
`.env` pokraj `docker-compose.yml`, okruženje Node procesa,
ili tajne Cloudflare Pagesa). Postoje dva susjedna gumba ako
pokrećete relej zajednice i *želite* okvir:
`USAGE_QUOTA_DAILY` i `USAGE_QUOTA_MONTHLY` ponovno podešavaju granice.
Napomene koje su važne:

- Kvota se primjenjuje samo kad poštanski spremnici žive u Durable
  Objects (`MAILBOX_BACKEND=do`, zadano na ovom hostu); na
  KV pozadini to je dokumentirana operacija bez učinka.
- Preko granice, pošiljatelji dobivaju izričit `429 USAGE_QUOTA_EXCEEDED`
  (s prozorom i njegovom granicom) umjesto tihog odbacivanja — poruka
  ostaje u odlaznom spremniku pošiljatelja, a primatelj ostaje dostupan
  preko P2P i preko bilo kojeg drugog kućnog releja.

### Identitet releja

Pri prvom pokretanju relej generira trajni Ed25519 ključ identiteta
*unutar volumena podataka* i ispisuje njegov otisak u zapisniku:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Otisak identificira *vaš* relej: dajte ga svojim korisnicima
izvan kanala (osobno, preko drugog kanala) kako bi mogli prepoznati
relej koji im je predan kao onaj koji vi pokrećete. Isti se otisak
ispisuje pri svakom pokretanju; ako se ikada promijeni, volumen podataka
je zamijenjen — istražite prije nego što korisnicima kažete da vjeruju novom.

Klijenti automatski provjeravaju i pričvršćuju ovaj ključ (faza 2, korak 4):
pri prvom kontaktu klijent izaziva relej da potpiše ključem
(`/api/relay/attest`), pohranjuje provjereni ključ uz račun i ponovno provjerava
pri svakoj kasnijoj sesiji. Otisak koji klijent prikazuje
(pod `/security`, i u toastu pri prvom pričvršćivanju) izveden je iz
istog ključa — usporedite ga s gornjom linijom zapisnika pokretanja. Ako se
ključ ikada promijeni, klijenti **prestaju razgovarati s relejem** i
upozoravaju korisnika; nikada se ponovno ne pričvršćuju tiho. Promjenu
otiska tretirajte kao prijelomni događaj: u koraku 4 nema gumba u
aplikaciji «vjeruj novom ključu», pa nakon stvarnog gubitka volumena vaši
korisnici moraju obrisati pohranjene podatke aplikacije za svoj račun i
ponovno se pričvrstiti pri prvom kontaktu — prvo objavite novi otisak izvan
kanala, inače ne mogu razlikovati vaš novi ključ od ključa napadača.

### Sigurnosna kopija i oporavak

**Volumen podataka cijelo je stanje releja**: jedna SQLite datoteka koja
drži imenik, poštanske spremnike i ključ identiteta releja.
Nema ničeg drugog za sigurnosnu kopiju.

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

### Ažuriranje

```bash
git pull origin main
docker compose up -d --build
```

Stanje živi u volumenu, a ne u slici, pa ažuriranje nikada ne dira
podatke vaših korisnika.

## Vlastito hostanje s golim Nodeom (bez Dockera)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfiguracija su samo varijable okruženja — `server/README.md`
ih sve navodi. Dvije razlike u odnosu na Docker put:

- **Datoteka podataka** zadano je `./breeze-relay.db` (premostite
  s `BREEZE_DB_PATH`); to je isto stanje u jednoj datoteci, uključujući
  identitet releja. Napravite joj sigurnosnu kopiju na isti način:
  zaustavite, kopirajte, ponovno pokrenite.
- **Registracija je otvorena ako je ne zatvorite**: zatvoreno
  zadano svojstvo je Docker pakiranja. Da biste zatvorili goli
  ulaz, postavite `REGISTRATION_ALLOWLIST=id1,id2` (ili praznu vrijednost
  za zatvoreno za sve); `REGISTRATION_OPEN=1` izričito ponovno otvara.

## Postavljanje na Cloudflare

### Minimalno postavljanje (0 dolara mjesečno, 5 minuta)

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

**To je to.** Sve funkcije rade osim push obavijesti. Imajte na umu
da je registracija na Cloudflare postavljanju **otvorena** ako sami ne
postavite `REGISTRATION_ALLOWLIST` (vidjeti `.env.example`); pakiranje
zatvoreno zadano Docker je put iznad.

### Što radi za 0 dolara

| Funkcija | Status | Napomene |
|---------|--------|-------|
| E2E šifrirani chat | ✓ | Potpun Double Ratchet |
| P2P razmjena poruka | ✓ | WebRTC DataChannel |
| Glasovni/video pozivi | ✓ | WebRTC + besplatan STUN |
| TURN relej | ✓ | Open Relay (20GB mjesečno besplatno) |
| Grupe (1,000 članova) | ✓ | Sender Key O(1) |
| Prijenos datoteka | ✓ | Do 50MB preko P2P |
| 51 jezik | ✓ | Engleski ugrađen + 50 potpunih datoteka jezika, automatski otkriveno |
| Izvanmrežno/PWA | ✓ | Service Worker |
| Push obavijesti | ✗ | Potrebni su VAPID ključevi |

Naplata za više računa (Lite/Plus/Pro) nije dostupna — vidjeti
odjeljak «Removed: multi-account billing» u [SECURITY.md](../../SECURITY.md). Svaki račun dobiva
neograničene besplatne lokalne podračune bez ograničenja plana.

### Granice besplatnog plana

| Resurs | Besplatni plan | Korištenje po aktivnom korisniku |
|----------|-----------|----------------------|
| Zahtjevi Workera | 100.000 dnevno | ~500 dnevno (upiti + signalizacija) |
| KV čitanja | 100.000 dnevno | ~200 dnevno |
| KV pisanja | 1.000 dnevno | ~350 dnevno (optimizirano) |
| KV pohrana | 1 GB | ~10 KB po korisniku |
| Statički resursi | Neograničeno | ~894 KB (jedan HTML) |

**Podržava ~3 istodobno aktivna korisnika na besplatnom planu.**

### Dodavanje neobaveznih funkcija

#### Push obavijesti (besplatno)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN poslužitelj (za restriktivne mreže)

TURN je način na koji pozivi i veze samo preko releja (sa skrivanjem IP-a)
prolaze kroz restriktivne NAT-ove. Koji TURN vaš relej daje vaš je
izbor kao operatera — Worker pokušava, po redu:

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

**Provjerite što ste zapravo konfigurirali:** `GET /api/health` izvještava
stvarni način kao `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Stariji `turn` boolean odražava samo
`TURN_URL`, pa se za preporučenu opciju A čita kao `false` — koristite
`turnProvider`. Klijenti prikazuju istog davatelja u `/security`, pa
korisnik na Open Relay rezervi može vidjeti da treća strana prenosi
medije njegovih poziva (samo metapodaci — sam medij šifriran je
DTLS-SRTP-om).

#### Jačanje autentifikacije i put običnog releja

Učitavanja prekeya sada čuvaju vlasništvo potpisa odvojeno na
`prekey-owner:<userId>` **bez TTL-a**. Vlasništvo postojećeg paketa
lijeno se migrira pri sljedećem učitavanju, prije nego što se zamjena prihvati.
Novi Ed25519 paketi također uspostavljaju taj zapis. Zadržite te zapise
kad čistite istekle prekey pakete: čekanje isteka paketa ne smije dopustiti
novog vlasnika. Rotacija zahtijeva učitavanje koje je potpisao prethodni
vlasnik, vezujući novi ključ u postojeći sažetak učitavanja. Autentificirano
`/account/delete` briše oba zapisa i može se autentificirati prema
vlasniku čak i nakon isteka paketa. Ne postoji resetiranje izgubljenog
ključa vlasnika.

Za račune s tim zapisom, učitavanje i upiti za poruke/zapečaćene, zapečaćeni ACK i
WebSocket dokazi poštanskog spremnika moraju koristiti trajnog vlasnika. **Nepotpisani zahtjevi
odbijaju se čak i s `PREKEY_REQUIRE_AUTH=false` ili `QUEUE_REQUIRE_AUTH=false`.**
Te zastave zadržavaju postojeće zadane vrijednosti i staru semantiku za račune
bez vlasnika; izričito `false` prihvaćanje nepotpisanih zahtjeva za učitavanje/red
zapisuje upozorenje o zastarijevanju bez sadržaja. Ostale zastave autentifikacije nepromijenjene su.
WebSocketi poštanskog spremnika i dalje zahtijevaju potpise za sve.

Klijent čeka inicijalizaciju potpisivanja prije aktivnosti reda, uključujući
pokretanje računa koji se vraća, unapređenje vođe i ponovno povezivanje. Zajedničko čekanje
ograničeno je na pet sekundi. Nepodržana okruženja za izvršavanje odmah nastavljaju nepotpisano;
zaglavljeno IDB/odmotavanje ključa nastavlja nepotpisano nakon granice, zatim potpisuje kad je spremno.
To održava petlju upita u životu, **nije** zaobilaženje: računi s vlasnikom ne mogu
primati s releja dok njihov ključ za potpisivanje ne bude uporabljiv. Postavite ažurirane klijentske
resurse zajedno s Workerom da biste izbjegli staru utrku pri pokretanju.

Migracija ne može oporaviti vlasništvo iz paketa koji je istekao **prije** nego što je njegov
vlasnik sačuvan. Prva registracija ostaje TOFU. Zapisi vlasništva koriste
postojeću KV pozadinu: eventualna konzistentnost i istodobna pisanja ne čine se
linearizirajućima ovom promjenom. Dokazi zadržavaju postojeći prozor svježine od pet minuta
i vezivanje operacije/tereta; identična ponavljanja unutar prozora nisu
protokol jednokratnog noncea.

Pisanja prisutnosti i izdavanje TURN vjerodajnica već zahtijevaju *registrirani*
račun (prisutan prekey paket) zadano, a svaki se klijent registrira
automatski. Otkucaji prisutnosti dodatno nose Ed25519 dokaz vlasništva
(otkucaj potpisuje polja koja pohranjuje), koji Worker provjerava
kad god se jedan predstavi — `PRESENCE_SIGN_REQUIRE_AUTH=true` čini taj
dokaz obaveznim. Ostale zastave Ed25519 potpisa ostaju neobavezne;
`wrangler.toml` dokumentira svaku i zašto (klijenti na okruženjima bez
WebCrypto Ed25519 uopće ne mogu potpisivati).

Zastarjeli obični relej (`/api/msg/send`, `/api/msg/poll`) zastario je: njegovi
odgovori nose zaglavlje `Deprecation: true`, a zapečaćeni put je
zadana ruta za svakog trenutačnog klijenta. Kad potvrdite da nijedan živi
klijent više ne treba rezervu, onemogućite ga u potpunosti:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Vlastita domena

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Skaliranje izvan besplatnog plana

Kad prerastete besplatni plan (Workers Paid plan od 5 dolara mjesečno):

| Resurs | Plaćeni plan |
|----------|-----------|
| Zahtjevi Workera | 10 milijuna mjesečno |
| KV pisanja | 1 milijun mjesečno |
| KV pohrana | 1 GB uključeno |
| CPU vrijeme | 30 sekundi po zahtjevu |

To podržava **tisuće istodobnih korisnika**.

### Ažuriranje

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Bez koraka izgradnje. Bez ovisnosti za instaliranje. Samo postavite.
