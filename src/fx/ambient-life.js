// Vie d'ambiance d'un pré : des papillons qui volettent de fleur en fleur et des graines qui dérivent dans le vent.
// Tout tient dans un seul maillage (1 draw call) de formes face caméra, lumineuses et sans contour ; seules les
// positions sont recalculées, pour quelques dizaines de formes, autour du promeneur.

import * as THREE from "three";
import { buildSpriteGeometry } from "../assets/kit/geometry.js";
import { createRng } from "../assets/kit/rng.js";
import { createToonMaterial, sharedUniforms } from "../engine/toon-material.js";

// Rampe lue directement par l'« occlusion » de chaque forme : bleu, orangé, jaune, blanc (papillons), crème (graines).
const COLORS = ["#4a78e0", "#f08a2c", "#f7d63c", "#fffdf4", "#fff7cf"];
const WINGS = { points: [[0, 0], [-1, 0.8], [-0.85, -0.5], [1, 0.8], [0.85, -0.5]], triangles: [0, 1, 2, 0, 4, 3] };
const SPECK = { points: [[-1, -1], [1, -1], [1, 1], [-1, 1]], triangles: [0, 1, 2, 0, 2, 3] };
const TAU = Math.PI * 2;

/**
 * @param {{butterflies?: number, motes?: number}} [options]
 */
export function createAmbientLife({ butterflies = 12, motes = 40 } = {}) {
  const rng = createRng(4242);
  const origin = new THREE.Vector3();
  const sprites = [];
  const flyers = [];
  for (let i = 0; i < butterflies; i++) {
    sprites.push({ position: origin, ...WINGS, size: rng.range(0.11, 0.15), occlusion: 0.1 + 0.2 * rng.int(0, 3), phase: rng.next() });
    flyers.push({ x: 0, y: 0, z: 0, targetX: 0, targetZ: 0, rest: 0, phase: rng.range(0, TAU), speed: rng.range(0.9, 1.6), lift: rng.range(0.5, 1.3) });
  }
  const drifters = [];
  for (let i = 0; i < motes; i++) {
    sprites.push({ position: origin, ...SPECK, size: 0.034, occlusion: 0.9, phase: rng.next(), flex: 1 });
    drifters.push({ x: rng.range(-1, 1), z: rng.range(-1, 1), height: rng.range(0.3, 3.2), phase: rng.range(0, TAU), speed: rng.range(0.5, 1.1) });
  }
  const geometry = buildSpriteGeometry(sprites);
  const positions = geometry.attributes.position;
  const corners = geometry.attributes.aCorner;
  positions.setUsage(THREE.DynamicDrawUsage);
  corners.setUsage(THREE.DynamicDrawUsage);
  const restCorners = corners.array.slice();
  const WING_VERTICES = WINGS.points.length;
  const SPECK_VERTICES = SPECK.points.length;

  const material = createToonMaterial({ ramp: COLORS, steps: [0.2, 0.4, 0.6, 0.8], foliage: true, unlit: true, leafShade: [0, 1], id: 41, outline: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "ambient life";
  mesh.frustumCulled = false; // les positions changent à chaque image
  const group = new THREE.Group();
  group.name = "ambient life";
  group.add(mesh);

  let world = null;
  let radius = 14;
  const retarget = (flyer, reach) => {
    const angle = rng.range(0, TAU);
    const distance = rng.range(1, reach);
    flyer.targetX = THREE.MathUtils.clamp(flyer.x + Math.cos(angle) * distance, world.bounds.minX + 1, world.bounds.maxX - 1);
    flyer.targetZ = THREE.MathUtils.clamp(flyer.z + Math.sin(angle) * distance, world.bounds.minZ + 1, world.bounds.maxZ - 1);
  };
  const respawn = (flyer, center) => {
    const angle = rng.range(0, TAU);
    const distance = rng.range(0.25, 1) * radius;
    flyer.x = THREE.MathUtils.clamp(center.x + Math.cos(angle) * distance, world.bounds.minX + 1, world.bounds.maxX - 1);
    flyer.z = THREE.MathUtils.clamp(center.z + Math.sin(angle) * distance, world.bounds.minZ + 1, world.bounds.maxZ - 1);
    retarget(flyer, 5);
  };

  return {
    group,
    /** Repart d'un monde neuf : tout le monde autour du promeneur. */
    reset(nextWorld, center) {
      world = nextWorld;
      for (const flyer of flyers) respawn(flyer, center);
    },
    /**
     * @param {number} dt secondes depuis l'image précédente
     * @param {number} time temps écoulé (s)
     * @param {THREE.Vector3} center position du promeneur
     * @param {number} viewRadius demi-diagonale de la zone vue (m)
     */
    update(dt, time, center, viewRadius) {
      if (!world) return;
      radius = THREE.MathUtils.clamp(viewRadius, 9, 24);
      const beat = sharedUniforms.uTime.value; // temps saccadé (12 images par seconde), comme le vent
      let vertex = 0;

      for (const flyer of flyers) {
        if (Math.hypot(flyer.x - center.x, flyer.z - center.z) > radius + 8) respawn(flyer, center);
        const dx = flyer.targetX - flyer.x;
        const dz = flyer.targetZ - flyer.z;
        const distance = Math.hypot(dx, dz);
        let hover = flyer.lift;
        if (flyer.rest > 0) {
          // Posé sur une fleur : ailes lentes.
          flyer.rest -= dt;
          hover = 0.42;
          if (flyer.rest <= 0) retarget(flyer, 6);
        } else if (distance < 0.25) {
          flyer.rest = rng.range(1.2, 4);
        } else {
          // Vol en zigzag : la direction oscille autour du cap.
          const sway = Math.sin(time * 3.1 + flyer.phase) * 0.9;
          const cos = Math.cos(sway);
          const sin = Math.sin(sway);
          const step = Math.min(distance, flyer.speed * dt);
          flyer.x += ((dx * cos - dz * sin) / distance) * step;
          flyer.z += ((dx * sin + dz * cos) / distance) * step;
          hover += Math.sin(time * 1.7 + flyer.phase) * 0.3 + Math.sin(time * 9 + flyer.phase * 3) * 0.08;
        }
        flyer.y += (world.heightAt(flyer.x, flyer.z) + hover - flyer.y) * Math.min(1, dt * 4);
        // Battement : ailes ouvertes ou refermées, à la cadence du décor.
        const closed = Math.floor(beat * (flyer.rest > 0 ? 2.5 : 12) + flyer.phase) % 2 === 1;
        for (let k = 0; k < WING_VERTICES; k++, vertex++) {
          positions.setXYZ(vertex, flyer.x, flyer.y, flyer.z);
          corners.setX(vertex, restCorners[vertex * 3] * (closed ? 0.3 : 1));
        }
      }

      // Graines : elles dérivent dans le vent et bouclent dans un carré centré sur le promeneur.
      const wind = sharedUniforms.uWindDir.value;
      const strength = sharedUniforms.uWindStrength.value;
      for (const drifter of drifters) {
        drifter.x += (wind.x * drifter.speed * strength * dt) / radius;
        drifter.z += (wind.y * drifter.speed * strength * dt) / radius;
        if (drifter.x > 1) drifter.x -= 2;
        if (drifter.z > 1) drifter.z -= 2;
        const x = center.x + drifter.x * radius + Math.sin(time * 0.7 + drifter.phase) * 0.4;
        const z = center.z + drifter.z * radius + Math.cos(time * 0.6 + drifter.phase) * 0.4;
        const y = world.heightAt(x, z) + drifter.height + Math.sin(time * 0.9 + drifter.phase * 2) * 0.25;
        for (let k = 0; k < SPECK_VERTICES; k++, vertex++) positions.setXYZ(vertex, x, y, z);
      }
      positions.needsUpdate = true;
      corners.needsUpdate = true;
    },
    dispose() {
      geometry.dispose();
      material.userData.depthMaterial?.dispose();
      material.dispose();
    },
  };
}
