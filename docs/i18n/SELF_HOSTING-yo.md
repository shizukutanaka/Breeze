# Ìtọ́ni Fífi Sílẹ̀ lórí Sáfà Ara Rẹ

**Ka á ní èdè mìíràn**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · Yorùbá (ojúewé yìí) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


> **Ṣáájú kí o tó bẹ̀rẹ̀: ìṣètò déédéé nílò àkáǹtì Cloudflare.**
> Ìṣètò déédéé nínú ìwé ìtọ́ni yìí — fífi sílẹ̀ lórí Cloudflare
> ní ìsàlẹ̀ — ń ṣiṣẹ́ lórí Cloudflare, nítorí náà ṣètò àkáǹtì Cloudflare
> ṣáájú kí o tó bẹ̀rẹ̀. Tí o kò bá fẹ́ lo Cloudflare, àwọn ìṣètò Docker
> àti Node lásán nínú ìwé ìtọ́ni yìí kò nílò
> àkáǹtì Cloudflare.

Àwọn ọ̀nà méjì wà láti ṣiṣẹ́ olùgbé Breeze (relay):

1. **Fífi sílẹ̀ lórí sáfà ara ẹni (Node + Docker)** — olùgbé náà lórí ẹ̀rọ tìrẹ tàbí
   VPS: àpótí (container) kan, ìdìpọ̀ dátà kan, ìforúkọsílẹ̀ ní títì
   ní àbáwọlé. Bẹ̀rẹ̀ láti ìhín tí olùgbé náà bá jẹ́ tìrẹ àti ti àwọn ènìyàn rẹ.
2. **Cloudflare** — ìfiránṣẹ́ bíi ti òfin lórí ìwọ̀n ọ̀fẹ́ Cloudflare
   (olùgbé tí Breeze fúnra rẹ̀ ń ṣiṣẹ́). Bẹ̀rẹ̀ láti ibẹ̀ tí o bá fẹ́
   olùgbé gbogbo ènìyàn láìsí sáfà tí o ó tọ́jú.

Àwọn méjèèjì ń ṣiṣẹ́ kódù olùṣe kan náà; olùgbé jẹ́ àpótí ìwé aláìlọ́gbọ́n,
tí a lè pààrọ̀ rẹ̀ ní ọ̀nà méjèèjì, gbogbo àpù oníbàárà sì ń ṣiṣẹ́ pẹ̀lú
olúkúlùkù olùgbé.

## Fífi Sílẹ̀ lórí Sáfà Ara Ẹni pẹ̀lú Docker

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

Olùgbé náà ń ṣiṣẹ́ HTTP lásán lórí ibùdó 8787 nínú àpótí náà.
**Parí TLS ní ọ̀dọ̀ aṣojú ìyípadà (reverse proxy) níwájú rẹ̀** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): àwọn aṣàwákiri yóò lo olùgbé nìkan
nípasẹ̀ HTTPS/WSS. Nígbà tí o bá ṣe bẹ́ẹ̀, ṣètò `TRUST_PROXY: "true"` nínú
`docker-compose.yml` kí ìdínà ìwọ̀n ìbéèrè lè dá lórí àdírẹ́sì oníbàárà
gidi — má sì ṣe ṣètò rẹ̀ láéláé láìsí irú aṣojú bẹ́ẹ̀, nítorí àkọlé (header)
tí ó gbẹ́kẹ̀lé ni ẹnikẹ́ni tí ó lè dé ẹnu ọ̀nà tààrà lè ṣẹ̀dá rẹ̀.

Ṣiṣẹ́ àpótí **kan péré** sí ìdìpọ̀ dátà náà: olùdínà ìwọ̀n
wà nínú ìrántí fún ìlànà kọ̀ọ̀kan, àwọn iṣẹ́ àpótí ìwé kọ̀ọ̀kan sì wà ní ṣíṣe lẹ́sẹẹsẹ
nínú ìlànà yẹn, nítorí náà ẹ̀dà kejì kò ní pa ọ̀kan nínú
àwọn ohun ìní yẹn mọ́. Mú ìwọ̀n pọ̀ sí i nípa fífún ìlànà kan náà ní ẹ̀rọ tí ó tóbi jù.

### Ìforúkọsílẹ̀: ní títì ní àbáwọlé

Olùgbé tí a fi sílẹ̀ lórí sáfà ara ẹni tí ẹnikẹ́ni lórí íntánẹ́ẹ̀tì lè forúkọ sílẹ̀ lé e
yóò tún ṣẹ̀dá ọrọ̀-ajé ìfiránṣẹ́ aláìníláárí/ìlòkulò tí àwọn ààlà olùgbé òfin
wà láti ṣàkóso, nítorí náà **àpò Docker ń wá ní títì**: fáìlì
compose ń kọjá `REGISTRATION_ALLOWLIST` (tí ó lè ṣófo) àti
àwọn ID Breeze tí ó wà nínú rẹ̀ nìkan ni wọ́n lè *ṣẹ̀dá àwọn àkáǹtì* (ìgbéjáde prekey
àkọ́kọ́). Títì ìforúkọsílẹ̀ kò nípa rárá lórí àwọn ènìyàn tí wọ́n ti wà nílé
lórí olùgbé náà — ìgbéjáde wọn, ìfipamọ́ wọn, ìpàdé wọn àti ìbéèrè wọn kò ní
ìdínà — ṣíṣí ìforúkọsílẹ̀ sì jẹ́ àṣàyàn tí ó hàn gbangba, kì í ṣe àbáwọlé láé.

- **ID Breeze rẹ** ni àmì ìdánimọ̀ oníhàn 12 tí ó wà nínú ọ̀nà ìsopọ̀ ìpè rẹ
  (àwọn hánhan 12 àkọ́kọ́ ti iye `pub` rẹ̀). Béèrè lọ́wọ́ olúkúlùkù ẹni tí o pè
  tiwọn ní ọ̀nà kan náà — ID jẹ́ àmì ìdánimọ̀ gbogbo ènìyàn
  tí àwọn olùbáṣepọ̀ ti ń pààrọ̀ rẹ̀, kì í ṣe àṣírí.
- **Gbà àwọn ènìyàn** nípa kíkọ àwọn ID wọn sílẹ̀: ṣètò
  `BREEZE_ALLOWLIST=id1,id2,…` nínú shell rẹ tàbí fáìlì `.env` lẹ́gbẹ̀ẹ́
  `docker-compose.yml`, lẹ́yìn náà `docker compose up -d` lẹ́ẹ̀kan sí i.
- **Bẹ̀rẹ̀ ní báyìí, gbà ní ọjọ́ mìíràn**: láìsí ṣíṣètò `BREEZE_ALLOWLIST`, olùgbé náà
  ń ṣiṣẹ́ ní títì sí gbogbo ènìyàn — àkọsílẹ̀ ìbẹ̀rẹ̀ sọ bẹ́ẹ̀ — kò sì sí ẹni tí
  ó lè forúkọ sílẹ̀ títí o ó fi fi àwọn ID kún un.
- **Olùgbé ṣíṣí** (ẹnikẹ́ni lè forúkọ sílẹ̀): yọ àkọsílẹ̀ ìdáhùn kúrò ní
  `REGISTRATION_OPEN: "1"` nínú `docker-compose.yml`. Ìwọ ni o ní
  ọrọ̀-ajé ìlòkulò tí o bá ṣe bẹ́ẹ̀.

### Ààlà lílò: pa á lórí olùgbé tìrẹ

Worker náà ń wá pẹ̀lú **ààlà lílò lílo-òdodo** ní ṣíṣí: fún àpótí ìwé
kọ̀ọ̀kan, ní púpọ̀ jùlọ ìfipamọ́ 10,000 lójúmọ́ àti 200,000 lóṣù (ìfipamọ́ kan
ìyípo ìfiránṣẹ́ kíkún kan ni — wo `docs/COST_MODEL.md` §10 fún
ìmọ̀ àti àwọn nọ́mbà). Ìlànà yẹn wà fún *olùgbé àbáwọlé tí a pín*,
tí a ń ṣiṣẹ́ gẹ́gẹ́ bí ẹnu ọ̀nà ọ̀fẹ́ tí olùṣiṣẹ́ rẹ̀ ìbá ru owó rẹ̀ tí ó ń yípadà
fún gbogbo ènìyàn bí kò bá ṣe bẹ́ẹ̀. **Lórí olùgbé tí o ń ṣiṣẹ́
fún ara rẹ àti àwọn ènìyàn rẹ, ìlànà náà kò ní ìtumọ̀ — pa
á**:

```bash
USAGE_QUOTA_ENABLED=false
```

Ṣètò rẹ̀ níbikíbi tí olùgbé rẹ bá ń ka àyíká rẹ̀ (shell náà tàbí
`.env` lẹ́gbẹ̀ẹ́ `docker-compose.yml`, àyíká ìlànà Node,
tàbí àwọn àṣírí Cloudflare Pages). Àwọn bọ́tìnì aládùúgbò méjì wà tí o bá
ń ṣiṣẹ́ olùgbé àwùjọ tí o sì *fẹ́* ìlànà:
`USAGE_QUOTA_DAILY` àti `USAGE_QUOTA_MONTHLY` ń tún àwọn ààlà ṣètò.
Àwọn àkíyèsí tí ó ṣe pàtàkì:

- A ń mú ààlà náà ṣiṣẹ́ nìkan nígbà tí àwọn àpótí ìwé bá ń gbé nínú Durable
  Objects (`MAILBOX_BACKEND=do`, àbáwọlé lórí olùgbà yìí); lórí
  ẹ̀yìn KV, ó jẹ́ ohun tí a kọ sílẹ̀ pé kò ṣe nǹkan.
- Lẹ́yìn ààlà náà, àwọn olùránṣẹ́ ń gba `429 USAGE_QUOTA_EXCEEDED` tí ó hàn gbangba
  (pẹ̀lú fèrèsé náà àti ààlà rẹ̀) dípò ìjúù sílẹ̀ ní ìdákẹ́jẹ́ẹ́ — ìránṣẹ́ náà
  ń dúró nínú àpótí ìjáde olùránṣẹ́, olùgbà náà sì ń ṣí sílẹ̀ fún
  wíwọlé nípasẹ̀ P2P àti nípasẹ̀ olúkúlùkù olùgbé ilé mìíràn.

### Ìdánimọ̀ olùgbé

Ní ìbẹ̀rẹ̀ àkọ́kọ́ olùgbé náà ń ṣẹ̀dá kọ́kọ́rọ́ ìdánimọ̀ Ed25519 tí ó dúró pẹ́
*ninú ìdìpọ̀ dátà* ó sì ń tẹ àmì ìka rẹ̀ (fingerprint) sínú àkọsílẹ̀:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Àmì ìka náà ń ṣe ìdánimọ̀ olùgbé *tìrẹ*: fún àwọn olùlò rẹ ní
ẹ̀yìn ọ̀nà (fúnra ẹni, nípasẹ̀ ọ̀nà mìíràn) kí wọ́n lè dá
olùgbé tí a fi lé wọn lọ́wọ́ mọ̀ gẹ́gẹ́ bí èyí tí ìwọ ń ṣiṣẹ́. Àmì ìka kan náà
ń jáde ní gbogbo ìbẹ̀rẹ̀; tí ó bá yípadà rí, a ti rọ́pò ìdìpọ̀ dátà náà
— ṣe ìwádìí ṣáájú kí o tó sọ fún àwọn olùlò láti gbẹ́kẹ̀lé èyí tuntun.

Àwọn àpù oníbàárà ń fìdí kọ́kọ́rọ́ yìí múlẹ̀ wọ́n sì ń so ó mọ́ fúnra wọn (ìpele-2 ìgbésẹ̀ 4): ní
ìbáṣepọ̀ àkọ́kọ́ àpù kan ń pè olùgbé níjà láti fọwọ́ sí i pẹ̀lú kọ́kọ́rọ́ náà
(`/api/relay/attest`), ó ń pa kọ́kọ́rọ́ tí a fìdí rẹ̀ múlẹ̀ mọ́ pẹ̀lú àkáǹtì náà, ó sì
ń tún fìdí rẹ̀ múlẹ̀ ní gbogbo ìjókòó tí ó tẹ̀lé e. Àmì ìka tí àpù náà ń fi hàn
(lábẹ́ `/security`, àti nínú ìfitónilétí kékeré ní ìsomọ́ àkọ́kọ́) ni a mú láti
kọ́kọ́rọ́ kan náà — fi wé ìlà àkọsílẹ̀ ìbẹ̀rẹ̀ tí ó wà lókè. Tí kọ́kọ́rọ́ náà bá yípadà rí,
àwọn àpù oníbàárà **ń dá ọ̀rọ̀ sísọ pẹ̀lú olùgbé dúró** wọ́n sì ń kìlọ̀ fún
olùlò; wọn kò ní tún so ó mọ́ ní ìdákẹ́jẹ́ẹ́ láé. Mú ìyípadà àmì ìka bí
ìṣẹ̀lẹ̀ ìfọ́: kò sí bọ́tìnì "gbẹ́kẹ̀lé kọ́kọ́rọ́ tuntun náà" nínú àpù ní
ìgbésẹ̀ 4, nítorí náà lẹ́yìn àdánù ìdìpọ̀ gidi àwọn olùlò rẹ gbọ́dọ̀ pa
dátà tí àpù ti pa mọ́ fún àkáǹtì wọn rẹ́ kí wọ́n sì tún so ó mọ́ ní ìbáṣepọ̀ àkọ́kọ́ —
kéde àmì ìka tuntun náà ní ẹ̀yìn ọ̀nà ṣáájú, bí kò ṣe bẹ́ẹ̀ wọn kò ní lè ya
kọ́kọ́rọ́ tuntun rẹ sọ́tọ̀ kúrò lọ́dọ̀ ti olùkọlù.

### Ìpamọ́ àfikún & ìgbàpadà

**Ìdìpọ̀ dátà náà ni gbogbo ipò olùgbé náà**: fáìlì SQLite kan
tí ó ní ìwé àdírẹ́sì, àwọn àpótí ìwé, àti kọ́kọ́rọ́ ìdánimọ̀ olùgbé.
Kò sí ohun mìíràn tí a ó pamọ́ sí àfikún.

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

### Ìmúdójúìwọ̀n

```bash
git pull origin main
docker compose up -d --build
```

Ipò ń gbé nínú ìdìpọ̀ náà, kì í ṣe nínú àwòrán náà, nítorí náà ìmúdójúìwọ̀n kò ní fọwọ́ kan
dátà àwọn olùlò rẹ láé.

## Fífi Sílẹ̀ lórí Sáfà Ara Ẹni pẹ̀lú Node Lásán (láìsí Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Ìṣètò jẹ́ àwọn oníyípadà àyíká nìkan — `server/README.md`
ń ṣàkọsílẹ̀ gbogbo wọn. Àwọn ìyàtọ̀ méjì sí ọ̀nà Docker:

- **Fáìlì dátà** ní àbáwọlé jẹ́ `./breeze-relay.db` (rọ́pò rẹ̀ pẹ̀lú
  `BREEZE_DB_PATH`); ó jẹ́ ipò fáìlì-kan kan náà, ìdánimọ̀ olùgbé
  wà nínú rẹ̀. Pamọ́ rẹ̀ sí àfikún ní ọ̀nà kan náà: dúró, da kọ, tún bẹ̀rẹ̀.
- **Ìforúkọsílẹ̀ ṣí sílẹ̀ àyàfi tí o bá tì í**: àbáwọlé títì
  jẹ́ ohun ìní àpò Docker. Láti ti ẹnu ọ̀nà lásán, ṣètò
  `REGISTRATION_ALLOWLIST=id1,id2` (tàbí iye ṣófo fún
  títì-sí-gbogbo-ènìyàn); `REGISTRATION_OPEN=1` ń tún ṣí i ní gbangba.

## Ìfiránṣẹ́ Cloudflare

### Ìfiránṣẹ́ Tí ó Kéré Jùlọ ($0/oṣù, ìṣẹ́jú 5)

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

**Ìyẹn nìkan ni.** Gbogbo àwọn iṣẹ́ ń ṣiṣẹ́ àyàfi àwọn ìfitónilétí títì (push). Ṣàkíyèsí
pé ìforúkọsílẹ̀ lórí ìfiránṣẹ́ Cloudflare **ṣí sílẹ̀** àyàfi tí o bá
ṣètò `REGISTRATION_ALLOWLIST` fúnra rẹ (wo `.env.example`); àpò
tí ó wà ní títì ní àbáwọlé ni ọ̀nà Docker tí ó wà lókè.

### Ohun Tí ó Ń Ṣiṣẹ́ ní $0

| Iṣẹ́ | Ipò | Àwọn àkíyèsí |
|---------|--------|-------|
| Ìbánisọ̀rọ̀ ìpamọ́ E2E | ✓ | Double Ratchet kíkún |
| Ìránṣẹ́ P2P | ✓ | WebRTC DataChannel |
| Àwọn ìpè ohùn/fídíò | ✓ | WebRTC + STUN ọ̀fẹ́ |
| Olùgbé TURN | ✓ | Open Relay (20GB/oṣù ọ̀fẹ́) |
| Àwọn ẹgbẹ́ (ọmọ ẹgbẹ́ 1,000) | ✓ | Sender Key O(1) |
| Gbígbé fáìlì | ✓ | Títí di 50MB nípasẹ̀ P2P |
| Àwọn èdè 51 | ✓ | Gẹ̀ẹ́sì tí a kọ́ sínú rẹ̀ + àwọn fáìlì ààyè gidi 50 kíkún, a ń ṣàwárí fúnra wọn |
| Àìsí ayélujára/PWA | ✓ | Service Worker |
| Àwọn ìfitónilétí títì | ✗ | Ó nílò àwọn kọ́kọ́rọ́ VAPID |

Ìsanwó àkáǹtì-púpọ̀ (Lite/Plus/Pro) kò sí — wo
apá "Removed: multi-account billing" ti [SECURITY.md](../../SECURITY.md). Àkáǹtì kọ̀ọ̀kan ń gba
àwọn àkáǹtì kékeré àdúgbò láìsí ààlà ọ̀fẹ́ láìsí ìdínà ètò.

### Àwọn Ààlà Ìwọ̀n Ọ̀fẹ́

| Ohun èlò | Ìwọ̀n Ọ̀fẹ́ | Lílo fún Olùlò Aláṣiṣẹ́ Kọ̀ọ̀kan |
|----------|-----------|----------------------|
| Àwọn ìbéèrè Worker | 100,000/ọjọ́ | ~500/ọjọ́ (ìbéèrè ìgbàdégbà + ìfàmìsí) |
| Àwọn kíka KV | 100,000/ọjọ́ | ~200/ọjọ́ |
| Àwọn kíkọ KV | 1,000/ọjọ́ | ~350/ọjọ́ (a ti mú dára sí i) |
| Ìpamọ́ KV | 1 GB | ~10 KB/olùlò |
| Àwọn ohun èlò dídúró | Láìsí ààlà | ~894 KB (HTML kan) |

**Ó ń ṣàtìlẹ́yìn ~àwọn olùlò aláṣiṣẹ́ 3 ní ìgbà kan náà ní ìwọ̀n ọ̀fẹ́.**

### Fífi Àwọn Iṣẹ́ Àṣàyàn Kún Un

#### Àwọn Ìfitónilétí Títì (ọ̀fẹ́)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Sáfà TURN (fún àwọn nẹ́tíwọ́ọ̀kì tí ó ní ìdínà)

TURN ni bí àwọn ìpè àti àwọn ìsopọ̀ olùgbé-nìkan (ìpamọ́ IP) ṣe ń kọjá
àwọn NAT tí ó ní ìdínà. Èyí tí TURN olùgbé rẹ bá ń fúnni jẹ́ àṣàyàn **tìrẹ**
gẹ́gẹ́ bí olùṣiṣẹ́ — Worker náà ń gbìyànjú, ní ìṣe lẹ́sẹẹsẹ:

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

**Fìdí ohun tí o ṣètò ní tòótọ́ múlẹ̀:** `GET /api/health` ń ròyìn
ọ̀nà tí ó ṣiṣẹ́ gẹ́gẹ́ bí `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). Boolean àtijọ́ `turn` nìkan ń ṣàfihàn
`TURN_URL`, nítorí náà ó ń ka `false` fún Àṣàyàn A tí a gbani nímọ̀ràn — lo
`turnProvider`. Àwọn àpù oníbàárà ń fi olùpèsè kan náà hàn nínú `/security`, nítorí náà
olùlò tí ó wà lórí àfikún Open Relay lè rí i pé ẹgbẹ́ kẹta ń gbé
àwọn ohun èlò ìpè rẹ̀ (ìwífún àkópọ̀ nìkan — àwọn ohun èlò fúnra wọn wà ní ìpamọ́ DTLS-SRTP).

#### Ìmúṣẹ Ìfìdímúlẹ̀ & Ọ̀nà Olùgbé Lásán

Àwọn ìgbéjáde prekey ń pa ìní ìfọwọ́sí mọ́ ní ọ̀tọ̀ọ̀tọ̀ ní báyìí ní
`prekey-owner:<userId>` láìsí **TTL**. Ìní àdìpọ̀ tí ó wà tẹ́lẹ̀ ń ṣí lọ ní ọ̀nà fífẹ́
ní ìgbéjáde tí ó tẹ̀lé e, ṣáájú kí a tó gbà àfikún. Àwọn àdìpọ̀ Ed25519 tuntun náà ń
dá àkọsílẹ̀ yẹn sílẹ̀. Pa àwọn àkọsílẹ̀ yìí mọ́ nígbà tí o bá ń gé àwọn àdìpọ̀ prekey tí ó ti pé:
dídúró fún ìpé àdìpọ̀ kò gbọ́dọ̀ gba olóni tuntun láàyè. Ìyípo nílò
ìgbéjáde tí olóni àtijọ́ fọwọ́ sí, tí ó ń so kọ́kọ́rọ́ tuntun náà mọ́ sínú àkópọ̀ ìgbéjáde tí ó wà.
`/account/delete` tí a fìdí rẹ̀ múlẹ̀ ń pa àwọn àkọsílẹ̀ méjèèjì rẹ́ ó sì lè fìdí ara rẹ̀ múlẹ̀
sí olóni kódà lẹ́yìn ìpé àdìpọ̀. Kò sí àtúntò kọ́kọ́rọ́-olóni tí ó sọnù.

Fún àwọn àkáǹtì tí ó ní àkọsílẹ̀ yìí, ìgbéjáde àti ìbéèrè ìránṣẹ́/sealed, ACK sealed àti
àwọn ẹ̀rí WebSocket àpótí ìwé gbọ́dọ̀ lo olóni tí ó dúró pẹ́. **A ń kọ̀ àwọn ìbéèrè tí a kò fọwọ́ sí
kódà pẹ̀lú `PREKEY_REQUIRE_AUTH=false` tàbí `QUEUE_REQUIRE_AUTH=false`.**
Àwọn àsíá wọ̀nyí ń pa àwọn àbáwọlé àtijọ́ wọn àti ìtumọ̀ ogún mọ́ fún àwọn àkáǹtì
láìsí olóni; gbígbà `false` tí ó hàn gbangba ti àwọn ìbéèrè ìgbéjáde/ìlà tí a kò fọwọ́ sí
ń kọ ìkìlọ̀ ìdínkù lílò tí kò ní àkóónú sílẹ̀. Àwọn àsíá ìfìdímúlẹ̀ mìíràn kò yípadà.
Àwọn WebSocket àpótí ìwé ṣì ń béèrè ìfọwọ́sí fún gbogbo ènìyàn.

Àpù oníbàárà ń dúró de ìbẹ̀rẹ̀ ìfọwọ́sí ṣáájú iṣẹ́ ìlà, pẹ̀lú
ìbẹ̀rẹ̀ àkáǹtì tí ó ń padà, ìgbéga aṣáájú àti àtúnsopọ̀. Ìdúró tí a pín
ní ààlà ní ìṣẹ́jú àáyá márùn-ún. Àwọn àyíká ìṣiṣẹ́ tí a kò ṣàtìlẹ́yìn ń tẹ̀síwájú láìsí ìfọwọ́sí lẹ́sẹ̀kẹsẹ̀;
IDB/ṣíṣí kọ́kọ́rọ́ tí ó dì ń tẹ̀síwájú láìsí ìfọwọ́sí lẹ́yìn ààlà náà, lẹ́yìn náà ó ń fọwọ́ sí nígbà tí ó bá ti ṣetán.
Èyí ń pa ìyípo ìbéèrè ìgbàdégbà mọ́ ní ààyè, **kì í ṣe** ọ̀nà ìpadàbọ̀: àwọn àkáǹtì tí olóni ṣàtìlẹ́yìn
kò lè gbà láti ọ̀dọ̀ olùgbé títí kọ́kọ́rọ́ ìfọwọ́sí wọn yóò fi ṣeé lò. Fi àwọn ohun èlò àpù tí a mú dójúìwọ̀n
ránṣẹ́ lẹ́gbẹ̀ẹ́ Worker náà láti yẹra fún ìdíje ìbẹ̀rẹ̀ àtijọ́.

Ìṣípo kò lè gbà ìní padà láti inú àdìpọ̀ tí ó pé **ṣáájú** kí a
tó pa olóni rẹ̀ mọ́. Ìforúkọsílẹ̀ àkọ́kọ́ ṣì jẹ́ TOFU. Àwọn àkọsílẹ̀ ìní ń lo
ẹ̀yìn KV tí ó wà: ìbámu ìkẹyìn àti àwọn ìkọ tí ó ń ṣẹlẹ̀ ní ìgbà kan náà kò ní
di onílà nípa ìyípadà yìí. Àwọn ẹ̀rí ń pa fèrèsé ìtura ìṣẹ́jú márùn-ún tí ó wà mọ́
àti ìsomọ́ iṣẹ́/àkóónú; àwọn ìgbìyànjú kan náà nínú fèrèsé kì í ṣe
ìlànà nonce ìgbà-kan.

Àwọn ìkọ wíwà àti ìfúnni ní ìwé-ẹ̀rí TURN ti ń béèrè àkáǹtì *tí a forúkọ sílẹ̀*
(àdìpọ̀ prekey wà) ní àbáwọlé, gbogbo àpù sì ń forúkọ sílẹ̀
fúnra wọn. Àwọn ìlù ọkàn wíwà ní àfikún ń gbé ẹ̀rí ìní Ed25519
(ìlù náà ń fọwọ́ sí àwọn pápá tí ó pa mọ́), èyí tí Worker ń fìdí rẹ̀ múlẹ̀
nígbàkúgbà tí a bá gbé ọ̀kan kalẹ̀ — `PRESENCE_SIGN_REQUIRE_AUTH=true` mú
ẹ̀rí yẹn di dandan. Àwọn àsíá ìfọwọ́sí Ed25519 tí ó kù ṣì jẹ́ àṣàyàn;
`wrangler.toml` ń ṣàkọsílẹ̀ olúkúlùkù wọn àti ìdí rẹ̀ (àwọn àpù oníbàárà lórí àwọn àyíká ìṣiṣẹ́ láìsí
WebCrypto Ed25519 kò lè fọwọ́ sí rárá).

Ọ̀nà olùgbé lásán ogún (`/api/msg/send`, `/api/msg/poll`) ti dínkù: àwọn ìdáhùn rẹ̀
ń gbé àkọlé `Deprecation: true`, ọ̀nà sealed sì ni
ọ̀nà àbáwọlé fún gbogbo àpù ìsinsìnyí. Nígbà tí o bá ti fìdí rẹ̀ múlẹ̀ pé kò sí àpù aláàyè
tí ó ṣì nílò àfikún náà, pa á rẹ́ pátápátá:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Orúkọ Ìkápá Ara-ẹni

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Ìlọsíwájú Kọjá Ìwọ̀n Ọ̀fẹ́

Nígbà tí o bá kọjá ìwọ̀n ọ̀fẹ́ (ètò Workers Paid $5/oṣù):

| Ohun èlò | Ètò Tí A Sanwó Fún |
|----------|-----------|
| Àwọn ìbéèrè Worker | Mílíọ́nù 10/oṣù |
| Àwọn ìkọ KV | Mílíọ́nù 1/oṣù |
| Ìpamọ́ KV | 1 GB wà nínú |
| Àkókò CPU | Ìṣẹ́jú àáyá 30/ìbéèrè |

Èyí ń ṣàtìlẹ́yìn **ẹgbẹẹgbẹ̀rún àwọn olùlò ní ìgbà kan náà**.

### Ìmúdójúìwọ̀n

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Kò sí ìgbésẹ̀ ìkọ́lé. Kò sí àwọn ìgbẹ́kẹ̀lé láti fi sílẹ̀. Kàn fi ránṣẹ́.
