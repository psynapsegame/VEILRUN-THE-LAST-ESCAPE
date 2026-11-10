# Descriptions à coller dans Meshy (« Texte vers 3D »)

Réglages conseillés pour chaque génération : style **réaliste / sculpture**, symétrie **activée**, export **GLB**. Générer une pièce à la fois, garder celle qui plaît, puis la déposer dans `assets-src/meshy/` du dépôt GitHub (ne pas renommer le fichier téléchargé, ou alors utiliser les noms indiqués).

Les descriptions sont en anglais car l'outil les comprend mieux. Elles décrivent des créations originales : ne pas y ajouter de noms de dieux, de personnages ou de jeux existants.

> **État (10/11/2026)** : colosse et sphinx sont livrés et intégrés au jeu (déposés dans `assets-src/`, allégés par `tools/build-statue.mjs`). Reste : tête brisée, brasero, idole gardienne. Nom des fichiers à déposer : `assets-src/Tete.glb`, `Brasero.glb`, `Idole.glb`.
>
> **Retour sur le colosse** : très belle sculpture, mais le masque est un ovale lisse qui paraît inachevé de près. De loin il fonctionne comme un gardien sans visage. Pour une seconde version, remplacer dans la description « smooth featureless oval mask » par « a serene carved face with almond-shaped eyes, a straight nose and a calm closed mouth, partly covered by a smooth golden mask ».

## 1. Colosse assis — `colosse.glb` (priorité 1)

```
A monumental seated guardian statue carved from weathered golden sandstone, sitting upright on a massive block throne, hands resting flat on the knees, wearing a tall striped ceremonial headdress and a smooth featureless oval mask with a large sun disc engraved on the forehead, broad collar necklace, ancient desert temple style, eroded edges, cracks, single solid sculpture, symmetrical, front facing, no base plate, game asset
```

## 2. Sphinx gardien — `sphinx.glb` (priorité 2)

```
A crouching guardian beast statue carved from pale sandstone, body of a lion lying down with front paws stretched forward, human-like head wearing a striped cloth headdress and a smooth golden mask, chipped and weathered ancient stone, lying on a low rectangular plinth, symmetrical, single solid sculpture, ancient desert temple style, game asset
```

## 3. Tête géante brisée — `tete.glb` (priorité 3)

```
A giant broken stone head fallen from a colossal statue, lying slightly tilted on the ground, serene masked face with closed eyes, striped headdress partly shattered, deep cracks, missing chunk on one cheek, weathered golden sandstone, half buried in sand, ancient ruins, single solid object, game asset
```

## 4. Brasero monumental — `brasero.glb` (priorité 4)

```
A tall ancient ceremonial brazier, wide shallow hammered bronze bowl with engraved sun rays, held by a fluted sandstone pedestal with gold bands, three small lion paw feet, aged metal with dark patina, no flames, symmetrical, single object, ancient desert temple style, game asset
```

## 5. Idole gardienne (obstacle) — `idole.glb` (priorité 5)

```
A standing ancient guardian idol statue, about twice human height, rigid upright pose with arms crossed over the chest, carved sandstone body with gold inlays, smooth oval mask face with a glowing crystal set in the forehead, standing on a square stepped pedestal, weathered and chipped, symmetrical, single solid sculpture, ancient desert temple style, game asset
```

## Rappels

- Plan gratuit : modèles sous licence CC BY 4.0 (crédit « Meshy » obligatoire dans le jeu) et non privés. Environ 5 générations par mois.
- En attendant ces modèles, le jeu utilise des statues provisoires construites par code ; elles seront remplacées pièce par pièce.
