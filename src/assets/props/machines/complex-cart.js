// Chariot du Complexe (fiches ARC-10, GAL-08 et ATE-11, docs/complexe/PIECES.md).
// - À cassettes (Archives) : 1,0 × 0,6 × 1,1 m, trois plateaux de bronze à rebord, poignée de laiton, quatre roues de
//   Ø 0,20 m cerclées de bronze (deux sur roulettes pivotantes) ; cassettes debout en rangées sur le plateau du haut,
//   en piles dessous, leurs tranches lumineuses tournées vers l'extérieur.
// - D'instruments (Galerie) : 1,2 × 0,6 × 1,0 m, deux plateaux, roues de Ø 0,25 m ; sondes à pointe de laiton,
//   rouleaux de câble, boîtier à cadran et voyant ambre.
// - À pièces lourdes (Atelier) : 1,8 × 0,8 m, plateau en madriers de tons alternés sur un châssis de fonte, quatre
//   roues de bois de Ø 0,40 m cerclées de fer, timon d'un mètre baissé au sol ou relevé ; caisse, lingots, ébauche
//   de roue dentée.
// La graine dispose la charge (piles, rangées, couleurs, objets), oriente les roulettes, use les tons, place le timon.
// `group.userData.cart.roll(distance)` : le chariot a avancé de `distance` m le long de son x local ; les roues
// tournent d'autant et les roulettes s'alignent dans le sens de la marche. `setDrawbar(angle)` lève ou baisse le
// timon. `handle` : où vont les mains. `group.userData.surfaces` : les plateaux, pour y poser des objets.
//
// 2 ou 3 draw calls : métal (châssis, plateaux, roues, objets), lueurs (tranches, voyants) ou bois (chariot lourd).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe, buildQuads } from "../../kit/geometry.js";
import { DATA_GLOWS, METALS, WOODS } from "../../kit/palettes.js";
import {
  PX, beam, createRigidParts, dial, glowMixMaterial, mergeParts, metalMaterial, plain, withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = {
  cassettes: "À cassettes (Archives, 3 plateaux)",
  instruments: "D'instruments (Galerie, 2 plateaux)",
  heavy: "À pièces lourdes (Atelier, madriers, timon)",
};
const LOADS = { full: "Chargé", half: "À moitié", empty: "Vide" };
const DRAWBARS = { down: "Baissé au sol", up: "Relevé" };
// Longueur (x), profondeur (z), rayon des roues, dessus des plateaux, hauteur de la poignée (m).
const SIZES = {
  cassettes: { L: 1.0, D: 0.6, r: 0.1, shelves: [0.3, 0.6, 0.9], handle: 1.08 },
  instruments: { L: 1.2, D: 0.6, r: 0.125, shelves: [0.36, 0.8], handle: 0.98 },
  heavy: { L: 1.8, D: 0.8, r: 0.2, shelves: [0.58] },
};
const COLORS = ["amber", "cyan", "green", "red"];
const FIXED = 255;
const DRAWBAR = 6; // n° de pièce du timon ; roues 0 à 3, chapes des roulettes 4 et 5

const params = {
  seed: seedParam("Change la charge (piles, rangées, couleurs des tranches, objets posés), l'orientation des roulettes, l'usure, la place du timon."),
  model: choiceParam("Modèle", MODELS, "Chariot à cassettes des Archives, chariot d'instruments de la Galerie, ou chariot à pièces lourdes de l'Atelier."),
  load: choiceParam("Charge", LOADS, "Plateaux pleins, à moitié pleins, ou vides."),
  drawbar: choiceParam("Timon", DRAWBARS, "Chariot lourd : timon baissé, posé au sol devant le chariot, ou relevé contre le plateau."),
};

export const meta = {
  id: "props/machines/complex-cart",
  name: "Chariot du Complexe",
  nameEn: "Complex cart",
  category: "props",
  subcategory: "machines",
  description:
    "Chariot à roues cerclées du Complexe : chariot à cassettes des Archives (trois plateaux de bronze, cassettes aux " +
    "tranches lumineuses, poignée de laiton, roulettes pivotantes), chariot d'instruments de la Galerie (sondes, " +
    "rouleaux de câble, boîtier à cadran), ou chariot à pièces lourdes de l'Atelier (madriers, roues de bois cerclées " +
    "de fer, timon). Les roues tournent quand on le pousse. Fiches ARC-10, GAL-08, ATE-11.",
  tags: [
    "chariot", "desserte", "roues", "roulettes", "plateaux", "poignée", "timon", "madriers", "cassettes", "sondes",
    "câbles", "lingots", "bronze", "fonte", "le complexe", "complexe", "ancien-tech", "transport", "pilotable",
    "intérieur",
    "cart", "trolley", "wheels", "casters", "shelves", "handle", "drawbar", "planks", "data cassettes", "probes",
    "cable coils", "ingots", "cast iron", "ancient complex", "ancient-tech", "haulage", "scriptable", "indoor",
    "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unité = 1 mètre ; origine au sol, au centre ; le chariot roule le long de x (poignée côté −x, timon côté +x)",
  footprint: { radius: 1.9, height: 1.15 },
  animated: ["wheels", "drawbar"],
  params,
  variants: [
    { id: "cassettes", name: "À cassettes", params: {} },
    { id: "instruments", name: "D'instruments", params: { model: "instruments" } },
    { id: "heavy", name: "À pièces lourdes", params: { model: "heavy" } },
    { id: "heavy-up", name: "Lourd vide, timon relevé", params: { model: "heavy", load: "empty", drawbar: "up" } },
  ],
};

/**
 * Crée le chariot.
 * @param {{seed?: number, model?: string, load?: string, drawbar?: string}} [given]
 * @returns {THREE.Group} `group.userData.cart` : { distance, roll(d), setDrawbar(angle), drawbar, handle: Vector3 } ;
 *   `group.userData.surfaces` : [{ y, size: [x, z], center: [x, z] }] (du bas vers le haut) ; `surface` : le plus haut
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 401);
  const S = SIZES[p.model];
  const heavy = p.model === "heavy";
  const metal = [], wood = [], glow = [];
  const fill = { full: 1, half: 0.5, empty: 0 }[p.load];
  const heavyPivot = new THREE.Vector3(), heavyTip = new THREE.Vector3(); // timon : pivot et anneau (pose de construction)

  // --- Roues : jante (cercle de métal) et toile ou rayons, moyeu, un boulon clair pour voir tourner la roue.
  const wheels = []; // { A, r, part, caster? }
  const addWheel = (A, r, w, part, spokes) => {
    const rim = buildLathe([[r - Math.max(0.022, r * 0.14), -w / 2], [r, -w / 2], [r, w / 2], [r - Math.max(0.022, r * 0.14), w / 2]], { segments: r > 0.15 ? 16 : 12, axis: "z", facets: true });
    metal.push([withTone(rim.translate(A.x, A.y, A.z), 0.15), part]);
    if (spokes) {
      for (let k = 0; k < spokes; k++) {
        const a = (k / spokes) * Math.PI * 2;
        const tip = [A.x + Math.cos(a) * (r - 0.02), A.y + Math.sin(a) * (r - 0.02), A.z];
        wood.push([withTone(beam([A.x, A.y, A.z], tip, 0.035, 0.035), k % 2 ? 0.08 : -0.08), part]);
      }
      const hub = plain(new THREE.CylinderGeometry(0.055, 0.055, w + 0.04, 8)).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
      wood.push([withTone(hub, 0.1), part]);
    } else {
      const web = plain(new THREE.CylinderGeometry(r - 0.015, r - 0.015, w * 0.55, 10)).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
      metal.push([withTone(web, -0.5), part]);
    }
    const cap = plain(new THREE.CylinderGeometry(r * 0.28, r * 0.28, w + 0.05, 8)).rotateX(Math.PI / 2).translate(A.x, A.y, A.z);
    metal.push([withTone(cap, heavy ? 0.05 : 0.25), part]);
    for (const s of [-1, 1]) {
      metal.push([withTone(buildBlock([PX * 0.6, PX * 0.6, 0.01], [A.x + r * 0.55, A.y, A.z + s * (w * 0.3 + 0.005)]), 0.55), part]);
    }
    wheels.push({ A: A.clone(), r, part });
  };

  if (heavy) buildHeavy();
  else buildShelfCart();

  // --- Chariots à plateaux (cassettes, instruments).
  function buildShelfCart() {
    const { L, D, r, shelves } = S;
    const w = 0.045;
    const bottom = shelves[0] - 0.05;
    const top = shelves[shelves.length - 1] + 0.05;
    const xEnd = L / 2 - 0.03, zEnd = D / 2 - 0.03;
    // Montants aux quatre coins, traverses basses.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      metal.push([withTone(beam([sx * xEnd, bottom, sz * zEnd], [sx * xEnd, top, sz * zEnd], PX * 0.7, PX * 0.7), sx < 0 ? 0 : -0.06), FIXED]);
    }
    // Plateaux à rebord : plaque, deux rebords longs, deux rebords courts ; un ton par plateau.
    shelves.forEach((y, i) => {
      const t = rng.range(-0.08, 0.06) - 0.05 * i;
      metal.push([withTone(buildBlock([L - 0.02, 0.025, D - 0.02], [0, y - 0.0125, 0]), (x, yy, z, nx, ny) => t + (ny > 0.5 ? -0.12 : 0)), FIXED]);
      for (const sz of [-1, 1]) metal.push([withTone(buildBlock([L - 0.02, 0.04, PX * 0.35], [0, y + 0.02, sz * (D / 2 - 0.015)]), t + 0.12), FIXED]);
      for (const sx of [-1, 1]) metal.push([withTone(buildBlock([PX * 0.35, 0.04, D - 0.02], [sx * (L / 2 - 0.015), y + 0.02, 0]), t + 0.12), FIXED]);
    });
    // Poignée de laiton côté −x : deux montants qui se prolongent, une barre ronde en travers.
    const hx = -L / 2 - 0.07;
    for (const sz of [-1, 1]) {
      metal.push([withTone(beam([-xEnd, top - 0.03, sz * (zEnd - 0.04)], [hx, S.handle, sz * (zEnd - 0.04)], PX * 0.55, PX * 0.55), 0.2), FIXED]);
    }
    const bar = plain(new THREE.CylinderGeometry(0.022, 0.022, D - 0.02, 8)).rotateX(Math.PI / 2).translate(hx, S.handle, 0);
    metal.push([withTone(bar, (x, y) => (y > S.handle ? 0.45 : 0.3)), FIXED]);

    // Roues fixes côté poignée (sur pattes), roulettes pivotantes côté +x.
    const axleY = r;
    for (const sz of [-1, 1]) {
      const A = new THREE.Vector3(-xEnd + 0.05, axleY, sz * (zEnd - 0.01));
      metal.push([withTone(buildBlock([0.06, bottom - axleY + 0.01, 0.015], [A.x, (bottom + axleY) / 2, A.z - sz * (w / 2 + 0.012)]), -0.1), FIXED]);
      addWheel(A, r, w, sz < 0 ? 0 : 1);
    }
    [-1, 1].forEach((sz, k) => {
      const pivot = new THREE.Vector3(xEnd - 0.06, bottom - 0.01, sz * (zEnd - 0.01));
      const trail = 0.045;
      const A = new THREE.Vector3(pivot.x - trail, axleY, pivot.z);
      const part = 4 + k;
      // Chape : platine sous le plateau (fixe), tige, deux joues de part et d'autre de la roue (pièce qui pivote).
      metal.push([withTone(buildBlock([0.08, 0.015, 0.08], [pivot.x, pivot.y + 0.0075, pivot.z]), 0.05), FIXED]);
      metal.push([withTone(plain(new THREE.CylinderGeometry(0.014, 0.014, 0.04, 6)).translate(pivot.x, pivot.y - 0.02, pivot.z), 0.2), part]);
      metal.push([withTone(buildBlock([0.07, 0.014, w + 0.04], [pivot.x - trail / 2, pivot.y - 0.045, pivot.z]), -0.05), part]);
      for (const s of [-1, 1]) {
        metal.push([withTone(beam([pivot.x - 0.005, pivot.y - 0.045, pivot.z + s * (w / 2 + 0.014)], [A.x, A.y, A.z + s * (w / 2 + 0.014)], 0.03, 0.012), -0.12), part]);
      }
      addWheel(A, r, w, k === 0 ? 2 : 3);
      wheels[wheels.length - 1].caster = { pivot, part };
    });

    if (p.model === "cassettes") loadCassettes();
    else loadInstruments();
  }

  // Cassettes : debout en deux rangées sur le plateau du haut (tranches en haut), en piles sur les autres, tranches
  // tournées vers l'extérieur (rangée avant vers +z, rangée arrière vers −z).
  function loadCassettes() {
    if (!fill) return;
    const { L, D, shelves } = S;
    const CL = 0.18, CW = 0.1, CT = 0.024;
    const body = (size, at, tone) => metal.push([withTone(buildBlock(size, at), tone), FIXED]);
    const slice = (quad, color) => glow.push(withShade(buildQuads([quad]), color, 4));
    const topY = shelves[shelves.length - 1];
    for (const sz of [-1, 1]) {
      // Rangées debout : des séries de cassettes d'une même couleur, séparées par un vide.
      let x = -L / 2 + 0.06;
      const end = -L / 2 + 0.06 + (L - 0.12) * (fill === 1 ? rng.range(0.85, 1) : rng.range(0.35, 0.6));
      while (x < end - CT) {
        const run = rng.int(3, 9);
        const color = rng.int(0, 3);
        for (let i = 0; i < run && x < end - CT; i++) {
          const zc = sz * (D / 4 - 0.01);
          body([CT * 0.9, CW, CL], [x + CT / 2, topY + CW / 2, zc], -0.38 + (i % 2) * -0.08);
          slice({ position: [x + CT / 2, topY + CW + 0.0015, zc], size: [CT * 0.62, CL - 0.024], normal: [0, 1, 0] }, color);
          x += CT;
        }
        x += rng.range(0.025, 0.08);
      }
    }
    // Piles couchées sur les plateaux du bas.
    shelves.slice(0, -1).forEach((y) => {
      const slots = 4;
      for (const sz of [-1, 1]) {
        for (let s = 0; s < slots; s++) {
          if (rng.next() > fill * 0.95) continue;
          const n = rng.int(2, 8);
          const color = rng.int(0, 3);
          const xc = -L / 2 + ((s + 0.5) * L) / slots + rng.range(-0.02, 0.02);
          const zc = sz * (D / 4 + 0.02);
          for (let i = 0; i < n; i++) {
            const jx = rng.range(-0.01, 0.01);
            body([CL, CT * 0.92, CW], [xc + jx, y + CT / 2 + i * CT, zc], -0.38 + (i % 2) * -0.08);
            slice({ position: [xc + jx, y + CT / 2 + i * CT, zc + sz * (CW / 2 + 0.0015)], size: [CL - 0.024, CT * 0.6], normal: [0, 0, sz] }, color);
          }
        }
      }
    });
  }

  // Instruments : sondes à pointe, rouleaux de câble (gaine goudronnée : le métal au plus sombre), boîtier à cadran.
  function loadInstruments() {
    if (!fill) return;
    const { L, D, shelves } = S;
    const top = shelves[1], low = shelves[0];
    const add = (g, tone) => metal.push([withTone(g, tone), FIXED]);
    const coil = (x, y, z, R) => {
      const g = plain(new THREE.TorusGeometry(R, 0.024, 4, 12)).rotateX(Math.PI / 2).translate(x, y + 0.024, z);
      add(g, (xx, yy) => -0.62 + (yy > y + 0.03 ? 0.12 : 0));
      // Connecteur de bronze au bout du câble, posé sur la spire.
      add(buildBlock([0.05, 0.03, 0.03], [x + R * 0.7, y + 0.06, z + R * 0.7]), 0.3);
    };
    const probe = (x, y, z, len, yaw) => {
      const dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
      const a = new THREE.Vector3(x, y + 0.02, z).addScaledVector(dir, -len / 2);
      const b = new THREE.Vector3(x, y + 0.02, z).addScaledVector(dir, len / 2);
      add(beam(a, b, PX * 0.42, PX * 0.42), 0.35);
      const grip = a.clone().addScaledVector(dir, 0.12);
      add(beam(a, grip, PX * 0.75, PX * 0.75), -0.55);
      const tip = plain(new THREE.ConeGeometry(0.018, 0.06, 6));
      tip.rotateZ(-Math.PI / 2).rotateY(-yaw).translate(b.x + dir.x * 0.03, b.y, b.z + dir.z * 0.03);
      add(tip, 0.55);
    };
    // Plateau du haut : boîtier à cadran (voyant ambre), deux ou trois sondes, un rouleau.
    const bx = rng.range(-0.3, -0.15) * L, bz = rng.range(-0.08, 0.04);
    add(buildBlock([0.26, 0.17, 0.2], [bx, top + 0.085, bz]), (x, y) => (y > top + 0.165 ? -0.15 : -0.35));
    const d = dial({ radius: 0.05, position: [bx - 0.04, top + 0.09, bz + 0.1], normal: [0, 0, 1], ticks: 8, needle: rng.range(-1.2, 1.2) });
    add(d.face, 0.45);
    add(d.marks, -0.7);
    glow.push(withShade(plain(new THREE.SphereGeometry(0.014, 6, 4)).translate(bx + 0.08, top + 0.12, bz + 0.1), 0, 1));
    const probes = fill === 1 ? rng.int(2, 3) : 1;
    for (let i = 0; i < probes; i++) probe(rng.range(0.05, 0.3) * L, top, -D / 4 + i * 0.12 + rng.range(-0.02, 0.02), rng.range(0.42, 0.55), rng.range(-0.15, 0.15));
    if (fill === 1) coil(rng.range(0.15, 0.3) * L, top, D / 4, 0.09);
    // Plateau du bas : rouleaux empilés, un étui long.
    const coils = fill === 1 ? rng.int(2, 3) : 1;
    const cx = rng.range(-0.25, -0.1) * L;
    for (let i = 0; i < coils; i++) coil(cx + rng.range(-0.02, 0.02), low + i * 0.05, rng.range(-0.03, 0.03), 0.11 - i * 0.012);
    if (fill === 1) add(buildBlock([0.5, 0.08, 0.14], [rng.range(0.1, 0.2) * L, low + 0.04, rng.range(-0.1, 0.1)], [0, rng.range(-0.2, 0.2), 0]), (x, y) => (y > low + 0.07 ? -0.1 : -0.3));
  }

  // --- Chariot lourd : châssis de fonte, plateau de madriers, roues de bois cerclées de fer, timon.
  function buildHeavy() {
    const { L, D, r } = S;
    const deck = S.shelves[0];
    const w = 0.08;
    const axleX = L / 2 - 0.32;
    // Longerons et traverses.
    for (const sz of [-1, 1]) metal.push([withTone(buildBlock([L - 0.1, 0.1, 0.08], [0, deck - 0.11, sz * (D / 2 - 0.14)]), -0.05), FIXED]);
    for (const x of [-L / 2 + 0.1, 0, L / 2 - 0.1]) metal.push([withTone(buildBlock([0.08, 0.06, D - 0.2], [x, deck - 0.09, 0]), -0.15), FIXED]);
    // Essieux et chapes.
    for (const sx of [-1, 1]) {
      metal.push([withTone(beam([sx * axleX, r, -D / 2 - 0.02], [sx * axleX, r, D / 2 + 0.02], 0.04, 0.04), -0.2), FIXED]);
      for (const sz of [-1, 1]) metal.push([withTone(buildBlock([0.1, deck - 0.16 - r + 0.02, 0.05], [sx * axleX, (deck - 0.16 + r) / 2, sz * (D / 2 - 0.14)]), -0.1), FIXED]);
    }
    // Plateau : madriers le long de x, un ton sur deux, joints sombres sur le dessus ; deux bandes de fer en travers.
    const planks = 6;
    const pw = D / planks;
    const wear = rng.range(-0.05, 0.05);
    for (let i = 0; i < planks; i++) {
      const z = -D / 2 + (i + 0.5) * pw;
      const len = L - (rng.chance(0.3) ? rng.range(0.02, 0.06) : 0);
      const t = (i % 2 ? 0.12 : -0.08) + rng.range(-0.05, 0.05) + wear;
      wood.push([withTone(buildBlock([len, 0.06, pw - 0.006], [rng.range(-0.01, 0.01), deck - 0.03, z]), (x, y, zz, nx, ny) => t + (ny > 0.5 ? 0 : -0.15)), FIXED]);
    }
    const joints = [];
    for (let i = 1; i < planks; i++) joints.push({ position: [0, deck + 0.0015, -D / 2 + i * pw], size: [L - 0.04, PX * 0.3], normal: [0, 1, 0], tone: -0.8 });
    wood.push([buildQuads(joints), FIXED]);
    for (const x of [-L / 2 + 0.16, L / 2 - 0.16]) {
      metal.push([withTone(buildBlock([0.06, 0.012, D + 0.02], [x, deck + 0.006, 0]), 0.15), FIXED]);
      for (let i = 0; i < planks; i++) metal.push([withTone(buildBlock([PX * 0.45, 0.008, PX * 0.45], [x, deck + 0.016, -D / 2 + (i + 0.5) * pw]), 0.45), FIXED]);
    }
    // Roues de bois à 6 rais, cerclées de fer, à l'extérieur des longerons.
    let part = 0;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) addWheel(new THREE.Vector3(sx * axleX, r, sz * (D / 2 + 0.07)), r, w, part++, 6);
    // Timon : deux bras en V depuis l'essieu avant, anneau de tirage au bout ; construit vers +x, pivot sur z.
    const pivot = new THREE.Vector3(L / 2 - 0.02, r + 0.12, 0);
    const length = 1.0;
    for (const sz of [-1, 1]) {
      metal.push([withTone(beam([pivot.x, pivot.y, sz * 0.22], [pivot.x + length - 0.12, pivot.y, sz * 0.03], 0.04, 0.035), sz < 0 ? 0.05 : -0.05), DRAWBAR]);
      metal.push([withTone(plain(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8)).rotateX(Math.PI / 2).translate(pivot.x, pivot.y, sz * 0.22), 0.2), DRAWBAR]);
    }
    metal.push([withTone(beam([pivot.x + length - 0.14, pivot.y, 0], [pivot.x + length - 0.06, pivot.y, 0], 0.05, 0.04), 0), DRAWBAR]);
    const loop = buildLathe([[0.045, -0.012], [0.07, -0.012], [0.07, 0.012], [0.045, 0.012]], { segments: 10, facets: true });
    metal.push([withTone(loop.translate(pivot.x + length, pivot.y, 0), 0.25), DRAWBAR]);
    heavyPivot.copy(pivot);
    heavyTip.set(pivot.x + length, pivot.y, 0);

    // Charge : caisse de bois cerclée, lingots de fonte en pile, ébauche de roue dentée.
    if (!fill) return;
    const ix = rng.range(0.1, 0.35), iz = rng.range(-0.15, 0.15);
    const ingot = (x, y, z, yaw) => metal.push([withTone(buildBlock([0.3, 0.07, 0.11], [x, y + 0.035, z], [0, yaw, 0], { taper: 0.2 }), (xx, yy, zz, nx, ny) => (ny > 0.5 ? 0.25 : 0.05)), FIXED]);
    const layers = fill === 1 ? 3 : 2;
    for (let l = 0; l < layers; l++) {
      const n = 3 - l;
      for (let i = 0; i < n; i++) ingot(ix + rng.range(-0.01, 0.01), deck + l * 0.07, iz + (i - (n - 1) / 2) * 0.13, (l % 2 ? Math.PI / 2 : 0) + rng.range(-0.06, 0.06));
    }
    const gx = rng.range(0.5, 0.62), gz = rng.range(-0.18, 0.18);
    const blank = plain(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14));
    metal.push([withTone(blank.translate(gx, deck + 0.03, gz), (x, y, z) => (y > deck + 0.05 ? (Math.hypot(x - gx, z - gz) < 0.06 ? 0.4 : 0.15) : -0.1)), FIXED]);
    if (fill === 1) {
      const cx = rng.range(-0.55, -0.35), cz = rng.range(-0.08, 0.08), yaw = rng.range(-0.15, 0.15);
      const size = [0.6, 0.45, 0.48];
      wood.push([withTone(buildBlock(size, [cx, deck + size[1] / 2, cz], [0, yaw, 0]), (x, y, z, nx, ny) => (ny > 0.5 ? 0.15 : 0.02)), FIXED]);
      // Cerclage : deux bandes de fer autour de la caisse.
      for (const t of [-0.18, 0.18]) {
        const band = buildBlock([0.045, size[1] + 0.012, size[2] + 0.012], [t, 0, 0]);
        band.rotateY(yaw).translate(cx, deck + size[1] / 2, cz);
        metal.push([withTone(band, 0.1), FIXED]);
      }
    }
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE.Mesh(metalMerged.geometry, metalMaterial(heavy ? METALS.castIron : METALS.patinatedBronze, { id: 30, tone: true }));
  metalMesh.name = "frame";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  group.add(metalMesh);
  const rigs = [createRigidParts(metalMerged.geometry, metalMerged.partOf, 7)];
  if (wood.length) {
    const woodMerged = mergeParts(wood);
    const woodMesh = new THREE.Mesh(woodMerged.geometry, createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.28, 0.5, 0.76], tone: true, crease: true, id: 31 }));
    woodMesh.name = "planks";
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;
    group.add(woodMesh);
    rigs.push(createRigidParts(woodMerged.geometry, woodMerged.partOf, 7));
  }
  if (glow.length) {
    const colors = p.model === "cassettes" ? COLORS.map((c) => [DATA_GLOWS[c], 2]) : [["amber", 2]];
    const glowMesh = new THREE.Mesh(mergeParts(glow.map((g) => [g, FIXED])).geometry, glowMixMaterial(colors, { id: 40 }));
    glowMesh.name = "lights";
    group.add(glowMesh);
  }

  // --- Mouvement : roues qui tournent, roulettes qui pivotent, timon.
  const swivel = [rng.range(-Math.PI, Math.PI), rng.range(-Math.PI, Math.PI)];
  const tmp = new THREE.Matrix4();
  const turnAbout = (m, point, rotation) => m.multiply(tmp.makeTranslation(point.x, point.y, point.z)).multiply(rotation).multiply(tmp.makeTranslation(-point.x, -point.y, -point.z));
  const rot = new THREE.Matrix4();
  const cart = {
    distance: 0,
    drawbar: 0,
    handle: heavy ? new THREE.Vector3() : new THREE.Vector3(-S.L / 2 - 0.07, S.handle, 0),
    /** Le chariot a avancé de `d` m le long de son x local : les roues tournent, les roulettes suivent la marche. */
    roll(d) {
      cart.distance += d;
      if (d > 0) swivel.fill(0);
      else if (d < 0) swivel.fill(Math.PI);
      update();
    },
    /** Timon du chariot lourd : 0 = horizontal, négatif = vers le sol, positif = relevé (radians). */
    setDrawbar(angle) {
      cart.drawbar = angle;
      update();
    },
  };
  function update() {
    for (const rig of rigs) {
      for (const { A, r, part, caster } of wheels) {
        const m = rig.matrices[part].identity();
        if (caster) turnAbout(m, caster.pivot, rot.makeRotationY(swivel[caster.part - 4]));
        turnAbout(m, A, rot.makeRotationZ(-cart.distance / r));
        if (caster) turnAbout(rig.matrices[caster.part].identity(), caster.pivot, rot.makeRotationY(swivel[caster.part - 4]));
      }
      if (heavy) turnAbout(rig.matrices[DRAWBAR].identity(), heavyPivot, rot.makeRotationZ(cart.drawbar));
      rig.apply();
    }
    if (heavy) cart.handle.copy(heavyTip).sub(heavyPivot).applyAxisAngle(new THREE.Vector3(0, 0, 1), cart.drawbar).add(heavyPivot);
  }
  cart.distance = rng.range(0, 3); // les boulons ne sont pas tous au même endroit
  if (heavy) {
    // Baissé : l'anneau touche presque le sol ; relevé : presque droit, appuyé.
    const down = -Math.asin(Math.min(1, (heavyPivot.y - 0.07) / heavyTip.distanceTo(heavyPivot)));
    cart.drawbar = p.drawbar === "up" ? 1.38 + rng.range(-0.08, 0.04) : down + rng.range(0, 0.04);
  }
  update();

  group.userData.cart = cart;
  group.userData.surfaces = S.shelves.map((y) => ({ y, size: [S.L - 0.06, S.D - 0.06], center: [0, 0] }));
  group.userData.surface = group.userData.surfaces[group.userData.surfaces.length - 1];
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
