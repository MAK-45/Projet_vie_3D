// Projet Vie 3D — Chariot du Complexe (props/machines/complex-cart), version 1
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/props/machines/complex-cart.js
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
var WOODS = {
  oak: { label: "Ch\xEAne", ramp: ["#4a2c2a", "#75492f", "#a26b3c", "#cd9552"], ink: "#2c181b" },
  pine: { label: "Pin", ramp: ["#6b4630", "#a0713f", "#cf9f58", "#efc98a"], ink: "#43291f" },
  walnut: { label: "Noyer", ramp: ["#2e1c22", "#4a2d2a", "#6d4433", "#946144"], ink: "#1b1015" },
  birch: { label: "Bouleau", ramp: ["#8a6f5e", "#b89a7a", "#dcc49c", "#f3e6c4"], ink: "#5a4439" },
  blackenedOak: { label: "Ch\xEAne noirci", ramp: ["#1c1312", "#2e1f1a", "#463024", "#664633"], ink: "#100a0a" }
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
function glowMixMaterial(colors, { id = 40 } = {}) {
  const ramp = colors.map(([name, level]) => {
    const r = (typeof name === "object" ? name : GLOWS[name] ?? GLOWS.amber).ramp;
    return r[Math.max(0, Math.min(r.length - 1, Math.round(level)))];
  });
  if (ramp.length === 1) ramp.push(ramp[0]);
  const steps = ramp.slice(1).map((_, i) => (i + 1) / ramp.length);
  return createToonMaterial({ ramp, steps, unlit: true, shade: true, emissive: 1e-3, glow: false, outline: false, id });
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
function faceMatrix(position, normal, spin = 0) {
  const z = toVector(normal).clone().normalize();
  const up = Math.abs(z.y) > 0.99 ? new THREE3.Vector3(0, 0, -1) : new THREE3.Vector3(0, 1, 0);
  const x = new THREE3.Vector3().crossVectors(up, z).normalize();
  const y = new THREE3.Vector3().crossVectors(z, x);
  const m = new THREE3.Matrix4().makeBasis(x, y, z);
  m.multiply(new THREE3.Matrix4().makeRotationZ(spin));
  m.setPosition(toVector(position));
  return m;
}
function dial({ radius = 2 * PX, position = [0, 0, 0], normal = [0, 0, 1], ticks = 8, needle = 0, depth = PX * 0.5 } = {}) {
  const m = faceMatrix(position, normal);
  const disc = plain(new THREE3.CylinderGeometry(radius, radius, depth, Math.max(8, ticks * 2)));
  disc.rotateX(Math.PI / 2);
  disc.translate(0, 0, depth / 2);
  disc.applyMatrix4(m);
  const marks = [];
  const tick2 = Math.max(PX * 0.5, radius * 0.22);
  for (let i = 0; i < ticks; i++) {
    const a = i / ticks * Math.PI * 2;
    const r = radius - tick2 / 2;
    marks.push(buildBlock([tick2 * 0.6, tick2, PX * 0.3], [Math.sin(a) * r, Math.cos(a) * r, depth + PX * 0.15], [0, 0, -a]));
  }
  const l = radius * 0.8;
  if (needle !== null) marks.push(buildBlock([PX * 0.45, l, PX * 0.3], [Math.sin(needle) * l / 2, Math.cos(needle) * l / 2, depth + PX * 0.2], [0, 0, -needle]));
  const markGeometry = mergeGeometries(marks);
  markGeometry.applyMatrix4(m);
  return { face: disc, marks: markGeometry };
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

// src/assets/props/machines/complex-cart.js
var MODELS = {
  cassettes: "\xC0 cassettes (Archives, 3 plateaux)",
  instruments: "D'instruments (Galerie, 2 plateaux)",
  heavy: "\xC0 pi\xE8ces lourdes (Atelier, madriers, timon)"
};
var LOADS = { full: "Charg\xE9", half: "\xC0 moiti\xE9", empty: "Vide" };
var DRAWBARS = { down: "Baiss\xE9 au sol", up: "Relev\xE9" };
var SIZES = {
  cassettes: { L: 1, D: 0.6, r: 0.1, shelves: [0.3, 0.6, 0.9], handle: 1.08 },
  instruments: { L: 1.2, D: 0.6, r: 0.125, shelves: [0.36, 0.8], handle: 0.98 },
  heavy: { L: 1.8, D: 0.8, r: 0.2, shelves: [0.58] }
};
var COLORS = ["amber", "cyan", "green", "red"];
var FIXED = 255;
var DRAWBAR = 6;
var params = {
  seed: seedParam("Change la charge (piles, rang\xE9es, couleurs des tranches, objets pos\xE9s), l'orientation des roulettes, l'usure, la place du timon."),
  model: choiceParam("Mod\xE8le", MODELS, "Chariot \xE0 cassettes des Archives, chariot d'instruments de la Galerie, ou chariot \xE0 pi\xE8ces lourdes de l'Atelier."),
  load: choiceParam("Charge", LOADS, "Plateaux pleins, \xE0 moiti\xE9 pleins, ou vides."),
  drawbar: choiceParam("Timon", DRAWBARS, "Chariot lourd : timon baiss\xE9, pos\xE9 au sol devant le chariot, ou relev\xE9 contre le plateau.")
};
var meta = {
  id: "props/machines/complex-cart",
  name: "Chariot du Complexe",
  nameEn: "Complex cart",
  category: "props",
  subcategory: "machines",
  description: "Chariot \xE0 roues cercl\xE9es du Complexe : chariot \xE0 cassettes des Archives (trois plateaux de bronze, cassettes aux tranches lumineuses, poign\xE9e de laiton, roulettes pivotantes), chariot d'instruments de la Galerie (sondes, rouleaux de c\xE2ble, bo\xEEtier \xE0 cadran), ou chariot \xE0 pi\xE8ces lourdes de l'Atelier (madriers, roues de bois cercl\xE9es de fer, timon). Les roues tournent quand on le pousse. Fiches ARC-10, GAL-08, ATE-11.",
  tags: [
    "chariot",
    "desserte",
    "roues",
    "roulettes",
    "plateaux",
    "poign\xE9e",
    "timon",
    "madriers",
    "cassettes",
    "sondes",
    "c\xE2bles",
    "lingots",
    "bronze",
    "fonte",
    "le complexe",
    "complexe",
    "ancien-tech",
    "transport",
    "pilotable",
    "int\xE9rieur",
    "cart",
    "trolley",
    "wheels",
    "casters",
    "shelves",
    "handle",
    "drawbar",
    "planks",
    "data cassettes",
    "probes",
    "cable coils",
    "ingots",
    "cast iron",
    "ancient complex",
    "ancient-tech",
    "haulage",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au centre ; le chariot roule le long de x (poign\xE9e c\xF4t\xE9 \u2212x, timon c\xF4t\xE9 +x)",
  footprint: { radius: 1.9, height: 1.15 },
  animated: ["wheels", "drawbar"],
  params,
  variants: [
    { id: "cassettes", name: "\xC0 cassettes", params: {} },
    { id: "instruments", name: "D'instruments", params: { model: "instruments" } },
    { id: "heavy", name: "\xC0 pi\xE8ces lourdes", params: { model: "heavy" } },
    { id: "heavy-up", name: "Lourd vide, timon relev\xE9", params: { model: "heavy", load: "empty", drawbar: "up" } }
  ]
};
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 401);
  const S = SIZES[p.model];
  const heavy = p.model === "heavy";
  const metal = [], wood = [], glow = [];
  const fill = { full: 1, half: 0.5, empty: 0 }[p.load];
  const heavyPivot = new THREE4.Vector3(), heavyTip = new THREE4.Vector3();
  const wheels = [];
  const addWheel = (A, r, w, part, spokes) => {
    const rim = buildLathe([[r - Math.max(0.022, r * 0.14), -w / 2], [r, -w / 2], [r, w / 2], [r - Math.max(0.022, r * 0.14), w / 2]], { segments: r > 0.15 ? 16 : 12, axis: "z", facets: true });
    metal.push([withTone(rim.translate(A.x, A.y, A.z), 0.15), part]);
    if (spokes) {
      for (let k = 0; k < spokes; k++) {
        const a = k / spokes * Math.PI * 2;
        const tip = [A.x + Math.cos(a) * (r - 0.02), A.y + Math.sin(a) * (r - 0.02), A.z];
        wood.push([withTone(beam([A.x, A.y, A.z], tip, 0.035, 0.035), k % 2 ? 0.08 : -0.08), part]);
      }
      const hub = plain(new THREE4.CylinderGeometry(0.055, 0.055, w + 0.04, 8)).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
      wood.push([withTone(hub, 0.1), part]);
    } else {
      const web = plain(new THREE4.CylinderGeometry(r - 0.015, r - 0.015, w * 0.55, 10)).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
      metal.push([withTone(web, -0.5), part]);
    }
    const cap = plain(new THREE4.CylinderGeometry(r * 0.28, r * 0.28, w + 0.05, 8)).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
    metal.push([withTone(cap, heavy ? 0.05 : 0.25), part]);
    for (const s of [-1, 1]) {
      metal.push([withTone(buildBlock([PX * 0.6, PX * 0.6, 0.01], [A.x + r * 0.55, A.y, A.z + s * (w * 0.3 + 5e-3)]), 0.55), part]);
    }
    wheels.push({ A: A.clone(), r, part });
  };
  if (heavy) buildHeavy();
  else buildShelfCart();
  function buildShelfCart() {
    const { L, D, r, shelves } = S;
    const w = 0.045;
    const bottom = shelves[0] - 0.05;
    const top = shelves[shelves.length - 1] + 0.05;
    const xEnd = L / 2 - 0.03, zEnd = D / 2 - 0.03;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      metal.push([withTone(beam([sx * xEnd, bottom, sz * zEnd], [sx * xEnd, top, sz * zEnd], PX * 0.7, PX * 0.7), sx < 0 ? 0 : -0.06), FIXED]);
    }
    shelves.forEach((y, i) => {
      const t = rng.range(-0.08, 0.06) - 0.05 * i;
      metal.push([withTone(buildBlock([L - 0.02, 0.025, D - 0.02], [0, y - 0.0125, 0]), (x, yy, z, nx, ny) => t + (ny > 0.5 ? -0.12 : 0)), FIXED]);
      for (const sz of [-1, 1]) metal.push([withTone(buildBlock([L - 0.02, 0.04, PX * 0.35], [0, y + 0.02, sz * (D / 2 - 0.015)]), t + 0.12), FIXED]);
      for (const sx of [-1, 1]) metal.push([withTone(buildBlock([PX * 0.35, 0.04, D - 0.02], [sx * (L / 2 - 0.015), y + 0.02, 0]), t + 0.12), FIXED]);
    });
    const hx = -L / 2 - 0.07;
    for (const sz of [-1, 1]) {
      metal.push([withTone(beam([-xEnd, top - 0.03, sz * (zEnd - 0.04)], [hx, S.handle, sz * (zEnd - 0.04)], PX * 0.55, PX * 0.55), 0.2), FIXED]);
    }
    const bar = plain(new THREE4.CylinderGeometry(0.022, 0.022, D - 0.02, 8)).rotateX(Math.PI / 2).translate(hx, S.handle, 0);
    metal.push([withTone(bar, (x, y) => y > S.handle ? 0.45 : 0.3), FIXED]);
    const axleY = r;
    for (const sz of [-1, 1]) {
      const A = new THREE4.Vector3(-xEnd + 0.05, axleY, sz * (zEnd - 0.01));
      metal.push([withTone(buildBlock([0.06, bottom - axleY + 0.01, 0.015], [A.x, (bottom + axleY) / 2, A.z - sz * (w / 2 + 0.012)]), -0.1), FIXED]);
      addWheel(A, r, w, sz < 0 ? 0 : 1);
    }
    [-1, 1].forEach((sz, k) => {
      const pivot = new THREE4.Vector3(xEnd - 0.06, bottom - 0.01, sz * (zEnd - 0.01));
      const trail = 0.045;
      const A = new THREE4.Vector3(pivot.x - trail, axleY, pivot.z);
      const part = 4 + k;
      metal.push([withTone(buildBlock([0.08, 0.015, 0.08], [pivot.x, pivot.y + 75e-4, pivot.z]), 0.05), FIXED]);
      metal.push([withTone(plain(new THREE4.CylinderGeometry(0.014, 0.014, 0.04, 6)).translate(pivot.x, pivot.y - 0.02, pivot.z), 0.2), part]);
      metal.push([withTone(buildBlock([0.07, 0.014, w + 0.04], [pivot.x - trail / 2, pivot.y - 0.045, pivot.z]), -0.05), part]);
      for (const s of [-1, 1]) {
        metal.push([withTone(beam([pivot.x - 5e-3, pivot.y - 0.045, pivot.z + s * (w / 2 + 0.014)], [A.x, A.y, A.z + s * (w / 2 + 0.014)], 0.03, 0.012), -0.12), part]);
      }
      addWheel(A, r, w, k === 0 ? 2 : 3);
      wheels[wheels.length - 1].caster = { pivot, part };
    });
    if (p.model === "cassettes") loadCassettes();
    else loadInstruments();
  }
  function loadCassettes() {
    if (!fill) return;
    const { L, D, shelves } = S;
    const CL = 0.18, CW = 0.1, CT = 0.024;
    const body = (size, at, tone) => metal.push([withTone(buildBlock(size, at), tone), FIXED]);
    const slice = (quad, color) => glow.push(withShade(buildQuads([quad]), color, 4));
    const topY = shelves[shelves.length - 1];
    for (const sz of [-1, 1]) {
      let x = -L / 2 + 0.06;
      const end = -L / 2 + 0.06 + (L - 0.12) * (fill === 1 ? rng.range(0.85, 1) : rng.range(0.35, 0.6));
      while (x < end - CT) {
        const run = rng.int(3, 9);
        const color = rng.int(0, 3);
        for (let i = 0; i < run && x < end - CT; i++) {
          const zc = sz * (D / 4 - 0.01);
          body([CT * 0.9, CW, CL], [x + CT / 2, topY + CW / 2, zc], -0.38 + i % 2 * -0.08);
          slice({ position: [x + CT / 2, topY + CW + 15e-4, zc], size: [CT * 0.62, CL - 0.024], normal: [0, 1, 0] }, color);
          x += CT;
        }
        x += rng.range(0.025, 0.08);
      }
    }
    shelves.slice(0, -1).forEach((y) => {
      const slots = 4;
      for (const sz of [-1, 1]) {
        for (let s = 0; s < slots; s++) {
          if (rng.next() > fill * 0.95) continue;
          const n = rng.int(2, 8);
          const color = rng.int(0, 3);
          const xc = -L / 2 + (s + 0.5) * L / slots + rng.range(-0.02, 0.02);
          const zc = sz * (D / 4 + 0.02);
          for (let i = 0; i < n; i++) {
            const jx = rng.range(-0.01, 0.01);
            body([CL, CT * 0.92, CW], [xc + jx, y + CT / 2 + i * CT, zc], -0.38 + i % 2 * -0.08);
            slice({ position: [xc + jx, y + CT / 2 + i * CT, zc + sz * (CW / 2 + 15e-4)], size: [CL - 0.024, CT * 0.6], normal: [0, 0, sz] }, color);
          }
        }
      }
    });
  }
  function loadInstruments() {
    if (!fill) return;
    const { L, D, shelves } = S;
    const top = shelves[1], low = shelves[0];
    const add = (g, tone) => metal.push([withTone(g, tone), FIXED]);
    const coil = (x, y, z, R) => {
      const g = plain(new THREE4.TorusGeometry(R, 0.024, 4, 12)).rotateX(Math.PI / 2).translate(x, y + 0.024, z);
      add(g, (xx, yy) => -0.62 + (yy > y + 0.03 ? 0.12 : 0));
      add(buildBlock([0.05, 0.03, 0.03], [x + R * 0.7, y + 0.06, z + R * 0.7]), 0.3);
    };
    const probe = (x, y, z, len, yaw) => {
      const dir = new THREE4.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
      const a = new THREE4.Vector3(x, y + 0.02, z).addScaledVector(dir, -len / 2);
      const b = new THREE4.Vector3(x, y + 0.02, z).addScaledVector(dir, len / 2);
      add(beam(a, b, PX * 0.42, PX * 0.42), 0.35);
      const grip = a.clone().addScaledVector(dir, 0.12);
      add(beam(a, grip, PX * 0.75, PX * 0.75), -0.55);
      const tip = plain(new THREE4.ConeGeometry(0.018, 0.06, 6));
      tip.rotateZ(-Math.PI / 2).rotateY(-yaw).translate(b.x + dir.x * 0.03, b.y, b.z + dir.z * 0.03);
      add(tip, 0.55);
    };
    const bx = rng.range(-0.3, -0.15) * L, bz = rng.range(-0.08, 0.04);
    add(buildBlock([0.26, 0.17, 0.2], [bx, top + 0.085, bz]), (x, y) => y > top + 0.165 ? -0.15 : -0.35);
    const d = dial({ radius: 0.05, position: [bx - 0.04, top + 0.09, bz + 0.1], normal: [0, 0, 1], ticks: 8, needle: rng.range(-1.2, 1.2) });
    add(d.face, 0.45);
    add(d.marks, -0.7);
    glow.push(withShade(plain(new THREE4.SphereGeometry(0.014, 6, 4)).translate(bx + 0.08, top + 0.12, bz + 0.1), 0, 1));
    const probes = fill === 1 ? rng.int(2, 3) : 1;
    for (let i = 0; i < probes; i++) probe(rng.range(0.05, 0.3) * L, top, -D / 4 + i * 0.12 + rng.range(-0.02, 0.02), rng.range(0.42, 0.55), rng.range(-0.15, 0.15));
    if (fill === 1) coil(rng.range(0.15, 0.3) * L, top, D / 4, 0.09);
    const coils = fill === 1 ? rng.int(2, 3) : 1;
    const cx = rng.range(-0.25, -0.1) * L;
    for (let i = 0; i < coils; i++) coil(cx + rng.range(-0.02, 0.02), low + i * 0.05, rng.range(-0.03, 0.03), 0.11 - i * 0.012);
    if (fill === 1) add(buildBlock([0.5, 0.08, 0.14], [rng.range(0.1, 0.2) * L, low + 0.04, rng.range(-0.1, 0.1)], [0, rng.range(-0.2, 0.2), 0]), (x, y) => y > low + 0.07 ? -0.1 : -0.3);
  }
  function buildHeavy() {
    const { L, D, r } = S;
    const deck = S.shelves[0];
    const w = 0.08;
    const axleX = L / 2 - 0.32;
    for (const sz of [-1, 1]) metal.push([withTone(buildBlock([L - 0.1, 0.1, 0.08], [0, deck - 0.11, sz * (D / 2 - 0.14)]), -0.05), FIXED]);
    for (const x of [-L / 2 + 0.1, 0, L / 2 - 0.1]) metal.push([withTone(buildBlock([0.08, 0.06, D - 0.2], [x, deck - 0.09, 0]), -0.15), FIXED]);
    for (const sx of [-1, 1]) {
      metal.push([withTone(beam([sx * axleX, r, -D / 2 - 0.02], [sx * axleX, r, D / 2 + 0.02], 0.04, 0.04), -0.2), FIXED]);
      for (const sz of [-1, 1]) metal.push([withTone(buildBlock([0.1, deck - 0.16 - r + 0.02, 0.05], [sx * axleX, (deck - 0.16 + r) / 2, sz * (D / 2 - 0.14)]), -0.1), FIXED]);
    }
    const planks = 6;
    const pw = D / planks;
    const wear = rng.range(-0.05, 0.05);
    for (let i = 0; i < planks; i++) {
      const z = -D / 2 + (i + 0.5) * pw;
      const len = L - (rng.chance(0.3) ? rng.range(0.02, 0.06) : 0);
      const t = (i % 2 ? 0.12 : -0.08) + rng.range(-0.05, 0.05) + wear;
      wood.push([withTone(buildBlock([len, 0.06, pw - 6e-3], [rng.range(-0.01, 0.01), deck - 0.03, z]), (x, y, zz, nx, ny) => t + (ny > 0.5 ? 0 : -0.15)), FIXED]);
    }
    const joints = [];
    for (let i = 1; i < planks; i++) joints.push({ position: [0, deck + 15e-4, -D / 2 + i * pw], size: [L - 0.04, PX * 0.3], normal: [0, 1, 0], tone: -0.8 });
    wood.push([buildQuads(joints), FIXED]);
    for (const x of [-L / 2 + 0.16, L / 2 - 0.16]) {
      metal.push([withTone(buildBlock([0.06, 0.012, D + 0.02], [x, deck + 6e-3, 0]), 0.15), FIXED]);
      for (let i = 0; i < planks; i++) metal.push([withTone(buildBlock([PX * 0.45, 8e-3, PX * 0.45], [x, deck + 0.016, -D / 2 + (i + 0.5) * pw]), 0.45), FIXED]);
    }
    let part = 0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addWheel(new THREE4.Vector3(sx * axleX, r, sz * (D / 2 + 0.07)), r, w, part++, 6);
    const pivot = new THREE4.Vector3(L / 2 - 0.02, r + 0.12, 0);
    const length = 1;
    for (const sz of [-1, 1]) {
      metal.push([withTone(beam([pivot.x, pivot.y, sz * 0.22], [pivot.x + length - 0.12, pivot.y, sz * 0.03], 0.04, 0.035), sz < 0 ? 0.05 : -0.05), DRAWBAR]);
      metal.push([withTone(plain(new THREE4.CylinderGeometry(0.03, 0.03, 0.06, 8)).rotateX(Math.PI / 2).translate(pivot.x, pivot.y, sz * 0.22), 0.2), DRAWBAR]);
    }
    metal.push([withTone(beam([pivot.x + length - 0.14, pivot.y, 0], [pivot.x + length - 0.06, pivot.y, 0], 0.05, 0.04), 0), DRAWBAR]);
    const loop = buildLathe([[0.045, -0.012], [0.07, -0.012], [0.07, 0.012], [0.045, 0.012]], { segments: 10, facets: true });
    metal.push([withTone(loop.translate(pivot.x + length, pivot.y, 0), 0.25), DRAWBAR]);
    heavyPivot.copy(pivot);
    heavyTip.set(pivot.x + length, pivot.y, 0);
    if (!fill) return;
    const ix = rng.range(0.1, 0.35), iz = rng.range(-0.15, 0.15);
    const ingot = (x, y, z, yaw) => metal.push([withTone(buildBlock([0.3, 0.07, 0.11], [x, y + 0.035, z], [0, yaw, 0], { taper: 0.2 }), (xx, yy, zz, nx, ny) => ny > 0.5 ? 0.25 : 0.05), FIXED]);
    const layers = fill === 1 ? 3 : 2;
    for (let l = 0; l < layers; l++) {
      const n = 3 - l;
      for (let i = 0; i < n; i++) ingot(ix + rng.range(-0.01, 0.01), deck + l * 0.07, iz + (i - (n - 1) / 2) * 0.13, (l % 2 ? Math.PI / 2 : 0) + rng.range(-0.06, 0.06));
    }
    const gx = rng.range(0.5, 0.62), gz = rng.range(-0.18, 0.18);
    const blank = plain(new THREE4.CylinderGeometry(0.2, 0.2, 0.06, 14));
    metal.push([withTone(blank.translate(gx, deck + 0.03, gz), (x, y, z) => y > deck + 0.05 ? Math.hypot(x - gx, z - gz) < 0.06 ? 0.4 : 0.15 : -0.1), FIXED]);
    if (fill === 1) {
      const cx = rng.range(-0.55, -0.35), cz = rng.range(-0.08, 0.08), yaw = rng.range(-0.15, 0.15);
      const size = [0.6, 0.45, 0.48];
      wood.push([withTone(buildBlock(size, [cx, deck + size[1] / 2, cz], [0, yaw, 0]), (x, y, z, nx, ny) => ny > 0.5 ? 0.15 : 0.02), FIXED]);
      for (const t of [-0.18, 0.18]) {
        const band = buildBlock([0.045, size[1] + 0.012, size[2] + 0.012], [t, 0, 0]);
        band.rotateY(yaw).translate(cx, deck + size[1] / 2, cz);
        metal.push([withTone(band, 0.1), FIXED]);
      }
    }
  }
  const group = new THREE4.Group();
  group.name = meta.name;
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE4.Mesh(metalMerged.geometry, metalMaterial(heavy ? METALS.castIron : METALS.patinatedBronze, { id: 30, tone: true }));
  metalMesh.name = "frame";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  group.add(metalMesh);
  const rigs = [createRigidParts(metalMerged.geometry, metalMerged.partOf, 7)];
  if (wood.length) {
    const woodMerged = mergeParts(wood);
    const woodMesh = new THREE4.Mesh(woodMerged.geometry, createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.28, 0.5, 0.76], tone: true, crease: true, id: 31 }));
    woodMesh.name = "planks";
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;
    group.add(woodMesh);
    rigs.push(createRigidParts(woodMerged.geometry, woodMerged.partOf, 7));
  }
  if (glow.length) {
    const colors = p.model === "cassettes" ? COLORS.map((c) => [DATA_GLOWS[c], 2]) : [["amber", 2]];
    const glowMesh = new THREE4.Mesh(mergeParts(glow.map((g) => [g, FIXED])).geometry, glowMixMaterial(colors, { id: 40 }));
    glowMesh.name = "lights";
    group.add(glowMesh);
  }
  const swivel = [rng.range(-Math.PI, Math.PI), rng.range(-Math.PI, Math.PI)];
  const tmp = new THREE4.Matrix4();
  const turnAbout = (m, point, rotation) => m.multiply(tmp.makeTranslation(point.x, point.y, point.z)).multiply(rotation).multiply(tmp.makeTranslation(-point.x, -point.y, -point.z));
  const rot = new THREE4.Matrix4();
  const cart = {
    distance: 0,
    drawbar: 0,
    handle: heavy ? new THREE4.Vector3() : new THREE4.Vector3(-S.L / 2 - 0.07, S.handle, 0),
    /** Le chariot a avancé de `d` m le long de son x local : les roues tournent, les roulettes suivent la marche. */
    roll(d) {
      cart.distance += d;
      if (d > 0) swivel.fill(0);
      else if (d < 0) swivel.fill(Math.PI);
      update();
    },
    /** Timon du chariot lourd : 0 = horizontal, négatif = vers le sol, positif = relevé (radians). */
    setDrawbar(angle) {
      cart.drawbar = angle;
      update();
    }
  };
  function update() {
    for (const rig of rigs) {
      for (const { A, r, part, caster } of wheels) {
        const m = rig.matrices[part].identity();
        if (caster) turnAbout(m, caster.pivot, rot.makeRotationY(swivel[caster.part - 4]));
        turnAbout(m, A, rot.makeRotationZ(-cart.distance / r));
        if (caster) turnAbout(rig.matrices[caster.part].identity(), caster.pivot, rot.makeRotationY(swivel[caster.part - 4]));
      }
      if (heavy) turnAbout(rig.matrices[DRAWBAR].identity(), heavyPivot, rot.makeRotationZ(cart.drawbar));
      rig.apply();
    }
    if (heavy) cart.handle.copy(heavyTip).sub(heavyPivot).applyAxisAngle(new THREE4.Vector3(0, 0, 1), cart.drawbar).add(heavyPivot);
  }
  cart.distance = rng.range(0, 3);
  if (heavy) {
    const down = -Math.asin(Math.min(1, (heavyPivot.y - 0.07) / heavyTip.distanceTo(heavyPivot)));
    cart.drawbar = p.drawbar === "up" ? 1.38 + rng.range(-0.08, 0.04) : down + rng.range(0, 0.04);
  }
  update();
  group.userData.cart = cart;
  group.userData.surfaces = S.shelves.map((y) => ({ y, size: [S.L - 0.06, S.D - 0.06], center: [0, 0] }));
  group.userData.surface = group.userData.surfaces[group.userData.surfaces.length - 1];
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
