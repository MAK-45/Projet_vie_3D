// Plaque de neige : une congère bombée au contour lobé, parfois doublée de petites congères accolées ; fraîche
// et bleutée à l'ombre, ou tassée et ternie. Même générateur que la neige des rochers (kit/ground-cover.js).
// Entièrement procédural, 1 draw call.

import * as THREE from "three";
import { coverMaterial, snowMound } from "../../kit/ground-cover.js";
import { SNOWS } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change le contour, l'allongement et les congères accolées."),
  snow: choiceParam("Neige", SNOWS, "Fraîche (blanche, ombres bleues) ou tassée (grisée, plus plate)."),
  size: numberParam("Largeur", 1.8, 0.5, 4, "Largeur de la plaque.", { step: 0.1, unit: "m" }),
  depth: numberParam("Épaisseur", 0.3, 0.05, 0.6, "Épaisseur au centre.", { step: 0.05, unit: "m" }),
};

export const meta = {
  id: "nature/terrain/snow-patch",
  name: "Plaque de neige",
  nameEn: "Snow patch",
  category: "nature",
  subcategory: "terrain",
  description:
    "Plaque de neige posée au sol, bombée au contour irrégulier, avec parfois des congères accolées. Neige " +
    "fraîche ou tassée ; la graine change la forme, la largeur et l'épaisseur se règlent.",
  tags: [
    "neige", "plaque de neige", "congère", "sol", "terrain", "hiver", "blanc", "extérieur",
    "snow", "snow patch", "snowdrift", "ground", "winter", "white", "outdoor", "procedural",
  ],
  biomes: ["snow", "mountain", "forest", "meadow", "village"],
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au centre de la plaque",
  footprint: { radius: 0.9, height: 0.4 },
  animated: [],
  params,
  variants: variantsOf("snow", params.snow),
};

/**
 * Crée une plaque de neige.
 * @param {{seed?: number, snow?: "fresh"|"old", size?: number, depth?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const noise = createNoise3(p.seed);
  const half = p.size / 2;
  const stretch = shape.range(0.6, 0.9);
  const height = p.depth * (p.snow === "old" ? 0.7 : 1);

  const mesh = new THREE.Mesh(
    snowMound(shape, noise, {
      radius: [half * 0.8, half * 0.8 * stretch],
      height,
      rotation: shape.range(0, Math.PI * 2),
      drifts: shape.int(1, 3),
    }),
    coverMaterial("snow", p.snow, { seed: detail.int(0, 96), id: 11 }),
  );
  mesh.name = "snow";
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const group = new THREE.Group();
  group.name = meta.name;
  group.add(mesh);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
