// Version lointaine d'un arbre (ou de tout modèle à feuillage) : mêmes matériaux, donc mêmes couleurs, même vent et
// mêmes contours, mais une fraction des triangles. Vu à plus de 50 m, un arbre ne fait que quelques dizaines de
// pixels d'art : le feuillage garde une feuille sur huit ou neuf (plutôt celles du bord, qui font la silhouette),
// agrandies pour couvrir la même couronne, et le bois ne garde que le tronc et les maîtresses branches.

import * as THREE from "three";

/**
 * @param {THREE.Object3D} prototype modèle complet (non modifié : ses géométries restent à lui)
 * @param {object} [options]
 * @param {number} [options.keep] part des feuilles gardées (0..1)
 * @param {number} [options.wood] rayon minimal d'une branche gardée, en part du rayon du tronc (0..1)
 * @returns {THREE.Group} modèle allégé, aux mêmes noms de maillages et aux mêmes matériaux
 */
export function createFarVersion(prototype, { keep = 0.14, wood = 0.2 } = {}) {
  const far = new THREE.Group();
  far.name = `${prototype.name} (loin)`;
  /** Agrandissement des feuilles gardées, appliqué par le shader (uniform `uLod`) : le modèle complet s'y fond
   * progressivement en approchant de la distance de passage, puis la version lointaine prend le relais. */
  far.userData.grow = Math.min(1.8, 0.7 / Math.sqrt(keep));
  prototype.updateMatrixWorld(true);
  prototype.traverse((child) => {
    if (!child.isMesh) return;
    const attributes = child.geometry.attributes;
    let geometry = null;
    if (attributes.aCorner && attributes.aLeaf) geometry = thinLeaves(child.geometry, keep);
    else if (attributes.aRadius) geometry = keepBranches(child.geometry, wood);
    if (!geometry) return;
    const mesh = new THREE.Mesh(geometry, child.material);
    mesh.name = child.name;
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(child.matrixWorld);
    mesh.matrixWorld.copy(child.matrixWorld);
    mesh.castShadow = false;
    mesh.receiveShadow = child.receiveShadow;
    far.add(mesh);
  });
  return far;
}

/** Hachage stable d'un entier en 0..1 (le même arbre lointain d'une fois à l'autre). */
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Feuillage (non indexé) : une feuille = les triangles consécutifs de même centre (`position`). On en garde une
 * part, davantage au bord de la couronne (`aLeaf.y` : 0 au cœur, 1 dehors), et on agrandit leurs coins (`aCorner`)
 * pour que la couronne reste aussi pleine.
 */
function thinLeaves(source, keep) {
  if (source.index) return null;
  const position = source.attributes.position.array;
  const leaf = source.attributes.aLeaf.array;
  const count = source.attributes.position.count;
  const kept = [];
  // Le modèle complet apprend quelles feuilles survivent au loin (`aFar`), pour s'effacer en douceur vers sa
  // version lointaine.
  const farFlag = new Float32Array(count);
  let leafIndex = 0;
  for (let start = 0; start < count; ) {
    let end = start + 3;
    while (end < count && position[end * 3] === position[start * 3] && position[end * 3 + 1] === position[start * 3 + 1] && position[end * 3 + 2] === position[start * 3 + 2]) end += 3;
    const outer = leaf[start * 4 + 1];
    if (hash(leafIndex++) < keep * (0.4 + 1.2 * outer)) {
      kept.push(start, end);
      farFlag.fill(1, start, end);
    }
    start = end;
  }
  source.setAttribute("aFar", new THREE.BufferAttribute(farFlag, 1));
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const size = attribute.itemSize;
    let total = 0;
    for (let i = 0; i < kept.length; i += 2) total += kept[i + 1] - kept[i];
    const array = new attribute.array.constructor(total * size);
    let offset = 0;
    for (let i = 0; i < kept.length; i += 2) {
      const part = attribute.array.subarray(kept[i] * size, kept[i + 1] * size);
      array.set(part, offset);
      offset += part.length;
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(array, size));
  }
  geometry.boundingSphere = source.boundingSphere?.clone() ?? null;
  return geometry;
}

/**
 * Bois : seuls les triangles des branches assez épaisses (`aRadius`, tous leurs sommets) restent. Le modèle complet
 * apprend quels sommets survivent (`aFar`) : le reste s'efface par trame avant le passage (shader, `uLod`).
 */
function keepBranches(source, share) {
  const radius = source.attributes.aRadius.array;
  let max = 0;
  for (const r of radius) max = Math.max(max, r);
  const limit = max * share;
  const farFlag = new Float32Array(radius.length);
  for (let i = 0; i < radius.length; i++) farFlag[i] = radius[i] >= limit ? 1 : 0;
  if (!source.index) farFlag.fill(1); // bois non indexé : gardé en entier
  source.setAttribute("aFar", new THREE.BufferAttribute(farFlag, 1));
  const geometry = source.clone();
  if (source.index) {
    const index = source.index.array;
    const kept = [];
    for (let i = 0; i < index.length; i += 3) {
      if (farFlag[index[i]] && farFlag[index[i + 1]] && farFlag[index[i + 2]]) kept.push(index[i], index[i + 1], index[i + 2]);
    }
    geometry.setIndex(kept);
  }
  return geometry;
}
