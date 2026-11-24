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
- Pour l'utiliser dans un navigateur, on utilise ce qui est hébergé sur son propre serveur (la procédure d'installation se trouve dans le document séparé « Guide d'auto-hébergement »)

Chaque fichier est accompagné d'une valeur de contrôle (SHA256SUMS.txt). Si cela vous inquiète, vous pouvez vérifier que la valeur du fichier que vous avez téléchargé correspond.

> **À propos de la page d'essai** : la page d'essai qui était publiée (breeze.pages.dev) est actuellement arrêtée (l'ouvrir donne une erreur 404). Jusqu'à son rétablissement, veuillez utiliser la version application. Ce qui est hébergé sur votre propre serveur n'est pas affecté par cet arrêt.

### Première configuration

1. Ouvrez l'application.
2. Saisissez votre nom. C'est tout, vous êtes prêt. Ni inscription, ni numéro de téléphone.

À ce moment-là, une « clé » est créée dans votre appareil. C'est votre identité elle-même.
**Il n'y a pas de liste de comptes sur le serveur.** Votre identité n'existe que dans votre appareil.
Ce point devient important dans le chapitre sur la sauvegarde (8).

### À propos de l'« identité jetable »

Si vous choisissez « identité jetable » au moment de la création, vous obtenez une identité sans aucun moyen de récupération.
Si vous perdez cet appareil, si vous le réinitialisez ou si vous effacez les données du navigateur, cette identité ne reviendra jamais.
C'est aussi indiqué à l'écran. Ne la choisissez pas pour une identité que vous utiliserez longtemps.

---

## 2. Se connecter avec quelqu'un

Il y a trois manières de se connecter avec la personne à qui vous voulez parler.

- **Donner son ID** : communiquez votre ID à l'autre personne et faites-le-lui saisir.
- **Code QR** : affichez le code QR d'invitation et faites-le scanner par l'autre personne.
- **Lien d'invitation** : copiez le message d'invitation depuis « Inviter un ami » et envoyez-le par votre moyen de contact habituel (e-mail, etc.). Quand l'autre personne ouvre le lien et saisit son nom, vous pouvez discuter aussitôt.

Si l'autre personne a aussi l'application ouverte, vous vous connectez directement et pouvez discuter.

---

## 3. Conversations

- Il suffit de saisir un message et de l'envoyer. Vous pouvez aussi envoyer des photos, des stickers et des informations de position.
- **Envoi de fichiers** : jusqu'à 50 Mo dans les conversations individuelles. Dans les groupes, c'est plus petit, environ 50 Ko.
- Les fichiers de formats dangereux, comme les fichiers exécutables, sont bloqués automatiquement.
- Quand l'autre personne n'a pas l'application ouverte, le message attend, toujours chiffré, dans une « boîte de dépôt » et lui est remis lorsqu'elle ouvre l'application. Le serveur qui transporte la boîte de dépôt ne peut pas en lire le contenu. Une lettre qui n'est jamais remise est automatiquement supprimée au bout de **7 jours au maximum**.
- L'historique des conversations peut être exporté dans un fichier et importé.

### Commandes

Si vous saisissez `/help` dans le champ de saisie, la liste des commandes utilisables s'affiche (plus de 60 types).
Certaines opérations, comme les réglages et la liaison d'appareils, se font depuis les commandes.

---

## 4. Groupes

- Un groupe peut accueillir jusqu'à **1 000 personnes**.
- Pour le créer, il suffit de saisir un nom de groupe. Les invitations se font depuis le « lien d'invitation au groupe ». Les personnes qui reçoivent le lien peuvent participer en saisissant leur nom.
- On peut aussi envoyer des fichiers dans les groupes, mais la limite est plus petite, environ 50 Ko. Les messages vocaux ne peuvent pas encore être envoyés dans les groupes.
- Si un membre utilise une ancienne version de l'application, la nouvelle méthode plus sûre (groupe v5) ne peut pas être utilisée dans ce groupe, et un avertissement s'affiche à l'écran. Elle devient active quand tout le monde passe à la dernière version.

---

## 5. Appels

- Vous pouvez passer des appels vocaux et des appels vidéo individuels. Il y a aussi des appels de groupe.
- **Code de vérification d'appel** : un code de vérification s'affiche sur l'écran de l'appel. Lisez-le à voix haute avec l'autre personne et vérifiez qu'il correspond sur les deux écrans. S'il ne correspond pas, il est possible que quelqu'un écoute en chemin. Dans ce cas, raccrochez.
- Il arrive qu'un appel de groupe ne puisse pas commencer si l'application de tout le monde n'est pas la dernière version.

---

## 6. Plusieurs appareils et comptes

- Pour utiliser la même identité sur plusieurs appareils, liez les appareils entre eux avec la commande `/link`.
- Vous pouvez créer plusieurs comptes et les utiliser séparément (par exemple travail et personnel). Le nombre d'appareils comme le nombre de comptes sont gratuits et illimités.
- **Comment créer un compte** : ouvrez les Réglages et touchez le bouton « Ajouter un compte » dans la section « Compte ». Saisissez un nom et choisissez un emoji comme icône, et le nouveau compte est créé et vous y basculez automatiquement.
- **Comment changer de compte** : lorsque vous avez deux comptes ou plus, des onglets de compte apparaissent tout en haut de la liste des contacts. Touchez un onglet pour changer de compte (sur un ordinateur, vous pouvez aussi utiliser Ctrl+1–9). Touchez longuement un onglet pour le renommer, changer son icône ou le supprimer.
- Chaque compte a ses propres contacts et ses propres clés. Échangez vos contacts séparément pour chaque compte.
- La langue est choisie automatiquement parmi 8 langues : anglais, japonais, coréen, chinois (Taïwan), espagnol, thaï, indonésien et portugais (Brésil).

---

## 7. Réglages pour rester en sécurité

- **Verrouillage automatique** : il existe un réglage qui verrouille automatiquement lorsque vous changez d'onglet.
- **Phrase secrète de la clé** : vous pouvez protéger la clé dans votre appareil en l'enveloppant d'une phrase secrète. Il vous sera demandé de la saisir lorsque vous ouvrez l'application.
- **Blocage** : vous pouvez bloquer un correspondant gênant. Les messages d'un correspondant bloqué ne vous parviendront pas.

---

## 8. Sauvegarde et récupération (le chapitre le plus important)

L'identité Breeze n'est que la clé qui se trouve dans votre appareil. Il n'y a pas de liste de comptes sur le serveur, et les personnes qui l'ont créé n'ont pas non plus votre clé.
**Si vous perdez votre appareil, vous perdez aussi votre identité.** Pour une identité importante, faites toujours une sauvegarde.

### Comment faire une sauvegarde

1. Choisissez « Créer une sauvegarde ».
2. Définissez une phrase secrète pour la sauvegarde (6 caractères ou plus).
3. Choisissez la destination.
   - **Enregistrer dans un fichier** : conservez le fichier de sauvegarde entre vos mains (recommandé).
   - **Enregistrer sur un serveur relais** : utilisable uniquement lorsque l'exploitant de ce relais l'a activé. Ce n'est pas utilisable sur le relais par défaut. Il y a une durée de conservation, donc récupérez-la avant l'échéance.

Le contenu de la sauvegarde est chiffré. Le serveur de la destination ne manipule que du texte chiffré.

### Comment récupérer

Sur un nouvel appareil, restaurez à l'aide du fichier de sauvegarde (ou de la sauvegarde sur le serveur relais) et de la phrase secrète que vous avez définie.

### Remarques

- **Si vous oubliez la phrase secrète, la récupération est impossible.** Les personnes qui l'ont créé ne peuvent pas non plus y remédier. Notez la phrase secrète à un autre endroit.
- **L'identité jetable ne revient ni par la sauvegarde ni par la récupération.**
- Refaites la sauvegarde lorsque vos identités augmentent ou lorsque vous changez d'appareil.

---

## 9. La boîte de dépôt et la manière de penser les coûts

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

## 10. Comment mettre à jour (version bureau)

1. Quand il y a une nouvelle version, un avis s'affiche à l'écran.
2. En appuyant sur « Télécharger », l'application va chercher la nouvelle version (elle ne s'installe pas automatiquement).
3. Quand le téléchargement est terminé, appuyez sur « Installer » et redémarrez.

Si quelque chose échoue pendant la mise à jour (par exemple, la vérification du fichier ne correspond pas), **la mise à jour s'arrête et la raison s'affiche à l'écran**. Il n'est pas possible de revenir à une ancienne version.

---

## 11. En cas de problème

| Symptôme | Ce qu'il faut vérifier |
|---|---|
| Un message ne peut pas être envoyé | Vérifiez que l'horloge de votre appareil n'est pas décalée. Si l'horloge est décalée, l'envoi échoue. |
| Le message n'arrive pas chez l'autre personne | Il attend dans la boîte de dépôt jusqu'à ce que l'autre personne ouvre l'application (7 jours au maximum). |
| Un fichier ne peut pas être envoyé | Vérifiez que vous ne dépassez pas la limite de taille (50 Mo en individuel, environ 50 Ko dans les groupes) et qu'il n'est pas bloqué comme format dangereux. |
| Les codes de vérification de l'appel ne correspondent pas | Raccrochez et rappelez. Ne continuez pas tant qu'ils ne correspondent pas. |
| Vous avez oublié la phrase secrète | La récupération est impossible. Créez une nouvelle identité et prévenez à nouveau vos correspondants. |
| Vous avez perdu votre appareil | Si vous avez une sauvegarde, vous pouvez récupérer sur un nouvel appareil. Sinon, ce sera une nouvelle identité. |
| La page d'essai ne s'ouvre pas (404) | Elle est actuellement arrêtée. Veuillez utiliser la version application. |

Les signalements de dysfonctionnements sont à adresser à la [page des Issues](https://github.com/shizukutanaka/Breeze/issues), s'il vous plaît.

---

## 12. Les promesses de Breeze

- Aucune publicité. Ni dans l'application, ni nulle part ailleurs.
- Aucun suivi. Aucune analyse d'utilisation, aucun mécanisme publicitaire, aucune vente de données.
- Les personnes qui l'ont créé ne détiennent pas les données des utilisateurs. Côté serveur, il n'existe même pas de liste de comptes.
- Les conversations sont chiffrées entre appareils. Le serveur ne manipule que des enveloppes qu'il ne peut pas lire.

La comparaison détaillée avec les autres messageries est écrite dans la « page de comparaison » du dépôt, y compris les points où Breeze est perdant (le nombre d'utilisateurs, le fait de ne pas avoir reçu d'audit externe, etc.).

---

*Ce manuel correspond au contenu au moment de Breeze v3.8.0.*
