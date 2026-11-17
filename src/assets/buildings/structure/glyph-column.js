// Colonne du Complexe (fiches SAS-03, ARC-09, GAL-11, ORA-06 et pilastres des salles rondes, docs/complexe/) : un fût
// de pierre fumée sur une base moulurée, deux bagues de bronze, un chapiteau où brille une couronne de glyphes ambre.
// Quatre formes : pilier carré à chanfreins (Sas), colonne ronde cannelée (Archives, Rotonde), demi-colonne engagée
// dans un mur (Oracle, avec sa fibre cyan), pilastre plat (salles rondes).
//
// 3 draw calls : pierre (tons par sommet : suie en haut, pied plus sombre), bronze, lueurs (glyphes, fibre cyan).

import * as THREE from "three";
import { buildBlock, buildLathe, buildPrism } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import {
  PX, bendAroundY, fluteShaft, glowMixMaterial, glyphStrip, mergeToned, metalMaterial, ring, soot, squareRing, stoneMaterial,
  withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, glowParam, numberParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const SHAPES = { square: "Pilier carré à chanfreins", fluted: "Colonne cannelée", engaged: "Demi-colonne engagée", pilaster: "Pilastre" };
const FIBERS = { none: "Sans fibre", cyan: "Fibre cyan" };
const GLYPHS = { lit: "Allumés", dim: "En veille", off: "Éteints" };
const LEVELS = { lit: 2, dim: 1, off: 0 };
const BASE = 0.4;
const CAPITAL = 0.5;

const params = {
  seed: seedParam("Change les glyphes du chapiteau, les tons et les écaillures, la hauteur exacte des bagues, l'usure du pied."),
  shape: choiceParam("Forme", SHAPES, "Pilier carré (Sas), colonne ronde cannelée (Archives, Rotonde), demi-colonne engagée dans un mur, ou pilastre."),
  height: numberParam("Hauteur", 5, 3, 14, "Du sol au-dessus du chapiteau (5 m au Sas, 7 m aux Archives, 10 m à l'Oracle).", { step: 0.5, unit: "m" }),
  diameter: numberParam("Largeur", 0.9, 0.6, 1.2, "Largeur du fût (diamètre, ou côté du pilier carré).", { step: 0.05, unit: "m" }),
  flutes: { type: "int", default: 16, min: 8, max: 24, label: "Cannelures", description: "Nombre de cannelures d'une colonne ronde (16 aux Archives, 12 à la Rotonde, 20 à l'Oracle)." },
  fiber: choiceParam("Fibre", FIBERS, "Une rainure verticale d'un pixel où court une fibre de lumière cyan (Oracle)."),
  glyphs: choiceParam("Glyphes", GLYPHS, "La couronne de glyphes du chapiteau : allumée, en veille ou éteinte."),
  glow: glowParam("Couleur des glyphes."),
  stone: stoneParam("Pierre de la colonne.", { only: ["smoked", "blackBasalt"] }),
};

export const meta = {
  id: "buildings/structure/glyph-column",
  name: "Colonne à glyphes",
  nameEn: "Glyph column",
  category: "buildings",
  subcategory: "structure",
  description:
    "Colonne du Complexe : base moulurée, fût de pierre fumée, deux bagues de bronze, chapiteau ceint d'une couronne " +
    "de glyphes ambre. Pilier carré à chanfreins, colonne cannelée, demi-colonne engagée ou pilastre ; de 3 à 14 m ; " +
    "fibre de lumière cyan en option. Fiches SAS-03, ARC-09, GAL-11, ORA-06.",
  tags: [
    "colonne", "pilier", "pilastre", "demi-colonne", "cannelures", "chapiteau", "glyphes", "bronze", "fibre", "le complexe",
    "complexe", "ancien-tech", "architecture", "lumineux", "intérieur",
    "column", "pillar", "pilaster", "engaged column", "flutes", "capital", "glyphs", "fiber", "ancient complex",
    "ancient-tech", "architectural", "glowing", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units:
    "1 unité = 1 mètre ; origine au sol, au centre du fût (pilier, colonne) ou au nu du mur (demi-colonne, pilastre : " +
    "le mur est en z ≤ 0, la colonne avance vers +z)",
  footprint: { radius: 0.85, height: 5 },
  animated: [],
  params,
  variants: variantsOf("shape", params.shape),
};

/**
 * Crée la colonne.
 * @param {{seed?: number, shape?: string, height?: number, diameter?: number, flutes?: number, fiber?: string,
 *   glyphs?: string, glow?: string, stone?: string}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const shape = createRng(p.seed * 7919 + 17);
  const glyphRng = createRng(p.seed * 104729 + 71);
  const H = p.height;
  const D = p.shape === "pilaster" ? Math.min(p.diameter, 0.7) : p.diameter;
  const r = D / 2;
  const shaft0 = BASE, shaft1 = H - CAPITAL;
  const sootAt = soot(H * 0.5, H, -0.24);
  const foot = (x, y) => (y < 0.6 ? -0.1 * (1 - y / 0.6) : 0);
  const baseTone = shape.range(-0.06, 0.04);
  const toneAt = (x, y) => baseTone + sootAt(x, y) + foot(x, y);

  const stoneParts = [];
  const bronzeParts = [];
  const glowParts = [];
  const addStone = (g, extra = 0) => stoneParts.push(withTone(g, (x, y) => toneAt(x, y) + extra));
  const ringYs = [H * shape.range(0.23, 0.26), H * shape.range(0.7, 0.74)];
  const level = LEVELS[p.glyphs];

  // Glyphes du chapiteau : une couronne de 2 px, à mi-hauteur de la gorge.
  const glyphY = shaft1 + 0.12;
  const flatGlyphs = (length, x, z, rotY) => {
    const strip = glyphStrip(glyphRng, { length, rows: 2 });
    strip.rotateY(rotY);
    strip.translate(x, glyphY, z);
    glowParts.push(withShade(strip, 0));
  };

  if (p.shape === "square") {
    // Fût octogonal : carré aux arêtes abattues d'un pixel et demi.
    const c = PX * 1.5;
    const outline = [[-r + c, -r], [r - c, -r], [r, -r + c], [r, r - c], [r - c, r], [-r + c, r], [-r, r - c], [-r, -r + c]];
    addStone(buildPrism(outline, shaft0, () => shaft1));
    // Base : socle + moulure ; chapiteau : gorge creusée (les glyphes) + tailloir débordant.
    addStone(buildBlock([D + 0.24, 0.26, D + 0.24], [0, 0.13, 0]), -0.04);
    addStone(buildBlock([D + 0.12, BASE - 0.26, D + 0.12], [0, 0.26 + (BASE - 0.26) / 2, 0]));
    addStone(buildBlock([D + 0.04, 0.28, D + 0.04], [0, shaft1 + 0.14, 0]), -0.06);
    addStone(buildBlock([D + 0.3, CAPITAL - 0.28, D + 0.3], [0, shaft1 + 0.28 + (CAPITAL - 0.28) / 2, 0]));
    const half = (D + 0.04) / 2;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      flatGlyphs(D - 0.12, Math.sin(a) * half, Math.cos(a) * half, a);
    }
    for (const y of ringYs) bronzeParts.push(squareRing({ size: D, y: y - PX, height: PX * 2, thickness: PX * 0.8 }));
  } else if (p.shape === "fluted") {
    addStone(fluteShaft({ radius: r, flutes: p.flutes, depth: PX * 1.2, y0: shaft0, y1: shaft1 }));
    const sides = Math.max(12, p.flutes);
    addStone(buildBlock([D + 0.24, 0.24, D + 0.24], [0, 0.12, 0]), -0.04);
    addStone(buildLathe([[0, 0.24], [r + 0.08, 0.24], [r + 0.1, 0.3], [r + 0.05, BASE - 0.04], [r + 0.02, BASE], [0, BASE]], { segments: sides, facets: true }));
    addStone(buildLathe([[0, shaft1], [r + 0.01, shaft1], [r + 0.01, shaft1 + 0.28], [0, shaft1 + 0.28]], { segments: sides, facets: true }), -0.06);
    addStone(buildLathe([[0, shaft1 + 0.28], [r + 0.08, shaft1 + 0.28], [r + 0.16, H - 0.06], [r + 0.16, H], [0, H]], { segments: sides, facets: true }));
    const strip = glyphStrip(glyphRng, { length: 2 * Math.PI * (r + 0.01) - PX * 2, rows: 2 });
    strip.translate(0, glyphY, 0);
    glowParts.push(withShade(bendAroundY(strip, r + 0.01, { concave: false }), 0));
    for (const y of ringYs) bronzeParts.push(ring({ radius: r - PX * 0.5, y: y - PX, height: PX * 2, thickness: PX * 1.2, segments: sides }));
  } else if (p.shape === "engaged") {
    // Demi-colonne : demi-fût cannelé contre le mur (z = 0), base et chapiteau en demi-blocs.
    addStone(fluteShaft({ radius: r, flutes: p.flutes, depth: PX * 1.2, y0: shaft0, y1: shaft1, arc: [-Math.PI / 2, Math.PI / 2] }));
    addStone(buildBlock([D + 0.24, 0.24, r + 0.12], [0, 0.12, (r + 0.12) / 2]), -0.04);
    addStone(buildBlock([D + 0.12, BASE - 0.24, r + 0.06], [0, 0.24 + (BASE - 0.24) / 2, (r + 0.06) / 2]));
    addStone(buildBlock([D + 0.04, 0.28, r + 0.02], [0, shaft1 + 0.14, (r + 0.02) / 2]), -0.06);
    addStone(buildBlock([D + 0.3, CAPITAL - 0.28, r + 0.15], [0, shaft1 + 0.28 + (CAPITAL - 0.28) / 2, (r + 0.15) / 2]));
    flatGlyphs(D - 0.1, 0, r + 0.02, 0);
    for (const y of ringYs) {
      const band = buildBlock([Math.PI * (r + PX * 0.3), PX * 2, PX], [0, y, PX * 0.5]);
      bronzeParts.push(bendAroundY(band, r - PX * 0.4, { concave: false }));
    }
  } else {
    // Pilastre : un plat de pierre en saillie de 0,4 m.
    const depth = 0.4;
    addStone(buildBlock([D, shaft1 - shaft0, depth], [0, (shaft0 + shaft1) / 2, depth / 2]));
    addStone(buildBlock([D + 0.2, BASE, depth + 0.1], [0, BASE / 2, (depth + 0.1) / 2]), -0.04);
    addStone(buildBlock([D + 0.04, 0.28, depth + 0.02], [0, shaft1 + 0.14, (depth + 0.02) / 2]), -0.06);
    addStone(buildBlock([D + 0.24, CAPITAL - 0.28, depth + 0.12], [0, shaft1 + 0.28 + (CAPITAL - 0.28) / 2, (depth + 0.12) / 2]));
    flatGlyphs(D - 0.1, 0, depth + 0.02, 0);
    // Panneau creusé d'un pixel sur la face (un cadre de lumière et d'ombre qui allège le plat).
    addStone(buildBlock([D - 0.2, shaft1 - shaft0 - 0.5, PX * 0.5], [0, (shaft0 + shaft1) / 2, depth + PX * 0.25]), -0.12);
    for (const y of ringYs) {
      bronzeParts.push(buildBlock([D + PX * 1.6, PX * 2, PX * 0.8], [0, y, depth + PX * 0.4]));
      for (const s of [-1, 1]) bronzeParts.push(buildBlock([PX * 0.8, PX * 2, depth], [s * (D / 2 + PX * 0.4), y, depth / 2]));
    }
  }

  // Écaillures : quelques éclats d'arête plus clairs sur le fût.
  const front = p.shape === "engaged" || p.shape === "pilaster";
  for (let i = 0; i < 5; i++) {
    const y = shape.range(shaft0 + 0.3, shaft1 - 0.3);
    const a = front ? shape.range(-1.2, 1.2) : shape.range(0, Math.PI * 2);
    const rr = p.shape === "pilaster" ? 0 : r - PX * 0.2;
    const x = p.shape === "pilaster" ? shape.range(-D / 2 + 0.1, D / 2 - 0.1) : Math.sin(a) * rr;
    const z = p.shape === "pilaster" ? 0.4 : Math.cos(a) * rr;
    const chip = buildBlock([PX * shape.int(1, 2), PX * shape.int(1, 3), PX * 0.6], [x, y, z], [0, a, 0]);
    stoneParts.push(withTone(chip, 0.3));
  }

  // Fibre cyan : une rainure verticale d'un pixel sur la face avant, du haut de la base à la gorge du chapiteau.
  if (p.fiber === "cyan") {
    const z = p.shape === "pilaster" ? 0.4 + PX * 0.5 : p.shape === "square" ? r : r - PX * 0.6;
    const a = p.shape === "fluted" || p.shape === "engaged" ? Math.PI / p.flutes : 0;
    const fiber = buildBlock([PX, shaft1 - shaft0 - 0.1, PX * 0.6], [0, (shaft0 + shaft1) / 2, z]);
    fiber.rotateY(a);
    glowParts.push(withShade(fiber, 1));
  }

  const group = new THREE.Group();
  group.name = meta.name;
  const stoneMesh = new THREE.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: shape.int(0, 96), id: 20, grain: 0.06 }));
  stoneMesh.name = "column";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);

  const bronze = new THREE.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 21 }));
  bronze.name = "rings";
  bronze.castShadow = true;
  group.add(bronze);

  const glow = new THREE.Mesh(mergeToned(glowParts), glowMixMaterial([[p.glow, level], ["cyan", 2]], { id: 22 }));
  glow.name = "glyphs";
  group.add(glow);

  group.userData.asset = { id: meta.id, params: p };
  return group;
}
