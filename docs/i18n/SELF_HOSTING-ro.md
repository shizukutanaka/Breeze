# Ghid de găzduire proprie

**Citiți în altă limbă**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · Română (această pagină) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)

> **Înainte de a începe: instalarea standard are nevoie de un cont Cloudflare.**
> Instalarea standard din acest ghid — instalarea pe Cloudflare
> de mai jos — rulează pe Cloudflare, așa că aveți un cont
> Cloudflare pregătit înainte de a începe. Dacă nu doriți să
> folosiți Cloudflare, instalările cu Docker și cu Node simplu
> din acest ghid nu au nevoie de un cont Cloudflare.

Există două modalități de a rula un releu Breeze:

1. **Găzduire proprie (Node + Docker)** — releul pe propriul aparat sau
   VPS: un container, un volum de date, înregistrarea închisă în mod
   implicit. Începeți aici dacă releul este pentru dumneavoastră și oamenii dumneavoastră.
2. **Cloudflare** — instalarea de tip oficial pe nivelul gratuit
   Cloudflare (releul pe care îl rulează Breeze însuși). Începeți acolo dacă doriți
   un releu public, fără un server de întreținut.

Ambele rulează cod de tratare identic; un releu este o căsuță poștală simplă,
interschimbabilă, în oricare dintre variante, iar fiecare client funcționează cu
fiecare releu.

## Găzduire proprie cu Docker

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

Releul servește HTTP simplu pe portul 8787 în interiorul containerului.
**Terminați TLS la un proxy invers aflat în fața lui** (Caddy, nginx,
Traefik, un Cloudflare Tunnel, …): browserele vor folosi un releu
numai prin HTTPS/WSS. Când o faceți, setați `TRUST_PROXY: "true"` în
`docker-compose.yml`, astfel încât limitarea ratei să se bazeze pe adresa reală a clientului
— și nu o setați niciodată fără un astfel de proxy, deoarece antetul
în care are încredere poate fi falsificat de oricine poate ajunge direct la intrare.

Rulați exact **un** container pe volumul de date: limitatorul de
rată este în memorie, per proces, iar operațiunile fiecărei căsuțe poștale sunt
serializate în interiorul acelui proces, așa că o a doua replică nu ar păstra
niciuna dintre proprietăți. Scalați dând procesului unic un aparat mai mare.

### Înregistrare: închisă în mod implicit

Un releu găzduit propriu, pe care oricine de pe internet s-ar putea înregistra,
ar recrea economia de spam/abuz pe care limitele releului oficial
există pentru a o controla, așa că **ambalarea Docker vine închisă**: fișierul
compose transmite un `REGISTRATION_ALLOWLIST` (posibil gol) și
numai ID-urile Breeze de pe el pot *crea conturi* (o primă încărcare de
prekey). Închiderea înregistrării nu afectează niciodată persoanele deja găzduite pe
releu — încărcările, depunerile, întâlnirile (rendezvous) și interogările (poll) lor nu sunt
supuse porții — iar deschiderea înregistrării este o alegere explicită, niciodată
implicită.

- **ID-ul dumneavoastră Breeze** este identificatorul de 12 caractere din linkul
  dumneavoastră de invitație (primele 12 caractere ale valorii sale `pub`). Cereți fiecărei persoane
  pe care o invitați ID-ul ei în același mod — ID-ul este un identificator public
  pe care contactele îl schimbă deja între ele, nu un secret.
- **Admiterea persoanelor** se face prin listarea ID-urilor lor: setați
  `BREEZE_ALLOWLIST=id1,id2,…` în shell sau într-un fișier `.env` lângă
  `docker-compose.yml`, apoi `docker compose up -d` din nou.
- **Începeți acum, admiteți mai târziu**: fără `BREEZE_ALLOWLIST` setat, releul
  rulează închis pentru toată lumea — jurnalul de pornire o spune — și nimeni
  nu se poate înregistra până când adăugați ID-uri.
- **Releu deschis** (oricine se poate înregistra): decomentați
  `REGISTRATION_OPEN: "1"` în `docker-compose.yml`. Dacă o faceți, economia abuzului vă aparține.

### Cota de utilizare: dezactivați-o pe propriul releu

Worker-ul vine cu o **cotă de utilizare echitabilă (fair-use)** activată: per
căsuță poștală, cel mult 10.000 de depuneri/zi și 200.000/lună (o depunere este
un ciclu complet de livrare — vedeți `docs/COST_MODEL.md` §10 pentru
politică și cifre). Acel cadru există pentru *releul implicit partajat*,
care este rulat ca o intrare gratuită, ale cărei costuri variabile operatorul
ar trebui altfel să le suporte pentru toată lumea. **Pe un releu pe care îl rulați
pentru dumneavoastră și oamenii dumneavoastră, cadrul nu are rost — dezactivați-l**:

```bash
USAGE_QUOTA_ENABLED=false
```

Setați-o oriunde releul își citește mediul (shell-ul sau
`.env` lângă `docker-compose.yml`, mediul procesului Node,
sau secretele Cloudflare Pages). Există două butoane vecine dacă
rulați un releu comunitar și *chiar doriți* un cadru:
`USAGE_QUOTA_DAILY` și `USAGE_QUOTA_MONTHLY` reajustează limitele.
Note care contează:

- Cota este aplicată numai atunci când căsuțele poștale trăiesc în Durable
  Objects (`MAILBOX_BACKEND=do`, implicit pe acest host); pe backend-ul
  KV este un no-op documentat.
- Peste limită, expeditorii primesc un `429 USAGE_QUOTA_EXCEEDED` explicit
  (cu fereastra și limita ei) în loc de o renunțare tăcută — mesajul
  rămâne în căsuța de ieșire (outbox) a expeditorului, iar destinatarul rămâne
  accesibil prin P2P și prin orice alt releu de domiciliu.

### Identitatea releului

La prima pornire, releul generează o cheie de identitate Ed25519 persistentă
*în interiorul volumului de date* și își tipărește amprenta în jurnal:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Amprenta identifică releul *dumneavoastră*: dați-o utilizatorilor
pe un canal separat (out-of-band: în persoană, printr-un alt canal), ca să poată recunoaște
releul care le-a fost dat drept cel pe care îl rulați dumneavoastră. Aceeași amprentă
se tipărește la fiecare pornire; dacă se schimbă vreodată, volumul de date a fost
înlocuit — investigați înainte de a le spune utilizatorilor să aibă încredere în cel nou.

Clienții verifică și fixează (pin) automat această cheie (etapa 2, pasul 4): la
primul contact, un client provoacă releul să semneze cu cheia
(`/api/relay/attest`), stochează cheia verificată împreună cu contul și
o reverifică la fiecare sesiune ulterioară. Amprenta pe care o arată clientul
(sub `/security`, și în notificarea (toast) de la prima fixare) este derivată din
aceeași cheie — comparați-o cu linia din jurnalul de pornire de mai sus. Dacă cheia
se schimbă vreodată, clienții **încetează să mai vorbească cu releul** și avertizează
utilizatorul; nu refixeză niciodată în tăcere. Tratați o schimbare de amprentă ca un
eveniment de ruptură: nu există un buton în aplicație „am încredere în noua cheie” în
pasul 4, așa că după o pierdere reală a volumului utilizatorii dumneavoastră trebuie să șteargă datele
stocate ale aplicației pentru contul lor și să refixeze la primul contact —
anunțați noua amprentă pe un canal separat mai întâi, altfel nu pot deosebi
noua dumneavoastră cheie de cea a unui atacator.

### Copie de rezervă și restaurare

**Volumul de date este întreaga stare a releului**: un singur fișier SQLite
care conține directorul, căsuțele poștale și cheia de identitate a releului.
Nu mai este nimic altceva de copiat de rezervă.

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

### Actualizare

```bash
git pull origin main
docker compose up -d --build
```

Starea trăiește în volum, nu în imagine, așa că actualizarea nu atinge niciodată
datele utilizatorilor dumneavoastră.

## Găzduire proprie cu Node simplu (fără Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Configurarea se face numai prin variabile de mediu — `server/README.md`
le listează pe toate. Două diferențe față de calea Docker:

- **Fișierul de date** are ca implicit `./breeze-relay.db` (poate fi suprascris cu
  `BREEZE_DB_PATH`); este aceeași stare într-un singur fișier, identitatea releului
  inclusă. Faceți-i copie de rezervă în același mod: oprire, copiere, repornire.
- **Înregistrarea este deschisă, dacă nu o închideți**: valoarea implicită închisă
  este o proprietate a ambalării Docker. Pentru a închide o intrare simplă, setați
  `REGISTRATION_ALLOWLIST=id1,id2` (sau o valoare goală pentru
  închis-pentru-toată-lumea); `REGISTRATION_OPEN=1` o redeschide explicit.

## Instalare Cloudflare

### Instalare minimă (0 dolari/lună, 5 minute)

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

**Asta este tot.** Toate funcțiile merg, cu excepția notificărilor push. Rețineți
că înregistrarea pe o instalare Cloudflare este **deschisă**, dacă nu
setați dumneavoastră `REGISTRATION_ALLOWLIST` (vedeți `.env.example`); ambalarea
închisă-în-mod-implicit este calea Docker de mai sus.

### Ce funcționează la 0 dolari

| Funcție | Stare | Note |
|---------|--------|-------|
| Chat criptat E2E | ✓ | Double Ratchet complet |
| Mesagerie P2P | ✓ | WebRTC DataChannel |
| Apeluri vocale/video | ✓ | WebRTC + STUN gratuit |
| Releu TURN | ✓ | Open Relay (20 GB/lună gratuit) |
| Grupuri (1.000 de membri) | ✓ | Sender Key O(1) |
| Transfer de fișiere | ✓ | Până la 50 MB prin P2P |
| 51 de limbi | ✓ | Engleza inclusă + 50 de fișiere locale complete, detectate automat |
| Offline/PWA | ✓ | Service Worker |
| Notificări push | ✗ | Necesită chei VAPID |

Facturarea pe mai multe niveluri de cont (Lite/Plus/Pro) nu este disponibilă — vedeți
secțiunea „Removed: multi-account billing” din [SECURITY.md](../../SECURITY.md). Fiecare cont primește
subconturi locale nelimitate, gratuit, fără nicio condiționare de plan.

### Limitele nivelului gratuit

| Resursă | Nivel gratuit | Utilizare per utilizator activ |
|----------|-----------|----------------------|
| Cereri Worker | 100.000/zi | ~500/zi (interogare + semnalizare) |
| Citiri KV | 100.000/zi | ~200/zi |
| Scrieri KV | 1.000/zi | ~350/zi (optimizat) |
| Stocare KV | 1 GB | ~10 KB/utilizator |
| Fișiere statice | Nelimitat | ~894 KB (un singur HTML) |

**Suportă ~3 utilizatori activi simultan pe nivelul gratuit.**

### Adăugarea funcțiilor opționale

#### Notificări push (gratuite)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Server TURN (pentru rețele restrictive)

TURN este modul în care apelurile și conexiunile numai-prin-releu (care ascund IP-ul) traversează
NAT-urile restrictive. Ce TURN oferă releul dumneavoastră este alegerea **dumneavoastră** ca
operator — Worker-ul încearcă, în ordine:

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

**Verificați ce ați configurat de fapt:** `GET /api/health` raportează
modul efectiv ca `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Booleanul mai vechi `turn` reflectă numai
`TURN_URL`, așa că arată `false` pentru Opțiunea A recomandată — folosiți
`turnProvider`. Clienții arată același furnizor în `/security`, așa că un
utilizator aflat pe rezerva Open Relay poate vedea că o terță parte îi retransmite
media apelului (numai metadate — media în sine este criptată DTLS-SRTP).

#### Întărirea autentificării și calea releului simplu

Încărcările de prekey păstrează acum proprietatea semnării separat la
`prekey-owner:<userId>`, **fără TTL**. Proprietatea existentă a pachetului migrează leneș
la următoarea încărcare, înainte ca o înlocuire să fie acceptată. Noile pachete Ed25519
stabilesc și ele acea înregistrare. Păstrați aceste înregistrări când curățați pachetele prekey expirate:
așteptarea expirării pachetului nu trebuie să permită un proprietar nou. Rotirea necesită o
încărcare semnată de proprietarul anterior, legând noua cheie în digestul de încărcare existent. `/account/delete` autentificat șterge ambele înregistrări și se poate autentifica
față de proprietar chiar și după expirarea pachetului. Nu există resetare pentru cheia de proprietar pierdută.

Pentru conturile cu această înregistrare, încărcarea și interogarea de mesaje/sealed, ACK-ul sealed și
dovezile WebSocket ale căsuței poștale trebuie să folosească proprietarul durabil. **Cererile nesemnate sunt
respinse chiar și cu `PREKEY_REQUIRE_AUTH=false` sau `QUEUE_REQUIRE_AUTH=false`.**
Acele steaguri își păstrează valorile implicite existente și semantica moștenită pentru conturile
fără proprietar; acceptarea explicită `false` a cererilor nesemnate de încărcare/coadă
înregistrează un avertisment de depreciere fără conținut. Celelalte steaguri de autentificare sunt neschimbate.
WebSocket-urile căsuței poștale cer în continuare semnături de la toată lumea.

Clientul așteaptă inițializarea semnării înainte de activitatea de coadă, inclusiv
pornirea unui cont care revine, promovarea la lider și reconectarea. Așteptarea partajată este
limitată la cinci secunde. Runtime-urile neacceptate continuă nesemnate imediat;
desfacerea blocată a IDB/cheilor continuă nesemnată după limită, apoi semnează când este gata.
Acest lucru ține bucla de interogare în viață, **nu** este o ocolire: conturile cu proprietar nu pot
primi de la releu până când cheia lor de semnare nu este utilizabilă. Instalați fișierele client actualizate
alături de Worker pentru a evita vechea cursă de la pornire.

Migrarea nu poate recupera proprietatea dintr-un pachet care a expirat **înainte** ca
proprietarul său să fie păstrat. Prima înregistrare rămâne TOFU. Înregistrările de proprietate folosesc
backend-ul KV existent: consistența eventuală și scrierile concurente nu sunt făcute
linearizabile de această schimbare. Dovezile păstrează fereastra de prospețime existentă de cinci minute
și legarea de operație/încărcătură; reîncercările identice în fereastră nu sunt un
protocol nonce de unică folosință.

Scrierile de prezență și emiterea de credențiale TURN cer deja un cont *înregistrat*
(pachet prekey prezent) în mod implicit, iar fiecare client se înregistrează
automat. Bătăile de inimă ale prezenței poartă în plus o dovadă de proprietate Ed25519
(bătaia semnează câmpurile pe care le stochează), pe care Worker-ul o verifică
ori de câte ori una este prezentată — `PRESENCE_SIGN_REQUIRE_AUTH=true` face acea
dovadă obligatorie. Celelalte steaguri de semnătură Ed25519 rămân opt-in;
`wrangler.toml` le documentează pe fiecare și de ce (clienții de pe runtime-uri fără
WebCrypto Ed25519 nu pot semna deloc).

Releul simplu moștenit (`/api/msg/send`, `/api/msg/poll`) este depreciat: răspunsurile sale
poartă un antet `Deprecation: true`, iar calea sealed este ruta
implicită pentru fiecare client actual. Odată ce ați confirmat că niciun client activ
nu mai are nevoie de rezervă, dezactivați-o de tot:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Domeniu personalizat

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Scalare dincolo de nivelul gratuit

Când depășiți nivelul gratuit (planul Workers Paid de 5 dolari/lună):

| Resursă | Plan plătit |
|----------|-----------|
| Cereri Worker | 10 milioane/lună |
| Scrieri KV | 1 milion/lună |
| Stocare KV | 1 GB inclus |
| Timp CPU | 30 de secunde/cerere |

Acest lucru suportă **mii de utilizatori simultani**.

### Actualizare

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Fără pas de build. Fără dependențe de instalat. Doar instalare (deploy).
