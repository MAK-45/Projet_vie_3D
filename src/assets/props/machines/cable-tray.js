// Chemin de câbles du Complexe (fiches GAL-04 et ETU-06, docs/complexe/PIECES.md) : modules de 2 m.
// - Mural (GAL-04) : goulotte ouverte de bronze de 0,30 × 0,08 m tenue au mur par des pattes à jambe de force tous les
//   mètres ; dedans, 2 à 4 câbles d'un pixel (cuivre, gaine noire, parfois une gaine ambre) serrés par des colliers de
//   cuir tous les 0,5 m, dont un parfois ouvert qui pend.
// - Au sol (ETU-06) : goulotte basse de 6 cm fermée par des plaques de couvercle de 0,5 m à charnières en points, une
//   pente d'accès de chaque côté ; une plaque manque ou est décalée selon la graine (on voit les câbles dedans).
// Modules : droit, coude (angle rentrant pour le mural), T (descente le long du mur pour le mural, départ sur le côté
// pour le sol). `createRun(points, réglages)` (exporté) trace un parcours entier d'un coup, coupé en onglet aux coudes.
// La graine change le nombre et la couleur des câbles, le collier ouvert, la plaque manquante ou décalée, les tons.
//
// 2 draw calls : bronze (goulotte, pattes, couvercles, câbles de cuivre), gaines et cuir.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads, buildSweep, measurePath, slicePath } from "../../kit/geometry.js";
import { METALS } from "../../kit/palettes.js";
import { PX, beam, mergeToned, metalMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MOUNTS = { wall: "Mural (goulotte ouverte)", floor: "Au sol (à couvercle)" };
const PIECES = { straight: "Droit", elbow: "Coude", tee: "En T" };
// Gaines : la gaine ambre est en tête de rampe, atteinte seulement par un ton très bas (−3) ; le reste est la gaine
// noire et le cuir des colliers.
const SHEATH = { ramp: ["#b8621f", "#141016", "#2a2226", "#463a36", "#6a5848"], ink: "#0a0809" };
const AMBER = -3;
const W = 0.3; // largeur de la goulotte
const GAP = 0.05; // jour entre le mur et la goulotte murale
const RAMP = 0.12; // pente d'accès du chemin au sol

const params = {
  seed: seedParam("Change le nombre (2 à 4) et la couleur des câbles, le collier ouvert, la plaque de couvercle manquante ou décalée, les tons."),
  mount: choiceParam("Pose", MOUNTS, "Goulotte ouverte au mur sur des pattes (galerie, couloirs), ou goulotte basse à couvercle au sol (salles d'étude)."),
  piece: choiceParam("Module", PIECES, "Droit ; coude (mural : angle rentrant de deux murs ; sol : virage à 90°) ; T (mural : descente de 1 m le long du mur ; sol : départ sur le côté)."),
  length: numberParam("Longueur", 2, 1, 4, "Longueur du module droit et du tronc du T (les bras du coude font 1 m).", { step: 0.5, unit: "m" }),
  height: numberParam("Hauteur", 2.4, 0.4, 6, "Mural : hauteur du fond de la goulotte (2,4 et 2,8 m dans la Galerie, 3,0 m dans les couloirs de liaison).", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "props/machines/cable-tray",
  name: "Chemin de câbles",
  nameEn: "Cable tray",
  category: "props",
  subcategory: "machines",
  description:
    "Chemin de câbles du Complexe en modules de 2 m : goulotte de bronze ouverte au mur sur des pattes, 2 à 4 câbles " +
    "d'un pixel serrés par des colliers de cuir ; ou goulotte basse au sol à couvercles à charnières et pentes d'accès. " +
    "Droit, coude, T ; parcours entier par points (createRun). Fiches GAL-04, ETU-06.",
  tags: [
    "chemin de câbles", "goulotte", "câbles", "cuivre", "gaine", "collier", "cuir", "couvercle", "charnières",
    "pente d'accès", "patte", "coude", "module", "galerie", "salle d'étude", "le complexe", "complexe", "ancien-tech",
    "praticable", "intérieur",
    "cable tray", "cable trunking", "cables", "copper wire", "sheath", "leather strap", "lid plates", "hinges",
    "access ramp", "wall bracket", "elbow", "modular", "gallery", "study room", "ancient complex", "ancient-tech",
    "walkable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units:
    "1 unité = 1 mètre ; le module suit x, centré sur l'origine au sol. Mural : le mur est le plan z = 0, la " +
    "goulotte avance vers +z ; coude : le second mur est le plan x = 0 (côté x < 0). Au sol : la goulotte est centrée " +
    "sur son tracé",
  footprint: { radius: 1.2, height: 2.5 },
  animated: [],
  params,
  variants: [
    { id: "wall", name: "Mural, droit", params: {} },
    { id: "wall-elbow", name: "Mural, coude", params: { piece: "elbow" } },
    { id: "wall-tee", name: "Mural, descente", params: { piece: "tee" } },
    { id: "floor", name: "Au sol, droit", params: { mount: "floor" } },
    { id: "floor-tee", name: "Au sol, en T", params: { mount: "floor", piece: "tee" } },
  ],
};

/**
 * Crée un module.
 * @param {{seed?: number, mount?: string, piece?: string, length?: number, height?: number}} [given]
 * @returns {THREE.Group} `userData.tray` : { length, mount } ; au sol, `userData.walkable` : { top }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 3373 + 59);
  const L = p.length;
  const out = { metal: [], sheath: [] };
  const cables = pickCables(rng);
  if (p.mount === "wall") {
    const path = p.piece === "elbow" ? [[-1, 0], [0, 0], [0, 1]] : [[-L / 2, 0], [L / 2, 0]];
    wallRun(out, rng, path, p.height, cables);
    if (p.piece === "tee") wallDrop(out, rng, 0, p.height, cables);
  } else {
    const path = p.piece === "elbow" ? [[-1, 0], [0, 0], [0, 1]] : [[-L / 2, 0], [L / 2, 0]];
    const openings = p.piece === "tee" ? [{ s0: L / 2 - W / 2 - RAMP, s1: L / 2 + W / 2 + RAMP, side: 1 }] : [];
    floorRun(out, rng, path, cables, openings);
    if (p.piece === "tee") floorRun(out, rng, [[0, W / 2 - 0.015], [0, 1]], cables, [], { startOpen: true });
  }
  return finish(out, p, { length: p.piece === "elbow" ? 2 : L + (p.piece === "tee" ? 1 : 0), mount: p.mount });
}

/**
 * Trace un parcours entier : au sol, `points` est le tracé [[x, z], ...] au milieu de la goulotte ; au mur, c'est le
 * pied du mur, la goulotte étant posée à gauche du sens de marche (n = (−dz, dx) : pour un tracé vers +x, côté +z).
 * @param {Array<[number, number]>} points
 * @param {{seed?: number, mount?: string, height?: number}} [given]
 * @returns {THREE.Group} mêmes maillages et `userData` qu'un module
 */
export function createRun(points, given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 3373 + 59);
  const out = { metal: [], sheath: [] };
  const cables = pickCables(rng);
  if (p.mount === "wall") wallRun(out, rng, points, p.height, cables);
  else floorRun(out, rng, points, cables, []);
  return finish(out, p, { length: measurePath(points).length, mount: p.mount });
}

// Câbles : 2 à 4, cuivre (dans le bronze, ton clair), gaine noire, au plus une gaine ambre.
function pickCables(rng) {
  const n = rng.int(2, 4);
  const amber = rng.next() < 0.5 ? rng.int(0, n - 1) : -1;
  return Array.from({ length: n }, (_, i) => (i === amber ? "amber" : rng.next() < 0.45 ? "copper" : "black"));
}

// Ajoute une pièce suivant le tracé à la bonne liste selon la couleur du câble.
function pushCable(out, kind, geometry) {
  if (kind === "copper") out.metal.push(withTone(geometry, 0.35));
  else out.sheath.push(withTone(geometry, kind === "amber" ? AMBER : (x, y, z, nx, ny) => (ny > 0.5 ? 0.05 : -0.1)));
}

// Goulotte murale le long du mur `path` (pied du mur), fond à `h`.
function wallRun(out, rng, path, h, cables) {
  const t = rng.range(-0.06, 0.06);
  const sweep = (section, tone) => out.metal.push(withTone(buildSweep(path, section), tone));
  sweep([[GAP, h], [GAP + W, h], [GAP + W, h + 0.012], [GAP, h + 0.012]], (x, y, z, nx, ny) => t + (ny > 0.5 ? -0.25 : 0));
  sweep([[GAP, h], [GAP + 0.012, h], [GAP + 0.012, h + 0.08], [GAP, h + 0.08]], t - 0.05);
  sweep([[GAP + W - 0.012, h], [GAP + W, h], [GAP + W, h + 0.08], [GAP + W - 0.012, h + 0.08]], (x, y, z, nx, ny) => t + (ny > 0.5 ? 0.3 : 0.05));
  // Câbles côte à côte sur le fond (0,05 m), du côté du mur.
  cables.forEach((kind, i) => {
    const u = GAP + 0.045 + i * 0.065;
    pushCable(out, kind, buildSweep(path, [[u - 0.026, h + 0.012], [u + 0.026, h + 0.012], [u + 0.026, h + 0.062], [u - 0.026, h + 0.062]]));
  });
  const { length, pointAt } = measurePath(path);
  const frame = (s) => {
    const { point: [x, z], direction: [dx, dz] } = pointAt(s);
    return { x, z, dx, dz, nx: -dz, nz: dx };
  };
  // Pattes environ tous les mètres sur chaque pan de mur (jamais dans un coin) : platine, bras, jambe de force.
  const stations = [];
  let s0 = 0;
  for (let j = 1; j < path.length; j++) {
    const l = Math.hypot(path[j][0] - path[j - 1][0], path[j][1] - path[j - 1][1]);
    const nb = Math.max(1, Math.round(l));
    for (let i = 0; i < nb; i++) stations.push(s0 + (nb === 1 ? l / 2 : 0.3 + (i * (l - 0.6)) / (nb - 1)));
    s0 += l;
  }
  for (const s of stations) {
    const f = frame(s);
    const P = (u, y) => [f.x + f.nx * u, y, f.z + f.nz * u];
    out.metal.push(withTone(beam(P(0.006, h - 0.13), P(0.006, h + 0.01), 0.07, 0.012, 0, new THREE.Vector3(f.nx, 0, f.nz)), t - 0.1));
    out.metal.push(withTone(beam(P(0.012, h - 0.016), P(GAP + W, h - 0.016), 0.035, 0.03), t));
    out.metal.push(withTone(beam(P(0.012, h - 0.2), P(GAP + W * 0.62, h - 0.03), 0.03, 0.025), t - 0.08));
  }
  // Colliers de cuir tous les 0,5 m sur les câbles ; l'un d'eux est parfois ouvert et pend hors de la goulotte.
  const top = h + 0.062;
  const open = rng.next() < 0.6 ? rng.int(0, Math.floor(length / 0.5) - 1) : -1;
  const shift = rng.range(-0.08, 0.08);
  for (let k = 0; k * 0.5 + 0.25 < length; k++) {
    const f = frame(k * 0.5 + 0.25 + shift);
    const P = (u, y) => [f.x + f.nx * u, y, f.z + f.nz * u];
    const reach = GAP + 0.03 + cables.length * 0.065;
    if (k === open) {
      out.sheath.push(withTone(beam(P(GAP + W + 0.012, h + 0.07), P(GAP + W + 0.02, h - 0.12), 0.035, 0.012), 0.15));
      continue;
    }
    out.sheath.push(withTone(beam(P(GAP + 0.02, top + 0.006), P(reach, top + 0.006), 0.035, 0.012), 0.2));
    out.metal.push(withTone(buildBlock([0.02, 0.016, 0.02], P(reach - 0.01, top + 0.012)), 0.5));
  }
}

// Descente murale de 1 m sous la goulotte (T du module mural) : fond contre le mur, deux joues, deux câbles qui
// descendent.
function wallDrop(out, rng, x, h, cables) {
  const t = rng.range(-0.06, 0.06);
  const y0 = h - 1.0, y1 = h, cy = (y0 + y1) / 2;
  out.metal.push(withTone(buildBlock([W, 1.0, 0.012], [x, cy, GAP + 0.006]), t - 0.2));
  for (const s of [-1, 1]) out.metal.push(withTone(buildBlock([0.012, 1.0, 0.08], [x + s * (W / 2 - 0.006), cy, GAP + 0.04]), t + 0.05));
  out.metal.push(withTone(buildBlock([W + 0.04, 0.03, 0.1], [x, y0 - 0.015, GAP + 0.05]), t));
  cables.slice(0, 2).forEach((kind, i) => {
    const g = buildBlock([0.05, 1.04, 0.05], [x - 0.05 + i * 0.1, cy + 0.04, GAP + 0.04]);
    pushCable(out, kind, g);
  });
  for (const y of [h - 0.35, h - 0.75]) out.sheath.push(withTone(buildBlock([W - 0.04, 0.035, 0.012], [x, y, GAP + 0.072]), 0.2));
}

// Goulotte au sol le long de `path` (son milieu). `openings` : tronçons sans joue ni pente d'un côté (départ d'un T).
function floorRun(out, rng, path, cables, openings, { startOpen = false } = {}) {
  const t = rng.range(-0.05, 0.05);
  const h = 0.06;
  const { length } = measurePath(path);
  // Joues et pentes, coupées aux ouvertures.
  for (const side of [-1, 1]) {
    const cuts = openings.filter((o) => o.side === side).sort((a, b) => a.s0 - b.s0);
    let s = 0;
    const spans = [];
    for (const o of cuts) {
      if (o.s0 > s) spans.push([s, o.s0]);
      s = Math.max(s, o.s1);
    }
    if (s < length) spans.push([s, length]);
    for (const [a, b] of spans) {
      const sub = slicePath(path, a, b);
      const u0 = side * (W / 2 - 0.015), u1 = side * (W / 2);
      out.metal.push(withTone(buildSweep(sub, [[u0, 0], [u1, 0], [u1, h - 0.012], [u0, h - 0.012]]), t - 0.05));
      out.metal.push(withTone(buildSweep(sub, [[u1, 0], [side * (W / 2 + RAMP), 0], [u1, h - 0.012]]), (x, y, z, nx, ny) => t + (ny > 0.5 ? -0.05 : -0.2)));
    }
  }
  // Fond sombre et câbles dedans (vus là où une plaque manque).
  out.sheath.push(withTone(buildSweep(path, [[-W / 2 + 0.015, 0], [W / 2 - 0.015, 0], [W / 2 - 0.015, 0.004], [-W / 2 + 0.015, 0.004]]), -0.6));
  const n = Math.max(3, cables.length + 1);
  for (let i = 0; i < n; i++) {
    const u = -W / 2 + 0.05 + i * ((W - 0.1) / (n - 1));
    pushCable(out, cables[i % cables.length], buildSweep(path, [[u - 0.022, 0.004], [u + 0.022, 0.004], [u + 0.022, 0.044], [u - 0.022, 0.044]]));
  }
  // Plaques de couvercle de 0,5 m, deux charnières en points du côté +n ; une manque ou est décalée (graine).
  const plates = Math.max(1, Math.round(length / 0.5));
  const step = length / plates;
  const odd = rng.next() < 0.8 ? rng.int(0, plates - 1) : -1;
  const mode = rng.next() < 0.55 ? "missing" : "shifted";
  const { pointAt } = measurePath(path);
  const dots = [];
  for (let k = 0; k < plates; k++) {
    let a = k * step + 0.004, b = (k + 1) * step - 0.004;
    if (k === 0 && startOpen) a = 0;
    let lift = 0;
    if (k === odd && mode === "missing") continue;
    if (k === odd) a += 0.09, b = Math.min(length, b + 0.09), lift = 0.006;
    const pt = rng.range(-0.07, 0.07);
    out.metal.push(withTone(buildSweep(slicePath(path, a, b), [[-W / 2, h - 0.012 + lift], [W / 2, h - 0.012 + lift], [W / 2, h + lift], [-W / 2, h + lift]]), (x, y, z, nx, ny) => t + pt + (ny > 0.5 ? -0.2 : 0)));
    for (const f of [0.25, 0.75]) {
      const { point: [x, z], direction: [dx, dz] } = pointAt(a + (b - a) * f);
      dots.push({ position: [x - dz * (W / 2 - 0.035), h + lift + 0.002, z + dx * (W / 2 - 0.035)], size: [PX * 0.8, PX * 0.8], normal: [0, 1, 0], tone: 0.35 });
    }
  }
  if (dots.length) out.metal.push(buildQuads(dots));
}

function finish(out, p, tray) {
  const group = new THREE.Group();
  group.name = meta.name;
  const add = (name, list, material) => {
    if (!list.length) return;
    const mesh = new THREE.Mesh(mergeToned(list), material);
    mesh.name = name;
    mesh.castShadow = p.mount === "wall";
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add("bronze", out.metal, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  add("sheath", out.sheath, createToonMaterial({ ramp: SHEATH.ramp, ink: SHEATH.ink, steps: [0.03, 0.3, 0.52, 0.76], tone: true, crease: true, id: 33 }));
  group.userData.tray = tray;
  if (p.mount === "floor") group.userData.walkable = { top: 0.06 };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
