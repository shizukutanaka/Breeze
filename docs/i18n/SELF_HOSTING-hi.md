# स्वयं-होस्टिंग मार्गदर्शिका

**अन्य भाषाओं में पढ़ें / Read in another language**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · हिन्दी (यह पृष्ठ) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)

> **शुरू करने से पहले: मानक स्थापना के लिए Cloudflare खाता चाहिए।**
> इस मार्गदर्शिका की मानक स्थापना — नीचे दी गई Cloudflare
> तैनाती — Cloudflare पर चलती है, इसलिए शुरू करने से पहले एक Cloudflare खाता
> तैयार रखें। यदि आप Cloudflare का उपयोग नहीं करना चाहते, तो
> इस मार्गदर्शिका की Docker और bare-Node स्थापनाओं के लिए
> Cloudflare खाता नहीं चाहिए।

Breeze रिले चलाने के दो तरीके हैं:

1. **स्वयं-होस्टेड (Node + Docker)** — आपकी अपनी मशीन या
   VPS पर रिले: एक कंटेनर, एक डेटा वॉल्यूम, पंजीकरण डिफ़ॉल्ट रूप से
   बंद। यदि रिले आपके और आपके लोगों के लिए है तो यहाँ से शुरू करें।
2. **Cloudflare** — Cloudflare की मुफ़्त सीमा पर आधिकारिक-शैली की
   तैनाती (वह रिले जो Breeze स्वयं चलाता है)। यदि आप
   बिना सर्वर रखरखाव के एक सार्वजनिक रिले चाहते हैं तो वहाँ से शुरू करें।

दोनों बिल्कुल एक ही हैंडलर कोड चलाते हैं; रिले किसी भी स्थिति में एक मूर्ख,
परस्पर विनिमेय मेलबॉक्स है, और हर क्लाइंट हर
रिले के साथ काम करता है।

## Docker के साथ स्वयं-होस्टेड

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

रिले कंटेनर के अंदर पोर्ट 8787 पर सादा HTTP परोसता है।
**इसके सामने एक रिवर्स प्रॉक्सी पर TLS समाप्त करें** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): ब्राउज़र रिले का उपयोग केवल
HTTPS/WSS पर करेंगे। जब आप ऐसा करें, तो `docker-compose.yml` में `TRUST_PROXY: "true"` सेट करें
ताकि दर-सीमा वास्तविक क्लाइंट
पते पर आधारित हो — और ऐसी प्रॉक्सी के बिना इसे कभी सेट न करें, क्योंकि जिस हेडर
पर यह भरोसा करता है उसे कोई भी जाली बना सकता है जो सीधे प्रवेश तक पहुँच सके।

डेटा वॉल्यूम के सामने ठीक **एक** कंटेनर चलाएँ: दर
सीमक प्रति प्रक्रिया स्मृति में होता है और प्रत्येक मेलबॉक्स के संचालन उस
प्रक्रिया के अंदर क्रमबद्ध होते हैं, इसलिए दूसरी प्रतिकृति इनमें से कोई भी गुण
नहीं रखेगी। उस एक प्रक्रिया को बड़ी मशीन देकर विस्तार करें।

### पंजीकरण: डिफ़ॉल्ट रूप से बंद

एक स्वयं-होस्टेड रिले जिस पर इंटरनेट पर कोई भी पंजीकरण कर सके,
उसी स्पैम/दुरुपयोग अर्थशास्त्र को फिर से बना देगा जिसे नियंत्रित करने के लिए आधिकारिक रिले की सीमाएँ
मौजूद हैं, इसलिए **Docker पैकेजिंग बंद अवस्था में आती है**: compose
फ़ाइल एक `REGISTRATION_ALLOWLIST` पास करती है (संभवतः खाली) और
केवल उस पर मौजूद Breeze ID ही *खाते बना सकते हैं* (पहला prekey
अपलोड)। पंजीकरण बंद करना उन लोगों को कभी प्रभावित नहीं करता जो पहले से रिले पर बसे हैं
— उनके अपलोड, जमा, rendezvous और poll
गेट नहीं किए जाते — और पंजीकरण खोलना एक स्पष्ट विकल्प है, कभी डिफ़ॉल्ट नहीं।

- **आपकी Breeze ID** आपके आमंत्रण लिंक में 12-अक्षरों वाला पहचानकर्ता है
  (इसके `pub` मान के पहले 12 अक्षर)। जिसे भी आप आमंत्रित करें, उससे उसकी ID उसी तरह माँगें
  — ID एक सार्वजनिक पहचानकर्ता है जिसे संपर्क पहले से आदान-प्रदान करते हैं,
  कोई रहस्य नहीं।
- **लोगों को प्रवेश दें** उनकी ID सूचीबद्ध करके: अपने शेल में या `docker-compose.yml` के बगल में एक `.env` फ़ाइल में
  `BREEZE_ALLOWLIST=id1,id2,…` सेट करें, फिर फिर से `docker compose up -d` करें।
- **अभी शुरू करें, बाद में प्रवेश दें**: `BREEZE_ALLOWLIST` सेट न होने पर, रिले
  सभी के लिए बंद चलता है — बूट लॉग ऐसा कहता है — और जब तक आप ID नहीं जोड़ते, कोई पंजीकरण नहीं कर सकता।
- **खुला रिले** (कोई भी पंजीकरण कर सकता है): `docker-compose.yml` में
  `REGISTRATION_OPEN: "1"` को अनकमेंट करें। यदि आप ऐसा करते हैं तो दुरुपयोग अर्थशास्त्र आपका अपना है।

### उपयोग कोटा: अपने रिले पर इसे बंद करें

वॉर्कर एक **उचित-उपयोग उपयोग कोटा** सक्षम अवस्था में आता है: प्रति
मेलबॉक्स, अधिकतम 10,000 जमा/दिन और 200,000/माह (एक जमा
एक पूर्ण वितरण चक्र है — नीति और संख्याओं के लिए `docs/COST_MODEL.md` §10 देखें
)। वह ढाँचा *साझा डिफ़ॉल्ट
रिले* के लिए मौजूद है, जो एक मुफ़्त प्रवेश के रूप में चलाया जाता है जिसकी परिवर्तनशील लागतें संचालक को अन्यथा
सबके लिए उठानी पड़तीं। **जिस रिले को आप
अपने और अपने लोगों के लिए चलाते हैं, उस पर वह ढाँचा निरर्थक है — इसे अक्षम
करें**:

```bash
USAGE_QUOTA_ENABLED=false
```

इसे वहाँ सेट करें जहाँ आपका रिले अपना वातावरण पढ़ता है (शेल या
`docker-compose.yml` के बगल में `.env`, Node प्रक्रिया वातावरण,
या Cloudflare Pages सीक्रेट)। यदि आप एक सामुदायिक रिले चलाते हैं और ढाँचा *चाहते* हैं तो दो पड़ोसी नॉब मौजूद हैं:
`USAGE_QUOTA_DAILY` और `USAGE_QUOTA_MONTHLY` सीमाओं को पुनः समायोजित करते हैं।
महत्वपूर्ण नोट:

- कोटा केवल तब लागू होता है जब मेलबॉक्स Durable
  Objects में रहते हैं (`MAILBOX_BACKEND=do`, इस होस्ट पर डिफ़ॉल्ट); KV बैकएंड पर यह एक प्रलेखित no-op है।
- सीमा से आगे, प्रेषकों को मौन गिरावट के बजाय एक स्पष्ट `429 USAGE_QUOTA_EXCEEDED`
  (इसकी विंडो और इसकी सीमा के साथ) मिलता है — संदेश
  प्रेषक के आउटबॉक्स में रहता है, और प्राप्तकर्ता P2P पर और किसी अन्य होम रिले के माध्यम से पहुँच योग्य बना रहता है।

### रिले पहचान

पहले बूट पर रिले *डेटा वॉल्यूम के अंदर* एक स्थायी Ed25519 पहचान कुंजी
उत्पन्न करता है और लॉग में उसका फ़िंगरप्रिंट छापता है:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

फ़िंगरप्रिंट *आपके* रिले की पहचान करता है: इसे अपने उपयोगकर्ताओं को
आउट-ऑफ़-बैंड (व्यक्तिगत रूप से, किसी अन्य चैनल पर) दें ताकि वे पहचान सकें
कि जो रिले उन्हें सौंपा गया था वही है जो आप चलाते हैं। वही फ़िंगरप्रिंट
हर बूट पर छपता है; यदि यह कभी बदल जाए, तो डेटा वॉल्यूम बदल दिया गया था
— उपयोगकर्ताओं को नए पर भरोसा करने को कहने से पहले जाँच करें।

क्लाइंट इस कुंजी को अपने आप सत्यापित और पिन करते हैं (चरण-2 चरण 4): पहले
संपर्क पर एक क्लाइंट रिले को उस कुंजी से हस्ताक्षर करने की चुनौती देता है
(`/api/relay/attest`), सत्यापित कुंजी को खाते के साथ संग्रहीत करता है, और
हर बाद के सत्र में पुनः सत्यापित करता है। क्लाइंट जो फ़िंगरप्रिंट दिखाता है
(`/security` के अंतर्गत, और पहले पिन पर टोस्ट में) उसी
कुंजी से निकाला जाता है — इसकी तुलना ऊपर की बूट-लॉग पंक्ति से करें। यदि कुंजी
कभी बदल जाए, तो क्लाइंट **रिले से बात करना बंद कर देते हैं** और उपयोगकर्ता को चेतावनी देते हैं
; वे कभी चुपचाप पुनः पिन नहीं करते। फ़िंगरप्रिंट परिवर्तन को एक
भंगुर घटना मानें: चरण 4 में ऐप के अंदर कोई «नई कुंजी पर भरोसा करें» बटन नहीं है,
इसलिए वास्तविक वॉल्यूम हानि के बाद आपके उपयोगकर्ताओं को अपने खाते के लिए ऐप का संग्रहीत डेटा साफ़ करना होगा और पहले संपर्क पर पुनः पिन करना होगा —
पहले नए फ़िंगरप्रिंट की घोषणा आउट-ऑफ़-बैंड करें, अन्यथा वे नहीं बता पाएँगे
कि आपकी नई कुंजी हमलावर की कुंजी से कैसे अलग है।

### बैकअप और पुनर्स्थापना

**डेटा वॉल्यूम संपूर्ण रिले अवस्था है**: एक SQLite फ़ाइल
जो निर्देशिका, मेलबॉक्स और रिले पहचान कुंजी रखती है।
बैकअप लेने के लिए और कुछ नहीं है।

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

### अद्यतन

```bash
git pull origin main
docker compose up -d --build
```

अवस्था वॉल्यूम में रहती है, इमेज में नहीं, इसलिए अद्यतन कभी
आपके उपयोगकर्ताओं के डेटा को नहीं छूता।

## नंगे Node के साथ स्वयं-होस्टेड (बिना Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

कॉन्फ़िगरेशन केवल वातावरण चर हैं — `server/README.md`
उन सभी को सूचीबद्ध करता है। Docker पथ से दो अंतर:

- **डेटा फ़ाइल** डिफ़ॉल्ट रूप से `./breeze-relay.db` है (`BREEZE_DB_PATH` से अधिलेखित करें
  ); यह वही एकल-फ़ाइल अवस्था है, रिले पहचान
  सहित। इसका बैकअप उसी तरह लें: रोकें, कॉपी करें, पुनः आरंभ करें।
- **पंजीकरण खुला है जब तक आप इसे बंद न करें**: बंद डिफ़ॉल्ट
  Docker पैकेजिंग का गुण है। नंगे प्रवेश को बंद करने के लिए,
  `REGISTRATION_ALLOWLIST=id1,id2` सेट करें (या सभी के लिए बंद हेतु एक खाली मान); `REGISTRATION_OPEN=1` स्पष्ट रूप से पुनः खोलता है।

## Cloudflare तैनाती

### न्यूनतम तैनाती ($0/माह, 5 मिनट)

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

**बस इतना ही।** पुश सूचनाओं को छोड़कर सभी सुविधाएँ काम करती हैं। ध्यान दें
कि Cloudflare तैनाती पर पंजीकरण **खुला** है जब तक आप
स्वयं `REGISTRATION_ALLOWLIST` सेट न करें (`.env.example` देखें); बंद-डिफ़ॉल्ट
पैकेजिंग ऊपर का Docker पथ है।

### $0 पर क्या काम करता है

| सुविधा | स्थिति | नोट |
|---------|--------|-------|
| E2E एन्क्रिप्टेड चैट | ✓ | पूर्ण Double Ratchet |
| P2P संदेश | ✓ | WebRTC DataChannel |
| वॉयस/वीडियो कॉल | ✓ | WebRTC + मुफ़्त STUN |
| TURN रिले | ✓ | Open Relay (20GB/माह मुफ़्त) |
| समूह (1,000 सदस्य) | ✓ | Sender Key O(1) |
| फ़ाइल स्थानांतरण | ✓ | P2P द्वारा 50MB तक |
| 51 भाषाएँ | ✓ | अंग्रेज़ी अंतर्निहित + 50 पूर्ण लोकेल फ़ाइलें, स्वचालित पहचान |
| ऑफ़लाइन/PWA | ✓ | Service Worker |
| पुश सूचनाएँ | ✗ | VAPID कुंजियाँ चाहिए |

बहु-खाता बिलिंग (Lite/Plus/Pro) उपलब्ध नहीं है — [SECURITY.md](../../SECURITY.md) का
«Removed: multi-account billing» अनुभाग देखें। प्रत्येक खाते को
बिना किसी योजना गेटिंग के मुफ़्त असीमित स्थानीय उप-खाते मिलते हैं।

### मुफ़्त सीमा सीमाएँ

| संसाधन | मुफ़्त सीमा | प्रति सक्रिय उपयोगकर्ता उपयोग |
|----------|-----------|----------------------|
| Worker अनुरोध | 100,000/दिन | ~500/दिन (polling + signaling) |
| KV पठन | 100,000/दिन | ~200/दिन |
| KV लेखन | 1,000/दिन | ~350/दिन (अनुकूलित) |
| KV संग्रहण | 1 GB | ~10 KB/उपयोगकर्ता |
| स्थिर संपत्तियाँ | असीमित | ~894 KB (एकल HTML) |

**मुफ़्त सीमा पर ~3 समवर्ती सक्रिय उपयोगकर्ताओं का समर्थन करता है।**

### वैकल्पिक सुविधाएँ जोड़ना

#### पुश सूचनाएँ (मुफ़्त)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN सर्वर (प्रतिबंधात्मक नेटवर्कों के लिए)

TURN वह तरीका है जिससे कॉल और केवल-रिले (IP-छिपाने वाले) कनेक्शन
प्रतिबंधात्मक NAT को पार करते हैं। आपका रिले कौन-सा TURN सौंपता है, यह संचालक के रूप में **आपकी** पसंद है
— Worker क्रम से प्रयास करता है:

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

**सत्यापित करें कि आपने वास्तव में क्या कॉन्फ़िगर किया है:** `GET /api/health` प्रभावी
मोड को `turnProvider` के रूप में रिपोर्ट करता है (`cloudflare` | `custom` | `static` |
`openrelay` | `none`)। पुराना `turn` बूलियन केवल
`TURN_URL` को दर्शाता है, इसलिए अनुशंसित Option A के लिए यह `false` पढ़ा जाता है — `turnProvider` का उपयोग करें
। क्लाइंट `/security` में वही प्रदाता दिखाते हैं, इसलिए
Open Relay फ़ॉलबैक पर मौजूद उपयोगकर्ता देख सकता है कि कोई तीसरा पक्ष उनके
कॉल मीडिया को रिले करता है (केवल मेटाडेटा — मीडिया स्वयं DTLS-SRTP एन्क्रिप्टेड है)।

#### प्रमाणीकरण सख़्ती और सादा रिले पथ

Prekey अपलोड अब हस्ताक्षर स्वामित्व को अलग से
`prekey-owner:<userId>` पर **बिना TTL के** संरक्षित करते हैं। मौजूदा बंडल स्वामित्व अगले अपलोड पर आलसी ढंग से माइग्रेट होता है
, प्रतिस्थापन स्वीकार किए जाने से पहले। नए Ed25519 बंडल भी
उस रिकॉर्ड को स्थापित करते हैं। समाप्त हो चुके prekey बंडलों की छँटाई करते समय इन रिकॉर्डों को रखें:
बंडल समाप्ति की प्रतीक्षा से नए स्वामी को अनुमति नहीं मिलनी चाहिए। रोटेशन के लिए
पिछले स्वामी द्वारा हस्ताक्षरित अपलोड आवश्यक है, जो नई कुंजी को मौजूदा अपलोड डाइजेस्ट में बाँधता है
। प्रमाणित `/account/delete` दोनों रिकॉर्ड मिटाता है और बंडल समाप्ति के बाद भी स्वामी के विरुद्ध प्रमाणित कर सकता है
। खोई हुई स्वामी-कुंजी का कोई रीसेट नहीं है।

इस रिकॉर्ड वाले खातों के लिए, अपलोड और संदेश/sealed poll, sealed ACK और
मेलबॉक्स WebSocket प्रमाणों को टिकाऊ स्वामी का उपयोग करना चाहिए। **अहस्ताक्षरित अनुरोध
`PREKEY_REQUIRE_AUTH=false` या `QUEUE_REQUIRE_AUTH=false` के साथ भी अस्वीकार किए जाते हैं।**
वे फ़्लैग बिना स्वामी वाले खातों के लिए अपने मौजूदा डिफ़ॉल्ट और पुरानी शब्दावली बनाए रखते हैं
; अहस्ताक्षरित अपलोड/कतार अनुरोधों की स्पष्ट `false` स्वीकृति
एक सामग्री-मुक्त अप्रचलन चेतावनी लॉग करती है। अन्य प्रमाणीकरण फ़्लैग अपरिवर्तित हैं।
मेलबॉक्स WebSocket को अभी भी सभी के लिए हस्ताक्षर चाहिए।

क्लाइंट कतार गतिविधि से पहले हस्ताक्षर प्रारंभीकरण की प्रतीक्षा करता है, जिसमें
वापस आने वाले खाते का बूट, लीडर पदोन्नति और पुनः कनेक्शन शामिल हैं। साझा प्रतीक्षा
पाँच सेकंड पर सीमित है। असमर्थित रनटाइम तुरंत अहस्ताक्षरित जारी रहते हैं;
अटका हुआ IDB/कुंजी-अनरैपिंग सीमा के बाद अहस्ताक्षरित जारी रहता है, फिर तैयार होने पर हस्ताक्षर करता है।
यह poll लूप को जीवित रखता है, कोई **बायपास नहीं**: स्वामी-समर्थित खाते
तब तक रिले से प्राप्त नहीं कर सकते जब तक उनकी हस्ताक्षर कुंजी उपयोग योग्य न हो। पुरानी स्टार्टअप दौड़ से बचने के लिए अद्यतित क्लाइंट संपत्तियों को Worker के साथ तैनात करें
।

माइग्रेशन उस बंडल से स्वामित्व पुनः प्राप्त नहीं कर सकता जो अपने स्वामी के संरक्षित होने से **पहले** समाप्त हो गया था
। पहली पंजीकरण TOFU बनी रहती है। स्वामित्व रिकॉर्ड मौजूदा
KV बैकएंड का उपयोग करते हैं: अंतिम संगति और समवर्ती लेखन इस परिवर्तन से रैखिक नहीं बनाए जाते
। प्रमाण मौजूदा पाँच-मिनट ताज़गी विंडो और संचालन/पेलोड बंधन बनाए रखते हैं; विंडो के भीतर समान पुनः प्रयास
एक-बारगी nonce प्रोटोकॉल नहीं हैं।

Presence लेखन और TURN क्रेडेंशियल जारी करना पहले से ही डिफ़ॉल्ट रूप से एक *पंजीकृत*
खाता (prekey बंडल मौजूद) माँगते हैं, और हर क्लाइंट अपने आप पंजीकरण करता है।
Presence हार्टबीट अतिरिक्त रूप से एक Ed25519 स्वामित्व प्रमाण रखते हैं (बीट
उन फ़ील्डों पर हस्ताक्षर करती है जिन्हें यह संग्रहीत करती है), जिसे Worker
जब भी कोई प्रस्तुत किया जाता है तो सत्यापित करता है — `PRESENCE_SIGN_REQUIRE_AUTH=true` उस
प्रमाण को अनिवार्य बनाता है। शेष Ed25519-हस्ताक्षर फ़्लैग opt-in बने रहते हैं;
`wrangler.toml` उनमें से प्रत्येक और कारण का दस्तावेज़ीकरण करता है (WebCrypto Ed25519 के बिना रनटाइम पर क्लाइंट
बिल्कुल हस्ताक्षर नहीं कर सकते)।

पुराना सादा रिले (`/api/msg/send`, `/api/msg/poll`) अप्रचलित है: इसकी
प्रतिक्रियाओं में `Deprecation: true` हेडर होता है, और sealed पथ
हर वर्तमान क्लाइंट के लिए डिफ़ॉल्ट मार्ग है। जब आप पुष्टि कर लें कि कोई जीवित
क्लाइंट अब फ़ॉलबैक की ज़रूरत नहीं रखता, तो इसे पूरी तरह अक्षम कर दें:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### कस्टम डोमेन

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### मुफ़्त सीमा से आगे विस्तार

जब आप मुफ़्त सीमा से आगे बढ़ जाएँ ($5/माह Workers Paid योजना):

| संसाधन | सशुल्क योजना |
|----------|-----------|
| Worker अनुरोध | 10 मिलियन/माह |
| KV लेखन | 1 मिलियन/माह |
| KV संग्रहण | 1 GB शामिल |
| CPU समय | 30 सेकंड/अनुरोध |

यह **हज़ारों समवर्ती उपयोगकर्ताओं** का समर्थन करता है।

### अद्यतन

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

कोई बिल्ड चरण नहीं। कोई निर्भरता स्थापित नहीं करनी। बस तैनात करें।
