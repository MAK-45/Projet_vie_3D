// Projet Vie 3D — Nager (animations/locomotion/swim), version 1
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

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
var MAGIC_PALETTES = {
  ice: { label: "Glace", colors: ["#081026", "#102654", "#1a4a90", "#2c7ccc", "#58b6ee", "#9fe0ff", "#dcf8ff", "#ffffff"] },
  arcane: { label: "Arcane", colors: ["#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"] },
  ember: { label: "Braise", colors: ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"] },
  sap: { label: "S\xE8ve", colors: ["#08201a", "#0f3f2c", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"] },
  dawn: { label: "Aurore", colors: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"] },
  neon: { label: "N\xE9on", colors: ["#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"] },
  abyss: { label: "Abysse", colors: ["#050308", "#0f0a18", "#1c1230", "#2c1a4a", "#432468", "#5e3290", "#8048b8", "#a970e0"] },
  lagoon: { label: "Lagon", colors: ["#041418", "#08303a", "#0c5260", "#108088", "#18b4b0", "#4ce8d8", "#b4fff0", "#ffffff"] },
  blood: { label: "Sang", colors: ["#14040a", "#3a0a14", "#6a101c", "#a01824", "#d42a30", "#ff5a50", "#ff9a8a"] }
};
function fitRamp(colors, n) {
  if (colors.length === n) return colors.slice();
  return Array.from({ length: n }, (_, i) => colors[Math.round(i * (colors.length - 1) / Math.max(1, n - 1))]);
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
function numberParam(label, defaultValue, min, max, description, { step = 0.1, unit } = {}) {
  return { type: "number", default: defaultValue, min, max, step, ...unit ? { unit } : {}, label, description };
}
function variantsOf(name, spec) {
  const values = [spec.default, ...spec.values.filter((value) => value !== spec.default)];
  return values.map((value) => ({ id: value, name: spec.labels?.[value] ?? value, params: { [name]: value } }));
}

// src/assets/kit/humanoid.js
import * as THREE4 from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

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
  uDarkness: { value: 0 },
  // Monde courbé : xy centre (x, z du monde, la caméra), z courbure (1 / 2R), w distance où la courbure commence (m).
  uCurve: { value: new THREE.Vector4(0, 0, 0, 0) }
};
var glowSlots = [false, false, false, false];
function createGlowLight() {
  const slot = glowSlots.indexOf(false);
  if (slot < 0) return { set() {
  }, release() {
  } };
  glowSlots[slot] = true;
  const light = sharedUniforms.uGlowLights.value[slot];
  const color = sharedUniforms.uGlowColors.value[slot];
  return {
    set(position, rgbColor, radius, strength = 1) {
      light.set(position.x, position.y, position.z, radius);
      color.set(rgbColor.x, rgbColor.y, rgbColor.z, strength);
    },
    release() {
      light.set(0, 0, 0, 0);
      color.set(0, 0, 0, 0);
      glowSlots[slot] = false;
    }
  };
}
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
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>

uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec4 uCurve;
uniform vec2 uFade; // apparition en douceur : de x \xE0 y m\xE8tres de la cam\xE9ra, la copie rentre dans le sol (0, 0 : rien)
uniform vec3 uLod;  // FOLIAGE, passage \xE0 la version lointaine : de x \xE0 y m\xE8tres, les feuilles absentes de cette
                    // version (aFar 0) rapetissent jusqu'\xE0 rien, les autres grandissent de z (y \xE0 0 : rien)
uniform vec2 uSway; // x : amplitude du balancement \xE0 la hauteur y (unit\xE9s), y : hauteur de r\xE9f\xE9rence
uniform float uTwinkle; // UNLIT + FOLIAGE : amplitude de la pulsation des formes (\xD7 souplesse de chaque sommet)

#ifdef WOBBLE
  uniform vec3 uWobble; // x : amplitude (unit\xE9s), y : fr\xE9quence des vagues (1/unit\xE9), z : vitesse
  float wobbleHash(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
  }
  float wobbleNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(wobbleHash(i), wobbleHash(i + vec3(1.0, 0.0, 0.0)), f.x);
    float b = mix(wobbleHash(i + vec3(0.0, 1.0, 0.0)), wobbleHash(i + vec3(1.0, 1.0, 0.0)), f.x);
    float c = mix(wobbleHash(i + vec3(0.0, 0.0, 1.0)), wobbleHash(i + vec3(1.0, 0.0, 1.0)), f.x);
    float d = mix(wobbleHash(i + vec3(0.0, 1.0, 1.0)), wobbleHash(i + vec3(1.0, 1.0, 1.0)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z) * 2.0 - 1.0;
  }
#endif

#ifdef FOLIAGE
  attribute vec3 aCorner; // xy : coin de la feuille dans le plan de l'\xE9cran ; z : avanc\xE9e vers la cam\xE9ra (unit\xE9s monde, 0 si absent)
  attribute vec4 aLeaf;   // x : phase, y : occlusion (0 c\u0153ur, 1 ext\xE9rieur), z : variation, w : souplesse au vent
  attribute float aFar;   // 1 : feuille gard\xE9e dans la version lointaine (kit/far-tree.js), 0 sinon ou absent
  varying vec3 vLeaf;
#endif

#if defined(PATTERN_BARK) || defined(PATTERN_FURROW)
  attribute float aRadius;
  attribute float aFar; // 1 : sommet gard\xE9 dans la version lointaine (kit/far-tree.js), 0 sinon ou absent
  varying float vRadius;
  varying float vDrop;
  varying vec2 vUv;
#endif

#ifdef PATTERN_GROUND
  attribute vec2 aGround; // coordonn\xE9es du point dans le monde (m\xE8tres), communes \xE0 tous les morceaux de terrain
  varying vec2 vGround;
#endif

#ifdef TONE
  attribute float aTone; // d\xE9calage de lumi\xE8re par sommet (suie, tons d'un bloc de pierre), en crans de la rampe
  varying float vTone;
#endif
#ifdef SHADE
  attribute float aShade; // UNLIT : ton de chaque sommet (0 sombre .. 1 clair), interpol\xE9 puis d\xE9coup\xE9 en paliers
#endif
varying vec3 vNormal;
varying vec3 vObjPos;
varying vec3 vWorldPos;
#ifdef SHADE
  varying float vShade;
#endif

#ifdef TOON_MAP
  varying vec2 vMapUv;
#endif

void main() {
  #ifdef PATTERN_GROUND
    vGround = aGround;
  #endif
  #include <skinbase_vertex>
  #include <beginnormal_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  vNormal = transformedNormal;

  #include <begin_vertex>
  #include <skinning_vertex>
  #ifdef WOBBLE
    // Ondulation (mati\xE8res vivantes : le mannequin magique) : chaque sommet glisse le long de sa normale, pouss\xE9 par
    // deux bruits lus sur la pose de repos (les vagues restent attach\xE9es \xE0 leur partie du corps quand elle bouge) et
    // qui d\xE9rivent dans le temps, comme le corps du blob. Apr\xE8s le squelette : toutes les animations restent justes.
    vec3 wq = position * uWobble.y;
    float wt = uTime * uWobble.z;
    float wave = wobbleNoise(wq + vec3(cos(wt), sin(wt), wt * 0.5) * 1.3) * 0.75
      + wobbleNoise(wq * 2.3 + vec3(40.0 + sin(wt * 2.0), cos(wt * 2.0), 11.0) * 1.3) * 0.35;
    // Surtout vers l'ext\xE9rieur : les parties gonflent et d\xE9gonflent sans jamais se creuser (une cheville ou un poignet
    // fin se pincerait jusqu'\xE0 dispara\xEEtre).
    transformed += normalize(objectNormal) * (wave * 0.6 + 0.4) * uWobble.x;
  #endif
  vObjPos = transformed;
  #ifdef TONE
    vTone = aTone;
  #endif
  #ifdef SHADE
    vShade = aShade;
  #endif
  #ifdef TOON_MAP
    vMapUv = uv;
  #endif

  mat4 toWorld = modelMatrix;
  #ifdef USE_INSTANCING
    toWorld = modelMatrix * instanceMatrix;
  #endif
  vec3 origin = toWorld[3].xyz;

  // Semis \xE0 port\xE9e limit\xE9e (vue \xE0 la 3e personne) : pr\xE8s de la limite, la copie rentre dans le sol au lieu de
  // dispara\xEEtre d'un coup ; \xE0 l'approche, elle en sort.
  float fade = 1.0;
  if (uFade.y > 0.0) {
    fade = 1.0 - smoothstep(uFade.x, uFade.y, distance(origin.xz, cameraPosition.xz));
    transformed *= fade;
  }

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

  #ifdef DEPTH_ONLY
    #include <project_vertex>
  #else
    // Monde courb\xE9 (setCurvature) : seul l'affichage descend ; la passe d'ombre reste sur le monde plat.
    vec4 bentWorld = vec4(vWorldPos, 1.0);
    float bendDistance = max(distance(bentWorld.xz, uCurve.xy) - uCurve.w, 0.0);
    bentWorld.y -= uCurve.z * bendDistance * bendDistance;
    vec4 mvPosition = viewMatrix * bentWorld;
    gl_Position = projectionMatrix * mvPosition;
  #endif

  #ifdef FOLIAGE
    float cornerScale = length(toWorld[0].xyz) * fade;
    #ifndef UNLIT
      if (uLod.y > 0.0) {
        float lod = smoothstep(uLod.x, uLod.y, distance(origin, cameraPosition));
        cornerScale *= mix(1.0, aFar * uLod.z, lod);
      }
    #endif
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
    // Passage \xE0 la version lointaine (uLod) : le bois qu'elle n'a pas s'efface par trame entre x et y m\xE8tres.
    vDrop = uLod.y > 0.0 ? (1.0 - aFar) * smoothstep(uLod.x, uLod.y, distance(origin, cameraPosition)) : 0.0;
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
uniform float uEmissive; // > 0 : seuil de lumi\xE8re (lit) au-dessus duquel la couleur garde son \xE9clat la nuit
uniform float uGlowReceive;
varying vec3 vWorldPos;
#ifdef SHADE
  varying float vShade;
#endif
#ifdef TONE
  varying float vTone;
#endif
uniform vec2 uRim; // x : lumi\xE8re ajout\xE9e sur le bord de la silhouette, y : largeur de la frange (0..1, en 1 - normale.z)

varying vec3 vNormal;
varying vec3 vObjPos;

#ifdef FOLIAGE
  varying vec3 vLeaf;
  uniform vec2 uLeafShade; // x : \xE9clat al\xE9atoire par feuille, y : assombrissement du c\u0153ur
#endif

#if defined(PATTERN_BARK) || defined(PATTERN_FURROW)
  varying float vRadius;
  varying float vDrop;
  varying vec2 vUv;
#endif

#ifdef PATTERN_GROUND
  varying vec2 vGround;
  uniform vec3 uLayerRamp[12]; // 3 couches \xD7 4 couleurs (ombre \u2192 lumi\xE8re)
  uniform vec4 uLayers[3];     // x : \xE9chelle des taches (1/m), y : seuil (0..1), z : graine, w : poids de la modulation lente (\xB1)
  uniform vec3 uFlowers[2];    // deux couleurs de fleurs sem\xE9es en pixels
  uniform vec4 uGround;        // x : lisse (0/1), y : densit\xE9 des fleurs, z : \xE9chelle de la modulation lente (1/m), w : frange tram\xE9e
#endif

#ifdef TOON_MAP
  uniform sampler2D uMap;
  varying vec2 vMapUv;
#endif

#ifdef CURRENTS
  uniform float uTime;
  uniform vec2 uCurrents; // x : force des courants (d\xE9rive des normales), y : fr\xE9quence (1/unit\xE9)
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

#ifdef CURRENTS
float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x);
  float b = mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x);
  float c = mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x);
  float d = mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x);
  return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
}
#endif

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
  #if defined(PATTERN_BARK) || defined(PATTERN_FURROW)
    // Effacement tram\xE9 (matrice de Bayer 4 \xD7 4, par pixel d'art) des branches absentes de la version lointaine.
    if (vDrop > 0.0) {
      const float bayer[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      ivec2 cell = ivec2(mod(gl_FragCoord.xy, 4.0));
      if (vDrop > (bayer[cell.x + cell.y * 4] + 0.5) / 16.0) discard;
    }
  #endif
  vec3 N = normalize(vNormal);
  #if defined(DOUBLE_SIDED) && !defined(FOLIAGE)
    if (!gl_FrontFacing) N = -N;
  #endif

  #if NUM_DIR_LIGHTS > 0
    vec3 L = directionalLights[0].direction;
  #else
    vec3 L = normalize(vec3(-0.45, 0.75, 0.5));
  #endif

  #ifdef CURRENTS
    // Courants de lumi\xE8re (mati\xE8res magiques) : un bruit qui d\xE9rive dans le temps fait glisser les normales, donc
    // les paliers de lumi\xE8re et le liser\xE9 ; la cadence du temps partag\xE9 (12 images/s) les fait avancer par \xE0-coups.
    vec3 cq = vObjPos * uCurrents.y + vec3(cos(uTime * 0.7), sin(uTime * 0.7), uTime * 0.25) * 1.4;
    vec3 drift = vec3(valueNoise3(cq), valueNoise3(cq + vec3(31.0, 0.0, 0.0)), valueNoise3(cq + vec3(0.0, 57.0, 0.0))) - 0.5;
    N = normalize(N + drift * uCurrents.x);
  #endif

  #ifdef UNLIT
    float lit = 1.0; // lumineux par lui-m\xEAme : la couleur ne d\xE9pend que de la g\xE9om\xE9trie (occlusion des formes)
    #ifdef SHADE
      lit = vShade; // ton port\xE9 par chaque sommet (surfaces d'\xE9nergie anim\xE9es : vortex d'un portail, cristaux)
    #endif
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

  #ifdef TONE
    lit += vTone;
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
  #ifdef TOON_MAP
    // Texture de couleur (personnages import\xE9s) : la rampe devient un filtre de lumi\xE8re, de l'ombre froide \xE0 la
    // pleine lumi\xE8re, pos\xE9 sur la couleur peinte.
    color *= texture2D(uMap, vMapUv).rgb;
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
  // Mati\xE8re qui \xE9met sa propre lumi\xE8re (vortex, cristaux allum\xE9s) : au-dessus du seuil, elle \xE9chappe \xE0 la teinte de
  // nuit comme ce qu'\xE9claire une lumi\xE8re de halo (palier 3).
  if (uEmissive > 0.0 && lit > uEmissive) glowLevel = 3.0;
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
    ground,
    map = null,
    currents = null,
    wobble = null,
    shade = false,
    tone = false,
    emissive = 0
  } = options;
  if (ramp.length < 2 || ramp.length > 6) throw new Error("ramp : 2 \xE0 6 couleurs");
  if (steps.length !== ramp.length - 1) throw new Error("steps : ramp.length - 1 valeurs");
  const patternInfo = PATTERNS[pattern];
  const defines = { RAMP_SIZE: ramp.length };
  if (foliage) defines.FOLIAGE = "";
  if (patternInfo.define) defines[patternInfo.define] = "";
  if (unlit) defines.UNLIT = "";
  if (shade) defines.SHADE = "";
  if (tone) defines.TONE = "";
  if (map) defines.TOON_MAP = "";
  if (currents) defines.CURRENTS = "";
  if (wobble) defines.WOBBLE = "";
  const wobbleUniform = { value: new THREE.Vector3(...wobble ?? [0, 1, 1]) };
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
      uFade: { value: new THREE.Vector2(0, 0) },
      uLod: { value: new THREE.Vector3(0, 0, 1) },
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
      uEmissive: { value: emissive },
      uLeafShade: { value: new THREE.Vector2(...leafShade) },
      uMap: { value: map },
      uWobble: wobbleUniform,
      uCurrents: { value: new THREE.Vector2(...currents ?? [0, 1]) },
      ...groundUniforms
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT
  });
  if (wobble && !foliage) {
    material.userData.depthMaterial = new THREE.ShaderMaterial({
      name: "ToonWobbleDepth",
      defines: { WOBBLE: "", DEPTH_ONLY: "" },
      side,
      uniforms: { ...sharedUniforms, uSway: swayUniform, uTwinkle: twinkleUniform, uWobble: wobbleUniform },
      vertexShader: VERTEX,
      fragmentShader: DEPTH_FRAGMENT
    });
  }
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

// src/assets/kit/geometry.js
import * as THREE2 from "three";
var _tangent = new THREE2.Vector3();
var _normal = new THREE2.Vector3();
var _binormal = new THREE2.Vector3();
var _previousTangent = new THREE2.Vector3();
var _axis = new THREE2.Vector3();
var _point = new THREE2.Vector3();
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

// src/assets/kit/model.js
import * as THREE3 from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
var source = { base: null, read: null };
var gltfCache = /* @__PURE__ */ new Map();
var textureCache = /* @__PURE__ */ new Map();
var loader = null;
var hasDom = () => typeof document !== "undefined";
function embedded(path) {
  if (!hasDom()) return null;
  for (const script of document.querySelectorAll("script[data-pv3d-model]")) {
    if (script.dataset.pv3dModel === path) return script.textContent.trim();
  }
  return null;
}
function urlOf(path) {
  const base = source.base ?? (hasDom() ? new URL("models/", document.baseURI).href : "models/");
  return hasDom() ? new URL(path, new URL(base, document.baseURI)).href : base + path;
}
async function readBytes(path) {
  const inline = embedded(path);
  if (inline) {
    const binary = atob(inline);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  if (source.read) {
    const data = await source.read(path);
    return data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  const response = await fetch(urlOf(path));
  if (!response.ok) throw new Error(`mod\xE8le introuvable : ${path} (${response.status})`);
  return response.arrayBuffer();
}
function loadGltf(path) {
  if (!gltfCache.has(path)) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const promise = readBytes(path).then((data) => loader.parseAsync(data, ""));
    promise.catch(() => gltfCache.delete(path));
    gltfCache.set(path, promise);
  }
  return gltfCache.get(path);
}
function loadModelTexture(path) {
  if (!hasDom()) return Promise.resolve(null);
  if (!textureCache.has(path)) {
    const inline = embedded(path);
    const url = inline ? `data:image/png;base64,${inline}` : urlOf(path);
    const promise = new THREE3.TextureLoader().loadAsync(url).then((texture) => {
      texture.colorSpace = THREE3.NoColorSpace;
      texture.flipY = false;
      texture.magFilter = THREE3.NearestFilter;
      texture.minFilter = THREE3.NearestMipmapNearestFilter;
      texture.name = path;
      return texture;
    });
    promise.catch(() => textureCache.delete(path));
    textureCache.set(path, promise);
  }
  return textureCache.get(path);
}

// src/assets/kit/humanoid.js
var ANIMATION_LIBRARY = "animations/ual-standard.glb";
var SKIN_LIGHT = ["#6d6aa6", "#b2a8cc", "#e9e1ea", "#ffffff"];
var SKIN_STEPS = [0.3, 0.52, 0.76];
var CHARACTER_ID = 44;
var CHARACTERS = {
  "superhero-female": {
    label: "H\xE9ro\xEFne",
    labelEn: "Heroine",
    file: "characters/superhero-female.glb",
    height: 1.77,
    parts: {
      body: { texture: "characters/superhero-female.png", ramp: SKIN_LIGHT, steps: SKIN_STEPS },
      eyes: { texture: "characters/eye-brown.png", ramp: ["#c9c2dc", "#ffffff"], steps: [0.35] },
      brows: { ramp: ["#22161e", "#3a2420", "#523528"], steps: [0.4, 0.7] }
    }
  },
  "superhero-male": {
    label: "H\xE9ros",
    labelEn: "Hero",
    file: "characters/superhero-male.glb",
    height: 1.81,
    parts: {
      body: { texture: "characters/superhero-male.png", ramp: SKIN_LIGHT, steps: SKIN_STEPS },
      eyes: { texture: "characters/eye-brown.png", ramp: ["#c9c2dc", "#ffffff"], steps: [0.35] },
      brows: { ramp: ["#22161e", "#3a2420", "#523528"], steps: [0.4, 0.7] }
    }
  },
  mannequin: {
    label: "Mannequin",
    labelEn: "Mannequin",
    file: "characters/mannequin.glb",
    height: 1.8,
    parts: {
      M_Main: { ramp: ["#6b3546", "#b0573f", "#de8e3c", "#f2c262"], steps: SKIN_STEPS },
      M_Joints: { ramp: ["#2f2559", "#5a3a8e", "#8a58c4", "#b585e4"], steps: SKIN_STEPS }
    }
  },
  // La version humaine du blob : le corps du mannequin dans la matière de lumière de la Couveuse. Ses matières
  // dépendent de la palette choisie (`magicParts`) ; son corps ondule, il éclaire le décor, des étincelles tournent autour de lui.
  "magic-mannequin": {
    label: "Mannequin magique",
    labelEn: "Magic mannequin",
    file: "characters/mannequin.glb",
    height: 1.8,
    magic: true,
    parts: null
  }
};
var MAGIC_LOOK = { palette: "ice", wobble: 0.045, detail: 1, currents: 1, glow: 3, glowStrength: 1.4, sparks: 3, motes: 14 };
var WHITE = "#ffffff";
function magicParts(look) {
  const C = fitRamp((MAGIC_PALETTES[look.palette] ?? MAGIC_PALETTES.ice).colors, 8);
  const currents = look.currents > 0 ? [0.32 * look.currents, 3.2] : null;
  const wobble = look.wobble > 0 ? [look.wobble, 4 * look.detail, 1.5] : null;
  const light = { rim: [0.3, 0.5], outline: false, shadowLit: 0.55, glow: false, currents, wobble };
  return {
    colors: C,
    M_Main: { ramp: [C[2], C[3], C[4], C[5], C[6], WHITE], steps: [0.2, 0.45, 0.75, 0.96, 1.1], ...light },
    M_Joints: { ramp: [C[4], C[5], C[6], WHITE], steps: [0.25, 0.55, 0.85], ...light }
  };
}
function characterParam(description, defaultValue = "superhero-female") {
  return choiceParam("Personnage", Object.fromEntries(Object.entries(CHARACTERS).map(([id, c]) => [id, c.label])), description, defaultValue);
}
function cadenceParam() {
  return choiceParam(
    "Cadence",
    { sprite: "12 images/s", smooth: "Fluide" },
    "\xAB 12 images/s \xBB : la pose change par \xE0-coups, comme un sprite dessin\xE9 ; \xAB Fluide \xBB : \xE0 chaque image."
  );
}
function speedParam() {
  return numberParam("Vitesse", 1, 0.25, 2, "Vitesse de lecture de l'animation.", { step: 0.05, unit: "\xD7" });
}
function partStyle(parts, mesh) {
  return parts[mesh.material?.name] ?? parts[mesh.name] ?? parts[mesh.parent?.name] ?? Object.values(parts)[0];
}
async function loadCharacter(character) {
  const spec = CHARACTERS[character];
  const gltf = await loadGltf(spec.file);
  const textures = {};
  await Promise.all(
    Object.values(spec.parts ?? {}).filter((part) => part.texture).map(async (part) => textures[part.texture] = await loadModelTexture(part.texture))
  );
  return { gltf, textures };
}
function pelvisHeight(scene) {
  const pelvis = scene.getObjectByName("pelvis");
  return pelvis ? pelvis.position.length() : 1;
}
var clipCache = /* @__PURE__ */ new Map();
async function clipFor(name, character, inPlace) {
  const key = `${name}|${character}|${inPlace}`;
  if (!clipCache.has(key)) {
    clipCache.set(
      key,
      (async () => {
        const [library, body] = await Promise.all([loadGltf(ANIMATION_LIBRARY), loadGltf(CHARACTERS[character].file)]);
        const source2 = library.animations.find((clip2) => clip2.name === name);
        if (!source2) throw new Error(`animation inconnue : ${name}`);
        const ratio = pelvisHeight(body.scene) / pelvisHeight(library.scene);
        const clip = source2.clone();
        for (const track of clip.tracks) {
          if (!track.name.endsWith(".position")) continue;
          const values = track.values;
          for (let i = 0; i < values.length; i++) values[i] *= ratio;
          if (inPlace && track.name.startsWith("root.")) {
            for (let i = 0; i < values.length; i += 3) {
              values[i] = 0;
              values[i + 2] = 0;
            }
          }
        }
        return clip;
      })()
    );
  }
  return clipCache.get(key);
}
function buildBody(parts, { gltf, textures }) {
  const body = cloneSkinned(gltf.scene);
  body.traverse((child) => {
    if (!child.isMesh) return;
    const style = partStyle(parts, child);
    child.material = createToonMaterial({
      ramp: style.ramp,
      steps: style.steps,
      map: style.texture ? textures[style.texture] ?? null : null,
      id: CHARACTER_ID,
      shadowLit: style.shadowLit ?? 0.4,
      rim: style.rim,
      outline: style.outline,
      glow: style.glow,
      currents: style.currents,
      wobble: style.wobble
    });
    if (child.material.userData.depthMaterial) child.customDepthMaterial = child.material.userData.depthMaterial;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
  });
  return body;
}
function createHumanoid({ id, params, character = "superhero-female", steps = [{ clip: "Idle_Loop" }], inPlace = true, speed = 1, cadence = "sprite", offset = 0, look = {}, seed = 0 }) {
  if (!(character in CHARACTERS)) character = "superhero-female";
  const group = new THREE4.Group();
  group.name = id;
  group.userData.asset = { id, params };
  let mixer = null;
  let actions = [];
  let index = 0;
  let holding = 0;
  let pending = 0;
  const fps = cadence === "smooth" ? 0 : 12;
  const fade = fps ? 0 : 0.12;
  const play = (next) => {
    const previous = actions[index];
    index = next;
    const action = actions[index];
    action.reset();
    action.play();
    if (previous && previous !== action && fade > 0) previous.crossFadeTo(action, fade, false);
    else if (previous && previous !== action) previous.stop();
  };
  const advance = (seconds) => {
    if (!mixer) return;
    if (holding > 0) {
      holding -= seconds;
      if (holding <= 0) play((index + 1) % actions.length);
      return;
    }
    mixer.update(seconds);
  };
  group.userData.update = (delta) => {
    const seconds = delta * speed;
    if (!fps) return advance(seconds);
    pending += seconds;
    const frames = Math.floor(pending * fps);
    if (frames > 0) {
      pending -= frames / fps;
      advance(frames / fps);
    }
  };
  group.userData.ready = (async () => {
    const [loaded, clips] = await Promise.all([loadCharacter(character), Promise.all(steps.map((step) => clipFor(step.clip, character, inPlace)))]);
    const spec = CHARACTERS[character];
    const magic = spec.magic ? magicParts({ ...MAGIC_LOOK, ...look }) : null;
    const body = buildBody(magic ?? spec.parts, loaded);
    group.add(body);
    if (magic) addMagic(group, body, { ...MAGIC_LOOK, ...look }, magic.colors, seed);
    mixer = new THREE4.AnimationMixer(body);
    const single = steps.length === 1 && !steps[0].hold;
    actions = steps.map((step, i) => {
      const action = mixer.clipAction(clips[i]);
      if (single) action.setLoop(THREE4.LoopRepeat, Infinity);
      else {
        action.setLoop(THREE4.LoopRepeat, step.repeat ?? 1);
        action.clampWhenFinished = true;
      }
      return action;
    });
    mixer.addEventListener("finished", () => {
      const step = steps[index];
      if (step.hold) holding = step.hold;
      else play((index + 1) % actions.length);
    });
    play(0);
    mixer.update(THREE4.MathUtils.clamp(offset, 0, 0.999) * clips[0].duration);
    group.userData.mixer = mixer;
    return group;
  })();
  group.userData.ready.catch((error) => console.error(`${id} : ${error.message}`));
  return group;
}
function addMagic(group, body, look, C, seed) {
  body.updateMatrixWorld(true);
  const meshes = [];
  body.traverse((child) => child.isSkinnedMesh && meshes.push(child));
  const chest = body.getObjectByName("spine_03") ?? body;
  const rng = createRng(Number(seed) * 15485863 + 5);
  const ORIGIN = new THREE4.Vector3();
  const UP = new THREE4.Vector3(0, 1, 0);
  const fans = [];
  const shapes = [];
  const add = (owner, outline, size, stretch, occlusion, lift, offset) => {
    const first2 = fans.reduce((n, f) => n + f.outline.length + 1, 0);
    fans.push({ position: ORIGIN, outline, size, stretch, normal: UP, phase: 0, variation: 0.5, flex: 0, occlusion, lift, offset });
    shapes.push({ owner, first: first2, count: outline.length + 1 });
  };
  const occ = { mid: 0.1, light: 0.4, white: 0.9 };
  for (let i = 0; i < look.sparks; i++) {
    const spark = {
      kind: "spark",
      angle: i / look.sparks * Math.PI * 2 + rng.range(-0.4, 0.4),
      radius: rng.range(0.38, 0.5),
      height: rng.range(-0.35, 0.25),
      speed: rng.range(0.6, 1) * (rng.chance(0.5) ? 1 : -1),
      bob: rng.range(0, 6.3)
    };
    add(spark, starOutline(4), 0.05, [1, 1], occ.light, 0);
    add(spark, starOutline(4), 0.032, [1, 1], occ.white, 0.01);
  }
  for (let i = 0; i < look.motes; i++) {
    const mote = {
      kind: "mote",
      born: rng.next() * 4,
      life: rng.range(1.5, 3),
      angle: rng.range(0, Math.PI * 2),
      radius: rng.range(0.3, 0.6),
      height: rng.range(0.1, 1.2),
      rise: rng.range(0.15, 0.35),
      wobble: rng.range(1, 2)
    };
    add(mote, starOutline(4), 0.035, [1, 1], i % 4 === 0 ? occ.white : i % 2 ? occ.light : occ.mid, 0);
  }
  let fx = null;
  if (fans.length) {
    fx = new THREE4.Mesh(
      buildFanGeometry(fans),
      createToonMaterial({ ramp: [C[5], C[6], WHITE], steps: [0.25, 0.6], foliage: true, unlit: true, leafShade: [0, 1], outline: false, glow: false, id: 42 })
    );
    fx.name = "magic";
    fx.frustumCulled = false;
    group.add(fx);
  }
  const position = fx?.geometry.attributes.position;
  const corner = fx?.geometry.attributes.aCorner;
  const cornerBase = corner ? Float32Array.from(corner.array) : null;
  const light = look.glow > 0 ? createGlowLight() : null;
  const lightColor = rgb(C[5]);
  const chestWorld = new THREE4.Vector3();
  const chestLocal = new THREE4.Vector3();
  function place(shape, x, y, z, scale) {
    const a = position.array, c = corner.array;
    for (let k = 0; k < shape.count; k++) {
      const i = (shape.first + k) * 3;
      a[i] = x;
      a[i + 1] = y;
      a[i + 2] = z;
      c[i] = cornerBase[i] * scale;
      c[i + 1] = cornerBase[i + 1] * scale;
    }
  }
  function update() {
    const t = sharedUniforms.uTime.value;
    chest.getWorldPosition(chestWorld);
    group.worldToLocal(chestLocal.copy(chestWorld));
    for (const shape of shapes) {
      const q = shape.owner;
      if (q.kind === "spark") {
        const angle = q.angle + t * q.speed * 1.6;
        place(shape, chestLocal.x + Math.cos(angle) * q.radius, chestLocal.y + q.height + Math.sin(t * 2.1 + q.bob) * 0.06, chestLocal.z + Math.sin(angle) * q.radius, 1);
      } else if (q.kind === "mote") {
        const age = ((t - q.born) % 4 + 4) % 4;
        const wob = Math.sin(age * q.wobble * 2) * 0.05;
        if (age >= q.life) place(shape, chestLocal.x, chestLocal.y, chestLocal.z, 0);
        else place(shape, chestLocal.x + Math.cos(q.angle) * q.radius + wob, q.height + age * q.rise, chestLocal.z + Math.sin(q.angle) * q.radius - wob, 1);
      }
    }
    position.needsUpdate = true;
    corner.needsUpdate = true;
  }
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    baseUpdate(force);
    if (fx) update();
    if (light) light.set(chestWorld.setFromMatrixPosition(chest.matrixWorld), lightColor, look.glow, look.glowStrength);
  };
  const release = [];
  if (light) release.push(() => light.release());
  if (fx) release.push(() => fx.geometry.dispose());
  const first = meshes[0]?.material;
  if (first) first.addEventListener("dispose", () => release.forEach((fn) => fn()));
}
function disposeHumanoid(group) {
  group.userData.mixer?.stopAllAction();
  group.traverse((child) => {
    if (!child.isMesh) return;
    child.material.userData.depthMaterial?.dispose();
    child.material.dispose();
  });
}

// src/assets/kit/animation-asset.js
var GOLDEN = 0.6180339887;
var ADDED = "2026-11-17";
var offsetOf = (seed) => ((Number(seed) || 0) * GOLDEN % 1 + 1) % 1;
var tallest = Math.max(...Object.values(CHARACTERS).map((c) => c.height));
function animationAsset({ id, name, nameEn, description, tags, biomes, phases, moves = false, radius = 0.7, height, pedestal = true, version = 1 }) {
  const [category, subcategory] = id.split("/");
  const params = {
    seed: seedParam("Moment du cycle o\xF9 l'animation commence : plusieurs personnages ne bougent pas en m\xEAme temps."),
    character: characterParam("Le personnage qui joue le mouvement. Tous partagent le m\xEAme squelette.")
  };
  const phaseIds = Object.keys(phases);
  if (phaseIds.length > 1) {
    params.phase = choiceParam(
      "Temps",
      Object.fromEntries(phaseIds.map((phase) => [phase, phases[phase].label])),
      "Le mouvement complet, encha\xEEn\xE9, ou l'un de ses temps jou\xE9 seul."
    );
  }
  if (moves) {
    params.path = choiceParam(
      "Trajet",
      { inPlace: "Sur place", forward: "Avance" },
      "\xAB Sur place \xBB : le personnage reste au centre, comme sur un tapis roulant ; \xAB Avance \xBB : il se d\xE9place et revient au d\xE9part \xE0 chaque boucle."
    );
  }
  params.speed = speedParam();
  params.cadence = cadenceParam();
  const clips = [...new Set(Object.values(phases).flatMap((phase) => phase.steps.map((step) => step.clip)))];
  const meta2 = {
    id,
    name,
    nameEn,
    category,
    subcategory,
    description,
    tags,
    biomes,
    version,
    added: ADDED,
    imported: true,
    units: "m\xE8tres ; personnages de 1,77 \xE0 1,81 m, origine entre les pieds, regard vers +Z",
    footprint: { radius, height: height ?? Math.ceil(tallest * 10) / 10 },
    animated: ["skeleton"],
    ...pedestal ? {} : { pedestal: false },
    clips,
    files: [.../* @__PURE__ */ new Set(["animations/ual-standard.glb", ...Object.values(CHARACTERS).map((c) => c.file)])],
    params,
    variants: variantsOf("character", params.character)
  };
  function create2(options = {}) {
    const p = Object.fromEntries(Object.entries(params).map(([key, spec]) => [key, options[key] ?? spec.default]));
    const phase = phases[p.phase] ?? phases[phaseIds[0]];
    return createHumanoid({
      id,
      params: p,
      character: p.character,
      steps: phase.steps,
      inPlace: p.path !== "forward",
      speed: Number(p.speed),
      cadence: p.cadence,
      offset: offsetOf(p.seed),
      seed: p.seed
    });
  }
  return { meta: meta2, create: create2, dispose: disposeHumanoid };
}

// src/assets/animations/locomotion/swim.js
var { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/swim",
  name: "Nager",
  nameEn: "Swim",
  description: "Brasse \xE0 la surface de l'eau, le corps \xE0 l'horizontale (l'origine est la surface de l'eau : le corps flotte juste dessous).",
  tags: ["nager", "nage", "brasse", "eau", "swim", "swimming", "water", "locomotion", "animation", "personnage", "character"],
  biomes: ["beach", "swamp"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Swim_Fwd_Loop" }] }
  },
  moves: true,
  radius: 1.2,
  height: 0.4,
  pedestal: false
});
export {
  create,
  dispose,
  meta,
  setWind,
  tick
};
