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

## Mise à jour « ressenti moderne »

42 tests unitaires / intégration dans 11 fichiers. Ajouts : hit-stop (pas gelés, plafond, résidus flottants), tampon d'attaque, riposte après parade, hitbox de plongée, rebond pogo à hauteur fixe, Recueillement (gain, canalisation, interruptions, pas de soin excédentaire), offrandes d'autel (coûts croissants, plafond), Gardien (blindage d'introduction et de transition, pluie d'éclats réservée à la phase 2, projectiles sur les marques), direction « bas » et invites selon le dernier périphérique.

12 parcours E2E. Ajouts : Recueillement alimenté par de vrais coups clavier puis soin en maintenant F ; autel, offrande d'éclats et vitalité conservée après rechargement ; plongée qui rebondit sur un Veilleur et le blesse. Le parcours du boss vérifie la fin de la transition blindée sans perte de vie du Gardien ; l'aide `skipDialogue` tolère les lignes tapées (un premier appui complète la ligne).

Sur un rendu logiciel lent, le pas de simulation est plafonné à 0,1 s par image : une durée réelle fixe couvre alors moins de temps de jeu. Dans le conteneur de cette mise à jour (environ 4 à 7 FPS), le code 0.1.0 non modifié échouait déjà à deux parcours : la porte du contrepoids (touche maintenue 2,4 s) et la traversée du pont. Le parcours de déplacement initial (touche maintenue 600 ms) échouait aussi une fois avec la mise à jour. Corrections, sans retirer d'assertion et avec les vraies entrées clavier :

- les deux parcours à durée fixe maintiennent la touche jusqu'à la condition attendue ;
- la traversée du pont attend qu'Eidra soit réellement posée après la téléportation de départ. L'indicateur « au sol » pouvait encore décrire l'image précédant la téléportation : le saut, pressé pendant la chute de 20 cm, expirait parfois dans le tampon et Eidra marchait dans le vide ;
- la plongée attend que le contrôleur signale la chute avant de frapper, pour la même raison.

Après correction : suite complète réussie, traversée du pont 5 / 5 et plongée 5 / 5 en répétition.

## Deuxième itération : personnages, UI, UX

51 tests unitaires / intégration dans 13 fichiers. Ajouts : validation Zod de toutes les apparences et couverture du roster ennemi, lisibilité des silhouettes (cape qui s'évase, capuche au-dessus du masque), chaîne d'écharpe (pend sous l'ancre, garde ses longueurs, traîne derrière un ancrage mobile, suit le vent, se réinitialise après téléportation, ignore les pas invalides), tutoriel contextuel (bandes et prérequis, retrait après le geste n'importe où, soin seulement blessé, données valides).

13 parcours E2E, tous réussis sur le build final. Ajout : les invites contextuelles enseignent le déplacement puis le saut et se retirent une fois le geste accompli. Le parcours des réglages ouvre désormais les onglets Accessibilité et Commandes avant d'y agir.

## Qualité restant à qualifier

WebGPU réel, Firefox / Safari, manettes physiques, accessibilité avec lecteurs d’écran, quotas / stockage privé, CSP sur Cloudflare et campagne complète. Le protocole de performance logiciel est décrit dans PERFORMANCE ; il ne certifie pas 60 FPS. Aucun test défaillant n’est désactivé pour rendre la CI verte.

La CI GitHub est configurée pour bloquer ses propres gates en cas d’échec. La protection de branche doit exiger le job `validate` quand le dépôt distant est créé ; ce réglage GitHub ne peut pas être garanti par un fichier YAML seul.

## Résultat du jalon 0.1.0-prélude

Node 24.19.0 ; TypeScript strict, ESLint sans avertissement et Prettier : réussis. Vitest : **30 tests réussis**. Playwright : **9 parcours réussis** en environ 1 min 6 s sur le build final, Chromium logiciel. Validation des assets et création du manifeste de 37 fichiers : réussies. Les résultats sont locaux ; aucune exécution GitHub Actions distante n’est revendiquée.
