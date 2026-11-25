# Guida all'installazione sul proprio server

**Leggi in un'altra lingua**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · Italiano (questa pagina) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


> **Prima di iniziare: l'installazione standard richiede un account Cloudflare.**
> L'installazione standard di questa guida — la distribuzione
> su Cloudflare descritta sotto — funziona su Cloudflare, quindi
> prepara un account Cloudflare prima di iniziare. Se non vuoi
> usare Cloudflare, le installazioni con Docker e con Node nudo
> di questa guida non richiedono un account Cloudflare.

Ci sono due modi per eseguire un relè di Breeze:

1. **Auto-ospitato (Node + Docker)** — il relè sulla tua macchina o
   VPS: un contenitore, un volume di dati, registrazione chiusa per
   impostazione predefinita. Inizia qui se il relè è per te e le tue persone.
2. **Cloudflare** — la distribuzione in stile ufficiale sul piano
   gratuito di Cloudflare (il relè che Breeze stesso esegue). Inizia lì se vuoi
   un relè pubblico senza un server da mantenere.

Entrambi eseguono esattamente lo stesso codice gestore; un relè è una casella postale
semplice e intercambiabile in entrambi i casi, e ogni client funziona con
ogni relè.

## Auto-ospitato con Docker

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

Il relè serve HTTP in chiaro sulla porta 8787 dentro il contenitore.
**Termina TLS a un proxy inverso davanti a esso** (Caddy, nginx,
Traefik, un Cloudflare Tunnel, …): i browser useranno un relè solo
tramite HTTPS/WSS. Quando lo fai, imposta `TRUST_PROXY: "true"` in
`docker-compose.yml` affinché la limitazione della frequenza si basi sull'indirizzo reale del
client — e non impostarlo mai senza un proxy del genere, perché l'intestazione
di cui si fida può essere falsificata da chiunque possa raggiungere direttamente l'ingresso.

Esegui esattamente **un** contenitore sul volume di dati: il limitatore
di frequenza è in memoria per processo e le operazioni di ogni casella postale sono
serializzate dentro quel processo, quindi una seconda replica non manterrebbe
nessuna delle due proprietà. Scala dando al singolo processo una macchina più grande.

### Registrazione: chiusa per impostazione predefinita

Un relè auto-ospitato su cui chiunque su internet potesse registrarsi
ricreerebbe l'economia di spam/abuso che i limiti del relè ufficiale
esistono per controllare, quindi **il pacchetto Docker viene fornito chiuso**: il
file compose passa un `REGISTRATION_ALLOWLIST` (eventualmente vuoto) e
solo gli ID Breeze in esso contenuti possono *creare account* (un primo caricamento di
prekey). Chiudere la registrazione non influisce mai sulle persone già ospitate sul
relè — i loro caricamenti, depositi, appuntamenti e interrogazioni non sono
filtrati — e aprire la registrazione è una scelta esplicita, mai il
valore predefinito.

- **Il tuo ID Breeze** è l'identificatore di 12 caratteri nel tuo collegamento di invito
  (i primi 12 caratteri del suo valore `pub`). Chiedi a ogni persona
  che inviti il suo allo stesso modo — l'ID è un identificatore pubblico
  che i contatti già si scambiano, non un segreto.
- **Ammetti persone** elencando i loro ID: imposta
  `BREEZE_ALLOWLIST=id1,id2,…` nella tua shell o in un file `.env` accanto a
  `docker-compose.yml`, poi di nuovo `docker compose up -d`.
- **Inizia ora, ammetti dopo**: senza `BREEZE_ALLOWLIST` impostato, il
  relè funziona chiuso a tutti — il registro di avvio lo dice — e nessuno
  può registrarsi finché non aggiungi ID.
- **Relè aperto** (chiunque può registrarsi): decommenta
  `REGISTRATION_OPEN: "1"` in `docker-compose.yml`. Se lo fai, l'economia dell'abuso è tua.

### Quota di utilizzo: disattivala sul tuo relè

Il worker viene fornito con una **quota di utilizzo equo** attivata: per
casella postale, al massimo 10.000 depositi/giorno e 200.000/mese (un deposito è
un ciclo completo di consegna — vedi `docs/COST_MODEL.md` §10 per la
politica e le cifre). Quel quadro esiste per il *relè predefinito condiviso*,
che viene gestito come un ingresso gratuito i cui costi variabili
il gestore altrimenti sosterrebbe per tutti. **Su un relè che gestisci
per te e le tue persone, il quadro è inutile — disattivalo**:

```bash
USAGE_QUOTA_ENABLED=false
```

Impostalo dove il tuo relè legge il suo ambiente (la shell o
`.env` accanto a `docker-compose.yml`, l'ambiente del processo Node,
o i segreti di Cloudflare Pages). Esistono due manopole vicine se
gestisci un relè di comunità e *vuoi* un quadro:
`USAGE_QUOTA_DAILY` e `USAGE_QUOTA_MONTHLY` ricalibrano i limiti.
Note che contano:

- La quota viene applicata solo quando le caselle postali vivono in Durable
  Objects (`MAILBOX_BACKEND=do`, il valore predefinito su questo host); sul
  backend KV è un no-op documentato.
- Superato il limite, i mittenti ricevono un esplicito `429 USAGE_QUOTA_EXCEEDED`
  (con la finestra e il suo limite) invece di una caduta silenziosa — il
  messaggio resta nella casella in uscita del mittente, e il destinatario rimane
  raggiungibile tramite P2P e tramite qualsiasi altro relè di origine.

### Identità del relè

Al primo avvio il relè genera una chiave di identità Ed25519 persistente
*all'interno del volume di dati* e ne stampa l'impronta nel registro:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

L'impronta identifica *il tuo* relè: consegnala ai tuoi utenti
fuori banda (di persona, tramite un altro canale) affinché possano riconoscere
il relè che è stato loro consegnato come quello che gestisci tu. La stessa impronta
si stampa a ogni avvio; se mai cambia, il volume di dati è stato
sostituito — indaga prima di dire agli utenti di fidarsi della nuova.

I client verificano e fissano questa chiave automaticamente (fase 2, passo 4): al
primo contatto un client sfida il relè a firmare con la chiave
(`/api/relay/attest`), memorizza la chiave verificata con l'account, e
la riverifica a ogni sessione successiva. L'impronta che il client mostra
(in `/security`, e nel toast al primo fissaggio) è derivata dalla
stessa chiave — confrontala con la riga del registro di avvio qui sopra. Se la chiave
cambia mai, i client **smettono di parlare con il relè** e avvisano
l'utente; non la rifissano mai in silenzio. Tratta un cambio di impronta come un
evento di rottura: non c'è un pulsante «fidati della nuova chiave» nell'app nel
passo 4, quindi, dopo una vera perdita del volume, i tuoi utenti devono cancellare i
dati memorizzati dell'app per il loro account e rifissarla al primo contatto —
annuncia prima la nuova impronta fuori banda, altrimenti non potranno distinguere
la tua nuova chiave da quella di un attaccante.

### Backup e ripristino

**Il volume di dati è l'intero stato del relè**: un file SQLite
che contiene la directory, le caselle postali e la chiave di identità del relè.
Non c'è nient'altro di cui fare il backup.

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

### Aggiornamento

```bash
git pull origin main
docker compose up -d --build
```

Lo stato vive nel volume, non nell'immagine, quindi l'aggiornamento non tocca mai
i dati dei tuoi utenti.

## Auto-ospitato con Node nudo (senza Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

La configurazione avviene solo tramite variabili d'ambiente — `server/README.md`
le elenca tutte. Due differenze rispetto alla via Docker:

- Il **file di dati** predefinito è `./breeze-relay.db` (modificabile con
  `BREEZE_DB_PATH`); è lo stesso stato in un unico file, identità del relè
  inclusa. Fanne il backup allo stesso modo: ferma, copia, riavvia.
- **La registrazione è aperta a meno che tu non la chiuda**: il valore chiuso predefinito
  è una proprietà del pacchetto Docker. Per chiudere un ingresso nudo, imposta
  `REGISTRATION_ALLOWLIST=id1,id2` (o un valore vuoto per
  chiuso a tutti); `REGISTRATION_OPEN=1` la riapre esplicitamente.

## Distribuzione su Cloudflare

### Distribuzione minima (0 $/mese, 5 minuti)

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

**Ecco fatto.** Tutte le funzioni funzionano tranne le notifiche push. Nota
che la registrazione su una distribuzione Cloudflare è **aperta** a meno che tu
non imposti `REGISTRATION_ALLOWLIST` tu stesso (vedi `.env.example`); il
pacchetto chiuso per impostazione predefinita è la via Docker qui sopra.

### Cosa funziona a 0 $

| Funzione | Stato | Note |
|---------|--------|-------|
| Chat cifrata E2E | ✓ | Double Ratchet completo |
| Messaggistica P2P | ✓ | WebRTC DataChannel |
| Chiamate vocali/video | ✓ | WebRTC + STUN gratuito |
| Relè TURN | ✓ | Open Relay (20GB/mese gratuiti) |
| Gruppi (1.000 membri) | ✓ | Sender Key O(1) |
| Trasferimento di file | ✓ | Fino a 50MB tramite P2P |
| 51 lingue | ✓ | Inglese integrato + 50 file di locale completi, rilevamento automatico |
| Offline/PWA | ✓ | Service Worker |
| Notifiche push | ✗ | Servono chiavi VAPID |

La fatturazione multi-account (Lite/Plus/Pro) non è disponibile — vedi la sezione
«Removed: multi-account billing» di [SECURITY.md](../../SECURITY.md). Ogni account ottiene
sotto-account locali illimitati gratuitamente e senza controllo tramite piani.

### Limiti del piano gratuito

| Risorsa | Piano gratuito | Uso per utente attivo |
|----------|-----------|----------------------|
| Richieste al Worker | 100.000/giorno | ~500/giorno (interrogazioni + segnalazione) |
| Letture KV | 100.000/giorno | ~200/giorno |
| Scritture KV | 1.000/giorno | ~350/giorno (ottimizzato) |
| Archiviazione KV | 1 GB | ~10 KB/utente |
| Risorse statiche | Illimitato | ~894 KB (un unico HTML) |

**Supporta ~3 utenti attivi contemporanei sul piano gratuito.**

### Aggiungere funzioni opzionali

#### Notifiche push (gratis)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Server TURN (per reti restrittive)

TURN è il modo in cui le chiamate e le connessioni solo tramite relè (che nascondono l'IP) attraversano
i NAT restrittivi. Quale TURN il tuo relè consegna è una **tua** scelta come
gestore — il Worker prova, in ordine:

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

**Verifica ciò che hai effettivamente configurato:** `GET /api/health` riporta la
modalità effettiva come `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Il booleano `turn` più vecchio riflette solo
`TURN_URL`, quindi indica `false` per l'opzione A consigliata — usa
`turnProvider`. I client mostrano lo stesso fornitore in `/security`, quindi un
utente sul ripiego Open Relay può vedere che un terzo inoltra i media della sua
chiamata (solo metadati — i media stessi sono cifrati DTLS-SRTP).

#### Rafforzamento dell'autenticazione e percorso di relè semplice

I caricamenti di prekey ora conservano la proprietà della firma separatamente in
`prekey-owner:<userId>` **senza TTL**. La proprietà dei pacchetti esistenti migra pigramente
al caricamento successivo, prima che una sostituzione venga accettata. Anche i nuovi pacchetti Ed25519
stabiliscono quel record. Conserva questi record quando poti i pacchetti prekey scaduti:
aspettare la scadenza del pacchetto non deve permettere un nuovo proprietario. La rotazione richiede un
caricamento firmato dal proprietario precedente, che lega la nuova chiave nel digest di caricamento esistente. Il `/account/delete` autenticato cancella entrambi i record e può autenticarsi
contro il proprietario anche dopo la scadenza del pacchetto. Non esiste un ripristino per chiave del proprietario persa.

Per gli account con questo record, il caricamento e l'interrogazione di messaggi/sigillati, l'ACK sigillato e
le prove WebSocket della casella postale devono usare il proprietario durevole. **Le richieste non firmate vengono
respinte anche con `PREKEY_REQUIRE_AUTH=false` o `QUEUE_REQUIRE_AUTH=false`.**
Quelle bandiere conservano i loro valori predefiniti e la semantica ereditata per gli account
senza proprietario; l'accettazione esplicita a `false` di richieste di caricamento/coda non firmate
registra un avviso di obsolescenza privo di contenuto. Le altre bandiere di autenticazione sono invariate.
I WebSocket della casella postale richiedono comunque firme per tutti.

Il client attende l'inizializzazione della firma prima dell'attività di coda, incluso
l'avvio degli account di ritorno, la promozione a leader e la riconnessione. L'attesa condivisa è
limitata a cinque secondi. Gli ambienti non supportati continuano non firmati immediatamente;
un IDB/svolgimento della chiave bloccato continua non firmato dopo il limite, poi firma quando è pronto.
Ciò mantiene vivo il ciclo di interrogazione, **non** è un aggiramento: gli account sostenuti da proprietario non possono
ricevere dal relè finché la loro chiave di firma non è utilizzabile. Distribuisci le risorse client aggiornate
accanto al Worker per evitare la vecchia corsa all'avvio.

La migrazione non può recuperare la proprietà da un pacchetto scaduto **prima** che il suo
proprietario fosse conservato. La prima registrazione resta TOFU. I record di proprietà usano il
backend KV esistente: la consistenza eventuale e le scritture concorrenti non sono rese
linearizzabili da questa modifica. Le prove conservano la finestra di freschezza di cinque minuti esistente
e il legame operazione/carico utile; i ritentativi identici nella finestra non sono un
protocollo nonce monouso.

Le scritture di presenza e l'emissione di credenziali TURN richiedono già un account *registrato*
(pacchetto prekey presente) per impostazione predefinita, e ogni client si registra
automaticamente. I battiti di presenza portano inoltre una prova di proprietà Ed25519
(il battito firma i campi che memorizza), che il Worker verifica
ogni volta che ne viene presentata una — `PRESENCE_SIGN_REQUIRE_AUTH=true` rende quella
prova obbligatoria. Le altre bandiere di firma Ed25519 restano opt-in;
`wrangler.toml` documenta ciascuna e il perché (i client su ambienti senza
WebCrypto Ed25519 non possono firmare affatto).

Il relè semplice ereditato (`/api/msg/send`, `/api/msg/poll`) è obsoleto: le sue
risposte portano un'intestazione `Deprecation: true`, e il percorso sigillato è la
rotta predefinita per ogni client attuale. Una volta confermato che nessun client attivo
ha ancora bisogno del ripiego, disattivalo del tutto:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Dominio personalizzato

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Scalare oltre il piano gratuito

Quando superi il piano gratuito (piano Workers Paid da 5 $/mese):

| Risorsa | Piano a pagamento |
|----------|-----------|
| Richieste al Worker | 10 milioni/mese |
| Scritture KV | 1 milione/mese |
| Archiviazione KV | 1 GB inclusa |
| Tempo CPU | 30 secondi/richiesta |

Ciò supporta **migliaia di utenti contemporanei**.

### Aggiornamento

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Nessun passaggio di compilazione. Nessuna dipendenza da installare. Basta distribuire.
