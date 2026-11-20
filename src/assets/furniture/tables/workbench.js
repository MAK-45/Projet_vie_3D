// Établis de l'Atelier du Complexe (fiches ATE-01 et ATE-14, docs/complexe/PIECES.md).
// - Établi central : 2,6 × 0,9 × 0,92 m, plateau de chêne noirci de 0,08 m en planches, plaque de bronze encastrée
//   (1,0 × 0,6 m) plus claire, étau de laiton bien visible (mâchoires de 2 px, vis à manche en T), deux tiroirs à
//   poignée d'un pixel dans la ceinture, pieds carrés et traverse basse.
// - Établi d'horloger : 1,2 × 0,7 × 0,95 m, plateau échancré en U (on s'assoit dans l'échancrure), rebord d'un pixel
//   sur trois côtés, rangée de 12 mini-tiroirs au fond, deux caissons à tiroirs dessous, petit étau, et la loupe
//   binoculaire du lot 7 (props/tools/arm-magnifier) posée sur son socle.
// Encombrement : rangé, servi (quelques outils, une pièce dans l'étau, de la limaille), en plein travail.
// La graine change les tons des planches, le côté de l'étau, les taches d'huile, le tiroir entrouvert, la place des
// objets. `group.userData.vise.setOpen(t, secondes)` ouvre (1) ou serre (0) l'étau ; `userData.surface` : le dessus.
//
// 2 draw calls (bois, bronze), plus les 2 de la loupe sur l'établi d'horloger.

import * as THREE from "three";
import { createToonMaterial, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads } from "../../kit/geometry.js";
import { METALS, WOODS } from "../../kit/palettes.js";
import {
  PX, beam, createRigidParts, gearWheel, gridBlock, mergeParts, metalMaterial, plain, ring, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";
import * as armMagnifier from "../../props/tools/arm-magnifier.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = {
  central: "Établi central (2,6 m, étau, plaque de bronze)",
  watchmaker: "Établi d'horloger (plateau en U, mini-tiroirs, loupe)",
};
const CLUTTERS = {
  used: "Servi (quelques outils, une pièce dans l'étau)",
  tidy: "Rangé (rien dessus)",
  busy: "En plein travail (chargé)",
};
// largeur, profondeur, hauteur du dessus, épaisseur du plateau
const SIZES = { central: [2.6, 0.9, 0.92, 0.08], watchmaker: [1.2, 0.7, 0.95, 0.06] };
const FIXED = 255;
const JAW = 0, HANDLE = 1; // pièces mobiles de l'étau

const params = {
  seed: seedParam("Change les tons des planches, le côté de l'étau, les taches d'huile, le tiroir entrouvert, la place des outils et des pièces."),
  kind: choiceParam("Modèle", KINDS, "Établi central de l'Atelier, ou établi d'horloger du coin sud-est."),
  clutter: choiceParam("Encombrement", CLUTTERS, "Ce qui traîne dessus : rien, quelques outils et une pièce serrée dans l'étau, ou tout un chantier."),
};

export const meta = {
  id: "furniture/tables/workbench",
  name: "Établi",
  nameEn: "Workbench",
  category: "furniture",
  subcategory: "tables",
  description:
    "Établi de l'Atelier du Complexe, en chêne noirci : établi central à plateau de planches, plaque de bronze " +
    "encastrée, étau de laiton à vis et deux tiroirs ; ou établi d'horloger à plateau échancré, rangée de mini-tiroirs " +
    "et loupe binoculaire. Rangé, servi ou en plein travail ; l'étau s'ouvre et se serre. Fiches ATE-01, ATE-14.",
  tags: [
    "établi", "établi d'horloger", "étau", "plateau", "chêne noirci", "plaque de bronze", "tiroirs", "mini-tiroirs",
    "loupe", "outils", "limaille", "taches d'huile", "atelier", "le complexe", "complexe", "ancien-tech", "mobilier",
    "pilotable", "intérieur",
    "workbench", "watchmaker bench", "vise", "bench top", "blackened oak", "bronze plate", "drawers", "small drawers",
    "magnifier", "tools", "metal filings", "oil stains", "workshop", "ancient complex", "ancient-tech", "furniture",
    "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre de l'établi ; l'avant (tiroirs, étau, échancrure) regarde +z",
  footprint: { radius: 1.45, height: 1.4 },
  animated: ["vise"],
  params,
  variants: [
    { id: "central", name: "Central, servi", params: {} },
    { id: "central-busy", name: "Central, en plein travail", params: { clutter: "busy" } },
    { id: "watchmaker", name: "Horloger, servi", params: { kind: "watchmaker" } },
    { id: "watchmaker-tidy", name: "Horloger, rangé", params: { kind: "watchmaker", clutter: "tidy" } },
  ],
};

/**
 * Crée l'établi.
 * @param {{seed?: number, kind?: string, clutter?: string}} [given]
 * @returns {THREE.Group} `group.userData.vise` : { open, setOpen(t 0..1, secondes = 0), jaws: Vector3 } ;
 *   `group.userData.surface` : { y, size: [largeur, profondeur] } (dessus du plateau)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 211);
  const [W, D, H, T] = SIZES[p.kind];
  const watch = p.kind === "watchmaker";
  const wood = [], metal = [];
  const y0 = H - T;
  const front = D / 2;
  const level = { tidy: 0, used: 1, busy: 2 }[p.clutter];

  // --- Plateau : planches dans la longueur, un ton chacune, joints d'un pixel ; dessus un cran plus bas pour que
  // l'usure remonte ; taches d'huile sombres. Horloger : en U (échancrure devant, au milieu).
  const notch = watch ? { w: 0.44, d: 0.28 } : null;
  const planks = watch ? 3 : rng.int(4, 5);
  const plankTone = Array.from({ length: planks }, () => rng.range(-0.08, 0.08));
  const plankAt = (z) => Math.min(planks - 1, Math.max(0, Math.floor(((z + D / 2) / D) * planks)));
  const stains = Array.from({ length: watch ? 1 : rng.int(2, 4) }, () => ({
    x: rng.range(-0.42, 0.42) * W, z: rng.range(-0.3, 0.3) * D, r: rng.range(0.08, 0.17),
  }));
  const topTone = (x, y, z, nx, ny) => {
    let t = plankTone[plankAt(z)];
    if (ny > 0.5) {
      t -= 0.1;
      if (Math.abs(z) < D * 0.25) t += 0.07; // l'avant du plateau, frotté
      for (const s of stains) if (Math.hypot(x - s.x, (z - s.z) * 1.4) < s.r) t -= 0.32;
    } else if (ny < -0.5) t -= 0.3;
    return t;
  };
  const tops = notch
    ? [
      [[W, T, D - notch.d], [0, y0 + T / 2, -notch.d / 2]],
      [[(W - notch.w) / 2, T, notch.d], [-(W + notch.w) / 4, y0 + T / 2, front - notch.d / 2]],
      [[(W - notch.w) / 2, T, notch.d], [(W + notch.w) / 4, y0 + T / 2, front - notch.d / 2]],
    ]
    : [[[W, T, D], [0, y0 + T / 2, 0]]];
  for (const [size, at] of tops) wood.push([withTone(gridBlock(size, at, { cell: 0.1 }), topTone), FIXED]);
  // Joints entre planches : un trait sombre d'un pixel sur le dessus et sur la tranche avant.
  const joints = [];
  for (let k = 1; k < planks; k++) {
    const z = -D / 2 + (k * D) / planks;
    if (notch && z > front - notch.d) {
      for (const s of [-1, 1]) joints.push({ position: [s * (W + notch.w) / 4, H + 0.001, z], size: [(W - notch.w) / 2 - 0.01, PX * 0.4], normal: [0, 1, 0], tone: -0.55 });
    } else joints.push({ position: [0, H + 0.001, z], size: [W - 0.01, PX * 0.4], normal: [0, 1, 0], tone: -0.55 });
  }
  if (joints.length) wood.push([buildQuads(joints), FIXED]);

  // --- Piètement : pieds carrés, ceinture sous le plateau, traverse basse ; tons un peu plus sombres que le plateau.
  const legW = watch ? 0.07 : 0.11;
  const legX = W / 2 - legW / 2 - 0.05, legZ = D / 2 - legW / 2 - 0.05;
  const apron = watch ? 0.07 : 0.11;
  const legTone = (x, y, z, nx, ny) => -0.12 + (ny > 0.5 ? 0.1 : 0) - 0.1 * (1 - Math.min(1, y / 0.3));
  if (!watch) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) wood.push([withTone(buildBlock([legW, y0, legW], [sx * legX, y0 / 2, sz * legZ]), legTone), FIXED]);
    // Ceinture devant, derrière et sur les côtés.
    wood.push([withTone(buildBlock([2 * legX, apron, 0.03], [0, y0 - apron / 2, legZ + legW / 2 - 0.015]), -0.08), FIXED]);
    wood.push([withTone(buildBlock([2 * legX, apron, 0.03], [0, y0 - apron / 2, -legZ - legW / 2 + 0.015]), -0.15), FIXED]);
    for (const sx of [-1, 1]) wood.push([withTone(buildBlock([0.03, apron, 2 * legZ], [sx * (legX + legW / 2 - 0.015), y0 - apron / 2, 0]), -0.12), FIXED]);
    // Traverses basses : deux longues et deux courtes, à 0,18 m ; une planche posée dessus (étagère basse).
    for (const sz of [-1, 1]) wood.push([withTone(buildBlock([2 * legX, 0.07, 0.05], [0, 0.18, sz * legZ]), legTone), FIXED]);
    for (const sx of [-1, 1]) wood.push([withTone(buildBlock([0.05, 0.07, 2 * legZ], [sx * legX, 0.18, 0]), legTone), FIXED]);
    wood.push([withTone(buildBlock([2 * legX - 0.2, 0.025, 2 * legZ - 0.06], [0, 0.225, 0]), (x, y, z, nx, ny) => (ny > 0.5 ? -0.15 : -0.3)), FIXED]);
  }

  // --- Tiroirs : façade plate un peu en saillie, poignée de bronze d'un pixel ; un entrouvert selon la graine.
  const drawer = (cx, cy, w, h, z, ajar, tone = -0.02) => {
    const out = ajar ? rng.range(0.08, 0.16) : 0;
    if (ajar) wood.push([withTone(buildBlock([w - 0.03, h - 0.02, out + 0.02], [cx, cy, z - 0.01 + out / 2]), (x, y, zz, nx, ny) => (ny > 0.5 ? -0.55 : -0.3)), FIXED]);
    wood.push([withTone(buildBlock([w, h, 0.02], [cx, cy, z + out + 0.01]), tone + 0.12), FIXED]);
    metal.push([withTone(buildBlock([Math.min(w * 0.4, PX * 2), PX * 0.6, 0.02], [cx, cy, z + out + 0.03]), 0.35), FIXED]);
  };

  if (!watch) {
    const ajar = rng.int(-1, 1); // −1 : aucun, sinon le tiroir entrouvert
    for (const [k, s] of [[0, -1], [1, 1]]) drawer(s * W * 0.2, y0 - apron / 2, 0.55, apron - 0.025, legZ + legW / 2, ajar === k);
  } else {
    // Deux caissons sous les bras du U, trois tiroirs chacun ; une plinthe sombre.
    const cw = (W - notch.w) / 2 - 0.04;
    const ajar = rng.int(0, 5);
    for (const [k, s] of [[0, -1], [1, 1]]) {
      const cx = s * (notch.w / 2 + cw / 2 + 0.02);
      wood.push([withTone(buildBlock([cw, y0 - 0.06, D - 0.08], [cx, 0.06 + (y0 - 0.06) / 2, -0.01]), (x, y, z, nx, ny) => -0.18 + (ny > 0.5 ? 0.1 : 0)), FIXED]);
      wood.push([withTone(buildBlock([cw - 0.04, 0.06, D - 0.12], [cx, 0.03, -0.01]), -0.6), FIXED]);
      const dh = (y0 - 0.1) / 3;
      for (let r = 0; r < 3; r++) drawer(cx, y0 - 0.02 - dh / 2 - r * dh, cw - 0.04, dh - 0.03, D / 2 - 0.05, ajar === k * 3 + r, -0.02 + (r % 2) * 0.04);
    }
    // Fond de l'échancrure (panneau sous le plateau) et rebord d'un pixel sur trois côtés du plateau.
    wood.push([withTone(buildBlock([notch.w, y0 - 0.35, 0.02], [0, 0.35 + (y0 - 0.35) / 2, front - notch.d - 0.02]), -0.35), FIXED]);
    const lip = PX * 0.5, lh = 0.025;
    metal.push([withTone(buildBlock([W, lh, lip], [0, H + lh / 2, -D / 2 + lip / 2]), 0.05), FIXED]);
    for (const s of [-1, 1]) metal.push([withTone(buildBlock([lip, lh, D - lip], [s * (W / 2 - lip / 2), H + lh / 2, lip / 2]), 0.15), FIXED]);
    // Rangée de 12 mini-tiroirs au fond du plateau : un caisson bas, 2 rangs de 6 façades d'1 × 2 px, boutons clairs.
    const mw = W - 0.12, mh = 0.16, md = 0.14;
    const mz = -D / 2 + lip + md / 2;
    wood.push([withTone(buildBlock([mw, mh, md], [0, H + mh / 2, mz]), (x, y, z, nx, ny) => (ny > 0.5 ? -0.02 : -0.4)), FIXED]);
    const faces = [], knobs = [];
    const fw = mw / 6, fh = mh / 2;
    const pulled = level > 0 ? rng.int(0, 11) : -1;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
      const x = -mw / 2 + fw * (c + 0.5), y = H + fh * (r + 0.5);
      const k = r * 6 + c;
      const out = k === pulled ? 0.05 : 0;
      if (out) wood.push([withTone(buildBlock([fw - PX * 0.6, fh - PX * 0.6, out], [x, y, mz + md / 2 + out / 2]), -0.5), FIXED]);
      faces.push({ position: [x, y, mz + md / 2 + 0.002 + out], size: [fw - PX * 0.55, fh - PX * 0.55], normal: [0, 0, 1], tone: rng.range(-0.06, 0.08) + (r ? 0.04 : 0) });
      knobs.push({ position: [x, y, mz + md / 2 + 0.004 + out], size: [PX * 0.6, PX * 0.6], normal: [0, 0, 1], tone: 0.5 });
    }
    wood.push([buildQuads(faces), FIXED]);
    metal.push([buildQuads(knobs), FIXED]);
  }

  // --- Plaque de bronze encastrée (établi central) : un ton plus clair que le bois, cadre de rivets aux angles.
  const viseSide = rng.chance(0.5) ? 1 : -1;
  if (!watch) {
    const px = -viseSide * W * 0.17, pz = -D * 0.08;
    metal.push([withTone(gridBlock([1.0, 0.012, 0.6], [px, H + 0.002, pz], { cell: 0.1 }), (x, y, z, nx, ny) => {
      if (ny < 0.5) return -0.2;
      let t = 0;
      for (const s of stains) if (Math.hypot(x - s.x, (z - s.z) * 1.4) < s.r * 0.8) t -= 0.25;
      return t + (Math.hypot(x - px, z - pz) < 0.2 ? 0.08 : 0);
    }), FIXED]);
    const rivets = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) rivets.push({ position: [px + sx * 0.46, H + 0.0085, pz + sz * 0.26], size: [PX * 0.6, PX * 0.6], normal: [0, 1, 0], tone: 0.45 });
    metal.push([buildQuads(rivets), FIXED]);
  }

  // --- Étau de laiton au bord avant : semelle, mors fixe, mors mobile, vis et manche en T (pièces 0 et 1).
  const vs = watch ? 0.5 : 1; // échelle de l'étau de l'horloger
  const vx = watch ? viseSide * (W / 2 - 0.12) : viseSide * (W / 2 - 0.42);
  const jw = 0.3 * vs, jh = 0.15 * vs, jt = 0.07 * vs, drop = 0.14 * vs; // mors : largeur, hauteur, épaisseur ; le mobile descend sous le plateau
  const jawZ = front + 0.04 * vs; // face avant du mors fixe : l'étau dépasse du bord du plateau
  const vise = { open: 0, jaws: new THREE.Vector3(vx, H + jh / 2, jawZ), minGap: (watch ? 0.006 : 0.012), maxGap: 0.16 * vs };
  const brass = (top, side) => (x, y, z, nx, ny) => (ny > 0.5 ? top : side);
  // Fixe : semelle sur le plateau, mors fixe (le dessus au plus clair), corps de fonte sous le bord avant.
  metal.push([withTone(buildBlock([0.16 * vs, 0.045 * vs, 0.3 * vs], [vx, H + 0.0225 * vs, jawZ - 0.15 * vs]), brass(0.05, -0.3)), FIXED]);
  metal.push([withTone(buildBlock([jw, jh, jt], [vx, H + jh / 2, jawZ - jt / 2]), brass(0.45, 0.18)), FIXED]);
  metal.push([withTone(buildBlock([jw * 0.6, 0.11 * vs, 0.12 * vs], [vx, y0 - 0.055 * vs, front - 0.04 * vs]), -0.45), FIXED]);
  // Mobile (pièce JAW) : grand mors debout devant le plateau, plus haut et plus bas que lui ; la vis vers l'avant.
  const jz = jawZ + vise.minGap + jt / 2;
  const screwY = H - drop / 2;
  metal.push([withTone(buildBlock([jw, jh + drop, jt], [vx, H + (jh - drop) / 2, jz]), (x, y, z, nx, ny, nzz) => (ny > 0.5 ? 0.45 : nzz > 0.5 ? 0.25 : 0.05)), JAW]);
  metal.push([withTone(buildBlock([jw + 0.01, PX * 0.6, jt + 0.01], [vx, H - drop * 0.15, jz]), -0.5), JAW]); // bague sombre
  const hub = new THREE.Vector3(vx, screwY, jz + jt / 2 + 0.12 * vs);
  metal.push([withTone(beam([vx, screwY, jz + jt / 2], hub, PX * 0.7 * Math.max(vs, 0.7), PX * 0.7 * Math.max(vs, 0.7), Math.PI / 4), 0.3), JAW]);
  // Manche en T (pièce HANDLE) : moyeu, barre de 0,36 m, deux boules ; il tourne avec la vis.
  metal.push([withTone(plain(new THREE.CylinderGeometry(0.03 * vs + 0.006, 0.03 * vs + 0.006, 0.04 * vs, 8)).rotateX(Math.PI / 2).translate(hub.x, hub.y, hub.z), 0.15), HANDLE]);
  metal.push([withTone(beam([vx - 0.18 * vs, hub.y, hub.z], [vx + 0.18 * vs, hub.y, hub.z], PX * 0.6, PX * 0.6), 0.35), HANDLE]);
  for (const s of [-1, 1]) metal.push([withTone(plain(new THREE.SphereGeometry(0.022 * vs + 0.008, 6, 4)).translate(vx + s * 0.19 * vs, hub.y, hub.z), -0.45), HANDLE]);
  const handleSpin = rng.range(0.6, 1.2);

  // --- Ce qui traîne : silhouettes de 2 à 4 px, en bois et en bronze (outils, pièces, limaille, fils).
  const tools = [];
  const free = (x0, x1, z0, z1, r) => {
    for (let tries = 0; tries < 12; tries++) {
      const x = rng.range(x0, x1), z = rng.range(z0, z1);
      if (Math.abs(x - vx) < 0.25 && z > jawZ - 0.25) continue;
      if (tools.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + r)) {
        tools.push({ x, z, r });
        return [x, z];
      }
    }
    return null;
  };
  const hammer = (x, z, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    wood.push([withTone(beam([x - c * 0.18, H + 0.02, z - s * 0.18], [x + c * 0.14, H + 0.02, z + s * 0.14], 0.04, 0.035), 0.5), FIXED]);
    metal.push([withTone(buildBlock([0.06, 0.06, 0.17], [x + c * 0.17, H + 0.03, z + s * 0.17], [0, -a, 0]), brass(0.15, -0.35)), FIXED]);
  };
  const file = (x, z, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    metal.push([withTone(beam([x - c * 0.1, H + 0.01, z - s * 0.1], [x + c * 0.16, H + 0.01, z + s * 0.16], 0.04, 0.018), brass(0.1, -0.4)), FIXED]);
    wood.push([withTone(beam([x - c * 0.22, H + 0.018, z - s * 0.22], [x - c * 0.1, H + 0.018, z - s * 0.1], 0.04, 0.035), 0.5), FIXED]);
  };
  const gear = (x, z, r) => {
    const g = gearWheel({ teeth: r > 0.07 ? 10 : 8, module: (r * 2) / (r > 0.07 ? 10 : 8), depth: 0.016, spokes: 0 });
    g.rotateX(-Math.PI / 2).translate(x, H + 0.002, z);
    metal.push([withTone(g, (xx, y, zz, nx, ny) => (ny > 0.5 ? 0.25 : -0.1)), FIXED]);
  };
  const coil = (x, z) => {
    metal.push([withTone(ring({ radius: 0.05, height: 0.03, y: H, thickness: 0.022, segments: 10 }).translate(x, 0, z), (xx, y, zz, nx, ny) => (ny > 0.5 ? 0.4 : 0)), FIXED]);
  };
  const box = (x, z, a) => {
    wood.push([withTone(buildBlock([0.2, 0.07, 0.14], [x, H + 0.035, z], [0, a, 0]), (xx, y, zz, nx, ny) => (ny > 0.5 ? 0.1 : -0.15)), FIXED]);
    metal.push([withTone(buildBlock([0.21, 0.012, 0.012], [x, H + 0.06, z], [0, a, 0]), 0.2), FIXED]);
  };
  const filings = (x, z, n, spread) => {
    const bits = [];
    for (let i = 0; i < n; i++) bits.push({ position: [x + rng.range(-spread, spread), H + 0.0015, z + rng.range(-spread, spread) * 0.7], size: [PX * 0.4, PX * 0.4], normal: [0, 1, 0], tone: rng.range(0.25, 0.6) });
    metal.push([buildQuads(bits), FIXED]);
  };
  const piece = (pz) => {
    // Pièce serrée dans l'étau : une barre de bronze ou une ébauche de roue debout.
    if (rng.chance(0.5)) {
      metal.push([withTone(buildBlock([0.05 * vs, 0.2 * vs, 0.022 * vs], [vx + rng.range(-0.04, 0.04) * vs, H + 0.1 * vs + 0.02, pz]), 0.2), FIXED]);
    } else {
      const g = gearWheel({ teeth: 10, module: 0.024 * vs, depth: 0.02 * vs, spokes: 3 });
      g.rotateY(Math.PI / 2).translate(vx - 0.01 * vs, H + jh + 0.04 * vs, pz);
      metal.push([withTone(g, 0.25), FIXED]);
    }
  };

  let gap = vise.minGap;
  if (level > 0) {
    // Une pièce dans l'étau : les mors s'écartent de son épaisseur.
    gap = 0.024 * vs;
    piece(jawZ + gap / 2);
    const xs = watch ? [-W / 2 + 0.1, W / 2 - 0.1] : [-W / 2 + 0.15, W / 2 - 0.15];
    const zs = watch ? [-D / 2 + 0.25, front - 0.06] : [-D / 2 + 0.12, front - 0.12];
    const n = level === 1 ? (watch ? 4 : 3) : (watch ? 7 : 7);
    for (let i = 0; i < n; i++) {
      const kind = watch ? ["gear", "gear", "coil", "filings", "box"][i % 5] : ["hammer", "file", "gear", "coil", "box", "filings", "gear"][i % 7];
      const r = { hammer: 0.2, file: 0.2, gear: watch ? 0.05 : 0.09, coil: 0.08, box: 0.15, filings: 0.1 }[kind];
      const spot = free(xs[0] + r, xs[1] - r, zs[0] + r * 0.5, zs[1] - r * 0.5, r);
      if (!spot) continue;
      const [x, z] = spot;
      if (watch && notch && Math.abs(x) < notch.w / 2 + r && z > front - notch.d - r * 0.5) continue; // pas dans l'échancrure
      const a = rng.range(-0.6, 0.6);
      if (kind === "hammer") hammer(x, z, a);
      else if (kind === "file") file(x, z, a);
      else if (kind === "gear") gear(x, z, watch ? rng.range(0.025, 0.04) : rng.range(0.05, 0.09));
      else if (kind === "coil") coil(x, z);
      else if (kind === "box") box(x, z, a);
      else filings(x, z, watch ? 6 : 10, 0.08);
    }
    filings(vx, jawZ + 0.05, watch ? 4 : 9, 0.1 * vs);
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const woodMerged = mergeParts(wood);
  const woodMesh = new THREE.Mesh(woodMerged.geometry, createToonMaterial({
    ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.26, 0.48, 0.74], tone: true, crease: true,
    pattern: "speckle", patternParams: [16, 0.05, 0.12, 1], seed: p.seed % 97, id: 20,
  }));
  woodMesh.name = "wood";
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE.Mesh(metalMerged.geometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  metalMesh.name = "bronze";
  for (const mesh of [woodMesh, metalMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const rig = createRigidParts(metalMerged.geometry, metalMerged.partOf, 2);

  // Loupe binoculaire de l'horloger, sur son socle au fond à gauche, penchée vers l'échancrure.
  if (watch) {
    const loupe = armMagnifier.create({ seed: p.seed, kind: "binocular", mount: "desk" });
    loupe.position.set(-viseSide * 0.3, H, -D / 2 + 0.28);
    loupe.name = "magnifier";
    loupe.userData.arm.setPose({ yaw: viseSide * rng.range(0.45, 0.75), pitch: 0.5, tilt: -0.5 });
    group.add(loupe);
  }

  // --- Étau : le mors mobile avance le long de +z ; le manche tourne d'un tour pour 6 mm de course.
  const tmp = new THREE.Matrix4();
  const time = () => sharedUniforms.uTime.value;
  let tween = null;
  const pose = (g) => {
    const d = g - vise.minGap;
    rig.matrices[JAW].makeTranslation(0, 0, d);
    rig.matrices[HANDLE].makeTranslation(0, 0, d).multiply(tmp.makeTranslation(hub.x, hub.y, hub.z)).multiply(tmp.makeRotationZ(handleSpin - (d / 0.006) * 0.35)).multiply(tmp.makeTranslation(-hub.x, -hub.y, -hub.z));
    rig.apply();
    vise.gap = g;
  };
  vise.setOpen = (t, seconds = 0) => {
    const target = vise.minGap + THREE.MathUtils.clamp(t, 0, 1) * (vise.maxGap - vise.minGap);
    vise.open = THREE.MathUtils.clamp(t, 0, 1);
    if (seconds > 0) tween = { from: vise.gap, to: target, start: time(), seconds };
    else {
      tween = null;
      pose(target);
    }
  };
  pose(gap);
  vise.open = (gap - vise.minGap) / (vise.maxGap - vise.minGap);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    if (tween) {
      const u = THREE.MathUtils.clamp((time() - tween.start) / tween.seconds, 0, 1);
      pose(tween.from + (tween.to - tween.from) * u * u * (3 - 2 * u));
      if (u >= 1) tween = null;
    }
    baseUpdate(force);
  };

  group.userData.vise = vise;
  group.userData.surface = { y: H, size: [W, D] };
  group.userData.asset = { id: meta.id, params: p };
  return group;

}
