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

Principes : la simulation ignore le rendu (donc testable et rejouable par graine — base du Défi quotidien) ; aucun objet créé pendant la course (pools d'obstacles, particules en tampon circulaire, géométries partagées) ; résolution adaptative selon le temps de trame.

## État réel — Phase 1

Fait et vérifié :
- Course automatique, 3 voies, saut, glissade, plongeon, dash, vitesse progressive (11 → 25 m/s).
- 3 familles d'obstacles (à sauter, à passer dessous, à contourner), fragments, score, record.
- Générateur : toujours une voie praticable, fenêtre de réaction ≥ 0,85 s à toute vitesse. Vérifié sur 200 graines × 20 km, et par un joueur automatique qui survit 6 km sur 25 graines.
- Gestes tactiles vérifiés en émulation iPhone 13 (swipes, double-tap, boutons, pause, reprise, sauvegarde après rechargement).
- Projet Android généré ; un workflow GitHub Actions compile l'APK de test.

Pas encore fait / non vérifié :
- **Aucun test sur appareil physique.** Les FPS réels sur téléphone ne sont pas mesurés.
- **iOS** : nécessite un Mac avec Xcode et un compte Apple Developer ; projet iOS pas encore généré.
- Le personnage et les décors sont modélisés par code (stylisés, originaux). Ce ne sont pas encore des modèles sculptés/riggés de qualité finale : ce sera l'objet de la Phase 2 (assets glTF).
- Course sur murs, câbles, vol plané, boss, autres univers, progression, boutique : phases suivantes.

## Refonte visuelle (budget 0 €) — avancement

La stratégie complète, les ressources et leurs licences sont dans `docs/STRATEGIE-VISUELLE.md` ; le registre des ressources tierces est `assets-src/LICENCES.md`.

| Étape | Contenu | État |
|---|---|---|
| A — Héros | Aventurier encapuchonné aux proportions humaines (Quaternius, CC0), recoloré, animations de sprint, saut, glissade, roulade (dash) et chute | fait, vérifié dans le navigateur |
| B — Lumière et matière | Éclairage par image de ciel (HDRI), grès et marbre photographiés, or réfléchissant, brume de hauteur dorée vers le soleil, halo lumineux, étalonnage | fait, vérifié dans le navigateur ; performances sur téléphone non mesurées |
| C — Kit SOLARIS | Architecture monumentale, statues, ponts, obstacles redessinés | à faire |
| D — Vie et mise en scène | Tissus, rayons, effondrements, Dévoreur | à faire |
| E — Performance | Profils graphiques, niveaux de détail, compression, écran de chargement | à faire |

Les décors et obstacles actuels sont encore ceux du prototype (construits par code). Le héros se reconstruit avec `tools/build-hero.mjs`.

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
