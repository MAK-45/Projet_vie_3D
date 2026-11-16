# Recettes : ce qui marche, ce qui rate

Carnet de bord du rendu. Les sections « éprouvé » décrivent ce qui a été fait et regardé à l'écran ; les sections
« pistes » sont des points de départ pas encore essayés. **Après chaque asset, ajouter ici ce qui a servi** :
c'est ce fichier qui fait progresser les assets suivants.

## Sommaire

1. Échelle et lisibilité
2. Couleurs et lumière
3. Contours
4. Végétal : tronc, branches, feuillage (éprouvé sur le bouleau, le chêne, le tilleul)
5. Vent (éprouvé)
5 bis. Herbes, pelouses, fleurs (éprouvé)
6. Roches (éprouvé sur le rocher posé et la roche enterrée) ; pistes : bâti, véhicules
6 bis. Ciel : soleil, lune, étoiles, nuages (éprouvé)
7. Étendre le kit ou le matériau
8. Poids

## 1. Échelle et lisibilité

- 16 pixels d'art par mètre au zoom 1. Un détail de moins de 0,07 m (un pixel) scintille ou disparaît : rayon
  minimal d'une tige 0,034 m, d'une feuille 0,075 m de demi-taille.
- La vignette du catalogue fait 144 × 168 pixels pour tout l'asset et son socle. Ce qui ne se lit pas là ne
  sert à rien.
- Exagérer les traits signature (le pied sombre du bouleau, ses brins pendants) plutôt que viser le réalisme.
- `footprint` = rayon et hauteur réels aux réglages par défaut ; `npm run check` donne les valeurs mesurées.

## 2. Couleurs et lumière

- Une rampe = 4 couleurs (5 pour un feuillage), de l'ombre vers la lumière, avec glissement de teinte : ombres
  vers le bleu-violet ou le bleu-vert, lumières vers le jaune. Jamais la même teinte simplement assombrie.
  Écorce du bouleau : `#77728f → #b0aec2 → #e0dfe6 → #fbf8ee`. Feuillage d'été :
  `#1d4945 → #2a6947 → #3f8d45 → #6db348 → #b3da5b`.
- `steps` place les seuils entre deux couleurs (lumière de 0 à 1 ; 0,5 = surface de profil par rapport au
  soleil). Trop de surface dans la couleur la plus sombre donne une bouillie : baisser le premier seuil
  (feuillage du bouleau : `[0.22, 0.42, 0.6, 0.78]`).
- Les couleurs sont écrites telles quelles à l'écran : ce qu'on met dans la rampe est ce qu'on voit.
- Dans la visionneuse, le soleil vient de la gauche de l'écran, à 52° de hauteur, et suit la caméra.
- `pattern: "speckle"` casse un aplat avec quelques pixels d'un cran plus clair ou plus sombre (herbe, terre,
  pierre) ; `pattern: "bark"` trace des tirets horizontaux et un pied sombre sur un tube.

## 3. Contours

- Un contour sombre d'un pixel est tracé sur le pixel le plus proche de la caméra là où la profondeur saute,
  et entre deux **identifiants** (`id`) différents. Donner un `id` distinct (10, 11, 12...) à chaque partie qui
  doit être cernée : tronc et feuillage, mur et toit, carrosserie et roues. Le socle utilise 2 et 3.
- Le contour est une version assombrie de la couleur de l'objet, pas du noir : une partie très claire garde un
  contour visible, une partie très sombre le perd.
- `crease: true` ajoute un liseré clair sur les arêtes vives tournées vers la lumière : pour les volumes à
  facettes (blocs, meubles, toits), pas pour l'organique.
- `selfEdge` (défaut 1,1 pour le feuillage) empêche de cerner chaque feuille : sans lui, le feuillage devient
  noir. Même réglage pour toute partie faite de nombreux petits éléments du même matériau (tuiles, galets,
  herbes).
- De très petits éléments posés sur une autre partie (feuilles tombées sur l'herbe) sont entièrement mangés
  par leur contour et paraissent sombres : leur donner une couleur plus claire que voulu, ou le même `id` que
  leur support.

## 4. Végétal (éprouvé sur le bouleau)

- **Tronc et branches** : `buildTube(points, rayon(t))`, 7 côtés pour le tronc, 5 pour les branches, 4 pour les
  rameaux ; tout fusionné en un maillage. Le tronc suit 6 points avec une inclinaison et un léger zigzag tirés
  de la graine. Les branches partent en spirale (angle d'or 2,4 rad + hasard), longues en bas, courtes en haut.
- **Feuillage** : `buildLeafGeometry(feuilles)`, un triangle par feuille, toujours face à la caméra, avec le
  matériau `foliage: true`. Les feuilles sont réparties sur la coque de **touffes** (sphères aplaties posées le
  long des branches) ; environ `105 × rayon²` feuilles par touffe.
- **Normale d'éclairage d'une feuille** = direction depuis le centre de sa touffe (+ un peu de la direction
  depuis le centre de l'arbre, + un peu vers le haut). C'est ce qui donne des masses éclairées d'un côté et
  sombres de l'autre, au lieu de confettis.
- **Cœur sombre** : deux grands triangles au centre de chaque touffe, normale vers le bas, pour boucher les
  trous. Taille 0,44 × rayon : plus gros, ils dépassent en triangles noirs.
- **Brins pendants** : chapelets de feuilles sous les touffes extérieures, avec une souplesse au vent croissante
  vers le bas.
- **Ombres** : `mesh.customDepthMaterial = material.userData.depthMaterial` sur le feuillage, sinon son ombre
  est fausse.
- Pour un autre arbre, changer ce qui fait son identité : port (rond pour un chêne, en cône pour un sapin, en
  parasol pour un pin), densité, taille et forme des touffes, couleur et motif de l'écorce.

- **Chêne** (`nature/trees/oak`) : fût court et épais (rayon 0,46–0,54 m, pied évasé), 3 à 5 charpentières qui
  partent du haut du fût (élévation 0,35–0,8 rad) + une branche basse presque horizontale une graine sur deux +
  une flèche pour le dôme. Fonction `limb` à coudes tirés au hasard : c'est elle qui donne le côté tortueux.
  Premier jet avec des feuilles de bouleau (0,085–0,14) et 100 × r² feuilles : couronne en confettis, lue comme un
  olivier. Ce qui a marché : **touffes plus grosses (1,15–1,6 m), feuilles plus grandes (0,12–0,19) mais moins
  nombreuses (64 × r²), feuilles poussées vers la coque (`shell: 0.55`), cœur 0,5** : masses nettes et moins de
  triangles. Hiver (marcescence) : feuilles mortes seulement sur 40 % des touffes, réduites : des paquets, pas
  de la poussière.
- **Tilleul** (`nature/trees/linden`) : flèche droite jusqu'à 82 % de la couronne, branches en spirale dont la
  pointe est calée sur une **enveloppe en ogive** (rayon max 3,1–3,8 m au tiers bas) + touffes de remplissage
  posées juste sous l'enveloppe : silhouette régulière. Enveloppe à 2,5–3,2 m : colonne, pas un tilleul.
  Fleurs : 3e matériau (`foliage`), grappes de 2–3 feuilles de 0,10–0,13 m accrochées aux points de surface
  rendus par `fillClump`, seulement sur le dessus ; à 0,075–0,095 m, le contour les mangeait. Rejets au pied :
  petites touffes de 0,35 m sur tiges collées au tronc.
- Outils partagés : `kit/foliage.js` (`fillClump`, `fallenLeaves`, `leafNormal`) ; motif `furrow` (écorce
  crevassée, fissures verticales qui serpentent) dans le matériau : `[16, 3, 0.1, 0.2]` chêne, `[16, 4, 0.05, 0.4]`
  tilleul. Éclat des plaques > 0,08 sur une écorce grise : taches blanches façon bouleau.

## 5. Vent (éprouvé)

- `sway: { amplitude, height }` sur tous les matériaux d'un même objet, avec les mêmes valeurs, pour que tronc,
  branches et feuilles bougent ensemble. Bouleau : amplitude `0.09 × échelle`. À 0,17 l'arbre tanguait.
- Le temps avance par crans de 1/12 s : mouvement saccadé façon sprite. `animated: ["wind"]` dans la fiche.
- Ce qui est rigide (pierre, mur, véhicule à l'arrêt) n'a pas de `sway`.

## 5 bis. Herbes, pelouses, fleurs (éprouvé sur `grass-tuft`, `lawn`, `flower-clump`)

- **Brins face caméra** : `buildBladeGeometry` (kit) pose un ruban le long d'une courbe base → coude → pointe,
  avec la largeur portée dans le plan de l'écran (matériau `foliage: true`). Un brin modélisé « à plat » disparaît
  de profil ; celui-ci garde ses pixels sous tous les angles. Le pied est sombre (occlusion 0), la pointe claire
  (occlusion 1) : ce dégradé suffit à faire lire une touffe de 8 pixels de haut.
- **Largeur** : 0,085 à 0,12 m pour une touffe isolée. À 0,07 m et 26 brins serrés, la touffe n'est qu'une
  bouillie verte ; moins de brins (≈ 20), plus larges et plus ouverts (`spread` 0,5 à 1) se lisent mieux.
- **Hautes herbes** : feuilles longues et arquées (60 % retombent) + quelques tiges droites à épi (`buildFanGeometry`
  étiré [0,45 ; 1]). Des feuilles courtes et raides font un bouquet de baguettes.
- **Pelouse** : brins semés sur une grille jitterée (écart 0,085 m tondue, 0,11 m haute), même `id` de contour que
  la motte, sinon chaque brin est cerné et tout devient sombre. Un bruit lent (« vigueur ») fait les zones drues,
  rases et les trouées. Dalle carrée : `buildGroundTile` (bords pile sur ±size/2, jupe sous le sol) et pointes des
  brins bornées au carré, pour raccorder deux dalles. ~1 triangle par brin tondu, 3 par brin haut.
- **Fleurs** : corolle = `buildFanGeometry` avec des contours **ronds ou peu découpés** (marguerite
  `starOutline(12, 0.8)`, coquelicot et bouton d'or `(5, 0.86)`, bleuet `(8, 0.62)`), rayon 0,085 à 0,12 m. Une
  étoile très découpée (8 pointes, creux 0,6) sur 3 à 4 pixels de rayon donne un bord en dents de scie : en pixel
  art, plus de triangles ne rend pas plus net, des formes simples et un peu plus grosses, si.
- **Cœur** : second éventail au même point, dans un 3e matériau, avec `lift: 0.03` (avancée vers la caméra, 3e
  composante de `aCorner`) et le **même `id`** que les pétales. Ne pas utiliser `polygonOffset` : le décalage de
  profondeur fait passer les cœurs à travers les fleurs voisines et ils clignotent quand le vent les croise.
- **Tête accrochée à sa tige** : même `phase` et même `flex` pour la tige et sa tête (0,3), sinon chaque tête
  frémit à côté de sa tige et le massif « grésille » au vent.
- Écarter les têtes : `spread` 0,35 à 0,6 × hauteur. Têtes serrées = une seule tache rouge. Les tiges ne vont pas
  jusqu'au jaune de la rampe d'herbe (seuils `[0.3, 0.5, 0.7, 0.9]`), sinon elles font une colonne pâle.
- Saisons : boutons (petits éventails sombres, occlusion 0,35) au printemps, têtes fanées (cœurs seuls, rampe `dry`)
  en automne, tiges sèches en hiver. Rampes partagées : `GRASSES` et `FLOWERS` dans `palettes.js`.
- Poids : un massif de fleurs 160 à 320 triangles, la lavande ~730 (épis à 5 grains pentagonaux).

## 6. Roches (éprouvé) et pistes

**Roches** (`nature/rocks/boulder`, `nature/rocks/buried-rock`) :

- Outil `buildRock(rng, options)` de `kit/geometry.js` : icosaèdre bosselé (bosses gaussiennes sur la sphère)
  puis **taillé par des plans** tirés de la graine, étiré, tourné, posé, `floorY` pour aplatir le dessous.
  Les plans de taille font tout : sans eux, on obtient des œufs.
- **Détail 1** (80 faces) pour un rocher : au détail 2, les facettes deviennent trop petites et le rocher paraît
  lisse et rond. Détail 0 pour un caillou.
- Taille : `cutDepth` autour de [0,6 ; 0,9] et 4 à 9 plans. Varier fortement les proportions par graine
  (largeur 0,95 à 1,9 × la demi-hauteur) sinon toutes les graines se ressemblent.
- Matériau : `crease: true`, `steps: [0.36, 0.58, 0.8]` (avec les seuils par défaut, la face éclairée prend
  presque tout), `speckle` discret `[16, 0.05, 0.2, 1]` : à 0,08 c'est des confettis.
- Cailloux au pied : rayon ≥ 0,12 m, sinon le contour les mange et ils paraissent noirs.
- **Enterré** : décaler le bloc vers le bas (`offset` y) avec `floorY` juste sous le sol, l'incliner fortement,
  et l'entourer d'un **talus de terre continu** (un `buildRock` très aplati, détail 2, bords bosselés). Des
  mottes séparées tout autour ressemblent à des pattes ; un disque régulier à une flaque.
- Mousse, neige : **ne pas** découper par faces (`splitFacesByNormal`) : les plaques suivent les facettes et
  font des triangles. Utiliser `snowCap` / `mossCap` de `kit/ground-cover.js` (outil `buildDrape`) : les faces
  sont subdivisées (3 × 3) puis découpées le long d'un champ continu (normale **lissée** + bruit 3D
  `createNoise3`), et la couche est décollée le long des normales lissées (pas de fissure aux arêtes).
  Mousse : le bruit doit dominer (`(n.y − 0,55) × 1,4 + bruit × 2,4`), sinon tout le dessus est vert. Neige :
  l'orientation domine, épaisseur croissante vers le cœur des plaques. `minY` empêche la couche de descendre
  au pied.
- Ajouter au sol, avec le même matériau, une plaque de neige ou des tapis de mousse autour du pied : l'objet
  s'ancre dans son décor sans draw call de plus.

**Neige, mousse, terre au sol** (`nature/terrain/snow-patch`, `moss-patch`, `dirt-mound`) :

- Un seul générateur par matière dans `kit/ground-cover.js` (`snowMound`, `mossMound`, `dirtMound`,
  `coverMaterial`), partagé par les assets de sol et par tout asset qui en porte : même forme, mêmes couleurs.
- Outil `buildMound` : disque polaire au contour lobé (3 harmoniques), bord juste sous le sol.
- Neige : normales lissées, profil `power` 0,9 et relief par bruit (× 1,1 de la hauteur) avec 1 à 3 congères
  accolées ; trop plate, elle n'est qu'un aplat blanc. Seuils `[0.42, 0.62, 0.8]` pour que les ombres bleues
  apparaissent sur une forme presque horizontale.
- Mousse : nappe très mince + coussinets bombés (rayon 18 à 34 % du tapis, hauteur 0,7 à 1 × leur rayon) ; plus
  petits, ils disparaissent en vue iso.
- Terre : facettes franches (`flat: true`) et mottes (`buildRock` détail 0, rayon ≥ 0,08 m).

**Grands sols raccordables** (`nature/terrain/meadow-ground`, éprouvé) :

- **Tout en coordonnées du monde** : la hauteur est une fonction `height(X, Z)` du monde (pas du morceau), les
  normales viennent de sa pente (différences centrées), pas de `computeVertexNormals` : deux morceaux voisins
  ont alors les mêmes sommets et les mêmes normales sur leur bord, la passe de contours ne voit aucune couture.
  Outil : `buildTerrainChunk` (kit), paramètres `tileX`, `tileZ`, morceau posé à `(tileX × size, 0, tileZ × size)`.
- **Les taches dans le shader** (motif `ground` du matériau, attribut `aGround` = X, Z du monde) : bords nets au
  pixel près quelle que soit la grille (sommets tous les 0,5 m), et rien à raccorder. Couches dans l'ordre :
  herbe grasse, fleurs, herbe sèche, terre (neige l'hiver). Une modulation lente (≈ 33 m) fait des régions plus
  sèches ou plus grasses : c'est elle qui donne la variété d'un morceau à l'autre.
- La **graine doit entrer dans le bruit de chaque couche** : sans elle, toutes les graines avaient les mêmes taches.
- **Frange tramée** au bord des taches : 0,05. À 0,14 les bords deviennent de la poussière de pixels.
- Lumière : sol plat ≈ 0,89 avec le soleil de la visionneuse ; seuils `[0.62, 0.8, 0.935]`. Plus bas, chaque
  sommet de colline fait un ovale clair. `shadowLit: 0.7` : l'ombre d'un arbre reste verte.
- Rendu **lisse** : mêmes taches en `smoothstep` + marbrure douce de la lumière ; sans marbrure, un aplat mort.
- Poids : ~1 350 triangles pour 12 m (grille 0,5 m + jupe), 2 draw calls ; un monde de 6 × 6 morceaux = 72 m de
  côté pour ~50 k triangles. `meta.pedestal: false` : la visionneuse ne pose pas de socle sous un sol.

**Pistes (pas encore essayées)** — à confirmer à l'écran :
- **Bâti et mobilier** : assembler des blocs (boîtes) aux arêtes vives, `crease: true`. Les fenêtres, portes et
  poutres sont des volumes à part avec leur propre `id` de contour, pas des textures. Tailles en multiples de
  1/16 m pour tomber sur la grille de pixels. L'appareil de pierre ou les planches demandent un motif de
  matériau à créer (section 7).
- **Véhicules et vaisseaux** : une coque faite de quelques volumes simples (profil extrudé ou tourné), les roues
  ou réacteurs en parties séparées, 2 ou 3 couleurs de peinture au plus. La graine joue sur les proportions et
  les accessoires, `model` sur la forme générale.
- **Lumières** (lanterne, fenêtre éclairée) : une couleur unie très claire dans une rampe à 2 couleurs
  identiques ne réagit pas à l'ombre ; le halo viendra d'un effet à part, pas de l'asset.

## 6 bis. Ciel (éprouvé sur `sun`, `moon`, `star`, `cloud` de `nature/sky/`)

- **Astres lumineux** (soleil, lune, étoiles) : matériau `foliage: true, unlit: true, leafShade: [0, 1]`. Avec
  `unlit`, la lumière ne compte plus : l'**occlusion** de chaque forme choisit directement sa couleur dans la rampe
  (seuils `[0.2, 0.4, 0.6, 0.8]`, occlusion 0,1 / 0,3 / 0,5 / 0,7 / 0,9 pour les cinq tons). Pas d'ombre portée ni
  reçue, pas de vent.
- **Couches face caméra** empilées avec `lift` (1 cm d'écart) et le **même `id`** : halo → disque → cœur → reflet
  pour le soleil ; bord → corps → cœur pour une étoile. `selfEdge` du feuillage (1,1) évite de cerner chaque couche.
- Une forme qui n'est pas convexe autour de son centre (croissant de lune, rayon carré) ne passe pas en éventail :
  `buildSpriteGeometry` (points + triangles libres). Le croissant est une bande ligne par ligne entre la limite
  jour/nuit `x = k·√(1−y²)` et le bord. Un détail posé à côté du centre (reflet, cratère) : éventail avec `offset`,
  jamais un contour décalé (le centre de l'éventail sort de la forme et on obtient une goutte).
- **Lune** : ne pas dessiner la face cachée. Un disque bleu nuit écrase le croissant sur un ciel de jour. Une bande
  de pénombre grise le long de la limite jour/nuit suffit à donner le volume.
- **Pulsation** : `twinkle` sur le matériau, pondéré par le `flex` de chaque sommet (rayons du soleil 0,06,
  étoiles 0,1 à 0,35). Un astre ne bouge pas au vent.
- **Étoile à 4 branches** : creux ≥ 0,27 et étirement horizontal 0,7 à 0,95 ; plus fine, chaque branche fait un
  pixel et l'étoile disparaît. Petites étoiles : losange d'au moins 0,09 m de rayon.
- **Nuage** : volume éclairé normal (pas `unlit`), boules `SphereGeometry(12, 8)` lisses au dessous écrasé sur un
  plan (normales vers le bas), rangée principale en cloche + seconde rangée décalée en profondeur + « tours ».
  `selfEdge: 0.35` : sans lui, chaque boule est cernée et l'orage se couvre de traits noirs. `shadowLit: 0.5`
  pour que l'ombre propre reste blanche-bleutée. Il projette son ombre : c'est ce qui l'ancre dans un monde.
- **Échelle** : taille de présentation (soleil 3 m, lune 2,4 m, nuage 5 m, étoile 1,4 m), origine au sol et objet
  flottant 0,7 à 1,2 m au-dessus, pour que le socle de la galerie ne le touche pas. Un monde agrandit et éloigne.

## 7. Étendre le kit ou le matériau

- **Nouvel outil de géométrie** (bloc, prisme de toit, forme tournée, extrusion) : dans
  `src/assets/kit/geometry.js`, documenté, sans rien de propre à un asset. Il doit produire `position`,
  `normal` et un index (ou être compatible avec `mergeGeometries`, qui exige les mêmes attributs partout).
- **Nouveau motif** (`bricks`, `planks`, `tiles`...) : dans `src/engine/toon-material.js`, ajouter une entrée
  à `PATTERNS` et un bloc `#ifdef PATTERN_XXX` dans le fragment shader, sur le modèle de `PATTERN_BARK`. Un
  motif modifie `lit` (un cran plus clair ou plus sombre) ou `ink` (trait sombre), jamais la couleur
  directement. Travailler en cellules d'un pixel (`floor(position × 16)`) pour rester net.
- Après une modification du moteur ou du kit : `npm run check` et `npm run sheet` sur **tous** les assets
  existants, pour vérifier qu'aucun n'a changé d'aspect.

## 8. Poids

- Viser moins de 5 000 triangles et 3 draw calls par asset ; le bouleau en fait environ 4 700 et 2.
- Un asset posé en grand nombre (herbe, fleur, galet) doit rester sous quelques centaines de triangles.
- Pas de texture : motifs procéduraux uniquement. Pas de géométrie cachée (fond d'un bloc posé au sol,
  intérieur d'un volume fermé).
