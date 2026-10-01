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

## Audio

Tout l'audio de `public/audio` est généré par `tools/generate_audio.py` (D033) :

```bash
pip install -r tools/requirements-audio.txt
python3 tools/generate_audio.py                 # tout (≈ 30 s sur 4 cœurs)
python3 tools/generate_audio.py sfx stingers    # certains groupes : music, stingers, ambience, sfx
npm run validate:assets && npm run manifest
```

Dossiers : `music/` (thèmes en boucle, 32 kHz stéréo), `stingers/` (motifs courts), `ambience/` (lits d'ambiance en boucle), `sfx/<cue>-<n>` (bruitages, 44,1 kHz mono, une variante par fichier). Chaque son existe en `.ogg` (Vorbis) et en `.mp3` (secours) ; un fichier qu'aucune source ne produit plus est supprimé à la régénération de son groupe. Ajouter un bruitage : une recette dans `tools/audio/sfx.py` (table `EFFECTS`), une entrée dans `game-data/audio/sounds.ts` (variantes, volume, dispersion de hauteur, délai, bus, creux de musique, sous-titre), puis l'appel `fx.sound('<cue>')` ; les tests échouent si un fichier manque ou reste orphelin. Ajouter un thème : une fonction dans `tools/audio/music.py`, une entrée dans `game-data/audio/music.ts` et son secteur ou son boss.

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
