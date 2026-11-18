// Projet Vie 3D — Porte des étoiles (props/magic/star-portal), version 3
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/props/magic/star-portal.js
import * as THREE3 from "three";

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

// src/assets/kit/portal.js
var TAU = Math.PI * 2;
var LOCK_ARC = 260 / 180 * Math.PI;
function lockAngle(i, n) {
  return Math.PI / 2 + LOCK_ARC / 2 - i / (n - 1) * LOCK_ARC;
}
function glyphAngle(j, glyphs) {
  return Math.PI / 2 + j / glyphs * TAU;
}
function portalSequence(seed, locks) {
  const rng = createRng(seed * 4241 + 913);
  const glyphs = 24 + 2 * rng.int(0, 6);
  const address = [];
  while (address.length < locks) {
    const j = rng.int(0, glyphs - 1);
    if (!address.includes(j)) address.push(j);
  }
  const steps = [];
  let t = 1.2;
  let angle = 0;
  for (let i = 0; i < locks; i++) {
    const target = lockAngle(i, locks) - glyphAngle(address[i], glyphs);
    const dir = i % 2 === 0 ? -1 : 1;
    let delta = ((target - angle) * dir % TAU + TAU) % TAU;
    if (delta < Math.PI / 2) delta += TAU;
    const to = angle + delta * dir;
    const spin = 0.9 + delta / TAU * 1.5 + rng.range(0, 0.4);
    steps.push({ start: t, spinEnd: t + spin, lockEnd: t + spin + 0.55, from: angle, to });
    angle = to;
    t += spin + 0.55 + rng.range(0.25, 0.5);
  }
  const burst = t + 0.3;
  const open = burst + 1.5;
  const close = open + 9;
  const end = close + 1;
  return { glyphs, address, steps, burst, open, close, end, duration: end + 2.5 };
}
var smooth = (k) => k * k * (3 - 2 * k);
var clamp01 = (k) => Math.min(1, Math.max(0, k));
function portalStateAt(seq, time, mode = "cycle") {
  const n = seq.steps.length;
  if (mode === "dormant") return { ring: 0, locked: new Array(n).fill(0), horizon: "off", k: 0, t: 0 };
  if (mode === "open") {
    return { ring: seq.steps[n - 1].to, locked: new Array(n).fill(1), horizon: "open", k: 0.5, t: time };
  }
  const t = (time % seq.duration + seq.duration) % seq.duration;
  let ring = 0;
  const locked = [];
  for (const step of seq.steps) {
    if (t >= step.start) ring = step.from + (step.to - step.from) * smooth(clamp01((t - step.start) / (step.spinEnd - step.start)));
    locked.push(t >= seq.end ? 0 : clamp01((t - step.spinEnd) / (step.lockEnd - step.spinEnd)));
  }
  if (t >= seq.end) ring = seq.steps[n - 1].to * (1 - smooth(clamp01((t - seq.end) / 2)));
  let horizon = "off", k = 0;
  if (t >= seq.burst && t < seq.open) horizon = "burst", k = (t - seq.burst) / (seq.open - seq.burst);
  else if (t >= seq.open && t < seq.close) horizon = "open", k = (t - seq.open) / (seq.close - seq.open);
  else if (t >= seq.close && t < seq.end) horizon = "closing", k = (t - seq.close) / (seq.end - seq.close);
  return { ring, locked, horizon, k, t };
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
function variantsOf(name, spec) {
  const values = [spec.default, ...spec.values.filter((value) => value !== spec.default)];
  return values.map((value) => ({ id: value, name: spec.labels?.[value] ?? value, params: { [name]: value } }));
}
function pick(table, only) {
  if (!only) return table;
  return Object.fromEntries(only.map((key) => [key, table[key]]));
}

// src/assets/props/magic/star-portal.js
var PORTAL_ENERGIES = {
  ice: { label: "Azur", from: MAGIC_PALETTES.ice },
  lagoon: { label: "Lagon", from: MAGIC_PALETTES.lagoon },
  arcane: { label: "Arcane", from: MAGIC_PALETTES.arcane },
  sap: { label: "S\xE8ve", from: MAGIC_PALETTES.sap },
  ember: { label: "Braise", from: MAGIC_PALETTES.ember }
};
function energyRamp(key) {
  return fitRamp(PORTAL_ENERGIES[key].from.colors.slice(1, 8), 5);
}
var ENERGY_STEPS = [0.22, 0.45, 0.66, 0.85];
var ENERGY_EMISSIVE = 0.44;
var BASES = { stairs: "Escalier", ramp: "Rampe", ruin: "Ruine" };
var STATES = { cycle: "Composition en boucle", dormant: "Endormie", open: "Ouverte" };
var params = {
  seed: seedParam(
    "Change l'adresse compos\xE9e et le rythme de la s\xE9quence, le nombre de symboles (24 \xE0 36) et leur dessin, la forme des verrous, et la plateforme : hauteur, nombre de marches, dallage, bornes, pierres tomb\xE9es."
  ),
  base: choiceParam(
    "Plateforme",
    BASES,
    "Escalier devant, longue rampe en pente douce, ou ruine (marches cass\xE9es, dalles disjointes, pierres tomb\xE9es). La passerelle passe toujours au ras du bas de l'ouverture."
  ),
  state: choiceParam("\xC9tat", STATES, "En boucle : l'anneau tourne, les verrous s'enclenchent, le vortex jaillit, ondule puis se referme. Endormie ou ouverte : fig\xE9e."),
  probe: choiceParam("Sonde", { on: "Une sonde traverse", off: "Aucune" }, "Une petite sonde de cristal traverse le vortex ouvert, aller et retour, pour montrer l'onde de passage."),
  locks: { type: "int", default: 7, min: 5, max: 9, label: "Verrous", description: "Nombre de verrous de cristal, donc de symboles dans une adresse (la console doit avoir le m\xEAme)." },
  energy: choiceParam("\xC9nergie", PORTAL_ENERGIES, "Couleur du vortex, des cristaux et des symboles allum\xE9s."),
  stone: stoneParam("Pierre de l'anneau et de la plateforme.", { only: ["granite", "slate", "basalt", "sandstone"] })
};
var meta = {
  id: "props/magic/star-portal",
  name: "Porte des \xE9toiles",
  nameEn: "Star portal",
  category: "props",
  subcategory: "magic",
  description: "Anneau de pierre de 6,70 m (ouverture de 4,76 m) enfonc\xE9 d'un quart dans une plateforme qu'on traverse de plain-pied. Son anneau int\xE9rieur grav\xE9 de symboles tourne, ses verrous de cristal se referment un \xE0 un et restent allum\xE9s, puis le vortex jaillit et ondule ; tout ce qui le traverse y fait une onde. Escaliers, rampes ou ruine ; se commande avec la console (m\xEAme graine, m\xEAme nombre de verrous).",
  tags: [
    "porte des \xE9toiles",
    "portail",
    "anneau",
    "porte",
    "vortex",
    "symboles",
    "glyphes",
    "verrous",
    "cristaux",
    "voyage",
    "passage entre les mondes",
    "escalier",
    "rampe",
    "magie",
    "science-fiction",
    "pierre",
    "anim\xE9",
    "ext\xE9rieur",
    "star portal",
    "portal",
    "gate",
    "ring",
    "wormhole",
    "glyphs",
    "symbols",
    "locks",
    "crystals",
    "travel",
    "world gate",
    "stairs",
    "ramp",
    "magic",
    "sci-fi",
    "stone",
    "animated",
    "outdoor",
    "procedural"
  ],
  biomes: ["forest", "meadow", "desert", "snow", "mountain", "cave", "beach", "swamp"],
  version: 3,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol au centre de la plateforme ; l'anneau fait face \xE0 +Z (le vortex jaillit vers +Z) ; la passerelle (dessus de la plateforme) est \xE0 `group.userData.walkway` m",
  footprint: { radius: 7.2, height: 7.1 },
  animated: ["dial", "glow", "ripple"],
  params,
  variants: variantsOf("base", params.base)
};
var TAU2 = Math.PI * 2;
var R_APERTURE = 2.38;
var LIP = [2.34, 2.5, 0.34];
var INNER = [2.5, 2.93, 0.25];
var OUTER = [2.93, 3.35, 0.4];
var GLYPH_DEPTH = INNER[2] + 0.02;
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const ramp = energyRamp(p.energy);
  const baseRng = createRng(p.seed * 7919 + 17);
  const glyphRng = createRng(p.seed * 104729 + 71);
  const lockRng = createRng(p.seed * 15485863 + 5);
  const seq = portalSequence(p.seed, p.locks);
  const noise = createNoise3(p.seed * 31 + 7);
  const group = new THREE3.Group();
  group.name = meta.name;
  const stoneParts = [];
  const rise = baseRng.range(0.16, 0.19);
  const steps = p.base === "ramp" ? 0 : baseRng.int(5, 7);
  const walkway = p.base === "ramp" ? baseRng.range(0.9, 1.15) : steps * rise;
  const width = baseRng.range(7.6, 8.4);
  const zBack = -baseRng.range(1.05, 1.3);
  const zFront = baseRng.range(1.8, 2.5);
  const depth = zFront - zBack;
  const zMid = (zFront + zBack) / 2;
  const ruin = p.base === "ruin";
  stoneParts.push(buildBlock([width, walkway - 0.08, depth], [0, (walkway - 0.08) / 2, zMid]));
  const cols = Math.round(width / 1.05), rows = Math.max(2, Math.round(depth / 1.05));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const w = width / cols, d = depth / rows;
      const x = -width / 2 + (i + 0.5) * w, z = zBack + (j + 0.5) * d;
      if (ruin && Math.abs(x) > R_APERTURE && baseRng.chance(0.18)) continue;
      const tilt = ruin && Math.abs(x) > 1.2 ? [baseRng.range(-0.05, 0.05), 0, baseRng.range(-0.05, 0.05)] : [0, 0, 0];
      stoneParts.push(buildBlock([w - 0.06, 0.1, d - 0.06], [x, walkway - 0.05, z], tilt));
    }
  }
  const stairWidth = baseRng.range(3.6, 4.4);
  const tread = baseRng.range(0.36, 0.44);
  let reach = zFront;
  {
    if (p.base === "ramp") {
      const length = walkway / baseRng.range(0.22, 0.27);
      const slope = Math.atan2(walkway, length);
      const hyp = Math.hypot(length, walkway);
      const mid = zFront + length / 2;
      stoneParts.push(buildBlock([stairWidth, 0.24, hyp], [0, walkway / 2 - 0.1, mid], [slope, 0, 0]));
      for (const sx of [-1, 1]) stoneParts.push(buildBlock([0.28, 0.42, hyp], [sx * (stairWidth / 2 + 0.14), walkway / 2 + 0.05, mid], [slope, 0, 0]));
      reach = Math.max(reach, zFront + length);
    } else {
      for (let s = 0; s < steps; s++) {
        const h = walkway - s * rise;
        if (ruin && s > 0 && baseRng.chance(0.25)) continue;
        const z = zFront + tread * (s + 0.5);
        const tilt = ruin ? [baseRng.range(-0.04, 0.04), baseRng.range(-0.04, 0.04), baseRng.range(-0.04, 0.04)] : [0, 0, 0];
        stoneParts.push(buildBlock([stairWidth + s * 0.12, h, tread + 0.02], [0, h / 2, z], tilt));
      }
      if (!ruin) {
        for (const sx of [-1, 1]) {
          const l = tread * steps;
          stoneParts.push(buildBlock([0.3, walkway, l], [sx * (stairWidth / 2 + steps * 0.06 + 0.15), walkway / 2, zFront + l / 2], [0, 0, 0], { taper: 0 }));
        }
      }
      reach = Math.max(reach, zFront + tread * steps);
    }
  }
  if (baseRng.chance(0.65) && !ruin) {
    const bh = baseRng.range(0.6, 1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) stoneParts.push(buildBlock([0.5, bh, 0.5], [sx * (width / 2 - 0.35), walkway + bh / 2, sz > 0 ? zFront - 0.35 : zBack + 0.35], [0, 0, 0], { taper: 0.3 }));
  }
  const buttress = baseRng.range(0.7, 1.1);
  for (const sx of [-1, 1]) {
    stoneParts.push(buildBlock([0.75, buttress, OUTER[2] * 2 + 0.5], [sx * (OUTER[1] + 0.05), walkway + buttress / 2 - 0.05, 0], [0, 0, 0], { taper: 0.25 }));
  }
  if (ruin) {
    const rubble = baseRng.int(6, 10);
    for (let i = 0; i < rubble; i++) {
      const a = baseRng.range(0, TAU2);
      const d = baseRng.range(4.4, 5.8);
      const s = baseRng.range(0.25, 0.6);
      stoneParts.push(buildBlock([s * baseRng.range(1, 1.8), s, s * baseRng.range(0.8, 1.4)], [Math.cos(a) * d * 0.9, s * 0.42, zMid + Math.sin(a) * d * 0.8], [baseRng.range(-0.25, 0.25), baseRng.range(0, TAU2), baseRng.range(-0.25, 0.25)]));
    }
  }
  const center = new THREE3.Vector3(0, walkway - 0.04 + R_APERTURE, 0);
  const ringParts = [];
  const [ro1, ro2, dO] = OUTER;
  const c = 0.1;
  ringParts.push(
    buildLathe([[ro1, -dO], [ro2 - c, -dO], [ro2, -dO + c], [ro2, dO - c], [ro2 - c, dO], [ro1, dO]], { segments: 48, axis: "z" }),
    buildLathe([[LIP[0], -LIP[2]], [LIP[1], -LIP[2]], [LIP[1], LIP[2]], [LIP[0], LIP[2]]], { segments: 48, axis: "z" })
  );
  const shoeWide = lockRng.range(0.5, 0.6), shoeNarrow = lockRng.range(0.26, 0.34);
  const jawLean = lockRng.range(0.12, 0.28);
  const crystalLength = lockRng.range(0.56, 0.66);
  for (let i = 0; i < p.locks; i++) {
    const a = lockAngle(i, p.locks);
    const radial = [Math.cos(a), Math.sin(a)];
    const at = (r, t, z) => [radial[0] * r - radial[1] * t, radial[1] * r + radial[0] * t, z];
    for (const face of [1, -1]) {
      const z = face * (dO + 0.05);
      ringParts.push(buildBlock([ro2 - ro1 - 0.06, (shoeWide + shoeNarrow) / 2, 0.12], at((ro1 + ro2) / 2, 0, z), [0, 0, a]));
      for (const side of [-1, 1]) {
        ringParts.push(buildBlock([0.42, 0.09, 0.2], at(ro1 + 0.16, side * (shoeNarrow / 2 + 0.07), face * (dO + 0.1)), [0, 0, a + side * jawLean]));
      }
    }
  }
  for (const geometry of ringParts) geometry.translate(center.x, center.y, center.z);
  stoneParts.push(...ringParts);
  const stoneMaterial = createToonMaterial({
    ramp: stone.ramp,
    ink: stone.ink,
    steps: [0.34, 0.56, 0.8],
    pattern: "speckle",
    patternParams: [16, 0.05, 0.2, 1],
    seed: baseRng.int(0, 96),
    crease: true,
    id: 10
  });
  const frame = new THREE3.Mesh(mergeGeometries(stoneParts), stoneMaterial);
  frame.name = "frame";
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);
  const G = seq.glyphs;
  const [ri1, ri2, dI] = INNER;
  const innerParts = [buildLathe([[ri1, -dI], [ri2, -dI], [ri2, dI], [ri1, dI]], { segments: 48, axis: "z" })];
  for (let j = 0; j < G; j++) {
    const a = glyphAngle(j + 0.5, G);
    const rm = (ri1 + ri2) / 2;
    innerParts.push(buildBlock([ri2 - ri1, 0.06, dI * 2 + 0.04], [Math.cos(a) * rm, Math.sin(a) * rm, 0], [0, 0, a]));
  }
  const innerRing = new THREE3.Mesh(
    mergeGeometries(innerParts),
    createToonMaterial({
      // Un cran plus sombre que l'anneau extérieur : la bande qui tourne se détache.
      ramp: [stone.ink, stone.ramp[0], stone.ramp[1], stone.ramp[2]],
      ink: stone.ink,
      steps: [0.3, 0.52, 0.78],
      pattern: "speckle",
      patternParams: [16, 0.04, 0.2, 1],
      seed: baseRng.int(0, 96),
      crease: true,
      id: 11
    })
  );
  innerRing.name = "inner-ring";
  innerRing.position.copy(center);
  innerRing.castShadow = true;
  innerRing.receiveShadow = true;
  group.add(innerRing);
  const positions = [];
  const normalsOf = [];
  const index = [];
  const pushQuad = (corners, z) => {
    const first = positions.length / 3;
    for (const [x, y] of corners) positions.push(x, y, z), normalsOf.push(0, 0, Math.sign(z));
    if (z > 0) index.push(first, first + 1, first + 2, first, first + 2, first + 3);
    else index.push(first, first + 2, first + 1, first, first + 3, first + 2);
  };
  const glyphRanges = [];
  const STROKE = 0.07;
  const gridU = [-0.1, 0, 0.1];
  const gridV = [-0.14, -0.05, 0.05, 0.14];
  for (let j = 0; j < G; j++) {
    const start = positions.length / 3;
    const a = glyphAngle(j, G);
    const rm = (ri1 + ri2) / 2;
    const rad = [Math.cos(a), Math.sin(a)];
    const tan = [-Math.sin(a), Math.cos(a)];
    const toRing = (u, v) => [rad[0] * (rm + v) + tan[0] * u, rad[1] * (rm + v) + tan[1] * u];
    const strokes = [];
    let pu = glyphRng.int(0, 2), pv = glyphRng.int(0, 3);
    const count = glyphRng.int(3, 5);
    for (let s = 0; s < count; s++) {
      if (s > 0 && glyphRng.chance(0.25)) pu = glyphRng.int(0, 2), pv = glyphRng.int(0, 3);
      let nu, nv, tries = 0;
      do {
        nu = THREE3.MathUtils.clamp(pu + glyphRng.int(-1, 1), 0, 2);
        nv = THREE3.MathUtils.clamp(pv + glyphRng.int(-1, 1) * (glyphRng.chance(0.4) ? 2 : 1), 0, 3);
      } while (nu === pu && nv === pv && ++tries < 8);
      if (nu !== pu || nv !== pv) strokes.push([gridU[pu], gridV[pv], gridU[nu], gridV[nv]]);
      pu = nu;
      pv = nv;
    }
    if (glyphRng.chance(0.35)) strokes.push([gridU[glyphRng.int(0, 2)], 0.19, null, null]);
    for (const [u1, v1, u2, v2] of strokes) {
      let corners;
      if (u2 === null) {
        const h = STROKE / 2;
        corners = [[u1 - h, v1 - h], [u1 + h, v1 - h], [u1 + h, v1 + h], [u1 - h, v1 + h]];
      } else {
        const du = u2 - u1, dv = v2 - v1, len = Math.hypot(du, dv);
        const ou = -dv / len * (STROKE / 2), ov = du / len * (STROKE / 2);
        const eu = du / len * (STROKE / 2), ev = dv / len * (STROKE / 2);
        corners = [[u1 - eu + ou, v1 - ev + ov], [u1 - eu - ou, v1 - ev - ov], [u2 + eu - ou, v2 + ev - ov], [u2 + eu + ou, v2 + ev + ov]];
      }
      const ring = corners.map(([u, v]) => toRing(u, v));
      const area = ring.reduce((s, [x, y], k) => s + x * ring[(k + 1) % 4][1] - ring[(k + 1) % 4][0] * y, 0);
      if (area < 0) ring.reverse();
      for (const z of [GLYPH_DEPTH, -GLYPH_DEPTH]) pushQuad(ring, z);
    }
    glyphRanges.push([start, positions.length / 3]);
  }
  const glyphGeometry = new THREE3.BufferGeometry();
  glyphGeometry.setAttribute("position", new THREE3.BufferAttribute(new Float32Array(positions), 3));
  glyphGeometry.setAttribute("normal", new THREE3.BufferAttribute(new Float32Array(normalsOf), 3));
  glyphGeometry.setIndex(index);
  let vertex = positions.length / 3;
  const gemGeometries = [];
  const crystals = [];
  for (let i = 0; i < p.locks; i++) {
    const a = lockAngle(i, p.locks);
    const dir = new THREE3.Vector3(Math.cos(a), Math.sin(a), 0);
    const first = vertex;
    const pieces = [];
    for (const face of [1, -1]) {
      const position = dir.clone().multiplyScalar(ro1 + 0.06).setZ(face * (dO + 0.17));
      pieces.push(buildGem({ length: crystalLength, radius: 0.13, sides: 4, waist: 0.62, position, direction: dir.clone().negate(), spin: Math.PI / 4 }));
    }
    for (const piece of pieces) vertex += piece.attributes.position.count;
    crystals.push({ first, last: vertex, dir, facets: pieces.flatMap((g) => g.userData.facet) });
    gemGeometries.push(...pieces);
  }
  const probeGeometry = buildGem({ length: 0.5, radius: 0.2, sides: 6, waist: 0.5 });
  const probeRange = [vertex, vertex + probeGeometry.attributes.position.count];
  const probeFacets = probeGeometry.userData.facet;
  vertex = probeRange[1];
  const RINGS = 13, SEG = 44;
  const discFirst = vertex;
  const disc = buildDisc(RINGS, SEG);
  const energyGeometry = mergeGeometries([glyphGeometry, ...gemGeometries, probeGeometry, disc]);
  const shadeArray = new Float32Array(energyGeometry.attributes.position.count);
  energyGeometry.setAttribute("aShade", new THREE3.BufferAttribute(shadeArray, 1));
  energyGeometry.boundingSphere = new THREE3.Sphere(new THREE3.Vector3(0, 0, 0), 7);
  const basePositions = Float32Array.from(energyGeometry.attributes.position.array);
  const energy = new THREE3.Mesh(
    energyGeometry,
    createToonMaterial({ ramp, steps: ENERGY_STEPS, unlit: true, shade: true, emissive: ENERGY_EMISSIVE, glow: false, side: THREE3.DoubleSide, id: 12 })
  );
  energy.name = "energy";
  energy.position.copy(center);
  group.add(energy);
  const ripples = [];
  const RIPPLE_LIFE = 1.6;
  let now = 0;
  function touch(x, y, direction = 1) {
    if (ripples.some((r) => now - r.born < 0.25 && Math.hypot(r.x - x, r.y - y) < 0.4)) return;
    ripples.push({ x, y, dir: Math.sign(direction) || 1, born: now });
    if (ripples.length > 6) ripples.shift();
  }
  const pos = energyGeometry.attributes.position;
  const pa = pos.array;
  const lockedGlyph = new Map(seq.address.map((g, i) => [g, i]));
  let glowLevel = 0;
  let horizonOpen = false;
  let probeZ = null;
  function update(time) {
    const s = portalStateAt(seq, time, p.state);
    now = time;
    innerRing.rotation.z = s.ring;
    const cos = Math.cos(s.ring), sin = Math.sin(s.ring);
    for (let j = 0; j < G; j++) {
      const lock = lockedGlyph.get(j);
      const lit = lock === void 0 ? 0 : s.locked[lock];
      const shade = lit >= 1 ? 0.92 : lit > 0 ? 1 : 0.1;
      for (let v2 = glyphRanges[j][0]; v2 < glyphRanges[j][1]; v2++) {
        const x = basePositions[v2 * 3], y = basePositions[v2 * 3 + 1];
        pa[v2 * 3] = x * cos - y * sin;
        pa[v2 * 3 + 1] = x * sin + y * cos;
        shadeArray[v2] = shade;
      }
    }
    const open = s.horizon === "open" || s.horizon === "burst";
    for (let i = 0; i < p.locks; i++) {
      const cr = crystals[i];
      const k = s.locked[i];
      const push = -0.14 * smooth2(k);
      const flash = k > 0 && k < 1;
      for (let v2 = cr.first; v2 < cr.last; v2++) {
        pa[v2 * 3] = basePositions[v2 * 3] + cr.dir.x * push;
        pa[v2 * 3 + 1] = basePositions[v2 * 3 + 1] + cr.dir.y * push;
        const facet = cr.facets[v2 - cr.first] % 2;
        shadeArray[v2] = flash ? 1 : k >= 1 ? (open ? 0.8 : 0.72) + facet * 0.14 : 0.26 + facet * 0.14;
      }
    }
    let radius = 0, surge = 0, boost = 0;
    if (s.horizon === "burst") {
      radius = smooth2(Math.min(1, s.k / 0.12));
      surge = s.k < 0.3 ? Math.sin(s.k / 0.3 * Math.PI / 2) : 1 - smooth2(Math.min(1, (s.k - 0.3) / 0.55));
      boost = 0.3 * (1 - s.k);
    } else if (s.horizon === "open") {
      radius = 1;
    } else if (s.horizon === "closing") {
      radius = 1 - smooth2(s.k);
      boost = 0.35 * s.k;
    }
    horizonOpen = radius > 0.9 && s.horizon !== "burst";
    if (!horizonOpen) ripples.length = 0;
    let probe = null;
    if (p.probe === "on" && horizonOpen) {
      const k = s.horizon === "open" && p.state === "cycle" ? s.k : s.t / 9 % 1;
      const leg = (from, to) => k >= from && k < to ? (k - from) / (to - from) : null;
      const go = leg(0.12, 0.36), back = leg(0.6, 0.84);
      const u = go ?? back;
      if (u !== null) {
        const z = go !== null ? 4.5 - 6 * u : -1.5 + 6 * u;
        probe = { x: Math.sin(u * 5) * 0.3, y: -R_APERTURE + 1.25 + Math.sin(u * TAU2) * 0.15, z };
      }
    }
    if (probe) {
      if (probeZ !== null && Math.sign(probeZ) !== Math.sign(probe.z)) touch(probe.x, probe.y, probe.z - probeZ);
      probeZ = probe.z;
    } else probeZ = null;
    for (let v2 = probeRange[0]; v2 < probeRange[1]; v2++) {
      const f = probeFacets[v2 - probeRange[0]];
      if (!probe || probe.z < -0.3) {
        pa[v2 * 3] = pa[v2 * 3 + 1] = pa[v2 * 3 + 2] = 0;
        continue;
      }
      const bx = basePositions[v2 * 3], by = basePositions[v2 * 3 + 1], bz = basePositions[v2 * 3 + 2];
      const spin = time * 2.5;
      pa[v2 * 3] = probe.x + bx * Math.cos(spin) + bz * Math.sin(spin);
      pa[v2 * 3 + 1] = probe.y + by;
      pa[v2 * 3 + 2] = probe.z - bx * Math.sin(spin) + bz * Math.cos(spin);
      shadeArray[v2] = 0.62 + f % 3 * 0.14;
    }
    for (let r = ripples.length - 1; r >= 0; r--) if (time - ripples[r].born > RIPPLE_LIFE) ripples.splice(r, 1);
    const t = s.t;
    let v = discFirst;
    for (let ring = 0; ring <= RINGS; ring++) {
      const r = ring / RINGS;
      const count = ring === 0 ? 1 : SEG;
      for (let k = 0; k < count; k++) {
        const a = k / SEG * TAU2 + ring % 2 * (Math.PI / SEG);
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        const n1 = noise(x * 3.1 + t * 0.3 + 5, y * 3.1 - t * 0.2, t * 0.4);
        const n2 = noise(x * 6.5 - t * 0.45, y * 6.5 + t * 0.3 + 9, 20 + t * 0.7);
        const ridge = Math.pow(1 - Math.abs(n1 * 2 - 1), 5);
        const sparkle = Math.max(0, n2 - 0.7) * 2.4;
        let shade = 0.26 + 0.24 * (1 - r) ** 2 + 0.4 * ridge + sparkle - 0.1 * r ** 6;
        shade += 0.06 * Math.sin(r * 14 - t * 2.6);
        let z = 0.04 * Math.sin(r * 9 - t * 3) * (1 - r);
        const px = x * R_APERTURE, py = y * R_APERTURE;
        for (const rp of ripples) {
          const age = time - rp.born;
          const d = Math.hypot(px - rp.x, py - rp.y);
          const fade = 1 - age / RIPPLE_LIFE;
          const front = 0.25 + age * 2.2;
          const crest = Math.exp(-(((d - front) / 0.2) ** 2)) * fade;
          const trough = Math.exp(-(((d - front + 0.38) / 0.16) ** 2)) * fade;
          const crest2 = Math.exp(-(((d - front + 0.8) / 0.16) ** 2)) * fade * 0.7;
          const flash = Math.exp(-((d / 0.5) ** 2)) * Math.max(0, 1 - age / 0.35);
          const hollow = Math.exp(-((d / 0.4) ** 2)) * Math.max(0, Math.min(1, (age - 0.2) * 4)) * fade;
          shade += 0.9 * crest - 0.55 * trough + 0.6 * crest2 + 1.2 * flash - 0.5 * hollow;
          z += rp.dir * (0.5 * flash + 0.25 * hollow + 0.15 * (crest - trough));
        }
        const bulge = surge * 3.1 * Math.pow(Math.max(0, 1 - r * r), 0.7) * (0.8 + 0.4 * n2);
        const R = R_APERTURE * radius * (1 + surge * 0.04);
        pa[v * 3] = x * R;
        pa[v * 3 + 1] = y * R;
        pa[v * 3 + 2] = radius > 0 ? bulge + z * (1 - r * r * 0.6) : 0;
        shadeArray[v] = shade + boost;
        v++;
      }
    }
    pos.needsUpdate = true;
    energyGeometry.attributes.aShade.needsUpdate = true;
    glowLevel = Math.max(radius, s.locked.some((l) => l >= 1) ? 0.35 : 0);
  }
  const previous = /* @__PURE__ */ new WeakMap();
  const local = new THREE3.Vector3();
  const inverse = new THREE3.Matrix4();
  function watchScene() {
    let root = group;
    while (root.parent) root = root.parent;
    if (root === group) return;
    inverse.copy(energy.matrixWorld).invert();
    const visit = (object) => {
      if (object === group) return;
      if (!object.isBone && !object.isInstancedMesh && !object.isLight && !object.isCamera && object !== root) {
        local.setFromMatrixPosition(object.matrixWorld).applyMatrix4(inverse);
        const before = previous.get(object);
        if (before !== void 0 && horizonOpen && Math.sign(before.z) !== Math.sign(local.z) && Math.abs(local.z - before.z) < 3) {
          if (Math.hypot(local.x, local.y) < R_APERTURE - 0.1) touch(local.x, local.y, local.z - before.z);
        }
        if (before) before.copy(local);
        else previous.set(object, local.clone());
      }
      for (const child of object.children) visit(child);
    };
    visit(root);
  }
  const light = createGlowLight();
  energy.material.addEventListener("dispose", () => light.release());
  const lightColor = rgb(ramp[3]);
  const lightPosition = new THREE3.Vector3();
  const lightOffset = new THREE3.Vector3(0, 0, 0.8);
  let lastTime = -1;
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    const changed = time !== lastTime;
    if (changed) {
      lastTime = time;
      update(time);
    }
    baseUpdate(force);
    if (changed) watchScene();
    if (glowLevel > 0) light.set(energy.localToWorld(lightPosition.copy(lightOffset)), lightColor, 8 * glowLevel, 1.4);
    else light.set(lightPosition.set(0, -999, 0), lightColor, 0, 0);
  };
  update(0);
  lastTime = 0;
  group.userData.walkway = walkway;
  group.userData.touch = (x, y, direction) => touch(x, y - center.y, direction);
  group.userData.asset = { id: meta.id, params: p, address: seq.address, glyphs: G, duration: seq.duration, walkway };
  return group;
}
var smooth2 = (k) => k * k * (3 - 2 * k);
function buildDisc(rings, segments) {
  const count = 1 + rings * segments;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) normals[i * 3 + 2] = 1;
  const index = [];
  for (let k = 0; k < segments; k++) index.push(0, 1 + k, 1 + (k + 1) % segments);
  for (let ring = 1; ring < rings; ring++) {
    const a = 1 + (ring - 1) * segments, b = 1 + ring * segments;
    for (let k = 0; k < segments; k++) {
      const k1 = (k + 1) % segments;
      if (ring % 2 === 1) index.push(a + k, b + k, a + k1, a + k1, b + k, b + k1);
      else index.push(a + k, b + k, b + k1, a + k, b + k1, a + k1);
    }
  }
  const geometry = new THREE3.BufferGeometry();
  geometry.setAttribute("position", new THREE3.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE3.BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}
export {
  ENERGY_EMISSIVE,
  ENERGY_STEPS,
  PORTAL_ENERGIES,
  create,
  disposeObject as dispose,
  energyRamp,
  meta,
  setWind,
  tick
};
