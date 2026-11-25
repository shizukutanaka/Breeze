# Vejledning til selvhosting (Self-Hosting)

**Læs på andre sprog**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · Dansk (denne side) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


> **Før du starter: standardopsætningen kræver en Cloudflare-konto.**
> Standardopsætningen i denne vejledning — Cloudflare-distributionen
> nedenfor — kører på Cloudflare, så hav en Cloudflare-konto klar,
> før du begynder. Hvis du ikke vil bruge Cloudflare, kræver
> Docker- og bar-Node-opsætningerne i denne vejledning ikke en
> Cloudflare-konto.

Der er to måder at køre et Breeze-relæ på:

1. **Selvhostet (Node + Docker)** — relæet på din egen maskine eller
   VPS: én container, ét datavolumen, registrering lukket som
   standard. Start her, hvis relæet er til dig og dine folk.
2. **Cloudflare** — distributionen i officiel stil på Cloudflares
   gratis niveau (det relæ, Breeze selv kører). Start der, hvis du vil have
   et offentligt relæ uden en server at vedligeholde.

Begge kører identisk handlerkode; et relæ er en dum,
udskiftelig postkasse i begge tilfælde, og hver klient fungerer med
hvert relæ.

## Selvhostet med Docker

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

Relæet serverer almindelig HTTP på port 8787 inde i containeren.
**Terminér TLS ved en omvendt proxy foran den** (Caddy, nginx,
Traefik, en Cloudflare Tunnel, …): browsere vil kun bruge et relæ
over HTTPS/WSS. Når du gør det, skal du indstille `TRUST_PROXY: "true"` i
`docker-compose.yml`, så hastighedsbegrænsningen nøgles på den virkelige klient-
adresse — og indstil det aldrig uden en sådan proxy, fordi headeren,
den stoler på, kan forfalskes af enhver, der kan nå indgangen direkte.

Kør nøjagtigt **én** container mod datavolumenet: hastigheds-
begrænseren er i hukommelsen pr. proces, og hver postkasses operationer
serialiseres inde i den proces, så en anden replika ville have
ingen af egenskaberne. Skalér ved at give den ene proces en større maskine.

### Registrering: lukket som standard

Et selvhostet relæ, som enhver på internettet kunne registrere sig på,
ville genskabe den spam-/misbrugsøkonomi, som det officielle relæs grænser
findes for at kontrollere, så **Docker-pakningen leveres lukket**: compose-
filen sender en `REGISTRATION_ALLOWLIST` (muligvis tom), og
kun de Breeze-ID'er, der står på den, må *oprette konti* (en første prekey-
upload). At lukke registreringen påvirker aldrig folk, der allerede har hjemsted på
relæet — deres uploads, indskud, rendezvous og polls er ikke
spærret — og at åbne registreringen er et udtrykkeligt valg, aldrig
standarden.

- **Dit Breeze-ID** er den 12-tegns identifikator i dit invitations-
  link (de første 12 tegn af dets `pub`-værdi). Spørg hver person,
  du inviterer, om deres på samme måde — ID'et er en offentlig identifikator,
  kontakter allerede udveksler, ikke en hemmelighed.
- **Luk folk ind** ved at liste deres ID'er: indstil
  `BREEZE_ALLOWLIST=id1,id2,…` i din shell eller en `.env`-fil ved siden af
  `docker-compose.yml`, derefter `docker compose up -d` igen.
- **Start nu, luk ind senere**: uden `BREEZE_ALLOWLIST` indstillet kører
  relæet lukket for alle — opstartsloggen siger det — og ingen
  kan registrere sig, før du tilføjer ID'er.
- **Åbent relæ** (enhver må registrere sig): fjern kommentaren fra
  `REGISTRATION_OPEN: "1"` i `docker-compose.yml`. Du ejer
  misbrugsøkonomien, hvis du gør det.

### Brugskvote: slå den fra på dit eget relæ

Workeren leveres med en **fair-use brugskvote** aktiveret: pr.
postkasse højst 10.000 indskud/dag og 200.000/måned (et indskud er
én fuld leveringscyklus — se `docs/COST_MODEL.md` §10 for
politikken og tallene). Den ramme findes for det *delte standard-
relæ*, som køres som en gratis indgang, hvis variable omkostninger
operatøren ellers ville bære for alle. **På et relæ, du kører
for dig selv og dine folk, er rammen meningsløs — deaktivér
den**:

```bash
USAGE_QUOTA_ENABLED=false
```

Indstil den, hvor dit relæ læser sit miljø (shellen eller
`.env` ved siden af `docker-compose.yml`, Node-procesmiljøet
eller Cloudflare Pages-hemmeligheder). To naboknapper findes, hvis du
kører et fællesskabsrelæ og *ønsker* en ramme:
`USAGE_QUOTA_DAILY` og `USAGE_QUOTA_MONTHLY` justerer lofterne.
Bemærkninger, der betyder noget:

- Kvoten håndhæves kun, når postkasser bor i Durable
  Objects (`MAILBOX_BACKEND=do`, standarden på denne vært); på
  KV-backenden er den en dokumenteret no-op.
- Forbi loftet får afsendere en udtrykkelig `429 USAGE_QUOTA_EXCEEDED`
  (med vinduet og dets grænse) i stedet for et stille tab — beskeden
  bliver i afsenderens udbakke, og modtageren forbliver
  nåbar over P2P og via ethvert andet hjemrelæ.

### Relæidentitet

Ved første opstart genererer relæet en vedvarende Ed25519-identitetsnøgle
*inde i datavolumenet* og udskriver dens fingeraftryk i loggen:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Fingeraftrykket identificerer *dit* relæ: giv det til dine brugere
uden for båndet (personligt, over en anden kanal), så de kan genkende
relæet, de fik udleveret, som det, du kører. Det samme fingeraftryk
udskrives ved hver opstart; hvis det nogensinde ændres, blev datavolumenet
erstattet — undersøg det, før du beder brugere om at stole på det nye.

Klienter verificerer og fastgør automatisk denne nøgle (trin 2, trin 4): ved
første kontakt udfordrer en klient relæet til at signere med nøglen
(`/api/relay/attest`), gemmer den verificerede nøgle med kontoen og
genverificerer ved hver senere session. Fingeraftrykket, klienten viser
(under `/security` og i toasten ved første fastgørelse), er afledt af
den samme nøgle — sammenlign det med opstartsloglinjen ovenfor. Hvis nøglen
nogensinde ændres, **stopper klienter med at tale med relæet** og advarer
brugeren; de fastgør aldrig igen i stilhed. Behandl en fingeraftryksændring som en
brydende begivenhed: der er ingen "stol på den nye nøgle"-knap i appen i
trin 4, så efter et reelt volumentab skal dine brugere rydde
appens gemte data for deres konto og fastgøre igen ved første kontakt —
annoncer det nye fingeraftryk uden for båndet først, ellers kan de ikke skelne
din nye nøgle fra en angribers.

### Sikkerhedskopiering og gendannelse

**Datavolumenet er hele relætilstanden**: én SQLite-fil,
der indeholder kataloget, postkasserne og relæets identitetsnøgle.
Der er intet andet at sikkerhedskopiere.

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

### Opdatering

```bash
git pull origin main
docker compose up -d --build
```

Tilstanden bor i volumenet, ikke i imaget, så opdatering rører aldrig
dine brugeres data.

## Selvhostet med bar Node (uden Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfigurationen er kun miljøvariabler — `server/README.md`
lister dem alle. To forskelle fra Docker-vejen:

- **Datafilen** er som standard `./breeze-relay.db` (tilsidesæt med
  `BREEZE_DB_PATH`); det er den samme tilstand i én fil, relæidentitet
  inkluderet. Sikkerhedskopiér den på samme måde: stop, kopiér, genstart.
- **Registrering er åben, medmindre du lukker den**: den lukkede standard
  er en egenskab ved Docker-pakningen. For at lukke en bar indgang skal du indstille
  `REGISTRATION_ALLOWLIST=id1,id2` (eller en tom værdi for
  lukket-for-alle); `REGISTRATION_OPEN=1` åbner den igen udtrykkeligt.

## Cloudflare-distribution

### Minimumsdistribution ($0/måned, 5 minutter)

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

**Det er det.** Alle funktioner fungerer undtagen push-notifikationer. Bemærk,
at registrering på en Cloudflare-distribution er **åben**, medmindre du
indstiller `REGISTRATION_ALLOWLIST` selv (se `.env.example`); den
lukket-som-standard-pakning er Docker-vejen ovenfor.

### Hvad der fungerer for $0

| Funktion | Status | Bemærkninger |
|---------|--------|-------|
| E2E-krypteret chat | ✓ | Fuld Double Ratchet |
| P2P-beskeder | ✓ | WebRTC DataChannel |
| Tale-/videoopkald | ✓ | WebRTC + gratis STUN |
| TURN-relæ | ✓ | Open Relay (20GB/måned gratis) |
| Grupper (1.000 medlemmer) | ✓ | Sender Key O(1) |
| Filoverførsel | ✓ | Op til 50MB via P2P |
| 51 sprog | ✓ | Engelsk indbygget + 50 fulde lokalefiler, opdages automatisk |
| Offline/PWA | ✓ | Service Worker |
| Push-notifikationer | ✗ | Kræver VAPID-nøgler |

Fakturering for flere konti (Lite/Plus/Pro) er ikke tilgængelig — se
[SECURITY.md](../../SECURITY.md)s afsnit "Removed: multi-account billing". Hver konto får
ubegrænsede lokale underkonti gratis uden planstyring.

### Gratis niveauets grænser

| Ressource | Gratis niveau | Brug pr. aktiv bruger |
|----------|-----------|----------------------|
| Worker-anmodninger | 100.000/dag | ~500/dag (polling + signalering) |
| KV-læsninger | 100.000/dag | ~200/dag |
| KV-skrivninger | 1.000/dag | ~350/dag (optimeret) |
| KV-lagring | 1 GB | ~10 KB/bruger |
| Statiske aktiver | Ubegrænset | ~894 KB (enkelt HTML) |

**Understøtter ~3 samtidige aktive brugere på gratis niveau.**

### Tilføjelse af valgfrie funktioner

#### Push-notifikationer (gratis)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN-server (til restriktive netværk)

TURN er måden, hvorpå opkald og kun-relæ- (IP-skjulende) forbindelser krydser
restriktive NAT'er. Hvilken TURN dit relæ uddeler, er **dit** valg som
operatør — Workeren prøver, i rækkefølge:

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

**Verificér, hvad du faktisk konfigurerede:** `GET /api/health` rapporterer den
effektive tilstand som `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Den ældre `turn`-boolean afspejler kun
`TURN_URL`, så den læser `false` for det anbefalede alternativ A — brug
`turnProvider`. Klienter viser den samme udbyder i `/security`, så en
bruger på Open Relay-reserven kan se, at en tredjepart relæer deres
opkaldsmedier (kun metadata — selve medierne er DTLS-SRTP-krypteret).

#### Auth-hærdning og den almindelige relævej

Prekey-uploads bevarer nu signeringsejerskab separat ved
`prekey-owner:<userId>` **uden TTL**. Eksisterende bundtejerskab migrerer dovent
ved næste upload, før en erstatning accepteres. Nye Ed25519-bundter
etablerer også den post. Behold disse poster, når du beskærer udløbne prekey-bundter:
at vente på bundtudløb må ikke tillade en ny ejer. Rotation kræver en
upload signeret af den tidligere ejer, der binder den nye nøgle i den eksisterende upload-
digest. Autentificeret `/account/delete` sletter begge poster og kan autentificere
mod ejeren, selv efter bundtudløb. Der er ingen nulstilling for tabt ejernøgle.

For konti med denne post skal upload og besked/forseglet poll, forseglet ACK og
postkasse-WebSocket-beviser bruge den varige ejer. **Usignerede anmodninger afvises,
selv med `PREKEY_REQUIRE_AUTH=false` eller `QUEUE_REQUIRE_AUTH=false`.**
Disse flag beholder deres eksisterende standarder og ældre semantik for konti
uden en ejer; udtrykkelig `false`-accept af usignerede upload-/køanmodninger
logger en indholdsfri udfasningsadvarsel. Andre auth-flag er uændrede.
Postkasse-WebSockets kræver stadig signaturer for alle.

Klienten venter på signeringsinitialisering før køaktivitet, inklusive
tilbagevendende kontoopstart, lederforfremmelse og genforbindelse. Den delte venten er
begrænset til fem sekunder. Ikke-understøttede køretider fortsætter usigneret med det samme;
fastlåst IDB/nøgleudpakning fortsætter usigneret efter grænsen og signerer derefter, når den er klar.
Dette holder poll-løkken i live, **ikke** en omgåelse: ejerstøttede konti kan ikke
modtage fra relæet, før deres signeringsnøgle er brugbar. Distribuér opdaterede klient-
aktiver sammen med Workeren for at undgå det gamle opstartsløb.

Migration kan ikke gendanne ejerskab fra et bundt, der udløb, **før** dets
ejer blev bevaret. Første registrering forbliver TOFU. Ejerskabsposter bruger
den eksisterende KV-backend: eventuel konsistens og samtidige skrivninger gøres ikke
lineariserbare af denne ændring. Beviser beholder det eksisterende fem-minutters friskheds-
vindue og operations-/payloadbinding; identiske forsøg inden for vinduet er ikke en
engangs-nonce-protokol.

Tilstedeværelsesskrivninger og TURN-legitimationsudstedelse kræver allerede en *registreret*
konto (prekey-bundt til stede) som standard, og hver klient registrerer sig
automatisk. Tilstedeværelseshjerteslag bærer desuden et Ed25519-ejerskabsbevis
(hjerteslaget signerer de felter, det gemmer), som Workeren verificerer,
når et præsenteres — `PRESENCE_SIGN_REQUIRE_AUTH=true` gør det
bevis obligatorisk. De resterende Ed25519-signeringsflag forbliver opt-in;
`wrangler.toml` dokumenterer hver enkelt og hvorfor (klienter på køretider uden
WebCrypto Ed25519 kan slet ikke signere).

Den ældre almindelige relævej (`/api/msg/send`, `/api/msg/poll`) er udfaset: dens
svar bærer en `Deprecation: true`-header, og den forseglede vej er
standardruten for hver nuværende klient. Når du har bekræftet, at ingen levende
klient stadig har brug for reserven, skal du deaktivere den helt:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Brugerdefineret domæne

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Skalering ud over gratis niveau

Når du vokser ud af det gratis niveau ($5/måned Workers Paid-plan):

| Ressource | Betalt plan |
|----------|-----------|
| Worker-anmodninger | 10 millioner/måned |
| KV-skrivninger | 1 million/måned |
| KV-lagring | 1 GB inkluderet |
| CPU-tid | 30 sekunder/anmodning |

Dette understøtter **tusindvis af samtidige brugere**.

### Opdatering

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Intet byggetrin. Ingen afhængigheder at installere. Bare distribuér.
