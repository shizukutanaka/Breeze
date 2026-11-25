# خود میزبانی کی رہنما کتاب

**دوسری زبانوں میں پڑھیں / Read in another language**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · اردو (یہ صفحہ) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Breeze ریلے چلانے کے دو طریقے ہیں:

1. **خود میزبان (Node + Docker)** — آپ کی اپنی مشین یا
   VPS پر ریلے: ایک کنٹینر، ایک ڈیٹا والیوم، رجسٹریشن طے شدہ طور پر
   بند۔ اگر ریلے آپ کے اور آپ کے لوگوں کے لیے ہے تو یہاں سے شروع کریں۔
2. **Cloudflare** — Cloudflare کی مفت حد پر باقاعدہ طرز کی
   تنصیب (وہ ریلے جو Breeze خود چلاتا ہے)۔ اگر آپ
   سرور کی دیکھ بھال کے بغیر ایک عوامی ریلے چاہتے ہیں تو وہاں سے شروع کریں۔

دونوں بالکل ایک ہی ہینڈلر کوڈ چلاتے ہیں؛ ریلے کسی بھی صورت میں ایک سادہ،
باہم قابل تبادلہ میل باکس ہے، اور ہر کلائنٹ ہر
ریلے کے ساتھ کام کرتا ہے۔

## Docker کے ساتھ خود میزبان

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

ریلے کنٹینر کے اندر پورٹ 8787 پر سادہ HTTP فراہم کرتا ہے۔
**اس کے سامنے ایک ریورس پراکسی پر TLS ختم کریں** (Caddy، nginx،
Traefik، ایک Cloudflare Tunnel، …): براؤزر ریلے کا استعمال صرف
HTTPS/WSS پر کریں گے۔ جب آپ ایسا کریں تو `docker-compose.yml` میں `TRUST_PROXY: "true"` مقرر کریں
تاکہ شرح کی حد اصل کلائنٹ
پتے پر مبنی ہو — اور ایسی پراکسی کے بغیر اسے کبھی مقرر نہ کریں، کیونکہ جس ہیڈر
پر یہ بھروسا کرتا ہے اسے کوئی بھی جعلی بنا سکتا ہے جو براہ راست داخلے تک پہنچ سکے۔

ڈیٹا والیوم کے سامنے ٹھیک **ایک** کنٹینر چلائیں: شرح
محدود کنندہ فی عمل میموری میں ہوتا ہے اور ہر میل باکس کے اعمال اس
عمل کے اندر ترتیب وار ہوتے ہیں، لہٰذا دوسری نقل ان خصوصیات میں سے کوئی بھی
نہیں رکھے گی۔ اس ایک عمل کو بڑی مشین دے کر توسیع کریں۔

### رجسٹریشن: طے شدہ طور پر بند

ایک خود میزبان ریلے جس پر انٹرنیٹ پر کوئی بھی رجسٹریشن کر سکے،
اسی اسپام/غلط استعمال کی معیشت کو دوبارہ بنا دے گا جسے قابو کرنے کے لیے باقاعدہ ریلے کی حدیں
موجود ہیں، لہٰذا **Docker پیکیجنگ بند حالت میں آتی ہے**: compose
فائل ایک `REGISTRATION_ALLOWLIST` پاس کرتی ہے (ممکنہ طور پر خالی) اور
صرف اس پر موجود Breeze ID ہی *کھاتے بنا سکتی ہیں* (پہلا prekey
اپ لوڈ)۔ رجسٹریشن بند کرنا ان لوگوں کو کبھی متاثر نہیں کرتا جو پہلے سے ریلے پر آباد ہیں
— ان کے اپ لوڈ، جمع، rendezvous اور poll
گیٹ نہیں کیے جاتے — اور رجسٹریشن کھولنا ایک واضح انتخاب ہے، کبھی طے شدہ نہیں۔

- **آپ کی Breeze ID** آپ کے دعوتی لنک میں 12 حروف والا شناخت کنندہ ہے
  (اس کی `pub` قدر کے پہلے 12 حروف)۔ جسے بھی آپ دعوت دیں، اس سے اس کی ID اسی طرح مانگیں
  — ID ایک عوامی شناخت کنندہ ہے جسے روابط پہلے سے باہم تبادلہ کرتے ہیں،
  کوئی راز نہیں۔
- **لوگوں کو داخلہ دیں** ان کی ID فہرست کر کے: اپنے شیل میں یا `docker-compose.yml` کے بगल میں ایک `.env` فائل میں
  `BREEZE_ALLOWLIST=id1,id2,…` مقرر کریں، پھر دوبارہ `docker compose up -d` کریں۔
- **ابھی شروع کریں، بعد میں داخلہ دیں**: `BREEZE_ALLOWLIST` مقرر نہ ہونے پر، ریلے
  سب کے لیے بند چلتا ہے — بوٹ لاگ ایسا کہتا ہے — اور جب تک آپ ID شامل نہیں کرتے کوئی رجسٹریشن نہیں کر سکتا۔
- **کھلا ریلے** (کوئی بھی رجسٹریشن کر سکتا ہے): `docker-compose.yml` میں
  `REGISTRATION_OPEN: "1"` کو غیر تبصرہ کریں۔ اگر آپ ایسا کرتے ہیں تو غلط استعمال کی معیشت آپ کی اپنی ہے۔

### استعمال کوٹہ: اپنے ریلے پر اسے بند کریں

ورکر ایک **منصفانہ استعمال کوٹہ** فعال حالت میں آتا ہے: فی
میل باکس، زیادہ سے زیادہ 10,000 جمع/دن اور 200,000/ماہ (ایک جمع
ایک مکمل ترسیل چکر ہے — پالیسی اور اعداد کے لیے `docs/COST_MODEL.md` §10 دیکھیں
)۔ وہ ڈھانچہ *مشترکہ طے شدہ
ریلے* کے لیے موجود ہے، جو ایک مفت داخلے کے طور پر چلایا جاتا ہے جس کی متغیر لاگتیں چلانے والے کو بصورت دیگر
سب کے لیے اٹھانی پڑتیں۔ **جس ریلے کو آپ
اپنے اور اپنے لوگوں کے لیے چلاتے ہیں، اس پر وہ ڈھانچہ بے مقصد ہے — اسے غیر فعال
کریں**:

```bash
USAGE_QUOTA_ENABLED=false
```

اسے وہاں مقرر کریں جہاں آپ کا ریلے اپنا ماحول پڑھتا ہے (شیل یا
`docker-compose.yml` کے بगल میں `.env`، Node عمل کا ماحول،
یا Cloudflare Pages راز)۔ اگر آپ ایک کمیونٹی ریلے چلاتے ہیں اور ڈھانچہ *چاہتے* ہیں تو دو پڑوسی ناب موجود ہیں:
`USAGE_QUOTA_DAILY` اور `USAGE_QUOTA_MONTHLY` حدوں کو دوبارہ ترتیب دیتے ہیں۔
اہم نوٹ:

- کوٹہ صرف تب نافذ ہوتا ہے جب میل باکس Durable
  Objects میں رہتے ہیں (`MAILBOX_BACKEND=do`، اس میزبان پر طے شدہ)؛ KV بیک اینڈ پر یہ ایک دستاویزی no-op ہے۔
- حد سے آگے، بھیجنے والوں کو خاموش اخراج کے بجائے ایک واضح `429 USAGE_QUOTA_EXCEEDED`
  (اس کی ونڈو اور اس کی حد کے ساتھ) ملتا ہے — پیغام
  بھیجنے والے کے آؤٹ باکس میں رہتا ہے، اور وصول کنندہ P2P پر اور کسی دوسرے ہوم ریلے کے ذریعے قابل رسائی بنا رہتا ہے۔

### ریلے شناخت

پہلے بوٹ پر ریلے *ڈیٹا والیوم کے اندر* ایک مستقل Ed25519 شناختی چابی
بناتا ہے اور لاگ میں اس کا فنگر پرنٹ چھاپتا ہے:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

فنگر پرنٹ *آپ کے* ریلے کی شناخت کرتا ہے: اسے اپنے صارفین کو
آؤٹ آف بینڈ (ذاتی طور پر، کسی دوسرے چینل پر) دیں تاکہ وہ شناخت کر سکیں
کہ جو ریلے انہیں سونپا گیا تھا وہی ہے جو آپ چلاتے ہیں۔ وہی فنگر پرنٹ
ہر بوٹ پر چھپتا ہے؛ اگر یہ کبھی بدل جائے تو ڈیٹا والیوم بدل دیا گیا تھا
— صارفین کو نئے پر بھروسا کرنے کو کہنے سے پہلے تحقیقات کریں۔

کلائنٹ اس چابی کو خود بخود تصدیق اور پن کرتے ہیں (مرحلہ-2 قدم 4): پہلے
رابطے پر ایک کلائنٹ ریلے کو اس چابی سے دستخط کرنے کا چیلنج دیتا ہے
(`/api/relay/attest`)، تصدیق شدہ چابی کو کھاتے کے ساتھ محفوظ کرتا ہے، اور
ہر بعد کے سیشن میں دوبارہ تصدیق کرتا ہے۔ کلائنٹ جو فنگر پرنٹ دکھاتا ہے
(`/security` کے تحت، اور پہلے پن پر ٹوسٹ میں) اسی
چابی سے اخذ کیا جاتا ہے — اس کا موازنہ اوپر کی بوٹ لاگ لائن سے کریں۔ اگر چابی
کبھی بدل جائے تو کلائنٹ **ریلے سے بات کرنا بند کر دیتے ہیں** اور صارف کو خبردار کرتے ہیں
؛ وہ کبھی خاموشی سے دوبارہ پن نہیں کرتے۔ فنگر پرنٹ کی تبدیلی کو ایک
توڑنے والا واقعہ سمجھیں: قدم 4 میں ایپ کے اندر کوئی «نئی چابی پر بھروسا کریں» بٹن نہیں ہے،
لہٰذا حقیقی والیوم نقصان کے بعد آپ کے صارفین کو اپنے کھاتے کے لیے ایپ کا محفوظ شدہ ڈیٹا صاف کرنا ہوگا اور پہلے رابطے پر دوبارہ پن کرنا ہوگا —
پہلے نئے فنگر پرنٹ کا اعلان آؤٹ آف بینڈ کریں، ورنہ وہ نہیں بتا پائیں گے
کہ آپ کی نئی چابی حملہ آور کی چابی سے کیسے مختلف ہے۔

### بیک اپ اور بحالی

**ڈیٹا والیوم مکمل ریلے حالت ہے**: ایک SQLite فائل
جو ڈائریکٹری، میل باکسز اور ریلے شناختی چابی رکھتی ہے۔
بیک اپ لینے کے لیے اور کچھ نہیں ہے۔

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

### تازہ کاری

```bash
git pull origin main
docker compose up -d --build
```

حالت والیوم میں رہتی ہے، امیج میں نہیں، لہٰذا تازہ کاری کبھی
آپ کے صارفین کے ڈیٹا کو نہیں چھوتی۔

## ننگے Node کے ساتھ خود میزبان (بغیر Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

ترتیب صرف ماحولیاتی متغیرات ہیں — `server/README.md`
ان سب کو فہرست کرتا ہے۔ Docker راستے سے دو فرق:

- **ڈیٹا فائل** طے شدہ طور پر `./breeze-relay.db` ہے (`BREEZE_DB_PATH` سے ختم کریں
  )؛ یہ وہی واحد فائل حالت ہے، ریلے شناخت
  سمیت۔ اس کا بیک اپ اسی طرح لیں: روکیں، نقل کریں، دوبارہ شروع کریں۔
- **رجسٹریشن کھلی ہے جب تک آپ اسے بند نہ کریں**: بند طے شدہ
  Docker پیکیجنگ کی خصوصیت ہے۔ ننگے داخلے کو بند کرنے کے لیے،
  `REGISTRATION_ALLOWLIST=id1,id2` مقرر کریں (یا سب کے لیے بند کے لیے ایک خالی قدر)؛ `REGISTRATION_OPEN=1` واضح طور پر دوبارہ کھولتا ہے۔

## Cloudflare تنصیب

### کم از کم تنصیب ($0/ماہ، 5 منٹ)

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

**بس اتنا ہی۔** پش اطلاعات کے سوا تمام خصوصیات کام کرتی ہیں۔ نوٹ کریں
کہ Cloudflare تنصیب پر رجسٹریشن **کھلی** ہے جب تک آپ
خود `REGISTRATION_ALLOWLIST` مقرر نہ کریں (`.env.example` دیکھیں)؛ بند-طے شدہ
پیکیجنگ اوپر کا Docker راستہ ہے۔

### $0 پر کیا کام کرتا ہے

| خصوصیت | حالت | نوٹ |
|---------|--------|-------|
| E2E خفیہ کردہ چیٹ | ✓ | مکمل Double Ratchet |
| P2P پیغام رسانی | ✓ | WebRTC DataChannel |
| آواز/ویڈیو کال | ✓ | WebRTC + مفت STUN |
| TURN ریلے | ✓ | Open Relay (20GB/ماہ مفت) |
| گروپ (1,000 اراکین) | ✓ | Sender Key O(1) |
| فائل منتقلی | ✓ | P2P کے ذریعے 50MB تک |
| 51 زبانیں | ✓ | انگریزی شامل + 50 مکمل لوکیل فائلیں، خودکار شناخت |
| آف لائن/PWA | ✓ | Service Worker |
| پش اطلاعات | ✗ | VAPID چابیاں درکار |

کثیر کھاتہ بلنگ (Lite/Plus/Pro) دستیاب نہیں — [SECURITY.md](../../SECURITY.md) کا
«Removed: multi-account billing» سیکشن دیکھیں۔ ہر کھاتے کو
بغیر کسی منصوبہ گیٹنگ کے مفت لامحدود مقامی ذیلی کھاتے ملتے ہیں۔

### مفت حد کی حدود

| وسیلہ | مفت حد | فی فعال صارف استعمال |
|----------|-----------|----------------------|
| Worker درخواستیں | 100,000/دن | ~500/دن (polling + signaling) |
| KV مطالعے | 100,000/دن | ~200/دن |
| KV تحریریں | 1,000/دن | ~350/دن (بہتر کردہ) |
| KV ذخیرہ | 1 GB | ~10 KB/صارف |
| جامد اثاثے | لامحدود | ~894 KB (واحد HTML) |

**مفت حد پر ~3 ہم وقتی فعال صارفین کی حمایت کرتا ہے۔**

### اختیاری خصوصیات شامل کرنا

#### پش اطلاعات (مفت)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN سرور (پابند نیٹ ورکس کے لیے)

TURN وہ طریقہ ہے جس سے کالیں اور صرف-ریلے (IP چھپانے والے) کنکشن
پابند NAT کو عبور کرتے ہیں۔ آپ کا ریلے کون سا TURN سونپتا ہے یہ چلانے والے کے طور پر **آپ کی** پسند ہے
— ورکر ترتیب سے کوشش کرتا ہے:

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

**تصدیق کریں کہ آپ نے اصل میں کیا ترتیب دیا ہے:** `GET /api/health` مؤثر
موڈ کو `turnProvider` کے طور پر رپورٹ کرتا ہے (`cloudflare` | `custom` | `static` |
`openrelay` | `none`)۔ پرانا `turn` بولین صرف
`TURN_URL` کی عکاسی کرتا ہے، لہٰذا تجویز کردہ Option A کے لیے یہ `false` پڑھا جاتا ہے — `turnProvider` استعمال کریں
۔ کلائنٹ `/security` میں وہی فراہم کنندہ دکھاتے ہیں، لہٰذا
Open Relay فال بیک پر موجود صارف دیکھ سکتا ہے کہ کوئی تیسرا فریق ان کے
کال میڈیا کو ریلے کرتا ہے (صرف میٹا ڈیٹا — میڈیا خود DTLS-SRTP خفیہ کردہ ہے)۔

#### تصدیق سختی اور سادہ ریلے راستہ

Prekey اپ لوڈ اب دستخطی ملکیت کو الگ سے
`prekey-owner:<userId>` پر **بغیر TTL کے** محفوظ کرتے ہیں۔ موجودہ بنڈل ملکیت اگلے اپ لوڈ پر سستی سے منتقل ہوتی ہے
، متبادل قبول کیے جانے سے پہلے۔ نئے Ed25519 بنڈل بھی
اس ریکارڈ کو قائم کرتے ہیں۔ میعاد ختم ہونے والے prekey بنڈلوں کی چھانٹی کرتے وقت ان ریکارڈوں کو رکھیں:
بنڈل میعاد ختم ہونے کا انتظار نئے مالک کو اجازت نہیں دینا چاہیے۔ گردش کے لیے
پچھلے مالک کے دستخط شدہ اپ لوڈ کی ضرورت ہے، جو نئی چابی کو موجودہ اپ لوڈ ڈائجسٹ میں باندھتا ہے
۔ تصدیق شدہ `/account/delete` دونوں ریکارڈ مٹاتا ہے اور بنڈل میعاد ختم ہونے کے بعد بھی مالک کے خلاف تصدیق کر سکتا ہے
۔ کھوئی ہوئی مالک-چابی کا کوئی ری سیٹ نہیں ہے۔

اس ریکارڈ والے کھاتوں کے لیے، اپ لوڈ اور پیغام/sealed poll، sealed ACK اور
میل باکس WebSocket ثبوتوں کو پائیدار مالک کا استعمال کرنا چاہیے۔ **غیر دستخط شدہ درخواستیں
`PREKEY_REQUIRE_AUTH=false` یا `QUEUE_REQUIRE_AUTH=false` کے ساتھ بھی مسترد کی جاتی ہیں۔**
وہ جھنڈے بغیر مالک والے کھاتوں کے لیے اپنے موجودہ طے شدہ اور پرانی معنویت برقرار رکھتے ہیں
؛ غیر دستخط شدہ اپ لوڈ/قطار درخواستوں کی واضح `false` قبولیت
ایک مواد سے خالی فرسودگی تنبیہ لاگ کرتی ہے۔ دیگر تصدیقی جھنڈے غیر تبدیل شدہ ہیں۔
میل باکس WebSocket کو اب بھی سب کے لیے دستخط چاہئیں۔

کلائنٹ قطار سرگرمی سے پہلے دستخط آغاز کاری کا انتظار کرتا ہے، بشمول
واپس آنے والے کھاتے کا بوٹ، لیڈر ترقی اور دوبارہ کنکشن۔ مشترکہ انتظار
پانچ سیکنڈ پر محدود ہے۔ غیر معاون رن ٹائم فوراً غیر دستخط شدہ جاری رہتے ہیں؛
اٹکا ہوا IDB/چابی کھولنا حد کے بعد غیر دستخط شدہ جاری رہتا ہے، پھر تیار ہونے پر دستخط کرتا ہے۔
یہ poll لوپ کو زندہ رکھتا ہے، کوئی **بائی پاس نہیں**: مالک-حمایت یافتہ کھاتے
تب تک ریلے سے وصول نہیں کر سکتے جب تک ان کی دستخطی چابی قابل استعمال نہ ہو۔ پرانی اسٹارٹ اپ دوڑ سے بچنے کے لیے تازہ کلائنٹ اثاثوں کو ورکر کے ساتھ نصب کریں
۔

منتقلی اس بنڈل سے ملکیت بحال نہیں کر سکتی جس کی میعاد اس کے مالک کے محفوظ ہونے سے **پہلے** ختم ہو گئی تھی
۔ پہلی رجسٹریشن TOFU ہی رہتی ہے۔ ملکیت ریکارڈ موجودہ
KV بیک اینڈ استعمال کرتے ہیں: حتمی ہم آہنگی اور ہم وقتی تحریریں اس تبدیلی سے لکیری نہیں بنائی جاتیں
۔ ثبوت موجودہ پانچ منٹ تازگی ونڈو اور عمل/پے لوڈ بائنڈنگ برقرار رکھتے ہیں؛ ونڈو کے اندر یکساں دوبارہ کوششیں
ایک مرتبہ nonce پروٹوکول نہیں ہیں۔

Presence تحریریں اور TURN اسناد جاری کرنا پہلے سے ہی طے شدہ طور پر ایک *رجسٹرڈ*
کھاتہ (prekey بنڈل موجود) مانگتے ہیں، اور ہر کلائنٹ خود بخود رجسٹریشن کرتا ہے۔
Presence دھڑکنیں اضافی طور پر ایک Ed25519 ملکیت ثبوت رکھتی ہیں (دھڑکن
ان خانوں پر دستخط کرتی ہے جنہیں یہ محفوظ کرتی ہے)، جسے ورکر
جب بھی کوئی پیش کیا جاتا ہے تو تصدیق کرتا ہے — `PRESENCE_SIGN_REQUIRE_AUTH=true` اس
ثبوت کو لازمی بناتا ہے۔ باقی Ed25519-دستخط جھنڈے opt-in رہتے ہیں؛
`wrangler.toml` ان میں سے ہر ایک اور وجہ دستاویز کرتا ہے (WebCrypto Ed25519 کے بغیر رن ٹائم پر کلائنٹ
بالکل دستخط نہیں کر سکتے)۔

پرانا سادہ ریلے (`/api/msg/send`، `/api/msg/poll`) فرسودہ ہے: اس کی
جوابات میں `Deprecation: true` ہیڈر ہوتا ہے، اور sealed راستہ
ہر موجودہ کلائنٹ کے لیے طے شدہ راستہ ہے۔ جب آپ تصدیق کر لیں کہ کوئی زندہ
کلائنٹ اب فال بیک کی ضرورت نہیں رکھتا، تو اسے مکمل طور پر غیر فعال کر دیں:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### حسب ضرورت ڈومین

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### مفت حد سے آگے توسیع

جب آپ مفت حد سے آگے بڑھ جائیں ($5/ماہ Workers Paid منصوبہ):

| وسیلہ | ادا شدہ منصوبہ |
|----------|-----------|
| Worker درخواستیں | 10 ملین/ماہ |
| KV تحریریں | 1 ملین/ماہ |
| KV ذخیرہ | 1 GB شامل |
| CPU وقت | 30 سیکنڈ/درخواست |

یہ **ہزاروں ہم وقتی صارفین** کی حمایت کرتا ہے۔

### تازہ کاری

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

کوئی تعمیر قدم نہیں۔ کوئی انحصار نصب نہیں کرنا۔ بس نصب کریں۔
