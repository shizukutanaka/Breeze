# Příručka Breeze

**Číst v jiných jazycích**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · Čeština (tato stránka) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze je šifrovaný messenger, který nevyžaduje telefonní číslo ani registraci.
Obsah konverzace mohou číst pouze odesílatel a příjemce. Nemůže jej číst ani server, který ji přepravuje.
Všechny funkce jsou zdarma a nejsou tu žádné reklamy.

Tato příručka je návodem pro ty, kdo začínají používat.

---

## 1. Začínáme

### Získání

Na [stránce ke stažení](https://github.com/shizukutanaka/Breeze/releases/latest) vyberte soubor, který odpovídá vašemu zařízení.

- Windows: soubory, jejichž název končí na `-win-x64.exe` (k dispozici i pro zařízení ARM)
- Mac: soubory, jejichž název končí na `-mac.dmg`
- Linux: `.AppImage` (lze spustit přímo) nebo `.deb`
- Chcete-li jej používat v prohlížeči, použijte verzi, kterou jste umístili na vlastní server (postup instalace je v samostatném dokumentu "Průvodce instalací")

Ke každému souboru je přiložen kontrolní součet (SHA256SUMS.txt). Pokud máte obavy, můžete ověřit, že součet staženého souboru souhlasí.

> **O zkušební stránce**: Veřejná zkušební stránka (breeze.pages.dev) je v současné době zastavena (při otevření se zobrazí 404). Dokud nebude obnovena, používejte verzi aplikace. Na Breeze umístěný na vašem vlastním serveru zastavení nemá vliv.

### První nastavení

1. Otevřete aplikaci.
2. Zadejte své jméno. Tím jste připraveni. Není potřeba registrace ani telefonní číslo.

V tu chvíli se uvnitř vašeho zařízení vytvoří "klíč". Ten je vaší samotnou identitou.
**Na serveru neexistuje seznam účtů.** Vaše identita je pouze uvnitř vašeho zařízení.
To bude důležité v kapitole o zálohování (8).

### O "jednorázové identitě"

Pokud při vytváření zvolíte "jednorázovou identitu", získáte identitu, kterou nelze žádným způsobem obnovit.
Pokud zařízení ztratíte, resetujete nebo smažete data prohlížeče, identita je navždy pryč.
Zobrazuje se to i na obrazovce. Nevolte ji pro identitu, kterou chcete používat dlouho.

---

## 2. Spojení s druhou osobou

Existují tři způsoby, jak se spojit s osobou, se kterou chcete mluvit.

- **Předat své ID**: Sdělte své ID druhé osobě a nechte ji ho zadat.
- **QR kód**: Zobrazte zvací QR kód a nechte druhou osobu, aby jej naskenovala.
- **Zvací odkaz**: Zkopírujte zvací zprávu z "Pozvat přítele" a pošlete ji obvyklým způsobem (e-mailem apod.). Když druhá osoba odkaz otevře a zadá své jméno, můžete hned mluvit.

Pokud má i druhá osoba aplikaci otevřenou, můžete se připojit přímo a mluvit.

---

## 3. Konverzace

- Stačí napsat zprávu a odeslat ji. Můžete posílat i fotografie, samolepky a polohu.
- **Posílání souborů**: V konverzacích jeden na jednoho až 50 MB. Ve skupinách je to menší, přibližně 50 KB.
- Nebezpečné formáty souborů, například spustitelné soubory, se automaticky blokují.
- Pokud druhá osoba nemá aplikaci otevřenou, zpráva se stále zašifrovaná uloží do "schránky" a doručí se, až aplikaci otevře. Server, který schránku přepravuje, nemůže obsah číst. Dopisy, které nejsou nikdy doručeny, se automaticky smažou po **nejvýše 7 dnech**.
- Historii konverzací lze exportovat do souboru a importovat.

### Příkazy

Pokud do vstupního pole napíšete `/help`, zobrazí se seznam příkazů, které můžete použít (více než 60 druhů).
Některé operace, například nastavení a propojení zařízení, se provádějí příkazy.

---

## 4. Skupiny

- Skupina může mít až **1 000 lidí**.
- Vytvoříte ji pouhým zadáním názvu skupiny. Pozvánky probíhají přes "Odkaz pro pozvání do skupiny". Osoba, která odkaz obdrží, se může připojit zadáním svého jména.
- Soubory lze posílat i ve skupinách, ale limit je menší, přibližně 50 KB. Hlasové zprávy zatím ve skupinách posílat nelze.
- Pokud člen používá starou verzi aplikace, skupina nemůže používat novější, bezpečnější režim (skupina v5) a na obrazovce se zobrazí upozornění. Aktivuje se, až budou mít všichni nejnovější verzi.

---

## 5. Hovory

- Můžete vést hlasové a videohovory jeden na jednoho. Existují i skupinové hovory.
- **Potvrzovací kód hovoru**: Na obrazovce hovoru se zobrazí potvrzovací kód. Přečtěte si jej nahlas s druhou osobou a ověřte, že se na obou obrazovkách shoduje. Pokud se neshoduje, je možné, že někdo hovor odposlouchává. V takovém případě zavěste.
- Skupinové hovory někdy nelze zahájit, pokud aplikace všech nejsou v nejnovější verzi.

---

## 6. Více zařízení a účtů

- Chcete-li používat stejnou identitu na více zařízeních, propojíte zařízení příkazem `/link`.
- Můžete vytvořit více účtů a používat je pro různé účely (například pracovní a soukromé). Počet zařízení i účtů je zdarma a neomezený.
- **Jak vytvořit účet**: otevřete nastavení a klepněte na tlačítko „Přidat účet” v části „Účet”. Zadejte jméno a vyberte emoji jako ikonu — nový účet se vytvoří a automaticky se na něj přepnete.
- **Jak přepínat účty**: pokud máte dva nebo více účtů, úplně nahoře v seznamu kontaktů se zobrazí záložky účtů. Klepnutím na záložku se přepnete (na počítači můžete použít také Ctrl+1–9). Dlouhým stisknutím záložky ji můžete přejmenovat, změnit její ikonu nebo ji odstranit.
- Každý účet má své vlastní kontakty a klíče. Kontakty si vyměňujte pro každý účet zvlášť.
- Jazyk se automaticky vybírá z 8: angličtina, japonština, korejština, čínština (Tchaj-wan), španělština, thajština, indonéština a portugalština (Brazílie).

---

## 7. Nastavení pro zachování bezpečnosti

- **Automatický zámek**: Existuje nastavení, které se automaticky uzamkne při přepnutí karty.
- **Přístupová fráze ke klíči**: Klíč uvnitř zařízení můžete chránit zabalením do přístupové fráze. Při otevření aplikace budete vyzváni k jejímu zadání.
- **Blokování**: Obtěžující osoby můžete zablokovat. Zprávy od zablokované osoby k vám nedorazí.

---

## 8. Zálohování a obnova (nejdůležitější kapitola)

Vaše identita Breeze je pouze klíč uvnitř vašeho zařízení. Na serveru není seznam účtů a tvůrce nemá váš klíč také.
**Pokud zařízení ztratíte, ztratíte i svou identitu.** Pro důležitou identitu si vždy vytvořte zálohu.

### Vytvoření zálohy

1. Zvolte "Vytvořit zálohu".
2. Nastavte přístupovou frázi pro zálohu (alespoň 6 znaků).
3. Vyberte, kam se má uložit.
   - **Uložit do souboru**: Záložní soubor si uchovejte u sebe (doporučeno).
   - **Uložit na relé server**: Lze použít pouze tehdy, pokud to provozovatel daného relé povolil. Na výchozím relé to použít nelze. Existuje lhůta uchování, proto si zálohu vyzvedněte před jejím uplynutím.

Obsah zálohy je zašifrován. Server, na kterém je uložena, pracuje pouze se šifrovaným textem.

### Jak obnovit

Na novém zařízení obnovíte pomocí záložního souboru (nebo zálohy na relé serveru) a přístupové fráze, kterou jste nastavili.

### Upozornění

- **Pokud přístupovou frázi zapomenete, obnova není možná.** Ani tvůrce to nemůže napravit. Přístupovou frázi si zapište na jiné místo.
- **Jednorázovou identitu nelze obnovit, ani zálohou, ani obnovou.**
- Zálohu vytvořte znovu, když přidáte identity nebo vyměníte zařízení.

---

## 9. Schránka a úvahy o nákladech

- Dopisy pro osobu, která je offline, se ukládají zašifrované do "schránky" relé serveru (nejvýše 7 dní).
- Relé má limity pro zabránění zneužití (kolik lze zanechat a jak často). Po dosažení limitu nemůžete po dané období zanechávat nové dopisy, ale **již doručené dopisy nikdy nezmizí**. Na obrazovce se zobrazí důvod a doba, po kterou je třeba čekat.
- Pokud jste relé umístili na vlastní server, limity si určujete sami.

Rozsah záznamů, které zůstávají na straně serveru (vše se automaticky maže a obsah nelze číst):

| Věc | Jak dlouho zůstává |
|---|---|
| Nedoručené dopisy | Nejvýše 7 dní |
| Signály připojení | 5 minut |
| Záznamy adres a zařízení | 90 dní |
| Informace o skupinách a odběry oznámení | 30 dní |

---

## 10. Jak aktualizovat (verze pro stolní počítače)

1. Když je k dispozici nová verze, na obrazovce se zobrazí oznámení.
2. Stisknutím "Stáhnout" získáte novou verzi (neinstaluje se automaticky).
3. Po dokončení stahování stiskněte "Nainstalovat" a restartujte.

Pokud během aktualizace dojde k chybě (například nesouhlasí kontrola souboru), **aktualizace se zastaví a důvod se zobrazí na obrazovce**. Návrat ke staré verzi není možný.

---

## 11. Když se něco nedaří

| Příznak | Co zkontrolovat |
|---|---|
| Nelze odesílat zprávy | Zkontrolujte, zda hodiny vašeho zařízení nejsou špatně. Pokud je čas špatně, odeslání selže. |
| Nedosáhne druhé osoby | Čeká ve schránce, dokud druhá osoba aplikaci neotevře (nejvýše 7 dní). |
| Nelze odesílat soubory | Zkontrolujte, zda nepřekračujete limit velikosti (jeden na jednoho 50 MB, skupiny přibližně 50 KB) a zda soubor není blokován jako nebezpečný formát. |
| Potvrzovací kód hovoru se neshoduje | Zavěste a zavolejte znovu. Nepokračujte, dokud se neshoduje. |
| Zapomenutá přístupová fráze | Obnova není možná. Vytvořte novou identitu a znovu informujte své kontakty. |
| Ztracené zařízení | Pokud máte zálohu, můžete obnovit na novém zařízení. Pokud ne, bude to nová identita. |
| Zkušební stránka se neotevře (404) | V současné době je zastavena. Použijte verzi aplikace. |

Chyby prosím hlaste na [stránce Issues](https://github.com/shizukutanaka/Breeze/issues).

---

## 12. Sliby Breeze

- Žádné reklamy. Ani v aplikaci, ani nikde jinde.
- Žádné sledování. Žádná analýza používání, žádné reklamní mechanismy, žádný prodej dat — vůbec.
- Tvůrce nedrží žádná uživatelská data. Na straně serveru vůbec neexistuje seznam účtů.
- Konverzace jsou šifrovány mezi zařízeními. Server pracuje pouze s zapečetěnými obálkami, které nemůže číst.

Podrobné srovnání s jinými messengery je na "srovnávací stránce" v repozitáři, včetně bodů, v nichž Breeze prohrává (počet uživatelů, to, že neproběhl externí audit apod.).

---

*Tato příručka popisuje obsah k verzi Breeze v3.8.0.*
