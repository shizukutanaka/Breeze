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
- Pentru utilizarea în browser, folosiți copia instalată pe propriul server (modul de instalare este în foaia separată „ghidul de instalare”). Instalarea standard folosește Cloudflare, așa că este necesar un cont Cloudflare

Fiecare fișier are atașată o valoare numerică de verificare (SHA256SUMS.txt). Cei care sunt îngrijorați pot verifica dacă valoarea fișierului descărcat coincide.

> **Despre pagina de probă**: O probă pentru verificarea modului de funcționare (https://breeze-469.pages.dev/) este pusă la dispoziție. Ceea ce se află acolo este același software, dar proba se poate schimba sau opri fără notificare. Pentru utilizarea reală, folosiți o copie instalată pe propriul server. O copie de pe propriul server nu este afectată dacă proba se oprește.

### Configurarea inițială

1. Deschideți aplicația.
2. Apăsați „Începe cu un ID aleatoriu”. Cu asta, pregătirea este gata. Nu este nevoie nici de înregistrare, nici de număr de telefon.

- Dacă introduceți „Numele dumneavoastră (nume afișat)” în câmpul de deasupra butonului, începeți cu acel nume. Puteți apăsa butonul și cu câmpul gol. Numele afișat poate fi schimbat ulterior, în secțiunea de profil a setărilor.
- Există și o modalitate de a crea o identitate cu un nume și un ID Breeze alese de dumneavoastră. În acest caz, este emisă o frază de recuperare, afișată pe ecran. Fraza de recuperare este formată din cuvintele care vă permit să readuceți acea identitate pe un alt dispozitiv. Notați-o pe hârtie sau într-un loc sigur.
- Dacă doriți să readuceți o identitate creată anterior, deschideți „Restaurează un cont existent” și apar metodele de recuperare (restaurare dintr-un fișier de rezervă, recuperare cu o frază de recuperare, restaurare cu cont + frază secretă).
- Când crearea se termină, apare un card care vă îndrumă să vă protejați cheia cu o frază de acces (nu dispare după un timp). Pentru o identitate importantă, urmați îndrumarea și adăugați protecția.

În acel moment, în interiorul dispozitivului se creează o „cheie”. Aceasta este însăși identitatea dumneavoastră.
**Lista conturilor nu se află pe server.** Identitatea există numai în interiorul dispozitivului dumneavoastră.
Acest punct devine important în capitolul despre copiile de rezervă (9).

### Despre fosta „identitate de unică folosință”

„Identitatea de unică folosință” — o identitate fără niciun mijloc de recuperare — a dispărut. Cu modalitățile actuale de creare, fiecare identitate poate fi protejată printr-o copie de rezervă.

---

## 2. Conectarea cu cealaltă persoană

Apăsați butonul „Adaugă prieten” pe ecranul contactelor și apar trei opțiuni.

- **Adaugă un contact**: Introduceți ID-ul celeilalte persoane sau scanați un cod QR.
- **Invită un prieten**: Copiați linkul de invitație și trimiteți-l prin mijlocul obișnuit de contact (e-mail etc.). Dacă cealaltă persoană deschide linkul și își introduce numele, puteți conversa imediat.
- **Creează un grup**: Este suficient să introduceți un nume de grup pentru a crea unul (capitolul 4).

ID-ul dumneavoastră este afișat în forma sa completă atunci când vă deschideți propriul profil și îl puteți copia ca atare. Puteți transmite ID-ul complet, nu doar ID-ul scurt.

Dacă și cealaltă persoană a deschis aplicația, vă puteți conecta direct și puteți conversa.

---

## 3. Conversații

- Este suficient să introduceți mesajul și să îl trimiteți. Se pot trimite și fotografii, stickere și locația.
- Deschideți „+” de lângă câmpul de introducere și apar împreună atașamentele de fișiere, mesajele vocale, introducerea vocală, informațiile despre locație, stickerele, setarea „nu este nevoie de răspuns” și altele.
- **Trimiterea de fișiere**: În conversațiile individuale, până la 50 MB. În grup, este mai mică, până la aproximativ 50 KB.
- Fișierele în formate periculoase, precum fișierele executabile, sunt blocate automat.
- Dacă cealaltă persoană nu a deschis aplicația, mesajul rămâne criptat în „căsuța de păstrare” și este livrat atunci când o deschide. Serverul care transportă căsuța de păstrare nu poate citi conținutul. Scrisorile nelivrate se șterg automat după **cel mult 7 zile**.
- Istoricul conversațiilor poate fi exportat într-un fișier sau importat.

### Citirea ecranului

- **Starea trimiterii**: Se vede după semnul de lângă un mesaj. ✓ înseamnă trimis, un ✓ într-un cerc înseamnă că a fost depus în căsuța de păstrare, ✓✓ înseamnă că a ajuns la cealaltă persoană, citit este un semn albastru, iar eșecul este un semn roșu. Se deosebesc și prin formă, nu doar prin culoare.
- **Lista de contacte**: Ora ultimei conversații este afișată ca oră pentru azi, „Ieri” pentru ieri, lună/zi pentru acest an și an/lună/zi pentru orice este mai vechi. Contactele cu mesaje necitite au numele și ora evidențiate.
- **Nume pentru contacte**: Deschideți „Informații despre contact” (în meniul cu clic dreapta al unui contact sau în meniul „⋮” al conversației) și puteți seta un nume propriu pentru acel contact (o poreclă). Poreclele se păstrează numai pe acest dispozitiv și nu sunt trimise niciodată contactului sau serverului releu. Când setați o poreclă, lângă ea este afișat, într-o culoare estompată, și numele pe care contactul și l-a setat singur. Puteți dezactiva acest al doilea nume cu „Afișează și numele pe care fiecare contact și l-a setat singur” din secțiunea „Confidențialitate” a setărilor.
- **Cardul dumneavoastră**: În partea de sus a listei se află cardul propriului profil; apăsați-l pentru a vă deschide profilul. Se derulează împreună cu lista.
- **Filele de jos pe telefon**: La lățimea telefonului, în partea de jos a ecranului apar filele „Contacte” și „Setări”.
- **Antetul conversației**: Din pictograma de căutare puteți căuta în conversație. Din meniul „⋮” puteți verifica numărul de siguranță, dezactiva notificările, fixa, crea un sondaj și altele.

### Comenzi

Dacă introduceți `/` în câmpul de introducere, apar candidații de comenzi. Introduceți `/help` pentru lista comenzilor utilizabile (71 de tipuri).
Unele operațiuni, precum setările și legarea dispozitivelor, se fac prin comenzi.

---

## 4. Grupuri

- Într-un grup pot intra până la **1.000 de persoane**.
- Modul de creare este doar introducerea unui nume de grup la „Creează un grup” din „Adaugă prieten” (puteți crea unul și cu comanda `/newgroup`). Invitația se face din „linkul de invitație în grup”. Persoana care a primit linkul poate participa introducându-și numele.
- Și în grup se pot trimite fișiere, dar limita este mai mică, aproximativ 50 KB. Mesajele vocale nu pot fi trimise încă în grup.
- Dacă există membri care folosesc o versiune veche a aplicației, în acel grup nu poate fi folosit noul mod, mai sigur (grup v5), iar pe ecran apare o atenționare. Devine activ atunci când toți trec la cea mai nouă versiune.

---

## 5. Apeluri

- Se pot face apeluri vocale și apeluri video individuale. Există și apeluri de grup (cu până la 8 persoane).
- **Codul de verificare a apelului**: Pe ecranul apelului este afișat un cod de verificare. Citiți-l împreună cu cealaltă persoană și verificați dacă coincide pe ambele ecrane. Dacă nu coincide, este posibil ca cineva să asculte pe parcurs. În acel caz, închideți apelul.
- Apelul de grup poate să nu poată fi pornit dacă aplicațiile tuturor nu sunt la cea mai nouă versiune.

---

## 6. Mai multe dispozitive și conturi

- Pentru a folosi aceeași identitate pe mai multe dispozitive, legați dispozitivele între ele cu comanda `/link`.
- Conturile pot fi create mai multe și folosite separat (de exemplu pentru serviciu și pentru uz personal). Atât numărul de dispozitive, cât și numărul de conturi sunt gratuite și nelimitate.
- **Cum se creează un cont**: Apăsați butonul „+” de lângă filele de conturi din partea de sus a listei de contacte. Introduceți un nume și alegeți un emoji ca pictogramă, iar un cont nou este creat și se trece automat la el.
- **Schimbarea conturilor**: Filele de conturi sunt afișate întotdeauna în partea de sus a listei de contacte. Apăsați una pentru a schimba (pe un computer puteți schimba și cu Ctrl+1–9). Apăsați lung o filă pentru a o redenumi, a-i schimba pictograma sau a o șterge.
- Contactele și cheile sunt separate pentru fiecare cont. Faceți din nou schimb de contacte pentru fiecare cont.
- Limba este selectată automat dintre 51 de limbi, inclusiv engleza, în funcție de limba dispozitivului dumneavoastră.

---

## 7. Setări pentru păstrarea siguranței

Setările se deschid ca un ecran separat. Pe telefon, deschideți-le din fila „Setări” din partea de jos a ecranului; pe computer, din butonul cu roată dințată de pe ecran (le puteți deschide și cu comanda `/settings`). Folosiți acțiunea de întoarcere pentru a reveni la ecranul pe care erați.

- **Blocare automată**: Există o setare de blocare automată la schimbarea filei.
- **Fraza de acces a cheii**: Cheia din interiorul dispozitivului poate fi protejată înfășurată într-o frază de acces. La deschiderea aplicației vi se cere introducerea ei.
- **Afișează și numele pe care fiecare contact și l-a setat singur**: În secțiunea „Confidențialitate”. Pentru un contact căruia i-ați dat o poreclă, puteți alege dacă numele său propriu este afișat alături de ea (capitolul 3).
- **Blocare**: Persoanele deranjante pot fi blocate. De la o persoană blocată nu mai sosesc contacte.

---

## 8. Baterie și urgențe (moduri de alimentare)

În setarea „Mod de alimentare” puteți alege cum este folosită bateria.

- **Automat (nivelul bateriei)**: Comută automat în funcție de câtă baterie a rămas.
- **Normal**: Ca de obicei.
- **Economisire a energiei**: Spațiază verificările de livrare la cel mult o dată la 60 de secunde și oprește semnalul de prezență.
- **Urgență (pentru dezastre)**: Spațiază verificările de livrare la cel mult o dată la 10 minute. Folosiți-l într-un dezastru sau în alt moment în care nu puteți reîncărca.

Ceea ce consumă bateria nu este cantitatea de comunicare, ci de câte ori se trezește radioul. De aceea partea de trimitere nu este spațiată; doar partea de ascultare este. Trimiterea pleacă totuși imediat, ca întotdeauna. Când începeți să încărcați, revine automat cu un pas spre partea mai ușoară.

Pe dispozitivele care nu pot citi automat nivelul bateriei (cum ar fi un browser pe iPhone), „Automat” se comportă ca Normal, iar o alegere manuală funcționează așa cum a fost aleasă.

---

## 9. Copii de rezervă și recuperare (acesta este cel mai important capitol)

Identitatea Breeze este doar cheia din interiorul dispozitivului dumneavoastră. Pe server nu există o listă de conturi, iar creatorul nu are nici el cheia dumneavoastră.
**Dacă pierdeți dispozitivul, se pierde și identitatea.** Pentru o identitate importantă, faceți neapărat o copie de rezervă.

Copierea de rezervă și recuperarea se fac din secțiunea „Backup și restaurare” a setărilor (butoanele sunt „Creează copie de rezervă”, „Restaurează copia de rezervă” și „📂 Restaurează din fișier”). Prima dată când adăugați un contact, apare o singură dată un card care vă îndeamnă să faceți o copie de rezervă.

### Copie de rezervă automată

Setarea „Copie de rezervă automată” este activată de la început. Când datele dumneavoastră se schimbă, o copie de rezervă criptată este trimisă automat la serverul releu pe care îl găzduiți.

- Nu trimite la fiecare schimbare: așteaptă 30 de secunde după ultima schimbare și trimite totul împreună. Încercările sunt spațiate la cel puțin 15 minute.
- Cât timp sunteți offline, nu se trimite nimic; schimbările sunt păstrate și trimise când conexiunea revine și când deschideți aplicația.
- Pentru trimiterea automată, trebuie să introduceți o dată, pe acel dispozitiv, fraza de acces a copiei de rezervă (când este nevoie, în secțiunea de setări apare un buton „Introduceți fraza de acces”). **Fraza de acces nu este stocată.** Este reținută numai cât timp aplicația este deschisă și dispare când o închideți. Pentru o identitate cu recuperare simplă, imediat după ce introduceți fraza de acces la înregistrare sau la actualizare, trimiterea funcționează ca atare.
- Dacă serverul releu nu acceptă stocarea copiilor de rezervă, copia de rezervă automată nu rulează. Acest lucru este arătat în secțiunea de setări.
- Starea (când a fost ultima trimitere reușită, dacă există schimbări în așteptare, dacă o trimitere a eșuat) este arătată în secțiunea de setări.

### Cum se face o copie de rezervă (manual)

1. Din „Backup și restaurare” în setări, alegeți „Creează copie de rezervă”.
2. Setați o frază de acces pentru copia de rezervă (cel puțin 6 caractere).
3. Alegeți destinația salvării.
   - **Salvare într-un fișier**: Păstrați fișierul copiei de rezervă la dumneavoastră (recomandat).
   - **Salvare pe un server releu**: Poate fi folosită numai dacă operatorul acelui releu a activat-o. La releul implicit nu poate fi folosită. Există un termen de păstrare, așa că recuperați-o până la termen.

Conținutul copiei de rezervă este criptat. Serverul destinației gestionează doar textul criptat.

### Cum se recuperează

Pe un dispozitiv nou, restaurați folosind fișierul copiei de rezervă (sau copia de rezervă de pe serverul releu) și fraza de acces setată.

Dacă tocmai v-ați readus identitatea cu o frază de recuperare și o copie de rezervă a acelei identități se află pe serverul releu, ea este găsită automat și sunteți întrebat cu „Copie de rezervă găsită”. Dacă o restaurați, datele de pe acel dispozitiv sunt înlocuite cu conținutul copiei de rezervă.

### Trecerea la un dispozitiv nou

Apăsați butonul „Trecere la un dispozitiv nou” din secțiunea „Backup și restaurare” a setărilor și pașii sunt afișați.

1. Pe dispozitivul actual, păstrați o copie de rezervă pe serverul releu (copie de rezervă automată sau „Creează copie de rezervă”).
2. Pe dispozitivul nou, alegeți o metodă de restaurare pe primul ecran și introduceți fraza de recuperare (sau numele contului și fraza secretă).
3. Când identitatea a revenit, copia de rezervă de pe server este găsită automat și vi se oferă o restaurare.

Nu sunt necesare cabluri sau predări de fișiere.

### Atenție

- **Dacă uitați fraza de acces, restaurarea nu este posibilă.** Nici creatorul nu o poate repara. Notați fraza de acces într-un alt loc.
- Introducerea frazei de acces pentru copia de rezervă automată este necesară pe fiecare dispozitiv. Pe un dispozitiv nou, introduceți-o încă o dată.
- Refăceți manual copia de rezervă atunci când identitățile dumneavoastră se înmulțesc sau când schimbați dispozitivul.

---

## 10. Căsuța de păstrare și modul de a gândi costurile

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

## 11. Cum se actualizează (versiunea pentru desktop)

1. Când există o versiune nouă, pe ecran apare o notificare.
2. Apăsând „Descarcă”, merge să ia versiunea nouă (nu o instalează automat).
3. Când descărcarea s-a terminat, apăsați „Instalează” și reporniți.

Dacă pe parcursul actualizării apare o eroare (de exemplu valoarea de verificare nu coincide), **actualizarea se oprește și motivul este afișat pe ecran**. Revenirea la o versiune mai veche nu este posibilă.

---

## 12. Când aveți probleme

| Simptom | Ce să verificați |
|---|---|
| Mesajul nu poate fi trimis | Verificați dacă ora dispozitivului nu este decalată. Dacă ora este decalată, trimiterea eșuează. |
| Nu ajunge la cealaltă persoană | Până când cealaltă persoană deschide aplicația, așteaptă în căsuța de păstrare (cel mult 7 zile). |
| Fișierul nu poate fi trimis | Verificați dacă nu ați depășit limita de dimensiune (individual 50 MB, grup aproximativ 50 KB) și dacă nu a fost blocat ca format periculos. |
| Codul de verificare a apelului nu coincide | Închideți apelul și apelați din nou. Nu continuați fără coincidență. |
| Ați uitat fraza de acces | Restaurarea nu este posibilă. Creați o identitate nouă și anunțați din nou cealaltă persoană. |
| Ați pierdut dispozitivul | Dacă există o copie de rezervă, puteți recupera pe un dispozitiv nou. Dacă nu, va fi o identitate nouă. |
| Pagina de probă nu se deschide | Proba se poate opri fără notificare. Folosiți o copie instalată pe propriul server. |

Raportările de probleme se fac, vă rugăm, pe [pagina Issues](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Promisiunile Breeze

- Nu afișăm reclame. Nici în aplicație, nici altundeva.
- Nu urmărim. Nu există analiză a utilizării, mecanisme de publicitate și nici vânzare de date.
- Creatorul nu deține datele utilizatorilor. Pe partea serverului nu există deloc o listă de conturi.
- Conversațiile sunt criptate între dispozitive. Serverul gestionează doar plicuri care nu pot fi citite.

Comparația detaliată cu alte servicii de mesagerie este scrisă pe „pagina de comparație” a depozitului, incluzând și punctele în care Breeze pierde (numărul de utilizatori, faptul că nu a trecut printr-un audit extern etc.).

---

*Acest manual reflectă starea Breeze la 2026-11-25.*
