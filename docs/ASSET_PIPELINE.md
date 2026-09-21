# Pipeline d'assets

Blender LTS compatible → GLB 2.0 → validation → optimisation → compression → manifeste → chargement par secteur. Blender n'est pas installé dans l'environnement initial. Utiliser des meshes procéduraux propres en attendant, marqués TODO_ART.

## Conventions

`zone_role_variant_lod0.glb`, unités mètres, +Y vertical au runtime, origines cohérentes, transforms appliquées, préfixe `COL_` pour proxies simples. Pas de collision triangle complexe pour le personnage.

## Budgets

Personnages / boss : texture 2048 px standard max ; ennemis 1024–2048 ; environnements 512–2048 ; petits props 512–1024. LOD si nécessaire : 100 / 50 / 20 / 5–10 %. Le manifeste doit inclure taille et SHA-256.

## Validation

Noms, compte de triangles, matériaux, dimensions textures, proxies de collision, transforms, LOD. Les outils doivent refuser les erreurs, jamais seulement imprimer un succès. La validation géométrique GLB ne remplace pas le validateur officiel Khronos.

## Droits

Uniquement assets originaux ou explicitement autorisés. Musique temporaire synthétisée localement. Inventaire de licences avant release.

## Commandes disponibles

```sh
blender --background --python blender/scripts/generate_lab.py
node tools/optimize-assets/index.mjs assets/environments/laboratory/laboratory_chunk_01_lod0.glb public/assets/laboratory/laboratory_chunk_01_lod0.glb
npm run validate:assets
npm run manifest
node tools/optimize-assets/texture.mjs source.png output.ktx2
```

La dernière commande requiert KTX-Software / toktx installé ; elle échoue explicitement s'il manque. Le slice utilise des matériaux procéduraux, donc aucune texture KTX2 n'est annoncée comme produite. Le script Blender est préparé mais non testé dans ce conteneur sans Blender.

`tools/create-pipeline-fixture.mjs` produit un cristal glTF original pour exercer la chaîne de validation et compression. Cette fixture n'est pas un modèle artistique final et n'est pas chargée à la place du laboratoire procédural. `AssetLoader.ts` prépare le remplacement progressif par des AssetContainer GLB, avec nettoyage en cas d'annulation.

Le validateur refuse les fichiers vides/corrompus, les erreurs Khronos, noms invalides, budgets triangle/matériaux, proxies absents et transformations non appliquées. Les textures PNG embarquées sont contrôlées jusqu'à 2048 px. Il ne prétend pas vérifier automatiquement le LOD artistique, tous les formats d'image ou la qualité visuelle ; une revue d'asset reste requise.
