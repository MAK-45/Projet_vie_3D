// Dalle de sol du Complexe (fiche SAS-01, docs/complexe/PIECES.md ; aussi les sols de l'Atelier, de la salle du
// Marteau et de la salle de la Porte) : un carreau de basalte de 2 × 2 m, joint d'un pixel avec ses voisines, une
// rainure de glyphes d'un pixel qui court à 0,25 m du bord et une diagonale (trait sombre ou lueur ambre très faible).
// Variantes : intacte, fissurée, usée au centre, à trappe (cadre de bronze), tachée d'huile et de limaille.
//
// 2 draw calls (3 avec la trappe) : pierre (tons par sommet : usure, taches, fissure), rainure, bronze.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, mergeGeometries } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import { PX, beam, glowMaterial, mergeToned, metalMaterial, ring, stoneMaterial, straightGlyphRuns, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const SIZE = 2;
const THICK = 0.2;
const VARIANTS = { intact: "Intacte", cracked: "Fissurée", worn: "Usée", trapdoor: "À trappe", stained: "Tachée (huile, limaille)" };
const GROOVES = { dark: "Trait sombre", amber: "Lueur ambre très faible" };

const params = {
  seed: seedParam("Change les glyphes de la rainure, le ton de la dalle, le tracé de la fissure, la place de la trappe, les taches."),
  variant: choiceParam("État", VARIANTS, "Intacte, fissurée, usée au centre (passage), à trappe de 0,6 m, ou tachée (Atelier)."),
  stone: stoneParam("Pierre de la dalle.", { only: ["blackBasalt", "smoked"] }),
  groove: choiceParam("Rainure", GROOVES, "La rainure de glyphes : un trait sombre, ou une lueur ambre à peine allumée."),
};

export const meta = {
  id: "buildings/structure/glyph-floor-slab",
  name: "Dalle de sol à glyphes",
  nameEn: "Glyph floor slab",
  category: "buildings",
  subcategory: "structure",
  description:
    "Dalle de basalte de 2 × 2 m du Complexe, posée sur la grille de 2 m : une rainure de glyphes à traits droits " +
    "court le long du bord et en diagonale (vers la porte, une fois tournée). Intacte, fissurée, usée, à trappe de " +
    "bronze ou tachée d'huile et de limaille. Fiche SAS-01.",
  tags: [
    "dalle", "sol", "carrelage", "basalte", "glyphes", "rainure", "trappe", "fissure", "le complexe", "complexe",
    "ancien-tech", "modulaire", "grille de 2 m", "intérieur",
    "floor slab", "floor", "tile", "basalt", "glyphs", "groove", "trapdoor", "crack", "ancient complex", "ancient-tech",
    "modular", "2 m grid", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unité = 1 mètre ; origine au sol (dessous de la dalle), au centre ; dessus à 0,20 m (le monde la pose à y = −0,20) ; la diagonale va de (−x, −z) vers (+x, +z)",
  footprint: { radius: 1.42, height: 0.24 },
  animated: [],
  params,
  variants: variantsOf("variant", params.variant),
};

/**
 * Crée la dalle.
 * @param {{seed?: number, variant?: string, stone?: string, groove?: string}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const glyphRng = createRng(p.seed * 7919 + 17);
  const shape = createRng(p.seed * 104729 + 71);
  const noise = createNoise3(p.seed + 5);
  const half = (SIZE - PX) / 2; // demi-joint d'un côté : un pixel entre deux dalles voisines
  const top = THICK;

  // Trappe : carré de 0,6 m, près du centre.
  const trap = p.variant === "trapdoor"
    ? { x: Math.round(shape.range(-0.3, 0.3) / PX) * PX, z: Math.round(shape.range(-0.3, 0.3) / PX) * PX, s: 0.6 }
    : null;
  const inTrap = (x, z, margin = 0) => trap && Math.abs(x - trap.x) < trap.s / 2 + margin && Math.abs(z - trap.z) < trap.s / 2 + margin;

  // --- Pierre : corps + dessus quadrillé (les tons par sommet y dessinent l'usure et les taches).
  const baseTone = -0.17 + shape.range(-0.05, 0.05); // le dessus un cran sous le plus clair : l'usure peut y remonter
  const stain = (x, z) => noise(x * 1.4 + 3, 0.5, z * 1.4);
  const tone = (x, y, z) => {
    if (y < top - 0.01) return baseTone + 0.07;
    let t = baseTone;
    if (p.variant === "worn") t += 0.5 * Math.max(0, 1 - Math.hypot(x * 1.2, z) / 1.15) ** 0.9;
    if (p.variant === "stained") t -= 0.4 * THREE.MathUtils.smoothstep(stain(x, z), 0.56, 0.66);
    return t;
  };
  const body = withTone(buildBlock([half * 2, THICK - 0.004, half * 2], [0, (THICK - 0.004) / 2, 0]), tone);
  const surface = new THREE.PlaneGeometry(half * 2, half * 2, 12, 12);
  surface.deleteAttribute("uv");
  surface.rotateX(-Math.PI / 2);
  surface.translate(0, top, 0);
  withTone(surface, tone);
  const stoneParts = [body, surface];

  // Fissure : ligne brisée d'un pixel, un cran plus sombre que tout, partie d'un bord ; une branche.
  if (p.variant === "cracked") {
    const side = shape.int(0, 3);
    const t0 = shape.range(-0.6, 0.6);
    const start = [[t0, -half], [half, t0], [t0, half], [-half, t0]][side];
    const inward = [[0, 1], [-1, 0], [0, -1], [1, 0]][side];
    let [x, z] = start;
    let [dx, dz] = inward;
    const points = [[x, z]];
    const steps = shape.int(5, 8);
    for (let i = 0; i < steps; i++) {
      const a = shape.range(-0.7, 0.7);
      const c = Math.cos(a), s = Math.sin(a);
      [dx, dz] = [dx * c - dz * s, dx * s + dz * c];
      const len = shape.range(0.15, 0.32);
      x = THREE.MathUtils.clamp(x + dx * len, -half + 0.05, half - 0.05);
      z = THREE.MathUtils.clamp(z + dz * len, -half + 0.05, half - 0.05);
      points.push([x, z]);
    }
    const crackLine = (pts) => {
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
        stoneParts.push(withTone(beam([ax, top + 0.003, az], [bx, top + 0.003, bz], PX, 0.006), -1.2));
      }
    };
    crackLine(points);
    const from = points[shape.int(2, points.length - 2)];
    const branch = [from];
    let [bx, bz] = from;
    const ba = shape.range(0.8, 1.6) * (shape.chance(0.5) ? 1 : -1);
    for (let i = 0; i < 3; i++) {
      bx += (dx * Math.cos(ba) - dz * Math.sin(ba)) * 0.16;
      bz += (dx * Math.sin(ba) + dz * Math.cos(ba)) * 0.16;
      branch.push([THREE.MathUtils.clamp(bx, -half, half), THREE.MathUtils.clamp(bz, -half, half)]);
    }
    crackLine(branch);
  }

  // Limaille : quelques points clairs semés sur les taches (Atelier).
  if (p.variant === "stained") {
    for (let i = 0; i < 26; i++) {
      const x = shape.range(-half + 0.1, half - 0.1), z = shape.range(-half + 0.1, half - 0.1);
      if (stain(x, z) < 0.5 && !shape.chance(0.25)) continue;
      stoneParts.push(withTone(buildBlock([PX * 0.7, 0.006, PX * 0.7], [x, top + 0.003, z], [0, shape.range(0, 1.5), 0]), 0.6));
    }
  }

  const group = new THREE.Group();
  group.name = meta.name;
  const stoneMesh = new THREE.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: shape.int(0, 96), id: 20, grain: 0.07 }));
  stoneMesh.name = "slab";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);

  // --- Rainure de glyphes : tirets d'un pixel le long du pourtour (à 0,25 m du bord) et sur la diagonale.
  const grooveParts = [];
  const inset = 0.25;
  const edge = half - inset;
  const y = top + 0.002;
  const dash = (ax, az, bx, bz) => {
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (inTrap(mx, mz, 0.05)) return;
    grooveParts.push(beam([ax, y, az], [bx, y, bz], PX, 0.004));
  };
  const runLine = (ax, az, bx, bz) => {
    const length = Math.hypot(bx - ax, bz - az);
    const columns = Math.floor(length / PX);
    for (const [c, , n] of straightGlyphRuns(glyphRng, columns, 1)) {
      const t0 = c / columns, t1 = (c + n) / columns;
      dash(ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1);
    }
  };
  // Pourtour : un trait continu, ponctué de glyphes qui débordent vers l'intérieur.
  const corners = [[-edge, -edge], [edge, -edge], [edge, edge], [-edge, edge]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    dash(ax, az, bx, bz);
    const length = Math.hypot(bx - ax, bz - az);
    const columns = Math.floor(length / PX);
    const [ux, uz] = [(bx - ax) / length, (bz - az) / length];
    const [nx, nz] = [-uz, ux]; // vers l'intérieur de la dalle
    for (const [c, , n] of straightGlyphRuns(glyphRng, columns, 1)) {
      if (n < 2 || !glyphRng.chance(0.35)) continue;
      const cx = ax + ux * (c + 0.5) * PX, cz = az + uz * (c + 0.5) * PX;
      dash(cx, cz, cx + nx * PX * 2, cz + nz * PX * 2);
    }
  }
  runLine(-edge + 0.1, -edge + 0.1, edge - 0.1, edge - 0.1);
  const grooveMaterial = p.groove === "amber"
    ? glowMaterial("amber", { level: 1, id: 21 })
    : createToonMaterial({ ramp: [stone.ink, stone.ink], steps: [0.5], unlit: true, outline: false, glow: false, id: 21 });
  const groove = new THREE.Mesh(mergeGeometries(grooveParts), grooveMaterial);
  groove.name = "groove";
  group.add(groove);

  // --- Trappe : cadre de bronze d'un pixel, plaque plus sombre (vert-de-gris), anneau de levage et deux charnières.
  if (trap) {
    const { x, z, s } = trap;
    const h = 0.03;
    const w = PX;
    const bronzeParts = [
      buildBlock([s + w * 2, h, w], [x, top + h / 2, z - s / 2 - w / 2]),
      buildBlock([s + w * 2, h, w], [x, top + h / 2, z + s / 2 + w / 2]),
      buildBlock([w, h, s], [x - s / 2 - w / 2, top + h / 2, z]),
      buildBlock([w, h, s], [x + s / 2 + w / 2, top + h / 2, z]),
      withTone(buildBlock([s, 0.012, s], [x, top + 0.006, z]), -0.62),
      buildBlock([PX * 2, 0.02, PX], [x - s / 4, top + 0.022, z - s / 2 + PX * 0.5]),
      buildBlock([PX * 2, 0.02, PX], [x + s / 4, top + 0.022, z - s / 2 + PX * 0.5]),
    ];
    const handle = ring({ radius: 0.05, height: 0.012, thickness: PX * 0.7, segments: 8, y: top + 0.012 });
    handle.translate(x, 0, z + s / 2 - 0.12);
    bronzeParts.push(handle);
    const bronze = new THREE.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 22, tone: true }));
    bronze.name = "trapdoor";
    bronze.castShadow = true;
    bronze.receiveShadow = true;
    group.add(bronze);
  }

  group.userData.asset = { id: meta.id, params: p };
  return group;
}
