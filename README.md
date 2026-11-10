# VEILRUN — THE LAST ESCAPE

Endless runner 3D mobile. Ce dépôt contient la **Phase 1 (prototype de gameplay)** : un coureur articulé, trois voies, obstacles, collisions, commandes tactiles, caméra, environnement SOLARIS, son procédural, sauvegarde locale.

## Jouer / développer

```bash
npm install
npm run dev          # serveur local ; ouvrir l'adresse « Network » depuis un téléphone sur le même Wi-Fi
npm test             # tests automatisés (gameplay, collisions, générateur, gestes, sauvegarde)
npm run build        # version web dans dist/
npm run build:single # dist/veilrun.html : tout le jeu dans un seul fichier
npm run android:sync # copie le jeu dans le projet Android (android/)
```

Commandes : glisser ←/→ changer de voie, ↑ sauter, ↓ glisser (en l'air : plongeon), double-tap ou bouton DASH : dash qui traverse les obstacles. Clavier : flèches, espace, P.
Diagnostic de performances : toucher la ligne de version du menu, ou ajouter `?debug` à l'adresse.

## Choix technique (et pourquoi pas Unity)

Le cahier des charges recommande Unity. L'environnement de production utilisé (conteneur cloud Linux sans écran) n'a pas Unity, ne peut pas le télécharger (hôte bloqué) et ne pourrait de toute façon pas piloter son éditeur ni sa licence. Écrire un projet Unity « à l'aveugle » aurait produit du code jamais compilé ni testé.

Le jeu est donc construit en **TypeScript + Three.js (WebGL)**, emballé en application native par **Capacitor** (iOS et Android). Tout ce qui est annoncé ici a été réellement exécuté : tests automatisés, puis jeu lancé dans Chromium en émulation iPhone avec de vrais événements tactiles.

Conséquence à connaître : passer à Unity plus tard serait une réécriture du rendu (les règles de jeu, l'équilibrage et les tests se transposent). Le plafond visuel du WebGL mobile est plus bas que celui d'Unity URP, mais largement suffisant pour un runner stylisé à 60 FPS.

## Architecture

```
src/sim/      Simulation pure, sans rendu, déterministe (pas fixe 120 Hz)
  config.ts     réglages : vitesses, saut, glissade, volumes de collision
  player.ts     machine à états course / saut / glissade, voies, tampons d'entrée
  track.ts      générateur procédural à « voie sûre » + validateur indépendant
  game.ts       une partie : collisions balayées, fragments, dash, score, événements
  bot.ts        joueur de référence pour prouver que les parcours sont jouables
src/input/    Reconnaissance des gestes (swipes, double-tap), testable hors navigateur
src/view/     Rendu Three.js : personnage articulé, SOLARIS, particules, caméra, pools
src/audio/    Musique générative et effets, 100 % procéduraux (aucun sample)
src/ui/       Menu, HUD, pause, résultat (DOM/CSS)
src/save.ts   Sauvegarde locale versionnée, interface de stockage remplaçable (cloud plus tard)
android/      Projet Android Studio (Capacitor)
tests/        Vitest
```

Principes : la simulation ignore le rendu (donc testable et rejouable par graine — base du Défi quotidien) ; aucun objet créé pendant la course (pools d'obstacles, particules en tampon circulaire, géométries partagées) ; qualité adaptative par niveaux (voir ci-dessous).

## État réel — Phase 1

Fait et vérifié :
- Course automatique, 3 voies, saut, glissade, plongeon, dash, vitesse progressive (11 → 34 m/s).
- 3 familles d'obstacles (à sauter, à passer dessous, à contourner), fragments, score, record.
- Générateur : toujours une voie praticable, fenêtre de réaction ≥ 0,85 s à toute vitesse. Vérifié sur 200 graines × 20 km, et par un joueur automatique qui survit 6 km sur 25 graines.
- Gestes tactiles vérifiés en émulation iPhone 13 (swipes, double-tap, boutons, pause, reprise, sauvegarde après rechargement).
- Projet Android généré ; un workflow GitHub Actions compile l'APK de test.

Pas encore fait / non vérifié :
- **Aucun test sur appareil physique.** Les FPS réels sur téléphone ne sont pas mesurés.
- **iOS** : nécessite un Mac avec Xcode et un compte Apple Developer ; projet iOS pas encore généré.
- Le personnage et les décors sont modélisés par code (stylisés, originaux). Ce ne sont pas encore des modèles sculptés/riggés de qualité finale : ce sera l'objet de la Phase 2 (assets glTF).
- Course sur murs, câbles, vol plané, boss, autres univers, progression, boutique : phases suivantes.

## Qualité graphique adaptative

Cinq niveaux, du plus beau au plus léger : 0 rayons de soleil + lueur + étalonnage ; 1 lueur + étalonnage ; 2 ombres seules ; 3 ombre simple, résolution ×1,6 ; 4 ombre simple, résolution ×1,3. Les effets sautent en premier, la netteté en dernier. `src/quality.ts` décide (testé) : rien n'est mesuré pendant le chargement ni juste après un changement, un niveau n'est abandonné qu'après 2,5 s de lenteur continue, un meilleur niveau est retenté après 25 s de fluidité et définitivement écarté s'il ne tient pas. Le dernier niveau qui a fonctionné est mémorisé sur l'appareil. Diagnostic : toucher la ligne de version du menu (images par seconde, résolution, niveau).

## Refonte visuelle (budget 0 €) — avancement

La stratégie complète, les ressources et leurs licences sont dans `docs/STRATEGIE-VISUELLE.md` ; le registre des ressources tierces est `assets-src/LICENCES.md`.

| Étape | Contenu | État |
|---|---|---|
| A — Héros | « Teal Sentinel » : aventurier encapuchonné aux proportions humaines, généré avec Meshy d'après les images Gemini, 10 700 triangles, 0,9 Mo ; animations : course rapide (cadence liée à la vitesse), saut (phase en l'air de l'animation de saut), dash (course plus rapide, inclinée, lueur), glissade (assis sur le dos, pieds en avant, tirée de l'animation de chute), mort (chute) | fait, vérifié dans le navigateur ; pas de roulade ni de vraie glissade dans la bibliothèque utilisée |
| B — Lumière et matière | Éclairage par image de ciel (HDRI), grès et marbre photographiés, or réfléchissant, brume de hauteur dorée vers le soleil, halo lumineux, étalonnage | fait, vérifié dans le navigateur ; performances sur téléphone non mesurées |
| C — Kit SOLARIS | Route en chaussée surélevée au-dessus de la cité ; kit d'architecture (colonnes à chapiteaux, colonnades, temple à grand escalier, pylônes, obélisques, braseros, jardins de palmiers, ruines, tours, colosses provisoires) ; porte monumentale au soleil ailé ; monuments d'arrière-plan ; trois obstacles redessinés | fait, vérifié dans le navigateur. Statues sculptées en attente (voir `docs/MESHY-PROMPTS.md`) ; ponts au-dessus du vide reportés à l'étape D |
| D — Vie et mise en scène | Bannières au vent, tronçons de pont ouverts sur la cité, colonnes qui s'effondrent au passage (poussière, secousse, grondement), Dévoreur qui surgit derrière la cité sur les ponts, rayons de soleil découpés par l'architecture (profil haut), poussière dorée et sable soufflé | fait, vérifié dans le navigateur. Le Dévoreur est une silhouette provisoire ; fresques et motifs de bannières en attente d'images (`docs/GEMINI-PROMPTS.md`) |
| Intégration des statues et de l'art 2D | Colosse, sphinx, tête brisée, brasero et idole sculptés (Meshy), fresque et frise murales, bannières brodées, panorama de la cité, Dévoreur illustré, icône de l'application, écran de démarrage avec barre de progression réelle | fait, vérifié dans le navigateur ; les dix pièces Meshy sont intégrées (cinq statues, plus pylône, palmiers, cristal, porte solaire, colonne tombée) ; les cinq statues : colosse, sphinx, tête brisée dans les ruines, brasero sculpté dans la cour du brasero, idole gardienne comme obstacle (collision ajustée à sa largeur) |
| E — Performance | Profils graphiques, niveaux de détail, compression, écran de chargement | à faire |

L'architecture est construite par code (kit dessiné comme de l'architecture) ; les statues, fresques, bannières, panorama et Dévoreur viennent d'images et de modèles générés. Chaînes de préparation : `tools/build-hero.mjs` (héros : `node tools/build-hero.mjs`, depuis `assets-src/hero-meshy/`), `tools/inspect-anim.mjs` (squelette et animations d'un fichier), `tools/build-statue.mjs` (statues : `node tools/build-statue.mjs entrée.glb sortie.glb 9000`), `tools/build-art.mjs` (images 2D), `tools/build-icons.mjs` (icônes et écrans de lancement), `tools/inspect-glb.mjs` (contrôle d'un modèle). `tests/assets.test.ts` garde les budgets mobiles.

## Plan de production

| Phase | Contenu | État |
|---|---|---|
| 1 | Prototype de gameplay | livrée |
| 2 | Vertical slice SOLARIS : modèles glTF définitifs, animations, ombres, destruction, bande-son | en cours (voir ci-dessous) |
| 3 | Générateur par segments, événements, embranchements | à faire |
| 4 | Mécaniques avancées : murs, câbles, vol plané, bonus | à faire |
| 5 | Six univers, portails sans chargement, six boss | à faire |
| 6 | Personnages, collections, améliorations, missions, succès | à faire |
| 7 | Interface complète, audio, finition | à faire |
| 8 | Builds iOS/Android, optimisation sur appareils physiques | à faire |
| 9 | Achats réels (StoreKit / Play Billing), confidentialité, fiches boutiques | à faire |

## Obstacles sculptés et collisions

Les volumes de collision suivent les modèles : colonne tombée 0,62 m de haut sur 1,7 m de large (à sauter), porte solaire dont la poutre commence à 1,4 m (à passer en glissant, le coureur glisse à 0,7 m et se tient à 1,7 m), idole 1,24 m de large (à contourner). Au-delà de 62 m, les obstacles utilisent des versions très légères.

## Courbe de difficulté

La difficulté monte sans palier sur toute la course (`src/sim/config.ts`, `src/sim/track.ts`, testée dans `tests/difficulty.test.ts`) :

| Distance | Écart entre obstacles | Obstacles par minute | Voie sûre qui exige une action | Vitesse |
|---|---|---|---|---|
| 0–500 m | 1,7 s | 36 | 24 % | 11 → 15 m/s |
| 1,5–2,5 km | 1,4 s | 43 | 41 % | 20 → 25 m/s |
| 3,5–4,5 km | 1,2 s | 51 | 61 % | 28 → 30 m/s |
| 6–7 km | 1,0 s | 61 | 84 % | 31 → 32 m/s |
| 9–10 km | 0,9 s | 65 | 85 % | 33 m/s |

À partir de 400 m apparaissent des rafales de 2 à 5 obstacles au rythme le plus serré, suivies d'un répit ; à partir de 500 m la voie sûre peut traverser deux voies d'un coup quand l'écart le permet ; un saut est le plus souvent suivi d'une glissade. Après 6 km les répits raccourcissent et les rafales s'allongent pendant 4 km de plus. Le temps de réaction minimal entre deux rangées (0,87 s) ne baisse jamais, et un validateur indépendant vérifie sur 300 parcours de 30 km qu'une route existe toujours ; un joueur automatique parfait survit 12 km.
