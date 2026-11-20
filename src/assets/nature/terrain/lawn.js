// Pelouse : une motte de gazon semée de brins face à la caméra, en plaque au bord irrégulier ou en dalle carrée
// qui se raccorde à ses voisines. Tondue, haute ou folle (avec des pâquerettes). 2 ou 3 draw calls.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBladeGeometry, buildFanGeometry, buildGroundTile, buildMound, starOutline } from "../../kit/geometry.js";
import { FLOWERS, GRASSES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seasonParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change le contour de la plaque, les zones plus drues ou plus rases, la place des fleurs."),
  season: seasonParam("Vert vif au printemps, blondi en automne, ras et jauni en hiver."),
  cut: choiceParam(
    "Coupe",
    { mown: "Tondue", long: "Haute", wild: "Folle" },
    "Tondue : gazon ras et régulier. Haute : brins longs qui ploient. Folle : hauteurs mêlées, touffes et pâquerettes.",
  ),
  shape: choiceParam(
    "Forme",
    { patch: "Plaque", tile: "Dalle carrée" },
    "Plaque au bord irrégulier, à poser seule ; ou dalle carrée dont les bords se raccordent à la dalle voisine.",
  ),
  size: numberParam("Largeur", 1.6, 0.5, 3, "Largeur de la plaque ou côté de la dalle.", { step: 0.1, unit: "m" }),
  fullness: numberParam("Densité", 1, 0.5, 1.5, "Nombre de brins (et de triangles)."),
};

export const meta = {
  id: "nature/terrain/lawn",
  name: "Pelouse",
  nameEn: "Lawn",
  category: "nature",
  subcategory: "terrain",
  description:
    "Pelouse : motte de gazon couverte de brins qui ondulent au vent. Tondue, haute ou folle avec des pâquerettes ; " +
    "en plaque au bord irrégulier ou en dalle carrée raccordable. Quatre saisons.",
  tags: [
    "pelouse", "gazon", "herbe", "prairie", "pâquerettes", "dalle", "sol", "terrain", "végétation", "vent", "saisons",
    "extérieur",
    "lawn", "turf", "grass", "meadow", "daisies", "tile", "ground", "vegetation", "wind", "seasons", "outdoor",
    "procedural",
  ],
  biomes: ["meadow", "garden", "village", "forest"],
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au centre de la plaque",
  footprint: { radius: 1.05, height: 0.48 },
  animated: ["wind"],
  params,
  variants: variantsOf("season", params.season),
};

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const DAISY = starOutline(5, 0.55);

// Par coupe : écart entre deux brins (m), hauteur [min, max], tronçons, ouverture (fraction de la hauteur).
const CUTS = {
  mown: { spacing: 0.085, height: [0.07, 0.13], segments: 1, open: 0.25, flowers: 0 },
  long: { spacing: 0.11, height: [0.16, 0.3], segments: 2, open: 0.55, flowers: 0 },
  wild: { spacing: 0.1, height: [0.06, 0.46], segments: 2, open: 0.45, flowers: 1 },
};

/**
 * Crée une pelouse.
 * @param {{seed?: number, season?: string, cut?: "mown"|"long"|"wild", shape?: "patch"|"tile", size?: number, fullness?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const noise = createNoise3(p.seed);
  const cut = CUTS[p.cut];
  const winter = p.season === "winter";
  const half = p.size / 2;
  const tile = p.shape === "tile";
  const grass = GRASSES[p.season];

  // --- Motte : plaque lobée ou dalle carrée, légèrement bosselée.
  const relief = (x, z) => (noise(x * 2 + 3, 0.5, z * 2) - 0.5) * 0.03;
  let inside;
  let sodGeometry;
  if (tile) {
    sodGeometry = buildGroundTile({ size: p.size, height: 0.03, divisions: Math.max(3, Math.round(p.size * 4)), relief });
    const margin = 0.02;
    inside = (x, z) => Math.abs(x) < half - margin && Math.abs(z) < half - margin;
  } else {
    const radius = [half, half * shape.range(0.7, 0.95)];
    sodGeometry = buildMound(shape, { radius, height: 0.035, lobes: 0.3, power: 0.25, relief, rings: 4, sectors: 22, rotation: shape.range(0, TAU) });
    const outline = outerRing(sodGeometry, 4, 22);
    inside = (x, z) => insidePolygon(outline, x * 1.07, z * 1.07);
  }

  // Zones plus drues et plus rases (bruit), pour casser la régularité.
  const vigor = (x, z) => noise(x * 1.3, 7.5, z * 1.3);

  const blades = [];
  const flowers = [];
  const spacing = cut.spacing / Math.sqrt(p.fullness);
  const cells = Math.ceil(p.size / spacing);
  const heightScale = winter ? 0.7 : p.season === "autumn" ? 0.9 : 1;
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const x = -half + (j + detail.next()) * spacing;
      const z = -half + (i + detail.next()) * spacing;
      if (!inside(x, z)) continue;
      const v = vigor(x, z);
      if (p.cut !== "mown" && v < 0.25 && detail.chance(0.5)) continue; // trouées
      const base = new THREE.Vector3(x, 0, z);
      const azimuth = detail.range(0, TAU);
      const out = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
      let h = THREE.MathUtils.lerp(cut.height[0], cut.height[1], p.cut === "mown" ? detail.next() : Math.min(1, v * 1.3 * detail.range(0.5, 1.1)));
      h *= heightScale;
      const open = h * cut.open * detail.range(0.4, 1.2) * (winter ? 1.6 : 1);
      const tip = base.clone().addScaledVector(out, open).addScaledVector(UP, h * (winter ? 0.75 : 1));
      if (tile) {
        tip.x = THREE.MathUtils.clamp(tip.x, -half, half);
        tip.z = THREE.MathUtils.clamp(tip.z, -half, half);
      }
      blades.push({
        base,
        bend: base.clone().addScaledVector(out, open * 0.25).addScaledVector(UP, h * 0.7),
        tip,
        width: detail.range(0.075, 0.1),
        normal: out.clone().addScaledVector(UP, 1.3).normalize(),
        phase: detail.next(),
        variation: detail.next(),
        flex: p.cut === "mown" ? 0.15 : detail.range(0.3, 0.55),
        baseOcclusion: 0.15,
      });

      // Pelouse folle : des pâquerettes, regroupées là où l'herbe est rase.
      if (cut.flowers && !winter && v < 0.55 && detail.chance(p.season === "autumn" ? 0.05 : 0.14)) {
        flowers.push({
          position: base.clone().add(new THREE.Vector3(detail.range(-0.03, 0.03), cut.height[1] * heightScale * detail.range(0.55, 0.85), detail.range(-0.03, 0.03))),
          outline: DAISY,
          size: detail.range(0.075, 0.095),
          rotation: detail.range(0, TAU),
          normal: new THREE.Vector3(detail.range(-0.3, 0.3), 1, detail.range(-0.3, 0.3)).normalize(),
          phase: detail.next(),
          variation: detail.next(),
          flex: 0.3,
        });
      }
    }
  }

  const group = new THREE.Group();
  group.name = meta.name;

  const sod = new THREE.Mesh(
    sodGeometry,
    createToonMaterial({ ramp: grass.sod, steps: [0.36, 0.58, 0.8], pattern: "speckle", patternParams: [16, 0.08, 0.2, 1], seed: p.seed % 89, id: 11 }),
  );
  sod.name = "sod";
  sod.receiveShadow = true;
  group.add(sod);

  const maxHeight = cut.height[1] * heightScale;
  const sway = { amplitude: 0.05 * maxHeight, height: maxHeight };
  const bladeGeometry = buildBladeGeometry(blades, { segments: cut.segments });
  bladeGeometry.computeBoundingSphere();
  bladeGeometry.boundingSphere.radius += 0.1;
  const bladeMaterial = createToonMaterial({
    ramp: grass.ramp,
    steps: [0.24, 0.42, 0.6, 0.78],
    foliage: true,
    leafShade: [0.16, 0.45],
    id: 11, // même identifiant que la motte : pas de contour autour de chaque brin
    sway,
  });
  const bladeMesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
  bladeMesh.name = "grass";
  bladeMesh.customDepthMaterial = bladeMaterial.userData.depthMaterial;
  bladeMesh.castShadow = p.cut !== "mown";
  bladeMesh.receiveShadow = true;
  group.add(bladeMesh);

  if (flowers.length) {
    const flowerMaterial = createToonMaterial({ ramp: FLOWERS.daisy.petals, steps: [0.25, 0.45, 0.65], foliage: true, leafShade: [0.1, 0], id: 11, sway });
    const flowerMesh = new THREE.Mesh(buildFanGeometry(flowers), flowerMaterial);
    flowerMesh.name = "daisies";
    flowerMesh.customDepthMaterial = flowerMaterial.userData.depthMaterial;
    flowerMesh.receiveShadow = true;
    group.add(flowerMesh);
  }

  group.userData.asset = { id: meta.id, params: p, blades: blades.length, flowers: flowers.length };
  return group;
}

/** Contour extérieur [x, z] d'une butte de `buildMound` (dernier anneau). */
function outerRing(geometry, rings, sectors) {
  const position = geometry.attributes.position;
  const start = 1 + (rings - 1) * sectors;
  const ring = [];
  for (let s = 0; s < sectors; s++) ring.push([position.getX(start + s), position.getZ(start + s)]);
  return ring;
}

function insidePolygon(polygon, x, z) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i];
    const [xj, zj] = polygon[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
