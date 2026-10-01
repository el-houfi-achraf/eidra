# Provenance et licences

L'histoire, les dialogues, les formes procédurales et la musique temporaire ont été créés pour EIDRA à partir du brief du propriétaire. Aucun sample musical ou modèle de jeu tiers n'est utilisé. Les assets artistiques portent TODO_ART jusqu'à validation de production.

Le générateur audio (`tools/generate_audio.py`) utilise, au moment de la génération seulement, numpy (BSD-3-Clause), scipy (BSD-3-Clause) et soundfile (BSD-3-Clause, avec libsndfile, LGPL-2.1, et ses codecs Vorbis / LAME embarqués dans la roue Python). Aucune de ces bibliothèques n'est livrée avec le jeu : seuls les fichiers OGG et MP3 produits le sont, et ils sont entièrement originaux. Le style de la partition s'inspire des action-plateformes dessinés à la main ; aucune mélodie, aucun son ni aucun enregistrement existant n'est repris.

Dépendances : Babylon.js core / GUI / loaders (Apache-2.0), Havok Web package (MIT), idb (ISC), Zod (MIT). Outils de développement : TypeScript, Vite, Vitest, Playwright, ESLint, Prettier, fake-indexeddb, glTF Transform, glTF Validator et meshoptimizer ; voir les LICENSE des versions verrouillées dans node_modules.

Les fichiers glslang et twgsl copiés dans `public/decoders` proviennent de la distribution Babylon.js 9.27.0. Conserver les mentions incorporées dans ces fichiers et le fichier de licence Babylon distribué à côté. Le décodeur meshoptimizer et sa licence MIT sont également inclus. Ne pas supprimer les mentions tierces lors du packaging.

La police système Georgia / Arial n'est ni copiée ni redistribuée. Les graphismes SVG du titre et de l'icône sont originaux.

L'attribution des droits et la licence de publication du code de jeu restent à décider par le propriétaire. Aucun transfert de droits sur les dépendances tierces n'est impliqué.
