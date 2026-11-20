# Axes de variation

Chaque asset varie selon **une graine** et selon **les axes de sa famille**. Les axes portent les mêmes noms
et les mêmes valeurs d'un asset à l'autre : c'est ce qui permet à un monde de demander « tout en automne » ou
« tout en granit » sans connaître chaque asset. Les fabriquer avec `src/assets/kit/variation.js`.

## La graine (tous les assets)

`seed: seedParam("ce que la graine change")`, entier de 0 à 9999, défaut 1.

- Elle change ce qui se voit **à la silhouette** : inclinaison, nombre et position des parties, proportions,
  asymétries, cassures. Deux graines voisines doivent se distinguer dans une vignette de 150 pixels.
- Elle ne change **pas** la nature de l'objet : un bouleau reste un bouleau, une 2CV reste une 2CV. Ce qui change
  la nature de l'objet est un axe à choix (`model`, `style`), pas la graine.
- Garder l'objet plausible pour toutes les graines : borner les tirages (`rng.range(0.85, 1.15)`), ne jamais
  laisser une partie sortir de l'emprise ou passer sous le sol.
- Un générateur par aspect (`createRng(seed * 7919 + 17)` pour la forme, un autre pour les détails) : ajouter
  un détail plus tard ne change pas la silhouette des graines déjà utilisées dans des scènes. Si la forme change
  quand même pour une graine donnée, augmenter `meta.version`.
- `npm run check` exige que les graines 1 à 5 donnent 5 formes différentes.

## Axes par famille

Valeurs en anglais dans le code, noms affichés en français (`labels`). Un asset ne prend que les axes qui ont un
effet visible sur lui : 1 à 3 axes à choix suffisent, au-delà la galerie devient illisible.

| Famille | Axes à choix | Réglages numériques courants |
|---|---|---|
| Arbres, plantes, fleurs, herbes | `season` (spring, summer, autumn, winter) ; `bloom` (none, buds, flowers, fruits) pour ce qui fleurit | `height`, `fullness` (densité du feuillage), `age` |
| Roches, falaises, galets | `stone` (granite, sandstone, limestone, basalt, slate) ; `cover` (bare, moss, snow) | `size`, `roughness` |
| Terrain, sols, eau | `season` ; `ground` (grass, dirt, sand, snow, stone) | `size` |
| Éléments de construction (mur, pilier, arche, escalier, clôture, toit) | `stone` ou `wood` selon la matière ; `masonry` (rubble, coursed, ashlar, brick) pour l'appareil ; `wear` (new, worn, ruined) | `width`, `height`, `depth` en mètres ou en modules |
| Bâtiments | `style` (cottage, timber, stone, tower...) ; `roof` (thatch, tile, slate, shingle) ; `stone` / `wood` pour les murs ; `season` si le toit prend la neige | `floors`, `width` |
| Mobilier | `wood` (oak, pine, walnut, birch) ; `fabric` (couleur du tissu) ; `wear` | `width` |
| Objets | `material` propre à l'objet (iron, brass, clay, glass...) ; `state` (lit / unlit, open / closed, full / empty) | `size` |
| Véhicules (voitures, chariots, bateaux) | `model` (carrosserie) ; `paint` (couleur) ; `wear` (new, used, wreck) | `length` |
| Vaisseaux | `model` ; `paint` ; `state` (landed, flying : train sorti, réacteurs allumés) | `size` |
| Ciel (astres, nuages) | `time` (dawn, noon, dusk) pour le soleil ; `phase` (full, gibbous, quarter, crescent) pour la lune ; `kind` (cumulus, stratus, storm) pour les nuages ; `shape` et `tint` pour les étoiles | `size` |
| Créatures d'ambiance | `species` ou `coat` (pelage, plumage) ; `pose` (idle, sitting, flying) | `size` |

Règles pour les saisons, communes à tout le vivant :

- `spring` : feuillage plus clair et moins dense, bourgeons ou fleurs ;
- `summer` : la forme de référence (valeur par défaut) ;
- `autumn` : jaunes, oranges, roux ; feuillage un peu clairsemé, feuilles au sol ;
- `winter` : caduc nu, persistant inchangé ou givré ; neige possible sur ce qui est plat.

Un persistant (sapin, buis) garde `season` s'il change quand même (neige, pommes de pin) ; sinon il ne le
propose pas.

## Matières partagées

`src/assets/kit/palettes.js` contient les rampes de couleurs des pierres (`STONES`), des bois (`WOODS`), des
couvertures mousse et neige (`COVERS`, axe `cover` via `coverParam`), des neiges (`SNOWS` : fraîche, tassée),
des mousses par saison (`MOSSES`) et des sols (`GROUNDS` : terre, argile, boue). Les formes de neige, mousse
et terre, au sol ou drapées sur un objet, sont dans `src/assets/kit/ground-cover.js`.
`stoneParam(description, { only: ["granite", "slate"] })` limite le choix aux matières plausibles pour l'asset.

- Une matière absente (brique, tuile, chaume, métal, tissu, peinture) : l'ajouter à `palettes.js` sous un nouveau
  groupe (`BRICKS`, `ROOFS`, `METALS`, `PAINTS`...) avec `label`, `ramp` (4 couleurs, ombre → lumière, ombres
  froides et lumières chaudes) et `ink`, puis la réutiliser dans les assets suivants.
- Les rampes de pierre et de bois ont été choisies sur nuancier, pas encore jugées sur un asset : les regarder à
  l'écran au premier usage et les corriger dans `palettes.js` (tous les assets suivent).
- La matière ne change pas que la couleur quand c'est possible : le grès se taille en blocs réguliers, le
  granit en blocs massifs, l'ardoise en plaques. Un `stone` qui ne fait que recolorer est acceptable, un `stone`
  qui change aussi le découpage est mieux.

## Nouveaux axes

Un axe qui servira à plusieurs assets (`wear`, `paint`, `roof`...) se déclare une fois dans `kit/variation.js`
(liste de valeurs + fonction `xxxParam`), comme `seasonParam`. Un axe propre à un seul asset se déclare sur place
avec `choiceParam("Nom", { value: "Nom affiché", ... }, "description")`.

Variantes : `variants: variantsOf("season", params.season)` pour l'axe principal. Avec deux axes à choix, garder
les variantes de l'axe le plus visible ; la planche de contrôle montre ces variantes en lignes.
