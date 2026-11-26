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
- Do używania w przeglądarce służy wersja postawiona na własnym serwerze (procedura instalacji jest w osobnym dokumencie „Poradnik instalacji”). Standardowa instalacja korzysta z Cloudflare, więc wymagane jest konto Cloudflare

Każdy plik ma dołączone wartości kontrolne (SHA256SUMS.txt). Osoby, które chcą, mogą sprawdzić, czy wartości pobranego pliku się zgadzają.

### Pierwsza konfiguracja

1. Otwórz aplikację.
2. Naciśnij „Zacznij od losowego ID”. Na tym przygotowanie się kończy. Nie trzeba rejestracji ani numeru telefonu.

- Jeśli w polu nad przyciskiem wpiszesz „Twoje imię (nazwa wyświetlana)”, zaczniesz z tym imieniem. Możesz też nacisnąć przycisk przy pustym polu. Nazwę wyświetlaną możesz zmienić później, w sekcji profilu w ustawieniach.
- Istnieje też sposób utworzenia tożsamości z imieniem i identyfikatorem Breeze, które wybierasz sam. W takim przypadku wydawana jest fraza odzyskiwania, pokazywana na ekranie. Fraza odzyskiwania to słowa, które pozwalają przywrócić tę tożsamość na innym urządzeniu. Zapisz ją na papierze lub w bezpiecznym miejscu.
- Jeśli chcesz przywrócić tożsamość utworzoną wcześniej, otwórz „Przywróć istniejące konto”, a pojawią się sposoby odzyskiwania (przywróć z pliku kopii zapasowej, odzyskaj za pomocą frazy odzyskiwania, przywróć przez konto + hasło).
- Po zakończeniu tworzenia pojawia się karta zachęcająca do ochrony klucza hasłem (nie znika po pewnym czasie). W przypadku ważnej tożsamości postępuj zgodnie ze wskazówkami i dodaj ochronę.

W tym momencie wewnątrz urządzenia powstaje „klucz”. To on jest samą twoją tożsamością.
**Listy kont po stronie serwera nie ma.** Twoja tożsamość znajduje się wyłącznie wewnątrz twojego urządzenia.
Ten punkt staje się ważny w rozdziale o kopii zapasowej (9).

### O dawnej „tożsamości jednorazowej”

„Tożsamości jednorazowej” — tożsamości, która nie ma żadnych środków odzyskiwania — już nie ma. Przy obecnych sposobach tworzenia tożsamości każdą tożsamość można chronić kopią zapasową.

---

## 2. Łączenie się z drugą osobą

Naciśnij przycisk „Dodaj znajomego” na ekranie kontaktów, a pojawią się trzy opcje.

- **Dodaj kontakt**: wpisz identyfikator drugiej osoby lub zeskanuj kod QR.
- **Zaproś znajomego**: skopiuj link zaproszenia i wyślij go zwykłym kanałem kontaktu (np. pocztą). Gdy druga osoba otworzy link i wpisze imię, od razu możecie rozmawiać.
- **Utwórz grupę**: wystarczy wpisać nazwę grupy, aby ją utworzyć (rozdział 4).

Twój własny identyfikator jest wyświetlany w pełnej postaci, gdy otworzysz swój profil, i możesz go skopiować w takiej formie. Przekazuj pełny identyfikator, a nie tylko krótki.

Jeśli druga osoba też ma otwartą aplikację, łączycie się bezpośrednio i możecie rozmawiać.

---

## 3. Rozmowy

- Wystarczy wpisać wiadomość i wysłać. Można wysyłać także zdjęcia, naklejki i lokalizację.
- Otwórz „+” obok pola wprowadzania, a razem pojawią się załączniki plików, wiadomości głosowe, wprowadzanie głosowe, lokalizacja, naklejki, ustawienie „odpowiedź niepotrzebna” i wiele więcej.
- **Wysyłanie plików**: w rozmowach jeden na jeden do 50 MB. W grupach limit jest mniejszy, około 50 KB.
- Pliki w niebezpiecznych formatach, np. wykonywalne, są automatycznie blokowane.
- Jeśli druga osoba nie ma otwartej aplikacji, wiadomość trafia w zaszyfrowanej postaci do „skrzynki oczekiwania” i zostaje dostarczona, gdy otworzy aplikację. Serwer, który przenosi skrzynkę oczekiwania, nie może odczytać treści. Niedostarczone listy są automatycznie usuwane **najpóźniej po 7 dniach**.
- Historię rozmów można eksportować do pliku i importować z pliku.

### Czytanie ekranu

- **Status wysyłania**: widać go po znaku obok wiadomości. ✓ oznacza wysłano, ✓ w kółku oznacza, że wiadomość została złożona w skrzynce oczekiwania, ✓✓ oznacza, że dotarła do drugiej osoby, odczytanie to niebieski znak, a niepowodzenie to czerwony znak. Różnią się kształtem, a nie tylko kolorem.
- **Lista kontaktów**: czas ostatniej rozmowy jest pokazywany jako czas dla dziś, „Wczoraj” dla wczoraj, miesiąc/dzień dla tego roku oraz rok/miesiąc/dzień dla wcześniejszych. Kontakty z nieprzeczytanymi wiadomościami mają wyróżnione imię i czas.
- **Imiona dla kontaktów**: otwórz „Informacje o kontakcie” (w menu prawego przycisku myszy kontaktu albo w menu „⋮” rozmowy), a będziesz mógł ustawić własne imię dla tego kontaktu (pseudonim). Pseudonimy są przechowywane wyłącznie na tym urządzeniu i nigdy nie są wysyłane ani do kontaktu, ani do serwera przekazującego. Gdy ustawisz pseudonim, obok niego przygaszonym kolorem pokazywane jest też imię, które kontakt ustawił dla siebie. To drugie imię możesz wyłączyć za pomocą „Pokazuj też imię, które każdy kontakt ustawił dla siebie” w sekcji „Prywatność” w ustawieniach.
- **Twoja karta**: na górze listy znajduje się karta twojego profilu; naciśnij ją, aby otworzyć profil. Przewija się razem z listą.
- **Dolne karty w telefonie**: Przy szerokości telefonu na dole ekranu pojawia się pięć kart: „Czaty”, „Połączenia”, „Kontakty”, „Moja karta” i „Ustawienia”. To, które karty są pokazywane, można wybrać pojedynczo w sekcji „Dolne karty” w ustawieniach (karta Czaty jest pokazywana zawsze. Nawet jeśli ukryjesz kartę Ustawienia, ustawienia nadal można otworzyć przyciskiem z kołem zębatym na ekranie).
- **Nagłówek rozmowy**: za pomocą ikony wyszukiwania możesz szukać w obrębie rozmowy. Z menu „⋮” możesz sprawdzić numer bezpieczeństwa, wyciszyć powiadomienia, przypiąć, utworzyć ankietę i wiele więcej.

### Polecenia

Wpisz `/` w polu wprowadzania, a pojawią się podpowiedzi poleceń. Wpisz `/help`, aby zobaczyć listę dostępnych poleceń (71 rodzajów).
Niektóre operacje, takie jak ustawienia czy łączenie urządzeń, wykonuje się poleceniami.

---

## 4. Grupy

- Grupy mogą liczyć do **1 000 osób**.
- Aby utworzyć grupę, wystarczy wpisać jej nazwę w opcji „Utwórz grupę” w sekcji „Dodaj znajomego” (można też utworzyć ją poleceniem `/newgroup`). Zaproszenie odbywa się przez „link zaproszenia do grupy”. Osoba, która otrzyma link, może dołączyć, wpisując imię.
- W grupach też można wysyłać pliki, ale limit jest mniejszy, około 50 KB. Wiadomości głosowych w grupach jeszcze nie można wysyłać.
- Jeśli wśród członków są osoby używające starej wersji aplikacji, w tej grupie nie będzie można użyć nowego, bezpieczniejszego sposobu (grupy v5) i na ekranie pojawi się ostrzeżenie. Zostanie on włączony, gdy wszyscy przejdą na najnowszą wersję.

---

## 5. Rozmowy (połączenia)

- Możliwe są połączenia głosowe i wideo jeden na jeden. Są też połączenia grupowe (do 8 osób).
- **Kod potwierdzający połączenie**: na ekranie połączenia wyświetla się kod potwierdzający. Przeczytajcie go sobie nawzajem i sprawdźcie, czy zgadza się na obu ekranach. Jeśli się nie zgadza, możliwe, że ktoś podsłuchuje po drodze. W takim przypadku zakończ połączenie.
- Połączenia grupowe mogą się nie rozpocząć, jeśli aplikacje wszystkich uczestników nie są w najnowszej wersji.
- **Historia połączeń**: Połączenia indywidualne zostawiają historię tylko na tym urządzeniu (druga osoba, czy było wychodzące / przychodzące / nieodebrane, godzina i czas trwania połączenia. Nic z tego, co powiedziano, nie jest zapisywane). Historia nigdy nie jest wysyłana na serwer ani do drugiej osoby. Przechowywanych jest do 200 wpisów, a najstarsze są usuwane w pierwszej kolejności. Połączenia grupowe nie pojawiają się w historii.
- Otwórz historię w telefonie z karty „Połączenia”. Gdy jest nieodebrane połączenie, którego jeszcze nie widziałeś, na karcie Połączenia pojawia się plakietka z liczbą, która znika po otwarciu historii. Z wiersza historii możesz otworzyć rozmowę z tą osobą lub oddzwonić. Całą historię możesz usunąć przyciskiem na ekranie.
- **Historia połączeń nie jest częścią kopii zapasowej.** Na nowym urządzeniu historia zaczyna się pusta. Jeśli nie chcesz, aby historia była przechowywana, wyłącz „Przechowuj historię połączeń na tym urządzeniu” w sekcji „Prywatność” w ustawieniach, a samo zapisywanie się zatrzyma.

---

## 6. Wiele urządzeń i kont

- Aby używać tej samej tożsamości na wielu urządzeniach, połącz urządzenia poleceniem `/link`.
- Kont można utworzyć kilka i używać ich oddzielnie (np. służbowe i prywatne). Zarówno liczba urządzeń, jak i kont jest bezpłatna i nieograniczona.
- **Jak utworzyć konto**: naciśnij przycisk „+” obok kart kont na samym górze listy kontaktów. Wpisz imię i wybierz emoji ikony, a nowe konto zostanie utworzone i automatycznie wybrane.
- **Przełączanie kont**: karty kont są zawsze wyświetlane na samym górze listy kontaktów. Naciśnij kartę, aby się przełączyć (na komputerze możesz też przełączać się za pomocą Ctrl+1–9). Naciśnij i przytrzymaj kartę, aby zmienić jej nazwę, ikonę lub ją usunąć.
- Kontakty i klucze są oddzielne dla każdego konta. Dla każdego konta wymieniaj kontakty od nowa.
- Język jest wybierany automatycznie spośród 51 języków, w tym angielskiego, zgodnie z językiem twojego urządzenia.

---

## 7. Ustawienia dla zachowania bezpieczeństwa

Ustawienia otwierają się jako osobny ekran. W telefonie otwórz je z karty „Ustawienia” na dole ekranu; na komputerze za pomocą przycisku z kołem zębatym na ekranie (możesz je też otworzyć poleceniem `/settings`). Użyj działania wstecz, aby wrócić do poprzedniego ekranu.

- **Automatyczna blokada**: istnieje ustawienie automatycznego blokowania przy przełączaniu kart.
- **Hasło klucza**: klucz wewnątrz urządzenia można chronić hasłem (frazą). Przy otwieraniu aplikacji wymagane będzie jego podanie.
- **Pokazuj też imię, które każdy kontakt ustawił dla siebie**: w sekcji „Prywatność”. Dla kontaktu, któremu nadałeś pseudonim, możesz wybrać, czy jego własne imię ma być pokazywane obok (rozdział 3).
- **Blokowanie**: uciążliwe osoby można blokować. Wiadomości od zablokowanych osób nie docierają.
- **Czy przechowywać historię połączeń**: Za pomocą opcji „Przechowuj historię połączeń na tym urządzeniu” w sekcji „Prywatność” możesz zatrzymać zapisywanie historii połączeń (rozdział 5).
- **Widoczność dolnych kart**: W sekcji „Dolne karty” możesz pojedynczo pokazywać lub ukrywać dolne karty telefonu (Połączenia / Kontakty / Moja karta / Ustawienia). Karta Czaty jest pokazywana zawsze.

---

## 8. Bateria i sytuacje awaryjne (tryby zasilania)

W ustawieniu „Tryb zasilania” możesz wybrać, jak używana jest bateria.

- **Automatyczny (poziom baterii)**: przełącza się automatycznie w zależności od pozostałego poziomu baterii.
- **Normalny**: jak zwykle.
- **Oszczędzanie energii**: kontrole dostarczania są rozłożone co najwyżej raz na 60 sekund, a sygnał obecności jest zatrzymywany.
- **Awaryjny (na wypadek katastrof)**: kontrole dostarczania są rozłożone co najwyżej raz na 10 minut. Używaj podczas katastrofy lub w innym czasie, gdy nie możesz się naładować.

Baterię zużywa nie ilość komunikacji, lecz liczba wybudzeń radia. Dlatego strona wysyłająca nie jest rozkładana w czasie; tylko strona słuchająca. Wysyłanie nadal odbywa się od razu, jak zawsze. Gdy rozpoczniesz ładowanie, tryb automatycznie przesuwa się o jeden krok w lżejszą stronę.

Na urządzeniach, które nie mogą automatycznie odczytać poziomu baterii (np. przeglądarka na iPhonie), „Automatyczny” zachowuje się jak Normalny, a ręczny wybór działa tak, jak wybrano.

---

## 9. Kopia zapasowa i odzyskiwanie (najważniejszy rozdział)

Tożsamością w Breeze jest wyłącznie klucz wewnątrz twojego urządzenia. Listy kont na serwerze nie ma, a twórca również nie ma twojego klucza.
**Jeśli stracisz urządzenie, stracisz też tożsamość.** Dla ważnych tożsamości zawsze twórz kopię zapasową.

Kopię zapasową i odzyskiwanie wykonuje się w sekcji „Kopia zapasowa i przywracanie” w ustawieniach (przyciski to „Utwórz kopię zapasową”, „Przywróć kopię zapasową” i „📂 Przywróć z pliku”). Gdy po raz pierwszy dodasz kontakt, tylko raz pojawi się karta zachęcająca do utworzenia kopii zapasowej.

### Automatyczna kopia zapasowa

Ustawienie „Automatyczna kopia zapasowa” jest włączone od początku. Gdy twoje dane się zmieniają, zaszyfrowana kopia zapasowa jest automatycznie wysyłana na serwer przekazujący, który sam hostujesz.

- Nie wysyła przy każdej zmianie: czeka 30 sekund po ostatniej zmianie i wysyła wszystko razem. Próby są rozłożone co najmniej co 15 minut.
- Gdy jesteś offline, nic nie jest wysyłane; zmiany są wstrzymywane i wysyłane, gdy połączenie wróci i gdy otworzysz aplikację.
- Aby wysyłanie automatyczne działało, musisz raz wpisać hasło kopii zapasowej na tym urządzeniu (gdy jest to potrzebne, w sekcji ustawień pojawia się przycisk „Wpisz hasło”). **Hasło nie jest przechowywane.** Jest pamiętane tylko, gdy aplikacja jest otwarta, i znika, gdy ją zamkniesz. W przypadku tożsamości z prostym odzyskiwaniem, zaraz po wpisaniu hasła przy rejestracji lub aktualizacji, wysyłanie działa bez zmian.
- Jeśli serwer przekazujący nie obsługuje przechowywania kopii zapasowych, automatyczna kopia zapasowa nie działa. Jest to pokazywane w sekcji ustawień.
- Stan (kiedy było ostatnie udane wysłanie, czy zmiany czekają, czy wysłanie się nie powiodło) jest pokazywany w sekcji ustawień.

### Jak utworzyć kopię zapasową (ręcznie)

1. W sekcji „Kopia zapasowa i przywracanie” w ustawieniach wybierz „Utwórz kopię zapasową”.
2. Ustaw hasło kopii zapasowej (co najmniej 6 znaków).
3. Wybierz miejsce zapisu.
   - **Zapis do pliku**: przechowuj plik kopii zapasowej u siebie (zalecane).
   - **Zapis na serwerze przekazującym**: można użyć tylko wtedy, gdy operator tego przekaźnika włączył taką możliwość. Na domyślnym przekaźniku nie można z tego skorzystać. Obowiązuje okres przechowywania, więc odzyskaj kopię przed jego upływem.

Zawartość kopii zapasowej jest zaszyfrowana. Serwer, na którym jest przechowywana, ma do czynienia wyłącznie z tekstem zaszyfrowanym.

### Jak odzyskać

Na nowym urządzeniu przywróć z pliku kopii zapasowej (lub kopii na serwerze przekazującym), używając ustawionego hasła.

Jeśli właśnie przywróciłeś swoją tożsamość za pomocą frazy odzyskiwania, a kopia zapasowa tej tożsamości znajduje się na serwerze przekazującym, jest ona znajdowana automatycznie i pada pytanie „Znaleziono kopię zapasową”. Jeśli ją przywrócisz, dane na tym urządzeniu zostaną zastąpione zawartością kopii zapasowej.

### Przejście na nowe urządzenie

Naciśnij przycisk „Przejdź na nowe urządzenie” w sekcji „Kopia zapasowa i przywracanie” w ustawieniach, a kroki zostaną pokazane.

1. Na obecnym urządzeniu trzymaj kopię zapasową na serwerze przekazującym (automatyczna kopia zapasowa albo „Utwórz kopię zapasową”).
2. Na nowym urządzeniu wybierz sposób przywracania na pierwszym ekranie i wpisz frazę odzyskiwania (albo nazwę konta i hasło).
3. Gdy twoja tożsamość wróci, kopia zapasowa na serwerze jest znajdowana automatycznie i proponowane jest przywrócenie.

Nie są potrzebne żadne kable ani przekazywanie plików.

### Uwaga

- **Jeśli zapomnisz hasła, odzyskanie nie będzie możliwe.** Twórca też nie może tego naprawić. Zapisz hasło w innym miejscu.
- Wpisanie hasła do automatycznej kopii zapasowej jest potrzebne na każdym urządzeniu. Na nowym urządzeniu wpisz je jeszcze raz.
- Twórz ręczną kopię zapasową od nowa, gdy dodajesz tożsamości albo zmieniasz urządzenie.
- Historia połączeń nie jest częścią kopii zapasowej. Gdy zmieniasz urządzenie, historia połączeń nie przenosi się na nowe urządzenie.

---

## 10. Skrzynka oczekiwania i podejście do kosztów

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

## 11. Jak aktualizować (wersja na komputery)

1. Gdy pojawi się nowa wersja, na ekranie wyświetla się powiadomienie.
2. Po naciśnięciu „Pobierz” aplikacja pobiera nową wersję (nie instaluje automatycznie).
3. Po zakończeniu pobierania naciśnij „Zainstaluj” i uruchom ponownie.

Jeśli podczas aktualizacji coś się nie powiedzie (np. wartości kontrolne się nie zgadzają), **aktualizacja zostaje zatrzymana, a na ekranie wyświetla się powód**. Powrót do starej wersji nie jest możliwy.

---

## 12. Gdy coś nie działa

| Objaw | Co sprawdzić |
|---|---|
| Nie można wysłać wiadomości | Sprawdź, czy czas na urządzeniu nie jest przesunięty. Jeśli czas jest przesunięty, wysyłka się nie powiedzie. |
| Nie dociera do drugiej osoby | Dopóki druga osoba nie otworzy aplikacji, wiadomość czeka w skrzynce oczekiwania (maksymalnie 7 dni). |
| Nie można wysłać pliku | Sprawdź, czy nie przekroczono limitu rozmiaru (50 MB jeden na jeden, około 50 KB w grupach) i czy plik nie został zablokowany jako niebezpieczny format. |
| Kod potwierdzający połączenie się nie zgadza | Zakończ połączenie i zadzwoń ponownie. Nie kontynuuj przy niezgodności. |
| Zapomniano hasła | Odzyskanie nie jest możliwe. Utwórz nową tożsamość i poinformuj o niej rozmówców od nowa. |
| Zgubiono urządzenie | Jeśli masz kopię zapasową, możesz odzyskać na nowym urządzeniu. Jeśli nie, będzie to nowa tożsamość. |

Zgłoszenia usterek prosimy kierować na [stronę Issue](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Obietnice Breeze

- Nie wyświetlamy reklam. Ani w aplikacji, ani nigdzie indziej.
- Nie śledzimy. Żadnej analizy użytkowania, mechanizmów reklamowych ani sprzedaży danych.
- Twórca nie przechowuje danych użytkowników. Po stronie serwera w ogóle nie ma listy kont.
- Rozmowy są szyfrowane między urządzeniami. Serwer ma do czynienia wyłącznie z kopertami, których nie może odczytać.

Szczegółowe porównanie z innymi komunikatorami jest opisane na „stronie porównania” w repozytorium, wraz z punktami, w których Breeze przegrywa (liczba użytkowników, brak zewnętrznego audytu itp.).

---

*Niniejsza instrukcja odzwierciedla stan Breeze na dzień 2026-11-25.*
