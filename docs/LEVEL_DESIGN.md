# Level design

## Acte I : le laboratoire de l'éveil, en salles (D036)

L'Acte I compte **25 salles** : les 5 secteurs de la route (salles ouvertes le long de x, `laboratory.ts`) et 20 chambres fermées au-dessus et au-dessous (`depths.ts`), dont 3 secrètes. Une chambre est une boîte dont les murs ne s'ouvrent qu'à ses portes ; la carte du journal la dessine telle quelle.

| Couche (y)              | Salles, d'ouest en est (x)                                                                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hauts combles (33 à 55) | Sanctuaire de l'Écho (108–128, 41–55) · Beffroi (128–146)                                                                                                                                                                                          |
| Combles (11 à 37)       | Oculus\* (8–22) · Crypte des berceaux (22–40) · Nef haute (40–62) · Loge des lanternes (62–80) · Archives suspendues (80–108) et, au-dessus, Loge de Noa\* (96–108) · Combles du contrepoids (108–128) · Cage (128–146)                            |
| Route (−5 à 11)         | Chambre d'éveil (0–40) · Galerie des veilleurs (40–80) · Pont du souvenir (80–120) · Chambre du contrepoids (120–160) · Seuil de l'obéissance (160–201)                                                                                            |
| Profondeurs (−30 à −2)  | Épreuve de l'Élan (8–26) · Salle des élans (26–44) et, au-dessus, Cabinet scellé\* (30–44) · Archives englouties (44–74) · Puits de Mira (74–84) · Gouffre des copistes (84–110) · Escalier noyé (110–120, jusqu'à −52) · Chapelle noyée (120–136) |
| Fond (−52 à −30)        | Racines du souvenir (56–86) · Sanctuaire de la Rémanence (86–110)                                                                                                                                                                                  |

\* salle secrète, derrière un mur fêlé.

1. **Chambre d'éveil** (route, 0–40) : mouvement, saut, premier Veilleur. Les dalles fantômes de la Rémanence montent déjà vers le fragment de Kael, puis vers la crypte au-dessus : un retour promis.
2. **Galerie des veilleurs** (route, 40–80) : Souvenir errant, Porteur de cendres, parade ; ancrage de Mira (73). Après Mira, le sol s'ouvre sur **le puits** (78–80) : Mira dit que ce qu'on voulait oublier, on le descendait là.
3. **Les profondeurs** (−52 à −2) : le puits de Mira (une chute ; ses marches sont des souvenirs), les archives englouties (ancrage des archives, Coque murée, Phalènes), la salle des élans (**Élan de Lumérite**, ~10 min) et l'épreuve de l'Élan (un gouffre de 7,6 m, un reliquaire), le gouffre des copistes (8 m : seul l'Élan le franchit), l'escalier noyé (une montée de 22 m) et la chapelle noyée (deux Gisants, un reliquaire), le sanctuaire de la **Rémanence** (~20 min), puis les racines du souvenir : des marches remémorées jusqu'à une **grille** sous les archives, dont le levier est en bas (raccourci vers l'ancrage). Le puits se remonte alors par ses marches remémorées.
4. **Pont du souvenir** (route, 80–120) : la Rémanence refait le pont ; Veilleur du pont, sortie scellée.
5. **Chambre du contrepoids** (route, 120–160) : ancrage (136,5) ; des corniches montent vers la voûte (135–138) et **les combles** : la cage du contrepoids, le beffroi, le sanctuaire de l'**Écho mémoriel** (~35 min). L'Écho tient le sceau (130), la porte (141) s'ouvre sur le fragment de Seris et l'arène du Porteur.
6. **Les combles** reviennent vers l'ouest : combles du contrepoids (mur fêlé vers la loge de Noa), archives suspendues au-dessus du pont (Rémanence et Élan ; tomber ramène au pont), loge des lanternes (on retombe sur l'ancrage de Mira), nef haute, crypte des berceaux (fragment d'Aren) au-dessus de la chambre d'éveil, et l'oculus derrière un mur fêlé.
7. **Le seuil de l'obéissance** (route, 160–201) : Gardien Sans Visage, puis l'Acte II.

Pouvoirs espacés : Élan ~10 min, Rémanence ~20 min, Écho ~35 min (estimations à confirmer en playtest). Fragments : Kael, Deren (cabinet scellé), Aren, Noa, Seris dans l'Acte I ; Ilyan et Vaela dans l'Acte II : les sept sont placés. Trois secrets derrière des murs fêlés (cabinet, oculus, loge de Noa), quatre reliquaires d'éclats.

**Règles de construction** (tests `rooms`, `walkway`) : les chambres ne se chevauchent pas et ne montent pas dans une salle de la route (sous sa dalle de sol, à −2, ou au-dessus de sa voûte, à 11) ; sous un gouffre de la route, elles restent à 4 m sous la ligne de chute ; une porte mène toujours à une salle dont la porte lui fait face (ou, au sol, à un gouffre) ; les escaliers alternent deux colonnes avec des marches de 1,7 m au plus ; une ouverture au-dessus d'Eidra se franchit d'un saut (courant ascendant) depuis une marche sous elle ; les portes de progression montent jusqu'à la voûte. Le modèle de portée (`reach`) prouve l'ordre des pouvoirs et l'absence d'impasse.

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

Aucune dalle ne pend entre la taille et la tête d'Eidra (1 à 1,95 m au-dessus d'un sol) : une corniche au-dessus du passage la laisse passer dessous et reste à un saut, ou à une marche (D035, test `walkway`, chambres comprises). Ancrages : éveil (7), Mira (73), archives (72, −29,4, dans les profondeurs), contrepoids (136,5, avant le Porteur), seuil (160), Nhalis (205), braises (242,5, avant les colonnes de feu), Faille (283,5), Brasier (322,5), Jardin (364). Chaque sortie est dans son propre secteur, sur sol plein, à plus de 2 m d'un ancrage de la route ; l'ancrage de Mira (x = 73) récompense la galerie. Un secteur de la route qui reçoit des ennemis hors arène doit déclarer une étape (test unitaire) ; les chambres n'en ont pas.

| Arène            | Gardien                  | Portes (x)    | Seuil | Zone du gardien |
| ---------------- | ------------------------ | ------------- | ----- | --------------- |
| Le dernier ordre | Porteur du dernier ordre | 147,5 / 158,6 | 149,5 | 149 – 157,2     |
| L'obéissance     | Gardien Sans Visage      | 164 / 196     | 166   | 167 – 192       |
| Le Brasier       | Sentinelle de cendre     | 324 / 358     | 326,5 | 326 – 356       |
| Le déni          | Ilyra                    | 369,5 / 407,5 | 372   | 372 – 405       |

Le fragment de Seris et sa corniche sont dans l'antichambre (x = 144,5), avant l'arène du Porteur : aucune dalle basse à l'intérieur ne peut couper un corps de près de 3 m. L'ancrage du seuil (x = 160) est la récompense du Porteur. Le Veilleur du pont patrouille entre 112 et 119,5 pour laisser une zone d'atterrissage sûre au bout des plateformes du souvenir. Toute nouvelle dalle doit être vérifiée par le test « never lets a laboratory enemy overlap a solid slab ».

Aucune arène ne se contourne : le test E2E « guardians bar the way until they are defeated » pousse Eidra contre chaque porte du fond, puis vérifie qu'elle s'ouvre à la mort du gardien.
