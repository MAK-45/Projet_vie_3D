// Projet Vie 3D — Couveuse (blob) (creatures/spirits/couveuse-blob), version 2
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/creatures/spirits/couveuse-blob.js
import * as THREE3 from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

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
  varying float vRadius;
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
function buildSpriteGeometry(sprites) {
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
var SPRITE_NORMAL = new THREE2.Vector3(0, 1, 0);
function ellipseOutline(sides, rx = 1, ry = rx) {
  const outline = [];
  for (let i = 0; i < sides; i++) {
    const angle = i / sides * Math.PI * 2;
    outline.push([Math.cos(angle) * rx, Math.sin(angle) * ry]);
  }
  return outline;
}
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

// src/assets/creatures/spirits/couveuse-blob.js
var BLOB_PALETTES = MAGIC_PALETTES;
var EYE_COLOR = "#0a1430";
var PUPIL_COLOR = "#081026";
var WHITE = "#ffffff";
var DURATION = 4;
var TAU = Math.PI * 2;
var UP_HALF = new THREE3.Vector3(0, 0.5, 0);
function fit(colors, n) {
  if (colors.length === n) return colors.slice();
  return Array.from({ length: n }, (_, i) => colors[Math.round(i * (colors.length - 1) / Math.max(1, n - 1))]);
}
var params = {
  seed: seedParam("Change les vagues du corps et leur rythme, sa d\xE9rive, quand il cligne des yeux, o\xF9 il regarde, ses gouttes et ses poussi\xE8res."),
  palette: choiceParam("Couleurs", BLOB_PALETTES, "Les palettes du blob : Glace (sa couleur de naissance), Arcane, Braise, S\xE8ve, Aurore, N\xE9on, Abysse, Lagon, Sang."),
  size: numberParam("Taille", 0.9, 0.4, 1.4, "Hauteur du corps (son diam\xE8tre au repos).", { step: 0.05, unit: "m" }),
  altitude: numberParam("Vol", 1, 0.5, 1.6, "Hauteur du centre du corps au-dessus du sol.", { step: 0.05, unit: "m" }),
  wobble: numberParam("Ondulation", 0.3, 0, 0.8, "Amplitude des vagues qui d\xE9forment le corps.", { step: 0.02 }),
  detail: numberParam("Finesse des vagues", 0.85, 0.3, 2.5, "Peu de grands lobes (bas) ou beaucoup de petites vagues (haut).", { step: 0.05 }),
  chaos: numberParam("Instabilit\xE9", 0.7, 0, 2, "Combien la forme change au fil de la boucle : 0, elle ondule \xE0 peine.", { step: 0.05 }),
  drip: numberParam("Goutte", 0.18, 0, 0.6, "Dessous plus lourd, en goutte qui flotte.", { step: 0.02 }),
  width: numberParam("Largeur", 1, 0.7, 1.4, "Corps plus \xE9troit (bas) ou plus large (haut).", { step: 0.02 }),
  stretch: numberParam("\xC9tirement", 0.6, 0, 1.5, "S'\xE9tire en montant, s'\xE9crase en haut et en bas de sa course.", { step: 0.05 }),
  hover: numberParam("Flottement", 0.11, 0, 0.3, "Amplitude de la mont\xE9e et descente.", { step: 0.01, unit: "m" }),
  wander: numberParam("D\xE9rive", 0.1, 0, 0.3, "Il erre un peu autour de sa place.", { step: 0.01, unit: "m" }),
  glow: numberParam("Lumi\xE8re", 3, 0, 6, "Port\xE9e de la lumi\xE8re qu'il r\xE9pand dans le noir, dans la couleur de son corps (0 : aucune).", { step: 0.25, unit: "m" }),
  glowStrength: numberParam("\xC9clat", 1.4, 0.3, 2.5, "Force de cette lumi\xE8re : plus haut, le cercle le plus clair s'\xE9largit.", { step: 0.05 }),
  currents: numberParam("Courants", 1, 0, 2, "Courants de lumi\xE8re qui passent dans le corps.", { step: 0.05 }),
  eyes: { type: "int", default: 2, min: 0, max: 3, label: "Yeux", description: "Nombre d'yeux : 0 \xE0 3." },
  eyeShape: choiceParam("Forme des yeux", { round: "Ronds", almond: "En amande", happy: "Heureux" }, "Ronds, en amande, ou pliss\xE9s de bonheur (arcs)."),
  eyeStyle: choiceParam("Style des yeux", { dark: "Sombres", bright: "Lumineux", pupil: "\xC0 pupille" }, "Sombres avec un reflet, lumineux (blancs cern\xE9s) ou blancs \xE0 pupille qui regarde."),
  eyeSize: numberParam("Taille des yeux", 0.23, 0.08, 0.4, "Rayon d'un \u0153il, en part du rayon du corps.", { step: 0.01 }),
  eyeSpacing: numberParam("\xC9cart des yeux", 0.52, 0.15, 0.8, "\xC9cart entre les yeux, en part du rayon.", { step: 0.01 }),
  eyeHeight: numberParam("Hauteur des yeux", 0.22, -0.2, 0.55, "Hauteur des yeux sur le visage, en part du rayon.", { step: 0.01 }),
  eyeTall: numberParam("Yeux \xE9tir\xE9s", 1.35, 0.6, 2, "Hauteur des yeux en amande par rapport \xE0 leur largeur.", { step: 0.05 }),
  blinks: { type: "int", default: 2, min: 0, max: 6, label: "Clignements", description: "Clignements par boucle de 4 s (parfois doubl\xE9s)." },
  look: numberParam("Regard", 1, 0, 2, "Combien il regarde autour de lui.", { step: 0.05 }),
  sparks: { type: "int", default: 3, min: 0, max: 8, label: "\xC9tincelles", description: "\xC9tincelles qui tournent autour de lui." },
  drips: { type: "int", default: 6, min: 0, max: 12, label: "Gouttes", description: "Gouttes de lumi\xE8re qui tombent de son dessous." },
  turn: numberParam("Orientation", 45, -180, 180, "Tourne le blob sur lui-m\xEAme : 0, il regarde vers +Z ; 45, vers la cam\xE9ra de l'Atelier.", { step: 5, unit: "\xB0" }),
  motes: { type: "int", default: 18, min: 0, max: 30, label: "Poussi\xE8res", description: "Poussi\xE8res de lumi\xE8re qui montent autour de lui." }
};
var meta = {
  id: "creatures/spirits/couveuse-blob",
  name: "Couveuse (blob)",
  nameEn: "Couveuse blob",
  category: "creatures",
  subcategory: "spirits",
  description: "La Couveuse \xE0 sa naissance : un blob de lumi\xE8re de glace qui flotte, ondule, respire, s'\xE9tire et s'\xE9crase, cligne des yeux et regarde autour, entour\xE9 d'\xE9tincelles, de gouttes et de poussi\xE8res de lumi\xE8re. Neuf palettes ; la graine change ses vagues, sa d\xE9rive et son regard ; ondulation et yeux se r\xE8glent.",
  tags: [
    "couveuse",
    "blob",
    "esprit",
    "cr\xE9ature",
    "lumi\xE8re",
    "glace",
    "gel\xE9e",
    "yeux",
    "clignement",
    "flottant",
    "magie",
    "\xE9tincelles",
    "anim\xE9",
    "ext\xE9rieur",
    "int\xE9rieur",
    "spirit",
    "creature",
    "light",
    "ice",
    "jelly",
    "eyes",
    "blinking",
    "floating",
    "magic",
    "sparks",
    "animated",
    "procedural"
  ],
  biomes: ["forest", "meadow", "garden", "village", "snow", "swamp", "mountain", "cave", "interior"],
  version: 2,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au sol sous le blob, qui regarde vers +Z (environ 1,6 m de haut, \xE9tincelles comprises)",
  footprint: { radius: 1.2, height: 1.6 },
  animated: ["idle", "glow"],
  params,
  variants: variantsOf("palette", params.palette)
};
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const C = fit(BLOB_PALETTES[p.palette].colors, 8);
  const S = p.size / 2;
  const center = Math.max(p.altitude, S * (1.25 + p.drip) + p.hover + 0.05);
  const seed = p.seed;
  const shapeRng = createRng(seed * 7919 + 17);
  const blinkRng = createRng(seed * 104729 + 71);
  const fxRng = createRng(seed * 15485863 + 5);
  const noiseA = createNoise3(seed * 31 + 9);
  const noiseB = createNoise3(seed * 31 + 19);
  const noiseC = createNoise3(seed * 31 + 23);
  const wanderNoise = createNoise3(seed * 31 + 1);
  const lookNoise = createNoise3(seed * 31 + 51);
  const swayPhase = shapeRng.range(0, TAU);
  const swayPhaseZ = shapeRng.range(0, TAU);
  const shapeOffset = [shapeRng.range(0, 50), shapeRng.range(0, 50), shapeRng.range(0, 50)];
  const loop = (noise, x, y, u, r) => noise(x + Math.cos(TAU * u) * r, y + Math.sin(TAU * u) * r, 7.3) * 2 - 1;
  function radiusAt(dx, dy, dz, u) {
    const c = Math.cos(TAU * u) * p.chaos, s = Math.sin(TAU * u) * p.chaos;
    const c2 = Math.cos(TAU * u * 2) * p.chaos * 0.6, s2 = Math.sin(TAU * u * 2) * p.chaos * 0.6;
    const k = p.detail;
    const n = noiseA(dx * k + c + shapeOffset[0], dy * k + s + shapeOffset[1], dz * k + shapeOffset[2]) * 2 - 1;
    const n2 = noiseB(dx * k * 2.3 + 40 + c2, dy * k * 2.3 + s2, dz * k * 2.3 + 11) * 2 - 1;
    let r = 1 + p.wobble * (n * 0.9 + n2 * 0.35);
    r += p.drip * Math.max(0, -dy) ** 3;
    r *= 1 + (p.width - 1) * (dx * dx + dz * dz);
    return Math.max(0.2, r) * S;
  }
  function posAt(u, out) {
    const sway = S * 0.125;
    out.x = Math.sin(TAU * u + swayPhase) * sway + loop(wanderNoise, 3.1, 7.7, u, 0.6) * 1.2 * p.wander;
    out.z = Math.sin(TAU * u + swayPhaseZ) * sway * 0.7 + loop(wanderNoise, 12.6, 4.4, u, 0.6) * 1.2 * p.wander;
    out.y = center + Math.sin(TAU * u * 2) * p.hover + loop(wanderNoise, 9.4, 1.3, u, 0.6) * 0.4 * p.wander;
    return out;
  }
  const a = new THREE3.Vector3(), b = new THREE3.Vector3();
  function state(t, out) {
    const u = (t / DURATION % 1 + 1) % 1, e = 4e-3;
    posAt(u, out.position);
    posAt(u - e, a);
    posAt(u + e, b);
    const dt = 2 * e * DURATION;
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, vz = (b.z - a.z) / dt;
    const sv = THREE3.MathUtils.clamp(vy / (S * 1.67), -1, 1) * p.stretch;
    const st = 1 + Math.abs(sv) * 0.12 - 0.04 * p.stretch * Math.cos(TAU * u * 4);
    const breath = 1 + 0.03 * Math.sin(TAU * u * 2);
    out.u = u;
    out.vx = vx;
    out.vy = vy;
    out.scale.set(breath / Math.sqrt(st), st * breath, breath / Math.sqrt(st));
    out.rotation.set(THREE3.MathUtils.clamp(vz / (S * 2.5), -0.4, 0.4) * 0.5, 0, THREE3.MathUtils.clamp(-vx / (S * 2.5), -0.4, 0.4) * 0.5);
    return out;
  }
  const newState = () => ({ position: new THREE3.Vector3(), scale: new THREE3.Vector3(), rotation: new THREE3.Euler(), u: 0, vx: 0, vy: 0 });
  let sphere = new THREE3.SphereGeometry(1, 30, 20);
  sphere.deleteAttribute("uv");
  sphere.deleteAttribute("normal");
  const bodyGeometry = mergeVertices(sphere);
  sphere.dispose();
  const directions = Float32Array.from(bodyGeometry.attributes.position.array);
  bodyGeometry.setAttribute("normal", new THREE3.BufferAttribute(new Float32Array(directions.length), 3));
  bodyGeometry.boundingSphere = new THREE3.Sphere(new THREE3.Vector3(), S * 2);
  const group = new THREE3.Group();
  group.name = meta.name;
  const facing = new THREE3.Group();
  facing.rotation.y = THREE3.MathUtils.degToRad(p.turn);
  group.add(facing);
  const pivot = new THREE3.Group();
  pivot.name = "pivot";
  facing.add(pivot);
  const body = new THREE3.Mesh(
    bodyGeometry,
    createToonMaterial({
      // Comme le blob 2D : le corps prend les couleurs 2 à 7 de la palette, la 7e est le blanc du reflet.
      ramp: [C[2], C[3], C[4], C[5], C[6], WHITE],
      steps: [0.2, 0.45, 0.75, 0.96, 1.1],
      rim: [0.3, 0.5],
      // le bord de la silhouette brille, même côté ombre
      outline: false,
      // pas de contour sombre : la lumière fait le bord, comme dans l'original
      shadowLit: 0.55,
      // il brille : son ombre propre reste claire
      glow: false,
      // c'est lui qui éclaire
      id: 40
    })
  );
  body.name = "body";
  body.castShadow = true;
  pivot.add(body);
  const eyeCount = p.eyes;
  const R = p.eyeSize * S;
  const rx = R * (p.eyeShape === "almond" ? 1.25 : 1);
  const ry = R * (p.eyeShape === "round" ? 1 : p.eyeTall) * (p.eyeShape === "almond" ? 0.75 : 1);
  const occ = { eye: 0.1, rim: 0.3, pupil: 0.5, soft: 0.7, white: 0.9 };
  const eyeFans = [];
  const eyeSprites = [];
  const ORIGIN = new THREE3.Vector3();
  const UP = new THREE3.Vector3(0, 1, 0);
  const fan = (outline, size, stretch, occlusion, lift, offset) => ({
    position: ORIGIN,
    outline,
    size,
    stretch,
    normal: UP,
    phase: 0,
    variation: 0.5,
    flex: 0,
    occlusion,
    lift,
    offset
  });
  const eyeOutline = p.eyeShape === "almond" ? almondOutline(16) : ellipseOutline(16);
  const eyeKinds = [];
  for (let i = 0; i < eyeCount; i++) {
    const start = eyeFans.length + eyeSprites.length;
    const kinds = [];
    if (p.eyeShape === "happy") {
      eyeSprites.push(arcSprite(rx, ry * 0.6, Math.max(0.065, R * 0.4), p.eyeStyle === "bright" ? occ.rim : occ.eye));
      kinds.push(0);
    } else if (p.eyeStyle === "bright") {
      eyeFans.push(fan(eyeOutline, 1, [rx, ry], occ.rim, 0));
      eyeFans.push(fan(eyeOutline, 1, [Math.max(0.03, rx - 0.065), Math.max(0.03, ry - 0.065)], occ.white, 0.01));
      kinds.push(0, 0);
    } else {
      if (p.eyeStyle === "pupil") {
        eyeFans.push(fan(eyeOutline, 1, [rx, ry], occ.white, 0));
        eyeFans.push(fan(ellipseOutline(12), R * 0.58, [1, 1], occ.eye, 0.01));
        kinds.push(0, 1);
      } else {
        eyeFans.push(fan(eyeOutline, 1, [rx, ry], occ.eye, 0));
        kinds.push(0);
      }
      const glint = Math.max(0.045, R * 0.3);
      eyeFans.push(fan(starOutline(4), glint, [1, 1], occ.white, 0.02, [-rx * 0.35, ry * 0.4]));
      kinds.push(p.eyeStyle === "pupil" ? 1 : 0);
      if (R >= 0.06) {
        eyeFans.push(fan(starOutline(4), glint * 0.7, [1, 1], occ.soft, 0.02, [rx * 0.35, -ry * 0.35]));
        kinds.push(p.eyeStyle === "pupil" ? 1 : 0);
      }
    }
    eyeKinds.push({ start, kinds });
  }
  const highlightStart = eyeFans.length;
  eyeFans.push(fan(ellipseOutline(12), S * 0.2, [1, 0.8], occ.soft, 5e-3));
  eyeFans.push(fan(ellipseOutline(10), S * 0.13, [1, 0.8], occ.white, 0.01, [-S * 0.03, S * 0.02]));
  eyeFans.push(fan(starOutline(4), Math.max(0.045, S * 0.06), [1, 1], occ.white, 0.01, [S * 0.2, -S * 0.17]));
  const eyeParts = [];
  const vertexEye = [], vertexRole = [];
  const fanSizes = eyeFans.map((f) => f.outline.length + 1);
  const spriteSizes = eyeSprites.map((s) => s.points.length);
  const owners = [];
  for (let e = 0, fi = 0, si = 0; e < eyeKinds.length; e++) {
    for (const role of eyeKinds[e].kinds) {
      if (p.eyeShape === "happy") owners.push({ kind: "sprite", index: si++, eye: e, role });
      else owners.push({ kind: "fan", index: fi++, eye: e, role });
    }
  }
  for (let i = highlightStart; i < eyeFans.length; i++) owners.push({ kind: "fan", index: i, eye: eyeCount, role: 2 });
  for (const o of owners.filter((o2) => o2.kind === "fan")) for (let k = 0; k < fanSizes[o.index]; k++) vertexEye.push(o.eye), vertexRole.push(o.role);
  for (const o of owners.filter((o2) => o2.kind === "sprite")) for (let k = 0; k < spriteSizes[o.index]; k++) vertexEye.push(o.eye), vertexRole.push(o.role);
  if (eyeFans.length) eyeParts.push(buildFanGeometry(eyeFans));
  if (eyeSprites.length) eyeParts.push(buildSpriteGeometry(eyeSprites));
  let eyes = null, eyeBase = null;
  if (eyeParts.length) {
    const geometry = eyeParts.length > 1 ? mergeGeometries(eyeParts) : eyeParts[0];
    geometry.boundingSphere = new THREE3.Sphere(new THREE3.Vector3(), S * 2);
    eyeBase = Float32Array.from(geometry.attributes.aCorner.array);
    eyes = new THREE3.Mesh(
      geometry,
      createToonMaterial({
        ramp: [EYE_COLOR, C[1], PUPIL_COLOR, C[6], WHITE],
        steps: [0.2, 0.4, 0.6, 0.8],
        foliage: true,
        unlit: true,
        leafShade: [0, 1],
        outline: false,
        glow: false,
        id: 41
      })
    );
    eyes.name = "eyes";
    pivot.add(eyes);
  }
  const blinkTimes = [];
  for (let i = 0; i < p.blinks; i++) {
    const c = (i + blinkRng.range(0.2, 0.8)) / p.blinks;
    blinkTimes.push(c);
    if (blinkRng.chance(0.3)) blinkTimes.push(c + 0.12 / DURATION * 1.6);
  }
  function blinkAt(u) {
    const L = 0.12 / DURATION;
    let shut = 0;
    for (const c of blinkTimes) {
      let d = u - c;
      d -= Math.round(d);
      const k = Math.abs(d) / (L / 2);
      if (k < 1) shut = Math.max(shut, Math.sin((1 - k) * Math.PI * 0.5) ** 0.6);
    }
    return shut;
  }
  const particles = [];
  const fxFans = [];
  const addParticle = (kind, data, layers) => {
    const first = fxFans.reduce((n, f) => n + f.outline.length + 1, 0);
    for (const [size, occlusion, lift] of layers) fxFans.push(fan(starOutline(4), size, [1, 1], occlusion, lift));
    const count = layers.length * 5;
    particles.push({ kind, ...data, first, count });
  };
  const fxOcc = { deep: 0.1, mid: 0.4, light: 0.6, white: 0.9 };
  for (let i = 0; i < p.sparks; i++) addParticle("spark", { i }, [[0.09, fxOcc.mid, 0], [0.05, fxOcc.white, 0.01]]);
  for (let i = 0; i < p.drips; i++) {
    const life = Math.min(DURATION * 0.9, fxRng.range(0.9, 1.6));
    addParticle("drip", { i, born: fxRng.next() * DURATION, life, offset: fxRng.range(-0.55, 0.55), azimuth: fxRng.range(0, TAU) }, [
      [0.06, fxOcc.light, 0],
      [0.04, fxOcc.white, 0.01]
    ]);
  }
  for (let i = 0; i < p.motes; i++) {
    const life = Math.min(DURATION * 0.95, fxRng.range(1.5, 3));
    const white = i % 4 === 0;
    addParticle("mote", {
      i,
      born: fxRng.next() * DURATION,
      life,
      angle: fxRng.range(0, TAU),
      radius: fxRng.range(1.3, 2.4) * S,
      height: fxRng.range(-0.8, 0.6) * S,
      wobble: fxRng.range(1, 2),
      rise: fxRng.range(4, 9) / 24 * S
    }, [[0.05, white ? fxOcc.white : i % 2 ? fxOcc.light : fxOcc.deep, 0]]);
  }
  let fx = null, fxBase = null;
  if (fxFans.length) {
    const geometry = buildFanGeometry(fxFans);
    geometry.boundingSphere = new THREE3.Sphere(new THREE3.Vector3(0, center, 0), S * 4);
    fxBase = Float32Array.from(geometry.attributes.aCorner.array);
    fx = new THREE3.Mesh(
      geometry,
      createToonMaterial({
        ramp: [C[4], C[5], C[6], WHITE],
        steps: [0.25, 0.5, 0.75],
        foliage: true,
        unlit: true,
        leafShade: [0, 1],
        outline: false,
        glow: false,
        id: 42
      })
    );
    fx.name = "sparks";
    facing.add(fx);
  }
  const now = newState();
  const then = newState();
  const matrix = new THREE3.Matrix4();
  const quaternion = new THREE3.Quaternion();
  const point = new THREE3.Vector3();
  const view = new THREE3.Vector3(0, 0, 1);
  const right = new THREE3.Vector3(1, 0, 0);
  const rightProbe = new THREE3.Vector3();
  const cameraQuat = new THREE3.Quaternion();
  const groupQuat = new THREE3.Quaternion();
  let lastTime = NaN;
  let viewDirty = true;
  if (eyes) {
    eyes.onBeforeRender = (renderer, scene, camera) => {
      camera.getWorldQuaternion(cameraQuat);
      facing.getWorldQuaternion(groupQuat);
      point.set(0, 0, 1).applyQuaternion(cameraQuat).applyQuaternion(groupQuat.invert());
      rightProbe.set(1, 0, 0).applyQuaternion(cameraQuat).applyQuaternion(groupQuat);
      if (point.distanceToSquared(view) > 1e-6) {
        view.copy(point);
        right.copy(rightProbe);
        viewDirty = true;
      }
    };
  }
  function update(t) {
    state(t, now);
    pivot.position.copy(now.position);
    pivot.scale.copy(now.scale);
    pivot.rotation.copy(now.rotation);
    const u = now.u;
    const position = bodyGeometry.attributes.position;
    const pa = position.array;
    for (let i = 0; i < pa.length; i += 3) {
      const dx = directions[i], dy = directions[i + 1], dz = directions[i + 2];
      const r = radiusAt(dx, dy, dz, u);
      pa[i] = dx * r;
      pa[i + 1] = dy * r;
      pa[i + 2] = dz * r;
    }
    position.needsUpdate = true;
    bodyGeometry.computeVertexNormals();
    if (p.currents > 0) {
      const na = bodyGeometry.attributes.normal.array;
      const amount = 0.32 * p.currents;
      const cx = Math.cos(TAU * u) * 1.4, cy = Math.sin(TAU * u) * 1.4;
      for (let i = 0; i < na.length; i += 3) {
        const x = directions[i] * 1.6 + cx, y = directions[i + 1] * 1.6 + cy, z = directions[i + 2] * 1.6;
        let nx = na[i] + (noiseC(x, y, z) - 0.5) * amount;
        let ny = na[i + 1] + (noiseC(x + 31, y, z) - 0.5) * amount;
        let nz = na[i + 2] + (noiseC(x, y + 57, z) - 0.5) * amount;
        const l = Math.hypot(nx, ny, nz) || 1;
        na[i] = nx / l;
        na[i + 1] = ny / l;
        na[i + 2] = nz / l;
      }
    }
    bodyGeometry.attributes.normal.needsUpdate = true;
    if (eyes) {
      const lookX = loop(lookNoise, 1.7, 4.2, u, 1.1) * p.look;
      const lookY = loop(lookNoise, 6.2, 2.9, u, 1.1) * 0.7 * p.look;
      const fx0 = THREE3.MathUtils.clamp(now.vx / (S * 1.25), -1, 1) * S * 0.12 + lookX * S * 0.06;
      const fy0 = THREE3.MathUtils.clamp(now.vy / (S * 1.67), -1, 1) * S * 0.05 + lookY * S * 0.04;
      const open = 1 - blinkAt(u);
      const positionE = eyes.geometry.attributes.position;
      const cornerE = eyes.geometry.attributes.aCorner;
      const pe = positionE.array, ce = cornerE.array;
      const xs = [[], [0], [-1, 1], [-1, 0, 1]][eyeCount];
      const placed = xs.map((k) => {
        const ex = k * S * p.eyeSpacing * (eyeCount === 3 ? 1.25 : 1) + fx0;
        const ey = S * p.eyeHeight + fy0 + (eyeCount === 3 && k === 0 ? S * 0.12 : 0);
        const ez = Math.sqrt(Math.max(0.05 * S * S, S * S - ex * ex - ey * ey));
        point.set(ex, ey, ez).normalize();
        const r = radiusAt(point.x, point.y, point.z, u);
        const facing2 = point.dot(view);
        const squash = facing2 < 0.3 ? 0 : Math.min(1, facing2 * 1.1);
        return { x: point.x * (r + 0.01), y: point.y * (r + 0.01), z: point.z * (r + 0.01), squash };
      });
      point.copy(view).multiplyScalar(0.8).addScaledVector(right, -0.42).add(UP_HALF).normalize();
      const rh = radiusAt(point.x, point.y, point.z, u) + 0.02;
      placed.push({ x: point.x * rh, y: point.y * rh, z: point.z * rh, squash: 1 });
      const lift = Math.max(0.12, open);
      for (let v = 0; v < vertexEye.length; v++) {
        const e = placed[vertexEye[v]];
        pe[v * 3] = e.x;
        pe[v * 3 + 1] = e.y;
        pe[v * 3 + 2] = e.z;
        let cx = eyeBase[v * 3], cy = eyeBase[v * 3 + 1];
        if (vertexRole[v] === 2) {
          ce[v * 3] = cx;
          ce[v * 3 + 1] = cy;
          continue;
        }
        if (vertexRole[v] === 1) {
          cx += lookX * rx * 0.45;
          cy += lookY * ry * 0.4;
        }
        const minHalf = 0.035;
        const sy = p.eyeShape === "happy" ? 1 : Math.max(lift, minHalf / Math.max(ry, 1e-3));
        ce[v * 3] = cx * e.squash;
        ce[v * 3 + 1] = cy * Math.min(1, sy) * (e.squash > 0 ? 1 : 0);
      }
      positionE.needsUpdate = true;
      cornerE.needsUpdate = true;
    }
    if (fx) {
      const pf = fx.geometry.attributes.position.array, cf = fx.geometry.attributes.aCorner.array;
      const place = (particle, x, y, z, scale) => {
        for (let v = particle.first; v < particle.first + particle.count; v++) {
          pf[v * 3] = x;
          pf[v * 3 + 1] = y;
          pf[v * 3 + 2] = z;
          cf[v * 3] = fxBase[v * 3] * scale;
          cf[v * 3 + 1] = fxBase[v * 3 + 1] * scale;
        }
      };
      for (const particle of particles) {
        if (particle.kind === "spark") {
          const i = particle.i;
          const th = TAU * (u * (1 + i % 2) * (i % 3 === 2 ? -1 : 1) + i / p.sparks);
          const orbit = S * 1.6 * (1 + i % 2 * 0.15);
          const tiltY = Math.sin(th) * orbit * 0.25;
          place(particle, now.position.x + Math.cos(th) * orbit, now.position.y + tiltY + (i % 2 ? 0.17 : -0.08) * S, now.position.z + Math.sin(th) * orbit, 1);
          continue;
        }
        let age = ((t - particle.born) % DURATION + DURATION) % DURATION;
        if (age >= particle.life) {
          place(particle, now.position.x, now.position.y, now.position.z, 0);
          continue;
        }
        const k = age / particle.life;
        if (particle.kind === "drip") {
          const alpha = 1 - k;
          if (alpha < 0.2) {
            place(particle, now.position.x, now.position.y, now.position.z, 0);
            continue;
          }
          state(t - age, then);
          const th = Math.atan2(1, particle.offset);
          const dx = Math.cos(th) * Math.cos(particle.azimuth), dz = Math.cos(th) * Math.sin(particle.azimuth), dy = -Math.sin(th);
          const r = radiusAt(dx, dy, dz, then.u) * 0.95;
          point.set(dx * r, dy * r, dz * r);
          quaternion.setFromEuler(then.rotation);
          matrix.compose(then.position, quaternion, then.scale);
          point.applyMatrix4(matrix);
          const fall = age * age * 1.08 * S;
          place(particle, point.x + Math.sin(age * 3 + particle.i) * 0.03, point.y - fall, point.z, k < 0.5 ? 1 : 0.75);
        } else {
          const alpha = Math.sin(Math.PI * k);
          if (alpha < 0.25) {
            place(particle, now.position.x, now.position.y, now.position.z, 0);
            continue;
          }
          const wob = Math.sin(age * particle.wobble) * 0.1 * S;
          place(
            particle,
            Math.cos(particle.angle) * particle.radius + wob,
            center + particle.height + age * particle.rise,
            Math.sin(particle.angle) * particle.radius - wob,
            1
          );
        }
      }
      fx.geometry.attributes.position.needsUpdate = true;
      fx.geometry.attributes.aCorner.needsUpdate = true;
    }
  }
  const light = p.glow > 0 ? createGlowLight() : null;
  const lightColor = rgb(C[5]);
  const lightPosition = new THREE3.Vector3();
  if (light) body.material.addEventListener("dispose", () => light.release());
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    const t = sharedUniforms.uTime.value;
    if (t !== lastTime || viewDirty) {
      lastTime = t;
      viewDirty = false;
      update(t);
    }
    baseUpdate(force);
    if (light) light.set(pivot.getWorldPosition(lightPosition), lightColor, p.glow, p.glowStrength);
  };
  update(0);
  lastTime = 0;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
function almondOutline(sides) {
  const outline = [];
  for (let i = 0; i < sides; i++) {
    const a = i / sides * TAU;
    const x = Math.cos(a);
    outline.push([x, Math.sin(a) * (1 - x * x * 0.45)]);
  }
  return outline;
}
function arcSprite(rx, h, w, occlusion) {
  const points = [];
  const triangles = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const v = i / n * 2 - 1;
    const y = Math.sqrt(Math.max(0, 1 - v * v)) * h - h * 0.4;
    points.push([v * rx, y + w / 2], [v * rx, y - w / 2]);
    if (i < n) {
      const k = i * 2;
      triangles.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  return { position: new THREE3.Vector3(), points, triangles, occlusion, flex: 0 };
}
export {
  BLOB_PALETTES,
  create,
  disposeObject as dispose,
  meta,
  setWind,
  tick
};
