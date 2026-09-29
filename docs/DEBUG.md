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
eidra.setEnemyHealth('keeper', 0);
await eidra.save();
```

`snapshot().player.invulnerable` donne les secondes d'invulnérabilité restantes. `snapshot().gates` liste les portes qui barrent le chemin (`echo`, `stage-awakening` / `-watchers` / `-palimpsest`, `last-order-left` / `-right`, `obedience-left` / `-right`). `setEnemyHealth` vise un ennemi chargé par son identifiant de spawn.

Les commandes modifient la partie actuelle : réserver un emplacement aux tests. Elles ne sont pas requises pour terminer le parcours. L'API n'est pas une interface réseau.

`?renderer=webgl2` teste le fallback. Sans ce paramètre, WebGPU est tenté ; un échec de détection ou d'initialisation est journalisé, puis WebGL2 est initialisé. WebGL1 est refusé explicitement.

La mesure CPU inclut le tick gameplay et la soumission du rendu, hors attente GPU. Le temps GPU peut être indisponible ; afficher `n/a`, jamais inventer une valeur. Le navigateur logiciel n'est pas une qualification matérielle.
