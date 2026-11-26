# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Pročitajte na drugom jeziku**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · Hrvatski (ova stranica)

**Šifrirani messenger za koji ne treba ni broj telefona ni registracija.**
Sadržaj razgovora mogu pročitati samo osoba koja šalje i osoba koja prima. Ne može ni poslužitelj koji ga prenosi usput.
Sve su funkcije besplatne i nema oglasa.

Ovo nije web-stranica, već softver koji se instalira i koristi (Windows / Mac / Linux / Android / iPhone / preglednik).

![Snimka zaslona Breeze Messengera — glavni prozor odmah nakon stvaranja identiteta](../images/screenshot.png)

## Da biste ga koristili, postavljate ga na svoj poslužitelj

Breeze nema «poslužitelj operaterske tvrtke». **Da biste ga koristili, sami osiguravate mjesto za postavljanje (poslužitelj) i na njega postavljate Breeze. To je službeni način korištenja.**

- Standardno postavljanje koristi Cloudflare, pa je **potreban Cloudflare račun**. Koraci su u [uputama za postavljanje](SELF_HOSTING-hr.md) (druge jezike možete odabrati na početku uputa).
- Aplikacije (Windows / Mac / Linux / Android / iPhone) uzimate sa [stranice za preuzimanje](https://github.com/shizukutanaka/Breeze/releases/latest) i koristite ih povezane na svoj poslužitelj.

Detaljna je uporaba u [uputama](MANUAL-hr.md) (druge jezike možete odabrati na početku uputa).

## Uporaba (3 koraka)

1. Otvorite Breeze koji ste postavili na svoj poslužitelj (ili adresu koju vam je rekao onaj tko ga je postavio) i pritisnite «Započni s nasumičnim ID-jem» (ime možete unijeti ako želite). Time je priprema gotova (ne treba ni registracija ni broj telefona). Tada se u vašem uređaju stvara «ključ» i on postaje vaš identitet.
2. Dajte svoj ID ili QR kod osobi s kojom želite razgovarati.
3. Ako i druga strana otvori aplikaciju, možete se izravno povezati i razgovarati. Ako je ne otvori, pismo se šifrirano stavlja u «spremnik za čuvanje» i dostavlja se kad je otvori. Poslužitelj koji prenosi spremnik ne može pročitati sadržaj. Pisma koja ne budu dostavljena automatski se brišu najkasnije za 7 dana.

## Obećanja (ono što ne radimo)

- **Ne prikazujemo oglase.** Ni u aplikaciji ni bilo gdje drugdje.
- **Ne pratimo.** Nema analitike korištenja, oglasnih mehanizama ni prodaje podataka.
- **Autor ne drži podatke korisnika.** Na strani poslužitelja ne postoji ni popis računa. Identitet je samo ključ u vašem uređaju.
- **Razgovori se šifriraju između uređaja.** Poslužitelj radi samo s nečitljivim omotnicama.

Iskreno pišemo i opseg. Radi dostave, na poslužitelju postoji kratkotrajno čuvanje (nedostavljene omotnice najviše 7 dana, signali povezivanja 5 minuta, zapisi adresa i uređaja 90 dana, podaci o grupama i pretplate na obavijesti 30 dana. Sve se automatski briše i sadržaj se ne može pročitati). Sigurnosna kopija u oblak zadano je isključena. Ako postavite na svoj poslužitelj, i to čuvanje možete staviti pod svoju kontrolu.

## Mogućnosti

- Razgovori jedan na jedan i grupni razgovori (najviše 1.000 ljudi)
- Glasovni pozivi i videopozivi (grupni pozivi do 8 ljudi)
- Povijest poziva (čuva se samo na ovom uređaju: samo druga osoba, smjer, vrijeme i trajanje poziva — ništa od izgovorenog. Nikada se ne šalje poslužitelju niti drugoj osobi)
- Slanje datoteka (jedan na jedan najviše 50MB. I u grupama se može slati, ali je granica veličine manja)
- Korištenje više uređaja i više računa (na primjer, poslovni i privatni. I broj uređaja i broj računa besplatni su i neograničeni)
- Automatska sigurnosna kopija (kada se nešto promijeni, šifrirana sigurnosna kopija automatski se sprema na vaš poslužitelj. Na novom uređaju, kada oporavite identitet, sigurnosna kopija automatski se pronalazi i nudi vam se. Postavke vas također vode kroz prelazak na novi uređaj)
- Ime koje sami birate za svaki kontakt (svaki kontakt možete preimenovati, a čuva se samo na ovom uređaju. Možete odabrati i prikazuje li se ime koje je svaki kontakt sam sebi postavio)
- 51 jezik (engleski i 50 jezičnih datoteka), automatski se bira prema jeziku vašeg uređaja
- Profil s fotografijom, naljepnice, dijeljenje lokacije
- Naredbene operacije poput `/help` (71 vrsta)
- Načini napajanja prilagođeni vašoj bateriji (automatski / normalni / ušteda energije / hitni). Kako se baterija prazni, provjere isporuke razrjeđuju se kako bi baterija dulje trajala. Zaštita za katastrofe i druga vremena kada se ne možete napuniti
- Donje kartice na telefonu (Razgovori / Pozivi / Kontakti / Moja kartica / Postavke. Koje će se kartice prikazivati može se odabrati u postavkama)
- Čitljivi zasloni (pozornost na kontrast boja, veličinu teksta i upravljanje samo tipkovnicom)

## Razlike u odnosu na druge messengere

| | Breeze | Mnogi messengeri |
|---|--------|--------|
| Registracija | Nije potrebna (identitet je ključ u uređaju) | Potreban je broj telefona |
| Poslužitelj | Ne može pročitati sadržaj | Pretpostavlja se povjerenje u operatersku tvrtku |
| Postavljanje na svoj poslužitelj | Pretpostavka (nešto što se postavlja i koristi) | Nije moguće |
| Otvorenost sadržaja | Sve je otvoreno (licencija MIT) | Često zatvoreno |
| Mjesto podataka | U vašem uređaju | Na poslužitelju operaterske tvrtke |

Detaljna usporedba sa Signalom i LINEom nalazi se na [stranici za usporedbu (na engleskom)](../COMPARISON.md). Svaka tvrdnja Breezea ima priložen «način provjere», a i točke u kojima Breeze zaostaje (broj korisnika, to što nije prošao vanjsku reviziju itd.) napisane su bez skrivanja.

## Trošak postavljanja na svoj poslužitelj

Breeze radi u besplatnom okviru Cloudflarea. Kreditna kartica nije potrebna.

| Stavka | Besplatni okvir | U plaćenom slučaju |
|-----------|-----------|-------------|
| Mjesto za postavljanje | Cloudflare Pages (besplatno) | — |
| Obrada | Do 100 tisuća puta dnevno | Do 10 milijuna puta mjesečno |
| Čuvanje | Dnevno čitanje 100 tisuća, pisanje 1 tisuća puta | Mjesečno čitanje 10 milijuna, pisanje 1 milijun puta |
| Prijenos poziva | Besplatno do 20GB | 0,05 dolara po 1GB |
| Vlastita domena | Nije potrebna (dobiva se besplatna adresa) | 10 dolara godišnje |
| **Ukupno** | **0 dolara mjesečno** (uz laganu uporabu do oko 20–40 ljudi) | **Od 5 dolara mjesečno** (uz laganu uporabu razmjera oko 100 ljudi. U razmjerima od 1.000 ljudi, ovisno o uporabi, 34–222 dolara mjesečno) |

Kako troškovi rastu u velikim razmjerima i «zašto jedan operater ne snosi ukupan trošak» napisano je u [pristupu troškovima i održivosti (na engleskom)](../SUSTAINABILITY.md), a osnovni izračuni u [modelu troškova (na engleskom)](../COST_MODEL.md).

Postavljanje počinje ovom jednom naredbom (detalji u [uputama za postavljanje](SELF_HOSTING-hr.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Tehnički detalji (za programere)

### Načini šifriranja

| Uloga | Način |
|-------|-----------|
| Razmjena ključeva | X25519 (rezerva: P-256) |
| Potpis | Ed25519 (rezerva: HMAC-SHA256) |
| Šifriranje | AES-256-GCM |
| Izvođenje ključa | HKDF-SHA256 |
| Obnavljanje ključa razgovora | Double Ratchet (isti način kao Signal) |
| Grupni ključ | Sender Key |
| Skrivanje pošiljatelja od releja | Sealed Sender |

Osnovni dokument dizajna je [specifikacija SPEC.md](../../SPEC.md), a adresa za prijavu slabosti i politika nalaze se u [SECURITY.md](../../SECURITY.md).

### Testovi i provjere kvalitete

```bash
npm ci            # Instalirajte razvojne alate
npm test          # Pokrenite testove
./validate.sh     # Provjera kvalitete (7 područja poput sintakse, sigurnosti, jezika, usklađenosti načina)
./build.sh zip    # Napravite ZIP za distribuciju
```

### Sudjelovanje u razvoju

Postupak i pravila nalaze se u [CONTRIBUTING.md](../../CONTRIBUTING.md).
Prijave pogrešaka šaljite na [stranicu Issue](https://github.com/shizukutanaka/Breeze/issues). Kodeks ponašanja je [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Licencija

MIT — kao što je navedeno u [LICENSE](../../LICENSE), slobodno koristite, mijenjajte i dijelite.
