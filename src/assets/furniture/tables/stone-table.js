// Table de pierre du Complexe (fiches ARC-05, ETU-10, E2-04, E5-05 et la table de E6-06, docs/complexe/) : un plateau
// épais de pierre fumée (ou de bois noirci) posé sur deux pieds de bronze en patte, une traverse basse, un tiroir au
// milieu, et sur la tranche avant un trait de glyphes qui luit (1 px). Un modèle par salle :
// - lecture (Archives) : 2,4 × 1,0 × 0,85 m ;
// - observation (salle d'étude) : 1,6 × 0,8 × 0,9 m, tapis de feutre et rebord de bronze ;
// - transcription (salle 2) : 1,4 × 0,7 × 0,85 m, plateau de bois noirci, carnets, plume et encrier ;
// - dissection (salle 5) : 2,0 × 0,8 × 0,9 m, plateau à rigoles et tapis de feutre ;
// - support (salle 6) : 1,2 × 0,6 × 0,9 m, nue (elle porte les cuves à échantillons).
// La graine change le nombre de dalles du plateau, l'angle écorné, l'usure, le code des glyphes, les carnets.
// `group.userData.surface` : hauteur et taille du plateau, pour y poser des objets (cassettes, loupe, lampe...).
//
// 3 draw calls : plateau (pierre ou bois, feutre en ton sombre), bronze (pieds, tiroir, rebord, petits objets),
// lueur (glyphes).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads } from "../../kit/geometry.js";
import { METALS, STONES, WOODS } from "../../kit/palettes.js";
import {
  PX, beam, glowMaterial, glyphStrip, gridBlock, mergeToned, metalMaterial, plain, stoneMaterial, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, glowParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = {
  reading: "Lecture (Archives)",
  observation: "Observation (salle d'étude)",
  transcription: "Transcription (salle 2)",
  dissection: "Dissection (salle 5)",
  support: "Support (salle 6)",
};
// largeur, profondeur, hauteur du dessus
const SIZES = {
  reading: [2.4, 1.0, 0.85],
  observation: [1.6, 0.8, 0.9],
  transcription: [1.4, 0.7, 0.85],
  dissection: [2.0, 0.8, 0.9],
  support: [1.2, 0.6, 0.9],
};
const TOP = 0.08; // épaisseur du plateau

const params = {
  seed: seedParam("Change les dalles du plateau, l'angle écorné, l'usure, le code des glyphes, la place des carnets et de l'encrier."),
  kind: choiceParam("Modèle", KINDS, "Lecture (Archives), observation (feutre et rebord), transcription (bois, carnets, encrier), dissection (rigoles, feutre), support (nue)."),
  glow: glowParam("Couleur du trait de glyphes de la tranche.", { only: ["amber", "cyan"] }),
};

export const meta = {
  id: "furniture/tables/stone-table",
  name: "Table de pierre",
  nameEn: "Stone table",
  category: "furniture",
  subcategory: "tables",
  description:
    "Table du Complexe : plateau épais de pierre fumée sur deux pieds de bronze en patte, tiroir au milieu, trait " +
    "de glyphes lumineux sur la tranche. Table de lecture des Archives, table d'observation (feutre, rebord), de " +
    "transcription (bois noirci, carnets, plume, encrier), de dissection (rigoles, feutre) ou simple support. " +
    "Fiches ARC-05, ETU-10, E2-04, E5-05, E6-06.",
  tags: [
    "table", "table de lecture", "établi", "plateau", "pierre fumée", "bronze", "pattes", "tiroir", "glyphes",
    "feutre", "carnets", "encrier", "le complexe", "complexe", "ancien-tech", "mobilier", "intérieur",
    "reading table", "desk", "stone top", "smoked stone", "bronze legs", "paw feet", "drawer", "glyphs", "felt mat",
    "notebooks", "inkwell", "ancient complex", "ancient-tech", "furniture", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; origine au sol, au centre de la table (le tiroir et la tranche à glyphes regardent +z)",
  footprint: { radius: 1.3, height: 0.95 },
  animated: [],
  params,
  variants: variantsOf("kind", params.kind),
};

/**
 * Crée la table.
 * @param {{seed?: number, kind?: string, glow?: string}} [given]
 * @returns {THREE.Group} `group.userData.surface` : { y, size: [largeur, profondeur] } (dessus du plateau)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 131);
  const [W, D, H] = SIZES[p.kind];
  const wooden = p.kind === "transcription";
  const top = [], bronze = [], glow = [];
  const y0 = H - TOP;

  // --- Plateau : quadrillé (usure, feutre), en 1 à 3 dalles séparées d'un joint ; un angle écorné.
  const slabs = wooden ? 1 : rng.int(1, p.kind === "reading" ? 3 : 2);
  const joints = Array.from({ length: slabs - 1 }, (_, i) => -W / 2 + ((i + 1) * W) / slabs + rng.range(-0.08, 0.08));
  const chip = { x: rng.chance(0.5) ? 1 : -1, z: rng.chance(0.6) ? 1 : -1, size: rng.range(0.05, 0.1) };
  const wear = { x: rng.range(-0.25, 0.25) * W, z: D * 0.18 };
  const mat = { observation: [0.82, 0.7], dissection: [0.45, 0.72] }[p.kind]; // tapis de feutre : part de W et D
  const matX = p.kind === "dissection" ? (rng.chance(0.5) ? 1 : -1) * W * 0.22 : 0;
  const slab = gridBlock([W, TOP, D], [0, y0 + TOP / 2, 0], { cell: 0.08 });
  const pos = slab.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    // Angle écorné : les sommets du dessus dans le coin descendent et rentrent.
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (x * chip.x > W / 2 - chip.size && z * chip.z > D / 2 - chip.size && y > y0 + TOP / 2) pos.setY(i, y - 0.035);
  }
  slab.computeVertexNormals();
  const slabTone = Array.from({ length: slabs }, () => rng.range(-0.06, 0.06));
  withTone(slab, (x, y, z, nx, ny) => {
    let t = slabTone[joints.filter((j) => x > j).length];
    if (joints.some((j) => Math.abs(x - j) < 0.03)) t -= 0.45; // joint entre deux dalles
    if (ny > 0.5) {
      t -= 0.12; // dessus un cran plus bas, que l'usure remonte
      const d = Math.hypot((x - wear.x) / (W * 0.35), (z - wear.z) / (D * 0.4));
      if (!wooden && d < 1) t += 0.1 * (1 - d);
      if (mat && Math.abs(x - matX) < (W * mat[0]) / 2 && Math.abs(z) < (D * mat[1]) / 2) t = -0.75; // feutre
    }
    if (x * chip.x > W / 2 - chip.size - 0.02 && z * chip.z > D / 2 - chip.size - 0.02) t -= 0.25;
    return t;
  });
  top.push(slab);
  // Joints : un trait sombre d'un pixel sur le dessus (la grille n'a pas de sommet pile dessus).
  if (joints.length) {
    top.push(buildQuads(joints.map((j) => ({ position: [j, H + 0.001, 0], size: [PX * 0.5, D - 0.01], normal: [0, 1, 0], tone: -0.6 }))));
  }
  // Rigoles de la table de dissection : 4 traits sombres dans la longueur, sur la partie sans feutre.
  if (p.kind === "dissection") {
    const x0 = matX > 0 ? -W / 2 + 0.08 : -W / 2 + W * 0.5, x1 = matX > 0 ? W * 0.0 - 0.02 : W / 2 - 0.08;
    const lines = [];
    for (let k = 0; k < 4; k++) lines.push({ position: [(x0 + x1) / 2, H + 0.0015, -D * 0.3 + k * D * 0.2], size: [x1 - x0, PX * 0.5], normal: [0, 1, 0], tone: -0.7 });
    lines.push({ position: [x0 + 0.03, H + 0.0015, 0], size: [PX * 0.6, D * 0.65], normal: [0, 1, 0], tone: -0.7 }); // collecteur
    top.push(buildQuads(lines));
  }

  // --- Pieds de bronze en patte : un fût effilé, une semelle dans la profondeur terminée par deux pattes à trois
  // griffes, une console sous le plateau. Une traverse basse les relie.
  const legX = W / 2 - Math.min(0.28, W * 0.14);
  const footD = D * 0.82;
  for (const s of [-1, 1]) {
    const x = s * legX;
    bronze.push(withTone(buildBlock([0.11, y0 - 0.16, 0.15], [x, 0.08 + (y0 - 0.16) / 2 + 0.02, 0], [0, 0, 0], { taper: 0.3 }), -0.02));
    bronze.push(withTone(buildBlock([0.12, 0.09, footD], [x, 0.065, 0]), (px, py, pz, nx, ny) => (ny > 0.5 ? 0.12 : -0.05)));
    for (const e of [-1, 1]) {
      const zEnd = e * footD / 2;
      bronze.push(withTone(buildBlock([0.15, 0.08, 0.08], [x, 0.05, zEnd + e * 0.02]), 0.05)); // cheville
      for (const t of [-1, 0, 1]) {
        bronze.push(withTone(buildBlock([0.035, 0.045, 0.07], [x + t * 0.05, 0.0225, zEnd + e * 0.08], [0, t * e * 0.25, 0]), t ? -0.1 : 0.2)); // griffes
      }
    }
    bronze.push(withTone(buildBlock([0.14, 0.07, D * 0.72], [x, y0 - 0.035, 0]), -0.15)); // console sous le plateau
    bronze.push(withTone(buildBlock([0.14, 0.05, 0.05], [x, y0 - 0.1, 0]), 0.1)); // bague du fût
  }
  bronze.push(withTone(beam([-legX, 0.24, 0], [legX, 0.24, 0], 0.05, 0.06), (x, y, z, nx, ny) => (ny > 0.5 ? 0.1 : -0.12)));

  // --- Tiroir central (pas sur la table support, trop petite), poignée claire d'un pixel.
  if (p.kind !== "support") {
    const dw = Math.min(0.55, W * 0.3);
    bronze.push(withTone(buildBlock([dw, 0.1, D * 0.62], [0, y0 - 0.05, D * 0.12]), -0.3));
    bronze.push(withTone(buildBlock([dw - 0.02, 0.08, 0.015], [0, y0 - 0.05, D * 0.43 + 0.008]), 0.08));
    bronze.push(withTone(buildBlock([PX * 1.6, PX * 0.6, 0.02], [0, y0 - 0.055, D * 0.43 + 0.02]), 0.5));
  }

  // --- Rebord de bronze (table d'observation) : une baguette d'un pixel autour du plateau.
  if (p.kind === "observation") {
    const b = PX * 0.6, h = 0.03;
    bronze.push(withTone(buildBlock([W + 0.01, h, b], [0, H + h / 2, D / 2 - b / 2]), 0.15));
    bronze.push(withTone(buildBlock([W + 0.01, h, b], [0, H + h / 2, -D / 2 + b / 2]), 0.05));
    for (const s of [-1, 1]) bronze.push(withTone(buildBlock([b, h, D - 2 * b], [s * (W / 2 - b / 2), H + h / 2, 0]), 0.1));
  }

  // --- Table de transcription : carnets (couverture sombre, tranche des pages claire), un carnet ouvert, encrier,
  // plume. En bronze, du plus sombre (cuir) au plus clair (papier jauni).
  if (wooden) {
    const piles = rng.int(1, 2);
    for (let k = 0; k < piles; k++) {
      const px = -W * 0.32 + k * 0.24 + rng.range(-0.04, 0.04), pz = -D * 0.18 + rng.range(-0.05, 0.05);
      const spin = rng.range(-0.3, 0.3);
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const y = H + 0.016 + i * 0.032;
        const r = spin + rng.range(-0.12, 0.12);
        bronze.push(withTone(buildBlock([0.17, 0.032, 0.23], [px, y, pz], [0, r, 0]), -0.62 + (i % 2) * 0.08));
        bronze.push(withTone(buildBlock([0.155, 0.022, 0.235], [px + 0.008, y, pz], [0, r, 0]), 0.42)); // pages
      }
    }
    // Carnet ouvert devant : deux pages claires en léger V, couverture sombre dessous.
    const ox = rng.range(-0.05, 0.12), oz = D * 0.16;
    bronze.push(withTone(buildBlock([0.36, 0.012, 0.24], [ox, H + 0.006, oz], [0, rng.range(-0.15, 0.15), 0]), -0.62));
    for (const s of [-1, 1]) bronze.push(withTone(buildBlock([0.165, 0.012, 0.22], [ox + s * 0.085, H + 0.018, oz], [0, 0, -s * 0.08]), 0.48));
    // Écriture : quelques lignes d'un pixel sur les pages (tons sombres).
    const lines = [];
    for (const s of [-1, 1]) for (let l = 0; l < 3; l++) lines.push({ position: [ox + s * 0.085, H + 0.0262 + s * 0, oz - 0.06 + l * 0.05], size: [0.11, PX * 0.35], normal: [0, 1, 0], tone: -0.55 });
    bronze.push(buildQuads(lines));
    // Encrier (verre sombre, bouchon de laiton) et plume claire posée en travers.
    const ix = W * 0.3 + rng.range(-0.05, 0.05), iz = -D * 0.12;
    const well = plain(new THREE.CylinderGeometry(0.035, 0.045, 0.06, 6));
    well.translate(ix, H + 0.03, iz);
    bronze.push(withTone(well, -0.7));
    const cap = plain(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 6));
    cap.translate(ix, H + 0.07, iz);
    bronze.push(withTone(cap, 0.3));
    bronze.push(withTone(beam([ix - 0.02, H + 0.075, iz + 0.01], [ix - 0.2, H + 0.012, iz + 0.12], PX * 0.5, PX * 0.35), 0.55));
  }

  // --- Trait de glyphes lumineux sur la tranche avant du plateau (1 px), un peu en saillie.
  const strip = glyphStrip(rng, { length: W - 0.16, rows: 1, depth: 0.006 });
  strip.translate(0, y0 + TOP / 2 - PX / 2, D / 2);
  glow.push(strip);

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const topMaterial = wooden
    ? createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, pattern: "speckle", patternParams: [16, 0.05, 0.12, 1], seed: p.seed % 97, id: 20 })
    : stoneMaterial(STONES.smoked, { seed: p.seed % 97, id: 20 });
  const topMesh = new THREE.Mesh(mergeToned(top), topMaterial);
  topMesh.name = "top";
  const bronzeMesh = new THREE.Mesh(mergeToned(bronze), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronzeMesh.name = "bronze";
  for (const mesh of [topMesh, bronzeMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const glyphs = new THREE.Mesh(mergeToned(glow), glowMaterial(p.glow, { level: 2, id: 40 }));
  glyphs.name = "glyphs";
  group.add(glyphs);

  group.userData.surface = { y: H, size: [W, D] };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
