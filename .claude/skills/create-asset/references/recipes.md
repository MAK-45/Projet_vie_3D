# Recettes : ce qui marche, ce qui rate

Carnet de bord du rendu. Les sections « éprouvé » décrivent ce qui a été fait et regardé à l'écran ; les sections
« pistes » sont des points de départ pas encore essayés. **Après chaque asset, ajouter ici ce qui a servi** :
c'est ce fichier qui fait progresser les assets suivants.

## Sommaire

1. Échelle et lisibilité
2. Couleurs et lumière
3. Contours
4. Végétal : tronc, branches, feuillage (éprouvé sur le bouleau)
5. Vent (éprouvé)
5 bis. Herbes, pelouses, fleurs (éprouvé)
6. Roches (éprouvé sur le rocher posé et la roche enterrée) ; pistes : bâti, véhicules
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
- **Fleurs** : corolle = `buildFanGeometry` avec `starOutline(pointes, creux)` (marguerite 8/0,6, bleuet 7/0,45,
  coquelicot 4/0,8) ; le cœur est un second éventail au même point, dans un 3e matériau avec `polygonOffset`
  (facteur −2, unités −8) pour passer devant, et le **même `id`** que les pétales (sinon le contour le mange).
- Écarter les têtes : `spread` 0,3 à 0,55 × hauteur. Têtes serrées = une seule tache rouge. Corolle 0,07 à 0,1 m
  de rayon (3 à 4 pixels au zoom 1). Les tiges ne vont pas jusqu'au jaune de la rampe d'herbe (seuils
  `[0.3, 0.5, 0.7, 0.9]`), sinon elles font une colonne pâle.
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
