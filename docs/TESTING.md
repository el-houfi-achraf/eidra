# Tests

## Commandes

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run validate:assets
npm run manifest
npx playwright install chromium
npm run test:e2e
```

Node 24. Les E2E démarrent le build de production avec Vite preview ; pas de HMR. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet un Chromium déjà installé. Les traces et captures d’échec restent dans `test-results`, ignoré par Git et conservé comme artefact par la CI.

## Couverture réalisée

30 tests unitaires / intégration dans 9 fichiers : EventBus, transitions d’état, mouvement et math, dégâts, combo, invulnérabilité, parade, FSM / boss, patrouille de berge, inventaire, mémoire, quêtes, narration et conditions des fins, migrations / corruption IndexedDB, streaming avec destruction, pipeline GLB / audio, négociation WebGPU et événements clavier courts.

9 parcours E2E : démarrage WebGL2 sans erreur ; déplacement, saut, dash, acquisition et dégâts ennemis ; ancrage, IndexedDB, refresh et reprise ; réglages et remapping persistants ; Rémanence, Écho, contrepoids et raccourci ; changement de secteur, mort et respawn ; introduction / phase 2 / victoire et fin du prélude ; Gamepad API simulée avec maintien du clavier ; traversée physique des trois plateformes mémoire par sauts et dash.

Les fixtures debug positionnent le joueur au début de certaines épreuves et règlent la vie du boss pour vérifier ses transitions. Elles ne prouvent ni un parcours complet sans debug ni l’équilibrage du boss. Déplacement, attaques, capacités, ancrage et traversée du pont passent par les vraies entrées clavier. La Gamepad API est simulée ; ce n’est pas un test de manette physique.

## Qualité restant à qualifier

WebGPU réel, Firefox / Safari, manettes physiques, accessibilité avec lecteurs d’écran, quotas / stockage privé, CSP sur Cloudflare et campagne complète. Le protocole de performance logiciel est décrit dans PERFORMANCE ; il ne certifie pas 60 FPS. Aucun test défaillant n’est désactivé pour rendre la CI verte.

La CI GitHub est configurée pour bloquer ses propres gates en cas d’échec. La protection de branche doit exiger le job `validate` quand le dépôt distant est créé ; ce réglage GitHub ne peut pas être garanti par un fichier YAML seul.

## Résultat du jalon 0.1.0-prélude

Node 24.19.0 ; TypeScript strict, ESLint sans avertissement et Prettier : réussis. Vitest : **30 tests réussis**. Playwright : **9 parcours réussis** en environ 1 min 6 s sur le build final, Chromium logiciel. Validation des assets et création du manifeste de 37 fichiers : réussies. Les résultats sont locaux ; aucune exécution GitHub Actions distante n’est revendiquée.
