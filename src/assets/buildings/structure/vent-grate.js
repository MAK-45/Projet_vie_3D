// Grille du Complexe (fiches SAS-12 et COE-12, docs/complexe/) : du bronze percé, avec une lueur qui passe au travers.
// - grille d'aération murale (Sas) : plaque de 0,8 × 0,8 × 0,1 m percée d'un damier d'un pixel (les hexagones de la
//   bible ne se lisent pas à cette taille), lueur ambre derrière, 4 plots aux angles ;
// - caillebotis de sol (salle du Cœur) : grille de 2 × 2 m, 6 cm d'épaisseur, quadrillage d'un pixel ; module droit
//   ou module courbe pour l'anneau autour de la fosse (rayon réglable). On marche dessus.
// Les trous sont de vrais vides : on voit la lueur (ou le fond) au travers, sans texture.
// La graine change la patine barreau par barreau, quelques barreaux tordus ou plus sombres, un plot manquant.
//
// 2 draw calls : bronze, lueur.

import * as THREE from "three";
import { buildBlock } from "../../kit/geometry.js";
import { METALS } from "../../kit/palettes.js";
import { PX, beam, glowMaterial, mergeToned, metalMaterial, orient, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, glowParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = { wall: "Grille murale (0,8 m)", floor: "Caillebotis droit (2 × 2 m)", "floor-curved": "Caillebotis courbe (anneau)" };
const LIGHTS = { on: "Allumée", standby: "En veille", off: "Éteinte" };
const LEVELS = { on: 2, standby: 1, off: 0 };

const params = {
  seed: seedParam("Change la patine barreau par barreau, les barreaux tordus ou noircis, le plot manquant."),
  model: choiceParam("Modèle", MODELS, "Grille d'aération murale du Sas, ou caillebotis de sol du Cœur (droit ou courbe)."),
  light: choiceParam("Lueur derrière", LIGHTS, "La lueur vue au travers : allumée, en veille ou éteinte (fond sombre)."),
  glow: glowParam("Couleur de la lueur : ambre (machines, Sas) ou cyan (fosse d'énergie du Cœur).", { only: ["amber", "cyan"] }),
  height: numberParam("Hauteur", 0.6, 0.2, 3, "Grille murale : hauteur de son centre.", { step: 0.05, unit: "m" }),
  radius: numberParam("Rayon", 4, 2, 10, "Caillebotis courbe : rayon intérieur de l'anneau (le module couvre 2 m de large et environ 2 m d'arc).", { step: 0.25, unit: "m" }),
};

export const meta = {
  id: "buildings/structure/vent-grate",
  name: "Grille et caillebotis",
  nameEn: "Vent grate and floor grating",
  category: "buildings",
  subcategory: "structure",
  description:
    "Grilles de bronze du Complexe, percées pour de vrai : grille d'aération murale à damier d'un pixel et lueur " +
    "ambre derrière (Sas), ou caillebotis de sol de 2 × 2 m à quadrillage, droit ou courbe pour l'anneau autour de la " +
    "fosse du Cœur, praticable. Lueur ambre ou cyan, allumée, en veille ou éteinte. Fiches SAS-12, COE-12.",
  tags: [
    "grille", "aération", "ventilation", "caillebotis", "damier", "quadrillage", "bronze", "lueur", "anneau",
    "le complexe", "complexe", "ancien-tech", "modulaire", "praticable", "intérieur",
    "vent grate", "air vent", "floor grating", "checkerboard", "grid", "glow", "curved ring", "ancient complex",
    "ancient-tech", "modular", "walkable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units:
    "1 unité = 1 mètre ; murale : origine au sol au pied du mur (mur en z = 0, la grille regarde +z), centre à `height` ; " +
    "caillebotis : origine au sol, au centre, dessus à 0,06 m ; courbe : l'anneau a son centre en z = +radius + 1 (côté +z)",
  footprint: { radius: 1.45, height: 1.1 },
  animated: [],
  params,
  variants: variantsOf("model", params.model),
};

/**
 * Crée la grille.
 * @param {{seed?: number, model?: string, light?: string, glow?: string, height?: number, radius?: number}} [given]
 * @returns {THREE.Group} `group.userData.walkable` (caillebotis) : hauteur du dessus
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 67);
  const bronze = [];
  const glowParts = [];
  const patina = () => rng.range(-0.12, 0.08);

  if (p.model === "wall") {
    const S = 0.8, T = 0.1, h = p.height;
    const zFront = T;
    // Cadre : 4 montants de 2 pixels, chanfrein clair ; fond : boîte sombre en retrait.
    const f = PX * 2;
    bronze.push(withTone(buildBlock([S, f, T], [0, h + S / 2 - f / 2, T / 2]), 0.1));
    bronze.push(withTone(buildBlock([S, f, T], [0, h - S / 2 + f / 2, T / 2]), -0.05));
    for (const s of [-1, 1]) bronze.push(withTone(buildBlock([f, S - 2 * f, T], [s * (S / 2 - f / 2), h, T / 2]), 0));
    bronze.push(withTone(buildBlock([S - 2 * f, S - 2 * f, 0.01], [0, h, 0.005]), -0.8)); // fond (se voit éteint)
    // Damier d'un pixel : une case sur deux pleine, sur une plaque à 1 cm sous la face avant.
    const inner = S - 2 * f;
    const n = Math.floor(inner / PX);
    const cell = inner / n;
    const bent = rng.int(0, n - 1); // une rangée un peu enfoncée (un coup reçu)
    const broken = new Set(Array.from({ length: rng.int(0, 3) }, () => `${rng.int(1, n - 2)},${rng.int(1, n - 2)}`)); // cases arrachées
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i + j) % 2 || broken.has(`${i},${j}`)) continue;
        const x = -inner / 2 + (i + 0.5) * cell, y = h - inner / 2 + (j + 0.5) * cell;
        const dent = j === bent && i > n * 0.3 && i < n * 0.7 ? 0.012 : 0;
        bronze.push(withTone(buildBlock([cell * 1.02, cell * 1.02, 0.02], [x, y, zFront - 0.02 - dent]), (j / n) * 0.12 - 0.08 - (dent ? 0.2 : 0)));
      }
    }
    // Plots aux 4 angles (un manquant parfois : son trou sombre reste).
    const missing = rng.chance(0.35) ? rng.int(0, 3) : -1;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], k) => {
      const pos = [sx * (S / 2 - f / 2), h + sy * (S / 2 - f / 2), zFront];
      if (k === missing) bronze.push(withTone(buildBlock([PX * 0.8, PX * 0.8, 0.004], [pos[0], pos[1], zFront + 0.002]), -0.9));
      else bronze.push(withTone(orient(plain(new THREE.CylinderGeometry(PX * 0.7, PX * 0.8, 0.03, 6)), [pos[0], pos[1], zFront + 0.015], [0, 0, 1]), 0.35));
    });
    // Lueur derrière la grille.
    glowParts.push(buildBlock([inner, inner, 0.005], [0, h, 0.03]));
  } else if (p.model === "floor") {
    const S = 2 - PX, T = 0.06;
    const f = PX * 1.5;
    // Cadre et quadrillage d'un pixel (barreaux tous les 2 pixels) ; les barreaux porteurs (le long de z) plus hauts.
    for (const s of [-1, 1]) {
      bronze.push(withTone(buildBlock([S, T, f], [0, T / 2, s * (S / 2 - f / 2)]), 0.05));
      bronze.push(withTone(buildBlock([f, T, S - 2 * f], [s * (S / 2 - f / 2), T / 2, 0]), 0));
    }
    const step = PX * 2;
    const n = Math.round((S - 2 * f) / step);
    const pitch = (S - 2 * f) / n;
    for (let i = 1; i < n; i++) {
      const x = -S / 2 + f + i * pitch;
      const dark = rng.chance(0.12) ? -0.3 : 0;
      bronze.push(withTone(buildBlock([PX * 0.5, T - 0.005, S - 2 * f], [x + rng.range(-0.006, 0.006), (T - 0.005) / 2, 0]), patina() + dark));
    }
    const gone = rng.int(1, n - 1); // une traverse arrachée (parfois)
    const goneToo = rng.chance(0.5) ? gone : -1;
    for (let j = 1; j < n; j++) {
      if (j === goneToo) continue;
      const z = -S / 2 + f + j * pitch;
      bronze.push(withTone(buildBlock([S - 2 * f, T * 0.5, PX * 0.5], [0, T - T * 0.25, z]), patina() - 0.1));
    }
    glowParts.push(buildBlock([S - 2 * f, 0.004, S - 2 * f], [0, 0.002, 0]));
  } else {
    // Caillebotis courbe : un secteur d'anneau de 2 m de large, centré sur l'axe z ; le centre de l'anneau est côté +z.
    const R0 = p.radius, R1 = p.radius + 2 - PX, T = 0.06;
    const Rm = (R0 + R1) / 2;
    const span = 2 / Rm; // angle du module : environ 2 m d'arc au milieu
    const cz = Rm; // centre de l'anneau (le module est centré sur l'origine)
    const point = (r, a, y) => new THREE.Vector3(Math.sin(a) * r, y, cz - Math.cos(a) * r);
    const arc = (r, y, w, h, tone, segments) => {
      for (let k = 0; k < segments; k++) {
        const a0 = -span / 2 + (k / segments) * span, a1 = -span / 2 + ((k + 1) / segments) * span;
        bronze.push(withTone(beam(point(r, a0, y), point(r, a1, y), w, h), tone));
      }
    };
    const f = PX * 1.5;
    arc(R0 + f / 2, T / 2, f, T, 0.05, 8);
    arc(R1 - f / 2, T / 2, f, T, 0.05, 8);
    for (const s of [-1, 1]) bronze.push(withTone(beam(point(R0, (s * span) / 2, T / 2), point(R1, (s * span) / 2, T / 2), f, T), 0));
    // Barreaux porteurs radiaux (tous les 2 pixels au milieu), traverses en arcs.
    const radials = Math.round((Rm * span) / (PX * 2));
    for (let i = 1; i < radials; i++) {
      const a = -span / 2 + (i / radials) * span;
      bronze.push(withTone(beam(point(R0 + f, a, (T - 0.005) / 2), point(R1 - f, a, (T - 0.005) / 2), PX * 0.5, T - 0.005), patina() + (rng.chance(0.12) ? -0.3 : 0)));
    }
    const rings = Math.round((R1 - R0 - 2 * f) / (PX * 2));
    const gone = rng.chance(0.5) ? rng.int(1, rings - 1) : -1;
    for (let j = 1; j < rings; j++) if (j !== gone) arc(R0 + f + (j / rings) * (R1 - R0 - 2 * f), T - T * 0.25, PX * 0.5, T * 0.5, patina() - 0.1, 6);
    // Lueur dessous : le secteur en éventail.
    const shape = [];
    const segs = 10;
    for (let k = 0; k <= segs; k++) shape.push(point(R0 + f, -span / 2 + (k / segs) * span, 0));
    for (let k = segs; k >= 0; k--) shape.push(point(R1 - f, -span / 2 + (k / segs) * span, 0));
    const positions = [], normals = [], index = [];
    for (const v of shape) positions.push(v.x, 0.002, v.z), normals.push(0, 1, 0);
    const m = segs + 1;
    for (let k = 0; k < segs; k++) {
      const a = k, b = k + 1, c = 2 * m - 1 - (k + 1), d = 2 * m - 1 - k;
      index.push(a, b, c, a, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    g.setIndex(index);
    glowParts.push(g);
  }

  const group = new THREE.Group();
  group.name = meta.name;
  const metal = new THREE.Mesh(mergeToned(bronze), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  metal.name = "grate";
  metal.castShadow = true;
  metal.receiveShadow = true;
  group.add(metal);
  const level = LEVELS[p.light];
  const glow = new THREE.Mesh(mergeToned(glowParts), glowMaterial(p.glow, { level, id: 40 }));
  glow.name = "glow";
  if (level === 0) glow.visible = p.model === "wall"; // éteinte : au mur, le fond reste (lueur 0 = brun sombre)
  group.add(glow);

  if (p.model !== "wall") group.userData.walkable = { top: 0.06 };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
