# Saját üzemeltetési útmutató

**Más nyelven olvasás**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · Magyar (ez az oldal) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)

> **Mielőtt hozzákezdene: a szokásos beállításhoz Cloudflare-fiók szükséges.**
> Az útmutató szokásos beállítása — az alábbi Cloudflare-telepítés
> — a Cloudflare-en fut, ezért kezdés előtt legyen kész
> Cloudflare-fiókja. Ha nem szeretné a Cloudflare-t használni, az
> útmutató Docker- és natív Node-beállításaihoz nem kell
> Cloudflare-fiók.

Kétféleképpen futtatható egy Breeze közvetítő (relay):

1. **Saját üzemeltetés (Node + Docker)** — a közvetítő a saját gépén vagy
   VPS-én: egy konténer, egy adatkötet, a regisztráció alapértelmezés szerint
   zárt. Itt kezdje, ha a közvetítő Önnek és az embereinek szól.
2. **Cloudflare** — a hivatalos jellegű telepítés a Cloudflare
   ingyenes szintjén (az a közvetítő, amelyet maga a Breeze futtat). Ott kezdje, ha
   nyilvános közvetítőt szeretne, karbantartandó szerver nélkül.

Mindkettő ugyanazt a kezelőkódot futtatja; a közvetítő így is, úgy is egy buta,
felcserélhető postaláda, és minden kliens minden közvetítővel működik.

## Saját üzemeltetés Dockerrel

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

A közvetítő a konténeren belül a 8787-es porton sima HTTP-t szolgál ki.
**A TLS-t egy elé helyezett fordított proxyval (reverse proxy) zárja le** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): a böngészők a közvetítőt csak
HTTPS/WSS felett használják. Ha így tesz, állítsa be a `TRUST_PROXY: "true"` értéket a
`docker-compose.yml` fájlban, hogy a sebességkorlátozás a valódi kliens
címére épüljön — és soha ne állítsa be ilyen proxy nélkül, mert az a fejléc,
amelyben megbízik, bárki által hamisítható, aki közvetlenül eléri a bejáratot.

Pontosan **egy** konténert futtasson az adatkötethez: a sebesség-
korlátozó folyamatonként memóriában van, és minden postaláda műveletei
abban a folyamatban sorosítva vannak, így egy második replika egyik
tulajdonságot sem tartaná meg. A méretezést úgy végezze, hogy az egyetlen folyamatnak nagyobb gépet ad.

### Regisztráció: alapértelmezés szerint zárt

Egy saját üzemeltetésű közvetítő, amelyre az interneten bárki regisztrálhatna,
újra létrehozná azt a spam-/visszaélési gazdaságtant, amelynek kordában tartására
a hivatalos közvetítő korlátai léteznek, ezért **a Docker-csomagolás zártan érkezik**: a
compose fájl egy `REGISTRATION_ALLOWLIST` értéket ad át (lehet üres is), és
csak a rajta szereplő Breeze ID-k *hozhatnak létre fiókot* (első prekey
feltöltés). A regisztráció lezárása soha nem érinti azokat, akik már a
közvetítőn vannak otthon — az ő feltöltéseik, letétjeik, találkozásaik (rendezvous) és lekérdezéseik (poll) nem
kapuzottak —, és a regisztráció megnyitása kifejezett döntés, soha nem
az alapértelmezés.

- **A Breeze ID-je** a meghívó hivatkozásában szereplő 12 karakteres azonosító
  (a `pub` értékének első 12 karaktere). Minden meghívott személytől kérje el a sajátját
  ugyanígy — az ID nyilvános azonosító, amelyet a kapcsolattartók már eleve
  megosztanak egymással, nem titok.
- **Személyek felvétele** az ID-ik felsorolásával történik: állítsa be a
  `BREEZE_ALLOWLIST=id1,id2,…` értéket a shellben vagy egy `.env` fájlban a
  `docker-compose.yml` mellett, majd futtassa újra: `docker compose up -d`.
- **Indítás most, felvétel később**: ha nincs beállítva `BREEZE_ALLOWLIST`, a
  közvetítő mindenki előtt zárva fut — az indítási napló ezt is kimondja —, és senki
  sem regisztrálhat, amíg nem ad hozzá ID-kat.
- **Nyílt közvetítő** (bárki regisztrálhat): vegye ki a megjegyzésből a
  `REGISTRATION_OPEN: "1"` sort a `docker-compose.yml` fájlban. Ha így tesz, a visszaélési gazdaságtan az Öné.

### Felhasználási kvóta: a saját közvetítőjén kapcsolja ki

A worker **tisztességes használati kvótával** (fair-use usage quota) érkezik, engedélyezve: postaládánként
legfeljebb 10 000 letét/nap és 200 000/hónap (egy letét
egy teljes kézbesítési ciklus — a szabályzatot és a számokat lásd: `docs/COST_MODEL.md` §10). Ez a keret a *megosztott alapértelmezett
közvetítőnek* szól, amely ingyenes bejáratként fut, amelynek változó költségeit az
üzemeltetőnek kellene egyébként mindenki helyett viselnie. **Egy olyan közvetítőn, amelyet
saját magának és az embereinek futtat, a keretnek nincs értelme — kapcsolja
ki**:

```bash
USAGE_QUOTA_ENABLED=false
```

Állítsa be ott, ahol a közvetítő a környezetét olvassa (a shellben vagy
a `docker-compose.yml` melletti `.env` fájlban, a Node folyamat környezetében,
vagy a Cloudflare Pages titkaiban (secrets)). Két szomszédos beállítás is létezik, ha
közösségi közvetítőt futtat, és *mégis* szeretne keretet:
a `USAGE_QUOTA_DAILY` és a `USAGE_QUOTA_MONTHLY` a korlátokat hangolja át.
Fontos megjegyzések:

- A kvóta csak akkor érvényesül, ha a postaládák Durable
  Objects-ben élnek (`MAILBOX_BACKEND=do`, ami ezen a hoszton az alapértelmezés); a
  KV háttéren dokumentáltan hatástalan (no-op).
- A korlát felett a küldők kifejezett `429 USAGE_QUOTA_EXCEEDED` választ kapnak
  (az ablakkal és annak korlátjával) a néma eldobás helyett — a
  üzenet a küldő kimenő dobozában (outbox) marad, és a címzett továbbra is
  elérhető P2P-n és bármely más otthoni közvetítőn keresztül.

### A közvetítő személyazonossága (relay identity)

Az első indításkor a közvetítő egy állandó Ed25519 személyazonosító kulcsot hoz létre
*az adatköteten belül*, és az ujjlenyomatát kiírja a naplóba:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Az ujjlenyomat *az Ön* közvetítőjét azonosítja: adja meg a felhasználóinak
sávon kívül (out-of-band: személyesen, egy másik csatornán), hogy felismerjék
a nekik átadott közvetítőt mint azt, amelyet Ön futtat. Ugyanaz az ujjlenyomat
jelenik meg minden indításkor; ha valaha megváltozik, az adatkötetet
kicserélték — vizsgálja ki, mielőtt azt mondja a felhasználóknak, hogy bízzanak az újban.

A kliensek automatikusan ellenőrzik és rögzítik (pin) ezt a kulcsot (2. szakasz, 4. lépés): az
első kapcsolatfelvételkor a kliens felszólítja a közvetítőt, hogy írjon alá a kulccsal
(`/api/relay/attest`), az ellenőrzött kulcsot a fiókkal együtt tárolja, és
minden későbbi munkamenetben újra ellenőrzi. Az ujjlenyomat, amelyet a kliens mutat
(a `/security` alatt, és az első rögzítéskor felugró üzenetben (toast)) ugyanabból
a kulcsból származik — hasonlítsa össze a fenti indítási naplósorral. Ha a kulcs
valaha megváltozik, a kliensek **abbahagyják a kommunikációt a közvetítővel**, és figyelmeztetik a
felhasználót; soha nem rögzítenek újra némán. Az ujjlenyomat változását kezelje
törést okozó eseményként: a 4. lépésben nincs alkalmazáson belüli „megbízom az új kulcsban” gomb,
így valódi kötetvesztés után a felhasználóinak törölniük kell az alkalmazás
tárolt adatait a fiókjukhoz, és az első kapcsolatfelvételkor újra kell rögzíteniük —
előbb jelentse be az új ujjlenyomatot sávon kívül, különben nem tudják megkülönböztetni
az Ön új kulcsát egy támadóétól.

### Biztonsági mentés és visszaállítás

**Az adatkötet a közvetítő teljes állapota**: egyetlen SQLite fájl,
amely a címtárat, a postaládákat és a közvetítő személyazonosító kulcsát tartalmazza.
Semmi másról nem kell biztonsági mentést készíteni.

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

### Frissítés

```bash
git pull origin main
docker compose up -d --build
```

Az állapot a kötetben él, nem az image-ben, így a frissítés soha nem nyúl
a felhasználói adataihoz.

## Saját üzemeltetés csupasz Node-dal (Docker nélkül)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

A konfiguráció csak környezeti változókból áll — a `server/README.md`
mindegyiket felsorolja. Két különbség a Docker-úthoz képest:

- Az **adatfájl** alapértelmezése `./breeze-relay.db` (felülírható a
  `BREEZE_DB_PATH` változóval); ez ugyanaz az egyfájlos állapot, a közvetítő személyazonosságával
  együtt. Ugyanúgy készítsen róla mentést: leállítás, másolás, újraindítás.
- **A regisztráció nyílt, hacsak le nem zárja**: a zárt alapértelmezés
  a Docker-csomagolás tulajdonsága. Egy csupasz bejárat lezárásához állítsa be a
  `REGISTRATION_ALLOWLIST=id1,id2` értéket (vagy egy üres értéket a
  mindenki előtt záráshoz); a `REGISTRATION_OPEN=1` kifejezetten újra megnyitja.

## Cloudflare telepítés

### Minimális telepítés (0 dollár/hónap, 5 perc)

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

# 5. Visit your deployment's URL (https://<your-project>.pages.dev)
```

**Ennyi.** Minden funkció működik, a push értesítések kivételével. Vegye figyelembe,
hogy a Cloudflare-telepítésen a regisztráció **nyílt**, hacsak nem
állítja be maga a `REGISTRATION_ALLOWLIST` értéket (lásd `.env.example`); az
alapértelmezés szerint zárt csomagolás a fenti Docker-út.

### Mi működik 0 dollárért

| Funkció | Állapot | Megjegyzések |
|---------|--------|-------|
| E2E titkosított csevegés | ✓ | Teljes Double Ratchet |
| P2P üzenetküldés | ✓ | WebRTC DataChannel |
| Hang-/videohívások | ✓ | WebRTC + ingyenes STUN |
| TURN közvetítő | ✓ | Open Relay (20 GB/hónap ingyenes) |
| Csoportok (1 000 tag) | ✓ | Sender Key O(1) |
| Fájlátvitel | ✓ | Akár 50 MB P2P-n |
| 51 nyelv | ✓ | Angol beépítve + 50 teljes locale-fájl, automatikusan felismerve |
| Offline/PWA | ✓ | Service Worker |
| Push értesítések | ✗ | VAPID kulcsok szükségesek |

A többszintű fiókszámlázás (Lite/Plus/Pro) nem érhető el — lásd
a [SECURITY.md](../../SECURITY.md) „Removed: multi-account billing” szakaszát. Minden fiók
korlátlan helyi alfiókot kap ingyen, csomagkapuzás nélkül.

### Az ingyenes szint korlátai

| Erőforrás | Ingyenes szint | Felhasználás aktív felhasználónként |
|----------|-----------|----------------------|
| Worker kérések | 100 000/nap | ~500/nap (lekérdezés + jelzés) |
| KV olvasások | 100 000/nap | ~200/nap |
| KV írások | 1 000/nap | ~350/nap (optimalizálva) |
| KV tárhely | 1 GB | ~10 KB/felhasználó |
| Statikus eszközök | Korlátlan | ~894 KB (egyetlen HTML) |

**Körülbelül 3 egyidejű aktív felhasználót támogat az ingyenes szinten.**

### Opcionális funkciók hozzáadása

#### Push értesítések (ingyenes)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN szerver (korlátozó hálózatokhoz)

A TURN az a mód, ahogyan a hívások és a csak-közvetítős (IP-t rejtő) kapcsolatok átjutnak a
korlátozó NAT-okon. Azt, hogy a közvetítője melyik TURN-t adja ki, üzemeltetőként **Ön** választja
— a Worker sorban próbálja:

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

**Ellenőrizze, mit állított be ténylegesen:** a `GET /api/health` a tényleges
módot `turnProvider` néven jelenti (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). A régebbi `turn` boolean csak a
`TURN_URL` értéket tükrözi, ezért az ajánlott A opciónál `false`-t mutat — használja a
`turnProvider` értéket. A kliensek ugyanazt a szolgáltatót mutatják a `/security` alatt, így az a
felhasználó, aki az Open Relay tartalékon van, láthatja, hogy egy harmadik fél közvetíti a
hívási médiáját (csak metaadatok — maga a média DTLS-SRTP titkosítású).

#### Hitelesítés-keményítés és a sima közvetítői út

A prekey-feltöltések most külön őrzik az aláírási tulajdonjogot a
`prekey-owner:<userId>` alatt, **TTL nélkül**. A meglévő csomag-tulajdonjog lustán migrál
a következő feltöltéskor, mielőtt egy csere elfogadásra kerülne. Az új Ed25519 csomagok is
létrehozzák ezt a rekordot. Tartsa meg ezeket a rekordokat a lejárt prekey-csomagok ritkításakor:
a csomag lejáratára való várakozás nem engedélyezhet új tulajdonost. A forgatáshoz (rotation)
az előző tulajdonos által aláírt feltöltés szükséges, amely az új kulcsot a meglévő feltöltési
digestbe köti. A hitelesített `/account/delete` mindkét rekordot törli, és hitelesíthet
a tulajdonossal szemben a csomag lejárta után is. Elveszett tulajdonosi kulcsra nincs visszaállítás.

Az ilyen rekorddal rendelkező fiókoknál a feltöltésnek és az üzenet-/sealed-lekérdezésnek, a sealed ACK-nak és a
postaláda WebSocket bizonyítékoknak a tartós tulajdonost kell használniuk. **Az aláíratlan kérések
akkor is elutasításra kerülnek, ha a `PREKEY_REQUIRE_AUTH=false` vagy a `QUEUE_REQUIRE_AUTH=false`.**
Ezek a kapcsolók megtartják meglévő alapértelmezéseiket és örökölt szemantikájukat a tulajdonos nélküli
fiókoknál; az aláíratlan feltöltési/sor-kérések kifejezett `false` elfogadása
tartalom nélküli elavulási figyelmeztetést naplóz. A többi hitelesítési kapcsoló változatlan.
A postaláda WebSocketek továbbra is mindenkitől aláírást követelnek.

A kliens megvárja az aláírás inicializálását a sor-tevékenység előtt, beleértve a
visszatérő fiók indítását, a vezetővé előléptetést (leader promotion) és az újracsatlakozást. A megosztott várakozás
öt másodpercben korlátozott. A nem támogatott futtatókörnyezetek aláírás nélkül folytatnak azonnal;
az elakadt IDB-/kulcskicsomagolás a korlát után aláírás nélkül folytat, majd aláír, amikor kész.
Ez életben tartja a lekérdezési hurkot, **nem** megkerülés: a tulajdonossal rendelkező fiókok nem
kaphatnak a közvetítőtől, amíg az aláíró kulcsuk nem használható. Telepítse a frissített kliens-
eszközöket a Workerrel együtt, hogy elkerülje a régi indítási versenyt.

A migráció nem tudja visszanyerni a tulajdonjogot egy olyan csomagból, amely **azelőtt** járt le, hogy a
tulajdonosát megőrizték volna. Az első regisztráció továbbra is TOFU marad. A tulajdonjogi rekordok a
meglévő KV háttért használják: az eventual consistency és az egyidejű írások nem válnak
ezzel a változással linearizálhatóvá. A bizonyítékok megtartják a meglévő ötperces frissességi
ablakot és a művelet-/terheléskötést; az ablakon belüli azonos ismétlések nem
egyszer használatos nonce protokollt jelentenek.

A jelenléti (presence) írások és a TURN hitelesítőadat-kiadás már alapértelmezés szerint *regisztrált*
fiókot követelnek (prekey csomag megléte), és minden kliens automatikusan regisztrál.
A jelenléti szívverések (heartbeat) ezen felül Ed25519 tulajdonjogi bizonyítékot hordoznak
(a beat aláírja a tárolt mezőket), amelyet a Worker ellenőriz,
amikor ilyet bemutatnak — a `PRESENCE_SIGN_REQUIRE_AUTH=true` ezt a
bizonyítékot kötelezővé teszi. A többi Ed25519-aláírási kapcsoló opt-in marad;
a `wrangler.toml` mindegyiket dokumentálja, és azt is, hogy miért (a WebCrypto Ed25519
nélküli futtatókörnyezeteken lévő kliensek egyáltalán nem tudnak aláírni).

Az örökölt sima közvetítő (`/api/msg/send`, `/api/msg/poll`) elavult: a válaszai
`Deprecation: true` fejlécet hordoznak, és a sealed út az
alapértelmezett útvonal minden jelenlegi kliens számára. Amint megerősítette, hogy egyetlen élő
kliensnek sincs már szüksége a tartalékra, tiltsa le teljesen:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Egyedi domain

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Méretezés az ingyenes szinten túl

Amikor kinövi az ingyenes szintet (5 dollár/hónap Workers Paid csomag):

| Erőforrás | Fizetős csomag |
|----------|-----------|
| Worker kérések | 10 millió/hónap |
| KV írások | 1 millió/hónap |
| KV tárhely | 1 GB benne foglaltatik |
| CPU-idő | 30 másodperc/kérés |

Ez **több ezer egyidejű felhasználót** támogat.

### Frissítés

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Nincs build lépés. Nincsenek telepítendő függőségek. Csak telepítés (deploy).
