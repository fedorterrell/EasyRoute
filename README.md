# Easy Route !

Une adresse, et vous obtenez un **plan d’accès A4**, une **étiquette QR** et un **message d’itinéraire** prêt à envoyer à l’équipe par WhatsApp ou e-mail.

**➜ Utiliser l’outil : https://easyroute.cloud**

Pensé pour les équipes techniques de spectacle et d’événementiel : savoir où se garer, par où décharger, où sont les loges et le catering, sans dix messages d’explication.

## Fonctions

**Plan A4 paysage** (JPG ou PNG, 3508 × 2480 px à 300 dpi)
- Vue satellite autour de l’adresse, avec les noms des rues.
- Repère rouge du lieu, que l’on peut faire glisser si la recherche l’a mal placé.
- Points utiles en couleur : accès technique / déchargement, accès personnel, catering, parking personnel, loges. Chacun a un libellé modifiable et une couleur au choix (touchez sa pastille).
- Flèches dessinées à main levée pour montrer le chemin.
- Carte QR en haut à gauche, à sa taille d’impression réelle, et carte des infos pratiques en bas à gauche.
- Logo du lieu, de la salle ou de votre entreprise en haut à droite (PNG, JPG, SVG ou WebP), en trois tailles, sur fond blanc ou non. Le dernier logo utilisé est mémorisé sur l’appareil.
- Fond au choix : satellite, ou votre propre capture d’écran (Google Maps, plan du lieu…).

**Étiquette QR seule** (PNG, JPG ou SVG cliquable), à insérer par exemple dans Trimble LayOut.
- Le QR ouvre le lieu dans **Google Maps** ou lance le guidage dans **Waze**.
- Taille du QR de 20 à 50 mm, résolution 300 ou 600 dpi.
- Logo ajouté à l’étiquette si on coche la case (au-dessus du texte, ou au-dessus du QR en disposition empilée).

**Message équipe**
- Nom de l’événement, nom du lieu, adresse et infos pratiques : Get-In (date et heure), contact sur place, parking, code d’accès, hauteur max, consignes d’accès.
- Liens d’itinéraire **Google Maps**, **Waze** et **Plans (Apple)**, plus les coordonnées GPS, pour le lieu et pour chaque point utile. Un tableau permet de choisir quels liens inclure pour chaque point, pour garder un message court ; ces choix sont mémorisés sur l’appareil.
- **Agenda** : à partir de la date et de l’heure du Get-In (durée au choix : 1, 4, 6, 8 ou 10 h ; journée entière sans heure), un lien « Ajouter à Google Agenda » dans le message, qui marche sur tous les téléphones (lien court `…/#a=…` quand la fiche a un lien court : Easy Route redirige vers Google Agenda avec la dernière version de la fiche), un lien court vers le fichier `.ics` servi par le Worker (s’ouvre dans Calendrier sur iPhone et Mac, dans Outlook ; suit lui aussi les modifications), et un fichier `.ics` (iPhone, Mac, Outlook, la plupart des Android) avec rappel 1 h avant.
- Boutons *Copier*, *Ouvrir dans WhatsApp*, *Envoyer par e-mail* et, sur téléphone, *Partager* (message + plan A4 en une fois).

**Fiche partagée**
- Le message équipe contient un **lien de fiche** court (case à cocher), du type `easyroute.cloud/#s=k7Qp2xA9bC`. L’équipier qui l’ouvre voit une page simple sur son téléphone : événement, lieu, infos pratiques (téléphone du contact cliquable), boutons Google Maps / Waze / Plans et coordonnées GPS pour le lieu et chaque point utile (les mêmes liens que ceux cochés pour le message), ajout à l’agenda, et le plan avec téléchargement en JPG.
- La fiche est rangée par un petit service Cloudflare (voir *Liens courts* plus bas) et conservée environ 13 mois après sa dernière modification. Le logo n’y figure pas.
- **Le lien reste le même quand vous modifiez la fiche** : l’équipe voit toujours la dernière version (heure de Get-In corrigée, point ajouté…). *Nouveau lien* en crée un autre, par exemple pour une autre date au même lieu ; *Nouveau lieu* et le chargement d’un lieu enregistré en créent un aussi. Seul l’appareil qui a créé le lien peut le modifier (clé secrète gardée avec la session).
- Sur la fiche équipe, toucher le plan l’ouvre **en grand**, en haute définition, avec zoom.
- Si ce service est injoignable, Easy Route met à la place un lien long qui contient toute la fiche : il fonctionne sans serveur.
- *Modifier dans Easy Route* reprend la fiche dans l’éditeur, à la place du travail en cours.

**Sessions et lieux enregistrés**
- Le travail en cours (adresse, position, points utiles, flèches, infos pratiques) est repris automatiquement à la prochaine ouverture. *Nouveau lieu* efface tout pour repartir de zéro.
- *Enregistrer ce lieu* garde une fiche complète, logo compris, que l’on recharge depuis la liste *Lieux enregistrés*. Enregistrer à nouveau un lieu du même nom le met à jour.
- Ces données restent dans le navigateur de l’appareil : elles ne sont ni envoyées en ligne, ni partagées automatiquement entre le Mac et l’iPhone. Pour les transférer, *Exporter les lieux* crée un fichier `.json` (logos compris) à ouvrir ailleurs avec *Importer des lieux…* ; à l’import, un lieu du même nom n’est remplacé que si la version importée est plus récente.

## Utilisation

À la première ouverture, un encadré **Premiers pas** rappelle les quatre étapes (chercher le lieu, vérifier le repère, placer les points utiles, envoyer à l’équipe) et les coche au fur et à mesure ; un clic sur une étape mène à l’endroit où la faire. **Voir un exemple** charge une fiche complète de démonstration (points utiles, flèche, infos pratiques) pour découvrir l’outil. Le bouton *Premiers pas*, en haut, rouvre l’encadré une fois fermé.


1. Tapez le nom du lieu et choisissez-le dans la liste proposée : l’adresse et la position se remplissent. Sinon, saisissez l’adresse : la carte se centre toute seule après une seconde. Un lien Google Maps complet collé dans *Lien personnalisé* remplit aussi le nom, l’adresse et la position.
2. Vérifiez le repère rouge et faites-le glisser si besoin.
3. Placez les points utiles (*Placer*, puis touchez le plan) et dessinez des flèches si utile.
4. Remplissez les infos pratiques à gauche.
5. Téléchargez le plan A4, ou passez à l’onglet *Message équipe* pour l’envoyer.

## Sur iPhone

Ouvrez le site dans Safari, puis *Partager* → *Sur l’écran d’accueil*. Easy Route s’ouvre alors en plein écran, comme une application.

Le bouton *Partager* envoie le plan A4 et le message ensemble vers WhatsApp, Mail ou Photos. Si WhatsApp ne garde que l’image, copiez le message séparément.

## Structure du dépôt

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page : structure et contenu (formulaire, onglets, fiche équipe). |
| `css/easyroute.css` | L’apparence : couleurs, mise en page, version téléphone. |
| `js/easyroute.js` | Tout le fonctionnement : carte, plan A4, étiquette, message, agenda, fiche partagée, sessions et lieux. |
| `js/qrcode.js` | Bibliothèque qrcode-generator 1.4.4, copiée telle quelle depuis npm (servie par le site, sans CDN). |
| `manifest.webmanifest`, `icons/` | Installation sur l’écran d’accueil (nom, icône, plein écran). |
| `tests/`, `package.json`, `playwright.config.js`, `.github/workflows/` | Tests automatiques (voir ci-dessous). |

Le site est servi par GitHub Pages depuis la branche `main`, sous le domaine `easyroute.cloud` (fichier `CNAME` ; DNS chez Cloudflare, lignes GitHub en *DNS only*). Les anciennes adresses `fedorterrell.github.io/easyroute/…` redirigent vers le domaine. Chaque fusion sur `main` met le site à jour en une à deux minutes. Aucune étape de compilation : les fichiers sont servis tels quels.

Quand `css/easyroute.css` ou `js/easyroute.js` change, changez aussi le numéro `?v=…` qui suit leur nom dans `index.html` (par exemple la date du jour). Sinon, un téléphone peut garder l’ancienne version en mémoire quelques minutes.

## Tests automatiques

Le dossier `tests/` contient des tests qui ouvrent Easy Route dans un vrai navigateur (Chromium, format ordinateur et format téléphone) et vérifient les fonctions principales : liens Google Maps et Waze, points utiles et couleurs, repère déplaçable, plan A4, logo, message équipe, agenda (.ics et Google Agenda), session, lieux enregistrés, export et import. Ils n’appellent aucun service extérieur.

Ils tournent tout seuls sur GitHub à chaque pull request et à chaque mise à jour de `main` (onglet *Actions*). Une pull request dont les tests échouent affiche une croix rouge : ne la fusionnez pas sans vérifier.

Pour les lancer sur votre Mac :

```sh
npm install
npx playwright install chromium
npm test
```

Ces fichiers ne servent qu’aux tests : le site lui-même n’a besoin d’aucune installation.

## Liens courts (Cloudflare)

Le dossier `worker/` contient le code du service qui range les fiches partagées : un Cloudflare Worker relié à une base D1 (offre gratuite).

- Adresse : `https://api.easyroute.cloud` (constante `SHORT_API` dans `js/easyroute.js`), domaine personnalisé du Worker (onglet *Domains*). L’ancienne adresse `https://easyroute-fiches.piotrskotnicki.workers.dev` répond toujours, pour les liens déjà envoyés.
- `POST /f` avec `{"d": "<fiche compressée>"}` renvoie `{"id": "…", "key": "…"}` ; `PUT /f/<id>` avec `{"d": …, "key": …}` met la fiche à jour sous le même lien ; `GET /f/<id>` renvoie la fiche ; `GET /ics/<id>` renvoie son événement d’agenda (.ics), envoyé par Easy Route avec la fiche (champ `ics`). Quiconque a le lien peut lire la fiche ; la modifier demande sa clé secrète. Les navigateurs ne peuvent créer des fiches que depuis le site Easy Route (contrôle de l’en-tête `Origin`), mais ce contrôle n’arrête pas un script : la création est donc limitée par une règle Cloudflare (voir plus bas).
- Identifiant aléatoire de 10 caractères (impossible à deviner) ; la clé secrète n’est connue que de l’appareil qui a créé la fiche, la base n’en garde qu’une empreinte.
- Fiches conservées environ 13 mois après leur dernière modification (`KEEP_DAYS`), puis effacées.
- Limite de création : règle Cloudflare *Rate limiting* « Easy Route – création de fiches » (zone `easyroute.cloud`, Sécurité > règles de limitation de débit) : chemin d’URI égal à `/f` (seul `api.easyroute.cloud` passe par Cloudflare : le site est en *DNS only*), 5 requêtes par 10 s et par adresse IP, puis blocage 10 s. Elle ne touche ni les mises à jour (`PUT /f/<id>`) ni les lectures.
- Mise à jour du service : Cloudflare > Workers & Pages > `easyroute-fiches` > *Edit code*, coller le contenu de `worker/easyroute-fiches.js`, *Deploy*. La base D1 doit rester reliée sous le nom `DB`.

## Personnaliser

- **Ajouter un type de point utile** : ajoutez une ligne à la fin du tableau `POI_TYPES` de `js/easyroute.js` (clé, nom, libellé par défaut, emoji, couleurs).
- **Police de l’étiquette** : Barlow par défaut. Le bouton *Charger une police* accepte un fichier `.ttf`, `.otf` ou `.woff2` ; la police est mémorisée dans le navigateur de l’appareil et n’est jamais envoyée en ligne. *Police par défaut* revient à Barlow. Aucune police commerciale n’est fournie dans ce dépôt.

## Services externes et crédits

- **Imagerie satellite** : [Esri World Imagery](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) et couches de référence Esri. La mention « Imagerie © Esri, Maxar, Earthstar Geographics » est imprimée sur chaque plan et doit y rester.
- **Recherche d’adresse et propositions de lieux** : [OpenStreetMap Nominatim](https://nominatim.org/) et [Photon](https://photon.komoot.io/). Données © contributeurs OpenStreetMap. L’outil ne lance une recherche qu’après une pause dans la saisie, pour respecter la [politique d’usage de Nominatim](https://operations.osmfoundation.org/policies/nominatim/) (une requête par seconde au maximum).
- **QR codes** : [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) de Kazuhiko Arase, licence MIT (copie de la version 1.4.4 dans `js/qrcode.js`, avec sa mention de licence).
- **Polices de l’interface** : Barlow et JetBrains Mono, via Google Fonts, licence SIL Open Font License.

Le travail se fait dans le navigateur. Les adresses recherchées partent vers Nominatim ou Photon, et les tuiles de carte sont demandées à Esri.

Seul le **lien de fiche court** envoie des données au service d’Easy Route (`api.easyroute.cloud`, voir *Liens courts*) : la fiche (événement, lieu, points utiles, infos pratiques, dont le téléphone du contact et le code d’accès) et son événement d’agenda, sans le logo ; toute personne qui a le lien peut la lire. Elle est envoyée et tenue à jour automatiquement dès qu’une adresse ou une position est saisie. Pour ne rien envoyer, décochez *Lien de la fiche complète dans le message* : Easy Route utilise alors le lien long, qui contient toute la fiche sans passer par le serveur, et le lien d’agenda long (sans lien `.ics`). Un lien court déjà créé reste à jour, car l’équipe l’a peut-être déjà reçu ; *Nouveau lien* arrête son envoi. Les sessions, les lieux enregistrés, les logos et les polices restent, eux, sur l’appareil.

## Limites connues

- Les liens courts `maps.app.goo.gl` ne peuvent pas être générés automatiquement (Google ne propose pas d’API pour cela). On peut en coller un à la main dans *Lien personnalisé*.
- Le QR en mode Google Maps recherche le nom et l’adresse ; il ne suit pas un repère déplacé à la main. Le mode Waze et les liens du message, eux, pointent sur le repère.
- La vue satellite et la recherche d’adresse demandent une connexion internet.

## Licence

Le code d’Easy Route est distribué sous licence [MIT](LICENSE) : vous pouvez l’utiliser, le modifier et le redistribuer librement, à condition de conserver la mention de copyright et le texte de la licence.

Cette licence ne couvre que le code d’Easy Route. La bibliothèque qrcode-generator (`js/qrcode.js`), l’imagerie Esri, les données OpenStreetMap et les polices restent soumises à leurs propres conditions (voir *Services externes et crédits*).
