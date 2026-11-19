// Tabouret du Complexe (fiches ARC-08 et ATE-10, docs/complexe/PIECES.md).
// - Lecture (Archives) : 0,40 × 0,40 × 0,48 m, assise carrée de cuir goudronné bordée d'une rangée de clous de laiton
//   (points d'un pixel), sur trois pieds de bronze qui se croisent sous l'assise (une bague à la croisée) ; sans dossier.
// - Atelier : 0,65 m de haut, assise ronde de bois noirci (Ø 0,35 m, 2 ou 3 planches, joints d'un pixel), trois pieds
//   de bronze écartés, repose-pieds en anneau à 0,25 m.
// La graine change l'écart et l'orientation des pieds, la hauteur (± 3 cm), l'usure du cuir, les clous qui manquent,
// les planches et leur fente. `group.userData.seats` : où un personnage s'assoit.
//
// 2 draw calls : bronze (pieds, cadre, clous, anneau), assise (cuir ou bois).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe } from "../../kit/geometry.js";
import { FABRICS, METALS, WOODS } from "../../kit/palettes.js";
import { PX, beam, gridBlock, mergeToned, metalMaterial, plain, ring, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = {
  reading: "Lecture (cuir clouté, pieds croisés)",
  workshop: "Atelier (bois, repose-pieds)",
};

const params = {
  seed: seedParam("Change l'écart et l'orientation des pieds, la hauteur, l'usure du cuir et les clous qui manquent, ou les planches et la fente du bois."),
  model: choiceParam("Modèle", MODELS, "Tabouret de lecture des Archives (cuir clouté, trois pieds croisés) ou d'atelier (assise ronde de bois, repose-pieds)."),
};

export const meta = {
  id: "furniture/seating/bronze-stool",
  name: "Tabouret de bronze",
  nameEn: "Bronze stool",
  category: "furniture",
  subcategory: "seating",
  description:
    "Tabouret du Complexe sur trois pieds de bronze : tabouret de lecture des Archives à assise carrée de cuir " +
    "goudronné bordée de clous de laiton, pieds croisés sous l'assise ; ou tabouret d'atelier, plus haut, à assise " +
    "ronde de bois noirci et repose-pieds en anneau. Fiches ARC-08, ATE-10.",
  tags: [
    "tabouret", "assise", "siège", "trois pieds", "bronze", "cuir", "clous", "bois noirci", "repose-pieds", "lecture",
    "atelier", "le complexe", "complexe", "ancien-tech", "mobilier", "s'asseoir", "intérieur",
    "stool", "seat", "tripod", "leather", "studs", "blackened wood", "footrest", "reading", "workshop",
    "ancient complex", "ancient-tech", "furniture", "sit", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unité = 1 mètre ; origine au sol, sous le centre de l'assise ; on s'y assoit face à +z",
  footprint: { radius: 0.3, height: 0.66 },
  animated: [],
  params,
  variants: variantsOf("model", params.model),
};

/**
 * Crée le tabouret.
 * @param {{seed?: number, model?: string}} [given]
 * @returns {THREE.Group} `group.userData.seats` : [{ position: Vector3, facing: Vector3 }]
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 211);
  const reading = p.model === "reading";
  const bronze = [], seat = [];
  const H = (reading ? 0.48 : 0.65) + rng.int(-1, 1) * 0.03 * (reading ? 0.6 : 1);
  const yaw = rng.range(0, Math.PI * 2 / 3);
  const leg = PX * 0.62;

  if (reading) {
    // --- Assise carrée : coussin de cuir posé sur un cadre de bronze ; rangée de clous sur les quatre tranches.
    const S = 0.4, cushion = 0.075, frame = 0.035;
    const frameY = H - cushion - frame;
    bronze.push(withTone(buildBlock([S - 0.03, frame, S - 0.03], [0, frameY + frame / 2, 0]), -0.1));
    const wearX = rng.range(-0.06, 0.06), wearZ = rng.range(-0.04, 0.08);
    const wear = rng.range(0.25, 0.45);
    seat.push(withTone(gridBlock([S, cushion, S], [0, H - cushion / 2, 0], { cell: 0.07 }), (x, y, z) => {
      if (y < H - 0.01) return -0.05;
      return -0.12 + wear * Math.max(0, 1 - Math.hypot((x - wearX) / 0.15, (z - wearZ) / 0.13)) ** 0.9;
    }));
    // Bourrelet : le bord du dessus un pixel plus haut que le creux (le cuir s'est tassé au milieu).
    for (const [w, d, x, z] of [[S, PX * 0.5, 0, S / 2 - PX * 0.25], [S, PX * 0.5, 0, -S / 2 + PX * 0.25], [PX * 0.5, S - PX, S / 2 - PX * 0.25, 0], [PX * 0.5, S - PX, -S / 2 + PX * 0.25, 0]]) {
      seat.push(withTone(buildBlock([w, 0.012, d], [x, H + 0.006, z]), 0.1));
    }
    // Clous : un tous les 8 cm, quelques-uns tombés (selon la graine).
    const nails = 5;
    for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      for (let i = 0; i < nails; i++) {
        if (rng.chance(0.14)) continue;
        const t = -S / 2 + ((i + 0.5) * S) / nails;
        const x = nx ? nx * (S / 2 + 0.004) : t, z = nz ? nz * (S / 2 + 0.004) : t;
        const size = [nx ? 0.008 : PX * 0.55, PX * 0.55, nz ? 0.008 : PX * 0.55];
        bronze.push(withTone(buildBlock(size, [x, H - cushion * 0.45, z]), 0.55));
      }
    }
    // --- Trois pieds croisés : chacun part d'un coin du cadre et touche le sol de l'autre côté ; bague à la croisée.
    const splay = rng.range(0.16, 0.2);
    const top = 0.14;
    const cross = frameY * (splay / (splay + top)); // hauteur où les trois pieds passent par l'axe
    for (let i = 0; i < 3; i++) {
      const a = yaw + (i * Math.PI * 2) / 3;
      const c = Math.cos(a), s = Math.sin(a);
      const from = [c * top, frameY + 0.005, s * top];
      const to = [-c * splay, 0.018, -s * splay];
      bronze.push(withTone(beam(from, to, leg, leg, a), i % 2 ? 0.05 : -0.05));
      // Patin au pied.
      bronze.push(withTone(buildBlock([0.05, 0.02, 0.05], [to[0], 0.01, to[2]], [0, -a, 0]), -0.15));
    }
    bronze.push(withTone(plain(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8)).translate(0, cross, 0), 0.25));
  } else {
    // --- Assise ronde de bois : 2 ou 3 planches (joints d'un pixel) sur un cœur sombre ; une fente selon la graine.
    const R = 0.175, thick = 0.05;
    const planks = rng.int(2, 3);
    const cut = rng.range(0, Math.PI);
    const dir = new THREE.Vector2(Math.cos(cut), Math.sin(cut));
    const crack = rng.chance(0.5) ? rng.int(0, planks - 1) : -1;
    const plankTone = Array.from({ length: planks }, () => rng.range(-0.1, 0.1));
    const disc = buildLathe([[0, H - thick], [R, H - thick], [R, H - thick * 0.25], [R - 0.012, H], [0, H]], { segments: 14, facets: true });
    seat.push(withTone(disc, (x, y, z) => {
      const u = (x * dir.x + z * dir.y) / (2 * R) + 0.5; // 0..1 en travers des planches
      const k = Math.min(planks - 1, Math.floor(u * planks));
      const joint = Math.abs(u * planks - Math.round(u * planks)) < 0.05 && Math.round(u * planks) % planks !== 0;
      let t = plankTone[k] + (y > H - 0.005 ? 0.05 : -0.08);
      if (joint) t -= 0.6;
      return t;
    }));
    // Joints : des traits sombres posés sur le dessus, en travers.
    for (let k = 1; k < planks; k++) {
      const off = -R + (2 * R * k) / planks;
      const half = Math.sqrt(Math.max(0, R * R - off * off)) - 0.01;
      seat.push(withTone(buildBlock([2 * half, 0.004, PX * 0.35], [dir.x * off, H + 0.002, dir.y * off], [0, -cut + Math.PI / 2, 0]), -0.75));
    }
    if (crack >= 0) {
      const off = -R + (2 * R * (crack + 0.5)) / planks + rng.range(-0.02, 0.02);
      const len = rng.range(0.08, 0.14);
      seat.push(withTone(buildBlock([len, 0.004, PX * 0.3], [dir.x * off + dir.y * 0.04, H + 0.002, dir.y * off - dir.x * 0.04], [0, -cut + Math.PI / 2, 0]), -0.6));
    }
    // Platine de bronze sous l'assise, où s'attachent les pieds.
    bronze.push(withTone(plain(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 9)).translate(0, H - thick - 0.015, 0), -0.1));
    // --- Trois pieds écartés, repose-pieds en anneau.
    const splay = rng.range(0.21, 0.26);
    const topR = 0.07;
    const footY = 0.25 + rng.range(-0.02, 0.03);
    const legAt = (a, y) => {
      const t = y / (H - thick - 0.03);
      const r = splay + (topR - splay) * t;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    };
    for (let i = 0; i < 3; i++) {
      const a = yaw + (i * Math.PI * 2) / 3;
      bronze.push(withTone(beam(legAt(a, 0.015), legAt(a, H - thick - 0.03), leg, leg, -a), i % 2 ? 0.05 : -0.05));
      const foot = legAt(a, 0.01);
      bronze.push(withTone(buildBlock([0.05, 0.02, 0.05], [foot[0], 0.01, foot[2]], [0, -a, 0]), -0.15));
    }
    const rr = Math.hypot(legAt(0, footY)[0], legAt(0, footY)[2]);
    bronze.push(withTone(ring({ radius: rr - PX * 0.3, height: PX * 0.55, y: footY - PX * 0.27, thickness: PX * 0.6, segments: 12 }), (x, y) => (y > footY ? 0.3 : 0.05)));
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const bronzeMesh = new THREE.Mesh(mergeToned(bronze), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronzeMesh.name = "frame";
  const seatMaterial = reading
    ? createToonMaterial({ ramp: FABRICS.tarredLeather.ramp, ink: FABRICS.tarredLeather.ink, steps: [0.3, 0.55, 0.8], tone: true, crease: true, id: 31 })
    : createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, id: 31 });
  const seatMesh = new THREE.Mesh(mergeToned(seat), seatMaterial);
  seatMesh.name = "seat";
  for (const mesh of [bronzeMesh, seatMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.seats = [{ position: new THREE.Vector3(0, H, 0), facing: new THREE.Vector3(0, 0, 1) }];
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
