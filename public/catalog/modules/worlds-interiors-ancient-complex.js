// Projet Vie 3D — Le Complexe (worlds/interiors/ancient-complex), version 3
// Module autonome : seule dépendance, three@0.186.0 (import "three" et, pour les assets importés, "three/addons/...").
// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/worlds/ancient-complex.js
import * as THREE41 from "three";

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
function enableCutaway(material, rule, height) {
  material.defines.CUTAWAY = "";
  material.uniforms.uCut = { value: new THREE.Vector2({ wall: 1, view: 2, corner: 3 }[rule] ?? 1, height) };
  material.needsUpdate = true;
  const depth = material.userData.depthMaterial;
  if (depth) {
    depth.defines.CUTAWAY = "";
    depth.uniforms.uCut = material.uniforms.uCut;
    depth.needsUpdate = true;
  } else {
    material.userData.depthMaterial = new THREE.ShaderMaterial({
      name: "ToonCutDepth",
      defines: { CUTAWAY: "", DEPTH_ONLY: "" },
      side: material.side,
      uniforms: { ...sharedUniforms, uSway: material.uniforms.uSway, uTwinkle: material.uniforms.uTwinkle, uCut: material.uniforms.uCut },
      vertexShader: VERTEX,
      fragmentShader: DEPTH_FRAGMENT
    });
  }
  return material;
}
function enableReveal(material, uniform, off) {
  material.defines.REVEAL = "";
  material.uniforms.uReveal = uniform;
  material.uniforms.uRevealOff = { value: rgb(off) };
  material.needsUpdate = true;
  return material;
}
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
var GLASSES = {
  amber: { label: "Verre ambre", ramp: ["#4a2410", "#8a4a1c", "#c97a2e", "#f2b764"], ink: "#2a1408" },
  cyan: { label: "Verre cyan", ramp: ["#0e2f38", "#1d6672", "#3fa9b8", "#a6e6ee"], ink: "#071a20" },
  smoky: { label: "Verre fum\xE9", ramp: ["#1a2026", "#2b363e", "#4a5a64", "#8fa3ac"], ink: "#0d1115" },
  // Verre clair un peu jauni par l'âge : lentilles des loupes, caissons des vitrines.
  clear: { label: "Verre clair jauni", ramp: ["#4f5650", "#7f8a78", "#b9bd98", "#ece6c4"], ink: "#262a26" }
};
var FABRICS = {
  tarredLeather: { label: "Cuir goudronn\xE9", ramp: ["#17110c", "#2b2118", "#43342a", "#5f4b3c"], ink: "#0c0806" },
  felt: { label: "Feutre noir", ramp: ["#0e0d11", "#16141a", "#1f1c24", "#2a2630"], ink: "#08070a" }
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

// src/assets/buildings/structure/bronze-railing.js
var bronze_railing_exports = {};
__export(bronze_railing_exports, {
  create: () => create,
  dispose: () => disposeObject,
  meta: () => meta,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE4 from "three";

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
  const N = new THREE2.Vector3(), U = new THREE2.Vector3(), R2 = new THREE2.Vector3();
  quads.forEach((q, i) => {
    N.set(...q.normal ?? [0, 0, 1]).normalize();
    U.set(0, 1, 0);
    if (Math.abs(N.y) > 0.9) U.set(0, 0, -Math.sign(N.y));
    R2.crossVectors(U, N).normalize();
    U.crossVectors(N, R2);
    const [w, h] = q.size;
    const [cx, cy, cz] = q.position;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], k) => {
      const o = (i * 4 + k) * 3;
      position[o] = cx + R2.x * a * w / 2 + U.x * b * h / 2;
      position[o + 1] = cy + R2.y * a * w / 2 + U.y * b * h / 2;
      position[o + 2] = cz + R2.z * a * w / 2 + U.z * b * h / 2;
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
function buildRibbon(points, normals, width) {
  const n = points.length;
  const position = new Float32Array(n * 6);
  const normal = new Float32Array(n * 6);
  const index = [];
  const T2 = new THREE2.Vector3(), S = new THREE2.Vector3();
  for (let i = 0; i < n; i++) {
    T2.subVectors(points[Math.min(n - 1, i + 1)], points[Math.max(0, i - 1)]);
    S.crossVectors(normals[i], T2).normalize().multiplyScalar(width / 2);
    for (const [k, s] of [[0, -1], [1, 1]]) {
      const o = (i * 2 + k) * 3;
      position[o] = points[i].x + S.x * s;
      position[o + 1] = points[i].y + S.y * s;
      position[o + 2] = points[i].z + S.z * s;
      normal[o] = normals[i].x;
      normal[o + 1] = normals[i].y;
      normal[o + 2] = normals[i].z;
    }
    if (i < n - 1) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE2.BufferAttribute(normal, 3));
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
  const ring2 = [];
  for (let i = 0; i < sides; i++) {
    const a2 = spin + i / sides * Math.PI * 2;
    ring2.push(new THREE2.Vector3(Math.cos(a2) * radius, 0, Math.sin(a2) * radius));
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
    const p = ring2[i], q = ring2[(i + 1) % sides];
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
function buildPrism(outline, bottom, top) {
  const area = outline.reduce((sum, [x, z], i) => {
    const [x2, z2] = outline[(i + 1) % outline.length];
    return sum + x * z2 - x2 * z;
  }, 0);
  if (area < 0) outline = outline.slice().reverse();
  const positions = [];
  const normals = [];
  const index = [];
  const n = outline.length;
  const face = (points) => {
    const first = positions.length / 3;
    const a = new THREE2.Vector3().subVectors(points[1], points[0]);
    const b = new THREE2.Vector3().subVectors(points[2], points[0]);
    const normal = new THREE2.Vector3().crossVectors(a, b).normalize();
    for (const point of points) positions.push(point.x, point.y, point.z), normals.push(normal.x, normal.y, normal.z);
    for (let k = 1; k < points.length - 1; k++) index.push(first, first + k, first + k + 1);
  };
  const up = outline.map(([x, z]) => new THREE2.Vector3(x, top(x, z), z));
  const down = outline.map(([x, z]) => new THREE2.Vector3(x, bottom, z));
  face(up.slice().reverse());
  face(down);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face([down[i], down[j], up[j], up[i]].reverse());
  }
  const geometry = new THREE2.BufferGeometry();
  geometry.setAttribute("position", new THREE2.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new THREE2.BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(index);
  return geometry;
}

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
function withShade(geometry, index, count = 2) {
  const array = new Float32Array(geometry.attributes.position.count).fill((index + 0.5) / count);
  geometry.setAttribute("aShade", new THREE3.BufferAttribute(array, 1));
  return geometry;
}
function bendAroundY(geometry, radius, { concave = true } = {}) {
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const theta = p.getX(i) / radius;
    const c = Math.cos(theta), s = Math.sin(theta);
    const r = concave ? radius - p.getZ(i) : radius + p.getZ(i);
    if (concave) p.setXYZ(i, s * r, p.getY(i), radius - c * r);
    else p.setXYZ(i, s * r, p.getY(i), c * r);
    if (n) {
      const nx = n.getX(i), nz = n.getZ(i);
      n.setXYZ(i, nx * c + nz * s, n.getY(i), -nx * s + nz * c);
    }
  }
  p.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}
function fluteShaft({ radius, flutes = 16, depth = PX, y0 = 0, y1 = 1, arc = null }) {
  const outline = [];
  const full = !arc;
  const [a0, a1] = arc ?? [0, Math.PI * 2];
  const count = full ? flutes * 2 : Math.max(2, Math.round(flutes * 2 * (a1 - a0) / (Math.PI * 2)));
  for (let i = 0; i < count + (full ? 0 : 1); i++) {
    const a = a0 + (a1 - a0) * i / count;
    const r = i % 2 ? radius - depth : radius;
    outline.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  const positions = [];
  const normals = [];
  const index = [];
  const quad = (a, b, c, d, nx, ny, nz) => {
    const first = positions.length / 3;
    for (const v of [a, b, c, d]) positions.push(...v), normals.push(nx, ny, nz);
    index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
  const m = outline.length;
  const edges = full ? m : m - 1;
  for (let i = 0; i < edges; i++) {
    const [x1, z1] = outline[i];
    const [x2, z2] = outline[(i + 1) % m];
    const len = Math.hypot(x2 - x1, z2 - z1) || 1;
    const nx = -(z2 - z1) / len, nz = (x2 - x1) / len;
    quad([x1, y0, z1], [x2, y0, z2], [x2, y1, z2], [x1, y1, z1], nx, 0, nz);
  }
  if (!full) {
    const [xa, za] = outline[m - 1];
    const [xb, zb] = outline[0];
    const len = Math.hypot(xb - xa, zb - za) || 1;
    quad([xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], -(zb - za) / len, 0, (xb - xa) / len);
  }
  for (const [y, ny] of [[y1, 1], [y0, -1]]) {
    const center = positions.length / 3;
    positions.push(0, y, full ? 0 : (outline[0][1] + outline[m - 1][1]) / 2), normals.push(0, ny, 0);
    for (const [x, z] of outline) positions.push(x, y, z), normals.push(0, ny, 0);
    for (let i = 0; i < (full ? m : m - 1); i++) {
      const a = center + 1 + i, b = center + 1 + (i + 1) % m;
      if (ny > 0) index.push(center, a, b);
      else index.push(center, b, a);
    }
  }
  const geometry = new THREE3.BufferGeometry();
  geometry.setAttribute("position", new THREE3.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new THREE3.BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(index);
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
    const r = (typeof name === "object" ? name : GLOWS[name] ?? GLOWS.amber).ramp;
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
function openBar(a, b, w, h = w) {
  const geometry = beam(a, b, w, h);
  geometry.setIndex(Array.from(geometry.index.array.slice(0, 18)));
  return geometry;
}
function arcBlock({ r0, r1, a0, a1, z0, z1, segments = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 12))) }) {
  const parts = [];
  for (let s = 0; s < segments; s++) {
    const b0 = a0 + (a1 - a0) * s / segments, b1 = a0 + (a1 - a0) * (s + 1) / segments;
    const pts = [[r0, b0], [r1, b0], [r1, b1], [r0, b1]].map(([r, a]) => [Math.cos(a) * r, -Math.sin(a) * r]);
    const g = buildPrism(pts, z0, () => z1);
    g.rotateX(Math.PI / 2);
    parts.push(g);
  }
  return mergeGeometries(parts);
}
function slantPlate(outline, back, front) {
  const g = buildPrism(outline.map(([x, y]) => [x, -y]), back, (x, z) => front(x, -z));
  g.rotateX(Math.PI / 2);
  return g;
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
function squareRing({ size, height = 2 * PX, y = 0, thickness = PX }) {
  const s = size / 2 + thickness / 2;
  const L2 = size + thickness * 2;
  return mergeGeometries([
    buildBlock([L2, height, thickness], [0, y + height / 2, s]),
    buildBlock([L2, height, thickness], [0, y + height / 2, -s]),
    buildBlock([thickness, height, size], [s, y + height / 2, 0]),
    buildBlock([thickness, height, size], [-s, y + height / 2, 0])
  ]);
}
function bulb({ radius = PX, position = [0, 0, 0], segments = 6 } = {}) {
  const geometry = plain(new THREE3.SphereGeometry(radius, segments, Math.max(3, segments - 2)));
  const p = toVector(position);
  geometry.translate(p.x, p.y, p.z);
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
function lever({ length = 4 * PX, angle = 0, position = [0, 0, 0], normal = [0, 0, 1], width = PX * 0.7 } = {}) {
  const m = faceMatrix(position, normal);
  const tip = new THREE3.Vector3(0, Math.cos(angle) * length, Math.sin(angle) * length + PX * 0.5);
  const rod = mergeGeometries([
    buildBlock([PX * 1.6, PX * 1.2, PX * 0.8], [0, 0, PX * 0.4]),
    beam([0, 0, PX * 0.5], tip, width, width)
  ]);
  rod.applyMatrix4(m);
  const knob = bulb({ radius: PX * 0.9, position: tip, segments: 6 });
  knob.applyMatrix4(m);
  return { rod, knob };
}
function chain(from, to, { sag = 0.1, link = 0.07, width = PX * 0.8 } = {}) {
  from = toVector(from);
  to = toVector(to);
  const count = Math.max(2, Math.round(from.distanceTo(to) / link));
  const at = (t) => new THREE3.Vector3().lerpVectors(from, to, t).add(new THREE3.Vector3(0, -4 * sag * t * (1 - t), 0));
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = at(i / count), b = at((i + 1) / count);
    parts.push(beam(a, b, width, width * 0.5, i % 2 ? Math.PI / 4 : -Math.PI / 4));
  }
  return mergeGeometries(parts);
}
function cable(points, { radius = PX / 2, sides = 4, segments } = {}) {
  const pts = points.map(toVector);
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += pts[i].distanceTo(pts[i - 1]);
  return plain(buildTube(pts, () => radius, { radialSegments: sides, lengthSegments: segments ?? Math.max(4, Math.ceil(length / 0.25)) }));
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
function orient(geometry, position, direction) {
  const q = new THREE3.Quaternion().setFromUnitVectors(new THREE3.Vector3(0, 1, 0), toVector(direction).clone().normalize());
  geometry.applyQuaternion(q);
  const p = toVector(position);
  geometry.translate(p.x, p.y, p.z);
  return geometry;
}
var hash2 = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function createFlicker(geometry, bulbs) {
  const shade = geometry.attributes.aShade;
  const current = bulbs.map(() => -1);
  const update = (time) => {
    let changed = false;
    bulbs.forEach((b, i) => {
      let level = b.base;
      if (b.base > 0) {
        const r = hash2(Math.floor(time * 4 + b.phase * 13), b.phase * 91 + i);
        if (r < 0.07) level = b.base - 1;
        else if (r > 0.86) level = Math.min(3, b.base + 1);
      }
      if (level === current[i]) return;
      current[i] = level;
      changed = true;
      shade.array.fill((level + 0.5) / 4, b.start, b.start + b.count);
    });
    if (changed) shade.needsUpdate = true;
    return changed;
  };
  update(0);
  return update;
}
function glowLevels(name) {
  return [0, 1, 2, 3].map((level) => [name, level]);
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
function glowParam(description, { only, defaultValue } = {}) {
  return choiceParam("Lueur", pick(GLOWS, only), description, defaultValue);
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

// src/assets/buildings/structure/bronze-railing.js
var KINDS = {
  chain: "Balisage (poteaux et cha\xEEne)",
  rail: "Garde-corps (lisse et cha\xEEne lourde)",
  barrier: "Barri\xE8re (bandes ambre)"
};
var LAYOUTS = { line: "En ligne", circle: "En cercle" };
var OPENINGS = { closed: "Ferm\xE9", open: "Un passage ouvert (face \xE0 +z)" };
var HEIGHTS = { chain: 0.9, rail: 1, barrier: 1 };
var AMBER_PAINT = { ramp: ["#4a2412", "#8a4a1c", "#c8782c", "#eaa850"], ink: "#24120a" };
var params = {
  seed: seedParam("Change l'affaissement des cha\xEEnes, le poteau pench\xE9, l'usure des bandes et des lisses, les tons du bronze."),
  kind: choiceParam("Sorte", KINDS, "Balisage (poteaux de 0,9 m et cha\xEEne pendante), garde-corps de fosse (lisse de laiton et cha\xEEne lourde), ou barri\xE8re \xE0 bandes ambre."),
  layout: choiceParam("Trac\xE9", LAYOUTS, "En ligne droite (centr\xE9e sur l'origine, le long de x), ou en cercle autour de l'origine."),
  segments: { type: "int", default: 3, min: 1, max: 16, label: "Segments", description: "Nombre d'intervalles entre deux poteaux (en cercle : tout le tour, passage compris)." },
  span: numberParam("\xC9cart des poteaux", 2, 0.8, 2.5, "En ligne : la distance entre deux poteaux.", { step: 0.05, unit: "m" }),
  radius: numberParam("Rayon", 3.2, 1, 8, "En cercle : le rayon du cercle des poteaux (3,2 m autour de la fosse du C\u0153ur, 2,75 m pour un p\xE9rim\xE8tre d'\xE9tude).", { step: 0.05, unit: "m" }),
  opening: choiceParam("Passage", OPENINGS, "En cercle : tout ferm\xE9, ou un intervalle laiss\xE9 ouvert face \xE0 +z.")
};
var meta = {
  id: "buildings/structure/bronze-railing",
  name: "Rambarde de bronze",
  nameEn: "Bronze railing",
  category: "buildings",
  subcategory: "structure",
  description: "Poteaux de bronze du Complexe reli\xE9s en ligne ou en cercle : balisage \xE0 cha\xEEne pendante sur disques, garde-corps de fosse \xE0 lisse de laiton et cha\xEEne lourde, barri\xE8re \xE0 bandes ambre us\xE9es. Passage ouvert possible ; segments bloquants fournis au monde. Fiches SAS-15, ETU-15, COE-03, COE-15.",
  tags: [
    "rambarde",
    "balisage",
    "poteau",
    "cha\xEEne",
    "garde-corps",
    "barri\xE8re",
    "lisse",
    "p\xE9rim\xE8tre",
    "bronze",
    "bandes ambre",
    "le complexe",
    "complexe",
    "ancien-tech",
    "modulaire",
    "obstacle",
    "int\xE9rieur",
    "railing",
    "stanchion",
    "post",
    "chain",
    "guard rail",
    "barrier",
    "handrail",
    "perimeter",
    "brass",
    "amber stripes",
    "ancient complex",
    "ancient-tech",
    "modular",
    "barricade",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au milieu de la ligne ou au centre du cercle",
  footprint: { radius: 3.1, height: 1 },
  animated: [],
  params,
  variants: variantsOf("kind", params.kind)
};
function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 61);
  const H = HEIGHTS[p.kind];
  const bronze = [];
  const brass = [];
  const paint = [];
  const posts = [];
  const links = [];
  if (p.layout === "circle") {
    const n = Math.max(3, p.segments);
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + Math.PI / n + i * Math.PI * 2 / n;
      posts.push(new THREE4.Vector3(Math.cos(a) * p.radius, 0, Math.sin(a) * p.radius));
    }
    for (let i = 0; i < n; i++) if (!(p.opening === "open" && i === n - 1)) links.push([i, (i + 1) % n]);
  } else {
    const length = p.segments * p.span;
    for (let i = 0; i <= p.segments; i++) posts.push(new THREE4.Vector3(-length / 2 + i * p.span, 0, 0));
    for (let i = 0; i < p.segments; i++) links.push([i, i + 1]);
  }
  const leaning = rng.chance(0.6) ? rng.int(0, posts.length - 1) : -1;
  const tops = posts.map((base, i) => {
    const top = base.clone().setY(H);
    if (i === leaning) {
      const lean = rng.range(0.04, 0.08);
      const a = rng.range(0, Math.PI * 2);
      top.x += Math.cos(a) * lean;
      top.z += Math.sin(a) * lean;
    }
    return top;
  });
  const at = (i, y) => posts[i].clone().lerp(tops[i], y / H);
  posts.forEach((base, i) => {
    const top = tops[i];
    const tone = rng.range(-0.06, 0.06);
    if (p.kind === "chain") {
      const disc = buildLathe([[0, 0], [0.125, 0], [0.12, 0.025], [0.05, 0.05], [0, 0.05]], { segments: 10, facets: true });
      disc.translate(base.x, 0, base.z);
      bronze.push(withTone(disc, tone - 0.05));
      bronze.push(withTone(beam(base.clone().setY(0.04), top, PX * 1.1, PX * 1.1), tone));
      const knob = buildLathe([[0, 0], [0.04, 0], [0.05, 0.035], [0.03, 0.07], [0, 0.075]], { segments: 6, facets: true });
      knob.translate(top.x, top.y - 0.01, top.z);
      brass.push(withTone(knob, 0.15));
      const ringAt = at(i, H - 0.08);
      brass.push(withTone(buildBlock([PX * 1.6, PX * 0.8, PX * 1.6], [ringAt.x, ringAt.y, ringAt.z]), 0.05));
    } else {
      const w = p.kind === "rail" ? PX * 1.2 : PX * 1.4;
      const foot = p.kind === "rail" ? [0.16, 0.02, 0.16] : [0.22, 0.05, 0.22];
      brass.push(withTone(buildBlock(foot, [base.x, foot[1] / 2, base.z], [0, rng.range(0, 0.3), 0]), -0.15));
      bronze.push(withTone(beam(base.clone().setY(foot[1]), top, w, w), tone));
      bronze.push(withTone(buildBlock([w + 0.03, 0.03, w + 0.03], [top.x, top.y + 0.01, top.z]), tone + 0.12));
      const collar = at(i, 0.25);
      bronze.push(withTone(buildBlock([w + 0.02, PX, w + 0.02], [collar.x, collar.y, collar.z]), tone + 0.05));
    }
  });
  for (const [i, j] of links) {
    const a = tops[i], b = tops[j];
    const length = a.distanceTo(b);
    if (p.kind === "chain") {
      const sag = length * rng.range(0.07, 0.13);
      bronze.push(withTone(chain(at(i, H - 0.08), at(j, H - 0.08), { sag, link: 0.075, width: PX * 0.85 }), 0.12));
    } else if (p.kind === "rail") {
      const lisse = beam(a.clone().setY(a.y + 0.04), b.clone().setY(b.y + 0.04), PX * 1.4, PX, 0);
      brass.push(withTone(lisse, (x, y, z, nx, ny) => (ny > 0.5 ? 0.18 : 0) + rng.range(-0.03, 0.03)));
      const sag = 0.06 + length * rng.range(0.03, 0.06);
      bronze.push(withTone(chain(at(i, 0.58), at(j, 0.58), { sag, link: 0.1, width: PX * 1.15 }), 0.05));
    } else {
      const y0 = H - 0.1;
      const da = at(i, y0), db = at(j, y0);
      const dir = db.clone().sub(da);
      const len = dir.length();
      dir.normalize();
      bronze.push(withTone(beam(da, db, 0.035, 0.15), -0.3));
      const bands = Math.max(2, Math.round(len / 0.12));
      for (let k = 0; k < bands; k += 2) {
        if (rng.chance(0.12)) continue;
        const worn = rng.chance(0.25) ? rng.range(0.55, 0.85) : 1;
        const c = da.clone().addScaledVector(dir, (k + 0.5) / bands * len);
        const band = beam(c.clone().addScaledVector(dir, -len / bands / 2), c.clone().addScaledVector(dir, len / bands / 2), 0.042, 0.15 * worn);
        band.translate(0, -0.075 * (1 - worn), 0);
        paint.push(withTone(band, rng.range(-0.08, 0.06)));
      }
      bronze.push(withTone(beam(at(i, 0.42), at(j, 0.42), PX, PX * 1.2), 0));
    }
  }
  const group = new THREE4.Group();
  group.name = meta.name;
  const add = (parts, material, name) => {
    if (!parts.length) return;
    const mesh = new THREE4.Mesh(mergeToned(parts), material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(bronze, metalMaterial(METALS.patinatedBronze, { id: 21, tone: true }), "bronze");
  add(brass, metalMaterial(METALS.blackenedBrass, { id: 22, tone: true }), "brass");
  add(paint, createToonMaterial({ ramp: AMBER_PAINT.ramp, ink: AMBER_PAINT.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, id: 23 }), "paint");
  group.userData.blocking = links.map(([i, j]) => [posts[i].x, posts[i].z, posts[j].x, posts[j].z]);
  group.userData.posts = posts.map((v) => [v.x, v.z]);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

// src/assets/buildings/structure/coffered-vault.js
var coffered_vault_exports = {};
__export(coffered_vault_exports, {
  create: () => create2,
  dispose: () => disposeObject,
  meta: () => meta2,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE5 from "three";
var SIZE = 2;
var HEIGHT = 0.6;
var DEPTH = 0.4;
var DISPLAYS = { inspect: "Retourn\xE9e (pour la regarder)", ceiling: "Au plafond" };
var HOOKS = { hook: "Avec crochet de lampe", none: "Sans crochet" };
var params2 = {
  seed: seedParam("Change les tons de chaque caisson, les plots manquants ou d\xE9cal\xE9s, les \xE9caillures des nervures."),
  display: choiceParam("Pose", DISPLAYS, "Au plafond (caissons vers le bas, origine sous les nervures) ou retourn\xE9e au sol, pour la regarder."),
  hook: choiceParam("Crochet", HOOKS, "Un crochet de bronze au croisement des nervures, o\xF9 pend une lampe \xE0 filament."),
  stone: stoneParam("Pierre de la vo\xFBte.", { only: ["smoked", "blackBasalt"] })
};
var meta2 = {
  id: "buildings/structure/coffered-vault",
  name: "Vo\xFBte \xE0 caissons",
  nameEn: "Coffered vault",
  category: "buildings",
  subcategory: "structure",
  description: "Module de plafond du Complexe de 2 \xD7 2 m : quatre caissons de 0,4 m \xE0 ressaut, un plot de bronze au fond de chacun, un crochet de lampe au croisement des nervures ; suie au fond des caissons. Au plafond ou retourn\xE9e pour la regarder. Fiche SAS-04.",
  tags: [
    "vo\xFBte",
    "plafond",
    "caissons",
    "nervures",
    "crochet",
    "bronze",
    "pierre fum\xE9e",
    "le complexe",
    "complexe",
    "ancien-tech",
    "modulaire",
    "grille de 2 m",
    "int\xE9rieur",
    "vault",
    "ceiling",
    "coffers",
    "coffered ceiling",
    "ribs",
    "lamp hook",
    "smoked stone",
    "ancient complex",
    "ancient-tech",
    "modular",
    "2 m grid",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; au plafond : origine sous les nervures, au centre, le module monte de 0,6 m (le monde le pose \xE0 la hauteur du plafond) ; retourn\xE9e : origine au sol",
  footprint: { radius: 1.42, height: 0.78 },
  animated: [],
  params: params2,
  variants: variantsOf("display", params2.display)
};
function create2(given = {}) {
  const p = resolveParams(meta2.params, given);
  const stone = STONES[p.stone];
  const shape = createRng(p.seed * 7919 + 17);
  const half = (SIZE - PX) / 2;
  const rib = 0.1;
  const cell = (SIZE - PX - rib * 4) / 2;
  const sootIn = (y) => -0.28 * THREE5.MathUtils.smoothstep(y, 0.05, DEPTH);
  const stoneParts = [];
  const add = (g, tone = 0) => stoneParts.push(withTone(g, (x, y) => tone + sootIn(y)));
  add(buildBlock([half * 2, HEIGHT - DEPTH, half * 2], [0, DEPTH + (HEIGHT - DEPTH) / 2, 0]));
  add(buildBlock([half * 2, DEPTH, rib], [0, DEPTH / 2, -half + rib / 2]));
  add(buildBlock([half * 2, DEPTH, rib], [0, DEPTH / 2, half - rib / 2]));
  add(buildBlock([rib, DEPTH, half * 2 - rib * 2], [-half + rib / 2, DEPTH / 2, 0]));
  add(buildBlock([rib, DEPTH, half * 2 - rib * 2], [half - rib / 2, DEPTH / 2, 0]));
  add(buildBlock([rib * 2, DEPTH, half * 2 - rib * 2], [0, DEPTH / 2, 0]));
  add(buildBlock([cell, DEPTH, rib * 2], [-(rib + cell / 2), DEPTH / 2, 0]));
  add(buildBlock([cell, DEPTH, rib * 2], [rib + cell / 2, DEPTH / 2, 0]));
  const bronzeParts = [];
  const step = 0.07;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * (rib + cell / 2), cz = sz * (rib + cell / 2);
      const tone = shape.range(-0.08, 0.06);
      const y0 = DEPTH * 0.55;
      const inner = cell - step * 2;
      add(buildBlock([cell, DEPTH - y0, step], [cx, (y0 + DEPTH) / 2, cz - cell / 2 + step / 2]), tone);
      add(buildBlock([cell, DEPTH - y0, step], [cx, (y0 + DEPTH) / 2, cz + cell / 2 - step / 2]), tone);
      add(buildBlock([step, DEPTH - y0, inner], [cx - cell / 2 + step / 2, (y0 + DEPTH) / 2, cz]), tone);
      add(buildBlock([step, DEPTH - y0, inner], [cx + cell / 2 - step / 2, (y0 + DEPTH) / 2, cz]), tone);
      if (shape.chance(0.85)) {
        const ox = shape.chance(0.2) ? shape.range(-0.06, 0.06) : 0;
        const boss = buildLathe([[0, DEPTH - 0.09], [0.05, DEPTH - 0.07], [0.08, DEPTH - 0.02], [0.08, DEPTH], [0, DEPTH]], { segments: 8, facets: true });
        boss.translate(cx + ox, 0, cz);
        bronzeParts.push(boss);
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const along = shape.range(-half + 0.15, half - 0.15);
    const onX = shape.chance(0.5);
    const x = onX ? along : shape.pick([-half + rib / 2, 0, half - rib / 2]);
    const z = onX ? shape.pick([-half + rib / 2, 0, half - rib / 2]) : along;
    stoneParts.push(withTone(buildBlock([PX * shape.int(1, 3), PX * 0.6, PX * shape.int(1, 2)], [x, -PX * 0.25, z]), 0.3));
  }
  if (p.hook === "hook") {
    bronzeParts.push(buildBlock([0.16, PX * 0.8, 0.16], [0, -PX * 0.4, 0]));
    bronzeParts.push(buildBlock([PX, 0.06, PX], [0, -0.03 - PX * 0.8, 0]));
    const loop = ring({ radius: 0.035, height: PX * 0.8, thickness: PX * 0.8, segments: 8 });
    loop.rotateX(Math.PI / 2);
    loop.translate(0, -0.12, 0);
    bronzeParts.push(loop);
  }
  const group = new THREE5.Group();
  group.name = meta2.name;
  const body = new THREE5.Group();
  group.add(body);
  const stoneMesh = new THREE5.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: shape.int(0, 96), id: 20, grain: 0.06 }));
  stoneMesh.name = "vault";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  body.add(stoneMesh);
  const bronze = new THREE5.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 21 }));
  bronze.name = "bronze";
  bronze.castShadow = true;
  body.add(bronze);
  if (p.display === "inspect") {
    body.rotation.x = Math.PI;
    body.position.y = HEIGHT;
  }
  group.userData.asset = { id: meta2.id, params: p };
  group.userData.hookPoint = new THREE5.Vector3(0, -0.15, 0);
  return group;
}

// src/assets/buildings/structure/complex-door.js
import * as THREE6 from "three";
var DEPTH2 = 0.6;
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
var params3 = {
  seed: seedParam("Change l'appareil du mur, les glyphes du chambranle, les tons des panneaux, la gravure de la porte de liaison."),
  model: choiceParam("Mod\xE8le", MODELS, "Standard (1,4 \xD7 2,8 m), d'\xE9tude (hublot, plaque, voyant), grande porte double ou de liaison (3 \xD7 5 m), issue de secours."),
  state: choiceParam("\xC9tat", STATES, "Ferm\xE9e, ouverte, ou qui s'ouvre et se ferme en boucle (pour la regarder). Pilotable : group.userData.door."),
  number: { type: "int", default: 1, min: 1, max: 5, label: "Num\xE9ro", description: "Porte d'\xE9tude : le num\xE9ro de la salle, en traits sur la plaque (1 \xE0 5)." },
  light: choiceParam("Voyant", { auto: "Selon le mod\xE8le", amber: "Ambre", alarm: "Rouge d'alerte", cyan: "Cyan" }, "Couleur du voyant (portes d'\xE9tude, de liaison, de secours) ; \xAB selon le mod\xE8le \xBB : rouge pour l'issue de secours, ambre sinon."),
  glyphs: choiceParam("Glyphes", GLYPHS, "La ligne de glyphes du chambranle et du bandeau : allum\xE9e, en veille ou \xE9teinte."),
  height: numberParam("Hauteur du mur", 5, 4, 8, "Hauteur du module de mur autour de la porte (au moins 5,7 m pour une grande porte).", { step: 0.5, unit: "m" }),
  stone: stoneParam("Pierre du mur et du chambranle.", { only: ["blackBasalt", "smoked"] })
};
var meta3 = {
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
  params: params3,
  variants: variantsOf("model", params3.model)
};
function create3(given = {}) {
  const p = resolveParams(meta3.params, given);
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
  const front = DEPTH2 / 2;
  const big = spec.leaves === 2;
  const level = LEVELS[p.glyphs];
  const masonry = buildMasonry(masonryRng, {
    width: W,
    height: H,
    depth: DEPTH2,
    band: BAND,
    holes: [{ x0: -fw / 2, x1: fw / 2, y0: 0, y1: fh }]
  });
  const stoneParts = masonry.parts;
  const glowParts = [];
  const frameTone = (x, y) => 0.14 + (y > H * 0.55 ? -0.18 * Math.min(1, (y - H * 0.55) / (H * 0.45)) : 0);
  const fd = DEPTH2 + 0.06;
  for (const s of [-1, 1]) stoneParts.push(withTone(buildBlock([jamb, oh, fd], [s * (ow / 2 + jamb / 2), oh / 2, 0]), frameTone));
  stoneParts.push(withTone(buildBlock([fw + 0.08, lintel, fd + 0.02], [0, oh + lintel / 2, 0]), frameTone));
  stoneParts.push(withTone(buildBlock([ow, PX * 1.2, DEPTH2], [0, PX * 0.6, 0]), -0.05));
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
      const glass = new THREE6.CylinderGeometry(0.15, 0.15, thick + 0.01, 12);
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
  const group = new THREE6.Group();
  group.name = meta3.name;
  const wall = new THREE6.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: layout.int(0, 96), id: 20, grain: 0.06 }));
  wall.name = "wall";
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);
  const leaves = new THREE6.Mesh(leafGeometry, metalMaterial(metal, { id: 21, tone: true }));
  leaves.name = "leaves";
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(leaves);
  const light = p.light === "auto" ? p.model === "emergency" ? "alarm" : "amber" : p.light;
  const glow = new THREE6.Mesh(mergeToned(glowParts), glowMixMaterial([["amber", level], [light, 3]], { id: 22 }));
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
  const ease2 = (t) => t * t * (3 - 2 * t);
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
      door.openness = THREE6.MathUtils.clamp(t, 0, 1);
      pose(ease2(door.openness));
    }
  };
  let tween = null;
  let cycling = p.state === "cycle";
  pose(ease2(door.openness));
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
      pose(ease2(door.openness));
    }
    baseUpdate(force);
  };
  group.userData.door = door;
  group.userData.asset = { id: meta3.id, params: p };
  return group;
}

// src/assets/buildings/structure/glyph-column.js
var glyph_column_exports = {};
__export(glyph_column_exports, {
  create: () => create4,
  dispose: () => disposeObject,
  meta: () => meta4,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE7 from "three";
var SHAPES = { square: "Pilier carr\xE9 \xE0 chanfreins", fluted: "Colonne cannel\xE9e", engaged: "Demi-colonne engag\xE9e", pilaster: "Pilastre" };
var FIBERS = { none: "Sans fibre", cyan: "Fibre cyan" };
var GLYPHS2 = { lit: "Allum\xE9s", dim: "En veille", off: "\xC9teints" };
var LEVELS2 = { lit: 2, dim: 1, off: 0 };
var BASE = 0.4;
var CAPITAL = 0.5;
var params4 = {
  seed: seedParam("Change les glyphes du chapiteau, les tons et les \xE9caillures, la hauteur exacte des bagues, l'usure du pied."),
  shape: choiceParam("Forme", SHAPES, "Pilier carr\xE9 (Sas), colonne ronde cannel\xE9e (Archives, Rotonde), demi-colonne engag\xE9e dans un mur, ou pilastre."),
  height: numberParam("Hauteur", 5, 3, 14, "Du sol au-dessus du chapiteau (5 m au Sas, 7 m aux Archives, 10 m \xE0 l'Oracle).", { step: 0.5, unit: "m" }),
  diameter: numberParam("Largeur", 0.9, 0.6, 1.2, "Largeur du f\xFBt (diam\xE8tre, ou c\xF4t\xE9 du pilier carr\xE9).", { step: 0.05, unit: "m" }),
  flutes: { type: "int", default: 16, min: 8, max: 24, label: "Cannelures", description: "Nombre de cannelures d'une colonne ronde (16 aux Archives, 12 \xE0 la Rotonde, 20 \xE0 l'Oracle)." },
  fiber: choiceParam("Fibre", FIBERS, "Une rainure verticale d'un pixel o\xF9 court une fibre de lumi\xE8re cyan (Oracle)."),
  glyphs: choiceParam("Glyphes", GLYPHS2, "La couronne de glyphes du chapiteau : allum\xE9e, en veille ou \xE9teinte."),
  glow: glowParam("Couleur des glyphes."),
  stone: stoneParam("Pierre de la colonne.", { only: ["smoked", "blackBasalt"] })
};
var meta4 = {
  id: "buildings/structure/glyph-column",
  name: "Colonne \xE0 glyphes",
  nameEn: "Glyph column",
  category: "buildings",
  subcategory: "structure",
  description: "Colonne du Complexe : base moulur\xE9e, f\xFBt de pierre fum\xE9e, deux bagues de bronze, chapiteau ceint d'une couronne de glyphes ambre. Pilier carr\xE9 \xE0 chanfreins, colonne cannel\xE9e, demi-colonne engag\xE9e ou pilastre ; de 3 \xE0 14 m ; fibre de lumi\xE8re cyan en option. Fiches SAS-03, ARC-09, GAL-11, ORA-06.",
  tags: [
    "colonne",
    "pilier",
    "pilastre",
    "demi-colonne",
    "cannelures",
    "chapiteau",
    "glyphes",
    "bronze",
    "fibre",
    "le complexe",
    "complexe",
    "ancien-tech",
    "architecture",
    "lumineux",
    "int\xE9rieur",
    "column",
    "pillar",
    "pilaster",
    "engaged column",
    "flutes",
    "capital",
    "glyphs",
    "fiber",
    "ancient complex",
    "ancient-tech",
    "architectural",
    "glowing",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au centre du f\xFBt (pilier, colonne) ou au nu du mur (demi-colonne, pilastre : le mur est en z \u2264 0, la colonne avance vers +z)",
  footprint: { radius: 0.85, height: 5 },
  animated: [],
  params: params4,
  variants: variantsOf("shape", params4.shape)
};
function create4(given = {}) {
  const p = resolveParams(meta4.params, given);
  const stone = STONES[p.stone];
  const shape = createRng(p.seed * 7919 + 17);
  const glyphRng = createRng(p.seed * 104729 + 71);
  const H = p.height;
  const D = p.shape === "pilaster" ? Math.min(p.diameter, 0.7) : p.diameter;
  const r = D / 2;
  const shaft0 = BASE, shaft1 = H - CAPITAL;
  const sootAt = soot(H * 0.5, H, -0.24);
  const foot = (x, y) => y < 0.6 ? -0.1 * (1 - y / 0.6) : 0;
  const baseTone = shape.range(-0.06, 0.04);
  const toneAt = (x, y) => baseTone + sootAt(x, y) + foot(x, y);
  const stoneParts = [];
  const bronzeParts = [];
  const glowParts = [];
  const addStone = (g, extra = 0) => stoneParts.push(withTone(g, (x, y) => toneAt(x, y) + extra));
  const ringYs = [H * shape.range(0.23, 0.26), H * shape.range(0.7, 0.74)];
  const level = LEVELS2[p.glyphs];
  const glyphY = shaft1 + 0.12;
  const flatGlyphs = (length, x, z, rotY) => {
    const strip = glyphStrip(glyphRng, { length, rows: 2 });
    strip.rotateY(rotY);
    strip.translate(x, glyphY, z);
    glowParts.push(withShade(strip, 0));
  };
  if (p.shape === "square") {
    const c = PX * 1.5;
    const outline = [[-r + c, -r], [r - c, -r], [r, -r + c], [r, r - c], [r - c, r], [-r + c, r], [-r, r - c], [-r, -r + c]];
    addStone(buildPrism(outline, shaft0, () => shaft1));
    addStone(buildBlock([D + 0.24, 0.26, D + 0.24], [0, 0.13, 0]), -0.04);
    addStone(buildBlock([D + 0.12, BASE - 0.26, D + 0.12], [0, 0.26 + (BASE - 0.26) / 2, 0]));
    addStone(buildBlock([D + 0.04, 0.28, D + 0.04], [0, shaft1 + 0.14, 0]), -0.06);
    addStone(buildBlock([D + 0.3, CAPITAL - 0.28, D + 0.3], [0, shaft1 + 0.28 + (CAPITAL - 0.28) / 2, 0]));
    const half = (D + 0.04) / 2;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      flatGlyphs(D - 0.12, Math.sin(a) * half, Math.cos(a) * half, a);
    }
    for (const y of ringYs) bronzeParts.push(squareRing({ size: D, y: y - PX, height: PX * 2, thickness: PX * 0.8 }));
  } else if (p.shape === "fluted") {
    addStone(fluteShaft({ radius: r, flutes: p.flutes, depth: PX * 1.2, y0: shaft0, y1: shaft1 }));
    const sides = Math.max(12, p.flutes);
    addStone(buildBlock([D + 0.24, 0.24, D + 0.24], [0, 0.12, 0]), -0.04);
    addStone(buildLathe([[0, 0.24], [r + 0.08, 0.24], [r + 0.1, 0.3], [r + 0.05, BASE - 0.04], [r + 0.02, BASE], [0, BASE]], { segments: sides, facets: true }));
    addStone(buildLathe([[0, shaft1], [r + 0.01, shaft1], [r + 0.01, shaft1 + 0.28], [0, shaft1 + 0.28]], { segments: sides, facets: true }), -0.06);
    addStone(buildLathe([[0, shaft1 + 0.28], [r + 0.08, shaft1 + 0.28], [r + 0.16, H - 0.06], [r + 0.16, H], [0, H]], { segments: sides, facets: true }));
    const strip = glyphStrip(glyphRng, { length: 2 * Math.PI * (r + 0.01) - PX * 2, rows: 2 });
    strip.translate(0, glyphY, 0);
    glowParts.push(withShade(bendAroundY(strip, r + 0.01, { concave: false }), 0));
    for (const y of ringYs) bronzeParts.push(ring({ radius: r - PX * 0.5, y: y - PX, height: PX * 2, thickness: PX * 1.2, segments: sides }));
  } else if (p.shape === "engaged") {
    addStone(fluteShaft({ radius: r, flutes: p.flutes, depth: PX * 1.2, y0: shaft0, y1: shaft1, arc: [-Math.PI / 2, Math.PI / 2] }));
    addStone(buildBlock([D + 0.24, 0.24, r + 0.12], [0, 0.12, (r + 0.12) / 2]), -0.04);
    addStone(buildBlock([D + 0.12, BASE - 0.24, r + 0.06], [0, 0.24 + (BASE - 0.24) / 2, (r + 0.06) / 2]));
    addStone(buildBlock([D + 0.04, 0.28, r + 0.02], [0, shaft1 + 0.14, (r + 0.02) / 2]), -0.06);
    addStone(buildBlock([D + 0.3, CAPITAL - 0.28, r + 0.15], [0, shaft1 + 0.28 + (CAPITAL - 0.28) / 2, (r + 0.15) / 2]));
    flatGlyphs(D - 0.1, 0, r + 0.02, 0);
    for (const y of ringYs) {
      const band = buildBlock([Math.PI * (r + PX * 0.3), PX * 2, PX], [0, y, PX * 0.5]);
      bronzeParts.push(bendAroundY(band, r - PX * 0.4, { concave: false }));
    }
  } else {
    const depth = 0.4;
    addStone(buildBlock([D, shaft1 - shaft0, depth], [0, (shaft0 + shaft1) / 2, depth / 2]));
    addStone(buildBlock([D + 0.2, BASE, depth + 0.1], [0, BASE / 2, (depth + 0.1) / 2]), -0.04);
    addStone(buildBlock([D + 0.04, 0.28, depth + 0.02], [0, shaft1 + 0.14, (depth + 0.02) / 2]), -0.06);
    addStone(buildBlock([D + 0.24, CAPITAL - 0.28, depth + 0.12], [0, shaft1 + 0.28 + (CAPITAL - 0.28) / 2, (depth + 0.12) / 2]));
    flatGlyphs(D - 0.1, 0, depth + 0.02, 0);
    addStone(buildBlock([D - 0.2, shaft1 - shaft0 - 0.5, PX * 0.5], [0, (shaft0 + shaft1) / 2, depth + PX * 0.25]), -0.12);
    for (const y of ringYs) {
      bronzeParts.push(buildBlock([D + PX * 1.6, PX * 2, PX * 0.8], [0, y, depth + PX * 0.4]));
      for (const s of [-1, 1]) bronzeParts.push(buildBlock([PX * 0.8, PX * 2, depth], [s * (D / 2 + PX * 0.4), y, depth / 2]));
    }
  }
  const front = p.shape === "engaged" || p.shape === "pilaster";
  for (let i = 0; i < 5; i++) {
    const y = shape.range(shaft0 + 0.3, shaft1 - 0.3);
    const a = front ? shape.range(-1.2, 1.2) : shape.range(0, Math.PI * 2);
    const rr = p.shape === "pilaster" ? 0 : r - PX * 0.2;
    const x = p.shape === "pilaster" ? shape.range(-D / 2 + 0.1, D / 2 - 0.1) : Math.sin(a) * rr;
    const z = p.shape === "pilaster" ? 0.4 : Math.cos(a) * rr;
    const chip = buildBlock([PX * shape.int(1, 2), PX * shape.int(1, 3), PX * 0.6], [x, y, z], [0, a, 0]);
    stoneParts.push(withTone(chip, 0.3));
  }
  if (p.fiber === "cyan") {
    const z = p.shape === "pilaster" ? 0.4 + PX * 0.5 : p.shape === "square" ? r : r - PX * 0.6;
    const a = p.shape === "fluted" || p.shape === "engaged" ? Math.PI / p.flutes : 0;
    const fiber = buildBlock([PX, shaft1 - shaft0 - 0.1, PX * 0.6], [0, (shaft0 + shaft1) / 2, z]);
    fiber.rotateY(a);
    glowParts.push(withShade(fiber, 1));
  }
  const group = new THREE7.Group();
  group.name = meta4.name;
  const stoneMesh = new THREE7.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: shape.int(0, 96), id: 20, grain: 0.06 }));
  stoneMesh.name = "column";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
  const bronze = new THREE7.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 21 }));
  bronze.name = "rings";
  bronze.castShadow = true;
  group.add(bronze);
  const glow = new THREE7.Mesh(mergeToned(glowParts), glowMixMaterial([[p.glow, level], ["cyan", 2]], { id: 22 }));
  glow.name = "glyphs";
  group.add(glow);
  group.userData.asset = { id: meta4.id, params: p };
  return group;
}

// src/assets/buildings/structure/glyph-floor-slab.js
var glyph_floor_slab_exports = {};
__export(glyph_floor_slab_exports, {
  create: () => create5,
  dispose: () => disposeObject,
  meta: () => meta5,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE8 from "three";
var SIZE2 = 2;
var THICK = 0.2;
var VARIANTS = { intact: "Intacte", cracked: "Fissur\xE9e", worn: "Us\xE9e", trapdoor: "\xC0 trappe", stained: "Tach\xE9e (huile, limaille)" };
var GROOVES = { dark: "Trait sombre", amber: "Lueur ambre tr\xE8s faible" };
var params5 = {
  seed: seedParam("Change les glyphes de la rainure, le ton de la dalle, le trac\xE9 de la fissure, la place de la trappe, les taches."),
  variant: choiceParam("\xC9tat", VARIANTS, "Intacte, fissur\xE9e, us\xE9e au centre (passage), \xE0 trappe de 0,6 m, ou tach\xE9e (Atelier)."),
  stone: stoneParam("Pierre de la dalle.", { only: ["blackBasalt", "smoked"] }),
  groove: choiceParam("Rainure", GROOVES, "La rainure de glyphes : un trait sombre, ou une lueur ambre \xE0 peine allum\xE9e.")
};
var meta5 = {
  id: "buildings/structure/glyph-floor-slab",
  name: "Dalle de sol \xE0 glyphes",
  nameEn: "Glyph floor slab",
  category: "buildings",
  subcategory: "structure",
  description: "Dalle de basalte de 2 \xD7 2 m du Complexe, pos\xE9e sur la grille de 2 m : une rainure de glyphes \xE0 traits droits court le long du bord et en diagonale (vers la porte, une fois tourn\xE9e). Intacte, fissur\xE9e, us\xE9e, \xE0 trappe de bronze ou tach\xE9e d'huile et de limaille. Fiche SAS-01.",
  tags: [
    "dalle",
    "sol",
    "carrelage",
    "basalte",
    "glyphes",
    "rainure",
    "trappe",
    "fissure",
    "le complexe",
    "complexe",
    "ancien-tech",
    "modulaire",
    "grille de 2 m",
    "int\xE9rieur",
    "floor slab",
    "floor",
    "tile",
    "basalt",
    "glyphs",
    "groove",
    "trapdoor",
    "crack",
    "ancient complex",
    "ancient-tech",
    "modular",
    "2 m grid",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol (dessous de la dalle), au centre ; dessus \xE0 0,20 m (le monde la pose \xE0 y = \u22120,20) ; la diagonale va de (\u2212x, \u2212z) vers (+x, +z)",
  footprint: { radius: 1.42, height: 0.24 },
  animated: [],
  params: params5,
  variants: variantsOf("variant", params5.variant)
};
function create5(given = {}) {
  const p = resolveParams(meta5.params, given);
  const stone = STONES[p.stone];
  const glyphRng = createRng(p.seed * 7919 + 17);
  const shape = createRng(p.seed * 104729 + 71);
  const noise = createNoise3(p.seed + 5);
  const half = (SIZE2 - PX) / 2;
  const top = THICK;
  const trap = p.variant === "trapdoor" ? { x: Math.round(shape.range(-0.3, 0.3) / PX) * PX, z: Math.round(shape.range(-0.3, 0.3) / PX) * PX, s: 0.6 } : null;
  const inTrap = (x, z, margin = 0) => trap && Math.abs(x - trap.x) < trap.s / 2 + margin && Math.abs(z - trap.z) < trap.s / 2 + margin;
  const baseTone = -0.17 + shape.range(-0.05, 0.05);
  const stain = (x, z) => noise(x * 1.4 + 3, 0.5, z * 1.4);
  const tone = (x, y2, z) => {
    if (y2 < top - 0.01) return baseTone + 0.07;
    let t = baseTone;
    if (p.variant === "worn") t += 0.5 * Math.max(0, 1 - Math.hypot(x * 1.2, z) / 1.15) ** 0.9;
    if (p.variant === "stained") t -= 0.4 * THREE8.MathUtils.smoothstep(stain(x, z), 0.56, 0.66);
    return t;
  };
  const body = withTone(buildBlock([half * 2, THICK - 4e-3, half * 2], [0, (THICK - 4e-3) / 2, 0]), tone);
  const surface = new THREE8.PlaneGeometry(half * 2, half * 2, 12, 12);
  surface.deleteAttribute("uv");
  surface.rotateX(-Math.PI / 2);
  surface.translate(0, top, 0);
  withTone(surface, tone);
  const stoneParts = [body, surface];
  if (p.variant === "cracked") {
    const side = shape.int(0, 3);
    const t0 = shape.range(-0.6, 0.6);
    const start = [[t0, -half], [half, t0], [t0, half], [-half, t0]][side];
    const inward = [[0, 1], [-1, 0], [0, -1], [1, 0]][side];
    let [x, z] = start;
    let [dx, dz] = inward;
    const points = [[x, z]];
    const steps = shape.int(5, 8);
    for (let i = 0; i < steps; i++) {
      const a = shape.range(-0.7, 0.7);
      const c = Math.cos(a), s = Math.sin(a);
      [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
      const len = shape.range(0.15, 0.32);
      x = THREE8.MathUtils.clamp(x + dx * len, -half + 0.05, half - 0.05);
      z = THREE8.MathUtils.clamp(z + dz * len, -half + 0.05, half - 0.05);
      points.push([x, z]);
    }
    const crackLine = (pts) => {
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx2, bz2] = pts[i];
        stoneParts.push(withTone(beam([ax, top + 3e-3, az], [bx2, top + 3e-3, bz2], PX, 6e-3), -1.2));
      }
    };
    crackLine(points);
    const from = points[shape.int(2, points.length - 2)];
    const branch = [from];
    let [bx, bz] = from;
    const ba = shape.range(0.8, 1.6) * (shape.chance(0.5) ? 1 : -1);
    for (let i = 0; i < 3; i++) {
      bx += (dx * Math.cos(ba) - dz * Math.sin(ba)) * 0.16;
      bz += (dx * Math.sin(ba) + dz * Math.cos(ba)) * 0.16;
      branch.push([THREE8.MathUtils.clamp(bx, -half, half), THREE8.MathUtils.clamp(bz, -half, half)]);
    }
    crackLine(branch);
  }
  if (p.variant === "stained") {
    for (let i = 0; i < 26; i++) {
      const x = shape.range(-half + 0.1, half - 0.1), z = shape.range(-half + 0.1, half - 0.1);
      if (stain(x, z) < 0.5 && !shape.chance(0.25)) continue;
      stoneParts.push(withTone(buildBlock([PX * 0.7, 6e-3, PX * 0.7], [x, top + 3e-3, z], [0, shape.range(0, 1.5), 0]), 0.6));
    }
  }
  const group = new THREE8.Group();
  group.name = meta5.name;
  const stoneMesh = new THREE8.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: shape.int(0, 96), id: 20, grain: 0.07 }));
  stoneMesh.name = "slab";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
  const grooveParts = [];
  const inset = 0.25;
  const edge = half - inset;
  const y = top + 2e-3;
  const dash = (ax, az, bx, bz) => {
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (inTrap(mx, mz, 0.05)) return;
    grooveParts.push(beam([ax, y, az], [bx, y, bz], PX, 4e-3));
  };
  const runLine = (ax, az, bx, bz) => {
    const length = Math.hypot(bx - ax, bz - az);
    const columns = Math.floor(length / PX);
    for (const [c, , n] of straightGlyphRuns(glyphRng, columns, 1)) {
      const t0 = c / columns, t1 = (c + n) / columns;
      dash(ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1);
    }
  };
  const corners = [[-edge, -edge], [edge, -edge], [edge, edge], [-edge, edge]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    dash(ax, az, bx, bz);
    const length = Math.hypot(bx - ax, bz - az);
    const columns = Math.floor(length / PX);
    const [ux, uz] = [(bx - ax) / length, (bz - az) / length];
    const [nx, nz] = [-uz, ux];
    for (const [c, , n] of straightGlyphRuns(glyphRng, columns, 1)) {
      if (n < 2 || !glyphRng.chance(0.35)) continue;
      const cx = ax + ux * (c + 0.5) * PX, cz = az + uz * (c + 0.5) * PX;
      dash(cx, cz, cx + nx * PX * 2, cz + nz * PX * 2);
    }
  }
  runLine(-edge + 0.1, -edge + 0.1, edge - 0.1, edge - 0.1);
  const grooveMaterial = p.groove === "amber" ? glowMaterial("amber", { level: 1, id: 21 }) : createToonMaterial({ ramp: [stone.ink, stone.ink], steps: [0.5], unlit: true, outline: false, glow: false, id: 21 });
  const groove = new THREE8.Mesh(mergeGeometries(grooveParts), grooveMaterial);
  groove.name = "groove";
  group.add(groove);
  if (trap) {
    const { x, z, s } = trap;
    const h = 0.03;
    const w = PX;
    const bronzeParts = [
      buildBlock([s + w * 2, h, w], [x, top + h / 2, z - s / 2 - w / 2]),
      buildBlock([s + w * 2, h, w], [x, top + h / 2, z + s / 2 + w / 2]),
      buildBlock([w, h, s], [x - s / 2 - w / 2, top + h / 2, z]),
      buildBlock([w, h, s], [x + s / 2 + w / 2, top + h / 2, z]),
      withTone(buildBlock([s, 0.012, s], [x, top + 6e-3, z]), -0.62),
      buildBlock([PX * 2, 0.02, PX], [x - s / 4, top + 0.022, z - s / 2 + PX * 0.5]),
      buildBlock([PX * 2, 0.02, PX], [x + s / 4, top + 0.022, z - s / 2 + PX * 0.5])
    ];
    const handle = ring({ radius: 0.05, height: 0.012, thickness: PX * 0.7, segments: 8, y: top + 0.012 });
    handle.translate(x, 0, z + s / 2 - 0.12);
    bronzeParts.push(handle);
    const bronze = new THREE8.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 22, tone: true }));
    bronze.name = "trapdoor";
    bronze.castShadow = true;
    bronze.receiveShadow = true;
    group.add(bronze);
  }
  group.userData.asset = { id: meta5.id, params: p };
  return group;
}

// src/assets/buildings/structure/glyph-wall.js
var glyph_wall_exports = {};
__export(glyph_wall_exports, {
  create: () => create6,
  dispose: () => disposeObject,
  meta: () => meta6,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE9 from "three";
var DEPTH3 = 0.6;
var BAND2 = { y0: 1, y1: 1.25 };
var VARIANTS2 = { plain: "Plein", niche: "Avec niche", conduit: "Avec conduit encastr\xE9" };
var LININGS = { stone: "Pierre nue", copper: "Doublage de cuivre" };
var GLYPHS3 = { lit: "Allum\xE9s", dim: "En veille", off: "\xC9teints" };
var LEVELS3 = { lit: 2, dim: 1, off: 0 };
var params6 = {
  seed: seedParam("Change l'appareil (hauteur des assises, longueur des blocs, tons), les glyphes du bandeau, la place de la niche ou du conduit."),
  variant: choiceParam("Forme", VARIANTS2, "Plein, avec une niche de 0,6 \xD7 1,2 m, ou avec un conduit vertical o\xF9 passe un tuyau de cuivre."),
  height: numberParam("Hauteur", 5, 4, 14, "Hauteur du mur (5 m dans le Sas, jusqu'\xE0 14 m dans les grandes salles).", { step: 0.5, unit: "m" }),
  width: numberParam("Largeur", 2, 1, 4, "Largeur du module (2 m sur la grille du Complexe).", { step: 0.5, unit: "m" }),
  curve: numberParam("Cintrage", 0, 0, 20, "Rayon de la salle ronde o\xF9 le mur s'inscrit, face vers le centre ; 0 = droit.", { step: 0.5, unit: "m" }),
  lining: choiceParam("Parement", LININGS, "Pierre nue, ou doublage de plaques de cuivre rivet\xE9es (salle de la Cassette)."),
  glyphs: choiceParam("Glyphes", GLYPHS3, "Le bandeau de glyphes : allum\xE9, en veille (lueur faible) ou \xE9teint."),
  glow: glowParam("Couleur des glyphes (ambre partout ; cyan pr\xE8s des artefacts ; rouge en alerte)."),
  stone: stoneParam("Pierre du mur.", { only: ["blackBasalt", "smoked"] })
};
var meta6 = {
  id: "buildings/structure/glyph-wall",
  name: "Mur \xE0 bandeau de glyphes",
  nameEn: "Glyph band wall",
  category: "buildings",
  subcategory: "structure",
  description: "Module de mur du Complexe : basalte en blocs appareill\xE9s, suie vers le haut, bandeau creus\xE9 \xE0 1,10 m o\xF9 s'allume une ligne de glyphes ambre \xE0 traits droits. Plein, \xE0 niche ou \xE0 conduit encastr\xE9 ; de 4 \xE0 14 m de haut ; droit ou cintr\xE9 pour les salles rondes ; nu ou doubl\xE9 de cuivre. Fiche SAS-02.",
  tags: [
    "mur",
    "muraille",
    "basalte",
    "glyphes",
    "bandeau",
    "niche",
    "conduit",
    "tuyau",
    "cuivre",
    "salle ronde",
    "le complexe",
    "complexe",
    "ancien-tech",
    "modulaire",
    "grille de 2 m",
    "lumineux",
    "int\xE9rieur",
    "wall",
    "basalt",
    "glyphs",
    "glyph band",
    "wall niche",
    "duct",
    "pipe",
    "copper",
    "curved wall",
    "ancient complex",
    "ancient-tech",
    "modular",
    "2 m grid",
    "glowing",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au milieu du mur ; le mur suit l'axe x, la face appareill\xE9e (bandeau, niche) regarde +z ; cintr\xE9, le centre de la salle est en z = +rayon",
  footprint: { radius: 1.05, height: 5 },
  animated: [],
  params: params6,
  variants: variantsOf("variant", params6.variant)
};
function create6(given = {}) {
  const p = resolveParams(meta6.params, given);
  const stone = STONES[p.stone];
  const layout = createRng(p.seed * 7919 + 17);
  const masonryRng = createRng(p.seed * 104729 + 71);
  const glyphRng = createRng(p.seed * 15485863 + 3);
  const W = p.width, H = p.height;
  const front = DEPTH3 / 2;
  const curved = p.curve > 0;
  const copper = p.lining === "copper";
  const holes = [];
  const snapX = (x) => Math.round(x / PX) * PX;
  if (p.variant === "niche") {
    const x = snapX(layout.range(-(W - 0.9) / 2, (W - 0.9) / 2) * 0.6);
    holes.push({ x0: x - 0.3, x1: x + 0.3, y0: 1.5, y1: 2.7, depth: 0.3 });
  } else if (p.variant === "conduit") {
    const x = snapX(layout.range(-(W - 0.7) / 2, (W - 0.7) / 2) * 0.7);
    holes.push({ x0: x - 0.16, x1: x + 0.16, y0: 0, y1: H, depth: 0.24 });
  }
  const masonry = buildMasonry(masonryRng, {
    width: W,
    height: H,
    depth: DEPTH3,
    holes,
    band: BAND2,
    split: curved ? 0.5 : Infinity,
    facing: !copper
  });
  const stoneParts = masonry.parts;
  const metalParts = [];
  const glowParts = [];
  for (const h of holes) {
    if (p.variant === "niche") {
      stoneParts.push(withTone(buildBlock([h.x1 - h.x0 + PX * 2, PX * 1.5, h.depth + PX], [(h.x0 + h.x1) / 2, h.y0 + PX * 0.75, front - h.depth / 2 + PX / 2]), 0.12));
    } else {
      const cx = (h.x0 + h.x1) / 2, cz = front - h.depth / 2;
      for (let y = 0; y < H - 0.01; y += 0.5) {
        const len = Math.min(0.5, H - y);
        const pipe = new THREE9.CylinderGeometry(0.06, 0.06, len, 6, 1, true);
        pipe.deleteAttribute("uv");
        pipe.translate(cx, y + len / 2, cz);
        const streak = layout.range(-0.5, 0.5);
        metalParts.push(withTone(pipe, (x, yy, z, nx, ny, nz) => Math.abs(Math.atan2(nx, nz) - streak) < 0.6 ? -0.28 : 0));
        const collar = ring({ radius: 0.06, height: PX * 1.5, y: y + 0.2, thickness: PX * 0.6, segments: 6 });
        collar.translate(cx, 0, cz);
        metalParts.push(withTone(collar, 0.2));
      }
    }
  }
  if (copper) {
    const z0 = masonry.coreFace, z1 = front;
    const spans = (y) => {
      let list = [[-W / 2, W / 2]];
      for (const h of holes) {
        if (y < h.y0 || y > h.y1) continue;
        list = list.flatMap(([a, b]) => h.x1 <= a || h.x0 >= b ? [[a, b]] : [...h.x0 > a ? [[a, h.x0]] : [], ...h.x1 < b ? [[h.x1, b]] : []]);
      }
      return list;
    };
    const rows = [[0, BAND2.y0], [BAND2.y1, Math.min(H, BAND2.y1 + 2.2)], [Math.min(H, BAND2.y1 + 2.2), H]].filter(([a, b]) => b - a > 0.2);
    const plates = (a, b, ya, yb) => {
      const n = Math.max(1, Math.round((b - a) / 1));
      for (let k = 0; k < n; k++) {
        const xa = a + (b - a) * k / n + PX / 2, xb = a + (b - a) * (k + 1) / n - PX / 2;
        if (xb - xa < 0.05 || yb - ya < 0.1) continue;
        const plate = buildBlock([xb - xa, yb - ya - PX, z1 - z0], [(xa + xb) / 2, (ya + yb) / 2, (z0 + z1) / 2]);
        metalParts.push(withTone(plate, layout.range(-0.12, 0.08) + (yb > H * 0.6 ? -0.1 : 0)));
        for (const yy of [ya + PX * 1.5, yb - PX * 1.5]) {
          metalParts.push(withTone(rivetRow([xa + 0.08, yy, z1], [xb - 0.08, yy, z1], { spacing: 0.2 }), 0.35));
        }
      }
    };
    for (const [y0, y1] of rows) {
      for (const [a, b] of spans((y0 + y1) / 2)) plates(a, b, y0, y1);
      for (const h of holes) {
        if (h.depth == null || h.y0 <= y0 || h.y1 >= y1) continue;
        plates(h.x0, h.x1, y0, h.y0);
        plates(h.x0, h.x1, h.y1, y1);
      }
    }
  }
  let bandSpans = [[-W / 2, W / 2]];
  for (const h of holes) {
    const y = (BAND2.y0 + BAND2.y1) / 2;
    if (y < h.y0 || y > h.y1) continue;
    bandSpans = bandSpans.flatMap(([a, b]) => h.x1 <= a || h.x0 >= b ? [[a, b]] : [...h.x0 > a ? [[a, h.x0]] : [], ...h.x1 < b ? [[h.x1, b]] : []]);
  }
  for (const [a, b] of bandSpans) {
    if (b - a < 0.3) continue;
    const strip = glyphStrip(glyphRng, { length: b - a - 0.16, rows: 2 });
    strip.translate((a + b) / 2, 1.1 - PX, masonry.bandFace);
    glowParts.push(strip);
  }
  const group = new THREE9.Group();
  group.name = meta6.name;
  const bend = (g) => curved ? bendAroundY(g, p.curve, { concave: true }) : g;
  const stoneMesh = new THREE9.Mesh(bend(mergeToned(stoneParts)), stoneMaterial(stone, { seed: layout.int(0, 96), id: 20, grain: 0.06 }));
  stoneMesh.name = "wall";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
  if (glowParts.length) {
    const glyphs = new THREE9.Mesh(bend(mergeToned(glowParts)), glowMaterial(p.glow, { level: LEVELS3[p.glyphs], id: 21 }));
    glyphs.name = "glyphs";
    group.add(glyphs);
  }
  if (metalParts.length) {
    const metal = new THREE9.Mesh(bend(mergeToned(metalParts)), metalMaterial(METALS.oxidizedCopper, { id: 22, tone: true }));
    metal.name = copper ? "copper-lining" : "pipe";
    metal.castShadow = true;
    metal.receiveShadow = true;
    group.add(metal);
  }
  group.userData.asset = { id: meta6.id, params: p };
  return group;
}

// src/assets/buildings/structure/iris-door.js
import * as THREE10 from "three";
var DEG = Math.PI / 180;
var CY = 1.4;
var R_OPEN = 1.4;
var R_RING = 1.9;
var R_BAND = 2.05;
var R_FRAME = 2.3;
var HALF = 2.25;
var TOP = 3.65;
var SILL = 0.2;
var WALL = 6;
var DEPTH4 = 0.6;
var BAND3 = { y0: 1, y1: 1.25 };
var BLADES = 12;
var RING = 12;
var LOCK0 = 13;
var FIXED = 255;
var OPEN_ANGLE = -54 * DEG;
var RING_TURN = 15 * DEG;
var LOCK_TRAVEL = 0.6;
var OPEN_TIME = 5.2;
var CLOSE_TIME = 3.2;
var STATES2 = { closed: "Ferm\xE9e", open: "Ouverte", cycle: "S'ouvre et se ferme en boucle" };
var WEAR = { patinated: "Patin\xE9e", heavy: "Tr\xE8s us\xE9e (suie, lames ternies)" };
var params7 = {
  seed: seedParam("Change les glyphes des lames et des voussoirs, l'ordre et le sens de la cascade, l'appareil du mur, les tons des lames et des pierres."),
  state: choiceParam("\xC9tat", STATES2, "Ferm\xE9e (glyphes \xE9teints, m\xE9daillon qui respire), ouverte (lames repli\xE9es en couronne), ou en boucle pour regarder la s\xE9quence. Pilotable : group.userData.door."),
  glow: glowParam("Couleur des glyphes et du m\xE9daillon.", { only: ["amber", "cyan"] }),
  wear: choiceParam("Usure", WEAR, "Patin\xE9e, ou tr\xE8s us\xE9e : plus de suie sur le mur et le cadre, lames plus ternies et in\xE9gales."),
  wall: choiceParam("Mur", { on: "Avec son pan de mur (6 m)", off: "Cadre seul" }, "La porte livr\xE9e avec son pan de mur de 6 m, ou le seul bloc du cadre (pour l'encastrer ailleurs)."),
  height: numberParam("Hauteur du mur", 5, 4, 8, "Hauteur du pan de mur autour de la porte.", { step: 0.5, unit: "m" }),
  stone: stoneParam("Pierre du mur et du cadre.", { only: ["blackBasalt", "smoked"] })
};
var meta7 = {
  id: "buildings/structure/iris-door",
  name: "Porte-Iris",
  nameEn: "Iris door",
  category: "buildings",
  subcategory: "structure",
  description: "L'entr\xE9e du Sas du Complexe : anneau de basalte \xE0 voussoirs grav\xE9s encastr\xE9 dans un pan de mur de 6 m, anneau de bronze cr\xE9nel\xE9 qui tourne, douze lames de bronze en moulinet qui s'\xE9cartent en cascade pendant que leurs glyphes s'allument, m\xE9daillon de laiton \xE0 couronne de points qui respire, quatre verrous. Ferm\xE9e, ouverte, ou pilot\xE9e par le sc\xE9nario.",
  tags: [
    "porte-iris",
    "iris",
    "porte",
    "diaphragme",
    "lames",
    "anneau rotatif",
    "verrous",
    "m\xE9daillon",
    "voussoirs",
    "glyphes",
    "le complexe",
    "complexe",
    "ancien-tech",
    "entr\xE9e",
    "h\xE9ros",
    "anim\xE9",
    "pilotable",
    "int\xE9rieur",
    "iris door",
    "aperture",
    "doorway",
    "blades",
    "rotating ring",
    "bolts",
    "medallion",
    "arch stones",
    "glyph marks",
    "ancient complex",
    "ancient-tech",
    "entrance",
    "hero asset",
    "animated",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au centre de l'ouverture ; le mur suit l'axe x (6 m), face avant en +z ; centre de l'iris \xE0 1,40 m, seuil \xE0 0,20 m, bas de l'anneau sous le sol",
  footprint: { radius: 3.05, height: 5 },
  animated: ["door", "glow"],
  params: params7,
  variants: variantsOf("state", params7.state)
};
var polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
var clamp01 = (t) => Math.min(1, Math.max(0, t));
var ease = (t) => t * t * (3 - 2 * t);
function create7(given = {}) {
  const p = resolveParams(meta7.params, given);
  const stone = STONES[p.stone];
  const rng = createRng(p.seed * 7919 + 23);
  const masonryRng = createRng(p.seed * 104729 + 41);
  const glyphRng = createRng(p.seed * 15485863 + 11);
  const heavy = p.wear === "heavy";
  const H = Math.max(p.height, TOP + 0.35);
  const front = DEPTH4 / 2;
  const sootAt = soot(H * 0.45, H, heavy ? -0.38 : -0.24);
  const stoneParts = [];
  const metal = [];
  const glow = [];
  const glowGroups = [];
  let glowCount = 0;
  const addGlow = (g, part, kind, index) => {
    const count = g.attributes.position.count;
    glow.push([withShade(g, 0, 4), part]);
    glowGroups.push({ start: glowCount, count, kind, index });
    glowCount += count;
  };
  let bandFace = front - PX;
  if (p.wall === "on") {
    const masonry = buildMasonry(masonryRng, {
      width: WALL,
      height: H,
      depth: DEPTH4,
      band: BAND3,
      soot: heavy ? -0.36 : -0.24,
      holes: [{ x0: -HALF, x1: HALF, y0: 0, y1: TOP }]
    });
    stoneParts.push(...masonry.parts);
    bandFace = masonry.bandFace;
  }
  const shape = new THREE10.Shape();
  shape.moveTo(-HALF, 0);
  shape.lineTo(HALF, 0);
  shape.lineTo(HALF, TOP);
  shape.lineTo(-HALF, TOP);
  shape.lineTo(-HALF, 0);
  const hole = new THREE10.Path();
  const a0 = Math.asin((SILL - CY) / R_RING);
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (Math.PI - 2 * a0) * i / steps;
    const [x, y] = polar(R_RING, a);
    if (i === 0) hole.moveTo(x, y + CY);
    else hole.lineTo(x, y + CY);
  }
  hole.closePath();
  shape.holes.push(hole);
  const frame = plain(new THREE10.ExtrudeGeometry(shape, { depth: DEPTH4, bevelEnabled: false, curveSegments: 1 }));
  frame.translate(0, 0, -DEPTH4 / 2);
  stoneParts.push(withTone(frame, (x, y) => 0.02 + sootAt(x, y)));
  const chord = Math.sqrt(R_RING * R_RING - (CY - SILL) ** 2);
  stoneParts.push(withTone(buildBlock([chord * 2 + 0.06, SILL + 0.01, DEPTH4 + PX * 2], [0, (SILL + 0.01) / 2, 0]), (x, y, z, nx, ny) => ny > 0.9 ? 0.16 - 0.1 * Math.min(1, Math.abs(x) / chord) : 0.04));
  const VOUSSOIRS = 16;
  for (let i = 0; i < VOUSSOIRS; i++) {
    const span = Math.PI * 2 / VOUSSOIRS;
    const mid = Math.PI / 2 + i * span;
    if (CY + Math.sin(mid) * (R_BAND + R_FRAME) / 2 < -0.1) continue;
    const gap = PX / R_FRAME;
    const g = arcBlock({ r0: R_BAND, r1: R_FRAME, a0: mid - span / 2 + gap / 2, a1: mid + span / 2 - gap / 2, z0: front - 0.02, z1: front + 0.06, segments: 2 });
    g.translate(0, CY, 0);
    const tone = 0.3 + rng.range(-0.1, 0.06);
    stoneParts.push(withTone(g, (x, y) => tone + sootAt(x, y) * 0.6));
    if (CY + Math.sin(mid) * R_FRAME < 0.35) continue;
    const strip = glyphStrip(glyphRng, { length: 0.42, rows: 2 });
    strip.translate(0, -PX, 0);
    strip.rotateZ(mid - Math.PI / 2);
    const [gx, gy] = polar((R_BAND + R_FRAME) / 2, mid);
    strip.translate(gx, gy + CY, front + 0.06);
    const order = Math.min(i, VOUSSOIRS - i);
    addGlow(strip, FIXED, "frame", order / (VOUSSOIRS / 2));
  }
  if (p.wall === "on") {
    for (const s of [-1, 1]) {
      const strip = glyphStrip(glyphRng, { length: WALL / 2 - HALF - 0.16, rows: 2 });
      strip.translate(s * (WALL / 2 + HALF) / 2, 1.1 - PX, bandFace);
      addGlow(strip, FIXED, "band", 0);
    }
  }
  const band = arcBlock({ r0: R_RING, r1: R_BAND, a0: 0, a1: Math.PI * 2, z0: front - 0.04, z1: front + 0.03, segments: 40 });
  band.translate(0, CY, 0);
  metal.push([withTone(band, 0.2), FIXED]);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2 + Math.PI / 24;
    const [x, y] = polar((R_RING + R_BAND) / 2, a);
    if (y + CY < 0.05) continue;
    metal.push([withTone(buildBlock([PX, PX, PX], [x, y + CY, front + 0.03 + PX / 2]), 0.3), FIXED]);
  }
  const SEG = 24;
  for (const [z0, z1] of [[0.09, 0.22], [-0.22, -0.09]]) {
    const isFront = z0 > 0;
    for (let i = 0; i < SEG; i++) {
      const a = i / SEG * Math.PI * 2;
      const g = arcBlock({ r0: R_OPEN, r1: R_RING, a0: a, a1: a + Math.PI * 2 / SEG, z0, z1, segments: 1 });
      const tone = (i % 2 ? -0.12 : -0.24) + rng.range(-0.03, 0.03) - (heavy ? 0.06 : 0);
      withTone(g, (x, y, z, nx, ny) => nx * x + ny * y < -0.8 * Math.hypot(x, y) ? -0.75 : tone);
      g.translate(0, CY, 0);
      metal.push([g, RING]);
      const ta = a + Math.PI * 2 / SEG / 4;
      const tooth = arcBlock({ r0: R_OPEN - PX, r1: R_OPEN + 0.01, a0: ta, a1: ta + Math.PI * 2 / SEG / 2, z0: z0 + 0.01, z1: z1 - 0.01, segments: 1 });
      tooth.translate(0, CY, 0);
      metal.push([withTone(tooth, 0.14), RING]);
      if (isFront) {
        const [x, y] = polar(R_RING - 0.1, a + Math.PI / SEG);
        metal.push([withTone(buildBlock([PX, PX, PX * 0.6], [x, y + CY, z1 + PX * 0.3]), 0.32), RING]);
      }
    }
  }
  const locks = [];
  for (let m = 0; m < 4; m++) {
    const a = Math.PI / 2 - m * Math.PI / 2;
    const dir = new THREE10.Vector3(Math.cos(a), Math.sin(a), 0);
    const z = 0.25;
    const from = new THREE10.Vector3(0, CY, z).addScaledVector(dir, R_OPEN - 0.18);
    const to = new THREE10.Vector3(0, CY, z).addScaledVector(dir, R_RING + 0.1);
    metal.push([withTone(beam(from, to, 0.1, 0.06, 0, new THREE10.Vector3(0, 0, 1)), 0.1), LOCK0 + m]);
    const head = new THREE10.Vector3(0, CY, z + 0.01).addScaledVector(dir, R_OPEN - 0.14);
    metal.push([withTone(buildBlock([0.14, 0.14, 0.08], [head.x, head.y, head.z]), 0.22), LOCK0 + m]);
    const box = new THREE10.Vector3(0, CY, front + 0.05).addScaledVector(dir, (R_RING + R_BAND) / 2);
    metal.push([withTone(beam(box.clone().addScaledVector(dir, -0.09), box.clone().addScaledVector(dir, 0.09), 0.2, 0.06, 0, new THREE10.Vector3(0, 0, 1)), 0), FIXED]);
    locks.push(dir);
  }
  const bladeOutline = [polar(1.62, -18 * DEG), polar(1.62, 0), polar(1.62, 18 * DEG), polar(0.14, 100 * DEG), polar(0.1, 40 * DEG)];
  const trailA = new THREE10.Vector2(...bladeOutline[0]);
  const trailB = new THREE10.Vector2(...bladeOutline[4]);
  const trailDir = trailB.clone().sub(trailA).normalize();
  const bladeFront = (x, y) => {
    const d = (x - trailA.x) * -trailDir.y + (y - trailA.y) * trailDir.x;
    return 0.03 + 0.045 * clamp01(Math.abs(d) / 0.95);
  };
  const pivots = [];
  const bladeTone = Array.from({ length: BLADES }, (_, k) => (k % 2 ? 0.05 : -0.04) + rng.range(-0.05, 0.05) - (heavy ? rng.range(0, 0.12) : 0));
  for (let k = 0; k < BLADES; k++) {
    const ak = Math.PI / 2 + k * Math.PI * 2 / BLADES;
    const place = (g) => {
      g.rotateZ(ak);
      g.translate(0, CY, 0);
      return g;
    };
    const back = k % 2 ? -0.045 : -0.035;
    const plate = slantPlate(bladeOutline, back, bladeFront);
    const tone = bladeTone[k];
    withTone(plate, (x, y, z, nx, ny, nz) => tone + (nz > 0.5 ? 0.14 * (1 - Math.min(1, Math.hypot(x, y) / 1.5)) : -0.1));
    metal.push([place(plate), k]);
    const la = new THREE10.Vector2(...polar(1.5, 18 * DEG));
    const lb = new THREE10.Vector2(...polar(0.32, 92 * DEG));
    const inset = new THREE10.Vector2(...polar(PX * 0.5, 18 * DEG - Math.PI / 2));
    const a3 = new THREE10.Vector3(la.x + inset.x, la.y + inset.y, 0);
    const b3 = new THREE10.Vector3(lb.x + inset.x, lb.y + inset.y, 0);
    a3.z = bladeFront(a3.x, a3.y) + 4e-3;
    b3.z = bladeFront(b3.x, b3.y) + 4e-3;
    metal.push([place(withTone(beam(a3, b3, PX, 0.012, 0, new THREE10.Vector3(0, 0, 1)), tone + 0.32)), k]);
    const runs = straightGlyphRuns(glyphRng, 3, 3);
    const cells = [];
    const gc = new THREE10.Vector2(...polar(1.05, 10 * DEG));
    const radial = gc.clone().normalize();
    const tangent = new THREE10.Vector2(-radial.y, radial.x);
    for (const [c, r, n] of runs) {
      const u = (c + n / 2 - 1.5) * PX, v = (1.5 - r - 0.5) * PX;
      const x = gc.x + tangent.x * u + radial.x * v, y = gc.y + tangent.y * u + radial.y * v;
      const cell = buildBlock([n * PX, PX, 0.016], [0, 0, 0]);
      cell.rotateZ(Math.atan2(tangent.y, tangent.x));
      cell.translate(x, y, bladeFront(x, y) + 6e-3);
      cells.push(cell);
    }
    if (cells.length) addGlow(place(mergeToned(cells)), k, "blade", k);
    const sa = 60 * DEG;
    const sector = slantPlate([[0, 0], polar(0.32, sa - 15 * DEG), polar(0.32, sa), polar(0.32, sa + 15 * DEG)], 0.08, () => 0.125);
    metal.push([place(withTone(sector, (x, y, z, nx, ny, nz) => nz > 0.5 ? 0.34 : 0.1)), k]);
    if (k === 0) {
      const needle = beam(new THREE10.Vector3(...polar(0.07, sa), 0.13), new THREE10.Vector3(...polar(0.28, sa), 0.13), PX * 0.8, 0.012, 0, new THREE10.Vector3(0, 0, 1));
      metal.push([place(withTone(needle, -0.85)), k]);
      addGlow(place(buildBlock([PX * 1.6, PX * 1.6, 0.03], [0, 0, 0.135])), k, "crown", k);
    }
    const [dx, dy] = polar(0.42, sa);
    addGlow(place(buildBlock([PX * 1.2, PX * 1.2, 0.02], [dx, dy, bladeFront(dx, dy) + 0.01])), k, "crown", k);
    pivots.push(new THREE10.Vector3(...polar(1.6, ak - 18 * DEG), 0).add(new THREE10.Vector3(0, CY, 0)));
  }
  const group = new THREE10.Group();
  group.name = meta7.name;
  const stoneMesh = new THREE10.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: rng.int(0, 96), id: 20, grain: 0.06 }));
  stoneMesh.name = "stone";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE10.Mesh(metalMerged.geometry, metalMaterial(METALS.patinatedBronze, { id: 21, tone: true }));
  metalMesh.name = "bronze";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  group.add(metalMesh);
  const glowMerged = mergeParts(glow);
  const glowMesh = new THREE10.Mesh(glowMerged.geometry, glowMixMaterial(glowLevels(p.glow), { id: 22 }));
  glowMesh.name = "glow";
  group.add(glowMesh);
  const metalRig = createRigidParts(metalMerged.geometry, metalMerged.partOf, LOCK0 + 4);
  const glowRig = createRigidParts(glowMerged.geometry, glowMerged.partOf, LOCK0 + 4);
  const shade = glowMerged.geometry.attributes.aShade;
  const firstBlade = rng.int(0, BLADES - 1);
  const sense = rng.chance(0.5) ? 1 : -1;
  const bladeStart = Array.from({ length: BLADES }, (_, k) => 0.24 + ((k - firstBlade) * sense + BLADES) % BLADES * 0.042);
  const BLADE_SPAN = 0.3;
  const center = new THREE10.Vector3(0, CY, 0);
  const tmp = new THREE10.Matrix4();
  const aroundZ = (m, pivot, angle) => {
    m.makeTranslation(pivot.x, pivot.y, 0);
    m.multiply(tmp.makeRotationZ(angle));
    m.multiply(tmp.makeTranslation(-pivot.x, -pivot.y, 0));
  };
  let shownPose = -1;
  const pose = (s) => {
    if (Math.abs(s - shownPose) < 1e-4) return;
    shownPose = s;
    const lockT = ease(clamp01(s / 0.11));
    const ringT = ease(clamp01((s - 0.11) / 0.12));
    for (const rig of [metalRig, glowRig]) {
      for (let k = 0; k < BLADES; k++) aroundZ(rig.matrices[k], pivots[k], OPEN_ANGLE * ease(clamp01((s - bladeStart[k]) / BLADE_SPAN)));
      aroundZ(rig.matrices[RING], center, -RING_TURN * ringT);
      locks.forEach((dir, m) => rig.matrices[LOCK0 + m].makeTranslation(dir.x * LOCK_TRAVEL * lockT, dir.y * LOCK_TRAVEL * lockT, 0));
      rig.apply();
    }
  };
  const levels = glowGroups.map(() => -1);
  const light = (s, time) => {
    const breath = Math.sin(time * Math.PI * 2 / 3.2) > 0.2 ? 2 : 1;
    let changed = false;
    glowGroups.forEach((g, i) => {
      let level;
      if (g.kind === "band") level = s > 0.5 ? 2 : 1;
      else if (g.kind === "frame") level = s > 0.01 + 0.2 * g.index ? 2 : 0;
      else if (g.kind === "blade") level = s > bladeStart[g.index] ? s >= 1 ? 2 : 3 : 0;
      else level = s <= 0 ? breath : s < 0.24 ? 3 : 2;
      if (heavy && g.kind === "frame" && g.index > 0.85) level = Math.min(level, 1);
      if (level === levels[i]) return;
      levels[i] = level;
      shade.array.fill((level + 0.5) / 4, g.start, g.start + g.count);
      changed = true;
    });
    if (changed) shade.needsUpdate = true;
  };
  let tween = null;
  let cycling = p.state === "cycle";
  const door = {
    opening: { width: 2 * Math.sqrt(R_OPEN * R_OPEN - (CY - SILL) ** 2), height: CY + R_OPEN, x0: -R_OPEN, x1: R_OPEN, sill: SILL, radius: R_OPEN, center: CY },
    openness: p.state === "open" ? 1 : 0,
    get blocking() {
      return this.openness < 0.9;
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
      door.openness = clamp01(t);
      pose(door.openness);
      light(door.openness, sharedUniforms.uTime.value);
    }
  };
  pose(door.openness);
  light(door.openness, 0);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      if (tween) {
        cycling = false;
        const duration = (tween.to > tween.from ? OPEN_TIME : CLOSE_TIME) * Math.abs(tween.to - tween.from) || 1;
        const k = Math.min(1, (time - tween.start) / duration);
        door.openness = tween.from + (tween.to - tween.from) * k;
        if (k >= 1) tween = null;
      } else if (cycling) {
        const u = time % 15;
        door.openness = u < 3 ? 0 : u < 8.2 ? (u - 3) / OPEN_TIME : u < 11.8 ? 1 : 1 - (u - 11.8) / CLOSE_TIME;
      }
      pose(door.openness);
      light(door.openness, time);
    }
    baseUpdate(force);
  };
  group.userData.door = door;
  group.userData.asset = { id: meta7.id, params: p };
  return group;
}

// src/assets/buildings/structure/vent-grate.js
var vent_grate_exports = {};
__export(vent_grate_exports, {
  create: () => create8,
  dispose: () => disposeObject,
  meta: () => meta8,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE11 from "three";
var MODELS2 = { wall: "Grille murale (0,8 m)", floor: "Caillebotis droit (2 \xD7 2 m)", "floor-curved": "Caillebotis courbe (anneau)" };
var LIGHTS = { on: "Allum\xE9e", standby: "En veille", off: "\xC9teinte" };
var LEVELS4 = { on: 2, standby: 1, off: 0 };
var params8 = {
  seed: seedParam("Change la patine barreau par barreau, les barreaux tordus ou noircis, le plot manquant."),
  model: choiceParam("Mod\xE8le", MODELS2, "Grille d'a\xE9ration murale du Sas, ou caillebotis de sol du C\u0153ur (droit ou courbe)."),
  light: choiceParam("Lueur derri\xE8re", LIGHTS, "La lueur vue au travers : allum\xE9e, en veille ou \xE9teinte (fond sombre)."),
  glow: glowParam("Couleur de la lueur : ambre (machines, Sas) ou cyan (fosse d'\xE9nergie du C\u0153ur).", { only: ["amber", "cyan"] }),
  height: numberParam("Hauteur", 0.6, 0.2, 3, "Grille murale : hauteur de son centre.", { step: 0.05, unit: "m" }),
  radius: numberParam("Rayon", 4, 2, 10, "Caillebotis courbe : rayon int\xE9rieur de l'anneau (le module couvre 2 m de large et environ 2 m d'arc).", { step: 0.25, unit: "m" })
};
var meta8 = {
  id: "buildings/structure/vent-grate",
  name: "Grille et caillebotis",
  nameEn: "Vent grate and floor grating",
  category: "buildings",
  subcategory: "structure",
  description: "Grilles de bronze du Complexe, perc\xE9es pour de vrai : grille d'a\xE9ration murale \xE0 damier d'un pixel et lueur ambre derri\xE8re (Sas), ou caillebotis de sol de 2 \xD7 2 m \xE0 quadrillage, droit ou courbe pour l'anneau autour de la fosse du C\u0153ur, praticable. Lueur ambre ou cyan, allum\xE9e, en veille ou \xE9teinte. Fiches SAS-12, COE-12.",
  tags: [
    "grille",
    "a\xE9ration",
    "ventilation",
    "caillebotis",
    "damier",
    "quadrillage",
    "bronze",
    "lueur",
    "anneau",
    "le complexe",
    "complexe",
    "ancien-tech",
    "modulaire",
    "praticable",
    "int\xE9rieur",
    "vent grate",
    "air vent",
    "floor grating",
    "checkerboard",
    "grid",
    "glow",
    "curved ring",
    "ancient complex",
    "ancient-tech",
    "modular",
    "walkable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; murale : origine au sol au pied du mur (mur en z = 0, la grille regarde +z), centre \xE0 `height` ; caillebotis : origine au sol, au centre, dessus \xE0 0,06 m ; courbe : l'anneau a son centre en z = +radius + 1 (c\xF4t\xE9 +z)",
  footprint: { radius: 1.45, height: 1.1 },
  animated: [],
  params: params8,
  variants: variantsOf("model", params8.model)
};
function create8(given = {}) {
  const p = resolveParams(meta8.params, given);
  const rng = createRng(p.seed * 7919 + 67);
  const bronze = [];
  const glowParts = [];
  const patina = () => rng.range(-0.12, 0.08);
  if (p.model === "wall") {
    const S = 0.8, T2 = 0.1, h = p.height;
    const zFront = T2;
    const f = PX * 2;
    bronze.push(withTone(buildBlock([S, f, T2], [0, h + S / 2 - f / 2, T2 / 2]), 0.1));
    bronze.push(withTone(buildBlock([S, f, T2], [0, h - S / 2 + f / 2, T2 / 2]), -0.05));
    for (const s of [-1, 1]) bronze.push(withTone(buildBlock([f, S - 2 * f, T2], [s * (S / 2 - f / 2), h, T2 / 2]), 0));
    bronze.push(withTone(buildBlock([S - 2 * f, S - 2 * f, 0.01], [0, h, 5e-3]), -0.8));
    const inner = S - 2 * f;
    const n = Math.floor(inner / PX);
    const cell = inner / n;
    const bent = rng.int(0, n - 1);
    const broken = new Set(Array.from({ length: rng.int(0, 3) }, () => `${rng.int(1, n - 2)},${rng.int(1, n - 2)}`));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i + j) % 2 || broken.has(`${i},${j}`)) continue;
        const x = -inner / 2 + (i + 0.5) * cell, y = h - inner / 2 + (j + 0.5) * cell;
        const dent = j === bent && i > n * 0.3 && i < n * 0.7 ? 0.012 : 0;
        bronze.push(withTone(buildBlock([cell * 1.02, cell * 1.02, 0.02], [x, y, zFront - 0.02 - dent]), j / n * 0.12 - 0.08 - (dent ? 0.2 : 0)));
      }
    }
    const missing = rng.chance(0.35) ? rng.int(0, 3) : -1;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], k) => {
      const pos = [sx * (S / 2 - f / 2), h + sy * (S / 2 - f / 2), zFront];
      if (k === missing) bronze.push(withTone(buildBlock([PX * 0.8, PX * 0.8, 4e-3], [pos[0], pos[1], zFront + 2e-3]), -0.9));
      else bronze.push(withTone(orient(plain(new THREE11.CylinderGeometry(PX * 0.7, PX * 0.8, 0.03, 6)), [pos[0], pos[1], zFront + 0.015], [0, 0, 1]), 0.35));
    });
    glowParts.push(buildBlock([inner, inner, 5e-3], [0, h, 0.03]));
  } else if (p.model === "floor") {
    const S = 2 - PX, T2 = 0.06;
    const f = PX * 1.5;
    for (const s of [-1, 1]) {
      bronze.push(withTone(buildBlock([S, T2, f], [0, T2 / 2, s * (S / 2 - f / 2)]), 0.05));
      bronze.push(withTone(buildBlock([f, T2, S - 2 * f], [s * (S / 2 - f / 2), T2 / 2, 0]), 0));
    }
    const step = PX * 2;
    const n = Math.round((S - 2 * f) / step);
    const pitch = (S - 2 * f) / n;
    for (let i = 1; i < n; i++) {
      const x = -S / 2 + f + i * pitch;
      const dark = rng.chance(0.12) ? -0.3 : 0;
      bronze.push(withTone(buildBlock([PX * 0.5, T2 - 5e-3, S - 2 * f], [x + rng.range(-6e-3, 6e-3), (T2 - 5e-3) / 2, 0]), patina() + dark));
    }
    const gone = rng.int(1, n - 1);
    const goneToo = rng.chance(0.5) ? gone : -1;
    for (let j = 1; j < n; j++) {
      if (j === goneToo) continue;
      const z = -S / 2 + f + j * pitch;
      bronze.push(withTone(buildBlock([S - 2 * f, T2 * 0.5, PX * 0.5], [0, T2 - T2 * 0.25, z]), patina() - 0.1));
    }
    glowParts.push(buildBlock([S - 2 * f, 4e-3, S - 2 * f], [0, 2e-3, 0]));
  } else {
    const R0 = p.radius, R1 = p.radius + 2 - PX, T2 = 0.06;
    const Rm = (R0 + R1) / 2;
    const span = 2 / Rm;
    const cz = Rm;
    const point = (r, a, y) => new THREE11.Vector3(Math.sin(a) * r, y, cz - Math.cos(a) * r);
    const arc = (r, y, w, h, tone, segments) => {
      for (let k = 0; k < segments; k++) {
        const a0 = -span / 2 + k / segments * span, a1 = -span / 2 + (k + 1) / segments * span;
        bronze.push(withTone(beam(point(r, a0, y), point(r, a1, y), w, h), tone));
      }
    };
    const f = PX * 1.5;
    arc(R0 + f / 2, T2 / 2, f, T2, 0.05, 8);
    arc(R1 - f / 2, T2 / 2, f, T2, 0.05, 8);
    for (const s of [-1, 1]) bronze.push(withTone(beam(point(R0, s * span / 2, T2 / 2), point(R1, s * span / 2, T2 / 2), f, T2), 0));
    const radials = Math.round(Rm * span / (PX * 2));
    for (let i = 1; i < radials; i++) {
      const a = -span / 2 + i / radials * span;
      bronze.push(withTone(beam(point(R0 + f, a, (T2 - 5e-3) / 2), point(R1 - f, a, (T2 - 5e-3) / 2), PX * 0.5, T2 - 5e-3), patina() + (rng.chance(0.12) ? -0.3 : 0)));
    }
    const rings = Math.round((R1 - R0 - 2 * f) / (PX * 2));
    const gone = rng.chance(0.5) ? rng.int(1, rings - 1) : -1;
    for (let j = 1; j < rings; j++) if (j !== gone) arc(R0 + f + j / rings * (R1 - R0 - 2 * f), T2 - T2 * 0.25, PX * 0.5, T2 * 0.5, patina() - 0.1, 6);
    const shape = [];
    const segs = 10;
    for (let k = 0; k <= segs; k++) shape.push(point(R0 + f, -span / 2 + k / segs * span, 0));
    for (let k = segs; k >= 0; k--) shape.push(point(R1 - f, -span / 2 + k / segs * span, 0));
    const positions = [], normals = [], index = [];
    for (const v of shape) positions.push(v.x, 2e-3, v.z), normals.push(0, 1, 0);
    const m = segs + 1;
    for (let k = 0; k < segs; k++) {
      const a = k, b = k + 1, c = 2 * m - 1 - (k + 1), d = 2 * m - 1 - k;
      index.push(a, b, c, a, c, d);
    }
    const g = new THREE11.BufferGeometry();
    g.setAttribute("position", new THREE11.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE11.Float32BufferAttribute(normals, 3));
    g.setIndex(index);
    glowParts.push(g);
  }
  const group = new THREE11.Group();
  group.name = meta8.name;
  const metal = new THREE11.Mesh(mergeToned(bronze), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  metal.name = "grate";
  metal.castShadow = true;
  metal.receiveShadow = true;
  group.add(metal);
  const level = LEVELS4[p.light];
  const glow = new THREE11.Mesh(mergeToned(glowParts), glowMaterial(p.glow, { level, id: 40 }));
  glow.name = "glow";
  if (level === 0) glow.visible = p.model === "wall";
  group.add(glow);
  if (p.model !== "wall") group.userData.walkable = { top: 0.06 };
  group.userData.asset = { id: meta8.id, params: p };
  return group;
}

// src/assets/furniture/lighting/filament-lamp.js
var filament_lamp_exports = {};
__export(filament_lamp_exports, {
  create: () => create9,
  dispose: () => disposeObject,
  meta: () => meta9,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE12 from "three";
var MOUNTS = { hanging: "Suspendue (cha\xEEne)", wall: "Applique murale" };
var STATES3 = { lit: "Allum\xE9e", dim: "En veille", off: "\xC9teinte" };
var HALOS = { off: "Sans halo", on: "\xC9claire le d\xE9cor (dans le noir)" };
var BASE2 = { lit: 2, dim: 1, off: 0 };
var params9 = {
  seed: seedParam("Change le galbe de la cage, un barreau tordu ou manquant, le ton du bronze, le rythme du scintillement."),
  mount: choiceParam("Pose", MOUNTS, "Suspendue \xE0 une cha\xEEne (Sas), ou applique sur une console murale (Galerie, une par trav\xE9e)."),
  state: choiceParam("\xC9tat", STATES3, "Allum\xE9e (scintillement lent), en veille (lueur faible) ou \xE9teinte (verre ambre sombre)."),
  glow: glowParam("Couleur du filament."),
  halo: choiceParam("Halo", HALOS, "\xC9claire le d\xE9cor autour d'elle dans le noir (lumi\xE8re de halo : 12 pour toute la sc\xE8ne)."),
  height: numberParam("Hauteur", 2.6, 1.2, 12, "Hauteur de l'ampoule au-dessus du sol (2,6 m pour une applique de Galerie).", { step: 0.1, unit: "m" }),
  chain: numberParam("Cha\xEEne", 1.2, 0.2, 4, "Longueur de la cha\xEEne au-dessus de la cage (lampe suspendue).", { step: 0.1, unit: "m" })
};
var meta9 = {
  id: "furniture/lighting/filament-lamp",
  name: "Lampe \xE0 filament",
  nameEn: "Filament cage lamp",
  category: "furniture",
  subcategory: "lighting",
  description: "Lampe du Complexe : une ampoule ronde ambre dans une cage de huit barreaux de bronze, au chapeau conique ; suspendue \xE0 une cha\xEEne ou en applique sur une console murale. Le filament scintille lentement par paliers ; allum\xE9e, en veille ou \xE9teinte ; peut \xE9clairer le d\xE9cor dans le noir. Fiches SAS-05, GAL-05.",
  tags: [
    "lampe",
    "ampoule",
    "filament",
    "cage",
    "applique",
    "suspension",
    "cha\xEEne",
    "bronze",
    "ambre",
    "scintillement",
    "le complexe",
    "complexe",
    "ancien-tech",
    "\xE9clairage",
    "lumineux",
    "anim\xE9",
    "int\xE9rieur",
    "lamp",
    "light bulb",
    "cage lamp",
    "wall sconce",
    "pendant lamp",
    "amber",
    "flicker",
    "ancient complex",
    "ancient-tech",
    "lighting",
    "glowing",
    "animated",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, \xE0 l'aplomb de l'ampoule (suspendue) ou au pied du mur (applique : le mur est en z = 0, la lampe avance vers +z) ; `height` = hauteur de l'ampoule",
  footprint: { radius: 0.5, height: 4.2 },
  animated: ["flicker", "glow"],
  params: params9,
  variants: variantsOf("mount", params9.mount)
};
function create9(given = {}) {
  const p = resolveParams(meta9.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const wall = p.mount === "wall";
  const c = new THREE12.Vector3(0, p.height, wall ? 0.32 : 0);
  const bronzeParts = [];
  const bars = 8;
  const bulge = shape.range(0.14, 0.17);
  const r0 = 0.09, y0 = c.y - 0.2, y1 = c.y + 0.18;
  const bent = shape.int(0, bars - 1);
  const missing = shape.chance(0.3) ? (bent + shape.int(2, 5)) % bars : -1;
  const spin = shape.range(0, Math.PI / bars);
  for (let i = 0; i < bars; i++) {
    if (i === missing) continue;
    const a = spin + i / bars * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const kink = i === bent ? shape.range(0.02, 0.04) : 0;
    const pts = [[r0, y0], [bulge + kink, c.y - 0.06], [bulge, c.y + 0.06], [r0 + 0.02, y1]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [ra, ya] = pts[k], [rb, yb] = pts[k + 1];
      bronzeParts.push(beam([c.x + dx * ra, ya, c.z + dz * ra], [c.x + dx * rb, yb, c.z + dz * rb], PX * 0.6, PX * 0.6));
    }
  }
  bronzeParts.push(withTone(ring({ radius: r0 - PX * 0.6, y: y0 - PX, height: PX * 1.4, thickness: PX, segments: 8 }).translate(c.x, 0, c.z), 0.1));
  bronzeParts.push(buildLathe([[0, y0 - 0.1], [0.03, y0 - 0.03], [0.03, y0], [0, y0]], { segments: 6, facets: true }).translate(c.x, 0, c.z));
  bronzeParts.push(withTone(buildLathe([[0, y1], [0.17, y1], [0.17, y1 + 0.03], [0.06, y1 + 0.11], [0, y1 + 0.11]], { segments: 10, facets: true }).translate(c.x, 0, c.z), 0.05));
  bronzeParts.push(withTone(buildLathe([[0, c.y + 0.06], [0.04, c.y + 0.06], [0.04, y1], [0, y1]], { segments: 6, facets: true }).translate(c.x, 0, c.z), -0.2));
  const eye = ring({ radius: 0.025, height: PX * 0.7, thickness: PX * 0.7, segments: 6 });
  eye.rotateX(Math.PI / 2);
  eye.translate(c.x, y1 + 0.15, c.z);
  bronzeParts.push(eye);
  const top = y1 + 0.18;
  if (wall) {
    const armY = top + 0.08;
    bronzeParts.push(withTone(buildBlock([0.14, 0.24, PX], [0, armY - 0.04, PX / 2]), 0.1));
    bronzeParts.push(beam([0, armY, PX], [0, armY, c.z + 0.02], PX * 1.2, PX * 1.4));
    bronzeParts.push(beam([0, armY - 0.18, PX], [0, armY - 0.02, c.z * 0.55], PX, PX));
    bronzeParts.push(beam([0, armY, c.z], [0, top - 0.02, c.z], PX * 0.8, PX * 0.8));
  } else {
    const end = top + p.chain;
    bronzeParts.push(chain([c.x, top, c.z], [c.x, end, c.z], { sag: 0, link: 0.07 }));
    bronzeParts.push(withTone(buildLathe([[0, end], [0.09, end], [0.09, end + 0.03], [0, end + 0.05]], { segments: 8, facets: true }), 0.1));
  }
  const group = new THREE12.Group();
  group.name = meta9.name;
  const bronze = new THREE12.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronze.name = "cage";
  bronze.castShadow = true;
  group.add(bronze);
  const glass = withShade(bulb({ radius: PX * 1.35, position: c, segments: 6 }), BASE2[p.state], 4);
  const glowMaterial2 = glowMixMaterial(glowLevels(p.glow), { id: 31 });
  const light = new THREE12.Mesh(glass, glowMaterial2);
  light.name = "bulb";
  group.add(light);
  const flicker = createFlicker(glass, [{ start: 0, count: glass.attributes.position.count, base: BASE2[p.state], phase: shape.next() }]);
  const halo = p.halo === "on" && p.state !== "off" ? createGlowLight() : null;
  if (halo) glowMaterial2.addEventListener("dispose", () => halo.release());
  const haloColor = rgb(GLOWS[p.glow].light);
  const haloAt = new THREE12.Vector3();
  const reach = p.state === "lit" ? 3 : 1.8;
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      flicker(time);
    }
    baseUpdate(force);
    if (halo) {
      const level = glass.attributes.aShade.array[0] * 4 - 0.5;
      halo.set(group.localToWorld(haloAt.copy(c)), haloColor, reach * (0.85 + 0.08 * level), 1.1 + 0.15 * level);
    }
  };
  group.userData.asset = { id: meta9.id, params: p };
  group.userData.lightPoint = c.clone();
  return group;
}

// src/assets/furniture/seating/stone-bench.js
var stone_bench_exports = {};
__export(stone_bench_exports, {
  create: () => create10,
  dispose: () => disposeObject,
  meta: () => meta10,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE13 from "three";
var MODELS3 = {
  sas: "Sas (2,2 m, accoudoirs, dossier sangl\xE9)",
  gallery: "Galerie (1,2 m, pieds de bronze)",
  meditation: "M\xE9ditation (1,6 m, coussin de cuir)",
  maintenance: "Maintenance (1,2 m, anneaux, huile)"
};
var SIZES = { sas: [2.2, 0.55, 0.45], gallery: [1.2, 0.4, 0.45], meditation: [1.6, 0.45, 0.4], maintenance: [1.2, 0.6, 0.45] };
var params10 = {
  seed: seedParam("Change le d\xE9coupage de l'assise en blocs, l'angle \xE9corn\xE9, la place de l'usure, de la sangle et des taches."),
  model: choiceParam("Mod\xE8le", MODELS3, "Banc du Sas, de galerie, de m\xE9ditation (Oracle) ou de maintenance (salle de l'\xC9veil)."),
  stone: stoneParam("Pierre du banc.", { only: ["smoked", "blackBasalt"] })
};
var meta10 = {
  id: "furniture/seating/stone-bench",
  name: "Banc de pierre",
  nameEn: "Stone bench",
  category: "furniture",
  subcategory: "seating",
  description: "Banc du Complexe taill\xE9 dans la pierre fum\xE9e, ar\xEAtes us\xE9es et assise polie au centre. Quatre mod\xE8les : le banc du Sas (accoudoirs de bronze, dossier bas sangl\xE9 de cuir), le banc de galerie sur pieds de bronze, le banc de m\xE9ditation \xE0 coussin de cuir noir, le banc de maintenance \xE0 anneaux d'attache et taches d'huile. Fiches SAS-06, GAL-07, ORA-10, E5-02.",
  tags: [
    "banc",
    "assise",
    "si\xE8ge",
    "pierre fum\xE9e",
    "bronze",
    "cuir",
    "accoudoirs",
    "coussin",
    "usure",
    "le complexe",
    "complexe",
    "ancien-tech",
    "mobilier",
    "s'asseoir",
    "int\xE9rieur",
    "bench",
    "seat",
    "smoked stone",
    "armrests",
    "cushion",
    "wear",
    "ancient complex",
    "ancient-tech",
    "furniture",
    "sit",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au centre ; le banc est le long de x, on s'y assoit face \xE0 +z (dossier c\xF4t\xE9 \u2212z)",
  footprint: { radius: 1.2, height: 0.72 },
  animated: [],
  params: params10,
  variants: variantsOf("model", params10.model)
};
function create10(given = {}) {
  const p = resolveParams(meta10.params, given);
  const stone = STONES[p.stone];
  const rng = createRng(p.seed * 7919 + 31);
  const noise = createNoise3(p.seed + 11);
  const [L2, D, H] = SIZES[p.model];
  const stoneParts = [];
  const bronzeParts = [];
  const leatherParts = [];
  const seatThick = p.model === "gallery" ? 0.14 : p.model === "meditation" ? H - 0.04 - 0.07 : H - 0.06;
  const seatTop = p.model === "meditation" ? H - 0.07 : H;
  const seatBottom = seatTop - seatThick;
  const count = p.model === "sas" ? rng.int(1, 3) : p.model === "gallery" ? 1 : rng.int(1, 2);
  const cuts = [-L2 / 2];
  for (let i = 1; i < count; i++) cuts.push(-L2 / 2 + L2 * i / count + rng.range(-0.12, 0.12));
  cuts.push(L2 / 2);
  const wearX = rng.range(-0.2, 0.2) * L2;
  const wearForce = p.model === "gallery" ? 0.55 : p.model === "meditation" ? 0 : 0.4;
  const oily = p.model === "maintenance";
  const chipCorner = rng.int(0, 3);
  for (let i = 0; i < count; i++) {
    const x0 = cuts[i] + (i ? PX / 2 : 0), x1 = cuts[i + 1] - (i < count - 1 ? PX / 2 : 0);
    const lift = rng.int(-1, 1) * PX / 4;
    const blockTone = rng.range(-0.07, 0.07);
    const top = seatTop + lift;
    const tone = (x, y, z) => {
      let t = blockTone;
      if (y > top - 0.01) {
        t -= 0.17;
        const u = (x - wearX) / (L2 * 0.32), v = (z - D * 0.05) / (D * 0.45);
        t += wearForce * Math.max(0, 1 - Math.hypot(u, v)) ** 0.8;
      } else if (y < seatBottom + 0.05) t -= 0.12;
      if (oily) t -= 0.35 * THREE13.MathUtils.smoothstep(noise(x * 2.6, y * 2.6 + 4, z * 2.6), 0.64, 0.72);
      return t;
    };
    stoneParts.push(withTone(gridBlock([x1 - x0, seatThick + lift, D], [(x0 + x1) / 2, seatBottom + (seatThick + lift) / 2, 0], { cell: 0.11 }), tone));
  }
  if (count > 1) stoneParts.push(withTone(buildBlock([L2 - 0.04, seatThick - 0.03, D - 0.04], [0, seatBottom + (seatThick - 0.03) / 2, 0]), -0.55));
  {
    const sx = chipCorner === 1 || chipCorner === 2 ? 1 : -1;
    const sz = chipCorner < 2 ? 1 : -1;
    const w = rng.range(0.08, 0.16), d = rng.range(0.06, 0.12);
    stoneParts.push(withTone(buildBlock([w, PX * 0.6, d], [sx * (L2 / 2 - w / 2 + 4e-3), seatTop + 2e-3, sz * (D / 2 - d / 2 + 4e-3)]), 0.35));
  }
  if (p.model !== "gallery") {
    const plinth = p.model === "meditation" ? 0 : 0.06;
    if (plinth > 0) stoneParts.push(withTone(buildBlock([L2 - 0.08, plinth, D - 0.08], [0, plinth / 2, 0]), -0.4));
  }
  if (p.model === "sas") {
    const backD = 0.12;
    const zb = -D / 2 + backD / 2;
    stoneParts.push(withTone(gridBlock([L2 - 0.24, 0.25, backD], [0, seatTop + 0.125, zb], { cell: 0.12 }), (x, y) => y > seatTop + 0.24 ? 0.12 : -0.05));
    const strapX = rng.range(-0.35, 0.35) * L2;
    const strapW = 0.07;
    leatherParts.push(buildBlock([strapW, 0.26, backD + 0.02], [strapX, seatTop + 0.125, zb]));
    leatherParts.push(buildBlock([strapW, 0.02, backD + 0.02], [strapX, seatTop + 0.255, zb]));
    bronzeParts.push(withTone(buildBlock([strapW + 0.02, 0.05, PX * 0.4], [strapX, seatTop + 0.15, zb + backD / 2 + 0.012]), 0.3));
    for (const s of [-1, 1]) {
      const x = s * (L2 / 2 - 0.06);
      bronzeParts.push(withTone(buildBlock([0.08, 0.2, D - 0.08], [x, seatTop + 0.1, 0.02]), -0.05));
      bronzeParts.push(withTone(buildBlock([0.1, 0.04, D - 0.04], [x, seatTop + 0.22, 0.02]), 0.15));
      const scroll = plain(new THREE13.CylinderGeometry(0.06, 0.06, 0.1, 8));
      bronzeParts.push(orient(scroll, [x, seatTop + 0.19, D / 2 - 0.02], [1, 0, 0]));
      bronzeParts.push(withTone(buildBlock([0.1, PX, PX * 0.5], [x, seatTop + 0.1, D / 2 - 0.02]), -0.6));
    }
  } else if (p.model === "gallery") {
    const legH = seatBottom;
    for (const s of [-1, 1]) {
      const x = s * (L2 / 2 - 0.2) + rng.range(-0.02, 0.02);
      bronzeParts.push(buildBlock([0.08, legH, D - 0.12], [x, legH / 2, 0], [0, 0, 0], { taper: -0.25 }));
      bronzeParts.push(withTone(buildBlock([0.14, 0.04, D - 0.06], [x, 0.02, 0]), -0.1));
      bronzeParts.push(withTone(buildBlock([0.12, PX * 0.6, D - 0.04], [x, legH - PX * 0.3, 0]), 0.15));
    }
  } else if (p.model === "meditation") {
    for (const s of [-1, 1]) {
      bronzeParts.push(withTone(buildBlock([0.1, 0.04, D - 0.06], [s * (L2 / 2 - 0.12), 0.02, 0]), 0.05));
    }
    const cw = L2 - 0.16 - rng.range(0, 0.1), cd = D - 0.06;
    const cx = rng.range(-0.04, 0.04);
    leatherParts.push(withTone(gridBlock([cw, 0.05, cd], [cx, seatTop + 0.025, 0], { cell: 0.1 }), (x, y) => y > seatTop + 0.04 ? 0.15 : -0.1));
    leatherParts.push(withTone(buildBlock([cw - PX * 2, 0.025, cd - PX * 2], [cx, seatTop + 0.06, 0]), 0.2));
    const buttons = Math.round(cw / 0.3);
    for (let i = 0; i < buttons; i++) {
      const x = cx - cw / 2 + (i + 0.5) * cw / buttons;
      leatherParts.push(withTone(buildBlock([PX * 0.7, 6e-3, PX * 0.7], [x, seatTop + 0.074, 0]), -0.9));
    }
  } else {
    for (const s of [-1, 1]) {
      const x = s * (L2 / 2 - 0.22) + rng.range(-0.04, 0.04);
      const y = seatTop - 0.16;
      bronzeParts.push(withTone(buildBlock([0.1, 0.08, PX * 0.4], [x, y, D / 2 + PX * 0.2]), -0.05));
      const r = ring({ radius: 0.05, height: PX * 0.8, thickness: PX * 0.8, segments: 8 });
      bronzeParts.push(withTone(orient(r, [x, y - 0.06, D / 2 + PX * 0.6], [0, 0, 1]), 0.15));
    }
    const ox = rng.range(-0.3, 0.3) * L2;
    leatherParts.push(withTone(buildBlock([PX, seatTop * 0.6, 4e-3], [ox, seatTop * 0.62, D / 2 + 2e-3]), -0.2));
    leatherParts.push(withTone(buildBlock([0.22, 3e-3, 0.1], [ox + 0.04, 15e-4, D / 2 + 0.06], [0, rng.range(-0.4, 0.4), 0]), -0.2));
  }
  const group = new THREE13.Group();
  group.name = meta10.name;
  const stoneMesh = new THREE13.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: rng.int(0, 96), id: 20, grain: 0.07 }));
  stoneMesh.name = "stone";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
  if (bronzeParts.length) {
    const bronze = new THREE13.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
    bronze.name = "bronze";
    bronze.castShadow = true;
    bronze.receiveShadow = true;
    group.add(bronze);
  }
  if (leatherParts.length) {
    const leather = new THREE13.Mesh(
      mergeToned(leatherParts),
      createToonMaterial({ ramp: FABRICS.tarredLeather.ramp, ink: FABRICS.tarredLeather.ink, steps: [0.3, 0.55, 0.8], tone: true, crease: true, id: 31 })
    );
    leather.name = "leather";
    leather.castShadow = true;
    leather.receiveShadow = true;
    group.add(leather);
  }
  const seatY = p.model === "meditation" ? seatTop + 0.07 : seatTop;
  const places = Math.max(1, Math.floor((L2 - 0.2) / 0.6));
  group.userData.seats = Array.from({ length: places }, (_, i) => ({
    position: new THREE13.Vector3(-L2 / 2 + (i + 0.5) * L2 / places, seatY, 0.05),
    facing: new THREE13.Vector3(0, 0, 1)
  }));
  group.userData.asset = { id: meta10.id, params: p };
  return group;
}

// src/assets/furniture/storage/equipment-locker.js
var equipment_locker_exports = {};
__export(equipment_locker_exports, {
  create: () => create11,
  dispose: () => disposeObject,
  meta: () => meta11,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE14 from "three";
var MODELS4 = { locker: "Casier (6 compartiments)", "fuse-box": "Armoire \xE0 fusibles (24 fusibles)" };
var DOORS = { closed: "Ferm\xE9es", ajar: "Une entrouverte", open: "Toutes ouvertes" };
var SWITCHES = { on: "Sous tension", off: "Coup\xE9e" };
var SIZES2 = { locker: [1.8, 2.2, 0.4], "fuse-box": [0.8, 1.8, 0.3] };
var OILCLOTH = { ramp: ["#2a2117", "#4f3f2a", "#77623f", "#a08756"], ink: "#140f0a" };
var PORCELAIN = { ramp: ["#4f4a44", "#8a8274", "#c4baa6", "#ebe2cf"], ink: "#24201b" };
var params11 = {
  seed: seedParam("Change le mat\xE9riel rang\xE9 et les cases vides, les aiguilles, la patine, la porte entrouverte, les fusibles grill\xE9s."),
  model: choiceParam("Mod\xE8le", MODELS4, "Casier d'\xE9quipement du Sas, ou armoire \xE0 fusibles de la salle du C\u0153ur."),
  doors: choiceParam("Portes", DOORS, "Ferm\xE9es (par d\xE9faut), une entrouverte choisie par la graine, ou toutes ouvertes. Pilotable : group.userData.locker."),
  power: choiceParam("Levier de coupure", SWITCHES, "Armoire \xE0 fusibles : levier lev\xE9 (sous tension) ou abaiss\xE9 (coup\xE9e).")
};
var meta11 = {
  id: "furniture/storage/equipment-locker",
  name: "Casier d'\xE9quipement",
  nameEn: "Equipment locker",
  category: "furniture",
  subcategory: "storage",
  description: "Casier mural du Complexe : caisson de bronze \xE0 portes grillag\xE9es de laiton, cadran et molette sur chaque porte, mat\xE9riel devin\xE9 derri\xE8re la grille. Casier du Sas (6 compartiments) ou armoire \xE0 fusibles du C\u0153ur (24 fusibles de porcelaine, levier de coupure). Portes ferm\xE9es par d\xE9faut, ouvertes une \xE0 une par le sc\xE9nario. Fiches SAS-07, COE-10.",
  tags: [
    "casier",
    "armoire",
    "vestiaire",
    "fusibles",
    "grillage",
    "laiton",
    "bronze",
    "cadran",
    "levier",
    "porcelaine",
    "le complexe",
    "complexe",
    "ancien-tech",
    "rangement",
    "pilotable",
    "int\xE9rieur",
    "locker",
    "cabinet",
    "fuse box",
    "mesh door",
    "brass",
    "gauge",
    "switch lever",
    "porcelain fuses",
    "ancient complex",
    "ancient-tech",
    "storage",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au milieu du dos (le mur est en z = 0, les portes regardent +z)",
  footprint: { radius: 1.45, height: 2.2 },
  animated: ["locker"],
  params: params11,
  variants: variantsOf("model", params11.model)
};
function create11(given = {}) {
  const p = resolveParams(meta11.params, given);
  const fuse = p.model === "fuse-box";
  const rng = createRng(p.seed * 7919 + 43);
  const [W, H, D] = SIZES2[p.model];
  const bronzeParts = [];
  const contentParts = [];
  const t = 0.04;
  const plinth = fuse ? 0.25 : 0.12;
  const box = (size, pos, tone = 0) => bronzeParts.push(withTone(buildBlock(size, pos), tone));
  box([W, H - plinth, t], [0, plinth + (H - plinth) / 2, t / 2], -0.55);
  for (const s of [-1, 1]) box([t, H - plinth, D], [s * (W / 2 - t / 2), plinth + (H - plinth) / 2, D / 2], rng.range(-0.05, 0.05));
  box([W + 0.06, 0.06, D + 0.04], [0, H - 0.03, D / 2 + 0.01], 0.1);
  box([W - 0.08, plinth, D - 0.06], [0, plinth / 2, D / 2 - 0.02], -0.35);
  box([W, t, D], [0, plinth + t / 2, D / 2]);
  bronzeParts.push(withTone(rivetRow([-W / 2 + 0.06, H - 0.03, D + 0.03], [W / 2 - 0.06, H - 0.03, D + 0.03], { spacing: 0.2, size: PX * 0.8 }), 0.25));
  const cols = fuse ? 1 : 3;
  const rows = fuse ? 1 : 2;
  const innerW = W - 2 * t, innerH = H - plinth - 2 * t - 0.06;
  const cellW = innerW / cols, cellH = innerH / rows;
  const y0 = plinth + t;
  for (let c = 1; c < cols; c++) box([PX, innerH, D - 0.02], [-innerW / 2 + c * cellW, y0 + innerH / 2, D / 2], -0.1);
  for (let r = 1; r < rows; r++) box([innerW, PX * 1.2, D - 0.02], [0, y0 + r * cellH, D / 2], -0.1);
  box([innerW, 0.06, D], [0, H - 0.09, D / 2], 0.05);
  const zIn = t + 0.02;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: -innerW / 2 + (c + 0.5) * cellW, y: y0 + r * cellH, w: cellW, h: cellH });
  if (!fuse) {
    for (const cell of cells) {
      const kind = rng.pick(["empty", "coat", "coat", "boots", "coils"]);
      const { x, y, w, h } = cell;
      if (kind === "coat") {
        contentParts.push(withTone(buildBlock([PX * 2, PX, PX], [x, y + h - 0.12, zIn + 0.1]), 0.3));
        contentParts.push(withTone(buildBlock([w * 0.55, h * 0.62, 0.1], [x + rng.range(-0.04, 0.04), y + h - 0.16 - h * 0.31, zIn + 0.12], [0, 0, 0], { taper: -0.2 }), rng.range(-0.05, 0.15)));
        contentParts.push(withTone(buildBlock([w * 0.6, PX * 0.6, 0.11], [x, y + h - 0.16 - h * 0.25, zIn + 0.12]), -0.4));
      } else if (kind === "boots") {
        for (const s of [-1, 1]) contentParts.push(withTone(buildBlock([0.1, 0.24, 0.16], [x + s * 0.08, y + 0.12, zIn + 0.12]), s > 0 ? 0.1 : -0.1));
        contentParts.push(withTone(orient(plain(new THREE14.CylinderGeometry(0.05, 0.06, 0.16, 6)), [x, y + h * 0.55, zIn + 0.12], [0, 1, 0]), 0.4));
      } else if (kind === "coils") {
        const n = rng.int(2, 3);
        for (let i = 0; i < n; i++) {
          const g = plain(new THREE14.TorusGeometry(0.1, 0.035, 4, 8));
          contentParts.push(withTone(orient(g, [x + (i - (n - 1) / 2) * 0.12, y + 0.1 + i * 0.05, zIn + 0.14], [0, 0, 1]), i % 2 ? -0.1 : 0.15));
        }
      }
    }
  } else {
    const fx = 4, fy = 6;
    for (let j = 0; j < fy; j++) {
      const y = y0 + 0.18 + j * ((innerH - 0.36) / (fy - 1));
      box([innerW - 0.12, PX * 0.8, PX], [0, y, zIn + 0.03], 0.1);
      for (let i = 0; i < fx; i++) {
        const x = -innerW / 2 + 0.14 + i * ((innerW - 0.28) / (fx - 1));
        const dead = rng.chance(0.12);
        contentParts.push(withTone(buildBlock([PX * 2, PX * 1.2, 0.07], [x, y, zIn + 0.08]), dead ? -1.1 : rng.range(-0.05, 0.1)));
      }
    }
  }
  const brassParts = [];
  const doorRanges = [];
  let vertexCount = 0;
  const zDoor = D + 0.012;
  for (const cell of cells) {
    const { x, y, w, h } = cell;
    const dw = w - 0.02, dh = h - 0.02;
    const left = x - dw / 2, cy = y + h / 2;
    const parts = [];
    const f = PX * 1.2;
    parts.push(buildBlock([dw, f, 0.02], [x, cy - dh / 2 + f / 2, zDoor]));
    parts.push(buildBlock([dw, f, 0.02], [x, cy + dh / 2 - f / 2, zDoor]));
    parts.push(buildBlock([f, dh, 0.02], [left + f / 2, cy, zDoor]));
    parts.push(buildBlock([f, dh, 0.02], [left + dw - f / 2, cy, zDoor]));
    const step = PX * 2;
    const nx = Math.floor((dw - 2 * f) / step), ny = Math.floor((dh - 2 * f) / step);
    for (let i = 1; i < nx; i++) parts.push(withTone(buildBlock([PX * 0.5, dh - 2 * f, 8e-3], [left + f + i * ((dw - 2 * f) / nx), cy, zDoor]), -0.15));
    for (let j = 1; j < ny; j++) parts.push(withTone(buildBlock([dw - 2 * f, PX * 0.5, 8e-3], [x, cy - dh / 2 + f + j * ((dh - 2 * f) / ny), zDoor + 6e-3]), -0.05));
    const px = left + dw - f - 0.07;
    const py = fuse ? cy + 0.1 : cy + dh * 0.12;
    parts.push(withTone(buildBlock([0.13, 0.2, 0.012], [px, py, zDoor + 0.012]), 0.1));
    const d = dial({ radius: PX * 1.1, position: [px, py + 0.04, zDoor + 0.018], normal: [0, 0, 1], ticks: 6, needle: rng.range(-2, 2), depth: PX * 0.3 });
    parts.push(withTone(d.face, 0.6), withTone(d.marks, -1));
    parts.push(withTone(orient(plain(new THREE14.CylinderGeometry(PX * 0.6, PX * 0.6, 0.03, 6)), [px, py - 0.05, zDoor + 0.02], [0, 0, 1]), 0.4));
    for (const k of [-1, 1]) parts.push(withTone(buildBlock([PX, PX * 1.6, 0.03], [left, cy + k * dh * 0.36, zDoor]), -0.4));
    const merged = mergeToned(parts.map((g) => g.attributes.aTone ? g : withTone(g, 0)));
    const count = merged.attributes.position.count;
    doorRanges.push({ start: vertexCount, count, hingeX: left, hingeZ: zDoor });
    vertexCount += count;
    brassParts.push(merged);
  }
  if (fuse) {
    const l = lever({ length: 0.22, angle: p.power === "on" ? -0.5 : 2.2, position: [W / 2, H * 0.62, D * 0.55], normal: [1, 0, 0], width: PX });
    bronzeParts.push(withTone(buildBlock([0.012, 0.32, 0.14], [W / 2 + 6e-3, H * 0.62, D * 0.55]), -0.15));
    bronzeParts.push(withTone(l.rod, 0.15), withTone(l.knob, -0.5));
    box([0.24, 0.06, 0.01], [0, H - 0.12, D + 0.02], 0.3);
  }
  const group = new THREE14.Group();
  group.name = meta11.name;
  const body = new THREE14.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  body.name = "body";
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const brassGeometry = mergeToned(brassParts);
  const doors = new THREE14.Mesh(brassGeometry, metalMaterial(METALS.blackenedBrass, { id: 31, tone: true }));
  doors.name = "doors";
  doors.castShadow = true;
  group.add(doors);
  if (contentParts.length) {
    const entry = fuse ? PORCELAIN : OILCLOTH;
    const content = new THREE14.Mesh(mergeToned(contentParts), createToonMaterial({ ramp: entry.ramp, ink: entry.ink, steps: [0.3, 0.55, 0.8], tone: true, crease: true, id: 32 }));
    content.name = "content";
    content.castShadow = true;
    content.receiveShadow = true;
    group.add(content);
  }
  const position = brassGeometry.attributes.position;
  const normal = brassGeometry.attributes.normal;
  const basePos = position.array.slice();
  const baseNormal = normal.array.slice();
  const MAX = THREE14.MathUtils.degToRad(105);
  const open = doorRanges.map(() => 0);
  const pose = (i) => {
    const { start, count, hingeX, hingeZ } = doorRanges[i];
    const a = -open[i] * MAX;
    const c = Math.cos(a), s = Math.sin(a);
    for (let k = start; k < start + count; k++) {
      const x = basePos[k * 3] - hingeX, z = basePos[k * 3 + 2] - hingeZ;
      position.setXYZ(k, hingeX + x * c + z * s, basePos[k * 3 + 1], hingeZ - x * s + z * c);
      const nx = baseNormal[k * 3], nz = baseNormal[k * 3 + 2];
      normal.setXYZ(k, nx * c + nz * s, baseNormal[k * 3 + 1], -nx * s + nz * c);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    brassGeometry.computeBoundingSphere();
  };
  const locker = {
    count: doorRanges.length,
    open,
    setOpen(i, value) {
      if (i < 0 || i >= open.length) return;
      open[i] = THREE14.MathUtils.clamp(value, 0, 1);
      pose(i);
    },
    setAll(value) {
      for (let i = 0; i < open.length; i++) locker.setOpen(i, value);
    }
  };
  if (p.doors === "open") locker.setAll(1);
  else if (p.doors === "ajar") locker.setOpen(rng.int(0, open.length - 1), 0.35);
  group.userData.locker = locker;
  group.userData.asset = { id: meta11.id, params: p };
  return group;
}

// src/assets/furniture/storage/travel-trunk.js
var travel_trunk_exports = {};
__export(travel_trunk_exports, {
  create: () => create12,
  dispose: () => disposeObject,
  meta: () => meta12,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE15 from "three";
var SIZES3 = { standard: "Malle (0,80 m)", small: "Coffret (0,50 m)", large: "Grande malle (1,10 m)" };
var DIMS = { small: [0.5, 0.32, 0.3], standard: [0.8, 0.5, 0.45], large: [1.1, 0.62, 0.6] };
var STATES4 = { closed: "Ferm\xE9e", ajar: "Entrouverte", open: "Ouverte" };
var OPENNESS = { closed: 0, ajar: 0.22, open: 1 };
var CONTENTS = { cassettes: "Cassettes de verre", tools: "Outils (lampe, cl\xE9, toile)", empty: "Vide" };
var OPEN_ANGLE2 = 110 * Math.PI / 180;
var LID = 0;
var FIXED2 = 255;
var OILCLOTH2 = { ramp: ["#2a2117", "#4f3f2a", "#77623f", "#a08756"], ink: "#140f0a" };
var params12 = {
  seed: seedParam("Change les planches et leurs tons, l'usure, l'\xE9tiquette (place et glyphe), une sangle d\xE9tach\xE9e, ce qui manque dans le contenu."),
  state: choiceParam("Couvercle", STATES4, "Ferm\xE9, entrouvert ou ouvert \xE0 110\xB0. Pilotable : group.userData.trunk.setOpen(t)."),
  size: choiceParam("Taille", SIZES3, "Coffret (0,50 \xD7 0,32 \xD7 0,30 m), malle (0,80 \xD7 0,50 \xD7 0,45 m) ou grande malle (1,10 \xD7 0,62 \xD7 0,60 m)."),
  content: choiceParam("Contenu", CONTENTS, "Ce qu'on voit quand elle est ouverte : des cassettes de verre rang\xE9es, des outils (lampe portative, cl\xE9, rouleau de toile), ou rien.")
};
var meta12 = {
  id: "furniture/storage/travel-trunk",
  name: "Malle de transport",
  nameEn: "Travel trunk",
  category: "furniture",
  subcategory: "storage",
  description: "Malle du Complexe en bois noirci \xE0 couvercle bomb\xE9, corni\xE8res et sangles de laiton, serrure et \xE9tiquette grav\xE9e. Ferm\xE9e, entrouverte ou ouverte sur son feutre et son casier, avec des cassettes de verre ou des outils. Coffret, malle ou grande malle. Fiche SAS-13.",
  tags: [
    "malle",
    "coffre",
    "bagage",
    "couvercle",
    "bois noirci",
    "laiton",
    "sangles",
    "serrure",
    "\xE9tiquette",
    "cassettes",
    "le complexe",
    "complexe",
    "ancien-tech",
    "rangement",
    "pilotable",
    "int\xE9rieur",
    "trunk",
    "chest",
    "luggage",
    "lid",
    "blackened wood",
    "brass",
    "straps",
    "lock",
    "tag",
    "data cassettes",
    "ancient complex",
    "ancient-tech",
    "storage",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au centre ; la serrure regarde +z, les charni\xE8res sont derri\xE8re (\u2212z)",
  footprint: { radius: 0.6, height: 0.9 },
  animated: ["trunk"],
  params: params12,
  variants: variantsOf("state", params12.state)
};
function create12(given = {}) {
  const p = resolveParams(meta12.params, given);
  const rng = createRng(p.seed * 7919 + 59);
  const [W, D, H] = DIMS[p.size];
  const bodyH = H * 0.7;
  const lidH = H - bodyH;
  const skirt = lidH * rng.range(0.4, 0.62);
  const rise = lidH - skirt;
  const t = 0.035;
  const s = W / 0.8;
  const wood = [];
  const metal = [];
  const content = [];
  const hinge = new THREE15.Vector3(0, bodyH, -D / 2);
  const planks = rng.int(3, 4);
  const inward = (cx, cz) => (x, y, z, nx, ny, nz) => nx * (x - cx) + nz * (z - cz) < -0.01 ? -0.42 : 0;
  const plankTone = () => rng.range(-0.09, 0.09);
  for (let i = 0; i < planks; i++) {
    const y0 = bodyH * i / planks, y1 = bodyH * (i + 1) / planks;
    const h = y1 - y0 - 6e-3;
    const y = (y0 + y1) / 2;
    for (const side of [-1, 1]) {
      const front = buildBlock([W, h, t], [0, y, side * (D / 2 - t / 2)]);
      const toneF = plankTone();
      wood.push([withTone(front, (x, yy, z, nx, ny, nz) => toneF + inward(0, 0)(x, yy, z, nx, ny, nz)), FIXED2]);
      const end = buildBlock([t, h, D - 2 * t], [side * (W / 2 - t / 2), y, 0]);
      const toneE = plankTone();
      wood.push([withTone(end, (x, yy, z, nx, ny, nz) => toneE + inward(0, 0)(x, yy, z, nx, ny, nz)), FIXED2]);
    }
  }
  wood.push([withTone(buildBlock([W - 2 * t, 0.03, D - 2 * t], [0, 0.03, 0]), -0.48), FIXED2]);
  const wall = -W / 2 + t + (W - 2 * t) * 0.32;
  wood.push([withTone(buildBlock([0.02, bodyH * 0.55, D - 2 * t], [wall, 0.03 + bodyH * 0.275, 0]), -0.2), FIXED2]);
  const archY = (z) => bodyH + skirt + rise * (1 - (2 * z / D) ** 2);
  for (const side of [-1, 1]) {
    wood.push([withTone(buildBlock([W, skirt, t], [0, bodyH + skirt / 2, side * (D / 2 - t / 2)]), plankTone()), LID]);
  }
  const slats = p.size === "small" ? 4 : 6;
  for (let i = 0; i < slats; i++) {
    const z0 = -D / 2 + D * i / slats, z1 = -D / 2 + D * (i + 1) / slats;
    const a = new THREE15.Vector3(0, archY(z0), z0), b = new THREE15.Vector3(0, archY(z1), z1);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const slat = buildBlock([W, t, len + 4e-3], [0, 0, 0], [Math.atan2(-dir.y, dir.z), 0, 0]);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const n = new THREE15.Vector3(0, dir.z, -dir.y).normalize();
    slat.translate(mid.x, mid.y - n.y * t / 2, mid.z - n.z * t / 2);
    const tone = plankTone() + (Math.abs(z0 + z1) < D * 0.4 ? 0.05 : 0);
    wood.push([withTone(slat, (x, y, z, nx, ny) => ny < -0.5 ? -0.45 : tone), LID]);
  }
  for (const side of [-1, 1]) {
    const shape = new THREE15.Shape();
    shape.moveTo(-D / 2 + t, 0);
    shape.lineTo(D / 2 - t, 0);
    for (let k = 0; k <= 8; k++) {
      const z = D / 2 - t - (D - 2 * t) * k / 8;
      shape.lineTo(z, archY(z) - bodyH - t * 0.8);
    }
    shape.closePath();
    const cap = plain(new THREE15.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 }));
    cap.rotateY(-Math.PI / 2);
    cap.translate(side > 0 ? W / 2 : -W / 2 + t, bodyH, 0);
    wood.push([withTone(cap, plankTone()), LID]);
  }
  wood.push([withTone(buildBlock([W - 2 * t, 0.012, D - 2 * t], [0, bodyH + 8e-3, 0]), -0.45), LID]);
  const c = 0.06 * s;
  const brass = (g, tone, part = FIXED2) => metal.push([withTone(g, tone), part]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      brass(buildBlock([c + 0.012, c, c + 0.012], [sx * (W / 2 - c / 2 + 6e-3), c / 2, sz * (D / 2 - c / 2 + 6e-3)]), 0.12);
      brass(buildBlock([c + 0.012, c, c + 0.012], [sx * (W / 2 - c / 2 + 6e-3), bodyH - c / 2, sz * (D / 2 - c / 2 + 6e-3)]), 0.12);
      brass(buildBlock([c + 0.012, skirt + 6e-3, c + 0.012], [sx * (W / 2 - c / 2 + 6e-3), bodyH + skirt / 2, sz * (D / 2 - c / 2 + 6e-3)]), 0.18, LID);
    }
  }
  const detached = rng.chance(0.3) ? rng.int(0, 1) : -1;
  const strapW = 0.05 * s, strapT = 0.012;
  const strapU = rng.range(0.2, 0.32);
  [-strapU, strapU].forEach((u, i) => {
    const x = u * W;
    brass(buildBlock([strapW, bodyH - 0.02, strapT], [x, bodyH / 2, -D / 2 - strapT / 2]), -0.05);
    if (i !== detached) {
      brass(buildBlock([strapW, bodyH - 0.02, strapT], [x, bodyH / 2, D / 2 + strapT / 2]), -0.05);
      const buckle = ring({ radius: 0.025 * s, height: strapT * 1.5, thickness: PX * 0.6, segments: 4 });
      buckle.rotateX(Math.PI / 2);
      buckle.rotateZ(Math.PI / 4);
      buckle.translate(x, bodyH - 0.07 * s, D / 2 + strapT * 1.2);
      brass(buckle, 0.3);
    }
    const pts = [[-D / 2, bodyH], [-D / 2, bodyH + skirt]];
    for (let k = 0; k <= 8; k++) {
      const z = -D / 2 + D * k / 8;
      pts.push([z, archY(z)]);
    }
    pts.push([D / 2, bodyH + skirt]);
    if (i !== detached) pts.push([D / 2, bodyH]);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const dz = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dz, dy) || 1;
      const nz = -dy / l, ny = dz / l;
      const off = (pt) => new THREE15.Vector3(x, pt[1] + ny * strapT / 2, pt[0] + nz * strapT / 2);
      brass(beam(off(a), off(b), strapT, strapW, 0, new THREE15.Vector3(1, 0, 0)), -0.05, LID);
    }
    if (i === detached) {
      brass(beam(new THREE15.Vector3(x, bodyH + 0.01, D / 2 + strapT), new THREE15.Vector3(x + 0.05, bodyH - 0.16 * s, D / 2 + 0.05), strapT, strapW, 0, new THREE15.Vector3(1, 0, 0)), -0.12, LID);
    }
  });
  brass(buildBlock([0.09 * s, 0.1 * s, 0.014], [0, bodyH - 0.06 * s, D / 2 + 7e-3]), 0.28);
  brass(buildBlock([PX * 0.6, PX * 1.1, 6e-3], [0, bodyH - 0.07 * s, D / 2 + 0.016]), -0.9);
  brass(buildBlock([0.045 * s, skirt * 0.9 + 0.03 * s, 0.014], [0, bodyH + skirt * 0.45 - 0.015 * s, D / 2 + 9e-3]), 0.22, LID);
  const labelAt = rng.pick(["left", "right", "end"]);
  const lw = 0.13 * s, lh = 0.075 * s;
  const glyph = straightGlyphRuns(rng, 5, 2);
  const label = (cx, cy, cz, rotY) => {
    const m = new THREE15.Matrix4().makeRotationY(rotY).setPosition(cx, cy, cz);
    brass(buildBlock([lw, lh, 8e-3], [0, 0, 0]).applyMatrix4(m), 0.32);
    const cell = (lw - 0.02) / 5;
    for (const [col, row, n] of glyph) {
      brass(buildBlock([n * cell, cell * 0.8, 4e-3], [-lw / 2 + 0.01 + (col + n / 2) * cell, (0.5 - row) * cell, 5e-3]).applyMatrix4(m), -0.85);
    }
  };
  if (labelAt === "end") label(W / 2 + 5e-3, bodyH * 0.5, 0, Math.PI / 2);
  else label((labelAt === "left" ? -1 : 1) * W * 0.15, bodyH * 0.5, D / 2 + 5e-3, 0);
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.012);
    if (labelAt === "end" && sx > 0) continue;
    for (const sz of [-1, 1]) brass(buildBlock([0.025, 0.04, 0.025], [x, bodyH * 0.72, sz * 0.07 * s]), 0.1);
    brass(beam(new THREE15.Vector3(x + sx * 0.02, bodyH * 0.72 - 0.02, -0.08 * s), new THREE15.Vector3(x + sx * 0.02, bodyH * 0.72 - 0.02, 0.08 * s), PX * 0.7, PX * 0.7), 0.25);
  }
  if (rng.chance(0.5)) {
    const y = bodyH * rng.range(0.38, 0.5);
    for (const side of [-1, 1]) {
      brass(buildBlock([W + 8e-3, 0.03 * s, 8e-3], [0, y, side * (D / 2 + 4e-3)]), 0.02);
      brass(buildBlock([8e-3, 0.03 * s, D + 8e-3], [side * (W / 2 + 4e-3), y, 0]), 0.02);
    }
  }
  for (const u of [-0.36, 0.36]) brass(buildBlock([0.07 * s, 0.06, 0.016], [u * W, bodyH, -D / 2 - 9e-3]), 0.05);
  let contentRamp = null;
  if (p.content === "cassettes") {
    contentRamp = GLASSES.cyan;
    const x0 = wall + 0.02, x1 = W / 2 - t - 0.01;
    const cw = 0.11 * Math.min(1, s), cd = 0.15 * Math.min(1, s);
    const cols = Math.max(1, Math.floor((x1 - x0) / (cw + 0.012)));
    const rows = Math.max(1, Math.floor((D - 2 * t - 0.02) / (cd + 0.012)));
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        if (rng.chance(0.15)) continue;
        const x = x0 + (q + 0.5) * ((x1 - x0) / cols);
        const z = -D / 2 + t + 0.01 + (r + 0.5) * ((D - 2 * t - 0.02) / rows);
        const stack = rng.int(1, 2);
        for (let k = 0; k < stack; k++) {
          content.push([withTone(buildBlock([cw, 0.028, cd], [x, 0.045 + 0.014 + k * 0.03, z]), rng.range(-0.15, 0.15)), FIXED2]);
          brass(buildBlock([cw * 0.4, 6e-3, PX * 0.8], [x, 0.045 + 0.03 + k * 0.03, z + cd / 2 - PX]), 0.2);
        }
      }
    }
    for (let k = 0; k < 2; k++) content.push([withTone(buildBlock([0.03, 0.12 * s, cd], [-W / 2 + t + 0.03 + k * 0.045, 0.045 + 0.06 * s, 0]), 0.1 - k * 0.2), FIXED2]);
  } else if (p.content === "tools") {
    contentRamp = OILCLOTH2;
    const roll = plain(new THREE15.CylinderGeometry(0.05 * s, 0.05 * s, (W / 2 - wall) * 0.8, 6));
    roll.rotateZ(Math.PI / 2);
    roll.translate((wall + W / 2) / 2, 0.045 + 0.05 * s, -D * 0.22);
    content.push([withTone(roll, (x) => Math.abs(x - (wall + W / 2) / 2) % 0.12 < 0.02 ? -0.4 : 0), FIXED2]);
    const lamp = plain(new THREE15.CylinderGeometry(0.022, 0.022, 0.2 * s, 6));
    lamp.rotateZ(Math.PI / 2);
    lamp.rotateY(rng.range(-0.4, 0.4));
    lamp.translate((wall + W / 2) / 2, 0.06, D * 0.12);
    brass(lamp, -0.3);
    const head = plain(new THREE15.CylinderGeometry(0.045, 0.035, 0.06, 8));
    head.rotateZ(Math.PI / 2);
    head.translate((wall + W / 2) / 2 + 0.12 * s, 0.07, D * 0.12);
    brass(head, 0.3);
    const wx = -W / 2 + t + 0.06;
    brass(beam(new THREE15.Vector3(wx, 0.055, -D * 0.25), new THREE15.Vector3(wx + 0.02, 0.055, D * 0.2), PX * 0.8, PX * 0.6), 0.05);
    const jaw = ring({ radius: 0.025, height: PX * 0.6, thickness: PX * 0.7, segments: 6 });
    jaw.translate(wx + 0.02, 0.05, D * 0.22);
    brass(jaw, 0.15);
  }
  const group = new THREE15.Group();
  group.name = meta12.name;
  const woodMerged = mergeParts(wood);
  const woodMat = createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, pattern: "speckle", patternParams: [16, 0.05, 0.12, 1], seed: rng.int(0, 96), id: 20 });
  const woodMesh = new THREE15.Mesh(woodMerged.geometry, woodMat);
  woodMesh.name = "wood";
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE15.Mesh(metalMerged.geometry, metalMaterial(METALS.blackenedBrass, { id: 21, tone: true }));
  metalMesh.name = "brass";
  for (const mesh of [woodMesh, metalMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (content.length) {
    const ramp = contentRamp ?? FABRICS.felt;
    const contentMesh = new THREE15.Mesh(mergeParts(content).geometry, createToonMaterial({ ramp: ramp.ramp, ink: ramp.ink, tone: true, crease: true, id: 22 }));
    contentMesh.name = "content";
    contentMesh.castShadow = true;
    contentMesh.receiveShadow = true;
    group.add(contentMesh);
  }
  const rigs = [createRigidParts(woodMerged.geometry, woodMerged.partOf, 1), createRigidParts(metalMerged.geometry, metalMerged.partOf, 1)];
  const tmp = new THREE15.Matrix4();
  let shown = -1;
  const pose = (u) => {
    if (Math.abs(u - shown) < 1e-4) return;
    shown = u;
    for (const rig of rigs) {
      const m = rig.matrices[LID];
      m.makeTranslation(0, hinge.y, hinge.z);
      m.multiply(tmp.makeRotationX(-OPEN_ANGLE2 * u));
      m.multiply(tmp.makeTranslation(0, -hinge.y, -hinge.z));
      rig.apply();
    }
  };
  const ease2 = (x) => x * x * (3 - 2 * x);
  let tween = null;
  const trunk = {
    openness: OPENNESS[p.state],
    setOpen(u) {
      tween = null;
      trunk.openness = THREE15.MathUtils.clamp(u, 0, 1);
      pose(trunk.openness);
    },
    open() {
      tween = { from: trunk.openness, to: 1, start: sharedUniforms.uTime.value };
    },
    close() {
      tween = { from: trunk.openness, to: 0, start: sharedUniforms.uTime.value };
    }
  };
  pose(trunk.openness);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    if (tween) {
      const k = Math.min(1, (sharedUniforms.uTime.value - tween.start) / (1.2 * Math.abs(tween.to - tween.from) || 1));
      trunk.openness = tween.from + (tween.to - tween.from) * ease2(k);
      if (k >= 1) tween = null;
      pose(trunk.openness);
    }
    baseUpdate(force);
  };
  group.userData.trunk = trunk;
  group.userData.asset = { id: meta12.id, params: p };
  return group;
}

// src/assets/props/decor/glyph-plaque.js
var glyph_plaque_exports = {};
__export(glyph_plaque_exports, {
  create: () => create13,
  dispose: () => disposeObject,
  meta: () => meta13,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE16 from "three";
var MODELS5 = {
  inscription: "Inscription (1,2 \xD7 0,8 m)",
  direction: "Direction (fl\xE8che et num\xE9ro de salle)",
  dedication: "D\xE9dicace (inclin\xE9e, au sol)",
  warning: "Avertissement (glyphe rouge)"
};
var SIZES4 = { inscription: [1.2, 0.8], direction: [0.6, 0.3], dedication: [1, 0.6], warning: [0.3, 0.2] };
var ARROWS = { right: "Vers la droite", left: "Vers la gauche", none: "Sans fl\xE8che" };
var params13 = {
  seed: seedParam("Change le texte en glyphes et la longueur des lignes, l'usure, le plot qui manque."),
  model: choiceParam("Mod\xE8le", MODELS5, "Plaque d'inscription du Sas, de direction (galerie), de d\xE9dicace (Oracle) ou d'avertissement (C\u0153ur)."),
  room: numberParam("Salle", 1, 1, 10, "Plaque de direction : num\xE9ro de la salle d'\xE9tude (traits : couch\xE9 = 5, debout = 1).", { step: 1 }),
  arrow: choiceParam("Fl\xE8che", ARROWS, "Plaque de direction : sens de la fl\xE8che."),
  height: numberParam("Hauteur", 1.6, 0.3, 4, "Plaques murales : hauteur du centre de la plaque.", { step: 0.05, unit: "m" })
};
var meta13 = {
  id: "props/decor/glyph-plaque",
  name: "Plaque \xE0 glyphes",
  nameEn: "Glyph plaque",
  category: "props",
  subcategory: "decor",
  description: "Plaque de m\xE9tal du Complexe tenue par quatre plots, grav\xE9e de glyphes en creux (vert-de-gris au fond des traits). Inscription de bronze du Sas (5 \xE0 7 lignes), plaque de direction en laiton (fl\xE8che et num\xE9ro de salle en traits), plaque de d\xE9dicace inclin\xE9e au pied de l'Oracle, ou plaque d'avertissement au glyphe rouge lumineux. Fiches SAS-14, GAL-06, ORA-12, COE-15.",
  tags: [
    "plaque",
    "inscription",
    "glyphes",
    "gravure",
    "signal\xE9tique",
    "direction",
    "fl\xE8che",
    "d\xE9dicace",
    "avertissement",
    "bronze",
    "laiton",
    "le complexe",
    "complexe",
    "ancien-tech",
    "d\xE9coration",
    "int\xE9rieur",
    "plaque sign",
    "engraved glyphs",
    "signage",
    "wayfinding",
    "arrow",
    "dedication",
    "warning sign",
    "brass",
    "ancient complex",
    "ancient-tech",
    "decoration",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; plaques murales : origine au sol au pied du mur (mur en z = 0, la plaque regarde +z), centre \xE0 `height` ; d\xE9dicace : origine au sol, au centre du socle, la plaque penche vers +z",
  footprint: { radius: 0.75, height: 2 },
  animated: [],
  params: params13,
  variants: variantsOf("model", params13.model)
};
function create13(given = {}) {
  const p = resolveParams(meta13.params, given);
  const rng = createRng(p.seed * 7919 + 83);
  const [W, H] = SIZES4[p.model];
  const T2 = p.model === "warning" || p.model === "direction" ? 0.02 : 0.03;
  const parts = [];
  const glowParts = [];
  const engrave = -0.95;
  parts.push(withTone(buildBlock([W, H, T2 - 6e-3], [0, 0, (T2 - 6e-3) / 2]), 0.15));
  const face = plain(new THREE16.PlaneGeometry(W - PX, H - PX, Math.max(2, Math.round(W / 0.1)), Math.max(2, Math.round(H / 0.1))));
  face.translate(0, 0, T2 - 3e-3);
  const wearX = rng.range(-0.3, 0.3) * W, wearY = rng.range(-0.3, 0.3) * H;
  parts.push(withTone(face, (x, y) => -0.15 + 0.3 * Math.max(0, 1 - Math.hypot((x - wearX) / (W * 0.4), (y - wearY) / (H * 0.5)))));
  const zf = T2 + 1e-3;
  const inset = Math.min(0.06, H * 0.15);
  const missing = p.model !== "warning" && rng.chance(0.3) ? rng.int(0, 3) : -1;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], k) => {
    const x = sx * (W / 2 - inset), y = sy * (H / 2 - inset);
    if (k === missing) parts.push(withTone(buildBlock([PX * 0.7, PX * 0.7, 3e-3], [x, y, zf]), -1));
    else parts.push(withTone(orient(plain(new THREE16.CylinderGeometry(Math.min(PX * 0.6, H * 0.07), Math.min(PX * 0.7, H * 0.08), 0.02, 6)), [x, y, zf + 8e-3], [0, 0, 1]), 0.4));
  });
  const line = (length, y, pixel) => {
    const strip = glyphStrip(rng, { length, rows: 2, pixel, depth: 2e-3 });
    strip.translate(rng.range(-0.02, 0.02) * W, y - pixel, zf - 1e-3);
    parts.push(withTone(strip, engrave));
  };
  if (p.model === "inscription" || p.model === "dedication") {
    const lines = p.model === "inscription" ? rng.int(5, 7) : rng.int(3, 4);
    const pixel = PX * 0.5;
    const usable = H - 2 * inset - 0.06;
    const gap = Math.min(0.12, usable / lines);
    for (let i = 0; i < lines; i++) {
      const y = usable / 2 - gap * (i + 0.5);
      const full = W - 2 * inset - 0.12;
      const length = i === 0 ? full * rng.range(0.4, 0.6) : i === lines - 1 ? full * rng.range(0.3, 0.7) : full * rng.range(0.8, 1);
      line(length, y, pixel);
      if (i === 0) parts.push(
        // filet gravé sous le titre
        withTone(buildBlock([full, PX * 0.4, 2e-3], [0, y - gap * 0.5, zf - 1e-3]), engrave)
      );
    }
  } else if (p.model === "direction") {
    const sign = p.arrow === "left" ? -1 : 1;
    const ax = p.arrow === "none" ? 0 : -sign * W * 0.18;
    if (p.arrow !== "none") {
      parts.push(withTone(buildBlock([PX * 5, PX, 2e-3], [ax, 0, zf]), engrave));
      for (let k = 1; k <= 2; k++) {
        for (const s of [-1, 1]) parts.push(withTone(buildBlock([PX, PX, 2e-3], [ax + sign * (PX * 2.5 - k * PX), s * k * PX, zf]), engrave));
      }
    }
    const nx = p.arrow === "none" ? 0 : sign * W * 0.2;
    const room = Math.round(p.room);
    const fives = Math.floor(room / 5), ones = room % 5;
    let y = PX * 1.5;
    for (let i = 0; i < fives; i++, y -= PX * 1.5) parts.push(withTone(buildBlock([PX * 4, PX * 0.8, 2e-3], [nx, y, zf]), engrave));
    if (ones) {
      const top = fives ? y + PX * 0.5 : PX * 1.5;
      const h = fives ? PX * 2 : PX * 4;
      for (let i = 0; i < ones; i++) parts.push(withTone(buildBlock([PX * 0.8, h, 2e-3], [nx + (i - (ones - 1) / 2) * PX * 1.5, top - h / 2, zf]), engrave));
    }
    line(W * 0.5, -H / 2 + inset + PX * 0.6, PX * 0.35);
  } else {
    const g = [];
    const s = H / 9;
    g.push(buildBlock([s, s * 3.2, 4e-3], [-s * 0.5, s * 1.4, zf + 1e-3]));
    g.push(buildBlock([s * 2, s, 4e-3], [0, 0, zf + 1e-3]));
    g.push(buildBlock([s, s * 1.6, 4e-3], [s * 0.5, -s * 1.3, zf + 1e-3]));
    g.push(buildBlock([s, s, 4e-3], [s * 2.2, -s * 2.6, zf + 1e-3]));
    parts.push(withTone(buildBlock([W - inset * 2.4, PX * 0.3, 2e-3], [0, H / 2 - inset * 0.6, zf]), engrave));
    parts.push(withTone(buildBlock([W - inset * 2.4, PX * 0.3, 2e-3], [0, -H / 2 + inset * 0.6, zf]), engrave));
    glowParts.push(...g);
  }
  const group = new THREE16.Group();
  group.name = meta13.name;
  let frame;
  if (p.model === "dedication") {
    const tilt = THREE16.MathUtils.degToRad(35);
    const base = 0.22;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    frame = faceMatrix(new THREE16.Vector3(0, base + H / 2 * s, 0), new THREE16.Vector3(0, c, s));
    for (const g of parts) g.applyMatrix4(frame);
    const hx = W / 2 - 0.02, zf0 = H / 2 * c - 0.02, zb0 = -(H / 2) * c + 0.02;
    const top = (x, z) => base + H / 2 * s - z * Math.tan(tilt) - 0.012 / c;
    parts.push(withTone(plain(buildPrism([[-hx, zb0], [hx, zb0], [hx, zf0], [-hx, zf0]], 0.04, top)), -0.25));
    parts.push(withTone(buildBlock([W + 0.1, 0.04, H * c + 0.1], [0, 0.02, 0]), -0.45));
  } else {
    frame = new THREE16.Matrix4().makeTranslation(0, p.height, 4e-3);
    for (const g of parts) g.applyMatrix4(frame);
  }
  for (const g of glowParts) g.applyMatrix4(frame);
  const metalEntry = p.model === "direction" || p.model === "warning" ? METALS.blackenedBrass : METALS.patinatedBronze;
  const metal = new THREE16.Mesh(mergeToned(parts), metalMaterial(metalEntry, { id: 30, tone: true }));
  metal.name = "plaque";
  metal.castShadow = true;
  metal.receiveShadow = true;
  group.add(metal);
  if (glowParts.length) {
    const glow = new THREE16.Mesh(mergeToned(glowParts), glowMaterial("alarm", { level: 3, id: 40 }));
    glow.name = "glyph";
    group.add(glow);
  }
  group.userData.asset = { id: meta13.id, params: p };
  return group;
}

// src/assets/props/machines/braided-cable.js
var braided_cable_exports = {};
__export(braided_cable_exports, {
  create: () => create14,
  createRoute: () => createRoute,
  dispose: () => disposeObject,
  meta: () => meta14,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE17 from "three";
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
var LAYOUTS2 = { hanging: "Pendu en cha\xEEnette", floor: "Pos\xE9 au sol", bundle: "Faisceau au sol" };
var params14 = {
  seed: seedParam("Change le trac\xE9 (serpentin, fl\xE8che), le nombre de c\xE2bles du faisceau, la boucle de rangement, la place des \xE9tiquettes."),
  gauge: choiceParam("Calibre", GAUGES, "C\xE2ble fin du Sas, c\xE2ble d'\xE9tude, c\xE2ble ombilical de l'Oracle ou c\xE2ble principal du C\u0153ur."),
  layout: choiceParam("Trac\xE9", LAYOUTS2, "Pendu entre deux points d'accroche, pos\xE9 au sol, ou faisceau de 3 \xE0 5 c\xE2bles sangl\xE9s."),
  length: numberParam("Longueur", 3, 1, 10, "Distance entre les deux bouts.", { step: 0.5, unit: "m" }),
  height: numberParam("Accroche", 2.2, 0.6, 6, "C\xE2ble pendu : hauteur des deux points d'accroche.", { step: 0.1, unit: "m" })
};
var meta14 = {
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
  params: params14,
  variants: variantsOf("layout", params14.layout)
};
function buildCables(paths, p, rng, { coil = false } = {}) {
  const { r, sides } = SPEC[p.gauge];
  const fabricParts = [];
  const bronzeParts = [];
  paths.forEach((points, index) => {
    let pts = points;
    if (coil && index === 0) {
      const end = pts[pts.length - 1];
      const dir = new THREE17.Vector3().subVectors(end, pts[pts.length - 2]).setY(0).normalize();
      const side = new THREE17.Vector3(-dir.z, 0, dir.x);
      const R2 = 0.22 + r * 2;
      const center = end.clone().addScaledVector(side, R2);
      const a0 = Math.atan2(end.z - center.z, end.x - center.x);
      pts = pts.slice(0, -1);
      for (let k = 0; k <= 18; k++) {
        const a = a0 + k / 18 * Math.PI * 3;
        const rr = R2 * (1 - k * 0.012);
        pts.push(new THREE17.Vector3(center.x + Math.cos(a) * rr, r + (k > 10 ? r * 1.6 : 0), center.z + Math.sin(a) * rr));
      }
    }
    const curve = new THREE17.CatmullRomCurve3(pts, false, "centripetal");
    const length = curve.getLength();
    const samples = Math.max(8, Math.ceil(length / 0.12));
    const along = curve.getSpacedPoints(samples);
    fabricParts.push(withTone(cable(along, { radius: r, sides, segments: samples }), (x, y, z, nx, ny) => ny < -0.2 ? -0.08 : 0));
    const ends = coil && index === 0 ? [0] : [0, 1];
    for (const t of ends) {
      const at = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).multiplyScalar(t === 0 ? -1 : 1);
      const L2 = Math.max(0.1, r * 2.5);
      const body = buildBlock([r * 2 + PX, L2, r * 2 + PX], [0, L2 / 2, 0]);
      bronzeParts.push(orient(body, at, tangent));
      const pin = buildBlock([r, PX * 2, r], [0, L2 + PX, 0]);
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
          label.applyMatrix4(new THREE17.Matrix4().lookAt(new THREE17.Vector3(), tangent, new THREE17.Vector3(0, 1, 0)));
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
  const group = new THREE17.Group();
  group.name = meta14.name;
  const fabric = new THREE17.Mesh(
    mergeToned(fabricParts),
    createToonMaterial({ ramp: FABRICS.tarredLeather.ramp, ink: FABRICS.tarredLeather.ink, steps: [0.3, 0.55, 0.8], pattern: "speckle", patternParams: [16, 0.06, 0.18, 0.5], tone: true, id: 30 })
  );
  fabric.name = "cables";
  fabric.castShadow = true;
  fabric.receiveShadow = true;
  group.add(fabric);
  if (bronzeParts.length) {
    const bronze = new THREE17.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 31, tone: true }));
    bronze.name = "fittings";
    bronze.castShadow = true;
    group.add(bronze);
  }
  group.userData.asset = { id: meta14.id, params: p };
  return group;
}
function createRoute(points, given = {}) {
  const p = resolveParams(meta14.params, given);
  const pts = points.map((v) => v.isVector3 ? v.clone() : new THREE17.Vector3(...v));
  const { fabricParts, bronzeParts } = buildCables([pts], p, createRng(p.seed * 104729 + 71));
  return assemble(fabricParts, bronzeParts, p);
}
function create14(given = {}) {
  const p = resolveParams(meta14.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const fittings = createRng(p.seed * 104729 + 71);
  const { r } = SPEC[p.gauge];
  const L2 = p.length;
  const paths = [];
  let coil = false;
  let straps = [];
  if (p.layout === "hanging") {
    const sag = L2 * shape.range(0.12, 0.22);
    const lean = shape.range(-0.15, 0.15);
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push(new THREE17.Vector3(-L2 / 2 + L2 * t, p.height + lean * (t - 0.5) - 4 * sag * t * (1 - t), 0));
    }
    paths.push(pts);
  } else {
    const a1 = shape.range(0.12, 0.3), f1 = shape.range(0.6, 1.4), ph1 = shape.range(0, 6.28);
    const a2 = shape.range(0.03, 0.1), f2 = shape.range(2, 3.5), ph2 = shape.range(0, 6.28);
    const wave = (x) => a1 * Math.sin(x * f1 + ph1) + a2 * Math.sin(x * f2 + ph2);
    const count = p.layout === "bundle" ? shape.int(3, 5) : 1;
    const gap = r * 2 + PX * 0.5;
    const steps = Math.max(8, Math.ceil(L2 / 0.25));
    for (let c = 0; c < count; c++) {
      const offset = (c - (count - 1) / 2) * gap;
      const jitter = shape.range(-1, 1) * 0.04;
      const pts = [];
      for (let k = 0; k <= steps; k++) {
        const x = -L2 / 2 + L2 * k / steps;
        const lift = c % 2 && count > 3 ? r * 0.8 : 0;
        pts.push(new THREE17.Vector3(x, r + lift, wave(x) + offset + jitter * Math.sin(x * 3 + c)));
      }
      paths.push(pts);
    }
    if (p.layout === "bundle") {
      coil = shape.chance(0.75);
      straps = [];
      for (let s = -L2 / 2 + 0.5; s < L2 / 2 - 0.4; s += 0.8) straps.push(s);
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

// src/assets/props/machines/copper-pipe.js
var copper_pipe_exports = {};
__export(copper_pipe_exports, {
  create: () => create15,
  dispose: () => disposeObject,
  meta: () => meta15,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE18 from "three";
var PIECES = { straight: "Droit (2 m)", elbow: "Coude \xE0 90\xB0", tee: "Raccord en T", cap: "Bout bouch\xE9" };
var SIZES5 = { wall: "Tuyau mural (\xD8 0,12 m)", giant: "Tuyau g\xE9ant (\xD8 0,8 m)" };
var MOUNTS2 = { wall: "Contre un mur", floor: "Sur des berceaux au sol" };
var SPEC2 = {
  wall: { r: 0.06, sides: 6, bend: 0.25, gap: 0.08 },
  giant: { r: 0.4, sides: 14, bend: 0.9, gap: 0.12 }
};
var params15 = {
  seed: seedParam("Change la place des coulures, un collier manquant, un manchon de r\xE9paration, les tons du cuivre."),
  piece: choiceParam("Pi\xE8ce", PIECES, "Droit de 2 m, coude \xE0 90\xB0 (qui monte), raccord en T (branche vers le haut) ou bout bouch\xE9."),
  size: choiceParam("Taille", SIZES5, "Tuyau mural du Sas (colliers de bronze) ou tuyau g\xE9ant de la salle du C\u0153ur (brides de laiton boulonn\xE9es)."),
  mount: choiceParam("Pose", MOUNTS2, "Contre un mur (pattes de fixation vers z = 0) ou sur des berceaux au sol."),
  height: numberParam("Hauteur", 1.8, 0.2, 6, "Hauteur de l'axe du tuyau.", { step: 0.1, unit: "m" })
};
var meta15 = {
  id: "props/machines/copper-pipe",
  name: "Tuyau de cuivre",
  nameEn: "Copper pipe",
  category: "props",
  subcategory: "machines",
  description: "Tuyau de cuivre oxyd\xE9 du Complexe, vert d'oxyde avec des coulures, en pi\xE8ces de 2 m qui s'assemblent : droit, coude, raccord en T, bout bouch\xE9. Tuyau mural \xE0 colliers de bronze, ou tuyau g\xE9ant \xE0 brides de laiton boulonn\xE9es ; contre un mur ou sur des berceaux. Fiches SAS-09, COE-07.",
  tags: [
    "tuyau",
    "conduite",
    "canalisation",
    "cuivre",
    "oxyde",
    "coude",
    "raccord",
    "bride",
    "collier",
    "le complexe",
    "complexe",
    "ancien-tech",
    "r\xE9seau",
    "modulaire",
    "int\xE9rieur",
    "pipe",
    "pipeline",
    "copper",
    "verdigris",
    "elbow",
    "tee",
    "flange",
    "pipe clamp",
    "ancient complex",
    "ancient-tech",
    "network",
    "modular",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol (au pied du mur pour la pose murale : le mur est en z = 0) ; l'axe court selon x de \u22121 \xE0 +1 \xE0 la hauteur `height` ; le coude et le T montent vers +y en x = 0",
  footprint: { radius: 1.4, height: 3.3 },
  animated: [],
  params: params15,
  variants: variantsOf("piece", params15.piece)
};
function create15(given = {}) {
  const p = resolveParams(meta15.params, given);
  const { r, sides, bend, gap } = SPEC2[p.size];
  const giant = p.size === "giant";
  const wear = createRng(p.seed * 7919 + 17);
  const H = Math.max(p.height, r + 0.05);
  const zc = p.mount === "wall" ? r + gap : 0;
  const at = (x, y) => new THREE18.Vector3(x, H + y, zc);
  const runs = [];
  if (p.piece === "straight") runs.push([at(-1, 0), at(1, 0)]);
  else if (p.piece === "cap") runs.push([at(-1, 0), at(0.2, 0)]);
  else if (p.piece === "tee") runs.push([at(-1, 0), at(1, 0)], [at(0, 0), at(0, 1)]);
  else {
    const arc = [at(-1, 0)];
    for (let k = 0; k <= 8; k++) {
      const a = k / 8 * (Math.PI / 2);
      arc.push(at(-bend + Math.sin(a) * bend, bend - Math.cos(a) * bend));
    }
    arc.push(at(0, 1));
    runs.push(arc);
  }
  const copperParts = [];
  const streakSeed = wear.next() * 100;
  for (const points of runs) {
    const dense = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const n = Math.max(1, Math.round(a.distanceTo(b) / 0.25));
      for (let k = 0; k < n; k++) dense.push(new THREE18.Vector3().lerpVectors(a, b, k / n));
    }
    dense.push(points[points.length - 1]);
    let length = 0;
    for (let i = 1; i < dense.length; i++) length += dense[i].distanceTo(dense[i - 1]);
    const tube = buildTube(dense, () => r, { radialSegments: sides, lengthSegments: Math.ceil(length / (PX * 1.5)) });
    const uv = tube.attributes.uv;
    const normal = tube.attributes.normal;
    const tone = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) {
      const band = Math.floor(uv.getY(i) / (PX * 1.5));
      const s = Math.sin(band * 12.9898 + streakSeed) * 43758.5453;
      const streak = s - Math.floor(s) < 0.22 && normal.getY(i) < 0.35;
      tone[i] = streak ? -0.3 : 0;
    }
    plain(tube);
    tube.setAttribute("aTone", new THREE18.BufferAttribute(tone, 1));
    copperParts.push(tube);
  }
  const disc = (center, dir, tone) => {
    const g = plain(new THREE18.CylinderGeometry(r * 0.98, r * 0.98, PX * 0.4, sides));
    copperParts.push(withTone(orient(g, center, dir), tone));
  };
  if (p.piece === "cap") {
    const dome = plain(new THREE18.SphereGeometry(r, sides, 4, 0, Math.PI * 2, 0, Math.PI / 2));
    copperParts.push(withTone(orient(dome, at(0.2, 0), [1, 0, 0]), 0.05));
  }
  disc(at(-1 + PX * 0.3, 0), [1, 0, 0], -0.5);
  if (p.piece === "straight" || p.piece === "tee") disc(at(1 - PX * 0.3, 0), [1, 0, 0], -0.5);
  if (p.piece === "elbow" || p.piece === "tee") disc(at(0, 1 - PX * 0.3), [0, 1, 0], -0.5);
  const bronzeParts = [];
  const ends = [[at(-1, 0), [1, 0, 0]]];
  if (p.piece === "straight" || p.piece === "tee") ends.push([at(1, 0), [1, 0, 0]]);
  if (p.piece === "elbow" || p.piece === "tee") ends.push([at(0, 1), [0, 1, 0]]);
  const collar = (center, dir, { width = PX * 2, thick = PX * 0.8, tone = 0 } = {}) => {
    const g = ring({ radius: r, height: width, y: -width / 2, thickness: thick, segments: sides });
    bronzeParts.push(withTone(orient(g, center, dir), tone));
  };
  const straightStations = [];
  const xs = p.piece === "elbow" ? [-0.75, -0.25 - bend * 0.2] : p.piece === "cap" ? [-0.75, -0.25] : [-0.75, -0.25, 0.25, 0.75];
  for (const x of xs) straightStations.push([at(x + wear.range(-0.08, 0.08), 0), [1, 0, 0]]);
  if (p.piece === "elbow") straightStations.push([at(0, 0.75), [0, 1, 0]]);
  if (p.piece === "tee") straightStations.push([at(0, 0.6), [0, 1, 0]]);
  const missing = wear.chance(0.35) ? wear.int(0, straightStations.length - 1) : -1;
  if (giant) {
    const flange = (center, dir) => {
      collar(center, dir, { width: 0.1, thick: 0.07, tone: 0.25 });
      const d = new THREE18.Vector3(...dir);
      const u = new THREE18.Vector3(0, 0, 1).cross(d).lengthSq() > 0.01 ? new THREE18.Vector3(0, 0, 1) : new THREE18.Vector3(1, 0, 0);
      const v = new THREE18.Vector3().crossVectors(d, u);
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2;
        const pos = center.clone().addScaledVector(u, Math.cos(a) * (r + 0.05)).addScaledVector(v, Math.sin(a) * (r + 0.05));
        bronzeParts.push(withTone(buildBlock([PX, PX, 0.14], [0, 0, 0]).applyMatrix4(new THREE18.Matrix4().makeBasis(u, v, d).setPosition(pos)), 0.4));
      }
    };
    for (const [c, d] of ends) flange(c.clone().addScaledVector(new THREE18.Vector3(...d), d[0] && c.x < 0 ? 0.05 : -0.05), d);
    if (p.piece === "tee") flange(at(0, r + 0.08), [0, 1, 0]);
  } else {
    straightStations.forEach(([c, d], i) => {
      if (i !== missing) collar(c, d);
    });
  }
  if (wear.chance(0.4)) {
    const [c, d] = straightStations[wear.int(0, straightStations.length - 1)];
    collar(c.clone().add(new THREE18.Vector3(d[1] ? 0 : 0.12, d[1] ? 0.12 : 0, 0)), d, { width: giant ? 0.3 : 0.18, thick: giant ? 0.04 : PX * 0.6, tone: 0.35 });
  }
  const supportXs = p.piece === "elbow" ? [-0.6] : p.piece === "cap" ? [-0.6] : [-0.6, 0.6];
  for (const x of supportXs) {
    if (p.mount === "wall") {
      bronzeParts.push(beam([x, H, 0], [x, H, zc], giant ? 0.12 : PX * 1.2, giant ? 0.16 : PX * 1.4));
      bronzeParts.push(withTone(buildBlock([giant ? 0.3 : 0.12, giant ? 0.4 : 0.16, PX], [x, H, PX / 2]), 0.1));
      if (giant) bronzeParts.push(beam([x, H - 0.5, 0], [x, H - r * 0.4, zc * 0.8], 0.08, 0.1));
    } else {
      const w = giant ? 0.22 : PX * 1.6;
      const top = H - r * 0.7;
      bronzeParts.push(withTone(buildBlock([w, top, giant ? r * 1.6 : r * 2.4], [x, top / 2, zc]), -0.15));
      bronzeParts.push(withTone(buildBlock([w + PX, PX, giant ? r * 1.9 : r * 2.8], [x, PX / 2, zc]), -0.25));
    }
  }
  const group = new THREE18.Group();
  group.name = meta15.name;
  const copper = new THREE18.Mesh(mergeToned(copperParts), metalMaterial(METALS.oxidizedCopper, { id: 30, tone: true, steps: [0.28, 0.46, 0.68, 0.95] }));
  copper.name = "pipe";
  copper.castShadow = true;
  copper.receiveShadow = true;
  group.add(copper);
  const bronze = new THREE18.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 31, tone: true }));
  bronze.name = "fittings";
  bronze.castShadow = true;
  group.add(bronze);
  group.userData.asset = { id: meta15.id, params: p };
  return group;
}

// src/assets/props/machines/lever-desk.js
import * as THREE19 from "three";
var MODELS6 = { check: "V\xE9rification (Sas)", guard: "Poste de garde (galerie)", reader: "Lecteur d'\xE9tude (salle 2)" };
var CASSETTE = { empty: "Fente vide", loaded: "Cassette engag\xE9e (lueur cyan)" };
var params16 = {
  seed: seedParam("Change les leviers abaiss\xE9s, les aiguilles, les glyphes de la plaque, la page du registre, l'usure."),
  model: choiceParam("Mod\xE8le", MODELS6, "Pupitre de v\xE9rification du Sas, poste de garde de la galerie, ou lecteur de cassette de la salle 2."),
  lights: numberParam("Salles ouvertes", 3, 0, 10, "Poste de garde : nombre de voyants ambre allum\xE9s (un par salle d'\xE9tude ouverte).", { step: 1 }),
  cassette: choiceParam("Cassette", CASSETTE, "Lecteur : fente vide, ou cassette engag\xE9e (la fente luit en cyan).")
};
var meta16 = {
  id: "props/machines/lever-desk",
  name: "Pupitre \xE0 leviers",
  nameEn: "Lever desk",
  category: "props",
  subcategory: "machines",
  description: "Pupitre inclin\xE9 du Complexe : leviers de laiton, cadrans ronds, plaque grav\xE9e de glyphes, sur un pi\xE8tement. Pupitre de v\xE9rification du Sas (8 leviers, 4 cadrans), poste de garde de la galerie (registre de cuir, 10 voyants ambre, un par salle ouverte) ou lecteur d'\xE9tude de la salle 2 (fente \xE0 cassette qui luit en cyan, volants, lentille, galvanom\xE8tres). Leviers, voyants et fente pilotables. Fiches SAS-08, GAL-09, E2-01.",
  tags: [
    "pupitre",
    "console",
    "leviers",
    "cadrans",
    "voyants",
    "registre",
    "lecteur",
    "cassette",
    "galvanom\xE8tre",
    "laiton",
    "le complexe",
    "complexe",
    "ancien-tech",
    "machine",
    "commande",
    "pilotable",
    "int\xE9rieur",
    "lever desk",
    "control desk",
    "levers",
    "gauges",
    "indicator lights",
    "ledger",
    "tape reader",
    "brass",
    "ancient complex",
    "ancient-tech",
    "control",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au centre ; l'op\xE9rateur se tient c\xF4t\xE9 +z, face au plan inclin\xE9",
  footprint: { radius: 0.7, height: 1.35 },
  animated: ["desk"],
  params: params16,
  variants: variantsOf("model", params16.model)
};
function create16(given = {}) {
  const p = resolveParams(meta16.params, given);
  const rng = createRng(p.seed * 7919 + 59);
  const model = p.model;
  const reader = model === "reader";
  const [W, Dp, Ht] = reader ? [0.8, 0.5, 1] : model === "guard" ? [1, 0.5, 1.1] : [1, 0.5, 1.2];
  const tilt = THREE19.MathUtils.degToRad(reader ? 25 : 20);
  const baseParts = [];
  const metalParts = [];
  const glowParts = [];
  const footH = Ht - 0.25;
  if (!reader) {
    baseParts.push(withTone(buildBlock([W - 0.14, 0.08, Dp - 0.08], [0, 0.04, 0]), -0.25));
    baseParts.push(withTone(buildBlock([W - 0.22, footH - 0.16, Dp - 0.16], [0, 0.08 + (footH - 0.16) / 2, -0.02]), rng.range(-0.06, 0.06)));
    baseParts.push(withTone(buildBlock([W - 0.12, 0.08, Dp - 0.06], [0, footH - 0.04, 0]), 0.1));
    baseParts.push(withTone(buildBlock([W - 0.24, PX, 0.01], [0, footH * 0.5, Dp / 2 - 0.096]), -0.7));
  } else {
    baseParts.push(withTone(buildBlock([W - 0.06, footH - 0.1, Dp - 0.1], [0, 0.1 + (footH - 0.1) / 2, 0]), (x, y) => y > footH - 0.05 ? 0.1 : 0));
    for (let k = 0; k < 3; k++) baseParts.push(withTone(buildBlock([W - 0.1, PX * 0.4, 0.01], [0, 0.25 + k * 0.17, Dp / 2 - 0.045]), -0.5));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) metalParts.push(withTone(buildBlock([0.05, 0.1, 0.05], [sx * (W / 2 - 0.05), 0.05, sz * (Dp / 2 - 0.06)]), -0.1));
    metalParts.push(withTone(buildBlock([W, 0.03, Dp - 0.06], [0, footH - 0.015, 0]), 0.1));
  }
  const deskDepth = Dp + 0.04;
  const backH = deskDepth * Math.sin(tilt) + 0.08;
  const center = new THREE19.Vector3(0, footH + 0.04 + backH / 2, 0.02);
  const n = new THREE19.Vector3(0, Math.cos(tilt), Math.sin(tilt));
  const v = new THREE19.Vector3(0, Math.sin(tilt), -Math.cos(tilt));
  const at = (u, w, lift = 0) => center.clone().add(new THREE19.Vector3(u, 0, 0)).addScaledVector(v, w).addScaledVector(n, lift);
  metalParts.push(withTone(buildBlock([W, 0.08, deskDepth], [0, footH + 0.04, 0.02]), -0.2));
  const slab = buildBlock([W, 0.04, deskDepth / Math.cos(tilt) * 0.98], [0, 0, 0]);
  slab.rotateX(tilt);
  slab.translate(center.x, center.y, center.z);
  metalParts.push(withTone(slab, -0.32));
  const zf = center.z + deskDepth / 2 - 0.02, zb = center.z - deskDepth / 2 + 0.02, hx = W / 2 - 0.01;
  const fill = plain(buildPrism([[-hx, zb], [hx, zb], [hx, zf], [-hx, zf]], footH + 0.04, (x, z) => center.y + (center.z - z) * Math.tan(tilt) - 0.025));
  metalParts.push(withTone(fill, -0.3));
  const halfV = deskDepth / Math.cos(tilt) * 0.47;
  for (const s of [-1, 1]) metalParts.push(withTone(beam(at(s * (W / 2 - PX / 2), -halfV, 0.03), at(s * (W / 2 - PX / 2), halfV, 0.03), PX, PX * 0.8, 0, n), 0.2));
  metalParts.push(withTone(beam(at(-W / 2, -halfV, 0.03), at(W / 2, -halfV, 0.03), PX, PX * 0.8, 0, n), 0.3));
  const plate = (u, w, width, height) => {
    const m = faceMatrix(at(u, w, 0.021), n);
    const g = buildBlock([width, height, 8e-3], [0, 0, 4e-3]);
    g.applyMatrix4(m);
    metalParts.push(withTone(g, 0.35));
    const strip = glyphStrip(rng, { length: width - 0.04, rows: 2, pixel: PX * 0.5, depth: 4e-3 });
    strip.translate(0, -PX * 0.5, 8e-3);
    strip.applyMatrix4(m);
    metalParts.push(withTone(strip, -0.9));
  };
  const leverParts = [];
  const levers = [];
  const addLever = (u, w, length) => {
    const index = levers.length;
    const down = rng.chance(0.5);
    const l = lever({ length, angle: 1.15, position: at(u, w, 0.02), normal: n, width: PX * 0.7 });
    const geometry = mergeToned([withTone(l.rod, 0.1), withTone(l.knob, 0.35)]);
    levers.push({ index, down, pivot: at(u, w, 0.02), geometry });
    leverParts.push(geometry);
    const m = faceMatrix(at(u, w - length * 0.3, 0.021), n);
    const g = buildBlock([PX * 0.8, length * 0.8, 4e-3], [0, 0, 0]);
    g.applyMatrix4(m);
    metalParts.push(withTone(g, -0.9));
  };
  const addDial = (u, w, radius, ticks = 6) => {
    const d = dial({ radius, position: at(u, w, 0.02), normal: n, ticks, needle: rng.range(-2.2, 2.2), depth: PX * 0.3 });
    metalParts.push(withTone(d.face, 0.6), withTone(d.marks, -1));
    metalParts.push(withTone(orient(ring({ radius, height: PX * 0.4, thickness: PX * 0.4, segments: 10 }), at(u, w, 0.02), n), -0.2));
  };
  const lights = [];
  let slot = null;
  if (model === "check") {
    plate(0, halfV - 0.07, 0.42, 0.08);
    for (let i = 0; i < 4; i++) addDial(-W * 0.36 + i * W * 0.24, halfV * 0.4, PX * 1.7);
    for (let i = 0; i < 8; i++) addLever(-W * 0.4 + i * (W * 0.8 / 7), -halfV * 0.45, PX * 4);
  } else if (model === "guard") {
    plate(W * 0.25, halfV - 0.06, 0.3, 0.07);
    const m = faceMatrix(at(-W * 0.18, 0, 0.02), n, rng.range(-0.15, 0.15));
    const cover2 = withTone(buildBlock([0.46, 0.32, 0.02], [0, 0, 0.01]), -0.6);
    cover2.applyMatrix4(m);
    baseParts.push(cover2);
    for (const s of [-1, 1]) {
      const page = withTone(buildBlock([0.2, 0.28, 0.012], [s * 0.112, 0, 0.025], [0, s * 0.06, 0]), 0.6);
      page.applyMatrix4(m);
      baseParts.push(page);
      const lines = rng.int(4, 7);
      for (let k = 0; k < lines; k++) {
        const ln = withTone(buildBlock([rng.range(0.08, 0.16), PX * 0.4, 4e-3], [s * 0.112 - 0.02, 0.1 - k * 0.04, 0.033]), -0.3);
        ln.applyMatrix4(m);
        baseParts.push(ln);
      }
    }
    for (let i = 0; i < 10; i++) {
      const pos = at(W * 0.04 + i * 0.042, halfV * 0.3, 0.03);
      const g = bulb({ radius: PX * 0.75, position: [pos.x, pos.y, pos.z], segments: 4 });
      lights.push({ start: 0, count: g.attributes.position.count, geometry: g });
      glowParts.push(g);
      metalParts.push(withTone(orient(ring({ radius: PX * 0.55, height: PX * 0.3, thickness: PX * 0.3, segments: 6 }), at(W * 0.04 + i * 0.042, halfV * 0.3, 0.02), n), -0.3));
    }
    for (let i = 0; i < 4; i++) addLever(W * 0.1 + i * 0.09, -halfV * 0.45, PX * 4);
  } else {
    const m = faceMatrix(at(0, halfV * 0.05, 0.02), n);
    for (const [sx, sy, px, py] of [[0.35, PX, 0, 0.085], [0.35, PX, 0, -0.085], [PX, 0.17, 0.175, 0], [PX, 0.17, -0.175, 0]]) {
      const g = withTone(buildBlock([sx, sy, 0.04], [px, py, 0.02]), 0.2);
      g.applyMatrix4(m);
      metalParts.push(g);
    }
    const slotGeometry = buildBlock([0.31, 0.15, 0.01], [0, 0, 0.012]);
    slotGeometry.applyMatrix4(m);
    slot = slotGeometry;
    glowParts.push(slotGeometry);
    for (const s of [-1, 1]) {
      const c = at(s * 0.3, -halfV * 0.5, 0.03);
      metalParts.push(withTone(orient(ring({ radius: PX * 1.6, height: PX * 0.6, thickness: PX * 0.6, segments: 10 }), c, n), 0.15));
      metalParts.push(withTone(beam(c.clone().addScaledVector(n, -0.02), c.clone().addScaledVector(n, 0.03), PX, PX), 0));
    }
    const lens = at(0, -halfV * 0.55, 0.02);
    metalParts.push(withTone(orient(plain(new THREE19.CylinderGeometry(0.05, 0.06, 0.07, 10)), lens.clone().addScaledVector(n, 0.035), n), -0.1));
    const lensGlass = orient(plain(new THREE19.CylinderGeometry(0.035, 0.035, 0.01, 10)), lens.clone().addScaledVector(n, 0.072), n);
    glowParts.push(lensGlass);
    const boxCenter = at(0, halfV - 0.04, 0).add(new THREE19.Vector3(0, 0.1, 0));
    metalParts.push(withTone(buildBlock([W * 0.7, 0.22, 0.08], [boxCenter.x, boxCenter.y - 0.02, boxCenter.z - 0.02]), -0.45));
    for (let i = 0; i < 3; i++) {
      const d = dial({ radius: PX * 1.5, position: [boxCenter.x - 0.17 + i * 0.17, boxCenter.y + 0.01, boxCenter.z + 0.021], normal: [0, 0.25, 1], ticks: 5, needle: rng.range(-1.2, 1.2), depth: PX * 0.3 });
      metalParts.push(withTone(d.face, 0.6), withTone(d.marks, -1));
    }
  }
  const glowColors = [...glowLevels("amber").slice(0, 3), glowLevels("cyan")[0], glowLevels("cyan")[3]];
  const AMBER_OFF = 0, AMBER_ON = 2, CYAN_OFF = 3, CYAN_ON = 4;
  let glowGeometry = null;
  if (glowParts.length) {
    for (const g of glowParts) withShade(g, g === slot || glowParts.indexOf(g) >= lights.length ? CYAN_OFF : AMBER_OFF, glowColors.length);
    glowGeometry = mergeToned(glowParts);
  }
  let cursor = 0;
  const ranges = glowParts.map((g) => {
    const r = { start: cursor, count: g.attributes.position.count };
    cursor += r.count;
    return r;
  });
  const shade = glowGeometry?.attributes.aShade;
  const setRange = (r, value) => {
    for (let k = r.start; k < r.start + r.count; k++) shade.setX(k, (value + 0.5) / glowColors.length);
    shade.needsUpdate = true;
  };
  const group = new THREE19.Group();
  group.name = meta16.name;
  const baseMaterial = reader ? createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.32, 0.55, 0.8], tone: true, crease: true, id: 20 }) : stoneMaterial(STONES.smoked, { seed: rng.int(0, 96), id: 20, grain: 0.07 });
  const base = new THREE19.Mesh(mergeToned(baseParts), baseMaterial);
  base.name = "base";
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
  const metalGeometry = mergeToned([...metalParts, ...leverParts]);
  const metal = new THREE19.Mesh(metalGeometry, metalMaterial(reader ? METALS.patinatedBronze : METALS.blackenedBrass, { id: 30, tone: true }));
  metal.name = "desk";
  metal.castShadow = true;
  metal.receiveShadow = true;
  group.add(metal);
  if (glowGeometry) {
    const glow = new THREE19.Mesh(glowGeometry, glowMixMaterial(glowColors, { id: 40 }));
    glow.name = "lights";
    group.add(glow);
  }
  const position = metalGeometry.attributes.position;
  const normal = metalGeometry.attributes.normal;
  let start = metalParts.reduce((sum, g) => sum + g.attributes.position.count, 0);
  const basePos = position.array.slice();
  const baseNormal = normal.array.slice();
  const axis = new THREE19.Vector3(1, 0, 0);
  const rot = new THREE19.Matrix4();
  const tmp = new THREE19.Vector3();
  for (const l of levers) {
    l.start = start;
    l.count = l.geometry.attributes.position.count;
    start += l.count;
  }
  const poseLever = (l) => {
    rot.makeRotationAxis(axis, l.down ? 0.75 : 0);
    for (let k = l.start; k < l.start + l.count; k++) {
      tmp.fromArray(basePos, k * 3).sub(l.pivot).applyMatrix4(rot).add(l.pivot);
      position.setXYZ(k, tmp.x, tmp.y, tmp.z);
      tmp.fromArray(baseNormal, k * 3).applyMatrix4(rot);
      normal.setXYZ(k, tmp.x, tmp.y, tmp.z);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
  };
  for (const l of levers) poseLever(l);
  const desk = {
    levers: levers.map((l) => l.down),
    setLever(i, down) {
      const l = levers[i];
      if (!l) return;
      l.down = !!down;
      desk.levers[i] = l.down;
      poseLever(l);
    },
    lights: 0,
    setLights(count) {
      desk.lights = Math.max(0, Math.min(lights.length, Math.round(count)));
      lights.forEach((_, i) => setRange(ranges[i], i < desk.lights ? AMBER_ON : AMBER_OFF));
    },
    cassette: false,
    setCassette(on) {
      desk.cassette = !!on;
      for (let i = lights.length; i < ranges.length; i++) setRange(ranges[i], on ? CYAN_ON : CYAN_OFF);
    }
  };
  if (lights.length) desk.setLights(p.lights);
  if (reader) desk.setCassette(p.cassette === "loaded");
  group.userData.desk = desk;
  group.userData.asset = { id: meta16.id, params: p };
  return group;
}

// src/assets/props/machines/wheel-valve.js
var wheel_valve_exports = {};
__export(wheel_valve_exports, {
  create: () => create17,
  dispose: () => disposeObject,
  meta: () => meta17,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE20 from "three";
var SIZES6 = { wall: "Murale (\xD8 0,22 m)", giant: "G\xE9ante (roue de \xD8 0,9 m)" };
var STATES5 = { still: "Immobile", cycle: "Tourne en boucle" };
var TURNS = 2;
var NEEDLE = 2.2;
var params17 = {
  seed: seedParam("Change l'angle de repos du volant, l'aiguille, l'usure de la poign\xE9e, le num\xE9ro de la plaque, les tons."),
  size: choiceParam("Taille", SIZES6, "Valve murale du Sas, ou valve g\xE9ante de la salle du C\u0153ur."),
  turn: numberParam("Ouverture", 0, 0, 1, "0 = ferm\xE9e, 1 = ouverte (deux tours de volant) ; l'aiguille du cadran suit.", { step: 0.05 }),
  state: choiceParam("Mouvement", STATES5, "Immobile, ou s'ouvre et se ferme en boucle (pour la regarder)."),
  height: numberParam("Hauteur", 1.2, 0.6, 3, "Valve murale : hauteur de l'axe du tuyau (commandes \xE0 1,10\u20131,30 m).", { step: 0.05, unit: "m" })
};
var meta17 = {
  id: "props/machines/wheel-valve",
  name: "Valve \xE0 volant",
  nameEn: "Wheel valve",
  category: "props",
  subcategory: "machines",
  description: "Valve du Complexe : volant de fonte \xE0 rayons sur une tige filet\xE9e, corps de bronze travers\xE9 par un tuyau de cuivre, petit cadran \xE0 aiguille. Murale (volant de 0,22 m) ou g\xE9ante (roue de 0,9 m \xE0 jante de bronze, plaque num\xE9rot\xE9e). Le volant tourne et l'aiguille suit : r\xE9glage, boucle ou pilotage par le sc\xE9nario. Fiches SAS-10, COE-08.",
  tags: [
    "valve",
    "vanne",
    "volant",
    "roue",
    "tige filet\xE9e",
    "cadran",
    "aiguille",
    "fonte",
    "bronze",
    "tuyau",
    "le complexe",
    "complexe",
    "ancien-tech",
    "machine",
    "commande",
    "anim\xE9",
    "pilotable",
    "int\xE9rieur",
    "wheel valve",
    "gate valve",
    "handwheel",
    "threaded stem",
    "gauge",
    "needle",
    "cast iron",
    "pipe",
    "ancient complex",
    "ancient-tech",
    "control",
    "animated",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol ; murale : au pied du mur (le mur est en z = 0, le volant regarde +z) ; g\xE9ante : au centre du socle, le tuyau suit l'axe x",
  footprint: { radius: 0.95, height: 1.85 },
  animated: ["valve"],
  params: params17,
  variants: variantsOf("size", params17.size)
};
function create17(given = {}) {
  const p = resolveParams(meta17.params, given);
  const giant = p.size === "giant";
  const wear = createRng(p.seed * 7919 + 17);
  const bronzeParts = [];
  const ironParts = [];
  const copperParts = [];
  let wheelCenter, stemAxis, dialAt, dialNormal, dialRadius;
  const wheelR = giant ? 0.45 : 0.11;
  const spokes = giant ? 6 : 5;
  if (!giant) {
    const h = p.height;
    const zc = 0.12;
    const pipe = plain(new THREE20.CylinderGeometry(0.06, 0.06, 0.8, 6));
    copperParts.push(orient(pipe, [0, h, zc], [1, 0, 0]));
    for (const x of [-0.32, 0.32]) {
      bronzeParts.push(beam([x, h, 0], [x, h, zc], PX * 1.2, PX * 1.4));
      bronzeParts.push(orient(ring({ radius: 0.06, height: PX * 2, y: -PX, thickness: PX * 0.8, segments: 6 }), [x, h, zc], [1, 0, 0]));
    }
    bronzeParts.push(withTone(buildBlock([0.35, 0.3, 0.2], [0, h, zc]), wear.range(-0.06, 0.04)));
    for (const s of [-1, 1]) bronzeParts.push(orient(ring({ radius: 0.06, height: 0.04, y: -0.02, thickness: 0.03, segments: 8 }), [s * 0.2, h, zc], [1, 0, 0]));
    bronzeParts.push(orient(buildLathe([[0, 0], [0.07, 0], [0.07, 0.05], [0.04, 0.09], [0, 0.09]], { segments: 8, facets: true }), [0, h, zc + 0.1], [0, 0, 1]));
    stemAxis = new THREE20.Vector3(0, 0, 1);
    wheelCenter = new THREE20.Vector3(0, h, zc + 0.3);
    for (let k = 0; k < 5; k++) {
      const g = plain(new THREE20.CylinderGeometry(0.018, 0.018, 0.022, 6));
      bronzeParts.push(withTone(orient(g, [0, h, zc + 0.19 + k * 0.022], [0, 0, 1]), k % 2 ? -0.35 : 0.1));
    }
    dialAt = new THREE20.Vector3(0.09, h + 0.15 + PX * 0.3, zc);
    dialNormal = new THREE20.Vector3(0, 1, 0.55).normalize();
    dialRadius = 0.055;
    bronzeParts.push(withTone(orient(buildLathe([[0, 0], [0.065, 0], [0.065, 0.03], [0, 0.03]], { segments: 10, facets: true }), dialAt.clone().addScaledVector(dialNormal, -0.03), dialNormal), -0.1));
  } else {
    const yPipe = 0.55;
    bronzeParts.push(withTone(buildBlock([0.95, 0.15, 0.75], [0, 0.075, 0]), -0.25));
    bronzeParts.push(withTone(buildBlock([0.7, 0.8, 0.5], [0, 0.15 + 0.4, 0]), wear.range(-0.06, 0.04)));
    const pipe = plain(new THREE20.CylinderGeometry(0.15, 0.15, 1.8, 12));
    copperParts.push(orient(pipe, [0, yPipe, 0], [1, 0, 0]));
    for (const s of [-1, 1]) {
      bronzeParts.push(withTone(orient(ring({ radius: 0.15, height: 0.06, y: -0.03, thickness: 0.06, segments: 12 }), [s * 0.4, yPipe, 0], [1, 0, 0]), 0.2));
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * Math.PI * 2;
        bronzeParts.push(withTone(buildBlock([0.09, PX, PX], [s * 0.4, yPipe + Math.cos(a) * 0.19, Math.sin(a) * 0.19]), 0.4));
      }
    }
    const top = 0.95;
    bronzeParts.push(buildLathe([[0, top], [0.2, top], [0.2, top + 0.08], [0.1, top + 0.16], [0, top + 0.16]], { segments: 12, facets: true }));
    for (const s of [-1, 1]) bronzeParts.push(beam([s * 0.14, top + 0.1, 0], [s * 0.14, 1.45, 0], 0.06, 0.08));
    bronzeParts.push(withTone(buildBlock([0.4, 0.08, 0.1], [0, 1.45, 0]), 0.1));
    for (let k = 0; k < 14; k++) {
      const g = plain(new THREE20.CylinderGeometry(0.035, 0.035, 0.03, 8));
      bronzeParts.push(withTone(orient(g, [0, top + 0.17 + k * 0.03, 0], [0, 1, 0]), k % 2 ? -0.35 : 0.12));
    }
    stemAxis = new THREE20.Vector3(0, 1, 0);
    wheelCenter = new THREE20.Vector3(0, 1.62, 0);
    bronzeParts.push(beam([0, 1.45, 0], [0, 1.6, 0], 0.05, 0.05));
    bronzeParts.push(withTone(ring({ radius: wheelR - 0.04, y: wheelCenter.y - 0.035, height: 0.07, thickness: 0.06, segments: 24 }), 0.15));
    bronzeParts.push(withTone(buildBlock([0.3, 0.16, PX * 0.4], [0, 0.35, 0.25 + PX * 0.2]), 0.3));
    const number = wear.int(1, 6);
    for (let i = 0; i < number; i++) bronzeParts.push(withTone(buildBlock([PX, 0.1, 4e-3], [(i - (number - 1) / 2) * PX * 2, 0.35, 0.25 + PX * 0.4]), -0.9));
    dialAt = new THREE20.Vector3(0.36 + PX * 0.3, 0.75, 0);
    dialNormal = new THREE20.Vector3(1, 0, 0);
    dialRadius = 0.1;
    bronzeParts.push(withTone(orient(buildLathe([[0, 0], [0.12, 0], [0.12, 0.03], [0, 0.03]], { segments: 12, facets: true }), dialAt.clone().addScaledVector(dialNormal, -0.03), dialNormal), -0.1));
  }
  const d = dial({ radius: dialRadius, position: dialAt, normal: dialNormal, ticks: giant ? 10 : 6, needle: null, depth: PX * 0.3 });
  bronzeParts.push(withTone(d.face, 0.55), withTone(d.marks, -0.9));
  const needleLength = dialRadius * 0.8;
  const needleLocal = withTone(buildBlock([PX * 0.5, needleLength, PX * 0.3], [0, needleLength / 2, PX * 0.6]), -1.1);
  const needleCount = needleLocal.attributes.position.count;
  const needleBase = needleLocal.attributes.position.array.slice();
  const needleNormals = needleLocal.attributes.normal.array.slice();
  bronzeParts.push(needleLocal);
  const dialFrame = faceMatrix(dialAt, dialNormal);
  const wheelLocal = [];
  if (!giant) wheelLocal.push(ring({ radius: wheelR - PX * 0.5, y: -PX * 0.5, height: PX, thickness: PX, segments: 14 }));
  wheelLocal.push(buildLathe([[0, -0.03], [giant ? 0.07 : 0.025, -0.03], [giant ? 0.07 : 0.025, 0.03], [0, 0.03]], { segments: 8, facets: true }));
  const spokeStart = wear.range(0, Math.PI * 2);
  for (let k = 0; k < spokes; k++) {
    const a = spokeStart + k / spokes * Math.PI * 2;
    const reach = giant ? wheelR - 0.06 : wheelR - PX * 0.5;
    wheelLocal.push(beam([0, 0, 0], [Math.cos(a) * reach, 0, Math.sin(a) * reach], giant ? 0.045 : PX * 0.7, giant ? 0.035 : PX * 0.7));
  }
  const knobA = spokeStart + Math.PI / spokes;
  const knob = buildLathe([[0, 0], [giant ? 0.03 : 0.012, 0], [giant ? 0.03 : 0.012, giant ? 0.14 : 0.05], [0, giant ? 0.16 : 0.06]], { segments: 6, facets: true });
  knob.translate(Math.cos(knobA) * (wheelR - 0.02), 0, Math.sin(knobA) * (wheelR - 0.02));
  wheelLocal.push(withTone(knob, wear.chance(0.5) ? 0.35 : 0.15));
  const wheelGeometry = mergeToned(wheelLocal.map((g) => g.attributes.aTone ? g : withTone(g, 0)));
  const group = new THREE20.Group();
  group.name = meta17.name;
  const bronzeGeometry = mergeToned(bronzeParts);
  const body = new THREE20.Mesh(bronzeGeometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  body.name = "body";
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const copper = new THREE20.Mesh(mergeToned(copperParts), metalMaterial(METALS.oxidizedCopper, { id: 31, steps: [0.28, 0.46, 0.68, 0.95] }));
  copper.name = "pipe";
  copper.castShadow = true;
  group.add(copper);
  const wheelPivot = new THREE20.Group();
  wheelPivot.position.copy(wheelCenter);
  wheelPivot.quaternion.setFromUnitVectors(new THREE20.Vector3(0, 1, 0), stemAxis);
  const wheel = new THREE20.Mesh(wheelGeometry, metalMaterial(METALS.castIron, { id: 32, tone: true }));
  wheel.name = "wheel";
  wheel.castShadow = true;
  wheelPivot.add(wheel);
  group.add(wheelPivot);
  const rest = wear.range(0, Math.PI * 2);
  const position = bronzeGeometry.attributes.position;
  const normal = bronzeGeometry.attributes.normal;
  const first = position.count - needleCount;
  const m = new THREE20.Matrix4();
  const nm = new THREE20.Matrix3();
  const v = new THREE20.Vector3();
  let shown = -1;
  const pose = (t) => {
    if (Math.abs(t - shown) < 1e-4) return;
    shown = t;
    wheel.rotation.y = rest - t * TURNS * Math.PI * 2;
    m.copy(dialFrame).multiply(new THREE20.Matrix4().makeRotationZ(-(-NEEDLE + 2 * NEEDLE * t)));
    nm.getNormalMatrix(m);
    for (let i = 0; i < needleCount; i++) {
      v.fromArray(needleBase, i * 3).applyMatrix4(m);
      position.setXYZ(first + i, v.x, v.y, v.z);
      v.fromArray(needleNormals, i * 3).applyMatrix3(nm).normalize();
      normal.setXYZ(first + i, v.x, v.y, v.z);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
  };
  const valve = {
    turn: p.turn,
    setTurn(t) {
      tween = null;
      cycling = false;
      valve.turn = THREE20.MathUtils.clamp(t, 0, 1);
      pose(valve.turn);
    },
    turnTo(t, seconds = 3) {
      tween = { from: valve.turn, to: THREE20.MathUtils.clamp(t, 0, 1), start: sharedUniforms.uTime.value, seconds };
    }
  };
  let tween = null;
  let cycling = p.state === "cycle";
  pose(valve.turn);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      if (tween) {
        cycling = false;
        const k = Math.min(1, (time - tween.start) / Math.max(0.01, tween.seconds));
        valve.turn = tween.from + (tween.to - tween.from) * k;
        if (k >= 1) tween = null;
      } else if (cycling) {
        const u = time % 8 / 8;
        valve.turn = u < 0.4 ? u / 0.4 : u < 0.5 ? 1 : u < 0.9 ? 1 - (u - 0.5) / 0.4 : 0;
      }
      pose(valve.turn);
    }
    baseUpdate(force);
  };
  group.userData.valve = valve;
  group.userData.asset = { id: meta17.id, params: p };
  return group;
}

// src/assets/props/tools/hand-lamp.js
var hand_lamp_exports = {};
__export(hand_lamp_exports, {
  create: () => create18,
  dispose: () => disposeObject,
  meta: () => meta18,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE21 from "three";
var POSES = { standing: "Debout (lentille en haut)", lying: "Couch\xE9e au sol", hand: "En main (origine au manche)" };
var STATES6 = { lit: "Allum\xE9e", off: "\xC9teinte" };
var BEAM_LENGTH = 2.6;
var params18 = {
  seed: seedParam("Change la longueur du manche, les bandes de cuir et leur usure, une bague de plus, le crochet du talon."),
  pose: choiceParam("Pose", POSES, "Debout, couch\xE9e au sol, ou en main : origine au milieu du manche et faisceau vers +z (userData.grip, userData.beamDirection)."),
  state: choiceParam("\xC9tat", STATES6, "Allum\xE9e (lentille vive) ou \xE9teinte (verre sombre)."),
  glow: glowParam("Couleur de la lentille et de sa lumi\xE8re.", { only: ["amber", "cyan"] }),
  halo: choiceParam("Halo", { off: "Sans halo", on: "\xC9claire le d\xE9cor (dans le noir)" }, "Allum\xE9e : \xE9claire le d\xE9cor devant elle dans le noir (une des lumi\xE8res de halo du moteur)."),
  beam: choiceParam("Faisceau", { off: "Sans faisceau", on: "C\xF4ne tram\xE9" }, "Allum\xE9e : un c\xF4ne de lumi\xE8re tram\xE9 de 2,6 m, qui s'efface au loin.")
};
var meta18 = {
  id: "props/tools/hand-lamp",
  name: "Lampe portative",
  nameEn: "Hand lamp",
  category: "props",
  subcategory: "tools",
  description: "Lampe \xE0 main du Complexe : manche gain\xE9 de cuir, bague et t\xEAte de laiton, lentille qui luit en ambre ou en cyan, crochet au talon. Debout, couch\xE9e ou en main (point de prise fourni) ; halo qui \xE9claire le d\xE9cor dans le noir, faisceau tram\xE9 en option. Fiche SAS-16.",
  tags: [
    "lampe portative",
    "lampe torche",
    "lampe",
    "lanterne de main",
    "lentille",
    "faisceau",
    "cuir",
    "laiton",
    "outil",
    "le complexe",
    "complexe",
    "ancien-tech",
    "objet de main",
    "lumi\xE8re",
    "int\xE9rieur",
    "hand lamp",
    "flashlight",
    "lamp",
    "hand lantern",
    "lens",
    "light beam",
    "leather",
    "brass",
    "tool",
    "ancient complex",
    "ancient-tech",
    "handheld",
    "light source",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; debout et couch\xE9e : origine au sol ; en main : origine au milieu du manche, faisceau vers +z",
  footprint: { radius: 0.14, height: 0.26 },
  animated: ["glow"],
  params: params18,
  variants: variantsOf("pose", params18.pose)
};
function create18(given = {}) {
  const p = resolveParams(meta18.params, given);
  const rng = createRng(p.seed * 7919 + 67);
  const lit = p.state === "lit";
  const parts = [];
  const handle = rng.range(0.14, 0.18);
  const r = 0.02;
  const tube = (r0, r1, z0, z1, tone, sides = 6) => {
    const g = buildLathe([[0, z0], [r0, z0], [r1, z1], [0, z1]], { segments: sides, axis: "z", facets: true });
    parts.push(withTone(g, tone));
  };
  tube(0.022, 0.022, 0, 0.016, 0.1);
  const hook = ring({ radius: 0.012, height: PX * 0.5, thickness: PX * 0.4, segments: 6 });
  hook.rotateZ(Math.PI / 2);
  hook.rotateY(rng.range(-0.5, 0.5));
  hook.translate(0, 0, -0.012);
  parts.push(withTone(plain(hook), 0.2));
  const bands = rng.int(5, 7);
  const leather = -0.62;
  for (let i = 0; i < bands; i++) {
    const z0 = 0.016 + handle * i / bands, z1 = 0.016 + handle * (i + 1) / bands;
    const wear = rng.chance(0.25) ? 0.12 : 0;
    tube(r, r, z0, z1, leather + (i % 2 ? 0.1 : 0) + wear);
  }
  const z = 0.016 + handle;
  tube(0.026, 0.026, z, z + 0.02, 0.25, 8);
  if (rng.chance(0.5)) {
    const zb = 0.016 + handle * rng.range(0.3, 0.6);
    tube(0.024, 0.024, zb, zb + 0.012, 0.18, 8);
  }
  tube(0.028, 0.05, z + 0.02, z + 0.065, 0.05, 8);
  tube(0.053, 0.053, z + 0.065, z + 0.08, 0.3, 8);
  const lensZ = z + 0.078;
  const total = lensZ + 6e-3;
  const lens = buildLathe([[0, lensZ - 4e-3], [0.042, lensZ - 4e-3], [0.042, lensZ + 4e-3], [0, lensZ + 4e-3]], { segments: 8, axis: "z", facets: true });
  let beamGeometry = null;
  if (lit && p.beam === "on") {
    const g = plain(new THREE21.CylinderGeometry(0.62, 0.045, BEAM_LENGTH, 10, 6, true));
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, lensZ + BEAM_LENGTH / 2);
    const pos = g.attributes.position;
    const cover2 = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) cover2[i] = 0.42 * Math.max(0, 1 - (pos.getZ(i) - lensZ) / BEAM_LENGTH) ** 1.4;
    g.setAttribute("aCover", new THREE21.BufferAttribute(cover2, 1));
    beamGeometry = g;
  }
  const place = new THREE21.Matrix4();
  if (p.pose === "standing") {
    place.makeRotationX(-Math.PI / 2);
  } else if (p.pose === "lying") {
    const tilt = Math.atan2(0.053 - 0.022, total);
    place.makeRotationX(-tilt).premultiply(new THREE21.Matrix4().makeTranslation(0, 0.022, -total / 2));
  } else {
    place.makeTranslation(0, 0, -(0.016 + handle / 2));
  }
  const group = new THREE21.Group();
  group.name = meta18.name;
  const bodyGeometry = mergeToned(parts);
  bodyGeometry.applyMatrix4(place);
  const body = new THREE21.Mesh(bodyGeometry, metalMaterial(METALS.blackenedBrass, { id: 21, tone: true }));
  body.name = "body";
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  lens.applyMatrix4(place);
  const lensMaterial = glowMaterial(p.glow, { level: lit ? 3 : 0, id: 22 });
  const lensMesh = new THREE21.Mesh(lens, lensMaterial);
  lensMesh.name = "lens";
  group.add(lensMesh);
  if (beamGeometry) {
    beamGeometry.applyMatrix4(place);
    const color = GLOWS[p.glow].ramp[2];
    const beamMesh = new THREE21.Mesh(beamGeometry, createToonMaterial({ ramp: [color, color], steps: [0.5], unlit: true, emissive: 0.01, glow: false, outline: false, dither: true, id: 23 }));
    beamMesh.name = "beam";
    group.add(beamMesh);
  }
  const toPlaced = (v) => v.applyMatrix4(place);
  const lightPoint = toPlaced(new THREE21.Vector3(0, 0, lensZ));
  const beamDirection = toPlaced(new THREE21.Vector3(0, 0, lensZ + 1)).sub(lightPoint).normalize();
  group.userData.grip = toPlaced(new THREE21.Vector3(0, 0, 0.016 + handle / 2));
  group.userData.beamDirection = beamDirection;
  group.userData.lightPoint = lightPoint;
  if (lit && p.halo === "on") {
    const halo = createGlowLight();
    lensMaterial.addEventListener("dispose", () => halo.release());
    const color = rgb(GLOWS[p.glow].light);
    const at = lightPoint.clone().addScaledVector(beamDirection, 0.6);
    const world = new THREE21.Vector3();
    const baseUpdate = group.updateMatrixWorld.bind(group);
    group.updateMatrixWorld = (force) => {
      baseUpdate(force);
      halo.set(group.localToWorld(world.copy(at)), color, 2.4, 1.2);
    };
  }
  group.userData.asset = { id: meta18.id, params: p };
  return group;
}

// src/fx/lamp-dust.js
import * as THREE22 from "three";
var COLORS = ["#7a3c16", "#c97a2e", "#f2b764"];
var SHADES = [0.15, 0.5, 0.85];
var SPECK = { points: [[-1, -1], [1, -1], [1, 1], [-1, 1]], triangles: [0, 1, 2, 0, 2, 3] };
var TAU = Math.PI * 2;
var SIZE3 = 0.032;
function createLampDust(sources, { perLamp = 10, lamps = 6, spread = 0.85, depth = 1.7 } = {}) {
  const rng = createRng(7331);
  const slots = Math.min(lamps, sources.length);
  const grains = [];
  const sprites = [];
  const origin = new THREE22.Vector3();
  for (let s = 0; s < slots; s++) {
    for (let i = 0; i < perLamp; i++) {
      grains.push({
        slot: s,
        angle: rng.range(0, TAU),
        distance: Math.sqrt(rng.next()) * spread,
        height: rng.range(-depth, 0.25),
        speed: rng.range(0.25, 0.6),
        phase: rng.range(0, TAU),
        drift: rng.range(0.08, 0.22)
      });
      sprites.push({ position: origin, ...SPECK, size: SIZE3, occlusion: SHADES[rng.int(0, 2)], phase: rng.next(), flex: 1 });
    }
  }
  const geometry = buildSpriteGeometry(sprites.length ? sprites : [{ position: origin, ...SPECK, size: 0 }]);
  const positions = geometry.attributes.position;
  const corners = geometry.attributes.aCorner;
  positions.setUsage(THREE22.DynamicDrawUsage);
  corners.setUsage(THREE22.DynamicDrawUsage);
  const rest = corners.array.slice();
  const material = createToonMaterial({ ramp: COLORS, steps: [0.33, 0.66], foliage: true, unlit: true, leafShade: [0, 1], twinkle: 0.5, id: 43, outline: false });
  const mesh = new THREE22.Mesh(geometry, material);
  mesh.name = "lamp dust";
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const order = sources.map((_, i) => i);
  const served = new Array(slots).fill(-1);
  const VERTICES = SPECK.points.length;
  let lastBeat = -1;
  let lastPick = -1;
  return {
    mesh,
    /**
     * @param {THREE.Vector3} focus point regardé
     * @param {THREE.Camera} [camera] en perspective (3e personne), un grain proche garderait sa taille dans le monde
     *   et deviendrait un gros carré : il est réduit pour rester d'un pixel d'art environ.
     */
    update(focus, camera) {
      const beat = sharedUniforms.uTime.value;
      if (beat === lastBeat && !camera?.isPerspectiveCamera) return;
      lastBeat = beat;
      const perspective = Boolean(camera?.isPerspectiveCamera);
      const perMeter = perspective ? 2 * Math.tan(THREE22.MathUtils.degToRad(camera.fov) / 2) / 300 : 0;
      if (Math.floor(beat * 2) !== lastPick) {
        lastPick = Math.floor(beat * 2);
        order.sort((a, b) => {
          const da = sources[a].on === false ? Infinity : sources[a].position.distanceToSquared(focus);
          const db = sources[b].on === false ? Infinity : sources[b].position.distanceToSquared(focus);
          return da - db;
        });
        for (let s = 0; s < slots; s++) {
          const source = sources[order[s]];
          served[s] = source && source.on !== false && source.position.distanceTo(focus) < 16 ? order[s] : -1;
        }
      }
      let vertex = 0;
      for (let g = 0; g < grains.length; g++) {
        const grain = grains[g];
        const index = served[grain.slot];
        const source = index >= 0 ? sources[index] : null;
        const wanted = source ? source.dust ?? perLamp : 0;
        const visible = source && g % perLamp < wanted;
        const a = grain.angle + beat * grain.drift;
        const r = grain.distance * (0.8 + 0.2 * Math.sin(beat * grain.speed + grain.phase));
        const x = source ? source.position.x + Math.cos(a) * r : 0;
        const z = source ? source.position.z + Math.sin(a) * r : 0;
        const y = source ? source.position.y + grain.height + Math.sin(beat * grain.speed * 0.7 + grain.phase * 2) * 0.18 : 0;
        let scale = visible ? 1 : 0;
        if (perspective && visible) {
          const d = Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z);
          scale = Math.min(1, d * perMeter * 0.8 / SIZE3);
        }
        for (let k = 0; k < VERTICES; k++, vertex++) {
          positions.setXYZ(vertex, x, y, z);
          corners.setXYZ(vertex, rest[vertex * 3] * scale, rest[vertex * 3 + 1] * scale, rest[vertex * 3 + 2]);
        }
      }
      positions.needsUpdate = true;
      corners.needsUpdate = true;
    },
    /** Une lampe s'est allumée ou éteinte : refaire le choix tout de suite. */
    refresh() {
      lastPick = -1;
      lastBeat = -1;
    },
    dispose() {
      geometry.dispose();
      material.userData.depthMaterial?.dispose();
      material.dispose();
    }
  };
}

// src/worlds/kit/sky.js
import * as THREE24 from "three";

// src/assets/nature/sky/cloud.js
import * as THREE23 from "three";
var KINDS2 = {
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
var params19 = {
  seed: seedParam("Change la silhouette : nombre, taille et place des boules, tours qui montent, longueur du nuage."),
  kind: choiceParam("Type", KINDS2, "Cumulus blanc et bomb\xE9, stratus en long banc plat, ou nuage d'orage sombre et haut."),
  size: numberParam("Longueur", 5, 2.5, 9, "Longueur du nuage ; toute la forme garde ses proportions.", { step: 0.5, unit: "m" })
};
var meta19 = {
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
  params: params19,
  variants: variantsOf("kind", params19.kind)
};

// src/worlds/kit/sky.js
var WORLD_UP = new THREE24.Vector3(0, 1, 0);
function createDaylight({ azimuth = THREE24.MathUtils.degToRad(-17), elevation = THREE24.MathUtils.degToRad(44), mapSize = 1024 } = {}) {
  const light = new THREE24.DirectionalLight(16777215, 1);
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = -15e-4;
  light.shadow.normalBias = 0.05;
  const direction = new THREE24.Vector3();
  const right = new THREE24.Vector3();
  const up = new THREE24.Vector3();
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
      const wanted = Math.ceil(THREE24.MathUtils.clamp(reach, 16, 90) / 8) * 8;
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

// src/worlds/kit/interior.js
import * as THREE25 from "three";
var _matrix = new THREE25.Matrix4();
var _q = new THREE25.Quaternion();
var _s = new THREE25.Vector3(1, 1, 1);
var _p = new THREE25.Vector3();
var _up = new THREE25.Vector3(0, 1, 0);
var IDENTITY = new THREE25.Matrix4();
var InteriorKit = class {
  constructor() {
    this.group = new THREE25.Group();
    this.group.name = "interior";
    this.models = /* @__PURE__ */ new Map();
    this.meshes = [];
  }
  /**
   * Déclare un modèle (créé une seule fois).
   * @param {string} key nom du modèle dans le monde
   * @param {{create: (params: object) => THREE.Group}} asset module de l'asset
   * @param {object} params réglages de l'asset
   * @param {object} [options]
   * @param {{rule: "wall"|"view", height: number}|null} [options.cut] vue en coupe
   * @param {boolean} [options.castShadow] faux : la copie ne projette pas d'ombre (dalles) ; par défaut, ce qui se
   *   cache avec la coupe (accroché aux murs, lampes) n'en projette pas : elle ne se verrait pas sur le mur
   * @param {{mesh: string, uniform: {value: THREE.Vector4}, off: string}|null} [options.reveal] lueurs qui
   *   s'allument en vague (`enableReveal`) : le maillage du modèle qui porte ce nom
   * @returns {THREE.Group} le modèle (pour lire ses `userData`)
   */
  model(key, asset, params35, { cut = null, castShadow = !(cut && cut.height < 0), reveal = null } = {}) {
    if (this.models.has(key)) return this.models.get(key).prototype;
    const prototype = asset.create(params35);
    this.models.set(key, { prototype, matrices: [], cut, castShadow, reveal, meshes: [] });
    return prototype;
  }
  /** Pose une copie du modèle `key` en (x, y, z), tournée de `rotY` (radians). Rend son numéro (`setVisible`). */
  place(key, x, z, rotY = 0, y = 0) {
    const model = this.models.get(key);
    if (!model) throw new Error(`mod\xE8le non d\xE9clar\xE9 : ${key}`);
    _q.setFromAxisAngle(_up, rotY);
    _matrix.compose(_p.set(x, y, z), _q, _s);
    model.matrices.push(..._matrix.elements);
    return model.matrices.length / 16 - 1;
  }
  /**
   * Montre ou cache une copie déjà construite (une lampe éteinte remplacée par la même allumée, posée deux fois :
   * une copie de chaque modèle, une seule visible). Cachée : réduite à un point, plus aucun triangle.
   */
  setVisible(key, index, visible) {
    const model = this.models.get(key);
    if (!model?.meshes.length) return;
    for (const mesh of model.meshes) {
      _matrix.fromArray(model.matrices, index * 16);
      if (mesh.userData.offset) _matrix.multiply(mesh.userData.offset);
      if (!visible) _matrix.scale(_p.set(0, 0, 0));
      mesh.setMatrixAt(index, _matrix);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  /** Construit les maillages instanciés. À appeler une fois tout posé. */
  build() {
    for (const [key, model] of this.models) {
      const count = model.matrices.length / 16;
      const parts = [];
      model.prototype.updateMatrixWorld(true);
      model.prototype.traverse((child) => {
        if (child.isMesh) parts.push(child);
      });
      if (count === 0) {
        disposeObject(model.prototype);
        continue;
      }
      const matrices = new THREE25.InstancedBufferAttribute(new Float32Array(model.matrices), 16);
      for (const part of parts) {
        const material = part.material;
        if (model.cut && material.isShaderMaterial && material.uniforms?.uRamp) enableCutaway(material, model.cut.rule, model.cut.height);
        if (model.reveal && part.name === model.reveal.mesh) enableReveal(material, model.reveal.uniform, model.reveal.off);
        const mesh = new THREE25.InstancedMesh(part.geometry, material, count);
        mesh.name = `${key} / ${part.name}`;
        mesh.instanceMatrix = matrices;
        if (!part.matrixWorld.equals(IDENTITY)) {
          const array = new Float32Array(count * 16);
          for (let i = 0; i < count; i++) _matrix.fromArray(model.matrices, i * 16).multiply(part.matrixWorld).toArray(array, i * 16);
          mesh.instanceMatrix = new THREE25.InstancedBufferAttribute(array, 16);
          mesh.userData.offset = part.matrixWorld.clone();
        }
        mesh.customDepthMaterial = material.userData.depthMaterial ?? part.customDepthMaterial;
        mesh.castShadow = model.castShadow && part.castShadow;
        mesh.receiveShadow = part.receiveShadow;
        mesh.matrixAutoUpdate = false;
        mesh.computeBoundingSphere();
        this.meshes.push(mesh);
        model.meshes.push(mesh);
        this.group.add(mesh);
      }
    }
  }
  /**
   * Fait vivre les modèles animés sur le processeur (rouages, tiroirs, scintillement : leur `updateMatrixWorld` réécrit
   * la géométrie quand le temps partagé change) : toutes leurs copies bougent ensemble. À appeler à chaque image.
   */
  update() {
    for (const model of this.models.values()) {
      if (model.meshes.length) model.prototype.updateMatrixWorld();
    }
  }
  /** Draw calls et triangles si tout était dans le champ. */
  stats() {
    let triangles = 0;
    for (const mesh of this.meshes) {
      const g = mesh.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3 * mesh.count;
    }
    return { meshes: this.meshes.length, triangles, models: this.models.size };
  }
  dispose() {
    for (const mesh of this.meshes) {
      disposeObject(mesh);
      mesh.dispose();
    }
    for (const model of this.models.values()) disposeObject(model.prototype);
    this.group.clear();
    this.meshes = [];
    this.models.clear();
  }
};
function createHaloPool(sources, slots = GLOW_LIGHT_COUNT - 1) {
  const lights = Array.from({ length: Math.min(slots, sources.length) }, () => createGlowLight());
  const colors = sources.map((source) => rgb(source.color));
  const score = new Float32Array(sources.length);
  const order = sources.map((_, i) => i);
  const frustum = new THREE25.Frustum();
  const viewProjection = new THREE25.Matrix4();
  const sphere = new THREE25.Sphere();
  let last = -1;
  return {
    /**
     * Réattribue les places (4 fois par seconde) autour de `focus`.
     * @param {THREE.Vector3} focus point regardé
     * @param {number} time secondes
     * @param {THREE.Camera} [camera] pour préférer les lampes dans le champ
     */
    update(focus, time, camera) {
      if (Math.floor(time * 4) === last) return;
      last = Math.floor(time * 4);
      if (camera) {
        viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(viewProjection);
      }
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        const seen = !camera || frustum.intersectsSphere(sphere.set(source.position, source.radius));
        score[i] = source.on === false ? Infinity : source.position.distanceTo(focus) + (seen ? 0 : 30);
      }
      order.sort((a, b) => score[a] - score[b]);
      lights.forEach((light, k) => {
        const source = sources[order[k]];
        light.set(source.position, colors[order[k]], source.radius, source.on === false ? 0 : source.strength ?? 1.1);
      });
    },
    /** Une lampe s'est allumée ou éteinte : réattribuer dès la prochaine mise à jour. */
    refresh() {
      last = -1;
    },
    dispose() {
      for (const light of lights) light.release();
    }
  };
}
var BoxColliders = class {
  constructor() {
    this.boxes = [];
  }
  /**
   * Boîte de centre (x, z) et de demi-côtés (hx, hz) ; `active()` : la boîte ne bloque que si vrai ; `top` : hauteur
   * de l'obstacle (un personnage sur une passerelle au-dessus passe).
   */
  add(x, z, hx, hz, active = null, top = Infinity) {
    this.boxes.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, active, top });
  }
  /** Repousse un disque de rayon `radius`, dont les pieds sont à `y`, hors des boîtes. */
  collide(position, radius, y = 0) {
    for (let pass = 0; pass < 2; pass++) {
      for (const box of this.boxes) {
        if (box.active && !box.active()) continue;
        if (y >= box.top) continue;
        const cx = THREE25.MathUtils.clamp(position.x, box.minX, box.maxX);
        const cz = THREE25.MathUtils.clamp(position.z, box.minZ, box.maxZ);
        const dx = position.x - cx;
        const dz = position.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          position.x = cx + dx / d * radius;
          position.z = cz + dz / d * radius;
        } else {
          const exits = [position.x - box.minX, box.maxX - position.x, position.z - box.minZ, box.maxZ - position.z];
          const k = exits.indexOf(Math.min(...exits));
          if (k === 0) position.x = box.minX - radius;
          else if (k === 1) position.x = box.maxX + radius;
          else if (k === 2) position.z = box.minZ - radius;
          else position.z = box.maxZ + radius;
        }
      }
    }
  }
  /** Vrai si le point (x, z), avec une marge, touche une boîte active. */
  blocked(x, z, margin = 0) {
    return this.boxes.some((box) => (!box.active || box.active()) && x > box.minX - margin && x < box.maxX + margin && z > box.minZ - margin && z < box.maxZ + margin);
  }
};
var WalkSurfaces = class {
  constructor({ stepUp = 0.4, headroom = 1.75, drop = 0.45 } = {}) {
    this.stepUp = stepUp;
    this.headroom = headroom;
    this.drop = drop;
    this.layers = [];
    this._last = /* @__PURE__ */ new WeakMap();
  }
  /** Pose un asset praticable : son `userData.walk`, en (x, y, z), tourné de `rotY`. */
  add(walk, x, z, rotY = 0, y = 0) {
    this.layers.push({ walk, x, y, z, c: Math.cos(rotY), s: Math.sin(rotY) });
  }
  /** Coordonnées (x, z) du monde dans le repère d'un asset posé. */
  _local(layer, x, z) {
    const dx = x - layer.x, dz = z - layer.z;
    return [layer.c * dx - layer.s * dz, layer.s * dx + layer.c * dz];
  }
  /** Hauteur du sol sous (x, z) pour des pieds à `y` : la plus haute surface atteinte d'un pas, au moins `base`. */
  heightAt(x, z, y = 0, base = 0) {
    let h = base;
    for (const layer of this.layers) {
      const [lx, lz] = this._local(layer, x, z);
      const top = layer.walk.heightAt(lx, lz, y - layer.y, this.stepUp) + layer.y;
      if (top > h) h = top;
    }
    return h;
  }
  /** Vrai si quelque chose occupe la tranche du corps d'un personnage de rayon `radius` aux pieds à `y`. */
  blocked(x, z, radius, y = 0) {
    for (const layer of this.layers) {
      const [lx, lz] = this._local(layer, x, z);
      const y0 = y - layer.y + this.stepUp, y1 = y - layer.y + this.headroom;
      if (layer.walk.occupied(lx, lz, radius, y0, y1)) return true;
    }
    return false;
  }
  /**
   * Refuse un pas bloqué ou qui ferait tomber : `position` revient le long de l'obstacle, ou à sa place d'avant.
   * @param {THREE.Vector3} position position voulue (modifiée)
   * @param {number} radius rayon du personnage
   * @param {number} y hauteur des pieds avant le pas
   * @param {(x: number, z: number, y: number) => number} floorAt sol du monde (étages compris)
   */
  collide(position, radius, y, floorAt) {
    const last = this._last.get(position);
    const ok = (x, z) => !this.blocked(x, z, radius, y) && floorAt(x, z, y) >= y - this.drop;
    if (last && !ok(position.x, position.z)) {
      if (ok(position.x, last.z)) position.z = last.z;
      else if (ok(last.x, position.z)) position.x = last.x;
      else {
        position.x = last.x;
        position.z = last.z;
      }
    }
    if (last) {
      last.x = position.x;
      last.z = position.z;
    } else this._last.set(position, { x: position.x, z: position.z });
  }
  /** Oublie la dernière place connue (le personnage a été reposé ailleurs). */
  forget(position) {
    this._last.delete(position);
  }
};

// src/worlds/ancient-complex-archives.js
import * as THREE40 from "three";

// src/assets/furniture/tables/card-catalogue.js
import * as THREE27 from "three";

// src/assets/furniture/lighting/articulated-lamp.js
var articulated_lamp_exports = {};
__export(articulated_lamp_exports, {
  create: () => create20,
  dispose: () => disposeObject,
  meta: () => meta20,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE26 from "three";
var KINDS3 = { reading: "Lecture (cloche ambre, 3 segments)", workshop: "Atelier (c\xF4ne noir, contrepoids)" };
var MOUNTS3 = { desk: "Pos\xE9e sur un socle", clamp: "Serr\xE9e par un \xE9tau (bord de table)", hanging: "Suspendue sous une tige" };
var STATES7 = { lit: "Allum\xE9e", dim: "En veille", off: "\xC9teinte" };
var HALOS2 = { off: "Sans halo", on: "\xC9claire le d\xE9cor (dans le noir)" };
var BASE3 = { lit: 2, dim: 1, off: 0 };
var FIXED3 = 255;
var PALE = { ramp: ["#4a3f22", "#a08c4a", "#f2e2a0", "#fff8dc"], light: "#ffe9a8" };
var params20 = {
  seed: seedParam("Change la pose du bras (angles des articulations), son orientation, la patine, le rythme du scintillement."),
  kind: choiceParam("Mod\xE8le", KINDS3, "Lampe de lecture des Archives (3 segments, cloche ambre) ou lampe d'atelier (2 bras, contrepoids, c\xF4ne noir)."),
  mount: choiceParam("Pose", MOUNTS3, "Sur un socle, serr\xE9e par un \xE9tau au bord d'une table (origine au ras du plateau), ou suspendue sous une tige (au-dessus du catalogue)."),
  state: choiceParam("\xC9tat", STATES7, "Allum\xE9e (scintillement lent), en veille (lueur faible) ou \xE9teinte."),
  halo: choiceParam("Halo", HALOS2, "\xC9claire le d\xE9cor autour d'elle dans le noir (une des 12 lumi\xE8res de halo de la sc\xE8ne)."),
  height: numberParam("Hauteur", 1.8, 1, 4, "Lampe suspendue : hauteur du point d'attache du bras au-dessus du sol (la tige monte au-dessus).", { step: 0.1, unit: "m" }),
  chain: numberParam("Tige", 1, 0.2, 4, "Lampe suspendue : longueur de la tige jusqu'au plafond.", { step: 0.1, unit: "m" })
};
var meta20 = {
  id: "furniture/lighting/articulated-lamp",
  name: "Lampe articul\xE9e",
  nameEn: "Articulated lamp",
  category: "furniture",
  subcategory: "lighting",
  description: "Lampe \xE0 bras articul\xE9 du Complexe : lampe de lecture des Archives (socle rond, trois segments de laiton, plots d'articulation, cloche de verre ambre qui luit) ou lampe d'atelier (deux bras, contrepoids, c\xF4ne noir \xE0 l'int\xE9rieur jaune p\xE2le). Pos\xE9e, serr\xE9e \xE0 un \xE9tau ou suspendue ; allum\xE9e, en veille ou \xE9teinte ; le bras se replie \xE0 la demande. Fiches ARC-06, ATE-09.",
  tags: [
    "lampe",
    "lampe de bureau",
    "lampe articul\xE9e",
    "bras",
    "abat-jour",
    "cloche",
    "contrepoids",
    "\xE9tau",
    "laiton",
    "ambre",
    "lecture",
    "atelier",
    "le complexe",
    "complexe",
    "ancien-tech",
    "\xE9clairage",
    "lumineux",
    "pilotable",
    "int\xE9rieur",
    "desk lamp",
    "articulated lamp",
    "task lamp",
    "arm",
    "lampshade",
    "bell shade",
    "counterweight",
    "clamp",
    "brass",
    "amber",
    "reading",
    "workshop",
    "ancient complex",
    "ancient-tech",
    "lighting",
    "glowing",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine sous le socle (sur le plateau), au ras du bord de la table pour l'\xE9tau (le plateau est en y = 0, z < 0), ou au sol \xE0 l'aplomb de la tige pour la lampe suspendue",
  footprint: { radius: 0.9, height: 2.8 },
  animated: ["flicker", "arm"],
  params: params20,
  variants: [
    { id: "reading", name: "Lecture, pos\xE9e", params: {} },
    { id: "workshop", name: "Atelier, \xE0 l'\xE9tau", params: { kind: "workshop", mount: "clamp" } },
    { id: "hanging", name: "Lecture, suspendue", params: { mount: "hanging" } },
    { id: "off", name: "Atelier \xE9teinte", params: { kind: "workshop", state: "off" } }
  ]
};
function create20(given = {}) {
  const p = resolveParams(meta20.params, given);
  const rng = createRng(p.seed * 7919 + 151);
  const reading = p.kind === "reading";
  const hanging = p.mount === "hanging";
  const lengths = reading ? [0.35, 0.35, 0.35] : [0.6, 0.6];
  const metal = [], glow = [];
  const rod = PX * (reading ? 0.6 : 0.75);
  let p0y;
  if (p.mount === "clamp") {
    metal.push([withTone(buildBlock([0.07, 0.04, 0.1], [0, 0.02, -0.04]), 0.05), FIXED3]);
    metal.push([withTone(buildBlock([0.07, 0.17, 0.04], [0, -0.045, 0.02]), -0.1), FIXED3]);
    metal.push([withTone(buildBlock([0.07, 0.03, 0.08], [0, -0.115, -0.02]), -0.05), FIXED3]);
    metal.push([withTone(beam([0, -0.17, -0.04], [0, -0.1, -0.04], PX * 0.5, PX * 0.5), 0.3), FIXED3]);
    metal.push([withTone(beam([-0.04, -0.17, -0.04], [0.04, -0.17, -0.04], PX * 0.5, PX * 0.5), 0.2), FIXED3]);
    p0y = 0.07;
    metal.push([withTone(buildBlock([0.05, 0.04, 0.05], [0, 0.055, -0.04]), 0.15), FIXED3]);
  } else if (hanging) {
    p0y = 0;
  } else {
    const r = reading ? 0.075 : 0.11;
    metal.push([withTone(buildLathe([[0, 0], [r, 0], [r, 0.022], [r * 0.6, 0.04], [0.02, 0.05], [0, 0.05]], { segments: 10, facets: true }), (x, y, z, nx, ny) => ny > 0.5 ? 0.1 : -0.1), FIXED3]);
    p0y = 0.06;
  }
  const P = [new THREE26.Vector3(0, p0y, 0)];
  for (const l of lengths) P.push(P[P.length - 1].clone().add(new THREE26.Vector3(0, l, 0)));
  lengths.forEach((l, k) => {
    const a = P[k], b = P[k + 1];
    const tone = k % 2 ? 0.05 : -0.05;
    if (reading) {
      metal.push([withTone(beam([0, a.y + 0.03, 0], [0, b.y - 0.02, 0], rod, rod), tone), k]);
    } else {
      for (const s of [-1, 1]) metal.push([withTone(beam([s * 0.025, a.y + 0.03, 0], [s * 0.025, b.y - 0.02, 0], rod * 0.7, rod), tone), k]);
      if (k === 0) metal.push([withTone(beam([0, a.y + 0.12, 0.035], [0, b.y - 0.12, 0.035], PX * 0.45, PX * 0.45), 0.35), k]);
      if (k === 1) {
        for (const s of [-1, 1]) metal.push([withTone(beam([s * 0.025, a.y - 0.24, 0], [s * 0.025, a.y, 0], rod * 0.7, rod), tone), k]);
        const weight = plain(new THREE26.CylinderGeometry(0.05, 0.05, 0.13, 8));
        weight.translate(0, a.y - 0.3, 0);
        metal.push([withTone(weight, -0.55), k]);
      }
    }
    const knuckle = plain(new THREE26.CylinderGeometry(PX * 0.9, PX * 0.9, reading ? 0.05 : 0.08, 8));
    knuckle.rotateZ(Math.PI / 2);
    knuckle.translate(0, a.y, 0);
    metal.push([withTone(knuckle, 0.25), k]);
  });
  const last = lengths.length - 1;
  const end = P[P.length - 1];
  const lightLocal = new THREE26.Vector3();
  if (reading) {
    const y = end.y;
    metal.push([withTone(buildLathe([[0, y - 0.02], [0.035, y - 0.02], [0.035, y + 0.02], [0, y + 0.02]], { segments: 8, facets: true }), 0.1), last]);
    const bell = buildLathe([[0.03, y + 0.015], [0.055, y + 0.05], [0.08, y + 0.11], [0.095, y + 0.135], [0, y + 0.135]], { segments: 10, facets: true });
    glow.push([bell, last]);
    metal.push([withTone(ring({ radius: 0.093, height: PX * 0.4, y: y + 0.13, thickness: PX * 0.4, segments: 10 }), 0.3), last]);
    lightLocal.set(0, y + 0.1, 0);
  } else {
    const y = end.y;
    const cone = buildLathe([[0.03, y], [0.05, y + 0.04], [0.14, y + 0.17], [0.175, y + 0.22], [0.165, y + 0.22], [0.13, y + 0.17], [0.04, y + 0.05], [0.02, y + 0.04]], { segments: 10, facets: true });
    metal.push([withTone(cone, -0.7), last]);
    metal.push([withTone(ring({ radius: 0.172, height: PX * 0.5, y: y + 0.215, thickness: PX * 0.35, segments: 10 }), 0.1), last]);
    const inner = buildLathe([[0.04, y + 0.06], [0.125, y + 0.17], [0.155, y + 0.205], [0, y + 0.205]], { segments: 10, facets: true });
    glow.push([inner, last]);
    glow.push([bulb({ radius: PX * 0.9, position: [0, y + 0.15, 0], segments: 6 }), last]);
    lightLocal.set(0, y + 0.18, 0);
  }
  if (hanging) {
    metal.push([withTone(beam([0, 0.04, 0], [0, p.chain, 0], PX * 0.6, PX * 0.6), 0.05), FIXED3]);
    metal.push([withTone(buildLathe([[0, p.chain], [0.08, p.chain], [0.08, p.chain + 0.03], [0, p.chain + 0.04]], { segments: 8, facets: true }), 0.1), FIXED3]);
    metal.push([withTone(buildBlock([0.06, 0.05, 0.06], [0, 0.03, 0]), 0.15), FIXED3]);
  }
  const group = new THREE26.Group();
  group.name = meta20.name;
  const metalMerged = mergeParts(metal);
  const entry = reading ? METALS.blackenedBrass : METALS.castIron;
  const metalMesh = new THREE26.Mesh(metalMerged.geometry, metalMaterial(entry, { id: 30, tone: true }));
  metalMesh.name = "arm";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  const glowMerged = mergeParts(glow);
  withShade(glowMerged.geometry, BASE3[p.state], 4);
  const light = reading ? GLOWS.amber : PALE;
  const glowMat = glowMixMaterial(reading ? glowLevels("amber") : [0, 1, 2, 3].map((l) => [PALE, l]), { id: 31 });
  const glowMesh = new THREE26.Mesh(glowMerged.geometry, glowMat);
  glowMesh.name = "shade";
  const holder = new THREE26.Group();
  holder.add(metalMesh, glowMesh);
  if (hanging) {
    holder.position.y = p.height;
    holder.rotation.z = Math.PI;
  }
  group.add(holder);
  const flicker = createFlicker(glowMerged.geometry, [{ start: 0, count: glowMerged.geometry.attributes.position.count, base: BASE3[p.state], phase: rng.next() }]);
  const rigs = [createRigidParts(metalMerged.geometry, metalMerged.partOf, lengths.length), createRigidParts(glowMerged.geometry, glowMerged.partOf, lengths.length)];
  const tmp = new THREE26.Matrix4();
  const arm = {
    yaw: 0,
    angles: [],
    lightPoint: new THREE26.Vector3(),
    setPose({ yaw: yaw2 = arm.yaw, angles: angles2 = arm.angles } = {}) {
      arm.yaw = yaw2;
      arm.angles = angles2.slice(0, lengths.length);
      const m = new THREE26.Matrix4().makeRotationY(yaw2);
      arm.angles.forEach((a, k) => {
        m.multiply(tmp.makeTranslation(0, P[k].y, 0)).multiply(tmp.makeRotationX(a)).multiply(tmp.makeTranslation(0, -P[k].y, 0));
        for (const rig of rigs) rig.matrices[k].copy(m);
      });
      for (const rig of rigs) rig.apply();
      arm.lightPoint.copy(lightLocal).applyMatrix4(rigs[0].matrices[last]);
      if (hanging) arm.lightPoint.set(-arm.lightPoint.x, p.height - arm.lightPoint.y, arm.lightPoint.z);
    }
  };
  const yaw = rng.range(-0.8, 0.8);
  let angles;
  if (hanging) {
    const a1 = rng.range(-0.35, 0.35), a2 = rng.range(0.6, 1.1) * (rng.chance(0.5) ? 1 : -1);
    angles = reading ? [a1, a2, -(a1 + a2) + rng.range(-0.15, 0.15)] : [a1, -a1 + rng.range(-0.2, 0.2)];
  } else if (reading) {
    const a1 = rng.range(-0.25, 0.08), a2 = rng.range(0.65, 1.05);
    angles = [a1, a2, rng.range(1.9, 2.35) - a1 - a2];
  } else {
    const a1 = rng.range(-0.35, 0.05);
    angles = [a1, rng.range(1.55, 1.85) - a1];
  }
  arm.setPose({ yaw, angles });
  const halo = p.halo === "on" && p.state !== "off" ? createGlowLight() : null;
  if (halo) glowMat.addEventListener("dispose", () => halo.release());
  const haloColor = rgb(light.light);
  const haloAt = new THREE26.Vector3();
  const reach = (p.state === "lit" ? 2.2 : 1.3) * (reading ? 1 : 1.3);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      flicker(time);
    }
    baseUpdate(force);
    if (halo) {
      const level = glowMerged.geometry.attributes.aShade.array[0] * 4 - 0.5;
      halo.set(group.localToWorld(haloAt.copy(arm.lightPoint)), haloColor, reach * (0.85 + 0.08 * level), 1 + 0.15 * level);
    }
  };
  group.userData.arm = arm;
  group.userData.lightPoint = arm.lightPoint;
  group.userData.asset = { id: meta20.id, params: p };
  return group;
}

// src/assets/furniture/tables/card-catalogue.js
var STATES8 = { tidy: "Rang\xE9", consulted: "Consult\xE9 (tiroirs tir\xE9s, cassettes sur le plateau)", dusty: "Abandonn\xE9 (poussi\xE8re)" };
var LAMPS = { lit: "Allum\xE9e", dim: "En veille", off: "\xC9teinte", none: "Sans lampe" };
var HALOS3 = { off: "Sans halo", on: "\xC9claire le d\xE9cor (dans le noir)" };
var LIVES = { on: "Le pupitre tourne, un tiroir sort de temps en temps", off: "Immobile" };
var SECTORS = 8;
var PER = 3;
var ROWS = [0.34, 0.53];
var FACE_H = 0.15;
var RD = 1.6;
var DEPTH5 = 0.5;
var TRAVEL = 0.42;
var TOP2 = 0.98;
var ROT = SECTORS * PER * ROWS.length;
var FIXED4 = 255;
var GLOW_COLORS = [["amber", 2], [DATA_GLOWS.amber, 2], [DATA_GLOWS.cyan, 2], [DATA_GLOWS.green, 2], [DATA_GLOWS.red, 2], ["amber", 0]];
var G_GLYPH = 0;
var G_DIM = 5;
var params21 = {
  seed: seedParam("Change les tiroirs tir\xE9s, le contenu des casiers (couleurs, vides), les tons des dalles et des plaques, les glyphes, la pose de la lampe, le rythme de la vie."),
  state: choiceParam("\xC9tat", STATES8, "Rang\xE9, consult\xE9 (deux ou trois tiroirs tir\xE9s, cassettes et carnet pos\xE9s sur le plateau), ou abandonn\xE9 (poussi\xE8re, lampe \xE9teinte, glyphes \xE9teints, casiers \xE0 moiti\xE9 vides)."),
  lamp: choiceParam("Lampe", LAMPS, "La lampe de lecture articul\xE9e suspendue au-dessus : allum\xE9e, en veille, \xE9teinte, ou pas de lampe (le monde en pose une \xE0 part)."),
  halo: choiceParam("Halo", HALOS3, "La lampe \xE9claire le d\xE9cor autour d'elle dans le noir (une des lumi\xE8res de halo de la sc\xE8ne)."),
  stem: numberParam("Tige", 0.6, 0.2, 4.2, "Longueur de la tige de la lampe, de son attache (2,8 m) au plafond (4,2 m sous la vo\xFBte des Archives).", { step: 0.1, unit: "m" }),
  life: choiceParam("Vie", LIVES, "Le pupitre central tourne d'un cran de temps en temps et un tiroir sort puis rentre ; ou immobile (le sc\xE9nario pilote).")
};
var meta21 = {
  id: "furniture/tables/card-catalogue",
  name: "Meuble-catalogue",
  nameEn: "Card catalogue",
  category: "furniture",
  subcategory: "tables",
  description: "Le meuble-catalogue central des Archives du Complexe (\u2605) : table ronde de \xD8 3,4 m sur socle de pierre fum\xE9e, 48 tiroirs plats \xE0 plaques d'index de laiton, plateau en 8 dalles \xE0 trait de glyphes ambre, pupitre central tournant \xE0 8 casiers de cassettes lumineuses, lampe de lecture articul\xE9e suspendue au-dessus. Rang\xE9, consult\xE9 ou abandonn\xE9 ; le pupitre tourne et les tiroirs sortent seuls, ou au gr\xE9 du sc\xE9nario. Fiche ARC-17.",
  tags: [
    "catalogue",
    "meuble-catalogue",
    "fichier",
    "tiroirs",
    "plaques d'index",
    "pupitre tournant",
    "casiers",
    "cassettes",
    "table ronde",
    "glyphes",
    "pierre fum\xE9e",
    "bronze",
    "archives",
    "le complexe",
    "complexe",
    "ancien-tech",
    "h\xE9ros",
    "pilotable",
    "anim\xE9",
    "int\xE9rieur",
    "card catalogue",
    "index drawers",
    "round table",
    "rotating lectern",
    "pigeonholes",
    "data cassettes",
    "glyphs",
    "smoked stone",
    "archive room",
    "ancient complex",
    "ancient-tech",
    "hero asset",
    "scriptable",
    "animated",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol au centre ; plateau \xE0 0,98 m, pupitre \xE0 1,6 m, lampe attach\xE9e \xE0 2,8 m",
  footprint: { radius: 2.1, height: 3.2 },
  animated: ["life"],
  params: params21,
  variants: variantsOf("state", params21.state)
};
function create21(given = {}) {
  const p = resolveParams(meta21.params, given);
  const rng = createRng(p.seed * 7919 + 233);
  const dusty = p.state === "dusty";
  const at = (r, a, y) => new THREE27.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  const stone = [], bronze = [], glow = [];
  const sector = Math.PI * 2 / SECTORS;
  const pil = 0.09 / RD;
  const socle = plain(new THREE27.CylinderGeometry(1.48, 1.52, 0.22, 24));
  socle.translate(0, 0.11, 0);
  stone.push([withTone(socle, (x, y, z, nx, ny) => ny > 0.5 ? -0.15 : -0.32), FIXED4]);
  bronze.push([withTone(ring({ radius: RD - 0.04, height: 0.1, y: 0.22, thickness: 0.07, segments: 24 }), -0.1), FIXED4]);
  const core = plain(new THREE27.CylinderGeometry(RD - 0.035, RD - 0.035, 0.42, 24, 1, true));
  core.translate(0, 0.32 + 0.21, 0);
  bronze.push([withTone(core, -0.75), FIXED4]);
  for (let s = 0; s < SECTORS; s++) {
    const a = s * sector;
    const pilaster = buildBlock([0.09, 0.42, 0.07], [0, 0.53, 0]);
    pilaster.rotateY(a).translate(...at(RD + 0.01, a, 0).toArray());
    bronze.push([withTone(pilaster, (x, y, z, nx, ny) => ny > 0.5 ? 0.1 : 0.02), FIXED4]);
    const tag = buildBlock([0.05, 0.04, 0.012], [0, 0.69, 0]);
    tag.rotateY(a).translate(...at(RD + 0.05, a, 0).toArray());
    bronze.push([withTone(tag, 0.5), FIXED4]);
  }
  bronze.push([withTone(ring({ radius: RD - 0.02, height: 0.16, y: 0.72, thickness: 0.06, segments: 24 }), (x, y, z, nx, ny) => ny > 0.5 ? 0.15 : -0.02), FIXED4]);
  const slabs = [];
  for (let s = 0; s < SECTORS; s++) {
    const a0 = s * sector + 4e-3, a1 = (s + 1) * sector - 4e-3;
    const pts = [];
    const segs = 3;
    for (let k = 0; k <= segs; k++) pts.push([Math.sin(a0 + (a1 - a0) * k / segs) * 1.72, Math.cos(a0 + (a1 - a0) * k / segs) * 1.72]);
    for (let k = segs; k >= 0; k--) pts.push([Math.sin(a0 + (a1 - a0) * k / segs) * 0.66, Math.cos(a0 + (a1 - a0) * k / segs) * 0.66]);
    const half = (k0, k1) => [...pts.slice(k0, k1 + 1), ...pts.slice(pts.length - 1 - k1, pts.length - k0)];
    const base = rng.range(-0.08, 0.06) + (dusty ? 0.12 : 0);
    slabs.push(base);
    for (const [k0, k1] of [[0, 1], [1, 2], [2, 3]]) {
      stone.push([withTone(buildPrism(half(k0, k1), TOP2 - 0.1, () => TOP2), (x, y, z, nx, ny) => ny > 0.5 ? base : base - 0.18), FIXED4]);
    }
  }
  bronze.push([withTone(ring({ radius: 0.6, height: 0.13, y: TOP2 - 0.11, thickness: 0.06, segments: 16 }), 0.1), FIXED4]);
  const glyphs = glyphStrip(rng, { length: Math.PI * 2 * 1.56 - 0.1, rows: 2, depth: 6e-3 });
  glyphs.rotateX(-Math.PI / 2);
  bendAroundY(glyphs, 1.6, { concave: false });
  glyphs.translate(0, TOP2 - 2e-3, 0);
  glow.push([withShade(glyphs, dusty ? G_DIM : G_GLYPH, GLOW_COLORS.length), FIXED4]);
  for (let s = 0; s < SECTORS; s++) {
    const a = s * sector;
    const inlay = buildBlock([PX * 0.6, 6e-3, 1.72 - 0.66 - 0.04], [0, TOP2 + 1e-3, (1.72 + 0.66) / 2]);
    inlay.rotateY(a);
    bronze.push([withTone(inlay, 0.4 - (dusty ? 0.2 : 0)), FIXED4]);
  }
  bronze.push([withTone(ring({ radius: 0.92, height: 6e-3, y: TOP2 - 3e-3, thickness: PX * 0.6, segments: 24 }), 0.35 - (dusty ? 0.2 : 0)), FIXED4]);
  bronze.push([withTone(ring({ radius: 1.72, height: PX * 0.6, y: TOP2 - 0.03, thickness: 6e-3, segments: 24 }), 0.3), FIXED4]);
  const drawerInfo = [];
  const span = (sector - pil) / PER;
  const faceW = 2 * RD * Math.sin(span / 2) - 0.035;
  ROWS.forEach((y0, row) => {
    for (let s = 0; s < SECTORS; s++) {
      for (let i = 0; i < PER; i++) {
        const k = row * SECTORS * PER + s * PER + i;
        const a = s * sector + pil / 2 + (i + 0.5) * span;
        const y = y0 + FACE_H / 2;
        const tone = rng.range(-0.1, 0.04) + (dusty ? 0.08 : 0);
        const parts = [
          withTone(buildBlock([faceW, FACE_H, DEPTH5], [0, y, -DEPTH5 / 2]), (x, py, z, nx, ny, nz) => nz > 0.5 ? tone : tone - 0.25),
          withTone(buildBlock([0.1, 0.035, 0.012], [0, y + 0.035, 6e-3]), rng.range(0.4, 0.55) - (dusty ? 0.15 : 0)),
          // plaque
          withTone(buildBlock([0.08, PX * 0.6, 0.03], [0, y - 0.03, 0.015]), 0.1)
          // poignée
        ];
        for (const g of parts) {
          g.rotateY(a).translate(...at(RD, a, 0).toArray());
          bronze.push([g, k]);
        }
        drawerInfo.push({ angle: a, y, u: 0, tween: null });
      }
    }
  });
  const turntable = plain(new THREE27.CylinderGeometry(0.58, 0.58, 0.04, 16));
  turntable.translate(0, TOP2 + 0.02, 0);
  bronze.push([withTone(turntable, 0.05), ROT]);
  const octo = (r, y0, y1, tone) => {
    const pts = [];
    for (let f = 0; f < 8; f++) pts.push([Math.sin((f + 0.5) * sector) * r, Math.cos((f + 0.5) * sector) * r]);
    bronze.push([withTone(buildPrism(pts, y0, () => y1), tone), ROT]);
  };
  const B0 = TOP2 + 0.04, B1 = 1.42;
  octo(0.46 / Math.cos(sector / 2), B0, B1, -0.6);
  const apo = 0.46;
  const faceWidth = 2 * apo * Math.tan(sector / 2);
  const kinds = [1, 2, 3, 4];
  for (let f = 0; f < 8; f++) {
    const a = f * sector;
    const frame = [
      buildBlock([faceWidth, 0.05, 0.06], [0, B1 - 0.025, 0.03]),
      buildBlock([faceWidth, 0.04, 0.08], [0, B0 + 0.02, 0.04]),
      buildBlock([0.04, B1 - B0, 0.06], [-faceWidth / 2 + 0.02, (B0 + B1) / 2, 0.03]),
      buildBlock([0.04, B1 - B0, 0.06], [faceWidth / 2 - 0.02, (B0 + B1) / 2, 0.03]),
      buildBlock([faceWidth - 0.08, PX * 0.6, 0.04], [0, (B0 + B1) / 2 + 0.02, 0.02])
      // tablette du milieu
    ];
    frame.forEach((g, j) => {
      withTone(g, j === 0 ? 0.12 : j === 4 ? -0.15 : 0);
      g.rotateY(a).translate(...at(apo, a, 0).toArray());
      bronze.push([g, ROT]);
    });
    const plate = buildBlock([0.12, 0.03, 0.01], [0, B1 - 0.025, 0.065]);
    plate.rotateY(a).translate(...at(apo, a, 0).toArray());
    bronze.push([withTone(plate, 0.5), ROT]);
    for (const [yb, h] of [[B0 + 0.045, 0.1], [(B0 + B1) / 2 + 0.03, 0.1]]) {
      const n = dusty ? rng.int(0, 3) : rng.int(3, 6);
      const color = rng.pick(kinds);
      const quads = [];
      for (let c = 0; c < n; c++) {
        const x = -faceWidth / 2 + 0.07 + c * PX * 1.6 + (c >= 3 ? 0.03 : 0);
        quads.push({ position: [x, yb + h / 2, 0.012], size: [PX * 0.7, h - rng.range(0, 0.03)] });
      }
      if (!quads.length) continue;
      const g = buildQuads(quads);
      g.rotateY(a).translate(...at(apo, a, 0).toArray());
      glow.push([withShade(g, rng.chance(0.2) ? rng.pick(kinds) : color, GLOW_COLORS.length), ROT]);
    }
  }
  octo(0.52 / Math.cos(sector / 2), B1, B1 + 0.05, 0.12);
  octo(0.3 / Math.cos(sector / 2), B1 + 0.05, B1 + 0.09, -0.05);
  const knob = plain(new THREE27.SphereGeometry(0.07, 8, 5));
  knob.translate(0, B1 + 0.16, 0);
  bronze.push([withTone(knob, 0.45), ROT]);
  const stemK = plain(new THREE27.CylinderGeometry(0.025, 0.035, 0.08, 6));
  stemK.translate(0, B1 + 0.11, 0);
  bronze.push([withTone(stemK, 0.2), ROT]);
  const pulledAtStart = p.state === "consulted" ? [rng.int(0, 47), rng.int(0, 47), ...rng.chance(0.5) ? [rng.int(0, 47)] : []] : dusty ? [rng.int(24, 47)] : [];
  if (p.state === "consulted") {
    const near = drawerInfo[pulledAtStart[0]].angle;
    for (let c = 0; c < rng.int(2, 4); c++) {
      const a2 = near + rng.range(-0.25, 0.25), r = rng.range(1.15, 1.5);
      const cas = buildBlock([0.18, 0.02, 0.1], [0, TOP2 + 0.01, 0]);
      cas.rotateY(rng.range(0, Math.PI)).translate(...at(r, a2, 0).toArray());
      bronze.push([withTone(cas, -0.45), FIXED4]);
      const edge = buildBlock([0.18, 6e-3, 0.012], [0, TOP2 + 0.022, 0.045]);
      edge.rotateY(rng.range(0, Math.PI)).translate(...at(r, a2, 0).toArray());
      glow.push([withShade(edge, rng.pick(kinds), GLOW_COLORS.length), FIXED4]);
    }
    const a = rng.chance(0.5) ? 0.35 : -0.35;
    const book = [
      withTone(buildBlock([0.34, 0.025, 0.24], [0, TOP2 + 0.0125, 0]), -0.6),
      withTone(buildBlock([0.15, 0.012, 0.21], [-0.08, TOP2 + 0.031, 0], [0, 0, 0.05]), 0.45),
      withTone(buildBlock([0.15, 0.012, 0.21], [0.08, TOP2 + 0.031, 0], [0, 0, -0.05]), 0.4)
    ];
    const spin = rng.range(0, Math.PI);
    for (const g of book) {
      g.rotateY(spin).translate(...at(1.3, near + a, 0).toArray());
      bronze.push([g, FIXED4]);
    }
  }
  const group = new THREE27.Group();
  group.name = meta21.name;
  const order = (list) => [...list.filter(([, k]) => k === FIXED4), ...list.filter(([, k]) => k !== FIXED4)];
  const stoneMesh = new THREE27.Mesh(mergeParts(stone).geometry, stoneMaterial(STONES.smoked, { seed: p.seed, id: 20 }));
  stoneMesh.name = "stone";
  const bronzeMerged = mergeParts(order(bronze));
  const bronzeMesh = new THREE27.Mesh(bronzeMerged.geometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronzeMesh.name = "bronze";
  const glowMerged = mergeParts(order(glow));
  const glowMesh = new THREE27.Mesh(glowMerged.geometry, glowMixMaterial(GLOW_COLORS, { id: 40 }));
  glowMesh.name = "glow";
  for (const mesh of [stoneMesh, bronzeMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(stoneMesh, bronzeMesh, glowMesh);
  const rigs = [createRigidParts(bronzeMerged.geometry, bronzeMerged.partOf, ROT + 1), createRigidParts(glowMerged.geometry, glowMerged.partOf, ROT + 1)];
  let lamp = null;
  if (p.lamp !== "none") {
    lamp = create20({
      seed: p.seed,
      kind: "reading",
      mount: "hanging",
      state: dusty ? "off" : p.lamp,
      halo: p.halo,
      height: 2.8,
      chain: p.stem
    });
    lamp.name = "lamp";
    group.add(lamp);
  }
  const ease2 = (x) => x * x * (3 - 2 * x);
  const time = () => sharedUniforms.uTime.value;
  const turn = { k: rng.int(0, 7), from: 0, to: 0, start: 0, seconds: 0 };
  turn.from = turn.to = -turn.k * sector;
  let life = p.life === "on";
  let dirty = true;
  const catalogue = {
    drawers: drawerInfo.length,
    /** Centre de la façade du tiroir i (repère de l'asset), pour qu'un personnage s'y place. */
    drawerFront: (i) => at(RD + 0.05, drawerInfo[i].angle, drawerInfo[i].y),
    openness: (i) => drawerInfo[i]?.u ?? 0,
    setDrawer(i, u) {
      const d = drawerInfo[i];
      if (!d) return;
      d.u = THREE27.MathUtils.clamp(u, 0, 1);
      d.tween = null;
      dirty = true;
    },
    slide(i, u, seconds = 1) {
      const d = drawerInfo[i];
      if (!d) return;
      d.tween = { from: d.u, to: THREE27.MathUtils.clamp(u, 0, 1), start: time(), seconds, then: null };
    },
    /** Tourne le pupitre jusqu'au casier k (0..7) face à +z. */
    turnTo(k, seconds = 1.2) {
      const cur = turn.from + (turn.to - turn.from) * ease2(THREE27.MathUtils.clamp((time() - turn.start) / Math.max(1e-3, turn.seconds), 0, 1));
      let target = -((k % 8 + 8) % 8) * sector;
      while (target - cur > Math.PI) target -= Math.PI * 2;
      while (cur - target > Math.PI) target += Math.PI * 2;
      Object.assign(turn, { k: (k % 8 + 8) % 8, from: cur, to: target, start: time(), seconds });
    },
    /** La consultation : le pupitre tourne vers le tiroir i, le tiroir sort, reste, puis rentre. */
    consult(i, seconds = 4) {
      const d = drawerInfo[i];
      if (!d) return;
      catalogue.turnTo(Math.round(-d.angle / sector));
      d.tween = { from: d.u, to: 1, start: time(), seconds: 0.9, then: { to: 0, after: seconds, seconds: 0.9 } };
    },
    setLife(on) {
      life = Boolean(on);
    }
  };
  for (const i of pulledAtStart) catalogue.setDrawer(i, rng.chance(0.5) ? 0.55 : 1);
  const period = rng.range(7, 11);
  const phase = rng.range(0, period);
  let lastBeat = -1;
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + p.seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  let lastAngle = NaN;
  const m = new THREE27.Matrix4();
  group.updateMatrixWorld = (force) => {
    const now = time();
    if (now !== lastTime || dirty) {
      lastTime = now;
      if (life && !dusty) {
        const beat = Math.floor((now + phase) / period);
        if (beat !== lastBeat) {
          if (lastBeat >= 0) {
            if (hash(beat) < 0.5) catalogue.turnTo(turn.k + (hash(beat + 0.5) < 0.5 ? 1 : -1));
            else {
              const i = Math.floor(hash(beat + 0.25) * drawerInfo.length);
              if (drawerInfo[i].u === 0 && !drawerInfo[i].tween) drawerInfo[i].tween = { from: 0, to: 0.6, start: now, seconds: 0.8, then: { to: 0, after: 2.5, seconds: 0.8 } };
            }
          }
          lastBeat = beat;
        }
      }
      drawerInfo.forEach((d, i) => {
        if (d.tween) {
          const k = THREE27.MathUtils.clamp((now - d.tween.start) / d.tween.seconds, 0, 1);
          d.u = d.tween.from + (d.tween.to - d.tween.from) * ease2(k);
          if (k >= 1) {
            const then = d.tween.then;
            d.tween = then ? { from: d.u, to: then.to, start: now + then.after, seconds: then.seconds, then: null } : null;
          }
          dirty = true;
        }
        const out = at(d.u * TRAVEL, d.angle, 0);
        for (const rig of rigs) rig.matrices[i].makeTranslation(out.x, 0, out.z);
      });
      const tk = THREE27.MathUtils.clamp((now - turn.start) / Math.max(1e-3, turn.seconds), 0, 1);
      const angle = turn.from + (turn.to - turn.from) * ease2(tk);
      for (const rig of rigs) rig.matrices[ROT].copy(m.makeRotationY(angle));
      if (dirty || angle !== lastAngle) {
        lastAngle = angle;
        for (const rig of rigs) rig.apply();
      }
      dirty = false;
    }
    baseUpdate(force);
  };
  group.updateMatrixWorld(true);
  group.userData.catalogue = catalogue;
  group.userData.surface = { height: TOP2, radius: 1.7, inner: 0.66 };
  if (lamp) group.userData.lightPoint = lamp.userData.lightPoint;
  group.userData.asset = { id: meta21.id, params: p };
  return group;
}

// src/assets/buildings/structure/grating-walkway.js
var grating_walkway_exports = {};
__export(grating_walkway_exports, {
  create: () => create22,
  dispose: () => disposeObject,
  meta: () => meta22,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE28 from "three";
var MODELS7 = { mezzanine: "Mezzanine (lisse simple, plinthe)", ring: "Anneau (double lisse)" };
var SHAPES2 = { straight: "Droite", arc: "En arc de cercle" };
var BACKS = { wall: "Adoss\xE9e \xE0 un mur (consoles)", free: "Libre (piliers, garde-corps des deux c\xF4t\xE9s)" };
var ENDS = { closed: "Garde-corps aux deux bouts", open: "Bouts ouverts (contre les murs)" };
var OPENINGS2 = { none: "Aucune", start: "Au d\xE9but", middle: "Au milieu", end: "\xC0 la fin" };
var RAIL_H = 1;
var DECK = 0.06;
var BAR = PX * 2;
var params22 = {
  seed: seedParam("Change la patine barreau par barreau, une plaque remplac\xE9e, un barreau arrach\xE9, un poteau pench\xE9, le profil des consoles."),
  model: choiceParam("Mod\xE8le", MODELS7, "Mezzanine (lisse simple, sous-lisse et plinthe : Archives, \xC9veil) ou anneau (double lisse : salle 6, C\u0153ur)."),
  shape: choiceParam("Trac\xE9", SHAPES2, "Passerelle droite (le long d'un mur) ou en arc de cercle (balcon d'une salle ronde)."),
  back: choiceParam("Appui", BACKS, "Adoss\xE9e \xE0 un mur (c\xF4t\xE9 \u2212z, ou c\xF4t\xE9 ext\xE9rieur de l'arc) sur des consoles de pierre, ou libre sur des piliers."),
  length: numberParam("Longueur", 6, 2, 24, "Passerelle droite : longueur (18 m : mezzanine des Archives ; 12 m : galerie de l'\xC9veil).", { step: 0.5, unit: "m" }),
  width: numberParam("Largeur", 1.2, 0.8, 2, "Largeur du plancher (1,2 m : mezzanine ; 1,5 m : passerelle du C\u0153ur ; 1 m : balcon de la salle 6).", { step: 0.1, unit: "m" }),
  radius: numberParam("Rayon int\xE9rieur", 4.5, 2, 6, "En arc : rayon du bord int\xE9rieur (c\xF4t\xE9 vide).", { step: 0.25, unit: "m" }),
  angle: numberParam("Angle", 150, 30, 180, "En arc : angle couvert, centr\xE9 sur +z (un balcon de 300\xB0 se pose en deux arcs de 150\xB0).", { step: 10, unit: "\xB0" }),
  height: numberParam("Hauteur", 3.4, 1, 6, "Hauteur du dessus du plancher (3,4 m : Archives ; 3 m : \xC9veil ; 4 m : salle 6 et C\u0153ur).", { step: 0.1, unit: "m" }),
  ends: choiceParam("Bouts", ENDS, "Garde-corps en travers des deux bouts, ou bouts ouverts (la passerelle va d'un mur \xE0 l'autre)."),
  opening: choiceParam("Trou\xE9e", OPENINGS2, "Une trou\xE9e de 1 m dans le garde-corps c\xF4t\xE9 vide, pour l'arriv\xE9e d'un escalier (le monde peut en donner d'autres : `openings`).")
};
var meta22 = {
  id: "buildings/structure/grating-walkway",
  name: "Passerelle en caillebotis",
  nameEn: "Grating walkway",
  category: "buildings",
  subcategory: "structure",
  description: "Passerelle du Complexe : plancher de bronze perc\xE9 d'un quadrillage d'un pixel (on voit au travers), poutrelles, consoles de pierre ancr\xE9es au mur ou piliers, garde-corps de 1 m \xE0 lisse simple ou double. Droite (mezzanine des Archives, galerie de l'\xC9veil) ou en arc (balcon de la salle 6, anneau du C\u0153ur), trou\xE9es pour les escaliers. Praticable, on passe dessous. Fiches ARC-14, E5-06, E6-04, COE-01.",
  tags: [
    "passerelle",
    "mezzanine",
    "balcon",
    "galerie",
    "caillebotis",
    "quadrillage",
    "garde-corps",
    "lisse",
    "console",
    "poutrelle",
    "bronze",
    "laiton",
    "\xE9tage",
    "le complexe",
    "complexe",
    "ancien-tech",
    "modulaire",
    "praticable",
    "int\xE9rieur",
    "walkway",
    "catwalk",
    "balcony",
    "gallery deck",
    "floor grating",
    "grid",
    "guard rail",
    "handrail",
    "corbel",
    "joist",
    "upper floor",
    "ancient complex",
    "ancient-tech",
    "modular",
    "walkable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unit\xE9 = 1 m\xE8tre ; droite : origine au sol sous le milieu du plancher, longueur le long de x, c\xF4t\xE9 mur en \u2212z ; en arc : origine au sol au centre du cercle, arc centr\xE9 sur +z, c\xF4t\xE9 mur \xE0 l'ext\xE9rieur",
  footprint: { radius: 5.7, height: 4.45 },
  animated: [],
  params: params22,
  variants: [
    { id: "mezzanine", name: "Mezzanine (droite, au mur)", params: {} },
    { id: "free", name: "Libre, trou\xE9e au milieu", params: { back: "free", opening: "middle", length: 5, height: 3 } },
    { id: "ring", name: "Anneau du C\u0153ur (arc de 150\xB0)", params: { model: "ring", shape: "arc", width: 1.5, radius: 3, height: 3 } }
  ]
};
function create22(given = {}) {
  const p = resolveParams(meta22.params, given);
  const rng = createRng(p.seed * 7919 + 227);
  const top = p.height;
  const W = p.width;
  const arc = p.shape === "arc";
  const ring2 = p.model === "ring";
  const free = p.back === "free";
  const closedEnds = p.ends === "closed";
  const bronze = [], brass = [], stone = [];
  const patina = () => rng.range(-0.12, 0.06);
  const Ri = p.radius, Ro = p.radius + W;
  const A = THREE28.MathUtils.degToRad(p.angle);
  const L2 = p.length;
  const u0 = arc ? -A / 2 : -L2 / 2, u1 = -u0;
  const at = arc ? (u, v, y) => new THREE28.Vector3(Math.sin(u) * (Ri + v), y, Math.cos(u) * (Ri + v)) : (u, v, y) => new THREE28.Vector3(u, y, W / 2 - v);
  const along = (v) => arc ? Ri + v : 1;
  const pieces = (from, to, v, max = 0.5) => Math.max(1, Math.ceil(Math.abs(to - from) * along(v) / max));
  const strip = (from, to, v, y, w, h, tone, list = bronze, max = 1, make = beam) => {
    const n = arc ? pieces(from, to, v, max) : 1;
    for (let k = 0; k < n; k++) {
      const a = from + (to - from) * k / n, b = from + (to - from) * (k + 1) / n;
      list.push(withTone(make(at(a, v, y), at(b, v, y), w, h), tone));
    }
  };
  let openings = given.openings;
  if (!openings) {
    const span = arc ? 1 / Ri : 1;
    const where = { none: null, start: u0 + span * 0.2, middle: -span / 2, end: u1 - span * 1.2 }[p.opening];
    openings = where === null ? [] : [[where, where + span]];
  }
  const inOpening = (u) => openings.some(([a, b]) => u > a && u < b);
  const f = PX * 1.5;
  strip(u0, u1, f / 2, top - DECK / 2, f, DECK, 0.05);
  strip(u0, u1, W - f / 2, top - DECK / 2, f, DECK, -0.05);
  for (const u of [u0, u1]) bronze.push(withTone(beam(at(u, 0, top - DECK / 2), at(u, W, top - DECK / 2), f, DECK), 0));
  const rows = Math.max(2, Math.round(W / BAR));
  for (let j = 1; j < rows; j++) strip(u0, u1, W * j / rows, top - DECK * 0.45, PX * 0.5, DECK * 0.9, patina() - 0.05, bronze, 1.2, openBar);
  const patchAt = u0 + (u1 - u0) * rng.range(0.15, 0.75);
  const patchLen = (arc ? 1.5 / Ri : 1.5) * rng.range(0.7, 1.2);
  const crossN = Math.round((u1 - u0) * along(W / 2) / BAR);
  const torn = rng.int(2, crossN - 2);
  for (let i = 1; i < crossN; i++) {
    if (i === torn) continue;
    const u = u0 + (u1 - u0) * i / crossN;
    const patched = u > patchAt && u < patchAt + patchLen;
    bronze.push(withTone(openBar(at(u, f, top - DECK * 0.25), at(u, W - f, top - DECK * 0.25), PX * 0.5, DECK * 0.5), patina() + (patched ? 0.22 : -0.1)));
  }
  const joistN = Math.max(1, Math.round((u1 - u0) * along(W / 2) / 2));
  for (let i = 0; i <= joistN; i++) {
    const u = u0 + (u1 - u0) * i / joistN;
    bronze.push(withTone(beam(at(u, 0.02, top - DECK - 0.09), at(u, W, top - DECK - 0.09), 0.08, 0.18), (x, y, z, nx, ny) => ny < -0.5 ? -0.3 : -0.12));
  }
  strip(u0, u1, 0.04, top - DECK - 0.09, 0.08, 0.18, -0.15);
  if (!free) {
    const spacing = ring2 ? 1.5 : 3;
    const count = Math.max(2, Math.round((u1 - u0) * along(W) / spacing));
    const steps = rng.chance(0.5) ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const u = u0 + (u1 - u0) * (i + 0.5) / count;
      for (let s = 0; s < steps; s++) {
        const depth = 0.42 * (1 - s / (steps + 0.5));
        const h = 0.16;
        const y1 = top - DECK - s * h, y0 = y1 - h;
        const c = at(u, W - depth / 2, 0);
        const dir = at(u, W, 0).sub(at(u, 0, 0)).normalize();
        const side = new THREE28.Vector3(dir.z, 0, -dir.x);
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c.x + side.x * a * 0.15 + dir.x * b * depth / 2, c.z + side.z * a * 0.15 + dir.z * b * depth / 2]);
        stone.push(withTone(buildPrism(pts, y0, () => y1), (x, y, z, nx, ny) => ny > 0.5 ? 0.05 : -0.08 * s));
      }
    }
  } else {
    const count = Math.max(2, Math.round((u1 - u0) * along(W / 2) / 3) + 1);
    for (let i = 0; i < count; i++) {
      const u = u0 + (u1 - u0) * i / (count - 1) + (i === 0 ? 0.15 / along(0) : i === count - 1 ? -0.15 / along(0) : 0);
      for (const v of [0.06, W - 0.06]) {
        const pillar = at(u, v, 0);
        bronze.push(withTone(buildBlock([0.1, top - DECK, 0.1], [pillar.x, (top - DECK) / 2, pillar.z]), (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.05 : 0.05) - 0.12 * (1 - THREE28.MathUtils.smoothstep(y, 0, 1))));
        bronze.push(withTone(buildBlock([0.18, 0.08, 0.18], [pillar.x, 0.04, pillar.z]), -0.2));
      }
    }
  }
  const postEvery = ring2 ? 1.5 : 1;
  const bent = rng.int(1, 6);
  const railLine = (from, to, v, withPosts = true) => {
    if (to - from < 1e-3) return;
    const y = top + RAIL_H;
    strip(from, to, v, y, 0.05, 0.045, (x, py, z, nx, ny) => ny > 0.5 ? 0.2 : -0.1, brass);
    if (ring2) strip(from, to, v, top + RAIL_H * 0.55, 0.045, 0.04, 0.05, brass);
    else {
      strip(from, to, v, top + RAIL_H * 0.5, PX, PX, -0.05);
      strip(from, to, v, top + 0.05, PX * 0.6, 0.1, -0.1);
    }
    if (!withPosts) return;
    const n = Math.max(1, Math.round((to - from) * along(v) / postEvery));
    for (let i = 0; i <= n; i++) {
      const u = from + (to - from) * i / n;
      const lean = i === bent ? 0.04 : 0;
      const a = at(u, v, top), b = at(u, v + lean, top + RAIL_H);
      bronze.push(withTone(beam(a, b, PX * 1.4, PX * 1.4), i === bent ? -0.1 : 0.02));
    }
  };
  const railV = 0.03;
  const cuts = [u0, ...openings.flat().filter((u) => u > u0 && u < u1).sort((a, b) => a - b), u1];
  for (let k = 0; k + 1 < cuts.length; k += 2) railLine(cuts[k], cuts[k + 1], railV);
  if (free) railLine(u0, u1, W - railV);
  if (closedEnds) {
    for (const u of [u0 + 0.02 / along(0), u1 - 0.02 / along(0)]) {
      const y = top + RAIL_H;
      brass.push(withTone(beam(at(u, railV, y), at(u, W - railV, y), 0.05, 0.045), 0.15));
      bronze.push(withTone(beam(at(u, railV, top + RAIL_H * 0.5), at(u, W - railV, top + RAIL_H * 0.5), PX, PX), -0.05));
      bronze.push(withTone(beam(at(u, W - railV, top), at(u, W - railV, top + RAIL_H), PX * 1.4, PX * 1.4), 0.02));
    }
  }
  const group = new THREE28.Group();
  group.name = meta22.name;
  const meshes = [
    ["bronze", bronze, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true })],
    ["brass", brass, metalMaterial(METALS.blackenedBrass, { id: 31, tone: true })],
    ["consoles", stone, stoneMaterial(STONES.smoked, { seed: p.seed, id: 20 })]
  ];
  for (const [name, parts, material] of meshes) {
    if (!parts.length) {
      material.dispose();
      continue;
    }
    const mesh = new THREE28.Mesh(mergeToned(parts), material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const toUV = (x, z) => {
    if (!arc) return [x, W / 2 - z];
    return [Math.atan2(x, z), Math.hypot(x, z) - Ri];
  };
  const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
  const walk = {
    heightAt(x, z, y, up = 0.4) {
      const [u, v] = toUV(x, z);
      return u >= u0 && u <= u1 && v >= 0 && v <= W && top <= y + up ? top : -Infinity;
    },
    occupied(x, z, radius, y0, y1) {
      const [u, v] = toUV(x, z);
      const du = radius / along(Math.max(0, v));
      if (u < u0 - du || u > u1 + du || v < -radius || v > W + radius) return false;
      if (overlaps(y0, y1, top - 0.5, top)) return true;
      const rail = overlaps(y0, y1, top, top + RAIL_H);
      if (rail && Math.abs(v - railV) < radius && !inOpening(u)) return true;
      if (rail && free && Math.abs(v - (W - railV)) < radius) return true;
      if (rail && closedEnds && ((u - u0) * along(v) < radius || (u1 - u) * along(v) < radius)) return true;
      if (free && overlaps(y0, y1, 0, top)) {
        const count = Math.max(2, Math.round((u1 - u0) * along(W / 2) / 3) + 1);
        for (let i = 0; i < count; i++) {
          const pu = u0 + (u1 - u0) * i / (count - 1);
          if (Math.abs(u - pu) * along(v) < radius + 0.2 && (Math.abs(v - 0.06) < radius + 0.05 || Math.abs(v - (W - 0.06)) < radius + 0.05)) return true;
        }
      }
      return false;
    }
  };
  group.userData.walk = walk;
  group.userData.walkway = { top, shape: p.shape, width: W, length: arc ? null : L2, radius: arc ? Ri : null, angle: arc ? A : null, openings };
  group.userData.asset = { id: meta22.id, params: p };
  return group;
}

// src/assets/buildings/structure/rolling-ladder.js
var rolling_ladder_exports = {};
__export(rolling_ladder_exports, {
  create: () => create23,
  dispose: () => disposeObject,
  meta: () => meta23,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE29 from "three";
var RAILS = { on: "Avec son rail (3 m)", off: "Sans rail" };
var PITCH = 0.3;
var HALF2 = 0.27;
var RAIL_Z = 0.1;
var LADDER = 0;
var FIXED5 = 255;
var params23 = {
  seed: seedParam("Change l'inclinaison (9 \xE0 12\xB0), la marche us\xE9e, la place de l'\xE9chelle sur le rail, la patine du laiton."),
  height: numberParam("Hauteur", 5, 2.4, 5, "Hauteur du haut de l'\xE9chelle ; le rail est 0,2 m plus haut (5,2 m pour les rayonnages de 5,5 m).", { step: 0.3, unit: "m" }),
  rail: choiceParam("Rail", RAILS, "Avec son tron\xE7on de rail de 3 m et ses pattes (pos\xE9 sur la fa\xE7ade du rayonnage), ou l'\xE9chelle seule."),
  slide: numberParam("Position", 0, -1.2, 1.2, "Place de l'\xE9chelle le long du rail (0 : au milieu ; la graine la d\xE9cale un peu). Pilotable : group.userData.ladder.setSlide(x).", { step: 0.1, unit: "m" })
};
var meta23 = {
  id: "buildings/structure/rolling-ladder",
  name: "\xC9chelle roulante",
  nameEn: "Rolling library ladder",
  category: "buildings",
  subcategory: "structure",
  description: "\xC9chelle de biblioth\xE8que des Archives du Complexe : montants de laiton noirci inclin\xE9s, marches plates au pas de 0,30 m, roulettes de fonte au pied, crochets \xE0 galet accroch\xE9s \xE0 un rail de laiton pos\xE9 sur la fa\xE7ade d'un rayonnage. Glisse le long du rail ; donne ses marches pour qu'un personnage y grimpe. Fiche ARC-04.",
  tags: [
    "\xE9chelle",
    "\xE9chelle roulante",
    "biblioth\xE8que",
    "rail",
    "laiton",
    "roulettes",
    "marches",
    "archives",
    "le complexe",
    "complexe",
    "ancien-tech",
    "praticable",
    "pilotable",
    "int\xE9rieur",
    "ladder",
    "rolling ladder",
    "library ladder",
    "guide rail",
    "brass",
    "casters",
    "rungs",
    "archive room",
    "ancient complex",
    "ancient-tech",
    "climbable",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol au pied de la fa\xE7ade du rayonnage (z = 0), au milieu du rail ; l'\xE9chelle avance vers +z",
  footprint: { radius: 1.6, height: 5.25 },
  animated: [],
  params: params23,
  variants: [
    { id: "full", name: "Grande, sur son rail", params: {} },
    { id: "short", name: "Courte (2,4 m)", params: { height: 2.4 } },
    { id: "alone", name: "Sans rail", params: { rail: "off" } }
  ]
};
function create23(given = {}) {
  const p = resolveParams(meta23.params, given);
  const rng = createRng(p.seed * 7919 + 101);
  const H = p.height;
  const railY = H + 0.2;
  const lean = THREE29.MathUtils.degToRad(rng.range(9, 12));
  const wheelR = 0.05;
  const topZ = RAIL_Z + 0.05;
  const footZ = topZ + (H - wheelR) * Math.tan(lean);
  const zAt = (y) => footZ + (topZ - footZ) * (y - wheelR) / (H - wheelR);
  const brass = [], iron = [];
  for (const s of [-1, 1]) {
    const upright = beam([s * HALF2, wheelR, footZ], [s * HALF2, H, topZ], 0.06, 0.04, 0, new THREE29.Vector3(1, 0, 0));
    brass.push([withTone(upright, (x, y) => (y < 0.4 ? -0.12 : 0) - 0.12 * THREE29.MathUtils.smoothstep(y, 2, H)), LADDER]);
    brass.push([withTone(buildBlock([0.08, 0.08, 0.1], [s * HALF2, wheelR + 0.04, footZ]), -0.2), LADDER]);
    const wheel = plain(new THREE29.CylinderGeometry(wheelR, wheelR, 0.035, 8));
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(s * HALF2, wheelR, footZ + 0.01);
    iron.push([withTone(wheel, (x, y, z, nx) => Math.abs(nx) > 0.5 ? -0.1 : 0.15), LADDER]);
    const a = new THREE29.Vector3(s * HALF2, H - 0.02, topZ);
    const b = new THREE29.Vector3(s * HALF2, railY + 0.07, topZ - 0.01);
    const c = new THREE29.Vector3(s * HALF2, railY + 0.07, RAIL_Z - 0.06);
    const d = new THREE29.Vector3(s * HALF2, railY - 0.03, RAIL_Z - 0.06);
    for (const [u, v] of [[a, b], [b, c], [c, d]]) brass.push([withTone(beam(u, v, PX * 0.9, PX * 0.9), 0.08), LADDER]);
    const roller = plain(new THREE29.CylinderGeometry(0.035, 0.035, 0.03, 8));
    roller.rotateZ(Math.PI / 2);
    roller.translate(s * HALF2, railY + 0.035 + PX * 0.4, RAIL_Z);
    iron.push([withTone(roller, 0.1), LADDER]);
  }
  const rungs = [];
  for (let y = PITCH; y <= H - 0.12; y += PITCH) rungs.push({ y, z: zAt(y) });
  const worn = rng.int(1, Math.max(1, Math.min(rungs.length - 1, 5)));
  rungs.forEach(({ y, z }, i) => {
    const tread = buildBlock([HALF2 * 2 - 0.04, PX * 0.8, 0.09], [0, y, z]);
    brass.push([withTone(tread, (px, py, pz, nx, ny) => ny > 0.5 ? i === worn ? 0.35 : 0.12 : -0.18), LADDER]);
  });
  const brace = rungs[Math.min(2, rungs.length - 1)];
  brass.push([withTone(beam([-HALF2, brace.y - 0.25, zAt(brace.y - 0.25) - 0.01], [HALF2, brace.y - 0.02, brace.z - 0.01], PX * 0.6, PX * 0.6), -0.15), LADDER]);
  if (p.rail === "on") {
    const rail = buildBlock([3, PX, PX], [0, railY, RAIL_Z]);
    brass.push([withTone(rail, (x, y, z, nx, ny) => ny > 0.5 ? 0.2 : -0.05), FIXED5]);
    for (const x of [-1.4, 0, 1.4]) {
      iron.push([withTone(buildBlock([0.05, 0.05, RAIL_Z + 0.02], [x, railY - PX * 0.4, RAIL_Z / 2 - 0.01]), -0.05), FIXED5]);
      iron.push([withTone(buildBlock([0.09, 0.14, 0.02], [x, railY - 0.03, 0.01]), -0.2), FIXED5]);
    }
    for (const x of [-1.5, 1.5]) iron.push([withTone(buildBlock([0.04, 0.07, 0.05], [x, railY, RAIL_Z]), 0.1), FIXED5]);
  }
  const group = new THREE29.Group();
  group.name = meta23.name;
  const brassMerged = mergeParts(brass);
  const ironMerged = mergeParts(iron);
  const brassMesh = new THREE29.Mesh(brassMerged.geometry, metalMaterial(METALS.blackenedBrass, { id: 30, tone: true }));
  brassMesh.name = "brass";
  const ironMesh = new THREE29.Mesh(ironMerged.geometry, metalMaterial(METALS.castIron, { id: 31, tone: true }));
  ironMesh.name = "iron";
  for (const mesh of [brassMesh, ironMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const rigs = [createRigidParts(brassMerged.geometry, brassMerged.partOf, 1), createRigidParts(ironMerged.geometry, ironMerged.partOf, 1)];
  const ladder = {
    foot: new THREE29.Vector3(0, 0, footZ),
    top: new THREE29.Vector3(0, H, topZ),
    rungs,
    railY,
    slide: 0,
    setSlide(x) {
      ladder.slide = THREE29.MathUtils.clamp(x, -1.2, 1.2);
      for (const rig of rigs) {
        rig.matrices[LADDER].makeTranslation(ladder.slide, 0, 0);
        rig.apply();
      }
    }
  };
  ladder.setSlide(p.slide + rng.range(-0.25, 0.25));
  group.userData.ladder = ladder;
  group.userData.asset = { id: meta23.id, params: p };
  return group;
}

// src/assets/buildings/structure/spiral-stair.js
var spiral_stair_exports = {};
__export(spiral_stair_exports, {
  create: () => create24,
  dispose: () => disposeObject,
  meta: () => meta24,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE30 from "three";
var MODELS8 = { stone: "Pierre (Archives)", grating: "Caillebotis (salle 6, C\u0153ur)" };
var TURNS2 = { left: "Monte vers la gauche", right: "Monte vers la droite" };
var R = 1.1;
var CORE = 0.15;
var RISE = 0.18;
var LANDING = THREE30.MathUtils.degToRad(64);
var MAX_STEP = THREE30.MathUtils.degToRad(18);
var RAIL_R = R - 0.05;
var RAIL_H2 = 0.95;
var GAP = THREE30.MathUtils.degToRad(26);
var params24 = {
  seed: seedParam("Change les tons des marches, une marche \xE9corn\xE9e, le pas des barreaux (2 ou 3 marches), un barreau tordu ou manquant, les bagues du noyau et son pommeau."),
  model: choiceParam("Mod\xE8le", MODELS8, "Marches de pierre fum\xE9e \xE0 nez de laiton (Archives), ou marches en caillebotis de bronze (salle 6, C\u0153ur)."),
  height: numberParam("Hauteur", 3.4, 2, 6, "Hauteur du palier (3,4 m : mezzanine des Archives ; 4 m : balcons de la salle 6 et du C\u0153ur). Le nombre de marches en d\xE9coule (19 pour 3,4 m, 22 pour 4 m).", { step: 0.1, unit: "m" }),
  turn: choiceParam("Sens", TURNS2, "En montant, l'escalier tourne vers la gauche (sens trigonom\xE9trique vu de dessus) ou vers la droite.")
};
var meta24 = {
  id: "buildings/structure/spiral-stair",
  name: "Escalier \xE0 vis",
  nameEn: "Spiral staircase",
  category: "buildings",
  subcategory: "structure",
  description: "Escalier \xE0 vis du Complexe, \xD8 2,2 m : marches de 0,18 m en \xE9ventail autour d'un noyau de bronze, limon qui suit l'h\xE9lice, rampe de laiton sur barreaux d'un pixel, palier ouvert face \xE0 +z. Marches de pierre fum\xE9e \xE0 nez de laiton ou en caillebotis de bronze ; hauteur de 2 \xE0 6 m, sens au choix. Praticable (on y monte marche par marche). Fiches ARC-13, E6-05, COE-02.",
  tags: [
    "escalier",
    "escalier \xE0 vis",
    "colima\xE7on",
    "marches",
    "noyau",
    "rampe",
    "limon",
    "palier",
    "mezzanine",
    "bronze",
    "laiton",
    "pierre fum\xE9e",
    "caillebotis",
    "le complexe",
    "complexe",
    "ancien-tech",
    "praticable",
    "int\xE9rieur",
    "staircase",
    "spiral staircase",
    "winding stair",
    "steps",
    "newel",
    "handrail",
    "stringer",
    "landing",
    "brass",
    "smoked stone",
    "grating",
    "ancient complex",
    "ancient-tech",
    "walkable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol sur l'axe du noyau ; le palier est en haut (`height`), ouvert vers +z",
  footprint: { radius: 1.15, height: 4.5 },
  animated: [],
  params: params24,
  variants: [
    ...variantsOf("model", params24.model),
    { id: "tall", name: "Haute (4 m, vers la droite)", params: { height: 4, turn: "right" } }
  ]
};
function create24(given = {}) {
  const p = resolveParams(meta24.params, given);
  const rng = createRng(p.seed * 7919 + 211);
  const H = p.height;
  const n = Math.max(4, Math.round(H / RISE));
  const rise = H / n;
  const step = Math.min(MAX_STEP, (Math.PI * 2 - LANDING) / (n - 1));
  const dir = p.turn === "left" ? 1 : -1;
  const t0 = -LANDING / 2 - (n - 1) * step;
  const at = (r, t, y) => new THREE30.Vector3(Math.sin(dir * t) * r, y, Math.cos(dir * t) * r);
  const xz = (r, t) => [Math.sin(dir * t) * r, Math.cos(dir * t) * r];
  const treads = [];
  for (let k = 1; k < n; k++) treads.push({ a0: t0 + (k - 1) * step, a1: t0 + k * step, top: k * rise });
  const landing = { a0: -LANDING / 2, a1: LANDING / 2, top: H };
  const lineAt = (t) => Math.min(H, rise * ((t - t0) / step + 0.5));
  const treadParts = [], bronze = [], brass = [];
  const grating = p.model === "grating";
  const chipped = rng.int(2, n - 2);
  const wedge = (r0, r1, a0, a1) => {
    const segs = Math.max(1, Math.ceil((a1 - a0) / THREE30.MathUtils.degToRad(9)));
    const pts = [xz(r0, a0)];
    for (let s = 0; s <= segs; s++) pts.push(xz(r1, a0 + (a1 - a0) * s / segs));
    pts.push(xz(r0, a1));
    return pts;
  };
  const slab = (a0, a1, top2, k) => {
    if (!grating) {
      const g = buildPrism(wedge(CORE * 0.9, R, a0 - THREE30.MathUtils.degToRad(2.5), a1), top2 - 0.14, () => top2);
      const base = rng.range(-0.08, 0.06) + (k === chipped ? -0.18 : 0);
      treadParts.push(withTone(g, (x, y, z, nx, ny) => ny > 0.5 ? base : base - 0.2));
      brass.push(withTone(beam(at(CORE + 0.03, a0, top2 - PX * 0.3), at(R - 0.03, a0, top2 - PX * 0.3), PX * 0.9, PX * 0.6), k === chipped ? -0.1 : 0.15));
    } else {
      const T2 = 0.05;
      const tone = rng.range(-0.08, 0.06);
      const edge = (u, v, w, h, extra = 0) => treadParts.push(withTone(beam(u, v, w, h), tone + extra));
      edge(at(CORE, a0, top2 - T2 / 2), at(R, a0, top2 - T2 / 2), PX * 1.4, T2, 0.1);
      edge(at(CORE, a1, top2 - T2 / 2), at(R, a1, top2 - T2 / 2), PX, T2);
      const segs = Math.max(2, Math.ceil((a1 - a0) / THREE30.MathUtils.degToRad(9)));
      for (let s = 0; s < segs; s++) {
        const b0 = a0 + (a1 - a0) * s / segs, b1 = a0 + (a1 - a0) * (s + 1) / segs;
        edge(at(R - PX / 2, b0, top2 - T2 / 2), at(R - PX / 2, b1, top2 - T2 / 2), PX, T2);
      }
      const bars = Math.max(2, Math.round((a1 - a0) * R / (PX * 2.2)));
      for (let i = 1; i < bars; i++) {
        const b = a0 + (a1 - a0) * i / bars;
        edge(at(CORE + 0.02, b, top2 - T2 * 0.4), at(R - PX, b, top2 - T2 * 0.4), PX * 0.5, T2 * 0.8, -0.05);
      }
      for (const r of [0.45, 0.8]) edge(at(r, a0, top2 - T2 * 0.2), at(r, a1, top2 - T2 * 0.2), PX * 0.5, T2 * 0.4, -0.15);
      brass.push(withTone(beam(at(CORE + 0.03, a0, top2 + 4e-3), at(R - 0.03, a0, top2 + 4e-3), PX * 0.9, PX * 0.3), 0.1));
    }
  };
  treads.forEach((tr, i) => slab(tr.a0, tr.a1, tr.top, i + 1));
  slab(landing.a0, landing.a1, H, n);
  if (!grating) {
    const g = buildPrism(wedge(CORE, R * 0.7, -LANDING / 4, LANDING / 4), H - 0.4, () => H - 0.14);
    treadParts.push(withTone(g, -0.3));
  }
  const top = H + RAIL_H2 + 0.1;
  const core = plain(new THREE30.CylinderGeometry(CORE, CORE, top, 8));
  core.translate(0, top / 2, 0);
  bronze.push(withTone(core, (x, y, z, nx) => (Math.abs(nx) > 0.7 ? -0.05 : 0.05) - 0.1 * THREE30.MathUtils.smoothstep(y, 0, 1)));
  const plinth = plain(new THREE30.CylinderGeometry(CORE + 0.07, CORE + 0.09, 0.2, 8));
  plinth.translate(0, 0.1, 0);
  bronze.push(withTone(plinth, -0.15));
  const bands = rng.int(2, 4);
  for (let b = 0; b < bands; b++) {
    const y = 0.4 + (top - 0.6) * (b + rng.range(0.3, 0.7)) / bands;
    brass.push(withTone(ring({ radius: CORE, height: PX * 1.5, y, thickness: PX * 0.8, segments: 8 }), 0.2));
  }
  if (rng.chance(0.5)) {
    const knob = plain(new THREE30.SphereGeometry(CORE * 1.1, 8, 5));
    knob.translate(0, top + CORE * 0.8, 0);
    brass.push(withTone(knob, 0.15));
  } else {
    const cone = plain(new THREE30.ConeGeometry(CORE * 1.2, 0.3, 8));
    cone.translate(0, top + 0.15, 0);
    brass.push(withTone(cone, 0.1));
  }
  const tEnd = landing.a1;
  const pieces = Math.ceil((tEnd - t0) / THREE30.MathUtils.degToRad(8));
  for (let s = 0; s < pieces; s++) {
    const u = t0 + (tEnd - t0) * s / pieces, v = t0 + (tEnd - t0) * (s + 1) / pieces;
    const yu = Math.max(0.12, lineAt(u) - rise * 0.5 - 0.1), yv = Math.max(0.12, lineAt(v) - rise * 0.5 - 0.1);
    bronze.push(withTone(beam(at(R + 0.015, u, yu), at(R + 0.015, v, yv), 0.035, 0.24), (x, y, z, nx, ny) => ny > 0.5 ? 0.12 : -0.05));
  }
  const every = rng.chance(0.5) ? 2 : 3;
  const bent = rng.int(1, n - 2);
  const missing = rng.chance(0.4) ? rng.int(2, n - 2) : -1;
  const baluster = (t, foot, head, k) => {
    if (k === missing) return;
    const lean = k === bent ? 0.05 : 0;
    const a = at(RAIL_R, t, foot);
    const b = at(RAIL_R - lean, t + lean, head);
    bronze.push(withTone(beam(a, b, PX, PX), k === bent ? -0.1 : 0));
  };
  treads.forEach((tr, i) => {
    if (i % every === 0) baluster((tr.a0 + tr.a1) / 2, tr.top, lineAt((tr.a0 + tr.a1) / 2) + RAIL_H2, i);
  });
  const railTo = landing.a0 + (LANDING / 2 - GAP);
  const railPieces = Math.ceil((railTo - t0) / THREE30.MathUtils.degToRad(8));
  const handrail = (u, v, yu, yv) => brass.push(withTone(beam(at(RAIL_R, u, yu), at(RAIL_R, v, yv), 0.05, 0.045), (x, y, z, nx, ny) => ny > 0.5 ? 0.2 : -0.1));
  for (let s = 0; s < railPieces; s++) {
    const u = t0 + (railTo - t0) * s / railPieces, v = t0 + (railTo - t0) * (s + 1) / railPieces;
    handrail(u, v, lineAt(u) + RAIL_H2, lineAt(v) + RAIL_H2);
  }
  const post = (t, y, height) => bronze.push(withTone(beam(at(RAIL_R, t, y), at(RAIL_R, t, y + height), PX * 1.6, PX * 1.6), 0.05));
  post(t0 + step * 0.15, 0, lineAt(t0 + step * 0.15) + RAIL_H2);
  post(railTo, H, RAIL_H2 + 0.05);
  const railFrom = landing.a1 - (LANDING / 2 - GAP);
  post(railFrom, H, RAIL_H2 + 0.05);
  handrail(railFrom, landing.a1, H + RAIL_H2, H + RAIL_H2);
  const edgeT = landing.a1 - 0.01;
  brass.push(withTone(beam(at(CORE, edgeT, H + RAIL_H2), at(RAIL_R, edgeT, H + RAIL_H2), 0.045, 0.045), 0.1));
  for (const r of [0.45, 0.75]) bronze.push(withTone(beam(at(r, edgeT, H), at(r, edgeT, H + RAIL_H2), PX, PX), 0));
  baluster(landing.a1, H, H + RAIL_H2, -2);
  for (let t = landing.a0 + step; t < railTo - 0.05; t += step * every) baluster(t, H, H + RAIL_H2, -3);
  const group = new THREE30.Group();
  group.name = meta24.name;
  const treadMaterial = grating ? metalMaterial(METALS.patinatedBronze, { id: 32, tone: true }) : stoneMaterial(STONES.smoked, { seed: p.seed, id: 20 });
  const meshes = [
    ["treads", treadParts, treadMaterial],
    ["bronze", bronze, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true })],
    ["brass", brass, metalMaterial(METALS.blackenedBrass, { id: 31, tone: true })]
  ];
  for (const [name, parts, material] of meshes) {
    const mesh = new THREE30.Mesh(mergeToned(parts), material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const angleOf = (x, z) => {
    let t = Math.atan2(dir * x, z);
    while (t < t0) t += Math.PI * 2;
    while (t >= t0 + Math.PI * 2) t -= Math.PI * 2;
    return t;
  };
  const treadAt = (t) => {
    if (t >= landing.a0 && t < landing.a1) return H;
    const k = Math.floor((t - t0) / step);
    return k >= 0 && k < n - 1 ? (k + 1) * rise : null;
  };
  const railAt = (t) => {
    if (t >= railTo && t < railFrom) return null;
    if (t >= landing.a1) return null;
    return lineAt(t);
  };
  const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
  const walk = {
    heightAt(x, z, y, up = 0.4) {
      const r = Math.hypot(x, z);
      if (r < CORE || r > R) return -Infinity;
      const h = treadAt(angleOf(x, z));
      return h !== null && h <= y + up ? h : -Infinity;
    },
    occupied(x, z, radius, y0, y1) {
      const r = Math.hypot(x, z);
      if (r - radius > R + 0.05) return false;
      if (r < CORE + radius * 0.7) return overlaps(y0, y1, 0, top);
      const t = angleOf(x, z);
      const span = Math.asin(Math.min(1, radius * 0.5 / Math.max(r, radius)));
      for (let s = -2; s <= 2; s++) {
        const u = t + span * s / 2;
        const h = treadAt(u);
        if (h !== null && r - radius < R && overlaps(y0, y1, h - (grating ? 0.06 : 0.14), h)) return true;
        const rail = railAt(u);
        if (rail !== null && Math.abs(r - RAIL_R) < radius * 0.6 && overlaps(y0, y1, rail - RAIL_H2, rail + 0.05)) return true;
      }
      const off = Math.atan2(Math.sin(t - landing.a1), Math.cos(t - landing.a1));
      if (Math.abs(off) * r < radius * 0.6 && overlaps(y0, y1, H, H + RAIL_H2)) return true;
      return false;
    }
  };
  group.userData.walk = walk;
  group.userData.stair = { height: H, rise, radius: R, treads, landing, turn: p.turn };
  group.userData.asset = { id: meta24.id, params: p };
  return group;
}

// src/assets/furniture/lighting/filament-chandelier.js
var filament_chandelier_exports = {};
__export(filament_chandelier_exports, {
  create: () => create25,
  dispose: () => disposeObject,
  meta: () => meta25,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE31 from "three";
var MODELS9 = { lantern: "Lanterne (Archives)", rotunda: "Grand lustre (Rotonde)", vaultRing: "Anneau de vo\xFBte (Oracle)" };
var STATES9 = { lit: "Allum\xE9", dim: "En veille", off: "\xC9teint" };
var HALOS4 = { off: "Sans halo", on: "\xC9claire le d\xE9cor (dans le noir)" };
var BASE4 = { lit: 2, dim: 1, off: 0 };
var REACH = { lantern: 3.5, rotunda: 6.5, vaultRing: 4.5 };
var params25 = {
  seed: seedParam("Change les ampoules faibles ou mortes, le rythme des scintillements, la l\xE9g\xE8re g\xEEte du cercle, les tons du bronze."),
  model: choiceParam("Mod\xE8le", MODELS9, "Lanterne \xE0 6 ampoules et coupelle de verre, grand lustre de 3 m \xE0 24 ampoules, ou anneau de vo\xFBte \xE0 12 ampoules."),
  state: choiceParam("\xC9tat", STATES9, "Allum\xE9 (scintillement lent), en veille (lueur faible) ou \xE9teint."),
  glow: glowParam("Couleur des filaments."),
  halo: choiceParam("Halo", HALOS4, "\xC9claire le d\xE9cor autour de lui dans le noir (lumi\xE8re de halo : 12 pour toute la sc\xE8ne)."),
  height: numberParam("Hauteur", 3, 2, 12, "Hauteur du cercle d'ampoules au-dessus du sol.", { step: 0.1, unit: "m" }),
  chain: numberParam("Cha\xEEne", 1.5, 0.3, 5, "Longueur de la cha\xEEne principale, jusqu'\xE0 la rosace du plafond.", { step: 0.1, unit: "m" })
};
var meta25 = {
  id: "furniture/lighting/filament-chandelier",
  name: "Lustre \xE0 filaments",
  nameEn: "Filament chandelier",
  category: "furniture",
  subcategory: "lighting",
  description: "Lustre du Complexe : un cercle de bronze qui porte des ampoules ambre scintillantes, pendu \xE0 des cha\xEEnes. Lanterne des Archives (6 ampoules, coupelle de verre), grand lustre de la Rotonde (3 m, 24 ampoules) ou anneau de vo\xFBte de l'Oracle (12 ampoules) ; allum\xE9, en veille ou \xE9teint ; peut \xE9clairer le d\xE9cor dans le noir. Fiches ARC-16, GAL-12, ORA-13.",
  tags: [
    "lustre",
    "lanterne",
    "suspension",
    "ampoules",
    "filament",
    "cha\xEEnes",
    "anneau",
    "bronze",
    "ambre",
    "scintillement",
    "le complexe",
    "complexe",
    "ancien-tech",
    "\xE9clairage",
    "lumineux",
    "anim\xE9",
    "int\xE9rieur",
    "chandelier",
    "lantern",
    "pendant light",
    "light bulbs",
    "chains",
    "light ring",
    "amber",
    "flicker",
    "ancient complex",
    "ancient-tech",
    "lighting",
    "glowing",
    "animated",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, \xE0 l'aplomb du centre ; `height` = hauteur du cercle d'ampoules",
  footprint: { radius: 1.6, height: 6.1 },
  animated: ["flicker", "glow"],
  params: params25,
  variants: variantsOf("model", params25.model)
};
function create25(given = {}) {
  const p = resolveParams(meta25.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const bulbsRng = createRng(p.seed * 104729 + 71);
  const h = p.height;
  const bronzeParts = [];
  const glassParts = [];
  const bulbs = [];
  let hub;
  const add = (g, tone = 0) => bronzeParts.push(tone ? withTone(g, tone) : g);
  const lathe = (profile, segments, tone = 0) => add(buildLathe(profile, { segments, facets: true }), tone);
  if (p.model === "lantern") {
    const yb = h - 0.45, yt = h + 0.42;
    lathe([[0, yb - 0.05], [0.36, yb - 0.05], [0.36, yb], [0, yb]], 12, 0.05);
    lathe([[0, yb - 0.16], [0.05, yb - 0.08], [0.05, yb - 0.05], [0, yb - 0.05]], 6);
    add(ring({ radius: 0.27, y: yt - PX, height: PX * 1.6, thickness: PX, segments: 12 }), 0.1);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const [dx, dz] = [Math.cos(a), Math.sin(a)];
      add(beam([dx * 0.34, yb, dz * 0.34], [dx * 0.37, h, dz * 0.37], PX * 0.8, PX * 0.8));
      add(beam([dx * 0.37, h, dz * 0.37], [dx * 0.29, yt, dz * 0.29], PX * 0.8, PX * 0.8));
      const by = h + (i % 2 ? 0.05 : -0.05);
      add(beam([0, by - 0.06, 0], [dx * 0.15, by - 0.02, dz * 0.15], PX * 0.6, PX * 0.6));
      bulbs.push(new THREE31.Vector3(dx * 0.17, by, dz * 0.17));
    }
    add(beam([0, yb, 0], [0, yt, 0], PX, PX), -0.1);
    lathe([[0, yt], [0.32, yt], [0.32, yt + 0.03], [0.1, yt + 0.12], [0, yt + 0.12]], 12, 0.05);
    glassParts.push(buildLathe([[0, yt + 0.12], [0.2, yt + 0.12], [0.2, yt + 0.16], [0.12, yt + 0.27], [0, yt + 0.29]], { segments: 10, facets: true }));
    hub = new THREE31.Vector3(0, yt + 0.32, 0);
    add(beam([0, yt + 0.12, 0], hub, PX, PX));
  } else {
    const rotunda = p.model === "rotunda";
    const R2 = rotunda ? 1.5 : 0.8;
    const count = rotunda ? 24 : 12;
    const chains = rotunda ? 4 : 3;
    add(ring({ radius: R2 - 0.05, y: h - 0.05, height: 0.1, thickness: 0.07, segments: count * 2 }), 0.05);
    if (rotunda) add(ring({ radius: R2 - 0.42, y: h - 0.02, height: 0.05, thickness: PX, segments: 24 }), -0.1);
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2;
      const [dx, dz] = [Math.cos(a), Math.sin(a)];
      const rr = R2 - 0.015;
      if (rotunda) {
        add(buildLathe([[0, 0], [0.03, 0], [0.03, 0.07], [0, 0.07]], { segments: 6, facets: true }).translate(dx * rr, h + 0.05, dz * rr), -0.15);
        bulbs.push(new THREE31.Vector3(dx * rr, h + 0.17, dz * rr));
      } else {
        add(beam([dx * rr, h - 0.05, dz * rr], [dx * rr, h - 0.13, dz * rr], PX * 0.7, PX * 0.7));
        bulbs.push(new THREE31.Vector3(dx * rr, h - 0.21, dz * rr));
      }
    }
    if (rotunda) {
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + Math.PI / 8;
        add(beam([Math.cos(a) * (R2 - 0.42), h, Math.sin(a) * (R2 - 0.42)], [Math.cos(a) * (R2 - 0.05), h, Math.sin(a) * (R2 - 0.05)], PX, PX));
      }
    }
    hub = new THREE31.Vector3(0, h + (rotunda ? 1.5 : 0.5), 0);
    for (let k = 0; k < chains; k++) {
      const a = k / chains * Math.PI * 2 + Math.PI / 4;
      add(chain([Math.cos(a) * (R2 - 0.03), h + 0.05, Math.sin(a) * (R2 - 0.03)], hub, { sag: 0.02, link: 0.08 }));
    }
    lathe([[0, hub.y - 0.06], [0.1, hub.y - 0.06], [0.1, hub.y + 0.02], [0, hub.y + 0.04]], 8, 0.1);
  }
  const end = hub.y + p.chain;
  add(chain(hub, [0, end, 0], { sag: 0, link: 0.08 }));
  lathe([[0, end], [0.12, end], [0.12, end + 0.03], [0, end + 0.05]], 8, 0.1);
  const tilt = new THREE31.Matrix4().makeRotationAxis(new THREE31.Vector3(Math.cos(shape.range(0, 6.28)), 0, Math.sin(shape.range(0, 6.28))).normalize(), shape.range(0, 0.035));
  const pivot = new THREE31.Matrix4().makeTranslation(0, -end, 0);
  const back = new THREE31.Matrix4().makeTranslation(0, end, 0);
  const lean = back.multiply(tilt).multiply(pivot);
  const group = new THREE31.Group();
  group.name = meta25.name;
  const bronzeGeometry = mergeToned(bronzeParts).applyMatrix4(lean);
  const bronze = new THREE31.Mesh(bronzeGeometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronze.name = "frame";
  bronze.castShadow = true;
  group.add(bronze);
  if (glassParts.length) {
    const glass = new THREE31.Mesh(mergeToned(glassParts).applyMatrix4(lean), createToonMaterial({ ramp: GLASSES.amber.ramp, ink: GLASSES.amber.ink, steps: [0.3, 0.55, 0.8], crease: true, rim: [0.25, 0.4], id: 32 }));
    glass.name = "glass-cup";
    group.add(glass);
  }
  const base = BASE4[p.state];
  const glowParts = [];
  const flickerBulbs = [];
  let start = 0;
  for (const position of bulbs) {
    let level = base;
    if (base === 2) {
      const r = bulbsRng.next();
      if (r < 0.07) level = 0;
      else if (r < 0.2) level = 1;
    }
    const g = withShade(bulb({ radius: PX * 1.25, position, segments: 6 }), level, 4);
    glowParts.push(g);
    flickerBulbs.push({ start, count: g.attributes.position.count, base: level, phase: bulbsRng.next() });
    start += g.attributes.position.count;
  }
  const glowGeometry = mergeToned(glowParts).applyMatrix4(lean);
  const glowMaterial2 = glowMixMaterial(glowLevels(p.glow), { id: 31 });
  const lights = new THREE31.Mesh(glowGeometry, glowMaterial2);
  lights.name = "bulbs";
  group.add(lights);
  const flicker = createFlicker(glowGeometry, flickerBulbs);
  const halo = p.halo === "on" && p.state !== "off" ? createGlowLight() : null;
  if (halo) glowMaterial2.addEventListener("dispose", () => halo.release());
  const haloColor = rgb(GLOWS[p.glow].light);
  const center = new THREE31.Vector3(0, h, 0).applyMatrix4(lean);
  const haloAt = new THREE31.Vector3();
  const reach = REACH[p.model] * (p.state === "lit" ? 1 : 0.6);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      flicker(time);
    }
    baseUpdate(force);
    if (halo) halo.set(group.localToWorld(haloAt.copy(center)), haloColor, reach, 1.3);
  };
  group.userData.asset = { id: meta25.id, params: p };
  group.userData.lightPoint = center.clone();
  return group;
}

// src/assets/furniture/seating/bronze-stool.js
var bronze_stool_exports = {};
__export(bronze_stool_exports, {
  create: () => create26,
  dispose: () => disposeObject,
  meta: () => meta26,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE32 from "three";
var MODELS10 = {
  reading: "Lecture (cuir clout\xE9, pieds crois\xE9s)",
  workshop: "Atelier (bois, repose-pieds)"
};
var params26 = {
  seed: seedParam("Change l'\xE9cart et l'orientation des pieds, la hauteur, l'usure du cuir et les clous qui manquent, ou les planches et la fente du bois."),
  model: choiceParam("Mod\xE8le", MODELS10, "Tabouret de lecture des Archives (cuir clout\xE9, trois pieds crois\xE9s) ou d'atelier (assise ronde de bois, repose-pieds).")
};
var meta26 = {
  id: "furniture/seating/bronze-stool",
  name: "Tabouret de bronze",
  nameEn: "Bronze stool",
  category: "furniture",
  subcategory: "seating",
  description: "Tabouret du Complexe sur trois pieds de bronze : tabouret de lecture des Archives \xE0 assise carr\xE9e de cuir goudronn\xE9 bord\xE9e de clous de laiton, pieds crois\xE9s sous l'assise ; ou tabouret d'atelier, plus haut, \xE0 assise ronde de bois noirci et repose-pieds en anneau. Fiches ARC-08, ATE-10.",
  tags: [
    "tabouret",
    "assise",
    "si\xE8ge",
    "trois pieds",
    "bronze",
    "cuir",
    "clous",
    "bois noirci",
    "repose-pieds",
    "lecture",
    "atelier",
    "le complexe",
    "complexe",
    "ancien-tech",
    "mobilier",
    "s'asseoir",
    "int\xE9rieur",
    "stool",
    "seat",
    "tripod",
    "leather",
    "studs",
    "blackened wood",
    "footrest",
    "reading",
    "workshop",
    "ancient complex",
    "ancient-tech",
    "furniture",
    "sit",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, sous le centre de l'assise ; on s'y assoit face \xE0 +z",
  footprint: { radius: 0.3, height: 0.66 },
  animated: [],
  params: params26,
  variants: variantsOf("model", params26.model)
};
function create26(given = {}) {
  const p = resolveParams(meta26.params, given);
  const rng = createRng(p.seed * 7919 + 211);
  const reading = p.model === "reading";
  const bronze = [], seat = [];
  const H = (reading ? 0.48 : 0.65) + rng.int(-1, 1) * 0.03 * (reading ? 0.6 : 1);
  const yaw = rng.range(0, Math.PI * 2 / 3);
  const leg = PX * 0.62;
  if (reading) {
    const S = 0.4, cushion = 0.075, frame = 0.035;
    const frameY = H - cushion - frame;
    bronze.push(withTone(buildBlock([S - 0.03, frame, S - 0.03], [0, frameY + frame / 2, 0]), -0.1));
    const wearX = rng.range(-0.06, 0.06), wearZ = rng.range(-0.04, 0.08);
    const wear = rng.range(0.25, 0.45);
    seat.push(withTone(gridBlock([S, cushion, S], [0, H - cushion / 2, 0], { cell: 0.07 }), (x, y, z) => {
      if (y < H - 0.01) return -0.05;
      return -0.12 + wear * Math.max(0, 1 - Math.hypot((x - wearX) / 0.15, (z - wearZ) / 0.13)) ** 0.9;
    }));
    for (const [w, d, x, z] of [[S, PX * 0.5, 0, S / 2 - PX * 0.25], [S, PX * 0.5, 0, -S / 2 + PX * 0.25], [PX * 0.5, S - PX, S / 2 - PX * 0.25, 0], [PX * 0.5, S - PX, -S / 2 + PX * 0.25, 0]]) {
      seat.push(withTone(buildBlock([w, 0.012, d], [x, H + 6e-3, z]), 0.1));
    }
    const nails = 5;
    for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      for (let i = 0; i < nails; i++) {
        if (rng.chance(0.14)) continue;
        const t = -S / 2 + (i + 0.5) * S / nails;
        const x = nx ? nx * (S / 2 + 4e-3) : t, z = nz ? nz * (S / 2 + 4e-3) : t;
        const size = [nx ? 8e-3 : PX * 0.55, PX * 0.55, nz ? 8e-3 : PX * 0.55];
        bronze.push(withTone(buildBlock(size, [x, H - cushion * 0.45, z]), 0.55));
      }
    }
    const splay = rng.range(0.16, 0.2);
    const top = 0.14;
    const cross = frameY * (splay / (splay + top));
    for (let i = 0; i < 3; i++) {
      const a = yaw + i * Math.PI * 2 / 3;
      const c = Math.cos(a), s = Math.sin(a);
      const from = [c * top, frameY + 5e-3, s * top];
      const to = [-c * splay, 0.018, -s * splay];
      bronze.push(withTone(beam(from, to, leg, leg, a), i % 2 ? 0.05 : -0.05));
      bronze.push(withTone(buildBlock([0.05, 0.02, 0.05], [to[0], 0.01, to[2]], [0, -a, 0]), -0.15));
    }
    bronze.push(withTone(plain(new THREE32.CylinderGeometry(0.035, 0.035, 0.06, 8)).translate(0, cross, 0), 0.25));
  } else {
    const R2 = 0.175, thick = 0.05;
    const planks = rng.int(2, 3);
    const cut = rng.range(0, Math.PI);
    const dir = new THREE32.Vector2(Math.cos(cut), Math.sin(cut));
    const crack = rng.chance(0.5) ? rng.int(0, planks - 1) : -1;
    const plankTone = Array.from({ length: planks }, () => rng.range(-0.1, 0.1));
    const disc = buildLathe([[0, H - thick], [R2, H - thick], [R2, H - thick * 0.25], [R2 - 0.012, H], [0, H]], { segments: 14, facets: true });
    seat.push(withTone(disc, (x, y, z) => {
      const u = (x * dir.x + z * dir.y) / (2 * R2) + 0.5;
      const k = Math.min(planks - 1, Math.floor(u * planks));
      const joint = Math.abs(u * planks - Math.round(u * planks)) < 0.05 && Math.round(u * planks) % planks !== 0;
      let t = plankTone[k] + (y > H - 5e-3 ? 0.05 : -0.08);
      if (joint) t -= 0.6;
      return t;
    }));
    for (let k = 1; k < planks; k++) {
      const off = -R2 + 2 * R2 * k / planks;
      const half = Math.sqrt(Math.max(0, R2 * R2 - off * off)) - 0.01;
      seat.push(withTone(buildBlock([2 * half, 4e-3, PX * 0.35], [dir.x * off, H + 2e-3, dir.y * off], [0, -cut + Math.PI / 2, 0]), -0.75));
    }
    if (crack >= 0) {
      const off = -R2 + 2 * R2 * (crack + 0.5) / planks + rng.range(-0.02, 0.02);
      const len = rng.range(0.08, 0.14);
      seat.push(withTone(buildBlock([len, 4e-3, PX * 0.3], [dir.x * off + dir.y * 0.04, H + 2e-3, dir.y * off - dir.x * 0.04], [0, -cut + Math.PI / 2, 0]), -0.6));
    }
    bronze.push(withTone(plain(new THREE32.CylinderGeometry(0.09, 0.09, 0.03, 9)).translate(0, H - thick - 0.015, 0), -0.1));
    const splay = rng.range(0.21, 0.26);
    const topR = 0.07;
    const footY = 0.25 + rng.range(-0.02, 0.03);
    const legAt = (a, y) => {
      const t = y / (H - thick - 0.03);
      const r = splay + (topR - splay) * t;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
    for (let i = 0; i < 3; i++) {
      const a = yaw + i * Math.PI * 2 / 3;
      bronze.push(withTone(beam(legAt(a, 0.015), legAt(a, H - thick - 0.03), leg, leg, -a), i % 2 ? 0.05 : -0.05));
      const foot = legAt(a, 0.01);
      bronze.push(withTone(buildBlock([0.05, 0.02, 0.05], [foot[0], 0.01, foot[2]], [0, -a, 0]), -0.15));
    }
    const rr = Math.hypot(legAt(0, footY)[0], legAt(0, footY)[2]);
    bronze.push(withTone(ring({ radius: rr - PX * 0.3, height: PX * 0.55, y: footY - PX * 0.27, thickness: PX * 0.6, segments: 12 }), (x, y) => y > footY ? 0.3 : 0.05));
  }
  const group = new THREE32.Group();
  group.name = meta26.name;
  const bronzeMesh = new THREE32.Mesh(mergeToned(bronze), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronzeMesh.name = "frame";
  const seatMaterial = reading ? createToonMaterial({ ramp: FABRICS.tarredLeather.ramp, ink: FABRICS.tarredLeather.ink, steps: [0.3, 0.55, 0.8], tone: true, crease: true, id: 31 }) : createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, id: 31 });
  const seatMesh = new THREE32.Mesh(mergeToned(seat), seatMaterial);
  seatMesh.name = "seat";
  for (const mesh of [bronzeMesh, seatMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.seats = [{ position: new THREE32.Vector3(0, H, 0), facing: new THREE32.Vector3(0, 0, 1) }];
  group.userData.asset = { id: meta26.id, params: p };
  return group;
}

// src/assets/furniture/storage/display-case.js
var display_case_exports = {};
__export(display_case_exports, {
  create: () => create27,
  dispose: () => disposeObject,
  meta: () => meta27,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE33 from "three";
var MODELS11 = {
  conservation: "De conservation (Archives, 1,2 m)",
  specimen: "Cuve \xE0 \xE9chantillon (salle 6)"
};
var CONTENTS2 = { tablet: "Tablette grav\xE9e", rolls: "Rouleaux-bandes", empty: "Vide" };
var WALL2 = 0.36;
var LIQUID = 0.48;
var params27 = {
  seed: seedParam("Change le contenu et sa disposition, les glyphes de la tablette, le niveau du liquide, la forme du fruit, l'aiguille du cadran, les tons de la pierre."),
  model: choiceParam("Mod\xE8le", MODELS11, "Vitrine de conservation des Archives, ou cuve \xE0 \xE9chantillon de la salle de l'Arbre de M\xE9moire."),
  content: choiceParam("Contenu", CONTENTS2, "Vitrine de conservation : une tablette grav\xE9e sur son lutrin, des rouleaux-bandes, ou rien."),
  count: numberParam("Cuves", 1, 1, 4, "Cuve \xE0 \xE9chantillon : nombre de cuves en rang (4 sur la table de la salle 6).", { step: 1 })
};
var meta27 = {
  id: "furniture/storage/display-case",
  name: "Vitrine",
  nameEn: "Display case",
  category: "furniture",
  subcategory: "storage",
  description: "Vitrine du Complexe au verre tram\xE9 (on voit au travers) : vitrine de conservation des Archives sur pi\xE8tement de pierre fum\xE9e, caisson au dessus bomb\xE9 cercl\xE9 de bronze, cadran d'hygrom\xE9trie, tablette grav\xE9e ou rouleaux-bandes sur un feutre ; ou cuve \xE0 \xE9chantillon de la salle 6, un fruit de cristal qui luit dans un liquide clair, seule ou en rang. Fiches ARC-15, E6-06.",
  tags: [
    "vitrine",
    "cuve",
    "bocal",
    "verre",
    "verre tram\xE9",
    "caisson bomb\xE9",
    "pierre fum\xE9e",
    "bronze",
    "cadran",
    "hygrom\xE9trie",
    "tablette grav\xE9e",
    "rouleaux",
    "\xE9chantillon",
    "fruit de cristal",
    "liquide",
    "mus\xE9e",
    "le complexe",
    "complexe",
    "ancien-tech",
    "rangement",
    "lumineux",
    "int\xE9rieur",
    "display case",
    "showcase",
    "specimen jar",
    "glass",
    "dithered glass",
    "domed lid",
    "smoked stone",
    "dial",
    "hygrometer",
    "engraved tablet",
    "scrolls",
    "crystal fruit",
    "liquid",
    "museum",
    "ancient complex",
    "ancient-tech",
    "storage",
    "glowing",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au centre (vitrine) ou sous le rang de cuves (\xE0 poser sur une table) ; face avant vers +z",
  footprint: { radius: 0.75, height: 1 },
  animated: [],
  params: params27,
  variants: [
    { id: "tablet", name: "Conservation, tablette", params: {} },
    { id: "rolls", name: "Conservation, rouleaux", params: { content: "rolls" } },
    { id: "specimen", name: "Cuve \xE0 \xE9chantillon", params: { model: "specimen" } },
    { id: "specimens", name: "Rang de 4 cuves", params: { model: "specimen", count: 4 } }
  ]
};
function cover(geometry, value) {
  const n = geometry.attributes.position.count;
  geometry.setAttribute("aCover", new THREE33.BufferAttribute(new Float32Array(n).fill(value), 1));
  return geometry;
}
function create27(given = {}) {
  const p = resolveParams(meta27.params, given);
  const rng = createRng(p.seed * 7919 + 607);
  const group = new THREE33.Group();
  group.name = meta27.name;
  if (p.model === "specimen") buildSpecimens(group, p, rng);
  else buildConservation(group, p, rng);
  group.userData.asset = { id: meta27.id, params: p };
  return group;
}
function buildConservation(group, p, rng) {
  const stone = [], metal = [], glass = [];
  const W = 1.2, D = 0.8;
  const tray = 0.62;
  const t = rng.range(-0.06, 0.06);
  stone.push(withTone(buildBlock([W - 0.16, 0.08, D - 0.16], [0, 0.04, 0]), t - 0.35));
  for (const s of [-1, 1]) {
    stone.push(withTone(gridBlock([0.22, tray - 0.18, D - 0.22], [s * (W / 2 - 0.2), 0.08 + (tray - 0.18) / 2, 0], { cell: 0.12 }), (x, y) => t - 0.08 + (y < 0.2 ? -0.1 : 0)));
  }
  stone.push(withTone(buildBlock([W - 0.5, 0.06, 0.1], [0, 0.26, 0]), t - 0.2));
  stone.push(withTone(gridBlock([W, 0.1, D], [0, tray - 0.05, 0], { cell: 0.12 }), (x, y, z, nx, ny) => t + (ny > 0.5 ? -0.1 : 0.05)));
  stone.push(withTone(buildBlock([W - 0.14, 0.012, D - 0.14], [0, tray + 6e-3, 0]), -0.8));
  const dx = rng.range(0.25, 0.4) * (rng.chance(0.5) ? 1 : -1);
  const d = dial({ radius: PX * 1.1, position: [dx, tray - 0.05, D / 2 + 2e-3], normal: [0, 0, 1], ticks: 6, needle: rng.range(-1.4, 1.4) });
  metal.push(withTone(d.face, 0.45), withTone(d.marks, -0.8));
  metal.push(withTone(buildBlock([0.16, 0.02, 6e-3], [dx, tray - 0.085, D / 2 + 3e-3]), 0.2));
  const gw = W - 0.1, gd = D - 0.1;
  const wallH = 0.2, sag = 0.14;
  const y0 = tray + 0.012, y1 = y0 + wallH;
  for (const s of [-1, 1]) {
    metal.push(withTone(buildBlock([gw + 0.03, 0.035, 0.03], [0, y0 + 0.0175, s * gd / 2]), -0.55));
    metal.push(withTone(buildBlock([0.03, 0.035, gd + 0.03], [s * gw / 2, y0 + 0.0175, 0]), -0.55));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) metal.push(withTone(buildBlock([0.028, wallH, 0.028], [sx * gw / 2, y0 + wallH / 2, sz * gd / 2]), 0.05));
  const facets = 4;
  const R2 = (sag * sag + (gd / 2) ** 2) / (2 * sag);
  const half = Math.asin(gd / 2 / R2);
  const arc = [];
  for (let i = 0; i <= facets; i++) {
    const a = -half + 2 * half * i / facets;
    arc.push([Math.sin(a) * R2, y1 - (R2 - sag) + Math.cos(a) * R2 - (Math.cos(half) * R2 - (R2 - sag))]);
  }
  for (let i = 0; i < facets; i++) {
    const [za, ya] = arc[i], [zb, yb] = arc[i + 1];
    const len = Math.hypot(zb - za, yb - ya);
    const angle = Math.atan2(yb - ya, zb - za);
    const pane = buildBlock([gw, 6e-3, len], [0, (ya + yb) / 2, (za + zb) / 2], [-angle, 0, 0]);
    glass.push(cover(pane, WALL2));
    for (const x of [-gw / 2, 0, gw / 2]) {
      if (x === 0 && i % 2) continue;
      metal.push(withTone(beam([x, ya + 8e-3, za], [x, yb + 8e-3, zb], 0.024, 0.02), x === 0 ? -0.05 : 0.15));
    }
  }
  metal.push(withTone(beam([-gw / 2, arc[facets / 2][1] + 0.012, 0], [gw / 2, arc[facets / 2][1] + 0.012, 0], 0.022, 0.022), 0.3));
  for (const s of [-1, 1]) {
    const pts = [];
    const pos = [];
    for (let i = 0; i < facets; i++) {
      const [za, ya] = arc[i], [zb, yb] = arc[i + 1];
      pts.push([s * gw / 2, y1, 0], [s * gw / 2, ya, za], [s * gw / 2, yb, zb]);
    }
    for (const q of pts) pos.push(...q);
    const g = new THREE33.BufferGeometry();
    g.setAttribute("position", new THREE33.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("normal", new THREE33.BufferAttribute(new Float32Array(pos.length).map((_, k) => k % 3 === 0 ? s : 0), 3));
    plain(g);
    if (s < 0) g.index.array.reverse();
    glass.push(cover(g, WALL2));
  }
  glass.push(cover(buildQuads([
    { position: [0, y0 + wallH / 2, gd / 2], size: [gw, wallH], normal: [0, 0, 1] },
    { position: [0, y0 + wallH / 2, -gd / 2], size: [gw, wallH], normal: [0, 0, -1] },
    { position: [gw / 2, y0 + wallH / 2, 0], size: [gd, wallH], normal: [1, 0, 0] },
    { position: [-gw / 2, y0 + wallH / 2, 0], size: [gd, wallH], normal: [-1, 0, 0] }
  ]), WALL2));
  const floor = tray + 0.012;
  if (p.content === "tablet") {
    const tx = rng.range(-0.15, 0.15), yaw = rng.range(-0.25, 0.25);
    const tilt = 0.55;
    const tw = rng.range(0.38, 0.48), th = rng.range(0.24, 0.3);
    const m = new THREE33.Matrix4().makeTranslation(tx, floor, 0).multiply(new THREE33.Matrix4().makeRotationY(yaw));
    const stand = [buildBlock([tw * 0.7, 0.03, 0.2], [0, 0.015, -0.02]), beam([0, 0.03, -0.1], [0, 0.03 + Math.cos(tilt) * th * 0.6, -0.1 - Math.sin(tilt) * th * 0.3], 0.04, 0.03)];
    for (const g of stand) metal.push(withTone(g.applyMatrix4(m), -0.1));
    const pose = new THREE33.Matrix4().makeTranslation(0, 0.03 + Math.cos(tilt) * th / 2, 0.02 - Math.sin(tilt) * th / 2).multiply(new THREE33.Matrix4().makeRotationX(-tilt));
    const slab = buildBlock([tw, th, 0.035]).applyMatrix4(pose).applyMatrix4(m);
    stone.push(withTone(slab, (x, y, z, nx, ny, nz) => 0.35 + (nz > 0.3 ? 0.1 : -0.15)));
    const marks = [];
    for (let row = 0; row < 3; row++) {
      let x = -tw / 2 + 0.05;
      while (x < tw / 2 - 0.06) {
        const w = rng.chance(0.3) ? PX * 0.4 : rng.range(0.03, 0.07);
        if (rng.chance(0.85)) marks.push({ position: [x + w / 2, th / 2 - 0.06 - row * 0.075, 0.0185], size: [w, rng.chance(0.4) ? PX * 0.8 : PX * 0.4], normal: [0, 0, 1], tone: -1 });
        x += w + 0.025;
      }
    }
    stone.push(buildQuads(marks).applyMatrix4(pose).applyMatrix4(m));
  } else if (p.content === "rolls") {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const z = -gd / 2 + 0.12 + i * (gd - 0.24) / Math.max(1, n - 1) + rng.range(-0.02, 0.02);
      const x = rng.range(-0.15, 0.15), r = rng.range(0.035, 0.05), len = rng.range(0.32, 0.42);
      const coil = plain(new THREE33.CylinderGeometry(r, r, len, 10)).rotateZ(Math.PI / 2).translate(x, floor + 0.02 + r, z);
      metal.push(withTone(coil, (xx) => 0.2 + (Math.abs((xx - x) / (PX * 2) % 1) < 0.2 ? -0.3 : 0)));
      for (const s of [-1, 1]) {
        const cap = plain(new THREE33.CylinderGeometry(r + 0.012, r + 0.012, 0.016, 8)).rotateZ(Math.PI / 2).translate(x + s * (len / 2 + 8e-3), floor + 0.02 + r, z);
        stone.push(withTone(cap, -0.3));
        stone.push(withTone(buildBlock([0.05, 0.02, 0.06], [x + s * len * 0.3, floor + 0.01, z]), -0.45));
      }
      if (i === 0) {
        const tail = rng.range(0.15, 0.25);
        metal.push(withTone(buildBlock([len - 0.04, 4e-3, tail], [x, floor + 4e-3, z + r + tail / 2]), 0.1));
        const strokes = [];
        for (let k = 0; k < 3; k++) strokes.push({ position: [x + rng.range(-0.05, 0.05), floor + 65e-4, z + r + 0.04 + k * (tail - 0.06) / 3], size: [len * 0.5, PX * 0.45], normal: [0, 1, 0], tone: -0.9 });
        metal.push(buildQuads(strokes));
      }
    }
  }
  const stoneMesh = new THREE33.Mesh(mergeToned(stone), stoneMaterial(STONES.smoked, { seed: rng.int(0, 96), id: 20 }));
  stoneMesh.name = "stone";
  const metalMesh = new THREE33.Mesh(mergeToned(metal), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  metalMesh.name = "bronze";
  for (const mesh of [stoneMesh, metalMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.add(glassMesh(glass));
  group.userData.surface = { y: floor, size: [gw - 0.06, gd - 0.06] };
}
function buildSpecimens(group, p, rng) {
  const metal = [], glass = [], glow = [];
  const n = Math.round(p.count);
  const spacing = 0.3;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * spacing;
    const r = 0.12, base = 0.05, h = 0.48;
    const foot = plain(new THREE33.CylinderGeometry(r + 0.02, r + 0.03, base, 12)).translate(x, base / 2, 0);
    metal.push(withTone(foot, (xx, y, z, nx, ny) => ny > 0.5 ? 0.1 : -0.1));
    const lid = plain(new THREE33.CylinderGeometry(r + 0.015, r + 0.015, 0.035, 12)).translate(x, base + h + 0.0175, 0);
    metal.push(withTone(lid, (xx, y, z, nx, ny) => ny > 0.5 ? 0.15 : 0));
    metal.push(withTone(plain(new THREE33.CylinderGeometry(0.02, 0.025, 0.03, 6)).translate(x, base + h + 0.05, 0), 0.3));
    metal.push(withTone(buildQuads([{ position: [x, base * 0.5, r + 0.026], size: [0.1, 0.03], normal: [0, 0.2, 1] }]), 0.7));
    const level = rng.range(0.55, 0.85) * h;
    const liquid = plain(new THREE33.CylinderGeometry(r - 8e-3, r - 8e-3, level, 12)).translate(x, base + level / 2, 0);
    glass.push(cover(withTone(liquid, (xx, y, z, nx, ny) => ny > 0.5 ? 0.25 : -0.2), LIQUID));
    const wall = plain(new THREE33.CylinderGeometry(r, r, h, 14, 1, true)).translate(x, base + h / 2, 0);
    glass.push(cover(withTone(wall, 0.1), WALL2));
    const fy = base + rng.range(0.16, 0.24);
    const len = rng.range(0.12, 0.17);
    const dir = new THREE33.Vector3(rng.range(-0.25, 0.25), 1, rng.range(-0.25, 0.25)).normalize();
    glow.push(plain(buildGem({ length: len, radius: len * rng.range(0.32, 0.42), sides: rng.int(5, 6), waist: rng.range(0.38, 0.5), position: new THREE33.Vector3(x, fy, 0), direction: dir, spin: rng.range(0, 1) })));
    if (rng.chance(0.4)) {
      const l2 = len * 0.5;
      glow.push(plain(buildGem({ length: l2, radius: l2 * 0.4, sides: 5, position: new THREE33.Vector3(x + rng.range(-0.05, 0.05), fy + len * 0.5, rng.range(-0.04, 0.04)), direction: new THREE33.Vector3(rng.range(-0.6, 0.6), 1, 0.2).normalize() })));
    }
    metal.push(withTone(beam([x, base, 0], [x, fy - len * 0.4, 0], 0.016, 0.016), -0.2));
  }
  const metalMesh = new THREE33.Mesh(mergeToned(metal), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  metalMesh.name = "bronze";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  const fruit = new THREE33.Mesh(mergeToned(glow), glowMaterial("cyan", { level: 3, id: 40 }));
  fruit.name = "fruit";
  group.add(metalMesh, fruit, glassMesh(glass));
  group.userData.surface = null;
}
function glassMesh(parts) {
  const mesh = new THREE33.Mesh(
    mergeToned(parts),
    createToonMaterial({ ramp: GLASSES.clear.ramp, ink: GLASSES.clear.ink, steps: [0.25, 0.5, 0.8], tone: true, dither: true, outline: false, id: 32 })
  );
  mesh.name = "glass";
  mesh.receiveShadow = true;
  return mesh;
}

// src/assets/furniture/storage/drawer-archive.js
var drawer_archive_exports = {};
__export(drawer_archive_exports, {
  create: () => create28,
  dispose: () => disposeObject,
  meta: () => meta28,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE34 from "three";
var DRAWERS = { few: "Quelques tiroirs sortis", closed: "Tous ferm\xE9s", many: "Beaucoup de tiroirs sortis" };
var GEARS = { on: "Rouages qui tournent", off: "Rouages \xE0 l'arr\xEAt" };
var DEPTH6 = 0.8;
var PLINTH = 0.3;
var FRIEZE = 0.44;
var CORNICE = 0.12;
var SIDE = 0.07;
var POOL = 6;
var TRAVEL2 = 0.7;
var FIXED6 = 255;
var params28 = {
  seed: seedParam("Change les tiroirs sortis, les tons des colonnes, les tiroirs plus clairs ou plus sombres, la place et la taille des rouages, leur cadence."),
  width: numberParam("Largeur", 3, 1, 3, "Largeur du rayonnage (une colonne de tiroirs par 0,25 m ; 3 m = 12 colonnes).", { step: 0.25, unit: "m" }),
  height: numberParam("Hauteur", 5.5, 2, 5.5, "Hauteur totale, corniche comprise (5,5 m = 23 rang\xE9es ; les rangs hauts se lisent depuis la mezzanine).", { step: 0.1, unit: "m" }),
  drawers: choiceParam("Tiroirs", DRAWERS, "Tous ferm\xE9s, quelques-uns sortis (entrouverts de 0,3 m ou ouverts de 0,7 m), ou beaucoup. Pilotable : group.userData.archive."),
  gears: choiceParam("Rouages", GEARS, "Les rouages de la frise avancent d'une dent de temps en temps, ou restent immobiles."),
  glow: glowParam("Couleur des tranches de cassettes, dans les tiroirs ouverts.", { only: ["amber", "cyan"] })
};
var meta28 = {
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
  params: params28,
  variants: [
    { id: "monumental", name: "Monumental (3 \xD7 5,5 m)", params: {} },
    { id: "low", name: "Bas (2 \xD7 2,4 m)", params: { width: 2, height: 2.4, drawers: "many" } },
    { id: "closed", name: "Tous ferm\xE9s", params: { drawers: "closed" } }
  ]
};
function create28(given = {}) {
  const p = resolveParams(meta28.params, given);
  const rng = createRng(p.seed * 7919 + 61);
  const W = p.width, H = p.height, D = DEPTH6;
  const bronze = [];
  const glow = [];
  const add = (g, tone = 0, part = FIXED6) => bronze.push([withTone(g, tone), part]);
  const gridY0 = PLINTH + 0.05;
  const gridY1 = H - CORNICE - FRIEZE - 0.04;
  const gridH = gridY1 - gridY0;
  const innerW = W - 2 * SIDE;
  const cols = Math.max(2, Math.round(innerW / 0.24));
  const rows = Math.max(3, Math.round(gridH / 0.198));
  const pitchX = innerW / cols, pitchY = gridH / rows;
  const soot2 = (y) => -0.22 * THREE34.MathUtils.smoothstep(y, H * 0.45, H);
  for (const s of [-1, 1]) {
    const side = buildBlock([SIDE, H - PLINTH + 0.02, D + 0.02], [s * (W / 2 - SIDE / 2), (H + PLINTH) / 2 - 0.01, (D + 0.02) / 2]);
    add(withTone(side, (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.1 : 0.05) + soot2(y)));
    add(rivetRow([s * (W / 2 - SIDE / 2), PLINTH + 0.25, D + 0.025], [s * (W / 2 - SIDE / 2), H - 0.3, D + 0.025], { spacing: 0.4, size: PX * 0.7 }), 0.3);
  }
  add(buildBlock([innerW, H - PLINTH, 0.03], [0, (H + PLINTH) / 2, 0.015]), -0.5);
  add(buildBlock([W + 0.1, CORNICE, D + 0.1], [0, H - CORNICE / 2, (D + 0.1) / 2]), (x, y, z, nx, ny) => ny > 0.5 ? -0.1 : 0.12);
  add(buildBlock([W + 0.04, PX, D + 0.05], [0, H - CORNICE - PX / 2, (D + 0.05) / 2]), -0.35);
  const fy0 = H - CORNICE - FRIEZE, fy1 = H - CORNICE - PX;
  add(buildBlock([innerW, FRIEZE, 0.03], [0, (fy0 + fy1) / 2, D - 0.1]), -0.8);
  add(buildBlock([innerW, 0.05, 0.08], [0, fy0 + 0.025, D - 0.04]), (x, y) => 0.08 + soot2(y));
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
      const tone = colTone[c] + (odd < 0.04 ? -0.18 : odd > 0.95 ? 0.14 : rng.range(-0.04, 0.04)) + soot2(y);
      cellQuad.set(`${c},${r}`, fronts.length);
      fronts.push({ position: [x, y, zFront], size: [fw, fh], tone });
      fronts.push({ position: [x, y - fh * 0.12, zFront + 6e-3], size: [PX * 1.1, PX * 0.7], tone: 0.5 + soot2(y) * 0.5 });
    }
  }
  const frontStart = bronze.reduce((n, [g]) => n + g.attributes.position.count, 0);
  bronze.push([buildQuads(fronts), FIXED6]);
  for (let c = 4; c < cols; c += 4) {
    add(buildBlock([PX * 1.2, gridH, 0.04], [-innerW / 2 + c * pitchX, (gridY0 + gridY1) / 2, D - 0.02]), (x, y) => 0.12 + soot2(y));
  }
  for (let r = 6; r < rows; r += 6) {
    add(buildBlock([innerW, PX * 0.9, 0.035], [0, gridY0 + r * pitchY, D - 0.018]), (x, y) => 0.02 + soot2(y));
  }
  const dw = pitchX - PX * 1.15, dh = pitchY - PX;
  const body = TRAVEL2 - 0.04;
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
        y = THREE34.MathUtils.clamp(prev.y + rng.range(-0.5, 0.5) * dist, Math.min(lo, hi), Math.max(lo, hi));
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
      const disc = plain(new THREE34.CylinderGeometry(radius * 0.62, radius * 0.62, 6e-3, 8));
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
  const group = new THREE34.Group();
  group.name = meta28.name;
  const bronzeMerged = mergeParts(bronze);
  const bronzeMesh = new THREE34.Mesh(bronzeMerged.geometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronzeMesh.name = "bronze";
  const stoneMesh = new THREE34.Mesh(mergeToned([plinth, withTone(plinthTop, 0.1)]), stoneMaterial(STONES.blackBasalt, { seed: p.seed % 97, id: 20 }));
  stoneMesh.name = "plinth";
  for (const m of [bronzeMesh, stoneMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  const glowMerged = mergeParts(glow);
  const glowMesh = new THREE34.Mesh(glowMerged.geometry, glowMaterial(p.glow, { level: 2, id: 40 }));
  glowMesh.name = "cassettes";
  group.add(glowMesh);
  const rigs = [createRigidParts(bronzeMerged.geometry, bronzeMerged.partOf, POOL + gears.length), createRigidParts(glowMerged.geometry, glowMerged.partOf, POOL)];
  const positions = bronzeMerged.geometry.attributes.position;
  const frontBase = positions.array.slice(frontStart * 3, (frontStart + fronts.length * 4) * 3);
  const slots = Array.from({ length: POOL }, () => ({ cell: null, u: 0, tween: null }));
  const cellCenter = (c, r) => new THREE34.Vector3(-innerW / 2 + (c + 0.5) * pitchX, gridY0 + (r + 0.5) * pitchY, 0);
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
    for (const rig of rigs) rig.matrices[k]?.makeTranslation(v.x, v.y, s.u * TRAVEL2);
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
      slots[k].u = THREE34.MathUtils.clamp(u, 0, 1);
      slots[k].tween = null;
      dirty = true;
    },
    slide(c, r, u, seconds = 1) {
      if (!valid(c, r)) return;
      const k = slotOf(c, r, true);
      slots[k].tween = { from: slots[k].u, to: THREE34.MathUtils.clamp(u, 0, 1), start: sharedUniforms.uTime.value, seconds };
    }
  };
  const pulled = { closed: 0, few: rng.int(1, 3), many: rng.int(5, 6) }[p.drawers];
  for (let i = 0; i < pulled; i++) {
    const c = rng.int(0, cols - 1), r = rng.int(1, Math.max(1, rows - 3));
    archive.setDrawer(c, r, rng.chance(0.5) ? 0.3 / TRAVEL2 : 1);
  }
  const ease2 = (x) => x * x * (3 - 2 * x);
  const gearAngles = gears.map(() => NaN);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  const tmp = new THREE34.Matrix4();
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime || dirty) {
      lastTime = time;
      for (const s of slots) {
        if (!s.tween) continue;
        const k = Math.min(1, (time - s.tween.start) / s.tween.seconds);
        s.u = s.tween.from + (s.tween.to - s.tween.from) * ease2(k);
        if (k >= 1) s.tween = null;
        dirty = true;
      }
      const beat = p.gears === "on" ? (time + gearPhase) / period : 0;
      const n = Math.floor(beat);
      const step = n + ease2(Math.min(1, (beat - n) / 0.22));
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
  group.userData.asset = { id: meta28.id, params: p };
  return group;
}

// src/assets/furniture/tables/stone-table.js
var stone_table_exports = {};
__export(stone_table_exports, {
  create: () => create29,
  dispose: () => disposeObject,
  meta: () => meta29,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE35 from "three";
var KINDS4 = {
  reading: "Lecture (Archives)",
  observation: "Observation (salle d'\xE9tude)",
  transcription: "Transcription (salle 2)",
  dissection: "Dissection (salle 5)",
  support: "Support (salle 6)"
};
var SIZES7 = {
  reading: [2.4, 1, 0.85],
  observation: [1.6, 0.8, 0.9],
  transcription: [1.4, 0.7, 0.85],
  dissection: [2, 0.8, 0.9],
  support: [1.2, 0.6, 0.9]
};
var TOP3 = 0.08;
var params29 = {
  seed: seedParam("Change les dalles du plateau, l'angle \xE9corn\xE9, l'usure, le code des glyphes, la place des carnets et de l'encrier."),
  kind: choiceParam("Mod\xE8le", KINDS4, "Lecture (Archives), observation (feutre et rebord), transcription (bois, carnets, encrier), dissection (rigoles, feutre), support (nue)."),
  glow: glowParam("Couleur du trait de glyphes de la tranche.", { only: ["amber", "cyan"] })
};
var meta29 = {
  id: "furniture/tables/stone-table",
  name: "Table de pierre",
  nameEn: "Stone table",
  category: "furniture",
  subcategory: "tables",
  description: "Table du Complexe : plateau \xE9pais de pierre fum\xE9e sur deux pieds de bronze en patte, tiroir au milieu, trait de glyphes lumineux sur la tranche. Table de lecture des Archives, table d'observation (feutre, rebord), de transcription (bois noirci, carnets, plume, encrier), de dissection (rigoles, feutre) ou simple support. Fiches ARC-05, ETU-10, E2-04, E5-05, E6-06.",
  tags: [
    "table",
    "table de lecture",
    "\xE9tabli",
    "plateau",
    "pierre fum\xE9e",
    "bronze",
    "pattes",
    "tiroir",
    "glyphes",
    "feutre",
    "carnets",
    "encrier",
    "le complexe",
    "complexe",
    "ancien-tech",
    "mobilier",
    "int\xE9rieur",
    "reading table",
    "desk",
    "stone top",
    "smoked stone",
    "bronze legs",
    "paw feet",
    "drawer",
    "glyphs",
    "felt mat",
    "notebooks",
    "inkwell",
    "ancient complex",
    "ancient-tech",
    "furniture",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au centre de la table (le tiroir et la tranche \xE0 glyphes regardent +z)",
  footprint: { radius: 1.3, height: 0.95 },
  animated: [],
  params: params29,
  variants: variantsOf("kind", params29.kind)
};
function create29(given = {}) {
  const p = resolveParams(meta29.params, given);
  const rng = createRng(p.seed * 7919 + 131);
  const [W, D, H] = SIZES7[p.kind];
  const wooden = p.kind === "transcription";
  const top = [], bronze = [], glow = [];
  const y0 = H - TOP3;
  const slabs = wooden ? 1 : rng.int(1, p.kind === "reading" ? 3 : 2);
  const joints = Array.from({ length: slabs - 1 }, (_, i) => -W / 2 + (i + 1) * W / slabs + rng.range(-0.08, 0.08));
  const chip = { x: rng.chance(0.5) ? 1 : -1, z: rng.chance(0.6) ? 1 : -1, size: rng.range(0.05, 0.1) };
  const wear = { x: rng.range(-0.25, 0.25) * W, z: D * 0.18 };
  const mat = { observation: [0.82, 0.7], dissection: [0.45, 0.72] }[p.kind];
  const matX = p.kind === "dissection" ? (rng.chance(0.5) ? 1 : -1) * W * 0.22 : 0;
  const slab = gridBlock([W, TOP3, D], [0, y0 + TOP3 / 2, 0], { cell: 0.08 });
  const pos = slab.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (x * chip.x > W / 2 - chip.size && z * chip.z > D / 2 - chip.size && y > y0 + TOP3 / 2) pos.setY(i, y - 0.035);
  }
  slab.computeVertexNormals();
  const slabTone = Array.from({ length: slabs }, () => rng.range(-0.06, 0.06));
  withTone(slab, (x, y, z, nx, ny) => {
    let t = slabTone[joints.filter((j) => x > j).length];
    if (joints.some((j) => Math.abs(x - j) < 0.03)) t -= 0.45;
    if (ny > 0.5) {
      t -= 0.12;
      const d = Math.hypot((x - wear.x) / (W * 0.35), (z - wear.z) / (D * 0.4));
      if (!wooden && d < 1) t += 0.1 * (1 - d);
      if (mat && Math.abs(x - matX) < W * mat[0] / 2 && Math.abs(z) < D * mat[1] / 2) t = -0.75;
    }
    if (x * chip.x > W / 2 - chip.size - 0.02 && z * chip.z > D / 2 - chip.size - 0.02) t -= 0.25;
    return t;
  });
  top.push(slab);
  if (joints.length) {
    top.push(buildQuads(joints.map((j) => ({ position: [j, H + 1e-3, 0], size: [PX * 0.5, D - 0.01], normal: [0, 1, 0], tone: -0.6 }))));
  }
  if (p.kind === "dissection") {
    const x0 = matX > 0 ? -W / 2 + 0.08 : -W / 2 + W * 0.5, x1 = matX > 0 ? W * 0 - 0.02 : W / 2 - 0.08;
    const lines = [];
    for (let k = 0; k < 4; k++) lines.push({ position: [(x0 + x1) / 2, H + 15e-4, -D * 0.3 + k * D * 0.2], size: [x1 - x0, PX * 0.5], normal: [0, 1, 0], tone: -0.7 });
    lines.push({ position: [x0 + 0.03, H + 15e-4, 0], size: [PX * 0.6, D * 0.65], normal: [0, 1, 0], tone: -0.7 });
    top.push(buildQuads(lines));
  }
  const legX = W / 2 - Math.min(0.28, W * 0.14);
  const footD = D * 0.82;
  for (const s of [-1, 1]) {
    const x = s * legX;
    bronze.push(withTone(buildBlock([0.11, y0 - 0.16, 0.15], [x, 0.08 + (y0 - 0.16) / 2 + 0.02, 0], [0, 0, 0], { taper: 0.3 }), -0.02));
    bronze.push(withTone(buildBlock([0.12, 0.09, footD], [x, 0.065, 0]), (px, py, pz, nx, ny) => ny > 0.5 ? 0.12 : -0.05));
    for (const e of [-1, 1]) {
      const zEnd = e * footD / 2;
      bronze.push(withTone(buildBlock([0.15, 0.08, 0.08], [x, 0.05, zEnd + e * 0.02]), 0.05));
      for (const t of [-1, 0, 1]) {
        bronze.push(withTone(buildBlock([0.035, 0.045, 0.07], [x + t * 0.05, 0.0225, zEnd + e * 0.08], [0, t * e * 0.25, 0]), t ? -0.1 : 0.2));
      }
    }
    bronze.push(withTone(buildBlock([0.14, 0.07, D * 0.72], [x, y0 - 0.035, 0]), -0.15));
    bronze.push(withTone(buildBlock([0.14, 0.05, 0.05], [x, y0 - 0.1, 0]), 0.1));
  }
  bronze.push(withTone(beam([-legX, 0.24, 0], [legX, 0.24, 0], 0.05, 0.06), (x, y, z, nx, ny) => ny > 0.5 ? 0.1 : -0.12));
  if (p.kind !== "support") {
    const dw = Math.min(0.55, W * 0.3);
    bronze.push(withTone(buildBlock([dw, 0.1, D * 0.62], [0, y0 - 0.05, D * 0.12]), -0.3));
    bronze.push(withTone(buildBlock([dw - 0.02, 0.08, 0.015], [0, y0 - 0.05, D * 0.43 + 8e-3]), 0.08));
    bronze.push(withTone(buildBlock([PX * 1.6, PX * 0.6, 0.02], [0, y0 - 0.055, D * 0.43 + 0.02]), 0.5));
  }
  if (p.kind === "observation") {
    const b = PX * 0.6, h = 0.03;
    bronze.push(withTone(buildBlock([W + 0.01, h, b], [0, H + h / 2, D / 2 - b / 2]), 0.15));
    bronze.push(withTone(buildBlock([W + 0.01, h, b], [0, H + h / 2, -D / 2 + b / 2]), 0.05));
    for (const s of [-1, 1]) bronze.push(withTone(buildBlock([b, h, D - 2 * b], [s * (W / 2 - b / 2), H + h / 2, 0]), 0.1));
  }
  if (wooden) {
    const piles = rng.int(1, 2);
    for (let k = 0; k < piles; k++) {
      const px = -W * 0.32 + k * 0.24 + rng.range(-0.04, 0.04), pz = -D * 0.18 + rng.range(-0.05, 0.05);
      const spin = rng.range(-0.3, 0.3);
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const y = H + 0.016 + i * 0.032;
        const r = spin + rng.range(-0.12, 0.12);
        bronze.push(withTone(buildBlock([0.17, 0.032, 0.23], [px, y, pz], [0, r, 0]), -0.62 + i % 2 * 0.08));
        bronze.push(withTone(buildBlock([0.155, 0.022, 0.235], [px + 8e-3, y, pz], [0, r, 0]), 0.42));
      }
    }
    const ox = rng.range(-0.05, 0.12), oz = D * 0.16;
    bronze.push(withTone(buildBlock([0.36, 0.012, 0.24], [ox, H + 6e-3, oz], [0, rng.range(-0.15, 0.15), 0]), -0.62));
    for (const s of [-1, 1]) bronze.push(withTone(buildBlock([0.165, 0.012, 0.22], [ox + s * 0.085, H + 0.018, oz], [0, 0, -s * 0.08]), 0.48));
    const lines = [];
    for (const s of [-1, 1]) for (let l = 0; l < 3; l++) lines.push({ position: [ox + s * 0.085, H + 0.0262 + s * 0, oz - 0.06 + l * 0.05], size: [0.11, PX * 0.35], normal: [0, 1, 0], tone: -0.55 });
    bronze.push(buildQuads(lines));
    const ix = W * 0.3 + rng.range(-0.05, 0.05), iz = -D * 0.12;
    const well = plain(new THREE35.CylinderGeometry(0.035, 0.045, 0.06, 6));
    well.translate(ix, H + 0.03, iz);
    bronze.push(withTone(well, -0.7));
    const cap = plain(new THREE35.CylinderGeometry(0.02, 0.02, 0.02, 6));
    cap.translate(ix, H + 0.07, iz);
    bronze.push(withTone(cap, 0.3));
    bronze.push(withTone(beam([ix - 0.02, H + 0.075, iz + 0.01], [ix - 0.2, H + 0.012, iz + 0.12], PX * 0.5, PX * 0.35), 0.55));
  }
  const strip = glyphStrip(rng, { length: W - 0.16, rows: 1, depth: 6e-3 });
  strip.translate(0, y0 + TOP3 / 2 - PX / 2, D / 2);
  glow.push(strip);
  const group = new THREE35.Group();
  group.name = meta29.name;
  const topMaterial = wooden ? createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, pattern: "speckle", patternParams: [16, 0.05, 0.12, 1], seed: p.seed % 97, id: 20 }) : stoneMaterial(STONES.smoked, { seed: p.seed % 97, id: 20 });
  const topMesh = new THREE35.Mesh(mergeToned(top), topMaterial);
  topMesh.name = "top";
  const bronzeMesh = new THREE35.Mesh(mergeToned(bronze), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronzeMesh.name = "bronze";
  for (const mesh of [topMesh, bronzeMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const glyphs = new THREE35.Mesh(mergeToned(glow), glowMaterial(p.glow, { level: 2, id: 40 }));
  glyphs.name = "glyphs";
  group.add(glyphs);
  group.userData.surface = { y: H, size: [W, D] };
  group.userData.asset = { id: meta29.id, params: p };
  return group;
}

// src/assets/props/books/data-cassette.js
var data_cassette_exports = {};
__export(data_cassette_exports, {
  create: () => create30,
  dispose: () => disposeObject,
  meta: () => meta30,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE36 from "three";
var KINDS5 = { cassette: "Cassette de verre", roll: "Rouleau-bande de cuivre" };
var POSES2 = { lying: "Couch\xE9e", standing: "Debout sur sa tranche", stack: "En pile" };
var WEARS = { used: "Servie", new: "Neuve", worn: "Us\xE9e" };
var L = 0.18;
var Wd = 0.1;
var T = 0.024;
var params30 = {
  seed: seedParam("Change le code lumineux de la tranche, l'\xE9raflure du verre, le d\xE9sordre d'une pile ; pour le rouleau, la longueur du bout, les traits grav\xE9s, la bande restante."),
  kind: choiceParam("Objet", KINDS5, "Cassette de verre sertie de cuivre (ARC-03), ou rouleau-bande de cuivre sur bobine de bois (ARC-12)."),
  color: choiceParam("Tranche", DATA_GLOWS, "Couleur de classement de la tranche lumineuse (cassette)."),
  wear: choiceParam("Usure", WEARS, "Neuve (cuivre vif, tranche vive), servie, ou us\xE9e (cuivre terni, verre \xE9rafl\xE9, tranche faible)."),
  pose: choiceParam("Pose", POSES2, "Couch\xE9e \xE0 plat, debout sur sa tranche (lueur en haut), ou en pile."),
  count: numberParam("Pile", 5, 2, 8, "Nombre de cassettes dans une pile (pose \xAB En pile \xBB), ou de rouleaux (3 au plus).", { step: 1 })
};
var meta30 = {
  id: "props/books/data-cassette",
  name: "Cassette de donn\xE9es",
  nameEn: "Data cassette",
  category: "props",
  subcategory: "books",
  description: "Le livre du Complexe : une plaquette de verre fum\xE9 sertie de cuivre dont la tranche luit d'une couleur de classement (ambre, cyan, vert, rouge), couch\xE9e, debout ou en pile ; tr\xE8s l\xE9g\xE8re, faite pour \xEAtre pos\xE9e par centaines. Ou un rouleau-bande de cuivre grav\xE9 sur sa bobine de bois, le bout d\xE9roul\xE9. Fiches ARC-03, ARC-12.",
  tags: [
    "cassette",
    "donn\xE9es",
    "m\xE9moire",
    "archive",
    "verre fum\xE9",
    "cuivre",
    "tranche lumineuse",
    "rouleau",
    "bande grav\xE9e",
    "bobine",
    "livre",
    "le complexe",
    "complexe",
    "ancien-tech",
    "lumineux",
    "l\xE9ger",
    "int\xE9rieur",
    "data cassette",
    "glass tablet",
    "record",
    "smoked glass",
    "copper",
    "glowing edge",
    "scroll",
    "engraved tape",
    "spool",
    "book",
    "ancient complex",
    "ancient-tech",
    "glowing",
    "lightweight",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au sol, au centre de l'objet (la tranche lumineuse regarde +z, ou le haut debout)",
  footprint: { radius: 0.32, height: 0.12 },
  animated: [],
  params: params30,
  variants: [
    { id: "lying", name: "Cassette couch\xE9e", params: {} },
    { id: "standing", name: "Cassette debout", params: { pose: "standing", color: "cyan" } },
    { id: "stack", name: "Pile de cassettes", params: { pose: "stack", color: "green", wear: "worn" } },
    { id: "roll", name: "Rouleau-bande", params: { kind: "roll" } }
  ]
};
function create30(given = {}) {
  const p = resolveParams(meta30.params, given);
  const rng = createRng(p.seed * 7919 + 83);
  const group = new THREE36.Group();
  group.name = meta30.name;
  if (p.kind === "roll") buildRolls(group, p, rng);
  else buildCassettes(group, p, rng);
  group.userData.asset = { id: meta30.id, params: p };
  return group;
}
function buildCassettes(group, p, rng) {
  const wear = { new: -0.08, used: -0.2, worn: -0.38 }[p.wear];
  const marks = rng.int(1, 3);
  const cuts = Array.from({ length: marks - 1 }, () => rng.range(0.2, 0.8)).sort();
  const scratch = p.wear === "worn" || rng.chance(0.3) ? rng.range(-0.4, 0.4) : null;
  const copper = [], glass = [], light = [];
  const count = p.pose === "stack" ? Math.round(p.count) : 1;
  for (let i = 0; i < count; i++) {
    const m = new THREE36.Matrix4();
    if (p.pose === "standing") {
      m.makeRotationY(rng.range(-0.3, 0.3)).multiply(new THREE36.Matrix4().makeTranslation(0, Wd / 2, 0)).multiply(new THREE36.Matrix4().makeRotationX(-Math.PI / 2));
    } else {
      const spin = p.pose === "stack" ? rng.range(-0.12, 0.12) + (rng.chance(0.15) ? Math.PI : 0) : rng.range(-0.3, 0.3);
      m.makeTranslation(p.pose === "stack" ? rng.range(-0.012, 0.012) : 0, T / 2 + i * T, p.pose === "stack" ? rng.range(-0.01, 0.01) : 0);
      m.multiply(new THREE36.Matrix4().makeRotationY(spin));
    }
    copper.push(withTone(buildBlock([L, T, Wd]).applyMatrix4(m), wear + (i % 2 ? -0.06 : 0)));
    const faces = [
      { position: [0, T / 2 + 1e-3, -4e-3], size: [L - 0.03, Wd - 0.032], normal: [0, 1, 0], tone: 0 },
      { position: [0, -T / 2 - 1e-3, -4e-3], size: [L - 0.03, Wd - 0.032], normal: [0, -1, 0], tone: -0.2 }
    ];
    if (scratch !== null && i === count - 1) faces.push({ position: [scratch * 0.06, T / 2 + 2e-3, 0], size: [0.05, PX * 0.4], normal: [0, 1, 0], tone: 0.55 });
    glass.push(buildQuads(faces).applyMatrix4(m));
    const bounds = [0, ...cuts, 1];
    const segs = [];
    for (let k = 0; k < bounds.length - 1; k++) {
      const a = -L / 2 + 0.012 + bounds[k] * (L - 0.024) + (k ? 8e-3 : 0);
      const b = -L / 2 + 0.012 + bounds[k + 1] * (L - 0.024) - (k < bounds.length - 2 ? 8e-3 : 0);
      segs.push({ position: [(a + b) / 2, 0, Wd / 2 + 15e-4], size: [b - a, T * 0.62] });
    }
    light.push(buildQuads(segs).applyMatrix4(m));
  }
  const copperMesh = new THREE36.Mesh(mergeToned(copper), metalMaterial(METALS.copper, { id: 30, tone: true }));
  copperMesh.name = "rim";
  const glassMesh2 = new THREE36.Mesh(mergeToned(glass), createToonMaterial({ ramp: GLASSES.smoky.ramp, ink: GLASSES.smoky.ink, steps: [0.3, 0.55, 0.85], tone: true, crease: true, id: 31 }));
  glassMesh2.name = "glass";
  const slice = new THREE36.Mesh(mergeToned(light), glowMaterial(DATA_GLOWS[p.color], { level: p.wear === "worn" ? 1 : p.wear === "new" ? 3 : 2, id: 40 }));
  slice.name = "slice";
  for (const mesh of [copperMesh, glassMesh2]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(copperMesh, glassMesh2, slice);
}
function buildRolls(group, p, rng) {
  const wood = [], tape = [];
  const n = p.pose === "stack" ? Math.min(3, Math.round(p.count)) : 1;
  const flange = 0.06, axle = 0.4;
  const spots = [[0, flange, 0], [0, flange, -0.125], [0, flange + 0.104, -0.0625]].slice(0, n);
  if (n === 1) spots[0][2] = -0.12;
  const tarnish = { new: 0.1, used: 0, worn: -0.18 }[p.wear];
  spots.forEach(([x, y, z], i) => {
    const turn = rng.range(0, Math.PI);
    const r = rng.range(0.034, 0.05);
    for (const s of [-1, 1]) {
      const g = plain(new THREE36.CylinderGeometry(flange, flange, 0.02, 8));
      g.rotateZ(Math.PI / 2);
      g.rotateX(turn);
      g.translate(x + s * (axle / 2 - 0.01), y, z);
      wood.push(withTone(g, (px, py, pz, nx) => Math.abs(nx) > 0.5 ? 0.05 : -0.1));
      const hub = plain(new THREE36.CylinderGeometry(0.016, 0.016, 0.03, 6));
      hub.rotateZ(Math.PI / 2);
      hub.translate(x + s * (axle / 2 + 5e-3), y, z);
      wood.push(withTone(hub, 0.2));
    }
    const coil = plain(new THREE36.CylinderGeometry(r, r, axle - 0.04, 10));
    coil.rotateZ(Math.PI / 2);
    coil.rotateX(turn);
    coil.translate(x, y, z);
    tape.push(withTone(coil, (px) => tarnish + (Math.abs((px - x) / (PX * 2) % 1) < 0.18 ? -0.25 : 0)));
    if (i !== n - 1) return;
    const length = rng.range(0.4, 0.55);
    const width = axle - 0.06;
    const pts = [[y + r * 0.6, z + r * 0.85], [y - flange * 0.5, z + r + 0.035], [4e-3, z + r + 0.07]];
    let left = length - 0.12;
    let zz = pts[2][1];
    while (left > 0.02) {
      const step = Math.min(0.1, left);
      zz += step;
      left -= step;
      pts.push([4e-3 + (left < 0.05 ? 0.012 : 0), zz]);
    }
    const strokes = rng.int(3, 5);
    const at = Array.from({ length: strokes }, (_, k) => 0.2 + (k + rng.range(0.2, 0.8)) * ((length - 0.25) / strokes));
    const engraved = [];
    let run = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ya, za] = pts[k], [yb, zb] = pts[k + 1];
      const len = Math.hypot(yb - ya, zb - za);
      const angle = Math.atan2(-(yb - ya), zb - za);
      const strip = buildBlock([width, 4e-3, len + 2e-3], [x, (ya + yb) / 2, (za + zb) / 2], [angle, 0, 0]);
      tape.push(withTone(strip, (px, py, pz, nx, ny) => tarnish + (ny > 0.3 ? -0.12 : -0.3)));
      for (const d of at) {
        if (d < run || d >= run + len) continue;
        const u = (d - run) / len;
        const ny = Math.cos(angle), nz = Math.sin(angle);
        engraved.push({
          position: [x + rng.range(-0.02, 0.02), ya + (yb - ya) * u + ny * 25e-4, za + (zb - za) * u + nz * 25e-4],
          size: [width * rng.range(0.55, 0.8), PX * 0.55],
          normal: [0, ny, nz],
          tone: -0.75
        });
      }
      run += len;
    }
    if (engraved.length) tape.push(buildQuads(engraved));
  });
  const woodEntry = WOODS.blackenedOak;
  const woodMesh = new THREE36.Mesh(mergeToned(wood), createToonMaterial({ ramp: woodEntry.ramp, ink: woodEntry.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, id: 20 }));
  woodMesh.name = "spool";
  const tapeMesh = new THREE36.Mesh(mergeToned(tape), metalMaterial(METALS.copper, { id: 30, tone: true, steps: [0.34, 0.56, 0.8, 0.97] }));
  tapeMesh.name = "tape";
  for (const mesh of [woodMesh, tapeMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

// src/assets/props/machines/complex-cart.js
var complex_cart_exports = {};
__export(complex_cart_exports, {
  create: () => create31,
  dispose: () => disposeObject,
  meta: () => meta31,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE37 from "three";
var MODELS12 = {
  cassettes: "\xC0 cassettes (Archives, 3 plateaux)",
  instruments: "D'instruments (Galerie, 2 plateaux)",
  heavy: "\xC0 pi\xE8ces lourdes (Atelier, madriers, timon)"
};
var LOADS = { full: "Charg\xE9", half: "\xC0 moiti\xE9", empty: "Vide" };
var DRAWBARS = { down: "Baiss\xE9 au sol", up: "Relev\xE9" };
var SIZES8 = {
  cassettes: { L: 1, D: 0.6, r: 0.1, shelves: [0.3, 0.6, 0.9], handle: 1.08 },
  instruments: { L: 1.2, D: 0.6, r: 0.125, shelves: [0.36, 0.8], handle: 0.98 },
  heavy: { L: 1.8, D: 0.8, r: 0.2, shelves: [0.58] }
};
var COLORS2 = ["amber", "cyan", "green", "red"];
var FIXED7 = 255;
var DRAWBAR = 6;
var params31 = {
  seed: seedParam("Change la charge (piles, rang\xE9es, couleurs des tranches, objets pos\xE9s), l'orientation des roulettes, l'usure, la place du timon."),
  model: choiceParam("Mod\xE8le", MODELS12, "Chariot \xE0 cassettes des Archives, chariot d'instruments de la Galerie, ou chariot \xE0 pi\xE8ces lourdes de l'Atelier."),
  load: choiceParam("Charge", LOADS, "Plateaux pleins, \xE0 moiti\xE9 pleins, ou vides."),
  drawbar: choiceParam("Timon", DRAWBARS, "Chariot lourd : timon baiss\xE9, pos\xE9 au sol devant le chariot, ou relev\xE9 contre le plateau.")
};
var meta31 = {
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
  params: params31,
  variants: [
    { id: "cassettes", name: "\xC0 cassettes", params: {} },
    { id: "instruments", name: "D'instruments", params: { model: "instruments" } },
    { id: "heavy", name: "\xC0 pi\xE8ces lourdes", params: { model: "heavy" } },
    { id: "heavy-up", name: "Lourd vide, timon relev\xE9", params: { model: "heavy", load: "empty", drawbar: "up" } }
  ]
};
function create31(given = {}) {
  const p = resolveParams(meta31.params, given);
  const rng = createRng(p.seed * 7919 + 401);
  const S = SIZES8[p.model];
  const heavy = p.model === "heavy";
  const metal = [], wood = [], glow = [];
  const fill = { full: 1, half: 0.5, empty: 0 }[p.load];
  const heavyPivot = new THREE37.Vector3(), heavyTip = new THREE37.Vector3();
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
      const hub = plain(new THREE37.CylinderGeometry(0.055, 0.055, w + 0.04, 8)).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
      wood.push([withTone(hub, 0.1), part]);
    } else {
      const web = plain(new THREE37.CylinderGeometry(r - 0.015, r - 0.015, w * 0.55, 10)).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
      metal.push([withTone(web, -0.5), part]);
    }
    const cap = plain(new THREE37.CylinderGeometry(r * 0.28, r * 0.28, w + 0.05, 8)).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
    metal.push([withTone(cap, heavy ? 0.05 : 0.25), part]);
    for (const s of [-1, 1]) {
      metal.push([withTone(buildBlock([PX * 0.6, PX * 0.6, 0.01], [A.x + r * 0.55, A.y, A.z + s * (w * 0.3 + 5e-3)]), 0.55), part]);
    }
    wheels.push({ A: A.clone(), r, part });
  };
  if (heavy) buildHeavy();
  else buildShelfCart();
  function buildShelfCart() {
    const { L: L2, D, r, shelves } = S;
    const w = 0.045;
    const bottom = shelves[0] - 0.05;
    const top = shelves[shelves.length - 1] + 0.05;
    const xEnd = L2 / 2 - 0.03, zEnd = D / 2 - 0.03;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      metal.push([withTone(beam([sx * xEnd, bottom, sz * zEnd], [sx * xEnd, top, sz * zEnd], PX * 0.7, PX * 0.7), sx < 0 ? 0 : -0.06), FIXED7]);
    }
    shelves.forEach((y, i) => {
      const t = rng.range(-0.08, 0.06) - 0.05 * i;
      metal.push([withTone(buildBlock([L2 - 0.02, 0.025, D - 0.02], [0, y - 0.0125, 0]), (x, yy, z, nx, ny) => t + (ny > 0.5 ? -0.12 : 0)), FIXED7]);
      for (const sz of [-1, 1]) metal.push([withTone(buildBlock([L2 - 0.02, 0.04, PX * 0.35], [0, y + 0.02, sz * (D / 2 - 0.015)]), t + 0.12), FIXED7]);
      for (const sx of [-1, 1]) metal.push([withTone(buildBlock([PX * 0.35, 0.04, D - 0.02], [sx * (L2 / 2 - 0.015), y + 0.02, 0]), t + 0.12), FIXED7]);
    });
    const hx = -L2 / 2 - 0.07;
    for (const sz of [-1, 1]) {
      metal.push([withTone(beam([-xEnd, top - 0.03, sz * (zEnd - 0.04)], [hx, S.handle, sz * (zEnd - 0.04)], PX * 0.55, PX * 0.55), 0.2), FIXED7]);
    }
    const bar = plain(new THREE37.CylinderGeometry(0.022, 0.022, D - 0.02, 8)).rotateX(Math.PI / 2).translate(hx, S.handle, 0);
    metal.push([withTone(bar, (x, y) => y > S.handle ? 0.45 : 0.3), FIXED7]);
    const axleY = r;
    for (const sz of [-1, 1]) {
      const A = new THREE37.Vector3(-xEnd + 0.05, axleY, sz * (zEnd - 0.01));
      metal.push([withTone(buildBlock([0.06, bottom - axleY + 0.01, 0.015], [A.x, (bottom + axleY) / 2, A.z - sz * (w / 2 + 0.012)]), -0.1), FIXED7]);
      addWheel(A, r, w, sz < 0 ? 0 : 1);
    }
    [-1, 1].forEach((sz, k) => {
      const pivot = new THREE37.Vector3(xEnd - 0.06, bottom - 0.01, sz * (zEnd - 0.01));
      const trail = 0.045;
      const A = new THREE37.Vector3(pivot.x - trail, axleY, pivot.z);
      const part = 4 + k;
      metal.push([withTone(buildBlock([0.08, 0.015, 0.08], [pivot.x, pivot.y + 75e-4, pivot.z]), 0.05), FIXED7]);
      metal.push([withTone(plain(new THREE37.CylinderGeometry(0.014, 0.014, 0.04, 6)).translate(pivot.x, pivot.y - 0.02, pivot.z), 0.2), part]);
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
    const { L: L2, D, shelves } = S;
    const CL = 0.18, CW = 0.1, CT = 0.024;
    const body = (size, at, tone) => metal.push([withTone(buildBlock(size, at), tone), FIXED7]);
    const slice = (quad, color) => glow.push(withShade(buildQuads([quad]), color, 4));
    const topY = shelves[shelves.length - 1];
    for (const sz of [-1, 1]) {
      let x = -L2 / 2 + 0.06;
      const end = -L2 / 2 + 0.06 + (L2 - 0.12) * (fill === 1 ? rng.range(0.85, 1) : rng.range(0.35, 0.6));
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
          const xc = -L2 / 2 + (s + 0.5) * L2 / slots + rng.range(-0.02, 0.02);
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
    const { L: L2, D, shelves } = S;
    const top = shelves[1], low = shelves[0];
    const add = (g, tone) => metal.push([withTone(g, tone), FIXED7]);
    const coil = (x, y, z, R2) => {
      const g = plain(new THREE37.TorusGeometry(R2, 0.024, 4, 12)).rotateX(Math.PI / 2).translate(x, y + 0.024, z);
      add(g, (xx, yy) => -0.62 + (yy > y + 0.03 ? 0.12 : 0));
      add(buildBlock([0.05, 0.03, 0.03], [x + R2 * 0.7, y + 0.06, z + R2 * 0.7]), 0.3);
    };
    const probe = (x, y, z, len, yaw) => {
      const dir = new THREE37.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
      const a = new THREE37.Vector3(x, y + 0.02, z).addScaledVector(dir, -len / 2);
      const b = new THREE37.Vector3(x, y + 0.02, z).addScaledVector(dir, len / 2);
      add(beam(a, b, PX * 0.42, PX * 0.42), 0.35);
      const grip = a.clone().addScaledVector(dir, 0.12);
      add(beam(a, grip, PX * 0.75, PX * 0.75), -0.55);
      const tip = plain(new THREE37.ConeGeometry(0.018, 0.06, 6));
      tip.rotateZ(-Math.PI / 2).rotateY(-yaw).translate(b.x + dir.x * 0.03, b.y, b.z + dir.z * 0.03);
      add(tip, 0.55);
    };
    const bx = rng.range(-0.3, -0.15) * L2, bz = rng.range(-0.08, 0.04);
    add(buildBlock([0.26, 0.17, 0.2], [bx, top + 0.085, bz]), (x, y) => y > top + 0.165 ? -0.15 : -0.35);
    const d = dial({ radius: 0.05, position: [bx - 0.04, top + 0.09, bz + 0.1], normal: [0, 0, 1], ticks: 8, needle: rng.range(-1.2, 1.2) });
    add(d.face, 0.45);
    add(d.marks, -0.7);
    glow.push(withShade(plain(new THREE37.SphereGeometry(0.014, 6, 4)).translate(bx + 0.08, top + 0.12, bz + 0.1), 0, 1));
    const probes = fill === 1 ? rng.int(2, 3) : 1;
    for (let i = 0; i < probes; i++) probe(rng.range(0.05, 0.3) * L2, top, -D / 4 + i * 0.12 + rng.range(-0.02, 0.02), rng.range(0.42, 0.55), rng.range(-0.15, 0.15));
    if (fill === 1) coil(rng.range(0.15, 0.3) * L2, top, D / 4, 0.09);
    const coils = fill === 1 ? rng.int(2, 3) : 1;
    const cx = rng.range(-0.25, -0.1) * L2;
    for (let i = 0; i < coils; i++) coil(cx + rng.range(-0.02, 0.02), low + i * 0.05, rng.range(-0.03, 0.03), 0.11 - i * 0.012);
    if (fill === 1) add(buildBlock([0.5, 0.08, 0.14], [rng.range(0.1, 0.2) * L2, low + 0.04, rng.range(-0.1, 0.1)], [0, rng.range(-0.2, 0.2), 0]), (x, y) => y > low + 0.07 ? -0.1 : -0.3);
  }
  function buildHeavy() {
    const { L: L2, D, r } = S;
    const deck = S.shelves[0];
    const w = 0.08;
    const axleX = L2 / 2 - 0.32;
    for (const sz of [-1, 1]) metal.push([withTone(buildBlock([L2 - 0.1, 0.1, 0.08], [0, deck - 0.11, sz * (D / 2 - 0.14)]), -0.05), FIXED7]);
    for (const x of [-L2 / 2 + 0.1, 0, L2 / 2 - 0.1]) metal.push([withTone(buildBlock([0.08, 0.06, D - 0.2], [x, deck - 0.09, 0]), -0.15), FIXED7]);
    for (const sx of [-1, 1]) {
      metal.push([withTone(beam([sx * axleX, r, -D / 2 - 0.02], [sx * axleX, r, D / 2 + 0.02], 0.04, 0.04), -0.2), FIXED7]);
      for (const sz of [-1, 1]) metal.push([withTone(buildBlock([0.1, deck - 0.16 - r + 0.02, 0.05], [sx * axleX, (deck - 0.16 + r) / 2, sz * (D / 2 - 0.14)]), -0.1), FIXED7]);
    }
    const planks = 6;
    const pw = D / planks;
    const wear = rng.range(-0.05, 0.05);
    for (let i = 0; i < planks; i++) {
      const z = -D / 2 + (i + 0.5) * pw;
      const len = L2 - (rng.chance(0.3) ? rng.range(0.02, 0.06) : 0);
      const t = (i % 2 ? 0.12 : -0.08) + rng.range(-0.05, 0.05) + wear;
      wood.push([withTone(buildBlock([len, 0.06, pw - 6e-3], [rng.range(-0.01, 0.01), deck - 0.03, z]), (x, y, zz, nx, ny) => t + (ny > 0.5 ? 0 : -0.15)), FIXED7]);
    }
    const joints = [];
    for (let i = 1; i < planks; i++) joints.push({ position: [0, deck + 15e-4, -D / 2 + i * pw], size: [L2 - 0.04, PX * 0.3], normal: [0, 1, 0], tone: -0.8 });
    wood.push([buildQuads(joints), FIXED7]);
    for (const x of [-L2 / 2 + 0.16, L2 / 2 - 0.16]) {
      metal.push([withTone(buildBlock([0.06, 0.012, D + 0.02], [x, deck + 6e-3, 0]), 0.15), FIXED7]);
      for (let i = 0; i < planks; i++) metal.push([withTone(buildBlock([PX * 0.45, 8e-3, PX * 0.45], [x, deck + 0.016, -D / 2 + (i + 0.5) * pw]), 0.45), FIXED7]);
    }
    let part = 0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addWheel(new THREE37.Vector3(sx * axleX, r, sz * (D / 2 + 0.07)), r, w, part++, 6);
    const pivot = new THREE37.Vector3(L2 / 2 - 0.02, r + 0.12, 0);
    const length = 1;
    for (const sz of [-1, 1]) {
      metal.push([withTone(beam([pivot.x, pivot.y, sz * 0.22], [pivot.x + length - 0.12, pivot.y, sz * 0.03], 0.04, 0.035), sz < 0 ? 0.05 : -0.05), DRAWBAR]);
      metal.push([withTone(plain(new THREE37.CylinderGeometry(0.03, 0.03, 0.06, 8)).rotateX(Math.PI / 2).translate(pivot.x, pivot.y, sz * 0.22), 0.2), DRAWBAR]);
    }
    metal.push([withTone(beam([pivot.x + length - 0.14, pivot.y, 0], [pivot.x + length - 0.06, pivot.y, 0], 0.05, 0.04), 0), DRAWBAR]);
    const loop = buildLathe([[0.045, -0.012], [0.07, -0.012], [0.07, 0.012], [0.045, 0.012]], { segments: 10, facets: true });
    metal.push([withTone(loop.translate(pivot.x + length, pivot.y, 0), 0.25), DRAWBAR]);
    heavyPivot.copy(pivot);
    heavyTip.set(pivot.x + length, pivot.y, 0);
    if (!fill) return;
    const ix = rng.range(0.1, 0.35), iz = rng.range(-0.15, 0.15);
    const ingot = (x, y, z, yaw) => metal.push([withTone(buildBlock([0.3, 0.07, 0.11], [x, y + 0.035, z], [0, yaw, 0], { taper: 0.2 }), (xx, yy, zz, nx, ny) => ny > 0.5 ? 0.25 : 0.05), FIXED7]);
    const layers = fill === 1 ? 3 : 2;
    for (let l = 0; l < layers; l++) {
      const n = 3 - l;
      for (let i = 0; i < n; i++) ingot(ix + rng.range(-0.01, 0.01), deck + l * 0.07, iz + (i - (n - 1) / 2) * 0.13, (l % 2 ? Math.PI / 2 : 0) + rng.range(-0.06, 0.06));
    }
    const gx = rng.range(0.5, 0.62), gz = rng.range(-0.18, 0.18);
    const blank = plain(new THREE37.CylinderGeometry(0.2, 0.2, 0.06, 14));
    metal.push([withTone(blank.translate(gx, deck + 0.03, gz), (x, y, z) => y > deck + 0.05 ? Math.hypot(x - gx, z - gz) < 0.06 ? 0.4 : 0.15 : -0.1), FIXED7]);
    if (fill === 1) {
      const cx = rng.range(-0.55, -0.35), cz = rng.range(-0.08, 0.08), yaw = rng.range(-0.15, 0.15);
      const size = [0.6, 0.45, 0.48];
      wood.push([withTone(buildBlock(size, [cx, deck + size[1] / 2, cz], [0, yaw, 0]), (x, y, z, nx, ny) => ny > 0.5 ? 0.15 : 0.02), FIXED7]);
      for (const t of [-0.18, 0.18]) {
        const band = buildBlock([0.045, size[1] + 0.012, size[2] + 0.012], [t, 0, 0]);
        band.rotateY(yaw).translate(cx, deck + size[1] / 2, cz);
        metal.push([withTone(band, 0.1), FIXED7]);
      }
    }
  }
  const group = new THREE37.Group();
  group.name = meta31.name;
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE37.Mesh(metalMerged.geometry, metalMaterial(heavy ? METALS.castIron : METALS.patinatedBronze, { id: 30, tone: true }));
  metalMesh.name = "frame";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  group.add(metalMesh);
  const rigs = [createRigidParts(metalMerged.geometry, metalMerged.partOf, 7)];
  if (wood.length) {
    const woodMerged = mergeParts(wood);
    const woodMesh = new THREE37.Mesh(woodMerged.geometry, createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.28, 0.5, 0.76], tone: true, crease: true, id: 31 }));
    woodMesh.name = "planks";
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;
    group.add(woodMesh);
    rigs.push(createRigidParts(woodMerged.geometry, woodMerged.partOf, 7));
  }
  if (glow.length) {
    const colors = p.model === "cassettes" ? COLORS2.map((c) => [DATA_GLOWS[c], 2]) : [["amber", 2]];
    const glowMesh = new THREE37.Mesh(mergeParts(glow.map((g) => [g, FIXED7])).geometry, glowMixMaterial(colors, { id: 40 }));
    glowMesh.name = "lights";
    group.add(glowMesh);
  }
  const swivel = [rng.range(-Math.PI, Math.PI), rng.range(-Math.PI, Math.PI)];
  const tmp = new THREE37.Matrix4();
  const turnAbout = (m, point, rotation) => m.multiply(tmp.makeTranslation(point.x, point.y, point.z)).multiply(rotation).multiply(tmp.makeTranslation(-point.x, -point.y, -point.z));
  const rot = new THREE37.Matrix4();
  const cart = {
    distance: 0,
    drawbar: 0,
    handle: heavy ? new THREE37.Vector3() : new THREE37.Vector3(-S.L / 2 - 0.07, S.handle, 0),
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
    if (heavy) cart.handle.copy(heavyTip).sub(heavyPivot).applyAxisAngle(new THREE37.Vector3(0, 0, 1), cart.drawbar).add(heavyPivot);
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
  group.userData.asset = { id: meta31.id, params: p };
  return group;
}

// src/assets/props/machines/crank-recorder.js
var crank_recorder_exports = {};
__export(crank_recorder_exports, {
  create: () => create32,
  dispose: () => disposeObject,
  meta: () => meta32,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE38 from "three";
var KINDS6 = {
  viewer: "Visionneuse (fen\xEAtre ambre, oculaires)",
  drum: "Enregistreur \xE0 tambour (papier enfum\xE9)",
  cylinder: "Enregistreur \xE0 cylindre (cire, pavillon)"
};
var STATES10 = { idle: "\xC0 l'arr\xEAt", running: "En marche" };
var PAPER = { ramp: ["#2c2d36", "#8a8c96", "#b8b8bc", "#e2e0d8"], ink: "#24252c" };
var WAX = { ramp: ["#4e3020", "#86562f", "#b88447", "#e0b778"], ink: "#2a180f" };
var FIXED8 = 255;
var TURN = Math.PI * 2 / 1.6;
var params32 = {
  seed: seedParam("Change la trace du tambour, les traits de la bande, l'orientation du pavillon, la place du stylet, la manivelle \xE0 l'arr\xEAt, les tons du bois."),
  kind: choiceParam("Appareil", KINDS6, "Visionneuse des Archives, enregistreur \xE0 tambour du kit d'\xE9tude, ou enregistreur \xE0 cylindre de la salle 4."),
  state: choiceParam("\xC9tat", STATES10, "\xC0 l'arr\xEAt, ou en marche : la manivelle tourne, le tambour ou le cylindre aussi, la bande d\xE9file.")
};
var meta32 = {
  id: "props/machines/crank-recorder",
  name: "Appareil \xE0 manivelle",
  nameEn: "Crank recorder",
  category: "props",
  subcategory: "machines",
  description: "Petit appareil \xE0 manivelle du Complexe, \xE0 poser sur une table : visionneuse de bois et de bronze \xE0 deux oculaires, dont la fen\xEAtre ambre fait d\xE9filer une bande ; enregistreur \xE0 tambour de papier enfum\xE9 o\xF9 un stylet trace une ligne sombre ; enregistreur \xE0 cylindre de cire sous un pavillon de laiton. En marche, la manivelle et le m\xE9canisme tournent. Fiches ARC-11, ETU-05, E4-06.",
  tags: [
    "visionneuse",
    "enregistreur",
    "manivelle",
    "tambour",
    "cylindre",
    "cire",
    "papier enfum\xE9",
    "stylet",
    "pavillon",
    "oculaires",
    "bande",
    "bobines",
    "bois noirci",
    "bronze",
    "laiton",
    "le complexe",
    "complexe",
    "ancien-tech",
    "instrument",
    "anim\xE9",
    "pilotable",
    "int\xE9rieur",
    "viewer",
    "recorder",
    "crank",
    "drum",
    "wax cylinder",
    "smoked paper",
    "stylus",
    "horn",
    "eyepieces",
    "film strip",
    "reels",
    "blackened wood",
    "brass",
    "ancient complex",
    "ancient-tech",
    "device",
    "animated",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine au centre du dessous (\xE0 poser sur un plateau) ; face avant vers +z, manivelle c\xF4t\xE9 +x",
  footprint: { radius: 0.42, height: 0.6 },
  animated: ["crank"],
  params: params32,
  variants: [
    { id: "viewer", name: "Visionneuse", params: {} },
    { id: "drum", name: "Tambour", params: { kind: "drum" } },
    { id: "cylinder", name: "Cylindre", params: { kind: "cylinder" } }
  ]
};
function create32(given = {}) {
  const p = resolveParams(meta32.params, given);
  const rng = createRng(p.seed * 7919 + 503);
  const metal = [], body = [], wax = [], glow = [];
  const rotor = new THREE38.Vector3();
  const crank = new THREE38.Vector3();
  const reels = [];
  const stripes = [];
  let strip = null;
  const addCrank = (at, arm = 0.15, part = 7) => {
    crank.copy(at);
    const hub = plain(new THREE38.CylinderGeometry(0.026, 0.026, 0.03, 8)).rotateZ(Math.PI / 2).translate(at.x + 0.015, at.y, at.z);
    metal.push([withTone(hub, 0.2), part]);
    metal.push([withTone(beam([at.x + 0.032, at.y, at.z], [at.x + 0.032, at.y - arm, at.z], 0.02, 0.018), 0.05), part]);
    const knob = plain(new THREE38.CylinderGeometry(0.016, 0.018, 0.06, 6)).rotateZ(Math.PI / 2).translate(at.x + 0.07, at.y - arm, at.z);
    metal.push([withTone(knob, -0.55), part]);
  };
  if (p.kind === "viewer") {
    metal.push([withTone(buildBlock([0.5, 0.04, 0.4], [0, 0.02, 0]), (x, y, z, nx, ny) => ny > 0.5 ? 0.05 : -0.15), FIXED8]);
    const woodTone = rng.range(-0.06, 0.08);
    body.push([withTone(buildBlock([0.4, 0.34, 0.3], [0, 0.21, 0]), (x, y, z, nx, ny) => woodTone + (ny > 0.5 ? 0.1 : 0) + (Math.abs(x) < 0.12 && nx === 0 && ny === 0 ? 0 : -0.05)), FIXED8]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      metal.push([withTone(buildBlock([0.035, 0.345, 0.035], [sx * 0.19, 0.21, sz * 0.14]), 0.05), FIXED8]);
    }
    metal.push([withTone(buildBlock([0.41, 0.025, 0.31], [0, 0.39, 0]), 0.1), FIXED8]);
    body.push([withTone(buildBlock([0.3, 0.07, 0.19], [0, 0.437, 0.02]), woodTone + 0.05), FIXED8]);
    const eyeDir = new THREE38.Vector3(0, 0.55, 0.83).normalize();
    for (const s of [-1, 1]) {
      const base = new THREE38.Vector3(s * 0.055, 0.46, 0.085);
      const tip = base.clone().addScaledVector(eyeDir, 0.09);
      metal.push([withTone(beam(base, tip, 0.05, 0.05), 0.15), FIXED8]);
      const cup = plain(new THREE38.CylinderGeometry(0.028, 0.028, 0.02, 8));
      cup.applyQuaternion(new THREE38.Quaternion().setFromUnitVectors(new THREE38.Vector3(0, 1, 0), eyeDir)).translate(tip.x, tip.y, tip.z);
      metal.push([withTone(cup, (x, y, z, nx, ny, nz) => nx * eyeDir.x + ny * eyeDir.y + nz * eyeDir.z > 0.7 ? -0.95 : -0.2), FIXED8]);
    }
    [-1, 1].forEach((s, k) => {
      const c = new THREE38.Vector3(s * 0.1, 0.5, -0.1);
      reels.push(c);
      const disc = plain(new THREE38.CylinderGeometry(0.075, 0.075, 0.025, 12)).rotateX(Math.PI / 2).translate(c.x, c.y, c.z);
      metal.push([withTone(disc, (x, y, z, nx, ny, nz) => Math.abs(nz) > 0.5 ? -0.05 : 0.1), 5 + k]);
      const holes = [];
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2 + k;
        holes.push({ position: [c.x + Math.cos(a) * 0.042, c.y + Math.sin(a) * 0.042, c.z + 0.0135], size: [PX * 0.55, PX * 0.55], normal: [0, 0, 1], tone: -0.9 });
      }
      metal.push([buildQuads(holes), 5 + k]);
      metal.push([withTone(beam([c.x, 0.39, c.z], [c.x, c.y - 0.03, c.z], 0.02, 0.02), -0.1), FIXED8]);
    });
    const wy = 0.255, ww = 0.22, wh = 0.09, wz = 0.15;
    glow.push(buildQuads([{ position: [0, wy, wz + 2e-3], size: [ww, wh], normal: [0, 0, 1] }]));
    for (const [w, h, x, y] of [[ww + 0.04, 0.02, 0, wy + wh / 2 + 0.01], [ww + 0.04, 0.02, 0, wy - wh / 2 - 0.01], [0.02, wh, ww / 2 + 0.01, wy], [0.02, wh, -ww / 2 - 0.01, wy]]) {
      metal.push([withTone(buildBlock([w, h, 0.012], [x, y, wz + 6e-3]), 0.25), FIXED8]);
    }
    strip = { width: ww, y: wy, z: wz };
    for (let i = 0; i < 4; i++) {
      const offset = (i + rng.range(-0.2, 0.2)) / 4;
      stripes.push(offset);
      metal.push([withTone(buildBlock([PX * (rng.chance(0.4) ? 0.7 : 0.35), wh - 0.012, 4e-3], [0, wy, wz + 5e-3]), -0.95), 1 + i]);
    }
    metal.push([withTone(buildBlock([0.12, 0.035, 8e-3], [0, 0.14, wz + 4e-3]), 0.2), FIXED8]);
    addCrank(new THREE38.Vector3(0.2, 0.26, 0.02), 0.13);
  } else if (p.kind === "drum") {
    metal.push([withTone(buildBlock([0.6, 0.04, 0.36], [0, 0.03, 0]), (x, y, z, nx, ny) => ny > 0.5 ? 0 : -0.15), FIXED8]);
    for (const sx2 of [-1, 1]) for (const sz of [-1, 1]) metal.push([withTone(buildBlock([0.06, 0.012, 0.06], [sx2 * 0.26, 6e-3, sz * 0.14]), -0.3), FIXED8]);
    const ay = 0.28, R2 = 0.1, half = 0.15;
    rotor.set(0, ay, 0);
    for (const sx2 of [-1, 1]) {
      metal.push([withTone(buildBlock([0.03, ay - 0.05 + 0.03, 0.07], [sx2 * 0.2, (ay + 0.05) / 2 + 0.01, 0], [0, 0, 0], { taper: 0.3 }), -0.05), FIXED8]);
      metal.push([withTone(plain(new THREE38.CylinderGeometry(0.03, 0.03, 0.04, 8)).rotateZ(Math.PI / 2).translate(sx2 * 0.2, ay, 0), 0.15), FIXED8]);
    }
    const drum = plain(new THREE38.CylinderGeometry(R2, R2, 2 * half, 20, 1, true)).rotateZ(Math.PI / 2).translate(0, ay, 0);
    body.push([withTone(drum, 0.1), 0]);
    for (const sx2 of [-1, 1]) {
      const cheek = plain(new THREE38.CylinderGeometry(R2 + 8e-3, R2 + 8e-3, 0.016, 20)).rotateZ(Math.PI / 2).translate(sx2 * (half + 8e-3), ay, 0);
      metal.push([withTone(cheek, (x, y, z, nx) => Math.abs(nx) > 0.5 ? 0.12 : 0.2), 0]);
    }
    metal.push([withTone(beam([-0.24, ay, 0], [0.22, ay, 0], 0.018, 0.018, Math.PI / 4), 0.1), 0]);
    const turns = 1.6, steps = 90;
    const f1 = rng.int(5, 11), f2 = rng.int(13, 23), ph = rng.range(0, 6);
    const spikes = Array.from({ length: rng.int(2, 5) }, () => [rng.range(0, turns * Math.PI * 2), rng.range(0.03, 0.05) * (rng.chance(0.5) ? 1 : -1)]);
    const at = (t) => {
      const a = t * turns * Math.PI * 2;
      let w = 0.018 * Math.sin(a * f1 / turns + ph) + 0.01 * Math.sin(a * f2 / turns);
      for (const [sa, h] of spikes) w += h * Math.max(0, 1 - Math.abs(a - sa) / 0.12);
      const x = -half + 0.03 + t * (2 * half - 0.06) + w;
      return new THREE38.Vector3(x, ay + Math.cos(a) * (R2 + 2e-3), Math.sin(a) * (R2 + 2e-3));
    };
    const pts = [], nrm = [];
    for (let i = 0; i <= steps; i++) {
      const q = at(i / steps);
      pts.push(q);
      nrm.push(new THREE38.Vector3(0, q.y - ay, q.z).normalize());
    }
    body.push([withTone(buildRibbon(pts, nrm, 0.03), -1.2), 0]);
    const sx = rng.range(-0.08, 0.08);
    const pivot = new THREE38.Vector3(sx, ay + R2 + 0.07, -0.17);
    metal.push([withTone(beam([sx, 0.05, -0.17], [sx, pivot.y + 0.02, -0.17], 0.03, 0.03), 0), FIXED8]);
    const tipPoint = new THREE38.Vector3(sx, ay + R2 + 8e-3, 0.012);
    metal.push([withTone(beam(pivot, tipPoint.clone().add(new THREE38.Vector3(0, 0.012, -0.01)), 0.014, 0.012), 0.3), FIXED8]);
    metal.push([withTone(beam(tipPoint.clone().add(new THREE38.Vector3(0, 0.02, -0.012)), tipPoint, PX * 0.3, PX * 0.3), 0.5), FIXED8]);
    metal.push([withTone(beam(pivot, [sx, pivot.y + 0.02, -0.26], 0.014, 0.012), 0.2), FIXED8]);
    metal.push([withTone(plain(new THREE38.CylinderGeometry(0.03, 0.03, 0.06, 8)).rotateX(Math.PI / 2).translate(sx, pivot.y + 0.025, -0.27), -0.6), FIXED8]);
    addCrank(new THREE38.Vector3(0.235, ay, 0), 0.15);
  } else {
    const woodTone = rng.range(-0.06, 0.08);
    body.push([withTone(buildBlock([0.45, 0.11, 0.3], [0, 0.055, 0]), (x, y, z, nx, ny) => woodTone + (ny > 0.5 ? 0.12 : 0)), FIXED8]);
    metal.push([withTone(buildBlock([0.46, 0.02, 0.31], [0, 0.01, 0]), -0.25), FIXED8]);
    const ay = 0.2, R2 = 0.06, half = 0.1;
    rotor.set(0, ay, 0.02);
    for (const sx of [-1, 1]) {
      metal.push([withTone(buildBlock([0.025, ay - 0.11 + 0.02, 0.05], [sx * 0.15, (ay + 0.11) / 2 + 0.01, rotor.z]), 0), FIXED8]);
    }
    metal.push([withTone(beam([-0.16, ay, rotor.z], [0.16, ay, rotor.z], 0.016, 0.016, Math.PI / 4), 0.15), 0]);
    const cylinder = plain(new THREE38.CylinderGeometry(R2, R2, 2 * half, 14, 12)).rotateZ(Math.PI / 2).translate(0, ay, rotor.z);
    wax.push([withTone(cylinder, (x, y, z, nx) => Math.abs(nx) > 0.5 ? -0.15 : Math.abs((x + half) / 0.033 % 1 - 0.5) < 0.17 ? -0.3 : 0.05), 0]);
    wax.push([buildQuads([{ position: [-half + 0.04, ay + R2 + 2e-3, rotor.z], size: [0.05, PX * 0.6], normal: [0, 1, 0], tone: 0.5 }]), 0]);
    const hx = rng.range(-0.05, 0.05);
    const head = new THREE38.Vector3(hx, ay + R2 + 0.025, rotor.z);
    metal.push([withTone(beam([hx, 0.11, -0.12], [hx, head.y + 0.01, -0.12], 0.025, 0.025), 0), FIXED8]);
    metal.push([withTone(beam([hx, head.y + 0.01, -0.12], [hx, head.y + 0.01, head.z - 0.02], 0.02, 0.018), 0.1), FIXED8]);
    metal.push([withTone(plain(new THREE38.CylinderGeometry(0.035, 0.035, 0.022, 10)).translate(head.x, head.y, head.z), 0.2), FIXED8]);
    const horn = buildLathe([[0.012, 0], [0.018, 0.08], [0.03, 0.15], [0.06, 0.21], [0.095, 0.24], [0.088, 0.245], [0.052, 0.215], [0.022, 0.15], [6e-3, 0.08], [4e-3, 0]], { segments: 12, facets: true });
    horn.applyMatrix4(new THREE38.Matrix4().makeRotationX(-0.75).premultiply(new THREE38.Matrix4().makeRotationY(rng.range(-0.6, 0.6))));
    horn.translate(head.x, head.y + 0.01, head.z);
    metal.push([withTone(horn, (x, y, z, nx, ny) => ny < -0.2 ? -0.5 : 0.1), FIXED8]);
    addCrank(new THREE38.Vector3(0.225, 0.06, 0.02), 0.11);
  }
  const group = new THREE38.Group();
  group.name = meta32.name;
  const metalMerged = mergeParts(metal);
  const metalEntry = p.kind === "cylinder" ? METALS.blackenedBrass : METALS.patinatedBronze;
  const metalMesh = new THREE38.Mesh(metalMerged.geometry, metalMaterial(metalEntry, { id: 30, tone: true }));
  metalMesh.name = "metal";
  const rigs = [createRigidParts(metalMerged.geometry, metalMerged.partOf, 8)];
  const meshes = [metalMesh];
  const bodyMerged = mergeParts(body);
  const bodyMaterial = p.kind === "drum" ? createToonMaterial({ ramp: PAPER.ramp, ink: PAPER.ink, steps: [0.3, 0.52, 0.78], tone: true, id: 31 }) : createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.28, 0.5, 0.76], tone: true, crease: true, id: 31 });
  const bodyMesh = new THREE38.Mesh(bodyMerged.geometry, bodyMaterial);
  bodyMesh.name = p.kind === "drum" ? "paper" : "wood";
  meshes.push(bodyMesh);
  rigs.push(createRigidParts(bodyMerged.geometry, bodyMerged.partOf, 8));
  if (wax.length) {
    const waxMerged = mergeParts(wax);
    const waxMesh = new THREE38.Mesh(waxMerged.geometry, createToonMaterial({ ramp: WAX.ramp, ink: WAX.ink, steps: [0.28, 0.5, 0.78], tone: true, id: 32 }));
    waxMesh.name = "wax";
    meshes.push(waxMesh);
    rigs.push(createRigidParts(waxMerged.geometry, waxMerged.partOf, 8));
  }
  let glowGeometry = null;
  if (glow.length) {
    glowGeometry = mergeParts(glow.map((g) => [withShade(g, 1, 4), FIXED8])).geometry;
    const glowMesh = new THREE38.Mesh(glowGeometry, glowMixMaterial(glowLevels("amber"), { id: 40 }));
    glowMesh.name = "window";
    meshes.push(glowMesh);
  }
  for (const mesh of meshes) {
    if (mesh.name !== "window") {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    group.add(mesh);
  }
  const tmp = new THREE38.Matrix4();
  const turnAbout = (m, point, rotation) => m.identity().multiply(tmp.makeTranslation(point.x, point.y, point.z)).multiply(rotation).multiply(tmp.makeTranslation(-point.x, -point.y, -point.z));
  const rot = new THREE38.Matrix4();
  const recorder = {
    running: p.state === "running",
    angle: rng.range(0, Math.PI * 2),
    setRunning(on) {
      recorder.running = !!on;
      setWindow();
    }
  };
  function pose() {
    const a = recorder.angle;
    for (const rig of rigs) {
      turnAbout(rig.matrices[7], crank, rot.makeRotationX(-a));
      turnAbout(rig.matrices[0], rotor, rot.makeRotationX(-a * (p.kind === "cylinder" ? 2 : 1)));
      stripes.forEach((o, i) => {
        const u = ((o + a / (Math.PI * 2) * 0.8) % 1 + 1) % 1;
        rig.matrices[1 + i].makeTranslation(-strip.width / 2 + 0.01 + u * (strip.width - 0.02), 0, 0);
      });
      reels.forEach((c, k) => turnAbout(rig.matrices[5 + k], c, rot.makeRotationZ((k ? -1 : 1) * a * 0.7)));
      rig.apply();
    }
  }
  let shown = -1;
  const setLevel = (level) => {
    if (!glowGeometry || level === shown) return;
    shown = level;
    const shade = glowGeometry.attributes.aShade;
    shade.array.fill((level + 0.5) / 4);
    shade.needsUpdate = true;
  };
  const setWindow = () => setLevel(2);
  setWindow();
  pose();
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let last = -1;
  group.updateMatrixWorld = (force) => {
    const time = Math.floor(sharedUniforms.uTime.value * 12) / 12;
    if (time !== last) {
      if (last >= 0 && recorder.running) {
        recorder.angle += Math.min(0.25, time - last) * TURN;
        pose();
        if (glowGeometry) {
          setLevel(Math.floor(time * 6) % 7 === 0 ? 3 : 2);
        }
      }
      last = time;
    }
    baseUpdate(force);
  };
  group.userData.recorder = recorder;
  group.userData.asset = { id: meta32.id, params: p };
  return group;
}

// src/assets/props/tools/arm-magnifier.js
var arm_magnifier_exports = {};
__export(arm_magnifier_exports, {
  create: () => create33,
  dispose: () => disposeObject,
  meta: () => meta33,
  setWind: () => setWind,
  tick: () => tick
});
import * as THREE39 from "three";
var KINDS7 = {
  reading: "Lecture (\xD8 0,20 m, bras de 0,6 m)",
  binocular: "Binoculaire (horloger, bras de 0,4 m)",
  observation: "Observation (\xD8 0,15 m, bras court)"
};
var MOUNTS4 = { desk: "Pos\xE9e sur un socle lest\xE9", clamp: "Serr\xE9e par un \xE9tau (bord de table)" };
var SIZES9 = {
  reading: { post: 0.3, boom: 0.6, lens: 0.1, back: 0.2 },
  binocular: { post: 0.24, boom: 0.4, lens: 0.042, back: 0.14 },
  observation: { post: 0.22, boom: 0.35, lens: 0.075, back: 0.13 }
};
var FIXED9 = 255;
var params33 = {
  seed: seedParam("Change l'orientation et la plong\xE9e du bras, l'inclinaison de la lentille, le jaunissement du verre, la patine de la monture."),
  kind: choiceParam("Mod\xE8le", KINDS7, "Loupe de lecture des Archives, loupe binoculaire de l'\xE9tabli d'horloger, ou loupe de la table d'observation."),
  mount: choiceParam("Pose", MOUNTS4, "Sur un socle lest\xE9, ou serr\xE9e par un \xE9tau au bord d'une table (origine au ras du plateau, le plateau du c\xF4t\xE9 z < 0).")
};
var meta33 = {
  id: "props/tools/arm-magnifier",
  name: "Loupe sur bras",
  nameEn: "Arm magnifier",
  category: "props",
  subcategory: "tools",
  description: "Loupe du Complexe mont\xE9e sur un bras de laiton \xE0 contrepoids : lentille de verre clair jauni \xE0 reflet d'un pixel, dans une monture de laiton. Loupe de lecture des Archives, loupe binoculaire de l'horloger (deux lentilles, deux oculaires), ou loupe de table d'observation ; sur socle ou \xE0 l'\xE9tau ; le bras se r\xE8gle \xE0 la demande. Fiches ARC-07, ATE-14, ETU-10.",
  tags: [
    "loupe",
    "lentille",
    "verre",
    "bras",
    "contrepoids",
    "laiton",
    "binoculaire",
    "oculaires",
    "\xE9tau",
    "lecture",
    "observation",
    "horloger",
    "le complexe",
    "complexe",
    "ancien-tech",
    "outil",
    "pilotable",
    "int\xE9rieur",
    "magnifier",
    "magnifying glass",
    "lens",
    "glass",
    "arm",
    "counterweight",
    "brass",
    "binocular",
    "eyepieces",
    "clamp",
    "reading",
    "inspection",
    "watchmaker",
    "ancient complex",
    "ancient-tech",
    "tool",
    "scriptable",
    "indoor",
    "procedural"
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unit\xE9 = 1 m\xE8tre ; origine sous le socle (sur le plateau), ou au ras du bord de la table pour l'\xE9tau (le plateau est en y = 0, c\xF4t\xE9 z < 0) ; le bras part vers +z avant la rotation de la graine",
  footprint: { radius: 0.8, height: 0.5 },
  animated: ["arm"],
  params: params33,
  variants: [
    { id: "reading", name: "Lecture, sur socle", params: {} },
    { id: "binocular", name: "Binoculaire, \xE0 l'\xE9tau", params: { kind: "binocular", mount: "clamp" } },
    { id: "observation", name: "Observation, \xE0 l'\xE9tau", params: { kind: "observation", mount: "clamp" } }
  ]
};
function create33(given = {}) {
  const p = resolveParams(meta33.params, given);
  const rng = createRng(p.seed * 7919 + 307);
  const S = SIZES9[p.kind];
  const metal = [], glass = [];
  const rod = PX * 0.55;
  let p0y;
  if (p.mount === "clamp") {
    metal.push([withTone(buildBlock([0.07, 0.04, 0.1], [0, 0.02, -0.04]), 0.05), FIXED9]);
    metal.push([withTone(buildBlock([0.07, 0.17, 0.04], [0, -0.045, 0.02]), -0.1), FIXED9]);
    metal.push([withTone(buildBlock([0.07, 0.03, 0.08], [0, -0.115, -0.02]), -0.05), FIXED9]);
    metal.push([withTone(beam([0, -0.17, -0.04], [0, -0.1, -0.04], PX * 0.5, PX * 0.5), 0.3), FIXED9]);
    metal.push([withTone(beam([-0.04, -0.17, -0.04], [0.04, -0.17, -0.04], PX * 0.5, PX * 0.5), 0.2), FIXED9]);
    p0y = 0.04;
  } else {
    const r = p.kind === "reading" ? 0.11 : 0.085;
    metal.push([withTone(buildLathe([[0, 0], [r, 0], [r, 0.03], [r * 0.7, 0.05], [0, 0.05]], { segments: 10, facets: true }), (x, y, z, nx, ny) => ny > 0.5 ? -0.35 : -0.55), FIXED9]);
    metal.push([withTone(plain(new THREE39.CylinderGeometry(0.03, 0.035, 0.03, 8)).translate(0, 0.06, 0), 0.15), FIXED9]);
    p0y = 0.07;
  }
  const Q = new THREE39.Vector3(0, p0y + S.post, 0);
  metal.push([withTone(beam([0, p0y - 0.01, 0], [0, Q.y - 0.02, 0], PX * 0.7, PX * 0.7), 0), FIXED9]);
  metal.push([withTone(plain(new THREE39.CylinderGeometry(0.025, 0.025, 0.02, 8)).translate(0, Q.y - 0.03, 0), 0.25), FIXED9]);
  const end = new THREE39.Vector3(0, Q.y, S.boom);
  const knuckle = plain(new THREE39.CylinderGeometry(PX * 0.75, PX * 0.75, 0.06, 8));
  knuckle.rotateZ(Math.PI / 2);
  knuckle.translate(0, Q.y, 0);
  metal.push([withTone(knuckle, 0.2), 0]);
  metal.push([withTone(beam([0, Q.y, -S.back + 0.03], [0, Q.y, S.boom - 0.02], rod, rod), 0.05), 0]);
  const weight = plain(new THREE39.CylinderGeometry(0.04, 0.04, 0.1, 8));
  weight.rotateX(Math.PI / 2);
  weight.translate(0, Q.y, -S.back);
  metal.push([withTone(weight, -0.6), 0]);
  metal.push([withTone(plain(new THREE39.CylinderGeometry(0.043, 0.043, 0.012, 8)).rotateX(Math.PI / 2).translate(0, Q.y, -S.back + 0.05), 0.1), 0]);
  const head = 1;
  const yoke = plain(new THREE39.CylinderGeometry(PX * 0.65, PX * 0.65, 0.05, 8));
  yoke.rotateZ(Math.PI / 2);
  yoke.translate(end.x, end.y, end.z);
  metal.push([withTone(yoke, 0.25), head]);
  const lensCenter = new THREE39.Vector3();
  const rim = (cx, cz, r, t, d) => {
    metal.push([withTone(buildLathe([[r, -d / 2], [r + t, -d / 2], [r + t, d / 2], [r, d / 2]], { segments: r > 0.06 ? 14 : 10, facets: true }).translate(cx, end.y, cz), (x, y) => y > end.y ? 0.25 : -0.15), head]);
  };
  const lens = (cx, cz, r) => {
    const disc = plain(new THREE39.CylinderGeometry(r, r, 0.012, r > 0.06 ? 14 : 10));
    disc.translate(cx, end.y, cz);
    glass.push([withTone(disc, (x, y, z) => -0.25 * Math.hypot(x - cx, z - cz) / r), head]);
    glass.push([buildQuads([{ position: [cx - r * 0.38, end.y + 65e-4, cz - r * 0.38], size: [PX * 0.75, PX * 0.75], normal: [0, 1, 0], tone: 0.9 }]), head]);
  };
  if (p.kind === "binocular") {
    const cz = end.z + 0.06;
    metal.push([withTone(beam([0, end.y, end.z], [0, end.y, cz - 0.02], rod, rod), 0.05), head]);
    metal.push([withTone(buildBlock([0.2, 0.025, 0.05], [0, end.y + 0.02, cz]), 0.1), head]);
    for (const s of [-1, 1]) {
      const x = s * 0.052;
      rim(x, cz, S.lens, 0.012, 0.02);
      lens(x, cz, S.lens);
      const eye = plain(new THREE39.CylinderGeometry(0.02, 0.024, 0.07, 8));
      eye.translate(x, end.y + 0.065, cz);
      metal.push([withTone(eye, (xx, y) => y > end.y + 0.09 ? 0.3 : -0.1), head]);
      metal.push([withTone(plain(new THREE39.CylinderGeometry(0.014, 0.014, 4e-3, 8)).translate(x, end.y + 0.1, cz), -0.85), head]);
    }
    lensCenter.set(0, end.y, cz);
  } else {
    const r = S.lens, t = 0.022;
    const cz = end.z + r + t + 0.03;
    metal.push([withTone(beam([0, end.y, end.z], [0, end.y, cz - r - t * 0.5], rod, rod * 0.8), 0.05), head]);
    rim(0, cz, r, t, 0.026);
    lens(0, cz, r);
    lensCenter.set(0, end.y, cz);
  }
  const group = new THREE39.Group();
  group.name = meta33.name;
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE39.Mesh(metalMerged.geometry, metalMaterial(METALS.blackenedBrass, { id: 30, tone: true }));
  metalMesh.name = "arm";
  const yellow = rng.range(-0.08, 0.1);
  const glassMerged = mergeParts(glass.map(([g, k]) => [withTone(g, yellow), k]));
  const glassMesh2 = new THREE39.Mesh(glassMerged.geometry, createToonMaterial({ ramp: GLASSES.clear.ramp, ink: GLASSES.clear.ink, steps: [0.25, 0.5, 0.8], tone: true, crease: true, id: 31 }));
  glassMesh2.name = "lens";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  glassMesh2.receiveShadow = true;
  group.add(metalMesh, glassMesh2);
  const rigs = [createRigidParts(metalMerged.geometry, metalMerged.partOf, 2), createRigidParts(glassMerged.geometry, glassMerged.partOf, 2)];
  const tmp = new THREE39.Matrix4();
  const lensInfo = { center: new THREE39.Vector3(), normal: new THREE39.Vector3() };
  const arm = {
    yaw: 0,
    pitch: 0,
    tilt: 0,
    setPose({ yaw = arm.yaw, pitch: pitch2 = arm.pitch, tilt = arm.tilt } = {}) {
      Object.assign(arm, { yaw, pitch: pitch2, tilt });
      const boom = new THREE39.Matrix4().makeTranslation(Q.x, Q.y, Q.z).multiply(tmp.makeRotationY(yaw)).multiply(tmp.makeRotationX(pitch2)).multiply(tmp.makeTranslation(-Q.x, -Q.y, -Q.z));
      const tip = boom.clone().multiply(tmp.makeTranslation(end.x, end.y, end.z)).multiply(tmp.makeRotationX(tilt)).multiply(tmp.makeTranslation(-end.x, -end.y, -end.z));
      for (const rig of rigs) {
        rig.matrices[0].copy(boom);
        rig.matrices[1].copy(tip);
        rig.apply();
      }
      lensInfo.center.copy(lensCenter).applyMatrix4(tip);
      lensInfo.normal.set(0, -1, 0).transformDirection(tip);
    }
  };
  const pitch = rng.range(0.18, 0.42);
  arm.setPose({ yaw: rng.range(-0.9, 0.9), pitch, tilt: -pitch + rng.range(-0.45, 0.15) });
  group.userData.arm = arm;
  group.userData.lens = lensInfo;
  group.userData.asset = { id: meta33.id, params: p };
  return group;
}

// src/worlds/ancient-complex-archives.js
var ARCHIVES = { name: "Archives", x0: -3, x1: 15, z0: -12, z1: 0, h: 7 };
var HALF_PI = Math.PI / 2;
var AMBER = GLOWS.amber.light;
var WALL_CUT = { rule: "wall", height: -1 };
var CORNER_CUT = { rule: "corner", height: -1 };
var COLUMN_CUT = { rule: "view", height: 1.2 };
var VIEW_HIDE = { rule: "view", height: -1 };
var MEZZANINE = { top: 3.4, width: 1.2 };
var STAIR = { x: -1.4, z: -8.75 };
var CATALOGUE = { x: 6, z: -5.4 };
var EAST_DOOR_Z = -7;
function buildArchives({ seed, state, colliders, walk, sources, counts, cutObject }) {
  const rng = createRng(seed * 7919 + 777);
  const r = ARCHIVES;
  const kit = new InteriorKit();
  const group = new THREE40.Group();
  group.name = "Archives";
  const objects = [];
  const asleep = state === "asleep";
  const addBox = (x, z, rotY, [w, d, oz = 0], top = Infinity) => {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const swap = Math.abs(s) > 0.5;
    colliders.add(x + s * oz, z + c * oz, (swap ? d : w) / 2, (swap ? w : d) / 2, null, top);
  };
  const put = (key, x, z, rotY = 0, box = null, y = 0) => {
    const index = kit.place(key, x, z, rotY, y);
    if (box) addBox(x, z, rotY, box);
    return index;
  };
  const alone = (object, x, z, rotY = 0, y = 0) => {
    object.position.set(x, y, z);
    object.rotation.y = rotY;
    group.add(object);
    objects.push(object);
    return object;
  };
  const SLAB = { castShadow: false };
  kit.model("slab", glyph_floor_slab_exports, { variant: "intact", groove: "dark", seed: seed + 101 }, SLAB);
  kit.model("slab-worn", glyph_floor_slab_exports, { variant: "worn", groove: "dark", seed: seed + 102 }, SLAB);
  kit.model("slab-stained", glyph_floor_slab_exports, { variant: "stained", groove: "dark", seed: seed + 103 }, SLAB);
  for (let x = r.x0 + 1; x < r.x1; x += 2) {
    for (let z = r.z0 + 1; z < r.z1; z += 2) {
      const roll = rng.next();
      const turn = rng.int(0, 3) * HALF_PI;
      const aisle = x === 0 && z > -6 || z === -5 && x < 6 || z === -7 && x < 2;
      const key = aisle && roll < 0.8 ? "slab-worn" : roll < 0.08 ? "slab-stained" : "slab";
      put(key, x, z, turn, null, -0.2);
      counts.slabs += 1;
    }
  }
  const wallKey = (variant) => {
    const key = `wall-${variant}`;
    kit.model(key, glyph_wall_exports, { seed: seed * 13 + 707 + variant.length, variant, height: r.h, width: 2, glyphs: "dim" }, { cut: WALL_CUT, castShadow: true });
    return key;
  };
  kit.model("lintel", glyph_wall_exports, { seed: seed * 13 + 711, variant: "plain", height: 4, width: 2, glyphs: "off" }, { cut: WALL_CUT, castShadow: true });
  const plain2 = wallKey("plain");
  kit.model("wall-south", glyph_wall_exports, { seed: seed * 13 + 707 + 5, variant: "plain", height: r.h, width: 2, glyphs: "dim" }, { cut: WALL_CUT, castShadow: true });
  const conduit = wallKey("conduit");
  for (let c = r.x0 + 1; c < r.x1; c += 2) {
    put(c === 9 ? conduit : plain2, c, r.z0, 0);
    colliders.add(c, r.z0, 1, 0.3);
    if (c === 0) put("lintel", c, r.z1 - 0.02, Math.PI, null, 3);
    else {
      put("wall-south", c, r.z1 - 0.02, Math.PI);
      colliders.add(c, r.z1, 1, 0.3);
    }
    counts.walls += 2;
  }
  for (let c = r.z0 + 1; c < r.z1; c += 2) {
    put(plain2, r.x0, c, HALF_PI);
    colliders.add(r.x0, c, 0.3, 1);
    if (c !== EAST_DOOR_Z) {
      put(plain2, r.x1, c, -HALF_PI);
      colliders.add(r.x1, c, 0.3, 1);
    }
    counts.walls += 2;
  }
  kit.model("pillar", glyph_column_exports, { seed: seed + 721, shape: "square", height: r.h, diameter: 0.9, glyphs: "dim" }, { cut: CORNER_CUT, castShadow: true });
  for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) put("pillar", x, z, 0, [0.9, 0.9]);
  const eastObject = create3({ seed: seed * 31 + 21, model: "standard", height: r.h, state: "closed", glyphs: "dim" });
  alone(eastObject, r.x1, EAST_DOOR_Z, -HALF_PI);
  cutObject(eastObject);
  const eastOpen = eastObject.userData.door.opening.width;
  for (const s of [-1, 1]) colliders.add(r.x1, EAST_DOOR_Z + s * (1 + eastOpen / 2) / 2, 0.3, (1 - eastOpen / 2) / 2);
  colliders.add(r.x1, EAST_DOOR_Z, 0.3, eastOpen / 2, () => eastObject.userData.door.blocking);
  counts.doors += 1;
  const SHELF_CUT = WALL_CUT;
  const SHELF_W = 2.65;
  kit.model("shelf-a", drawer_archive_exports, { seed: seed + 731, width: SHELF_W, drawers: "few" }, { cut: SHELF_CUT, castShadow: false });
  kit.model("shelf-b", drawer_archive_exports, { seed: seed + 732, width: SHELF_W, drawers: "closed" }, { cut: SHELF_CUT, castShadow: false });
  kit.model("shelf-south", drawer_archive_exports, { seed: seed + 733, width: SHELF_W, drawers: "few" }, { cut: SHELF_CUT, castShadow: false });
  kit.model("shelf-low", drawer_archive_exports, { seed: seed + 734, width: 2, height: 2.4, drawers: "many" }, { cut: SHELF_CUT, castShadow: false });
  const northFace = r.z0 + 0.3;
  const south = r.z1 - 0.3;
  let live = null;
  const northPitch = (r.x1 - r.x0 - 0.9) / 6;
  for (let i = 0; i < 6; i++) {
    const x = r.x0 + 0.45 + northPitch * (i + 0.5);
    if (i === 3) {
      live = alone(create28({ seed: seed + 735, width: SHELF_W, drawers: "few" }), x, northFace, 0);
      live.traverse((child) => child.castShadow = false);
      addBox(x, northFace, 0, [SHELF_W, 0.8, 0.4]);
    } else put(i % 2 ? "shelf-b" : "shelf-a", x, northFace, 0, [SHELF_W, 0.8, 0.4]);
  }
  const southXs = [];
  for (let i = 0; i < 5; i++) {
    const x = 1.15 + 1.34 + 2.68 * i;
    southXs.push(x);
    put("shelf-south", x, south, Math.PI, [SHELF_W, 0.8, 0.4]);
  }
  counts.furniture += 11;
  kit.model("ladder", rolling_ladder_exports, { seed: seed + 741, height: 5 }, { cut: SHELF_CUT, castShadow: true });
  for (const x of [southXs[2], southXs[4]]) {
    put("ladder", x, south - 0.8, Math.PI, [0.7, 0.95, 0.45]);
    counts.furniture += 1;
  }
  put("shelf-low", r.x0 + 0.3, -4.4, HALF_PI, [2, 0.8, 0.4]);
  put("shelf-low", r.x1 - 0.3, -3, -HALF_PI, [2, 0.8, 0.4]);
  counts.furniture += 2;
  const mezzLength = r.x1 - r.x0 - 0.9;
  const mezzX = (r.x0 + r.x1) / 2;
  const mezzZ = northFace + 0.8 + MEZZANINE.width / 2;
  const stairGap = [STAIR.x - mezzX - 0.55, STAIR.x - mezzX + 0.55];
  const mezz = kit.model("mezzanine", grating_walkway_exports, {
    seed: seed + 751,
    model: "mezzanine",
    shape: "straight",
    back: "wall",
    length: mezzLength,
    width: MEZZANINE.width,
    height: MEZZANINE.top,
    ends: "open",
    openings: [stairGap]
  }, { castShadow: true });
  put("mezzanine", mezzX, mezzZ, 0);
  walk.add(mezz.userData.walk, mezzX, mezzZ, 0);
  const stair = kit.model("stair", spiral_stair_exports, { seed: seed + 752, model: "stone", height: MEZZANINE.top, turn: "left" }, { castShadow: true });
  put("stair", STAIR.x, STAIR.z, Math.PI);
  walk.add(stair.userData.walk, STAIR.x, STAIR.z, Math.PI);
  counts.furniture += 2;
  kit.model("column", glyph_column_exports, { seed: seed + 761, shape: "fluted", height: r.h, diameter: 1, glyphs: "lit" }, { cut: COLUMN_CUT, castShadow: true });
  for (const z of [-8.6, -2.2]) for (const x of [1, 6, 11]) put("column", x, z, 0, [1, 1]);
  const catalogue = alone(create21({ seed: seed + 771, state: "tidy", lamp: asleep ? "off" : "lit", stem: r.h - 2.8 }), CATALOGUE.x, CATALOGUE.z, rng.range(0, Math.PI * 2));
  addBox(CATALOGUE.x, CATALOGUE.z, 0, [3.3, 1.5]);
  addBox(CATALOGUE.x, CATALOGUE.z, 0, [1.5, 3.3]);
  addBox(CATALOGUE.x, CATALOGUE.z, 0, [2.5, 2.5]);
  if (!asleep) {
    const light = catalogue.userData.lightPoint.clone().applyAxisAngle(new THREE40.Vector3(0, 1, 0), catalogue.rotation.y);
    sources.push({ position: new THREE40.Vector3(CATALOGUE.x + light.x, light.y - 0.4, CATALOGUE.z + light.z), color: AMBER, radius: 3.4, strength: 0.7, dust: 8 });
  }
  counts.furniture += 1;
  const SMALL = { castShadow: false };
  kit.model("table", stone_table_exports, { seed: seed + 781, kind: "reading" }, { castShadow: true });
  kit.model("table-lamp", articulated_lamp_exports, { seed: seed + 783, kind: "reading", mount: "desk", state: asleep ? "off" : "lit" }, SMALL);
  kit.model("stool", bronze_stool_exports, { seed: seed + 784 }, SMALL);
  kit.model("magnifier", arm_magnifier_exports, { seed: seed + 786 }, SMALL);
  kit.model("stack", data_cassette_exports, { seed: seed + 787, pose: "stack", count: 5 }, SMALL);
  kit.model("viewer", crank_recorder_exports, { seed: seed + 790, kind: "viewer" }, SMALL);
  const TOP4 = 0.85;
  const tables = [[1.6, -6.1], [1.6, -3.9], [10.4, -6.1], [10.4, -3.9]];
  tables.forEach(([x, z], i) => {
    const facing = i % 2 ? 0 : Math.PI;
    put("table", x, z, facing, [2.4, 1]);
    const side = Math.cos(facing);
    put("table-lamp", x + 0.85, z - 0.25 * side, facing - 0.6, null, TOP4);
    put("stack", x - 0.5, z - 0.2 * side, rng.range(0, 1), null, TOP4);
    if (i === 0 || i === 3) put("magnifier", x - 0.8, z - 0.1 * side, facing + 0.5, null, TOP4);
    if (i === 2) put("viewer", x + 0.1, z - 0.15 * side, facing - 0.3, null, TOP4);
    for (const dx of [-0.55, 0.45]) {
      put("stool", x + dx, z + 0.95 * side, facing + Math.PI + rng.range(-0.3, 0.3), [0.45, 0.45]);
    }
    if (!asleep) {
      sources.push({ position: new THREE40.Vector3(x + 0.85 - 0.2, TOP4 + 0.35, z - 0.25 * side + 0.2 * side), color: AMBER, radius: 2.2, strength: 0.55, dust: 3 });
    }
    counts.furniture += 5;
  });
  kit.model("case", display_case_exports, { seed: seed + 801, model: "conservation", content: "tablet" }, { castShadow: true });
  put("case", -1.9, -6.2, HALF_PI, [1.2, 0.8]);
  put("case", -1.9, -2.6, HALF_PI + Math.PI, [1.2, 0.8]);
  kit.model("cart", complex_cart_exports, { seed: seed + 803, model: "cassettes", load: "full" }, { castShadow: true });
  put("cart", 13, -4.6, HALF_PI + 0.25, [1.1, 0.7]);
  put("cart", 8.9, -2.85, 0.15, [1.1, 0.7]);
  counts.furniture += 4;
  const lantern = kit.model("lantern", filament_chandelier_exports, { seed: seed + 811, model: "lantern", state: asleep ? "off" : "lit", height: 3.4, chain: r.h - 3.4 }, { cut: VIEW_HIDE });
  const hooks = /* @__PURE__ */ new Set();
  for (const x of [2, 10]) {
    const z = -5;
    put("lantern", x, z, 0);
    hooks.add(`${x},${z}`);
    const light = lantern.userData.lightPoint ?? new THREE40.Vector3(0, 3.4, 0);
    if (!asleep) sources.push({ position: new THREE40.Vector3(x + light.x, light.y - 0.8, z + light.z), color: AMBER, radius: 4.2, strength: 0.62, dust: 8 });
    counts.lamps += 1;
  }
  kit.model("sconce", filament_lamp_exports, { seed: seed + 812, mount: "wall", height: 6, state: asleep ? "off" : "lit" }, { cut: WALL_CUT });
  const sconce = kit.models.get("sconce").prototype;
  for (const x of [1.3, 7, 12.7]) {
    put("sconce", x, northFace, 0);
    const light = sconce.userData.lightPoint ?? new THREE40.Vector3(0, 6, 0.2);
    if (!asleep) sources.push({ position: new THREE40.Vector3(x + light.x, light.y - 1.6, northFace + light.z + 0.9), color: AMBER, radius: 3.8, strength: 0.6, dust: 4 });
    counts.lamps += 1;
  }
  kit.build();
  group.add(kit.group);
  let nextSlide = 4 + rng.range(0, 3);
  let slid = null;
  const archive = live.userData.archive;
  const update = (time) => {
    kit.update();
    if (time >= nextSlide) {
      if (slid) {
        archive.slide(slid[0], slid[1], 0, 1.1);
        slid = null;
        nextSlide = time + 4 + rng.range(0, 5);
      } else {
        slid = [rng.int(0, archive.cols - 1), rng.int(1, 9)];
        archive.slide(slid[0], slid[1], 1, 1.1);
        nextSlide = time + 3 + rng.range(0, 2);
      }
    }
  };
  return {
    group,
    objects,
    kit,
    hooks,
    stair: stair.userData.stair,
    stairAt: { ...STAIR, rotY: Math.PI },
    mezzanine: { x: mezzX, z: mezzZ, length: mezzLength, width: MEZZANINE.width, top: MEZZANINE.top },
    catalogue: catalogue.userData.catalogue,
    east: eastObject.userData.door,
    update,
    /**
     * Montre ou cache le côté sud (mur, linteau de la porte du Sas, rayonnages et échelles) : vu du Sas, porte
     * ouverte, on n'en verrait que les dos.
     */
    setSouthWall(visible) {
      for (const key of ["wall-south", "lintel", "shelf-south", "ladder"]) {
        for (const mesh of kit.models.get(key)?.meshes ?? []) mesh.visible = visible;
      }
    },
    stats: () => kit.stats(),
    dispose() {
      kit.dispose();
      for (const object of objects) {
        object.traverse((child) => {
          child.geometry?.dispose();
          child.material?.userData?.depthMaterial?.dispose();
          child.material?.dispose?.();
        });
      }
      group.clear();
    }
  };
}

// src/worlds/ancient-complex.js
var COMPLEX_ROOMS = {
  sas: { label: "Le Sas", meters: 10 },
  archives: { label: "Les Archives", meters: 18 }
};
var SAS_STATES = {
  check: { label: "V\xE9rification" },
  awake: { label: "\xC9veill\xE9" },
  asleep: { label: "Endormi" }
};
var ROOMS = {
  sas: { name: "Sas de Scellement", x0: -5, x1: 5, z0: 0, z1: 6, h: 5 },
  vestibule: { name: "Vestibule", x0: -3, x1: 3, z0: 6, z1: 10, h: 4 },
  archives: ARCHIVES
};
var WALL_CUT2 = { rule: "wall", height: -1 };
var HIDE_ON_WALL = { rule: "wall", height: -1 };
var CORNER_CUT2 = { rule: "corner", height: -1 };
var VIEW_HIDE2 = { rule: "view", height: -1 };
var AMBER2 = GLOWS.amber.light;
var HALF_PI2 = Math.PI / 2;
var STEP_UP = 0.4;
var DESK = { x: -4.4, z: 3 };
var OPERATOR = { x: -3.45, z: 3, radius: 1 };
var LEVER_STEP = 0.22;
var WAVE_SPEED = 3.4;
var WAVE_REACH = 13;
function createAncientComplex({ seed = 1, room = "sas", state = "check", diorama = false } = {}) {
  seed = THREE41.MathUtils.clamp(Math.round(seed) || 0, 0, 9999);
  if (!(room in COMPLEX_ROOMS)) room = "sas";
  if (!(state in SAS_STATES)) state = "check";
  const rng = createRng(seed * 7919 + 501);
  const rooms = ["sas", "vestibule"].map((id) => ({ id, ...ROOMS[id] }));
  const allRooms = [...rooms, { id: "archives", ...ROOMS.archives }];
  const R2 = Object.fromEntries(allRooms.map((r) => [r.id, r]));
  const kit = new InteriorKit();
  const colliders = new BoxColliders();
  const walk = new WalkSurfaces({ stepUp: STEP_UP });
  const group = new THREE41.Group();
  group.name = "Le Complexe";
  const counts = { rooms: allRooms.length, slabs: 0, walls: 0, doors: 0, furniture: 0, lamps: 0 };
  const sources = [];
  const objects = [];
  const reveal = { value: new THREE41.Vector4(DESK.x, 1.1, DESK.z, state === "awake" ? WAVE_REACH : 0) };
  const GLYPH_OFF = GLOWS.amber.ramp[0];
  const GROOVE_OFF = STONES.blackBasalt.ink;
  const GROOVE_ON = "#7c3a16";
  const roomAt = (x, z) => allRooms.find((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  const bounds = { minX: -6, maxX: 16, minZ: -13, maxZ: 11 };
  const put = (key, x, z, rotY = 0, box = null, y = 0) => {
    const index = kit.place(key, x, z, rotY, y);
    if (box) addBox(x, z, rotY, box);
    return index;
  };
  const addBox = (x, z, rotY, [w, d, oz = 0]) => {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const swap = Math.abs(s) > 0.5;
    colliders.add(x + s * oz, z + c * oz, (swap ? d : w) / 2, (swap ? w : d) / 2);
  };
  const onWall = (r, side, t, inset = 0) => {
    const face = 0.3 + inset;
    if (side === "n") return [t, r.z0 + face, 0];
    if (side === "s") return [t, r.z1 - face, Math.PI];
    if (side === "w") return [r.x0 + face, t, HALF_PI2];
    return [r.x1 - face, t, -HALF_PI2];
  };
  const wallItem = (key, r, side, t, inset, box = null) => {
    const [x, z, turn] = onWall(r, side, t, inset);
    counts.furniture += 1;
    return put(key, x, z, turn, box);
  };
  const SLAB = { castShadow: false };
  const grooveReveal = { mesh: "groove", uniform: reveal, off: GROOVE_OFF };
  kit.model("slab", glyph_floor_slab_exports, { variant: "intact", groove: "amber", seed: seed + 1 }, { ...SLAB, reveal: grooveReveal });
  kit.model("slab-worn", glyph_floor_slab_exports, { variant: "worn", groove: "amber", seed: seed + 2 }, { ...SLAB, reveal: grooveReveal });
  kit.model("slab-cracked", glyph_floor_slab_exports, { variant: "cracked", groove: "amber", seed: seed + 3 }, { ...SLAB, reveal: grooveReveal });
  kit.model("slab-trapdoor", glyph_floor_slab_exports, { variant: "trapdoor", groove: "amber", seed: seed + 4 }, { ...SLAB, reveal: grooveReveal });
  for (const key of ["slab", "slab-worn", "slab-cracked", "slab-trapdoor"]) {
    kit.models.get(key).prototype.traverse((child) => {
      if (child.isMesh && child.name === "groove") child.material.uniforms.uRamp.value.forEach((c) => c.copy(rgb(GROOVE_ON)));
    });
  }
  kit.model("slab-out", glyph_floor_slab_exports, { variant: "worn", groove: "dark", seed: seed + 5 }, SLAB);
  kit.model("slab-out-cracked", glyph_floor_slab_exports, { variant: "cracked", groove: "dark", seed: seed + 6 }, SLAB);
  const spots = [[-2, 1], [2, 1], [-2, 5], [2, 5], [-4, 3], [4, 1]];
  const trap = spots[rng.int(0, 3)];
  const crack = spots[(spots.indexOf(trap) + 1 + rng.int(0, 3)) % spots.length];
  for (const r of rooms) {
    for (let x = r.x0 + 1; x < r.x1; x += 2) {
      for (let z = r.z0 + 1; z < r.z1; z += 2) {
        const flip = rng.chance(0.5) ? Math.PI : 0;
        const roll = rng.next();
        let key;
        let turn;
        if (r.id === "sas") {
          const toward = Math.abs(-x - z) >= Math.abs(-x + z) ? 0 : HALF_PI2;
          turn = toward + flip;
          key = x === 0 ? "slab-worn" : trap[0] === x && trap[1] === z ? "slab-trapdoor" : crack[0] === x && crack[1] === z ? "slab-cracked" : "slab";
        } else {
          turn = rng.int(0, 3) * HALF_PI2;
          key = roll < 0.35 ? "slab-out-cracked" : "slab-out";
        }
        put(key, x, z, turn, null, -0.2);
        counts.slabs += 1;
      }
    }
  }
  const pieces = /* @__PURE__ */ new Map();
  const addEdge = (r, axis, line, from, to, inward) => {
    for (let c = from + 1; c < to; c += 2) {
      const key = `${axis}:${line}:${c}`;
      const piece = pieces.get(key);
      if (piece) piece.shared = true;
      else pieces.set(key, { axis, line, c, inward, room: r, shared: false });
    }
  };
  for (const r of rooms) {
    addEdge(r, "x", r.z0, r.x0, r.x1, 1);
    addEdge(r, "x", r.z1, r.x0, r.x1, -1);
    addEdge(r, "z", r.x0, r.z0, r.z1, 1);
    addEdge(r, "z", r.x1, r.z0, r.z1, -1);
  }
  const wallTurn = (axis, inward) => axis === "x" ? inward > 0 ? 0 : Math.PI : inward > 0 ? HALF_PI2 : -HALF_PI2;
  const wallXZ = (axis, line, c) => axis === "x" ? [c, line] : [line, c];
  const cutObject = (object) => {
    object.traverse((child) => {
      if (!child.isMesh || !child.material.uniforms?.uRamp) return;
      enableCutaway(child.material, WALL_CUT2.rule, WALL_CUT2.height);
      child.customDepthMaterial = child.material.userData.depthMaterial;
    });
  };
  const doors = [];
  const addDoor = ({ axis, line, at, width, object, role }) => {
    const centers = width === 6 ? [at - 2, at, at + 2] : [at];
    const first2 = pieces.get(`${axis}:${line}:${centers[0]}`);
    for (const c of centers) pieces.delete(`${axis}:${line}:${c}`);
    const [x, z] = wallXZ(axis, line, at);
    object.position.set(x, 0, z);
    object.rotation.y = wallTurn(axis, first2.inward);
    cutObject(object);
    group.add(object);
    objects.push(object);
    const door = object.userData.door;
    const open = door.opening.width;
    for (const s of [-1, 1]) colliders.add(x + s * (width / 2 + open / 2) / 2, z, (width / 2 - open / 2) / 2, 0.3);
    colliders.add(x, z, open / 2, 0.3, () => door.blocking);
    const entry = { object, door, x, z, role, opening: false };
    doors.push(entry);
    counts.doors += 1;
    return entry;
  };
  const iris = addDoor({
    axis: "x",
    line: 6,
    at: 0,
    width: 6,
    role: "iris",
    object: create7({ seed: seed * 31 + 11, height: R2.sas.h, state: "closed" })
  });
  const northObject = create3({ seed: seed * 31 + 12, model: "standard", height: R2.sas.h, state: "closed", glyphs: "lit" });
  northObject.traverse((child) => {
    if (child.isMesh && child.name === "glow") enableReveal(child.material, reveal, GLYPH_OFF);
  });
  const north = addDoor({ axis: "x", line: 0, at: 0, width: 2, role: "north", object: northObject });
  const sill = iris.door.opening;
  const surfaces = [{ minX: -sill.width / 2, maxX: sill.width / 2, minZ: 5.66, maxZ: 6.34, top: sill.sill }];
  const nicheAt = rng.chance(0.5) ? 1 : 5;
  const wallModel = (h, variant, glyphs) => {
    const key = `wall-${h}-${variant}-${glyphs}`;
    kit.model(key, glyph_wall_exports, { seed: seed * 13 + h * 7 + variant.length, variant, height: h, width: 2, glyphs }, {
      cut: WALL_CUT2,
      castShadow: true,
      reveal: glyphs === "lit" ? { mesh: "glyphs", uniform: reveal, off: GLYPH_OFF } : null
    });
    return key;
  };
  for (const piece of pieces.values()) {
    const [x, z] = wallXZ(piece.axis, piece.line, piece.c);
    const sas2 = piece.room.id === "sas";
    const variant = sas2 && piece.axis === "z" && piece.line === R2.sas.x0 && piece.c === nicheAt ? "niche" : "plain";
    put(wallModel(piece.room.h, variant, sas2 ? "lit" : "off"), x, z, wallTurn(piece.axis, piece.inward));
    if (piece.axis === "x") colliders.add(x, z, 1, 0.3);
    else colliders.add(x, z, 0.3, 1);
    counts.walls += 1;
  }
  const corners = /* @__PURE__ */ new Map();
  for (const r of rooms) {
    for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) {
      const key = `${x},${z}`;
      corners.set(key, Math.max(corners.get(key) ?? 0, r.h));
    }
  }
  for (const [key, h] of corners) {
    const [x, z] = key.split(",").map(Number);
    const model = `pillar-${h}`;
    kit.model(model, glyph_column_exports, { seed: seed + h, shape: "square", height: h, diameter: 0.9 }, { cut: CORNER_CUT2, castShadow: true });
    put(model, x, z, 0, [0.9, 0.9]);
  }
  const sas = R2.sas;
  kit.model("bench", stone_bench_exports, { seed: seed + 21, model: "sas" });
  kit.model("locker", equipment_locker_exports, { seed: seed + 24, model: "locker" }, { cut: HIDE_ON_WALL });
  kit.model("grate", vent_grate_exports, { seed: seed + 31, model: "wall", height: 0.5, light: "standby" }, { cut: HIDE_ON_WALL });
  kit.model("plaque", glyph_plaque_exports, { seed: seed + 32, model: "inscription", height: 2.15 }, { cut: HIDE_ON_WALL });
  kit.model("plaque-archives", glyph_plaque_exports, { seed: seed + 33, model: "direction", room: 1, arrow: "none", height: 2.05 }, { cut: HIDE_ON_WALL });
  kit.model("pipe", copper_pipe_exports, { seed: seed + 35, piece: "straight", height: 3.4 }, { cut: HIDE_ON_WALL });
  kit.model("valve", wheel_valve_exports, { seed: seed + 37, height: 1.3 }, { cut: HIDE_ON_WALL });
  kit.model("cable", braided_cable_exports, { seed: seed + 40, layout: "floor", gauge: "study", length: 2 });
  kit.model("trunk-open", travel_trunk_exports, { seed: seed + 42, state: "open", content: rng.chance(0.6) ? "cassettes" : "tools" });
  kit.model("trunk-closed", travel_trunk_exports, { seed: seed + 43, state: "closed", size: "large" });
  kit.model("hand-lamp", hand_lamp_exports, { seed: seed + 44, pose: "standing", state: "lit" });
  const posts = kit.model("posts", bronze_railing_exports, { seed: seed + 45, kind: "chain", segments: 2, span: 1.1 });
  const railing = (x, z, rotY) => {
    put("posts", x, z, rotY);
    const c = Math.cos(rotY), s = Math.sin(rotY);
    for (const [x1, z1, x2, z2] of posts.userData.blocking) {
      const ax = x + x1 * c + z1 * s, az = z - x1 * s + z1 * c;
      const bx = x + x2 * c + z2 * s, bz = z - x2 * s + z2 * c;
      colliders.add((ax + bx) / 2, (az + bz) / 2, Math.abs(bx - ax) / 2 + 0.08, Math.abs(bz - az) / 2 + 0.08);
    }
    counts.furniture += 1;
  };
  const deskObject = create16({ seed: seed + 27, model: "check" });
  deskObject.position.set(DESK.x, 0, DESK.z);
  deskObject.rotation.y = HALF_PI2;
  group.add(deskObject);
  objects.push(deskObject);
  addBox(DESK.x, DESK.z, HALF_PI2, [1, 0.55]);
  counts.furniture += 1;
  const desk = deskObject.userData.desk;
  const restLevers = desk.levers.slice();
  wallItem("plaque", sas, "w", 3, 0.01);
  wallItem("grate", sas, "w", nicheAt === 1 ? 5 : 1, 0);
  put("cable", sas.x0 + 0.5, nicheAt === 1 ? 1.3 : 4.7, HALF_PI2);
  for (const t of [2, 4]) wallItem("locker", sas, "e", t, 0, [1.8, 0.4, 0.2]);
  for (const t of [2, 4]) wallItem("pipe", sas, "e", t, 0);
  wallItem("pipe", sas, "n", 3, 0);
  wallItem("valve", sas, "n", 4.1, 0, [0.4, 0.3, 0.15]);
  for (const t of [-2.6, 2.6]) wallItem("bench", sas, "n", t, 0.3, [2.2, 0.55]);
  wallItem("plaque-archives", sas, "n", 1.45, 0.01);
  put("trunk-open", -3.8, 5.15, Math.PI - 0.12, [0.8, 0.5]);
  put("trunk-closed", 3.75, 5.2, Math.PI + 0.08, [0.95, 0.6]);
  counts.furniture += 2;
  railing(-1.6, 4.15, HALF_PI2);
  railing(1.6, 4.15, HALF_PI2);
  put("hand-lamp", 1.85, 7, -0.6);
  sources.push({ position: new THREE41.Vector3(1.85, 0.55, 7), color: AMBER2, radius: 2.6, strength: 0.75, dust: 6 });
  counts.furniture += 1;
  const lampModels = {
    hanging: { asset: filament_lamp_exports, params: { height: 3, chain: 1.5 }, cut: VIEW_HIDE2, radius: 4.4, drop: 0.8 },
    wall: { asset: filament_lamp_exports, params: { mount: "wall", height: 2.6 }, cut: HIDE_ON_WALL, radius: 3.6, drop: 0 }
  };
  const lamps = [];
  const hooks = /* @__PURE__ */ new Set();
  const _v = new THREE41.Vector3();
  const lamp = (kind, x, z, turn, lit) => {
    const spec = lampModels[kind];
    const onKey = `lamp-${kind}-on`;
    const offKey = `lamp-${kind}-off`;
    const proto = kit.model(onKey, spec.asset, { seed: seed + 70, ...spec.params, state: "lit" }, { cut: spec.cut });
    kit.model(offKey, spec.asset, { seed: seed + 70, ...spec.params, state: "off" }, { cut: spec.cut });
    const on = kit.place(onKey, x, z, turn);
    const off = kit.place(offKey, x, z, turn);
    if (kind === "hanging") hooks.add(`${x},${z}`);
    _v.copy(proto.userData.lightPoint ?? new THREE41.Vector3(0, 2.5, 0)).applyAxisAngle(new THREE41.Vector3(0, 1, 0), turn);
    const source = { position: new THREE41.Vector3(x + _v.x, _v.y - spec.drop, z + _v.z), color: AMBER2, radius: spec.radius, strength: 0.62, on: lit };
    sources.push(source);
    lamps.push({ onKey, offKey, on, off, source, rest: lit, distance: source.position.distanceTo(_v.set(reveal.value.x, reveal.value.y, reveal.value.z)) });
    counts.lamps += 1;
  };
  const keep = rng.chance(0.5) ? -2 : 2;
  const awake = state === "awake";
  lamp("hanging", -2, 3, 0, awake || keep === -2);
  lamp("hanging", 2, 3, 0, awake || keep === 2);
  {
    const [x, z, turn] = onWall(sas, "e", 3, 0);
    lamp("wall", x, z, turn, awake);
  }
  {
    const [x, z, turn] = onWall(sas, "w", nicheAt === 1 ? 4.8 : 1.2, 0);
    lamp("wall", x, z, turn, awake);
  }
  kit.build();
  group.add(kit.group);
  for (const l of lamps) {
    kit.setVisible(l.onKey, l.on, l.source.on);
    kit.setVisible(l.offKey, l.off, !l.source.on);
  }
  const archives = buildArchives({ seed, state, colliders, walk, sources, counts, cutObject });
  group.add(archives.group);
  const makeCeiling = (list, hookSet, key) => {
    const ceilingKit = new InteriorKit();
    ceilingKit.model("vault", coffered_vault_exports, { seed: seed + 80 + key, display: "ceiling", hook: "none" }, { castShadow: false });
    ceilingKit.model("vault-hook", coffered_vault_exports, { seed: seed + 81 + key, display: "ceiling", hook: "hook" }, { castShadow: false });
    for (const r of list) {
      for (let x = r.x0 + 1; x < r.x1; x += 2) {
        for (let z = r.z0 + 1; z < r.z1; z += 2) ceilingKit.place(hookSet.has(`${x},${z}`) ? "vault-hook" : "vault", x, z, 0, r.h);
      }
    }
    ceilingKit.build();
    ceilingKit.group.visible = false;
    group.add(ceilingKit.group);
    return ceilingKit;
  };
  const ceiling = makeCeiling(rooms, hooks, 0);
  const archivesCeiling = makeCeiling([R2.archives], archives.hooks, 10);
  const zones = {
    sas: { parts: [kit.group, deskObject, iris.object], ceiling: ceiling.group, visible: true },
    archives: { parts: [archives.group], ceiling: archivesCeiling.group, visible: true }
  };
  let thirdPerson = false;
  const showZones = (sasOn, archivesOn) => {
    for (const [zone, on] of [[zones.sas, sasOn], [zones.archives, archivesOn]]) {
      zone.visible = on;
      for (const part of zone.parts) part.visible = on;
      zone.ceiling.visible = on && thirdPerson;
    }
  };
  showZones(room !== "archives", room === "archives");
  let southShown = true;
  let daylight = null;
  let halos = null;
  let dust = null;
  if (!diorama) {
    daylight = createDaylight({ azimuth: THREE41.MathUtils.degToRad(160), elevation: THREE41.MathUtils.degToRad(62) });
    daylight.setSun(THREE41.MathUtils.degToRad(160), THREE41.MathUtils.degToRad(62));
    group.add(daylight.light, daylight.light.target);
    halos = createHaloPool(sources);
    dust = createLampDust(sources, { perLamp: 10, lamps: 5 });
    group.add(dust.mesh);
  }
  const checking = state === "check";
  const startRoom = room;
  if (startRoom === "archives" && checking) reveal.value.w = WAVE_REACH;
  const sequence = { phase: checking && startRoom !== "archives" ? "idle" : "done", start: 0, lever: 0, radius: reveal.value.w };
  const verifiedLevers = desk.levers.map((_, i) => i % 2 === 0);
  const setLamp = (l, lit) => {
    if (l.source.on === lit) return;
    l.source.on = lit;
    kit.setVisible(l.onKey, l.on, lit);
    kit.setVisible(l.offKey, l.off, !lit);
    halos?.refresh();
    dust?.refresh();
  };
  const sleep = () => {
    sequence.phase = "sleeping";
    sequence.start = time;
  };
  let time = 0;
  const _focus = new THREE41.Vector3();
  const inside = (p) => p.z < R2.sas.z1 - 1.4;
  const near = (p, x, z, d) => Math.hypot(p.x - x, p.z - z) < d;
  const updateSequence = (target, dt) => {
    const s = sequence;
    if (s.phase === "idle" && near(target, OPERATOR.x, OPERATOR.z, OPERATOR.radius)) {
      s.phase = "levers";
      s.start = time;
      s.lever = 0;
    }
    if (s.phase === "levers") {
      while (s.lever < desk.levers.length && time - s.start >= (s.lever + 1) * LEVER_STEP) {
        desk.setLever(s.lever, verifiedLevers[s.lever]);
        s.lever += 1;
      }
      if (s.lever >= desk.levers.length && time - s.start >= (desk.levers.length + 2) * LEVER_STEP) {
        s.phase = "wave";
        s.start = time;
      }
    }
    if (s.phase === "wave") {
      s.radius = Math.min(WAVE_REACH, (time - s.start) * WAVE_SPEED);
      if (s.radius >= WAVE_REACH) s.phase = "done";
    }
    if (s.phase === "sleeping") {
      s.radius = Math.max(0, s.radius - 2 * WAVE_SPEED * dt);
      if (s.radius <= 0) {
        s.phase = "idle";
        desk.levers.forEach((_, i) => desk.setLever(i, restLevers[i]));
      }
    }
    if (checking && s.phase === "done" && !inside(target) && target.z > R2.vestibule.z0 + 1.2) sleep();
    reveal.value.w = s.radius;
    for (const l of lamps) setLamp(l, l.rest || s.radius > l.distance);
  };
  const unlocked = () => !checking || sequence.phase === "done";
  const updateDoors = (target) => {
    for (const d of doors) {
      const distance = Math.hypot(target.x - d.x, target.z - d.z);
      const locked = d.role === "iris" ? checking && inside(target) && !unlocked() : !unlocked();
      if (distance < 2.4 && !locked && !d.opening) {
        d.door.open();
        d.opening = true;
      } else if ((distance > 3.6 || locked) && d.opening) {
        d.door.close();
        d.opening = false;
      }
    }
  };
  const passage = { minX: -sill.width / 2 + 0.25, maxX: sill.width / 2 - 0.25, minZ: 5.4, maxZ: 6.6 };
  const northPassage = { minX: -0.5, maxX: 0.5, minZ: -0.7, maxZ: 0.7 };
  const inRect = (x, z, b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
  const walkable = (x, z) => Boolean(roomAt(x, z)) || !iris.door.blocking && inRect(x, z, passage) || !north.door.blocking && inRect(x, z, northPassage);
  const route = [
    { x: 0.4, z: 8.7 },
    { x: 0, z: 7.6, pass: true },
    { x: 0, z: 4.6, pass: true, gate: () => !iris.door.blocking, wait: [0, 7.7] },
    { x: 0, z: 2, pass: true },
    { x: -3.3, z: 2.6, pass: true },
    { x: -3.35, z: 2.6 },
    // devant le pupitre : la vérification commence
    { x: -0.3, z: 1.8, pass: true, gate: () => unlocked(), wait: [-3.35, 2.6] },
    { x: 0, z: 1.7 },
    // devant la porte nord, qui s'ouvre
    { x: 0, z: 0.3, pass: true, gate: () => !north.door.blocking, wait: [0, 1.7] },
    ...archivesTour(),
    { x: 0, z: -0.3, pass: true, gate: () => !north.door.blocking, wait: [0, -1.6] },
    { x: 0, z: 2, pass: true },
    { x: 0, z: 4.8, pass: true },
    { x: 0, z: 7.4, pass: true, gate: () => !iris.door.blocking, wait: [0, 4.6] }
  ];
  let routeIndex = startRoom === "archives" ? route.findIndex((step) => step.archives) : 0;
  function archivesTour() {
    const st = archives.stair;
    const at = archives.stairAt;
    const c = Math.cos(at.rotY), sn = Math.sin(at.rotY);
    const point = (radius, t, extra = {}) => {
      const lx = Math.sin(t) * radius, lz = Math.cos(t) * radius;
      return { x: at.x + c * lx + sn * lz, z: at.z - sn * lx + c * lz, pass: true, ...extra };
    };
    const step = st.treads[1].a0 - st.treads[0].a0;
    const enter = st.landing.a0 - 2 * step;
    const tight = { reach: 0.25 };
    const below = [point(1.75, enter), point(0.66, enter, tight), point(0.66, st.landing.a0 + 0.2, tight), point(0.66, st.landing.a1 - 0.15, tight)];
    const up = st.treads.map((tr) => point(0.66, (tr.a0 + tr.a1) / 2, tight));
    const landing = [point(0.66, 0, tight), point(1.6, 0, tight)];
    const m = archives.mezzanine;
    return [
      { x: 0, z: -1.6, pass: true, archives: true },
      { x: 0, z: -5, pass: true },
      // l'allée entre les tables de l'ouest
      { x: 3.6, z: -5, pass: true },
      { x: 4, z: -7.5, pass: true },
      { x: 6, z: -7.5 },
      // face au catalogue
      { x: 2, z: -7.7, pass: true },
      { x: 0, z: -7.7, pass: true },
      ...below,
      ...up,
      ...landing,
      { x: m.x - 2, z: m.z, pass: true },
      { x: m.x + 4, z: m.z },
      // sur la mezzanine, devant les rangs hauts
      { x: at.x + 0.6, z: m.z, pass: true },
      ...landing.slice().reverse(),
      ...up.slice().reverse(),
      ...below.slice().reverse(),
      { x: 0, z: -7.7, pass: true },
      { x: 3.6, z: -7.7, pass: true },
      { x: 3.6, z: -3.2, pass: true },
      { x: 7.3, z: -3.3 },
      // au pied d'une échelle roulante
      { x: 3.6, z: -3.2, pass: true },
      { x: 3.6, z: -5, pass: true },
      { x: 0, z: -5, pass: true },
      { x: 0, z: -1.6, pass: true }
    ];
  }
  const first = startRoom === "archives" ? new THREE41.Vector3(0, 0, -1.6) : new THREE41.Vector3(0, 0, 8.6);
  return {
    group,
    seed,
    room,
    state,
    size: room,
    meters: COMPLEX_ROOMS[room].meters,
    bounds,
    center: startRoom === "archives" ? new THREE41.Vector3(6, 0, -6) : new THREE41.Vector3(0, 0, 5),
    spawn: first,
    counts,
    rooms,
    interior: true,
    /** Face au nord au départ : la Porte-Iris. */
    spawnHeading: Math.PI,
    /** On ne recule pas jusqu'à voir le vide autour des pièces, ni ne se couche au ras du sol. */
    viewLimits: { minZoom: 0.8, minElevation: THREE41.MathUtils.degToRad(22) },
    /** Brume : un voile sombre tramé au fond de la pièce (isométrique : compté depuis le point regardé). */
    fog: { iso: { near: 2, far: 14, max: 0.5 }, third: { near: 3, far: 16, max: 0.55 } },
    /** État de la vérification (lecture, captures). */
    sequence,
    /**
     * Hauteur du sol sous (x, z) : la plus haute surface de marche qu'on atteint d'un pas depuis la hauteur `y`
     * (le seuil de l'Iris : 0,20 m) ; sans `y`, depuis le sol.
     */
    heightAt(x, z, y = 0) {
      let h = 0;
      for (const s of surfaces) {
        if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.top <= y + STEP_UP) h = Math.max(h, s.top);
      }
      return walk.heightAt(x, z, y, h);
    },
    /** Hauteur du plafond (la caméra à la 3e personne reste dessous). */
    ceilingAt(x, z) {
      return roomAt(x, z)?.h ?? Math.min(R2.sas.h, R2.vestibule.h);
    },
    /** Vue à la 3e personne : le plafond se ferme au-dessus de la tête. */
    setThirdPerson(value) {
      thirdPerson = value;
      for (const zone of Object.values(zones)) zone.ceiling.visible = value && zone.visible;
    },
    /**
     * Murs, piliers, meubles, portes fermées, garde-corps et marches selon l'étage (`y` : hauteur des pieds) ; pas de
     * chute par-dessus un bord ; et on ne sort pas des pièces.
     */
    collide(position, radius, y) {
      if (y === void 0) {
        walk.forget(position);
        y = 0;
      }
      colliders.collide(position, radius, y);
      walk.collide(position, radius, y, (x, z, yy) => this.heightAt(x, z, yy));
      if (walkable(position.x, position.z)) return;
      let best = null, bestDistance = Infinity;
      for (const r of allRooms) {
        const x = THREE41.MathUtils.clamp(position.x, r.x0 + 0.35, r.x1 - 0.35);
        const z = THREE41.MathUtils.clamp(position.z, r.z0 + 0.35, r.z1 - 0.35);
        const d = Math.hypot(x - position.x, z - position.z);
        if (d < bestDistance) [best, bestDistance] = [[x, z], d];
      }
      position.x = best[0];
      position.z = best[1];
    },
    strollTarget() {
      for (let guard = 0; guard < route.length; guard++) {
        const step = route[routeIndex];
        if (step.gate && !step.gate()) return { x: step.wait[0], z: step.wait[1] };
        routeIndex = (routeIndex + 1) % route.length;
        return { x: step.x, z: step.z, pass: Boolean(step.pass), reach: step.reach };
      }
      return { x: first.x, z: first.z };
    },
    setMood() {
    },
    update({ camera, target, dt, viewRadius, shadows }) {
      time += dt;
      updateSequence(target, dt);
      updateDoors(target);
      archives.update(time);
      kit.update();
      const inArchives = target.z < R2.sas.z0;
      const nearNorth = !north.door.blocking && Math.hypot(target.x - north.x, target.z - north.z) < 3;
      const sasOn = !inArchives || nearNorth, archivesOn = inArchives || nearNorth;
      if (sasOn !== zones.sas.visible || archivesOn !== zones.archives.visible) showZones(sasOn, archivesOn);
      if (inArchives !== southShown) archives.setSouthWall(southShown = inArchives);
      if (ceiling.group.visible && camera) {
        camera.getWorldDirection(_focus);
        _focus.y = 0;
        _focus.normalize().multiplyScalar(4).add(target);
      } else {
        _focus.copy(target);
      }
      halos?.update(_focus, time, camera);
      dust?.update(_focus, camera);
      if (shadows && daylight) daylight.update(target, Math.min(viewRadius + 6, 30));
    },
    stats() {
      const a = kit.stats(), b = archives.stats();
      return { meshes: a.meshes + b.meshes, triangles: a.triangles + b.triangles, models: a.models + b.models, fraction: 1 };
    },
    dispose() {
      halos?.dispose();
      dust?.dispose();
      daylight?.dispose();
      kit.dispose();
      ceiling.dispose();
      archives.dispose();
      archivesCeiling.dispose();
      for (const object of objects) {
        object.traverse((child) => {
          child.geometry?.dispose();
          child.material?.userData?.depthMaterial?.dispose();
          child.material?.dispose?.();
        });
      }
      group.clear();
    }
  };
}

// src/assets/worlds/interiors/ancient-complex.js
var params34 = {
  seed: seedParam("Usure et variantes des dalles (trappe, fissure), place de la niche, leviers, lampe de veille, contenu de la malle."),
  room: choiceParam("Pi\xE8ce", Object.fromEntries(Object.entries(COMPLEX_ROOMS).map(([id, r]) => [id, r.label])), "La pi\xE8ce montr\xE9e (et celle o\xF9 l'on commence la visite) : le Sas ou les Archives ; l'Atelier et les salles d'\xE9tude viendront."),
  state: choiceParam("\xC9tat du Sas", SAS_STATES, "V\xE9rification (on entre, l'Iris se scelle, le pupitre v\xE9rifie et la lueur gagne tout le Sas), \xE9veill\xE9 (tout allum\xE9) ou endormi (glyphes \xE9teints, une lampe sur deux).", "awake")
};
var meta34 = {
  id: "worlds/interiors/ancient-complex",
  name: "Le Complexe",
  nameEn: "The Ancient Complex",
  category: "worlds",
  subcategory: "interiors",
  description: "Le lieu ancien-technologique, vu en coupe, une pi\xE8ce \xE0 la fois. Le Sas de Scellement (10 \xD7 6 \xD7 5 m) et son vestibule : Porte-Iris qui s'ouvre \xE0 l'approche puis se scelle derri\xE8re soi, pupitre de v\xE9rification dont la lueur ambre gagne en vague glyphes, rainures et lampes jusqu'\xE0 la porte nord. Derri\xE8re elle, les Archives (18 \xD7 12 \xD7 7 m) : rayonnages monumentaux \xE0 tiroirs et rouages, mezzanine en caillebotis \xE0 3,4 m qu'on rejoint par un escalier \xE0 vis, meuble-catalogue central au pupitre tournant, colonnes cannel\xE9es, tables de lecture, \xE9chelles roulantes, vitrines, poussi\xE8re dans la lumi\xE8re des lampes. Praticable par tous les personnages, \xE9tages compris.",
  tags: [
    "monde",
    "carte",
    "int\xE9rieur",
    "le complexe",
    "complexe",
    "ancien-tech",
    "sas",
    "sas de scellement",
    "porte-iris",
    "v\xE9rification",
    "archives",
    "mezzanine",
    "escalier \xE0 vis",
    "catalogue",
    "glyphes",
    "vue en coupe",
    "\xE0 explorer",
    "assemblage",
    "sc\xE9nario",
    "world",
    "map",
    "interior",
    "ancient complex",
    "ancient-tech",
    "airlock",
    "iris door",
    "verification",
    "archive room",
    "upper floor",
    "spiral staircase",
    "card catalogue",
    "glyphs",
    "cutaway",
    "explorable",
    "composition",
    "procedural"
  ],
  biomes: ["interior"],
  version: 3,
  added: "2026-11-18",
  units: "1 unit\xE9 = 1 m\xE8tre ; sol en y = 0 (dessus des dalles) ; x vers l'est, z vers le sud ; le Sas de z = 0 \xE0 6, le vestibule de z = 6 \xE0 10, les Archives de z = \u221212 \xE0 0 (x de \u22123 \xE0 15), mezzanine \xE0 3,4 m",
  footprint: { radius: 11, height: 7 },
  animated: ["door", "glow"],
  pedestal: false,
  composite: true,
  experience: "explorer",
  params: params34,
  variants: [
    ...Object.entries(SAS_STATES).map(([id, s]) => ({ id, name: `Le Sas : ${s.label.toLowerCase()}`, params: { state: id } })),
    { id: "archives", name: "Les Archives", params: { room: "archives" } }
  ]
};
function create34(given = {}) {
  const p = resolveParams(meta34.params, given);
  const world = createAncientComplex({ ...p, diorama: true });
  world.group.userData.asset = { id: meta34.id, params: p, counts: world.counts };
  world.group.userData.world = world;
  return world.group;
}
function dispose(group) {
  group.userData.world?.dispose();
}
export {
  create34 as create,
  dispose,
  meta34 as meta,
  setWind,
  tick
};
