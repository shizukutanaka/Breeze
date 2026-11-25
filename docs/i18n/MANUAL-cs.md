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
- Chcete-li jej používat v prohlížeči, použijte verzi, kterou jste umístili na vlastní server (postup instalace je v samostatném dokumentu "Průvodce instalací"). Standardní nastavení používá Cloudflare, takže je vyžadován účet Cloudflare

Ke každému souboru je přiložen kontrolní součet (SHA256SUMS.txt). Pokud máte obavy, můžete ověřit, že součet staženého souboru souhlasí.

> **O ukázkové stránce**: Ukázka pro ověření, jak to funguje (https://breeze-469.pages.dev/), je k dispozici. To, co tam je umístěno, je stejný software, ale ukázka se může bez upozornění změnit nebo zastavit. Pro skutečné použití používejte verzi umístěnou na vašem vlastním serveru. Na verzi na vašem vlastním serveru zastavení ukázky nemá vliv.

### První nastavení

1. Otevřete aplikaci.
2. Stiskněte "Začít s náhodným ID". Tím jste připraveni. Není potřeba registrace ani telefonní číslo.

- Pokud do pole nad tlačítkem zadáte "Vaše jméno (zobrazované jméno)", začnete s tímto jménem. Tlačítko můžete stisknout i s prázdným polem. Zobrazované jméno můžete později změnit v části profilu v nastavení.
- Existuje také způsob, jak vytvořit identitu se jménem a Breeze ID, které si sami zvolíte. V takovém případě se vydá obnovovací fráze a zobrazí se na obrazovce. Obnovovací fráze jsou slova, která vám umožní tuto identitu obnovit na jiném zařízení. Zapište si ji na papír nebo na jiné bezpečné místo.
- Pokud chcete obnovit identitu, kterou jste vytvořili dříve, otevřete "Obnovit existující účet" a zobrazí se způsoby obnovy (obnova ze záložního souboru, obnova pomocí obnovovací fráze, obnova pomocí účtu + přístupové fráze).
- Po dokončení vytvoření se zobrazí karta, která vás navede k ochraně klíče přístupovou frází (po čase nezmizí). U důležité identity postupujte podle návodu a ochranu přidejte.

V tu chvíli se uvnitř vašeho zařízení vytvoří "klíč". Ten je vaší samotnou identitou.
**Na serveru neexistuje seznam účtů.** Vaše identita je pouze uvnitř vašeho zařízení.
To bude důležité v kapitole o zálohování (9).

### O bývalé "jednorázové identitě"

"Jednorázová identita" — identita bez jakéhokoli způsobu obnovy — je pryč. Při současných způsobech vytváření identity lze každou identitu chránit zálohou.

---

## 2. Spojení s druhou osobou

Stiskněte tlačítko "Přidat přítele" na obrazovce kontaktů a zobrazí se tři možnosti.

- **Přidat kontakt**: Zadejte ID druhé osoby nebo naskenujte QR kód.
- **Pozvat přítele**: Zkopírujte zvací odkaz a pošlete jej obvyklým způsobem (e-mailem apod.). Když druhá osoba odkaz otevře a zadá své jméno, můžete hned mluvit.
- **Vytvořit skupinu**: Stačí zadat název skupiny a vytvoříte ji (kapitola 4).

Vaše vlastní ID se zobrazí v úplné podobě, když otevřete svůj profil, a můžete jej zkopírovat tak, jak je. Můžete předat úplné ID, nejen krátké ID.

Pokud má i druhá osoba aplikaci otevřenou, můžete se připojit přímo a mluvit.

---

## 3. Konverzace

- Stačí napsat zprávu a odeslat ji. Můžete posílat i fotografie, samolepky a polohu.
- Otevřete "+" vedle vstupního pole a společně se zobrazí přílohy souborů, hlasové zprávy, hlasové zadávání, informace o poloze, samolepky, nastavení "odpověď není nutná" a další.
- **Posílání souborů**: V konverzacích jeden na jednoho až 50 MB. Ve skupinách je to menší, přibližně 50 KB.
- Nebezpečné formáty souborů, například spustitelné soubory, se automaticky blokují.
- Pokud druhá osoba nemá aplikaci otevřenou, zpráva se stále zašifrovaná uloží do "schránky" a doručí se, až aplikaci otevře. Server, který schránku přepravuje, nemůže obsah číst. Dopisy, které nejsou nikdy doručeny, se automaticky smažou po **nejvýše 7 dnech**.
- Historii konverzací lze exportovat do souboru a importovat.

### Čtení obrazovky

- **Stav odeslání**: Poznáte jej podle značky vedle zprávy. ✓ znamená odesláno, ✓ v kroužku znamená, že byla uložena do schránky, ✓✓ znamená, že dorazila druhé osobě, přečteno je modrá značka a selhání je červená značka. Rozlišují se i tvarem, nejen barvou.
- **Seznam kontaktů**: Čas vaší poslední konverzace se zobrazuje jako čas pro dnešek, "Včera" pro včerejšek, měsíc/den pro tento rok a rok/měsíc/den pro vše dřívější. Kontakty se zprávami, které jste nečetli, mají zvýrazněné jméno a čas.
- **Jména pro kontakty**: Otevřete "Informace o kontaktu" (v nabídce po kliknutí pravým tlačítkem na kontakt nebo v nabídce "⋮" konverzace) a můžete si pro daný kontakt nastavit vlastní jméno (přezdívku). Přezdívky se ukládají pouze v tomto zařízení a nikdy se neposílají kontaktu ani relé serveru. Když přezdívku nastavíte, zobrazí se vedle ní tlumenou barvou také jméno, které si kontakt sám nastavil. Toto druhé jméno můžete vypnout volbou "Zobrazit také jméno, které si každý kontakt sám nastavil" v části "Soukromí" v nastavení.
- **Vaše vlastní karta**: Na začátku seznamu je vaše vlastní profilová karta; stisknutím ji otevřete svůj profil. Posouvá se spolu se seznamem.
- **Spodní karty v telefonu**: Při šířce telefonu se ve spodní části obrazovky zobrazí pět karet: „Chaty“, „Hovory“, „Kontakty“, „Moje karta“ a „Nastavení“. Které karty se zobrazí, můžete vybrat po jedné v části „Spodní karty“ v nastavení (karta Chaty se zobrazuje vždy. I když kartu Nastavení skryjete, nastavení můžete stále otevřít tlačítkem s ozubeným kolem na obrazovce).
- **Záhlaví konverzace**: Z ikony hledání můžete hledat v konverzaci. Z nabídky "⋮" můžete zkontrolovat bezpečnostní číslo, ztlumit oznámení, připnout, vytvořit anketu a další.

### Příkazy

Pokud do vstupního pole napíšete `/`, zobrazí se návrhy příkazů. Napište `/help` pro seznam příkazů, které můžete použít (71 druhů).
Některé operace, například nastavení a propojení zařízení, se provádějí příkazy.

---

## 4. Skupiny

- Skupina může mít až **1 000 lidí**.
- Vytvoříte ji pouhým zadáním názvu skupiny v části "Vytvořit skupinu" v "Přidat přítele" (můžete ji také vytvořit příkazem `/newgroup`). Pozvánky probíhají přes "Odkaz pro pozvání do skupiny". Osoba, která odkaz obdrží, se může připojit zadáním svého jména.
- Soubory lze posílat i ve skupinách, ale limit je menší, přibližně 50 KB. Hlasové zprávy zatím ve skupinách posílat nelze.
- Pokud člen používá starou verzi aplikace, skupina nemůže používat novější, bezpečnější režim (skupina v5) a na obrazovce se zobrazí upozornění. Aktivuje se, až budou mít všichni nejnovější verzi.

---

## 5. Hovory

- Můžete vést hlasové a videohovory jeden na jednoho. Existují i skupinové hovory (až pro 8 lidí).
- **Potvrzovací kód hovoru**: Na obrazovce hovoru se zobrazí potvrzovací kód. Přečtěte si jej nahlas s druhou osobou a ověřte, že se na obou obrazovkách shoduje. Pokud se neshoduje, je možné, že někdo hovor odposlouchává. V takovém případě zavěste.
- Skupinové hovory někdy nelze zahájit, pokud aplikace všech nejsou v nejnovější verzi.
- **Historie hovorů**: Individuální hovory zanechávají historii pouze v tomto zařízení (druhá osoba, zda šlo o odchozí / příchozí / zmeškaný hovor, čas a délka hovoru. Nic z toho, co bylo řečeno, se neukládá). Historie se nikdy neposílá na server ani druhé osobě. Uchovává se až 200 záznamů a nejstarší se odstraňují jako první. Skupinové hovory se v historii nezobrazují.
- Historii otevřete v telefonu z karty „Hovory“. Když existuje zmeškaný hovor, který jste ještě neviděli, zobrazí se na kartě Hovory odznak s číslem, který zmizí, jakmile historii otevřete. Z řádku historie můžete otevřít konverzaci s danou osobou nebo zavolat zpět. Celou historii můžete smazat tlačítkem na obrazovce.
- **Historie hovorů není součástí zálohy.** Na novém zařízení začíná historie prázdná. Pokud nechcete, aby se historie uchovávala, vypněte v části „Soukromí“ v nastavení volbu „Uchovávat historii hovorů v tomto zařízení“ a samotné zaznamenávání se zastaví.

---

## 6. Více zařízení a účtů

- Chcete-li používat stejnou identitu na více zařízeních, propojíte zařízení příkazem `/link`.
- Můžete vytvořit více účtů a používat je pro různé účely (například pracovní a soukromé). Počet zařízení i účtů je zdarma a neomezený.
- **Jak vytvořit účet**: Stiskněte tlačítko "+" vedle karet účtů úplně nahoře v seznamu kontaktů. Zadejte jméno a vyberte ikonu emoji a nový účet se vytvoří a automaticky se na něj přepne.
- **Přepínání účtů**: Karty účtů se vždy zobrazují úplně nahoře v seznamu kontaktů. Stisknutím jedné přepnete (na počítači můžete přepínat i pomocí Ctrl+1–9). Stisknutím a podržením karty ji můžete přejmenovat, změnit její ikonu nebo ji smazat.
- Kontakty a klíče jsou pro každý účet oddělené. Kontakty si vyměňte znovu pro každý účet.
- Jazyk se automaticky vybírá z 51 jazyků včetně angličtiny podle jazyka vašeho zařízení.

---

## 7. Nastavení pro zachování bezpečnosti

Nastavení se otevírají jako vlastní obrazovka. Na telefonu je otevřete z karty "Nastavení" v dolní části obrazovky; na počítači tlačítkem ozubeného kola na obrazovce (můžete je otevřít i příkazem `/settings`). Akcí zpět se vrátíte na obrazovku, na které jste byli.

- **Automatický zámek**: Existuje nastavení, které se automaticky uzamkne při přepnutí karty.
- **Přístupová fráze ke klíči**: Klíč uvnitř zařízení můžete chránit zabalením do přístupové fráze. Při otevření aplikace budete vyzváni k jejímu zadání.
- **Zobrazit také jméno, které si každý kontakt sám nastavil**: V části "Soukromí". U kontaktu, kterému jste dali přezdívku, si můžete zvolit, zda se vedle ní zobrazí i jeho vlastní jméno (kapitola 3).
- **Blokování**: Obtěžující osoby můžete zablokovat. Zprávy od zablokované osoby k vám nedorazí.
- **Zda se má uchovávat historie hovorů**: Pomocí volby „Uchovávat historii hovorů v tomto zařízení“ v části „Soukromí“ můžete zaznamenávání historie hovorů zastavit (kapitola 5).
- **Viditelnost spodních karet**: V části „Spodní karty“ můžete spodní karty telefonu (Hovory / Kontakty / Moje karta / Nastavení) po jedné zobrazit nebo skrýt. Karta Chaty se zobrazuje vždy.

---

## 8. Baterie a nouzové situace (režimy napájení)

V nastavení "Režim napájení" si můžete zvolit, jak se baterie používá.

- **Automatický (úroveň baterie)**: Přepíná se automaticky podle toho, kolik baterie zbývá.
- **Normální**: Jako obvykle.
- **Úsporný**: Rozloží kontroly doručení na nejvýše jednou za 60 sekund a zastaví signál přítomnosti.
- **Nouzový (pro katastrofy)**: Rozloží kontroly doručení na nejvýše jednou za 10 minut. Použijte jej při katastrofě nebo jindy, když nemůžete nabíjet.

Baterii vybíjí ne množství komunikace, ale počet probuzení rádia. Proto se strana odesílání nerozkládá; pouze strana poslechu. Odesílání stále odchází okamžitě, jako vždy. Když začnete nabíjet, automaticky se posune o krok zpět směrem k lehčí straně.

Na zařízeních, která nemohou úroveň baterie číst automaticky (například prohlížeč na iPhonu), se "Automatický" chová jako Normální a ruční volba funguje tak, jak byla zvolena.

---

## 9. Zálohování a obnova (nejdůležitější kapitola)

Vaše identita Breeze je pouze klíč uvnitř vašeho zařízení. Na serveru není seznam účtů a tvůrce nemá váš klíč také.
**Pokud zařízení ztratíte, ztratíte i svou identitu.** Pro důležitou identitu si vždy vytvořte zálohu.

Zálohování a obnova se provádějí v části "Zálohování a obnova" v nastavení (tlačítka jsou "Vytvořit zálohu", "Obnovit zálohu" a "📂 Obnovit ze souboru"). Když poprvé přidáte kontakt, zobrazí se jen jednou karta, která vás vyzývá k vytvoření zálohy.

### Automatické zálohování

Nastavení "Automatické zálohování" je od začátku zapnuté. Když se vaše data změní, zašifrovaná záloha se automaticky odešle na relé server, který sami provozujete.

- Neodesílá se při každé změně: čeká 30 sekund po poslední změně a vše odešle najednou. Pokusy jsou od sebe vzdáleny nejméně 15 minut.
- Když jste offline, nic se neodesílá; změny se podrží a odešlou se, až se připojení vrátí a až aplikaci otevřete.
- Pro automatické odesílání je třeba na daném zařízení jednou zadat přístupovou frázi zálohy (když je to potřeba, v části nastavení se zobrazí tlačítko "Zadat přístupovou frázi"). **Přístupová fráze se neukládá.** Pamatuje se pouze po dobu, kdy je aplikace otevřená, a po jejím zavření zmizí. U identity s jednoduchou obnovou odesílání funguje tak, jak je, hned po zadání přístupové fráze při registraci nebo aktualizaci.
- Pokud relé server ukládání záloh nepodporuje, automatické zálohování neběží. To je uvedeno v části nastavení.
- Stav (kdy proběhlo poslední úspěšné odeslání, zda čekají změny, zda odeslání selhalo) je uveden v části nastavení.

### Vytvoření zálohy (ruční)

1. V části "Zálohování a obnova" v nastavení zvolte "Vytvořit zálohu".
2. Nastavte přístupovou frázi pro zálohu (alespoň 6 znaků).
3. Vyberte, kam se má uložit.
   - **Uložit do souboru**: Záložní soubor si uchovejte u sebe (doporučeno).
   - **Uložit na relé server**: Lze použít pouze tehdy, pokud to provozovatel daného relé povolil. Na výchozím relé to použít nelze. Existuje lhůta uchování, proto si zálohu vyzvedněte před jejím uplynutím.

Obsah zálohy je zašifrován. Server, na kterém je uložena, pracuje pouze se šifrovaným textem.

### Jak obnovit

Na novém zařízení obnovíte pomocí záložního souboru (nebo zálohy na relé serveru) a přístupové fráze, kterou jste nastavili.

Pokud jste svou identitu právě obnovili pomocí obnovovací fráze a záloha této identity je na relé serveru, najde se automaticky a budete dotázáni hlášením "Záloha nalezena". Pokud ji obnovíte, data v tomto zařízení se nahradí obsahem zálohy.

### Přechod na nové zařízení

Stiskněte tlačítko "Přechod na nové zařízení" v části "Zálohování a obnova" v nastavení a zobrazí se postup.

1. Na současném zařízení mějte zálohu na relé serveru (automatické zálohování, nebo "Vytvořit zálohu").
2. Na novém zařízení zvolte na první obrazovce způsob obnovy a zadejte svou obnovovací frázi (nebo název účtu a přístupovou frázi).
3. Až bude vaše identita zpět, záloha na serveru se najde automaticky a nabídne se obnova.

Nejsou potřeba žádné kabely ani předávání souborů.

### Upozornění

- **Pokud přístupovou frázi zapomenete, obnova není možná.** Ani tvůrce to nemůže napravit. Přístupovou frázi si zapište na jiné místo.
- Zadání přístupové fráze pro automatické zálohování je potřeba na každém zařízení. Na novém zařízení ji zadejte ještě jednou.
- Ruční zálohu vytvořte znovu, když se vaše identity rozšíří nebo když měníte zařízení.
- Historie hovorů není součástí zálohy. Když změníte zařízení, historie hovorů se na nové zařízení nepřesune.

---

## 10. Schránka a úvahy o nákladech

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

## 11. Jak aktualizovat (verze pro stolní počítače)

1. Když je k dispozici nová verze, na obrazovce se zobrazí oznámení.
2. Stisknutím "Stáhnout" získáte novou verzi (neinstaluje se automaticky).
3. Po dokončení stahování stiskněte "Nainstalovat" a restartujte.

Pokud během aktualizace dojde k chybě (například nesouhlasí kontrola souboru), **aktualizace se zastaví a důvod se zobrazí na obrazovce**. Návrat ke staré verzi není možný.

---

## 12. Když se něco nedaří

| Příznak | Co zkontrolovat |
|---|---|
| Nelze odesílat zprávy | Zkontrolujte, zda hodiny vašeho zařízení nejsou špatně. Pokud je čas špatně, odeslání selže. |
| Nedosáhne druhé osoby | Čeká ve schránce, dokud druhá osoba aplikaci neotevře (nejvýše 7 dní). |
| Nelze odesílat soubory | Zkontrolujte, zda nepřekračujete limit velikosti (jeden na jednoho 50 MB, skupiny přibližně 50 KB) a zda soubor není blokován jako nebezpečný formát. |
| Potvrzovací kód hovoru se neshoduje | Zavěste a zavolejte znovu. Nepokračujte, dokud se neshoduje. |
| Zapomenutá přístupová fráze | Obnova není možná. Vytvořte novou identitu a znovu informujte své kontakty. |
| Ztracené zařízení | Pokud máte zálohu, můžete obnovit na novém zařízení. Pokud ne, bude to nová identita. |
| Ukázková stránka se neotevře | Ukázka se může bez upozornění zastavit. Použijte verzi umístěnou na vašem vlastním serveru. |

Chyby prosím hlaste na [stránce Issues](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Sliby Breeze

- Žádné reklamy. Ani v aplikaci, ani nikde jinde.
- Žádné sledování. Žádná analýza používání, žádné reklamní mechanismy, žádný prodej dat — vůbec.
- Tvůrce nedrží žádná uživatelská data. Na straně serveru vůbec neexistuje seznam účtů.
- Konverzace jsou šifrovány mezi zařízeními. Server pracuje pouze s zapečetěnými obálkami, které nemůže číst.

Podrobné srovnání s jinými messengery je na "srovnávací stránce" v repozitáři, včetně bodů, v nichž Breeze prohrává (počet uživatelů, to, že neproběhl externí audit apod.).

---

*Tato příručka odráží stav Breeze k 25. 11. 2026.*
