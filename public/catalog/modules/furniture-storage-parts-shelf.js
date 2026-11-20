// Projet Vie 3D — Étagère à pièces (furniture/storage/parts-shelf), version 1
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/furniture/storage/parts-shelf.js
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
function buildGem({ length = 0.6, radius = 0.15, sides = 6, waist = 0.5, position = new THREE2.Vector3(), direction = new THREE2.Vector3(0, 1, 0), spin = 0 } = {}) {
  const positions = [];
  const normals = [];
  const facet = [];
  const index = [];
  const top = new THREE2.Vector3(0, length * (1 - waist), 0);
  const bottom = new THREE2.Vector3(0, -length * waist, 0);
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a2 = spin + i / sides * Math.PI * 2;
    ring.push(new THREE2.Vector3(Math.cos(a2) * radius, 0, Math.sin(a2) * radius));
  }
  const quaternion = new THREE2.Quaternion().setFromUnitVectors(new THREE2.Vector3(0, 1, 0), direction.clone().normalize());
  const a = new THREE2.Vector3(), b = new THREE2.Vector3(), normal = new THREE2.Vector3();
  const tri = (p1, p2, p3, f) => {
    a.subVectors(p2, p1);
    b.subVectors(p3, p1);
    normal.crossVectors(a, b).normalize().applyQuaternion(quaternion);
    const first = positions.length / 3;
    for (const p of [p1, p2, p3]) {
      const q = p.clone().applyQuaternion(quaternion).add(position);
      positions.push(q.x, q.y, q.z);
      normals.push(normal.x, normal.y, normal.z);
      facet.push(f);
    }
    index.push(first, first + 1, first + 2);
  };
  for (let i = 0; i < sides; i++) {
    const p = ring[i], q = ring[(i + 1) % sides];
    tri(top, q, p, i);
    tri(bottom, p, q, i + sides);
  }
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new THREE2.BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(index);
  geometry.userData.facet = facet;
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

// src/assets/furniture/storage/parts-shelf.js
var MODELS = {
  parts: "Pi\xE8ces d\xE9tach\xE9es (Atelier, 2 m)",
  prints: "Tirages (salle 2, 0,9 m)",
  standards: "Armoire d'\xE9talons (kit d'\xE9tude)"
};
var FILLS = { full: "Plein", some: "Entam\xE9", empty: "Presque vide" };
var DOORS = { closed: "Ferm\xE9e", open: "Ouverte" };
var PRINT = { ramp: ["#5a3418", "#b06a28", "#d8c9a0", "#f1e7c8"], ink: "#3a2412" };
var GLASS = { ramp: ["#3a4a4e", "#6c8888", "#a9c8c4", "#dcf4f0"], ink: "#1c2628" };
var params = {
  seed: seedParam("Change les bacs tir\xE9s ou manquants et leur contenu, les piles de cadres, les rangs de poids et de diapasons, les tons du bois."),
  model: choiceParam("Mod\xE8le", MODELS, "Grande \xE9tag\xE8re \xE0 bacs de l'Atelier, \xE9tag\xE8re de tirages encadr\xE9s, ou armoire vitr\xE9e d'\xE9talons."),
  fill: choiceParam("Garni", FILLS, "Tout est en place, une partie a servi, ou presque tout a \xE9t\xE9 pris."),
  door: choiceParam("Porte", DOORS, "Armoire d'\xE9talons : porte vitr\xE9e ferm\xE9e ou ouverte (userData.shelf.setDoor).")
};
var meta = {
  id: "furniture/storage/parts-shelf",
  name: "\xC9tag\xE8re \xE0 pi\xE8ces",
  nameEn: "Parts shelf",
  category: "furniture",
  subcategory: "storage",
  description: "R\xE9serves du Complexe : grande \xE9tag\xE8re de l'Atelier \xE0 bacs de bois \xE9tiquet\xE9s (rouages, ressorts, bobines de cuivre, cristaux bruts) ; \xE9tag\xE8re de tirages en cadres de verre couch\xE9s en piles ; armoire vitr\xE9e d'\xE9talons (poids de laiton, diapasons, cristaux de r\xE9f\xE9rence). Plein, entam\xE9, presque vide. Fiches ATE-07, E2-05, ETU-14.",
  tags: [
    "\xE9tag\xE8re",
    "bacs",
    "pi\xE8ces d\xE9tach\xE9es",
    "rouages",
    "ressorts",
    "bobines",
    "cuivre",
    "cristaux",
    "\xE9tiquettes",
    "tirages",
    "cadres",
    "verre",
    "armoire",
    "\xE9talons",
    "poids",
    "diapasons",
    "porte vitr\xE9e",
    "tiroir",
    "bronze",
    "ch\xEAne noirci",
    "atelier",
    "le complexe",
    "complexe",
    "ancien-tech",
    "rangement",
    "int\xE9rieur",
    "shelf",
    "bins",
    "spare parts",
    "gears",
    "springs",
    "coils",
    "copper wire",
    "crystals",
    "labels",
    "prints",
    "picture frames",
    "glass",
    "cabinet",
    "standards",
    "brass weights",
    "tuning forks",
    "glass door",
    "drawer",
    "bronze fittings",
    "blackened oak",
    "workshop",
    "ancient complex",
    "ancient-tech",
    "storage",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au milieu du dos (contre le mur, z = 0), la fa\xE7ade vers +z",
  footprint: { radius: 1.1, height: 2.5 },
  animated: [],
  params,
  variants: [
    { id: "parts", name: "Pi\xE8ces d\xE9tach\xE9es", params: {} },
    { id: "parts-empty", name: "Pi\xE8ces, presque vide", params: { fill: "empty" } },
    { id: "prints", name: "Tirages", params: { model: "prints" } },
    { id: "standards", name: "\xC9talons", params: { model: "standards" } },
    { id: "standards-open", name: "\xC9talons, porte ouverte", params: { model: "standards", door: "open", fill: "some" } }
  ]
};
var lit = (t = 0, top = 0.14) => (x, y, z, nx, ny) => t + (ny > 0.5 ? top : ny < -0.5 ? -0.3 : 0);
var box = (size, position, rotation) => buildBlock(size, position, rotation);
var cylinder = (r, h, x, y, z, sides = 8) => plain(new THREE4.CylinderGeometry(r, r, h, sides)).translate(x, y + h / 2, z);
var woodMaterial = (entry, seed) => createToonMaterial({
  ramp: entry.ramp,
  ink: entry.ink,
  steps: [0.26, 0.48, 0.74],
  tone: true,
  crease: true,
  pattern: "speckle",
  patternParams: [16, 0.05, 0.12, 1],
  seed: seed % 97,
  id: 20
});
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 6151 + 211);
  const group = new THREE4.Group();
  group.name = meta.name;
  if (p.model === "prints") buildPrints(group, p, rng);
  else if (p.model === "standards") buildStandards(group, p, rng);
  else buildParts(group, p, rng);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
function addMeshes(group, entries) {
  const meshes = [];
  for (const [name, geometry, material, shadow] of entries) {
    if (!geometry) continue;
    const mesh = new THREE4.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}
function buildParts(group, p, rng) {
  const W = 2, D = 0.5, H = 2.2;
  const fixedWood = [], fixedMetal = [];
  const tone = rng.range(-0.06, 0.06);
  for (const x of [-W / 2 + 0.025, W / 2 - 0.025]) {
    for (const z of [0.025, D - 0.025]) fixedMetal.push(withTone(box([0.05, H, 0.05], [x, H / 2, z]), lit(0.05)));
    fixedMetal.push(withTone(box([0.03, 0.05, D - 0.05], [x, H - 0.08, D / 2]), 0));
    fixedMetal.push(withTone(box([0.03, 0.05, D - 0.05], [x, 0.12, D / 2]), 0));
  }
  fixedMetal.push(withTone(beam([-W / 2 + 0.05, 0.12, 0.015], [W / 2 - 0.05, H - 0.1, 0.015], 0.025, 0.025), -0.2));
  fixedMetal.push(withTone(beam([-W / 2 + 0.05, H - 0.1, 0.012], [W / 2 - 0.05, 0.12, 0.012], 0.025, 0.025), -0.2));
  const levels = [0.08, 0.5, 0.92, 1.34, 1.76];
  for (const y of [...levels, H - 0.03]) {
    fixedWood.push(withTone(box([W - 0.1, 0.03, D - 0.02], [0, y, D / 2]), lit(-0.78 + tone + rng.range(-0.04, 0.04), 0.1)));
    fixedMetal.push(withTone(box([W - 0.1, 0.012, 0.01], [0, y - 4e-3, D - 5e-3]), 0.1));
  }
  const KINDS = ["gears", "springs", "coils", "crystals", "gears", "coils"];
  const missChance = { full: 0.03, some: 0.22, empty: 0.7 }[p.fill];
  const fullness = { full: 1, some: 0.6, empty: 0.25 }[p.fill];
  const bins = [];
  const binWood = [], binMetal = [], binGlow = [];
  const BW = 0.25, BD = 0.35, BH = 0.15;
  const gap = (W - 0.1 - 7 * BW) / 6;
  levels.forEach((ly, level) => {
    for (let i = 0; i < 7; i++) {
      const k = bins.length;
      const x = -W / 2 + 0.05 + BW / 2 + i * (BW + gap);
      const y = ly + 0.015;
      const present = !rng.chance(missChance);
      const pulled = present && rng.chance(0.14) ? rng.range(0.08, 0.2) : 0;
      const kind = rng.pick(KINDS);
      const z0 = 0.06;
      bins.push({ kind, present, position: new THREE4.Vector3(x, y, z0 + BD / 2 + pulled), pulled });
      if (!present) continue;
      const t = tone + rng.range(-0.08, 0.08);
      const zc = z0 + BD / 2;
      binWood.push([withTone(box([BW, BH - 0.03, BD - 0.02], [x, y + (BH - 0.03) / 2, zc - 0.01]), (xx, yy, zz, nx, ny) => ny > 0.5 ? -0.7 : t + 0.05), k]);
      binWood.push([withTone(box([BW, BH, 0.02], [x, y + BH / 2, z0 + BD - 0.01]), lit(t + 0.22, 0.2)), k]);
      binMetal.push([withTone(box([0.07, 0.045, 8e-3], [x, y + BH * 0.6, z0 + BD + 4e-3]), 0.7), k]);
      const top = y + BH - 0.03;
      const count = Math.max(0, Math.round(rng.range(1.6, 3.4) * fullness));
      for (let c = 0; c < count; c++) {
        const cx = x + rng.range(-0.08, 0.08), cz = zc + rng.range(-0.11, 0.11);
        if (kind === "gears") {
          const g = plain(new THREE4.CylinderGeometry(0.055, 0.055, 0.016, 7));
          g.rotateX(rng.range(-0.3, 0.3));
          g.translate(cx, top + 0.012 + c * 6e-3, cz);
          binMetal.push([withTone(g, lit(0.3, 0.15)), k]);
        } else if (kind === "springs") {
          binMetal.push([withTone(cylinder(0.02, rng.range(0.05, 0.08), cx, top - 0.02, cz, 5), (xx, yy) => Math.floor(yy / 0.012) % 2 ? -0.35 : -0.1), k]);
        } else if (kind === "coils") {
          const g = plain(new THREE4.CylinderGeometry(0.045, 0.045, 0.05, 7));
          g.rotateZ(Math.PI / 2);
          g.rotateY(rng.range(-0.6, 0.6));
          g.translate(cx, top + 0.03, cz);
          binWood.push([withTone(g, lit(0.32, 0.12)), k]);
        } else {
          const g = plain(buildGem({ length: rng.range(0.06, 0.1), radius: 0.022, sides: 5, waist: 0.3, position: new THREE4.Vector3(cx, top + 0.02, cz), direction: new THREE4.Vector3(rng.range(-0.5, 0.5), 1, rng.range(-0.5, 0.5)) }));
          binGlow.push([g, k]);
        }
      }
    }
  });
  if (rng.chance(0.6)) fixedWood.push(withTone(box([0.5, 0.3, 0.4], [rng.range(-0.6, 0.6), H + 0.15, D / 2]), lit(-0.15)));
  else {
    const g = plain(new THREE4.CylinderGeometry(0.16, 0.16, 0.22, 10));
    g.rotateZ(Math.PI / 2);
    g.translate(rng.range(-0.6, 0.6), H + 0.16, D / 2);
    fixedWood.push(withTone(g, lit(0.3, 0.1)));
  }
  const n = bins.length;
  const woodParts = mergeParts([...fixedWood.map((g) => [g, 255]), ...binWood]);
  const metalParts = mergeParts([...fixedMetal.map((g) => [g, 255]), ...binMetal]);
  const glowParts = binGlow.length ? mergeParts(binGlow) : null;
  const [woodMesh, metalMesh, glowMesh] = addMeshes(group, [
    ["wood", woodParts.geometry, woodMaterial(WOODS.oak, p.seed), true],
    ["bronze", metalParts.geometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }), true],
    ["crystals", glowParts?.geometry, glowMaterial("cyan", { level: 2, id: 40 }), false]
  ]);
  const rigs = [createRigidParts(woodMesh.geometry, woodParts.partOf, n), createRigidParts(metalMesh.geometry, metalParts.partOf, n)];
  if (glowMesh) rigs.push(createRigidParts(glowMesh.geometry, glowParts.partOf, n));
  const slide = (i, d) => {
    const bin = bins[i];
    if (!bin) return;
    bin.pulled = THREE4.MathUtils.clamp(d, 0, 0.3);
    bin.position.z = 0.06 + BD / 2 + bin.pulled;
    for (const rig of rigs) {
      rig.matrices[i].makeTranslation(0, 0, bin.pulled);
      rig.apply();
    }
  };
  bins.forEach((bin, i) => {
    for (const rig of rigs) rig.matrices[i].makeTranslation(0, 0, bin.pulled);
  });
  for (const rig of rigs) rig.apply();
  group.userData.shelf = { bins, slide };
  group.userData.surface = { y: H, size: [W, D] };
}
function buildPrints(group, p, rng) {
  const W = 0.9, D = 0.3, H = 1.5;
  const wood = [], metal = [], paper = [];
  const tone = rng.range(-0.05, 0.08);
  for (const s of [-1, 1]) wood.push(withTone(box([0.03, H, D], [s * (W / 2 - 0.015), H / 2, D / 2]), lit(tone)));
  wood.push(withTone(box([W - 0.06, H - 0.04, 0.015], [0, H / 2, 75e-4]), -0.5));
  const levels = [0.05, 0.34, 0.63, 0.92, 1.21];
  for (const y of [...levels, H - 0.02]) wood.push(withTone(box([W - 0.06, 0.025, D - 0.01], [0, y, D / 2]), lit(tone + 0.05, 0.12)));
  wood.push(withTone(box([W + 0.02, 0.03, D + 0.02], [0, H + 0.015, D / 2]), lit(tone + 0.1)));
  const fullness = { full: [3, 6], some: [1, 4], empty: [0, 1] }[p.fill];
  const stacks = [];
  const frame = (x, y, z, ry, showPrint) => {
    metal.push(withTone(box([0.4, 0.022, 0.26], [x, y + 0.011, z], [0, ry, 0]), lit(-0.05, 0.25)));
    const label = box([0.05, 0.012, 4e-3], [0, 0, 0]);
    label.rotateY(ry);
    label.translate(x + Math.sin(ry) * 0.13, y + 0.011, z + Math.cos(ry) * 0.132);
    paper.push(withTone(label, 0.3));
    if (showPrint) printFace(paper, rng, new THREE4.Matrix4().makeRotationY(ry).setPosition(x, y + 0.023, z));
  };
  levels.forEach((ly) => {
    for (const sx of [-0.215, 0.215]) {
      const count = rng.int(fullness[0], fullness[1]);
      stacks.push({ x: sx, y: ly + 0.0125, count });
      for (let c = 0; c < count; c++) frame(sx + rng.range(-0.012, 0.012), ly + 0.0125 + c * 0.024, D / 2 + 5e-3, rng.range(-0.04, 0.04), c === count - 1);
    }
  });
  for (let i = 0; i < rng.int(p.fill === "full" ? 0 : 1, 2); i++) {
    const m = new THREE4.Matrix4().makeTranslation(rng.range(-0.3, 0.3), 0, D + 0.08 + i * 0.03).multiply(new THREE4.Matrix4().makeRotationY(rng.range(-0.15, 0.15))).multiply(new THREE4.Matrix4().makeRotationX(Math.PI / 2 - 0.22)).multiply(new THREE4.Matrix4().makeTranslation(0, 0, -0.15));
    metal.push(withTone(box([0.4, 0.022, 0.3], [0, 0.011, 0]).applyMatrix4(m), lit(-0.05, 0.25)));
    printFace(paper, rng, m.clone().multiply(new THREE4.Matrix4().makeTranslation(0, 0.023, 0)), 0.3);
  }
  addMeshes(group, [
    ["wood", mergeToned2(wood), woodMaterial(WOODS.blackenedOak, p.seed), true],
    ["frames", mergeToned2(metal), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }), true],
    ["prints", mergeToned2(paper), createToonMaterial({ ramp: PRINT.ramp, ink: PRINT.ink, steps: [0.2, 0.42, 0.7], tone: true, id: 21 }), false]
  ]);
  group.userData.shelf = { stacks };
  group.userData.surface = { y: H + 0.03, size: [W + 0.02, D + 0.02] };
}
function printFace(paper, rng, m, depth = 0.22) {
  paper.push(withTone(box([0.34, 4e-3, depth], [0, 2e-3, 0]).applyMatrix4(m), 0.15));
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const horizontal = rng.chance(0.6);
    const len = rng.range(0.1, 0.26);
    const size = horizontal ? [len, 3e-3, 0.016] : [0.016, 3e-3, Math.min(len, depth - 0.06)];
    const pos = [rng.range(-0.15 + size[0] / 2, 0.15 - size[0] / 2), 5e-3, rng.range(-depth / 2 + 0.03 + size[2] / 2, depth / 2 - 0.03 - size[2] / 2)];
    paper.push(withTone(box(size, pos).applyMatrix4(m), -0.75));
  }
}
function buildStandards(group, p, rng) {
  const W = 0.7, D = 0.4, H = 1.6;
  const wood = [], metal = [], glass = [];
  const doorWood = [], doorMetal = [], doorGlass = [];
  const tone = rng.range(-0.05, 0.08);
  for (const s of [-1, 1]) wood.push(withTone(box([0.03, H - 0.06, D], [s * (W / 2 - 0.015), (H - 0.06) / 2 + 0.06, D / 2]), lit(tone)));
  wood.push(withTone(box([W - 0.06, H - 0.1, 0.015], [0, H / 2, 75e-4]), -0.25));
  wood.push(withTone(box([W + 0.02, 0.06, D + 0.01], [0, 0.03, D / 2]), lit(tone - 0.1)));
  wood.push(withTone(box([W + 0.04, 0.04, D + 0.03], [0, H - 0.02, D / 2 + 0.01]), lit(tone + 0.1)));
  wood.push(withTone(box([W - 0.06, 0.22, D - 0.02], [0, 0.17, D / 2 - 0.01]), lit(tone - 0.05)));
  wood.push(withTone(box([W - 0.08, 0.18, 0.015], [0, 0.17, D - 0.012]), lit(tone + 0.14, 0.2)));
  metal.push(withTone(box([0.12, 0.025, 0.02], [0, 0.18, D + 5e-3]), lit(0.3)));
  const shelves = [0.28, 0.6, 0.92, 1.24];
  for (const y of shelves) wood.push(withTone(box([W - 0.06, 0.02, D - 0.06], [0, y, D / 2 - 0.02]), lit(tone + 0.05, 0.12)));
  const kinds = ["weights", "weights", "forks", "crystals"];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const keep = { full: 1, some: 0.65, empty: 0.2 }[p.fill];
  shelves.forEach((sy, level) => {
    const y = sy + 0.01;
    const kind = kinds[level];
    if (kind === "weights") {
      const count = rng.int(5, 7);
      let x = -W / 2 + 0.08;
      for (let i = 0; i < count; i++) {
        const r = 0.055 - i * 65e-4;
        if (rng.chance(keep)) {
          const h = r * 1.5;
          metal.push(withTone(plain(buildLathe([[0, 0], [r, 0], [r, h * 0.8], [r * 0.45, h * 0.85], [r * 0.45, h], [0, h]], { segments: 8, facets: true })).translate(x + r, y, D / 2 - 0.02 + rng.range(-0.03, 0.03)), lit(0.2, 0.15)));
        }
        x += r * 2 + 0.018;
      }
    } else if (kind === "forks") {
      for (let i = 0; i < 4; i++) {
        if (!rng.chance(keep)) continue;
        const x = -W / 2 + 0.11 + i * 0.155, z = D / 2 - 0.02;
        const h = 0.22 - i * 0.03;
        wood.push(withTone(box([0.1, 0.03, 0.08], [x, y + 0.015, z]), lit(tone + 0.2)));
        metal.push(withTone(box([0.012, 0.05, 0.012], [x, y + 0.055, z]), 0.2));
        metal.push(withTone(box([0.05, 0.012, 0.012], [x, y + 0.085, z]), 0.2));
        for (const s of [-1, 1]) metal.push(withTone(box([0.012, h, 0.012], [x + s * 0.019, y + 0.09 + h / 2, z]), lit(0.25)));
      }
    } else {
      wood.push(withTone(box([W - 0.16, 0.025, D - 0.14], [0, y + 0.0125, D / 2 - 0.02]), -0.85));
      for (let i = 0; i < 6; i++) {
        if (!rng.chance(keep)) continue;
        const x = -W / 2 + 0.13 + i * 0.09;
        const len = rng.range(0.06, 0.11);
        const g = plain(buildGem({ length: len, radius: 0.022, sides: 6, waist: 0.4, position: new THREE4.Vector3(x, y + 0.025 + len * 0.4, D / 2 - 0.02 + rng.range(-0.04, 0.04)), direction: new THREE4.Vector3(rng.range(-0.2, 0.2), 1, 0) }));
        glass.push(cover(withTone(g, 0.25), 1));
      }
    }
  });
  const y0 = 0.29, y1 = H - 0.045, dz = D + 0.012;
  const dh = y1 - y0, dw = W - 0.04;
  for (const [w, h, x, y] of [[0.05, dh, -dw / 2 + 0.025, y0 + dh / 2], [0.05, dh, dw / 2 - 0.025, y0 + dh / 2], [dw, 0.05, 0, y0 + 0.025], [dw, 0.05, 0, y1 - 0.025], [dw, 0.03, 0, y0 + dh * 0.5]]) {
    doorWood.push(withTone(box([w, h, 0.025], [x, y, dz]), lit(tone + 0.08)));
  }
  doorMetal.push(withTone(plain(new THREE4.SphereGeometry(0.016, 6, 4)).translate(dw / 2 - 0.03, y0 + dh * 0.55, dz + 0.025), 0.3));
  for (const y of [y0 + 0.12, y1 - 0.12]) metal.push(withTone(box([0.02, 0.06, 0.02], [-W / 2 + 0.01, y, dz]), 0.1));
  doorGlass.push(cover(withTone(box([dw - 0.08, dh - 0.08, 6e-3], [0, y0 + dh / 2, dz]), -0.2), 0.24));
  const woodParts = mergeParts([...wood.map((g) => [g, 255]), ...doorWood.map((g) => [g, 0])]);
  const metalParts = mergeParts([...metal.map((g) => [g, 255]), ...doorMetal.map((g) => [g, 0])]);
  const glassParts = mergeParts([...glass.map((g) => [g, 255]), ...doorGlass.map((g) => [g, 0])]);
  const [woodMesh, metalMesh, glassMesh] = addMeshes(group, [
    ["wood", woodParts.geometry, woodMaterial(WOODS.walnut, p.seed), true],
    ["brass", metalParts.geometry, metalMaterial(METALS.bronze, { id: 30, tone: true }), true],
    ["glass", glassParts.geometry, createToonMaterial({ ramp: GLASS.ramp, ink: GLASS.ink, steps: [0.25, 0.5, 0.8], tone: true, dither: true, outline: false, id: 32 }), false]
  ]);
  const rigs = [
    createRigidParts(woodMesh.geometry, woodParts.partOf, 1),
    createRigidParts(metalMesh.geometry, metalParts.partOf, 1),
    createRigidParts(glassMesh.geometry, glassParts.partOf, 1)
  ];
  const hinge = new THREE4.Vector3(-W / 2 + 0.01, 0, dz);
  const setDoor = (t) => {
    const a = -THREE4.MathUtils.clamp(t, 0, 1) * 1.9;
    const m = new THREE4.Matrix4().makeTranslation(hinge.x, 0, hinge.z).multiply(new THREE4.Matrix4().makeRotationY(a)).multiply(new THREE4.Matrix4().makeTranslation(-hinge.x, 0, -hinge.z));
    for (const rig of rigs) {
      rig.matrices[0].copy(m);
      rig.apply();
    }
  };
  setDoor(p.door === "open" ? 1 : 0);
  group.userData.shelf = { setDoor };
  group.userData.surface = { y: H, size: [W + 0.04, D + 0.03] };
}
function cover(geometry, value) {
  geometry.setAttribute("aCover", new THREE4.BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(value), 1));
  return geometry;
}
function mergeToned2(list) {
  return mergeParts(list.map((g) => [g, 255])).geometry;
}
export {
  create,
  disposeObject as dispose,
  meta,
  setWind,
  tick
};
