# Breeze Təlimatı

**Başqa dildə oxuyun / Read in another language**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · Azərbaycan (bu səhifə) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze telefon nömrəsi də, qeydiyyat da tələb olunmayan şifrələnmiş messencerdir.
Söhbətin məzmununu yalnız göndərən və qəbul edən oxuya bilər. Onu yolda daşıyan server belə oxuya bilməz.
Bütün funksiyalar pulsuzdur və reklam yoxdur.

Bu təlimat istifadəyə başlayanlar üçün bələdçidir.

---

## 1. Başlamaq

### Əldə etmək

[Yükləmə səhifəsindən](https://github.com/shizukutanaka/Breeze/releases/latest) cihazınıza uyğun olanı seçin.

- Windows: adı `-win-x64.exe` ilə bitən (ARM cihazları üçün də var)
- Mac: adı `-mac.dmg` ilə bitən
- Linux: `.AppImage` (birbaşa icra oluna bilər) və ya `.deb`
- Brauzerdə istifadə edirsinizsə, öz serverinizə yerləşdirdiyinizdən istifadə edin (yerləşdirmə addımları ayrıca sənəddə, «Yerləşdirmə təlimatı»nda verilib) Standart quraşdırma Cloudflare-dan istifadə edir, buna görə Cloudflare hesabı tələb olunur.

Hər fayla yoxlama rəqəmi (SHA256SUMS.txt) əlavə olunub. İstəsəniz, yüklədiyiniz faylın rəqəminin uyğun gəlib-gəlmədiyini yoxlaya bilərsiniz.

> **Nümunə səhifəsi haqqında**: Necə işlədiyini yoxlamaq üçün nümunə (https://breeze-469.pages.dev/) təqdim olunur. Orada yerləşdirilən eyni proqramdır, lakin nümunə xəbərdarlıq edilmədən dəyişə və ya dayana bilər. Həqiqi istifadə üçün öz serverinizə yerləşdirdiyiniz nüsxədən istifadə edin. Nümunə dayansa, öz serverinizə yerləşdirdiyiniz təsirlənmir.

### İlkin quraşdırma

1. Tətbiqi açın.
2. «Təsadüfi ID ilə başla» düyməsini basın. Hazırlıq bununla bitir. Nə qeydiyyat, nə də telefon nömrəsi lazımdır.

- Düymənin üstündəki sahəyə «Adınız (göstərilən ad)» daxil etsəniz, həmin adla başlayırsınız. Sahəni boş qoyub düyməni də basa bilərsiniz. Göstərilən adı sonra parametrlərin profil bölməsində dəyişə bilərsiniz.
- Özünüz seçdiyiniz ad və Breeze ID-si ilə şəxsiyyət yaratmağın da yolu var. Bu halda bərpa ifadəsi verilir və ekranda göstərilir. Bərpa ifadəsi həmin şəxsiyyəti başqa cihazda geri qaytarmağa imkan verən sözlərdir. Onu kağıza və ya təhlükəsiz yerə yazın.
- Əvvəllər yaratdığınız şəxsiyyəti geri qaytarmaq istəyirsinizsə, «Mövcud hesabı bərpa et» bölməsini açın və bərpa üsulları (ehtiyat nüsxə faylından bərpa et, bərpa ifadəsi ilə bərpa et, hesab + parol ifadəsi ilə bərpa et) görünəcək.
- Yaratma bitəndə açarınızı parol ifadəsi ilə qorumağa yönəldən kart görünür (bir müddət sonra yox olmur). Vacib şəxsiyyət üçün təlimata əməl edin və qorumanı əlavə edin.

Bu zaman cihazınızın içində «açar» yaradılır. O, sizin şəxsiyyətinizin özüdür.
**Hesabların siyahısı serverdə yoxdur.** Şəxsiyyət yalnız sizin cihazınızdadır.
Bu məqam ehtiyat nüsxə fəslində (9) vacib olacaq.

### Keçmiş «birdəfəlik şəxsiyyət» haqqında

«Birdəfəlik şəxsiyyət» — heç bir bərpa vasitəsi olmayan şəxsiyyət — artıq yoxdur. Hazırkı şəxsiyyət yaratma üsulları ilə hər şəxsiyyət ehtiyat nüsxə ilə qoruna bilər.

---

## 2. Qarşı tərəflə qoşulmaq

Kontaktlar ekranında «Dost əlavə et» düyməsini basın və üç seçim görünəcək.

- **Kontakt əlavə et**: Qarşı tərəfin ID-sini daxil edin və ya QR kodu skan edin.
- **Dostu dəvət et**: Dəvət linkini kopyalayıb adi əlaqə vasitənizlə (e-poçt və s.) göndərin. Qarşı tərəf linki açıb adını daxil etsə, dərhal söhbət edə bilərsiniz.
- **Qrup yarat**: Qrup yaratmaq üçün sadəcə qrup adını daxil edin (fəsil 4).

Öz ID-niz öz profilinizi açanda tam formada göstərilir və olduğu kimi kopyalaya bilərsiniz. Yalnız qısa ID-ni deyil, tam ID-ni də verə bilərsiniz.

Qarşı tərəf də tətbiqi açıbsa, birbaşa qoşulub söhbət edə bilərsiniz.

---

## 3. Söhbət

- Sadəcə mesaj yazıb göndərin. Şəkil, stiker və məkan da göndərmək olar.
- Daxiletmə sahəsinin yanındakı «+» işarəsini açın və fayl qoşmaları, səsli mesajlar, səsli daxiletmə, məkan məlumatı, stikerlər, «cavab tələb olunmur» parametri və daha çoxu birlikdə görünəcək.
- **Fayl göndərmə**: Təkbətək söhbətlərdə ən çox 50MB-a qədər. Qruplarda təxminən 50KB-a qədər, daha kiçikdir.
- İcra olunan fayllar kimi təhlükəli formatlar avtomatik bloklanır.
- Qarşı tərəf tətbiqi açmayıbsa, məktub şifrələnmiş halda «saxlama qutusuna» qoyulur və o, tətbiqi açanda çatdırılır. Saxlama qutusunu daşıyan server məzmunu oxuya bilməz. Çatdırıla bilməyən məktublar **ən geci 7 günə** avtomatik silinir.
- Söhbət tarixçəsini fayla ixrac etmək və ya idxal etmək olar.

### Ekranı oxumaq

- **Göndərmə vəziyyəti**: Mesajın yanındakı işarədən anlaya bilərsiniz. ✓ göndərilib deməkdir, dairə içindəki ✓ saxlama qutusuna qoyulub deməkdir, ✓✓ qarşı tərəfə çatıb deməkdir, oxunub mavi işarədir, uğursuzluq isə qırmızı işarədir. Onlar rənglə yanaşı forma ilə də fərqlənir.
- **Kontakt siyahısı**: Son danışdığınız vaxt bu gün üçün saat kimi, dünən üçün «Dünən», bu il üçün ay/gün, daha əvvəlkilər üçün il/ay/gün kimi göstərilir. Oxunmamış mesajları olan kontaktların adı və vaxtı vurğulanır.
- **Kontaktlar üçün adlar**: «Kontakt məlumatı»nı açın (kontaktın sağ klik menyusunda və ya söhbətin «⋮» menyusunda) və həmin kontakt üçün öz adınızı təyin edə bilərsiniz (ləqəb). Ləqəblər yalnız bu cihazda saxlanılır və heç vaxt kontakta və ya ötürücü serverə göndərilmir. Ləqəb təyin edəndə kontaktın özü üçün təyin etdiyi ad da yanında solğun rənglə göstərilir. Həmin ikinci adı parametrlərin «Məxfilik» bölməsindəki «Hər kontaktın özü üçün təyin etdiyi adı da göstər» ilə söndürə bilərsiniz.
- **Öz kartınız**: Siyahının yuxarısında öz profil kartınız var; profilinizi açmaq üçün ona basın. Siyahı ilə birlikdə sürüşür.
- **Telefonda alt vərəqlər**: Telefon enində ekranın alt hissəsində «Kontaktlar» və «Parametrlər» vərəqləri görünür.
- **Söhbət başlığı**: Axtarış nişanından söhbət daxilində axtarış edə bilərsiniz. «⋮» menyusundan təhlükəsizlik nömrəsini yoxlaya, bildirişləri susdura, bərkidə, sorğu yarada və daha çoxunu edə bilərsiniz.

### Əmrlər

Daxiletmə sahəsinə `/` yazın və əmr təklifləri görünəcək. İstifadə edə biləcəyiniz əmrlərin siyahısını görmək üçün `/help` yazın (71 növ).
Parametrlər və cihazların əlaqələndirilməsi kimi bəzi əməliyyatlar əmrlərdən yerinə yetirilir.

---

## 4. Qruplar

- Qrupa ən çox **1.000 nəfər** daxil ola bilər.
- Yaratmaq üçün «Dost əlavə et» bölməsindəki «Qrup yarat» altında sadəcə qrup adını daxil edin (həmçinin `/newgroup` əmri ilə də yarada bilərsiniz). Dəvət «qrup dəvət linki»ndən edilir. Linki alan şəxs adını daxil edib qoşula bilər.
- Qruplarda da fayl göndərmək olur, lakin limit təxminən 50KB ilə kiçikdir. Səsli mesajlar qruplarda hələ göndərilə bilmir.
- Köhnə versiyalı tətbiqdən istifadə edən üzv varsa, həmin qrupda daha təhlükəsiz yeni üsul (qrup v5) istifadə oluna bilmir və ekranda xəbərdarlıq görünür. Hamı ən son versiyaya keçəndə aktivləşir.

---

## 5. Zənglər

- Təkbətək səsli zənglər və videozənglər etmək olar. Qrup zəngləri də var (ən çox 8 nəfər).
- **Zəng yoxlama kodu**: Zəng ekranında yoxlama kodu göstərilir. Qarşı tərəflə birlikdə ucadan oxuyub hər iki ekranda uyğun gəldiyini yoxlayın. Uyğun gəlmirsə, kimsə yolda dinləyir ola bilər. Belə halda zəngi kəsin.
- Qrup zəngləri bütün iştirakçıların tətbiqi ən son versiyada olmadıqda başlana bilməyə bilər.

---

## 6. Bir neçə cihaz və hesab

- Eyni şəxsiyyəti bir neçə cihazda istifadə etmək üçün `/link` əmri ilə cihazları əlaqələndirin.
- Hesabları bir neçə yaradıb ayrı-ayrı istifadə etmək olar (məsələn, iş və şəxsi). Həm cihaz sayı, həm də hesab sayı pulsuz və limitsizdir.
- **Hesab necə yaradılır**: Kontakt siyahısının ən yuxarısındakı hesab vərəqlərinin yanındakı «+» düyməsini basın. Ad daxil edib emoji nişanı seçin, yeni hesab yaradılacaq və avtomatik ona keçiləcək.
- **Hesabları dəyişmək**: Hesab vərəqləri həmişə kontakt siyahısının ən yuxarısında göstərilir. Keçmək üçün birinə basın (kompüterdə Ctrl+1–9 ilə də keçə bilərsiniz). Vərəqi basıb saxlayaraq adını dəyişə, nişanını dəyişə və ya silə bilərsiniz.
- Kontaktlar və açarlar hər hesab üçün ayrıdır. Hər hesab üçün kontaktları yenidən mübadilə edin.
- Dil ingilis dili daxil olmaqla 51 dildən cihazınızın dilinə uyğun avtomatik seçilir.

---

## 7. Təhlükəsizliyi qoruyan parametrlər

Parametrlər öz ekranı kimi açılır. Telefonda onları ekranın alt hissəsindəki «Parametrlər» vərəqindən, kompüterdə ekrandakı dişli düyməsindən açın (həmçinin `/settings` əmri ilə də aça bilərsiniz). Olduğunuz ekrana qayıtmaq üçün geri əməliyyatından istifadə edin.

- **Avtomatik kilid**: Vərəqi dəyişəndə avtomatik kilidləyən parametr var.
- **Açar parol ifadəsi**: Cihazın içindəki açarı parol ifadəsi ilə sarıyıb qorumaq olar. Tətbiqi açanda daxil etməyiniz istənilir.
- **Hər kontaktın özü üçün təyin etdiyi adı da göstər**: «Məxfilik» bölməsində. Ləqəb verdiyiniz kontakt üçün onun öz adının yanında göstərilib-göstərilməməsini seçə bilərsiniz (fəsil 3).
- **Bloklama**: Narahat edən şəxsləri bloklamaq olar. Bloklanmış şəxslərdən əlaqə gəlmir.

---

## 8. Batareya və fövqəladə hallar (enerji rejimləri)

«Enerji rejimi» parametrində batareyanın necə istifadə olunacağını seçə bilərsiniz.

- **Avtomatik (batareya səviyyəsi)**: Nə qədər batareya qaldığına görə avtomatik dəyişir.
- **Normal**: Həmişəki kimi.
- **Enerjiyə qənaət**: Çatdırılma yoxlamalarını ən çox 60 saniyədə bir dəfəyə qədər seyrəldir və mövcudluq siqnalını dayandırır.
- **Fövqəladə (fəlakətlər üçün)**: Çatdırılma yoxlamalarını ən çox 10 dəqiqədə bir dəfəyə qədər seyrəldir. Fəlakətdə və ya enerji doldura bilmədiyiniz digər vaxtda istifadə edin.

Batareyanı tükədən rabitə miqdarı deyil, radionun oyanma sayıdır. Buna görə göndərən tərəf seyrəldilmir; yalnız dinləyən tərəf seyrəldilir. Göndərmə həmişəki kimi dərhal çıxır. Enerji doldurmağa başlayanda avtomatik bir addım yüngül tərəfə qayıdır.

Batareya səviyyəsini avtomatik oxuya bilməyən cihazlarda (iPhone brauzeri kimi) «Avtomatik» Normal kimi davranır, əl ilə seçim isə seçildiyi kimi işləyir.

---

## 9. Ehtiyat nüsxə və bərpa (ən vacib fəsil)

Breeze şəxsiyyəti yalnız cihazınızdakı açardır. Serverdə hesabların siyahısı yoxdur və yaradanın da sizin açarınız yoxdur.
**Cihazı itirsəniz, şəxsiyyəti də itirirsiniz.** Vacib şəxsiyyətlər üçün mütləq ehtiyat nüsxə yaradın.

Ehtiyat nüsxə və bərpa parametrlərin «Ehtiyat nüsxə və bərpa» bölməsindən edilir (düymələr «Ehtiyat nüsxə yarat», «Ehtiyat nüsxəni bərpa et» və «Fayldan bərpa et»dir). Kontaktı ilk dəfə əlavə edəndə ehtiyat nüsxə yaratmağa çağıran kart yalnız bir dəfə görünür.

### Avtomatik ehtiyat nüsxə

«Avtomatik ehtiyat nüsxə» parametri əvvəldən açıqdır. Məlumatlarınız dəyişəndə şifrələnmiş ehtiyat nüsxə avtomatik olaraq yerləşdirdiyiniz ötürücü serverə göndərilir.

- Hər dəyişiklikdə göndərmir: son dəyişiklikdən sonra 30 saniyə gözləyir və hamısını birlikdə göndərir. Cəhdlər ən azı 15 dəqiqə ara ilə edilir.
- Oflayn olanda heç nə göndərilmir; dəyişikliklər saxlanılır və bağlantı qayıdanda və tətbiqi açanda göndərilir.
- Avtomatik göndərmə üçün ehtiyat nüsxə parol ifadəsini həmin cihazda bir dəfə daxil etməlisiniz (lazım olanda parametrlər bölməsində «Parol ifadəsini daxil et» düyməsi görünür). **Parol ifadəsi saxlanılmır.** Yalnız tətbiq açıq olanda yadda qalır, bağlayanda yox olur. Sadə bərpa şəxsiyyəti üçün qeydiyyat və ya yeniləmə zamanı parol ifadəsini daxil etdikdən dərhal sonra göndərmə olduğu kimi işləyir.
- Ötürücü server ehtiyat nüsxələri saxlamağı dəstəkləmirsə, avtomatik ehtiyat nüsxə işləmir. Bu, parametrlər bölməsində göstərilir.
- Vəziyyət (son uğurlu göndərmənin vaxtı, dəyişikliklərin gözləyib-gözləmədiyi, göndərmənin uğursuz olub-olmadığı) parametrlər bölməsində göstərilir.

### Ehtiyat nüsxə yaratmaq (əl ilə)

1. Parametrlərdəki «Yedəkləmə və bərpa» bölməsindən «Ehtiyat nüsxə yarat» seçin.
2. Ehtiyat nüsxə üçün parol ifadəsi təyin edin (6 simvol və ya daha çox).
3. Saxlama yerini seçin.
   - **Fayla saxlamaq**: Ehtiyat nüsxə faylını özünüzdə saxlayın (tövsiyə olunur).
   - **Ötürücü serverə saxlamaq**: Yalnız həmin ötürücünün operatoru aktivləşdiribsə istifadə oluna bilər. Standart ötürücüdə istifadə oluna bilməz. Saxlama müddəti var, müddət bitməmiş geri alın.

Ehtiyat nüsxənin məzmunu şifrələnib. Saxlama yerindəki serverin işlədiyi yalnız şifrələnmiş mətndir.

### Bərpa qaydası

Yeni cihazda ehtiyat nüsxə faylından (və ya ötürücü serverdəki ehtiyat nüsxədən) və təyin etdiyiniz parol ifadəsindən istifadə edərək bərpa edin.

Şəxsiyyətinizi bərpa ifadəsi ilə indicə geri qaytarmısınızsa və həmin şəxsiyyətin ehtiyat nüsxəsi ötürücü serverdədirsə, o avtomatik tapılır və «Ehtiyat nüsxə tapıldı» ilə soruşulur. Onu bərpa etsəniz, bu cihazda olan məlumatlar ehtiyat nüsxənin məzmunu ilə əvəz olunur.

### Yeni cihaza keçmək

Parametrlərin «Yedəkləmə və bərpa» bölməsində «Yeni cihaza keç» düyməsini bassanız, addımlar göstərilir.

1. Hazırkı cihazınızda ehtiyat nüsxəni ötürücü serverdə saxlayın (avtomatik ehtiyat nüsxə və ya «Ehtiyat nüsxə yarat»).
2. Yeni cihazda ilk ekranda bərpa üsulunu seçin və bərpa ifadənizi daxil edin (və ya hesab adınızı və parol ifadənizi).
3. Şəxsiyyətiniz geri qayıdanda serverdəki ehtiyat nüsxə avtomatik tapılır və bərpa təklif olunur.

Heç bir kabel və ya fayl ötürməsi lazım deyil.

### Qeydlər

- **Parol ifadəsini unutsanız, bərpa mümkün deyil.** Yaradan da düzəldə bilməz. Parol ifadəsini başqa yerdə yazıb saxlayın.
- Avtomatik ehtiyat nüsxə üçün parol ifadəsini daxil etmək hər cihazda lazımdır. Yeni cihazda onu bir dəfə də daxil edin.
- Şəxsiyyətləriniz artanda və ya cihaz dəyişəndə əl ilə ehtiyat nüsxəni yenidən yaradın.

---

## 10. Saxlama qutusu və xərc yanaşması

- Qarşı tərəf oflayn olanda məktublar ötürücü serverin «saxlama qutusunda» şifrələnmiş halda saxlanılır (ən çox 7 gün).
- Ötürücüdə sui-istifadənin qarşısını almaq üçün limitlər var (saxlanıla bilən həcm və tezlik). Limitə çatanda həmin müddət ərzində yeni məktublar saxlanıla bilmir, lakin **artıq çatdırılmış məktublar heç vaxt silinmir**. Ekranda səbəb və gözləmə müddəti göstərilir.
- Öz serverinizə yerləşdirmisinizsə, limiti özünüz müəyyən edə bilərsiniz.

Server tərəfində qalan qeydlərin əhatəsi (hamısı avtomatik silinir və məzmun oxuna bilməz):

| Element | Qalma müddəti |
|---|---|
| Çatdırılmamış məktublar | Ən çox 7 gün |
| Qoşulma siqnalları | 5 dəqiqə |
| Ünvan və cihaz qeydləri | 90 gün |
| Qrup məlumatları və bildiriş abunəlikləri | 30 gün |

---

## 11. Yeniləmə qaydası (masaüstü versiya)

1. Yeni versiya olanda ekranda bildiriş görünür.
2. «Yüklə» düyməsini bassanız, yeni versiya endirilir (avtomatik quraşdırılmır).
3. Yükləmə bitəndə «Quraşdır» düyməsini basıb yenidən başladın.

Yeniləmə zamanı xəta baş verərsə (fayl yoxlaması uyğun gəlməzsə və s.), **yeniləmə dayandırılır və səbəb ekranda göstərilir**. Köhnə versiyaya geri qayıtmaq mümkün deyil.

---

## 12. Problem yarananda

| Əlamət | Yoxlanılacaq şey |
|---|---|
| Mesaj göndərilə bilmir | Cihazın saatının səhv olub-olmadığını yoxlayın. Saat səhvdirsə, göndərmə uğursuz olur. |
| Qarşı tərəfə çatmır | Qarşı tərəf tətbiqi açana qədər saxlama qutusunda gözləyir (ən çox 7 gün). |
| Fayl göndərilə bilmir | Ölçü limitini (təkbətək 50MB, qruplarda təxminən 50KB) aşmadığınızı və təhlükəli format kimi bloklanmadığını yoxlayın. |
| Zəng yoxlama kodu uyğun gəlmir | Zəngi kəsin və yenidən zəng edin. Uyğun gəlmədiyi halda davam etməyin. |
| Parol ifadəsini unutmusunuz | Bərpa mümkün deyil. Yeni şəxsiyyət yaradın və qarşı tərəfə yenidən bildirin. |
| Cihazı itirmisiniz | Ehtiyat nüsxəniz varsa, yeni cihazda bərpa edə bilərsiniz. Yoxdursa, yeni şəxsiyyət yaranır. |
| Nümunə səhifəsi açılmır | Nümunə xəbərdarlıq edilmədən dayana bilər. Zəhmət olmasa öz serverinizə yerləşdirdiyiniz nüsxədən istifadə edin. |

Xəta hesabatlarını [Issue səhifəsinə](https://github.com/shizukutanaka/Breeze/issues) göndərin.

---

## 13. Breeze-in vədləri

- Reklam göstərmirik. Nə tətbiqin içində, nə də başqa yerdə.
- İzləmirik. İstifadə analitikası, reklam mexanizmləri və məlumat satışı qətiyyən yoxdur.
- Yaradan istifadəçilərin məlumatlarını saxlamır. Server tərəfində hesabların siyahısı belə yoxdur.
- Söhbətlər cihazlar arasında şifrələnir. Serverin işlədiyi yalnız oxuna bilməyən zərflərdir.

Digər messencerlərlə ətraflı müqayisə repozitoriyadakı «müqayisə səhifəsində», Breeze-in geri qaldığı məqamlar (istifadəçi sayı, xarici auditdən keçməməsi və s.) daxil olmaqla yazılıb.

---

*Bu təlimat Breeze-in 2026-11-25 tarixinə olan vəziyyətini əks etdirir.*
