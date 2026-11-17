# Mondes : assembler une carte avec les assets

Un **monde** est une carte entière fabriquée à partir d'une graine : le sol, le placement des assets, le ciel.
Premier monde : la **prairie d'été**, une île de plaine vallonnée qui flotte dans une mer de nuages.

Un monde vit à trois endroits :

| Fichier | Rôle |
|---|---|
| `src/worlds/summer-meadow.js` | le générateur : `createSummerMeadow(options)` |
| `src/worlds/summer-meadow-endless.js` | la même prairie sans bord (`size: "infinite"`), fabriquée autour du promeneur |
| `src/worlds/summer-meadow-models.js` | les assets semés et leurs réglages, communs aux deux |
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
| `size` | `small` 48 m, `medium` 96 m, `large` 144 m de côté, ou `infinite` : sans bord (voir plus bas) |
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

- **`scatter-stream.js` — `ScatterStream`** : le même semis pour un monde sans bord. Les couches sont les mêmes
  (`addLayer`), mais les copies arrivent et repartent par morceaux (`beginChunk`, `commitChunk`, `removeChunk`) ;
  les tampons de matrices grandissent par doublement, jamais à chaque image.
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
- **`terrain.js`** : tranche de l'île (terre puis roche), normale du sol ; `buildGroundPatch` /
  `buildGroundPatchSteps` : le sol d'un monde sans bord, une grille raccordable partagée entre le pré et la roche
  nue (deux matériaux, un maillage), fabriquée par rangées pour s'étaler sur plusieurs images.

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

- **Héroïne, Héros, Mannequin, Mannequin magique** : les personnages importés (`creatures/humanoid`), pieds au
  sol, avec un peu d'élan pour démarrer et s'arrêter. Ils jouent la **marche** (`Walk_Loop`) quand ils avancent et
  l'**attente** (`Idle_Loop`) à l'arrêt, en fondu de l'une à l'autre (`createWalkingHumanoid` dans
  `src/assets/kit/humanoid.js`). La marche est jouée sur place, accélérée ou ralentie pour que les pieds suivent
  le sol (environ 1 m/s naturel, 1,3 m/s en marche, 1,8 m/s en pressant le pas avec Maj : pas encore de course).
  Le mannequin magique éclaire le décor la nuit.

Un nouveau personnage = un corps (`create…()` d'un asset) et une conduite dans `STYLES` de `walker.js` ; un
personnage importé de plus dans `CHARACTERS` de `kit/humanoid.js` apparaît tout seul dans l'explorateur.

Caméra pendant la balade auto : **Fixe** (ne tourne pas), **Pivote** (un cran toutes les 9 secondes), **Suit**
(se replace derrière le promeneur quand il change de cap).

`explorer.html` le montre seul, en plein écran, pour les captures :
`?seed=1&size=small&moment=night&weather=rain&camera=follow&character=superhero-female&trees=2&az=45&el=35&zoom=1.5&x=0&z=0&stroll=1&clean=1`.

## Mesures (carte moyenne, vue de départ, moyenne par image)

65 à 80 draw calls, 150 000 à 210 000 triangles selon le nombre d'arbres en vue (4 000 à 5 000 triangles pièce,
comptés une fois et demie avec leur ombre). L'herbe en volume fait dépasser le budget de `docs/PERFORMANCE.md`
(150 000 triangles) dans les bosquets : une touffe coûte 36 à 64 triangles. Une touffe allégée (une dizaine de
triangles) réservée au semis de masse ramènerait le tout dans le budget. La mer de nuages, la brume, la teinte
de l'heure et la pluie ne coûtent que des pixels de l'image basse résolution : 1 draw call et aucune géométrie.

## La prairie sans bord (`size: "infinite"`)

Même prairie, mêmes assets, mêmes règles de pousse, mais pas d'île : le monde se fabrique autour du promeneur
au fil de la marche (`src/worlds/summer-meadow-endless.js`).

- **Morceaux de 32 × 32 m.** Tout ce qu'un morceau contient se tire de (graine, position) : revenir sur ses pas
  redonne exactement les mêmes arbres. Les arbres se décident par cases de 4 m indépendantes (une candidate par
  case, qui cède sa place à une voisine trop proche et prioritaire) ; rochers, herbes et fleurs par morceau.
- **Lesquels ?** Ceux que la vue touche, avec 24 m de marge, plus les 3 × 3 autour du promeneur. Les plus
  proches d'abord. 40 morceaux finis restent en réserve hors de la vue ; au-delà, les plus anciens sont oubliés.
- **Étalé sur plusieurs images.** Un morceau se fabrique en une trentaine de petites étapes (sol par rangées,
  plans des voisins, grille de pousse, pelouses, touffes en 8 tranches, fleurs, mousse) et n'apparaît qu'une fois
  fini : 4 ms par image, 12 ms si un morceau de la vue manque encore. Après un saut (départ, téléportation),
  ce qui est dans la vue se fabrique d'un coup, derrière l'écran « Génération… ».
- **Sol** : un maillage par morceau, un sommet tous les 0,5 m jusqu'à 60 m du promeneur, tous les mètres au-delà
  (76 m pour repasser au fin) ; les bords des morceaux fins sont calés sur la grille d'un mètre, sans fente.
- **Relief** : les ondulations du sol de prairie, des **collines** larges (jusqu'à 13 m) et, par régions, des
  **montagnes** en crêtes (jusqu'à 90 m), tenues à l'écart du départ (rien avant 60 m, pleine hauteur à
  160 m). La roche nue (pentes fortes, sommets) remplace le pré triangle par triangle, cernée d'un contour ; les
  arbres se raréfient et rapetissent en montant, l'herbe et les fleurs aussi ; les affleurements sont plus
  nombreux en montagne. **Pas de brume** : ce qu'on voit au loin est le vrai terrain, où l'on peut aller.
- **Départ** en plein pré, sans arbre entre le promeneur et la caméra de départ. **Balade auto** : un but à
  14 à 36 m, à peu près droit devant, par le chemin le plus doux (elle contourne les montagnes).
- Les ombres de nuages suivent le promeneur ; ni mer de nuages ni dessous d'île.
- La caméra orthographique garde son plan proche derrière elle (`near = -260`) : une montagne entre elle et le
  promeneur le cache, au lieu d'être coupée.

**Ce qu'on voit « au loin ».** La vue est orthographique : rien ne rapetisse avec la distance, et il n'y a pas
d'horizon. L'écran montre au plus 50 m devant le promeneur en vue de départ, 100 à 180 m en vue rasante (11°) et
dézoomée. Les collines se lisent par leurs crêtes, que la passe de contours trace en vue rasante ; une montagne
se voit en s'en approchant.

**Mesures** (téléphone 412 × 915, moyenne par image) :

| Vue | Draw calls | Triangles |
|---|---|---|
| Départ, prairie infinie | 63 | 243 000 (carte moyenne : 72 et 212 000) |
| Montagne | 69 | 237 000 |
| Dézoom 0,5, vue rasante 14° | 97 | 1 090 000 (grande île : 101 et 406 000) |

Fabrication : environ 11 ms par morceau sur un ordinateur, en étapes de moins de 1,3 ms (95 %) ; sur une marche
simulée de 600 m, même avec un processeur 4 fois plus lent et en vue rasante, aucune image n'a montré un
morceau manquant. Mémoire : 60 à 110 morceaux, environ 200 Ko chacun.

**Limite** : la vue rasante dézoomée voit beaucoup plus de terrain qu'une île bornée, donc beaucoup plus
d'arbres (4 000 à 5 000 triangles chacun). Le remède est un arbre allégé pour le lointain (quelques centaines de
triangles), à créer dans la bibliothèque ; le feuillage minimal des arbres actuels n'ôte qu'un quart des
triangles.
