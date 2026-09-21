# Performance

Cible : 60 FPS, frame 16,67 ms, CPU < 8 ms, GPU < 12 ms sur ordinateur moyen moderne. **La cible n’est pas certifiée sur matériel réel.**

## Mesures conservées

Protocole : build de production, Chromium 153.0.8010.0, WebGL2 / SwiftShader logiciel, fenêtre 1280 × 720, chambre d’éveil immobile, échauffement 3 s puis 120 frames par preset. Le CPU mesure la boucle complète de mise à jour et de soumission du rendu ; le temps GPU provient des queries disponibles, ici sur un renderer logiciel. Ce ne sont pas des mesures d’un GPU moyen.

| Mesure                            |            MEDIUM |              LOW |
| --------------------------------- | ----------------: | ---------------: |
| CPU médiane / p95                 |    1,80 / 2,60 ms |   1,20 / 1,50 ms |
| Rendu logiciel médiane / p95      |  59,37 / 79,09 ms | 29,45 / 37,32 ms |
| Frame médiane / p95               | 68,30 / 133,50 ms | 37,50 / 71,50 ms |
| Draw calls                        |                46 |               22 |
| Triangles soumis, passes incluses |            52 108 |           26 054 |

Le rendu logiciel est le facteur limitant de ce protocole, avec environ 15 / 27 FPS calculés à partir de la frame médiane. Aucune extrapolation à 60 FPS matériel n’est faite. Mesures brutes : [performance.json](evidence/performance.json).

## Optimisation et stabilité

La fusion Babylon des décors statiques par matériau a réduit le menu d’environ 230 à 46 draw calls dans le contrôle avant / après. Les colliders, marqueurs et structures mémoire restent séparés. Matériaux partagés, au plus trois chunks actifs, deux lumières, effets réutilisés par pools, niveaux de visibilité pour les décors éloignés.

Douze changements alternés entre x=123 et x=7 : respectivement 149 / 136 meshes, 6 / 5 ressources physiques, 2 / 1 chunks à chaque passage. Aucun accroissement de ces compteurs et aucune erreur navigateur pendant ce test. Cela ne remplace pas un profil de heap ou un test d’endurance.

LOW, MEDIUM, HIGH, ULTRA règlent render scale, ombres, particules, bloom, chromatisme, LOD et brume. Les plafonds de texture sont des budgets du pipeline ; le blockout actuel utilise des matériaux sans textures artistiques.

## Reproduire et poursuivre

```sh
npm run build
npx playwright install chromium
node tools/benchmark.mjs
```

Un exécutable Chromium existant peut être spécifié par `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Le script produit les mesures et les captures dans `docs/evidence`. Il force intentionnellement le rendu logiciel pour cette comparaison ; qualifier séparément WebGPU et WebGL2 sur GPU réel à 1080p, en exploration et pendant le boss. Mesurer les p95, la latence et le heap sur un parcours de 20 minutes avant d’annoncer 60 FPS stables.

Le bundle principal reste d’environ 1,77 Mo minifié / 431 ko gzip et déclenche l’avertissement Vite existant. Le moteur WebGPU, les shaders et plusieurs loaders sont séparés. Une nouvelle découpe doit être guidée par les mesures de chargement réel, sans augmenter le seuil pour masquer l’avertissement.
