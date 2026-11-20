// Poussière en suspension près des lampes (intérieurs : le Complexe). Quelques grains d'un pixel, couleur de braise,
// qui dérivent lentement dans le cône de lumière sous chaque lampe allumée et scintillent. Un seul maillage (1 draw
// call) de formes face caméra, sans contour ; les positions sont recalculées à la cadence du décor (12 images/s),
// d'après le temps seulement (aucun état qui dérive), et seulement pour les lampes proches du point regardé.

import * as THREE from "three";
import { buildSpriteGeometry } from "../assets/kit/geometry.js";
import { createRng } from "../assets/kit/rng.js";
import { createToonMaterial, sharedUniforms } from "../engine/toon-material.js";

// Braise sombre, ambre, ambre clair : la forme prend la couleur que choisit son « occlusion ».
const COLORS = ["#7a3c16", "#c97a2e", "#f2b764"];
const SHADES = [0.15, 0.5, 0.85];
const SPECK = { points: [[-1, -1], [1, -1], [1, 1], [-1, 1]], triangles: [0, 1, 2, 0, 2, 3] };
const TAU = Math.PI * 2;
const SIZE = 0.032; // demi-côté d'un grain (m) : un pixel d'art au zoom 1

/**
 * @param {Array<{position: THREE.Vector3, on?: boolean, dust?: number}>} sources lampes (`on` faux : éteinte, pas de
 *   poussière ; `dust` : nombre de grains, sinon `perLamp`)
 * @param {object} [options]
 * @param {number} [options.perLamp] grains par lampe
 * @param {number} [options.lamps] lampes servies à la fois (les plus proches du point regardé)
 * @param {number} [options.spread] rayon du nuage de grains (m)
 * @param {number} [options.depth] hauteur du nuage sous la source (m)
 */
export function createLampDust(sources, { perLamp = 10, lamps = 6, spread = 0.85, depth = 1.7 } = {}) {
  const rng = createRng(7331);
  const slots = Math.min(lamps, sources.length);
  const grains = [];
  const sprites = [];
  const origin = new THREE.Vector3();
  for (let s = 0; s < slots; s++) {
    for (let i = 0; i < perLamp; i++) {
      grains.push({
        slot: s,
        angle: rng.range(0, TAU),
        distance: Math.sqrt(rng.next()) * spread,
        height: rng.range(-depth, 0.25),
        speed: rng.range(0.25, 0.6),
        phase: rng.range(0, TAU),
        drift: rng.range(0.08, 0.22),
      });
      sprites.push({ position: origin, ...SPECK, size: SIZE, occlusion: SHADES[rng.int(0, 2)], phase: rng.next(), flex: 1 });
    }
  }
  const geometry = buildSpriteGeometry(sprites.length ? sprites : [{ position: origin, ...SPECK, size: 0 }]);
  const positions = geometry.attributes.position;
  const corners = geometry.attributes.aCorner;
  positions.setUsage(THREE.DynamicDrawUsage);
  corners.setUsage(THREE.DynamicDrawUsage);
  const rest = corners.array.slice();
  const material = createToonMaterial({ ramp: COLORS, steps: [0.33, 0.66], foliage: true, unlit: true, leafShade: [0, 1], twinkle: 0.5, id: 43, outline: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "lamp dust";
  mesh.frustumCulled = false; // les positions changent à chaque image
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
      const beat = sharedUniforms.uTime.value; // temps saccadé, comme le reste du décor
      if (beat === lastBeat && !camera?.isPerspectiveCamera) return;
      lastBeat = beat;
      const perspective = Boolean(camera?.isPerspectiveCamera);
      // Taille d'un pixel d'art par mètre de distance (image d'environ 300 pixels de haut).
      const perMeter = perspective ? (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / 300 : 0;
      // Deux fois par seconde : les lampes servies sont les plus proches parmi les allumées.
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
        const wanted = source ? (source.dust ?? perLamp) : 0;
        const visible = source && g % perLamp < wanted;
        // Lente dérive en boucle : le grain tourne autour de l'axe de la lampe et monte, redescend.
        const a = grain.angle + beat * grain.drift;
        const r = grain.distance * (0.8 + 0.2 * Math.sin(beat * grain.speed + grain.phase));
        const x = source ? source.position.x + Math.cos(a) * r : 0;
        const z = source ? source.position.z + Math.sin(a) * r : 0;
        const y = source ? source.position.y + grain.height + Math.sin(beat * grain.speed * 0.7 + grain.phase * 2) * 0.18 : 0;
        let scale = visible ? 1 : 0;
        if (perspective && visible) {
          const d = Math.hypot(x - camera.position.x, y - camera.position.y, z - camera.position.z);
          scale = Math.min(1, (d * perMeter * 0.8) / SIZE);
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
    },
  };
}
