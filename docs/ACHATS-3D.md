# Achat des ressources 3D — guide

But : remplacer le personnage et les décors provisoires par des modèles professionnels.

## Ce qu'il faut acheter (pour SOLARIS d'abord)

1. **Un personnage humanoïde riggé** (squelette standard). Les animations de course, saut et glissade peuvent venir de Mixamo (gratuit avec un compte Adobe), donc le pack n'a pas besoin de les contenir.
2. **Un kit de décors modulaire** « cité antique / temple du désert » : colonnes, murs, arches, statues, sols, végétation.
3. Idéalement dans **le même style** que le personnage (un pack unique qui contient les deux est le plus sûr).

## Conditions obligatoires avant d'acheter

- **Format** : FBX ou glTF/GLB. (Vérifié : la conversion FBX → GLB fonctionne dans notre chaîne.) Refuser les packs livrés uniquement en projet Unity ou Unreal.
- **Licence** : usage commercial dans un jeu, sans obligation d'utiliser un moteur précis. Garder la facture et le texte de licence.
- **Mobile** : modèles « low/mid poly » ou « game ready », textures 2K maximum.
- Ne pas acheter de modèles reprenant des personnages ou lieux de jeux existants.

## Pistes repérées (à valider ensemble avant achat)

| Pack | Prix affiché | Ce qui est confirmé | À vérifier |
|---|---|---|---|
| Synty « POLYGON – Ancient Empire » (syntystore.com) | 149,99 $ | Fichiers source FBX inclus ; décors + personnages dans un style cohérent | Que le style « low poly » te plaît ; texte de licence |
| « Desert Temple Environment » (cgtrader.com) | 79,99 $ | 69 éléments modulaires, licence royalty-free | Formats de fichiers ; pas de personnage |
| « Low Poly Ancient Egypt Environment Pack » de GGart (cgtrader.com) | 19,99 $ | FBX + GLB, 62 éléments, royalty-free | Un seul temple, peu modulaire |
| Mixamo (mixamo.com) | gratuit | Animations et personnages libres de redevances pour un jeu commercial, à condition de les intégrer au jeu (pas de redistribution des fichiers bruts) | Relire les conditions Adobe en vigueur |

Les prix et contenus viennent des pages de vente consultées en novembre 2026 ; ils peuvent changer.

## Marche à suivre

1. Regarder les pages ci-dessus (ou toute autre boutique) et choisir le style qui plaît.
2. Envoyer le lien **avant d'acheter** : je vérifie format, licence et compatibilité.
3. Acheter, puis déposer l'archive dans le dépôt GitHub (dossier `assets-src/`).
4. J'intègre : conversion, optimisation mobile, animations, remplacement des décors provisoires.
