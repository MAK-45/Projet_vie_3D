// Cerisier à fleurs : fût court brun-rouge à bandes horizontales, charpentières qui montent en arc
// puis s'étalent, couronne en dôme plus large que haute. En fleurs au printemps (valeur par défaut) : masse rose,
// corolles de cinq pétales plus claires en surface, pétales tombés au pied. Entièrement procédural,
// 3 draw calls au plus selon la saison.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { fallenLeaves, fillClump, leafNormal } from "../../kit/foliage.js";
import { buildFanGeometry, buildLeafGeometry, buildTube, ellipseOutline, mergeGeometries, starOutline } from "../../kit/geometry.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { numberParam, seasonParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change la silhouette : inclinaison du fût, nombre et étagement des charpentières, touffes, asymétries."),
  season: seasonParam("Fleurs roses au printemps (par défaut), verdure et petites cerises en été, feu orange à l'automne, nu l'hiver.", "spring"),
  height: numberParam("Hauteur", 6, 4.5, 8, "Hauteur de l'arbre ; tout l'arbre garde ses proportions.", { step: 0.5, unit: "m" }),
  fullness: numberParam("Densité de la floraison", 1, 0.5, 1.2, "Quantité de fleurs et de feuilles (et de triangles)."),
};

export const meta = {
  id: "nature/trees/cherry",
  name: "Cerisier à fleurs",
  nameEn: "Cherry tree",
  category: "nature",
  subcategory: "trees",
  description:
    "Cerisier d'ornement au port étalé : couronne en dôme d'un rose vif en fleurs au printemps, corolles de cinq " +
    "pétales plus claires en surface et pétales tombés au pied ; verdure et petites cerises en été, feu orange en " +
    "automne, arbre nu en hiver. Forme différente pour chaque graine.",
  tags: [
    "cerisier", "sakura", "arbre", "feuillu", "végétation", "fleurs roses", "floraison", "pétales", "couronne étalée",
    "vent", "saisons", "jardin", "extérieur",
    "cherry tree", "sakura tree", "tree", "deciduous", "vegetation", "pink blossom", "bloom", "petals", "crown",
    "wind", "seasons", "outdoor", "procedural",
  ],
  biomes: ["village", "garden", "meadow", "forest"],
  version: 1,
  added: "2026-11-19",
  units: "1 unité = 1 mètre ; l'origine est au pied du tronc, au niveau du sol",
  footprint: { radius: 4, height: 6.8 },
  animated: ["wind"],
  params,
  variants: variantsOf("season", params.season),
};

// Rampes de couleurs, de l'ombre vers la lumière.
const BARK_RAMP = ["#432f3d", "#6a4a50", "#8f6a66", "#b28d78"];
const BARK_INK = "#231823";
const BLOSSOM_RAMP = ["#8d3f63", "#bd5a88", "#e087b3", "#f4b9d7", "#ffe6f0"];
const FLOWER_RAMP = ["#f0a2c4", "#f5bfda", "#fbdcea", "#fff3f7"];
const FRUIT_RAMP = ["#78202f", "#a82c42", "#d64a5c"];
const SEASONS = {
  spring: { ramp: BLOSSOM_RAMP, density: 1, leafK: 100, leafSize: [0.13, 0.19], flowers: true, petals: true },
  summer: { ramp: ["#2c5e46", "#3d8140", "#58a23c", "#85c244", "#c1e35f"], density: 1, leafK: 96, leafSize: [0.12, 0.18], fruits: true },
  autumn: { ramp: ["#7a3a1a", "#a85420", "#cf7726", "#ec9e3b", "#f8ca6b"], density: 0.88, leafK: 96, leafSize: [0.12, 0.18] },
  winter: { ramp: ["#2c5e46", "#3d8140", "#58a23c", "#85c244", "#c1e35f"], density: 0, leafK: 96, leafSize: [0.12, 0.18] },
};

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const lerp = THREE.MathUtils.lerp;

/**
 * Crée un cerisier à fleurs.
 * @param {{seed?: number, season?: "spring"|"summer"|"autumn"|"winter", height?: number, fullness?: number}} [params]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.asset` décrit l'asset créé
 */
export function create(params = {}) {
  const p = resolveParams(meta.params, params);
  const season = SEASONS[p.season];
  const shape = createRng(p.seed * 7919 + 23);
  const detail = createRng(p.seed * 104729 + 71); // fleurs, fruits, pétales au sol : n'influe pas sur la forme
  const s = p.height / 6; // échelle des proportions

  // --- Couronne : dôme plus large que haut, pointe arrondie, penché d'un côté par la graine.
  const crownBottom = shape.range(1.6, 2.1) * s;
  const crownTop = p.height;
  const crownWidth = shape.range(3.0, 3.6) * s; // rayon maximal
  const widest = shape.range(0.3, 0.42); // hauteur relative du plus large
  const crownLean = new THREE.Vector3(shape.range(-0.3, 0.3) * s, 0, shape.range(-0.3, 0.3) * s);
  const envelope = (y) => {
    const u = THREE.MathUtils.clamp((y - crownBottom) / (crownTop - crownBottom), 0, 1);
    if (u < widest) return crownWidth * (0.55 + 0.45 * Math.sin((u / widest) * Math.PI * 0.5));
    const v = (u - widest) / (1 - widest);
    return crownWidth * Math.pow(Math.max(0, 1 - v * v), 0.55);
  };
  const crownAxis = (y) => {
    const t = THREE.MathUtils.clamp((y - crownBottom) / (crownTop - crownBottom), 0, 1);
    return new THREE.Vector3(crownLean.x * t * t, y, crownLean.z * t * t);
  };

  // --- Fût : court, un peu penché, large au pied.
  const forkY = lerp(crownBottom, crownTop, shape.range(0.35, 0.48));
  const trunkPoints = [];
  for (let i = 0; i < 5; i++) {
    const t = i / 4;
    const wobble = i === 0 ? 0 : 0.07 * s;
    trunkPoints.push(new THREE.Vector3(
      crownLean.x * t * t * 0.6 + shape.range(-wobble, wobble),
      forkY * t,
      crownLean.z * t * t * 0.6 + shape.range(-wobble, wobble),
    ));
  }
  const baseRadius = shape.range(0.24, 0.29) * s;
  const trunk = buildTube(
    trunkPoints,
    (t) => lerp(baseRadius, baseRadius * 0.62, Math.pow(t, 1.2)) + baseRadius * 0.5 * Math.exp(-t * 16),
    { radialSegments: 7, lengthSegments: 9 },
  );
  const trunkCurve = trunk.userData.curve;
  const wood = [trunk];
  const minRadius = 0.035;
  const clumps = [];

  // --- Charpentières : 4 à 6 arcs montants qui s'étalent, en spirale autour du fût. Leurs pointes calent la silhouette.
  const limbCount = 4 + shape.int(0, 2);
  for (let i = 0; i < limbCount; i++) {
    const u = i / (limbCount - 1);
    const azimuth = i * 2.39996 + shape.range(-0.5, 0.5);
    const out = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const start = trunkCurve.getPoint(THREE.MathUtils.clamp(0.55 + u * 0.42 + shape.range(-0.06, 0.06), 0, 1));
    const tipY = lerp(crownBottom + (crownTop - crownBottom) * 0.25, crownTop - 0.35 * s, Math.pow(u, 0.9)) + shape.range(-0.1, 0.1) * s;
    const rise = tipY - start.y;
    const elbow = start.clone().lerp(crownAxis(tipY).addScaledVector(out, 0.2 * s), 0.55);
    const midY = crownBottom + (tipY - crownBottom) * lerp(0.9, 0.55, u);
    elbow.y = Math.max(start.y + rise * 0.35, midY);
    const tip = crownAxis(tipY).addScaledVector(out, envelope(tipY) * shape.range(0.82, 0.94));
    const span = tip.clone().sub(start);
    const preElbow = start.clone().addScaledVector(out, span.length() * 0.28);
    preElbow.y += rise * 0.55;
    const points = [start, preElbow, elbow, tip];
    const r0 = Math.max(minRadius, lerp(0.085, 0.055, u) * s);
    const limb = buildTube(points, (t) => lerp(r0, minRadius, Math.pow(t, 0.8)), {
      radialSegments: 5, lengthSegments: 6, vOffset: shape.range(3, 30),
    });
    wood.push(limb);
    const limbCurve = limb.userData.curve;

    // Bouquets au bout et à mi-branche.
    for (const [t, k] of [[0.62, 0.8], [1, 1]]) {
      const center = limbCurve.getPoint(t).add(new THREE.Vector3(0, 0.18 * s, 0));
      clumps.push({ center, radius: lerp(1.0, 0.72, u) * k * shape.range(0.9, 1.1) * s });
    }

    // Rameaux secondaires : un gros sur les charpentières basses, un discret partout.
    for (let j = 0; j < (u < 0.7 ? 2 : 1); j++) {
      const from = limbCurve.getPoint(shape.range(0.3, 0.7));
      const side = azimuth + (j === 0 ? 1 : -1) * shape.range(0.55, 1.05);
      const direction = new THREE.Vector3(Math.cos(side), shape.range(0.5, 0.95), Math.sin(side)).normalize();
      const length = shape.range(0.7, 1.1) * s * lerp(1, 0.75, u);
      const midTip = from.clone().addScaledVector(direction, length * 0.7);
      const tip2 = from.clone().addScaledVector(direction, length);
      tip2.y += length * 0.18; // pointe qui remonte, port du cerisier
      wood.push(buildTube([from, midTip, tip2], () => minRadius, { radialSegments: 4, lengthSegments: 3, vOffset: shape.range(3, 30) }));
      clumps.push({ center: tip2, radius: shape.range(0.62, 0.8) * s });
    }
  }

  // Remplissage du dôme : bouquets posés juste sous l'enveloppe, du bas vers le sommet.
  const fillCount = 15;
  const fillStart = shape.range(0, TAU);
  for (let i = 0; i < fillCount; i++) {
    const u = 0.1 + 0.85 * ((i + 0.5) / fillCount);
    const y = lerp(crownBottom + 0.25 * s, crownTop - 0.3 * s, u);
    const angle = fillStart + i * 2.39996;
    const radius = lerp(1.15, 0.7, u) * s;
    const reach = Math.max(0, envelope(y) - radius * 0.85);
    clumps.push({ center: crownAxis(y).add(new THREE.Vector3(Math.cos(angle) * reach, 0, Math.sin(angle) * reach)), radius: radius * shape.range(0.9, 1.08) });
  }
  clumps.push({ center: crownAxis(crownTop - 0.45 * s), radius: 0.72 * s }); // sommet

  const sway = { amplitude: 0.075 * s, height: p.height };
  const group = new THREE.Group();
  group.name = meta.name;

  const woodMesh = new THREE.Mesh(
    mergeGeometries(wood),
    createToonMaterial({
      ramp: BARK_RAMP,
      steps: [0.3, 0.52, 0.76],
      ink: BARK_INK,
      pattern: "bark",
      patternParams: [16, 0.34, 0.85 * s, 0.82],
      seed: p.seed % 97,
      id: 10,
      sway,
    }),
  );
  woodMesh.name = "wood";
  woodMesh.castShadow = true;
  woodMesh.receiveShadow = true;
  group.add(woodMesh);

  // --- Floraison et feuillage : masse de la couronne (bouquets) + accent qui flambe selon la saison
  // (corolles au printemps, cerises en été), posé sur les surfaces rendues des touffes.
  const mass = [];
  const accent = [];
  if (season.density > 0) {
    const canopyCenter = crownAxis(lerp(crownBottom, crownTop, 0.42));
    const density = season.density * p.fullness;
    const leafSize = () => shape.range(season.leafSize[0], season.leafSize[1]);

    for (const clump of clumps) {
      fillClump(shape, mass, {
        center: clump.center,
        radius: clump.radius,
        count: Math.round(density * season.leafK * clump.radius * clump.radius),
        canopyCenter,
        leafSize,
        squash: 0.88,
        sag: 0.22,
        canopyWeight: 0.55,
        coreSize: 0.5,
        shell: 0.48,
        flex: [0.5, 0.95],
      });
    }

    const shade = (position, direction) => leafNormal(position, direction, canopyCenter, 0.5);
    if (season.flowers) {
      // Corolles de cinq pétales, plus claires que la masse, en surface des touffes ; parfois en petites grappes.
      for (const clump of clumps) {
        const surface = fillClump(shape, [], {
          center: clump.center,
          radius: clump.radius,
          count: Math.round(density * 19 * clump.radius * clump.radius),
          canopyCenter,
          leafSize,
          core: false,
          squash: 0.88,
          sag: 0.22,
          canopyWeight: 0.55,
          shell: 0.62,
        });
        for (const { position, direction } of surface) {
          if (direction.y < -0.25 || !detail.chance(0.3 * Math.min(1.15, p.fullness))) continue;
          const normal = shade(position, direction);
          const cluster = detail.int(1, 2);
          for (let n = 0; n < cluster; n++) {
            accent.push({
              position: position.clone().add(new THREE.Vector3(detail.range(-0.05, 0.05), detail.range(-0.02, 0.05), detail.range(-0.05, 0.05))),
              outline: starOutline(5, 0.86),
              size: detail.range(0.09, 0.12),
              stretch: [1, 0.85],
              rotation: detail.range(0, TAU),
              normal,
              phase: detail.next(),
              variation: detail.next(),
              flex: 0.9,
            });
          }
        }
      }
      // Pétales tombés en nappes au pied.
      for (let i = 0; i < Math.round(48 * Math.min(1, density)); i++) {
        const angle = detail.range(0, TAU);
        const distance = detail.range(0.35, 3.1) * s;
        accent.push({
          position: new THREE.Vector3(Math.cos(angle) * distance, 0.04, Math.sin(angle) * distance),
          outline: starOutline(5, 0.86),
          size: detail.range(0.07, 0.1),
          stretch: [1, 0.85],
          rotation: detail.range(0, TAU),
          normal: UP,
          phase: detail.next(),
          variation: detail.next(),
          flex: 0,
        });
      }
    } else if (season.fruits) {
      // Cerises en paires pendues sous la surface des touffes.
      for (const clump of clumps) {
        const surface = fillClump(shape, [], {
          center: clump.center,
          radius: clump.radius,
          count: Math.round(density * 24 * clump.radius * clump.radius),
          canopyCenter,
          leafSize,
          core: false,
          squash: 0.88,
          sag: 0.22,
          canopyWeight: 0.55,
          shell: 0.6,
        });
        for (const { position, direction } of surface) {
          if (direction.y > 0.1 || !detail.chance(0.3)) continue;
          for (const [side, size] of [[-1, 0.075], [1, 0.065]]) {
            accent.push({
              position: position.clone().addScaledVector(direction, 0.07).add(new THREE.Vector3(side * 0.045, -0.05, 0)),
              outline: ellipseOutline(6),
              size: size * shape.range(0.9, 1.15),
              stretch: [1, 1.35],
              rotation: 0,
              normal: shade(position, direction),
              phase: detail.next(),
              variation: detail.next(),
              flex: 0.85,
            });
          }
        }
      }
    }

    // Automne : quelques feuilles mortes au pied.
    if (p.season === "autumn") {
      fallenLeaves(detail, mass, { count: 42, minRadius: 0.5 * s, maxRadius: 3.4 * s, leafSize: () => shape.range(0.08, 0.12) });
    }

    const addFoliage = (list, ramp, steps, name) => {
      const geometry = buildLeafGeometry(list);
      geometry.computeBoundingSphere();
      geometry.boundingSphere.radius += 0.6; // marge : taille des formes + vent
      const material = createToonMaterial({ ramp, steps, foliage: true, id: 11, sway });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.customDepthMaterial = material.userData.depthMaterial;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    addFoliage(mass, season.ramp, [0.22, 0.42, 0.6, 0.78], "leaves");
    if (accent.length > 0) {
      // Corolles et pétales de printemps : petites poses sur la masse (même identifiant de contour qu'elle).
      if (season.flowers) {
        const blossomGeometry = buildFanGeometry(accent);
        blossomGeometry.computeBoundingSphere();
        blossomGeometry.boundingSphere.radius += 0.4;
        const blossomMaterial = createToonMaterial({
          ramp: FLOWER_RAMP,
          steps: [0.3, 0.5, 0.7],
          foliage: true,
          id: 11,
          sway,
        });
        const blossomMesh = new THREE.Mesh(blossomGeometry, blossomMaterial);
        blossomMesh.name = "blossoms";
        blossomMesh.customDepthMaterial = blossomMaterial.userData.depthMaterial;
        blossomMesh.castShadow = true;
        blossomMesh.receiveShadow = true;
        group.add(blossomMesh);
      } else {
        const fruitGeometry = buildFanGeometry(accent);
        fruitGeometry.computeBoundingSphere();
        fruitGeometry.boundingSphere.radius += 0.4;
        const fruitMaterial = createToonMaterial({
          ramp: FRUIT_RAMP,
          steps: [0.4, 0.7],
          foliage: true,
          id: 12,
          sway,
        });
        const fruitMesh = new THREE.Mesh(fruitGeometry, fruitMaterial);
        fruitMesh.name = "fruits";
        fruitMesh.customDepthMaterial = fruitMaterial.userData.depthMaterial;
        fruitMesh.castShadow = true;
        fruitMesh.receiveShadow = true;
        group.add(fruitMesh);
      }
    }
  }

  group.userData.asset = {
    id: meta.id,
    params: p,
    leaves: mass.length,
    blossoms: accent.length,
  };
  return group;
}
