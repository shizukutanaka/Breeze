# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Leggi in un'altra lingua**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · Italiano (questa pagina) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Un messenger cifrato, senza numero di telefono e senza registrazione.**
Il contenuto di una conversazione può essere letto solo da chi la invia e da chi la riceve. Nemmeno il server che la trasporta lungo il percorso può leggerlo.
Tutte le funzioni sono gratuite e non ci sono annunci pubblicitari.

Questo non è una pagina web, ma un software da installare e usare (Windows / Mac / Linux / Android / iPhone / browser).

![Schermata di Breeze Messenger — la finestra principale subito dopo la creazione di un'identità](../images/screenshot.png)

## Per usarlo, lo installi sul tuo server

Breeze non ha un «server di una società operatrice». **Per usarlo, prepari tu stesso un luogo in cui eseguirlo (un server) e ci installi Breeze. Questo è il modo ufficiale di usarlo.**

- L'installazione standard usa Cloudflare, quindi **è necessario un account Cloudflare**. La procedura si trova nella [guida all'installazione sul proprio server](SELF_HOSTING-it.md) (dall'inizio della guida puoi scegliere altre lingue).
- Le app (Windows / Mac / Linux / Android / iPhone) si prendono dalla [pagina di download](https://github.com/shizukutanaka/Breeze/releases/latest) e si usano collegandole al proprio server.
- **Sull'installazione di esempio (un avviso onesto)**: è disponibile un esempio per verificarne il funzionamento (https://breeze-469.pages.dev/). Ciò che vi è installato è lo stesso software, ma per l'uso reale usa il tuo server, per favore. L'esempio può cambiare o fermarsi senza preavviso. Ciò che hai installato sul tuo server non risente della fermata dell'esempio.

Per l'uso dettagliato, consulta il [manuale](MANUAL-it.md) (dall'inizio del manuale puoi scegliere altre lingue).

## Come si usa (3 passaggi)

1. Apri il Breeze che hai installato sul tuo server (oppure l'indirizzo che ti ha comunicato la persona che lo ha installato) e premi «Inizia con un ID casuale» (se vuoi, puoi inserire un nome). Con questo la preparazione è completa (nessuna registrazione, nessun numero di telefono). In quel momento, dentro il tuo dispositivo viene creata una «chiave», e quella chiave diventa la tua identità.
2. Consegna il tuo ID o il tuo codice QR alla persona con cui vuoi parlare.
3. Se anche l'altra persona ha l'app aperta, vi collegate direttamente e potete parlare. Quando non l'ha aperta, il messaggio attende, cifrato così com'è, in una «casella di deposito» e viene consegnato quando apre l'app. Il server che trasporta la casella di deposito non può leggerne il contenuto. Una lettera mai consegnata viene eliminata automaticamente dopo al massimo 7 giorni.

## Promesse (ciò che non faremo)

- **Niente annunci pubblicitari.** Né dentro l'app, né da nessuna parte.
- **Nessun tracciamento.** Nessuna analisi dell'uso, nessun meccanismo pubblicitario, nessuna vendita di dati.
- **Chi lo ha creato non possiede i dati degli utenti.** Lato server non esiste nemmeno un elenco degli account. La tua identità è solo la chiave dentro il tuo dispositivo.
- **Le conversazioni sono cifrate tra i dispositivi.** Il server tratta solo buste che non può leggere.

Scriviamo onestamente anche la portata. Per poter consegnare i messaggi, il server conserva le cose per un breve periodo (buste non consegnate per al massimo 7 giorni, segnali di connessione per 5 minuti, registrazioni di indirizzi e dispositivi per 90 giorni, informazioni sui gruppi e sottoscrizioni alle notifiche per 30 giorni. Tutto viene eliminato automaticamente e il contenuto non può essere letto). Il backup sul cloud all'inizio è disattivato. Se lo installi sul tuo server, anche questa conservazione temporanea è sotto il tuo controllo.

## Cosa può fare

- Conversazioni individuali e conversazioni di gruppo (fino a 1.000 persone)
- Chiamate vocali e videochiamate (chiamate di gruppo fino a 8 persone)
- Invio di file (fino a 50MB nelle conversazioni individuali. Anche nei gruppi si possono inviare, ma il limite di dimensione è più piccolo)
- Uso su più dispositivi e con più account (per esempio lavoro e uso personale. Sia il numero di dispositivi sia il numero di account sono gratuiti e illimitati)
- Backup automatico (quando qualcosa cambia, un backup cifrato viene salvato automaticamente sul tuo server. Su un nuovo dispositivo, una volta recuperata la tua identità, un backup viene trovato automaticamente e ti viene proposto. Le impostazioni ti guidano anche nel passaggio a un nuovo dispositivo)
- Un nome scelto da te per ciascun contatto (puoi rinominare ciascun contatto; il nome è conservato solo su questo dispositivo. Puoi anche scegliere se mostrare il nome che ciascun contatto ha impostato per sé)
- 51 lingue (inglese più 50 file di lingua), scelte automaticamente in base alla lingua del tuo dispositivo
- Profili con foto, adesivi, condivisione della posizione
- Operazioni a comando come `/help` (71 tipi)
- Modalità di energia in base alla batteria (automatica / normale / risparmio energetico / emergenza). Quando la batteria cala, i controlli di ricezione si diradano perché la batteria duri più a lungo. Una salvaguardia per le catastrofi e gli altri momenti in cui non puoi ricaricare
- Schermi facili da leggere (attenzione al contrasto dei colori, alla dimensione del testo e all'uso con la sola tastiera)

## Differenze rispetto ad altri messenger

| | Breeze | Molti messenger |
|---|--------|--------|
| Registrazione | Non serve (l'identità è la chiave dentro il tuo dispositivo) | Serve un numero di telefono |
| Server | Non può leggere il contenuto | Si basa sulla fiducia nella società operatrice |
| Installazione sul proprio server | È il presupposto (è qualcosa che si installa e si usa) | Non si può |
| Pubblicazione del funzionamento interno | Tutto è pubblico (licenza MIT) | Spesso non è pubblico |
| Dove stanno i dati | Dentro il tuo dispositivo | Sui server della società operatrice |

Il confronto dettagliato con Signal e LINE si trova nella [pagina di confronto (in inglese)](../COMPARISON.md). Ogni affermazione di Breeze è accompagnata da un «modo per verificarla», e anche i punti in cui Breeze perde (il numero di utenti, il non aver ricevuto una verifica esterna, ecc.) sono scritti senza nasconderli.

## Il costo dell'installazione sul proprio server

Breeze funziona entro il piano gratuito di Cloudflare. Non serve una carta di credito.

| Voce | Piano gratuito | A pagamento |
|-----------|-----------|-------------|
| Installazione | Cloudflare Pages (gratuito) | — |
| Elaborazione | Fino a 100.000 volte al giorno | Fino a 10 milioni di volte al mese |
| Archiviazione | Al giorno, fino a 100.000 letture e 1.000 scritture | Al mese, 10 milioni di letture e 1 milione di scritture |
| Inoltro delle chiamate | Gratuito fino a 20GB | 0,05 dollari per 1GB |
| Dominio personalizzato | Non serve (è incluso un indirizzo gratuito) | 10 dollari all'anno |
| **Totale** | **0 dollari al mese** (fino a circa 20–40 persone con un uso leggero) | **Da 5 dollari al mese** (circa 100 persone con un uso leggero. Su una scala di 1.000 persone, da 34 a 222 dollari al mese a seconda dell'uso) |

Come crescono i costi su larga scala e «perché un singolo gestore non deve farsi carico dei costi di tutti» si trovano in [la riflessione su costi e sostenibilità (in inglese)](../SUSTAINABILITY.md); i calcoli su cui si basa sono nel [modello dei costi (in inglese)](../COST_MODEL.md).

L'installazione inizia con questo unico comando (i dettagli sono nella [guida all'installazione sul proprio server](SELF_HOSTING-it.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Dettagli tecnici (per gli sviluppatori)

### Metodi di cifratura

| Ruolo | Metodo |
|-------|-----------|
| Scambio di chiavi | X25519 (riserva: P-256) |
| Firma | Ed25519 (riserva: HMAC-SHA256) |
| Cifratura | AES-256-GCM |
| Derivazione delle chiavi | HKDF-SHA256 |
| Aggiornamento delle chiavi di conversazione | Double Ratchet (lo stesso metodo di Signal) |
| Chiavi di gruppo | Sender Key |
| Nascondere il mittente al relè | Sealed Sender |

Il documento autorevole del progetto è la [specifica, SPEC.md](../../SPEC.md); dove segnalare le debolezze e la politica si trovano in [SECURITY.md](../../SECURITY.md).

### Test e controlli di qualità

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Partecipare allo sviluppo

Il modo di procedere e le regole si trovano in [CONTRIBUTING.md](../../CONTRIBUTING.md).
Le segnalazioni di malfunzionamenti vanno alla [pagina delle Issue](https://github.com/shizukutanaka/Breeze/issues). Il codice di condotta è [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Licenza

MIT — come indicato in [LICENSE](../../LICENSE), puoi usarlo, correggerlo e distribuirlo liberamente.
