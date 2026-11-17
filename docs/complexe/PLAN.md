# Le Complexe : plan d'implémentation par lots

Le Complexe compte 170 fiches (`PIECES.md`, `SALLES.md`). En pixel art, les fiches voisines partagent un module
(par exemple les cinq lampes à filament de la bible deviennent deux modules avec des réglages) : on arrive à **une
centaine de modules**, réalisés par **lots de 4 à 5 assets**, une ou deux sessions Claude Code par lot. L'état de chaque
lot est tenu dans `SUIVI.md`.

## Déroulé d'un lot (à chaque session)

1. **Reprendre** : lire `SUIVI.md` (où on en est), puis la partie de la bible qui concerne le lot (`README.md` pour la
   direction artistique, `PIECES.md` ou `SALLES.md` pour les fiches), `docs/ART-DIRECTION.md`, `docs/PERFORMANCE.md`.
2. **Annoncer** à l'utilisateur ce qui est fait, ce qui reste, et le lot suivant avec ses assets.
3. **Discuter** avant de coder : pour chaque asset du lot, proposer en quelques lignes les traits qui le font
   reconnaître en pixels, ce que change la graine, les réglages (variantes, états), le rangement. L'utilisateur
   corrige ou valide la proposition.
4. **Réaliser** chaque asset avec le skill `create-asset` (jusqu'au bout : `npm run check`, `npm run sheet`,
   capture regardée) ; une étape « monde » avec le skill `create-world`.
5. **Publier** : `npm run artifact`, puis publier sur l'Atelier Vie 3D (lien dans `CLAUDE.md`) et donner le lien.
6. **Noter** dans `SUIVI.md` : le lot passe à « à valider », avec la date, les commits et les remarques ; committer et
   pousser.
7. **Valider** : quand l'utilisateur dit que c'est bon (« je valide »), passer le lot (et ses assets) à « validé » dans
   `SUIVI.md`, noter la date et les décisions prises, committer. Puis proposer le lot suivant.

Un lot n'est jamais marqué « validé » sans le feu vert explicite de l'utilisateur. Si l'utilisateur demande une
retouche sur un lot déjà validé, il repasse à « en cours » le temps de la retouche.

## Correspondance et ordre des lots

Légende : ★ artefact ou asset héros (budget élargi, `README.md`). Une étape « Monde » ajoute au monde
`worlds/interiors/ancient-complex` la pièce dont tous les assets existent.

### Lot 0 — Préparation (pas d'asset)

- Palettes du Complexe dans `src/assets/kit/palettes.js` : basalte noir-bleu (ajuster `basalt` ou en ajouter un),
  pierre fumée, bronze patiné (ombre vert-de-gris), laiton noirci, cuivre oxydé, fonte, verre ambre et cyan, cuir
  goudronné, feutre, bois noirci ; rampes émissives ambre, cyan, rouge.
- Briques techniques dans `src/assets/kit/complex-parts.js` : bande de glyphes à traits droits (et son pendant à
  courbes pour les artefacts), cadran, levier, ampoule à filament, rangée de rivets en pointillé, bague, chaîne,
  câble tressé le long d'une courbe. Testées par les assets du lot 1.
- Taxonomie : sous-catégories `props/machines`, `props/artifacts`, `worlds/interiors`.
- Vérifier que ces tons tiennent dans le noir (`setDarkness`) : planche de nuancier rapide (capture).
- Se fait dans la même session que le lot 1.

### Lot 1 — Ossature du Sas

| Module | Fiches |
|---|---|
| `buildings/structure/glyph-floor-slab` | SAS-01 (+ sols de l'Atelier, de E4, de E10) |
| `buildings/structure/glyph-wall` | SAS-02 (+ tous les murs : courbes pour les salles rondes, doublage cuivre de E2) |
| `buildings/structure/glyph-column` | SAS-03, ARC-09, GAL-11, ORA-06 (+ pilastres de E6, E7) |
| `buildings/structure/coffered-vault` | SAS-04 (+ plafond de E6) |
| `buildings/structure/complex-door` | Porte standard, GAL-02, GAL-13, ORA-07, issue de secours de E7 |

### Lot 2 — Lumière et réseaux

| Module | Fiches |
|---|---|
| `furniture/lighting/filament-lamp` | SAS-05, GAL-05 |
| `furniture/lighting/filament-chandelier` | ARC-16, GAL-12, ORA-13 |
| `props/machines/copper-pipe` | SAS-09, COE-07 |
| `props/machines/wheel-valve` | SAS-10, COE-08 |
| `props/machines/braided-cable` | SAS-11, ETU-07, COE-14, ORA-11 |

### Lot 3 — Mobilier du Sas

| Module | Fiches |
|---|---|
| `furniture/seating/stone-bench` | SAS-06, GAL-07, ORA-10, E5-02 |
| `furniture/storage/equipment-locker` | SAS-07, COE-10 |
| `props/machines/lever-desk` | SAS-08, GAL-09, E2-01 |
| `buildings/structure/vent-grate` | SAS-12, COE-12 |
| `props/decor/glyph-plaque` | SAS-14, GAL-06, ORA-12, plaque de COE-15 |

### Lot 4 — La Porte-Iris et le balisage

| Module | Fiches |
|---|---|
| `buildings/structure/iris-door` ★ | SAS-17 |
| `furniture/storage/travel-trunk` | SAS-13 |
| `buildings/structure/bronze-railing` | SAS-15, ETU-15, COE-03, barrière de COE-15 |
| `props/tools/hand-lamp` | SAS-16 |

### Lot 5 — Monde : le Sas (étape monde, skill `create-world`)

- Le monde `worlds/interiors/ancient-complex` (asset de la catégorie « Mondes »), réglage `room`, avec le Sas seul.
- Kit d'intérieur dans `src/worlds/kit/` : lumière de service invisible + `setDarkness`, attribution des lumières de
  halo aux sources proches (le moteur en a 4 : étendre à 8 si les pièces le demandent, en mesurant le coût), vue en
  coupe (plafonds masqués, murs côté caméra abaissés selon l'angle), brouillard tramé, poussière près des lampes.
- Explorateur : pas de ciel ni de mer de nuages en intérieur, caméra bornée à la pièce.
- Test d'échelle : mannequin de 1,80 m, porte de 2,80 m, commandes à 1,10–1,30 m. Captures mobile et bureau.

### Lot 6 — Archives : rangement

| Module | Fiches |
|---|---|
| `furniture/storage/drawer-archive` | ARC-01, ARC-02 |
| `props/books/data-cassette` | ARC-03, ARC-12 |
| `buildings/structure/rolling-ladder` | ARC-04 |
| `furniture/tables/stone-table` | ARC-05, ETU-10, E2-04, E5-05, table de E6-06 |
| `furniture/lighting/articulated-lamp` | ARC-06, ATE-09 |

### Lot 7 — Archives : lecture

| Module | Fiches |
|---|---|
| `props/tools/arm-magnifier` | ARC-07 (+ loupes de ATE-14 et ETU-10) |
| `furniture/seating/bronze-stool` | ARC-08, ATE-10 |
| `props/machines/complex-cart` | ARC-10, GAL-08, ATE-11 |
| `props/machines/crank-recorder` | ARC-11, ETU-05, E4-06 |
| `furniture/storage/display-case` | ARC-15, E6-06 |

### Lot 8 — Archives : hauteur et catalogue, puis Monde : les Archives

| Module | Fiches |
|---|---|
| `buildings/structure/spiral-stair` | ARC-13, E6-05, COE-02 |
| `buildings/structure/straight-stair` | escaliers de E5-06, E10-04, escalier de service de E7 |
| `buildings/structure/grating-walkway` | ARC-14, E5-06, E6-04, COE-01 |
| `furniture/tables/card-catalogue` ★ | ARC-17 |

Monde : les Archives rejoignent le Sas (porte nord du Sas), mezzanine praticable.

### Lot 9 — Atelier : établis et forge

| Module | Fiches |
|---|---|
| `furniture/tables/workbench` | ATE-01, ATE-14 |
| `props/machines/metal-lathe` | ATE-02 |
| `props/machines/coil-furnace` | ATE-03 |
| `props/tools/anvil` | ATE-04, E4-01 |
| `furniture/storage/tool-rack` | ATE-05 |

### Lot 10 — Atelier : outils et réserves

| Module | Fiches |
|---|---|
| `props/tools/artisan-tools` | ATE-06, ETU-12, E6-07 |
| `furniture/storage/parts-shelf` | ATE-07, E2-05, ETU-14 |
| `props/machines/cable-reel` | ATE-08 |
| `props/machines/oil-drum` | ATE-13 |
| `furniture/tables/light-table` | ATE-15 |

### Lot 11 — Atelier : levage, puis Monde : l'Atelier

| Module | Fiches |
|---|---|
| `buildings/structure/riveted-beam` | ATE-16 (+ rails de E10-05 et de ETU-08) |
| `props/machines/hoist-gantry` | ATE-12, E10-05 |
| `props/machines/cable-tray` | GAL-04, ETU-06 |

Monde : l'Atelier rejoint les Archives (porte est), le four porte sa lueur orange.

### Lot 12 — Galerie et Rotonde, puis Monde : la circulation

| Module | Fiches |
|---|---|
| `buildings/structure/gallery-bay` | GAL-01, GAL-14 |
| `buildings/structure/observation-window` | GAL-03 (+ fenêtre de E10-04) |
| `buildings/structure/rotunda-floor` | GAL-10, ORA-01 |
| `buildings/structure/vault-shell` | dômes de E7, E8, E9, berceau de E10 (visibles en plan cadré intérieur) |

Monde : couloir Atelier → Galerie (48 m, 12 travées) → Rotonde ; portes des dix salles posées, fermées.

### Lot 13 — Kit d'étude : capteurs et consoles

| Module | Fiches |
|---|---|
| `props/machines/sensor-tripod` | ETU-01, ETU-02, ETU-03, E4-05 (+ caméras à soufflet de E7) |
| `props/machines/recording-console` | ETU-04, E5-07, E9-07, COE-04 |
| `props/machines/probe-gantry` | ETU-08 |
| `props/machines/isolation-cage` | ETU-09, E5-01 |
| `props/machines/arc-projector` | ETU-11, E2-02, E3-07, E6-08, E10-06 |

### Lot 14 — Salle 1, la Clef : le matériel

| Module | Fiches |
|---|---|
| `props/decor/chalk-board` | ETU-13 |
| `buildings/structure/brass-floor-ring` | E1-02, E6-02, E9-04, cercles de E4, ligne de ETU-15 |
| `props/machines/test-altar` | E1-01 |
| `props/machines/sensor-crown` | E1-03 |
| `props/machines/glass-bell` | E1-04 |

### Lot 15 — La Clef-Disque et la Cassette-Maître, puis Monde : salles 1 et 2

| Module | Fiches |
|---|---|
| `props/machines/torsion-balance` | E1-05 |
| `props/artifacts/key-disc` ★ | E1-A1 |
| `props/machines/projection-screen` | E2-03, E3-04 |
| `props/artifacts/master-cassette` ★ | E2-A1 |

### Lot 16 — Le Prisme, puis Monde : salle 3

| Module | Fiches |
|---|---|
| `props/machines/optical-bench` | E3-01, E3-02, E3-03 |
| `props/decor/heavy-curtain` | E3-05 (+ rideau de E2) |
| `buildings/structure/wall-panel` | E3-06, E4-04, ORA-08 |
| `props/artifacts/phase-prism` ★ | E3-A1 |

### Lot 17 — Le Marteau, puis Monde : salle 4

| Module | Fiches |
|---|---|
| `props/machines/strike-arm` | E4-02 |
| `props/machines/sand-table` | E4-03 |
| `props/decor/honor-rack` | E4-07 |
| `props/artifacts/resonant-hammer` ★ | E4-A1 |

### Lot 18 — L'Éveil, puis Monde : salle 5

| Module | Fiches |
|---|---|
| `buildings/structure/scaffold` | E5-04 |
| `props/machines/wake-harness` | E5-03 |
| `props/artifacts/artisan-automaton` ★ | E5-A1 (compte double : l'asset le plus complexe) |

### Lot 19 — L'Arbre de Mémoire, puis Monde : salle 6

| Module | Fiches |
|---|---|
| `buildings/structure/trial-dais` | E6-01, ORA-02, E10-01 |
| `props/machines/observation-pod` | E6-03, E9-05 |
| `props/artifacts/memory-tree` ★ | E6-A1 |

### Lot 20 — Le Cœur : la machinerie

| Module | Fiches |
|---|---|
| `props/machines/cooling-tank` | COE-06 |
| `props/machines/wall-gauge` | COE-09 |
| `props/machines/insulator-column` | COE-11 |
| `props/machines/extractor-fan` | COE-13 |
| `furniture/seating/operator-chair` | COE-05 |

### Lot 21 — Le Cœur, puis Monde : salle 7

| Module | Fiches |
|---|---|
| `buildings/structure/energy-pit` | fosse du Cœur |
| `props/artifacts/the-heart` ★ | E7-A1 |

### Lot 22 — L'Oracle : l'amphithéâtre

| Module | Fiches |
|---|---|
| `buildings/structure/processional-path` | ORA-03, E10-02 |
| `furniture/lighting/brazier` | ORA-04 |
| `buildings/structure/circular-tiers` | ORA-05 |
| `props/machines/resonance-bell` | ORA-09 |

### Lot 23 — L'Oracle et le Triptyque, puis Monde : salle 8

| Module | Fiches |
|---|---|
| `props/artifacts/oracle` ★ | E8-A1 |
| `props/machines/lock-triptych` ★ | ORA-14 |

### Lot 24 — L'Orrery, puis Monde : salle 9

| Module | Fiches |
|---|---|
| `buildings/structure/mirror-basin` | E9-01 |
| `props/machines/zenith-telescope` | E9-02, E9-03 |
| `props/machines/winch` | E9-06 |
| `props/artifacts/dome-orrery` ★ | E9-A1 |

### Lot 25 — La salle de la Porte : instruments et coordonnées

| Module | Fiches |
|---|---|
| `props/machines/measuring-frame` | E10-03 |
| `buildings/structure/control-cabin` | E10-04 |
| `props/artifacts/coordinate-stele` ★ | E10-A1 (les 6 stèles) |
| `props/artifacts/alignment-circle` ★ | E10-A1 (le cercle) |

### Lot 26 — La Porte des Étoiles, puis Monde : salle 10

| Module | Fiches |
|---|---|
| `props/artifacts/hex-star-gate` ★ | E10-A1 (l'arche et sa membrane, séquence commune avec stèles et cercle) |

### Lot 27 — Finitions

- Test d'échelle de tout le Complexe (mannequin, portes, marches, commandes, dégagements de l'Orrery et du Cœur).
- Mesures de perf par pièce (draw calls, triangles) sur mobile émulé ; corrections.
- Le fil narratif en démonstration : la créature va chercher les trois clés, les insère dans le Triptyque, l'Oracle
  s'éveille, la Porte s'ouvre (quand le moteur de scénario `src/script/` existera ; sinon séquences pilotées à la main).
- Mise à jour de la bible si des choix ont changé en route, publication finale.

## Points techniques à trancher en route

- **Lumières de halo** (lot 5) : 4 emplacements aujourd'hui ; attribution dynamique aux sources proches, ou extension.
- **Vue en coupe** (lot 5) : quels murs abaisser selon l'azimut, à quelle hauteur ; comportement en plan cadré.
- **Pièces mobiles nombreuses** (Oracle, Arbre, Orrery, Porte-Iris) : rotation par indice de pièce dans le vertex
  shader du matériau toon (un draw call) plutôt qu'un mesh par pièce ; à ajouter au moteur la première fois (lot 4).
- **Séquences partagées** (Triptyque → Oracle, stèles → arche) : horloge et événements communs, sur le modèle de
  `src/assets/kit/portal.js`.
- **Petits objets** (Clef, Cassette, Prisme, Marteau, outils) : taille réelle, lisibles au zoom 4 ; vérifier sur la
  planche au zoom 4.
