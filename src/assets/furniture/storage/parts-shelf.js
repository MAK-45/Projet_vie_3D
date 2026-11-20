// Étagères de réserve du Complexe (fiches ATE-07, E2-05, ETU-14, docs/complexe/) :
// - Pièces détachées (Atelier) : 2,0 × 0,5 × 2,2 m, montants de bronze, cinq niveaux de planches, sept bacs de bois par
//   niveau (0,25 × 0,35 × 0,15 m) étiquetés d'un point de laiton clair ; le contenu se lit en points de couleur :
//   rouages de bronze, ressorts vert-de-gris, bobines de cuivre, cristaux bruts cyan pâle. Quelques bacs tirés.
// - Tirages (salle 2) : 0,9 × 0,3 × 1,5 m, chêne noirci, cinq niveaux de cadres de verre couchés en piles (tranche de
//   bronze, étiquette d'un pixel), le cadre du dessus montre son tirage (papier clair à traits ambre) ; un ou deux
//   cadres appuyés debout au pied.
// - Étalons (salle 3, kit d'étude) : armoire de 0,7 × 0,4 × 1,6 m à porte vitrée (verre en trame), quatre étagères de
//   poids de laiton en rangs décroissants, de diapasons et de cristaux de référence, tiroir en bas.
// Plein, entamé, presque vide. La graine change les bacs tirés ou manquants et leur contenu, les piles de cadres, les
// rangs de poids, les tons du bois.
//
// 3 draw calls : bois, métal, et lueur des cristaux (pièces), papier des tirages, ou verre de la porte (étalons).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildGem, buildLathe } from "../../kit/geometry.js";
import { METALS, WOODS } from "../../kit/palettes.js";
import {
  beam, createRigidParts, glowMaterial, mergeParts, metalMaterial, plain, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = {
  parts: "Pièces détachées (Atelier, 2 m)",
  prints: "Tirages (salle 2, 0,9 m)",
  standards: "Armoire d'étalons (kit d'étude)",
};
const FILLS = { full: "Plein", some: "Entamé", empty: "Presque vide" };
const DOORS = { closed: "Fermée", open: "Ouverte" };
// Papier des tirages : un ambre pour les traits (ton bas), un papier clair jauni (tons hauts).
const PRINT = { ramp: ["#5a3418", "#b06a28", "#d8c9a0", "#f1e7c8"], ink: "#3a2412" };
// Verre de l'armoire, à peine bleuté ; les cristaux de référence sont dans la même matière, pleins et clairs.
const GLASS = { ramp: ["#3a4a4e", "#6c8888", "#a9c8c4", "#dcf4f0"], ink: "#1c2628" };

const params = {
  seed: seedParam("Change les bacs tirés ou manquants et leur contenu, les piles de cadres, les rangs de poids et de diapasons, les tons du bois."),
  model: choiceParam("Modèle", MODELS, "Grande étagère à bacs de l'Atelier, étagère de tirages encadrés, ou armoire vitrée d'étalons."),
  fill: choiceParam("Garni", FILLS, "Tout est en place, une partie a servi, ou presque tout a été pris."),
  door: choiceParam("Porte", DOORS, "Armoire d'étalons : porte vitrée fermée ou ouverte (userData.shelf.setDoor)."),
};

export const meta = {
  id: "furniture/storage/parts-shelf",
  name: "Étagère à pièces",
  nameEn: "Parts shelf",
  category: "furniture",
  subcategory: "storage",
  description:
    "Réserves du Complexe : grande étagère de l'Atelier à bacs de bois étiquetés (rouages, ressorts, bobines de cuivre, " +
    "cristaux bruts) ; étagère de tirages en cadres de verre couchés en piles ; armoire vitrée d'étalons (poids de " +
    "laiton, diapasons, cristaux de référence). Plein, entamé, presque vide. Fiches ATE-07, E2-05, ETU-14.",
  tags: [
    "étagère", "bacs", "pièces détachées", "rouages", "ressorts", "bobines", "cuivre", "cristaux", "étiquettes",
    "tirages", "cadres", "verre", "armoire", "étalons", "poids", "diapasons", "porte vitrée", "tiroir", "bronze",
    "chêne noirci", "atelier", "le complexe", "complexe", "ancien-tech", "rangement", "intérieur",
    "shelf", "bins", "spare parts", "gears", "springs", "coils", "copper wire", "crystals", "labels", "prints",
    "picture frames", "glass", "cabinet", "standards", "brass weights", "tuning forks", "glass door", "drawer",
    "bronze fittings", "blackened oak", "workshop", "ancient complex", "ancient-tech", "storage", "indoor",
    "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au milieu du dos (contre le mur, z = 0), la façade vers +z",
  footprint: { radius: 1.1, height: 2.5 },
  animated: [],
  params,
  variants: [
    { id: "parts", name: "Pièces détachées", params: {} },
    { id: "parts-empty", name: "Pièces, presque vide", params: { fill: "empty" } },
    { id: "prints", name: "Tirages", params: { model: "prints" } },
    { id: "standards", name: "Étalons", params: { model: "standards" } },
    { id: "standards-open", name: "Étalons, porte ouverte", params: { model: "standards", door: "open", fill: "some" } },
  ],
};

const lit = (t = 0, top = 0.14) => (x, y, z, nx, ny) => t + (ny > 0.5 ? top : ny < -0.5 ? -0.3 : 0);
const box = (size, position, rotation) => buildBlock(size, position, rotation);
const cylinder = (r, h, x, y, z, sides = 8) => plain(new THREE.CylinderGeometry(r, r, h, sides)).translate(x, y + h / 2, z);
const woodMaterial = (entry, seed) => createToonMaterial({
  ramp: entry.ramp, ink: entry.ink, steps: [0.26, 0.48, 0.74], tone: true, crease: true,
  pattern: "speckle", patternParams: [16, 0.05, 0.12, 1], seed: seed % 97, id: 20,
});

/**
 * Crée l'étagère.
 * @param {{seed?: number, model?: string, fill?: string, door?: string}} [given]
 * @returns {THREE.Group} `userData.shelf` : pièces : { bins: [{ kind, present, position }], slide(i, d) } ; tirages :
 *   { stacks } ; étalons : { setDoor(t) } ; et `userData.surface` (le dessus).
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 6151 + 211);
  const group = new THREE.Group();
  group.name = meta.name;
  if (p.model === "prints") buildPrints(group, p, rng);
  else if (p.model === "standards") buildStandards(group, p, rng);
  else buildParts(group, p, rng);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

/** Trois maillages (bois, métal, troisième matière), ombres portées sur les deux premiers. */
function addMeshes(group, entries) {
  const meshes = [];
  for (const [name, geometry, material, shadow] of entries) {
    if (!geometry) continue;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

// --- Pièces détachées ----------------------------------------------------------------------------------------------

function buildParts(group, p, rng) {
  const W = 2.0, D = 0.5, H = 2.2;
  // Chaque entrée : [géométrie, n° de bac ou 255] ; les bacs vont à la fin (pièces rigides).
  const fixedWood = [], fixedMetal = [];
  const tone = rng.range(-0.06, 0.06);
  // Montants d'angle et croix de bronze au dos.
  for (const x of [-W / 2 + 0.025, W / 2 - 0.025]) {
    for (const z of [0.025, D - 0.025]) fixedMetal.push(withTone(box([0.05, H, 0.05], [x, H / 2, z]), lit(0.05)));
    fixedMetal.push(withTone(box([0.03, 0.05, D - 0.05], [x, H - 0.08, D / 2]), 0.0));
    fixedMetal.push(withTone(box([0.03, 0.05, D - 0.05], [x, 0.12, D / 2]), 0.0));
  }
  fixedMetal.push(withTone(beam([-W / 2 + 0.05, 0.12, 0.015], [W / 2 - 0.05, H - 0.1, 0.015], 0.025, 0.025), -0.2));
  fixedMetal.push(withTone(beam([-W / 2 + 0.05, H - 0.1, 0.012], [W / 2 - 0.05, 0.12, 0.012], 0.025, 0.025), -0.2));
  // Planches : cinq niveaux et le dessus.
  const levels = [0.08, 0.5, 0.92, 1.34, 1.76];
  for (const y of [...levels, H - 0.03]) {
    fixedWood.push(withTone(box([W - 0.1, 0.03, D - 0.02], [0, y, D / 2]), lit(-0.78 + tone + rng.range(-0.04, 0.04), 0.1)));
    fixedMetal.push(withTone(box([W - 0.1, 0.012, 0.01], [0, y - 0.004, D - 0.005]), 0.1)); // chant de laiton
  }
  // Bacs : sept par niveau ; tirés, manquants et contenu selon la graine et le garni.
  const KINDS = ["gears", "springs", "coils", "crystals", "gears", "coils"];
  const missChance = { full: 0.03, some: 0.22, empty: 0.7 }[p.fill];
  const fullness = { full: 1, some: 0.6, empty: 0.25 }[p.fill];
  const bins = [];
  const binWood = [], binMetal = [], binGlow = [];
  const BW = 0.25, BD = 0.35, BH = 0.15;
  const gap = (W - 0.1 - 7 * BW) / 6;
  levels.forEach((ly, level) => {
    for (let i = 0; i < 7; i++) {
      const k = bins.length;
      const x = -W / 2 + 0.05 + BW / 2 + i * (BW + gap);
      const y = ly + 0.015;
      const present = !rng.chance(missChance);
      const pulled = present && rng.chance(0.14) ? rng.range(0.08, 0.2) : 0;
      const kind = rng.pick(KINDS);
      const z0 = 0.06;
      bins.push({ kind, present, position: new THREE.Vector3(x, y, z0 + BD / 2 + pulled), pulled });
      if (!present) continue;
      const t = tone + rng.range(-0.08, 0.08);
      const zc = z0 + BD / 2;
      // Caisson (dessus sombre = l'intérieur), façade plus haute d'un rebord, étiquette de laiton au milieu.
      binWood.push([withTone(box([BW, BH - 0.03, BD - 0.02], [x, y + (BH - 0.03) / 2, zc - 0.01]), (xx, yy, zz, nx, ny) => (ny > 0.5 ? -0.7 : t + 0.05)), k]);
      binWood.push([withTone(box([BW, BH, 0.02], [x, y + BH / 2, z0 + BD - 0.01]), lit(t + 0.22, 0.2)), k]);
      binMetal.push([withTone(box([0.07, 0.045, 0.008], [x, y + BH * 0.6, z0 + BD + 0.004]), 0.7), k]);
      // Contenu : quelques pièces qui dépassent du bac.
      const top = y + BH - 0.03;
      const count = Math.max(0, Math.round(rng.range(1.6, 3.4) * fullness));
      for (let c = 0; c < count; c++) {
        const cx = x + rng.range(-0.08, 0.08), cz = zc + rng.range(-0.11, 0.11);
        if (kind === "gears") {
          const g = plain(new THREE.CylinderGeometry(0.055, 0.055, 0.016, 7));
          g.rotateX(rng.range(-0.3, 0.3));
          g.translate(cx, top + 0.012 + c * 0.006, cz);
          binMetal.push([withTone(g, lit(0.3, 0.15)), k]);
        } else if (kind === "springs") {
          binMetal.push([withTone(cylinder(0.02, rng.range(0.05, 0.08), cx, top - 0.02, cz, 5), (xx, yy) => (Math.floor(yy / 0.012) % 2 ? -0.35 : -0.1)), k]);
        } else if (kind === "coils") {
          const g = plain(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 7));
          g.rotateZ(Math.PI / 2);
          g.rotateY(rng.range(-0.6, 0.6));
          g.translate(cx, top + 0.03, cz);
          binWood.push([withTone(g, lit(0.32, 0.12)), k]);
        } else {
          const g = plain(buildGem({ length: rng.range(0.06, 0.1), radius: 0.022, sides: 5, waist: 0.3, position: new THREE.Vector3(cx, top + 0.02, cz), direction: new THREE.Vector3(rng.range(-0.5, 0.5), 1, rng.range(-0.5, 0.5)) }));
          binGlow.push([g, k]);
        }
      }
    }
  });
  // Au-dessus : une caisse ou une bobine de câble, selon la graine.
  if (rng.chance(0.6)) fixedWood.push(withTone(box([0.5, 0.3, 0.4], [rng.range(-0.6, 0.6), H + 0.15, D / 2]), lit(-0.15)));
  else {
    const g = plain(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 10));
    g.rotateZ(Math.PI / 2);
    g.translate(rng.range(-0.6, 0.6), H + 0.16, D / 2);
    fixedWood.push(withTone(g, lit(0.3, 0.1)));
  }

  const n = bins.length;
  const woodParts = mergeParts([...fixedWood.map((g) => [g, 255]), ...binWood]);
  const metalParts = mergeParts([...fixedMetal.map((g) => [g, 255]), ...binMetal]);
  const glowParts = binGlow.length ? mergeParts(binGlow) : null;
  const [woodMesh, metalMesh, glowMesh] = addMeshes(group, [
    ["wood", woodParts.geometry, woodMaterial(WOODS.oak, p.seed), true],
    ["bronze", metalParts.geometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }), true],
    ["crystals", glowParts?.geometry, glowMaterial("cyan", { level: 2, id: 40 }), false],
  ]);
  const rigs = [createRigidParts(woodMesh.geometry, woodParts.partOf, n), createRigidParts(metalMesh.geometry, metalParts.partOf, n)];
  if (glowMesh) rigs.push(createRigidParts(glowMesh.geometry, glowParts.partOf, n));
  const slide = (i, d) => {
    const bin = bins[i];
    if (!bin) return;
    bin.pulled = THREE.MathUtils.clamp(d, 0, 0.3);
    bin.position.z = 0.06 + BD / 2 + bin.pulled;
    for (const rig of rigs) {
      rig.matrices[i].makeTranslation(0, 0, bin.pulled);
      rig.apply();
    }
  };
  bins.forEach((bin, i) => {
    for (const rig of rigs) rig.matrices[i].makeTranslation(0, 0, bin.pulled);
  });
  for (const rig of rigs) rig.apply();
  group.userData.shelf = { bins, slide };
  group.userData.surface = { y: H, size: [W, D] };
}

// --- Tirages -------------------------------------------------------------------------------------------------------

function buildPrints(group, p, rng) {
  const W = 0.9, D = 0.3, H = 1.5;
  const wood = [], metal = [], paper = [];
  const tone = rng.range(-0.05, 0.08);
  for (const s of [-1, 1]) wood.push(withTone(box([0.03, H, D], [s * (W / 2 - 0.015), H / 2, D / 2]), lit(tone)));
  wood.push(withTone(box([W - 0.06, H - 0.04, 0.015], [0, H / 2, 0.0075]), -0.5));
  const levels = [0.05, 0.34, 0.63, 0.92, 1.21];
  for (const y of [...levels, H - 0.02]) wood.push(withTone(box([W - 0.06, 0.025, D - 0.01], [0, y, D / 2]), lit(tone + 0.05, 0.12)));
  wood.push(withTone(box([W + 0.02, 0.03, D + 0.02], [0, H + 0.015, D / 2]), lit(tone + 0.1)));
  const fullness = { full: [3, 6], some: [1, 4], empty: [0, 1] }[p.fill];
  const stacks = [];
  const frame = (x, y, z, ry, showPrint) => {
    metal.push(withTone(box([0.4, 0.022, 0.26], [x, y + 0.011, z], [0, ry, 0]), lit(-0.05, 0.25)));
    // Étiquette d'un pixel sur la tranche avant.
    const label = box([0.05, 0.012, 0.004], [0, 0, 0]);
    label.rotateY(ry);
    label.translate(x + Math.sin(ry) * 0.13, y + 0.011, z + Math.cos(ry) * 0.132);
    paper.push(withTone(label, 0.3));
    if (showPrint) printFace(paper, rng, new THREE.Matrix4().makeRotationY(ry).setPosition(x, y + 0.023, z));
  };
  levels.forEach((ly) => {
    for (const sx of [-0.215, 0.215]) {
      const count = rng.int(fullness[0], fullness[1]);
      stacks.push({ x: sx, y: ly + 0.0125, count });
      for (let c = 0; c < count; c++) frame(sx + rng.range(-0.012, 0.012), ly + 0.0125 + c * 0.024, D / 2 + 0.005, rng.range(-0.04, 0.04), c === count - 1);
    }
  });
  // Un ou deux cadres appuyés debout au pied de l'étagère, le tirage vers l'extérieur.
  for (let i = 0; i < rng.int(p.fill === "full" ? 0 : 1, 2); i++) {
    const m = new THREE.Matrix4().makeTranslation(rng.range(-0.3, 0.3), 0, D + 0.08 + i * 0.03)
      .multiply(new THREE.Matrix4().makeRotationY(rng.range(-0.15, 0.15)))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.22))
      .multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.15));
    metal.push(withTone(box([0.4, 0.022, 0.3], [0, 0.011, 0]).applyMatrix4(m), lit(-0.05, 0.25)));
    printFace(paper, rng, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.023, 0)), 0.3);
  }
  addMeshes(group, [
    ["wood", mergeToned(wood), woodMaterial(WOODS.blackenedOak, p.seed), true],
    ["frames", mergeToned(metal), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }), true],
    ["prints", mergeToned(paper), createToonMaterial({ ramp: PRINT.ramp, ink: PRINT.ink, steps: [0.2, 0.42, 0.7], tone: true, id: 21 }), false],
  ]);
  group.userData.shelf = { stacks };
  group.userData.surface = { y: H + 0.03, size: [W + 0.02, D + 0.02] };
}

/** Tirage : feuille claire et trois à cinq traits ambre (plan, coupe, courbe), dans le repère `m` (face vers +y). */
function printFace(paper, rng, m, depth = 0.22) {
  paper.push(withTone(box([0.34, 0.004, depth], [0, 0.002, 0]).applyMatrix4(m), 0.15));
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const horizontal = rng.chance(0.6);
    const len = rng.range(0.1, 0.26);
    const size = horizontal ? [len, 0.003, 0.016] : [0.016, 0.003, Math.min(len, depth - 0.06)];
    const pos = [rng.range(-0.15 + size[0] / 2, 0.15 - size[0] / 2), 0.005, rng.range(-depth / 2 + 0.03 + size[2] / 2, depth / 2 - 0.03 - size[2] / 2)];
    paper.push(withTone(box(size, pos).applyMatrix4(m), -0.75));
  }
}

// --- Armoire d'étalons ---------------------------------------------------------------------------------------------

function buildStandards(group, p, rng) {
  const W = 0.7, D = 0.4, H = 1.6;
  const wood = [], metal = [], glass = [];
  const doorWood = [], doorMetal = [], doorGlass = [];
  const tone = rng.range(-0.05, 0.08);
  // Caisson : flancs, dos sombre, socle à tiroir, corniche.
  for (const s of [-1, 1]) wood.push(withTone(box([0.03, H - 0.06, D], [s * (W / 2 - 0.015), (H - 0.06) / 2 + 0.06, D / 2]), lit(tone)));
  wood.push(withTone(box([W - 0.06, H - 0.1, 0.015], [0, H / 2, 0.0075]), -0.25));
  wood.push(withTone(box([W + 0.02, 0.06, D + 0.01], [0, 0.03, D / 2]), lit(tone - 0.1)));
  wood.push(withTone(box([W + 0.04, 0.04, D + 0.03], [0, H - 0.02, D / 2 + 0.01]), lit(tone + 0.1)));
  wood.push(withTone(box([W - 0.06, 0.22, D - 0.02], [0, 0.17, D / 2 - 0.01]), lit(tone - 0.05)));
  wood.push(withTone(box([W - 0.08, 0.18, 0.015], [0, 0.17, D - 0.012]), lit(tone + 0.14, 0.2))); // façade du tiroir
  metal.push(withTone(box([0.12, 0.025, 0.02], [0, 0.18, D + 0.005]), lit(0.3)));
  const shelves = [0.28, 0.6, 0.92, 1.24];
  for (const y of shelves) wood.push(withTone(box([W - 0.06, 0.02, D - 0.06], [0, y, D / 2 - 0.02]), lit(tone + 0.05, 0.12)));
  // Contenu : chaque étagère porte une sorte d'étalons (ordre de la graine).
  const kinds = ["weights", "weights", "forks", "crystals"];
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  const keep = { full: 1, some: 0.65, empty: 0.2 }[p.fill];
  shelves.forEach((sy, level) => {
    const y = sy + 0.01;
    const kind = kinds[level];
    if (kind === "weights") {
      // Rang décroissant : du gros poids à bouton au petit plot.
      const count = rng.int(5, 7);
      let x = -W / 2 + 0.08;
      for (let i = 0; i < count; i++) {
        const r = 0.055 - i * 0.0065;
        if (rng.chance(keep)) {
          const h = r * 1.5;
          metal.push(withTone(plain(buildLathe([[0, 0], [r, 0], [r, h * 0.8], [r * 0.45, h * 0.85], [r * 0.45, h], [0, h]], { segments: 8, facets: true })).translate(x + r, y, D / 2 - 0.02 + rng.range(-0.03, 0.03)), lit(0.2, 0.15)));
        }
        x += r * 2 + 0.018;
      }
    } else if (kind === "forks") {
      // Diapasons debout sur leur socle de bois, du grand au petit.
      for (let i = 0; i < 4; i++) {
        if (!rng.chance(keep)) continue;
        const x = -W / 2 + 0.11 + i * 0.155, z = D / 2 - 0.02;
        const h = 0.22 - i * 0.03;
        wood.push(withTone(box([0.1, 0.03, 0.08], [x, y + 0.015, z]), lit(tone + 0.2)));
        metal.push(withTone(box([0.012, 0.05, 0.012], [x, y + 0.055, z]), 0.2));
        metal.push(withTone(box([0.05, 0.012, 0.012], [x, y + 0.085, z]), 0.2));
        for (const s of [-1, 1]) metal.push(withTone(box([0.012, h, 0.012], [x + s * 0.019, y + 0.09 + h / 2, z]), lit(0.25)));
      }
    } else {
      // Cristaux de référence sur un coussin de feutre (bois très sombre).
      wood.push(withTone(box([W - 0.16, 0.025, D - 0.14], [0, y + 0.0125, D / 2 - 0.02]), -0.85));
      for (let i = 0; i < 6; i++) {
        if (!rng.chance(keep)) continue;
        const x = -W / 2 + 0.13 + i * 0.09;
        const len = rng.range(0.06, 0.11);
        const g = plain(buildGem({ length: len, radius: 0.022, sides: 6, waist: 0.4, position: new THREE.Vector3(x, y + 0.025 + len * 0.4, D / 2 - 0.02 + rng.range(-0.04, 0.04)), direction: new THREE.Vector3(rng.range(-0.2, 0.2), 1, 0) }));
        glass.push(cover(withTone(g, 0.25), 1));
      }
    }
  });
  // Porte vitrée : cadre de chêne et vitre en trame, charnière à gauche, bouton de laiton à droite.
  const y0 = 0.29, y1 = H - 0.045, dz = D + 0.012;
  const dh = y1 - y0, dw = W - 0.04;
  for (const [w, h, x, y] of [[0.05, dh, -dw / 2 + 0.025, y0 + dh / 2], [0.05, dh, dw / 2 - 0.025, y0 + dh / 2], [dw, 0.05, 0, y0 + 0.025], [dw, 0.05, 0, y1 - 0.025], [dw, 0.03, 0, y0 + dh * 0.5]]) {
    doorWood.push(withTone(box([w, h, 0.025], [x, y, dz]), lit(tone + 0.08)));
  }
  doorMetal.push(withTone(plain(new THREE.SphereGeometry(0.016, 6, 4)).translate(dw / 2 - 0.03, y0 + dh * 0.55, dz + 0.025), 0.3));
  for (const y of [y0 + 0.12, y1 - 0.12]) metal.push(withTone(box([0.02, 0.06, 0.02], [-W / 2 + 0.01, y, dz]), 0.1));
  doorGlass.push(cover(withTone(box([dw - 0.08, dh - 0.08, 0.006], [0, y0 + dh / 2, dz]), -0.2), 0.24));

  const woodParts = mergeParts([...wood.map((g) => [g, 255]), ...doorWood.map((g) => [g, 0])]);
  const metalParts = mergeParts([...metal.map((g) => [g, 255]), ...doorMetal.map((g) => [g, 0])]);
  const glassParts = mergeParts([...glass.map((g) => [g, 255]), ...doorGlass.map((g) => [g, 0])]);
  const [woodMesh, metalMesh, glassMesh] = addMeshes(group, [
    ["wood", woodParts.geometry, woodMaterial(WOODS.walnut, p.seed), true],
    ["brass", metalParts.geometry, metalMaterial(METALS.bronze, { id: 30, tone: true }), true],
    ["glass", glassParts.geometry, createToonMaterial({ ramp: GLASS.ramp, ink: GLASS.ink, steps: [0.25, 0.5, 0.8], tone: true, dither: true, outline: false, id: 32 }), false],
  ]);
  const rigs = [
    createRigidParts(woodMesh.geometry, woodParts.partOf, 1),
    createRigidParts(metalMesh.geometry, metalParts.partOf, 1),
    createRigidParts(glassMesh.geometry, glassParts.partOf, 1),
  ];
  const hinge = new THREE.Vector3(-W / 2 + 0.01, 0, dz);
  const setDoor = (t) => {
    const a = -THREE.MathUtils.clamp(t, 0, 1) * 1.9;
    const m = new THREE.Matrix4().makeTranslation(hinge.x, 0, hinge.z)
      .multiply(new THREE.Matrix4().makeRotationY(a))
      .multiply(new THREE.Matrix4().makeTranslation(-hinge.x, 0, -hinge.z));
    for (const rig of rigs) {
      rig.matrices[0].copy(m);
      rig.apply();
    }
  };
  setDoor(p.door === "open" ? 1 : 0);
  group.userData.shelf = { setDoor };
  group.userData.surface = { y: H, size: [W + 0.04, D + 0.03] };
}

/** Part de pixels dessinés (`aCover`) d'une géométrie du verre en trame. */
function cover(geometry, value) {
  geometry.setAttribute("aCover", new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(value), 1));
  return geometry;
}

function mergeToned(list) {
  return mergeParts(list.map((g) => [g, 255])).geometry;
}
