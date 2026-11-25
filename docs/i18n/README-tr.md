# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Başka bir dilde okuyun**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · Türkçe (bu sayfa) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Telefon numarası ve kayıt gerektirmeyen, şifreli bir mesajlaşma uygulaması.**
Konuşmaların içeriğini yalnızca gönderen ve alan kişi okuyabilir. Yolda taşıyan sunucu bile okuyamaz.
Tüm özellikler ücretsizdir ve reklam yoktur.

Bu bir web sayfası değil, kurulup kullanılan bir yazılımdır (Windows / Mac / Linux / Android / iPhone / tarayıcı).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## Kullanmak için kendi sunucunuza kurarsınız

Breeze'in bir "işletmeci şirket sunucusu" yoktur. **Kullanmak için, barındırma yerini (sunucuyu) kendiniz hazırlar ve Breeze'i oraya kurarsınız. Resmî kullanım şekli budur.**

- Standart kurulum Cloudflare kullanır, bu yüzden **bir Cloudflare hesabı gereklidir**. Yöntem, [kurulum kılavuzunda](SELF_HOSTING-tr.md) yer alır (diğer dillerdeki sürümler kılavuzun başından seçilebilir).
- Uygulamayı (Windows / Mac / Linux / Android / iPhone) [indirme sayfasından](https://github.com/shizukutanaka/Breeze/releases/latest) alır ve kendi sunucunuza bağlanarak kullanırsınız.
- **Örnek kurulum hakkında (dürüst bir bilgilendirme)**: Çalışmayı kontrol etmek için bir örnek (https://breeze-469.pages.dev/) yerleştirdik. Orada aynı yazılım çalışıyor, ancak gerçek kullanım için lütfen kendi sunucunuzu kullanın. Örnek, önceden haber verilmeden değişebilir veya durabilir. Kendi sunucunuza kurduğunuz kopya, örneğin durmasından etkilenmez.

Ayrıntılı kullanım, [kullanım kılavuzunda](MANUAL-tr.md) yer alır (diğer dillerdeki sürümler kılavuzun başından seçilebilir).

## Kullanım (3 adım)

1. Kendi sunucunuza kurduğunuz Breeze'i (veya kuran kişinin size bildirdiği adresi) açın ve "Rastgele bir kimlikle başla" düğmesine basın (isterseniz bir ad girebilirsiniz). Hazırlık bununla tamamdır (kayıt da telefon numarası da gerekmez). Bu sırada cihazın içinde, kimliğiniz olacak bir "anahtar" oluşturulur.
2. Kendi kimliğinizi (ID) veya QR kodunuzu, konuşmak istediğiniz kişiye verin.
3. Karşı taraf da uygulamayı açmışsa, doğrudan bağlanıp konuşabilirsiniz. Karşı taraf açmamışsa, mesaj şifreli olarak "emanet kutusunda" bekler ve açtığında teslim edilir. Emanet kutusunu taşıyan sunucu içeriği okuyamaz. Teslim edilemeyen mektuplar en geç 7 gün sonra otomatik olarak silinir.

## Sözlerimiz (yapmadıklarımız)

- **Reklam göstermeyiz.** Ne uygulamanın içinde, ne de başka bir yerde.
- **İzleme yapmayız.** Kullanım analizi, reklam mekanizması ve veri satışı kesinlikle yoktur.
- **Yapan kişi, kullanıcıların verisini elinde tutmaz.** Sunucu tarafında hesapların listesi diye bir şey yoktur. Kimlik, yalnızca cihazınızdaki anahtardır.
- **Konuşmalar cihazlar arasında şifrelenir.** Sunucunun elinde tuttuğu, okunamayan zarflardan ibarettir.

Dürüst olmak için kapsamı da yazarız. Teslimat için sunucuda kısa süreli bir tutma olur (teslim edilemeyen zarflar en çok 7 gün, bağlantı işaretleri 5 dakika, adres ve cihaz kayıtları 90 gün, grup bilgileri ve bildirim abonelikleri 30 gün; hepsi otomatik olarak silinir ve içerik okunamaz). Buluta yedekleme, başlangıçta devre dışıdır. Kendi sunucunuza kurarsanız, bu tutma da kendi yönetiminize girer.

## Neler yapabilir

- Bire bir konuşmalar ve grup konuşmaları (en çok 1.000 kişi)
- Sesli aramalar ve görüntülü aramalar (en çok 8 kişilik grup aramaları)
- Dosya gönderme (bire bir konuşmada en çok 50 MB. Grupta da gönderilebilir ancak boyut sınırı daha küçüktür.)
- Birden çok cihazı ve birden çok hesabı ayrı ayrı kullanma (iş ve özel gibi; cihaz sayısı da hesap sayısı da ücretsiz ve sınırsızdır)
- Otomatik yedekleme (bir şey değiştiğinde, şifreli bir yedek kendi sunucunuza otomatik olarak kaydedilir. Yeni bir cihazda, kimliğinizi geri getirdiğinizde bir yedek otomatik olarak bulunur ve size sunulur. Ayarlar, yeni bir cihaza geçişte de size yol gösterir)
- Her kişi için kendinizin seçtiği bir ad (her kişiyi yeniden adlandırabilirsiniz; yalnızca bu cihazda saklanır. Her kişinin kendisi için belirlediği adın gösterilip gösterilmeyeceğini de seçebilirsiniz)
- 51 dil (İngilizce artı 50 dil dosyası), cihazınızın diliyle eşleşecek şekilde otomatik seçilir
- Fotoğraflı profil, çıkartmalar, konum paylaşımı
- `/help` gibi komutlarla kullanım (71 çeşit)
- Pilinize uygun güç modları (otomatik / normal / güç tasarrufu / acil durum). Pil azaldıkça teslim denetimleri seyreltilir, böylece pil daha uzun dayanır. Afetler ve şarj edemediğiniz başka zamanlar için bir güvence
- Okunaklı ekranlar (renk kontrastına, metin boyutuna ve yalnızca klavyeyle kullanıma özen gösterilir)

## Diğer mesajlaşma uygulamalarından farkları

| | Breeze | Çoğu mesajlaşma uygulaması |
|---|--------|--------|
| Kayıt | Gerekmez (kimlik, cihazdaki anahtardır) | Telefon numarası gerekir |
| Sunucu | İçeriği okuyamaz | İşletmeci şirkete güvenme varsayımına dayanır |
| Kendi sunucuna kurma | Ön koşuldur (kurulup kullanılan bir şeydir) | Yapılamaz |
| İçeriğin açıklığı | Tümü açıktır (MIT lisansı) | Çoğu açık değildir |
| Verinin yeri | Cihazınızın içinde | İşletmeci şirketin sunucusunda |

Signal ve LINE ile ayrıntılı karşılaştırma, [karşılaştırma sayfasında (İngilizce)](../COMPARISON.md) yer alır. Breeze'in her iddiasına birer "doğrulama yolu" eklenmiştir ve Breeze'in geride kaldığı noktalar (kullanıcı sayısı, dış denetimden geçmemiş olması vb.) da gizlenmeden yazılmıştır.

## Kendi sunucunuza kurmanın maliyeti

Breeze, Cloudflare'ın ücretsiz kotası içinde çalışır. Kredi kartı da gerekmez.

| Kalem | Ücretsiz kota | Ücretli durumda |
|-----------|-----------|-------------|
| Barındırma | Cloudflare Pages (ücretsiz) | — |
| İşlem | Günde en çok 100.000 kez | Ayda en çok 10.000.000 kez |
| Depolama | Günde okuma en çok 100.000, yazma en çok 1.000 kez | Ayda okuma en çok 10.000.000, yazma en çok 1.000.000 kez |
| Arama aktarımı | 20 GB'a kadar ücretsiz | GB başına 0,05 dolar |
| Özel alan adı | Gerekmez (ücretsiz bir adres verilir) | Yılda 10 dolar |
| **Toplam** | **Ayda 0 dolar** (hafif kullanımda yaklaşık 20–40 kişiye kadar) | **Ayda 5 dolardan başlar** (hafif kullanımda yaklaşık 100 kişi mertebesi; 1.000 kişi mertebesinde kullanıma göre ayda 34–222 dolar) |

Maliyetlerin büyük ölçekte nasıl arttığı ve "neden tek bir işletmecinin bütün maliyeti sırtlanması gerekmediği", [maliyet ve sürdürülebilirlik yaklaşımında (İngilizce)](../SUSTAINABILITY.md) anlatılır; dayandığı hesaplar [maliyet modelinde (İngilizce)](../COST_MODEL.md) yer alır.

Kurulum şu tek komutla başlar (ayrıntılar [kurulum kılavuzunda](SELF_HOSTING-tr.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Teknik ayrıntılar (geliştiriciler için)

### Şifreleme yöntemleri

| Rol | Yöntem |
|-------|-----------|
| Anahtar değişimi | X25519 (yedek: P-256) |
| İmza | Ed25519 (yedek: HMAC-SHA256) |
| Şifreleme | AES-256-GCM |
| Anahtar türetme | HKDF-SHA256 |
| Konuşma anahtarının yenilenmesi | Double Ratchet (Signal ile aynı yöntem) |
| Grup anahtarı | Sender Key |
| Göndereni aktarıcıdan gizleme | Sealed Sender |

Tasarımın esas belgesi [SPEC.md belirtimidir](../../SPEC.md); zayıflıkların bildirim yeri ve ilkeler [SECURITY.md](../../SECURITY.md) içindedir.

### Testler ve kalite denetimleri

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Geliştirmeye katılım

İlerleyiş ve kurallar [CONTRIBUTING.md](../../CONTRIBUTING.md) içindedir.
Hata bildirimleri [Issues sayfasına](https://github.com/shizukutanaka/Breeze/issues). Davranış kuralları [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) belgesidir.

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Lisans

MIT — [LICENSE](../../LICENSE) belgesindeki gibi, özgürce kullanabilir, düzeltebilir ve dağıtabilirsiniz.
