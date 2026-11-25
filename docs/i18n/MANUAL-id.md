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
- Untuk menggunakannya di browser, gunakan versi yang dihosting di server Anda sendiri (langkah pemasangan ada di dokumen terpisah "Panduan Pemasangan"). Penyiapan standar menggunakan Cloudflare, jadi akun Cloudflare diperlukan

Setiap file disertai nilai untuk verifikasi (SHA256SUMS.txt). Jika Anda mau, Anda dapat memeriksa apakah nilai file yang Anda unduh cocok.

> **Tentang halaman contoh**: Sebuah halaman contoh untuk memeriksa cara kerjanya (https://breeze-469.pages.dev/) disediakan. Perangkat lunak yang dihosting di sana sama, tetapi halaman contoh dapat berubah atau berhenti tanpa pemberitahuan. Untuk penggunaan sebenarnya, silakan gunakan versi yang dihosting di server Anda sendiri. Versi yang dihosting di server Anda sendiri tidak terpengaruh jika halaman contoh berhenti.

### Pengaturan pertama

1. Buka aplikasinya.
2. Tekan "Mulai dengan ID acak". Hanya itu — Anda siap. Tanpa pendaftaran, tanpa nomor telepon.

- Jika Anda memasukkan "Nama Anda (nama tampilan)" di kolom di atas tombol, Anda mulai dengan nama itu. Anda juga dapat menekan tombol dengan kolom dibiarkan kosong. Anda dapat mengubah nama tampilan nanti, di bagian profil pada pengaturan.
- Ada juga cara untuk membuat identitas dengan nama dan Breeze ID yang Anda pilih sendiri. Dalam hal itu, frasa pemulihan diterbitkan dan ditampilkan di layar. Frasa pemulihan adalah kata-kata yang memungkinkan Anda mengembalikan identitas itu di perangkat lain. Tuliskan di kertas atau di tempat yang aman.
- Jika Anda ingin mengembalikan identitas yang pernah Anda buat sebelumnya, buka "Pulihkan akun yang sudah ada" dan cara-cara pemulihan (pulihkan dari berkas cadangan, pulihkan dengan frasa pemulihan, pulihkan dengan akun + frasa sandi) akan muncul.
- Ketika pembuatan selesai, sebuah kartu muncul yang memandu Anda untuk melindungi kunci Anda dengan frasa sandi (kartu itu tidak hilang setelah beberapa saat). Untuk identitas yang penting, ikuti panduan tersebut dan tambahkan perlindungannya.

Pada saat ini, sebuah "kunci" dibuat di dalam perangkat Anda. Itulah identitas Anda.
**Tidak ada daftar akun di server.** Identitas Anda hanya ada di dalam perangkat Anda.
Hal ini menjadi penting dalam bab cadangan (9).

### Tentang "identitas sekali pakai" yang dulu ada

"Identitas sekali pakai" — identitas yang sama sekali tidak memiliki cara untuk dipulihkan — sudah tidak ada. Dengan cara-cara pembuatan identitas saat ini, setiap identitas dapat dilindungi dengan cadangan.

---

## 2. Terhubung dengan seseorang

Tekan tombol "Tambah teman" di layar kontak dan tiga pilihan akan muncul.

- **Tambah kontak**: Masukkan ID orang lain, atau pindai kode QR.
- **Undang teman**: Salin tautan undangan dan kirimkan melalui sarana kontak Anda yang biasa (email, dsb.). Ketika orang lain membuka tautan dan memasukkan namanya, Anda dapat langsung berbicara.
- **Buat grup**: Cukup masukkan nama grup untuk membuatnya (bab 4).

ID Anda sendiri ditampilkan dalam bentuk lengkapnya ketika Anda membuka profil Anda sendiri, dan Anda dapat menyalinnya apa adanya. Anda dapat memberikan ID lengkap, bukan hanya ID singkatnya.

Jika orang lain juga membuka aplikasinya, Anda terhubung langsung dan dapat berbicara.

---

## 3. Percakapan

- Cukup ketik pesan dan kirim. Anda juga dapat mengirim foto, stiker, dan lokasi Anda.
- Buka "+" di samping kolom input dan lampiran file, pesan suara, input suara, informasi lokasi, stiker, pengaturan "tidak perlu balasan", dan lainnya akan muncul bersamaan.
- **Mengirim file**: Hingga maksimal 50MB dalam percakapan satu lawan satu. Dalam grup, ukurannya kecil, sekitar 50KB.
- File dengan format berbahaya, seperti file yang dapat dieksekusi, akan otomatis diblokir.
- Ketika orang lain tidak membuka aplikasinya, pesan Anda ditempatkan dalam keadaan terenkripsi di sebuah "kotak surat" dan dikirimkan ketika mereka membukanya. Server yang membawa kotak surat tidak dapat membaca isinya. Surat yang tidak pernah terkirim akan otomatis terhapus setelah **maksimal 7 hari**.
- Riwayat percakapan dapat ditulis ke file, atau diimpor dari file.

### Membaca layar

- **Status pengiriman**: Dapat diketahui dari tanda di samping pesan. ✓ berarti terkirim, ✓ di dalam lingkaran berarti telah dititipkan di kotak surat, ✓✓ berarti telah sampai ke orang lain, sudah dibaca adalah tanda biru, dan gagal adalah tanda merah. Tanda-tanda itu dibedakan dari bentuknya selain dari warnanya.
- **Daftar kontak**: Waktu terakhir Anda berbicara ditampilkan sebagai jam untuk hari ini, "Kemarin" untuk kemarin, bulan/tanggal untuk tahun ini, dan tahun/bulan/tanggal untuk yang lebih lama. Kontak dengan pesan yang belum dibaca nama dan waktunya ditonjolkan.
- **Nama untuk kontak**: Buka "Info kontak" (di menu klik kanan pada sebuah kontak, atau menu "⋮" pada percakapan) dan Anda dapat menetapkan nama Anda sendiri untuk kontak itu (nama panggilan). Nama panggilan hanya disimpan di perangkat ini dan tidak pernah dikirim ke kontak atau server relay. Ketika Anda menetapkan nama panggilan, nama yang ditetapkan kontak itu untuk dirinya sendiri juga ditampilkan di sampingnya dengan warna yang redup. Anda dapat mematikan nama kedua itu dengan "Tampilkan juga nama yang ditetapkan setiap kontak untuk dirinya sendiri" di bagian "Privasi" pada pengaturan.
- **Kartu Anda sendiri**: Di bagian atas daftar ada kartu profil Anda sendiri; tekan untuk membuka profil Anda. Kartu itu ikut bergulir bersama daftar.
- **Tab bawah di ponsel**: Pada lebar ponsel, lima tab muncul di bagian bawah layar: "Obrolan", "Panggilan", "Kontak", "Kartu saya", dan "Pengaturan". Tab mana yang ditampilkan dapat Anda pilih satu per satu di "Tab bawah" dalam pengaturan (Obrolan selalu ditampilkan. Meskipun Anda menyembunyikan tab Pengaturan, Anda tetap dapat membuka pengaturan dari tombol roda gigi di layar).
- **Kepala percakapan**: Dari ikon pencarian Anda dapat mencari di dalam percakapan. Dari menu "⋮" Anda dapat memeriksa nomor keamanan, membisukan notifikasi, menyematkan, membuat jajak pendapat, dan lainnya.

### Perintah

Mengetik `/` di kolom input akan memunculkan saran perintah. Ketik `/help` untuk melihat daftar perintah yang dapat digunakan (71 jenis).
Beberapa operasi, seperti pengaturan dan penautan perangkat, dilakukan melalui perintah.

---

## 4. Grup

- Sebuah grup dapat menampung hingga maksimal **1.000 orang**.
- Untuk membuatnya, cukup masukkan nama grup di "Buat grup" pada "Tambah teman" (Anda juga dapat membuatnya dengan perintah `/newgroup`). Undangan diberikan melalui "tautan undangan grup". Orang yang menerima tautan dapat bergabung dengan memasukkan namanya.
- File juga dapat dikirim dalam grup, tetapi batasnya kecil, sekitar 50KB. Pesan suara belum dapat dikirim dalam grup.
- Jika seorang anggota menggunakan versi aplikasi yang lama, metode baru yang lebih aman (grup v5) tidak dapat digunakan dalam grup tersebut, dan sebuah peringatan akan muncul di layar. Metode itu menjadi aktif ketika semua orang memperbarui ke versi terbaru.

---

## 5. Panggilan

- Panggilan suara dan video satu lawan satu dapat dilakukan. Ada juga panggilan grup (maksimal 8 orang).
- **Kode verifikasi panggilan**: Sebuah kode verifikasi ditampilkan di layar panggilan. Bacakan dengan lantang bersama orang lain dan periksa apakah kode itu cocok di kedua layar. Jika tidak cocok, mungkin ada seseorang yang mendengarkan di tengah jalan. Dalam kasus itu, putuskan panggilan.
- Panggilan grup mungkin tidak dapat dimulai kecuali aplikasi semua orang berada pada versi terbaru.
- **Riwayat panggilan**: Panggilan satu lawan satu meninggalkan riwayat hanya di perangkat ini (orang lain, apakah panggilan itu keluar / masuk / tak terjawab, waktunya, dan durasi panggilan. Tidak ada satu pun dari yang dikatakan disimpan). Riwayat tidak pernah dikirim ke server atau ke orang lain. Hingga 200 entri disimpan, dengan yang terlama dihapus terlebih dahulu. Panggilan grup tidak muncul dalam riwayat.
- Buka riwayat di ponsel dari tab "Panggilan". Ketika ada panggilan tak terjawab yang belum Anda lihat, lencana angka muncul di tab Panggilan, dan hilang saat Anda membuka riwayat. Dari baris riwayat Anda dapat membuka percakapan dengan orang itu atau meneleponnya kembali. Anda dapat menghapus seluruh riwayat dengan tombol di layar.
- **Riwayat panggilan bukan bagian dari cadangan.** Di perangkat baru, riwayat mulai kosong. Jika Anda tidak ingin riwayat disimpan, matikan "Simpan riwayat panggilan di perangkat ini" di bagian "Privasi" pada pengaturan, dan perekaman itu sendiri berhenti.

---

## 6. Banyak perangkat dan akun

- Untuk menggunakan identitas yang sama di banyak perangkat, tautkan perangkat-perangkat itu dengan perintah `/link`.
- Anda dapat membuat banyak akun dan menggunakannya untuk tujuan yang berbeda (misalnya untuk pekerjaan dan pribadi). Jumlah perangkat dan akun gratis dan tidak terbatas.
- **Cara membuat akun**: Tekan tombol "+" di samping tab akun di bagian paling atas daftar kontak. Masukkan nama dan pilih emoji ikon, maka akun baru dibuat dan otomatis beralih ke akun itu.
- **Beralih akun**: Tab akun selalu ditampilkan di bagian paling atas daftar kontak. Tekan salah satu untuk beralih (di komputer Anda juga dapat beralih dengan Ctrl+1–9). Tekan dan tahan sebuah tab untuk mengganti namanya, mengubah ikonnya, atau menghapusnya.
- Kontak dan kunci terpisah untuk setiap akun. Tukarkan kontak lagi untuk setiap akun.
- Bahasa dipilih secara otomatis dari 51 bahasa, termasuk Inggris, disesuaikan dengan bahasa perangkat Anda.

---

## 7. Pengaturan untuk tetap aman

Pengaturan terbuka sebagai layarnya sendiri. Di ponsel, buka dari tab "Pengaturan" di bagian bawah layar; di komputer, dari tombol roda gigi di layar (Anda juga dapat membukanya dengan perintah `/settings`). Gunakan tindakan kembali untuk kembali ke layar sebelumnya.

- **Kunci otomatis**: Ada pengaturan yang mengunci secara otomatis ketika Anda berpindah tab.
- **Frasa sandi kunci**: Anda dapat melindungi kunci di dalam perangkat Anda dengan membungkusnya dalam frasa sandi. Anda akan diminta memasukkannya ketika membuka aplikasi.
- **Tampilkan juga nama yang ditetapkan setiap kontak untuk dirinya sendiri**: Di bagian "Privasi". Untuk kontak yang telah Anda beri nama panggilan, Anda dapat memilih apakah nama mereka sendiri ditampilkan di sampingnya (bab 3).
- **Memblokir**: Anda dapat memblokir orang yang mengganggu. Pesan dari orang yang diblokir tidak akan sampai.
- **Apakah riwayat panggilan disimpan**: Dengan "Simpan riwayat panggilan di perangkat ini" di bagian "Privasi", Anda dapat menghentikan perekaman riwayat panggilan (bab 5).
- **Visibilitas tab bawah**: Di bagian "Tab bawah" Anda dapat menampilkan atau menyembunyikan tab bawah ponsel (Panggilan / Kontak / Kartu saya / Pengaturan) satu per satu. Obrolan selalu ditampilkan.

---

## 8. Baterai dan keadaan darurat (mode daya)

Dalam pengaturan "Mode daya", Anda dapat memilih bagaimana baterai digunakan.

- **Otomatis (tingkat baterai)**: Beralih secara otomatis sesuai dengan sisa baterai.
- **Normal**: Seperti biasa.
- **Hemat daya**: Memberi jarak pemeriksaan pengiriman hingga paling sering sekali setiap 60 detik, dan menghentikan sinyal kehadiran.
- **Darurat (untuk bencana)**: Memberi jarak pemeriksaan pengiriman hingga paling sering sekali setiap 10 menit. Gunakan dalam bencana atau keadaan lain ketika Anda tidak dapat mengisi daya.

Yang menguras baterai bukanlah jumlah komunikasi, melainkan berapa kali radio bangun. Jadi sisi pengirim tidak diberi jarak; hanya sisi pendengar. Pengiriman tetap langsung terkirim, seperti biasa. Ketika Anda mulai mengisi daya, mode otomatis bergerak kembali satu langkah ke sisi yang lebih ringan.

Pada perangkat yang tidak dapat membaca tingkat baterai secara otomatis (seperti browser iPhone), "Otomatis" berperilaku sebagai Normal, dan pilihan manual bekerja sesuai pilihan.

---

## 9. Cadangan dan pemulihan (bab terpenting)

Di Breeze, identitas Anda hanyalah kunci di dalam perangkat Anda. Tidak ada daftar akun di server, dan pembuatnya pun tidak memiliki kunci Anda.
**Jika Anda kehilangan perangkat Anda, Anda juga kehilangan identitas Anda.** Selalu buat cadangan untuk identitas yang penting bagi Anda.

Pencadangan dan pemulihan dilakukan dari bagian "Cadangan dan pemulihan" pada pengaturan (tombol-tombolnya adalah "Buat Cadangan", "Pulihkan Cadangan", dan "Pulihkan dari file"). Pertama kali Anda menambahkan kontak, sebuah kartu yang menganjurkan Anda membuat cadangan muncul satu kali saja.

### Cadangan otomatis

Pengaturan "Cadangan otomatis" aktif sejak awal. Ketika data Anda berubah, cadangan terenkripsi dikirim secara otomatis ke server relay yang Anda hosting.

- Cadangan tidak dikirim pada setiap perubahan: cadangan menunggu 30 detik setelah perubahan terakhir dan mengirim semuanya bersamaan. Upaya pengiriman diberi jarak setidaknya 15 menit.
- Selagi Anda offline, tidak ada yang dikirim; perubahan ditahan dan dikirim ketika koneksi kembali dan ketika Anda membuka aplikasi.
- Untuk pengiriman otomatis, Anda perlu memasukkan frasa sandi cadangan satu kali di perangkat itu (ketika diperlukan, tombol "Masukkan frasa sandi" muncul di bagian pengaturan). **Frasa sandi tidak disimpan.** Frasa sandi hanya diingat selagi aplikasi terbuka, dan hilang ketika Anda menutupnya. Untuk identitas pemulihan sederhana, tepat setelah Anda memasukkan frasa sandi saat pendaftaran atau pembaruan, pengiriman bekerja apa adanya.
- Jika server relay tidak mendukung penyimpanan cadangan, cadangan otomatis tidak berjalan. Hal itu ditampilkan di bagian pengaturan.
- Keadaannya (kapan pengiriman terakhir yang berhasil, apakah ada perubahan yang menunggu, apakah pengiriman gagal) ditampilkan di bagian pengaturan.

### Cara membuat cadangan (manual)

1. Dari "Cadangan dan pemulihan" di pengaturan, pilih "Buat Cadangan".
2. Tetapkan frasa sandi untuk cadangan (6 karakter atau lebih).
3. Pilih tujuannya.
   - **Simpan ke file**: Simpan file cadangan pada diri Anda sendiri (disarankan).
   - **Simpan ke server relay**: Hanya dapat digunakan jika operator relay tersebut telah mengaktifkannya. Ini tidak dapat digunakan pada relay bawaan. Ada masa penyimpanan, jadi ambil kembali sebelum masa itu berakhir.

Isi cadangan terenkripsi. Server penyimpanan hanya menangani teks sandi (ciphertext).

### Cara memulihkan

Pada perangkat baru, pulihkan menggunakan file cadangan (atau cadangan di server relay) dan frasa sandi yang Anda tetapkan.

Jika Anda baru saja mengembalikan identitas Anda dengan frasa pemulihan, dan cadangan identitas itu ada di server relay, cadangan itu ditemukan secara otomatis dan Anda ditanya dengan "Cadangan ditemukan". Jika Anda memulihkannya, data di perangkat itu digantikan oleh isi cadangan.

### Pindah ke perangkat baru

Tekan tombol "Pindah ke perangkat baru" di bagian "Cadangan dan pemulihan" pada pengaturan dan langkah-langkahnya ditampilkan.

1. Di perangkat Anda saat ini, simpan cadangan di server relay (cadangan otomatis, atau "Buat Cadangan").
2. Di perangkat baru, pilih cara pemulihan di layar pertama dan masukkan frasa pemulihan Anda (atau nama akun dan frasa sandi Anda).
3. Ketika identitas Anda kembali, cadangan di server ditemukan secara otomatis dan pemulihan ditawarkan.

Tidak perlu kabel atau penyerahan file.

### Catatan

- **Jika Anda lupa frasa sandi, pemulihan tidak mungkin dilakukan.** Pembuatnya pun tidak dapat memperbaikinya. Tuliskan frasa sandi di tempat terpisah.
- Memasukkan frasa sandi untuk cadangan otomatis diperlukan di setiap perangkat. Di perangkat baru, masukkan sekali lagi.
- Buat ulang cadangan manual ketika identitas Anda bertambah atau ketika Anda mengganti perangkat.
- Riwayat panggilan bukan bagian dari cadangan. Saat Anda berganti perangkat, riwayat panggilan tidak berpindah ke perangkat baru.

---

## 10. Kotak surat dan pemikiran tentang biaya

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

## 11. Cara memperbarui (versi desktop)

1. Ketika versi baru tersedia, sebuah pemberitahuan muncul di layar.
2. Menekan "Unduh" akan mengambil versi baru (versi itu tidak terinstal secara otomatis).
3. Setelah unduhan selesai, tekan "Instal" dan mulai ulang.

Jika sesuatu gagal selama pembaruan (misalnya verifikasi file tidak cocok), **pembaruan akan berhenti dan alasannya ditampilkan di layar**. Tidak mungkin kembali ke versi lama.

---

## 12. Ketika Anda mengalami masalah

| Gejala | Apa yang harus diperiksa |
|---|---|
| Pesan tidak dapat dikirim | Periksa apakah waktu perangkat Anda tidak salah. Jika waktunya salah, pengiriman akan gagal. |
| Tidak sampai ke orang lain | Ia menunggu di kotak surat hingga orang lain membuka aplikasi (maksimal 7 hari). |
| File tidak dapat dikirim | Periksa apakah Anda tidak melebihi batas ukuran (50MB untuk satu lawan satu, sekitar 50KB untuk grup), dan apakah itu tidak diblokir sebagai format berbahaya. |
| Kode verifikasi panggilan tidak cocok | Putuskan panggilan dan telepon kembali. Jangan melanjutkan selagi tidak cocok. |
| Lupa frasa sandi | Pemulihan tidak mungkin dilakukan. Buat identitas baru dan beritahu orang lain lagi. |
| Kehilangan perangkat | Jika Anda memiliki cadangan, Anda dapat memulihkannya di perangkat baru. Jika tidak, itu akan menjadi identitas baru. |
| Halaman contoh tidak terbuka | Halaman contoh dapat berhenti tanpa pemberitahuan. Silakan gunakan versi yang dihosting di server Anda sendiri. |

Untuk laporan bug, silakan kunjungi [halaman Issues](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Janji Breeze

- Tidak ada iklan. Tidak ada di mana pun di dalam aplikasi, tidak ada di mana pun.
- Tidak ada pelacakan. Tidak ada analitik penggunaan, tidak ada mekanisme periklanan, tidak ada penjualan data.
- Pembuatnya tidak memegang data pengguna apa pun. Di sisi server, daftar akun itu sendiri tidak ada.
- Percakapan dienkripsi antar perangkat. Server hanya menangani amplop yang tidak dapat dibacanya.

Perbandingan terperinci dengan aplikasi pesan lain ditulis di "halaman perbandingan" repositori, termasuk hal-hal di mana Breeze kalah (jumlah pengguna, belum adanya audit eksternal, dan sebagainya).

---

*Manual ini mencerminkan keadaan Breeze per 2026-11-25.*
