# Guide för egen värdskap (Self-Hosting)

**Läs på andra språk**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · Svenska (den här sidan) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Det finns två sätt att köra ett Breeze-relä:

1. **Eget värdskap (Node + Docker)** — reläet på din egen maskin eller
   VPS: en container, en datavolym, registrering stängd som
   standard. Börja här om reläet är för dig och dina personer.
2. **Cloudflare** — distributionen i officiell stil på Cloudflares
   gratisnivå (reläet som Breeze själv kör). Börja där om du vill ha
   ett offentligt relä utan server att underhålla.

Båda kör identisk hanterarkod; ett relä är en dum,
utbytbar brevlåda i båda fallen, och varje klient fungerar med
varje relä.

## Eget värdskap med Docker

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

Reläet serverar vanlig HTTP på port 8787 inuti containern.
**Terminera TLS vid en omvänd proxy framför den** (Caddy, nginx,
Traefik, en Cloudflare Tunnel, …): webbläsare använder ett relä endast
över HTTPS/WSS. När du gör det, ställ in `TRUST_PROXY: "true"` i
`docker-compose.yml` så att hastighetsbegränsningen nycklas på den verkliga klient-
adressen — och ställ aldrig in det utan en sådan proxy, eftersom headern
den litar på kan förfalskas av vem som helst som kan nå ingången direkt.

Kör exakt **en** container mot datavolymen: hastighets-
begränsaren finns i minnet per process och varje brevlådas operationer
serialiseras inuti den processen, så en andra replika skulle inneha
ingendera egenskapen. Skala genom att ge den enda processen en större maskin.

### Registrering: stängd som standard

Ett självhostat relä som vem som helst på internet kunde registrera sig på
skulle återskapa den spam-/missbruksekonomi som det officiella reläets gränser
finns för att kontrollera, så **Docker-paketeringen levereras stängd**: compose-
filen skickar en `REGISTRATION_ALLOWLIST` (möjligen tom) och
endast de Breeze-ID:n som finns på den får *skapa konton* (en första prekey-
uppladdning). Att stänga registreringen påverkar aldrig personer som redan har sin hemvist på
reläet — deras uppladdningar, insättningar, rendezvous och avfrågningar är inte
spärrade — och att öppna registreringen är ett uttryckligt val, aldrig
standard.

- **Ditt Breeze-ID** är den 12-teckens identifierare som finns i din inbjudan
  länk (de första 12 tecknen i dess `pub`-värde). Fråga varje person
  du bjuder in om deras på samma sätt — ID:t är en offentlig identifierare
  som kontakter redan utbyter, inte en hemlighet.
- **Släpp in personer** genom att lista deras ID:n: ställ in
  `BREEZE_ALLOWLIST=id1,id2,…` i ditt skal eller en `.env`-fil bredvid
  `docker-compose.yml`, sedan `docker compose up -d` igen.
- **Börja nu, släpp in senare**: utan `BREEZE_ALLOWLIST` inställd, körs
  reläet stängt för alla — startloggen säger det — och ingen
  kan registrera sig förrän du lägger till ID:n.
- **Öppet relä** (vem som helst får registrera sig): avkommentera
  `REGISTRATION_OPEN: "1"` i `docker-compose.yml`. Du äger
  missbruksekonomin om du gör det.

### Användningskvot: stäng av den på ditt eget relä

Workern levereras med en **rättvis användningskvot** aktiverad: per
brevlåda, högst 10 000 insättningar/dag och 200 000/månad (en insättning är
en fullständig leveranscykel — se `docs/COST_MODEL.md` §10 för
policyn och siffrorna). Den ramen finns för det *delade standard-
reläet*, som körs som en gratis ingång vars rörliga kostnader
operatören annars skulle bära för alla. **På ett relä du kör
för dig själv och dina personer är ramen meningslös — inaktivera
den**:

```bash
USAGE_QUOTA_ENABLED=false
```

Ställ in den varhelst ditt relä läser sin miljö (skalet eller
`.env` bredvid `docker-compose.yml`, Node-processmiljön,
eller Cloudflare Pages-hemligheter). Två angränsande rattar finns om du
kör ett gemenskapsrelä och *vill* ha en ram:
`USAGE_QUOTA_DAILY` och `USAGE_QUOTA_MONTHLY` justerar taken.
Anmärkningar som betyder något:

- Kvoten upprätthålls endast när brevlådor bor i Durable
  Objects (`MAILBOX_BACKEND=do`, standarden på denna värd); på
  KV-backend är den en dokumenterad no-op.
- Bortom taket får avsändare ett uttryckligt `429 USAGE_QUOTA_EXCEEDED`
  (med fönstret och dess gräns) istället för ett tyst bortfall — meddelandet
  stannar i avsändarens utkorg, och mottagaren förblir
  nåbar över P2P och via varje annat hemrelä.

### Reläidentitet

Vid första starten genererar reläet en beständig Ed25519-identitetsnyckel
*inuti datavolymen* och skriver ut dess fingeravtryck i loggen:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Fingeravtrycket identifierar *ditt* relä: ge det till dina användare
utanför bandet (personligen, över en annan kanal) så att de kan känna igen
reläet de fick som det du kör. Samma fingeravtryck
skrivs ut vid varje start; om det någonsin ändras, ersattes datavolymen
— undersök innan du säger åt användare att lita på den nya.

Klienter verifierar och fäster denna nyckel automatiskt (steg 2, steg 4): vid
första kontakten utmanar en klient reläet att signera med nyckeln
(`/api/relay/attest`), lagrar den verifierade nyckeln med kontot, och
omverifierar vid varje senare session. Fingeravtrycket klienten visar
(under `/security`, och i toast-meddelandet vid första fästningen) härleds från
samma nyckel — jämför det med startloggraden ovan. Om nyckeln
någonsin ändras, **slutar klienter att prata med reläet** och varnar
användaren; de fäster aldrig om tyst. Behandla en fingeravtrycksändring som en
brytande händelse: det finns ingen "lita på den nya nyckeln"-knapp i appen i
steg 4, så efter en verklig volymförlust måste dina användare rensa
appens lagrade data för sitt konto och fästa på nytt vid första kontakten —
meddela det nya fingeravtrycket utanför bandet först, annars kan de inte skilja
din nya nyckel från en angripares.

### Säkerhetskopiering och återställning

**Datavolymen är hela relätillståndet**: en SQLite-fil
som innehåller katalogen, brevlådorna och reläets identitetsnyckel.
Det finns inget annat att säkerhetskopiera.

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

### Uppdatering

```bash
git pull origin main
docker compose up -d --build
```

Tillståndet bor i volymen, inte i imagen, så uppdatering rör aldrig
dina användares data.

## Eget värdskap med bar Node (ingen Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfigurationen är endast miljövariabler — `server/README.md`
listar dem alla. Två skillnader mot Docker-vägen:

- **Datafilen** är som standard `./breeze-relay.db` (åsidosätt med
  `BREEZE_DB_PATH`); det är samma tillstånd i en enda fil, reläidentitet
  inkluderad. Säkerhetskopiera den på samma sätt: stoppa, kopiera, starta om.
- **Registrering är öppen om du inte stänger den**: den stängda standarden
  är en egenskap hos Docker-paketeringen. För att stänga en bar ingång, ställ in
  `REGISTRATION_ALLOWLIST=id1,id2` (eller ett tomt värde för
  stängd-för-alla); `REGISTRATION_OPEN=1` öppnar den igen uttryckligen.

## Cloudflare-distribution

### Minsta distribution ($0/månad, 5 minuter)

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

**Det är allt.** Alla funktioner fungerar utom push-aviseringar. Observera
att registrering på en Cloudflare-distribution är **öppen** om du inte
ställer in `REGISTRATION_ALLOWLIST` själv (se `.env.example`); den
stängda-som-standard-paketeringen är Docker-vägen ovan.

### Vad som fungerar för $0

| Funktion | Status | Anteckningar |
|---------|--------|-------|
| E2E-krypterad chatt | ✓ | Full Double Ratchet |
| P2P-meddelanden | ✓ | WebRTC DataChannel |
| Röst-/videosamtal | ✓ | WebRTC + gratis STUN |
| TURN-relä | ✓ | Open Relay (20GB/månad gratis) |
| Grupper (1 000 medlemmar) | ✓ | Sender Key O(1) |
| Filöverföring | ✓ | Upp till 50MB via P2P |
| 51 språk | ✓ | Engelska inbyggt + 50 fulla lokalfiler, upptäcks automatiskt |
| Offline/PWA | ✓ | Service Worker |
| Push-aviseringar | ✗ | Kräver VAPID-nycklar |

Fakturering för flera konton (Lite/Plus/Pro) är inte tillgänglig — se
[SECURITY.md](../../SECURITY.md):s avsnitt "Removed: multi-account billing". Varje konto får
obegränsade lokala underkonton gratis utan planstyrning.

### Gratisnivåns gränser

| Resurs | Gratisnivå | Användning per aktiv användare |
|----------|-----------|----------------------|
| Worker-förfrågningar | 100 000/dag | ~500/dag (polling + signalering) |
| KV-läsningar | 100 000/dag | ~200/dag |
| KV-skrivningar | 1 000/dag | ~350/dag (optimerat) |
| KV-lagring | 1 GB | ~10 KB/användare |
| Statiska tillgångar | Obegränsat | ~894 KB (enkel HTML) |

**Stöder ~3 samtidigt aktiva användare på gratisnivå.**

### Lägga till valfria funktioner

#### Push-aviseringar (gratis)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN-server (för restriktiva nätverk)

TURN är hur samtal och endast-relä- (IP-döljande) anslutningar korsar
restriktiva NAT:ar. Vilken TURN ditt relä delar ut är **ditt** val som
operatör — Workern försöker, i ordning:

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

**Verifiera vad du faktiskt konfigurerade:** `GET /api/health` rapporterar det
effektiva läget som `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Den äldre `turn`-booleanen speglar endast
`TURN_URL`, så den läser `false` för det rekommenderade alternativ A — använd
`turnProvider`. Klienter visar samma leverantör i `/security`, så en
användare på Open Relay-reserven kan se att en tredje part reläar deras
samtalsmedia (endast metadata — själva median är DTLS-SRTP-krypterad).

#### Auth-härdning och den vanliga relävägen

Prekey-uppladdningar bevarar nu signeringsägandet separat vid
`prekey-owner:<userId>` **utan TTL**. Befintligt paketägande migrerar lätt
vid nästa uppladdning, innan en ersättning accepteras. Nya Ed25519-paket
etablerar också den posten. Behåll dessa poster när du beskär utgångna prekey-paket:
att vänta på paketutgång får inte tillåta en ny ägare. Rotation kräver en
uppladdning signerad av den tidigare ägaren, som binder den nya nyckeln i den befintliga uppladdnings-
digesten. Autentiserad `/account/delete` raderar båda posterna och kan autentisera
mot ägaren även efter paketutgång. Det finns ingen återställning för förlorad ägarnyckel.

För konton med denna post måste uppladdning och meddelande-/sealed-poll, sealed ACK och
brevlåde-WebSocket-bevis använda den beständiga ägaren. **Osignerade förfrågningar avvisas
även med `PREKEY_REQUIRE_AUTH=false` eller `QUEUE_REQUIRE_AUTH=false`.**
Dessa flaggor behåller sina befintliga standardvärden och äldre semantik för konton
utan ägare; uttryckligt `false`-godkännande av osignerade uppladdnings-/köförfrågningar
loggar en innehållsfri utfasningsvarning. Andra auth-flaggor är oförändrade.
Brevlåde-WebSockets kräver fortfarande signaturer för alla.

Klienten väntar på signeringsinitiering innan köaktivitet, inklusive
återvändande kontos uppstart, ledarpromotion och återanslutning. Den delade väntan är
begränsad till fem sekunder. Miljöer som inte stöds fortsätter osignerat omedelbart;
fastnad IDB/nyckeluppackning fortsätter osignerat efter gränsen och signerar sedan när det är redo.
Detta håller poll-slingan vid liv, **inte** en förbikoppling: ägarstödda konton kan inte
ta emot från reläet förrän deras signeringsnyckel är användbar. Distribuera uppdaterade klient-
tillgångar tillsammans med Workern för att undvika det gamla startloppet.

Migrering kan inte återvinna ägande från ett paket som gick ut **innan** dess
ägare bevarades. Första registreringen förblir TOFU. Ägandeposter använder
befintlig KV-backend: eventuell konsistens och samtidiga skrivningar görs inte
lineariserbara av denna ändring. Bevis behåller det befintliga fem-minuters fräschhets-
fönstret och operations-/nyttolastbindningen; identiska försök inom fönstret är inte ett
engångs-nonce-protokoll.

Närvaroskrivningar och TURN-autentiseringsuppgiftsutfärdande kräver redan ett *registrerat*
konto (prekey-paket närvarande) som standard, och varje klient registrerar sig
automatiskt. Närvaro-hjärtslag bär dessutom ett Ed25519-ägandebevis
(hjärtslaget signerar fälten det lagrar), som Workern verifierar
närhelst ett presenteras — `PRESENCE_SIGN_REQUIRE_AUTH=true` gör det
beviset obligatoriskt. De återstående Ed25519-signeringsflaggorna förblir opt-in;
`wrangler.toml` dokumenterar var och en och varför (klienter på körningsmiljöer utan
WebCrypto Ed25519 kan inte signera alls).

Den äldre vanliga relävägen (`/api/msg/send`, `/api/msg/poll`) är utfasad: dess
svar bär en `Deprecation: true`-header, och den förseglade vägen är
standardvägen för varje nuvarande klient. När du har bekräftat att ingen levande
klient fortfarande behöver reserven, inaktivera den helt:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Egen domän

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Skala bortom gratisnivån

När du växer ur gratisnivån ($5/månad Workers Paid-plan):

| Resurs | Betald plan |
|----------|-----------|
| Worker-förfrågningar | 10 miljoner/månad |
| KV-skrivningar | 1 miljon/månad |
| KV-lagring | 1 GB ingår |
| CPU-tid | 30 sekunder/förfrågan |

Detta stöder **tusentals samtidiga användare**.

### Uppdatering

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Inget byggsteg. Inga beroenden att installera. Bara distribuera.
