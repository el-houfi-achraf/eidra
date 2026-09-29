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

### Troisième itération : arènes, collisions et animation

- **Correctif** : les gardiens ne se contournent plus. Chaque arène se scelle derrière Eidra et sa porte du fond reste fermée jusqu'à la victoire (Porteur du dernier ordre et Gardien Sans Visage), avec carte de titre, notification, barre de vie et cadrage de toute l'arène.
- **Correctif** : ennemis et boss ne traversent plus les obstacles. Leurs déplacements sont bornés par la géométrie du niveau et par les portes ; la corniche de Seris a été déplacée hors de l'arène du Porteur.
- **Combat** : les corps ennemis blessent au contact (non parable, boîte indulgente).
- **Animation** : anticipation / frappe / récupération lisibles pour chaque ennemi, silhouettes propres à chaque pattern du Gardien, sursaut à la détection, recul à l'impact ; inclinaison d'Eidra dans les coups et l'esquive, poussière de course et de saut, agenouillement à l'ancrage ; masque qui éclate à la mort puis reconstitution en lumière ; lames de lumière pour les pouvoirs et les gardiens vaincus ; portes qui jaillissent du sol.
- **UX** : autel sur le côté pour voir le repos, HUD qui tressaute sous les coups et bat à faible vie, caméra qui revient directement à l'ancrage au respawn, musique de combat aussi contre le Porteur.

### Cinquième itération : étapes scellées

- **Progression** : chaque secteur est une étape ; sa sortie reste scellée tant que ses gardiens ne sont pas vaincus (Veilleur de l'éveil ; Souvenir errant et Porteur de cendres ; Veilleur du pont), avant les arènes du Porteur et du Gardien. On ne peut plus passer une étape en marchant.
- **UX** : nombre de gardiens restants à l'approche d'une sortie scellée, annonce et sauvegarde à l'ouverture, état des sorties sur la carte ; une étape vaincue reste ouverte après une mort ou un rechargement.

### Quatrième itération : décor peint et ambiances

- **Décor peint** : le laboratoire est redessiné en silhouettes superposées dans une brume colorée — plafond de caverne et dents, lianes et racines, piliers ébréchés, arches, caverne lointaine, tours de la cité oubliée, avant-plan flou.
- **Ambiances** : chaque secteur a sa couleur et son motif (voûte turquoise, galerie bleue aux vitraux ambrés, abîme de jade, machinerie de bronze, salle du trône indigo et or), fondus entre eux.
- **Sols** : lisière pâle et irrégulière sous les pieds, touffes, pierres et racines, masse de terre sombre ; plateformes de mémoire en dalles fantômes lumineuses.
- **Lumière et atmosphère** : lanternes, amas de Lumérite, vitraux et ancrages entourés de halos, rayons teintés, nappes de brume qui dérivent, poussière aux couleurs du secteur.
- **Performance** : plus rapide qu'avant en rendu logiciel (jusqu'à −18 % en HIGH, −25 % en LOW).

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
