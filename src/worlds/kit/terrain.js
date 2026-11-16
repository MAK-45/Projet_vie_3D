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
