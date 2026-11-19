// Escalier droit du Complexe (escaliers de E5-06, E10-04, escalier de service de E7, docs/complexe/SALLES.md) : des
// marches de 0,18 m de haut qui montent à une galerie, une cabine ou un palier.
// - caillebotis : deux limons de bronze rivetés (rivets en pointillé), marches en cadre de bronze percé de barreaux,
//   nez de laiton ; on voit au travers ;
// - pierre : marches pleines de pierre fumée, posées en gradins jusqu'au sol, nez de laiton ;
// - service (E7) : étroit et plus raide, limons et marches de fonte à stries, rampes des deux côtés.
// Rampes à gauche, à droite, des deux côtés ou aucune (contre un mur) ; palier en haut si on le demande.
// La graine change les tons des marches, une plaque de marche remplacée (plus claire), le pas des barreaux de rampe,
// un barreau tordu, l'usure du nez des marches du bas.
// Praticable : `group.userData.walk` (hauteur de la marche sous les pieds, ce qui bloque selon l'étage) ;
// `group.userData.stair` : pied, haut, marches.
//
// 3 draw calls : marches (pierre, bronze ou fonte), limons et barreaux, laiton (nez, rampes).

import * as THREE from "three";
import { buildBlock } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import { PX, beam, mergeToned, metalMaterial, rivetRow, stoneMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = { grating: "Caillebotis (galeries)", stone: "Pierre (gradins)", service: "Service (fonte, raide)" };
const RAILS = { both: "Des deux côtés", left: "À gauche", right: "À droite", none: "Aucune (entre deux murs)" };
const RISE = 0.18;
const GOING = { grating: 0.28, stone: 0.3, service: 0.22 }; // giron
const RAIL_H = 0.9;

const params = {
  seed: seedParam("Change les tons des marches, une plaque de marche remplacée, le pas des barreaux, un barreau tordu, l'usure des nez du bas."),
  model: choiceParam("Modèle", MODELS, "Caillebotis de bronze sur limons rivetés (galeries de E5, cabine de E10), marches pleines de pierre fumée, ou escalier de service de fonte, étroit et raide (E7)."),
  height: numberParam("Hauteur", 3, 1, 6, "Hauteur d'arrivée (3 m : galerie de l'Éveil, 17 marches ; 3,5 m : cabine de la Porte, 20 marches).", { step: 0.1, unit: "m" }),
  width: numberParam("Largeur", 1, 0.8, 1.6, "Largeur des marches (le service est réduit à 0,9 m au plus).", { step: 0.05, unit: "m" }),
  rails: choiceParam("Rampes", RAILS, "Côtés qui ont une rampe (vu du bas, en montant) ; côté mur, pas de rampe.", "both"),
  landing: numberParam("Palier", 0, 0, 2, "Longueur du palier en haut (0 : la dernière marche arrive sur la galerie).", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "buildings/structure/straight-stair",
  name: "Escalier droit",
  nameEn: "Straight staircase",
  category: "buildings",
  subcategory: "structure",
  description:
    "Escalier droit du Complexe, marches de 0,18 m : caillebotis de bronze sur limons rivetés, gradins de pierre " +
    "fumée, ou escalier de service de fonte, étroit et raide. Nez de laiton, rampes d'un côté, des deux ou d'aucun, " +
    "palier en option. Praticable. Escaliers de E5-06, E10-04 et de E7.",
  tags: [
    "escalier", "escalier droit", "marches", "limon", "rampe", "palier", "rivets", "caillebotis", "fonte", "bronze",
    "laiton", "pierre fumée", "galerie", "le complexe", "complexe", "ancien-tech", "praticable", "intérieur",
    "staircase", "straight stair", "steps", "stringer", "handrail", "landing", "riveted", "grating", "cast iron",
    "brass", "smoked stone", "service stair", "ancient complex", "ancient-tech", "walkable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units:
    "1 unité = 1 mètre ; origine au sol au milieu de l'emprise (le nez de la 1re marche est en z = +longueur / 2) ; " +
    "l'escalier monte vers −z",
  footprint: { radius: 2.4, height: 3.95 },
  animated: [],
  params,
  variants: variantsOf("model", params.model),
};

/**
 * Crée l'escalier.
 * @param {{seed?: number, model?: string, height?: number, width?: number, rails?: string, landing?: number}} [given]
 * @returns {THREE.Group} `group.userData.stair` : { height, rise, going, width, run, foot, top, treads: [{ z0, z1, top }] }
 *   (la marche k va de z0 à z1 < z0) ; `group.userData.walk` : { heightAt, occupied }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 223);
  const model = p.model;
  const H = p.height;
  const W = model === "service" ? Math.min(0.9, p.width) : p.width;
  const n = Math.max(2, Math.round(H / RISE));
  const rise = H / n;
  const g = GOING[model];
  const run = (n - 1) * g; // les marches ; la n-ième contremarche arrive au palier (ou à la galerie)
  const L = p.landing;
  const treads = [];
  for (let k = 1; k < n; k++) treads.push({ z0: -(k - 1) * g, z1: -k * g, top: k * rise });
  const lineAt = (z) => THREE.MathUtils.clamp(rise * (-z / g + 0.5), rise, H); // ligne des nez (milieu des marches)
  const left = p.rails === "both" || p.rails === "left";
  const right = p.rails === "both" || p.rails === "right";

  const steps = [], frame = [], brass = [];
  const patched = rng.int(2, n - 2);
  const stringerW = model === "service" ? 0.04 : 0.05;
  const SX = W / 2 + stringerW / 2; // milieu des limons

  // --- Marches.
  const tread = (z0, z1, top, k, depth = z0 - z1) => {
    const zc = (z0 + z1) / 2;
    const base = rng.range(-0.08, 0.06) + (k === patched ? 0.22 : 0);
    if (model === "stone") {
      // Gradin plein jusqu'au sol, joint d'un pixel sombre sous le nez.
      steps.push(withTone(buildBlock([W, top, depth + 0.01], [0, top / 2, zc]), (x, y, z, nx, ny) => (ny > 0.5 ? base : base - 0.2 - (y > top - 0.04 ? 0 : 0.05))));
    } else if (model === "grating") {
      const T = 0.05;
      const tone = (extra) => (x, y, z, nx, ny) => base + extra - 0.12 + (ny > 0.5 ? 0 : -0.12);
      steps.push(withTone(buildBlock([W, T, PX * 1.4], [0, top - T / 2, z0 - PX * 0.7]), tone(0.1)));
      steps.push(withTone(buildBlock([W, T, PX], [0, top - T / 2, z1 + PX / 2]), tone(0)));
      const bars = Math.max(3, Math.round(W / (PX * 2.2)));
      for (let i = 1; i < bars; i++) {
        const x = -W / 2 + (W * i) / bars;
        steps.push(withTone(buildBlock([PX * 0.5, T * 0.8, depth - PX * 2.2], [x, top - T * 0.4, zc]), tone(-0.05)));
      }
      steps.push(withTone(buildBlock([W, T * 0.4, PX * 0.5], [0, top - T * 0.2, zc]), tone(-0.15)));
    } else {
      // Service : plaque de fonte à stries (deux traits clairs en travers).
      steps.push(withTone(buildBlock([W, 0.04, depth], [0, top - 0.02, zc]), (x, y, z, nx, ny) => (ny > 0.5 ? base : base - 0.15)));
      for (const f of [0.3, 0.65]) steps.push(withTone(buildBlock([W - 0.08, 0.006, PX * 0.5], [0, top + 0.003, z0 - depth * f]), base + 0.25));
    }
    // Nez de laiton d'un pixel (usé, plus clair, sur les marches du bas).
    if (model !== "service") brass.push(withTone(buildBlock([W - 0.02, PX * 0.6, PX * 0.9], [0, top - PX * 0.3 + 0.002, z0 - PX * 0.45]), k <= 3 ? 0.3 : 0.1));
  };
  treads.forEach((tr, i) => tread(tr.z0, tr.z1, tr.top, i + 1));
  if (L > 0) {
    if (model === "stone") steps.push(withTone(buildBlock([W, H, L], [0, H / 2, -run - L / 2]), (x, y, z, nx, ny) => (ny > 0.5 ? -0.02 : -0.22)));
    else {
      // Palier : plaque de la même matière que les marches, sur deux poteaux.
      steps.push(withTone(buildBlock([W, 0.06, L], [0, H - 0.03, -run - L / 2]), (x, y, z, nx, ny) => (ny > 0.5 ? 0 : -0.15)));
      for (const s of [-1, 1]) frame.push(withTone(buildBlock([0.08, H - 0.06, 0.08], [s * (W / 2 - 0.04), (H - 0.06) / 2, -run - L + 0.06]), -0.1));
    }
  }

  // --- Limons (sauf pierre) : une poutre inclinée de chaque côté, rivetée, posée au sol sur un sabot.
  if (model !== "stone") {
    const depthS = model === "service" ? 0.22 : 0.3;
    for (const s of [-1, 1]) {
      const a = new THREE.Vector3(s * SX, depthS / 2 - 0.02, 0.05);
      const b = new THREE.Vector3(s * SX, H - depthS / 2 + 0.04, -run + 0.05);
      // (Avec `up` = x, la largeur du bloc est dans le plan vertical : la poutre est debout, sa face vers x.)
      frame.push(withTone(beam(a, b, depthS, stringerW, 0, new THREE.Vector3(1, 0, 0)), (x, y, z, nx, ny) => (Math.abs(nx) > 0.5 ? -0.04 : ny > 0.3 ? 0.1 : -0.2)));
      if (L > 0) frame.push(withTone(buildBlock([stringerW, depthS * 0.7, L], [s * SX, H - depthS * 0.35, -run - L / 2]), -0.02));
      // Rivets en pointillé sur la face extérieure, le long du limon.
      const off = new THREE.Vector3(s * (stringerW / 2 + 0.002), 0, 0);
      const r0 = a.clone().add(off).setY(a.y + depthS * 0.28), r1 = b.clone().add(off).setY(b.y + depthS * 0.28);
      frame.push(withTone(rivetRow(r0, r1, { spacing: 0.22, normal: [s, 0, 0] }), 0.15));
      frame.push(withTone(buildBlock([stringerW + 0.03, 0.06, 0.16], [s * SX, 0.03, 0.02]), -0.2)); // sabot
    }
  }

  // --- Rampes : barreaux d'un pixel toutes les 2 ou 3 marches, lisse inclinée, poteaux au pied et en haut.
  const every = rng.chance(0.5) ? 2 : 3;
  // Un barreau tordu et parfois un manquant, parmi ceux qui existent (une marche sur `every`).
  const posts = Math.max(1, Math.floor((n - 2) / every));
  const bent = every * rng.int(1, posts);
  const missing = rng.chance(0.5) ? every * rng.int(1, posts) : -1;
  const railX = model === "stone" ? W / 2 - 0.04 : SX;
  for (const [s, on] of [[-1, left], [1, right]]) {
    if (!on) continue;
    const x = s * railX;
    const foot = 0.12;
    const post = (z, y0, y1) => frame.push(withTone(buildBlock([PX * 1.6, y1 - y0, PX * 1.6], [x, (y0 + y1) / 2, z]), 0.05));
    post(-foot, 0, lineAt(-foot) + RAIL_H + 0.05);
    treads.forEach((tr, i) => {
      if (i === 0 || i % every !== 0 || (i === missing && s > 0)) return;
      const z = (tr.z0 + tr.z1) / 2;
      const lean = i === bent ? rng.range(0.03, 0.07) : 0;
      frame.push(withTone(beam([x, tr.top, z], [x + lean * s, lineAt(z) + RAIL_H, z - lean], PX, PX), i === bent ? -0.12 : 0));
    });
    const zEnd = -run - (L > 0 ? L - 0.06 : 0);
    post(zEnd, H, H + RAIL_H + 0.05);
    brass.push(withTone(beam([x, lineAt(-foot) + RAIL_H, -foot], [x, H + RAIL_H, -run], 0.05, 0.045), (px, py, pz, nx, ny) => (ny > 0.5 ? 0.2 : -0.1)));
    if (L > 0) brass.push(withTone(beam([x, H + RAIL_H, -run], [x, H + RAIL_H, zEnd], 0.05, 0.045), 0.15));
    // Lisse basse (le service a deux lisses).
    if (model === "service") frame.push(withTone(beam([x, lineAt(-foot) + RAIL_H * 0.5, -foot], [x, H + RAIL_H * 0.5, -run], PX, PX), 0));
  }

  // --- Maillages.
  // L'escalier est centré sur son emprise : origine au milieu de la longueur (le pied est en z = +Z0).
  const group = new THREE.Group();
  group.name = meta.name;
  const Z0 = (run + L) / 2;
  const stepMaterial = model === "stone"
    ? stoneMaterial(STONES.smoked, { seed: p.seed, id: 20 })
    : metalMaterial(model === "service" ? METALS.castIron : METALS.patinatedBronze, { id: 32, tone: true });
  const frameMaterial = metalMaterial(model === "service" ? METALS.castIron : METALS.patinatedBronze, { id: 30, tone: true });
  const meshes = [["steps", steps, stepMaterial], ["frame", frame, frameMaterial], ["brass", brass, metalMaterial(METALS.blackenedBrass, { id: 31, tone: true })]];
  for (const [name, parts, material] of meshes) {
    if (!parts.length) continue;
    const geometry = mergeToned(parts);
    geometry.translate(0, 0, Z0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // --- Marche : la surface sous les pieds, et ce qui bloque à la hauteur du personnage.
  const zMin = -run - L;
  const treadAt = (z) => {
    if (z > 0 || z < zMin) return null;
    if (z < -run) return H;
    return Math.min(n - 1, Math.floor(-z / g) + 1) * rise;
  };
  const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
  const thick = model === "stone" ? Infinity : model === "service" ? 0.05 : 0.06;
  const walk = {
    heightAt(x, z, y, up = 0.4) {
      z -= Z0;
      if (Math.abs(x) > W / 2) return -Infinity;
      const h = treadAt(z);
      return h !== null && h <= y + up ? h : -Infinity;
    },
    occupied(x, z, radius, y0, y1) {
      z -= Z0;
      if (z - radius > 0 || z + radius < zMin || Math.abs(x) - radius > SX + 0.05) return false;
      // Marches sous le disque (avant, centre, arrière).
      if (Math.abs(x) - radius < W / 2) {
        for (const dz of [-radius, 0, radius]) {
          const h = treadAt(z + dz);
          if (h !== null && overlaps(y0, y1, Math.max(0, h - thick), h)) return true;
        }
      }
      // Rampes et limons (les limons montent du sol au-dessous des marches).
      for (const [s, on] of [[-1, left], [1, right]]) {
        if (Math.abs(x - s * railX) >= radius) continue;
        const h = treadAt(THREE.MathUtils.clamp(z, zMin, 0)) ?? 0;
        if (on && overlaps(y0, y1, h, h + RAIL_H)) return true;
        if (model !== "stone" && overlaps(y0, y1, Math.max(0, h - 0.35), h)) return true;
      }
      return false;
    },
  };
  group.userData.walk = walk;
  group.userData.stair = {
    height: H, rise, going: g, width: W, run: run + L,
    foot: new THREE.Vector3(0, 0, Z0 + 0.3), top: new THREE.Vector3(0, H, Z0 - run - Math.max(L, 0.3)),
    treads: treads.map((t) => ({ z0: t.z0 + Z0, z1: t.z1 + Z0, top: t.top })),
  };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
