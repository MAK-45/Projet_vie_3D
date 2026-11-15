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
