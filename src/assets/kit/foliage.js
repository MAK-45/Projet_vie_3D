// Outils de feuillage partagés par les arbres et buissons : remplir une touffe de feuilles face caméra, semer des
// feuilles tombées au sol. Produit des descriptions de feuilles pour `buildLeafGeometry` (kit/geometry.js).

import * as THREE from "three";

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/**
 * Normale d'éclairage d'une feuille : surtout la direction depuis le centre de sa touffe (masses éclairées d'un
 * côté, sombres de l'autre), un peu celle depuis le centre de l'arbre, un peu vers le haut.
 */
export function leafNormal(position, direction, canopyCenter, canopyWeight = 0.4) {
  return direction.clone()
    .addScaledVector(position.clone().sub(canopyCenter).normalize(), canopyWeight)
    .addScaledVector(UP, 0.25)
    .normalize();
}

/**
 * Remplit une touffe (sphère aplatie) de feuilles réparties sur sa coque, avec un cœur sombre qui bouche les trous.
 *
 * @param {ReturnType<import("./rng.js").createRng>} rng
 * @param {object[]} leaves tableau où ajouter les feuilles
 * @param {object} options
 * @param {THREE.Vector3} options.center centre de la touffe
 * @param {number} options.radius rayon de la touffe (mètres)
 * @param {number} options.count nombre de feuilles (≈ 105 × rayon² pour une touffe pleine)
 * @param {THREE.Vector3} options.canopyCenter centre de la couronne (pour l'éclairage)
 * @param {() => number} options.leafSize tirage de la demi-taille d'une feuille (≥ 0,075 m)
 * @param {number} [options.squash] aplatissement vertical (1 = sphère)
 * @param {number} [options.sag] affaissement du dessous (0..1)
 * @param {number} [options.canopyWeight] part de la direction depuis le centre de l'arbre dans l'éclairage
 * @param {boolean} [options.core] ajouter le cœur sombre (deux grands triangles)
 * @param {[number, number]} [options.flex] souplesse au vent des feuilles [min, max]
 * @param {number} [options.coreSize] taille du cœur sombre (× rayon) ; au-delà de 0,5 il dépasse en triangles noirs
 * @param {number} [options.shell] profondeur minimale des feuilles (0..1 du rayon) : plus haut = masse plus nette
 * @returns {Array<{position: THREE.Vector3, direction: THREE.Vector3}>} les points de surface tirés (pour y
 *   accrocher des fleurs, des fruits, des brins pendants)
 */
export function fillClump(rng, leaves, {
  center, radius, count, canopyCenter, leafSize, squash = 0.85, sag = 0.35, canopyWeight = 0.4, core = true,
  flex = [0.55, 1], coreSize = 0.44, shell = 0.4,
}) {
  if (core) {
    for (const rotation of [0, Math.PI]) {
      leaves.push({ position: center, normal: DOWN, size: radius * coreSize, rotation, phase: rng.next(), occlusion: 0, variation: 0, flex: 0.3 });
    }
  }
  const surface = [];
  const scale = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const y = rng.range(-1, 1);
    const angle = rng.range(0, TAU);
    const ring = Math.sqrt(1 - y * y);
    const direction = new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
    const k = shell + (1 - shell) * Math.sqrt(rng.next());
    scale.set(radius * k, radius * k * squash, radius * k);
    const position = center.clone().add(direction.clone().multiply(scale));
    if (y < 0) position.y -= y * y * radius * sag;
    leaves.push({
      position,
      normal: leafNormal(position, direction, canopyCenter, canopyWeight),
      size: leafSize(),
      rotation: rng.range(-0.9, 0.9),
      phase: rng.next(),
      occlusion: THREE.MathUtils.smoothstep(k, shell, 0.95) * (0.8 + 0.2 * (y * 0.5 + 0.5)),
      variation: rng.next(),
      flex: rng.range(flex[0], flex[1]),
    });
    if (k > 0.85) surface.push({ position, direction });
  }
  return surface;
}

/**
 * Feuilles tombées à plat au pied d'un arbre, dans un anneau [minRadius, maxRadius].
 * Les donner plus claires que voulu : leur contour les assombrit (voir recipes.md, contours).
 */
export function fallenLeaves(rng, leaves, { count, minRadius, maxRadius, leafSize }) {
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, TAU);
    const distance = rng.range(minRadius, maxRadius);
    leaves.push({
      position: new THREE.Vector3(Math.cos(angle) * distance, 0.04, Math.sin(angle) * distance),
      normal: UP,
      size: leafSize(),
      rotation: rng.range(0, TAU),
      phase: rng.next(),
      occlusion: 1,
      variation: rng.next(),
      flex: 0,
    });
  }
}
