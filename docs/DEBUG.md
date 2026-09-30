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
eidra.teleport(373); // arène d'Ilyra (Acte II)
eidra.setEnemyHealth('keeper', 0);
await eidra.save();
```

`snapshot().device` indique le dernier périphérique utilisé (`keyboard` / `gamepad`) et `snapshot().pad` la manette en main (`name`, `family`, `profile` : `standard`, `evdev-xbox`, `evdev-playstation` ou `generic`). Les parcours E2E remplacent `navigator.getGamepads` par une manette scriptée et émettent `gamepadconnected` / `gamepaddisconnected`. `snapshot().player.invulnerable` donne les secondes d'invulnérabilité restantes. `snapshot().gates` liste les portes qui barrent le chemin (`echo`, `stage-<secteur>` pour chaque étape, `<arène>-left` / `-right` pour `last-order`, `obedience`, `brazier` et `denial`). `snapshot().boss` décrit le Gardien Sans Visage ; `snapshot().bosses` décrit chaque boss (vie, état, phase, pattern en cours, marques au sol). `setBossHealth(valeur, id)` vise le Gardien par défaut, ou le boss nommé (`ilyra`). `setEnemyHealth` vise un ennemi chargé par son identifiant de spawn (`keeper`, `cinder-warden`…).

Les commandes modifient la partie actuelle : réserver un emplacement aux tests. Elles ne sont pas requises pour terminer le parcours. L'API n'est pas une interface réseau.

`?renderer=webgl2` teste le fallback. Sans ce paramètre, WebGPU est tenté ; un échec de détection ou d'initialisation est journalisé, puis WebGL2 est initialisé. WebGL1 est refusé explicitement.

La mesure CPU inclut le tick gameplay et la soumission du rendu, hors attente GPU. Le temps GPU peut être indisponible ; afficher `n/a`, jamais inventer une valeur. Le navigateur logiciel n'est pas une qualification matérielle.
