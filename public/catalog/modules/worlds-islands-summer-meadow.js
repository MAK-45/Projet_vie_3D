// Projet Vie 3D — Prairie d'été (worlds/islands/summer-meadow), version 3
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/worlds/summer-meadow.js
import * as THREE23 from "three";

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
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>

uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
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

// src/assets/kit/palettes.js
var STONES = {
  granite: { label: "Granit", ramp: ["#4a4658", "#6f6c7c", "#9a98a3", "#c9c7c8"], ink: "#2b2836" },
  sandstone: { label: "Gr\xE8s", ramp: ["#6b4438", "#9a6a48", "#c59760", "#e8c88a"], ink: "#43272a" },
  limestone: { label: "Calcaire", ramp: ["#746a6e", "#a59a8f", "#d3c8b0", "#f1e8cf"], ink: "#4a4148" },
  basalt: { label: "Basalte", ramp: ["#23222f", "#383846", "#55566a", "#7b7e90"], ink: "#15141d" },
  slate: { label: "Ardoise", ramp: ["#2c3a48", "#44586a", "#66808f", "#96adb5"], ink: "#1a232e" },
  // Le Complexe (docs/complexe/README.md) : basalte noir-bleu des murs et des sols, pierre fumée des voûtes et piliers.
  blackBasalt: { label: "Basalte noir-bleu", ramp: ["#13161d", "#1e2228", "#2f353e", "#4c5560"], ink: "#0a0c11" },
  smoked: { label: "Pierre fum\xE9e", ramp: ["#211d1b", "#3a3631", "#575049", "#7d7467"], ink: "#13100f" }
};
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
var MEADOW_GROUNDS = {
  spring: {
    label: "Printemps",
    grass: ["#2a5b43", "#3d7f46", "#5ea44b", "#8dc65a"],
    lush: ["#1f4a40", "#2c6644", "#438746", "#68a94c"],
    dry: ["#4f6a3c", "#6f8a42", "#94ab52", "#bdcb6e"],
    bare: ["#4a3330", "#6a4a39", "#8a6646", "#a98459"],
    flowers: ["#fffbe8", "#f6d43a"],
    flowerDensity: 0.1
  },
  summer: {
    label: "\xC9t\xE9",
    grass: ["#2a5440", "#3b7343", "#559446", "#80b450"],
    lush: ["#1d4540", "#285d42", "#3a7a43", "#5a9a47"],
    dry: ["#59603a", "#7f8040", "#a8a050", "#cdc06c"],
    bare: ["#4a3230", "#6b4a3a", "#8d6847", "#ad895c"],
    flowers: ["#fdf8ea", "#f2c935"],
    flowerDensity: 0.055
  },
  autumn: {
    label: "Automne",
    grass: ["#3f4a34", "#5c6738", "#7f853f", "#a6a24e"],
    lush: ["#2f4136", "#435a3a", "#5d743d", "#7d9145"],
    dry: ["#5e4a34", "#85683c", "#ad8a48", "#d0ae62"],
    bare: ["#433031", "#62453a", "#835f45", "#a27c57"],
    flowers: ["#d9733a", "#e8b04a"],
    flowerDensity: 0.03
  },
  winter: {
    label: "Hiver",
    grass: ["#3d4552", "#58605d", "#7b7c6c", "#9e9884"],
    lush: ["#334050", "#4a585c", "#666f68", "#888c7c"],
    dry: ["#4e4a4c", "#6e6557", "#928466", "#b4a57e"],
    bare: ["#8a97b8", "#b9c3dc", "#e2e8f2", "#fbfbf6"],
    flowers: null,
    flowerDensity: 0
  },
  skirt: ["#3e2a2c", "#5d3f33", "#7f5a3f", "#a07a52"]
};

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
  const hash2 = (x, y, z) => {
    let h = Math.imul(x, 2376512323) ^ Math.imul(y, 3625334849) ^ Math.imul(z, 3407524639) ^ salt | 0;
    h = Math.imul(h ^ h >>> 15, 739982445);
    h = Math.imul(h ^ h >>> 12, 695872825);
    return ((h ^ h >>> 15) >>> 0) / 4294967296;
  };
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp4 = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
    const corner = (dx, dy, dz) => hash2(xi + dx, yi + dy, zi + dz);
    return lerp4(
      lerp4(lerp4(corner(0, 0, 0), corner(1, 0, 0), u), lerp4(corner(0, 1, 0), corner(1, 1, 0), u), v),
      lerp4(lerp4(corner(0, 0, 1), corner(1, 0, 1), u), lerp4(corner(0, 1, 1), corner(1, 1, 1), u), v),
      w
    );
  };
}

// src/assets/nature/terrain/meadow-ground.js
import * as THREE3 from "three";

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
function buildDrape(geometry, coverage, { subdivisions = 3, lift = () => 0.015 } = {}) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const position = source.attributes.position;
  const count = position.count;
  const key = (i) => `${position.getX(i).toFixed(4)},${position.getY(i).toFixed(4)},${position.getZ(i).toFixed(4)}`;
  const sums = /* @__PURE__ */ new Map();
  const a = new THREE2.Vector3(), b = new THREE2.Vector3(), c = new THREE2.Vector3(), n = new THREE2.Vector3();
  for (let i = 0; i < count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    n.subVectors(c, b).cross(a.clone().sub(b));
    for (let k = 0; k < 3; k++) {
      const id = key(i + k);
      const sum = sums.get(id) ?? sums.set(id, new THREE2.Vector3()).get(id);
      sum.add(n);
    }
  }
  for (const sum of sums.values()) sum.normalize();
  const out = [];
  const corners = [new THREE2.Vector3(), new THREE2.Vector3(), new THREE2.Vector3()];
  const normals = [new THREE2.Vector3(), new THREE2.Vector3(), new THREE2.Vector3()];
  const sample = (bary) => {
    const p = new THREE2.Vector3().addScaledVector(corners[0], bary[0]).addScaledVector(corners[1], bary[1]).addScaledVector(corners[2], bary[2]);
    const sn = new THREE2.Vector3().addScaledVector(normals[0], bary[0]).addScaledVector(normals[1], bary[1]).addScaledVector(normals[2], bary[2]).normalize();
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
    const cache = /* @__PURE__ */ new Map();
    const at = (r, s) => cache.get(r * 64 + s) ?? cache.set(r * 64 + s, grid(r, s)).get(r * 64 + s);
    for (let r = 0; r < m; r++) {
      for (let s = 0; s < m - r; s++) {
        clip([at(r, s), at(r + 1, s), at(r, s + 1)]);
        if (s < m - r - 1) clip([at(r + 1, s), at(r + 1, s + 1), at(r, s + 1)]);
      }
    }
  }
  source.dispose();
  const result = new THREE2.BufferGeometry();
  result.setAttribute("position", new THREE2.Float32BufferAttribute(out, 3));
  result.computeVertexNormals();
  result.setIndex(sequentialIndex(out.length / 3));
  return result;
}
function buildTerrainChunk({ size, spacing = 0.5, origin = [0, 0], height, skirtBottom = -0.25 }) {
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
      if ((i + j) % 2 === 0) index.push(at(i, j), at(i + 1, j), at(i, j + 1), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1));
      else index.push(at(i, j), at(i + 1, j + 1), at(i, j + 1), at(i, j), at(i + 1, j), at(i + 1, j + 1));
    }
  }
  const top = new THREE2.BufferGeometry();
  top.setAttribute("position", new THREE2.Float32BufferAttribute(positions, 3));
  top.setAttribute("normal", new THREE2.Float32BufferAttribute(normals, 3));
  top.setAttribute("aGround", new THREE2.Float32BufferAttribute(ground, 2));
  top.setIndex(index);
  const sp = [];
  const sn = [];
  const si = [];
  const sides = [
    { from: (k) => at(0, k), normal: [0, 0, -1] },
    { from: (k) => at(k, n), normal: [1, 0, 0] },
    { from: (k) => at(n, n - k), normal: [0, 0, 1] },
    { from: (k) => at(n - k, 0), normal: [-1, 0, 0] }
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
  const skirt = new THREE2.BufferGeometry();
  skirt.setAttribute("position", new THREE2.Float32BufferAttribute(sp, 3));
  skirt.setAttribute("normal", new THREE2.Float32BufferAttribute(sn, 3));
  skirt.setIndex(si);
  return { top, skirt };
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

// src/assets/nature/terrain/meadow-ground.js
var tileParam = (label, description) => ({ type: "int", default: 0, min: -500, max: 500, label, description });
var params = {
  seed: seedParam(
    "Graine du monde : relief et place des taches. Tous les morceaux d'une m\xEAme carte prennent la m\xEAme graine."
  ),
  season: seasonParam("Vert franc en \xE9t\xE9, tendre et fleuri au printemps, blondi en automne, gris et enneig\xE9 l'hiver."),
  finish: choiceParam(
    "Rendu",
    { pixel: "Pixel art (aplats)", smooth: "Lisse (d\xE9grad\xE9s)" },
    "Aplats nets avec un grain de pixels et des bords de taches tram\xE9s, ou couleurs fondues en d\xE9grad\xE9s doux."
  ),
  tileX: tileParam("Case X", "Colonne du morceau sur la carte : le morceau X + 1 se pose \xE0 X + Largeur m\xE8tres."),
  tileZ: tileParam("Case Z", "Rang\xE9e du morceau sur la carte."),
  size: numberParam("Largeur", 12, 4, 24, "C\xF4t\xE9 du morceau carr\xE9. Tous les morceaux d'une carte ont la m\xEAme largeur.", {
    step: 1,
    unit: "m"
  }),
  relief: numberParam("Relief", 1.4, 0, 3, "Hauteur des ondulations du terrain.", { step: 0.1, unit: "m" }),
  dryness: numberParam("S\xE9cheresse", 0.2, 0, 1, "Part d'herbe s\xE8che et de terre nue."),
  preview: choiceParam(
    "Aper\xE7u",
    { single: "Un morceau", grid: "4 morceaux raccord\xE9s" },
    "Un morceau seul, ou les 4 morceaux (X, Z) \xE0 (X + 1, Z + 1) pos\xE9s c\xF4te \xE0 c\xF4te, pour voir le raccord."
  )
};
var meta = {
  id: "nature/terrain/meadow-ground",
  name: "Sol de prairie",
  nameEn: "Meadow ground",
  category: "nature",
  subcategory: "terrain",
  description: "Grand morceau de sol de prairie qui se raccorde sans couture \xE0 ses voisins pour couvrir une carte : relief doux, herbe grasse, herbe s\xE8che, terre nue et fleurs sem\xE9es, en aplats pixel art ou en d\xE9grad\xE9s lisses. Quatre saisons.",
  tags: [
    "sol",
    "terrain",
    "prairie",
    "plaine",
    "herbe",
    "pr\xE9",
    "tuile",
    "raccordable",
    "sans couture",
    "carte",
    "relief",
    "saisons",
    "ext\xE9rieur",
    "ground",
    "land",
    "meadow",
    "plain",
    "grass",
    "field",
    "tile",
    "tileable",
    "seamless",
    "map",
    "heightmap",
    "seasons",
    "outdoor",
    "procedural"
  ],
  biomes: ["meadow", "garden", "village", "forest"],
  version: 1,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au centre du morceau, au niveau le plus bas du relief. Poser le morceau (tileX, tileZ) \xE0 (tileX \xD7 size, 0, tileZ \xD7 size).",
  footprint: { radius: 8.5, height: 1.4 },
  animated: [],
  pedestal: false,
  // la visionneuse ne pose pas de socle : le morceau est lui-même un sol
  params,
  variants: [
    { id: "summer", name: "\xC9t\xE9 \u2014 pixel art", params: { season: "summer", finish: "pixel" } },
    { id: "summer-smooth", name: "\xC9t\xE9 \u2014 lisse", params: { season: "summer", finish: "smooth" } },
    { id: "spring", name: "Printemps", params: { season: "spring" } },
    { id: "autumn", name: "Automne", params: { season: "autumn" } },
    { id: "winter", name: "Hiver", params: { season: "winter" } }
  ]
};
function groundHeight(seed = 1, relief = 1.4) {
  const noise = createNoise3(seed * 31 + 7);
  return (X, Z) => {
    const broad = noise(X * 0.045, 0.5, Z * 0.045);
    const swell = noise(X * 0.12 + 40, 3.5, Z * 0.12 - 17);
    const bump = noise(X * 0.33 - 9, 6.5, Z * 0.33 + 5);
    const h = broad * 0.62 + swell * 0.28 + bump * 0.1;
    const t = THREE3.MathUtils.clamp((h - 0.28) / 0.44, 0, 1);
    return relief * t * t * (3 - 2 * t);
  };
}
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const palette = MEADOW_GROUNDS[p.season];
  const height = groundHeight(p.seed, p.relief);
  const winter = p.season === "winter";
  const offsets = p.preview === "grid" ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]];
  const shift = p.preview === "grid" ? -0.5 : 0;
  const tops = [];
  const skirts = [];
  for (const [dx, dz] of offsets) {
    const origin = [(p.tileX + dx) * p.size, (p.tileZ + dz) * p.size];
    const { top: top2, skirt: skirt2 } = buildTerrainChunk({ size: p.size, spacing: 0.5, origin, height, skirtBottom: -0.25 });
    const local = [(dx + shift) * p.size, 0, (dz + shift) * p.size];
    top2.translate(...local);
    skirt2.translate(...local);
    tops.push(top2);
    skirts.push(skirt2);
  }
  const dry = p.dryness;
  const topMaterial = createToonMaterial({
    ramp: palette.grass,
    steps: [0.62, 0.8, 0.935],
    pattern: "ground",
    patternParams: [16, 0.05, 0.055, 1],
    seed: p.seed % 97,
    id: 11,
    shadowLit: 0.7,
    ground: {
      smooth: p.finish === "smooth",
      driftScale: 0.03,
      fringe: 0.05,
      flowers: palette.flowers ?? void 0,
      flowerDensity: palette.flowerDensity,
      layers: [
        // Herbe grasse : grandes nappes sombres, qui reculent dans les zones sèches.
        { ramp: palette.lush, scale: 0.13, threshold: 0.56 + dry * 0.12, seed: 1, drift: -0.5 },
        // Herbe sèche : nappes blondes, plus nombreuses dans les grandes zones sèches.
        { ramp: palette.dry, scale: 0.11, threshold: 0.82 - dry * 0.24, seed: 2, drift: 0.4 },
        // Terre nue (neige l'hiver) : petites plaques.
        { ramp: palette.bare, scale: winter ? 0.16 : 0.42, threshold: winter ? 0.5 : 0.9 - dry * 0.14, seed: 3, drift: winter ? 0 : 0.3 }
      ]
    }
  });
  const group = new THREE3.Group();
  group.name = meta.name;
  const top = new THREE3.Mesh(tops.length > 1 ? mergeGeometries(tops) : tops[0], topMaterial);
  top.name = "ground";
  top.receiveShadow = true;
  group.add(top);
  const skirt = new THREE3.Mesh(
    skirts.length > 1 ? mergeGeometries(skirts) : skirts[0],
    createToonMaterial({
      ramp: MEADOW_GROUNDS.skirt,
      steps: [0.3, 0.5, 0.74],
      pattern: "speckle",
      patternParams: [16, 0.08, 0.2, 1],
      seed: 5,
      id: 12
    })
  );
  skirt.name = "skirt";
  skirt.receiveShadow = true;
  group.add(skirt);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

// src/worlds/kit/scatter.js
import * as THREE4 from "three";
var _frustum = new THREE4.Frustum();
var _viewProjection = new THREE4.Matrix4();
var _child = new THREE4.Matrix4();
function limitShadowCopies(mesh) {
  mesh.userData.shadowCount = -1;
  mesh.onBeforeShadow = () => {
    const limit = mesh.userData.shadowCount;
    mesh.userData.drawCount = mesh.count;
    if (limit >= 0 && limit < mesh.count) mesh.count = limit;
  };
  mesh.onAfterShadow = () => {
    mesh.count = mesh.userData.drawCount;
  };
}
var ScatterField = class {
  /**
   * @param {object} options
   * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} options.bounds emprise du monde (m)
   * @param {(x: number, z: number) => number} [options.heightAt] hauteur du sol : chaque case est bornée au plus
   *   juste (une case trop haute est « vue » de loin, et ses copies dessinées pour rien)
   * @param {Record<string, {cellSize: number, height: number, margin: number}>} [options.classes] familles de
   *   couches : côté des cases (petit pour ce qui est dense, le tri est plus serré), hauteur de ce qui y pousse et
   *   marge autour de la case (débord des couronnes, ombres portées venues de hors champ)
   */
  constructor({
    bounds,
    heightAt = () => 0,
    classes = {
      fine: { cellSize: 4, height: 1.6, margin: 1.6 },
      low: { cellSize: 6, height: 3, margin: 3.5 },
      // marge : un rocher hors champ projette encore son ombre
      tall: { cellSize: 3, height: 15, margin: 8.5 }
      // un arbre par case environ ; marge = couronne + ombre portée
    }
  }) {
    this.bounds = bounds;
    this.group = new THREE4.Group();
    this.group.name = "scatter";
    this.layers = [];
    this.classes = {};
    this.fraction = 1;
    this._first = true;
    for (const [name, { cellSize, height, margin }] of Object.entries(classes)) {
      const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
      const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellSize));
      const count = cols * rows;
      const boxes = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = bounds.minX + col * cellSize;
          const z = bounds.minZ + row * cellSize;
          let low = Infinity;
          let high = -Infinity;
          for (let k = 0; k < 9; k++) {
            const h = heightAt(x + k % 3 / 2 * cellSize, z + Math.floor(k / 3) / 2 * cellSize);
            low = Math.min(low, h);
            high = Math.max(high, h);
          }
          boxes.push(new THREE4.Box3(
            new THREE4.Vector3(x - margin, low - 0.3, z - margin),
            new THREE4.Vector3(x + cellSize + margin, high + 0.2 + height, z + cellSize + margin)
          ));
        }
      }
      this.classes[name] = {
        cellSize,
        cols,
        rows,
        boxes,
        active: [],
        // cases qui contiennent quelque chose (remplies par build)
        visible: new Int16Array(count),
        length: 0,
        previous: new Int16Array(count),
        previousLength: -1,
        distance: new Float32Array(count)
        // distance de chaque case à la caméra, à la dernière image
      };
    }
  }
  /**
   * Déclare une couche à partir d'un asset modèle. Le groupe est absorbé : ses géométries et matériaux servent aux
   * copies, et sont libérés par `dispose()`.
   *
   * @param {THREE.Group} prototype groupe sorti de `create()` d'un asset
   * @param {object} [options]
   * @param {"fine"|"low"|"tall"} [options.reach] famille de la couche : herbes et fleurs, rochers et plaques, arbres
   * @param {boolean} [options.thin] couche éclaircie quand la vue est large (herbe, fleurs)
   * @param {boolean} [options.castShadow] force ou coupe l'ombre portée de toute la couche
   * @param {string[]} [options.skip] noms des maillages du modèle à ne pas reprendre
   * @returns {{add: (matrix: THREE.Matrix4) => void, count: number, triangles: number}}
   */
  addLayer(prototype, { reach = "low", thin = false, castShadow, skip = [] } = {}) {
    const parts = [];
    prototype.updateMatrixWorld(true);
    prototype.traverse((child) => {
      if (!child.isMesh) return;
      if (skip.includes(child.name)) {
        disposeObject(child);
        return;
      }
      parts.push(child);
    });
    const layer = {
      name: prototype.name,
      reach,
      thin,
      parts,
      castShadow,
      castsShadow: castShadow ?? parts.some((part) => part.castShadow),
      index: this.layers.length,
      pending: Array.from({ length: this.classes[reach].boxes.length }, () => null),
      cells: null,
      meshes: [],
      count: 0,
      triangles: 0,
      add: (matrix) => {
        const e = matrix.elements;
        const index = this._cellIndex(this.classes[reach], e[12], e[14]);
        (layer.pending[index] ??= []).push(...e);
        layer.count += 1;
      }
    };
    for (const part of parts) {
      const geometry = part.geometry;
      layer.triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    }
    this.layers.push(layer);
    return layer;
  }
  /**
   * Fige le semis : construit les `InstancedMesh`. À appeler une fois toutes les copies ajoutées.
   * @param {{next: () => number}} rng générateur (kit/rng.js) pour mélanger l'ordre des copies de chaque case
   */
  build(rng) {
    for (const layer of this.layers) {
      layer.cells = layer.pending.map((list) => {
        if (!list) return null;
        const cell = new Float32Array(list);
        if (layer.thin) shuffleMatrices(cell, rng);
        return cell;
      });
      layer.pending = null;
      if (layer.count === 0) {
        for (const part of layer.parts) disposeObject(part);
        continue;
      }
      const matrices = new THREE4.InstancedBufferAttribute(new Float32Array(layer.count * 16), 16);
      matrices.setUsage(THREE4.DynamicDrawUsage);
      layer.matrices = matrices;
      for (const part of layer.parts) {
        const mesh = new THREE4.InstancedMesh(part.geometry, part.material, 0);
        mesh.name = `${layer.name} / ${part.name}`;
        mesh.instanceMatrix = matrices;
        mesh.customDepthMaterial = part.customDepthMaterial;
        mesh.castShadow = layer.castShadow ?? part.castShadow;
        mesh.receiveShadow = part.receiveShadow;
        mesh.frustumCulled = false;
        mesh.visible = false;
        mesh.matrixAutoUpdate = false;
        limitShadowCopies(mesh);
        mesh.userData.offset = part.matrixWorld.equals(_child.identity()) ? null : part.matrixWorld.clone();
        if (mesh.userData.offset) mesh.matrix.copy(mesh.userData.offset);
        layer.meshes.push(mesh);
        this.group.add(mesh);
      }
    }
    this.layers = this.layers.filter((layer) => layer.count > 0);
    for (const [name, cls] of Object.entries(this.classes)) {
      const layers = this.layers.filter((layer) => layer.reach === name);
      cls.active = cls.boxes.map((_, index) => index).filter((index) => layers.some((layer) => layer.cells[index]));
    }
  }
  /**
   * À appeler à chaque image avant le rendu : met à jour les copies dessinées si la vue a changé.
   *
   * `fraction` ne doit dépendre que du cadrage (zoom, inclinaison), jamais de ce qui se trouve dans la vue :
   * tant que le promeneur marche sans toucher à la caméra, les mêmes copies restent dessinées et rien ne
   * clignote ; elles n'entrent et ne sortent que par les bords de l'image.
   *
   * @param {THREE.Camera} camera caméra de la vue (matrices à jour)
   * @param {number} [fraction] part des copies dessinées dans les couches fines (0..1)
   * @param {object} [options] pour une caméra perspective (vue à la 3e personne)
   * @param {Record<string, number>} [options.reach] portée par famille (m) : au-delà de cette distance à la
   *   caméra, les cases de la famille ne sont pas dessinées (l'herbe lointaine ne fait qu'un pixel)
   * @param {number} [options.shadowReach] seules les copies à moins de cette distance de la caméra (m) projettent
   *   leur ombre : les copies sont alors rangées de la plus proche à la plus lointaine
   * @returns {boolean} vrai si les copies ont été recopiées
   */
  update(camera, fraction = 1, { reach = null, shadowReach = Infinity } = {}) {
    _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_viewProjection);
    const step = Math.round(THREE4.MathUtils.clamp(fraction, 0.1, 1) * 20) / 20;
    let changed = step !== this.fraction || this._first;
    this._first = false;
    this.fraction = step;
    for (const [name, cls] of Object.entries(this.classes)) {
      const limit = reach?.[name] ?? Infinity;
      let length = 0;
      for (let i = 0; i < cls.active.length; i++) {
        const index = cls.active[i];
        const box = cls.boxes[index];
        if (!_frustum.intersectsBox(box)) continue;
        const distance = limit === Infinity && shadowReach === Infinity ? 0 : box.distanceToPoint(camera.position);
        if (distance >= limit) continue;
        cls.distance[index] = distance;
        cls.visible[length++] = index;
      }
      let same = length === cls.previousLength;
      for (let i = 0; same && i < length; i++) same = cls.visible[i] === cls.previous[i];
      cls.length = length;
      if (!same) {
        cls.previous.set(cls.visible);
        cls.previousLength = length;
        changed = true;
      }
    }
    if (changed || shadowReach !== this._shadowReach) this._refill(step, shadowReach);
    this._shadowReach = shadowReach;
    return changed;
  }
  /** Dessine toutes les copies, sans tri : pour un monde montré d'un bloc (vignette, fiche d'asset). */
  showAll() {
    for (const cls of Object.values(this.classes)) {
      cls.length = cls.active.length;
      cls.visible.set(cls.active);
      cls.previousLength = -1;
    }
    this.fraction = 1;
    this._refill(1);
  }
  /** Copies et triangles dessinés à cet instant (hors passe d'ombre). */
  stats() {
    let instances = 0;
    let triangles = 0;
    let drawCalls = 0;
    for (const layer of this.layers) {
      const count = layer.meshes[0]?.count ?? 0;
      instances += count;
      triangles += count * layer.triangles;
      if (count > 0) drawCalls += layer.meshes.length;
    }
    return { instances, triangles, drawCalls };
  }
  dispose() {
    for (const layer of this.layers) {
      for (const mesh of layer.meshes) {
        disposeObject(mesh);
        mesh.dispose();
      }
    }
    this.group.clear();
    this.layers = [];
  }
  _cellIndex(cls, x, z) {
    const col = THREE4.MathUtils.clamp(Math.floor((x - this.bounds.minX) / cls.cellSize), 0, cls.cols - 1);
    const row = THREE4.MathUtils.clamp(Math.floor((z - this.bounds.minZ) / cls.cellSize), 0, cls.rows - 1);
    return row * cls.cols + col;
  }
  _refill(fraction, shadowReach = Infinity) {
    const trim = shadowReach !== Infinity;
    if (trim) {
      for (const cls of Object.values(this.classes)) {
        const { distance } = cls;
        cls.visible.subarray(0, cls.length).sort((a, b) => distance[a] - distance[b]);
      }
    }
    for (const layer of this.layers) {
      const cls = this.classes[layer.reach];
      const array = layer.matrices.array;
      let offset = 0;
      let shadowOffset = trim ? -1 : -16;
      for (let i = 0; i < cls.length; i++) {
        if (shadowOffset === -1 && cls.distance[cls.visible[i]] > shadowReach) shadowOffset = offset;
        const cell = layer.cells[cls.visible[i]];
        if (!cell) continue;
        const total = cell.length / 16;
        const count = layer.thin && fraction < 1 ? Math.floor(total * fraction + cellDither(cls.visible[i], layer.index)) : total;
        if (count === 0) continue;
        array.set(count === total ? cell : cell.subarray(0, count * 16), offset);
        offset += count * 16;
      }
      layer.matrices.clearUpdateRanges();
      if (offset > 0) {
        layer.matrices.addUpdateRange(0, offset);
        layer.matrices.needsUpdate = true;
      }
      if (shadowOffset === -1) shadowOffset = offset;
      for (const mesh of layer.meshes) {
        mesh.count = offset / 16;
        mesh.visible = offset > 0;
        mesh.userData.shadowCount = shadowOffset / 16;
      }
    }
  }
};
function cellDither(cell, layer) {
  const value = Math.sin(cell * 12.9898 + layer * 78.233) * 43758.5453;
  return value - Math.floor(value);
}
function shuffleMatrices(array, rng) {
  const count = array.length / 16;
  const swap = new Float32Array(16);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    if (i === j) continue;
    swap.set(array.subarray(i * 16, i * 16 + 16));
    array.copyWithin(i * 16, j * 16, j * 16 + 16);
    array.set(swap, j * 16);
  }
}

// src/worlds/kit/cloud-sea.js
import * as THREE5 from "three";
var VERTEX2 = (
  /* glsl */
  `
attribute float aMist; // 0 : mer ; sinon densit\xE9 de la brume en ce sommet
varying vec3 vWorld;
varying float vMist;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vMist = aMist;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`
);
var FRAGMENT2 = (
  /* glsl */
  `
layout(location = 1) out highp vec4 gAux;

uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec3 uColors[4]; // de l'ombre des bancs \xE0 leur sommet \xE9clair\xE9
uniform vec3 uHaze;      // couleur de l'horizon, o\xF9 la mer se fond dans le ciel
uniform vec2 uSun;       // direction horizontale vers l'astre
uniform vec2 uCenter;
uniform float uFade;     // distance au centre o\xF9 la mer a fini de se fondre dans le ciel (m)
varying vec3 vWorld;
varying float vMist;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y);
}
float billow(vec2 p) {
  return valueNoise(p) * 0.6 + valueNoise(p * 2.3 + 7.1) * 0.28 + valueNoise(p * 5.1 - 3.7) * 0.12;
}
float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int index = i.x + i.y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[index] + 0.5) / 16.0;
}

void main() {
  vec2 drift = uWindDir * uTime * (0.35 + 0.25 * uWindStrength);
  vec3 color;
  if (vMist > 0.001) {
    // Brume : des paquets qui passent, plus serr\xE9s vers le bord de l'\xEEle.
    vec2 p = vWorld.xz * 0.11 - drift * 0.22;
    float puff = billow(p);
    float density = vMist * (0.5 + 1.1 * puff);
    if (density < bayer4(gl_FragCoord.xy) * 0.9 + 0.1) discard;
    color = puff > 0.52 ? uColors[3] : uColors[2];
  } else {
    // Mer : le relief des bancs vient de la pente du bruit du c\xF4t\xE9 de l'astre.
    vec2 p = vWorld.xz * 0.045 - drift * 0.05;
    float body = billow(p);
    float slope = body - billow(p + uSun * 0.55);
    float lit = body * 0.75 + slope * 2.6 + 0.12;
    color = uColors[0];
    if (lit > 0.3) color = uColors[1];
    if (lit > 0.46) color = uColors[2];
    if (lit > 0.62) color = uColors[3];
    float far = smoothstep(uFade * 0.35, uFade, distance(vWorld.xz, uCenter));
    color = mix(color, uHaze, far);
  }
  gl_FragColor = vec4(color, 0.6); // 0,6 : ni contour ni teinte d'ambiance (voir pixel-renderer)
  gAux = vec4(0.5, 0.5, 1.0, 60.0 / 255.0);
}
`
);
function createCloudSea({ bounds, seaLevel = -60, mistLevel = -32, inset = 30 }) {
  const { minX, maxX, minZ, maxZ } = bounds;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const reach = 520;
  const positions = [];
  const mist = [];
  const index = [];
  const quad = (corners, heights, densities) => {
    const first = positions.length / 3;
    corners.forEach(([x, z], i) => {
      positions.push(x, heights[i], z);
      mist.push(densities[i]);
    });
    index.push(first, first + 2, first + 1, first, first + 3, first + 2);
  };
  quad([[centerX - reach, centerZ - reach], [centerX + reach, centerZ - reach], [centerX + reach, centerZ + reach], [centerX - reach, centerZ + reach]], [seaLevel, seaLevel, seaLevel, seaLevel], [0, 0, 0, 0]);
  const rings = [
    { offset: -inset, density: 1e-3, y: mistLevel + 2 },
    { offset: -inset * 0.45, density: 1.4, y: mistLevel },
    { offset: 4, density: 1.1, y: mistLevel - 1.5 },
    { offset: 30, density: 1e-3, y: mistLevel - 4 }
  ];
  const ring = (offset) => [[minX - offset, minZ - offset], [maxX + offset, minZ - offset], [maxX + offset, maxZ + offset], [minX - offset, maxZ + offset]];
  for (let k = 0; k < rings.length - 1; k++) {
    const a = rings[k];
    const b = rings[k + 1];
    const inner = ring(a.offset);
    const outer = ring(b.offset);
    for (let side = 0; side < 4; side++) {
      const next = (side + 1) % 4;
      quad([inner[side], inner[next], outer[next], outer[side]], [a.y, a.y, b.y, b.y], [a.density, a.density, b.density, b.density]);
    }
  }
  const geometry = new THREE5.BufferGeometry();
  geometry.setAttribute("position", new THREE5.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aMist", new THREE5.Float32BufferAttribute(mist, 1));
  geometry.setIndex(index);
  const material = new THREE5.ShaderMaterial({
    name: "CloudSea",
    side: THREE5.DoubleSide,
    uniforms: {
      ...sharedUniforms,
      uColors: { value: ["#93a7d6", "#c3cfec", "#e9eef8", "#ffffff"].map((hex) => new THREE5.Color(hex)).map((c) => new THREE5.Vector3(c.r, c.g, c.b)) },
      uHaze: { value: new THREE5.Vector3(0.86, 0.94, 0.91) },
      uSun: { value: new THREE5.Vector2(0, 1) },
      uCenter: { value: new THREE5.Vector2(centerX, centerZ) },
      uFade: { value: reach * 0.9 }
    },
    vertexShader: VERTEX2,
    fragmentShader: FRAGMENT2
  });
  const mesh = new THREE5.Mesh(geometry, material);
  mesh.name = "cloud sea";
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  return {
    mesh,
    /**
     * Teintes de la mer de nuages (ombre → sommet éclairé), couleur de l'horizon, direction de l'astre.
     * @param {THREE.Vector3[]} colors 4 couleurs sRGB brutes
     * @param {THREE.Vector3} haze
     * @param {THREE.Vector3} sunDirection direction vers l'astre
     */
    setLook(colors, haze, sunDirection) {
      for (let i = 0; i < 4; i++) material.uniforms.uColors.value[i].copy(colors[i]);
      material.uniforms.uHaze.value.copy(haze);
      material.uniforms.uSun.value.set(sunDirection.x, sunDirection.z).normalize();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

// src/worlds/kit/sky.js
import * as THREE7 from "three";

// src/assets/nature/sky/cloud.js
import * as THREE6 from "three";
var KINDS = {
  cumulus: {
    label: "Cumulus",
    ramp: ["#7f8fbf", "#b0bddd", "#e3e8f4", "#fffdf5"],
    puffs: [4, 6],
    radius: [0.2, 0.3],
    squash: 0.9,
    towers: [1, 3],
    depth: 0.75
  },
  stratus: {
    label: "Stratus",
    ramp: ["#8c95bd", "#b9c1dc", "#e0e4ef", "#f8f7f2"],
    puffs: [7, 10],
    radius: [0.1, 0.15],
    squash: 0.62,
    towers: [0, 1],
    depth: 0.45
  },
  storm: {
    label: "Orage",
    ramp: ["#2a2c48", "#43486a", "#646a8c", "#9498b2"],
    puffs: [5, 7],
    radius: [0.2, 0.28],
    squash: 0.95,
    towers: [3, 5],
    depth: 0.85
  }
};
var params2 = {
  seed: seedParam("Change la silhouette : nombre, taille et place des boules, tours qui montent, longueur du nuage."),
  kind: choiceParam("Type", KINDS, "Cumulus blanc et bomb\xE9, stratus en long banc plat, ou nuage d'orage sombre et haut."),
  size: numberParam("Longueur", 5, 2.5, 9, "Longueur du nuage ; toute la forme garde ses proportions.", { step: 0.5, unit: "m" })
};
var meta2 = {
  id: "nature/sky/cloud",
  name: "Nuage",
  nameEn: "Cloud",
  category: "nature",
  subcategory: "sky",
  description: "Nuage en boules lisses au dessous plat, \xE9clair\xE9 par le soleil et qui projette son ombre. Cumulus, stratus ou nuage d'orage ; la graine change le nombre et la place des boules et des tours.",
  tags: [
    "nuage",
    "ciel",
    "m\xE9t\xE9o",
    "cumulus",
    "stratus",
    "orage",
    "blanc",
    "ombre port\xE9e",
    "ext\xE9rieur",
    "cloud",
    "sky",
    "weather",
    "storm",
    "white",
    "puffy",
    "cast shadow",
    "outdoor",
    "procedural"
  ],
  biomes: ["forest", "meadow", "garden", "village", "desert", "snow", "swamp", "beach", "mountain"],
  version: 1,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre (taille de pr\xE9sentation : un monde l'agrandit et le place haut) ; l'origine est au sol, le dessous du nuage flotte \xE0 1,2 m",
  footprint: { radius: 3, height: 4 },
  animated: [],
  params: params2,
  variants: variantsOf("kind", params2.kind)
};
var BASE = 1.2;
function puff(center, radius, squash, floor) {
  const geometry = new THREE6.SphereGeometry(radius, 12, 8);
  geometry.deleteAttribute("uv");
  geometry.scale(1, squash, 1);
  geometry.translate(center.x, center.y, center.z);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) < floor) {
      position.setY(i, floor);
      normal.setXYZ(i, 0, -1, 0);
    }
  }
  return geometry;
}
function create2(given = {}) {
  const p = resolveParams(meta2.params, given);
  const kind = KINDS[p.kind];
  const shape = createRng(p.seed * 7919 + 17);
  const length = p.size * shape.range(0.85, 1.1);
  const half = length / 2;
  const floor = BASE;
  const geometries = [];
  const puffs = [];
  const count = shape.int(kind.puffs[0], kind.puffs[1]);
  const peak = shape.range(-0.3, 0.3);
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : i / (count - 1) * 2 - 1;
    const bell = Math.exp(-((u - peak) ** 2) * 1.6);
    const radius = p.size * THREE6.MathUtils.lerp(kind.radius[0], kind.radius[1], bell) * shape.range(0.85, 1.15);
    const x = u * (half - radius * 0.7) + shape.range(-0.1, 0.1) * radius;
    const z = shape.range(-0.35, 0.35) * radius * kind.depth;
    const y = floor + radius * kind.squash * shape.range(0.15, 0.4);
    puffs.push({ center: new THREE6.Vector3(x, y, z), radius });
  }
  for (let i = 0; i < count - 1; i++) {
    const a = puffs[i];
    const b = puffs[i + 1];
    if (!shape.chance(0.7)) continue;
    const radius = (a.radius + b.radius) * 0.5 * shape.range(0.75, 0.95);
    const side = shape.chance(0.5) ? 1 : -1;
    const center = a.center.clone().lerp(b.center, 0.5);
    center.z += side * radius * kind.depth * shape.range(0.5, 0.8);
    center.y = floor + radius * kind.squash * shape.range(0.1, 0.3);
    puffs.push({ center, radius });
  }
  const towers = shape.int(kind.towers[0], kind.towers[1]);
  const base = puffs.slice(0, count).sort((a, b) => b.radius - a.radius);
  for (let i = 0; i < towers; i++) {
    const below = base[i % base.length];
    const level = Math.floor(i / base.length);
    const radius = below.radius * shape.range(0.6, 0.8) * (p.kind === "storm" ? 1.05 : 1);
    const center = below.center.clone();
    center.x += shape.range(-0.3, 0.3) * below.radius;
    center.z += shape.range(-0.2, 0.2) * below.radius;
    center.y += (below.radius * 0.75 + radius * 0.35) * kind.squash * (1 + level * 0.8);
    puffs.push({ center, radius });
    if (p.kind === "storm") base.push({ center, radius });
  }
  for (const { center, radius } of puffs) geometries.push(puff(center, radius, kind.squash, floor));
  const group = new THREE6.Group();
  group.name = meta2.name;
  const material = createToonMaterial({
    ramp: kind.ramp,
    steps: [0.34, 0.55, 0.76],
    selfEdge: 0.35,
    shadowLit: 0.5,
    id: 22
  });
  const mesh = new THREE6.Mesh(mergeGeometries(geometries), material);
  mesh.name = "cloud";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.userData.asset = { id: meta2.id, params: p, puffs: puffs.length };
  return group;
}

// src/worlds/kit/sky.js
var WORLD_UP = new THREE7.Vector3(0, 1, 0);
function createDaylight({ azimuth = THREE7.MathUtils.degToRad(-17), elevation = THREE7.MathUtils.degToRad(44), mapSize = 1024 } = {}) {
  const light = new THREE7.DirectionalLight(16777215, 1);
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = -15e-4;
  light.shadow.normalBias = 0.05;
  const direction = new THREE7.Vector3();
  const right = new THREE7.Vector3();
  const up = new THREE7.Vector3();
  const DISTANCE = 140;
  let radius = 0;
  const daylight = {
    light,
    /** Direction vers l'astre. */
    direction,
    azimuth,
    elevation,
    /** Change la position de l'astre (heure du jour). Angles en radians. */
    setSun(nextAzimuth, nextElevation) {
      daylight.azimuth = nextAzimuth;
      daylight.elevation = nextElevation;
      direction.set(
        Math.sin(nextAzimuth) * Math.cos(nextElevation),
        Math.sin(nextElevation),
        Math.cos(nextAzimuth) * Math.cos(nextElevation)
      );
      right.crossVectors(WORLD_UP, direction).normalize();
      up.crossVectors(direction, right).normalize();
    },
    /**
     * Cadre la carte d'ombre sur un disque de `reach` mètres autour de `target`.
     * @param {THREE.Vector3} target point regardé
     * @param {number} reach rayon à couvrir (m)
     */
    update(target, reach) {
      const wanted = Math.ceil(THREE7.MathUtils.clamp(reach, 16, 90) / 8) * 8;
      const camera = light.shadow.camera;
      if (wanted !== radius) {
        radius = wanted;
        camera.left = -radius;
        camera.right = radius;
        camera.top = radius;
        camera.bottom = -radius;
        camera.near = 1;
        camera.far = DISTANCE * 2.5;
        camera.updateProjectionMatrix();
      }
      const texel = radius * 2 / light.shadow.mapSize.x;
      const x = Math.round(target.dot(right) / texel) * texel;
      const y = Math.round(target.dot(up) / texel) * texel;
      const z = target.dot(direction);
      light.target.position.set(0, 0, 0).addScaledVector(right, x).addScaledVector(up, y).addScaledVector(direction, z);
      light.position.copy(light.target.position).addScaledVector(direction, DISTANCE);
      light.target.updateMatrixWorld();
    },
    dispose() {
      light.shadow.map?.dispose();
      light.dispose();
    }
  };
  daylight.setSun(azimuth, elevation);
  return daylight;
}
function createCloudShadows(rng, { bounds, count = 6, altitude = [26, 36] }) {
  const group = new THREE7.Group();
  group.name = "cloud shadows";
  const margin = 45;
  const span = {
    minX: bounds.minX - margin,
    maxX: bounds.maxX + margin,
    minZ: bounds.minZ - margin,
    maxZ: bounds.maxZ + margin
  };
  const prototypes = [
    create2({ seed: rng.int(1, 400), kind: "cumulus", size: 9 }),
    create2({ seed: rng.int(1, 400), kind: "cumulus", size: 7 })
  ].map((prototype) => prototype.children[0]);
  for (const prototype of prototypes) prototype.material.dispose();
  const shadowOnly = new THREE7.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const clouds = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE7.Mesh(prototypes[rng.int(0, 1)].geometry, shadowOnly);
    mesh.name = "cloud shadow";
    mesh.castShadow = true;
    mesh.position.set(rng.range(span.minX, span.maxX), rng.range(altitude[0], altitude[1]), rng.range(span.minZ, span.maxZ));
    mesh.scale.setScalar(rng.range(1.5, 2.3));
    mesh.rotation.y = rng.range(-0.5, 0.5);
    group.add(mesh);
    clouds.push({ mesh, speed: rng.range(0.5, 0.95) });
  }
  return {
    group,
    /**
     * @param {number} dt secondes écoulées depuis l'image précédente
     * @param {THREE.Vector3} [center] monde sans bord : les nuages dérivent dans l'emprise donnée, recentrée sur ce
     *   point (le promeneur) ; un nuage qui sort d'un côté revient de l'autre
     */
    update(dt, center) {
      const wind = sharedUniforms.uWindDir.value;
      const strength = sharedUniforms.uWindStrength.value;
      for (const cloud of clouds) {
        const position = cloud.mesh.position;
        position.x += wind.x * cloud.speed * strength * dt;
        position.z += wind.y * cloud.speed * strength * dt;
        if (center) {
          const width = span.maxX - span.minX;
          const depth = span.maxZ - span.minZ;
          const x = position.x - center.x;
          const z = position.z - center.z;
          if (x > span.maxX) position.x -= width * Math.ceil((x - span.maxX) / width);
          else if (x < span.minX) position.x += width * Math.ceil((span.minX - x) / width);
          if (z > span.maxZ) position.z -= depth * Math.ceil((z - span.maxZ) / depth);
          else if (z < span.minZ) position.z += depth * Math.ceil((span.minZ - z) / depth);
          continue;
        }
        if (position.x > span.maxX) position.x = span.minX;
        else if (position.x < span.minX) position.x = span.maxX;
        if (position.z > span.maxZ) position.z = span.minZ;
        else if (position.z < span.minZ) position.z = span.maxZ;
      }
    },
    dispose() {
      for (const prototype of prototypes) prototype.geometry.dispose();
      shadowOnly.dispose();
      group.clear();
    }
  };
}

// src/worlds/kit/terrain.js
import * as THREE8 from "three";
function groundNormal(height, x, z, target, e = 0.4) {
  const dx = (height(x + e, z) - height(x - e, z)) / (2 * e);
  const dz = (height(x, z + e) - height(x, z - e)) / (2 * e);
  return target.set(-dx, 1, -dz).normalize();
}
function buildIslandBand({ bounds, top, bottom, spacing = 0.5 }) {
  const positions = [];
  const normals = [];
  const index = [];
  const { minX, maxX, minZ, maxZ } = bounds;
  const sides = [
    { from: [minX, minZ], to: [maxX, minZ], normal: [0, 0, -1] },
    { from: [maxX, minZ], to: [maxX, maxZ], normal: [1, 0, 0] },
    { from: [maxX, maxZ], to: [minX, maxZ], normal: [0, 0, 1] },
    { from: [minX, maxZ], to: [minX, minZ], normal: [-1, 0, 0] }
  ];
  for (const side of sides) {
    const length = Math.hypot(side.to[0] - side.from[0], side.to[1] - side.from[1]);
    const n = Math.max(1, Math.round(length / spacing));
    const start = positions.length / 3;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = side.from[0] + (side.to[0] - side.from[0]) * t;
      const z = side.from[1] + (side.to[1] - side.from[1]) * t;
      positions.push(x, top(x, z), z, x, bottom(x, z), z);
      normals.push(...side.normal, ...side.normal);
    }
    for (let k = 0; k < n; k++) {
      const a = start + k * 2;
      const b = a + 2;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE8.BufferGeometry();
  geometry.setAttribute("position", new THREE8.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE8.Float32BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}
function buildIslandUnderside({ bounds, top, depth, noise, spacing = 2, rings = 10 }) {
  const { minX, maxX, minZ, maxZ } = bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const half = Math.max(maxX - minX, maxZ - minZ) / 2;
  const perimeter = [];
  const corners = [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
  for (let s = 0; s < 4; s++) {
    const [ax, az] = corners[s];
    const [bx, bz] = corners[(s + 1) % 4];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / spacing));
    for (let k = 0; k < n; k++) perimeter.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
  }
  const count = perimeter.length;
  const grid = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const row = [];
    for (const [px, pz] of perimeter) {
      const angle = Math.atan2(pz - cz, px - cx);
      if (r === 0) {
        row.push([px, top(px, pz), pz]);
        continue;
      }
      const round = Math.min(1, t * 1.6);
      const shape = 1 - Math.pow(t, 0.95);
      const wobble = 0.82 + 0.36 * noise(Math.cos(angle) * 40 + r * 7.1, Math.sin(angle) * 40 - r * 3.3);
      const radius = shape * wobble;
      const sx = cx + ((px - cx) * (1 - round) + Math.cos(angle) * half * 0.92 * round) * radius;
      const sz = cz + ((pz - cz) * (1 - round) + Math.sin(angle) * half * 0.92 * round) * radius;
      const lobe = 0.75 + 0.5 * noise(Math.cos(angle) * 18 + 5, Math.sin(angle) * 18 - 9);
      const y = top(px, pz) * (1 - t) - depth * Math.pow(t, 0.9) * lobe - (noise(sx * 0.3, sz * 0.3) - 0.5) * 2.5 * (1 - t);
      row.push([sx, y, sz]);
    }
    grid.push(row);
  }
  const positions = [];
  const push = (v) => positions.push(v[0], v[1], v[2]);
  for (let r = 0; r < rings; r++) {
    for (let k = 0; k < count; k++) {
      const a = grid[r][k];
      const b = grid[r][(k + 1) % count];
      const c = grid[r + 1][(k + 1) % count];
      const d = grid[r + 1][k];
      push(a);
      push(b);
      push(d);
      push(b);
      push(c);
      push(d);
    }
  }
  const last = grid[rings];
  const tip = [cx, -depth * 1.08, cz];
  for (let k = 0; k < count; k++) {
    push(last[k]);
    push(last[(k + 1) % count]);
    push(tip);
  }
  const geometry = new THREE8.BufferGeometry();
  geometry.setAttribute("position", new THREE8.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
function buildGroundPatch({ size, spacing = 0.5, origin, height }) {
  const n = Math.max(1, Math.round(size / spacing));
  const step = size / n;
  const half = size / 2;
  const [ox, oz] = origin;
  const side = n + 3;
  const heights = new Float32Array(side * side);
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) heights[i * side + j] = height(ox - half + (j - 1) * step, oz - half + (i - 1) * step);
  }
  const count = (n + 1) * (n + 1);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const ground = new Float32Array(count * 2);
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const v = i * (n + 1) + j;
      const g = (i + 1) * side + (j + 1);
      const x = -half + j * step;
      const z = -half + i * step;
      positions[v * 3] = x;
      positions[v * 3 + 1] = heights[g];
      positions[v * 3 + 2] = z;
      const dx = (heights[g + 1] - heights[g - 1]) / (2 * step);
      const dz = (heights[g + side] - heights[g - side]) / (2 * step);
      const len = Math.hypot(dx, 1, dz);
      normals[v * 3] = -dx / len;
      normals[v * 3 + 1] = 1 / len;
      normals[v * 3 + 2] = -dz / len;
      ground[v * 2] = ox + x;
      ground[v * 2 + 1] = oz + z;
    }
  }
  const index = new Uint16Array(n * n * 6);
  const at = (i, j) => i * (n + 1) + j;
  let k = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const quad = (i + j) % 2 === 0 ? [at(i, j), at(i + 1, j), at(i, j + 1), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1)] : [at(i, j), at(i + 1, j + 1), at(i, j + 1), at(i, j), at(i + 1, j), at(i + 1, j + 1)];
      index.set(quad, k);
      k += 6;
    }
  }
  const geometry = new THREE8.BufferGeometry();
  geometry.setAttribute("position", new THREE8.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE8.BufferAttribute(normals, 3));
  geometry.setAttribute("aGround", new THREE8.BufferAttribute(ground, 2));
  geometry.setIndex(new THREE8.BufferAttribute(index, 1));
  return geometry;
}

// src/worlds/summer-meadow-endless.js
import * as THREE22 from "three";

// src/worlds/kit/streaming-scatter.js
import * as THREE9 from "three";
var _frustum2 = new THREE9.Frustum();
var _viewProjection2 = new THREE9.Matrix4();
var _identity = new THREE9.Matrix4();
var StreamingScatter = class {
  /**
   * @param {object} options
   * @param {number} options.chunkSize côté d'un morceau (m), multiple du côté des cases de chaque famille
   * @param {(x: number, z: number) => number} [options.heightAt] hauteur du sol (bornes des cases au plus juste)
   * @param {Record<string, {cellSize: number, height: number, margin: number}>} [options.classes] familles de
   *   couches, comme pour `ScatterField`
   */
  constructor({
    chunkSize,
    heightAt = () => 0,
    classes = {
      fine: { cellSize: 4, height: 1.6, margin: 1.6 },
      low: { cellSize: 8, height: 3, margin: 3.5 },
      tall: { cellSize: 4, height: 15, margin: 8.5 }
    }
  }) {
    this.chunkSize = chunkSize;
    this.heightAt = heightAt;
    this.group = new THREE9.Group();
    this.group.name = "streaming scatter";
    this.layers = [];
    this.classes = {};
    this.fraction = 1;
    this._dirty = true;
    this._chunk = null;
    for (const [name, { cellSize, height, margin }] of Object.entries(classes)) {
      const per = Math.round(chunkSize / cellSize);
      if (Math.abs(per * cellSize - chunkSize) > 1e-6) throw new Error(`streaming-scatter : ${chunkSize} m n'est pas un multiple de ${cellSize} m`);
      this.classes[name] = { name, cellSize, per, height, margin, cells: [], visible: [], previous: [] };
    }
  }
  /**
   * Déclare une couche à partir d'un asset modèle (même contrat que `ScatterField.addLayer`).
   * @returns {{add: (matrix: THREE.Matrix4) => void, index: number, triangles: number}}
   */
  addLayer(prototype, { reach = "low", thin = false, castShadow, skip = [] } = {}) {
    const parts = [];
    prototype.updateMatrixWorld(true);
    prototype.traverse((child) => {
      if (!child.isMesh) return;
      if (skip.includes(child.name)) {
        disposeObject(child);
        return;
      }
      parts.push(child);
    });
    const cls = this.classes[reach];
    const layer = {
      name: prototype.name,
      reach,
      thin,
      index: this.layers.length,
      meshes: [],
      matrices: null,
      capacity: 0,
      triangles: 0,
      add: (matrix) => {
        const chunk = this._chunk;
        const e = matrix.elements;
        const col = THREE9.MathUtils.clamp(Math.floor((e[12] - chunk.minX) / cls.cellSize), 0, cls.per - 1);
        const row = THREE9.MathUtils.clamp(Math.floor((e[14] - chunk.minZ) / cls.cellSize), 0, cls.per - 1);
        const lists = chunk.pending[reach][row * cls.per + col];
        (lists[layer.index] ??= []).push(...e);
      }
    };
    for (const part of parts) {
      const geometry = part.geometry;
      layer.triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      const mesh = new THREE9.InstancedMesh(geometry, part.material, 0);
      mesh.name = `${layer.name} / ${part.name}`;
      mesh.customDepthMaterial = part.customDepthMaterial;
      mesh.castShadow = castShadow ?? part.castShadow;
      mesh.receiveShadow = part.receiveShadow;
      mesh.frustumCulled = false;
      mesh.visible = false;
      mesh.matrixAutoUpdate = false;
      limitShadowCopies(mesh);
      if (!part.matrixWorld.equals(_identity)) mesh.matrix.copy(part.matrixWorld);
      layer.meshes.push(mesh);
      this.group.add(mesh);
    }
    this._grow(layer, 256);
    this.layers.push(layer);
    return layer;
  }
  /**
   * Commence un morceau : les `add` qui suivent lui appartiennent, jusqu'à `endChunk`.
   * @param {number} minX coin du morceau (m)
   * @param {number} minZ
   */
  beginChunk(minX, minZ) {
    const pending = {};
    for (const [name, cls] of Object.entries(this.classes)) {
      pending[name] = Array.from({ length: cls.per * cls.per }, () => []);
    }
    this._chunk = { minX, minZ, pending };
  }
  /**
   * Fige le morceau en cours et le met en jeu.
   * @param {{next: () => number}} rng mélange l'ordre des copies fines de chaque case
   * @returns {object} le morceau, à rendre à `removeChunk`
   */
  endChunk(rng) {
    const { minX, minZ, pending } = this._chunk;
    this._chunk = null;
    const chunk = { cells: [] };
    for (const [name, cls] of Object.entries(this.classes)) {
      pending[name].forEach((lists, index) => {
        if (!lists.some(Boolean)) return;
        const x = minX + index % cls.per * cls.cellSize;
        const z = minZ + Math.floor(index / cls.per) * cls.cellSize;
        let low = Infinity;
        let high = -Infinity;
        for (let k = 0; k < 9; k++) {
          const h = this.heightAt(x + k % 3 / 2 * cls.cellSize, z + Math.floor(k / 3) / 2 * cls.cellSize);
          low = Math.min(low, h);
          high = Math.max(high, h);
        }
        const cell = {
          cls,
          box: new THREE9.Box3(
            new THREE9.Vector3(x - cls.margin, low - 0.3, z - cls.margin),
            new THREE9.Vector3(x + cls.cellSize + cls.margin, high + 0.2 + cls.height, z + cls.cellSize + cls.margin)
          ),
          // Une liste de matrices par couche (null : rien de cette couche dans la case).
          data: lists.map((list, layerIndex) => {
            if (!list) return null;
            const array = new Float32Array(list);
            if (this.layers[layerIndex].thin) shuffleMatrices2(array, rng);
            return array;
          }),
          dither: cellDither2(x, z),
          distance: 0
          // à la caméra, à la dernière image (tri des ombres)
        };
        cls.cells.push(cell);
        chunk.cells.push(cell);
      });
    }
    this._dirty = true;
    return chunk;
  }
  /** Retire un morceau : ses copies ne sont plus dessinées, ses matrices sont libérées. */
  removeChunk(chunk) {
    const gone = new Set(chunk.cells);
    for (const cls of Object.values(this.classes)) {
      if (cls.cells.some((cell) => gone.has(cell))) cls.cells = cls.cells.filter((cell) => !gone.has(cell));
    }
    chunk.cells.length = 0;
    this._dirty = true;
  }
  /**
   * À appeler à chaque image avant le rendu (mêmes règles que `ScatterField.update`) : `fraction` ne dépend que
   * du cadrage, jamais de ce qui est dans la vue, sinon l'herbe clignoterait pendant la marche.
   * @param {THREE.Camera} camera
   * @param {number} [fraction] part des copies dessinées dans les couches fines (0..1)
   * @param {object} [options] pour une caméra perspective (vue à la 3e personne)
   * @param {Record<string, number>} [options.reach] portée par famille (m) : au-delà de cette distance à la
   *   caméra, les cases de la famille ne sont pas dessinées (l'herbe lointaine ne fait qu'un pixel)
   * @param {number} [options.shadowReach] seules les copies à moins de cette distance de la caméra (m) projettent
   *   leur ombre : les copies sont alors rangées de la plus proche à la plus lointaine
   */
  update(camera, fraction = 1, { reach = null, shadowReach = Infinity } = {}) {
    _viewProjection2.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum2.setFromProjectionMatrix(_viewProjection2);
    const step = Math.round(THREE9.MathUtils.clamp(fraction, 0.1, 1) * 20) / 20;
    let changed = step !== this.fraction || this._dirty;
    this._dirty = false;
    this.fraction = step;
    for (const [name, cls] of Object.entries(this.classes)) {
      const { cells, visible, previous } = cls;
      const limit = reach?.[name] ?? Infinity;
      let length = 0;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!_frustum2.intersectsBox(cell.box)) continue;
        const distance = limit === Infinity && shadowReach === Infinity ? 0 : cell.box.distanceToPoint(camera.position);
        if (distance >= limit) continue;
        cell.distance = distance;
        visible[length++] = cell;
      }
      visible.length = length;
      let same = length === previous.length;
      for (let i = 0; same && i < length; i++) same = visible[i] === previous[i];
      if (!same) {
        previous.length = length;
        for (let i = 0; i < length; i++) previous[i] = visible[i];
        changed = true;
      }
    }
    if (changed || shadowReach !== this._shadowReach) this._refill(step, shadowReach);
    this._shadowReach = shadowReach;
    return changed;
  }
  /** Copies et triangles dessinés à cet instant (hors passe d'ombre). */
  stats() {
    let instances = 0;
    let triangles = 0;
    let drawCalls = 0;
    for (const layer of this.layers) {
      const count = layer.meshes[0]?.count ?? 0;
      instances += count;
      triangles += count * layer.triangles;
      if (count > 0) drawCalls += layer.meshes.length;
    }
    let cells = 0;
    for (const cls of Object.values(this.classes)) cells += cls.cells.length;
    return { instances, triangles, drawCalls, cells };
  }
  dispose() {
    for (const layer of this.layers) {
      for (const mesh of layer.meshes) {
        disposeObject(mesh);
        mesh.dispose();
      }
    }
    this.group.clear();
    this.layers = [];
    for (const cls of Object.values(this.classes)) cls.cells = cls.visible = cls.previous = [];
  }
  /** Agrandit le tampon de matrices d'une couche (rare : la place gagnée sert aux morceaux suivants). */
  _grow(layer, capacity) {
    const matrices = new THREE9.InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
    matrices.setUsage(THREE9.DynamicDrawUsage);
    for (const mesh of layer.meshes) {
      if (layer.matrices) mesh.dispose();
      mesh.instanceMatrix = matrices;
    }
    layer.matrices = matrices;
    layer.capacity = capacity;
  }
  _refill(fraction, shadowReach = Infinity) {
    const trim = shadowReach !== Infinity;
    if (trim) for (const cls of Object.values(this.classes)) cls.visible.sort(byDistance);
    for (const layer of this.layers) {
      const cls = this.classes[layer.reach];
      const visible = cls.visible;
      const thinned = layer.thin && fraction < 1;
      let needed = 0;
      for (let i = 0; i < visible.length; i++) {
        const cell = visible[i].data[layer.index];
        if (!cell) continue;
        const total = cell.length / 16;
        needed += thinned ? Math.floor(total * fraction + ditherFor(visible[i], layer.index)) : total;
      }
      if (needed > layer.capacity) this._grow(layer, Math.ceil(needed * 1.5));
      const array = layer.matrices.array;
      let offset = 0;
      let shadowOffset = trim ? -1 : -16;
      for (let i = 0; i < visible.length; i++) {
        if (shadowOffset === -1 && visible[i].distance > shadowReach) shadowOffset = offset;
        const cell = visible[i].data[layer.index];
        if (!cell) continue;
        const total = cell.length / 16;
        const count = thinned ? Math.floor(total * fraction + ditherFor(visible[i], layer.index)) : total;
        if (count === 0) continue;
        array.set(count === total ? cell : cell.subarray(0, count * 16), offset);
        offset += count * 16;
      }
      layer.matrices.clearUpdateRanges();
      if (offset > 0) {
        layer.matrices.addUpdateRange(0, offset);
        layer.matrices.needsUpdate = true;
      }
      if (shadowOffset === -1) shadowOffset = offset;
      for (const mesh of layer.meshes) {
        mesh.count = offset / 16;
        mesh.visible = offset > 0;
        mesh.userData.shadowCount = shadowOffset / 16;
      }
    }
  }
};
var byDistance = (a, b) => a.distance - b.distance;
function cellDither2(x, z) {
  const value = Math.sin(x * 12.9898 + z * 4.1414) * 43758.5453;
  return value - Math.floor(value);
}
function ditherFor(cell, layerIndex) {
  const value = Math.sin(cell.dither * 91.7 + layerIndex * 78.233) * 43758.5453;
  return value - Math.floor(value);
}
function shuffleMatrices2(array, rng) {
  const count = array.length / 16;
  const swap = new Float32Array(16);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    if (i === j) continue;
    swap.set(array.subarray(i * 16, i * 16 + 16));
    array.copyWithin(i * 16, j * 16, j * 16 + 16);
    array.set(swap, j * 16);
  }
}

// src/worlds/summer-meadow-rules.js
import * as THREE21 from "three";

// src/assets/nature/plants/flower-clump.js
import * as THREE10 from "three";
var params3 = {
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
var meta3 = {
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
  params: params3,
  variants: variantsOf("species", params3.species)
};
var TAU = Math.PI * 2;
var FLEX = 0.3;
var HEART_LIFT = 0.03;
var HEART = starOutline(8);
var UP = new THREE10.Vector3(0, 1, 0);
var SPECIES = {
  daisy: { height: 0.45, head: 0.12, heart: 0.05, outline: starOutline(12, 0.8), leaves: 7, curve: 0.08, stretch: [1, 0.85] },
  poppy: { height: 0.55, head: 0.12, heart: 0.045, outline: starOutline(5, 0.86), leaves: 6, curve: 0.18, stretch: [1, 0.8] },
  cornflower: { height: 0.5, head: 0.1, heart: 0.04, outline: starOutline(8, 0.62), leaves: 5, curve: 0.1, stretch: [1, 0.9] },
  buttercup: { height: 0.35, head: 0.085, heart: 0.032, outline: starOutline(5, 0.86), leaves: 8, curve: 0.12, stretch: [1, 0.85] },
  lavender: { height: 0.5, head: 0.042, heart: 0, outline: starOutline(5), leaves: 12, curve: 0.05, stretch: [1, 1.3], spike: 5 }
};
var LAVENDER_LEAVES = ["#2e3f4a", "#455a5a", "#647a6a", "#8ea084", "#bfc8a6"];
function create3(given = {}) {
  const p = resolveParams(meta3.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const kind = SPECIES[p.species];
  const colors = FLOWERS[p.species];
  const lavender = p.species === "lavender";
  const H = kind.height * p.height;
  const season = p.season;
  const spread = shape.range(0.35, 0.6) * (lavender ? 1.2 : 1);
  const leanAngle = shape.range(0, TAU);
  const lean = new THREE10.Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle)).multiplyScalar(shape.range(0, 0.18) * H);
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
    const out = new THREE10.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const reach = Math.sqrt(shape.next());
    const base = out.clone().multiplyScalar(footRadius * reach);
    const h = H * (1 - unevenness * shape.next()) * (season === "winter" ? 0.85 : 1);
    const side = new THREE10.Vector3(-out.z, 0, out.x).multiplyScalar(shape.range(-1, 1) * kind.curve * h);
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
    const out = new THREE10.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const base = out.clone().multiplyScalar(footRadius * shape.range(0, 0.7));
    const length = (lavender ? 0.22 : 0.18) * shape.range(0.7, 1.2) * p.height;
    const rise = lavender ? shape.range(0.5, 0.9) : shape.range(0.25, 0.55);
    const tip = base.clone().addScaledVector(out, length * (1 - rise * 0.5)).addScaledVector(UP, length * rise);
    const bend = base.clone().addScaledVector(out, length * 0.3).addScaledVector(UP, length * rise * 0.9);
    blade(base, bend, tip, lavender ? 0.065 : 0.09, 0, out.clone().addScaledVector(UP, 1.2).normalize(), 0.3, 0.1);
  }
  const sway = { amplitude: 0.07 * H, height: H };
  const group = new THREE10.Group();
  group.name = meta3.name;
  const addMesh = (name, geometry, material) => {
    geometry.computeBoundingSphere();
    geometry.boundingSphere.radius += 0.15;
    const mesh = new THREE10.Mesh(geometry, material);
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
  group.userData.asset = { id: meta3.id, params: p, stems: stemCount, flowers: petals.length };
  return group;
}

// src/assets/nature/plants/grass-tuft.js
import * as THREE11 from "three";
var params4 = {
  seed: seedParam("Change le port de la touffe : pench\xE9e ou dress\xE9e, ouverte ou serr\xE9e, brins plus longs d'un c\xF4t\xE9."),
  season: seasonParam("Vert tendre au printemps, blond en automne, paille grise et couch\xE9e en hiver."),
  kind: choiceParam(
    "Herbe",
    { meadow: "Herbe des pr\xE9s", tall: "Hautes herbes \xE0 \xE9pis" },
    "Herbe des pr\xE9s : touffe basse et fournie. Hautes herbes : tiges deux fois plus hautes, avec des \xE9pis."
  ),
  height: numberParam("Hauteur", 0.5, 0.2, 1, "Hauteur des plus longs brins (doubl\xE9e pour les hautes herbes).", { step: 0.05, unit: "m" }),
  fullness: numberParam("Densit\xE9", 1, 0.5, 1.6, "Nombre de brins (et de triangles).")
};
var meta4 = {
  id: "nature/plants/grass-tuft",
  name: "Touffe d'herbe",
  nameEn: "Grass tuft",
  category: "nature",
  subcategory: "plants",
  description: "Touffe d'herbe en \xE9ventail : brins effil\xE9s sombres au pied et clairs \xE0 la pointe, qui ploient au vent. Herbe des pr\xE9s ou hautes herbes \xE0 \xE9pis, quatre saisons ; la graine change le port de la touffe.",
  tags: [
    "herbe",
    "touffe d'herbe",
    "brins",
    "hautes herbes",
    "\xE9pis",
    "plante",
    "v\xE9g\xE9tation",
    "vent",
    "saisons",
    "ext\xE9rieur",
    "grass",
    "grass tuft",
    "blades",
    "tall grass",
    "seed heads",
    "plant",
    "vegetation",
    "wind",
    "seasons",
    "outdoor",
    "procedural"
  ],
  biomes: ["meadow", "forest", "garden", "village", "swamp", "mountain", "beach"],
  version: 1,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au sol, au c\u0153ur de la touffe",
  footprint: { radius: 0.85, height: 1.35 },
  animated: ["wind"],
  params: params4,
  variants: variantsOf("season", params4.season)
};
var TAU2 = Math.PI * 2;
var UP2 = new THREE11.Vector3(0, 1, 0);
var EAR = starOutline(6);
function create4(given = {}) {
  const p = resolveParams(meta4.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const tall = p.kind === "tall";
  const winter = p.season === "winter";
  const H = p.height * (tall ? 2 : 1) * (winter ? 0.8 : 1);
  const leanAngle = shape.range(0, TAU2);
  const lean = new THREE11.Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle)).multiplyScalar(shape.range(0, 0.32) * H);
  const spread = shape.range(0.5, 1.05);
  const longSide = shape.range(0, TAU2);
  const longBias = shape.range(0, 0.4);
  const footRadius = shape.range(0.05, 0.12) * Math.sqrt(p.height / 0.5);
  const droop = (winter ? 0.55 : 0.18) + shape.range(0, 0.2);
  const blades = [];
  const ears = [];
  const count = Math.round((tall ? 14 : 20) * p.fullness * shape.range(0.85, 1.2));
  for (let i = 0; i < count; i++) {
    const azimuth = i * 2.39996 + shape.range(-0.6, 0.6);
    const out = new THREE11.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const reach = Math.sqrt(shape.next());
    const base = out.clone().multiplyScalar(footRadius * reach);
    const side = 1 + longBias * Math.cos(azimuth - longSide);
    const h = H * side * (1 - 0.4 * reach) * shape.range(0.55, 1) / (1 + longBias) * (tall ? 1.25 : 1);
    const open = (0.15 + spread * reach) * h * shape.range(0.7, 1.3) * (tall ? 0.6 : 1);
    const sag = shape.chance(tall ? 0.6 : droop) ? shape.range(0.25, 0.5) : 0;
    const tip = base.clone().addScaledVector(out, open * (1 + sag)).addScaledVector(UP2, h * (1 - sag)).addScaledVector(lean, h / H);
    const bend = base.clone().addScaledVector(out, open * 0.3).addScaledVector(UP2, h * 0.75).addScaledVector(lean, h / H * 0.4);
    blades.push({
      base,
      bend,
      tip,
      width: shape.range(0.085, 0.12),
      normal: out.clone().addScaledVector(UP2, 1.1).normalize(),
      phase: detail.next(),
      variation: detail.next(),
      flex: detail.range(0.35, 0.6)
    });
  }
  if (tall) {
    const stems = Math.round(shape.int(3, 6) * Math.min(1.3, p.fullness));
    for (let i = 0; i < stems; i++) {
      const azimuth = shape.range(0, TAU2);
      const out = new THREE11.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
      const base = out.clone().multiplyScalar(footRadius * shape.range(0, 0.6));
      const h = H * shape.range(1, 1.25);
      const tip = base.clone().addScaledVector(out, h * shape.range(0.15, 0.4)).addScaledVector(UP2, h).addScaledVector(lean, 1.1);
      const bend = base.clone().addScaledVector(UP2, h * 0.6).addScaledVector(lean, 0.4);
      blades.push({
        base,
        bend,
        tip,
        width: 0.06,
        tipWidth: 0.045,
        normal: out.clone().addScaledVector(UP2, 1.1).normalize(),
        phase: detail.next(),
        variation: detail.next(),
        flex: 0.7,
        baseOcclusion: 0.3
      });
      const direction = tip.clone().sub(bend).normalize();
      ears.push({
        position: tip.clone().addScaledVector(direction, 0.07),
        outline: EAR,
        size: 0.1,
        stretch: [0.45, 1],
        rotation: -Math.atan2(direction.x + direction.z * 0.5, direction.y) * 0.6,
        normal: UP2,
        phase: detail.next(),
        variation: 1,
        flex: 0.8
      });
    }
  }
  const parts = [buildBladeGeometry(blades, { segments: tall ? 3 : 2 })];
  if (ears.length) parts.push(buildFanGeometry(ears));
  const geometry = parts.length > 1 ? mergeGeometries(parts) : parts[0];
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 0.2;
  const material = createToonMaterial({
    ramp: GRASSES[p.season].ramp,
    steps: [0.24, 0.42, 0.6, 0.78],
    foliage: true,
    leafShade: [0.14, 0.5],
    id: 12,
    sway: { amplitude: 0.06 * H, height: H }
  });
  const mesh = new THREE11.Mesh(geometry, material);
  mesh.name = "grass";
  mesh.customDepthMaterial = material.userData.depthMaterial;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const group = new THREE11.Group();
  group.name = meta4.name;
  group.add(mesh);
  group.userData.asset = { id: meta4.id, params: p, blades: blades.length };
  return group;
}

// src/assets/nature/rocks/boulder.js
import * as THREE12 from "three";

// src/assets/kit/ground-cover.js
function snowMound(rng, noise, { radius, height, offset = [0, 0, 0], rotation = 0, drifts = 0 }) {
  const relief = (x, z) => (noise(x * 1.8 + offset[0], 0.5, z * 1.8 + offset[2]) - 0.5) * height * 1.1;
  const parts = [
    buildMound(rng, { radius, height, lobes: 0.4, power: 0.9, relief, rings: 7, sectors: 22, offset, rotation })
  ];
  for (let i = 0; i < drifts; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const reach = rng.range(0.45, 0.75);
    const k = rng.range(0.4, 0.6);
    parts.push(
      buildMound(rng, {
        radius: [radius[0] * k, radius[1] * k],
        height: height * rng.range(0.7, 1.2),
        lobes: 0.3,
        power: 0.9,
        rings: 4,
        sectors: 14,
        offset: [offset[0] + Math.cos(angle) * radius[0] * reach, offset[1], offset[2] + Math.sin(angle) * radius[1] * reach],
        rotation: rng.range(0, Math.PI * 2)
      })
    );
  }
  return parts.length === 1 ? parts[0] : mergeGeometries(parts);
}
function mossMound(rng, noise, { radius, height = 0.05, cushions = 6, offset = [0, 0, 0], rotation = 0 }) {
  const relief = (x, z) => (noise(x * 4 + offset[0], 2.5, z * 4 + offset[2]) - 0.5) * 0.05;
  const parts = [buildMound(rng, { radius, height, lobes: 0.4, power: 0.4, relief, rings: 4, sectors: 20, offset, rotation })];
  const size = Math.min(radius[0], radius[1]);
  for (let i = 0; i < cushions; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const reach = Math.sqrt(rng.next()) * 0.62;
    const r = size * rng.range(0.18, 0.34);
    parts.push(
      buildMound(rng, {
        radius: [r, r * rng.range(0.75, 1)],
        height: height + r * rng.range(0.7, 1),
        lobes: 0.2,
        power: 0.45,
        rings: 3,
        sectors: 10,
        offset: [offset[0] + Math.cos(angle) * radius[0] * reach, offset[1], offset[2] + Math.sin(angle) * radius[1] * reach],
        rotation: rng.range(0, Math.PI * 2)
      })
    );
  }
  return mergeGeometries(parts);
}
function dirtMound(rng, noise, { radius, height, clods = 6, offset = [0, 0, 0], rotation = 0 }) {
  const relief = (x, z) => (noise(x * 2.4 + offset[0], 4.5, z * 2.4 + offset[2]) - 0.5) * height * 0.9;
  const parts = [buildMound(rng, { radius, height, lobes: 0.3, power: 0.9, relief, rings: 5, sectors: 16, flat: true, offset, rotation })];
  for (let i = 0; i < clods; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const reach = rng.range(0.55, 1.08);
    const r = Math.max(0.08, Math.min(radius[0], radius[1]) * rng.range(0.1, 0.2));
    const x = offset[0] + Math.cos(angle) * radius[0] * reach;
    const z = offset[2] + Math.sin(angle) * radius[1] * reach;
    const rest = height * Math.max(0, 1 - reach * reach) * 0.8;
    parts.push(
      buildRock(rng, {
        detail: 0,
        lumps: 2,
        lumpSize: 0.2,
        cuts: 2,
        cutDepth: [0.7, 0.9],
        scale: [r, r * rng.range(0.55, 0.8), r * rng.range(0.8, 1.1)],
        rotation: [rng.range(-0.4, 0.4), rng.range(0, Math.PI * 2), rng.range(-0.4, 0.4)],
        offset: [x, offset[1] + rest + r * 0.3, z],
        floorY: offset[1] - 0.02
      })
    );
  }
  return mergeGeometries(parts);
}
function snowCap(geometry, noise, { amount: amount2 = 0, thickness = 0.08, minY = -Infinity } = {}) {
  return buildDrape(
    geometry,
    (p, n) => p.y < minY ? -1 : (n.y - 0.5 + amount2 * 0.35) * 2.4 + (noise(p.x * 2.2, p.y * 2.2, p.z * 2.2) - 0.5) * 1.1,
    { subdivisions: 3, lift: (w) => 0.014 + Math.min(1, w * 1.5) * thickness }
  );
}
function mossCap(geometry, noise, { amount: amount2 = 0, minY = -Infinity } = {}) {
  return buildDrape(
    geometry,
    (p, n) => p.y < minY ? -1 : (n.y - 0.55 + amount2 * 0.4) * 1.4 + (noise(p.x * 2.6 + 9, p.y * 2.6, p.z * 2.6) - 0.5) * 2.4,
    { subdivisions: 3, lift: (w, p) => 0.012 + Math.min(1, w * 3) * 0.035 * noise(p.x * 8, p.y * 8 + 3, p.z * 8) }
  );
}
function coverMaterial(kind, variant, { seed = 0, id = 11 } = {}) {
  if (kind === "snow") {
    const snow = SNOWS[variant ?? "fresh"];
    return createToonMaterial({ ramp: snow.ramp, ink: snow.ink, steps: [0.42, 0.62, 0.8], pattern: "speckle", patternParams: [16, 0.03, 0.15, 0.3], seed, id });
  }
  if (kind === "moss") {
    const moss = MOSSES[variant ?? "summer"];
    return createToonMaterial({ ramp: moss.ramp, ink: moss.ink, steps: [0.36, 0.58, 0.8], pattern: "speckle", patternParams: [16, 0.1, 0.2, 1], seed, id });
  }
  const ground = GROUNDS[variant ?? "dirt"];
  return createToonMaterial({ ramp: ground.ramp, ink: ground.ink, steps: [0.32, 0.55, 0.76], pattern: "speckle", patternParams: [16, 0.07, 0.2, 1], seed, id });
}

// src/assets/nature/rocks/boulder.js
var params5 = {
  seed: seedParam("Change la silhouette : rond, haut ou trapu, facettes, inclinaison, cailloux au pied."),
  stone: stoneParam("Type de pierre : couleurs et grain.", { only: ["granite", "sandstone", "limestone", "basalt", "slate"] }),
  cover: coverParam("Mousse ou neige drap\xE9es sur le dessus du rocher, et pos\xE9es au sol autour."),
  size: numberParam("Hauteur", 1.1, 0.4, 2.5, "Hauteur du rocher ; tout garde ses proportions.", { step: 0.1, unit: "m" }),
  roughness: numberParam("Taille de la pierre", 1, 0, 1.5, "0 = galet arrondi, 1,5 = bloc tr\xE8s taill\xE9.")
};
var meta5 = {
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
  version: 2,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au sol, au centre du rocher",
  footprint: { radius: 1.9, height: 1.2 },
  animated: [],
  params: params5,
  variants: variantsOf("stone", params5.stone)
};
function create5(given = {}) {
  const p = resolveParams(meta5.params, given);
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
  const group = new THREE12.Group();
  group.name = meta5.name;
  const rock = mergeGeometries(parts);
  if (p.cover !== "bare") {
    const cover = createRng(p.seed * 31337 + 5);
    const noise = createNoise3(p.seed + 101);
    const layers = [];
    if (p.cover === "snow") {
      layers.push(snowCap(rock, noise, { amount: -0.15, thickness: 0.07 * Math.min(1.5, h), minY: h * 0.15 }));
      layers.push(
        snowMound(cover, noise, {
          radius: [width * 1.5, depth * 1.5],
          height: 0.1 * Math.min(1.5, h),
          rotation: cover.range(0, Math.PI * 2),
          drifts: cover.int(1, 2)
        })
      );
    } else {
      layers.push(mossCap(rock, noise, { amount: 0, minY: h * 0.12 }));
      const patches = cover.int(0, 2);
      for (let i = 0; i < patches; i++) {
        const angle = cover.range(0, Math.PI * 2);
        const r = width * cover.range(0.35, 0.6);
        const reach = width * cover.range(0.7, 1);
        layers.push(
          mossMound(cover, noise, {
            radius: [r, r * cover.range(0.6, 0.9)],
            height: 0.035,
            cushions: cover.int(2, 4),
            offset: [Math.cos(angle) * reach, 0, Math.sin(angle) * reach * (depth / width)],
            rotation: cover.range(0, Math.PI * 2)
          })
        );
      }
    }
    const coverMesh = new THREE12.Mesh(mergeGeometries(layers), coverMaterial(p.cover, void 0, { seed: detail.int(0, 96), id: 11 }));
    coverMesh.name = p.cover;
    coverMesh.castShadow = true;
    coverMesh.receiveShadow = true;
    group.add(coverMesh);
  }
  const stoneMesh = new THREE12.Mesh(
    rock,
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
  group.userData.asset = { id: meta5.id, params: p };
  return group;
}

// src/assets/nature/rocks/buried-rock.js
import * as THREE13 from "three";
var params6 = {
  seed: seedParam("Change la silhouette : dalle plate ou bosse, inclinaison, part qui d\xE9passe, talus de terre."),
  stone: stoneParam("Type de pierre : couleurs et grain.", { only: ["granite", "sandstone", "limestone", "basalt", "slate"] }),
  cover: coverParam("Mousse ou neige drap\xE9es sur le dessus de la roche et sur le talus."),
  size: numberParam("Largeur", 1.6, 0.5, 3.5, "Largeur de la partie visible ; tout garde ses proportions.", { step: 0.1, unit: "m" }),
  emergence: numberParam("Affleurement", 0.5, 0.2, 0.8, "Part de la roche qui sort du sol (0,2 = \xE0 peine visible).")
};
var meta6 = {
  id: "nature/rocks/buried-rock",
  name: "Roche enterr\xE9e",
  nameEn: "Buried rock",
  category: "nature",
  subcategory: "rocks",
  description: "Roche \xE0 facettes \xE0 moiti\xE9 enterr\xE9e, qui affleure en dalle inclin\xE9e au milieu d'un talus de terre. Cinq pierres, nue, moussue ou enneig\xE9e ; la graine change l'inclinaison et la forme, l'affleurement se r\xE8gle.",
  tags: [
    "roche",
    "rocher",
    "pierre",
    "dalle",
    "affleurement",
    "enterr\xE9",
    "min\xE9ral",
    "terre",
    "facettes",
    "mousse",
    "neige",
    "ext\xE9rieur",
    "buried rock",
    "rock",
    "stone",
    "outcrop",
    "slab",
    "embedded",
    "mineral",
    "dirt",
    "moss",
    "snow",
    "outdoor",
    "procedural"
  ],
  biomes: ["forest", "meadow", "mountain", "desert", "snow", "garden", "village", "swamp", "cave"],
  version: 2,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au sol, au centre de la roche",
  footprint: { radius: 1.7, height: 0.8 },
  animated: [],
  params: params6,
  variants: variantsOf("stone", params6.stone)
};
var FLOOR = -0.03;
function create6(given = {}) {
  const p = resolveParams(meta6.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const stone = STONES[p.stone];
  const radius = p.size / 2 / Math.sqrt(1 - (1 - p.emergence) ** 2 * 0.8);
  const rx = radius * shape.range(0.9, 1.1);
  const rz = radius * shape.range(0.6, 0.95);
  const ry = radius * shape.range(0.55, 0.85);
  const tiltX = shape.range(-0.45, 0.45);
  const tiltZ = shape.range(-0.45, 0.45);
  const rock = buildRock(shape, {
    detail: 1,
    lumps: 4,
    lumpSize: 0.14,
    cuts: 8,
    cutDepth: [0.6, 0.88],
    scale: [rx, ry, rz],
    rotation: [tiltX, shape.range(0, Math.PI * 2), tiltZ],
    offset: [0, ry * (2 * p.emergence - 1), 0],
    floorY: FLOOR
  });
  rock.computeBoundingBox();
  const box = rock.boundingBox;
  const spanX = Math.max(-box.min.x, box.max.x);
  const spanZ = Math.max(-box.min.z, box.max.z);
  const noise = createNoise3(p.seed + 101);
  const talus = dirtMound(shape, noise, {
    radius: [spanX * 1.15 + 0.12, spanZ * 1.15 + 0.12],
    height: Math.min(0.16, 0.08 * p.size) + 0.04,
    clods: shape.int(3, 6)
  });
  const group = new THREE13.Group();
  group.name = meta6.name;
  if (p.cover !== "bare") {
    const cover = createRng(p.seed * 31337 + 5);
    const layers = [];
    if (p.cover === "snow") {
      layers.push(snowCap(rock, noise, { amount: -0.2, thickness: 0.06, minY: 0.08 }));
      layers.push(
        snowMound(cover, noise, {
          radius: [spanX * 1.3 + 0.15, spanZ * 1.3 + 0.15],
          height: 0.08,
          rotation: cover.range(0, Math.PI * 2),
          drifts: cover.int(0, 2)
        })
      );
    } else {
      layers.push(mossCap(rock, noise, { amount: 0, minY: 0.04 }));
      const patches = cover.int(1, 2);
      for (let i = 0; i < patches; i++) {
        const angle = cover.range(0, Math.PI * 2);
        const r = spanX * cover.range(0.35, 0.55);
        layers.push(
          mossMound(cover, noise, {
            radius: [r, r * cover.range(0.6, 0.9)],
            height: 0.06,
            cushions: cover.int(2, 4),
            offset: [Math.cos(angle) * spanX * 1, 0.04, Math.sin(angle) * spanZ * 1],
            rotation: cover.range(0, Math.PI * 2)
          })
        );
      }
    }
    const coverMesh = new THREE13.Mesh(mergeGeometries(layers), coverMaterial(p.cover, void 0, { seed: detail.int(0, 96), id: 11 }));
    coverMesh.name = p.cover;
    coverMesh.castShadow = true;
    coverMesh.receiveShadow = true;
    group.add(coverMesh);
  }
  const stoneMesh = new THREE13.Mesh(
    rock,
    createToonMaterial({ ramp: stone.ramp, ink: stone.ink, steps: [0.36, 0.58, 0.8], crease: true, pattern: "speckle", patternParams: [16, 0.05, 0.2, 1], seed: detail.int(0, 96), id: 10 })
  );
  stoneMesh.name = "stone";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
  if (p.cover !== "snow") {
    const dirtMesh = new THREE13.Mesh(talus, coverMaterial("dirt", "dirt", { seed: detail.int(0, 96), id: 12 }));
    dirtMesh.name = "dirt";
    dirtMesh.receiveShadow = true;
    group.add(dirtMesh);
  } else {
    talus.dispose();
  }
  group.userData.asset = { id: meta6.id, params: p };
  return group;
}

// src/assets/nature/terrain/dirt-mound.js
import * as THREE14 from "three";
var params7 = {
  seed: seedParam("Change le contour, les bosses et la place des mottes."),
  soil: choiceParam("Sol", GROUNDS, "Terre brune, argile rouge ou boue sombre."),
  size: numberParam("Largeur", 1.4, 0.4, 3, "Largeur de la butte.", { step: 0.1, unit: "m" }),
  height: numberParam("Hauteur", 0.3, 0.05, 0.6, "Hauteur au centre.", { step: 0.05, unit: "m" })
};
var meta7 = {
  id: "nature/terrain/dirt-mound",
  name: "Terre remu\xE9e",
  nameEn: "Dirt mound",
  category: "nature",
  subcategory: "terrain",
  description: "Butte de terre fra\xEEchement remu\xE9e, bossel\xE9e, entour\xE9e de mottes. Terre, argile ou boue ; la graine change la forme et les mottes.",
  tags: [
    "terre",
    "terre remu\xE9e",
    "butte",
    "motte",
    "tas",
    "argile",
    "boue",
    "sol",
    "terrain",
    "chantier",
    "jardin",
    "ext\xE9rieur",
    "dirt",
    "dirt mound",
    "mound",
    "clod",
    "pile",
    "clay",
    "mud",
    "soil",
    "ground",
    "digging",
    "outdoor",
    "procedural"
  ],
  biomes: ["garden", "village", "forest", "meadow", "swamp", "desert"],
  version: 1,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au sol, au centre de la butte",
  footprint: { radius: 0.7, height: 0.35 },
  animated: [],
  params: params7,
  variants: variantsOf("soil", params7.soil)
};
function create7(given = {}) {
  const p = resolveParams(meta7.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const noise = createNoise3(p.seed);
  const half = p.size / 2;
  const mesh = new THREE14.Mesh(
    dirtMound(shape, noise, {
      radius: [half * 0.8, half * 0.8 * shape.range(0.65, 0.95)],
      height: p.height * (p.soil === "mud" ? 0.6 : 1),
      clods: shape.int(4, 8),
      rotation: shape.range(0, Math.PI * 2)
    }),
    coverMaterial("dirt", p.soil, { seed: detail.int(0, 96), id: 12 })
  );
  mesh.name = "dirt";
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  const group = new THREE14.Group();
  group.name = meta7.name;
  group.add(mesh);
  group.userData.asset = { id: meta7.id, params: p };
  return group;
}

// src/assets/nature/terrain/lawn.js
import * as THREE15 from "three";
var params8 = {
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
var meta8 = {
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
  params: params8,
  variants: variantsOf("season", params8.season)
};
var TAU3 = Math.PI * 2;
var UP3 = new THREE15.Vector3(0, 1, 0);
var DAISY = starOutline(5, 0.55);
var CUTS = {
  mown: { spacing: 0.085, height: [0.07, 0.13], segments: 1, open: 0.25, flowers: 0 },
  long: { spacing: 0.11, height: [0.16, 0.3], segments: 2, open: 0.55, flowers: 0 },
  wild: { spacing: 0.1, height: [0.06, 0.46], segments: 2, open: 0.45, flowers: 1 }
};
function create8(given = {}) {
  const p = resolveParams(meta8.params, given);
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
    sodGeometry = buildMound(shape, { radius, height: 0.035, lobes: 0.3, power: 0.25, relief, rings: 4, sectors: 22, rotation: shape.range(0, TAU3) });
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
      const base = new THREE15.Vector3(x, 0, z);
      const azimuth = detail.range(0, TAU3);
      const out = new THREE15.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
      let h = THREE15.MathUtils.lerp(cut.height[0], cut.height[1], p.cut === "mown" ? detail.next() : Math.min(1, v * 1.3 * detail.range(0.5, 1.1)));
      h *= heightScale;
      const open = h * cut.open * detail.range(0.4, 1.2) * (winter ? 1.6 : 1);
      const tip = base.clone().addScaledVector(out, open).addScaledVector(UP3, h * (winter ? 0.75 : 1));
      if (tile) {
        tip.x = THREE15.MathUtils.clamp(tip.x, -half, half);
        tip.z = THREE15.MathUtils.clamp(tip.z, -half, half);
      }
      blades.push({
        base,
        bend: base.clone().addScaledVector(out, open * 0.25).addScaledVector(UP3, h * 0.7),
        tip,
        width: detail.range(0.075, 0.1),
        normal: out.clone().addScaledVector(UP3, 1.3).normalize(),
        phase: detail.next(),
        variation: detail.next(),
        flex: p.cut === "mown" ? 0.15 : detail.range(0.3, 0.55),
        baseOcclusion: 0.15
      });
      if (cut.flowers && !winter && v < 0.55 && detail.chance(p.season === "autumn" ? 0.05 : 0.14)) {
        flowers.push({
          position: base.clone().add(new THREE15.Vector3(detail.range(-0.03, 0.03), cut.height[1] * heightScale * detail.range(0.55, 0.85), detail.range(-0.03, 0.03))),
          outline: DAISY,
          size: detail.range(0.075, 0.095),
          rotation: detail.range(0, TAU3),
          normal: new THREE15.Vector3(detail.range(-0.3, 0.3), 1, detail.range(-0.3, 0.3)).normalize(),
          phase: detail.next(),
          variation: detail.next(),
          flex: 0.3
        });
      }
    }
  }
  const group = new THREE15.Group();
  group.name = meta8.name;
  const sod = new THREE15.Mesh(
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
  const bladeMesh = new THREE15.Mesh(bladeGeometry, bladeMaterial);
  bladeMesh.name = "grass";
  bladeMesh.customDepthMaterial = bladeMaterial.userData.depthMaterial;
  bladeMesh.castShadow = p.cut !== "mown";
  bladeMesh.receiveShadow = true;
  group.add(bladeMesh);
  if (flowers.length) {
    const flowerMaterial = createToonMaterial({ ramp: FLOWERS.daisy.petals, steps: [0.25, 0.45, 0.65], foliage: true, leafShade: [0.1, 0], id: 11, sway });
    const flowerMesh = new THREE15.Mesh(buildFanGeometry(flowers), flowerMaterial);
    flowerMesh.name = "daisies";
    flowerMesh.customDepthMaterial = flowerMaterial.userData.depthMaterial;
    flowerMesh.receiveShadow = true;
    group.add(flowerMesh);
  }
  group.userData.asset = { id: meta8.id, params: p, blades: blades.length, flowers: flowers.length };
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

// src/assets/nature/terrain/moss-patch.js
import * as THREE16 from "three";
var params9 = {
  seed: seedParam("Change le contour du tapis, le nombre et la place des coussinets."),
  season: seasonParam("Vert tendre au printemps, olive et ocre en automne, terne en hiver."),
  size: numberParam("Largeur", 1.2, 0.3, 3, "Largeur du tapis.", { step: 0.1, unit: "m" }),
  cushions: numberParam("Coussinets", 6, 0, 14, "Nombre de coussinets bomb\xE9s.", { step: 1 })
};
var meta9 = {
  id: "nature/terrain/moss-patch",
  name: "Tapis de mousse",
  nameEn: "Moss patch",
  category: "nature",
  subcategory: "terrain",
  description: "Tapis de mousse pos\xE9 au sol, au contour d\xE9coup\xE9, sem\xE9 de coussinets ronds. Quatre saisons ; la graine change le contour et les coussinets.",
  tags: [
    "mousse",
    "tapis de mousse",
    "coussinet",
    "sol",
    "terrain",
    "v\xE9g\xE9tation",
    "sous-bois",
    "saisons",
    "ext\xE9rieur",
    "moss",
    "moss patch",
    "cushion",
    "ground",
    "vegetation",
    "undergrowth",
    "seasons",
    "outdoor",
    "procedural"
  ],
  biomes: ["forest", "swamp", "garden", "cave", "meadow"],
  version: 1,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au sol, au centre du tapis",
  footprint: { radius: 0.6, height: 0.2 },
  animated: [],
  params: params9,
  variants: variantsOf("season", params9.season)
};
function create9(given = {}) {
  const p = resolveParams(meta9.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const noise = createNoise3(p.seed);
  const half = p.size / 2;
  const mesh = new THREE16.Mesh(
    mossMound(shape, noise, {
      radius: [half * 0.85, half * 0.85 * shape.range(0.65, 0.95)],
      height: 0.04,
      cushions: Math.round(p.cushions),
      rotation: shape.range(0, Math.PI * 2)
    }),
    coverMaterial("moss", p.season, { seed: detail.int(0, 96), id: 11 })
  );
  mesh.name = "moss";
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  const group = new THREE16.Group();
  group.name = meta9.name;
  group.add(mesh);
  group.userData.asset = { id: meta9.id, params: p };
  return group;
}

// src/assets/nature/trees/birch.js
var birch_exports = {};
__export(birch_exports, {
  create: () => create10,
  dispose: () => disposeObject,
  meta: () => meta10,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE17 from "three";
var params10 = {
  seed: seedParam("Change la silhouette : inclinaison du tronc, branches, touffes."),
  season: seasonParam("Couleur et densit\xE9 du feuillage ; l'hiver, l'arbre est nu."),
  height: numberParam("Hauteur", 7.5, 5, 9.5, "Hauteur du tronc ; tout l'arbre garde ses proportions.", { step: 0.5, unit: "m" }),
  fullness: numberParam("Densit\xE9 du feuillage", 1, 0.5, 1.4, "Quantit\xE9 de feuilles (et de triangles).")
};
var meta10 = {
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
  params: params10,
  variants: variantsOf("season", params10.season)
};
var BARK_RAMP = ["#77728f", "#b0aec2", "#e0dfe6", "#fbf8ee"];
var BARK_INK = "#2a2233";
var SEASONS2 = {
  spring: { ramp: ["#2a6350", "#3f8a52", "#63ad55", "#96cf5e", "#d2ec84"], density: 0.78, leafSize: 0.92 },
  summer: { ramp: ["#1d4945", "#2a6947", "#3f8d45", "#6db348", "#b3da5b"], density: 1, leafSize: 1 },
  autumn: { ramp: ["#7b3d1d", "#b3651e", "#da9422", "#f2bf3a", "#ffe889"], density: 0.86, leafSize: 1 },
  winter: { ramp: ["#1d4945", "#2a6947", "#3f8d45", "#6db348", "#b3da5b"], density: 0, leafSize: 1 }
};
var TAU4 = Math.PI * 2;
var UP4 = new THREE17.Vector3(0, 1, 0);
var lerp = THREE17.MathUtils.lerp;
function create10(params14 = {}) {
  const p = resolveParams(meta10.params, params14);
  const season = SEASONS2[p.season];
  const rng = createRng(p.seed * 7919 + 17);
  const s = p.height / 7.5;
  const leanAzimuth = rng.range(0, TAU4);
  const lean = rng.range(0.2, 0.55) * s;
  const trunkPoints = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const wobble = i === 0 ? 0 : 0.11 * s;
    trunkPoints.push(
      new THREE17.Vector3(
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
    const out = new THREE17.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const length = lerp(2.5, 0.95, Math.pow(u, 1.1)) * rng.range(0.85, 1.15) * s;
    const rise = lerp(0.3, 0.55, u) * length;
    const points = [
      start,
      start.clone().addScaledVector(out, length * 0.35).addScaledVector(UP4, rise),
      start.clone().addScaledVector(out, length * 0.75).addScaledVector(UP4, rise + length * 0.2),
      start.clone().addScaledVector(out, length).addScaledVector(UP4, rise + length * 0.06)
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
      const direction = new THREE17.Vector3(Math.cos(side), rng.range(0.1, 0.5), Math.sin(side)).normalize();
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
  clumps.push({ center: top.clone().add(new THREE17.Vector3(0, 0.15 * s, 0)), radius: 0.58 * s, hanging: false });
  const crownStart = rng.range(0, TAU4);
  for (let i = 0; i < 5; i++) {
    const angle = crownStart + i * 2.39996;
    const center = trunkCurve.getPoint(0.56 + i * 0.085);
    const reach = lerp(0.75, 0.4, i / 4) * s;
    center.x += Math.cos(angle) * reach;
    center.z += Math.sin(angle) * reach;
    clumps.push({ center, radius: lerp(0.8, 0.55, i / 4) * s, hanging: false });
  }
  const sway = { amplitude: 0.09 * s, height: p.height };
  const group = new THREE17.Group();
  group.name = meta10.name;
  const woodMesh = new THREE17.Mesh(
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
    const shadeNormal = (position, direction) => direction.clone().addScaledVector(position.clone().sub(canopyCenter).normalize(), 0.4).addScaledVector(UP4, 0.25).normalize();
    const DOWN2 = new THREE17.Vector3(0, -1, 0);
    for (const clump of clumps) {
      const { center, radius } = clump;
      for (const rotation of [0, Math.PI]) {
        leaves.push({ position: center, normal: DOWN2, size: radius * 0.44, rotation, phase: rng.next(), occlusion: 0, variation: 0, flex: 0.3 });
      }
      const count = Math.round(density * 105 * radius * radius);
      for (let i = 0; i < count; i++) {
        const y = rng.range(-1, 1);
        const angle = rng.range(0, TAU4);
        const ring = Math.sqrt(1 - y * y);
        const direction = new THREE17.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
        const k = 0.4 + 0.6 * Math.sqrt(rng.next());
        const position = center.clone().add(direction.clone().multiply(new THREE17.Vector3(radius * k, radius * k * 0.85, radius * k)));
        if (y < 0) position.y -= y * y * radius * 0.35;
        leaves.push({
          position,
          normal: shadeNormal(position, direction),
          size: leafSize(),
          rotation: rng.range(-0.9, 0.9),
          phase: rng.next(),
          occlusion: THREE17.MathUtils.smoothstep(k, 0.4, 0.95) * (0.8 + 0.2 * (y * 0.5 + 0.5)),
          variation: rng.next(),
          flex: rng.range(0.55, 1)
        });
      }
      if (clump.hanging) {
        const strands = rng.int(1, 3);
        for (let j = 0; j < strands; j++) {
          const angle = rng.range(0, TAU4);
          const reach = rng.range(0.2, 0.75) * radius;
          const position = center.clone().add(new THREE17.Vector3(Math.cos(angle) * reach, -radius * 0.7, Math.sin(angle) * reach));
          const direction = new THREE17.Vector3(Math.cos(angle), -0.2, Math.sin(angle)).normalize();
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
        const angle = rng.range(0, TAU4);
        const distance = rng.range(0.4, 2.8) * s;
        leaves.push({
          position: new THREE17.Vector3(Math.cos(angle) * distance, 0.04, Math.sin(angle) * distance),
          normal: UP4,
          size: leafSize(),
          rotation: rng.range(0, TAU4),
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
    const leafMesh = new THREE17.Mesh(leafGeometry, leafMaterial);
    leafMesh.name = "leaves";
    leafMesh.customDepthMaterial = leafMaterial.userData.depthMaterial;
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    group.add(leafMesh);
  }
  group.userData.asset = { id: meta10.id, params: p, leaves: leaves.length };
  return group;
}

// src/assets/nature/trees/linden.js
var linden_exports = {};
__export(linden_exports, {
  create: () => create11,
  dispose: () => disposeObject,
  meta: () => meta11,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE19 from "three";

// src/assets/kit/foliage.js
import * as THREE18 from "three";
var TAU5 = Math.PI * 2;
var UP5 = new THREE18.Vector3(0, 1, 0);
var DOWN = new THREE18.Vector3(0, -1, 0);
function leafNormal(position, direction, canopyCenter, canopyWeight = 0.4) {
  return direction.clone().addScaledVector(position.clone().sub(canopyCenter).normalize(), canopyWeight).addScaledVector(UP5, 0.25).normalize();
}
function fillClump(rng, leaves, {
  center,
  radius,
  count,
  canopyCenter,
  leafSize,
  squash = 0.85,
  sag = 0.35,
  canopyWeight = 0.4,
  core = true,
  flex = [0.55, 1],
  coreSize = 0.44,
  shell = 0.4
}) {
  if (core) {
    for (const rotation of [0, Math.PI]) {
      leaves.push({ position: center, normal: DOWN, size: radius * coreSize, rotation, phase: rng.next(), occlusion: 0, variation: 0, flex: 0.3 });
    }
  }
  const surface = [];
  const scale = new THREE18.Vector3();
  for (let i = 0; i < count; i++) {
    const y = rng.range(-1, 1);
    const angle = rng.range(0, TAU5);
    const ring = Math.sqrt(1 - y * y);
    const direction = new THREE18.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
    const k = shell + (1 - shell) * Math.sqrt(rng.next());
    scale.set(radius * k, radius * k * squash, radius * k);
    const position = center.clone().add(direction.clone().multiply(scale));
    if (y < 0) position.y -= y * y * radius * sag;
    leaves.push({
      position,
      normal: leafNormal(position, direction, canopyCenter, canopyWeight),
      size: leafSize(),
      rotation: rng.range(-0.9, 0.9),
      phase: rng.next(),
      occlusion: THREE18.MathUtils.smoothstep(k, shell, 0.95) * (0.8 + 0.2 * (y * 0.5 + 0.5)),
      variation: rng.next(),
      flex: rng.range(flex[0], flex[1])
    });
    if (k > 0.85) surface.push({ position, direction });
  }
  return surface;
}
function fallenLeaves(rng, leaves, { count, minRadius, maxRadius, leafSize }) {
  for (let i = 0; i < count; i++) {
    const angle = rng.range(0, TAU5);
    const distance = rng.range(minRadius, maxRadius);
    leaves.push({
      position: new THREE18.Vector3(Math.cos(angle) * distance, 0.04, Math.sin(angle) * distance),
      normal: UP5,
      size: leafSize(),
      rotation: rng.range(0, TAU5),
      phase: rng.next(),
      occlusion: 1,
      variation: rng.next(),
      flex: 0
    });
  }
}

// src/assets/nature/trees/linden.js
var params11 = {
  seed: seedParam("Change la silhouette : ogive plus ou moins large, penchant de la couronne, branches, rejets au pied."),
  season: seasonParam("Couleur du feuillage ; fleurs jaune p\xE2le l'\xE9t\xE9, or \xE0 l'automne, nu l'hiver."),
  height: numberParam("Hauteur", 10, 7, 13, "Hauteur de l'arbre ; tout l'arbre garde ses proportions.", { step: 0.5, unit: "m" }),
  fullness: numberParam("Densit\xE9 du feuillage", 1, 0.5, 1.3, "Quantit\xE9 de feuilles (et de triangles).")
};
var meta11 = {
  id: "nature/trees/linden",
  name: "Tilleul",
  nameEn: "Linden tree",
  category: "nature",
  subcategory: "trees",
  description: "Tilleul au tronc droit et gris, couronne dense et r\xE9guli\xE8re en ogive ; fleurs jaune p\xE2le en \xE9t\xE9, feuillage dor\xE9 en automne, rejets au pied. Quatre saisons, forme diff\xE9rente pour chaque graine.",
  tags: [
    "tilleul",
    "arbre",
    "feuillu",
    "v\xE9g\xE9tation",
    "couronne en ogive",
    "tronc droit",
    "fleurs",
    "floraison",
    "feuillage",
    "vent",
    "saisons",
    "place de village",
    "ext\xE9rieur",
    "linden",
    "lime tree",
    "tree",
    "deciduous",
    "vegetation",
    "dense crown",
    "flowers",
    "blossom",
    "foliage",
    "wind",
    "seasons",
    "outdoor",
    "procedural"
  ],
  biomes: ["village", "garden", "meadow", "forest"],
  version: 1,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au pied du tronc, au niveau du sol",
  footprint: { radius: 4.1, height: 10.2 },
  animated: ["wind"],
  params: params11,
  variants: variantsOf("season", params11.season)
};
var BARK_RAMP2 = ["#4c4655", "#6f6870", "#958d8a", "#bab1a3"];
var BARK_INK2 = "#2b2430";
var FLOWER_RAMP = ["#b8ad52", "#dcd36a", "#f1eb98", "#fffbd6"];
var SEASONS3 = {
  spring: { ramp: ["#2a6345", "#448c49", "#6db64c", "#a6d85c", "#e2f394"], density: 0.85, leafSize: 0.9 },
  summer: { ramp: ["#1b463c", "#28653f", "#3f8b42", "#6cb147", "#b2db62"], density: 1, leafSize: 1, flowers: true },
  autumn: { ramp: ["#6a4a1e", "#9c731f", "#c99d25", "#e8c63c", "#fbec8c"], density: 0.84, leafSize: 1 },
  winter: { ramp: ["#1b463c", "#28653f", "#3f8b42", "#6cb147", "#b2db62"], density: 0, leafSize: 1 }
};
var TAU6 = Math.PI * 2;
var UP6 = new THREE19.Vector3(0, 1, 0);
var lerp2 = THREE19.MathUtils.lerp;
function create11(params14 = {}) {
  const p = resolveParams(meta11.params, params14);
  const season = SEASONS3[p.season];
  const rng = createRng(p.seed * 7919 + 31);
  const s = p.height / 10;
  const crownBottom = rng.range(2.4, 3.2) * s;
  const crownTop = p.height - 0.6 * s;
  const crownWidth = rng.range(3.1, 3.8) * s;
  const widest = rng.range(0.28, 0.4);
  const envelope = (u) => {
    if (u < widest) return crownWidth * (0.55 + 0.45 * Math.sin(u / widest * Math.PI * 0.5));
    const v = (u - widest) / (1 - widest);
    return crownWidth * Math.pow(Math.max(0, 1 - v * v), 0.62);
  };
  const crownLean = new THREE19.Vector3(rng.range(-0.35, 0.35) * s, 0, rng.range(-0.35, 0.35) * s);
  const trunkPoints = [];
  const leaderTop = crownBottom + (crownTop - crownBottom) * 0.82;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const wobble = i === 0 ? 0 : 0.06 * s;
    trunkPoints.push(new THREE19.Vector3(
      crownLean.x * t * t + rng.range(-wobble, wobble),
      leaderTop * t,
      crownLean.z * t * t + rng.range(-wobble, wobble)
    ));
  }
  const baseRadius = rng.range(0.3, 0.35) * s;
  const trunk = buildTube(
    trunkPoints,
    (t) => lerp2(baseRadius, baseRadius * 0.2, Math.pow(t, 1.1)) + baseRadius * 0.4 * Math.exp(-t * 18),
    { radialSegments: 7, lengthSegments: 12 }
  );
  const trunkCurve = trunk.userData.curve;
  const wood = [trunk];
  const clumps = [];
  const minRadius = 0.035;
  const crownAxis = (y) => {
    const t = THREE19.MathUtils.clamp(y / p.height, 0, 1);
    return new THREE19.Vector3(crownLean.x * t * t, y, crownLean.z * t * t);
  };
  const branchCount = rng.int(11, 14);
  for (let i = 0; i < branchCount; i++) {
    const u = i / (branchCount - 1);
    const startT = lerp2(crownBottom / leaderTop, 0.95, Math.pow(u, 0.95));
    const start = trunkCurve.getPoint(startT);
    const azimuth = i * 2.39996 + rng.range(-0.4, 0.4);
    const out = new THREE19.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const elevation = lerp2(0.55, 1.05, u) + rng.range(-0.1, 0.1);
    const tipY = Math.min(crownTop - 0.6 * s, start.y + Math.tan(elevation) * envelope((start.y - crownBottom) / (crownTop - crownBottom)) * 0.6);
    const reach = envelope((tipY - crownBottom) / (crownTop - crownBottom)) * rng.range(0.74, 0.88);
    const tip = crownAxis(tipY).addScaledVector(out, reach);
    const middle = start.clone().lerp(tip, 0.5);
    middle.y -= 0.12 * s;
    const points = [start, start.clone().lerp(middle, 0.5), middle, tip];
    const r0 = Math.max(minRadius, lerp2(0.1, 0.05, u) * s);
    const branch = buildTube(points, (t) => lerp2(r0, minRadius, t), { radialSegments: 5, lengthSegments: 5, vOffset: rng.range(3, 30) });
    wood.push(branch);
    const curve = branch.userData.curve;
    for (const [t, k] of [[0.55, 0.85], [1, 1]]) {
      clumps.push({ center: curve.getPoint(t).add(new THREE19.Vector3(0, 0.2 * s, 0)), radius: lerp2(1.15, 0.85, u) * k * rng.range(0.9, 1.1) * s });
    }
    for (let j = 0; j < 2; j++) {
      const from = curve.getPoint(rng.range(0.35, 0.8));
      const side = azimuth + (j === 0 ? 1 : -1) * rng.range(0.5, 1);
      const direction = new THREE19.Vector3(Math.cos(side), rng.range(0.6, 1.1), Math.sin(side)).normalize();
      const length = rng.range(0.6, 1) * s;
      const end = from.clone().addScaledVector(direction, length);
      wood.push(buildTube([from, from.clone().addScaledVector(direction, length * 0.5), end], () => minRadius, {
        radialSegments: 4,
        lengthSegments: 2,
        vOffset: rng.range(3, 30)
      }));
      if (j === 0) clumps.push({ center: end, radius: rng.range(0.6, 0.75) * s });
    }
  }
  const fillCount = 16;
  const fillStart = rng.range(0, TAU6);
  for (let i = 0; i < fillCount; i++) {
    const u = 0.12 + 0.82 * ((i + 0.5) / fillCount);
    const y = lerp2(crownBottom, crownTop, u);
    const angle = fillStart + i * 2.39996;
    const radius = lerp2(1.1, 0.75, u) * s;
    const reach = Math.max(0, envelope(u) - radius * 0.9);
    clumps.push({ center: crownAxis(y).add(new THREE19.Vector3(Math.cos(angle) * reach, 0, Math.sin(angle) * reach)), radius });
  }
  clumps.push({ center: crownAxis(crownTop - 0.55 * s), radius: 0.75 * s });
  const sprouts = [];
  if (rng.chance(0.7)) {
    const count = rng.int(2, 4);
    const start = rng.range(0, TAU6);
    for (let i = 0; i < count; i++) {
      const angle = start + i * rng.range(0.9, 1.6);
      const reach = baseRadius * 1.25;
      const base = new THREE19.Vector3(Math.cos(angle) * reach, 0, Math.sin(angle) * reach);
      const top = base.clone().add(new THREE19.Vector3(Math.cos(angle) * 0.15 * s, rng.range(0.45, 0.8) * s, Math.sin(angle) * 0.15 * s));
      wood.push(buildTube([base, base.clone().lerp(top, 0.5), top], () => minRadius, { radialSegments: 4, lengthSegments: 2 }));
      sprouts.push({ center: top.clone().add(new THREE19.Vector3(0, -0.05 * s, 0)), radius: rng.range(0.32, 0.42) * s });
    }
  }
  const sway = { amplitude: 0.07 * s, height: p.height };
  const group = new THREE19.Group();
  group.name = meta11.name;
  const woodMesh = new THREE19.Mesh(
    mergeGeometries(wood),
    createToonMaterial({
      ramp: BARK_RAMP2,
      steps: [0.3, 0.52, 0.76],
      ink: BARK_INK2,
      pattern: "furrow",
      patternParams: [16, 4, 0.05, 0.4],
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
  const flowers = [];
  if (season.density > 0) {
    const canopyCenter = crownAxis(lerp2(crownBottom, crownTop, 0.42));
    const density = season.density * p.fullness;
    const leafSize = () => rng.range(0.1, 0.16) * season.leafSize;
    const flowerRng = createRng(p.seed * 131 + 7);
    for (const clump of [...clumps, ...sprouts]) {
      const surface = fillClump(rng, leaves, {
        center: clump.center,
        radius: clump.radius,
        count: Math.round(density * 60 * clump.radius * clump.radius),
        canopyCenter,
        leafSize,
        squash: 0.9,
        sag: 0.2,
        canopyWeight: 0.55,
        coreSize: 0.48,
        shell: 0.5
      });
      if (season.flowers) {
        for (const { position, direction } of surface) {
          if (direction.y < -0.2 || !flowerRng.chance(0.36)) continue;
          const hang = position.clone().addScaledVector(direction, 0.06);
          const links = flowerRng.int(2, 3);
          for (let n = 0; n < links; n++) {
            hang.y -= 0.11;
            flowers.push({
              position: hang.clone().add(new THREE19.Vector3(flowerRng.range(-0.05, 0.05), 0, flowerRng.range(-0.05, 0.05))),
              normal: leafNormal(hang, direction, canopyCenter, 0.55),
              size: flowerRng.range(0.1, 0.13),
              rotation: flowerRng.range(0, TAU6),
              phase: flowerRng.next(),
              occlusion: 1,
              variation: flowerRng.next(),
              flex: 0.9
            });
          }
        }
      }
    }
    if (p.season === "autumn") {
      fallenLeaves(rng, leaves, { count: 40, minRadius: 0.5 * s, maxRadius: 3.2 * s, leafSize });
    }
    const addFoliage = (list, ramp, steps, name) => {
      const geometry = buildLeafGeometry(list);
      geometry.computeBoundingSphere();
      geometry.boundingSphere.radius += 0.6;
      const material = createToonMaterial({ ramp, steps, foliage: true, id: 11, sway });
      const mesh = new THREE19.Mesh(geometry, material);
      mesh.name = name;
      mesh.customDepthMaterial = material.userData.depthMaterial;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    addFoliage(leaves, season.ramp, [0.22, 0.42, 0.6, 0.78], "leaves");
    if (flowers.length > 0) addFoliage(flowers, FLOWER_RAMP, [0.3, 0.5, 0.7], "flowers");
  }
  group.userData.asset = { id: meta11.id, params: p, leaves: leaves.length, flowers: flowers.length };
  return group;
}

// src/assets/nature/trees/oak.js
var oak_exports = {};
__export(oak_exports, {
  create: () => create12,
  dispose: () => disposeObject,
  meta: () => meta12,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE20 from "three";
var params12 = {
  seed: seedParam("Change la silhouette : nombre et direction des grosses branches, torsions, masses de feuillage."),
  season: seasonParam("Couleur et densit\xE9 du feuillage ; l'hiver, il garde quelques feuilles mortes."),
  height: numberParam("Hauteur", 9, 6, 12, "Hauteur de l'arbre ; tout l'arbre garde ses proportions.", { step: 0.5, unit: "m" }),
  fullness: numberParam("Densit\xE9 du feuillage", 1, 0.5, 1.3, "Quantit\xE9 de feuilles (et de triangles).")
};
var meta12 = {
  id: "nature/trees/oak",
  name: "Ch\xEAne",
  nameEn: "Oak tree",
  category: "nature",
  subcategory: "trees",
  description: "Ch\xEAne trapu au tronc sombre et crevass\xE9, grosses branches tortueuses \xE9tal\xE9es, couronne large et bossel\xE9e en masses de feuillage. Quatre saisons (feuilles mortes gard\xE9es l'hiver), forme diff\xE9rente pour chaque graine.",
  tags: [
    "ch\xEAne",
    "arbre",
    "feuillu",
    "v\xE9g\xE9tation",
    "tronc crevass\xE9",
    "couronne large",
    "branches tortueuses",
    "feuillage",
    "feuilles mortes",
    "vent",
    "saisons",
    "ext\xE9rieur",
    "oak",
    "tree",
    "deciduous",
    "vegetation",
    "broad crown",
    "gnarled",
    "foliage",
    "wind",
    "seasons",
    "outdoor",
    "procedural"
  ],
  biomes: ["forest", "meadow", "village", "garden"],
  version: 1,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; l'origine est au pied du tronc, au niveau du sol",
  footprint: { radius: 5.8, height: 9.2 },
  animated: ["wind"],
  params: params12,
  variants: variantsOf("season", params12.season)
};
var BARK_RAMP3 = ["#33283a", "#544549", "#786559", "#9d8a72"];
var BARK_INK3 = "#1b141c";
var SEASONS4 = {
  spring: { ramp: ["#265743", "#3b7c47", "#5fa14a", "#96c656", "#d4e884"], density: 0.82, leafSize: 0.92 },
  summer: { ramp: ["#173a38", "#21533d", "#33723f", "#56953f", "#98c250"], density: 1, leafSize: 1 },
  autumn: { ramp: ["#4a2722", "#7b3b22", "#a65a25", "#cc8834", "#ebbb5e"], density: 0.86, leafSize: 1 },
  // Marcescence : le chêne garde des feuilles mortes, brunes et clairsemées, jusqu'au printemps.
  winter: { ramp: ["#3b2826", "#5d3b2b", "#83573a", "#a97a4c", "#cba36c"], density: 0.55, leafSize: 0.85 }
};
var TAU7 = Math.PI * 2;
var lerp3 = THREE20.MathUtils.lerp;
function create12(params14 = {}) {
  const p = resolveParams(meta12.params, params14);
  const season = SEASONS4[p.season];
  const rng = createRng(p.seed * 7919 + 23);
  const s = p.height / 9;
  const boleHeight = rng.range(2.3, 3.3) * s;
  const leanAzimuth = rng.range(0, TAU7);
  const lean = rng.range(0.1, 0.45) * s;
  const trunkPoints = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const wobble = i === 0 ? 0 : 0.14 * s;
    trunkPoints.push(new THREE20.Vector3(
      Math.cos(leanAzimuth) * lean * t + rng.range(-wobble, wobble),
      (boleHeight + 0.5 * s) * t,
      Math.sin(leanAzimuth) * lean * t + rng.range(-wobble, wobble)
    ));
  }
  const baseRadius = rng.range(0.46, 0.54) * s;
  const trunk = buildTube(
    trunkPoints,
    (t) => lerp3(baseRadius, baseRadius * 0.78, t) + baseRadius * 0.55 * Math.exp(-t * 10),
    { radialSegments: 8, lengthSegments: 8 }
  );
  const trunkCurve = trunk.userData.curve;
  const wood = [trunk];
  const clumps = [];
  const minRadius = 0.04;
  const limb = (start, azimuth, elevation, length, r0, r1, { kink = 0.22, droop = 0.15, sides = 6 } = {}) => {
    const direction = new THREE20.Vector3(
      Math.cos(azimuth) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(azimuth) * Math.cos(elevation)
    );
    const side = new THREE20.Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth));
    const points = [start.clone()];
    for (const t of [0.33, 0.66, 1]) {
      const point = start.clone().addScaledVector(direction, length * t);
      point.addScaledVector(side, rng.range(-kink, kink) * length * (t < 1 ? 1 : 0.5));
      point.y += rng.range(-kink, kink) * length * 0.5 - droop * length * t * t;
      points.push(point);
    }
    const tube = buildTube(points, (t) => lerp3(r0, r1, Math.pow(t, 0.8)), {
      radialSegments: sides,
      lengthSegments: 6,
      vOffset: rng.range(3, 30)
    });
    wood.push(tube);
    return tube.userData.curve;
  };
  const limbCount = rng.int(3, 5);
  const limbStart = rng.range(0, TAU7);
  const limbs = [];
  for (let i = 0; i < limbCount; i++) {
    limbs.push({
      azimuth: limbStart + i / limbCount * TAU7 + rng.range(-0.45, 0.45),
      elevation: rng.range(0.35, 0.8),
      length: rng.range(3, 4.2) * s,
      from: rng.range(0.78, 1)
    });
  }
  if (rng.chance(0.55)) {
    limbs.push({ azimuth: rng.range(0, TAU7), elevation: rng.range(0.08, 0.25), length: rng.range(3.4, 4.4) * s, from: rng.range(0.5, 0.65), low: true });
  }
  limbs.push({ azimuth: leanAzimuth + rng.range(-1, 1), elevation: rng.range(1.15, 1.4), length: rng.range(2.8, 3.6) * s, from: 1, leader: true });
  for (const L of limbs) {
    const start = trunkCurve.getPoint(L.from);
    const r0 = baseRadius * (L.leader ? 0.6 : rng.range(0.5, 0.62));
    const curve = limb(start, L.azimuth, L.elevation, L.length, r0, r0 * 0.4, { droop: L.leader ? 0 : 0.12 });
    const tip = curve.getPoint(1);
    clumps.push({ center: tip.clone().add(new THREE20.Vector3(0, 0.35 * s, 0)), radius: rng.range(1.35, 1.6) * s });
    const forks = L.leader ? 2 : rng.int(2, 3);
    for (let j = 0; j < forks; j++) {
      const t = lerp3(0.4, 0.82, forks === 1 ? 0.5 : j / (forks - 1)) + rng.range(-0.06, 0.06);
      const from = curve.getPoint(t);
      const sign = j % 2 === 0 ? 1 : -1;
      const azimuth = L.azimuth + sign * rng.range(0.55, 1.1);
      const elevation = L.leader ? rng.range(0.5, 0.8) : rng.range(0.45, 0.95);
      const length = L.length * rng.range(0.42, 0.58);
      const childCurve = limb(from, azimuth, elevation, length, Math.max(minRadius, r0 * 0.45), minRadius, { sides: 5, droop: 0.05 });
      const end = childCurve.getPoint(1);
      clumps.push({ center: end.clone().add(new THREE20.Vector3(0, 0.3 * s, 0)), radius: rng.range(1.15, 1.4) * s });
      if (L.low || rng.chance(0.35)) {
        clumps.push({ center: childCurve.getPoint(0.5).add(new THREE20.Vector3(0, 0.5 * s, 0)), radius: rng.range(0.95, 1.1) * s });
      }
    }
  }
  const crownBase = trunkCurve.getPoint(1);
  const fillStart = rng.range(0, TAU7);
  for (let i = 0; i < 4; i++) {
    const angle = fillStart + i * 2.39996;
    const reach = rng.range(1, 1.8) * s;
    clumps.push({
      center: crownBase.clone().add(new THREE20.Vector3(Math.cos(angle) * reach, rng.range(2, 2.9) * s, Math.sin(angle) * reach)),
      radius: rng.range(1.3, 1.55) * s
    });
  }
  const sway = { amplitude: 0.06 * s, height: p.height };
  const group = new THREE20.Group();
  group.name = meta12.name;
  const woodMesh = new THREE20.Mesh(
    mergeGeometries(wood),
    createToonMaterial({
      ramp: BARK_RAMP3,
      steps: [0.3, 0.52, 0.76],
      ink: BARK_INK3,
      pattern: "furrow",
      patternParams: [16, 3, 0.1, 0.2],
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
    const canopyCenter = crownBase.clone().add(new THREE20.Vector3(0, 2 * s, 0));
    const density = season.density * p.fullness;
    const leafSize = () => rng.range(0.12, 0.19) * season.leafSize;
    const winter = p.season === "winter";
    for (const clump of clumps) {
      if (winter && !rng.chance(0.4)) continue;
      const radius = winter ? clump.radius * 0.7 : clump.radius;
      fillClump(rng, leaves, {
        center: clump.center,
        radius,
        count: Math.round(density * 64 * radius * radius),
        canopyCenter,
        leafSize,
        squash: 0.78,
        sag: 0.1,
        canopyWeight: 0.3,
        core: p.season !== "winter",
        flex: [0.4, 0.8],
        coreSize: 0.5,
        shell: 0.55
      });
    }
    if (p.season === "autumn") {
      fallenLeaves(rng, leaves, { count: 48, minRadius: 0.6 * s, maxRadius: 4.2 * s, leafSize });
    }
    const leafGeometry = buildLeafGeometry(leaves);
    leafGeometry.computeBoundingSphere();
    leafGeometry.boundingSphere.radius += 0.6;
    const leafMaterial = createToonMaterial({
      ramp: season.ramp,
      steps: [0.24, 0.44, 0.62, 0.8],
      foliage: true,
      id: 11,
      sway
    });
    const leafMesh = new THREE20.Mesh(leafGeometry, leafMaterial);
    leafMesh.name = "leaves";
    leafMesh.customDepthMaterial = leafMaterial.userData.depthMaterial;
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    group.add(leafMesh);
  }
  group.userData.asset = { id: meta12.id, params: p, leaves: leaves.length };
  return group;
}

// src/worlds/summer-meadow-rules.js
var TILE = 16;
var SEASON = "summer";
var GROUND_ID = 11;
var GROUND_GRAIN = 10;
var FULL_DETAIL_AREA = 380;
var CELLS = { tree: 4, lawn: 3, tuft: 1, flower: 1.3 };
var MAX_TREE_SPACING = 7.5;
var MAX_CROWN = 5.6 * 1.18;
var TAU8 = Math.PI * 2;
var UP7 = new THREE21.Vector3(0, 1, 0);
var smoothstep = THREE21.MathUtils.smoothstep;
var SPECIES2 = {
  oak: { module: oak_exports, seeds: [3, 8], height: 11, scale: [0.82, 1.18], spacing: 7.5, crown: 5.6, trunk: 0.5 },
  linden: { module: linden_exports, seeds: [2, 5], height: 12.5, scale: [0.8, 1.18], spacing: 6.5, crown: 4.4, trunk: 0.42 },
  birch: { module: birch_exports, seeds: [1, 4], height: 9, scale: [0.8, 1.2], spacing: 3.4, crown: 3.2, trunk: 0.24 }
};
var FLOWERS2 = {
  daisy: { count: 5, bias: () => 0, threshold: 0.68, slot: 10, wavelength: 21 },
  poppy: { count: 5, bias: (wet) => (0.5 - wet) * 0.3, threshold: 0.69, slot: 11, wavelength: 25 },
  cornflower: { count: 5, bias: (wet) => (0.5 - wet) * 0.2, threshold: 0.7, slot: 12, wavelength: 19 },
  buttercup: { count: 6, bias: (wet) => (wet - 0.5) * 0.4, threshold: 0.7, slot: 13, wavelength: 17 },
  lavender: { count: 3, bias: (wet) => (0.5 - wet) * 0.45, threshold: 0.82, slot: 14, wavelength: 15 }
};
function meadowRules({ seed, relief, trees: treeAmount, flowers: flowerAmount }) {
  const RELIEF = THREE21.MathUtils.clamp(relief, 0.2, 3);
  const heightAt = groundHeight(seed, RELIEF);
  const noise = createNoise3(seed * 17 + 3);
  const field = (x, z, wavelength, slot) => noise(x / wavelength + slot * 19.7, slot * 3.1 + 0.5, z / wavelength - slot * 7.3);
  const fbm = (x, z, wavelength, slot) => field(x, z, wavelength, slot) * 0.65 + field(x, z, wavelength / 2.7, slot + 50) * 0.35;
  const flowerSpread = (flowerAmount - 1) * 0.05;
  return {
    RELIEF,
    heightAt,
    field,
    fbm,
    /**
     * Bosquets (0..1) : les arbres se serrent là où le champ est haut, et laissent de grandes clairières ailleurs.
     * Plus d'arbres : des bosquets plus étendus, pas seulement plus serrés.
     */
    grove: (x, z) => smoothstep(fbm(x, z, 44, 1) + (treeAmount - 1) * 0.12, 0.5, 0.68),
    /** Essence d'un arbre ; les arbres isolés sont surtout de grands chênes. */
    treeKind(x, z, grove, pick2) {
      if (grove > 0.2) {
        const essence = field(x, z, 75, 2);
        return essence < 0.4 ? "birch" : essence < 0.68 ? "oak" : "linden";
      }
      return pick2 < 0.55 ? "oak" : pick2 < 0.85 ? "linden" : "birch";
    },
    /** Creux humides (1) et bosses sèches (0). */
    moisture: (x, z) => (1 - heightAt(x, z) / RELIEF) * 0.55 + field(x, z, 32, 6) * 0.45,
    /** Chance qu'une touffe pousse (avant l'abondance d'herbe), selon l'ombre des couronnes (`open`). */
    tuftChance(x, z, open) {
      const vigor = fbm(x, z, 11, 3) * 0.7 + field(x, z, 48, 4) * 0.3;
      const chance = 0.22 + smoothstep(vigor, 0.36, 0.62);
      return open < 1 ? chance * 0.5 : chance;
    },
    /** Nappes de hautes herbes à épis (0..1). */
    tallZone: (x, z) => fbm(x, z, 27, 5),
    /** L'espèce de fleur la plus à sa place ici, et de combien elle dépasse son seuil. */
    flowerAt(x, z, wet, flowers) {
      let best = null;
      let bestValue = 0;
      for (const kind of Object.values(flowers)) {
        const value = fbm(x, z, kind.wavelength, kind.slot) + kind.bias(wet) - kind.threshold + flowerSpread;
        if (value > bestValue) {
          best = kind;
          bestValue = value;
        }
      }
      return { best, bestValue };
    }
  };
}
function createMeadowLayers(addLayer) {
  const addGroundCover = (prototype, { outlined = [], ...options } = {}) => {
    prototype.traverse((child) => {
      if (child.isMesh && !outlined.includes(child.name)) child.material.uniforms.uId.value = GROUND_ID;
    });
    return addLayer(prototype, { reach: "fine", thin: true, castShadow: false, ...options });
  };
  const species = {};
  for (const [name, kind] of Object.entries(SPECIES2)) {
    species[name] = {
      ...kind,
      layers: kind.seeds.map(
        (treeSeed) => addLayer(kind.module.create({ seed: treeSeed, season: SEASON, height: kind.height, fullness: 0.75 }), { reach: "tall" })
      )
    };
  }
  const boulders = [
    { seed: 1, size: 1.3 },
    { seed: 4, size: 1, cover: "moss" },
    { seed: 7, size: 0.6, roughness: 0.5 }
  ].map((given) => ({ ...given, layer: addLayer(create5({ stone: "granite", ...given }), { reach: "low" }) }));
  const slabs = [
    { seed: 2, size: 2.2 },
    { seed: 5, size: 1.4, cover: "moss" }
  ].map((given) => ({ ...given, layer: addLayer(create6({ stone: "granite", ...given }), { reach: "low" }) }));
  const lawns = [
    { cut: "wild", seed: 1, size: 2.8 },
    { cut: "wild", seed: 2, size: 2.2 },
    { cut: "long", seed: 3, size: 2.4 }
  ].map((given) => addGroundCover(create8({ season: SEASON, shape: "patch", fullness: 0.5, ...given }), { skip: ["sod"] }));
  const tufts = [1, 2, 3].map(
    (tuftSeed) => addGroundCover(create4({ seed: tuftSeed, season: SEASON, kind: "meadow", height: 0.5, fullness: 0.6 }))
  );
  const tallTufts = [4, 5].map(
    (tuftSeed) => addGroundCover(create4({ seed: tuftSeed, season: SEASON, kind: "tall", height: 0.42, fullness: 0.6 }))
  );
  const flowers = {};
  for (const [name, kind] of Object.entries(FLOWERS2)) {
    flowers[name] = {
      ...kind,
      layer: addGroundCover(create3({ seed: kind.slot, species: name, season: SEASON, count: kind.count }), { outlined: ["petals", "hearts"] })
    };
  }
  const moss = addLayer(create9({ seed: 3, season: SEASON, size: 1.4, cushions: 7 }), { reach: "low", castShadow: false });
  const molehill = addLayer(create7({ seed: 2, soil: "dirt", size: 0.75, height: 0.28 }), { reach: "low", castShadow: false });
  return { species, boulders, slabs, lawns, tufts, tallTufts, flowers, moss, molehill };
}
function createPlacer(heightAt) {
  const position = new THREE21.Vector3();
  const scaleVector = new THREE21.Vector3();
  const yawQuaternion = new THREE21.Quaternion();
  const tiltQuaternion = new THREE21.Quaternion();
  const normal = new THREE21.Vector3();
  const matrix = new THREE21.Matrix4();
  return (layer, x, z, { yaw = 0, scale = 1, tilt = false, sink = 0 } = {}) => {
    position.set(x, heightAt(x, z) - sink, z);
    yawQuaternion.setFromAxisAngle(UP7, yaw);
    if (tilt) tiltQuaternion.setFromUnitVectors(UP7, groundNormal(heightAt, x, z, normal)).multiply(yawQuaternion);
    else tiltQuaternion.copy(yawQuaternion);
    layer.add(matrix.compose(position, tiltQuaternion, scaleVector.setScalar(scale)));
  };
}

// src/worlds/summer-meadow-endless.js
var HALF = TILE / 2;
var smoothstep2 = THREE22.MathUtils.smoothstep;
var WINDOW = 7;
var NEED_MARGIN = 9;
var PREFETCH_MARGIN = 20;
var KEEP_MARGIN = 36;
var PREFETCH_BUDGET = 4;
var _frustum3 = new THREE22.Frustum();
var _viewProjection3 = new THREE22.Matrix4();
var _box = new THREE22.Box3();
var keyOf = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
function hash(...values) {
  let h = 2166136261;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 16777619);
    h ^= h >>> 15;
    h = Math.imul(h, 739982445);
    h ^= h >>> 12;
  }
  return (h >>> 0) % 2147483647;
}
function createEndlessMeadow({ seed = 1, relief = 1.8, trees: treeAmount = 1, rocks: rockAmount = 1, grass = 1, flowers: flowerAmount = 1 } = {}) {
  seed = THREE22.MathUtils.clamp(Math.round(seed) || 0, 0, 9999);
  const rules = meadowRules({ seed, relief, trees: treeAmount, flowers: flowerAmount });
  const { RELIEF, heightAt } = rules;
  const group = new THREE22.Group();
  group.name = "Prairie d'\xE9t\xE9 (infinie)";
  const counts = { trees: 0, rocks: 0, tufts: 0, flowers: 0, lawns: 0, patches: 0 };
  const sample = create({ seed, season: SEASON, finish: "pixel", tileX: 0, tileZ: 0, size: TILE, relief: RELIEF, dryness: 0.25 });
  const groundMaterial = sample.getObjectByName("ground").material;
  sample.getObjectByName("ground").geometry.dispose();
  disposeObject(sample.getObjectByName("skirt"));
  groundMaterial.uniforms.uSelfEdge.value = 4;
  groundMaterial.uniforms.uPattern.value.x = GROUND_GRAIN;
  const ground = new THREE22.Group();
  ground.name = "ground";
  group.add(ground);
  const scatter = new StreamingScatter({ chunkSize: TILE, heightAt });
  const { species, boulders, slabs, lawns, tufts, tallTufts, flowers, moss, molehill } = createMeadowLayers((prototype, options) => scatter.addLayer(prototype, options));
  group.add(scatter.group);
  const place = createPlacer(heightAt);
  const daylight = createDaylight();
  const cloudShadows = createCloudShadows(createRng(seed * 131 + 1), { bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 }, count: 8 });
  group.add(daylight.light, daylight.light.target, cloudShadows.group);
  const TREE_CELLS = TILE / CELLS.tree;
  const candidateMemo = /* @__PURE__ */ new Map();
  const treeMemo = /* @__PURE__ */ new Map();
  const candidatesOf = (cx, cz) => {
    const key = keyOf(cx, cz);
    let list = candidateMemo.get(key);
    if (list) return list;
    list = [];
    for (let j = 0; j < TREE_CELLS; j++) {
      for (let i = 0; i < TREE_CELLS; i++) {
        const rng = createRng(hash(seed, 1, cx * TREE_CELLS + i, cz * TREE_CELLS + j));
        const x = cx * TILE - HALF + (i + rng.next()) * CELLS.tree;
        const z = cz * TILE - HALF + (j + rng.next()) * CELLS.tree;
        const roll = rng.next();
        const pick2 = rng.next();
        const model = rng.next();
        const size = rng.next();
        const yaw = rng.range(0, TAU8);
        const priority = rng.next();
        const grove = rules.grove(x, z);
        if (roll > (0.015 + grove * 0.55) * treeAmount) continue;
        const name = rules.treeKind(x, z, grove, pick2);
        const kind = species[name];
        const scale = THREE22.MathUtils.lerp(kind.scale[0], kind.scale[1], size);
        list.push({ x, z, kind, name, scale, yaw, priority, layer: kind.layers[Math.floor(model * kind.layers.length)], crown: kind.crown * scale });
      }
    }
    candidateMemo.set(key, list);
    return list;
  };
  const treesOf = (cx, cz) => {
    const key = keyOf(cx, cz);
    let list = treeMemo.get(key);
    if (list) return list;
    const rivals = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) rivals.push(...candidatesOf(cx + dx, cz + dz));
    list = candidatesOf(cx, cz).filter(
      (tree) => !rivals.some((other) => other !== tree && other.priority > tree.priority && Math.hypot(other.x - tree.x, other.z - tree.z) < (other.kind.spacing + tree.kind.spacing) / 2)
    );
    treeMemo.set(key, list);
    return list;
  };
  if (MAX_TREE_SPACING > TILE) throw new Error("summer-meadow-endless : espacement des arbres plus grand qu'un morceau");
  const loaded = /* @__PURE__ */ new Map();
  const loadChunk = (cx, cz) => {
    const minX = cx * TILE - HALF;
    const minZ = cz * TILE - HALF;
    const maxX = minX + TILE;
    const maxZ = minZ + TILE;
    const inside = (x, z, margin) => x >= minX + margin && x < maxX - margin && z >= minZ + margin && z < maxZ - margin;
    const rng = createRng(hash(seed, 2, cx, cz));
    const detail = createRng(hash(seed, 3, cx, cz));
    const local = { trees: 0, rocks: 0, tufts: 0, flowers: 0, lawns: 0, patches: 0 };
    const colliders = [];
    scatter.beginChunk(minX, minZ);
    const own = treesOf(cx, cz);
    for (const tree of own) {
      place(tree.layer, tree.x, tree.z, { yaw: tree.yaw, scale: tree.scale, sink: 0.12 });
      colliders.push({ x: tree.x, z: tree.z, radius: tree.kind.trunk * tree.scale });
    }
    local.trees = own.length;
    const near = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const tree of treesOf(cx + dx, cz + dz)) {
          if (tree.x > minX - MAX_CROWN && tree.x < maxX + MAX_CROWN && tree.z > minZ - MAX_CROWN && tree.z < maxZ + MAX_CROWN) near.push(tree);
        }
      }
    }
    const rocks = [];
    const addRock = (x, z, big) => {
      if (!inside(x, z, 3)) return;
      if (near.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 1.6)) return;
      const yaw = rng.range(0, TAU8);
      if (big || rng.chance(0.55)) {
        const model = big ? boulders[rng.int(0, 1)] : rng.pick(boulders);
        const scale = big ? rng.range(1.05, 1.5) : rng.range(0.6, 1.1);
        place(model.layer, x, z, { yaw, scale, sink: 0.06 * model.size * scale });
        const height = model.size * scale;
        rocks.push({ x, z, radius: height * 1.05 });
        if (height > 0.75) colliders.push({ x, z, radius: height * 0.55 });
      } else {
        const model = rng.pick(slabs);
        const scale = rng.range(0.7, 1.25);
        place(model.layer, x, z, { yaw, scale, sink: 0.02 });
        rocks.push({ x, z, radius: model.size * scale * 0.6 });
      }
    };
    const outcrops = Math.floor(TILE * TILE / 1200 * rockAmount + rng.next());
    for (let n = 0; n < outcrops; n++) {
      let site = null;
      for (let t = 0; t < 3; t++) {
        const x = rng.range(minX + 4, maxX - 4);
        const z = rng.range(minZ + 4, maxZ - 4);
        const h = heightAt(x, z);
        if (!site || h > site.h) site = { x, z, h };
      }
      addRock(site.x, site.z, true);
      const followers = rng.int(2, 6);
      for (let k = 0; k < followers; k++) {
        const angle = rng.range(0, TAU8);
        const distance = 1.2 + Math.sqrt(rng.next()) * 4;
        addRock(site.x + Math.cos(angle) * distance, site.z + Math.sin(angle) * distance, false);
      }
    }
    const loners = Math.floor(TILE * TILE / 650 * rockAmount + rng.next());
    for (let n = 0; n < loners; n++) addRock(rng.range(minX, maxX), rng.range(minZ, maxZ), false);
    local.rocks = rocks.length;
    const openness = (x, z) => {
      let open = 2;
      for (const tree of near) open = Math.min(open, Math.hypot(tree.x - x, tree.z - z) / tree.crown);
      return open;
    };
    const onRock = (x, z, margin = 0) => rocks.some((rock) => Math.hypot(rock.x - x, rock.z - z) < rock.radius + margin);
    const { moisture } = rules;
    const lawnCells = Math.ceil(TILE / CELLS.lawn);
    for (let j = 0; j < lawnCells; j++) {
      for (let i = 0; i < lawnCells; i++) {
        const x = minX + (i + detail.next()) * CELLS.lawn;
        const z = minZ + (j + detail.next()) * CELLS.lawn;
        const roll = detail.next();
        const model = detail.next();
        const yaw = detail.range(0, TAU8);
        const scale = detail.range(0.85, 1.15);
        if (!inside(x, z, 0) || onRock(x, z, 0.8) || openness(x, z) < 0.3) continue;
        if (roll > smoothstep2(moisture(x, z), 0.42, 0.66) * 0.45 * grass) continue;
        place(lawns[Math.floor(model * lawns.length)], x, z, { yaw, scale, tilt: true });
        local.lawns += 1;
      }
    }
    const tuftCells = TILE / CELLS.tuft;
    for (let j = 0; j < tuftCells; j++) {
      for (let i = 0; i < tuftCells; i++) {
        const x = minX + (i + detail.next()) * CELLS.tuft;
        const z = minZ + (j + detail.next()) * CELLS.tuft;
        const roll = detail.next();
        const tallRoll = detail.next();
        const model = detail.next();
        const yaw = detail.range(0, TAU8);
        const scale = detail.range(0.75, 1.25);
        if (onRock(x, z, 0.15)) continue;
        const open = openness(x, z);
        if (open < 0.14) continue;
        if (roll > rules.tuftChance(x, z, open) * grass) continue;
        if (open >= 1.1 && tallRoll < smoothstep2(rules.tallZone(x, z), 0.56, 0.7) * 0.75) {
          place(tallTufts[Math.floor(model * tallTufts.length)], x, z, { yaw, scale });
        } else {
          place(tufts[Math.floor(model * tufts.length)], x, z, { yaw, scale: scale * (open < 1 ? 0.8 : 1) });
        }
        local.tufts += 1;
      }
    }
    const flowerCells = Math.ceil(TILE / CELLS.flower);
    for (let j = 0; j < flowerCells; j++) {
      for (let i = 0; i < flowerCells; i++) {
        const x = minX + (i + detail.next()) * CELLS.flower;
        const z = minZ + (j + detail.next()) * CELLS.flower;
        const roll = detail.next();
        const stray = detail.next();
        const yaw = detail.range(0, TAU8);
        const scale = detail.range(0.85, 1.08);
        if (!inside(x, z, 0) || onRock(x, z, 0.2)) continue;
        if (openness(x, z) < 0.75) continue;
        const { best, bestValue } = rules.flowerAt(x, z, moisture(x, z), flowers);
        if (best && roll < (0.15 + smoothstep2(bestValue, 0, 0.1) * 0.5) * Math.min(1.6, flowerAmount)) {
          place(best.layer, x, z, { yaw, scale });
          local.flowers += 1;
        } else if (stray < 0.01 * flowerAmount) {
          place(stray < 6e-3 * flowerAmount ? flowers.daisy.layer : flowers.buttercup.layer, x, z, { yaw, scale: scale * 0.9 });
          local.flowers += 1;
        }
      }
    }
    for (const tree of own) {
      if (!detail.chance(0.6)) continue;
      const angle = Math.PI + detail.range(-0.9, 0.9);
      const distance = tree.kind.trunk * 1.2 + detail.range(0.3, 0.9);
      place(moss, tree.x + Math.sin(angle) * distance, tree.z + Math.cos(angle) * distance, { yaw: detail.range(0, TAU8), scale: detail.range(0.7, 1.2), tilt: true });
      local.patches += 1;
    }
    for (const rock of rocks) {
      if (!detail.chance(0.3)) continue;
      const angle = detail.range(0, TAU8);
      const x = rock.x + Math.cos(angle) * (rock.radius + 0.3);
      const z = rock.z + Math.sin(angle) * (rock.radius + 0.3);
      place(moss, x, z, { yaw: detail.range(0, TAU8), scale: detail.range(0.5, 0.9), tilt: true });
      local.patches += 1;
    }
    if (detail.next() < TILE * TILE / 1500) {
      const colonyX = detail.range(minX + 3, maxX - 3);
      const colonyZ = detail.range(minZ + 3, maxZ - 3);
      const hills = detail.int(3, 6);
      for (let k = 0; k < hills; k++) {
        const angle = detail.range(0, TAU8);
        const distance = detail.range(0.4, 3.2);
        const x = colonyX + Math.cos(angle) * distance;
        const z = colonyZ + Math.sin(angle) * distance;
        if (openness(x, z) < 1.1 || onRock(x, z, 0.4)) continue;
        place(molehill, x, z, { yaw: detail.range(0, TAU8), scale: detail.range(0.7, 1.15), tilt: true });
        local.patches += 1;
      }
    }
    const scattered = scatter.endChunk(createRng(hash(seed, 4, cx, cz)));
    const mesh = new THREE22.Mesh(buildGroundPatch({ size: TILE, spacing: 0.5, origin: [cx * TILE, cz * TILE], height: heightAt }), groundMaterial);
    mesh.name = "ground";
    mesh.receiveShadow = true;
    mesh.position.set(cx * TILE, 0, cz * TILE);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    ground.add(mesh);
    for (const name in counts) counts[name] += local[name];
    loaded.set(keyOf(cx, cz), { cx, cz, scattered, mesh, colliders, counts: local });
  };
  const unloadChunk = (key, chunk) => {
    scatter.removeChunk(chunk.scattered);
    ground.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
    for (const name in counts) counts[name] -= chunk.counts[name];
    loaded.delete(key);
  };
  const chunkBox = (cx, cz, margin) => {
    _box.min.set(cx * TILE - HALF - margin, -0.5, cz * TILE - HALF - margin);
    _box.max.set(cx * TILE + HALF + margin, RELIEF + 15, cz * TILE + HALF + margin);
    return _box;
  };
  let frameIndex = 0;
  let ringSq = 0;
  const inRing = (dx, dz) => dx * dx + dz * dz <= ringSq;
  const stream = (camera, target) => {
    _viewProjection3.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum3.setFromProjectionMatrix(_viewProjection3);
    const tx = Math.round(target.x / TILE);
    const tz = Math.round(target.z / TILE);
    let bestKey = -1;
    let bestDistance = Infinity;
    let bestX = 0;
    let bestZ = 0;
    for (let dz = -WINDOW; dz <= WINDOW; dz++) {
      for (let dx = -WINDOW; dx <= WINDOW; dx++) {
        const cx = tx + dx;
        const cz = tz + dz;
        const key = keyOf(cx, cz);
        if (loaded.has(key)) continue;
        if (_frustum3.intersectsBox(chunkBox(cx, cz, NEED_MARGIN))) {
          loadChunk(cx, cz);
        } else if (inRing(dx, dz) || _frustum3.intersectsBox(chunkBox(cx, cz, PREFETCH_MARGIN))) {
          const distance = dx * dx + dz * dz;
          if (distance < bestDistance) {
            bestDistance = distance;
            bestKey = key;
            bestX = cx;
            bestZ = cz;
          }
        }
      }
    }
    if (bestKey >= 0) {
      const start = performance.now();
      timedLoad(bestX, bestZ);
      while (performance.now() - start + chunkTime < PREFETCH_BUDGET) {
        if (!loadNearestPending(tx, tz)) break;
      }
    }
    if (frameIndex++ % 30 === 0) {
      for (const [key, chunk] of loaded) {
        const far = Math.abs(chunk.cx - tx) > WINDOW + 1 || Math.abs(chunk.cz - tz) > WINDOW + 1;
        const kept = inRing(chunk.cx - tx, chunk.cz - tz) || _frustum3.intersectsBox(chunkBox(chunk.cx, chunk.cz, KEEP_MARGIN));
        if (far || !kept) unloadChunk(key, chunk);
      }
      for (const memo of [candidateMemo, treeMemo]) {
        for (const key of memo.keys()) {
          const cx = Math.floor(key / 65536) - 32768;
          const cz = key % 65536 - 32768;
          if (Math.abs(cx - tx) > WINDOW + 3 || Math.abs(cz - tz) > WINDOW + 3) memo.delete(key);
        }
      }
    }
  };
  const loadNearestPending = (tx, tz) => {
    let best = null;
    let bestDistance = Infinity;
    for (let dz = -WINDOW; dz <= WINDOW; dz++) {
      for (let dx = -WINDOW; dx <= WINDOW; dx++) {
        const distance = dx * dx + dz * dz;
        if (distance >= bestDistance || loaded.has(keyOf(tx + dx, tz + dz))) continue;
        if (inRing(dx, dz) || _frustum3.intersectsBox(chunkBox(tx + dx, tz + dz, PREFETCH_MARGIN))) {
          best = [tx + dx, tz + dz];
          bestDistance = distance;
        }
      }
    }
    if (!best) return false;
    timedLoad(best[0], best[1]);
    return true;
  };
  let chunkTime = 3;
  const timedLoad = (cx, cz) => {
    const start = performance.now();
    loadChunk(cx, cz);
    chunkTime += (performance.now() - start - chunkTime) * 0.2;
  };
  for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) loadChunk(cx, cz);
  const nearbyColliders = (x, z, visit) => {
    const cx = Math.round(x / TILE);
    const cz = Math.round(z / TILE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = loaded.get(keyOf(cx + dx, cz + dz));
        if (chunk) for (const collider of chunk.colliders) visit(collider);
      }
    }
  };
  const spawn = new THREE22.Vector3();
  search: for (let ring = 0; ring < 12; ring++) {
    for (let k = 0; k < Math.max(1, ring * 6); k++) {
      const angle = k / Math.max(1, ring * 6) * TAU8;
      const x = Math.cos(angle) * ring * 2;
      const z = Math.sin(angle) * ring * 2;
      let free = true;
      nearbyColliders(x, z, (collider) => {
        if (Math.hypot(collider.x - x, collider.z - z) <= collider.radius + 2.5) free = false;
      });
      if (free) {
        spawn.set(x, 0, z);
        break search;
      }
    }
  }
  spawn.y = heightAt(spawn.x, spawn.z);
  let pushX = 0;
  let pushZ = 0;
  let pushRadius = 0;
  const push = (collider) => {
    const dx = pushX - collider.x;
    const dz = pushZ - collider.z;
    const reach = collider.radius + pushRadius;
    const distance = Math.hypot(dx, dz);
    if (distance < reach && distance > 1e-4) {
      pushX = collider.x + dx / distance * reach;
      pushZ = collider.z + dz / distance * reach;
    }
  };
  return {
    group,
    seed,
    size: "endless",
    endless: true,
    meters: Infinity,
    bounds: { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity },
    center: new THREE22.Vector3(),
    spawn,
    counts,
    heightAt,
    /** Empêche de traverser les troncs et les gros rochers des morceaux chargés : corrige `position` (x, z). */
    collide(position, radius) {
      pushX = position.x;
      pushZ = position.z;
      pushRadius = radius;
      nearbyColliders(position.x, position.z, push);
      position.x = pushX;
      position.z = pushZ;
    },
    /** Position de l'astre (heure du jour). */
    setMood(mood) {
      daylight.setSun(mood.sunAzimuth, mood.sunElevation);
    },
    /** À appeler à chaque image, caméra à jour, avant le rendu (même contrat que l'île). */
    update({ camera, target, dt, viewArea, viewRadius, shadows, reach, shadowReach, shadowCenter, around = 0 }) {
      ringSq = Math.min((around + HALF) / TILE, WINDOW) ** 2 * (around > 0 ? 1 : 0);
      stream(camera, target);
      scatter.update(camera, FULL_DETAIL_AREA / viewArea, { reach, shadowReach });
      cloudShadows.update(dt, target);
      if (shadows) daylight.update(shadowCenter ?? target, viewRadius + 14);
    },
    /** Ce qui est dessiné par le semis, la part de végétation fine affichée, les morceaux chargés et le temps moyen
     * de fabrication d'un morceau (ms). */
    stats() {
      return { ...scatter.stats(), fraction: scatter.fraction, chunks: loaded.size, chunkTime };
    },
    dispose() {
      for (const [key, chunk] of loaded) unloadChunk(key, chunk);
      scatter.dispose();
      cloudShadows.dispose();
      daylight.dispose();
      groundMaterial.dispose();
      group.clear();
    }
  };
}

// src/worlds/summer-meadow.js
var MEADOW_SIZES = {
  small: { label: "Petit", meters: 48 },
  medium: { label: "Moyen", meters: 96 },
  large: { label: "Grand", meters: 144 }
};
var MEADOW_EXTENTS = {
  ...MEADOW_SIZES,
  endless: { label: "Infini", meters: Infinity }
};
var smoothstep3 = THREE23.MathUtils.smoothstep;
function createSummerMeadow(options = {}) {
  if (options.size === "endless" && !options.diorama) return createEndlessMeadow(options);
  return createIsland(options);
}
function createIsland({ seed = 1, size = "medium", relief = 1.8, trees: treeAmount = 1, rocks: rockAmount = 1, grass = 1, flowers: flowerAmount = 1, diorama = false } = {}) {
  seed = THREE23.MathUtils.clamp(Math.round(seed) || 0, 0, 9999);
  const meters = (MEADOW_SIZES[size] ?? MEADOW_SIZES.medium).meters;
  const tiles = meters / TILE;
  const firstTile = -Math.floor(tiles / 2);
  const min = (firstTile - 0.5) * TILE;
  const bounds = { minX: min, maxX: min + meters, minZ: min, maxZ: min + meters };
  const center = new THREE23.Vector3(min + meters / 2, 0, min + meters / 2);
  const area = meters * meters;
  const rules = meadowRules({ seed, relief, trees: treeAmount, flowers: flowerAmount });
  const { RELIEF, heightAt, field } = rules;
  const group = new THREE23.Group();
  group.name = "Prairie d'\xE9t\xE9";
  const counts = {};
  const ground = new THREE23.Group();
  ground.name = "ground";
  let groundMaterial = null;
  for (let j = 0; j < tiles; j++) {
    for (let i = 0; i < tiles; i++) {
      const tileX = firstTile + i;
      const tileZ = firstTile + j;
      const tile = create({ seed, season: SEASON, finish: "pixel", tileX, tileZ, size: TILE, relief: RELIEF, dryness: 0.25 });
      const mesh = tile.getObjectByName("ground");
      disposeObject(tile.getObjectByName("skirt"));
      if (groundMaterial) {
        mesh.material.dispose();
        mesh.material = groundMaterial;
      } else {
        groundMaterial = mesh.material;
      }
      mesh.position.set(tileX * TILE, 0, tileZ * TILE);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      ground.add(mesh);
    }
  }
  groundMaterial.uniforms.uSelfEdge.value = 4;
  groundMaterial.uniforms.uPattern.value.x = GROUND_GRAIN;
  group.add(ground);
  const soilBottom = (x, z) => -1.1 - field(x, z, 9, 30) * 0.9;
  const rockBottom = diorama ? (x, z) => -4.5 - field(x, z, 6, 31) * 3.5 - field(x, z, 23, 32) * 3 : (x, z) => -3 - field(x, z, 6, 31) * 1.8 - field(x, z, 23, 32) * 1.5;
  const soil = new THREE23.Mesh(
    buildIslandBand({ bounds, top: heightAt, bottom: soilBottom }),
    createToonMaterial({ ramp: GROUNDS.dirt.ramp, steps: [0.3, 0.5, 0.74], pattern: "speckle", patternParams: [16, 0.08, 0.2, 1], seed: 5, id: 12 })
  );
  const bedrock = new THREE23.Mesh(
    buildIslandBand({ bounds, top: (x, z) => soilBottom(x, z) + 0.02, bottom: rockBottom }),
    createToonMaterial({ ramp: STONES.granite.ramp, ink: STONES.granite.ink, steps: [0.3, 0.5, 0.74], pattern: "speckle", patternParams: [8, 0.1, 0.2, 1], seed: 9, id: 13 })
  );
  soil.name = "soil";
  bedrock.name = "bedrock";
  group.add(soil, bedrock);
  const keelDepth = THREE23.MathUtils.clamp(meters * 0.6, 28, 72);
  let underside = null;
  if (!diorama) {
    underside = new THREE23.Mesh(buildIslandUnderside({ bounds, top: rockBottom, depth: keelDepth, noise: (x, z) => field(x, z, 6, 33) }), bedrock.material);
    underside.name = "underside";
    underside.matrixAutoUpdate = false;
    group.add(underside);
  }
  const scatter = new ScatterField({ bounds, heightAt });
  const rng = createRng(seed * 9973 + 11);
  const place = createPlacer(heightAt);
  const inside = (x, z, margin) => x > bounds.minX + margin && x < bounds.maxX - margin && z > bounds.minZ + margin && z < bounds.maxZ - margin;
  const { species, boulders, slabs, lawns, tufts, tallTufts, flowers, moss, molehill } = createMeadowLayers((prototype, options) => scatter.addLayer(prototype, options));
  const colliders = [];
  const trees = [];
  const TREE_CELL = CELLS.tree;
  const treeCells = Math.ceil(meters / TREE_CELL);
  for (let j = 0; j < treeCells; j++) {
    for (let i = 0; i < treeCells; i++) {
      const x = bounds.minX + (i + rng.next()) * TREE_CELL;
      const z = bounds.minZ + (j + rng.next()) * TREE_CELL;
      const roll = rng.next();
      const pick2 = rng.next();
      const model = rng.next();
      const size2 = rng.next();
      const yaw = rng.range(0, TAU8);
      if (!inside(x, z, 3.5)) continue;
      const grove = rules.grove(x, z);
      if (roll > (0.015 + grove * 0.55) * treeAmount) continue;
      const name = rules.treeKind(x, z, grove, pick2);
      const kind = species[name];
      if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < (tree.kind.spacing + kind.spacing) / 2)) continue;
      const scale = THREE23.MathUtils.lerp(kind.scale[0], kind.scale[1], size2);
      place(kind.layers[Math.floor(model * kind.layers.length)], x, z, { yaw, scale, sink: 0.12 });
      trees.push({ x, z, kind, name, crown: kind.crown * scale });
      colliders.push({ x, z, radius: kind.trunk * scale });
    }
  }
  counts.trees = trees.length;
  const rocks = [];
  const addRock = (x, z, big) => {
    if (!inside(x, z, 2)) return;
    if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 1.6)) return;
    const yaw = rng.range(0, TAU8);
    if (big || rng.chance(0.55)) {
      const model = big ? boulders[rng.int(0, 1)] : rng.pick(boulders);
      const scale = big ? rng.range(1.05, 1.5) : rng.range(0.6, 1.1);
      place(model.layer, x, z, { yaw, scale, sink: 0.06 * model.size * scale });
      const height = model.size * scale;
      rocks.push({ x, z, radius: height * 1.05 });
      if (height > 0.75) colliders.push({ x, z, radius: height * 0.55 });
    } else {
      const model = rng.pick(slabs);
      const scale = rng.range(0.7, 1.25);
      place(model.layer, x, z, { yaw, scale, sink: 0.02 });
      rocks.push({ x, z, radius: model.size * scale * 0.6 });
    }
  };
  const outcrops = rockAmount > 0 ? Math.max(1, Math.round(area / 1200 * rockAmount)) : 0;
  for (let n = 0; n < outcrops; n++) {
    let site = null;
    for (let t = 0; t < 3; t++) {
      const x = rng.range(bounds.minX + 6, bounds.maxX - 6);
      const z = rng.range(bounds.minZ + 6, bounds.maxZ - 6);
      const h = heightAt(x, z);
      if (!site || h > site.h) site = { x, z, h };
    }
    addRock(site.x, site.z, true);
    const followers = rng.int(2, 6);
    for (let k = 0; k < followers; k++) {
      const angle = rng.range(0, TAU8);
      const distance = 1.2 + Math.sqrt(rng.next()) * 4;
      addRock(site.x + Math.cos(angle) * distance, site.z + Math.sin(angle) * distance, false);
    }
  }
  const loners = Math.round(area / 650 * rockAmount);
  for (let n = 0; n < loners; n++) {
    addRock(rng.range(bounds.minX + 3, bounds.maxX - 3), rng.range(bounds.minZ + 3, bounds.maxZ - 3), false);
  }
  counts.rocks = rocks.length;
  counts.tufts = 0;
  counts.flowers = 0;
  counts.lawns = 0;
  counts.patches = 0;
  {
    const detail = createRng(seed * 7477 + 29);
    const BUCKET = 8;
    const buckets = /* @__PURE__ */ new Map();
    const bucketKey = (x, z) => Math.floor(x / BUCKET) * 4096 + Math.floor(z / BUCKET);
    const register = (item, kind, radius) => {
      for (let bx = Math.floor((item.x - radius) / BUCKET); bx <= Math.floor((item.x + radius) / BUCKET); bx++) {
        for (let bz = Math.floor((item.z - radius) / BUCKET); bz <= Math.floor((item.z + radius) / BUCKET); bz++) {
          const key = bx * 4096 + bz;
          if (!buckets.has(key)) buckets.set(key, { trees: [], rocks: [] });
          buckets.get(key)[kind].push(item);
        }
      }
    };
    for (const tree of trees) register(tree, "trees", tree.crown);
    for (const rock of rocks) register(rock, "rocks", rock.radius);
    const openness = (x, z) => {
      let open = 2;
      for (const tree of buckets.get(bucketKey(x, z))?.trees ?? []) {
        open = Math.min(open, Math.hypot(tree.x - x, tree.z - z) / tree.crown);
      }
      return open;
    };
    const onRock = (x, z, margin = 0) => (buckets.get(bucketKey(x, z))?.rocks ?? []).some((rock) => Math.hypot(rock.x - x, rock.z - z) < rock.radius + margin);
    const { moisture } = rules;
    const LAWN_CELL = CELLS.lawn;
    const lawnCells = Math.ceil(meters / LAWN_CELL);
    for (let j = 0; j < lawnCells; j++) {
      for (let i = 0; i < lawnCells; i++) {
        const x = bounds.minX + (i + detail.next()) * LAWN_CELL;
        const z = bounds.minZ + (j + detail.next()) * LAWN_CELL;
        const roll = detail.next();
        const model = detail.next();
        const yaw = detail.range(0, TAU8);
        const scale = detail.range(0.85, 1.15);
        if (!inside(x, z, 1.8) || onRock(x, z, 0.8) || openness(x, z) < 0.3) continue;
        if (roll > smoothstep3(moisture(x, z), 0.42, 0.66) * 0.45 * grass) continue;
        place(lawns[Math.floor(model * lawns.length)], x, z, { yaw, scale, tilt: true });
        counts.lawns += 1;
      }
    }
    const TUFT_CELL = CELLS.tuft;
    const tuftCells = Math.ceil(meters / TUFT_CELL);
    for (let j = 0; j < tuftCells; j++) {
      for (let i = 0; i < tuftCells; i++) {
        const x = bounds.minX + (i + detail.next()) * TUFT_CELL;
        const z = bounds.minZ + (j + detail.next()) * TUFT_CELL;
        const roll = detail.next();
        const tallRoll = detail.next();
        const model = detail.next();
        const yaw = detail.range(0, TAU8);
        const scale = detail.range(0.75, 1.25);
        if (!inside(x, z, 0.5) || onRock(x, z, 0.15)) continue;
        const open = openness(x, z);
        if (open < 0.14) continue;
        if (roll > rules.tuftChance(x, z, open) * grass) continue;
        if (open >= 1.1 && tallRoll < smoothstep3(rules.tallZone(x, z), 0.56, 0.7) * 0.75) {
          place(tallTufts[Math.floor(model * tallTufts.length)], x, z, { yaw, scale });
        } else {
          place(tufts[Math.floor(model * tufts.length)], x, z, { yaw, scale: scale * (open < 1 ? 0.8 : 1) });
        }
        counts.tufts += 1;
      }
    }
    const FLOWER_CELL = CELLS.flower;
    const flowerCells = Math.ceil(meters / FLOWER_CELL);
    for (let j = 0; j < flowerCells; j++) {
      for (let i = 0; i < flowerCells; i++) {
        const x = bounds.minX + (i + detail.next()) * FLOWER_CELL;
        const z = bounds.minZ + (j + detail.next()) * FLOWER_CELL;
        const roll = detail.next();
        const stray = detail.next();
        const yaw = detail.range(0, TAU8);
        const scale = detail.range(0.85, 1.08);
        if (!inside(x, z, 0.6) || onRock(x, z, 0.2)) continue;
        const open = openness(x, z);
        if (open < 0.75) continue;
        const { best, bestValue } = rules.flowerAt(x, z, moisture(x, z), flowers);
        if (best && roll < (0.15 + smoothstep3(bestValue, 0, 0.1) * 0.5) * Math.min(1.6, flowerAmount)) {
          place(best.layer, x, z, { yaw, scale });
          counts.flowers += 1;
        } else if (stray < 0.01 * flowerAmount) {
          place(stray < 6e-3 * flowerAmount ? flowers.daisy.layer : flowers.buttercup.layer, x, z, { yaw, scale: scale * 0.9 });
          counts.flowers += 1;
        }
      }
    }
    for (const tree of trees) {
      if (!detail.chance(0.6)) continue;
      const angle = Math.PI + detail.range(-0.9, 0.9);
      const distance = tree.kind.trunk * 1.2 + detail.range(0.3, 0.9);
      const x = tree.x + Math.sin(angle) * distance;
      const z = tree.z + Math.cos(angle) * distance;
      if (inside(x, z, 1)) {
        place(moss, x, z, { yaw: detail.range(0, TAU8), scale: detail.range(0.7, 1.2), tilt: true });
        counts.patches += 1;
      }
    }
    for (const rock of rocks) {
      if (!detail.chance(0.3)) continue;
      const angle = detail.range(0, TAU8);
      const x = rock.x + Math.cos(angle) * (rock.radius + 0.3);
      const z = rock.z + Math.sin(angle) * (rock.radius + 0.3);
      if (inside(x, z, 1)) {
        place(moss, x, z, { yaw: detail.range(0, TAU8), scale: detail.range(0.5, 0.9), tilt: true });
        counts.patches += 1;
      }
    }
    const colonies = Math.max(1, Math.round(area / 1500));
    for (let n = 0; n < colonies; n++) {
      const cx = detail.range(bounds.minX + 5, bounds.maxX - 5);
      const cz = detail.range(bounds.minZ + 5, bounds.maxZ - 5);
      const hills = detail.int(3, 6);
      for (let k = 0; k < hills; k++) {
        const angle = detail.range(0, TAU8);
        const distance = detail.range(0.4, 3.2);
        const x = cx + Math.cos(angle) * distance;
        const z = cz + Math.sin(angle) * distance;
        if (!inside(x, z, 1) || openness(x, z) < 1.1 || onRock(x, z, 0.4)) continue;
        place(molehill, x, z, { yaw: detail.range(0, TAU8), scale: detail.range(0.7, 1.15), tilt: true });
        counts.patches += 1;
      }
    }
  }
  scatter.build(createRng(seed * 31 + 7));
  group.add(scatter.group);
  let daylight = null;
  let cloudShadows = null;
  let cloudSea = null;
  if (diorama) {
    scatter.showAll();
  } else {
    daylight = createDaylight();
    cloudShadows = createCloudShadows(createRng(seed * 131 + 1), { bounds, count: Math.round(4 + area / 4e3) });
    cloudSea = createCloudSea({ bounds, seaLevel: -keelDepth - 30, mistLevel: -keelDepth * 0.82, inset: meters * 0.5 });
    group.add(daylight.light, daylight.light.target, cloudShadows.group, cloudSea.mesh);
  }
  const spawn = new THREE23.Vector3(center.x, 0, center.z);
  search: for (let ring = 0; ring < 12; ring++) {
    for (let k = 0; k < Math.max(1, ring * 6); k++) {
      const angle = k / Math.max(1, ring * 6) * TAU8;
      const x = center.x + Math.cos(angle) * ring * 2;
      const z = center.z + Math.sin(angle) * ring * 2;
      if (colliders.every((collider) => Math.hypot(collider.x - x, collider.z - z) > collider.radius + 2.5)) {
        spawn.set(x, 0, z);
        break search;
      }
    }
  }
  spawn.y = heightAt(spawn.x, spawn.z);
  return {
    group,
    seed,
    size,
    meters,
    bounds,
    center,
    spawn,
    counts,
    heightAt,
    /**
     * Empêche de traverser les troncs et les gros rochers, et de sortir de la carte : corrige `position` (x, z).
     * @param {THREE.Vector3} position
     * @param {number} radius rayon du personnage (m)
     */
    collide(position, radius) {
      for (const collider of colliders) {
        const dx = position.x - collider.x;
        const dz = position.z - collider.z;
        const reach = collider.radius + radius;
        const distance = Math.hypot(dx, dz);
        if (distance < reach && distance > 1e-4) {
          position.x = collider.x + dx / distance * reach;
          position.z = collider.z + dz / distance * reach;
        }
      }
      position.x = THREE23.MathUtils.clamp(position.x, bounds.minX + 0.6, bounds.maxX - 0.6);
      position.z = THREE23.MathUtils.clamp(position.z, bounds.minZ + 0.6, bounds.maxZ - 0.6);
    },
    /**
     * Applique l'ambiance du moment (kit/atmosphere.js) : position de l'astre, teintes de la mer de nuages.
     * @param {object} mood `values` d'une ambiance
     */
    setMood(mood) {
      if (!daylight) return;
      daylight.setSun(mood.sunAzimuth, mood.sunElevation);
      cloudSea.setLook(mood.sea, mood.skyBottom, daylight.direction);
    },
    /**
     * À appeler à chaque image, caméra à jour, avant le rendu.
     * @param {object} frame
     * @param {THREE.Camera} frame.camera orthographique (vue isométrique) ou perspective (3e personne)
     * @param {THREE.Vector3} frame.target point regardé (le personnage)
     * @param {number} frame.dt secondes depuis l'image précédente
     * @param {number} frame.viewArea surface de sol que couvre la vue (m²) : ne dépend que du zoom et de
     *   l'inclinaison, donc la densité d'herbe ne bouge pas pendant qu'on marche
     * @param {number} frame.viewRadius demi-diagonale de la zone de sol vue (m)
     * @param {boolean} frame.shadows vrai les images où la carte d'ombre est refaite : la lumière ne suit la
     *   vue que ces images-là, sinon les ombres glisseraient sur le sol
     * @param {Record<string, number>} [frame.reach] portée du semis par famille (m), pour une caméra perspective
     * @param {number} [frame.shadowReach] distance à la caméra au-delà de laquelle le semis ne projette plus
     *   d'ombre (m) ; hors de la carte d'ombre, c'est autant de triangles économisés
     * @param {THREE.Vector3} [frame.shadowCenter] centre de la zone ombrée (défaut : `target`)
     * @param {number} [frame.around] monde sans bord : rayon autour de `target` gardé prêt même hors champ (m)
     */
    update({ camera, target, dt, viewArea, viewRadius, shadows, reach, shadowReach, shadowCenter }) {
      scatter.update(camera, FULL_DETAIL_AREA / viewArea, { reach, shadowReach });
      cloudShadows.update(dt);
      if (shadows) daylight.update(shadowCenter ?? target, viewRadius + 14);
    },
    /** Ce qui est dessiné à cet instant par le semis, et la part de végétation fine affichée. */
    stats() {
      return { ...scatter.stats(), fraction: scatter.fraction };
    },
    dispose() {
      scatter.dispose();
      cloudShadows?.dispose();
      cloudSea?.dispose();
      daylight?.dispose();
      for (const mesh of ground.children) mesh.geometry.dispose();
      groundMaterial?.dispose();
      disposeObject(soil);
      disposeObject(bedrock);
      underside?.geometry.dispose();
      group.clear();
    }
  };
}

// src/assets/worlds/islands/summer-meadow.js
var amount = (label, description) => numberParam(label, 1, 0, 2, description, { step: 0.25 });
var params13 = {
  seed: seedParam("Graine du monde : relief, place des bosquets et des clairi\xE8res, affleurements de rochers, nappes de fleurs."),
  size: choiceParam("Taille", MEADOW_SIZES, "C\xF4t\xE9 de l'\xEEle : petit 48 m, moyen 96 m, grand 144 m."),
  relief: numberParam("Relief", 1.8, 0.6, 3, "Hauteur des ondulations du pr\xE9.", { step: 0.2, unit: "m" }),
  trees: amount("Arbres", "Abondance des arbres : 0 = pr\xE9 nu, 1 = prairie \xE0 bosquets, 2 = bois clair."),
  rocks: amount("Rochers", "Abondance des affleurements et des roches isol\xE9es."),
  grass: amount("Herbe", "Abondance des touffes, des hautes herbes et des pelouses."),
  flowers: amount("Fleurs", "Abondance et \xE9tendue des nappes de fleurs.")
};
var meta13 = {
  id: "worlds/islands/summer-meadow",
  name: "Prairie d'\xE9t\xE9",
  nameEn: "Summer meadow",
  category: "worlds",
  subcategory: "islands",
  description: "Un monde entier : une \xEEle de prairie vallonn\xE9e qui flotte dans une mer de nuages, assembl\xE9e \xE0 partir des assets de la biblioth\xE8que (sol de prairie, arbres, rochers, herbes, fleurs). La graine change le relief, les bosquets et les nappes de fleurs ; on r\xE8gle sa taille et l'abondance de chaque \xE9l\xE9ment, puis on s'y prom\xE8ne. Dans l'explorateur, la taille \xAB Infini \xBB \xF4te les bords : la prairie se fabrique au fil de la marche.",
  tags: [
    "monde",
    "carte",
    "\xEEle",
    "prairie",
    "plaine",
    "\xE9t\xE9",
    "pr\xE9",
    "bosquets",
    "mer de nuages",
    "assemblage",
    "\xE0 explorer",
    "ext\xE9rieur",
    "world",
    "map",
    "island",
    "meadow",
    "plain",
    "summer",
    "groves",
    "sea of clouds",
    "composition",
    "explorable",
    "outdoor",
    "procedural",
    "infinite",
    "endless",
    "infini"
  ],
  biomes: ["meadow", "forest"],
  version: 3,
  added: "2026-11-16",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au centre de l'\xEEle (taille \xAB petit \xBB), au niveau le plus bas du pr\xE9. La tranche de l'\xEEle descend sous l'origine : dans le monde vivant, elle plonge dans la mer de nuages.",
  footprint: { radius: 35, height: 15 },
  animated: ["wind"],
  pedestal: false,
  // l'île est son propre socle
  /** Asset composé d'autres assets : son poids est celui d'un monde, pas d'un objet (voir docs/WORLDS.md). */
  composite: true,
  /** Interface qui remplace la visionneuse dans la galerie. */
  experience: "explorer",
  params: params13,
  variants: Object.entries(MEADOW_SIZES).map(([id, size]) => ({ id, name: `${size.label} \u2014 ${size.meters} m`, params: { size: id } }))
};
function create13(given = {}) {
  const p = resolveParams(meta13.params, given);
  const world = createSummerMeadow({ ...p, diorama: true });
  world.group.userData.asset = { id: meta13.id, params: p, counts: world.counts };
  world.group.userData.world = world;
  return world.group;
}
function dispose(group) {
  group.userData.world?.dispose();
}
export {
  create13 as create,
  dispose,
  meta13 as meta,
  setWind,
  tick
};
