// Outils de géométrie partagés par les assets : tubes effilés (troncs, branches), feuilles, fusion.

import * as THREE from "three";

const _tangent = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _binormal = new THREE.Vector3();
const _previousTangent = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _point = new THREE.Vector3();

/**
 * Tube effilé le long d'une courbe passant par `points` (tronc, branche, tige).
 * Attributs : position, normal, uv (x : tour 0..1, y : longueur parcourue en unités), aRadius (pour le motif
 * d'écorce du matériau toon).
 *
 * @param {THREE.Vector3[]} points points de passage (au moins 2)
 * @param {(t: number) => number} radiusAt rayon en fonction de la position 0..1 le long du tube
 * @param {object} [options]
 * @param {number} [options.radialSegments] côtés du tube
 * @param {number} [options.lengthSegments] anneaux
 * @param {number} [options.vOffset] décalage du motif le long du tube
 */
export function buildTube(points, radiusAt, { radialSegments = 6, lengthSegments = 8, vOffset = 0 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
  const rings = lengthSegments + 1;
  const ringSize = radialSegments + 1;
  const vertexCount = rings * ringSize;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const radii = new Float32Array(vertexCount);
  const indices = [];

  let travelled = 0;
  const previousPoint = new THREE.Vector3();

  for (let i = 0; i < rings; i++) {
    const t = i / lengthSegments;
    curve.getPoint(t, _point);
    curve.getTangent(t, _tangent);

    if (i === 0) {
      // Premier repère : n'importe quelle perpendiculaire à la tangente.
      _normal.set(1, 0, 0);
      if (Math.abs(_tangent.x) > 0.9) _normal.set(0, 0, 1);
      _normal.addScaledVector(_tangent, -_normal.dot(_tangent)).normalize();
    } else {
      // Transport parallèle : le repère suit la courbe sans vriller.
      _axis.crossVectors(_previousTangent, _tangent);
      const sin = _axis.length();
      if (sin > 1e-6) {
        _axis.divideScalar(sin);
        _normal.applyAxisAngle(_axis, Math.asin(Math.min(1, sin)));
      }
      _normal.addScaledVector(_tangent, -_normal.dot(_tangent)).normalize();
      travelled += _point.distanceTo(previousPoint);
    }
    _binormal.crossVectors(_tangent, _normal);
    _previousTangent.copy(_tangent);
    previousPoint.copy(_point);

    const radius = Math.max(0.0005, radiusAt(t));
    for (let j = 0; j < ringSize; j++) {
      const angle = (j / radialSegments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const nx = _normal.x * cos + _binormal.x * sin;
      const ny = _normal.y * cos + _binormal.y * sin;
      const nz = _normal.z * cos + _binormal.z * sin;
      const v = i * ringSize + j;
      positions[v * 3] = _point.x + nx * radius;
      positions[v * 3 + 1] = _point.y + ny * radius;
      positions[v * 3 + 2] = _point.z + nz * radius;
      normals[v * 3] = nx;
      normals[v * 3 + 1] = ny;
      normals[v * 3 + 2] = nz;
      uvs[v * 2] = j / radialSegments;
      uvs[v * 2 + 1] = vOffset + travelled;
      radii[v] = radius;
    }
  }

  for (let i = 0; i < lengthSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringSize + j;
      const b = a + ringSize;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute("aRadius", new THREE.BufferAttribute(radii, 1));
  geometry.setIndex(indices);
  geometry.userData.curve = curve;
  return geometry;
}

/**
 * Fusionne des géométries indexées qui ont les mêmes attributs en une seule (un seul draw call).
 * Les géométries d'entrée sont libérées.
 */
export function mergeGeometries(geometries) {
  const merged = new THREE.BufferGeometry();
  const names = Object.keys(geometries[0].attributes);
  let vertexCount = 0;
  let indexCount = 0;
  for (const geometry of geometries) {
    vertexCount += geometry.attributes.position.count;
    indexCount += geometry.index.count;
  }
  for (const name of names) {
    const itemSize = geometries[0].attributes[name].itemSize;
    const array = new Float32Array(vertexCount * itemSize);
    let offset = 0;
    for (const geometry of geometries) {
      array.set(geometry.attributes[name].array, offset);
      offset += geometry.attributes[name].array.length;
    }
    merged.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
  }
  const index = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let indexOffset = 0;
  let vertexOffset = 0;
  for (const geometry of geometries) {
    const source = geometry.index.array;
    for (let i = 0; i < source.length; i++) index[indexOffset + i] = source[i] + vertexOffset;
    indexOffset += source.length;
    vertexOffset += geometry.attributes.position.count;
    geometry.dispose();
  }
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  return merged;
}

// Feuille : triangle pointe en bas (x, y) dans le plan de l'écran, pour une taille de 1.
const LEAF_SHAPE = [0, -1, 0.8, 0.62, -0.8, 0.62];

/**
 * Géométrie de feuillage pour le matériau toon `foliage` : un triangle par feuille, toujours face à la caméra.
 *
 * @param {Array<{
 *   position: THREE.Vector3, normal: THREE.Vector3, size: number, rotation: number,
 *   phase: number, occlusion: number, variation: number, flex: number
 * }>} leaves
 *   - normal : direction d'éclairage de la feuille (en général : du cœur de la touffe vers la feuille)
 *   - occlusion : 0 = au cœur (sombre), 1 = en surface
 *   - flex : souplesse au vent (0 = fixe)
 */
export function buildLeafGeometry(leaves) {
  const count = leaves.length;
  const positions = new Float32Array(count * 9);
  const normals = new Float32Array(count * 9);
  const corners = new Float32Array(count * 6);
  const data = new Float32Array(count * 12);

  for (let i = 0; i < count; i++) {
    const leaf = leaves[i];
    const cos = Math.cos(leaf.rotation) * leaf.size;
    const sin = Math.sin(leaf.rotation) * leaf.size;
    for (let k = 0; k < 3; k++) {
      const v = i * 3 + k;
      positions[v * 3] = leaf.position.x;
      positions[v * 3 + 1] = leaf.position.y;
      positions[v * 3 + 2] = leaf.position.z;
      normals[v * 3] = leaf.normal.x;
      normals[v * 3 + 1] = leaf.normal.y;
      normals[v * 3 + 2] = leaf.normal.z;
      const x = LEAF_SHAPE[k * 2];
      const y = LEAF_SHAPE[k * 2 + 1];
      corners[v * 2] = x * cos - y * sin;
      corners[v * 2 + 1] = x * sin + y * cos;
      data[v * 4] = leaf.phase;
      data[v * 4 + 1] = leaf.occlusion;
      data[v * 4 + 2] = leaf.variation;
      data[v * 4 + 3] = leaf.flex;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("aCorner", new THREE.BufferAttribute(corners, 2));
  geometry.setAttribute("aLeaf", new THREE.BufferAttribute(data, 4));
  return geometry;
}
