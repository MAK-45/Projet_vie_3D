// Lune : disque face caméra dont la partie éclairée suit la phase (pleine, gibbeuse, quartier, croissant), avec
// une pénombre le long de la limite jour/nuit, des mers sombres, de petits cratères et un liseré clair sur le bord.
// Lumineuse par elle-même, insensible aux ombres. Entièrement procédurale, 1 draw call.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildFanGeometry, buildSpriteGeometry, ellipseOutline, mergeGeometries } from "../../kit/geometry.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

// terminator : position de la limite jour/nuit sur chaque ligne, de -1 (bord opposé : pleine) à 1 (nouvelle lune).
const PHASES = {
  full: { label: "Pleine lune", terminator: -1 },
  gibbous: { label: "Gibbeuse", terminator: -0.5 },
  quarter: { label: "Quartier", terminator: 0 },
  crescent: { label: "Croissant", terminator: 0.42 },
};

// Contour, (libre), mers et pénombre, surface, liseré : ombres froides, lumières chaudes.
const RAMP = ["#2c3260", "#4d5791", "#a3abcb", "#e2e3ea", "#fffbec"];

const params = {
  seed: seedParam("Change le visage : place et taille des mers et des cratères, inclinaison, lune croissante ou décroissante."),
  phase: choiceParam("Phase", PHASES, "Partie éclairée : pleine lune, gibbeuse, quartier ou fin croissant."),
  size: numberParam("Diamètre", 2.4, 1.2, 4, "Diamètre du disque.", { step: 0.2, unit: "m" }),
};

export const meta = {
  id: "nature/sky/moon",
  name: "Lune",
  nameEn: "Moon",
  category: "nature",
  subcategory: "sky",
  description:
    "Lune en pixel art, toujours face à la caméra : partie éclairée selon la phase (pleine, gibbeuse, quartier, " +
    "croissant), pénombre, mers et cratères. La graine change les mers, l'inclinaison et le sens.",
  tags: [
    "lune", "astre", "ciel", "nuit", "croissant", "pleine lune", "cratères", "lumineux", "phases lunaires", "extérieur",
    "moon", "celestial", "sky", "night", "crescent", "full moon", "craters", "glowing", "phases", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "garden", "village", "desert", "snow", "swamp", "beach", "mountain"],
  version: 1,
  added: "2026-11-16",
  units:
    "1 unité = 1 mètre (taille de présentation : un monde l'agrandit et le place loin) ; l'origine est au sol, " +
    "le disque flotte juste au-dessus",
  footprint: { radius: 1.2, height: 3.5 },
  animated: [],
  params,
  variants: variantsOf("phase", params.phase),
};

const ROWS = 18;

/** Bande entre deux bords gauche(y) et droite(y) du disque unité, en lignes : un croissant n'est pas un éventail. */
function band(left, right) {
  const points = [];
  const triangles = [];
  for (let i = 0; i <= ROWS; i++) {
    const t = (i / ROWS) * Math.PI;
    const y = Math.cos(t);
    const s = Math.sin(t);
    points.push([left(s, y), y], [right(s, y), y]);
    if (i > 0) {
      const a = (i - 1) * 2;
      triangles.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  return { points, triangles };
}

/**
 * Crée une lune.
 * @param {{seed?: number, phase?: "full"|"gibbous"|"quarter"|"crescent", size?: number}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.asset` décrit l'asset créé
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const k = PHASES[p.phase].terminator;
  const shape = createRng(p.seed * 7919 + 17);
  const radius = p.size / 2;
  const center = new THREE.Vector3(0, radius + 1.1, 0);

  // Le côté éclairé (droite ou gauche) et l'inclinaison de l'axe viennent de la graine.
  const side = shape.chance(0.5) ? 1 : -1;
  const rotation = shape.range(-0.45, 0.45);
  const common = { position: center, size: radius, rotation, phase: 0, flex: 0 };
  const sprites = [];
  const fans = [];
  const at = (x, y) => [x * side, y]; // miroir pour une lune décroissante
  const mirror = ({ points, triangles }) => ({
    points: points.map(([x, y]) => at(x, y)),
    triangles, // matériau double face : l'ordre des sommets n'importe pas
  });

  // Partie éclairée : entre la limite jour/nuit (ellipse) et le bord. La face cachée n'est pas dessinée : sur un
  // ciel de jour, un disque bleu nuit écrasait le croissant.
  sprites.push({ ...common, ...mirror(band((s) => k * s, (s) => s)), occlusion: 0.7, lift: 0.02 });

  // Pénombre : une bande grise le long de la limite jour/nuit (le bord gauche pour la pleine lune) donne le volume.
  const dusk = band((s) => k * s, (s) => Math.min(s, k * s + 0.2 * Math.sqrt(s) * (1 - 0.4 * Math.max(0, k))));
  sprites.push({ ...common, ...mirror(dusk), occlusion: 0.5, lift: 0.025 });

  // Liseré clair le long du bord éclairé, surtout en haut.
  const rim = band((s) => Math.max(k * s, s - 0.16 * Math.sqrt(s)), (s) => s);
  sprites.push({ ...common, ...mirror(rim), occlusion: 0.9, lift: 0.03 });

  // Mers et cratères : gardés seulement s'ils tombent entièrement dans la partie éclairée, loin du liseré.
  const lit = (x, y, r) => {
    const s = Math.sqrt(Math.max(0, 1 - y * y));
    return Math.hypot(x, y) + r < 0.82 && x - r > k * s + 0.2 && Math.abs(y) + r < 0.9;
  };
  const marks = [];
  const tries = 40;
  for (let i = 0; i < tries && marks.length < 7; i++) {
    const big = marks.length < 3;
    const r = big ? shape.range(0.16, 0.3) : shape.range(0.08, 0.12);
    const angle = shape.range(0, Math.PI * 2);
    const distance = Math.sqrt(shape.next()) * 0.8;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    if (!lit(x, y, r) || marks.some((m) => Math.hypot(m.x - x, m.y - y) < m.r + r + 0.04)) continue;
    marks.push({ x, y, r, big });
  }
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  for (const mark of marks) {
    const [x, y] = at(mark.x, mark.y);
    const offset = [(x * cos - y * sin) * radius, (x * sin + y * cos) * radius];
    const stretch = mark.big ? [shape.range(1, 1.4), 1] : [1, 1];
    fans.push({
      ...common,
      outline: ellipseOutline(mark.big ? 12 : 8),
      size: mark.r * radius,
      stretch,
      rotation: rotation + shape.range(0, Math.PI),
      offset,
      normal: UP,
      variation: 0.5,
      occlusion: 0.5,
      lift: 0.04,
    });
    // Petit cratère : un éclat clair sur son bord bas, côté soleil.
    if (!mark.big) {
      fans.push({
        ...common,
        outline: ellipseOutline(6),
        size: mark.r * radius * 0.45,
        offset: [offset[0] + side * mark.r * radius * 0.35, offset[1] - mark.r * radius * 0.35],
        normal: UP,
        variation: 0.5,
        occlusion: 0.9,
        lift: 0.05,
      });
    }
  }

  const geometries = [buildSpriteGeometry(sprites)];
  if (fans.length) geometries.push(buildFanGeometry(fans));

  const group = new THREE.Group();
  group.name = meta.name;
  const material = createToonMaterial({
    ramp: RAMP,
    steps: [0.2, 0.4, 0.6, 0.8],
    foliage: true,
    unlit: true,
    leafShade: [0, 1],
    id: 21,
  });
  const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.boundingSphere.radius += radius * 1.1;
  mesh.name = "moon";
  group.add(mesh);

  group.userData.asset = { id: meta.id, params: p, craters: marks.length };
  return group;
}

const UP = new THREE.Vector3(0, 1, 0);
