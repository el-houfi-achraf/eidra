# Roadmap de production

## État livré : deux actes jouables (laboratoire, Failles de cendre)

| Phase                                | État                                | Limite / gate restant                                                          |
| ------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------ |
| 0 — Stack, dépôt, scène, docs, tests | Réalisée                            | Git local ; GitHub connecté, dépôt non accessible                              |
| 1 — Contrôleur, caméra, input        | Jouable et testé                    | Wall slide / wall jump pour la campagne future                                 |
| 2 — Combat, dégâts, mort             | Jouable et testé, game feel ajouté  | Animation finale et équilibrage humain                                         |
| 3 — FSM et ennemis                   | Dix types (cinq dans les salles)    | Animations finales                                                             |
| 4 — Mini-boss / architecture boss    | Moteur de boss par données          | Identité artistique à affiner                                                  |
| 5 — Rémanence / Écho mémoriel        | Jouable et testé                    | Playtests puzzles / lisibilité                                                 |
| 6 — Sauvegardes, ancrages, respawn   | Réalisée pour le slice              | Qualification quotas / autres navigateurs                                      |
| 7 — Streaming et transitions         | Salles 2D, portes, voile (D036)     | Salles pour l'Acte II                                                          |
| 8 — Biome du slice                   | Acte I en 25 salles, carte, journal | Art Blender final ; durée (45–55 min estimées) et rythme à valider en playtest |
| 9 — Boss qualité production          | Prototype avancé                    | Quatre boss, chacun sa capacité et sa démarche ; équilibrage humain restant    |
| 10 — Narration                       | Deux actes jouables + bible         | Révélations et campagne entière restantes                                      |
| 11 — Neuf régions                    | Deux jouables                       | Art de production et sept régions restantes                                    |
| 12 — Sept boss principaux            | Quatre jouables                     | Porteur, Gardien, Sentinelle et Ilyra ; trois restants                         |
| 13 — Audio / VFX / shaders           | Partition et bruitages générés      | Enregistrement musical, rigs, VFX et textures de production restants           |
| 14 — Performance                     | Instrumentée et mesurée             | 60 FPS sur GPU moyen non certifiés                                             |
| 15 — Accessibilité / input           | Toutes manettes, remappage          | Qualification sur manettes physiques                                           |
| 16 — QA complet                      | Chromium logiciel + tests domaine   | Firefox / Safari / WebGPU matériel restants                                    |
| 17 — Release                         | Build et configuration prêts        | Publication requiert l'accès Cloudflare                                        |

## Prochaine séquence

1. Qualifier WebGPU et 60 FPS sur au moins deux GPU moyens réels, Windows et macOS.
2. Playtester sans outils debug l'Acte I en salles : temps réel de chaque pouvoir (Élan, Rémanence, Écho), orientation avec la carte, découverte des trois murs fêlés et du raccourci de la grille, lisibilité des cinq nouveaux ennemis ; puis compréhension des pouvoirs, secret, retour, difficulté du Porteur, du Gardien, de la Sentinelle et d'Ilyra (lisibilité des reflets, tolérance du Commandement), rythme des colonnes de feu, durée réelle.
3. Remplacer les silhouettes TODO_ART par des rigs Blender et animations intentionnelles, conserver les proxies simples.
4. Raffiner la boucle d'exploration du laboratoire et le combat jusqu'à validation du gate.
5. Produire l'art final des Failles de cendre, puis les Jardins de verre et les autres régions, avec le même niveau d'exigence.
6. Implémenter les trois fins en campagne, qualifier les migrations, effectuer la QA cross-browser, publier.

Aucune case de cette roadmap ne doit être marquée terminée sur la seule base d'un typecheck ou d'une fonction déclarée.
