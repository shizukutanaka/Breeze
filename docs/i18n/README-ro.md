# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Citiți în altă limbă**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · Română (această pagină) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Un serviciu de mesagerie criptat, fără număr de telefon și fără înregistrare.**
Conținutul conversațiilor poate fi citit numai de persoana care trimite și de cea care primește. Nici măcar serverul care îl transportă pe drum nu îl poate citi.
Toate funcțiile sunt gratuite și nu există reclame.

Acesta nu este o pagină web, ci un software care se instalează și se folosește ca atare (Windows / Mac / Linux / Android / iPhone / browser).

![Breeze Messenger screenshot — the main window right after creating an identity](../images/screenshot.png)

## Pentru a-l folosi, îl instalați pe propriul server

Breeze nu are un „server al unei companii operatoare”. **Pentru a-l folosi, trebuie să vă asigurați singur un spațiu de găzduire (un server) și să instalați Breeze acolo. Aceasta este modalitatea oficială de utilizare.**

- Pentru găzduire este suficient nivelul gratuit. Funcționează în limita gratuită Cloudflare și nu este nevoie de card bancar. Procedura se află în [ghidul de instalare](SELF_HOSTING-ro.md) (versiunile în alte limbi pot fi alese la începutul ghidului).
- Aplicația (Windows / Mac / Linux / Android / iPhone) se obține de pe [pagina de descărcare](https://github.com/shizukutanaka/Breeze/releases/latest) și se folosește conectată la propriul server.
- **Despre instalarea demonstrativă (o precizare onestă)**: Am pus la dispoziție un exemplar demonstrativ, pentru verificarea funcționării (https://breeze-469.pages.dev/). Rulează același software, dar pentru utilizarea reală vă rugăm să folosiți propriul server. Exemplarul demonstrativ se poate schimba sau se poate opri fără preaviz. O copie instalată pe propriul server nu este afectată de oprirea exemplarului demonstrativ.

Instrucțiunile detaliate de utilizare se află în [manual](MANUAL-ro.md) (versiunile în alte limbi pot fi alese la începutul manualului).

## Utilizare (3 pași)

1. Deschideți Breeze instalat pe propriul server (sau adresa pe care v-a comunicat-o persoana care l-a instalat) și introduceți-vă numele. Cu asta, pregătirea este gata (nu este nevoie nici de înregistrare, nici de număr de telefon). În acel moment, în interiorul dispozitivului se creează o „cheie”, care devine identitatea dumneavoastră.
2. Dați ID-ul dumneavoastră sau codul QR persoanei cu care doriți să vorbiți.
3. Dacă și cealaltă persoană a deschis aplicația, vă puteți conecta direct și puteți conversa. Dacă cealaltă persoană nu a deschis-o, mesajul rămâne criptat în „căsuța de păstrare” și este livrat atunci când o deschide. Serverul care transportă căsuța de păstrare nu poate citi conținutul. Scrisorile nelivrate se șterg automat după cel mult 7 zile.

## Promisiuni (ceea ce nu facem)

- **Nu afișăm reclame.** Nici în aplicație, nici altundeva.
- **Nu vă urmărim.** Nu există analiză a utilizării, mecanisme de publicitate și nici vânzare de date.
- **Creatorul nu deține datele utilizatorilor.** Pe partea serverului nu există deloc o listă de conturi. Identitatea este doar cheia din dispozitivul dumneavoastră.
- **Conversațiile sunt criptate între dispozitive.** Serverul gestionează doar plicuri care nu pot fi citite.

Din onestitate, scriem și limitele. Pentru livrare, pe server există o păstrare de scurtă durată (plicurile nelivrate cel mult 7 zile, semnalele de conectare 5 minute, înregistrările de adrese și dispozitive 90 de zile, informațiile despre grupuri și abonările la notificări 30 de zile; toate se șterg automat și conținutul nu poate fi citit). Salvarea de rezervă în cloud este dezactivată la început. Dacă îl instalați pe propriul server, și această păstrare ajunge sub administrarea dumneavoastră.

## Proiectat astfel încât folosirea în scopuri infracționale să nu merite

Breeze este construit astfel încât abuzul să fie costisitor și complicat pentru cel care abuzează. Nu spunem că „face infracțiunea imposibilă”. Este o proiectare care face ca aceasta „să nu merite”.

- **Nu există o bază gratuită de care să profiți.** Nu există un server central gratuit, așa că nici cel care abuzează nu are altă variantă decât să își asigure găzduirea cu un cont pe numele său și pe cheltuiala sa.
- **Trimiterea implică o sarcină.** La fiecare trimitere se cere un mic calcul (proof of work), iar cantitățile au limite. Trimiterile abuzive în masă nu merită.
- **Se poate face o raportare care nu poate fi negată.** Persoana care a primit poate raporta însăși trimiterea primită drept dovadă. Partea care a trimis nu poate nega că a trimis.
- **Dreptul de a opri aparține celui care a instalat.** Ceea ce se întâmplă pe propriul server puteți opri dumneavoastră. Nu este nevoie de permisiunea nimănui.

## Ce poate face

- Conversații individuale și conversații de grup (până la 1.000 de persoane)
- Apeluri vocale și apeluri video
- Trimitere de fișiere (în conversațiile individuale până la 50 MB. Se pot trimite și în grup, dar limita de dimensiune este mai mică.)
- Utilizarea separată a mai multor dispozitive și a mai multor conturi (de exemplu pentru serviciu și pentru uz personal; atât numărul de dispozitive, cât și numărul de conturi sunt gratuite și nelimitate)
- Este selectat automat dintre 8 limbi (engleză, japoneză, coreeană, chineză (Taiwan), spaniolă, thailandeză, indoneziană, portugheză)
- Profil cu fotografie, stickere, partajarea locației
- Operare prin comenzi, precum `/help` (peste 60 de tipuri)

## Diferențe față de alte servicii de mesagerie

| | Breeze | Majoritatea serviciilor de mesagerie |
|---|--------|--------|
| Înregistrare | Nu este necesară (identitatea este cheia din dispozitiv) | Este necesar un număr de telefon |
| Server | Nu poate citi conținutul | Se bazează pe încrederea în compania operatoare |
| Instalare pe propriul server | Este premisa (un lucru care se instalează și se folosește) | Nu este posibilă |
| Publicitatea conținutului | Totul este public (licență MIT) | Multe sunt nepublice |
| Locul datelor | În dispozitivul dumneavoastră | Pe serverul companiei operatoare |

O comparație detaliată cu Signal și LINE se află pe [pagina de comparație (în engleză)](../COMPARISON.md). Fiecare afirmație a Breeze este însoțită de câte un „mod de verificare”, iar punctele în care Breeze pierde (numărul de utilizatori, faptul că nu a trecut printr-un audit extern etc.) sunt scrise fără a fi ascunse.

## Costul instalării pe propriul server

Breeze funcționează în limita gratuită Cloudflare. Nu este nevoie nici de card bancar.

| Element | Limita gratuită | În cazul plătit |
|-----------|-----------|-------------|
| Găzduire | Cloudflare Pages (gratuit) | — |
| Procesare | Până la 100.000 de ori pe zi | Până la 10.000.000 de ori pe lună |
| Stocare | Citire până la 100.000 de ori pe zi, scriere până la 1.000 de ori pe zi | Citire până la 10.000.000 de ori pe lună, scriere până la 1.000.000 de ori pe lună |
| Retransmiterea apelurilor | Gratuit până la 20 GB | 0,05 dolari per GB |
| Domeniu propriu | Nu este necesar (vine cu o adresă gratuită) | 10 dolari pe an |
| **Total** | **0 dolari pe lună** (la o utilizare ușoară, până la aproximativ 20–40 de persoane) | **De la 5 dolari pe lună** (la o utilizare ușoară, ordin de mărime de aproximativ 100 de persoane; la ordinul de mărime de 1.000 de persoane, între 34 și 222 de dolari pe lună, în funcție de utilizare) |

Despre modul în care cresc costurile la scară mare și despre „de ce nu trebuie ca un singur operator să suporte toate costurile” se scrie în [abordarea costurilor și a sustenabilității (în engleză)](../SUSTAINABILITY.md), iar calculele de bază se află în [modelul de cost (în engleză)](../COST_MODEL.md).

Instalarea începe cu această singură comandă (detalii în [ghidul de instalare](SELF_HOSTING-ro.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Detalii tehnice (pentru dezvoltatori)

### Metodele de criptare

| Rol | Metodă |
|-------|-----------|
| Schimb de chei | X25519 (rezervă: P-256) |
| Semnătură | Ed25519 (rezervă: HMAC-SHA256) |
| Criptare | AES-256-GCM |
| Derivarea cheii | HKDF-SHA256 |
| Reînnoirea cheii conversației | Double Ratchet (aceeași metodă ca la Signal) |
| Cheia de grup | Sender Key |
| Ascunderea expeditorului față de intermediar | Sealed Sender |

Documentul de referință al proiectării este [specificația SPEC.md](../../SPEC.md), iar locul de raportare a punctelor slabe și politica se află în [SECURITY.md](../../SECURITY.md).

### Teste și verificări de calitate

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Participarea la dezvoltare

Desfășurarea și regulile se află în [CONTRIBUTING.md](../../CONTRIBUTING.md).
Raportarea problemelor se face pe [pagina Issues](https://github.com/shizukutanaka/Breeze/issues). Codul de conduită este [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Licență

MIT — conform [LICENSE](../../LICENSE), poate fi folosit, modificat și distribuit liber.
