// Mer de nuages : l'île flotte dans le ciel. Deux nappes, un seul matériau :
// - la mer, un grand plan sous le niveau du sol, en bancs de nuages modelés par la lumière, qui dérivent au vent ;
// - la brume, un cadre posé juste au-dessus du pré tout autour de l'île, dense au bord et trouée vers
//   l'intérieur : on entre dans le nuage en approchant du bord, et la tranche de l'île disparaît dedans.
//
// Pas de transparence (la passe de contours ne la supporte pas) : la brume est trouée par une trame de points,
// ce qui reste dans le ton du pixel art. Matière sans contour, qui porte sa couleur finale : c'est l'ambiance
// (heure, météo) qui lui donne ses quatre teintes.

import * as THREE from "three";
import { sharedUniforms } from "../../engine/toon-material.js";

const VERTEX = /* glsl */ `
attribute float aMist; // 0 : mer ; sinon densité de la brume en ce sommet
varying vec3 vWorld;
varying float vMist;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vMist = aMist;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAGMENT = /* glsl */ `
layout(location = 1) out highp vec4 gAux;

uniform float uTime;
uniform vec2 uWindDir;
uniform float uWindStrength;
uniform vec3 uColors[4]; // de l'ombre des bancs à leur sommet éclairé
uniform vec3 uHaze;      // couleur de l'horizon, où la mer se fond dans le ciel
uniform vec2 uSun;       // direction horizontale vers l'astre
uniform vec2 uCenter;
uniform float uFade;     // distance au centre où la mer a fini de se fondre dans le ciel (m)
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
    // Brume : des paquets qui passent, plus serrés vers le bord de l'île.
    vec2 p = vWorld.xz * 0.11 - drift * 0.22;
    float puff = billow(p);
    float density = vMist * (0.5 + 1.1 * puff);
    if (density < bayer4(gl_FragCoord.xy) * 0.9 + 0.1) discard;
    color = puff > 0.52 ? uColors[3] : uColors[2];
  } else {
    // Mer : le relief des bancs vient de la pente du bruit du côté de l'astre.
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
`;

/**
 * @param {object} options
 * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} options.bounds emprise de l'île
 * @param {number} [options.seaLevel] hauteur de la mer de nuages (m, sous le sol)
 * @param {number} [options.mistLevel] hauteur de la brume (m, juste au-dessus des bosses du pré)
 * @param {number} [options.inset] largeur de la bande de brume qui mord sur l'île (m)
 */
export function createCloudSea({ bounds, seaLevel = -2.4, mistLevel = 2.4, inset = 9 }) {
  const { minX, maxX, minZ, maxZ } = bounds;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const reach = 520; // la mer se fond dans le ciel bien avant
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

  // Mer : un grand carré.
  quad([[centerX - reach, centerZ - reach], [centerX + reach, centerZ - reach], [centerX + reach, centerZ + reach], [centerX - reach, centerZ + reach]], [seaLevel, seaLevel, seaLevel, seaLevel], [0, 0, 0, 0]);

  // Brume : trois cadres emboîtés et raccordés, de l'intérieur de l'île (rien) au bord (assez dense pour cacher
  // l'arête du terrain) puis au large (rien), où elle retombe vers la mer.
  const rings = [
    { offset: -inset, density: 0.001, y: mistLevel },
    { offset: -1.5, density: 1.5, y: mistLevel },
    { offset: 8, density: 1.5, y: mistLevel - 0.8 },
    { offset: 28, density: 0.001, y: mistLevel - 2.2 },
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aMist", new THREE.Float32BufferAttribute(mist, 1));
  geometry.setIndex(index);

  const material = new THREE.ShaderMaterial({
    name: "CloudSea",
    side: THREE.DoubleSide,
    uniforms: {
      ...sharedUniforms,
      uColors: { value: ["#93a7d6", "#c3cfec", "#e9eef8", "#ffffff"].map((hex) => new THREE.Color(hex)).map((c) => new THREE.Vector3(c.r, c.g, c.b)) },
      uHaze: { value: new THREE.Vector3(0.86, 0.94, 0.91) },
      uSun: { value: new THREE.Vector2(0, 1) },
      uCenter: { value: new THREE.Vector2(centerX, centerZ) },
      uFade: { value: reach * 0.9 },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
  const mesh = new THREE.Mesh(geometry, material);
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
    },
  };
}
