# Guide d'auto-hébergement

**Lire dans une autre langue** : [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · Français (cette page) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


Il y a deux manières de faire tourner un relais Breeze :

1. **Auto-hébergé (Node + Docker)** — le relais sur votre propre machine ou
   VPS : un conteneur, un volume de données, inscription fermée par
   défaut. Commencez ici si le relais est pour vous et vos proches.
2. **Cloudflare** — le déploiement de style officiel sur l'offre
   gratuite de Cloudflare (le relais que Breeze lui-même fait tourner). Commencez là si vous voulez
   un relais public sans serveur à entretenir.

Les deux exécutent exactement le même code de traitement ; un relais est une boîte aux lettres
simple et interchangeable dans les deux cas, et chaque client fonctionne avec
chaque relais.

## Auto-hébergé avec Docker

```bash
# 1. Get the code
git clone https://github.com/shizukutanaka/Breeze.git && cd Breeze

# 2. Start it, with your own Breeze ID admitted (see "Registration"
#    below for how to find it — you can also start closed-to-everyone
#    and add IDs later)
BREEZE_ALLOWLIST=<your Breeze ID> docker compose up -d

# 3. Watch the first-boot log — it prints your relay identity
#    fingerprint; write it down (see "Relay identity")
docker compose logs breeze
```

Le relais sert du HTTP en clair sur le port 8787 à l'intérieur du conteneur.
**Terminez TLS à un proxy inverse devant lui** (Caddy, nginx,
Traefik, un Cloudflare Tunnel, …) : les navigateurs n'utiliseront un relais
que par HTTPS/WSS. Quand vous le faites, définissez `TRUST_PROXY: "true"` dans
`docker-compose.yml` afin que la limitation de débit se fonde sur l'adresse réelle du
client — et ne le définissez jamais sans un tel proxy, car l'en-tête
auquel il fait confiance peut être falsifié par quiconque peut atteindre directement l'entrée.

Exécutez exactement **un** conteneur sur le volume de données : le limiteur
de débit est en mémoire par processus et les opérations de chaque boîte aux lettres sont
sérialisées dans ce processus, donc une seconde réplique ne conserverait
aucune de ces deux propriétés. Montez en charge en donnant au processus unique une machine plus grosse.

### Inscription : fermée par défaut

Un relais auto-hébergé sur lequel n'importe qui sur internet pourrait s'inscrire
recréerait l'économie du spam et des abus que les limites du relais officiel
existent pour contrôler, donc **le paquet Docker est livré fermé** : le
fichier compose transmet un `REGISTRATION_ALLOWLIST` (éventuellement vide) et
seuls les ID Breeze qui y figurent peuvent *créer des comptes* (un premier téléversement de
prekey). Fermer l'inscription n'affecte jamais les personnes déjà hébergées sur
le relais — leurs téléversements, dépôts, rendez-vous et interrogations ne sont
pas filtrés — et ouvrir l'inscription est un choix explicite, jamais la
valeur par défaut.

- **Votre ID Breeze** est l'identifiant de 12 caractères de votre lien d'invitation
  (les 12 premiers caractères de sa valeur `pub`). Demandez à chaque personne
  que vous invitez le sien de la même manière — l'ID est un identifiant public
  que les contacts échangent déjà, pas un secret.
- **Admettez des personnes** en énumérant leurs ID : définissez
  `BREEZE_ALLOWLIST=id1,id2,…` dans votre shell ou un fichier `.env` à côté de
  `docker-compose.yml`, puis `docker compose up -d` à nouveau.
- **Commencez maintenant, admettez plus tard** : sans `BREEZE_ALLOWLIST` défini, le
  relais fonctionne fermé à tout le monde — le journal de démarrage le dit — et personne
  ne peut s'inscrire tant que vous n'ajoutez pas d'ID.
- **Relais ouvert** (n'importe qui peut s'inscrire) : décommentez
  `REGISTRATION_OPEN: "1"` dans `docker-compose.yml`. Si vous le faites, l'économie des abus vous appartient.

### Quota d'utilisation : désactivez-le sur votre propre relais

Le worker est livré avec un **quota d'utilisation équitable** activé : par
boîte aux lettres, au maximum 10 000 dépôts/jour et 200 000/mois (un dépôt est
un cycle complet de livraison — voir `docs/COST_MODEL.md` §10 pour la
politique et les chiffres). Ce cadre existe pour le *relais par défaut partagé*,
qui est exploité comme une entrée gratuite dont les coûts variables
l'exploitant supporterait sinon pour tout le monde. **Sur un relais que vous exploitez
pour vous et vos proches, le cadre est inutile — désactivez-le** :

```bash
USAGE_QUOTA_ENABLED=false
```

Définissez-le là où votre relais lit son environnement (le shell ou
`.env` à côté de `docker-compose.yml`, l'environnement du processus Node,
ou les secrets de Cloudflare Pages). Deux réglages voisins existent si vous
exploitez un relais communautaire et que vous *voulez* un cadre :
`USAGE_QUOTA_DAILY` et `USAGE_QUOTA_MONTHLY` réajustent les plafonds.
Remarques qui comptent :

- Le quota n'est appliqué que lorsque les boîtes aux lettres vivent dans des Durable
  Objects (`MAILBOX_BACKEND=do`, la valeur par défaut sur cet hôte) ; sur le
  backend KV, c'est un no-op documenté.
- Le plafond dépassé, les expéditeurs reçoivent un `429 USAGE_QUOTA_EXCEEDED` explicite
  (avec la fenêtre et sa limite) au lieu d'une suppression silencieuse — le
  message reste dans la boîte d'envoi de l'expéditeur, et le destinataire reste
  joignable en P2P et via tout autre relais d'origine.

### Identité du relais

Au premier démarrage, le relais génère une clé d'identité Ed25519 persistante
*à l'intérieur du volume de données* et imprime son empreinte dans le journal :

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

L'empreinte identifie *votre* relais : donnez-la à vos utilisateurs
hors bande (en personne, par un autre canal) afin qu'ils puissent reconnaître
le relais qu'on leur a remis comme celui que vous exploitez. La même empreinte
s'imprime à chaque démarrage ; si elle change un jour, le volume de données a été
remplacé — enquêtez avant de dire aux utilisateurs de faire confiance à la nouvelle.

Les clients vérifient et épinglent cette clé automatiquement (étape 2, pas 4) : au
premier contact, un client défie le relais de signer avec la clé
(`/api/relay/attest`), stocke la clé vérifiée avec le compte, et
la revérifie à chaque session ultérieure. L'empreinte que le client affiche
(dans `/security`, et dans le toast lors du premier épinglage) est dérivée de
la même clé — comparez-la avec la ligne du journal de démarrage ci-dessus. Si la clé
change un jour, les clients **cessent de parler au relais** et avertissent
l'utilisateur ; ils ne ré-épinglent jamais en silence. Traitez un changement d'empreinte comme un
événement de rupture : il n'y a pas de bouton « faire confiance à la nouvelle clé » dans l'application au
pas 4, donc, après une vraie perte du volume, vos utilisateurs doivent effacer les
données stockées de l'application pour leur compte et ré-épingler au premier contact —
annoncez la nouvelle empreinte hors bande d'abord, sinon ils ne pourront pas distinguer
votre nouvelle clé de celle d'un attaquant.

### Sauvegarde et restauration

**Le volume de données est l'état entier du relais** : un fichier SQLite
contenant l'annuaire, les boîtes aux lettres et la clé d'identité du relais.
Il n'y a rien d'autre à sauvegarder.

```bash
# Back up: copy the database out of the (stopped) container
docker compose stop
docker cp "$(docker compose ps -aq breeze)":/data/breeze-relay.db ./breeze-relay-backup.db
docker compose start

# Restore: copy the backup back in as /data/breeze-relay.db before
# starting, and the relay serves identically — same fingerprint.
docker compose stop
docker cp ./breeze-relay-backup.db "$(docker compose ps -aq breeze)":/data/breeze-relay.db
docker compose start
```

### Mise à jour

```bash
git pull origin main
docker compose up -d --build
```

L'état vit dans le volume, pas dans l'image, donc la mise à jour ne touche jamais
les données de vos utilisateurs.

## Auto-hébergé avec Node nu (sans Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

La configuration se fait uniquement par variables d'environnement — `server/README.md`
les énumère toutes. Deux différences avec la voie Docker :

- Le **fichier de données** par défaut est `./breeze-relay.db` (modifiable avec
  `BREEZE_DB_PATH`) ; c'est le même état en un seul fichier, identité du relais
  incluse. Sauvegardez-le de la même manière : arrêter, copier, redémarrer.
- **L'inscription est ouverte sauf si vous la fermez** : la valeur fermée par défaut
  est une propriété du paquet Docker. Pour fermer une entrée nue, définissez
  `REGISTRATION_ALLOWLIST=id1,id2` (ou une valeur vide pour
  fermé à tout le monde) ; `REGISTRATION_OPEN=1` la rouvre explicitement.

## Déploiement Cloudflare

### Déploiement minimal (0 $/mois, 5 minutes)

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Deploy
wrangler pages deploy . --project-name=breeze

# 4. Create a KV namespace and declare it in wrangler.toml
wrangler kv:namespace create KV
# Copy the new namespace's ID and put it in wrangler.toml, replacing the
# id in the [[kv_namespaces]] section (binding = "KV"). Pages takes its
# bindings from wrangler.toml; a binding set only in the Dashboard is
# NOT applied while a wrangler.toml exists.
# Then deploy again so the binding takes effect:
wrangler pages deploy . --project-name=breeze

# 5. Visit https://breeze.pages.dev
```

**C'est tout.** Toutes les fonctions marchent, sauf les notifications push. Notez
que l'inscription sur un déploiement Cloudflare est **ouverte** sauf si vous
définissez `REGISTRATION_ALLOWLIST` vous-même (voir `.env.example`) ; le
paquet fermé par défaut est la voie Docker ci-dessus.

### Ce qui fonctionne à 0 $

| Fonction | État | Remarques |
|---------|--------|-------|
| Discussion chiffrée E2E | ✓ | Double Ratchet complet |
| Messagerie P2P | ✓ | WebRTC DataChannel |
| Appels vocaux/vidéo | ✓ | WebRTC + STUN gratuit |
| Relais TURN | ✓ | Open Relay (20 Go/mois gratuits) |
| Groupes (100 membres) | ✓ | Sender Key O(1) |
| Transfert de fichiers | ✓ | Jusqu'à 50 Mo via P2P |
| 8 langues | ✓ | EN + 7 locales complètes, détection automatique |
| Hors ligne/PWA | ✓ | Service Worker |
| Notifications push | ✗ | Nécessite des clés VAPID |

La facturation multi-comptes (Lite/Plus/Pro) n'est pas disponible — voir
la section « Removed: multi-account billing » de [SECURITY.md](../../SECURITY.md). Chaque compte obtient
des sous-comptes locaux illimités gratuitement, sans contrôle par formule.

### Limites de l'offre gratuite

| Ressource | Offre gratuite | Usage par utilisateur actif |
|----------|-----------|----------------------|
| Requêtes Worker | 100 000/jour | ~500/jour (interrogations + signalisation) |
| Lectures KV | 100 000/jour | ~200/jour |
| Écritures KV | 1 000/jour | ~350/jour (optimisé) |
| Stockage KV | 1 Go | ~10 Ko/utilisateur |
| Ressources statiques | Illimité | ~400 Ko (un seul HTML) |

**Prend en charge ~3 utilisateurs actifs simultanés sur l'offre gratuite.**

### Ajouter des fonctions optionnelles

#### Notifications push (gratuit)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Serveur TURN (pour les réseaux restrictifs)

TURN est la manière dont les appels et les connexions par relais seul (masquant l'IP) traversent
les NAT restrictifs. Le TURN que votre relais distribue est **votre** choix en tant
qu'exploitant — le Worker essaie, dans l'ordre :

```bash
# Option A: Cloudflare Calls ($0.05/GB, global anycast)
wrangler pages secret put TURN_KEY_ID
wrangler pages secret put TURN_KEY_API_TOKEN

# Option B: your own coturn (HMAC time-limited credentials — the Worker
# mints a 24h username/credential per registered user from the secret)
#   coturn: use-auth-secret, static-auth-secret=<same secret>
wrangler pages secret put TURN_URL      # turn:your-server:3478
wrangler pages secret put TURN_SECRET

# Option C: static credentials (metered.ca, Twilio, …)
wrangler pages secret put TURN_URL
wrangler pages secret put TURN_USERNAME
wrangler pages secret put TURN_CREDENTIAL

# Option D: No config → free Open Relay (20GB/month). This is a third
# party's PUBLIC quota, shared with every unconfigured relay — fine for
# a first run, not a foundation. Opt out explicitly and callers get
# STUN only (some restrictive-NAT calls will then fail, visibly):
wrangler pages secret put TURN_OPENRELAY_FALLBACK   # set to: false
```

**Vérifiez ce que vous avez réellement configuré :** `GET /api/health` rapporte le
mode effectif sous `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). L'ancien booléen `turn` ne reflète que
`TURN_URL`, donc il indique `false` pour l'option A recommandée — utilisez
`turnProvider`. Les clients affichent le même fournisseur dans `/security`, donc un
utilisateur sur le repli Open Relay peut voir qu'un tiers relaie le
média de son appel (métadonnées seulement — le média lui-même est chiffré en DTLS-SRTP).

#### Durcissement de l'authentification et voie de relais simple héritée

Les téléversements de prekey conservent désormais la propriété de signature séparément dans
`prekey-owner:<userId>` **sans TTL**. La propriété des lots existants migre paresseusement
au téléversement suivant, avant qu'un remplacement soit accepté. Les nouveaux lots Ed25519
établissent aussi cet enregistrement. Conservez ces enregistrements lorsque vous élaguez les lots de prekey expirés :
attendre l'expiration d'un lot ne doit pas permettre un nouveau propriétaire. La rotation exige un
téléversement signé par le propriétaire précédent, liant la nouvelle clé dans le condensé de téléversement existant. Le `/account/delete` authentifié efface les deux enregistrements et peut s'authentifier
contre le propriétaire même après l'expiration du lot. Il n'y a pas de réinitialisation en cas de clé de propriétaire perdue.

Pour les comptes disposant de cet enregistrement, le téléversement et l'interrogation des messages/scellés, l'ACK scellé et
les preuves WebSocket de boîte aux lettres doivent utiliser le propriétaire durable. **Les requêtes non signées sont
rejetées même avec `PREKEY_REQUIRE_AUTH=false` ou `QUEUE_REQUIRE_AUTH=false`.**
Ces drapeaux conservent leurs valeurs par défaut et leur sémantique héritée pour les comptes
sans propriétaire ; l'acceptation explicite à `false` des requêtes de téléversement/file non signées
journalise un avertissement d'obsolescence sans contenu. Les autres drapeaux d'authentification sont inchangés.
Les WebSockets de boîte aux lettres exigent toujours des signatures pour tout le monde.

Le client attend l'initialisation de la signature avant l'activité de file, y compris le
démarrage des comptes de retour, la promotion en leader et la reconnexion. L'attente partagée est
bornée à cinq secondes. Les environnements non pris en charge continuent non signés immédiatement ;
un IDB/déballage de clé bloqué continue non signé après la borne, puis signe quand il est prêt.
Cela maintient la boucle d'interrogation en vie, ce n'est **pas** un contournement : les comptes adossés à un propriétaire ne peuvent pas
recevoir du relais tant que leur clé de signature n'est pas utilisable. Déployez les ressources client mises à jour
à côté du Worker pour éviter l'ancienne course au démarrage.

La migration ne peut pas récupérer la propriété d'un lot qui a expiré **avant** que son
propriétaire ait été conservé. La première inscription reste TOFU. Les enregistrements de propriété utilisent le
backend KV existant : la cohérence éventuelle et les écritures concurrentes ne sont pas rendues
linéarisables par ce changement. Les preuves conservent la fenêtre de fraîcheur de cinq minutes existante
et la liaison opération/charge utile ; les réessais identiques dans la fenêtre ne sont pas un
protocole de nonce à usage unique.

Les écritures de présence et l'émission d'identifiants TURN exigent déjà un compte *enregistré*
(lot de prekey présent) par défaut, et chaque client s'enregistre
automatiquement. Les battements de présence portent en plus une preuve de propriété Ed25519
(le battement signe les champs qu'il stocke), que le Worker vérifie
chaque fois qu'une est présentée — `PRESENCE_SIGN_REQUIRE_AUTH=true` rend cette
preuve obligatoire. Les autres drapeaux de signature Ed25519 restent opt-in ;
`wrangler.toml` documente chacun d'eux et pourquoi (les clients sur des environnements sans
WebCrypto Ed25519 ne peuvent pas signer du tout).

Le relais simple hérité (`/api/msg/send`, `/api/msg/poll`) est obsolète : ses
réponses portent un en-tête `Deprecation: true`, et la voie scellée est la
route par défaut pour chaque client actuel. Une fois que vous avez confirmé qu'aucun client en vie
n'a encore besoin du repli, désactivez-le complètement :

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Domaine personnalisé

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Dépasser l'offre gratuite

Quand vous dépassez l'offre gratuite (formule Workers Paid à 5 $/mois) :

| Ressource | Formule payante |
|----------|-----------|
| Requêtes Worker | 10 millions/mois |
| Écritures KV | 1 million/mois |
| Stockage KV | 1 Go inclus |
| Temps CPU | 30 secondes/requête |

Cela prend en charge **des milliers d'utilisateurs simultanés**.

### Mise à jour

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Aucune étape de construction. Aucune dépendance à installer. Déployez simplement.
