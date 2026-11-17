# Le Complexe : suivi de l'implémentation

**À lire en premier à chaque session sur le Complexe.** Ce fichier dit où on en est. La bible est dans `README.md`,
`PIECES.md` et `SALLES.md` ; le découpage en lots et la marche à suivre dans `PLAN.md`.

## Pour Claude : reprendre le travail

Quand l'utilisateur demande « on en est où ? », « on continue le Complexe », « on reprend l'environnement des
artefacts », ou parle d'un lot :

1. Lire ce fichier en entier, puis `PLAN.md` (déroulé d'un lot) et la partie de la bible du lot concerné.
2. Répondre avec un **point d'étape** court : lots validés, lot en cours ou à valider (et ce qui y reste),
   prochain lot avec ses assets et les fiches qu'ils couvrent.
3. Pour le prochain lot : **discuter d'abord** (proposition par asset : traits reconnaissables en pixels, graine,
   réglages, rangement), puis réaliser avec `create-asset` / `create-world`, publier l'Atelier, et passer le lot à
   **👀 à valider** ici, avec la date et les commits.
4. **Ne passer un lot à ✅ validé que sur le feu vert explicite de l'utilisateur** (« je valide », « c'est bon,
   on continue »). Noter alors la date, et les décisions prises dans « Décisions ».
5. Committer ce fichier à chaque changement d'état (message en français, par exemple « Suivi Complexe : lot 3 validé »).

Légende des états : ⬜ à faire · 🔄 en cours · 👀 fait, à valider par l'utilisateur · ✅ validé · ⏸️ en pause.

## Point d'étape

- **Dernière mise à jour** : 2026-11-17
- **Étape actuelle** : lot 2 (lumière et réseaux) fait, à valider dans l'Atelier (et `dev/complex-corner.html?night=1`).
- **Prochaine action** : validation du lot 2 ; puis lot 3 (mobilier du Sas : banc, casier, pupitre à leviers, grille
  d'aération, plaque d'inscription), à discuter d'abord.

## Les lots

| Lot | Contenu | Assets | État | Date | Commits / remarques |
|---|---|---|---|---|---|
| — | Bible adaptée au pixel art, plan, suivi | — | ✅ validé | 2026-11-17 | docs/complexe/ |
| 0 | Préparation | — | ✅ validé | 2026-11-17 | palettes du Complexe, `kit/complex-parts.js`, option `tone` du matériau, taxonomie, nuancier `dev/complex-swatch.html` |
| 1 | Ossature du Sas | 5 | ✅ validé | 2026-11-17 | dalle, mur, colonne, voûte, portes ; scène d'essai `dev/complex-corner.html` |
| 2 | Lumière et réseaux | 5 | 👀 à valider | 2026-11-17 | lampe, lustre, tuyau, valve, câbles ; ajoutés au coin du Sas (jour et nuit) |
| 3 | Mobilier du Sas | 5 | ⬜ à faire | | |
| 4 | La Porte-Iris et le balisage | 4 | ⬜ à faire | | |
| 5 | Monde : le Sas | — | ⬜ à faire | | |
| 6 | Archives : rangement | 5 | ⬜ à faire | | |
| 7 | Archives : lecture | 5 | ⬜ à faire | | |
| 8 | Archives : hauteur et catalogue, puis Monde : les Archives | 4 | ⬜ à faire | | |
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
| 2 | `furniture/lighting/filament-lamp` | SAS-05, GAL-05 | 👀 | suspendue ou applique ; allumée, en veille, éteinte ; scintillement par paliers ; option halo |
| 2 | `furniture/lighting/filament-chandelier` | ARC-16, GAL-12, ORA-13 | 👀 | lanterne (6), grand lustre (24), anneau de voûte (12) ; ampoules faibles ou mortes selon la graine ; option halo |
| 2 | `props/machines/copper-pipe` | SAS-09, COE-07 | 👀 | droit, coude, T, bout bouché ; mural (colliers) ou géant (brides) ; contre un mur ou sur berceaux |
| 2 | `props/machines/wheel-valve` | SAS-10, COE-08 | 👀 | murale ou géante ; `turn`, boucle, `userData.valve` (setTurn, turnTo) ; l'aiguille suit |
| 2 | `props/machines/braided-cable` | SAS-11, ETU-07, COE-14, ORA-11 | 👀 | fin, d'étude, ombilical, principal ; pendu, au sol, faisceau avec boucle ; `createRoute(points)` |
| 3 | `furniture/seating/stone-bench` | SAS-06, GAL-07, ORA-10, E5-02 | ⬜ | |
| 3 | `furniture/storage/equipment-locker` | SAS-07, COE-10 | ⬜ | |
| 3 | `props/machines/lever-desk` | SAS-08, GAL-09, E2-01 | ⬜ | |
| 3 | `buildings/structure/vent-grate` | SAS-12, COE-12 | ⬜ | |
| 3 | `props/decor/glyph-plaque` | SAS-14, GAL-06, ORA-12, plaque de COE-15 | ⬜ | |
| 4 | `buildings/structure/iris-door` ★ | SAS-17 | ⬜ | |
| 4 | `furniture/storage/travel-trunk` | SAS-13 | ⬜ | |
| 4 | `buildings/structure/bronze-railing` | SAS-15, ETU-15, COE-03, barrière de COE-15 | ⬜ | |
| 4 | `props/tools/hand-lamp` | SAS-16 | ⬜ | |
| 6 | `furniture/storage/drawer-archive` | ARC-01, ARC-02 | ⬜ | |
| 6 | `props/books/data-cassette` | ARC-03, ARC-12 | ⬜ | |
| 6 | `buildings/structure/rolling-ladder` | ARC-04 | ⬜ | |
| 6 | `furniture/tables/stone-table` | ARC-05, ETU-10, E2-04, E5-05, table de E6-06 | ⬜ | |
| 6 | `furniture/lighting/articulated-lamp` | ARC-06, ATE-09 | ⬜ | |
| 7 | `props/tools/arm-magnifier` | ARC-07 (+ loupes de ATE-14 et ETU-10) | ⬜ | |
| 7 | `furniture/seating/bronze-stool` | ARC-08, ATE-10 | ⬜ | |
| 7 | `props/machines/complex-cart` | ARC-10, GAL-08, ATE-11 | ⬜ | |
| 7 | `props/machines/crank-recorder` | ARC-11, ETU-05, E4-06 | ⬜ | |
| 7 | `furniture/storage/display-case` | ARC-15, E6-06 | ⬜ | |
| 8 | `buildings/structure/spiral-stair` | ARC-13, E6-05, COE-02 | ⬜ | |
| 8 | `buildings/structure/straight-stair` | escaliers de E5-06, E10-04, escalier de service de E7 | ⬜ | |
| 8 | `buildings/structure/grating-walkway` | ARC-14, E5-06, E6-04, COE-01 | ⬜ | |
| 8 | `furniture/tables/card-catalogue` ★ | ARC-17 | ⬜ | |
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

Monde : `worlds/interiors/ancient-complex` — pièces assemblées : aucune pour l'instant.

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
| 2026-11-17 | Lot 1 validé tel quel : portes pivotantes vers l'arrière livrées avec leur morceau de mur, chambranle dans la pierre du mur (un ton plus clair), dalles posées à y = −0,20. | validé |
| 2026-11-17 | Les personnages du projet (blob, mannequin, mannequin magique, héroïne, héros, barre) peuvent être mis dans le Complexe et s'y déplacer dans toute la carte : chaque pièce est praticable (étages, escaliers, obstacles, portes qui s'ouvrent). | demandé par l'utilisateur |

## Journal des sessions

| Date | Ce qui a été fait | Prochaine étape |
|---|---|---|
| 2026-11-17 | Lecture de la bible HD (document Claude Docs), adaptation au pixel art dans `docs/complexe/` (README, PIECES, SALLES), plan en 28 lots (PLAN), ce suivi. | Validation de la bible et du plan, puis lots 0 et 1. |
| 2026-11-17 | Ajout à la bible et au plan : les personnages se déplacent dans le Complexe (README « Les personnages dans le Complexe », PLAN lot 5 et étapes Monde). | Validation de la bible et du plan, puis lots 0 et 1. |
| 2026-11-17 | Lot 1 validé. Lot 2 : lampe, lustre, tuyau, valve, câbles (kit : scintillement, pièces orientées, seuils de métal réglables), vérifiés en planches et dans le coin du Sas de jour et de nuit (halos), Atelier publié (v28). | Validation du lot 2, puis lot 3. |
| 2026-11-17 | Lot 0 validé. Lot 1 : les 5 modules (kit étendu : maçonnerie, cintrage, fût cannelé, lueurs mêlées), vérifiés à l'image (planches, coin du Sas avec le mannequin, jour et nuit, mobile et bureau), Atelier publié (v27). | Validation du lot 1, puis lot 2. |
| 2026-11-17 | Bible, plan et propositions du lot 1 validés. Lot 0 : palettes, briques `kit/complex-parts.js`, option `tone`, sous-catégories `props/machines`, `props/artifacts`, `worlds/interiors`, axes `metal` et `glow`, nuancier capturé de jour et dans le noir. | Validation du lot 0, puis lot 1. |
