# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Basahin sa ibang wika**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · Filipino (ang pahinang ito) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Isang naka-encrypt na messenger — walang numero ng telepono, walang rehistro.**
Ang nilalaman ng usapan ay mababasa lamang ng nagpadala at ng tumanggap. Hindi ito mababasa kahit ng server na nagdadala nito sa pagitan.
Libre ang lahat ng tampok, at walang mga ad.

Hindi ito isang web page, kundi software na ini-install at ginagamit (Windows / Mac / Linux / Android / iPhone / browser).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## Para magamit, ilalagay mo ito sa sarili mong server

Walang "server ng kumpanya" ang Breeze. **Para magamit ito, ikaw mismo ang maghahanda ng lugar (server) at doon mo ilalagay ang Breeze. Ito ang opisyal na paraan ng paggamit.**

- Ang karaniwang setup ay gumagamit ng Cloudflare, kaya **kailangan ng Cloudflare account**. Nasa [gabay sa pag-install](SELF_HOSTING-tl.md) ang mga hakbang (maaaring piliin ang ibang wika mula sa simula ng gabay).
- Ang mga app (Windows / Mac / Linux / Android / iPhone) ay kukunin mula sa [pahina ng download](https://github.com/shizukutanaka/Breeze/releases/latest), at ikokonekta sa sarili mong server para magamit.
- **Tungkol sa halimbawang install (isang tapat na paalala)**: May inilagay na halimbawa para sa pagsubok ng paggana (https://breeze-469.pages.dev/). Parehong software ang nakalagay, ngunit para sa tunay na paggamit, mangyaring gamitin ang sarili mong server. Ang halimbawa ay maaaring magbago o huminto nang walang abiso. Ang inilagay mo sa sarili mong server ay hindi maaapektuhan ng paghinto ng halimbawa.

Nasa [manwal](MANUAL-tl.md) ang detalyadong paraan ng paggamit (maaaring piliin ang ibang wika mula sa simula ng manwal).

## Paraan ng paggamit (3 hakbang)

1. Buksan ang Breeze na inilagay mo sa sarili mong server (o ang address na sinabi sa iyo ng nag-install), at pindutin ang "Magsimula gamit ang random na ID" (maaari kang maglagay ng pangalan kung gusto mo). Iyon lang, handa na (walang rehistro, walang numero ng telepono). Sa oras na ito, isang "susi" ang ginagawa sa loob ng device, at iyon ang magiging pagkakakilanlan mo.
2. Ibigay ang iyong ID o QR code sa taong gusto mong kausapin.
3. Kung bukas din ang app ng kausap, maaari kayong direktang kumonekta at mag-usap. Kung hindi niya ito binuksan, mananatili itong naka-encrypt sa "kahon ng imbakan", at darating kapag binuksan niya ito. Hindi mababasa ng server na nagdadala ng kahon ang nilalaman nito. Ang mga liham na hindi dumating ay awtomatikong mawawala pagkalipas ng pinakamaraming 7 araw.

## Mga pangako (mga hindi namin ginagawa)

- **Hindi kami maglalabas ng mga ad.** Hindi sa loob ng app, hindi saanman.
- **Hindi kami sumusubaybay.** Walang pagsusuri ng paggamit, walang mekanismo ng ad, walang bentahan ng data — wala talaga.
- **Hindi hawak ng gumawa ang data ng mga gumagamit.** Walang listahan ng mga account sa panig ng server. Ang pagkakakilanlan mo ay ang susi lamang sa loob ng iyong device.
- **Ang mga usapan ay naka-encrypt sa pagitan ng mga device.** Ang hinahawakan lang ng server ay mga sobreng hindi nito mabasa.

Tapat din naming isinusulat ang saklaw. Para sa paghahatid, may maikling pag-iimbak sa server (mga sobreng hindi pa naihatid: pinakamaraming 7 araw, mga senyas ng koneksyon: 5 minuto, mga tala ng address at device: 90 araw, impormasyon ng grupo at mga subscription sa notification: 30 araw. Lahat ay awtomatikong nawawala, at hindi mababasa ang nilalaman). Ang backup na pag-iimbak sa cloud ay naka-off sa simula. Kung ilalagay mo ito sa sarili mong server, ang pag-iimbak na iyon ay nasa ilalim din ng iyong pamamahala.

## Mga magagawa

- Usapang isa-sa-isa at panggrupong usapan (hanggang 1,000 tao)
- Voice call at video call (panggrupong tawag hanggang 8 tao)
- Pagpapadala ng file (sa isa-sa-isa, hanggang 50MB. Maaari ring magpadala sa grupo, ngunit mas maliit ang limitasyon ng laki)
- Paghihiwalay ng gamit ng maraming device at maraming account (para sa trabaho at personal, halimbawa. Walang limitasyon sa bilang ng device at account, at libre)
- Awtomatikong backup (kapag may nagbago, awtomatikong sine-save ang naka-encrypt na backup sa sarili mong server. Sa bagong device, kapag naibalik mo na ang iyong pagkakakilanlan, awtomatikong mahahanap ang backup at iaalok sa iyo. Ginagabayan ka rin ng mga setting sa paglipat sa bagong device)
- Pangalang ikaw ang pumipili para sa bawat contact (maaari mong palitan ang pangalan ng bawat contact, na nakaimbak lamang sa device na ito. Maaari mo ring piliin kung ipapakita ang pangalang itinakda ng bawat contact para sa sarili)
- 51 wika (Ingles at 50 file ng wika), awtomatikong pinipili ayon sa wika ng iyong device
- Profile na may larawan, mga sticker, pagbabahagi ng lokasyon
- Mga utos tulad ng `/help` (71 uri)
- Mga power mode na akma sa iyong baterya (awtomatiko / normal / pagtitipid ng kuryente / emergency). Habang nauubos ang baterya, pinapalayo ang mga pagsusuri ng paghahatid para mas tumagal ang baterya. Isang pananggalang para sa mga sakuna at iba pang panahong hindi ka makapag-charge
- Mga screen na madaling basahin (pansin sa contrast ng kulay, laki ng teksto, at pagpapatakbo gamit ang keyboard lamang)

## Pagkakaiba sa ibang mga messenger

| | Breeze | Maraming messenger |
|---|--------|--------|
| Rehistro | Hindi kailangan (ang pagkakakilanlan ay ang susi sa loob ng device) | Kailangan ng numero ng telepono |
| Server | Hindi mabasa ang nilalaman | Nakaasa sa pagtitiwala sa kumpanya |
| Ilagay sa sarili mong server | Batayan (bagay na inilalagay para gamitin) | Hindi magawa |
| Pagbubunyag ng nilalaman | Lahat ay bukas (lisensyang MIT) | Madalas na hindi bukas |
| Lugar ng data | Sa loob ng iyong device | Sa server ng kumpanya |

Ang detalyadong paghahambing sa Signal at LINE ay nasa [pahina ng paghahambing (Ingles)](../COMPARISON.md). Bawat pahayag ng Breeze ay may kasamang "paraan para mapatunayan", at ang mga puntong natatalo ang Breeze (bilang ng mga gumagamit, hindi pa nasusuri ng panlabas na audit, atbp.) ay isinulat din nang walang pagtatago.

## Gastos kung ilalagay sa sarili mong server

Gumagana ang Breeze sa loob ng libreng saklaw ng Cloudflare. Hindi kailangan ng credit card.

| Item | Libreng saklaw | Kung bayad |
|-----------|-----------|-------------|
| Lugar | Cloudflare Pages (libre) | — |
| Pagproseso | Hanggang 100,000 beses bawat araw | Hanggang 10,000,000 beses bawat buwan |
| Imbakan | Bawat araw: 100,000 pagbasa, 1,000 pagsulat | Bawat buwan: 10,000,000 pagbasa, 1,000,000 pagsulat |
| Relay ng tawag | Libre hanggang 20GB | 0.05 dolyar bawat GB |
| Sariling domain | Hindi kailangan (may libreng address na kasama) | 10 dolyar bawat taon |
| **Kabuuan** | **0 dolyar bawat buwan** (hanggang mga 20–40 tao sa magaan na paggamit) | **Mula 5 dolyar bawat buwan** (mga 100 tao sa magaan na paggamit. Sa 1,000 tao, 34–222 dolyar bawat buwan depende sa paggamit) |

Ang paraan ng paglaki ng gastos sa malaking sukat, at "bakit hindi kailangang pasanin ng iisang operator ang lahat ng gastos", ay nasa [mga ideya tungkol sa gastos at pagpapatuloy (Ingles)](../SUSTAINABILITY.md), at ang pinagbatayang kalkulasyon ay nasa [modelo ng gastos (Ingles)](../COST_MODEL.md).

Ang pag-install ay nagsisimula sa isang utos na ito (detalye sa [gabay sa pag-install](SELF_HOSTING-tl.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Mga teknikal na detalye (para sa mga developer)

### Mga paraan ng encryption

| Tungkulin | Paraan |
|-------|-----------|
| Pagpapalitan ng susi | X25519 (reserba: P-256) |
| Lagda | Ed25519 (reserba: HMAC-SHA256) |
| Encryption | AES-256-GCM |
| Pagkuha ng susi | HKDF-SHA256 |
| Pag-update ng susi ng usapan | Double Ratchet (parehong paraan ng Signal) |
| Susi ng grupo | Sender Key |
| Pagtatago ng nagpadala mula sa relay | Sealed Sender |

Ang pamantayan ng disenyo ay nasa [specification SPEC.md](../../SPEC.md), at ang patutunguhan ng mga ulat ng kahinaan at ang patakaran ay nasa [SECURITY.md](../../SECURITY.md).

### Mga test at pagsusuri ng kalidad

```bash
npm ci            # I-install ang mga kagamitan para sa development
npm test          # Patakbuhin ang mga test
./validate.sh     # Pagsusuri ng kalidad (syntax, kaligtasan, wika, pagsunod sa mga paraan, atbp. — 7 larangan)
./build.sh zip    # Gumawa ng ZIP para sa pamamahagi
```

### Pakikilahok sa development

Ang paraan ng pagsulong at ang mga alituntunin ay nasa [CONTRIBUTING.md](../../CONTRIBUTING.md).
Ang mga ulat ng depekto ay sa [pahina ng Issue](https://github.com/shizukutanaka/Breeze/issues). Ang code of conduct ay [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Lisensya

MIT — ayon sa [LICENSE](../../LICENSE), malayang gamitin, baguhin, at ipamahagi.
