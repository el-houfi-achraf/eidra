# Tests

## Commandes

```sh
npm ci
npm run lint
npm run format:check
npm run typecheck
npm test
npm run validate:assets
npm run manifest
npx playwright install chromium
npm run test:e2e
```

Node 24. Les E2E démarrent le build de production avec Vite preview ; pas de HMR. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet un Chromium déjà installé. Les traces et captures d’échec restent dans `test-results`, ignoré par Git et conservé comme artefact par la CI.

## Couverture réalisée

30 tests unitaires / intégration dans 9 fichiers : EventBus, transitions d’état, mouvement et math, dégâts, combo, invulnérabilité, parade, FSM / boss, patrouille de berge, inventaire, mémoire, quêtes, narration et conditions des fins, migrations / corruption IndexedDB, streaming avec destruction, pipeline GLB / audio, négociation WebGPU et événements clavier courts.

9 parcours E2E : démarrage WebGL2 sans erreur ; déplacement, saut, dash, acquisition et dégâts ennemis ; ancrage, IndexedDB, refresh et reprise ; réglages et remapping persistants ; Rémanence, Écho, contrepoids et raccourci ; changement de secteur, mort et respawn ; introduction / phase 2 / victoire et fin du prélude ; Gamepad API simulée avec maintien du clavier ; traversée physique des trois plateformes mémoire par sauts et dash.

Les fixtures debug positionnent le joueur au début de certaines épreuves et règlent la vie du boss pour vérifier ses transitions. Elles ne prouvent ni un parcours complet sans debug ni l’équilibrage du boss. Déplacement, attaques, capacités, ancrage et traversée du pont passent par les vraies entrées clavier. La Gamepad API est simulée ; ce n’est pas un test de manette physique.

## Mise à jour « ressenti moderne »

42 tests unitaires / intégration dans 11 fichiers. Ajouts : hit-stop (pas gelés, plafond, résidus flottants), tampon d'attaque, riposte après parade, hitbox de plongée, rebond pogo à hauteur fixe, Recueillement (gain, canalisation, interruptions, pas de soin excédentaire), offrandes d'autel (coûts croissants, plafond), Gardien (blindage d'introduction et de transition, pluie d'éclats réservée à la phase 2, projectiles sur les marques), direction « bas » et invites selon le dernier périphérique.

12 parcours E2E. Ajouts : Recueillement alimenté par de vrais coups clavier puis soin en maintenant F ; autel, offrande d'éclats et vitalité conservée après rechargement ; plongée qui rebondit sur un Veilleur et le blesse. Le parcours du boss vérifie la fin de la transition blindée sans perte de vie du Gardien ; l'aide `skipDialogue` tolère les lignes tapées (un premier appui complète la ligne).

Sur un rendu logiciel lent, le pas de simulation est plafonné à 0,1 s par image : une durée réelle fixe couvre alors moins de temps de jeu. Dans le conteneur de cette mise à jour (environ 4 à 7 FPS), le code 0.1.0 non modifié échouait déjà à deux parcours : la porte du contrepoids (touche maintenue 2,4 s) et la traversée du pont. Le parcours de déplacement initial (touche maintenue 600 ms) échouait aussi une fois avec la mise à jour. Corrections, sans retirer d'assertion et avec les vraies entrées clavier :

- les deux parcours à durée fixe maintiennent la touche jusqu'à la condition attendue ;
- la traversée du pont attend qu'Eidra soit réellement posée après la téléportation de départ. L'indicateur « au sol » pouvait encore décrire l'image précédant la téléportation : le saut, pressé pendant la chute de 20 cm, expirait parfois dans le tampon et Eidra marchait dans le vide ;
- la plongée attend que le contrôleur signale la chute avant de frapper, pour la même raison.

Après correction : suite complète réussie, traversée du pont 5 / 5 et plongée 5 / 5 en répétition.

## Deuxième itération : personnages, UI, UX

51 tests unitaires / intégration dans 13 fichiers. Ajouts : validation Zod de toutes les apparences et couverture du roster ennemi, lisibilité des silhouettes (cape qui s'évase, capuche au-dessus du masque), chaîne d'écharpe (pend sous l'ancre, garde ses longueurs, traîne derrière un ancrage mobile, suit le vent, se réinitialise après téléportation, ignore les pas invalides), tutoriel contextuel (bandes et prérequis, retrait après le geste n'importe où, soin seulement blessé, données valides).

13 parcours E2E, tous réussis sur le build final. Ajout : les invites contextuelles enseignent le déplacement puis le saut et se retirent une fois le geste accompli. Le parcours des réglages ouvre désormais les onglets Accessibilité et Commandes avant d'y agir.

## Troisième itération : arènes, collisions et animation

74 tests unitaires / intégration dans 15 fichiers. Ajouts : intervalles de marche (sol sous le centre, dalles contiguës fusionnées, passage sous une dalle haute, volants), vérification que **aucun ennemi du laboratoire ne chevauche une dalle solide sur toute sa patrouille** et garde un sol sous lui, portes fermées qui bornent chaque corps de son côté, cohérence des arènes dans les données (seuil entre les portes, zone du gardien incluse, ancrage du seuil après le Porteur), scellement / libération / respawn des arènes, Porteur retenu derrière sa porte pendant une poursuite, Gardien confiné et réveillé seulement après le seuil, dégâts de contact non parables ; poses clés (anticipation, fente, affaissement, recul, sursaut, lanceurs, silhouettes de chaque pattern du Gardien, introduction, bornes des poses, inclinaison d'Eidra).

14 parcours E2E, tous réussis sur le build final. Ajout : **« guardians bar the way until they are defeated »** — le seuil du Porteur se scelle (carte de titre), Eidra poussée contre la porte du fond pendant 2,5 s reste devant elle, la porte s'ouvre à la mort du Porteur et Eidra passe ; dans l'arène du Gardien, même vérification sur la porte x = 196, qui s'ouvre à sa défaite. Parcours répété 3 / 3. Le parcours du pont reste sans perte de vie grâce à la zone d'atterrissage libérée (D021) ; le Veilleur attendait auparavant exactement sur la zone d'atterrissage. La mort affiche désormais le panneau 1,3 s après l'éclatement ; le parcours de respawn l'attend par l'auto-attente de Playwright, sans délai fixe ajouté.

## Quatrième itération : décor peint et ambiances

84 tests unitaires / intégration dans 16 fichiers. Ajouts (`tests/unit/scenery.test.ts`) : une ambiance valide par secteur, secteurs purs en leur milieu et fondu sans saut visible sur tout le laboratoire (pas de 5 cm), poids égal des voisins à la frontière ; rubans, bords adoucis transparents, bandes qui ne s'inversent jamais ; générateur aléatoire déterministe ; bruits de texture qui se raccordent aux bords ; décor déterministe par secteur, budget de 500 à 12 000 triangles par secteur ; **aucun élément peint devant les personnages**, hors habillage des dalles qui reste sous les genoux ; avant-plan limité aux bords haut et bas ; dalles fantômes seulement là où existent des plateformes de mémoire.

Les 14 parcours E2E réussissent sans modification sur le build final. Le rendu a été vérifié par captures des six zones en HIGH et LOW.

### Correctif CI : plongée sur un Veilleur

La CI GitHub a échoué sur « a downward strike bounces off a Veilleur » après la fusion de la PR #3 (`Received: 0.9955…`, Eidra restée au sol). Cause, reproduite localement à l'identique (2 échecs sur 5 avec le code de `main`) en laissant simplement expirer l'invulnérabilité de départ :

1. l'indicateur « au sol » est faux au premier pas qui suit une téléportation (contacts Havok de l'ancienne position, D025). Le test devait donc attendre de voir Eidra « en l'air » avant de frapper, ce qui coûte plusieurs images de chute ;
2. depuis les dégâts de contact de la PR #3, une frappe trop tardive laisse le corps du Veilleur toucher Eidra d'abord (recul et étourdissement), et le rebond n'a pas lieu. En local, l'exécution ralentie (~4 FPS, pas plafonné à 0,1 s) gardait Eidra invulnérable pendant la chute et masquait le problème.

Correctifs : appui correct dès le premier pas après une téléportation, priorité de la plongée sur le contact du corps frappé (test unitaire), et parcours réécrit sans affaiblir ses assertions. Il attend la fin de l'invulnérabilité (le contact est donc actif), frappe dès la chute comme un joueur, vérifie un vrai rebond (plus d'1 m au-dessus du point bas), les dégâts au Veilleur **et** qu'Eidra n'est pas blessée. Résultat : 8 / 8 en répétition dans les conditions de la CI (contre 0 / 8 avec la frappe immédiate avant le correctif du contrôleur), suite complète réussie.

## Cinquième itération : étapes scellées

91 tests unitaires / intégration dans 17 fichiers. Ajouts (`tests/unit/stages.test.ts`) : étapes ordonnées le long de la route, gardiens de chaque étape présents dans son secteur et de son côté de la sortie, **tous les ennemis hors arène sont gardiens d'une étape**, sorties sur sol plein et hors de la bande d'hystérésis des ancrages ; ouverture seulement quand tous les gardiens sont tombés, mémorisée dans les drapeaux et non refermée par leur retour ; porte qui ne bloque que le côté non franchi ; gardien poursuivant Eidra retenu derrière la sortie.

15 parcours E2E, tous réussis. Ajout : **« a sector exit stays sealed until its guardian falls, then stays open »** — message du nombre de gardiens restants, Eidra poussée contre la sortie de la chambre d'éveil pendant 2,5 s sans la franchir, ouverture et annonce à la chute du Veilleur, passage, puis sortie toujours ouverte après sauvegarde, rechargement et « Continuer », pendant que la sortie de la galerie reste scellée. Répété 3 / 3.

## Sixième itération : boss plus complexes et Acte II

118 tests unitaires / intégration dans 18 fichiers. `boss.test.ts` est réécrit pour le moteur générique : roster validé contre les arènes, rejet des données incohérentes (seuils non décroissants, hâte manquante, enchaînement inconnu, phase sans pattern), blindage de l'introduction et des deux transitions, rotation qui s'élargit à chaque phase, télégraphes qui raccourcissent mais restent au-dessus de 0,5 s, balayage suivi d'une récupération en phase 1 mais enchaîné d'une charge en phase 2 avec anticipation raccourcie, disparition derrière Eidra (ou du côté libre contre un mur) suivie d'un balayage, ondes successives au rythme de 0,45 s, marques de pluie dans l'arène, enchaînement rompu par l'étourdissement ; Ilyra qui revient en sens inverse, jamais de pattern `followUp` dans la rotation ; dans le gestionnaire d'ennemis, éclats sur les marques, Gardien déplacé sur sa marque de disparition, voile d'Ilyra en éventail vers Eidra, boss endormi loin de son arène. `act2.test.ts` : colonnes de feu (alerte, combustion, repos, périodicité, zone de brûlure, fenêtre de passage, jamais les trois ensemble), combos d'élite plus rapides, rage (coup supplémentaire, hâte), combo rompu par l'étourdissement, élan du Rampant et portée de son coup, salve du Porte-braise, route continue de dix secteurs avec ambiances, **Faille qui exige le double saut** (apex simulé avec le modèle de mouvement), quêtes de l'Acte II. Les poses, le tutoriel, les étapes et les arènes sont généralisés aux deux actes.

17 parcours E2E, tous réussis. Le parcours du boss vérifie maintenant les trois phases, puis l'adieu de Mira et la carte de titre de l'Acte II au lieu de la fin. Ajouts : **« Act II: the Seconde impulsion climbs higher and the ember vents burn »** — saut maintenu mesuré (moins de 2,8 m), acquisition de la Seconde impulsion, double saut par vraies touches (plus de 3,2 m, invite retirée), dégâts d'une colonne de feu ; **« Ilyra: three phases, her fall, the epilogue and the end of the act »** — dialogue, réveil, carte de titre, porte du fond scellée, phases 2 et 3, défaite, ouverture, épilogue, écran « FIN DE L'ACTE II », reprise avant la fin de l'acte.

## Septième itération : toutes les manettes

141 tests unitaires / intégration dans 19 fichiers. `gamepad.test.ts` : identification depuis les identifiants Chromium, Firefox et Safari (familles, fabricant, profil seulement hors disposition standard, symboles A / B / X / Y pour les clones XInput, capteurs de mouvement reconnus), normalisation d'une manette standard, d'une PlayStation et d'une Xbox brutes de Linux (nord / ouest inversés, gâchettes et croix sur axes, select / start / guide replacés), chapeau POV sur un axe, axes inconnus devenus boutons virtuels relatifs à leur repos, zone morte radiale qui atteint la vitesse maximale et ignore la dérive, marche analogique, « haut » réservé aux poussées franches, capture de la seule entrée nouvelle, symboles par famille, disposition par défaut complète et sans doublon, réglages validés avec valeurs par défaut, vibrations bornées. `renderer-input.test.ts` : la manette sur laquelle on appuie joue et impose ses symboles (le stick qui dérive sur une manette de rechange ne lui reprend pas la main), capteurs de mouvement listés par Linux comme une manette ignorés, manette non reconnue jouée par son chapeau puis réassignée, bouton encore enfoncé ignoré après la fermeture d'un menu, navigation de menu par fronts avec répétition différée, capture (l'appui capturé n'agit pas, un bouton relâché pendant la capture compte de nouveau — régression corrigée, Start annule), vibration mise à l'échelle et coupée à 0, annonces de branchement.

20 parcours E2E, tous réussis sur le build final, avec des manettes scriptées (`navigator.getGamepads` remplacé, événements de connexion émis) : **une DualSense** annoncée à la connexion, qui lance une partie depuis l'écran titre sans clavier ni souris (sans sauter par l'appui qui démarre), affiche ◀ ▶ puis ✕ dans les invites, saute, met en pause avec Options (□ dans l'aide-mémoire) et reprend avec ○ ; **une manette USB générique non reconnue** (chapeau POV sur l'axe 9) qui se déplace par son chapeau, ouvre Réglages → Manette par la navigation spatiale et R1, réassigne le saut en appuyant sur un autre bouton (échange avec l'esquive), revient et saute avec ce bouton ; **une manette Xbox** qui vibre quand Eidra tombe dans le gouffre, puis met le jeu en pause quand elle est débranchée. Deux défauts trouvés par ces parcours sont corrigés : la capture clavier se déclenchait aussi sur les boutons de liaison manette (même classe CSS) et bloquait la navigation ; le premier appui sur Retour après une capture était avalé.

## Huitième itération : la nouvelle Eidra

150 tests unitaires / intégration dans 20 fichiers. Nouveau `cards.test.ts` : une carte file droit, vite, et s'efface à sa portée ; éventail de trois cartes pendant une riposte, vers la gauche comme vers la droite ; arrêt contre un mur, carte dépensée sur le premier corps touché ; coût de deux coups de résonance, une carte visible par coup, soin plus cher qu'un lancer, neuf cartes au plus ; portée de la rafale chargée supérieure d'au moins 1,5 m à celle d'un coup ; astuce de lancer seulement avec assez de résonance ; poses du bâton (balayage de l'arrière vers le bas avant, arc montant, estoc de niveau avec la main portée en avant, bâton levé pendant la charge, pointé vers le bas au pogo, traîné en arrière au dash) ; apparence d'Eidra (couronne, cheveux, cape, éclaboussures, cartes, bâton, lueur pourpre), Écho sans cartes, autres personnages inchangés.

21 parcours E2E, tous réussis sur le build final. Ajout : **« a tap throws a card at a Veilleur; holding the same input mends instead »** — avec quatre cartes, un appui bref sur F dépense 22 de résonance et la carte blesse le Veilleur ; le même bouton maintenu soigne, dépense le reste de la résonance et ne lance rien. Le parcours du Recueillement existant (maintien de F) passe sans modification.

## Neuvième itération : quatre boss, quatre capacités

168 tests unitaires / intégration dans 21 fichiers. Nouveau `signatures.test.ts` : chaque boss a une capacité et une démarche différentes ; cadence propre à chaque démarche (pas lourds, bonds, vitesse constante en lévitation et en glisse) ; **Étendard** planté du côté opposé à Eidra, ondes des deux côtés à chaque pulsation, nombre de pulsations fixé par la durée, étendard qui reste pendant que le Porteur avance et tombe à la réinitialisation ; **Commandement** qui épargne Eidra immobile et fait tomber un éclat au-dessus d'elle dès qu'elle bouge ; **Bond** qui atterrit sur la marque même si Eidra l'a quittée, sans contact en vol, avec impact et deux ondes ; **Éruption** en ligne vers Eidra, geysers allumés dans l'ordre, une seule brûlure par geyser ; **Reflets** sur les trois places de l'arène, présents dans `actors`, vraie Ilyra immobile tant qu'ils sont là, tirs des reflets, reflet brisé en un coup, dissipation quand la vraie est touchée, disparition au bout de la durée, autre place au lancer suivant, réinitialisation. `boss.test.ts` : roster de quatre boss, rejet des identifiants de pattern en double et des effets durables sans durée, rotation du Gardien avec le Commandement, pattern mis en file (tout de suite pendant l'approche, sinon après le coup en cours). `poses.test.ts` : silhouette propre à chaque capacité, bornes de toutes les poses des quatre boss, démarches (pas, lévitation, bonds, arc du bond) additionnées à la pose. Les tests d'élites d'`act2.test.ts` utilisent des données synthétiques ; ceux d'`arenas.test.ts` vérifient que chaque arène est gardée par un boss qui y attend et qu'aucun boss n'en sort, quelle que soit sa démarche.

22 parcours E2E. Ajout : **« each boss fights with its own ability and way of moving »** — les quatre démarches, l'étendard du Porteur planté puis retiré à sa chute, les deux reflets d'Ilyra en phase 2 dissipés quand la vraie est touchée. Le parcours des arènes vise désormais le Porteur comme boss.

## Dixième itération : bande-son et bruitages

185 tests unitaires / intégration dans 22 fichiers. Nouveau `audio.test.ts` : chaque variante de chaque bruitage existe en OGG et en MP3 et aucun fichier n'est orphelin ; chaque thème, ambiance et motif est livré ; chaque secteur de la route a sa musique, son ambiance et son sol, chaque boss un thème qui n'appartient qu'à lui ; chaque type de pattern de boss a une voix qui existe ; les gros impacts creusent la musique, jamais les pas ; une variante n'est jamais rejouée deux fois de suite et toutes servent ; délai minimal entre deux occurrences ; dispersion de hauteur bornée ; **directeur de musique** : thème du titre dans les menus, thème et ambiance des voûtes, fondu entre régions sans battement à la frontière (hystérésis), thèmes et ambiances de l'Acte II, thème du boss puis ambiance atténuée, silence après la victoire puis retour de la région, fondu à la mort, niveau réduit en pause, creux qui retombe, sol sous les pas ; **sons de combat** : un Veilleur repère, anticipe puis frappe (dans cet ordre), le Porteur rugit, télégraphie, plante son étendard qui sonne toujours au même endroit, le Gardien ordonne puis punit un mouvement, une colonne de feu ne s'entend que près d'Eidra.

23 parcours E2E. Ajout : **« the score follows the journey, and every gesture is heard »** — le premier geste réveille l'audio et le thème du titre joue au menu ; l'interface confirme ; thème et ambiance des voûtes ; pas sur la pierre, saut, atterrissage et coup de bâton entendus ; dans l'arène du Porteur la porte retombe, il rugit et son thème prend le relais ; à sa chute, le son de la victoire et son motif, puis le silence.

## Onzième itération : écran titre

194 tests unitaires / intégration dans 23 fichiers. Nouveau `title.test.ts` : un chapitre par acte de la route, numérotés, bout à bout, avec des couleurs et un thème qui existent, et le chapitre d'une abscisse ; chaque thème a un nom et une origine (titre, région ou combat) ; nouveautés aux identifiants distincts, polices créditées ; vignettes aux couleurs de leur secteur avec des identifiants de dégradé propres ; **progression du titre** : avant tout voyage (premier chapitre, thème du titre seul, aucun fragment, sur sept), puis avec deux parties (la plus récente est reprise, ses seuls fragments de l'histoire comptés, chapitre de sa position, chapitres atteints, souvenirs et thèmes réunis de toutes les parties dans l'ordre de la partition), chapitre atteint par un secteur découvert ; nom de profil par défaut, rogné, refusé s'il est vide ou trop long, réglages et sauvegardes antérieurs valides ; thème choisi joué dans les menus puis oublié dès que le jeu reprend.

24 parcours E2E. Ajout : **« the title screen: sections, the journey so far, its score, a preview and a profile »** — sans sauvegarde, pas de « Continuer », « Charger » désactivé, fragments 00/07, chapitre 00 ; au clavier, flèches (la touche désactivée est sautée), E ouvre Jouer avec le focus sur le premier emplacement, Échap revient ; une partie menée jusqu'à l'Acte II (transmission passée), sauvegardée, puis retour au titre : « Continuer » a le focus et indique l'ancrage, la carte du chapitre montre les Failles de cendre ; Extras : sept souvenirs, quatre thèmes entendus, celui de Mira joué puis arrêté (mixage vérifié) ; aperçu du chapitre 01 : interface effacée, secteur de la Porte de Nhalis chargé, thème des cendres, puis retour au titre, monde rechargé à l'éveil et thème du titre ; nouveautés lues (le point disparaît et ne revient pas après rechargement) ; nom de profil enregistré dans la base du navigateur et conservé après rechargement. Les parcours manette existants passent sans changement : le premier appui lance « Nouvelle partie », le second l'emplacement.

## Douzième itération : corrections après une partie complète

Avant les tests automatiques, une partie complète a été jouée par un script de touches réelles (Playwright, rendu logiciel) : l'Acte I en entier, puis l'Acte II, avec une capture à chaque moment clé. Quand le script restait bloqué, il passait par l'API de débogage et le notait ; ses morts mesurent la pression des combats, pas la difficulté pour un humain. Elle a trouvé ce que les tests ne voyaient pas : la corniche de Seris qui arrêtait Eidra à hauteur de tête, les retours de 60 à 78 m après une défaite, l'empilement des couches d'interface sur Eidra, des dialogues qui cachaient leurs personnages.

198 tests unitaires / intégration dans 24 fichiers. Nouveau `walkway.test.ts` : aucune dalle ne pend entre la taille et la tête d'Eidra au-dessus d'un sol ; toute corniche au-dessus du passage reste à un saut ; les ancrages sont sur sol plein, à plus de 2 m d'une sortie scellée, avec des identifiants uniques. `tutorial.test.ts` : une leçon ignorée se retire après sa durée d'affichage et le reste ; celles qui suivent Eidra partout (cartes, Recueillement) se retirent plus tôt.

25 parcours E2E. Ajout : **« one prompt at a time, off Eidra, and a clear way under the ledges »** — le voyage commence hors de portée du premier ancrage, la leçon d'abord ; sur l'ancrage (déjà le sien), l'autel remplace la leçon, sur une ligne sous les pieds d'Eidra (plus bas que 80 % de l'écran) ; Eidra passe sous la corniche de Seris par vraies touches jusqu'à l'arène du Porteur ; blessée pendant le combat, aucune leçon ne s'affiche ; l'ancrage du contrepoids s'active. Parcours répété 3 / 3 ; les 24 autres passent sans changement.

## Treizième itération : l'Acte I en salles

234 tests unitaires / intégration dans 27 fichiers. Nouveaux fichiers :

- `rooms.test.ts` : l'Acte I compte au moins 25 salles ; aucune chambre n'en chevauche une autre ni ne monte dans une salle de la route ; les chambres sous un gouffre restent hors d'atteinte d'une chute ; chaque porte mène quelque part et la porte d'en face lui répond ; le sol de la route s'ouvre où une chambre pend dessous ; chaque coque a un trou à chaque porte ; `roomAt` garde la salle d'Eidra à sa limite (hystérésis) ; ancrages, reliquaires, ennemis et sceaux sont dans une salle, les marcheurs sur leur sol ; aucune chambre ne réveille un boss ; une chambre est affichée seule, ses voisines chargées derrière leurs portes ; aucune marche d'escalier ne frappe la tête d'un saut depuis une autre ; aucune montée remémorée ne dure plus que la Rémanence ; la voûte du contrepoids s'ouvre au-dessus de ses corniches.
- **Le modèle de portée** (`tests/unit/support/reach.ts`) parcourt les surfaces praticables : sauts balistiques tirés des constantes de `MovementModel` (avec ou sans Élan), chutes, portes, courant ascendant, dalles de Rémanence, murs fêlés, volet ouvert une fois son levier atteint. Il prouve l'ordre de l'acte (l'Élan d'abord et rien d'autre avant, puis la Rémanence au-delà du gouffre que seul l'Élan franchit, puis l'Écho mémoriel par le contrepoids, la cage et le beffroi, puis la porte du contrepoids, Seris et la fin) et l'absence d'impasse : de toute surface atteignable, le pouvoir suivant reste atteignable. Chaque gouffre qui demande l'Élan est simulé pas à pas avec `MovementModel` : franchi avec, manqué sans.
- `depths-enemies.test.ts` : dix types d'ennemis, chacun avec une apparence, une ligne de récit et une place dans l'Acte I ; la Phalène plonge une fois par attaque puis remonte ; la Coque se retourne lentement, jamais au milieu d'un coup, et ne pare que de face ; le Gisant reste une pierre inoffensive jusqu'à ce qu'Eidra approche ; la Lanterne reste en place et tire des paires d'étincelles lentes ; les Mites sont les plus rapides et les plus fragiles.
- `journal.test.ts` : les salles d'un acte ; visitées, entrevues ou cachées (secrets compris) ; la carte en mètres avec ses portes, ses ancrages et Eidra ; le bestiaire ; les seuls souvenirs retrouvés ; les noms de salles en phrases, noms propres gardés.

Tests adaptés : `walkway` (par salle, chambres comprises), `scenery` (bandes de jeu des chambres, ouvertures de la route), `streaming`, `arenas`, `tutorial` (indices par salle), sauvegarde (une partie de l'itération précédente, sans bestiaire, se charge).

26 parcours E2E. Ajout : **« rooms: down the well, through a cracked wall, and the journal of the act »** — après Mira, Eidra tombe dans le puits : seule cette chambre est affichée, ses voisines chargées ; elle touche le fond plus de 14 m sous la route ; dans les archives, le mur fêlé en haut de l'escalier cède sous de vrais coups de bâton, le passage secret est annoncé et le cabinet scellé découvert ; le journal (Tab) dessine les salles visitées, le cabinet comme salle courante, cache l'oculus pas encore trouvé, puis le bestiaire (14 entrées) et les sept souvenirs. Le premier parcours prend désormais l'Élan dans la salle des élans ; celui des ancrages active l'ancrage du contrepoids à x 127.

**Rejeu physique** (hors CI, script Playwright sur le build) : pour chaque saut que le modèle de portée juge possible dans les chambres, Eidra est posée sur la surface de départ et le saut est rejoué avec de vraies touches dans Havok. 115 sauts sur 116 atterrissent où le modèle l'annonce ; le dernier, sur un bloc de 1,2 m de large dans la salle des élans, est dépassé par le script (il n'est pas sur un chemin obligé). Ce rejeu a trouvé les marches qui cognaient la tête, les ouvertures trop basses au départ d'un saut et la montée des racines plus longue que la Rémanence, tous corrigés et désormais couverts par des tests unitaires.

## Qualité restant à qualifier

WebGPU réel, Firefox / Safari, manettes physiques (les profils Linux evdev et les vibrations n'ont été vérifiés qu'avec des manettes scriptées), accessibilité avec lecteurs d’écran, quotas / stockage privé, CSP sur Cloudflare et campagne complète. Le protocole de performance logiciel est décrit dans PERFORMANCE ; il ne certifie pas 60 FPS. Aucun test défaillant n’est désactivé pour rendre la CI verte.

La CI GitHub est configurée pour bloquer ses propres gates en cas d’échec. La protection de branche doit exiger le job `validate` quand le dépôt distant est créé ; ce réglage GitHub ne peut pas être garanti par un fichier YAML seul.

## Résultat du jalon 0.1.0-prélude

Node 24.19.0 ; TypeScript strict, ESLint sans avertissement et Prettier : réussis. Vitest : **30 tests réussis**. Playwright : **9 parcours réussis** en environ 1 min 6 s sur le build final, Chromium logiciel. Validation des assets et création du manifeste de 37 fichiers : réussies. Les résultats sont locaux ; aucune exécution GitHub Actions distante n’est revendiquée.
