# EIDRA: Shards of Silence

**Deux actes jouables.** Un laboratoire puis les Failles de cendre, originaux, en 2.5D, construit avec TypeScript, Babylon.js 9.27 et Havok Web. Ce dépôt contient le jeu, ses sources, les assets temporaires originaux, les tests et la documentation. La campagne complète de neuf régions n'est pas encore implémentée.

## Jouer localement

Node.js **24** et npm requis. Depuis le dossier `eidra` :

```sh
npm ci
npm run dev
```

Ouvrir **http://127.0.0.1:5173**. Le thème du titre démarre au premier clic ou à la première touche (règle des navigateurs). L'écran titre réunit l'accueil, les emplacements (**Jouer**), les **Paramètres** et les **Extras** (souvenirs retrouvés, bande originale à réécouter, crédits) ; la carte en bas à droite fait survoler un chapitre déjà atteint. Au clavier : flèches, E pour sélectionner, Échap pour revenir. Cliquez sur **Nouvelle partie**, puis un emplacement libre. Les sauvegardes restent dans ce navigateur. Utilisez un ancrage avec E avant de quitter.

Pour jouer au build de production :

```sh
npm run build
npm run preview
```

Ouvrir l'adresse indiquée par Vite, généralement http://127.0.0.1:4173. Ne pas ouvrir `dist/index.html` directement avec `file://` : le moteur charge du JavaScript et du WASM par HTTP.

## Commandes

| Action                            | Clavier / souris                       | Manette (Xbox / PlayStation / Nintendo) |
| --------------------------------- | -------------------------------------- | --------------------------------------- |
| Déplacement                       | A / D ou flèches                       | Stick gauche ou croix                   |
| Marcher                           | Ctrl maintenu                          | Stick à mi-course                       |
| Saut                              | Espace, W ou flèche haut               | A / ✕ / B                               |
| Attaque légère / aérienne         | J / clic gauche                        | X / □ / Y                               |
| Plongée (rebond « pogo »)         | S ou flèche bas + attaque, en l’air    | Bas + attaque, en l’air                 |
| Charger (rafale de cartes)        | K / clic droit maintenu, puis relâcher | LT / L2 / ZL maintenu                   |
| Esquive, après acquisition        | Maj                                    | RT / R2 / ZR                            |
| Parade, puis riposte ×2           | L, puis attaque dans la seconde        | LB / L1 / L, puis attaque               |
| Lancer une carte                  | F, appui bref                          | B / ○ / A, appui bref                   |
| Recueillement (soin)              | F maintenu, immobile                   | B / ○ / A maintenu                      |
| Rémanence, après acquisition      | Q                                      | Y / △ / X                               |
| Écho mémoriel, après acquisition  | R                                      | RB / R1 / R                             |
| Dialogue / ancrage / autel / pass | E                                      | Haut (stick ou croix)                   |
| Journal (carte, bestiaire, souv.) | Tab                                    | View / Create / −                       |
| Pause                             | Échap                                  | Menu / Options / +                      |

Touches remappables dans Réglages. Assistance facultative : dégâts reçus réduits.

**Manettes.** Toute manette reconnue par le navigateur fonctionne : Xbox, PlayStation (DualShock, DualSense), Nintendo (Pro Controller), clones XInput et manettes génériques USB / Bluetooth, y compris celles que le navigateur ne sait pas associer à la disposition standard (croix directionnelle rapportée comme un axe unique, gâchettes en axes). La disposition par défaut suit celle des action-plateformes dessinés à la main : saut en bas, frappe à gauche, recueillement à droite, esquive sur la gâchette droite, parler et se reposer en poussant vers le haut. Les invites affichent les symboles de la manette en main (A / B, ✕ / ○, B / A…) et suivent le dernier périphérique utilisé. Tous les menus se parcourent à la manette : stick ou croix pour se déplacer, A / ✕ pour valider, B / ○ pour revenir, gâchettes hautes pour changer d'onglet, gauche / droite pour régler curseurs et listes. L'onglet **Manette** des réglages permet de réassigner chaque action en appuyant sur le bouton voulu, de régler la zone morte du stick, la force des vibrations (coups, parades, chocs, victoire) et le style des symboles. Brancher une manette l'annonce ; la débrancher en jeu met le jeu en pause. Plusieurs manettes peuvent être branchées : celle sur laquelle on appuie joue.

## Contenu jouable

Deux actes : le laboratoire en 25 salles (les cinq secteurs de la route et 20 chambres au-dessus et au-dessous, reliées par des portes en haut, en bas et sur les côtés, avec boucles, trois salles secrètes derrière des murs fêlés et un raccourci à levier), puis les Failles de cendre en cinq secteurs ; mouvement avec coyote time et jump buffer ; capsule Havok ; dash ; attaques légère, chargée, aérienne, plongeante (pogo) et pendant le dash, avec tampon d’entrée ; combo ; parade et riposte ; hit-stop ; Recueillement (soin alimenté par la résonance des coups portés) ; dix types d'ennemis (dont la Phalène de cire qui plonge, la Coque murée qui pare de face, le Gisant qui dort en pierre, la Lanterne-guetteuse, les Mites de poussière, le Rampant qui bondit et le Porte-braise qui tire des salves) ; quatre boss pilotés par les données, chacun avec sa démarche et sa capacité signature — le Porteur du dernier ordre (marche lourde, Étendard planté qui envoie des ondes), le Gardien Sans Visage (lévitation, « NE BOUGEZ PLUS » : un éclat tombe sur Eidra si elle bouge ; pluie d'éclats, disparition, ondes successives), la Sentinelle de cendre (bonds sur la marque d'Eidra, ligne de geysers) et Ilyra (glisse, Reflets à trouver parmi les copies ; pétales, voile d'éclats, ronces, floraison) — avec télégraphes qui raccourcissent et enchaînements ; colonnes de feu à traverser en rythme ; Seconde impulsion (double saut) et la Faille ; Rémanence ; Écho de cinq secondes ; contrepoids ; raccourci de maintenance ; sept fragments de souvenir ; Mira ; transmissions de Sael ; Ilyra et l'épilogue ; ancrages et autel d’offrandes (éclats → vitalité) ; trois sauvegardes ; journal (carte de l'acte salle par salle, bestiaire, souvenirs) ; mort et respawn ; bande-son originale générée (thème du titre, un thème par région et par boss, motifs de victoire, de pouvoir, de repos et de mort, ambiances, silence après une victoire) et 59 bruitages en couches avec variantes (pas selon le sol, atterrissages, combos, cartes, coups, télégraphes et capacités des boss, menus) ; quatre presets.

Eidra : capuche sombre couronnée d'épines dorées, masque blanc aux yeux pourpres, longs cheveux noirs, robe ivoire éclaboussée de rouge, cape pourpre en lambeaux, bâton doré ; sa résonance tourne autour d'elle en cartes rouges qu'elle lance d'un appui bref (en éventail de trois après une parade), qui forment un bouclier pendant la parade et jaillissent en rafale à l'attaque chargée. Combo de bâton en trois coups (balayage, arc montant, estoc), dash à traînée pourpre, poses de saut, d'apex et de chute, pogo bâton vers le bas.

Personnages : silhouettes stylisées et originales pilotées par les données — capuches pointues, capes plissées à pointes, masques de céramique fêlés aux yeux lumineux qui clignent, cols dorés, écharpe et voiles animés, jambes animées selon la distance parcourue, contours encrés et ombrage cartoon. UX : tutoriel contextuel qui retire chaque invite dès que le geste est fait, réglages par onglets avec valeurs affichées et réinitialisation, notifications empilées, cartes de sauvegarde détaillées, pause avec objectif et rappel des commandes, carte en itinéraire, conseils à la mort et au chargement.

Décor : silhouettes peintes superposées dans une brume colorée, avec une ambiance propre à chaque secteur (turquoise, bleu et ambre, jade, bronze, indigo et or ; puis braise, fournaise, cendre violette et jardin mort rose pâle), lisières claires sous les pieds, lanternes et halos, rayons, nappes de brume qui dérivent, dalles de mémoire fantômes.

Progression : chaque secteur est une étape dont la sortie reste scellée jusqu'à la chute de ses gardiens ; le Porteur du dernier ordre, le Gardien Sans Visage, la Sentinelle de cendre et Ilyra scellent leur arène. Impossible de passer sans les vaincre. Les ennemis restent sur leur sol, ne traversent pas les dalles et blessent au contact. Animation : anticipation, fente et affaissement lisibles pour chaque attaque, poses propres à chaque pattern des boss et démarches distinctes (pas lourds, lévitation, bonds, glisse), masque qui éclate à la mort et reconstitution à l'ancrage, poussière de course, de saut et d'esquive, lames de lumière pour les pouvoirs et les victoires.

Présentation : caméra perspective à longue focale (parallaxe réelle des décors et silhouettes de premier plan), étalonnage ACES et vignette dans les shaders, rayons de lumière, ciel en dégradé, rim light des personnages, squash & stretch, traînée de dash, poussière d’atterrissage, flash blanc à l’impact, dissolution des ennemis, éclats attirés vers Eidra, chiffres de dégâts, barres de vie ennemies, barres « chip », cartes de titre (zones, boss, victoires), bannière de pouvoir, dialogues tapés, invites adaptées au périphérique.

Les sept fragments et trois fins sont définis et leurs conditions sont testées dans le domaine narratif. Les deux actes **ne constituent pas encore la campagne complète** : les autres pouvoirs, régions et boss restent dans la roadmap. La durée de 35–50 minutes est une cible de conception, non une durée certifiée par playtest.

## Validation

```sh
npm run check
npm run validate:assets
npx playwright install chromium
npm run test:e2e
```

Les E2E lancent le **build de production**. Un Chromium installé autrement peut être utilisé via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Le test logiciel n'établit pas la performance sur GPU réel.

## Diagnostic

`?debug=1` : FPS, temps de frame, CPU, GPU si disponible, draw calls, triangles, meshes, ressources physiques, secteurs, état et coordonnées. `?renderer=webgl2` force le fallback. Les commandes de diagnostic sont décrites dans [DEBUG.md](docs/DEBUG.md).

## Documentation

[État et limites](docs/RELEASE_NOTES.md) · [Roadmap](docs/ROADMAP.md) · [Architecture](docs/ARCHITECTURE.md) · [Histoire](docs/STORY.md) · [Pipeline d'assets](docs/ASSET_PIPELINE.md) · [Déploiement Cloudflare](docs/DEPLOYMENT.md) · [Règles de contribution](docs/AGENT_RULES.md).

Les modèles et la musique portent **TODO_ART** : ils sont originaux et utilisables pour tester le prototype, pas annoncés comme des assets artistiques définitifs.

## Archive de livraison

L’archive `EIDRA-0.1.0-prelude.zip` contient les sources, le build `dist`, la documentation, les captures et `eidra-history.bundle` avec les commits du projet. Après extraction, ouvrir un terminal dans `eidra`, exécuter `npm ci`, puis `npm run preview` pour jouer au build fourni. Pour récupérer l’historique dans un autre dossier : `git clone eidra-history.bundle eidra-source`.

Reproduire le paquet depuis un dépôt propre : `npm run build`, puis `python3 tools/package_release.py`. Le script refuse un arbre non committé ou un asset de build trop grand pour Pages, vérifie l’archive et inclut un manifeste SHA-256.
