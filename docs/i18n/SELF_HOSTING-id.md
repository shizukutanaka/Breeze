# Panduan Hosting Mandiri

**Baca dalam bahasa lain / Read in another language**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · Bahasa Indonesia (halaman ini) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Ada dua cara untuk menjalankan relay Breeze:

1. **Hosting mandiri (Node + Docker)** — relay di mesin Anda sendiri atau
   VPS: satu kontainer, satu volume data, pendaftaran secara bawaan tertutup.
   Mulailah di sini jika relay ini untuk Anda dan orang-orang Anda.
2. **Cloudflare** — penerapan bergaya resmi di tingkat gratis Cloudflare
   (relay yang dijalankan Breeze sendiri). Mulailah di sana jika Anda menginginkan
   relay publik tanpa server yang harus dipelihara.

Keduanya menjalankan kode penangan yang identik; bagaimanapun juga, sebuah relay adalah kotak surat yang sederhana dan
dapat saling dipertukarkan, dan setiap klien bekerja dengan setiap relay.

## Hosting Mandiri dengan Docker

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

Relay menyajikan HTTP biasa pada port 8787 di dalam kontainer.
**Akhiri TLS pada proxy terbalik di depannya** (Caddy, nginx,
Traefik, sebuah Cloudflare Tunnel, …): browser hanya akan menggunakan relay
melalui HTTPS/WSS. Ketika Anda melakukannya, tetapkan `TRUST_PROXY: "true"` dalam
`docker-compose.yml` agar pembatasan kecepatan berdasarkan alamat klien yang sebenarnya
— dan jangan pernah menetapkannya tanpa proxy semacam itu, karena header yang
dipercayainya dapat dipalsukan oleh siapa pun yang dapat mencapai pintu masuk secara langsung.

Jalankan tepat **satu** kontainer terhadap volume data: pembatas
kecepatan berada dalam memori per proses dan operasi setiap kotak surat
disusun secara serial di dalam proses itu, jadi replika kedua tidak akan memiliki
kedua sifat tersebut. Lakukan penskalaan dengan memberikan mesin yang lebih besar kepada satu proses itu.

### Pendaftaran: tertutup secara bawaan

Sebuah relay hosting mandiri yang dapat didaftari oleh siapa pun di internet
akan menciptakan kembali ekonomi spam/penyalahgunaan yang keberadaan batas relay resmi
dimaksudkan untuk mengendalikannya, jadi **kemasan Docker dikirim dalam keadaan tertutup**: file
compose meneruskan sebuah `REGISTRATION_ALLOWLIST` (mungkin kosong) dan
hanya ID Breeze yang ada di dalamnya yang dapat *membuat akun* (unggahan prekey
pertama). Menutup pendaftaran tidak pernah memengaruhi orang yang sudah bermukim di
relay — unggahan, setoran, pertemuan, dan polling mereka tidak
dibatasi — dan membuka pendaftaran adalah pilihan yang eksplisit, tidak pernah
bawaan.

- **ID Breeze Anda** adalah pengenal 12 karakter dalam tautan undangan Anda
  (12 karakter pertama dari nilai `pub`-nya). Mintalah hal yang sama kepada setiap orang yang Anda undang
  — ID adalah pengenal publik yang sudah dipertukarkan oleh kontak,
  bukan rahasia.
- **Terima orang** dengan mencantumkan ID mereka: tetapkan
  `BREEZE_ALLOWLIST=id1,id2,…` di shell Anda atau file `.env` di samping
  `docker-compose.yml`, lalu jalankan `docker compose up -d` lagi.
- **Mulai sekarang, terima nanti**: tanpa `BREEZE_ALLOWLIST` yang ditetapkan, relay
  berjalan tertutup untuk semua orang — log boot menyatakannya — dan tidak ada yang
  dapat mendaftar sampai Anda menambahkan ID.
- **Relay terbuka** (siapa pun dapat mendaftar): batalkan komentar
  `REGISTRATION_OPEN: "1"` dalam `docker-compose.yml`. Ekonomi penyalahgunaan menjadi milik Anda jika Anda melakukannya.

### Kuota penggunaan: matikan pada relay Anda sendiri

Worker dikirim dengan **kuota penggunaan wajar** yang diaktifkan: per
kotak surat, maksimal 10.000 setoran/hari dan 200.000/bulan (satu setoran adalah
satu siklus pengiriman penuh — lihat `docs/COST_MODEL.md` §10 untuk
kebijakan dan angkanya). Kerangka itu ada untuk *relay bawaan bersama*,
yang dijalankan sebagai pintu masuk gratis yang biaya variabelnya
jika tidak akan ditanggung oleh operator untuk semua orang. **Pada relay yang Anda jalankan
untuk diri sendiri dan orang-orang Anda, kerangka itu tidak ada gunanya — nonaktifkan
itu**:

```bash
USAGE_QUOTA_ENABLED=false
```

Tetapkan itu di mana pun relay Anda membaca lingkungannya (shell atau
`.env` di samping `docker-compose.yml`, lingkungan proses Node,
atau rahasia Cloudflare Pages). Dua kenop tetangga ada jika Anda
menjalankan relay komunitas dan *memang* menginginkan sebuah kerangka:
`USAGE_QUOTA_DAILY` dan `USAGE_QUOTA_MONTHLY` menyetel ulang batasnya.
Catatan yang penting:

- Kuota hanya diberlakukan ketika kotak surat berada dalam Durable
  Objects (`MAILBOX_BACKEND=do`, bawaan pada host ini); pada backend
  KV, ini adalah no-op yang terdokumentasi.
- Melewati batas, pengirim mendapatkan `429 USAGE_QUOTA_EXCEEDED` yang eksplisit
  (dengan jendela dan batasnya) alih-alih dibuang secara diam-diam — pesan
  tetap berada di kotak keluar pengirim, dan penerima tetap
  dapat dijangkau melalui P2P dan melalui relay rumah lainnya.

### Identitas relay

Pada boot pertama, relay menghasilkan kunci identitas Ed25519 yang persisten
*di dalam volume data* dan mencetak sidik jarinya di log:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Sidik jari mengidentifikasi relay *Anda*: berikan kepada pengguna Anda
di luar jalur (secara langsung, melalui saluran lain) agar mereka dapat mengenali
relay yang diberikan kepada mereka sebagai relay yang Anda jalankan. Sidik jari yang sama
tercetak pada setiap boot; jika itu berubah, volume data telah
diganti — selidiki sebelum memberi tahu pengguna untuk mempercayai yang baru.

Klien memverifikasi dan menyematkan kunci ini secara otomatis (tahap-2 langkah 4): pada
kontak pertama, sebuah klien menantang relay untuk menandatangani dengan kunci tersebut
(`/api/relay/attest`), menyimpan kunci yang terverifikasi bersama akun, dan
memverifikasi ulang pada setiap sesi berikutnya. Sidik jari yang ditampilkan klien
(di bawah `/security`, dan dalam toast pada penyematan pertama) diturunkan dari
kunci yang sama — bandingkan dengan baris log boot di atas. Jika kunci
berubah, klien **berhenti berbicara dengan relay** dan memperingatkan
pengguna; mereka tidak pernah menyematkan ulang secara diam-diam. Perlakukan perubahan sidik jari sebagai
peristiwa yang merusak: tidak ada tombol "percayai kunci baru" dalam aplikasi pada
langkah 4, jadi setelah kehilangan volume yang sesungguhnya, pengguna Anda harus menghapus
data tersimpan aplikasi untuk akun mereka dan menyematkan ulang pada kontak pertama —
umumkan sidik jari baru di luar jalur terlebih dahulu, atau mereka tidak dapat membedakan
kunci baru Anda dari kunci penyerang.

### Cadangan & pemulihan

**Volume data adalah keseluruhan status relay**: satu file SQLite
yang memuat direktori, kotak surat, dan kunci identitas relay.
Tidak ada lagi yang perlu dicadangkan.

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

### Memperbarui

```bash
git pull origin main
docker compose up -d --build
```

Status berada di volume, bukan di image, jadi memperbarui tidak pernah menyentuh
data pengguna Anda.

## Hosting Mandiri dengan Node Murni (tanpa Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfigurasi hanya berupa variabel lingkungan — `server/README.md`
mencantumkan semuanya. Dua perbedaan dari jalur Docker:

- **File data** secara bawaan adalah `./breeze-relay.db` (timpa dengan
  `BREEZE_DB_PATH`); ini adalah status satu file yang sama, termasuk identitas relay.
  Cadangkan dengan cara yang sama: berhenti, salin, mulai ulang.
- **Pendaftaran terbuka kecuali Anda menutupnya**: bawaan tertutup
  adalah sifat dari kemasan Docker. Untuk menutup entri murni, tetapkan
  `REGISTRATION_ALLOWLIST=id1,id2` (atau nilai kosong untuk
  tertutup-untuk-semua-orang); `REGISTRATION_OPEN=1` membukanya kembali secara eksplisit.

## Penerapan Cloudflare

### Penerapan Minimum ($0/bulan, 5 menit)

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

**Selesai.** Semua fitur berfungsi kecuali notifikasi push. Perhatikan
bahwa pendaftaran pada penerapan Cloudflare **terbuka** kecuali Anda
menetapkan `REGISTRATION_ALLOWLIST` sendiri (lihat `.env.example`); kemasan
tertutup-secara-bawaan adalah jalur Docker di atas.

### Apa yang Berfungsi pada $0

| Fitur | Status | Catatan |
|---------|--------|-------|
| Obrolan terenkripsi E2E | ✓ | Double Ratchet penuh |
| Pesan P2P | ✓ | WebRTC DataChannel |
| Panggilan suara/video | ✓ | WebRTC + STUN gratis |
| Relay TURN | ✓ | Open Relay (20GB/bulan gratis) |
| Grup (1.000 anggota) | ✓ | Sender Key O(1) |
| Transfer file | ✓ | Hingga 50MB melalui P2P |
| 51 bahasa | ✓ | Bahasa Inggris bawaan + 50 file lokal penuh, terdeteksi otomatis |
| Offline/PWA | ✓ | Service Worker |
| Notifikasi push | ✗ | Membutuhkan kunci VAPID |

Penagihan multi-akun (Lite/Plus/Pro) tidak tersedia — lihat bagian "Removed: multi-account billing" di [SECURITY.md](../../SECURITY.md). Setiap akun mendapatkan sub-akun lokal tanpa batas secara gratis tanpa pembatasan paket apa pun.

### Batas Tingkat Gratis

| Sumber Daya | Tingkat Gratis | Penggunaan per Pengguna Aktif |
|----------|-----------|----------------------|
| Permintaan Worker | 100.000/hari | ~500/hari (polling + pensinyalan) |
| Pembacaan KV | 100.000/hari | ~200/hari |
| Penulisan KV | 1.000/hari | ~350/hari (dioptimalkan) |
| Penyimpanan KV | 1 GB | ~10 KB/pengguna |
| Aset statis | Tanpa batas | ~894 KB (HTML tunggal) |

**Mendukung ~3 pengguna aktif bersamaan pada tingkat gratis.**

### Menambahkan Fitur Opsional

#### Notifikasi Push (gratis)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Server TURN (untuk jaringan yang ketat)

TURN adalah cara panggilan dan koneksi relay-saja (penyembunyian IP)
melewati NAT yang ketat. TURN mana yang dibagikan relay Anda adalah pilihan **Anda** sebagai
operator — Worker mencoba, secara berurutan:

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

**Verifikasi apa yang sebenarnya Anda konfigurasi:** `GET /api/health` melaporkan
mode efektif sebagai `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Boolean `turn` yang lama hanya mencerminkan
`TURN_URL`, jadi itu terbaca `false` untuk Opsi A yang direkomendasikan — gunakan
`turnProvider`. Klien menampilkan penyedia yang sama di `/security`, jadi
pengguna pada fallback Open Relay dapat melihat bahwa pihak ketiga merelay
media panggilan mereka (hanya metadata — media itu sendiri terenkripsi DTLS-SRTP).

#### Pengerasan Autentikasi & Jalur Relay Biasa

Unggahan prekey kini menyimpan kepemilikan penandatanganan secara terpisah di
`prekey-owner:<userId>` **tanpa TTL**. Kepemilikan bundel yang ada bermigrasi secara malas
pada unggahan berikutnya, sebelum pengganti diterima. Bundel Ed25519 baru juga
menetapkan catatan tersebut. Pertahankan catatan ini saat memangkas bundel prekey yang kedaluwarsa:
menunggu kedaluwarsa bundel tidak boleh mengizinkan pemilik baru. Rotasi memerlukan
unggahan yang ditandatangani oleh pemilik sebelumnya, yang mengikat kunci baru dalam intisari unggahan yang ada.
`/account/delete` yang terautentikasi menghapus kedua catatan dan dapat mengautentikasi
terhadap pemilik bahkan setelah bundel kedaluwarsa. Tidak ada pengaturan ulang kunci-pemilik-yang-hilang.

Untuk akun dengan catatan ini, unggahan dan polling pesan/tersegel, ACK tersegel, dan
bukti WebSocket kotak surat harus menggunakan pemilik yang tahan lama. **Permintaan tanpa tanda tangan ditolak bahkan dengan `PREKEY_REQUIRE_AUTH=false` atau `QUEUE_REQUIRE_AUTH=false`.**
Bendera-bendera tersebut mempertahankan bawaan dan semantik lamanya untuk akun
tanpa pemilik; penerimaan `false` yang eksplisit terhadap permintaan unggahan/antrean tanpa tanda tangan
mencatat peringatan penghentian tanpa isi. Bendera autentikasi lain tidak berubah.
WebSocket kotak surat tetap memerlukan tanda tangan untuk semua orang.

Klien menunggu inisialisasi penandatanganan sebelum aktivitas antrean, termasuk
boot akun yang kembali, promosi pemimpin, dan penyambungan ulang. Penantian bersama
dibatasi pada lima detik. Runtime yang tidak didukung melanjutkan tanpa tanda tangan dengan segera;
IDB/pembukaan kunci yang macet melanjutkan tanpa tanda tangan setelah batas, lalu menandatangani ketika siap.
Ini menjaga loop polling tetap hidup, **bukan** jalan pintas: akun yang didukung pemilik tidak dapat
menerima dari relay sampai kunci penandatanganan mereka dapat digunakan. Terapkan aset klien yang diperbarui
bersamaan dengan Worker untuk menghindari perlombaan startup yang lama.

Migrasi tidak dapat memulihkan kepemilikan dari bundel yang kedaluwarsa **sebelum**
pemiliknya disimpan. Pendaftaran pertama tetap TOFU. Catatan kepemilikan menggunakan
backend KV yang ada: konsistensi akhirnya dan penulisan bersamaan tidak dibuat
dapat dilinearisasi oleh perubahan ini. Bukti mempertahankan jendela kesegaran lima menit yang ada
dan pengikatan operasi/payload; percobaan ulang yang identik di dalam jendela bukanlah
protokol nonce satu kali.

Penulisan kehadiran dan penerbitan kredensial TURN sudah memerlukan akun *terdaftar*
(bundel prekey ada) secara bawaan, dan setiap klien mendaftar
secara otomatis. Detak jantung kehadiran juga membawa bukti kepemilikan Ed25519
(detak menandatangani bidang yang disimpannya), yang diverifikasi Worker
setiap kali bukti disajikan — `PRESENCE_SIGN_REQUIRE_AUTH=true` membuat
bukti itu wajib. Bendera tanda tangan Ed25519 yang tersisa tetap bersifat opt-in;
`wrangler.toml` mendokumentasikan masing-masing dan alasannya (klien pada runtime tanpa
WebCrypto Ed25519 tidak dapat menandatangani sama sekali).

Relay biasa lama (`/api/msg/send`, `/api/msg/poll`) sudah tidak digunakan lagi: responsnya membawa header `Deprecation: true`, dan jalur tersegel adalah
rute bawaan untuk setiap klien saat ini. Setelah Anda memastikan tidak ada klien aktif
yang masih memerlukan fallback, nonaktifkan sepenuhnya:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Domain Khusus

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Penskalaan Melampaui Tingkat Gratis

Ketika Anda melampaui tingkat gratis (paket Workers Paid $5/bulan):

| Sumber Daya | Paket Berbayar |
|----------|-----------|
| Permintaan Worker | 10 juta/bulan |
| Penulisan KV | 1 juta/bulan |
| Penyimpanan KV | 1 GB termasuk |
| Waktu CPU | 30 detik/permintaan |

Ini mendukung **ribuan pengguna bersamaan**.

### Memperbarui

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Tidak ada langkah build. Tidak ada dependensi yang harus diinstal. Cukup terapkan.
