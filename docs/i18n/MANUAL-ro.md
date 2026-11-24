# Manual Breeze

**Citiți în altă limbă**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · Română (această pagină) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze este un serviciu de mesagerie criptat, pentru care nu este nevoie nici de număr de telefon, nici de înregistrare.
Conținutul conversațiilor poate fi citit numai de persoana care trimite și de cea care primește. Nici măcar serverul care îl transportă pe drum nu îl poate citi.
Toate funcțiile sunt gratuite și nu există reclame.

Acest manual este un ghid pentru cei care încep să îl folosească.

---

## 1. Cum se începe

### Obținere

De pe [pagina de descărcare](https://github.com/shizukutanaka/Breeze/releases/latest), alegeți unul potrivit pentru aparatul dumneavoastră.

- Windows: cel al cărui nume se termină cu `-win-x64.exe` (există și pentru aparate ARM)
- Mac: cel al cărui nume se termină cu `-mac.dmg`
- Linux: `.AppImage` (poate fi rulat ca atare) sau `.deb`
- Pentru utilizarea în browser, folosiți copia instalată pe propriul server (modul de instalare este în foaia separată „ghidul de instalare”)

Fiecare fișier are atașată o valoare numerică de verificare (SHA256SUMS.txt). Cei care sunt îngrijorați pot verifica dacă valoarea fișierului descărcat coincide.

> **Despre pagina de probă**: Pagina de probă publicată anterior (breeze.pages.dev) este în prezent oprită (la deschidere apare 404). Până la restabilire, folosiți versiunea de aplicație. O copie instalată pe propriul server nu este afectată de această oprire.

### Configurarea inițială

1. Deschideți aplicația.
2. Introduceți-vă numele. Cu asta, pregătirea este gata. Nu este nevoie nici de înregistrare, nici de număr de telefon.

În acel moment, în interiorul dispozitivului se creează o „cheie”. Aceasta este însăși identitatea dumneavoastră.
**Lista conturilor nu se află pe server.** Identitatea există numai în interiorul dispozitivului dumneavoastră.
Acest punct devine important în capitolul despre copiile de rezervă (8).

### Despre „identitatea de unică folosință”

Dacă la creare alegeți „identitate de unică folosință”, devine o identitate pentru care nu există niciun mijloc de recuperare.
Dacă pierdeți acel dispozitiv, îl resetați sau ștergeți datele browserului, acea identitate nu se va mai întoarce niciodată.
Acest lucru este afișat și pe ecran. Nu o alegeți pentru o identitate folosită pe termen lung.

---

## 2. Conectarea cu cealaltă persoană

Există 3 modalități de a vă conecta cu persoana cu care doriți să vorbiți.

- **Transmiterea ID-ului**: Comunicați ID-ul dumneavoastră celeilalte persoane și rugați-o să îl introducă.
- **Cod QR**: Afișați codul QR de invitație și rugați cealaltă persoană să îl citească.
- **Link de invitație**: Din „Invită un prieten”, copiați mesajul de invitație și trimiteți-l prin mijlocul obișnuit de contact (e-mail etc.). Dacă cealaltă persoană deschide linkul și își introduce numele, puteți conversa imediat.

Dacă și cealaltă persoană a deschis aplicația, vă puteți conecta direct și puteți conversa.

---

## 3. Conversații

- Este suficient să introduceți mesajul și să îl trimiteți. Se pot trimite și fotografii, stickere și locația.
- **Trimiterea de fișiere**: În conversațiile individuale, până la 50 MB. În grup, este mai mică, până la aproximativ 50 KB.
- Fișierele în formate periculoase, precum fișierele executabile, sunt blocate automat.
- Dacă cealaltă persoană nu a deschis aplicația, mesajul rămâne criptat în „căsuța de păstrare” și este livrat atunci când o deschide. Serverul care transportă căsuța de păstrare nu poate citi conținutul. Scrisorile nelivrate se șterg automat după **cel mult 7 zile**.
- Istoricul conversațiilor poate fi exportat într-un fișier sau importat.

### Comenzi

Dacă introduceți `/help` în câmpul de introducere, apare lista comenzilor utilizabile (peste 60 de tipuri).
Unele operațiuni, precum setările și legarea dispozitivelor, se fac prin comenzi.

---

## 4. Grupuri

- Într-un grup pot intra până la **1.000 de persoane**.
- Modul de creare este doar introducerea unui nume de grup. Invitația se face din „linkul de invitație în grup”. Persoana care a primit linkul poate participa introducându-și numele.
- Și în grup se pot trimite fișiere, dar limita este mai mică, aproximativ 50 KB. Mesajele vocale nu pot fi trimise încă în grup.
- Dacă există membri care folosesc o versiune veche a aplicației, în acel grup nu poate fi folosit noul mod, mai sigur (grup v5), iar pe ecran apare o atenționare. Devine activ atunci când toți trec la cea mai nouă versiune.

---

## 5. Apeluri

- Se pot face apeluri vocale și apeluri video individuale. Există și apeluri de grup.
- **Codul de verificare a apelului**: Pe ecranul apelului este afișat un cod de verificare. Citiți-l împreună cu cealaltă persoană și verificați dacă coincide pe ambele ecrane. Dacă nu coincide, este posibil ca cineva să asculte pe parcurs. În acel caz, închideți apelul.
- Apelul de grup poate să nu poată fi pornit dacă aplicațiile tuturor nu sunt la cea mai nouă versiune.

---

## 6. Mai multe dispozitive și conturi

- Pentru a folosi aceeași identitate pe mai multe dispozitive, legați dispozitivele între ele cu comanda `/link`.
- Conturile pot fi create mai multe și folosite separat (de exemplu pentru serviciu și pentru uz personal). Atât numărul de dispozitive, cât și numărul de conturi sunt gratuite și nelimitate.
- Limba este selectată automat dintre 8 limbi: engleză, japoneză, coreeană, chineză (Taiwan), spaniolă, thailandeză, indoneziană, portugheză (Brazilia).

---

## 7. Setări pentru păstrarea siguranței

- **Blocare automată**: Există o setare de blocare automată la schimbarea filei.
- **Fraza de acces a cheii**: Cheia din interiorul dispozitivului poate fi protejată înfășurată într-o frază de acces. La deschiderea aplicației vi se cere introducerea ei.
- **Blocare**: Persoanele deranjante pot fi blocate. De la o persoană blocată nu mai sosesc contacte.

---

## 8. Copii de rezervă și recuperare (acesta este cel mai important capitol)

Identitatea Breeze este doar cheia din interiorul dispozitivului dumneavoastră. Pe server nu există o listă de conturi, iar creatorul nu are nici el cheia dumneavoastră.
**Dacă pierdeți dispozitivul, se pierde și identitatea.** Pentru o identitate importantă, faceți neapărat o copie de rezervă.

### Cum se face o copie de rezervă

1. Alegeți „Creează copie de rezervă”.
2. Setați o frază de acces pentru copia de rezervă (cel puțin 6 caractere).
3. Alegeți destinația salvării.
   - **Salvare într-un fișier**: Păstrați fișierul copiei de rezervă la dumneavoastră (recomandat).
   - **Salvare pe un server releu**: Poate fi folosită numai dacă operatorul acelui releu a activat-o. La releul implicit nu poate fi folosită. Există un termen de păstrare, așa că recuperați-o până la termen.

Conținutul copiei de rezervă este criptat. Serverul destinației gestionează doar textul criptat.

### Cum se recuperează

Pe un dispozitiv nou, restaurați folosind fișierul copiei de rezervă (sau copia de rezervă de pe serverul releu) și fraza de acces setată.

### Atenție

- **Dacă uitați fraza de acces, restaurarea nu este posibilă.** Nici creatorul nu o poate repara. Notați fraza de acces într-un alt loc.
- **Identitatea de unică folosință nu se întoarce nici prin copie de rezervă, nici prin recuperare.**
- Refăceți copia de rezervă atunci când se adaugă identități sau când schimbați dispozitivul.

---

## 9. Căsuța de păstrare și modul de a gândi costurile

- Scrisorile pentru momentele în care cealaltă persoană este offline sunt puse criptate în „căsuța de păstrare” a serverului releu (cel mult 7 zile).
- Releul are limite pentru prevenirea abuzurilor (cantitatea și frecvența care pot fi depuse). Când se atinge limita, în acea perioadă nu mai pot fi depuse scrisori noi, dar **scrisorile deja sosite nu dispar**. Pe ecran sunt afișate motivul și timpul de așteptare.
- Limita, dacă l-ați instalat pe propriul server, o puteți decide dumneavoastră.

Amploarea înregistrărilor care rămân pe partea serverului (toate se șterg automat și conținutul nu poate fi citit):

| Lucru | Perioada de rămânere |
|---|---|
| Scrisoare nelivrată | Cel mult 7 zile |
| Semnal de conectare | 5 minute |
| Înregistrări de adrese și dispozitive | 90 de zile |
| Informații despre grupuri și abonări la notificări | 30 de zile |

---

## 10. Cum se actualizează (versiunea pentru desktop)

1. Când există o versiune nouă, pe ecran apare o notificare.
2. Apăsând „Descarcă”, merge să ia versiunea nouă (nu o instalează automat).
3. Când descărcarea s-a terminat, apăsați „Instalează” și reporniți.

Dacă pe parcursul actualizării apare o eroare (de exemplu valoarea de verificare nu coincide), **actualizarea se oprește și motivul este afișat pe ecran**. Revenirea la o versiune mai veche nu este posibilă.

---

## 11. Când aveți probleme

| Simptom | Ce să verificați |
|---|---|
| Mesajul nu poate fi trimis | Verificați dacă ora dispozitivului nu este decalată. Dacă ora este decalată, trimiterea eșuează. |
| Nu ajunge la cealaltă persoană | Până când cealaltă persoană deschide aplicația, așteaptă în căsuța de păstrare (cel mult 7 zile). |
| Fișierul nu poate fi trimis | Verificați dacă nu ați depășit limita de dimensiune (individual 50 MB, grup aproximativ 50 KB) și dacă nu a fost blocat ca format periculos. |
| Codul de verificare a apelului nu coincide | Închideți apelul și apelați din nou. Nu continuați fără coincidență. |
| Ați uitat fraza de acces | Restaurarea nu este posibilă. Creați o identitate nouă și anunțați din nou cealaltă persoană. |
| Ați pierdut dispozitivul | Dacă există o copie de rezervă, puteți recupera pe un dispozitiv nou. Dacă nu, va fi o identitate nouă. |
| Pagina de probă nu se deschide (404) | În prezent este oprită. Folosiți versiunea de aplicație. |

Raportările de probleme se fac, vă rugăm, pe [pagina Issues](https://github.com/shizukutanaka/Breeze/issues).

---

## 12. Promisiunile Breeze

- Nu afișăm reclame. Nici în aplicație, nici altundeva.
- Nu urmărim. Nu există analiză a utilizării, mecanisme de publicitate și nici vânzare de date.
- Creatorul nu deține datele utilizatorilor. Pe partea serverului nu există deloc o listă de conturi.
- Conversațiile sunt criptate între dispozitive. Serverul gestionează doar plicuri care nu pot fi citite.

Comparația detaliată cu alte servicii de mesagerie este scrisă pe „pagina de comparație” a depozitului, incluzând și punctele în care Breeze pierde (numărul de utilizatori, faptul că nu a trecut printr-un audit extern etc.).

---

*Acest manual prezintă conținutul de la momentul Breeze v3.8.0.*
