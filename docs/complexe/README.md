# Le Complexe : bible d'assets (ancien-technologique), version pixel art

Adaptation au Projet Vie 3D de la bible « Le Complexe — Bible d'assets 3D (ancien-technologique) »
(document source : https://claude.ai/code/artifact/acb23f84-da1f-44c4-840e-29c2cd170b8f, écrit pour du rendu HD).
**Toute l'idée est gardée** : le lieu, ses pièces, ses salles d'étude, ses artefacts, ses mesures réelles, son
ambiance et sa logique (un site ancien où une technologie avancée a été greffée puis a vieilli). Ce qui change, c'est
**la façon de le dessiner** : gros pixels, palettes courtes, géométrie légère, pas de textures, lumière en paliers.

| Fichier | Contenu |
|---|---|
| `README.md` (ce fichier) | Direction artistique, traduction HD → pixel art, budgets, plan d'ensemble |
| `PIECES.md` | Les quatre pièces du Complexe (Sas, Archives, Atelier, Galerie et Rotonde) et le kit d'étude partagé |
| `SALLES.md` | Les dix salles d'étude, leurs assets et leurs artefacts ; récapitulatif |
| `PLAN.md` | Le plan d'implémentation par lots de 4 à 5 assets, et la correspondance fiche → module |
| `SUIVI.md` | **L'état d'avancement** : ce qui est fait, validé, en cours ; à lire en début de session |

Règles du projet qui s'appliquent ici : `docs/ART-DIRECTION.md`, `docs/PERFORMANCE.md`, `docs/ASSETS.md`,
`docs/WORLDS.md`, skills `create-asset` (chaque asset) et `create-world` (assemblage des pièces).

---

## Direction artistique et règles d'échelle

Le Complexe est un site scellé, sans aucune ouverture sur l'extérieur : une architecture ancienne de pierre et de
bronze dans laquelle une technologie très avancée a été greffée, puis laissée vieillir. Quatre pièces du Complexe,
dix salles d'étude (une par artefact), 160 fiches d'assets normaux et 10 artefacts venus d'autres mondes. Ce n'est
pas un jeu : la créature y vit une vie scénarisée (elle entre, étudie, répare, insère les clés, traverse la Porte),
le spectateur regarde.

### Principe visuel

- **Volumes anciens** : voûtes, piliers massifs, dalles, bas-reliefs, épaisseur de mur 0,6 m (10 px : le mur se lit
  comme un vrai mur en coupe).
- **Technologie intégrée, pas posée** : glyphes lumineux gravés dans la pierre, câbles tressés, cadrans, cristaux,
  fibres de lumière, rouages.
- **Tout est usé** : patine, suie, vert-de-gris, rayures, poussière, réparations de fortune. En pixel art, l'usure
  passe par **la palette et la variation par face** (tons décalés, suie plus sombre en haut des murs, arêtes plus
  claires), pas par des textures.
- **Règle d'or** : toute technologie a une forme ancienne. Pas de plastique, pas d'écran plat, pas de LED nette. Les
  écrans sont du verre bombé à phosphore ambre, les interrupteurs sont des leviers et des tirettes en laiton.
- **Deux alphabets** : celui du Complexe est fait de **traits droits** (segments de 1 px horizontaux et verticaux),
  celui des artefacts est fait de **courbes** (points, arcs, spirales). À 16 px/m, c'est la différence la plus
  lisible entre « fait ici » et « venu d'ailleurs ».

### Traduction HD → pixel art (la règle de ce document)

Repère : **16 pixels d'art par mètre au zoom 1**, donc **1 px = 6,25 cm**. Le zoom de l'explorateur va de 0,5 à 4 :
au zoom 4 (plan cadré), 1 px = 1,6 cm. Tout ce qui est plus fin que ~7 cm ne se dessine pas en géométrie : on le
**suggère** ou on l'**omet**.

| Dans la bible HD | Dans le Projet Vie 3D |
|---|---|
| Textures 2K/4K, trim sheets, atlas, normal maps, densité de texels | **Aucune texture.** Rampes de 4 à 5 couleurs (`createToonMaterial`), glissement de teinte, motifs procéduraux (`speckle`, `furrow`, `bark`), couleur par face ou par sommet |
| 1 500 à 80 000 triangles | **< 5 000 triangles** par asset (quelques centaines pour les modules répétés), **≤ 3 draw calls** ; héros et artefacts : jusqu'à 8 000 triangles et 6 draw calls (pièces mobiles), dépassement signalé par `npm run check` et accepté |
| Glyphes gravés de 2 cm × 1 cm | Bande émissive de **1 px de haut** (≈ 6 cm), découpée en « lettres » de 1 à 3 px tirées de la graine ; bandeau de 0,12 m = 2 px |
| Rivets Ø 3–5 cm, vis, boulons | Omis, ou une **rangée de points d'1 px** (ton clair du métal) ; seuls les gros rivets (≥ 6 cm) deviennent de petits plots |
| Graduations au degré, chiffres, textes gravés | 8 à 24 repères selon la taille, jamais de texte ; les « numéros » sont des motifs de 1 à 3 traits |
| Chaînes à maillons de 4 cm | Ligne de petits blocs alternés (pointillé de 1 px), ou tube fin à tons alternés |
| Câbles Ø 3–6 cm | Tube de 1 px (≈ 6 cm) ; les gros câbles (Ø 0,12–0,25 m) sont de vrais tubes facettés de 2 à 4 px |
| Craquelures, veines, Widmanstätten, cernes | Motif `speckle`/`furrow` du matériau, ou quelques lignes d'1 px d'un ton voisin |
| Vert-de-gris dans les creux, suie, poussière | Ton d'ombre de la rampe décalé vers le vert (bronze) ; assombrissement des sommets hauts (suie) ; ton clair poudré sur les dessus |
| Verre, quartz, cristal, réfraction, dispersion | Matière à rampe claire et froide, reflet d'1 px, `emissive` pour ce qui luit ; dispersion = éventail de plans colorés émissifs (faux spectre), **jamais** de vraie réfraction |
| Brouillard volumétrique, poussière en suspension | Brouillard de scène en paliers tramés (Bayer) vers le noir-bleu ; particules de poussière en points pixel près des lampes (`src/fx/`) |
| Caustiques, reflets plans (bassin-miroir) | Taches de lumière animées en paliers, géométrie miroir sous une surface sombre translucide ; pas de passe de réflexion |
| Lumières locales par lampe | `emissive` sur les ampoules et glyphes (gardent leur éclat dans le noir) ; **lumières de halo** (`createGlowLight`, 4 emplacements dans le moteur aujourd'hui) réservées aux sources qui comptent : artefact, foyer, grande lampe proche de la créature |
| Squelette d'environ 40 os, skinning | Pièces rigides sur pivots, animées par le code (comme la Porte des étoiles existante) ; animation du décor à 12 images/s |
| Son | Hors périmètre pour l'instant (`docs/VISION.md`, question ouverte) ; les « cliquetis » et « résonances » deviennent des signes visuels |
| « Le joueur », interactif | Pas de joueur : la créature agit selon le scénario ; les états des assets (fermé, ouverture, ouvert...) sont des **paramètres** et des **séquences pilotées** (`group.userData`), jouables par le scénario |

Ce qui ne change pas : **les dimensions réelles en mètres** (1 unité = 1 m, origine au sol), les proportions, les
hauteurs de commande, les portes hautes, la grille de 2 m. Les très petits objets (Clef-Disque 0,28 m = 4 px au
zoom 1) restent à taille réelle : ils sont faits pour être lus au zoom 3–4 en plan cadré, et de loin ils se signalent
par leur lueur cyan.

### Palette et matériaux

Chaque matière devient une **rampe de 4 à 5 couleurs**, de l'ombre (froide) à la lumière (chaude), rangée dans
`src/assets/kit/palettes.js` (clés en anglais entre parenthèses). Les couleurs de la bible HD sont les **tons moyens**
de ces rampes.

| Matériau | Usage | Ton moyen | En pixel art |
|---|---|---|---|
| Basalte noir-bleu (`STONES.blackBasalt`) | Murs, sols, socles | #1E2228 | Rampe noir-bleu à 4 tons, `speckle` fin ; les glyphes gravés sont des traits émissifs d'1 px |
| Pierre fumée, calcaire sombre (`STONES.smoked`) | Voûtes, piliers, bas-reliefs | #3A3631 | Rampe brun-gris chaude ; suie = haut des volumes plus sombre ; arêtes écaillées = ton clair irrégulier |
| Bronze patiné (`METALS.patinatedBronze`) | Cadres, charnières, rouages, cages | #8A6A3B | L'ombre de la rampe tire vers le **vert-de-gris #4F8A7B** : les creux verdissent tout seuls ; arête polie = ton le plus clair |
| Laiton noirci (`METALS.blackenedBrass`) | Cadrans, leviers, plaques | #5E4A26 | Rampe sombre et sourde, reflet d'1 px jaune pâle |
| Cuivre oxydé (`METALS.oxidizedCopper`) | Câbles, bobines, tuyaux | #3F7F6E | Rampe qui va du vert-bleu (oxyde) au cuivre rosé (frottements) ; coulures = bandes verticales d'un ton |
| Fonte (`METALS.castIron`) | Volants, bancs de machines, roues | — | Rampe gris-noir froide (proche du `iron` existant) |
| Verre soufflé, quartz fumé (`GLASSES.amber`, `GLASSES.cyan`, `GLASSES.smoky`) | Ampoules, cuves, cristaux | ambre ou cyan translucide | Rampe claire + `emissive` ; « bulles » = 1 à 2 points clairs |
| Cuir et tissu goudronné (`FABRICS.tarredLeather`) | Gaines de câbles, sangles, courroies | #2B2118 | Rampe brun-noir, `furrow` léger pour les plis |
| Feutre noir (`FABRICS.felt`) | Panneaux et rideaux des chambres noires | — | Rampe presque noire, mate, sans reflet |
| Bois noirci (`WOODS.blackenedOak`) | Établis, malles, râteliers | — | Variante sombre du `oak` existant |

Le basalte du Complexe est une matière à part (`blackBasalt`) : le `basalt` d'origine reste celui des rochers et
de la Porte des étoiles. Les briques communes (glyphes, rivets, bagues, ampoules, cadrans, leviers, chaînes, câbles,
tons par sommet pour la suie et l'usure, matériaux `stoneMaterial` / `metalMaterial` / `glowMaterial`) sont dans
`src/assets/kit/complex-parts.js` ; le nuancier `dev/complex-swatch.html` (option `night=1`) les montre toutes.

Lumières (rampes émissives, `src/assets/kit/palettes.js`) : **ambre** (`GLOWS.amber`, filament ≈ 2000 K, #FF9A3C au
cœur), **cyan** (`GLOWS.cyan`, #5FD4E6), **rouge** (`GLOWS.alarm`, #A3261F).

### Lumière

Pas de fenêtre, donc aucune lumière du jour. Trois sources seulement :

- **Ambre (≈ 2000 K)** : glyphes lumineux dans la pierre et lampes à filament en cage de bronze. C'est l'éclairage
  ancien et humain, faible et constant.
- **Cyan froid (#5FD4E6)** : réservé aux artefacts et aux zones d'énergie. L'œil du spectateur est guidé vers le cyan.
- **Rouge sombre (#A3261F)** : danger ou alerte, utilisé rarement.

Ambiance générale : sombre, forts contrastes, brouillard léger, poussière en suspension près des sources chaudes.

En pratique dans le moteur (`docs/ART-DIRECTION.md`) :

- Le moteur demande une `DirectionalLight` : elle devient une **lumière de service invisible**, faible et froide,
  venue d'en haut, qui garde l'ombrage toon lisible (3 paliers) et donne la seule ombre portée. Le reste de
  l'ambiance vient de `setDarkness` (le noir de la pièce) et des lueurs.
- Ampoules, glyphes, cœurs d'artefacts : matières **émissives** (elles gardent leur couleur dans le noir).
- Le décor proche d'une source prend sa couleur par les **lumières de halo** (3 paliers tramés). Le moteur en a 4 :
  le monde les attribue aux sources les plus proches de la créature ou de la caméra (à étendre si besoin, voir
  `PLAN.md`, lot 5).
- Scintillement lent des filaments, pulsations des artefacts : en shader ou par paliers à 12 images/s.

### Échelle de référence (créature de 1,80 m)

| Repère | Valeur | En pixels (zoom 1) |
|---|---|---|
| Unité de travail | 1 unité = 1 m | 16 px |
| Hauteur des yeux / épaules / coude | 1,70 m / 1,50 m / 1,10 m | 27 / 24 / 18 px |
| Bras levé | ≈ 2,25 m | 36 px |
| Porte standard | 1,40 × 2,80 m (volontairement haute) | 22 × 45 px |
| Couloir | 2,40 m de large × 4,00 m de haut | 38 × 64 px |
| Plafond d'une pièce standard | 5 à 7 m | 80 à 112 px |
| Marche d'escalier | 0,18 m de haut × 0,32 m de profondeur | 3 × 5 px |
| Garde-corps / plan de travail / assise | 1,00 m / 0,90 m / 0,45 m | 16 / 14 / 7 px |
| Levier, cadran, bouton de commande | centré à 1,10–1,30 m | 18–21 px |
| Grille modulaire de l'architecture | 2 m | 32 px |

Le mannequin de 1,80 m (`creatures/humanoid/mannequin`) sert au test d'échelle de chaque pièce.

### Assets normaux et artefacts : budgets

| Catégorie | Définition | Triangles | Draw calls | Particularités |
|---|---|---|---|---|
| Kit modulaire | Murs, sols, voûtes, piliers réutilisables | 50 à 800 | 1 à 2 | Assemblage sur grille de 2 m, posé des centaines de fois : `InstancedMesh` ou fusion par le monde |
| Asset normal | Mobilier, machines, décor, accessoires | 200 à 5 000 | ≤ 3 | Lisible, ancien-tech, non unique ; graine + axes de variation |
| Asset héros du Complexe | Porte-Iris, meuble-catalogue, Triptyque | ≤ 8 000 | ≤ 4 | États et séquence animée pilotables |
| Artefact | Objet unique, narratif, piloté par le scénario | ≤ 8 000 | ≤ 6 | Matières et alphabet de son monde d'origine, lueur propre, animation en shader ou par pivots |

Pas de textures (aucun Mo de GPU), module autonome de quelques dizaines de Ko. Une pièce assemblée vise < 50 draw
calls et < 150 k triangles visibles (`docs/PERFORMANCE.md`).

### Artefacts : mondes d'origine et salles d'étude

Les artefacts ne viennent pas du Complexe : chacun vient d'un autre monde, avec ses matériaux, ses proportions et son
alphabet. Ils restent anciens (érosion, dépôts minéraux, réparations d'époque), mais ils ne partagent ni le bronze, ni
le basalte, ni les rivets du Complexe. Chaque artefact est étudié dans sa propre salle, couvert de capteurs et de
câbles du Complexe : le contraste entre le matériel d'étude (bronze, tissu goudronné, ambre) et l'objet venu
d'ailleurs fait lire la scène.

**Règles pour tout artefact** : pas de bronze patiné ni de laiton noirci (sauf les accessoires d'étude ajoutés par le
Complexe), pas de rivets, formes plus lisses ou plus organiques (plus de facettes, silhouettes rondes), lumière propre
froide (cyan ou blanc), gravures dans un alphabet de courbes. En pixel art, chaque artefact a **sa propre rampe de
couleurs** qu'aucun autre asset n'utilise, et un contour d'`id` distinct pour qu'il se détache du matériel d'étude.

| Artefact | Monde d'origine | Matériaux et couleurs | Forme | Salle |
|---|---|---|---|---|
| Clef-Disque | Sel et ivoire | Céramique blanche craquelée (#E8E2D4), or pâle, opale bleutée | Disque lisse, spirale gravée | 1 |
| Cassette-Maître | Ardoise | Ardoise noire polie, mica argenté, filigrane d'argent | Plaque aux angles arrondis | 2 |
| Prisme de Phase | Glace | Quartz laiteux (#E6EEF2), fils d'argent | Prisme hexagonal pur | 3 |
| Marteau Résonant | Forge céleste | Fer météoritique noir à motifs de Widmanstätten, jade vert, os gravé | Masse lourde et asymétrique | 4 |
| Automate de l'Artisan | Jade et terre cuite | Céladon craquelé (#8FB5A0), or rose aux joints, tendons de lin ciré | Statue articulée | 5 |
| Arbre de Mémoire | Forêts pétrifiées | Bois silicifié brun-rouge (#6B3F2E), veines d'argent, fruits de cristal | Tronc et branches organiques | 6 |
| Le Cœur | Pierre noire | Obsidienne polie, filigrane d'or, noyau de cristal | Anneaux lisses, sans soudure | 7 |
| L'Oracle | Pierre rouge | Jaspe rouge et granit, œil d'obsidienne, glyphes dorés | Disques massifs gravés | 8 |
| Orrery du Dôme | Ciel nocturne | Argent noirci, lapis-lazuli, nacre, ambre fossile | Anneaux fins, sphères précieuses | 9 |
| Porte des Étoiles | Marbre blanc | Albâtre blanc veiné (#D8D3C8), or pâle, pierres-étoiles | Arche hexagonale | 10 |

La « Porte des étoiles » déjà présente dans l'Atelier (`props/magic/star-portal`, un anneau de pierre et sa console)
est un autre objet : l'arche hexagonale de la salle 10 sera un nouvel asset, qui pourra réutiliser l'horloge de
séquence de `src/assets/kit/portal.js`.

### Le Complexe comme monde

Le Complexe est un **monde intérieur** (`worlds/interiors/ancient-complex`, skill `create-world`) assemblé pièce par
pièce, au fil des lots. Ce que le pixel art et la caméra isométrique imposent :

- **Vue en coupe** : la caméra est au-dessus ; plafonds, voûtes et dômes sont masqués, et les murs tournés vers la
  caméra sont abaissés (maquette coupée à ~1,2 m) selon l'angle de vue. Les voûtes restent visibles en plan cadré
  depuis l'intérieur.
- **Une pièce à la fois** : réglage `room` (une pièce en diorama, ou « parcours »), et pendant la marche seules la
  pièce courante et ses voisines sont montrées (budget de draw calls).
- **Grandes salles** : la salle de la Porte (26 m = 416 px) dépasse l'écran au zoom 1 ; on y recule (zoom 0,5) et ses
  assets doivent rester lisibles à 8 px/m (silhouettes fortes, détails émissifs).

### Les personnages dans le Complexe

On peut **mettre ses personnages dans le Complexe et les faire se déplacer dans toute la carte**, comme dans la
prairie : le blob (`creatures/spirits/couveuse-blob`), le mannequin, le mannequin magique, l'héroïne, le héros, la
barre de 1,80 m, et tout personnage ajouté plus tard. C'est l'explorateur du projet (`src/explorer/`, réglage
« Personnage ») qui les promène ; le Complexe doit donc être **praticable** de bout en bout :

- **Sol et étages** : le monde donne la hauteur du sol (`heightAt`) en tenant compte de l'étage où se trouve le
  personnage, car l'intérieur superpose des niveaux (mezzanine des Archives à 3,4 m, galerie d'observation de l'Éveil,
  balcons et passerelles des salles rondes, cabine de la Porte, fond de la fosse du Cœur).
- **Escaliers et rampes** : escaliers à vis, escaliers droits, rampe de la Porte et marches des socles se montent en
  marchant (marches de 0,18 m) ; chaque module d'escalier ou de passerelle fournit sa surface de marche.
- **Obstacles** : murs, piliers, meubles, machines et artefacts posés au sol bloquent le passage (`collide`) ; chaque
  asset posé donne son emprise au sol (`meta.footprint`, ou une emprise plus fine pour les longs meubles).
- **Portes** : les portes (standard, grandes portes, Porte-Iris) s'ouvrent quand un personnage approche et le laissent
  passer, puis se referment ; la Porte-Iris joue sa séquence d'ouverture. Fermées, elles bloquent.
- **Garde-corps et vides** : on ne tombe pas de la mezzanine ni dans la fosse du Cœur ; les garde-corps sont des
  obstacles, les ouvertures dans le sol (trappes fermées, caillebotis) se marchent.
- **Gabarits** : le blob lévite à 1 m et mesure 0,90 m, les personnages font 1,77 à 1,81 m : tous passent les portes
  de 2,80 m et les couloirs de 2,40 m. Le blob et le mannequin magique éclairent le décor dans le noir : dans le
  Complexe, ils prennent une des lumières de halo, ce qui en fait les meilleures « lampes portatives » du lieu.
- **Caméra** : la vue en coupe suit le personnage (les murs entre lui et la caméra s'abaissent, la pièce où il entre
  apparaît), et la caméra « cadrée » permet de le suivre de près dans les salles d'étude.
- **Plus tard** : quand le moteur de scénario (`src/script/`) existera, ces mêmes personnages joueront le fil narratif
  (aller chercher les clés, les insérer, traverser la Porte).

### Plan d'ensemble

| N° | Pièce | Dimensions (L × l × H) | Rôle | Accès |
|---|---|---|---|---|
| 1 | Sas de Scellement | 10 × 6 × 5 m | Entrée | Porte-Iris au sud, porte standard au nord (Archives) |
| 2 | Archives | 18 × 12 × 7 m + mezzanine | Mémoire du site | Sas (sud-ouest), Atelier (est) |
| 3 | Atelier de l'Artisan | 12 × 10 × 5,5 m | Fabrication des instruments d'étude | Archives (ouest), couloir de 2,4 × 8 m vers la Galerie (nord) |
| 4a | Grande Galerie | 48 × 4 × 6 m | Circulation, 5 portes d'étude | Atelier (sud), Rotonde (nord) |
| 4b | Rotonde | Ø 14 × H 7 m | Distribution | 6 portes radiales espacées de 60° |
| E1 | Salle de la Clef | 8 × 8 × 4,5 m | Étude de la Clef-Disque | Galerie, côté ouest (à 8 m) |
| E2 | Salle de la Cassette | 7 × 6 × 4 m | Étude de la Cassette-Maître | Galerie, côté ouest (à 22 m) |
| E3 | Salle du Prisme | 9 × 9 × 6 m | Étude du Prisme de Phase | Galerie, côté ouest (à 36 m) |
| E4 | Salle du Marteau | 10 × 8 × 5 m | Étude du Marteau Résonant | Galerie, côté est (à 15 m) |
| E5 | Salle de l'Éveil | 12 × 10 × 6 m | Étude de l'Automate | Galerie, côté est (à 33 m) |
| E6 | Salle de l'Arbre | Ø 12 × H 10 m | Étude de l'Arbre de Mémoire | Rotonde, sud-ouest, couloir de 3 × 12 m |
| E7 | Salle du Cœur | Ø 14 × H 12 m | Étude du Cœur | Rotonde, sud-est, couloir de 3 × 12 m |
| E8 | Salle de l'Oracle | Ø 20 × H 14 m | Étude de l'Oracle | Rotonde, nord-ouest, couloir de 3 × 12 m |
| E9 | Salle de l'Orrery | Ø 16 × H 14 m | Étude de l'Orrery | Rotonde, nord-est, couloir de 3 × 12 m |
| E10 | Salle de la Porte des Étoiles | 26 × 18 × 14 m | Étude de la Porte des Étoiles | Rotonde, nord, couloir de 3 × 12 m |

**Fil narratif** : trois artefacts portables (Clef-Disque, Cassette-Maître, Prisme de Phase) sont étudiés dans les
salles d'étude 1, 2 et 3 et s'insèrent dans le Triptyque des Verrous de l'Oracle. Dans le Projet Vie 3D, c'est un
scénario tout trouvé : la créature va chercher les trois clés, les insère, l'Oracle s'éveille, et la Porte des
Étoiles mène à un autre monde.

### Rangement dans l'Atelier Vie 3D

- Catégories existantes (`src/assets/taxonomy.js`) : `buildings/structure` (sols, murs, piliers, voûtes, portes,
  escaliers, passerelles), `furniture/*` (assises, tables, rangements, luminaires), `props/tools`, `props/decor`,
  `props/books`.
- Sous-catégories à ajouter au lot 0 : `props/machines` (« Machines et instruments » : consoles, cadrans, tuyaux,
  câbles, capteurs), `props/artifacts` (« Artefacts » : objets uniques venus d'autres mondes), `worlds/interiors`
  (« Intérieurs » : pièces closes vues en coupe).
- Tags communs : `complexe`, `ancien-tech`, `ancient-tech` en plus des tags propres ; biome `interior`.
- Chaque fiche de la bible garde son identifiant (SAS-01, ARC-17, E7-A1...) : il est noté dans la description du
  module, et `PLAN.md` donne la correspondance fiche → module.
