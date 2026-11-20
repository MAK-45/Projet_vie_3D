// Tilleul : grand tronc droit à l'écorce grise finement crevassée, flèche qui monte presque jusqu'en haut, branches
// dressées en spirale, couronne dense et régulière en ogive (en forme de cœur renversé). L'été, il se couvre de
// petites grappes de fleurs jaune pâle ; au pied, des rejets feuillus pour la plupart des graines.
// Entièrement procédural, 3 draw calls l'été (bois, feuilles, fleurs), 2 sinon.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { fallenLeaves, fillClump, leafNormal } from "../../kit/foliage.js";
import { buildLeafGeometry, buildTube, mergeGeometries } from "../../kit/geometry.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { numberParam, seasonParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change la silhouette : ogive plus ou moins large, penchant de la couronne, branches, rejets au pied."),
  season: seasonParam("Couleur du feuillage ; fleurs jaune pâle l'été, or à l'automne, nu l'hiver."),
  height: numberParam("Hauteur", 10, 7, 13, "Hauteur de l'arbre ; tout l'arbre garde ses proportions.", { step: 0.5, unit: "m" }),
  fullness: numberParam("Densité du feuillage", 1, 0.5, 1.3, "Quantité de feuilles (et de triangles)."),
};

export const meta = {
  id: "nature/trees/linden",
  name: "Tilleul",
  nameEn: "Linden tree",
  category: "nature",
  subcategory: "trees",
  description:
    "Tilleul au tronc droit et gris, couronne dense et régulière en ogive ; fleurs jaune pâle en été, feuillage " +
    "doré en automne, rejets au pied. Quatre saisons, forme différente pour chaque graine.",
  tags: [
    "tilleul", "arbre", "feuillu", "végétation", "couronne en ogive", "tronc droit", "fleurs", "floraison",
    "feuillage", "vent", "saisons", "place de village", "extérieur",
    "linden", "lime tree", "tree", "deciduous", "vegetation", "dense crown", "flowers", "blossom", "foliage",
    "wind", "seasons", "outdoor", "procedural",
  ],
  biomes: ["village", "garden", "meadow", "forest"],
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au pied du tronc, au niveau du sol",
  footprint: { radius: 4.1, height: 10.2 },
  animated: ["wind"],
  params,
  variants: variantsOf("season", params.season),
};

// Rampes de couleurs, de l'ombre vers la lumière.
const BARK_RAMP = ["#4c4655", "#6f6870", "#958d8a", "#bab1a3"];
const BARK_INK = "#2b2430";
const FLOWER_RAMP = ["#b8ad52", "#dcd36a", "#f1eb98", "#fffbd6"];
const SEASONS = {
  spring: { ramp: ["#2a6345", "#448c49", "#6db64c", "#a6d85c", "#e2f394"], density: 0.85, leafSize: 0.9 },
  summer: { ramp: ["#1b463c", "#28653f", "#3f8b42", "#6cb147", "#b2db62"], density: 1, leafSize: 1, flowers: true },
  autumn: { ramp: ["#6a4a1e", "#9c731f", "#c99d25", "#e8c63c", "#fbec8c"], density: 0.84, leafSize: 1 },
  winter: { ramp: ["#1b463c", "#28653f", "#3f8b42", "#6cb147", "#b2db62"], density: 0, leafSize: 1 },
};

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const lerp = THREE.MathUtils.lerp;

/**
 * Crée un tilleul.
 * @param {{seed?: number, season?: "spring"|"summer"|"autumn"|"winter", height?: number, fullness?: number}} [params]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.asset` décrit l'asset créé
 */
export function create(params = {}) {
  const p = resolveParams(meta.params, params);
  const season = SEASONS[p.season];
  const rng = createRng(p.seed * 7919 + 31);
  const s = p.height / 10; // échelle des proportions

  // --- Enveloppe de la couronne : ogive, la plus large vers le tiers bas, pointe arrondie en haut.
  const crownBottom = rng.range(2.4, 3.2) * s;
  const crownTop = p.height - 0.6 * s;
  const crownWidth = rng.range(3.1, 3.8) * s; // rayon maximal
  const widest = rng.range(0.28, 0.4); // hauteur relative du plus large
  const envelope = (u) => {
    // u : 0 en bas de la couronne, 1 en haut
    if (u < widest) return crownWidth * (0.55 + 0.45 * Math.sin((u / widest) * Math.PI * 0.5));
    const v = (u - widest) / (1 - widest);
    return crownWidth * Math.pow(Math.max(0, 1 - v * v), 0.62);
  };
  const crownLean = new THREE.Vector3(rng.range(-0.35, 0.35) * s, 0, rng.range(-0.35, 0.35) * s);

  // --- Tronc et flèche : droits, la flèche monte jusqu'aux trois quarts de la couronne.
  const trunkPoints = [];
  const leaderTop = crownBottom + (crownTop - crownBottom) * 0.82;
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const wobble = i === 0 ? 0 : 0.06 * s;
    trunkPoints.push(new THREE.Vector3(
      crownLean.x * t * t + rng.range(-wobble, wobble),
      leaderTop * t,
      crownLean.z * t * t + rng.range(-wobble, wobble),
    ));
  }
  const baseRadius = rng.range(0.3, 0.35) * s;
  const trunk = buildTube(
    trunkPoints,
    (t) => lerp(baseRadius, baseRadius * 0.2, Math.pow(t, 1.1)) + baseRadius * 0.4 * Math.exp(-t * 18),
    { radialSegments: 7, lengthSegments: 12 },
  );
  const trunkCurve = trunk.userData.curve;
  const wood = [trunk];
  const clumps = []; // { center, radius }
  const minRadius = 0.035;
  const crownAxis = (y) => {
    const t = THREE.MathUtils.clamp(y / p.height, 0, 1);
    return new THREE.Vector3(crownLean.x * t * t, y, crownLean.z * t * t);
  };

  // --- Branches dressées en spirale le long de la flèche ; leur pointe s'arrête près de l'enveloppe.
  const branchCount = rng.int(11, 14);
  for (let i = 0; i < branchCount; i++) {
    const u = i / (branchCount - 1);
    const startT = lerp(crownBottom / leaderTop, 0.95, Math.pow(u, 0.95));
    const start = trunkCurve.getPoint(startT);
    const azimuth = i * 2.39996 + rng.range(-0.4, 0.4);
    const out = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const elevation = lerp(0.55, 1.05, u) + rng.range(-0.1, 0.1);
    const tipY = Math.min(crownTop - 0.6 * s, start.y + Math.tan(elevation) * envelope((start.y - crownBottom) / (crownTop - crownBottom)) * 0.6);
    const reach = envelope((tipY - crownBottom) / (crownTop - crownBottom)) * rng.range(0.74, 0.88);
    const tip = crownAxis(tipY).addScaledVector(out, reach);
    const middle = start.clone().lerp(tip, 0.5);
    middle.y -= 0.12 * s; // légère courbure vers le bas, pointe qui remonte
    const points = [start, start.clone().lerp(middle, 0.5), middle, tip];
    const r0 = Math.max(minRadius, lerp(0.1, 0.05, u) * s);
    const branch = buildTube(points, (t) => lerp(r0, minRadius, t), { radialSegments: 5, lengthSegments: 5, vOffset: rng.range(3, 30) });
    wood.push(branch);
    const curve = branch.userData.curve;

    // Touffes le long de la branche et au bout.
    for (const [t, k] of [[0.55, 0.85], [1, 1]]) {
      clumps.push({ center: curve.getPoint(t).add(new THREE.Vector3(0, 0.2 * s, 0)), radius: lerp(1.15, 0.85, u) * k * rng.range(0.9, 1.1) * s });
    }
    // Rameaux : l'hiver, ils font la ramure fine et serrée du tilleul.
    for (let j = 0; j < 2; j++) {
      const from = curve.getPoint(rng.range(0.35, 0.8));
      const side = azimuth + (j === 0 ? 1 : -1) * rng.range(0.5, 1.0);
      const direction = new THREE.Vector3(Math.cos(side), rng.range(0.6, 1.1), Math.sin(side)).normalize();
      const length = rng.range(0.6, 1.0) * s;
      const end = from.clone().addScaledVector(direction, length);
      wood.push(buildTube([from, from.clone().addScaledVector(direction, length * 0.5), end], () => minRadius, {
        radialSegments: 4, lengthSegments: 2, vOffset: rng.range(3, 30),
      }));
      if (j === 0) clumps.push({ center: end, radius: rng.range(0.6, 0.75) * s });
    }
  }

  // Remplissage : touffes posées juste sous l'enveloppe, pour la silhouette régulière et pleine.
  const fillCount = 16;
  const fillStart = rng.range(0, TAU);
  for (let i = 0; i < fillCount; i++) {
    const u = 0.12 + 0.82 * ((i + 0.5) / fillCount);
    const y = lerp(crownBottom, crownTop, u);
    const angle = fillStart + i * 2.39996;
    const radius = lerp(1.1, 0.75, u) * s;
    const reach = Math.max(0, envelope(u) - radius * 0.9);
    clumps.push({ center: crownAxis(y).add(new THREE.Vector3(Math.cos(angle) * reach, 0, Math.sin(angle) * reach)), radius });
  }
  clumps.push({ center: crownAxis(crownTop - 0.55 * s), radius: 0.75 * s }); // sommet

  // Rejets au pied : petites touffes collées au tronc.
  const sprouts = [];
  if (rng.chance(0.7)) {
    const count = rng.int(2, 4);
    const start = rng.range(0, TAU);
    for (let i = 0; i < count; i++) {
      const angle = start + i * rng.range(0.9, 1.6);
      const reach = baseRadius * 1.25;
      const base = new THREE.Vector3(Math.cos(angle) * reach, 0, Math.sin(angle) * reach);
      const top = base.clone().add(new THREE.Vector3(Math.cos(angle) * 0.15 * s, rng.range(0.45, 0.8) * s, Math.sin(angle) * 0.15 * s));
      wood.push(buildTube([base, base.clone().lerp(top, 0.5), top], () => minRadius, { radialSegments: 4, lengthSegments: 2 }));
      sprouts.push({ center: top.clone().add(new THREE.Vector3(0, -0.05 * s, 0)), radius: rng.range(0.32, 0.42) * s });
    }
  }

  const sway = { amplitude: 0.07 * s, height: p.height };
  const group = new THREE.Group();
  group.name = meta.name;

  const woodMesh = new THREE.Mesh(
    mergeGeometries(wood),
    createToonMaterial({
      ramp: BARK_RAMP,
      steps: [0.3, 0.52, 0.76],
      ink: BARK_INK,
      pattern: "furrow",
      patternParams: [16, 4, 0.05, 0.4],
      seed: p.seed % 97,
      id: 10,
      sway,
    }),
  );
  woodMesh.name = "wood";
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // --- Feuillage : touffes moyennes et serrées ; fleurs accrochées à la surface des touffes, l'été.
  const leaves = [];
  const flowers = [];
  if (season.density > 0) {
    const canopyCenter = crownAxis(lerp(crownBottom, crownTop, 0.42));
    const density = season.density * p.fullness;
    const leafSize = () => rng.range(0.1, 0.16) * season.leafSize;
    const flowerRng = createRng(p.seed * 131 + 7); // détails : n'influe pas sur la forme
    for (const clump of [...clumps, ...sprouts]) {
      const surface = fillClump(rng, leaves, {
        center: clump.center,
        radius: clump.radius,
        count: Math.round(density * 60 * clump.radius * clump.radius),
        canopyCenter,
        leafSize,
        squash: 0.9,
        sag: 0.2,
        canopyWeight: 0.55,
        coreSize: 0.48,
        shell: 0.5,
      });
      if (season.flowers) {
        for (const { position, direction } of surface) {
          if (direction.y < -0.2 || !flowerRng.chance(0.36)) continue;
          // Grappe pendante : deux ou trois petites feuilles claires sous la surface de la touffe.
          const hang = position.clone().addScaledVector(direction, 0.06);
          const links = flowerRng.int(2, 3);
          for (let n = 0; n < links; n++) {
            hang.y -= 0.11;
            flowers.push({
              position: hang.clone().add(new THREE.Vector3(flowerRng.range(-0.05, 0.05), 0, flowerRng.range(-0.05, 0.05))),
              normal: leafNormal(hang, direction, canopyCenter, 0.55),
              size: flowerRng.range(0.1, 0.13),
              rotation: flowerRng.range(0, TAU),
              phase: flowerRng.next(),
              occlusion: 1,
              variation: flowerRng.next(),
              flex: 0.9,
            });
          }
        }
      }
    }
    if (p.season === "autumn") {
      fallenLeaves(rng, leaves, { count: 40, minRadius: 0.5 * s, maxRadius: 3.2 * s, leafSize });
    }

    const addFoliage = (list, ramp, steps, name) => {
      const geometry = buildLeafGeometry(list);
      geometry.computeBoundingSphere();
      geometry.boundingSphere.radius += 0.6; // marge : taille des feuilles + vent
      const material = createToonMaterial({ ramp, steps, foliage: true, id: 11, sway });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.customDepthMaterial = material.userData.depthMaterial;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    addFoliage(leaves, season.ramp, [0.22, 0.42, 0.6, 0.78], "leaves");
    if (flowers.length > 0) addFoliage(flowers, FLOWER_RAMP, [0.3, 0.5, 0.7], "flowers");
  }

  group.userData.asset = { id: meta.id, params: p, leaves: leaves.length, flowers: flowers.length };
  return group;
}
