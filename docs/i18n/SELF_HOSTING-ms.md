# Panduan Pengehosan Sendiri

**Baca dalam bahasa lain**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · Bahasa Melayu (halaman ini) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


> **Sebelum anda bermula: persediaan standard memerlukan akaun Cloudflare.**
> Persediaan standard dalam panduan ini — penggunaan Cloudflare
> di bawah — berjalan pada Cloudflare, jadi sediakan akaun Cloudflare
> sebelum anda bermula. Jika anda tidak mahu menggunakan Cloudflare,
> persediaan Docker dan Node tanpa Docker dalam panduan ini tidak memerlukan
> akaun Cloudflare.

Terdapat dua cara untuk menjalankan geganti Breeze:

1. **Pengehosan sendiri (Node + Docker)** — geganti pada mesin anda sendiri atau
   VPS: satu bekas, satu volum data, pendaftaran ditutup secara
   lalai. Mulakan di sini jika geganti ini untuk anda dan orang-orang anda.
2. **Cloudflare** — penggunaan gaya rasmi pada peringkat
   percuma Cloudflare (geganti yang Breeze sendiri jalankan). Mulakan di sana jika anda mahu
   geganti awam tanpa pelayan untuk diselenggara.

Kedua-duanya menjalankan kod pengendali yang sama; geganti ialah peti mel yang ringkas dan
boleh ditukar ganti dalam apa jua cara, dan setiap klien berfungsi dengan
setiap geganti.

## Pengehosan Sendiri dengan Docker

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

Geganti menyediakan HTTP biasa pada port 8787 di dalam bekas.
**Tamatkan TLS pada proksi songsang di hadapannya** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): pelayar hanya akan menggunakan geganti
melalui HTTPS/WSS. Apabila anda berbuat demikian, tetapkan `TRUST_PROXY: "true"` dalam
`docker-compose.yml` supaya pengehadan kadar dikuncikan pada alamat klien
sebenar — dan jangan sesekali menetapkannya tanpa proksi sedemikian, kerana pengepala
yang dipercayainya boleh dipalsukan oleh sesiapa yang boleh mencapai pintu masuk secara terus.

Jalankan tepat **satu** bekas terhadap volum data: pengehad
kadar berada dalam memori bagi setiap proses dan operasi setiap peti mel
disirikan di dalam proses tersebut, jadi replika kedua tidak akan memegang
kedua-dua sifat itu. Skalakan dengan memberikan proses tunggal itu mesin yang lebih besar.

### Pendaftaran: ditutup secara lalai

Geganti pengehosan sendiri yang sesiapa di internet boleh mendaftar padanya
akan mencipta semula ekonomi spam/penyalahgunaan yang wujudnya had geganti rasmi
untuk mengawal, jadi **pembungkusan Docker dihantar dalam keadaan tertutup**: fail
compose menghantar `REGISTRATION_ALLOWLIST` (mungkin kosong) dan
hanya ID Breeze yang tersenarai di dalamnya boleh *mencipta akaun* (muat naik prakunci
pertama). Menutup pendaftaran tidak pernah menjejaskan orang yang sudah bertempat pada
geganti — muat naik, deposit, pertemuan dan tinjauan mereka tidak
dipagar — dan membuka pendaftaran ialah pilihan yang eksplisit, tidak pernah
lalai.

- **ID Breeze anda** ialah pengecam 12 aksara dalam pautan jemputan
  anda (12 aksara pertama nilai `pub`nya). Minta setiap orang
  yang anda jemput untuk ID mereka dengan cara yang sama — ID ialah pengecam awam
  yang kenalan memang sudah bertukar, bukan rahsia.
- **Benarkan orang** dengan menyenaraikan ID mereka: tetapkan
  `BREEZE_ALLOWLIST=id1,id2,…` dalam shell anda atau fail `.env` di sebelah
  `docker-compose.yml`, kemudian `docker compose up -d` semula.
- **Mula sekarang, benarkan kemudian**: tanpa `BREEZE_ALLOWLIST` ditetapkan, geganti
  berjalan tertutup kepada semua orang — log but menyatakan demikian — dan tiada siapa
  boleh mendaftar sehingga anda menambah ID.
- **Geganti terbuka** (sesiapa boleh mendaftar): nyahkomen
  `REGISTRATION_OPEN: "1"` dalam `docker-compose.yml`. Anda memiliki
  ekonomi penyalahgunaan jika anda berbuat demikian.

### Kuota penggunaan: matikan pada geganti anda sendiri

Worker dihantar dengan **kuota penggunaan guna adil** yang diaktifkan: bagi setiap
peti mel, maksimum 10,000 deposit/hari dan 200,000/bulan (deposit ialah
satu kitaran penghantaran penuh — lihat `docs/COST_MODEL.md` §10 untuk
dasar dan angkanya). Rangka itu wujud untuk *geganti lalai yang dikongsi*,
yang dijalankan sebagai pintu masuk percuma yang kos berubahnya
ditanggung oleh pengendali untuk semua orang jika tidak. **Pada geganti yang anda jalankan
untuk diri sendiri dan orang-orang anda, rangka itu tidak bermakna — lumpuhkan
ia**:

```bash
USAGE_QUOTA_ENABLED=false
```

Tetapkannya di mana sahaja geganti anda membaca persekitarannya (shell atau
`.env` di sebelah `docker-compose.yml`, persekitaran proses Node,
atau rahsia Cloudflare Pages). Dua tombol berdekatan wujud jika anda
menjalankan geganti komuniti dan *memang* mahukan rangka:
`USAGE_QUOTA_DAILY` dan `USAGE_QUOTA_MONTHLY` melaraskan semula had.
Nota yang penting:

- Kuota hanya dikuatkuasakan apabila peti mel berada dalam Durable
  Objects (`MAILBOX_BACKEND=do`, lalai pada hos ini); pada
  backend KV ia adalah no-op yang didokumenkan.
- Melepasi had, pengirim mendapat `429 USAGE_QUOTA_EXCEEDED` yang eksplisit
  (dengan tetingkap dan hadnya) dan bukannya digugurkan secara senyap — mesej
  kekal dalam peti keluar pengirim, dan penerima kekal
  boleh dicapai melalui P2P dan melalui mana-mana geganti rumah yang lain.

### Identiti geganti

Pada but pertama, geganti menjana kunci identiti Ed25519 yang berterusan
*di dalam volum data* dan mencetak cap jarinya dalam log:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Cap jari mengenal pasti geganti *anda*: berikan kepada pengguna anda
di luar jalur (secara peribadi, melalui saluran lain) supaya mereka dapat mengenali
geganti yang diserahkan kepada mereka sebagai yang anda jalankan. Cap jari yang sama
dicetak pada setiap but; jika ia berubah, volum data telah
diganti — siasat sebelum memberitahu pengguna untuk mempercayai yang baharu.

Klien mengesahkan dan menyemat kunci ini secara automatik (peringkat-2 langkah 4): pada
hubungan pertama, klien mencabar geganti untuk menandatangani dengan kunci
(`/api/relay/attest`), menyimpan kunci yang disahkan bersama akaun, dan
mengesahkan semula pada setiap sesi kemudian. Cap jari yang ditunjukkan oleh klien
(di bawah `/security`, dan dalam toast pada sematan pertama) diterbitkan daripada
kunci yang sama — bandingkannya dengan baris log but di atas. Jika kunci
berubah, klien **berhenti bercakap dengan geganti** dan memberi amaran kepada
pengguna; mereka tidak pernah menyemat semula secara senyap. Anggap perubahan cap jari sebagai
peristiwa yang memecahkan: tiada butang "percayai kunci baharu" dalam aplikasi dalam
langkah 4, jadi selepas kehilangan volum yang sebenar, pengguna anda mesti mengosongkan
data tersimpan aplikasi untuk akaun mereka dan menyemat semula pada hubungan pertama —
umumkan cap jari baharu di luar jalur terlebih dahulu, atau mereka tidak dapat membezakan
kunci baharu anda daripada kunci penyerang.

### Sandaran & pemulihan

**Volum data ialah keseluruhan keadaan geganti**: satu fail SQLite
yang memegang direktori, peti mel, dan kunci identiti geganti.
Tiada apa-apa lagi untuk disandarkan.

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

### Mengemas kini

```bash
git pull origin main
docker compose up -d --build
```

Keadaan berada dalam volum, bukan imej, jadi pengemaskinian tidak pernah menyentuh
data pengguna anda.

## Pengehosan Sendiri dengan Node Mentah (tanpa Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfigurasi ialah pemboleh ubah persekitaran sahaja — `server/README.md`
menyenaraikan kesemuanya. Dua perbezaan daripada laluan Docker:

- **Fail data** lalainya ialah `./breeze-relay.db` (ganti dengan
  `BREEZE_DB_PATH`); ia adalah keadaan satu fail yang sama, identiti geganti
  termasuk. Sandarkannya dengan cara yang sama: berhenti, salin, mulakan semula.
- **Pendaftaran terbuka melainkan anda menutupnya**: lalai tertutup
  ialah sifat pembungkusan Docker. Untuk menutup pintu masuk mentah, tetapkan
  `REGISTRATION_ALLOWLIST=id1,id2` (atau nilai kosong untuk
  tertutup-kepada-semua); `REGISTRATION_OPEN=1` membukanya semula secara eksplisit.

## Penggunaan Cloudflare

### Penggunaan Minimum ($0/bulan, 5 minit)

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

**Itu sahaja.** Semua ciri berfungsi kecuali pemberitahuan tolak. Perhatikan
bahawa pendaftaran pada penggunaan Cloudflare adalah **terbuka** melainkan anda
menetapkan `REGISTRATION_ALLOWLIST` sendiri (lihat `.env.example`); pembungkusan
tertutup-secara-lalai ialah laluan Docker di atas.

### Apa yang Berfungsi pada $0

| Ciri | Status | Nota |
|---------|--------|-------|
| Sembang E2E terenkripsi | ✓ | Double Ratchet penuh |
| Pemesejan P2P | ✓ | WebRTC DataChannel |
| Panggilan suara/video | ✓ | WebRTC + STUN percuma |
| Geganti TURN | ✓ | Open Relay (20GB/bulan percuma) |
| Kumpulan (1,000 ahli) | ✓ | Sender Key O(1) |
| Pemindahan fail | ✓ | Sehingga 50MB melalui P2P |
| 51 bahasa | ✓ | Bahasa Inggeris terbina dalam + 50 fail lokal penuh, dikesan automatik |
| Luar talian/PWA | ✓ | Service Worker |
| Pemberitahuan tolak | ✗ | Memerlukan kunci VAPID |

Pengebilan berbilang akaun (Lite/Plus/Pro) tidak tersedia — lihat
bahagian "Removed: multi-account billing" dalam [SECURITY.md](../../SECURITY.md). Setiap akaun mendapat
sub-akaun tempatan tanpa had secara percuma tanpa pagar pelan.

### Had Peringkat Percuma

| Sumber | Peringkat Percuma | Penggunaan bagi setiap Pengguna Aktif |
|----------|-----------|----------------------|
| Permintaan Worker | 100,000/hari | ~500/hari (tinjauan + pensyaratan) |
| Bacaan KV | 100,000/hari | ~200/hari |
| Tulisan KV | 1,000/hari | ~350/hari (dioptimumkan) |
| Penyimpanan KV | 1 GB | ~10 KB/pengguna |
| Aset statik | Tanpa had | ~894 KB (HTML tunggal) |

**Menyokong ~3 pengguna aktif serentak pada peringkat percuma.**

### Menambah Ciri Pilihan

#### Pemberitahuan Tolak (percuma)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Pelayan TURN (untuk rangkaian yang ketat)

TURN ialah cara panggilan dan sambungan geganti-sahaja (penyembunyian IP) merentasi
NAT yang ketat. TURN mana yang diserahkan oleh geganti anda ialah pilihan **anda**
sebagai pengendali — Worker mencuba, mengikut urutan:

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

**Sahkan apa yang sebenarnya anda konfigurasikan:** `GET /api/health` melaporkan
mod berkesan sebagai `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Boolean `turn` yang lebih lama hanya mencerminkan
`TURN_URL`, jadi ia membaca `false` untuk Pilihan A yang disyorkan — gunakan
`turnProvider`. Klien menunjukkan pembekal yang sama dalam `/security`, jadi
pengguna pada sandaran Open Relay boleh melihat bahawa pihak ketiga menggeganti
media panggilan mereka (metadata sahaja — media itu sendiri dienkripsi DTLS-SRTP).

#### Pengerasan Pengesahan & Laluan Geganti Biasa

Muat naik prakunci kini mengekalkan pemilikan penandatanganan secara berasingan di
`prekey-owner:<userId>` **tanpa TTL**. Pemilikan bundel sedia ada berhijrah secara malas
pada muat naik seterusnya, sebelum pengganti diterima. Bundel Ed25519 baharu juga
mewujudkan rekod tersebut. Kekalkan rekod ini semasa memangkas bundel prakunci yang telah luput:
menunggu luput bundel tidak boleh membenarkan pemilik baharu. Putaran memerlukan
muat naik yang ditandatangani oleh pemilik sebelumnya, mengikat kunci baharu dalam digest muat naik
sedia ada. `/account/delete` yang disahkan memadam kedua-dua rekod dan boleh mengesahkan
terhadap pemilik walaupun selepas bundel luput. Tiada tetapan semula kunci-pemilik-yang-hilang.

Bagi akaun dengan rekod ini, muat naik dan tinjauan mesej/sealed, ACK sealed dan
bukti WebSocket peti mel mesti menggunakan pemilik yang tahan lama. **Permintaan tanpa tandatangan
ditolak walaupun dengan `PREKEY_REQUIRE_AUTH=false` atau `QUEUE_REQUIRE_AUTH=false`.**
Bendera tersebut mengekalkan lalai sedia ada dan semantik legasi mereka untuk akaun
tanpa pemilik; penerimaan eksplisit `false` bagi permintaan muat naik/baris gilir tanpa tandatangan
melog amaran susut nilai tanpa kandungan. Bendera pengesahan lain tidak berubah.
WebSocket peti mel masih memerlukan tandatangan untuk semua orang.

Klien menunggu permulaan penandatanganan sebelum aktiviti baris gilir, termasuk
but akaun-kembali, kenaikan ketua dan sambung semula. Penungguan berkongsi
dihadkan pada lima saat. Runtime yang tidak disokong meneruskan tanpa tandatangan dengan segera;
IDB/buka-balutan-kunci yang tersekat meneruskan tanpa tandatangan selepas had, kemudian menandatangani apabila sedia.
Ini mengekalkan gelung tinjauan hidup, **bukan** pintasan: akaun yang disokong pemilik tidak boleh
menerima daripada geganti sehingga kunci penandatanganan mereka boleh digunakan. Gunakan aset klien yang dikemas kini
bersama Worker untuk mengelakkan perlumbaan permulaan lama.

Penghijrahan tidak boleh memulihkan pemilikan daripada bundel yang luput **sebelum**
pemiliknya dikekalkan. Pendaftaran pertama kekal TOFU. Rekod pemilikan menggunakan
backend KV sedia ada: ketekalan akhirnya dan tulisan serentak tidak dijadikan
boleh dilinearkan oleh perubahan ini. Bukti mengekalkan tetingkap kesegaran lima minit
sedia ada dan pengikatan operasi/muatan; percubaan semula dalam tetingkap yang sama bukan
protokol nonce sekali guna.

Tulisan kehadiran dan pengeluaran kelayakan TURN sudah memerlukan akaun *berdaftar*
(bundel prakunci hadir) secara lalai, dan setiap klien mendaftar
secara automatik. Degupan jantung kehadiran juga membawa bukti pemilikan Ed25519
(degupan menandatangani medan yang disimpannya), yang disahkan oleh Worker
apabila sahaja ia dikemukakan — `PRESENCE_SIGN_REQUIRE_AUTH=true` menjadikan
bukti itu wajib. Bendera tandatangan Ed25519 yang selebihnya kekal ikut serta;
`wrangler.toml` mendokumenkan setiap satu dan sebabnya (klien pada runtime tanpa
WebCrypto Ed25519 tidak boleh menandatangani langsung).

Geganti biasa legasi (`/api/msg/send`, `/api/msg/poll`) telah disusutnilaikan: responsnya
membawa pengepala `Deprecation: true`, dan laluan sealed ialah
laluan lalai untuk setiap klien semasa. Sebaik sahaja anda mengesahkan tiada klien hidup
yang masih memerlukan sandaran, lumpuhkannya terus:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Domain Tersuai

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Melangkaui Peringkat Percuma

Apabila anda melangkaui peringkat percuma (pelan Workers Paid $5/bulan):

| Sumber | Pelan Berbayar |
|----------|-----------|
| Permintaan Worker | 10 juta/bulan |
| Tulisan KV | 1 juta/bulan |
| Penyimpanan KV | 1 GB disertakan |
| Masa CPU | 30 saat/permintaan |

Ini menyokong **ribuan pengguna serentak**.

### Mengemas kini

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Tiada langkah binaan. Tiada kebergantungan untuk dipasang. Hanya gunakan.
