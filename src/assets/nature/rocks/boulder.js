// Rocher posé : un bloc de pierre à facettes franches, assis sur le sol, avec parfois quelques cailloux à son
// pied ; mousse ou neige possibles sur le dessus. Entièrement procédural, 1 ou 2 draw calls, environ 140 triangles.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildRock, mergeGeometries, splitFacesByNormal } from "../../kit/geometry.js";
import { COVERS, STONES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { coverParam, numberParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change la silhouette : rond, haut ou trapu, facettes, inclinaison, cailloux au pied."),
  stone: stoneParam("Type de pierre : couleurs et grain."),
  cover: coverParam("Mousse ou neige sur les faces tournées vers le ciel."),
  size: numberParam("Hauteur", 1.1, 0.4, 2.5, "Hauteur du rocher ; tout garde ses proportions.", { step: 0.1, unit: "m" }),
  roughness: numberParam("Taille de la pierre", 1, 0, 1.5, "0 = galet arrondi, 1,5 = bloc très taillé."),
};

export const meta = {
  id: "nature/rocks/boulder",
  name: "Rocher posé",
  nameEn: "Boulder",
  category: "nature",
  subcategory: "rocks",
  description:
    "Rocher à facettes posé sur le sol, parfois accompagné de cailloux. Cinq pierres (granit, grès, calcaire, " +
    "basalte, ardoise), nu, moussu ou enneigé ; chaque graine donne une autre silhouette.",
  tags: [
    "rocher", "roche", "pierre", "bloc", "caillou", "minéral", "facettes", "posé", "mousse", "neige", "extérieur",
    "boulder", "rock", "stone", "pebble", "mineral", "faceted", "moss", "snow", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "mountain", "desert", "snow", "beach", "cave", "garden", "village", "swamp"],
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au centre du rocher",
  footprint: { radius: 1.4, height: 1.1 },
  animated: [],
  params,
  variants: variantsOf("stone", params.stone),
};

/**
 * Crée un rocher posé sur le sol.
 * @param {{seed?: number, stone?: string, cover?: "bare"|"moss"|"snow", size?: number, roughness?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const stone = STONES[p.stone];
  const h = p.size;
  const rough = p.roughness;

  // Silhouette : galet trapu, bloc haut ou dalle large selon la graine, de profil asymétrique.
  const half = h / 2;
  const width = half * shape.range(0.95, 1.9);
  const depth = width * shape.range(0.6, 0.95);
  const sink = 0.12 * h; // assise : le bas s'écrase sur le sol
  const parts = [
    buildRock(shape, {
      detail: 1,
      lumps: 4,
      lumpSize: 0.14,
      cuts: Math.round(4 + 5 * rough),
      cutDepth: [0.82 - 0.22 * rough, 0.95 - 0.1 * rough],
      scale: [width, half + sink / 2, depth],
      rotation: [shape.range(-0.25, 0.25), shape.range(0, Math.PI * 2), shape.range(-0.25, 0.25)],
      offset: [0, half - sink / 2, 0],
      floorY: -0.02,
    }),
  ];

  // Cailloux au pied (0 à 3).
  const pebbles = shape.int(0, 3);
  for (let i = 0; i < pebbles; i++) {
    const angle = shape.range(0, Math.PI * 2);
    const r = shape.range(0.12, 0.22) * Math.max(1, h);
    const distance = width * shape.range(0.95, 1.15) + r;
    parts.push(
      buildRock(shape, {
        detail: 0,
        lumps: 2,
        lumpSize: 0.15,
        cuts: 3,
        cutDepth: [0.7, 0.9],
        scale: [r, r * shape.range(0.5, 0.8), r * shape.range(0.8, 1.1)],
        rotation: [0, shape.range(0, Math.PI * 2), 0],
        offset: [Math.cos(angle) * distance, r * 0.4, Math.sin(angle) * distance * (depth / width)],
        floorY: -0.02,
      }),
    );
  }

  const group = new THREE.Group();
  group.name = meta.name;
  addStoneAndCover(group, mergeGeometries(parts), stone, p.cover, detail, h);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

/** Pierre + couverture (mousse, neige) sur les faces tournées vers le ciel. */
function addStoneAndCover(group, geometry, stone, cover, detail, height) {
  let stoneGeometry = geometry;
  if (cover !== "bare") {
    const threshold = cover === "snow" ? 0.62 : 0.72;
    const salt = detail.range(0, 100);
    const [covered, rest] = splitFacesByNormal(geometry, (normal, center) =>
      normal.y + 0.35 * (patch(center, salt) - 0.5) > threshold && center.y > height * 0.3,
    );
    stoneGeometry = rest;
    const coverMesh = new THREE.Mesh(
      covered,
      createToonMaterial({ ramp: COVERS[cover].ramp, ink: COVERS[cover].ink, pattern: "speckle", seed: detail.int(0, 96), id: 11 }),
    );
    coverMesh.name = cover;
    coverMesh.castShadow = true;
    coverMesh.receiveShadow = true;
    group.add(coverMesh);
  }
  const stoneMesh = new THREE.Mesh(
    stoneGeometry,
    createToonMaterial({
      ramp: stone.ramp,
      ink: stone.ink,
      steps: [0.36, 0.58, 0.8],
      patternParams: [16, 0.05, 0.2, 1],
      crease: true,
      pattern: "speckle",
      seed: detail.int(0, 96),
      id: 10,
    }),
  );
  stoneMesh.name = "stone";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
}

/** Bruit déterministe par face (0..1) : rend la mousse et la neige irrégulières. */
function patch(center, salt) {
  const v = Math.sin(center.x * 12.9898 + center.y * 78.233 + center.z * 37.719 + salt) * 43758.5453;
  return v - Math.floor(v);
}
