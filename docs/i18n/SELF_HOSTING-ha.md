# Jagorar Sa Shi a Sabarka

**Karanta da wani harshe**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · Hausa (wannan shafi) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Akwai hanyoyi biyu na gudanar da isarwar Breeze (relay):

1. **Sa shi a sabarka (Node + Docker)** — isarwa a na'urarka ko
   VPS: kwantena ɗaya, kundin bayanai ɗaya, rajista a rufe
   a asali. Fara daga nan idan isarwar taka ce da ta mutanenka.
2. **Cloudflare** — girkawa irin ta hukuma a cikin kyautar
   Cloudflare (isarwar da Breeze kansa ke gudanarwa). Fara daga can idan kana son
   isarwa ta jama'a ba tare da saba da za ka kula da ita ba.

Dukansu suna gudanar da kod na sarrafawa iri ɗaya; isarwa akwatin wasika ce
marar wayo, da za a iya musanyawa ta kowace hanya, kuma kowace manhajar abokin aiki tana aiki da
kowace isarwa.

## Sa Shi a Sabarka da Docker

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

Isarwar tana ba da HTTP na fili a tashar 8787 a cikin kwantena.
**Ka ƙare TLS a wakili mai juyawa (reverse proxy) a gabanta** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): burauzaji za su yi amfani da isarwa ne kawai
ta HTTPS/WSS. Idan ka yi haka, saita `TRUST_PROXY: "true"` a cikin
`docker-compose.yml` domin iyakar yawan buƙatu ta dogara da adireshin abokin aiki
na gaske — kuma kada ka taɓa saita shi ba tare da irin wannan wakili ba, domin taken (header)
da yake amincewa da shi kowa da ya iya isa ga ƙofar shiga kai tsaye zai iya ƙirƙira shi.

Gudanar da kwantena **ɗaya** daidai a kan kundin bayanai: mai iyaka
yawan buƙatu yana cikin ƙwaƙwalwar kowane tsari kuma ayyukan kowane akwatin wasika ana
shirya su a jere a cikin wannan tsarin, don haka kwafi na biyu ba zai riƙe
kowanne daga cikin waɗannan halaye ba. Ƙara ƙarfi ta hanyar ba wa tsari ɗaya na'ura mafi girma.

### Rajista: a rufe a asali

Isarwa ta sabarka da kowa a intanet zai iya yin rajista a kanta
za ta sake ƙirƙirar tattalin arzikin saƙonnin banza/ɓata suna da iyakokin isarwa ta hukuma
suke wanzuwa don sarrafa su, don haka **marufin Docker yana zuwa a rufe**: fayilin
compose yana wuce `REGISTRATION_ALLOWLIST` (wanda zai iya zama fanko) kuma
ID na Breeze da ke cikinsa ne kaɗai za su iya *ƙirƙirar asusu* (loda maɓallin farko
na prekey). Rufe rajista ba ya taɓa shafar mutanen da suka riga suka zauna a
isarwar — lodinsu, ajiyarsu, haɗuwarsu da bin diddiginsu ba a
ƙofa a kansu — kuma buɗe rajista zaɓi ne na bayyane, ba asali ba har abada.

- **ID naka na Breeze** shi ne mai ganowa mai haruffa 12 da ke cikin hanyar gayyatarka
  (haruffa 12 na farko na ƙimar `pub` tasa). Tambayi kowane mutum
  da ka gayyata nasa ta hanya ɗaya — ID mai ganowa ne na jama'a
  da abokan hulɗa suka riga suka musanya, ba sirri ba.
- **Karɓi mutane** ta hanyar jera ID nasu: saita
  `BREEZE_ALLOWLIST=id1,id2,…` a cikin shell naka ko fayilin `.env` kusa da
  `docker-compose.yml`, sannan `docker compose up -d` sake.
- **Fara yanzu, karɓa daga baya**: ba tare da saita `BREEZE_ALLOWLIST` ba, isarwar
  tana gudana a rufe ga kowa — log ɗin farawa yana cewa haka — kuma babu wanda
  zai iya yin rajista har sai ka ƙara ID.
- **Isarwa a buɗe** (kowa na iya yin rajista): cire sharhi daga
  `REGISTRATION_OPEN: "1"` a cikin `docker-compose.yml`. Kai ne mai
  tattalin arzikin ɓata suna idan ka yi haka.

### Iyakar amfani: kashe ta a isarwarka

Worker ɗin yana zuwa da **iyakar amfani ta amfani mai adalci** a kunna: ga kowane
akwatin wasika, a mafi yawa ajiya 10,000 a rana da 200,000 a wata (ajiya ɗaya
zagayen isarwa ɗaya ne cikakke — duba `docs/COST_MODEL.md` §10 don
manufofi da lambobi). Wannan tsarin yana wanzuwa ne don *isarwa ta asali da aka raba*,
wadda ake gudanarwa a matsayin ƙofar shiga ta kyauta wadda kuɗaɗen da ke canzawa na mai gudanarwa
in ba haka ba zai ɗauke su don kowa. **A isarwar da ka gudanar
don kanka da mutanenka, tsarin ba shi da amfani — kashe
shi**:

```bash
USAGE_QUOTA_ENABLED=false
```

Saita shi a duk inda isarwarka ke karanta muhallinta (shell ɗin ko
`.env` kusa da `docker-compose.yml`, muhallin tsarin Node,
ko sirrikan Cloudflare Pages). Ƙwanƙolin maƙwabta biyu suna wanzuwa idan ka
gudanar da isarwa ta al'umma kuma kana *son* tsari:
`USAGE_QUOTA_DAILY` da `USAGE_QUOTA_MONTHLY` suna sake daidaita iyakokin.
Bayanan da suke da muhimmanci:

- Ana aiwatar da iyakar ne kawai idan akwatunan wasika suna rayuwa a cikin Durable
  Objects (`MAILBOX_BACKEND=do`, asali a wannan mai masaukin); a kan
  madadin KV, takardun sun nuna ba ta aiki.
- Bayan iyakar, masu aikowa suna samun `429 USAGE_QUOTA_EXCEEDED` na bayyane
  (tare da taga da iyakarta) maimakon jefarwa a shiru — saƙon
  yana zama a cikin akwatin fitarwa na mai aikowa, kuma wanda aka aiko wa yana ci gaba da kasancewa
  abin isa ta P2P da ta kowace isarwa ta gida.

### Asalin isarwa

A farawa ta farko isarwar tana samar da maɓallin asali na Ed25519 mai dorewa
*a cikin kundin bayanai* kuma tana buga alamar yatsansa (fingerprint) a cikin log:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Alamar yatsa tana ganowa isarwarka *taka*: ba da ita ga masu amfaninka
ta wata hanya ta daban (da kanka, ta wani tashar daban) domin su iya gane
isarwar da aka ba su a matsayin wadda ka gudanar. Alamar yatsa ɗaya
tana buguwa a kowace farawa; idan ta taɓa canzawa, kundin bayanai an
maye gurbinsa — bincika kafin ka gaya wa masu amfani su amince da sabuwa.

Manhajojin abokin aiki suna tabbatarwa da maƙale wannan maɓallin ta atomatik (mataki-2 mataki na 4): a
haɗuwa ta farko manhaja tana ƙalubalantar isarwa ta sa hannu da maɓallin
(`/api/relay/attest`), tana ajiye maɓallin da aka tabbatar tare da asusun, kuma
tana sake tabbatarwa a kowane zama na gaba. Alamar yatsan da manhaja ke nunawa
(a ƙarƙashin `/security`, kuma a cikin toast a maƙalewa ta farko) an samo ta daga
maɓalli ɗaya — kwatanta ta da layin log ɗin farawa da ke sama. Idan maɓallin ya taɓa
canzawa, manhajojin abokin aiki **suna daina magana da isarwar** kuma suna gargadin
mai amfani; ba sa taɓa sake maƙalewa a shiru. Ɗauki canjin alamar yatsa a matsayin
abin da ke karya aiki: babu maɓallin "amince da sabon maɓalli" a cikin manhaja a
mataki na 4, don haka bayan asarar kundin bayanai ta gaske masu amfaninka dole su share
bayanan da manhaja ta ajiye don asusunsu kuma su sake maƙalewa a haɗuwa ta farko —
sanar da sabuwar alamar yatsa ta wata hanya ta daban da farko, in ba haka ba ba za su iya bambanta
sabon maɓallinka da na mai kai hari ba.

### Ajiyar tanadi & dawo da shi

**Kundin bayanai shi ne dukkan halin isarwa**: fayilin SQLite ɗaya
da ke riƙe da kundin adireshi, akwatunan wasika, da maɓallin asalin isarwa.
Babu wani abu kuma da za a yi wa ajiyar tanadi.

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

### Sabuntawa

```bash
git pull origin main
docker compose up -d --build
```

Hali yana rayuwa a cikin kundin bayanai, ba a cikin hoton ba, don haka sabuntawa ba ya taɓa taɓa
bayanan masu amfaninka.

## Sa Shi a Sabarka da Node Tsirara (ba Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Saita ta masu canjin muhalli ne kawai — `server/README.md`
yana jera su duka. Bambance-bambance biyu daga hanyar Docker:

- **Fayilin bayanai** a asali shi ne `./breeze-relay.db` (maye gurbi da
  `BREEZE_DB_PATH`); hali ne mai fayil ɗaya iri ɗaya, asalin isarwa
  a ciki. Yi masa ajiyar tanadi ta hanya ɗaya: tsaya, kwafi, sake farawa.
- **Rajista a buɗe take sai dai idan ka rufe ta**: asalin da ke a rufe
  halayya ce ta marufin Docker. Don rufe ƙofar shiga tsirara, saita
  `REGISTRATION_ALLOWLIST=id1,id2` (ko ƙima fanko don
  a-rufe-ga-kowa); `REGISTRATION_OPEN=1` yana sake buɗewa a bayyane.

## Girkawa a Cloudflare

### Girkawa Mafi Ƙanƙanta ($0/wata, mintuna 5)

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

**Shi ke nan.** Duk fasaloli suna aiki sai sanarwar turawa (push). Lura
cewa rajista a girkawar Cloudflare **a buɗe** take sai dai idan ka
saita `REGISTRATION_ALLOWLIST` da kanka (duba `.env.example`); marufin
da ke a rufe a asali ita ce hanyar Docker da ke sama.

### Abin da Yake Aiki a $0

| Fasali | Matsayi | Bayani |
|---------|--------|-------|
| Hirar ɓoye E2E | ✓ | Double Ratchet cikakke |
| Saƙonnin P2P | ✓ | WebRTC DataChannel |
| Kiran murya/bidiyo | ✓ | WebRTC + STUN kyauta |
| Isarwar TURN | ✓ | Open Relay (20GB/wata kyauta) |
| Ƙungiyoyi (mambobi 100) | ✓ | Sender Key O(1) |
| Isar da fayil | ✓ | Har zuwa 50MB ta P2P |
| Harsuna 8 | ✓ | EN + cikakkun wuraren gida 7, ana ganowa ta atomatik |
| Ba-kan-layi/PWA | ✓ | Service Worker |
| Sanarwar turawa | ✗ | Ana buƙatar maɓallan VAPID |

Biyan kuɗi na asusu da yawa (Lite/Plus/Pro) ba ya samuwa — duba
sashen "Removed: multi-account billing" na [SECURITY.md](../../SECURITY.md). Kowane asusu yana samun
ƙananan asusu na gida marasa iyaka kyauta ba tare da ƙofar tsari ba.

### Iyakar Kyauta

| Albarkatu | Kyauta | Amfani ga kowane mai amfani mai aiki |
|----------|-----------|----------------------|
| Buƙatun Worker | 100,000/rana | ~500/rana (bin diddigi + sigina) |
| Karatun KV | 100,000/rana | ~200/rana |
| Rubutun KV | 1,000/rana | ~350/rana (an inganta) |
| Ajiyar KV | 1 GB | ~10 KB/mai amfani |
| Kayan aiki na tsaye | Ba iyaka | ~400 KB (HTML guda ɗaya) |

**Yana tallafa wa ~masu amfani masu aiki 3 a lokaci ɗaya a kyauta.**

### Ƙara Fasaloli na Zaɓi

#### Sanarwar Turawa (kyauta)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Sabar TURN (don hanyoyin sadarwa masu tsauri)

TURN ita ce yadda kira da haɗuwar relay-kaɗai (ɓoye IP) ke ƙetare
NAT masu tsauri. Wane TURN isarwarka ke bayarwa zaɓi ne **naka**
a matsayin mai gudanarwa — Worker yana gwada, a jere:

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

**Tabbatar da abin da ka saita da gaske:** `GET /api/health` yana ba da rahoton
yanayin da ya yi tasiri a matsayin `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Tsohon boolean `turn` yana nuna
`TURN_URL` kawai, don haka yana karanta `false` don Zaɓi A da aka ba da shawara — yi amfani da
`turnProvider`. Manhajojin abokin aiki suna nuna mai bayarwa ɗaya a cikin `/security`, don haka
mai amfani da ke kan madadin Open Relay zai iya ganin cewa ɓangare na uku yana isar da
kafofin watsa labaransa na kira (bayanai na taƙaitawa kawai — kafofin kansu an ɓoye su da DTLS-SRTP).

#### Ƙarfafa Tabbatarwa & Hanyar Relay ta Fili

Lodan prekey yanzu suna kiyaye mallakar sa hannu daban a
`prekey-owner:<userId>` ba tare da **TTL** ba. Mallakar kunshin da ta wanzu tana ƙaura a hankali
a loda na gaba, kafin a karɓi maye gurbi. Sababbin kunshin Ed25519 ma suna
kafa wannan bayanin. Riƙe waɗannan bayanai idan kana share kunshin prekey da suka ƙare:
jiran ƙarewar kunshi kada ya ba da izinin sabon mai shi. Juyawa yana buƙatar
loda da mai shi na baya ya sa hannu, yana ɗaure sabon maɓalli a cikin digest ɗin loda da ya wanzu.
`/account/delete` da aka tabbatar yana goge bayanai biyun kuma zai iya tabbatarwa
a kan mai shi ko bayan ƙarewar kunshi. Babu sake saita maɓallin mai shi da ya ɓace.

Ga asusu masu wannan bayanin, loda da bin diddigin saƙo/sealed, ACK na sealed da
hujjojin WebSocket na akwatin wasika dole su yi amfani da mai shi mai dorewa. **Ana ƙin buƙatun da ba a sa hannu ba
ko da `PREKEY_REQUIRE_AUTH=false` ko `QUEUE_REQUIRE_AUTH=false`.**
Waɗannan tutoci suna riƙe tsofaffin asalinsu da ma'anar gado ga asusu
ba tare da mai shi ba; karɓar `false` na bayyane na buƙatun loda/jeri da ba a sa hannu ba
yana rubuta gargadin raguwar amfani marar abun ciki. Sauran tutocin tabbatarwa ba su canza ba.
WebSockets na akwatin wasika har yanzu suna buƙatar sa hannu ga kowa.

Manhajar abokin aiki tana jiran fara sa hannu kafin aikin jeri, har da
farawar asusu mai dawowa, ɗaukakar jagora da sake haɗuwa. Jiran da aka raba yana
da iyaka a daƙiƙa biyar. Mahallan gudu da ba a tallafa ba suna ci gaba ba tare da sa hannu ba nan da nan;
IDB/buɗe maɓalli da ya makale yana ci gaba ba tare da sa hannu ba bayan iyakar, sannan yana sa hannu idan ya shirya.
Wannan yana kiyaye madaukin bin diddigi da rai, **ba** hanyar tsallakewa ba: asusu masu mai shi
ba za su iya karɓa daga isarwa ba har sai maɓallin sa hannunsu ya zama abin amfani. Girka kayan aikin manhaja da aka sabunta
tare da Worker don guje wa tsohuwar tseren farawa.

Ƙaura ba za ta iya dawo da mallaka daga kunshin da ya ƙare **kafin** a
kiyaye mai shinsa ba. Rajista ta farko ta kasance TOFU. Bayanan mallaka suna amfani da
madadin KV da ya wanzu: daidaiton ƙarshe da rubuce-rubucen lokaci ɗaya ba a
sa su su zama masu layi ta wannan canji. Hujjoji suna riƙe taga ta sabuntawa ta mintuna biyar da ta wanzu
da ɗauren aiki/bayarwa; sake gwada iri ɗaya a cikin taga ba
ƙa'idar nonce ta lokaci ɗaya ba ce.

Rubutun kasancewa da bayar da takardun TURN sun riga sun buƙaci asusu *mai rajista*
(kunshin prekey ya wanzu) a asali, kuma kowace manhaja tana yin rajista
ta atomatik. bugun zuciya na kasancewa ƙari yana ɗauke da hujjar mallaka ta Ed25519
(bugun yana sa hannu a filayen da yake ajiyewa), wadda Worker ke tabbatarwa
duk lokacin da aka gabatar da ɗaya — `PRESENCE_SIGN_REQUIRE_AUTH=true` yana sa wannan
hujjar ta zama wajibi. Sauran tutocin sa hannu na Ed25519 suna kasancewa na zaɓi;
`wrangler.toml` yana rubuta kowace ɗaya da dalili (manhajojin abokin aiki a mahallan gudu ba tare da
WebCrypto Ed25519 ba za su iya sa hannu ba kwata-kwata).

Tsohuwar hanyar relay ta fili (`/api/msg/send`, `/api/msg/poll`) ta ragu: amsoshinta
suna ɗauke da taken `Deprecation: true`, kuma hanyar sealed ita ce
hanya ta asali ga kowace manhaja ta yanzu. Da zarar ka tabbatar babu manhaja mai rai
da har yanzu take buƙatar madadin, kashe ta gaba ɗaya:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Yankin Sunan Kai

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Ƙaruwa Bayan Kyauta

Idan ka wuce kyautar ($5/wata tsarin Workers Paid):

| Albarkatu | Tsarin da Aka Biya |
|----------|-----------|
| Buƙatun Worker | Miliyan 10/wata |
| Rubutun KV | Miliyan 1/wata |
| Ajiyar KV | 1 GB a ciki |
| Lokacin CPU | Daƙiƙa 30/buƙata |

Wannan yana tallafa wa **dubban masu amfani a lokaci ɗaya**.

### Sabuntawa

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Babu matakin ginawa. Babu abubuwan dogaro da za a girka. Kawai girka.
