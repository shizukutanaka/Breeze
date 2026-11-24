# Gabay sa Self-Hosting

**Basahin sa ibang wika**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · Filipino (ang pahinang ito) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


May dalawang paraan para patakbuhin ang isang Breeze relay:

1. **Self-hosted (Node + Docker)** — ang relay sa sarili mong makina o
   VPS: isang container, isang data volume, sarado ang rehistro
   bilang default. Magsimula dito kung ang relay ay para sa iyo at sa iyong mga tao.
2. **Cloudflare** — ang opisyal na istilo ng deployment sa libreng tier
   ng Cloudflare (ang relay na pinapatakbo mismo ng Breeze). Magsimula doon kung gusto mo
   ng pampublikong relay na walang server na kailangang alagaan.

Parehong nagpapatakbo ng magkaparehong handler code; ang relay ay isang simpleng,
mapapalitang mailbox sa alinmang paraan, at bawat client ay gumagana sa
bawat relay.

## Self-Hosted gamit ang Docker

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

Ang relay ay nagsisilbi ng plain HTTP sa port 8787 sa loob ng container.
**Tapusin ang TLS sa isang reverse proxy sa harap nito** (Caddy, nginx,
Traefik, isang Cloudflare Tunnel, …): gagamit lang ang mga browser ng relay
sa pamamagitan ng HTTPS/WSS. Kapag ginawa mo iyon, itakda ang `TRUST_PROXY: "true"` sa
`docker-compose.yml` para ang rate limiting ay nakabatay sa tunay na client
address — at huwag itong itakda nang walang ganoong proxy, dahil ang header
na pinagkakatiwalaan nito ay mapepeke ng sinumang makakaabot nang direkta sa entry.

Magpatakbo ng eksaktong **isang** container laban sa data volume: ang rate
limiter ay nasa memorya ng bawat proseso at ang mga operasyon ng bawat mailbox ay
naka-serialize sa loob ng prosesong iyon, kaya ang pangalawang replica ay hindi
makakahawak sa alinmang katangian. Mag-scale sa pamamagitan ng pagbibigay sa isang proseso ng mas malaking makina.

### Rehistro: sarado bilang default

Ang self-hosted relay na maaaring irehistro ng sinuman sa internet
ay muling lilikha ng ekonomiya ng spam/pang-aabuso na nililimitahan ng mga limitasyon ng opisyal na relay
para kontrolin, kaya **ang Docker packaging ay sarado ang paglabas**: ang
compose file ay nagpasa ng isang `REGISTRATION_ALLOWLIST` (maaaring walang laman) at
tanging ang mga Breeze ID na naroon ang maaaring *gumawa ng mga account* (isang unang prekey
upload). Ang pagsasara ng rehistro ay hindi kailanman nakakaapekto sa mga taong nakatira na sa
relay — ang kanilang mga upload, deposito, rendezvous at poll ay hindi
naka-gate — at ang pagbubukas ng rehistro ay isang malinaw na pagpili, hindi kailanman ang
default.

- **Ang iyong Breeze ID** ay ang 12-karakter na identifier sa iyong invite
  link (ang unang 12 karakter ng halaga nitong `pub`). Tanungin ang bawat taong
  iniimbita mo ng kanya sa parehong paraan — ang ID ay isang pampublikong identifier na
  ipinagpapalitan na ng mga contact, hindi isang sikreto.
- **Tanggapin ang mga tao** sa pamamagitan ng paglista ng kanilang mga ID: itakda
  ang `BREEZE_ALLOWLIST=id1,id2,…` sa iyong shell o isang `.env` file sa tabi ng
  `docker-compose.yml`, pagkatapos ay `docker compose up -d` ulit.
- **Magsimula ngayon, tumanggap mamaya**: nang walang nakatakdang `BREEZE_ALLOWLIST`, ang
  relay ay tumatakbong sarado sa lahat — sinasabi ito ng boot log — at walang
  makakapagrehistro hangga't hindi ka nagdadagdag ng mga ID.
- **Bukas na relay** (sinuman ay maaaring magrehistro): alisin ang komento sa
  `REGISTRATION_OPEN: "1"` sa `docker-compose.yml`. Pag-aari mo ang
  ekonomiya ng pang-aabuso kung gagawin mo iyon.

### Quota sa paggamit: patayin ito sa sarili mong relay

Ang worker ay lumalabas na may **fair-use na quota sa paggamit** na naka-enable: bawat
mailbox, pinakamaraming 10,000 deposito/araw at 200,000/buwan (ang isang deposito ay
isang buong delivery cycle — tingnan ang `docs/COST_MODEL.md` §10 para sa
patakaran at sa mga numero). Ang balangkas na iyon ay umiiral para sa *ibinabahaging default
relay*, na pinapatakbo bilang libreng pasukan na ang mga variable na gastos ay
dadalhin sana ng operator para sa lahat. **Sa relay na pinapatakbo mo
para sa iyong sarili at sa iyong mga tao, walang saysay ang balangkas — patayin
ito**:

```bash
USAGE_QUOTA_ENABLED=false
```

Itakda ito saanman binabasa ng iyong relay ang environment nito (ang shell o
`.env` sa tabi ng `docker-compose.yml`, ang environment ng Node process,
o ang mga secret ng Cloudflare Pages). Dalawang kalapit na knob ang umiiral kung
nagpapatakbo ka ng community relay at *gusto* mo ng balangkas:
ang `USAGE_QUOTA_DAILY` at `USAGE_QUOTA_MONTHLY` ay muling nag-aayos ng mga cap.
Mga talang mahalaga:

- Ang quota ay ipinapatupad lang kapag ang mga mailbox ay nasa Durable
  Objects (`MAILBOX_BACKEND=do`, ang default sa host na ito); sa
  KV backend ito ay isang dokumentadong no-op.
- Lampas sa cap, ang mga nagpadala ay makakatanggap ng malinaw na `429 USAGE_QUOTA_EXCEEDED`
  (kasama ang window at ang limitasyon nito) sa halip na tahimik na pagbagsak — ang
  mensahe ay nananatili sa outbox ng nagpadala, at ang tumanggap ay nananatiling
  maaabot sa pamamagitan ng P2P at sa pamamagitan ng anumang ibang home relay.

### Pagkakakilanlan ng relay

Sa unang pag-boot, ang relay ay gumagawa ng isang persistent na Ed25519 identity key
*sa loob ng data volume* at ini-print ang fingerprint nito sa log:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Ang fingerprint ay tumutukoy sa *iyong* relay: ibigay ito sa iyong mga gumagamit
nang out-of-band (nang personal, sa ibang channel) para makilala nila
ang relay na ibinigay sa kanila bilang ang pinapatakbo mo. Ang parehong fingerprint
ay ini-print sa bawat pag-boot; kung magbago man ito, ang data volume ay
napalitan — mag-imbestiga bago sabihin sa mga gumagamit na pagkatiwalaan ang bago.

Awtomatikong bineberipika at ipini-pin ng mga client ang key na ito (stage-2 step 4): sa
unang pakikipag-ugnayan, hinahamon ng client ang relay na pumirma gamit ang key
(`/api/relay/attest`), iniimbak ang naberipikang key kasama ng account, at
muling bineberipika sa bawat susunod na session. Ang fingerprint na ipinapakita ng client
(sa ilalim ng `/security`, at sa toast sa unang pag-pin) ay nagmula sa
parehong key — ihambing ito sa linya ng boot-log sa itaas. Kung ang key
ay magbago man, ang mga client ay **titigil sa pakikipag-usap sa relay** at magbabala sa
gumagamit; hindi sila kailanman muling nagpi-pin nang tahimik. Ituring ang pagbabago ng fingerprint bilang isang
nakasisirang pangyayari: walang "pagkatiwalaan ang bagong key" na button sa loob ng app sa
step 4, kaya pagkatapos ng tunay na pagkawala ng volume, ang iyong mga gumagamit ay kailangang burahin ang
nakaimbak na data ng app para sa kanilang account at muling mag-pin sa unang pakikipag-ugnayan —
ianunsyo muna ang bagong fingerprint nang out-of-band, o hindi nila makikilala
ang bago mong key mula sa key ng umaatake.

### Backup at restore

**Ang data volume ay ang buong estado ng relay**: isang SQLite file
na naglalaman ng directory, ng mga mailbox, at ng relay identity key.
Wala nang iba pang iba-backup.

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

### Pag-update

```bash
git pull origin main
docker compose up -d --build
```

Ang estado ay nasa volume, hindi sa image, kaya ang pag-update ay hindi kailanman humahawak sa
data ng iyong mga gumagamit.

## Self-Hosted gamit ang Bare Node (walang Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Ang configuration ay environment variable lamang — inilista ng `server/README.md`
ang lahat ng ito. Dalawang pagkakaiba mula sa Docker na landas:

- Ang **data file** ay nagde-default sa `./breeze-relay.db` (i-override gamit ang
  `BREEZE_DB_PATH`); ito ay parehong single-file na estado, kasama ang relay identity. I-backup ito sa parehong paraan: huminto, kopyahin, mag-restart.
- **Ang rehistro ay bukas maliban kung isasara mo ito**: ang saradong default
  ay katangian ng Docker packaging. Para isara ang isang bare na entry, itakda
  ang `REGISTRATION_ALLOWLIST=id1,id2` (o isang walang lamang halaga para sa
  sarado-sa-lahat); ang `REGISTRATION_OPEN=1` ay malinaw na muling nagbubukas.

## Deployment sa Cloudflare

### Pinakamababang Deployment ($0/buwan, 5 minuto)

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

# 5. Visit https://breeze.pages.dev
```

**Iyon lang.** Gumagana ang lahat ng tampok maliban sa mga push notification. Tandaan
na ang rehistro sa isang Cloudflare deployment ay **bukas** maliban kung itatakda mo
ang `REGISTRATION_ALLOWLIST` mismo (tingnan ang `.env.example`); ang
sarado-bilang-default na packaging ay ang Docker na landas sa itaas.

### Ano ang Gumagana sa $0

| Tampok | Estado | Mga Tala |
|---------|--------|-------|
| E2E na naka-encrypt na chat | ✓ | Buong Double Ratchet |
| P2P na pagmemensahe | ✓ | WebRTC DataChannel |
| Voice/video na mga tawag | ✓ | WebRTC + libreng STUN |
| TURN relay | ✓ | Open Relay (20GB/buwan libre) |
| Mga grupo (100 miyembro) | ✓ | Sender Key O(1) |
| Paglipat ng file | ✓ | Hanggang 50MB sa pamamagitan ng P2P |
| 8 wika | ✓ | EN + 7 buong locale, awtomatikong natutukoy |
| Offline/PWA | ✓ | Service Worker |
| Mga push notification | ✗ | Kailangan ng VAPID keys |

Ang multi-account billing (Lite/Plus/Pro) ay hindi magagamit — tingnan ang
seksyon na "Removed: multi-account billing" ng [SECURITY.md](../../SECURITY.md). Bawat account ay nakakakuha ng
walang limitasyong lokal na sub-account nang libre nang walang plan gating.

### Mga Limitasyon ng Libreng Tier

| Resource | Libreng Tier | Paggamit bawat Aktibong Gumagamit |
|----------|-----------|----------------------|
| Mga request sa Worker | 100,000/araw | ~500/araw (polling + signaling) |
| Mga pagbasa sa KV | 100,000/araw | ~200/araw |
| Mga pagsulat sa KV | 1,000/araw | ~350/araw (na-optimize) |
| Imbakan sa KV | 1 GB | ~10 KB/gumagamit |
| Mga static asset | Walang limitasyon | ~400 KB (iisang HTML) |

**Sumusuporta ng ~3 sabay-sabay na aktibong gumagamit sa libreng tier.**

### Pagdaragdag ng mga Opsyonal na Tampok

#### Mga Push Notification (libre)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN Server (para sa mga mahigpit na network)

Ang TURN ay kung paano tumatawid ang mga tawag at mga koneksyong relay-only (nagtatago ng IP) sa
mga mahigpit na NAT. Aling TURN ang ibibigay ng iyong relay ay **iyong** pagpili bilang
operator — sinusubukan ng Worker, sa ganitong pagkakasunod:

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

**Beripikahin kung ano talaga ang na-configure mo:** Ini-uulat ng `GET /api/health` ang
epektibong mode bilang `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Ang mas lumang boolean na `turn` ay sumasalamin lamang sa
`TURN_URL`, kaya nagbabasa ito ng `false` para sa inirerekomendang Option A — gamitin
ang `turnProvider`. Ipinapakita ng mga client ang parehong provider sa `/security`, kaya ang
gumagamit na nasa Open Relay fallback ay makikita na may ikatlong partido na nagre-relay ng kanilang
media ng tawag (metadata lamang — ang media mismo ay DTLS-SRTP na naka-encrypt).

#### Pagpapatigas ng Auth at ang Plain Relay Path

Ang mga prekey upload ay nag-iingat na ngayon ng pagmamay-ari ng lagda nang hiwalay sa
`prekey-owner:<userId>` na **walang TTL**. Ang umiiral na pagmamay-ari ng bundle ay tamad na lumilipat
sa susunod na upload, bago tanggapin ang isang kapalit. Ang mga bagong Ed25519 bundle rin ay
nagtatatag ng rekord na iyon. Panatilihin ang mga rekord na ito kapag nag-aalis ng mga expired na prekey bundle:
ang paghihintay sa pag-expire ng bundle ay hindi dapat magpahintulot ng bagong may-ari. Ang rotation ay nangangailangan ng
upload na nilagdaan ng nakaraang may-ari, na nagbibigkis sa bagong key sa umiiral na upload
digest. Ang naka-authenticate na `/account/delete` ay nagbubura sa dalawang rekord at maaaring mag-authenticate
laban sa may-ari kahit pagkatapos ng pag-expire ng bundle. Walang reset para sa nawawalang susi ng may-ari.

Para sa mga account na may rekord na ito, ang upload at message/sealed poll, sealed ACK at
mga patunay ng mailbox WebSocket ay dapat gumamit ng matibay na may-ari. **Ang mga hindi nilagdaang request ay
tinatanggihan kahit na may `PREKEY_REQUIRE_AUTH=false` o `QUEUE_REQUIRE_AUTH=false`.**
Ang mga flag na iyon ay pinapanatili ang kanilang umiiral na mga default at legacy na semantika para sa mga account na
walang may-ari; ang malinaw na `false` na pagtanggap sa mga hindi nilagdaang upload/queue na request
ay nagla-log ng babala ng pagka-deprecate na walang nilalaman. Ang ibang mga auth flag ay hindi nagbago.
Ang mga mailbox WebSocket ay nangangailangan pa rin ng mga lagda para sa lahat.

Ang client ay naghihintay sa pagsisimula ng paglagda bago ang aktibidad ng queue, kasama ang
pag-boot ng bumabalik na account, pag-promote ng leader at muling pagkonekta. Ang ibinabahaging paghihintay ay
nakatali sa limang segundo. Ang mga hindi sinusuportahang runtime ay nagpapatuloy nang hindi nilagdaan kaagad;
ang natigil na IDB/key-unwrapping ay nagpapatuloy nang hindi nilagdaan pagkatapos ng hangganan, pagkatapos ay pumipirma kapag handa na.
Pinapanatili nitong buhay ang poll loop, **hindi** isang bypass: ang mga account na suportado ng may-ari ay hindi
makakatanggap mula sa relay hangga't hindi magagamit ang kanilang signing key. I-deploy ang mga na-update na client
asset kasama ng Worker para maiwasan ang lumang karera sa pagsisimula.

Hindi mababawi ng migration ang pagmamay-ari mula sa isang bundle na nag-expire **bago** ang
may-ari nito ay naingatan. Ang unang rehistro ay nananatiling TOFU. Ang mga rekord ng pagmamay-ari ay gumagamit ng
umiiral na KV backend: ang eventual consistency at mga sabay-sabay na pagsulat ay hindi ginagawang
linearizable ng pagbabagong ito. Pinapanatili ng mga patunay ang umiiral na limang-minutong freshness
window at ang pagbibigkis ng operasyon/payload; ang magkaparehong retry sa loob ng window ay hindi isang
one-time nonce protocol.

Ang mga pagsulat ng presence at ang pag-isyu ng TURN credential ay nangangailangan na ng *nakarehistrong*
account (may prekey bundle) bilang default, at bawat client ay awtomatikong nagrerehistro.
Ang mga presence heartbeat ay nagdadala rin ng Ed25519 na patunay ng pagmamay-ari
(pinipirmahan ng beat ang mga field na iniimbak nito), na bineberipika ng Worker
sa tuwing may inihaharap — ginagawa ng `PRESENCE_SIGN_REQUIRE_AUTH=true` na
mandatoryo ang patunay na iyon. Ang natitirang mga Ed25519-signature flag ay nananatiling opt-in;
dinodokumento ng `wrangler.toml` ang bawat isa at kung bakit (ang mga client sa mga runtime na walang
WebCrypto Ed25519 ay hindi talaga makapirma).

Ang legacy na plain relay (`/api/msg/send`, `/api/msg/poll`) ay deprecated: ang
mga tugon nito ay may header na `Deprecation: true`, at ang sealed na landas ay ang
default na ruta para sa bawat kasalukuyang client. Kapag nakumpirma mo nang walang live na
client na nangangailangan pa ng fallback, patayin ito nang tuluyan:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Custom Domain

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Pag-scale Lampas sa Libreng Tier

Kapag lumampas ka sa libreng tier ($5/buwan na Workers Paid plan):

| Resource | Bayad na Plano |
|----------|-----------|
| Mga request sa Worker | 10 milyon/buwan |
| Mga pagsulat sa KV | 1 milyon/buwan |
| Imbakan sa KV | 1 GB kasama |
| Oras ng CPU | 30 segundo/request |

Sumusuporta ito ng **libu-libong sabay-sabay na gumagamit**.

### Pag-update

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Walang hakbang ng pag-build. Walang mga dependency na i-i-install. I-deploy lang.
