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
 * Morceau de sol d'un monde sans bord : une grille raccordable comme celle de `buildTerrainChunk` (attribut
 * `aGround` en coordonnées du monde, aucune couture avec les voisins), mais qui n'évalue la hauteur qu'une fois
 * par sommet (les normales viennent des sommets voisins, calculés sur une rangée de plus tout autour), et dont les
 * triangles sont partagés entre deux matériaux : le pré (groupe 0) et la roche nue (groupe 1, là où
 * `rockiness` dépasse 0,5 en moyenne sur le triangle). Une jupe courte, cachée sous les voisins, bouche les fentes
 * entre deux morceaux de finesse différente.
 *
 * @param {object} options
 * @param {number} options.size côté (m)
 * @param {number} options.spacing écart entre deux sommets (m)
 * @param {[number, number]} options.origin centre du morceau dans le monde [X, Z]
 * @param {(x: number, z: number) => number} options.height hauteur du sol
 * @param {(x: number, z: number, h: number, slope: number) => number} [options.rockiness] roche nue (> 0,5)
 * @param {number} [options.edgeSpacing] écart des sommets le long des bords (multiple de `spacing`) : les sommets
 *   intermédiaires du bord sont posés sur la droite entre leurs voisins. Deux morceaux de finesses différentes
 *   ont alors le même bord, sans fente que la passe de contours soulignerait d'un trait sombre.
 * @returns {{geometry: THREE.BufferGeometry, rock: boolean}} `rock` : le morceau a des triangles de roche
 */
export function buildGroundPatch(options) {
  const steps = buildGroundPatchSteps(options);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

/**
 * `buildGroundPatch` en étapes, pour l'étaler sur plusieurs images : s'arrête (`yield`) toutes les `rows`
 * rangées de sommets ; la dernière étape rend le résultat.
 * @param {Parameters<typeof buildGroundPatch>[0] & {rows?: number}} options
 */
export function* buildGroundPatchSteps({ size, spacing, origin, height, rockiness = () => 0, edgeSpacing = spacing, rows = 16 }) {
  const n = Math.max(1, Math.round(size / spacing));
  const half = size / 2;
  const step = size / n;
  const [ox, oz] = origin;
  // Coordonnée locale d'une colonne, exacte aux bords : deux morceaux voisins tombent sur les mêmes valeurs.
  const local = (k) => (k === n ? half : -half + k * step);
  const W = n + 3;
  const H = new Float32Array(W * W);
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < W; j++) H[i * W + j] = height(ox + (j === 0 ? -half - step : local(j - 1)), oz + (i === 0 ? -half - step : local(i - 1)));
    if (i % rows === rows - 1) yield;
  }
  const count = (n + 1) * (n + 1);
  const edge = 4 * (n + 1) * 2;
  const positions = new Float32Array((count + edge) * 3);
  const normals = new Float32Array((count + edge) * 3);
  const ground = new Float32Array((count + edge) * 2);
  const rocky = new Float32Array(count);
  let lowest = Infinity;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const v = i * (n + 1) + j;
      const g = (i + 1) * W + j + 1;
      const h = H[g];
      const dx = (H[g + 1] - H[g - 1]) / (2 * step);
      const dz = (H[g + W] - H[g - W]) / (2 * step);
      const len = Math.hypot(dx, 1, dz);
      const x = local(j);
      const z = local(i);
      positions[v * 3] = x;
      positions[v * 3 + 1] = h;
      positions[v * 3 + 2] = z;
      normals[v * 3] = -dx / len;
      normals[v * 3 + 1] = 1 / len;
      normals[v * 3 + 2] = -dz / len;
      ground[v * 2] = ox + x;
      ground[v * 2 + 1] = oz + z;
      rocky[v] = rockiness(ox + x, oz + z, h, Math.hypot(dx, dz));
      if (i === 0 || j === 0 || i === n || j === n) lowest = Math.min(lowest, h);
    }
    if (i % rows === rows - 1) yield;
  }

  const at = (i, j) => i * (n + 1) + j;
  // Bords : les sommets entre deux sommets de la grille du bord prennent la moyenne de leurs voisins.
  const stride = Math.max(1, Math.round(edgeSpacing / step));
  if (stride > 1 && n % stride === 0) {
    const snap = (v, a, b, t) => {
      for (let c = 0; c < 3; c++) {
        positions[v * 3 + c] = positions[a * 3 + c] + (positions[b * 3 + c] - positions[a * 3 + c]) * t;
        normals[v * 3 + c] = normals[a * 3 + c] + (normals[b * 3 + c] - normals[a * 3 + c]) * t;
      }
    };
    for (let k = 0; k <= n; k++) {
      const r = k % stride;
      if (r === 0) continue;
      const k0 = k - r;
      const k1 = k0 + stride;
      const t = r / stride;
      snap(at(0, k), at(0, k0), at(0, k1), t);
      snap(at(n, k), at(n, k0), at(n, k1), t);
      snap(at(k, 0), at(k0, 0), at(k1, 0), t);
      snap(at(k, n), at(k0, n), at(k1, n), t);
    }
  }
  const grass = [];
  const rock = [];
  const triangle = (a, b, c) => ((rocky[a] + rocky[b] + rocky[c]) / 3 > 0.5 ? rock : grass).push(a, b, c);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Diagonale alternée : pas de « peigne » visible dans le relief.
      const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
      if ((i + j) % 2 === 0) {
        triangle(a, b, c);
        triangle(c, b, d);
      } else {
        triangle(a, d, c);
        triangle(a, b, d);
      }
    }
  }

  // Jupe : quatre bandes verticales, normales vers l'extérieur, jusqu'un peu sous le point le plus bas du bord.
  const bottom = lowest - 0.8;
  const sides = [
    { from: (k) => at(0, k), normal: [0, 0, -1] },
    { from: (k) => at(k, n), normal: [1, 0, 0] },
    { from: (k) => at(n, n - k), normal: [0, 0, 1] },
    { from: (k) => at(n - k, 0), normal: [-1, 0, 0] },
  ];
  let next = count;
  for (const side of sides) {
    const start = next;
    for (let k = 0; k <= n; k++) {
      const v = side.from(k);
      for (let layer = 0; layer < 2; layer++) {
        positions[next * 3] = positions[v * 3];
        positions[next * 3 + 1] = layer === 0 ? positions[v * 3 + 1] : bottom;
        positions[next * 3 + 2] = positions[v * 3 + 2];
        normals.set(side.normal, next * 3);
        ground[next * 2] = ground[v * 2];
        ground[next * 2 + 1] = ground[v * 2 + 1];
        next += 1;
      }
    }
    for (let k = 0; k < n; k++) {
      const a = start + k * 2;
      const b = a + 2;
      grass.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("aGround", new THREE.BufferAttribute(ground, 2));
  const total = grass.length + rock.length;
  const index = count + edge > 65535 ? new Uint32Array(total) : new Uint16Array(total);
  index.set(grass);
  index.set(rock, grass.length);
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  if (rock.length > 0) {
    geometry.addGroup(0, grass.length, 0);
    geometry.addGroup(grass.length, rock.length, 1);
  }
  geometry.computeBoundingSphere();
  return { geometry, rock: rock.length > 0 };
}
