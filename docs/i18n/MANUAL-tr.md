# Breeze Kullanım Kılavuzu

**Başka bir dilde okuyun**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · Türkçe (bu sayfa) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze, telefon numarası ve kayıt gerektirmeyen şifreli bir mesajlaşma uygulamasıdır.
Konuşmaların içeriğini yalnızca gönderen ve alan kişi okuyabilir. Yolda taşıyan sunucu bile okuyamaz.
Tüm özellikler ücretsizdir ve reklam yoktur.

Bu kılavuz, kullanmaya başlayanlar için bir rehberdir.

---

## 1. Başlangıç

### Edinme

[İndirme sayfasından](https://github.com/shizukutanaka/Breeze/releases/latest), makinenize uyan birini seçin.

- Windows: adı `-win-x64.exe` ile biten (ARM makineler için olanı da var)
- Mac: adı `-mac.dmg` ile biten
- Linux: `.AppImage` (olduğu gibi çalıştırılabilir) veya `.deb`
- Tarayıcıda kullanmak için, kendi sunucunuza kurduğunuz kopyayı kullanırsınız (kurulum yöntemi ayrı "kurulum kılavuzu" belgesindedir)

Her dosyaya bir doğrulama değeri (SHA256SUMS.txt) eşlik eder. Endişe edenler, indirdiği dosyanın değerinin uyuşup uyuşmadığını denetleyebilir.

> **Örnek sayfa hakkında**: Nasıl çalıştığını denetlemek için bir örnek (https://breeze-469.pages.dev/) sunulmaktadır. Orada barındırılan aynı yazılımdır, ancak örnek önceden bildirilmeden değişebilir veya durabilir. Gerçek kullanım için, kendi sunucunuza kurduğunuz bir kopyayı kullanın. Kendi sunucunuzdaki bir kopya, örnek dursa da etkilenmez.

### İlk kurulum

1. Uygulamayı açın.
2. Adınızı girin ve "Hesap oluştur"a basın. Hazırlık bununla tamamdır. Kayıt da telefon numarası da gerekmez.

- Daha önce yaptığınız bir kimliği geri getirmek isterseniz, "Mevcut bir hesabı geri yükle"yi açın; geri getirme yolları (bir yedek dosyası, bir kurtarma parolası vb.) çıkar.
- Oluşturma bittiğinde, anahtarınızı bir parolayla korumanıza yol gösteren bir kart çıkar (bir süre sonra kaybolmaz). Önemli bir kimlik için yol göstermeyi izleyin ve korumayı ekleyin.

Bu sırada cihazın içinde bir "anahtar" oluşturulur. Kimliğinizin ta kendisi budur.
**Hesapların listesi sunucuda yoktur.** Kimlik yalnızca cihazınızın içinde bulunur.
Bu nokta, yedekleme bölümünde (9) önemli olacaktır.

### "Tek kullanımlık kimlik" hakkında

Oluştururken "tek kullanımlık kimlik" seçerseniz, hiçbir geri getirme yolu olmayan bir kimlik olur.
O cihazı kaybederseniz, sıfırlarsanız veya tarayıcı verilerini silerseniz, o kimlik bir daha geri gelmez.
Bu, ekranda da gösterilir. Uzun süre kullanacağınız bir kimlik için seçmeyin.

---

## 2. Karşı tarafla bağlanma

"Arkadaş ekle" düğmesine kişiler ekranında basın; üç seçenek çıkar.

- **Kişi ekle**: Karşı tarafın kimliğini (ID) girin veya bir QR kodu okutun.
- **Arkadaş davet et**: Davet bağlantısını kopyalayın ve alışılmış iletişim yolunuzla (e-posta vb.) gönderin. Karşı taraf bağlantıyı açıp adını girerse, hemen konuşabilirsiniz.
- **Grup oluştur**: Bir grup oluşturmak için yalnızca bir grup adı girmeniz yeterlidir (bölüm 4).

Kendi kimliğiniz, kendi profilinizi açtığınızda tam biçimiyle gösterilir ve olduğu gibi kopyalayabilirsiniz. Yalnızca kısa kimliği değil, tam kimliği de verebilirsiniz.

Karşı taraf da uygulamayı açmışsa, doğrudan bağlanıp konuşabilirsiniz.

---

## 3. Konuşma

- Mesajı yazıp göndermeniz yeterlidir. Fotoğraf, çıkartma ve konum da gönderilebilir.
- Girdi alanının yanındaki "+" işaretini açın; dosya ekleri, sesli mesajlar, sesli giriş, konum bilgileri, çıkartmalar, "yanıt gerekmez" ayarı ve daha fazlası birlikte çıkar.
- **Dosya gönderme**: Bire bir konuşmada en çok 50 MB'a kadar. Grupta daha küçüktür, yaklaşık 50 KB'a kadar.
- Çalıştırılabilir dosyalar gibi tehlikeli biçimlerdeki dosyalar otomatik olarak engellenir.
- Karşı taraf uygulamayı açmamışsa, mesaj şifreli olarak "emanet kutusunda" kalır ve açtığında teslim edilir. Emanet kutusunu taşıyan sunucu içeriği okuyamaz. Teslim edilemeyen mektuplar **en geç 7 gün** sonra otomatik olarak silinir.
- Konuşma geçmişi bir dosyaya aktarılabilir veya dosyadan içe aktarılabilir.

### Ekranı okuma

- **Gönderim durumu**: Bir mesajın yanındaki işaretten anlaşılır. ✓ gönderildi demektir, daire içindeki ✓ emanet kutusuna bırakıldığı, ✓✓ karşı tarafa ulaştığı, okundu mavi bir işaret ve başarısızlık kırmızı bir işarettir. Yalnızca renkle değil, biçimle de ayırt edilirler.
- **Kişi listesi**: Son konuşmanızın zamanı bugün için saat olarak, dün için "Dün", bu yıl için ay/gün ve daha eskisi için yıl/ay/gün olarak gösterilir. Okumadığınız mesajları olan kişilerin adı ve zamanı vurgulanır.
- **Kendi kartınız**: Listenin üstünde kendi profil kartınız bulunur; profilinizi açmak için ona basın. Listeyle birlikte kayar.
- **Telefonda alt sekmeler**: Telefon genişliğinde, ekranın altında "Kişiler" ve "Ayarlar" sekmeleri çıkar.
- **Konuşma başlığı**: Arama simgesinden konuşma içinde arama yapabilirsiniz. "⋮" menüsünden güvenlik numarasını denetleyebilir, bildirimleri susturabilir, sabitleyebilir, anket oluşturabilir ve daha fazlasını yapabilirsiniz.

### Komutlar

Girdi alanına `/` yazarsanız, komut adayları çıkar. Kullanılabilecek komutların listesi için `/help` yazın (71 çeşit).
Ayarlar ve cihaz bağlama gibi bazı işlemler komutlardan yapılır.

---

## 4. Gruplar

- Bir gruba en çok **1.000 kişi** girebilir.
- Oluşturma yolu, "Arkadaş ekle" içindeki "Grup oluştur" kısmına yalnızca bir grup adı girmektir (`/newgroup` komutuyla da oluşturabilirsiniz). Davet, "grup davet bağlantısı" üzerinden yapılır. Bağlantıyı alan kişi, adını girerek katılabilir.
- Grupta da dosya gönderilebilir ancak sınır daha küçüktür, yaklaşık 50 KB. Sesli mesaj grupta henüz gönderilemez.
- Uygulamanın eski bir sürümünü kullanan üyeler varsa, o grupta daha güvenli yeni yöntem (grup v5) kullanılamaz ve ekranda bir uyarı çıkar. Herkes en yeni sürüme geçtiğinde etkinleşir.

---

## 5. Aramalar

- Bire bir sesli arama ve görüntülü arama yapılabilir. Grup araması da vardır (en çok 8 kişi).
- **Arama doğrulama kodu**: Arama ekranında bir doğrulama kodu gösterilir. Karşı tarafla birbirinize okuyun ve her iki ekranda da uyuşup uyuşmadığını denetleyin. Uyuşmazsa, birinin yolda dinliyor olma ihtimali vardır. Bu durumda aramayı kapatın.
- Grup araması, herkesin uygulaması en yeni sürümde değilse başlatılamayabilir.

---

## 6. Birden çok cihaz ve hesap

- Aynı kimliği birden çok cihazda kullanmak için, cihazları `/link` komutuyla birbirine bağlarsınız.
- Hesaplar birden çok oluşturulup ayrı ayrı kullanılabilir (iş ve özel gibi). Cihaz sayısı da hesap sayısı da ücretsiz ve sınırsızdır.
- **Hesap oluşturma yolu**: Kişi listesinin en üstündeki hesap sekmelerinin yanındaki "+" düğmesine basın. Bir ad girin ve bir simge emojisi seçin; yeni bir hesap oluşturulur ve otomatik olarak ona geçilir.
- **Hesap değiştirme**: Hesap sekmeleri her zaman kişi listesinin en üstünde gösterilir. Geçmek için birine basın (bilgisayarda Ctrl+1–9 ile de geçebilirsiniz). Bir sekmeyi yeniden adlandırmak, simgesini değiştirmek veya silmek için basılı tutun.
- Dil, İngilizce de dâhil 51 dil arasından, cihazınızın diline uygun olarak otomatik seçilir.

---

## 7. Güvenliği koruyan ayarlar

Ayarlar kendi ekranı olarak açılır. Telefonda, ekranın altındaki "Ayarlar" sekmesinden açın; bilgisayarda, ekrandaki dişli düğmesinden açın (`/settings` komutuyla da açabilirsiniz). Bulunduğunuz ekrana dönmek için geri eylemini kullanın.

- **Otomatik kilit**: Sekme değiştirildiğinde otomatik olarak kilitleyen bir ayar vardır.
- **Anahtar parolası**: Cihazın içindeki anahtar, bir parolaya sarılarak korunabilir. Uygulamayı açarken girmeniz istenir.
- **Engelleme**: Rahatsız eden kişiler engellenebilir. Engellenen kişiden iletişim gelmez.

---

## 8. Pil ve acil durumlar (güç modları)

"Güç modu" ayarında, pilin nasıl kullanılacağını seçebilirsiniz.

- **Otomatik (pil düzeyi)**: Ne kadar pil kaldığına göre otomatik değişir.
- **Normal**: Her zamanki gibi.
- **Güç tasarrufu**: Teslim denetimlerini en çok 60 saniyede bir olacak şekilde seyreltir ve varlık sinyalini durdurur.
- **Acil durum (afetler için)**: Teslim denetimlerini en çok 10 dakikada bir olacak şekilde seyreltir. Bir afette veya şarj edemediğiniz başka bir zamanda kullanın.

Pili tüketen şey iletişim miktarı değil, telsizin kaç kez uyandığıdır. Bu yüzden gönderme tarafı seyreltilmez; yalnızca dinleme tarafı seyreltilir. Gönderme yine de her zamanki gibi hemen gider. Şarj etmeye başladığınızda, otomatik olarak daha hafif tarafa doğru bir adım geri gider.

Pil düzeyini otomatik okuyamayan cihazlarda (iPhone tarayıcısı gibi), "Otomatik" Normal gibi davranır ve el ile yapılan bir seçim seçildiği gibi çalışır.

---

## 9. Yedekleme ve geri getirme (en önemli bölümdür)

Breeze'in kimliği, yalnızca cihazınızın içindeki anahtardır. Sunucuda hesap listesi yoktur ve yapan kişide de sizin anahtarınız yoktur.
**Cihazı kaybederseniz, kimlik de kaybolur.** Önemli bir kimlik için mutlaka yedek alın.

Yedekleme ve geri getirme, ayarların "Yedekleme ve geri getirme" bölümünden yapılır (üç düğme vardır: "Buluta yedekle", "Geri yükle" ve "Dosyadan geri yükle"). Bir kişiyi ilk kez eklediğinizde, yedek almanızı isteyen bir kart yalnızca bir kez çıkar.

### Yedek alma yolu

1. Ayarlardaki "Yedekleme ve geri getirme" kısmından yedek oluşturmayı seçin.
2. Yedek için bir parola belirleyin (en az 6 karakter).
3. Kaydedilecek yeri seçin.
   - **Dosyaya kaydetme**: Yedek dosyasını kendi elinizde saklayın (önerilir).
   - **Aktarım sunucusuna kaydetme**: Yalnızca o aktarımın işletmecisi etkinleştirmişse kullanılabilir. Varsayılan aktarımda kullanılamaz. Bir saklama süresi vardır; süre dolmadan geri alın.

Yedeğin içeriği şifrelidir. Kaydedilecek yerin sunucusu yalnızca şifreli metni elinde tutar.

### Geri getirme yolu

Yeni cihazda, yedek dosyasını (veya aktarım sunucusundaki yedeği) ve belirlediğiniz parolayı kullanarak geri yüklersiniz.

### Uyarılar

- **Parolayı unutursanız, geri yükleme yapılamaz.** Yapan kişi de düzeltemez. Parolayı başka bir yere not edin.
- **Tek kullanımlık kimlik, yedekle de geri getirmeyle de geri gelmez.**
- Kimlikler çoğaldığında veya cihaz değiştirdiğinizde yedeği yeniden oluşturun.

---

## 10. Emanet kutusu ve maliyet anlayışı

- Karşı taraf çevrimdışı olduğundaki mektuplar, aktarım sunucusunun "emanet kutusuna" şifreli olarak konur (en çok 7 gün).
- Aktarımda, kötüye kullanımı önlemek için sınırlar vardır (emanet edilebilecek miktar ve sıklık). Sınıra ulaşıldığında, o süre boyunca yeni mektup emanet edilemez ancak **daha önce ulaşmış mektuplar kaybolmaz**. Ekranda neden ve bekleme süresi gösterilir.
- Sınırı, kendi sunucunuza kurduysanız, kendiniz belirleyebilirsiniz.

Sunucu tarafında kalan kayıtların kapsamı (hepsi otomatik olarak silinir ve içerik okunamaz):

| Şey | Kalma süresi |
|---|---|
| Teslim edilemeyen mektup | En çok 7 gün |
| Bağlantı işareti | 5 dakika |
| Adres ve cihaz kayıtları | 90 gün |
| Grup bilgileri ve bildirim abonelikleri | 30 gün |

---

## 11. Güncelleme yolu (masaüstü sürümü)

1. Yeni bir sürüm olduğunda, ekranda bir bildirim çıkar.
2. "İndir"e basarsanız, yeni sürümü almaya gider (otomatik olarak kurmaz).
3. İndirme bittiğinde, "Kur"a basıp yeniden başlatın.

Güncelleme sırasında bir hata olursa (dosya doğrulamasının uyuşmaması vb.), güncelleme **durur ve neden ekranda gösterilir**. Eski bir sürüme geri dönüş yapılamaz.

---

## 12. Sorun yaşadığınızda

| Belirti | Denetlenecek şey |
|---|---|
| Mesaj gönderilemiyor | Cihazın saatinin kaymış olup olmadığını denetleyin. Saat kaymışsa gönderim başarısız olur. |
| Karşı tarafa ulaşmıyor | Karşı taraf uygulamayı açana kadar emanet kutusunda bekler (en çok 7 gün). |
| Dosya gönderilemiyor | Boyut sınırını (bire bir 50 MB, grup yaklaşık 50 KB) aşmadığınızı ve tehlikeli biçim olarak engellenmediğini denetleyin. |
| Aramanın doğrulama kodu uyuşmuyor | Aramayı kapatıp yeniden arayın. Uyuşmadan sürdürmeyin. |
| Parolayı unuttunuz | Geri yükleme yapılamaz. Yeni bir kimlik oluşturup karşı tarafa yeniden bildirin. |
| Cihazı kaybettiniz | Yedek varsa, yeni bir cihazda geri getirebilirsiniz. Yoksa, yeni bir kimlik olur. |
| Örnek sayfa açılmıyor | Örnek önceden bildirilmeden durabilir. Kendi sunucunuza kurduğunuz bir kopyayı kullanın. |

Hata bildirimlerini, lütfen, [Issues sayfasına](https://github.com/shizukutanaka/Breeze/issues) yapın.

---

## 13. Breeze'in sözleri

- Reklam göstermeyiz. Ne uygulamanın içinde, ne de başka bir yerde.
- İzleme yapmayız. Kullanım analizi, reklam mekanizması ve veri satışı kesinlikle yoktur.
- Yapan kişi, kullanıcıların verisini elinde tutmaz. Sunucu tarafında hesapların listesi diye bir şey yoktur.
- Konuşmalar cihazlar arasında şifrelenir. Sunucunun elinde tuttuğu, okunamayan zarflardan ibarettir.

Diğer mesajlaşma uygulamalarıyla ayrıntılı karşılaştırma, deponun "karşılaştırma sayfasında", Breeze'in geride kaldığı noktalar (kullanıcı sayısı, dış denetimden geçmemiş olması vb.) da dâhil edilerek yazılmıştır.

---

*Bu kılavuz, Breeze'in 2026-11-25 tarihindeki durumunu yansıtır.*
