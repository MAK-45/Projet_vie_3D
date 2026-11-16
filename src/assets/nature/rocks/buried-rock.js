// Roche enterrée : une dalle de pierre à facettes qui affleure, inclinée, à moitié prise dans le sol, au milieu
// d'un talus de terre remuée. Mousse ou neige drapées sur le dessus. Talus, mousse et neige sortent des mêmes
// générateurs que les assets « Terre remuée », « Tapis de mousse » et « Plaque de neige » (kit/ground-cover.js). Entièrement procédural, 2 ou 3 draw calls.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildRock, mergeGeometries } from "../../kit/geometry.js";
import { coverMaterial, dirtMound, mossCap, mossMound, snowCap, snowMound } from "../../kit/ground-cover.js";
import { STONES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { coverParam, numberParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change la silhouette : dalle plate ou bosse, inclinaison, part qui dépasse, talus de terre."),
  stone: stoneParam("Type de pierre : couleurs et grain."),
  cover: coverParam("Mousse ou neige drapées sur le dessus de la roche et sur le talus."),
  size: numberParam("Largeur", 1.6, 0.5, 3.5, "Largeur de la partie visible ; tout garde ses proportions.", { step: 0.1, unit: "m" }),
  emergence: numberParam("Affleurement", 0.5, 0.2, 0.8, "Part de la roche qui sort du sol (0,2 = à peine visible)."),
};

export const meta = {
  id: "nature/rocks/buried-rock",
  name: "Roche enterrée",
  nameEn: "Buried rock",
  category: "nature",
  subcategory: "rocks",
  description:
    "Roche à facettes à moitié enterrée, qui affleure en dalle inclinée au milieu d'un talus de terre. Cinq " +
    "pierres, nue, moussue ou enneigée ; la graine change l'inclinaison et la forme, l'affleurement se règle.",
  tags: [
    "roche", "rocher", "pierre", "dalle", "affleurement", "enterré", "minéral", "terre", "facettes", "mousse", "neige",
    "extérieur", "buried rock", "rock", "stone", "outcrop", "slab", "embedded", "mineral", "dirt", "moss", "snow",
    "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "mountain", "desert", "snow", "garden", "village", "swamp", "cave"],
  version: 2,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au centre de la roche",
  footprint: { radius: 1.7, height: 0.8 },
  animated: [],
  params,
  variants: variantsOf("stone", params.stone),
};

const FLOOR = -0.03;

/**
 * Crée une roche enterrée.
 * @param {{seed?: number, stone?: string, cover?: "bare"|"moss"|"snow", size?: number, emergence?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const stone = STONES[p.stone];

  // Un gros bloc dont on ne voit que le haut : plus il est enterré, plus il est large sous terre.
  const radius = p.size / 2 / Math.sqrt(1 - (1 - p.emergence) ** 2 * 0.8);
  const rx = radius * shape.range(0.9, 1.1);
  const rz = radius * shape.range(0.6, 0.95);
  const ry = radius * shape.range(0.55, 0.85);
  const tiltX = shape.range(-0.45, 0.45);
  const tiltZ = shape.range(-0.45, 0.45);
  const rock = buildRock(shape, {
    detail: 1,
    lumps: 4,
    lumpSize: 0.14,
    cuts: 8,
    cutDepth: [0.6, 0.88],
    scale: [rx, ry, rz],
    rotation: [tiltX, shape.range(0, Math.PI * 2), tiltZ],
    offset: [0, ry * (2 * p.emergence - 1), 0],
    floorY: FLOOR,
  });

  // Talus de terre remuée (même générateur que l'asset « Terre remuée »), d'où la roche sort.
  rock.computeBoundingBox();
  const box = rock.boundingBox;
  const spanX = Math.max(-box.min.x, box.max.x);
  const spanZ = Math.max(-box.min.z, box.max.z);
  const noise = createNoise3(p.seed + 101);
  const talus = dirtMound(shape, noise, {
    radius: [spanX * 1.15 + 0.12, spanZ * 1.15 + 0.12],
    height: Math.min(0.16, 0.08 * p.size) + 0.04,
    clods: shape.int(3, 6),
  });

  const group = new THREE.Group();
  group.name = meta.name;

  // Couverture : drapée sur la roche ; la neige recouvre aussi le talus, la mousse le gagne par plaques.
  if (p.cover !== "bare") {
    const cover = createRng(p.seed * 31337 + 5);
    const layers = [];
    if (p.cover === "snow") {
      layers.push(snowCap(rock, noise, { amount: -0.2, thickness: 0.06, minY: 0.08 }));
      layers.push(
        snowMound(cover, noise, {
          radius: [spanX * 1.3 + 0.15, spanZ * 1.3 + 0.15],
          height: 0.08,
          rotation: cover.range(0, Math.PI * 2),
          drifts: cover.int(0, 2),
        }),
      );
    } else {
      layers.push(mossCap(rock, noise, { amount: 0, minY: 0.04 }));
      const patches = cover.int(1, 2);
      for (let i = 0; i < patches; i++) {
        const angle = cover.range(0, Math.PI * 2);
        const r = spanX * cover.range(0.35, 0.55);
        layers.push(
          mossMound(cover, noise, {
            radius: [r, r * cover.range(0.6, 0.9)],
            height: 0.06,
            cushions: cover.int(2, 4),
            offset: [Math.cos(angle) * spanX * 1.0, 0.04, Math.sin(angle) * spanZ * 1.0],
            rotation: cover.range(0, Math.PI * 2),
          }),
        );
      }
    }
    const coverMesh = new THREE.Mesh(mergeGeometries(layers), coverMaterial(p.cover, undefined, { seed: detail.int(0, 96), id: 11 }));
    coverMesh.name = p.cover;
    coverMesh.castShadow = true;
    coverMesh.receiveShadow = true;
    group.add(coverMesh);
  }

  const stoneMesh = new THREE.Mesh(
    rock,
    createToonMaterial({ ramp: stone.ramp, ink: stone.ink, steps: [0.36, 0.58, 0.8], crease: true, pattern: "speckle", patternParams: [16, 0.05, 0.2, 1], seed: detail.int(0, 96), id: 10 }),
  );
  stoneMesh.name = "stone";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);

  if (p.cover !== "snow") {
    const dirtMesh = new THREE.Mesh(talus, coverMaterial("dirt", "dirt", { seed: detail.int(0, 96), id: 12 }));
    dirtMesh.name = "dirt";
    dirtMesh.receiveShadow = true;
    group.add(dirtMesh);
  } else {
    talus.dispose();
  }

  group.userData.asset = { id: meta.id, params: p };
  return group;
}

