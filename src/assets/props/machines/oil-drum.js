// Fût d'huile et d'électrolyte de l'Atelier du Complexe (fiche ATE-13, docs/complexe/PIECES.md) : Ø 0,50 × 0,80 m.
// Tôle à 16 pans, bosselée par endroits ; trois cercles de cuivre d'un pixel (le jable du haut et deux cercles de
// roulement), couvercle à bonde et évent, plaque de laiton rivetée gravée d'un glyphe.
// - Huile : tôle gris-bleu, coulures noires qui partent de la bonde et descendent le flanc.
// - Électrolyte : tôle vert-de-gris, croûtes pâles qui coulent, bandeau d'avertissement rouge.
// Debout ; couché sur deux cales de bois, robinet de laiton et bac d'égouttage ; ou trois fûts sur une palette.
// La graine change les bosses, les coulures, le ton de la tôle, le tour du fût (où sont la bonde et la plaque).
//
// 3 draw calls : tôle (et ses coulures, le bandeau), cuivre et laiton, bois (cales, palette).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock } from "../../kit/geometry.js";
import { METALS, WOODS } from "../../kit/palettes.js";
import { mergeToned, metalMaterial, plain, ring, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const CONTENTS = { oil: "Huile (coulures noires)", electrolyte: "Électrolyte (vert-de-gris, bandeau rouge)" };
const POSES = { standing: "Debout", lying: "Couché sur cales, robinet et bac", pallet: "Trois fûts sur une palette" };
// Tôle : gris-bleu (huile) ; vert-de-gris (électrolyte), dont la première couleur est le rouge du bandeau, atteint
// seulement par un ton très bas (le premier seuil est presque à zéro : l'ombre ordinaire ne le touche pas).
const SKINS = {
  oil: { ramp: ["#1c1d26", "#2f323d", "#4a4e5a", "#727782"], ink: "#101118", steps: [0.3, 0.52, 0.76] },
  electrolyte: { ramp: ["#8e2219", "#17251f", "#2a463e", "#466c60", "#8fb3a0"], ink: "#0c1411", steps: [0.03, 0.3, 0.52, 0.8] },
};

const params = {
  seed: seedParam("Change les bosses, les coulures, le ton de la tôle et le tour du fût (place de la bonde et de la plaque)."),
  content: choiceParam("Contenu", CONTENTS, "Huile (tôle grise, coulures noires) ou électrolyte (tôle vert-de-gris, croûtes pâles, bandeau rouge)."),
  pose: choiceParam("Pose", POSES, "Un fût debout, un fût couché sur cales avec robinet et bac d'égouttage, ou trois fûts sur une palette."),
};

export const meta = {
  id: "props/machines/oil-drum",
  name: "Fût d'huile",
  nameEn: "Oil drum",
  category: "props",
  subcategory: "machines",
  description:
    "Fût de l'Atelier du Complexe : tôle bosselée à trois cercles de cuivre, bonde et évent, plaque de laiton gravée ; " +
    "huile à coulures noires ou électrolyte vert-de-gris à bandeau rouge. Debout, couché sur cales avec robinet et " +
    "bac, ou trois fûts sur une palette. Fiche ATE-13.",
  tags: [
    "fût", "tonneau", "baril", "huile", "électrolyte", "cercles de cuivre", "bonde", "évent", "plaque de laiton",
    "coulures", "bosses", "robinet", "bac d'égouttage", "cales", "palette", "avertissement", "atelier", "le complexe",
    "complexe", "ancien-tech", "intérieur",
    "drum", "barrel", "oil", "electrolyte", "copper hoops", "bung", "vent", "brass plate", "drips", "dents", "tap",
    "drip tray", "chocks", "pallet", "warning band", "workshop", "ancient complex", "ancient-tech", "indoor",
    "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre du fût (ou de la palette) ; couché, l'axe suit x et le robinet regarde +x",
  footprint: { radius: 0.8, height: 0.96 },
  animated: [],
  params,
  variants: [
    { id: "oil", name: "Huile, debout", params: {} },
    { id: "electrolyte", name: "Électrolyte, debout", params: { content: "electrolyte" } },
    { id: "lying", name: "Couché sur cales", params: { pose: "lying" } },
    { id: "pallet", name: "Trois fûts sur palette", params: { pose: "pallet", content: "electrolyte" } },
  ],
};

const RADIUS = 0.25, HEIGHT = 0.8, BAND = 1 / 16;
const lit = (t = 0) => (x, y, z, nx, ny) => t + (ny > 0.5 ? 0.14 : ny < -0.5 ? -0.3 : 0);

/**
 * Un fût debout, origine au centre du fond, dans les listes `skin`, `copper` (cuivre et laiton) ; `rng` propre au fût.
 * La bonde et la plaque sont tournées vers +z avant le tour de la graine (`spin`).
 */
function drum(rng, content, skin, copper, { spin = 0, tap = false } = {}) {
  const parts = { skin: [], copper: [] };
  // Tôle : 16 pans, 8 rangs, quelques bosses (sommets rentrés autour d'un point).
  const body = plain(new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 16, 8, true));
  body.translate(0, HEIGHT / 2, 0);
  const dents = Array.from({ length: rng.int(0, 3) }, () => ({ a: rng.range(0, Math.PI * 2), y: rng.range(0.15, 0.65), depth: rng.range(0.012, 0.03) }));
  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(x, z);
    let push = 0;
    for (const d of dents) {
      const da = Math.atan2(Math.sin(a - d.a), Math.cos(a - d.a));
      push += d.depth * Math.exp(-(da * da) / 0.12 - ((y - d.y) ** 2) / 0.012);
    }
    const s = (RADIUS - push) / RADIUS;
    pos.setXYZ(i, x * s, y, z * s);
  }
  body.computeVertexNormals();
  const t0 = rng.range(-0.07, 0.07);
  parts.skin.push(withTone(body, (x, y) => t0 + 0.06 + (y > HEIGHT - 0.12 ? -0.06 : 0)));
  parts.skin.push(withTone(plain(new THREE.CylinderGeometry(RADIUS - 0.012, RADIUS - 0.012, 0.012, 16)).translate(0, HEIGHT - 0.03, 0), t0 + 0.12)); // couvercle en retrait
  parts.skin.push(withTone(plain(new THREE.CylinderGeometry(RADIUS, RADIUS, 0.01, 16)).translate(0, 0.005, 0), -0.3));
  // Trois cercles de cuivre : le jable en haut, deux cercles de roulement.
  for (const [y, h] of [[HEIGHT - BAND / 2, BAND], [HEIGHT * 0.33, BAND * 0.8], [HEIGHT * 0.67, BAND * 0.8]]) {
    parts.copper.push(withTone(ring({ radius: RADIUS - 0.004, thickness: 0.016, height: h, y: y - h / 2, segments: 16 }), (x, yy, z, nx, ny) => (ny > 0.5 ? 0.15 : ny < -0.5 ? -0.3 : -0.05)));
  }
  parts.copper.push(withTone(ring({ radius: RADIUS - 0.004, thickness: 0.012, height: 0.03, y: 0, segments: 16 }), -0.25));
  // Bonde et évent sur le couvercle, vers l'avant.
  const lid = HEIGHT - 0.024;
  parts.copper.push(withTone(plain(new THREE.CylinderGeometry(0.038, 0.04, 0.03, 8)).translate(0, lid + 0.015, 0.14), lit(0.15)));
  parts.copper.push(withTone(buildBlock([0.02, 0.012, 0.05], [0, lid + 0.034, 0.14]), lit(0.0)));
  parts.copper.push(withTone(plain(new THREE.CylinderGeometry(0.02, 0.02, 0.022, 6)).translate(-0.06, lid + 0.011, -0.14), lit(0.1)));
  // Plaque de laiton rivetée, gravée d'un glyphe (cuivre au plus clair).
  const plateY = HEIGHT * 0.5;
  parts.copper.push(withTone(buildBlock([0.17, 0.11, 0.008], [0, plateY, RADIUS + 0.004]), 0.4));
  for (const [x, y] of [[-0.07, 0.04], [0.07, 0.04], [-0.07, -0.04], [0.07, -0.04]]) parts.copper.push(withTone(buildBlock([0.012, 0.012, 0.006], [x, plateY + y, RADIUS + 0.011]), -0.4));
  for (let k = 0; k < 3; k++) {
    const vertical = rng.chance(0.5);
    parts.copper.push(withTone(buildBlock(vertical ? [0.014, rng.range(0.03, 0.06), 0.004] : [rng.range(0.03, 0.08), 0.014, 0.004], [rng.range(-0.04, 0.04), plateY + rng.range(-0.02, 0.02), RADIUS + 0.01]), -0.9));
  }
  // Coulures : de la bonde, par-dessus le jable, le long du flanc avant. Huile : noires ; électrolyte : croûtes pâles.
  const streakTone = content === "oil" ? -0.95 : 0.95;
  const streaks = rng.int(2, 5);
  for (let k = 0; k < streaks; k++) {
    const a = rng.range(-0.55, 0.55);
    const len = rng.range(0.12, content === "oil" ? 0.45 : 0.3);
    const w = rng.range(0.02, 0.035);
    const g = buildBlock([w, len, 0.004], [0, HEIGHT - 0.07 - len / 2, RADIUS + 0.003]);
    g.rotateY(a);
    parts.skin.push(withTone(g, streakTone));
    const top = buildBlock([w, 0.004, 0.06], [0, lid + 0.002, RADIUS - 0.04]);
    top.rotateY(a);
    parts.skin.push(withTone(top, streakTone));
  }
  // Électrolyte : bandeau rouge entre les deux cercles de roulement, coupé par la plaque.
  if (content === "electrolyte") {
    const band = plain(new THREE.CylinderGeometry(RADIUS + 0.004, RADIUS + 0.004, 0.07, 16, 1, true, 0.55, Math.PI * 2 - 1.1));
    band.translate(0, HEIGHT * 0.5 + 0.0, 0);
    parts.skin.push(withTone(band, -3));
  }
  // Robinet (fût couché) : sur le couvercle, au bord +x (le bas une fois le fût couché), bec vers +x.
  if (tap) {
    parts.copper.push(withTone(plain(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6)).translate(0.17, HEIGHT + 0.025, 0), lit(0.2)));
    parts.copper.push(withTone(buildBlock([0.07, 0.03, 0.03], [0.2, HEIGHT + 0.06, 0]), lit(0.2)));
    parts.copper.push(withTone(buildBlock([0.014, 0.014, 0.09], [0.17, HEIGHT + 0.075, 0]), lit(0.35)));
  }
  const m = new THREE.Matrix4().makeRotationY(spin);
  for (const g of parts.skin) skin.push(g.applyMatrix4(m));
  for (const g of parts.copper) copper.push(g.applyMatrix4(m));
}

/**
 * Crée le fût (ou les fûts).
 * @param {{seed?: number, content?: string, pose?: string}} [given]
 * @returns {THREE.Group} `userData.drums` : [{ center, axis }] ; `userData.tap` (bec du robinet, fût couché)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 3313 + 97);
  const skin = [], copper = [], wood = [];
  const drums = [];
  const group = new THREE.Group();
  group.name = meta.name;

  const place = (list, m) => list.map((g) => g.applyMatrix4(m));
  if (p.pose === "lying") {
    // Couché : l'axe suit x, le couvercle et son robinet (en bas, bec vers le sol) à +x ; deux cales sous le fût.
    const s = [], c = [];
    drum(rng, p.content, s, c, { tap: true });
    const m = new THREE.Matrix4().makeTranslation(-HEIGHT / 2, RADIUS + 0.06, 0)
      .multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2))
      .multiply(new THREE.Matrix4().makeRotationY(rng.range(-0.15, 0.15)));
    skin.push(...place(s, m));
    copper.push(...place(c, m));
    for (const x of [-0.24, 0.24]) {
      for (const sz of [-1, 1]) wood.push(withTone(buildBlock([0.12, 0.1, 0.12], [x, 0.05, sz * 0.17], [0, 0, 0]), lit(rng.range(-0.08, 0.08))));
      wood.push(withTone(buildBlock([0.1, 0.03, 0.44], [x, 0.015, 0]), lit(-0.1)));
    }
    // Bac d'égouttage sous le robinet, et sa flaque.
    const tapX = HEIGHT / 2 + 0.08;
    copper.push(withTone(buildBlock([0.3, 0.05, 0.36], [tapX + 0.02, 0.025, 0]), (x, y, z, nx, ny) => (ny > 0.5 ? -0.6 : -0.2)));
    for (const [w, d, dx, dz] of [[0.3, 0.012, 0, 0.174], [0.3, 0.012, 0, -0.174], [0.012, 0.36, 0.144, 0], [0.012, 0.36, -0.144, 0]]) {
      copper.push(withTone(buildBlock([w, 0.07, d], [tapX + 0.02 + dx, 0.035, dz]), lit(-0.05)));
    }
    skin.push(withTone(buildBlock([0.2, 0.004, 0.24], [tapX + 0.02, 0.052, 0]), p.content === "oil" ? -0.95 : -0.55));
    drums.push({ center: new THREE.Vector3(0, RADIUS + 0.06, 0), axis: new THREE.Vector3(1, 0, 0) });
    group.userData.tap = new THREE.Vector3(tapX, RADIUS + 0.06 - 0.2, 0);
  } else if (p.pose === "pallet") {
    // Palette de 1,2 × 1,0 m : trois semelles, planches du dessus à tons alternés ; trois fûts en triangle.
    for (const z of [-0.42, 0, 0.42]) wood.push(withTone(buildBlock([1.2, 0.09, 0.1], [0, 0.045, z]), lit(-0.15)));
    for (let i = 0; i < 7; i++) wood.push(withTone(buildBlock([0.14, 0.025, 1.0], [-0.54 + i * 0.18, 0.1025, 0]), lit((i % 2 ? 0.08 : -0.06) + rng.range(-0.05, 0.05))));
    const top = 0.115;
    const spots = [[-0.29, -0.2], [0.29, -0.2], [rng.range(-0.1, 0.1), 0.25]];
    for (const [x, z] of spots) {
      const s = [], c = [];
      drum(rng, p.content, s, c, { spin: rng.range(-0.7, 0.7) });
      const m = new THREE.Matrix4().makeTranslation(x, top, z);
      skin.push(...place(s, m));
      copper.push(...place(c, m));
      drums.push({ center: new THREE.Vector3(x, top, z), axis: new THREE.Vector3(0, 1, 0) });
    }
  } else {
    drum(rng, p.content, skin, copper, { spin: rng.range(-0.6, 0.6) });
    drums.push({ center: new THREE.Vector3(), axis: new THREE.Vector3(0, 1, 0) });
  }

  const look = SKINS[p.content];
  const meshes = [
    ["skin", skin, createToonMaterial({ ramp: look.ramp, ink: look.ink, steps: look.steps, tone: true, crease: true, id: 30 })],
    ["copper", copper, metalMaterial(METALS.copper, { id: 31, tone: true, steps: [0.28, 0.46, 0.68, 0.92] })],
    ["wood", wood, createToonMaterial({ ramp: WOODS.oak.ramp, ink: WOODS.oak.ink, steps: [0.26, 0.48, 0.74], tone: true, crease: true, id: 20 })],
  ];
  for (const [name, list, material] of meshes) {
    if (list.length === 0) {
      material.dispose();
      continue;
    }
    const mesh = new THREE.Mesh(mergeToned(list), material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.drums = drums;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
