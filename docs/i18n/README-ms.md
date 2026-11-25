# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Baca dalam bahasa lain**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · Bahasa Melayu (halaman ini) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Pengirim mesej terenkripsi — tiada nombor telefon, tiada pendaftaran.**
Kandungan perbualan hanya boleh dibaca oleh orang yang menghantar dan orang yang menerimanya. Malah pelayan yang membawanya di tengah jalan pun tidak boleh membacanya.
Semua ciri adalah percuma, dan tiada iklan.

Ini bukan halaman web, tetapi perisian yang anda pasang dan gunakan (Windows / Mac / Linux / Android / iPhone / pelayar).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## Untuk menggunakannya, letakkan pada pelayan anda sendiri

Breeze tiada "pelayan syarikat pengendali". **Untuk menggunakannya, anda sendiri menyediakan tempat (pelayan) dan meletakkan Breeze di sana. Inilah cara penggunaan yang rasmi.**

- Tempat percuma sudah memadai. Ia berjalan dalam peringkat percuma Cloudflare, dan tiada kad kredit diperlukan. Langkah-langkahnya ada dalam [panduan pemasangan](SELF_HOSTING-ms.md) (bahasa lain boleh dipilih di bahagian atas panduan).
- Aplikasi (Windows / Mac / Linux / Android / iPhone) boleh diperoleh dari [halaman muat turun](https://github.com/shizukutanaka/Breeze/releases/latest), dan digunakan dengan menyambung ke pelayan anda sendiri.
- **Tentang pemasangan contoh (makluman jujur)**: Sebuah contoh untuk pengesahan operasi (https://breeze-469.pages.dev/) telah disediakan. Perisian yang diletakkan di sana adalah sama, tetapi untuk penggunaan sebenar, sila gunakan pelayan anda sendiri. Contoh tersebut mungkin berubah atau berhenti tanpa notis. Apa yang anda letakkan pada pelayan anda sendiri tidak terjejas oleh pemberhentian contoh tersebut.

Cara penggunaan yang terperinci ada dalam [manual](MANUAL-ms.md) (bahasa lain boleh dipilih di bahagian atas manual).

## Cara penggunaan (3 langkah)

1. Buka Breeze yang telah anda letakkan pada pelayan anda sendiri (atau alamat yang diberitahu oleh orang yang meletakkannya), dan masukkan nama anda. Itu sahaja persediaannya (tiada pendaftaran, tiada nombor telefon). Pada masa ini, sebuah "kunci" dicipta di dalam peranti, dan kunci itu menjadi identiti anda.
2. Berikan ID atau kod QR anda kepada orang yang ingin anda ajak berbual.
3. Jika pihak satu lagi juga membuka aplikasi, anda boleh berhubung secara terus dan berbual. Jika mereka tidak membukanya, mesej diletakkan dalam keadaan terenkripsi di dalam "peti simpanan", dan akan dihantar apabila mereka membukanya. Pelayan yang membawa peti simpanan tidak boleh membaca kandungannya. Surat yang tidak sampai akan dipadam secara automatik selepas maksimum 7 hari.

## Janji (perkara yang tidak kami lakukan)

- **Kami tidak memaparkan iklan.** Tidak di dalam aplikasi, tidak di mana-mana.
- **Kami tidak menjejaki anda.** Tiada analisis penggunaan, tiada mekanisme pengiklanan, tiada penjualan data langsung.
- **Pencipta tidak memegang data pengguna.** Di pihak pelayan, senarai akaun itu sendiri tidak wujud. Identiti anda hanyalah kunci di dalam peranti anda.
- **Perbualan dienkripsi antara peranti.** Pelayan hanya mengendalikan sampul yang tidak boleh dibacanya.

Kami juga menulis skopnya dengan jujur. Untuk penghantaran, pelayan menyimpan beberapa perkara untuk masa yang singkat (sampul yang belum dihantar maksimum 7 hari, isyarat sambungan 5 minit, rekod alamat dan peranti 90 hari, maklumat kumpulan dan langganan pemberitahuan 30 hari. Semuanya dipadam secara automatik, dan kandungannya tidak boleh dibaca). Sandaran awan dilumpuhkan pada mulanya. Jika anda meletakkannya pada pelayan anda sendiri, penyimpanan itu pun berada di bawah kawalan anda sendiri.

## Perkara yang boleh dilakukan

- Perbualan 1 lawan 1 dan perbualan kumpulan (sehingga 1,000 orang)
- Panggilan suara dan panggilan video (panggilan kumpulan sehingga 8 orang)
- Penghantaran fail (dalam 1 lawan 1, sehingga 50MB. Dalam kumpulan juga boleh dihantar, tetapi had saiznya lebih kecil)
- Penggunaan berbilang peranti dan berbilang akaun (seperti untuk kerja dan peribadi. Bilangan peranti dan akaun kedua-duanya percuma dan tanpa had)
- 51 bahasa (Bahasa Inggeris ditambah 50 fail bahasa), dipilih secara automatik mengikut bahasa peranti anda
- Profil dengan gambar, pelekat, perkongsian lokasi
- Operasi arahan seperti `/help` (71 jenis)
- Mod kuasa mengikut bateri anda (automatik / biasa / penjimatan kuasa / kecemasan). Apabila bateri semakin berkurangan, semakan penghantaran dijarakkan supaya bateri tahan lebih lama. Perlindungan untuk bencana dan ketika anda tidak dapat mengecas
- Skrin yang mudah dibaca (menitikberatkan kontras warna, saiz teks, dan pengendalian dengan papan kekunci sahaja)

## Perbezaan dengan pengirim mesej lain

| | Breeze | Kebanyakan pengirim mesej |
|---|--------|--------|
| Pendaftaran | Tidak perlu (identiti ialah kunci di dalam peranti) | Nombor telefon diperlukan |
| Pelayan | Tidak boleh membaca kandungan | Berdasarkan kepercayaan kepada syarikat pengendali |
| Meletakkan pada pelayan sendiri | Prasyarat (sesuatu yang diletakkan dan digunakan) | Tidak boleh |
| Pendedahan kandungan dalam | Semuanya terbuka (lesen MIT) | Banyak yang tidak terbuka |
| Lokasi data | Di dalam peranti anda | Di pelayan syarikat pengendali |

Perbandingan terperinci dengan Signal dan LINE ada di [halaman perbandingan (Bahasa Inggeris)](../COMPARISON.md). Setiap dakwaan Breeze disertakan dengan "cara untuk mengesahkannya", dan perkara di mana Breeze kalah (bilangan pengguna, belum menerima audit luar, dan sebagainya) juga ditulis tanpa disembunyikan.

## Kos apabila meletakkan pada pelayan sendiri

Breeze berjalan dalam lingkungan percuma Cloudflare. Tiada kad kredit diperlukan.

| Item | Lingkungan percuma | Jika berbayar |
|-----------|-----------|-------------|
| Tempat | Cloudflare Pages (percuma) | — |
| Pemprosesan | Sehingga 100,000 kali sehari | Sehingga 10 juta kali sebulan |
| Penyimpanan | Sehari baca sehingga 100,000 kali, tulis sehingga 1,000 kali | Sebulan baca 10 juta kali, tulis 1 juta kali |
| Geganti panggilan | Percuma sehingga 20GB | 0.05 dolar bagi setiap 1GB |
| Domain sendiri | Tidak perlu (alamat percuma disertakan) | 10 dolar setahun |
| **Jumlah** | **0 dolar sebulan** (dengan penggunaan ringan, sehingga kira-kira 20–40 orang) | **Bermula dari 5 dolar sebulan** (dengan penggunaan ringan, skala kira-kira 100 orang. Pada skala 1,000 orang, bergantung pada penggunaan, 34–222 dolar sebulan) |

Cara kos meningkat pada skala besar dan "mengapa seorang pengendali tidak perlu menanggung kos keseluruhan" ada dalam [pemikiran kos dan kelestarian (Bahasa Inggeris)](../SUSTAINABILITY.md), dan pengiraan asasnya ada dalam [model kos (Bahasa Inggeris)](../COST_MODEL.md).

Pemasangan bermula dengan satu arahan ini (butiran dalam [panduan pemasangan](SELF_HOSTING-ms.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Butiran teknikal (untuk pembangun)

### Kaedah enkripsi

| Peranan | Kaedah |
|-------|-----------|
| Pertukaran kunci | X25519 (simpanan: P-256) |
| Tandatangan | Ed25519 (simpanan: HMAC-SHA256) |
| Enkripsi | AES-256-GCM |
| Terbitan kunci | HKDF-SHA256 |
| Kemas kini kunci perbualan | Double Ratchet (kaedah yang sama seperti Signal) |
| Kunci kumpulan | Sender Key |
| Menyembunyikan pengirim daripada geganti | Sealed Sender |

Dokumen induk reka bentuk ialah [dokumen spesifikasi SPEC.md](../../SPEC.md), dan tempat melaporkan kelemahan serta dasarnya ada dalam [SECURITY.md](../../SECURITY.md).

### Ujian dan pemeriksaan kualiti

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Penyertaan dalam pembangunan

Cara kerja dan peraturan ada dalam [CONTRIBUTING.md](../../CONTRIBUTING.md).
Laporan pepijat ke [halaman Issue](https://github.com/shizukutanaka/Breeze/issues). Tatakelakuan ialah [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Lesen

MIT — seperti dalam [LICENSE](../../LICENSE), bebas untuk digunakan, diubah dan diedarkan.
