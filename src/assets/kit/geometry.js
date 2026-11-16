// Outils de géométrie partagés par les assets : tubes effilés (troncs, branches), feuilles, brins et corolles face
// caméra (herbes, fleurs), rochers à facettes, buttes au sol (neige, mousse, terre), couches drapées sur une surface,
// découpe par orientation des faces, fusion.

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

/**
 * Brins face à la caméra (herbe, tige, feuille longue) pour le matériau toon `foliage` : un ruban le long d'une
 * courbe (base → coude → pointe), dont la largeur est portée dans le plan de l'écran. Un brin ne disparaît donc
 * jamais de profil et garde sa largeur en pixels quel que soit l'angle de vue. Indexée (compatible avec
 * `mergeGeometries` et avec `buildFanGeometry`).
 *
 * L'ombrage va du pied (sombre, `occlusion` 0) à la pointe (claire, occlusion 1) : c'est le dégradé qui fait lire
 * une touffe à quelques pixels de haut.
 *
 * @param {Array<{
 *   base: THREE.Vector3, bend: THREE.Vector3, tip: THREE.Vector3, width: number, tipWidth?: number,
 *   normal: THREE.Vector3, phase: number, variation: number, flex: number, baseOcclusion?: number
 * }>} blades
 *   - bend : point de contrôle de la courbe (courbe de Bézier quadratique) ; width : largeur au pied (mètres)
 *   - tipWidth : largeur à la pointe (0 = pointue) ; flex : souplesse au vent de la pointe (le pied est fixe)
 * @param {{segments?: number}} [options] tronçons le long du brin (1 = un triangle)
 */
export function buildBladeGeometry(blades, { segments = 2 } = {}) {
  const positions = [];
  const normals = [];
  const corners = [];
  const data = [];
  const index = [];
  const point = new THREE.Vector3();
  const push = (blade, t, cornerX) => {
    const u = 1 - t;
    point.set(0, 0, 0)
      .addScaledVector(blade.base, u * u)
      .addScaledVector(blade.bend, 2 * u * t)
      .addScaledVector(blade.tip, t * t);
    positions.push(point.x, point.y, point.z);
    normals.push(blade.normal.x, blade.normal.y, blade.normal.z);
    corners.push(cornerX, 0, 0);
    const base = blade.baseOcclusion ?? 0;
    data.push(blade.phase, base + (1 - base) * t, blade.variation, blade.flex * t * t);
    return positions.length / 3 - 1;
  };

  for (const blade of blades) {
    const tipWidth = blade.tipWidth ?? 0;
    let previous = null;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const half = (blade.width + (tipWidth - blade.width) * t) / 2;
      if (i === segments && tipWidth <= 0) {
        const tip = push(blade, t, 0);
        index.push(previous[0], previous[1], tip);
        break;
      }
      const level = [push(blade, t, -half), push(blade, t, half)];
      if (previous) index.push(previous[0], previous[1], level[1], previous[0], level[1], level[0]);
      previous = level;
    }
  }
  return foliageGeometry(positions, normals, corners, data, index);
}

/**
 * Formes face caméra (corolle de fleur, cœur, épi, bourgeon) pour le matériau toon `foliage` : un polygone en
 * éventail autour d'un point, toujours tourné vers la caméra. Indexée, mêmes attributs que `buildBladeGeometry`.
 *
 * @param {Array<{
 *   position: THREE.Vector3, outline: number[][], size: number, rotation?: number, stretch?: number[],
 *   normal: THREE.Vector3, phase: number, variation: number, flex: number, occlusion?: number
 * }>} fans
 *   - outline : contour [[x, y], ...] pour une taille de 1 (voir `starOutline`) ; stretch : étirement [x, y]
 *   - occlusion : 1 = pleine lumière (défaut), 0 = sombre
 *   - lift : avancée vers la caméra (mètres), quel que soit l'angle de vue. Un cœur de fleur posé au même point que
 *     sa corolle passe devant elle avec 2 à 3 cm, sans traverser les fleurs voisines (pas de `polygonOffset`).
 *   - offset : décalage [x, y] de la forme dans le plan de l'écran (mètres, appliqué après la rotation) ; pour poser
 *     des formes à côté l'une de l'autre autour d'un même point (reflet sur un disque, cratère sur la lune).
 */
export function buildFanGeometry(fans) {
  const positions = [];
  const normals = [];
  const corners = [];
  const data = [];
  const index = [];
  for (const fan of fans) {
    const cos = Math.cos(fan.rotation ?? 0);
    const sin = Math.sin(fan.rotation ?? 0);
    const [sx, sy] = fan.stretch ?? [1, 1];
    const occlusion = fan.occlusion ?? 1;
    const lift = fan.lift ?? 0;
    const [ox, oy] = fan.offset ?? [0, 0];
    const first = positions.length / 3;
    const vertex = (x, y) => {
      positions.push(fan.position.x, fan.position.y, fan.position.z);
      normals.push(fan.normal.x, fan.normal.y, fan.normal.z);
      const cx = x * sx * fan.size;
      const cy = y * sy * fan.size;
      corners.push(cx * cos - cy * sin + ox, cx * sin + cy * cos + oy, lift);
      data.push(fan.phase, occlusion, fan.variation, fan.flex);
    };
    vertex(0, 0);
    for (const [x, y] of fan.outline) vertex(x, y);
    const n = fan.outline.length;
    for (let i = 0; i < n; i++) index.push(first, first + 1 + i, first + 1 + ((i + 1) % n));
  }
  return foliageGeometry(positions, normals, corners, data, index);
}

/**
 * Contour en étoile ou en fleur pour `buildFanGeometry` : `points` pointes de rayon 1 séparées par des creux de
 * rayon `inner` (1 = polygone régulier).
 */
export function starOutline(points, inner = 1) {
  const outline = [];
  const steps = inner === 1 ? points : points * 2;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2 + Math.PI / 2;
    const r = inner === 1 || i % 2 === 0 ? 1 : inner;
    outline.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return outline;
}

/**
 * Formes libres face caméra pour le matériau toon `foliage` : comme `buildFanGeometry`, mais chaque forme donne ses
 * sommets et ses triangles, pour des contours qu'un éventail ne sait pas remplir (croissant de lune, rayon de soleil,
 * bande). Indexée, mêmes attributs que `buildFanGeometry`.
 *
 * @param {Array<{
 *   position: THREE.Vector3, points: number[][], triangles: number[], size?: number, rotation?: number,
 *   normal?: THREE.Vector3, phase?: number, variation?: number, flex?: number, occlusion?: number, lift?: number
 * }>} sprites
 *   - points : sommets [[x, y], ...] dans le plan de l'écran, pour une taille de 1 ; triangles : indices dans `points`
 *   - occlusion, lift, flex : comme `buildFanGeometry` (avec un matériau `unlit`, `flex` pondère la pulsation)
 */
export function buildSpriteGeometry(sprites) {
  const positions = [];
  const normals = [];
  const corners = [];
  const data = [];
  const index = [];
  for (const sprite of sprites) {
    const size = sprite.size ?? 1;
    const cos = Math.cos(sprite.rotation ?? 0) * size;
    const sin = Math.sin(sprite.rotation ?? 0) * size;
    const normal = sprite.normal ?? SPRITE_NORMAL;
    const first = positions.length / 3;
    for (const [x, y] of sprite.points) {
      positions.push(sprite.position.x, sprite.position.y, sprite.position.z);
      normals.push(normal.x, normal.y, normal.z);
      corners.push(x * cos - y * sin, x * sin + y * cos, sprite.lift ?? 0);
      data.push(sprite.phase ?? 0, sprite.occlusion ?? 1, sprite.variation ?? 0.5, sprite.flex ?? 0);
    }
    for (const i of sprite.triangles) index.push(first + i);
  }
  return foliageGeometry(positions, normals, corners, data, index);
}

const SPRITE_NORMAL = new THREE.Vector3(0, 1, 0);

/** Contour d'ellipse (polygone régulier étiré) pour `buildFanGeometry` : `sides` sommets, rayons `rx` et `ry`. */
export function ellipseOutline(sides, rx = 1, ry = rx) {
  const outline = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    outline.push([Math.cos(angle) * rx, Math.sin(angle) * ry]);
  }
  return outline;
}

function foliageGeometry(positions, normals, corners, data, index) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute("aCorner", new THREE.BufferAttribute(new Float32Array(corners), 3));
  geometry.setAttribute("aLeaf", new THREE.BufferAttribute(new Float32Array(data), 4));
  geometry.setIndex(index);
  return geometry;
}

const _rockPoint = new THREE.Vector3();
const _rockEuler = new THREE.Euler();

/**
 * Rocher à facettes franches (rocher, galet, bloc de falaise) : un icosaèdre bosselé puis taillé par des plans
 * tirés de la graine, étiré, tourné et posé. Chaque face a sa propre normale (aplats nets du matériau toon).
 * Attributs : position, normal ; indexée (compatible avec `mergeGeometries`).
 *
 * @param {{range: (min: number, max: number) => number, next: () => number}} rng générateur (kit/rng.js)
 * @param {object} [options]
 * @param {number} [options.detail] subdivision de l'icosaèdre : 0 (20 faces), 1 (80), 2 (320)
 * @param {number} [options.lumps] nombre de bosses
 * @param {number} [options.lumpSize] amplitude des bosses (fraction du rayon)
 * @param {number} [options.cuts] nombre de plans de taille
 * @param {number[]} [options.cutDepth] [min, max] distance des plans au centre (1 = surface) : plus bas = plus taillé
 * @param {number[]} [options.scale] étirement [x, y, z] en mètres (rayons)
 * @param {number[]} [options.rotation] rotation [x, y, z] en radians, appliquée après l'étirement
 * @param {number[]} [options.offset] déplacement [x, y, z] appliqué en dernier
 * @param {number} [options.floorY] les sommets sous cette hauteur y sont ramenés (fond plat, sous le sol)
 */
export function buildRock(
  rng,
  { detail = 1, lumps = 5, lumpSize = 0.2, cuts = 6, cutDepth = [0.72, 0.92], scale = [1, 1, 1], rotation = [0, 0, 0], offset = [0, 0, 0], floorY = -Infinity } = {},
) {
  const source = new THREE.IcosahedronGeometry(1, detail);
  const positions = source.attributes.position.array.slice();
  source.dispose();

  const bumps = [];
  for (let i = 0; i < lumps; i++) {
    bumps.push({ dir: randomDirection(rng), amount: rng.range(-lumpSize, lumpSize), width: rng.range(2, 6) });
  }
  const planes = [];
  for (let i = 0; i < cuts; i++) planes.push({ dir: randomDirection(rng), depth: rng.range(cutDepth[0], cutDepth[1]) });
  _rockEuler.set(rotation[0], rotation[1], rotation[2]);

  for (let i = 0; i < positions.length; i += 3) {
    // Le déplacement ne dépend que de la direction : les sommets partagés restent soudés.
    _rockPoint.set(positions[i], positions[i + 1], positions[i + 2]).normalize();
    let radius = 1;
    for (const bump of bumps) radius += bump.amount * Math.exp(-bump.width * (1 - _rockPoint.dot(bump.dir)));
    _rockPoint.multiplyScalar(radius);
    for (const plane of planes) {
      const distance = _rockPoint.dot(plane.dir) - plane.depth;
      if (distance > 0) _rockPoint.addScaledVector(plane.dir, -distance);
    }
    _rockPoint.set(_rockPoint.x * scale[0], _rockPoint.y * scale[1], _rockPoint.z * scale[2]).applyEuler(_rockEuler);
    _rockPoint.x += offset[0];
    _rockPoint.y = Math.max(_rockPoint.y + offset[1], floorY);
    _rockPoint.z += offset[2];
    positions[i] = _rockPoint.x;
    positions[i + 1] = _rockPoint.y;
    positions[i + 2] = _rockPoint.z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); // non indexée : une normale par face
  geometry.setIndex(sequentialIndex(positions.length / 3));
  return geometry;
}

/**
 * Sépare les faces d'une géométrie en deux selon un test sur la normale de chaque face (neige ou mousse sur le
 * dessus d'un rocher, toit et murs...). La géométrie d'entrée est libérée ; chaque face est copiée telle quelle.
 *
 * @param {THREE.BufferGeometry} geometry indexée ou non, attributs position et normal
 * @param {(normal: THREE.Vector3, center: THREE.Vector3) => boolean} test vrai = la face va dans la 1re géométrie
 * @returns {[THREE.BufferGeometry, THREE.BufferGeometry]} [faces retenues, autres faces] ; l'une peut être vide
 */
export function splitFacesByNormal(geometry, test) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  if (!source.attributes.normal) source.computeVertexNormals();
  const names = Object.keys(source.attributes);
  const count = source.attributes.position.count;
  const kept = [];
  const others = [];
  const normal = new THREE.Vector3();
  const center = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const position = source.attributes.position;
  for (let face = 0; face < count; face += 3) {
    a.fromBufferAttribute(position, face);
    b.fromBufferAttribute(position, face + 1);
    c.fromBufferAttribute(position, face + 2);
    center.copy(a).add(b).add(c).divideScalar(3);
    normal.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    (test(normal, center) ? kept : others).push(face);
  }
  const build = (faces) => {
    const result = new THREE.BufferGeometry();
    for (const name of names) {
      const attribute = source.attributes[name];
      const size = attribute.itemSize;
      const array = new Float32Array(faces.length * 3 * size);
      faces.forEach((face, n) => array.set(attribute.array.subarray(face * size, (face + 3) * size), n * 3 * size));
      result.setAttribute(name, new THREE.BufferAttribute(array, size));
    }
    result.setIndex(sequentialIndex(faces.length * 3));
    return result;
  };
  const result = [build(kept), build(others)];
  if (source !== geometry) source.dispose();
  geometry.dispose();
  return result;
}

function sequentialIndex(count) {
  const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  for (let i = 0; i < count; i++) index[i] = i;
  return new THREE.BufferAttribute(index, 1);
}

function randomDirection(rng) {
  const y = rng.range(-1, 1);
  const angle = rng.range(0, Math.PI * 2);
  const ring = Math.sqrt(1 - y * y);
  return new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
}

/**
 * Butte posée au sol (plaque de neige, tapis de mousse, terre remuée) : disque polaire au contour lobé, dont la
 * hauteur décroît du centre vers le bord ; le bord est juste sous le sol, pour s'y fondre.
 * Attributs : position, normal ; indexée.
 *
 * @param {{range: (min: number, max: number) => number}} rng générateur (kit/rng.js)
 * @param {object} [options]
 * @param {number[]} [options.radius] rayons [x, z] en mètres
 * @param {number} [options.height] hauteur au centre
 * @param {number} [options.lobes] irrégularité du contour (0 = ellipse)
 * @param {number} [options.power] forme du profil : < 1 bombé et plat au sommet, > 1 pointu
 * @param {(x: number, z: number) => number} [options.relief] bosses ajoutées à la hauteur (en mètres), nulles au bord
 * @param {number} [options.rings] anneaux
 * @param {number} [options.sectors] secteurs
 * @param {boolean} [options.flat] facettes franches (terre) au lieu de normales lissées (neige)
 * @param {number[]} [options.offset] position [x, y, z] du centre
 * @param {number} [options.rotation] rotation autour de y
 */
export function buildMound(
  rng,
  { radius = [1, 1], height = 0.2, lobes = 0.2, power = 0.8, relief, rings = 5, sectors = 18, flat = false, offset = [0, 0, 0], rotation = 0 } = {},
) {
  const harmonics = [2, 3, 5].map((k) => ({ k, phase: rng.range(0, Math.PI * 2), amount: rng.range(0.4, 1) / k }));
  const edge = (theta) => 1 + lobes * harmonics.reduce((sum, h) => sum + h.amount * Math.sin(h.k * theta + h.phase), 0);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const positions = [];
  const place = (x, y, z) => positions.push(x * cos - z * sin + offset[0], y + offset[1], x * sin + z * cos + offset[2]);

  const center = height + (relief ? relief(0, 0) : 0);
  place(0, center, 0);
  for (let ring = 1; ring <= rings; ring++) {
    const rho = ring / rings;
    for (let s = 0; s < sectors; s++) {
      const theta = (s / sectors) * Math.PI * 2;
      const e = edge(theta) * rho;
      const x = Math.cos(theta) * radius[0] * e;
      const z = Math.sin(theta) * radius[1] * e;
      const falloff = Math.pow(Math.max(0, 1 - rho * rho), power);
      const y = ring === rings ? -0.02 : height * falloff + (relief ? relief(x, z) * falloff : 0);
      place(x, y, z);
    }
  }
  const index = [];
  for (let s = 0; s < sectors; s++) index.push(0, 1 + ((s + 1) % sectors), 1 + s);
  for (let ring = 1; ring < rings; ring++) {
    const a = 1 + (ring - 1) * sectors;
    const b = 1 + ring * sectors;
    for (let s = 0; s < sectors; s++) {
      const s1 = (s + 1) % sectors;
      index.push(a + s, a + s1, b + s, a + s1, b + s1, b + s);
    }
  }
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  if (flat) {
    const loose = geometry.toNonIndexed();
    geometry.dispose();
    geometry = loose;
    geometry.computeVertexNormals();
    geometry.setIndex(sequentialIndex(geometry.attributes.position.count));
  } else {
    geometry.computeVertexNormals();
  }
  return geometry;
}

/**
 * Dalle de sol carrée (pelouse, dallage, parterre) : un dessus quadrillé à hauteur `height`, bosselé par `relief`,
 * bordé d'une jupe verticale qui descend juste sous le sol. Les bords tombent pile sur ±size/2 : deux dalles
 * posées côte à côte se raccordent sans trou. Attributs : position, normal ; indexée.
 *
 * @param {object} [options]
 * @param {number} [options.size] côté en mètres
 * @param {number} [options.height] hauteur du dessus
 * @param {number} [options.divisions] carreaux par côté
 * @param {(x: number, z: number) => number} [options.relief] bosses ajoutées au dessus (mètres)
 */
export function buildGroundTile({ size = 1, height = 0.03, divisions = 6, relief } = {}) {
  const half = size / 2;
  const n = divisions;
  const positions = [];
  const index = [];
  const top = (i, j) => i * (n + 1) + j;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = -half + (size * j) / n;
      const z = -half + (size * i) / n;
      positions.push(x, height + (relief ? relief(x, z) : 0), z);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) index.push(top(i, j), top(i + 1, j), top(i, j + 1), top(i, j + 1), top(i + 1, j), top(i + 1, j + 1));
  }
  // Jupe : le tour du dessus, dupliqué juste sous le sol (sommets à part, pour des normales horizontales nettes).
  const ring = [];
  for (let j = 0; j < n; j++) ring.push(top(0, j));
  for (let i = 0; i < n; i++) ring.push(top(i, n));
  for (let j = n; j > 0; j--) ring.push(top(n, j));
  for (let i = n; i > 0; i--) ring.push(top(i, 0));
  const skirtStart = positions.length / 3;
  for (const v of ring) {
    positions.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
    positions.push(positions[v * 3], -0.02, positions[v * 3 + 2]);
  }
  const m = ring.length;
  for (let k = 0; k < m; k++) {
    const a = skirtStart + k * 2;
    const b = skirtStart + ((k + 1) % m) * 2;
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Couche drapée sur une surface (neige ou mousse sur un rocher) : les faces sont subdivisées puis découpées le
 * long de la ligne où `coverage` s'annule, ce qui donne un contour organique qui traverse les facettes au lieu de
 * les suivre. La couche est décollée de la surface selon `lift`, le long des normales lissées (pas de fissure aux
 * arêtes). Attributs : position, normal (facettes) ; indexée. La géométrie d'entrée n'est pas modifiée.
 *
 * @param {THREE.BufferGeometry} geometry surface support (position ; indexée ou non)
 * @param {(position: THREE.Vector3, normal: THREE.Vector3) => number} coverage > 0 là où la couche se pose ;
 *   `normal` est la normale lissée (continue d'une facette à l'autre)
 * @param {object} [options]
 * @param {number} [options.subdivisions] découpe de chaque face en n² triangles avant le contour
 * @param {(coverage: number, position: THREE.Vector3) => number} [options.lift] épaisseur au point (mètres)
 */
export function buildDrape(geometry, coverage, { subdivisions = 3, lift = () => 0.015 } = {}) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = source.attributes.position;
  const count = position.count;

  // Normales lissées : moyenne des normales des faces qui partagent un sommet.
  const key = (i) => `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
  const sums = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b)); // longueur = 2 × aire : pondère par l'aire
    for (let k = 0; k < 3; k++) {
      const id = key(i + k);
      const sum = sums.get(id) ?? sums.set(id, new THREE.Vector3()).get(id);
      sum.add(n);
    }
  }
  for (const sum of sums.values()) sum.normalize();

  const out = [];
  const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const normals = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const sample = (bary) => {
    const p = new THREE.Vector3()
      .addScaledVector(corners[0], bary[0]).addScaledVector(corners[1], bary[1]).addScaledVector(corners[2], bary[2]);
    const sn = new THREE.Vector3()
      .addScaledVector(normals[0], bary[0]).addScaledVector(normals[1], bary[1]).addScaledVector(normals[2], bary[2])
      .normalize();
    return { p, n: sn, w: coverage(p, sn) };
  };
  const emit = (v) => {
    const h = lift(Math.max(0, v.w), v.p);
    out.push(v.p.x + v.n.x * h, v.p.y + v.n.y * h, v.p.z + v.n.z * h);
  };
  const cut = (u, v) => {
    const t = u.w / (u.w - v.w);
    return { p: u.p.clone().lerp(v.p, t), n: u.n.clone().lerp(v.n, t).normalize(), w: 0 };
  };
  const clip = (tri) => {
    const inside = tri.map((v) => v.w >= 0);
    const k = inside.filter(Boolean).length;
    if (k === 0) return;
    if (k === 3) return tri.forEach(emit);
    // Ramener au cas où le sommet isolé est en tête, en gardant le sens des faces.
    const lone = k === 1 ? inside.indexOf(true) : inside.indexOf(false);
    const [v0, v1, v2] = [tri[lone], tri[(lone + 1) % 3], tri[(lone + 2) % 3]];
    const c1 = cut(v0, v1);
    const c2 = cut(v0, v2);
    if (k === 1) [v0, c1, c2].forEach(emit);
    else [c1, v1, v2, c1, v2, c2].forEach(emit);
  };

  const m = subdivisions;
  for (let i = 0; i < count; i += 3) {
    for (let k = 0; k < 3; k++) {
      corners[k].fromBufferAttribute(position, i + k);
      normals[k].copy(sums.get(key(i + k)));
    }
    const grid = (r, s) => sample([1 - (r + s) / m, r / m, s / m]);
    const cache = new Map();
    const at = (r, s) => cache.get(r * 64 + s) ?? cache.set(r * 64 + s, grid(r, s)).get(r * 64 + s);
    for (let r = 0; r < m; r++) {
      for (let s = 0; s < m - r; s++) {
        clip([at(r, s), at(r + 1, s), at(r, s + 1)]);
        if (s < m - r - 1) clip([at(r + 1, s), at(r + 1, s + 1), at(r, s + 1)]);
      }
    }
  }
  source.dispose();

  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  result.computeVertexNormals();
  result.setIndex(sequentialIndex(out.length / 3));
  return result;
}

/**
 * Morceau de terrain raccordable : une grille posée sur une hauteur `height(X, Z)` exprimée en coordonnées du
 * MONDE. Deux morceaux voisins (même taille, même fonction de hauteur, `origin` décalée d'une taille) ont
 * exactement les mêmes sommets, les mêmes normales et les mêmes coordonnées de motif sur leur bord commun :
 * aucune couture. Les normales viennent de la pente de la fonction (différences centrées), pas des triangles,
 * pour être identiques des deux côtés du bord.
 *
 * Le dessus porte l'attribut `aGround` (X, Z du monde) lu par le motif `ground` du matériau toon. Une jupe
 * (bords verticaux jusqu'à `skirtBottom`) ferme le morceau quand il est posé seul ; entre deux morceaux, elle
 * est cachée sous le sol.
 *
 * @param {object} options
 * @param {number} options.size côté en mètres
 * @param {number} [options.spacing] écart visé entre deux sommets (m) ; ajusté pour tomber juste sur `size`
 * @param {[number, number]} [options.origin] position du centre du morceau dans le monde [X, Z]
 * @param {(X: number, Z: number) => number} options.height hauteur du sol au point du monde (m)
 * @param {number} [options.skirtBottom] bas de la jupe (m, repère local)
 * @returns {{top: THREE.BufferGeometry, skirt: THREE.BufferGeometry}}
 */
export function buildTerrainChunk({ size, spacing = 0.5, origin = [0, 0], height, skirtBottom = -0.25 }) {
  const n = Math.max(1, Math.round(size / spacing));
  const half = size / 2;
  const step = size / n;
  const [ox, oz] = origin;
  const e = step * 0.5;
  const positions = [];
  const normals = [];
  const ground = [];
  const index = [];
  const at = (i, j) => i * (n + 1) + j;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      // Coordonnées monde calculées depuis des entiers : deux morceaux voisins tombent sur les mêmes valeurs.
      const x = -half + j * step;
      const z = -half + i * step;
      const X = ox + x;
      const Z = oz + z;
      positions.push(x, height(X, Z), z);
      const dx = (height(X + e, Z) - height(X - e, Z)) / (2 * e);
      const dz = (height(X, Z + e) - height(X, Z - e)) / (2 * e);
      const len = Math.hypot(dx, 1, dz);
      normals.push(-dx / len, 1 / len, -dz / len);
      ground.push(X, Z);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // Diagonale alternée : pas de « peigne » visible dans le relief.
      if ((i + j) % 2 === 0) index.push(at(i, j), at(i + 1, j), at(i, j + 1), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1));
      else index.push(at(i, j), at(i + 1, j + 1), at(i, j + 1), at(i, j), at(i + 1, j), at(i + 1, j + 1));
    }
  }
  const top = new THREE.BufferGeometry();
  top.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  top.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  top.setAttribute("aGround", new THREE.Float32BufferAttribute(ground, 2));
  top.setIndex(index);

  // Jupe : quatre bandes verticales, normales vers l'extérieur.
  const sp = [];
  const sn = [];
  const si = [];
  const sides = [
    { from: (k) => at(0, k), normal: [0, 0, -1] },
    { from: (k) => at(k, n), normal: [1, 0, 0] },
    { from: (k) => at(n, n - k), normal: [0, 0, 1] },
    { from: (k) => at(n - k, 0), normal: [-1, 0, 0] },
  ];
  for (const side of sides) {
    const start = sp.length / 3;
    for (let k = 0; k <= n; k++) {
      const v = side.from(k);
      sp.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]);
      sp.push(positions[v * 3], skirtBottom, positions[v * 3 + 2]);
      sn.push(...side.normal, ...side.normal);
    }
    for (let k = 0; k < n; k++) {
      const a = start + k * 2;
      const b = a + 2;
      si.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  skirt.setAttribute("normal", new THREE.Float32BufferAttribute(sn, 3));
  skirt.setIndex(si);
  return { top, skirt };
}
