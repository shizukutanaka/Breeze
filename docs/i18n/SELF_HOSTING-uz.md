# O'z serverida joylashtirish qo'llanmasi

**Boshqa tilda o'qish / Read in another language**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · Oʻzbek (shu sahifa) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Breeze uzatuvchisini ishga tushirishning ikki usuli bor:

1. **O'z serverida (Node + Docker)** — uzatuvchi o'z mashinangizda yoki
   VPS'da: bitta konteyner, bitta ma'lumot hajmi, ro'yxatdan o'tish
   dastlab yopiq. Uzatuvchi siz va sizning odamlaringiz uchun bo'lsa,
   shundan boshlang.
2. **Cloudflare** — Cloudflare'ning bepul tarifidagi rasmiy uslubdagi
   joylashtirish (Breeze'ning o'zi ishlatadigan uzatuvchi). Xizmat
   ko'rsatiladigan serveri yo'q ommaviy uzatuvchi xohlasangiz, shundan
   boshlang.

Ikkalasi ham bir xil ishlovchi kodni ishga tushiradi; uzatuvchi har ikki
holda ham oddiy, almashtiriladigan pochta qutisi va har bir mijoz har bir
uzatuvchi bilan ishlaydi.

## Docker bilan o'z serverida

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

Uzatuvchi konteyner ichida 8787 portida oddiy HTTP xizmatini ko'rsatadi.
**Uning oldiga teskari proksi qo'yib, TLS'ni o'sha yerda tugating** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): brauzerlar uzatuvchini faqat
HTTPS/WSS orqali ishlatadi. Shunday qilsangiz, tezlik cheklovi haqiqiy mijoz
manzili bo'yicha kalitlanishi uchun `docker-compose.yml`da
`TRUST_PROXY: "true"` deb belgilang — va bunday proksi bo'lmasa uni hech qachon
belgilamang, chunki u ishonadigan sarlavhani kirish nuqtasiga to'g'ridan-to'g'ri
yeta oladigan har kim soxtalashtira oladi.

Ma'lumot hajmiga qarshi aniq **bitta** konteyner ishlating: tezlik
cheklovchisi har bir jarayon uchun xotirada turadi va har bir pochta qutisining
amallari shu jarayon ichida ketma-ketlashtiriladi, shuning uchun ikkinchi
nusxada bu xususiyatlarning hech biri bo'lmasdi. Miqyosni bitta jarayonga
kattaroq mashina berish orqali oshiring.

### Ro'yxatdan o'tish: dastlab yopiq

Internetdan har kim ro'yxatdan o'ta oladigan o'z serverli uzatuvchi,
rasmiy uzatuvchining cheklovlari boshqarish uchun mavjud bo'lgan spam/suiiste'mol
iqtisodiyotini qayta yaratgan bo'lardi, shuning uchun **Docker qadoqlash
yopiq holda yetkaziladi**: compose fayli `REGISTRATION_ALLOWLIST` (bo'sh ham
bo'lishi mumkin) uzatadi va faqat undagi Breeze ID'lari *hisob yarata* oladi
(birinchi prekey yuklash). Ro'yxatdan o'tishni yopish uzatuvchida allaqachon
uyi bor odamlar ga hech qachon ta'sir qilmaydi — ularning yuklashlari,
depozitlari, uchrashuvlari va so'rovlari darvozalanmaydi — va ro'yxatdan
o'tishni ochish ochiq tanlov, hech qachon standart holat emas.

- **Sizning Breeze ID'ingiz** — taklif havolangizdagi 12 belgili identifikator
  (uning `pub` qiymatining birinchi 12 belgisi). Taklif qilgan har bir
  odamingizdan uniki ham xuddi shunday so'rang — ID kontaktlar allaqachon
  almashadigan ommaviy identifikator, sir emas.
- **Odamlarni qabul qilish** uchun ularning ID'larini ro'yxatlang: qobig'ingizda
  yoki `docker-compose.yml` yonidagi `.env` faylida
  `BREEZE_ALLOWLIST=id1,id2,…` deb belgilang, keyin yana `docker compose up -d`
  bajaring.
- **Hozir boshlang, keyin qabul qiling**: `BREEZE_ALLOWLIST` belgilanmasa,
  uzatuvchi hammaga yopiq ishlaydi — ishga tushirish jurnali shunday deydi — va
  siz ID'lar qo'shguningizcha hech kim ro'yxatdan o'ta olmaydi.
- **Ochiq uzatuvchi** (har kim ro'yxatdan o'ta oladi): `docker-compose.yml`dagi
  `REGISTRATION_OPEN: "1"` qatorining izohini olib tashlang. Shunday qilsangiz,
  suiiste'mol iqtisodiyoti sizniki bo'ladi.

### Foydalanish kvotasi: o'z uzatuvchingizda o'chiring

Ishchi **adolatli foydalanish kvotasi** yoqilgan holda yetkaziladi: har bir pochta
qutisi uchun kuniga ko'pi bilan 10 000 depozit va oyiga 200 000 (depozit — bitta
to'liq yetkazish sikli — siyosat va raqamlar uchun `docs/COST_MODEL.md`
§10 ga qarang). Bu doira operator aks holda hamma uchun ko'taradigan
o'zgaruvchan xarajatlari bor bepul kirish sifatida ishlatiladigan *umumiy
standart uzatuvchi* uchun mavjud. **O'zingiz va odamlaringiz uchun
ishlatadigan uzatuvchida doiraning ma'nosi yo'q — uni o'chiring**:

```bash
USAGE_QUOTA_ENABLED=false
```

Uni uzatuvchingiz muhitini o'qiydigan joyda belgilang (qobiq yoki
`docker-compose.yml` yonidagi `.env`, Node jarayoni muhiti
yoki Cloudflare Pages sirlari). Jamoa uzatuvchisini ishlatsangiz va
doirani *xohlasangiz*, ikkita qo'shni tugma bor:
`USAGE_QUOTA_DAILY` va `USAGE_QUOTA_MONTHLY` cheklovlarni qayta sozlaydi.
Muhim eslatmalar:

- Kvota faqat pochta qutilari Durable Objects'da yashaganda qo'llaniladi
  (`MAILBOX_BACKEND=do`, bu xostdagi standart holat); KV orqa tomonida u
  hujjatlashtirilgan ta'sirsiz amaldir.
- Cheklovdan oshganda, yuboruvchilar jimgina tashlab yuborish o'rniga ochiq
  `429 USAGE_QUOTA_EXCEEDED` oladi (oynasi va chegarasi bilan) — xabar
  yuboruvchining chiquvchi qutisida qoladi va qabul qiluvchi P2P orqali
  hamda har qanday boshqa uy uzatuvchisi orqali yetib boriladigan bo'lib qoladi.

### Uzatuvchi shaxsi

Birinchi ishga tushishda uzatuvchi *ma'lumot hajmi ichida* doimiy Ed25519 shaxs
kalitini yaratadi va uning barmoq izini jurnalda chop etadi:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Barmoq izi *sizning* uzatuvchingizni tanitadi: uni foydalanuvchilaringizga
kanaldan tashqari (shaxsan, boshqa kanal orqali) bering, shunda ular o'zlariga
berilgan uzatuvchini siz ishlatadigan uzatuvchi sifatida taniy olsinlar. Xuddi
shu barmoq izi har bir ishga tushishda chop etiladi; u qachonlardir o'zgarsa,
ma'lumot hajmi almashtirilgan — foydalanuvchilarga yangisiga ishonishni
aytishdan oldin tekshirib chiqing.

Mijozlar bu kalitni avtomatik tekshiradi va mahkamlaydi (2-bosqich 4-qadam):
birinchi aloqada mijoz uzatuvchiga kalit bilan imzolash uchun chaqiruv yuboradi
(`/api/relay/attest`), tekshirilgan kalitni hisob bilan birga saqlaydi va
keyingi har bir sessiyada qayta tekshiradi. Mijoz ko'rsatadigan barmoq izi
(`/security` ostida va birinchi mahkamlashdagi bildirishnomada) xuddi shu
kalitdan hosil qilinadi — uni yuqoridagi ishga tushirish jurnali qatori bilan
taqqoslang. Kalit qachonlardir o'zgarsa, mijozlar **uzatuvchi bilan
gaplashishni to'xtatadi** va foydalanuvchini ogohlantiradi; ular hech qachon
jimgina qayta mahkamlamaydi. Barmoq izi o'zgarishini buzuvchi hodisa sifatida
qabul qiling: 4-qadamda ilova ichida «yangi kalitga ishonish» tugmasi yo'q,
shuning uchun hajmning haqiqiy yo'qolishidan keyin foydalanuvchilaringiz
hisoblari uchun ilovaning saqlangan ma'lumotlarini tozalashi va birinchi
aloqada qayta mahkamlashi kerak — oldin yangi barmoq izini kanaldan tashqari
e'lon qiling, aks holda ular sizning yangi kalitingizni hujumchinikidan
ajrata olmaydi.

### Zaxira nusxa va tiklash

**Ma'lumot hajmi — butun uzatuvchi holati**: katalogni, pochta qutilarini
va uzatuvchi shaxs kalitini saqlaydigan bitta SQLite fayli.
Zaxira nusxasini olish uchun boshqa hech narsa yo'q.

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

### Yangilash

```bash
git pull origin main
docker compose up -d --build
```

Holat obrazda emas, hajmda yashaydi, shuning uchun yangilash foydalanuvchilaringizning
ma'lumotlariga hech qachon tegmaydi.

## Yalang'och Node bilan o'z serverida (Docker'siz)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfiguratsiya faqat muhit o'zgaruvchilari — `server/README.md`
hammasini ro'yxatlaydi. Docker yo'lidan ikkita farq:

- **Ma'lumot fayli** dastlab `./breeze-relay.db` (`BREEZE_DB_PATH`
  bilan o'zgartiring); bu uzatuvchi shaxsini ham o'z ichiga olgan xuddi shu
  bitta fayllik holat. Uning zaxira nusxasini ham xuddi shunday oling: to'xtating,
  nusxalang, qayta ishga tushiring.
- **Ro'yxatdan o'tish siz yopguningizcha ochiq**: yopiq standart holat
  Docker qadoqlashning xususiyati. Yalang'och kirishni yopish uchun
  `REGISTRATION_ALLOWLIST=id1,id2` (yoki hammaga yopiq uchun bo'sh qiymat)
  belgilang; `REGISTRATION_OPEN=1` ochiq tarzda qayta ochadi.

## Cloudflare joylashtirish

### Minimal joylashtirish (oyiga 0 dollar, 5 daqiqa)

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

**Shu xolos.** Push bildirishnomalaridan tashqari barcha funksiyalar ishlaydi.
Eslatib o'tamizki, Cloudflare joylashtirishda ro'yxatdan o'tish o'zingiz
`REGISTRATION_ALLOWLIST` belgilamasangiz **ochiq** (`.env.example`ga
qarang); dastlab yopiq qadoqlash yuqoridagi Docker yo'lidir.

### 0 dollarga nima ishlaydi

| Funksiya | Holat | Eslatmalar |
|---------|--------|-------|
| E2E shifrlangan chat | ✓ | To'liq Double Ratchet |
| P2P xabar almashish | ✓ | WebRTC DataChannel |
| Ovozli/video qo'ng'iroqlar | ✓ | WebRTC + bepul STUN |
| TURN uzatuvchisi | ✓ | Open Relay (oyiga 20GB bepul) |
| Guruhlar (1,000 a'zo) | ✓ | Sender Key O(1) |
| Fayl uzatish | ✓ | P2P orqali 50MB gacha |
| 51 til | ✓ | Ingliz tili o'rnatilgan + 50 ta to'liq til fayli, avtomatik aniqlanadi |
| Oflayn/PWA | ✓ | Service Worker |
| Push bildirishnomalari | ✗ | VAPID kalitlari kerak |

Ko'p hisobli to'lov (Lite/Plus/Pro) mavjud emas —
[SECURITY.md](../../SECURITY.md)ning «Removed: multi-account billing» bo'limiga qarang. Har bir hisob
reja darvozasiz bepul cheksiz mahalliy kichik hisoblar oladi.

### Bepul tarif cheklovlari

| Resurs | Bepul tarif | Faol foydalanuvchi boshiga foydalanish |
|----------|-----------|----------------------|
| Worker so'rovlari | Kuniga 100 000 | ~Kuniga 500 (so'rov + signal) |
| KV o'qishlari | Kuniga 100 000 | ~Kuniga 200 |
| KV yozishlari | Kuniga 1 000 | ~Kuniga 350 (optimallashtirilgan) |
| KV saqlash | 1 GB | ~Foydalanuvchi boshiga 10 KB |
| Statik aktivlar | Cheksiz | ~894 KB (bitta HTML) |

**Bepul tarifda ~3 bir vaqtda faol foydalanuvchini qo'llab-quvvatlaydi.**

### Qo'shimcha funksiyalarni qo'shish

#### Push bildirishnomalari (bepul)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN serveri (cheklovchi tarmoqlar uchun)

TURN — qo'ng'iroqlar va faqat uzatuvchili (IP yashiruvchi) ulanishlarning
cheklovchi NAT'larni kesib o'tish usuli. Uzatuvchingiz qaysi TURN'ni berishi
operator sifatida **sizning** tanlovingiz — Worker tartib bilan
quyidagilarni sinab ko'radi:

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

**Haqiqatan nimani sozlaganingizni tekshiring:** `GET /api/health` samarali
rejimni `turnProvider` sifatida xabar qiladi (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Eski `turn` mantiqiy qiymati faqat
`TURN_URL`ni aks ettiradi, shuning uchun tavsiya etilgan A varianti uchun u `false`
bo'lib o'qiladi — `turnProvider`dan foydalaning. Mijozlar xuddi shu provayderni
`/security`da ko'rsatadi, shuning uchun Open Relay zaxirasidagi foydalanuvchi
uchinchi tomon uning qo'ng'iroq mediasini uzatayotganini ko'ra oladi (faqat
metama'lumotlar — medianing o'zi DTLS-SRTP bilan shifrlangan).

#### Autentifikatsiyani kuchaytirish va oddiy uzatuvchi yo'li

Prekey yuklashlar endi imzolash egaligini `prekey-owner:<userId>`da
**TTL'siz** alohida saqlaydi. Mavjud to'plam egaligi keyingi yuklashda,
almashtirish qabul qilinishidan oldin, dangasa tarzda ko'chiriladi. Yangi Ed25519
to'plamlari ham shu yozuvni o'rnatadi. Muddati o'tgan prekey to'plamlarini
tozalaganda bu yozuvlarni saqlang: to'plam muddati o'tishini kutish
yangi egaga ruxsat bermasligi kerak. Aylanish oldingi ega tomonidan imzolangan
yuklashni talab qiladi, yangi kalitni mavjud yuklash dayjestida bog'laydi.
Autentifikatsiya qilingan `/account/delete` ikkala yozuvni ham o'chiradi va to'plam
muddati o'tgandan keyin ham egaga qarshi autentifikatsiya qila oladi.
Yo'qolgan ega kalitini tiklash yo'q.

Bu yozuvga ega hisoblar uchun yuklash va xabar/muhrlangan so'rov, muhrlangan ACK va
pochta qutisi WebSocket isbotlari doimiy egadan foydalanishi kerak. **Imzosiz so'rovlar
`PREKEY_REQUIRE_AUTH=false` yoki `QUEUE_REQUIRE_AUTH=false` bo'lsa ham rad etiladi.**
Bu bayroqlar egasi yo'q hisoblar uchun mavjud standart qiymatlari va eski
semantikalarini saqlaydi; imzosiz yuklash/navbat so'rovlarining ochiq `false` qabuli
mazmunsiz eskirganlik ogohlantirishini yozadi. Boshqa autentifikatsiya bayroqlari o'zgarmagan.
Pochta qutisi WebSocket'lari hamon hamma uchun imzo talab qiladi.

Mijoz navbat faoliyatidan oldin imzolash boshlanishini kutadi, jumladan
qaytib kelgan hisobning yuklanishi, yetakchi ko'tarilishi va qayta ulanish. Umumiy kutish
besh soniya bilan cheklangan. Qo'llab-quvvatlanmaydigan ish muhitlari darhol imzosiz davom etadi;
tiqilib qolgan IDB/kalit ochish cheklovdan keyin imzosiz davom etadi, keyin tayyor bo'lganda imzolaydi.
Bu so'rov siklini tirik saqlaydi, **aylanib o'tish emas**: egasi bor hisoblar
imzolash kaliti ishlatiladigan bo'lgunicha uzatuvchidan ola olmaydi. Eski boshlanish
poygasidan qochish uchun yangilangan mijoz aktivlarini Worker bilan birga joylashtiring.

Ko'chirish egalikni egasi saqlanishidan **oldin** muddati o'tgan to'plamdan
tiklay olmaydi. Birinchi ro'yxatdan o'tish TOFU bo'lib qoladi. Egalik yozuvlari mavjud
KV orqa tomonidan foydalanadi: bir vaqtdagi yozishlar va yakuniy muvofiqlik
bu o'zgarish bilan chiziqli qilinmaydi. Isbotlar mavjud besh daqiqalik yangilik
oynasini va amal/yuklama bog'lashini saqlaydi; oyna ichidagi bir xil
takrorlar bir martalik nonce protokoli emas.

Mavjudlik yozishlari va TURN hisob ma'lumotlarini berish dastlab *ro'yxatdan
o'tgan* hisobni (prekey to'plami mavjud) talab qiladi va har bir mijoz avtomatik
ro'yxatdan o'tadi. Mavjudlik yurak urishlari qo'shimcha ravishda Ed25519 egalik
isbotini tashiydi (urish saqlaydigan maydonlarini imzolaydi), Worker u taqdim etilganda
har doim tekshiradi — `PRESENCE_SIGN_REQUIRE_AUTH=true` shu isbotni majburiy qiladi.
Qolgan Ed25519 imzo bayroqlari tanlovli bo'lib qoladi; `wrangler.toml` har birini
va sababini hujjatlashtiradi (WebCrypto Ed25519'si yo'q ish muhitlaridagi mijozlar
umuman imzolay olmaydi).

Eski oddiy uzatuvchi (`/api/msg/send`, `/api/msg/poll`) eskirgan: uning
javoblari `Deprecation: true` sarlavhasini tashiydi va muhrlangan yo'l har bir
hozirgi mijoz uchun standart marshrutdir. Hech bir tirik mijozga zaxira
yo'l kerak emasligini tasdiqlaganingizdan keyin uni butunlay o'chiring:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Shaxsiy domen

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Bepul tarifdan tashqari miqyoslash

Bepul tarifdan oshganingizda (oyiga 5 dollarlik Workers Paid rejasi):

| Resurs | Pullik reja |
|----------|-----------|
| Worker so'rovlari | Oyiga 10 million |
| KV yozishlari | Oyiga 1 million |
| KV saqlash | 1 GB kiritilgan |
| CPU vaqti | So'rov boshiga 30 soniya |

Bu **minglab bir vaqtda foydalanuvchilarni** qo'llab-quvvatlaydi.

### Yangilash

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Yig'ish qadami yo'q. O'rnatiladigan bog'liqliklar yo'q. Shunchaki joylashtiring.
