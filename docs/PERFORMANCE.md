# Performance et poids

Objectif : **fluide sur téléphone** (60 fps visés, jamais sous 30) et **poids minimal**. Le rendu basse résolution
(voir ART-DIRECTION) aide énormément : peu de pixels à remplir.

## Budgets par monde (téléphone milieu de gamme)

| Mesure | Budget |
|---|---|
| Draw calls | < 100 (viser < 50) |
| Triangles visibles | < 150 k |
| Lumières avec ombres | 1 (la directionnelle) |
| Textures GPU | < 16 Mo au total, KTX2 si texture > 64 px |
| Téléchargement d'un monde | < 300 Ko hors three.js (idéal : quelques Ko, tout procédural) |

## Budget par asset

| Mesure | Budget |
|---|---|
| Triangles | < 5 000 (quelques centaines pour ce qui se pose en grand nombre : herbe, fleur, galet) |
| Draw calls | ≤ 3 (géométries fusionnées par matériau) |
| Textures | aucune : motifs procéduraux du matériau toon |
| Code du module autonome | quelques dizaines de Ko |

`npm run check` mesure chaque asset et signale les dépassements.

Mesurer avec `renderer.info` (draw calls, triangles, géométries, textures) et le noter dans la PR/le message.

## Formats : du plus léger au plus lourd

1. **Procédural en code** (préféré) : terrain, rochers, arbres, meubles construits depuis des `BufferGeometry`
   simples, avec une graine (seed). Un monde entier = quelques Ko de JS, zéro fichier à charger.
2. **Données compactes** : cartes de hauteur / voxels / placements en `Uint8Array`/`Int16Array` (éventuellement en
   base64 ou binaire), pas de JSON verbeux pour des milliers de valeurs.
3. **glTF binaire (`.glb`)** : le format d'échange natif recommandé par three.js, pour les modèles faits à la main
   (créature, objets complexes). Compression **Meshopt** (`EXT_meshopt_compression`, décodage rapide, plus léger à
   charger que Draco) ou **Draco** pour les gros maillages ; quantification des attributs ; textures **KTX2**
   (Basis). Outil : `gltf-transform optimize`.
   - Note : le format JSON de three.js (`ObjectLoader`) est natif mais **plus lourd** que le GLB : ne pas l'utiliser
     pour stocker des assets.

## Règles de code

- Répétitions (herbe, arbres, pierres, livres...) → `InstancedMesh` ou `BatchedMesh`, jamais N meshes.
- Décor statique → fusionner les géométries par matériau (`mergeGeometries`).
- Partager matériaux et géométries ; `dispose()` systématique en quittant un monde.
- Pas d'allocation dans la boucle de rendu (réutiliser `Vector3`, etc.).
- Ombres : une seule shadow map, petite (512–1024), `castShadow` seulement sur ce qui compte, mise à jour
  uniquement quand la lumière bouge si possible.
- `renderer.setPixelRatio` inutile sur la passe basse réso ; plafonner à 2 pour l'UI éventuelle.
- Animations du décor dans les shaders (GPU) plutôt qu'en JS par objet.
- Rendu à la demande quand rien ne bouge n'est pas notre cas (monde vivant) : garder la boucle mais légère.
- Tester sur mobile : Playwright en émulation (ex. `devices['Pixel 7']`) + CPU throttling pour un ordre d'idée.

## Recette : un grand monde vu de loin (vue à la 3e personne)

Mis au point sur la prairie infinie, mesure par mesure sur un téléphone (de 35 à 60 i/s, vue portée de 85 m avec
brume à 185 m sans brume). À reprendre pour toute nouvelle carte dense vue en perspective. Détails et chiffres :
`docs/WORLDS.md`, « Vue à la 3e personne ».

1. **Mesurer d'abord, sur le téléphone.** Le compteur en haut à gauche de l'explorateur donne les i/s en direct
   (un toucher : draw calls et triangles). Dans le navigateur de capture, les i/s ne valent rien (rendu logiciel) :
   on y compare des triangles, des draw calls et des morceaux chargés, pas des i/s. Ce qui a coûté ici, c'est le
   nombre de triangles (surtout les arbres lointains, nombreux car la surface vue grandit comme le carré de la
   distance), pas le remplissage (l'image ne fait que ~200 × 450 pixels d'art).
2. **Finir la vue sans brume : monde courbé.** `setCurvature(x, z, rayon, début)` (`engine/toon-material.js`) fait
   descendre le décor de (d − début)² / 2R à l'affichage : le lointain passe derrière l'horizon, ce qui est caché
   n'est plus à dessiner. Choisir le rayon pour que les plus grands objets (arbres de 15 m) disparaissent juste
   avant la portée de la caméra ; ici R = 400 m, début 20 m, vue 185 m. Petit calcul : le sol est vu jusqu'au minimum
   de (h + chute(d)) / d (h : hauteur de caméra) ; un objet de hauteur H reste visible tant que
   (h + chute(d) − H) / d est sous ce minimum. Les ombres et motifs restent calculés à plat.
3. **Une portée par famille, au plus juste.** `reach` du semis : herbe et fleurs 34 m, ras du sol (`flat` : mousse,
   terre remuée) 75 m, rochers 100 m, arbres jusqu'au bout ; `groundReach` : le sol caché par la courbure n'est
   plus dessiné (100 m). Une famille dont les objets disparaissent tôt derrière l'horizon a sa propre portée.
4. **Version lointaine des modèles lourds.** `farVersion: createFarVersion` dans `addLayer` (`kit/far-tree.js`) :
   mêmes matériaux, une feuille sur six (celles du bord), seulement le gros bois ; ≈ 900 triangles au lieu de
   ≈ 4 000. `lod` donne la distance de passage par famille (50 m).
5. **Jamais d'apparition brusque.** Sans brume, tout saut se voit. Le modèle complet se fond dans sa version
   lointaine avant le passage (`uLod` : feuilles en trop qui rapetissent, bois en trop effacé par trame de Bayer) ;
   le semis rentre dans le sol sur le dernier quart de sa portée (`uFade`). Les deux sont réglés par
   `StreamingScatter` depuis `reach` et `lod`.
6. **Morceaux chargés.** Un disque gardé prêt tout autour (`around`, 110 m) pour se retourner sans saccade ; au-delà,
   seuls les morceaux dans le champ, fabriqués un peu par image. Moins de morceaux, c'est moins de cases parcourues
   à chaque image par le processeur.
7. **Vérifier à l'image ce que la vue de côté révèle.** Les assets sont dessinés pour la vue de haut : de côté,
   leur intérieur se voit (ici, les feuilles sombres du cœur des arbres, en étoiles noires ; corrigé par
   `setSideView`). Capturer de près, à mi-distance et au loin avant de conclure.
