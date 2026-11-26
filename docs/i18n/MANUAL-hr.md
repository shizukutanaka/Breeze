# Breeze priručnik

**Pročitajte na drugom jeziku / Read in another language**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · Hrvatski (ova stranica)


Breeze je šifrirani messenger za koji ne treba ni broj telefona ni registracija.
Sadržaj razgovora mogu pročitati samo osoba koja šalje i osoba koja prima. Ne može ni poslužitelj koji ga prenosi usput.
Sve su funkcije besplatne i nema oglasa.

Ovaj je priručnik vodič za one koji počinju koristiti.

---

## 1. Početak

### Nabava

Sa [stranice za preuzimanje](https://github.com/shizukutanaka/Breeze/releases/latest) odaberite ono što odgovara vašem uređaju.

- Windows: ono čije ime završava na `-win-x64.exe` (postoji i za ARM uređaje)
- Mac: ono čije ime završava na `-mac.dmg`
- Linux: `.AppImage` (može se izravno pokrenuti) ili `.deb`
- Ako koristite u pregledniku, koristite ono što ste postavili na svoj poslužitelj (koraci postavljanja nalaze se u zasebnom dokumentu, «Uputama za postavljanje»). Standardno postavljanje koristi Cloudflare, pa je potreban Cloudflare račun

Svakoj je datoteci priložen broj za provjeru (SHA256SUMS.txt). Ako želite, možete provjeriti podudara li se broj preuzete datoteke.

### Prvo postavljanje

1. Otvorite aplikaciju.
2. Pritisnite «Započni s nasumičnim ID-jem». Time je priprema gotova. Ne treba ni registracija ni broj telefona.

- Ako u polje iznad gumba unesete «Vaše ime (ime za prikaz)», počinjete s tim imenom. Gumb možete pritisnuti i s praznim poljem. Ime za prikaz možete kasnije promijeniti u odjeljku profila u postavkama.
- Postoji i način da se napravi identitet s imenom i Breeze ID-jem koji sami odaberete. U tom se slučaju izdaje fraza za oporavak i prikazuje na zaslonu. Fraza za oporavak riječi su koje vam omogućuju da taj identitet vratite na drugom uređaju. Zapišite je na papir ili na neko sigurno mjesto.
- Ako želite vratiti identitet koji ste ranije napravili, otvorite «Vrati postojeći račun» i pojavit će se načini oporavka (vrati iz datoteke sigurnosne kopije, oporavi frazom za oporavak, vrati računom i zaporkom).
- Kad se stvaranje završi, pojavljuje se kartica koja vas vodi da ključ zaštitite lozinkom (ne nestaje nakon nekog vremena). Za važan identitet slijedite uputu i dodajte zaštitu.

Tada se u vašem uređaju stvara «ključ». On je sam vaš identitet.
**Popis računa ne postoji na poslužitelju.** Identitet postoji samo u vašem uređaju.
Ova točka postaje važna u poglavlju o sigurnosnoj kopiji (9).

### O nekadašnjem «jednokratnom identitetu»

«Jednokratni identitet» — identitet bez ikakvog sredstva za oporavak — više ne postoji. Sa sadašnjim načinima izrade, svaki se identitet može zaštititi sigurnosnom kopijom.

---

## 2. Povezivanje s drugom stranom

Pritisnite gumb «Dodaj prijatelja» na zaslonu kontakata i pojavit će se tri izbora.

- **Dodaj kontakt**: Unesite ID druge osobe ili skenirajte QR kod.
- **Pozovi prijatelja**: Kopirajte poveznicu pozivnice i pošaljite je uobičajenim sredstvom veze (e-pošta itd.). Ako druga strana otvori poveznicu i unese ime, odmah možete razgovarati.
- **Napravi grupu**: Da biste napravili grupu, samo unesite naziv grupe (poglavlje 4).

Vaš ID prikazuje se u potpunom obliku kad otvorite svoj profil i možete ga kopirati takvog kakav jest. Možete predati potpuni ID, a ne samo kratki ID.

Ako i druga strana otvori aplikaciju, možete se izravno povezati i razgovarati.

---

## 3. Razgovor

- Samo unesite poruku i pošaljite je. Mogu se slati i fotografije, naljepnice i lokacija.
- Otvorite «+» pored polja za unos i zajedno će se pojaviti prilozi datoteka, glasovne poruke, glasovni unos, podaci o lokaciji, naljepnice, postavka «odgovor nije potreban» i još toga.
- **Slanje datoteka**: U razgovorima jedan na jedan najviše do 50MB. U grupama je manje, oko 50KB.
- Opasni formati, poput izvršnih datoteka, automatski se blokiraju.
- Ako druga strana ne otvori aplikaciju, pismo se šifrirano stavlja u «spremnik za čuvanje» i dostavlja se kad je otvori. Poslužitelj koji prenosi spremnik ne može pročitati sadržaj. Pisma koja ne budu dostavljena automatski se brišu **najkasnije za 7 dana**.
- Povijest razgovora može se izvesti u datoteku ili uvesti iz nje.

### Čitanje zaslona

- **Status slanja**: Možete ga razlikovati po znaku pored poruke. ✓ znači poslano, ✓ u krugu znači da je položeno u spremnik za čuvanje, ✓✓ znači da je stiglo drugoj strani, pročitano je plavi znak, a neuspjeh je crveni znak. Razlikuju se i po obliku, a ne samo po boji.
- **Popis kontakata**: Vrijeme posljednjeg razgovora prikazuje se kao vrijeme za danas, «Jučer» za jučer, mjesec/dan za ovu godinu i godina/mjesec/dan za ranije. Kontakti s nepročitanim porukama imaju istaknuto ime i vrijeme.
- **Imena za kontakte**: Otvorite «Podaci o kontaktu» (u izborniku desnog klika na kontakt ili u izborniku «⋮» razgovora) i možete postaviti svoje ime za taj kontakt (nadimak). Nadimci se čuvaju samo na ovom uređaju i nikada se ne šalju kontaktu ni relejnom poslužitelju. Kada postavite nadimak, ime koje je kontakt sam sebi postavio također se prikazuje pored njega prigušenom bojom. To drugo ime možete isključiti pomoću «Prikaži i ime koje je svaki kontakt sam sebi postavio» u odjeljku «Privatnost» u postavkama.
- **Vaša kartica**: Na vrhu popisa je vaša profilna kartica; pritisnite je da otvorite profil. Pomiče se zajedno s popisom.
- **Donje kartice na telefonu**: Pri širini telefona, na dnu zaslona pojavljuje se pet kartica: „Razgovori“, „Pozivi“, „Kontakti“, „Moja kartica“ i „Postavke“. Koje će se kartice prikazivati možete odabrati jednu po jednu u „Donje kartice“ u postavkama (Razgovori se uvijek prikazuju. Čak i ako sakrijete karticu Postavke, postavke i dalje možete otvoriti gumbom sa zupčanikom na zaslonu).
- **Zaglavlje razgovora**: Od ikone pretraživanja možete pretraživati unutar razgovora. Iz izbornika «⋮» možete provjeriti sigurnosni broj, utišati obavijesti, prikvačiti, napraviti anketu i još toga.

### Naredbe

Unesite `/` u polje za unos i pojavit će se prijedlozi naredbi. Unesite `/help` da vidite popis naredbi koje možete koristiti (71 vrsta).
Neke operacije, poput postavki i povezivanja uređaja, izvode se iz naredbi.

---

## 4. Grupe

- U grupu može ući najviše **1.000 ljudi**.
- Da biste je napravili, samo unesite naziv grupe pod «Napravi grupu» u «Dodaj prijatelja» (možete je napraviti i naredbom `/newgroup`). Pozivanje se vrši putem «poveznice za pozivanje u grupu». Osoba koja primi poveznicu može se pridružiti unosom imena.
- I u grupama se mogu slati datoteke, ali je granica mala, oko 50KB. Glasovne poruke u grupama još se ne mogu slati.
- Ako postoji član koji koristi staru verziju aplikacije, u toj se grupi ne može koristiti sigurniji novi način (grupa v5) i na zaslonu se pojavljuje upozorenje. Aktivira se kad svi prijeđu na najnoviju verziju.

---

## 5. Pozivi

- Mogu se obavljati glasovni pozivi i videopozivi jedan na jedan. Postoje i grupni pozivi (do 8 ljudi).
- **Kod za provjeru poziva**: Na zaslonu poziva prikazuje se kod za provjeru. Pročitajte ga jedno drugom s drugom stranom i provjerite podudara li se na oba zaslona. Ako se ne podudara, možda netko prisluškuje usput. U tom slučaju prekinite poziv.
- Grupni pozivi možda se ne mogu započeti ako aplikacije svih sudionika nisu najnovija verzija.
- **Povijest poziva**: Pozivi jedan na jedan ostavljaju povijest samo na ovom uređaju (druga osoba, je li poziv bio odlazni / dolazni / propušten, vrijeme i trajanje poziva. Ništa od izgovorenog se ne čuva). Povijest se nikada ne šalje poslužitelju niti drugoj osobi. Čuva se do 200 unosa, a najstariji se prvi uklanjaju. Grupni pozivi ne pojavljuju se u povijesti.
- Otvorite povijest na telefonu iz kartice „Pozivi“. Kada postoji propušten poziv koji još niste vidjeli, na kartici Pozivi pojavljuje se značka s brojem i nestaje kada otvorite povijest. Iz retka povijesti možete otvoriti razgovor s tom osobom ili je nazvati natrag. Cijelu povijest možete izbrisati gumbom na zaslonu.
- **Povijest poziva nije dio sigurnosne kopije.** Na novom uređaju povijest počinje prazna. Ako ne želite da se povijest čuva, isključite „Čuvaj povijest poziva na ovom uređaju“ u odjeljku „Privatnost“ u postavkama, i samo snimanje će se zaustaviti.

---

## 6. Više uređaja i računa

- Da biste isti identitet koristili na više uređaja, povežite uređaje naredbom `/link`.
- Račune možete napraviti više i koristiti ih odvojeno (na primjer, poslovni i privatni). I broj uređaja i broj računa besplatni su i neograničeni.
- **Kako napraviti račun**: Pritisnite gumb «+» pored kartica računa na samom vrhu popisa kontakata. Unesite ime i odaberite emoji ikonu, i novi će račun biti napravljen i automatski prebačen na njega.
- **Promjena računa**: Kartice računa uvijek se prikazuju na samom vrhu popisa kontakata. Pritisnite jednu da biste se prebacili (na računalu se možete prebaciti i s Ctrl+1–9). Pritisnite i držite karticu da biste joj promijenili ime, promijenili ikonu ili je obrisali.
- Kontakti i ključevi odvojeni su za svaki račun. Za svaki račun ponovno razmijenite kontakte.
- Jezik se automatski bira iz 51 jezika, uključujući engleski, prema jeziku vašeg uređaja.

---

## 7. Postavke koje čuvaju sigurnost

Postavke se otvaraju kao poseban zaslon. Na telefonu ih otvorite s kartice «Postavke» na dnu zaslona; na računalu s gumba zupčanika na zaslonu (možete ih otvoriti i naredbom `/settings`). Da biste se vratili na zaslon na kojem ste bili, koristite radnju natrag.

- **Automatsko zaključavanje**: Postoji postavka za automatsko zaključavanje pri promjeni kartice.
- **Lozinka za ključ**: Ključ u uređaju možete zaštititi omotavanjem lozinkom. Pri otvaranju aplikacije traži se unos.
- **Prikaži i ime koje je svaki kontakt sam sebi postavio**: U odjeljku «Privatnost». Za kontakt kojem ste dali nadimak možete odabrati prikazuje li se pored njega i njegovo vlastito ime (poglavlje 3).
- **Blokiranje**: Možete blokirati dosadne osobe. Od blokiranih osoba ne stiže nikakva veza.
- **Čuva li se povijest poziva**: Pomoću „Čuvaj povijest poziva na ovom uređaju“ u odjeljku „Privatnost“ možete zaustaviti snimanje povijesti poziva (poglavlje 5).
- **Vidljivost donjih kartica**: U odjeljku „Donje kartice“ možete jednu po jednu prikazivati ili skrivati donje kartice telefona (Pozivi / Kontakti / Moja kartica / Postavke). Razgovori se uvijek prikazuju.

---

## 8. Baterija i hitni slučajevi (načini napajanja)

U postavci «Način napajanja» možete odabrati kako se baterija koristi.

- **Automatski (razina baterije)**: Automatski se prebacuje prema tome koliko je baterije ostalo.
- **Normalni**: Kao i obično.
- **Ušteda energije**: Provjere isporuke razrjeđuje na najviše jednom u 60 sekundi i zaustavlja signal prisutnosti.
- **Hitni (za katastrofe)**: Provjere isporuke razrjeđuje na najviše jednom u 10 minuta. Koristite ga u katastrofi ili drugom vremenu kada se ne možete napuniti.

Bateriju ne troši količina komunikacije, već broj buđenja radija. Zato se strana koja šalje ne razrjeđuje; samo strana koja sluša. Slanje i dalje odlazi odmah, kao i uvijek. Kad počnete puniti, automatski se vraća jedan korak prema lakšoj strani.

Na uređajima koji ne mogu automatski očitati razinu baterije (kao što je preglednik na iPhoneu), «Automatski» se ponaša kao Normalni, a ručni izbor radi kako je odabran.

---

## 9. Sigurnosna kopija i oporavak (najvažnije poglavlje)

Identitet Breezea samo je ključ u vašem uređaju. Na poslužitelju ne postoji popis računa, a ni autor nema vaš ključ.
**Ako izgubite uređaj, gubite i identitet.** Za važne identitete obavezno napravite sigurnosnu kopiju.

Sigurnosna kopija i oporavak rade se iz odjeljka «Sigurnosna kopija i oporavak» u postavkama (gumbi su «Izradi sigurnosnu kopiju», «Vrati sigurnosnu kopiju» i «Vrati iz datoteke»). Kad prvi put dodate kontakt, jednom se pojavljuje kartica koja vas potiče da napravite sigurnosnu kopiju.

### Automatska sigurnosna kopija

Postavka «Automatska sigurnosna kopija» uključena je od početka. Kada se vaši podaci promijene, šifrirana sigurnosna kopija automatski se šalje na relejni poslužitelj koji sami hostate.

- Ne šalje se pri svakoj promjeni: čeka 30 sekundi nakon posljednje promjene i sve šalje zajedno. Pokušaji su razmaknuti najmanje 15 minuta.
- Dok ste izvan mreže, ništa se ne šalje; promjene se zadržavaju i šalju kada se veza vrati i kada otvorite aplikaciju.
- Za automatsko slanje potrebno je zaporku sigurnosne kopije unijeti jednom na tom uređaju (kada je potrebno, u odjeljku postavki pojavljuje se gumb «Unesi zaporku»). **Zaporka se ne pohranjuje.** Pamti se samo dok je aplikacija otvorena i nestaje kada je zatvorite. Za identitet s jednostavnim oporavkom, odmah nakon što unesete zaporku pri registraciji ili ažuriranju, slanje radi kako jest.
- Ako relejni poslužitelj ne podržava pohranu sigurnosnih kopija, automatska sigurnosna kopija ne radi. To se prikazuje u odjeljku postavki.
- Stanje (kada je bilo posljednje uspješno slanje, čekaju li promjene, je li slanje nije uspjelo) prikazuje se u odjeljku postavki.

### Kako napraviti sigurnosnu kopiju (ručno)

1. Iz «Sigurnosne kopije i oporavka» u postavkama odaberite «Izradi sigurnosnu kopiju».
2. Postavite lozinku za sigurnosnu kopiju (6 znakova ili više).
3. Odaberite mjesto čuvanja.
   - **Čuvanje u datoteku**: Datoteku sigurnosne kopije čuvajte kod sebe (preporučeno).
   - **Čuvanje na relejni poslužitelj**: Može se koristiti samo ako je operater tog releja to omogućio. Na zadanom releju ne može se koristiti. Postoji rok čuvanja, pa je vratite prije isteka roka.

Sadržaj sigurnosne kopije je šifriran. Poslužitelj na mjestu čuvanja radi samo sa šifriranim tekstom.

### Kako oporaviti

Na novom uređaju oporavite koristeći datoteku sigurnosne kopije (ili sigurnosnu kopiju na relejnom poslužitelju) i lozinku koju ste postavili.

Ako ste upravo vratili identitet frazom za oporavak, a sigurnosna kopija tog identiteta nalazi se na relejnom poslužitelju, automatski se pronalazi i pita vas se s «Pronađena sigurnosna kopija». Ako je vratite, podaci na tom uređaju bit će zamijenjeni sadržajem sigurnosne kopije.

### Prelazak na novi uređaj

Pritisnite gumb «Prelazak na novi uređaj» u odjeljku «Sigurnosna kopija i oporavak» u postavkama i koraci će biti prikazani.

1. Na trenutačnom uređaju sačuvajte sigurnosnu kopiju na relejnom poslužitelju (automatska sigurnosna kopija ili «Izradi sigurnosnu kopiju»).
2. Na novom uređaju odaberite način oporavka na prvom zaslonu i unesite frazu za oporavak (ili naziv računa i zaporku).
3. Kada se identitet vrati, sigurnosna kopija na poslužitelju automatski se pronalazi i nudi se vraćanje.

Nisu potrebni kabeli ni predaja datoteka.

### Napomene

- **Ako zaboravite lozinku, oporavak nije moguć.** Ni autor to ne može popraviti. Lozinku zapišite na drugom mjestu.
- Unos zaporke za automatsku sigurnosnu kopiju potreban je na svakom uređaju. Na novom je uređaju unesite još jednom.
- Ručnu sigurnosnu kopiju ponovno napravite kada se broj identiteta poveća ili kada promijenite uređaj.
- Povijest poziva nije dio sigurnosne kopije. Kada promijenite uređaj, povijest poziva ne seli se na novi uređaj.

---

## 10. Spremnik za čuvanje i pristup troškovima

- Pisma za vrijeme kad je druga strana izvan mreže stavljaju se šifrirana u «spremnik za čuvanje» relejnog poslužitelja (najviše 7 dana).
- Relej ima granice radi sprječavanja zloporabe (količina koja se može čuvati i učestalost). Kad se granica dosegne, u tom se razdoblju nova pisma ne mogu čuvati, ali **već dostavljena pisma nikada ne nestaju**. Na zaslonu se prikazuju razlog i vrijeme čekanja.
- Ako ste postavili na svoj poslužitelj, granicu možete sami odrediti.

Opseg zapisa koji ostaju na strani poslužitelja (sve se automatski briše i sadržaj se ne može pročitati):

| Stvar | Razdoblje zadržavanja |
|---|---|
| Nedostavljena pisma | Najviše 7 dana |
| Signali povezivanja | 5 minuta |
| Zapisi adresa i uređaja | 90 dana |
| Podaci o grupama i pretplate na obavijesti | 30 dana |

---

## 11. Kako ažurirati (verzija za računalo)

1. Kad postoji nova verzija, na zaslonu se pojavljuje obavijest.
2. Kad pritisnete «Preuzmi», nova se verzija donosi (ne instalira se automatski).
3. Kad se preuzimanje završi, pritisnite «Instaliraj» i ponovno pokrenite.

Ako tijekom ažuriranja dođe do pogreške (npr. provjera datoteke se ne podudara), **ažuriranje se zaustavlja i razlog se prikazuje na zaslonu**. Vraćanje na staru verziju nije moguće.

---

## 12. Kad imate problem

| Simptom | Što provjeriti |
|---|---|
| Poruka se ne može poslati | Provjerite je li vrijeme na uređaju pomaknuto. Ako je vrijeme pomaknuto, slanje ne uspijeva. |
| Ne stiže drugoj strani | Dok druga strana ne otvori aplikaciju, čeka u spremniku za čuvanje (najviše 7 dana). |
| Datoteka se ne može poslati | Provjerite da niste prešli granicu veličine (jedan na jedan 50MB, grupe oko 50KB) i da nije blokirana kao opasan format. |
| Kod za provjeru poziva se ne podudara | Prekinite poziv i nazovite ponovno. Ne nastavljajte dok se ne podudara. |
| Zaboravili ste lozinku | Oporavak nije moguć. Napravite novi identitet i ponovno obavijestite drugu stranu. |
| Izgubili ste uređaj | Ako imate sigurnosnu kopiju, možete oporaviti na novom uređaju. Ako je nemate, postaje novi identitet. |

Prijave pogrešaka šaljite na [stranicu Issue](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. Obećanja Breezea

- Ne prikazujemo oglase. Ni u aplikaciji ni bilo gdje drugdje.
- Ne pratimo. Nema analitike korištenja, oglasnih mehanizama ni prodaje podataka.
- Autor ne drži podatke korisnika. Na strani poslužitelja ne postoji ni popis računa.
- Razgovori se šifriraju između uređaja. Poslužitelj radi samo s nečitljivim omotnicama.

Detaljna usporedba s drugim messengerima napisana je na «stranici za usporedbu» u repozitoriju, uključujući i točke u kojima Breeze zaostaje (broj korisnika, to što nije prošao vanjsku reviziju itd.).

---

*Ovaj priručnik odražava stanje Breezea na dan 2026-11-25.*
