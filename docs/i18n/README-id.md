# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Baca dalam bahasa lain**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · Bahasa Indonesia (halaman ini) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Aplikasi pesan terenkripsi yang tidak memerlukan nomor telepon maupun pendaftaran.**
Isi percakapan hanya dapat dibaca oleh pengirim dan penerima. Bahkan server yang membawanya di tengah jalan pun tidak dapat membacanya.
Semua fitur gratis, dan tidak ada iklan.

Ini bukan halaman web — ini adalah perangkat lunak yang diinstal dan digunakan (Windows / Mac / Linux / Android / iPhone / browser).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## Untuk menggunakannya, hostinglah di server Anda sendiri

Breeze tidak memiliki "server perusahaan". **Untuk menggunakannya, Anda sendiri menyiapkan tempat hosting (server) dan menempatkan Breeze di sana. Inilah cara resmi untuk menggunakannya.**

- Tingkat gratis sudah cukup. Aplikasi ini berjalan pada tingkat gratis Cloudflare, dan tidak memerlukan kartu kredit. Langkah-langkahnya ada di [panduan pemasangan](SELF_HOSTING-id.md) (bahasa lain dapat dipilih dari bagian atas panduan).
- Ambil aplikasinya (Windows / Mac / Linux / Android / iPhone) dari [halaman unduhan](https://github.com/shizukutanaka/Breeze/releases/latest), lalu hubungkan ke server Anda sendiri untuk menggunakannya.
- **Tentang host demo (catatan yang jujur)**: Sebuah demo (https://breeze-469.pages.dev/) tersedia untuk dicoba. Perangkat lunaknya sama, tetapi untuk penggunaan sebenarnya silakan gunakan server Anda sendiri. Demo dapat berubah atau berhenti tanpa pemberitahuan. Breeze yang dihosting di server Anda sendiri tidak terpengaruh oleh penghentian demo.

Untuk petunjuk penggunaan yang terperinci, lihat [manual](MANUAL-id.md) (bahasa lain dapat dipilih dari bagian atas manual).

## Cara menggunakan (3 langkah)

1. Buka Breeze yang dihosting di server Anda sendiri (atau alamat yang diberikan oleh seseorang yang menghostingnya kepada Anda), dan masukkan nama Anda. Hanya itu — Anda siap (tanpa pendaftaran, tanpa nomor telepon). Pada saat ini, sebuah "kunci" dibuat di dalam perangkat Anda, dan kunci itu menjadi identitas Anda.
2. Berikan ID atau kode QR Anda kepada orang yang ingin Anda ajak bicara.
3. Jika orang lain juga membuka aplikasinya, Anda dapat terhubung langsung dan berbicara. Ketika mereka tidak membukanya, pesan Anda ditempatkan dalam keadaan terenkripsi di sebuah "kotak surat" dan dikirimkan ketika mereka membukanya. Server yang membawa kotak surat tidak dapat membaca isinya. Surat yang tidak pernah terkirim akan otomatis terhapus setelah maksimal 7 hari.

## Janji (hal yang tidak kami lakukan)

- **Tidak ada iklan.** Tidak ada di mana pun di dalam aplikasi, tidak ada di mana pun.
- **Tidak ada pelacakan.** Tidak ada analitik penggunaan, tidak ada mekanisme periklanan, tidak ada penjualan data.
- **Pembuatnya tidak memegang data pengguna apa pun.** Di sisi server, daftar akun itu sendiri tidak ada. Identitas Anda hanyalah kunci di dalam perangkat Anda.
- **Percakapan dienkripsi antar perangkat.** Server hanya menangani amplop yang tidak dapat dibacanya.

Kami juga menuliskan cakupannya dengan jujur. Untuk pengiriman, ada penyimpanan jangka pendek di server (amplop yang belum terkirim maksimal 7 hari, sinyal koneksi 5 menit, catatan alamat dan perangkat 90 hari, informasi grup dan langganan notifikasi 30 hari. Semuanya terhapus secara otomatis, dan isinya tidak dapat dibaca). Cadangan cloud secara bawaan dinonaktifkan. Jika Anda menghostingnya di server Anda sendiri, penyimpanan itu pun berada di bawah kendali Anda sendiri.

## Apa yang dapat Anda lakukan

- Percakapan satu lawan satu dan percakapan grup (maksimal 1.000 orang)
- Panggilan suara dan panggilan video (panggilan grup maksimal 8 orang)
- Mengirim file (maksimal 50MB untuk satu lawan satu. Dapat juga dikirim dalam grup, tetapi batas ukurannya lebih kecil)
- Menggunakan banyak perangkat dan banyak akun (misalnya untuk pekerjaan dan pribadi. Jumlah perangkat dan akun gratis dan tidak terbatas)
- 51 bahasa (Inggris ditambah 50 file bahasa), dipilih secara otomatis sesuai bahasa perangkat Anda
- Profil dengan foto, stiker, berbagi lokasi
- Perintah seperti `/help` (71 jenis)
- Mode daya yang disesuaikan dengan baterai Anda (otomatis / normal / hemat daya / darurat). Saat baterai berkurang, pemeriksaan pengiriman diberi jarak agar baterai lebih tahan lama. Sebuah pengaman untuk bencana dan keadaan lain ketika Anda tidak dapat mengisi daya
- Layar yang mudah dibaca (memperhatikan kontras warna, ukuran teks, dan pengoperasian hanya dengan keyboard)

## Perbedaannya dengan aplikasi pesan lain

| | Breeze | Kebanyakan aplikasi pesan |
|---|--------|--------|
| Pendaftaran | Tidak diperlukan (identitas adalah kunci di dalam perangkat Anda) | Memerlukan nomor telepon |
| Server | Tidak dapat membaca isi | Berdasarkan kepercayaan pada perusahaan |
| Menghosting di server Anda sendiri | Prasyarat (ini untuk dihosting dan digunakan) | Tidak mungkin |
| Kode sumber | Semuanya publik (lisensi MIT) | Sering kali tidak publik |
| Di mana data berada | Di dalam perangkat Anda | Di server perusahaan |

Perbandingan terperinci dengan Signal dan LINE ada di [halaman perbandingan (Bahasa Inggris)](../COMPARISON.md). Setiap klaim Breeze dilengkapi dengan "cara memverifikasinya", dan hal-hal di mana Breeze kalah (jumlah pengguna, belum adanya audit eksternal, dan sebagainya) juga dituliskan tanpa disembunyikan.

## Biaya menghosting di server Anda sendiri

Breeze berjalan pada tingkat gratis Cloudflare. Tidak memerlukan kartu kredit.

| Item | Tingkat gratis | Berbayar |
|-----------|-----------|-------------|
| Hosting | Cloudflare Pages (gratis) | — |
| Pemrosesan | Hingga 100.000/hari | Hingga 10 juta/bulan |
| Penyimpanan | Hingga 100.000 baca / 1.000 tulis per hari | Hingga 10 juta baca / 1 juta tulis per bulan |
| Relay panggilan | Gratis hingga 20GB | $0,05 per GB |
| Domain khusus | Tidak diperlukan (alamat gratis disertakan) | $10/tahun |
| **Total** | **$0/bulan** (hingga sekitar 20–40 orang dengan penggunaan ringan) | **Mulai $5/bulan** (sekitar 100 orang dengan penggunaan ringan; pada 1.000 orang, $34–$222/bulan tergantung penggunaan) |

Bagaimana biaya tumbuh pada skala besar, dan "mengapa satu operator tidak harus menanggung biaya semua orang", ada di [filosofi biaya dan keberlanjutan (Bahasa Inggris)](../SUSTAINABILITY.md), dan perhitungan dasarnya ada di [model biaya (Bahasa Inggris)](../COST_MODEL.md).

Pemasangan dimulai dari satu perintah ini (lihat [panduan pemasangan](SELF_HOSTING-id.md) untuk detailnya).

```bash
wrangler pages deploy . --project-name=breeze
```

## Detail teknis (untuk pengembang)

### Metode enkripsi

| Peran | Metode |
|-------|-----------|
| Pertukaran kunci | X25519 (cadangan: P-256) |
| Tanda tangan | Ed25519 (cadangan: HMAC-SHA256) |
| Enkripsi | AES-256-GCM |
| Derivasi kunci | HKDF-SHA256 |
| Pembaruan kunci percakapan | Double Ratchet (metode yang sama dengan Signal) |
| Kunci grup | Sender Key |
| Menyembunyikan pengirim dari relay | Sealed Sender |

Dokumen otoritatif untuk desain adalah [spesifikasi SPEC.md](../../SPEC.md), dan tempat melaporkan kelemahan serta kebijakannya ada di [SECURITY.md](../../SECURITY.md).

### Pengujian dan pemeriksaan kualitas

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Berpartisipasi dalam pengembangan

Proses dan aturannya ada di [CONTRIBUTING.md](../../CONTRIBUTING.md).
Untuk laporan bug, kunjungi [halaman Issues](https://github.com/shizukutanaka/Breeze/issues). Kode etiknya adalah [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [docs/i18n/README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [docs/COMPARISON.md](../COMPARISON.md).

## Lisensi

MIT — sebagaimana dinyatakan dalam [LICENSE](../../LICENSE), gunakan, ubah, dan distribusikan dengan bebas.
