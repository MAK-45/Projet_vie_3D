// Outils de terrain pour les mondes : la tranche d'une île (terre puis roche, bas déchiqueté) et la normale du sol.

import * as THREE from "three";

/**
 * Normale du sol en un point, par différences centrées sur la fonction de hauteur.
 * @param {(x: number, z: number) => number} height
 * @param {THREE.Vector3} target vecteur à remplir
 */
export function groundNormal(height, x, z, target, e = 0.4) {
  const dx = (height(x + e, z) - height(x - e, z)) / (2 * e);
  const dz = (height(x, z + e) - height(x, z - e)) / (2 * e);
  return target.set(-dx, 1, -dz).normalize();
}

/**
 * Tranche d'une île carrée : une bande verticale qui suit le bord du sol, de `top(x, z)` jusqu'à `bottom(x, z)`.
 * Normales vers l'extérieur. Deux appels (terre, puis roche dessous) donnent les strates d'un diorama.
 *
 * @param {object} options
 * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} options.bounds
 * @param {(x: number, z: number) => number} options.top hauteur du haut de la bande
 * @param {(x: number, z: number) => number} options.bottom hauteur du bas de la bande
 * @param {number} [options.spacing] écart entre deux sommets le long du bord (m)
 */
export function buildIslandBand({ bounds, top, bottom, spacing = 0.5 }) {
  const positions = [];
  const normals = [];
  const index = [];
  const { minX, maxX, minZ, maxZ } = bounds;
  // Chaque côté est parcouru dans le sens qui met la face avant dehors.
  const sides = [
    { from: [minX, minZ], to: [maxX, minZ], normal: [0, 0, -1] },
    { from: [maxX, minZ], to: [maxX, maxZ], normal: [1, 0, 0] },
    { from: [maxX, maxZ], to: [minX, maxZ], normal: [0, 0, 1] },
    { from: [minX, maxZ], to: [minX, minZ], normal: [-1, 0, 0] },
  ];
  for (const side of sides) {
    const length = Math.hypot(side.to[0] - side.from[0], side.to[1] - side.from[1]);
    const n = Math.max(1, Math.round(length / spacing));
    const start = positions.length / 3;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = side.from[0] + (side.to[0] - side.from[0]) * t;
      const z = side.from[1] + (side.to[1] - side.from[1]) * t;
      positions.push(x, top(x, z), z, x, bottom(x, z), z);
      normals.push(...side.normal, ...side.normal);
    }
    for (let k = 0; k < n; k++) {
      const a = start + k * 2;
      const b = a + 2;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}

/**
 * Dessous d'une île flottante : une masse de roche qui part du bas de la tranche et s'effile vers une pointe, comme
 * un rocher arraché au sol. Les anneaux successifs passent du carré de l'île à un cercle de plus en plus étroit ;
 * `noise(x, z)` (0..1) creuse et allonge le profil pour que la silhouette soit déchiquetée. Faces à plat (toon).
 *
 * @param {object} options
 * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} options.bounds
 * @param {(x: number, z: number) => number} options.top hauteur du haut (le bas de la tranche)
 * @param {number} options.depth profondeur de la pointe sous le sol (m, positive)
 * @param {(x: number, z: number) => number} options.noise champ lisse 0..1
 * @param {number} [options.spacing] écart entre deux sommets d'un anneau (m)
 * @param {number} [options.rings] nombre d'anneaux
 */
export function buildIslandUnderside({ bounds, top, depth, noise, spacing = 2, rings = 10 }) {
  const { minX, maxX, minZ, maxZ } = bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const half = Math.max(maxX - minX, maxZ - minZ) / 2;
  // Tour du carré, dans le même sens que la tranche.
  const perimeter = [];
  const corners = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
  for (let s = 0; s < 4; s++) {
    const [ax, az] = corners[s];
    const [bx, bz] = corners[(s + 1) % 4];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / spacing));
    for (let k = 0; k < n; k++) perimeter.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  const count = perimeter.length;
  const grid = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const row = [];
    for (const [px, pz] of perimeter) {
      const angle = Math.atan2(pz - cz, px - cx);
      if (r === 0) {
        row.push([px, top(px, pz), pz]);
        continue;
      }
      // Du carré au cercle, et de plus en plus étroit : flancs presque droits en haut, pointe en bas.
      const round = Math.min(1, t * 1.6);
      const shape = 1 - Math.pow(t, 0.95);
      const wobble = 0.82 + 0.36 * noise(Math.cos(angle) * 40 + r * 7.1, Math.sin(angle) * 40 - r * 3.3);
      const radius = shape * wobble;
      const sx = cx + ((px - cx) * (1 - round) + Math.cos(angle) * half * 0.92 * round) * radius;
      const sz = cz + ((pz - cz) * (1 - round) + Math.sin(angle) * half * 0.92 * round) * radius;
      // Des lobes qui descendent plus bas que d'autres.
      const lobe = 0.75 + 0.5 * noise(Math.cos(angle) * 18 + 5, Math.sin(angle) * 18 - 9);
      const y = top(px, pz) * (1 - t) - depth * Math.pow(t, 0.9) * lobe - (noise(sx * 0.3, sz * 0.3) - 0.5) * 2.5 * (1 - t);
      row.push([sx, y, sz]);
    }
    grid.push(row);
  }
  const positions = [];
  const push = (v) => positions.push(v[0], v[1], v[2]);
  for (let r = 0; r < rings; r++) {
    for (let k = 0; k < count; k++) {
      const a = grid[r][k];
      const b = grid[r][(k + 1) % count];
      const c = grid[r + 1][(k + 1) % count];
      const d = grid[r + 1][k];
      // Même sens que la tranche : face avant tournée vers l'extérieur.
      push(a); push(b); push(d);
      push(b); push(c); push(d);
    }
  }
  // Pointe : le dernier anneau se referme sur un point.
  const last = grid[rings];
  const tip = [cx, -depth * 1.08, cz];
  for (let k = 0; k < count; k++) {
    push(last[k]); push(last[(k + 1) % count]); push(tip);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Morceau de sol carré pour un monde sans bord : même maillage que `buildTerrainChunk` (kit/geometry.js, dessus
 * seulement : position, normale, `aGround` en coordonnées du monde), mais la hauteur n'est lue qu'une fois par
 * point de grille, et les normales viennent des points voisins. Cinq fois moins de calcul, sans couture : un point
 * partagé par deux morceaux voit les mêmes voisins.
 *
 * @param {object} options
 * @param {number} options.size côté (m)
 * @param {number} [options.spacing] écart entre deux sommets (m)
 * @param {number[]} options.origin centre du morceau dans le monde [x, z]
 * @param {(x: number, z: number) => number} options.height hauteur du sol en coordonnées du monde
 */
export function buildGroundPatch({ size, spacing = 0.5, origin, height }) {
  const n = Math.max(1, Math.round(size / spacing));
  const step = size / n;
  const half = size / 2;
  const [ox, oz] = origin;
  // Hauteurs avec une rangée de plus de chaque côté, pour les normales du bord.
  const side = n + 3;
  const heights = new Float32Array(side * side);
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) heights[i * side + j] = height(ox - half + (j - 1) * step, oz - half + (i - 1) * step);
  }
  const count = (n + 1) * (n + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const ground = new Float32Array(count * 2);
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const v = i * (n + 1) + j;
      const g = (i + 1) * side + (j + 1);
      const x = -half + j * step;
      const z = -half + i * step;
      positions[v * 3] = x;
      positions[v * 3 + 1] = heights[g];
      positions[v * 3 + 2] = z;
      const dx = (heights[g + 1] - heights[g - 1]) / (2 * step);
      const dz = (heights[g + side] - heights[g - side]) / (2 * step);
      const len = Math.hypot(dx, 1, dz);
      normals[v * 3] = -dx / len;
      normals[v * 3 + 1] = 1 / len;
      normals[v * 3 + 2] = -dz / len;
      ground[v * 2] = ox + x;
      ground[v * 2 + 1] = oz + z;
    }
  }
  const index = new Uint16Array(n * n * 6);
  const at = (i, j) => i * (n + 1) + j;
  let k = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Diagonale alternée, comme `buildTerrainChunk`.
      const quad = (i + j) % 2 === 0
        ? [at(i, j), at(i + 1, j), at(i, j + 1), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1)]
        : [at(i, j), at(i + 1, j + 1), at(i, j + 1), at(i, j), at(i + 1, j), at(i + 1, j + 1)];
      index.set(quad, k);
      k += 6;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("aGround", new THREE.BufferAttribute(ground, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  return geometry;
}
