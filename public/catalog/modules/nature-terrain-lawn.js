// Projet Vie 3D — Pelouse (nature/terrain/lawn), version 1
// Module autonome : seule dépendance, three@0.186.0 (import "three").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/nature/terrain/lawn.js
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

#ifdef PATTERN_GROUND
  attribute vec2 aGround; // coordonn\xE9es du point dans le monde (m\xE8tres), communes \xE0 tous les morceaux de terrain
  varying vec2 vGround;
#endif

varying vec3 vNormal;
varying vec3 vObjPos;

void main() {
  #ifdef PATTERN_GROUND
    vGround = aGround;
  #endif
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

#ifdef PATTERN_GROUND
  varying vec2 vGround;
  uniform vec3 uLayerRamp[12]; // 3 couches \xD7 4 couleurs (ombre \u2192 lumi\xE8re)
  uniform vec4 uLayers[3];     // x : \xE9chelle des taches (1/m), y : seuil (0..1), z : graine, w : poids de la modulation lente (\xB1)
  uniform vec3 uFlowers[2];    // deux couleurs de fleurs sem\xE9es en pixels
  uniform vec4 uGround;        // x : lisse (0/1), y : densit\xE9 des fleurs, z : \xE9chelle de la modulation lente (1/m), w : frange tram\xE9e
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

#ifdef PATTERN_GROUND
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float patchNoise(vec2 p) {
  return valueNoise(p) * 0.62 + valueNoise(p * 2.63 + 17.3) * 0.28 + valueNoise(p * 6.1 - 5.1) * 0.1;
}

// Couleur dans une rampe de 4 : par paliers nets (soft = 0) ou en d\xE9grad\xE9 (soft > 0, demi-largeur de la transition).
vec3 shade4(vec3 c0, vec3 c1, vec3 c2, vec3 c3, float lit, float soft) {
  vec3 color = c0;
  if (soft > 0.0) {
    color = mix(color, c1, smoothstep(uSteps[0] - soft, uSteps[0] + soft, lit));
    color = mix(color, c2, smoothstep(uSteps[1] - soft, uSteps[1] + soft, lit));
    color = mix(color, c3, smoothstep(uSteps[2] - soft, uSteps[2] + soft, lit));
  } else {
    if (lit > uSteps[0]) color = c1;
    if (lit > uSteps[1]) color = c2;
    if (lit > uSteps[2]) color = c3;
  }
  return color;
}
#endif

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
  #ifdef PATTERN_GROUND
    // Sol : rampe de base puis couches de taches, toutes calcul\xE9es sur la position dans le monde. En mode net,
    // chaque cellule d'un pixel prend une seule couleur et la fronti\xE8re des taches est tram\xE9e ; en mode lisse,
    // les couleurs se fondent.
    float smoothMode = uGround.x;
    vec2 cell = floor(vGround * uPattern.x);
    vec2 q = mix((cell + 0.5) / uPattern.x, vGround, smoothMode);
    float cellRand = hash12(cell + uSeed * 7.31);
    float soft = smoothMode * 0.035;
    float grain = (1.0 - smoothMode) * uPattern.z * (step(1.0 - uPattern.y, cellRand) - step(cellRand, uPattern.y * uPattern.w));
    // Lisse : marbrure douce de la lumi\xE8re, pour que l'herbe ne soit pas un aplat uni de pr\xE8s.
    float mottle = smoothMode * (patchNoise(q * 0.9 + uSeed * 0.71) - 0.5) * 0.09;
    float gl = lit + grain + mottle;
    color = shade4(uRamp[0], uRamp[1], uRamp[2], uRamp[3], gl, soft);
    float slow = valueNoise(q * uGround.z + uSeed * vec2(3.7, 1.3));
    for (int k = 0; k < 3; k++) {
      vec4 layer = uLayers[k];
      if (k == 1 && uGround.y > 0.0) {
        // Fleurs sem\xE9es en pixels dans les zones fleuries, avant l'herbe s\xE8che et la terre.
        float zone = smoothstep(0.5, 0.78, patchNoise(q * 0.22 + uSeed * 1.9 + 41.0));
        float pick = hash12(cell * 1.37 + uSeed + 3.3);
        float flower = step(pick, uGround.y * zone) * (1.0 - smoothMode);
        vec3 petal = pick < uGround.y * zone * 0.55 ? uFlowers[0] : uFlowers[1];
        color = mix(color, mix(petal, color, 0.45 * step(lit, uSteps[1])), flower);
      }
      if (layer.x <= 0.0) continue;
      float m = patchNoise(q * layer.x + layer.z * 13.7 + uSeed * vec2(5.31, 2.87));
      float threshold = layer.y - (slow - 0.5) * layer.w;
      float jitter = (hash12(cell * 0.73 + layer.z * 5.1) - 0.5) * uGround.w;
      float weight = smoothMode > 0.5
        ? smoothstep(threshold - 0.045, threshold + 0.045, m)
        : step(threshold, m + jitter);
      vec3 layerColor = shade4(uLayerRamp[k * 4], uLayerRamp[k * 4 + 1], uLayerRamp[k * 4 + 2], uLayerRamp[k * 4 + 3], gl, soft);
      color = mix(color, layerColor, weight);
    }
  #endif
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
  speckle: { define: "PATTERN_SPECKLE", value: [16, 0.08, 0.2, 1] },
  // sols (options.ground) : density (pixels par unité), probabilité du grain (0..1), amplitude du grain (en
  // lumière), part de grains sombres (0..1)
  ground: { define: "PATTERN_GROUND", value: [16, 0.06, 0.06, 1] }
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
    twinkle = 0,
    ground
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
  const groundUniforms = {};
  if (pattern === "ground") {
    if (ramp.length !== 4) throw new Error("pattern ground : rampe de 4 couleurs");
    const g = ground ?? {};
    const layers = (g.layers ?? []).slice(0, 3);
    const layerRamps = [];
    const layerInfo = [];
    for (let k = 0; k < 3; k++) {
      const layer = layers[k];
      const colors = layer?.ramp ?? ramp;
      if (colors.length !== 4) throw new Error("pattern ground : chaque couche a une rampe de 4 couleurs");
      layerRamps.push(...colors.map(rgb));
      layerInfo.push(new THREE.Vector4(layer?.scale ?? 0, layer?.threshold ?? 1, layer?.seed ?? k + 1, layer?.drift ?? 0));
    }
    const flowers = g.flowers ?? ["#ffffff", "#ffffff"];
    groundUniforms.uLayerRamp = { value: layerRamps };
    groundUniforms.uLayers = { value: layerInfo };
    groundUniforms.uFlowers = { value: flowers.map(rgb) };
    groundUniforms.uGround = {
      value: new THREE.Vector4(g.smooth ? 1 : 0, g.flowers ? g.flowerDensity ?? 0.06 : 0, g.driftScale ?? 0.025, g.fringe ?? 0.12)
    };
  }
  const material = new THREE.ShaderMaterial({
    name: foliage ? "ToonFoliage" : pattern === "ground" ? "ToonGround" : "Toon",
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
      uLeafShade: { value: new THREE.Vector2(...leafShade) },
      ...groundUniforms
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
function sequentialIndex(count) {
  const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
  for (let i = 0; i < count; i++) index[i] = i;
  return new THREE2.BufferAttribute(index, 1);
}
function buildMound(rng, { radius = [1, 1], height = 0.2, lobes = 0.2, power = 0.8, relief, rings = 5, sectors = 18, flat = false, offset = [0, 0, 0], rotation = 0 } = {}) {
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
      const theta = s / sectors * Math.PI * 2;
      const e = edge(theta) * rho;
      const x = Math.cos(theta) * radius[0] * e;
      const z = Math.sin(theta) * radius[1] * e;
      const falloff = Math.pow(Math.max(0, 1 - rho * rho), power);
      const y = ring === rings ? -0.02 : height * falloff + (relief ? relief(x, z) * falloff : 0);
      place(x, y, z);
    }
  }
  const index = [];
  for (let s = 0; s < sectors; s++) index.push(0, 1 + (s + 1) % sectors, 1 + s);
  for (let ring = 1; ring < rings; ring++) {
    const a = 1 + (ring - 1) * sectors;
    const b = 1 + ring * sectors;
    for (let s = 0; s < sectors; s++) {
      const s1 = (s + 1) % sectors;
      index.push(a + s, a + s1, b + s, a + s1, b + s1, b + s);
    }
  }
  let geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.Float32BufferAttribute(positions, 3));
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
function buildGroundTile({ size = 1, height = 0.03, divisions = 6, relief } = {}) {
  const half = size / 2;
  const n = divisions;
  const positions = [];
  const index = [];
  const top = (i, j) => i * (n + 1) + j;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = -half + size * j / n;
      const z = -half + size * i / n;
      positions.push(x, height + (relief ? relief(x, z) : 0), z);
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) index.push(top(i, j), top(i + 1, j), top(i, j + 1), top(i, j + 1), top(i + 1, j), top(i + 1, j + 1));
  }
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
    const b = skirtStart + (k + 1) % m * 2;
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

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
function createNoise3(seed) {
  const salt = Math.imul(Math.floor(seed) + 1, 668265261);
  const hash = (x, y, z) => {
    let h = Math.imul(x, 2376512323) ^ Math.imul(y, 3625334849) ^ Math.imul(z, 3407524639) ^ salt | 0;
    h = Math.imul(h ^ h >>> 15, 739982445);
    h = Math.imul(h ^ h >>> 12, 695872825);
    return ((h ^ h >>> 15) >>> 0) / 4294967296;
  };
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    const corner = (dx, dy, dz) => hash(xi + dx, yi + dy, zi + dz);
    return lerp(
      lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), u), lerp(corner(0, 1, 0), corner(1, 1, 0), u), v),
      lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), u), lerp(corner(0, 1, 1), corner(1, 1, 1), u), v),
      w
    );
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

// src/assets/nature/terrain/lawn.js
var params = {
  seed: seedParam("Change le contour de la plaque, les zones plus drues ou plus rases, la place des fleurs."),
  season: seasonParam("Vert vif au printemps, blondi en automne, ras et jauni en hiver."),
  cut: choiceParam(
    "Coupe",
    { mown: "Tondue", long: "Haute", wild: "Folle" },
    "Tondue : gazon ras et r\xE9gulier. Haute : brins longs qui ploient. Folle : hauteurs m\xEAl\xE9es, touffes et p\xE2querettes."
  ),
  shape: choiceParam(
    "Forme",
    { patch: "Plaque", tile: "Dalle carr\xE9e" },
    "Plaque au bord irr\xE9gulier, \xE0 poser seule ; ou dalle carr\xE9e dont les bords se raccordent \xE0 la dalle voisine."
  ),
  size: numberParam("Largeur", 1.6, 0.5, 3, "Largeur de la plaque ou c\xF4t\xE9 de la dalle.", { step: 0.1, unit: "m" }),
  fullness: numberParam("Densit\xE9", 1, 0.5, 1.5, "Nombre de brins (et de triangles).")
};
var meta = {
  id: "nature/terrain/lawn",
  name: "Pelouse",
  nameEn: "Lawn",
  category: "nature",
  subcategory: "terrain",
  description: "Pelouse : motte de gazon couverte de brins qui ondulent au vent. Tondue, haute ou folle avec des p\xE2querettes ; en plaque au bord irr\xE9gulier ou en dalle carr\xE9e raccordable. Quatre saisons.",
  tags: [
    "pelouse",
    "gazon",
    "herbe",
    "prairie",
    "p\xE2querettes",
    "dalle",
    "sol",
    "terrain",
    "v\xE9g\xE9tation",
    "vent",
    "saisons",
    "ext\xE9rieur",
    "lawn",
    "turf",
    "grass",
    "meadow",
    "daisies",
    "tile",
    "ground",
    "vegetation",
    "wind",
    "seasons",
    "outdoor",
    "procedural"
  ],
  biomes: ["meadow", "garden", "village", "forest"],
  version: 1,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au sol, au centre de la plaque",
  footprint: { radius: 1.05, height: 0.48 },
  animated: ["wind"],
  params,
  variants: variantsOf("season", params.season)
};
var TAU = Math.PI * 2;
var UP = new THREE3.Vector3(0, 1, 0);
var DAISY = starOutline(5, 0.55);
var CUTS = {
  mown: { spacing: 0.085, height: [0.07, 0.13], segments: 1, open: 0.25, flowers: 0 },
  long: { spacing: 0.11, height: [0.16, 0.3], segments: 2, open: 0.55, flowers: 0 },
  wild: { spacing: 0.1, height: [0.06, 0.46], segments: 2, open: 0.45, flowers: 1 }
};
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const noise = createNoise3(p.seed);
  const cut = CUTS[p.cut];
  const winter = p.season === "winter";
  const half = p.size / 2;
  const tile = p.shape === "tile";
  const grass = GRASSES[p.season];
  const relief = (x, z) => (noise(x * 2 + 3, 0.5, z * 2) - 0.5) * 0.03;
  let inside;
  let sodGeometry;
  if (tile) {
    sodGeometry = buildGroundTile({ size: p.size, height: 0.03, divisions: Math.max(3, Math.round(p.size * 4)), relief });
    const margin = 0.02;
    inside = (x, z) => Math.abs(x) < half - margin && Math.abs(z) < half - margin;
  } else {
    const radius = [half, half * shape.range(0.7, 0.95)];
    sodGeometry = buildMound(shape, { radius, height: 0.035, lobes: 0.3, power: 0.25, relief, rings: 4, sectors: 22, rotation: shape.range(0, TAU) });
    const outline = outerRing(sodGeometry, 4, 22);
    inside = (x, z) => insidePolygon(outline, x * 1.07, z * 1.07);
  }
  const vigor = (x, z) => noise(x * 1.3, 7.5, z * 1.3);
  const blades = [];
  const flowers = [];
  const spacing = cut.spacing / Math.sqrt(p.fullness);
  const cells = Math.ceil(p.size / spacing);
  const heightScale = winter ? 0.7 : p.season === "autumn" ? 0.9 : 1;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const x = -half + (j + detail.next()) * spacing;
      const z = -half + (i + detail.next()) * spacing;
      if (!inside(x, z)) continue;
      const v = vigor(x, z);
      if (p.cut !== "mown" && v < 0.25 && detail.chance(0.5)) continue;
      const base = new THREE3.Vector3(x, 0, z);
      const azimuth = detail.range(0, TAU);
      const out = new THREE3.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
      let h = THREE3.MathUtils.lerp(cut.height[0], cut.height[1], p.cut === "mown" ? detail.next() : Math.min(1, v * 1.3 * detail.range(0.5, 1.1)));
      h *= heightScale;
      const open = h * cut.open * detail.range(0.4, 1.2) * (winter ? 1.6 : 1);
      const tip = base.clone().addScaledVector(out, open).addScaledVector(UP, h * (winter ? 0.75 : 1));
      if (tile) {
        tip.x = THREE3.MathUtils.clamp(tip.x, -half, half);
        tip.z = THREE3.MathUtils.clamp(tip.z, -half, half);
      }
      blades.push({
        base,
        bend: base.clone().addScaledVector(out, open * 0.25).addScaledVector(UP, h * 0.7),
        tip,
        width: detail.range(0.075, 0.1),
        normal: out.clone().addScaledVector(UP, 1.3).normalize(),
        phase: detail.next(),
        variation: detail.next(),
        flex: p.cut === "mown" ? 0.15 : detail.range(0.3, 0.55),
        baseOcclusion: 0.15
      });
      if (cut.flowers && !winter && v < 0.55 && detail.chance(p.season === "autumn" ? 0.05 : 0.14)) {
        flowers.push({
          position: base.clone().add(new THREE3.Vector3(detail.range(-0.03, 0.03), cut.height[1] * heightScale * detail.range(0.55, 0.85), detail.range(-0.03, 0.03))),
          outline: DAISY,
          size: detail.range(0.075, 0.095),
          rotation: detail.range(0, TAU),
          normal: new THREE3.Vector3(detail.range(-0.3, 0.3), 1, detail.range(-0.3, 0.3)).normalize(),
          phase: detail.next(),
          variation: detail.next(),
          flex: 0.3
        });
      }
    }
  }
  const group = new THREE3.Group();
  group.name = meta.name;
  const sod = new THREE3.Mesh(
    sodGeometry,
    createToonMaterial({ ramp: grass.sod, steps: [0.36, 0.58, 0.8], pattern: "speckle", patternParams: [16, 0.08, 0.2, 1], seed: p.seed % 89, id: 11 })
  );
  sod.name = "sod";
  sod.receiveShadow = true;
  group.add(sod);
  const maxHeight = cut.height[1] * heightScale;
  const sway = { amplitude: 0.05 * maxHeight, height: maxHeight };
  const bladeGeometry = buildBladeGeometry(blades, { segments: cut.segments });
  bladeGeometry.computeBoundingSphere();
  bladeGeometry.boundingSphere.radius += 0.1;
  const bladeMaterial = createToonMaterial({
    ramp: grass.ramp,
    steps: [0.24, 0.42, 0.6, 0.78],
    foliage: true,
    leafShade: [0.16, 0.45],
    id: 11,
    // même identifiant que la motte : pas de contour autour de chaque brin
    sway
  });
  const bladeMesh = new THREE3.Mesh(bladeGeometry, bladeMaterial);
  bladeMesh.name = "grass";
  bladeMesh.customDepthMaterial = bladeMaterial.userData.depthMaterial;
  bladeMesh.castShadow = p.cut !== "mown";
  bladeMesh.receiveShadow = true;
  group.add(bladeMesh);
  if (flowers.length) {
    const flowerMaterial = createToonMaterial({ ramp: FLOWERS.daisy.petals, steps: [0.25, 0.45, 0.65], foliage: true, leafShade: [0.1, 0], id: 11, sway });
    const flowerMesh = new THREE3.Mesh(buildFanGeometry(flowers), flowerMaterial);
    flowerMesh.name = "daisies";
    flowerMesh.customDepthMaterial = flowerMaterial.userData.depthMaterial;
    flowerMesh.receiveShadow = true;
    group.add(flowerMesh);
  }
  group.userData.asset = { id: meta.id, params: p, blades: blades.length, flowers: flowers.length };
  return group;
}
function outerRing(geometry, rings, sectors) {
  const position = geometry.attributes.position;
  const start = 1 + (rings - 1) * sectors;
  const ring = [];
  for (let s = 0; s < sectors; s++) ring.push([position.getX(start + s), position.getZ(start + s)]);
  return ring;
}
function insidePolygon(polygon, x, z) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > z !== zj > z && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export {
  create,
  disposeObject as dispose,
  meta,
  setWind,
  tick
};
