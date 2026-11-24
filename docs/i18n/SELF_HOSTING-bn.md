# স্ব-হোস্টিং নির্দেশিকা

**অন্যান্য ভাষায় পড়ুন / Read in another language**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · বাংলা (এই পৃষ্ঠা) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Breeze রিলে চালানোর দুটি উপায় আছে:

1. **স্ব-হোস্টেড (Node + Docker)** — আপনার নিজের মেশিন বা
   VPS-এ রিলে: একটি কন্টেইনার, একটি ডেটা ভলিউম, নিবন্ধন ডিফল্টভাবে
   বন্ধ। রিলেটি যদি আপনার ও আপনার লোকজনের জন্য হয়, তবে এখান থেকে শুরু করুন।
2. **Cloudflare** — Cloudflare-এর বিনামূল্যের সীমায় আনুষ্ঠানিক-ধাঁচের
   স্থাপনা (যে রিলে Breeze নিজে চালায়)। সার্ভার রক্ষণাবেক্ষণ ছাড়া একটি
   সর্বজনীন রিলে চাইলে সেখান থেকে শুরু করুন।

দুটোই ঠিক একই হ্যান্ডলার কোড চালায়; যেকোনো অবস্থাতেই রিলে একটি সরল,
পরস্পর বিনিময়যোগ্য মেইলবক্স, এবং প্রতিটি ক্লায়েন্ট প্রতিটি
রিলের সঙ্গে কাজ করে।

## Docker দিয়ে স্ব-হোস্টেড

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

রিলে কন্টেইনারের ভিতরে পোর্ট 8787-তে সরল HTTP পরিবেশন করে।
**এর সামনে একটি রিভার্স প্রক্সিতে TLS শেষ করুন** (Caddy, nginx,
Traefik, একটি Cloudflare Tunnel, …): ব্রাউজারগুলি রিলে শুধুমাত্র
HTTPS/WSS-এর উপরেই ব্যবহার করবে। যখন তা করবেন, `docker-compose.yml`-তে `TRUST_PROXY: "true"` সেট করুন
যাতে হার-সীমা প্রকৃত ক্লায়েন্ট
ঠিকানার উপর ভিত্তি করে হয় — এবং এমন প্রক্সি ছাড়া এটি কখনো সেট করবেন না, কারণ যে হেডারটির
উপর এটি আস্থা রাখে তা যে কেউ সরাসরি প্রবেশপথে পৌঁছাতে পারে তার দ্বারা জাল করা যায়।

ডেটা ভলিউমের সামনে ঠিক **একটি** কন্টেইনার চালান: হার
সীমকটি প্রতি প্রক্রিয়ায় মেমরিতে থাকে এবং প্রতিটি মেইলবক্সের ক্রিয়াকলাপ সেই
প্রক্রিয়ার ভিতরে ক্রমানুসারে হয়, তাই দ্বিতীয় প্রতিলিপি এই বৈশিষ্ট্যগুলির কোনোটিই
ধরে রাখবে না। সেই একটি প্রক্রিয়াকে বড় মেশিন দিয়ে বিস্তার করুন।

### নিবন্ধন: ডিফল্টভাবে বন্ধ

একটি স্ব-হোস্টেড রিলে যেখানে ইন্টারনেটের যে কেউ নিবন্ধন করতে পারে,
সেই একই স্প্যাম/অপব্যবহার অর্থনীতি আবার তৈরি করবে যা নিয়ন্ত্রণের জন্য আনুষ্ঠানিক রিলের সীমাগুলি
বিদ্যমান, তাই **Docker প্যাকেজিং বন্ধ অবস্থায় আসে**: compose
ফাইল একটি `REGISTRATION_ALLOWLIST` পাস করে (সম্ভবত খালি) এবং
শুধুমাত্র তাতে থাকা Breeze ID-গুলিই *অ্যাকাউন্ট তৈরি করতে পারে* (প্রথম prekey
আপলোড)। নিবন্ধন বন্ধ করা ইতিমধ্যে রিলেতে বসবাসকারী লোকদের কখনো প্রভাবিত করে না
— তাদের আপলোড, জমা, rendezvous এবং poll
গেট করা হয় না — এবং নিবন্ধন খোলা একটি স্পষ্ট পছন্দ, কখনো ডিফল্ট নয়।

- **আপনার Breeze ID** হলো আপনার আমন্ত্রণ লিঙ্কে থাকা 12-অক্ষরের শনাক্তকারী
  (এর `pub` মানের প্রথম 12টি অক্ষর)। যাকেই আমন্ত্রণ জানান, তাঁর কাছ থেকে তাঁরটি একইভাবে চান
  — ID একটি সর্বজনীন শনাক্তকারী যা পরিচিতরা ইতিমধ্যে আদান-প্রদান করেন,
  কোনো গোপন বিষয় নয়।
- **লোকদের প্রবেশ দিন** তাদের ID তালিকাভুক্ত করে: আপনার শেলে বা `docker-compose.yml`-এর পাশে একটি `.env` ফাইলে
  `BREEZE_ALLOWLIST=id1,id2,…` সেট করুন, তারপর আবার `docker compose up -d` করুন।
- **এখনই শুরু করুন, পরে প্রবেশ দিন**: `BREEZE_ALLOWLIST` সেট না থাকলে, রিলে
  সবার জন্য বন্ধ চলে — বুট লগ তাই বলে — এবং আপনি ID যোগ না করা পর্যন্ত কেউ নিবন্ধন করতে পারবে না।
- **খোলা রিলে** (যে কেউ নিবন্ধন করতে পারে): `docker-compose.yml`-তে
  `REGISTRATION_OPEN: "1"` আনকমেন্ট করুন। তা করলে অপব্যবহার অর্থনীতি আপনার নিজের।

### ব্যবহার কোটা: নিজের রিলেতে এটি বন্ধ করুন

ওয়ার্কারটি একটি **ন্যায্য-ব্যবহার ব্যবহার কোটা** সক্রিয় অবস্থায় আসে: প্রতি
মেইলবক্সে, সর্বোচ্চ 10,000 জমা/দিন এবং 200,000/মাস (একটি জমা হলো
একটি সম্পূর্ণ বিতরণ চক্র — নীতি ও সংখ্যাগুলির জন্য `docs/COST_MODEL.md` §10 দেখুন
)। সেই কাঠামোটি *ভাগ করা ডিফল্ট
রিলের* জন্য বিদ্যমান, যা একটি বিনামূল্যের প্রবেশপথ হিসেবে চালানো হয় যার পরিবর্তনশীল খরচ পরিচালককে অন্যথায়
সবার জন্য বহন করতে হতো। **যে রিলে আপনি
নিজের ও নিজের লোকজনের জন্য চালান, সেখানে সেই কাঠামো অর্থহীন — এটি নিষ্ক্রিয়
করুন**:

```bash
USAGE_QUOTA_ENABLED=false
```

এটি সেখানে সেট করুন যেখান থেকে আপনার রিলে তার পরিবেশ পড়ে (শেল বা
`docker-compose.yml`-এর পাশে `.env`, Node প্রক্রিয়ার পরিবেশ,
অথবা Cloudflare Pages সিক্রেট)। আপনি যদি একটি সম্প্রদায় রিলে চালান এবং কাঠামো *চান* তবে দুটি পার্শ্ববর্তী নব বিদ্যমান:
`USAGE_QUOTA_DAILY` এবং `USAGE_QUOTA_MONTHLY` সীমাগুলি পুনরায় সুর করে।
গুরুত্বপূর্ণ নোট:

- কোটা শুধুমাত্র তখনই প্রয়োগ হয় যখন মেইলবক্সগুলি Durable
  Objects-এ থাকে (`MAILBOX_BACKEND=do`, এই হোস্টে ডিফল্ট); KV ব্যাকএন্ডে এটি একটি নথিভুক্ত no-op।
- সীমা ছাড়িয়ে গেলে, প্রেরকরা নীরব বাদ পড়ার পরিবর্তে একটি স্পষ্ট `429 USAGE_QUOTA_EXCEEDED`
  (এর উইন্ডো ও সীমাসহ) পান — বার্তাটি
  প্রেরকের আউটবক্সে থেকে যায়, এবং প্রাপক P2P-তে এবং অন্য যেকোনো হোম রিলের মাধ্যমে পৌঁছানো যায়।

### রিলে পরিচয়

প্রথম বুটে রিলে *ডেটা ভলিউমের ভিতরে* একটি স্থায়ী Ed25519 পরিচয় চাবি
তৈরি করে এবং লগে তার ফিঙ্গারপ্রিন্ট ছাপায়:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

ফিঙ্গারপ্রিন্টটি *আপনার* রিলেকে শনাক্ত করে: এটি আপনার ব্যবহারকারীদের
আউট-অফ-ব্যান্ড (সরাসরি, অন্য কোনো চ্যানেলে) দিন যাতে তাঁরা শনাক্ত করতে পারেন
যে তাঁদের হাতে দেওয়া রিলেটিই আপনি চালান। একই ফিঙ্গারপ্রিন্ট
প্রতিটি বুটে ছাপা হয়; তা কখনো বদলে গেলে, ডেটা ভলিউম প্রতিস্থাপিত হয়েছে
— ব্যবহারকারীদের নতুনটিকে বিশ্বাস করতে বলার আগে তদন্ত করুন।

ক্লায়েন্টরা এই চাবিটি স্বয়ংক্রিয়ভাবে যাচাই ও পিন করে (পর্যায়-2 ধাপ 4): প্রথম
যোগাযোগে একটি ক্লায়েন্ট রিলেকে সেই চাবি দিয়ে স্বাক্ষর করার চ্যালেঞ্জ দেয়
(`/api/relay/attest`), যাচাই করা চাবিটি অ্যাকাউন্টের সঙ্গে সংরক্ষণ করে, এবং
প্রতিটি পরবর্তী সেশনে আবার যাচাই করে। ক্লায়েন্ট যে ফিঙ্গারপ্রিন্ট দেখায়
(`/security`-এর অধীনে, এবং প্রথম পিনের সময় টোস্টে) তা একই
চাবি থেকে উদ্ভূত — উপরের বুট-লগ লাইনের সঙ্গে তা মিলিয়ে দেখুন। চাবিটি
কখনো বদলে গেলে, ক্লায়েন্টরা **রিলের সঙ্গে কথা বলা বন্ধ করে দেয়** এবং ব্যবহারকারীকে সতর্ক করে
; তারা কখনো নীরবে আবার পিন করে না। ফিঙ্গারপ্রিন্ট বদলকে একটি
ভঙ্গকারী ঘটনা হিসেবে ধরুন: ধাপ 4-এ অ্যাপের ভিতরে কোনো «নতুন চাবিকে বিশ্বাস করুন» বোতাম নেই,
তাই প্রকৃত ভলিউম হারানোর পর আপনার ব্যবহারকারীদের তাদের অ্যাকাউন্টের জন্য অ্যাপের সংরক্ষিত ডেটা মুছে ফেলতে হবে এবং প্রথম যোগাযোগে আবার পিন করতে হবে —
আগে আউট-অফ-ব্যান্ড নতুন ফিঙ্গারপ্রিন্ট ঘোষণা করুন, নইলে তাঁরা বলতে পারবেন না
আপনার নতুন চাবি আক্রমণকারীর চাবি থেকে কীভাবে আলাদা।

### ব্যাকআপ ও পুনরুদ্ধার

**ডেটা ভলিউমই সম্পূর্ণ রিলে অবস্থা**: একটি SQLite ফাইল
যা ডিরেক্টরি, মেইলবক্সগুলি এবং রিলে পরিচয় চাবি ধরে রাখে।
ব্যাকআপ নেওয়ার মতো আর কিছু নেই।

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

### আপডেট করা

```bash
git pull origin main
docker compose up -d --build
```

অবস্থা ভলিউমে থাকে, ইমেজে নয়, তাই আপডেট কখনো
আপনার ব্যবহারকারীদের ডেটা স্পর্শ করে না।

## খালি Node দিয়ে স্ব-হোস্টেড (Docker ছাড়া)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

কনফিগারেশন শুধুমাত্র পরিবেশ চলক — `server/README.md`
সেগুলির সবকটি তালিকাভুক্ত করে। Docker পথ থেকে দুটি পার্থক্য:

- **ডেটা ফাইল** ডিফল্টভাবে `./breeze-relay.db` ( `BREEZE_DB_PATH` দিয়ে ওভাররাইড করুন
  ); এটি একই একক-ফাইল অবস্থা, রিলে পরিচয়
  সহ। একইভাবে এর ব্যাকআপ নিন: থামান, কপি করুন, আবার চালু করুন।
- **নিবন্ধন খোলা, যদি না আপনি তা বন্ধ করেন**: বন্ধ ডিফল্টটি
  Docker প্যাকেজিংয়ের একটি বৈশিষ্ট্য। একটি খালি প্রবেশপথ বন্ধ করতে,
  `REGISTRATION_ALLOWLIST=id1,id2` সেট করুন (অথবা সবার জন্য বন্ধের জন্য একটি খালি মান); `REGISTRATION_OPEN=1` স্পষ্টভাবে আবার খোলে।

## Cloudflare স্থাপনা

### ন্যূনতম স্থাপনা ($0/মাস, 5 মিনিট)

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

**ব্যস, এটুকুই।** পুশ বিজ্ঞপ্তি ছাড়া সব ফিচার কাজ করে। লক্ষ্য করুন
যে Cloudflare স্থাপনায় নিবন্ধন **খোলা** থাকে যদি না আপনি
নিজে `REGISTRATION_ALLOWLIST` সেট করেন (`.env.example` দেখুন); বন্ধ-ডিফল্ট
প্যাকেজিং হলো উপরের Docker পথ।

### $0-তে যা কাজ করে

| ফিচার | অবস্থা | নোট |
|---------|--------|-------|
| E2E এনক্রিপ্ট করা চ্যাট | ✓ | সম্পূর্ণ Double Ratchet |
| P2P বার্তা | ✓ | WebRTC DataChannel |
| ভয়েস/ভিডিও কল | ✓ | WebRTC + বিনামূল্যে STUN |
| TURN রিলে | ✓ | Open Relay (20GB/মাস বিনামূল্যে) |
| গোষ্ঠী (100 সদস্য) | ✓ | Sender Key O(1) |
| ফাইল স্থানান্তর | ✓ | P2P দিয়ে 50MB পর্যন্ত |
| 8টি ভাষা | ✓ | EN + 7টি সম্পূর্ণ লোকেল, স্বয়ংক্রিয় শনাক্তকরণ |
| অফলাইন/PWA | ✓ | Service Worker |
| পুশ বিজ্ঞপ্তি | ✗ | VAPID চাবি লাগে |

বহু-অ্যাকাউন্ট বিলিং (Lite/Plus/Pro) উপলব্ধ নয় — [SECURITY.md](../../SECURITY.md)-এর
«Removed: multi-account billing» বিভাগ দেখুন। প্রতিটি অ্যাকাউন্ট
কোনো পরিকল্পনা গেটিং ছাড়াই বিনামূল্যে সীমাহীন স্থানীয় সাব-অ্যাকাউন্ট পায়।

### বিনামূল্যের সীমার সীমাবদ্ধতা

| সম্পদ | বিনামূল্যের সীমা | প্রতি সক্রিয় ব্যবহারকারীর ব্যবহার |
|----------|-----------|----------------------|
| Worker অনুরোধ | 100,000/দিন | ~500/দিন (polling + signaling) |
| KV পঠন | 100,000/দিন | ~200/দিন |
| KV লিখন | 1,000/দিন | ~350/দিন (অপ্টিমাইজ করা) |
| KV সংরক্ষণ | 1 GB | ~10 KB/ব্যবহারকারী |
| স্ট্যাটিক সম্পদ | সীমাহীন | ~400 KB (একক HTML) |

**বিনামূল্যের সীমায় ~3 জন সমসাময়িক সক্রিয় ব্যবহারকারীকে সমর্থন করে।**

### ঐচ্ছিক ফিচার যোগ করা

#### পুশ বিজ্ঞপ্তি (বিনামূল্যে)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN সার্ভার (সীমাবদ্ধ নেটওয়ার্কের জন্য)

TURN হলো সেই উপায় যাতে কল এবং শুধু-রিলে (IP-লুকানো) সংযোগগুলি
সীমাবদ্ধ NAT অতিক্রম করে। আপনার রিলে কোন TURN হাতে দেয় তা পরিচালক হিসেবে **আপনার** পছন্দ
— ওয়ার্কার ক্রমানুসারে চেষ্টা করে:

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

**আপনি আসলে যা কনফিগার করেছেন তা যাচাই করুন:** `GET /api/health` কার্যকর
মোডকে `turnProvider` হিসেবে রিপোর্ট করে (`cloudflare` | `custom` | `static` |
`openrelay` | `none`)। পুরনো `turn` বুলিয়ান শুধুমাত্র
`TURN_URL` প্রতিফলিত করে, তাই প্রস্তাবিত Option A-এর জন্য এটি `false` পড়া হয় — `turnProvider` ব্যবহার করুন
। ক্লায়েন্টরা `/security`-তে একই সরবরাহকারী দেখায়, তাই
Open Relay ফলব্যাকে থাকা একজন ব্যবহারকারী দেখতে পারেন যে একটি তৃতীয় পক্ষ তাঁর
কল মিডিয়া রিলে করে (শুধু মেটাডেটা — মিডিয়া নিজে DTLS-SRTP এনক্রিপ্ট করা)।

#### প্রমাণীকরণ কঠোরকরণ ও সরল রিলে পথ

Prekey আপলোডগুলি এখন স্বাক্ষর মালিকানা আলাদাভাবে
`prekey-owner:<userId>`-তে **TTL ছাড়া** সংরক্ষণ করে। বিদ্যমান বান্ডল মালিকানা পরবর্তী আপলোডে অলসভাবে মাইগ্রেট হয়
, প্রতিস্থাপন গৃহীত হওয়ার আগে। নতুন Ed25519 বান্ডলগুলিও
সেই রেকর্ড প্রতিষ্ঠা করে। মেয়াদ উত্তীর্ণ prekey বান্ডল ছাঁটাই করার সময় এই রেকর্ডগুলি রাখুন:
বান্ডলের মেয়াদ শেষের অপেক্ষা নতুন মালিককে অনুমতি দেওয়া উচিত নয়। ঘূর্ণনের জন্য
আগের মালিকের স্বাক্ষরিত আপলোড প্রয়োজন, যা নতুন চাবিটিকে বিদ্যমান আপলোড ডাইজেস্টে আবদ্ধ করে
। প্রমাণিত `/account/delete` উভয় রেকর্ড মুছে ফেলে এবং বান্ডলের মেয়াদ শেষের পরেও মালিকের বিরুদ্ধে প্রমাণীকরণ করতে পারে
। হারানো মালিক-চাবির কোনো রিসেট নেই।

এই রেকর্ড থাকা অ্যাকাউন্টগুলির জন্য, আপলোড এবং বার্তা/sealed poll, sealed ACK এবং
মেইলবক্স WebSocket প্রমাণগুলিকে টেকসই মালিক ব্যবহার করতে হবে। **অস্বাক্ষরিত অনুরোধ
`PREKEY_REQUIRE_AUTH=false` বা `QUEUE_REQUIRE_AUTH=false` থাকলেও প্রত্যাখ্যাত হয়।**
সেই পতাকাগুলি মালিক ছাড়া অ্যাকাউন্টগুলির জন্য তাদের বিদ্যমান ডিফল্ট ও পুরনো অর্থ বজায় রাখে
; অস্বাক্ষরিত আপলোড/সারি অনুরোধের স্পষ্ট `false` গ্রহণ
একটি বিষয়বস্তু-মুক্ত অবমূল্যায়ন সতর্কতা লগ করে। অন্যান্য প্রমাণীকরণ পতাকা অপরিবর্তিত।
মেইলবক্স WebSocket-এর জন্য এখনো সবার স্বাক্ষর প্রয়োজন।

ক্লায়েন্ট সারি কার্যকলাপের আগে স্বাক্ষর আরম্ভীকরণের জন্য অপেক্ষা করে, যার মধ্যে
ফিরে আসা অ্যাকাউন্টের বুট, লিডার পদোন্নতি এবং পুনঃসংযোগ অন্তর্ভুক্ত। ভাগ করা অপেক্ষা
পাঁচ সেকেন্ডে সীমাবদ্ধ। অসমর্থিত রানটাইমগুলি অবিলম্বে অস্বাক্ষরিত অবস্থায় চলতে থাকে;
আটকে থাকা IDB/চাবি-খোলা সীমার পরে অস্বাক্ষরিত অবস্থায় চলতে থাকে, তারপর প্রস্তুত হলে স্বাক্ষর করে।
এটি poll লুপকে জীবিত রাখে, কোনো **বাইপাস নয়**: মালিক-সমর্থিত অ্যাকাউন্টগুলি
তাদের স্বাক্ষর চাবি ব্যবহারযোগ্য না হওয়া পর্যন্ত রিলে থেকে গ্রহণ করতে পারে না। পুরনো স্টার্টআপ দৌড় এড়াতে হালনাগাদ ক্লায়েন্ট সম্পদ ওয়ার্কারের পাশাপাশি স্থাপন করুন
।

মাইগ্রেশন এমন বান্ডল থেকে মালিকানা পুনরুদ্ধার করতে পারে না যার মেয়াদ তার মালিক সংরক্ষিত হওয়ার **আগে** শেষ হয়ে গেছে
। প্রথম নিবন্ধন TOFU-ই থেকে যায়। মালিকানা রেকর্ডগুলি বিদ্যমান
KV ব্যাকএন্ড ব্যবহার করে: চূড়ান্ত সামঞ্জস্য এবং সমসাময়িক লিখন এই পরিবর্তন দ্বারা রৈখিক করা হয় না
। প্রমাণগুলি বিদ্যমান পাঁচ-মিনিটের সতেজতা উইন্ডো এবং ক্রিয়া/পেলোড বাঁধাই বজায় রাখে; উইন্ডোর ভিতরে অভিন্ন পুনঃচেষ্টা
একবারের nonce প্রোটোকল নয়।

Presence লিখন এবং TURN শংসাপত্র প্রদান ইতিমধ্যেই ডিফল্টভাবে একটি *নিবন্ধিত*
অ্যাকাউন্ট (prekey বান্ডল বিদ্যমান) প্রয়োজন করে, এবং প্রতিটি ক্লায়েন্ট স্বয়ংক্রিয়ভাবে নিবন্ধন করে।
Presence হার্টবিটগুলি অতিরিক্তভাবে একটি Ed25519 মালিকানা প্রমাণ বহন করে (বিটটি
যে ক্ষেত্রগুলি সংরক্ষণ করে সেগুলিতে স্বাক্ষর করে), যা ওয়ার্কার
যখনই একটি উপস্থাপন করা হয় তখন যাচাই করে — `PRESENCE_SIGN_REQUIRE_AUTH=true` সেই
প্রমাণটিকে বাধ্যতামূলক করে। বাকি Ed25519-স্বাক্ষর পতাকাগুলি opt-in থেকে যায়;
`wrangler.toml` তাদের প্রতিটি এবং কারণ নথিভুক্ত করে (WebCrypto Ed25519 ছাড়া রানটাইমে ক্লায়েন্টরা
একেবারেই স্বাক্ষর করতে পারে না)।

পুরনো সরল রিলে (`/api/msg/send`, `/api/msg/poll`) অবমূল্যায়িত: এর
প্রতিক্রিয়াগুলিতে একটি `Deprecation: true` হেডার থাকে, এবং sealed পথটি
প্রতিটি বর্তমান ক্লায়েন্টের জন্য ডিফল্ট রুট। আপনি যখন নিশ্চিত করবেন যে কোনো জীবিত
ক্লায়েন্টের আর ফলব্যাক দরকার নেই, তখন এটি সম্পূর্ণভাবে নিষ্ক্রিয় করুন:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### কাস্টম ডোমেইন

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### বিনামূল্যের সীমার বাইরে বিস্তার

আপনি যখন বিনামূল্যের সীমা ছাড়িয়ে যান ($5/মাস Workers Paid পরিকল্পনা):

| সম্পদ | অর্থপ্রদানের পরিকল্পনা |
|----------|-----------|
| Worker অনুরোধ | 10 মিলিয়ন/মাস |
| KV লিখন | 1 মিলিয়ন/মাস |
| KV সংরক্ষণ | 1 GB অন্তর্ভুক্ত |
| CPU সময় | 30 সেকেন্ড/অনুরোধ |

এটি **হাজার হাজার সমসাময়িক ব্যবহারকারীকে** সমর্থন করে।

### আপডেট করা

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

কোনো বিল্ড ধাপ নেই। ইনস্টল করার মতো কোনো নির্ভরতা নেই। শুধু স্থাপন করুন।
