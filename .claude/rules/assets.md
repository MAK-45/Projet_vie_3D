---
paths:
  - "src/assets/**"
---

# Assets

- Créer ou retoucher un asset se fait avec le skill `create-asset` ; le contrat d'un module est dans
  `docs/ASSETS.md`.
- Un asset = un fichier `src/assets/<catégorie>/<sous-catégorie>/<nom>.js` qui exporte `meta` et
  `create(params)`, inscrit dans `src/assets/index.js`. Catégories dans `src/assets/taxonomy.js`.
- Déterministe : tout hasard passe par `createRng(seed)`. Jamais `Math.random()` ni `Date` dans `create`.
- Paramètres construits avec `kit/variation.js` : `seed` toujours, puis les axes partagés de la famille
  (`season`, `stone`, `wood`...). Matières communes dans `kit/palettes.js`.
- Matériaux : uniquement `createToonMaterial`. Outils de géométrie généraux dans `kit/geometry.js`, pas dans le
  fichier d'un asset.
- Rien au chargement d'un module (pas de DOM, pas de `window`) : le catalogue l'importe dans Node.
- Après toute modification : `npm run check`, regarder `npm run sheet -- <id>`, puis `npm run artifact`
  (régénère `public/catalog/`, à committer avec le reste).
- Modifier le kit ou le moteur touche tous les assets : les revérifier tous à l'image.
