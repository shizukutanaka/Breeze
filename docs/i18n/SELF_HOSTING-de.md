# Anleitung zur Installation auf dem eigenen Server

**In einer anderen Sprache lesen**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · Deutsch (diese Seite) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)

> **Bevor Sie beginnen: Die Standardinstallation braucht ein Cloudflare-Konto.**
> Die Standardinstallation in dieser Anleitung — die Cloudflare-Bereitstellung
> unten — läuft auf Cloudflare, also halten Sie ein Cloudflare-Konto bereit,
> bevor Sie beginnen. Wenn Sie Cloudflare nicht nutzen möchten,
> brauchen die Docker- und die direkte Node-Installation in dieser Anleitung kein
> Cloudflare-Konto.

Es gibt zwei Wege, ein Breeze-Relay zu betreiben:

1. **Selbst gehostet (Node + Docker)** — das Relay auf Ihrer eigenen Maschine oder
   einem VPS: ein Container, ein Datenvolumen, Registrierung standardmäßig
   geschlossen. Beginnen Sie hier, wenn das Relay für Sie und Ihre Leute ist.
2. **Cloudflare** — die Bereitstellung im offiziellen Stil auf der
   kostenlosen Stufe von Cloudflare (das Relay, das Breeze selbst betreibt). Beginnen Sie dort, wenn Sie
   ein öffentliches Relay ohne zu wartenden Server wollen.

Beide führen denselben Handler-Code aus; ein Relay ist so oder so ein dummer,
austauschbarer Briefkasten, und jeder Client funktioniert mit
jedem Relay.

## Selbst gehostet mit Docker

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

Das Relay bedient innerhalb des Containers Klartext-HTTP auf Port 8787.
**Terminieren Sie TLS an einem Reverse Proxy davor** (Caddy, nginx,
Traefik, ein Cloudflare Tunnel, …): Browser nutzen ein Relay nur
über HTTPS/WSS. Wenn Sie das tun, setzen Sie `TRUST_PROXY: "true"` in
`docker-compose.yml`, damit die Ratenbegrenzung auf der echten Client-
Adresse aufsetzt — und setzen Sie es niemals ohne einen solchen Proxy, denn der Header,
dem es vertraut, ist von jedem fälschbar, der den Eingang direkt erreichen kann.

Betreiben Sie genau **einen** Container gegen das Datenvolumen: Der Raten-
begrenzer liegt pro Prozess im Speicher, und die Operationen jedes Briefkastens sind
innerhalb dieses Prozesses serialisiert, sodass eine zweite Replik keine
der beiden Eigenschaften halten würde. Skalieren Sie, indem Sie dem einen Prozess eine größere Maschine geben.

### Registrierung: standardmäßig geschlossen

Ein selbst gehostetes Relay, auf dem sich jeder im Internet registrieren könnte,
würde die Spam-/Missbrauchsökonomie wiedererschaffen, zu deren Kontrolle die Grenzen des offiziellen Relays
existieren, daher **wird die Docker-Verpackung geschlossen ausgeliefert**: Die
Compose-Datei übergibt eine `REGISTRATION_ALLOWLIST` (möglicherweise leer), und
nur die darin stehenden Breeze-IDs dürfen *Konten erstellen* (ein erster Prekey-
Upload). Das Schließen der Registrierung betrifft niemals Personen, die bereits auf
dem Relay beheimatet sind — ihre Uploads, Hinterlegungen, Rendezvous und Abfragen sind nicht
gesperrt — und das Öffnen der Registrierung ist eine ausdrückliche Wahl, niemals der
Standard.

- **Ihre Breeze-ID** ist die 12 Zeichen lange Kennung in Ihrem Einladungs-
  Link (die ersten 12 Zeichen seines `pub`-Werts). Bitten Sie jede Person,
  die Sie einladen, auf dieselbe Weise um ihre — die ID ist eine öffentliche Kennung,
  die Kontakte ohnehin austauschen, kein Geheimnis.
- **Personen zulassen**, indem Sie ihre IDs auflisten: Setzen Sie
  `BREEZE_ALLOWLIST=id1,id2,…` in Ihrer Shell oder einer `.env`-Datei neben
  `docker-compose.yml`, dann erneut `docker compose up -d`.
- **Jetzt starten, später zulassen**: Ohne gesetztes `BREEZE_ALLOWLIST` läuft das
  Relay für alle geschlossen — das Boot-Log sagt das — und niemand
  kann sich registrieren, bis Sie IDs hinzufügen.
- **Offenes Relay** (jeder darf sich registrieren): Kommentieren Sie
  `REGISTRATION_OPEN: "1"` in `docker-compose.yml` ein. Wenn Sie es tun, gehört Ihnen die
  Missbrauchsökonomie.

### Nutzungskontingent: Schalten Sie es auf Ihrem eigenen Relay aus

Der Worker wird mit einem aktivierten **Fair-Use-Nutzungskontingent** ausgeliefert: pro
Briefkasten höchstens 10.000 Hinterlegungen/Tag und 200.000/Monat (eine Hinterlegung ist
ein vollständiger Zustellzyklus — siehe `docs/COST_MODEL.md` §10 für die
Richtlinie und die Zahlen). Dieser Rahmen existiert für das *gemeinsame Standard-
Relay*, das als kostenloser Eingang betrieben wird, dessen variable Kosten der
Betreiber sonst für alle tragen würde. **Auf einem Relay, das Sie
für sich und Ihre Leute betreiben, ist der Rahmen sinnlos — deaktivieren
Sie ihn**:

```bash
USAGE_QUOTA_ENABLED=false
```

Setzen Sie es dort, wo Ihr Relay seine Umgebung liest (die Shell oder
`.env` neben `docker-compose.yml`, die Umgebung des Node-Prozesses
oder Cloudflare-Pages-Geheimnisse). Zwei benachbarte Stellschrauben existieren, wenn Sie
ein Community-Relay betreiben und *doch* einen Rahmen wollen:
`USAGE_QUOTA_DAILY` und `USAGE_QUOTA_MONTHLY` stimmen die Obergrenzen neu ab.
Wichtige Anmerkungen:

- Das Kontingent wird nur durchgesetzt, wenn die Briefkästen in Durable
  Objects leben (`MAILBOX_BACKEND=do`, der Standard auf diesem Host); auf dem
  KV-Backend ist es ein dokumentierter No-op.
- Über der Obergrenze erhalten Sendende ein ausdrückliches `429 USAGE_QUOTA_EXCEEDED`
  (mit dem Fenster und seiner Grenze) statt eines stillen Verwerfens — die
  Nachricht bleibt im Postausgang des Sendenden, und der Empfangende bleibt
  über P2P und über jedes andere Heimat-Relay erreichbar.

### Relay-Identität

Beim ersten Start erzeugt das Relay einen dauerhaften Ed25519-Identitätsschlüssel
*innerhalb des Datenvolumens* und gibt seinen Fingerabdruck im Log aus:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Der Fingerabdruck identifiziert *Ihr* Relay: Geben Sie ihn Ihren Nutzern
außerhalb des Kanals (persönlich, über einen anderen Kanal), damit sie erkennen können,
dass das ihnen übergebene Relay das ist, das Sie betreiben. Derselbe Fingerabdruck
wird bei jedem Start ausgegeben; wenn er sich je ändert, wurde das Datenvolumen
ersetzt — untersuchen Sie das, bevor Sie Nutzern sagen, dem neuen zu vertrauen.

Clients prüfen und pinnen diesen Schlüssel automatisch (Stufe 2, Schritt 4): Beim
ersten Kontakt fordert ein Client das Relay heraus, mit dem Schlüssel zu signieren
(`/api/relay/attest`), speichert den geprüften Schlüssel mit dem Konto und
prüft ihn bei jeder späteren Sitzung erneut. Der Fingerabdruck, den der Client zeigt
(unter `/security` und im Toast beim ersten Pinnen), ist von
demselben Schlüssel abgeleitet — vergleichen Sie ihn mit der obigen Boot-Log-Zeile. Wenn der Schlüssel
sich je ändert, **sprechen Clients nicht mehr mit dem Relay** und warnen den
Nutzer; sie pinnen niemals still neu. Behandeln Sie eine Fingerabdruckänderung als
ein brechendes Ereignis: Es gibt in Schritt 4 keinen „Dem neuen Schlüssel vertrauen“-Knopf in der App,
sodass Ihre Nutzer nach einem echten Volumenverlust die
gespeicherten Daten der App für ihr Konto löschen und beim ersten Kontakt neu pinnen müssen —
kündigen Sie den neuen Fingerabdruck zuerst außerhalb des Kanals an, sonst können sie
Ihren neuen Schlüssel nicht von dem eines Angreifers unterscheiden.

### Sicherung & Wiederherstellung

**Das Datenvolumen ist der gesamte Relay-Zustand**: eine SQLite-Datei,
die das Verzeichnis, die Briefkästen und den Relay-Identitätsschlüssel enthält.
Es gibt nichts anderes zu sichern.

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

### Aktualisieren

```bash
git pull origin main
docker compose up -d --build
```

Der Zustand lebt im Volumen, nicht im Image, sodass Aktualisieren niemals
die Daten Ihrer Nutzer berührt.

## Selbst gehostet mit reinem Node (ohne Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Die Konfiguration erfolgt nur über Umgebungsvariablen — `server/README.md`
listet sie alle auf. Zwei Unterschiede zum Docker-Weg:

- Die **Datendatei** ist standardmäßig `./breeze-relay.db` (überschreibbar mit
  `BREEZE_DB_PATH`); es ist derselbe Ein-Datei-Zustand, Relay-Identität
  eingeschlossen. Sichern Sie sie auf dieselbe Weise: stoppen, kopieren, neu starten.
- **Die Registrierung ist offen, sofern Sie sie nicht schließen**: Der geschlossene Standard
  ist eine Eigenschaft der Docker-Verpackung. Um einen reinen Eingang zu schließen, setzen Sie
  `REGISTRATION_ALLOWLIST=id1,id2` (oder einen leeren Wert für
  für alle geschlossen); `REGISTRATION_OPEN=1` öffnet ausdrücklich erneut.

## Cloudflare-Bereitstellung

### Minimale Bereitstellung (0 $/Monat, 5 Minuten)

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

**Das war's.** Alle Funktionen arbeiten außer Push-Benachrichtigungen. Beachten Sie,
dass die Registrierung bei einer Cloudflare-Bereitstellung **offen** ist, sofern Sie
`REGISTRATION_ALLOWLIST` nicht selbst setzen (siehe `.env.example`); die
standardmäßig geschlossene Verpackung ist der obige Docker-Weg.

### Was bei 0 $ funktioniert

| Funktion | Status | Anmerkungen |
|---------|--------|-------|
| E2E-verschlüsselter Chat | ✓ | Vollständiges Double Ratchet |
| P2P-Nachrichten | ✓ | WebRTC DataChannel |
| Sprach-/Videoanrufe | ✓ | WebRTC + kostenloses STUN |
| TURN-Relay | ✓ | Open Relay (20 GB/Monat kostenlos) |
| Gruppen (1.000 Mitglieder) | ✓ | Sender Key O(1) |
| Dateiübertragung | ✓ | Bis 50 MB über P2P |
| 51 Sprachen | ✓ | Englisch eingebaut + 50 vollständige Locale-Dateien, automatisch erkannt |
| Offline/PWA | ✓ | Service Worker |
| Push-Benachrichtigungen | ✗ | Benötigt VAPID-Schlüssel |

Mehrkonten-Abrechnung (Lite/Plus/Pro) ist nicht verfügbar — siehe den
Abschnitt „Removed: multi-account billing“ in [SECURITY.md](../../SECURITY.md). Jedes Konto erhält
unbegrenzte lokale Unterkonten kostenlos und ohne Plan-Sperrung.

### Grenzen der kostenlosen Stufe

| Ressource | Kostenlose Stufe | Nutzung pro aktivem Nutzer |
|----------|-----------|----------------------|
| Worker-Anfragen | 100.000/Tag | ~500/Tag (Abfragen + Signalisierung) |
| KV-Lesevorgänge | 100.000/Tag | ~200/Tag |
| KV-Schreibvorgänge | 1.000/Tag | ~350/Tag (optimiert) |
| KV-Speicher | 1 GB | ~10 KB/Nutzer |
| Statische Assets | Unbegrenzt | ~894 KB (ein einziges HTML) |

**Unterstützt ~3 gleichzeitige aktive Nutzer auf der kostenlosen Stufe.**

### Optionale Funktionen hinzufügen

#### Push-Benachrichtigungen (kostenlos)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN-Server (für restriktive Netzwerke)

TURN ist die Art, wie Anrufe und reine Relay-Verbindungen (IP-verbergend) restriktive
NATs durchqueren. Welches TURN Ihr Relay ausgibt, ist **Ihre** Wahl als
Betreiber — der Worker versucht, in dieser Reihenfolge:

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

**Prüfen Sie, was Sie tatsächlich konfiguriert haben:** `GET /api/health` meldet den
wirksamen Modus als `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Der ältere `turn`-Boolean spiegelt nur
`TURN_URL` wider, sodass er für die empfohlene Option A `false` anzeigt — verwenden Sie
`turnProvider`. Clients zeigen denselben Anbieter in `/security`, sodass ein
Nutzer im Open-Relay-Rückfall sehen kann, dass ein Dritter die Medien seines Anrufs
weiterleitet (nur Metadaten — die Medien selbst sind DTLS-SRTP-verschlüsselt).

#### Authentifizierungshärtung & der einfache Relay-Pfad

Prekey-Uploads bewahren die Signatur-Eigentümerschaft nun getrennt unter
`prekey-owner:<userId>` **ohne TTL**. Bestehende Bündel-Eigentümerschaft migriert träge
beim nächsten Upload, bevor ein Ersatz akzeptiert wird. Neue Ed25519-Bündel
begründen diesen Eintrag ebenfalls. Behalten Sie diese Einträge beim Beschneiden abgelaufener Prekey-Bündel:
Das Warten auf den Bündelablauf darf keinen neuen Eigentümer erlauben. Rotation erfordert einen
vom vorherigen Eigentümer signierten Upload, der den neuen Schlüssel in den bestehenden Upload-
Digest bindet. Authentifiziertes `/account/delete` löscht beide Einträge und kann sich
auch nach Bündelablauf gegen den Eigentümer authentifizieren. Es gibt kein Zurücksetzen bei verlorener Eigentümer-Schlüssel.

Für Konten mit diesem Eintrag müssen Upload und Nachrichten-/versiegelte Abfrage, versiegeltes ACK und
Briefkasten-WebSocket-Nachweise den dauerhaften Eigentümer verwenden. **Unsignierte Anfragen werden
abgelehnt, selbst mit `PREKEY_REQUIRE_AUTH=false` oder `QUEUE_REQUIRE_AUTH=false`.**
Diese Schalter behalten ihre bestehenden Standards und die Legacy-Semantik für Konten
ohne Eigentümer; die ausdrückliche `false`-Akzeptanz unsignierter Upload-/Warteschlangen-Anfragen
protokolliert eine inhaltsfreie Veraltungswarnung. Andere Auth-Schalter sind unverändert.
Briefkasten-WebSockets erfordern weiterhin Signaturen für alle.

Der Client wartet auf die Signatur-Initialisierung vor Warteschlangenaktivität, einschließlich
Start eines zurückkehrenden Kontos, Leader-Beförderung und Wiederverbindung. Die gemeinsame Wartezeit ist
auf fünf Sekunden begrenzt. Nicht unterstützte Laufzeiten fahren sofort unsigniert fort;
hängendes IDB/Schlüssel-Auspacken fährt nach der Grenze unsigniert fort und signiert dann, wenn es bereit ist.
Das hält die Abfrageschleife am Leben, ist **kein** Umgehen: Eigentümer-gestützte Konten können
vom Relay nicht empfangen, bis ihr Signaturschlüssel benutzbar ist. Stellen Sie aktualisierte Client-
Assets neben dem Worker bereit, um das alte Startrennen zu vermeiden.

Die Migration kann Eigentümerschaft aus einem Bündel, das **vor** der Bewahrung seines
Eigentümers abgelaufen ist, nicht wiederherstellen. Die erste Registrierung bleibt TOFU. Eigentümereinträge verwenden das
bestehende KV-Backend: Eventuelle Konsistenz und gleichzeitige Schreibvorgänge werden durch diese Änderung nicht
linearisierbar gemacht. Nachweise behalten das bestehende Fünf-Minuten-Frische-
Fenster und die Bindung von Operation/Nutzlast; identische Wiederholungen im Fenster sind kein
Einmal-Nonce-Protokoll.

Präsenz-Schreibvorgänge und die Ausstellung von TURN-Zugangsdaten erfordern bereits standardmäßig ein *registriertes*
Konto (Prekey-Bündel vorhanden), und jeder Client registriert sich
automatisch. Präsenz-Herzschläge tragen zusätzlich einen Ed25519-Eigentums-
Nachweis (der Herzschlag signiert die Felder, die er speichert), den der Worker prüft,
wann immer einer vorgelegt wird — `PRESENCE_SIGN_REQUIRE_AUTH=true` macht diesen
Nachweis verpflichtend. Die übrigen Ed25519-Signaturschalter bleiben opt-in;
`wrangler.toml` dokumentiert jeden von ihnen und warum (Clients auf Laufzeiten ohne
WebCrypto Ed25519 können überhaupt nicht signieren).

Das alte einfache Relay (`/api/msg/send`, `/api/msg/poll`) ist veraltet: Seine
Antworten tragen einen `Deprecation: true`-Header, und der versiegelte Pfad ist der
Standardweg für jeden aktuellen Client. Sobald Sie bestätigt haben, dass kein lebender
Client den Rückfall noch braucht, deaktivieren Sie ihn ganz:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Eigene Domain

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Über die kostenlose Stufe hinaus skalieren

Wenn Sie die kostenlose Stufe überschreiten (Workers-Paid-Plan für 5 $/Monat):

| Ressource | Bezahlter Plan |
|----------|-----------|
| Worker-Anfragen | 10 Millionen/Monat |
| KV-Schreibvorgänge | 1 Million/Monat |
| KV-Speicher | 1 GB enthalten |
| CPU-Zeit | 30 Sekunden/Anfrage |

Das unterstützt **tausende gleichzeitige Nutzer**.

### Aktualisieren

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Kein Build-Schritt. Keine Abhängigkeiten zu installieren. Einfach bereitstellen.
