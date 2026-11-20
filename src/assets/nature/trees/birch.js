// Bouleau : tronc blanc effilé marqué de tirets sombres, branches dressées dont les pointes retombent,
// feuillage léger en touffes avec des brins pendants. Entièrement procédural, 2 draw calls.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildLeafGeometry, buildTube, mergeGeometries } from "../../kit/geometry.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { numberParam, seasonParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change la silhouette : inclinaison du tronc, branches, touffes."),
  season: seasonParam("Couleur et densité du feuillage ; l'hiver, l'arbre est nu."),
  height: numberParam("Hauteur", 7.5, 5, 9.5, "Hauteur du tronc ; tout l'arbre garde ses proportions.", { step: 0.5, unit: "m" }),
  fullness: numberParam("Densité du feuillage", 1, 0.5, 1.4, "Quantité de feuilles (et de triangles)."),
};

export const meta = {
  id: "nature/trees/birch",
  name: "Bouleau",
  nameEn: "Birch tree",
  category: "nature",
  subcategory: "trees",
  description:
    "Bouleau au tronc blanc marqué de tirets sombres, feuillage léger en touffes avec des brins pendants " +
    "qui bougent au vent. Quatre saisons, forme différente pour chaque graine.",
  tags: [
    "arbre", "bouleau", "feuillu", "végétation", "tronc blanc", "feuillage", "vent", "saisons", "extérieur",
    "tree", "birch", "deciduous", "vegetation", "foliage", "wind", "seasons", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "garden", "village"],
  version: 1,
  added: "2026-11-15",
  units: "1 unité = 1 mètre ; l'origine est au pied du tronc, au niveau du sol",
  footprint: { radius: 3.2, height: 8.4 },
  animated: ["wind"],
  params,
  variants: variantsOf("season", params.season),
};

// Rampes de couleurs, de l'ombre vers la lumière.
const BARK_RAMP = ["#77728f", "#b0aec2", "#e0dfe6", "#fbf8ee"];
const BARK_INK = "#2a2233";
const SEASONS = {
  spring: { ramp: ["#2a6350", "#3f8a52", "#63ad55", "#96cf5e", "#d2ec84"], density: 0.78, leafSize: 0.92 },
  summer: { ramp: ["#1d4945", "#2a6947", "#3f8d45", "#6db348", "#b3da5b"], density: 1, leafSize: 1 },
  autumn: { ramp: ["#7b3d1d", "#b3651e", "#da9422", "#f2bf3a", "#ffe889"], density: 0.86, leafSize: 1 },
  winter: { ramp: ["#1d4945", "#2a6947", "#3f8d45", "#6db348", "#b3da5b"], density: 0, leafSize: 1 },
};

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const lerp = THREE.MathUtils.lerp;

/**
 * Crée un bouleau.
 * @param {{seed?: number, season?: "spring"|"summer"|"autumn"|"winter", height?: number, fullness?: number}} [params]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.asset` décrit l'asset créé
 */
export function create(params = {}) {
  const p = resolveParams(meta.params, params);
  const season = SEASONS[p.season];
  const rng = createRng(p.seed * 7919 + 17);
  const s = p.height / 7.5; // échelle des proportions

  // --- Tronc : légèrement penché et sinueux, large au pied, très fin en haut.
  const leanAzimuth = rng.range(0, TAU);
  const lean = rng.range(0.2, 0.55) * s;
  const trunkPoints = [];
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const wobble = i === 0 ? 0 : 0.11 * s;
    trunkPoints.push(
      new THREE.Vector3(
        Math.cos(leanAzimuth) * lean * t * t + rng.range(-wobble, wobble),
        p.height * t,
        Math.sin(leanAzimuth) * lean * t * t + rng.range(-wobble, wobble),
      ),
    );
  }
  const baseRadius = 0.21 * s;
  const trunkRadius = (t) => lerp(baseRadius, baseRadius * 0.24, Math.pow(t, 0.85)) + baseRadius * 0.5 * Math.exp(-t * 22);
  const trunk = buildTube(trunkPoints, trunkRadius, { radialSegments: 7, lengthSegments: 14 });
  const trunkCurve = trunk.userData.curve;
  const wood = [trunk];

  // --- Branches : en spirale autour du tronc, longues en bas, courtes et dressées en haut.
  const clumps = []; // touffes de feuilles : { center, radius, hanging }
  const branchCount = 10 + rng.int(0, 3);
  const minRadius = 0.034;
  for (let i = 0; i < branchCount; i++) {
    const u = i / (branchCount - 1);
    const start = trunkCurve.getPoint(0.4 + 0.54 * Math.pow(u, 0.9));
    const azimuth = i * 2.39996 + rng.range(-0.5, 0.5);
    const out = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const length = lerp(2.5, 0.95, Math.pow(u, 1.1)) * rng.range(0.85, 1.15) * s;
    const rise = lerp(0.3, 0.55, u) * length;
    const points = [
      start,
      start.clone().addScaledVector(out, length * 0.35).addScaledVector(UP, rise),
      start.clone().addScaledVector(out, length * 0.75).addScaledVector(UP, rise + length * 0.2),
      start.clone().addScaledVector(out, length).addScaledVector(UP, rise + length * 0.06),
    ];
    const r0 = Math.max(minRadius, lerp(0.078, 0.045, u) * s);
    const branch = buildTube(points, (t) => lerp(r0, minRadius, t), {
      radialSegments: 5,
      lengthSegments: 5,
      vOffset: rng.range(3, 30),
    });
    wood.push(branch);
    const branchCurve = branch.userData.curve;

    const size = lerp(0.92, 0.55, u) * s;
    for (const [t, k] of [[0.5, 1], [0.78, 0.9], [1, 0.74]]) {
      const radius = size * k * rng.range(0.85, 1.15);
      const center = branchCurve.getPoint(t);
      center.y -= radius * 0.18;
      clumps.push({ center, radius, hanging: t > 0.6 });
    }

    // Rameaux secondaires.
    const twigCount = u < 0.75 ? 2 : 1;
    for (let j = 0; j < twigCount; j++) {
      const from = branchCurve.getPoint(rng.range(0.3, 0.75));
      const side = azimuth + (rng.chance(0.5) ? 1 : -1) * rng.range(0.7, 1.3);
      const direction = new THREE.Vector3(Math.cos(side), rng.range(0.1, 0.5), Math.sin(side)).normalize();
      const twigLength = rng.range(0.55, 1.0) * s * lerp(1, 0.7, u);
      const tip = from.clone().addScaledVector(direction, twigLength);
      tip.y -= twigLength * 0.2;
      const middle = from.clone().addScaledVector(direction, twigLength * 0.55);
      wood.push(
        buildTube([from, middle, tip], () => minRadius, { radialSegments: 4, lengthSegments: 3, vOffset: rng.range(3, 30) }),
      );
      clumps.push({ center: tip, radius: rng.range(0.42, 0.56) * s, hanging: true });
    }
  }

  // Cime.
  const top = trunkCurve.getPoint(1);
  clumps.push({ center: top.clone().add(new THREE.Vector3(0, 0.15 * s, 0)), radius: 0.58 * s, hanging: false });
  // Cœur de la couronne : des touffes autour du tronc, qui le laissent deviner.
  const crownStart = rng.range(0, TAU);
  for (let i = 0; i < 5; i++) {
    const angle = crownStart + i * 2.39996;
    const center = trunkCurve.getPoint(0.56 + i * 0.085);
    const reach = lerp(0.75, 0.4, i / 4) * s;
    center.x += Math.cos(angle) * reach;
    center.z += Math.sin(angle) * reach;
    clumps.push({ center, radius: lerp(0.8, 0.55, i / 4) * s, hanging: false });
  }

  const sway = { amplitude: 0.09 * s, height: p.height };
  const group = new THREE.Group();
  group.name = meta.name;

  const woodMesh = new THREE.Mesh(
    mergeGeometries(wood),
    createToonMaterial({
      ramp: BARK_RAMP,
      steps: [0.3, 0.52, 0.76],
      ink: BARK_INK,
      pattern: "bark",
      patternParams: [16, 0.34, 0.95 * s, 0.78],
      seed: p.seed % 97,
      id: 10,
      sway,
    }),
  );
  woodMesh.name = "wood";
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // --- Feuillage : des feuilles sur la coque de chaque touffe, un cœur sombre, des brins qui pendent.
  const leaves = [];
  if (season.density > 0) {
    const canopyCenter = trunkCurve.getPoint(0.68);
    const density = season.density * p.fullness;
    const leafSize = () => rng.range(0.075, 0.13) * season.leafSize;
    const shadeNormal = (position, direction) =>
      direction.clone()
        .addScaledVector(position.clone().sub(canopyCenter).normalize(), 0.4)
        .addScaledVector(UP, 0.25)
        .normalize();
    const DOWN = new THREE.Vector3(0, -1, 0);

    for (const clump of clumps) {
      const { center, radius } = clump;
      // Cœur : deux grands triangles sombres qui bouchent la touffe.
      for (const rotation of [0, Math.PI]) {
        leaves.push({ position: center, normal: DOWN, size: radius * 0.44, rotation, phase: rng.next(), occlusion: 0, variation: 0, flex: 0.3 });
      }

      const count = Math.round(density * 105 * radius * radius);
      for (let i = 0; i < count; i++) {
        const y = rng.range(-1, 1);
        const angle = rng.range(0, TAU);
        const ring = Math.sqrt(1 - y * y);
        const direction = new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring);
        const k = 0.4 + 0.6 * Math.sqrt(rng.next());
        const position = center.clone().add(direction.clone().multiply(new THREE.Vector3(radius * k, radius * k * 0.85, radius * k)));
        if (y < 0) position.y -= y * y * radius * 0.35; // le dessous de la touffe s'affaisse
        leaves.push({
          position,
          normal: shadeNormal(position, direction),
          size: leafSize(),
          rotation: rng.range(-0.9, 0.9),
          phase: rng.next(),
          occlusion: THREE.MathUtils.smoothstep(k, 0.4, 0.95) * (0.8 + 0.2 * (y * 0.5 + 0.5)),
          variation: rng.next(),
          flex: rng.range(0.55, 1),
        });
      }

      // Brins pendants, typiques du bouleau.
      if (clump.hanging) {
        const strands = rng.int(1, 3);
        for (let j = 0; j < strands; j++) {
          const angle = rng.range(0, TAU);
          const reach = rng.range(0.2, 0.75) * radius;
          const position = center.clone().add(new THREE.Vector3(Math.cos(angle) * reach, -radius * 0.7, Math.sin(angle) * reach));
          const direction = new THREE.Vector3(Math.cos(angle), -0.2, Math.sin(angle)).normalize();
          const links = Math.round(rng.int(4, 8) * Math.min(1, density + 0.2));
          for (let n = 0; n < links; n++) {
            position.y -= 0.13 * s;
            position.x += rng.range(-0.03, 0.03);
            position.z += rng.range(-0.03, 0.03);
            leaves.push({
              position: position.clone(),
              normal: shadeNormal(position, direction),
              size: leafSize(),
              rotation: rng.range(-0.35, 0.35),
              phase: rng.next(),
              occlusion: 0.9,
              variation: rng.next(),
              flex: 0.8 + 0.7 * (n / links),
            });
          }
        }
      }
    }

    // Automne : quelques feuilles tombées au pied de l'arbre.
    if (p.season === "autumn") {
      for (let i = 0; i < 34; i++) {
        const angle = rng.range(0, TAU);
        const distance = rng.range(0.4, 2.8) * s;
        leaves.push({
          position: new THREE.Vector3(Math.cos(angle) * distance, 0.04, Math.sin(angle) * distance),
          normal: UP,
          size: leafSize(),
          rotation: rng.range(0, TAU),
          phase: rng.next(),
          occlusion: 1,
          variation: rng.next(),
          flex: 0,
        });
      }
    }

    const leafGeometry = buildLeafGeometry(leaves);
    leafGeometry.computeBoundingSphere();
    leafGeometry.boundingSphere.radius += 0.6; // marge : taille des feuilles + vent
    const leafMaterial = createToonMaterial({
      ramp: season.ramp,
      steps: [0.22, 0.42, 0.6, 0.78],
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
