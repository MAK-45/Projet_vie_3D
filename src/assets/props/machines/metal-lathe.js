// Tour à métaux à courroie de l'Atelier du Complexe (fiche ATE-02, docs/complexe/) : 1,6 × 0,6 × 1,25 m. Banc de
// fonte sur pieds, tête à broche portant le mandrin Ø 0,20 m (trois mors) et la poulie étagée à trois gorges
// (disques de 2 à 5 px), courroie de cuir qui descend vers la petite poulie du bas, contre-pointe à l'autre bout
// et petit volant de réglage. En marche, le mandrin et la poulie tournent (à 12 images/s, par crans) ; le volant
// suit lentement. La graine change le nombre de mors visibles, l'appareil de bordage (restes de métal autour
// d'une pièce en cours), la position de la contre-pointe, les tons de la fonte.
// `group.userData.lathe` : { running, angle, setRunning(bool) }.
//
// 3 draw calls : fonte (banc, tête, contre-pointe, volant), laiton des pièces tournantes, courroie (cuir).

import * as THREE from "three";
import { createToonMaterial, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads, buildRibbon } from "../../kit/geometry.js";
import { FABRICS, METALS } from "../../kit/palettes.js";
import { PX, beam, createRigidParts, mergeParts, mergeToned, metalMaterial, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const STATES = { idle: "À l'arrêt", running: "En marche" };
const FIXED = 255;
const TURN = Math.PI * 2 / 1.4; // un tour de broche en 1,4 s
// Courroie de cuir goudronné : cuir plus clair au bord.
const BELT = { ramp: ["#221610", "#3a2718", "#57402a", "#75593b"], ink: "#120a06" };

const params = {
  seed: seedParam("Change les mors du mandrin visibles, la pièce en cours de tournage, la position de la contre-pointe, le crantage de la poulie, les tons de la fonte."),
  state: choiceParam("État", STATES, "À l'arrêt, ou en marche : le mandrin et la poulie tournent, le volant suit."),
  // `kind` absent : un seul tour, celui de l'Atelier.
};

export const meta = {
  id: "props/machines/metal-lathe",
  name: "Tour à métaux à courroie",
  nameEn: "Belt-driven metal lathe",
  category: "props",
  subcategory: "machines",
  description:
    "Tour à métaux de l'Atelier du Complexe : banc de fonte, mandrin à trois mors, poulie étagée à trois gorges " +
    "entraînée par une courroie de cuir, contre-pointe et petit volant. En marche, le mandrin et la poulie " +
    "tournent. Fiche ATE-02.",
  tags: [
    "tour", "tour à métaux", "mandrin", "poulie étagée", "courroie", "contre-pointe", "volant", "fonte",
    "laiton", "usinage", "atelier", "le complexe", "complexe", "ancien-tech", "machine", "animé", "pilotable",
    "intérieur",
    "lathe", "metal lathe", "chuck", "stepped pulley", "belt", "tailstock", "handwheel", "cast iron",
    "machining", "workshop", "ancient complex", "ancient-tech", "animated", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre du banc ; broche vers +x",
  footprint: { radius: 1.15, height: 1.3 },
  animated: ["spindle"],
  params,
  variants: variantsOf("state", params.state),
};

/**
 * Crée le tour.
 * @param {{seed?: number, state?: string}} [given]
 * @returns {THREE.Group} `group.userData.lathe` : { running, angle, setRunning(bool) }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 701);
  const iron = [], brass = [], belt = [];
  const AX = 1.02; // hauteur de l'axe de broche
  const spindle = new THREE.Vector3(-0.4, AX, 0); // mandrin
  const pulleyAxis = new THREE.Vector3(-0.98, AX, 0); // poulie étagée
  const wheel = new THREE.Vector3(0.82, AX, 0); // volant de la contre-pointe

  // --- Banc de fonte : deux pieds pleins, entretoise, table sur laquelle tout est posé.
  const ironTone = rng.range(-0.05, 0.05);
  for (const sx of [-1, 1]) {
    iron.push(withTone(buildBlock([0.34, 0.5, 0.6], [sx * 0.55, 0.25, 0]), (x, y, z, nx, ny) => ironTone + (ny > 0.5 ? 0.06 : -0.08)));
    iron.push(withTone(buildBlock([0.4, 0.035, 0.66], [sx * 0.55, 0.018, 0]), -0.25));
  }
  iron.push(withTone(buildBlock([0.9, 0.07, 0.36], [0, 0.42, 0]), -0.12));
  iron.push(withTone(buildBlock([1.6, 0.12, 0.52], [0, 0.56, 0]), (x, y, z, nx, ny) => ironTone + (ny > 0.5 ? 0.12 : -0.05)));
  // La table de glissement au-dessus (les prisme du banc) : deux glissières claires à un ton près.
  iron.push(withTone(buildBlock([1.6, 0.09, 0.4], [0, 0.66, 0]), (x, y, z, nx, ny) => ironTone + (Math.abs(ny) > 0.5 ? 0.22 : -0.05)));
  iron.push(withTone(buildBlock([1.6, 0.05, 0.05], [0, 0.73, 0.17]), 0.4));
  iron.push(withTone(buildBlock([1.6, 0.05, 0.05], [0, 0.73, -0.17]), 0.35));

  // --- Tête à broche : carter de fonte, mandrin à trois mors (pièce 0 : il tourne).
  iron.push(withTone(buildBlock([0.3, 0.42, 0.42], [-0.55, 0.98, 0]), (x, y, z, nx, ny) => ironTone + (nx !== 0 ? 0.05 : -0.1)));
  const chuckBody = plain(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 12)).rotateZ(Math.PI / 2).translate(spindle.x, spindle.y, spindle.z);
  brass.push([withTone(chuckBody, (x, y, z, nx) => (Math.abs(nx) > 0.5 ? 0.15 : 0.3)), 0]);
  for (let j = 0; j < 3; j++) {
    const a = (j / 3) * Math.PI * 2 + rng.range(-0.3, 0.3);
    // Trois mors autour de l'axe de broche : construits dans le plan x (tournés vers l'axe), puis répartis.
    const jaw = buildBlock([0.045, 0.05, 0.055], [spindle.x - 0.04 + rng.range(-0.006, 0.006), spindle.y, spindle.z], [0, 0, 0]);
    jaw.translate(0, 0.062, 0);
    // Rotation autour de la ligne de broche (x, à la hauteur du mandrin) : T(pivot) · R · T(−pivot).
    const pivot = new THREE.Matrix4().makeTranslation(0, spindle.y, 0);
    jaw.applyMatrix4(pivot.clone().multiply(new THREE.Matrix4().makeRotationX(a)).multiply(pivot.clone().invert()));
    brass.push([withTone(jaw, 0.45), 0]);
  }
  // Rondelle claire excentrée : la rotation se lit d'une image à l'autre.
  brass.push([withTone(plain(new THREE.CylinderGeometry(PX * 0.5, PX * 0.5, 0.012, 5)).rotateZ(Math.PI / 2).translate(spindle.x, spindle.y + 0.055, spindle.z), 0.6), 0]);
  // Pièce en cours (la graine) : un petit cylindre de cuivre tenu dans le mandrin, ou rien.
  if (rng.chance(0.6)) {
    const len = rng.range(0.12, 0.3), r = rng.range(0.015, 0.028);
    brass.push([withTone(plain(new THREE.CylinderGeometry(r, r, len, 7)).rotateZ(Math.PI / 2).translate(spindle.x + 0.045 + len / 2, spindle.y, spindle.z), 0.55), FIXED]);
  }

  // --- Poulie étagée à trois gorges (pièce 1) sur le bout de la broche, et la courroie vers le bas.
  const steps = [0.028, 0.042, 0.056];
  for (let i = 0; i < steps.length; i++) {
    const disc = plain(new THREE.CylinderGeometry(steps[i], steps[i], 0.05, 12)).rotateZ(Math.PI / 2).translate(pulleyAxis.x + i * 0.056, AX, 0);
    brass.push([withTone(disc, (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.1 : 0.2)), 1]);
  }
  brass.push([withTone(plain(new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6)).rotateZ(Math.PI / 2).translate(pulleyAxis.x + 0.028, AX, 0), 0.05), FIXED]);
  // Petite poulie motrice en bas, à l'avant du banc, et la courroie de cuir incurvée qui les réunit.
  const motorAt = new THREE.Vector3(pulleyAxis.x, AX - 0.028, 0.36);
  iron.push(withTone(plain(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 10)).rotateZ(Math.PI / 2).translate(pulleyAxis.x, 0.66 + 0.03, 0.24), 0.05));
  // Courroie : deux rubans plats (aller au-dessus, retour dessous), quart de tour vers la petite poulie.
  for (const s of [-1, 1]) {
    const a = new THREE.Vector3(pulleyAxis.x + s * 0.02, AX + (s > 0 ? steps[1] : -steps[1]), 0);
    const b = new THREE.Vector3(pulleyAxis.x + s * 0.02, 0.72, 0.24);
    belt.push(buildRibbonOf(a, b, s > 0 ? 1 : -1));
  }
  function buildRibbonOf(a, b, side) {
    const pts = [], nrm = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const z = a.z + (b.z - a.z) * t + Math.sin(t * Math.PI) * 0.02 * (side > 0 ? -1 : 1);
      pts.push(new THREE.Vector3(x, y, z));
      nrm.push(new THREE.Vector3(0, 0, 1));
    }
    return withTone(buildRibbon(pts, nrm, 0.03), 0.1);
  }

  // --- Contre-pointe : coulisseau de fonte, pointe de laiton qui rentre dedans, volant (pièce 2) à son bout.
  const tailX = rng.range(0.28, 0.5);
  iron.push(withTone(buildBlock([0.2, 0.36, 0.34], [-0.06 + tailX + 0.06, 0.98, 0]), (x, y, z, nx, ny) => ironTone + (ny > 0.5 ? 0.06 : -0.1)));
  brass.push([withTone(plain(new THREE.CylinderGeometry(0.012, 0.003, 0.14, 6)).rotateZ(-Math.PI / 2).translate(tailX - 0.12, AX, 0), 0.4), FIXED]);
  const handwheel = plain(new THREE.TorusGeometry(0.075, 0.016, 5, 12)).rotateY(Math.PI / 2).translate(wheel.x - 0.06, AX, 0);
  brass.push([withTone(handwheel, 0.2), 2]);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const spoke = buildBlock([0.014, 0.014, 0.14], [wheel.x - 0.06, AX, 0], [Math.PI / 2, a, 0]);
    brass.push([withTone(spoke, 0.35), 2]);
  }
  brass.push([withTone(plain(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8)).rotateZ(Math.PI / 2).translate(wheel.x - 0.11, AX, 0), 0.0), FIXED]);

  // --- Barre de calage latérale (support d'outil) : un petit berceau de fonte à l'avant.
  iron.push(withTone(buildBlock([0.16, 0.035, 0.05], [0.05, 0.87, 0.22]), 0.1));

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const ironMesh = new THREE.Mesh(mergeToned(iron), metalMaterial(METALS.castIron, { id: 30, tone: true }));
  ironMesh.name = "iron";
  group.add(ironMesh);
  const brassMerged = mergeParts(brass);
  const brassMesh = new THREE.Mesh(brassMerged.geometry, metalMaterial(METALS.blackenedBrass, { id: 31, tone: true }));
  brassMesh.name = "brass";
  const rig = createRigidParts(brassMerged.geometry, brassMerged.partOf, 3);
  group.add(brassMesh);
  const beltMesh = new THREE.Mesh(mergeToned(belt), createToonMaterial({ ramp: BELT.ramp, ink: BELT.ink, steps: [0.3, 0.55, 0.8], tone: true, id: 32 }));
  beltMesh.name = "belt";
  group.add(beltMesh);
  for (const mesh of [ironMesh, brassMesh, beltMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }

  // --- Marche : mandrin et poulie tournent autour de x, le volant suit lentement.
  const tmp = new THREE.Matrix4();
  const turnAbout = (m, point, rotation) => m.identity().multiply(tmp.makeTranslation(point.x, point.y, point.z)).multiply(rotation).multiply(tmp.makeTranslation(-point.x, -point.y, -point.z));
  const rot = new THREE.Matrix4();
  const lathe = {
    running: p.state === "running",
    angle: rng.range(0, Math.PI * 2),
    setRunning(on) {
      lathe.running = !!on;
    },
  };
  function pose() {
    const a = lathe.angle;
    turnAbout(rig.matrices[0], spindle, rot.makeRotationX(-a));
    turnAbout(rig.matrices[1], pulleyAxis, rot.makeRotationX(-a));
    turnAbout(rig.matrices[2], wheel, rot.makeRotationX(-a * 0.08));
    rig.apply();
  }
  pose();
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let last = -1;
  group.updateMatrixWorld = (force) => {
    const time = Math.floor(sharedUniforms.uTime.value * 12) / 12;
    if (time !== last) {
      if (last >= 0 && lathe.running) {
        lathe.angle += Math.min(0.25, time - last) * TURN;
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
