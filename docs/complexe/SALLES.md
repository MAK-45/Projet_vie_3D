# Le Complexe : les dix salles d'étude et leurs artefacts

Suite de `README.md` et `PIECES.md`. Mesures réelles en mètres ; « À dessiner » = ce qui se voit en pixels
(1 px = 6,25 cm au zoom 1) ; « Module » = l'asset du projet (`PLAN.md`). Chaque salle réutilise le kit d'étude
(ETU, dans `PIECES.md`) et les modules d'architecture (murs, sols, piliers, portes).

Pour chaque artefact, la partie **Dessin** remplace la « Modélisation » HD : budget pixel art, découpage en pièces
mobiles, ce qui se fait en shader. Les détails sous le pixel (craquelures de 0,3 mm, filets de 0,5 mm) gardent leur
intention et deviennent des tons, des points et des lignes d'1 px lisibles au zoom 3–4.

---

## Salle d'étude 1 — La Clef (8 × 8 × 4,5 m)

Une petite salle d'essai presque vide : au centre, un autel entouré d'un anneau de capteurs, et c'est tout. Le silence
et la lumière froide de la Clef-Disque dominent ; l'ambre n'est là que pour les lampes et les glyphes des murs.

### Architecture

- Murs de basalte avec bandeau de glyphes à 1,10 m, plafond plat de 4,5 m portant 4 lampes cages SAS-05.
- **Porte** : standard 1,40 × 2,80 m (GAL-02 n°1), mur est, depuis la Galerie.
- **Sol** : au centre, un cercle de mesure de laiton Ø 2,4 m, marqué tous les 10° (36 repères d'1 px, un plus long
  tous les 90°).
- Console d'enregistrement contre le mur nord, tableau de notes contre le mur ouest.

### Assets spécifiques

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| E1-01 | Autel d'essai | 0,9 × 0,9 × 1,0 m | Bloc de basalte à deux étages construit par le Complexe, cuvette Ø 0,34 m au sommet, 3 pointes de bronze à 120° (H 0,12 m = 2 px) qui se replient. | `props/machines/test-altar` |
| E1-02 | Cercle de mesure | Ø 2,4 m, rainure de 0,02 m | Anneau de laiton d'1 px incrusté dans le sol, 36 repères, 4 plus longs. | `buildings/structure/brass-floor-ring` |
| E1-03 | Couronne de capteurs | Ø 1,6 × H 0,5 m | Anneau de laiton sur 4 pieds de 0,5 m, 6 sondes (comme ETU-02) pointées vers le disque, câbles d'1 px qui retombent en boucles. | `props/machines/sensor-crown` |
| E1-04 | Cloche de confinement | Ø 0,6 × H 0,7 m | Verre soufflé épais translucide (reflet d'1 px), plaque de bronze Ø 0,7 m, poignée anneau, potence de 1,2 m qui la lève (pilotable). | `props/machines/glass-bell` |
| E1-05 | Balance de torsion | 0,5 × 0,3 × 0,8 m | Boîtier de verre sur socle de bronze, fil vertical d'1 px clair, petit miroir qui pivote (1 px qui clignote), échelle graduée en regard. | `props/machines/torsion-balance` |

**Du kit d'étude** : ETU-04 ×1, ETU-01 ×2, ETU-06 ×6 modules, ETU-07 ×6 faisceaux, ETU-12 ×1, ETU-13 ×1, ETU-15
(périmètre Ø 3,2 m).

### Artefact

#### E1-A1 — La Clef-Disque (`props/artifacts/key-disc`)

Premier objet-clé portable du site. Elle vient d'un monde de sel et d'ivoire : rien dans la salle ne lui ressemble.

- **Origine et matériaux** : céramique blanche craquelée (#E8E2D4), or pâle, opale bleutée. Pas de rivets, pas de vis.
- **Taille** : Ø 0,28 m × 0,04 m (4,5 px au zoom 1, 18 px au zoom 4).
- **Disque externe** : céramique ivoire ; les craquelures remplies de poussière ocre deviennent 3 à 5 traits d'1 px
  d'un ton ocre (au zoom 4) ; la spirale de 9 tours devient une spirale de 3 tours d'un ton plus sombre.
- **Anneau intermédiaire** : Ø 0,22 m, or pâle, rotatif ; les 24 encoches deviennent un pointillé.
- **Noyau** : opale bleutée Ø 0,05 m, émissive cyan, sertie de 6 griffes d'or (points).
- **Encoche de positionnement** : V en bas du disque (1 px manquant).
- **Patine** : bord ébréché vers 4 h (facette manquante), dépôts de sel blanchâtre (points blancs), or plus clair aux
  endroits de prise.
- **Traces d'étude** : étiquette d'inventaire n°1 en laiton sur cordelette, 2 électrodes pincées au bord avec leurs
  fils (1 px).
- **Position** : lévitation à 5 cm au-dessus de la cuvette de l'autel, entre les 3 pointes de bronze.
- **Lumière et animation** : noyau cyan qui pulse à 0,5 Hz, anneau qui tourne à 2 tr/min. Quand la créature retire le
  disque (scénario), les pointes se replient et la lumière s'éteint dans l'autel.
- **Dessin** : < 1 500 triangles, 2 draw calls (céramique et or, lueur). Lisible au zoom 4 ; de loin, une étoile cyan
  de 2 px.

---

## Salle d'étude 2 — La Cassette (7 × 6 × 4 m)

Une chambre blindée de lecture : une cage de cuivre au centre, un lecteur spécial dedans, une toile blanche en face.
Basse, close, la lumière vient surtout de la lanterne de projection.

### Architecture

- Plafond plat de 4,0 m, murs de basalte doublés de plaques de cuivre visibles aux joints (3 bandes de 0,3 m, à 1,0 m,
  2,0 m et 3,0 m de haut : variante `lining: copper` du mur).
- **Porte** : standard 1,40 × 2,80 m (GAL-02 n°2), mur est. Sas lumineux : rideau de cuir derrière la porte (même
  modèle que E3-05).
- **Cage d'isolation** ETU-09 au centre (2,0 × 2,0 × 2,2 m), avec le lecteur à l'intérieur.
- **Mur ouest** : écran de projection de 3 × 2 m à 0,9 m du sol ; lanterne de projection sur trépied à 4,0 m en face.

### Assets spécifiques

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| E2-01 | Lecteur d'étude | 0,8 × 0,5 × 1,0 m | Pupitre de bronze et de bois avec fente de 0,31 × 0,15 m inclinée à 30° (lueur cyan quand la cassette y est), 2 volants de 2 px, lentille de lecture, 3 galvanomètres (cadrans à aiguille). | `props/machines/lever-desk` |
| E2-02 | Lanterne de projection | 0,6 × 0,35 × 0,45 m | Boîtier de laiton avec cheminée, objectif sur soufflet de cuir (plis en tons alternés), lampe à arc visible. Pose sur trépied ETU-01 à 1,2 m ; faisceau en cône translucide. | `props/machines/arc-projector` |
| E2-03 | Écran de toile | 3,0 × 0,1 × 2,0 m | Toile gris-beige jaunie tendue sur un cadre de bronze par 12 œillets (points), taches d'humidité en bas. Peut recevoir l'image projetée (plan du site en lignes ambre qui apparaissent ligne par ligne). | `props/machines/projection-screen` |
| E2-04 | Table de transcription | 1,4 × 0,7 × 0,85 m | Plateau de bois noirci, carnets, plume, encrier, lampe de lecture ARC-06. | `furniture/tables/stone-table` |
| E2-05 | Étagère de tirages | 0,9 × 0,3 × 1,5 m | 5 niveaux, cadres de verre de 0,3 × 0,4 m contenant des tirages (rectangles clairs à traits ambre), étiquettes d'1 px. | `furniture/storage/parts-shelf` |

**Du kit d'étude** : ETU-09 ×1, ETU-04 ×1, ETU-06 ×4 modules, ETU-07 ×4 faisceaux (le passe-câbles de la cage),
ETU-01 ×1, ETU-11 ×1, ETU-13 ×1.

### Artefact

#### E2-A1 — La Cassette-Maître (`props/artifacts/master-cassette`)

Deuxième objet-clé portable. Plus grande que les cassettes du Complexe, mais d'une matière totalement autre : une
ardoise noire d'un monde de pierre fine.

- **Origine et matériaux** : ardoise noire polie, paillettes de mica argenté, filigrane d'argent.
- **Taille** : 0,30 × 0,14 × 0,03 m, angles arrondis (coins coupés en biais).
- **Surface** : paillettes de mica = points d'argent épars ; le plan du site en filigrane = 4 à 6 lignes d'1 px
  argentées (au zoom 4) ; sceau en spirale en relief dans un coin.
- **Pièces d'argent** : 2 ergots latéraux, poignée anneau articulée à une extrémité.
- **Patine** : une écaille manque au coin opposé au sceau, argent noirci aux ergots.
- **Traces d'étude** : étiquette d'inventaire n°2 sur cordelette, 4 électrodes à pince sur la tranche avec leurs fils.
- **Lumière** : tranche cyan constante (1 px émissif). Dans le lecteur, le plan est projeté en ambre sur l'écran,
  ligne par ligne.
- **Dessin** : < 1 000 triangles, 2 draw calls.

---

## Salle d'étude 3 — Le Prisme (9 × 9 × 6 m)

Une chambre noire d'optique : un long banc de rails au centre, un écran blanc au bout, des murs tendus de feutre qui
avalent la lumière. Seule la lampe à arc ambre et ce qu'en fait le Prisme existent : c'est la salle la plus sombre
(`setDarkness` au plus fort), où les faisceaux se lisent le mieux.

### Architecture

- Plafond plat de 6 m, sol de basalte mat noir, murs tendus de panneaux de feutre noir E3-06 jusqu'à 4,0 m.
- **Porte** : standard 1,40 × 2,80 m (GAL-02 n°3), mur est, avec un double rideau de cuir noir (E3-05) pour faire sas.
- **Banc d'optique** au centre sur l'axe nord-sud, écran d'analyse 1,5 m après son extrémité nord.
- **Mur ouest** : tableau de notes et armoire d'étalons.

### Assets spécifiques

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| E3-01 | Banc d'optique | 5,0 × 0,4 × 1,0 m | Rail de laiton en V sur 4 pieds de fonte, graduations en pointillé (un repère tous les 0,25 m), 6 chariots porte-lentille. | `props/machines/optical-bench` |
| E3-02 | Chariot porte-lentille | 0,15 × 0,12 × 0,25 m | Monture de 2 × 4 px, bague noircie. 6 variantes : lentille, fente, diaphragme, filtre, miroir, polariseur (formes et teintes différentes). Fait partie du banc (réglage `carriages`). | `props/machines/optical-bench` |
| E3-03 | Support tournant du Prisme | Ø 0,25 × H 0,3 m | Plateau tournant gradué (pointillé), pince à 3 doigts de laiton, vis micrométrique. Au bout du banc (réglage). | `props/machines/optical-bench` |
| E3-04 | Écran d'analyse | 2,0 × 0,05 × 1,6 m | Toile blanche mate sur cadre mobile, 2 rails au sol, règle de teintes peinte sur le bas (6 cases de couleur). Reçoit le spectre. | `props/machines/projection-screen` |
| E3-05 | Rideau noir | 1,4 × 0,1 × 2,8 m | Cuir noir lourd en plis (tons alternés verticaux), ourlet plombé, anneaux de laiton sur rail. | `props/decor/heavy-curtain` |
| E3-06 | Panneau de feutre | 2,0 × 0,1 × 3,0 m | Feutre noir mat, cadre de bronze, usure plus claire aux angles. | `buildings/structure/wall-panel` |
| E3-07 | Lampe à arc d'étude | Ø 0,3 × 0,5 m | Carter de laiton ventilé (fentes d'1 px), deux charbons visibles, objectif émissif. Sur trépied ETU-01 ; faisceau ambre vers le Prisme. | `props/machines/arc-projector` |

**Du kit d'étude** : ETU-04 ×1, ETU-01 ×2, ETU-07 ×3 faisceaux, ETU-12 ×1, ETU-13 ×1, ETU-14 ×1.

### Artefact

#### E3-A1 — Le Prisme de Phase (`props/artifacts/phase-prism`)

Troisième objet-clé portable. Un cristal venu d'un monde de glace, d'une pureté gênante au milieu d'un matériel de
laiton.

- **Origine et matériaux** : quartz laiteux (#E6EEF2), fils d'argent. Aucun métal ordinaire.
- **Taille** : prisme hexagonal H 0,35 m, Ø 0,12 m (6 × 2 px au zoom 1).
- **Cristal** : 6 faces à tons nets (une face très claire, reflet d'1 px), inclusions = 2 à 3 points blancs, une
  faille interne à mi-hauteur (ligne d'1 px).
- **Armature** : 2 capuchons d'argent (haut et bas), 6 filets d'argent le long des arêtes (au zoom 4), anneau de
  suspension au sommet.
- **Patine** : argent noirci aux capuchons, éclat d'une arête en bas, poussière dans la faille.
- **Traces d'étude** : étiquette d'inventaire n°3, trace de pince à mi-hauteur, trait de craie sur le capuchon bas.
- **Lumière** : le Prisme disperse le faisceau ambre de la lampe à arc en spectre froid, surtout cyan : en pixel art,
  un **éventail de 5 à 6 bandes émissives** translucides (du cyan au violet) qui part du prisme vers l'écran, et des
  bandes colorées sur l'écran. Lumière coupée, il garde un éclat cyan interne qui diminue en 60 s.
- **Dessin** : < 800 triangles pour le cristal et l'armature, + l'éventail (quelques plans), 3 draw calls. Pas de
  réfraction réelle.

---

## Salle d'étude 4 — Le Marteau (10 × 8 × 5 m)

Un banc d'essai de frappe : une enclume de pierre au centre, un bras mécanique qui frappe, des micros et un bac de
sable pour voir les ondes. La salle résonne ; les murs sont capitonnés de bois pour casser l'écho (en pixel art, la
résonance se voit : anneaux de lumière, sable qui dessine des figures).

### Architecture

- Plafond plat de 5,0 m, sol de dalles renforcées de 0,4 m d'épaisseur, murs de basalte couverts de panneaux
  d'absorption E4-04 jusqu'à 3,0 m.
- **Porte** : standard 1,40 × 2,80 m (GAL-02 n°4), mur ouest, depuis la Galerie.
- **Centre** : bloc d'enclume et portique du bras de frappe. **Mur est** : étagère d'étalons, enregistreurs et console.
  **Mur nord** : support d'honneur du Marteau.
- Le sol est marqué de 3 cercles de laiton (rayon 1, 2 et 3 m) autour de l'enclume pour situer les micros.

### Assets spécifiques

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| E4-01 | Bloc d'enclume d'essai | Bloc 0,6 × 0,6 × 0,5 m sur dalle 1,2 × 1,2 × 0,4 m | Acier gris sur dalle de pierre, 8 capteurs piézo (points de quartz clair) sur le pourtour, câbles fins en bouquet. Variante `test-block` de l'enclume. | `props/tools/anvil` |
| E4-02 | Bras de frappe mécanique | Portique 1,6 × 1,0 × 2,4 m | Bras articulé de 1,4 m à contrepoids, pince-poignée qui tient le Marteau, came et ressort (zigzag d'1 px), manivelle Ø 0,3 m. Le bras se lève et frappe (séquence). | `props/machines/strike-arm` |
| E4-03 | Bac de sable vibrant | 2,0 × 2,0 × 0,3 m | Cadre de bois sur 4 pieds, sable noir fin, figures d'ondes (motifs de Chladni) en lignes d'1 px plus claires qui changent à chaque frappe (shader). | `props/machines/sand-table` |
| E4-04 | Panneau d'absorption | 2,0 × 0,2 × 3,0 m | Bois à fentes alternées (lignes sombres d'1 px), cadre de bronze, laine claire visible aux fentes. | `buildings/structure/wall-panel` |
| E4-05 | Microphone à pavillon | Pavillon Ø 0,35 × 0,4 m | Cornet de laiton martelé sur trépied de 1,4 m, câble tressé vers l'enregistreur. | `props/machines/sensor-tripod` |
| E4-06 | Enregistreur à cylindre | 0,5 × 0,35 × 0,4 m | Cylindre de cire (ton brun clair) Ø 0,12 × 0,2 m, stylet, entonnoir de laiton, manivelle. | `props/machines/crank-recorder` |
| E4-07 | Support d'honneur | 0,4 × 0,15 × 0,6 m | Tablier mural de pierre avec 2 crochets de bronze et une plaque d'inventaire n°4. Le Marteau y repose entre les essais. | `props/decor/honor-rack` |

**Du kit d'étude** : ETU-05 ×2, ETU-04 ×1, ETU-06 ×8 modules, ETU-07 ×8 faisceaux, ETU-14 ×1 (diapasons), ETU-01 ×3
(micros).

### Artefact

#### E4-A1 — Le Marteau Résonant (`props/artifacts/resonant-hammer`)

Un outil d'un monde de forge céleste, lourd et déséquilibré à l'œil. Il ressemble à un marteau, mais rien dans sa forme
n'a été pensé pour une main humaine.

- **Origine et matériaux** : fer météoritique noir à motifs de Widmanstätten (treillis argenté = croisillons d'1 px
  sur la tête, au zoom 4), jade vert, os gravé.
- **Taille** : 0,55 m de long (9 px).
- **Tête** : bloc de fer de 0,14 × 0,12 × 0,18 m, face de frappe plane polie (ton clair), panne arrière en pointe.
  3 bagues de jade Ø 0,10 m autour de la tête.
- **Manche** : 3 segments d'os blanc-jaune, vagues gravées (1 px), reliés par des bagues de jade.
- **Pommeau** : sphère de cristal cyan émissive.
- **Lanière** : tendon tressé de 0,35 m, qui pend.
- **Gravures** : cercles concentriques sur le haut de la tête (2 à 3 au zoom 4).
- **Patine** : rouille en bordure (ton brun), os poli, éclat de jade sur une bague.
- **Traces d'étude** : 4 capteurs piézo (points de laiton) avec leurs fils, étiquette d'inventaire n°4.
- **Lumière** : pommeau cyan faible au repos. À la frappe, les bagues de jade s'allument et un anneau cyan se propage
  depuis la tête (anneau émissif qui grandit au sol, synchronisé avec le bac de sable).
- **Dessin** : < 1 500 triangles, 3 draw calls (fer et os, jade, lueur). Tenu par le bras de frappe, posé sur le
  support, ou dans la main de la créature.

---

## Salle d'étude 5 — L'Éveil (12 × 10 × 6 m)

La salle la plus tendue du couloir : une créature de céramique assise dans une cage de barreaux de bronze, câblée de
partout, observée d'en haut par une galerie. On ne sait pas si elle dort ou si elle attend.

### Architecture

- Plafond plat de 6,0 m avec un portique de levage ATE-12 installé au centre, rail de plafond ATE-16.
- **Porte** : standard 1,40 × 2,80 m (GAL-02 n°5), mur ouest, avec voyant rouge permanent.
- **Centre** : l'enceinte de confinement E5-01 (4 × 4 × 3,5 m) autour du banc de maintenance.
- **Mur est** : galerie d'observation à +3,0 m (12 × 1,8 m), escalier droit au nord-est. **Mur sud** : table de
  dissection d'étude et console de télémétrie.

### Assets spécifiques

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| E5-01 | Enceinte de confinement | 4,0 × 4,0 × 3,5 m | Barreaux de bronze d'1 px au pas de 0,12 m (2 px : la grille laisse voir l'Automate), 4 montants de 0,15 m, toit grillagé, porte de 1,2 × 2,2 m à 2 verrous, dalle de sol plus claire avec rainure de câbles. Variante `bars` de la cage. | `props/machines/isolation-cage` |
| E5-02 | Banc de maintenance | 1,2 × 0,6 × 0,45 m | Pierre fumée, 2 anneaux d'attache de bronze, taches d'huile sombres. | `furniture/seating/stone-bench` |
| E5-03 | Harnais et palan d'éveil | Sangles de 0,08 m, chaîne 3,0 m | Sangles de cuir d'1 px avec boucles de laiton passant sous les bras de l'Automate, chaîne du palan ATE-12, crochet. | `props/machines/wake-harness` |
| E5-04 | Échafaudage d'accès | 2,4 × 1,2 × 2,6 m | Tubes de bronze d'1 px, plateforme de planches à 0,9 m, garde-corps de 1,0 m, échelle de 7 barreaux. | `buildings/structure/scaffold` |
| E5-05 | Table de dissection d'étude | 2,0 × 0,8 × 0,9 m | Plateau de pierre à rigoles (lignes d'1 px), tapis de feutre, pièces détachées en céladon : doigt, rotule, plaque. | `furniture/tables/stone-table` |
| E5-06 | Galerie d'observation | 12 × 1,8 m, plancher à +3,0 m | Caillebotis de bronze, garde-corps de 1,0 m, 3 fenêtres GAL-03 vers l'enceinte, escalier droit de 17 marches. | `buildings/structure/grating-walkway` + `buildings/structure/straight-stair` |
| E5-07 | Console de télémétrie | 1,8 × 0,7 × 1,3 m | Version large de ETU-04, 3 tambours enregistreurs, rangée de 12 voyants. | `props/machines/recording-console` |

**Du kit d'étude** : ETU-02 ×8, ETU-01 ×2, ETU-06 ×8 modules, ETU-07 ×6 faisceaux (dont 2 de Ø 0,20 m vers la trappe
dorsale), ETU-13 ×1, ETU-15 (Ø 5,5 m).

### Artefact

#### E5-A1 — L'Automate de l'Artisan (`props/artifacts/artisan-automaton`)

La créature du site, et l'asset le plus complexe de l'ensemble. Elle vient d'un monde de jade et de terre cuite : une
statue articulée, belle, fendue et recollée d'or.

- **Origine et matériaux** : céladon craquelé (#8FB5A0), terre cuite rouge aux articulations, joints en or rose,
  tendons de lin ciré tressé.
- **Taille globale** : 2,10 m debout (34 px), 1,55 m assis (pose de départ), largeur d'épaules 0,80 m.
- **Tête** : 0,32 × 0,26 × 0,30 m. Masque lisse sans visage avec une fente horizontale qui contient un cristal cyan
  (œil de 1 px émissif au zoom 1). Cou en gaine de lin ciré.
- **Torse** : 0,70 × 0,40 × 0,65 m, plaques de céramique emboîtées (joints d'1 px d'or rose), trappe dorsale de
  0,25 × 0,35 m qui montre un mécanisme d'or rose (c'est là que les câbles d'étude se branchent), plaque d'identité
  d'or sur la poitrine.
- **Bras principaux (×2)** : bras 0,55 m, avant-bras 0,50 m, main de 0,22 m (doigts suggérés par 2 à 3 px). Tendons
  de lin d'un ton clair dans les creux.
- **Bras auxiliaires (×2)** : 0,35 m, sous les bras principaux, terminés par une pince de jade, une loupe de cristal,
  un burin d'obsidienne et un pinceau de crin (réglage `tools`).
- **Jambes** : cuisse 0,55 m, tibia 0,55 m, pied de 0,30 × 0,15 m.
- **Articulations** : rotules d'or rose Ø 0,10 m (2 px) aux épaules, coudes, hanches et genoux.
- **Patine** : émail ébréché aux genoux, épaule gauche fendue et recollée à l'or (ligne d'or d'1 px), mains plus
  claires (polies), poussière dans les craquelures (`speckle`).
- **Traces d'étude** : harnais de cuir sous les bras, 14 sondes de laiton (points) avec leurs fils, 2 gros faisceaux
  dans la trappe dorsale, étiquette d'inventaire n°5.
- **États** (réglage `state` + séquence) : éteint (œil noir, mains au repos), éveil (œil cyan, souffle de vapeur par
  le dos en particules pixel, petits tressautements), activité (gestes lents, balayage de l'œil).
- **Dessin** : corps en pièces rigides sur pivots (une quinzaine), animées par le code à 12 images/s ; pas de skinning.
  ≤ 8 000 triangles, ≤ 4 draw calls (céladon et terre cuite, or rose, lin et cuir, lueur). Les animations du
  squelette humanoïde du projet ne s'appliquent pas (4 bras, autres proportions).

---

## Salle d'étude 6 — L'Arbre de Mémoire (Ø 12 × H 10 m)

Une salle ronde et haute faite pour un seul objet : un arbre de pierre dont les fruits de cristal luisent doucement.
Autour, un rail de mesure circulaire, un balcon et des perches d'éclairage. L'ambiance est celle d'une serre morte.

### Architecture

- Cylindre de 6 m de rayon jusqu'à 10 m de haut (murs courbes), plafond plat à caissons (module SAS-04) ; 8 pilastres
  de 0,5 m espacés de 45°.
- **Porte** : grande porte double battant 3 × 5 m au nord-est, depuis le couloir de liaison de la Rotonde.
- **Balcon d'observation** : arc de 300° à +4,0 m, accessible par un escalier à vis. **Rail de mesure** circulaire au
  sol, de Ø 7,0 m, plus petit que la salle.
- Trois perches d'éclairage de 3,5 m plantées dans le sol à 120°.

### Assets spécifiques

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| E6-01 | Socle d'essai | Octogone Ø 3,4 × H 0,5 m | Basalte du Complexe, 2 marches de 0,25 m, anneaux de glyphes émissifs ambre (traits d'1 px) qui s'allument vers l'arbre. | `buildings/structure/trial-dais` |
| E6-02 | Rail de mesure circulaire | Ø 7,0 m, section 0,1 × 0,1 m | Rail de laiton de 2 px incrusté dans le sol, 24 butées (plots), nacelle roulante dessus. | `buildings/structure/brass-floor-ring` |
| E6-03 | Nacelle d'observation | 1,0 × 1,0 × 1,3 m | Siège de cuir, tablette, arceau de bronze à 1,3 m, roulettes, bras avec une sonde. Roule sur le rail (pilotable). | `props/machines/observation-pod` |
| E6-04 | Balcon d'observation | Arc de 300°, largeur 1,0 m, plancher à +4,0 m | Caillebotis de bronze, garde-corps de 1,0 m, consoles de pierre ancrées dans les pilastres. | `buildings/structure/grating-walkway` |
| E6-05 | Escalier à vis du balcon | Ø 2,2 × H 4,0 m | 22 marches de 0,18 m, noyau Ø 0,3 m, garde-corps de laiton. | `buildings/structure/spiral-stair` |
| E6-06 | Cuve à échantillons | Ø 0,25 × H 0,6 m | Verre translucide sur socle de bronze, fruit de cristal émissif dans un liquide clair, étiquette. 4 exemplaires sur une table de 1,2 × 0,6 × 0,9 m. | `furniture/storage/display-case` |
| E6-07 | Sonde d'écoute à tige | Perche de 2,0 m, Ø 0,03 m | Tige de laiton d'1 px avec pavillon d'écoute de 2 px, poignée de cuir. Objet de main. | `props/tools/artisan-tools` |
| E6-08 | Perche d'éclairage | H 3,5 m, projecteur Ø 0,3 m | Mât de bronze sur socle de 0,4 m, projecteur de laiton à volets, câble en spirale (zigzag d'1 px). | `props/machines/arc-projector` |

**Du kit d'étude** : ETU-01 ×4, ETU-04 ×2, ETU-06 ×6 modules, ETU-07 ×8 faisceaux (dont 4 de Ø 0,12 m vers le tronc),
ETU-13 ×1.

### Artefact

#### E6-A1 — L'Arbre de Mémoire (`props/artifacts/memory-tree`)

Il vient d'un monde de forêts pétrifiées : un véritable arbre, devenu pierre, qui porte des fruits de cristal. Chaque
fruit garde un souvenir.

- **Origine et matériaux** : bois silicifié brun-rouge (#6B3F2E) aux veines d'argent (lignes d'1 px claires le long du
  tronc, motif `bark`), fruits de cristal. Pas de bronze, pas de métal travaillé en dehors des pédoncules d'argent.
- **Taille globale** : Ø 3,4 m (étendue des racines) × H 6,7 m (107 px).
- **Racines** : 7 racines de 1,7 m qui rampent sur le socle et s'ancrent dans ses rainures.
- **Tronc** : Ø 0,9 m à la base, Ø 0,4 m au sommet, 6,2 m de haut, cernes en bandes de tons, une fissure verticale de
  1,5 m à mi-hauteur.
- **5 couronnes** : branches entrelacées en anneaux de Ø 3,0 / 2,6 / 2,2 / 1,8 / 1,4 m, section 0,20 m (3 px), à
  1,5 / 2,5 / 3,5 / 4,5 / 5,5 m du sol. 6 branches maîtresses relient chaque couronne au tronc.
- **180 fruits de mémoire** : ovoïdes de cristal de 0,16 × 0,10 m (3 × 2 px) suspendus par un pédoncule d'argent,
  36 par couronne. 3 formes, 4 teintes de lueur ; tous dans un même `InstancedMesh` (1 draw call), teinte par instance.
- **Sommet** : bouquet de 8 branches fines avec un fruit cyan plus gros (3 px).
- **Patine** : écorce minéralisée écaillée (taches claires), 9 fruits ternis (éteints), 3 pédoncules coupés.
- **Traces d'étude** : 6 colliers de cuir autour du tronc d'où partent des faisceaux, 12 sondes plantées dans l'écorce
  (traits de laiton d'1 px), étiquettes sur 24 fruits (points), étiquette d'inventaire n°6.
- **Animation** : couronnes qui tournent lentement (1,5 tr/min, sens alternés), impulsion cyan qui monte dans le tronc
  toutes les 6 s (bande émissive en shader), fruits « lus » qui passent du blanc-bleu au cyan.
- **Dessin** : socle, tronc, 5 couronnes (rotation en shader par couronne, ou 5 meshes), fruits instanciés.
  ≤ 8 000 triangles, ≤ 6 draw calls.

---

## Salle d'étude 7 — Le Cœur (Ø 14 m × H 12 m)

La salle d'étude du Cœur : un noyau d'énergie venu d'un autre monde flotte dans sa cage d'anneaux, au-dessus d'une
fosse, relié par des câbles et des tuyaux du Complexe qui en captent l'énergie. C'est la seule pièce dominante en cyan
(sa lumière de halo cyan est la plus forte du Complexe) ; l'ambre y est réduit aux lampes de service.

### Architecture

- Mur circulaire de basalte rythmé par 12 pilastres (0,6 m de large × 0,4 m de saillie), dôme plein sans ouverture
  (masqué en vue en coupe), avec en son centre un conduit d'évacuation noir de Ø 3 m.
- **Fosse centrale** : Ø 6 m, profondeur 3 m, entourée du garde-corps COE-03. Le sol plein s'étend de la fosse aux
  murs.
- **Passerelle annulaire** à +4,0 m (rayon 4,5 à 6,0 m), accessible par un escalier à vis. Elle permet de voir le noyau
  de près.
- **Entrée sud** : grande porte double battant 3 × 5 m depuis le couloir de liaison de la Rotonde. **Sortie nord** :
  issue de secours de 1,4 × 2,8 m vers un escalier de service.

### Assets normaux

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| COE-01 | Passerelle annulaire haute | Largeur 1,5 m, rayon int. 4,5 m, plancher à +4,0 m | Caillebotis de bronze, garde-corps de 1,0 m à double lisse, consoles de pierre tous les 1,5 m. Développement ≈ 300°. | `buildings/structure/grating-walkway` |
| COE-02 | Escalier à vis d'accès | Ø 2,2 × H 4,0 m | 22 marches de 0,18 m, noyau Ø 0,3 m, garde-corps de laiton à 1,0 m. | `buildings/structure/spiral-stair` |
| COE-03 | Garde-corps de fosse | Ø 6,4 m, H 1,0 m | 16 segments de 1,25 m, poteaux de bronze d'1 px, lisse de laiton, chaîne lourde au milieu (pointillé). | `buildings/structure/bronze-railing` |
| COE-04 | Pupitre de contrôle principal | Arc de 3,0 × 1,0 × 1,15 m | Plan incliné à 25°, 30 cadrans (points de 1 à 2 px dont les aiguilles bougent), 12 leviers, 6 interrupteurs, 3 écrans de verre bombé (4 × 3 px) à phosphore ambre. | `props/machines/recording-console` |
| COE-05 | Siège d'opérateur | 0,55 × 0,55 × 0,95 m | Fauteuil pivotant, assise de cuir à 0,45 m, dossier bas, piètement de fonte à 4 branches sur roulettes. | `furniture/seating/operator-chair` |
| COE-06 | Cuve de refroidissement | Ø 1,4 × H 3,0 m | Cylindre de verre épais translucide dans une cage de bronze, liquide vert-bleu en paliers, bulles (points clairs) qui montent. 4 cuves à 90° contre le mur. | `props/machines/cooling-tank` |
| COE-07 | Tuyau géant | Ø 0,8 m, modules de 2,0 m | Cuivre et laiton, brides (anneaux de 2 px avec boulons en points), coudes de rayon 0,9 m, raccords en T. Relie les cuves au conduit du plafond. | `props/machines/copper-pipe` |
| COE-08 | Valve géante à roue | Roue Ø 0,9 m, corps 0,7 × 0,5 × 0,8 m | Roue à 6 rayons, jante de bronze, tige filetée visible, plaque numérotée. | `props/machines/wheel-valve` |
| COE-09 | Jauge murale | Ø 0,7 × 0,15 m | Verre bombé, aiguille d'1 px qui bouge, 3 zones (ambre, cyan, rouge), cerclage de bronze. 4 variantes de graduation. | `props/machines/wall-gauge` |
| COE-10 | Armoire à fusibles | 0,8 × 0,3 × 1,8 m | 24 fusibles de porcelaine (2 × 1 px clairs), porte grillagée, levier de coupure. Variante du casier. | `furniture/storage/equipment-locker` |
| COE-11 | Colonne isolante | Ø 0,4 × H 1,4 m | 12 disques de porcelaine brun-vert empilés (bandes de 1 px, tons alternés), tige de laiton, collier de bronze. | `props/machines/insulator-column` |
| COE-12 | Caillebotis de sol | 2,0 × 2,0 × 0,06 m | Grille de bronze (quadrillage d'1 px), module droit et module courbe pour l'anneau. | `buildings/structure/vent-grate` |
| COE-13 | Ventilateur extracteur | Ø 2,0 × 0,5 m | Cage de bronze, 6 pales de 0,8 m, moteur à bobine. Rotation lente (20 tr/min). | `props/machines/extractor-fan` |
| COE-14 | Câble principal | Ø 0,25 m, longueurs 2 à 6 m | Tube de 4 px en tissu goudronné, colliers de bronze tous les 0,6 m, manchons aux raccords. | `props/machines/braided-cable` |
| COE-15 | Barrière et plaque d'avertissement | H 1,0 m + plaque 0,3 × 0,2 m | Barrière de bronze à bandes ambre usées, plaque de laiton avec glyphe rouge. | `buildings/structure/bronze-railing` + `props/decor/glyph-plaque` |
| (fosse) | Fosse du Cœur | Ø 6 m, profondeur 3 m | Puits de basalte, fond à grille, vapeur légère en particules qui monte, bassin sombre qui reflète le cyan (taches mouvantes). | `buildings/structure/energy-pit` |

### Artefact

#### E7-A1 — Le Cœur (`props/artifacts/the-heart`)

Artefact venu d'un monde de pierre noire et d'or : un noyau d'énergie suspendu dans une cage d'anneaux gyroscopiques,
ancien mais sans rien de commun avec le bronze du Complexe.

- **Origine** : monde de pierre noire. Obsidienne polie (#0E1014) à filigrane d'or, noyau de cristal. Aucune soudure,
  aucun rivet : les anneaux semblent taillés d'un seul bloc.
- **Taille globale** : Ø 5,2 m (anneau le plus large). Centre à 5,0 m du sol, donc bas à 2,4 m et haut à 7,6 m.
- **Noyau** : sphère de cristal Ø 1,2 m (19 px), intérieur cyan émissif avec filaments (lignes claires animées en
  shader), éclairs internes.
- **Cage sphérique** : Ø 2,4 m, obsidienne à claire-voie (12 méridiens, 3 parallèles, de 1 px), nœuds d'or aux
  intersections (points).
- **3 anneaux gyroscopiques** : Ø 3,6 / 4,4 / 5,2 m, section Ø 0,18 m (3 px), axes inclinés de 60°. Rotation à
  1 / 1,7 / 2,5 tr/min. Filet d'or en spirale (ligne d'1 px) et 4 cartouches gravées en courbes.
- **Suspension** : 6 tiges d'obsidienne Ø 0,10 m partant du dôme et des pilastres. Les manchons de bronze aux
  fixations sont des ajouts du Complexe.
- **Fosse** : voir `energy-pit` ci-dessus.
- **Instruments d'étude** : 6 sondes sur la passerelle tournées vers le noyau ; 3 faisceaux de Ø 0,25 m (COE-14) qui
  descendent vers le pupitre COE-04 ; 12 jauges COE-09 dont les aiguilles suivent le rythme du noyau ; 2 caméras à
  soufflet sur trépieds (tête `camera` du trépied).
- **États** (réglage `state` + séquence) : stable (rotation lente, lumière régulière), surcharge (rotation ×2, lumière
  rouge, arcs plus longs), arrêt (anneaux qui ralentissent, noyau qui s'éteint).
- **Lumière** : cyan intense, scintillement à 4 Hz (par paliers), taches de lumière mouvantes sur les murs (fausses
  caustiques), arcs électriques entre noyau et cage (4 tracés en zigzag d'1 px qui alternent toutes les 0,2 s).
- **Dessin** : noyau, cage, 3 anneaux (pivots séparés), arcs. ≤ 8 000 triangles, ≤ 6 draw calls.

---

## Salle d'étude 8 — L'Oracle (Ø 20 m × H 14 m)

La salle d'étude la plus monumentale : un amphithéâtre circulaire dont tout converge vers une tour de calcul venue d'un
autre monde, sous un dôme nu. Calme, solennelle, presque silencieuse ; l'ambre des vasques en bas, le cyan de l'Oracle
au centre.

### Architecture

- **Murs** : cylindre de 10 m de rayon jusqu'à 8 m de haut, puis dôme de 6 m de flèche jusqu'à 14 m (masqué en vue
  en coupe). 12 demi-colonnes engagées, 8 panneaux de bas-relief entre elles.
- **Entrée** : grande porte double battant 3 × 5 m au sud (couloir de liaison depuis la Rotonde), qui donne sur une
  allée processionnelle de 2,4 × 7 m.
- **Périphérie** : trois niveaux de gradins (de 7,3 à 10 m de rayon) interrompus par la porte.
- **Centre** : plateforme de Ø 6 m, surhaussée de 0,6 m, qui porte l'Oracle et les trois pupitres du Triptyque.

### Assets normaux

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| ORA-01 | Dalle de sol annulaire | Anneau de 0,9 m de large, épaisseur 0,25 m | 9 anneaux concentriques (rayons 3 à 10 m) découpés en secteurs de 15°. Glyphes radiaux émissifs ambre (traits d'1 px), joints de bronze d'1 px. Variante usée. | `buildings/structure/rotunda-floor` |
| ORA-02 | Plateforme centrale | Ø 6,0 × H 0,6 m | Disque de basalte, bordure de bronze de 2 px, 3 rainures radiales vers les pupitres (lueur cyan quand un verrou est réussi), 2 marches de 0,3 m. | `buildings/structure/trial-dais` |
| ORA-03 | Allée processionnelle | 2,4 × 7,0 m | 8 dalles de 2,4 × 0,875 m à lignes de glyphes, rainure cyan d'1 px sur chaque bord. | `buildings/structure/processional-path` |
| ORA-04 | Vasque-brûleur | Ø 0,5 × H 1,5 m | Pied de bronze à 3 pattes, coupe avec flamme ambre (flamme pixel animée à 12 images/s et étincelles), grille. 6 le long de l'allée, 6 sur les gradins. | `furniture/lighting/brazier` |
| ORA-05 | Gradin circulaire | 3 niveaux de 0,45 m (H) × 0,9 m (profondeur) | Pierre fumée, arêtes usées, couloirs d'accès de 1,2 m tous les 30°. Modules d'arc de 15°. | `buildings/structure/circular-tiers` |
| ORA-06 | Demi-colonne engagée | Ø 0,9 × H 10,0 m | 20 cannelures (tons par facette), chapiteau en anneau de glyphes, rainure verticale d'1 px avec fibre cyan, bagues de bronze à 3,0 et 7,0 m. | `buildings/structure/glyph-column` |
| ORA-07 | Grande porte double battant | 3,0 × 0,5 × 5,0 m | 2 battants de bronze de 1,5 × 5 m, panneaux en relief, 5 charnières apparentes par battant, 6 verrous, poignées-anneaux Ø 0,35 m. S'ouvre (pilotable). | `buildings/structure/complex-door` |
| ORA-08 | Panneau de bas-relief | 3,0 × 0,15 × 4,0 m | Pierre sculptée de scènes de construction en reliefs simples (silhouettes de 8 à 20 px, tirées de la graine), fils ambre émissifs d'1 px qui soulignent les lignes de la composition. 8 panneaux. | `buildings/structure/wall-panel` |
| ORA-09 | Cloche de résonance | Cloche Ø 0,6 × 0,7 m, portique 0,9 × 0,3 × 1,2 m | Bronze, battant de cristal, portique de pierre à deux montants. Balance quand on la frappe (pilotable). | `props/machines/resonance-bell` |
| ORA-10 | Banc de méditation | 1,6 × 0,45 × 0,40 m | Pierre, coussin de cuir noir, patins de bronze. | `furniture/seating/stone-bench` |
| ORA-11 | Câble ombilical | Ø 0,18 m, longueurs 3 à 8 m | Tube de 3 px en tissu goudronné, manchons de laiton tous les 0,8 m. 3 câbles au sol dans les rainures de la plateforme. | `props/machines/braided-cable` |
| ORA-12 | Plaque de dédicace | 1,0 × 0,6 × 0,03 m | Bronze avec lignes de glyphes en creux, scellée au pied de l'Oracle. | `props/decor/glyph-plaque` |
| ORA-13 | Anneau lumineux de voûte | Ø 1,6 × 0,5 m + chaîne 4 m | 12 ampoules émissives sur un cercle de bronze, chaîne en pointillé. 3 anneaux sous le dôme. | `furniture/lighting/filament-chandelier` |

### Artefact

#### E8-A1 — L'Oracle, la Tour de Calcul (`props/artifacts/oracle`)

Artefact venu d'un monde de pierre rouge : une pile de disques massifs qui calculent, surmontée d'un œil d'obsidienne.
C'est l'objet central de tout le Complexe.

- **Origine** : monde de pierre rouge. Disques de jaspe rouge veiné (`furrow`) et de granit sombre, glyphes incrustés
  d'or pâle (alphabet de courbes), œil d'obsidienne. Pas de bronze.
- **Taille globale** : base Ø 3,0 m, H 6,0 m depuis la plateforme (sommet à 6,6 m du sol).
- **Piédestal** : Ø 3,0 × H 0,5 m, granit, 3 fentes de réception à 120° où arrivent les câbles ombilicaux (ORA-11).
- **Axe central** : tige de jaspe noir Ø 0,4 m qui traverse toute la pile.
- **9 disques de calcul** : Ø 3,0 / 2,8 / 2,6 / 2,4 / 2,1 / 1,8 / 1,5 / 1,2 / 1,0 m, épaisseur 0,25 m (4 px),
  espacés de 0,25 m. Chaque disque porte 3 rangées de glyphes dorés (0,1 m = 2 px : arcs et points) et une fente
  lumineuse d'1 px. Ils tournent à des vitesses et dans des sens différents (rotation par disque en vertex shader :
  un indice de disque par sommet, un seul draw call). Le 5e disque est fissuré, réparé par des agrafes de bronze du
  Complexe (3 traits).
- **Collier** : bague d'or pâle de 0,25 m sous l'Œil.
- **Œil** : sphère d'obsidienne Ø 0,9 m, paupière en iris de 8 lamelles de jaspe, pupille cyan Ø 0,3 m (5 px).
- **Instruments d'étude** : 4 cornets ETU-03 sur trépieds autour de la plateforme, 3 sondes devant les verrous, câbles
  ombilicaux ORA-11.
- **États** (réglage `state` + séquence pilotée par le Triptyque) : dormant (disques à l'arrêt, œil fermé), éveil
  (disques qui démarrent en cascade du bas vers le haut, glyphes qui passent au cyan, œil qui s'ouvre), réponse
  (faisceau cyan vertical de l'Œil jusqu'au sommet du dôme).
- **Dessin** : piédestal et axe, disques (1 mesh, rotation en shader), œil et lamelles, faisceau. ≤ 8 000 triangles,
  ≤ 5 draw calls.

### Asset héros

#### ORA-14 — Le Triptyque des Verrous (`props/machines/lock-triptych`)

Asset héros du Complexe (pas un artefact) : trois pupitres construits par les chercheurs autour de l'Oracle, où
s'insèrent les trois objets-clés des salles d'étude 1, 2 et 3.

- **Taille de chaque pupitre** : 0,7 × 0,6 × 1,1 m, placés à 120° sur la plateforme, à 2,2 m de l'axe, face à
  l'Oracle (réglage `lock` : 1, 2, 3 ; le monde pose les trois).
- **Structure** : colonne de pierre, tête de bronze inclinée (0,7 × 0,5 × 0,15 m), 12 voyants ambre d'1 px en ligne,
  câble ombilical qui descend vers la base de l'Oracle.
- **Verrou 1 — Clef-Disque** : cavité circulaire Ø 0,29 m avec pivot central.
- **Verrou 2 — Cassette-Maître** : fente de 0,31 × 0,15 m sur plan incliné.
- **Verrou 3 — Prisme de Phase** : réceptacle hexagonal de Ø 0,13 m.
- **Animation** : à chaque insertion, les 12 voyants s'allument en cascade et une pulsation cyan monte le long du câble.
  Trois verrous réussis déclenchent l'éveil de l'Oracle (`group.userData` : `insert(n)`, événement partagé avec
  l'Oracle, comme la console et la Porte des étoiles existantes).
- **Dessin** : < 2 500 triangles par pupitre, ≤ 3 draw calls.

---

## Salle d'étude 9 — L'Orrery (Ø 16 × H 14 m)

Un dôme vide sous lequel flottent des anneaux fins, au-dessus d'un bassin noir qui les reflète. Le plafond est le
décor ; en bas, des instruments d'astronome ancien visent le zénith. Calme, silencieux, presque vertigineux. En vue en
coupe, le dôme est masqué mais l'Orrery, lui, reste visible : c'est l'objet que la caméra regarde.

### Architecture

- Cylindre de 8 m de rayon jusqu'à 7 m de haut, puis dôme de 7 m de flèche jusqu'à 14 m. À 11,2 m de hauteur, le
  rayon libre du dôme est de 6,1 m : les anneaux de l'Orrery ont été dimensionnés pour passer.
- **Porte** : grande porte double battant 3 × 5 m au sud-ouest, depuis le couloir de liaison de la Rotonde.
- **Centre** : bassin-miroir de Ø 6 m. **Périphérie** : cercle méridien gravé dans le sol (Ø 12 m), console
  d'observation et treuil au mur est, lunette zénithale à 4 m du bord du bassin.
- Rail de coupole à 6,5 m de haut qui porte la nacelle de maintenance.

### Assets spécifiques

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| E9-01 | Bassin-miroir | Ø 6,0 m, profondeur 0,4 m | Margelle de basalte de 0,3 m, liquide noir immobile : surface sombre translucide sous laquelle on voit l'Orrery « reflété » (copie inversée, assombrie, en paliers), voile de poussière (points clairs). | `buildings/structure/mirror-basin` |
| E9-02 | Lunette zénithale | Tube Ø 0,30 × 2,4 m, pilier 1,2 m | Tube de laiton vertical sur un pilier de pierre, oculaire d'acier, contrepoids de bronze. | `props/machines/zenith-telescope` |
| E9-03 | Théodolite géant | 0,8 × 0,8 × 1,8 m | Cercles gradués de Ø 0,6 m et 0,5 m (pointillé), lunette de 0,8 m, trépied de fonte. Variante `theodolite`. | `props/machines/zenith-telescope` |
| E9-04 | Cercle méridien | Ø 12,0 m, section 0,04 m | Lignes de laiton d'1 px incrustées dans le sol : méridien, 4 parallèles, repères tous les 10°. | `buildings/structure/brass-floor-ring` |
| E9-05 | Nacelle de maintenance suspendue | 1,2 × 0,8 × 1,2 m | Cage de bronze à plancher, 4 câbles de levage d'1 px, montée par un treuil et un rail de coupole. Variante `hanging`. | `props/machines/observation-pod` |
| E9-06 | Treuil à manivelle | 0,9 × 0,6 × 0,9 m | Tambour Ø 0,35 m, chaîne enroulée (pointillé), manivelle, cliquet, fixé au mur. | `props/machines/winch` |
| E9-07 | Console d'observation | 1,6 × 0,8 × 1,2 m | Cadrans angulaires, carnets de relevés, 2 lampes de lecture ARC-06. | `props/machines/recording-console` |

**Du kit d'étude** : ETU-04 ×1, ETU-07 ×8 faisceaux (4 de Ø 0,12 m qui montent vers les suspensions), ETU-13 ×1,
ETU-01 ×2. Réutilise ORA-13 (×3) pour l'éclairage du dôme.

### Artefact

#### E9-A1 — L'Orrery du Dôme (`props/artifacts/dome-orrery`)

Le ciel d'un autre monde, réduit à des anneaux fins et à quelques sphères précieuses. Il tourne sans cesse, sans que
personne sache ce qu'il mesure.

- **Origine et matériaux** : argent noirci (#2A2D33) à graduations d'or, lapis-lazuli, jade, jaspe, œil-de-tigre,
  nacre, obsidienne, cristal blanc, ambre fossile. Chaque pierre a sa rampe de 3 à 4 tons.
- **Position** : centre à 9,5 m du sol. Ensemble de Ø 10 m.
- **4 anneaux** : Ø 4 / 6 / 8 / 10 m, section 0,14 × 0,20 m (2 × 3 px), inclinés de 0° / 10° / 15° / 20°, rotation
  à 0,5 à 3 tr/min. Graduations d'or en pointillé (tous les 10°), constellations gravées sur la face intérieure
  (points et arcs d'1 px).
- **7 astres** : sphères de Ø 0,4 à 0,8 m (6 à 13 px), une matière par astre (lapis-lazuli, jade, jaspe, œil-de-tigre,
  nacre, obsidienne, cristal blanc), fixées sur les anneaux par des bras d'argent.
- **Soleil central** : sphère d'ambre fossile Ø 1,0 m avec inclusions (silhouettes sombres de feuille et d'insecte de
  2 à 3 px), toujours allumée d'une lueur chaude de l'intérieur (lumière de halo ambre).
- **Suspension** : 4 tiges d'argent noirci partant du sommet du dôme (longueur 4,5 m).
- **Patine** : argent noirci aux jointures, 2 graduations effacées, le plus petit astre ébréché.
- **Traces d'étude** : 4 câbles de contrôle (du Complexe) entre les anneaux et le dôme, 8 capteurs d'inclinaison
  (boîtiers de laiton de 2 px) avec leurs fils, étiquette d'inventaire n°9.
- **Lumière** : le Soleil éclaire les anneaux en ambre chaud, les astres se reflètent dans le bassin-miroir.
- **Dessin** : 4 anneaux (pivots séparés ou rotation en shader), astres et Soleil. ≤ 8 000 triangles, ≤ 6 draw calls.

---

## Salle d'étude 10 — La Porte des Étoiles (26 × 18 × 14 m)

La plus grande salle du site : une nef dont tout le fond est occupé par une arche d'albâtre blanc, entourée d'un
portique de mesure et surveillée depuis une cabine suspendue. C'est la pièce où l'échelle humaine se perd : l'arche et
les instruments dominent, la créature semble petite. On y regarde au zoom 0,5 (8 px/m) : silhouettes fortes, détails
portés par la lumière.

### Architecture

- Nef de 26 m (nord-sud) × 18 m (est-ouest), voûte en berceau de 14 m au faîte (masquée en vue en coupe), murs de
  basalte à 12 demi-colonnes comme l'Oracle (même module ORA-06 ramené à H 8 m).
- **Entrée** : grande porte double battant 3 × 5 m au sud, depuis le couloir de liaison de la Rotonde.
- **Arche** : plaquée contre le mur nord, plan de l'arche à 3,0 m du mur. **Cercle d'Alignement** : centre à 11,0 m
  en avant de l'arche.
- **Cabine de contrôle** : mur est, plancher à +3,5 m. **Pont roulant** sur rails à 10 m de haut, d'un mur à l'autre.
- Sol de dalles de basalte de 2 × 2 m, 3 chemins de câbles ETU-06 qui vont du socle de l'arche à la cabine.

### Assets spécifiques du Complexe

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| E10-01 | Socle de l'arche | 7,0 × 2,4 × 0,9 m | Basalte du Complexe, cales de bronze, encoches pour 3 faisceaux, bande basse de l'arche enchâssée dedans. Variante `rect` du socle. | `buildings/structure/trial-dais` |
| E10-02 | Rampe d'accès | 3,0 × 6,0 m, montée 0,9 m | Dalles rainurées en pente de 8,5°, bordures de 0,2 m, ganses de chaque côté (ETU-15). Variante `ramp` de l'allée. | `buildings/structure/processional-path` |
| E10-03 | Portique de mesure | 8,0 × 1,0 × 7,0 m | Poutres de bronze carrées de 0,25 m (4 px), rails coulissants, 24 sondes sur bras de 0,6 m pointées vers l'ouverture (lentilles d'1 px émissives). Placé à 2,0 m devant l'arche, autour de la rampe. | `props/machines/measuring-frame` |
| E10-04 | Cabine de contrôle | 6,0 × 4,0 × 3,0 m, plancher à +3,5 m | Pierre et bronze sur 4 consoles ancrées, fenêtre intérieure de 4,0 × 1,5 m (lueur ambre des consoles derrière), 3 consoles ETU-04, porte de 1,0 × 2,2 m, escalier droit de 20 marches. Toit masquable en vue en coupe. | `buildings/structure/control-cabin` |
| E10-05 | Pont roulant | 17,4 × 1,2 × 1,5 m, sur rails à 10 m | Poutre de bronze à rivets en points, chariot à palan, chaîne de 5 m, crochet, rails de laiton le long des murs. Variante `crane` du portique. | `props/machines/hoist-gantry` |
| E10-06 | Projecteur d'étude sur mât | Mât H 3,0 m, tête Ø 0,5 m | Variante haute de ETU-11 sur trépied lesté, 6 exemplaires pour éclairer l'arche sans la toucher (cônes de lumière translucides). | `props/machines/arc-projector` |

**Du kit d'étude** : ETU-04 ×3, ETU-06 ×20 modules, ETU-07 ×6 faisceaux (dont 3 de Ø 0,25 m, longueur 20 m), ETU-01
×4, ETU-13 ×2, ETU-15 (périmètre Ø 7 m autour du cercle).

### Artefact

#### E10-A1 — La Porte des Étoiles : arche, stèles et cercle d'alignement

Une arche d'un monde de marbre blanc. L'ensemble se compose de trois parties : l'arche, six stèles de coordonnées, et
le cercle d'alignement dans le sol. Quand les stèles sont alignées, l'ouverture de l'arche se remplit d'une surface
liquide qui mène ailleurs : c'est le passage du Complexe vers les autres mondes du projet.

- **Origine et matériaux** : albâtre blanc veiné de gris (#D8D3C8, veines en `furrow`), joints d'or pâle, pierres-étoiles
  de couleur. Pas de bronze. Gravures en alphabet de courbes.

**L'arche** (`props/artifacts/hex-star-gate`)

- **Forme** : hexagone régulier, côté 3,2 m ; hauteur 5,54 m (entre côtés plats), largeur 6,4 m (entre sommets),
  profondeur 1,2 m. Un côté plat en bas, un en haut.
- **Cadre** : 6 blocs d'albâtre en onglet, bande de 0,9 m de large, joints d'or d'1 px. La bande basse est enchâssée
  dans le socle.
- **Ouverture** : hexagone de côté 2,16 m, soit 3,74 m de haut × 4,32 m de large, seuil au niveau du dessus du socle.
- **Constellations** : sur la face intérieure de chaque bloc (le chant de 1,2 m), une constellation en filets d'or
  d'1 px avec 8 pierres-étoiles (cabochons de 1 à 2 px), soit 48 pierres. Une essence par côté : opale, saphir pâle,
  topaze, béryl, améthyste, grenat (une rampe chacune).
- **Patine** : albâtre jauni en bas, poussière dans les gravures, fissure dans le bloc haut-droit comblée de mastic
  gris du Complexe (ligne d'1 px grise), 5 pierres ternies, une loge vide.
- **Surface** (réglage `state` + séquence) : dormante (rien, on voit le mur derrière) ; chargement (les pierres-étoiles
  s'allument côté après côté toutes les 0,5 s, un voile de brume blanche tramée monte dans l'ouverture) ; ouverte
  (membrane de liquide-miroir sombre bordée de cyan, ondulations radiales en paliers depuis le centre) ; fermeture
  (elle s'efface du centre vers les bords). La membrane reprend l'idée du vortex de `props/magic/star-portal` (onde de
  passage quand la créature traverse).
- **Dessin** : cadre et pierres ≤ 6 000 triangles, membrane en shader, ≤ 4 draw calls.

**Les 6 stèles de coordonnées** (`props/artifacts/coordinate-stele`)

- **Taille** : 0,5 × 0,5 × 1,6 m, albâtre, placées en hexagone de rayon 2,6 m autour du cercle.
- **Cylindre rotatif** : Ø 0,30 × 0,8 m, or pâle, incrusté dans la face avant, 8 symboles d'étoiles en relief
  (3 × 3 px), rotation par crans de 45°.
- **Lumière** : le symbole choisi s'allume en blanc ; quand une stèle est alignée, une rainure s'allume vers le cercle.
- **Dessin** : < 800 triangles, 2 draw calls ; le monde en pose 6 (graine = symbole).

**Le cercle d'alignement** (`props/artifacts/alignment-circle`)

- **Taille** : Ø 4,0 m × 0,15 m, albâtre encastré dans le sol de basalte.
- **Décor** : carte du ciel en filets d'or d'1 px (points et arcs), 6 rainures radiales vers les stèles (qui s'allument
  une à une), cabochon central cyan Ø 0,30 m (5 px).
- **Dessin** : < 1 500 triangles, 2 draw calls.

**Ensemble**

- **Traces d'étude** : portique de mesure et ses 24 sondes pointant l'ouverture, 3 faisceaux de Ø 0,25 m qui sortent du
  socle, marquage de laiton au sol autour des stèles, étiquettes d'inventaire (n°10) sur chaque bloc.
- **Lumière** : blanc-or pour l'arche et les stèles, cyan pour l'ouverture. Ouverte, une pulsation lente (0,2 Hz)
  éclaire toute la nef (lumière de halo cyan), avec des reflets mobiles sur le sol et les colonnes.
- **Séquence commune** : stèles, cercle et arche partagent une horloge (comme `kit/portal.js` pour la Porte des étoiles
  existante) : alignement des 6 stèles → rainures → chargement → ouverture.

---

## Récapitulatif de production

L'ensemble compte 160 fiches d'assets normaux (dont 15 instruments d'étude partagés) et 10 artefacts. En pixel art,
beaucoup de fiches voisines (lampes, escaliers, portes, câbles, consoles, bancs) partagent un module avec un réglage :
**100 modules** au total (`PLAN.md`). Les artefacts sont les seuls objets qui sortent du style du Complexe :
chacun a son propre jeu de rampes de couleurs.

### Les 10 artefacts

| ID | Artefact | Monde d'origine | Taille | Salle | Budget pixel art |
|---|---|---|---|---|---|
| E1-A1 | Clef-Disque | Sel et ivoire | Ø 0,28 × 0,04 m | 1 | < 1 500 triangles |
| E2-A1 | Cassette-Maître | Ardoise | 0,30 × 0,14 × 0,03 m | 2 | < 1 000 triangles |
| E3-A1 | Prisme de Phase | Glace | H 0,35 × Ø 0,12 m | 3 | < 800 triangles + éventail |
| E4-A1 | Marteau Résonant | Forge céleste | 0,55 m | 4 | < 1 500 triangles |
| E5-A1 | Automate de l'Artisan | Jade et terre cuite | 2,10 m debout | 5 | ≤ 8 000 triangles |
| E6-A1 | Arbre de Mémoire | Forêts pétrifiées | Ø 3,4 × H 6,7 m | 6 | ≤ 8 000 triangles |
| E7-A1 | Le Cœur | Pierre noire | Ø 5,2 m, centre à 5,0 m | 7 | ≤ 8 000 triangles |
| E8-A1 | L'Oracle | Pierre rouge | Ø 3,0 × H 6,0 m | 8 | ≤ 8 000 triangles |
| E9-A1 | Orrery du Dôme | Ciel nocturne | Anneaux Ø 4 à 10 m, centre à 9,5 m | 9 | ≤ 8 000 triangles |
| E10-A1 | Porte des Étoiles | Marbre blanc | Arche 6,4 × 5,54 × 1,2 m, stèles 0,5 × 0,5 × 1,6 m, cercle Ø 4 m | 10 | ≤ 6 000 + 6 × 800 + 1 500 triangles |

### Assets héros du Complexe (non artefacts)

Trois assets du Complexe dépassent le budget d'un asset normal sans être des artefacts : la Porte-Iris (SAS-17), le
meuble-catalogue (ARC-17) et le Triptyque des Verrous (ORA-14). Ils restent dans le style du Complexe (bronze, basalte,
ambre).

### Ordre de production

L'ordre conseillé par la bible HD (kit modulaire, matériaux partagés, kit d'étude, briques techniques, pièces, salles,
artefacts, test d'échelle) est gardé dans l'esprit, mais découpé en lots de 4 à 5 assets **qui finissent chacun par
quelque chose de visible** : une pièce s'assemble dès que ses assets existent. Le détail est dans `PLAN.md`.

- **Matériaux partagés du Complexe** (lot 0) : basalte, pierre fumée, bronze patiné, laiton noirci, cuivre oxydé,
  fonte, verre, cuir, feutre, bois noirci ; lueurs ambre, cyan, rouge. Un seul jeu de rampes pour toutes les pièces.
- **Briques techniques communes** (lot 0, `src/assets/kit/`) : bande de glyphes, cadran, levier, ampoule à filament,
  câble tressé, rivets en pointillé, bague, chaîne.
- **Kit modulaire** puis **pièces du Complexe** 1 à 4, chacune assemblée dans le monde dès qu'elle est complète.
- **Kit d'étude** ETU-01 à ETU-15, avant les salles.
- **Salles d'étude** 1 à 10, **chacune avec son artefact** (pour que chaque salle finisse complète et racontée).
- **Test d'échelle** à chaque pièce : le mannequin de 1,80 m, les portes (1,40 × 2,80 m et 3,0 × 5,0 m), les marches
  (0,18 m), les hauteurs de commandes (1,10 à 1,30 m), le dégagement des anneaux de l'Orrery et du Cœur.

### Textures

Aucune. Ce qui tenait lieu d'atlas « pierre », de trim sheet « métal » et d'atlas « technique » dans la bible HD
devient : les rampes de `kit/palettes.js`, les motifs procéduraux du matériau toon, et les briques du kit (cadrans,
plaques, glyphes, étiquettes) partagées par toutes les pièces. Chaque monde d'origine d'artefact a ses rampes à lui,
jamais réutilisées d'un artefact à l'autre ; les parties lumineuses passent par `emissive`.
