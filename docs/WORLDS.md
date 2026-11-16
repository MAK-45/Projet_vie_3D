# Mondes : assembler une carte avec les assets

Un **monde** est une carte entière fabriquée à partir d'une graine : le sol, le placement des assets, le ciel.
Premier monde : la **prairie d'été**, une île de plaine vallonnée qui flotte dans une mer de nuages.

Un monde vit à trois endroits :

| Fichier | Rôle |
|---|---|
| `src/worlds/summer-meadow.js` | le générateur : `createSummerMeadow(options)` |
| `src/assets/worlds/islands/summer-meadow.js` | l'**asset** : le monde rangé dans la bibliothèque (catégorie « Mondes »), `create()` rend l'île en maquette |
| `src/explorer/explorer.js` | l'**explorateur** : l'interface qui règle le monde et permet de s'y promener |

Dans l'Atelier, la fiche d'un asset dont `meta.experience` vaut `"explorer"` ouvre l'explorateur à la place de la
visionneuse. `meta.composite: true` dit à `npm run check` qu'il s'agit d'un assemblage d'assets : le budget d'un
objet (5 000 triangles, 3 draw calls) ne s'applique pas, son poids se mesure à l'écran (voir Mesures).

## La prairie d'été

```js
import { createSummerMeadow } from "src/worlds/summer-meadow.js";

const world = createSummerMeadow({ seed: 7, size: "medium", trees: 1.5, flowers: 2 });
scene.add(world.group);                    // contient aussi la lumière du jour
world.setMood(atmosphere.values);          // heure et météo (kit/atmosphere.js)
world.update({ camera, target, dt, viewArea, viewRadius, shadows });   // à chaque image, caméra à jour
world.heightAt(x, z);                      // hauteur du sol, pour poser un personnage
world.collide(position, radius);           // ne pas traverser troncs et gros rochers, ni sortir de la carte
world.dispose();
```

| Réglage | Valeurs |
|---|---|
| `seed` | 0 à 9999 : relief, bosquets, affleurements, nappes de fleurs |
| `size` | `small` 48 m, `medium` 96 m, `large` 144 m de côté |
| `relief` | hauteur des ondulations, 0,6 à 3 m |
| `trees`, `rocks`, `grass`, `flowers` | abondance de 0 à 2 (1 = prairie à bosquets) |
| `diorama` | l'île seule, toutes copies dessinées, sans lumière ni ciel (fiche et vignette de l'asset) |

Le sol de prairie de la bibliothèque (herbe grasse, herbe sèche, terre, fleurs peintes) donne la couleur et couvre
tout ; par-dessus, pelouses, touffes, hautes herbes, massifs de fleurs, mousse et taupinières donnent le volume
et bougent au vent.

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
  quand elle change. La part d'herbes et de fleurs dessinée ne dépend que du cadrage (zoom, inclinaison).
- **`sky.js`** : `createDaylight` (astre fixe dans le monde, déplaçable avec `setSun` ; carte d'ombre qui suit la
  vue par pas d'un texel), `createCloudShadows` (des nuages de la bibliothèque dessinés seulement dans la carte
  d'ombre : on voit leur ombre glisser sur le pré, jamais le nuage).
- **`cloud-sea.js`** : la mer de nuages loin sous l'île et la brume tramée accrochée autour de sa pointe de roche.
  Un maillage, un draw call, pas de transparence.
- **`terrain.js`** : la tranche de l'île (`buildIslandBand`) et, dans l'explorateur, son dessous
  (`buildIslandUnderside`) : la roche s'effile en pointe déchiquetée à 0,6 × la taille de l'île sous le pré
  (28 à 72 m), la brume l'enveloppe aux quatre cinquièmes, la mer est 30 m plus bas. Le bord du pré reste net :
  on voit qu'on est sur une île qui flotte, pas au ras des nuages. 1 draw call, environ 4 000 triangles.
- **`atmosphere.js`** : moment (jour, crépuscule, nuit, cycle) et météo (beau, pluie, variable). Ne dessine rien :
  tient à jour la position de l'astre, la teinte de l'image, les couleurs du ciel et des nuages, la pluie, le
  vent, toujours en fondu.
- **`terrain.js`** : tranche de l'île (terre puis roche), normale du sol.

Dans le moteur, `PixelRenderer.setMood({ grade, saturation, rain, time })` teinte toute l'image dans la passe
finale (les rampes de couleurs des assets ne changent pas) et dessine la pluie à l'écran, sans géométrie.

## Règles apprises en assemblant la prairie

- **Rien ne doit apparaître ou disparaître au milieu de l'image.** La densité d'herbe ne dépend que du cadrage,
  jamais de ce qui se trouve dans la vue : en marchant sans toucher à la caméra, les copies n'entrent et ne
  sortent que par les bords. Les marges des cases couvrent la couronne d'un arbre et son ombre portée.
- **La caméra ne tourne jamais lentement toute seule.** En pixel art, chaque image d'une rotation redessine tous
  les pixels autrement : une rotation lente fait fourmiller le sol en continu. L'explorateur tourne par crans de
  45°, d'un geste de moins d'une seconde, puis reste immobile.
- **Le grain du sol peint** passe de 16 à 10 cases par mètre (`GROUND_GRAIN`) : en vue inclinée une case de
  1/16 m fait moins d'un pixel de haut, et ses points colorés clignotent dès que la vue bouge.
- La végétation posée sur le sol prend l'**identifiant de contour du sol** (`uId`), sinon chaque touffe est
  cernée de sombre et le pré devient une résille noire. Les pétales gardent leur contour.
- Vu presque à l'horizontale, le sol se cache lui-même derrière chaque bosse et la passe de contours y trace un
  trait : donner au matériau du sol `uSelfEdge = 4`.
- Les formes de quelques pixels (papillons, graines, lucioles) : `createToonMaterial({ outline: false })`, sinon
  leur contour les mange. Ces matières échappent aussi à la teinte de l'heure : une luciole reste vive la nuit.
- Les plaques posées au sol (pelouse, mousse, terre) sont **couchées sur la pente** ; la motte sombre de la
  pelouse est retirée, les brins poussent directement sur le sol.
- La carte d'ombre est refaite une image sur deux (le décor ne bouge qu'à 12 images par seconde).
- Un nuage vu d'en haut cache le promeneur : ni soleil ni nuage visibles au-dessus de la carte, seulement leurs
  ombres.

## L'explorateur (`src/explorer/`)

`new Explorer(container, { settings })` monte tout dans un bloc : la scène, le panneau de réglages (graine,
taille, abondances, relief, moment, météo), les actions (balade auto, caméra, vue de départ, masquer
l'interface, plein écran, **personnage**). Flèches ou ZQSD (WASD), Maj pour courir, A / E pour tourner la vue d'un
cran ; au doigt, une manette ronde.

Le personnage (`src/explorer/walker.js`, réglage `character`) se choisit dans le panneau d'actions :
- **Barre 1,80 m** : barre rouge pour juger des proportions, sans inertie, collée au sol.
- **Blob** : la Couveuse (`creatures/spirits/couveuse-blob`) en lévitation. Il prend son élan et freine en glissant,
  survole le relief avec un ressort amorti (il lit le sol 0,45 s devant lui pour ne pas buter dans les montées), se
  penche en avant en accélérant et s'incline dans les virages ; il éclaire le décor la nuit.

Un nouveau personnage = un corps (`create…()` d'un asset) et une conduite dans `STYLES` de `walker.js`.

Caméra pendant la balade auto : **Fixe** (ne tourne pas), **Pivote** (un cran toutes les 9 secondes), **Suit**
(se replace derrière le promeneur quand il change de cap).

`explorer.html` le montre seul, en plein écran, pour les captures :
`?seed=1&size=small&moment=night&weather=rain&camera=follow&character=blob&trees=2&az=45&el=35&zoom=1.5&x=0&z=0&stroll=1&clean=1`.

## Mesures (carte moyenne, vue de départ, moyenne par image)

65 à 80 draw calls, 150 000 à 210 000 triangles selon le nombre d'arbres en vue (4 000 à 5 000 triangles pièce,
comptés une fois et demie avec leur ombre). L'herbe en volume fait dépasser le budget de `docs/PERFORMANCE.md`
(150 000 triangles) dans les bosquets : une touffe coûte 36 à 64 triangles. Une touffe allégée (une dizaine de
triangles) réservée au semis de masse ramènerait le tout dans le budget. La mer de nuages, la brume, la teinte
de l'heure et la pluie ne coûtent que des pixels de l'image basse résolution : 1 draw call et aucune géométrie.

## Un monde sans bord ?

Possible sans toucher aux performances, parce que tout est déjà calculé en coordonnées du monde : le sol de
prairie se raccorde sans couture d'un morceau au suivant, et le semis est rangé par cases. Il suffirait de tirer
le contenu de chaque case de `(graine, case)` au lieu de tout semer d'avance, de fabriquer les cases un peu avant
qu'elles entrent dans la vue (une ou deux par image, pour ne pas faire sauter le rythme) et de libérer celles qui
en sortent. Le coût par image reste celui de ce qui est à l'écran. À trancher avant : un monde sans bord n'est
plus une île dans les nuages.
