// Soleil : disque lumineux en anneaux concentriques (halo, disque, cœur, reflet) entouré de rayons qui pulsent
// doucement. Toujours face à la caméra, insensible à la lumière et aux ombres. Entièrement procédural, 1 draw call.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildFanGeometry, buildSpriteGeometry, ellipseOutline, mergeGeometries } from "../../kit/geometry.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

// Rampes de l'ombre vers la lumière : halo, rayons, disque, cœur, reflet.
const TIMES = {
  noon: { label: "Midi", ramp: ["#e8762c", "#f9a93a", "#ffd34e", "#ffef8f", "#fffbe6"], rays: 1, stretch: [1, 1] },
  dawn: { label: "Aube", ramp: ["#d0576f", "#f08b6c", "#ffbc7c", "#ffe0a3", "#fff5de"], rays: 0.8, stretch: [1, 1] },
  dusk: { label: "Couchant", ramp: ["#a8323f", "#dc552f", "#f78d2f", "#ffc14c", "#ffe58c"], rays: 0.55, stretch: [1.07, 0.93] },
};

const params = {
  seed: seedParam("Change la couronne : nombre de rayons, alternance longs et courts, rayons pointus ou carrés, inclinaison."),
  time: choiceParam("Moment", TIMES, "Couleur du soleil : blanc-jaune à midi, rose doré à l'aube, rouge orangé et rayons courts au couchant."),
  size: numberParam("Diamètre", 3, 1.5, 5, "Diamètre du disque (sans les rayons).", { step: 0.25, unit: "m" }),
};

export const meta = {
  id: "nature/sky/sun",
  name: "Soleil",
  nameEn: "Sun",
  category: "nature",
  subcategory: "sky",
  description:
    "Soleil en pixel art : disque en anneaux concentriques du halo au reflet, couronne de rayons qui pulsent. " +
    "Toujours face à la caméra et lumineux par lui-même ; midi, aube ou couchant ; la graine change la couronne.",
  tags: [
    "soleil", "astre", "ciel", "lumière", "jour", "rayons", "lumineux", "couchant", "aube", "extérieur",
    "sun", "celestial", "sky", "light", "day", "rays", "glowing", "sunset", "dawn", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "garden", "village", "desert", "snow", "swamp", "beach", "mountain"],
  version: 1,
  added: "2026-11-16",
  units:
    "1 unité = 1 mètre (taille de présentation : un monde l'agrandit et le place loin) ; l'origine est au sol, " +
    "le disque flotte juste au-dessus",
  footprint: { radius: 2.5, height: 5.4 },
  animated: ["pulse"],
  params,
  variants: variantsOf("time", params.time),
};

const TAU = Math.PI * 2;

/**
 * Crée un soleil.
 * @param {{seed?: number, time?: "noon"|"dawn"|"dusk", size?: number}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.asset` décrit l'asset créé
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const time = TIMES[p.time];
  const shape = createRng(p.seed * 7919 + 17);
  const radius = p.size / 2;

  // --- Couronne : rayons en étoile, alternés longs et courts, pointus ou à bout carré.
  const rayCount = 8 + 2 * shape.int(0, 3); // 8, 10, 12 ou 14
  const alternate = shape.chance(0.6);
  const pointed = shape.chance(0.6);
  const baseLength = shape.range(0.38, 0.55) * time.rays;
  const width = shape.range(0.16, 0.24) * (12 / rayCount) ** 0.5;
  const start = shape.range(0, TAU);
  const reach = radius * (1.12 + baseLength * (alternate ? 1 : 0.85) + 0.05);
  const center = new THREE.Vector3(0, reach + 0.7, 0);

  const sprites = [];
  for (let i = 0; i < rayCount; i++) {
    const long = !alternate || i % 2 === 0;
    const length = baseLength * (long ? 1 : 0.55) * shape.range(0.9, 1.1);
    const inner = 0.98; // pied caché sous le halo
    const outer = 1.12 + length;
    const w = width * (long ? 1 : 0.8);
    const points = pointed
      ? [[-w, inner], [w, inner], [0, outer]]
      : [[-w, inner], [w, inner], [w * 0.75, outer], [-w * 0.75, outer]];
    sprites.push({
      position: center,
      points,
      triangles: pointed ? [0, 1, 2] : [0, 1, 2, 0, 2, 3],
      size: radius,
      rotation: start + (i / rayCount) * TAU - Math.PI / 2,
      occlusion: 0.3,
      phase: (i % 2) * 0.5,
      flex: 0.06,
    });
  }
  const rays = buildSpriteGeometry(sprites);

  // --- Disque : anneaux concentriques, du halo sombre au reflet clair décalé vers le haut à gauche.
  const [sx, sy] = time.stretch;
  const tilt = shape.range(-0.3, 0.3);
  const rings = [
    { scale: 1.12, occlusion: 0.1, lift: 0.01, offset: [0, 0] },
    { scale: 1, occlusion: 0.5, lift: 0.02, offset: [0, 0] },
    { scale: 0.74, occlusion: 0.7, lift: 0.03, offset: [-0.08, 0.08] },
    { scale: 0.26, occlusion: 0.9, lift: 0.04, offset: [-0.3, 0.3] },
  ];
  const fans = rings.map((ring) => ({
    position: center,
    outline: ellipseOutline(ring.scale < 0.5 ? 12 : 24, sx, sy),
    size: radius * ring.scale,
    offset: [ring.offset[0] * radius, ring.offset[1] * radius],
    rotation: tilt,
    normal: new THREE.Vector3(0, 1, 0),
    phase: 0,
    variation: 0.5,
    flex: 0,
    occlusion: ring.occlusion,
    lift: ring.lift,
  }));
  const disc = buildFanGeometry(fans);

  const group = new THREE.Group();
  group.name = meta.name;
  const material = createToonMaterial({
    ramp: time.ramp,
    steps: [0.2, 0.4, 0.6, 0.8],
    foliage: true,
    unlit: true,
    leafShade: [0, 1],
    twinkle: 1,
    id: 20,
  });
  const mesh = new THREE.Mesh(mergeGeometries([rays, disc]), material);
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.boundingSphere.radius += reach;
  mesh.name = "sun";
  group.add(mesh);

  group.userData.asset = { id: meta.id, params: p, rays: rayCount };
  return group;
}
