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
  uWindStrength: { value: 1 },
  // Lumières de halo (créatures qui brillent, lanternes...) : xyz position dans le monde, w portée (m) ; couleur
  // rgb + force. Elles ne comptent que dans le noir (`uDarkness`).
  uGlowLights: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  // w = 0 : place libre
  uGlowColors: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uDarkness: { value: 0 }
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
varying vec3 vWorldPos;

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

  vWorldPos = (toWorld * vec4(transformed, 1.0)).xyz;

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
uniform float uInked;
uniform float uSelfEdge;
uniform float uShadowLit;
uniform vec4 uPattern; // sens selon le motif (voir createToonMaterial)
uniform float uSeed;
uniform vec4 uGlowLights[4];
uniform vec4 uGlowColors[4];
uniform float uDarkness;
uniform float uGlowReceive;
varying vec3 vWorldPos;
uniform vec2 uRim; // x : lumi\xE8re ajout\xE9e sur le bord de la silhouette, y : largeur de la frange (0..1, en 1 - normale.z)

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

  // Liser\xE9 lumineux : la frange de la silhouette (normale presque perpendiculaire \xE0 la vue) gagne un ou deux crans,
  // m\xEAme \xE0 l'ombre. Mati\xE8res qui brillent par elles-m\xEAmes ou translucides (glace, gel\xE9e, esprits de lumi\xE8re).
  lit += uRim.x * step(1.0 - uRim.y, 1.0 - N.z) * step(0.0001, uRim.y);

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

  // Lumi\xE8res de halo : dans le noir, le d\xE9cor proche prend la couleur de la source, en trois paliers nets \xE0
  // fronti\xE8re tram\xE9e. Le palier est \xE9crit dans l'alpha : la passe finale ne l'assombrit pas de la teinte de nuit.
  float glowLevel = 0.0;
  if (uGlowReceive > 0.5 && uDarkness > 0.001) {
    vec3 glowTint = vec3(0.0);
    float glowSum = 0.0;
    for (int i = 0; i < 4; i++) {
      vec4 source = uGlowLights[i];
      vec4 tint = uGlowColors[i];
      if (source.w <= 0.0 || tint.w <= 0.0) continue;
      vec3 toLight = source.xyz - vWorldPos;
      float d = length(toLight) / source.w;
      if (d >= 1.0) continue;
      vec3 Lv = normalize((viewMatrix * vec4(toLight, 0.0)).xyz);
      float k = (1.0 - d) * (0.4 + 0.6 * max(dot(N, Lv), 0.0)) * tint.w;
      glowTint += tint.rgb * k;
      glowSum += k;
    }
    // Trame de Bayer 4\xD74 : 4 \xD7 B2(p mod 2) + B2(p / 2), avec B2(x, y) = (2x + 3y) mod 4.
    vec2 bp = mod(floor(gl_FragCoord.xy), 4.0);
    vec2 lo = mod(bp, 2.0), hi = floor(bp / 2.0);
    float bayer = (4.0 * mod(lo.x * 2.0 + lo.y * 3.0, 4.0) + mod(hi.x * 2.0 + hi.y * 3.0, 4.0) + 0.5) / 16.0;
    glowLevel = clamp(floor(glowSum * uDarkness * 3.0 + 0.45 + (bayer - 0.5) * 0.2), 0.0, 3.0);
    if (glowLevel > 0.0) {
      // La surface prend la teinte de la lumi\xE8re et ne garde que sa clart\xE9 (et un soup\xE7on de sa couleur).
      vec3 L = glowTint / max(glowSum, 1e-4);
      // Clart\xE9 plancher : la source \xE9claire aussi ce que le soleil laisse dans l'ombre (sous elle-m\xEAme).
      float luma = max(dot(color, vec3(0.3, 0.55, 0.15)), 0.32 + 0.06 * glowLevel);
      vec3 lit = min(L * (0.35 + 0.95 * luma) + color * 0.1 + L * 0.1 * glowLevel, vec3(1.0));
      color = mix(color, lit, 0.4 + 0.2 * glowLevel);
    }
  }

  // Alpha : 1 = surface, 0.75 = surface avec liser\xE9 clair sur les ar\xEAtes vives, 0.6 = surface sans contour
  // (0 = fond, jamais \xE9crit ici) ; moins 0,02 par palier de lumi\xE8re de halo (0 \xE0 3).
  gl_FragColor = vec4(color, (uInked > 0.5 ? 1.0 - 0.25 * uCrease : 0.6) - glowLevel * 0.02);
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
    outline = true,
    selfEdge = foliage ? 1.1 : 0,
    shadowLit = 0.36,
    sway = { amplitude: 0, height: 1 },
    side = foliage ? THREE.DoubleSide : THREE.FrontSide,
    unlit = false,
    twinkle = 0,
    rim = [0, 0],
    glow = true,
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
      uInked: { value: outline ? 1 : 0 },
      uSelfEdge: { value: selfEdge },
      uShadowLit: { value: shadowLit },
      uPattern: { value: new THREE.Vector4(...patternParams ?? patternInfo.value) },
      uSeed: { value: seed },
      uRim: { value: new THREE.Vector2(...rim) },
      uGlowReceive: { value: glow ? 1 : 0 },
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
var SPRITE_NORMAL = new THREE2.Vector3(0, 1, 0);
var _rockPoint = new THREE2.Vector3();
var _rockEuler = new THREE2.Euler();

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
