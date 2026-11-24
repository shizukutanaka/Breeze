# Manual Breeze

**Baca dalam bahasa lain**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · Bahasa Melayu (halaman ini) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze ialah pengirim mesej terenkripsi yang tidak memerlukan nombor telefon mahupun pendaftaran.
Kandungan perbualan hanya boleh dibaca oleh orang yang menghantar dan orang yang menerimanya. Malah pelayan yang membawanya di tengah jalan pun tidak boleh membacanya.
Semua ciri adalah percuma, dan tiada iklan.

Manual ini ialah panduan untuk orang yang baru mula menggunakan.

---

## 1. Cara bermula

### Memperoleh

Dari [halaman muat turun](https://github.com/shizukutanaka/Breeze/releases/latest), pilih satu yang sesuai dengan mesin anda.

- Windows: yang namanya berakhir dengan `-win-x64.exe` (ada juga untuk mesin ARM)
- Mac: yang namanya berakhir dengan `-mac.dmg`
- Linux: `.AppImage` (boleh dijalankan terus) atau `.deb`
- Jika menggunakan dalam pelayar, gunakan yang telah diletakkan pada pelayan anda sendiri (langkah pemasangan ada dalam dokumen berasingan "Panduan pemasangan")

Setiap fail disertakan dengan nilai semakan (SHA256SUMS.txt). Jika anda bimbang, anda boleh menyemak sama ada nilai fail yang dimuat turun sepadan.

> **Tentang halaman percubaan**: Halaman percubaan yang pernah diterbitkan (breeze.pages.dev) kini dihentikan (apabila dibuka, ia menjadi 404). Sila gunakan versi aplikasi sehingga ia dipulihkan. Apa yang diletakkan pada pelayan anda sendiri tidak terjejas oleh pemberhentian ini.

### Persediaan pertama

1. Buka aplikasi.
2. Masukkan nama anda. Itu sahaja persediaannya. Tiada pendaftaran, tiada nombor telefon diperlukan.

Pada masa ini, sebuah "kunci" dicipta di dalam peranti. Itulah identiti anda sendiri.
**Senarai akaun tidak wujud di pelayan.** Identiti hanya berada di dalam peranti anda.
Perkara ini menjadi penting dalam bab sandaran (8).

### Tentang "identiti pakai buang"

Jika anda memilih "identiti pakai buang" semasa penciptaan, ia menjadi identiti yang tiada sebarang cara pemulihan.
Jika anda kehilangan peranti itu, memformatkannya, atau memadam data pelayar, identiti itu tidak akan kembali selama-lamanya.
Perkara itu juga dipaparkan pada skrin. Jangan pilih untuk identiti yang akan digunakan lama.

---

## 2. Berhubung dengan pihak lain

Terdapat 3 cara untuk berhubung dengan orang yang ingin anda ajak berbual.

- **Serahkan ID**: Beritahu ID anda kepada pihak lain, dan minta mereka memasukkannya.
- **Kod QR**: Paparkan kod QR jemputan, dan minta pihak lain mengimbasnya.
- **Pautan jemputan**: Salin mesej jemputan dari "Jemput rakan", dan hantar melalui cara hubungan biasa anda (e-mel dan sebagainya). Apabila pihak lain membuka pautan dan memasukkan nama, mereka boleh terus berbual.

Jika pihak lain juga membuka aplikasi, anda boleh berhubung secara terus dan berbual.

---

## 3. Perbualan

- Hanya masukkan mesej dan hantar. Gambar, pelekat dan maklumat lokasi juga boleh dihantar.
- **Penghantaran fail**: Dalam perbualan 1 lawan 1, sehingga maksimum 50MB. Dalam kumpulan, lebih kecil iaitu kira-kira 50KB.
- Fail dalam format berbahaya seperti fail boleh laksana akan disekat secara automatik.
- Apabila pihak lain tidak membuka aplikasi, mesej diletakkan dalam keadaan terenkripsi di dalam "peti simpanan", dan akan dihantar apabila mereka membukanya. Pelayan yang membawa peti simpanan tidak boleh membaca kandungannya. Surat yang tidak sampai akan dipadam secara automatik selepas **maksimum 7 hari**.
- Sejarah perbualan boleh dieksport ke fail atau diimport.

### Arahan

Apabila anda memasukkan `/help` dalam medan input, senarai arahan yang boleh digunakan (lebih 60 jenis) akan dipaparkan.
Sebahagian operasi seperti tetapan dan pautan peranti dilakukan melalui arahan.

---

## 4. Kumpulan

- Kumpulan boleh memuatkan sehingga **1,000 orang**.
- Cara membuatnya hanyalah memasukkan nama kumpulan. Jemputan dibuat dari "Pautan jemputan kumpulan". Orang yang menerima pautan boleh menyertai dengan memasukkan nama.
- Fail juga boleh dihantar dalam kumpulan, tetapi hadnya kecil iaitu kira-kira 50KB. Mesej suara belum boleh dihantar dalam kumpulan.
- Jika terdapat ahli yang menggunakan aplikasi versi lama, kaedah baharu yang lebih selamat (kumpulan v5) tidak boleh digunakan dalam kumpulan itu, dan amaran akan dipaparkan pada skrin. Ia menjadi aktif apabila semua orang menggunakan versi terkini.

---

## 5. Panggilan

- Panggilan suara dan panggilan video 1 lawan 1 boleh dibuat. Panggilan kumpulan juga ada.
- **Kod pengesahan panggilan**: Kod pengesahan dipaparkan pada skrin panggilan. Bacakan sesama anda dengan pihak lain, dan sahkan sama ada ia sepadan pada kedua-dua skrin. Jika tidak sepadan, ada kemungkinan seseorang sedang mencuri dengar di tengah jalan. Dalam kes itu, tamatkan panggilan.
- Panggilan kumpulan mungkin tidak boleh dimulakan jika aplikasi semua orang bukan versi terkini.

---

## 6. Berbilang peranti dan akaun

- Untuk menggunakan identiti yang sama pada berbilang peranti, pautkan peranti sesama sendiri dengan arahan `/link`.
- Akaun boleh dibuat berbilang dan digunakan secara berasingan (seperti untuk kerja dan peribadi). Bilangan peranti dan akaun kedua-duanya percuma dan tanpa had.
- **Cara membuat akaun**: Buka Tetapan dan ketuk butang "Tambah akaun" dalam bahagian "Akaun". Masukkan nama dan pilih emoji ikon, dan akaun baharu akan dibuat dan ditukar secara automatik.
- **Cara menukar akaun**: Apabila anda mempunyai dua atau lebih akaun, tab akaun akan muncul di bahagian paling atas senarai kenalan. Ketuk tab untuk menukar (pada komputer, anda juga boleh menggunakan Ctrl+1–9). Tekan lama tab untuk menamakan semula, menukar ikonnya, atau memadamnya.
- Setiap akaun mempunyai kenalan dan kuncinya sendiri. Tukar kenalan secara berasingan untuk setiap akaun.
- Bahasa dipilih secara automatik daripada 8 bahasa: Bahasa Inggeris, Bahasa Jepun, Bahasa Korea, Bahasa Cina (Taiwan), Bahasa Sepanyol, Bahasa Thai, Bahasa Indonesia dan Bahasa Portugis (Brazil).

---

## 7. Tetapan untuk kekal selamat

- **Kunci automatik**: Terdapat tetapan untuk mengunci secara automatik apabila anda menukar tab.
- **Frasa laluan kunci**: Kunci di dalam peranti boleh dilindungi dengan membalutnya dalam frasa laluan. Anda akan diminta memasukkannya apabila membuka aplikasi.
- **Sekat**: Pihak yang mengganggu boleh disekat. Hubungan daripada pihak yang disekat tidak akan sampai.

---

## 8. Sandaran dan pemulihan (bab yang paling penting)

Identiti Breeze hanyalah kunci di dalam peranti anda. Senarai akaun tidak wujud di pelayan, dan pencipta pun tidak mempunyai kunci anda.
**Jika anda kehilangan peranti, identiti juga akan hilang.** Untuk identiti yang penting, pastikan anda membuat sandaran.

### Cara membuat sandaran

1. Pilih "Buat sandaran".
2. Tetapkan frasa laluan untuk sandaran (6 aksara atau lebih).
3. Pilih destinasi simpanan.
   - **Simpan ke fail**: Simpan fail sandaran di tangan anda sendiri (disyorkan).
   - **Simpan ke pelayan geganti**: Hanya boleh digunakan jika pengendali geganti tersebut mengaktifkannya. Ia tidak boleh digunakan pada geganti lalai. Terdapat tempoh penyimpanan, jadi dapatkan semula sebelum tempoh tamat.

Kandungan sandaran dienkripsi. Pelayan di destinasi simpanan hanya mengendalikan teks sifer.

### Cara memulihkan

Pada peranti baharu, pulihkan menggunakan fail sandaran (atau sandaran di pelayan geganti) dan frasa laluan yang telah anda tetapkan.

### Perhatian

- **Jika anda lupa frasa laluan, pemulihan tidak boleh dilakukan.** Pencipta pun tidak boleh membaikinya. Catatkan frasa laluan di tempat lain.
- **Identiti pakai buang tidak akan kembali melalui sandaran mahupun pemulihan.**
- Buat semula sandaran apabila identiti bertambah atau anda menukar peranti.

---

## 9. Peti simpanan dan cara berfikir tentang kos

- Surat semasa pihak lain di luar talian diletakkan dalam keadaan terenkripsi di dalam "peti simpanan" pelayan geganti (maksimum 7 hari).
- Geganti mempunyai had untuk mencegah penyalahgunaan (kuantiti dan kekerapan yang boleh disimpan). Apabila had dicapai, surat baharu tidak boleh disimpan untuk tempoh tersebut, tetapi **surat yang telah sampai tidak akan hilang**. Skrin akan memaparkan sebab dan masa menunggu.
- Had boleh ditentukan sendiri jika anda meletakkannya pada pelayan anda sendiri.

Skop rekod yang kekal di pihak pelayan (semuanya dipadam secara automatik, dan kandungannya tidak boleh dibaca):

| Perkara | Tempoh kekal |
|---|---|
| Surat yang belum dihantar | Maksimum 7 hari |
| Isyarat sambungan | 5 minit |
| Rekod alamat dan peranti | 90 hari |
| Maklumat kumpulan / langganan pemberitahuan | 30 hari |

---

## 10. Cara mengemas kini (versi desktop)

1. Apabila terdapat versi baharu, notis akan dipaparkan pada skrin.
2. Apabila anda menekan "Muat turun", ia akan mengambil versi baharu (tidak dipasang secara automatik).
3. Apabila muat turun selesai, tekan "Pasang" dan mulakan semula.

Jika kemas kini gagal di tengah jalan (seperti nilai semakan fail tidak sepadan), **kemas kini akan dihentikan dan sebabnya dipaparkan pada skrin**. Pengembalian kepada versi lama tidak boleh dilakukan.

---

## 11. Apabila menghadapi masalah

| Gejala | Perkara untuk disemak |
|---|---|
| Mesej tidak boleh dihantar | Semak sama ada masa peranti tidak lari. Jika masa lari, penghantaran akan gagal. |
| Tidak sampai kepada pihak lain | Ia menunggu di peti simpanan sehingga pihak lain membuka aplikasi (maksimum 7 hari). |
| Fail tidak boleh dihantar | Semak sama ada ia melebihi had saiz (1 lawan 1 ialah 50MB, kumpulan kira-kira 50KB), atau disekat sebagai format berbahaya. |
| Kod pengesahan panggilan tidak sepadan | Tamatkan panggilan dan buat panggilan semula. Jangan teruskan dalam keadaan tidak sepadan. |
| Lupa frasa laluan | Pemulihan tidak boleh dilakukan. Buat identiti baharu dan beritahu semula kepada pihak lain. |
| Kehilangan peranti | Jika ada sandaran, anda boleh memulihkan pada peranti baharu. Jika tiada, ia menjadi identiti baharu. |
| Halaman percubaan tidak boleh dibuka (404) | Kini dihentikan. Sila gunakan versi aplikasi. |

Laporan pepijat boleh dibuat ke [halaman Issue](https://github.com/shizukutanaka/Breeze/issues).

---

## 12. Janji Breeze

- Kami tidak memaparkan iklan. Tidak di dalam aplikasi, tidak di mana-mana.
- Kami tidak menjejaki anda. Tiada analisis penggunaan, tiada mekanisme pengiklanan, tiada penjualan data langsung.
- Pencipta tidak memegang data pengguna. Di pihak pelayan, senarai akaun itu sendiri tidak wujud.
- Perbualan dienkripsi antara peranti. Pelayan hanya mengendalikan sampul yang tidak boleh dibacanya.

Perbandingan terperinci dengan pengirim mesej lain ditulis di "halaman perbandingan" repositori, termasuk perkara di mana Breeze kalah (bilangan pengguna, belum menerima audit luar, dan sebagainya).

---

*Manual ini ialah kandungan pada masa Breeze v3.8.0.*
