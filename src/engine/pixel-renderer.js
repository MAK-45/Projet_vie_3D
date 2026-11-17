// Pipeline pixel art : la scène est rendue dans une cible basse résolution (couleur + normales/identifiants +
// profondeur), puis une passe de contours écrit directement dans le canvas, lui aussi en basse résolution.
// C'est le CSS (`image-rendering: pixelated`) qui agrandit l'image : aucun pixel plein écran à calculer.

import * as THREE from "three";
import { rgb } from "./toon-material.js";

/** Nombre de pixels d'art par unité de monde quand le zoom de la caméra vaut 1. */
export const PIXELS_PER_UNIT = 16;

const COMPOSITE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COMPOSITE_FRAGMENT = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tAux;
uniform highp sampler2D tDepth;
uniform vec2 uTexel;
uniform float uDepthRange;   // far - near, en unités
uniform float uDepthThreshold;
uniform float uPerspective;  // 1 : caméra perspective (profondeur à linéariser, seuil qui grandit avec la distance)
uniform vec2 uClip;          // near, far de la caméra
uniform float uTexelPerDepth; // perspective : taille d'un pixel d'art dans le monde, par mètre de profondeur
uniform vec2 uFog;           // brume de lointain : début, fin (m) ; fin à 0 = pas de brume
uniform float uOutline;      // 0 ou 1
uniform float uOutlineDarken;
uniform vec3 uOutlineTint;
uniform float uCreaseLighten;
uniform vec3 uBgTop;
uniform vec3 uBgBottom;
uniform vec2 uResolution;
uniform vec3 uGrade;       // teinte de l'heure : chaque couleur est multipliée (1,1,1 = plein jour)
uniform float uSaturation; // 1 = couleurs franches, 0 = gris (temps couvert)
uniform float uRain;       // 0..1 : densité des traits de pluie
uniform float uRainTime;
varying vec2 vUv;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Pluie : traits clairs d'un pixel de large qui tombent en biais, calculés à l'écran (aucune géométrie).
// Par beau temps, rien : sans ce garde-fou, une case dont le hasard vaut exactement 0 (fréquent en précision réduite
// sur téléphone) passait le test step(hash, 0) et laissait tomber quelques gouttes.
float rainAt(vec2 p) {
  if (uRain <= 0.001) return 0.0;
  float column = floor(p.x + p.y * 0.3);
  float fall = p.y + uRainTime * (150.0 + 70.0 * hash21(vec2(column, 3.0))) + hash21(vec2(column, 7.0)) * 61.0;
  float drop = floor(fall / 23.0);
  float along = fract(fall / 23.0);
  return float(hash21(vec2(column, drop)) < 0.085 * uRain) * step(along, 0.3);
}

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int index = i.x + i.y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[index] + 0.5) / 16.0;
}

// Profondeur en mètres depuis la caméra.
float linearDepth(float d) {
  if (uPerspective < 0.5) return d * uDepthRange;
  return uClip.x * uClip.y / (uClip.y - d * (uClip.y - uClip.x));
}

// Ciel derrière ce pixel : dégradé vertical en paliers, tramé (Bayer 4×4).
vec3 skyAt() {
  float steps = 5.0;
  float t = vUv.y * steps;
  float band = floor(t) + step(bayer4(gl_FragCoord.xy), fract(t));
  return mix(uBgBottom, uBgTop, clamp(band / steps, 0.0, 1.0));
}

vec3 viewNormal(vec4 aux) {
  vec2 n = aux.xy * 2.0 - 1.0;
  return vec3(n, sqrt(max(0.0, 1.0 - dot(n, n))));
}

void main() {
  vec4 color = texture(tColor, vUv);
  vec4 aux = texture(tAux, vUv);
  float depth = linearDepth(texture(tDepth, vUv).r);

  if (color.a < 0.5) {
    vec3 sky = skyAt();
    gl_FragColor = vec4(mix(sky, vec3(0.86, 0.9, 0.97), 0.3 * rainAt(gl_FragCoord.xy)), 1.0);
    return;
  }

  float edge = 0.0;
  float crease = 0.0;
  float hasCrease = step(color.a, 0.9);
  float inked = step(0.66, color.a); // une matière peut refuser le contour (alpha 0,6 : pollen, papillons)
  // Palier de lumière de halo (0 à 3), retiré de l'alpha par 0,02 : 1 (contour), 0,75 (liseré), 0,6 (sans contour).
  float alphaBase = color.a > 0.9 ? 1.0 : (color.a > 0.66 ? 0.75 : 0.6);
  float glow = clamp(floor((alphaBase - color.a) / 0.02 + 0.5), 0.0, 3.0) / 3.0;
  vec3 n = viewNormal(aux);
  // Voisins : droite, gauche, haut, bas. Le voisin opposé sert à reconnaître une surface plane vue en biais,
  // dont la profondeur change régulièrement d'un pixel à l'autre sans qu'il y ait de bord.
  vec2 offsets[4] = vec2[4](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
  vec4 auxNear[4];
  float depthNear[4];
  for (int i = 0; i < 4; i++) {
    vec2 uv = vUv + offsets[i] * uTexel;
    auxNear[i] = texture(tAux, uv);
    depthNear[i] = linearDepth(texture(tDepth, uv).r);
  }
  // En perspective, un pixel couvre plus de monde au loin : le seuil suit la distance.
  float depthThreshold = uPerspective > 0.5 ? max(uDepthThreshold, depth * uTexelPerDepth * 3.5) : uDepthThreshold;
  for (int i = 0; i < 4; i++) {
    vec4 auxN = auxNear[i];
    float diff = depthNear[i] - depth;
    float slope = max(depth - depthNear[i ^ 1], 0.0); // pente déjà présente de l'autre côté
    float otherId = step(0.002, abs(auxN.a - aux.a));
    // Entre deux parties du même objet, le matériau peut demander un seuil plus large (feuillage).
    float threshold = mix(max(depthThreshold, max(aux.z, auxN.z) * 4.0), depthThreshold, otherId);
    // Contour intérieur : on assombrit le pixel de l'objet le plus proche de la caméra.
    edge = max(edge, step(threshold, diff - slope));
    edge = max(edge, otherId * step(auxN.a, aux.a) * step(-depthThreshold, diff));
    // Arête vive d'un même objet : liseré clair du côté tourné vers le haut-gauche.
    vec3 nN = viewNormal(auxN);
    float sameSurface = (1.0 - otherId) * step(abs(diff - slope), depthThreshold);
    float turned = step(0.35, 1.0 - dot(n, nN)) * step(0.0, dot(n - nN, vec3(-0.6, 1.0, 0.6)));
    crease = max(crease, sameSurface * turned * hasCrease);
  }

  vec3 result = color.rgb;
  result = mix(result, min(result * uCreaseLighten, vec3(1.0)), crease * uOutline);
  vec3 outline = mix(result * uOutlineDarken, uOutlineTint, 0.3);
  result = mix(result, outline, edge * uOutline * inked);
  // Heure et météo : tout le décor est teinté d'un coup. Les matières sans contour (lucioles, mer de nuages)
  // portent déjà leur couleur finale et y échappent : une luciole reste vive en pleine nuit.
  vec3 graded = mix(vec3(dot(result, vec3(0.3, 0.55, 0.15))), result, uSaturation) * uGrade;
  // Ce qu'éclaire une lumière de halo garde sa couleur dans le noir, à proportion de son palier.
  result = mix(result, graded, inked * (1.0 - glow));
  // Brume de lointain (caméra perspective) : le décor se fond dans le ciel en quatre paliers tramés, et la fin de
  // la vue (far) n'est jamais une ligne nette.
  if (uFog.y > 0.0) {
    float haze = smoothstep(uFog.x, uFog.y, depth);
    haze = clamp(floor(haze * 4.0 + bayer4(gl_FragCoord.xy)) / 4.0, 0.0, 1.0);
    result = mix(result, skyAt(), haze);
  }
  result = mix(result, vec3(0.86, 0.9, 0.97), 0.3 * rainAt(gl_FragCoord.xy));
  gl_FragColor = vec4(result, 1.0);
}
`;

export class PixelRenderer {
  /**
   * @param {object} options
   * @param {HTMLCanvasElement} options.canvas
   * @param {number} [options.shadowMapSize]
   */
  constructor({ canvas }) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // ombres nettes, sans filtrage
    this.renderer.info.autoReset = false;

    /** true : pipeline pixel art ; false : rendu 3D brut en pleine résolution (pour comparer). */
    this.pixelArt = true;
    /** Taille d'un pixel d'art en pixels physiques de l'écran. */
    this.pixelSize = 4;
    this.outline = true;

    this.width = 1; // taille de l'image rendue, en pixels d'art
    this.height = 1;
    this.info = { calls: 0, triangles: 0 };
    /** Brume de lointain d'une caméra perspective : début et fin (m). Sans effet en orthographique. */
    this.fog = { near: 0, far: 0 };

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      count: 2,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(1, 1),
      generateMipmaps: false,
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.textures[0] },
        tAux: { value: this.target.textures[1] },
        tDepth: { value: this.target.depthTexture },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uDepthRange: { value: 100 },
        uDepthThreshold: { value: 0.3 },
        uPerspective: { value: 0 },
        uClip: { value: new THREE.Vector2(0.1, 100) },
        uTexelPerDepth: { value: 0.01 },
        uFog: { value: new THREE.Vector2(0, 0) },
        uOutline: { value: 1 },
        uOutlineDarken: { value: 0.5 },
        uOutlineTint: { value: rgb("#2a1d3d") },
        uCreaseLighten: { value: 1.18 },
        uBgTop: { value: rgb("#8fb7d9") },
        uBgBottom: { value: rgb("#cfe3ea") },
        uGrade: { value: new THREE.Vector3(1, 1, 1) },
        uSaturation: { value: 1 },
        uRain: { value: 0 },
        uRainTime: { value: 0 },
      },
      vertexShader: COMPOSITE_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });

    const triangle = new THREE.BufferGeometry();
    triangle.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.compositeMesh = new THREE.Mesh(triangle, this.compositeMaterial);
    this.compositeMesh.frustumCulled = false;
    this.compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this._clearColor = new THREE.Color();
  }

  /** Couleurs du fond (dégradé bas → haut). */
  setBackground(bottom, top = bottom) {
    this.compositeMaterial.uniforms.uBgBottom.value.copy(bottom.isVector3 ? bottom : rgb(bottom));
    this.compositeMaterial.uniforms.uBgTop.value.copy(top.isVector3 ? top : rgb(top));
  }

  /**
   * Ambiance de l'image entière : teinte de l'heure, saturation, pluie. Sans appel, plein jour par beau temps.
   * @param {{grade?: {x: number, y: number, z: number}, saturation?: number, rain?: number, time?: number}} mood
   *   grade : multiplicateur par canal ; rain : 0..1 ; time : secondes (fait tomber la pluie)
   */
  setMood({ grade, saturation, rain, time }) {
    const uniforms = this.compositeMaterial.uniforms;
    if (grade) uniforms.uGrade.value.copy(grade);
    if (saturation !== undefined) uniforms.uSaturation.value = saturation;
    if (rain !== undefined) uniforms.uRain.value = rain;
    if (time !== undefined) uniforms.uRainTime.value = time % 600; // reste petit : précision des téléphones
  }

  /**
   * Adapte le rendu à la taille d'affichage (en pixels CSS). Retourne la taille de l'image en pixels d'art,
   * à passer à la caméra.
   */
  setSize(cssWidth, cssHeight, devicePixelRatio = window.devicePixelRatio || 1) {
    const dpr = Math.min(devicePixelRatio, 3);
    const deviceWidth = Math.max(1, Math.round(cssWidth * dpr));
    const deviceHeight = Math.max(1, Math.round(cssHeight * dpr));
    const size = Math.max(1, Math.round(this.pixelSize));

    // Taille « logique » de la vue en pixels d'art : la même en mode brut, pour garder le même cadrage.
    this.width = Math.ceil(deviceWidth / size);
    this.height = Math.ceil(deviceHeight / size);

    if (this.pixelArt) {
      this.renderer.setSize(this.width, this.height, false);
      this.canvas.style.width = `${(this.width * size) / dpr}px`;
      this.canvas.style.height = `${(this.height * size) / dpr}px`;
      this.canvas.style.imageRendering = "pixelated";
    } else {
      const rawDpr = Math.min(dpr, 2);
      this.renderer.setSize(Math.round(cssWidth * rawDpr), Math.round(cssHeight * rawDpr), false);
      this.canvas.style.width = `${cssWidth}px`;
      this.canvas.style.height = `${cssHeight}px`;
      this.canvas.style.imageRendering = "auto";
    }

    this.target.setSize(this.width, this.height);
    this.compositeMaterial.uniforms.uTexel.value.set(1 / this.width, 1 / this.height);
    this.compositeMaterial.uniforms.uResolution.value.set(this.width, this.height);
    return { width: this.width, height: this.height };
  }

  render(scene, camera) {
    const renderer = this.renderer;
    const uniforms = this.compositeMaterial.uniforms;
    renderer.info.reset();

    if (this.pixelArt) {
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);

      // Le seuil de contour suit la taille d'un pixel dans le monde (surfaces vues en biais).
      uniforms.uDepthRange.value = camera.far - camera.near;
      uniforms.uClip.value.set(camera.near, camera.far);
      if (camera.isPerspectiveCamera) {
        // Taille d'un pixel par mètre de profondeur ; seuil plancher plus fin qu'en isométrique : de près, un
        // pixel ne couvre que quelques millimètres.
        uniforms.uPerspective.value = 1;
        uniforms.uTexelPerDepth.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / camera.zoom / this.height;
        uniforms.uDepthThreshold.value = 0.06;
        uniforms.uFog.value.set(this.fog.near, this.fog.far);
      } else {
        const texelWorld = (camera.top - camera.bottom) / camera.zoom / this.height;
        uniforms.uPerspective.value = 0;
        uniforms.uDepthThreshold.value = Math.max(0.22, texelWorld * 3.5);
        uniforms.uFog.value.set(0, 0);
      }
      uniforms.uOutline.value = this.outline ? 1 : 0;

      this.info.calls = renderer.info.render.calls;
      this.info.triangles = renderer.info.render.triangles;

      renderer.setRenderTarget(null);
      renderer.render(this.compositeMesh, this.compositeCamera);
    } else {
      const bg = uniforms.uBgBottom.value;
      renderer.setRenderTarget(null);
      renderer.setClearColor(this._clearColor.setRGB(bg.x, bg.y, bg.z, THREE.LinearSRGBColorSpace), 1);
      renderer.clear();
      renderer.render(scene, camera);
      this.info.calls = renderer.info.render.calls;
      this.info.triangles = renderer.info.render.triangles;
    }
  }

  dispose() {
    this.target.depthTexture.dispose();
    this.target.dispose();
    this.compositeMaterial.dispose();
    this.compositeMesh.geometry.dispose();
    this.renderer.dispose();
  }
}
