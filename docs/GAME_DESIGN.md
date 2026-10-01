# EIDRA: Shards of Silence

Metroidvania solo 2.5D. Piliers : exploration, combat lisible, mémoire physique, atmosphère monumentale. Qualité avant quantité. Aucun emprunt d'assets ou de personnages à une licence existante.

## Deux actes jouables

**Acte I — Le laboratoire oublié.** Réveil, apprentissage du mouvement, premières rencontres, Mira, acquisition de Rémanence, retour vers un passage oublié, Memory Step, Porteur du dernier ordre et Gardien Sans Visage. L'adieu de Mira ouvre la porte de Nhalis.

**Acte II — Les Failles de cendre.** Rampants qui bondissent, Porte-braise qui tirent des salves, colonnes de feu à traverser en rythme, Seconde impulsion (double saut), la Faille à franchir de corniche en corniche sous les Souvenirs errants, la Sentinelle de cendre, puis Ilyra au Jardin du déni et l'épilogue. Objectif de durée : 35–50 minutes pour les deux actes, à confirmer par playtests humains. Les deux actes ne sont pas le jeu complet.

## Boucle

Explorer → observer un obstacle → apprendre / combattre → retrouver un souvenir → modifier le monde → revenir ouvrir un passage → atteindre un ancrage. Les dangers et attaques sont télégraphiés. La défaite ramène au dernier ancrage.

## Mouvements et combat

Character controller capsule, accélération contrôlée, coyote time et jump buffer. Attaque légère en combo, attaque chargée, attaque aérienne, dash et fenêtre d'esquive. Hitboxes logiques séparées des modèles. Les options d'assistance ne modifient pas les fins.

Ressenti des coups (référence : action-plateformes modernes) : hit-stop court à chaque coup porté, plus long sur les finishers et les parades ; tampon d'attaque de 0,22 s ; zoom bref de la caméra sur les coups lourds ; flash blanc, knockback et chiffres de dégâts sur la cible.

- **Plongée** : en l'air, bas + attaque frappe sous Eidra. Un impact la fait rebondir à hauteur fixe et recharge l'esquive : les ennemis deviennent des appuis.
- **Parade → riposte** : une parade réussie remet son délai à zéro et ouvre une fenêtre d'une seconde où la prochaine attaque inflige le double et étourdit davantage. Le bâton et les cartes s'illuminent d'or tant que la riposte est disponible ; pendant la parade, les cartes forment un bouclier devant Eidra.
- **Recueillement** : chaque coup porté donne 11 de résonance (22 pour une parade), jusqu'à 99, soit trois segments. Maintenir le soin immobile pendant 0,8 s dépense un segment et rend 32 points de vie. Sauter, esquiver, attaquer ou être touché interrompt la canalisation. La résonance est perdue à la mort.
- **Cartes** : la résonance est visible sous forme de cartes qui tournent autour d'Eidra (une par tranche de 11, neuf au plus). Un appui bref sur la touche de Recueillement (moins de 0,2 s, comme le sort et le soin partagés des action-plateformes de référence) lance une carte pour 22 de résonance : 16 dégâts, 18 m/s, 13 m de portée, arrêtée par les murs et les portes fermées, dépensée sur le premier corps touché, et qui ne rend pas de résonance. Pendant la fenêtre de riposte, le lancer devient un éventail de trois cartes. Sans résonance suffisante, le geste avorte. Chaque carte lancée est donc un choix entre frapper de loin et se soigner.
- **Bâton** : le combo de trois coups enchaîne un balayage bas, un arc montant et un estoc en fente. L'attaque chargée lève le bâton au-dessus de la tête puis libère une rafale de cartes : sa portée passe à environ 3,8 m. La plongée pointe le bâton vers le bas.
- **Autel des ancrages** : interagir avec l'ancrage déjà actif ouvre l'autel (repos, sauvegarde) et permet d'offrir des éclats pour +20 de vitalité maximale : 10, 20 puis 35 éclats.

## Apprentissage et interface

Un tutoriel contextuel remplace le long texte de départ : une invite (glyphe de touche ou de bouton + verbe) apparaît dans la zone où le geste devient utile — se déplacer, sauter, frapper, l'élan après son acquisition, parer près du Porteur de cendres, la Rémanence au pont, la plongée près du Veilleur du pont, l'Écho au sceau — et disparaît dès que le joueur l'a accompli, où qu'il soit. Le Recueillement n'est suggéré que blessé et avec un segment disponible. Les menus privilégient l'information utile : dernier ancrage sur l'écran titre, cartes de sauvegarde (lieu, durée, vitalité, éclats, souvenirs, pouvoirs), objectif et rappel des commandes en pause, carte en itinéraire avec marqueurs, conseils à la mort et au chargement.

## Manettes

Le jeu se joue entièrement à la manette, quel qu'en soit le modèle, comme les action-plateformes de référence. Disposition par défaut : saut en bas (A / ✕), frappe à gauche (X / □), recueillement à droite maintenu (B / ○), Rémanence en haut (Y / △), esquive sur la gâchette droite, attaque chargée sur la gauche, parade et Memory Step sur les gâchettes hautes, carte sur Select, pause sur Start, parler / s'ancrer / ouvrir un passage en poussant vers le haut, plongée avec bas + frappe. Le stick à mi-course fait marcher. Chaque action (hors déplacement, visée et pause) se réassigne à la manette seule ; la zone morte, la force des vibrations et le style des symboles se règlent. Les menus se parcourent à la manette (navigation spatiale, curseurs et listes à gauche / droite, onglets aux gâchettes hautes, retour sur B / ○). Vibrations : coup porté (léger), parade, blessure, choc lourd, victoire, mort. Débrancher la manette met le jeu en pause.

## Arènes et contact

Aucune étape ne se contourne : la sortie de chaque secteur reste scellée tant que ses gardiens vivent — le Veilleur de la chambre d'éveil, le Souvenir errant et le Porteur de cendres de la galerie, le Veilleur du pont — puis le Porteur du dernier ordre et le Gardien Sans Visage gardent leurs arènes. Dans l'Acte II : les deux Rampants de la Porte de Nhalis ; le Porte-braise, le Rampant et le Porteur de cendres des Champs de braise ; les deux Souvenirs errants de la Faille ; puis la Sentinelle de cendre et Ilyra dans leurs arènes. Approcher d'une sortie scellée affiche le nombre de gardiens restants ; la vaincre ouvre la porte, l'annonce et sauvegarde. Une étape vaincue le reste, même si ses ennemis reviennent après une mort. La carte indique l'état de chaque sortie (⊘ scellée, ⊙ ouverte).

Un gardien d'arène ne se contourne pas non plus : franchir le seuil de son arène fait surgir une porte derrière Eidra, et celle du fond reste close tant qu'il vit (carte de titre, notification, caméra qui cadre toute l'arène, barre de vie en bas de l'écran — y compris pour le Porteur du dernier ordre). La victoire rabat les deux portes. Mourir rouvre l'entrée ; le gardien attend. Les corps ennemis blessent au contact, ce qui empêche de les traverser sans l'esquive ; l'esquive reste le moyen de passer à travers une attaque.

## Animation et lisibilité

Chaque coup ennemi suit anticipation → frappe → récupération : recul et arme levée (contour ambre, frisson dans les derniers instants), fente vers l'avant, puis affaissement qui ouvre une fenêtre de riposte. Un ennemi qui repère Eidra sursaute ; un ennemi touché recule. Le Gardien donne à chaque pattern une silhouette propre : recul pour le balayage, cabrage puis impact poussiéreux pour l'onde, accroupissement pour la charge, lévitation pour la pluie. Eidra s'incline dans ses coups et ses esquives, soulève de la poussière en courant et en sautant, s'agenouille à l'ancrage ; à la mort son masque se brise en éclats avant l'écran de défaite, et elle se reforme de lumière à l'ancrage. Les pouvoirs retrouvés et les gardiens vaincus irradient des lames de lumière. Le HUD tressaute sous les coups et bat comme un cœur quand la vie est basse.

## Boss

Chaque boss est décrit par des données (D027) : deux ou trois phases séparées par une transition blindée (rugissement, onde de choc), une rotation de patterns qui s'élargit à chaque phase, des télégraphes qui raccourcissent et des enchaînements (le pattern suivant part sans récupération, avec une anticipation plus courte). Chaque pattern reste annoncé dans la barre de vie et par une silhouette propre ; les repères de phase sont tracés sur la barre. Un boss est blindé pendant son introduction et ses transitions ; l'étourdir interrompt un enchaînement.

Chaque boss a sa capacité signature et sa démarche (D032) : on les reconnaît à leur façon de bouger avant même leur premier coup.

**Porteur du dernier ordre** (260 PV, deux phases), marche lourde par à-coups. Phase 1 : taille (enchaînée d'un revers en phase 2), assaut, **Étendard** — il plante sa bannière à côté de lui ; elle envoie des ondes des deux côtés toutes les 1,3 s pendant 5 s pendant qu'il continue à se battre. Sous 50 % : télégraphes ×0,8, **Décret** (onde) enchaîné de l'étendard.

**Gardien Sans Visage** (460 PV), en lévitation, entouré d'éclats. Phase 1 : balayage, onde au sol, charge. Sous 60 % : télégraphes ×0,82, **pluie d'éclats** (cinq impacts marqués autour d'Eidra, espacés de 2,6 m) et balayage enchaîné d'une charge. Sous 28 % : télégraphes ×0,68, **disparition** (une marque montre où il réapparaît, derrière Eidra ou du côté libre si un mur l'en empêche) suivie d'un balayage puis d'une charge, **ondes successives** (trois paires d'ondes à sauter en rythme, toutes les 0,45 s) et onde suivie de la pluie. Dès la phase 2, **Commandement** : « NE BOUGEZ PLUS » — un œil s'ouvre au-dessus d'Eidra ; chaque mouvement pendant les contrôles fait tomber un éclat sur elle et l'œil rougit.

**Sentinelle de cendre** (380 PV, deux phases), par bonds, braises en orbite. Entaille enchaînée d'un revers, estoc, **Bond** — elle marque la position d'Eidra, s'élance en arc et atterrit avec un impact et deux ondes (quitter la marque, puis sauter) — et **Éruption** : une ligne de six geysers court vers Eidra. Sous 50 % : télégraphes ×0,78, le revers enchaîne l'estoc et le bond enchaîne l'éruption.

**Ilyra** (560 PV), rapide et fuyante, elle glisse au-dessus du sol parmi ses pétales. Phase 1 : pétales (six marques), reflet (charge), voile (trois éclats en éventail visés sur Eidra). Sous 66 % : le reflet revient en sens inverse, ronces (onde), disparition suivie d'une taille, **Reflets** — deux copies d'elle prennent place dans l'arène et tirent des éclats ; chacune se brise en un coup, frapper la vraie les dissipe toutes ; seul un bref scintillement trahit les copies. Sous 33 % : floraison (quatre paires d'ondes).

Les ennemis gardent `combo`, `lunge` et `enrage` (D028) : le Porteur de cendres enchaîne deux coups avec élan.

## Son et musique

Chaque région a son thème et son ambiance (D033) : le piano hésitant et le célesta des voûtes de Lumérite, la berceuse à la boîte à musique de la galerie de Mira, l'ostinato de violoncelle et le tic-tac du Contrepoids, la harpe et le tambour-cœur des Failles de cendre, la valse de célesta et de voix du Jardin du déni. Chaque boss a le sien, qui prend le relais dès son réveil ; sa chute laisse l'arène silencieuse quelques secondes avant que la région revienne. Les bruitages sont lisibles avant tout : chaque télégraphe de boss a un son d'anticipation, chaque coup qui touche claque (claquement, corps, tintement), les gros impacts creusent la musique, le Commandement du Gardien s'entend comme un chœur qui ordonne. Les pas changent avec le sol (pierre, cendre, mousse), l'atterrissage avec la hauteur de la chute ; le Recueillement monte en bourdonnant et s'interrompt avec lui. Les menus répondent par de petits tintements.

## Dangers

Colonnes de feu : une braise rougeoie au sol, s'agite 0,7 s avant l'éruption, puis une colonne de 7 m brûle (18 à 20 dégâts, non parable, repousse). Les trois colonnes des Champs de braise éclatent à tour de rôle. Tomber dans la Faille coûte 20 PV et ramène au bord.

## Mémoire

Rémanence révèle des structures disparues ; Memory Step rejoue une trace temporelle pour maintenir un mécanisme ; la Seconde impulsion (Acte II) permet un second saut en l'air, indispensable pour franchir la Faille. Les autres capacités sont prévues plus tard.

## Critères d'acceptation

Parcours jouable au clavier et à la manette, checkpoint persistant après rechargement, combat vérifiable, erreurs explicites, ressources des secteurs libérées, budget de rendu mesuré. 60 FPS reste une cible matérielle, jamais une promesse déduite d'un test CI.
