# EIDRA: Shards of Silence

**Prélude jouable — prototype du vertical slice.** Un laboratoire original en 2.5D, construit avec TypeScript, Babylon.js 9.27 et Havok Web. Ce dépôt contient le jeu, ses sources, les assets temporaires originaux, les tests et la documentation. La campagne complète de neuf régions n'est pas encore implémentée.

## Jouer localement

Node.js **24** et npm requis. Depuis le dossier `eidra` :

```sh
npm ci
npm run dev
```

Ouvrir **http://127.0.0.1:5173**. Cliquez sur **Nouvelle partie**, puis un emplacement libre. L'audio démarre après ce geste. Les sauvegardes restent dans ce navigateur. Utilisez un ancrage avec E avant de quitter.

Pour jouer au build de production :

```sh
npm run build
npm run preview
```

Ouvrir l'adresse indiquée par Vite, généralement http://127.0.0.1:4173. Ne pas ouvrir `dist/index.html` directement avec `file://` : le moteur charge du JavaScript et du WASM par HTTP.

## Commandes

| Action                         | Clavier / souris                       | Manette standard     |
| ------------------------------ | -------------------------------------- | -------------------- |
| Déplacement                    | A / D ou flèches                       | Stick gauche / croix |
| Marcher                        | Ctrl maintenu                          | Stick partiel        |
| Saut                           | Espace, W ou flèche haut               | A                    |
| Attaque légère / aérienne      | J / clic gauche                        | X                    |
| Charger une attaque            | K / clic droit maintenu, puis relâcher | LT                   |
| Esquive, après acquisition     | Maj                                    | B                    |
| Parade                         | L                                      | LB                   |
| Rémanence, après acquisition   | Q                                      | Y                    |
| Memory Step, après acquisition | R                                      | RB                   |
| Dialogue / ancrage / passage   | E                                      | RT                   |
| Carte et souvenirs             | Tab                                    | View                 |
| Pause                          | Échap                                  | Start                |

Touches remappables dans Réglages. Assistance facultative : dégâts reçus réduits. La manette permet également de parcourir les boutons des menus avec le stick vertical / la croix et A. Le réglage des sliders reste accessible au clavier / à la souris.

## Contenu jouable

Cinq secteurs du laboratoire ; mouvement avec coyote time et jump buffer ; capsule Havok ; dash ; attaques légère, chargée, aérienne et pendant le dash ; combo ; parade ; trois archétypes ennemis ; mini-boss ; Gardien Sans Visage avec trois patterns et deux phases ; Rémanence ; Écho de cinq secondes ; contrepoids ; raccourci de maintenance ; deux souvenirs ; Mira ; transmission de Sael ; ancrages ; trois sauvegardes ; carte ; mort et respawn ; musique et sons originaux temporaires ; quatre presets.

Les sept fragments et trois fins sont définis et leurs conditions sont testées dans le domaine narratif. Ils **ne constituent pas encore une campagne jouable**. Les autres pouvoirs, régions et boss restent dans la roadmap. La durée de 15–20 minutes est une cible de conception, non une durée certifiée par playtest.

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
