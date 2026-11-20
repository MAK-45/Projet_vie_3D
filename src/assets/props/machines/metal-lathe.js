// Tour à métaux à courroie de l'Atelier du Complexe (fiche ATE-02, docs/complexe/PIECES.md) : 1,6 × 0,6 × 1,25 m.
// Banc de fonte sur deux pieds évasés avec bac à copeaux, poupée à gauche avec son mandrin de Ø 0,20 m (3 mors d'un
// pixel) et sa poulie étagée à 3 gorges ; une courroie de cuir descend vers un petit moteur à bobine de cuivre posé au
// sol ; chariot porte-outil sur le banc, vis-mère d'un pixel, contre-pointe à droite avec son petit volant.
// À l'arrêt ou en marche (12 images/s) : mandrin, pièce et poulies tournent, la courroie défile (bandes alternées),
// la bobine du moteur luit faiblement. Pièce serrée : aucune, une barre (entre mandrin et contre-pointe) ou une roue.
// La graine change la place du chariot et de la contre-pointe, l'usure, les copeaux, l'angle de départ du mandrin.
// `group.userData.lathe.setRunning(vrai | faux)`.
//
// 3 draw calls : fonte, bronze (mandrin, poulies, volants, moteur), cuir de la courroie.

import * as THREE from "three";
import { createToonMaterial, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe, buildPrism, buildQuads } from "../../kit/geometry.js";
import { FABRICS, METALS } from "../../kit/palettes.js";
import {
  PX, beam, createRigidParts, gearWheel, mergeParts, metalMaterial, plain, ring, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const STATES = { idle: "À l'arrêt", running: "En marche" };
const WORKS = { bar: "Une barre", gear: "Une roue dentée", none: "Rien" };
const FIXED = 255;
const SPINDLE = 0, DRIVE = 1, TAIL_WHEEL = 2;
const SPEED = Math.PI * 2 * 0.8; // tours de broche par seconde × 2π
const RATIO = 1.8; // la poulie du moteur, plus petite, tourne plus vite

const params = {
  seed: seedParam("Change la place du chariot et de la contre-pointe, l'usure de la fonte, les copeaux, l'angle de départ du mandrin."),
  state: choiceParam("État", STATES, "À l'arrêt, ou en marche : le mandrin, la pièce et les poulies tournent, la courroie défile."),
  work: choiceParam("Pièce", WORKS, "Ce qui est serré dans le mandrin : une barre tenue par la contre-pointe, une roue dentée, ou rien."),
};

export const meta = {
  id: "props/machines/metal-lathe",
  name: "Tour à métaux",
  nameEn: "Metal lathe",
  category: "props",
  subcategory: "machines",
  description:
    "Tour à métaux à courroie de l'Atelier du Complexe : banc de fonte sur pieds évasés, poupée à mandrin de bronze " +
    "et poulie étagée, courroie de cuir vers un petit moteur à bobine de cuivre, chariot porte-outil, contre-pointe " +
    "à volant. En marche, le mandrin, la pièce et les poulies tournent et la courroie défile. Fiche ATE-02.",
  tags: [
    "tour", "tour à métaux", "mandrin", "poulie étagée", "courroie", "cuir", "contre-pointe", "volant", "chariot",
    "banc de fonte", "copeaux", "moteur", "bobine", "atelier", "le complexe", "complexe", "ancien-tech", "machine",
    "animé", "pilotable", "intérieur",
    "lathe", "metal lathe", "chuck", "step pulley", "belt", "leather", "tailstock", "handwheel", "carriage",
    "cast iron bed", "metal chips", "motor", "coil", "workshop", "ancient complex", "ancient-tech", "machine tool",
    "animated", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre du banc ; l'axe de la broche suit x (poupée vers −x), l'opérateur se tient côté +z",
  footprint: { radius: 0.95, height: 1.25 },
  animated: ["spindle"],
  params,
  variants: [
    { id: "bar", name: "Une barre", params: {} },
    { id: "gear", name: "Une roue, en marche", params: { work: "gear", state: "running" } },
    { id: "none", name: "À vide", params: { work: "none" } },
  ],
};

/**
 * Crée le tour.
 * @param {{seed?: number, state?: string, work?: string}} [given]
 * @returns {THREE.Group} `group.userData.lathe` : { running, angle, setRunning(bool), operator: Vector3 }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 613);
  const iron = [], bronze = [], leather = [];
  const ironTone = (top = 0.08, side = -0.05) => (x, y, z, nx, ny) => (ny > 0.5 ? top : ny < -0.5 ? -0.3 : side);
  const wear = rng.range(-0.05, 0.05);

  // --- Pieds évasés (plus larges en bas) et bac à copeaux entre eux.
  const legX = 0.56, bedY = 0.82; // dessous du banc
  for (const s of [-1, 1]) {
    iron.push([withTone(buildBlock([0.2, bedY, 0.46], [s * legX, bedY / 2, 0], [0, 0, 0], { taper: 0.35 }), (x, y, z, nx, ny) => wear - 0.04 - 0.12 * (1 - Math.min(1, y / 0.4)) + (ny > 0.5 ? 0.1 : 0)), FIXED]);
    iron.push([withTone(buildBlock([0.26, 0.04, 0.5], [s * legX, 0.02, 0]), -0.2), FIXED]); // semelle
    iron.push([withTone(buildBlock([0.012, 0.3, 0.2], [s * (legX + 0.105), 0.4, 0.0]), -0.35), FIXED]); // trappe sombre sur le flanc
  }
  // Bac : un fond et quatre bords, à mi-hauteur des pieds.
  const tray = { y: 0.58, w: 2 * legX - 0.2, d: 0.4 };
  iron.push([withTone(buildBlock([tray.w, 0.03, tray.d], [0, tray.y, 0]), ironTone(-0.25, -0.1)), FIXED]);
  for (const s of [-1, 1]) iron.push([withTone(buildBlock([tray.w, 0.06, 0.02], [0, tray.y + 0.03, s * (tray.d / 2 - 0.01)]), ironTone(0.05, -0.05)), FIXED]);

  // --- Banc : deux glissières (le dessus poli plus clair) avec une fente sombre entre elles, une joue devant.
  const bedL = 1.6, bedTop = 0.92;
  iron.push([withTone(buildBlock([bedL, bedTop - bedY - 0.02, 0.3], [0, bedY + (bedTop - bedY - 0.02) / 2, 0]), ironTone(-0.6, -0.02)), FIXED]);
  for (const s of [-1, 1]) {
    iron.push([withTone(buildBlock([bedL, 0.03, 0.1], [0, bedTop - 0.015, s * 0.095]), (x, y, z, nx, ny) => (ny > 0.5 ? 0.22 + wear : -0.05)), FIXED]);
  }
  // Vis-mère : une tige d'un pixel le long de la joue avant, portée par deux paliers.
  bronze.push([withTone(beam([-0.72, 0.85, 0.17], [0.76, 0.85, 0.17], PX * 0.4, PX * 0.4, Math.PI / 4), 0.1), FIXED]);
  for (const x of [-0.7, 0.74]) iron.push([withTone(buildBlock([0.04, 0.06, 0.04], [x, 0.85, 0.16]), 0), FIXED]);

  // --- Poupée (−x) : caisson de fonte, couvercle, un godet d'huile ; broche sur l'axe x à la hauteur `axisY`.
  const axisY = 1.05, headX0 = -0.78, headX1 = -0.4;
  iron.push([withTone(buildBlock([headX1 - headX0, 0.3, 0.3], [(headX0 + headX1) / 2, bedTop + 0.15, 0]), ironTone(0.12, 0.0)), FIXED]);
  iron.push([withTone(buildBlock([headX1 - headX0 + 0.02, 0.03, 0.32], [(headX0 + headX1) / 2, bedTop + 0.315, 0]), ironTone(0.2, 0.05)), FIXED]);
  bronze.push([withTone(plain(new THREE.CylinderGeometry(0.02, 0.026, 0.05, 6)).translate(-0.5, bedTop + 0.355, 0.06), 0.3), FIXED]);
  for (const x of [headX0 + 0.005, headX1 - 0.005]) {
    bronze.push([withTone(plain(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8)).rotateZ(Math.PI / 2).translate(x, axisY, 0), 0.2), FIXED]); // paliers
  }

  // Broche (pièce SPINDLE) : mandrin à 3 mors côté +x, poulie étagée côté −x, et la pièce serrée.
  const spindleAt = new THREE.Vector3(0, axisY, 0);
  const chuckX = headX1 + 0.01, chuckR = 0.1;
  bronze.push([withTone(buildLathe([[0.03, 0], [chuckR, 0], [chuckR, 0.07], [chuckR - 0.015, 0.09], [0.03, 0.09]], { segments: 12, facets: true }).rotateZ(-Math.PI / 2).translate(chuckX, axisY, 0), (x, y, z, nx) => (nx > 0.5 ? 0.15 : 0.0)), SPINDLE]);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const jaw = buildBlock([0.03, 0.035, 0.035], [chuckX + 0.1, axisY + Math.cos(a) * 0.055, Math.sin(a) * 0.055], [-a, 0, 0]);
    bronze.push([withTone(jaw, 0.45), SPINDLE]);
  }
  // Repère clair sur la tranche du mandrin (pour voir le tour) et un trou de clé sombre.
  bronze.push([buildQuads([{ position: [chuckX + 0.045, axisY + chuckR + 0.002, 0], size: [0.05, PX * 0.7], normal: [0, 1, 0], tone: 0.7 }]), SPINDLE]);
  bronze.push([buildQuads([{ position: [chuckX + 0.0905, axisY - 0.07, 0.03], size: [PX * 0.6, PX * 0.6], normal: [1, 0, 0], tone: -0.9 }]), SPINDLE]);
  // Poulie étagée : 3 disques de Ø 0,12 à 0,26 m, gorges sombres entre eux.
  const steps = [0.13, 0.1, 0.07];
  steps.forEach((r, i) => {
    const x0 = headX0 - 0.03 - i * 0.05;
    bronze.push([withTone(plain(new THREE.CylinderGeometry(r, r, 0.04, 14)).rotateZ(Math.PI / 2).translate(x0 - 0.02, axisY, 0), (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.05 + i * 0.05 : 0.15)), SPINDLE]);
    bronze.push([withTone(plain(new THREE.CylinderGeometry(r - 0.02, r - 0.02, 0.012, 14)).rotateZ(Math.PI / 2).translate(x0 - 0.046, axisY, 0), -0.6), SPINDLE]);
  });
  bronze.push([buildQuads([{ position: [headX0 - 0.031, axisY + 0.085, 0], size: [PX * 0.8, PX * 0.8], normal: [1, 0, 0], tone: 0.8 }]), SPINDLE]);
  const tipX = chuckX + 0.13;
  let workEnd = tipX;
  if (p.work === "bar") {
    workEnd = rng.range(0.2, 0.42);
    bronze.push([withTone(plain(new THREE.CylinderGeometry(0.035, 0.035, workEnd - chuckX - 0.05, 8)).rotateZ(Math.PI / 2).translate((chuckX + 0.05 + workEnd) / 2, axisY, 0), (x, y, z, nx, ny) => (ny > 0.3 ? 0.4 : -0.05)), SPINDLE]);
    // Une gorge tournée (ton sombre) et un épaulement clair : le travail en cours.
    const gx = rng.range(chuckX + 0.25, workEnd - 0.1);
    bronze.push([withTone(plain(new THREE.CylinderGeometry(0.037, 0.037, 0.03, 8)).rotateZ(Math.PI / 2).translate(gx, axisY, 0), -0.55), SPINDLE]);
    bronze.push([buildQuads([{ position: [(chuckX + workEnd) / 2, axisY + 0.0365, 0.0], size: [0.06, PX * 0.5], normal: [0, 1, 0], tone: 0.9 }]), SPINDLE]);
  } else if (p.work === "gear") {
    const g = gearWheel({ teeth: 14, module: 0.022, depth: 0.05, spokes: 4 });
    g.rotateY(Math.PI / 2).translate(chuckX + 0.12, axisY, 0);
    bronze.push([withTone(g, (x, y, z, nx) => (Math.abs(nx) > 0.5 ? 0.3 : 0.05)), SPINDLE]);
    workEnd = chuckX + 0.17;
  }

  // --- Chariot porte-outil (sur les glissières) : traînard, tablier devant avec son volant, porte-outil et burin.
  const carriageX = p.work === "bar" ? rng.range(chuckX + 0.3, Math.max(chuckX + 0.32, workEnd - 0.12)) : rng.range(0.0, 0.25);
  iron.push([withTone(buildBlock([0.24, 0.05, 0.34], [carriageX, bedTop + 0.025, 0]), ironTone(0.15, 0.02)), FIXED]);
  iron.push([withTone(buildBlock([0.22, 0.18, 0.05], [carriageX, bedTop - 0.06, 0.19]), ironTone(0.12, 0.04)), FIXED]); // tablier
  iron.push([withTone(buildBlock([0.14, 0.05, 0.2], [carriageX, bedTop + 0.075, 0.03]), ironTone(0.15, 0)), FIXED]); // chariot transversal
  iron.push([withTone(buildBlock([0.07, 0.07, 0.07], [carriageX, bedTop + 0.135, 0.02]), ironTone(0.2, 0.05)), FIXED]); // tourelle
  bronze.push([withTone(beam([carriageX, axisY - 0.02, 0.06], [carriageX, axisY - 0.02, p.work === "none" ? -0.02 : 0.045], PX * 0.5, PX * 0.5), 0.6), FIXED]); // burin
  // Volant du tablier, tourné vers l'opérateur.
  bronze.push([withTone(ring({ radius: 0.05, height: 0.012, thickness: 0.014, segments: 10 }).rotateX(Math.PI / 2).translate(carriageX - 0.04, bedTop - 0.07, 0.225), 0.25), FIXED]);
  bronze.push([withTone(beam([carriageX - 0.04, bedTop - 0.07, 0.215], [carriageX - 0.04, bedTop - 0.07, 0.25], PX * 0.6, PX * 0.6), 0.1), FIXED]);
  bronze.push([withTone(beam([carriageX + 0.06, bedTop - 0.03, 0.215], [carriageX + 0.06, bedTop + 0.02, 0.26], PX * 0.45, PX * 0.45), 0.2), FIXED]); // levier d'embrayage

  // --- Contre-pointe (+x) : corps sur sa semelle, fourreau et pointe vers −x, petit volant à 4 rais (pièce TAIL_WHEEL).
  const tailX = p.work === "bar" ? workEnd + 0.14 : rng.range(0.5, 0.62);
  iron.push([withTone(buildBlock([0.24, 0.05, 0.26], [tailX, bedTop + 0.025, 0]), ironTone(0.12, 0)), FIXED]);
  iron.push([withTone(buildBlock([0.2, axisY - bedTop - 0.02, 0.17], [tailX, bedTop + 0.05 + (axisY - bedTop - 0.05) / 2, 0], [0, 0, 0], { taper: 0.15 }), ironTone(0.1, 0.02)), FIXED]);
  iron.push([withTone(plain(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10)).rotateZ(Math.PI / 2).translate(tailX + 0.01, axisY, 0), (x, y, z, nx, ny) => (ny > 0.3 ? 0.15 : -0.05)), FIXED]);
  // Fourreau et pointe : contre la barre, ou sortis de 0,12 m (rien entre les pointes).
  const quillEnd = p.work === "bar" ? workEnd + 0.01 : tailX - 0.22;
  bronze.push([withTone(plain(new THREE.CylinderGeometry(0.03, 0.03, tailX - 0.1 - quillEnd, 8)).rotateZ(Math.PI / 2).translate((tailX - 0.1 + quillEnd) / 2, axisY, 0), 0.2), FIXED]);
  bronze.push([withTone(plain(new THREE.ConeGeometry(0.03, 0.04, 6)).rotateZ(Math.PI / 2).translate(quillEnd - 0.02, axisY, 0), 0.5), FIXED]);
  const tailWheel = new THREE.Vector3(tailX + 0.17, axisY, 0);
  bronze.push([withTone(beam([tailX + 0.11, axisY, 0], [tailWheel.x, axisY, 0], PX * 0.6, PX * 0.6, Math.PI / 4), 0.1), FIXED]);
  bronze.push([withTone(ring({ radius: 0.065, height: 0.016, thickness: 0.016, segments: 12 }).rotateZ(Math.PI / 2).translate(tailWheel.x + 0.008, axisY, 0), 0.3), TAIL_WHEEL]);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    bronze.push([withTone(beam([tailWheel.x, axisY, 0], [tailWheel.x, axisY + Math.cos(a) * 0.066, Math.sin(a) * 0.066], PX * 0.35, PX * 0.35), 0.15), TAIL_WHEEL]);
  }
  const knobA = 0.4;
  bronze.push([withTone(beam([tailWheel.x, axisY + Math.cos(knobA) * 0.07, Math.sin(knobA) * 0.07], [tailWheel.x + 0.06, axisY + Math.cos(knobA) * 0.07, Math.sin(knobA) * 0.07], 0.022, 0.022), -0.5), TAIL_WHEEL]); // poignée

  // --- Moteur à bobine au sol, sous la poulie (côté −x) : socle, flasques, bobine de cuivre couchée sur l'axe x, petite
  // poulie dans le plan de la courroie (pièce DRIVE).
  const beltX = headX0 - 0.03 - 0.05 - 0.02; // gorge du milieu de la poulie étagée
  const motor = new THREE.Vector3(beltX + 0.13, 0.2, 0);
  iron.push([withTone(buildBlock([0.24, 0.05, 0.3], [motor.x, 0.025, 0]), ironTone(0.0, -0.15)), FIXED]);
  for (const s of [-1, 1]) iron.push([withTone(buildBlock([0.03, 0.26, 0.24], [motor.x + s * 0.1, 0.15, 0], [0, 0, 0], { taper: 0.2 }), ironTone(0.1, 0)), FIXED]);
  for (let k = 0; k < 5; k++) {
    bronze.push([withTone(plain(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 12)).rotateZ(Math.PI / 2).translate(motor.x - 0.068 + k * 0.034, motor.y, 0), (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.55 : (k % 2 ? 0.25 : 0.05))), FIXED]); // spires de cuivre
  }
  const driveR = 0.05;
  const drive = new THREE.Vector3(beltX, motor.y, 0);
  bronze.push([withTone(beam([beltX - 0.02, motor.y, 0], [motor.x - 0.1, motor.y, 0], PX * 0.6, PX * 0.6, Math.PI / 4), 0.1), FIXED]);
  bronze.push([withTone(plain(new THREE.CylinderGeometry(driveR, driveR, 0.045, 10)).rotateZ(Math.PI / 2).translate(drive.x, drive.y, drive.z), (x, y, z, nx) => (Math.abs(nx) > 0.5 ? 0.0 : 0.2)), DRIVE]);
  bronze.push([buildQuads([{ position: [drive.x - 0.023, drive.y + driveR * 0.55, 0], size: [PX * 0.7, PX * 0.7], normal: [-1, 0, 0], tone: 0.8 }]), DRIVE]);

  // --- Courroie de cuir : de la gorge du milieu de la poulie étagée (plan x) jusqu'à la poulie du moteur. Deux brins
  // droits en segments à tons alternés (ils « défilent » en marche), plus les arcs autour des poulies.
  const upper = new THREE.Vector3(beltX, axisY, 0);
  const lower = drive.clone();
  const beltSegments = [];
  const strand = (side) => {
    const r1 = steps[1] + 0.006, r2 = driveR + 0.006;
    const a = upper.clone().add(new THREE.Vector3(0, 0, side * r1));
    const b = lower.clone().add(new THREE.Vector3(0, 0, side * r2));
    const n = 10;
    for (let i = 0; i < n; i++) {
      const q0 = a.clone().lerp(b, i / n), q1 = a.clone().lerp(b, (i + 1) / n);
      const g = beam(q0, q1, 0.035, 0.012, 0, new THREE.Vector3(1, 0, 0));
      leather.push(g);
      beltSegments.push({ geometry: g, order: side > 0 ? i : n - 1 - i });
    }
  };
  strand(1);
  strand(-1);
  // Les arcs : un demi-anneau autour de la gorge du haut (dessus) et autour de la poulie du bas (dessous).
  const arc = (c, r, a0, a1) => {
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
      const q0 = new THREE.Vector3(c.x, c.y + Math.sin(t0) * r, c.z + Math.cos(t0) * r);
      const q1 = new THREE.Vector3(c.x, c.y + Math.sin(t1) * r, c.z + Math.cos(t1) * r);
      const g = beam(q0, q1, 0.035, 0.012, 0, new THREE.Vector3(1, 0, 0));
      leather.push(g);
      beltSegments.push({ geometry: g, order: i });
    }
  };
  arc(upper, steps[1] + 0.006, 0, Math.PI);
  arc(new THREE.Vector3(lower.x, lower.y, lower.z), driveR + 0.006, Math.PI, Math.PI * 2);

  // --- Copeaux : boucles claires dans le bac et quelques-uns au sol devant.
  const chips = [];
  for (let i = 0; i < rng.int(10, 18); i++) {
    const inTray = rng.chance(0.7);
    const x = inTray ? rng.range(-tray.w / 2 + 0.05, tray.w / 2 - 0.05) : rng.range(-0.5, 0.6);
    const z = inTray ? rng.range(-tray.d / 2 + 0.04, tray.d / 2 - 0.04) : rng.range(0.3, 0.55);
    chips.push({ position: [x, (inTray ? tray.y + 0.016 : 0.002), z], size: [PX * rng.range(0.5, 0.9), PX * 0.45], normal: [0, 1, 0], tone: rng.range(0.3, 0.7) });
  }
  bronze.push([buildQuads(chips), FIXED]);

  // --- Maillages : on met les pièces mobiles à la fin (seule leur plage repart au GPU).
  const sorted = (list) => [...list.filter(([, k]) => k === FIXED), ...list.filter(([, k]) => k !== FIXED)];
  const group = new THREE.Group();
  group.name = meta.name;
  const ironMesh = new THREE.Mesh(mergeParts(iron).geometry, metalMaterial(METALS.castIron, { id: 30, tone: true, grain: 0.05, seed: p.seed % 97 }));
  ironMesh.name = "iron";
  const bronzeMerged = mergeParts(sorted(bronze));
  const bronzeMesh = new THREE.Mesh(bronzeMerged.geometry, metalMaterial(METALS.patinatedBronze, { id: 31, tone: true }));
  bronzeMesh.name = "bronze";
  // Courroie : un ton par segment, réécrit quand elle défile.
  const beltGeometry = mergeParts(leather.map((g) => [withTone(g, 0), FIXED])).geometry;
  const beltMesh = new THREE.Mesh(beltGeometry, createToonMaterial({ ramp: ["#120c08", "#2b1d14", "#4a3424", "#6e4f36"], ink: FABRICS.tarredLeather.ink, steps: [0.3, 0.55, 0.8], tone: true, id: 32 }));
  beltMesh.name = "belt";
  for (const mesh of [ironMesh, bronzeMesh, beltMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const rig = createRigidParts(bronzeMerged.geometry, bronzeMerged.partOf, 3);
  const beltTone = beltGeometry.attributes.aTone;
  const ranges = [];
  {
    let offset = 0;
    for (const s of beltSegments) {
      ranges.push([offset, s.geometry.attributes.position.count, s.order]);
      offset += s.geometry.attributes.position.count;
    }
  }

  // --- Marche.
  const tmp = new THREE.Matrix4();
  const turnX = (m, c, a) => m.makeTranslation(c.x, c.y, c.z).multiply(tmp.makeRotationX(a)).multiply(tmp.makeTranslation(-c.x, -c.y, -c.z));
  const lathe = {
    running: p.state === "running",
    angle: rng.range(0, Math.PI * 2),
    /** Où se tient l'opérateur (repère de l'asset), face au chariot. */
    operator: new THREE.Vector3(carriageX - 0.1, 0, 0.75),
    setRunning(on) {
      lathe.running = !!on;
    },
  };
  let beltPhase = -1;
  const pose = () => {
    const a = lathe.angle;
    turnX(rig.matrices[SPINDLE], spindleAt, -a);
    turnX(rig.matrices[DRIVE], drive, -a * RATIO);
    turnX(rig.matrices[TAIL_WHEEL], tailWheel, 0);
    rig.apply();
    const phase = Math.floor((a / (Math.PI * 2)) * 6) % 2;
    if (phase !== beltPhase) {
      beltPhase = phase;
      for (const [start, count, order] of ranges) beltTone.array.fill((order + phase) % 2 ? -0.18 : 0.08, start, start + count);
      beltTone.needsUpdate = true;
    }
  };
  pose();
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let last = -1;
  group.updateMatrixWorld = (force) => {
    const time = Math.floor(sharedUniforms.uTime.value * 12) / 12;
    if (time !== last) {
      if (last >= 0 && lathe.running) {
        lathe.angle += Math.min(0.25, time - last) * SPEED;
        pose();
      }
      last = time;
    }
    baseUpdate(force);
  };

  group.userData.lathe = lathe;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
