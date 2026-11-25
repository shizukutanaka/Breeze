# Veiledning for egen drift (Self-Hosting)

**Les på andre språk**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · Norsk (denne siden) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Det finnes to måter å kjøre et Breeze-relé på:

1. **Egen drift (Node + Docker)** — releet på din egen maskin eller
   VPS: én container, ett datavolum, registrering stengt som
   standard. Start her hvis releet er for deg og dine folk.
2. **Cloudflare** — distribusjonen i offisiell stil på Cloudflares
   gratisnivå (releet Breeze selv kjører). Start der hvis du vil ha
   et offentlig relé uten en server å vedlikeholde.

Begge kjører identisk håndtererkode; et relé er en dum,
utskiftbar postboks uansett, og hver klient fungerer med
hvert relé.

## Egen drift med Docker

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

Releet serverer ren HTTP på port 8787 inne i containeren.
**Avslutt TLS ved en omvendt proxy foran den** (Caddy, nginx,
Traefik, en Cloudflare Tunnel, …): nettlesere vil bare bruke et relé
over HTTPS/WSS. Når du gjør det, sett `TRUST_PROXY: "true"` i
`docker-compose.yml` slik at hastighetsbegrensningen nøkler seg på den virkelige klient-
adressen — og sett det aldri uten en slik proxy, fordi headeren
den stoler på, kan forfalskes av hvem som helst som kan nå inngangen direkte.

Kjør nøyaktig **én** container mot datavolumet: hastighets-
begrenseren er i minnet per prosess, og hver postboks' operasjoner
serialiseres inne i den prosessen, så en andre replika ville ha
ingen av egenskapene. Skaler ved å gi den ene prosessen en større maskin.

### Registrering: stengt som standard

Et selvdrevet relé som hvem som helst på internett kunne registrere seg på,
ville gjenskape spam-/misbruksøkonomien som det offisielle releets grenser
finnes for å kontrollere, så **Docker-pakkingen leveres stengt**: compose-
filen sender en `REGISTRATION_ALLOWLIST` (muligens tom), og
bare Breeze-ID-ene på den kan *opprette kontoer* (en første prekey-
opplasting). Å stenge registreringen påvirker aldri folk som allerede har hjemmet sitt på
releet — deres opplastinger, innskudd, rendezvous og spørringer er ikke
sperret — og å åpne registreringen er et uttrykkelig valg, aldri
standarden.

- **Din Breeze-ID** er den 12-tegns identifikatoren i invitasjons-
  lenken din (de første 12 tegnene av dens `pub`-verdi). Spør hver person
  du inviterer, om deres på samme måte — ID-en er en offentlig identifikator
  kontakter allerede utveksler, ikke en hemmelighet.
- **Slipp inn folk** ved å liste ID-ene deres: sett
  `BREEZE_ALLOWLIST=id1,id2,…` i skallet ditt eller en `.env`-fil ved siden av
  `docker-compose.yml`, deretter `docker compose up -d` igjen.
- **Start nå, slipp inn senere**: uten `BREEZE_ALLOWLIST` satt, kjører
  releet stengt for alle — oppstartsloggen sier det — og ingen
  kan registrere seg før du legger til ID-er.
- **Åpent relé** (hvem som helst kan registrere seg): fjern kommentaren fra
  `REGISTRATION_OPEN: "1"` i `docker-compose.yml`. Du eier
  misbruksøkonomien hvis du gjør det.

### Brukskvote: slå den av på ditt eget relé

Workeren leveres med en **rettferdig brukskvote** aktivert: per
postboks, maks 10 000 innskudd/dag og 200 000/måned (et innskudd er
én full leveringssyklus — se `docs/COST_MODEL.md` §10 for
policyen og tallene). Den rammen finnes for det *delte standard-
releet*, som kjøres som en gratis inngang hvis variable kostnader
operatøren ellers ville bære for alle. **På et relé du kjører
for deg selv og dine folk, er rammen meningsløs — deaktiver
den**:

```bash
USAGE_QUOTA_ENABLED=false
```

Sett den der releet ditt leser miljøet sitt (skallet eller
`.env` ved siden av `docker-compose.yml`, Node-prosessmiljøet,
eller Cloudflare Pages-hemmeligheter). To naboknapper finnes hvis du
kjører et fellesskapsrelé og *vil* ha en ramme:
`USAGE_QUOTA_DAILY` og `USAGE_QUOTA_MONTHLY` justerer takene.
Merknader som betyr noe:

- Kvoten håndheves bare når postbokser bor i Durable
  Objects (`MAILBOX_BACKEND=do`, standarden på denne verten); på
  KV-backenden er den en dokumentert no-op.
- Forbi taket får avsendere en uttrykkelig `429 USAGE_QUOTA_EXCEEDED`
  (med vinduet og grensen) i stedet for et stille dropp — meldingen
  blir i avsenderens utboks, og mottakeren forblir
  nåbar over P2P og via ethvert annet hjemrelé.

### Reléidentitet

Ved første oppstart genererer releet en vedvarende Ed25519-identitetsnøkkel
*inne i datavolumet* og skriver fingeravtrykket i loggen:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Fingeravtrykket identifiserer *ditt* relé: gi det til brukerne dine
utenfor båndet (personlig, over en annen kanal) slik at de kan gjenkjenne
releet de fikk utdelt, som det du kjører. Det samme fingeravtrykket
skrives ut ved hver oppstart; hvis det noen gang endres, ble datavolumet
erstattet — undersøk før du ber brukere stole på det nye.

Klienter verifiserer og fester denne nøkkelen automatisk (trinn 2, trinn 4): ved
første kontakt utfordrer en klient releet til å signere med nøkkelen
(`/api/relay/attest`), lagrer den verifiserte nøkkelen med kontoen, og
re-verifiserer ved hver senere økt. Fingeravtrykket klienten viser
(under `/security`, og i toast-en ved første festing) er avledet fra
den samme nøkkelen — sammenlign det med oppstartslogglinjen ovenfor. Hvis nøkkelen
noen gang endres, **slutter klienter å snakke med releet** og varsler
brukeren; de fester aldri på nytt i stillhet. Behandle en fingeravtrykksendring som en
brytende hendelse: det finnes ingen «stol på den nye nøkkelen»-knapp i appen i
trinn 4, så etter et reelt volumtap må brukerne dine tømme
appens lagrede data for kontoen sin og feste på nytt ved første kontakt —
kunngjør det nye fingeravtrykket utenfor båndet først, ellers kan de ikke skille
den nye nøkkelen din fra en angriperes.

### Sikkerhetskopiering og gjenoppretting

**Datavolumet er hele relétilstanden**: én SQLite-fil
som inneholder katalogen, postboksene og reléets identitetsnøkkel.
Det er ingenting annet å sikkerhetskopiere.

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

### Oppdatering

```bash
git pull origin main
docker compose up -d --build
```

Tilstanden bor i volumet, ikke i imaget, så oppdatering rører aldri
brukernes data.

## Egen drift med bar Node (uten Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfigurasjonen er bare miljøvariabler — `server/README.md`
lister dem alle. To forskjeller fra Docker-veien:

- **Datafilen** er som standard `./breeze-relay.db` (overstyr med
  `BREEZE_DB_PATH`); det er den samme tilstanden i én fil, reléidentitet
  inkludert. Sikkerhetskopier den på samme måte: stopp, kopier, start på nytt.
- **Registrering er åpen med mindre du stenger den**: den stengte standarden
  er en egenskap ved Docker-pakkingen. For å stenge en bar inngang, sett
  `REGISTRATION_ALLOWLIST=id1,id2` (eller en tom verdi for
  stengt-for-alle); `REGISTRATION_OPEN=1` åpner den igjen uttrykkelig.

## Cloudflare-distribusjon

### Minimumsdistribusjon ($0/måned, 5 minutter)

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

**Det er det.** Alle funksjoner fungerer unntatt push-varsler. Merk
at registrering på en Cloudflare-distribusjon er **åpen** med mindre du
setter `REGISTRATION_ALLOWLIST` selv (se `.env.example`); den
stengt-som-standard-pakkingen er Docker-veien ovenfor.

### Hva som fungerer for $0

| Funksjon | Status | Merknader |
|---------|--------|-------|
| E2E-kryptert chat | ✓ | Full Double Ratchet |
| P2P-meldinger | ✓ | WebRTC DataChannel |
| Tale-/videosamtaler | ✓ | WebRTC + gratis STUN |
| TURN-relé | ✓ | Open Relay (20GB/måned gratis) |
| Grupper (1 000 medlemmer) | ✓ | Sender Key O(1) |
| Filoverføring | ✓ | Opptil 50MB via P2P |
| 51 språk | ✓ | Engelsk innebygd + 50 fulle språkfiler, oppdages automatisk |
| Frakoblet/PWA | ✓ | Service Worker |
| Push-varsler | ✗ | Krever VAPID-nøkler |

Fakturering for flere kontoer (Lite/Plus/Pro) er ikke tilgjengelig — se
[SECURITY.md](../../SECURITY.md) sitt avsnitt «Removed: multi-account billing». Hver konto får
ubegrensede lokale underkontoer gratis uten planstyring.

### Gratisnivåets grenser

| Ressurs | Gratisnivå | Bruk per aktiv bruker |
|----------|-----------|----------------------|
| Worker-forespørsler | 100 000/dag | ~500/dag (polling + signalering) |
| KV-lesinger | 100 000/dag | ~200/dag |
| KV-skrivinger | 1 000/dag | ~350/dag (optimalisert) |
| KV-lagring | 1 GB | ~10 KB/bruker |
| Statiske ressurser | Ubegrenset | ~894 KB (én HTML) |

**Støtter ~3 samtidige aktive brukere på gratisnivå.**

### Legge til valgfrie funksjoner

#### Push-varsler (gratis)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN-server (for restriktive nettverk)

TURN er hvordan samtaler og kun-relé- (IP-skjulende) forbindelser krysser
restriktive NAT-er. Hvilken TURN releet ditt deler ut, er **ditt** valg som
operatør — Workeren prøver, i rekkefølge:

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

**Verifiser hva du faktisk konfigurerte:** `GET /api/health` rapporterer den
effektive modusen som `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Den eldre `turn`-booleanen gjenspeiler bare
`TURN_URL`, så den leser `false` for det anbefalte alternativ A — bruk
`turnProvider`. Klienter viser den samme leverandøren i `/security`, så en
bruker på Open Relay-reserven kan se at en tredjepart reléer deres
samtalemedier (bare metadata — selve mediene er DTLS-SRTP-kryptert).

#### Auth-herding og den vanlige reléveien

Prekey-opplastinger bevarer nå signeringseierskap separat ved
`prekey-owner:<userId>` **uten TTL**. Eksisterende pakkeeierskap migrerer lat
ved neste opplasting, før en erstatning aksepteres. Nye Ed25519-pakker
etablerer også den posten. Behold disse postene når du beskjærer utløpte prekey-pakker:
å vente på pakkeutløp må ikke tillate en ny eier. Rotasjon krever en
opplasting signert av den forrige eieren, som binder den nye nøkkelen i den eksisterende opplastings-
digesten. Autentisert `/account/delete` sletter begge postene og kan autentisere
mot eieren selv etter pakkeutløp. Det finnes ingen tilbakestilling for tapt eiernøkkel.

For kontoer med denne posten må opplasting og melding/forseglet poll, forseglet ACK og
postboks-WebSocket-bevis bruke den varige eieren. **Usignerte forespørsler avvises
selv med `PREKEY_REQUIRE_AUTH=false` eller `QUEUE_REQUIRE_AUTH=false`.**
Disse flaggene beholder sine eksisterende standarder og eldre semantikk for kontoer
uten eier; uttrykkelig `false`-aksept av usignerte opplastings-/køforespørsler
logger en innholdsfri avskrivningsadvarsel. Andre auth-flagg er uendret.
Postboks-WebSockets krever fortsatt signaturer for alle.

Klienten venter på signeringsinitialisering før køaktivitet, inkludert
tilbakevendende kontos oppstart, lederforfremmelse og gjenoppkobling. Den delte ventingen er
begrenset til fem sekunder. Ustøttede kjøretider fortsetter usignert umiddelbart;
fastlåst IDB/nøkkelutpakking fortsetter usignert etter grensen, og signerer deretter når den er klar.
Dette holder poll-løkken i live, **ikke** en omgåelse: eierstøttede kontoer kan ikke
motta fra releet før signeringsnøkkelen deres er brukbar. Distribuer oppdaterte klient-
ressurser sammen med Workeren for å unngå det gamle oppstartsløpet.

Migrasjon kan ikke gjenopprette eierskap fra en pakke som utløp **før** dens
eier ble bevart. Første registrering forblir TOFU. Eierskapsposter bruker
den eksisterende KV-backenden: eventuell konsistens og samtidige skrivinger gjøres ikke
lineariserbare av denne endringen. Bevis beholder det eksisterende fem-minutters friskhets-
vinduet og operasjons-/nyttelastbindingen; identiske forsøk innen vinduet er ikke en
engangs-nonce-protokoll.

Tilstedeværelsesskrivinger og TURN-legitimasjonsutstedelse krever allerede en *registrert*
konto (prekey-pakke til stede) som standard, og hver klient registrerer seg
automatisk. Tilstedeværelseshjerteslag bærer i tillegg et Ed25519-eierskapsbevis
(hjerteslaget signerer feltene det lagrer), som Workeren verifiserer
når et presenteres — `PRESENCE_SIGN_REQUIRE_AUTH=true` gjør det
beviset obligatorisk. De gjenværende Ed25519-signeringsflaggene forblir opt-in;
`wrangler.toml` dokumenterer hvert av dem og hvorfor (klienter på kjøretider uten
WebCrypto Ed25519 kan ikke signere i det hele tatt).

Den eldre vanlige reléveien (`/api/msg/send`, `/api/msg/poll`) er avskrevet: dens
svar bærer en `Deprecation: true`-header, og den forseglede veien er
standardruten for hver nåværende klient. Når du har bekreftet at ingen levende
klient fortsatt trenger reserven, deaktiver den helt:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Eget domene

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Skalering utover gratisnivået

Når du vokser ut av gratisnivået ($5/måned Workers Paid-plan):

| Ressurs | Betalt plan |
|----------|-----------|
| Worker-forespørsler | 10 millioner/måned |
| KV-skrivinger | 1 million/måned |
| KV-lagring | 1 GB inkludert |
| CPU-tid | 30 sekunder/forespørsel |

Dette støtter **tusenvis av samtidige brukere**.

### Oppdatering

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Ingen byggetrinn. Ingen avhengigheter å installere. Bare distribuer.
