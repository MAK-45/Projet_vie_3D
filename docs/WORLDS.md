# Mondes : assembler une carte avec les assets

Un **monde** est un fichier de `src/worlds/` qui fabrique une carte entière à partir d'une graine : le sol, le
placement des assets, le ciel. Premier monde : la **prairie d'été** (`src/worlds/summer-meadow.js`), une île de
plaine vallonnée avec ses bosquets, ses rochers et son ciel de beau temps. On la parcourt dans l'**explorateur**
(`explorer.html`, Artifact « Prairie d'été » : https://claude.ai/artifact/HcgvMr9SU1NK2Bk7Rf5BDc).

## La prairie d'été

```js
import { createSummerMeadow } from "src/worlds/summer-meadow.js";

const world = createSummerMeadow({ seed: 7, size: "medium", variant: "mixed" });
scene.add(world.group);                    // contient aussi la lumière du jour
world.update({ camera, cameraAzimuth, target, dt, viewRadius, shadows });   // à chaque image, caméra à jour
world.heightAt(x, z);                      // hauteur du sol, pour poser un personnage
world.collide(position, radius);           // ne pas traverser troncs et gros rochers, ni sortir de la carte
world.dispose();
```

| Réglage | Valeurs |
|---|---|
| `seed` | 0 à 9999 : relief, bosquets, affleurements, nappes de fleurs |
| `size` | `small` 48 m, `medium` 96 m, `large` 144 m de côté |
| `variant` | `ready` : sol de prairie de la bibliothèque + arbres, rochers, ciel ; `assets` : sol vert uni + toute la végétation en volume (pelouses, touffes, hautes herbes, fleurs, mousse, taupinières) ; `mixed` : les deux |

Les trois habillages d'une même graine partagent le relief, les arbres, les rochers et les nuages.

**Échelle** : 1 unité = 1 mètre, sans tricher. Le promeneur fait 1,80 m ; un massif de fleurs arrive au genou
(35 à 55 cm), une touffe d'herbe à mi-cuisse, les hautes herbes à la taille, un rocher de 0,4 à 2 m, un bouleau
7 à 11 m, un chêne 9 à 13 m, un tilleul 10 à 15 m. Les copies d'un asset ne changent de taille que de ±20 %.

**Ce qui rend le pré crédible** : les arbres se serrent en bosquets et laissent des clairières ; les arbres
isolés sont surtout de grands chênes ; les rochers percent en affleurements sur les hauteurs ; l'herbe se fait
rare à l'ombre des couronnes et disparaît au pied des troncs ; chaque fleur a ses nappes (coquelicots et bleuets
sur le sec, boutons d'or dans les creux humides, lavande sur les bosses) ; la mousse pousse du côté à l'ombre des
troncs ; les taupinières vont par colonies en plein pré.

## Outils (`src/worlds/kit/`)

- **`scatter.js` — `ScatterField`** : pose des milliers de copies d'assets. Un asset modèle = une couche = un
  `InstancedMesh` par maillage du modèle, donc autant de draw calls que l'asset seul. Le monde est découpé en
  cases ; seules les copies des cases vues par la caméra sont envoyées au GPU, et la liste n'est refaite que
  quand elle change. Un plafond de triangles éclaircit les couches fines (herbes, fleurs) quand la vue
  s'élargit ou qu'un bosquet prend le budget.
- **`sky.js`** : `createDaylight` (soleil fixe dans le monde, carte d'ombre qui suit la vue par pas d'un texel),
  `createSunDisc` (l'asset « Soleil » accroché au fond du décor, visible dans le ciel dégagé quand on incline la
  vue vers l'horizon), `createClouds` (bancs de nuages visibles autour de l'île ; au-dessus de la carte, les
  nuages ne sont dessinés que dans la carte d'ombre : on voit leur ombre glisser sur le pré sans qu'ils cachent
  le promeneur).
- **`terrain.js`** : tranche de l'île (terre puis roche), normale du sol.

Règles apprises en assemblant la prairie :

- La végétation posée sur le sol prend l'**identifiant de contour du sol** (`uId`), sinon chaque touffe est
  cernée de sombre et le pré devient une résille noire. Les pétales gardent leur contour.
- Vu presque à l'horizontale, le sol se cache lui-même derrière chaque bosse et la passe de contours y trace un
  trait : donner au matériau du sol `uSelfEdge = 4`.
- Les formes de quelques pixels (papillons, graines) : `createToonMaterial({ outline: false })`, sinon leur
  contour les mange.
- Les plaques posées au sol (pelouse, mousse, terre) sont **couchées sur la pente** ; la motte sombre de la
  pelouse est retirée, les brins poussent directement sur le sol.
- La carte d'ombre est refaite une image sur deux (le décor ne bouge qu'à 12 images par seconde).

## L'explorateur (`src/explorer/`, `explorer.html`)

Une barre rouge de 1,80 m qu'on promène : flèches ou ZQSD (WASD), Maj pour courir, A / E pour tourner la vue ;
au doigt, une manette ronde. La caméra isométrique suit ; on tourne, on incline (de 11° à 68°) et on zoome.
« Balade auto » promène la barre toute seule. En développement, l'URL accepte
`?variant=ready|assets|mixed&seed=1&size=small|medium|large&az=45&el=35&zoom=1.5&x=0&z=0&stroll=1`.

`src/fx/ambient-life.js` ajoute des papillons et des graines qui dérivent dans le vent (1 draw call).

## Mesures (carte moyenne, vue de départ, moyenne par image)

| Habillage | Draw calls | Triangles |
|---|---|---|
| `ready` | 40 à 55 | 100 000 à 135 000 |
| `assets` | 65 à 80 | 170 000 à 210 000 |
| `mixed` | 65 à 80 | 170 000 à 210 000 |

Les arbres pèsent le plus lourd (4 000 à 5 000 triangles pièce, comptés une fois et demie avec leur ombre).
L'herbe en volume dépasse le budget de `docs/PERFORMANCE.md` (150 000 triangles) : une touffe coûte 36 à
64 triangles et il en faut une par mètre carré. Pour couvrir un pré entier en volume, il faudra une touffe
allégée (une dizaine de triangles) réservée au semis de masse.
