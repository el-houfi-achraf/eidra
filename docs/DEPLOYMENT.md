# Déploiement Cloudflare Pages

Le build est un site statique. Aucun backend, aucune clé intégrée au navigateur. Les sauvegardes IndexedDB sont locales au navigateur et à l'origine : changer de domaine ne transporte pas les sauvegardes.

## Préparer

```sh
npm ci
npm run check
npm run validate:assets
npm run manifest
npx playwright install chromium
npm run test:e2e
```

Node 24. Build : `npm run build`. Dossier à publier : `dist`. `_headers` apporte les politiques de contenu et de cache. Tous les décodeurs utilisés sont servis localement. Aucun asset individuel ne dépasse la limite Pages de 25 MiB, vérifiée par le validateur.

## Compte Cloudflare autorisé

Après authentification de l'opérateur, utiliser le CLI officiel Wrangler :

```sh
npx wrangler@4 login
npx wrangler@4 pages project create eidra --production-branch main
npx wrangler@4 pages deploy dist --project-name eidra
```

La création du projet n'est nécessaire qu'une fois. Alternative : importer le dépôt GitHub dans Pages avec Node 24, la commande `npm run build` et le dossier `dist`.

En CI, les secrets `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` sont gérés dans l'environnement CI, jamais dans Git ou dans une variable `VITE_*`.

## Vérification après publication

Démarrage normal, fallback `?renderer=webgl2`, aucun asset 404, physique WASM, décodage audio après clic, checkpoint et rechargement. Vérifier le CSP réel et la persistance sur le domaine choisi. Qualifier WebGPU sur GPU réel avant release publique.

## Retour arrière

Conserver le précédent artefact `dist` et utiliser le rollback Pages. Les migrations ne doivent jamais rétrograder une sauvegarde de version supérieure.

## État de cette livraison

Aucun jeton Cloudflare ni compte connecté disponible pendant la réalisation. Aucun site public n'est présenté comme déployé. Le connecteur GitHub est connecté, mais aucun dépôt ni installation ne sont accessibles. La création via le navigateur demande une connexion GitHub distincte. Le dépôt Git local et sa CI sont livrés ; aucun push distant ni passage de CI hébergée ne sont revendiqués.

Référence : https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
