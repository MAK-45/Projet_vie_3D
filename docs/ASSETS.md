# Assets : les dessiner, les ranger, les retrouver

Un **asset** est un dessin 3D réutilisable (arbre, meuble, objet, créature...) écrit en JavaScript : pas de fichier
de modèle, tout est construit par du code à partir d'une graine. Tous les assets sont visibles dans la galerie
(`npm run dev`, ou l'Artifact « Atelier Vie 3D ») et décrits dans un catalogue lisible par une IA.

## Où sont les choses

```
src/assets/
  index.js            registre : la liste de tous les assets + findAssets()
  taxonomy.js         catégories et sous-catégories autorisées, biomes
  kit/                outils partagés : rng (graine, bruit 3D), geometry (tubes, feuilles, rochers, buttes,
                      drapés, fusion), params, variation (axes partagés : graine, saison, pierre, bois,
                      couverture), palettes (matières), ground-cover (neige, mousse, terre au sol ou drapées)
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
import { numberParam, seasonParam, seedParam, variantsOf } from "../../kit/variation.js";

const params = {                   // la galerie fabrique un contrôle par paramètre
  seed: seedParam("Change la silhouette : inclinaison du tronc, branches, touffes."),
  season: seasonParam("Couleur et densité du feuillage ; l'hiver, l'arbre est nu."),
  height: numberParam("Hauteur", 7.5, 5, 9.5, "Hauteur du tronc.", { step: 0.5, unit: "m" }),
};

export const meta = {
  id: "nature/trees/birch",        // = chemin du fichier
  name: "Bouleau",                 // nom affiché, en français
  nameEn: "Birch tree",
  category: "nature",              // clés de src/assets/taxonomy.js
  subcategory: "trees",
  description: "…",                // une ou deux phrases : ce qu'on voit, ce qui varie
  tags: ["arbre", "bouleau", …, "tree", "birch", …],   // voir ci-dessous
  biomes: ["forest", "meadow"],    // parmi `biomes` de taxonomy.js
  version: 1,                      // +1 à chaque changement visible du dessin
  added: "2026-11-15",
  units: "…",
  footprint: { radius: 3.2, height: 8.4 },   // encombrement réel en mètres (cadrage, placement)
  animated: ["wind"],              // ou []
  params,
  variants: variantsOf("season", params.season),   // les formes montrées et mesurées dans le catalogue
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
  texture si un motif procédural suffit (`pattern: "bark" | "furrow" | "speckle"`).
- **Ombres** : `castShadow` / `receiveShadow` sur les maillages ; le feuillage a besoin de
  `mesh.customDepthMaterial = material.userData.depthMaterial`.

## Tags

Minuscules, en **français puis en anglais** (les deux, pour être trouvé dans les deux langues). Couvrir :

1. ce que c'est, du précis au général : `bouleau`, `arbre`, `feuillu`, `végétation` ;
2. ce qui le distingue à l'œil : `tronc blanc`, `feuillage` ;
3. ce qu'il sait faire : `vent`, `saisons`, `procedural` ;
4. où il va : `extérieur` / `intérieur` (les biomes vont dans `biomes`, pas dans les tags).

## Graine et axes de variation

Tous les assets ont une **graine** (`seed`) qui change leur silhouette : on peut poser dix fois le même asset
sans répétition visible, et la même graine redonne toujours la même forme. Ils ont en plus les axes de leur
famille, avec les mêmes noms et les mêmes valeurs partout (`src/assets/kit/variation.js`) :

| Famille | Axes |
|---|---|
| Végétation, terrain | `season` : spring, summer, autumn, winter ; fleurs : `species` (daisy, poppy, cornflower, buttercup, lavender) |
| Roches, bâti en pierre | `stone` : granite, sandstone, limestone, basalt, slate ; `cover` : bare, moss, snow |
| Bâti en bois, mobilier | `wood` : oak, pine, walnut, birch |
| Bâtiments, véhicules, vaisseaux, objets | axes à choix propres (`style`, `roof`, `model`, `paint`, `wear`, `state`...) |

Les rampes de couleurs des matières communes sont dans `src/assets/kit/palettes.js`. Le détail par famille est
dans `.claude/skills/create-asset/references/variation-axes.md`.

## Vérifier un asset

- `npm run check [-- <id>]` : fiche complète, rangement, graine déterministe et qui change la forme, chaque
  variante et chaque réglage extrême, matériaux, budget, emprise, catalogue à jour.
- `npm run sheet -- <id> [sortie.png]` : une image avec chaque variante en ligne, plusieurs graines en colonnes,
  plus les vues de face et de dessus. À regarder avant de publier.
- `dev/test.html?asset=<id>&…` avec `npm run dev` : l'asset seul en plein écran, pour un gros plan.

## Ajouter un asset

Avec Claude Code : demander l'asset (« génère un chêne »), le skill `create-asset` déroule toute la marche
(`.claude/skills/create-asset/SKILL.md`). En résumé :

1. choisir le rangement, les traits qui font reconnaître l'objet, ce que change la graine, les axes de variation ;
2. écrire `src/assets/<catégorie>/<sous-catégorie>/<nom>.js` à partir du modèle du skill, l'inscrire dans
   `src/assets/index.js` ;
3. `npm run check`, `npm run sheet`, regarder, corriger, recommencer ;
4. `npm run artifact`, publier la page sur l'Artifact « Atelier Vie 3D » (lien dans `CLAUDE.md`) ;
5. committer le fichier de l'asset, `index.js`, `public/catalog/` et les outils ajoutés au kit.
