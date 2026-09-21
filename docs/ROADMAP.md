# Roadmap de production

## État livré : prélude jouable du laboratoire

| Phase                                | État                              | Limite / gate restant                                 |
| ------------------------------------ | --------------------------------- | ----------------------------------------------------- |
| 0 — Stack, dépôt, scène, docs, tests | Réalisée                          | Git local ; GitHub connecté, dépôt non accessible     |
| 1 — Contrôleur, caméra, input        | Jouable et testé                  | Wall slide / wall jump pour la campagne future        |
| 2 — Combat, dégâts, mort             | Jouable et testé                  | Animation finale et équilibrage humain                |
| 3 — FSM et trois ennemis             | Jouable et testé                  | Animations finales                                    |
| 4 — Mini-boss / architecture boss    | Jouable                           | Identité artistique à affiner                         |
| 5 — Rémanence / Memory Step          | Jouable et testé                  | Playtests puzzles / lisibilité                        |
| 6 — Sauvegardes, ancrages, respawn   | Réalisée pour le slice            | Qualification quotas / autres navigateurs             |
| 7 — Streaming et transitions         | Réalisée pour le slice            | Ressources bornées, retour par conduit                |
| 8 — Biome du slice                   | Prototype jouable                 | Art Blender final, durée et rythme à valider          |
| 9 — Boss qualité production          | Prototype avancé                  | Trois patterns, deux phases ; polish final restant    |
| 10 — Narration                       | Prélude jouable + bible           | Révélations et campagne entière restantes             |
| 11 — Neuf régions                    | Planifiées                        | Interdites avant gate qualité du slice                |
| 12 — Sept boss principaux            | Planifiés                         | Seul le Gardien est jouable                           |
| 13 — Audio / VFX / shaders           | Intégration prototype             | Musique, rigs, VFX et textures de production restants |
| 14 — Performance                     | Instrumentée et mesurée           | 60 FPS sur GPU moyen non certifiés                    |
| 15 — Accessibilité / input           | Intégrée au slice                 | Tests de manettes physiques et UX supplémentaires     |
| 16 — QA complet                      | Chromium logiciel + tests domaine | Firefox / Safari / WebGPU matériel restants           |
| 17 — Release                         | Build et configuration prêts      | Publication requiert l'accès Cloudflare               |

## Prochaine séquence

1. Qualifier WebGPU et 60 FPS sur au moins deux GPU moyens réels, Windows et macOS.
2. Playtester sans outils debug : compréhension des deux pouvoirs, secret, retour, équilibre du Gardien, durée réelle.
3. Remplacer les silhouettes TODO_ART par des rigs Blender et animations intentionnelles, conserver les proxies simples.
4. Raffiner la boucle d'exploration du laboratoire et le combat jusqu'à validation du gate.
5. Produire Ash Rifts, puis les autres régions et le roster, avec le même niveau d'exigence.
6. Implémenter les trois fins en campagne, qualifier les migrations, effectuer la QA cross-browser, publier.

Aucune case de cette roadmap ne doit être marquée terminée sur la seule base d'un typecheck ou d'une fonction déclarée.
