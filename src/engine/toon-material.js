// Matériau « toon à palette » : le cœur du rendu pixel art.
//
// Au lieu d'éclairer une couleur, on choisit une couleur dans une rampe (de l'ombre vers la lumière) selon
// l'orientation de la surface par rapport au soleil. On obtient des aplats nets avec glissement de teinte
// (ombres froides, lumières chaudes), comme en pixel art dessiné à la main.
//
// - Les couleurs sont écrites telles quelles (sRGB brut) : la palette affichée est exactement celle du code.
// - Sortie 0 : couleur. Sortie 1 : normale + identifiant de contour, lus par la passe de contours
//   (src/engine/pixel-renderer.js).
// - Variante `foliage` : chaque feuille est un petit triangle toujours face à la caméra, animé par le vent.
// - Variante `unlit` : lumineux par lui-même (astres), ni soleil ni ombre ; avec `foliage`, formes face caméra qui
//   peuvent pulser (`twinkle`).
// - Motifs procéduraux (`pattern`) : `bark` (tirets d'écorce), `furrow` (écorce crevassée) et `speckle` (grain de pixels), sans texture.
// - Motif `ground` (sols) : couches de taches (herbe grasse, herbe sèche, terre...) calculées en coordonnées du monde
//   (attribut `aGround`), donc continues d'un morceau de terrain au suivant ; en aplats nets ou en dégradés lisses.

import * as THREE from "three";

/** Uniforms partagés par tous les matériaux (vent, temps). Mis à jour par `tick()`. */
export const sharedUniforms = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.92, 0.38) },
  uWindStrength: { value: 1 },
};

/**
 * Avance le temps des animations de décor (vent). À appeler une fois par image.
 * @param {number} seconds temps écoulé
 * @param {number} fps cadence « sprite » : 12 par défaut pour un mouvement saccadé façon pixel art, 0 = fluide
 */
export function tick(seconds, fps = 12) {
  sharedUniforms.uTime.value = fps > 0 ? Math.floor(seconds * fps) / fps : seconds;
}

/** Règle la force du vent (0 = immobile, 1 = brise). */
export function setWind(strength) {
  sharedUniforms.uWindStrength.value = strength;
}

/** Couleur hex (#rrggbb ou nombre) → Vector3 sRGB brut 0..1. */
export function rgb(hex) {
  const c = typeof hex === "string" ? parseInt(hex.replace("#", ""), 16) : hex;
  return new THREE.Vector3(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255);
}

const VERTEX = /* glsl */ `
#include <common>
#include <shadowmap_pars_vertex>

uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec2 uSway; // x : amplitude du balancement à la hauteur y (unités), y : hauteur de référence
uniform float uTwinkle; // UNLIT + FOLIAGE : amplitude de la pulsation des formes (× souplesse de chaque sommet)

#ifdef FOLIAGE
  attribute vec3 aCorner; // xy : coin de la feuille dans le plan de l'écran ; z : avancée vers la caméra (unités monde, 0 si absent)
  attribute vec4 aLeaf;   // x : phase, y : occlusion (0 cœur, 1 extérieur), z : variation, w : souplesse au vent
  varying vec3 vLeaf;
#endif

#if defined(PATTERN_BARK) || defined(PATTERN_FURROW)
  attribute float aRadius;
  varying float vRadius;
  varying vec2 vUv;
#endif

#ifdef PATTERN_GROUND
  attribute vec2 aGround; // coordonnées du point dans le monde (mètres), communes à tous les morceaux de terrain
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
    // Frémissement propre à chaque feuille, porté par une vague qui traverse le feuillage.
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
      // Astres : pas de vent ; flex devient le poids de la pulsation (rayons, scintillement d'étoile).
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
`;

const FRAGMENT = /* glsl */ `
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

varying vec3 vNormal;
varying vec3 vObjPos;

#ifdef FOLIAGE
  varying vec3 vLeaf;
  uniform vec2 uLeafShade; // x : éclat aléatoire par feuille, y : assombrissement du cœur
#endif

#if defined(PATTERN_BARK) || defined(PATTERN_FURROW)
  varying float vRadius;
  varying vec2 vUv;
#endif

#ifdef PATTERN_GROUND
  varying vec2 vGround;
  uniform vec3 uLayerRamp[12]; // 3 couches × 4 couleurs (ombre → lumière)
  uniform vec4 uLayers[3];     // x : échelle des taches (1/m), y : seuil (0..1), z : graine, w : poids de la modulation lente (±)
  uniform vec3 uFlowers[2];    // deux couleurs de fleurs semées en pixels
  uniform vec4 uGround;        // x : lisse (0/1), y : densité des fleurs, z : échelle de la modulation lente (1/m), w : frange tramée
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

// Couleur dans une rampe de 4 : par paliers nets (soft = 0) ou en dégradé (soft > 0, demi-largeur de la transition).
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
    float lit = 1.0; // lumineux par lui-même : la couleur ne dépend que de la géométrie (occlusion des formes)
  #else
    float lit = dot(N, L) * 0.5 + 0.5;
  #endif
  float ink = 0.0;

  #ifdef FOLIAGE
    lit += (vLeaf.z - 0.5) * uLeafShade.x;
    lit *= mix(1.0 - uLeafShade.y, 1.0, vLeaf.y);
  #endif

  #ifdef PATTERN_BARK
    // Tirets horizontaux d'un « pixel » de haut, de taille constante dans le monde quel que soit le diamètre.
    float density = uPattern.x;
    float row = floor(vUv.y * density);
    float cols = max(4.0, floor(6.2832 * vRadius * density));
    float col = floor(fract(vUv.x) * cols);
    float start = floor(hash12(vec2(row, uSeed + 1.3)) * cols);
    float len = 1.0 + floor(hash12(vec2(row, uSeed + 2.7)) * 0.45 * cols);
    float dcol = mod(col - start + cols, cols);
    ink = step(hash12(vec2(row, uSeed)), uPattern.y) * step(dcol, len - 0.5);
    // Nœuds plus épais, rares.
    float row2 = floor(row / 2.0);
    float start2 = floor(hash12(vec2(row2, uSeed + 5.1)) * cols);
    float dcol2 = mod(col - start2 + cols, cols);
    ink = max(ink, step(hash12(vec2(row2, uSeed + 7.9)), uPattern.y * 0.22) * step(dcol2, 1.5));
    // Pied du tronc : écorce sombre et crevassée.
    float foot = 1.0 - smoothstep(0.0, uPattern.z, vObjPos.y);
    ink = max(ink, step(hash12(vec2(col * 3.0 + uSeed, floor(row / 3.0))), foot * uPattern.w));
    // Plaques grisées.
    lit -= 0.14 * step(0.82, hash12(vec2(floor(col / 2.0) + uSeed, floor(row / 4.0))));
  #endif

  #ifdef PATTERN_FURROW
    // Écorce crevassée (chêne, tilleul) : fissures verticales d'un pixel de large qui serpentent, séparées par
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
    // Grain : quelques cellules d'un pixel décalées d'un cran de lumière.
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
    // Sol : rampe de base puis couches de taches, toutes calculées sur la position dans le monde. En mode net,
    // chaque cellule d'un pixel prend une seule couleur et la frontière des taches est tramée ; en mode lisse,
    // les couleurs se fondent.
    float smoothMode = uGround.x;
    vec2 cell = floor(vGround * uPattern.x);
    vec2 q = mix((cell + 0.5) / uPattern.x, vGround, smoothMode);
    float cellRand = hash12(cell + uSeed * 7.31);
    float soft = smoothMode * 0.035;
    float grain = (1.0 - smoothMode) * uPattern.z * (step(1.0 - uPattern.y, cellRand) - step(cellRand, uPattern.y * uPattern.w));
    // Lisse : marbrure douce de la lumière, pour que l'herbe ne soit pas un aplat uni de près.
    float mottle = smoothMode * (patchNoise(q * 0.9 + uSeed * 0.71) - 0.5) * 0.09;
    float gl = lit + grain + mottle;
    color = shade4(uRamp[0], uRamp[1], uRamp[2], uRamp[3], gl, soft);
    float slow = valueNoise(q * uGround.z + uSeed * vec2(3.7, 1.3));
    for (int k = 0; k < 3; k++) {
      vec4 layer = uLayers[k];
      if (k == 1 && uGround.y > 0.0) {
        // Fleurs semées en pixels dans les zones fleuries, avant l'herbe sèche et la terre.
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

  // Alpha : 1 = surface, 0.75 = surface avec liseré clair sur les arêtes vives, 0.6 = surface sans contour
  // (0 = fond, jamais écrit ici).
  gl_FragColor = vec4(color, uInked > 0.5 ? 1.0 - 0.25 * uCrease : 0.6);
  gAux = vec4(N.xy * 0.5 + 0.5, uSelfEdge * 0.25, uId / 255.0);
}
`;

const DEPTH_FRAGMENT = /* glsl */ `
void main() {
  gl_FragColor = vec4(1.0);
}
`;

const PATTERNS = {
  none: { define: null, value: [0, 0, 0, 0] },
  // density (pixels par unité), fréquence des tirets (0..1), hauteur du pied sombre (unités), densité du pied (0..1)
  bark: { define: "PATTERN_BARK", value: [16, 0.3, 1.0, 0.8] },
  // density (pixels par unité), écart entre deux fissures (pixels), éclat des plaques claires (en lumière),
  // part de fissures interrompues (0..1)
  furrow: { define: "PATTERN_FURROW", value: [16, 3, 0.1, 0.25] },
  // density (cellules par unité), probabilité (0..1), amplitude (en lumière), part de grains sombres (0..1)
  speckle: { define: "PATTERN_SPECKLE", value: [16, 0.08, 0.2, 1] },
  // sols (options.ground) : density (pixels par unité), probabilité du grain (0..1), amplitude du grain (en
  // lumière), part de grains sombres (0..1)
  ground: { define: "PATTERN_GROUND", value: [16, 0.06, 0.06, 1] },
};

function defaultSteps(count) {
  const steps = [];
  for (let i = 1; i < count; i++) steps.push(0.3 + (0.5 * (i - 1)) / Math.max(1, count - 2));
  return steps;
}

/**
 * Crée un matériau toon à palette.
 *
 * @param {object} options
 * @param {Array<string|number>} options.ramp couleurs de l'ombre vers la lumière (2 à 6)
 * @param {number[]} [options.steps] seuils de lumière (0..1) entre deux couleurs ; `ramp.length - 1` valeurs
 * @param {string|number} [options.ink] couleur des marques du motif (écorce)
 * @param {"none"|"bark"|"furrow"|"speckle"|"ground"} [options.pattern]
 * @param {number[]} [options.patternParams] 4 nombres, voir PATTERNS
 * @param {number} [options.seed] graine du motif
 * @param {boolean} [options.foliage] feuilles en triangles face caméra (géométrie de `buildLeafGeometry`)
 * @param {number[]} [options.leafShade] [éclat aléatoire par feuille, assombrissement du cœur]
 * @param {number} [options.id] identifiant de contour 1..255 : un contour sépare deux identifiants différents
 * @param {boolean} [options.crease] liseré clair sur les arêtes vives (meubles, murs, socles)
 * @param {boolean} [options.outline] faux : aucun contour sombre sur cette matière (poussières, pollen, papillons :
 *   des formes de quelques pixels que leur contour mangerait entièrement)
 * @param {number} [options.selfEdge] écart de profondeur (unités, 0..4) à partir duquel un contour est tracé
 *   entre deux parties du même objet ; 0 = seuil général. Le feuillage en a besoin pour ne pas cerner chaque feuille.
 * @param {number} [options.shadowLit] lumière maximale dans une ombre portée (0..1)
 * @param {{amplitude:number,height:number}} [options.sway] balancement au vent
 * @param {number} [options.side] THREE.FrontSide par défaut (DoubleSide pour le feuillage)
 * @param {boolean} [options.unlit] lumineux par lui-même (soleil, lune, étoiles) : ni soleil ni ombre portée.
 *   Avec `foliage` et `leafShade: [0, 1]`, l'occlusion de chaque forme choisit directement sa couleur dans la rampe.
 * @param {number} [options.twinkle] avec `unlit` + `foliage` : amplitude de la pulsation des formes, pondérée par
 *   le `flex` de chaque sommet (le vent n'agit pas sur un astre)
 * @param {object} [options.ground] avec `pattern: "ground"` (rampe de 4 couleurs, géométrie avec l'attribut
 *   `aGround`, voir `buildTerrainChunk`) : jusqu'à 3 couches de taches posées dans l'ordre sur la rampe de base.
 * @param {Array<{ramp: string[], scale: number, threshold: number, seed?: number, drift?: number}>} [options.ground.layers]
 *   `scale` : fréquence des taches (1/m) ; `threshold` : plus haut = moins de taches ; `drift` : la tache gagne
 *   (> 0) ou recule (< 0) là où la modulation lente est forte (grandes zones plus sèches ou plus grasses)
 * @param {boolean} [options.ground.smooth] dégradés lisses au lieu d'aplats nets tramés
 * @param {string[]} [options.ground.flowers] deux couleurs de fleurs semées en pixels (avant la 2e couche)
 * @param {number} [options.ground.flowerDensity] part des pixels fleuris dans une zone fleurie (0..0,3)
 * @param {number} [options.ground.driftScale] fréquence de la modulation lente (1/m)
 * @param {number} [options.ground.fringe] largeur de la frange tramée au bord des taches (0..0,3)
 */
export function createToonMaterial(options) {
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
    ground,
  } = options;

  if (ramp.length < 2 || ramp.length > 6) throw new Error("ramp : 2 à 6 couleurs");
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
      value: new THREE.Vector4(g.smooth ? 1 : 0, g.flowers ? (g.flowerDensity ?? 0.06) : 0, g.driftScale ?? 0.025, g.fringe ?? 0.12),
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
      uPattern: { value: new THREE.Vector4(...(patternParams ?? patternInfo.value)) },
      uSeed: { value: seed },
      uLeafShade: { value: new THREE.Vector2(...leafShade) },
      ...groundUniforms,
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });

  if (foliage) {
    // Les feuilles sont déplacées dans le vertex shader : la passe d'ombre a besoin du même déplacement.
    const depthDefines = { FOLIAGE: "", DEPTH_ONLY: "" };
    if (unlit) depthDefines.UNLIT = "";
    material.userData.depthMaterial = new THREE.ShaderMaterial({
      name: "ToonFoliageDepth",
      defines: depthDefines,
      side: THREE.DoubleSide,
      uniforms: { ...sharedUniforms, uSway: swayUniform, uTwinkle: twinkleUniform },
      vertexShader: VERTEX,
      fragmentShader: DEPTH_FRAGMENT,
    });
  }

  return material;
}

/** Libère géométries et matériaux d'un objet créé avec ces matériaux (et tout son sous-arbre). */
export function disposeObject(root) {
  root.traverse((child) => {
    child.geometry?.dispose();
    for (const material of [child.material ?? []].flat()) {
      material.userData.depthMaterial?.dispose();
      material.dispose();
    }
    child.customDepthMaterial?.dispose();
  });
}
