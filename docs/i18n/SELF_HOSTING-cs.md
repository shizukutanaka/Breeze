# Průvodce vlastním hostingem (Self-Hosting)

**Číst v jiných jazycích**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · Čeština (tato stránka) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Existují dva způsoby, jak provozovat relé Breeze:

1. **Vlastní hosting (Node + Docker)** — relé na vašem vlastním počítači nebo
   VPS: jeden kontejner, jeden datový svazek, registrace ve výchozím nastavení
   uzavřená. Začněte zde, pokud je relé pro vás a vaše lidi.
2. **Cloudflare** — nasazení v oficiálním stylu na bezplatné úrovni
   Cloudflare (relé, které provozuje sám Breeze). Začněte tam, pokud chcete
   veřejné relé bez serveru, který byste museli udržovat.

Oba způsoby provozují identický kód handleru; relé je hloupá,
vyměnitelná schránka v obou případech a každý klient funguje s
každým relé.

## Vlastní hosting s Dockerem

```bash
# 1. Get the code
git clone https://github.com/shizukutanaka/Breeze.git && cd Breeze

# 2. Start it, with your own Breeze ID admitted (see "Registration"
#    below for how to find it — you can also start closed-to-everyone
#    and add IDs later)
BREEZE_ALLOWLIST=<your Breeze ID> docker compose up -d

# 3. Watch the first-boot log — it prints your relay identity
#    fingerprint; write it down (see "Relay identity")
docker compose logs breeze
```

Relé obsluhuje prosté HTTP na portu 8787 uvnitř kontejneru.
**TLS ukončete na reverzní proxy před ním** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): prohlížeče budou relé používat pouze
přes HTTPS/WSS. Když to uděláte, nastavte v `docker-compose.yml`
`TRUST_PROXY: "true"`, aby se omezování rychlosti klíčovalo podle skutečné adresy
klienta — a nikdy to nenastavujte bez takové proxy, protože hlavička,
které důvěřuje, je padělatelná kýmkoli, kdo se může ke vstupu dostat přímo.

Proti datovému svazku provozujte přesně **jeden** kontejner: omezovač
rychlosti je v paměti na proces a operace každé schránky jsou
serializovány uvnitř tohoto procesu, takže druhá replika by neměla
ani jednu z těchto vlastností. Škálujte tím, že jedinému procesu dáte větší počítač.

### Registrace: ve výchozím nastavení uzavřená

Vlastnoručně hostované relé, na které by se mohl registrovat kdokoli na internetu,
by znovu vytvořilo ekonomiku spamu/zneužívání, kterou mají limity oficiálního relé
kontrolovat, takže **balení Docker se dodává uzavřené**: soubor
compose předává `REGISTRATION_ALLOWLIST` (případně prázdný) a
pouze ID Breeze na něm mohou *vytvářet účty* (první nahrání
prekey). Uzavření registrace nikdy neovlivní lidi, kteří už na
relé sídlí — jejich nahrávání, vklady, rendezvous a polling nejsou
blokovány — a otevření registrace je výslovná volba, nikdy
výchozí.

- **Vaše ID Breeze** je 12znakový identifikátor ve vašem zvacím
  odkazu (prvních 12 znaků jeho hodnoty `pub`). Každé osoby,
  kterou zvete, se na její ID zeptejte stejným způsobem — ID je veřejný identifikátor,
  který si kontakty už vyměňují, ne tajemství.
- **Lidi přijmete** výčtem jejich ID: nastavte
  `BREEZE_ALLOWLIST=id1,id2,…` ve svém shellu nebo v souboru `.env` vedle
  `docker-compose.yml`, potom znovu `docker compose up -d`.
- **Začněte teď, přijímejte později**: bez nastaveného `BREEZE_ALLOWLIST`
  běží relé uzavřené pro všechny — protokol o spuštění to říká — a nikdo
  se nemůže registrovat, dokud ID nepřidáte.
- **Otevřené relé** (registrovat se může kdokoli): odkomentujte
  `REGISTRATION_OPEN: "1"` v `docker-compose.yml`. Ekonomiku
  zneužívání vlastníte vy, pokud to uděláte.

### Kvóta používání: na vlastním relé ji vypněte

Worker se dodává s povolenou **kvótou spravedlivého používání**: na
schránku nejvýše 10 000 vkladů/den a 200 000/měsíc (vklad je
jeden úplný cyklus doručení — viz `docs/COST_MODEL.md` §10 pro
zásady a čísla). Tento rámec existuje pro *sdílené výchozí
relé*, které je provozováno jako bezplatný vstup, jehož variabilní náklady by
provozovatel jinak nesl za všechny. **Na relé, které provozujete
pro sebe a své lidi, je rámec zbytečný — vypněte
jej**:

```bash
USAGE_QUOTA_ENABLED=false
```

Nastavte jej tam, kde vaše relé čte své prostředí (shell nebo
`.env` vedle `docker-compose.yml`, prostředí procesu Node,
nebo tajemství Cloudflare Pages). Pokud provozujete komunitní relé a rámec *chcete*,
existují dvě sousední ovládací prvky:
`USAGE_QUOTA_DAILY` a `USAGE_QUOTA_MONTHLY` přenastaví stropy.
Poznámky, na kterých záleží:

- Kvóta se vynucuje pouze tehdy, když schránky žijí v Durable
  Objects (`MAILBOX_BACKEND=do`, výchozí na tomto hostiteli); na
  backendu KV je to zdokumentovaný no-op.
- Po překročení stropu dostanou odesílatelé výslovné `429 USAGE_QUOTA_EXCEEDED`
  (s oknem a jeho limitem) namísto tichého zahození — zpráva
  zůstane v odesílatelově odchozí schránce a příjemce zůstane
  dosažitelný přes P2P a přes jakékoli jiné domovské relé.

### Identita relé

Při prvním spuštění relé vygeneruje trvalý identitní klíč Ed25519
*uvnitř datového svazku* a jeho otisk vytiskne do protokolu:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Otisk identifikuje *vaše* relé: předejte jej svým uživatelům
mimo pásmo (osobně, jiným kanálem), aby mohli rozpoznat
relé, které jim bylo předáno, jako to, které provozujete vy. Stejný otisk se
tiskne při každém spuštění; pokud se někdy změní, datový svazek byl
nahrazen — prošetřete to, než uživatelům řeknete, aby novému důvěřovali.

Klienti tento klíč automaticky ověřují a připínají (fáze 2 krok 4): při
prvním kontaktu klient vyzve relé, aby se klíčem podepsalo
(`/api/relay/attest`), ověřený klíč uloží k účtu a
při každé další relaci jej znovu ověří. Otisk, který klient zobrazuje
(v `/security` a v toastu při prvním připnutí), je odvozen ze
stejného klíče — porovnejte jej s výše uvedeným řádkem protokolu o spuštění. Pokud se klíč
někdy změní, klienti **přestanou s relé mluvit** a uživatele
varují; nikdy nepřipínají znovu potichu. Změnu otisku považujte za
lomovou událost: ve fázi 4 v aplikaci není žádné tlačítko "důvěřovat novému klíči",
takže po skutečné ztrátě svazku musí vaši uživatelé vymazat
uložená data aplikace pro svůj účet a při prvním kontaktu znovu připnout —
nový otisk nejprve oznamte mimo pásmo, jinak nedokážou odlišit
váš nový klíč od klíče útočníka.

### Zálohování a obnova

**Datový svazek je celý stav relé**: jeden soubor SQLite
obsahující adresář, schránky a identitní klíč relé.
Nic jiného zálohovat není.

```bash
# Back up: copy the database out of the (stopped) container
docker compose stop
docker cp "$(docker compose ps -aq breeze)":/data/breeze-relay.db ./breeze-relay-backup.db
docker compose start

# Restore: copy the backup back in as /data/breeze-relay.db before
# starting, and the relay serves identically — same fingerprint.
docker compose stop
docker cp ./breeze-relay-backup.db "$(docker compose ps -aq breeze)":/data/breeze-relay.db
docker compose start
```

### Aktualizace

```bash
git pull origin main
docker compose up -d --build
```

Stav žije ve svazku, ne v image, takže aktualizace se nikdy nedotkne
dat vašich uživatelů.

## Vlastní hosting s holým Node (bez Dockeru)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfigurace je pouze v proměnných prostředí — `server/README.md`
je uvádí všechny. Dva rozdíly oproti cestě Docker:

- **Datový soubor** je ve výchozím nastavení `./breeze-relay.db` (přepište pomocí
  `BREEZE_DB_PATH`); je to stejný stav v jednom souboru, identita relé
  v ceně. Zálohujte jej stejným způsobem: zastavit, zkopírovat, restartovat.
- **Registrace je otevřená, pokud ji nezavřete**: uzavřené výchozí nastavení
  je vlastností balení Docker. Chcete-li holý vstup zavřít, nastavte
  `REGISTRATION_ALLOWLIST=id1,id2` (nebo prázdnou hodnotu pro
  uzavřeno-pro-všechny); `REGISTRATION_OPEN=1` ji výslovně znovu otevře.

## Nasazení na Cloudflare

### Minimální nasazení ($0/měsíc, 5 minut)

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Deploy
wrangler pages deploy . --project-name=breeze

# 4. Create a KV namespace and declare it in wrangler.toml
wrangler kv:namespace create KV
# Copy the new namespace's ID and put it in wrangler.toml, replacing the
# id in the [[kv_namespaces]] section (binding = "KV"). Pages takes its
# bindings from wrangler.toml; a binding set only in the Dashboard is
# NOT applied while a wrangler.toml exists.
# Then deploy again so the binding takes effect:
wrangler pages deploy . --project-name=breeze

# 5. Visit https://breeze.pages.dev
```

**To je vše.** Všechny funkce fungují kromě push oznámení. Všimněte si,
že registrace při nasazení na Cloudflare je **otevřená**, pokud si
`REGISTRATION_ALLOWLIST` nenastavíte sami (viz `.env.example`); 
uzavřené-ve-výchozím-nastavení balení je cesta Docker výše.

### Co funguje za $0

| Funkce | Stav | Poznámky |
|---------|--------|-------|
| E2E šifrovaný chat | ✓ | Plný Double Ratchet |
| Zprávy P2P | ✓ | WebRTC DataChannel |
| Hlasové/videohovory | ✓ | WebRTC + bezplatný STUN |
| Relé TURN | ✓ | Open Relay (20GB/měsíc zdarma) |
| Skupiny (100 členů) | ✓ | Sender Key O(1) |
| Přenos souborů | ✓ | Až 50MB přes P2P |
| 8 jazyků | ✓ | EN + 7 úplných lokalizací, zjišťováno automaticky |
| Offline/PWA | ✓ | Service Worker |
| Push oznámení | ✗ | Vyžaduje klíče VAPID |

Fakturace více účtů (Lite/Plus/Pro) není k dispozici — viz
oddíl "Removed: multi-account billing" v [SECURITY.md](../../SECURITY.md). Každý účet získá
neomezené místní podúčty zdarma bez vazby na plán.

### Limity bezplatné úrovně

| Zdroj | Bezplatná úroveň | Spotřeba na aktivního uživatele |
|----------|-----------|----------------------|
| Požadavky Workeru | 100 000/den | ~500/den (polling + signalizace) |
| Čtení KV | 100 000/den | ~200/den |
| Zápisy KV | 1 000/den | ~350/den (optimalizováno) |
| Úložiště KV | 1 GB | ~10 KB/uživatel |
| Statické prostředky | Neomezené | ~400 KB (jediný HTML) |

**Podporuje ~3 současně aktivní uživatele na bezplatné úrovni.**

### Přidání volitelných funkcí

#### Push oznámení (zdarma)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Server TURN (pro restriktivní sítě)

TURN je způsob, jak hovory a spojení pouze přes relé (skrývající IP) překonávají
restriktivní NAT. Který TURN vaše relé rozdává, je **vaše** volba jako
provozovatele — Worker zkouší v tomto pořadí:

```bash
# Option A: Cloudflare Calls ($0.05/GB, global anycast)
wrangler pages secret put TURN_KEY_ID
wrangler pages secret put TURN_KEY_API_TOKEN

# Option B: your own coturn (HMAC time-limited credentials — the Worker
# mints a 24h username/credential per registered user from the secret)
#   coturn: use-auth-secret, static-auth-secret=<same secret>
wrangler pages secret put TURN_URL      # turn:your-server:3478
wrangler pages secret put TURN_SECRET

# Option C: static credentials (metered.ca, Twilio, …)
wrangler pages secret put TURN_URL
wrangler pages secret put TURN_USERNAME
wrangler pages secret put TURN_CREDENTIAL

# Option D: No config → free Open Relay (20GB/month). This is a third
# party's PUBLIC quota, shared with every unconfigured relay — fine for
# a first run, not a foundation. Opt out explicitly and callers get
# STUN only (some restrictive-NAT calls will then fail, visibly):
wrangler pages secret put TURN_OPENRELAY_FALLBACK   # set to: false
```

**Ověřte, co jste skutečně nakonfigurovali:** `GET /api/health` hlásí
účinný režim jako `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Starší boolean `turn` odráží pouze
`TURN_URL`, takže pro doporučenou možnost A čte `false` — použijte
`turnProvider`. Klienti zobrazují stejného poskytovatele v `/security`, takže
uživatel na záloze Open Relay vidí, že třetí strana přenáší jeho
média hovoru (pouze metadata — samotná média jsou šifrována DTLS-SRTP).

#### Zpevnění autentizace a cesta prostého relé

Nahrávání prekey nyní zachovává vlastnictví podpisu odděleně na
`prekey-owner:<userId>` **bez TTL**. Stávající vlastnictví svazku migruje líně
při příštím nahrání, než je přijata náhrada. Nové svazky Ed25519 také
tento záznam zakládají. Tyto záznamy zachovejte při prořezávání vypršelých svazků prekey:
čekání na vypršení svazku nesmí dovolit nového vlastníka. Rotace vyžaduje
nahrání podepsané předchozím vlastníkem, které váže nový klíč do stávajícího digestu
nahrání. Ověřené `/account/delete` smaže oba záznamy a může se ověřit
vůči vlastníkovi i po vypršení svazku. Reset ztraceného klíče vlastníka neexistuje.

U účtů s tímto záznamem musí nahrávání a polling zpráv/zalepených, zalepené ACK a
důkazy WebSocket schránky používat trvalého vlastníka. **Nepodepsané požadavky jsou odmítány,
i při `PREKEY_REQUIRE_AUTH=false` nebo `QUEUE_REQUIRE_AUTH=false`.**
Tyto příznaky si zachovávají svá stávající výchozí nastavení a starší sémantiku pro účty
bez vlastníka; výslovné přijetí `false` u nepodepsaných požadavků na nahrání/zařazení do fronty
zaloguje varování o zastarávání bez obsahu. Ostatní příznaky autentizace jsou beze změny.
WebSockety schránky stále vyžadují podpisy pro všechny.

Klient čeká na inicializaci podpisu před aktivitou ve frontě, včetně
spuštění vracejícího se účtu, povýšení vedoucího a opětovného připojení. Sdílené čekání je
omezeno na pět sekund. Nepodporované runtime pokračují nepodepsané okamžitě;
zaseknuté IDB/rozbalování klíče pokračuje nepodepsané po limitu a pak podepíše, až bude připraveno.
To udržuje smyčku pollingu naživu, **ne** jako obejití: účty s vlastníkem nemohou
přijímat z relé, dokud jejich podpisový klíč není použitelný. Nasaďte aktualizované klientské
prostředky společně s Workerem, abyste se vyhnuli starému závodu při spuštění.

Migrace nemůže obnovit vlastnictví ze svazku, který vypršel **předtím**, než byl jeho
vlastník zachován. První registrace zůstává TOFU. Záznamy vlastnictví používají
stávající backend KV: eventuální konzistence a souběžné zápisy nejsou touto změnou
učiněny linearizovatelnými. Důkazy si zachovávají stávající pětiminutové okno čerstvosti
a vazbu operace/užitečného zatížení; identické opakované pokusy v okně nejsou
protokolem jednorázové nonce.

Zápisy přítomnosti a vydávání přihlašovacích údajů TURN již vyžadují *registrovaný*
účet (přítomný svazek prekey) ve výchozím nastavení a každý klient se registruje
automaticky. Srdeční tepy přítomnosti navíc nesou důkaz vlastnictví Ed25519
(srdeční tep podepisuje pole, která ukládá), který Worker ověřuje,
kdykoli je předložen — `PRESENCE_SIGN_REQUIRE_AUTH=true` činí tento
důkaz povinným. Zbývající příznaky podpisu Ed25519 zůstávají opt-in;
`wrangler.toml` dokumentuje každý z nich a proč (klienti na runtime bez
WebCrypto Ed25519 nemohou podepisovat vůbec).

Starší cesta prostého relé (`/api/msg/send`, `/api/msg/poll`) je zastaralá: její
odpovědi nesou hlavičku `Deprecation: true` a zalepená cesta je
výchozí trasou pro každého současného klienta. Jakmile potvrdíte, že žádný živý
klient zálohu stále nepotřebuje, zakažte ji úplně:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Vlastní doména

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Škálování za bezplatnou úroveň

Když přerostete bezplatnou úroveň (placený plán Workers $5/měsíc):

| Zdroj | Placený plán |
|----------|-----------|
| Požadavky Workeru | 10 milionů/měsíc |
| Zápisy KV | 1 milion/měsíc |
| Úložiště KV | 1 GB v ceně |
| Čas CPU | 30 sekund/požadavek |

To podporuje **tisíce současných uživatelů**.

### Aktualizace

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Žádný krok sestavení. Žádné závislosti k instalaci. Prostě nasaďte.
