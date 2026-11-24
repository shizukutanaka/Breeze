# የራስ-አስተናጋጅ መመሪያ

**በሌላ ቋንቋ ያንብቡ**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · አማርኛ (ይህ ገጽ) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


የBreeze ሪሌይ (relay) ለማስኬድ ሁለት መንገዶች አሉ፦

1. **ራስ-አስተናጋጅ (Node + Docker)** — ሪሌዩ በራስዎ ማሽን ወይም
   VPS ላይ: አንድ ኮንቴይነር፣ አንድ የውሂብ ጥራዝ፣ ምዝገባ በነባሪ
   ዝግ ነው። ሪሌዩ ለእርስዎና ለሰዎችዎ ከሆነ ከዚህ ይጀምሩ።
2. **Cloudflare** — በCloudflare ነፃ ደረጃ ላይ ይፋዊ-አይነት ማሰማራት
   (Breeze ራሱ የሚያስኬደው ሪሌይ)። የሚጠብቁት ሰርቨር ሳይኖር
   የህዝብ ሪሌይ ከፈልጉ ከዚያ ይጀምሩ።

ሁለቱም ተመሳሳይ የአያያዝ ኮድ ያስኬዳሉ፤ ሪሌይ ዱም፣
በአንዳቸውም መንገድ ሊለዋወጥ የሚችል የመልእክት ሳጥን ነው፣ እያንዳንዱ ደንበኛም ከ
እያንዳንዱ ሪሌይ ጋር ይሰራል።

## በDocker ራስ-አስተናጋጅ

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

ሪሌዩ በኮንቴይነሩ ውስጥ በወደብ 8787 ላይ ግልጽ HTTP ያቀርባል።
**TLSን በፊቱ ባለ ተገላቢጦሽ ፕሮክሲ (reverse proxy) ላይ ያቋርጡ** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): ብራውዘሮች ሪሌይ የሚጠቀሙት በ
HTTPS/WSS ላይ ብቻ ነው። ይህን ሲያደርጉ፣ `TRUST_PROXY: "true"` በ
`docker-compose.yml` ውስጥ ያዘጋጁ ስለዚህ የዋጋ ወሰን በእውነተኛው የደንበኛ
አድራሻ ላይ እንዲመሠረት — እና ያለ እንደዚህ ፕሮክሲ በፍጹም አታዘጋጁት፣ ምክንያቱም ርዕሱ (header)
የሚተማመንበት ወደ መግቢያው በቀጥታ መድረስ የሚችል ማንም ሊሰራው ይችላል።

በትክክል **አንድ** ኮንቴይነር በውሂብ ጥራዙ ላይ ያስኬዱ: የዋጋ
ወሰን ለእያንዳንዱ ሂደት በማስታወሻ ውስጥ ነው እያንዳንዱም የመልእክት ሳጥን ሥራዎች
በዚያ ሂደት ውስጥ በተከታታይ ይደረጋሉ፣ ስለዚህ ሁለተኛ ቅጂ ሁለቱንም
ከእነዚያ ባህሪያት አይይዝም። አንድ ሂደቱን ትልቅ ማሽን በመስጠት መጠኑን ያሳድጉ።

### ምዝገባ: በነባሪ ዝግ

በኢንተርኔት ላይ ያለ ማንም ሊመዘገብበት የሚችል የራስ-አስተናጋጅ ሪሌይ
የይፋዊ ሪሌይ ወሰኖች ለመቆጣጠር ያሉትን የአይፈለጌ መልእክት/አላግባብ መጠቀም ኢኮኖሚክስ እንደገና ይፈጥራል፣
ስለዚህ **የDocker ማሸጊያው ዝግ ሆኖ ይመጣል**: የcompose
ፋይል `REGISTRATION_ALLOWLIST` (ባዶ ሊሆን ይችላል) ያልፋል እና
በውስጡ ያሉ የBreeze IDዎች ብቻ *መለያዎችን መፍጠር* ይችላሉ (የመጀመሪያ prekey
ሰቀላ)። ምዝገባን መዝጋት በሪሌዩ ላይ አስቀድመው የቆዩ ሰዎችን በፍጹም
አይነካም — ሰቀላዎቻቸው፣ ተቀማጮቻቸው፣ መገናኘታቸውና ምርጫዎቻቸው
አይታገዱም — ምዝገባን መክፈትም ግልጽ ምርጫ ነው፣ በፍጹም ነባሪ አይደለም።

- **የእርስዎ Breeze ID** በግብዣ አገናኝዎ ውስጥ ያለ የ12-ቁምፊ መለያ ነው
  (የ`pub` እሴቱ የመጀመሪያ 12 ቁምፊዎች)። ለሚጋብዙት እያንዳንዱ ሰው
  የራሱን በተመሳሳይ መንገድ ይጠይቁ — IDው የህዝብ መለያ ነው
  አድራሻዎች አስቀድመው የሚለዋወጡት፣ ሚስጥር አይደለም።
- **ሰዎችን ያስገቡ** IDዎቻቸውን በመዘርዘር: `BREEZE_ALLOWLIST=id1,id2,…` በ
  ሼልዎ ወይም በ`docker-compose.yml` አጠገብ ባለ `.env` ፋይል ውስጥ ያዘጋጁ፣
  ከዚያ እንደገና `docker compose up -d`።
- **አሁን ጀምር፣ በኋላ አስገባ**: `BREEZE_ALLOWLIST` ሳያዘጋጁ፣ ሪሌዩ
  ለሁሉም ዝግ ሆኖ ይሰራል — የጅምር ምዝገባው እንዲህ ይላል — ማንም
  ID እስኪጨምሩ ድረስ መመዝገብ አይችልም።
- **ክፍት ሪሌይ** (ማንም መመዝገብ ይችላል): በ`docker-compose.yml` ውስጥ
  `REGISTRATION_OPEN: "1"` ላይ ያለውን አስተያየት ያስወግዱ። ከሠሩ
  የአላግባብ መጠቀም ኢኮኖሚክሱ የእርስዎ ነው።

### የአጠቃቀም ኮታ: በራስዎ ሪሌይ ላይ ያጥፉት

Workerው **ፍትሃዊ-አጠቃቀም የአጠቃቀም ኮታ** ነቅቶ ይመጣል: ለእያንዳንዱ
የመልእክት ሳጥን፣ በቀን ቢበዛ 10,000 ተቀማጮች እና በወር 200,000 (አንድ ተቀማጭ አንድ
ሙሉ የማድረስ ዑደት ነው — ለፖሊሲውና ለቁጥሮቹ `docs/COST_MODEL.md` §10ን ይመልከቱ)።
ያ ክፈፍ ለ*የተጋራ ነባሪ ሪሌይ* አለ፣
እሱም እንደ ነፃ መግቢያ የሚሰራ ሲሆን ኦፕሬተሩ ተለዋዋጭ ወጪዎቹን
ያለዚያ ለሁሉም ይሸከማቸው ነበር። **እርስዎ ለራስዎና
ለሰዎችዎ በሚያስኬዱት ሪሌይ ላይ፣ ክፈፉ ትርጉም የለውም — ያጥፉት**:

```bash
USAGE_QUOTA_ENABLED=false
```

ሪሌይዎ አካባቢውን በሚያነብበት ቦታ ሁሉ ያዘጋጁት (ሼሉ ወይም
በ`docker-compose.yml` አጠገብ ያለው `.env`፣ የNode ሂደት አካባቢ፣
ወይም የCloudflare Pages ሚስጥሮች)። የማህበረሰብ ሪሌይ አስኬደው ክፈፍ *ከፈልጉ*
ሁለት አጎራባች ቁልፎች አሉ:
`USAGE_QUOTA_DAILY` እና `USAGE_QUOTA_MONTHLY` ወሰኖቹን ዳግም ያስተካክላሉ።
አስፈላጊ ማስታወሻዎች:

- ኮታው የሚተገበረው የመልእክት ሳጥኖች በDurable
  Objects ውስጥ ሲኖሩ ብቻ ነው (`MAILBOX_BACKEND=do`፣ በዚህ አስተናጋጅ ላይ ነባሪ)፤ በ
  KV ጀርባ ላይ በሰነድ የተገለጸ ምንም-አለማድረግ ነው።
- ወሰኑን ካለፉ፣ ላኪዎች ግልጽ `429 USAGE_QUOTA_EXCEEDED`
  (ከመስኮቱና ከወሰኑ ጋር) ከዝምታ መጣል ይልቅ ይቀበላሉ — መልእክቱ
  በላኪው የወጪ ሳጥን ውስጥ ይቆያል፣ ተቀባዩም
  በP2P እና በሌላ ማንኛውም የቤት ሪሌይ በኩል ሊደረስበት ይችላል።

### የሪሌይ ማንነት

በመጀመሪያ ጅምር ላይ ሪሌዩ ዘላቂ የEd25519 ማንነት ቁልፍ ይፈጥራል
*በውሂብ ጥራዙ ውስጥ* እና የአሻራውን (fingerprint) በምዝገባው ውስጥ ያትማል:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

አሻራው *የእርስዎን* ሪሌይ ይለያል: ለተጠቃሚዎችዎ
ከመንገድ ውጭ (በአካል፣ በሌላ ሰርናል በኩል) ይስጧቸው ስለዚህ
የተሰጣቸውን ሪሌይ እርስዎ የሚያስኬዱት እንደሆነ መለየት ይችላሉ። ተመሳሳዩ አሻራ
በእያንዳንዱ ጅምር ላይ ይታተማል፤ ከተቀየረ፣ የውሂብ ጥራዙ ተተክቷል
— ተጠቃሚዎች አዲሱን እንዲተማመኑ ከመንገርዎ በፊት ይመርምሩ።

የደንበኛ መተግበሪያዎች ይህን ቁልፍ በራሳቸው ያረጋግጣሉ እና ያስቀምጣሉ (ደረጃ-2 እርምጃ 4): በ
የመጀመሪያ ግንኙነት ደንበኛ ሪሌዩን በቁልፉ እንዲፈርም ይፈታተናል
(`/api/relay/attest`)፣ የተረጋገጠውን ቁልፍ ከመለያው ጋር ያስቀምጣል፣ እና
በሚቀጥለው እያንዳንዱ ክፍለ ጊዜ እንደገና ያረጋግጣል። ደንበኛው የሚያሳየው አሻራ
(በ`/security` ሥር፣ እና በመጀመሪያ ማስቀመጥ ላይ በtoast ውስጥ) ከ
ተመሳሳይ ቁልፍ የተገኘ ነው — ከላይ ካለው የጅምር-ምዝገባ መስመር ጋር ያወዳድሩት። ቁልፉ ከተቀየረ፣
የደንበኛ መተግበሪያዎች **ከሪሌዩ ጋር መነጋገር ያቆማሉ** እና ለ
ተጠቃሚው ያስጠነቅቃሉ፤ በዝምታ በፍጹም እንደገና አያስቀምጡም። የአሻራ ለውጥ እንደ
የሚሰብር ክስተት ይውሰዱ: በእርምጃ 4 ውስጥ "አዲሱን ቁልፍ ተማመን" የሚል በመተግበሪያ ውስጥ ያለ አዝራር የለም፣
ስለዚህ ከእውነተኛ የጥራዝ መጥፋት በኋላ ተጠቃሚዎችዎ ለ መለያቸው
መተግበሪያው ያስቀመጠውን ውሂብ ማጽዳት እና በመጀመሪያ ግንኙነት ላይ እንደገና ማስቀመጥ አለባቸው —
አዲሱን አሻራ በመጀመሪያ ከመንገድ ውጭ ያሳውቁ፣ አለበለዚያ የእርስዎን አዲስ ቁልፍ ከ
የአጥቂው መለየት አይችሉም።

### ምትኬ እና መመለስ

**የውሂብ ጥራዙ ሙሉ የሪሌይ ሁኔታ ነው**: አንድ የSQLite ፋይል
ማውጫውን፣ የመልእክት ሳጥኖቹን እና የሪሌይ ማንነት ቁልፍን የያዘ።
ምትኬ የሚደረግለት ሌላ ምንም የለም።

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

### ማዘመን

```bash
git pull origin main
docker compose up -d --build
```

ሁኔታው በጥራዙ ውስጥ ይኖራል፣ በምስሉ ውስጥ አይደለም፣ ስለዚህ ማዘመን የተጠቃሚዎችዎን ውሂብ በፍጹም አይነካም።

## በባዶ Node ራስ-አስተናጋጅ (Docker የለም)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

አወቃቀር የአካባቢ ተለዋዋጮች ብቻ ናቸው — `server/README.md`
ሁሉንም ይዘረዝራል። ከDocker መንገድ ሁለት ልዩነቶች:

- **የውሂብ ፋይል** ነባሪው `./breeze-relay.db` ነው (በ
  `BREEZE_DB_PATH` ይተኩ)፤ ተመሳሳይ የአንድ-ፋይል ሁኔታ ነው፣ የሪሌይ ማንነት
  ተካትቷል። በተመሳሳይ መንገድ ምትኬ ያድርጉት: አቁም፣ ቅዳ፣ ዳግም ጀምር።
- **ምዝገባ እርስዎ እስኪዘጉት ድረስ ክፍት ነው**: የዝግ ነባሪ
  የDocker ማሸጊያ ባህሪ ነው። ባዶ መግቢያን ለመዝጋት፣
  `REGISTRATION_ALLOWLIST=id1,id2` ያዘጋጁ (ወይም ባዶ እሴት ለ
  ለሁሉም-ዝግ)፤ `REGISTRATION_OPEN=1` በግልጽ እንደገና ይከፍታል።

## የCloudflare ማሰማራት

### ዝቅተኛ ማሰማራት ($0/ወር፣ 5 ደቂቃዎች)

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

**ያ ብቻ ነው።** ከግፋ ማሳወቂያዎች በስተቀር ሁሉም ባህሪያት ይሰራሉ። ልብ ይበሉ
በCloudflare ማሰማራት ላይ ምዝገባ እርስዎ
`REGISTRATION_ALLOWLIST` እስኪያዘጋጁ ድረስ **ክፍት** ነው (`.env.example`ን ይመልከቱ)፤ ዝግ-በ-ነባሪ
ማሸጊያው ከላይ ያለው የDocker መንገድ ነው።

### በ$0 የሚሰራው

| ባህሪ | ሁኔታ | ማስታወሻዎች |
|---------|--------|-------|
| E2E የተመሰጠረ ውይይት | ✓ | ሙሉ Double Ratchet |
| P2P መልእክት | ✓ | WebRTC DataChannel |
| የድምጽ/ቪዲዮ ጥሪዎች | ✓ | WebRTC + ነፃ STUN |
| TURN ሪሌይ | ✓ | Open Relay (20GB/ወር ነፃ) |
| ቡድኖች (100 አባላት) | ✓ | Sender Key O(1) |
| የፋይል ዝውውር | ✓ | በP2P እስከ 50MB |
| 8 ቋንቋዎች | ✓ | EN + 7 ሙሉ አካባቢዎች፣ በራሱ ይታወቃል |
| ከመስመር ውጭ/PWA | ✓ | Service Worker |
| የግፋ ማሳወቂያዎች | ✗ | የVAPID ቁልፎች ያስፈልጋሉ |

የብዙ-መለያ ክፍያ (Lite/Plus/Pro) አይገኝም — የ[SECURITY.md](../../SECURITY.md)
"Removed: multi-account billing" ክፍልን ይመልከቱ። እያንዳንዱ መለያ
ያለ እቅድ በር ነፃ ያልተገደበ የአካባቢ ንዑስ-መለያዎችን ያገኛል።

### የነፃ ደረጃ ወሰኖች

| ሀብት | ነፃ ደረጃ | ንቁ ተጠቃሚ አጠቃቀም |
|----------|-----------|----------------------|
| የWorker ጥያቄዎች | 100,000/ቀን | ~500/ቀን (ምርጫ + ምልክት) |
| የKV ንባቦች | 100,000/ቀን | ~200/ቀን |
| የKV ጽሑፎች | 1,000/ቀን | ~350/ቀን (ተመቻችቷል) |
| የKV ማስቀመጫ | 1 GB | ~10 KB/ተጠቃሚ |
| የማይንቀሳቀሱ ንብረቶች | ያልተገደበ | ~400 KB (አንድ HTML) |

**በነፃ ደረጃ ላይ ~3 በተመሳሳይ ጊዜ ንቁ ተጠቃሚዎችን ይደግፋል።**

### አማራጭ ባህሪያትን መጨመር

#### የግፋ ማሳወቂያዎች (ነፃ)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN ሰርቨር (ለተገደቡ አውታረ መረቦች)

TURN ጥሪዎችና የሪሌይ-ብቻ (IP-መደበቅ) ግንኙነቶች ተገዳቢ
NATዎችን የሚያልፉበት መንገድ ነው። ሪሌይዎ የሚሰጠው የትኛው TURN እንደሆነ ምርጫ **የእርስዎ** ነው
እንደ ኦፕሬተር — Workerው በቅደም ተከተል ይሞክራል:

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

**በእርግጥ ያዋቀሩትን ያረጋግጡ:** `GET /api/health` ውጤታማውን
ሁኔታ እንደ `turnProvider` ሪፖርት ያደርጋል (`cloudflare` | `custom` | `static` |
`openrelay` | `none`)። የድሮው `turn` boolean የሚያንጸባርቀው
`TURN_URL`ን ብቻ ነው፣ ስለዚህ ለሚመከረው አማራጭ A `false` ያነባል — ይጠቀሙ
`turnProvider`። የደንበኛ መተግበሪያዎች ተመሳሳይ አቅራቢን በ`/security` ውስጥ ያሳያሉ፣ ስለዚህ
በOpen Relay ምትኬ ላይ ያለ ተጠቃሚ የሶስተኛ ወገን የጥሪ ሚዲያውን እንደሚያጓጉዝ ማየት ይችላል
(ሜታዳታ ብቻ — ሚዲያው ራሱ በDTLS-SRTP ተመስጥሯል)።

#### የማረጋገጫ ማጠንከር እና ግልጽ የሪሌይ መንገድ

የprekey ሰቀላዎች አሁን የፊርማ ባለቤትነትን ለየብቻ በ
`prekey-owner:<userId>` ላይ **TTL ሳይኖር** ይጠብቃሉ። ያለ የጥቅል ባለቤትነት በሚቀጥለው
ሰቀላ ላይ በዝምታ ይሰደዳል፣ ምትክ ከመቀበሉ በፊት። አዳዲስ የEd25519 ጥቅሎችም
ያ መዝገብ ያቋቁማሉ። ጊዜያቸው ያለፈ የprekey ጥቅሎችን ሲያጸዱ እነዚህን መዝገቦች ያስቀምጡ:
የጥቅል ጊዜ ማለፍን መጠበቅ አዲስ ባለቤት መፍቀድ የለበትም። ማዞር በ
የቀድሞ ባለቤት የተፈራረመ ሰቀላ ይፈልጋል፣ አዲሱን ቁልፍ ባለው የሰቀላ ዳይጀስት ውስጥ ያስራል።
የተረጋገጠ `/account/delete` ሁለቱንም መዝገቦች ያጠፋል እና ከባለቤቱ አንጻር ማረጋገጥ ይችላል
የጥቅሉ ጊዜ ካለፈ በኋላም እንኳ። የጠፋ-ባለቤት-ቁልፍ ዳግም ማስጀመር የለም።

ለእነዚህ መዝገብ ላላቸው መለያዎች፣ ሰቀላ እና መልእክት/sealed ምርጫ፣ sealed ACK እና
የመልእክት ሳጥን WebSocket ማስረጃዎች ዘላቂውን ባለቤት መጠቀም አለባቸው። **ያልተፈራረሙ ጥያቄዎች ይቀበላሉ
ከ`PREKEY_REQUIRE_AUTH=false` ወይም `QUEUE_REQUIRE_AUTH=false` ጋር እንኳ።**
እነዚያ ባንዲራዎች ያሉትን ነባሪዎቻቸውንና የውርስ ትርጉሞቻቸውን ለመለያዎች
ባለቤት ለሌላቸው ይይዛሉ፤ ያልተፈራረሙ የሰቀላ/የሰልፍ ጥያቄዎችን ግልጽ `false` መቀበል
ይዘት-አልባ የቅናሽ ማስጠንቅቂያ ይመዘግባል። ሌሎች የማረጋገጫ ባንዲራዎች አልተቀየሩም።
የመልእክት ሳጥን WebSockets አሁንም ለሁሉም ፊርማ ይፈልጋሉ።

ደንበኛው ከሰልፍ እንቅስቃሴ በፊት የፊርማ ማስጀመርን ይጠብቃል፣
የሚመለስ-መለያ ጅምር፣ የአመራር እድገትና ዳግም ግንኙነትን ጨምሮ። የተጋራው ጥበቃ
በአምስት ሰከንዶች ተገድቧል። የማይደገፉ የሥራ ጊዜዎች ያለፊርማ ወዲያውኑ ይቀጥላሉ፤
የተጣበቀ IDB/የቁልፍ-መክፈቻ ያለፊርማ ከወሰኑ በኋላ ይቀጥላል፣ ከዚያ ዝግጁ ሲሆን ይፈርማል።
ይህ የምርጫ ዑደቱን ህያው ያደርገዋል፣ ማለፊያ **አይደለም**: ባለቤት-የተደገፉ መለያዎች
የፊርማ ቁልፋቸው እስኪያገለግል ድረስ ከሪሌዩ መቀበል አይችሉም። የዘመኑ የደንበኛ ንብረቶችን አሰማርተው
ከWorker ጎን ለጎን የድሮውን የጅምር ውድድር ለማስወገድ።

ስደት ባለቤቱ ከመጠበቁ **በፊት** ጊዜው ካለፈበት ጥቅል ባለቤትነትን ማገገም አይችልም።
የመጀመሪያ ምዝገባ TOFU ሆኖ ይቆያል። የባለቤትነት መዝገቦች ያለውን
KV ጀርባ ይጠቀማሉ: የመጨረሻ ወጥነትና በአንድ ጊዜ የሚደረጉ ጽሑፎች በዚህ ለውጥ
መስመራዊ አይደረጉም። ማስረጃዎች ያለውን የአምስት-ደቂቃ ትኩስነት መስኮት ይይዛሉ
እና የሥራ/የጭነት ትስስር፤ በአንድ መስኮት ውስጥ ተመሳሳይ ዳግም ሙከራዎች አንድ-ጊዜ
nonce ፕሮቶኮል አይደሉም።

የመገኘት ጽሑፎችና የTURN ማረጋገጫ አቅርቦት አስቀድመው *የተመዘገበ*
መለያ (የprekey ጥቅል አለ) በነባሪ ይፈልጋሉ፣ እያንዳንዱ ደንበኛም
በራሱ ይመዘገባል። የመገኘት የልብ ምቶች በተጨማሪ የEd25519 ባለቤትነት ማስረጃ ይይዛሉ
(ምቱ የሚያስቀምጣቸውን መስኮች ይፈርማል)፣ Workerውም
አንድ ሲቀርብ ሁሉ ያረጋግጣል — `PRESENCE_SIGN_REQUIRE_AUTH=true` ያንን
ማስረጃ አስገዳጅ ያደርገዋል። የተቀሩት የEd25519-ፊርማ ባንዲራዎች አማራጭ ሆነው ይቆያሉ፤
`wrangler.toml` እያንዳንዳቸውንና ምክንያቱን ይዘግባል (በWebCrypto
Ed25519 የሌላቸው የሥራ ጊዜዎች ላይ ያሉ ደንበኞች በፍጹም መፈረም አይችሉም)።

የውርስ ግልጽ ሪሌይ (`/api/msg/send`, `/api/msg/poll`) ተቋርጧል: ምላሾቹ
የ`Deprecation: true` ርዕስ ይይዛሉ፣ የsealed መንገድም
ለእያንዳንዱ የአሁን ደንበኛ ነባሪ መንገድ ነው። ምንም ህያው ደንበኛ
ምትኬውን አሁንም እንደማይፈልግ ካረጋገጡ በኋላ፣ ሙሉ በሙሉ ያጥፉት:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### የግል ዶሜይን

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### ከነፃ ደረጃ ባሻገር ማስፋት

ከነፃ ደረጃ ሲያልፍ ($5/ወር የWorkers Paid እቅድ):

| ሀብት | የሚከፈል እቅድ |
|----------|-----------|
| የWorker ጥያቄዎች | 10 ሚሊዮን/ወር |
| የKV ጽሑፎች | 1 ሚሊዮን/ወር |
| የKV ማስቀመጫ | 1 GB ተካቷል |
| የCPU ጊዜ | 30 ሰከንዶች/ጥያቄ |

ይህ **በሺዎች የሚቆጠሩ በአንድ ጊዜ ተጠቃሚዎችን** ይደግፋል።

### ማዘመን

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

የግንባታ እርምጃ የለም። የሚጫኑ ጥገኞች የሉም። ብቻ አሰማርት።
