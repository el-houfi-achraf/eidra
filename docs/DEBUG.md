# Diagnostic

Ouvrir `/?debug=1`. Le panneau est absent sans ce paramètre. Les APIs de diagnostic ne sont exposées que lorsque le joueur active ce mode.

Dans la console navigateur :

```js
eidra.snapshot();
eidra.teleport(73, 1.2);
eidra.unlock('remanence');
eidra.unlock('memory-step');
eidra.damage(20);
eidra.setBossHealth(150);
eidra.setBossHealth(300, 'ilyra');
eidra.setResonance(99); // neuf cartes en orbite
eidra.teleport(373); // arène d'Ilyra (Acte II)
eidra.setBossHealth(0, 'keeper');
eidra.forceBossPattern('keeper', 'standard');
eidra.setEnemyHealth('watcher-1', 0);
await eidra.save();
```

`snapshot().audio` décrit le son : `ready` (moteur démarré), `cues` (variantes de bruitages chargées), `streams` (boucles de musique et d'ambiance en lecture), `mix` (gain de chaque thème et ambiance, creux, niveau) et `recent` (derniers bruitages et motifs joués, `stinger:<id>` pour les motifs). `snapshot().cards` liste les cartes lancées en vol (`x`, `y`). `snapshot().device` indique le dernier périphérique utilisé (`keyboard` / `gamepad`) et `snapshot().pad` la manette en main (`name`, `family`, `profile` : `standard`, `evdev-xbox`, `evdev-playstation` ou `generic`). Les parcours E2E remplacent `navigator.getGamepads` par une manette scriptée et émettent `gamepadconnected` / `gamepaddisconnected`. `snapshot().player.invulnerable` donne les secondes d'invulnérabilité restantes. `snapshot().gates` liste les portes qui barrent le chemin (`echo`, `stage-<secteur>` pour chaque étape, `<arène>-left` / `-right` pour `last-order`, `obedience`, `brazier` et `denial`). `snapshot().boss` décrit le Gardien Sans Visage ; `snapshot().bosses` décrit chaque boss (vie, état, phase, pattern en cours, marques au sol, position, démarche et `effects` : position de l'étendard, geysers, reflets, regard du Commandement, bond en cours). `setBossHealth(valeur, id)` vise le Gardien par défaut, ou le boss nommé (`keeper`, `cinder-warden`, `ilyra`). `forceBossPattern(id, pattern)` fait jouer un pattern de la rotation de la phase courante : tout de suite pendant l'approche, sinon après le coup en cours. `setEnemyHealth` vise un ennemi chargé par son identifiant de spawn (`watcher-1`, `crawler-1`…).

Les commandes modifient la partie actuelle : réserver un emplacement aux tests. Elles ne sont pas requises pour terminer le parcours. L'API n'est pas une interface réseau.

`?renderer=webgl2` teste le fallback. Sans ce paramètre, WebGPU est tenté ; un échec de détection ou d'initialisation est journalisé, puis WebGL2 est initialisé. WebGL1 est refusé explicitement.

La mesure CPU inclut le tick gameplay et la soumission du rendu, hors attente GPU. Le temps GPU peut être indisponible ; afficher `n/a`, jamais inventer une valeur. Le navigateur logiciel n'est pas une qualification matérielle.
