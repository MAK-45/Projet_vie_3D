# Mondes : assembler une carte avec les assets

Un **monde** est une carte entière fabriquée à partir d'une graine : le sol, le placement des assets, le ciel.
Premier monde : la **prairie d'été**, une île de plaine vallonnée qui flotte dans une mer de nuages.

Un monde vit à trois endroits :

| Fichier | Rôle |
|---|---|
| `src/worlds/summer-meadow.js` | le générateur : `createSummerMeadow(options)` (l'île) |
| `src/worlds/summer-meadow-endless.js` | la prairie **infinie** (`size: "endless"`), fabriquée par morceaux autour du promeneur |
| `src/worlds/summer-meadow-rules.js` | ce que les deux partagent : modèles semés, où pousse quoi (bosquets, herbe, fleurs) |
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
| `size` | `small` 48 m, `medium` 96 m, `large` 144 m de côté ; `endless` : sans bord (explorateur seulement) |
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

- **`streaming-scatter.js` — `StreamingScatter`** : le même semis pour un monde sans bord. Mêmes couches (donc
  mêmes draw calls), mais les cases arrivent et partent par morceaux (`beginChunk`, `endChunk`, `removeChunk`) ;
  le tampon de matrices d'une couche grandit au besoin.
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
- **`terrain.js`** : tranche de l'île (terre puis roche), normale du sol, et `buildGroundPatch` : le maillage du
  sol de prairie (comme l'asset) qui ne lit la hauteur qu'une fois par point, pour les morceaux d'un monde sans bord.

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

`new Explorer(container, { settings })` monte tout dans un bloc. L'écran reste dégagé :
- **en haut à gauche**, le compteur d'images par seconde, en direct (toucher : draw calls et triangles en plus) ;
  il reste affiché quand l'interface est masquée ;
- **en haut à droite**, une barre d'icônes : **Paysage**, **Plein écran**, **Masquer l'interface**, **Réglages** ;
- **en bas à gauche**, au doigt, la manette ronde. Au clavier : flèches ou ZQSD (WASD), Maj pour courir, A / E pour
  tourner la vue d'un cran.

**Réglages** ouvre un panneau à onglets (à droite ; en feuille au bas de l'écran sur un téléphone tenu droit) :
**Monde** (graine, taille, abondances, relief), **Ciel** (moment, météo), **Personnage**, **Actions** (balade
auto), **Caméra** (vue, vue de départ, aide des commandes). Les pages sont décrites dans le tableau `PAGES` de
`explorer.js`, en groupes titrés : une nouvelle catégorie (interactions avec le décor, scénario) est une entrée de
plus ; les futures actions du personnage (s'asseoir, cueillir, lancer un sort...) vont dans « Actions ».

**Paysage** (`setLandscape`) : plein écran puis verrou de l'écran à l'horizontale (API Screen Orientation). Là où
le verrou est refusé (navigateur intégré d'une application, iPhone, page dans un cadre), l'explorateur se tourne
d'un quart de tour en CSS tant que l'écran est en hauteur (haut de l'image à droite : on tourne le téléphone vers
la gauche). Les gestes sont alors ramenés dans le repère tourné (`_toLocal`, capture des `pointer*` sur la fenêtre)
avant d'atteindre les caméras et la manette.

Le personnage (`src/explorer/walker.js`, réglage `character`) se choisit dans l'onglet Personnage :
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

Caméra (réglage `camera`) : trois vues isométriques qui ne diffèrent que pendant la balade auto, **Fixe** (ne
tourne pas), **Pivote** (un cran toutes les 9 secondes), **Suit** (se replace derrière le promeneur quand il change
de cap), et la **3e personne** (`third`).

### Vue à la 3e personne (`camera: "third"`)

Une vraie caméra perspective (`ChaseCamera`, `src/engine/chase-camera.js`) placée derrière le promeneur et un peu
au-dessus de lui, qui regarde loin devant : on voit le décor en face de soi, sur l'île comme dans la prairie infinie.

- **Gestes** : glisser (souris ou un doigt) pour regarder autour, molette ou deux doigts pour reculer ou approcher
  (2,2 à 11 m, 5 m au départ), A / E pour tourner la vue. La marche reste relative à l'écran.
- **Retour dans le dos** : 1,6 s après le dernier geste, la caméra revient d'elle-même derrière le promeneur, mais
  seulement quand il avance vers le fond de l'image : de côté, il longe l'écran sans que la vue tourne ; vers la
  caméra, elle recule devant lui. En balade auto, elle le suit toujours.
- **Obstacles** : jamais sous le sol (elle remonte au-dessus d'une bosse) ; un tronc entre elle et le promeneur
  raccourcit le recul.
- **Champ** : 66° à l'horizontale, borné entre 46° et 74° à la verticale (un téléphone en hauteur voit moins large).
- **Rendu** : le même pipeline pixel art. `PixelRenderer` reconnaît la caméra perspective : il linéarise la
  profondeur (contours justes) et fait grandir le seuil de contour avec la distance. Pas d'alignement sur la grille
  de pixels ici : en perspective, chaque pas redessine le décor.
- **Monde courbé, sans brume** (prairie infinie) : le décor est courbé à l'affichage comme une petite planète
  (`setCurvature` de `engine/toon-material.js`, dans le vertex shader de tous les matériaux toon) : au-delà de 20 m
  de la caméra, il descend de (d − 20)² / 800 m (rayon 400 m). Le sol passe derrière l'horizon vers 53 m (caméra
  à 3 m de haut), ce qui est ras du sol vers 75 m, les rochers vers 100 m, les plus grands arbres (15 m) vers 160
  à 180 m ; la vue s'arrête à 185 m, sans qu'on la voie finir. Les ombres et les motifs restent calculés sur le monde plat (la passe d'ombre ne
  courbe rien, `DEPTH_ONLY`). Sur une île, la vue garde une brume de lointain (100 à 180 m) : la mer de nuages
  n'est pas courbée.
- **Arbres lointains** : au-delà de 50 m (`lod`), chaque arbre est dessiné en version allégée
  (`kit/far-tree.js`, `createFarVersion`) : mêmes matériaux, une feuille sur six environ (surtout celles du bord ;
  seules celles-ci sont agrandies, × 1,5 : un cœur sombre agrandi ferait une étoile noire), et le bois dont tous les sommets font au moins 20 % du rayon du tronc (le tronc
  entier et les maîtresses branches) : ≈ 800 à 1 050 triangles au lieu de ≈ 4 000.
  **Sans saut** : de 30 à 50 m, le modèle complet se fond dans sa version lointaine dans le shader (`uLod`) : les
  feuilles absentes de la version lointaine (`aFar` 0) rapetissent jusqu'à rien, les autres grandissent, et le
  bois absent s'efface par trame (matrice de Bayer 4 × 4, par pixel d'art) ; au passage, les deux sont identiques.
- **Couronnes vues de côté** (`setSideView` de `engine/toon-material.js`, mis par l'explorateur en 3e personne, île
  comme prairie infinie) : les feuilles sombres du cœur d'un arbre (`aLeaf.y` petit), faites pour remplir la
  couronne vue de haut, se verraient entre les feuilles du bord comme des étoiles noires (deux triangles sombres qui
  se croisent). Elles rapetissent d'autant plus qu'elles sont profondes (20 % au cœur), et les feuilles du bord
  grandissent un peu (× 1,15) pour garder une couronne pleine. Quitter l'explorateur remet le décor à plat et vu de
  haut (courbure et vue de côté à zéro).
- **Apparition en douceur** : sur le dernier quart de sa portée, une copie du semis rentre dans le sol (`uFade`,
  réglé par `StreamingScatter` selon `reach`) : l'herbe, les fleurs, la mousse et les rochers sortent du sol en
  approchant au lieu d'apparaître d'un coup. Une
  couche la déclare par `farVersion` dans `addLayer` (semis par morceaux) ; le semis d'île l'ignore.
- **Coût** : l'herbe et les fleurs ne sont dessinées qu'à 34 m (au-delà, une touffe ne fait qu'un pixel), la
  mousse et la terre remuée (famille `flat`, ras du sol) à 75 m, les rochers à 100 m, le sol à 100 m
  (`groundReach` : plus loin, il est sous l'horizon), les arbres jusqu'au bout de la vue. La carte d'ombre est centrée 14 m devant le promeneur, et seules les copies à moins de 58 m de la caméra
  projettent leur ombre (`shadowReach` : le semis range ses copies de la plus proche à la plus lointaine et réduit
  `count` le temps de la passe d'ombre, `limitShadowCopies` dans `kit/scatter.js`). Dans la prairie infinie, tous
  les morceaux dans un rayon de 110 m sont gardés prêts (`around`), quelle que soit la direction de la vue : la
  caméra peut se retourner d'un geste sans saccade. Au-delà, jusqu'à 185 m, seuls les morceaux dans le champ sont
  fabriqués, un peu par image ; la fenêtre de recherche passe de ±7 à ±12 morceaux.
- **Mesures, monde courbé** (navigateur de capture, prairie infinie, à l'arrêt, tout chargé) : téléphone
  412 × 915 : ≈ 80 draw calls, ≈ 190 000 triangles, ≈ 250 morceaux chargés ; écran large 1280 × 720 : ≈ 95 draw
  calls, ≈ 280 000 triangles, ≈ 290 morceaux. Première version (rayon 600 m, vue à 230 m, arbres allégés dès
  55 m) : ≈ 310 000 triangles au téléphone, mesurée à 35 i/s sur le téléphone de l'utilisateur. Avant (vue plate à 250 m avec brume) : téléphone ≈ 530 000 triangles,
  mesuré à 43 i/s sur le téléphone de l'utilisateur (≈ 1 000 000 triangles, 194 draw calls) ; vue à 150 m jugée
  fluide.

Les mondes reçoivent dans `update` des champs de plus, tous facultatifs : `lod` (distance des versions lointaines
par famille), `groundReach` (portée du sol), `reach` (portée du semis par famille),
`shadowReach` (portée de l'ombre du semis) et `shadowCenter` (centre de la carte d'ombre), plus `around` pour un
monde sans bord.

Avec un monde sans bord (`world.endless`), l'explorateur borne la vue (zoom arrière jusqu'à 0,6, inclinaison
jusqu'à 24° au lieu de 11°), affiche « infinie » dans le résumé, et la balade auto choisit ses buts devant le
promeneur.

`explorer.html` le montre seul, en plein écran, pour les captures (`size=endless` pour la prairie infinie) :
`?seed=1&size=small&moment=night&weather=rain&camera=follow&character=superhero-female&trees=2&az=45&el=35&zoom=1.5&x=0&z=0&stroll=1&clean=1`.
Avec `camera=third`, `az` est la direction de la vue, `el` son inclinaison et `zoom` le recul (m).

## Mesures (carte moyenne, vue de départ, moyenne par image)

65 à 80 draw calls, 150 000 à 210 000 triangles selon le nombre d'arbres en vue (4 000 à 5 000 triangles pièce,
comptés une fois et demie avec leur ombre). L'herbe en volume fait dépasser le budget de `docs/PERFORMANCE.md`
(150 000 triangles) dans les bosquets : une touffe coûte 36 à 64 triangles. Une touffe allégée (une dizaine de
triangles) réservée au semis de masse ramènerait le tout dans le budget. La mer de nuages, la brume, la teinte
de l'heure et la pluie ne coûtent que des pixels de l'image basse résolution : 1 draw call et aucune géométrie.

## La prairie infinie (`size: "endless"`)

Les mêmes assets et les mêmes règles que l'île, sans bord ni mer de nuages. Le monde est découpé en **morceaux de
16 m** (un morceau de sol). Tout ce qu'il contient est tiré de `(graine, morceau)` : revenir sur ses pas redonne
exactement le même pré, et deux promenades avec la même graine traversent le même paysage.

- **Arbres** : tirés par case de 4 m d'après `(graine, case)`. Sur l'île, un arbre trop proche d'un arbre déjà
  posé est écarté dans l'ordre de la carte ; sans bord il n'y a pas d'ordre, donc chaque candidat tire une
  priorité et cède la place à tout voisin plus prioritaire. La décision ne regarde que les morceaux voisins.
- **Rochers** gardés à 3 m du bord de leur morceau (ils ne gênent pas l'herbe du voisin) ; l'ombre des couronnes
  sur l'herbe tient compte des arbres des morceaux voisins. Affleurements, roches, colonies de taupinières : la
  même densité au mètre carré que l'île, en moyenne.
- **Fabrication** : à chaque image, on cherche dans une fenêtre de ±7 morceaux ceux que voit la caméra. Un morceau
  dans le champ (marge de 9 m pour les couronnes et les ombres portées) est fabriqué tout de suite, sinon il
  apparaîtrait au milieu de l'image ; ceux qui vont y entrer (marge de 20 m) sont préparés d'avance, le plus
  proche d'abord, un par image et un deuxième seulement s'il tient dans 4 ms. Les morceaux à plus de 36 m du
  champ sont libérés (matrices, maillage du sol), une image sur trente.
- **Vue** : zoom arrière limité à 0,6 et inclinaison à 24° au plus bas (11° sur l'île) : la caméra ne voit
  jamais plus loin que la fenêtre, et le nombre de morceaux reste petit. Les ombres de nuages dérivent dans un
  carré qui accompagne le promeneur.
- **Balade auto** : un but à 15–45 m, dans une direction proche de la précédente, pour que la promenade avance.
- **Objet monde** : le même contrat que l'île, avec `endless: true`, `meters: Infinity`, des `bounds` infinies
  (la vie d'ambiance et le promeneur ne sont plus bornés), `collide` qui ne regarde que les obstacles des morceaux
  voisins, et `stats()` qui donne aussi `chunks` (morceaux chargés) et `chunkTime` (ms par morceau).

Pour donner une taille infinie à un autre monde : voir le skill `create-world`, « Taille infinie ».

Mesures (navigateur de capture, téléphone 412 × 915, vue de départ, en marchant) : 65 à 73 draw calls, 160 000
à 190 000 triangles, comme l'île moyenne ; 60 à 70 morceaux chargés (≈ 5 Mo) ; 1 à 2 ms pour fabriquer un
morceau (le sol pèse le plus : `buildGroundPatch` le ramène de 3 à 0,7 ms). La part d'herbe dessinée reste fixe
pendant la marche. Coordonnées testées jusqu'à 5 km de l'origine sans défaut.
