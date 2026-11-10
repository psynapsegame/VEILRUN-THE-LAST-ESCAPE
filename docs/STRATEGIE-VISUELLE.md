# VEILRUN — Stratégie visuelle à budget 0 €

Document d'audit et de proposition. **Aucune refonte n'est commencée** : il attend une validation.
Légende des preuves : **[vérifié]** = j'ai téléchargé le fichier et lu sa licence ; **[non vérifié]** = site bloqué depuis mon environnement, information issue de résultats de recherche, à confirmer avant usage.

## 1. Audit de la direction artistique actuelle

| Défaut | Cause |
|---|---|
| Décors « cubes empilés » | Tout est assemblé par code à partir de boîtes, cylindres et cônes, sans biseaux, moulures ni reliefs |
| Matières plates | Une seule petite texture de briques générée, pas de relief (normal map), pas de reflets, pas d'usure |
| Lumière sans profondeur | Un soleil + une lumière d'ambiance uniforme ; pas d'éclairage par l'environnement, pas de rayons, brouillard uniforme |
| Image « brute » | Aucun post-traitement (halo des sources lumineuses, étalonnage des couleurs) |
| Palette monotone | Orange partout ; pas de contraste chaud/froid, les accents violet/cyan sont posés sans logique |
| Personnage cartoon | Modèle à grosse tête, vu de dos il se réduit à une capuche violette |
| Pas d'échelle | Tout est à hauteur d'homme et collé à la route ; rien de monumental, pas de vide, pas de lointains travaillés |
| Décor muet | Répétition aléatoire d'objets ; aucune mise en scène, aucun événement |

Ce qui est sain et sera conservé : simulation, commandes, générateur, tests, pooling, qualité adaptative, compilation Android.

## 2. Ressources gratuites évaluées

### Récupérables dès maintenant (GitHub), licence CC0, aucune attribution exigée

| Ressource | Lien | Contenu utile | Verdict |
|---|---|---|---|
| Quaternius — Modular Character Outfits Fantasy (version gratuite) **[vérifié]** | https://github.com/Mesh2Motion/mesh2motion-assets (dossier `CC0-packs/Quaternius`) | Tenue « Ranger » homme et femme, textures PBR | **Héros retenu**, voir §3 |
| Quaternius — Universal Animation Library 1 et 2 (versions gratuites) **[vérifié]** | https://github.com/2600th/Kinema (dossier `public/assets/models`) | 88 animations : sprint, saut (départ/vol/réception), glissade (entrée/boucle/sortie), roulade, coups reçus, mort, repos | **Animations retenues** |
| Polygonal Mind — packs « tomb-chaser-1 », « crystal-crossroads » **[vérifié]** | https://github.com/ToxSam/cc0-models-Polygonal-Mind | Colonnes, arches, obélisque, têtes de dieux, jarres, palmier, escaliers, murs à hiéroglyphes | Style cartoon low-poly (voir `docs/visuel/kits-libres-apercu.png`). **Accessoires secondaires seulement** |
| HDRI coucher de soleil 1k | https://github.com/mrdoob/three.js (`examples/textures/equirectangular/venice_sunset_1k.hdr`) | Éclairage d'environnement | Solution d'attente ; origine Poly Haven probable mais **non confirmée** dans le dépôt |
| Kenney, KayKit (miroirs GitHub) | https://github.com/BAMOUMOHAMED/kinetale-library | Palmiers, rochers, bannières | Low-poly à aplats, miroir non officiel : **écarté** sauf besoin ponctuel |

Les copies Quaternius viennent de dépôts tiers qui embarquent le fichier de licence CC0 d'origine. Je copierai ce fichier dans notre dépôt avec les modèles. Un site tiers affirme que Quaternius adopterait une nouvelle licence pour ses futurs packs ; je n'ai trouvé aucune confirmation, et les fichiers déjà publiés en CC0 le restent.

### Nécessitent d'autoriser des sites (gratuit) — tout est CC0, sans attribution **[non vérifié]**

| Source | Sites à autoriser | Ce que j'y prendrais |
|---|---|---|
| Poly Haven — https://polyhaven.com | `api.polyhaven.com`, `dl.polyhaven.org` | Textures PBR : `sandstone_blocks_08`, `large_sandstone_blocks_01`, `white_sandstone_bricks`, `sandstone_cracks`, `red_sandstone_pavement`, `patterned_paving`, `marble_01`. HDRI : `rogland_sunset` (désert au couchant), `qwantani_sunset_puresky`. Modèles : `marble_bust_01` (buste, pour un colosse), rochers `rock_boulder_dry`, `rock_face_01`, plantes `fern_02`, `shrub_03`, vases et lampes en laiton |
| ambientCG — https://ambientcg.com | `ambientcg.com` | Or : `Metal034` ou `Metal048A` ; dallages `PavingStones…` ; sable |

Les noms exacts seront confirmés en interrogeant leurs catalogues dès que l'accès est ouvert. Aucun modèle de colonne, d'arche ou de palmier n'a été trouvé chez Poly Haven : l'architecture ne viendra pas de là.

### Téléchargement manuel par toi (compte Sketchfab gratuit) — optionnel **[non vérifié]**

Licence CC-BY 4.0 : usage commercial autorisé, **crédit obligatoire** (titre, auteur, licence, lien) dans un écran « Crédits » du jeu.

| Modèle | Auteur | Lien |
|---|---|---|
| Statue de sphinx (scan) | Sofia Nasopoulou | https://sketchfab.com/3d-models/egyptian-style-sphinx-statue-9003a8376d7444bfb435391333116ef7 |
| Obélisque égyptien | Zambur | https://sketchfab.com/3d-models/egyptian-obelisk-88d990ba831648728850517056169939 |
| Ancient Ruins Pack | Toni García Vilche | https://sketchfab.com/3d-models/ancient-ruins-pack-4dad3b80562842f88d6568c5e1c469c2 |
| Egyptian tomb asset pack (26 pièces) | dreadwolf_entertainment | https://sketchfab.com/3d-models/egyptian-tomb-asset-pack-00849e5ba3004841963146512c3a09a1 |

La licence est à relire sur chaque page au moment du téléchargement.

### Écartés

- **Mixamo** : compte Adobe obligatoire, et les fichiers bruts ne peuvent pas être redistribués (problème si le dépôt GitHub est public). Inutile : les animations Quaternius couvrent le besoin.
- **Ready Player Me** : service fermé début 2026 d'après les résultats de recherche.
- Tout modèle en licence NC (non commercial), ND, ou à licence illisible : scans du Louvre, buste de Néfertiti de Berlin, collections du British Museum.

## 3. Personnage principal proposé

**Le « Ranger » de Quaternius, animé par l'Universal Animation Library.** Aperçu réel, rendu ici avec les animations appliquées : `docs/visuel/heros-candidat.png` (rangée du haut : vue de dos comme en jeu ; rangée du bas : vue de face ; poses : repos, sprint ×2, saut, glissade, roulade, chute).

- Proportions humaines réalistes, tenue détaillée (capuche, plastron de cuir, ceintures, brassards, bottes à sangles, épaulière métal), textures PBR.
- Squelette identique entre la tenue et les animations **[vérifié]** : sprint, saut, glissade, roulade et chute fonctionnent déjà dans mon test.
- Correspondance avec le jeu : course → `Sprint_Loop` ; saut → `Jump_Start` / `Jump_Loop` / `Jump_Land` ; glissade → `Slide_Start` / `Slide_Loop` / `Slide_Exit` ; dash destructeur → `Roll` ou charge d'épaule ; mort → `Hit_Knockback` puis `Death01`.
- Travail à faire : recoloration aux couleurs de SOLARIS (lin clair, ocre, or, turquoise) pour qu'il se détache de la pierre ; allègement de 27 000 à environ 12 000 triangles et textures de 4K à 1K pour le mobile ; écharpe animée pour la silhouette.
- Limites : la tenue n'a pas de tête (l'intérieur de la capuche est sombre). De dos, cas normal du jeu, cela ne se voit pas ; de face (menu, sélection) il faudra greffer la tête du corps de base gratuit par script, ou assumer un visage masqué. Pas d'animation « course sur mur » dans la version gratuite.

## 4. Construire SOLARIS

Constat honnête : **il n'existe pas de kit gratuit d'architecture antique monumentale de qualité** utilisable tel quel. La qualité viendra donc de trois sources combinées :

1. **Architecture générée par code, mais dessinée comme de l'architecture** : colonnes galbées à chapiteaux papyriformes (profils tournés), fûts cannelés, corniches à gorge, pylônes à murs inclinés, escaliers monumentaux, portiques, ponts sur arches, blocs biseautés et ébréchés. Fini les boîtes nues.
2. **Matières photographiées** (Poly Haven, ambientCG) : grès en blocs, dallages, marbre, or. Relief par normal map, usure, reflets. C'est le plus gros gain visuel.
3. **Reliefs gravés originaux** : frises et glyphes dessinés par code (propres à VEILRUN) convertis en relief pour murs, linteaux et socles.

| Rôle | Solution |
|---|---|
| Route | Chaussée surélevée en dalles de grès, bordures sculptées, incrustations d'or ; tronçons en pont au-dessus du vide |
| Temples, pylônes, colonnades | Kit procédural + textures de grès |
| Statues monumentales | Colosses à partir de scans CC0 agrandis (buste Poly Haven ; sphinx Sketchfab si tu le télécharges) ; têtes de dieux Polygonal Mind seulement au loin |
| Végétation | Palmiers et buissons refaits avec feuillages texturés ; fougères et arbustes Poly Haven dans les jardins |
| Tissus, braseros | Bannières et voiles animés par le vent (shader), braseros en laiton avec flammes et braises |
| Arrière-plans | Trois plans : monuments proches, cité à mi-distance, silhouettes géantes dans la brume ; **le Dévoreur** aperçu au loin par moments |
| Obstacles | Redessinés dans le même langage : fût effondré, linteau bas, statue tombée, herse solaire |
| Événements | Colonnes qui basculent, pont qui se disloque derrière le coureur, nuées de sable |

## 5. Shaders, éclairage et effets

- **Éclairage par l'environnement (HDRI)** : toute la scène reçoit la lumière dorée du ciel ; l'or reflète réellement.
- **Soleil rasant + ombres** : une ombre portée de qualité près du joueur, ombres simplifiées au loin.
- **Brouillard de hauteur teinté par le soleil** : la brume s'accumule en contrebas et s'embrase vers le soleil ; c'est ce qui donne l'échelle.
- **Rayons de lumière** entre les colonnes : volumes translucides animés (peu coûteux), pas de vrai calcul volumétrique.
- **Halo lumineux (bloom) et étalonnage** en une passe, à demi-résolution, uniquement sur les niveaux graphiques moyen et haut.
- **Occlusion ambiante pré-calculée** dans les modèles (aucun coût en jeu).
- **Poussière dorée, sable soulevé, braises, gravats**.
- **Animation par shader** : tissus, palmes, miroitement de chaleur léger.

## 6. Architecture technique

- `assets-src/` : sources téléchargées + un registre `LICENCES.md` (nom, auteur, licence, lien, date) ; `tools/` : chaîne de préparation (réduction des textures, compression KTX2/WebP, compression des maillages, simplification).
- `src/assets/` : fichiers optimisés livrés avec le jeu ; chargeur avec écran de chargement et barre de progression.
- `src/view/kit/` : pièces d'architecture ; `src/view/solaris/` : assemblage en tronçons mis en scène (prépare le générateur par segments de la Phase 3).
- Rendu : instanciation (une colonne dessinée 200 fois = un seul appel), deux niveaux de détail + silhouettes plates au loin, trois profils graphiques (bas : sans ombres ni post-traitement, textures 512 ; moyen ; haut).
- Budgets visés : moins de 150 appels de rendu, moins de 250 000 triangles visibles, moins de 40 Mo de textures en mémoire, moins de 25 Mo de téléchargement pour SOLARIS.

## 7. Difficultés et risques

| Risque | Conséquence | Parade |
|---|---|---|
| Pas de logiciel de modélisation de mon côté | Impossible de sculpter statues et formes organiques ; elles dépendent de scans gratuits | Architecture par code ; scans pour les statues |
| Matériaux PBR coûteux sur téléphones modestes | Chute sous 60 FPS | Profils graphiques, matériaux simplifiés en profil bas |
| Post-traitement | Coût fixe par image | Demi-résolution, désactivé en profil bas |
| **Je ne peux tester sur aucun téléphone réel** | Les performances annoncées ne sont pas mesurées | Toi : relevé avec l'affichage de diagnostic à chaque étape |
| Poids | Chargement plus long ; le lien de test actuel (fichier unique) devra passer en plusieurs fichiers | Compression, chargement progressif |
| Miroirs GitHub tiers | Peuvent disparaître | Copie des fichiers et des licences dans notre dépôt |
| Plafond réel | Niveau « beau jeu mobile d'aventure stylisé », **pas** Uncharted ni Genshin Impact (équipes de centaines d'artistes) | Miser sur lumière, matière, échelle et mise en scène |

## 8. Plan de réalisation

Chaque étape se termine par une version jouable et des captures, pour validation avant la suivante.

| Étape | Contenu | Besoin de ta part |
|---|---|---|
| A — Héros | Ranger intégré, recoloré, toutes ses animations enchaînées | Rien |
| B — Lumière et matière | HDRI, grès PBR sur la route et un portique témoin, brouillard, bloom, étalonnage | Autoriser Poly Haven et ambientCG |
| C — Kit SOLARIS | Colonnes, pylônes, colonnades, escaliers, ponts, statues ; obstacles redessinés | Optionnel : télécharger 1 à 4 modèles Sketchfab |
| D — Vie et mise en scène | Bannières, palmiers, braseros, rayons, poussière, effondrements, Dévoreur | Rien |
| E — Performance | Profils graphiques, niveaux de détail, compression, écran de chargement | Test sur ton téléphone |
