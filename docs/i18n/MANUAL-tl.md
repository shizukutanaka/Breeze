# Manwal ng Breeze

**Basahin sa ibang wika**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · Filipino (ang pahinang ito) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Ang Breeze ay isang naka-encrypt na messenger na hindi nangangailangan ng numero ng telepono o rehistro.
Ang nilalaman ng usapan ay mababasa lamang ng nagpadala at ng tumanggap. Hindi ito mababasa kahit ng server na nagdadala nito sa pagitan.
Libre ang lahat ng tampok, at walang mga ad.

Ang manwal na ito ay gabay para sa mga nagsisimula pa lang.

---

## 1. Paano magsimula

### Pagkuha

Mula sa [pahina ng download](https://github.com/shizukutanaka/Breeze/releases/latest), pumili ng isa na akma sa iyong makina.

- Windows: ang pangalan ay nagtatapos sa `-win-x64.exe` (mayroon din para sa mga ARM na makina)
- Mac: ang pangalan ay nagtatapos sa `-mac.dmg`
- Linux: `.AppImage` (maaaring patakbuhin agad) o `.deb`
- Kung gagamit sa browser, gamitin ang inilagay mo sa sarili mong server (ang mga hakbang sa pag-install ay nasa hiwalay na dokumento, ang "gabay sa pag-install")

Bawat file ay may kasamang mga numerong pangtapat (SHA256SUMS.txt). Kung nag-aalala ka, maaari mong tiyakin kung tumutugma ang mga numero ng na-download mong file.

> **Tungkol sa sample na pahina**: May sample para makita kung paano ito gumagana (https://breeze-469.pages.dev/). Ang nakalagay doon ay parehong software, ngunit ang sample ay maaaring magbago o huminto nang walang abiso. Para sa tunay na paggamit, mangyaring gamitin ang inilagay mo sa sarili mong server. Ang inilagay mo sa sarili mong server ay hindi maaapektuhan kahit huminto ang sample.

### Unang pag-set up

1. Buksan ang app.
2. Ilagay ang iyong pangalan at pindutin ang "Gumawa ng account". Iyon lang, handa na. Walang rehistro, walang numero ng telepono.

- Kung gusto mong ibalik ang pagkakakilanlang ginawa mo noon, buksan ang "Ibalik ang umiiral na account" at lalabas ang mga paraan ng pagbawi (backup na file, recovery phrase, at iba pa).
- Kapag natapos ang paggawa, may lalabas na card na gagabay sa iyo para protektahan ang iyong susi gamit ang passphrase (hindi ito nawawala pagkalipas ng ilang panahon). Para sa mahalagang pagkakakilanlan, sundin ang gabay at idagdag ang proteksyon.

Sa oras na ito, isang "susi" ang ginagawa sa loob ng device. Iyon ang mismong pagkakakilanlan mo.
**Walang listahan ng mga account sa server.** Ang pagkakakilanlan mo ay nasa loob lamang ng iyong device.
Mahalaga ang puntong ito sa kabanata ng backup (9).

### Tungkol sa "pansamantalang pagkakakilanlan"

Kung pipiliin mo ang "pansamantalang pagkakakilanlan" sa paggawa, magiging pagkakakilanlan ito na walang anumang paraan ng pagbawi.
Kung mawala mo ang device na iyon, i-reset ito, o burahin ang data ng browser, hindi na kailanman maibabalik ang pagkakakilanlang iyon.
Ipinapakita rin ito sa screen. Huwag itong piliin para sa pagkakakilanlang matagal mong gagamitin.

---

## 2. Kumonekta sa kausap

Pindutin ang button na "Magdagdag ng kaibigan" sa screen ng mga contact at tatlong pagpipilian ang lalabas.

- **Magdagdag ng contact**: Ilagay ang ID ng kausap, o i-scan ang QR code.
- **Mag-imbita ng kaibigan**: Kopyahin ang link ng imbitasyon at ipadala ito sa karaniwan mong paraan ng pakikipag-ugnayan (email, atbp.). Kapag binuksan ng kausap ang link at inilagay ang kanyang pangalan, maaari na kayong mag-usap agad.
- **Gumawa ng grupo**: Ilagay lang ang pangalan ng grupo para gumawa nito (kabanata 4).

Ang sarili mong ID ay ipinapakita sa buong anyo nito kapag binuksan mo ang sarili mong profile, at maaari mo itong kopyahin nang buo. Maaari mong ibigay ang buong ID, hindi lang ang maikling ID.

Kung bukas din ang app ng kausap, maaari kayong direktang kumonekta at mag-usap.

---

## 3. Usapan

- Mag-type lang ng mensahe at ipadala. Maaari ring magpadala ng mga larawan, sticker, at lokasyon.
- Buksan ang "+" sa tabi ng input field at lalabas nang magkakasama ang mga attachment ng file, voice message, voice input, impormasyon ng lokasyon, mga sticker, ang setting na "hindi kailangan ng sagot", at iba pa.
- **Pagpapadala ng file**: Sa usapang isa-sa-isa, hanggang 50MB. Sa grupo, mas maliit, mga 50KB.
- Ang mga mapanganib na format ng file tulad ng mga executable ay awtomatikong hinaharangan.
- Kung hindi bukas ang app ng kausap, mananatili itong naka-encrypt sa "kahon ng imbakan", at darating kapag binuksan niya ito. Hindi mababasa ng server na nagdadala ng kahon ang nilalaman nito. Ang mga liham na hindi dumating ay awtomatikong mawawala pagkalipas ng **pinakamaraming 7 araw**.
- Ang kasaysayan ng usapan ay maaaring isulat sa file o ipasok mula sa file.

### Pagbasa ng screen

- **Katayuan ng pagpapadala**: Makikilala mo ito sa marka sa tabi ng mensahe. Ang ✓ ay nangangahulugang naipadala, ang ✓ sa loob ng bilog ay nangangahulugang nadeposito ito sa kahon ng imbakan, ang ✓✓ ay nangangahulugang nakarating ito sa kausap, ang nabasa ay asul na marka, at ang pagkabigo ay pulang marka. Pinag-iiba rin ang mga ito sa hugis, hindi lang sa kulay.
- **Listahan ng mga contact**: Ang oras ng huling pag-uusap ay ipinapakita bilang oras para sa ngayon, "Kahapon" para sa kahapon, buwan/araw para sa taong ito, at taon/buwan/araw para sa mas maaga pa. Ang mga contact na may mensaheng hindi mo pa nababasa ay may diin sa pangalan at oras.
- **Sarili mong card**: Sa itaas ng listahan ay ang sarili mong profile card; pindutin ito para buksan ang iyong profile. Gumagalaw ito kasama ng listahan.
- **Mga tab sa ibaba sa telepono**: Sa lapad ng telepono, lalabas sa ibaba ng screen ang mga tab na "Mga contact" at "Mga setting".
- **Header ng usapan**: Mula sa icon ng paghahanap, maaari kang maghanap sa loob ng usapan. Mula sa menu na "⋮", maaari mong tingnan ang safety number, i-mute ang mga notification, i-pin, gumawa ng poll, at iba pa.

### Mga utos

Mag-type ng `/` sa input field at lalabas ang mga mungkahing utos. Mag-type ng `/help` para makita ang listahan ng mga utos na magagamit mo (71 uri).
Ang ilang operasyon, tulad ng mga setting at pag-link ng device, ay ginagawa sa pamamagitan ng mga utos.

---

## 4. Mga grupo

- Ang isang grupo ay maaaring maglaman ng hanggang **1,000 tao**.
- Para gumawa, ilagay lang ang pangalan ng grupo sa ilalim ng "Gumawa ng grupo" sa "Magdagdag ng kaibigan" (maaari ring gumawa gamit ang utos na `/newgroup`). Ang pag-imbita ay sa pamamagitan ng "link ng imbitasyon ng grupo". Ang taong makakatanggap ng link ay maaaring sumali sa paglalagay ng kanyang pangalan.
- Maaari ring magpadala ng mga file sa grupo, ngunit ang limitasyon ay mga 50KB, mas maliit. Ang mga voice message ay hindi pa maipadala sa grupo.
- Kung may miyembrong gumagamit ng lumang bersyon ng app, hindi magagamit sa grupong iyon ang mas ligtas na bagong paraan (grupo v5), at may lalabas na babala sa screen. Magiging epektibo ito kapag lahat ay nasa pinakabagong bersyon na.

---

## 5. Mga tawag

- Maaari kang gumawa ng isa-sa-isang voice call at video call. Mayroon ding mga panggrupong tawag (hanggang 8 tao).
- **Code ng kumpirmasyon ng tawag**: Ipinapakita ang code ng kumpirmasyon sa screen ng tawag. Basahin ito nang magkasama ng kausap at tiyaking tumutugma ito sa magkabilang screen. Kung hindi ito tumutugma, maaaring may nakikinig sa pagitan. Sa ganoong kaso, ibaba ang tawag.
- Ang mga panggrupong tawag ay maaaring hindi masimulan kung hindi lahat ng app ay nasa pinakabagong bersyon.

---

## 6. Maraming device · mga account

- Para magamit ang parehong pagkakakilanlan sa maraming device, i-link ang mga device sa isa't isa gamit ang utos na `/link`.
- Maaari kang gumawa ng maraming account at paghiwalayin ang gamit (para sa trabaho at personal, halimbawa). Walang limitasyon sa bilang ng device at account, at libre.
- **Paano gumawa ng account**: Pindutin ang button na "+" sa tabi ng mga tab ng account sa pinakatuktok ng listahan ng mga contact. Maglagay ng pangalan at pumili ng emoji ng icon, at may bagong account na magagawa at awtomatikong lilipat dito.
- **Pagpapalit ng account**: Ang mga tab ng account ay palaging ipinapakita sa pinakatuktok ng listahan ng mga contact. Pindutin ang isa para lumipat (sa computer, maaari ring lumipat gamit ang Ctrl+1–9). Pindutin nang matagal ang tab para palitan ang pangalan nito, baguhin ang icon nito, o burahin ito.
- Ang wika ay awtomatikong pinipili mula sa 51 wika, kasama ang Ingles, ayon sa wika ng iyong device.

---

## 7. Mga setting para manatiling ligtas

Ang mga setting ay bumubukas bilang sarili nitong screen. Sa telepono, buksan ito mula sa tab na "Mga setting" sa ibaba ng screen; sa computer, mula sa button na gear sa screen (maaari mo rin itong buksan gamit ang utos na `/settings`). Gamitin ang aksyon na bumalik para bumalik sa screen na kinaroroonan mo.

- **Awtomatikong pag-lock**: May setting na awtomatikong nagla-lock kapag lumipat ka ng tab.
- **Passphrase ng susi**: Maaari mong balutin ng passphrase ang susi sa loob ng device para protektahan ito. Hihingin itong ilagay kapag binuksan mo ang app.
- **Pag-block**: Maaari mong i-block ang mga nakakainis na kausap. Hindi darating ang mga mensahe mula sa mga naka-block na kausap.

---

## 8. Baterya at mga emergency (mga power mode)

Sa setting na "Power mode", maaari mong piliin kung paano gagamitin ang baterya.

- **Awtomatiko (antas ng baterya)**: Awtomatikong lumilipat ayon sa natitirang baterya.
- **Normal**: Tulad ng dati.
- **Pagtitipid ng kuryente**: Pinapalayo ang mga pagsusuri ng paghahatid sa pinakamaraming isang beses bawat 60 segundo, at pinahihinto ang senyas ng presensya.
- **Emergency (para sa mga sakuna)**: Pinapalayo ang mga pagsusuri ng paghahatid sa pinakamaraming isang beses bawat 10 minuto. Gamitin ito sa sakuna o iba pang panahong hindi ka makapag-charge.

Ang umuubos sa baterya ay hindi ang dami ng komunikasyon kundi ang bilang ng beses na gumigising ang radyo. Kaya hindi pinapalayo ang panig ng nagpapadala; ang panig lang ng nakikinig. Agad pa ring lumalabas ang pagpapadala, tulad ng dati. Kapag nagsimula kang mag-charge, awtomatiko itong bumabalik ng isang hakbang patungo sa mas magaan na panig.

Sa mga device na hindi awtomatikong makabasa ng antas ng baterya (tulad ng browser ng iPhone), ang "Awtomatiko" ay kumikilos tulad ng Normal, at ang manu-manong pagpili ay gumagana ayon sa pinili.

---

## 9. Backup at pagbawi (ang pinakamahalagang kabanata)

Ang pagkakakilanlan mo sa Breeze ay ang susi lamang sa loob ng iyong device. Walang listahan ng mga account sa server, at wala rin sa gumawa ang iyong susi.
**Kung mawala mo ang device, mawawala rin ang pagkakakilanlan mo.** Para sa mahahalagang pagkakakilanlan, siguraduhing gumawa ng backup.

Ang backup at pagbawi ay ginagawa mula sa seksyong "Backup at pagbawi" ng mga setting (may tatlong button: "I-back up sa cloud", "Ibalik", at "Ibalik mula sa file"). Sa unang beses na magdagdag ka ng contact, may lalabas na card na humihimok sa iyo na gumawa ng backup, isang beses lang.

### Paano gumawa ng backup

1. Mula sa "Backup at pagbawi" sa mga setting, piliing gumawa ng backup.
2. Magtakda ng passphrase para sa backup (6 na karakter o higit pa).
3. Piliin ang lugar ng pag-iimbak.
   - **I-save sa file**: Itago ang backup na file sa sarili mong mga kamay (inirerekomenda).
   - **I-save sa relay server**: Magagamit lang kung pinagana ito ng operator ng relay na iyon. Hindi ito magagamit sa default na relay. May takdang panahon ng pag-iimbak, kaya bawiin ito bago matapos ang panahon.

Naka-encrypt ang nilalaman ng backup. Ang hinahawakan lang ng server ng pag-iimbak ay ang ciphertext.

### Paano magbawi

Sa bagong device, ibalik gamit ang backup na file (o ang backup sa relay server) at ang itinakda mong passphrase.

### Mga paalala

- **Kung makalimutan mo ang passphrase, hindi na maibabalik.** Hindi rin ito maaayos ng gumawa. Isulat ang passphrase sa ibang lugar.
- **Ang pansamantalang pagkakakilanlan ay hindi maibabalik sa pamamagitan ng backup o pagbawi.**
- Gumawa ulit ng backup kapag dumami ang mga pagkakakilanlan o nagpalit ka ng device.

---

## 10. Ang kahon ng imbakan at ang ideya tungkol sa gastos

- Ang mga liham para sa kausap na offline ay inilalagay, naka-encrypt, sa "kahon ng imbakan" ng relay server (pinakamaraming 7 araw).
- Ang relay ay may limitasyon para pigilan ang pang-aabuso (dami at dalas ng maaaring ipadala). Kapag naabot ang limitasyon, hindi ka na makakapagpadala ng bagong liham sa panahong iyon, ngunit **hindi mawawala ang mga liham na dumating na**. Ipinapakita sa screen ang dahilan at ang oras ng paghihintay.
- Ang limitasyon ay maaari mong itakda mismo kung inilagay mo ito sa sarili mong server.

Ang saklaw ng mga talang nananatili sa panig ng server (lahat ay awtomatikong nawawala, at hindi mababasa ang nilalaman):

| Bagay | Panahong nananatili |
|---|---|
| Mga liham na hindi pa naihatid | Pinakamaraming 7 araw |
| Mga senyas ng koneksyon | 5 minuto |
| Mga tala ng address at device | 90 araw |
| Impormasyon ng grupo · mga subscription sa notification | 30 araw |

---

## 11. Paano mag-update (bersyon sa desktop)

1. Kapag may bagong bersyon, may lalabas na paalala sa screen.
2. Kapag pinindot mo ang "I-download", pupunta ito para kunin ang bagong bersyon (hindi ito awtomatikong ini-install).
3. Kapag tapos na ang pag-download, pindutin ang "I-install" at mag-restart.

Kung mabigo sa gitna ng pag-update (hindi tumugma ang pagtapat ng file, atbp.), **hihinto ang pag-update at ipapakita ang dahilan sa screen**. Hindi maaaring bumalik sa lumang bersyon.

---

## 12. Kapag may problema

| Sintomas | Bagay na dapat tiyakin |
|---|---|
| Hindi maipadala ang mensahe | Tiyaking hindi mali ang oras ng device. Kung mali ang oras, mabibigo ang pagpapadala. |
| Hindi dumating sa kausap | Hanggang sa buksan ng kausap ang app, naghihintay ito sa kahon ng imbakan (pinakamaraming 7 araw). |
| Hindi maipadala ang file | Tiyaking hindi ito lumampas sa limitasyon ng laki (isa-sa-isa: 50MB, grupo: mga 50KB), at hindi ito naharang bilang mapanganib na format. |
| Hindi tumutugma ang code ng kumpirmasyon ng tawag | Ibaba ang tawag at tumawag ulit. Huwag magpatuloy habang hindi ito tumutugma. |
| Nakalimutan ang passphrase | Hindi na maibabalik. Gumawa ng bagong pagkakakilanlan at sabihan ulit ang kausap. |
| Nawala ang device | Kung may backup ka, maaari kang magbawi sa bagong device. Kung wala, magiging bagong pagkakakilanlan ka. |
| Hindi bumubukas ang sample na pahina | Maaaring huminto ang sample nang walang abiso. Mangyaring gamitin ang inilagay mo sa sarili mong server. |

Ang mga ulat ng depekto ay mangyaring ipadala sa [pahina ng Issue](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Mga pangako ng Breeze

- Hindi kami maglalabas ng mga ad. Hindi sa loob ng app, hindi saanman.
- Hindi kami sumusubaybay. Walang pagsusuri ng paggamit, walang mekanismo ng ad, walang bentahan ng data — wala talaga.
- Hindi hawak ng gumawa ang data ng mga gumagamit. Walang listahan ng mga account sa panig ng server.
- Ang mga usapan ay naka-encrypt sa pagitan ng mga device. Ang hinahawakan lang ng server ay mga sobreng hindi nito mabasa.

Ang detalyadong paghahambing sa ibang mga messenger ay nakasulat sa "pahina ng paghahambing" ng repository, kasama ang mga puntong natatalo ang Breeze (bilang ng mga gumagamit, hindi pa nasusuri ng panlabas na audit, atbp.).

---

*Sinasalamin ng manwal na ito ang kalagayan ng Breeze noong 2026-11-25.*
