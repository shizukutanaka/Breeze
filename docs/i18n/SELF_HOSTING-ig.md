# Nduzi Itinye na Sava nke Gị

**Gụọ n'asụsụ ọzọ**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · Igbo (ibe a) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Enwere ụzọ abụọ iji rụọ nnyefe Breeze (relay):

1. **Itinye na sava nke gị (Node + Docker)** — nnyefe na ngwaọrụ nke gị ma ọ bụ
   VPS: otu akpa (container), otu mpịakọta data, ndebanye aha emechiri
   na ndabara. Bido ebe a ma ọ bụrụ na nnyefe bụ nke gị na nke ndị gị.
2. **Cloudflare** — nnyefe dịka nke gọọmentị na oke n'efu Cloudflare
   (nnyefe Breeze n'onwe ya na-arụ). Bido ebe ahụ ma ọ bụrụ na ị chọrọ
   nnyefe ọha na-enweghị sava ị ga-elekọta.

Ha abụọ na-agba otu koodu njikwa ahụ; nnyefe bụ igbe ozi na-enweghị ọgụgụ isi,
nke a na-agbanwe agbanwe n'ụzọ ọ bụla, ngwa ndị ahịa niile na-arụkọ ọrụ na
nnyefe ọ bụla.

## Itinye na Sava nke Gị na Docker

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

Nnyefe na-enye HTTP nkịtị na ọdụ ụgbọ mmiri 8787 n'ime akpa ahụ.
**Kwụsị TLS na proxy ntụgharị (reverse proxy) n'ihu ya** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): ihe nchọgharị ga-eji nnyefe naanị
site na HTTPS/WSS. Mgbe ị mere ya, tọọ `TRUST_PROXY: "true"` n'ime
`docker-compose.yml` ka mmachi ọnụego wee dabere na adreesị onye ahịa
n'ezie — ma atọọla ya ma ọ bụrụ na enweghị proxy dị otú ahụ, n'ihi na nkụnye eji isi (header)
ọ tụkwasịrị obi onye ọ bụla nwere ike iru ọnụ ụzọ ozugbo nwere ike ịkpụ ya.

Gbaa kpọmkwem akpa **otu** megide mpịakọta data ahụ: mmachi ọnụego
dị na ebe nchekwa maka usoro ọ bụla, ọrụ igbe ozi ọ bụla na-ahazikwa n'usoro
n'ime usoro ahụ, ya mere oyiri nke abụọ agaghị ejide
kedu n'ime ihe ndị ahụ. Mee nha site n'inye otu usoro ahụ igwe ka ukwuu.

### Ndebanye aha: emechiri na ndabara

Nnyefe sava nke gị nke onye ọ bụla na ịntanetị nwere ike idebanye aha na ya
ga-emegharị akụ na ụba ozi mkpofu/ojiji na-ezighi ezi nke oke nnyefe gọọmentị
dị iji chịkwaa, ya mere **nkwakọ ngwaahịa Docker na-abịa emechiri**: faịlụ
compose na-agafe `REGISTRATION_ALLOWLIST` (nke nwere ike ịbụ efu) na
naanị ID Breeze dị na ya nwere ike *ịmepụta akaụntụ* (nbudata prekey
mbụ). Imechi ndebanye aha anaghị emetụta ndị nọbu n'ụlọ
na nnyefe — nbudata ha, nkwụnye ha, nzukọ ha na ntule ha enweghị
mgbochi — imeghe ndebanye aha bụ nhọrọ doro anya, ọ bụghị ndabara ma ọlị.

- **ID Breeze gị** bụ njirimara mkpụrụedemede 12 dị na njikọ òkpùkpọ gị
  (mkpụrụedemede 12 mbụ nke uru `pub` ya). Jụọ onye ọ bụla ị kpọrọ
  nke ha n'otu ụzọ ahụ — ID bụ njirimara ọha
  nke ndị kọntaktị na-agbanwebarị, ọ bụghị ihe nzuzo.
- **Nabata ndị mmadụ** site na ịdepụta ID ha: tọọ
  `BREEZE_ALLOWLIST=id1,id2,…` na shell gị ma ọ bụ faịlụ `.env` n'akụkụ
  `docker-compose.yml`, wee `docker compose up -d` ọzọ.
- **Bido ugbu a, nabata ma emechaa**: na-enweghị `BREEZE_ALLOWLIST` atọọ, nnyefe
  na-agba emechiri nye onye ọ bụla — ndekọ mmalite na-ekwu ya — ọ dịghịkwa onye
  nwere ike idebanye aha ruo mgbe ị gbakwụnyere ID.
- **Nnyefe meghere** (onye ọ bụla nwere ike idebanye aha): wepụ nkọwa na
  `REGISTRATION_OPEN: "1"` n'ime `docker-compose.yml`. Ị bụ onye nwe
  akụ na ụba ojiji na-ezighi ezi ma ọ bụrụ na ị mee ya.

### Oke ojiji: gbanyụọ ya na nnyefe nke gị

Worker na-abịa na **oke ojiji ojiji ziri ezi** agbanyere: maka igbe ozi
ọ bụla, na kacha nkwụnye 10,000 kwa ụbọchị na 200,000 kwa ọnwa (otu nkwụnye bụ
otu okirikiri nnyefe zuru oke — lee `docs/COST_MODEL.md` §10 maka
amụma na ọnụọgụ). Usoro ahụ dị maka *nnyefe ndabara a na-ekerịta*,
nke a na-arụ dịka ọnụ ụzọ n'efu nke ọnụ ahịa mgbanwe onye ọrụ ya
gaara ebu maka onye ọ bụla ma ọ bụghị ya. **Na nnyefe ị na-arụ
maka onwe gị na ndị gị, usoro ahụ enweghị isi — gbanyụọ
ya**:

```bash
USAGE_QUOTA_ENABLED=false
```

Tọọ ya ebe ọ bụla nnyefe gị na-agụ gburugburu ya (shell ma ọ bụ
`.env` n'akụkụ `docker-compose.yml`, gburugburu usoro Node,
ma ọ bụ ihe nzuzo Cloudflare Pages). Bọtịnụ abụọ dị nso dị ma ọ bụrụ na ị
na-arụ nnyefe obodo ma *ịchọrọ* usoro:
`USAGE_QUOTA_DAILY` na `USAGE_QUOTA_MONTHLY` na-emegharị oke ndị ahụ.
Ihe ndị dị mkpa:

- A na-amanye oke ahụ naanị mgbe igbe ozi bi na Durable
  Objects (`MAILBOX_BACKEND=do`, ndabara na onye ọbịa a); na
  ndabere KV, edepụtara ya dịka enweghị ọrụ.
- Mgbe oke gachara, ndị zitere na-enweta `429 USAGE_QUOTA_EXCEEDED` doro anya
  (na windo ya na oke ya) kama ịtụpụ na nzuzo — ozi ahụ
  na-anọ n'igbe ọpụpụ onye zitere, onye natara na-anọgidekwa
  enwere ike iru ya site na P2P na site na nnyefe ụlọ ọ bụla ọzọ.

### Njirimara nnyefe

Na mmalite mbụ nnyefe na-emepụta igodo njirimara Ed25519 na-adịgide
*n'ime mpịakọta data* ma bipụta akara mkpisi aka ya (fingerprint) na ndekọ:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Akara mkpisi aka na-achọpụta nnyefe *nke gị*: nye ndị ọrụ gị ya
n'èzí (n'onwe gị, site na ọwa ọzọ) ka ha wee mata
nnyefe e nyere ha dịka nke ị na-arụ. Otu akara mkpisi aka ahụ
na-ebipụta na mmalite ọ bụla; ọ bụrụ na ọ gbanwee ma ọlị, a dochiri mpịakọta data
— mee nyocha tupu ị gwa ndị ọrụ ka ha tụkwasị nke ọhụrụ obi.

Ngwa ndị ahịa na-akwado ma na-atụkwasị igodo a na-akpaghị aka (ọkwa-2 usoro 4): na
kọntaktị mbụ ngwa na-ama nnyefe aka ka ọ binye aka na igodo ahụ
(`/api/relay/attest`), na-echekwa igodo akwadoro na akaụntụ ahụ, ma
na-akwado ya ọzọ na nnọkọ ọ bụla na-esote. Akara mkpisi aka ngwa na-egosi
(n'okpuru `/security`, na na toast na ntụkwasị mbụ) sitere na
otu igodo ahụ — tulee ya na ahịrị ndekọ mmalite dị n'elu. Ọ bụrụ na igodo ahụ agbanwee ma ọlị,
ngwa ndị ahịa **na-akwụsị ịgwa nnyefe okwu** ma dọọ
onye ọrụ aka ná ntị; ha anaghị atụkwasị ya ọzọ na nzuzo ma ọlị. Were mgbanwe akara mkpisi aka dịka
ihe na-agbaji: enweghị bọtịnụ "tụkwasị igodo ọhụrụ obi" n'ime ngwa na
usoro 4, ya mere mgbe mpịakọta furu efu n'ezie ndị ọrụ gị ga-ehichapụ
data ngwa chekwara maka akaụntụ ha ma tụkwasị ya ọzọ na kọntaktị mbụ —
kwupụta akara mkpisi aka ọhụrụ n'èzí mbụ, ma ọ bụghị ya ha agaghị enwe ike ịmata
igodo ọhụrụ gị na nke onye mwakpo.

### Nkwado & iweghachi

**Mpịakọta data bụ ọnọdụ nnyefe niile**: otu faịlụ SQLite
nke na-ejide akwụkwọ ndekọ, igbe ozi, na igodo njirimara nnyefe.
Enweghị ihe ọzọ a ga-akwado.

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

### Imelite

```bash
git pull origin main
docker compose up -d --build
```

Ọnọdụ bi na mpịakọta, ọ bụghị na onyonyo, ya mere mmelite anaghị emetụ
data ndị ọrụ gị ma ọlị.

## Itinye na Sava nke Gị na Node Nkịtị (enweghị Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Nhazi bụ naanị mgbanwe gburugburu — `server/README.md`
depụtara ha niile. Ọdịiche abụọ na ụzọ Docker:

- **Faịlụ data** na ndabara bụ `./breeze-relay.db` (gbanwee na
  `BREEZE_DB_PATH`); ọ bụ otu ọnọdụ faịlụ-otu ahụ, njirimara nnyefe
  gụnyere. Kwado ya n'otu ụzọ ahụ: kwụsị, detuo, malitegharịa.
- **Ndebanye aha meghere ma ọ bụrụ na ị mechie ya**: ndabara emechiri
  bụ ihe onwunwe nke nkwakọ ngwaahịa Docker. Iji mechie ọnụ ụzọ nkịtị, tọọ
  `REGISTRATION_ALLOWLIST=id1,id2` (ma ọ bụ uru efu maka
  emechiri-nye-onye-ọ-bụla); `REGISTRATION_OPEN=1` na-emepe ya ọzọ n'ụzọ doro anya.

## Nnyefe Cloudflare

### Nnyefe Kachasị Mpe ($0/ọnwa, nkeji 5)

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

**Ọ bụ ya.** Atụmatụ niile na-arụ ọrụ ma e wezụga ọkwa ntanye (push). Rịba ama
na ndebanye aha na nnyefe Cloudflare **meghere** ma ọ bụrụ na ị
tọọ `REGISTRATION_ALLOWLIST` n'onwe gị (lee `.env.example`); nkwakọ ngwaahịa
emechiri-na-ndabara bụ ụzọ Docker dị n'elu.

### Ihe Na-arụ Ọrụ na $0

| Atụmatụ | Ọnọdụ | Ihe edeturu |
|---------|--------|-------|
| Mkparịta ụka ezoro ezo E2E | ✓ | Double Ratchet zuru oke |
| Ozi P2P | ✓ | WebRTC DataChannel |
| Oku olu/vidiyo | ✓ | WebRTC + STUN n'efu |
| Nnyefe TURN | ✓ | Open Relay (20GB/ọnwa n'efu) |
| Otu (ndị otu 1,000) | ✓ | Sender Key O(1) |
| Nnyefe faịlụ | ✓ | Ruo 50MB site na P2P |
| Asụsụ 51 | ✓ | Bekee arụnyere n'ime + faịlụ mpaghara 50 zuru oke, a na-achọpụta na-akpaghị aka |
| Na-anọghị n'ịntanetị/PWA | ✓ | Service Worker |
| Ọkwa ntanye | ✗ | Ọ chọrọ igodo VAPID |

Ịkwụ ụgwọ akaụntụ ọtụtụ (Lite/Plus/Pro) adịghị — lee
ngalaba "Removed: multi-account billing" nke [SECURITY.md](../../SECURITY.md). Akaụntụ ọ bụla na-enweta
obere akaụntụ mpaghara na-enweghị oke n'efu na-enweghị mgbochi atụmatụ.

### Oke Ọkwa N'efu

| Akụrụngwa | Ọkwa N'efu | Ojiji maka Onye Ọrụ Na-arụ Ọrụ |
|----------|-----------|----------------------|
| Arịrịọ Worker | 100,000/ụbọchị | ~500/ụbọchị (ntule + akara) |
| Ịgụ KV | 100,000/ụbọchị | ~200/ụbọchị |
| Ide KV | 1,000/ụbọchị | ~350/ụbọchị (emeziri) |
| Nchekwa KV | 1 GB | ~10 KB/onye ọrụ |
| Akụrụngwa kwụ ọtọ | Enweghị oke | ~894 KB (HTML otu) |

**Na-akwado ~ndị ọrụ 3 na-arụ ọrụ n'otu oge na ọkwa n'efu.**

### Itinye Atụmatụ Nhọrọ

#### Ọkwa Ntanye (n'efu)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Sava TURN (maka netwọk nwere mgbochi)

TURN bụ otu oku na njikọ nnyefe-naanị (zoo IP) si agafe
NAT nwere mgbochi. Kedu TURN nnyefe gị na-enye bụ nhọrọ **nke gị**
dịka onye ọrụ — Worker na-anwa, n'usoro:

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

**Kwado ihe ị haziri n'ezie:** `GET /api/health` na-akọ
ụdị dị irè dịka `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Boolean `turn` ochie na-egosi naanị
`TURN_URL`, ya mere ọ na-agụ `false` maka Nhọrọ A akwadoro — jiri
`turnProvider`. Ngwa ndị ahịa na-egosi otu onye na-enye ahụ na `/security`, ya mere
onye ọrụ nọ na ndabere Open Relay nwere ike ịhụ na ndị ọzọ na-ebufe
mgbasa ozi oku ya (naanị metadata — mgbasa ozi n'onwe ya ezoro ezo na DTLS-SRTP).

#### Imesi Nkwado Ike & Ụzọ Nnyefe Nkịtị

Nbudata prekey na-echekwaba nwe mbinye aka iche na
`prekey-owner:<userId>` na-enweghị **TTL**. Nwe ngwugwu dị adị na-akwaga nwayọọ
na nbudata na-esote, tupu anabata nnọchi. Ngwugwu Ed25519 ọhụrụ na-
eguzobekwa ndekọ ahụ. Debe ndekọ ndị a mgbe ị na-ekpocha ngwugwu prekey gwụchara:
ichere ngwụcha ngwugwu ekwesịghị ikwe ka onye nwe ọhụrụ bata. Ntụgharị chọrọ
nbudata onye nwe mbụ bịnyere aka na ya, na-ejikọ igodo ọhụrụ na digest nbudata dị adị.
`/account/delete` akwadoro na-ehichapụ ndekọ abụọ ahụ ma nwee ike ịkwado
megide onye nwe ọbụna mgbe ngwugwu gwụchara. Enweghị ntọgharị igodo onye nwe furu efu.

Maka akaụntụ nwere ndekọ a, nbudata na ntule ozi/sealed, ACK sealed na
ihe akaebe WebSocket igbe ozi ga-eji onye nwe na-adịgide. **A na-ajụ arịrịọ ndị a na-abịanyeghị aka
ọbụna na `PREKEY_REQUIRE_AUTH=false` ma ọ bụ `QUEUE_REQUIRE_AUTH=false`.**
Ọkọlọtọ ndị ahụ na-ejide ndabara ochie ha na nkọwa nketa maka akaụntụ
enweghị onye nwe; nnabata `false` doro anya nke arịrịọ nbudata/ahịrị a na-abịanyeghị aka
na-edekọ ịdọ aka ná ntị mbelata na-enweghị ọdịnaya. Ọkọlọtọ nkwado ndị ọzọ agbanwebeghị.
WebSocket igbe ozi ka na-achọ mbinye aka maka onye ọ bụla.

Ngwa onye ahịa na-eche mmalite mbinye aka tupu ọrụ ahịrị, gụnyere
mmalite akaụntụ na-alọghachi, nkwalite onye ndu na njikọghachi. Nchere a na-ekerịta
nwere oke na sekọnd ise. Oge ojiji ndị a na-akwadoghị na-aga n'ihu na-enweghị mbinye aka ozugbo;
IDB/mkpughe igodo rapaara na-aga n'ihu na-enweghị mbinye aka mgbe oke gachara, wee binye aka mgbe ọ dị njikere.
Nke a na-eme ka okirikiri ntule dị ndụ, **ọ bụghị** ụzọ ngafe: akaụntụ ndị onye nwe kwadoro
enweghị ike ịnata site na nnyefe ruo mgbe igodo mbinye aka ha rụrụ ọrụ. Nyefee akụrụngwa ngwa emelitere
n'akụkụ Worker iji zere asọmpi mmalite ochie.

Nkwaga enweghị ike iweghachi nwe site na ngwugwu gwụchara **tupu** a
chekwaa onye nwe ya. Ndebanye aha mbụ ka bụ TOFU. Ndekọ nwe na-eji
ndabere KV dị adị: nkwekọ n'ikpeazụ na ide n'otu oge anaghị
eme ka ha bụrụ nke a na-ahazi n'usoro site na mgbanwe a. Ihe akaebe na-ejide windo ọhụrụ nkeji ise dị adị
na njikọ ọrụ/ihe e zitere; ịnwa ọzọ yiri ya n'ime windo abụghị
usoro nonce otu oge.

Ide ọnụnọ na inye nzere TURN achọọlarị akaụntụ *edebanyere*
(ngwugwu prekey dị) na ndabara, ngwa ọ bụla na-edebanyekwa aha
na-akpaghị aka. Ịkụ obi ọnụnọ na-ebukwa ihe akaebe nwe Ed25519
(ịkụ ahụ na-abịnye aka na ubi ọ na-echekwa), nke Worker na-akwado
mgbe ọ bụla e gosipụtara otu — `PRESENCE_SIGN_REQUIRE_AUTH=true` na-eme
ihe akaebe ahụ iwu. Ọkọlọtọ mbinye aka Ed25519 ndị fọdụrụ ka bụ nhọrọ;
`wrangler.toml` na-edekọ nke ọ bụla na ihe kpatara ya (ngwa ndị ahịa na oge ojiji enweghị
WebCrypto Ed25519 enweghị ike ịbịnye aka ma ọlị).

Ụzọ nnyefe nkịtị ochie (`/api/msg/send`, `/api/msg/poll`) emelatala: azịza ya
na-ebu nkụnye eji isi `Deprecation: true`, ụzọ sealed bụkwa
ụzọ ndabara maka ngwa ọ bụla ugbu a. Ozugbo ị kwadoro na enweghị ngwa dị ndụ
ka chọrọ ndabere ahụ, gbanyụọ ya kpamkpam:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Ngalaba Aha nke Gị

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Ịga n'ihu Karịa Ọkwa N'efu

Mgbe ị gafere ọkwa n'efu (atụmatụ Workers Paid $5/ọnwa):

| Akụrụngwa | Atụmatụ A Kwụrụ Ụgwọ |
|----------|-----------|
| Arịrịọ Worker | Nde 10/ọnwa |
| Ide KV | Nde 1/ọnwa |
| Nchekwa KV | 1 GB gụnyere |
| Oge CPU | Sekọnd 30/arịrịọ |

Nke a na-akwado **puku kwuru puku ndị ọrụ n'otu oge**.

### Imelite

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Enweghị usoro iwuli. Enweghị ihe ndabere ị ga-etinye. Naanị nyefee.
