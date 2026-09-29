# Level design

## Vertical slice : Laboratory of Awakening

1. Chambre d'éveil : espace sûr, mouvement, premier ancrage.
2. Galerie des veilleurs : trois archétypes, esquive et télégraphie.
3. Atrium de Mira : dialogue, Rémanence, plateformes du passé.
4. Chambre du contrepoids : Memory Step, mécanisme et secret de Kael.
5. Porte de l'obéissance : mini-boss, ancrage, Gardien Sans Visage.

Favoriser des boucles courtes, des vues sur les passages inaccessibles et un retour après acquisition. Chaque secteur possède ses ressources et ses proxies de collision. Ne jamais charger les neuf régions ensemble.

Chaque secteur a une ambiance et un motif de décor décrits dans `game-data/zones/moods.ts` (voir ART_DIRECTION) ; le décor en est généré à partir de la graine du secteur, sans placement manuel. Un nouveau secteur doit y recevoir une entrée (test unitaire).

## Monde complet (planifié)

Laboratory of Awakening ↔ Ash Rifts ↔ Glass Gardens ↔ Still Sea ↔ Drowned Archives ↔ Cathedral of Voices ↔ Broken Observatory ↔ Inverted Palace ↔ Heart of Remembrance. Des boucles transversales et raccourcis doivent remplacer une simple chaîne avant production. Fast travel tardif.

## Boss / thèmes

Gardien Sans Visage / obéissance ; Ilyra / déni ; Chœur des Mille Bouches / foi figée ; Oris / refus du changement ; Aurel / immortalité ; Sael / culpabilité ; Chœur / perte.

## Boucle jouable

La galerie de maintenance (x=123) rejoint la plateforme de la chambre d'éveil (x=22), après ouverture du contrepoids. Le retour permet de reconstruire les plateformes vers le fragment de Kael. Ce raccourci a deux entrées fixes et reste distinct du fast travel prévu tard dans la campagne.

Le pont du souvenir comporte trois plateformes disparues séparées par de petits écarts : activer Rémanence puis sauter. Le sceau x=130 exige la présence du joueur ou de son Écho ; la porte x=141 se verrouille en position ouverte une fois franchie. Le boss ferme le seuil derrière le joueur pendant le combat.

## Arènes scellées

| Arène            | Gardien                  | Portes (x)    | Seuil | Zone du gardien |
| ---------------- | ------------------------ | ------------- | ----- | --------------- |
| Le dernier ordre | Porteur du dernier ordre | 147,5 / 158,6 | 149,5 | 149 – 157,2     |
| L'obéissance     | Gardien Sans Visage      | 164 / 196     | 166   | 167 – 192       |

Le fragment de Seris et sa corniche sont dans l'antichambre (x = 144,5), avant l'arène du Porteur : aucune dalle basse à l'intérieur ne peut couper un corps de près de 3 m. L'ancrage du seuil (x = 160) est la récompense du Porteur. Le Veilleur du pont patrouille entre 112 et 119,5 pour laisser une zone d'atterrissage sûre au bout des plateformes du souvenir. Toute nouvelle dalle doit être vérifiée par le test « never lets a laboratory enemy overlap a solid slab ».

Aucune arène ne se contourne : le test E2E « guardians bar the way until they are defeated » pousse Eidra contre chaque porte du fond, puis vérifie qu'elle s'ouvre à la mort du gardien.
