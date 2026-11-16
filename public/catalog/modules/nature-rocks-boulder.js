// Projet Vie 3D — Rocher posé (nature/rocks/boulder), version 1
// Module autonome : seule dépendance, three@0.186.0 (import "three").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/nature/rocks/boulder.js
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
var _rockPoint = new THREE2.Vector3();
var _rockEuler = new THREE2.Euler();
function buildRock(rng, { detail = 1, lumps = 5, lumpSize = 0.2, cuts = 6, cutDepth = [0.72, 0.92], scale = [1, 1, 1], rotation = [0, 0, 0], offset = [0, 0, 0], floorY = -Infinity } = {}) {
  const source = new THREE2.IcosahedronGeometry(1, detail);
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
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.setIndex(sequentialIndex(positions.length / 3));
  return geometry;
}
function splitFacesByNormal(geometry, test) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  if (!source.attributes.normal) source.computeVertexNormals();
  const names = Object.keys(source.attributes);
  const count = source.attributes.position.count;
  const kept = [];
  const others = [];
  const normal = new THREE2.Vector3();
  const center = new THREE2.Vector3();
  const a = new THREE2.Vector3();
  const b = new THREE2.Vector3();
  const c = new THREE2.Vector3();
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
    const result2 = new THREE2.BufferGeometry();
    for (const name of names) {
      const attribute = source.attributes[name];
      const size = attribute.itemSize;
      const array = new Float32Array(faces.length * 3 * size);
      faces.forEach((face, n) => array.set(attribute.array.subarray(face * size, (face + 3) * size), n * 3 * size));
      result2.setAttribute(name, new THREE2.BufferAttribute(array, size));
    }
    result2.setIndex(sequentialIndex(faces.length * 3));
    return result2;
  };
  const result = [build(kept), build(others)];
  if (source !== geometry) source.dispose();
  geometry.dispose();
  return result;
}
function sequentialIndex(count) {
  const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  for (let i = 0; i < count; i++) index[i] = i;
  return new THREE2.BufferAttribute(index, 1);
}
function randomDirection(rng) {
  const y = rng.range(-1, 1);
  const angle = rng.range(0, Math.PI * 2);
  const ring = Math.sqrt(1 - y * y);
  return new THREE2.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
}

// src/assets/kit/palettes.js
var STONES = {
  granite: { label: "Granit", ramp: ["#4a4658", "#6f6c7c", "#9a98a3", "#c9c7c8"], ink: "#2b2836" },
  sandstone: { label: "Gr\xE8s", ramp: ["#6b4438", "#9a6a48", "#c59760", "#e8c88a"], ink: "#43272a" },
  limestone: { label: "Calcaire", ramp: ["#746a6e", "#a59a8f", "#d3c8b0", "#f1e8cf"], ink: "#4a4148" },
  basalt: { label: "Basalte", ramp: ["#23222f", "#383846", "#55566a", "#7b7e90"], ink: "#15141d" },
  slate: { label: "Ardoise", ramp: ["#2c3a48", "#44586a", "#66808f", "#96adb5"], ink: "#1a232e" }
};
var COVERS = {
  moss: { label: "Mousse", ramp: ["#22473c", "#33663e", "#4f8a3f", "#86b44a"], ink: "#142a26" },
  snow: { label: "Neige", ramp: ["#8a97b8", "#b9c3dc", "#e2e8f2", "#fbfbf6"], ink: "#5a6584" }
};

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
function seedParam(description) {
  return { type: "int", default: 1, min: 0, max: 9999, label: "Graine", description };
}
function choiceParam(label, options, description, defaultValue = Object.keys(options)[0]) {
  const labels = {};
  for (const [value, option] of Object.entries(options)) labels[value] = typeof option === "string" ? option : option.label;
  return { type: "enum", default: defaultValue, values: Object.keys(options), labels, label, description };
}
function stoneParam(description, { only, defaultValue } = {}) {
  return choiceParam("Pierre", pick(STONES, only), description, defaultValue);
}
function coverParam(description, defaultValue = "bare") {
  return choiceParam("Couverture", { bare: "Nue", moss: COVERS.moss, snow: COVERS.snow }, description, defaultValue);
}
function numberParam(label, defaultValue, min, max, description, { step = 0.1, unit } = {}) {
  return { type: "number", default: defaultValue, min, max, step, ...unit ? { unit } : {}, label, description };
}
function variantsOf(name, spec) {
  const values = [spec.default, ...spec.values.filter((value) => value !== spec.default)];
  return values.map((value) => ({ id: value, name: spec.labels?.[value] ?? value, params: { [name]: value } }));
}
function pick(table, only) {
  if (!only) return table;
  return Object.fromEntries(only.map((key) => [key, table[key]]));
}

// src/assets/nature/rocks/boulder.js
var params = {
  seed: seedParam("Change la silhouette : rond, haut ou trapu, facettes, inclinaison, cailloux au pied."),
  stone: stoneParam("Type de pierre : couleurs et grain."),
  cover: coverParam("Mousse ou neige sur les faces tourn\xE9es vers le ciel."),
  size: numberParam("Hauteur", 1.1, 0.4, 2.5, "Hauteur du rocher ; tout garde ses proportions.", { step: 0.1, unit: "m" }),
  roughness: numberParam("Taille de la pierre", 1, 0, 1.5, "0 = galet arrondi, 1,5 = bloc tr\xE8s taill\xE9.")
};
var meta = {
  id: "nature/rocks/boulder",
  name: "Rocher pos\xE9",
  nameEn: "Boulder",
  category: "nature",
  subcategory: "rocks",
  description: "Rocher \xE0 facettes pos\xE9 sur le sol, parfois accompagn\xE9 de cailloux. Cinq pierres (granit, gr\xE8s, calcaire, basalte, ardoise), nu, moussu ou enneig\xE9 ; chaque graine donne une autre silhouette.",
  tags: [
    "rocher",
    "roche",
    "pierre",
    "bloc",
    "caillou",
    "min\xE9ral",
    "facettes",
    "pos\xE9",
    "mousse",
    "neige",
    "ext\xE9rieur",
    "boulder",
    "rock",
    "stone",
    "pebble",
    "mineral",
    "faceted",
    "moss",
    "snow",
    "outdoor",
    "procedural"
  ],
  biomes: ["forest", "meadow", "mountain", "desert", "snow", "beach", "cave", "garden", "village", "swamp"],
  version: 1,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au sol, au centre du rocher",
  footprint: { radius: 1.4, height: 1.1 },
  animated: [],
  params,
  variants: variantsOf("stone", params.stone)
};
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const stone = STONES[p.stone];
  const h = p.size;
  const rough = p.roughness;
  const half = h / 2;
  const width = half * shape.range(0.95, 1.9);
  const depth = width * shape.range(0.6, 0.95);
  const sink = 0.12 * h;
  const parts = [
    buildRock(shape, {
      detail: 1,
      lumps: 4,
      lumpSize: 0.14,
      cuts: Math.round(4 + 5 * rough),
      cutDepth: [0.82 - 0.22 * rough, 0.95 - 0.1 * rough],
      scale: [width, half + sink / 2, depth],
      rotation: [shape.range(-0.25, 0.25), shape.range(0, Math.PI * 2), shape.range(-0.25, 0.25)],
      offset: [0, half - sink / 2, 0],
      floorY: -0.02
    })
  ];
  const pebbles = shape.int(0, 3);
  for (let i = 0; i < pebbles; i++) {
    const angle = shape.range(0, Math.PI * 2);
    const r = shape.range(0.12, 0.22) * Math.max(1, h);
    const distance = width * shape.range(0.95, 1.15) + r;
    parts.push(
      buildRock(shape, {
        detail: 0,
        lumps: 2,
        lumpSize: 0.15,
        cuts: 3,
        cutDepth: [0.7, 0.9],
        scale: [r, r * shape.range(0.5, 0.8), r * shape.range(0.8, 1.1)],
        rotation: [0, shape.range(0, Math.PI * 2), 0],
        offset: [Math.cos(angle) * distance, r * 0.4, Math.sin(angle) * distance * (depth / width)],
        floorY: -0.02
      })
    );
  }
  const group = new THREE3.Group();
  group.name = meta.name;
  addStoneAndCover(group, mergeGeometries(parts), stone, p.cover, detail, h);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
function addStoneAndCover(group, geometry, stone, cover, detail, height) {
  let stoneGeometry = geometry;
  if (cover !== "bare") {
    const threshold = cover === "snow" ? 0.62 : 0.72;
    const salt = detail.range(0, 100);
    const [covered, rest] = splitFacesByNormal(
      geometry,
      (normal, center) => normal.y + 0.35 * (patch(center, salt) - 0.5) > threshold && center.y > height * 0.3
    );
    stoneGeometry = rest;
    const coverMesh = new THREE3.Mesh(
      covered,
      createToonMaterial({ ramp: COVERS[cover].ramp, ink: COVERS[cover].ink, pattern: "speckle", seed: detail.int(0, 96), id: 11 })
    );
    coverMesh.name = cover;
    coverMesh.castShadow = true;
    coverMesh.receiveShadow = true;
    group.add(coverMesh);
  }
  const stoneMesh = new THREE3.Mesh(
    stoneGeometry,
    createToonMaterial({
      ramp: stone.ramp,
      ink: stone.ink,
      steps: [0.36, 0.58, 0.8],
      patternParams: [16, 0.05, 0.2, 1],
      crease: true,
      pattern: "speckle",
      seed: detail.int(0, 96),
      id: 10
    })
  );
  stoneMesh.name = "stone";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
}
function patch(center, salt) {
  const v = Math.sin(center.x * 12.9898 + center.y * 78.233 + center.z * 37.719 + salt) * 43758.5453;
  return v - Math.floor(v);
}
export {
  create,
  disposeObject as dispose,
  meta,
  setWind,
  tick
};
