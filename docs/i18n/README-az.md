# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Başqa dildə oxuyun**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · Azərbaycan (bu səhifə) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Telefon nömrəsi də, qeydiyyat da tələb olunmayan şifrələnmiş messencerdir.**
Söhbətin məzmununu yalnız göndərən və qəbul edən oxuya bilər. Onu yolda daşıyan server belə oxuya bilməz.
Bütün funksiyalar pulsuzdur və reklam yoxdur.

Bu, veb-səhifə deyil, quraşdırıb istifadə olunan proqram təminatıdır (Windows / Mac / Linux / Android / iPhone / brauzer).

![Breeze Messenger ekran görüntüsü — şəxsiyyət yaradıldıqdan dərhal sonra əsas pəncərə](../images/screenshot.png)

## İstifadə etmək üçün onu öz serverinizə yerləşdirirsiniz

Breeze-in «operator şirkət serveri» yoxdur. **İstifadə etmək üçün yerləşdirmə yerini (serveri) özünüz təmin edib Breeze-i ora yerləşdirirsiniz. Rəsmi istifadə qaydası budur.**

- Pulsuz limit kifayətdir. Cloudflare-ın pulsuz planında işləyir və kredit kartı tələb olunmur. Addımlar [yerləşdirmə təlimatında](SELF_HOSTING-az.md) (digər dilləri təlimatın əvvəlindən seçə bilərsiniz) verilib.
- Tətbiqləri (Windows / Mac / Linux / Android / iPhone) [yükləmə səhifəsindən](https://github.com/shizukutanaka/Breeze/releases/latest) götürüb öz serverinizə qoşularaq istifadə edirsiniz.
- **Nümunə yerləşdirmə haqqında (dürüst bildiriş)**: İşləkliyini yoxlamaq üçün bir nümunə (https://breeze-469.pages.dev/) yerləşdirilib. Orada da eyni proqram təminatıdır, lakin real istifadə üçün öz serverinizdən istifadə edin. Nümunə xəbərdarlıq edilmədən dəyişə və ya dayana bilər. Öz serverinizə yerləşdirdiyiniz, nümunənin dayanmasından təsirlənmir.

Ətraflı istifadə qaydası [təlimatda](MANUAL-az.md) (digər dilləri təlimatın əvvəlindən seçə bilərsiniz) verilib.

## İstifadə qaydası (3 addım)

1. Öz serverinizə yerləşdirdiyiniz Breeze-i (və ya onu yerləşdirən şəxsdən öyrəndiyiniz ünvanı) açın və adınızı daxil edin. Hazırlıq bununla bitir (nə qeydiyyat, nə də telefon nömrəsi lazımdır). Bu zaman cihazınızın içində «açar» yaradılır və o, sizin şəxsiyyətiniz olur.
2. Öz ID-nizi və ya QR kodunuzu danışmaq istədiyiniz şəxsə verin.
3. Qarşı tərəf də tətbiqi açıbsa, birbaşa qoşulub söhbət edə bilərsiniz. Qarşı tərəf açmayıbsa, məktub şifrələnmiş halda «saxlama qutusuna» qoyulur və o, tətbiqi açanda çatdırılır. Saxlama qutusunu daşıyan server məzmunu oxuya bilməz. Çatdırıla bilməyən məktublar ən geci 7 günə avtomatik silinir.

## Vədlər (etmədiklərimiz)

- **Reklam göstərmirik.** Nə tətbiqin içində, nə də başqa yerdə.
- **İzləmirik.** İstifadə analitikası, reklam mexanizmləri və məlumat satışı qətiyyən yoxdur.
- **Yaradan istifadəçilərin məlumatlarını saxlamır.** Server tərəfində hesabların siyahısı belə yoxdur. Şəxsiyyət yalnız cihazınızdakı açardır.
- **Söhbətlər cihazlar arasında şifrələnir.** Serverin işlədiyi yalnız oxuna bilməyən zərflərdir.

Dürüstcəsinə əhatə dairəsini də yazırıq. Çatdırılma üçün serverdə qısa müddətli saxlama var (çatdırılmamış zərflər ən çox 7 gün, qoşulma siqnalları 5 dəqiqə, ünvan və cihaz qeydləri 90 gün, qrup məlumatları və bildiriş abunəlikləri 30 gün. Hamısı avtomatik silinir və məzmun oxuna bilməz). Buluda ehtiyat nüsxə ilkin olaraq söndürülüb. Öz serverinizə yerləşdirsəniz, həmin saxlamanı da öz idarəniz altına ala bilərsiniz.

## İmkanlar

- Təkbətək söhbətlər və qrup söhbətləri (ən çox 1.000 nəfər)
- Səsli zənglər və videozənglər (qrup zəngləri ən çox 8 nəfər)
- Fayl göndərmə (təkbətəkdə ən çox 50MB. Qruplarda da göndərmək olur, lakin ölçü limiti daha kiçikdir)
- Bir neçə cihaz və bir neçə hesabdan istifadə (məsələn, iş və şəxsi. Həm cihaz sayı, həm də hesab sayı pulsuz və limitsizdir)
- 51 dil (ingilis dili və 50 dil faylı), cihazınızın dilinə uyğun avtomatik seçilir
- Şəkilli profil, stikerlər, məkan paylaşımı
- `/help` kimi əmr əməliyyatları (71 növ)
- Batareyanıza uyğun enerji rejimləri (avtomatik / normal / enerjiyə qənaət / fövqəladə). Batareya azaldıqca çatdırılma yoxlamaları seyrəkləşir ki, batareya daha uzun davam etsin. Fəlakətlər və enerji doldura bilmədiyiniz digər vaxtlar üçün qorunma
- Oxunaqlı ekranlar (rəng kontrastına, mətn ölçüsünə və yalnız klaviatura ilə idarəetməyə diqqət)

## Digər messencerlərdən fərqi

| | Breeze | Əksər messencerlər |
|---|--------|--------|
| Qeydiyyat | Lazım deyil (şəxsiyyət cihazın içindəki açardır) | Telefon nömrəsi tələb olunur |
| Server | Məzmunu oxuya bilmir | Operator şirkətə etibar etmək şərtdir |
| Öz serverinə yerləşdirmə | İlkin şərt (yerləşdirib istifadə olunan) | Mümkün deyil |
| Məzmunun açıqlığı | Hamısı açıqdır (MIT lisenziyası) | Çox vaxt qapalıdır |
| Məlumatların yeri | Cihazınızın içində | Operator şirkətin serverində |

Signal və LINE ilə ətraflı müqayisə [müqayisə səhifəsində (ingilis dilində)](../COMPARISON.md) var. Breeze-in hər iddiasına «yoxlama üsulu» əlavə olunub və Breeze-in geri qaldığı məqamlar (istifadəçi sayı, xarici auditdən keçməməsi və s.) də gizlədilmədən yazılıb.

## Öz serverinizə yerləşdirməyin xərci

Breeze Cloudflare-ın pulsuz limiti daxilində işləyir. Kredit kartı lazım deyil.

| Maddə | Pulsuz limit | Ödənişli halda |
|-----------|-----------|-------------|
| Yerləşdirmə yeri | Cloudflare Pages (pulsuz) | — |
| Emal | Gündə 100 min dəfəyə qədər | Ayda 10 milyon dəfəyə qədər |
| Yaddaş | Gündə oxuma 100 min, yazma 1 min dəfəyə qədər | Ayda oxuma 10 milyon, yazma 1 milyon dəfəyə qədər |
| Zəng ötürülməsi | 20GB-a qədər pulsuz | 1GB üçün 0,05 dollar |
| Fərdi domen | Lazım deyil (pulsuz ünvan verilir) | İldə 10 dollar |
| **Cəmi** | **Ayda 0 dollar** (yüngül istifadə ilə təxminən 20–40 nəfərə qədər) | **Ayda 5 dollardan** (yüngül istifadə ilə təxminən 100 nəfər miqyası. 1.000 nəfər miqyasında istifadədən asılı olaraq ayda 34–222 dollar) |

Böyük miqyasda xərclərin necə artdığı və «niyə tək bir operator bütün xərcləri çəkmir» sualının cavabı [xərc və davamlılıq yanaşması (ingilis dilində)](../SUSTAINABILITY.md) sənədində, əsas hesablamalar isə [xərc modelində (ingilis dilində)](../COST_MODEL.md) verilib.

Yerləşdirmə bu tək əmrlə başlayır (ətraflı məlumat üçün [yerləşdirmə təlimatına](SELF_HOSTING-az.md) baxın).

```bash
wrangler pages deploy . --project-name=breeze
```

## Texniki təfərrüatlar (tərtibatçılar üçün)

### Şifrələmə üsulları

| Rol | Üsul |
|-------|-----------|
| Açar mübadiləsi | X25519 (ehtiyat: P-256) |
| İmza | Ed25519 (ehtiyat: HMAC-SHA256) |
| Şifrələmə | AES-256-GCM |
| Açar törətmə | HKDF-SHA256 |
| Söhbət açarının yenilənməsi | Double Ratchet (Signal ilə eyni üsul) |
| Qrup açarı | Sender Key |
| Göndərəni ötürücüdən gizlətmək | Sealed Sender |

Dizaynın əsas sənədi [spesifikasiya SPEC.md](../../SPEC.md), zəifliklərin bildirilmə ünvanı və siyasəti isə [SECURITY.md](../../SECURITY.md) sənədindədir.

### Testlər və keyfiyyət yoxlamaları

```bash
npm ci            # İnkişaf alətlərini quraşdırın
npm test          # Testləri icra edin
./validate.sh     # Keyfiyyət yoxlaması (sintaksis, təhlükəsizlik, dil, üsul uyğunluğu kimi 7 sahə)
./build.sh zip    # Paylanma ZIP-i yaradın
```

### İnkişafda iştirak

Proses və qaydalar [CONTRIBUTING.md](../../CONTRIBUTING.md) sənədindədir.
Xəta hesabatları [Issue səhifəsinə](https://github.com/shizukutanaka/Breeze/issues) göndərilir. Davranış kodeksi [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) sənədindədir.

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Lisenziya

MIT — [LICENSE](../../LICENSE) sənədində göstərildiyi kimi, sərbəst istifadə edin, dəyişdirin və yayın.
