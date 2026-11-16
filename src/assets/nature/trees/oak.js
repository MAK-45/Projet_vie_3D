// Chêne : tronc trapu et sombre à l'écorce crevassée, quelques grosses branches tortueuses qui s'étalent presque à
// l'horizontale, couronne large et bosselée faite de grosses masses de feuillage bien séparées par l'ombre.
// L'hiver, il garde une partie de ses feuilles mortes (marcescence). Entièrement procédural, 2 draw calls.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { fallenLeaves, fillClump } from "../../kit/foliage.js";
import { buildLeafGeometry, buildTube, mergeGeometries } from "../../kit/geometry.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { numberParam, seasonParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change la silhouette : nombre et direction des grosses branches, torsions, masses de feuillage."),
  season: seasonParam("Couleur et densité du feuillage ; l'hiver, il garde quelques feuilles mortes."),
  height: numberParam("Hauteur", 9, 6, 12, "Hauteur de l'arbre ; tout l'arbre garde ses proportions.", { step: 0.5, unit: "m" }),
  fullness: numberParam("Densité du feuillage", 1, 0.5, 1.3, "Quantité de feuilles (et de triangles)."),
};

export const meta = {
  id: "nature/trees/oak",
  name: "Chêne",
  nameEn: "Oak tree",
  category: "nature",
  subcategory: "trees",
  description:
    "Chêne trapu au tronc sombre et crevassé, grosses branches tortueuses étalées, couronne large et bosselée " +
    "en masses de feuillage. Quatre saisons (feuilles mortes gardées l'hiver), forme différente pour chaque graine.",
  tags: [
    "chêne", "arbre", "feuillu", "végétation", "tronc crevassé", "couronne large", "branches tortueuses",
    "feuillage", "feuilles mortes", "vent", "saisons", "extérieur",
    "oak", "tree", "deciduous", "vegetation", "broad crown", "gnarled", "foliage", "wind", "seasons", "outdoor",
    "procedural",
  ],
  biomes: ["forest", "meadow", "village", "garden"],
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au pied du tronc, au niveau du sol",
  footprint: { radius: 5.8, height: 9.2 },
  animated: ["wind"],
  params,
  variants: variantsOf("season", params.season),
};

// Rampes de couleurs, de l'ombre vers la lumière.
const BARK_RAMP = ["#33283a", "#544549", "#786559", "#9d8a72"];
const BARK_INK = "#1b141c";
const SEASONS = {
  spring: { ramp: ["#265743", "#3b7c47", "#5fa14a", "#96c656", "#d4e884"], density: 0.82, leafSize: 0.92 },
  summer: { ramp: ["#173a38", "#21533d", "#33723f", "#56953f", "#98c250"], density: 1, leafSize: 1 },
  autumn: { ramp: ["#4a2722", "#7b3b22", "#a65a25", "#cc8834", "#ebbb5e"], density: 0.86, leafSize: 1 },
  // Marcescence : le chêne garde des feuilles mortes, brunes et clairsemées, jusqu'au printemps.
  winter: { ramp: ["#3b2826", "#5d3b2b", "#83573a", "#a97a4c", "#cba36c"], density: 0.55, leafSize: 0.85 },
};

const TAU = Math.PI * 2;
const lerp = THREE.MathUtils.lerp;

/**
 * Crée un chêne.
 * @param {{seed?: number, season?: "spring"|"summer"|"autumn"|"winter", height?: number, fullness?: number}} [params]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.asset` décrit l'asset créé
 */
export function create(params = {}) {
  const p = resolveParams(meta.params, params);
  const season = SEASONS[p.season];
  const rng = createRng(p.seed * 7919 + 23);
  const s = p.height / 9; // échelle des proportions

  // --- Fût : court, épais, évasé au pied, légèrement penché et noueux.
  const boleHeight = rng.range(2.3, 3.3) * s;
  const leanAzimuth = rng.range(0, TAU);
  const lean = rng.range(0.1, 0.45) * s;
  const trunkPoints = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const wobble = i === 0 ? 0 : 0.14 * s;
    trunkPoints.push(new THREE.Vector3(
      Math.cos(leanAzimuth) * lean * t + rng.range(-wobble, wobble),
      (boleHeight + 0.5 * s) * t,
      Math.sin(leanAzimuth) * lean * t + rng.range(-wobble, wobble),
    ));
  }
  const baseRadius = rng.range(0.46, 0.54) * s;
  const trunk = buildTube(
    trunkPoints,
    (t) => lerp(baseRadius, baseRadius * 0.78, t) + baseRadius * 0.55 * Math.exp(-t * 10),
    { radialSegments: 8, lengthSegments: 8 },
  );
  const trunkCurve = trunk.userData.curve;
  const wood = [trunk];
  const clumps = []; // { center, radius }
  const minRadius = 0.04;

  // Branche tortueuse : de `start` dans la direction (azimut, élévation), avec des coudes tirés de la graine.
  const limb = (start, azimuth, elevation, length, r0, r1, { kink = 0.22, droop = 0.15, sides = 6 } = {}) => {
    const direction = new THREE.Vector3(
      Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation),
    );
    const side = new THREE.Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth));
    const points = [start.clone()];
    for (const t of [0.33, 0.66, 1]) {
      const point = start.clone().addScaledVector(direction, length * t);
      point.addScaledVector(side, rng.range(-kink, kink) * length * (t < 1 ? 1 : 0.5));
      point.y += rng.range(-kink, kink) * length * 0.5 - droop * length * t * t;
      points.push(point);
    }
    const tube = buildTube(points, (t) => lerp(r0, r1, Math.pow(t, 0.8)), {
      radialSegments: sides,
      lengthSegments: 6,
      vOffset: rng.range(3, 30),
    });
    wood.push(tube);
    return tube.userData.curve;
  };

  // --- Charpentières : 3 à 5 grosses branches qui partent du haut du fût et s'étalent.
  const limbCount = rng.int(3, 5);
  const limbStart = rng.range(0, TAU);
  const limbs = [];
  for (let i = 0; i < limbCount; i++) {
    limbs.push({
      azimuth: limbStart + (i / limbCount) * TAU + rng.range(-0.45, 0.45),
      elevation: rng.range(0.35, 0.8),
      length: rng.range(3.0, 4.2) * s,
      from: rng.range(0.78, 1),
    });
  }
  // Une branche basse presque horizontale, très chêne, pour une graine sur deux.
  if (rng.chance(0.55)) {
    limbs.push({ azimuth: rng.range(0, TAU), elevation: rng.range(0.08, 0.25), length: rng.range(3.4, 4.4) * s, from: rng.range(0.5, 0.65), low: true });
  }
  // La flèche : une branche presque verticale qui fait le dôme.
  limbs.push({ azimuth: leanAzimuth + rng.range(-1, 1), elevation: rng.range(1.15, 1.4), length: rng.range(2.8, 3.6) * s, from: 1, leader: true });

  for (const L of limbs) {
    const start = trunkCurve.getPoint(L.from);
    const r0 = baseRadius * (L.leader ? 0.6 : rng.range(0.5, 0.62));
    const curve = limb(start, L.azimuth, L.elevation, L.length, r0, r0 * 0.4, { droop: L.leader ? 0 : 0.12 });
    const tip = curve.getPoint(1);
    clumps.push({ center: tip.clone().add(new THREE.Vector3(0, 0.35 * s, 0)), radius: rng.range(1.35, 1.6) * s });

    // Rameaux : deux ou trois départs de chaque côté, qui montent porter des masses de feuillage.
    const forks = L.leader ? 2 : rng.int(2, 3);
    for (let j = 0; j < forks; j++) {
      const t = lerp(0.4, 0.82, forks === 1 ? 0.5 : j / (forks - 1)) + rng.range(-0.06, 0.06);
      const from = curve.getPoint(t);
      const sign = j % 2 === 0 ? 1 : -1;
      const azimuth = L.azimuth + sign * rng.range(0.55, 1.1);
      const elevation = L.leader ? rng.range(0.5, 0.8) : rng.range(0.45, 0.95);
      const length = L.length * rng.range(0.42, 0.58);
      const childCurve = limb(from, azimuth, elevation, length, Math.max(minRadius, r0 * 0.45), minRadius, { sides: 5, droop: 0.05 });
      const end = childCurve.getPoint(1);
      clumps.push({ center: end.clone().add(new THREE.Vector3(0, 0.3 * s, 0)), radius: rng.range(1.15, 1.4) * s });
      if (L.low || rng.chance(0.35)) {
        clumps.push({ center: childCurve.getPoint(0.5).add(new THREE.Vector3(0, 0.5 * s, 0)), radius: rng.range(0.95, 1.1) * s });
      }
    }
  }

  // Cœur de la couronne : des masses autour du haut du fût, qui bouchent le dessus sans cacher les branches.
  const crownBase = trunkCurve.getPoint(1);
  const fillStart = rng.range(0, TAU);
  for (let i = 0; i < 4; i++) {
    const angle = fillStart + i * 2.39996;
    const reach = rng.range(1.0, 1.8) * s;
    clumps.push({
      center: crownBase.clone().add(new THREE.Vector3(Math.cos(angle) * reach, rng.range(2.0, 2.9) * s, Math.sin(angle) * reach)),
      radius: rng.range(1.3, 1.55) * s,
    });
  }

  const sway = { amplitude: 0.06 * s, height: p.height };
  const group = new THREE.Group();
  group.name = meta.name;

  const woodMesh = new THREE.Mesh(
    mergeGeometries(wood),
    createToonMaterial({
      ramp: BARK_RAMP,
      steps: [0.3, 0.52, 0.76],
      ink: BARK_INK,
      pattern: "furrow",
      patternParams: [16, 3, 0.1, 0.2],
      seed: p.seed % 97,
      id: 10,
      sway,
    }),
  );
  woodMesh.name = "wood";
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // --- Feuillage : grosses touffes pleines, au dessous aplati ; l'hiver, quelques feuilles mortes accrochées.
  const leaves = [];
  if (season.density > 0) {
    const canopyCenter = crownBase.clone().add(new THREE.Vector3(0, 2 * s, 0));
    const density = season.density * p.fullness;
    const leafSize = () => rng.range(0.12, 0.19) * season.leafSize;
    const winter = p.season === "winter";
    for (const clump of clumps) {
      // L'hiver, les feuilles mortes restent en paquets sur une partie des masses, pas en poussière partout.
      if (winter && !rng.chance(0.4)) continue;
      const radius = winter ? clump.radius * 0.7 : clump.radius;
      fillClump(rng, leaves, {
        center: clump.center,
        radius,
        count: Math.round(density * 64 * radius * radius),
        canopyCenter,
        leafSize,
        squash: 0.78,
        sag: 0.1,
        canopyWeight: 0.3,
        core: p.season !== "winter",
        flex: [0.4, 0.8],
        coreSize: 0.5,
        shell: 0.55,
      });
    }
    if (p.season === "autumn") {
      fallenLeaves(rng, leaves, { count: 48, minRadius: 0.6 * s, maxRadius: 4.2 * s, leafSize });
    }

    const leafGeometry = buildLeafGeometry(leaves);
    leafGeometry.computeBoundingSphere();
    leafGeometry.boundingSphere.radius += 0.6; // marge : taille des feuilles + vent
    const leafMaterial = createToonMaterial({
      ramp: season.ramp,
      steps: [0.24, 0.44, 0.62, 0.8],
      foliage: true,
      id: 11,
      sway,
    });
    const leafMesh = new THREE.Mesh(leafGeometry, leafMaterial);
    leafMesh.name = "leaves";
    leafMesh.customDepthMaterial = leafMaterial.userData.depthMaterial;
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    group.add(leafMesh);
  }

  group.userData.asset = { id: meta.id, params: p, leaves: leaves.length };
  return group;
}
