// Projet Vie 3D — Rayonnage à tiroirs (furniture/storage/drawer-archive), version 1
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/furniture/storage/drawer-archive.js
import * as THREE4 from "three";

// src/engine/toon-material.js
import * as THREE from "three";
var GLOW_LIGHT_COUNT = 12;
var sharedUniforms = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.92, 0.38) },
  uWindStrength: { value: 1 },
  // Lumières de halo (créatures qui brillent, lanternes...) : xyz position dans le monde, w portée (m) ; couleur
  // rgb + force. Elles ne comptent que dans le noir (`uDarkness`).
  uGlowLights: { value: Array.from({ length: GLOW_LIGHT_COUNT }, () => new THREE.Vector4(0, 0, 0, 0)) },
  // w = 0 : place libre
  uGlowColors: { value: Array.from({ length: GLOW_LIGHT_COUNT }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uDarkness: { value: 0 },
  // Monde courbé : xy centre (x, z du monde, la caméra), z courbure (1 / 2R), w distance où la courbure commence (m).
  uCurve: { value: new THREE.Vector4(0, 0, 0, 0) },
  // 1 : le décor est vu de côté (caméra à la 3e personne), voir setSideView.
  uSideView: { value: 0 },
  // Vue en coupe (intérieurs, voir setCutaway) : xy position du promeneur (x, z), zw direction horizontale vers la
  // caméra ; options : x 1 = active, y marge (m).
  uCutAway: { value: new THREE.Vector4(0, 0, 0, 1) },
  uCutOptions: { value: new THREE.Vector2(0, 0.3) }
};
var glowSlots = Array.from({ length: GLOW_LIGHT_COUNT }, () => false);
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
uniform float uSideView;
uniform vec2 uFade; // apparition en douceur : de x \xE0 y m\xE8tres de la cam\xE9ra, la copie rentre dans le sol (0, 0 : rien)
uniform vec3 uLod;  // FOLIAGE, passage \xE0 la version lointaine : de x \xE0 y m\xE8tres, les feuilles absentes de cette
                    // version (aFar 0) rapetissent jusqu'\xE0 rien, les autres grandissent de z (y \xE0 0 : rien)
#ifdef CUTAWAY
  uniform vec4 uCutAway;
  uniform vec2 uCutOptions;
  uniform vec2 uCut; // x : r\xE8gle (1 le long d'un mur, 2 isol\xE9, 3 pilier d'angle), y : hauteur de coupe (< 0 : cach\xE9)
#endif
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
#ifdef DITHER
  attribute float aCover; // part des pixels dessin\xE9s (0..1), tram\xE9e : faisceau, voile
  varying float vCover;
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
  #ifdef CUTAWAY
    // Vue en coupe : l'objet entier est coup\xE9 ou non selon la place de son origine (voir enableCutaway).
    if (uCutOptions.x > 0.5) {
      mat4 cutWorld = modelMatrix;
      #ifdef USE_INSTANCING
        cutWorld = modelMatrix * instanceMatrix;
      #endif
      vec2 toObject = cutWorld[3].xz - uCutAway.xy;
      bool cut;
      if (uCut.x < 1.5) {
        vec2 n = cutWorld[2].xz;
        n /= max(length(n), 1e-5);
        float facing = dot(n, uCutAway.zw);
        cut = abs(facing) > 0.3 && dot(toObject, n) * sign(facing) > uCutOptions.y;
      } else if (uCut.x < 2.5) {
        cut = dot(toObject, uCutAway.zw) > uCutOptions.y;
      } else {
        vec2 side = toObject * sign(uCutAway.zw);
        cut = (abs(uCutAway.z) > 0.3 && side.x > uCutOptions.y) || (abs(uCutAway.w) > 0.3 && side.y > uCutOptions.y);
      }
      // Cach\xE9 : tous les sommets au m\xEAme point, plus aucun triangle n'a de surface.
      if (cut) transformed = uCut.y < 0.0 ? vec3(0.0) : vec3(transformed.x, min(transformed.y, uCut.y), transformed.z);
    }
  #endif
  vObjPos = transformed;
  #ifdef TONE
    vTone = aTone;
  #endif
  #ifdef SHADE
    vShade = aShade;
  #endif
  #ifdef DITHER
    vCover = aCover;
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
      // Vue de c\xF4t\xE9 (3e personne, setSideView) : les feuilles sombres du c\u0153ur de la couronne (aLeaf.y petit), faites
      // pour remplir l'arbre vu de haut, se verraient entre les feuilles du bord comme des \xE9toiles noires (deux
      // triangles sombres qui se croisent) : elles rapetissent d'autant plus qu'elles sont profondes.
      // Les feuilles du bord grandissent un peu pour garder une couronne aussi pleine.
      cornerScale *= mix(1.0, mix(0.2, 1.15, smoothstep(0.15, 0.75, aLeaf.y)), uSideView);
      if (uLod.y > 0.0) {
        float lod = smoothstep(uLod.x, uLod.y, distance(origin, cameraPosition));
        // Seules les feuilles du bord grandissent (aLeaf.y : 0 c\u0153ur, 1 dehors) : un c\u0153ur sombre agrandi ferait une
        // \xE9toile noire dans la couronne.
        cornerScale *= mix(1.0, aFar * mix(1.0, uLod.z, aLeaf.y), lod);
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
uniform vec4 uGlowLights[${GLOW_LIGHT_COUNT}];
uniform vec4 uGlowColors[${GLOW_LIGHT_COUNT}];
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
#ifdef DITHER
  varying float vCover;
#endif
uniform vec2 uRim; // x : lumi\xE8re ajout\xE9e sur le bord de la silhouette, y : largeur de la frange (0..1, en 1 - normale.z)
#ifdef REVEAL
  uniform vec4 uReveal;   // xyz : centre (monde), w : rayon (m) ; au-del\xE0, la mati\xE8re prend la couleur \xE9teinte
  uniform vec3 uRevealOff;
#endif

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
  #ifdef DITHER
    // Trame de Bayer 4 \xD7 4 par pixel d'art : seule une part vCover des pixels est dessin\xE9e (faisceau de lumi\xE8re).
    {
      const float bayerD[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      ivec2 cellD = ivec2(mod(gl_FragCoord.xy, 4.0));
      if (vCover <= (bayerD[cellD.x + cellD.y * 4] + 0.5) / 16.0) discard;
    }
  #endif
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
  float revealed = 1.0;
  #ifdef REVEAL
    // Lueurs qui s'allument en vague (enableReveal) : hors de la sph\xE8re, la couleur \xE9teinte, sans \xE9clat propre.
    revealed = step(distance(vWorldPos, uReveal.xyz), uReveal.w);
    color = mix(uRevealOff, color, revealed);
  #endif

  // Lumi\xE8res de halo : dans le noir, le d\xE9cor proche prend la couleur de la source, en trois paliers nets \xE0
  // fronti\xE8re tram\xE9e. Le palier est \xE9crit dans l'alpha : la passe finale ne l'assombrit pas de la teinte de nuit.
  float glowLevel = 0.0;
  if (uGlowReceive > 0.5 && uDarkness > 0.001) {
    vec3 glowTint = vec3(0.0);
    float glowSum = 0.0;
    for (int i = 0; i < ${GLOW_LIGHT_COUNT}; i++) {
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
  if (uEmissive > 0.0 && lit > uEmissive && revealed > 0.5) glowLevel = 3.0;
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
    emissive = 0,
    dither = false
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
  if (dither) defines.DITHER = "";
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
var SPRITE_NORMAL = new THREE2.Vector3(0, 1, 0);
var _rockPoint = new THREE2.Vector3();
var _rockEuler = new THREE2.Euler();
function buildQuads(quads) {
  const n = quads.length;
  const position = new Float32Array(n * 12);
  const normal = new Float32Array(n * 12);
  const toned = quads.some((q) => q.tone !== void 0);
  const tone = toned ? new Float32Array(n * 4) : null;
  const index = n * 4 > 65535 ? new Uint32Array(n * 6) : new Uint16Array(n * 6);
  const N = new THREE2.Vector3(), U = new THREE2.Vector3(), R = new THREE2.Vector3();
  quads.forEach((q, i) => {
    N.set(...q.normal ?? [0, 0, 1]).normalize();
    U.set(0, 1, 0);
    if (Math.abs(N.y) > 0.9) U.set(0, 0, -Math.sign(N.y));
    R.crossVectors(U, N).normalize();
    U.crossVectors(N, R);
    const [w, h] = q.size;
    const [cx, cy, cz] = q.position;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], k) => {
      const o = (i * 4 + k) * 3;
      position[o] = cx + R.x * a * w / 2 + U.x * b * h / 2;
      position[o + 1] = cy + R.y * a * w / 2 + U.y * b * h / 2;
      position[o + 2] = cz + R.z * a * w / 2 + U.z * b * h / 2;
      normal[o] = N.x;
      normal[o + 1] = N.y;
      normal[o + 2] = N.z;
      if (tone) tone[i * 4 + k] = q.tone ?? 0;
    });
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE2.BufferAttribute(normal, 3));
  if (tone) geometry.setAttribute("aTone", new THREE2.BufferAttribute(tone, 1));
  geometry.setIndex(new THREE2.BufferAttribute(index, 1));
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
  castIron: { label: "Fonte", ramp: ["#16171c", "#25272e", "#3a3d45", "#5c6069"], ink: "#0b0c0f" },
  // Cuivre resté vif (bandes gravées des rouleaux, fils neufs) : rose-orangé, ombre brun-violet.
  copper: { label: "Cuivre", ramp: ["#3a1f22", "#6e3a2c", "#a85f3c", "#d8935c", "#f4c79a"], ink: "#1f1013" }
};
var GLOWS = {
  amber: { label: "Ambre", ramp: ["#5a2a12", "#b8581c", "#ff9a3c", "#ffd796"], light: "#ff9a3c" },
  cyan: { label: "Cyan", ramp: ["#12505e", "#2a9bb0", "#5fd4e6", "#d6fbff"], light: "#5fd4e6" },
  alarm: { label: "Rouge d'alerte", ramp: ["#3a0d0c", "#6e1815", "#a3261f", "#e0574a"], light: "#c8302a" }
};
var DATA_GLOWS = {
  amber: GLOWS.amber,
  cyan: GLOWS.cyan,
  green: { label: "Vert", ramp: ["#123f22", "#2a8a45", "#5fd07a", "#c8f7cf"], light: "#5fd07a" },
  red: { label: "Rouge", ramp: GLOWS.alarm.ramp, light: GLOWS.alarm.light }
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
function gridBlock(size, position = [0, 0, 0], { cell = 0.1 } = {}) {
  const [w, h, d] = size;
  const seg = (l) => Math.max(1, Math.round(l / cell));
  const g = plain(new THREE3.BoxGeometry(w, h, d, seg(w), seg(h), seg(d)));
  g.translate(position[0], position[1], position[2]);
  return g;
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
function gearWheel({ teeth = 12, module = 0.022, depth = PX * 0.6, spokes = 4, hub = 0.3 } = {}) {
  const r = teeth * module / 2;
  const outer = r + module * 0.9, root = r - module * 0.9;
  const shape = new THREE3.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = i / teeth * Math.PI * 2;
    const da = Math.PI * 2 / teeth;
    const pts = [[root, a0], [outer, a0 + da * 0.12], [outer, a0 + da * 0.48], [root, a0 + da * 0.6]];
    pts.forEach(([rr, a], k) => i === 0 && k === 0 ? shape.moveTo(rr * Math.cos(a), rr * Math.sin(a)) : shape.lineTo(rr * Math.cos(a), rr * Math.sin(a)));
  }
  shape.closePath();
  if (spokes > 0) {
    const rIn = root * 0.72, rHub = Math.max(root * hub, PX * 1.2);
    for (let k = 0; k < spokes; k++) {
      const a0 = k / spokes * Math.PI * 2 + 0.28, a1 = (k + 1) / spokes * Math.PI * 2 - 0.28;
      if (a1 <= a0) continue;
      const hole = new THREE3.Path();
      hole.moveTo(rHub * Math.cos(a0), rHub * Math.sin(a0));
      for (let j = 0; j <= 3; j++) {
        const a = a0 + (a1 - a0) * j / 3;
        hole.lineTo(rIn * Math.cos(a), rIn * Math.sin(a));
      }
      hole.lineTo(rHub * Math.cos(a1), rHub * Math.sin(a1));
      hole.closePath();
      shape.holes.push(hole);
    }
  }
  const disc = plain(new THREE3.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 }));
  const rBoss = Math.max(root * hub, PX * 1.2) * 0.8;
  const boss = plain(new THREE3.CylinderGeometry(rBoss, rBoss, depth * 2.2, 6));
  boss.rotateX(Math.PI / 2);
  boss.translate(0, 0, depth / 2);
  const geometry = mergeGeometries([disc, boss]);
  geometry.userData.radius = r;
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
function metalMaterial(entry, { id = 30, crease = true, grain = 0, seed = 0, tone = false, steps } = {}) {
  const five = entry.ramp.length === 5;
  return createToonMaterial({
    ramp: entry.ramp,
    ink: entry.ink,
    steps: steps ?? (five ? [0.28, 0.46, 0.68, 0.9] : [0.3, 0.52, 0.76]),
    pattern: grain > 0 ? "speckle" : "none",
    patternParams: [16, grain, 0.18, 0.5],
    seed,
    crease,
    tone,
    id
  });
}
function glowMaterial(name = "amber", { level = 2, id = 40 } = {}) {
  const ramp = (typeof name === "object" ? name : GLOWS[name] ?? GLOWS.amber).ramp;
  const color = ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(level)))];
  return createToonMaterial({
    ramp: [color, color],
    steps: [0.5],
    unlit: true,
    emissive: level > 0 ? 0.01 : 0,
    glow: false,
    outline: false,
    id
  });
}
function createRigidParts(geometry, partOf, count) {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const basePosition = position.array.slice();
  const baseNormal = normal.array.slice();
  const matrices = Array.from({ length: count }, () => new THREE3.Matrix4());
  let first = 0;
  while (first < partOf.length && partOf[first] === 255) first++;
  let last = partOf.length - 1;
  while (last >= first && partOf[last] === 255) last--;
  const apply = () => {
    if (last < first) return;
    const p = position.array, n = normal.array;
    for (let i = first; i <= last; i++) {
      const k = partOf[i];
      if (k === 255) continue;
      const e = matrices[k].elements;
      const x = basePosition[i * 3], y = basePosition[i * 3 + 1], z = basePosition[i * 3 + 2];
      p[i * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
      p[i * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      p[i * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
      const nx = baseNormal[i * 3], ny = baseNormal[i * 3 + 1], nz = baseNormal[i * 3 + 2];
      n[i * 3] = e[0] * nx + e[4] * ny + e[8] * nz;
      n[i * 3 + 1] = e[1] * nx + e[5] * ny + e[9] * nz;
      n[i * 3 + 2] = e[2] * nx + e[6] * ny + e[10] * nz;
    }
    position.addUpdateRange(first * 3, (last - first + 1) * 3);
    normal.addUpdateRange(first * 3, (last - first + 1) * 3);
    position.needsUpdate = true;
    normal.needsUpdate = true;
    geometry.computeBoundingSphere();
  };
  return { matrices, apply };
}
function mergeParts(entries) {
  const partOf = new Uint8Array(entries.reduce((sum, [g]) => sum + g.attributes.position.count, 0));
  let offset = 0;
  for (const [g, k] of entries) {
    partOf.fill(k, offset, offset + g.attributes.position.count);
    offset += g.attributes.position.count;
  }
  return { geometry: mergeToned(entries.map(([g]) => g)), partOf };
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
function glowParam(description, { only, defaultValue } = {}) {
  return choiceParam("Lueur", pick(GLOWS, only), description, defaultValue);
}
function numberParam(label, defaultValue, min, max, description, { step = 0.1, unit } = {}) {
  return { type: "number", default: defaultValue, min, max, step, ...unit ? { unit } : {}, label, description };
}
function pick(table, only) {
  if (!only) return table;
  return Object.fromEntries(only.map((key) => [key, table[key]]));
}

// src/assets/furniture/storage/drawer-archive.js
var DRAWERS = { few: "Quelques tiroirs sortis", closed: "Tous ferm\xE9s", many: "Beaucoup de tiroirs sortis" };
var GEARS = { on: "Rouages qui tournent", off: "Rouages \xE0 l'arr\xEAt" };
var DEPTH = 0.8;
var PLINTH = 0.3;
var FRIEZE = 0.44;
var CORNICE = 0.12;
var SIDE = 0.07;
var POOL = 6;
var TRAVEL = 0.7;
var FIXED = 255;
var params = {
  seed: seedParam("Change les tiroirs sortis, les tons des colonnes, les tiroirs plus clairs ou plus sombres, la place et la taille des rouages, leur cadence."),
  width: numberParam("Largeur", 3, 1, 3, "Largeur du rayonnage (une colonne de tiroirs par 0,25 m ; 3 m = 12 colonnes).", { step: 0.25, unit: "m" }),
  height: numberParam("Hauteur", 5.5, 2, 5.5, "Hauteur totale, corniche comprise (5,5 m = 23 rang\xE9es ; les rangs hauts se lisent depuis la mezzanine).", { step: 0.1, unit: "m" }),
  drawers: choiceParam("Tiroirs", DRAWERS, "Tous ferm\xE9s, quelques-uns sortis (entrouverts de 0,3 m ou ouverts de 0,7 m), ou beaucoup. Pilotable : group.userData.archive."),
  gears: choiceParam("Rouages", GEARS, "Les rouages de la frise avancent d'une dent de temps en temps, ou restent immobiles."),
  glow: glowParam("Couleur des tranches de cassettes, dans les tiroirs ouverts.", { only: ["amber", "cyan"] })
};
var meta = {
  id: "furniture/storage/drawer-archive",
  name: "Rayonnage \xE0 tiroirs",
  nameEn: "Drawer archive",
  category: "furniture",
  subcategory: "storage",
  description: "Rayonnage monumental des Archives du Complexe : ossature de bronze sur plinthe de basalte, fa\xE7ade en grille de petits tiroirs \xE0 cassettes (12 \xD7 23 pour 3 \xD7 5,5 m), poign\xE9es d'un pixel, frise de rouages qui tournent d'une dent par \xE0-coups sous la corniche. Quelques tiroirs sortis montrent leurs cassettes de verre \xE0 la tranche lumineuse ; la sc\xE8ne peut en tirer d'autres. Fiches ARC-01, ARC-02.",
  tags: [
    "rayonnage",
    "tiroirs",
    "archives",
    "cassettes",
    "classeur",
    "rouages",
    "engrenages",
    "bronze",
    "basalte",
    "biblioth\xE8que",
    "le complexe",
    "complexe",
    "ancien-tech",
    "rangement",
    "anim\xE9",
    "pilotable",
    "int\xE9rieur",
    "drawer cabinet",
    "filing",
    "archive",
    "data cassettes",
    "gears",
    "clockwork",
    "patinated bronze",
    "black basalt",
    "library",
    "ancient complex",
    "ancient-tech",
    "storage",
    "animated",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au milieu du dos (le mur est en z = 0, la fa\xE7ade regarde +z)",
  footprint: { radius: 2, height: 5.5 },
  animated: ["gears", "drawers"],
  params,
  variants: [
    { id: "monumental", name: "Monumental (3 \xD7 5,5 m)", params: {} },
    { id: "low", name: "Bas (2 \xD7 2,4 m)", params: { width: 2, height: 2.4, drawers: "many" } },
    { id: "closed", name: "Tous ferm\xE9s", params: { drawers: "closed" } }
  ]
};
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 61);
  const W = p.width, H = p.height, D = DEPTH;
  const bronze = [];
  const glow = [];
  const add = (g, tone = 0, part = FIXED) => bronze.push([withTone(g, tone), part]);
  const gridY0 = PLINTH + 0.05;
  const gridY1 = H - CORNICE - FRIEZE - 0.04;
  const gridH = gridY1 - gridY0;
  const innerW = W - 2 * SIDE;
  const cols = Math.max(2, Math.round(innerW / 0.24));
  const rows = Math.max(3, Math.round(gridH / 0.198));
  const pitchX = innerW / cols, pitchY = gridH / rows;
  const soot = (y) => -0.22 * THREE4.MathUtils.smoothstep(y, H * 0.45, H);
  for (const s of [-1, 1]) {
    const side = buildBlock([SIDE, H - PLINTH + 0.02, D + 0.02], [s * (W / 2 - SIDE / 2), (H + PLINTH) / 2 - 0.01, (D + 0.02) / 2]);
    add(withTone(side, (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.1 : 0.05) + soot(y)));
    add(rivetRow([s * (W / 2 - SIDE / 2), PLINTH + 0.25, D + 0.025], [s * (W / 2 - SIDE / 2), H - 0.3, D + 0.025], { spacing: 0.4, size: PX * 0.7 }), 0.3);
  }
  add(buildBlock([innerW, H - PLINTH, 0.03], [0, (H + PLINTH) / 2, 0.015]), -0.5);
  add(buildBlock([W + 0.1, CORNICE, D + 0.1], [0, H - CORNICE / 2, (D + 0.1) / 2]), (x, y, z, nx, ny) => ny > 0.5 ? -0.1 : 0.12);
  add(buildBlock([W + 0.04, PX, D + 0.05], [0, H - CORNICE - PX / 2, (D + 0.05) / 2]), -0.35);
  const fy0 = H - CORNICE - FRIEZE, fy1 = H - CORNICE - PX;
  add(buildBlock([innerW, FRIEZE, 0.03], [0, (fy0 + fy1) / 2, D - 0.1]), -0.8);
  add(buildBlock([innerW, 0.05, 0.08], [0, fy0 + 0.025, D - 0.04]), (x, y) => 0.08 + soot(y));
  add(buildBlock([innerW, 0.04, 0.06], [0, gridY0 - 0.02, D - 0.03]), 0.05);
  add(buildBlock([innerW, gridH, 0.03], [0, (gridY0 + gridY1) / 2, D - 0.045]), -0.75);
  const colTone = Array.from({ length: cols }, () => rng.range(-0.07, 0.07));
  const fronts = [];
  const cellQuad = /* @__PURE__ */ new Map();
  const fw = pitchX - PX, fh = pitchY - PX * 0.8;
  const zFront = D - 0.012;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -innerW / 2 + (c + 0.5) * pitchX, y = gridY0 + (r + 0.5) * pitchY;
      const odd = rng.next();
      const tone = colTone[c] + (odd < 0.04 ? -0.18 : odd > 0.95 ? 0.14 : rng.range(-0.04, 0.04)) + soot(y);
      cellQuad.set(`${c},${r}`, fronts.length);
      fronts.push({ position: [x, y, zFront], size: [fw, fh], tone });
      fronts.push({ position: [x, y - fh * 0.12, zFront + 6e-3], size: [PX * 1.1, PX * 0.7], tone: 0.5 + soot(y) * 0.5 });
    }
  }
  const frontStart = bronze.reduce((n, [g]) => n + g.attributes.position.count, 0);
  bronze.push([buildQuads(fronts), FIXED]);
  for (let c = 4; c < cols; c += 4) {
    add(buildBlock([PX * 1.2, gridH, 0.04], [-innerW / 2 + c * pitchX, (gridY0 + gridY1) / 2, D - 0.02]), (x, y) => 0.12 + soot(y));
  }
  for (let r = 6; r < rows; r += 6) {
    add(buildBlock([innerW, PX * 0.9, 0.035], [0, gridY0 + r * pitchY, D - 0.018]), (x, y) => 0.02 + soot(y));
  }
  const dw = pitchX - PX * 1.15, dh = pitchY - PX;
  const body = TRAVEL - 0.04;
  const tw = 7e-3;
  for (let k = 0; k < POOL; k++) {
    add(buildBlock([dw, dh, 0.02], [0, 0, zFront - 2e-3]), 0.04, k);
    add(buildBlock([PX * 1.1, PX * 0.7, 0.012], [0, -dh * 0.12, zFront + 0.01]), 0.5, k);
    add(buildBlock([PX * 1.8, PX * 0.6, 6e-3], [0, dh * 0.22, zFront + 9e-3]), 0.8, k);
    const zb = zFront - 0.012 - body / 2;
    add(buildBlock([dw - 0.01, tw, body], [0, -dh * 0.42, zb]), -0.45, k);
    for (const s of [-1, 1]) add(buildBlock([tw, dh * 0.62, body], [s * (dw / 2 - 8e-3), -dh * 0.14, zb]), -0.05, k);
    add(buildBlock([dw - 0.01, dh * 0.62, tw], [0, -dh * 0.14, zb - body / 2]), -0.3, k);
    const fronts6 = [], tops6 = [];
    for (let i = 0; i < 6; i++) {
      const z = zFront - 0.06 - i * (body - 0.08) / 5;
      fronts6.push({ position: [0, -dh * 0.14, z], size: [dw - 0.04, dh * 0.55], tone: i % 2 ? -0.55 : -0.68 });
      tops6.push({ position: [0, -dh * 0.14 + dh * 0.275 + 4e-3, z - 0.012], size: [dw - 0.05, 0.03], normal: [0, 1, 0] });
    }
    add(buildQuads(fronts6), 0, k);
    glow.push([buildQuads(tops6), k]);
  }
  const gears = [];
  const mod = 0.034;
  const gz = D - 0.07;
  const fc = (fy0 + 0.05 + fy1) / 2 + 0.03;
  const trains = W >= 2 ? 2 : 1;
  for (let t = 0; t < trains; t++) {
    const span = innerW / trains;
    let x = -innerW / 2 + span * t + span * rng.range(0.15, 0.35);
    let dir = 1;
    let prev = null;
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const teeth = rng.int(8, 11);
      const radius = teeth * mod / 2;
      let y = fc + rng.range(-0.03, 0.03);
      if (prev) {
        const dist = prev.radius + radius;
        const lo = fc - 0.16 + radius, hi = fc + 0.14 - radius;
        y = THREE4.MathUtils.clamp(prev.y + rng.range(-0.5, 0.5) * dist, Math.min(lo, hi), Math.max(lo, hi));
        const dy = y - prev.y;
        x = prev.x + Math.sqrt(Math.max(0, dist * dist - dy * dy));
        if (x + radius > -innerW / 2 + span * (t + 1) - 0.04) break;
        dir = -prev.dir;
      }
      const z = gz + i % 2 * 0.014;
      const g = gearWheel({ teeth, module: mod, depth: 0.02, spokes: 0, hub: 0.32 });
      g.rotateZ(rng.range(0, Math.PI));
      g.translate(x, y, z);
      const part = POOL + gears.length;
      add(g, (t + i) % 2 ? 0.22 : 0.08, part);
      const disc = plain(new THREE4.CylinderGeometry(radius * 0.62, radius * 0.62, 6e-3, 8));
      disc.rotateX(Math.PI / 2);
      disc.rotateZ(rng.range(0, 1));
      disc.translate(x, y, z + 0.022);
      add(disc, -0.38, part);
      add(buildBlock([PX * 0.7, PX * 0.7, 0.07], [x, y, gz - 0.02]), -0.3);
      const gear = { x, y, radius, teeth, dir, part };
      gears.push(gear);
      prev = gear;
    }
  }
  const gearPhase = rng.next() * 3;
  const period = rng.range(0.7, 1.1);
  const plinth = gridBlock([W - 0.04, PLINTH, D - 0.04], [0, PLINTH / 2, (D - 0.04) / 2], { cell: 0.25 });
  withTone(plinth, (x, y, z, nx, ny, nz) => nz > 0.5 && y < 0.08 ? -0.25 : ny > 0.5 ? -0.12 : rng.range(-0.06, 0.06));
  const plinthTop = buildBlock([W - 0.02, 0.04, D - 0.02], [0, PLINTH - 0.02, (D - 0.02) / 2]);
  const group = new THREE4.Group();
  group.name = meta.name;
  const bronzeMerged = mergeParts(bronze);
  const bronzeMesh = new THREE4.Mesh(bronzeMerged.geometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronzeMesh.name = "bronze";
  const stoneMesh = new THREE4.Mesh(mergeToned([plinth, withTone(plinthTop, 0.1)]), stoneMaterial(STONES.blackBasalt, { seed: p.seed % 97, id: 20 }));
  stoneMesh.name = "plinth";
  for (const m of [bronzeMesh, stoneMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  const glowMerged = mergeParts(glow);
  const glowMesh = new THREE4.Mesh(glowMerged.geometry, glowMaterial(p.glow, { level: 2, id: 40 }));
  glowMesh.name = "cassettes";
  group.add(glowMesh);
  const rigs = [createRigidParts(bronzeMerged.geometry, bronzeMerged.partOf, POOL + gears.length), createRigidParts(glowMerged.geometry, glowMerged.partOf, POOL)];
  const positions = bronzeMerged.geometry.attributes.position;
  const frontBase = positions.array.slice(frontStart * 3, (frontStart + fronts.length * 4) * 3);
  const slots = Array.from({ length: POOL }, () => ({ cell: null, u: 0, tween: null }));
  const cellCenter = (c, r) => new THREE4.Vector3(-innerW / 2 + (c + 0.5) * pitchX, gridY0 + (r + 0.5) * pitchY, 0);
  const showFront = (key, visible) => {
    const q = cellQuad.get(key);
    const start = (frontStart + q * 4) * 3, count = 8 * 3;
    for (let i = 0; i < count; i += 3) {
      positions.array[start + i] = frontBase[q * 12 + i];
      positions.array[start + i + 1] = frontBase[q * 12 + i + 1];
      positions.array[start + i + 2] = visible ? frontBase[q * 12 + i + 2] : 0.2;
    }
    positions.addUpdateRange(start, count);
    positions.needsUpdate = true;
  };
  const poseSlot = (k) => {
    const s = slots[k];
    if (!s.cell) {
      for (const rig of rigs) rig.matrices[k]?.makeTranslation(0, PLINTH + 0.5, -0.08);
      return;
    }
    const v = cellCenter(s.cell[0], s.cell[1]);
    for (const rig of rigs) rig.matrices[k]?.makeTranslation(v.x, v.y, s.u * TRAVEL);
  };
  const slotOf = (c, r, take) => {
    let k = slots.findIndex((s) => s.cell && s.cell[0] === c && s.cell[1] === r);
    if (k >= 0 || !take) return k;
    k = slots.findIndex((s) => !s.cell);
    if (k < 0) {
      k = slots.reduce((best, s, i) => !s.tween && (best < 0 || s.u < slots[best].u) ? i : best, -1);
      if (k < 0) k = 0;
      showFront(`${slots[k].cell[0]},${slots[k].cell[1]}`, true);
    }
    slots[k].cell = [c, r];
    slots[k].u = 0;
    slots[k].tween = null;
    showFront(`${c},${r}`, false);
    return k;
  };
  const valid = (c, r) => Number.isInteger(c) && Number.isInteger(r) && c >= 0 && c < cols && r >= 0 && r < rows;
  let dirty = true;
  const archive = {
    cols,
    rows,
    pitch: [pitchX, pitchY],
    cellCenter: (c, r) => cellCenter(c, r).setZ(zFront),
    openness: (c, r) => slots[slotOf(c, r, false)]?.u ?? 0,
    setDrawer(c, r, u) {
      if (!valid(c, r)) return;
      const k = slotOf(c, r, true);
      slots[k].u = THREE4.MathUtils.clamp(u, 0, 1);
      slots[k].tween = null;
      dirty = true;
    },
    slide(c, r, u, seconds = 1) {
      if (!valid(c, r)) return;
      const k = slotOf(c, r, true);
      slots[k].tween = { from: slots[k].u, to: THREE4.MathUtils.clamp(u, 0, 1), start: sharedUniforms.uTime.value, seconds };
    }
  };
  const pulled = { closed: 0, few: rng.int(1, 3), many: rng.int(5, 6) }[p.drawers];
  for (let i = 0; i < pulled; i++) {
    const c = rng.int(0, cols - 1), r = rng.int(1, Math.max(1, rows - 3));
    archive.setDrawer(c, r, rng.chance(0.5) ? 0.3 / TRAVEL : 1);
  }
  const ease = (x) => x * x * (3 - 2 * x);
  const gearAngles = gears.map(() => NaN);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  const tmp = new THREE4.Matrix4();
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime || dirty) {
      lastTime = time;
      for (const s of slots) {
        if (!s.tween) continue;
        const k = Math.min(1, (time - s.tween.start) / s.tween.seconds);
        s.u = s.tween.from + (s.tween.to - s.tween.from) * ease(k);
        if (k >= 1) s.tween = null;
        dirty = true;
      }
      const beat = p.gears === "on" ? (time + gearPhase) / period : 0;
      const n = Math.floor(beat);
      const step = n + ease(Math.min(1, (beat - n) / 0.22));
      let turned = false;
      gears.forEach((g, i) => {
        const a = g.dir * step * (Math.PI * 2 / g.teeth);
        if (a === gearAngles[i]) return;
        gearAngles[i] = a;
        turned = true;
        rigs[0].matrices[g.part].makeTranslation(g.x, g.y, 0).multiply(tmp.makeRotationZ(a)).multiply(tmp.makeTranslation(-g.x, -g.y, 0));
      });
      if (dirty) {
        for (let k = 0; k < POOL; k++) poseSlot(k);
        rigs[1].apply();
      }
      if (dirty || turned) rigs[0].apply();
      dirty = false;
    }
    baseUpdate(force);
  };
  group.updateMatrixWorld(true);
  group.userData.archive = archive;
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
