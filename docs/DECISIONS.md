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
