// Escalier à vis du Complexe (fiches ARC-13, E6-05, COE-02, docs/complexe/) : Ø 2,2 m, des marches de 0,18 m en éventail
// autour d'un noyau de bronze de Ø 0,3 m, un limon de bronze qui suit l'hélice au bord extérieur, une rampe de laiton
// portée par des barreaux d'un pixel, et un palier en haut, ouvert d'un côté pour descendre sur la passerelle.
// - pierre (Archives) : marches de pierre fumée, nez de laiton d'un pixel clair ;
// - caillebotis (salle 6, le Cœur) : marches en cadre de bronze percé de barreaux, on voit au travers.
// Le palier est toujours face à +z (l'ouverture) ; le monde tourne l'escalier pour l'ouvrir sur sa passerelle.
// La graine change les tons des marches, une marche écornée, le pas des barreaux (toutes les 2 ou 3 marches), un
// barreau tordu ou manquant, les bagues du noyau et son pommeau.
// Praticable : `group.userData.walk` donne la hauteur de la marche sous les pieds et ce qui bloque selon l'étage
// (noyau, rampe, marches trop hautes pour passer dessous) ; `group.userData.stair` décrit les marches.
//
// 3 draw calls : pierre (ou bronze des marches en caillebotis), bronze (noyau, limon, barreaux), laiton (rampe, nez).

import * as THREE from "three";
import { buildBlock, buildPrism } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import { PX, beam, mergeToned, metalMaterial, plain, ring, stoneMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = { stone: "Pierre (Archives)", grating: "Caillebotis (salle 6, Cœur)" };
const TURNS = { left: "Monte vers la gauche", right: "Monte vers la droite" };
const R = 1.1; // rayon extérieur des marches
const CORE = 0.15; // rayon du noyau
const RISE = 0.18; // hauteur visée d'une marche
const LANDING = THREE.MathUtils.degToRad(64); // angle du palier
const MAX_STEP = THREE.MathUtils.degToRad(18); // angle d'une marche au plus
const RAIL_R = R - 0.05; // rayon de la rampe et des barreaux
const RAIL_H = 0.95; // hauteur de la rampe au-dessus des marches
const GAP = THREE.MathUtils.degToRad(26); // demi-ouverture du palier, face à +z

const params = {
  seed: seedParam("Change les tons des marches, une marche écornée, le pas des barreaux (2 ou 3 marches), un barreau tordu ou manquant, les bagues du noyau et son pommeau."),
  model: choiceParam("Modèle", MODELS, "Marches de pierre fumée à nez de laiton (Archives), ou marches en caillebotis de bronze (salle 6, Cœur)."),
  height: numberParam("Hauteur", 3.4, 2, 6, "Hauteur du palier (3,4 m : mezzanine des Archives ; 4 m : balcons de la salle 6 et du Cœur). Le nombre de marches en découle (19 pour 3,4 m, 22 pour 4 m).", { step: 0.1, unit: "m" }),
  turn: choiceParam("Sens", TURNS, "En montant, l'escalier tourne vers la gauche (sens trigonométrique vu de dessus) ou vers la droite."),
};

export const meta = {
  id: "buildings/structure/spiral-stair",
  name: "Escalier à vis",
  nameEn: "Spiral staircase",
  category: "buildings",
  subcategory: "structure",
  description:
    "Escalier à vis du Complexe, Ø 2,2 m : marches de 0,18 m en éventail autour d'un noyau de bronze, limon qui suit " +
    "l'hélice, rampe de laiton sur barreaux d'un pixel, palier ouvert face à +z. Marches de pierre fumée à nez de laiton " +
    "ou en caillebotis de bronze ; hauteur de 2 à 6 m, sens au choix. Praticable (on y monte marche par marche). " +
    "Fiches ARC-13, E6-05, COE-02.",
  tags: [
    "escalier", "escalier à vis", "colimaçon", "marches", "noyau", "rampe", "limon", "palier", "mezzanine", "bronze",
    "laiton", "pierre fumée", "caillebotis", "le complexe", "complexe", "ancien-tech", "praticable", "intérieur",
    "staircase", "spiral staircase", "winding stair", "steps", "newel", "handrail", "stringer", "landing", "brass",
    "smoked stone", "grating", "ancient complex", "ancient-tech", "walkable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unité = 1 mètre ; origine au sol sur l'axe du noyau ; le palier est en haut (`height`), ouvert vers +z",
  footprint: { radius: 1.15, height: 4.5 },
  animated: [],
  params,
  variants: [
    ...variantsOf("model", params.model),
    { id: "tall", name: "Haute (4 m, vers la droite)", params: { height: 4, turn: "right" } },
  ],
};

/**
 * Crée l'escalier.
 * @param {{seed?: number, model?: string, height?: number, turn?: string}} [given]
 * @returns {THREE.Group} `group.userData.stair` : { height, rise, radius, treads: [{ a0, a1, top }], landing: { a0, a1 } }
 *   (angles en radians depuis +z, comptés dans le sens de la montée) ; `group.userData.walk` : { heightAt, occupied }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 211);
  const H = p.height;
  const n = Math.max(4, Math.round(H / RISE)); // contremarches (la dernière arrive au palier)
  const rise = H / n;
  const step = Math.min(MAX_STEP, (Math.PI * 2 - LANDING) / (n - 1));
  const dir = p.turn === "left" ? 1 : -1;
  // Angle « de montée » t (radians depuis +z) ; le palier couvre [−L/2, L/2], les marches sont avant lui.
  const t0 = -LANDING / 2 - (n - 1) * step; // début de la 1re marche
  const at = (r, t, y) => new THREE.Vector3(Math.sin(dir * t) * r, y, Math.cos(dir * t) * r);
  const xz = (r, t) => [Math.sin(dir * t) * r, Math.cos(dir * t) * r];
  const treads = [];
  for (let k = 1; k < n; k++) treads.push({ a0: t0 + (k - 1) * step, a1: t0 + k * step, top: k * rise });
  const landing = { a0: -LANDING / 2, a1: LANDING / 2, top: H };
  // Hauteur de la ligne de rampe (milieu de chaque marche à sa hauteur), puis à plat sur le palier.
  const lineAt = (t) => Math.min(H, rise * ((t - t0) / step + 0.5));

  const treadParts = [], bronze = [], brass = [];
  const grating = p.model === "grating";
  const chipped = rng.int(2, n - 2);
  const wedge = (r0, r1, a0, a1) => {
    const segs = Math.max(1, Math.ceil((a1 - a0) / THREE.MathUtils.degToRad(9)));
    const pts = [xz(r0, a0)];
    for (let s = 0; s <= segs; s++) pts.push(xz(r1, a0 + ((a1 - a0) * s) / segs));
    pts.push(xz(r0, a1));
    return pts;
  };

  // --- Marches et palier.
  const slab = (a0, a1, top, k) => {
    if (!grating) {
      // Pierre : dalle de 0,14 m qui passe un peu sous la précédente (pas de jour entre deux marches vues de dessous).
      const g = buildPrism(wedge(CORE * 0.9, R, a0 - THREE.MathUtils.degToRad(2.5), a1), top - 0.14, () => top);
      const base = rng.range(-0.08, 0.06) + (k === chipped ? -0.18 : 0);
      treadParts.push(withTone(g, (x, y, z, nx, ny) => (ny > 0.5 ? base : base - 0.2)));
      // Nez de laiton d'un pixel sur l'arête de montée.
      brass.push(withTone(beam(at(CORE + 0.03, a0, top - PX * 0.3), at(R - 0.03, a0, top - PX * 0.3), PX * 0.9, PX * 0.6), k === chipped ? -0.1 : 0.15));
    } else {
      // Caillebotis : cadre de bronze (arêtes de montée et de fin, rive extérieure) et barreaux le long de la marche.
      const T = 0.05;
      const tone = rng.range(-0.08, 0.06);
      const edge = (u, v, w, h, extra = 0) => treadParts.push(withTone(beam(u, v, w, h), tone + extra));
      edge(at(CORE, a0, top - T / 2), at(R, a0, top - T / 2), PX * 1.4, T, 0.1);
      edge(at(CORE, a1, top - T / 2), at(R, a1, top - T / 2), PX, T);
      const segs = Math.max(2, Math.ceil((a1 - a0) / THREE.MathUtils.degToRad(9)));
      for (let s = 0; s < segs; s++) {
        const b0 = a0 + ((a1 - a0) * s) / segs, b1 = a0 + ((a1 - a0) * (s + 1)) / segs;
        edge(at(R - PX / 2, b0, top - T / 2), at(R - PX / 2, b1, top - T / 2), PX, T);
      }
      // Barreaux : des rayons tous les 2 pixels au bord extérieur, et des arcs en travers.
      const bars = Math.max(2, Math.round(((a1 - a0) * R) / (PX * 2.2)));
      for (let i = 1; i < bars; i++) {
        const b = a0 + ((a1 - a0) * i) / bars;
        edge(at(CORE + 0.02, b, top - T * 0.4), at(R - PX, b, top - T * 0.4), PX * 0.5, T * 0.8, -0.05);
      }
      for (const r of [0.45, 0.8]) edge(at(r, a0, top - T * 0.2), at(r, a1, top - T * 0.2), PX * 0.5, T * 0.4, -0.15);
      brass.push(withTone(beam(at(CORE + 0.03, a0, top + 0.004), at(R - 0.03, a0, top + 0.004), PX * 0.9, PX * 0.3), 0.1));
    }
  };
  treads.forEach((tr, i) => slab(tr.a0, tr.a1, tr.top, i + 1));
  slab(landing.a0, landing.a1, H, n);
  if (!grating) {
    // Sous le palier, une console de pierre qui le porte jusqu'au noyau (le palier est grand).
    const g = buildPrism(wedge(CORE, R * 0.7, -LANDING / 4, LANDING / 4), H - 0.4, () => H - 0.14);
    treadParts.push(withTone(g, -0.3));
  }

  // --- Noyau : fût de bronze de Ø 0,3 m, socle, bagues, pommeau.
  const top = H + RAIL_H + 0.1;
  const core = plain(new THREE.CylinderGeometry(CORE, CORE, top, 8));
  core.translate(0, top / 2, 0);
  bronze.push(withTone(core, (x, y, z, nx) => (Math.abs(nx) > 0.7 ? -0.05 : 0.05) - 0.1 * THREE.MathUtils.smoothstep(y, 0, 1)));
  const plinth = plain(new THREE.CylinderGeometry(CORE + 0.07, CORE + 0.09, 0.2, 8));
  plinth.translate(0, 0.1, 0);
  bronze.push(withTone(plinth, -0.15));
  const bands = rng.int(2, 4);
  for (let b = 0; b < bands; b++) {
    const y = 0.4 + ((top - 0.6) * (b + rng.range(0.3, 0.7))) / bands;
    brass.push(withTone(ring({ radius: CORE, height: PX * 1.5, y, thickness: PX * 0.8, segments: 8 }), 0.2));
  }
  if (rng.chance(0.5)) {
    const knob = plain(new THREE.SphereGeometry(CORE * 1.1, 8, 5));
    knob.translate(0, top + CORE * 0.8, 0);
    brass.push(withTone(knob, 0.15));
  } else {
    const cone = plain(new THREE.ConeGeometry(CORE * 1.2, 0.3, 8));
    cone.translate(0, top + 0.15, 0);
    brass.push(withTone(cone, 0.1));
  }

  // --- Limon extérieur : une bande de bronze qui suit l'hélice sous le bord des marches.
  const tEnd = landing.a1;
  const pieces = Math.ceil((tEnd - t0) / THREE.MathUtils.degToRad(8));
  for (let s = 0; s < pieces; s++) {
    const u = t0 + ((tEnd - t0) * s) / pieces, v = t0 + ((tEnd - t0) * (s + 1)) / pieces;
    const yu = Math.max(0.12, lineAt(u) - rise * 0.5 - 0.1), yv = Math.max(0.12, lineAt(v) - rise * 0.5 - 0.1);
    bronze.push(withTone(beam(at(R + 0.015, u, yu), at(R + 0.015, v, yv), 0.035, 0.24), (x, y, z, nx, ny) => (ny > 0.5 ? 0.12 : -0.05)));
  }

  // --- Barreaux et rampe : sur tout le tour, sauf l'ouverture du palier ; une courte rampe le long du bord du palier.
  const every = rng.chance(0.5) ? 2 : 3;
  const bent = rng.int(1, n - 2);
  const missing = rng.chance(0.4) ? rng.int(2, n - 2) : -1;
  const baluster = (t, foot, head, k) => {
    if (k === missing) return;
    const lean = k === bent ? 0.05 : 0;
    const a = at(RAIL_R, t, foot);
    const b = at(RAIL_R - lean, t + lean, head);
    bronze.push(withTone(beam(a, b, PX, PX), k === bent ? -0.1 : 0));
  };
  treads.forEach((tr, i) => {
    if (i % every === 0) baluster((tr.a0 + tr.a1) / 2, tr.top, lineAt((tr.a0 + tr.a1) / 2) + RAIL_H, i);
  });
  const railTo = landing.a0 + (LANDING / 2 - GAP); // la rampe s'arrête au bord de l'ouverture
  const railPieces = Math.ceil((railTo - t0) / THREE.MathUtils.degToRad(8));
  const handrail = (u, v, yu, yv) => brass.push(withTone(beam(at(RAIL_R, u, yu), at(RAIL_R, v, yv), 0.05, 0.045), (x, y, z, nx, ny) => (ny > 0.5 ? 0.2 : -0.1)));
  for (let s = 0; s < railPieces; s++) {
    const u = t0 + ((railTo - t0) * s) / railPieces, v = t0 + ((railTo - t0) * (s + 1)) / railPieces;
    handrail(u, v, lineAt(u) + RAIL_H, lineAt(v) + RAIL_H);
  }
  // Départ : la rampe descend sur un poteau d'1 m au pied de la 1re marche.
  const post = (t, y, height) => bronze.push(withTone(beam(at(RAIL_R, t, y), at(RAIL_R, t, y + height), PX * 1.6, PX * 1.6), 0.05));
  post(t0 + step * 0.15, 0, lineAt(t0 + step * 0.15) + RAIL_H);
  // Poteaux de part et d'autre de l'ouverture, et rampe de l'autre côté jusqu'au bord du palier.
  post(railTo, H, RAIL_H + 0.05);
  const railFrom = landing.a1 - (LANDING / 2 - GAP);
  post(railFrom, H, RAIL_H + 0.05);
  handrail(railFrom, landing.a1, H + RAIL_H, H + RAIL_H);
  // Le bord du palier, au-dessus du vide (ou de la 1re marche) : rampe droite du noyau à la rive, deux barreaux.
  const edgeT = landing.a1 - 0.01;
  brass.push(withTone(beam(at(CORE, edgeT, H + RAIL_H), at(RAIL_R, edgeT, H + RAIL_H), 0.045, 0.045), 0.1));
  for (const r of [0.45, 0.75]) bronze.push(withTone(beam(at(r, edgeT, H), at(r, edgeT, H + RAIL_H), PX, PX), 0));
  baluster(landing.a1, H, H + RAIL_H, -2);
  // Barreaux du palier, côté rampe.
  for (let t = landing.a0 + step; t < railTo - 0.05; t += step * every) baluster(t, H, H + RAIL_H, -3);

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const treadMaterial = grating
    ? metalMaterial(METALS.patinatedBronze, { id: 32, tone: true })
    : stoneMaterial(STONES.smoked, { seed: p.seed, id: 20 });
  const meshes = [
    ["treads", treadParts, treadMaterial],
    ["bronze", bronze, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true })],
    ["brass", brass, metalMaterial(METALS.blackenedBrass, { id: 31, tone: true })],
  ];
  for (const [name, parts, material] of meshes) {
    const mesh = new THREE.Mesh(mergeToned(parts), material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // --- Marche : la surface sous les pieds, et ce qui bloque à la hauteur du personnage.
  // Angle de montée d'un point (x, z), ramené dans [t0, t0 + 2π[.
  const angleOf = (x, z) => {
    let t = Math.atan2(dir * x, z);
    while (t < t0) t += Math.PI * 2;
    while (t >= t0 + Math.PI * 2) t -= Math.PI * 2;
    return t;
  };
  // Hauteur du dessus de la marche à l'angle t, ou null (pas de marche : le sol, si l'escalier fait moins d'un tour).
  const treadAt = (t) => {
    if (t >= landing.a0 && t < landing.a1) return H;
    const k = Math.floor((t - t0) / step);
    return k >= 0 && k < n - 1 ? (k + 1) * rise : null;
  };
  const railAt = (t) => {
    if (t >= railTo && t < railFrom) return null; // l'ouverture
    if (t >= landing.a1) return null;
    return lineAt(t);
  };
  const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
  const walk = {
    heightAt(x, z, y, up = 0.4) {
      const r = Math.hypot(x, z);
      if (r < CORE || r > R) return -Infinity;
      const h = treadAt(angleOf(x, z));
      return h !== null && h <= y + up ? h : -Infinity;
    },
    occupied(x, z, radius, y0, y1) {
      // Le corps peut frôler le noyau et la rampe (le fût d'un escalier de Ø 2,2 m est étroit : le blob, 0,45 m de
      // rayon, doit y passer) : emprise réduite pour eux.
      const r = Math.hypot(x, z);
      if (r - radius > R + 0.05) return false;
      if (r < CORE + radius * 0.7) return overlaps(y0, y1, 0, top);
      const t = angleOf(x, z);
      // Les marches : sous le pied seulement (un demi-rayon de part et d'autre), sinon à 0,6 m du noyau le disque
      // couvre trois marches et la troisième, plus haute, arrête comme un mur.
      const span = Math.asin(Math.min(1, (radius * 0.5) / Math.max(r, radius)));
      for (let s = -2; s <= 2; s++) {
        const u = t + (span * s) / 2; // angles de part et d'autre du centre
        const h = treadAt(u);
        if (h !== null && r - radius < R && overlaps(y0, y1, h - (grating ? 0.06 : 0.14), h)) return true;
        const rail = railAt(u);
        if (rail !== null && Math.abs(r - RAIL_R) < radius * 0.6 && overlaps(y0, y1, rail - RAIL_H, rail + 0.05)) return true;
      }
      // Bord du palier côté vide : la courte rampe radiale.
      const off = Math.atan2(Math.sin(t - landing.a1), Math.cos(t - landing.a1));
      if (Math.abs(off) * r < radius * 0.6 && overlaps(y0, y1, H, H + RAIL_H)) return true;
      return false;
    },
  };
  group.userData.walk = walk;
  group.userData.stair = { height: H, rise, radius: R, treads, landing, turn: p.turn };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
