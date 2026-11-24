# Mwongozo wa Self-Hosting

**Soma kwa lugha nyingine**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · Kiswahili (ukurasa huu) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Kuna njia mbili za kuendesha relay ya Breeze:

1. **Self-hosted (Node + Docker)** — relay kwenye mashine yako mwenyewe au
   VPS: kontena moja, ujazo mmoja wa data, usajili umefungwa
   kama chaguomsingi. Anza hapa ikiwa relay ni kwa ajili yako na watu wako.
2. **Cloudflare** — upelekaji wa mtindo rasmi kwenye kiwango cha bure
   cha Cloudflare (relay inayoendeshwa na Breeze yenyewe). Anza hapo ikiwa unataka
   relay ya umma bila seva ya kutunza.

Zote mbili zinaendesha msimbo ule ule wa kishughulikaji; relay ni kisanduku cha posta kipumbavu,
kinachoweza kubadilishwa kwa njia yoyote ile, na kila mteja hufanya kazi na
kila relay.

## Self-Hosted kwa Docker

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

Relay hutumikia HTTP ya kawaida kwenye mlango 8787 ndani ya kontena.
**Malizia TLS kwenye proksi ya nyuma mbele yake** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): vivinjari vitatumia relay tu
kupitia HTTPS/WSS. Unapofanya hivyo, weka `TRUST_PROXY: "true"` katika
`docker-compose.yml` ili ukomo wa kasi ufungwe kwenye anwani halisi ya mteja
— na kamwe usiiweke bila proksi kama hiyo, kwa sababu kichwa
inachokiamini kinaweza kughushiwa na yeyote anayeweza kufikia mlango moja kwa moja.

Endesha kontena **moja** hasa dhidi ya ujazo wa data: kikomo cha kasi
kiko kwenye kumbukumbu ya kila mchakato na shughuli za kila kisanduku cha posta
zimepangwa kwa mfululizo ndani ya mchakato huo, kwa hiyo nakala ya pili
isingeshikilia sifa yoyote. Kuza kwa kuupa mchakato huo mmoja mashine kubwa zaidi.

### Usajili: umefungwa kama chaguomsingi

Relay ya self-hosted ambayo yeyote kwenye intaneti angeweza kujisajili kwayo
ingerejesha uchumi wa barua taka/matusi ambao vikomo vya relay rasmi
vipo kuudhibiti, kwa hiyo **ufungaji wa Docker husafirishwa ukiwa umefungwa**: faili ya
compose hupitisha `REGISTRATION_ALLOWLIST` (inaweza kuwa tupu) na
ni ID za Breeze zilizo juu yake tu ndizo zinaweza *kuunda akaunti* (upakiaji wa kwanza wa
prekey). Kufunga usajili hakuathiri kamwe watu ambao tayari wamekaa kwenye
relay — upakiaji wao, amana, mikusanyiko na uchunguzi wao haujawekewa lango
— na kufungua usajili ni chaguo la wazi, kamwe si
chaguomsingi.

- **ID yako ya Breeze** ni kitambulisho cha herufi 12 katika kiungo chako cha mwaliko
  (herufi 12 za kwanza za thamani yake ya `pub`). Muulize kila mtu
  unayemwalika yake kwa njia ile ile — ID ni kitambulisho cha umma ambacho
  anwani tayari hubadilishana, si siri.
- **Wakubali watu** kwa kuorodhesha ID zao: weka
  `BREEZE_ALLOWLIST=id1,id2,…` katika shell yako au faili ya `.env` karibu na
  `docker-compose.yml`, kisha `docker compose up -d` tena.
- **Anza sasa, kubali baadaye**: bila `BREEZE_ALLOWLIST` kuwekwa, relay
  huendeshwa ikiwa imefungwa kwa kila mtu — logi ya kuwasha inasema hivyo — na hakuna mtu
  anayeweza kujisajili hadi uongeze ID.
- **Relay wazi** (yeyote anaweza kujisajili): ondoa maoni kwenye
  `REGISTRATION_OPEN: "1"` katika `docker-compose.yml`. Wewe unamiliki
  uchumi wa matusi ukifanya hivyo.

### Kiwango cha matumizi: zima kwenye relay yako mwenyewe

Worker husafirishwa na **kiwango cha matumizi cha haki** kimewashwa: kwa kila
kisanduku cha posta, hadi amana 10,000/siku na 200,000/mwezi (amana ni
mzunguko mmoja kamili wa uwasilishaji — tazama `docs/COST_MODEL.md` §10 kwa
sera na namba). Mfumo huo upo kwa ajili ya *relay chaguomsingi inayoshirikiwa*,
inayoendeshwa kama mlango wa bure ambao gharama zake zinazobadilika
mwendeshaji angezibeba kwa kila mtu vinginevyo. **Kwenye relay unayoiendesha
kwa ajili yako mwenyewe na watu wako, mfumo huo hauna maana — zima
huo**:

```bash
USAGE_QUOTA_ENABLED=false
```

Iweke popote relay yako inaposoma mazingira yake (shell au
`.env` karibu na `docker-compose.yml`, mazingira ya mchakato wa Node,
au siri za Cloudflare Pages). Vifundo viwili vya jirani vipo ikiwa
unaendesha relay ya jamii na *unataka* mfumo:
`USAGE_QUOTA_DAILY` na `USAGE_QUOTA_MONTHLY` hurekebisha vikomo upya.
Maelezo muhimu:

- Kiwango hicho hutekelezwa tu wakati visanduku vya posta viko katika Durable
  Objects (`MAILBOX_BACKEND=do`, chaguomsingi kwenye mwenyeji huyu); kwenye
  backend ya KV ni no-op iliyohifadhiwa kwenye nyaraka.
- Zaidi ya kikomo, watumaji hupata `429 USAGE_QUOTA_EXCEEDED` ya wazi
  (pamoja na dirisha na kikomo chake) badala ya kudondoshwa kimya — ujumbe
  hubaki katika kisanduku cha kutuma cha mtumaji, na mpokeaji hubaki
  kufikika kupitia P2P na kupitia relay nyingine yoyote ya nyumbani.

### Utambulisho wa relay

Wakati wa kuwasha kwa mara ya kwanza relay hutengeneza ufunguo wa utambulisho wa Ed25519 wa kudumu
*ndani ya ujazo wa data* na kuchapisha alama yake ya kidole katika logi:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Alama ya kidole humtambulisha relay *yako*: wape watumiaji wako
nje ya mkondo (ana kwa ana, kupitia chaneli nyingine) ili waweze kutambua
relay waliyokabidhiwa kama ile unayoiendesha. Alama ile ile ya kidole
huchapishwa kila kuwasha; ikibadilika kamwe, ujazo wa data ulikuwa
umebadilishwa — chunguza kabla ya kuwaambia watumiaji waiamini mpya.

Wateja huthibitisha na kubandika ufunguo huu kiotomatiki (hatua ya 2 hatua ya 4): kwenye
mawasiliano ya kwanza mteja huipa changamoto relay itie sahihi kwa ufunguo
(`/api/relay/attest`), huhifadhi ufunguo uliothibitishwa pamoja na akaunti, na
huthibitisha tena kila kipindi kinachofuata. Alama ya kidole inayoonyeshwa na mteja
(chini ya `/security`, na katika toast wakati wa kubandika kwa mara ya kwanza) imetokana na
ufunguo ule ule — ilinganishe na mstari wa logi ya kuwasha hapo juu. Ikiwa ufunguo
utabadilika kamwe, wateja **hukoma kuzungumza na relay** na humwonya
mtumiaji; kamwe hawabandiki tena kimya. Chukulia mabadiliko ya alama ya kidole kama tukio la
kuvunja: hakuna kitufe cha "amini ufunguo mpya" ndani ya programu katika
hatua ya 4, kwa hiyo baada ya upotezaji halisi wa ujazo watumiaji wako lazima wafute
data iliyohifadhiwa ya programu kwa akaunti yao na wabandike tena wakati wa mawasiliano ya kwanza —
tangaza alama mpya ya kidole nje ya mkondo kwanza, au hawawezi kutofautisha
ufunguo wako mpya na wa mshambuliaji.

### Akiba na urejeshaji

**Ujazo wa data ndio hali nzima ya relay**: faili moja ya SQLite
inayoshikilia saraka, visanduku vya posta, na ufunguo wa utambulisho wa relay.
Hakuna kingine cha kuhifadhi akiba.

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

### Kusasisha

```bash
git pull origin main
docker compose up -d --build
```

Hali huishi katika ujazo, si katika taswira, kwa hiyo kusasisha hakugusi kamwe
data ya watumiaji wako.

## Self-Hosted kwa Bare Node (hakuna Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Usanidi ni vigezo vya mazingira tu — `server/README.md`
huorodhesha vyote. Tofauti mbili kutoka njia ya Docker:

- **Faili ya data** huwa `./breeze-relay.db` kama chaguomsingi (ibadilishe kwa
  `BREEZE_DB_PATH`); ni hali ile ile ya faili moja, utambulisho wa relay
  ukijumuishwa. Ihifadhi akiba kwa njia ile ile: simama, nakili, anzisha upya.
- **Usajili uko wazi isipokuwa uufunge**: chaguomsingi iliyofungwa
  ni sifa ya ufungaji wa Docker. Kufunga mlango mtupu, weka
  `REGISTRATION_ALLOWLIST=id1,id2` (au thamani tupu kwa
  kufungwa-kwa-kila-mtu); `REGISTRATION_OPEN=1` hufungua tena kwa wazi.

## Upelekaji wa Cloudflare

### Upelekaji wa Chini Zaidi ($0/mwezi, dakika 5)

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

**Hiyo tu.** Vipengele vyote hufanya kazi isipokuwa arifa za push. Kumbuka
kwamba usajili kwenye upelekaji wa Cloudflare uko **wazi** isipokuwa ukiweka
`REGISTRATION_ALLOWLIST` mwenyewe (tazama `.env.example`); ule
ufungaji wa kufungwa-kama-chaguomsingi ni njia ya Docker hapo juu.

### Kinachofanya Kazi kwa $0

| Kipengele | Hali | Maelezo |
|---------|--------|-------|
| Gumzo la siri la E2E | ✓ | Double Ratchet kamili |
| Ujumbe wa P2P | ✓ | WebRTC DataChannel |
| Simu za sauti/video | ✓ | WebRTC + STUN ya bure |
| Relay ya TURN | ✓ | Open Relay (20GB/mwezi bure) |
| Vikundi (wanachama 100) | ✓ | Sender Key O(1) |
| Uhamishaji wa faili | ✓ | Hadi 50MB kupitia P2P |
| Lugha 8 | ✓ | EN + maeneo 7 kamili, hugunduliwa kiotomatiki |
| Nje ya mtandao/PWA | ✓ | Service Worker |
| Arifa za push | ✗ | Inahitaji funguo za VAPID |

Malipo ya akaunti nyingi (Lite/Plus/Pro) hayapatikani — tazama
sehemu ya "Removed: multi-account billing" ya [SECURITY.md](../../SECURITY.md). Kila akaunti hupata
akaunti ndogo za ndani zisizo na kikomo bure bila lango la mpango.

### Vikomo vya Kiwango cha Bure

| Rasilimali | Kiwango cha Bure | Matumizi kwa kila Mtumiaji Anayefanya Kazi |
|----------|-----------|----------------------|
| Maombi ya Worker | 100,000/siku | ~500/siku (uchunguzi + uashiriaji) |
| Usomaji wa KV | 100,000/siku | ~200/siku |
| Uandikaji wa KV | 1,000/siku | ~350/siku (umeboreshwa) |
| Uhifadhi wa KV | 1 GB | ~10 KB/mtumiaji |
| Mali tuli | Bila kikomo | ~400 KB (HTML moja) |

**Inasaidia watumiaji wapatao 3 wanaofanya kazi kwa wakati mmoja kwenye kiwango cha bure.**

### Kuongeza Vipengele vya Hiari

#### Arifa za Push (bure)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Seva ya TURN (kwa mitandao yenye vikwazo)

TURN ni jinsi simu na miunganisho ya relay-pekee (inayoficha IP) huvuka
NAT zenye vikwazo. TURN gani relay yako itatoa ni chaguo **lako** kama
mwendeshaji — Worker hujaribu, kwa mpangilio:

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

**Thibitisha ulichosanidi kweli:** `GET /api/health` huripoti
hali halisi kama `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Boolean ya zamani ya `turn` huonyesha tu
`TURN_URL`, kwa hiyo husoma `false` kwa Option A inayopendekezwa — tumia
`turnProvider`. Wateja huonyesha mtoa huduma yule yule katika `/security`, kwa hiyo
mtumiaji aliye kwenye uokoaji wa Open Relay anaweza kuona kwamba mtu wa tatu hupeana
midia ya simu yake (metadata tu — midia yenyewe imefungwa kwa usiri wa DTLS-SRTP).

#### Uimarishaji wa Uthibitishaji na Njia ya Relay ya Kawaida

Upakiaji wa prekey sasa huhifadhi umiliki wa sahihi kando katika
`prekey-owner:<userId>` **bila TTL**. Umiliki wa bundle uliopo huhama kwa uvivu
kwenye upakiaji unaofuata, kabla ya kibadilishaji kukubaliwa. Bundle mpya za Ed25519 pia
huweka rekodi hiyo. Weka rekodi hizi unapopogoa bundle za prekey zilizoisha muda:
kusubiri kuisha kwa bundle hakupaswi kuruhusu mmiliki mpya. Mzunguko unahitaji
upakiaji uliotiwa sahihi na mmiliki wa awali, ukifunga ufunguo mpya katika muhtasari wa upakiaji
uliopo. `/account/delete` iliyothibitishwa hufuta rekodi zote mbili na inaweza kuthibitisha
dhidi ya mmiliki hata baada ya kuisha kwa bundle. Hakuna uwekaji upya wa ufunguo wa mmiliki uliopotea.

Kwa akaunti zenye rekodi hii, upakiaji na uchunguzi wa ujumbe/sealed, ACK ya sealed na
uthibitisho wa WebSocket wa kisanduku cha posta lazima utumie mmiliki wa kudumu. **Maombi yasiyotiwa sahihi
hukataliwa hata kwa `PREKEY_REQUIRE_AUTH=false` au `QUEUE_REQUIRE_AUTH=false`.**
Bendera hizo hubaki na chaguomsingi zao zilizopo na maana za zamani kwa akaunti
zisizo na mmiliki; kukubalika kwa wazi kwa `false` kwa maombi ya upakiaji/foleni yasiyotiwa sahihi
huweka onyo la kuachwa lisilo na yaliyomo. Bendera nyingine za uthibitishaji hazijabadilika.
WebSocket za kisanduku cha posta bado zinahitaji sahihi kwa kila mtu.

Mteja husubiri uanzishaji wa utiaji sahihi kabla ya shughuli ya foleni, ikijumuisha
kuwasha kwa akaunti inayorejea, upandishaji wa kiongozi na uunganishaji upya. Kusubiri kunakoshirikiwa
kumefungwa kwa sekunde tano. Mazingira ya uendeshaji yasiyoungwa mkono huendelea bila sahihi mara moja;
IDB/ufunguaji wa ufunguo uliokwama huendelea bila sahihi baada ya kikomo, kisha hutia sahihi ukiwa tayari.
Hii huweka mzunguko wa uchunguzi hai, **si** upenyo: akaunti zinazoungwa mkono na mmiliki haziwezi
kupokea kutoka relay hadi ufunguo wao wa kutia sahihi uweze kutumika. Peleka mali za mteja zilizosasishwa
pamoja na Worker ili kuepuka mbio za zamani za kuanzisha.

Uhamiaji hauwezi kurejesha umiliki kutoka kwa bundle iliyoisha muda **kabla** ya
mmiliki wake kuhifadhiwa. Usajili wa kwanza hubaki TOFU. Rekodi za umiliki hutumia
backend iliyopo ya KV: uthabiti wa mwisho na uandikaji wa wakati mmoja haufanywi
kuwa wa mstari na mabadiliko haya. Uthibitisho hubaki na dirisha lililopo la uchangamfu wa dakika tano
na ufungaji wa shughuli/mzigo; majaribio ya kurudia yaleyale ndani ya dirisha si
itifaki ya nonce ya mara moja.

Uandikaji wa uwepo na utoaji wa hati za TURN tayari huhitaji akaunti *iliyosajiliwa*
(bundle ya prekey ipo) kama chaguomsingi, na kila mteja hujisajili
kiotomatiki. Mapigo ya moyo ya uwepo pia hubeba uthibitisho wa umiliki wa Ed25519
(mapigo hutia sahihi sehemu inayohifadhi), ambayo Worker huthibitisha
wakati wowote inapotolewa — `PRESENCE_SIGN_REQUIRE_AUTH=true` hufanya uthibitisho huo
kuwa wa lazima. Bendera zilizobaki za sahihi ya Ed25519 hubaki za hiari;
`wrangler.toml` huandika kila moja na kwa nini (wateja kwenye mazingira ya uendeshaji yasiyo na
WebCrypto Ed25519 hawawezi kutia sahihi kabisa).

Relay ya kawaida ya zamani (`/api/msg/send`, `/api/msg/poll`) imeachwa: majibu
yake hubeba kichwa cha `Deprecation: true`, na njia iliyofungwa ni
njia chaguomsingi kwa kila mteja wa sasa. Mara tu unapothibitisha hakuna mteja aliye hai
anayehitaji uokoaji bado, izime kabisa:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Kikoa Maalum

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Kukua Zaidi ya Kiwango cha Bure

Unapozidi kiwango cha bure (mpango wa Workers Paid wa $5/mwezi):

| Rasilimali | Mpango wa Kulipia |
|----------|-----------|
| Maombi ya Worker | Milioni 10/mwezi |
| Uandikaji wa KV | Milioni 1/mwezi |
| Uhifadhi wa KV | 1 GB imejumuishwa |
| Muda wa CPU | Sekunde 30/ombi |

Hii inasaidia **maelfu ya watumiaji wa wakati mmoja**.

### Kusasisha

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Hakuna hatua ya kujenga. Hakuna vitegemezi vya kusakinisha. Peleka tu.
