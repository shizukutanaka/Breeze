# Poradnik samodzielnego hostingu

**Czytaj w innym języku**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · Polski (ta strona) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Istnieją dwa sposoby uruchomienia przekaźnika Breeze:

1. **Samodzielny hosting (Node + Docker)** — przekaźnik na własnej
   maszynie lub VPS: jeden kontener, jeden wolumen danych, rejestracja
   domyślnie zamknięta. Zacznij tutaj, jeśli przekaźnik jest dla
   ciebie i twoich ludzi.
2. **Cloudflare** — wdrożenie w stylu oficjalnym w bezpłatnym planie
   Cloudflare (przekaźnik, który uruchamia sam Breeze). Zacznij tam,
   jeśli chcesz publicznego przekaźnika bez serwera do utrzymywania.

Oba uruchamiają identyczny kod obsługi; przekaźnik jest w każdym
razie głupią, wymienną skrzynką pocztową, a każdy klient działa z
każdym przekaźnikiem.

## Samodzielny hosting z Dockerem

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

Przekaźnik obsługuje zwykły HTTP na porcie 8787 wewnątrz kontenera.
**Zakończ TLS na odwrotnym proxy przed nim** (Caddy, nginx, Traefik,
Cloudflare Tunnel, …): przeglądarki będą używać przekaźnika tylko po
HTTPS/WSS. Gdy to zrobisz, ustaw `TRUST_PROXY: "true"` w
`docker-compose.yml`, aby ograniczanie szybkości opierało się na
prawdziwym adresie klienta — i nigdy nie ustawiaj tego bez takiego
proxy, ponieważ nagłówek, któremu ufa, może sfałszować każdy, kto może
bezpośrednio osiągnąć wejście.

Uruchamiaj dokładnie **jeden** kontener na wolumenie danych:
ogranicznik szybkości znajduje się w pamięci na proces, a operacje
każdej skrzynki pocztowej są serializowane wewnątrz tego procesu,
więc druga replika nie zachowałaby żadnej z tych właściwości.
Skaluj, dając temu jednemu procesowi większą maszynę.

### Rejestracja: domyślnie zamknięta

Samodzielnie hostowany przekaźnik, na którym mógłby się zarejestrować
każdy w internecie, odtworzyłby ekonomię spamu/nadużyć, do kontroli
której istnieją limity oficjalnego przekaźnika, dlatego **pakiet
Dockera jest dostarczany zamknięty**: plik compose przekazuje
`REGISTRATION_ALLOWLIST` (być może pustą), a tylko identyfikatory
Breeze z niej mogą *tworzyć konta* (pierwsze przesłanie prekey).
Zamknięcie rejestracji nigdy nie dotyka osób już osiadłych na
przekaźniku — ich przesłania, depozyty, rendezvous i odpytywania nie
są bramkowane — a otwarcie rejestracji jest wyraźnym wyborem, nigdy
wartością domyślną.

- **Twój identyfikator Breeze** to 12-znakowy identyfikator w twoim
  linku zaproszenia (pierwsze 12 znaków jego wartości `pub`). Zapytaj
  każdą zapraszaną osobę o jej identyfikator w ten sam sposób —
  identyfikator jest publicznym identyfikatorem, którym kontakty już
  się wymieniają, a nie sekretem.
- **Dopuszczaj osoby**, wymieniając ich identyfikatory: ustaw
  `BREEZE_ALLOWLIST=id1,id2,…` w swojej powłoce albo w pliku `.env`
  obok `docker-compose.yml`, a potem ponownie `docker compose up -d`.
- **Zacznij teraz, dopuszczaj później**: bez ustawionego
  `BREEZE_ALLOWLIST` przekaźnik działa zamknięty dla wszystkich —
  dziennik rozruchu o tym mówi — i nikt nie może się zarejestrować,
  dopóki nie dodasz identyfikatorów.
- **Otwarty przekaźnik** (każdy może się zarejestrować): odkomentuj
  `REGISTRATION_OPEN: "1"` w `docker-compose.yml`. Jeśli to zrobisz,
  ekonomia nadużyć jest twoja.

### Limit użycia: wyłącz go na własnym przekaźniku

Worker jest dostarczany z włączonym **limitem uczciwego użycia**: na
skrzynkę pocztową co najwyżej 10 000 depozytów dziennie i 200 000
miesięcznie (depozyt to jeden pełny cykl dostarczenia — zobacz
`docs/COST_MODEL.md` §10 w sprawie zasad i liczb). Ta rama istnieje
dla *współdzielonego domyślnego przekaźnika*, który działa jako
bezpłatne wejście, którego zmienne koszty operator w przeciwnym razie
dźwigałby za wszystkich. **Na przekaźniku, który uruchamiasz dla
siebie i swoich ludzi, rama jest bezcelowa — wyłącz ją**:

```bash
USAGE_QUOTA_ENABLED=false
```

Ustaw to tam, skąd twój przekaźnik czyta swoje środowisko (powłoka lub
`.env` obok `docker-compose.yml`, środowisko procesu Node albo sekrety
Cloudflare Pages). Istnieją dwa sąsiednie pokrętła, jeśli prowadzisz
przekaźnik społecznościowy i *chcesz* ramę: `USAGE_QUOTA_DAILY` i
`USAGE_QUOTA_MONTHLY` dostrajają limity. Uwagi, które mają znaczenie:

- Limit jest egzekwowany tylko wtedy, gdy skrzynki pocztowe żyją w
  Durable Objects (`MAILBOX_BACKEND=do`, wartość domyślna na tym
  hoście); na backendzie KV jest udokumentowanym no-op.
- Po przekroczeniu limitu nadawcy otrzymują wyraźne
  `429 USAGE_QUOTA_EXCEEDED` (z oknem i jego limitem) zamiast cichego
  odrzucenia — wiadomość pozostaje w skrzynce nadawczej nadawcy, a
  odbiorca pozostaje osiągalny przez P2P i przez każdy inny domowy
  przekaźnik.

### Tożsamość przekaźnika

Przy pierwszym rozruchu przekaźnik generuje trwały klucz tożsamości
Ed25519 *wewnątrz wolumenu danych* i drukuje jego odcisk w dzienniku:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

Odcisk identyfikuje *twój* przekaźnik: przekaż go swoim użytkownikom
poza kanałem (osobiście, innym kanałem), aby mogli rozpoznać
przekaźnik, który im przekazano, jako ten, który ty uruchamiasz. Ten
sam odcisk drukuje się przy każdym rozruchu; jeśli kiedykolwiek się
zmieni, wolumen danych został zastąpiony — zbadaj sprawę, zanim
powiesz użytkownikom, aby zaufali nowemu.

Klienci weryfikują i przypinają ten klucz automatycznie (etap 2, krok
4): przy pierwszym kontakcie klient wyzywa przekaźnik do podpisania
kluczem (`/api/relay/attest`), przechowuje zweryfikowany klucz przy
koncie i ponownie go weryfikuje przy każdej późniejszej sesji. Odcisk,
który pokazuje klient (w `/security` oraz w powiadomieniu przy
pierwszym przypięciu), jest wyprowadzany z tego samego klucza —
porównaj go z powyższą linią dziennika rozruchu. Jeśli klucz
kiedykolwiek się zmieni, klienci **przestaną rozmawiać z
przekaźnikiem** i ostrzegą użytkownika; nigdy nie przypinają ponownie
po cichu. Traktuj zmianę odcisku jako zdarzenie łamiące: w kroku 4 nie
ma w aplikacji przycisku „zaufaj nowemu kluczowi", więc po prawdziwej
utracie wolumenu twoi użytkownicy muszą wyczyścić przechowywane dane
aplikacji dla swojego konta i ponownie przypiąć przy pierwszym
kontakcie — ogłoś nowy odcisk poza kanałem wcześniej, inaczej nie
będą potrafili odróżnić twojego nowego klucza od klucza atakującego.

### Kopia zapasowa i przywracanie

**Wolumen danych jest całym stanem przekaźnika**: jeden plik SQLite
zawierający katalog, skrzynki pocztowe i klucz tożsamości
przekaźnika. Nie ma niczego więcej do skopiowania zapasowo.

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

### Aktualizacja

```bash
git pull origin main
docker compose up -d --build
```

Stan żyje w wolumenie, a nie w obrazie, więc aktualizacja nigdy nie
dotyka danych twoich użytkowników.

## Samodzielny hosting z gołym Node (bez Dockera)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

Konfiguracja to wyłącznie zmienne środowiskowe — `server/README.md`
wymienia je wszystkie. Dwie różnice względem ścieżki Dockera:

- **Plik danych** domyślnie to `./breeze-relay.db` (nadpisywany przez
  `BREEZE_DB_PATH`); jest to ten sam stan w jednym pliku, łącznie z
  tożsamością przekaźnika. Twórz jego kopię zapasową w ten sam sposób:
  zatrzymaj, skopiuj, uruchom ponownie.
- **Rejestracja jest otwarta, chyba że ją zamkniesz**: zamknięta
  wartość domyślna jest właściwością pakietu Dockera. Aby zamknąć gołe
  wejście, ustaw `REGISTRATION_ALLOWLIST=id1,id2` (albo pustą wartość
  dla zamkniętego dla wszystkich); `REGISTRATION_OPEN=1` wyraźnie
  otwiera ponownie.

## Wdrożenie na Cloudflare

### Minimalne wdrożenie (0 $/miesiąc, 5 minut)

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

**To wszystko.** Wszystkie funkcje działają oprócz powiadomień push.
Zwróć uwagę, że rejestracja przy wdrożeniu na Cloudflare jest
**otwarta**, chyba że sam ustawisz `REGISTRATION_ALLOWLIST` (zobacz
`.env.example`); pakiet zamknięty domyślnie to powyższa ścieżka
Dockera.

### Co działa za 0 $

| Funkcja | Status | Uwagi |
|---------|--------|-------|
| Szyfrowany czat E2E | ✓ | Pełny Double Ratchet |
| Wiadomości P2P | ✓ | WebRTC DataChannel |
| Połączenia głosowe/wideo | ✓ | WebRTC + bezpłatny STUN |
| Przekaźnik TURN | ✓ | Open Relay (20 GB/miesiąc bezpłatnie) |
| Grupy (100 członków) | ✓ | Sender Key O(1) |
| Transfer plików | ✓ | Do 50 MB przez P2P |
| 8 języków | ✓ | EN + 7 pełnych lokalizacji, wykrywane automatycznie |
| Offline/PWA | ✓ | Service Worker |
| Powiadomienia push | ✗ | Wymaga kluczy VAPID |

Rozliczenia wielokontowe (Lite/Plus/Pro) nie są dostępne — zobacz
sekcję „Removed: multi-account billing” w [SECURITY.md](../../SECURITY.md).
Każde konto otrzymuje nieograniczone lokalne subkonta bezpłatnie, bez
żadnego bramkowania planami.

### Limity bezpłatnego planu

| Zasób | Bezpłatny plan | Użycie na aktywnego użytkownika |
|----------|-----------|----------------------|
| Żądania Workera | 100 000/dzień | ~500/dzień (odpytywanie + sygnalizacja) |
| Odczyty KV | 100 000/dzień | ~200/dzień |
| Zapisy KV | 1 000/dzień | ~350/dzień (zoptymalizowane) |
| Magazyn KV | 1 GB | ~10 KB/użytkownik |
| Zasoby statyczne | Bez ograniczeń | ~400 KB (jeden HTML) |

**Obsługuje ~3 jednoczesnych aktywnych użytkowników w bezpłatnym planie.**

### Dodawanie opcjonalnych funkcji

#### Powiadomienia push (bezpłatnie)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Serwer TURN (dla sieci restrykcyjnych)

TURN jest tym, dzięki czemu połączenia oraz połączenia wyłącznie przez
przekaźnik (ukrywające IP) przechodzą przez restrykcyjne NAT-y. To,
jaki TURN rozdaje twój przekaźnik, jest **twoim** wyborem jako
operatora — Worker próbuje, w kolejności:

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

**Zweryfikuj, co faktycznie skonfigurowałeś:** `GET /api/health`
raportuje efektywny tryb jako `turnProvider` (`cloudflare` |
`custom` | `static` | `openrelay` | `none`). Starsza wartość logiczna
`turn` odzwierciedla tylko `TURN_URL`, więc dla zalecanej Opcji A
odczytuje się jako `false` — używaj `turnProvider`. Klienci pokazują
tego samego dostawcę w `/security`, więc użytkownik korzystający z
zapasowego Open Relay może zobaczyć, że strona trzecia przekazuje
media jego połączeń (tylko metadane — samo media jest szyfrowane
DTLS-SRTP).

#### Wzmocnienie uwierzytelniania i ścieżka prostego przekaźnika

Przesłania prekey zachowują teraz własność podpisu oddzielnie w
`prekey-owner:<userId>` **bez TTL**. Istniejąca własność pakietów
migruje leniwie przy następnym przesłaniu, zanim zostanie przyjęta
zamiana. Nowe pakiety Ed25519 również ustanawiają ten zapis.
Zachowuj te zapisy przy czyszczeniu wygasłych pakietów prekey:
czekanie na wygaśnięcie pakietu nie może pozwalać na nowego
właściciela. Rotacja wymaga przesłania podpisanego przez poprzedniego
właściciela, wiążącego nowy klucz w istniejącym skrócie przesłania.
Uwierzytelnione `/account/delete` kasuje oba zapisy i może
uwierzytelniać się wobec właściciela nawet po wygaśnięciu pakietu.
Nie ma resetowania po utracie klucza właściciela.

Dla kont z tym zapisem przesłania oraz odpytywania o
wiadomości/sealed, potwierdzenia sealed ACK i dowody WebSocket
skrzynki pocztowej muszą używać trwałego właściciela. **Niepodpisane
żądania są odrzucane nawet przy `PREKEY_REQUIRE_AUTH=false` lub
`QUEUE_REQUIRE_AUTH=false`.** Te flagi zachowują swoje istniejące
wartości domyślne i odziedziczoną semantykę dla kont bez właściciela;
wyraźna akceptacja `false` niepodpisanych żądań przesłania/kolejki
zapisuje pozbawione treści ostrzeżenie o deprecjacji. Pozostałe flagi
uwierzytelniania bez zmian. WebSockety skrzynek pocztowych nadal
wymagają podpisów dla wszystkich.

Klient czeka na inicjalizację podpisu przed aktywnością w kolejce, w
tym rozruch powracającego konta, awans lidera i ponowne połączenie.
Wspólne oczekiwanie jest ograniczone do pięciu sekund.
Nieobsługiwane środowiska wykonawcze kontynuują bez podpisu
natychmiast; zablokowane IDB/odwijanie klucza kontynuuje bez podpisu
po limicie, a potem podpisuje, gdy jest gotowe. Utrzymuje to pętlę
odpytywania przy życiu, **nie** jest obejściem: konta z właścicielem
nie mogą odbierać z przekaźnika, dopóki ich klucz podpisu nie stanie
się użyteczny. Wdrażaj zaktualizowane zasoby klienta razem z Workerem,
aby uniknąć starego wyścigu przy starcie.

Migracja nie może odzyskać własności z pakietu, który wygasł **przed**
zachowaniem jego właściciela. Pierwsza rejestracja pozostaje TOFU.
Zapisy własności używają istniejącego backendu KV: ewentualna
spójność i współbieżne zapisy nie stają się przez tę zmianę
linearyzowalne. Dowody zachowują istniejące pięciominutowe okno
świeżości oraz wiązanie operacja/ładunek; identyczne powtórzenia w
oknie nie są jednorazowym protokołem nonce.

Zapisy obecności i wydawanie poświadczeń TURN już domyślnie wymagają
*zarejestrowanego* konta (obecny pakiet prekey), a każdy klient
rejestruje się automatycznie. Heartbeaty obecności dodatkowo niosą
dowód własności Ed25519 (beat podpisuje pola, które przechowuje),
który Worker weryfikuje zawsze, gdy taki dowód zostanie przedstawiony
— `PRESENCE_SIGN_REQUIRE_AUTH=true` czyni ten dowód obowiązkowym.
Pozostałe flagi podpisu Ed25519 pozostają opt-in; `wrangler.toml`
dokumentuje każdą z nich i dlaczego (klienci w środowiskach bez
WebCrypto Ed25519 w ogóle nie mogą podpisywać).

Przestarzały prosty przekaźnik (`/api/msg/send`, `/api/msg/poll`) jest
przestarzały: jego odpowiedzi niosą nagłówek `Deprecation: true`, a
ścieżka sealed jest domyślną trasą dla każdego bieżącego klienta. Gdy
potwierdzisz, że żaden żywy klient nie potrzebuje już zapasowej
ścieżki, wyłącz ją całkowicie:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Własna domena

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Skalowanie poza bezpłatny plan

Gdy przerosniesz bezpłatny plan (płatny plan Workers Paid za
5 $/miesiąc):

| Zasób | Plan płatny |
|----------|-----------|
| Żądania Workera | 10 milionów/miesiąc |
| Zapisy KV | 1 milion/miesiąc |
| Magazyn KV | 1 GB wliczone |
| Czas CPU | 30 sekund/żądanie |

Obsługuje to **tysiące jednoczesnych użytkowników**.

### Aktualizacja

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Bez kroku budowania. Bez zależności do zainstalowania. Po prostu wdróż.
