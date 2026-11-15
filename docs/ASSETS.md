# Assets : les dessiner, les ranger, les retrouver

Un **asset** est un dessin 3D réutilisable (arbre, meuble, objet, créature...) écrit en JavaScript : pas de fichier
de modèle, tout est construit par du code à partir d'une graine. Tous les assets sont visibles dans la galerie
(`npm run dev`, ou l'Artifact « Atelier Vie 3D ») et décrits dans un catalogue lisible par une IA.

## Où sont les choses

```
src/assets/
  index.js            registre : la liste de tous les assets + findAssets()
  taxonomy.js         catégories et sous-catégories autorisées, biomes
  kit/                outils partagés : rng (graine), geometry (tubes, feuilles, fusion), params
  <catégorie>/<sous-catégorie>/<nom>.js     un fichier par asset
src/engine/           toon-material (matériau à palette), pixel-renderer (basse réso + contours), iso-camera
src/gallery/          la galerie web (visionneuse, catalogue, fiche, code)
public/catalog/       GÉNÉRÉ par `npm run catalog`, versionné :
  catalog.json          fiches de tous les assets (sans le code)
  modules/<slug>.js     module autonome de chaque asset (dépendances incluses, seul `three` à fournir)
```

L'**identifiant** d'un asset est son chemin sous `src/assets/` sans `.js` : `nature/trees/birch`.
Son **slug** remplace les `/` par des `-` : `nature-trees-birch` (nom du module autonome, ancre dans la galerie).

## Retrouver un asset (pour un agent IA)

| Tu as accès à... | Fais ceci |
|---|---|
| le dépôt | lis `public/catalog/catalog.json`, filtre sur `category`, `subcategory`, `tags`, `biomes` ; le code prêt à l'emploi est à `assets[i].module` (`public/catalog/modules/<slug>.js`) |
| le code du projet | `import { findAssets, getAsset } from "src/assets/index.js"` puis `findAssets({ category: "nature", text: "arbre" })` |
| la page de la galerie (Artifact) | lis la balise `<script type="application/json" id="pv3d-catalog">` : même catalogue, avec en plus `source` et `standalone` (le code) pour chaque asset ; en JavaScript : `PV3D.find(...)`, `PV3D.getModule(id)` |

Utiliser un module :

```js
import { create, tick, dispose } from "./nature-trees-birch.js"; // ou depuis src/assets/nature/trees/birch.js

const tree = create({ seed: 3, season: "autumn" }); // THREE.Group, origine au sol
scene.add(tree);
tick(elapsedSeconds); // à chaque image : vent
dispose(tree);        // quand on n'en a plus besoin
```

Le rendu pixel art complet (basse résolution, contours) demande `PixelRenderer` et `IsoCamera` de `src/engine/`
(voir `src/gallery/viewer.js` pour un exemple complet de scène). Il faut une `DirectionalLight` dans la scène.

## Contrat d'un module d'asset

```js
export const meta = {
  id: "nature/trees/birch",        // = chemin du fichier
  name: "Bouleau",                 // nom affiché, en français
  nameEn: "Birch tree",
  category: "nature",              // clés de src/assets/taxonomy.js
  subcategory: "trees",
  description: "…",                // une ou deux phrases : ce qu'on voit, ce qui varie
  tags: ["arbre", "bouleau", …, "tree", "birch", …],   // voir ci-dessous
  biomes: ["forest", "meadow"],    // parmi `biomes` de taxonomy.js
  version: 1,                      // +1 à chaque changement visible
  added: "2026-11-15",
  units: "…",
  footprint: { radius: 2.6, height: 8.2 },   // encombrement en mètres (cadrage, placement)
  animated: ["wind"],              // ou []
  params: {                        // la galerie fabrique un contrôle par paramètre
    seed:   { type: "int", default: 1, min: 0, max: 9999, label: "Graine", description: "…" },
    season: { type: "enum", default: "summer", values: [...], labels: {...}, label: "Saison", description: "…" },
    height: { type: "number", default: 7.5, min: 5, max: 9.5, step: 0.5, unit: "m", label: "Hauteur", description: "…" },
  },
  variants: [{ id: "autumn", name: "Automne", params: { season: "autumn" } }],   // formes à mesurer et montrer
};

export function create(params = {}) { … return group; }   // THREE.Group ; group.userData.asset = { id, params }
export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";
```

Règles :

- **Déterministe** : même `params` → même objet. Tout hasard passe par `createRng(seed)`.
- **Aucun effet au chargement** du module (pas de DOM, pas de `window`) : le catalogue l'importe dans Node.
- **Unités** : 1 unité = 1 mètre, Y vers le haut, origine au sol au centre de l'emprise. 16 pixels d'art par mètre
  au zoom 1 : ne rien modéliser de plus fin que ~0,07 m (un pixel), ça scintille.
- **Matériaux** : uniquement `createToonMaterial` (rampe de 2 à 6 couleurs, de l'ombre vers la lumière, avec
  glissement de teinte : ombres froides, lumières chaudes). Donner un `id` de contour différent à chaque partie
  qui doit être cernée séparément (tronc 10, feuillage 11...). Pas de `MeshStandardMaterial` : il n'écrit pas les
  données dont la passe de contours a besoin.
- **Budget** : viser < 5 000 triangles et ≤ 3 draw calls par asset (fusionner avec `mergeGeometries`) ; aucune
  texture si un motif procédural suffit (`pattern: "bark" | "speckle"`).
- **Ombres** : `castShadow` / `receiveShadow` sur les maillages ; le feuillage a besoin de
  `mesh.customDepthMaterial = material.userData.depthMaterial`.

## Tags

Minuscules, en **français puis en anglais** (les deux, pour être trouvé dans les deux langues). Couvrir :

1. ce que c'est, du précis au général : `bouleau`, `arbre`, `feuillu`, `végétation` ;
2. ce qui le distingue à l'œil : `tronc blanc`, `feuillage` ;
3. ce qu'il sait faire : `vent`, `saisons`, `procedural` ;
4. où il va : `extérieur` / `intérieur` (les biomes vont dans `biomes`, pas dans les tags).

## Ajouter un asset : la marche à suivre

1. Relire `docs/ART-DIRECTION.md` et `docs/PERFORMANCE.md`, charger les skills three.js.
2. Choisir catégorie et sous-catégorie dans `src/assets/taxonomy.js` (n'en créer une que si aucune ne convient).
3. Écrire `src/assets/<catégorie>/<sous-catégorie>/<nom>.js` en suivant le contrat ci-dessus
   (modèle : `src/assets/nature/trees/birch.js`).
4. L'ajouter à la liste de `src/assets/index.js`.
5. Regarder le résultat : `npm run dev`, puis capture
   `node scripts/capture.cjs "http://127.0.0.1:5173/dev/test.html?asset=<id>" /tmp/x.png 412 915 2`
   (mobile) et en 1440×900 (desktop). Tester chaque variante, la vue de face, le mode sans pixel art.
6. `npm run artifact` (régénère aussi `public/catalog/`), puis publier `dist-artifact/atelier-vie-3d.html`
   sur l'Artifact « Atelier Vie 3D » (lien dans `CLAUDE.md`) et donner le lien à l'utilisateur.
7. Commit : le fichier de l'asset, `index.js`, et `public/catalog/`.
