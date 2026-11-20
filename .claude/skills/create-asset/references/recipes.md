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
6 ter. Créatures animées (éprouvé sur le blob Couveuse)
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

## 6 ter. Créatures animées (éprouvé sur `creatures/spirits/couveuse-blob`)

- **Porter un sprite 2D** : reprendre ses réglages et ses fonctions (forme, pose, clignements) en remplaçant le
  bruit 2D lu sur un cercle de temps par `createNoise3` lu sur la direction (x, y, z) + un décalage qui tourne
  sur un cercle : la boucle ne saute pas. Les tailles en pixels du sprite se convertissent en **part du rayon réel**
  (le blob 2D avait un rayon moyen de 0,81 × son réglage `size` : yeux 0,23, écart 0,52, hauteur 0,22).
- **Animation par objet sans boucle de jeu** : surcharger `group.updateMatrixWorld` (appelé par le moteur avant
  la carte d'ombres et le rendu), ne recalculer que si `sharedUniforms.uTime` a changé, et lire la caméra dans
  `onBeforeRender` pour l'image suivante. Le module garde le contrat (`tick` du moteur suffit).
- **Corps mou** : `SphereGeometry` soudée par `mergeVertices` (sans uv ni normales, sinon couture au méridien),
  sommets recalculés à chaque cran puis `computeVertexNormals` ; ~1 200 triangles. Des « courants » de lumière :
  perturber les normales par un bruit qui tourne (± 0,16 de lumière).
- **Matière qui brille** : `outline: false` + `rim: [0.3, 0.5]` (nouvelle option du matériau : liseré clair sur
  la silhouette, côté ombre compris) remplace le contour sombre ; seuils hauts `[0.2, 0.45, 0.75, 0.96, 1.1]` pour
  que le corps reste dans les tons moyens et que le blanc soit réservé au bord éclairé et au reflet. Avec des
  seuils bas, tout le dessus devient blanc et le reflet disparaît.
- **Yeux et reflet** : formes face caméra `unlit` (ton choisi par occlusion), posées sur la surface (rayon
  + 1 à 2 cm, sinon enterrées). Raccourcies vues de côté (× facing), cachées sous facing 0,3 : plus tôt, elles
  débordent de la silhouette. Clignement : écraser `aCorner.y`, jamais sous une demi-hauteur de 3,5 cm.
- **Particules** (étincelles, gouttes, poussières) : losanges face caméra sans contour dans un 3e matériau ; une
  particule morte a ses coins à 0. Paramètres de chaque particule tirés une fois à la création.
- **Orientation** : la créature regarde vers +Z ; réglage `turn` à 45° par défaut pour faire face à la caméra de
  l'Atelier.
- **Faire de la lumière dans le noir** : `createGlowLight()` du moteur (4 places partagées) ; l'asset la place à
  chaque `updateMatrixWorld` (`light.set(position, couleur, portée, éclat)`) et la rend au `dispose` de son
  matériau (`material.addEventListener("dispose", ...)`). Couleur = ton dominant du corps (C[5] de la palette).
  Les matières de la source elle-même prennent `glow: false`. Elle ne compte qu'à proportion de `setDarkness`
  (explorateur : heure du monde ; galerie : option « Nuit »). Réglage éprouvé : décroissance linéaire, portée 3 m,
  éclat 1,4 → cœur vif ≈ 0,6 m sous la source, anneau moyen ≈ 1,6 m, frange tramée ≈ 2,4 m. Avec une décroissance
  en puissance 1,4, pas de cœur ; en 0,6, tout le socle au même palier.
- Piège : `new THREE.Vector4()` vaut (0, 0, 0, 1) ; une place libre doit valoir 0 partout, sinon elle compte comme
  une lumière noire d'1 m à l'origine (le cœur de la flaque devenait terne).

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

## 9. Modèles importés (personnages, animations)

- Un modèle fourni par l'utilisateur ne se redessine pas : il passe par `scripts/prepare-models.mjs`, puis un
  asset léger le décrit (`kit/animation-asset.js`). Voir `docs/ASSETS.md`, « Assets importés ».
- Piège : `prune()` de gltf-transform supprime les UV d'un maillage dont le matériau n'a plus de texture. Garder
  `prune({ keepAttributes: true })` quand la texture est rechargée à part.
- Textures : 256 px et 64 couleurs suffisent (le personnage fait ~29 pixels de haut au zoom 1) ; éclaircir un peu
  (`modulate`) car la rampe-filtre de lumière ne fait qu'assombrir.
- Un personnage se lit à sa silhouette et à ses deux ou trois masses de couleur (peau, tenue) : les yeux et
  sourcils se simplifient fort (~250 triangles chacun).
- Vue iso de face : une pose assise ressemble à un buste penché ; juger un mouvement en vue de côté.
- Retargeting : ne copier que les rotations ; les translations des os du mannequin déformeraient un autre corps.
- **Variante de matière d'un personnage importé** (éprouvé sur `creatures/humanoid/magic-mannequin`, la version
  humaine du blob) : pas de nouveau fichier de modèle, une entrée de `CHARACTERS` qui réutilise `mannequin.glb` avec
  `magic: true` ; ses matières viennent de la palette choisie (`MAGIC_PALETTES` de `kit/palettes.js`). Il apparaît
  tout seul dans le choix de personnage des 26 animations.
- Matière de lumière sur un corps skinné : on ne peut pas retoucher ses normales sur le CPU comme le blob ; les
  courants sont faits dans le shader (`currents: [force, fréquence]` de `createToonMaterial`, bruit 3D sur la
  position objet). Liseré `rim`, `outline: false`, `shadowLit` 0,55 : il se lit sans contour sombre.
- Ondulation d'un corps skinné, comme le blob mais qui reste humain : `wobble: [amplitude, fréquence, vitesse]` de
  `createToonMaterial` déplace chaque sommet le long de sa normale *après* le squelette (toutes les animations
  restent justes), avec un bruit lu sur la pose de repos (les vagues restent attachées à leur partie du corps).
  Raté : un bruit centré pince les parties fines (chevilles, poignets) jusqu'à casser la jambe dès 5 cm ; le
  biaiser vers l'extérieur (`wave * 0,6 + 0,4`) : les parties gonflent et dégonflent sans se creuser. 4,5 cm se
  voit au zoom de la galerie ; 8 cm fait gelée sans ouvrir de couture. La passe d'ombre reçoit le même déplacement
  (`customDepthMaterial`).
- Raté : les yeux du blob posés sur le visage du mannequin (formes face caméra accrochées à l'os de la tête) —
  jugés moches par l'utilisateur, retirés. Le mannequin magique reste sans visage.
- Étincelles, poussières : un seul maillage de formes face caméra posé dans le groupe, repositionné à chaque
  `updateMatrixWorld` depuis l'os `spine_03`. Une particule éteinte se réduit à un point au cœur du torse (pas sous
  le sol : `check` le signale).

## 9. Objets animés à mécanisme : la porte des étoiles et sa console (éprouvé, v2)

- **Design original** inspiré d'une mécanique (anneau qui tourne, verrous, vortex) : symboles inventés tirés de la
  graine, verrous = cristal couché dans un sabot de pierre à deux mâchoires, console en autel à hémicycle. On suit
  les demandes de mesures et de mise en scène de l'utilisateur, pas le décor d'un film ou d'une série.
- **Mesures réelles demandées** : 6,70 m de diamètre extérieur, 4,76 m d'ouverture. **Mise en scène** : l'anneau
  est enfoncé d'un quart dans la plateforme ; le dessus de la plateforme (la passerelle) passe au ras du bas de
  l'ouverture, pour la traverser de plain-pied. La porte a un avant (côté vortex) et un arrière : l'accès (escalier
  ou rampe) n'est QUE devant, le dos de la plateforme est un mur plein juste derrière l'anneau ; un objet qui entre
  disparaît (passé dans l'autre monde) et ressort par l'avant. Jets refusés : anneau posé sur l'escalier, verrous
  dépassant à l'extérieur de l'anneau, escaliers des deux côtés.
- Verrous **sur les faces de l'anneau**, pointés vers le centre, au-dessus de l'anneau intérieur, répartis sur
  260° (le bas est sous la passerelle). Ils glissent vers le centre en verrouillant et restent allumés.
- **Séquence partagée** dans `kit/portal.js` (`portalSequence`, `portalStateAt`) : deux assets qui lisent la même
  horloge (`sharedUniforms.uTime`) et la même graine restent synchronisés sans se connaître.
- **Animation** comme le blob : `group.updateMatrixWorld` surchargé, mise à jour seulement quand le temps partagé
  change de cran (12 images/s). La partie rigide qui tourne est un maillage à part (`rotation.z`) ; ce qui s'allume
  ou glisse est dans un seul maillage d'énergie mis à jour sur le CPU.
- **Énergie** : matériau `unlit` + `shade` (attribut `aShade`, 0..1 par sommet, découpé en paliers nets) +
  `emissive` (seuil au-dessus duquel la couleur échappe à la teinte de nuit : sans lui, le vortex est sombre la
  nuit). Les cristaux éteints restent sous le seuil (0,26–0,40), les allumés au-dessus.
- Vortex : disque de 13 anneaux × 44 ; filaments = crêtes d'un bruit lent `(1 − |2n − 1|)^5`, éclats = pics d'un
  bruit fin au-dessus de 0,7. Jaillissement : bosse `(1 − r²)^0,7` vers +Z, montée rapide puis retour lent.
- **Onde de traversée** : on suit chaque objet de la scène (hors os, maillages instanciés, lumières) dans le repère
  du vortex ; changement de signe de z dans l'ouverture = onde. Une onde lisible = éclair blanc au point de
  passage, puis **crête blanche + creux sombre juste derrière + 2e crête** qui s'élargissent ; une simple bosse
  claire se perd dans les reflets. Deux passages au même endroit à moins de 0,25 s = une seule onde.
- Console : tablettes de métal en hémicycle (3 arcs) incrustées de cristal ; une grille droite faisait clavier
  moderne. Une dalle inclinée posée sur un bloc plat le transperce (« mal intégré », refusé) : la tête du pupitre
  est un bloc en demi-lune **taillé en pente** (`buildPrism` : contour au sol, dessus = plan incliné), posé à plat
  sur le corps ; tablettes, cerclage et petit anneau sont posés sur ce plan.
- Outils ajoutés au kit : `buildLathe`, `buildBlock`, `buildGem`, `buildPrism` ; matière `METALS` (bronze, or, fer).

## 10. Le Complexe : architecture modulaire (éprouvé sur le lot 1 : dalle, mur, colonne, voûte, portes)

- **Kit commun** `src/assets/kit/complex-parts.js` : `buildMasonry` (appareil de blocs, joints d'un pixel = le cœur
  du mur en retrait de 0,09 m qui se voit entre des blocs écartés d'un pixel, assise du bandeau creusée, ouvertures
  calées sur les assises), `glyphStrip` (lettres de traits droits), `fluteShaft` (fût cannelé à pans plats),
  `bendAroundY` (cintrer un mur pour une salle ronde : pièces de 0,5 m au plus), `withTone` / `mergeToned`,
  `stoneMaterial` / `metalMaterial` / `glowMaterial` / `glowMixMaterial` (plusieurs couleurs de lueur dans un seul
  draw call, attribut `aShade`).
- **Tons par sommet** (option `tone` du matériau) : un décalage de ±0,05 ne se voit pas ; ±0,08 par bloc commence à
  se lire, −0,3 fait un joint, −0,6 à −0,9 fait un creux ou une gravure. Une surface déjà au ton le plus clair ne
  peut pas s'éclaircir : pour montrer l'usure d'un dessus de dalle, poser tout le dessus un cran plus bas (−0,17)
  et remonter le centre. Le dessus doit être quadrillé (12 × 12) pour qu'une tache ou une usure ait une forme.
- **Lueurs d'un pixel** : `outline: false` (le contour mangerait le glyphe), `emissive` pour garder l'éclat la nuit.
  Bandeau de glyphes à 1,10 m (assise de 1,00 à 1,25 m) partout : les modules (mur, porte) se raccordent.
- **Vantaux animés sans draw call de plus** : deux battants dans un seul maillage, chaque sommet sait son battant,
  rotation autour du pivot recalculée sur le CPU quand le temps partagé change de cran (comme la porte des étoiles) ;
  `computeBoundingSphere` après. API de pilotage dans `group.userData.door`.
- **Plafond** : un module vu d'en bas ne se juge pas dans l'Atelier ; réglage `display` « retournée » pour le
  regarder, « au plafond » pour le monde.
- **Scène d'essai** : `dev/complex-corner.html` assemble un coin de Sas avec le mannequin de 1,80 m (échelle). Piège :
  un objet pile dans l'axe de la caméra derrière une colonne disparaît ; le décaler.
- **Doublons de tags** : un mot identique en français et en anglais (« niche », « architecture ») fait échouer
  `check` ; prendre un synonyme anglais.

### Le Complexe, lot 2 : lumière et réseaux (lampe, lustre, tuyau, valve, câbles)

- **Ampoules qui scintillent** : `createFlicker` (kit) sur un maillage `glowMixMaterial(glowLevels(couleur))` à 4
  niveaux ; une plage de sommets par ampoule, niveau de base tiré de la graine (quelques faibles ou mortes dans un
  lustre), paliers lents (≈ 4/s) ; mis à jour dans `updateMatrixWorld` quand le temps partagé change.
- **Halo** (option `halo`, désactivée par défaut) : `createGlowLight` placé au centre de l'ampoule ; dans le noir, deux
  lampes suffisent à donner l'ambiance du Complexe (flaques d'ambre tramées sur la pierre). 4 places pour toute la
  scène : c'est le monde qui choisira lesquelles allumer.
- **Suspendu, origine au sol** : `height` = hauteur de l'ampoule (ou du cercle), la chaîne monte jusqu'à une rosace.
  Le monde règle `height` et `chain` selon le plafond.
- **Cuivre** : avec les seuils par défaut, le ton rose (frottements) couvre tout le dessus ; `steps: [0.28, 0.46,
  0.68, 0.95]` le réserve aux reflets (option `steps` de `metalMaterial`). Coulures = bandes d'un pixel le long du
  tube (`uv.y` de `buildTube` = distance parcourue en mètres), sur le bas et les flancs seulement.
- **Pièce qui tourne sans draw call de plus** : l'aiguille d'un cadran est dans le maillage du corps, en dernier
  (ses sommets à la fin), réécrite sur le CPU à chaque changement ; le volant, lui, est un maillage à part qui tourne
  (`rotation.y` autour de la tige). Une jante ronde reste dans le corps : elle ne change pas en tournant.
- **Graine trop discrète** (`check` : « seulement 3 formes pour 5 graines ») : décaler aussi une position (colliers
  posés à la main ± 8 cm), pas seulement des tons.
- Piège : un commentaire `//` ajouté en bout de ligne par un remplacement automatique avale la fin de l'expression.

### Le Complexe, lot 3 : mobilier du Sas (banc, casier, pupitre, grille, plaque)

- **Joints entre blocs** (banc en 2 ou 3 pierres) : sans cœur derrière, le fond se voit par le joint d'un pixel ;
  poser un bloc sombre (−0,55) un peu en retrait dans tout le volume, comme le mur.
- **Dessus quadrillé** : `gridBlock` (kit) — un pavé découpé en cases de ~0,1 m pour que l'usure au centre ou les
  taches d'huile aient une forme. Dessus un cran plus bas (−0,17) pour que l'usure puisse remonter.
- **Portes et leviers pilotables sans draw call de plus** : une plage de sommets par pièce dans le maillage du métal,
  positions et normales réécrites autour d'un pivot (charnière : rotation y ; levier : rotation autour de x passant
  par son pivot) ; `computeBoundingSphere` après. API dans `userData` (locker, desk).
- **Plan incliné** : un piège de signe. Pour une normale `n = (0, cos a, sin a)` (face vers +z et le haut), le bloc
  du plan se tourne avec `rotateX(+a)`. Le coffre dessous : `buildPrism` dont le dessus suit la pente, jamais un
  bloc droit (il perce le plan et cache tout ce qui y est posé).
- **Lueurs mêlées pilotées** (`glowMixMaterial`) : la valeur `aShade` d'une couleur n° i sur N est `(i + 0.5) / N`,
  pas `i` (voir `withShade`). Une couleur « éteinte » par lueur (niveau 0) et une « allumée » suffisent.
- **Contenu derrière une grille** : le cuir goudronné disparaît sur le fond sombre ; une toile plus claire (rampe
  ocre) se devine au travers du quadrillage.
- **Trous pour de vrai** : un damier d'un pixel = des cases pleines une sur deux (12 triangles chacune) ; un
  quadrillage = des barreaux croisés. La lueur est un plan derrière (ou dessous), en `glowMaterial`.
- **Petite plaque** (0,3 × 0,2 m = 5 × 3 px) : un glyphe de 4 ou 5 pièces tient, pas un dessin ; plots réduits
  à la taille de la plaque.

### Le Complexe, lot 4 : Porte-Iris, malle, rambarde, lampe portative

- **Pièces rigides dans un maillage** (kit : `createRigidParts`, `mergeParts`) : chaque géométrie entre avec son n° de
  pièce (255 = fixe) ; on donne une matrice par pièce et `apply()` réécrit positions et normales depuis la pose de
  construction. Les 12 lames de l'iris, l'anneau qui tourne, les 4 verrous, le médaillon et même les glyphes portés
  par les lames : 3 draw calls pour toute la porte. Le couvercle de la malle : même outil (une pièce).
- **Une séquence = une avancée s de 0 à 1** : chaque mouvement est une fenêtre de s (verrous 0–0,11, anneau
  0,11–0,23, lames en cascade ensuite, une lame par 0,042) ; l'ouverture fait avancer s en 5,2 s, la fermeture le
  fait reculer en 3,2 s. Les lueurs lisent la même avancée (un niveau par groupe de glyphes, réécrit seulement
  quand il change).
- **Lames en moulinet** : contour convexe à 5 points (arc extérieur, pointe décalée de 40° à 100°) ; la face avant
  en biseau (`slantPlate`) monte vers le bord d'attaque, si bien que chaque lame passe sur la suivante sans
  z-fighting ; le dos alterne d'une lame à l'autre. Pivot au coin arrière, −54° : repliées, elles forment une
  couronne juste dans l'anneau (rayon mini calculé avant de dessiner : un petit script qui balaie l'angle).
- **Cercle dans un mur** : `ExtrudeGeometry` d'un pavé percé (le trou coupé au seuil), posé dans un trou rectangulaire
  de `buildMasonry` ; voussoirs en `arcBlock` un ton plus clair (+0,3), en saillie de 6 cm, sinon le cadre se perd
  dans le mur. L'anneau en bronze sombre (−0,12 / −0,24 alternés) pour qu'il se détache des lames claires.
- **Ouverture praticable** : un cercle posé sur un seuil n'a pas de largeur au sol ; centre à 1,40 m et Ø 2,80 m
  donnent 1,44 m de passage sur le seuil de 0,20 m.
- **Petits objets en métal sombre** : le cuir d'une poignée peut partager la rampe du laiton noirci (ton −0,6) :
  un draw call de moins.
- **Trame** (option `dither` du matériau, attribut `aCover`) : un faisceau de lampe en cône ouvert, part des pixels
  dessinés de 0,42 à 0 vers le bout. Piège : `(négatif) ** 1.4` donne NaN, et un NaN n'est jamais rejeté par la
  trame : le bout du cône sortait plein. Borner avec `Math.max(0, …)`.
- **Peinture qui s'use** (bandes ambre de la barrière) : une matière éclairée, pas une lueur ; traverse sombre
  (−0,3) dessous pour que les bandes se lisent, quelques bandes plus courtes ou absentes.

### Le Complexe, lot 6 : Archives, rangement (rayonnage, cassette, échelle, table, lampe articulée)

- **Des centaines de petites façades** (276 tiroirs du rayonnage) : `buildQuads` (kit/geometry.js), un rectangle de
  2 triangles par façade avec son ton, posé 3 cm devant un fond sombre : le fond fait les joints d'un pixel. Une
  poignée = un second rectangle d'un pixel, un peu plus clair. 12 × 23 tiroirs = 1 100 triangles. Pas de 0,24 × 0,2 m
  (3 × 3 px de façade + 1 px de joint) : se lit de près, fait une grille régulière de loin.
- **Tiroir qui sort d'une grille de faces plates** : une réserve de 6 vrais tiroirs (pièces rigides) ; quand la scène
  en tire un, il prend la place de la case et la façade plate de la case rentre au fond (ses 8 sommets réécrits, avec
  `addUpdateRange`). Rangé au fond tant qu'il ne sert pas.
- **Pièces rigides : n'envoyer que ce qui bouge.** `createRigidParts` ne réécrit et ne renvoie au GPU que la plage
  des sommets mobiles (`addUpdateRange`) : mettre les pièces mobiles **à la fin** de la fusion (après la façade fixe).
- **Rouages** (`gearWheel`, kit) : roue pleine, 8 à 11 dents au module 0,034 (Ø 0,27 à 0,37 m) ; lue en trois anneaux
  (jante dentée claire, toile sombre posée devant, moyeu clair) sur une frise sombre. Ratés : des roues de Ø 0,2 m
  (des confettis), des jours en croix (des flocons). Une roue sur deux décalée de 1,4 cm en profondeur. Mouvement :
  une dent par à-coup (0,2 s) toutes les 0,7 à 1,1 s, recalculé seulement quand l'angle change (pas à chaque image).
- **Une petite chose qui luit sur une matière de même teinte** (tranche ambre sur serti de cuivre) se perd : foncer le
  serti (ton −0,2), la lueur ressort de jour comme de nuit.
- **Couleurs de lueur propres à un asset** (vert des cassettes) : `DATA_GLOWS` à part de `GLOWS`, sinon le vert devient
  un choix des murs et des lampes ; `glowMaterial` et `glowMixMaterial` acceptent une entrée `{ ramp }`.
- **Traits gravés sur une bande longue** : des rectangles sombres posés dessus (`buildQuads`), pas un ton par sommet
  (une bande de 8 sommets n'a pas de quoi dessiner un trait).
- **Plateau de pierre** : un ton par dalle, pas un bruit par sommet (le plateau devenait moucheté) ; la tache d'usure
  à +0,1 au plus. Feutre = ton −0,75 sur la pierre (pas de matériau en plus).
- **Bras articulé** : un segment = une pièce rigide ; pose de proche en proche (lacet, puis chaque articulation tourne
  autour de x à son pivot) ; `lightPoint` suit l'abat-jour pour le halo. Lampe suspendue = le même bras retourné.
- **Petits objets sur une table sans matériau de plus** : carnets en bronze patiné, couverture à −0,6 (vert-noir),
  pages à +0,45 (or pâle = papier jauni).

### Le Complexe, lot 7 : Archives, lecture (loupe, tabouret, chariot, appareil à manivelle, vitrine)

- **Verre en trame** (vitrine, cuve) : option `dither` du matériau toon avec `aCover` ≈ 0,36 sur les parois, sur la
  rampe `GLASSES.clear` (verre clair jauni, ajoutée au kit), **sans contour** (`outline: false`, sinon chaque trou de
  la trame est cerné) et sans ombre portée. La trame est en espace écran : parois avant et arrière perdent les mêmes
  pixels, on voit le contenu au travers. Un liquide = même matériau, `aCover` plus haut (0,48) : au-delà de ~0,6, il
  cache ce qui est dedans (le fruit de cristal disparaissait à 0,72). Les arêtes de bronze dessinent la boîte.
- **Une trace sur un tambour** : des petits blocs le long d'une hélice se couvrent chacun de leur contour (des taches
  noires). Un ruban plat collé à la surface (`buildRibbon`, kit/geometry.js), même matériau que le papier, ton −1,2 sur
  une rampe dont le premier ton est presque noir ; le papier lui-même un cran plus clair (+0,1) pour que son ombre ne
  tombe pas dans le ton de la trace.
- **Fenêtre lumineuse qui « défile »** (visionneuse) : 0,22 × 0,09 m au moins (à 0,15 × 0,065 m on ne voyait qu'un
  pixel orange) ; quatre traits sombres, pièces rigides qui glissent et rebouclent devant la lueur.
- **Roues qui tournent pour de vrai** : chaque roue est une pièce rigide (rotation autour de son axe = −distance / r),
  avec un boulon clair décalé pour voir le tour ; roulette pivotante = chape (pièce qui tourne autour de y) × roue
  (tourne autour de son axe) ; `roll(d)` aligne les chapes dans le sens de la marche. Petites roues (Ø 0,2 m) : toile
  pleine sombre + jante claire ; grandes (Ø 0,4 m) : 6 rais en bois, jante de fer.
- **Manivelle sur un autre axe que le rotor** (cylindre de cire) : la manivelle est sa propre pièce, sinon elle tourne
  autour de l'axe du cylindre. Animation au cran de 12 images/s, l'angle cumulé seulement quand le temps change.
- **Petits objets sur une table** (loupe, visionneuse) : se juger dans la scène (`dev/archive-corner.html`, `zoom=2.2`,
  `ground=0` : avec le socle d'herbe de la visionneuse, les dalles posées à y = −0,2 se battent avec lui).
- **Tags** : « transport » est le même mot en français et en anglais (doublon refusé par `check`) : « haulage ».

### Le Complexe, lot 8 : Archives, hauteur et catalogue (escaliers, passerelle, meuble-catalogue ★)

- **Escalier à vis** : marches en éventail (`buildPrism` d'un coin de couronne, ≤ 9° par pan) qui passent de 2,5°
  sous la précédente ; angle d'une marche = min(18°, (360° − palier) / (n − 1)) : 19 marches et un palier de 64° font
  un tour complet. Le palier est toujours face à +z, le monde tourne l'escalier. Rampe et limon en petits `beam` le
  long de l'hélice (≤ 8°). La graine change peu la silhouette (bagues, pommeau, pas des barreaux) : c'est de
  l'architecture.
- **Limon incliné** : `beam(a, b, w, h, roll, up)` avec `up` = x met la **largeur** dans le plan vertical. Avec
  (épaisseur, hauteur) dans le mauvais ordre, le limon est couché à plat et tout le dessus prend le ton le plus clair
  (un escalier jaune vif).
- **Caillebotis long** (passerelle de 17 m, arcs) : `openBar` (kit) : un barreau sans dessous ni bouts, 6 triangles
  au lieu de 12. En arc, des traverses en morceaux d'1,2 m et un arc borné à 180° (un balcon de 300° se pose en deux
  arcs) : 5 000 triangles au plus.
- **Marche à étages** (`userData.walk`) : `heightAt` et `occupied` dans le repère de l'asset. Pièges vus en
  simulation : (1) un disque de 0,30 m à 0,6 m du noyau couvre trois marches, et la troisième (plus haute) arrête
  comme un mur : les marches ne comptent que sous le pied (demi-rayon) ; (2) le blob (0,45 m) ne passe dans un fût de
  2,2 m que si le noyau et la rampe ont une emprise réduite (×0,7 et ×0,6) ; (3) une balade qui vise des étapes
  atteintes à 0,6 m coupe l'hélice vers le noyau : une étape par marche, atteinte à 0,25 m (`reach`).
- **Tester la marche sans navigateur** : un petit script Node qui suit `strollTarget` à 1,3 m/s, appelle `collide`
  et `heightAt`, `tick(temps)` et `world.group.updateMatrixWorld()` (sinon les portes ne s'ouvrent jamais), et note
  les blocages et les sauts de plus de 0,45 m. Il a trouvé chaque défaut avant les captures.
- **Grand plateau rond** (catalogue, Ø 3,4 m) : vu de dessus, un disque de pierre uni est mort. Un anneau de glyphes
  couché dans le plateau (`glyphStrip` → `rotateX(−π/2)` → `bendAroundY`), des filets de laiton sur les joints des
  dalles et un cercle de laiton : il se lit de loin. Les glyphes sur la tranche ne se voyaient pas.
- **Héros composé** : le catalogue embarque la lampe articulée du lot 6 (pose « suspendue ») ; 3 draw calls à lui,
  2 pour la lampe. Laiton clair des plaques d'index = bronze patiné à +0,4/+0,5 de ton (pas de matériau en plus).
- **Pièces mobiles nombreuses** : 48 tiroirs et le pupitre = 49 pièces rigides dans le maillage du bronze et celui
  des lueurs (les tranches des cassettes tournent avec le pupitre). Une « vie » tirée du temps (`floor((t + phase) /
  période)` haché avec la graine) : déterministe, sans état à sauver.

### Le Complexe, lot 9 : Atelier, établis et forge (établi, tour, four à bobines, enclume, râtelier)

- **Un étau « bien visible »** : à 0,24 × 0,12 m sur le plateau, c'était une paillette dorée. Il faut qu'il **dépasse du
  bord avant** : mors fixe sur le plateau, grand mors mobile debout devant la tranche (il descend sous le plateau), vis
  et manche en T vers l'avant ; dessus des mors au plus clair du bronze (+0,45). Mors mobile, vis et manche = pièces
  rigides (le manche tourne d'un tour pour 6 mm de course).
- **Chêne noirci** : la rampe est très sombre ; les façades de tiroirs à +0,12 sur la ceinture et les manches d'outils à
  +0,45/+0,5 se lisent, sinon tout fond dans le brun. Les petits outils posés (marteau, lime) : 0,3 à 0,35 m, pas moins.
- **Établi composé** : l'horloger embarque la loupe binoculaire du lot 7 (socle lesté, `setPose` après `create` pour
  la pencher vers l'échancrure) : 4 draw calls, accepté comme le catalogue.
- **Courroie qui défile** : pas de pièce rigide ; des segments à tons alternés dont on réécrit `aTone` (deux phases)
  quand la broche a tourné d'un sixième de tour. Courroie et poulies dans le même plan (axe x des deux poulies) : une
  poulie de moteur couchée dans un autre plan donne une courroie tordue.
- **Briques** : `buildQuads` (une façade par brique, un ton chacune, rangs décalés d'un demi-bloc) devant un cœur sombre
  (−0,75) qui fait les joints. Piège : le cœur plein cache le fond d'une bouche creusée ; le découper autour du creux
  (un bloc derrière, quatre devant), et poser le plan de feu 6 mm devant le cœur (sinon il se bat avec lui).
- **Feu qui palpite** : `FORGE_GLOW` (orange profond, à part de `GLOWS`) dans un `glowMixMaterial` à 4 niveaux ; trois
  plages (bouche, braises, chambre) réécrites par paliers de 1/6 s seulement quand le niveau change. Une chambre
  cylindrique de lueur derrière 12 anneaux de cuivre : de nuit, le rouge entre les spires est le plus beau du four.
  Halo orange porté par la bouche (3,6 m à plein feu) : il colore tout le coin de la pièce.
- **Hauteurs empilées** : écrire les cotes de bas en haut et vérifier que chaque étage reste sous la hauteur totale (la
  hotte partait au-dessus de son propre sommet : géométrie retournée, invisible).
- **Râtelier à silhouettes** : la silhouette = les rectangles de l'outil agrandis d'un pixel, peints à plat sur la
  planche (matériau sans contour, sinon chaque forme est cernée) ; l'outil accroché la couvre et laisse un liseré
  blanc, l'outil pris laisse la forme pleine. Blanc usé : rampe crayeuse qui ne monte pas au blanc pur.
- **Tags** : « forge », « machine », « bronze » sont les mêmes mots dans les deux langues : « smithy », « heating »,
  « bronze fittings ».

### Le Complexe, lot 10 : Atelier, outils et réserves (outils, étagère à pièces, touret, fût, table à calques)

- **Petits outils (0,2 à 0,45 m)** : dessinés couchés le long de x, à plat, puis posés (couché, debout, en main) par une
  seule matrice. Section d'au moins 0,03 m et 1,2× la taille réelle : à 1/16 m le pixel, c'est la silhouette vue de
  dessus qui fait l'outil (tête en T du marteau, U de la scie, éventail du calibre, zigzag du mètre). Debout et en main :
  `makeBasis` (x → y, y → z, z → x) pour que la longueur monte et que la face regarde +z.
- **Trousse** : dessiner chaque outil, mesurer sa boîte, les empiler en deux colonnes ; la profondeur de la trousse suit
  la colonne la plus chargée. Outils « rangés » (pinces fermées, mètre replié, compas fermé). Les boucles de cuir au ton
  du cuir (−0,6) : plus claires, elles cachaient les outils.
- **Peinture noir et blanc (mire)** : une seule rampe de la presque-noire au blanc cassé ; les bandes noires à −1,2.
- **Une couleur à part dans une rampe** (bandeau rouge du fût d'électrolyte) : la mettre en tête de rampe avec un premier
  seuil presque nul (0,03) ; seul un ton très bas (−3) l'atteint, l'ombre ordinaire jamais. Pas de draw call en plus.
- **Cercles autour d'un fût** : `ring` (kit), pas un cylindre plein : le disque du dessus d'un cylindre fermé couvrait
  tout le couvercle d'un aplat de cuivre.
- **Bacs d'étagère** : caisson plein au dessus sombre (−0,7 = l'intérieur), façade plus haute d'un rebord, plaque de
  laiton à +0,7 ; contenu en quelques blocs qui dépassent (rouages, ressorts, bobines, cristaux en lueur cyan). Les
  planches très sombres (−0,78) pour que les bacs ressortent. 35 bacs = pièces rigides (`slide`).
- **Verre de porte en trame** sur un caisson sombre : 0,24 de couverture et un ton bas, sinon on lit une moustiquaire.
- **Feuilles sur un verre lumineux** : les feuilles plus sombres que le verre (cuivre à −0,3) ; au même ton, elles se
  fondent dans l'ambre pâle. Traits gravés = `beam` fins à −0,95.
- **Joues d'un touret en planches** : la longueur de chaque planche prise sur le cercle donne un pourtour en marches
  d'un pixel, le cercle de fer (lathe à 20 pans) le referme. Le touret entier est une pièce rigide (`setTurn`).

### Le Complexe, lot 11 : levage (poutre rivetée, portique et pont roulant, chemin de câbles)

- **Profil en I lisible** : ailes un ton plus clair (+0,08) que l'âme en retrait (−0,3) ; le dessus de l'aile haute un
  cran plus bas (−0,17) pour que ses deux rangées de rivets (quads d'un pixel, +0,3) ressortent ; raidisseurs verticaux
  au pas de 1,1 à 1,6 m (+0,12) : vus de haut, ce sont eux qui font le rythme. Tronçons de 3 à 4,5 m, un ton chacun,
  éclisses rivetées aux joints. Rivets et coulures en `buildQuads` (2 triangles chacun) : 12 m de poutre ≈ 1 200
  triangles.
- **Chaîne qui s'allonge sans réécrire de géométrie** : tous les maillons sont construits sous le crochet ; chacun est
  une pièce rigide qui suit le crochet, ou s'écrase en un point dans le palan quand il dépasse le haut de la chaîne.
  Le motif bouge avec le crochet (la chaîne coulisse pour de vrai). Maillon = barreau sans bouts (8 triangles),
  tourné d'un quart de tour sur le précédent. Volant de manœuvre : un tour par mètre de chaîne.
- **Crochet** : un C d'arcs `beam` dans le plan xy, en fonte claire (+0,35 à +0,5) : en fonte sombre, il se perdait
  dans la chaîne de commande. Charge : lingots sur deux barres de palonnière (un plateau plein les cachait), caisse à
  planches (quads sombres) et ceintures de fer, élingues en maillons fins.
- **Profil tiré le long d'un tracé** (`buildSweep`, kit/geometry.js) : polygone (u, v) extrudé le long d'une polyligne
  du sol, coupes d'onglet aux coudes ; `slicePath` et `measurePath` pour les plaques de couvercle et les pattes. Les
  pattes d'un chemin mural se posent pan de mur par pan de mur, jamais dans un coin (elles sortaient du mur).
- **Couleur à part dans une rampe, encore** : la gaine ambre des câbles en tête de la rampe des gaines (ton −3), le
  cuivre dans le bronze (+0,35) : 2 draw calls pour la goulotte, ses câbles de trois couleurs et ses colliers.
