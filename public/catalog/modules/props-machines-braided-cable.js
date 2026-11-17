// Projet Vie 3D — Câbles tressés (props/machines/braided-cable), version 1
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).

// src/assets/props/machines/braided-cable.js
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
  uDarkness: { value: 0 },
  // Monde courbé : xy centre (x, z du monde, la caméra), z courbure (1 / 2R), w distance où la courbure commence (m).
  uCurve: { value: new THREE.Vector4(0, 0, 0, 0) }
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
var FABRICS = {
  tarredLeather: { label: "Cuir goudronn\xE9", ramp: ["#17110c", "#2b2118", "#43342a", "#5f4b3c"], ink: "#0c0806" },
  felt: { label: "Feutre noir", ramp: ["#0e0d11", "#16141a", "#1f1c24", "#2a2630"], ink: "#08070a" }
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
function ring({ radius, height = 2 * PX, y = 0, thickness = PX, segments = 16, facets = true }) {
  return buildLathe(
    [[radius, y], [radius + thickness, y], [radius + thickness, y + height], [radius, y + height]],
    { segments, facets }
  );
}
function cable(points, { radius = PX / 2, sides = 4, segments } = {}) {
  const pts = points.map(toVector);
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += pts[i].distanceTo(pts[i - 1]);
  return plain(buildTube(pts, () => radius, { radialSegments: sides, lengthSegments: segments ?? Math.max(4, Math.ceil(length / 0.25)) }));
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
function orient(geometry, position, direction) {
  const q = new THREE3.Quaternion().setFromUnitVectors(new THREE3.Vector3(0, 1, 0), toVector(direction).clone().normalize());
  geometry.applyQuaternion(q);
  const p = toVector(position);
  geometry.translate(p.x, p.y, p.z);
  return geometry;
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
function numberParam(label, defaultValue, min, max, description, { step = 0.1, unit } = {}) {
  return { type: "number", default: defaultValue, min, max, step, ...unit ? { unit } : {}, label, description };
}
function variantsOf(name, spec) {
  const values = [spec.default, ...spec.values.filter((value) => value !== spec.default)];
  return values.map((value) => ({ id: value, name: spec.labels?.[value] ?? value, params: { [name]: value } }));
}

// src/assets/props/machines/braided-cable.js
var GAUGES = {
  fine: "Fin (\xD8 6 cm)",
  study: "D'\xE9tude (\xD8 12 cm, \xE9tiquettes)",
  umbilical: "Ombilical (\xD8 18 cm, manchons de laiton)",
  main: "Principal (\xD8 25 cm, colliers de bronze)"
};
var SPEC = {
  fine: { r: 0.03, sides: 4 },
  study: { r: 0.06, sides: 5 },
  umbilical: { r: 0.09, sides: 6 },
  main: { r: 0.125, sides: 8 }
};
var LAYOUTS = { hanging: "Pendu en cha\xEEnette", floor: "Pos\xE9 au sol", bundle: "Faisceau au sol" };
var params = {
  seed: seedParam("Change le trac\xE9 (serpentin, fl\xE8che), le nombre de c\xE2bles du faisceau, la boucle de rangement, la place des \xE9tiquettes."),
  gauge: choiceParam("Calibre", GAUGES, "C\xE2ble fin du Sas, c\xE2ble d'\xE9tude, c\xE2ble ombilical de l'Oracle ou c\xE2ble principal du C\u0153ur."),
  layout: choiceParam("Trac\xE9", LAYOUTS, "Pendu entre deux points d'accroche, pos\xE9 au sol, ou faisceau de 3 \xE0 5 c\xE2bles sangl\xE9s."),
  length: numberParam("Longueur", 3, 1, 10, "Distance entre les deux bouts.", { step: 0.5, unit: "m" }),
  height: numberParam("Accroche", 2.2, 0.6, 6, "C\xE2ble pendu : hauteur des deux points d'accroche.", { step: 0.1, unit: "m" })
};
var meta = {
  id: "props/machines/braided-cable",
  name: "C\xE2bles tress\xE9s",
  nameEn: "Braided cables",
  category: "props",
  subcategory: "machines",
  description: "C\xE2bles de tissu goudronn\xE9 du Complexe, \xE0 connecteurs de bronze : fin, d'\xE9tude (\xE9tiquettes claires), ombilical (manchons de laiton) ou principal (colliers de bronze) ; pendus en cha\xEEnette, pos\xE9s au sol ou en faisceau sangl\xE9 avec une boucle de rangement. Tra\xE7ables par points de passage (createRoute). Fiches SAS-11, ETU-07, COE-14, ORA-11.",
  tags: [
    "c\xE2ble",
    "c\xE2bles",
    "faisceau",
    "gaine",
    "tissu goudronn\xE9",
    "connecteur",
    "manchon",
    "\xE9tiquette",
    "le complexe",
    "complexe",
    "ancien-tech",
    "r\xE9seau",
    "instruments",
    "int\xE9rieur",
    "cable",
    "cables",
    "cable bundle",
    "braided",
    "tarred cloth",
    "connector",
    "sleeve",
    "label",
    "ancient complex",
    "ancient-tech",
    "network",
    "wiring",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au milieu du trac\xE9 ; les bouts sont en x = \xB1longueur/2",
  footprint: { radius: 1.9, height: 2.6 },
  animated: [],
  params,
  variants: variantsOf("layout", params.layout)
};
function buildCables(paths, p, rng, { coil = false } = {}) {
  const { r, sides } = SPEC[p.gauge];
  const fabricParts = [];
  const bronzeParts = [];
  paths.forEach((points, index) => {
    let pts = points;
    if (coil && index === 0) {
      const end = pts[pts.length - 1];
      const dir = new THREE4.Vector3().subVectors(end, pts[pts.length - 2]).setY(0).normalize();
      const side = new THREE4.Vector3(-dir.z, 0, dir.x);
      const R = 0.22 + r * 2;
      const center = end.clone().addScaledVector(side, R);
      const a0 = Math.atan2(end.z - center.z, end.x - center.x);
      pts = pts.slice(0, -1);
      for (let k = 0; k <= 18; k++) {
        const a = a0 + k / 18 * Math.PI * 3;
        const rr = R * (1 - k * 0.012);
        pts.push(new THREE4.Vector3(center.x + Math.cos(a) * rr, r + (k > 10 ? r * 1.6 : 0), center.z + Math.sin(a) * rr));
      }
    }
    const curve = new THREE4.CatmullRomCurve3(pts, false, "centripetal");
    const length = curve.getLength();
    const samples = Math.max(8, Math.ceil(length / 0.12));
    const along = curve.getSpacedPoints(samples);
    fabricParts.push(withTone(cable(along, { radius: r, sides, segments: samples }), (x, y, z, nx, ny) => ny < -0.2 ? -0.08 : 0));
    const ends = coil && index === 0 ? [0] : [0, 1];
    for (const t of ends) {
      const at = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).multiplyScalar(t === 0 ? -1 : 1);
      const L = Math.max(0.1, r * 2.5);
      const body = buildBlock([r * 2 + PX, L, r * 2 + PX], [0, L / 2, 0]);
      bronzeParts.push(orient(body, at, tangent));
      const pin = buildBlock([r, PX * 2, r], [0, L + PX, 0]);
      bronzeParts.push(withTone(orient(pin, at, tangent), -0.2));
      bronzeParts.push(withTone(orient(ring({ radius: r, height: PX * 1.2, y: -PX, thickness: PX * 0.7, segments: Math.max(6, sides) }), at, tangent), 0.15));
    }
    const every = p.gauge === "umbilical" ? 0.8 : p.gauge === "main" ? 0.6 : p.gauge === "study" ? 1.1 : 0;
    if (every > 0) {
      const offset = rng.range(0.2, every);
      for (let s = offset; s < length - 0.25; s += every) {
        const t = s / length;
        const at = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        if (p.gauge === "study") {
          const label = buildBlock([PX * 1.6, PX * 2, PX * 0.6], [0, 0, r + PX * 0.3]);
          label.applyMatrix4(new THREE4.Matrix4().lookAt(new THREE4.Vector3(), tangent, new THREE4.Vector3(0, 1, 0)));
          label.translate(at.x, at.y + r * 0.4, at.z);
          bronzeParts.push(withTone(label, 0.7));
        } else {
          const brass = p.gauge === "umbilical";
          const g = ring({ radius: r, height: brass ? 0.1 : PX * 2, y: brass ? -0.05 : -PX, thickness: brass ? PX * 0.9 : PX * 0.8, segments: Math.max(6, sides) });
          bronzeParts.push(withTone(orient(g, at, tangent), brass ? 0.3 : 0));
        }
      }
    }
  });
  return { fabricParts, bronzeParts };
}
function assemble(fabricParts, bronzeParts, p) {
  const group = new THREE4.Group();
  group.name = meta.name;
  const fabric = new THREE4.Mesh(
    mergeToned(fabricParts),
    createToonMaterial({ ramp: FABRICS.tarredLeather.ramp, ink: FABRICS.tarredLeather.ink, steps: [0.3, 0.55, 0.8], pattern: "speckle", patternParams: [16, 0.06, 0.18, 0.5], tone: true, id: 30 })
  );
  fabric.name = "cables";
  fabric.castShadow = true;
  fabric.receiveShadow = true;
  group.add(fabric);
  if (bronzeParts.length) {
    const bronze = new THREE4.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 31, tone: true }));
    bronze.name = "fittings";
    bronze.castShadow = true;
    group.add(bronze);
  }
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
function createRoute(points, given = {}) {
  const p = resolveParams(meta.params, given);
  const pts = points.map((v) => v.isVector3 ? v.clone() : new THREE4.Vector3(...v));
  const { fabricParts, bronzeParts } = buildCables([pts], p, createRng(p.seed * 104729 + 71));
  return assemble(fabricParts, bronzeParts, p);
}
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const fittings = createRng(p.seed * 104729 + 71);
  const { r } = SPEC[p.gauge];
  const L = p.length;
  const paths = [];
  let coil = false;
  let straps = [];
  if (p.layout === "hanging") {
    const sag = L * shape.range(0.12, 0.22);
    const lean = shape.range(-0.15, 0.15);
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push(new THREE4.Vector3(-L / 2 + L * t, p.height + lean * (t - 0.5) - 4 * sag * t * (1 - t), 0));
    }
    paths.push(pts);
  } else {
    const a1 = shape.range(0.12, 0.3), f1 = shape.range(0.6, 1.4), ph1 = shape.range(0, 6.28);
    const a2 = shape.range(0.03, 0.1), f2 = shape.range(2, 3.5), ph2 = shape.range(0, 6.28);
    const wave = (x) => a1 * Math.sin(x * f1 + ph1) + a2 * Math.sin(x * f2 + ph2);
    const count = p.layout === "bundle" ? shape.int(3, 5) : 1;
    const gap = r * 2 + PX * 0.5;
    const steps = Math.max(8, Math.ceil(L / 0.25));
    for (let c = 0; c < count; c++) {
      const offset = (c - (count - 1) / 2) * gap;
      const jitter = shape.range(-1, 1) * 0.04;
      const pts = [];
      for (let k = 0; k <= steps; k++) {
        const x = -L / 2 + L * k / steps;
        const lift = c % 2 && count > 3 ? r * 0.8 : 0;
        pts.push(new THREE4.Vector3(x, r + lift, wave(x) + offset + jitter * Math.sin(x * 3 + c)));
      }
      paths.push(pts);
    }
    if (p.layout === "bundle") {
      coil = shape.chance(0.75);
      straps = [];
      for (let s = -L / 2 + 0.5; s < L / 2 - 0.4; s += 0.8) straps.push(s);
      const width = count * gap + PX;
      for (const x of straps) {
        const z = wave(x);
        const slope = Math.atan2(wave(x + 0.05) - wave(x - 0.05), 0.1);
        const band = buildBlock([PX * 1.5, r * 2 + PX * 1.5 + (count > 3 ? r * 0.8 : 0), width], [0, 0, 0]);
        band.rotateY(-slope);
        band.translate(x, r + (count > 3 ? r * 0.4 : 0), z);
        paths.straps = paths.straps ?? [];
        paths.straps.push(band);
      }
    }
  }
  const { fabricParts, bronzeParts } = buildCables(paths, p, fittings, { coil });
  for (const band of paths.straps ?? []) fabricParts.push(withTone(band, 0.12));
  return assemble(fabricParts, bronzeParts, p);
}
export {
  create,
  createRoute,
  disposeObject as dispose,
  meta,
  setWind,
  tick
};
