---
paths:
  - "src/**"
  - "**/*.js"
  - "**/*.html"
---

# Code three.js

- Charger les skills `threejs-fundamentals` et `threejs-performance` avant d'écrire ou modifier du rendu, plus le
  skill propre à la tâche (shaders, postprocessing, geometry...).
- Respecter `docs/ART-DIRECTION.md` (render target basse réso en NearestFilter, caméra orthographique, toon,
  contours, palette) et les budgets de `docs/PERFORMANCE.md`.
- Imports : `import * as THREE from "three"` et addons via `three/addons/...`.
- Tout ce qui est créé (géométrie, matériau, texture, render target) a un chemin de `dispose()`.
