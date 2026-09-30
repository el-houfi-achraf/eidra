# Architecture

Node 24, TypeScript strict, Vite, Babylon.js 9.x, Havok Web, IndexedDB via idb, Zod. Aucune couche React / Vue / Angular. Le gameplay ne dépend pas des meshes.

## Modules

- core : moteur, boucle, états, erreurs et EventBus typé.
- player / physics / camera : contrôleur intentionnel, capsule Havok, cadrage 2.5D.
- combat : dégâts, fenêtres, hitboxes, invulnérabilité, combo.
- ai / enemies / bosses : FSM et données validées.
- world : secteurs, transitions et destruction explicite des ressources.
- abilities : mémoire, coûts et cooldowns.
- save : validation, version, migration, transaction IndexedDB.
- narrative / quests : événements et flags, sans référence 3D.
- ui : menus DOM accessibles et HUD Babylon GUI.

## Rendu

WebGPU est tenté en premier. Une initialisation échouée est journalisée et libérée avant création de WebGL2. WebGL1 est refusé explicitement. Paramètre de diagnostic `?renderer=webgl2`.

## Dépendances

Babylon fournit moteur, GUI et loader GLB ; Havok fournit la physique ; idb simplifie les transactions ; Zod valide les frontières de données. Vitest / Playwright / ESLint / Prettier / fake-indexeddb servent exclusivement au développement et aux tests.

## Erreurs

GameError, ConfigurationError, AssetLoadError et SaveError. Échec critique : écran lisible ; erreurs secondaires : message et console. Aucun catch vide.

## Boucle et responsabilités

`Game` gère les états, la boucle à pas fixe 1/60 s (rattrapage borné à six pas), les menus et les services. `GameSession` relie les systèmes de domaine, le contrôleur et les événements de progression. `Presentation`, `CharacterView`, `Hud` et `EffectPool` consomment l’état sans décider des dégâts ou des conditions narratives. Les touches restent dans `InputManager`, remappables via `InputAction`. Les manettes passent par `Gamepad` (identification, normalisation vers la disposition standard, zone morte, capture pour le remappage, symboles), sans état global ; `InputManager` choisit la manette sur laquelle on appuie, fusionne clavier et manette en actions, calcule la navigation des menus et joue les vibrations (D030).

`GameSession` émet des événements typés (`ENEMY_DAMAGED`, `ENEMY_DEFEATED`, `PLAYER_HEALED`, `PARRIED`, `OFFERING_MADE`) que `Game` relaie vers `Hud` (chiffres, barres ennemies) et `Presentation` (flashs, ondes, éclats). Les effets visuels réutilisables vivent dans `vfx` : `SlashArc` (croissant de lame), `Afterimages` (traînée de dash), `Motes` (éclats attirés, canalisation), `EffectPool` (étincelles, poussière, ondes de choc) et `textures` (dégradés procéduraux TODO_ART). `CharacterView` assemble chaque personnage depuis `game-data/characters/appearance.ts` avec `PuppetGeometry` (géométrie toon à couleurs de sommets) et anime ses parties (jambes, lame, clignement, écharpe via `SecondaryChain`) ; il reçoit une `Pose` purement visuelle (squash & stretch, flash, canalisation, dissolution). `Backdrop` dessine le ciel lointain en dégradé de sommets recoloré par l'ambiance ; `CameraRig` est une caméra perspective à longue focale (voir D013).

Décor (D023, D024) : `Mood` décode les ambiances de `game-data/zones/moods.ts` et les fond entre secteurs (`tintAt`). `PaintedGeometry` construit des bandes, rubans (bords éventuellement adoucis par l'alpha des sommets), triangles, sols, murs et sprites à couleurs de sommets et UV monde. `Scenery.paintScenery` produit de façon déterministe les géométries d'un secteur (proche, lointain, avant-plan, halos, rayons, souvenirs) ; `ChunkView` les transforme en six maillages, garde les boîtes des données comme colliders invisibles et bascule les couches selon le preset. `Atmosphere` gère les bandes de brume qui suivent la caméra et font défiler leur texture avec le monde.

`TutorialDirector` (quests) choisit l'invite contextuelle à partir des données de `game-data/quests/tutorial.ts` ; `GameSession` lui signale les gestes accomplis et expose `hint`, que `MenuUI` affiche avec les glyphes du dernier périphérique.

`ArenaDirector` (bosses) scelle et libère les arènes décrites dans `game-data/zones/laboratory.ts` ; `GameSession.closedGates()` combine ses portes et le sceau du contrepoids, `World` les applique (colliders statiques créés près du joueur, animation de montée purement visuelle, changements signalés à `Presentation` pour la poussière) et `EnemyManager` en borne les corps avec les intervalles de `Terrain` (D020, D021). `GameSession.bossBar` expose au HUD la vie du gardien combattu. Chaque boss du `bossRoster` (`game-data/bosses`, D027) est une `BossEncounter` de `EnemyManager` : son `BossDirector` (logique pure) choisit patterns, phases et enchaînements, le gestionnaire traduit les déclenchements en coups. Les colonnes de feu sont des fonctions pures de `GameSession.hazardTime` (`combat/Hazards`, D029), lues à l'identique par les dégâts et par `Presentation`. `Poses` traduit l'état des FSM, du directeur de boss et du combat en poses clés visuelles (D022) ; `LightRays` dessine les lames de lumière.

`SceneManager` conserve seulement les secteurs proches, puis libère chaque `ChunkView`. `World` possède les colliders simples et portes d'arène. Les corps mémoire sont créés / détruits quand Rémanence change ; aucune physique n’est attachée à un modèle artistique complexe. `AssetLoader` prépare le chargement GLB asynchrone avec annulation et libération ; le blockout du prélude est actuellement procédural.

Les ressources répétées des impacts et projectiles visuels sont préallouées. Les meshes statiques sont fusionnés par matériau, sauf les éléments interactifs. Les décodeurs WASM et JS sont servis localement. L’audio Babylon V2 utilise des boucles OGG originales, un crossfade et des effets spatiaux, avec secours WAV explicite.

## Persistance

SaveManager valide les frontières avec Zod et écrit dans IndexedDB. Trois slots, version 2, migration depuis 1 ; version future / corruption refusées sans écrasement silencieux. Les positions transitoires sur le pont mémoire ou pendant le boss sont remplacées par l’ancrage lors de la sauvegarde. Les réglages ont une persistance distincte et sont inclus dans les sauvegardes.
