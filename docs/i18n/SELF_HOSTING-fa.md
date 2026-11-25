# راهنمای میزبانی شخصی

**به زبان‌های دیگر بخوانید / Read in another language**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · فارسی (این صفحه) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


برای اجرای یک واسطه (ریله) Breeze دو راه وجود دارد:

1. **میزبانی شخصی (Node + Docker)** — واسطه روی دستگاه یا VPS خودتان: یک کانتینر، یک حجم داده (والیوم)، ثبت‌نام به‌طور پیش‌فرض بسته است. اگر واسطه برای شما و اطرافیانتان است، از اینجا شروع کنید.
2. **Cloudflare** — استقرار به سبک رسمی روی طرح رایگان Cloudflare (واسطه‌ای که خود Breeze اجرا می‌کند). اگر واسطه‌ای عمومی می‌خواهید که سروری برای نگهداری نداشته باشد، از آنجا شروع کنید.

هر دو دقیقاً همان کد گرداننده (هندلر) را اجرا می‌کنند؛ واسطه در هر صورت یک صندوق پستی ساده و قابل جایگزینی است و هر کلاینتی با هر واسطه‌ای کار می‌کند.

## میزبانی شخصی با Docker

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

واسطه داخل کانتینر روی درگاه 8787 به‌صورت HTTP ساده سرویس می‌دهد.
**TLS را در یک پروکسی معکوس در جلوی آن خاتمه دهید** (Caddy، nginx،
Traefik، یک Cloudflare Tunnel و …): مرورگرها واسطه را فقط روی
HTTPS/WSS استفاده می‌کنند. وقتی چنین کردید، در `docker-compose.yml`
مقدار `TRUST_PROXY: "true"` را تنظیم کنید تا محدودسازی نرخ بر اساس نشانی
واقعی کلاینت انجام شود — و هرگز بدون چنین پروکسی‌ای آن را تنظیم نکنید، چون
هدرِ مورد اعتماد آن را هر کسی که بتواند مستقیم به ورودی برسد می‌تواند جعل کند.

دقیقاً **یک** کانتینر را در برابر حجم داده اجرا کنید: محدودکننده نرخ
در حافظه و برای هر فرایند است و عملیات هر صندوق پستی داخل همان فرایند
به‌صورت ترتیبی انجام می‌شود، پس نسخه دوم هیچ‌کدام از این دو ویژگی را
نخواهد داشت. مقیاس را با دادن یک دستگاه بزرگ‌تر به همان یک فرایند بیشتر کنید.

### ثبت‌نام: به‌طور پیش‌فرض بسته است

واسطه میزبانی شخصی‌ای که هر کسی در اینترنت بتواند روی آن ثبت‌نام کند،
همان اقتصاد اسپم/سوءاستفاده‌ای را بازمی‌سازد که محدودیت‌های واسطه رسمی
برای مهارش وجود دارند، پس **بسته‌بندی Docker به‌صورت بسته عرضه می‌شود**: فایل
compose یک `REGISTRATION_ALLOWLIST` را (که ممکن است خالی باشد) پاس می‌دهد و
فقط شناسه‌های Breeze موجود در آن می‌توانند *حساب بسازند* (نخستین بارگذاری
پیش‌کلید). بستن ثبت‌نام هرگز بر کسانی که از قبل روی واسطه خانه دارند اثر
نمی‌گذارد — بارگذاری‌ها، سپردن‌ها، قرارهای ملاقات (راندوو) و نظرسنجی‌های آنان
دروازه‌بانی نمی‌شود — و باز کردن ثبت‌نام یک انتخاب صریح است، هرگز پیش‌فرض نیست.

- **شناسه Breeze شما** شناسه 12 نویسه‌ای در پیوند دعوت شماست
  (12 نویسه نخست مقدار `pub` آن). از هر فردی که دعوت می‌کنید نیز شناسه‌اش را
  به همین روش بخواهید — شناسه یک شناسه عمومی است که مخاطبان از قبل با هم
  ردوبدل می‌کنند، نه یک راز.
- **افراد را بپذیرید** با فهرست کردن شناسه‌هایشان: مقدار
  `BREEZE_ALLOWLIST=id1,id2,…` را در پوسته (شل) خود یا یک فایل `.env` در کنار
  `docker-compose.yml` تنظیم کنید، سپس دوباره `docker compose up -d` را اجرا کنید.
- **همین حالا شروع کنید، بعداً بپذیرید**: اگر `BREEZE_ALLOWLIST` تنظیم نشده باشد،
  واسطه برای همه بسته اجرا می‌شود — گزارش راه‌اندازی همین را می‌گوید — و تا وقتی
  شناسه‌ها را اضافه نکنید هیچ‌کس نمی‌تواند ثبت‌نام کند.
- **واسطه باز** (هر کسی می‌تواند ثبت‌نام کند): در `docker-compose.yml`
  خط `REGISTRATION_OPEN: "1"` را از حالت توضیح (کامنت) خارج کنید. اگر چنین کنید،
  اقتصاد سوءاستفاده بر عهده خودتان است.

### سهمیه استفاده: روی واسطه خودتان خاموشش کنید

ورکر با یک **سهمیه استفاده منصفانه** فعال عرضه می‌شود: به‌ازای هر
صندوق پستی، حداکثر 10,000 سپردن در روز و 200,000 در ماه (یک سپردن
یک چرخه کامل تحویل است — برای سیاست و اعداد به `docs/COST_MODEL.md` §10
مراجعه کنید). آن چارچوب برای *واسطه پیش‌فرض مشترک* وجود دارد، که به‌عنوان
یک ورودی رایگان اجرا می‌شود و هزینه‌های متغیرش را گرداننده در غیر این صورت
باید برای همه به دوش می‌کشید. **روی واسطه‌ای که برای خودتان و اطرافیانتان
اجرا می‌کنید، آن چارچوب بی‌فایده است — غیرفعالش کنید**:

```bash
USAGE_QUOTA_ENABLED=false
```

آن را هر جایی که واسطه‌تان محیطش را از آنجا می‌خواند تنظیم کنید (پوسته یا
`.env` در کنار `docker-compose.yml`، محیط فرایند Node،
یا رازهای Cloudflare Pages). اگر واسطه‌ای اجتماعی اجرا می‌کنید و *می‌خواهید*
چارچوبی داشته باشید، دو دکمه همسایه وجود دارد:
`USAGE_QUOTA_DAILY` و `USAGE_QUOTA_MONTHLY` سقف‌ها را دوباره تنظیم می‌کنند.
نکته‌هایی که اهمیت دارند:

- سهمیه فقط وقتی اعمال می‌شود که صندوق‌های پستی در Durable
  Objects زندگی کنند (`MAILBOX_BACKEND=do`، که روی این میزبان پیش‌فرض است)؛ روی
  پشتوانه KV یک عملیاتِ بدون اثرِ مستندشده است.
- پس از عبور از سقف، فرستندگان به‌جای حذف بی‌صدا، یک
  `429 USAGE_QUOTA_EXCEEDED` صریح (همراه با بازه و سقف آن) دریافت می‌کنند
  — پیام در صندوق خروجی فرستنده می‌ماند و گیرنده از طریق P2P و از طریق
  هر واسطه خانگی دیگری قابل دسترسی می‌ماند.

### هویت واسطه

هنگام نخستین راه‌اندازی، واسطه یک کلید هویت Ed25519 پایدار را
*داخل حجم داده* تولید می‌کند و اثر انگشت آن را در گزارش چاپ می‌کند:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

اثر انگشت، واسطه *شما* را مشخص می‌کند: آن را از راهی خارج از این مسیر
(حضوری، از یک کانال دیگر) به کاربرانتان بدهید تا بتوانند تشخیص دهند
واسطه‌ای که به آنان داده شده همان است که شما اجرا می‌کنید. همان اثر انگشت
در هر راه‌اندازی چاپ می‌شود؛ اگر روزی تغییر کرد، حجم داده جایگزین شده است
— پیش از آنکه به کاربران بگویید به اثر انگشت جدید اعتماد کنند، بررسی کنید.

کلاینت‌ها این کلید را به‌طور خودکار راستی‌آزمایی و سنجاق (پین) می‌کنند (مرحله 2، گام 4): در
نخستین تماس، کلاینت واسطه را به چالش می‌کشد تا با آن کلید امضا کند
(`/api/relay/attest`)، کلید راستی‌آزمایی‌شده را همراه حساب ذخیره می‌کند و
در هر نشست بعدی دوباره راستی‌آزمایی می‌کند. اثر انگشتی که کلاینت نشان می‌دهد
(در `/security`، و در پیام نمایشی هنگام نخستین سنجاق کردن) از همان
کلید به دست می‌آید — آن را با خط گزارش راه‌اندازی در بالا مقایسه کنید. اگر کلید
روزی تغییر کند، کلاینت‌ها **از صحبت با واسطه دست می‌کشند** و به
کاربر هشدار می‌دهند؛ هرگز بی‌صدا دوباره سنجاق نمی‌کنند. تغییر اثر انگشت را یک
رویداد گسست‌زا بدانید: در گام 4 هیچ دکمه درون‌برنامه‌ای «به کلید جدید اعتماد کن» وجود ندارد،
پس پس از یک از دست رفتن واقعی حجم داده، کاربرانتان باید داده ذخیره‌شده برنامه
را برای حسابشان پاک کنند و در نخستین تماس دوباره سنجاق کنند —
اثر انگشت جدید را اول از راهی خارج از این مسیر اعلام کنید، وگرنه نمی‌توانند تشخیص دهند
کلید جدید شما از کلید یک مهاجم چیست.

### پشتیبان‌گیری و بازیابی

**حجم داده تمام وضعیت واسطه است**: یک فایل SQLite که
فهرست (دایرکتوری)، صندوق‌های پستی و کلید هویت واسطه را نگه می‌دارد.
چیز دیگری برای پشتیبان‌گیری وجود ندارد.

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

### به‌روزرسانی

```bash
git pull origin main
docker compose up -d --build
```

وضعیت در حجم داده زندگی می‌کند، نه در ایمیج، پس به‌روزرسانی هرگز به داده‌های
کاربرانتان دست نمی‌زند.

## میزبانی شخصی با Node خالص (بدون Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

پیکربندی فقط با متغیرهای محیطی است — `server/README.md`
همه آن‌ها را فهرست می‌کند. دو تفاوت با مسیر Docker:

- **فایل داده** به‌طور پیش‌فرض `./breeze-relay.db` است (با
  `BREEZE_DB_PATH` می‌توانید تغییرش دهید)؛ همان وضعیت تک‌فایلی است، هویت
  واسطه هم شامل آن. به همان روش از آن پشتیبان بگیرید: توقف، کپی، راه‌اندازی دوباره.
- **ثبت‌نام باز است مگر اینکه ببندیدش**: پیش‌فرض بسته بودن
  ویژگی بسته‌بندی Docker است. برای بستن یک ورودی خالص، مقدار
  `REGISTRATION_ALLOWLIST=id1,id2` را تنظیم کنید (یا یک مقدار خالی برای
  بسته بودن برای همه)؛ `REGISTRATION_OPEN=1` آن را به‌صراحت دوباره باز می‌کند.

## استقرار روی Cloudflare

### استقرار حداقلی (0 دلار در ماه، 5 دقیقه)

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

**همین است.** همه قابلیت‌ها به‌جز اعلان‌های پوش کار می‌کنند. توجه کنید
که ثبت‌نام روی یک استقرار Cloudflare **باز** است مگر اینکه
خودتان `REGISTRATION_ALLOWLIST` را تنظیم کنید (به `.env.example` مراجعه کنید)؛
بسته‌بندی بسته‌به‌طور پیش‌فرض همان مسیر Docker در بالاست.

### آنچه با 0 دلار کار می‌کند

| قابلیت | وضعیت | یادداشت‌ها |
|---------|--------|-------|
| گفتگوی رمزنگاری‌شده سرتاسری | ✓ | Double Ratchet کامل |
| پیام‌رسانی P2P | ✓ | WebRTC DataChannel |
| تماس صوتی/ویدیویی | ✓ | WebRTC + STUN رایگان |
| واسطه TURN | ✓ | Open Relay (20GB/ماه رایگان) |
| گروه‌ها (1,000 عضو) | ✓ | Sender Key O(1) |
| انتقال فایل | ✓ | تا 50MB از طریق P2P |
| 51 زبان | ✓ | انگلیسی داخلی + 50 فایل مکان کامل، شناسایی خودکار |
| آفلاین/PWA | ✓ | Service Worker |
| اعلان‌های پوش | ✗ | به کلیدهای VAPID نیاز دارد |

صورت‌حساب چندحسابی (Lite/Plus/Pro) در دسترس نیست — به
بخش «Removed: multi-account billing» در [SECURITY.md](../../SECURITY.md) مراجعه کنید. هر حساب
زیرحساب‌های محلی نامحدود را رایگان و بدون دروازه‌بانی طرح دریافت می‌کند.

### محدودیت‌های طرح رایگان

| منبع | طرح رایگان | مصرف به‌ازای هر کاربر فعال |
|----------|-----------|----------------------|
| درخواست‌های Worker | 100,000/روز | ~500/روز (نظرسنجی + سیگنال‌دهی) |
| خواندن‌های KV | 100,000/روز | ~200/روز |
| نوشتن‌های KV | 1,000/روز | ~350/روز (بهینه‌شده) |
| ذخیره‌سازی KV | 1 GB | ~10 KB/کاربر |
| دارایی‌های ایستا | نامحدود | ~894 KB (یک HTML) |

**حدود 3 کاربر فعال هم‌زمان را روی طرح رایگان پشتیبانی می‌کند.**

### افزودن قابلیت‌های اختیاری

#### اعلان‌های پوش (رایگان)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### سرور TURN (برای شبکه‌های محدودکننده)

TURN شیوه‌ای است که تماس‌ها و اتصال‌های فقط‌واسطه‌ای (پنهان‌کننده IP) از
NATهای محدودکننده عبور می‌کنند. اینکه واسطه شما کدام TURN را تحویل دهد، انتخاب
**شما** به‌عنوان گرداننده است — ورکر به این ترتیب امتحان می‌کند:

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

**آنچه را واقعاً پیکربندی کرده‌اید راستی‌آزمایی کنید:** `GET /api/health` حالت
مؤثر را به‌صورت `turnProvider` گزارش می‌کند (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). بولین قدیمی‌تر `turn` فقط
`TURN_URL` را بازتاب می‌دهد، پس برای گزینه A توصیه‌شده `false` خوانده می‌شود — از
`turnProvider` استفاده کنید. کلاینت‌ها همان فراهم‌کننده را در `/security` نشان می‌دهند، پس
کاربری که روی پشتوانه Open Relay است می‌تواند ببیند که شخص ثالثی واسطه
رسانه تماس اوست (فقط فراداده — خود رسانه با DTLS-SRTP رمزنگاری شده است).

#### سخت‌گیری احراز هویت و مسیر واسطه ساده (Plain)

بارگذاری‌های پیش‌کلید اکنون مالکیت امضا را جداگانه در
`prekey-owner:<userId>` و **بدون TTL** نگه می‌دارند. مالکیت بسته موجود در
بارگذاری بعدی، پیش از پذیرفته شدن جایگزین، به‌تنبلی مهاجرت می‌کند. بسته‌های Ed25519 تازه نیز
آن سابقه را ایجاد می‌کنند. هنگام هرس کردن بسته‌های پیش‌کلید منقضی، این سابقه‌ها را نگه دارید:
منتظر انقضای بسته ماندن نباید به مالک تازه اجازه دهد. چرخش (روتیشن) نیازمند
بارگذاری‌ای است که مالک قبلی امضا کرده باشد و کلید جدید را در همان چکیده (دایجست) بارگذاری
موجود مقید کند. `/account/delete` احرازشده هر دو سابقه را پاک می‌کند و می‌تواند
حتی پس از انقضای بسته نیز در برابر مالک احراز شود. هیچ بازنشانی‌ای برای کلید مالک گم‌شده وجود ندارد.

برای حساب‌هایی که این سابقه را دارند، بارگذاری و نظرسنجی پیام/مهروموم‌شده، ACK مهروموم‌شده و
اثبات‌های WebSocket صندوق پستی باید از مالک پایدار استفاده کنند. **درخواست‌های بدون امضا
حتی با `PREKEY_REQUIRE_AUTH=false` یا `QUEUE_REQUIRE_AUTH=false` هم رد می‌شوند.**
آن پرچم‌ها پیش‌فرض‌ها و معنای قدیمی خود را برای حساب‌های
بدون مالک حفظ می‌کنند؛ پذیرش صریح `false` برای درخواست‌های بارگذاری/صف بدون امضا
یک هشدار منسوخ‌شدنِ بدون محتوا ثبت می‌کند. دیگر پرچم‌های احراز بدون تغییر می‌مانند.
WebSocketهای صندوق پستی همچنان برای همه نیازمند امضا هستند.

کلاینت پیش از فعالیت صف منتظر آغاز به کار امضا می‌ماند، از جمله
راه‌اندازی حساب برگشتی، ارتقای رهبر و اتصال دوباره. انتظار مشترک
به پنج ثانیه محدود است. محیط‌های اجرایی پشتیبانی‌نشده بی‌درنگ بدون امضا ادامه می‌دهند؛
IDB/بازکردن قفل کلیدی که گیر کرده پس از آن حد بدون امضا ادامه می‌دهد و وقتی آماده شد امضا می‌کند.
این کار حلقه نظرسنجی را زنده نگه می‌دارد، **نه** یک راه گریز: حساب‌های دارای پشتوانه مالک نمی‌توانند
تا وقتی کلید امضایشان قابل استفاده نشده از واسطه دریافت کنند. دارایی‌های به‌روزشده کلاینت را
در کنار ورکر مستقر کنید تا از رقابت راه‌اندازی قدیمی پرهیز شود.

مهاجرت نمی‌تواند مالکیت را از بسته‌ای که **پیش** از
نگه داشته شدن مالکش منقضی شده بازیابی کند. ثبت‌نام نخست همچنان TOFU می‌ماند. سابقه‌های مالکیت از
همان پشتوانه KV موجود استفاده می‌کنند: سازگاری نهایی و نوشتن‌های هم‌زمان با این
تغییر خطی‌سازی نمی‌شوند. اثبات‌ها همان بازه تازگی پنج‌دقیقه‌ای و مقیدسازی عملیات/بار داده را حفظ می‌کنند؛ تلاش‌های دوباره یکسان در همان بازه
یک پروتکل نانس یک‌بارمصرف نیستند.

نوشتن‌های حضور و صدور اعتبارنامه TURN از پیش نیازمند یک حساب *ثبت‌شده*
(بسته پیش‌کلید موجود) به‌طور پیش‌فرض هستند و هر کلاینت به‌طور خودکار ثبت‌نام می‌کند.
ضربان‌های حضور علاوه بر این یک اثبات مالکیت Ed25519 حمل می‌کنند (ضربان
فیلدهایی را که ذخیره می‌کند امضا می‌کند)، که ورکر هرگاه
چنین اثباتی ارائه شود آن را راستی‌آزمایی می‌کند — `PRESENCE_SIGN_REQUIRE_AUTH=true` آن
اثبات را اجباری می‌کند. دیگر پرچم‌های امضای Ed25519 به‌صورت انتخابی (opt-in) می‌مانند؛
`wrangler.toml` هر یک و دلیلش را مستند می‌کند (کلاینت‌ها روی محیط‌های اجرایی بدون
WebCrypto Ed25519 اصلاً نمی‌توانند امضا کنند).

واسطه ساده قدیمی (`/api/msg/send`، `/api/msg/poll`) منسوخ شده است: پاسخ‌هایش
یک هدر `Deprecation: true` حمل می‌کنند و مسیر مهروموم‌شده
مسیر پیش‌فرض برای هر کلاینت کنونی است. وقتی تأیید کردید که دیگر هیچ کلاینت زنده‌ای
به پشتوانه نیاز ندارد، آن را یکسره غیرفعال کنید:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### دامنه اختصاصی

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### مقیاس فراتر از طرح رایگان

وقتی از طرح رایگان فراتر رفتید (طرح Workers Paid، 5 دلار در ماه):

| منبع | طرح پولی |
|----------|-----------|
| درخواست‌های Worker | 10 میلیون/ماه |
| نوشتن‌های KV | 1 میلیون/ماه |
| ذخیره‌سازی KV | 1 GB شامل |
| زمان CPU | 30 ثانیه/درخواست |

این از **هزاران کاربر هم‌زمان** پشتیبانی می‌کند.

### به‌روزرسانی

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

بدون گام ساخت. بدون وابستگی‌ای برای نصب. فقط مستقر کنید.
