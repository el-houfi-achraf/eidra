# Décisions

## D001 — Stack verrouillée

Node 24 disponible ; Babylon 9.27.0 fixé. Pas de framework frontend. Versions exactes + lockfile pour reproductibilité.

## D002 — Dépôt local autonome

Git local avec commits atomiques. Le connecteur GitHub est maintenant connecté et identifie le compte, mais ne retourne aucun dépôt ni installation accessible ; la création de dépôt est absente de ses outils. La page de création dans le navigateur nécessite une connexion distincte. Ne pas prétendre avoir poussé le code. Cloudflare requiert également un compte autorisé.

## D003 — Art procédural temporaire

Blender absent ; ne bloque pas le slice. Préparer un script Blender, générer temporairement les meshes via Babylon, conserver le pipeline GLB pour les assets importés.

## D004 — Collision et logique

Havok Character Controller pour capsule ; simulations gameplay typées et testables sans renderer. Combat analytique indépendant des meshes.

## D005 — Validation honnête

Chromium logiciel certifie le fonctionnement, pas la cible 60 FPS d'un GPU réel. Tout résultat matériel non mesuré reste explicitement non qualifié.

## Références techniques

- https://doc.babylonjs.com/features/featuresDeepDive/physics/characterController/
- https://doc.babylonjs.com/setup/support/webGPU/
- https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/

## D006 — Modules Babylon 9 explicites

Le moteur 9 possède des points d'entrée purs et des enregistrements de composants. Importer explicitement joinedPhysicsEngineComponent, particules WebGL2 / compute et instrumentation des time queries ; les tests navigateur ont détecté les omissions que TypeScript ne pouvait détecter.

## D007 — Optimisation mesurée des décors

Regroupement des meshes statiques par matériau avec Mesh.MergeMeshes, sans fusionner colliders, plateformes mémoire, marqueurs interactifs ni cristaux animés. Le menu est passé d'environ 230 à 46 draw calls dans le protocole initial. Les plafonds et timings finaux sont consignés dans PERFORMANCE.

## D008 — Sauvegardes sûres

Trois slots IndexedDB, version courante 2, migration 1 → 2, refus explicite des versions inconnues. Les sauvegardes pendant une plateforme mémoire ou un boss actif replacent la position au dernier ancrage afin d'éviter de recharger dans un état temporaire impossible.

## D009 — Audio temporaire

Score et bruitages synthétisés par un script reproductible. OGG en premier, WAV de secours si le décodeur échoue. Écriture atomique des exports après validation pour éviter les fichiers vides lors d'une interruption. Crossfade exploration / boss et positionnement spatial Babylon Audio V2.

## D010 — Dépendances du pipeline uniquement au développement

Khronos gltf-validator garantit la validité glTF ; glTF Transform et meshoptimizer optimisent et compressent sans modifier le moteur du jeu. Aucun package de pipeline n'est requis au runtime navigateur. Les décodeurs meshopt, glslang et twgsl sont locaux, avec leurs mentions de licence.

## D011 — Scope du prélude

Une boucle de maintenance relie le contrepoids à la chambre d'éveil après résolution du puzzle, permettant le retour vers Kael. Les neuf régions ne sont pas fabriquées artificiellement pour revendiquer un jeu terminé. Le gate qualité du slice prévaut.

## D012 — Atterrissage après dash

Le test navigateur de traversée réelle du pont a révélé une dérive de plusieurs mètres après la fin du dash. La vitesse horizontale revient au maximum de course à la sortie du dash, puis le contrôle aérien normal reprend. Un test de mouvement et une traversée clavier avec atterrissages couvrent cette régression. La patrouille du second Veilleur est bornée par les données de sa berge solide.

## D013 — Caméra perspective à longue focale

La caméra orthographique supprimait toute parallaxe : les couches à z = 7, 22 ou 44 défilaient à la vitesse du plan jouable. Une caméra perspective à 32 m, dont le champ vertical est calculé pour conserver la hauteur visible du plan z = 0 (7,2 / 8,7 / 10 m), garde le cadrage et les tailles de gameplay, et fait défiler arrière-plans et silhouettes de premier plan à leur propre vitesse. Le zoom boss est désormais amorti. Les silhouettes de premier plan restent dans les bandes haute et basse de l'écran pour ne pas masquer la zone jouable.

## D014 — Étalonnage en un seul passage plein écran

Tone mapping ACES, exposition, contraste et vignette utilisent `scene.imageProcessingConfiguration`. Appliqué dans les shaders des matériaux, il coûtait environ 66 ms de rendu logiciel en MEDIUM, car chaque fragment recouvert par les nombreux plans de décor payait l'étalonnage. Un `ImageProcessingPostProcess` unique le remplace : MEDIUM y ajoute FXAA à la place du MSAA, HIGH et ULTRA gardent un MSAA 4× sur la cible du passage, LOW reste sans étalonnage (chemin d'origine). La couche GUI est exclue du post-process (`applyPostProcess = false`). La vignette sert aussi de retour de danger en MEDIUM et au-delà (teinte rouge pulsée sous 30 % de vie, flash à l'impact). Le grain de film est écarté tant qu'une mesure GPU réelle ne le justifie pas.

## D015 — Hit-stop dans le pas fixe

Le hit-stop consomme des pas de simulation complets (50 ms coup simple, 85 ms finisher, 120 ms parade, 200 ms plafonné) sans figer le rendu. Les entrées pressées restent dans le tampon d'`InputManager` et un tampon d'attaque de 0,22 s rejoue une pression faite pendant la récupération : aucune entrée n'est perdue. Les résidus flottants sont arrondis pour qu'un arrêt de 50 ms gèle exactement trois pas à 60 Hz.

## D016 — Progression sans nouvelle version de sauvegarde

Les offrandes d'autel utilisent les champs existants `shards` et `healthUpgrades` du schéma v2 ; la résonance du Recueillement est transitoire et remise à zéro au respawn. Aucune migration n'est nécessaire et les sauvegardes 0.1.0 restent chargeables. Les nouvelles actions `down` et `heal` s'ajoutent aux bindings par défaut ; les remappages existants sont conservés par fusion.

## D017 — RT partagé sur manette

La manette standard n'a plus de bouton libre ergonomique. RT reste « interagir » à l'appui et devient « Recueillement » au maintien. Pour éviter un soin involontaire, le maintien est ignoré à la manette quand une interaction est disponible. Au clavier, F reste une touche dédiée. La plongée utilise le stick ou la croix vers le bas.

## D018 — Personnages toon procéduraux pilotés par les données

Chaque personnage est décrit dans `game-data/characters/appearance.ts` (cape plissée à pointes, capuche, masque, style des yeux, col, écharpe, clous, jambes, arme, accessoire, couleurs), validé par Zod et assemblé par `CharacterView`. `PuppetGeometry` produit des triangles à couleur plate et y précalcule un ombrage cartoon à trois tons ; les normales sont soudées par position pour que le rendu de contours Babylon (`renderOutline`) trace un trait d'encre continu. Les matériaux « puppet » sont non éclairés : Babylon y sort (émissif + ambiant) × couleur de sommet, donc seuls ces matériaux reçoivent un ambiant blanc (la scène a un ambiant blanc, tous les autres matériaux gardent leur ambiant noir par défaut et le glow, qui lit l'émissif, ne les illumine pas). Les personnages ignorent le brouillard pour rester lisibles devant le décor. L'écharpe et les voiles sont des chaînes de Verlet (`SecondaryChain`) purement visuelles, bornées en vitesse et réinitialisées après une téléportation. Les designs sont originaux : inspirés par le style des action-plateformes à silhouettes encapuchonnées, sans reprise d'un personnage existant.

## D019 — Tutoriel contextuel dans les drapeaux existants

Les invites de `game-data/quests/tutorial.ts` apparaissent dans une bande du laboratoire, après les pouvoirs requis, et se retirent dès que le joueur accomplit l'action n'importe où. L'apprentissage est enregistré comme drapeau `tutorial:<id>` dans les flags déjà sauvegardés : aucune migration. Le réglage « Aides contextuelles » (par défaut activé) masque les invites sans affecter le domaine.

## D020 — Arènes scellées pilotées par les données

Les gardiens se contournaient en marchant. `game-data/zones/laboratory.ts` décrit désormais chaque arène (gardien, bornes gauche / droite, seuil de déclenchement, zone de déplacement du gardien, carte de titre) et en dérive les portes. `ArenaDirector` garde la porte du fond fermée tant que le gardien vit et scelle celle d'entrée dès que le joueur franchit le seuil ; la mort la rouvre (respawn), la victoire ouvre les deux. Les collisions des portes sont des corps statiques Havok créés à pleine hauteur près du joueur seulement ; la montée / descente visible est purement décorative. L'ancrage du seuil (x = 160) est devenu la récompense du Porteur du dernier ordre : son arène [147,5 ; 158,6] se ferme avant lui. Les sauvegardes existantes restent valides (aucun champ nouveau) ; une partie sauvegardée au seuil sans avoir vaincu le Porteur reste jouable, le Porteur restant alors derrière le joueur.

## D021 — Bornes de déplacement déduites de la géométrie et dégâts de contact

Les ennemis se déplacent le long d'un intervalle calculé à partir des dalles du niveau (`src/enemies/Terrain.ts`) : un marcheur reste sur le sol qu'il foule (dalles contiguës fusionnées, hauteur du corps posée sur la dalle sous son centre) et s'arrête avant toute dalle qui traverse son corps ; un volant ignore les sols mais respecte les dalles de sa bande. Les portes fermées bornent aussi chaque corps de son côté. Toucher un corps ennemi blesse (valeur `contact` des données, non parable) avec une boîte réduite à 75 % pour rester juste sur les frôlements. La sortie du pont garde une zone d'atterrissage libre.

## D022 — Poses clés dérivées de l'état, animation hors domaine

Les anticipations, frappes, récupérations et reculs sont calculés par des fonctions pures (`src/animation/Poses.ts`) à partir de l'état des FSM, du directeur de boss et du combat, puis appliqués par `CharacterView` comme décalages (inclinaison, avance, élévation, écrasement, arme levée, tremblement, agenouillement). Aucun temps d'animation n'influence le gameplay : les fenêtres de dégâts restent celles des données. La mort retarde seulement l'affichage du panneau (1,3 s, 0,35 s en mouvements réduits) ; la simulation s'arrête immédiatement. Le réglage « mouvements réduits » annule décalages et tremblements.

## D023 — Décor peint en silhouettes superposées

Le décor procédural en boîtes éclairées (colonnes, arches, tours, éboulis) est remplacé par des silhouettes plates et non éclairées, empilées en profondeur comme des découpes : plafond de caverne et dents à z = 4, architecture à 6,5, arches à 14, caverne lointaine à 26, cité à 44, avant-plan flou à −7. Chaque forme est une bande ou un ruban (`PaintedGeometry`), donc aucune triangulation générale ni dépendance n'est nécessaire. La couleur est peinte dans les sommets (perspective atmosphérique : proche = sombre, lointain = fondu vers l'horizon, brume au sol) et modulée par une texture « pinceau » procédurale en UV monde. Tout le décor d'un secteur tient en six maillages (proche, lointain, avant-plan, halos, rayons, souvenirs), construits de façon déterministe à partir de la graine du secteur. Les colliders restent les boîtes des données, rendues invisibles ; la face peinte des dalles est avancée à z = −0,5 pour que la lisière claire passe sous les pieds des personnages. Aucun élément peint ne passe devant le plan de jeu, sauf l'habillage des dalles (lisière, touffes courtes), ce que vérifie un test unitaire.

## D024 — Ambiance par secteur pilotée par les données

`game-data/zones/moods.ts` (validé par Zod) donne à chaque secteur ses couleurs (brouillard, ciel, horizon, proche / milieu / lointain, sol, lisière, brume, lumière), son motif d'architecture (voûte, galerie, abîme, machinerie, trône), sa végétation, ses lanternes et sa brume. `tintAt(x)` fond deux secteurs voisins sur 12 m ; le brouillard, la couleur d'effacement, le ciel, les bandes de brume et la poussière suivent la caméra, et les couleurs peintes suivent la position de chaque sommet, sans couture entre secteurs. Les halos et rayons sont additifs et teintés par leurs sommets. Le preset LOW retire les couches lointaines, halos et rayons ; les bandes de brume sont réservées à MEDIUM (deux) et HIGH / ULTRA (trois). Le passage en non éclairé réduit le coût du rendu logiciel (voir PERFORMANCE) : aucune optimisation supplémentaire n'a été nécessaire.

## D025 — Priorité de la plongée et appui après téléportation

Une plongée en cours (dès l'appui) a priorité sur le contact du corps situé sous Eidra : on ne se blesse pas sur l'ennemi que l'on frappe vers le bas. Un corps au-dessus d'elle reste dangereux. Par ailleurs, Havok conserve après `setPosition` les contacts de l'ancienne position : la première requête d'appui après une téléportation (respawn, raccourci, outils de debug) décrivait l'ancien sol, et une attaque demandée à cet instant partait comme une frappe au sol. Ce premier pas est désormais traité comme « en l'air » ; son intégration rafraîchit les contacts.

## D026 — Étapes scellées par leurs gardiens

Chaque secteur du laboratoire est une étape : `stages` (`game-data/zones/laboratory.ts`, validé par Zod) déclare ses gardiens et la position de sa sortie. La sortie reste fermée (porte physique, comme les arènes) tant que tous les gardiens du secteur ne sont pas tombés ; les ennemis restent bornés de leur côté. Une étape vaincue est enregistrée dans les drapeaux déjà sauvegardés (`stage:<id>`, aucune migration) : si les ennemis réapparaissent après une mort, le passage reste ouvert. Les portes de progression (sorties d'étape et portes du fond des arènes) ne ferment la route que devant un joueur qui ne les a pas franchies (`StageProgress`, hystérésis de 2 m) : une sauvegarde antérieure placée plus loin, un respawn ou un raccourci ne peuvent pas enfermer le joueur derrière une porte ; revenu en arrière d'au moins 2 m, il doit vaincre les gardiens pour repasser. Les portes sont placées dans leur propre secteur, à plus de 2 m des ancrages ; l'ancrage de Mira récompense la galerie.

## D027 — Moteur de boss générique piloté par les données

Le directeur du Gardien codait en dur ses quatre patterns et ses deux phases. `game-data/bosses/schema.ts` (Zod) décrit désormais tout boss : vie, contact, corps, vitesse, introduction et transition blindées, seuils de phase (jusqu'à trois phases), facteur de hâte par phase (télégraphes raccourcis, approche accélérée) et patterns. Un pattern a un type (`sweep`, `slam`, `charge`, `rain`, `volley`, `blink`, `nova`), une phase d'entrée dans la rotation, une anticipation, une récupération, des dégâts, une portée, un nombre (marques, éclats, vagues), une annonce, et peut enchaîner un autre pattern à partir d'une phase (`combo`, anticipation ×0,6, au plus trois enchaînements) ; un pattern `followUp` n'est atteint que par enchaînement. La validation refuse les seuils non décroissants, une hâte par phase manquante, un enchaînement inconnu et une phase sans pattern. `BossDirector` reste de la logique pure ; `EnemyManager` crée une `BossEncounter` par boss du `bossRoster` (arène issue des données de zone) et traduit chaque déclenchement en coups (balayage, ondes au sol, projectiles, téléportation sur la marque). Un étourdissement interrompt un enchaînement, jamais une transition. Le HUD, les repères de phase, les annonces, les poses et les marques au sol lisent les données : aucun boss n'est nommé dans le rendu ni dans l'interface. Le Gardien passe à 460 PV, trois phases (60 % / 28 %), et gagne la pluie d'éclats (phase 2), la disparition derrière Eidra suivie d'un balayage, et les ondes successives (phase 3). Sauvegarde inchangée : les boss vaincus restent des chaînes du tableau `bosses`.

## D028 — Élites : combos, élans et rage

Les données ennemies gagnent `combo` (coups ou tirs enchaînés, les suivants anticipés ×0,45), `lunge` (élan du corps pendant le coup, ajouté à la portée de la boîte de coup), `enrage` (sous ce ratio de vie : anticipations et récupérations ×0,7, poursuite ×1,3, un coup de plus dans le combo) et `projectileSpeed`. L'étourdissement remet le combo à zéro. Le Porteur du dernier ordre (180 PV, deux coups avec élan, rage à 50 %) et la nouvelle Sentinelle de cendre (280 PV, trois coups, rage) restent des ennemis ordinaires qui gardent une arène ; leur chute est enregistrée comme celle d'un boss (`bosses`, drapeau `defeated:<id>`), donc elles ne réapparaissent pas. _Remplacé en partie par D032 : ces deux gardiens sont désormais des boss ; `combo`, `lunge` et `enrage` restent disponibles pour les ennemis._

## D029 — Acte II : une route continue, des dangers sur l'horloge de session

Les Failles de cendre (`game-data/zones/ashes.ts`) prolongent la même route le long de x (201 → 411) plutôt qu'une nouvelle scène : streaming, portes, étapes, arènes, ambiances et carte fonctionnent sans code spécifique. Cinq secteurs, quatre ancrages, deux fragments de mémoire, la Seconde impulsion (double saut, déjà prévue par le modèle de mouvement), trois étapes scellées de plus, l'arène de la Sentinelle et celle d'Ilyra. Les colonnes de feu (`hazards` dans les données de secteur) sont des fonctions pures du temps de session (`src/combat/Hazards.ts`) : l'état « repos → alerte 0,7 s → combustion » est le même pour les dégâts et pour l'affichage, sans minuterie dans le rendu. Les fosses (`pits`) ramènent au bord sûr le plus proche. Les moments d'histoire liés à la route (`route` : adieu de Mira, carte de titre de l'Acte II, fin après Ilyra et point de reprise) sont des données, pas du code de scène. La fin du jeu passe de la chute du Gardien à celle d'Ilyra ; les sauvegardes existantes qui avaient atteint l'ancienne fin reprennent simplement sur la route de l'Acte II.

## D030 — Toutes les manettes, normalisées vers la disposition standard

Le jeu ne lisait que la première manette, supposée au format W3C « standard », avec une disposition figée et des symboles Xbox. `src/player/Gamepad.ts` (fonctions pures) identifie désormais chaque manette depuis l'identifiant du navigateur (Chromium, Firefox, Safari : fabricant, nom, famille Xbox / PlayStation / Nintendo / générique) et la normalise vers les positions standard : les manettes que le navigateur ne sait pas associer passent par un profil de données (`game-data/input/controllers.ts` : ordre evdev des pilotes Linux Xbox et PlayStation, gâchettes en axes, croix sur deux axes) ou par le profil générique (boutons tels quels, chapeau POV sur un axe détecté à sa valeur de repos hors de ±1, autres axes exposés comme boutons virtuels relatifs à leur repos). Les liaisons manette sont des jetons (`b7`, `up`) stockés dans les réglages (`padBindings`, validés par Zod ; valeurs par défaut pour les sauvegardes existantes) ; elles se réassignent en capturant la prochaine entrée nouvelle par rapport à un instantané, ce qui fonctionne quel que soit le modèle. Déplacement, visée vers le bas et pause restent fixes ; un conflit échange les deux actions. Les menus utilisent des boutons positionnels non remappables (bas valide, droite revient, gâchettes hautes changent d'onglet) et une navigation spatiale entre contrôles. Un appui de bouton donne la main à une manette ; un stick seul ne réveille que la manette déjà en main (ou la première), pour qu'une manette de rechange qui dérive ne la vole pas ; les capteurs de mouvement que Linux expose comme des manettes sont ignorés ; les boutons encore enfoncés à la fermeture d'un menu sont ignorés jusqu'au relâchement. Zone morte radiale réglable ; les vibrations passent par les signaux sonores existants (`game-data/input/rumble.ts`), jamais par la logique de jeu, et une erreur de l'API est journalisée une fois sans interrompre la partie. Le partage de la gâchette entre interaction et recueillement disparaît : parler se fait en poussant vers le haut.

## D031 — Nouvelle Eidra : bâton, cartes et résonance visible

Eidra suit désormais la planche de référence fournie : capuche sombre à couronne d'épines, masque blanc aux yeux pourpres, cheveux noirs, robe ivoire éclaboussée, cape pourpre en lambeaux, bâton doré. Tout reste procédural et piloté par les données (`appearance.ts` : `crown`, `hair`, `mantle`, `spatter`, `cards`, arme `staff`, lueur `crimson`, champs facultatifs sans effet sur les autres personnages). Les cheveux et la cape sont des chaînes à mouvement secondaire ; tous les rubans d'un personnage partagent un maillage par matériau, mis à jour une fois par image, et se réinitialisent quand l'ancre saute de plus de 2,5 m (téléportation, respawn). Les poses du bâton (`Pose.swing`, `Pose.reach`) viennent de `heroPose`, fonction pure de l'état du combat, jamais l'inverse.

Les cartes rendent la résonance visible (une carte par 11, neuf au plus) au lieu d'ajouter une ressource : un appui bref sur la touche de Recueillement lance une carte (22 de résonance), un appui maintenu soigne, comme le sort et le soin partagés des action-plateformes de référence. Ce choix garde le nombre de touches (clavier comme manette) et crée un arbitrage entre frapper et guérir. Les cartes ne rendent pas de résonance (pas de boucle infinie). `CardSystem` (`src/combat/Cards.ts`) est de la logique pure ; `CardHalo` dessine orbite, bouclier, lancers et rafale en instances matérielles de trois sources cachées (un appel de rendu par type ; les fondus passent par l'échelle). L'éventail de trois cartes est réservé à la fenêtre de riposte ; l'attaque chargée gagne de la portée (rafale de cartes) sans changer ses dégâts. Sauvegarde inchangée.

## D032 — Quatre boss, quatre capacités signature, quatre démarches

Le Porteur du dernier ordre et la Sentinelle de cendre passent d'élites (D028) à des boss du moteur générique (D027) : phases, transitions blindées, annonces, barre de vie à repères, poses. Chaque boss reçoit une capacité qui n'appartient qu'à lui et une façon de se déplacer, décrites dans ses données (`game-data/bosses/keeper.ts`, `guardian.ts`, `warden.ts`, `ilyra.ts`) : `movement` (`march`, `hover`, `leap`, `glide`), cinq nouveaux types de pattern (`standard`, `command`, `eruption`, `leap`, `mirror`) et `duration` pour les effets qui durent.

- **Porteur** (marche lourde, 260 PV, deux phases) — _Étendard_ : il plante sa bannière à côté de lui, du côté opposé à Eidra ; elle envoie une onde au sol de chaque côté toutes les 1,3 s pendant 5 s, tandis qu'il continue à se battre. En phase 2, son _Décret_ (onde) enchaîne l'étendard.
- **Gardien Sans Visage** (lévitation) — _Commandement_, à partir de la phase 2 : « NE BOUGEZ PLUS ». Quatre contrôles espacés de 0,4 s ; le premier retient la position d'Eidra, chacun des suivants fait tomber un éclat sur elle si elle s'est déplacée de plus de 0,45 m.
- **Sentinelle de cendre** (bonds, 380 PV, deux phases) — _Bond_ : elle marque la position d'Eidra, bondit en arc (0,6 s, sans contact en vol) et atterrit avec un impact et deux ondes. _Éruption_ : une ligne de six geysers court vers Eidra, un toutes les 0,14 s, chacun brûle une fois (imparable). En phase 2, le bond enchaîne l'éruption.
- **Ilyra** (glisse) — _Reflets_, à partir de la phase 2 : elle prend l'une de trois places de l'arène, deux reflets les autres, et ne bouge plus tant qu'ils sont là. Les reflets tirent un éclat toutes les 1,6 s pendant 7 s et se brisent en un coup ; frapper la vraie les dissipe tous. Le seul indice est un bref scintillement des reflets.

La démarche module la vitesse d'approche (`gaitStride` : pas lourds de 0,35 à 1,6 fois la vitesse, bonds à 2 fois en l'air puis 0,15 à l'atterrissage, vitesse constante en lévitation ou en glisse) ; la présentation lit la même cadence (`gaitPose`, fonction pure) pour la poussière des pas, la lévitation, les sauts et l'arc du bond. Les effets durables (étendard, geysers, reflets, regard, bond) vivent dans `BossEncounter` et sont remis à zéro avec la rencontre ; `BossSignatures` ne fait que les dessiner. Les reflets sont des corps ordinaires (`Combatant`, 1 PV) exposés dans `enemies.actors` : bâton, cartes et Écho les touchent sans code particulier ; ils ne donnent ni éclats ni sauvegarde. Les identifiants de pattern doivent désormais être uniques (Ilyra en avait deux `mirror`). Les apparences gagnent deux champs facultatifs : `crown.height` (écusson ou cornes) et `satellites` (éclats, pétales ou braises en orbite, un maillage par personnage).

Sauvegarde inchangée : `keeper` et `cinder-warden` étaient déjà enregistrés dans `bosses` à la chute des élites ; au chargement, ces identifiants marquent désormais la rencontre comme vaincue, et les drapeaux `defeated:<id>` (quête de la Sentinelle comprise) sont les mêmes.
