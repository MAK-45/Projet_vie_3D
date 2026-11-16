// Roche enterrée : une dalle de pierre à facettes qui affleure, inclinée, à moitié prise dans le sol, au milieu
// d'un talus de terre remuée ; mousse ou neige possibles sur le dessus. Entièrement procédural, 2 ou 3 draw calls, environ 440 triangles.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildRock, mergeGeometries, splitFacesByNormal } from "../../kit/geometry.js";
import { COVERS, GROUNDS, STONES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { coverParam, numberParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change la silhouette : dalle plate ou bosse, inclinaison, part qui dépasse, talus de terre."),
  stone: stoneParam("Type de pierre : couleurs et grain."),
  cover: coverParam("Mousse ou neige sur les faces tournées vers le ciel."),
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
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au centre de la roche",
  footprint: { radius: 1.2, height: 0.7 },
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

  // Talus de terre remuée : une ou deux bosses basses et larges, d'où la roche sort.
  rock.computeBoundingBox();
  const box = rock.boundingBox;
  const spanX = Math.max(-box.min.x, box.max.x);
  const spanZ = Math.max(-box.min.z, box.max.z);
  const dirt = [];
  const mounds = shape.int(1, 2);
  for (let i = 0; i < mounds; i++) {
    const k = i === 0 ? 1.12 : shape.range(0.6, 0.8);
    const angle = shape.range(0, Math.PI * 2);
    const shift = i === 0 ? 0 : shape.range(0.3, 0.6);
    dirt.push(
      buildRock(shape, {
        detail: 2,
        lumps: 9,
        lumpSize: 0.3,
        cuts: 2,
        cutDepth: [0.85, 0.95],
        scale: [spanX * k + 0.1, Math.min(0.16, 0.1 * p.size) + 0.04, spanZ * k + 0.1],
        rotation: [0, 0, 0],
        offset: [Math.cos(angle) * spanX * shift, -0.04, Math.sin(angle) * spanZ * shift],
        floorY: FLOOR,
      }),
    );
  }

  const group = new THREE.Group();
  group.name = meta.name;

  let stoneGeometry = rock;
  if (p.cover !== "bare") {
    const threshold = p.cover === "snow" ? 0.7 : 0.8;
    const salt = detail.range(0, 100);
    const [covered, rest] = splitFacesByNormal(
      rock,
      (normal, center) => normal.y + 0.4 * (patch(center, salt) - 0.5) > threshold && center.y > 0.06,
    );
    stoneGeometry = rest;
    const cover = COVERS[p.cover];
    const coverMesh = new THREE.Mesh(
      covered,
      createToonMaterial({ ramp: cover.ramp, ink: cover.ink, pattern: "speckle", seed: detail.int(0, 96), id: 11 }),
    );
    coverMesh.name = p.cover;
    coverMesh.castShadow = true;
    coverMesh.receiveShadow = true;
    group.add(coverMesh);
  }

  const stoneMesh = new THREE.Mesh(
    stoneGeometry,
    createToonMaterial({ ramp: stone.ramp, ink: stone.ink, steps: [0.36, 0.58, 0.8], crease: true, pattern: "speckle", patternParams: [16, 0.05, 0.2, 1], seed: detail.int(0, 96), id: 10 }),
  );
  stoneMesh.name = "stone";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);

  if (dirt.length) {
    const ground = p.cover === "snow" ? COVERS.snow : GROUNDS.dirt;
    const dirtMesh = new THREE.Mesh(
      mergeGeometries(dirt),
      createToonMaterial({ ramp: ground.ramp, ink: ground.ink, pattern: "speckle", seed: detail.int(0, 96), id: 12 }),
    );
    dirtMesh.name = "dirt";
    dirtMesh.receiveShadow = true;
    group.add(dirtMesh);
  }

  group.userData.asset = { id: meta.id, params: p };
  return group;
}

/** Bruit déterministe par face (0..1) : rend la mousse et la neige irrégulières. */
function patch(center, salt) {
  const v = Math.sin(center.x * 12.9898 + center.y * 78.233 + center.z * 37.719 + salt) * 43758.5453;
  return v - Math.floor(v);
}
