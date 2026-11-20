// Tapis de mousse : une nappe mince au contour très découpé, semée de coussinets ronds ; couleur selon la
// saison. Même générateur que la mousse des rochers (kit/ground-cover.js). Entièrement procédural, 1 draw call.

import * as THREE from "three";
import { coverMaterial, mossMound } from "../../kit/ground-cover.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { numberParam, seasonParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change le contour du tapis, le nombre et la place des coussinets."),
  season: seasonParam("Vert tendre au printemps, olive et ocre en automne, terne en hiver."),
  size: numberParam("Largeur", 1.2, 0.3, 3, "Largeur du tapis.", { step: 0.1, unit: "m" }),
  cushions: numberParam("Coussinets", 6, 0, 14, "Nombre de coussinets bombés.", { step: 1 }),
};

export const meta = {
  id: "nature/terrain/moss-patch",
  name: "Tapis de mousse",
  nameEn: "Moss patch",
  category: "nature",
  subcategory: "terrain",
  description:
    "Tapis de mousse posé au sol, au contour découpé, semé de coussinets ronds. Quatre saisons ; la graine " +
    "change le contour et les coussinets.",
  tags: [
    "mousse", "tapis de mousse", "coussinet", "sol", "terrain", "végétation", "sous-bois", "saisons", "extérieur",
    "moss", "moss patch", "cushion", "ground", "vegetation", "undergrowth", "seasons", "outdoor", "procedural",
  ],
  biomes: ["forest", "swamp", "garden", "cave", "meadow"],
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au centre du tapis",
  footprint: { radius: 0.6, height: 0.2 },
  animated: [],
  params,
  variants: variantsOf("season", params.season),
};

/**
 * Crée un tapis de mousse.
 * @param {{seed?: number, season?: string, size?: number, cushions?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const noise = createNoise3(p.seed);
  const half = p.size / 2;

  const mesh = new THREE.Mesh(
    mossMound(shape, noise, {
      radius: [half * 0.85, half * 0.85 * shape.range(0.65, 0.95)],
      height: 0.04,
      cushions: Math.round(p.cushions),
      rotation: shape.range(0, Math.PI * 2),
    }),
    coverMaterial("moss", p.season, { seed: detail.int(0, 96), id: 11 }),
  );
  mesh.name = "moss";
  mesh.receiveShadow = true;
  mesh.castShadow = true;

  const group = new THREE.Group();
  group.name = meta.name;
  group.add(mesh);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
