# מדריך אירוח עצמי

**קראו בשפות אחרות / Read in another language**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · עברית (דף זה) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


יש שתי דרכים להריץ מתווך (relay) של Breeze:

1. **אירוח עצמי (Node + Docker)** — המתווך על המכונה או ה־VPS שלכם:
   קונטיינר אחד, אמצעי אחסון נתונים (volume) אחד, הרשמה סגורה
   כברירת מחדל. התחילו כאן אם המתווך הוא בשבילכם ובשביל האנשים שלכם.
2. **Cloudflare** — הפריסה בסגנון הרשמי על המסלול החינמי של Cloudflare
   (המתווך ש־Breeze עצמה מריצה). התחילו שם אם אתם רוצים
   מתווך ציבורי בלי שרת לתחזק.

שתיהן מריצות בדיוק את אותו קוד handler; מתווך הוא תיבת דואר
טיפשה וניתנת להחלפה בכל מקרה, וכל לקוח עובד עם
כל מתווך.

## אירוח עצמי עם Docker

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

המתווך מגיש HTTP פשוט על פורט 8787 בתוך הקונטיינר.
**סיימו את ה־TLS בפרוקסי הפוך לפניו** (Caddy, nginx,
Traefik, Cloudflare Tunnel, …): דפדפנים ישתמשו במתווך רק
מעל HTTPS/WSS. כשאתם עושים זאת, הגדירו `TRUST_PROXY: "true"` ב־
`docker-compose.yml` כדי שהגבלת הקצב תתבסס על כתובת הלקוח
האמיתית — ולעולם אל תגדירו זאת בלי פרוקסי כזה, כי הכותרת
שהוא סומך עליה ניתנת לזיוף על ידי כל מי שיכול להגיע ישירות לכניסה.

הריצו בדיוק **אחד** קונטיינר מול אמצעי אחסון הנתונים: מגביל
הקצב נמצא בזיכרון לכל תהליך, ופעולותיה של כל תיבת דואר מסודרות
בתוך אותו תהליך, כך שעותק שני לא יחזיק באף אחת מהתכונות הללו. הרחיבו על ידי מתן מכונה גדולה יותר לתהליך האחד.

### הרשמה: סגורה כברירת מחדל

מתווך באירוח עצמי שכל אחד באינטרנט יכול להירשם אליו
ישחזר את כלכלת הספאם/הניצול לרעה שמגבלות המתווך הרשמי
קיימות כדי לשלוט בה, ולכן **אריזת ה־Docker מגיעה סגורה**: קובץ
ה־compose מעביר `REGISTRATION_ALLOWLIST` (שעשוי להיות ריק) ורק
מזהי Breeze שברשימה רשאים *ליצור חשבונות* (העלאת prekey
ראשונה). סגירת ההרשמה לעולם אינה משפיעה על אנשים שכבר שוכנים
במתווך — ההעלאות, ההפקדות, ה־rendezvous וה־polls שלהם אינם
מוגבלים — ופתיחת ההרשמה היא בחירה מפורשת, לעולם לא ברירת המחדל.

- **מזהה ה־Breeze שלכם** הוא המזהה בן 12 התווים בקישור ההזמנה
  שלכם (12 התווים הראשונים של ערך ה־`pub` שלו). בקשו מכל אדם
  שאתם מזמינים את שלו באותה דרך — המזהה הוא מזהה ציבורי
  שאנשי קשר כבר מחליפים ביניהם, לא סוד.
- **אפשרו לאנשים** על ידי רישום המזהים שלהם: הגדירו
  `BREEZE_ALLOWLIST=id1,id2,…` ב־shell שלכם או בקובץ `.env` ליד
  `docker-compose.yml`, ואז הריצו שוב `docker compose up -d`.
- **התחילו עכשיו, אפשרו אחר כך**: כשלא מוגדר `BREEZE_ALLOWLIST`, ה־
  מתווך רץ סגור לכולם — יומן האתחול אומר זאת — ואף אחד
  לא יכול להירשם עד שתוסיפו מזהים.
- **מתווך פתוח** (כל אחד יכול להירשם): הסירו את ההערה
  מ־`REGISTRATION_OPEN: "1"` ב־`docker-compose.yml`. כלכלת הניצול לרעה היא שלכם אם תעשו זאת.

### מכסת שימוש: כבו אותה במתווך שלכם

ה־worker מגיע עם **מכסת שימוש הוגן** מופעלת: לכל
תיבת דואר, לכל היותר 10,000 הפקדות/יום ו־200,000/חודש (הפקדה היא
מחזור מסירה מלא אחד — ראו `docs/COST_MODEL.md` §10 ל־
מדיניות ולמספרים). המסגרת הזו קיימת עבור *מתווך ברירת המחדל המשותף*,
שמופעל ככניסה חינמית שעלויותיה המשתנות המפעיל היה אחרת
נושא עבור כולם. **במתווך שאתם מריצים
לעצמכם ולאנשים שלכם, המסגרת חסרת טעם — השביתו
אותה**:

```bash
USAGE_QUOTA_ENABLED=false
```

הגדירו זאת בכל מקום שבו המתווך שלכם קורא את הסביבה שלו (ה־shell או
`.env` ליד `docker-compose.yml`, סביבת תהליך ה־Node,
או סודות Cloudflare Pages). שני כפתורים שכנים קיימים אם אתם
מריצים מתווך קהילתי ו*כן* רוצים מסגרת:
`USAGE_QUOTA_DAILY` ו־`USAGE_QUOTA_MONTHLY` מכווננים מחדש את התקרות.
הערות שחשובות:

- המכסה נאכפת רק כש־תיבות הדואר חיות ב־Durable
  Objects (`MAILBOX_BACKEND=do`, ברירת המחדל במארח זה); על
  ה־KV backend זו פעולת no-op מתועדת.
- מעבר לתקרה, שולחים מקבלים `429 USAGE_QUOTA_EXCEEDED` מפורש
  (עם החלון והמגבלה שלו) במקום השמטה שקטה — ה־
  הודעה נשארת בתיבת היציאה של השולח, והנמען נשאר
  נגיש מעל P2P ובאמצעות כל מתווך ביתי אחר.

### זהות המתווך

באתחול הראשון המתווך יוצר מפתח זהות Ed25519 קבוע
*בתוך אמצעי אחסון הנתונים* ומדפיס את טביעת האצבע שלו ביומן:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

טביעת האצבע מזהה את המתווך *שלכם*: תנו אותה למשתמשים שלכם
מחוץ לערוץ (באופן אישי, מעל ערוץ אחר) כדי שיוכלו לזהות
שהמתווך שניתן להם הוא זה שאתם מריצים. אותה טביעת אצבע
מודפסת בכל אתחול; אם היא אי פעם משתנה, אמצעי אחסון הנתונים הוחלף
— חקרו לפני שתגידו למשתמשים לבטוח בחדשה.

לקוחות מאמתים ומצמידים (pin) את המפתח הזה אוטומטית (שלב־2 צעד 4): ב־
מגע ראשון לקוח מאתגר את המתווך לחתום עם המפתח
(`/api/relay/attest`), מאחסן את המפתח המאומת עם החשבון, ו־
מאמת מחדש בכל מפגש מאוחר יותר. טביעת האצבע שהלקוח מציג
(תחת `/security`, וב־toast בהצמדה הראשונה) נגזרת מ־
אותו מפתח — השוו אותה לשורת יומן האתחול שלעיל. אם המפתח
אי פעם משתנה, לקוחות **מפסיקים לדבר עם המתווך** ומזהירים את
המשתמש; הם לעולם לא מצמידים מחדש בשקט. התייחסו לשינוי טביעת אצבע כ־
אירוע שובר: אין כפתור «סמוך על המפתח החדש» בתוך האפליקציה ב־
צעד 4, כך שלאחר אובדן אמיתי של אמצעי האחסון המשתמשים שלכם חייבים לנקות את
הנתונים המאוחסנים של האפליקציה עבור החשבון שלהם ולהצמיד מחדש במגע הראשון —
הכריזו על טביעת האצבע החדשה מחוץ לערוץ קודם, אחרת הם לא יוכלו להבדיל
בין המפתח החדש שלכם לבין זה של תוקף.

### גיבוי ושחזור

**אמצעי אחסון הנתונים הוא כל מצב המתווך**: קובץ SQLite אחד
שמחזיק את המדריך, את תיבות הדואר ואת מפתח זהות המתווך.
אין שום דבר אחר לגבות.

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

### עדכון

```bash
git pull origin main
docker compose up -d --build
```

המצב חי באמצעי האחסון, לא בתמונה (image), כך שעדכון לעולם לא נוגע
בנתוני המשתמשים שלכם.

## אירוח עצמי עם Node חשוף (ללא Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

התצורה היא משתני סביבה בלבד — `server/README.md`
מפרט את כולם. שני הבדלים מנתיב ה־Docker:

- **קובץ הנתונים** כברירת מחדל הוא `./breeze-relay.db` (דרסו עם
  `BREEZE_DB_PATH`); זהו אותו מצב של קובץ יחיד, זהות
  המתווך כלולה. גבו אותו באותה דרך: עצרו, העתיקו, הפעילו מחדש.
- **ההרשמה פתוחה אלא אם תסגרו אותה**: ברירת המחדל הסגורה
  היא תכונה של אריזת ה־Docker. כדי לסגור כניסה חשופה, הגדירו
  `REGISTRATION_ALLOWLIST=id1,id2` (או ערך ריק ל־
  סגור־לכולם); `REGISTRATION_OPEN=1` פותח מחדש במפורש.

## פריסת Cloudflare

### פריסה מינימלית ($0/חודש, 5 דקות)

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

**זהו זה.** כל התכונות עובדות מלבד התראות push. שימו לב
שההרשמה בפריסת Cloudflare היא **פתוחה** אלא אם אתם
מגדירים `REGISTRATION_ALLOWLIST` בעצמכם (ראו `.env.example`); ה־
אריזה הסגורה־כברירת־מחדל היא נתיב ה־Docker שלעיל.

### מה עובד ב־$0

| תכונה | סטטוס | הערות |
|---------|--------|-------|
| צ'אט מוצפן E2E | ✓ | Double Ratchet מלא |
| הודעות P2P | ✓ | WebRTC DataChannel |
| שיחות קוליות/וידאו | ✓ | WebRTC + STUN חינמי |
| מתווך TURN | ✓ | Open Relay (20GB/חודש חינם) |
| קבוצות (1,000 חברים) | ✓ | Sender Key O(1) |
| העברת קבצים | ✓ | עד 50MB דרך P2P |
| 51 שפות | ✓ | אנגלית מובנית + 50 קובצי locale מלאים, זיהוי אוטומטי |
| לא מקוון/PWA | ✓ | Service Worker |
| התראות Push | ✗ | צריך מפתחות VAPID |

חיוב רב־חשבונות (Lite/Plus/Pro) אינו זמין — ראו
את הסעיף «Removed: multi-account billing» ב[SECURITY.md](../../SECURITY.md). כל חשבון מקבל
תתי־חשבונות מקומיים ללא הגבלה בחינם, ללא שערי תוכנית.

### מגבלות המסלול החינמי

| משאב | מסלול חינמי | שימוש לכל משתמש פעיל |
|----------|-----------|----------------------|
| בקשות Worker | 100,000/יום | ~500/יום (polling + signaling) |
| קריאות KV | 100,000/יום | ~200/יום |
| כתיבות KV | 1,000/יום | ~350/יום (ממוטב) |
| אחסון KV | 1 GB | ~10 KB/משתמש |
| נכסים סטטיים | ללא הגבלה | ~894 KB (HTML יחיד) |

**תומך בכ־3 משתמשים פעילים בו־זמנית במסלול החינמי.**

### הוספת תכונות אופציונליות

#### התראות Push (חינם)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### שרת TURN (לרשתות מגבילות)

TURN הוא האופן שבו שיחות וחיבורים מבוססי־מתווך־בלבד (מסתירי IP) חוצים
NATים מגבילים. איזה TURN המתווך שלכם מוסר הוא בחירה **שלכם**
כמפעילים — ה־Worker מנסה, לפי הסדר:

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

**אמתו מה באמת הגדרתם:** `GET /api/health` מדווח על ה־
מצב האפקטיבי כ־`turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). הבוליאן הישן יותר `turn` משקף רק את
`TURN_URL`, כך שהוא נקרא `false` עבור Option A המומלץ — השתמשו
ב־`turnProvider`. לקוחות מציגים את אותו ספק ב־`/security`, כך ש־
משתמש שנמצא על גיבוי ה־Open Relay יכול לראות שצד שלישי מתווך את
מדיית השיחה שלו (מטא־נתונים בלבד — המדיה עצמה מוצפנת ב־DTLS-SRTP).

#### הקשחת אימות ונתיב המתווך הפשוט (Plain)

העלאות prekey שומרות כעת בעלות חתימה בנפרד ב־
`prekey-owner:<userId>` עם **ללא TTL**. בעלות על bundle קיים מוגרת בעצלתיים
בהעלאה הבאה, לפני שמתקבל תחליף. bundles חדשים של Ed25519 גם
יוצרים את הרשומה הזו. שמרו את הרשומות האלה כשאתם גוזמים bundles של prekey שפג תוקפם:
המתנה לפקיעת bundle אסור שתאפשר בעלים חדש. רוטציה דורשת
העלאה חתומה על ידי הבעלים הקודם, שמקבעת את המפתח החדש בתוך אותו digest של העלאה
קיים. `/account/delete` מאומת מוחק את שתי הרשומות ויכול לאמת
מול הבעלים גם לאחר פקיעת ה־bundle. אין איפוס למפתח־בעלים שאבד.

לחשבונות עם רשומה זו, העלאה ו־poll של הודעות/sealed, ACK של sealed ו־
הוכחות WebSocket של תיבת דואר חייבים להשתמש בבעלים העמיד. **בקשות לא חתומות
נדחות גם עם `PREKEY_REQUIRE_AUTH=false` או `QUEUE_REQUIRE_AUTH=false`.**
הדגלים האלה שומרים על ברירות המחדל והסמנטיקה הישנה שלהם לחשבונות
ללא בעלים; קבלה מפורשת של `false` לבקשות העלאה/תור לא חתומות
רושמת אזהרת deprecation נטולת תוכן. דגלי אימות אחרים לא השתנו.
WebSockets של תיבת דואר עדיין דורשים חתימות לכולם.

הלקוח ממתין לאתחול החתימה לפני פעילות תור, כולל
אתחול של חשבון חוזר, קידום leader והתחברות מחדש. ההמתנה המשותפת
מוגבלת לחמש שניות. סביבות ריצה לא נתמכות ממשיכות לא חתומות מיד;
IDB/פתיחת מפתח תקועה ממשיכה לא חתומה אחרי הגבול, ואז חותמת כשמוכן.
זה שומר על לולאת ה־poll חיה, **לא** מעקף: חשבונות עם גיבוי־בעלים אינם יכולים
לקבל מהמתווך עד שמפתח החתימה שלהם שמיש. פרסו נכסי לקוח מעודכנים
לצד ה־Worker כדי להימנע ממרוץ האתחול הישן.

הגירה אינה יכולה לשחזר בעלות מ־bundle שפג **לפני** ש־
הבעלים שלו נשמר. הרשמה ראשונה נשארת TOFU. רשומות בעלות משתמשות ב־
אותו KV backend קיים: עקביות בסופו של דבר וכתיבות בו־זמניות אינן נעשות
לינאריות על ידי שינוי זה. הוכחות שומרות על חלון הטריות של חמש הדקות הקיים
ועל קשירת פעולה/payload; ניסיונות חוזרים זהים בתוך החלון אינם
פרוטוקול nonce חד־פעמי.

כתיבות Presence והנפקת אישורי TURN כבר דורשות חשבון *רשום*
(bundle של prekey קיים) כברירת מחדל, וכל לקוח נרשם
אוטומטית. פעימות Presence נושאות בנוסף הוכחת בעלות Ed25519
(הפעימה חותמת על השדות שהיא מאחסנת), שה־Worker מאמת
בכל פעם שמוצגת כזו — `PRESENCE_SIGN_REQUIRE_AUTH=true` הופך את
ההוכחה הזו לחובה. דגלי חתימת ה־Ed25519 הנותרים נשארים opt-in;
`wrangler.toml` מתעד כל אחד מהם ומדוע (לקוחות בסביבות ריצה ללא
WebCrypto Ed25519 אינם יכולים לחתום כלל).

המתווך הפשוט הישן (`/api/msg/send`, `/api/msg/poll`) מופחת (deprecated): התגובות שלו
נושאות כותרת `Deprecation: true`, והנתיב ה־sealed הוא
ברירת המחדל לכל לקוח נוכחי. לאחר שאישרתם שאף לקוח חי
אינו צריך עוד את הגיבוי, השביתו אותו לחלוטין:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### דומיין מותאם אישית

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### הרחבה מעבר למסלול החינמי

כשאתם צומחים מעבר למסלול החינמי (תוכנית Workers Paid ב־$5/חודש):

| משאב | תוכנית בתשלום |
|----------|-----------|
| בקשות Worker | 10 מיליון/חודש |
| כתיבות KV | 1 מיליון/חודש |
| אחסון KV | 1 GB כלול |
| זמן CPU | 30 שניות/בקשה |

זה תומך ב**אלפי משתמשים בו־זמנית**.

### עדכון

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

אין צעד build. אין תלויות להתקין. פשוט לפרוס.
