# Audit du projet et feuille de route révisée

Audit réalisé en lisant le code et en exécutant les tests (typage strict : OK ; 93 tests : OK). Aucune mesure sur téléphone réel : les FPS restent inconnus.

## Ce qui fonctionne (vérifié)
- Simulation déterministe à 120 Hz, séparée du rendu ; générateur à voie sûre, validateur indépendant, bot de référence (SOLARIS + NEXUS, 300 graines × 30 km, trois portails).
- Obstacles bas/hauts/pleins, trous, lasers (NEXUS), dash qui casse les solides, portails et alternance de mondes.
- Audio réel (ElevenLabs) avec repli synthétique ; qualité adaptative ; sauvegarde locale versionnée.

## Incomplet ou fragile
1. **Vocabulaire** : dans le code, `fragments` désigne les *joyaux*. Le design prévoit des *fragments de portail* distincts : à renommer avant d'ajouter les vrais fragments (migration de la sauvegarde v1 nécessaire).
2. **Mondes codés en dur** : la génération l'était (corrigé : `src/sim/worlds.ts`), le rendu (`world.ts`, `solaris.ts`, `nexus.ts`) et l'audio (`audio.world === 0`) le sont encore.
3. **Pièges** : tous statiques ou à horloge simple (lasers). Aucun piège mobile, aucun événement scénarisé, aucun Gardien.
4. **Validateur** : il ne vérifie que l'accessibilité des voies (les lasers comptent comme des murs). Il ne contrôle ni les fenêtres de saut, ni l'annonce ≥ 1,2 s, ni les nouveaux pièges. Le bot ne sait pas utiliser le dash.
5. **Dash** : pendant le dash la vitesse monte à ×1,7 alors que l'espacement des rangées suppose la vitesse normale, et franchir un trou au sol en dash fait tomber. Aucune règle ne force le dash, mais le comportement est à arbitrer.
6. **Score** : `distance + 10 × joyaux`, sans multiplicateur ; pas de record distinct par monde.
7. **Pas de tests sur appareil**, pas d'onboarding au-delà de trois bulles, pas de mesure de durée de partie ni de morts injustes.
8. **Aperçu navigateur** : le fichier unique approche 14 Mo pour une limite de 16 Mo ; un troisième monde ne tiendra pas dans ce format.

## Avant de produire de nouveaux mondes (obligatoire)
Mondes en données côté rendu/audio ; système générique de pièges à horloge, validé par le bot ; cadre de Gardien prouvé sur SOLARIS ; vocabulaire joyaux/fragments ; mesures de durée et de difficulté sur parties automatisées ; premier test sur téléphone réel.

## Feuille de route révisée
| Étape | Contenu | État |
|---|---|---|
| 1 | Mondes en données (génération) + empreintes de référence du générateur | **fait** |
| 2 | Renommer joyaux/fragments, sauvegarde v2 avec migration | à faire |
| 3 | Pièges à horloge génériques (pendules, boule de pierre, colonnes) + extension du validateur et du bot | à faire |
| 4 | Mesures sur parties automatiques (durée, distance, morts) | à faire |
| 5 | Score : distance × multiplicateur + bonus | à faire |
| 6 | Cadre de Gardien + Gardien des Sables | à faire |
| 7 | Portail, trois fragments, Collection, transition | à faire |
| 8 | NEXUS finalisé (+ Gardien), puis progression, missions, défi quotidien local | à faire |
| 9 | VERDANT, puis le reste | plus tard |
