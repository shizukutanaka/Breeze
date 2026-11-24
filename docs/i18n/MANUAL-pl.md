# Instrukcja obsługi Breeze

**Czytaj w innym języku**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · Polski (ta strona) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze to szyfrowany komunikator, który nie wymaga numeru telefonu ani rejestracji.
Treść rozmów mogą odczytać tylko nadawca i odbiorca. Nawet serwer, który je przenosi, nie może ich odczytać.
Wszystkie funkcje są bezpłatne i nie ma reklam.

Niniejsza instrukcja to przewodnik dla osób zaczynających.

---

## 1. Jak zacząć

### Pobieranie

Wybierz ze [strony pobierania](https://github.com/shizukutanaka/Breeze/releases/latest) plik pasujący do twojej maszyny.

- Windows: ten, którego nazwa kończy się na `-win-x64.exe` (są też wersje dla maszyn ARM)
- Mac: ten, którego nazwa kończy się na `-mac.dmg`
- Linux: `.AppImage` (można uruchomić bez zmian) albo `.deb`
- Do używania w przeglądarce służy wersja postawiona na własnym serwerze (procedura instalacji jest w osobnym dokumencie „Poradnik instalacji”)

Każdy plik ma dołączone wartości kontrolne (SHA256SUMS.txt). Osoby, które chcą, mogą sprawdzić, czy wartości pobranego pliku się zgadzają.

> **O stronie próbnej**: opublikowana strona próbna (breeze.pages.dev) jest obecnie zatrzymana (po otwarciu pojawia się 404). Do czasu jej przywrócenia prosimy korzystać z wersji aplikacyjnej. Wersji postawionej na własnym serwerze to zatrzymanie nie dotyczy.

### Pierwsza konfiguracja

1. Otwórz aplikację.
2. Wpisz imię. Na tym przygotowanie się kończy. Nie trzeba rejestracji ani numeru telefonu.

W tym momencie wewnątrz urządzenia powstaje „klucz”. To on jest samą twoją tożsamością.
**Listy kont po stronie serwera nie ma.** Twoja tożsamość znajduje się wyłącznie wewnątrz twojego urządzenia.
Ten punkt staje się ważny w rozdziale o kopii zapasowej (8).

### O „tożsamości jednorazowej”

Jeśli przy tworzeniu wybierzesz „tożsamość jednorazową”, powstanie tożsamość, która nie ma żadnych środków odzyskiwania.
Jeśli stracisz to urządzenie, zresetujesz je albo usuniesz dane przeglądarki, ta tożsamość nigdy nie wróci.
Jest to również wyświetlane na ekranie. Nie wybieraj jej dla tożsamości, której chcesz używać przez długi czas.

---

## 2. Łączenie się z drugą osobą

Są 3 sposoby połączenia się z osobą, z którą chcesz rozmawiać.

- **Przekazanie identyfikatora**: podaj drugiej osobie swój identyfikator i poproś, aby go wpisała.
- **Kod QR**: wyświetl kod QR zaproszenia i poproś drugą osobę, aby go odczytała.
- **Link zaproszenia**: w sekcji „Zaproś znajomych” skopiuj wiadomość zaproszenia i wyślij ją zwykłym kanałem kontaktu (np. pocztą). Gdy druga osoba otworzy link i wpisze imię, od razu możecie rozmawiać.

Jeśli druga osoba też ma otwartą aplikację, łączycie się bezpośrednio i możecie rozmawiać.

---

## 3. Rozmowy

- Wystarczy wpisać wiadomość i wysłać. Można wysyłać także zdjęcia, naklejki i lokalizację.
- **Wysyłanie plików**: w rozmowach jeden na jeden do 50 MB. W grupach limit jest mniejszy, około 50 KB.
- Pliki w niebezpiecznych formatach, np. wykonywalne, są automatycznie blokowane.
- Jeśli druga osoba nie ma otwartej aplikacji, wiadomość trafia w zaszyfrowanej postaci do „skrzynki oczekiwania” i zostaje dostarczona, gdy otworzy aplikację. Serwer, który przenosi skrzynkę oczekiwania, nie może odczytać treści. Niedostarczone listy są automatycznie usuwane **najpóźniej po 7 dniach**.
- Historię rozmów można eksportować do pliku i importować z pliku.

### Polecenia

Wpisz `/help` w polu wprowadzania, a pojawi się lista dostępnych poleceń (ponad 60 rodzajów).
Niektóre operacje, takie jak ustawienia czy łączenie urządzeń, wykonuje się poleceniami.

---

## 4. Grupy

- Grupy mogą liczyć do **1 000 osób**.
- Tworzenie jest proste: wystarczy wpisać nazwę grupy. Zaproszenie odbywa się przez „link zaproszenia do grupy”. Osoba, która otrzyma link, może dołączyć, wpisując imię.
- W grupach też można wysyłać pliki, ale limit jest mniejszy, około 50 KB. Wiadomości głosowych w grupach jeszcze nie można wysyłać.
- Jeśli wśród członków są osoby używające starej wersji aplikacji, w tej grupie nie będzie można użyć nowego, bezpieczniejszego sposobu (grupy v5) i na ekranie pojawi się ostrzeżenie. Zostanie on włączony, gdy wszyscy przejdą na najnowszą wersję.

---

## 5. Rozmowy (połączenia)

- Możliwe są połączenia głosowe i wideo jeden na jeden. Są też połączenia grupowe.
- **Kod potwierdzający połączenie**: na ekranie połączenia wyświetla się kod potwierdzający. Przeczytajcie go sobie nawzajem i sprawdźcie, czy zgadza się na obu ekranach. Jeśli się nie zgadza, możliwe, że ktoś podsłuchuje po drodze. W takim przypadku zakończ połączenie.
- Połączenia grupowe mogą się nie rozpocząć, jeśli aplikacje wszystkich uczestników nie są w najnowszej wersji.

---

## 6. Wiele urządzeń i kont

- Aby używać tej samej tożsamości na wielu urządzeniach, połącz urządzenia poleceniem `/link`.
- Kont można utworzyć kilka i używać ich oddzielnie (np. służbowe i prywatne). Zarówno liczba urządzeń, jak i kont jest bezpłatna i nieograniczona.
- Język jest wybierany automatycznie spośród 8: angielski, japoński, koreański, chiński (Tajwan), hiszpański, tajski, indonezyjski i portugalski (Brazylia).

---

## 7. Ustawienia dla zachowania bezpieczeństwa

- **Automatyczna blokada**: istnieje ustawienie automatycznego blokowania przy przełączaniu kart.
- **Hasło klucza**: klucz wewnątrz urządzenia można chronić hasłem (frazą). Przy otwieraniu aplikacji wymagane będzie jego podanie.
- **Blokowanie**: uciążliwe osoby można blokować. Wiadomości od zablokowanych osób nie docierają.

---

## 8. Kopia zapasowa i odzyskiwanie (najważniejszy rozdział)

Tożsamością w Breeze jest wyłącznie klucz wewnątrz twojego urządzenia. Listy kont na serwerze nie ma, a twórca również nie ma twojego klucza.
**Jeśli stracisz urządzenie, stracisz też tożsamość.** Dla ważnych tożsamości zawsze twórz kopię zapasową.

### Jak utworzyć kopię zapasową

1. Wybierz „Utwórz kopię zapasową”.
2. Ustaw hasło kopii zapasowej (co najmniej 6 znaków).
3. Wybierz miejsce zapisu.
   - **Zapis do pliku**: przechowuj plik kopii zapasowej u siebie (zalecane).
   - **Zapis na serwerze przekazującym**: można użyć tylko wtedy, gdy operator tego przekaźnika włączył taką możliwość. Na domyślnym przekaźniku nie można z tego skorzystać. Obowiązuje okres przechowywania, więc odzyskaj kopię przed jego upływem.

Zawartość kopii zapasowej jest zaszyfrowana. Serwer, na którym jest przechowywana, ma do czynienia wyłącznie z tekstem zaszyfrowanym.

### Jak odzyskać

Na nowym urządzeniu przywróć z pliku kopii zapasowej (lub kopii na serwerze przekazującym), używając ustawionego hasła.

### Uwaga

- **Jeśli zapomnisz hasła, odzyskanie nie będzie możliwe.** Twórca też nie może tego naprawić. Zapisz hasło w innym miejscu.
- **Tożsamości jednorazowe nie wracają ani przez kopię zapasową, ani przez odzyskiwanie.**
- Twórz kopię zapasową od nowa, gdy dodajesz tożsamości albo zmieniasz urządzenie.

---

## 9. Skrzynka oczekiwania i podejście do kosztów

- Listy na czas, gdy druga osoba jest offline, są odkładane w zaszyfrowanej postaci do „skrzynki oczekiwania” serwera przekazującego (maksymalnie 7 dni).
- Przekaźnik ma limity zapobiegające nadużyciom (ilość i częstotliwość odkładania). Po osiągnięciu limitu przez dany okres nie będzie można odkładać nowych listów, ale **już dostarczone listy nigdy nie znikną**. Na ekranie wyświetlany jest powód i czas oczekiwania.
- Limity w przypadku postawienia na własnym serwerze możesz określić sam.

Zakres zapisów pozostających po stronie serwera (wszystkie są automatycznie usuwane, a treści nie da się odczytać):

| Co | Okres przechowywania |
|---|---|
| Niedostarczone listy | Maksymalnie 7 dni |
| Sygnały połączenia | 5 minut |
| Zapisy adresów i urządzeń | 90 dni |
| Informacje o grupach i subskrypcje powiadomień | 30 dni |

---

## 10. Jak aktualizować (wersja na komputery)

1. Gdy pojawi się nowa wersja, na ekranie wyświetla się powiadomienie.
2. Po naciśnięciu „Pobierz” aplikacja pobiera nową wersję (nie instaluje automatycznie).
3. Po zakończeniu pobierania naciśnij „Zainstaluj” i uruchom ponownie.

Jeśli podczas aktualizacji coś się nie powiedzie (np. wartości kontrolne się nie zgadzają), **aktualizacja zostaje zatrzymana, a na ekranie wyświetla się powód**. Powrót do starej wersji nie jest możliwy.

---

## 11. Gdy coś nie działa

| Objaw | Co sprawdzić |
|---|---|
| Nie można wysłać wiadomości | Sprawdź, czy czas na urządzeniu nie jest przesunięty. Jeśli czas jest przesunięty, wysyłka się nie powiedzie. |
| Nie dociera do drugiej osoby | Dopóki druga osoba nie otworzy aplikacji, wiadomość czeka w skrzynce oczekiwania (maksymalnie 7 dni). |
| Nie można wysłać pliku | Sprawdź, czy nie przekroczono limitu rozmiaru (50 MB jeden na jeden, około 50 KB w grupach) i czy plik nie został zablokowany jako niebezpieczny format. |
| Kod potwierdzający połączenie się nie zgadza | Zakończ połączenie i zadzwoń ponownie. Nie kontynuuj przy niezgodności. |
| Zapomniano hasła | Odzyskanie nie jest możliwe. Utwórz nową tożsamość i poinformuj o niej rozmówców od nowa. |
| Zgubiono urządzenie | Jeśli masz kopię zapasową, możesz odzyskać na nowym urządzeniu. Jeśli nie, będzie to nowa tożsamość. |
| Strona próbna się nie otwiera (404) | Obecnie jest zatrzymana. Korzystaj z wersji aplikacyjnej. |

Zgłoszenia usterek prosimy kierować na [stronę Issue](https://github.com/shizukutanaka/Breeze/issues).

---

## 12. Obietnice Breeze

- Nie wyświetlamy reklam. Ani w aplikacji, ani nigdzie indziej.
- Nie śledzimy. Żadnej analizy użytkowania, mechanizmów reklamowych ani sprzedaży danych.
- Twórca nie przechowuje danych użytkowników. Po stronie serwera w ogóle nie ma listy kont.
- Rozmowy są szyfrowane między urządzeniami. Serwer ma do czynienia wyłącznie z kopertami, których nie może odczytać.

Szczegółowe porównanie z innymi komunikatorami jest opisane na „stronie porównania” w repozytorium, wraz z punktami, w których Breeze przegrywa (liczba użytkowników, brak zewnętrznego audytu itp.).

---

*Niniejsza instrukcja odzwierciedla stan na czas Breeze v3.8.0.*
