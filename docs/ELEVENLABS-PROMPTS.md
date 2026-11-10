# Sons et musique avec ElevenLabs

À générer avec **Sound Effects** (bruitages, ambiances) et **Music** (musique). Les prompts sont en anglais, ils sont mieux compris ainsi. Les durées sont des cibles : ElevenLabs limite la durée des bruitages (environ 22 s) et peut ne pas respecter exactement le tempo demandé.

**Licence.** À vérifier sur ton plan ElevenLabs avant publication : l'usage commercial et l'éventuelle obligation de citer ElevenLabs dépendent de l'abonnement. Je n'ai pas pu lire leurs conditions officielles. Garde la facture et une capture des conditions en vigueur, comme pour Meshy et Gemini.

**Dépôt.** Mettre les fichiers dans `assets-src/audio/` (MP3 ou WAV) avec les noms ci-dessous. Je me charge de les intégrer : chargement, mixage, variation de hauteur, musique qui monte avec l'intensité, coupure du son.

## Musique (instrumentale, sans voix)

Réglages : instrumental, sans voix. Pour les trois couches de la course, demander **le même tempo (120 BPM) et la même tonalité (ré, gamme orientale)**, pour que je puisse les fondre l'une dans l'autre selon l'intensité.

| Fichier | Durée | Prompt |
|---|---|---|
| `menu.mp3` | 60–90 s, boucle | Slow cinematic menu theme for an adventure game set in a vast golden ancient desert city at sunset. Mysterious and awe-inspiring. Warm sustained drones, soft oud and ney flute, distant frame drums, shimmering chimes, slow string swells. 70 BPM. Instrumental, no vocals, seamless loop. |
| `run_1.mp3` | 60–90 s, boucle | Endless runner game music, layer 1 of 3, calm tension. Driving but light: pulsing low plucked oud ostinato, soft hand percussion, airy ney flute melody, warm bass. Ancient desert city, golden hour, forward motion. 120 BPM, D phrygian dominant. Instrumental, no vocals, seamless loop. |
| `run_2.mp3` | 60–90 s, boucle | Endless runner game music, layer 2 of 3, rising intensity. Same tempo and key as a calm version: powerful frame drums and taiko-style rhythm, driving ostinato strings, oud, urgent flute phrases, deep bass pulse. Epic desert adventure chase. 120 BPM, D phrygian dominant. Instrumental, no vocals, seamless loop. |
| `run_3.mp3` | 60–90 s, boucle | Endless runner game music, layer 3 of 3, maximum intensity. Full orchestral chase: relentless taiko and war drums, fast staccato strings, brass stabs, choir-like pads without words, soaring ney lead, huge cinematic energy. Fleeing a colossal ancient monster. 120 BPM, D phrygian dominant. Instrumental, no vocals, seamless loop. |
| `defeat.mp3` | 4–6 s | Short cinematic defeat sting: low brass drop and a deep drum hit, a fading metallic shimmer, dark and final but not horror. Instrumental. |
| `results.mp3` | 8–12 s | Short results screen jingle for an adventure game: warm golden harp arpeggio and soft strings resolving to a calm, satisfying chord. Ancient desert flavour. Instrumental. |
| `portal.mp3` | 6–8 s | Cinematic transition riser for a dimensional portal: swelling shimmering synth and strings, rising pitch, reversed cymbal, ending in a deep boom and sudden silence. Instrumental. |

## Bruitages (Sound Effects)

| Fichier | Durée | Prompt |
|---|---|---|
| `jump.mp3` | 0,4 s | Quick light whoosh with a soft cloth rustle and a small leather boot push-off, athletic jump, no voice. |
| `land.mp3` | 0,3 s | Soft thud of leather boots landing on a stone floor with a tiny puff of dust, short. |
| `slide.mp3` | 0,8 s | Body sliding fast on a smooth stone floor, cloth and leather scraping, quick and ending with a soft stop, no voice. |
| `lane.mp3` | 0,25 s | Very short airy whoosh with a quick sidestep footstep, subtle. |
| `crystal.mp3` | 0,5 s | Bright magical crystal chime, short glassy ping with a warm golden shimmer tail, pleasant, collectible pickup. |
| `dash.mp3` | 0,6 s | Powerful forward dash: sharp fast air whoosh building to an energetic burst, magical speed boost, no voice. |
| `smash.mp3` | 1 s | Heavy sandstone statue shattering, stone blocks crumbling and falling, deep impact and dust, cinematic. |
| `death.mp3` | 1,5 s | Dramatic collision impact: heavy thud against stone, short low boom, brief rumble tail, no voice. |
| `fall.mp3` | 1,6 s | Long descending falling whoosh dropping in pitch, ending with a faint distant stone thud and echo, no scream. |
| `collapse.mp3` | 3 s | Enormous ancient stone column toppling and crashing, deep rumble, stone cracking, heavy impact, dust settling, echoing in a large space. |
| `ready.mp3` | 0,5 s | Subtle two-note rising magical chime, soft click, ability ready. |
| `ui.mp3` | 0,2 s | Soft stone tap with a small golden metallic ting, interface button press, very short. |
| `milestone.mp3` | 1 s | Short triumphant swell with a golden shimmer, distance milestone reached, uplifting. |
| `footsteps.mp3` | 2 s, boucle | Fast steady running footsteps of leather boots on a stone floor, even cadence, six steps, dry, no echo, no voice. |
| `devourer.mp3` | 6 s | Deep distant monstrous rumble with wind, ominous and slow, colossal creature far away, low frequencies, no scream. |
| `ambience_solaris.mp3` | 20 s, boucle | Warm desert city ambience: soft wind, faint distant horns echoing, flags fluttering, quiet crackle of braziers, occasional far-off chimes. Seamless loop, no music. |

## Nouveaux pièges (à générer quand on les ajoute)

Les sons des pièges suivants seront nécessaires au fur et à mesure : lame de scie qui coulisse, laser qui s'allume (`sparks`), pont qui s'effondre (`collapse` suffit), rocher qui tombe. Je te donnerai les prompts avec chaque piège.
