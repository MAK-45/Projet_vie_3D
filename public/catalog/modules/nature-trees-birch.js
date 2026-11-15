// Projet Vie 3D — Bouleau (nature/trees/birch), version 1
// Module autonome : seule dépendance, three@0.186.0 (import "three").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/nature/trees/birch.js
import * as THREE3 from "three";

// src/engine/toon-material.js
import * as THREE from "three";
var sharedUniforms = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.92, 0.38) },
  uWindStrength: { value: 1 }
};
function tick(seconds, fps = 12) {
  sharedUniforms.uTime.value = fps > 0 ? Math.floor(seconds * fps) / fps : seconds;
}
function setWind(strength) {
  sharedUniforms.uWindStrength.value = strength;
}
function rgb(hex) {
  const c = typeof hex === "string" ? parseInt(hex.replace("#", ""), 16) : hex;
  return new THREE.Vector3((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255);
}
var VERTEX = (
  /* glsl */
  `
#include <common>
#include <shadowmap_pars_vertex>

uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec2 uSway; // x : amplitude du balancement \xE0 la hauteur y (unit\xE9s), y : hauteur de r\xE9f\xE9rence

#ifdef FOLIAGE
  attribute vec2 aCorner; // coin de la feuille dans le plan de l'\xE9cran (unit\xE9s monde)
  attribute vec4 aLeaf;   // x : phase, y : occlusion (0 c\u0153ur, 1 ext\xE9rieur), z : variation, w : souplesse au vent
  varying vec3 vLeaf;
#endif

#ifdef PATTERN_BARK
  attribute float aRadius;
  varying float vRadius;
  varying vec2 vUv;
#endif

varying vec3 vNormal;
varying vec3 vObjPos;

void main() {
  #include <beginnormal_vertex>
  #include <defaultnormal_vertex>
  vNormal = transformedNormal;

  #include <begin_vertex>
  vObjPos = transformed;

  mat4 toWorld = modelMatrix;
  #ifdef USE_INSTANCING
    toWorld = modelMatrix * instanceMatrix;
  #endif
  vec3 origin = toWorld[3].xyz;

  // Balancement de l'ensemble (tronc, branches, feuilles) : nul au sol, maximal en haut.
  float phase = origin.x * 0.37 + origin.z * 0.23;
  float gust = sin(uTime * 1.1 + phase) * 0.6 + sin(uTime * 2.3 + phase * 1.7) * 0.4;
  float h = clamp(transformed.y / max(uSway.y, 0.001), 0.0, 1.2);
  transformed.xz += uWindDir * ((0.3 + 0.7 * gust) * uSway.x * uWindStrength * h * h);

  #ifdef FOLIAGE
    vLeaf = aLeaf.xyz;
    // Fr\xE9missement propre \xE0 chaque feuille, port\xE9 par une vague qui traverse le feuillage.
    float wave = sin(uTime * 2.4 - dot(transformed.xz + origin.xz, uWindDir) * 1.6 + aLeaf.x * 2.0);
    float flutter = sin(uTime * 5.0 + aLeaf.x * 6.2831);
    float bendLeaf = aLeaf.w * uWindStrength;
    transformed.xz += uWindDir * (wave * 0.05 + flutter * 0.03) * bendLeaf;
    transformed.y += flutter * 0.025 * bendLeaf;
  #endif

  #include <project_vertex>

  #ifdef FOLIAGE
    mvPosition.xy += aCorner * length(toWorld[0].xyz);
    gl_Position = projectionMatrix * mvPosition;
  #endif

  #ifdef PATTERN_BARK
    vRadius = aRadius;
    vUv = uv;
  #endif

  #ifndef DEPTH_ONLY
    #include <worldpos_vertex>
    #include <shadowmap_vertex>
  #endif
}
`
);
var FRAGMENT = (
  /* glsl */
  `
#include <common>
#include <packing>
#include <bsdfs>
#include <lights_pars_begin>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

layout(location = 1) out highp vec4 gAux; // xy : normale vue, z : seuil de contour interne, w : identifiant de contour

uniform vec3 uRamp[RAMP_SIZE];
uniform float uSteps[RAMP_SIZE - 1];
uniform vec3 uInk;
uniform float uId;
uniform float uCrease;
uniform float uSelfEdge;
uniform float uShadowLit;
uniform vec4 uPattern; // sens selon le motif (voir createToonMaterial)
uniform float uSeed;

varying vec3 vNormal;
varying vec3 vObjPos;

#ifdef FOLIAGE
  varying vec3 vLeaf;
  uniform vec2 uLeafShade; // x : \xE9clat al\xE9atoire par feuille, y : assombrissement du c\u0153ur
#endif

#ifdef PATTERN_BARK
  varying float vRadius;
  varying vec2 vUv;
#endif

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 N = normalize(vNormal);
  #if defined(DOUBLE_SIDED) && !defined(FOLIAGE)
    if (!gl_FrontFacing) N = -N;
  #endif

  #if NUM_DIR_LIGHTS > 0
    vec3 L = directionalLights[0].direction;
  #else
    vec3 L = normalize(vec3(-0.45, 0.75, 0.5));
  #endif

  float lit = dot(N, L) * 0.5 + 0.5;
  float ink = 0.0;

  #ifdef FOLIAGE
    lit += (vLeaf.z - 0.5) * uLeafShade.x;
    lit *= mix(1.0 - uLeafShade.y, 1.0, vLeaf.y);
  #endif

  #ifdef PATTERN_BARK
    // Tirets horizontaux d'un \xAB pixel \xBB de haut, de taille constante dans le monde quel que soit le diam\xE8tre.
    float density = uPattern.x;
    float row = floor(vUv.y * density);
    float cols = max(4.0, floor(6.2832 * vRadius * density));
    float col = floor(fract(vUv.x) * cols);
    float start = floor(hash12(vec2(row, uSeed + 1.3)) * cols);
    float len = 1.0 + floor(hash12(vec2(row, uSeed + 2.7)) * 0.45 * cols);
    float dcol = mod(col - start + cols, cols);
    ink = step(hash12(vec2(row, uSeed)), uPattern.y) * step(dcol, len - 0.5);
    // N\u0153uds plus \xE9pais, rares.
    float row2 = floor(row / 2.0);
    float start2 = floor(hash12(vec2(row2, uSeed + 5.1)) * cols);
    float dcol2 = mod(col - start2 + cols, cols);
    ink = max(ink, step(hash12(vec2(row2, uSeed + 7.9)), uPattern.y * 0.22) * step(dcol2, 1.5));
    // Pied du tronc : \xE9corce sombre et crevass\xE9e.
    float foot = 1.0 - smoothstep(0.0, uPattern.z, vObjPos.y);
    ink = max(ink, step(hash12(vec2(col * 3.0 + uSeed, floor(row / 3.0))), foot * uPattern.w));
    // Plaques gris\xE9es.
    lit -= 0.14 * step(0.82, hash12(vec2(floor(col / 2.0) + uSeed, floor(row / 4.0))));
  #endif

  #ifdef PATTERN_SPECKLE
    // Grain : quelques cellules d'un pixel d\xE9cal\xE9es d'un cran de lumi\xE8re.
    vec3 cell = floor(vObjPos * uPattern.x + 0.001);
    float r = hash13(cell + uSeed);
    lit += uPattern.z * step(r, uPattern.y) - uPattern.z * step(1.0 - uPattern.y * uPattern.w, r);
  #endif

  float shadow = getShadowMask();
  lit = mix(min(lit, uShadowLit), lit, shadow);

  vec3 color = uRamp[0];
  for (int i = 0; i < RAMP_SIZE - 1; i++) {
    if (lit > uSteps[i]) color = uRamp[i + 1];
  }
  color = mix(color, uInk, ink);

  // Alpha : 1 = surface, 0.75 = surface avec liser\xE9 clair sur les ar\xEAtes vives (0 = fond, jamais \xE9crit ici).
  gl_FragColor = vec4(color, 1.0 - 0.25 * uCrease);
  gAux = vec4(N.xy * 0.5 + 0.5, uSelfEdge * 0.25, uId / 255.0);
}
`
);
var DEPTH_FRAGMENT = (
  /* glsl */
  `
void main() {
  gl_FragColor = vec4(1.0);
}
`
);
var PATTERNS = {
  none: { define: null, value: [0, 0, 0, 0] },
  // density (pixels par unité), fréquence des tirets (0..1), hauteur du pied sombre (unités), densité du pied (0..1)
  bark: { define: "PATTERN_BARK", value: [16, 0.3, 1, 0.8] },
  // density (cellules par unité), probabilité (0..1), amplitude (en lumière), part de grains sombres (0..1)
  speckle: { define: "PATTERN_SPECKLE", value: [16, 0.08, 0.2, 1] }
};
function defaultSteps(count) {
  const steps = [];
  for (let i = 1; i < count; i++) steps.push(0.3 + 0.5 * (i - 1) / Math.max(1, count - 2));
  return steps;
}
function createToonMaterial(options) {
  const {
    ramp,
    steps = defaultSteps(ramp.length),
    ink = "#241c2e",
    pattern = "none",
    patternParams,
    seed = 0,
    foliage = false,
    leafShade = [0.12, 0.45],
    id = 1,
    crease = false,
    selfEdge = foliage ? 1.1 : 0,
    shadowLit = 0.36,
    sway = { amplitude: 0, height: 1 },
    side = foliage ? THREE.DoubleSide : THREE.FrontSide
  } = options;
  if (ramp.length < 2 || ramp.length > 6) throw new Error("ramp : 2 \xE0 6 couleurs");
  if (steps.length !== ramp.length - 1) throw new Error("steps : ramp.length - 1 valeurs");
  const patternInfo = PATTERNS[pattern];
  const defines = { RAMP_SIZE: ramp.length };
  if (foliage) defines.FOLIAGE = "";
  if (patternInfo.define) defines[patternInfo.define] = "";
  const swayUniform = { value: new THREE.Vector2(sway.amplitude, sway.height) };
  const material = new THREE.ShaderMaterial({
    name: foliage ? "ToonFoliage" : "Toon",
    defines,
    lights: true,
    side,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
      ...sharedUniforms,
      uSway: swayUniform,
      uRamp: { value: ramp.map(rgb) },
      uSteps: { value: steps.slice() },
      uInk: { value: rgb(ink) },
      uId: { value: id },
      uCrease: { value: crease ? 1 : 0 },
      uSelfEdge: { value: selfEdge },
      uShadowLit: { value: shadowLit },
      uPattern: { value: new THREE.Vector4(...patternParams ?? patternInfo.value) },
      uSeed: { value: seed },
      uLeafShade: { value: new THREE.Vector2(...leafShade) }
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT
  });
  if (foliage) {
    material.userData.depthMaterial = new THREE.ShaderMaterial({
      name: "ToonFoliageDepth",
      defines: { FOLIAGE: "", DEPTH_ONLY: "" },
      side: THREE.DoubleSide,
      uniforms: { ...sharedUniforms, uSway: swayUniform },
      vertexShader: VERTEX,
      fragmentShader: DEPTH_FRAGMENT
    });
  }
  return material;
}
function disposeObject(root) {
  root.traverse((child) => {
    child.geometry?.dispose();
    for (const material of [child.material ?? []].flat()) {
      material.userData.depthMaterial?.dispose();
      material.dispose();
    }
    child.customDepthMaterial?.dispose();
  });
}

// src/assets/kit/geometry.js
import * as THREE2 from "three";
var _tangent = new THREE2.Vector3();
var _normal = new THREE2.Vector3();
var _binormal = new THREE2.Vector3();
var _previousTangent = new THREE2.Vector3();
var _axis = new THREE2.Vector3();
var _point = new THREE2.Vector3();
function buildTube(points, radiusAt, { radialSegments = 6, lengthSegments = 8, vOffset = 0 } = {}) {
  const curve = new THREE2.CatmullRomCurve3(points, false, "centripetal");
  const rings = lengthSegments + 1;
  const ringSize = radialSegments + 1;
  const vertexCount = rings * ringSize;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const radii = new Float32Array(vertexCount);
  const indices = [];
  let travelled = 0;
  const previousPoint = new THREE2.Vector3();
  for (let i = 0; i < rings; i++) {
    const t = i / lengthSegments;
    curve.getPoint(t, _point);
    curve.getTangent(t, _tangent);
    if (i === 0) {
      _normal.set(1, 0, 0);
      if (Math.abs(_tangent.x) > 0.9) _normal.set(0, 0, 1);
      _normal.addScaledVector(_tangent, -_normal.dot(_tangent)).normalize();
    } else {
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
    const radius = Math.max(5e-4, radiusAt(t));
    for (let j = 0; j < ringSize; j++) {
      const angle = j / radialSegments * Math.PI * 2;
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
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE2.BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE2.BufferAttribute(uvs, 2));
  geometry.setAttribute("aRadius", new THREE2.BufferAttribute(radii, 1));
  geometry.setIndex(indices);
  geometry.userData.curve = curve;
  return geometry;
}
function mergeGeometries(geometries) {
  const merged = new THREE2.BufferGeometry();
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
    merged.setAttribute(name, new THREE2.BufferAttribute(array, itemSize));
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
  merged.setIndex(new THREE2.BufferAttribute(index, 1));
  return merged;
}
var LEAF_SHAPE = [0, -1, 0.8, 0.62, -0.8, 0.62];
function buildLeafGeometry(leaves) {
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
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE2.BufferAttribute(normals, 3));
  geometry.setAttribute("aCorner", new THREE2.BufferAttribute(corners, 2));
  geometry.setAttribute("aLeaf", new THREE2.BufferAttribute(data, 4));
  return geometry;
}

// src/assets/kit/params.js
function resolveParams(schema, given = {}) {
  const result = {};
  for (const [name, spec] of Object.entries(schema)) {
    let value = given[name] ?? spec.default;
    if (spec.type === "int" || spec.type === "number") {
      value = Number(value);
      if (!Number.isFinite(value)) value = spec.default;
      if (spec.type === "int") value = Math.round(value);
      if (spec.min !== void 0) value = Math.max(spec.min, value);
      if (spec.max !== void 0) value = Math.min(spec.max, value);
    } else if (spec.type === "enum" && !spec.values.includes(value)) {
      value = spec.default;
    } else if (spec.type === "boolean") {
      value = Boolean(value);
    }
    result[name] = value;
  }
  return result;
}

// src/assets/kit/rng.js
function createRng(seed) {
  let state = (Math.floor(seed) ^ 2654435769) >>> 0;
  const next = () => {
    state = state + 1831565813 >>> 0;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  return {
    /** nombre dans [0, 1[ */
    next,
    /** nombre dans [min, max[ */
    range: (min, max) => min + (max - min) * next(),
    /** entier dans [min, max] */
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    /** vrai avec la probabilité donnée */
    chance: (probability) => next() < probability,
    /** élément au hasard */
    pick: (items) => items[Math.floor(next() * items.length)]
  };
}

// src/assets/kit/variation.js
var SEASONS = ["spring", "summer", "autumn", "winter"];
var SEASON_LABELS = { spring: "Printemps", summer: "\xC9t\xE9", autumn: "Automne", winter: "Hiver" };
function seedParam(description) {
  return { type: "int", default: 1, min: 0, max: 9999, label: "Graine", description };
}
function seasonParam(description, defaultSeason = "summer") {
  return { type: "enum", default: defaultSeason, values: SEASONS, labels: SEASON_LABELS, label: "Saison", description };
}
function numberParam(label, defaultValue, min, max, description, { step = 0.1, unit } = {}) {
  return { type: "number", default: defaultValue, min, max, step, ...unit ? { unit } : {}, label, description };
}
function variantsOf(name, spec) {
  const values = [spec.default, ...spec.values.filter((value) => value !== spec.default)];
  return values.map((value) => ({ id: value, name: spec.labels?.[value] ?? value, params: { [name]: value } }));
}

// src/assets/nature/trees/birch.js
var params = {
  seed: seedParam("Change la silhouette : inclinaison du tronc, branches, touffes."),
  season: seasonParam("Couleur et densit\xE9 du feuillage ; l'hiver, l'arbre est nu."),
  height: numberParam("Hauteur", 7.5, 5, 9.5, "Hauteur du tronc ; tout l'arbre garde ses proportions.", { step: 0.5, unit: "m" }),
  fullness: numberParam("Densit\xE9 du feuillage", 1, 0.5, 1.4, "Quantit\xE9 de feuilles (et de triangles).")
};
var meta = {
  id: "nature/trees/birch",
  name: "Bouleau",
  nameEn: "Birch tree",
  category: "nature",
  subcategory: "trees",
  description: "Bouleau au tronc blanc marqu\xE9 de tirets sombres, feuillage l\xE9ger en touffes avec des brins pendants qui bougent au vent. Quatre saisons, forme diff\xE9rente pour chaque graine.",
  tags: [
    "arbre",
    "bouleau",
    "feuillu",
    "v\xE9g\xE9tation",
    "tronc blanc",
    "feuillage",
    "vent",
    "saisons",
    "ext\xE9rieur",
    "tree",
    "birch",
    "deciduous",
    "vegetation",
    "foliage",
    "wind",
    "seasons",
    "outdoor",
    "procedural"
  ],
  biomes: ["forest", "meadow", "garden", "village"],
  version: 1,
  added: "2026-11-15",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au pied du tronc, au niveau du sol",
  footprint: { radius: 3.2, height: 8.4 },
  animated: ["wind"],
  params,
  variants: variantsOf("season", params.season)
};
var BARK_RAMP = ["#77728f", "#b0aec2", "#e0dfe6", "#fbf8ee"];
var BARK_INK = "#2a2233";
var SEASONS2 = {
  spring: { ramp: ["#2a6350", "#3f8a52", "#63ad55", "#96cf5e", "#d2ec84"], density: 0.78, leafSize: 0.92 },
  summer: { ramp: ["#1d4945", "#2a6947", "#3f8d45", "#6db348", "#b3da5b"], density: 1, leafSize: 1 },
  autumn: { ramp: ["#7b3d1d", "#b3651e", "#da9422", "#f2bf3a", "#ffe889"], density: 0.86, leafSize: 1 },
  winter: { ramp: ["#1d4945", "#2a6947", "#3f8d45", "#6db348", "#b3da5b"], density: 0, leafSize: 1 }
};
var TAU = Math.PI * 2;
var UP = new THREE3.Vector3(0, 1, 0);
var lerp = THREE3.MathUtils.lerp;
function create(params2 = {}) {
  const p = resolveParams(meta.params, params2);
  const season = SEASONS2[p.season];
  const rng = createRng(p.seed * 7919 + 17);
  const s = p.height / 7.5;
  const leanAzimuth = rng.range(0, TAU);
  const lean = rng.range(0.2, 0.55) * s;
  const trunkPoints = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const wobble = i === 0 ? 0 : 0.11 * s;
    trunkPoints.push(
      new THREE3.Vector3(
        Math.cos(leanAzimuth) * lean * t * t + rng.range(-wobble, wobble),
        p.height * t,
        Math.sin(leanAzimuth) * lean * t * t + rng.range(-wobble, wobble)
      )
    );
  }
  const baseRadius = 0.21 * s;
  const trunkRadius = (t) => lerp(baseRadius, baseRadius * 0.24, Math.pow(t, 0.85)) + baseRadius * 0.5 * Math.exp(-t * 22);
  const trunk = buildTube(trunkPoints, trunkRadius, { radialSegments: 7, lengthSegments: 14 });
  const trunkCurve = trunk.userData.curve;
  const wood = [trunk];
  const clumps = [];
  const branchCount = 10 + rng.int(0, 3);
  const minRadius = 0.034;
  for (let i = 0; i < branchCount; i++) {
    const u = i / (branchCount - 1);
    const start = trunkCurve.getPoint(0.4 + 0.54 * Math.pow(u, 0.9));
    const azimuth = i * 2.39996 + rng.range(-0.5, 0.5);
    const out = new THREE3.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const length = lerp(2.5, 0.95, Math.pow(u, 1.1)) * rng.range(0.85, 1.15) * s;
    const rise = lerp(0.3, 0.55, u) * length;
    const points = [
      start,
      start.clone().addScaledVector(out, length * 0.35).addScaledVector(UP, rise),
      start.clone().addScaledVector(out, length * 0.75).addScaledVector(UP, rise + length * 0.2),
      start.clone().addScaledVector(out, length).addScaledVector(UP, rise + length * 0.06)
    ];
    const r0 = Math.max(minRadius, lerp(0.078, 0.045, u) * s);
    const branch = buildTube(points, (t) => lerp(r0, minRadius, t), {
      radialSegments: 5,
      lengthSegments: 5,
      vOffset: rng.range(3, 30)
    });
    wood.push(branch);
    const branchCurve = branch.userData.curve;
    const size = lerp(0.92, 0.55, u) * s;
    for (const [t, k] of [[0.5, 1], [0.78, 0.9], [1, 0.74]]) {
      const radius = size * k * rng.range(0.85, 1.15);
      const center = branchCurve.getPoint(t);
      center.y -= radius * 0.18;
      clumps.push({ center, radius, hanging: t > 0.6 });
    }
    const twigCount = u < 0.75 ? 2 : 1;
    for (let j = 0; j < twigCount; j++) {
      const from = branchCurve.getPoint(rng.range(0.3, 0.75));
      const side = azimuth + (rng.chance(0.5) ? 1 : -1) * rng.range(0.7, 1.3);
      const direction = new THREE3.Vector3(Math.cos(side), rng.range(0.1, 0.5), Math.sin(side)).normalize();
      const twigLength = rng.range(0.55, 1) * s * lerp(1, 0.7, u);
      const tip = from.clone().addScaledVector(direction, twigLength);
      tip.y -= twigLength * 0.2;
      const middle = from.clone().addScaledVector(direction, twigLength * 0.55);
      wood.push(
        buildTube([from, middle, tip], () => minRadius, { radialSegments: 4, lengthSegments: 3, vOffset: rng.range(3, 30) })
      );
      clumps.push({ center: tip, radius: rng.range(0.42, 0.56) * s, hanging: true });
    }
  }
  const top = trunkCurve.getPoint(1);
  clumps.push({ center: top.clone().add(new THREE3.Vector3(0, 0.15 * s, 0)), radius: 0.58 * s, hanging: false });
  const crownStart = rng.range(0, TAU);
  for (let i = 0; i < 5; i++) {
    const angle = crownStart + i * 2.39996;
    const center = trunkCurve.getPoint(0.56 + i * 0.085);
    const reach = lerp(0.75, 0.4, i / 4) * s;
    center.x += Math.cos(angle) * reach;
    center.z += Math.sin(angle) * reach;
    clumps.push({ center, radius: lerp(0.8, 0.55, i / 4) * s, hanging: false });
  }
  const sway = { amplitude: 0.09 * s, height: p.height };
  const group = new THREE3.Group();
  group.name = meta.name;
  const woodMesh = new THREE3.Mesh(
    mergeGeometries(wood),
    createToonMaterial({
      ramp: BARK_RAMP,
      steps: [0.3, 0.52, 0.76],
      ink: BARK_INK,
      pattern: "bark",
      patternParams: [16, 0.34, 0.95 * s, 0.78],
      seed: p.seed % 97,
      id: 10,
      sway
    })
  );
  woodMesh.name = "wood";
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;
  group.add(woodMesh);
  const leaves = [];
  if (season.density > 0) {
    const canopyCenter = trunkCurve.getPoint(0.68);
    const density = season.density * p.fullness;
    const leafSize = () => rng.range(0.075, 0.13) * season.leafSize;
    const shadeNormal = (position, direction) => direction.clone().addScaledVector(position.clone().sub(canopyCenter).normalize(), 0.4).addScaledVector(UP, 0.25).normalize();
    const DOWN = new THREE3.Vector3(0, -1, 0);
    for (const clump of clumps) {
      const { center, radius } = clump;
      for (const rotation of [0, Math.PI]) {
        leaves.push({ position: center, normal: DOWN, size: radius * 0.44, rotation, phase: rng.next(), occlusion: 0, variation: 0, flex: 0.3 });
      }
      const count = Math.round(density * 105 * radius * radius);
      for (let i = 0; i < count; i++) {
        const y = rng.range(-1, 1);
        const angle = rng.range(0, TAU);
        const ring = Math.sqrt(1 - y * y);
        const direction = new THREE3.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
        const k = 0.4 + 0.6 * Math.sqrt(rng.next());
        const position = center.clone().add(direction.clone().multiply(new THREE3.Vector3(radius * k, radius * k * 0.85, radius * k)));
        if (y < 0) position.y -= y * y * radius * 0.35;
        leaves.push({
          position,
          normal: shadeNormal(position, direction),
          size: leafSize(),
          rotation: rng.range(-0.9, 0.9),
          phase: rng.next(),
          occlusion: THREE3.MathUtils.smoothstep(k, 0.4, 0.95) * (0.8 + 0.2 * (y * 0.5 + 0.5)),
          variation: rng.next(),
          flex: rng.range(0.55, 1)
        });
      }
      if (clump.hanging) {
        const strands = rng.int(1, 3);
        for (let j = 0; j < strands; j++) {
          const angle = rng.range(0, TAU);
          const reach = rng.range(0.2, 0.75) * radius;
          const position = center.clone().add(new THREE3.Vector3(Math.cos(angle) * reach, -radius * 0.7, Math.sin(angle) * reach));
          const direction = new THREE3.Vector3(Math.cos(angle), -0.2, Math.sin(angle)).normalize();
          const links = Math.round(rng.int(4, 8) * Math.min(1, density + 0.2));
          for (let n = 0; n < links; n++) {
            position.y -= 0.13 * s;
            position.x += rng.range(-0.03, 0.03);
            position.z += rng.range(-0.03, 0.03);
            leaves.push({
              position: position.clone(),
              normal: shadeNormal(position, direction),
              size: leafSize(),
              rotation: rng.range(-0.35, 0.35),
              phase: rng.next(),
              occlusion: 0.9,
              variation: rng.next(),
              flex: 0.8 + 0.7 * (n / links)
            });
          }
        }
      }
    }
    if (p.season === "autumn") {
      for (let i = 0; i < 34; i++) {
        const angle = rng.range(0, TAU);
        const distance = rng.range(0.4, 2.8) * s;
        leaves.push({
          position: new THREE3.Vector3(Math.cos(angle) * distance, 0.04, Math.sin(angle) * distance),
          normal: UP,
          size: leafSize(),
          rotation: rng.range(0, TAU),
          phase: rng.next(),
          occlusion: 1,
          variation: rng.next(),
          flex: 0
        });
      }
    }
    const leafGeometry = buildLeafGeometry(leaves);
    leafGeometry.computeBoundingSphere();
    leafGeometry.boundingSphere.radius += 0.6;
    const leafMaterial = createToonMaterial({
      ramp: season.ramp,
      steps: [0.22, 0.42, 0.6, 0.78],
      foliage: true,
      id: 11,
      sway
    });
    const leafMesh = new THREE3.Mesh(leafGeometry, leafMaterial);
    leafMesh.name = "leaves";
    leafMesh.customDepthMaterial = leafMaterial.userData.depthMaterial;
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    group.add(leafMesh);
  }
  group.userData.asset = { id: meta.id, params: p, leaves: leaves.length };
  return group;
}
export {
  create,
  disposeObject as dispose,
  meta,
  setWind,
  tick
};
