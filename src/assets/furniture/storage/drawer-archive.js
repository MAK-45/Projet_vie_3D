// Rayonnage monumental à tiroirs des Archives du Complexe (fiches ARC-01 et ARC-02, docs/complexe/PIECES.md) : une
// ossature de bronze sur une plinthe de basalte, une façade en grille de tiroirs à cassettes (12 colonnes × 23
// rangées pour 3 × 5,5 m : chaque façade fait 3 × 3 px, joint sombre d'un pixel, poignée claire d'un pixel), des
// montants de section et des lisses qui découpent la grille, et en haut, dans une frise sombre sous la corniche, des
// rouages qui tournent d'une dent de temps en temps (le « frémissement lointain de rouages » des Archives).
// Quelques tiroirs sont sortis (vrais tiroirs, avec 6 cassettes debout dont la tranche luit) ; la scène en tire
// d'autres avec `group.userData.archive`.
//
// 3 draw calls : bronze (ossature, façades, tiroirs sortis et rouages : pièces rigides en fin de maillage), pierre
// (plinthe), lueur (tranches des cassettes).

import * as THREE from "three";
import { sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import {
  PX, createRigidParts, gearWheel, glowMaterial, gridBlock, mergeParts, mergeToned, metalMaterial, plain, rivetRow, stoneMaterial,
  withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, glowParam, numberParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const DRAWERS = { few: "Quelques tiroirs sortis", closed: "Tous fermés", many: "Beaucoup de tiroirs sortis" };
const GEARS = { on: "Rouages qui tournent", off: "Rouages à l'arrêt" };
const DEPTH = 0.8; // profondeur du meuble
const PLINTH = 0.3; // plinthe de pierre
const FRIEZE = 0.44; // frise des rouages, sous la corniche
const CORNICE = 0.12;
const SIDE = 0.07; // montants latéraux
const POOL = 6; // tiroirs qui peuvent sortir en même temps
const TRAVEL = 0.7; // course d'un tiroir ouvert (m)
const FIXED = 255;

const params = {
  seed: seedParam("Change les tiroirs sortis, les tons des colonnes, les tiroirs plus clairs ou plus sombres, la place et la taille des rouages, leur cadence."),
  width: numberParam("Largeur", 3, 1, 3, "Largeur du rayonnage (une colonne de tiroirs par 0,25 m ; 3 m = 12 colonnes).", { step: 0.25, unit: "m" }),
  height: numberParam("Hauteur", 5.5, 2, 5.5, "Hauteur totale, corniche comprise (5,5 m = 23 rangées ; les rangs hauts se lisent depuis la mezzanine).", { step: 0.1, unit: "m" }),
  drawers: choiceParam("Tiroirs", DRAWERS, "Tous fermés, quelques-uns sortis (entrouverts de 0,3 m ou ouverts de 0,7 m), ou beaucoup. Pilotable : group.userData.archive."),
  gears: choiceParam("Rouages", GEARS, "Les rouages de la frise avancent d'une dent de temps en temps, ou restent immobiles."),
  glow: glowParam("Couleur des tranches de cassettes, dans les tiroirs ouverts.", { only: ["amber", "cyan"] }),
};

export const meta = {
  id: "furniture/storage/drawer-archive",
  name: "Rayonnage à tiroirs",
  nameEn: "Drawer archive",
  category: "furniture",
  subcategory: "storage",
  description:
    "Rayonnage monumental des Archives du Complexe : ossature de bronze sur plinthe de basalte, façade en grille de " +
    "petits tiroirs à cassettes (12 × 23 pour 3 × 5,5 m), poignées d'un pixel, frise de rouages qui tournent d'une " +
    "dent par à-coups sous la corniche. Quelques tiroirs sortis montrent leurs cassettes de verre à la tranche " +
    "lumineuse ; la scène peut en tirer d'autres. Fiches ARC-01, ARC-02.",
  tags: [
    "rayonnage", "tiroirs", "archives", "cassettes", "classeur", "rouages", "engrenages", "bronze", "basalte",
    "bibliothèque", "le complexe", "complexe", "ancien-tech", "rangement", "animé", "pilotable", "intérieur",
    "drawer cabinet", "filing", "archive", "data cassettes", "gears", "clockwork", "patinated bronze", "black basalt",
    "library", "ancient complex", "ancient-tech", "storage", "animated", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; origine au sol, au milieu du dos (le mur est en z = 0, la façade regarde +z)",
  footprint: { radius: 2, height: 5.5 },
  animated: ["gears", "drawers"],
  params,
  variants: [
    { id: "monumental", name: "Monumental (3 × 5,5 m)", params: {} },
    { id: "low", name: "Bas (2 × 2,4 m)", params: { width: 2, height: 2.4, drawers: "many" } },
    { id: "closed", name: "Tous fermés", params: { drawers: "closed" } },
  ],
};

/**
 * Crée le rayonnage.
 * @param {{seed?: number, width?: number, height?: number, drawers?: string, gears?: string, glow?: string}} [given]
 * @returns {THREE.Group} `group.userData.archive` : { cols, rows, cellCenter(col, row), openness(col, row),
 *   setDrawer(col, row, u), slide(col, row, u, seconds?) } — u de 0 (fermé) à 1 (ouvert de 0,7 m)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 61);
  const W = p.width, H = p.height, D = DEPTH;
  const bronze = []; // [géométrie, pièce]
  const glow = [];
  const add = (g, tone = 0, part = FIXED) => bronze.push([withTone(g, tone), part]);

  // --- Ossature : montants, dos, dessus, corniche, frise.
  const gridY0 = PLINTH + 0.05;
  const gridY1 = H - CORNICE - FRIEZE - 0.04;
  const gridH = gridY1 - gridY0;
  const innerW = W - 2 * SIDE;
  const cols = Math.max(2, Math.round(innerW / 0.24));
  const rows = Math.max(3, Math.round(gridH / 0.198));
  const pitchX = innerW / cols, pitchY = gridH / rows;
  const soot = (y) => -0.22 * THREE.MathUtils.smoothstep(y, H * 0.45, H); // la suie monte

  for (const s of [-1, 1]) {
    const side = buildBlock([SIDE, H - PLINTH + 0.02, D + 0.02], [s * (W / 2 - SIDE / 2), (H + PLINTH) / 2 - 0.01, (D + 0.02) / 2]);
    add(withTone(side, (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.1 : 0.05) + soot(y)));
    // Rivets en pointillé sur la tranche avant du montant.
    add(rivetRow([s * (W / 2 - SIDE / 2), PLINTH + 0.25, D + 0.025], [s * (W / 2 - SIDE / 2), H - 0.3, D + 0.025], { spacing: 0.4, size: PX * 0.7 }), 0.3);
  }
  add(buildBlock([innerW, H - PLINTH, 0.03], [0, (H + PLINTH) / 2, 0.015]), -0.5); // dos
  add(buildBlock([W + 0.1, CORNICE, D + 0.1], [0, H - CORNICE / 2, (D + 0.1) / 2]), (x, y, z, nx, ny) => (ny > 0.5 ? -0.1 : 0.12)); // corniche
  add(buildBlock([W + 0.04, PX, D + 0.05], [0, H - CORNICE - PX / 2, (D + 0.05) / 2]), -0.35); // filet sous la corniche
  // Frise : fond sombre en retrait, deux lisses.
  const fy0 = H - CORNICE - FRIEZE, fy1 = H - CORNICE - PX;
  add(buildBlock([innerW, FRIEZE, 0.03], [0, (fy0 + fy1) / 2, D - 0.1]), -0.8);
  add(buildBlock([innerW, 0.05, 0.08], [0, fy0 + 0.025, D - 0.04]), (x, y) => 0.08 + soot(y)); // lisse basse de la frise
  add(buildBlock([innerW, 0.04, 0.06], [0, gridY0 - 0.02, D - 0.03]), 0.05); // lisse au pied de la grille

  // --- Façade : fond sombre (les joints), puis une façade et une poignée par tiroir (faces plates).
  add(buildBlock([innerW, gridH, 0.03], [0, (gridY0 + gridY1) / 2, D - 0.045]), -0.75);
  const colTone = Array.from({ length: cols }, () => rng.range(-0.07, 0.07));
  const fronts = [];
  const cellQuad = new Map(); // "col,row" → n° de la façade dans `fronts`
  const fw = pitchX - PX, fh = pitchY - PX * 0.8;
  const zFront = D - 0.012;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = -innerW / 2 + (c + 0.5) * pitchX, y = gridY0 + (r + 0.5) * pitchY;
      const odd = rng.next();
      const tone = colTone[c] + (odd < 0.04 ? -0.18 : odd > 0.95 ? 0.14 : rng.range(-0.04, 0.04)) + soot(y);
      cellQuad.set(`${c},${r}`, fronts.length);
      fronts.push({ position: [x, y, zFront], size: [fw, fh], tone });
      fronts.push({ position: [x, y - fh * 0.12, zFront + 0.006], size: [PX * 1.1, PX * 0.7], tone: 0.5 + soot(y) * 0.5 });
    }
  }
  const frontStart = bronze.reduce((n, [g]) => n + g.attributes.position.count, 0);
  bronze.push([buildQuads(fronts), FIXED]);
  // Montants de section (tous les 4 tiroirs) et lisses (toutes les 6 rangées), posés sur les joints.
  for (let c = 4; c < cols; c += 4) {
    add(buildBlock([PX * 1.2, gridH, 0.04], [-innerW / 2 + c * pitchX, (gridY0 + gridY1) / 2, D - 0.02]), (x, y) => 0.12 + soot(y));
  }
  for (let r = 6; r < rows; r += 6) {
    add(buildBlock([innerW, PX * 0.9, 0.035], [0, gridY0 + r * pitchY, D - 0.018]), (x, y) => 0.02 + soot(y));
  }

  // --- Tiroirs mobiles (pièces 0 à POOL − 1) : construits fermés à l'origine d'une case, rangés au fond tant qu'ils
  // ne servent pas.
  const dw = pitchX - PX * 1.15, dh = pitchY - PX;
  const body = TRAVEL - 0.04;
  const tw = 0.007; // tôle
  for (let k = 0; k < POOL; k++) {
    add(buildBlock([dw, dh, 0.02], [0, 0, zFront - 0.002]), 0.04, k); // façade
    add(buildBlock([PX * 1.1, PX * 0.7, 0.012], [0, -dh * 0.12, zFront + 0.01]), 0.5, k); // poignée
    add(buildBlock([PX * 1.8, PX * 0.6, 0.006], [0, dh * 0.22, zFront + 0.009]), 0.8, k); // porte-étiquette
    const zb = zFront - 0.012 - body / 2;
    add(buildBlock([dw - 0.01, tw, body], [0, -dh * 0.42, zb]), -0.45, k); // fond
    for (const s of [-1, 1]) add(buildBlock([tw, dh * 0.62, body], [s * (dw / 2 - 0.008), -dh * 0.14, zb]), -0.05, k);
    add(buildBlock([dw - 0.01, dh * 0.62, tw], [0, -dh * 0.14, zb - body / 2]), -0.3, k); // fond arrière
    // Six cassettes debout, de chant : plaquette de verre fumé (bronze très sombre) et tranche lumineuse.
    // Seules leur face avant et leur tranche se voient : des faces plates suffisent.
    const fronts6 = [], tops6 = [];
    for (let i = 0; i < 6; i++) {
      const z = zFront - 0.06 - i * (body - 0.08) / 5;
      fronts6.push({ position: [0, -dh * 0.14, z], size: [dw - 0.04, dh * 0.55], tone: i % 2 ? -0.55 : -0.68 });
      tops6.push({ position: [0, -dh * 0.14 + dh * 0.275 + 0.004, z - 0.012], size: [dw - 0.05, 0.03], normal: [0, 1, 0] });
    }
    add(buildQuads(fronts6), 0, k);
    glow.push([buildQuads(tops6), k]);
  }

  // --- Rouages de la frise (pièces POOL et suivantes) : deux trains de 2 ou 3 roues qui engrènent.
  const gears = [];
  const mod = 0.034;
  const gz = D - 0.07;
  const fc = (fy0 + 0.05 + fy1) / 2 + 0.03; // milieu de la frise, au-dessus de la lisse
  const trains = W >= 2 ? 2 : 1;
  for (let t = 0; t < trains; t++) {
    const span = innerW / trains;
    let x = -innerW / 2 + span * t + span * rng.range(0.15, 0.35);
    let dir = 1;
    let prev = null;
    const n = rng.int(2, 3);
    for (let i = 0; i < n; i++) {
      const teeth = rng.int(8, 11);
      const radius = (teeth * mod) / 2;
      let y = fc + rng.range(-0.03, 0.03);
      if (prev) {
        // Posée contre la précédente, un peu plus haut ou plus bas : les dents s'emboîtent (distance des centres).
        const dist = prev.radius + radius;
        const lo = fc - 0.16 + radius, hi = fc + 0.14 - radius;
        y = THREE.MathUtils.clamp(prev.y + rng.range(-0.5, 0.5) * dist, Math.min(lo, hi), Math.max(lo, hi));
        const dy = y - prev.y;
        x = prev.x + Math.sqrt(Math.max(0, dist * dist - dy * dy));
        if (x + radius > -innerW / 2 + span * (t + 1) - 0.04) break;
        dir = -prev.dir;
      }
      // Roue pleine lue en trois anneaux : jante dentée claire, toile sombre, moyeu clair. Une roue sur deux un peu
      // en avant : les dents qui engrènent passent l'une devant l'autre.
      const z = gz + (i % 2) * 0.014;
      const g = gearWheel({ teeth, module: mod, depth: 0.02, spokes: 0, hub: 0.32 });
      g.rotateZ(rng.range(0, Math.PI));
      g.translate(x, y, z);
      const part = POOL + gears.length;
      add(g, (t + i) % 2 ? 0.22 : 0.08, part);
      const disc = plain(new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, 0.006, 8));
      disc.rotateX(Math.PI / 2);
      disc.rotateZ(rng.range(0, 1));
      disc.translate(x, y, z + 0.022);
      add(disc, -0.38, part);
      add(buildBlock([PX * 0.7, PX * 0.7, 0.07], [x, y, gz - 0.02]), -0.3); // axe
      const gear = { x, y, radius, teeth, dir, part };
      gears.push(gear);
      prev = gear;
    }
  }
  // Une roue sur l'autre est calée pour que les dents tombent entre celles de la voisine.
  const gearPhase = rng.next() * 3;
  const period = rng.range(0.7, 1.1);

  // --- Plinthe de basalte, un peu en retrait, quadrillée pour l'usure (coups de pied, poussière).
  const plinth = gridBlock([W - 0.04, PLINTH, D - 0.04], [0, PLINTH / 2, (D - 0.04) / 2], { cell: 0.25 });
  withTone(plinth, (x, y, z, nx, ny, nz) => (nz > 0.5 && y < 0.08 ? -0.25 : ny > 0.5 ? -0.12 : rng.range(-0.06, 0.06)));
  const plinthTop = buildBlock([W - 0.02, 0.04, D - 0.02], [0, PLINTH - 0.02, (D - 0.02) / 2]);

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const bronzeMerged = mergeParts(bronze);
  const bronzeMesh = new THREE.Mesh(bronzeMerged.geometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronzeMesh.name = "bronze";
  const stoneMesh = new THREE.Mesh(mergeToned([plinth, withTone(plinthTop, 0.1)]), stoneMaterial(STONES.blackBasalt, { seed: p.seed % 97, id: 20 }));
  stoneMesh.name = "plinth";
  for (const m of [bronzeMesh, stoneMesh]) {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  }
  const glowMerged = mergeParts(glow);
  const glowMesh = new THREE.Mesh(glowMerged.geometry, glowMaterial(p.glow, { level: 2, id: 40 }));
  glowMesh.name = "cassettes";
  group.add(glowMesh);

  const rigs = [createRigidParts(bronzeMerged.geometry, bronzeMerged.partOf, POOL + gears.length), createRigidParts(glowMerged.geometry, glowMerged.partOf, POOL)];
  const positions = bronzeMerged.geometry.attributes.position;
  const frontBase = positions.array.slice(frontStart * 3, (frontStart + fronts.length * 4) * 3);

  // --- Tiroirs : une case prend un tiroir mobile ; sa façade plate (et sa poignée) rentre au fond.
  const slots = Array.from({ length: POOL }, () => ({ cell: null, u: 0, tween: null }));
  const cellCenter = (c, r) => new THREE.Vector3(-innerW / 2 + (c + 0.5) * pitchX, gridY0 + (r + 0.5) * pitchY, 0);
  const showFront = (key, visible) => {
    const q = cellQuad.get(key);
    const start = (frontStart + q * 4) * 3, count = 8 * 3; // la façade et sa poignée
    for (let i = 0; i < count; i += 3) {
      positions.array[start + i] = frontBase[q * 12 + i];
      positions.array[start + i + 1] = frontBase[q * 12 + i + 1];
      positions.array[start + i + 2] = visible ? frontBase[q * 12 + i + 2] : 0.2;
    }
    positions.addUpdateRange(start, count);
    positions.needsUpdate = true;
  };
  const poseSlot = (k) => {
    const s = slots[k];
    if (!s.cell) {
      for (const rig of rigs) rig.matrices[k]?.makeTranslation(0, PLINTH + 0.5, -0.08); // rangé dans le meuble
      return;
    }
    const v = cellCenter(s.cell[0], s.cell[1]);
    for (const rig of rigs) rig.matrices[k]?.makeTranslation(v.x, v.y, s.u * TRAVEL);
  };
  const slotOf = (c, r, take) => {
    let k = slots.findIndex((s) => s.cell && s.cell[0] === c && s.cell[1] === r);
    if (k >= 0 || !take) return k;
    k = slots.findIndex((s) => !s.cell);
    if (k < 0) {
      // Tous pris : on reprend le tiroir le moins sorti et immobile.
      k = slots.reduce((best, s, i) => (!s.tween && (best < 0 || s.u < slots[best].u) ? i : best), -1);
      if (k < 0) k = 0;
      showFront(`${slots[k].cell[0]},${slots[k].cell[1]}`, true);
    }
    slots[k].cell = [c, r];
    slots[k].u = 0;
    slots[k].tween = null;
    showFront(`${c},${r}`, false);
    return k;
  };
  const valid = (c, r) => Number.isInteger(c) && Number.isInteger(r) && c >= 0 && c < cols && r >= 0 && r < rows;
  let dirty = true;
  const archive = {
    cols,
    rows,
    pitch: [pitchX, pitchY],
    cellCenter: (c, r) => cellCenter(c, r).setZ(zFront),
    openness: (c, r) => slots[slotOf(c, r, false)]?.u ?? 0,
    setDrawer(c, r, u) {
      if (!valid(c, r)) return;
      const k = slotOf(c, r, true);
      slots[k].u = THREE.MathUtils.clamp(u, 0, 1);
      slots[k].tween = null;
      dirty = true;
    },
    slide(c, r, u, seconds = 1) {
      if (!valid(c, r)) return;
      const k = slotOf(c, r, true);
      slots[k].tween = { from: slots[k].u, to: THREE.MathUtils.clamp(u, 0, 1), start: sharedUniforms.uTime.value, seconds };
    },
  };

  // Tiroirs sortis au départ, tirés de la graine (jamais tout en bas ni dans les deux rangées du haut).
  const pulled = { closed: 0, few: rng.int(1, 3), many: rng.int(5, 6) }[p.drawers];
  for (let i = 0; i < pulled; i++) {
    const c = rng.int(0, cols - 1), r = rng.int(1, Math.max(1, rows - 3));
    archive.setDrawer(c, r, rng.chance(0.5) ? 0.3 / TRAVEL : 1);
  }

  const ease = (x) => x * x * (3 - 2 * x);
  const gearAngles = gears.map(() => NaN);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  const tmp = new THREE.Matrix4();
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime || dirty) {
      lastTime = time;
      for (const s of slots) {
        if (!s.tween) continue;
        const k = Math.min(1, (time - s.tween.start) / s.tween.seconds);
        s.u = s.tween.from + (s.tween.to - s.tween.from) * ease(k);
        if (k >= 1) s.tween = null;
        dirty = true;
      }
      // Rouages : une dent par à-coup (un claquement de 0,2 s), toutes les `period` secondes.
      const beat = p.gears === "on" ? (time + gearPhase) / period : 0;
      const n = Math.floor(beat);
      const step = n + ease(Math.min(1, (beat - n) / 0.22));
      let turned = false;
      gears.forEach((g, i) => {
        const a = g.dir * step * ((Math.PI * 2) / g.teeth);
        if (a === gearAngles[i]) return;
        gearAngles[i] = a;
        turned = true;
        rigs[0].matrices[g.part].makeTranslation(g.x, g.y, 0).multiply(tmp.makeRotationZ(a)).multiply(tmp.makeTranslation(-g.x, -g.y, 0));
      });
      if (dirty) {
        for (let k = 0; k < POOL; k++) poseSlot(k);
        rigs[1].apply();
      }
      if (dirty || turned) rigs[0].apply();
      dirty = false;
    }
    baseUpdate(force);
  };
  group.updateMatrixWorld(true);

  group.userData.archive = archive;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
