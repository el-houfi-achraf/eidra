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

### Quatrième itération : décor peint et ambiances

Comparaison A / B dans la même session (build `main` précédent contre ce build, servis côte à côte, médiane de 40 images par scène, moyenne de deux passages en MEDIUM, un passage en HIGH et LOW), 1280 × 720, SwiftShader. Frame médiane en ms, avant → après :

| Scène (x)                  | MEDIUM        | HIGH          | LOW         |
| -------------------------- | ------------- | ------------- | ----------- |
| Chambre d'éveil (10)       | 189,3 → 181,4 | 275,1 → 256,1 | 89,9 → 72,9 |
| Galerie des veilleurs (57) | 189,0 → 193,8 | 268,7 → 248,7 | 70,3 → 55,3 |
| Pont du souvenir (96)      | 176,9 → 168,6 | 250,3 → 217,6 | 59,8 → 45,1 |
| Arène du Porteur (146)     | 187,9 → 176,6 | 261,0 → 216,5 | 64,5 → 52,8 |
| Arène du Gardien (170)     | 176,8 → 166,3 | 250,5 → 205,7 | 65,4 → 49,7 |

Le décor peint est **plus rapide** que l'ancien décor en boîtes éclairées : de −4 à −6 % en MEDIUM (sauf la galerie, +2,5 %, dans le bruit), de −7 à −18 % en HIGH, de −18 à −25 % en LOW (mesure LOW prise avant l'ajout des dalles fantômes, qui ajoutent un maillage par secteur à mémoire). Les matériaux non éclairés évitent l'éclairage par fragment et les faces latérales des boîtes ; les draw calls restent comparables (±6), car chaque secteur ne compte plus que six maillages peints. CPU inchangé à ±0,6 ms : la génération du décor se fait une fois au chargement du secteur.

Protocole standard (`tools/benchmark.mjs`) : MEDIUM CPU 3,8 / 6,5 ms, rendu logiciel 156,7 / 198,0 ms, 64 draw calls, 54 794 triangles ; LOW CPU 2,2 / 3,7 ms, rendu 47,5 / 77,4 ms, 26 draw calls, 27 921 triangles. Douze allers-retours x = 123 / 7 : 262 / 251 meshes, 7 / 5 ressources physiques, 2 / 1 chunks, stables. Bundle principal : 1,89 Mo minifié / 469 ko gzip.

### Cinquième itération : étapes scellées

Trois portes de plus, désactivées une fois ouvertes. Protocole standard : mêmes draw calls et triangles (64 / 54 794 en MEDIUM, 26 / 27 921 en LOW), CPU 4,0 / 2,4 ms et rendu logiciel 154,5 / 46,8 ms, dans le bruit des mesures précédentes. Allers-retours x = 123 / 7 : 265 / 254 meshes, 7 / 6 ressources physiques (la sortie scellée de la chambre d'éveil reçoit son collider à moins de 45 m), 2 / 1 chunks, stables.

### Sixième itération : boss plus complexes et Acte II

Comparaison A / B dans la même session (build `main` précédent contre ce build, servis côte à côte, médiane de 40 images par scène, moyenne de deux passages), MEDIUM, 1280 × 720, SwiftShader. Frame médiane en ms, avant → après : chambre d'éveil 153,9 → 154,1 ; galerie 166,8 → 167,9 ; pont 148,9 → 148,6 ; arène du Porteur 149,3 → 149,5 ; arène du Gardien 144,5 → 143,4. CPU à ±0,5 ms, draw calls identiques à ±2 : **l'Acte I n'est pas affecté** par le moteur de boss générique ni par les dangers.

Scènes de l'Acte II, même protocole, un passage par preset (frame médiane en ms / draw calls) :

| Scène (x)              | LOW       | MEDIUM      | HIGH        |
| ---------------------- | --------- | ----------- | ----------- |
| Chambre d'éveil (10)   | 66,4 / 27 | 155,4 / 66  | 212,3 / 80  |
| Porte de Nhalis (214)  | 42,4 / 28 | 148,9 / 72  | 191,2 / 95  |
| Champs de braise (252) | 45,2 / 47 | 157,7 / 102 | 203,4 / 135 |
| La Faille (284,5)      | 44,4 / 40 | 149,0 / 92  | 187,0 / 121 |
| Le Brasier (330)       | 43,9 / 37 | 142,2 / 88  | 185,4 / 108 |
| Jardin du déni (380)   | 43,7 / 22 | 142,9 / 64  | 188,3 / 80  |

Aucune scène de l'Acte II n'est plus lente que la chambre d'éveil de référence. Les Champs de braise ont le plus de draw calls (trois colonnes de feu à deux plans chacune, cinq ennemis animés proches) sans coût mesurable sur la frame ; CPU 7,1 ms en MEDIUM contre 5,7 ms pour la chambre d'éveil (trois ennemis actifs, dont un tireur). Les colonnes et les marionnettes de boss ne sont créées qu'à proximité ; les colonnes sont libérées avec leur secteur.

Protocole standard : 64 draw calls / 54 794 triangles en MEDIUM, 26 / 27 921 en LOW, identiques ; CPU 4,3 / 2,6 ms et rendu logiciel 153,3 / 64,5 ms, dans le bruit des mesures précédentes. Allers-retours x = 123 / 7 : 273 / 262 meshes (+8 : les boîtes de collision invisibles des sept portes de l'Acte II et trois marques au sol de plus pour les pluies à six marques ; la marionnette du Gardien n'est plus créée qu'à l'approche de son arène), 7 / 6 ressources physiques, 2 / 1 chunks, stables. Allers-retours dans l'Acte II (x = 262 / 214 six fois, puis 300 / 385 trois fois) : 328 / 269 puis 327 / 254 meshes, 16 / 6 puis 14 / 5 ressources physiques, stables, sans erreur. Bundle principal : 1,91 Mo minifié / 473 ko gzip.

### Septième itération : toutes les manettes

Aucun changement de rendu. Protocole standard : 64 / 26 draw calls et 54 794 / 27 921 triangles, identiques ; CPU 4,0 / 2,5 ms et rendu logiciel 150,2 / 65,2 ms en MEDIUM / LOW, dans le bruit des mesures précédentes ; allers-retours de streaming inchangés (273 / 262 meshes, 7 / 6 ressources physiques, 2 / 1 chunks). Lecture d'une manette par image (normalisation, quatorze liaisons, directions), mesurée sous Node : environ 3 µs, négligeable devant le budget CPU. Bundle principal : 1,93 Mo minifié / 478 ko gzip (+14 ko / +5 ko).

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
