# Manuel de Breeze

**Lire dans une autre langue** : [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · Français (cette page) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze est une messagerie chiffrée, sans numéro de téléphone et sans inscription.
Le contenu d'une conversation ne peut être lu que par la personne qui l'envoie et celle qui la reçoit. Même le serveur qui le transporte en chemin ne peut pas le lire.
Toutes les fonctions sont gratuites, et il n'y a aucune publicité.

Ce manuel est un guide pour les personnes qui commencent à l'utiliser.

---

## 1. Pour commencer

### Obtenir l'application

Choisissez sur la [page de téléchargement](https://github.com/shizukutanaka/Breeze/releases/latest) celui qui correspond à votre machine.

- Windows : celui dont le nom se termine par `-win-x64.exe` (il en existe aussi pour les machines ARM)
- Mac : celui dont le nom se termine par `-mac.dmg`
- Linux : `.AppImage` (exécutable tel quel) ou `.deb`
- Pour l'utiliser dans un navigateur, on utilise ce qui est hébergé sur son propre serveur (la procédure d'installation se trouve dans le document séparé « Guide d'auto-hébergement »). L'installation standard utilise Cloudflare, donc un compte Cloudflare est requis

Chaque fichier est accompagné d'une valeur de contrôle (SHA256SUMS.txt). Si cela vous inquiète, vous pouvez vérifier que la valeur du fichier que vous avez téléchargé correspond.

### Première configuration

1. Ouvrez l'application.
2. Appuyez sur « Commencer avec un ID aléatoire ». C'est tout, vous êtes prêt. Ni inscription, ni numéro de téléphone.

- Si vous saisissez « Votre nom (nom d'affichage) » dans le champ au-dessus du bouton, vous commencez avec ce nom. Vous pouvez aussi appuyer sur le bouton avec le champ vide. Vous pouvez changer le nom d'affichage plus tard, dans la section profil des réglages.
- Il existe aussi un moyen de créer une identité avec un nom et un ID Breeze que vous choisissez vous-même. Dans ce cas, une phrase de récupération est émise et affichée à l'écran. La phrase de récupération, ce sont les mots qui vous permettent de retrouver cette identité sur un autre appareil. Notez-la sur papier ou dans un endroit sûr.
- Si vous voulez retrouver une identité que vous avez créée auparavant, ouvrez « Restaurer un compte existant » et les méthodes de récupération (restaurer depuis un fichier de sauvegarde, récupérer avec une phrase de récupération, restaurer avec compte + phrase secrète) apparaissent.
- Quand la création se termine, une carte apparaît pour vous guider afin de protéger votre clé par une phrase secrète (elle ne disparaît pas au bout d'un moment). Pour une identité importante, suivez le guide et ajoutez la protection.

À ce moment-là, une « clé » est créée dans votre appareil. C'est votre identité elle-même.
**Il n'y a pas de liste de comptes sur le serveur.** Votre identité n'existe que dans votre appareil.
Ce point devient important dans le chapitre sur la sauvegarde (9).

### À propos de l'ancienne « identité jetable »

L'« identité jetable » — une identité sans aucun moyen de récupération — a disparu. Avec les manières actuelles de créer une identité, chaque identité peut être protégée par une sauvegarde.

---

## 2. Se connecter avec quelqu'un

Appuyez sur le bouton « Ajouter un ami » sur l'écran des correspondants et trois choix apparaissent.

- **Ajouter un correspondant** : saisissez l'ID de l'autre personne, ou scannez un code QR.
- **Inviter un ami** : copiez le lien d'invitation et envoyez-le par votre moyen de contact habituel (e-mail, etc.). Quand l'autre personne ouvre le lien et saisit son nom, vous pouvez discuter aussitôt.
- **Créer un groupe** : il suffit de saisir un nom de groupe pour en créer un (chapitre 4).

Votre propre ID s'affiche sous sa forme complète lorsque vous ouvrez votre propre profil, et vous pouvez le copier tel quel. Vous pouvez transmettre l'ID complet, pas seulement l'ID court.

Si l'autre personne a aussi l'application ouverte, vous vous connectez directement et pouvez discuter.

---

## 3. Conversations

- Il suffit de saisir un message et de l'envoyer. Vous pouvez aussi envoyer des photos, des stickers et des informations de position.
- Ouvrez le « + » à côté du champ de saisie et les pièces jointes, les messages vocaux, la saisie vocale, les informations de position, les stickers, le réglage « pas de réponse nécessaire » et davantage apparaissent ensemble.
- **Envoi de fichiers** : jusqu'à 50 Mo dans les conversations individuelles. Dans les groupes, c'est plus petit, environ 50 Ko.
- Les fichiers de formats dangereux, comme les fichiers exécutables, sont bloqués automatiquement.
- Quand l'autre personne n'a pas l'application ouverte, le message attend, toujours chiffré, dans une « boîte de dépôt » et lui est remis lorsqu'elle ouvre l'application. Le serveur qui transporte la boîte de dépôt ne peut pas en lire le contenu. Une lettre qui n'est jamais remise est automatiquement supprimée au bout de **7 jours au maximum**.
- L'historique des conversations peut être exporté dans un fichier et importé.

### Lire l'écran

- **État d'envoi** : on peut le savoir grâce à la marque à côté d'un message. ✓ signifie envoyé, un ✓ dans un cercle signifie qu'il a été déposé dans la boîte de dépôt, ✓✓ signifie qu'il est arrivé chez l'autre personne, lu est une marque bleue et l'échec est une marque rouge. Ils se distinguent par la forme autant que par la couleur.
- **La liste des correspondants** : l'heure de la dernière discussion s'affiche comme l'heure pour aujourd'hui, « Hier » pour hier, mois/jour pour cette année et année/mois/jour pour tout ce qui est plus ancien. Les correspondants dont vous n'avez pas lu les messages ont leur nom et leur heure mis en valeur.
- **Noms pour les contacts** : ouvrez « Informations du contact » (dans le menu contextuel d'un contact, ou le menu « ⋮ » de la conversation) et vous pouvez définir votre propre nom pour ce contact (un surnom). Les surnoms sont enregistrés uniquement sur cet appareil et ne sont jamais envoyés au contact ni au serveur relais. Quand vous définissez un surnom, le nom que le contact s'est donné est aussi affiché à côté, dans une couleur atténuée. Vous pouvez désactiver ce second nom avec « Afficher aussi le nom que chaque contact s'est donné » dans la section « Confidentialité » des réglages.
- **Votre propre carte** : en haut de la liste se trouve votre carte de profil ; touchez-la pour ouvrir votre profil. Elle défile avec la liste.
- **Onglets inférieurs sur un téléphone** : À la largeur d'un téléphone, cinq onglets apparaissent en bas de l'écran : « Discussions », « Appels », « Contacts », « Ma carte » et « Réglages ». Vous pouvez choisir quels onglets sont affichés, un par un, dans « Onglets inférieurs » des réglages (Discussions est toujours affiché. Même si vous masquez l'onglet Réglages, vous pouvez toujours ouvrir les réglages depuis le bouton d'engrenage de l'écran).
- **L'en-tête de la conversation** : depuis l'icône de recherche, vous pouvez chercher dans la conversation. Depuis le menu « ⋮ », vous pouvez vérifier le numéro de sécurité, couper les notifications, épingler, créer un sondage, et plus encore.

### Commandes

Saisissez `/` dans le champ de saisie et des suggestions de commandes apparaissent. Saisissez `/help` pour voir la liste des commandes que vous pouvez utiliser (71 types).
Certaines opérations, comme les réglages et la liaison d'appareils, se font depuis les commandes.

---

## 4. Groupes

- Un groupe peut accueillir jusqu'à **1 000 personnes**.
- Pour le créer, il suffit de saisir un nom de groupe sous « Créer un groupe » dans « Ajouter un ami » (vous pouvez aussi en créer un avec la commande `/newgroup`). Les invitations se font depuis le « lien d'invitation au groupe ». Les personnes qui reçoivent le lien peuvent participer en saisissant leur nom.
- On peut aussi envoyer des fichiers dans les groupes, mais la limite est plus petite, environ 50 Ko. Les messages vocaux ne peuvent pas encore être envoyés dans les groupes.
- Si un membre utilise une ancienne version de l'application, la nouvelle méthode plus sûre (groupe v5) ne peut pas être utilisée dans ce groupe, et un avertissement s'affiche à l'écran. Elle devient active quand tout le monde passe à la dernière version.

---

## 5. Appels

- Vous pouvez passer des appels vocaux et des appels vidéo individuels. Il y a aussi des appels de groupe (jusqu'à 8 personnes).
- **Code de vérification d'appel** : un code de vérification s'affiche sur l'écran de l'appel. Lisez-le à voix haute avec l'autre personne et vérifiez qu'il correspond sur les deux écrans. S'il ne correspond pas, il est possible que quelqu'un écoute en chemin. Dans ce cas, raccrochez.
- Il arrive qu'un appel de groupe ne puisse pas commencer si l'application de tout le monde n'est pas la dernière version.
- **Historique des appels** : Les appels individuels laissent un historique uniquement sur cet appareil (l'autre personne, s'il s'agissait d'un appel sortant / entrant / manqué, l'heure et la durée de l'appel. Rien de ce qui a été dit n'est conservé). L'historique n'est jamais envoyé à un serveur ni à l'autre personne. Jusqu'à 200 entrées sont conservées, les plus anciennes étant supprimées en premier. Les appels de groupe n'apparaissent pas dans l'historique.
- Ouvrez l'historique depuis l'onglet « Appels » sur un téléphone. Lorsqu'un appel manqué n'a pas encore été vu, un badge numéroté apparaît sur l'onglet Appels, et il disparaît lorsque vous ouvrez l'historique. Depuis une ligne de l'historique, vous pouvez ouvrir la conversation avec cette personne ou la rappeler. Vous pouvez supprimer tout l'historique avec un bouton sur l'écran.
- **L'historique des appels ne fait pas partie d'une sauvegarde.** Sur un nouvel appareil, l'historique commence vide. Si vous ne voulez pas qu'un historique soit conservé, désactivez « Conserver un historique des appels sur cet appareil » dans la section « Confidentialité » des réglages, et l'enregistrement lui-même s'arrête.

---

## 6. Plusieurs appareils et comptes

- Pour utiliser la même identité sur plusieurs appareils, liez les appareils entre eux avec la commande `/link`.
- Vous pouvez créer plusieurs comptes et les utiliser séparément (par exemple travail et personnel). Le nombre d'appareils comme le nombre de comptes sont gratuits et illimités.
- **Comment créer un compte** : appuyez sur le bouton « + » à côté des onglets de comptes, tout en haut de la liste des correspondants. Saisissez un nom et choisissez un emoji d'icône, et un nouveau compte est créé et sélectionné automatiquement.
- **Changer de compte** : les onglets de comptes sont toujours affichés tout en haut de la liste des correspondants. Touchez-en un pour changer (sur un ordinateur, vous pouvez aussi changer avec Ctrl+1–9). Touchez un onglet longuement pour le renommer, changer son icône ou le supprimer.
- Les contacts et les clés sont séparés pour chaque compte. Échangez à nouveau les contacts pour chaque compte.
- La langue est choisie automatiquement parmi 51 langues, anglais compris, selon la langue de votre appareil.

---

## 7. Réglages pour rester en sécurité

Les réglages s'ouvrent comme leur propre écran. Sur un téléphone, ouvrez-les depuis l'onglet « Réglages » en bas de l'écran ; sur un ordinateur, depuis le bouton engrenage de l'écran (vous pouvez aussi les ouvrir avec la commande `/settings`). Utilisez l'action de retour pour revenir à l'écran où vous étiez.

- **Verrouillage automatique** : il existe un réglage qui verrouille automatiquement lorsque vous changez d'onglet.
- **Phrase secrète de la clé** : vous pouvez protéger la clé dans votre appareil en l'enveloppant d'une phrase secrète. Il vous sera demandé de la saisir lorsque vous ouvrez l'application.
- **Afficher aussi le nom que chaque contact s'est donné** : dans la section « Confidentialité ». Pour un contact auquel vous avez donné un surnom, vous pouvez choisir si son propre nom est affiché à côté (chapitre 3).
- **Blocage** : vous pouvez bloquer un correspondant gênant. Les messages d'un correspondant bloqué ne vous parviendront pas.
- **Conserver ou non un historique des appels** : Avec « Conserver un historique des appels sur cet appareil » dans la section « Confidentialité », vous pouvez arrêter l'enregistrement de l'historique des appels (chapitre 5).
- **Visibilité des onglets inférieurs** : Dans la section « Onglets inférieurs », vous pouvez afficher ou masquer les onglets inférieurs du téléphone (Appels / Contacts / Ma carte / Réglages) un par un. Discussions est toujours affiché.

---

## 8. Batterie et urgences (modes d'énergie)

Dans le réglage « Mode d'énergie », vous pouvez choisir la manière dont la batterie est utilisée.

- **Automatique (niveau de batterie)** : bascule automatiquement selon la batterie restante.
- **Normal** : comme d'habitude.
- **Économie d'énergie** : espace les vérifications de réception jusqu'à une fois toutes les 60 secondes au maximum, et arrête le signal de présence.
- **Urgence (pour les catastrophes)** : espace les vérifications de réception jusqu'à une fois toutes les 10 minutes au maximum. Utilisez-le lors d'une catastrophe ou d'un autre moment où vous ne pouvez pas recharger.

Ce qui use la batterie, ce n'est pas la quantité de communication, mais le nombre de fois où la radio se réveille. Le côté qui envoie n'est donc pas espacé ; seul le côté qui écoute l'est. L'envoi part toujours aussitôt, comme toujours. Quand vous commencez à charger, il revient automatiquement d'un pas vers le côté plus léger.

Sur les appareils qui ne peuvent pas lire automatiquement le niveau de batterie (comme un navigateur sur iPhone), « Automatique » se comporte comme Normal, et un choix manuel fonctionne comme choisi.

---

## 9. Sauvegarde et récupération (le chapitre le plus important)

L'identité Breeze n'est que la clé qui se trouve dans votre appareil. Il n'y a pas de liste de comptes sur le serveur, et les personnes qui l'ont créé n'ont pas non plus votre clé.
**Si vous perdez votre appareil, vous perdez aussi votre identité.** Pour une identité importante, faites toujours une sauvegarde.

La sauvegarde et la récupération se font depuis la section « Sauvegarde et restauration » des réglages (les boutons sont « Créer une sauvegarde », « Restaurer une sauvegarde » et « 📂 Restaurer depuis un fichier »). La première fois que vous ajoutez un correspondant, une carte vous invitant à faire une sauvegarde apparaît une seule fois.

### Sauvegarde automatique

Le réglage « Sauvegarde automatique » est activé dès le départ. Quand vos données changent, une sauvegarde chiffrée est envoyée automatiquement au serveur relais que vous hébergez.

- Elle n'envoie pas à chaque changement : elle attend 30 secondes après le dernier changement et envoie tout ensemble. Les tentatives sont espacées d'au moins 15 minutes.
- Quand vous êtes hors ligne, rien n'est envoyé ; les changements sont gardés et envoyés quand la connexion revient et quand vous ouvrez l'application.
- Pour l'envoi automatique, vous devez saisir la phrase secrète de la sauvegarde une fois sur cet appareil (quand c'est nécessaire, un bouton « Saisir la phrase secrète » apparaît dans la section des réglages). **La phrase secrète n'est pas enregistrée.** Elle n'est gardée en mémoire que tant que l'application est ouverte, et disparaît quand vous la fermez. Pour une identité à récupération simple, juste après avoir saisi la phrase secrète à l'inscription ou à la mise à jour, l'envoi fonctionne tel quel.
- Si le serveur relais ne prend pas en charge l'enregistrement des sauvegardes, la sauvegarde automatique ne fonctionne pas. C'est indiqué dans la section des réglages.
- L'état (la date du dernier envoi réussi, s'il y a des changements en attente, si un envoi a échoué) est affiché dans la section des réglages.

### Comment faire une sauvegarde (manuelle)

1. Depuis « Sauvegarde et récupération » dans les réglages, choisissez « Créer une sauvegarde ».
2. Définissez une phrase secrète pour la sauvegarde (6 caractères ou plus).
3. Choisissez la destination.
   - **Enregistrer dans un fichier** : conservez le fichier de sauvegarde entre vos mains (recommandé).
   - **Enregistrer sur un serveur relais** : utilisable uniquement lorsque l'exploitant de ce relais l'a activé. Ce n'est pas utilisable sur le relais par défaut. Il y a une durée de conservation, donc récupérez-la avant l'échéance.

Le contenu de la sauvegarde est chiffré. Le serveur de la destination ne manipule que du texte chiffré.

### Comment récupérer

Sur un nouvel appareil, restaurez à l'aide du fichier de sauvegarde (ou de la sauvegarde sur le serveur relais) et de la phrase secrète que vous avez définie.

Si vous venez de retrouver votre identité avec une phrase de récupération et qu'une sauvegarde de cette identité se trouve sur le serveur relais, elle est trouvée automatiquement et on vous le demande avec « Sauvegarde trouvée ». Si vous la restaurez, les données de cet appareil sont remplacées par le contenu de la sauvegarde.

### Passer à un nouvel appareil

Appuyez sur le bouton « Passer à un nouvel appareil » dans la section « Sauvegarde et restauration » des réglages et les étapes s'affichent.

1. Sur votre appareil actuel, gardez une sauvegarde sur le serveur relais (sauvegarde automatique, ou « Créer une sauvegarde »).
2. Sur le nouvel appareil, choisissez une méthode de restauration sur le premier écran et saisissez votre phrase de récupération (ou votre nom de compte et votre phrase secrète).
3. Quand votre identité est de retour, la sauvegarde sur le serveur est trouvée automatiquement et une restauration vous est proposée.

Aucun câble ni transfert de fichier n'est nécessaire.

### Remarques

- **Si vous oubliez la phrase secrète, la récupération est impossible.** Les personnes qui l'ont créé ne peuvent pas non plus y remédier. Notez la phrase secrète à un autre endroit.
- La saisie de la phrase secrète pour la sauvegarde automatique est nécessaire sur chaque appareil. Sur un nouvel appareil, saisissez-la encore une fois.
- Refaites manuellement la sauvegarde lorsque vos identités augmentent ou lorsque vous changez d'appareil.
- L'historique des appels ne fait pas partie d'une sauvegarde. Lorsque vous changez d'appareil, l'historique des appels ne se transfère pas vers le nouvel appareil.

---

## 10. La boîte de dépôt et la manière de penser les coûts

- Les lettres pour le moment où l'autre personne est hors ligne sont conservées, toujours chiffrées, dans la « boîte de dépôt » du serveur relais (7 jours au maximum).
- Le relais a des limites pour empêcher les abus (la quantité et la fréquence qui peuvent être déposées). Quand la limite est atteinte, vous ne pouvez plus déposer de nouvelles lettres pendant cette période, mais **les lettres déjà arrivées ne disparaissent jamais**. L'écran affiche la raison et le temps d'attente.
- Si vous l'hébergez sur votre propre serveur, c'est vous qui décidez des limites.

Portée des enregistrements qui restent côté serveur (tous sont supprimés automatiquement, et le contenu ne peut pas être lu) :

| Élément | Durée de conservation |
|---|---|
| Lettres non livrées | 7 jours au maximum |
| Signaux de connexion | 5 minutes |
| Enregistrements d'adresses et d'appareils | 90 jours |
| Informations de groupe et abonnements aux notifications | 30 jours |

---

## 11. Comment mettre à jour (version bureau)

1. Quand il y a une nouvelle version, un avis s'affiche à l'écran.
2. En appuyant sur « Télécharger », l'application va chercher la nouvelle version (elle ne s'installe pas automatiquement).
3. Quand le téléchargement est terminé, appuyez sur « Installer » et redémarrez.

Si quelque chose échoue pendant la mise à jour (par exemple, la vérification du fichier ne correspond pas), **la mise à jour s'arrête et la raison s'affiche à l'écran**. Il n'est pas possible de revenir à une ancienne version.

---

## 12. En cas de problème

| Symptôme | Ce qu'il faut vérifier |
|---|---|
| Un message ne peut pas être envoyé | Vérifiez que l'horloge de votre appareil n'est pas décalée. Si l'horloge est décalée, l'envoi échoue. |
| Le message n'arrive pas chez l'autre personne | Il attend dans la boîte de dépôt jusqu'à ce que l'autre personne ouvre l'application (7 jours au maximum). |
| Un fichier ne peut pas être envoyé | Vérifiez que vous ne dépassez pas la limite de taille (50 Mo en individuel, environ 50 Ko dans les groupes) et qu'il n'est pas bloqué comme format dangereux. |
| Les codes de vérification de l'appel ne correspondent pas | Raccrochez et rappelez. Ne continuez pas tant qu'ils ne correspondent pas. |
| Vous avez oublié la phrase secrète | La récupération est impossible. Créez une nouvelle identité et prévenez à nouveau vos correspondants. |
| Vous avez perdu votre appareil | Si vous avez une sauvegarde, vous pouvez récupérer sur un nouvel appareil. Sinon, ce sera une nouvelle identité. |

Les signalements de dysfonctionnements sont à adresser à la [page des Issues](https://github.com/shizukutanaka/Breeze/issues), s'il vous plaît.

---

## 13. Les promesses de Breeze

- Aucune publicité. Ni dans l'application, ni nulle part ailleurs.
- Aucun suivi. Aucune analyse d'utilisation, aucun mécanisme publicitaire, aucune vente de données.
- Les personnes qui l'ont créé ne détiennent pas les données des utilisateurs. Côté serveur, il n'existe même pas de liste de comptes.
- Les conversations sont chiffrées entre appareils. Le serveur ne manipule que des enveloppes qu'il ne peut pas lire.

La comparaison détaillée avec les autres messageries est écrite dans la « page de comparaison » du dépôt, y compris les points où Breeze est perdant (le nombre d'utilisateurs, le fait de ne pas avoir reçu d'audit externe, etc.).

---

*Ce manuel reflète l'état de Breeze au 25 novembre 2026.*
