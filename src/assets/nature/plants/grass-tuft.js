// Touffe d'herbe : un éventail de brins effilés, sombres au pied et clairs à la pointe, qui ploient au vent.
// En « hautes herbes », des tiges plus longues portent des épis. Brins toujours face à la caméra. 1 draw call.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBladeGeometry, buildFanGeometry, mergeGeometries, starOutline } from "../../kit/geometry.js";
import { GRASSES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seasonParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change le port de la touffe : penchée ou dressée, ouverte ou serrée, brins plus longs d'un côté."),
  season: seasonParam("Vert tendre au printemps, blond en automne, paille grise et couchée en hiver."),
  kind: choiceParam(
    "Herbe",
    { meadow: "Herbe des prés", tall: "Hautes herbes à épis" },
    "Herbe des prés : touffe basse et fournie. Hautes herbes : tiges deux fois plus hautes, avec des épis.",
  ),
  height: numberParam("Hauteur", 0.5, 0.2, 1, "Hauteur des plus longs brins (doublée pour les hautes herbes).", { step: 0.05, unit: "m" }),
  fullness: numberParam("Densité", 1, 0.5, 1.6, "Nombre de brins (et de triangles)."),
};

export const meta = {
  id: "nature/plants/grass-tuft",
  name: "Touffe d'herbe",
  nameEn: "Grass tuft",
  category: "nature",
  subcategory: "plants",
  description:
    "Touffe d'herbe en éventail : brins effilés sombres au pied et clairs à la pointe, qui ploient au vent. " +
    "Herbe des prés ou hautes herbes à épis, quatre saisons ; la graine change le port de la touffe.",
  tags: [
    "herbe", "touffe d'herbe", "brins", "hautes herbes", "épis", "plante", "végétation", "vent", "saisons", "extérieur",
    "grass", "grass tuft", "blades", "tall grass", "seed heads", "plant", "vegetation", "wind", "seasons", "outdoor",
    "procedural",
  ],
  biomes: ["meadow", "forest", "garden", "village", "swamp", "mountain", "beach"],
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au cœur de la touffe",
  footprint: { radius: 0.85, height: 1.35 },
  animated: ["wind"],
  params,
  variants: variantsOf("season", params.season),
};

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const EAR = starOutline(6);

/**
 * Crée une touffe d'herbe.
 * @param {{seed?: number, season?: string, kind?: "meadow"|"tall", height?: number, fullness?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const tall = p.kind === "tall";
  const winter = p.season === "winter";
  const H = p.height * (tall ? 2 : 1) * (winter ? 0.8 : 1);

  // Port de la touffe (graine) : penchée d'un côté, plus ou moins ouverte, plus longue d'un côté.
  const leanAngle = shape.range(0, TAU);
  const lean = new THREE.Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle)).multiplyScalar(shape.range(0, 0.32) * H);
  const spread = shape.range(0.5, 1.05);
  const longSide = shape.range(0, TAU);
  const longBias = shape.range(0, 0.4);
  const footRadius = shape.range(0.05, 0.12) * Math.sqrt(p.height / 0.5);
  const droop = (winter ? 0.55 : 0.18) + shape.range(0, 0.2);

  const blades = [];
  const ears = [];
  const count = Math.round((tall ? 14 : 20) * p.fullness * shape.range(0.85, 1.2));
  for (let i = 0; i < count; i++) {
    const azimuth = i * 2.39996 + shape.range(-0.6, 0.6);
    const out = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const reach = Math.sqrt(shape.next());
    const base = out.clone().multiplyScalar(footRadius * reach);
    // Les brins du bord s'ouvrent, ceux du cœur restent droits et longs.
    const side = 1 + longBias * Math.cos(azimuth - longSide);
    const h = H * side * (1 - 0.4 * reach) * shape.range(0.55, 1) / (1 + longBias) * (tall ? 1.25 : 1);
    const open = (0.15 + spread * reach) * h * shape.range(0.7, 1.3) * (tall ? 0.6 : 1);
    const sag = shape.chance(tall ? 0.6 : droop) ? shape.range(0.25, 0.5) : 0;
    const tip = base.clone().addScaledVector(out, open * (1 + sag)).addScaledVector(UP, h * (1 - sag)).addScaledVector(lean, h / H);
    const bend = base.clone().addScaledVector(out, open * 0.3).addScaledVector(UP, h * 0.75).addScaledVector(lean, (h / H) * 0.4);
    blades.push({
      base,
      bend,
      tip,
      width: shape.range(0.085, 0.12),
      normal: out.clone().addScaledVector(UP, 1.1).normalize(),
      phase: detail.next(),
      variation: detail.next(),
      flex: detail.range(0.35, 0.6),
    });
  }

  // Hautes herbes : quelques tiges fines plus hautes, chacune portant un épi.
  if (tall) {
    const stems = Math.round(shape.int(3, 6) * Math.min(1.3, p.fullness));
    for (let i = 0; i < stems; i++) {
      const azimuth = shape.range(0, TAU);
      const out = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
      const base = out.clone().multiplyScalar(footRadius * shape.range(0, 0.6));
      const h = H * shape.range(1.0, 1.25);
      const tip = base.clone().addScaledVector(out, h * shape.range(0.15, 0.4)).addScaledVector(UP, h).addScaledVector(lean, 1.1);
      const bend = base.clone().addScaledVector(UP, h * 0.6).addScaledVector(lean, 0.4);
      blades.push({
        base, bend, tip, width: 0.06, tipWidth: 0.045,
        normal: out.clone().addScaledVector(UP, 1.1).normalize(),
        phase: detail.next(), variation: detail.next(), flex: 0.7, baseOcclusion: 0.3,
      });
      const direction = tip.clone().sub(bend).normalize();
      ears.push({
        position: tip.clone().addScaledVector(direction, 0.07),
        outline: EAR,
        size: 0.1,
        stretch: [0.45, 1],
        rotation: -Math.atan2(direction.x + direction.z * 0.5, direction.y) * 0.6,
        normal: UP,
        phase: detail.next(),
        variation: 1,
        flex: 0.8,
      });
    }
  }

  const parts = [buildBladeGeometry(blades, { segments: tall ? 3 : 2 })];
  if (ears.length) parts.push(buildFanGeometry(ears));
  const geometry = parts.length > 1 ? mergeGeometries(parts) : parts[0];
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 0.2; // vent

  const material = createToonMaterial({
    ramp: GRASSES[p.season].ramp,
    steps: [0.24, 0.42, 0.6, 0.78],
    foliage: true,
    leafShade: [0.14, 0.5],
    id: 12,
    sway: { amplitude: 0.06 * H, height: H },
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "grass";
  mesh.customDepthMaterial = material.userData.depthMaterial;
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const group = new THREE.Group();
  group.name = meta.name;
  group.add(mesh);
  group.userData.asset = { id: meta.id, params: p, blades: blades.length };
  return group;
}
