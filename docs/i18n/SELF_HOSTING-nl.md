# Handleiding voor zelf hosten

**In een andere taal lezen**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · Nederlands (deze pagina) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Er zijn twee manieren om een Breeze-relay te draaien:

1. **Zelf gehost (Node + Docker)** — de relay op je eigen machine of
   VPS: één container, één datavolume, registratie standaard gesloten.
   Begin hier als de relay voor jou en je mensen is.
2. **Cloudflare** — de implementatie in officiële stijl op de gratis
   versie van Cloudflare (de relay die Breeze zelf draait). Begin daar
   als je een publieke relay wilt zonder server om te onderhouden.

Beide draaien exact dezelfde handlercode; een relay is hoe dan ook een
domme, uitwisselbare brievenbus, en elke client werkt met elke relay.

## Zelf gehost met Docker

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

De relay serveert gewone HTTP op poort 8787 binnen de container.
**Beëindig TLS bij een reverse proxy ervoor** (Caddy, nginx, Traefik,
een Cloudflare Tunnel, …): browsers gebruiken een relay alleen via
HTTPS/WSS. Zet daarbij `TRUST_PROXY: "true"` in `docker-compose.yml`,
zodat de snelheidsbegrenzing op het echte clientadres sleutelt — en
zet dit nooit zonder zo'n proxy, omdat de header die hij vertrouwt te
vervalsen is door iedereen die de ingang rechtstreeks kan bereiken.

Draai precies **één** container op het datavolume: de
snelheidsbegrenzer zit per proces in het geheugen en de bewerkingen
van elke brievenbus worden binnen dat proces geserialiseerd, dus een
tweede replica zou geen van beide eigenschappen behouden. Schaal door
het ene proces een grotere machine te geven.

### Registratie: standaard gesloten

Een zelf gehoste relay waarop iedereen op internet zich zou kunnen
registreren, zou de spam-/misbruikeconomie herscheppen die de limieten
van de officiële relay bestaan om te beheersen, dus **de
Docker-verpakking wordt gesloten geleverd**: het compose-bestand geeft
een `REGISTRATION_ALLOWLIST` door (mogelijk leeg) en alleen de
Breeze-ID's daarop mogen *accounts aanmaken* (een eerste
prekey-upload). Het sluiten van registratie raakt nooit mensen die al
op de relay wonen — hun uploads, deponeringen, rendezvous en polls
worden niet begrensd — en het openen van registratie is een expliciete
keuze, nooit de standaard.

- **Je Breeze-ID** is de identificatie van 12 tekens in je
  uitnodigingslink (de eerste 12 tekens van de `pub`-waarde ervan).
  Vraag elke persoon die je uitnodigt op dezelfde manier om die van
  hen — het ID is een publieke identificatie die contacten al
  uitwisselen, geen geheim.
- **Laat mensen toe** door hun ID's op te sommen: zet
  `BREEZE_ALLOWLIST=id1,id2,…` in je shell of in een `.env`-bestand
  naast `docker-compose.yml`, en daarna opnieuw `docker compose up -d`.
- **Begin nu, laat later toe**: zonder ingestelde `BREEZE_ALLOWLIST`
  draait de relay gesloten voor iedereen — het opstartlogboek zegt dat
  — en niemand kan zich registreren totdat je ID's toevoegt.
- **Open relay** (iedereen mag zich registreren): haal de commentaar
  weg bij `REGISTRATION_OPEN: "1"` in `docker-compose.yml`. Als je
  dat doet, is de misbruikeconomie van jou.

### Gebruiksquotum: zet het uit op je eigen relay

De worker wordt geleverd met een ingeschakeld **fair-use
gebruiksquotum**: per brievenbus hoogstens 10.000 deponeringen per dag
en 200.000 per maand (een deponering is één volledige
bezorgingscyclus — zie `docs/COST_MODEL.md` §10 voor het beleid en de
getallen). Dat kader bestaat voor de *gedeelde standaardrelay*, die
draait als een gratis ingang waarvan de variabele kosten de beheerder
anders voor iedereen zou dragen. **Op een relay die je voor jezelf en
je mensen draait, is het kader zinloos — schakel het uit**:

```bash
USAGE_QUOTA_ENABLED=false
```

Zet het waar je relay zijn omgeving ook leest (de shell of `.env`
naast `docker-compose.yml`, de omgeving van het Node-proces, of de
geheimen van Cloudflare Pages). Er bestaan twee naburige knoppen als
je een gemeenschapsrelay draait en *wel* een kader wilt:
`USAGE_QUOTA_DAILY` en `USAGE_QUOTA_MONTHLY` stellen de limieten
opnieuw af. Opmerkingen die ertoe doen:

- Het quotum wordt alleen afgedwongen wanneer brievenbussen in Durable
  Objects leven (`MAILBOX_BACKEND=do`, de standaard op deze host); op
  de KV-backend is het een gedocumenteerde no-op.
- Voorbij de limiet krijgen verzenders een expliciete
  `429 USAGE_QUOTA_EXCEEDED` (met het venster en zijn limiet) in
  plaats van een stille drop — het bericht blijft in de outbox van de
  verzender, en de ontvanger blijft bereikbaar via P2P en via elke
  andere thuisrelay.

### Relay-identiteit

Bij de eerste keer opstarten genereert de relay een permanente
Ed25519-identiteitssleutel *binnen het datavolume* en drukt hij zijn
vingerafdruk af in het logboek:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

De vingerafdruk identificeert *jouw* relay: geef hem out-of-band aan
je gebruikers (persoonlijk, via een ander kanaal), zodat ze de relay
die ze kregen kunnen herkennen als degene die jij draait. Dezelfde
vingerafdruk wordt bij elke opstart afgedrukt; als hij ooit verandert,
is het datavolume vervangen — onderzoek dat voordat je gebruikers
vertelt de nieuwe te vertrouwen.

Clients verifiëren en pinnen deze sleutel automatisch (fase 2, stap
4): bij het eerste contact daagt een client de relay uit om met de
sleutel te ondertekenen (`/api/relay/attest`), bewaart hij de
geverifieerde sleutel bij het account, en verifieert hij hem bij elke
latere sessie opnieuw. De vingerafdruk die de client toont (onder
`/security`, en in de toast bij de eerste pin) is van dezelfde sleutel
afgeleid — vergelijk hem met de opstartlogboekregel hierboven. Als de
sleutel ooit verandert, **stoppen clients met praten met de relay** en
waarschuwen ze de gebruiker; ze pinnen nooit stilletjes opnieuw.
Behandel een verandering van vingerafdruk als een brekende gebeurtenis:
er is in stap 4 geen "vertrouw de nieuwe sleutel"-knop in de app, dus
na een echt volumeverlies moeten je gebruikers de opgeslagen gegevens
van de app voor hun account wissen en bij het eerste contact opnieuw
pinnen — kondig de nieuwe vingerafdruk eerst out-of-band aan, anders
kunnen ze jouw nieuwe sleutel niet onderscheiden van die van een
aanvaller.

### Back-up & herstel

**Het datavolume is de volledige relaystatus**: één SQLite-bestand met
de directory, de brievenbussen en de relay-identiteitssleutel. Er is
verder niets om te back-uppen.

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

### Bijwerken

```bash
git pull origin main
docker compose up -d --build
```

De status leeft in het volume, niet in de image, dus bijwerken raakt
de gegevens van je gebruikers nooit.

## Zelf gehost met kale Node (zonder Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Configuratie is alleen omgevingsvariabelen — `server/README.md` somt
ze allemaal op. Twee verschillen met het Docker-pad:

- Het **databestand** is standaard `./breeze-relay.db` (overschrijf
  met `BREEZE_DB_PATH`); het is dezelfde status in één bestand,
  relay-identiteit inbegrepen. Maak er op dezelfde manier een back-up
  van: stop, kopieer, herstart.
- **Registratie is open, tenzij je hem sluit**: de gesloten standaard
  is een eigenschap van de Docker-verpakking. Om een kale ingang te
  sluiten, zet je `REGISTRATION_ALLOWLIST=id1,id2` (of een lege waarde
  voor gesloten-voor-iedereen); `REGISTRATION_OPEN=1` opent expliciet
  opnieuw.

## Cloudflare-implementatie

### Minimale implementatie ($0/maand, 5 minuten)

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

**Dat is het.** Alle functies werken, behalve pushmeldingen. Merk op
dat registratie bij een Cloudflare-implementatie **open** is, tenzij
je zelf `REGISTRATION_ALLOWLIST` instelt (zie `.env.example`); de
standaard gesloten verpakking is het Docker-pad hierboven.

### Wat werkt voor $0

| Functie | Status | Opmerkingen |
|---------|--------|-------|
| E2E versleutelde chat | ✓ | Volledige Double Ratchet |
| P2P-berichten | ✓ | WebRTC DataChannel |
| Spraak-/videogesprekken | ✓ | WebRTC + gratis STUN |
| TURN-relay | ✓ | Open Relay (20 GB/maand gratis) |
| Groepen (1.000 leden) | ✓ | Sender Key O(1) |
| Bestandsoverdracht | ✓ | Tot 50 MB via P2P |
| 51 talen | ✓ | Engels ingebouwd + 50 volledige locale-bestanden, automatisch gedetecteerd |
| Offline/PWA | ✓ | Service Worker |
| Pushmeldingen | ✗ | Heeft VAPID-sleutels nodig |

Facturering voor meerdere accounts (Lite/Plus/Pro) is niet beschikbaar
— zie de sectie "Removed: multi-account billing" in
[SECURITY.md](../../SECURITY.md). Elk account krijgt gratis
onbeperkte lokale subaccounts, zonder planblokkering.

### Limieten van de gratis versie

| Bron | Gratis versie | Gebruik per actieve gebruiker |
|----------|-----------|----------------------|
| Worker-verzoeken | 100.000/dag | ~500/dag (polling + signalering) |
| KV-lezingen | 100.000/dag | ~200/dag |
| KV-schrijvingen | 1.000/dag | ~350/dag (geoptimaliseerd) |
| KV-opslag | 1 GB | ~10 KB/gebruiker |
| Statische assets | Onbeperkt | ~894 KB (één HTML) |

**Ondersteunt ~3 gelijktijdige actieve gebruikers op de gratis versie.**

### Optionele functies toevoegen

#### Pushmeldingen (gratis)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN-server (voor beperkende netwerken)

TURN is hoe gesprekken en verbindingen die alleen via de relay lopen
(IP-verbergend) beperkende NAT's doorkruisen. Welke TURN jouw relay
uitdeelt, is **jouw** keuze als beheerder — de Worker probeert, in
volgorde:

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

**Controleer wat je daadwerkelijk hebt geconfigureerd:**
`GET /api/health` rapporteert de effectieve modus als `turnProvider`
(`cloudflare` | `custom` | `static` | `openrelay` | `none`). De oudere
boolean `turn` weerspiegelt alleen `TURN_URL`, dus hij leest `false`
voor de aanbevolen Optie A — gebruik `turnProvider`. Clients tonen
dezelfde provider in `/security`, dus een gebruiker op de Open
Relay-fallback kan zien dat een derde partij de media van zijn
gesprekken doorstuurt (alleen metadata — de media zelf is versleuteld
met DTLS-SRTP).

#### Authenticatieverharding & het gewone relaypad

Prekey-uploads bewaren het ondertekeningseigendom nu apart bij
`prekey-owner:<userId>` **zonder TTL**. Bestaand bundle-eigendom
migreert lui bij de volgende upload, voordat een vervanging wordt
geaccepteerd. Nieuwe Ed25519-bundles vestigen dat record eveneens.
Behoud deze records bij het opruimen van verlopen prekey-bundles: wachten
op het verlopen van een bundle mag geen nieuwe eigenaar toestaan.
Rotatie vereist een upload die is ondertekend door de vorige eigenaar,
waarbij de nieuwe sleutel wordt gebonden in de bestaande
upload-digest. Geauthenticeerde `/account/delete` wist beide records
en kan zich authenticeren tegen de eigenaar, zelfs na het verlopen van
de bundle. Er is geen reset bij verlies van de eigenaarssleutel.

Voor accounts met dit record moeten uploads en bericht-/sealed-polls,
sealed ACK's en mailbox-WebSocket-bewijzen de duurzame eigenaar
gebruiken. **Niet-ondertekende verzoeken worden geweigerd, zelfs met
`PREKEY_REQUIRE_AUTH=false` of `QUEUE_REQUIRE_AUTH=false`.** Die flags
behouden hun bestaande standaardwaarden en legacy-semantiek voor
accounts zonder eigenaar; expliciete `false`-acceptatie van
niet-ondertekende upload-/wachtrijverzoeken logt een inhoudsloze
deprecatiewaarschuwing. Andere authenticatieflags zijn ongewijzigd.
Mailbox-WebSockets vereisen nog steeds handtekeningen voor iedereen.

De client wacht op de initialisatie van het ondertekenen vóór
wachtrijactiviteit, inclusief het opstarten van een terugkerend
account, leiderpromotie en herverbinding. Het gedeelde wachten is
begrensd op vijf seconden. Niet-ondersteunde runtimes gaan onmiddellijk
ongetekend verder; vastzittende IDB/sleuteluitpakking gaat na de grens
ongetekend verder en tekent daarna wanneer het klaar is. Dit houdt de
poll-lus levend, **niet** een omweg: accounts met een eigenaar kunnen
niet van de relay ontvangen totdat hun ondertekeningssleutel bruikbaar
is. Implementeer bijgewerkte clientassets samen met de Worker om de
oude opstartrace te vermijden.

Migratie kan eigendom niet herstellen van een bundle die is verlopen
**voordat** zijn eigenaar werd bewaard. De eerste registratie blijft
TOFU. Eigendomsrecords gebruiken de bestaande KV-backend: uiteindelijke
consistentie en gelijktijdige schrijvingen worden door deze wijziging
niet lineariseerbaar gemaakt. Bewijzen behouden het bestaande
versheidsvenster van vijf minuten en de binding van
bewerking/payload; identieke herhalingen binnen het venster zijn geen
eenmalig nonce-protocol.

Aanwezigheidsschrijvingen en de uitgifte van TURN-inloggegevens
vereisen standaard al een *geregistreerd* account (prekey-bundle
aanwezig), en elke client registreert zich automatisch.
Aanwezigheidsheartbeats dragen bovendien een Ed25519-eigendomsbewijs
(de beat ondertekent de velden die hij opslaat), dat de Worker
verifieert telkens wanneer er een wordt aangeboden —
`PRESENCE_SIGN_REQUIRE_AUTH=true` maakt dat bewijs verplicht. De
overige Ed25519-handtekeningflags blijven opt-in; `wrangler.toml`
documenteert elk ervan en waarom (clients op runtimes zonder WebCrypto
Ed25519 kunnen helemaal niet ondertekenen).

De legacy gewone relay (`/api/msg/send`, `/api/msg/poll`) is
gedeprecieerd: zijn antwoorden dragen een `Deprecation: true`-header,
en het sealed-pad is de standaardroute voor elke huidige client. Zodra
je hebt bevestigd dat geen enkele live client de fallback nog nodig
heeft, schakel je hem ronduit uit:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Aangepast domein

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Schalen voorbij de gratis versie

Wanneer je de gratis versie ontgroeit (Workers Paid-plan van
$5/maand):

| Bron | Betaald plan |
|----------|-----------|
| Worker-verzoeken | 10 miljoen/maand |
| KV-schrijvingen | 1 miljoen/maand |
| KV-opslag | 1 GB inbegrepen |
| CPU-tijd | 30 seconden/verzoek |

Dit ondersteunt **duizenden gelijktijdige gebruikers**.

### Bijwerken

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Geen buildstap. Geen afhankelijkheden om te installeren. Gewoon implementeren.
