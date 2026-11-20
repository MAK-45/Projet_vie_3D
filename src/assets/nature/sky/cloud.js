// Nuage : grappe de boules lisses au dessous aplati, éclairée par le soleil (ombres bleutées, sommets blancs
// chauds) et qui projette son ombre au sol. Cumulus, stratus en long banc plat, ou cumulonimbus d'orage sombre et
// haut. Entièrement procédural, 1 draw call.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { mergeGeometries } from "../../kit/geometry.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = {
  cumulus: {
    label: "Cumulus",
    ramp: ["#7f8fbf", "#b0bddd", "#e3e8f4", "#fffdf5"],
    puffs: [4, 6], radius: [0.2, 0.3], squash: 0.9, towers: [1, 3], depth: 0.75,
  },
  stratus: {
    label: "Stratus",
    ramp: ["#8c95bd", "#b9c1dc", "#e0e4ef", "#f8f7f2"],
    puffs: [7, 10], radius: [0.1, 0.15], squash: 0.62, towers: [0, 1], depth: 0.45,
  },
  storm: {
    label: "Orage",
    ramp: ["#2a2c48", "#43486a", "#646a8c", "#9498b2"],
    puffs: [5, 7], radius: [0.2, 0.28], squash: 0.95, towers: [3, 5], depth: 0.85,
  },
};

const params = {
  seed: seedParam("Change la silhouette : nombre, taille et place des boules, tours qui montent, longueur du nuage."),
  kind: choiceParam("Type", KINDS, "Cumulus blanc et bombé, stratus en long banc plat, ou nuage d'orage sombre et haut."),
  size: numberParam("Longueur", 5, 2.5, 9, "Longueur du nuage ; toute la forme garde ses proportions.", { step: 0.5, unit: "m" }),
};

export const meta = {
  id: "nature/sky/cloud",
  name: "Nuage",
  nameEn: "Cloud",
  category: "nature",
  subcategory: "sky",
  description:
    "Nuage en boules lisses au dessous plat, éclairé par le soleil et qui projette son ombre. Cumulus, stratus " +
    "ou nuage d'orage ; la graine change le nombre et la place des boules et des tours.",
  tags: [
    "nuage", "ciel", "météo", "cumulus", "stratus", "orage", "blanc", "ombre portée", "extérieur",
    "cloud", "sky", "weather", "storm", "white", "puffy", "cast shadow", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "garden", "village", "desert", "snow", "swamp", "beach", "mountain"],
  version: 1,
  added: "2026-11-16",
  units:
    "1 unité = 1 mètre (taille de présentation : un monde l'agrandit et le place haut) ; l'origine est au sol, " +
    "le dessous du nuage flotte à 1,2 m",
  footprint: { radius: 3, height: 4 },
  animated: [],
  params,
  variants: variantsOf("kind", params.kind),
};

const BASE = 1.2; // hauteur du dessous du nuage

/** Boule lisse dont le dessous est écrasé sur un plan (normales vers le bas) : la brique d'un nuage. */
function puff(center, radius, squash, floor) {
  const geometry = new THREE.SphereGeometry(radius, 12, 8);
  geometry.deleteAttribute("uv");
  geometry.scale(1, squash, 1);
  geometry.translate(center.x, center.y, center.z);
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  for (let i = 0; i < position.count; i++) {
    if (position.getY(i) < floor) {
      position.setY(i, floor);
      normal.setXYZ(i, 0, -1, 0);
    }
  }
  return geometry;
}

/**
 * Crée un nuage.
 * @param {{seed?: number, kind?: "cumulus"|"stratus"|"storm", size?: number}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.asset` décrit l'asset créé
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const kind = KINDS[p.kind];
  const shape = createRng(p.seed * 7919 + 17);
  const length = p.size * shape.range(0.85, 1.1);
  const half = length / 2;
  const floor = BASE;
  const geometries = [];
  const puffs = [];

  // Rangée de base : des boules le long du nuage, plus grosses vers le milieu (mais pas forcément au centre).
  const count = shape.int(kind.puffs[0], kind.puffs[1]);
  const peak = shape.range(-0.3, 0.3);
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : i / (count - 1) * 2 - 1; // -1 .. 1
    const bell = Math.exp(-((u - peak) ** 2) * 1.6);
    const radius = p.size * THREE.MathUtils.lerp(kind.radius[0], kind.radius[1], bell) * shape.range(0.85, 1.15);
    const x = u * (half - radius * 0.7) + shape.range(-0.1, 0.1) * radius;
    const z = shape.range(-0.35, 0.35) * radius * kind.depth;
    const y = floor + radius * kind.squash * shape.range(0.15, 0.4);
    puffs.push({ center: new THREE.Vector3(x, y, z), radius });
  }

  // Seconde rangée, un peu en retrait et décalée : donne de l'épaisseur vue de dessus.
  for (let i = 0; i < count - 1; i++) {
    const a = puffs[i];
    const b = puffs[i + 1];
    if (!shape.chance(0.7)) continue;
    const radius = (a.radius + b.radius) * 0.5 * shape.range(0.75, 0.95);
    const side = shape.chance(0.5) ? 1 : -1;
    const center = a.center.clone().lerp(b.center, 0.5);
    center.z += side * radius * kind.depth * shape.range(0.5, 0.8);
    center.y = floor + radius * kind.squash * shape.range(0.1, 0.3);
    puffs.push({ center, radius });
  }

  // Tours : boules empilées au-dessus des plus grosses, ce qui fait reconnaître le type de loin.
  const towers = shape.int(kind.towers[0], kind.towers[1]);
  const base = puffs.slice(0, count).sort((a, b) => b.radius - a.radius);
  for (let i = 0; i < towers; i++) {
    const below = base[i % base.length];
    const level = Math.floor(i / base.length);
    const radius = below.radius * shape.range(0.6, 0.8) * (p.kind === "storm" ? 1.05 : 1);
    const center = below.center.clone();
    center.x += shape.range(-0.3, 0.3) * below.radius;
    center.z += shape.range(-0.2, 0.2) * below.radius;
    center.y += (below.radius * 0.75 + radius * 0.35) * kind.squash * (1 + level * 0.8);
    puffs.push({ center, radius });
    if (p.kind === "storm") base.push({ center, radius }); // l'orage monte en colonne
  }

  for (const { center, radius } of puffs) geometries.push(puff(center, radius, kind.squash, floor));

  const group = new THREE.Group();
  group.name = meta.name;
  const material = createToonMaterial({
    ramp: kind.ramp,
    steps: [0.34, 0.55, 0.76],
    selfEdge: 0.35,
    shadowLit: 0.5,
    id: 22,
  });
  const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
  mesh.name = "cloud";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  group.userData.asset = { id: meta.id, params: p, puffs: puffs.length };
  return group;
}
