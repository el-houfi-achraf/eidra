# Décisions

## D001 — Stack verrouillée

Node 24 disponible ; Babylon 9.27.0 fixé. Pas de framework frontend. Versions exactes + lockfile pour reproductibilité.

## D002 — Dépôt local autonome

Git local avec commits atomiques. Le connecteur GitHub est maintenant connecté et identifie le compte, mais ne retourne aucun dépôt ni installation accessible ; la création de dépôt est absente de ses outils. La page de création dans le navigateur nécessite une connexion distincte. Ne pas prétendre avoir poussé le code. Cloudflare requiert également un compte autorisé.

## D003 — Art procédural temporaire

Blender absent ; ne bloque pas le slice. Préparer un script Blender, générer temporairement les meshes via Babylon, conserver le pipeline GLB pour les assets importés.

## D004 — Collision et logique

Havok Character Controller pour capsule ; simulations gameplay typées et testables sans renderer. Combat analytique indépendant des meshes.

## D005 — Validation honnête

Chromium logiciel certifie le fonctionnement, pas la cible 60 FPS d'un GPU réel. Tout résultat matériel non mesuré reste explicitement non qualifié.

## Références techniques

- https://doc.babylonjs.com/features/featuresDeepDive/physics/characterController/
- https://doc.babylonjs.com/setup/support/webGPU/
- https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/

## D006 — Modules Babylon 9 explicites

Le moteur 9 possède des points d'entrée purs et des enregistrements de composants. Importer explicitement joinedPhysicsEngineComponent, particules WebGL2 / compute et instrumentation des time queries ; les tests navigateur ont détecté les omissions que TypeScript ne pouvait détecter.

## D007 — Optimisation mesurée des décors

Regroupement des meshes statiques par matériau avec Mesh.MergeMeshes, sans fusionner colliders, plateformes mémoire, marqueurs interactifs ni cristaux animés. Le menu est passé d'environ 230 à 46 draw calls dans le protocole initial. Les plafonds et timings finaux sont consignés dans PERFORMANCE.

## D008 — Sauvegardes sûres

Trois slots IndexedDB, version courante 2, migration 1 → 2, refus explicite des versions inconnues. Les sauvegardes pendant une plateforme mémoire ou un boss actif replacent la position au dernier ancrage afin d'éviter de recharger dans un état temporaire impossible.

## D009 — Audio temporaire

Score et bruitages synthétisés par un script reproductible. OGG en premier, WAV de secours si le décodeur échoue. Écriture atomique des exports après validation pour éviter les fichiers vides lors d'une interruption. Crossfade exploration / boss et positionnement spatial Babylon Audio V2.

## D010 — Dépendances du pipeline uniquement au développement

Khronos gltf-validator garantit la validité glTF ; glTF Transform et meshoptimizer optimisent et compressent sans modifier le moteur du jeu. Aucun package de pipeline n'est requis au runtime navigateur. Les décodeurs meshopt, glslang et twgsl sont locaux, avec leurs mentions de licence.

## D011 — Scope du prélude

Une boucle de maintenance relie le contrepoids à la chambre d'éveil après résolution du puzzle, permettant le retour vers Kael. Les neuf régions ne sont pas fabriquées artificiellement pour revendiquer un jeu terminé. Le gate qualité du slice prévaut.

## D012 — Atterrissage après dash

Le test navigateur de traversée réelle du pont a révélé une dérive de plusieurs mètres après la fin du dash. La vitesse horizontale revient au maximum de course à la sortie du dash, puis le contrôle aérien normal reprend. Un test de mouvement et une traversée clavier avec atterrissages couvrent cette régression. La patrouille du second Veilleur est bornée par les données de sa berge solide.

## D013 — Caméra perspective à longue focale

La caméra orthographique supprimait toute parallaxe : les couches à z = 7, 22 ou 44 défilaient à la vitesse du plan jouable. Une caméra perspective à 32 m, dont le champ vertical est calculé pour conserver la hauteur visible du plan z = 0 (7,2 / 8,7 / 10 m), garde le cadrage et les tailles de gameplay, et fait défiler arrière-plans et silhouettes de premier plan à leur propre vitesse. Le zoom boss est désormais amorti. Les silhouettes de premier plan restent dans les bandes haute et basse de l'écran pour ne pas masquer la zone jouable.

## D014 — Étalonnage en un seul passage plein écran

Tone mapping ACES, exposition, contraste et vignette utilisent `scene.imageProcessingConfiguration`. Appliqué dans les shaders des matériaux, il coûtait environ 66 ms de rendu logiciel en MEDIUM, car chaque fragment recouvert par les nombreux plans de décor payait l'étalonnage. Un `ImageProcessingPostProcess` unique le remplace : MEDIUM y ajoute FXAA à la place du MSAA, HIGH et ULTRA gardent un MSAA 4× sur la cible du passage, LOW reste sans étalonnage (chemin d'origine). La couche GUI est exclue du post-process (`applyPostProcess = false`). La vignette sert aussi de retour de danger en MEDIUM et au-delà (teinte rouge pulsée sous 30 % de vie, flash à l'impact). Le grain de film est écarté tant qu'une mesure GPU réelle ne le justifie pas.

## D015 — Hit-stop dans le pas fixe

Le hit-stop consomme des pas de simulation complets (50 ms coup simple, 85 ms finisher, 120 ms parade, 200 ms plafonné) sans figer le rendu. Les entrées pressées restent dans le tampon d'`InputManager` et un tampon d'attaque de 0,22 s rejoue une pression faite pendant la récupération : aucune entrée n'est perdue. Les résidus flottants sont arrondis pour qu'un arrêt de 50 ms gèle exactement trois pas à 60 Hz.

## D016 — Progression sans nouvelle version de sauvegarde

Les offrandes d'autel utilisent les champs existants `shards` et `healthUpgrades` du schéma v2 ; la résonance du Recueillement est transitoire et remise à zéro au respawn. Aucune migration n'est nécessaire et les sauvegardes 0.1.0 restent chargeables. Les nouvelles actions `down` et `heal` s'ajoutent aux bindings par défaut ; les remappages existants sont conservés par fusion.

## D017 — RT partagé sur manette

La manette standard n'a plus de bouton libre ergonomique. RT reste « interagir » à l'appui et devient « Recueillement » au maintien. Pour éviter un soin involontaire, le maintien est ignoré à la manette quand une interaction est disponible. Au clavier, F reste une touche dédiée. La plongée utilise le stick ou la croix vers le bas.

## D018 — Personnages toon procéduraux pilotés par les données

Chaque personnage est décrit dans `game-data/characters/appearance.ts` (cape plissée à pointes, capuche, masque, style des yeux, col, écharpe, clous, jambes, arme, accessoire, couleurs), validé par Zod et assemblé par `CharacterView`. `PuppetGeometry` produit des triangles à couleur plate et y précalcule un ombrage cartoon à trois tons ; les normales sont soudées par position pour que le rendu de contours Babylon (`renderOutline`) trace un trait d'encre continu. Les matériaux « puppet » sont non éclairés : Babylon y sort (émissif + ambiant) × couleur de sommet, donc seuls ces matériaux reçoivent un ambiant blanc (la scène a un ambiant blanc, tous les autres matériaux gardent leur ambiant noir par défaut et le glow, qui lit l'émissif, ne les illumine pas). Les personnages ignorent le brouillard pour rester lisibles devant le décor. L'écharpe et les voiles sont des chaînes de Verlet (`SecondaryChain`) purement visuelles, bornées en vitesse et réinitialisées après une téléportation. Les designs sont originaux : inspirés par le style des action-plateformes à silhouettes encapuchonnées, sans reprise d'un personnage existant.

## D019 — Tutoriel contextuel dans les drapeaux existants

Les invites de `game-data/quests/tutorial.ts` apparaissent dans une bande du laboratoire, après les pouvoirs requis, et se retirent dès que le joueur accomplit l'action n'importe où. L'apprentissage est enregistré comme drapeau `tutorial:<id>` dans les flags déjà sauvegardés : aucune migration. Le réglage « Aides contextuelles » (par défaut activé) masque les invites sans affecter le domaine.
