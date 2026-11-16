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
uniform float uOutline;      // 0 ou 1
uniform float uOutlineDarken;
uniform vec3 uOutlineTint;
uniform float uCreaseLighten;
uniform vec3 uBgTop;
uniform vec3 uBgBottom;
uniform vec2 uResolution;
varying vec2 vUv;

float bayer4(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int index = i.x + i.y * 4;
  float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  return (m[index] + 0.5) / 16.0;
}

vec3 viewNormal(vec4 aux) {
  vec2 n = aux.xy * 2.0 - 1.0;
  return vec3(n, sqrt(max(0.0, 1.0 - dot(n, n))));
}

void main() {
  vec4 color = texture(tColor, vUv);
  vec4 aux = texture(tAux, vUv);
  float depth = texture(tDepth, vUv).r * uDepthRange;

  if (color.a < 0.5) {
    // Fond : dégradé vertical en paliers, tramé (Bayer 4×4).
    float steps = 5.0;
    float t = vUv.y * steps;
    float band = floor(t) + step(bayer4(gl_FragCoord.xy), fract(t));
    gl_FragColor = vec4(mix(uBgBottom, uBgTop, clamp(band / steps, 0.0, 1.0)), 1.0);
    return;
  }

  float edge = 0.0;
  float crease = 0.0;
  float hasCrease = step(color.a, 0.9);
  float inked = step(0.7, color.a); // une matière peut refuser le contour (alpha 0,6 : pollen, papillons)
  vec3 n = viewNormal(aux);
  // Voisins : droite, gauche, haut, bas. Le voisin opposé sert à reconnaître une surface plane vue en biais,
  // dont la profondeur change régulièrement d'un pixel à l'autre sans qu'il y ait de bord.
  vec2 offsets[4] = vec2[4](vec2(1.0, 0.0), vec2(-1.0, 0.0), vec2(0.0, 1.0), vec2(0.0, -1.0));
  vec4 auxNear[4];
  float depthNear[4];
  for (int i = 0; i < 4; i++) {
    vec2 uv = vUv + offsets[i] * uTexel;
    auxNear[i] = texture(tAux, uv);
    depthNear[i] = texture(tDepth, uv).r * uDepthRange;
  }
  for (int i = 0; i < 4; i++) {
    vec4 auxN = auxNear[i];
    float diff = depthNear[i] - depth;
    float slope = max(depth - depthNear[i ^ 1], 0.0); // pente déjà présente de l'autre côté
    float otherId = step(0.002, abs(auxN.a - aux.a));
    // Entre deux parties du même objet, le matériau peut demander un seuil plus large (feuillage).
    float threshold = mix(max(uDepthThreshold, max(aux.z, auxN.z) * 4.0), uDepthThreshold, otherId);
    // Contour intérieur : on assombrit le pixel de l'objet le plus proche de la caméra.
    edge = max(edge, step(threshold, diff - slope));
    edge = max(edge, otherId * step(auxN.a, aux.a) * step(-uDepthThreshold, diff));
    // Arête vive d'un même objet : liseré clair du côté tourné vers le haut-gauche.
    vec3 nN = viewNormal(auxN);
    float sameSurface = (1.0 - otherId) * step(abs(diff - slope), uDepthThreshold);
    float turned = step(0.35, 1.0 - dot(n, nN)) * step(0.0, dot(n - nN, vec3(-0.6, 1.0, 0.6)));
    crease = max(crease, sameSurface * turned * hasCrease);
  }

  vec3 result = color.rgb;
  result = mix(result, min(result * uCreaseLighten, vec3(1.0)), crease * uOutline);
  vec3 outline = mix(result * uOutlineDarken, uOutlineTint, 0.3);
  result = mix(result, outline, edge * uOutline * inked);
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
        uOutline: { value: 1 },
        uOutlineDarken: { value: 0.5 },
        uOutlineTint: { value: rgb("#2a1d3d") },
        uCreaseLighten: { value: 1.18 },
        uBgTop: { value: rgb("#8fb7d9") },
        uBgBottom: { value: rgb("#cfe3ea") },
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
    this.compositeMaterial.uniforms.uBgBottom.value.copy(rgb(bottom));
    this.compositeMaterial.uniforms.uBgTop.value.copy(rgb(top));
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
      const texelWorld = (camera.top - camera.bottom) / camera.zoom / this.height;
      uniforms.uDepthRange.value = camera.far - camera.near;
      uniforms.uDepthThreshold.value = Math.max(0.22, texelWorld * 3.5);
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
