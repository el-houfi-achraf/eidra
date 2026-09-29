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

Le rendu logiciel est le facteur limitant de ce protocole, avec environ 15 / 27 FPS calculés à partir de la frame médiane. Aucune extrapolation à 60 FPS matériel n’est faite.

## Mise à jour « ressenti moderne » : avant / après

Même protocole, même machine pour les deux colonnes : conteneur cloud, Chromium 141.0.7390.37, SwiftShader. Cette machine est environ 2,5 fois plus lente que celle des mesures 0.1.0 ci-dessus ; seules les comparaisons à l’intérieur de ce tableau sont significatives.

| Mesure (médiane / p95)     | MEDIUM avant     | MEDIUM après     | LOW avant      | LOW après      |
| -------------------------- | ---------------- | ---------------- | -------------- | -------------- |
| CPU                        | 3,1 / 7,9 ms     | 3,3 / 7,1 ms     | 2,0 / 5,2 ms   | 2,0 / 5,1 ms   |
| Rendu logiciel             | 151,5 / 206,6 ms | 168,0 / 218,7 ms | 64,1 / 94,6 ms | 62,0 / 84,7 ms |
| Draw calls                 | 46               | 54               | 22             | 23             |
| Triangles, passes incluses | 52 108           | 52 484           | 26 054         | 26 234         |

Coût mesuré de chaque ajout en MEDIUM (rendu logiciel médian, désactivation isolée, première itération) : étalonnage appliqué par fragment dans les matériaux ≈ 66 ms, ciel plein écran ≈ 30 ms, rayons de lumière ≈ 12 ms, silhouettes de premier plan ≈ 6 ms ; caméra perspective, rim light fresnel et flou du glow : non mesurables (< 3 ms). L’étalonnage a donc été déplacé dans un seul passage plein écran (`ImageProcessingPostProcess`), avec FXAA en MEDIUM à la place du MSAA et MSAA 4× conservé en HIGH / ULTRA ; LOW garde le chemin non étalonné, sans ciel ni rayons (D014). Résultat : +11 % de rendu logiciel en MEDIUM, aucun écart en LOW, CPU inchangé.

Douze allers-retours x = 123 / 7 : 257 / 242 meshes, 6 / 5 ressources physiques, 2 / 1 chunks, stables à chaque passage. La hausse du nombre de meshes vient des pools VFX préalloués (étincelles, ondes, éclats, traînée, marqueurs de pluie), désactivés hors usage et sans draw call. Le bundle principal passe à 1,82 Mo minifié / 440 ko gzip.

### Deuxième itération : personnages toon, HUD et interface

Même machine et même protocole, comparés à la colonne « après » ci-dessus.

| Mesure (médiane / p95)     | MEDIUM itération 1 | MEDIUM itération 2 | LOW itération 1 | LOW itération 2 |
| -------------------------- | ------------------ | ------------------ | --------------- | --------------- |
| CPU                        | 3,3 / 7,1 ms       | 4,2 / 7,4 ms       | 2,0 / 5,1 ms    | 2,3 / 6,3 ms    |
| Rendu logiciel             | 168,0 / 218,7 ms   | 171,0 / 212,4 ms   | 62,0 / 84,7 ms  | 58,0 / 81,7 ms  |
| Draw calls                 | 54                 | 62                 | 23              | 29              |
| Triangles, passes incluses | 52 484             | 54 608             | 26 234          | 28 440          |

Les nouveaux personnages ajoutent environ 1 ms de CPU (animation des jambes, de la lame et des chaînes d'écharpe, mise à jour des rubans) et quelques draw calls par personnage visible (contour encré du corps et de l'arme, yeux lumineux, jambes, ruban). Le rendu logiciel varie dans le bruit de mesure. Douze allers-retours x = 123 / 7 : 255 / 241 meshes, 6 / 5 ressources physiques, 2 / 1 chunks, stables. Bundle principal : 1,87 Mo minifié / 456 ko gzip.

### Troisième itération : arènes, collisions et animation

Comparaison A / B dans la même session (build `main` précédent contre ce build, servis côte à côte, deux passages alternés, médiane de 40 images par scène puis moyenne des passages), MEDIUM, 1280 × 720, SwiftShader :

| Scène (x)                  | Frame avant | Frame après | CPU avant | CPU après | Draw calls avant / après |
| -------------------------- | ----------- | ----------- | --------- | --------- | ------------------------ |
| Chambre d'éveil (10)       | 169,3 ms    | 170,4 ms    | 3,4 ms    | 4,2 ms    | 64 / 64                  |
| Galerie des veilleurs (30) | 173,1 ms    | 176,6 ms    | 5,0 ms    | 5,6 ms    | 97 / 97                  |
| Arène du Porteur (150,5)   | 171,4 ms    | 172,3 ms    | 4,8 ms    | 4,5 ms    | 86 / 90                  |
| Arène du Gardien (170)     | 166,3 ms    | 172,0 ms    | 3,2 ms    | 4,1 ms    | 70 / 72                  |

Écart de +0,5 à +3,4 % sur la frame, dans l'ordre du bruit de ce renderer logiciel. Les draw calls supplémentaires sont les portes d'arène visibles (une par porte). Le CPU gagne jusqu'à environ 0,9 ms : calcul des poses, bornes de déplacement, dégâts de contact, secousse du HUD. Aucune optimisation n'a été jugée nécessaire.

Protocole standard (`tools/benchmark.mjs`, chambre d'éveil immobile, 120 images) : MEDIUM CPU 3,5 / 6,9 ms, rendu logiciel 150,7 / 209,1 ms, 62 draw calls, 54 608 triangles ; LOW CPU 2,2 / 6,0 ms, rendu 52,4 / 76,4 ms, 29 draw calls, 28 440 triangles. Ces valeurs absolues varient d'une exécution à l'autre sur cette machine ; seule la comparaison A / B ci-dessus isole l'effet des changements. Douze allers-retours x = 123 / 7 : 259 / 245 meshes (quatre portes d'arène et le maillage des lames de lumière, désactivés hors usage), 7 / 5 ressources physiques (à x = 123, la porte du fond de l'arène du Porteur est à moins de 45 m et reçoit son collider statique), 2 / 1 chunks, stables. Bundle principal : 1,88 Mo minifié / 463 ko gzip.

Mesures brutes : [performance.json](evidence/performance.json) (dernière itération).

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
