# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Lire dans une autre langue** : [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · Français (cette page) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Une messagerie chiffrée, sans numéro de téléphone et sans inscription.**
Le contenu d'une conversation ne peut être lu que par la personne qui l'envoie et celle qui la reçoit. Même le serveur qui le transporte en chemin ne peut pas le lire.
Toutes les fonctions sont gratuites, et il n'y a aucune publicité.

Ce n'est pas une page web, mais un logiciel à installer et à utiliser (Windows / Mac / Linux / Android / iPhone / navigateur).

![Capture d'écran de Breeze Messenger — la fenêtre principale juste après la création d'une identité](../images/screenshot.png)

## Pour l'utiliser, vous l'hébergez sur votre propre serveur

Breeze n'a pas de « serveur d'une société exploitante ». **Pour l'utiliser, vous préparez vous-même un endroit où le faire tourner (un serveur) et vous y installez Breeze. C'est la manière officielle de l'utiliser.**

- L'installation standard utilise Cloudflare, donc **un compte Cloudflare est requis**. La procédure se trouve dans le [guide d'auto-hébergement](SELF_HOSTING-fr.md) (vous pouvez choisir d'autres langues en haut du guide).
- Les applications (Windows / Mac / Linux / Android / iPhone) s'obtiennent sur la [page de téléchargement](https://github.com/shizukutanaka/Breeze/releases/latest) et s'utilisent en les connectant à votre propre serveur.
- **À propos de l'installation de démonstration (un avis honnête)** : une démonstration permettant de vérifier le fonctionnement (https://breeze-469.pages.dev/) est mise à disposition. Ce qui y est hébergé est le même logiciel, mais pour un usage réel, veuillez utiliser votre propre serveur. La démonstration peut changer ou s'arrêter sans préavis. Ce que vous avez installé sur votre propre serveur n'est pas affecté par l'arrêt de la démonstration.

Pour l'utilisation détaillée, consultez le [manuel](MANUAL-fr.md) (vous pouvez choisir d'autres langues en haut du manuel).

## Utilisation (3 étapes)

1. Ouvrez le Breeze que vous avez hébergé sur votre propre serveur (ou l'adresse que vous a indiquée la personne qui l'a hébergé) et appuyez sur « Commencer avec un ID aléatoire » (vous pouvez saisir un nom si vous le souhaitez). C'est tout, vous êtes prêt (ni inscription, ni numéro de téléphone). À ce moment-là, une « clé » est créée dans votre appareil, et cette clé devient votre identité.
2. Donnez votre ID ou votre code QR à la personne avec qui vous voulez parler.
3. Si l'autre personne a aussi l'application ouverte, vous vous connectez directement et pouvez discuter. Quand elle ne l'a pas ouverte, le message attend, toujours chiffré, dans une « boîte de dépôt » et lui est remis lorsqu'elle ouvre l'application. Le serveur qui transporte la boîte de dépôt ne peut pas en lire le contenu. Une lettre qui n'est jamais remise est automatiquement supprimée au bout de 7 jours au maximum.

## Promesses (ce que nous ne ferons pas)

- **Aucune publicité.** Ni dans l'application, ni nulle part ailleurs.
- **Aucun suivi.** Aucune analyse d'utilisation, aucun mécanisme publicitaire, aucune vente de données.
- **Les personnes qui l'ont créé ne détiennent pas les données des utilisateurs.** Côté serveur, il n'existe même pas de liste de comptes. Votre identité est uniquement la clé qui se trouve dans votre appareil.
- **Les conversations sont chiffrées entre appareils.** Le serveur ne manipule que des enveloppes qu'il ne peut pas lire.

Nous écrivons aussi la portée honnêtement. Pour pouvoir livrer les messages, le serveur conserve des choses pendant un court moment (les enveloppes non livrées pendant 7 jours au maximum, les signaux de connexion pendant 5 minutes, les enregistrements d'adresses et d'appareils pendant 90 jours, les informations de groupe et les abonnements aux notifications pendant 30 jours. Tout cela est supprimé automatiquement, et le contenu ne peut pas être lu). La sauvegarde dans le cloud est désactivée au départ. Si vous l'hébergez sur votre propre serveur, cette conservation temporaire est aussi sous votre contrôle.

## Ce qu'il peut faire

- Conversations individuelles et conversations de groupe (jusqu'à 1 000 personnes)
- Appels vocaux et appels vidéo (appels de groupe jusqu'à 8 personnes)
- Envoi de fichiers (jusqu'à 50 Mo en individuel. Les groupes peuvent aussi en envoyer, mais la limite de taille est plus petite)
- Utilisation sur plusieurs appareils et avec plusieurs comptes (par exemple travail et personnel. Le nombre d'appareils comme le nombre de comptes sont gratuits et illimités)
- Sauvegarde automatique (quand quelque chose change, une sauvegarde chiffrée est enregistrée automatiquement sur votre propre serveur. Sur un nouvel appareil, une fois votre identité récupérée, une sauvegarde est trouvée automatiquement et vous est proposée. Les réglages vous guident aussi pour passer à un nouvel appareil)
- Un nom que vous choisissez pour chaque contact (vous pouvez renommer chaque contact, enregistré uniquement sur cet appareil. Vous pouvez aussi choisir si le nom que chaque contact s'est donné est affiché)
- 51 langues (l'anglais plus 50 fichiers de langue), choisies automatiquement selon la langue de votre appareil
- Profils avec photo, stickers, partage de position
- Commandes comme `/help` (71 types)
- Modes d'énergie adaptés à votre batterie (automatique / normal / économie d'énergie / urgence). Quand la batterie baisse, les vérifications de réception s'espacent pour que la batterie dure plus longtemps. Une sauvegarde pour les catastrophes et les autres moments où vous ne pouvez pas recharger
- Des écrans lisibles (attention au contraste des couleurs, à la taille du texte et à l'utilisation au clavier seul)

## Différences avec les autres messageries

| | Breeze | Beaucoup de messageries |
|---|--------|--------|
| Inscription | Inutile (l'identité est la clé dans votre appareil) | Numéro de téléphone requis |
| Serveur | Ne peut pas lire le contenu | Repose sur la confiance envers la société exploitante |
| Hébergement sur son propre serveur | C'est le principe (c'est fait pour être hébergé et utilisé) | Impossible |
| Publication du fonctionnement interne | Tout est public (licence MIT) | Souvent non public |
| Emplacement des données | Dans votre appareil | Sur les serveurs de la société exploitante |

La comparaison détaillée avec Signal et LINE se trouve sur la [page de comparaison (en anglais)](../COMPARISON.md). Chaque affirmation de Breeze est accompagnée d'une « manière de la vérifier », et les points où Breeze est perdant (le nombre d'utilisateurs, le fait de ne pas avoir reçu d'audit externe, etc.) y sont aussi écrits sans être cachés.

## Le coût d'un hébergement sur votre propre serveur

Breeze fonctionne dans les limites de l'offre gratuite de Cloudflare. Aucune carte bancaire n'est requise.

| Élément | Offre gratuite | En payant |
|-----------|-----------|-------------|
| Hébergement | Cloudflare Pages (gratuit) | — |
| Traitement | Jusqu'à 100 000 fois par jour | Jusqu'à 10 millions de fois par mois |
| Stockage | Par jour, jusqu'à 100 000 lectures et 1 000 écritures | Par mois, 10 millions de lectures et 1 million d'écritures |
| Relais des appels | Gratuit jusqu'à 20 Go | 0,05 dollar par Go |
| Domaine personnalisé | Inutile (une adresse gratuite est fournie) | 10 dollars par an |
| **Total** | **0 dollar par mois** (jusqu'à environ 20 à 40 personnes avec un usage léger) | **À partir de 5 dollars par mois** (environ 100 personnes avec un usage léger. À l'échelle de 1 000 personnes, de 34 à 222 dollars par mois selon l'usage) |

La manière dont les coûts augmentent à grande échelle, et « pourquoi un seul exploitant n'a pas à porter le coût de tout le monde », se trouvent dans [la réflexion sur les coûts et la durabilité (en anglais)](../SUSTAINABILITY.md) ; les calculs qui la fondent sont dans le [modèle de coûts (en anglais)](../COST_MODEL.md).

L'installation commence par cette unique commande (détails dans le [guide d'auto-hébergement](SELF_HOSTING-fr.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Détails techniques (pour les développeurs)

### Méthodes de chiffrement

| Rôle | Méthode |
|-------|-----------|
| Échange de clés | X25519 (repli : P-256) |
| Signature | Ed25519 (repli : HMAC-SHA256) |
| Chiffrement | AES-256-GCM |
| Dérivation de clés | HKDF-SHA256 |
| Renouvellement des clés de conversation | Double Ratchet (la même méthode que Signal) |
| Clés de groupe | Sender Key |
| Masquage de l'expéditeur au relais | Sealed Sender |

Le document de référence de la conception est la [spécification, SPEC.md](../../SPEC.md) ; la destination des signalements de faiblesses et la politique se trouvent dans [SECURITY.md](../../SECURITY.md).

### Tests et contrôles qualité

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Participer au développement

La manière de procéder et les règles se trouvent dans [CONTRIBUTING.md](../../CONTRIBUTING.md).
Les rapports de bugs vont sur la [page des Issues](https://github.com/shizukutanaka/Breeze/issues). Le code de conduite est [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Licence

MIT — comme indiqué dans [LICENSE](../../LICENSE), vous pouvez l'utiliser, le corriger et le distribuer librement.
