// Terre remuée : une butte de terre à facettes, bosselée, entourée de mottes ; terre, argile ou boue. Même
// générateur que le talus de la roche enterrée (kit/ground-cover.js). Entièrement procédural, 1 draw call.

import * as THREE from "three";
import { coverMaterial, dirtMound } from "../../kit/ground-cover.js";
import { GROUNDS } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change le contour, les bosses et la place des mottes."),
  soil: choiceParam("Sol", GROUNDS, "Terre brune, argile rouge ou boue sombre."),
  size: numberParam("Largeur", 1.4, 0.4, 3, "Largeur de la butte.", { step: 0.1, unit: "m" }),
  height: numberParam("Hauteur", 0.3, 0.05, 0.6, "Hauteur au centre.", { step: 0.05, unit: "m" }),
};

export const meta = {
  id: "nature/terrain/dirt-mound",
  name: "Terre remuée",
  nameEn: "Dirt mound",
  category: "nature",
  subcategory: "terrain",
  description:
    "Butte de terre fraîchement remuée, bosselée, entourée de mottes. Terre, argile ou boue ; la graine change " +
    "la forme et les mottes.",
  tags: [
    "terre", "terre remuée", "butte", "motte", "tas", "argile", "boue", "sol", "terrain", "chantier", "jardin", "extérieur",
    "dirt", "dirt mound", "mound", "clod", "pile", "clay", "mud", "soil", "ground", "digging", "outdoor", "procedural",
  ],
  biomes: ["garden", "village", "forest", "meadow", "swamp", "desert"],
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au centre de la butte",
  footprint: { radius: 0.7, height: 0.35 },
  animated: [],
  params,
  variants: variantsOf("soil", params.soil),
};

/**
 * Crée une butte de terre remuée.
 * @param {{seed?: number, soil?: "dirt"|"clay"|"mud", size?: number, height?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const noise = createNoise3(p.seed);
  const half = p.size / 2;

  const mesh = new THREE.Mesh(
    dirtMound(shape, noise, {
      radius: [half * 0.8, half * 0.8 * shape.range(0.65, 0.95)],
      height: p.height * (p.soil === "mud" ? 0.6 : 1),
      clods: shape.int(4, 8),
      rotation: shape.range(0, Math.PI * 2),
    }),
    coverMaterial("dirt", p.soil, { seed: detail.int(0, 96), id: 12 }),
  );
  mesh.name = "dirt";
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const group = new THREE.Group();
  group.name = meta.name;
  group.add(mesh);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
