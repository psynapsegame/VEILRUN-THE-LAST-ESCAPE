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
| Statues « Colosse », « Sphinx », « Tête », « Brasero » et « Idole » (`assets-src/Colosse.glb`, `Sphinx.glb`, `Tete.glb`, `Brasero.glb`, `Idole.glb`) | Générées avec Meshy par le porteur du projet, d'après des images de référence Gemini, le 10/11/2026 | Conditions de Meshy applicables au plan payant du porteur du projet | À confirmer (voir ci-dessous) | meshy.ai | Statues monumentales (`src/assets/statues/*.glb`) |
| Images de décor : fresque, frise, 3 motifs de bannières, panorama, Dévoreur, icône, illustration de titre (`assets-src/gemini/*.jpg`) | Générées avec Gemini par le porteur du projet, le 10/11/2026 | Conditions des applications Gemini (usage commercial, responsabilité de l'utilisateur) | À confirmer (voir ci-dessous) | gemini.google.com | Fresques et frises sur les murs, bannières, ciel lointain, Dévoreur, icônes, écran de démarrage (`src/assets/art/*.webp`, icônes Android et web) |

**À vérifier par le porteur du projet avant toute publication commerciale**
- Meshy : la licence dépend du plan au moment de la génération (la documentation indique que les modèles faits avec le plan gratuit sont en CC BY 4.0, avec crédit obligatoire). Confirmer que les modèles ont été générés après la prise d'abonnement, conserver la facture et une capture des conditions en vigueur. Si l'un d'eux date du plan gratuit, il faudra créditer Meshy dans le jeu.
- Gemini : relire les conditions des applications Gemini pour l'abonnement utilisé (droits d'usage commercial, absence de garantie contre les ressemblances avec des œuvres existantes). Les images portent un filigrane invisible (SynthID) qu'il ne faut pas chercher à retirer.
- Aucune de ces ressources ne doit reproduire un personnage, un lieu ou un style protégé : les descriptions fournies à Meshy et Gemini n'en citent aucun.

`src/assets/solaris/` est produit par `tools/fetch-solaris.mjs` (téléchargement, réduction, conversion).
`src/assets/statues/` est produit par `tools/build-statue.mjs` (allègement à 6 000–9 000 triangles, textures 1 024 px ; l'idole existe aussi en version lointaine de 1 500 triangles ; la tête est tournée sur le dos).
`src/assets/art/` est produit par `tools/build-art.mjs`, les icônes par `tools/build-icons.mjs`.
`src/assets/hero.glb` est produit par `tools/build-hero.mjs` à partir de ces sources (simplification, textures 1024 px en WebP, fusion des animations).
