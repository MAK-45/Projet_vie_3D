// Touret de câble de l'Atelier du Complexe (fiche ATE-08, docs/complexe/PIECES.md) : Ø 1,2 × 0,7 m.
// Deux joues de bois en planches (marches d'un pixel sur le pourtour, tons alternés) cerclées de fer, plaque de moyeu à
// trou carré et quatre boulons ; entre elles, le câble en spires d'un pixel à tons alternés, plus ou moins entamé (le
// fût de bois apparaît quand il en reste peu). Le bout libre descend au sol et serpente sur 1,5 m.
// Debout (roule) ou couché sur une joue. Cuivre nu ou gainé de tissu goudronné.
// La graine change le tracé du bout libre, les tons des planches, le tour du touret (boulons), les spires du dessus.
//
// 3 draw calls : bois, fer, câble. Le touret (joues, fût, spires) tourne d'un bloc : `userData.reel.setTurn(angle)`.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe } from "../../kit/geometry.js";
import { FABRICS, METALS, WOODS } from "../../kit/palettes.js";
import { PX, cable, createRigidParts, mergeParts, metalMaterial, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const FILLS = { full: "Plein", half: "À moitié", low: "Presque vide" };
const POSES = { standing: "Debout (sur la tranche)", lying: "Couché sur une joue" };
const CABLES = { copper: "Cuivre nu", sheathed: "Gainé de tissu goudronné" };
// Gaine de tissu goudronné, un peu plus claire que le cuir pour que les spires se lisent sur le fond sombre.
const SHEATH = { ramp: ["#141016", "#2a2226", "#463a36", "#6a5848"], ink: "#0a0809" };

const params = {
  seed: seedParam("Change le tracé du bout libre, les tons des planches, le tour du touret (boulons), les spires du dessus."),
  fill: choiceParam("Câble", FILLS, "Touret plein, à moitié, ou presque vide (le fût de bois apparaît)."),
  pose: choiceParam("Pose", POSES, "Debout sur la tranche (il peut rouler) ou couché à plat sur une joue."),
  cable: choiceParam("Gaine", CABLES, "Câble de cuivre nu, ou gainé de tissu goudronné."),
};

export const meta = {
  id: "props/machines/cable-reel",
  name: "Touret de câble",
  nameEn: "Cable reel",
  category: "props",
  subcategory: "machines",
  description:
    "Touret de l'Atelier du Complexe : deux joues de planches cerclées de fer, moyeu à trou carré, câble de cuivre en " +
    "spires serrées dont le bout libre serpente au sol sur 1,5 m. Plein, à moitié ou presque vide ; debout ou couché ; " +
    "cuivre nu ou gainé. Fiche ATE-08.",
  tags: [
    "touret", "bobine", "câble", "cuivre", "spires", "joues", "planches", "cercle de fer", "moyeu", "gaine",
    "tissu goudronné", "atelier", "le complexe", "complexe", "ancien-tech", "machine", "intérieur",
    "cable reel", "cable drum", "spool", "copper wire", "coils", "flanges", "planks", "iron hoop", "hub", "sheath",
    "tarred cloth", "workshop", "ancient complex", "ancient-tech", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol sous le centre du touret ; debout, l'axe suit x et le bout libre part vers +z",
  footprint: { radius: 2.1, height: 1.25 },
  animated: [],
  params,
  variants: [
    { id: "full", name: "Plein, debout", params: {} },
    { id: "half", name: "À moitié", params: { fill: "half" } },
    { id: "low-lying", name: "Presque vide, couché", params: { fill: "low", pose: "lying" } },
    { id: "sheathed", name: "Câble gainé", params: { cable: "sheathed" } },
  ],
};

const R = 0.6, HALF = 0.35, FLANGE = 0.05, CORE = 0.2;
// Couché, le touret repose sur la plaque de moyeu de sa joue basse.
const LIFT = HALF + 0.045;

/**
 * Crée le touret.
 * @param {{seed?: number, fill?: string, pose?: string, cable?: string}} [given]
 * @returns {THREE.Group} `userData.reel` : { setTurn(angle), axis, center, freeEnd }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 4703 + 389);
  // Le touret est dessiné l'axe vertical (y), centré sur l'origine ; on le couche ou le pose ensuite.
  const wood = [], iron = [], wire = [];
  const radius = { full: 0.53, half: 0.39, low: 0.25 }[p.fill];
  for (const side of [-1, 1]) {
    const y = side * (HALF - FLANGE / 2);
    // Joue : huit planches à tons alternés, longueur prise sur le cercle (le pourtour fait des marches d'un pixel).
    const t0 = rng.range(-0.06, 0.06);
    for (let i = 0; i < 8; i++) {
      const x = -R + 0.075 + i * 0.15;
      const chord = 2 * Math.sqrt(Math.max(0, R * R - (Math.abs(x) + 0.035) ** 2));
      wood.push(withTone(buildBlock([0.145, FLANGE, chord], [x, y, 0]), (xx, yy, zz, nx, ny) => t0 + (i % 2 ? 0.1 : -0.06) + (Math.abs(ny) > 0.5 ? 0.08 : -0.1)));
    }
    // Deux traverses clouées en croix sur la face extérieure.
    for (const a of [0, Math.PI / 2]) {
      const g = buildBlock([0.08, 0.025, 2 * R - 0.16], [0, y + side * (FLANGE / 2 + 0.0125), 0]);
      g.rotateY(a + 0.25);
      wood.push(withTone(g, t0 - 0.12));
    }
    // Cercle de fer autour de la joue, plaque de moyeu, trou carré, boulons.
    iron.push(withTone(plain(buildLathe([[R - 0.005, -FLANGE / 2 - 0.004], [R + 0.022, -FLANGE / 2 - 0.004], [R + 0.022, FLANGE / 2 + 0.004], [R - 0.005, FLANGE / 2 + 0.004]], { segments: 20, facets: true })).translate(0, y, 0), 0));
    const plate = y + side * (FLANGE / 2 + 0.03);
    iron.push(withTone(buildBlock([0.22, 0.012, 0.22], [0, plate, 0], [0, 0.785, 0]), 0.1));
    iron.push(withTone(buildBlock([0.08, 0.004, 0.08], [0, plate + side * 0.007, 0], [0, 0.785, 0]), -1.0));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      iron.push(withTone(buildBlock([0.025, 0.02, 0.025], [Math.cos(a) * 0.32, y + side * (FLANGE / 2 + 0.01), Math.sin(a) * 0.32]), 0.25));
    }
  }
  // Fût de bois entre les joues (se voit quand le câble est entamé).
  wood.push(withTone(plain(new THREE.CylinderGeometry(CORE, CORE, 2 * (HALF - FLANGE), 10)), -0.2));
  // Spires : douze anneaux d'un pixel à tons alternés ; les dernières du dessus sont un peu plus basses (graine).
  const n = 12, inner = HALF - FLANGE, step = (2 * inner) / n;
  const short = rng.int(0, 5);
  for (let i = 0; i < n; i++) {
    const r = radius - (i >= n - short ? rng.range(0.02, 0.045) : 0);
    const g = plain(new THREE.CylinderGeometry(r, r, step, 16));
    g.translate(0, -inner + step * (i + 0.5), 0);
    wire.push(withTone(g, (x, y, z, nx, ny) => (i % 2 ? 0.08 : -0.12) + (Math.abs(ny) > 0.5 ? -0.25 : 0)));
  }

  // Pose : debout, l'axe passe en x et le centre à 0,6 m (+ le cercle) ; couché, la joue du bas touche le sol.
  const spin = rng.range(0, Math.PI * 2);
  const place = new THREE.Matrix4();
  if (p.pose === "lying") place.makeTranslation(0, LIFT, 0).multiply(new THREE.Matrix4().makeRotationY(spin));
  else place.makeTranslation(0, R + 0.022, 0).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationY(spin));
  for (const list of [wood, iron, wire]) for (const g of list) g.applyMatrix4(place);

  // Bout libre : part de la masse de câble, descend au sol et serpente sur 1,5 m vers +z.
  const cr = PX * 0.45;
  const points = [];
  const xs = rng.range(-0.18, 0.18);
  if (p.pose === "lying") {
    const top = LIFT + rng.range(-0.15, 0.15);
    points.push([xs, top, radius - 0.01], [xs, top - 0.05, radius + 0.08], [xs * 1.2, cr + 0.05, radius + 0.2]);
  } else {
    const c = R + 0.022, a = 0.45;
    points.push([xs, c - Math.cos(a) * radius, Math.sin(a) * radius - 0.01], [xs, cr + 0.12, Math.sin(a) * radius + 0.12], [xs, cr, Math.sin(a) * radius + 0.32]);
  }
  const last = points[points.length - 1];
  const phase = rng.range(0, Math.PI * 2), amp = rng.range(0.12, 0.3), turn = rng.range(-0.5, 0.5);
  for (let k = 1; k <= 6; k++) {
    const t = k / 6;
    const along = 1.3 * t;
    points.push([last[0] + Math.sin(phase + t * 5) * amp * t + Math.sin(turn) * along, cr, last[2] + Math.cos(turn) * along]);
  }
  const freeEnd = new THREE.Vector3(...points[points.length - 1]);
  const free = withTone(cable(points, { radius: cr, sides: 5, segments: 40 }), 0.1);
  // Embout de bronze au bout du câble.
  const tip = withTone(plain(new THREE.CylinderGeometry(cr * 1.5, cr * 1.5, 0.08, 6)), 0.3);
  const dir = new THREE.Vector3().subVectors(freeEnd, new THREE.Vector3(...points[points.length - 2])).normalize();
  tip.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  tip.translate(freeEnd.x, freeEnd.y, freeEnd.z);
  iron.push(tip);

  // --- Maillages : le touret est la pièce rigide n° 0, le bout libre et son embout restent fixes.
  const center = new THREE.Vector3(0, p.pose === "lying" ? LIFT : R + 0.022, 0);
  const axis = p.pose === "lying" ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const woodParts = mergeParts(wood.map((g) => [g, 0]));
  const ironParts = mergeParts([[tip, 255], ...iron.filter((g) => g !== tip).map((g) => [g, 0])]);
  const wireParts = mergeParts([[free, 255], ...wire.map((g) => [g, 0])]);
  const group = new THREE.Group();
  group.name = meta.name;
  const cableMaterial = p.cable === "sheathed"
    ? createToonMaterial({ ramp: SHEATH.ramp, ink: SHEATH.ink, steps: [0.25, 0.48, 0.75], tone: true, id: 32 })
    : metalMaterial(METALS.copper, { id: 32, tone: true, steps: [0.28, 0.46, 0.68, 0.95] });
  const meshes = [
    ["wood", woodParts, createToonMaterial({ ramp: WOODS.oak.ramp, ink: WOODS.oak.ink, steps: [0.26, 0.48, 0.74], tone: true, crease: true, pattern: "speckle", patternParams: [16, 0.05, 0.12, 1], seed: p.seed % 97, id: 20 })],
    ["iron", ironParts, metalMaterial(METALS.iron, { id: 30, tone: true })],
    ["cable", wireParts, cableMaterial],
  ].map(([name, parts, material]) => {
    const mesh = new THREE.Mesh(parts.geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return createRigidParts(mesh.geometry, parts.partOf, 1);
  });
  const rotation = new THREE.Matrix4();
  const setTurn = (angle) => {
    rotation.makeTranslation(center.x, center.y, center.z)
      .multiply(new THREE.Matrix4().makeRotationAxis(axis, angle))
      .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
    for (const rig of meshes) {
      rig.matrices[0].copy(rotation);
      rig.apply();
    }
  };
  group.userData.reel = { setTurn, axis, center, freeEnd, radius: R };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
