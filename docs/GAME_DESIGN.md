# EIDRA: Shards of Silence

Metroidvania solo 2.5D. Piliers : exploration, combat lisible, mémoire physique, atmosphère monumentale. Qualité avant quantité. Aucun emprunt d'assets ou de personnages à une licence existante.

## Vertical slice — Le laboratoire oublié

Objectif de durée : 15–20 minutes, à confirmer par playtests humains. Réveil, apprentissage du mouvement, premières rencontres, Mira, acquisition de Rémanence, retour vers un passage oublié, Memory Step, sentinelle et Gardien Sans Visage. Le slice n'est pas le jeu complet.

## Boucle

Explorer → observer un obstacle → apprendre / combattre → retrouver un souvenir → modifier le monde → revenir ouvrir un passage → atteindre un ancrage. Les dangers et attaques sont télégraphiés. La défaite ramène au dernier ancrage.

## Mouvements et combat

Character controller capsule, accélération contrôlée, coyote time et jump buffer. Attaque légère en combo, attaque chargée, attaque aérienne, dash et fenêtre d'esquive. Hitboxes logiques séparées des modèles. Les options d'assistance ne modifient pas les fins.

Ressenti des coups (référence : action-plateformes modernes) : hit-stop court à chaque coup porté, plus long sur les finishers et les parades ; tampon d'attaque de 0,22 s ; zoom bref de la caméra sur les coups lourds ; flash blanc, knockback et chiffres de dégâts sur la cible.

- **Plongée** : en l'air, bas + attaque frappe sous Eidra. Un impact la fait rebondir à hauteur fixe et recharge l'esquive : les ennemis deviennent des appuis.
- **Parade → riposte** : une parade réussie remet son délai à zéro et ouvre une fenêtre d'une seconde où la prochaine attaque inflige le double et étourdit davantage. La lame s'illumine d'or tant que la riposte est disponible.
- **Recueillement** : chaque coup porté donne 11 de résonance (22 pour une parade), jusqu'à 99, soit trois segments. Maintenir le soin immobile pendant 0,8 s dépense un segment et rend 32 points de vie. Sauter, esquiver, attaquer ou être touché interrompt la canalisation. La résonance est perdue à la mort.
- **Autel des ancrages** : interagir avec l'ancrage déjà actif ouvre l'autel (repos, sauvegarde) et permet d'offrir des éclats pour +20 de vitalité maximale : 10, 20 puis 35 éclats.

## Apprentissage et interface

Un tutoriel contextuel remplace le long texte de départ : une invite (glyphe de touche ou de bouton + verbe) apparaît dans la zone où le geste devient utile — se déplacer, sauter, frapper, l'élan après son acquisition, parer près du Porteur de cendres, la Rémanence au pont, la plongée près du Veilleur du pont, l'Écho au sceau — et disparaît dès que le joueur l'a accompli, où qu'il soit. Le Recueillement n'est suggéré que blessé et avec un segment disponible. Les menus privilégient l'information utile : dernier ancrage sur l'écran titre, cartes de sauvegarde (lieu, durée, vitalité, éclats, souvenirs, pouvoirs), objectif et rappel des commandes en pause, carte en itinéraire avec marqueurs, conseils à la mort et au chargement.

## Arènes et contact

Aucune étape ne se contourne : la sortie de chaque secteur reste scellée tant que ses gardiens vivent — le Veilleur de la chambre d'éveil, le Souvenir errant et le Porteur de cendres de la galerie, le Veilleur du pont — puis le Porteur du dernier ordre et le Gardien Sans Visage gardent leurs arènes. Approcher d'une sortie scellée affiche le nombre de gardiens restants ; la vaincre ouvre la porte, l'annonce et sauvegarde. Une étape vaincue le reste, même si ses ennemis reviennent après une mort. La carte indique l'état de chaque sortie (⊘ scellée, ⊙ ouverte).

Un gardien d'arène ne se contourne pas non plus : franchir le seuil de son arène fait surgir une porte derrière Eidra, et celle du fond reste close tant qu'il vit (carte de titre, notification, caméra qui cadre toute l'arène, barre de vie en bas de l'écran — y compris pour le Porteur du dernier ordre). La victoire rabat les deux portes. Mourir rouvre l'entrée ; le gardien attend. Les corps ennemis blessent au contact, ce qui empêche de les traverser sans l'esquive ; l'esquive reste le moyen de passer à travers une attaque.

## Animation et lisibilité

Chaque coup ennemi suit anticipation → frappe → récupération : recul et arme levée (contour ambre, frisson dans les derniers instants), fente vers l'avant, puis affaissement qui ouvre une fenêtre de riposte. Un ennemi qui repère Eidra sursaute ; un ennemi touché recule. Le Gardien donne à chaque pattern une silhouette propre : recul pour le balayage, cabrage puis impact poussiéreux pour l'onde, accroupissement pour la charge, lévitation pour la pluie. Eidra s'incline dans ses coups et ses esquives, soulève de la poussière en courant et en sautant, s'agenouille à l'ancrage ; à la mort son masque se brise en éclats avant l'écran de défaite, et elle se reforme de lumière à l'ancrage. Les pouvoirs retrouvés et les gardiens vaincus irradient des lames de lumière. Le HUD tressaute sous les coups et bat comme un cœur quand la vie est basse.

## Gardien Sans Visage

Phase 1 : balayage, onde au sol, charge. Sous 50 % de vie, une transition blindée de 1,6 s (rugissement, onde de choc) ouvre la phase 2 : télégraphes raccourcis de 15 % et **pluie d'éclats**, cinq impacts marqués au sol et au plafond autour de la position d'Eidra, espacés de 2,6 m. Le Gardien est également blindé pendant son introduction. Chaque pattern est annoncé dans la barre de vie (« ONDE — SAUTEZ », « PLUIE D'ÉCLATS — QUITTEZ LES MARQUES »).

## Mémoire

Rémanence révèle des structures disparues ; Memory Step rejoue une trace temporelle pour maintenir un mécanisme. Les autres capacités sont prévues après validation du slice.

## Critères d'acceptation

Parcours jouable au clavier et à la manette, checkpoint persistant après rechargement, combat vérifiable, erreurs explicites, ressources des secteurs libérées, budget de rendu mesuré. 60 FPS reste une cible matérielle, jamais une promesse déduite d'un test CI.
