# Le Complexe : suivi de l'implémentation

**À lire en premier à chaque session sur le Complexe.** Ce fichier dit où on en est. La bible est dans `README.md`,
`PIECES.md` et `SALLES.md` ; le découpage en lots et la marche à suivre dans `PLAN.md`.

## Pour l'agent (Claude Code ou Mistral Vibe) : reprendre le travail

Quand l'utilisateur demande « on en est où ? », « on continue le Complexe », « on reprend l'environnement des
artefacts », ou parle d'un lot :

1. Lire ce fichier en entier, puis `PLAN.md` (déroulé d'un lot) et la partie de la bible du lot concerné.
2. Répondre avec un **point d'étape** court : lots validés, lot en cours ou à valider (et ce qui y reste),
   prochain lot avec ses assets et les fiches qu'ils couvrent.
3. Pour le prochain lot : **discuter d'abord** (proposition par asset : traits reconnaissables en pixels, graine,
   réglages, rangement), puis réaliser avec `create-asset` / `create-world`, publier l'Atelier (skill
   `publish-page`), et passer le lot à **👀 à valider** ici, avec la date et les commits.
4. **Ne passer un lot à ✅ validé que sur le feu vert explicite de l'utilisateur** (« je valide », « c'est bon,
   on continue »). Noter alors la date, et les décisions prises dans « Décisions ».
5. Committer ce fichier à chaque changement d'état (message en français, par exemple « Suivi Complexe : lot 3 validé »).

Légende des états : ⬜ à faire · 🔄 en cours · 👀 fait, à valider par l'utilisateur · ✅ validé · ⏸️ en pause.

## Point d'étape

- **Dernière mise à jour** : 2026-11-19
- **Étape actuelle** : lot 8 validé : escalier à vis, escalier droit, passerelle en caillebotis, meuble-catalogue ★,
  et les Archives dans le monde du Complexe (mezzanine praticable).
- **Prochaine action** : lot 9 (Atelier : établis et forge), à discuter d'abord.

## Les lots

| Lot | Contenu | Assets | État | Date | Commits / remarques |
|---|---|---|---|---|---|
| — | Bible adaptée au pixel art, plan, suivi | — | ✅ validé | 2026-11-17 | docs/complexe/ |
| 0 | Préparation | — | ✅ validé | 2026-11-17 | palettes du Complexe, `kit/complex-parts.js`, option `tone` du matériau, taxonomie, nuancier `dev/complex-swatch.html` |
| 1 | Ossature du Sas | 5 | ✅ validé | 2026-11-17 | dalle, mur, colonne, voûte, portes ; scène d'essai `dev/complex-corner.html` |
| 2 | Lumière et réseaux | 5 | ✅ validé | 2026-11-17 | lampe, lustre, tuyau, valve, câbles ; ajoutés au coin du Sas (jour et nuit) |
| 3 | Mobilier du Sas | 5 | ✅ validé | 2026-11-18 | banc, casier, pupitre, grille et caillebotis, plaque ; ajoutés au coin du Sas (jour et nuit) ; kit : `gridBlock` |
| 4 | La Porte-Iris et le balisage | 4 | ✅ validé | 2026-11-18 | Porte-Iris, malle, rambarde, lampe portative ; ajoutés au coin du Sas et au monde d'essai ; kit : `arcBlock`, `slantPlate`, `createRigidParts`, `mergeParts` ; moteur : option `dither` (trame) |
| 5 | Monde : le Sas | — | ✅ validé | 2026-11-18 | monde `ancient-complex` (Sas + vestibule, états, vérification) ; moteur : `enableReveal`, brume d'intérieur ; kit : lampes allumées ou éteintes, halos `on` ; fx : `lamp-dust` ; marche à étages `heightAt(x, z, y)` |
| 6 | Archives : rangement | 5 | ✅ validé | 2026-11-18 | e9d217b : rayonnage (rouages demandés par l'utilisateur), cassette, échelle, table, lampe articulée ; kit : `buildQuads`, `gearWheel`, `DATA_GLOWS`, cuivre vif ; pièces rigides : seule la plage mobile part au GPU ; coin d'essai `dev/archive-corner.html` |
| 7 | Archives : lecture | 5 | ✅ validé | 2026-11-19 | f2c0fc2 : loupe (lecture, binoculaire, observation), tabouret (lecture, atelier), chariot (cassettes, instruments, lourd), appareil à manivelle (visionneuse, tambour, cylindre), vitrine (conservation, cuve) ; kit : `GLASSES.clear`, `buildRibbon` ; verre en trame ; ajoutés au coin des Archives |
| 8 | Archives : hauteur et catalogue, puis Monde : les Archives | 4 | ✅ validé | 2026-11-19 | b2394be : escalier à vis, escalier droit, passerelle (droite ou arc), meuble-catalogue ★ ; Archives au nord du Sas (`ancient-complex-archives.js`), une pièce à la fois, mezzanine et escalier praticables ; kit : `openBar`, `WalkSurfaces`, boîtes à hauteur, `kit.update()` ; explorateur : `reach`, `y` |
| 9 | Atelier : établis et forge | 5 | ⬜ à faire | | |
| 10 | Atelier : outils et réserves | 5 | ⬜ à faire | | |
| 11 | Atelier : levage, puis Monde : l'Atelier | 3 | ⬜ à faire | | |
| 12 | Galerie et Rotonde, puis Monde : la circulation | 4 | ⬜ à faire | | |
| 13 | Kit d'étude : capteurs et consoles | 5 | ⬜ à faire | | |
| 14 | Salle 1, la Clef : le matériel | 5 | ⬜ à faire | | |
| 15 | La Clef-Disque et la Cassette-Maître, puis Monde : salles 1 et 2 | 4 | ⬜ à faire | | |
| 16 | Le Prisme, puis Monde : salle 3 | 4 | ⬜ à faire | | |
| 17 | Le Marteau, puis Monde : salle 4 | 4 | ⬜ à faire | | |
| 18 | L'Éveil, puis Monde : salle 5 | 3 | ⬜ à faire | | |
| 19 | L'Arbre de Mémoire, puis Monde : salle 6 | 3 | ⬜ à faire | | |
| 20 | Le Cœur : la machinerie | 5 | ⬜ à faire | | |
| 21 | Le Cœur, puis Monde : salle 7 | 2 | ⬜ à faire | | |
| 22 | L'Oracle : l'amphithéâtre | 4 | ⬜ à faire | | |
| 23 | L'Oracle et le Triptyque, puis Monde : salle 8 | 2 | ⬜ à faire | | |
| 24 | L'Orrery, puis Monde : salle 9 | 4 | ⬜ à faire | | |
| 25 | La salle de la Porte : instruments et coordonnées | 4 | ⬜ à faire | | |
| 26 | La Porte des Étoiles, puis Monde : salle 10 | 1 | ⬜ à faire | | |
| 27 | Finitions | — | ⬜ à faire | | |

## Les modules

Un module par ligne, avec les fiches de la bible qu'il couvre. Un module passe à ✅ quand son lot est validé. La
colonne « Remarques » garde ce qui a été décidé pour lui (réglages, version, retouches).

| Lot | Module | Fiches | État | Remarques |
|---|---|---|---|---|
| 1 | `buildings/structure/glyph-floor-slab` | SAS-01 (+ sols de l'Atelier, de E4, de E10) | ✅ | intacte, fissurée, usée, à trappe, tachée ; rainure sombre ou ambre ; dessus à 0,20 m |
| 1 | `buildings/structure/glyph-wall` | SAS-02 (+ tous les murs : courbes pour les salles rondes, doublage cuivre de E2) | ✅ | plein, niche, conduit ; 4–14 m ; largeur 1–4 m ; cintrage ; doublage cuivre ; glyphes allumés, en veille, éteints |
| 1 | `buildings/structure/glyph-column` | SAS-03, ARC-09, GAL-11, ORA-06 (+ pilastres de E6, E7) | ✅ | carré, cannelé, engagé, pilastre ; 3–14 m ; 8–24 cannelures ; fibre cyan. La graine change peu (bagues, tons, écaillures) |
| 1 | `buildings/structure/coffered-vault` | SAS-04 (+ plafond de E6) | ✅ | au plafond ou retournée ; crochet de lampe (`userData.hookPoint`) |
| 1 | `buildings/structure/complex-door` | Porte standard, GAL-02, GAL-13, ORA-07, issue de secours de E7 | ✅ | standard, étude, double, liaison, secours ; fermée, ouverte, en boucle ; `userData.door` (open, close, setOpen, blocking) |
| 2 | `furniture/lighting/filament-lamp` | SAS-05, GAL-05 | ✅ | suspendue ou applique ; allumée, en veille, éteinte ; scintillement par paliers ; option halo |
| 2 | `furniture/lighting/filament-chandelier` | ARC-16, GAL-12, ORA-13 | ✅ | lanterne (6), grand lustre (24), anneau de voûte (12) ; ampoules faibles ou mortes selon la graine ; option halo |
| 2 | `props/machines/copper-pipe` | SAS-09, COE-07 | ✅ | droit, coude, T, bout bouché ; mural (colliers) ou géant (brides) ; contre un mur ou sur berceaux |
| 2 | `props/machines/wheel-valve` | SAS-10, COE-08 | ✅ | murale ou géante ; `turn`, boucle, `userData.valve` (setTurn, turnTo) ; l'aiguille suit |
| 2 | `props/machines/braided-cable` | SAS-11, ETU-07, COE-14, ORA-11 | ✅ | fin, d'étude, ombilical, principal ; pendu, au sol, faisceau avec boucle ; `createRoute(points)` |
| 3 | `furniture/seating/stone-bench` | SAS-06, GAL-07, ORA-10, E5-02 | ✅ | Sas, galerie, méditation, maintenance ; assise en 1 à 3 blocs, angle écorné ; `userData.seats` |
| 3 | `furniture/storage/equipment-locker` | SAS-07, COE-10 | ✅ | casier (6 cases) ou armoire à fusibles (24, levier de coupure) ; portes fermées par défaut ; `userData.locker` (setOpen, setAll) |
| 3 | `props/machines/lever-desk` | SAS-08, GAL-09, E2-01 | ✅ | vérification, garde (registre, 10 voyants), lecteur (fente cyan) ; `userData.desk` (setLever, setLights, setCassette) |
| 3 | `buildings/structure/vent-grate` | SAS-12, COE-12 | ✅ | grille murale à damier, caillebotis droit ou courbe (rayon réglable, fait dès ce lot) ; lueur ambre ou cyan ; `userData.walkable` |
| 3 | `props/decor/glyph-plaque` | SAS-14, GAL-06, ORA-12, plaque de COE-15 | ✅ | inscription, direction (flèche, numéro : couché = 5, debout = 1), dédicace inclinée, avertissement rouge |
| 4 | `buildings/structure/iris-door` ★ | SAS-17 | ✅ | voussoirs gravés, anneau crénelé qui tourne de 15°, 12 lames en moulinet, médaillon qui respire, 4 verrous ; fermée, ouverte, en boucle ; `userData.door` ; centre 1,40 m, ouverture Ø 2,80 m sur seuil de 0,20 m (bible : 1,5 m et 2,6 m) ; 5 050 triangles, 3 draw calls |
| 4 | `furniture/storage/travel-trunk` | SAS-13 | ✅ | coffret, malle, grande malle ; fermée, entrouverte, ouverte ; cassettes de verre, outils ou vide ; `userData.trunk` (setOpen, open, close) |
| 4 | `buildings/structure/bronze-railing` | SAS-15, ETU-15, COE-03, barrière de COE-15 | ✅ | balisage à chaîne, garde-corps à lisse et chaîne lourde, barrière à bandes ambre ; en ligne ou en cercle (passage ouvert possible) ; `userData.blocking` |
| 4 | `props/tools/hand-lamp` | SAS-16 | ✅ | debout, couchée, en main (`userData.grip`, `beamDirection`) ; allumée ou éteinte ; options halo et faisceau tramé |
| 6 | `furniture/storage/drawer-archive` | ARC-01, ARC-02 | ✅ | 12 × 23 tiroirs (3 × 5,5 m ; largeur 1–3 m, hauteur 2–5,5 m) ; tiroirs sortis (quelques-uns, aucun, beaucoup) ; frise de 2 trains de rouages qui avancent d'une dent par à-coups (option `gears`) ; `userData.archive` (setDrawer, slide, cellCenter) ; tranches ambre ou cyan ; 3 700 triangles, 3 draw calls |
| 6 | `props/books/data-cassette` | ARC-03, ARC-12 | ✅ | cassette (36 triangles) couchée, debout ou en pile de 2 à 8 ; tranche ambre, cyan, vert ou rouge coupée en 1 à 3 traits (code de la graine) ; usure neuve, servie, usée ; rouleau-bande sur bobine, bout déroulé gravé de 3 à 5 traits (ou pile de 3) ; épaisseur forcée à 2,4 cm pour tenir un pixel |
| 6 | `buildings/structure/rolling-ladder` | ARC-04 | ✅ | 2,4–5 m, marches plates au pas de 0,30 m, inclinaison 9–12° ; rail de 3 m à +0,2 m (option) ; origine au pied de la façade ; `userData.ladder` (foot, top, rungs, setSlide) ; 560 triangles, 2 draw calls |
| 6 | `furniture/tables/stone-table` | ARC-05, ETU-10, E2-04, E5-05, table de E6-06 | ✅ | lecture, observation (feutre, rebord), transcription (bois noirci, carnets, encrier, plume), dissection (rigoles, feutre), support ; plateau en 1 à 3 dalles, angle écorné ; `userData.surface` ; pièces de céladon (E5-05), loupe et gants (ETU-10) à poser avec leurs lots |
| 6 | `furniture/lighting/articulated-lamp` | ARC-06, ATE-09 | ✅ | lecture (3 segments, cloche ambre) ou atelier (2 bras, contrepoids, cône noir à l'intérieur pâle) ; posée, à l'étau, suspendue ; allumée, en veille, éteinte ; halo ; `userData.arm.setPose` ; 660 triangles, 2 draw calls |
| 7 | `props/tools/arm-magnifier` | ARC-07 (+ loupes de ATE-14 et ETU-10) | ✅ | lecture (Ø 0,20 m, bras 0,6 m), binoculaire (2 lentilles, 2 oculaires, bras 0,4 m), observation (Ø 0,15 m) ; sur socle lesté ou à l'étau ; verre clair jauni à reflet d'1 px ; `userData.arm.setPose({ yaw, pitch, tilt })`, `userData.lens` (centre, axe) ; 710 triangles, 2 draw calls |
| 7 | `furniture/seating/bronze-stool` | ARC-08, ATE-10 | ✅ | lecture (cuir goudronné, clous de laiton, 3 pieds croisés, bague à la croisée) ou atelier (0,65 m, bois noirci en 2–3 planches, repose-pieds en anneau) ; `userData.seats` ; 570 triangles, 2 draw calls |
| 7 | `props/machines/complex-cart` | ARC-10, GAL-08, ATE-11 | ✅ | à cassettes (3 plateaux, rangées debout et piles, tranches des 4 couleurs), d'instruments (sondes, rouleaux de câble, boîtier à cadran et voyant), lourd (madriers, roues de bois cerclées de fer, timon baissé ou relevé, caisse, lingots, ébauche de roue) ; chargé, à moitié, vide ; `userData.cart.roll(d)` (roues et roulettes), `setDrawbar`, `handle`, `userData.surfaces` ; ≤ 3 000 triangles, 2 draw calls |
| 7 | `props/machines/crank-recorder` | ARC-11, ETU-05, E4-06 | ✅ | visionneuse (fenêtre ambre où défile une bande, 2 oculaires, 2 bobines), tambour (papier enfumé, trace en ruban), cylindre (cire à sillons, pavillon de laiton) ; à l'arrêt ou en marche (12 images/s) ; `userData.recorder.setRunning` ; ≤ 800 triangles, 2–3 draw calls |
| 7 | `furniture/storage/display-case` | ARC-15, E6-06 | ✅ | conservation (piètement de pierre fumée, caisson bombé en 4 pans, cadran d'hygrométrie ; tablette gravée, rouleaux ou vide) ou cuve à échantillon (fruit de cristal cyan dans un liquide, 1 à 4 en rang) ; verre en trame (`dither`) sans contour ; `userData.surface` ; ≤ 1 700 triangles, 3 draw calls |
| 8 | `buildings/structure/spiral-stair` | ARC-13, E6-05, COE-02 | ✅ | pierre (nez de laiton) ou caillebotis ; 2–6 m, marches de 0,18 m (19 pour 3,4 m, 22 pour 4 m) en éventail sur un tour au plus, palier de 64° ouvert face à +z ; sens gauche ou droite ; noyau, limon, rampe sur barreaux ; `userData.walk`, `userData.stair` ; 3 400 triangles, 3 draw calls |
| 8 | `buildings/structure/straight-stair` | escaliers de E5-06, E10-04, escalier de service de E7 | ✅ | caillebotis sur limons rivetés, gradins de pierre, service (fonte, 0,9 m, raide, deux lisses) ; rampes gauche, droite, deux, aucune ; palier en option ; centré sur son emprise ; `userData.walk`, `userData.stair` ; ≤ 5 500 triangles, 3 draw calls |
| 8 | `buildings/structure/grating-walkway` | ARC-14, E5-06, E6-04, COE-01 | ✅ | droite (2–24 m) ou arc (≤ 180° : un balcon de 300° = deux arcs ; rayon 2–6 m) ; mezzanine (lisse, sous-lisse, plinthe) ou anneau (double lisse) ; consoles de pierre ou piliers ; bouts fermés ou ouverts ; trouées (`openings` pour les mondes) ; on voit au travers ; `userData.walk` ; ≤ 5 000 triangles, 3 draw calls |
| 8 | `furniture/tables/card-catalogue` ★ | ARC-17 | ✅ | Ø 3,4 m : 48 tiroirs (2 rangs, 8 secteurs) à plaques d'index, plateau en 8 dalles à anneau de glyphes ambre et filets de laiton, pupitre octogonal tournant à 8 casiers de cassettes lumineuses, lampe articulée suspendue (2,8 m) ; rangé, consulté, abandonné ; vie (pupitre d'un cran, tiroir qui sort) ; `userData.catalogue` (setDrawer, slide, turnTo, consult, setLife) ; 5 900 triangles, 5 draw calls |
| 9 | `furniture/tables/workbench` | ATE-01, ATE-14 | ⬜ | |
| 9 | `props/machines/metal-lathe` | ATE-02 | ⬜ | |
| 9 | `props/machines/coil-furnace` | ATE-03 | ⬜ | |
| 9 | `props/tools/anvil` | ATE-04, E4-01 | ⬜ | |
| 9 | `furniture/storage/tool-rack` | ATE-05 | ⬜ | |
| 10 | `props/tools/artisan-tools` | ATE-06, ETU-12, E6-07 | ⬜ | |
| 10 | `furniture/storage/parts-shelf` | ATE-07, E2-05, ETU-14 | ⬜ | |
| 10 | `props/machines/cable-reel` | ATE-08 | ⬜ | |
| 10 | `props/machines/oil-drum` | ATE-13 | ⬜ | |
| 10 | `furniture/tables/light-table` | ATE-15 | ⬜ | |
| 11 | `buildings/structure/riveted-beam` | ATE-16 (+ rails de E10-05 et de ETU-08) | ⬜ | |
| 11 | `props/machines/hoist-gantry` | ATE-12, E10-05 | ⬜ | |
| 11 | `props/machines/cable-tray` | GAL-04, ETU-06 | ⬜ | |
| 12 | `buildings/structure/gallery-bay` | GAL-01, GAL-14 | ⬜ | |
| 12 | `buildings/structure/observation-window` | GAL-03 (+ fenêtre de E10-04) | ⬜ | |
| 12 | `buildings/structure/rotunda-floor` | GAL-10, ORA-01 | ⬜ | |
| 12 | `buildings/structure/vault-shell` | dômes de E7, E8, E9, berceau de E10 (visibles en plan cadré intérieur) | ⬜ | |
| 13 | `props/machines/sensor-tripod` | ETU-01, ETU-02, ETU-03, E4-05 (+ caméras à soufflet de E7) | ⬜ | |
| 13 | `props/machines/recording-console` | ETU-04, E5-07, E9-07, COE-04 | ⬜ | |
| 13 | `props/machines/probe-gantry` | ETU-08 | ⬜ | |
| 13 | `props/machines/isolation-cage` | ETU-09, E5-01 | ⬜ | |
| 13 | `props/machines/arc-projector` | ETU-11, E2-02, E3-07, E6-08, E10-06 | ⬜ | |
| 14 | `props/decor/chalk-board` | ETU-13 | ⬜ | |
| 14 | `buildings/structure/brass-floor-ring` | E1-02, E6-02, E9-04, cercles de E4, ligne de ETU-15 | ⬜ | |
| 14 | `props/machines/test-altar` | E1-01 | ⬜ | |
| 14 | `props/machines/sensor-crown` | E1-03 | ⬜ | |
| 14 | `props/machines/glass-bell` | E1-04 | ⬜ | |
| 15 | `props/machines/torsion-balance` | E1-05 | ⬜ | |
| 15 | `props/artifacts/key-disc` ★ | E1-A1 | ⬜ | |
| 15 | `props/machines/projection-screen` | E2-03, E3-04 | ⬜ | |
| 15 | `props/artifacts/master-cassette` ★ | E2-A1 | ⬜ | |
| 16 | `props/machines/optical-bench` | E3-01, E3-02, E3-03 | ⬜ | |
| 16 | `props/decor/heavy-curtain` | E3-05 (+ rideau de E2) | ⬜ | |
| 16 | `buildings/structure/wall-panel` | E3-06, E4-04, ORA-08 | ⬜ | |
| 16 | `props/artifacts/phase-prism` ★ | E3-A1 | ⬜ | |
| 17 | `props/machines/strike-arm` | E4-02 | ⬜ | |
| 17 | `props/machines/sand-table` | E4-03 | ⬜ | |
| 17 | `props/decor/honor-rack` | E4-07 | ⬜ | |
| 17 | `props/artifacts/resonant-hammer` ★ | E4-A1 | ⬜ | |
| 18 | `buildings/structure/scaffold` | E5-04 | ⬜ | |
| 18 | `props/machines/wake-harness` | E5-03 | ⬜ | |
| 18 | `props/artifacts/artisan-automaton` ★ | E5-A1 (compte double : l'asset le plus complexe) | ⬜ | |
| 19 | `buildings/structure/trial-dais` | E6-01, ORA-02, E10-01 | ⬜ | |
| 19 | `props/machines/observation-pod` | E6-03, E9-05 | ⬜ | |
| 19 | `props/artifacts/memory-tree` ★ | E6-A1 | ⬜ | |
| 20 | `props/machines/cooling-tank` | COE-06 | ⬜ | |
| 20 | `props/machines/wall-gauge` | COE-09 | ⬜ | |
| 20 | `props/machines/insulator-column` | COE-11 | ⬜ | |
| 20 | `props/machines/extractor-fan` | COE-13 | ⬜ | |
| 20 | `furniture/seating/operator-chair` | COE-05 | ⬜ | |
| 21 | `buildings/structure/energy-pit` | fosse du Cœur | ⬜ | |
| 21 | `props/artifacts/the-heart` ★ | E7-A1 | ⬜ | |
| 22 | `buildings/structure/processional-path` | ORA-03, E10-02 | ⬜ | |
| 22 | `furniture/lighting/brazier` | ORA-04 | ⬜ | |
| 22 | `buildings/structure/circular-tiers` | ORA-05 | ⬜ | |
| 22 | `props/machines/resonance-bell` | ORA-09 | ⬜ | |
| 23 | `props/artifacts/oracle` ★ | E8-A1 | ⬜ | |
| 23 | `props/machines/lock-triptych` ★ | ORA-14 | ⬜ | |
| 24 | `buildings/structure/mirror-basin` | E9-01 | ⬜ | |
| 24 | `props/machines/zenith-telescope` | E9-02, E9-03 | ⬜ | |
| 24 | `props/machines/winch` | E9-06 | ⬜ | |
| 24 | `props/artifacts/dome-orrery` ★ | E9-A1 | ⬜ | |
| 25 | `props/machines/measuring-frame` | E10-03 | ⬜ | |
| 25 | `buildings/structure/control-cabin` | E10-04 | ⬜ | |
| 25 | `props/artifacts/coordinate-stele` ★ | E10-A1 (les 6 stèles) | ⬜ | |
| 25 | `props/artifacts/alignment-circle` ★ | E10-A1 (le cercle) | ⬜ | |
| 26 | `props/artifacts/hex-star-gate` ★ | E10-A1 (l'arche et sa membrane, séquence commune avec stèles et cercle) | ⬜ | |

Monde : `worlds/interiors/ancient-complex` — pièces assemblées : le Sas (et son vestibule), lot 5 ; les Archives, lot 8. Monde d'essai (hors plan) :
`worlds/interiors/complex-test` (Sas, Archives, Atelier, tronçon de Galerie, avec les assets des lots 1 à 4) ; son
kit (`src/worlds/kit/interior.js`, vue en coupe du moteur, explorateur générique) servira au lot 5.

## Décisions

Choix validés par l'utilisateur (ou faits en route et à confirmer), à respecter dans les lots suivants.

| Date | Décision | Statut |
|---|---|---|
| 2026-11-17 | La bible HD est gardée en entier dans l'idée ; seule la façon de dessiner change (traduction pixel art de `README.md`). | validé |
| 2026-11-17 | Les fiches voisines partagent un module avec réglages : 170 fiches → 100 modules. | validé |
| 2026-11-17 | Budgets : asset normal < 5 000 triangles, ≤ 3 draw calls ; héros et artefacts ≤ 8 000 triangles, ≤ 4 à 6 draw calls ; aucune texture. | validé |
| 2026-11-17 | Le Complexe est un seul monde intérieur, vu en coupe (plafonds masqués, murs côté caméra abaissés), une pièce à la fois. | validé |
| 2026-11-17 | Chaque salle d'étude est faite avec son artefact (au lieu de tous les artefacts à la fin) pour finir chaque salle complète. | validé |
| 2026-11-17 | L'arche hexagonale de la salle 10 est un nouvel asset ; la Porte des étoiles existante (anneau) reste à part. | validé |
| 2026-11-17 | Lot 1 validé sur proposition : dalle (intacte, fissurée, usée, trappe, tachée ; rainure sombre ou ambre), mur (plein, niche, conduit ; hauteur 4–14 m, courbure, doublage cuivre), colonne (carrée chanfreinée, cannelée, engagée, pilastre ; fibre cyan), voûte à caissons (crochet), porte (standard, d'étude, double, de liaison, de secours ; état et séquence d'ouverture pilotable). | validé |
| 2026-11-17 | Matières du Complexe à part des matières existantes : `STONES.blackBasalt` (le `basalt` des rochers et du portail ne change pas), `smoked`, métaux, verres, tissus, lueurs `GLOWS` ; rochers et pupitre du portail limités à leurs anciennes matières. | validé |
| 2026-11-17 | Le matériau toon gagne l'option `tone` (attribut `aTone`, décalage de lumière par sommet) : suie, tons par bloc, usure, sans texture. Sans effet sur les assets qui ne l'utilisent pas. | validé |
| 2026-11-17 | Lot 2 validé tel quel : origine au sol pour les luminaires suspendus (`height` = hauteur de l'ampoule, `chain` jusqu'au plafond), halo désactivé par défaut (le monde attribue les 4 lumières de halo), valve géante à roue couchée. | validé |
| 2026-11-17 | Lot 1 validé tel quel : portes pivotantes vers l'arrière livrées avec leur morceau de mur, chambranle dans la pierre du mur (un ton plus clair), dalles posées à y = −0,20. | validé |
| 2026-11-18 | Lot 3 validé tel quel. | validé |
| 2026-11-18 | Lot 3 : casier fermé par défaut (portes ouvertes par le scénario) ; caillebotis courbe du Cœur fait dès le lot 3. | demandé par l'utilisateur |
| 2026-11-18 | Lot 4 validé tel quel : Porte-Iris centrée à 1,40 m, ouverture Ø 2,80 m (au lieu de 1,5 m et 2,6 m) pour un passage de 1,44 m sur le seuil et un sommet à 2,80 m comme les portes ; livrée avec son pan de mur de 6 m ; glyphes éteints quand elle est fermée. | validé |
| 2026-11-18 | Lot 5, proposition validée : vestibule de 6 × 4 m au sud de l'Iris (départ dehors), Iris qui se scelle derrière soi, porte nord qui s'ouvre sur le noir, réglage `state` (vérification, éveillé, endormi) avec séquence au pupitre, bancs au nord de part et d'autre de la porte, monde d'essai gardé jusqu'au lot 12. | validé |
| 2026-11-18 | Lot 5, faits en route : Porte-Iris décorée côté Sas (côté vestibule, on voit son dos sombre) ; rainures allumées ramenées à un ambre sourd ; file d'attente en deux lignes de poteaux ; une lampe sur deux en veille (choisie par la graine) ; fiche de la galerie en état éveillé, explorateur en vérification avec le mannequin. | validé |
| 2026-11-18 | Vue en coupe : les murs, portes et piliers d'angle entre le personnage et la caméra sont masqués en entier, plus coupés à 1,20 m (le moignon faisait moche en vue isométrique). Aussi dans le monde d'essai. | demandé par l'utilisateur |
| 2026-11-19 | Lot 7, proposition validée telle quelle ; faits en route : verre des vitrines en trame (36 % des pixels), liquide de la cuve à 48 % (au-delà il cachait le fruit) ; trace du tambour en ruban plat ; fenêtre de la visionneuse agrandie à 0,22 × 0,09 m, allumée même à l'arrêt ; le cylindre de cire tourne deux fois plus vite que la manivelle. | validé |
| 2026-11-19 | Lot 7 validé tel quel. | validé |
| 2026-11-19 | Lot 8 validé tel quel. | validé |
| 2026-11-19 | Lot 8, proposition validée telle quelle ; faits en route : passerelle en arc bornée à 180° (budget), rayon ≤ 6 m ; catalogue : glyphes couchés dans le plateau (pas sur la tranche), lampe attachée à 2,8 m ; Archives : rayonnages de 2,65 m partout, un seul modèle par sorte de meuble, pas d'ombre pour les rayonnages et les petits objets des tables (budget) ; trois appliques à 6 m au-dessus des rayonnages nord pour éclairer la mezzanine ; tables écartées (allée de 1,2 m) ; côté sud des Archives caché vu du Sas ; les deux pièces visibles à moins de 3 m de la porte nord ouverte. | validé |
| 2026-11-18 | Lot 6 validé tel quel. | validé |
| 2026-11-18 | Lot 6, proposition validée ; rouages des rayonnages ajoutés dès ce lot (demande de l'utilisateur). | validé |
| 2026-11-18 | Lot 6, faits en route : façade du rayonnage en faces plates (1 100 triangles pour 276 tiroirs) avec une réserve de 6 vrais tiroirs ; rouages en roues pleines lues en trois anneaux ; vert des cassettes à part des lueurs du Complexe (`DATA_GLOWS`) ; serti des cassettes foncé pour que la tranche ambre ressorte ; carnets de la table en bronze (pas de matériau en plus) ; échelle inclinée de 9 à 12°, pied à ~0,9 m de la façade. | validé |
| 2026-11-17 | Les personnages du projet (blob, mannequin, mannequin magique, héroïne, héros, barre) peuvent être mis dans le Complexe et s'y déplacer dans toute la carte : chaque pièce est praticable (étages, escaliers, obstacles, portes qui s'ouvrent). | demandé par l'utilisateur |

## Journal des sessions

| Date | Ce qui a été fait | Prochaine étape |
|---|---|---|
| 2026-11-19 | Lot 8 validé ; travail poussé aussi sur la branche `complexe` (demande de l'utilisateur). | Lot 9 : propositions à discuter. |
| 2026-11-19 | Lot 8 (propositions validées telles quelles) : escalier à vis, escalier droit, passerelle, meuble-catalogue ★ ; les Archives dans le monde (une pièce à la fois, mezzanine praticable par escalier à vis, balade jusqu'à la mezzanine, simulée sans blocage aux rayons 0,30 et 0,45 m) ; captures isométriques et 3e personne, bureau et mobile ; 76 draw calls et 151 000 triangles dans les Archives ; assets existants revérifiés ; Atelier publié (v48). | Validation du lot 8, puis lot 9. |
| 2026-11-19 | Lot 7 validé ; travail poussé aussi sur la branche `complexe` (demande de l'utilisateur). | Lot 8 : propositions à discuter. |
| 2026-11-19 | Lot 7 (propositions validées telles quelles) : loupe, tabouret, chariot, appareil à manivelle, vitrine ; vérifiés en planches, en gros plan et dans le coin des Archives (jour, nuit, mobile, bureau) ; assets existants revérifiés (mêmes avertissements qu'avant) ; Atelier publié (v47). | Validation du lot 7, puis lot 8. |
| 2026-11-18 | Lot 6 validé ; travail poussé aussi sur la branche `complexe` (demande de l'utilisateur). | Lot 7 : propositions à discuter. |
| 2026-11-18 | Lot 6 : rayonnage à tiroirs et ses rouages, cassette et rouleau, échelle roulante, table de pierre (5 modèles), lampe articulée (lecture, atelier) ; vérifiés en planches, en gros plan et dans le coin des Archives (jour, nuit, mobile, bureau) ; assets existants revérifiés après les changements du kit ; Atelier publié (v46). | Validation du lot 6, puis lot 7. |
| 2026-11-18 | Lot 5 validé (« c'est bon on garde ») ; travail poussé aussi sur la branche `complexe` (demande de l'utilisateur). | Lot 6 : propositions à discuter. |
| 2026-11-18 | Retour sur le lot 5 (« c'est bon pour la pièce ») : murs côté caméra masqués en entier au lieu d'être coupés à 1,20 m ; Atelier republié. | Validation du lot 5, puis lot 6. |
| 2026-11-18 | Lot 5 : le monde du Complexe avec le Sas et son vestibule (états, vérification au pupitre, vague de glyphes, lampes qui s'allument, poussière, brume tramée, seuil de l'Iris à 0,20 m) ; traversé par les six personnages en balade auto ; captures mobile, bureau, isométrique et 3e personne ; 81 à 87 draw calls ; Atelier publié. | Validation du lot 5, puis lot 6. |
| 2026-11-18 | Lot 4 validé ; travail poussé aussi sur la branche `complexe` (demande de l'utilisateur). | Lot 5 : propositions à discuter. |
| 2026-11-18 | Lot 4 : Porte-Iris, malle, rambarde de bronze, lampe portative (kit : blocs en arc, plaques en biseau, pièces rigides dans un maillage ; moteur : trame `dither`), vérifiés en planches, en gros plan, dans le coin du Sas (jour, nuit, mobile) et dans le monde d'essai ; Atelier publié (v43). | Validation du lot 4, puis lot 5. |
| 2026-11-18 | Monde d'essai retouché (retours de l'utilisateur) : toujours la nuit, 12 lumières de halo dans le moteur (11 pour les lampes vues, même de loin), plafond à caissons en 3e personne, caméra suiveuse qui ne traverse plus les murs, départ face à la porte des Archives. | Retours sur le monde d'essai, puis lot 4. |
| 2026-11-18 | Lot 3 validé. Monde d'essai du Complexe (demande de l'utilisateur) : 4 pièces praticables, vue en coupe (moteur), portes automatiques, halos des lampes proches, explorateur rendu générique ; Atelier publié. | Retours sur le monde d'essai, puis lot 4. |
| 2026-11-18 | Lot 3 : banc, casier, pupitre à leviers, grille et caillebotis, plaque à glyphes (kit : `gridBlock`), vérifiés en planches et dans le coin du Sas de jour et de nuit, mobile et bureau, Atelier publié (v40). | Validation du lot 3, puis lot 4. |
| 2026-11-17 | Lecture de la bible HD (document Claude Docs), adaptation au pixel art dans `docs/complexe/` (README, PIECES, SALLES), plan en 28 lots (PLAN), ce suivi. | Validation de la bible et du plan, puis lots 0 et 1. |
| 2026-11-17 | Ajout à la bible et au plan : les personnages se déplacent dans le Complexe (README « Les personnages dans le Complexe », PLAN lot 5 et étapes Monde). | Validation de la bible et du plan, puis lots 0 et 1. |
| 2026-11-17 | Lot 2 validé ; travail poussé aussi sur la branche `complexe` (demande de l'utilisateur). | Lot 3 : propositions à discuter. |
| 2026-11-17 | Lot 1 validé. Lot 2 : lampe, lustre, tuyau, valve, câbles (kit : scintillement, pièces orientées, seuils de métal réglables), vérifiés en planches et dans le coin du Sas de jour et de nuit (halos), Atelier publié (v28). | Validation du lot 2, puis lot 3. |
| 2026-11-17 | Lot 0 validé. Lot 1 : les 5 modules (kit étendu : maçonnerie, cintrage, fût cannelé, lueurs mêlées), vérifiés à l'image (planches, coin du Sas avec le mannequin, jour et nuit, mobile et bureau), Atelier publié (v27). | Validation du lot 1, puis lot 2. |
| 2026-11-17 | Bible, plan et propositions du lot 1 validés. Lot 0 : palettes, briques `kit/complex-parts.js`, option `tone`, sous-catégories `props/machines`, `props/artifacts`, `worlds/interiors`, axes `metal` et `glow`, nuancier capturé de jour et dans le noir. | Validation du lot 0, puis lot 1. |
