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
- Jika menggunakan dalam pelayar, gunakan yang telah diletakkan pada pelayan anda sendiri (langkah pemasangan ada dalam dokumen berasingan "Panduan pemasangan"). Persediaan standard menggunakan Cloudflare, jadi akaun Cloudflare diperlukan

Setiap fail disertakan dengan nilai semakan (SHA256SUMS.txt). Jika anda bimbang, anda boleh menyemak sama ada nilai fail yang dimuat turun sepadan.

### Persediaan pertama

1. Buka aplikasi.
2. Tekan "Mulakan dengan ID rawak". Itu sahaja persediaannya. Tiada pendaftaran, tiada nombor telefon diperlukan.

- Jika anda memasukkan "Nama anda (nama paparan)" dalam medan di atas butang, anda bermula dengan nama itu. Anda juga boleh menekan butang dengan medan dibiarkan kosong. Anda boleh menukar nama paparan kemudian, dalam bahagian profil tetapan.
- Terdapat juga cara untuk membuat identiti dengan nama dan Breeze ID yang anda pilih sendiri. Dalam kes itu, frasa pemulihan dikeluarkan dan dipaparkan pada skrin. Frasa pemulihan ialah kata-kata yang membolehkan anda mengembalikan identiti itu pada peranti lain. Catatkannya di atas kertas atau di tempat yang selamat.
- Jika anda ingin mengembalikan identiti yang pernah anda buat sebelum ini, buka "Pulihkan akaun sedia ada" dan cara pemulihan (pulihkan daripada fail sandaran, pulihkan dengan frasa pemulihan, pulihkan dengan akaun + frasa laluan) akan muncul.
- Apabila penciptaan selesai, sebuah kad muncul yang memandu anda untuk melindungi kunci anda dengan frasa laluan (ia tidak hilang selepas beberapa ketika). Untuk identiti yang penting, ikuti panduan tersebut dan tambahkan perlindungannya.

Pada masa ini, sebuah "kunci" dicipta di dalam peranti. Itulah identiti anda sendiri.
**Senarai akaun tidak wujud di pelayan.** Identiti hanya berada di dalam peranti anda.
Perkara ini menjadi penting dalam bab sandaran (9).

### Tentang "identiti pakai buang" yang dahulu

"Identiti pakai buang" — identiti yang tiada sebarang cara pemulihan langsung — sudah tiada. Dengan cara penciptaan identiti semasa, setiap identiti boleh dilindungi dengan sandaran.

---

## 2. Berhubung dengan pihak lain

Tekan butang "Tambah rakan" pada skrin kenalan dan tiga pilihan akan muncul.

- **Tambah kenalan**: Masukkan ID pihak lain, atau imbas kod QR.
- **Jemput rakan**: Salin pautan jemputan dan hantar melalui cara hubungan biasa anda (e-mel dan sebagainya). Apabila pihak lain membuka pautan dan memasukkan nama, anda boleh terus berbual.
- **Buat kumpulan**: Hanya masukkan nama kumpulan untuk membuatnya (bab 4).

ID anda sendiri dipaparkan dalam bentuk lengkapnya apabila anda membuka profil anda sendiri, dan anda boleh menyalinnya seperti sedia ada. Anda boleh menyerahkan ID lengkap, bukan ID ringkas sahaja.

Jika pihak lain juga membuka aplikasi, anda boleh berhubung secara terus dan berbual.

---

## 3. Perbualan

- Hanya masukkan mesej dan hantar. Gambar, pelekat dan maklumat lokasi juga boleh dihantar.
- Buka "+" di sebelah medan input dan lampiran fail, mesej suara, input suara, maklumat lokasi, pelekat, tetapan "tiada balasan diperlukan", dan lain-lain akan muncul bersama.
- **Penghantaran fail**: Dalam perbualan 1 lawan 1, sehingga maksimum 50MB. Dalam kumpulan, lebih kecil iaitu kira-kira 50KB.
- Fail dalam format berbahaya seperti fail boleh laksana akan disekat secara automatik.
- Apabila pihak lain tidak membuka aplikasi, mesej diletakkan dalam keadaan terenkripsi di dalam "peti simpanan", dan akan dihantar apabila mereka membukanya. Pelayan yang membawa peti simpanan tidak boleh membaca kandungannya. Surat yang tidak sampai akan dipadam secara automatik selepas **maksimum 7 hari**.
- Sejarah perbualan boleh dieksport ke fail atau diimport.

### Membaca skrin

- **Status penghantaran**: Boleh diketahui daripada tanda di sebelah mesej. ✓ bermaksud telah dihantar, ✓ di dalam bulatan bermaksud telah disimpan dalam peti simpanan, ✓✓ bermaksud telah sampai kepada pihak lain, telah dibaca ialah tanda biru, dan gagal ialah tanda merah. Tanda-tanda itu dibezakan melalui bentuk selain warna.
- **Senarai kenalan**: Masa terakhir anda berbual dipaparkan sebagai masa untuk hari ini, "Semalam" untuk semalam, bulan/hari untuk tahun ini, dan tahun/bulan/hari untuk yang lebih awal. Kenalan yang mempunyai mesej belum dibaca akan ditonjolkan nama dan masanya.
- **Nama untuk kenalan**: Buka "Maklumat kenalan" (dalam menu klik kanan pada kenalan, atau menu "⋮" perbualan) dan anda boleh menetapkan nama anda sendiri untuk kenalan itu (nama panggilan). Nama panggilan disimpan hanya pada peranti ini dan tidak pernah dihantar kepada kenalan atau pelayan geganti. Apabila anda menetapkan nama panggilan, nama yang ditetapkan oleh kenalan itu untuk diri mereka sendiri juga dipaparkan di sebelahnya dengan warna yang malap. Anda boleh mematikan nama kedua itu dengan "Tunjukkan juga nama yang ditetapkan oleh setiap kenalan untuk diri mereka sendiri" dalam bahagian "Privasi" tetapan.
- **Kad anda sendiri**: Di bahagian atas senarai ialah kad profil anda sendiri; tekan untuk membuka profil anda. Ia menatal bersama senarai.
- **Tab bawah pada telefon**: Pada lebar telefon, lima tab muncul di bahagian bawah skrin: "Sembang", "Panggilan", "Kenalan", "Kad saya" dan "Tetapan". Tab mana yang dipaparkan boleh anda pilih satu demi satu di "Tab bawah" dalam tetapan (Sembang sentiasa dipaparkan. Walaupun anda menyembunyikan tab Tetapan, anda masih boleh membuka tetapan dari butang gear pada skrin).
- **Pengepala perbualan**: Daripada ikon carian, anda boleh mencari di dalam perbualan. Daripada menu "⋮", anda boleh menyemak nombor keselamatan, menyenyapkan pemberitahuan, menyemat, membuat undian, dan lain-lain.

### Arahan

Menaip `/` dalam medan input akan memaparkan cadangan arahan. Taip `/help` untuk melihat senarai arahan yang boleh digunakan (71 jenis).
Sebahagian operasi seperti tetapan dan pautan peranti dilakukan melalui arahan.

---

## 4. Kumpulan

- Kumpulan boleh memuatkan sehingga **1,000 orang**.
- Cara membuatnya hanyalah memasukkan nama kumpulan pada "Buat kumpulan" dalam "Tambah rakan" (anda juga boleh membuatnya dengan arahan `/newgroup`). Jemputan dibuat dari "Pautan jemputan kumpulan". Orang yang menerima pautan boleh menyertai dengan memasukkan nama.
- Fail juga boleh dihantar dalam kumpulan, tetapi hadnya kecil iaitu kira-kira 50KB. Mesej suara belum boleh dihantar dalam kumpulan.
- Jika terdapat ahli yang menggunakan aplikasi versi lama, kaedah baharu yang lebih selamat (kumpulan v5) tidak boleh digunakan dalam kumpulan itu, dan amaran akan dipaparkan pada skrin. Ia menjadi aktif apabila semua orang menggunakan versi terkini.

---

## 5. Panggilan

- Panggilan suara dan panggilan video 1 lawan 1 boleh dibuat. Panggilan kumpulan juga ada (sehingga 8 orang).
- **Kod pengesahan panggilan**: Kod pengesahan dipaparkan pada skrin panggilan. Bacakan sesama anda dengan pihak lain, dan sahkan sama ada ia sepadan pada kedua-dua skrin. Jika tidak sepadan, ada kemungkinan seseorang sedang mencuri dengar di tengah jalan. Dalam kes itu, tamatkan panggilan.
- Panggilan kumpulan mungkin tidak boleh dimulakan jika aplikasi semua orang bukan versi terkini.
- **Sejarah panggilan**: Panggilan satu lawan satu meninggalkan sejarah hanya pada peranti ini (orang lain, sama ada panggilan itu keluar / masuk / terlepas, masa dan tempoh panggilan. Tiada apa-apa daripada yang dikatakan disimpan). Sejarah tidak pernah dihantar ke pelayan atau kepada orang lain. Sehingga 200 entri disimpan, dengan yang paling lama dibuang dahulu. Panggilan kumpulan tidak muncul dalam sejarah.
- Buka sejarah pada telefon dari tab "Panggilan". Apabila terdapat panggilan terlepas yang belum anda lihat, lencana nombor muncul pada tab Panggilan, dan ia hilang apabila anda membuka sejarah. Dari baris sejarah anda boleh membuka perbualan dengan orang itu atau menelefonnya semula. Anda boleh memadam keseluruhan sejarah dengan butang pada skrin.
- **Sejarah panggilan bukan sebahagian daripada sandaran.** Pada peranti baharu, sejarah bermula kosong. Jika anda tidak mahu sejarah disimpan, matikan "Simpan sejarah panggilan pada peranti ini" di bahagian "Privasi" dalam tetapan, dan rakaman itu sendiri berhenti.

---

## 6. Berbilang peranti dan akaun

- Untuk menggunakan identiti yang sama pada berbilang peranti, pautkan peranti sesama sendiri dengan arahan `/link`.
- Akaun boleh dibuat berbilang dan digunakan secara berasingan (seperti untuk kerja dan peribadi). Bilangan peranti dan akaun kedua-duanya percuma dan tanpa had.
- **Cara membuat akaun**: Tekan butang "+" di sebelah tab akaun di bahagian paling atas senarai kenalan. Masukkan nama dan pilih emoji ikon, maka akaun baharu dibuat dan ditukar secara automatik kepadanya.
- **Menukar akaun**: Tab akaun sentiasa dipaparkan di bahagian paling atas senarai kenalan. Tekan satu tab untuk menukar (pada komputer, anda juga boleh menukar dengan Ctrl+1–9). Tekan dan tahan tab untuk menamakan semula, menukar ikonnya, atau memadamnya.
- Kenalan dan kunci adalah berasingan bagi setiap akaun. Bertukar kenalan semula bagi setiap akaun.
- Bahasa dipilih secara automatik daripada 51 bahasa, termasuk Bahasa Inggeris, mengikut bahasa peranti anda.

---

## 7. Tetapan untuk kekal selamat

Tetapan dibuka sebagai skrinnya sendiri. Pada telefon, buka dari tab "Tetapan" di bahagian bawah skrin; pada komputer, dari butang gear pada skrin (anda juga boleh membukanya dengan arahan `/settings`). Gunakan tindakan kembali untuk kembali ke skrin sebelumnya.

- **Kunci automatik**: Terdapat tetapan untuk mengunci secara automatik apabila anda menukar tab.
- **Frasa laluan kunci**: Kunci di dalam peranti boleh dilindungi dengan membalutnya dalam frasa laluan. Anda akan diminta memasukkannya apabila membuka aplikasi.
- **Tunjukkan juga nama yang ditetapkan oleh setiap kenalan untuk diri mereka sendiri**: Dalam bahagian "Privasi". Bagi kenalan yang telah anda berikan nama panggilan, anda boleh memilih sama ada nama mereka sendiri dipaparkan di sebelahnya (bab 3).
- **Sekat**: Pihak yang mengganggu boleh disekat. Hubungan daripada pihak yang disekat tidak akan sampai.
- **Sama ada sejarah panggilan disimpan**: Dengan "Simpan sejarah panggilan pada peranti ini" di bahagian "Privasi", anda boleh menghentikan rakaman sejarah panggilan (bab 5).
- **Keterlihatan tab bawah**: Di bahagian "Tab bawah" anda boleh memaparkan atau menyembunyikan tab bawah telefon (Panggilan / Kenalan / Kad saya / Tetapan) satu demi satu. Sembang sentiasa dipaparkan.

---

## 8. Bateri dan kecemasan (mod kuasa)

Dalam tetapan "Mod kuasa", anda boleh memilih cara bateri digunakan.

- **Automatik (paras bateri)**: Bertukar secara automatik mengikut baki bateri.
- **Biasa**: Seperti biasa.
- **Penjimatan kuasa**: Menjarakkan semakan penghantaran kepada paling kerap sekali setiap 60 saat, dan menghentikan isyarat kehadiran.
- **Kecemasan (untuk bencana)**: Menjarakkan semakan penghantaran kepada paling kerap sekali setiap 10 minit. Gunakan semasa bencana atau ketika anda tidak dapat mengecas.

Apa yang menghabiskan bateri bukanlah jumlah komunikasi tetapi kekerapan radio bangun. Jadi pihak yang menghantar tidak dijarakkan; hanya pihak yang mendengar. Penghantaran tetap keluar serta-merta, seperti biasa. Apabila anda mula mengecas, ia bergerak kembali satu langkah ke arah yang lebih ringan secara automatik.

Pada peranti yang tidak dapat membaca paras bateri secara automatik (seperti pelayar iPhone), "Automatik" berkelakuan sebagai Biasa, dan pilihan manual berfungsi seperti yang dipilih.

---

## 9. Sandaran dan pemulihan (bab yang paling penting)

Identiti Breeze hanyalah kunci di dalam peranti anda. Senarai akaun tidak wujud di pelayan, dan pencipta pun tidak mempunyai kunci anda.
**Jika anda kehilangan peranti, identiti juga akan hilang.** Untuk identiti yang penting, pastikan anda membuat sandaran.

Sandaran dan pemulihan dilakukan dari bahagian "Sandaran dan pemulihan" dalam tetapan (butangnya ialah "Cipta Sandaran", "Pulihkan Sandaran", dan "Pulihkan daripada fail"). Kali pertama anda menambah kenalan, kad yang menggesa anda membuat sandaran muncul sekali sahaja.

### Sandaran automatik

Tetapan "Sandaran automatik" dihidupkan dari mula. Apabila data anda berubah, sandaran terenkripsi dihantar secara automatik ke pelayan geganti yang anda hoskan.

- Ia tidak menghantar pada setiap perubahan: ia menunggu 30 saat selepas perubahan terakhir dan menghantar semuanya bersama. Percubaan dijarakkan sekurang-kurangnya 15 minit.
- Semasa anda di luar talian, tiada apa-apa dihantar; perubahan disimpan dan dihantar apabila sambungan kembali dan apabila anda membuka aplikasi.
- Untuk penghantaran automatik, anda perlu memasukkan frasa laluan sandaran sekali pada peranti itu (apabila diperlukan, butang "Masukkan frasa laluan" muncul dalam bahagian tetapan). **Frasa laluan tidak disimpan.** Ia hanya diingati semasa aplikasi terbuka, dan hilang apabila anda menutupnya. Untuk identiti pemulihan mudah, sejurus selepas anda memasukkan frasa laluan semasa pendaftaran atau kemas kini, penghantaran berfungsi seperti sedia ada.
- Jika pelayan geganti tidak menyokong penyimpanan sandaran, sandaran automatik tidak berjalan. Itu dipaparkan dalam bahagian tetapan.
- Keadaannya (bila penghantaran berjaya terakhir, sama ada perubahan sedang menunggu, sama ada penghantaran gagal) dipaparkan dalam bahagian tetapan.

### Cara membuat sandaran (manual)

1. Dari "Sandaran dan pemulihan" dalam tetapan, pilih "Cipta Sandaran".
2. Tetapkan frasa laluan untuk sandaran (6 aksara atau lebih).
3. Pilih destinasi simpanan.
   - **Simpan ke fail**: Simpan fail sandaran di tangan anda sendiri (disyorkan).
   - **Simpan ke pelayan geganti**: Hanya boleh digunakan jika pengendali geganti tersebut mengaktifkannya. Ia tidak boleh digunakan pada geganti lalai. Terdapat tempoh penyimpanan, jadi dapatkan semula sebelum tempoh tamat.

Kandungan sandaran dienkripsi. Pelayan di destinasi simpanan hanya mengendalikan teks sifer.

### Cara memulihkan

Pada peranti baharu, pulihkan menggunakan fail sandaran (atau sandaran di pelayan geganti) dan frasa laluan yang telah anda tetapkan.

Jika anda baru sahaja mengembalikan identiti anda dengan frasa pemulihan, dan sandaran identiti itu ada pada pelayan geganti, ia ditemui secara automatik dan anda ditanya dengan "Sandaran ditemui". Jika anda memulihkannya, data pada peranti itu digantikan dengan kandungan sandaran.

### Berpindah ke peranti baharu

Tekan butang "Pindah ke peranti baharu" dalam bahagian "Sandaran dan pemulihan" tetapan dan langkah-langkahnya dipaparkan.

1. Pada peranti semasa anda, simpan sandaran pada pelayan geganti (sandaran automatik, atau "Cipta Sandaran").
2. Pada peranti baharu, pilih cara pemulihan pada skrin pertama dan masukkan frasa pemulihan anda (atau nama akaun dan frasa laluan anda).
3. Apabila identiti anda kembali, sandaran pada pelayan ditemui secara automatik dan pemulihan ditawarkan.

Tiada kabel atau serahan fail diperlukan.

### Perhatian

- **Jika anda lupa frasa laluan, pemulihan tidak boleh dilakukan.** Pencipta pun tidak boleh membaikinya. Catatkan frasa laluan di tempat lain.
- Memasukkan frasa laluan untuk sandaran automatik diperlukan pada setiap peranti. Pada peranti baharu, masukkannya sekali lagi.
- Buat semula sandaran manual apabila identiti anda bertambah atau apabila anda menukar peranti.
- Sejarah panggilan bukan sebahagian daripada sandaran. Apabila anda menukar peranti, sejarah panggilan tidak berpindah ke peranti baharu.

---

## 10. Peti simpanan dan cara berfikir tentang kos

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

## 11. Cara mengemas kini (versi desktop)

1. Apabila terdapat versi baharu, notis akan dipaparkan pada skrin.
2. Apabila anda menekan "Muat turun", ia akan mengambil versi baharu (tidak dipasang secara automatik).
3. Apabila muat turun selesai, tekan "Pasang" dan mulakan semula.

Jika kemas kini gagal di tengah jalan (seperti nilai semakan fail tidak sepadan), **kemas kini akan dihentikan dan sebabnya dipaparkan pada skrin**. Pengembalian kepada versi lama tidak boleh dilakukan.

---

## 12. Apabila menghadapi masalah

| Gejala | Perkara untuk disemak |
|---|---|
| Mesej tidak boleh dihantar | Semak sama ada masa peranti tidak lari. Jika masa lari, penghantaran akan gagal. |
| Tidak sampai kepada pihak lain | Ia menunggu di peti simpanan sehingga pihak lain membuka aplikasi (maksimum 7 hari). |
| Fail tidak boleh dihantar | Semak sama ada ia melebihi had saiz (1 lawan 1 ialah 50MB, kumpulan kira-kira 50KB), atau disekat sebagai format berbahaya. |
| Kod pengesahan panggilan tidak sepadan | Tamatkan panggilan dan buat panggilan semula. Jangan teruskan dalam keadaan tidak sepadan. |
| Lupa frasa laluan | Pemulihan tidak boleh dilakukan. Buat identiti baharu dan beritahu semula kepada pihak lain. |
| Kehilangan peranti | Jika ada sandaran, anda boleh memulihkan pada peranti baharu. Jika tiada, ia menjadi identiti baharu. |

Laporan pepijat boleh dibuat ke [halaman Issue](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Janji Breeze

- Kami tidak memaparkan iklan. Tidak di dalam aplikasi, tidak di mana-mana.
- Kami tidak menjejaki anda. Tiada analisis penggunaan, tiada mekanisme pengiklanan, tiada penjualan data langsung.
- Pencipta tidak memegang data pengguna. Di pihak pelayan, senarai akaun itu sendiri tidak wujud.
- Perbualan dienkripsi antara peranti. Pelayan hanya mengendalikan sampul yang tidak boleh dibacanya.

Perbandingan terperinci dengan pengirim mesej lain ditulis di "halaman perbandingan" repositori, termasuk perkara di mana Breeze kalah (bilangan pengguna, belum menerima audit luar, dan sebagainya).

---

*Manual ini ialah kandungan pada 2026-11-25.*
