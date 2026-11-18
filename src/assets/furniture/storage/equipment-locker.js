// Casier d'équipement du Complexe (fiches SAS-07 et COE-10, docs/complexe/) : un caisson de bronze posé contre le mur,
// des portes grillagées en laiton (quadrillage d'un pixel) derrière lesquelles on devine le matériel, et sur chaque
// porte un cadran de 2 px et une molette d'un pixel.
// - casier (Sas) : 1,8 × 0,4 × 2,2 m, 6 compartiments de 0,55 × 0,9 m sur deux rangées ;
// - armoire à fusibles (salle du Cœur) : 0,8 × 0,3 × 1,8 m, une porte grillagée sur 24 fusibles de porcelaine,
//   un levier de coupure sur le flanc.
// Portes fermées par défaut ; la scène les ouvre avec `group.userData.locker.setOpen(i, t)` (0 fermée, 1 ouverte).
// La graine change le matériel rangé (et les cases vides), le cadran, la patine, les fusibles grillés.
//
// 3 draw calls : bronze (caisson, levier), laiton (portes, qui pivotent sur le CPU), contenu (cuir ou porcelaine).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock } from "../../kit/geometry.js";
import { METALS } from "../../kit/palettes.js";
import { PX, dial, lever, mergeToned, metalMaterial, orient, plain, rivetRow, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = { locker: "Casier (6 compartiments)", "fuse-box": "Armoire à fusibles (24 fusibles)" };
const DOORS = { closed: "Fermées", ajar: "Une entrouverte", open: "Toutes ouvertes" };
const SWITCHES = { on: "Sous tension", off: "Coupée" };
const SIZES = { locker: [1.8, 2.2, 0.4], "fuse-box": [0.8, 1.8, 0.3] }; // largeur, hauteur, profondeur
// Toile huilée des tenues de travail (plus claire que le cuir goudronné : on la devine derrière la grille).
const OILCLOTH = { ramp: ["#2a2117", "#4f3f2a", "#77623f", "#a08756"], ink: "#140f0a" };
const PORCELAIN = { ramp: ["#4f4a44", "#8a8274", "#c4baa6", "#ebe2cf"], ink: "#24201b" };

const params = {
  seed: seedParam("Change le matériel rangé et les cases vides, les aiguilles, la patine, la porte entrouverte, les fusibles grillés."),
  model: choiceParam("Modèle", MODELS, "Casier d'équipement du Sas, ou armoire à fusibles de la salle du Cœur."),
  doors: choiceParam("Portes", DOORS, "Fermées (par défaut), une entrouverte choisie par la graine, ou toutes ouvertes. Pilotable : group.userData.locker."),
  power: choiceParam("Levier de coupure", SWITCHES, "Armoire à fusibles : levier levé (sous tension) ou abaissé (coupée)."),
};

export const meta = {
  id: "furniture/storage/equipment-locker",
  name: "Casier d'équipement",
  nameEn: "Equipment locker",
  category: "furniture",
  subcategory: "storage",
  description:
    "Casier mural du Complexe : caisson de bronze à portes grillagées de laiton, cadran et molette sur chaque porte, " +
    "matériel deviné derrière la grille. Casier du Sas (6 compartiments) ou armoire à fusibles du Cœur (24 fusibles " +
    "de porcelaine, levier de coupure). Portes fermées par défaut, ouvertes une à une par le scénario. Fiches SAS-07, COE-10.",
  tags: [
    "casier", "armoire", "vestiaire", "fusibles", "grillage", "laiton", "bronze", "cadran", "levier", "porcelaine",
    "le complexe", "complexe", "ancien-tech", "rangement", "pilotable", "intérieur",
    "locker", "cabinet", "fuse box", "mesh door", "brass", "gauge", "switch lever", "porcelain fuses",
    "ancient complex", "ancient-tech", "storage", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; origine au sol, au milieu du dos (le mur est en z = 0, les portes regardent +z)",
  footprint: { radius: 1.45, height: 2.2 },
  animated: ["locker"],
  params,
  variants: variantsOf("model", params.model),
};

/**
 * Crée le casier.
 * @param {{seed?: number, model?: string, doors?: string, power?: string}} [given]
 * @returns {THREE.Group} `group.userData.locker` : { count, open: number[], setOpen(i, t), setAll(t) }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const fuse = p.model === "fuse-box";
  const rng = createRng(p.seed * 7919 + 43);
  const [W, H, D] = SIZES[p.model];
  const bronzeParts = [];
  const contentParts = [];
  const t = 0.04; // épaisseur des parois
  const plinth = fuse ? 0.25 : 0.12; // socle (l'armoire à fusibles est plus haut, à portée de main)

  // --- Caisson : dos, flancs, dessus, socle en retrait, corniche.
  const box = (size, pos, tone = 0) => bronzeParts.push(withTone(buildBlock(size, pos), tone));
  box([W, H - plinth, t], [0, plinth + (H - plinth) / 2, t / 2], -0.55); // dos (vu au fond des cases : sombre)
  for (const s of [-1, 1]) box([t, H - plinth, D], [s * (W / 2 - t / 2), plinth + (H - plinth) / 2, D / 2], rng.range(-0.05, 0.05));
  box([W + 0.06, 0.06, D + 0.04], [0, H - 0.03, D / 2 + 0.01], 0.1); // corniche
  box([W - 0.08, plinth, D - 0.06], [0, plinth / 2, D / 2 - 0.02], -0.35); // socle
  box([W, t, D], [0, plinth + t / 2, D / 2]);
  bronzeParts.push(withTone(rivetRow([-W / 2 + 0.06, H - 0.03, D + 0.03], [W / 2 - 0.06, H - 0.03, D + 0.03], { spacing: 0.2, size: PX * 0.8 }), 0.25));

  // Cases : 3 × 2 pour le casier, une seule grande pour l'armoire.
  const cols = fuse ? 1 : 3;
  const rows = fuse ? 1 : 2;
  const innerW = W - 2 * t, innerH = H - plinth - 2 * t - 0.06;
  const cellW = innerW / cols, cellH = innerH / rows;
  const y0 = plinth + t;
  for (let c = 1; c < cols; c++) box([PX, innerH, D - 0.02], [-innerW / 2 + c * cellW, y0 + innerH / 2, D / 2], -0.1);
  for (let r = 1; r < rows; r++) box([innerW, PX * 1.2, D - 0.02], [0, y0 + r * cellH, D / 2], -0.1);
  box([innerW, 0.06, D], [0, H - 0.09, D / 2], 0.05); // traverse haute

  // --- Contenu, deviné derrière la grille.
  const zIn = t + 0.02;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push({ x: -innerW / 2 + (c + 0.5) * cellW, y: y0 + r * cellH, w: cellW, h: cellH });
  if (!fuse) {
    // Chaque case : vide, une combinaison pendue (pèlerine de cuir), des bottes et une lampe, ou des rouleaux de câble.
    for (const cell of cells) {
      const kind = rng.pick(["empty", "coat", "coat", "boots", "coils"]);
      const { x, y, w, h } = cell;
      if (kind === "coat") {
        contentParts.push(withTone(buildBlock([PX * 2, PX, PX], [x, y + h - 0.12, zIn + 0.1]), 0.3)); // patère
        contentParts.push(withTone(buildBlock([w * 0.55, h * 0.62, 0.1], [x + rng.range(-0.04, 0.04), y + h - 0.16 - h * 0.31, zIn + 0.12], [0, 0, 0], { taper: -0.2 }), rng.range(-0.05, 0.15)));
        contentParts.push(withTone(buildBlock([w * 0.6, PX * 0.6, 0.11], [x, y + h - 0.16 - h * 0.25, zIn + 0.12]), -0.4)); // ceinture
      } else if (kind === "boots") {
        for (const s of [-1, 1]) contentParts.push(withTone(buildBlock([0.1, 0.24, 0.16], [x + s * 0.08, y + 0.12, zIn + 0.12]), s > 0 ? 0.1 : -0.1));
        contentParts.push(withTone(orient(plain(new THREE.CylinderGeometry(0.05, 0.06, 0.16, 6)), [x, y + h * 0.55, zIn + 0.12], [0, 1, 0]), 0.4));
      } else if (kind === "coils") {
        const n = rng.int(2, 3);
        for (let i = 0; i < n; i++) {
          const g = plain(new THREE.TorusGeometry(0.1, 0.035, 4, 8));
          contentParts.push(withTone(orient(g, [x + (i - (n - 1) / 2) * 0.12, y + 0.1 + i * 0.05, zIn + 0.14], [0, 0, 1]), i % 2 ? -0.1 : 0.15));
        }
      }
    }
  } else {
    // 24 fusibles de porcelaine (4 × 6) sur leurs barrettes ; un sur huit environ grillé (noirci).
    const fx = 4, fy = 6;
    for (let j = 0; j < fy; j++) {
      const y = y0 + 0.18 + j * ((innerH - 0.36) / (fy - 1));
      box([innerW - 0.12, PX * 0.8, PX], [0, y, zIn + 0.03], 0.1); // barrette de bronze
      for (let i = 0; i < fx; i++) {
        const x = -innerW / 2 + 0.14 + i * ((innerW - 0.28) / (fx - 1));
        const dead = rng.chance(0.12);
        contentParts.push(withTone(buildBlock([PX * 2, PX * 1.2, 0.07], [x, y, zIn + 0.08]), dead ? -1.1 : rng.range(-0.05, 0.1)));
      }
    }
  }

  // --- Portes grillagées : cadre de laiton, quadrillage d'un pixel, cadran et molette. Une plage de sommets par porte.
  const brassParts = [];
  const doorRanges = [];
  let vertexCount = 0;
  const zDoor = D + 0.012;
  for (const cell of cells) {
    const { x, y, w, h } = cell;
    const dw = w - 0.02, dh = h - 0.02;
    const left = x - dw / 2, cy = y + h / 2;
    const parts = [];
    const f = PX * 1.2; // cadre
    parts.push(buildBlock([dw, f, 0.02], [x, cy - dh / 2 + f / 2, zDoor]));
    parts.push(buildBlock([dw, f, 0.02], [x, cy + dh / 2 - f / 2, zDoor]));
    parts.push(buildBlock([f, dh, 0.02], [left + f / 2, cy, zDoor]));
    parts.push(buildBlock([f, dh, 0.02], [left + dw - f / 2, cy, zDoor]));
    // Quadrillage : barreaux d'un pixel tous les 2 pixels (un vide d'un pixel entre deux).
    const step = PX * 2;
    const nx = Math.floor((dw - 2 * f) / step), ny = Math.floor((dh - 2 * f) / step);
    for (let i = 1; i < nx; i++) parts.push(withTone(buildBlock([PX * 0.5, dh - 2 * f, 0.008], [left + f + i * ((dw - 2 * f) / nx), cy, zDoor]), -0.15));
    for (let j = 1; j < ny; j++) parts.push(withTone(buildBlock([dw - 2 * f, PX * 0.5, 0.008], [x, cy - dh / 2 + f + j * ((dh - 2 * f) / ny), zDoor + 0.006]), -0.05));
    // Plaque, cadran de 2 px et molette d'un pixel, côté opposé aux charnières.
    const px = left + dw - f - 0.07;
    const py = fuse ? cy + 0.1 : cy + dh * 0.12;
    parts.push(withTone(buildBlock([0.13, 0.2, 0.012], [px, py, zDoor + 0.012]), 0.1));
    const d = dial({ radius: PX * 1.1, position: [px, py + 0.04, zDoor + 0.018], normal: [0, 0, 1], ticks: 6, needle: rng.range(-2, 2), depth: PX * 0.3 });
    parts.push(withTone(d.face, 0.6), withTone(d.marks, -1));
    parts.push(withTone(orient(plain(new THREE.CylinderGeometry(PX * 0.6, PX * 0.6, 0.03, 6)), [px, py - 0.05, zDoor + 0.02], [0, 0, 1]), 0.4));
    // Charnières (deux plots sombres sur le bord gauche).
    for (const k of [-1, 1]) parts.push(withTone(buildBlock([PX, PX * 1.6, 0.03], [left, cy + k * dh * 0.36, zDoor]), -0.4));
    const merged = mergeToned(parts.map((g) => (g.attributes.aTone ? g : withTone(g, 0))));
    const count = merged.attributes.position.count;
    doorRanges.push({ start: vertexCount, count, hingeX: left, hingeZ: zDoor });
    vertexCount += count;
    brassParts.push(merged);
  }

  // --- Levier de coupure de l'armoire, sur le flanc droit.
  if (fuse) {
    const l = lever({ length: 0.22, angle: p.power === "on" ? -0.5 : 2.2, position: [W / 2, H * 0.62, D * 0.55], normal: [1, 0, 0], width: PX });
    bronzeParts.push(withTone(buildBlock([0.012, 0.32, 0.14], [W / 2 + 0.006, H * 0.62, D * 0.55]), -0.15));
    bronzeParts.push(withTone(l.rod, 0.15), withTone(l.knob, -0.5));
    // Plaque d'avertissement rouge sombre au-dessus de la porte : un trait gravé.
    box([0.24, 0.06, 0.01], [0, H - 0.12, D + 0.02], 0.3);
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const body = new THREE.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  body.name = "body";
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const brassGeometry = mergeToned(brassParts);
  const doors = new THREE.Mesh(brassGeometry, metalMaterial(METALS.blackenedBrass, { id: 31, tone: true }));
  doors.name = "doors";
  doors.castShadow = true;
  group.add(doors);

  if (contentParts.length) {
    const entry = fuse ? PORCELAIN : OILCLOTH;
    const content = new THREE.Mesh(mergeToned(contentParts), createToonMaterial({ ramp: entry.ramp, ink: entry.ink, steps: [0.3, 0.55, 0.8], tone: true, crease: true, id: 32 }));
    content.name = "content";
    content.castShadow = true;
    content.receiveShadow = true;
    group.add(content);
  }

  // --- Portes qui pivotent : sommets réécrits autour de la charnière (sans draw call de plus).
  const position = brassGeometry.attributes.position;
  const normal = brassGeometry.attributes.normal;
  const basePos = position.array.slice();
  const baseNormal = normal.array.slice();
  const MAX = THREE.MathUtils.degToRad(105);
  const open = doorRanges.map(() => 0);
  const pose = (i) => {
    const { start, count, hingeX, hingeZ } = doorRanges[i];
    const a = -open[i] * MAX;
    const c = Math.cos(a), s = Math.sin(a);
    for (let k = start; k < start + count; k++) {
      const x = basePos[k * 3] - hingeX, z = basePos[k * 3 + 2] - hingeZ;
      position.setXYZ(k, hingeX + x * c + z * s, basePos[k * 3 + 1], hingeZ - x * s + z * c);
      const nx = baseNormal[k * 3], nz = baseNormal[k * 3 + 2];
      normal.setXYZ(k, nx * c + nz * s, baseNormal[k * 3 + 1], -nx * s + nz * c);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    brassGeometry.computeBoundingSphere();
  };
  const locker = {
    count: doorRanges.length,
    open,
    setOpen(i, value) {
      if (i < 0 || i >= open.length) return;
      open[i] = THREE.MathUtils.clamp(value, 0, 1);
      pose(i);
    },
    setAll(value) {
      for (let i = 0; i < open.length; i++) locker.setOpen(i, value);
    },
  };
  if (p.doors === "open") locker.setAll(1);
  else if (p.doors === "ajar") locker.setOpen(rng.int(0, open.length - 1), 0.35);

  group.userData.locker = locker;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
