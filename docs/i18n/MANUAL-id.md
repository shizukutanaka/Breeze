# Manual Breeze

**Baca dalam bahasa lain / Read in another language**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · Bahasa Indonesia (halaman ini) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze adalah aplikasi pesan terenkripsi yang tidak memerlukan nomor telepon maupun pendaftaran.
Isi percakapan hanya dapat dibaca oleh pengirim dan penerima. Bahkan server yang membawanya di tengah jalan pun tidak dapat membacanya.
Semua fitur gratis, dan tidak ada iklan.

Manual ini adalah panduan bagi mereka yang baru memulai.

---

## 1. Cara memulai

### Mendapatkannya

Dari [halaman unduhan](https://github.com/shizukutanaka/Breeze/releases/latest), pilih satu yang sesuai dengan mesin Anda.

- Windows: yang namanya berakhiran `-win-x64.exe` (ada juga untuk mesin ARM)
- Mac: yang namanya berakhiran `-mac.dmg`
- Linux: `.AppImage` (dapat langsung dijalankan) atau `.deb`
- Untuk menggunakannya di browser, gunakan versi yang dihosting di server Anda sendiri (langkah pemasangan ada di dokumen terpisah "Panduan Pemasangan")

Setiap file disertai nilai untuk verifikasi (SHA256SUMS.txt). Jika Anda mau, Anda dapat memeriksa apakah nilai file yang Anda unduh cocok.

> **Tentang halaman uji coba**: Halaman uji coba yang sebelumnya dipublikasikan (breeze.pages.dev) saat ini dihentikan (membukanya akan menampilkan 404). Silakan gunakan versi aplikasi hingga halaman tersebut dipulihkan. Apa pun yang dihosting di server Anda sendiri tidak terpengaruh oleh penghentian ini.

### Pengaturan pertama

1. Buka aplikasinya.
2. Masukkan nama Anda. Hanya itu — Anda siap. Tanpa pendaftaran, tanpa nomor telepon.

Pada saat ini, sebuah "kunci" dibuat di dalam perangkat Anda. Itulah identitas Anda.
**Tidak ada daftar akun di server.** Identitas Anda hanya ada di dalam perangkat Anda.
Hal ini menjadi penting dalam bab cadangan (8).

### Tentang "identitas sekali pakai"

Jika Anda memilih "identitas sekali pakai" saat membuatnya, Anda akan mendapatkan identitas yang sama sekali tidak memiliki cara untuk dipulihkan.
Jika Anda kehilangan perangkat itu, mengaturnya ulang, atau menghapus data browser Anda, identitas itu tidak akan pernah kembali.
Hal ini juga dinyatakan di layar. Jangan memilih ini untuk identitas yang berencana Anda gunakan dalam jangka panjang.

---

## 2. Terhubung dengan seseorang

Ada 3 cara untuk terhubung dengan orang yang ingin Anda ajak bicara.

- **Memberikan ID Anda**: Beritahu ID Anda kepada orang lain dan minta mereka memasukkannya.
- **Kode QR**: Tampilkan kode QR undangan Anda dan biarkan orang lain memindainya.
- **Tautan undangan**: Salin pesan undangan dari "Undang teman" dan kirimkan melalui sarana kontak Anda yang biasa (email, dsb.). Ketika orang lain membuka tautan dan memasukkan namanya, Anda dapat langsung mulai berbicara.

Jika orang lain juga membuka aplikasinya, Anda dapat terhubung langsung dan berbicara.

---

## 3. Percakapan

- Cukup ketik pesan dan kirim. Anda juga dapat mengirim foto, stiker, dan lokasi Anda.
- **Mengirim file**: Hingga maksimal 50MB dalam percakapan satu lawan satu. Dalam grup, ukurannya kecil, sekitar 50KB.
- File dengan format berbahaya, seperti file yang dapat dieksekusi, akan otomatis diblokir.
- Ketika orang lain tidak membuka aplikasinya, pesan Anda ditempatkan dalam keadaan terenkripsi di sebuah "kotak surat" dan dikirimkan ketika mereka membukanya. Server yang membawa kotak surat tidak dapat membaca isinya. Surat yang tidak pernah terkirim akan otomatis terhapus setelah **maksimal 7 hari**.
- Riwayat percakapan dapat ditulis ke file, atau diimpor dari file.

### Perintah

Mengetik `/help` di kolom input akan menampilkan daftar perintah yang dapat digunakan (lebih dari 60 jenis).
Beberapa operasi, seperti pengaturan dan penautan perangkat, dilakukan melalui perintah.

---

## 4. Grup

- Sebuah grup dapat menampung hingga maksimal **1.000 orang**.
- Untuk membuatnya, cukup masukkan nama grup. Undangan diberikan melalui "tautan undangan grup". Orang yang menerima tautan dapat bergabung dengan memasukkan namanya.
- File juga dapat dikirim dalam grup, tetapi batasnya kecil, sekitar 50KB. Pesan suara belum dapat dikirim dalam grup.
- Jika seorang anggota menggunakan versi aplikasi yang lama, metode baru yang lebih aman (grup v5) tidak dapat digunakan dalam grup tersebut, dan sebuah peringatan akan muncul di layar. Metode itu menjadi aktif ketika semua orang memperbarui ke versi terbaru.

---

## 5. Panggilan

- Panggilan suara dan video satu lawan satu dapat dilakukan. Ada juga panggilan grup.
- **Kode verifikasi panggilan**: Sebuah kode verifikasi ditampilkan di layar panggilan. Bacakan dengan lantang bersama orang lain dan periksa apakah kode itu cocok di kedua layar. Jika tidak cocok, mungkin ada seseorang yang mendengarkan di tengah jalan. Dalam kasus itu, putuskan panggilan.
- Panggilan grup mungkin tidak dapat dimulai kecuali aplikasi semua orang berada pada versi terbaru.

---

## 6. Banyak perangkat dan akun

- Untuk menggunakan identitas yang sama di banyak perangkat, tautkan perangkat-perangkat itu dengan perintah `/link`.
- Anda dapat membuat banyak akun dan menggunakannya untuk tujuan yang berbeda (misalnya untuk pekerjaan dan pribadi). Jumlah perangkat dan akun gratis dan tidak terbatas.
- **Cara membuat akun**: Buka Pengaturan dan ketuk tombol "Tambah akun" di bagian "Akun". Masukkan nama dan pilih emoji ikon, maka akun baru akan dibuat dan Anda akan otomatis beralih ke akun tersebut.
- **Cara beralih akun**: Jika Anda memiliki dua akun atau lebih, tab akun akan muncul di bagian paling atas daftar kontak. Ketuk tab untuk beralih (di komputer, Anda juga dapat menggunakan Ctrl+1–9). Tekan lama tab untuk mengganti namanya, mengubah ikonnya, atau menghapusnya.
- Setiap akun memiliki kontak dan kuncinya sendiri. Tukarkan kontak secara terpisah untuk setiap akun.
- Bahasa dipilih secara otomatis dari 8 bahasa — Inggris, Jepang, Korea, Mandarin (Taiwan), Spanyol, Thai, Indonesia, Portugis (Brasil).

---

## 7. Pengaturan untuk tetap aman

- **Kunci otomatis**: Ada pengaturan yang mengunci secara otomatis ketika Anda berpindah tab.
- **Frasa sandi kunci**: Anda dapat melindungi kunci di dalam perangkat Anda dengan membungkusnya dalam frasa sandi. Anda akan diminta memasukkannya ketika membuka aplikasi.
- **Memblokir**: Anda dapat memblokir orang yang mengganggu. Pesan dari orang yang diblokir tidak akan sampai.

---

## 8. Cadangan dan pemulihan (bab terpenting)

Di Breeze, identitas Anda hanyalah kunci di dalam perangkat Anda. Tidak ada daftar akun di server, dan pembuatnya pun tidak memiliki kunci Anda.
**Jika Anda kehilangan perangkat Anda, Anda juga kehilangan identitas Anda.** Selalu buat cadangan untuk identitas yang penting bagi Anda.

### Cara membuat cadangan

1. Pilih "Buat cadangan".
2. Tetapkan frasa sandi untuk cadangan (6 karakter atau lebih).
3. Pilih tujuannya.
   - **Simpan ke file**: Simpan file cadangan pada diri Anda sendiri (disarankan).
   - **Simpan ke server relay**: Hanya dapat digunakan jika operator relay tersebut telah mengaktifkannya. Ini tidak dapat digunakan pada relay bawaan. Ada masa penyimpanan, jadi ambil kembali sebelum masa itu berakhir.

Isi cadangan terenkripsi. Server penyimpanan hanya menangani teks sandi (ciphertext).

### Cara memulihkan

Pada perangkat baru, pulihkan menggunakan file cadangan (atau cadangan di server relay) dan frasa sandi yang Anda tetapkan.

### Catatan

- **Jika Anda lupa frasa sandi, pemulihan tidak mungkin dilakukan.** Pembuatnya pun tidak dapat memperbaikinya. Tuliskan frasa sandi di tempat terpisah.
- **Identitas sekali pakai tidak dapat dikembalikan, baik dengan cadangan maupun pemulihan.**
- Buat ulang cadangan Anda ketika Anda menambah identitas atau mengganti perangkat.

---

## 9. Kotak surat dan pemikiran tentang biaya

- Ketika orang lain sedang offline, surat-surat ditempatkan dalam keadaan terenkripsi di "kotak surat" server relay (maksimal 7 hari).
- Relay memiliki batas untuk mencegah penyalahgunaan (seberapa banyak dan seberapa sering Anda dapat menitipkan). Ketika batas tercapai, Anda tidak dapat menitipkan surat baru selama periode itu, tetapi **surat yang sudah sampai tidak akan pernah hilang**. Alasan dan waktu tunggu ditampilkan di layar.
- Jika Anda menghostingnya di server Anda sendiri, Anda dapat menentukan batasnya sendiri.

Cakupan catatan yang tetap berada di sisi server (semuanya terhapus secara otomatis, dan isinya tidak dapat dibaca):

| Hal | Berapa lama itu bertahan |
|---|---|
| Surat yang belum terkirim | Maksimal 7 hari |
| Sinyal koneksi | 5 menit |
| Catatan alamat dan perangkat | 90 hari |
| Informasi grup dan langganan notifikasi | 30 hari |

---

## 10. Cara memperbarui (versi desktop)

1. Ketika versi baru tersedia, sebuah pemberitahuan muncul di layar.
2. Menekan "Unduh" akan mengambil versi baru (versi itu tidak terinstal secara otomatis).
3. Setelah unduhan selesai, tekan "Instal" dan mulai ulang.

Jika sesuatu gagal selama pembaruan (misalnya verifikasi file tidak cocok), **pembaruan akan berhenti dan alasannya ditampilkan di layar**. Tidak mungkin kembali ke versi lama.

---

## 11. Ketika Anda mengalami masalah

| Gejala | Apa yang harus diperiksa |
|---|---|
| Pesan tidak dapat dikirim | Periksa apakah waktu perangkat Anda tidak salah. Jika waktunya salah, pengiriman akan gagal. |
| Tidak sampai ke orang lain | Ia menunggu di kotak surat hingga orang lain membuka aplikasi (maksimal 7 hari). |
| File tidak dapat dikirim | Periksa apakah Anda tidak melebihi batas ukuran (50MB untuk satu lawan satu, sekitar 50KB untuk grup), dan apakah itu tidak diblokir sebagai format berbahaya. |
| Kode verifikasi panggilan tidak cocok | Putuskan panggilan dan telepon kembali. Jangan melanjutkan selagi tidak cocok. |
| Lupa frasa sandi | Pemulihan tidak mungkin dilakukan. Buat identitas baru dan beritahu orang lain lagi. |
| Kehilangan perangkat | Jika Anda memiliki cadangan, Anda dapat memulihkannya di perangkat baru. Jika tidak, itu akan menjadi identitas baru. |
| Halaman uji coba tidak terbuka (404) | Saat ini dihentikan. Silakan gunakan versi aplikasi. |

Untuk laporan bug, silakan kunjungi [halaman Issues](https://github.com/shizukutanaka/Breeze/issues).

---

## 12. Janji Breeze

- Tidak ada iklan. Tidak ada di mana pun di dalam aplikasi, tidak ada di mana pun.
- Tidak ada pelacakan. Tidak ada analitik penggunaan, tidak ada mekanisme periklanan, tidak ada penjualan data.
- Pembuatnya tidak memegang data pengguna apa pun. Di sisi server, daftar akun itu sendiri tidak ada.
- Percakapan dienkripsi antar perangkat. Server hanya menangani amplop yang tidak dapat dibacanya.

Perbandingan terperinci dengan aplikasi pesan lain ditulis di "halaman perbandingan" repositori, termasuk hal-hal di mana Breeze kalah (jumlah pengguna, belum adanya audit eksternal, dan sebagainya).

---

*Manual ini mencerminkan konten per Breeze v3.8.0.*
