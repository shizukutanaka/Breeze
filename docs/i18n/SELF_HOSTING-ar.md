# دليل الاستضافة الذاتية

**اقرأ بلغة أخرى**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · العربية (هذه الصفحة) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


توجد طريقتان لتشغيل مرحّل (relay) لـ Breeze:

1. **الاستضافة الذاتية (Node + Docker)** — المرحّل على جهازك الخاص أو
   VPS: حاوية واحدة، ووحدة بيانات واحدة، والتسجيل مغلق
   افتراضيًا. ابدأ من هنا إذا كان المرحّل لك ولناسك.
2. **Cloudflare** — التثبيت على النمط الرسمي على المستوى المجاني
   من Cloudflare (المرحّل الذي يشغّله Breeze نفسه). ابدأ من هناك إذا أردت
   مرحّلًا عامًا بلا خادم تصونه.

كلاهما يشغّل شيفرة المعالجة نفسها تمامًا؛ والمرحّل صندوق بريد بسيط
قابل للتبديل في كلتا الحالتين، وكل عميل (client) يعمل مع
كل مرحّل.

## الاستضافة الذاتية مع Docker

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

يقدّم المرحّل HTTP عاديًا على المنفذ 8787 داخل الحاوية.
**أنهِ TLS عند وكيل عكسي (reverse proxy) أمامه** (Caddy, nginx,
Traefik, Cloudflare Tunnel، …): المتصفحات لن تستخدم مرحّلًا
إلا عبر HTTPS/WSS. عندما تفعل ذلك، عيّن `TRUST_PROXY: "true"` في
`docker-compose.yml` بحيث يستند تحديد المعدل إلى عنوان العميل الحقيقي
— ولا تعيّنه أبدًا دون وكيل كهذا، لأن الترويسة
التي يثق بها يمكن تزويرها من قبل أي شخص يستطيع الوصول إلى المدخل مباشرة.

شغّل **حاوية واحدة** بالضبط مقابل وحدة البيانات: محدّد
المعدل في الذاكرة لكل عملية، وعمليات كل صندوق بريد
متسلسلة داخل تلك العملية، لذا فإن نسخة ثانية لن تحفظ
أيًّا من الخاصيتين. وسّع النطاق بإعطاء العملية الواحدة جهازًا أكبر.

### التسجيل: مغلق افتراضيًا

مرحّل مستضاف ذاتيًا يستطيع أي شخص على الإنترنت التسجيل فيه
سيعيد خلق اقتصاد البريد المزعج/إساءة الاستخدام الذي توجد حدود المرحّل الرسمي
للسيطرة عليه، لذا **تأتي حزمة Docker مغلقة**: يمرّر ملف
compose قيمة `REGISTRATION_ALLOWLIST` (قد تكون فارغة) و
فقط معرّفات Breeze الموجودة فيها تستطيع *إنشاء حسابات* (أول رفع لـ
prekey). إغلاق التسجيل لا يؤثر أبدًا على الأشخاص المستقرين أصلًا على
المرحّل — رفعاتهم وإيداعاتهم ولقاءاتهم (rendezvous) واستطلاعاتهم (poll) لا
تمرّ ببوابة — وفتح التسجيل اختيار صريح، وليس أبدًا
الافتراضي.

- **معرّف Breeze الخاص بك** هو المعرّف المكوّن من 12 حرفًا في رابط
  دعوتك (أول 12 حرفًا من قيمته `pub`). اطلب من كل شخص
  تدعوه معرّفه بالطريقة نفسها — المعرّف معرّف عام
  تتبادله جهات الاتصال أصلًا، وليس سرًّا.
- **قبول الأشخاص** يكون بإدراج معرّفاتهم: عيّن
  `BREEZE_ALLOWLIST=id1,id2,…` في shell أو في ملف `.env` بجانب
  `docker-compose.yml`، ثم `docker compose up -d` مرة أخرى.
- **ابدأ الآن واقبل لاحقًا**: دون تعيين `BREEZE_ALLOWLIST`، يعمل المرحّل
  مغلقًا على الجميع — سجل الإقلاع يقول ذلك — ولا أحد
  يستطيع التسجيل حتى تضيف معرّفات.
- **مرحّل مفتوح** (يستطيع أي شخص التسجيل): أزل التعليق عن
  `REGISTRATION_OPEN: "1"` في `docker-compose.yml`. إذا فعلت، فإن اقتصاد إساءة الاستخدام يصبح ملكك.

### حصة الاستخدام: عطّلها على مرحّلك الخاص

يأتي الـ worker مع **حصة استخدام عادل (fair-use) مفعّلة**: لكل
صندوق بريد، 10,000 إيداع/يوم كحد أقصى و200,000/شهر (الإيداع هو
دورة تسليم كاملة واحدة — انظر `docs/COST_MODEL.md` §10 بشأن
السياسة والأرقام). ذلك الإطار موجود من أجل *المرحّل الافتراضي المشترك*،
الذي يُشغَّل كمدخل مجاني كان على مشغّله لولا ذلك أن يتحمّل تكاليفه المتغيرة
عن الجميع. **على مرحّل تشغّله
لنفسك ولناسك، لا معنى للإطار — عطّل
ه**:

```bash
USAGE_QUOTA_ENABLED=false
```

عيّنه أينما يقرأ مرحّلك بيئته (الـ shell أو
`.env` بجانب `docker-compose.yml`، بيئة عملية Node،
أو أسرار (secrets) Cloudflare Pages). توجد مقبضان مجاوران إذا
كنت تشغّل مرحّلًا مجتمعيًا وتريد إطارًا *فعلًا*:
`USAGE_QUOTA_DAILY` و `USAGE_QUOTA_MONTHLY` يعيدان ضبط الحدود القصوى.
ملاحظات تهم:

- تُفرض الحصة فقط عندما تعيش صناديق البريد في Durable
  Objects (`MAILBOX_BACKEND=do`، وهو الافتراضي على هذا المضيف)؛ وعلى خلفية
  KV هي عملية عدم فعل (no-op) موثّقة.
- بعد الحد الأقصى، يحصل المرسلون على `429 USAGE_QUOTA_EXCEEDED` صريح
  (مع النافذة وحدّها) بدلًا من إسقاط صامت — تبقى الرسالة
  في صندوق الصادر (outbox) لدى المرسل، ويبقى المستلم
  قابلًا للوصول عبر P2P وعبر أي مرحّل منزلي آخر.

### هوية المرحّل

عند أول إقلاع، يولّد المرحّل مفتاح هوية Ed25519 دائمًا
*داخل وحدة البيانات* ويطبع بصمته في السجل:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

البصمة تعرّف مرحّلك *أنت*: أعطها لمستخدميك
خارج النطاق (out-of-band: شخصيًا، عبر قناة أخرى) لكي يتعرفوا على
المرحّل الذي أُعطي لهم بوصفه الذي تشغّله أنت. البصمة نفسها
تُطبع عند كل إقلاع؛ وإذا تغيّرت يومًا، فإن وحدة البيانات قد
استُبدلت — حقّق قبل أن تخبر المستخدمين بأن يثقوا بالجديدة.

يتحقق العملاء من هذا المفتاح ويثبّتونه (pin) تلقائيًا (المرحلة 2، الخطوة 4): عند
أول اتصال يتحدى عميل المرحّل ليوقّع بالمفتاح
(`/api/relay/attest`)، ويخزّن المفتاح المتحقق منه مع الحساب، و
يعيد التحقق في كل جلسة لاحقة. البصمة التي يعرضها العميل
(تحت `/security`، وفي الإشعار المنبثق (toast) عند أول تثبيت) مشتقة من
المفتاح نفسه — قارنها بسطر سجل الإقلاع أعلاه. إذا تغيّر المفتاح
يومًا، فإن العملاء **يتوقفون عن التحدث إلى المرحّل** ويحذّرون
المستخدم؛ ولا يعيدون التثبيت بصمت أبدًا. تعامل مع تغيّر البصمة على أنه
حدث كاسر: لا يوجد زر «أثق بالمفتاح الجديد» داخل التطبيق في
الخطوة 4، لذا بعد فقدان حقيقي للوحدة يجب على مستخدميك مسح بيانات
التطبيق المخزنة لحسابهم وإعادة التثبيت عند أول اتصال —
أعلن البصمة الجديدة خارج النطاق أولًا، وإلا فلن يستطيعوا تمييز
مفتاحك الجديد من مفتاح مهاجم.

### النسخ الاحتياطي والاستعادة

**وحدة البيانات هي حالة المرحّل بأكملها**: ملف SQLite واحد
يحمل الدليل وصناديق البريد ومفتاح هوية المرحّل.
لا يوجد شيء آخر لنسخه احتياطيًا.

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

### التحديث

```bash
git pull origin main
docker compose up -d --build
```

تعيش الحالة في الوحدة، لا في الصورة (image)، لذا فإن التحديث لا يمس أبدًا
بيانات مستخدميك.

## الاستضافة الذاتية مع Node المجرد (دون Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

التكوين بمتغيرات البيئة فقط — `server/README.md`
يدرجها كلها. فرقان عن مسار Docker:

- **ملف البيانات** افتراضيه `./breeze-relay.db` (يمكن تجاوزه بـ
  `BREEZE_DB_PATH`)؛ وهو الحالة نفسها في ملف واحد، هوية المرحّل
  مشمولة. انسخه احتياطيًا بالطريقة نفسها: إيقاف، نسخ، إعادة تشغيل.
- **التسجيل مفتوح ما لم تغلقه**: الافتراضي المغلق
  خاصية من خصائص حزمة Docker. لإغلاق مدخل مجرد، عيّن
  `REGISTRATION_ALLOWLIST=id1,id2` (أو قيمة فارغة لـ
  مغلق-على-الجميع)؛ و `REGISTRATION_OPEN=1` يعيد فتحه صراحة.

## تثبيت Cloudflare

### التثبيت الأدنى (0 دولار/شهر، 5 دقائق)

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

**هذا كل شيء.** تعمل جميع الوظائف باستثناء إشعارات الدفع. لاحظ
أن التسجيل على تثبيت Cloudflare **مفتوح** ما لم تعيّن
`REGISTRATION_ALLOWLIST` بنفسك (انظر `.env.example`)؛ والحزمة
المغلقة افتراضيًا هي مسار Docker أعلاه.

### ما يعمل بـ 0 دولار

| الوظيفة | الحالة | ملاحظات |
|---------|--------|-------|
| محادثة مشفرة E2E | ✓ | Double Ratchet كامل |
| مراسلة P2P | ✓ | WebRTC DataChannel |
| مكالمات صوتية/فيديو | ✓ | WebRTC + STUN مجاني |
| مرحّل TURN | ✓ | Open Relay (20 GB/شهر مجانًا) |
| مجموعات (100 عضو) | ✓ | Sender Key O(1) |
| نقل الملفات | ✓ | حتى 50 MB عبر P2P |
| 8 لغات | ✓ | EN + 7 لغات محلية كاملة، تُكتشف تلقائيًا |
| دون اتصال/PWA | ✓ | Service Worker |
| إشعارات الدفع | ✗ | تحتاج إلى مفاتيح VAPID |

فوترة الحسابات متعددة المستويات (Lite/Plus/Pro) غير متاحة — انظر
قسم «Removed: multi-account billing» في [SECURITY.md](../../SECURITY.md). كل حساب يحصل على
حسابات فرعية محلية غير محدودة مجانًا دون أي بوابة خطة.

### حدود المستوى المجاني

| المورد | المستوى المجاني | الاستخدام لكل مستخدم نشط |
|----------|-----------|----------------------|
| طلبات Worker | 100,000/يوم | ~500/يوم (استطلاع + إشارة) |
| قراءات KV | 100,000/يوم | ~200/يوم |
| كتابات KV | 1,000/يوم | ~350/يوم (محسّنة) |
| تخزين KV | 1 GB | ~10 KB/مستخدم |
| ملفات ثابتة | غير محدود | ~400 KB (HTML واحد) |

**يدعم ~3 مستخدمين نشطين متزامنين على المستوى المجاني.**

### إضافة وظائف اختيارية

#### إشعارات الدفع (مجانية)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### خادم TURN (للشبكات المقيدة)

TURN هي الطريقة التي تعبر بها المكالمات والاتصالات عبر المرحّل فقط (المخفي للـ IP)
الـ NAT المقيدة. أي TURN يقدّمه مرحّلك هو اختيارك **أنت** بصفتك
المشغّل — الـ Worker يجرّب، بالترتيب:

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

**تحقق مما كوّنته فعلًا:** `GET /api/health` يبلّغ عن
الوضع الفعّال بصفة `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). القيمة المنطقية الأقدم `turn` تعكس فقط
`TURN_URL`، لذا تظهر `false` للخيار A الموصى به — استخدم
`turnProvider`. يعرض العملاء المزوّد نفسه في `/security`، لذا فإن
مستخدمًا على احتياطي Open Relay يستطيع أن يرى أن طرفًا ثالثًا يرحّل
وسائط مكالمته (بيانات وصفية فقط — الوسائط نفسها مشفرة DTLS-SRTP).

#### تصليب المصادقة ومسار المرحّل العادي

رفعات prekey تحفظ الآن ملكية التوقيع بشكل منفصل عند
`prekey-owner:<userId>` **دون TTL**. ملكية الحزمة الموجودة تهاجر بتكاسل
عند الرفع التالي، قبل قبول بديل. حزم Ed25519 الجديدة أيضًا
تنشئ ذلك السجل. احتفظ بهذه السجلات عند تقليم حزم prekey المنتهية:
انتظار انتهاء الحزمة يجب ألا يسمح بمالك جديد. التدوير يتطلب
رفعًا موقّعًا من المالك السابق، يربط المفتاح الجديد في ملخّص الرفع الموجود. `/account/delete` المصادق عليه يمحو كلا السجلين ويستطيع المصادقة
ضد المالك حتى بعد انتهاء الحزمة. لا توجد إعادة تعيين لمفتاح مالك مفقود.

للحسابات ذات هذا السجل، الرفع واستطلاع الرسائل/sealed وإقرار sealed و
إثباتات WebSocket لصندوق البريد يجب أن تستخدم المالك الدائم. **الطلبات غير الموقّعة
تُرفض حتى مع `PREKEY_REQUIRE_AUTH=false` أو `QUEUE_REQUIRE_AUTH=false`.**
تلك الأعلام تحتفظ بافتراضياتها الموجودة ودلالاتها القديمة للحسابات
دون مالك؛ والقبول الصريح `false` لطلبات الرفع/الطابور غير الموقّعة
يسجّل تحذير إهمال (deprecation) خاليًا من المحتوى. أعلام المصادقة الأخرى لم تتغيّر.
WebSocket لصندوق البريد ما تزال تتطلب توقيعات من الجميع.

ينتظر العميل تهيئة التوقيع قبل نشاط الطابور، بما يشمل
إقلاع الحساب العائد والترقية إلى القائد وإعادة الاتصال. الانتظار المشترك
محدود بخمس ثوانٍ. أوقات التشغيل غير المدعومة تستمر غير موقّعة فورًا؛
فك تغليف IDB/المفتاح العالق يستمر غير موقّع بعد الحد، ثم يوقّع عندما يصبح جاهزًا.
هذا يبقي حلقة الاستطلاع حية، **ليس** تجاوزًا: الحسابات ذات المالك لا تستطيع أن
تستلم من المرحّل حتى يصبح مفتاح توقيعها قابلًا للاستخدام. ثبّت ملفات العميل المحدّثة
بجانب الـ Worker لتجنّب سباق بدء التشغيل القديم.

الهجرة لا تستطيع استعادة الملكية من حزمة انتهت **قبل** أن يُحفظ
مالكها. التسجيل الأول يبقى TOFU. سجلات الملكية تستخدم
خلفية KV الموجودة: الاتساق النهائي (eventual consistency) والكتابات المتزامنة لا تُجعل
قابلة للخطية (linearizable) بهذا التغيير. الإثباتات تحتفظ بنافذة الحداثة الموجودة ذات الخمس دقائق
وربط العملية/الحمولة؛ والمحاولات المتطابقة داخل النافذة ليست
بروتوكول nonce لمرة واحدة.

كتابات الحضور (presence) وإصدار بيانات TURN تتطلب أصلًا حسابًا *مسجّلًا*
(حزمة prekey موجودة) افتراضيًا، وكل عميل يسجّل
تلقائيًا. نبضات الحضور (heartbeat) تحمل إضافة إلى ذلك إثبات ملكية Ed25519
(النبضة توقّع الحقول التي تخزّنها)، يتحقق منه الـ Worker
كلما قُدّم واحد — `PRESENCE_SIGN_REQUIRE_AUTH=true` يجعل ذلك
الإثبات إلزاميًا. أعلام توقيع Ed25519 الباقية تبقى اختيارية (opt-in)؛
`wrangler.toml` يوثّق كلًّا منها ولماذا (العملاء على أوقات تشغيل دون
WebCrypto Ed25519 لا يستطيعون التوقيع إطلاقًا).

المرحّل العادي القديم (`/api/msg/send`، `/api/msg/poll`) مهمل (deprecated): ردوده
تحمل ترويسة `Deprecation: true`، ومسار sealed هو
المسار الافتراضي لكل عميل حالي. بمجرد أن تؤكد أنه لا يوجد عميل حي
يحتاج إلى الاحتياطي بعد، عطّله تمامًا:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### نطاق مخصص

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### التوسّع إلى ما بعد المستوى المجاني

عندما تتجاوز المستوى المجاني (خطة Workers Paid بـ 5 دولارات/شهر):

| المورد | الخطة المدفوعة |
|----------|-----------|
| طلبات Worker | 10 ملايين/شهر |
| كتابات KV | مليون/شهر |
| تخزين KV | 1 GB مشمول |
| وقت CPU | 30 ثانية/طلب |

هذا يدعم **آلاف المستخدمين المتزامنين**.

### التحديث

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

لا خطوة بناء. لا تبعيات لتثبيتها. تثبيت (deploy) فقط.
