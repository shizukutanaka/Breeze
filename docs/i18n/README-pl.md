# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Czytaj w innym języku**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · Polski (ta strona) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Szyfrowany komunikator, który nie wymaga numeru telefonu ani rejestracji.**
Treść rozmów mogą odczytać tylko nadawca i odbiorca. Nawet serwer, który je przenosi, nie może ich odczytać.
Wszystkie funkcje są bezpłatne i nie ma reklam.

To nie jest strona internetowa, lecz oprogramowanie do zainstalowania i używania (Windows / Mac / Linux / Android / iPhone / przeglądarka).

![Zrzut ekranu Breeze Messenger — okno główne tuż po utworzeniu tożsamości](../images/screenshot.png)

## Aby z niego korzystać, stawiasz go na własnym serwerze

Breeze nie ma „serwera firmy”. **Aby z niego korzystać, sam przygotowujesz miejsce (serwer) i stawiasz na nim Breeze. To jest oficjalny sposób użycia.**

- Miejsca wystarczy w bezpłatnym zakresie. Działa w bezpłatnym planie Cloudflare, karta kredytowa nie jest potrzebna. Procedura znajduje się w [poradniku instalacji](SELF_HOSTING-pl.md) (wersje w innych językach można wybrać na początku poradnika).
- Aplikacje (Windows / Mac / Linux / Android / iPhone) pobierz ze [strony pobierania](https://github.com/shizukutanaka/Breeze/releases/latest) i połącz je z własnym serwerem.
- **O instalacji pokazowej (uczciwa informacja)**: do sprawdzania działania umieszczono egzemplarz pokazowy (https://breeze-469.pages.dev/). Jest tam to samo oprogramowanie, ale do prawdziwego użytku prosimy korzystać z własnego serwera. Egzemplarz pokazowy może się zmienić lub zostać zatrzymany bez zapowiedzi. To, co postawiłeś na własnym serwerze, nie odczuje skutków zatrzymania egzemplarza pokazowego.

Szczegóły użytkowania znajdują się w [instrukcji obsługi](MANUAL-pl.md) (wersje w innych językach można wybrać na początku instrukcji).

## Jak korzystać (3 kroki)

1. Otwórz Breeze postawionego na własnym serwerze (lub pod adresem, który podał ci ten, kto go postawił) i wpisz imię. Na tym przygotowanie się kończy (nie trzeba rejestracji ani numeru telefonu). W tym momencie wewnątrz urządzenia powstaje „klucz” i to on jest twoją tożsamością.
2. Przekaż swój identyfikator lub kod QR osobie, z którą chcesz rozmawiać.
3. Jeśli druga osoba też ma otwartą aplikację, łączycie się bezpośrednio i możecie rozmawiać. Jeśli nie ma otwartej aplikacji, wiadomość trafia w zaszyfrowanej postaci do „skrzynki oczekiwania” i zostaje dostarczona, gdy otworzy aplikację. Serwer, który przenosi skrzynkę oczekiwania, nie może odczytać treści. Niedostarczone listy są automatycznie usuwane najpóźniej po 7 dniach.

## Obietnice (czego nie robimy)

- **Nie wyświetlamy reklam.** Ani w aplikacji, ani nigdzie indziej.
- **Nie śledzimy.** Żadnej analizy użytkowania, mechanizmów reklamowych ani sprzedaży danych.
- **Twórca nie przechowuje danych użytkowników.** Po stronie serwera w ogóle nie ma listy kont. Tożsamością jest wyłącznie klucz wewnątrz twojego urządzenia.
- **Rozmowy są szyfrowane między urządzeniami.** Serwer ma do czynienia wyłącznie z kopertami, których nie może odczytać.

Uczciwie podajemy też zakres. Aby dostarczyć wiadomość, serwer przechowuje dane przez krótki czas (niedostarczone koperty — maksymalnie 7 dni, sygnały połączenia — 5 minut, zapisy adresów i urządzeń — 90 dni, informacje o grupach i subskrypcje powiadomień — 30 dni. Wszystko jest automatycznie usuwane, a treści nie da się odczytać). Kopia zapasowa w chmurze jest na początku wyłączona. Jeśli postawisz serwer u siebie, także to przechowywanie znajdzie się pod twoją kontrolą.

## Co potrafi

- Rozmowy jeden na jeden i rozmowy grupowe (do 1 000 osób)
- Rozmowy głosowe i wideo (rozmowy grupowe do 8 osób)
- Wysyłanie plików (w rozmowach jeden na jeden do 50 MB. W grupach też się da, ale limit rozmiaru jest mniejszy)
- Wiele urządzeń i wiele kont (np. służbowe i prywatne. Zarówno liczba urządzeń, jak i kont jest bezpłatna i nieograniczona)
- 51 języków (angielski plus 50 plików językowych), wybieranych automatycznie zgodnie z językiem twojego urządzenia
- Profil ze zdjęciem, naklejki, udostępnianie lokalizacji
- Polecenia takie jak `/help` (71 rodzajów)
- Tryby zasilania dopasowane do baterii (automatyczny / normalny / oszczędzanie energii / awaryjny). W miarę rozładowywania się baterii kontrole dostarczania są rozkładane w czasie, aby bateria wystarczała dłużej. Zabezpieczenie na wypadek katastrof i innych sytuacji, gdy nie możesz się naładować
- Czytelne ekrany (dbałość o kontrast kolorów, rozmiar tekstu i obsługę wyłącznie klawiaturą)

## Różnice względem innych komunikatorów

| | Breeze | Wiele komunikatorów |
|---|--------|--------|
| Rejestracja | Niepotrzebna (tożsamością jest klucz w urządzeniu) | Wymagany numer telefonu |
| Serwer | Nie może odczytać treści | Zakłada się zaufanie do firmy prowadzącej usługę |
| Postawienie na własnym serwerze | Zakładane (to coś, co się stawia i używa) | Niemożliwe |
| Jawność kodu | Wszystko jawne (licencja MIT) | Często zamknięte |
| Miejsce danych | W twoim urządzeniu | Na serwerach firmy prowadzącej usługę |

Szczegółowe porównanie z Signal i LINE znajduje się na [stronie porównania (po angielsku)](../COMPARISON.md). Do każdego twierdzenia Breeze dołączony jest „sposób sprawdzenia”, a punkty, w których Breeze przegrywa (liczba użytkowników, brak zewnętrznego audytu itp.), również są opisane bez ukrywania.

## Koszt postawienia na własnym serwerze

Breeze działa w bezpłatnym zakresie Cloudflare. Karta kredytowa nie jest potrzebna.

| Pozycja | Bezpłatny zakres | W przypadku płatnym |
|-----------|-----------|-------------|
| Miejsce | Cloudflare Pages (bezpłatnie) | — |
| Przetwarzanie | Do 100 tysięcy dziennie | Do 10 milionów miesięcznie |
| Przechowywanie | Odczyt do 100 tysięcy dziennie, zapis do 1 tysiąca dziennie | Odczyt 10 milionów miesięcznie, zapis 1 milion miesięcznie |
| Przekazywanie rozmów | Bezpłatnie do 20 GB | 0,05 dolara za 1 GB |
| Własna domena | Niepotrzebna (dołączony jest bezpłatny adres) | 10 dolarów rocznie |
| **Razem** | **0 dolarów miesięcznie** (przy lekkim użytkowaniu — do około 20–40 osób) | **Od 5 dolarów miesięcznie** (przy lekkim użytkowaniu — skala około 100 osób. W skali 1 000 osób od 34 do 222 dolarów miesięcznie, zależnie od użytkowania) |

Jak koszt rośnie w dużej skali oraz „dlaczego jeden operator nie musi dźwigać kosztów wszystkich” — w [rozważaniach o kosztach i trwałości (po angielsku)](../SUSTAINABILITY.md), a pierwotne obliczenia — w [modelu kosztów (po angielsku)](../COST_MODEL.md).

Instalacja zaczyna się od tego jednego polecenia (szczegóły w [poradniku instalacji](SELF_HOSTING-pl.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Szczegóły techniczne (dla programistów)

### Metody szyfrowania

| Rola | Metoda |
|-------|-----------|
| Wymiana kluczy | X25519 (zapasowa: P-256) |
| Podpis | Ed25519 (zapasowa: HMAC-SHA256) |
| Szyfrowanie | AES-256-GCM |
| Wyprowadzanie kluczy | HKDF-SHA256 |
| Odnawianie kluczy rozmowy | Double Ratchet (ta sama metoda co w Signal) |
| Klucze grupy | Sender Key |
| Ukrywanie nadawcy przed przekaźnikiem | Sealed Sender |

Wiążąca specyfikacja znajduje się w [SPEC.md](../../SPEC.md), a adres zgłaszania podatności i zasady — w [SECURITY.md](../../SECURITY.md).

### Testy i kontrole jakości

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Udział w rozwoju

Sposób pracy i zasady znajdują się w [CONTRIBUTING.md](../../CONTRIBUTING.md).
Zgłoszenia usterek — na [stronę Issue](https://github.com/shizukutanaka/Breeze/issues). Kodeks postępowania to [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [docs/COMPARISON.md](../COMPARISON.md).

## Licencja

MIT — jak podano w [LICENSE](../../LICENSE): można swobodnie używać, zmieniać i rozpowszechniać.
