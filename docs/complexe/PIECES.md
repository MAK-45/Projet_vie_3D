# Le Complexe : les quatre pièces et le kit d'étude

Suite de `README.md` (direction artistique, traduction HD → pixel art, budgets). Les mesures sont réelles, en mètres.
La colonne « À dessiner » dit ce qui se voit **en pixels** (1 px = 6,25 cm au zoom 1) ; la colonne « Module » donne
l'asset du projet qui porte la fiche (plusieurs fiches proches partagent un module, avec un réglage). La liste
complète des modules et l'ordre de réalisation sont dans `PLAN.md`.

---

## Pièce 1 — Le Sas de Scellement (10 × 6 × 5 m)

Antichambre où l'on est « vérifié » avant d'entrer, et où l'entrée se referme derrière soi. Pièce basse, dense et
étroite, éclairée d'ambre faible ; le regard est attiré par la Porte-Iris et ses glyphes qui s'allument.

### Architecture

- Murs de basalte à bandeau de glyphes à 1,10 m de hauteur, voûte plate à caissons, sol en dalles de 2 × 2 m dont les
  rainures convergent vers la porte nord.
- **Porte-Iris** au centre du mur sud (6 m de large). **Porte standard** 1,40 × 2,80 m au centre du mur nord.
- Quatre piliers d'angle, deux bancs, deux casiers, un pupitre de vérification contre le mur ouest.

### Assets normaux

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| SAS-01 | Dalle de sol modulaire | 2,0 × 2,0 × 0,20 m | Basalte mat, joints d'1 px plus sombres. Rainure de glyphe d'1 px sur le pourtour et une diagonale (émissive très faible ou simple trait sombre). Variantes : intacte, fissurée (ligne brisée d'1 px), usée (tons plus clairs au centre), avec trappe de 0,6 m (carré de 10 px à cadre de bronze). | `buildings/structure/glyph-floor-slab` |
| SAS-02 | Module de mur | 2,0 × 0,6 × 5,0 m | Basalte, bandeau émissif ambre de 2 px (0,12 m) à 1,10 m, découpé en glyphes de traits droits tirés de la graine ; suie en haut. Variantes : plein, avec niche (0,6 × 0,3 × 1,2 m), avec conduit encastré. | `buildings/structure/glyph-wall` |
| SAS-03 | Pilier d'angle | 0,9 × 0,9 × 5,0 m | Fût carré à chanfreins (1 px), base moulurée de 0,4 m, chapiteau de 0,5 m avec 4 rainures émissives d'1 px. Deux bandes de bronze de 2 px à 1,2 m et 3,6 m. | `buildings/structure/glyph-column` |
| SAS-04 | Module de voûte à caissons | 2,0 × 2,0 × 0,6 m | 4 caissons de 0,4 m de profondeur (le relief fait l'ombre), un plot de bronze au centre de chacun, un point d'accroche de lampe. | `buildings/structure/coffered-vault` |
| SAS-05 | Lampe cage à filament | Ø 0,35 × H 0,60 m + chaîne 1,2 m | Ampoule ronde de 2 px émissive ambre, cage de 8 barreaux de bronze (1 px), chaîne en pointillé. Scintillement lent par paliers. | `furniture/lighting/filament-lamp` |
| SAS-06 | Banc de pierre | 2,2 × 0,55 × 0,45 m | Bloc de pierre fumée, 2 accoudoirs de bronze, sangle de cuir sur un dossier bas de 0,25 m. Arêtes usées (ton clair irrégulier). | `furniture/seating/stone-bench` |
| SAS-07 | Casier d'équipement mural | 1,8 × 0,4 × 2,2 m | 6 compartiments (0,55 × 0,35 × 0,9 m) à portes grillagées en laiton (quadrillage d'1 px), chacune avec un cadran de 2 px et une molette d'1 px. | `furniture/storage/equipment-locker` |
| SAS-08 | Pupitre de vérification | 1,0 × 0,5 × 1,2 m | Plan incliné à 20°, 8 leviers de laiton de 0,25 m (4 px, un sur deux abaissé selon la graine), 4 cadrans ronds de 2 px, plaque gravée, piètement de pierre. | `props/machines/lever-desk` |
| SAS-09 | Tuyau mural | Ø 0,12 m, modules de 2,0 m | Tube de 2 px en cuivre oxydé, colliers de bronze tous les 0,5 m, coudes à 90° de rayon 0,25 m, coulures vertes (bandes d'un ton). | `props/machines/copper-pipe` |
| SAS-10 | Valve à volant | Volant Ø 0,22 m, corps 0,35 × 0,20 × 0,30 m | Volant de fonte à 5 rayons (4 px de diamètre), tige visible, petit cadran à aiguille. | `props/machines/wheel-valve` |
| SAS-11 | Câbles tressés (set) | Ø 3 à 6 cm, longueurs 1 à 4 m | Tube d'1 px en tissu goudronné, connecteurs de bronze de 2 px. 3 variantes : pendant (chaînette), posé au sol, en faisceau. | `props/machines/braided-cable` |
| SAS-12 | Grille d'aération | 0,8 × 0,8 × 0,1 m | Plaque de bronze percée d'un damier d'1 px (les hexagones ne se lisent pas à cette taille), lueur ambre derrière, 4 plots aux angles. | `buildings/structure/vent-grate` |
| SAS-13 | Malle de transport | 0,80 × 0,50 × 0,45 m | Bois noirci, coins et sangles de laiton, serrure de 2 px, étiquette métallique. Variante ouverte. | `furniture/storage/travel-trunk` |
| SAS-14 | Plaque d'inscription | 1,2 × 0,8 × 0,03 m | Bronze avec 5 à 7 lignes de glyphes en creux (traits d'1 px plus sombres, vert-de-gris), 4 plots. | `props/decor/glyph-plaque` |
| SAS-15 | Poteau et chaîne de balisage | Poteau H 0,9 m Ø 0,08 m, chaîne 2,0 m | Poteau de bronze d'1 px, chaîne en pointillé qui pend en courbe, base en disque de 0,25 m. | `buildings/structure/bronze-railing` |
| SAS-16 | Lampe portative | 0,25 m + tête Ø 0,10 m | Poignée de cuir, tête de laiton avec lentille d'1 à 2 px émissive. Objet de main, lisible au zoom 3–4. | `props/tools/hand-lamp` |

### Asset héros

#### SAS-17 — La Porte-Iris (`buildings/structure/iris-door`)

La porte d'entrée, qui se ferme derrière la créature et qui incarne le style du lieu : une mécanique antique, dans un
mur de pierre, activée par la lumière.

- **Taille globale** : anneau extérieur Ø 4,4 m (70 px), épaisseur 0,5 m. Centre à 1,5 m du sol, partie basse
  (0,7 m) enterrée dans le sol. Ouverture de Ø 2,6 m, seuil de 0,2 m.
- **Cadre fixe** : anneau de basalte encastré dans le mur, avec bandeau de bronze de 0,15 m (2 px) à son bord.
- **Anneau rotatif** : Ø 3,8 m, largeur 0,5 m ; les 48 dents de 4 cm deviennent un crénelage d'1 px sur la face
  intérieure (24 créneaux visibles), noir d'huile entre eux.
- **12 lames de bronze** : 1,5 m de long, 0,9 m de large à la base, 0,15 m à la pointe, épaisseur 0,12 m,
  recouvrement de 20 %. Un glyphe différent par lame (3 à 5 px de traits droits), bord biseauté d'un ton plus clair,
  face intérieure plus claire (usure).
- **Cadran central** : médaillon de laiton Ø 0,5 m (8 px) avec aiguille, entouré d'une couronne de points.
- **4 verrous radiaux** : barres de 0,6 m × 0,08 m à 3 h, 6 h, 9 h et 12 h.
- **États et animation** (réglage `state` + séquence pilotable) : fermée (glyphes éteints, médaillon qui « respire »
  en ambre) ; ouverture (verrous rétractés en 0,6 s, anneau tourné de 15°, lames écartées en cascade en 4 s, glyphes
  allumés de l'extérieur vers le centre) ; ouverte (lames repliées en couronne) ; fermeture (inverse, plus rapide).
- **Dessin** : cadre et lames fusionnés par matière ; les 12 lames sont animées dans le vertex shader (une
  « lame » par sommet, pivot au bord extérieur) ou regroupées en un mesh animé. ≤ 8 000 triangles, ≤ 4 draw calls
  (pierre, bronze fixe, lames, lueurs).

---

## Pièce 2 — Les Archives (18 × 12 × 7 m)

La mémoire du site : une grande nef de rayonnages de tiroirs à cassettes de verre, organisée autour d'un grand
meuble-catalogue central. Ambiance feutrée, poussière ambre, frémissement lointain de rouages (en pixel art : de
petits rouages qui tournent sur les rayonnages, des tiroirs qui glissent seuls de temps en temps) ; l'espace se lit en
hauteur.

### Architecture

- **Mur nord** : 6 rayonnages côte à côte (18 m) avec une **mezzanine** devant, à 3,4 m. Les rangs bas se lisent du
  sol, les rangs hauts depuis la mezzanine.
- **Mur sud** : 5 rayonnages (15 m) avec des échelles roulantes. Porte standard 1,40 × 2,80 m au sud-ouest (vers le
  Sas).
- **Mur est** : porte standard (vers l'Atelier).
- **Centre** : le meuble-catalogue ARC-17. Six colonnes en deux rangées de trois (à ± 3,5 m de l'axe de la salle),
  quatre tables de lecture, deux lanternes suspendues.
- En vue en coupe, le mur sud (côté caméra au repos) est abaissé : on voit les rayonnages nord et la mezzanine de face.

### Assets normaux

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| ARC-01 | Rayonnage monumental à tiroirs | 3,0 × 0,8 × 5,5 m | Ossature de bronze, façade en grille de 12 colonnes × 23 rangées de tiroirs (chaque façade = 4 × 3 px, joint d'1 px sombre, poignée d'1 px claire), plinthe de pierre de 0,3 m. Quelques tiroirs sortis (vrais blocs) selon la graine. | `furniture/storage/drawer-archive` |
| ARC-02 | Tiroir à cassettes | 0,24 × 0,70 × 0,20 m | Caisse de métal, poignée d'1 px, porte-étiquette d'1 px clair. 3 états : fermé, entrouvert (0,3 m), ouvert (0,7 m) avec 6 cassettes en tranches lumineuses. Fait partie du rayonnage (réglage `drawers`). | `furniture/storage/drawer-archive` |
| ARC-03 | Cassette de données | 0,18 × 0,10 × 0,02 m | Plaquette de verre fumé sertie de cuivre, tranche émissive ambre d'1 px. 4 couleurs de tranche, 3 niveaux d'usure. Très légère (< 50 triangles), instanciée des centaines de fois. | `props/books/data-cassette` |
| ARC-04 | Échelle roulante sur rail | 0,6 × 0,5 × 5,0 m | 16 barreaux au pas de 0,30 m (un tous les 5 px), montants de laiton, roulettes de 2 px, rail de laiton à 5,2 m. | `buildings/structure/rolling-ladder` |
| ARC-05 | Table de lecture | 2,4 × 1,0 × 0,85 m | Plateau de pierre fumée de 0,08 m, deux pieds de bronze en patte, tiroir central, trait de glyphes émissif d'1 px sur la tranche. | `furniture/tables/stone-table` |
| ARC-06 | Lampe de lecture articulée | Portée 1,0 m, base Ø 0,15 m | 3 segments de 0,35 m, articulations en plots, abat-jour cloche de 3 px en verre ambre émissif. | `furniture/lighting/articulated-lamp` |
| ARC-07 | Loupe sur bras | Lentille Ø 0,20 m, bras 0,6 m | Monture de laiton, lentille de 3 px claire jaunie avec reflet d'1 px, bras à contrepoids. | `props/tools/arm-magnifier` |
| ARC-08 | Tabouret de lecture | 0,40 × 0,40 × 0,48 m | Assise de cuir avec rangée de points (clous), 3 pieds de bronze croisés, sans dossier. | `furniture/seating/bronze-stool` |
| ARC-09 | Colonne porteuse gravée | Ø 1,0 × 7,0 m | Fût à 16 cannelures (alternance de tons par facette), base de 0,5 m, deux anneaux de bronze de 2 px à 2,0 m et 5,0 m, chapiteau avec 8 glyphes émissifs ambre. | `buildings/structure/glyph-column` |
| ARC-10 | Chariot à cassettes | 1,0 × 0,6 × 1,1 m | 3 étages, roues cerclées de bronze Ø 0,20 m, poignée de laiton, piles de cassettes (tranches lumineuses). | `props/machines/complex-cart` |
| ARC-11 | Visionneuse à manivelle | 0,5 × 0,4 × 0,6 m | Boîtier de bois et bronze, 2 oculaires d'1 px, manivelle de 0,15 m, petite fenêtre ambre où défile une bande. | `props/machines/crank-recorder` |
| ARC-12 | Rouleau-bande de cuivre | Ø 0,12 × 0,40 m | Bande de cuivre enroulée sur une bobine de bois, bout pendant de 0,5 m avec 3 à 5 traits gravés. | `props/books/data-cassette` |
| ARC-13 | Escalier à vis | Ø 2,2 m × H 3,4 m | 19 marches de 0,18 m (3 px), noyau Ø 0,3 m, garde-corps de laiton à 1,0 m, limon de bronze. Rejoint la mezzanine. | `buildings/structure/spiral-stair` |
| ARC-14 | Mezzanine | 18 × 1,2 m, plancher à 3,4 m | Caillebotis de bronze (quadrillage d'1 px, on voit le dessous à travers), garde-corps à 1,0 m, poutrelles tous les 2 m, 6 consoles de pierre. | `buildings/structure/grating-walkway` |
| ARC-15 | Vitrine de conservation | 1,2 × 0,8 × 1,0 m | Piètement de pierre, caisson de verre translucide bombé, cadran d'hygrométrie de 2 px, joint noirci. | `furniture/storage/display-case` |
| ARC-16 | Lanterne suspendue | Ø 0,8 × H 1,2 m + chaîne 3,5 m | 6 ampoules émissives dans une cage de bronze, chaîne en pointillé, coupelle de verre au sommet. | `furniture/lighting/filament-chandelier` |

### Asset héros

#### ARC-17 — Le meuble-catalogue central (`furniture/tables/card-catalogue`)

- **Taille** : Ø 3,4 × H 1,1 m.
- Table circulaire de pierre fumée sur socle de 0,25 m, couronne de 24 tiroirs plats (0,30 × 0,60 × 0,06 m : façades
  de 5 × 1 px, quelques-uns tirés), pupitre central tournant à 8 casiers, plaques d'index de laiton (1 px clair), lampe
  de lecture ARC-06 suspendue au-dessus.
- **Vie** : le pupitre central tourne d'un cran de temps en temps, un tiroir sort et rentre (pilotable par le scénario :
  la créature consulte le catalogue).
- ≤ 8 000 triangles, ≤ 4 draw calls.

---

## Pièce 3 — L'Atelier de l'Artisan (12 × 10 × 5,5 m)

La pièce où le site se répare et se fabrique : plus chaude, plus encombrée, plus humaine. Le sol est taché d'huile,
l'air chargé d'une lueur orange venant du four (une lumière de halo orange lui est réservée). C'est ici que sont
fabriqués les capteurs, les câbles et les supports des salles d'étude.

### Architecture

- Quatre poutres de bronze de 12 m (section 0,4 × 0,2 m) à 5,0 m de hauteur, espacées de 2,5 m, portant le rail du
  portique de levage.
- **Mur ouest** : porte standard 1,40 × 2,80 m (vers les Archives). **Mur nord** : arche de 2,4 × 3,2 m ouvrant sur un
  couloir de 2,4 × 8 m vers la Grande Galerie.
- **Mur est** : râteliers, étagères et table à calques. **Centre** : établi, four et portique. **Coin sud-est** :
  l'établi d'horloger et l'étagère à pièces.
- Sol en dalles de basalte (comme le Sas) avec trois zones de taches d'huile et de limaille (variante `stained` de la
  dalle : taches sombres et points clairs).

### Assets normaux

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| ATE-01 | Établi central | 2,6 × 0,9 × 0,92 m | Plateau de chêne noirci de 0,08 m, plaque de bronze encastrée (1,0 × 0,6 m), étau de laiton bien visible (mâchoires de 2 px), 2 tiroirs à poignée d'1 px, pieds avec traverse basse. | `furniture/tables/workbench` |
| ATE-02 | Tour à métaux à courroie | 1,6 × 0,6 × 1,25 m | Banc de fonte, mandrin Ø 0,20 m, poulie étagée à 3 gorges (3 disques de 2 à 5 px), courroie de cuir, contre-pointe, petit volant. Mandrin et poulie tournent. | `props/machines/metal-lathe` |
| ATE-03 | Four à bobines | 1,4 × 1,4 × 1,8 m | Cuve de brique réfractaire (rangs de briques en tons alternés), bobine de cuivre Ø 0,8 m (12 spires = 12 anneaux d'1 px), creuset, hotte de 0,5 m, cadran de 2 px. Bouche émissive orange qui palpite. | `props/machines/coil-furnace` |
| ATE-04 | Enclume sur souche | Enclume 0,75 × 0,25 × 0,45 m, souche Ø 0,5 × 0,6 m | Enclume de fonte avec table, bec et trou carré d'1 px, souche fendue cerclée de fer. | `props/tools/anvil` |
| ATE-05 | Râtelier à outils mural | 2,0 × 0,15 × 1,2 m | Planche de chêne noirci, crochets de bronze, emplacements d'outils marqués par des silhouettes d'1 px blanc usé (certaines vides). | `furniture/storage/tool-rack` |
| ATE-06 | Set d'outils (12 pièces) | 0,10 à 0,45 m | Marteau de ciselage, pince coupante, tournevis, clé à molette, fer à souder, burin, lime, mètre pliant, compas, jauge, scie à métaux, pince à dénuder : silhouettes de 2 à 7 px, lisibles au zoom 3–4. Réglage `tool`. | `props/tools/artisan-tools` |
| ATE-07 | Étagère à pièces détachées | 2,0 × 0,5 × 2,2 m | 5 niveaux, bacs de bois de 0,25 × 0,35 × 0,15 m (4 × 2 px) étiquetés d'un point clair, contenu suggéré par des points de couleur : rouages (bronze), ressorts, bobines (cuivre), cristaux bruts (cyan pâle). | `furniture/storage/parts-shelf` |
| ATE-08 | Touret de câble | Ø 1,2 × 0,7 m | Bobine de bois cerclée de fer, câble de cuivre en spires d'1 px, bout libre de 1,5 m au sol. | `props/machines/cable-reel` |
| ATE-09 | Lampe d'atelier à contrepoids | Bras 1,2 m, abat-jour Ø 0,35 m | Bras articulé, abat-jour conique noir (intérieur jaune pâle), ampoule émissive, fixation à étau. | `furniture/lighting/articulated-lamp` |
| ATE-10 | Tabouret d'atelier | 0,40 × 0,40 × 0,65 m | Assise ronde de bois Ø 0,35 m, 3 pieds de bronze, repose-pieds annulaire à 0,25 m. | `furniture/seating/bronze-stool` |
| ATE-11 | Chariot à pièces lourdes | 1,8 × 0,8 × 0,9 m | Plateau en madriers (planches de tons alternés), 4 roues cerclées de fer Ø 0,40 m, timon de 1,0 m. | `props/machines/complex-cart` |
| ATE-12 | Portique de levage à palan | 3,2 × 2,4 × 3,8 m | Poutres de bronze (0,2 × 0,2 m), palan à chaîne en pointillé, crochet de 0,25 m, volant, roulettes. Le crochet monte et descend (pilotable). | `props/machines/hoist-gantry` |
| ATE-13 | Fût d'huile et d'électrolyte | Ø 0,50 × 0,80 m | Fût à trois cercles de cuivre (bandes de 1 px), bonde, étiquette de laiton, coulures noires. | `props/machines/oil-drum` |
| ATE-14 | Établi d'horloger | 1,2 × 0,7 × 0,95 m | Plateau en U échancré, loupe binoculaire sur bras de 0,4 m, rangées de 12 mini-tiroirs (façades d'1 × 2 px). | `furniture/tables/workbench` |
| ATE-15 | Table à calques lumineuse | 1,5 × 1,0 × 0,90 m | Plateau de verre dépoli émissif ambre pâle (éclairé par-dessous), feuilles de cuivre fin posées dessus avec 3 à 5 traits de plan, 4 pinces. | `furniture/tables/light-table` |
| ATE-16 | Poutre de plafond | 12,0 × 0,2 × 0,4 m | Profil en I de bronze patiné, rivets en rangée de points d'1 px, rail inférieur pour le portique. | `buildings/structure/riveted-beam` |

---

## Pièce 4 — La Grande Galerie et la Rotonde

La circulation du Complexe : une galerie de 48 m dessert cinq salles d'étude, puis débouche sur une rotonde qui
distribue les cinq plus grandes. Ambiance de couloir de laboratoire ancien : longues perspectives, câbles qui courent
au mur, lampes à filament régulières.

### Architecture

- **Grande Galerie** : 48 × 4 × 6 m, 12 travées de 4 m, voûte en berceau, nervures de bronze tous les 4 m, bandeau
  émissif ambre à 1,10 m. Elle part de l'Atelier (sud) et monte vers la Rotonde (nord). En vue en coupe, on voit la
  galerie comme une longue tranchée lumineuse : la voûte est masquée, le bandeau d'ambre dessine la perspective.
- **Portes d'étude** (mesurées depuis le sud) : côté ouest à 8, 22 et 36 m (salles 1, 2, 3) ; côté est à 15 et 33 m
  (salles 4 et 5).
- **Chemins de câbles muraux** à 2,4 m et 2,8 m de haut sur les deux murs : ils portent les câbles de chaque salle
  jusqu'aux consoles.
- **Rotonde** : Ø 14 × H 7 m, 12 colonnes, 6 portes radiales espacées de 60°. Une porte au sud vers la Galerie, cinq
  couloirs de liaison de 3 × 12 × 4,5 m vers les salles 6 (sud-ouest), 7 (sud-est), 8 (nord-ouest), 9 (nord-est) et
  10 (nord).

### Assets normaux

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| GAL-01 | Travée de galerie | 4,0 × 4,0 × 6,0 m | Murs de basalte avec bandeau de glyphes à 1,10 m, voûte en berceau (masquable), nervure de bronze au centre de la travée. 12 exemplaires, 3 variantes de salissure. | `buildings/structure/gallery-bay` |
| GAL-02 | Porte d'étude | 1,4 × 0,6 × 2,8 m | Chambranle de pierre fumée, vantail de bronze avec hublot rond de 5 px (verre épais, reflet d'1 px) à 1,6 m de haut, plaque numérotée (1 à 5 traits), voyant de 2 px ambre ou rouge au-dessus. S'ouvre (pilotable). | `buildings/structure/complex-door` |
| GAL-03 | Fenêtre d'observation intérieure | 1,2 × 0,3 × 0,8 m | Cadre de bronze, verre épais translucide, volets coulissants de laiton. Elle donne sur l'intérieur des salles d'étude, jamais vers l'extérieur. | `buildings/structure/observation-window` |
| GAL-04 | Chemin de câbles mural | 2,0 × 0,3 × 0,08 m | Goulotte ouverte de bronze, colliers de cuir, 2 à 4 câbles d'1 px posés dedans. Modules droit, coude et en T. | `props/machines/cable-tray` |
| GAL-05 | Applique à filament | Ø 0,25 × H 0,4 m | Ampoule de 2 px dans une cage de bronze fixée au mur à 2,6 m, une par travée, scintillement lent. | `furniture/lighting/filament-lamp` |
| GAL-06 | Plaque de direction | 0,6 × 0,3 × 0,02 m | Laiton avec une flèche (5 px) et un « numéro » de salle en glyphes (1 à 3 traits). | `props/decor/glyph-plaque` |
| GAL-07 | Banc de galerie | 1,2 × 0,4 × 0,45 m | Pierre fumée, deux pieds de bronze, usure marquée au centre (ton clair). | `furniture/seating/stone-bench` |
| GAL-08 | Chariot d'instruments | 1,2 × 0,6 × 1,0 m | 2 étages, roues cerclées Ø 0,25 m, sondes et rouleaux de câble, poignée de laiton. | `props/machines/complex-cart` |
| GAL-09 | Poste de garde | 1,0 × 0,5 × 1,1 m | Pupitre incliné avec registre à reliure de cuir, 10 voyants ambre d'1 px (un par salle d'étude, allumés selon les salles ouvertes), 4 leviers. | `props/machines/lever-desk` |
| GAL-10 | Rosace de la Rotonde | Ø 14,0 m, épaisseur 0,25 m | 24 secteurs de dalle de basalte, rosace de laiton Ø 4 m au centre avec 6 flèches gravées (traits d'1 px). | `buildings/structure/rotunda-floor` |
| GAL-11 | Colonne de rotonde | Ø 0,8 × H 7,0 m | 12 cannelures, chapiteau en anneau de glyphes émissifs, bague de bronze à 2,5 m. | `buildings/structure/glyph-column` |
| GAL-12 | Lustre de rotonde | Ø 3,0 × H 2,0 m + chaîne 4 m | Cercle de bronze portant 24 ampoules émissives (points de 2 px), chaîne en pointillé. | `furniture/lighting/filament-chandelier` |
| GAL-13 | Grande porte de liaison | 3,0 × 0,5 × 5,0 m | Variante de ORA-07 avec gravure propre à chaque salle (5 variantes, motif tiré de la graine), voyant de statut à 3 m. | `buildings/structure/complex-door` |
| GAL-14 | Module de couloir de liaison | 3,0 × 4,0 × 4,5 m | Travée de basalte nu, chemin de câbles à 3,0 m, applique GAL-05. 3 modules par couloir (12 m). | `buildings/structure/gallery-bay` |

---

## Kit d'étude partagé (ETU)

Quinze fiches d'instruments et de câblage, réutilisées dans les dix salles d'étude : c'est ce qui colle aux artefacts
et les rend « étudiés ». Elles sont toutes dans le style du Complexe (bronze, laiton, tissu goudronné, verre à
phosphore ambre) et doivent contraster avec l'artefact : jamais de matériau du monde d'origine sur un instrument. En
pixel art, le contraste passe d'abord par la couleur : **ambre et bronze chauds** pour l'étude, **froid** pour
l'artefact.

| ID | Asset | Taille (L × l × H) | À dessiner (pixel art) | Module |
|---|---|---|---|---|
| ETU-01 | Trépied de capteur | Empattement Ø 1,0 m, H réglable 1,2 à 1,8 m | 3 pieds de laiton d'1 px, tête à rotule de 2 px, patins de cuir. Réglage de hauteur. | `props/machines/sensor-tripod` |
| ETU-02 | Sonde de mesure | Tête Ø 0,12 × 0,25 m, bras 0,6 m | Cylindre de laiton de 2 px, lentille émissive d'1 px, bras articulé, câble à l'arrière. Se pose sur ETU-01, ETU-08 ou un bras de portique ; s'oriente vers une cible. | `props/machines/sensor-tripod` |
| ETU-03 | Cornet de relevé | Ø 0,5 × 0,6 m | Cornet de laiton martelé (facettes de tons alternés) sur pied court, gaine de cuir, bobine de cuivre dans le fond. | `props/machines/sensor-tripod` |
| ETU-04 | Console d'enregistrement | 1,4 × 0,7 × 1,3 m | Bâti de bronze, 2 écrans de verre bombé (4 × 3 px) à phosphore ambre où défile une courbe, enregistreur à bande de papier avec stylet, rangée de 12 cadrans d'1 à 2 px, 8 leviers, tiroir. | `props/machines/recording-console` |
| ETU-05 | Enregistreur à tambour | 0,6 × 0,4 × 0,5 m | Tambour Ø 0,2 × 0,3 m en papier enfumé (ton gris clair avec trace sombre), stylet à contrepoids, manivelle. Le tambour tourne. | `props/machines/crank-recorder` |
| ETU-06 | Chemin de câbles au sol | 2,0 × 0,3 × 0,06 m | Goulotte de bronze à couvercle (charnières en points), modules droit, coude et en T, pente d'accès de chaque côté. | `props/machines/cable-tray` |
| ETU-07 | Faisceau de câbles d'étude | Ø 0,06 à 0,20 m, longueurs 2 à 10 m | Tresses sous gaine de tissu goudronné (tubes de 1 à 3 px), connecteurs de bronze, étiquettes d'1 px claires, boucles de rangement. 4 sections types ; tracé par points de passage pour relier un artefact à sa console. | `props/machines/braided-cable` |
| ETU-08 | Potence à sonde sur rail | Portée 1,5 m, rail 3,0 m | Rail de laiton au plafond ou au sol, chariot à galets, bras à contrepoids avec crochet pour ETU-02. Le chariot glisse (pilotable). | `props/machines/probe-gantry` |
| ETU-09 | Cage d'isolation | 2,0 × 2,0 × 2,2 m | Treillis de cuivre (quadrillage d'1 px, on voit à travers), ossature de bronze, porte de 0,8 × 2,0 m, passe-câbles, plaque de terre au sol. | `props/machines/isolation-cage` |
| ETU-10 | Table d'observation | 1,6 × 0,8 × 0,9 m | Plateau de pierre sous tapis de feutre, rebord, loupe sur bras, gants de coton (2 taches claires). | `furniture/tables/stone-table` |
| ETU-11 | Projecteur d'inspection | Ø 0,3 × 0,4 m | Lampe à arc dans un carter de laiton ajouré, objectif émissif, faisceau étroit ambre (cône translucide en paliers). Se monte sur ETU-01. | `props/machines/arc-projector` |
| ETU-12 | Mire et échelle | Mire de 2,0 m, règle de 1,0 × 0,1 m | Mire à bandes noires et blanches de 2 px sur perche de laiton, règle de laiton à graduations en pointillé. | `props/tools/artisan-tools` |
| ETU-13 | Tableau de notes | 1,6 × 0,05 × 1,0 m | Ardoise dans un cadre de bois noirci, « formules » et schémas en traits de craie d'1 px tirés de la graine, chiffon et craie sur le rebord. | `props/decor/chalk-board` |
| ETU-14 | Armoire d'étalons | 0,7 × 0,4 × 1,6 m | Porte vitrée, 4 étagères de poids de laiton (plots de 1 à 3 px), diapasons, cristaux de référence (points cyan pâle), tiroir. | `furniture/storage/parts-shelf` |
| ETU-15 | Périmètre de sécurité | Ø variable, H 0,9 m | Ligne de laiton d'1 px incrustée dans le sol et poteaux de bronze (comme SAS-15) reliés par une chaîne, plaque d'avertissement à glyphe rouge. | `buildings/structure/bronze-railing` |
