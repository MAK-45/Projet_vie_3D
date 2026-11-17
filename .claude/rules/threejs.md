---
paths:
  - "src/**"
  - "dev/**"
  - "**/*.js"
  - "**/*.html"
---

# Code three.js

- Charger les skills `threejs-fundamentals` et `threejs-performance` avant d'écrire ou modifier du rendu, plus le
  skill propre à la tâche (shaders, postprocessing, geometry...).
- Respecter `docs/ART-DIRECTION.md` et les budgets de `docs/PERFORMANCE.md`.
- Le rendu passe par `src/engine/` : `PixelRenderer` (cible basse résolution + passe de contours, canvas agrandi
  en CSS), `IsoCamera` (orthographique, orbitale), `ChaseCamera` (perspective, 3e personne de l'explorateur), `createToonMaterial` (rampe de couleurs, sRGB brut).
  Tout ce qui est dessiné utilise `createToonMaterial` : les matériaux standard de three.js n'écrivent pas la
  2e sortie (normales + identifiants) que lit la passe de contours.
- Imports : `import * as THREE from "three"` et addons via `three/addons/...`.
- Tout ce qui est créé (géométrie, matériau, texture, render target) a un chemin de `dispose()`.
- Pas d'allocation dans la boucle de rendu ; animations du décor dans les shaders (uniform de temps partagé).
