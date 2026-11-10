# Registre des ressources tierces

Toute ressource non créée pour VEILRUN est listée ici avec sa licence. Les textes de licence d'origine sont conservés dans ce dossier.

| Ressource | Auteur | Licence | Attribution exigée | Source (consultée le 10/11/2026) | Utilisation |
|---|---|---|---|---|---|
| Modular Character Outfits – Fantasy (Standard), tenue « Male Ranger » | Quaternius | CC0 1.0 | Non | Copie dans github.com/Mesh2Motion/mesh2motion-assets (`CC0-packs/Quaternius`) ; pack d'origine : quaternius.com | Héros (`src/assets/hero.glb`) |
| Universal Animation Library (Standard) | Quaternius | CC0 1.0 | Non | Copie dans github.com/2600th/Kinema (`public/assets/models`) ; pack d'origine : quaternius.com | Animations du héros : Idle, Sprint, Jump, Roll, Death |
| Universal Animation Library 2 (Standard) | Quaternius | CC0 1.0 | Non | Idem | Animations du héros : Slide, Hit_Knockback |
| Textures « Sandstone Blocks 08 », « Sandstone Blocks 05 », « Marble 01 » | Rob Tuytel (Poly Haven) | CC0 1.0 | Non | polyhaven.com/a/sandstone_blocks_08, /a/sandstone_blocks_05, /a/marble_01 | Murs et monuments, bordures et gravats, dallage de la route (`src/assets/solaris/*.webp`) |
| HDRI « Rogland Sunset » | Greg Zaal (Poly Haven) | CC0 1.0 | Non | polyhaven.com/a/rogland_sunset | Éclairage d'environnement (`src/assets/solaris/sky.hdr`) |

Licence Poly Haven relue le 10/11/2026 via leur API publique : tous les assets sont en CC0.

`src/assets/solaris/` est produit par `tools/fetch-solaris.mjs` (téléchargement, réduction, conversion).
`src/assets/hero.glb` est produit par `tools/build-hero.mjs` à partir de ces sources (simplification, textures 1024 px en WebP, fusion des animations).
