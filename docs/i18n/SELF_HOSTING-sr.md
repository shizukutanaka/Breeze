# Водич за самостално хостовање

**Прочитајте на другом језику / Read in another language**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · Српски (ова страница) · [Hrvatski](SELF_HOSTING-hr.md)

> **Пре него што почнете: за стандардно постављање потребан је Cloudflare налог.**
> Стандардно постављање у овом водичу — постављање на Cloudflare
> у наставку — ради на Cloudflare-у, па пре почетка припремите
> Cloudflare налог. Ако не желите да користите Cloudflare,
> постављања са Docker-ом и голим Node-ом у овом водичу не
> захтевају Cloudflare налог.

Постоје два начина да се покрене Breeze релеј:

1. **Самостално хостовање (Node + Docker)** — релеј на вашој машини или
   VPS-у: један контејнер, један волумен података, регистрација је
   подразумевано затворена. Почните овде ако је релеј за вас и ваше људе.
2. **Cloudflare** — постављање у званичном стилу на бесплатном плану
   Cloudflare-а (релеј који сам Breeze покреће). Почните тамо ако желите
   јавни релеј без сервера који треба одржавати.

Оба покрећу идентичан код руковаоца; релеј је у оба случаја једноставно,
заменљиво поштанско сандуче, а сваки клијент ради са сваким релејом.

## Самостално хостовање са Docker-ом

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

Релеј служи обичан HTTP на порту 8787 унутар контејнера.
**Завршите TLS на обрнутом проксију испред њега** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): прегледачи ће релеј користити само
преко HTTPS/WSS. Када то урадите, подесите `TRUST_PROXY: "true"` у
`docker-compose.yml` тако да ограничавање брзине кључа по стварној адреси
клијента — и никада то не подешавајте без таквог проксија, јер заглавље
коме верује може фалсификовати свако ко може директно да дође до улаза.

Покрените тачно **један** контејнер на волумен података: ограничавач
брзине је у меморији по процесу и операције сваког поштанског сандучета
су серијализоване унутар тог процеса, па друга реплика не би имала
ниједно од тих својстава. Скалирајте тако што ћете том једном процесу
дати већу машину.

### Регистрација: подразумевано затворена

Самостално хостовани релеј на коме би свако са интернета могао да се
региструје поново би створио економију спама/злоупотребе коју границе
званичног релеја постоје да контролишу, па **Docker паковање се
испоручује затворено**: compose датотека прослеђује `REGISTRATION_ALLOWLIST`
(може бити празан) и само Breeze ID-ови на њему могу да *праве налоге*
(прво отпремање prekey-а). Затварање регистрације никада не утиче на људе
који су већ смештени на релеју — њихова отпремања, депозити, састанци и
упити нису ограђени — а отварање регистрације је изричит избор, никада
подразумевано.

- **Ваш Breeze ID** је идентификатор од 12 знакова у вашој вези позивнице
  (првих 12 знакова њене `pub` вредности). Од сваке особе коју позовете
  тражите њен на исти начин — ID је јавни идентификатор који контакти
  већ размењују, није тајна.
- **Примите људе** тако што ћете навести њихове ID-ове: подесите
  `BREEZE_ALLOWLIST=id1,id2,…` у вашој љусци или `.env` датотеци поред
  `docker-compose.yml`, затим поново `docker compose up -d`.
- **Почните сада, примите касније**: без подешеног `BREEZE_ALLOWLIST`-а,
  релеј ради затворен за све — дневник покретања то каже — и нико не може
  да се региструје док не додате ID-ове.
- **Отворени релеј** (свако може да се региструје): откључајте коментар
  `REGISTRATION_OPEN: "1"` у `docker-compose.yml`. Ако то урадите, економија
  злоупотребе је ваша.

### Квота коришћења: искључите је на свом релеју

Радник се испоручује са омогућеном **квотом фер коришћења**: по
поштанском сандучету, највише 10.000 депозита дневно и 200.000 месечно
(депозит је један потпун циклус доставе — видети `docs/COST_MODEL.md`
§10 за политику и бројеве). Тај оквир постоји за *заједнички подразумевани
релеј*, који се покреће као бесплатни улаз чије би променљиве трошкове
оператер иначе сносио за све. **На релеју који покрећете за себе и своје
људе, оквир је бесмислен — искључите га**:

```bash
USAGE_QUOTA_ENABLED=false
```

Подесите га где год ваш релеј чита своје окружење (љуска или
`.env` поред `docker-compose.yml`, окружење Node процеса,
или тајне Cloudflare Pages-а). Постоје два суседна дугмета ако
покрећете релеј заједнице и *желите* оквир:
`USAGE_QUOTA_DAILY` и `USAGE_QUOTA_MONTHLY` поново подешавају границе.
Напомене које су важне:

- Квота се примењује само када поштанска сандучад живе у Durable
  Objects (`MAILBOX_BACKEND=do`, подразумевано на овом хосту); на
  KV позадини то је документована операција без ефекта.
- Преко границе, пошиљаоци добијају изричит `429 USAGE_QUOTA_EXCEEDED`
  (са прозором и његовом границом) уместо тихог одбацивања — порука
  остаје у одлазном сандучету пошиљаоца, а прималац остаје доступан
  преко P2P и преко било ког другог кућног релеја.

### Идентитет релеја

При првом покретању релеј генерише трајни Ed25519 кључ идентитета
*унутар волумена података* и штампа његов отисак у дневнику:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Отисак идентификује *ваш* релеј: дајте га својим корисницима
ван канала (лично, преко другог канала) како би могли да препознају
релеј који им је предат као онај који ви покрећете. Исти отисак се
штампа при сваком покретању; ако се икада промени, волумен података
је замењен — истражите пре него што корисницима кажете да верују новом.

Клијенти аутоматски проверавају и причвршћују овај кључ (фаза 2, корак 4):
при првом контакту клијент изазива релеј да потпише кључем
(`/api/relay/attest`), чува проверени кључ уз налог и поново проверава
при свакој каснијој сесији. Отисак који клијент приказује
(под `/security`, и у тосту при првом причвршћивању) изведен је из
истог кључа — упоредите га са горњом линијом дневника покретања. Ако се
кључ икада промени, клијенти **престају да разговарају са релејом** и
упозоравају корисника; никада се поново не причвршћују тихо. Промену
отиска третирајте као преломни догађај: у кораку 4 нема дугмета у
апликацији «веруј новом кључу», па након стварног губитка волумена ваши
корисници морају да обришу сачуване податке апликације за свој налог и
поново се причврсте при првом контакту — прво објавите нови отисак ван
канала, иначе не могу да разликују ваш нови кључ од кључа нападача.

### Резервна копија и опоравак

**Волумен података је цело стање релеја**: једна SQLite датотека која
држи именик, поштанска сандучад и кључ идентитета релеја.
Нема ничег другог за резервну копију.

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

### Ажурирање

```bash
git pull origin main
docker compose up -d --build
```

Стање живи у волумену, а не у слици, па ажурирање никада не дира
податке ваших корисника.

## Самостално хостовање са голим Node-ом (без Docker-а)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Конфигурација је само променљиве окружења — `server/README.md`
их све наводи. Две разлике у односу на Docker пут:

- **Датотека података** подразумевано је `./breeze-relay.db` (премостите
  са `BREEZE_DB_PATH`); то је исто стање у једној датотеци, укључујући
  идентитет релеја. Направите јој резервну копију на исти начин:
  зауставите, копирајте, поново покрените.
- **Регистрација је отворена ако је не затворите**: затворено
  подразумевано је својство Docker паковања. Да бисте затворили голи
  улаз, подесите `REGISTRATION_ALLOWLIST=id1,id2` (или празну вредност
  за затворено за све); `REGISTRATION_OPEN=1` изричито поново отвара.

## Постављање на Cloudflare

### Минимално постављање (0 долара месечно, 5 минута)

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

**То је то.** Све функције раде осим push обавештења. Имајте на уму
да је регистрација на Cloudflare постављању **отворена** ако сами не
подесите `REGISTRATION_ALLOWLIST` (видети `.env.example`); паковање
затворено подразумевано је Docker пут изнад.

### Шта ради за 0 долара

| Функција | Статус | Напомене |
|---------|--------|-------|
| E2E шифровано ћаскање | ✓ | Потпун Double Ratchet |
| P2P размена порука | ✓ | WebRTC DataChannel |
| Гласовни/видео позиви | ✓ | WebRTC + бесплатан STUN |
| TURN релеј | ✓ | Open Relay (20GB месечно бесплатно) |
| Групе (1,000 чланова) | ✓ | Sender Key O(1) |
| Пренос датотека | ✓ | До 50MB преко P2P |
| 51 језик | ✓ | Енглески уграђен + 50 потпуних датотека локала, аутоматски детектовано |
| Ван мреже/PWA | ✓ | Service Worker |
| Push обавештења | ✗ | Потребни су VAPID кључеви |

Наплата за више налога (Lite/Plus/Pro) није доступна — видети
одељак «Removed: multi-account billing» у [SECURITY.md](../../SECURITY.md). Сваки налог добија
неограничене бесплатне локалне подналоге без ограничења плана.

### Границе бесплатног плана

| Ресурс | Бесплатни план | Коришћење по активном кориснику |
|----------|-----------|----------------------|
| Захтеви Worker-а | 100.000 дневно | ~500 дневно (упити + сигнализација) |
| KV читања | 100.000 дневно | ~200 дневно |
| KV писања | 1.000 дневно | ~350 дневно (оптимизовано) |
| KV складиште | 1 GB | ~10 KB по кориснику |
| Статички ресурси | Неограничено | ~894 KB (један HTML) |

**Подржава ~3 истовремено активна корисника на бесплатном плану.**

### Додавање опционих функција

#### Push обавештења (бесплатно)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN сервер (за рестриктивне мреже)

TURN је начин на који позиви и везе само преко релеја (са скривањем IP-а)
пролазе кроз рестриктивне NAT-ове. Који TURN ваш релеј даје је **ваш**
избор као оператера — Worker покушава, по реду:

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

**Проверите шта сте заправо конфигурисали:** `GET /api/health` извештава
стварни режим као `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Старији `turn` boolean одражава само
`TURN_URL`, па се за препоручену опцију A чита као `false` — користите
`turnProvider`. Клијенти приказују истог провајдера у `/security`, па
корисник на Open Relay резерви може да види да трећа страна преноси
медије његових позива (само метаподаци — сам медиј је шифрован
DTLS-SRTP-ом).

#### Ојачавање аутентификације и пут обичног релеја

Отпремања prekey-а сада чувају власништво потписа одвојено на
`prekey-owner:<userId>` **без TTL-а**. Власништво постојећег пакета
се лењо мигрира при следећем отпремању, пре него што се замена прихвати.
Нови Ed25519 пакети такође успостављају тај запис. Задржите ове записе
када чистите истекле prekey пакете: чекање истека пакета не сме дозволити
новог власника. Ротација захтева отпремање које је потписао претходни
власник, везујући нови кључ у постојећи сажетак отпремања. Аутентификовано
`/account/delete` брише оба записа и може да се аутентификује према
власнику чак и након истека пакета. Не постоји ресетовање изгубљеног
кључа власника.

За налоге са овим записом, отпремање и упити за поруке/запечаћене, запечаћени ACK и
WebSocket докази поштанског сандучета морају користити трајног власника. **Непотписани захтеви се
одбијају чак и са `PREKEY_REQUIRE_AUTH=false` или `QUEUE_REQUIRE_AUTH=false`.**
Те заставе задржавају постојеће подразумеване вредности и стару семантику за налоге
без власника; изричито `false` прихватање непотписаних захтева за отпремање/ред
записује упозорење о застаревању без садржаја. Остале заставе аутентификације су непромењене.
WebSocket-и поштанског сандучета и даље захтевају потписе за све.

Клијент чека иницијализацију потписивања пре активности реда, укључујући
покретање налога који се враћа, унапређење лидера и поновно повезивање. Заједничко чекање је
ограничено на пет секунди. Неподржана окружења за извршавање одмах настављају непотписано;
заглављено IDB/одмотавање кључа наставља непотписано након границе, затим потписује када је спремно.
Ово одржава петљу упита у животу, **није** заобилажење: налози са власником не могу
примати са релеја док њихов кључ за потписивање не буде употребљив. Поставите ажуриране клијентске
ресурсе заједно са Worker-ом да бисте избегли стару трку при покретању.

Миграција не може опоравити власништво из пакета који је истекао **пре** него што је његов
власник сачуван. Прва регистрација остаје TOFU. Записи власништва користе
постојећу KV позадину: евентуална конзистентност и истовремена писања се не чине
линеаризујућим овом променом. Докази задржавају постојећи прозор свежине од пет минута
и везивање операције/терета; идентична понављања унутар прозора нису
протокол једнократног nonce-а.

Писања присуства и издавање TURN акредитива већ захтевају *регистровани*
налог (присутан prekey пакет) подразумевано, а сваки клијент се региструје
аутоматски. Откуцаји присуства додатно носе Ed25519 доказ власништва
(откуцај потписује поља која чува), који Worker проверава
кад год се један представи — `PRESENCE_SIGN_REQUIRE_AUTH=true` чини тај
доказ обавезним. Остале заставе Ed25519 потписа остају опционе;
`wrangler.toml` документује сваку и зашто (клијенти на окружењима без
WebCrypto Ed25519 уопште не могу да потписују).

Застарели обични релеј (`/api/msg/send`, `/api/msg/poll`) је застарео: његови
одговори носе заглавље `Deprecation: true`, а запечаћени пут је
подразумевана рута за сваког тренутног клијента. Када потврдите да ниједан живи
клијент више не треба резерву, онемогућите га у потпуности:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Сопствени домен

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Скалирање изван бесплатног плана

Када прерастите бесплатни план (Workers Paid план од 5 долара месечно):

| Ресурс | Плаћени план |
|----------|-----------|
| Захтеви Worker-а | 10 милиона месечно |
| KV писања | 1 милион месечно |
| KV складиште | 1 GB укључено |
| CPU време | 30 секунди по захтеву |

Ово подржава **хиљаде истовремених корисника**.

### Ажурирање

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Без корака изградње. Без зависности за инсталирање. Само поставите.
