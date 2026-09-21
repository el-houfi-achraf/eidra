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
