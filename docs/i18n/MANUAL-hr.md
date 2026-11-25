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
- Ako koristite u pregledniku, koristite ono što ste postavili na svoj poslužitelj (koraci postavljanja nalaze se u zasebnom dokumentu, «Uputama za postavljanje»)

Svakoj je datoteci priložen broj za provjeru (SHA256SUMS.txt). Ako želite, možete provjeriti podudara li se broj preuzete datoteke.

> **O uzornoj stranici**: Uzorak za provjeru kako radi (https://breeze-469.pages.dev/) je osiguran. Tamo je postavljen isti softver, ali uzorak se može promijeniti ili zaustaviti bez najave. Za pravu uporabu koristite kopiju postavljenu na svoj poslužitelj. Kopija postavljena na vaš poslužitelj ne trpi posljedice ako se uzorak zaustavi.

### Prvo postavljanje

1. Otvorite aplikaciju.
2. Unesite ime i pritisnite «Napravi račun». Time je priprema gotova. Ne treba ni registracija ni broj telefona.

- Ako želite vratiti identitet koji ste ranije napravili, otvorite «Vrati postojeći račun» i pojavit će se načini oporavka (datoteka sigurnosne kopije, fraza za oporavak itd.).
- Kad se stvaranje završi, pojavljuje se kartica koja vas vodi da ključ zaštitite lozinkom (ne nestaje nakon nekog vremena). Za važan identitet slijedite uputu i dodajte zaštitu.

Tada se u vašem uređaju stvara «ključ». On je sam vaš identitet.
**Popis računa ne postoji na poslužitelju.** Identitet postoji samo u vašem uređaju.
Ova točka postaje važna u poglavlju o sigurnosnoj kopiji (9).

### O «jednokratnom identitetu»

Ako pri stvaranju odaberete «jednokratni identitet», nastaje identitet bez ikakvog sredstva za oporavak.
Ako izgubite taj uređaj, vratite ga na početno stanje ili obrišete podatke preglednika, taj se identitet više nikada ne vraća.
To se prikazuje i na zaslonu. Ne birajte ga za identitet koji ćete dugo koristiti.

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
- **Vaša kartica**: Na vrhu popisa je vaša profilna kartica; pritisnite je da otvorite profil. Pomiče se zajedno s popisom.
- **Donje kartice na telefonu**: Pri širini telefona, na dnu zaslona pojavljuju se kartice «Kontakti» i «Postavke».
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

---

## 6. Više uređaja i računa

- Da biste isti identitet koristili na više uređaja, povežite uređaje naredbom `/link`.
- Račune možete napraviti više i koristiti ih odvojeno (na primjer, poslovni i privatni). I broj uređaja i broj računa besplatni su i neograničeni.
- **Kako napraviti račun**: Pritisnite gumb «+» pored kartica računa na samom vrhu popisa kontakata. Unesite ime i odaberite emoji ikonu, i novi će račun biti napravljen i automatski prebačen na njega.
- **Promjena računa**: Kartice računa uvijek se prikazuju na samom vrhu popisa kontakata. Pritisnite jednu da biste se prebacili (na računalu se možete prebaciti i s Ctrl+1–9). Pritisnite i držite karticu da biste joj promijenili ime, promijenili ikonu ili je obrisali.
- Jezik se automatski bira iz 51 jezika, uključujući engleski, prema jeziku vašeg uređaja.

---

## 7. Postavke koje čuvaju sigurnost

Postavke se otvaraju kao poseban zaslon. Na telefonu ih otvorite s kartice «Postavke» na dnu zaslona; na računalu s gumba zupčanika na zaslonu (možete ih otvoriti i naredbom `/settings`). Da biste se vratili na zaslon na kojem ste bili, koristite radnju natrag.

- **Automatsko zaključavanje**: Postoji postavka za automatsko zaključavanje pri promjeni kartice.
- **Lozinka za ključ**: Ključ u uređaju možete zaštititi omotavanjem lozinkom. Pri otvaranju aplikacije traži se unos.
- **Blokiranje**: Možete blokirati dosadne osobe. Od blokiranih osoba ne stiže nikakva veza.

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

Sigurnosna kopija i oporavak rade se iz odjeljka «Sigurnosna kopija i oporavak» u postavkama (postoje tri gumba: «Sigurnosna kopija u oblak», «Vrati» i «Vrati iz datoteke»). Kad prvi put dodate kontakt, jednom se pojavljuje kartica koja vas potiče da napravite sigurnosnu kopiju.

### Kako napraviti sigurnosnu kopiju

1. Iz «Sigurnosne kopije i oporavka» u postavkama odaberite da napravite sigurnosnu kopiju.
2. Postavite lozinku za sigurnosnu kopiju (6 znakova ili više).
3. Odaberite mjesto čuvanja.
   - **Čuvanje u datoteku**: Datoteku sigurnosne kopije čuvajte kod sebe (preporučeno).
   - **Čuvanje na relejni poslužitelj**: Može se koristiti samo ako je operater tog releja to omogućio. Na zadanom releju ne može se koristiti. Postoji rok čuvanja, pa je vratite prije isteka roka.

Sadržaj sigurnosne kopije je šifriran. Poslužitelj na mjestu čuvanja radi samo sa šifriranim tekstom.

### Kako oporaviti

Na novom uređaju oporavite koristeći datoteku sigurnosne kopije (ili sigurnosnu kopiju na relejnom poslužitelju) i lozinku koju ste postavili.

### Napomene

- **Ako zaboravite lozinku, oporavak nije moguć.** Ni autor to ne može popraviti. Lozinku zapišite na drugom mjestu.
- **Jednokratni identiteti ne vraćaju se ni sigurnosnom kopijom ni oporavkom.**
- Sigurnosnu kopiju ponovno napravite kad se identiteti dodaju ili kad promijenite uređaj.

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
| Uzorna stranica se ne otvara | Uzorak se može zaustaviti bez najave. Koristite kopiju postavljenu na svoj poslužitelj. |

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
