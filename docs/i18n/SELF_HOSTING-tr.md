# Kendi Kendine Barındırma Kılavuzu

**Başka bir dilde okuyun**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · Türkçe (bu sayfa) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)

> **Başlamadan önce: standart kurulum için bir Cloudflare hesabı gerekir.**
> Bu kılavuzdaki standart kurulum — aşağıdaki Cloudflare
> kurulumu — Cloudflare üzerinde çalışır, bu yüzden başlamadan
> önce bir Cloudflare hesabını hazır edin. Cloudflare kullanmak
> istemiyorsanız, bu kılavuzdaki Docker ve yalın Node kurulumları
> için Cloudflare hesabı gerekmez.

Bir Breeze aktarımını (relay) çalıştırmanın iki yolu vardır:

1. **Kendi kendine barındırma (Node + Docker)** — aktarım kendi makinenizde veya
   VPS'inizde: tek kapsayıcı (container), tek veri birimi (volume), kayıt varsayılan olarak
   kapalı. Aktarım sizin ve insanlarınız içinse buradan başlayın.
2. **Cloudflare** — Cloudflare'ın ücretsiz katmanında resmî tarzda
   kurulum (Breeze'in kendisinin çalıştırdığı aktarım). Bakımını yapacak bir sunucu olmadan
   herkese açık bir aktarım istiyorsanız oradan başlayın.

İkisi de aynı işleyici kodunu çalıştırır; bir aktarım her iki durumda da aptal,
birbirinin yerine geçebilir bir posta kutusudur ve her istemci (client) her
aktarımla çalışır.

## Docker ile Kendi Kendine Barındırma

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

Aktarım, kapsayıcının içinde 8787 numaralı bağlantı noktasında düz HTTP sunar.
**TLS'i, önüne yerleştirdiğiniz bir ters vekil sunucuda (reverse proxy) sonlandırın** (Caddy, nginx,
Traefik, bir Cloudflare Tunnel, …): tarayıcılar bir aktarımı yalnızca
HTTPS/WSS üzerinden kullanır. Bunu yaptığınızda, hız sınırının gerçek istemci
adresini esas alması için `docker-compose.yml` içinde `TRUST_PROXY: "true"` ayarlayın
— ve böyle bir vekil sunucu olmadan asla ayarlamayın, çünkü güvendiği başlık,
girişe doğrudan ulaşabilen herkes tarafından taklit edilebilir.

Veri birimine karşı tam olarak **bir** kapsayıcı çalıştırın: hız
sınırlayıcı, süreç başına bellektedir ve her posta kutusunun işlemleri
o sürecin içinde sıralanır; bu yüzden ikinci bir kopya bu özelliklerin
hiçbirini korumaz. Ölçeklendirmeyi, tek sürece daha büyük bir makine vererek yapın.

### Kayıt: varsayılan olarak kapalı

İnternetteki herkesin kaydolabildiği, kendi kendine barındırılan bir aktarım,
resmî aktarımın sınırlarının denetlemek için var olduğu spam/kötüye kullanım ekonomisini
yeniden yaratırdı; bu yüzden **Docker paketlemesi kapalı gelir**: compose
dosyası bir `REGISTRATION_ALLOWLIST` geçirir (boş da olabilir) ve
yalnızca üzerindeki Breeze ID'leri *hesap oluşturabilir* (ilk prekey
yüklemesi). Kaydı kapatmak, aktarımda zaten yerleşik olan kişileri asla etkilemez
— onların yüklemeleri, emanetleri, buluşmaları (rendezvous) ve sorguları (poll) kapıya
takılmaz — ve kaydı açmak açık bir seçimdir, asla
varsayılan değildir.

- **Breeze ID'niz**, davet bağlantınızdaki 12 karakterlik tanımlayıcıdır
  (onun `pub` değerinin ilk 12 karakteri). Davet ettiğiniz her kişiden de kendisininkini aynı şekilde isteyin
  — ID, kişilerin zaten birbirleriyle paylaştığı herkese açık bir tanımlayıcıdır, sır değildir.
- **Kişileri kabul etmek**, ID'lerini listelemekle olur: shell'inizde veya
  `docker-compose.yml` yanındaki bir `.env` dosyasında `BREEZE_ALLOWLIST=id1,id2,…` ayarlayın,
  sonra yeniden `docker compose up -d` çalıştırın.
- **Şimdi başlatın, sonra kabul edin**: `BREEZE_ALLOWLIST` ayarlanmamışsa, aktarım
  herkes için kapalı çalışır — açılış günlüğü bunu söyler — ve siz ID ekleyene kadar kimse
  kaydolamaz.
- **Açık aktarım** (herkes kaydolabilir): `docker-compose.yml` içinde
  `REGISTRATION_OPEN: "1"` satırının yorumunu kaldırın. Yaparsanız, kötüye kullanım ekonomisi sizindir.

### Kullanım kotası: kendi aktarımınızda kapatın

Worker, **adil kullanım kotası (fair-use)** etkin olarak gelir: posta kutusu başına
günde en çok 10.000 emanet ve ayda 200.000 (bir emanet,
tek bir tam teslim döngüsüdür — ilke ve sayılar için bkz. `docs/COST_MODEL.md` §10). O çerçeve, *paylaşılan varsayılan
aktarım* içindir; o aktarım, değişken maliyetlerini işletmecinin aksi hâlde herkes için
taşımak zorunda kalacağı ücretsiz bir giriş olarak çalıştırılır. **Kendiniz ve insanlarınız için
çalıştırdığınız bir aktarımda çerçeve anlamsızdır — kapatın
**:

```bash
USAGE_QUOTA_ENABLED=false
```

Bunu, aktarımınızın ortamını okuduğu yere ayarlayın (shell veya
`docker-compose.yml` yanındaki `.env`, Node süreç ortamı
veya Cloudflare Pages sırları (secrets)). Bir topluluk aktarımı çalıştırıyorsanız ve *yine de* bir çerçeve
istiyorsanız iki komşu ayar vardır:
`USAGE_QUOTA_DAILY` ve `USAGE_QUOTA_MONTHLY`, sınırları yeniden ayarlar.
Önemli notlar:

- Kota, yalnızca posta kutuları Durable
  Objects içinde yaşadığında uygulanır (`MAILBOX_BACKEND=do`, bu hostta varsayılan); KV
  arka ucunda belgelenmiş bir no-op'tur (etkisizdir).
- Sınırın ötesinde, gönderenler sessiz bir düşürme yerine açık bir `429 USAGE_QUOTA_EXCEEDED`
  alır (penceresi ve sınırıyla birlikte) — mesaj,
  gönderenin giden kutusunda (outbox) kalır ve alıcıya P2P üzerinden ve başka herhangi bir ev aktarımı aracılığıyla
  ulaşılmaya devam edilir.

### Aktarım kimliği

İlk açılışta aktarım, *veri biriminin içinde* kalıcı bir Ed25519 kimlik anahtarı
oluşturur ve parmak izini günlüğe yazar:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Parmak izi *sizin* aktarımınızı tanımlar: kullanıcılarınıza
bant dışı (out-of-band: yüz yüze, başka bir kanaldan) verin ki, kendilerine verilen aktarımı sizin çalıştırdığınız
aktarım olarak tanıyabilsinler. Aynı parmak izi
her açılışta yazılır; bir gün değişirse, veri birimi
değiştirilmiş demektir — kullanıcılara yenisine güvenmelerini söylemeden önce araştırın.

İstemciler bu anahtarı otomatik olarak doğrular ve sabitler (pin) (aşama 2, adım 4): ilk
temasta bir istemci, aktarımı anahtarla imzalamaya çağırır
(`/api/relay/attest`), doğrulanmış anahtarı hesapla birlikte saklar ve
her sonraki oturumda yeniden doğrular. İstemcinin gösterdiği parmak izi
(`/security` altında ve ilk sabitlemedeki bildirimde (toast)) aynı
anahtardan türetilir — yukarıdaki açılış günlüğü satırıyla karşılaştırın. Anahtar
bir gün değişirse, istemciler **aktarımla konuşmayı keser** ve kullanıcıyı uyarır;
asla sessizce yeniden sabitlemezler. Bir parmak izi değişimini
kırıcı bir olay olarak ele alın: 4. adımda uygulama içinde bir "yeni anahtara güven" düğmesi yoktur;
bu yüzden gerçek bir birim kaybından sonra kullanıcılarınızın, hesapları için uygulamanın
saklanmış verilerini temizlemesi ve ilk temasta yeniden sabitlemesi gerekir —
yeni parmak izini önce bant dışı duyurun, yoksa sizin yeni anahtarınızı bir saldırganınkinden ayırt edemezler.

### Yedekleme ve geri yükleme

**Veri birimi, aktarımın tüm durumudur**: dizini, posta kutularını ve aktarım kimlik anahtarını
tutan tek bir SQLite dosyası.
Yedeklenecek başka hiçbir şey yoktur.

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

### Güncelleme

```bash
git pull origin main
docker compose up -d --build
```

Durum birimde yaşar, imajda (image) değil; bu yüzden güncelleme, kullanıcılarınızın
verisine asla dokunmaz.

## Çıplak Node ile Kendi Kendine Barındırma (Docker yok)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Yapılandırma yalnızca ortam değişkenleriyledir — `server/README.md`
hepsini listeler. Docker yolundan iki farkı:

- **Veri dosyası** varsayılan olarak `./breeze-relay.db`'dir (`BREEZE_DB_PATH` ile
  geçersiz kılınabilir); aktarım kimliği dâhil aynı tek dosyalık durumdur.
  Aynı şekilde yedekleyin: durdurun, kopyalayın, yeniden başlatın.
- **Kayıt, siz kapatmadıkça açıktır**: kapalı varsayılan,
  Docker paketlemesinin bir özelliğidir. Çıplak bir girişi kapatmak için
  `REGISTRATION_ALLOWLIST=id1,id2` ayarlayın (veya herkes-için-kapalı için boş bir değer);
  `REGISTRATION_OPEN=1` açıkça yeniden açar.

## Cloudflare Kurulumu

### En küçük kurulum (ayda 0 dolar, 5 dakika)

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

**Hepsi bu.** Push bildirimleri dışında tüm özellikler çalışır. Şunu unutmayın:
bir Cloudflare kurulumunda kayıt, siz kendiniz `REGISTRATION_ALLOWLIST` ayarlamadıkça
**açıktır** (bkz. `.env.example`); varsayılan-kapalı paketleme, yukarıdaki Docker yoludur.

### 0 Dolara Ne Çalışır

| Özellik | Durum | Notlar |
|---------|--------|-------|
| E2E şifreli sohbet | ✓ | Tam Double Ratchet |
| P2P mesajlaşma | ✓ | WebRTC DataChannel |
| Sesli/görüntülü aramalar | ✓ | WebRTC + ücretsiz STUN |
| TURN aktarımı | ✓ | Open Relay (ayda 20 GB ücretsiz) |
| Gruplar (1.000 üye) | ✓ | Sender Key O(1) |
| Dosya aktarımı | ✓ | P2P üzerinden 50 MB'a kadar |
| 51 dil | ✓ | İngilizce yerleşik + 50 tam locale dosyası, otomatik algılanır |
| Çevrimdışı/PWA | ✓ | Service Worker |
| Push bildirimleri | ✗ | VAPID anahtarları gerekir |

Çok katmanlı hesap faturalandırması (Lite/Plus/Pro) kullanılamaz — bkz.
[SECURITY.md](../../SECURITY.md) belgesinin "Removed: multi-account billing" bölümü. Her hesap,
plan kapısı olmadan, ücretsiz ve sınırsız yerel alt hesap alır.

### Ücretsiz Katman Sınırları

| Kaynak | Ücretsiz Katman | Aktif Kullanıcı Başına Kullanım |
|----------|-----------|----------------------|
| Worker istekleri | 100.000/gün | ~500/gün (sorgulama + sinyal) |
| KV okumaları | 100.000/gün | ~200/gün |
| KV yazmaları | 1.000/gün | ~350/gün (iyileştirilmiş) |
| KV depolama | 1 GB | ~10 KB/kullanıcı |
| Statik dosyalar | Sınırsız | ~894 KB (tek HTML) |

**Ücretsiz katmanda ~3 eşzamanlı aktif kullanıcıyı destekler.**

### İsteğe Bağlı Özellikleri Ekleme

#### Push Bildirimleri (ücretsiz)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN Sunucusu (kısıtlayıcı ağlar için)

TURN, aramaların ve yalnızca-aktarımlı (IP gizleyen) bağlantıların
kısıtlayıcı NAT'ları aşma yoludur. Aktarımınızın hangi TURN'ü vereceği, işletmeci olarak **sizin** seçiminizdir
— Worker sırayla dener:

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

**Gerçekte ne yapılandırdığınızı doğrulayın:** `GET /api/health`, etkin
modu `turnProvider` olarak bildirir (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Eski `turn` boolean değeri yalnızca
`TURN_URL`'yi yansıtır; bu yüzden önerilen A Seçeneği için `false` görünür — `turnProvider` kullanın. İstemciler aynı sağlayıcıyı `/security` içinde gösterir; böylece
Open Relay yedeğinde olan bir kullanıcı, üçüncü bir tarafın arama medyasını
aktardığını görebilir (yalnızca meta veriler — medyanın kendisi DTLS-SRTP ile şifrelidir).

#### Kimlik Doğrulama Sertleştirmesi ve Düz Aktarım Yolu

Prekey yüklemeleri artık imza sahipliğini `prekey-owner:<userId>` altında **TTL olmadan** ayrı
olarak korur. Var olan paket (bundle) sahipliği, bir değiştirme kabul edilmeden önce, bir sonraki yüklemede tembelce taşınır. Yeni Ed25519 paketleri de
o kaydı oluşturur. Süresi dolmuş prekey paketlerini budarken bu kayıtları koruyun:
paket süresinin dolmasını beklemek, yeni bir sahibe izin vermemelidir. Döndürme (rotation), önceki sahip tarafından imzalanmış bir yükleme gerektirir ve yeni anahtarı var olan yükleme özetine (digest) bağlar. Kimliği doğrulanmış `/account/delete`, her iki kaydı da siler ve paket süresi dolduktan sonra bile sahibe karşı kimlik doğrulayabilir. Kaybolan sahip anahtarı için sıfırlama yoktur.

Bu kayda sahip hesaplarda yükleme ve mesaj/sealed sorgusu, sealed ACK ve
posta kutusu WebSocket kanıtları, dayanıklı sahibi kullanmalıdır. **İmzasız istekler,
`PREKEY_REQUIRE_AUTH=false` veya `QUEUE_REQUIRE_AUTH=false` olsa bile reddedilir.**
Bu bayraklar, sahibi olmayan hesaplar için var olan varsayılanlarını ve eski anlamlarını korur; imzasız yükleme/kuyruk isteklerinin açık `false` kabulü,
içeriksiz bir kullanım dışı bırakma (deprecation) uyarısı günlüğe yazar. Diğer kimlik doğrulama bayrakları değişmemiştir.
Posta kutusu WebSocket'leri herkes için hâlâ imza ister.

İstemci, kuyruk etkinliğinden önce imza başlatmasını bekler; buna geri dönen hesap açılışı, liderliğe yükselme ve yeniden bağlanma dâhildir. Paylaşılan bekleme
beş saniyeyle sınırlıdır. Desteklenmeyen çalışma zamanları hemen imzasız sürdürür;
takılmış IDB/anahtar açma, sınırdan sonra imzasız sürdürür, sonra hazır olduğunda imzalar.
Bu, sorgu döngüsünü canlı tutar, bir **atlatma değildir**: sahibi olan hesaplar, imza anahtarları kullanılabilir olana kadar aktarımdan alamaz. Eski açılış yarışından kaçınmak için güncellenmiş istemci
dosyalarını Worker ile birlikte kurun.

Taşıma, sahibi korunmadan **önce** süresi dolmuş bir paketten sahipliği geri kazanamaz. İlk kayıt TOFU olarak kalır. Sahiplik kayıtları
var olan KV arka ucunu kullanır: nihai tutarlılık (eventual consistency) ve eşzamanlı yazmalar bu değişiklikle
doğrusallaştırılabilir (linearizable) hâle getirilmez. Kanıtlar, var olan beş dakikalık tazelik
penceresini ve işlem/yük bağlamasını korur; pencere içindeki özdeş yeniden denemeler,
tek kullanımlık bir nonce protokolü değildir.

Varlık (presence) yazmaları ve TURN kimlik bilgisi verilmesi zaten varsayılan olarak *kayıtlı*
bir hesap (prekey paketi mevcut) gerektirir ve her istemci otomatik olarak kaydolur.
Varlık kalp atışları (heartbeat) ayrıca bir Ed25519 sahiplik kanıtı taşır
(atış, sakladığı alanları imzalar) ve Worker, bir kanıt sunulduğunda bunu
doğrular — `PRESENCE_SIGN_REQUIRE_AUTH=true`, o kanıtı
zorunlu kılar. Kalan Ed25519 imza bayrakları opt-in olarak kalır;
`wrangler.toml` her birini ve nedenini belgeler (WebCrypto Ed25519 olmayan çalışma zamanlarındaki istemciler hiç imzalayamaz).

Eski düz aktarım (`/api/msg/send`, `/api/msg/poll`) kullanım dışıdır: yanıtları
bir `Deprecation: true` başlığı taşır ve sealed yol, her güncel istemci için
varsayılan yoldur. Hiçbir canlı istemcinin artık yedeğe ihtiyacı olmadığını doğruladıktan sonra, onu tamamen devre dışı bırakın:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Özel Alan Adı

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Ücretsiz Katmanın Ötesine Ölçeklendirme

Ücretsiz katmanı aştığınızda (ayda 5 dolarlık Workers Paid planı):

| Kaynak | Ücretli Plan |
|----------|-----------|
| Worker istekleri | Ayda 10 milyon |
| KV yazmaları | Ayda 1 milyon |
| KV depolama | 1 GB dâhil |
| CPU süresi | İstek başına 30 saniye |

Bu, **binlerce eşzamanlı kullanıcıyı** destekler.

### Güncelleme

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Derleme adımı yok. Kurulacak bağımlılık yok. Yalnızca kurulum (deploy).
