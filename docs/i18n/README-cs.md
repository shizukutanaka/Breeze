# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Číst v jiných jazycích**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · Čeština (tato stránka) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Šifrovaný messenger, který nevyžaduje telefonní číslo ani registraci.**
Obsah konverzace mohou číst pouze odesílatel a příjemce. Nemůže jej číst ani server, který ji přepravuje.
Všechny funkce jsou zdarma a nejsou tu žádné reklamy.

Nejedná se o webovou stránku, ale o software, který si nainstalujete a používáte (Windows / Mac / Linux / Android / iPhone / prohlížeč).

![Snímek obrazovky Breeze Messenger — hlavní okno hned po vytvoření identity](../images/screenshot.png)

## K používání jej umístíte na vlastní server

Breeze nemá "server provozující společnosti". **Abyste jej mohli používat, zajistíte si sami místo (server) a Breeze tam umístíte. To je oficiální způsob používání.**

- Standardní nastavení používá Cloudflare, takže **je vyžadován účet Cloudflare**. Postup je v [průvodci instalací](SELF_HOSTING-cs.md) (verze v jiných jazycích lze vybrat na začátku průvodce).
- Aplikaci (Windows / Mac / Linux / Android / iPhone) si stáhněte ze [stránky ke stažení](https://github.com/shizukutanaka/Breeze/releases/latest) a používejte ji připojenou k vlastnímu serveru.
- **O ukázkové instalaci (poctivé upozornění)**: Pro ověření funkčnosti je k dispozici ukázka (https://breeze-469.pages.dev/). Je to stejný software, který je tam umístěn, ale pro skutečné používání použijte prosím vlastní server. Ukázka se může bez upozornění změnit nebo zastavit. Na Breeze umístěný na vašem vlastním serveru zastavení ukázky nemá vliv.

Podrobné pokyny k používání jsou v [příručce](MANUAL-cs.md) (verze v jiných jazycích lze vybrat na začátku příručky).

## Jak používat (3 kroky)

1. Otevřete Breeze, který jste umístili na vlastní server (nebo adresu, kterou vám sdělila osoba, která jej umístila), a stiskněte "Začít s náhodným ID" (pokud chcete, můžete zadat jméno). Tím jste připraveni (není potřeba registrace ani telefonní číslo). V tu chvíli se uvnitř vašeho zařízení vytvoří "klíč" a ten je vaší identitou.
2. Předejte své ID nebo QR kód osobě, se kterou chcete mluvit.
3. Pokud má i druhá osoba aplikaci otevřenou, můžete se připojit přímo a mluvit. Pokud ji otevřenou nemá, zpráva se stále zašifrovaná uloží do "schránky" a doručí se, až aplikaci otevře. Server, který schránku přepravuje, nemůže obsah číst. Dopisy, které nejsou nikdy doručeny, se automaticky smažou nejpozději po 7 dnech.

## Sliby (co neděláme)

- **Žádné reklamy.** Ani v aplikaci, ani nikde jinde.
- **Žádné sledování.** Žádná analýza používání, žádné reklamní mechanismy, žádný prodej dat — vůbec.
- **Tvůrce nedrží žádná uživatelská data.** Na straně serveru vůbec neexistuje seznam účtů. Vaše identita je pouze klíč uvnitř vašeho zařízení.
- **Konverzace jsou šifrovány mezi zařízeními.** Server pracuje pouze s zapečetěnými obálkami, které nemůže číst.

Poctivě píšeme i o mezích. Kvůli doručování existuje na serveru krátkodobé uložení (nedoručené obálky nejvýše 7 dní, signály připojení 5 minut, záznamy adres a zařízení 90 dní, informace o skupinách a odběry oznámení 30 dní. Vše se automaticky maže a obsah nelze číst). Zálohování do cloudu je zpočátku vypnuté. Pokud Breeze umístíte na vlastní server, máte i toto uložení pod vlastní kontrolou.

## Co umí

- Konverzace jeden na jednoho a skupinové konverzace (až 1 000 lidí)
- Hlasové a videohovory (skupinové hovory až pro 8 lidí)
- Posílání souborů (v konverzacích jeden na jednoho až 50MB. Posílat lze i ve skupinách, ale limit velikosti je menší)
- Používání více zařízení a více účtů pro různé účely (například pracovní a soukromé. Počet zařízení i účtů je zdarma a neomezený)
- Automatické zálohování (když se něco změní, zašifrovaná záloha se automaticky uloží na váš vlastní server. Na novém zařízení se po obnovení identity záloha najde automaticky a nabídne se vám. Nastavení vás také provede přechodem na nové zařízení)
- Jméno, které si sami zvolíte pro každý kontakt (každý kontakt si můžete přejmenovat; ukládá se pouze v tomto zařízení. Můžete si také zvolit, zda se zobrazí jméno, které si každý kontakt sám nastavil)
- 51 jazyků (angličtina plus 50 jazykových souborů), vybírá se automaticky podle jazyka vašeho zařízení
- Profily s fotografií, samolepky, sdílení polohy
- Příkazy jako `/help` (71 druhů)
- Režimy napájení přizpůsobené vaší baterii (automatický / normální / úsporný / nouzový). Když baterie dochází, kontroly doručení se rozloží, aby baterie vydržela déle. Pojistka pro katastrofy a jiné situace, kdy nemůžete nabíjet
- Čitelné obrazovky (pozornost věnovaná kontrastu barev, velikosti textu a ovládání pouze klávesnicí)

## Rozdíly oproti jiným messengerům

| | Breeze | Většina messengerů |
|---|--------|--------|
| Registrace | Není potřeba (identita je klíč ve vašem zařízení) | Je vyžadováno telefonní číslo |
| Server | Nemůže číst obsah | Předpokládá důvěru v provozující společnost |
| Umístění na vlastní server | Předpoklad (věc, kterou umístíte a používáte) | Není možné |
| Zveřejnění obsahu | Vše je otevřené (licence MIT) | Často uzavřené |
| Kde jsou data | Ve vašem zařízení | Na serverech provozující společnosti |

Podrobné srovnání se Signalem a LINE je na [srovnávací stránce (anglicky)](../COMPARISON.md). Ke každému tvrzení Breeze je přiložen způsob "jak si to ověřit" a body, v nichž Breeze prohrává (počet uživatelů, to, že neproběhl externí audit apod.), se neskrývají.

## Náklady na umístění na vlastní server

Breeze běží v bezplatném rozsahu Cloudflare. Kreditní karta není potřeba.

| Položka | Bezplatný rozsah | V placeném případě |
|-----------|-----------|-------------|
| Místo | Cloudflare Pages (zdarma) | — |
| Zpracování | Až 100 000krát denně | Až 10 milionůkrát měsíčně |
| Úložiště | Denně: čtení 100 000, zápis 1 000 | Měsíčně: čtení 10 milionů, zápis 1 milion |
| Relé hovorů | Zdarma do 20GB | 0,05 dolaru za GB |
| Vlastní doména | Není potřeba (bezplatná adresa je součástí) | 10 dolarů ročně |
| **Celkem** | **0 dolarů měsíčně** (při lehkém používání až pro zhruba 20–40 lidí) | **Od 5 dolarů měsíčně** (při lehkém používání měřítko asi 100 lidí. V měřítku 1 000 lidí 34–222 dolarů měsíčně podle používání) |

Jak náklady rostou ve velkém měřítku a "proč nemusí jeden provozovatel nést celé náklady", je popsáno v [úvahách o nákladech a udržitelnosti (anglicky)](../SUSTAINABILITY.md) a podkladové výpočty jsou v [nákladovém modelu (anglicky)](../COST_MODEL.md).

Instalace začíná tímto jediným příkazem (podrobnosti v [průvodci instalací](SELF_HOSTING-cs.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Technické podrobnosti (pro vývojáře)

### Způsoby šifrování

| Role | Způsob |
|-------|-----------|
| Výměna klíčů | X25519 (záloha: P-256) |
| Podpis | Ed25519 (záloha: HMAC-SHA256) |
| Šifrování | AES-256-GCM |
| Odvození klíčů | HKDF-SHA256 |
| Obnova klíčů konverzace | Double Ratchet (stejný způsob jako Signal) |
| Skupinové klíče | Sender Key |
| Skrytí odesílatele před relé | Sealed Sender |

Závazný návrh je ve [specifikaci SPEC.md](../../SPEC.md) a místo pro hlášení slabých míst a zásady jsou v [SECURITY.md](../../SECURITY.md).

### Testy a kontroly kvality

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Účast na vývoji

Postup a pravidla jsou v [CONTRIBUTING.md](../../CONTRIBUTING.md).
Chyby hlaste na [stránce Issues](https://github.com/shizukutanaka/Breeze/issues). Kodex chování je v [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Licence

MIT — jak je uvedeno v [LICENSE](../../LICENSE), můžete jej volně používat, upravovat a šířit.
