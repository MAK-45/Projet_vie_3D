// Projet Vie 3D — Porte du Complexe (buildings/structure/complex-door), version 1
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/buildings/structure/complex-door.js
import * as THREE4 from "three";

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
var SPRITE_NORMAL = new THREE2.Vector3(0, 1, 0);
var _rockPoint = new THREE2.Vector3();
var _rockEuler = new THREE2.Euler();
function buildLathe(profile, { segments = 32, axis = "y", facets = false, start = 0 } = {}) {
  const positions = [];
  const normals = [];
  const index = [];
  const n = profile.length;
  const put = (r, h, angle, nr, nh) => {
    const c = Math.cos(angle), s = Math.sin(angle);
    if (axis === "y") {
      positions.push(r * c, h, r * s);
      normals.push(nr * c, nh, nr * s);
    } else {
      positions.push(r * c, r * s, h);
      normals.push(nr * c, nr * s, nh);
    }
  };
  for (let e = 0; e < n; e++) {
    const [r1, h1] = profile[e];
    const [r2, h2] = profile[(e + 1) % n];
    const len = Math.hypot(r2 - r1, h2 - h1) || 1;
    const nr = (h2 - h1) / len, nh = -(r2 - r1) / len;
    for (let s = 0; s < segments; s++) {
      const a1 = start + s / segments * Math.PI * 2;
      const a2 = start + (s + 1) / segments * Math.PI * 2;
      const first = positions.length / 3;
      if (facets) {
        const mid = (a1 + a2) / 2, k = Math.cos((a2 - a1) / 2);
        const cm = Math.cos(mid), sm = Math.sin(mid);
        for (const [r, h, a] of [[r1, h1, a1], [r1, h1, a2], [r2, h2, a2], [r2, h2, a1]]) {
          const c = Math.cos(a), s2 = Math.sin(a);
          if (axis === "y") {
            positions.push(r * c, h, r * s2);
            normals.push(nr * cm, nh * k, nr * sm);
          } else {
            positions.push(r * c, r * s2, h);
            normals.push(nr * cm, nr * sm, nh * k);
          }
        }
      } else {
        put(r1, h1, a1, nr, nh);
        put(r1, h1, a2, nr, nh);
        put(r2, h2, a2, nr, nh);
        put(r2, h2, a1, nr, nh);
      }
      if (axis === "y") index.push(first, first + 2, first + 1, first, first + 3, first + 2);
      else index.push(first, first + 1, first + 2, first, first + 2, first + 3);
    }
  }
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new THREE2.BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(index);
  return geometry;
}
function buildBlock(size, position = [0, 0, 0], rotation = [0, 0, 0], { taper = 0 } = {}) {
  const geometry = new THREE2.BoxGeometry(size[0], size[1], size[2]);
  geometry.deleteAttribute("uv");
  if (taper) {
    const p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > 0) p.setXYZ(i, p.getX(i) * (1 - taper), p.getY(i), p.getZ(i) * (1 - taper));
    }
    geometry.computeVertexNormals();
  }
  const matrix = new THREE2.Matrix4().compose(
    new THREE2.Vector3(...position),
    new THREE2.Quaternion().setFromEuler(new THREE2.Euler(...rotation)),
    new THREE2.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(matrix);
  return geometry;
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
var METALS = {
  bronze: { label: "Bronze", ramp: ["#3a2622", "#6b4527", "#a5702f", "#dcae58"], ink: "#22140f" },
  gold: { label: "Or", ramp: ["#5a3418", "#9a6320", "#d39a2c", "#f6d878"], ink: "#341c0e" },
  iron: { label: "Fer", ramp: ["#262833", "#40434f", "#666a74", "#9a9ca2"], ink: "#16171e" },
  // Le Complexe : métaux vieillis. Le bronze patiné verdit dans l'ombre (vert-de-gris) ; le dernier ton des rampes
  // à 5 couleurs est l'arête polie ou le reflet d'un pixel (seuil haut dans `steps`).
  patinatedBronze: { label: "Bronze patin\xE9", ramp: ["#263732", "#4a7366", "#8a6a3b", "#b48a4c", "#e2c47e"], ink: "#16130f" },
  blackenedBrass: { label: "Laiton noirci", ramp: ["#221b11", "#3b2f1a", "#5e4a26", "#857036", "#d6c27c"], ink: "#120e08" },
  oxidizedCopper: { label: "Cuivre oxyd\xE9", ramp: ["#1c3532", "#2c5a51", "#3f7f6e", "#68a58b", "#c98b6b"], ink: "#0f1d1c" },
  castIron: { label: "Fonte", ramp: ["#16171c", "#25272e", "#3a3d45", "#5c6069"], ink: "#0b0c0f" }
};
var GLOWS = {
  amber: { label: "Ambre", ramp: ["#5a2a12", "#b8581c", "#ff9a3c", "#ffd796"], light: "#ff9a3c" },
  cyan: { label: "Cyan", ramp: ["#12505e", "#2a9bb0", "#5fd4e6", "#d6fbff"], light: "#5fd4e6" },
  alarm: { label: "Rouge d'alerte", ramp: ["#3a0d0c", "#6e1815", "#a3261f", "#e0574a"], light: "#c8302a" }
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

// src/assets/kit/complex-parts.js
import * as THREE3 from "three";
var PX = 1 / 16;
function plain(geometry) {
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
  }
  if (!geometry.index) {
    const count = geometry.attributes.position.count;
    const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    geometry.setIndex(new THREE3.BufferAttribute(index, 1));
  }
  geometry.clearGroups();
  return geometry;
}
function withTone(geometry, tone) {
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  const old = geometry.attributes.aTone;
  const array = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const t = typeof tone === "function" ? tone(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)) : tone;
    array[i] = t + (old ? old.getX(i) : 0);
  }
  geometry.setAttribute("aTone", new THREE3.BufferAttribute(array, 1));
  return geometry;
}
function mergeToned(geometries) {
  for (const name of ["aTone", "aShade"]) {
    if (!geometries.some((g) => g.attributes[name])) continue;
    for (const g of geometries) {
      if (!g.attributes[name]) g.setAttribute(name, new THREE3.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    }
  }
  return mergeGeometries(geometries);
}
function withShade(geometry, index, count = 2) {
  const array = new Float32Array(geometry.attributes.position.count).fill((index + 0.5) / count);
  geometry.setAttribute("aShade", new THREE3.BufferAttribute(array, 1));
  return geometry;
}
var snap = (v) => Math.round(v / PX) * PX;
function buildMasonry(rng, o) {
  const {
    width,
    height,
    depth = 0.6,
    holes = [],
    band = null,
    course = [0.42, 0.66],
    block = [0.5, 1.1],
    bothSides = false,
    soot: sootAmount = -0.24,
    split = Infinity,
    facing = true
  } = o;
  const relief = 0.09;
  const front = depth / 2;
  const core = front - relief;
  const back = -depth / 2;
  const backCore = bothSides ? back + relief : back;
  const sootAt = soot(height * 0.55, height, sootAmount);
  const parts = [];
  const fixed = /* @__PURE__ */ new Set([0, snap(height)]);
  if (band) fixed.add(snap(band.y0)).add(snap(band.y1));
  for (const h of holes) {
    if (h.y0 > 0.01) fixed.add(snap(h.y0));
    if (h.y1 < height - 0.01) fixed.add(snap(h.y1));
  }
  const bounds = [...fixed].filter((y) => y >= 0 && y <= height + 1e-6).sort((a, b) => a - b);
  const courses = [0];
  for (let i = 0; i < bounds.length - 1; i++) {
    const gap = bounds[i + 1] - bounds[i];
    const n = Math.max(1, Math.round(gap / rng.range(course[0], course[1])));
    for (let k = 1; k <= n; k++) courses.push(k === n ? bounds[i + 1] : snap(bounds[i] + gap * k / n));
  }
  const box = (x0, x1, y0, y1, z0, z1, tone) => {
    const n = Math.max(1, Math.ceil((x1 - x0) / split - 1e-6));
    for (let k = 0; k < n; k++) {
      const a = x0 + (x1 - x0) * k / n, b = x0 + (x1 - x0) * (k + 1) / n;
      const g = buildBlock([b - a, y1 - y0, z1 - z0], [(a + b) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
      parts.push(withTone(g, (x, y, z) => tone + sootAt(x, y)));
    }
  };
  for (let c = 0; c < courses.length - 1; c++) {
    const y0 = courses[c], y1 = courses[c + 1];
    const mid = (y0 + y1) / 2;
    const isBand = band && Math.abs(y0 - snap(band.y0)) < 1e-6 && Math.abs(y1 - snap(band.y1)) < 1e-6;
    let spans = [[-width / 2, width / 2]];
    const cut = [];
    for (const h of holes) {
      if (mid < h.y0 || mid > h.y1) continue;
      cut.push(h);
      spans = spans.flatMap(([a, b]) => {
        if (h.x1 <= a || h.x0 >= b) return [[a, b]];
        const out = [];
        if (h.x0 > a) out.push([a, h.x0]);
        if (h.x1 < b) out.push([h.x1, b]);
        return out;
      });
    }
    for (const h of cut) {
      if (h.depth == null) continue;
      box(h.x0, h.x1, y0, y1, backCore, front - h.depth, -0.32);
    }
    for (const [a, b] of spans) {
      if (b - a < 1e-3) continue;
      if (isBand) {
        box(a, b, y0, y1, back, front - PX, -0.12);
        continue;
      }
      box(a, b, y0, y1, backCore, core, -0.34);
      if (!facing) continue;
      let x = a;
      while (b - x > 1e-3) {
        let len = rng.range(block[0], block[1]);
        if (b - (x + len) < block[0] * 0.6) len = b - x;
        const x1 = Math.min(b, snap(x + len) || b);
        const end = x1 <= x ? b : x1;
        const tone = rng.range(-0.08, 0.08);
        box(x + PX / 2, end - PX / 2, y0 + PX / 2, y1 - PX / 2, core - 0.01, front, tone);
        if (bothSides) box(x + PX / 2, end - PX / 2, y0 + PX / 2, y1 - PX / 2, back, backCore + 0.01, rng.range(-0.08, 0.08));
        x = end;
      }
    }
  }
  return { parts, courses, bandFace: front - PX, coreFace: core };
}
function glowMixMaterial(colors, { id = 40 } = {}) {
  const ramp = colors.map(([name, level]) => {
    const r = (GLOWS[name] ?? GLOWS.amber).ramp;
    return r[Math.max(0, Math.min(r.length - 1, Math.round(level)))];
  });
  if (ramp.length === 1) ramp.push(ramp[0]);
  const steps = ramp.slice(1).map((_, i) => (i + 1) / ramp.length);
  return createToonMaterial({ ramp, steps, unlit: true, shade: true, emissive: 1e-3, glow: false, outline: false, id });
}
function soot(from, to, amount = -0.22) {
  return (x, y) => amount * THREE3.MathUtils.smoothstep(y, from, to);
}
var toVector = (v) => v?.isVector3 ? v : new THREE3.Vector3(...v ?? [0, 0, 0]);
function beam(a, b, w, h = w, roll = 0, up = new THREE3.Vector3(0, 1, 0)) {
  a = toVector(a);
  b = toVector(b);
  const dir = new THREE3.Vector3().subVectors(b, a);
  const length = dir.length();
  dir.normalize();
  const geometry = buildBlock([w, h, length]);
  const side = new THREE3.Vector3().crossVectors(Math.abs(dir.dot(up)) > 0.99 ? new THREE3.Vector3(1, 0, 0) : up, dir).normalize();
  const top = new THREE3.Vector3().crossVectors(dir, side);
  const basis = new THREE3.Matrix4().makeBasis(side, top, dir);
  geometry.applyMatrix4(new THREE3.Matrix4().makeRotationZ(roll));
  geometry.applyMatrix4(basis);
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geometry;
}
function straightGlyphRuns(rng, columns, rows = 2) {
  const grid = Array.from({ length: rows }, () => new Uint8Array(columns));
  let col = rng.int(0, 1);
  while (col < columns) {
    const width = Math.min(rng.pick([1, 2, 2, 3, 3]), columns - col);
    const cells = Array.from({ length: rows }, () => new Uint8Array(width));
    if (width === 1 || rng.next() < 0.7) {
      const c = rng.int(0, width - 1);
      const from = rows > 2 ? rng.int(0, 1) : 0;
      const to = rows > 2 ? rows - 1 - rng.int(0, 1) : rows - 1;
      for (let r = from; r <= to; r++) cells[r][c] = 1;
    }
    for (let r = 0; r < rows; r++) {
      if (width > 1 && rng.next() < 0.5) {
        const a = rng.int(0, width - 2);
        const b = rng.int(a + 1, width - 1);
        for (let c = a; c <= b; c++) cells[r][c] = 1;
      }
    }
    let filled = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < width; c++) filled += cells[r][c];
    if (filled === 0) cells[rng.int(0, rows - 1)][rng.int(0, width - 1)] = 1;
    if (filled === rows * width && filled > 2) cells[rng.int(0, rows - 1)][rng.int(0, width - 1)] = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < width; c++) grid[r][col + c] = cells[r][c];
    col += width + (rng.next() < 0.18 ? 2 : 1);
  }
  const runs = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < columns) {
      if (!grid[r][c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < columns && grid[r][c]) c++;
      runs.push([start, r, c - start]);
    }
  }
  return runs;
}
function glyphStrip(rng, { length, rows = 2, style = "straight", pixel = PX, depth = 0.012 }) {
  const parts = [];
  if (style === "straight") {
    const columns = Math.max(1, Math.floor(length / pixel));
    const x0 = -(columns * pixel) / 2;
    for (const [c, r, n] of straightGlyphRuns(rng, columns, rows)) {
      parts.push(buildBlock([n * pixel, pixel, depth], [x0 + (c + n / 2) * pixel, (r + 0.5) * pixel, depth / 2]));
    }
  } else {
    const size = rows * pixel;
    const count = Math.max(1, Math.floor(length / (size + pixel)));
    const x0 = -(count * (size + pixel)) / 2 + (size + pixel) / 2;
    const w = pixel * 0.75;
    const seg = (ax, ay, bx, by) => {
      parts.push(beam([ax, ay, depth / 2], [bx, by, depth / 2], w, depth, 0, new THREE3.Vector3(0, 0, 1)));
    };
    for (let i = 0; i < count; i++) {
      const cx = x0 + i * (size + pixel);
      const cy = size / 2;
      const kind = rng.pick(["dot", "ring", "arc", "arc", "spiral"]);
      const radius = size / 2 - w / 2;
      if (kind === "dot") {
        parts.push(buildBlock([pixel, pixel, depth], [cx, cy, depth / 2], [0, 0, Math.PI / 4]));
        continue;
      }
      const turns = kind === "spiral" ? 1.6 : kind === "ring" ? 1 : 0.5;
      const steps = Math.max(5, Math.round(10 * turns));
      const start = rng.next() * Math.PI * 2;
      let px = null, py = null;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const a = start + t * turns * Math.PI * 2;
        const r = kind === "spiral" ? radius * (0.2 + 0.8 * t) : radius;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (px !== null) seg(px, py, x, y);
        px = x;
        py = y;
      }
      if (kind === "arc") parts.push(buildBlock([pixel * 0.8, pixel * 0.8, depth], [cx, cy, depth / 2]));
    }
  }
  if (parts.length === 0) parts.push(buildBlock([pixel, pixel, depth], [0, pixel / 2, depth / 2]));
  return mergeGeometries(parts);
}
function rivetRow(from, to, { spacing = 0.25, size = PX, depth = PX * 0.6, normal = [0, 0, 1] } = {}) {
  from = toVector(from);
  to = toVector(to);
  const n = toVector(normal).normalize();
  const count = Math.max(1, Math.round(from.distanceTo(to) / spacing) + 1);
  const parts = [];
  const point = new THREE3.Vector3();
  for (let i = 0; i < count; i++) {
    point.lerpVectors(from, to, count === 1 ? 0.5 : i / (count - 1));
    const a = point.clone().addScaledVector(n, -depth / 2);
    const b = point.clone().addScaledVector(n, depth / 2);
    parts.push(beam(a, b, size, size));
  }
  return mergeGeometries(parts);
}
function ring({ radius, height = 2 * PX, y = 0, thickness = PX, segments = 16, facets = true }) {
  return buildLathe(
    [[radius, y], [radius + thickness, y], [radius + thickness, y + height], [radius, y + height]],
    { segments, facets }
  );
}
function bulb({ radius = PX, position = [0, 0, 0], segments = 6 } = {}) {
  const geometry = plain(new THREE3.SphereGeometry(radius, segments, Math.max(3, segments - 2)));
  const p = toVector(position);
  geometry.translate(p.x, p.y, p.z);
  return geometry;
}
function stoneMaterial(entry, { seed = 0, id = 20, grain = 0.06, crease = true } = {}) {
  return createToonMaterial({
    ramp: entry.ramp,
    ink: entry.ink,
    steps: entry.ramp.length === 5 ? [0.3, 0.5, 0.7, 0.9] : [0.32, 0.54, 0.78],
    pattern: "speckle",
    patternParams: [16, grain, 0.2, 1],
    seed,
    crease,
    tone: true,
    id
  });
}
function metalMaterial(entry, { id = 30, crease = true, grain = 0, seed = 0, tone = false } = {}) {
  const five = entry.ramp.length === 5;
  return createToonMaterial({
    ramp: entry.ramp,
    ink: entry.ink,
    steps: five ? [0.28, 0.46, 0.68, 0.9] : [0.3, 0.52, 0.76],
    pattern: grain > 0 ? "speckle" : "none",
    patternParams: [16, grain, 0.18, 0.5],
    seed,
    crease,
    tone,
    id
  });
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

// src/assets/buildings/structure/complex-door.js
var DEPTH = 0.6;
var BAND = { y0: 1, y1: 1.25 };
var MODELS = {
  standard: "Porte standard",
  study: "Porte d'\xE9tude (hublot, voyant)",
  double: "Grande porte \xE0 deux battants",
  link: "Grande porte de liaison (grav\xE9e)",
  emergency: "Issue de secours"
};
var SPECS = {
  standard: { w: 1.4, h: 2.8, module: 2, leaves: 1 },
  study: { w: 1.4, h: 2.8, module: 2, leaves: 1 },
  emergency: { w: 1.4, h: 2.8, module: 2, leaves: 1 },
  double: { w: 3, h: 5, module: 4, leaves: 2 },
  link: { w: 3, h: 5, module: 4, leaves: 2 }
};
var STATES = { closed: "Ferm\xE9e", open: "Ouverte", cycle: "S'ouvre et se ferme en boucle" };
var GLYPHS = { lit: "Allum\xE9s", dim: "En veille", off: "\xC9teints" };
var LEVELS = { lit: 2, dim: 1, off: 0 };
var SWING = 1.4;
var params = {
  seed: seedParam("Change l'appareil du mur, les glyphes du chambranle, les tons des panneaux, la gravure de la porte de liaison."),
  model: choiceParam("Mod\xE8le", MODELS, "Standard (1,4 \xD7 2,8 m), d'\xE9tude (hublot, plaque, voyant), grande porte double ou de liaison (3 \xD7 5 m), issue de secours."),
  state: choiceParam("\xC9tat", STATES, "Ferm\xE9e, ouverte, ou qui s'ouvre et se ferme en boucle (pour la regarder). Pilotable : group.userData.door."),
  number: { type: "int", default: 1, min: 1, max: 5, label: "Num\xE9ro", description: "Porte d'\xE9tude : le num\xE9ro de la salle, en traits sur la plaque (1 \xE0 5)." },
  light: choiceParam("Voyant", { auto: "Selon le mod\xE8le", amber: "Ambre", alarm: "Rouge d'alerte", cyan: "Cyan" }, "Couleur du voyant (portes d'\xE9tude, de liaison, de secours) ; \xAB selon le mod\xE8le \xBB : rouge pour l'issue de secours, ambre sinon."),
  glyphs: choiceParam("Glyphes", GLYPHS, "La ligne de glyphes du chambranle et du bandeau : allum\xE9e, en veille ou \xE9teinte."),
  height: numberParam("Hauteur du mur", 5, 4, 8, "Hauteur du module de mur autour de la porte (au moins 5,7 m pour une grande porte).", { step: 0.5, unit: "m" }),
  stone: stoneParam("Pierre du mur et du chambranle.", { only: ["blackBasalt", "smoked"] })
};
var meta = {
  id: "buildings/structure/complex-door",
  name: "Porte du Complexe",
  nameEn: "Ancient complex door",
  category: "buildings",
  subcategory: "structure",
  description: "Module de mur perc\xE9 d'une porte haute du Complexe : chambranle de pierre \xE0 glyphes, vantaux de bronze \xE0 panneaux qui pivotent sur leurs charni\xE8res. Porte standard, d'\xE9tude (hublot, plaque num\xE9rot\xE9e, voyant), grande porte \xE0 deux battants, porte de liaison grav\xE9e, issue de secours en fonte. Ferm\xE9e, ouverte, ou pilot\xE9e par le sc\xE9nario.",
  tags: [
    "porte",
    "vantail",
    "battants",
    "grande porte",
    "hublot",
    "voyant",
    "chambranle",
    "bronze",
    "glyphes",
    "issue de secours",
    "le complexe",
    "complexe",
    "ancien-tech",
    "modulaire",
    "anim\xE9",
    "pilotable",
    "int\xE9rieur",
    "door",
    "door leaf",
    "double door",
    "porthole",
    "status light",
    "door frame",
    "glyphs",
    "emergency exit",
    "ancient complex",
    "ancient-tech",
    "modular",
    "animated",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au milieu de la baie ; le mur suit l'axe x (2 m de large, 4 m pour les grandes portes), face avant en +z ; les vantaux s'ouvrent vers \u2212z",
  footprint: { radius: 2.15, height: 5.7 },
  animated: ["door", "glow"],
  params,
  variants: variantsOf("model", params.model)
};
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const spec = SPECS[p.model];
  const stone = STONES[p.stone];
  const layout = createRng(p.seed * 7919 + 17);
  const masonryRng = createRng(p.seed * 104729 + 71);
  const glyphRng = createRng(p.seed * 15485863 + 3);
  const W = spec.module;
  const H = Math.max(p.height, spec.h + 0.7);
  const ow = spec.w, oh = spec.h;
  const jamb = 0.2, lintel = 0.3;
  const fw = ow + jamb * 2, fh = oh + lintel;
  const front = DEPTH / 2;
  const big = spec.leaves === 2;
  const level = LEVELS[p.glyphs];
  const masonry = buildMasonry(masonryRng, {
    width: W,
    height: H,
    depth: DEPTH,
    band: BAND,
    holes: [{ x0: -fw / 2, x1: fw / 2, y0: 0, y1: fh }]
  });
  const stoneParts = masonry.parts;
  const glowParts = [];
  const frameTone = (x, y) => 0.14 + (y > H * 0.55 ? -0.18 * Math.min(1, (y - H * 0.55) / (H * 0.45)) : 0);
  const fd = DEPTH + 0.06;
  for (const s of [-1, 1]) stoneParts.push(withTone(buildBlock([jamb, oh, fd], [s * (ow / 2 + jamb / 2), oh / 2, 0]), frameTone));
  stoneParts.push(withTone(buildBlock([fw + 0.08, lintel, fd + 0.02], [0, oh + lintel / 2, 0]), frameTone));
  stoneParts.push(withTone(buildBlock([ow, PX * 1.2, DEPTH], [0, PX * 0.6, 0]), -0.05));
  for (const s of [-1, 1]) {
    const a = s < 0 ? -W / 2 : fw / 2, b = s < 0 ? -fw / 2 : W / 2;
    if (b - a < 0.3) continue;
    const strip = glyphStrip(glyphRng, { length: b - a - 0.12, rows: 2 });
    strip.translate((a + b) / 2, 1.1 - PX, masonry.bandFace);
    glowParts.push(withShade(strip, 0));
  }
  if (p.model !== "emergency") {
    const strip = glyphStrip(glyphRng, { length: fw - 0.3, rows: 2 });
    strip.translate(0, oh + lintel / 2 - PX, fd / 2 + 0.01);
    glowParts.push(withShade(strip, 0));
  }
  if (p.model === "study" || p.model === "emergency" || p.model === "link") {
    const at = p.model === "link" ? [ow / 2 + jamb / 2, 3, fd / 2 + 0.05] : [0, fh + 0.16, front + 0.06];
    stoneParts.push(withTone(buildBlock([0.2, 0.2, 0.1], [at[0], at[1], at[2] - 0.05]), 0.05));
    glowParts.push(withShade(bulb({ radius: PX * 1.2, position: at }), 1));
  }
  const metal = p.model === "emergency" ? METALS.castIron : METALS.patinatedBronze;
  const thick = big ? 0.14 : 0.1;
  const leafW = ow / spec.leaves - 0.01;
  const leafH = oh - 0.02;
  const pivots = [];
  const leafGeometries = [];
  const motif = big ? straightGlyphRuns(createRng(p.seed * 31 + 7), 5, 7) : null;
  for (let k = 0; k < spec.leaves; k++) {
    const dir = k === 0 ? 1 : -1;
    const px = k === 0 ? -ow / 2 : ow / 2;
    pivots.push({ x: px, sign: dir });
    const cx = px + dir * leafW / 2;
    const parts = [];
    const panelTone = layout.range(-0.06, 0.06);
    parts.push(withTone(buildBlock([leafW, leafH, thick], [cx, 0.01 + leafH / 2, 0]), panelTone));
    const rows = big ? 3 : 2;
    const margin = big ? 0.2 : 0.14;
    const ph = (leafH - margin * 2 - (rows - 1) * margin * 0.6) / rows;
    const panels = p.model === "study" ? [[margin, 1.2], [1.86, leafH - margin]] : Array.from({ length: rows }, (_, r) => [margin + r * (ph + margin * 0.6), margin + r * (ph + margin * 0.6) + ph]);
    for (const [y0, y1] of panels) {
      for (const face of [1, -1]) {
        parts.push(withTone(buildBlock([leafW - margin * 2, y1 - y0, PX * 0.3], [cx, (y0 + y1) / 2, face * (thick / 2 + PX * 0.15)]), panelTone - 0.24));
      }
    }
    for (const face of [1, -1]) {
      for (const ex of [cx - leafW / 2 + margin / 2, cx + leafW / 2 - margin / 2]) {
        parts.push(withTone(rivetRow([ex, 0.15, face * (thick / 2 + PX * 0.2)], [ex, leafH - 0.15, face * (thick / 2 + PX * 0.2)], { spacing: big ? 0.35 : 0.3, normal: [0, 0, face] }), 0.3));
      }
    }
    const hinges = big ? 5 : 3;
    for (let i = 0; i < hinges; i++) {
      const y = 0.3 + (leafH - 0.6) * i / (hinges - 1);
      parts.push(withTone(buildBlock([0.1, big ? 0.24 : 0.16, thick + 0.06], [px + dir * 0.04, y, 0]), 0.18));
    }
    const freeX = px + dir * (leafW - (big ? 0.35 : 0.18));
    if (p.model === "emergency") {
      for (const face of [1, -1]) {
        parts.push(withTone(buildBlock([leafW - 0.3, 0.08, 0.05], [cx, 1, face * (thick / 2 + 0.05)]), 0.25));
        for (const ex of [cx - leafW / 2 + 0.2, cx + leafW / 2 - 0.2]) parts.push(withTone(buildBlock([0.05, 0.08, 0.05], [ex, 1, face * (thick / 2 + 0.025)]), 0.1));
      }
    } else {
      const rr = big ? 0.17 : 0.07;
      for (const face of [1, -1]) {
        const loop = ring({ radius: rr, height: PX * 0.8, thickness: PX, segments: big ? 12 : 8 });
        loop.rotateX(Math.PI / 2);
        loop.translate(freeX, (big ? 1.2 : 1.05) - rr, face * (thick / 2 + PX * 0.5));
        parts.push(withTone(loop, 0.2));
        parts.push(withTone(buildBlock([0.08, 0.08, PX], [freeX, big ? 1.2 : 1.05, face * (thick / 2 + PX * 0.5)]), 0.05));
      }
    }
    if (p.model === "study") {
      const hx = cx, hy = 1.6;
      const rim = ring({ radius: 0.15, height: thick + 0.04, thickness: PX, segments: 12 });
      rim.rotateX(Math.PI / 2);
      rim.translate(hx, hy, (thick + 0.04) / 2);
      parts.push(withTone(rim, 0.2));
      const glass = new THREE4.CylinderGeometry(0.15, 0.15, thick + 0.01, 12);
      glass.deleteAttribute("uv");
      glass.rotateX(Math.PI / 2);
      glass.translate(hx, hy, 0);
      parts.push(withTone(glass, -0.8));
      for (const face of [1, -1]) parts.push(withTone(buildBlock([PX, PX, 4e-3], [hx - 0.06, hy + 0.06, face * ((thick + 0.01) / 2)]), 0.9));
      const plate = buildBlock([0.26, 0.14, PX * 0.4], [hx, 1.33, thick / 2 + PX * 0.2]);
      parts.push(withTone(plate, 0.28));
      for (let i = 0; i < p.number; i++) {
        const x = hx + (i - (p.number - 1) / 2) * PX * 2;
        parts.push(withTone(buildBlock([PX, 0.08, 4e-3], [x, 1.33, thick / 2 + PX * 0.4]), -0.9));
      }
    }
    if (big) {
      for (const y of [0.45, leafH / 2, leafH - 0.45]) {
        for (const face of [1, -1]) parts.push(withTone(buildBlock([0.06, 0.42, 0.04], [px + dir * (leafW - 0.09), y, face * (thick / 2 + 0.02)]), 0.12));
      }
      if (p.model === "link") {
        const cell = 0.12;
        for (const [c, r, n] of motif) {
          const x0 = (c + n / 2) * cell;
          const xx = px + dir * (leafW - 0.25 - x0);
          const yy = 2.1 + (6 - r) * cell + cell / 2;
          for (const face of [1, -1]) parts.push(withTone(buildBlock([n * cell - PX, cell - PX, PX * 0.4], [xx, yy, face * (thick / 2 + PX * 0.2)]), -0.55));
        }
      }
    }
    leafGeometries.push(mergeToned(parts));
  }
  const counts = leafGeometries.map((g) => g.attributes.position.count);
  const leafGeometry = mergeToned(leafGeometries);
  const group = new THREE4.Group();
  group.name = meta.name;
  const wall = new THREE4.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: layout.int(0, 96), id: 20, grain: 0.06 }));
  wall.name = "wall";
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);
  const leaves = new THREE4.Mesh(leafGeometry, metalMaterial(metal, { id: 21, tone: true }));
  leaves.name = "leaves";
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(leaves);
  const light = p.light === "auto" ? p.model === "emergency" ? "alarm" : "amber" : p.light;
  const glow = new THREE4.Mesh(mergeToned(glowParts), glowMixMaterial([["amber", level], [light, 3]], { id: 22 }));
  glow.name = "glow";
  group.add(glow);
  const position = leafGeometry.attributes.position;
  const normal = leafGeometry.attributes.normal;
  const basePosition = position.array.slice();
  const baseNormal = normal.array.slice();
  const leafOf = new Uint8Array(position.count);
  let offset = 0;
  counts.forEach((count, k) => {
    leafOf.fill(k, offset, offset + count);
    offset += count;
  });
  let shown = -1;
  const pose = (t) => {
    if (Math.abs(t - shown) < 1e-4) return;
    shown = t;
    const theta = Math.PI / 2 * 0.96 * t;
    const cs = pivots.map(({ sign }) => [Math.cos(theta * sign), Math.sin(theta * sign)]);
    for (let i = 0; i < position.count; i++) {
      const [c, s] = cs[leafOf[i]];
      const px = pivots[leafOf[i]].x;
      const x = basePosition[i * 3] - px, z = basePosition[i * 3 + 2];
      position.array[i * 3] = px + x * c + z * s;
      position.array[i * 3 + 2] = -x * s + z * c;
      const nx = baseNormal[i * 3], nz = baseNormal[i * 3 + 2];
      normal.array[i * 3] = nx * c + nz * s;
      normal.array[i * 3 + 2] = -nx * s + nz * c;
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    leafGeometry.computeBoundingSphere();
  };
  const ease = (t) => t * t * (3 - 2 * t);
  const door = {
    opening: { width: ow, height: oh, x0: -ow / 2, x1: ow / 2 },
    openness: p.state === "open" ? 1 : 0,
    get blocking() {
      return this.openness < 0.85;
    },
    open() {
      tween = { from: door.openness, to: 1, start: sharedUniforms.uTime.value };
    },
    close() {
      tween = { from: door.openness, to: 0, start: sharedUniforms.uTime.value };
    },
    setOpen(t) {
      tween = null;
      cycling = false;
      door.openness = THREE4.MathUtils.clamp(t, 0, 1);
      pose(ease(door.openness));
    }
  };
  let tween = null;
  let cycling = p.state === "cycle";
  pose(ease(door.openness));
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      if (tween) {
        cycling = false;
        const k = Math.min(1, (time - tween.start) / (SWING * Math.abs(tween.to - tween.from) || 1));
        door.openness = tween.from + (tween.to - tween.from) * k;
        if (k >= 1) tween = null;
      } else if (cycling) {
        const u = time % 6 / 6;
        door.openness = u < 0.25 ? 0 : u < 0.5 ? (u - 0.25) * 4 : u < 0.75 ? 1 : 1 - (u - 0.75) * 4;
      }
      pose(ease(door.openness));
    }
    baseUpdate(force);
  };
  group.userData.door = door;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
export {
  create,
  disposeObject as dispose,
  meta,
  setWind,
  tick
};
