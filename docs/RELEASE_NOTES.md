# Mise à jour « ressenti moderne » du prélude

## Livré

- **Combat** : hit-stop, tampon d'attaque, plongée avec rebond (pogo) qui recharge l'esquive, riposte ×2 dans la seconde qui suit une parade, parade sans délai après réussite.
- **Soin** : Recueillement, alimenté par la résonance des coups portés et des parades, interrompu par les dégâts.
- **Progression** : autel des ancrages, offrandes d'éclats pour +20 de vitalité (trois paliers), sans changement du format de sauvegarde v2.
- **Boss** : introduction et transition de phase blindées, carte de titre, pluie d'éclats télégraphiée en phase 2, barre de vie avec « chip », repère de phase et annonce du pattern.
- **Rendu** : caméra perspective à longue focale (parallaxe), ciel en dégradé, ligne d'horizon, silhouettes de premier plan, rayons de lumière, étalonnage ACES et vignette de danger, rim light des personnages.
- **Animation / VFX** : squash & stretch, inclinaison en course, flash blanc, dissolution des ennemis, croissant de lame, traînée de dash, poussière d'atterrissage, ondes de choc, éclats attirés vers Eidra, canalisation visible.
- **Interface** : HUD refondu (vie segmentée avec chip, résonance, éclats), chiffres de dégâts et de soin, barres de vie ennemies, cartes de titre de zones, bannière de pouvoir, dock circulaire avec temps de recharge, invites adaptées au dernier périphérique, dialogues tapés (le premier appui complète la ligne), écran d'autel.

### Deuxième itération : personnages, UI et UX

- **Personnages** redessinés et pilotés par les données : marionnettes toon à contours encrés, capuches, capes plissées, masques expressifs aux yeux lumineux qui clignent, écharpe et voiles animés, jambes animées. Chaque ennemi a une silhouette distincte (hallebarde, urne, bannière, voiles, masque sans visage).
- **HUD** : emblème-réceptacle en forme de masque qui se remplit de résonance et s'illumine quand un soin est disponible.
- **UX** : tutoriel contextuel mémorisé dans la sauvegarde, réglages par onglets (valeurs affichées, interrupteurs, réinitialisation, capture de touche guidée), notifications empilées, cartes de sauvegarde détaillées, pause avec objectif et commandes, carte en itinéraire, conseils.

## Limites connues de cette mise à jour

- Les valeurs (résonance, coûts d'offrande, durées de hit-stop, pluie d'éclats) sont des propositions de conception ; aucun playtest humain ne les a encore validées.
- Pas de nouveaux sons : le soin et les offrandes réutilisent les sons d'ancrage existants.
- Les mesures de performance restent logicielles (SwiftShader) ; voir PERFORMANCE.

# EIDRA 0.1.0 — Prélude du laboratoire

## Livré

Dépôt Git original sous Node 24, TypeScript strict, Vite, Babylon 9.27.0, Havok Web, Zod, idb. Cinq secteurs chargés à la demande, décor monumental procédural, gameplay et HUD séparés, deux capacités mémoire, trois archétypes ennemis, mini-boss, Gardien à deux phases, Mira, deux fragments, ancrages et sauvegardes versionnées. Menus DOM, HUD Babylon GUI, accessibilité et input abstrait, musique OGG originale avec secours PCM, build Cloudflare Pages.

## Corrections établies pendant les tests

Enregistrements explicites des composants modulaires Babylon (physique, particules, instrumentation). Conservation des taps clavier entre rendu et simulation. Nettoyage des ressources de secteurs. Préservation des proxies de collision pendant l'optimisation GLB. Validation du fichier audio avant remplacement atomique. Les noms accessibles des boutons excluent les glyphes décoratifs. Les tests E2E utilisent le build final et non le serveur HMR. Le contrôle aérien reprend immédiatement après un dash pour éviter de dépasser les plateformes ; les patrouilles restent sur les berges solides.

## Limites connues

- Ce livrable est un prototype de vertical slice, pas le jeu complet annoncé dans la vision.
- Les régions 2–9, six autres boss, trois autres capacités mémoire, wall slide / wall jump et les trois fins jouables restent à produire.
- Double jump existe dans le modèle de mouvement, mais n'est pas distribué dans le prélude.
- Art, animation et musique sont TODO_ART. Aucun Blender LTS n'est installé ici : scripts fournis, export Blender non exécuté.
- Le pipeline GLB / validation Khronos / compression meshopt est exécuté sur une fixture. L'export artistique Blender et la compression KTX2 par toktx restent à exécuter dans un environnement équipé.
- Les presets règlent résolution, ombres, bloom, particules, LOD de décor et brume. Le plafond texture est une règle du pipeline : les décors actuels n'utilisent pas de textures photographiques à réduire.
- Aucun playtest humain ne certifie encore la durée de 15–20 minutes, l'équilibrage final ou l'accessibilité complète.
- WebGL2 est testé dans Chromium avec SwiftShader ; WebGPU est testé au niveau de la négociation par mocks, pas qualifié sur GPU réel. Firefox, Safari et manettes physiques restent à tester.
- Le budget 60 FPS est une cible ; les mesures logicielles jointes ne prouvent pas qu'il est atteint sur ordinateur moyen.
- Aucun site Cloudflare n’est publié. GitHub est connecté au compte, mais aucun dépôt n’est accessible pour la synchronisation.

## Reprise

Lire README, ROADMAP et AGENT_RULES, lancer `npm ci`, puis `npm run check` et les E2E. Conserver les sauvegardes version 2. Ne pas réécrire les systèmes fonctionnels pour une préférence d'implémentation.
