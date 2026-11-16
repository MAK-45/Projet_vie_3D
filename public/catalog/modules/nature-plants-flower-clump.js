// Projet Vie 3D — Massif de fleurs (nature/plants/flower-clump), version 2
// Module autonome : seule dépendance, three@0.186.0 (import "three").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/nature/plants/flower-clump.js
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
uniform float uTwinkle; // UNLIT + FOLIAGE : amplitude de la pulsation des formes (\xD7 souplesse de chaque sommet)

#ifdef FOLIAGE
  attribute vec3 aCorner; // xy : coin de la feuille dans le plan de l'\xE9cran ; z : avanc\xE9e vers la cam\xE9ra (unit\xE9s monde, 0 si absent)
  attribute vec4 aLeaf;   // x : phase, y : occlusion (0 c\u0153ur, 1 ext\xE9rieur), z : variation, w : souplesse au vent
  varying vec3 vLeaf;
#endif

#if defined(PATTERN_BARK) || defined(PATTERN_FURROW)
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

  #if defined(FOLIAGE) && defined(UNLIT)
    vLeaf = aLeaf.xyz;
  #elif defined(FOLIAGE)
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
    float cornerScale = length(toWorld[0].xyz);
    #ifdef UNLIT
      // Astres : pas de vent ; flex devient le poids de la pulsation (rayons, scintillement d'\xE9toile).
      cornerScale *= 1.0 + uTwinkle * aLeaf.w * sin(uTime * 2.7 + aLeaf.x * 6.2831);
    #endif
    mvPosition.xyz += aCorner * cornerScale;
    gl_Position = projectionMatrix * mvPosition;
  #endif

  #if defined(PATTERN_BARK) || defined(PATTERN_FURROW)
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

#if defined(PATTERN_BARK) || defined(PATTERN_FURROW)
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

  #ifdef UNLIT
    float lit = 1.0; // lumineux par lui-m\xEAme : la couleur ne d\xE9pend que de la g\xE9om\xE9trie (occlusion des formes)
  #else
    float lit = dot(N, L) * 0.5 + 0.5;
  #endif
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

  #ifdef PATTERN_FURROW
    // \xC9corce crevass\xE9e (ch\xEAne, tilleul) : fissures verticales d'un pixel de large qui serpentent, s\xE9par\xE9es par
    // des plaques dont certaines sont un cran plus claires. Taille constante dans le monde.
    float density = uPattern.x;
    float spacing = uPattern.y;
    float row = floor(vUv.y * density);
    float lanes = max(2.0, floor(6.2832 * vRadius * density / spacing));
    float col = floor(fract(vUv.x) * lanes * spacing);
    float lane = floor(col / spacing);
    float seg = floor(row / 3.0 + hash12(vec2(lane, uSeed + 4.2)) * 3.0);
    float crackAt = floor(hash12(vec2(lane + uSeed, seg)) * spacing);
    float bridge = step(hash12(vec2(lane + uSeed * 3.1, floor(row / 2.0))), uPattern.w);
    ink = step(abs(mod(col, spacing) - crackAt), 0.5) * (1.0 - bridge);
    lit += uPattern.z * step(hash12(vec2(lane + uSeed * 1.7, floor(row / 5.0))), 0.3);
  #endif

  #ifdef PATTERN_SPECKLE
    // Grain : quelques cellules d'un pixel d\xE9cal\xE9es d'un cran de lumi\xE8re.
    vec3 cell = floor(vObjPos * uPattern.x + 0.001);
    float r = hash13(cell + uSeed);
    lit += uPattern.z * step(r, uPattern.y) - uPattern.z * step(1.0 - uPattern.y * uPattern.w, r);
  #endif

  #ifndef UNLIT
    float shadow = getShadowMask();
    lit = mix(min(lit, uShadowLit), lit, shadow);
  #endif

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
  // density (pixels par unité), écart entre deux fissures (pixels), éclat des plaques claires (en lumière),
  // part de fissures interrompues (0..1)
  furrow: { define: "PATTERN_FURROW", value: [16, 3, 0.1, 0.25] },
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
    side = foliage ? THREE.DoubleSide : THREE.FrontSide,
    unlit = false,
    twinkle = 0
  } = options;
  if (ramp.length < 2 || ramp.length > 6) throw new Error("ramp : 2 \xE0 6 couleurs");
  if (steps.length !== ramp.length - 1) throw new Error("steps : ramp.length - 1 valeurs");
  const patternInfo = PATTERNS[pattern];
  const defines = { RAMP_SIZE: ramp.length };
  if (foliage) defines.FOLIAGE = "";
  if (patternInfo.define) defines[patternInfo.define] = "";
  if (unlit) defines.UNLIT = "";
  const swayUniform = { value: new THREE.Vector2(sway.amplitude, sway.height) };
  const twinkleUniform = { value: twinkle };
  const material = new THREE.ShaderMaterial({
    name: foliage ? "ToonFoliage" : "Toon",
    defines,
    lights: true,
    side,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.lights),
      ...sharedUniforms,
      uSway: swayUniform,
      uTwinkle: twinkleUniform,
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
    const depthDefines = { FOLIAGE: "", DEPTH_ONLY: "" };
    if (unlit) depthDefines.UNLIT = "";
    material.userData.depthMaterial = new THREE.ShaderMaterial({
      name: "ToonFoliageDepth",
      defines: depthDefines,
      side: THREE.DoubleSide,
      uniforms: { ...sharedUniforms, uSway: swayUniform, uTwinkle: twinkleUniform },
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
function buildBladeGeometry(blades, { segments = 2 } = {}) {
  const positions = [];
  const normals = [];
  const corners = [];
  const data = [];
  const index = [];
  const point = new THREE2.Vector3();
  const push = (blade, t, cornerX) => {
    const u = 1 - t;
    point.set(0, 0, 0).addScaledVector(blade.base, u * u).addScaledVector(blade.bend, 2 * u * t).addScaledVector(blade.tip, t * t);
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
function buildFanGeometry(fans) {
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
    for (let i = 0; i < n; i++) index.push(first, first + 1 + i, first + 1 + (i + 1) % n);
  }
  return foliageGeometry(positions, normals, corners, data, index);
}
function starOutline(points, inner = 1) {
  const outline = [];
  const steps = inner === 1 ? points : points * 2;
  for (let i = 0; i < steps; i++) {
    const angle = i / steps * Math.PI * 2 + Math.PI / 2;
    const r = inner === 1 || i % 2 === 0 ? 1 : inner;
    outline.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  return outline;
}
var SPRITE_NORMAL = new THREE2.Vector3(0, 1, 0);
function foliageGeometry(positions, normals, corners, data, index) {
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new THREE2.BufferAttribute(new Float32Array(normals), 3));
  geometry.setAttribute("aCorner", new THREE2.BufferAttribute(new Float32Array(corners), 3));
  geometry.setAttribute("aLeaf", new THREE2.BufferAttribute(new Float32Array(data), 4));
  geometry.setIndex(index);
  return geometry;
}
var _rockPoint = new THREE2.Vector3();
var _rockEuler = new THREE2.Euler();

// src/assets/kit/palettes.js
var COVERS = {
  moss: { label: "Mousse", ramp: ["#22473c", "#33663e", "#4f8a3f", "#86b44a"], ink: "#142a26" },
  snow: { label: "Neige", ramp: ["#8a97b8", "#b9c3dc", "#e2e8f2", "#fbfbf6"], ink: "#5a6584" }
};
var GROUNDS = {
  dirt: { label: "Terre", ramp: ["#3e2a2c", "#5d3f33", "#7f5a3f", "#a07a52"], ink: "#24181b" }
};
var SNOWS = {
  fresh: { label: "Fra\xEEche", ramp: COVERS.snow.ramp, ink: COVERS.snow.ink },
  old: { label: "Tass\xE9e", ramp: ["#6b7390", "#959db4", "#bfc4d0", "#dddcd4"], ink: "#454b63" }
};
var MOSSES = {
  spring: { label: "Printemps", ramp: ["#285640", "#3f7d40", "#69a645", "#a6cf60"], ink: "#16302a" },
  summer: { label: "\xC9t\xE9", ramp: COVERS.moss.ramp, ink: COVERS.moss.ink },
  autumn: { label: "Automne", ramp: ["#45452c", "#68652f", "#93863a", "#bfa854"], ink: "#29281b" },
  winter: { label: "Hiver", ramp: ["#2a3c43", "#3f574f", "#5d775b", "#8ba283"], ink: "#18242a" }
};
GROUNDS.clay = { label: "Argile", ramp: ["#4a2724", "#7a3e2c", "#a65b39", "#c98552"], ink: "#2a1517" };
GROUNDS.mud = { label: "Boue", ramp: ["#2a2026", "#3e2f2f", "#574236", "#735a44"], ink: "#18121a" };
var GRASSES = {
  spring: {
    label: "Printemps",
    ramp: ["#22504a", "#327a4c", "#55a24c", "#8fca56", "#d3ec86"],
    sod: ["#1e4140", "#2b5d45", "#3f7c47", "#5d9b4b"]
  },
  summer: {
    label: "\xC9t\xE9",
    ramp: ["#1b3f40", "#285f43", "#3f8442", "#73ab45", "#bfd862"],
    sod: ["#18363a", "#22503f", "#356c40", "#518a43"]
  },
  autumn: {
    label: "Automne",
    ramp: ["#3c3a2e", "#5e5a32", "#8a7f38", "#b9a34a", "#e3cf82"],
    sod: ["#33322b", "#4a4a30", "#646235", "#827d3e"]
  },
  winter: {
    label: "Hiver",
    ramp: ["#3e4352", "#5d6159", "#857f68", "#ada185", "#dad3b8"],
    sod: ["#363b48", "#4a5050", "#625f56", "#7d7664"]
  }
};
var FLOWERS = {
  daisy: {
    label: "Marguerite",
    petals: ["#9b9cbd", "#d4d6e6", "#f4f3ee", "#fffdf4"],
    heart: ["#c27a1c", "#e6a823", "#f6cf3c", "#ffe676"],
    dry: ["#4f3a2c", "#6e5134", "#8d6b3f", "#ad8a52"]
  },
  poppy: {
    label: "Coquelicot",
    petals: ["#7a1f2e", "#b8282c", "#e2412f", "#ff7b52"],
    heart: ["#16121e", "#231b2b", "#33283a", "#4a3c4a"],
    dry: ["#3f4a3c", "#5a6a4c", "#7b8a5e", "#a1ab7c"]
  },
  cornflower: {
    label: "Bleuet",
    petals: ["#283a8a", "#3557c2", "#4e82e6", "#8ab8ff"],
    heart: ["#2a1f5a", "#3d2a78", "#553a94", "#7454ad"],
    dry: ["#4a4038", "#665746", "#857257", "#a48f6e"]
  },
  buttercup: {
    label: "Bouton d'or",
    petals: ["#b07214", "#e0a41a", "#f8d331", "#fff38a"],
    heart: ["#7d6a1e", "#a08a22", "#c4ac2e", "#e3cc4a"],
    dry: ["#4b4230", "#6a5c3a", "#8a7846", "#a99656"]
  },
  lavender: {
    label: "Lavande",
    petals: ["#3c2f6e", "#5a46a0", "#8068c8", "#b49ae8"],
    heart: ["#3c2f6e", "#5a46a0", "#8068c8", "#b49ae8"],
    dry: ["#4a4252", "#655c68", "#857a80", "#a59a9a"]
  }
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
var SEASONS = ["spring", "summer", "autumn", "winter"];
var SEASON_LABELS = { spring: "Printemps", summer: "\xC9t\xE9", autumn: "Automne", winter: "Hiver" };
function seedParam(description) {
  return { type: "int", default: 1, min: 0, max: 9999, label: "Graine", description };
}
function seasonParam(description, defaultSeason = "summer") {
  return { type: "enum", default: defaultSeason, values: SEASONS, labels: SEASON_LABELS, label: "Saison", description };
}
function choiceParam(label, options, description, defaultValue = Object.keys(options)[0]) {
  const labels = {};
  for (const [value, option] of Object.entries(options)) labels[value] = typeof option === "string" ? option : option.label;
  return { type: "enum", default: defaultValue, values: Object.keys(options), labels, label, description };
}
function numberParam(label, defaultValue, min, max, description, { step = 0.1, unit } = {}) {
  return { type: "number", default: defaultValue, min, max, step, ...unit ? { unit } : {}, label, description };
}
function variantsOf(name, spec) {
  const values = [spec.default, ...spec.values.filter((value) => value !== spec.default)];
  return values.map((value) => ({ id: value, name: spec.labels?.[value] ?? value, params: { [name]: value } }));
}

// src/assets/nature/plants/flower-clump.js
var params = {
  seed: seedParam("Change le bouquet : nombre et hauteur des tiges, inclinaison, place des fleurs et des feuilles."),
  species: choiceParam(
    "Fleur",
    FLOWERS,
    "Marguerite blanche \xE0 c\u0153ur jaune, coquelicot rouge \xE0 c\u0153ur noir, bleuet bleu, bouton d'or, ou \xE9pis de lavande."
  ),
  season: seasonParam("Printemps : boutons et fleurs m\xEAl\xE9s. \xC9t\xE9 : pleine floraison. Automne : t\xEAtes fan\xE9es. Hiver : tiges s\xE8ches."),
  count: numberParam("Tiges", 7, 3, 15, "Nombre de tiges fleuries (tripl\xE9 pour la lavande).", { step: 1 }),
  height: numberParam("Hauteur", 1, 0.6, 1.5, "Hauteur relative \xE0 la taille naturelle de la fleur (35 \xE0 55 cm).")
};
var meta = {
  id: "nature/plants/flower-clump",
  name: "Massif de fleurs",
  nameEn: "Flower clump",
  category: "nature",
  subcategory: "plants",
  description: "Petit massif de fleurs des champs : tiges fines au-dessus d'une rosette de feuilles, corolles et c\u0153urs qui ondulent au vent. Cinq fleurs (marguerite, coquelicot, bleuet, bouton d'or, lavande) et quatre saisons.",
  tags: [
    "fleurs",
    "massif de fleurs",
    "marguerite",
    "coquelicot",
    "bleuet",
    "bouton d'or",
    "lavande",
    "fleur des champs",
    "plante",
    "v\xE9g\xE9tation",
    "jardin",
    "vent",
    "saisons",
    "ext\xE9rieur",
    "flowers",
    "flower clump",
    "daisy",
    "poppy",
    "cornflower",
    "buttercup",
    "lavender",
    "wildflower",
    "plant",
    "vegetation",
    "garden",
    "wind",
    "seasons",
    "outdoor",
    "procedural"
  ],
  biomes: ["meadow", "garden", "village", "forest", "mountain"],
  version: 2,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au sol, au c\u0153ur du massif",
  footprint: { radius: 0.7, height: 0.68 },
  animated: ["wind"],
  params,
  variants: variantsOf("species", params.species)
};
var TAU = Math.PI * 2;
var FLEX = 0.3;
var HEART_LIFT = 0.03;
var HEART = starOutline(8);
var UP = new THREE3.Vector3(0, 1, 0);
var SPECIES = {
  daisy: { height: 0.45, head: 0.12, heart: 0.05, outline: starOutline(12, 0.8), leaves: 7, curve: 0.08, stretch: [1, 0.85] },
  poppy: { height: 0.55, head: 0.12, heart: 0.045, outline: starOutline(5, 0.86), leaves: 6, curve: 0.18, stretch: [1, 0.8] },
  cornflower: { height: 0.5, head: 0.1, heart: 0.04, outline: starOutline(8, 0.62), leaves: 5, curve: 0.1, stretch: [1, 0.9] },
  buttercup: { height: 0.35, head: 0.085, heart: 0.032, outline: starOutline(5, 0.86), leaves: 8, curve: 0.12, stretch: [1, 0.85] },
  lavender: { height: 0.5, head: 0.042, heart: 0, outline: starOutline(5), leaves: 12, curve: 0.05, stretch: [1, 1.3], spike: 5 }
};
var LAVENDER_LEAVES = ["#2e3f4a", "#455a5a", "#647a6a", "#8ea084", "#bfc8a6"];
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const kind = SPECIES[p.species];
  const colors = FLOWERS[p.species];
  const lavender = p.species === "lavender";
  const H = kind.height * p.height;
  const season = p.season;
  const spread = shape.range(0.35, 0.6) * (lavender ? 1.2 : 1);
  const leanAngle = shape.range(0, TAU);
  const lean = new THREE3.Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle)).multiplyScalar(shape.range(0, 0.18) * H);
  const unevenness = shape.range(0.15, 0.4);
  const footRadius = shape.range(0.06, 0.13) * (lavender ? 1.4 : 1);
  const blades = [];
  const petals = [];
  const hearts = [];
  const stemCount = Math.round(p.count * (lavender ? 3 : 1) * shape.range(0.85, 1.15));
  const blade = (base, bend, tip, width, tipWidth, normal, flex, baseOcclusion = 0, phase = detail.next()) => {
    blades.push({ base, bend, tip, width, tipWidth, normal, phase, variation: detail.next(), flex, baseOcclusion });
  };
  for (let i = 0; i < stemCount; i++) {
    const azimuth = i * 2.39996 + shape.range(-0.5, 0.5);
    const out = new THREE3.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const reach = Math.sqrt(shape.next());
    const base = out.clone().multiplyScalar(footRadius * reach);
    const h = H * (1 - unevenness * shape.next()) * (season === "winter" ? 0.85 : 1);
    const side = new THREE3.Vector3(-out.z, 0, out.x).multiplyScalar(shape.range(-1, 1) * kind.curve * h);
    const tip = base.clone().addScaledVector(out, spread * h * (0.4 + reach)).addScaledVector(UP, h).addScaledVector(lean, h / H);
    const bend = base.clone().addScaledVector(UP, h * 0.6).add(side).addScaledVector(lean, 0.3 * (h / H));
    const normal = out.clone().addScaledVector(UP, 1.2).normalize();
    const stemPhase = detail.next();
    blade(base, bend, tip, 0.05, 0.035, normal, FLEX, 0.1, stemPhase);
    const headNormal = out.clone().multiplyScalar(0.4).addScaledVector(UP, 1).normalize();
    const direction = tip.clone().sub(bend).normalize();
    if (lavender) {
      if (season === "winter" && detail.chance(0.4)) continue;
      for (let k = 0; k < kind.spike; k++) {
        const t = k / (kind.spike - 1);
        petals.push({
          position: tip.clone().addScaledVector(direction, -0.14 * H * (1 - t) + 0.02),
          outline: kind.outline,
          size: kind.head * (1 - 0.35 * t) * detail.range(0.9, 1.1),
          stretch: kind.stretch,
          rotation: detail.range(-0.4, 0.4),
          normal: headNormal,
          phase: detail.next(),
          variation: detail.next(),
          flex: FLEX,
          occlusion: 0.75 + 0.25 * t
        });
      }
      continue;
    }
    const roll = detail.next();
    const state = season === "spring" ? roll < 0.45 ? "bud" : "open" : season === "summer" ? roll < 0.1 ? "bud" : "open" : season === "autumn" ? roll < 0.35 ? "open" : "seed" : roll < 0.6 ? "seed" : "none";
    const head = tip.clone().addScaledVector(direction, 0.02);
    const size = kind.head * detail.range(0.85, 1.15);
    if (state === "open") {
      petals.push({
        position: head,
        outline: kind.outline,
        size,
        stretch: kind.stretch,
        rotation: detail.range(0, TAU),
        normal: headNormal,
        phase: stemPhase,
        variation: detail.next(),
        flex: FLEX
      });
      hearts.push({
        position: head.clone(),
        outline: HEART,
        lift: HEART_LIFT,
        size: kind.heart,
        stretch: [1, 0.85],
        rotation: 0,
        normal: headNormal,
        phase: stemPhase,
        variation: detail.next(),
        flex: FLEX
      });
    } else if (state === "bud") {
      petals.push({
        position: head,
        outline: starOutline(5, 0.8),
        size: size * 0.45,
        stretch: [0.8, 1.1],
        rotation: 0,
        normal: headNormal,
        phase: stemPhase,
        variation: detail.next(),
        flex: FLEX,
        occlusion: 0.35
      });
    } else if (state === "seed") {
      hearts.push({
        position: head,
        outline: starOutline(6, 0.8),
        size: Math.max(0.04, kind.heart * 1.3),
        stretch: [1, 1],
        rotation: 0,
        normal: headNormal,
        phase: stemPhase,
        variation: detail.next(),
        flex: FLEX
      });
    }
    if ((p.species === "buttercup" || p.species === "daisy") && state === "open" && detail.chance(0.4)) {
      const from = base.clone().lerp(tip, 0.55);
      const twigTip = from.clone().addScaledVector(out, 0.1 * H).addScaledVector(UP, 0.3 * h);
      const twigPhase = detail.next();
      blade(from, from.clone().addScaledVector(UP, 0.15 * h), twigTip, 0.045, 0.035, normal, FLEX, 0.6, twigPhase);
      petals.push({
        position: twigTip.clone().addScaledVector(UP, 0.015),
        outline: kind.outline,
        size: size * 0.8,
        stretch: kind.stretch,
        rotation: detail.range(0, TAU),
        normal: headNormal,
        phase: twigPhase,
        variation: detail.next(),
        flex: FLEX
      });
      hearts.push({
        position: twigTip.clone().addScaledVector(UP, 0.015),
        outline: HEART,
        lift: HEART_LIFT,
        size: kind.heart * 0.85,
        stretch: [1, 0.85],
        rotation: 0,
        normal: headNormal,
        phase: twigPhase,
        variation: detail.next(),
        flex: FLEX
      });
    }
  }
  const leafCount = Math.round(kind.leaves * (season === "winter" && !lavender ? 0.4 : 1) * shape.range(0.8, 1.25));
  for (let i = 0; i < leafCount; i++) {
    const azimuth = shape.range(0, TAU);
    const out = new THREE3.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const base = out.clone().multiplyScalar(footRadius * shape.range(0, 0.7));
    const length = (lavender ? 0.22 : 0.18) * shape.range(0.7, 1.2) * p.height;
    const rise = lavender ? shape.range(0.5, 0.9) : shape.range(0.25, 0.55);
    const tip = base.clone().addScaledVector(out, length * (1 - rise * 0.5)).addScaledVector(UP, length * rise);
    const bend = base.clone().addScaledVector(out, length * 0.3).addScaledVector(UP, length * rise * 0.9);
    blade(base, bend, tip, lavender ? 0.065 : 0.09, 0, out.clone().addScaledVector(UP, 1.2).normalize(), 0.3, 0.1);
  }
  const sway = { amplitude: 0.07 * H, height: H };
  const group = new THREE3.Group();
  group.name = meta.name;
  const addMesh = (name, geometry, material) => {
    geometry.computeBoundingSphere();
    geometry.boundingSphere.radius += 0.15;
    const mesh = new THREE3.Mesh(geometry, material);
    mesh.name = name;
    mesh.customDepthMaterial = material.userData.depthMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const stemRamp = lavender ? LAVENDER_LEAVES : GRASSES[season].ramp;
  addMesh(
    "stems",
    buildBladeGeometry(blades, { segments: 2 }),
    createToonMaterial({ ramp: stemRamp, steps: [0.3, 0.5, 0.7, 0.9], foliage: true, leafShade: [0.12, 0.4], id: 12, sway })
  );
  const faded = season === "winter" || lavender && season === "autumn";
  if (petals.length) {
    addMesh(
      "petals",
      buildFanGeometry(petals),
      createToonMaterial({
        ramp: faded ? colors.dry : colors.petals,
        steps: [0.3, 0.5, 0.7],
        foliage: true,
        leafShade: [0.1, 0.5],
        id: 13,
        sway
      })
    );
  }
  if (hearts.length) {
    const heartMaterial = createToonMaterial({
      ramp: season === "autumn" || season === "winter" ? colors.dry : colors.heart,
      steps: [0.3, 0.5, 0.7],
      foliage: true,
      leafShade: [0.08, 0],
      id: 13,
      // même identifiant que les pétales : pas de contour entre le cœur et sa corolle
      sway
    });
    addMesh("hearts", buildFanGeometry(hearts), heartMaterial);
  }
  group.userData.asset = { id: meta.id, params: p, stems: stemCount, flowers: petals.length };
  return group;
}
export {
  create,
  disposeObject as dispose,
  meta,
  setWind,
  tick
};
