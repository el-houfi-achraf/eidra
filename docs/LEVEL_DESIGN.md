# Level design

## Vertical slice : Laboratory of Awakening

1. Chambre d'éveil : espace sûr, mouvement, premier ancrage.
2. Galerie des veilleurs : trois archétypes, esquive et télégraphie.
3. Atrium de Mira : dialogue, Rémanence, plateformes du passé.
4. Chambre du contrepoids : Memory Step, mécanisme et secret de Kael.
5. Porte de l'obéissance : mini-boss, ancrage, Gardien Sans Visage.

Favoriser des boucles courtes, des vues sur les passages inaccessibles et un retour après acquisition. Chaque secteur possède ses ressources et ses proxies de collision. Ne jamais charger les neuf régions ensemble.

Chaque secteur a une ambiance et un motif de décor décrits dans `game-data/zones/moods.ts` (voir ART_DIRECTION) ; le décor en est généré à partir de la graine du secteur, sans placement manuel. Un nouveau secteur doit y recevoir une entrée (test unitaire).

## Acte II : Les Failles de cendre

Les données sont dans `game-data/zones/ashes.ts`, ajoutées à la suite du laboratoire sur la même route (x = 201 → 411).

1. La Porte de Nhalis (201–241) : ancrage x = 205, transmission de Sael, deux Rampants sur sol plein, deux corniches.
2. Les Champs de braise (241–281) : trois colonnes de feu (x = 246 / 255 / 264,5, période 3,2 s, décalées de 1,1 s) à traverser entre deux éruptions ; Porte-braise à distance, Rampant, Porteur de cendres ; fragment d'Ilyan sur la corniche haute (x = 257,5) ; Seconde impulsion (x = 277) devant la sortie scellée (x = 279,5).
3. La Faille (281–321) : ancrage x = 283,5 sur la berge proche, cinq corniches de 2,4 m au-dessus du vide ; deux montées (2,6 m et 2,8 m) dépassent un saut simple (2,5 m) et exigent le double saut ; deux Souvenirs errants survolent le gouffre ; fragment de Vaela au-dessus de la plus haute corniche. Tomber ramène à x = 284,5.
4. Le Brasier (321–361) : ancrage x = 322,5 juste avant l'arène (une défaite ne renvoie pas de l'autre côté de la Faille), arène de la Sentinelle de cendre, une colonne de feu au centre.
5. Le Jardin du déni (361–411) : ancrage x = 364, arène d'Ilyra, puis la fin de l'acte au-delà de x = 408,5.

## Monde complet (planifié)

Laboratory of Awakening ↔ Ash Rifts ↔ Glass Gardens ↔ Still Sea ↔ Drowned Archives ↔ Cathedral of Voices ↔ Broken Observatory ↔ Inverted Palace ↔ Heart of Remembrance. Des boucles transversales et raccourcis doivent remplacer une simple chaîne avant production. Fast travel tardif.

## Boss / thèmes

Gardien Sans Visage / obéissance ; Ilyra / déni ; Chœur des Mille Bouches / foi figée ; Oris / refus du changement ; Aurel / immortalité ; Sael / culpabilité ; Chœur / perte.

## Boucle jouable

La galerie de maintenance (x=123) rejoint la plateforme de la chambre d'éveil (x=22), après ouverture du contrepoids. Le retour permet de reconstruire les plateformes vers le fragment de Kael. Ce raccourci a deux entrées fixes et reste distinct du fast travel prévu tard dans la campagne.

Le pont du souvenir comporte trois plateformes disparues séparées par de petits écarts : activer Rémanence puis sauter. Le sceau x=130 exige la présence du joueur ou de son Écho ; la porte x=141 se verrouille en position ouverte une fois franchie. Le boss ferme le seuil derrière le joueur pendant le combat.

## Étapes et arènes scellées

| Étape                 | Gardiens                            | Sortie (x) |
| --------------------- | ----------------------------------- | ---------- |
| Chambre d'éveil       | Veilleur                            | 39         |
| Galerie des veilleurs | Souvenir errant, Porteur de cendres | 70         |
| Pont du souvenir      | Veilleur du pont                    | 119,8      |
| Porte de Nhalis       | deux Rampants                       | 239        |
| Champs de braise      | Porte-braise, Rampant, Porteur      | 279,5      |
| La Faille             | deux Souvenirs errants              | 320        |

Chaque sortie est dans son propre secteur, sur sol plein, à plus de 2 m d'un ancrage ; l'ancrage de Mira (x = 73) récompense la galerie, la relique de Memory Step (x = 119) reste à portée devant la sortie du pont. Un secteur qui reçoit des ennemis hors arène doit déclarer une étape (test unitaire).

| Arène            | Gardien                  | Portes (x)    | Seuil | Zone du gardien |
| ---------------- | ------------------------ | ------------- | ----- | --------------- |
| Le dernier ordre | Porteur du dernier ordre | 147,5 / 158,6 | 149,5 | 149 – 157,2     |
| L'obéissance     | Gardien Sans Visage      | 164 / 196     | 166   | 167 – 192       |
| Le Brasier       | Sentinelle de cendre     | 324 / 358     | 326,5 | 326 – 356       |
| Le déni          | Ilyra                    | 369,5 / 407,5 | 372   | 372 – 405       |

Le fragment de Seris et sa corniche sont dans l'antichambre (x = 144,5), avant l'arène du Porteur : aucune dalle basse à l'intérieur ne peut couper un corps de près de 3 m. L'ancrage du seuil (x = 160) est la récompense du Porteur. Le Veilleur du pont patrouille entre 112 et 119,5 pour laisser une zone d'atterrissage sûre au bout des plateformes du souvenir. Toute nouvelle dalle doit être vérifiée par le test « never lets a laboratory enemy overlap a solid slab ».

Aucune arène ne se contourne : le test E2E « guardians bar the way until they are defeated » pousse Eidra contre chaque porte du fond, puis vérifie qu'elle s'ouvre à la mort du gardien.
