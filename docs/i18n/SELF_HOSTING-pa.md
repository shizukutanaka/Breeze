# ਸਵੈ-ਹੋਸਟਿੰਗ ਗਾਈਡ

**ਹੋਰ ਭਾਸ਼ਾਵਾਂ ਵਿੱਚ ਪੜ੍ਹੋ / Read in another language**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · ਪੰਜਾਬੀ (ਇਹ ਪੰਨਾ) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Breeze ਰਿਲੇਅ ਚਲਾਉਣ ਦੇ ਦੋ ਤਰੀਕੇ ਹਨ:

1. **ਸਵੈ-ਹੋਸਟ ਕੀਤਾ (Node + Docker)** — ਤੁਹਾਡੀ ਆਪਣੀ ਮਸ਼ੀਨ ਜਾਂ
   VPS 'ਤੇ ਰਿਲੇਅ: ਇੱਕ ਕੰਟੇਨਰ, ਇੱਕ ਡੇਟਾ ਵਾਲੀਅਮ, ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਮੂਲ ਰੂਪ ਵਿੱਚ
   ਬੰਦ। ਇੱਥੋਂ ਸ਼ੁਰੂ ਕਰੋ ਜੇ ਰਿਲੇਅ ਤੁਹਾਡੇ ਅਤੇ ਤੁਹਾਡੇ ਲੋਕਾਂ ਲਈ ਹੈ।
2. **Cloudflare** — Cloudflare ਦੇ ਮੁਫ਼ਤ ਟੀਅਰ 'ਤੇ ਅਧਿਕਾਰਤ-ਸ਼ੈਲੀ ਦੀ ਤੈਨਾਤੀ
   (ਉਹ ਰਿਲੇਅ ਜੋ Breeze ਖੁਦ ਚਲਾਉਂਦਾ ਹੈ)। ਉੱਥੋਂ ਸ਼ੁਰੂ ਕਰੋ ਜੇ ਤੁਸੀਂ
   ਬਿਨਾਂ ਕਿਸੇ ਸਰਵਰ ਦੀ ਦੇਖਭਾਲ ਦੇ ਇੱਕ ਜਨਤਕ ਰਿਲੇਅ ਚਾਹੁੰਦੇ ਹੋ।

ਦੋਵੇਂ ਇੱਕੋ ਜਿਹਾ ਹੈਂਡਲਰ ਕੋਡ ਚਲਾਉਂਦੇ ਹਨ; ਰਿਲੇਅ ਕਿਸੇ ਵੀ ਤਰ੍ਹਾਂ ਇੱਕ ਸਾਦਾ,
ਆਪਸ ਵਿੱਚ ਬਦਲਣਯੋਗ ਮੇਲਬਾਕਸ ਹੈ, ਅਤੇ ਹਰ ਕਲਾਇੰਟ ਹਰ
ਰਿਲੇਅ ਨਾਲ ਕੰਮ ਕਰਦਾ ਹੈ।

## Docker ਨਾਲ ਸਵੈ-ਹੋਸਟ ਕੀਤਾ

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

ਰਿਲੇਅ ਕੰਟੇਨਰ ਦੇ ਅੰਦਰ ਪੋਰਟ 8787 'ਤੇ ਸਾਦਾ HTTP ਪ੍ਰਦਾਨ ਕਰਦਾ ਹੈ।
**ਇਸਦੇ ਸਾਹਮਣੇ ਇੱਕ ਰਿਵਰਸ ਪ੍ਰੌਕਸੀ 'ਤੇ TLS ਖਤਮ ਕਰੋ** (Caddy, nginx,
Traefik, ਇੱਕ Cloudflare Tunnel, …): ਬ੍ਰਾਊਜ਼ਰ ਰਿਲੇਅ ਨੂੰ ਸਿਰਫ਼
HTTPS/WSS 'ਤੇ ਹੀ ਵਰਤਣਗੇ। ਜਦੋਂ ਤੁਸੀਂ ਅਜਿਹਾ ਕਰੋ, ਤਾਂ `docker-compose.yml` ਵਿੱਚ
`TRUST_PROXY: "true"` ਸੈੱਟ ਕਰੋ ਤਾਂ ਜੋ ਦਰ ਸੀਮਾ ਅਸਲ ਕਲਾਇੰਟ
ਪਤੇ 'ਤੇ ਅਧਾਰਤ ਹੋਵੇ — ਅਤੇ ਅਜਿਹੇ ਪ੍ਰੌਕਸੀ ਤੋਂ ਬਿਨਾਂ ਇਸਨੂੰ ਕਦੇ ਸੈੱਟ ਨਾ ਕਰੋ, ਕਿਉਂਕਿ ਜਿਸ ਹੈਡਰ 'ਤੇ ਇਹ
ਭਰੋਸਾ ਕਰਦਾ ਹੈ, ਉਸਨੂੰ ਕੋਈ ਵੀ ਜਾਅਲੀ ਬਣਾ ਸਕਦਾ ਹੈ ਜੋ ਸਿੱਧੇ ਪ੍ਰਵੇਸ਼ ਤੱਕ ਪਹੁੰਚ ਸਕਦਾ ਹੈ।

ਡੇਟਾ ਵਾਲੀਅਮ ਦੇ ਵਿਰੁੱਧ ਬਿਲਕੁਲ **ਇੱਕ** ਕੰਟੇਨਰ ਚਲਾਓ: ਦਰ
ਸੀਮਾਕਰਤਾ ਹਰ ਪ੍ਰਕਿਰਿਆ ਲਈ ਮੈਮੋਰੀ ਵਿੱਚ ਹੈ ਅਤੇ ਹਰ ਮੇਲਬਾਕਸ ਦੀਆਂ ਕਾਰਵਾਈਆਂ
ਉਸ ਪ੍ਰਕਿਰਿਆ ਦੇ ਅੰਦਰ ਲੜੀਬੱਧ ਹਨ, ਇਸ ਲਈ ਦੂਜੀ ਪ੍ਰਤੀਰੂਪ ਕੋਲ
ਇਨ੍ਹਾਂ ਵਿੱਚੋਂ ਕੋਈ ਵੀ ਵਿਸ਼ੇਸ਼ਤਾ ਨਹੀਂ ਹੋਵੇਗੀ। ਇੱਕ ਪ੍ਰਕਿਰਿਆ ਨੂੰ ਵੱਡੀ ਮਸ਼ੀਨ ਦੇ ਕੇ ਸਕੇਲ ਕਰੋ।

### ਰਜਿਸਟ੍ਰੇਸ਼ਨ: ਮੂਲ ਰੂਪ ਵਿੱਚ ਬੰਦ

ਇੱਕ ਸਵੈ-ਹੋਸਟ ਕੀਤਾ ਰਿਲੇਅ ਜਿਸ 'ਤੇ ਇੰਟਰਨੈੱਟ 'ਤੇ ਕੋਈ ਵੀ ਰਜਿਸਟਰ ਕਰ ਸਕੇ,
ਉਹ ਸਪੈਮ/ਦੁਰਵਰਤੋਂ ਦੀ ਆਰਥਿਕਤਾ ਨੂੰ ਮੁੜ ਬਣਾ ਦੇਵੇਗਾ ਜਿਸਨੂੰ ਨਿਯੰਤਰਿਤ ਕਰਨ ਲਈ ਅਧਿਕਾਰਤ ਰਿਲੇਅ ਦੀਆਂ ਸੀਮਾਵਾਂ
ਮੌਜੂਦ ਹਨ, ਇਸ ਲਈ **Docker ਪੈਕੇਜਿੰਗ ਬੰਦ ਹਾਲਤ ਵਿੱਚ ਆਉਂਦੀ ਹੈ**: ਕੰਪੋਜ਼
ਫ਼ਾਈਲ ਇੱਕ `REGISTRATION_ALLOWLIST` (ਸੰਭਵ ਤੌਰ 'ਤੇ ਖਾਲੀ) ਪਾਸ ਕਰਦੀ ਹੈ ਅਤੇ
ਸਿਰਫ਼ ਇਸ 'ਤੇ ਮੌਜੂਦ Breeze ID ਹੀ *ਖਾਤੇ ਬਣਾ* ਸਕਦੇ ਹਨ (ਪਹਿਲੀ ਪ੍ਰੀਕੀ
ਅੱਪਲੋਡ)। ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਬੰਦ ਕਰਨ ਨਾਲ ਉਨ੍ਹਾਂ ਲੋਕਾਂ 'ਤੇ ਕਦੇ ਅਸਰ ਨਹੀਂ ਪੈਂਦਾ ਜੋ ਪਹਿਲਾਂ ਹੀ ਰਿਲੇਅ 'ਤੇ
ਘਰ ਬਣਾ ਚੁੱਕੇ ਹਨ — ਉਨ੍ਹਾਂ ਦੇ ਅੱਪਲੋਡ, ਜਮ੍ਹਾਂ, ਮੁਲਾਕਾਤਾਂ ਅਤੇ ਪੋਲ
ਗੇਟ ਨਹੀਂ ਕੀਤੇ ਜਾਂਦੇ — ਅਤੇ ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਖੋਲ੍ਹਣਾ ਇੱਕ ਸਪਸ਼ਟ ਚੋਣ ਹੈ, ਕਦੇ
ਮੂਲ ਨਹੀਂ।

- **ਤੁਹਾਡੀ Breeze ID** ਤੁਹਾਡੇ ਸੱਦਾ ਲਿੰਕ ਵਿੱਚ 12-ਅੱਖਰਾਂ ਦੀ ਪਛਾਣਕਰਤਾ ਹੈ
  (ਇਸਦੇ `pub` ਮੁੱਲ ਦੇ ਪਹਿਲੇ 12 ਅੱਖਰ)। ਜਿਸਨੂੰ ਤੁਸੀਂ ਸੱਦਾ ਦਿੰਦੇ ਹੋ, ਉਸ ਹਰ ਵਿਅਕਤੀ ਨੂੰ ਉਸਦੀ ID ਇਸੇ
  ਤਰ੍ਹਾਂ ਪੁੱਛੋ — ID ਇੱਕ ਜਨਤਕ ਪਛਾਣਕਰਤਾ ਹੈ ਜੋ ਸੰਪਰਕ ਪਹਿਲਾਂ ਹੀ
  ਵਟਾਂਦਰਾ ਕਰਦੇ ਹਨ, ਕੋਈ ਗੁਪਤ ਨਹੀਂ।
- **ਲੋਕਾਂ ਨੂੰ ਦਾਖਲ ਕਰੋ** ਉਨ੍ਹਾਂ ਦੀਆਂ ID ਸੂਚੀਬੱਧ ਕਰਕੇ: ਆਪਣੇ ਸ਼ੈੱਲ ਵਿੱਚ
  `BREEZE_ALLOWLIST=id1,id2,…` ਸੈੱਟ ਕਰੋ ਜਾਂ `docker-compose.yml` ਦੇ ਨਾਲ ਇੱਕ `.env` ਫ਼ਾਈਲ ਵਿੱਚ,
  ਫਿਰ ਦੁਬਾਰਾ `docker compose up -d` ਕਰੋ।
- **ਹੁਣੇ ਸ਼ੁਰੂ ਕਰੋ, ਬਾਅਦ ਵਿੱਚ ਦਾਖਲ ਕਰੋ**: ਕੋਈ `BREEZE_ALLOWLIST` ਸੈੱਟ ਨਾ ਹੋਣ ਨਾਲ, ਰਿਲੇਅ
  ਹਰ ਕਿਸੇ ਲਈ ਬੰਦ ਚੱਲਦਾ ਹੈ — ਬੂਟ ਲੌਗ ਇਹੀ ਕਹਿੰਦਾ ਹੈ — ਅਤੇ ਕੋਈ ਵੀ
  ਉਦੋਂ ਤੱਕ ਰਜਿਸਟਰ ਨਹੀਂ ਕਰ ਸਕਦਾ ਜਦੋਂ ਤੱਕ ਤੁਸੀਂ ID ਨਹੀਂ ਜੋੜਦੇ।
- **ਖੁੱਲ੍ਹਾ ਰਿਲੇਅ** (ਕੋਈ ਵੀ ਰਜਿਸਟਰ ਕਰ ਸਕਦਾ ਹੈ): `docker-compose.yml` ਵਿੱਚ
  `REGISTRATION_OPEN: "1"` ਨੂੰ ਅਨਕਮੈਂਟ ਕਰੋ। ਜੇ ਤੁਸੀਂ ਅਜਿਹਾ ਕਰਦੇ ਹੋ, ਤਾਂ ਦੁਰਵਰਤੋਂ ਦੀ ਆਰਥਿਕਤਾ ਤੁਹਾਡੀ ਹੈ।

### ਵਰਤੋਂ ਕੋਟਾ: ਆਪਣੇ ਖੁਦ ਦੇ ਰਿਲੇਅ 'ਤੇ ਇਸਨੂੰ ਬੰਦ ਕਰੋ

ਵਰਕਰ ਇੱਕ **ਨਿਰਪੱਖ-ਵਰਤੋਂ ਵਰਤੋਂ ਕੋਟੇ** ਦੇ ਸਮਰੱਥ ਹੋਣ ਨਾਲ ਆਉਂਦਾ ਹੈ: ਹਰ
ਮੇਲਬਾਕਸ ਲਈ, ਵੱਧ ਤੋਂ ਵੱਧ 10,000 ਜਮ੍ਹਾਂ/ਦਿਨ ਅਤੇ 200,000/ਮਹੀਨਾ (ਇੱਕ ਜਮ੍ਹਾਂ
ਇੱਕ ਪੂਰਾ ਡਿਲੀਵਰੀ ਚੱਕਰ ਹੈ — ਨੀਤੀ ਅਤੇ ਸੰਖਿਆਵਾਂ ਲਈ `docs/COST_MODEL.md` §10 ਵੇਖੋ)। ਉਹ ਢਾਂਚਾ *ਸਾਂਝੇ ਡਿਫਾਲਟ
ਰਿਲੇਅ* ਲਈ ਮੌਜੂਦ ਹੈ, ਜੋ ਇੱਕ ਮੁਫ਼ਤ ਪ੍ਰਵੇਸ਼ ਵਜੋਂ ਚਲਾਇਆ ਜਾਂਦਾ ਹੈ ਜਿਸਦੀ ਪਰਿਵਰਤਨਸ਼ੀਲ ਲਾਗਤ
ਸੰਚਾਲਕ ਨੂੰ ਨਹੀਂ ਤਾਂ ਹਰ ਕਿਸੇ ਲਈ ਚੁੱਕਣੀ ਪੈਂਦੀ। **ਉਸ ਰਿਲੇਅ 'ਤੇ ਜੋ ਤੁਸੀਂ
ਆਪਣੇ ਅਤੇ ਆਪਣੇ ਲੋਕਾਂ ਲਈ ਚਲਾਉਂਦੇ ਹੋ, ਇਹ ਢਾਂਚਾ ਬੇਅਰਥ ਹੈ — ਇਸਨੂੰ
ਅਸਮਰੱਥ ਕਰੋ**:

```bash
USAGE_QUOTA_ENABLED=false
```

ਇਸਨੂੰ ਉੱਥੇ ਸੈੱਟ ਕਰੋ ਜਿੱਥੇ ਤੁਹਾਡਾ ਰਿਲੇਅ ਆਪਣਾ ਵਾਤਾਵਰਣ ਪੜ੍ਹਦਾ ਹੈ (ਸ਼ੈੱਲ ਜਾਂ
`docker-compose.yml` ਦੇ ਨਾਲ `.env`, Node ਪ੍ਰਕਿਰਿਆ ਵਾਤਾਵਰਣ,
ਜਾਂ Cloudflare Pages ਸੀਕਰੇਟ)। ਦੋ ਗੁਆਂਢੀ ਨੌਬ ਮੌਜੂਦ ਹਨ ਜੇ ਤੁਸੀਂ
ਇੱਕ ਕਮਿਊਨਿਟੀ ਰਿਲੇਅ ਚਲਾਉਂਦੇ ਹੋ ਅਤੇ ਢਾਂਚਾ *ਚਾਹੁੰਦੇ* ਹੋ:
`USAGE_QUOTA_DAILY` ਅਤੇ `USAGE_QUOTA_MONTHLY` ਕੈਪਸ ਨੂੰ ਮੁੜ ਟਿਊਨ ਕਰਦੇ ਹਨ।
ਮਹੱਤਵਪੂਰਨ ਨੋਟ:

- ਕੋਟਾ ਸਿਰਫ਼ ਤਾਂ ਹੀ ਲਾਗੂ ਹੁੰਦਾ ਹੈ ਜਦੋਂ ਮੇਲਬਾਕਸ Durable
  Objects ਵਿੱਚ ਰਹਿੰਦੇ ਹਨ (`MAILBOX_BACKEND=do`, ਇਸ ਹੋਸਟ 'ਤੇ ਡਿਫਾਲਟ); KV
  ਬੈਕਐਂਡ 'ਤੇ ਇਹ ਇੱਕ ਦਸਤਾਵੇਜ਼ੀ ਨੋ-ਓਪ ਹੈ।
- ਕੈਪ ਤੋਂ ਬਾਅਦ, ਭੇਜਣ ਵਾਲਿਆਂ ਨੂੰ ਚੁੱਪਚਾਪ ਛੱਡਣ ਦੀ ਬਜਾਏ ਇੱਕ ਸਪਸ਼ਟ `429 USAGE_QUOTA_EXCEEDED`
  (ਵਿੰਡੋ ਅਤੇ ਇਸਦੀ ਸੀਮਾ ਸਮੇਤ) ਮਿਲਦਾ ਹੈ — ਸੁਨੇਹਾ
  ਭੇਜਣ ਵਾਲੇ ਦੇ ਆਊਟਬਾਕਸ ਵਿੱਚ ਰਹਿੰਦਾ ਹੈ, ਅਤੇ ਪ੍ਰਾਪਤਕਰਤਾ
  P2P ਰਾਹੀਂ ਅਤੇ ਕਿਸੇ ਹੋਰ ਘਰੇਲੂ ਰਿਲੇਅ ਰਾਹੀਂ ਪਹੁੰਚਯੋਗ ਰਹਿੰਦਾ ਹੈ।

### ਰਿਲੇਅ ਪਛਾਣ

ਪਹਿਲੀ ਬੂਟ 'ਤੇ ਰਿਲੇਅ *ਡੇਟਾ ਵਾਲੀਅਮ ਦੇ ਅੰਦਰ* ਇੱਕ ਸਥਾਈ Ed25519 ਪਛਾਣ ਕੁੰਜੀ
ਬਣਾਉਂਦਾ ਹੈ ਅਤੇ ਲੌਗ ਵਿੱਚ ਇਸਦਾ ਫਿੰਗਰਪ੍ਰਿੰਟ ਛਾਪਦਾ ਹੈ:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

ਫਿੰਗਰਪ੍ਰਿੰਟ *ਤੁਹਾਡੇ* ਰਿਲੇਅ ਦੀ ਪਛਾਣ ਕਰਦਾ ਹੈ: ਇਸਨੂੰ ਆਪਣੇ ਉਪਭੋਗਤਾਵਾਂ ਨੂੰ
ਬੈਂਡ ਤੋਂ ਬਾਹਰ (ਵਿਅਕਤੀਗਤ ਤੌਰ 'ਤੇ, ਕਿਸੇ ਹੋਰ ਚੈਨਲ ਰਾਹੀਂ) ਦਿਓ ਤਾਂ ਜੋ ਉਹ ਉਸ ਰਿਲੇਅ ਨੂੰ ਪਛਾਣ ਸਕਣ
ਜੋ ਉਨ੍ਹਾਂ ਨੂੰ ਦਿੱਤਾ ਗਿਆ ਸੀ, ਉਹੀ ਹੈ ਜੋ ਤੁਸੀਂ ਚਲਾਉਂਦੇ ਹੋ। ਉਹੀ ਫਿੰਗਰਪ੍ਰਿੰਟ
ਹਰ ਬੂਟ 'ਤੇ ਛਪਦਾ ਹੈ; ਜੇ ਇਹ ਕਦੇ ਬਦਲ ਜਾਵੇ, ਤਾਂ ਡੇਟਾ ਵਾਲੀਅਮ
ਬਦਲਿਆ ਗਿਆ ਸੀ — ਉਪਭੋਗਤਾਵਾਂ ਨੂੰ ਨਵੇਂ 'ਤੇ ਭਰੋਸਾ ਕਰਨ ਲਈ ਕਹਿਣ ਤੋਂ ਪਹਿਲਾਂ ਜਾਂਚ ਕਰੋ।

ਕਲਾਇੰਟ ਇਸ ਕੁੰਜੀ ਨੂੰ ਆਪਣੇ ਆਪ ਤਸਦੀਕ ਕਰਦੇ ਅਤੇ ਪਿੰਨ ਕਰਦੇ ਹਨ (ਪੜਾਅ-2 ਕਦਮ 4): ਪਹਿਲੇ
ਸੰਪਰਕ 'ਤੇ ਇੱਕ ਕਲਾਇੰਟ ਰਿਲੇਅ ਨੂੰ ਕੁੰਜੀ ਨਾਲ ਦਸਤਖ਼ਤ ਕਰਨ ਦੀ ਚੁਣੌਤੀ ਦਿੰਦਾ ਹੈ
(`/api/relay/attest`), ਤਸਦੀਕ ਕੀਤੀ ਕੁੰਜੀ ਨੂੰ ਖਾਤੇ ਨਾਲ ਸਟੋਰ ਕਰਦਾ ਹੈ, ਅਤੇ
ਹਰ ਬਾਅਦ ਦੇ ਸੈਸ਼ਨ 'ਤੇ ਮੁੜ ਤਸਦੀਕ ਕਰਦਾ ਹੈ। ਕਲਾਇੰਟ ਜੋ ਫਿੰਗਰਪ੍ਰਿੰਟ ਦਿਖਾਉਂਦਾ ਹੈ
(`/security` ਹੇਠ, ਅਤੇ ਪਹਿਲੀ ਪਿੰਨ 'ਤੇ ਟੋਸਟ ਵਿੱਚ) ਉਸੇ
ਕੁੰਜੀ ਤੋਂ ਲਿਆ ਜਾਂਦਾ ਹੈ — ਇਸਦੀ ਤੁਲਨਾ ਉੱਪਰ ਦਿੱਤੀ ਬੂਟ-ਲੌਗ ਲਾਈਨ ਨਾਲ ਕਰੋ। ਜੇ ਕੁੰਜੀ
ਕਦੇ ਬਦਲ ਜਾਵੇ, ਤਾਂ ਕਲਾਇੰਟ **ਰਿਲੇਅ ਨਾਲ ਗੱਲ ਕਰਨਾ ਬੰਦ ਕਰ ਦਿੰਦੇ ਹਨ** ਅਤੇ ਉਪਭੋਗਤਾ ਨੂੰ
ਚੇਤਾਵਨੀ ਦਿੰਦੇ ਹਨ; ਉਹ ਕਦੇ ਚੁੱਪਚਾਪ ਮੁੜ-ਪਿੰਨ ਨਹੀਂ ਕਰਦੇ। ਫਿੰਗਰਪ੍ਰਿੰਟ ਬਦਲਾਅ ਨੂੰ ਇੱਕ
ਟੁੱਟਣ ਵਾਲੀ ਘਟਨਾ ਵਜੋਂ ਮੰਨੋ: ਕਦਮ 4 ਵਿੱਚ ਐਪ ਵਿੱਚ ਕੋਈ "ਨਵੀਂ ਕੁੰਜੀ 'ਤੇ ਭਰੋਸਾ ਕਰੋ" ਬਟਨ ਨਹੀਂ ਹੈ,
ਇਸ ਲਈ ਅਸਲ ਵਾਲੀਅਮ ਨੁਕਸਾਨ ਤੋਂ ਬਾਅਦ ਤੁਹਾਡੇ ਉਪਭੋਗਤਾਵਾਂ ਨੂੰ ਆਪਣੇ ਖਾਤੇ ਲਈ ਐਪ ਦਾ ਸਟੋਰ ਕੀਤਾ ਡੇਟਾ
ਸਾਫ਼ ਕਰਨਾ ਪਵੇਗਾ ਅਤੇ ਪਹਿਲੇ ਸੰਪਰਕ 'ਤੇ ਮੁੜ-ਪਿੰਨ ਕਰਨਾ ਪਵੇਗਾ —
ਨਵਾਂ ਫਿੰਗਰਪ੍ਰਿੰਟ ਪਹਿਲਾਂ ਬੈਂਡ ਤੋਂ ਬਾਹਰ ਘੋਸ਼ਿਤ ਕਰੋ, ਨਹੀਂ ਤਾਂ ਉਹ ਤੁਹਾਡੀ ਨਵੀਂ ਕੁੰਜੀ ਨੂੰ ਹਮਲਾਵਰ ਦੀ ਕੁੰਜੀ ਤੋਂ
ਅਲੱਗ ਨਹੀਂ ਦੱਸ ਸਕਦੇ।

### ਬੈਕਅੱਪ ਅਤੇ ਮੁੜ ਸਥਾਪਤੀ

**ਡੇਟਾ ਵਾਲੀਅਮ ਪੂਰੀ ਰਿਲੇਅ ਸਥਿਤੀ ਹੈ**: ਇੱਕ SQLite ਫ਼ਾਈਲ
ਜਿਸ ਵਿੱਚ ਡਾਇਰੈਕਟਰੀ, ਮੇਲਬਾਕਸ, ਅਤੇ ਰਿਲੇਅ ਪਛਾਣ ਕੁੰਜੀ ਹੈ।
ਬੈਕਅੱਪ ਕਰਨ ਲਈ ਹੋਰ ਕੁਝ ਨਹੀਂ ਹੈ।

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

### ਅੱਪਡੇਟ ਕਰਨਾ

```bash
git pull origin main
docker compose up -d --build
```

ਸਥਿਤੀ ਵਾਲੀਅਮ ਵਿੱਚ ਰਹਿੰਦੀ ਹੈ, ਚਿੱਤਰ ਵਿੱਚ ਨਹੀਂ, ਇਸ ਲਈ ਅੱਪਡੇਟ ਕਰਨ ਨਾਲ ਤੁਹਾਡੇ
ਉਪਭੋਗਤਾਵਾਂ ਦੇ ਡੇਟਾ ਨੂੰ ਕਦੇ ਹੱਥ ਨਹੀਂ ਲੱਗਦਾ।

## ਬੇਅਰ Node ਨਾਲ ਸਵੈ-ਹੋਸਟ ਕੀਤਾ (ਕੋਈ Docker ਨਹੀਂ)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

ਸੰਰਚਨਾ ਸਿਰਫ਼ ਵਾਤਾਵਰਣ ਵੇਰੀਏਬਲ ਹਨ — `server/README.md`
ਉਹ ਸਭ ਸੂਚੀਬੱਧ ਕਰਦਾ ਹੈ। Docker ਮਾਰਗ ਤੋਂ ਦੋ ਅੰਤਰ:

- **ਡੇਟਾ ਫ਼ਾਈਲ** ਮੂਲ ਰੂਪ ਵਿੱਚ `./breeze-relay.db` ਹੈ (`BREEZE_DB_PATH` ਨਾਲ ਬਦਲੋ);
  ਇਹ ਉਹੀ ਇੱਕ-ਫ਼ਾਈਲ ਸਥਿਤੀ ਹੈ, ਰਿਲੇਅ ਪਛਾਣ
  ਸਮੇਤ। ਇਸਦਾ ਬੈਕਅੱਪ ਉਸੇ ਤਰ੍ਹਾਂ ਕਰੋ: ਰੋਕੋ, ਕਾਪੀ ਕਰੋ, ਮੁੜ ਚਾਲੂ ਕਰੋ।
- **ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਖੁੱਲ੍ਹੀ ਹੈ ਜਦੋਂ ਤੱਕ ਤੁਸੀਂ ਇਸਨੂੰ ਬੰਦ ਨਹੀਂ ਕਰਦੇ**: ਬੰਦ ਡਿਫਾਲਟ
  Docker ਪੈਕੇਜਿੰਗ ਦੀ ਇੱਕ ਵਿਸ਼ੇਸ਼ਤਾ ਹੈ। ਇੱਕ ਬੇਅਰ ਐਂਟਰੀ ਨੂੰ ਬੰਦ ਕਰਨ ਲਈ,
  `REGISTRATION_ALLOWLIST=id1,id2` ਸੈੱਟ ਕਰੋ (ਜਾਂ ਖਾਲੀ ਮੁੱਲ
  ਹਰ ਕਿਸੇ ਲਈ ਬੰਦ ਲਈ); `REGISTRATION_OPEN=1` ਇਸਨੂੰ ਸਪਸ਼ਟ ਤੌਰ 'ਤੇ ਮੁੜ ਖੋਲ੍ਹਦਾ ਹੈ।

## Cloudflare ਤੈਨਾਤੀ

### ਘੱਟੋ-ਘੱਟ ਤੈਨਾਤੀ ($0/ਮਹੀਨਾ, 5 ਮਿੰਟ)

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

**ਬੱਸ ਏਨਾ ਹੀ।** ਪੁਸ਼ ਸੂਚਨਾਵਾਂ ਨੂੰ ਛੱਡ ਕੇ ਸਾਰੀਆਂ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ ਕੰਮ ਕਰਦੀਆਂ ਹਨ। ਨੋਟ ਕਰੋ
ਕਿ Cloudflare ਤੈਨਾਤੀ 'ਤੇ ਰਜਿਸਟ੍ਰੇਸ਼ਨ **ਖੁੱਲ੍ਹੀ** ਹੈ ਜਦੋਂ ਤੱਕ ਤੁਸੀਂ
ਖੁਦ `REGISTRATION_ALLOWLIST` ਸੈੱਟ ਨਹੀਂ ਕਰਦੇ (`.env.example` ਵੇਖੋ); ਬੰਦ-ਮੂਲ
ਪੈਕੇਜਿੰਗ ਉੱਪਰ ਦਿੱਤਾ Docker ਮਾਰਗ ਹੈ।

### $0 'ਤੇ ਕੀ ਕੰਮ ਕਰਦਾ ਹੈ

| ਵਿਸ਼ੇਸ਼ਤਾ | ਸਥਿਤੀ | ਨੋਟ |
|---------|--------|-------|
| E2E ਇਨਕ੍ਰਿਪਟਡ ਚੈਟ | ✓ | ਪੂਰਾ Double Ratchet |
| P2P ਸੁਨੇਹਾ ਭੇਜਣਾ | ✓ | WebRTC DataChannel |
| ਵੌਇਸ/ਵੀਡੀਓ ਕਾਲਾਂ | ✓ | WebRTC + ਮੁਫ਼ਤ STUN |
| TURN ਰਿਲੇਅ | ✓ | Open Relay (20GB/ਮਹੀਨਾ ਮੁਫ਼ਤ) |
| ਸਮੂਹ (100 ਮੈਂਬਰ) | ✓ | Sender Key O(1) |
| ਫ਼ਾਈਲ ਟ੍ਰਾਂਸਫਰ | ✓ | P2P ਰਾਹੀਂ 50MB ਤੱਕ |
| 8 ਭਾਸ਼ਾਵਾਂ | ✓ | EN + 7 ਪੂਰੇ ਲੋਕੇਲ, ਆਟੋ-ਡਿਟੈਕਟ ਕੀਤੇ |
| ਆਫ਼ਲਾਈਨ/PWA | ✓ | Service Worker |
| ਪੁਸ਼ ਸੂਚਨਾਵਾਂ | ✗ | VAPID ਕੁੰਜੀਆਂ ਦੀ ਲੋੜ ਹੈ |

ਬਹੁ-ਖਾਤਾ ਬਿਲਿੰਗ (Lite/Plus/Pro) ਉਪਲਬਧ ਨਹੀਂ ਹੈ — [SECURITY.md](../../SECURITY.md) ਦਾ "Removed: multi-account billing" ਭਾਗ ਵੇਖੋ। ਹਰ ਖਾਤੇ ਨੂੰ ਬਿਨਾਂ ਕਿਸੇ ਪਲਾਨ ਗੇਟਿੰਗ ਦੇ ਮੁਫ਼ਤ ਵਿੱਚ ਅਸੀਮਤ ਸਥਾਨਕ ਉਪ-ਖਾਤੇ ਮਿਲਦੇ ਹਨ।

### ਮੁਫ਼ਤ ਟੀਅਰ ਸੀਮਾਵਾਂ

| ਸਰੋਤ | ਮੁਫ਼ਤ ਟੀਅਰ | ਹਰ ਸਰਗਰਮ ਉਪਭੋਗਤਾ ਦੀ ਵਰਤੋਂ |
|----------|-----------|----------------------|
| Worker ਬੇਨਤੀਆਂ | 100,000/ਦਿਨ | ~500/ਦਿਨ (ਪੋਲਿੰਗ + ਸਿਗਨਲਿੰਗ) |
| KV ਪੜ੍ਹਨ | 100,000/ਦਿਨ | ~200/ਦਿਨ |
| KV ਲਿਖਣ | 1,000/ਦਿਨ | ~350/ਦਿਨ (ਅਨੁਕੂਲਿਤ) |
| KV ਸਟੋਰੇਜ | 1 GB | ~10 KB/ਉਪਭੋਗਤਾ |
| ਸਥਿਰ ਸੰਪਤੀਆਂ | ਅਸੀਮਤ | ~400 KB (ਇੱਕੋ HTML) |

**ਮੁਫ਼ਤ ਟੀਅਰ 'ਤੇ ~3 ਸਮਕਾਲੀ ਸਰਗਰਮ ਉਪਭੋਗਤਾਵਾਂ ਦਾ ਸਮਰਥਨ ਕਰਦਾ ਹੈ।**

### ਵਿਕਲਪਿਕ ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ ਜੋੜਨਾ

#### ਪੁਸ਼ ਸੂਚਨਾਵਾਂ (ਮੁਫ਼ਤ)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### TURN ਸਰਵਰ (ਪਾਬੰਦੀਸ਼ੁਦਾ ਨੈੱਟਵਰਕਾਂ ਲਈ)

TURN ਉਹ ਤਰੀਕਾ ਹੈ ਜਿਸ ਨਾਲ ਕਾਲਾਂ ਅਤੇ ਰਿਲੇਅ-ਕੇਵਲ (IP-ਲੁਕਾਉਣ ਵਾਲੇ) ਕਨੈਕਸ਼ਨ
ਪਾਬੰਦੀਸ਼ੁਦਾ NAT ਨੂੰ ਪਾਰ ਕਰਦੇ ਹਨ। ਤੁਹਾਡਾ ਰਿਲੇਅ ਕਿਹੜਾ TURN ਦਿੰਦਾ ਹੈ, ਇਹ ਸੰਚਾਲਕ ਵਜੋਂ **ਤੁਹਾਡੀ** ਪਸੰਦ ਹੈ
— Worker ਕ੍ਰਮ ਵਿੱਚ ਕੋਸ਼ਿਸ਼ ਕਰਦਾ ਹੈ:

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

**ਤੁਸੀਂ ਅਸਲ ਵਿੱਚ ਕੀ ਸੰਰਚਿਤ ਕੀਤਾ ਹੈ, ਇਸਦੀ ਤਸਦੀਕ ਕਰੋ:** `GET /api/health` ਪ੍ਰਭਾਵੀ
ਮੋਡ ਨੂੰ `turnProvider` ਵਜੋਂ ਰਿਪੋਰਟ ਕਰਦਾ ਹੈ (`cloudflare` | `custom` | `static` |
`openrelay` | `none`)। ਪੁਰਾਣਾ `turn` ਬੂਲੀਅਨ ਸਿਰਫ਼
`TURN_URL` ਨੂੰ ਦਰਸਾਉਂਦਾ ਹੈ, ਇਸ ਲਈ ਇਹ ਸਿਫ਼ਾਰਸ਼ ਕੀਤੇ ਵਿਕਲਪ A ਲਈ `false` ਪੜ੍ਹਦਾ ਹੈ — `turnProvider` ਵਰਤੋ। ਕਲਾਇੰਟ `/security` ਵਿੱਚ ਉਹੀ ਪ੍ਰਦਾਤਾ ਦਿਖਾਉਂਦੇ ਹਨ, ਇਸ ਲਈ
Open Relay ਫਾਲਬੈਕ 'ਤੇ ਮੌਜੂਦ ਉਪਭੋਗਤਾ ਵੇਖ ਸਕਦਾ ਹੈ ਕਿ ਇੱਕ ਤੀਜੀ ਧਿਰ ਉਸਦੇ
ਕਾਲ ਮੀਡੀਆ ਨੂੰ ਰਿਲੇਅ ਕਰਦੀ ਹੈ (ਸਿਰਫ਼ ਮੈਟਾਡੇਟਾ — ਮੀਡੀਆ ਖੁਦ DTLS-SRTP ਇਨਕ੍ਰਿਪਟਡ ਹੈ)।

#### ਪ੍ਰਮਾਣਿਕਤਾ ਮਜ਼ਬੂਤੀ ਅਤੇ ਸਾਦਾ ਰਿਲੇਅ ਮਾਰਗ

ਪ੍ਰੀਕੀ ਅੱਪਲੋਡ ਹੁਣ ਦਸਤਖ਼ਤ ਮਾਲਕੀ ਨੂੰ `prekey-owner:<userId>` 'ਤੇ **ਕੋਈ TTL ਨਹੀਂ** ਨਾਲ ਵੱਖਰੇ ਤੌਰ 'ਤੇ ਸੁਰੱਖਿਅਤ ਰੱਖਦੇ ਹਨ। ਮੌਜੂਦਾ ਬੰਡਲ ਮਾਲਕੀ ਅਗਲੇ ਅੱਪਲੋਡ 'ਤੇ, ਬਦਲੀ ਸਵੀਕਾਰ ਕੀਤੇ ਜਾਣ ਤੋਂ ਪਹਿਲਾਂ, ਆਲਸੀ ਢੰਗ ਨਾਲ ਮਾਈਗ੍ਰੇਟ ਹੋ ਜਾਂਦੀ ਹੈ। ਨਵੇਂ Ed25519 ਬੰਡਲ ਵੀ ਉਹ ਰਿਕਾਰਡ ਸਥਾਪਤ ਕਰਦੇ ਹਨ। ਮਿਆਦ ਪੁੱਗੇ ਪ੍ਰੀਕੀ ਬੰਡਲਾਂ ਨੂੰ ਕੱਟਣ ਵੇਲੇ ਇਨ੍ਹਾਂ ਰਿਕਾਰਡਾਂ ਨੂੰ ਰੱਖੋ: ਬੰਡਲ ਦੀ ਮਿਆਦ ਦੀ ਉਡੀਕ ਕਰਨ ਨਾਲ ਨਵੇਂ ਮਾਲਕ ਦੀ ਆਗਿਆ ਨਹੀਂ ਮਿਲਣੀ ਚਾਹੀਦੀ। ਰੋਟੇਸ਼ਨ ਲਈ ਪਿਛਲੇ ਮਾਲਕ ਦੁਆਰਾ ਦਸਤਖ਼ਤ ਕੀਤੇ ਅੱਪਲੋਡ ਦੀ ਲੋੜ ਹੁੰਦੀ ਹੈ, ਜੋ ਮੌਜੂਦਾ ਅੱਪਲੋਡ ਡਾਈਜੈਸਟ ਵਿੱਚ ਨਵੀਂ ਕੁੰਜੀ ਨੂੰ ਬੰਨ੍ਹਦਾ ਹੈ। ਪ੍ਰਮਾਣਿਤ `/account/delete` ਦੋਵੇਂ ਰਿਕਾਰਡ ਮਿਟਾ ਦਿੰਦਾ ਹੈ ਅਤੇ ਬੰਡਲ ਦੀ ਮਿਆਦ ਖਤਮ ਹੋਣ ਤੋਂ ਬਾਅਦ ਵੀ ਮਾਲਕ ਦੇ ਵਿਰੁੱਧ ਪ੍ਰਮਾਣਿਤ ਕਰ ਸਕਦਾ ਹੈ। ਕੋਈ ਗੁਆਚੀ-ਮਾਲਕ-ਕੁੰਜੀ ਰੀਸੈੱਟ ਨਹੀਂ ਹੈ।

ਇਸ ਰਿਕਾਰਡ ਵਾਲੇ ਖਾਤਿਆਂ ਲਈ, ਅੱਪਲੋਡ ਅਤੇ ਸੁਨੇਹਾ/ਸੀਲ ਕੀਤਾ ਪੋਲ, ਸੀਲ ਕੀਤਾ ACK ਅਤੇ ਮੇਲਬਾਕਸ WebSocket ਸਬੂਤਾਂ ਨੂੰ ਟਿਕਾਊ ਮਾਲਕ ਦੀ ਵਰਤੋਂ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ। **ਬਿਨਾਂ ਦਸਤਖ਼ਤ ਵਾਲੀਆਂ ਬੇਨਤੀਆਂ ਰੱਦ ਕਰ ਦਿੱਤੀਆਂ ਜਾਂਦੀਆਂ ਹਨ, ਭਾਵੇਂ `PREKEY_REQUIRE_AUTH=false` ਜਾਂ `QUEUE_REQUIRE_AUTH=false` ਹੋਵੇ।** ਉਹ ਫਲੈਗ ਮਾਲਕ ਤੋਂ ਬਿਨਾਂ ਖਾਤਿਆਂ ਲਈ ਆਪਣੇ ਮੌਜੂਦਾ ਡਿਫਾਲਟ ਅਤੇ ਵਿਰਾਸਤੀ ਅਰਥ ਬਰਕਰਾਰ ਰੱਖਦੇ ਹਨ; ਬਿਨਾਂ ਦਸਤਖ਼ਤ ਵਾਲੇ ਅੱਪਲੋਡ/ਕਤਾਰ ਬੇਨਤੀਆਂ ਦੀ ਸਪਸ਼ਟ `false` ਸਵੀਕ੍ਰਿਤੀ ਇੱਕ ਸਮੱਗਰੀ-ਰਹਿਤ ਅਪ੍ਰਚਲਨ ਚੇਤਾਵਨੀ ਲੌਗ ਕਰਦੀ ਹੈ। ਹੋਰ ਪ੍ਰਮਾਣਿਕਤਾ ਫਲੈਗ ਬਦਲੇ ਨਹੀਂ ਹਨ। ਮੇਲਬਾਕਸ WebSocket ਨੂੰ ਅਜੇ ਵੀ ਹਰ ਕਿਸੇ ਲਈ ਦਸਤਖ਼ਤਾਂ ਦੀ ਲੋੜ ਹੁੰਦੀ ਹੈ।

ਕਲਾਇੰਟ ਕਤਾਰ ਗਤੀਵਿਧੀ ਤੋਂ ਪਹਿਲਾਂ ਦਸਤਖ਼ਤ ਸ਼ੁਰੂਆਤ ਦੀ ਉਡੀਕ ਕਰਦਾ ਹੈ, ਜਿਸ ਵਿੱਚ ਵਾਪਸ ਆਉਣ ਵਾਲੇ ਖਾਤੇ ਦੀ ਬੂਟ, ਲੀਡਰ ਤਰੱਕੀ ਅਤੇ ਮੁੜ ਕਨੈਕਸ਼ਨ ਸ਼ਾਮਲ ਹਨ। ਸਾਂਝੀ ਉਡੀਕ ਪੰਜ ਸਕਿੰਟਾਂ 'ਤੇ ਸੀਮਿਤ ਹੈ। ਅਸਮਰਥਿਤ ਰਨਟਾਈਮ ਤੁਰੰਤ ਬਿਨਾਂ ਦਸਤਖ਼ਤ ਜਾਰੀ ਰਹਿੰਦੇ ਹਨ; ਫਸਿਆ IDB/ਕੁੰਜੀ-ਖੋਲ੍ਹਣਾ ਸੀਮਾ ਤੋਂ ਬਾਅਦ ਬਿਨਾਂ ਦਸਤਖ਼ਤ ਜਾਰੀ ਰਹਿੰਦਾ ਹੈ, ਫਿਰ ਤਿਆਰ ਹੋਣ 'ਤੇ ਦਸਤਖ਼ਤ ਕਰਦਾ ਹੈ। ਇਹ ਪੋਲ ਲੂਪ ਨੂੰ ਜ਼ਿੰਦਾ ਰੱਖਦਾ ਹੈ, ਕੋਈ ਬਾਈਪਾਸ **ਨਹੀਂ**: ਮਾਲਕ-ਸਮਰਥਿਤ ਖਾਤੇ ਉਦੋਂ ਤੱਕ ਰਿਲੇਅ ਤੋਂ ਪ੍ਰਾਪਤ ਨਹੀਂ ਕਰ ਸਕਦੇ ਜਦੋਂ ਤੱਕ ਉਨ੍ਹਾਂ ਦੀ ਦਸਤਖ਼ਤ ਕੁੰਜੀ ਵਰਤੋਂਯੋਗ ਨਹੀਂ ਹੁੰਦੀ। ਪੁਰਾਣੀ ਸ਼ੁਰੂਆਤੀ ਦੌੜ ਤੋਂ ਬਚਣ ਲਈ Worker ਦੇ ਨਾਲ ਅੱਪਡੇਟ ਕੀਤੀਆਂ ਕਲਾਇੰਟ ਸੰਪਤੀਆਂ ਤੈਨਾਤ ਕਰੋ।

ਮਾਈਗ੍ਰੇਸ਼ਨ ਉਸ ਬੰਡਲ ਤੋਂ ਮਾਲਕੀ ਮੁੜ ਪ੍ਰਾਪਤ ਨਹੀਂ ਕਰ ਸਕਦੀ ਜਿਸਦੀ ਮਿਆਦ ਇਸਦੇ ਮਾਲਕ ਨੂੰ ਸੁਰੱਖਿਅਤ ਕੀਤੇ ਜਾਣ ਤੋਂ **ਪਹਿਲਾਂ** ਖਤਮ ਹੋ ਗਈ ਸੀ। ਪਹਿਲੀ ਰਜਿਸਟ੍ਰੇਸ਼ਨ TOFU ਹੀ ਰਹਿੰਦੀ ਹੈ। ਮਾਲਕੀ ਰਿਕਾਰਡ ਮੌਜੂਦਾ KV ਬੈਕਐਂਡ ਦੀ ਵਰਤੋਂ ਕਰਦੇ ਹਨ: ਇਸ ਬਦਲਾਅ ਨਾਲ ਅੰਤਿਮ ਇਕਸਾਰਤਾ ਅਤੇ ਸਮਕਾਲੀ ਲਿਖਤਾਂ ਨੂੰ ਰੇਖਿਕ ਨਹੀਂ ਬਣਾਇਆ ਜਾਂਦਾ। ਸਬੂਤ ਮੌਜੂਦਾ ਪੰਜ-ਮਿੰਟ ਤਾਜ਼ਗੀ ਵਿੰਡੋ ਅਤੇ ਕਾਰਵਾਈ/ਪੇਲੋਡ ਬਾਈਡਿੰਗ ਬਰਕਰਾਰ ਰੱਖਦੇ ਹਨ; ਵਿੰਡੋ ਦੇ ਅੰਦਰ ਇੱਕੋ ਜਿਹੀਆਂ ਮੁੜ ਕੋਸ਼ਿਸ਼ਾਂ ਇੱਕ-ਵਾਰੀ ਨੌਂਸ ਪ੍ਰੋਟੋਕੋਲ ਨਹੀਂ ਹਨ।

ਮੌਜੂਦਗੀ ਲਿਖਤਾਂ ਅਤੇ TURN ਪ੍ਰਮਾਣ ਪੱਤਰ ਜਾਰੀ ਕਰਨ ਲਈ ਪਹਿਲਾਂ ਹੀ ਮੂਲ ਰੂਪ ਵਿੱਚ ਇੱਕ *ਰਜਿਸਟਰਡ* ਖਾਤਾ (ਪ੍ਰੀਕੀ ਬੰਡਲ ਮੌਜੂਦ) ਚਾਹੀਦਾ ਹੈ, ਅਤੇ ਹਰ ਕਲਾਇੰਟ ਆਪਣੇ ਆਪ ਰਜਿਸਟਰ ਹੁੰਦਾ ਹੈ। ਮੌਜੂਦਗੀ ਦਿਲ ਦੀ ਧੜਕਣ ਇਸ ਤੋਂ ਇਲਾਵਾ ਇੱਕ Ed25519 ਮਾਲਕੀ ਸਬੂਤ ਰੱਖਦੀ ਹੈ (ਧੜਕਣ ਉਨ੍ਹਾਂ ਖੇਤਰਾਂ 'ਤੇ ਦਸਤਖ਼ਤ ਕਰਦੀ ਹੈ ਜੋ ਇਹ ਸਟੋਰ ਕਰਦੀ ਹੈ), ਜਿਸਨੂੰ Worker ਜਦੋਂ ਵੀ ਕੋਈ ਪੇਸ਼ ਕੀਤਾ ਜਾਂਦਾ ਹੈ ਤਾਂ ਤਸਦੀਕ ਕਰਦਾ ਹੈ — `PRESENCE_SIGN_REQUIRE_AUTH=true` ਉਸ ਸਬੂਤ ਨੂੰ ਲਾਜ਼ਮੀ ਬਣਾਉਂਦਾ ਹੈ। ਬਾਕੀ Ed25519-ਦਸਤਖ਼ਤ ਫਲੈਗ ਵਿਕਲਪਿਕ ਰਹਿੰਦੇ ਹਨ; `wrangler.toml` ਹਰ ਇੱਕ ਨੂੰ ਅਤੇ ਕਿਉਂ ਦਸਤਾਵੇਜ਼ ਕਰਦਾ ਹੈ (WebCrypto Ed25519 ਤੋਂ ਬਿਨਾਂ ਰਨਟਾਈਮ 'ਤੇ ਕਲਾਇੰਟ ਬਿਲਕੁਲ ਦਸਤਖ਼ਤ ਨਹੀਂ ਕਰ ਸਕਦੇ)।

ਵਿਰਾਸਤੀ ਸਾਦਾ ਰਿਲੇਅ (`/api/msg/send`, `/api/msg/poll`) ਅਪ੍ਰਚਲਿਤ ਹੈ: ਇਸਦੇ ਜਵਾਬਾਂ ਵਿੱਚ ਇੱਕ `Deprecation: true` ਹੈਡਰ ਹੁੰਦਾ ਹੈ, ਅਤੇ ਸੀਲ ਕੀਤਾ ਮਾਰਗ ਹਰ ਮੌਜੂਦਾ ਕਲਾਇੰਟ ਲਈ ਡਿਫਾਲਟ ਰੂਟ ਹੈ। ਇੱਕ ਵਾਰ ਜਦੋਂ ਤੁਸੀਂ ਪੁਸ਼ਟੀ ਕਰ ਲੈਂਦੇ ਹੋ ਕਿ ਕਿਸੇ ਵੀ ਲਾਈਵ ਕਲਾਇੰਟ ਨੂੰ ਹੁਣ ਫਾਲਬੈਕ ਦੀ ਲੋੜ ਨਹੀਂ ਹੈ, ਤਾਂ ਇਸਨੂੰ ਪੂਰੀ ਤਰ੍ਹਾਂ ਅਸਮਰੱਥ ਕਰੋ:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### ਕਸਟਮ ਡੋਮੇਨ

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### ਮੁਫ਼ਤ ਟੀਅਰ ਤੋਂ ਅੱਗੇ ਸਕੇਲਿੰਗ

ਜਦੋਂ ਤੁਸੀਂ ਮੁਫ਼ਤ ਟੀਅਰ ਤੋਂ ਵੱਧ ਜਾਂਦੇ ਹੋ ($5/ਮਹੀਨਾ Workers Paid ਪਲਾਨ):

| ਸਰੋਤ | ਭੁਗਤਾਨ ਕੀਤਾ ਪਲਾਨ |
|----------|-----------|
| Worker ਬੇਨਤੀਆਂ | 10 ਮਿਲੀਅਨ/ਮਹੀਨਾ |
| KV ਲਿਖਣ | 1 ਮਿਲੀਅਨ/ਮਹੀਨਾ |
| KV ਸਟੋਰੇਜ | 1 GB ਸ਼ਾਮਲ |
| CPU ਸਮਾਂ | 30 ਸਕਿੰਟ/ਬੇਨਤੀ |

ਇਹ **ਹਜ਼ਾਰਾਂ ਸਮਕਾਲੀ ਉਪਭੋਗਤਾਵਾਂ** ਦਾ ਸਮਰਥਨ ਕਰਦਾ ਹੈ।

### ਅੱਪਡੇਟ ਕਰਨਾ

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

ਕੋਈ ਬਿਲਡ ਕਦਮ ਨਹੀਂ। ਇੰਸਟਾਲ ਕਰਨ ਲਈ ਕੋਈ ਨਿਰਭਰਤਾ ਨਹੀਂ। ਬੱਸ ਤੈਨਾਤ ਕਰੋ।
