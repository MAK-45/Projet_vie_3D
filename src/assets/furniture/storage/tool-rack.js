// Râtelier à outils mural de l'Atelier du Complexe (fiche ATE-05, docs/complexe/PIECES.md) : 2,0 × 0,15 × 1,2 m.
// Planche de chêne noirci (trois planches et deux traverses), crochets de bronze, et pour chaque outil sa silhouette
// peinte en blanc usé : un liseré d'un pixel autour de l'outil accroché, une forme pleine là où l'outil a été pris.
// Douze emplacements sur deux rangs : marteau, maillet, clé, pince, scie à métaux, tournevis, lime, burin, compas,
// équerre, ciseaux de tôlier, pied à coulisse. Une tablette basse sur deux consoles.
// Plein, quelques outils pris, presque vide. La graine change l'ordre des emplacements, les outils manquants, les tons
// des planches, l'usure de la peinture, le petit penché des outils sur leur crochet.
//
// 3 draw calls : bois (planches, manches), bronze (crochets, fers), peinture des silhouettes (sans contour).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads } from "../../kit/geometry.js";
import { METALS, WOODS } from "../../kit/palettes.js";
import { PX, beam, mergeToned, metalMaterial, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const FILLS = {
  some: "Quelques outils pris",
  full: "Plein",
  empty: "Presque vide",
};
// Peinture blanche usée : craie, ombre gris-bleu.
const PAINT = { ramp: ["#5f5a5c", "#948f86", "#bfb9a9", "#d9d2bc"] };
const W = 2.0, H = 1.2, BOTTOM = 1.0, BOARD = 0.04;

// Outils : des rectangles dans le plan de la planche (x vers la droite, y vers le haut, centrés sur le crochet),
// [largeur, hauteur, x, y, angle, matière] ; matière 0 = bois (manche), 1 = fer.
const TOOLS = {
  hammer: [[0.035, 0.28, 0, -0.14, 0, 0], [0.14, 0.05, 0, 0.02, 0, 1]],
  mallet: [[0.03, 0.24, 0, -0.14, 0, 0], [0.13, 0.08, 0, 0.02, 0, 0]],
  wrench: [[0.032, 0.26, 0, -0.13, 0, 1], [0.085, 0.04, 0, 0.02, 0, 1], [0.022, 0.05, -0.03, 0.06, 0, 1], [0.022, 0.05, 0.03, 0.06, 0, 1]],
  pliers: [[0.026, 0.19, -0.022, -0.14, -0.12, 1], [0.026, 0.19, 0.022, -0.14, 0.12, 1], [0.05, 0.08, 0, 0.0, 0, 1]],
  saw: [[0.36, 0.024, 0, 0.0, 0, 1], [0.024, 0.13, -0.17, -0.06, 0, 1], [0.024, 0.13, 0.17, -0.06, 0, 1], [0.34, 0.016, 0, -0.115, 0, 1], [0.045, 0.1, 0.205, -0.03, 0.4, 0]],
  screwdriver: [[0.045, 0.11, 0, -0.06, 0, 0], [0.02, 0.15, 0, -0.19, 0, 1]],
  file: [[0.038, 0.09, 0, -0.05, 0, 0], [0.03, 0.22, 0, -0.2, 0, 1]],
  chisel: [[0.045, 0.1, 0, -0.06, 0, 0], [0.032, 0.14, 0, -0.18, 0, 1]],
  compass: [[0.045, 0.045, 0, 0, 0, 1], [0.02, 0.2, -0.03, -0.1, -0.2, 1], [0.02, 0.2, 0.03, -0.1, 0.2, 1]],
  square: [[0.22, 0.032, 0.09, 0, 0, 1], [0.032, 0.17, 0, -0.07, 0, 0]],
  snips: [[0.028, 0.16, -0.02, -0.12, -0.18, 0], [0.028, 0.16, 0.02, -0.12, 0.18, 0], [0.045, 0.1, 0, 0.0, 0, 1]],
  caliper: [[0.028, 0.3, 0, -0.12, 0, 1], [0.07, 0.03, 0.03, 0.02, 0, 1], [0.06, 0.03, 0.025, -0.06, 0, 1]],
};
const ORDER = ["hammer", "mallet", "wrench", "pliers", "saw", "screwdriver", "file", "chisel", "compass", "square", "snips", "caliper"];
const WIDTH = { saw: 0.44, square: 0.3 };

const params = {
  seed: seedParam("Change l'ordre des emplacements, les outils manquants, les tons des planches, l'usure de la peinture, le penché des outils."),
  fill: choiceParam("Garni", FILLS, "Tous les outils à leur place, quelques-uns pris (leur silhouette peinte reste vide), ou presque tous pris."),
};

export const meta = {
  id: "furniture/storage/tool-rack",
  name: "Râtelier à outils",
  nameEn: "Tool rack",
  category: "furniture",
  subcategory: "storage",
  description:
    "Râtelier mural de l'Atelier du Complexe : planche de chêne noirci à crochets de bronze où chaque outil a sa " +
    "silhouette peinte en blanc usé ; un outil pris laisse sa forme blanche vide. Marteau, clé, pince, scie, compas, " +
    "équerre... sur deux rangs, et une tablette. Plein, quelques outils pris, presque vide. Fiche ATE-05.",
  tags: [
    "râtelier", "panneau à outils", "outils", "silhouettes", "peinture", "crochets", "marteau", "clé", "pince", "scie",
    "compas", "équerre", "chêne noirci", "bronze", "mural", "atelier", "le complexe", "complexe", "ancien-tech",
    "rangement", "intérieur",
    "tool rack", "pegboard", "tools", "shadow board", "paint", "hooks", "hammer", "wrench", "pliers", "saw", "compass",
    "square", "blackened oak", "bronze fittings", "wall mounted", "workshop", "ancient complex", "ancient-tech", "storage",
    "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au pied du mur, au milieu de la planche ; le dos contre le mur (z = 0), les outils vers +z ; le bas de la planche à 1,0 m",
  footprint: { radius: 1.05, height: 2.2 },
  animated: [],
  params,
  variants: variantsOf("fill", params.fill),
};

/**
 * Crée le râtelier.
 * @param {{seed?: number, fill?: string}} [given]
 * @returns {THREE.Group} `group.userData.rack` : { slots: [{ tool, present, hook: Vector3 }] } (repère de l'asset)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 733);
  const wood = [], metal = [], paint = [];
  const z0 = BOARD; // face avant de la planche

  // --- Planche : trois planches horizontales (un ton chacune, joint d'un demi-pixel), deux traverses derrière qui
  // dépassent en haut et en bas, un chant clair en haut.
  const plankH = H / 3;
  for (let k = 0; k < 3; k++) {
    const t = rng.range(-0.08, 0.08);
    const y = BOTTOM + plankH * (k + 0.5);
    wood.push(withTone(buildBlock([W, plankH - 0.008, BOARD], [0, y, BOARD / 2]), (x, yy, z, nx, ny) => t + (ny > 0.5 ? 0.12 : 0) - (nx || ny < -0.5 ? 0.12 : 0)));
  }
  wood.push(withTone(buildBlock([W - 0.01, H - 0.01, BOARD - 0.012], [0, BOTTOM + H / 2, BOARD / 2 - 0.004]), -0.8)); // fond des joints
  for (const s of [-1, 1]) wood.push(withTone(buildBlock([0.08, H + 0.16, 0.025], [s * (W / 2 - 0.15), BOTTOM + H / 2, -0.0]), -0.25));
  // Tablette basse sur deux consoles en équerre, quelques boîtes et un pot.
  const shelfY = BOTTOM + 0.04;
  wood.push(withTone(buildBlock([W - 0.2, 0.03, 0.15], [0, shelfY, z0 + 0.075]), (x, y, z, nx, ny) => (ny > 0.5 ? 0.15 : -0.1)));
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.3);
    metal.push(withTone(beam([x, shelfY - 0.015, z0 + 0.13], [x, shelfY - 0.16, z0 + 0.005], PX * 0.5, PX * 0.5), -0.1));
    metal.push(withTone(buildBlock([0.025, 0.012, 0.14], [x, shelfY - 0.021, z0 + 0.07]), 0.05));
  }
  let bx = -W / 2 + 0.2;
  while (bx < W / 2 - 0.25) {
    const w = rng.range(0.1, 0.2);
    if (rng.chance(0.55)) {
      const h = rng.range(0.05, 0.1);
      if (rng.chance(0.35)) metal.push(withTone(plain(new THREE.CylinderGeometry(0.045, 0.045, h + 0.03, 6)).translate(bx + 0.045, shelfY + 0.015 + (h + 0.03) / 2, z0 + 0.08), (x, y, z, nx, ny) => (ny > 0.5 ? -0.6 : 0.05)));
      else wood.push(withTone(buildBlock([w, h, 0.11], [bx + w / 2, shelfY + 0.015 + h / 2, z0 + 0.075]), (x, y, z, nx, ny) => (ny > 0.5 ? 0.2 : 0.02)));
    }
    bx += w + rng.range(0.05, 0.15);
  }

  // --- Emplacements : deux rangs de six ; l'ordre et les manques viennent de la graine.
  const order = ORDER.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const missing = { full: 0, some: rng.int(2, 4), empty: rng.int(9, 11) }[p.fill];
  const gone = new Set();
  while (gone.size < missing) gone.add(rng.int(0, order.length - 1));
  const rows = [order.slice(0, 6), order.slice(6)];
  const slots = [];
  const wear = (k) => (rng.chance(0.25) ? -0.35 : rng.range(-0.08, 0.1));
  rows.forEach((row, r) => {
    const hookY = BOTTOM + H - 0.12 - r * 0.5;
    const total = row.reduce((sum, t) => sum + (WIDTH[t] ?? 0.24), 0);
    const gap = (W - 0.2 - total) / (row.length - 1);
    let x = -W / 2 + 0.1;
    row.forEach((tool, i) => {
      const w = WIDTH[tool] ?? 0.24;
      const cx = x + w / 2;
      x += w + gap;
      const index = r * 6 + i;
      const present = !gone.has(index);
      const tilt = present ? rng.range(-0.06, 0.06) : 0;
      const m = new THREE.Matrix4().makeRotationZ(tilt).setPosition(cx, hookY, 0);
      const paintTone = wear(index);
      for (const [w2, h2, px, py, a, mat] of TOOLS[tool]) {
        // Silhouette peinte : un pixel de plus tout autour, à plat sur la planche (sans pencher).
        const s = buildBlock([w2 + PX * 1.1, h2 + PX * 1.1, 0.003], [cx + px, hookY + py, z0 + 0.0015], [0, 0, a]);
        paint.push(withTone(s, paintTone));
        if (!present) continue;
        const g = buildBlock([w2, h2, mat ? 0.018 : 0.026], [px, py, z0 + 0.03], [0, 0, a]).applyMatrix4(m);
        if (mat) metal.push(withTone(g, (xx, y, z, nx, ny, nz) => (nz > 0.5 ? -0.18 : ny > 0.5 ? 0.25 : -0.3)));
        else wood.push(withTone(g, (xx, y, z, nx, ny, nz) => (nz > 0.5 ? 0.45 : 0.25)));
      }
      // Crochet de bronze : une tige qui sort de la planche et remonte d'un pixel.
      metal.push(withTone(beam([cx, hookY + 0.045, z0], [cx, hookY + 0.045, z0 + 0.06], PX * 0.5, PX * 0.5), 0.3));
      metal.push(withTone(beam([cx, hookY + 0.04, z0 + 0.055], [cx, hookY + 0.08, z0 + 0.055], PX * 0.45, PX * 0.45), 0.4));
      slots.push({ tool, present, hook: new THREE.Vector3(cx, hookY + 0.06, z0 + 0.06) });
    });
  });
  // Quelques gouttes et éraflures de peinture sur la planche.
  const flecks = [];
  for (let i = 0; i < rng.int(3, 7); i++) flecks.push({ position: [rng.range(-0.95, 0.95), BOTTOM + rng.range(0.1, 1.1), z0 + 0.001], size: [PX * 0.4, PX * rng.range(0.4, 1)], normal: [0, 0, 1], tone: -0.2 });
  paint.push(buildQuads(flecks));

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const woodMesh = new THREE.Mesh(mergeToned(wood), createToonMaterial({
    ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.26, 0.48, 0.74], tone: true, crease: true,
    pattern: "speckle", patternParams: [16, 0.05, 0.12, 1], seed: p.seed % 97, id: 20,
  }));
  woodMesh.name = "wood";
  const metalMesh = new THREE.Mesh(mergeToned(metal), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  metalMesh.name = "bronze";
  const paintMesh = new THREE.Mesh(mergeToned(paint), createToonMaterial({ ramp: PAINT.ramp, steps: [0.25, 0.5, 0.75], tone: true, outline: false, id: 21 }));
  paintMesh.name = "paint";
  for (const mesh of [woodMesh, metalMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  paintMesh.receiveShadow = true;
  group.add(woodMesh, metalMesh, paintMesh);

  group.userData.rack = { slots };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
