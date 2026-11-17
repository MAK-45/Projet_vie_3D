// Rocher posé : un bloc de pierre à facettes franches, assis sur le sol, avec parfois quelques cailloux à son
// pied. Mousse ou neige drapées sur le dessus et posées au sol autour, avec les mêmes générateurs que les assets
// « Tapis de mousse » et « Plaque de neige » (kit/ground-cover.js). Entièrement procédural, 1 ou 2 draw calls.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildRock, mergeGeometries } from "../../kit/geometry.js";
import { coverMaterial, mossCap, mossMound, snowCap, snowMound } from "../../kit/ground-cover.js";
import { STONES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { coverParam, numberParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change la silhouette : rond, haut ou trapu, facettes, inclinaison, cailloux au pied."),
  stone: stoneParam("Type de pierre : couleurs et grain.", { only: ["granite", "sandstone", "limestone", "basalt", "slate"] }),
  cover: coverParam("Mousse ou neige drapées sur le dessus du rocher, et posées au sol autour."),
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
  version: 2,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au centre du rocher",
  footprint: { radius: 1.9, height: 1.2 },
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
  const rock = mergeGeometries(parts);

  // Couverture : drapée sur la pierre, plus des plaques au sol autour du pied.
  if (p.cover !== "bare") {
    const cover = createRng(p.seed * 31337 + 5);
    const noise = createNoise3(p.seed + 101);
    const layers = [];
    if (p.cover === "snow") {
      layers.push(snowCap(rock, noise, { amount: -0.15, thickness: 0.07 * Math.min(1.5, h), minY: h * 0.15 }));
      layers.push(
        snowMound(cover, noise, {
          radius: [width * 1.5, depth * 1.5],
          height: 0.1 * Math.min(1.5, h),
          rotation: cover.range(0, Math.PI * 2),
          drifts: cover.int(1, 2),
        }),
      );
    } else {
      layers.push(mossCap(rock, noise, { amount: 0, minY: h * 0.12 }));
      const patches = cover.int(0, 2);
      for (let i = 0; i < patches; i++) {
        const angle = cover.range(0, Math.PI * 2);
        const r = width * cover.range(0.35, 0.6);
        const reach = width * cover.range(0.7, 1.0);
        layers.push(
          mossMound(cover, noise, {
            radius: [r, r * cover.range(0.6, 0.9)],
            height: 0.035,
            cushions: cover.int(2, 4),
            offset: [Math.cos(angle) * reach, 0, Math.sin(angle) * reach * (depth / width)],
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
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
