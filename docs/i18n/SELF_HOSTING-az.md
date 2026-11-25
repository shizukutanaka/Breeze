# Öz Serverində Yerləşdirmə Təlimatı

**Başqa dildə oxuyun / Read in another language**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · Azərbaycan (bu səhifə) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Breeze ötürücüsünü işə salmağın iki yolu var:

1. **Öz serverində (Node + Docker)** — ötürücü öz maşınınızda və ya
   VPS-də: bir konteyner, bir məlumat həcmi, qeydiyyat ilkin olaraq
   bağlıdır. Ötürücü sizin və sizin insanlarınız üçündürsə, buradan başlayın.
2. **Cloudflare** — Cloudflare-ın pulsuz planında rəsmi üslublu
   yerləşdirmə (Breeze-in özünün işlətdiyi ötürücü). Baxım tələb edən
   serveri olmayan ictimai ötürücü istəyirsinizsə, oradan başlayın.

Hər ikisi eyni idarəedici kodu işlədir; ötürücü hər iki halda da sadə,
dəyişdirilə bilən poçt qutusudur və hər müştəri hər ötürücü ilə işləyir.

## Docker ilə öz serverində

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

Ötürücü konteynerin içində 8787 portunda adi HTTP xidməti göstərir.
**Onun qarşısında əks proksidə TLS-i sonlandırın** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): brauzerlər ötürücüdən yalnız
HTTPS/WSS üzərindən istifadə edəcək. Bunu edəndə, sürət limitinin
real müştəri ünvanına görə açarlanması üçün `docker-compose.yml`-də
`TRUST_PROXY: "true"` təyin edin — və belə proksi olmadan bunu heç vaxt
təyin etməyin, çünki etibar etdiyi başlıq girişə birbaşa çata bilən
hər kəs tərəfindən saxtalaşdırıla bilər.

Məlumat həcminə qarşı dəqiq **bir** konteyner işlədin: sürət məhdudlaşdırıcısı
hər proses üçün yaddaşdadır və hər poçt qutusunun əməliyyatları həmin
prosesin içində ardıcıllaşdırılır, buna görə ikinci replikada bu
xüsusiyyətlərin heç biri olmazdı. Miqyası, tək prosesə daha böyük maşın
verməklə artırın.

### Qeydiyyat: ilkin olaraq bağlıdır

İnternetdən hər kəsin qeydiyyatdan keçə bildiyi öz serverli ötürücü,
rəsmi ötürücünün limitlərinin idarə etmək üçün mövcud olduğu spam/sui-istifadə
iqtisadiyyatını yenidən yaradardı, buna görə **Docker qablaşdırması bağlı
göndərilir**: compose faylı `REGISTRATION_ALLOWLIST` ötürür (boş da ola
bilər) və yalnız siyahıdakı Breeze ID-ləri *hesab yarada* bilər (ilk
prekey yükləməsi). Qeydiyyatın bağlanması ötürücüdə artıq ev sahibi olan
insanlara heç vaxt təsir etmir — onların yükləmələri, depozitləri, görüşləri
və sorğuları qapalı deyil — və qeydiyyatın açılması açıq seçimdir, heç vaxt
ilkin vəziyyət deyil.

- **Sizin Breeze ID-niz** dəvət linkinizdəki 12 simvolluq identifikatorudur
  (onun `pub` dəyərinin ilk 12 simvolu). Dəvət etdiyiniz hər kəsdən
  özünkünü eyni şəkildə soruşun — ID kontaktların onsuz da mübadilə etdiyi
  ictimai identifikatorudur, sirr deyil.
- **İnsanları qəbul etmək** üçün onların ID-lərini sadalayın: qabığınızda
  və ya `docker-compose.yml`-nin yanındakı `.env` faylında
  `BREEZE_ALLOWLIST=id1,id2,…` təyin edin, sonra yenidən `docker compose up -d`
  icra edin.
- **İndi başlayın, sonra qəbul edin**: `BREEZE_ALLOWLIST` təyin edilməyibsə,
  ötürücü hər kəsə bağlı işləyir — açılış jurnalı bunu deyir — və siz ID-lər
  əlavə edənə qədər heç kim qeydiyyatdan keçə bilməz.
- **Açıq ötürücü** (hər kəs qeydiyyatdan keçə bilər): `docker-compose.yml`-də
  `REGISTRATION_OPEN: "1"` sətrinin şərhini götürün. Bunu etsəniz, sui-istifadə
  iqtisadiyyatı sizə məxsusdur.

### İstifadə kvotası: öz ötürücünüzdə söndürün

İşçi **ədalətli istifadə kvotası** aktiv şəkildə göndərilir: hər poçt
qutusu üçün gündə ən çox 10.000 depozit və ayda 200.000 (depozit bir tam
çatdırılma dövrəsidir — siyasət və rəqəmlər üçün `docs/COST_MODEL.md`
§10-a baxın). Bu çərçivə operatorun əks halda hər kəs üçün daşıyacağı
dəyişən xərcləri olan pulsuz giriş kimi işlədilən *ortaq standart
ötürücü* üçün mövcuddur. **Özünüz və insanlarınız üçün işlətdiyiniz
ötürücüdə çərçivənin mənası yoxdur — onu söndürün**:

```bash
USAGE_QUOTA_ENABLED=false
```

Onu ötürücünüzün mühitini oxuduğu yerdə təyin edin (qabıq və ya
`docker-compose.yml`-nin yanındakı `.env`, Node prosesinin mühiti
və ya Cloudflare Pages sirləri). İcma ötürücüsü işlədirsinizsə və
çərçivə *istəyirsinizsə*, iki qonşu düymə var:
`USAGE_QUOTA_DAILY` və `USAGE_QUOTA_MONTHLY` limitləri yenidən tənzimləyir.
Vacib qeydlər:

- Kvota yalnız poçt qutuları Durable Objects-də yaşayanda tətbiq olunur
  (`MAILBOX_BACKEND=do`, bu hostda ilkin vəziyyət); KV arxa planında
  sənədləşdirilmiş təsirsiz əməliyyatdır.
- Limitdən sonra göndərənlər səssiz atılma əvəzinə açıq
  `429 USAGE_QUOTA_EXCEEDED` alır (pəncərə və limiti ilə) — mesaj
  göndərənin göndəriləcəklər qutusunda qalır və qəbul edən P2P üzərindən
  və istənilən digər ev ötürücüsü vasitəsilə əlçatan olaraq qalır.

### Ötürücü şəxsiyyəti

İlk açılışda ötürücü *məlumat həcminin içində* davamlı Ed25519 şəxsiyyət
açarı yaradır və onun barmaq izini jurnalda çap edir:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Barmaq izi *sizin* ötürücünüzü tanıdır: onu istifadəçilərinizə
kanaldan kənar (şəxsən, başqa kanal üzərindən) verin ki, onlara verilən
ötürücünü sizin işlətdiyiniz kimi tanıya bilsinlər. Eyni barmaq izi hər
açılışda çap olunur; nə vaxtsa dəyişsə, məlumat həcmi dəyişdirilib —
istifadəçilərə yenisinə etibar etməyi deməzdən əvvəl araşdırın.

Müştərilər bu açarı avtomatik yoxlayır və bərkidir (mərhələ-2 addım 4):
ilk təmasda müştəri ötürücüyə açarla imzalamaq üçün çağırış göndərir
(`/api/relay/attest`), yoxlanılmış açarı hesabla birlikdə saxlayır və
sonrakı hər sessiyada yenidən yoxlayır. Müştərinin göstərdiyi barmaq izi
(`/security` altında və ilk bərkitmədə bildirişdə) eyni açardan
törədilir — onu yuxarıdakı açılış jurnalı sətri ilə müqayisə edin. Açar
nə vaxtsa dəyişsə, müştərilər **ötürücü ilə danışmağı dayandırır** və
istifadəçini xəbərdar edir; onlar heç vaxt səssiz yenidən bərkitmir.
Barmaq izi dəyişikliyini pozucu hadisə kimi qəbul edin: addım 4-də
tətbiqdaxili «yeni açara etibar et» düyməsi yoxdur, buna görə real həcm
itkisindən sonra istifadəçiləriniz hesabları üçün tətbiqin saxlanılan
məlumatlarını təmizləməli və ilk təmasda yenidən bərkitməlidirlər —
əvvəlcə yeni barmaq izini kanaldan kənar elan edin, yoxsa yeni açarınızı
hücumçunun açarından ayıra bilməzlər.

### Ehtiyat nüsxə və bərpa

**Məlumat həcmi bütün ötürücü vəziyyətidir**: kataloqu, poçt qutularını
və ötürücü şəxsiyyət açarını saxlayan bir SQLite faylı.
Ehtiyat nüsxəsini çıxarmaq üçün başqa heç nə yoxdur.

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

### Yeniləmə

```bash
git pull origin main
docker compose up -d --build
```

Vəziyyət obrazda deyil, həcmdə yaşayır, buna görə yeniləmə istifadəçilərinizin
məlumatlarına heç vaxt toxunmur.

## Çılpaq Node ilə öz serverində (Docker olmadan)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfiqurasiya yalnız mühit dəyişənləridir — `server/README.md`
hamısını sadalayır. Docker yolundan iki fərq:

- **Məlumat faylı** ilkin olaraq `./breeze-relay.db`-dir (`BREEZE_DB_PATH`
  ilə dəyişdirin); ötürücü şəxsiyyəti daxil olmaqla eyni tək fayllı
  vəziyyətdir. Onu eyni şəkildə ehtiyat nüsxələyin: dayandırın, kopyalayın,
  yenidən başladın.
- **Qeydiyyat siz bağlayana qədər açıqdır**: bağlı ilkin vəziyyət
  Docker qablaşdırmasının xüsusiyyətidir. Çılpaq girişi bağlamaq üçün
  `REGISTRATION_ALLOWLIST=id1,id2` (və ya hər kəsə bağlı üçün boş dəyər)
  təyin edin; `REGISTRATION_OPEN=1` açıq şəkildə yenidən açır.

## Cloudflare Yerləşdirməsi

### Minimum Yerləşdirmə (ayda 0 dollar, 5 dəqiqə)

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

**Budur.** Push bildirişləri istisna olmaqla bütün funksiyalar işləyir.
Qeyd edin ki, Cloudflare yerləşdirməsində qeydiyyat özünüz
`REGISTRATION_ALLOWLIST` təyin etməsəniz **açıqdır** (`.env.example`-a
baxın); bağlı ilkin qablaşdırma yuxarıdakı Docker yoludur.

### 0 dollara nə işləyir

| Funksiya | Vəziyyət | Qeydlər |
|---------|--------|-------|
| Ucdan-uca şifrələnmiş çat | ✓ | Tam Double Ratchet |
| P2P mesajlaşma | ✓ | WebRTC DataChannel |
| Səsli/video zənglər | ✓ | WebRTC + pulsuz STUN |
| TURN ötürücüsü | ✓ | Open Relay (ayda 20GB pulsuz) |
| Qruplar (1,000 üzv) | ✓ | Sender Key O(1) |
| Fayl ötürülməsi | ✓ | P2P üzərindən 50MB-a qədər |
| 51 dil | ✓ | İngilis dili daxili + 50 tam lokal faylı, avtomatik aşkarlanır |
| Oflayn/PWA | ✓ | Service Worker |
| Push bildirişləri | ✗ | VAPID açarları lazımdır |

Çoxhesablı ödəniş (Lite/Plus/Pro) mövcud deyil —
[SECURITY.md](../../SECURITY.md)-nin «Removed: multi-account billing» bölməsinə baxın. Hər hesab
plan qapısı olmadan pulsuz limitsiz yerli alt-hesablar alır.

### Pulsuz Plan Limitləri

| Resurs | Pulsuz Plan | Aktiv İstifadəçi Başına İstifadə |
|----------|-----------|----------------------|
| Worker sorğuları | Gündə 100.000 | ~Gündə 500 (sorğu + siqnal) |
| KV oxumaları | Gündə 100.000 | ~Gündə 200 |
| KV yazmaları | Gündə 1.000 | ~Gündə 350 (optimallaşdırılmış) |
| KV yaddaşı | 1 GB | ~İstifadəçi başına 10 KB |
| Statik aktivlər | Limitsiz | ~894 KB (tək HTML) |

**Pulsuz planda ~3 eyni vaxtda aktiv istifadəçini dəstəkləyir.**

### Əlavə Funksiyalar Əlavə Etmək

#### Push Bildirişləri (pulsuz)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN Serveri (məhdudlaşdırıcı şəbəkələr üçün)

TURN zənglərin və yalnız ötürücülü (IP gizlədən) qoşulmaların
məhdudlaşdırıcı NAT-ları keçmə üsuludur. Ötürücünüzün hansı TURN-u
verməsi operator kimi **sizin** seçiminizdir — Worker sıra ilə
bunları sınayır:

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

**Əslində nəyi konfiqurasiya etdiyinizi yoxlayın:** `GET /api/health`
effektiv rejimi `turnProvider` kimi bildirir (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Köhnə `turn` boolean-ı yalnız
`TURN_URL`-i əks etdirir, buna görə tövsiyə olunan A variantı üçün `false`
oxunur — `turnProvider`-dən istifadə edin. Müştərilər eyni provayderi
`/security`-də göstərir, buna görə Open Relay ehtiyatındakı istifadəçi
üçüncü tərəfin onun zəng mediasını ötürdüyünü görə bilər (yalnız
metaməlumatlar — medianın özü DTLS-SRTP ilə şifrələnir).

#### Autentifikasiya Gücləndirməsi və Adi Ötürücü Yolu

Prekey yükləmələri indi imzalama sahibliyini `prekey-owner:<userId>`-də
**TTL olmadan** ayrıca qoruyur. Mövcud paket sahibliyi növbəti yükləmədə,
əvəz qəbul edilməzdən əvvəl tənbəl şəkildə miqrasiya edir. Yeni Ed25519
paketləri də həmin qeydi yaradır. Müddəti bitmiş prekey paketlərini
təmizləyərkən bu qeydləri saxlayın: paketin müddətinin bitməsini gözləmək
yeni sahibə icazə verməməlidir. Dövrə əvvəlki sahib tərəfindən imzalanmış
yükləmə tələb edir və yeni açarı mövcud yükləmə xülasəsində bağlayır.
Autentifikasiya olunmuş `/account/delete` hər iki qeydi silir və paketin
müddəti bitdikdən sonra belə sahibə qarşı autentifikasiya edə bilər.
İtirilmiş sahib açarını sıfırlama yoxdur.

Bu qeydə malik hesablar üçün yükləmə və mesaj/möhürlənmiş sorğu, möhürlənmiş ACK və
poçt qutusu WebSocket sübutları davamlı sahibdən istifadə etməlidir. **İmzasız sorğular
`PREKEY_REQUIRE_AUTH=false` və ya `QUEUE_REQUIRE_AUTH=false` olsa belə rədd edilir.**
Həmin bayraqlar sahibi olmayan hesablar üçün mövcud ilkin dəyərlərini və köhnə
semantikalarını saxlayır; imzasız yükləmə/növbə sorğularının açıq `false` qəbulu
məzmunsuz köhnəlmə xəbərdarlığı yazır. Digər autentifikasiya bayraqları dəyişməzdir.
Poçt qutusu WebSocket-ləri hələ də hər kəs üçün imza tələb edir.

Müştəri növbə fəaliyyətindən əvvəl imzalama başlanğıcını gözləyir, o cümlədən
geri qayıdan hesabın açılışı, lider yüksəlişi və yenidən qoşulma. Ortaq gözləmə
beş saniyə ilə məhduddur. Dəstəklənməyən iş mühitləri dərhal imzasız davam edir;
ilişmiş IDB/açar açılması limitdən sonra imzasız davam edir, sonra hazır olanda imzalayır.
Bu, sorğu dövrəsini canlı saxlayır, **yan keçid deyil**: sahib dəstəkli hesablar
imzalama açarları istifadə oluna bilənə qədər ötürücüdən ala bilməz. Köhnə başlanğıc
yarışından qaçmaq üçün yenilənmiş müştəri aktivlərini Worker ilə birlikdə yerləşdirin.

Miqrasiya sahibi qorunmazdan **əvvəl** müddəti bitmiş paketdən sahibliyi
bərpa edə bilməz. İlk qeydiyyat TOFU olaraq qalır. Sahiblik qeydləri mövcud
KV arxa planından istifadə edir: eyni vaxtda yazmalar və eventual consistency
bu dəyişikliklə xətti hala gətirilmir. Sübutlar mövcud beş dəqiqəlik təzəlik
pəncərəsini və əməliyyat/yük bağlamasını saxlayır; pəncərə daxilində eyni
təkrarlar birdəfəlik nonce protokolu deyil.

Mövcudluq yazmaları və TURN etimadnamə verilməsi artıq ilkin olaraq *qeydiyyatdan
keçmiş* hesab (prekey paketi mövcud) tələb edir və hər müştəri avtomatik
qeydiyyatdan keçir. Mövcudluq ürək döyüntüləri əlavə olaraq Ed25519 sahibliyi
sübutu daşıyır (döyüntü saxladığı sahələri imzalayır), Worker təqdim olunanda
onu yoxlayır — `PRESENCE_SIGN_REQUIRE_AUTH=true` həmin sübutu məcburi edir.
Qalan Ed25519 imza bayraqları seçimli olaraq qalır; `wrangler.toml` hər birini
və səbəbini sənədləşdirir (WebCrypto Ed25519 olmayan iş mühitlərindəki müştərilər
ümumiyyətlə imzalaya bilməz).

Köhnə adi ötürücü (`/api/msg/send`, `/api/msg/poll`) köhnəlib: onun
cavabları `Deprecation: true` başlığı daşıyır və möhürlənmiş yol hər
cari müştəri üçün ilkin marşrutdur. Heç bir canlı müştərinin ehtiyat
yola ehtiyacı olmadığını təsdiqlədikdən sonra onu tamamilə söndürün:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Fərdi Domen

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Pulsuz Plandan Kənara Miqyaslama

Pulsuz planı aşanda (ayda 5 dollarlıq Workers Paid planı):

| Resurs | Ödənişli Plan |
|----------|-----------|
| Worker sorğuları | Ayda 10 milyon |
| KV yazmaları | Ayda 1 milyon |
| KV yaddaşı | 1 GB daxildir |
| CPU vaxtı | Sorğu başına 30 saniyə |

Bu, **minlərlə eyni vaxtda istifadəçini** dəstəkləyir.

### Yeniləmə

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Quraşdırma addımı yoxdur. Quraşdırılacaq asılılıqlar yoxdur. Sadəcə yerləşdirin.
