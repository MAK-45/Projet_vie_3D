// Passerelle en caillebotis du Complexe (fiches ARC-14, E5-06, E6-04, COE-01, docs/complexe/) : un plancher de bronze
// percé d'un quadrillage d'un pixel (on voit le dessous au travers), porté par des poutrelles et des consoles de pierre
// ancrées dans le mur, avec un garde-corps de 1,0 m côté vide.
// - droite : mezzanine des Archives (18 × 1,2 m à 3,4 m), galerie d'observation de l'Éveil (12 × 1,8 m à 3 m) ;
// - en arc : balcon de la salle 6 (300°, 1 m de large à 4 m), passerelle annulaire du Cœur (rayon 4,5 m, 1,5 m) ;
// - modèle mezzanine (lisse simple, sous-lisse, plinthe) ou anneau (double lisse) ;
// - adossée à un mur (consoles de pierre) ou libre (piliers de bronze jusqu'au sol, garde-corps des deux côtés) ;
// - trouées dans le garde-corps pour l'arrivée d'un escalier.
// La graine change la patine barreau par barreau, une plaque de caillebotis remplacée (plus claire), un barreau
// arraché, un poteau un peu penché, le profil des consoles (2 ou 3 ressauts).
// Praticable : `group.userData.walk` (dessus du plancher, garde-corps qui bloquent à l'étage, dessous où l'on passe).
//
// 3 draw calls : bronze (plancher, poutrelles, poteaux), laiton (lisses), pierre (consoles).

import * as THREE from "three";
import { buildBlock, buildPrism } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import { PX, beam, mergeToned, metalMaterial, openBar, stoneMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = { mezzanine: "Mezzanine (lisse simple, plinthe)", ring: "Anneau (double lisse)" };
const SHAPES = { straight: "Droite", arc: "En arc de cercle" };
const BACKS = { wall: "Adossée à un mur (consoles)", free: "Libre (piliers, garde-corps des deux côtés)" };
const ENDS = { closed: "Garde-corps aux deux bouts", open: "Bouts ouverts (contre les murs)" };
const OPENINGS = { none: "Aucune", start: "Au début", middle: "Au milieu", end: "À la fin" };
const RAIL_H = 1.0;
const DECK = 0.06; // épaisseur du caillebotis
const BAR = PX * 2; // pas du quadrillage (un barreau d'un pixel tous les 2 pixels)

const params = {
  seed: seedParam("Change la patine barreau par barreau, une plaque remplacée, un barreau arraché, un poteau penché, le profil des consoles."),
  model: choiceParam("Modèle", MODELS, "Mezzanine (lisse simple, sous-lisse et plinthe : Archives, Éveil) ou anneau (double lisse : salle 6, Cœur)."),
  shape: choiceParam("Tracé", SHAPES, "Passerelle droite (le long d'un mur) ou en arc de cercle (balcon d'une salle ronde)."),
  back: choiceParam("Appui", BACKS, "Adossée à un mur (côté −z, ou côté extérieur de l'arc) sur des consoles de pierre, ou libre sur des piliers."),
  length: numberParam("Longueur", 6, 2, 24, "Passerelle droite : longueur (18 m : mezzanine des Archives ; 12 m : galerie de l'Éveil).", { step: 0.5, unit: "m" }),
  width: numberParam("Largeur", 1.2, 0.8, 2, "Largeur du plancher (1,2 m : mezzanine ; 1,5 m : passerelle du Cœur ; 1 m : balcon de la salle 6).", { step: 0.1, unit: "m" }),
  radius: numberParam("Rayon intérieur", 4.5, 2, 6, "En arc : rayon du bord intérieur (côté vide).", { step: 0.25, unit: "m" }),
  angle: numberParam("Angle", 150, 30, 180, "En arc : angle couvert, centré sur +z (un balcon de 300° se pose en deux arcs de 150°).", { step: 10, unit: "°" }),
  height: numberParam("Hauteur", 3.4, 1, 6, "Hauteur du dessus du plancher (3,4 m : Archives ; 3 m : Éveil ; 4 m : salle 6 et Cœur).", { step: 0.1, unit: "m" }),
  ends: choiceParam("Bouts", ENDS, "Garde-corps en travers des deux bouts, ou bouts ouverts (la passerelle va d'un mur à l'autre)."),
  opening: choiceParam("Trouée", OPENINGS, "Une trouée de 1 m dans le garde-corps côté vide, pour l'arrivée d'un escalier (le monde peut en donner d'autres : `openings`)."),
};

export const meta = {
  id: "buildings/structure/grating-walkway",
  name: "Passerelle en caillebotis",
  nameEn: "Grating walkway",
  category: "buildings",
  subcategory: "structure",
  description:
    "Passerelle du Complexe : plancher de bronze percé d'un quadrillage d'un pixel (on voit au travers), poutrelles, " +
    "consoles de pierre ancrées au mur ou piliers, garde-corps de 1 m à lisse simple ou double. Droite (mezzanine des " +
    "Archives, galerie de l'Éveil) ou en arc (balcon de la salle 6, anneau du Cœur), trouées pour les escaliers. " +
    "Praticable, on passe dessous. Fiches ARC-14, E5-06, E6-04, COE-01.",
  tags: [
    "passerelle", "mezzanine", "balcon", "galerie", "caillebotis", "quadrillage", "garde-corps", "lisse", "console",
    "poutrelle", "bronze", "laiton", "étage", "le complexe", "complexe", "ancien-tech", "modulaire", "praticable", "intérieur",
    "walkway", "catwalk", "balcony", "gallery deck", "floor grating", "grid", "guard rail", "handrail", "corbel", "joist",
    "upper floor", "ancient complex", "ancient-tech", "modular", "walkable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units:
    "1 unité = 1 mètre ; droite : origine au sol sous le milieu du plancher, longueur le long de x, côté mur en −z ; " +
    "en arc : origine au sol au centre du cercle, arc centré sur +z, côté mur à l'extérieur",
  footprint: { radius: 5.7, height: 4.45 },
  animated: [],
  params,
  variants: [
    { id: "mezzanine", name: "Mezzanine (droite, au mur)", params: {} },
    { id: "free", name: "Libre, trouée au milieu", params: { back: "free", opening: "middle", length: 5, height: 3 } },
    { id: "ring", name: "Anneau du Cœur (arc de 150°)", params: { model: "ring", shape: "arc", width: 1.5, radius: 3, height: 3 } },
  ],
};

/**
 * Crée la passerelle.
 * @param {object} [given] réglages du schéma, plus `openings` (réservé aux mondes) : trouées du garde-corps côté vide,
 *   [[début, fin], ...] en mètres le long de x (droite) ou en radians depuis +z (arc) ; remplace `opening`
 * @returns {THREE.Group} `group.userData.walk` : { heightAt, occupied } ; `group.userData.walkway` : { top, shape, ... }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 227);
  const top = p.height;
  const W = p.width;
  const arc = p.shape === "arc";
  const ring = p.model === "ring";
  const free = p.back === "free";
  const closedEnds = p.ends === "closed";
  const bronze = [], brass = [], stone = [];
  const patina = () => rng.range(-0.12, 0.06);

  // --- Repère du tracé : u le long (m pour la droite, radians pour l'arc), v en travers (0 côté vide → W côté mur).
  const Ri = p.radius, Ro = p.radius + W;
  const A = THREE.MathUtils.degToRad(p.angle);
  const L = p.length;
  const u0 = arc ? -A / 2 : -L / 2, u1 = -u0;
  const at = arc
    ? (u, v, y) => new THREE.Vector3(Math.sin(u) * (Ri + v), y, Math.cos(u) * (Ri + v))
    : (u, v, y) => new THREE.Vector3(u, y, W / 2 - v);
  const along = (v) => (arc ? Ri + v : 1); // mètres par unité de u à la distance v
  // Morceaux le long du tracé (≤ 0,5 m d'arc) pour les lisses et le cadre.
  const pieces = (from, to, v, max = 0.5) => Math.max(1, Math.ceil((Math.abs(to - from) * along(v)) / max));
  const strip = (from, to, v, y, w, h, tone, list = bronze, max = 1, make = beam) => {
    const n = arc ? pieces(from, to, v, max) : 1;
    for (let k = 0; k < n; k++) {
      const a = from + ((to - from) * k) / n, b = from + ((to - from) * (k + 1)) / n;
      list.push(withTone(make(at(a, v, y), at(b, v, y), w, h), tone));
    }
  };

  // --- Trouées du garde-corps côté vide.
  let openings = given.openings;
  if (!openings) {
    const span = arc ? 1 / Ri : 1; // 1 m
    const where = { none: null, start: u0 + span * 0.2, middle: -span / 2, end: u1 - span * 1.2 }[p.opening];
    openings = where === null ? [] : [[where, where + span]];
  }
  const inOpening = (u) => openings.some(([a, b]) => u > a && u < b);

  // --- Plancher : cadre, barreaux porteurs le long du tracé, traverses d'un pixel en travers.
  const f = PX * 1.5;
  strip(u0, u1, f / 2, top - DECK / 2, f, DECK, 0.05);
  strip(u0, u1, W - f / 2, top - DECK / 2, f, DECK, -0.05);
  for (const u of [u0, u1]) bronze.push(withTone(beam(at(u, 0, top - DECK / 2), at(u, W, top - DECK / 2), f, DECK), 0));
  const rows = Math.max(2, Math.round(W / BAR));
  for (let j = 1; j < rows; j++) strip(u0, u1, (W * j) / rows, top - DECK * 0.45, PX * 0.5, DECK * 0.9, patina() - 0.05, bronze, 1.2, openBar);
  // Plaque remplacée : une portion de 1 à 2 m un peu plus claire ; un barreau arraché.
  const patchAt = u0 + (u1 - u0) * rng.range(0.15, 0.75);
  const patchLen = (arc ? 1.5 / Ri : 1.5) * rng.range(0.7, 1.2);
  const crossN = Math.round(((u1 - u0) * along(W / 2)) / BAR);
  const torn = rng.int(2, crossN - 2);
  for (let i = 1; i < crossN; i++) {
    if (i === torn) continue;
    const u = u0 + ((u1 - u0) * i) / crossN;
    const patched = u > patchAt && u < patchAt + patchLen;
    bronze.push(withTone(openBar(at(u, f, top - DECK * 0.25), at(u, W - f, top - DECK * 0.25), PX * 0.5, DECK * 0.5), patina() + (patched ? 0.22 : -0.1)));
  }

  // --- Poutrelles tous les 2 m sous le plancher, du côté mur au côté vide.
  const joistN = Math.max(1, Math.round(((u1 - u0) * along(W / 2)) / 2));
  for (let i = 0; i <= joistN; i++) {
    const u = u0 + ((u1 - u0) * i) / joistN;
    bronze.push(withTone(beam(at(u, 0.02, top - DECK - 0.09), at(u, W, top - DECK - 0.09), 0.08, 0.18), (x, y, z, nx, ny) => (ny < -0.5 ? -0.3 : -0.12)));
  }
  // Longeron sous le bord vide, qui porte les poteaux.
  strip(u0, u1, 0.04, top - DECK - 0.09, 0.08, 0.18, -0.15);

  // --- Appuis : consoles de pierre au mur, ou piliers de bronze jusqu'au sol.
  if (!free) {
    const spacing = ring ? 1.5 : 3;
    const count = Math.max(2, Math.round(((u1 - u0) * along(W)) / spacing));
    const steps = rng.chance(0.5) ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const u = u0 + ((u1 - u0) * (i + 0.5)) / count;
      // Encorbellement : `steps` ressauts de plus en plus courts vers le bas, sous le bord côté mur.
      for (let s = 0; s < steps; s++) {
        const depth = 0.42 * (1 - s / (steps + 0.5));
        const h = 0.16;
        const y1 = top - DECK - s * h, y0 = y1 - h;
        const c = at(u, W - depth / 2, 0);
        const dir = at(u, W, 0).sub(at(u, 0, 0)).normalize();
        const side = new THREE.Vector3(dir.z, 0, -dir.x);
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [c.x + side.x * a * 0.15 + dir.x * b * depth / 2, c.z + side.z * a * 0.15 + dir.z * b * depth / 2]);
        stone.push(withTone(buildPrism(pts, y0, () => y1), (x, y, z, nx, ny) => (ny > 0.5 ? 0.05 : -0.08 * s)));
      }
    }
  } else {
    const count = Math.max(2, Math.round(((u1 - u0) * along(W / 2)) / 3) + 1);
    for (let i = 0; i < count; i++) {
      const u = u0 + ((u1 - u0) * i) / (count - 1) + (i === 0 ? 0.15 / along(0) : i === count - 1 ? -0.15 / along(0) : 0);
      for (const v of [0.06, W - 0.06]) {
        const pillar = at(u, v, 0);
        bronze.push(withTone(buildBlock([0.1, top - DECK, 0.1], [pillar.x, (top - DECK) / 2, pillar.z]), (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.05 : 0.05) - 0.12 * (1 - THREE.MathUtils.smoothstep(y, 0, 1))));
        bronze.push(withTone(buildBlock([0.18, 0.08, 0.18], [pillar.x, 0.04, pillar.z]), -0.2));
      }
    }
  }

  // --- Garde-corps : côté vide (et côté mur si libre), aux bouts si fermés.
  const postEvery = ring ? 1.5 : 1;
  const bent = rng.int(1, 6);
  const railLine = (from, to, v, withPosts = true) => {
    if (to - from < 1e-3) return;
    const y = top + RAIL_H;
    strip(from, to, v, y, 0.05, 0.045, (x, py, z, nx, ny) => (ny > 0.5 ? 0.2 : -0.1), brass);
    if (ring) strip(from, to, v, top + RAIL_H * 0.55, 0.045, 0.04, 0.05, brass);
    else {
      strip(from, to, v, top + RAIL_H * 0.5, PX, PX, -0.05);
      strip(from, to, v, top + 0.05, PX * 0.6, 0.1, -0.1); // plinthe
    }
    if (!withPosts) return;
    const n = Math.max(1, Math.round(((to - from) * along(v)) / postEvery));
    for (let i = 0; i <= n; i++) {
      const u = from + ((to - from) * i) / n;
      const lean = i === bent ? 0.04 : 0;
      const a = at(u, v, top), b = at(u, v + lean, top + RAIL_H);
      bronze.push(withTone(beam(a, b, PX * 1.4, PX * 1.4), i === bent ? -0.1 : 0.02));
    }
  };
  const railV = 0.03;
  // Côté vide, coupé aux trouées.
  const cuts = [u0, ...openings.flat().filter((u) => u > u0 && u < u1).sort((a, b) => a - b), u1];
  for (let k = 0; k + 1 < cuts.length; k += 2) railLine(cuts[k], cuts[k + 1], railV);
  if (free) railLine(u0, u1, W - railV);
  if (closedEnds) {
    for (const u of [u0 + 0.02 / along(0), u1 - 0.02 / along(0)]) {
      const y = top + RAIL_H;
      brass.push(withTone(beam(at(u, railV, y), at(u, W - railV, y), 0.05, 0.045), 0.15));
      bronze.push(withTone(beam(at(u, railV, top + RAIL_H * 0.5), at(u, W - railV, top + RAIL_H * 0.5), PX, PX), -0.05));
      bronze.push(withTone(beam(at(u, W - railV, top), at(u, W - railV, top + RAIL_H), PX * 1.4, PX * 1.4), 0.02));
    }
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const meshes = [
    ["bronze", bronze, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true })],
    ["brass", brass, metalMaterial(METALS.blackenedBrass, { id: 31, tone: true })],
    ["consoles", stone, stoneMaterial(STONES.smoked, { seed: p.seed, id: 20 })],
  ];
  for (const [name, parts, material] of meshes) {
    if (!parts.length) {
      material.dispose();
      continue;
    }
    const mesh = new THREE.Mesh(mergeToned(parts), material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // --- Marche : (u, v) d'un point du sol ; le plancher, ses garde-corps, ses appuis.
  const toUV = (x, z) => {
    if (!arc) return [x, W / 2 - z];
    return [Math.atan2(x, z), Math.hypot(x, z) - Ri];
  };
  const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
  const walk = {
    heightAt(x, z, y, up = 0.4) {
      const [u, v] = toUV(x, z);
      return u >= u0 && u <= u1 && v >= 0 && v <= W && top <= y + up ? top : -Infinity;
    },
    occupied(x, z, radius, y0, y1) {
      const [u, v] = toUV(x, z);
      const du = radius / along(Math.max(0, v));
      if (u < u0 - du || u > u1 + du || v < -radius || v > W + radius) return false;
      // Plancher, poutrelles et consoles : on ne passe pas au travers (on passe dessous).
      if (overlaps(y0, y1, top - 0.5, top)) return true;
      const rail = overlaps(y0, y1, top, top + RAIL_H);
      if (rail && Math.abs(v - railV) < radius && !inOpening(u)) return true;
      if (rail && free && Math.abs(v - (W - railV)) < radius) return true;
      if (rail && closedEnds && ((u - u0) * along(v) < radius || (u1 - u) * along(v) < radius)) return true;
      if (free && overlaps(y0, y1, 0, top)) {
        // Piliers : petits carrés aux deux bords, tous les ~3 m.
        const count = Math.max(2, Math.round(((u1 - u0) * along(W / 2)) / 3) + 1);
        for (let i = 0; i < count; i++) {
          const pu = u0 + ((u1 - u0) * i) / (count - 1);
          if (Math.abs(u - pu) * along(v) < radius + 0.2 && (Math.abs(v - 0.06) < radius + 0.05 || Math.abs(v - (W - 0.06)) < radius + 0.05)) return true;
        }
      }
      return false;
    },
  };
  group.userData.walk = walk;
  group.userData.walkway = { top, shape: p.shape, width: W, length: arc ? null : L, radius: arc ? Ri : null, angle: arc ? A : null, openings };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
