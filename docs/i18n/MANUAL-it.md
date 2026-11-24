# Manuale di Breeze

**Leggi in un'altra lingua**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · Italiano (questa pagina) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze è un messenger cifrato, senza numero di telefono e senza registrazione.
Il contenuto di una conversazione può essere letto solo da chi la invia e da chi la riceve. Nemmeno il server che la trasporta lungo il percorso può leggerlo.
Tutte le funzioni sono gratuite e non ci sono annunci pubblicitari.

Questo manuale è una guida per chi inizia a usarlo.

---

## 1. Come iniziare

### Come ottenerla

Scegli dalla [pagina di download](https://github.com/shizukutanaka/Breeze/releases/latest) quello adatto alla tua macchina.

- Windows: quello il cui nome termina con `-win-x64.exe` (ce ne sono anche per macchine ARM)
- Mac: quello il cui nome termina con `-mac.dmg`
- Linux: `.AppImage` (si può eseguire così com'è) oppure `.deb`
- Per usarla nel browser, si usa ciò che è installato sul proprio server (la procedura di installazione si trova nel documento separato «Guida all'installazione sul proprio server»)

Ogni file è accompagnato da un valore di controllo (SHA256SUMS.txt). Se sei preoccupato, puoi verificare che il valore del file che hai scaricato coincida.

> **Sulla pagina di prova**: la pagina di prova che era pubblicata (breeze.pages.dev) è attualmente ferma (aprendola compare un 404). Fino al ripristino, usa la versione app, per favore. Ciò che è installato sul tuo server non risente di questa fermata.

### Prima configurazione

1. Apri l'app.
2. Inserisci il tuo nome. Con questo la preparazione è completa. Nessuna registrazione, nessun numero di telefono.

In quel momento, dentro il tuo dispositivo viene creata una «chiave». Quella è la tua identità stessa.
**Sul server non c'è un elenco degli account.** La tua identità esiste solo dentro il tuo dispositivo.
Questo punto diventa importante nel capitolo sul backup (8).

### Sull'«identità usa e getta»

Se al momento della creazione scegli «identità usa e getta», ottieni un'identità senza alcun mezzo di recupero.
Se perdi quel dispositivo, lo reimposti o cancelli i dati del browser, quell'identità non tornerà mai più.
Ciò è indicato anche sullo schermo. Non sceglierla per un'identità che userai a lungo.

---

## 2. Collegarsi con l'altra persona

Ci sono tre modi per collegarsi con la persona con cui vuoi parlare.

- **Consegnare l'ID**: comunica il tuo ID all'altra persona e faglielo inserire.
- **Codice QR**: mostra il codice QR di invito e fallo leggere all'altra persona.
- **Collegamento di invito**: copia il messaggio di invito da «Invita un amico» e invialo con il tuo consueto mezzo di contatto (e-mail, ecc.). Quando l'altra persona apre il collegamento e inserisce il proprio nome, potete parlare subito.

Se anche l'altra persona ha l'app aperta, vi collegate direttamente e potete parlare.

---

## 3. Conversazioni

- Basta scrivere un messaggio e inviarlo. Si possono inviare anche foto, adesivi e informazioni sulla posizione.
- **Invio di file**: fino a 50MB nelle conversazioni individuali. Nei gruppi è più piccolo, circa 50KB.
- I file in formati pericolosi, come i file eseguibili, vengono bloccati automaticamente.
- Quando l'altra persona non ha l'app aperta, il messaggio attende, cifrato così com'è, in una «casella di deposito» e viene consegnato quando apre l'app. Il server che trasporta la casella di deposito non può leggerne il contenuto. Una lettera mai consegnata viene eliminata automaticamente dopo **al massimo 7 giorni**.
- La cronologia delle conversazioni può essere esportata in un file e importata.

### Comandi

Se scrivi `/help` nel campo di inserimento, compare l'elenco dei comandi utilizzabili (oltre 60 tipi).
Alcune operazioni, come le impostazioni e il collegamento dei dispositivi, si effettuano dai comandi.

---

## 4. Gruppi

- In un gruppo possono entrare fino a **1.000 persone**.
- Per crearlo basta inserire un nome del gruppo. Gli inviti si fanno dal «collegamento di invito al gruppo». Chi riceve il collegamento può partecipare inserendo il proprio nome.
- Anche nei gruppi si possono inviare file, ma il limite è più piccolo, circa 50KB. I messaggi vocali nei gruppi non si possono ancora inviare.
- Se c'è un membro che usa una versione vecchia dell'app, in quel gruppo non si può usare il nuovo metodo più sicuro (gruppo v5) e sullo schermo compare un avviso. Diventa attivo quando tutti aggiornano all'ultima versione.

---

## 5. Chiamate

- Si possono fare chiamate vocali e videochiamate individuali. Ci sono anche le chiamate di gruppo.
- **Codice di conferma della chiamata**: sullo schermo della chiamata viene mostrato un codice di conferma. Leggetelo a vicenda e verificate che coincida su entrambi gli schermi. Se non coincide, è possibile che qualcuno stia ascoltando lungo il percorso. In tal caso, interrompi la chiamata.
- Una chiamata di gruppo potrebbe non poter iniziare se l'app di tutti non è l'ultima versione.

---

## 6. Più dispositivi e account

- Per usare la stessa identità su più dispositivi, collega i dispositivi tra loro con il comando `/link`.
- Si possono creare più account e usarli separatamente (per esempio lavoro e uso personale). Sia il numero di dispositivi sia il numero di account sono gratuiti e illimitati.
- **Come creare un account**: apri le Impostazioni e tocca il pulsante «Aggiungi account» nella sezione «Account». Inserisci un nome e scegli un'emoji come icona, e il nuovo account verrà creato e passerai automaticamente a esso.
- **Come cambiare account**: quando hai due o più account, in cima all'elenco dei contatti compaiono le schede degli account. Tocca una scheda per cambiare account (su un computer puoi usare anche Ctrl+1–9). Tieni premuta una scheda per rinominarla, cambiarne l'icona o eliminarla.
- Ogni account ha i propri contatti e le proprie chiavi. Scambia i contatti separatamente per ciascun account.
- La lingua viene scelta automaticamente tra 8 lingue: inglese, giapponese, coreano, cinese (Taiwan), spagnolo, tailandese, indonesiano e portoghese (Brasile).

---

## 7. Impostazioni per restare al sicuro

- **Blocco automatico**: c'è un'impostazione che blocca automaticamente quando cambi scheda.
- **Frase segreta della chiave**: puoi proteggere la chiave dentro il tuo dispositivo avvolgendola con una frase segreta. Ti verrà chiesto di inserirla quando apri l'app.
- **Blocco**: puoi bloccare un interlocutore molesto. I messaggi di un interlocutore bloccato non ti arriveranno.

---

## 8. Backup e recupero (il capitolo più importante)

L'identità di Breeze è solo la chiave dentro il tuo dispositivo. Sul server non c'è un elenco degli account, e nemmeno chi lo ha creato possiede la tua chiave.
**Se perdi il tuo dispositivo, perdi anche la tua identità.** Per un'identità importante, crea sempre un backup.

### Come creare un backup

1. Scegli «Crea backup».
2. Imposta una frase segreta per il backup (6 caratteri o più).
3. Scegli dove salvarlo.
   - **Salvare in un file**: conserva il file di backup nelle tue mani (consigliato).
   - **Salvare su un server di inoltro**: si può usare solo quando il gestore di quel relè lo ha attivato. Sul relè predefinito non si può usare. C'è un periodo di conservazione, quindi recuperalo entro la scadenza.

Il contenuto del backup è cifrato. Il server della destinazione tratta solo il testo cifrato.

### Come recuperare

Su un nuovo dispositivo, ripristina usando il file di backup (oppure il backup sul server di inoltro) e la frase segreta che hai impostato.

### Note

- **Se dimentichi la frase segreta, il recupero è impossibile.** Nemmeno chi lo ha creato può rimediare. Annotati la frase segreta in un altro luogo.
- **L'identità usa e getta non torna indietro, né con il backup né con il recupero.**
- Ricrea il backup quando le tue identità aumentano o quando cambi dispositivo.

---

## 9. La casella di deposito e il modo di pensare i costi

- Le lettere per quando l'altra persona è offline vengono conservate, cifrate così come sono, nella «casella di deposito» del server di inoltro (al massimo 7 giorni).
- Il relè ha dei limiti per prevenire gli abusi (la quantità e la frequenza depositabili). Quando si raggiunge il limite, per quel periodo non si possono depositare nuove lettere, ma **le lettere già arrivate non scompaiono mai**. Sullo schermo vengono mostrati il motivo e il tempo di attesa.
- Se lo installi sul tuo server, i limiti li decidi tu.

Portata delle registrazioni che restano lato server (tutte vengono eliminate automaticamente e il contenuto non può essere letto):

| Cosa | Periodo di permanenza |
|---|---|
| Lettere non consegnate | Al massimo 7 giorni |
| Segnali di connessione | 5 minuti |
| Registrazioni di indirizzi e dispositivi | 90 giorni |
| Informazioni sui gruppi e sottoscrizioni alle notifiche | 30 giorni |

---

## 10. Come aggiornare (versione desktop)

1. Quando c'è una nuova versione, sullo schermo compare un avviso.
2. Premendo «Scarica», va a prendere la nuova versione (non si installa automaticamente).
3. Quando il download è terminato, premi «Installa» e riavvia.

Se qualcosa fallisce durante l'aggiornamento (per esempio, la verifica del file non coincide), **l'aggiornamento si ferma e il motivo viene mostrato sullo schermo**. Non è possibile tornare a una versione vecchia.

---

## 11. Quando qualcosa non va

| Sintomo | Cosa verificare |
|---|---|
| Non si riesce a inviare un messaggio | Verifica che l'orologio del tuo dispositivo non sia sfasato. Se l'orologio è sfasato, l'invio fallisce. |
| Non arriva all'altra persona | Attende nella casella di deposito finché l'altra persona apre l'app (al massimo 7 giorni). |
| Non si riesce a inviare un file | Verifica di non superare il limite di dimensione (50MB in individuale, circa 50KB nei gruppi) e che non sia bloccato come formato pericoloso. |
| I codici di conferma della chiamata non coincidono | Interrompi la chiamata e richiama. Non continuare mentre non coincidono. |
| Hai dimenticato la frase segreta | Il recupero è impossibile. Crea una nuova identità e avvisa di nuovo i tuoi interlocutori. |
| Hai perso il dispositivo | Se hai un backup, puoi recuperare su un nuovo dispositivo. Altrimenti, sarà una nuova identità. |
| La pagina di prova non si apre (404) | Attualmente è ferma. Usa la versione app, per favore. |

Le segnalazioni di malfunzionamenti vanno alla [pagina delle Issue](https://github.com/shizukutanaka/Breeze/issues), per favore.

---

## 12. Le promesse di Breeze

- Niente annunci pubblicitari. Né dentro l'app, né da nessuna parte.
- Nessun tracciamento. Nessuna analisi dell'uso, nessun meccanismo pubblicitario, nessuna vendita di dati.
- Chi lo ha creato non possiede i dati degli utenti. Lato server non esiste nemmeno un elenco degli account.
- Le conversazioni sono cifrate tra i dispositivi. Il server tratta solo buste che non può leggere.

Il confronto dettagliato con altri messenger è scritto nella «pagina di confronto» del repository, inclusi i punti in cui Breeze perde (il numero di utenti, il non aver ricevuto una verifica esterna, ecc.).

---

*Questo manuale corrisponde al contenuto al momento di Breeze v3.8.0.*
