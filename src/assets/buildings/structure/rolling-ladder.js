// Échelle roulante sur rail des Archives du Complexe (fiche ARC-04, docs/complexe/PIECES.md) : deux montants de
// laiton noirci inclinés d'une dizaine de degrés, des marches plates au pas de 0,30 m (une tous les 5 px : 16 pour
// 5 m), deux roulettes de fonte de 2 px au pied, deux crochets à galet en haut, accrochés à un rail de laiton posé
// sur la façade d'un rayonnage, à 0,2 m au-dessus du haut de l'échelle.
// La graine change l'inclinaison, la marche usée (plus claire), la place de l'échelle sur le rail, la patine.
// `group.userData.ladder` : pied, haut, marches (pour qu'un personnage y grimpe), et `setSlide(x)` pour la faire
// glisser le long du rail.
//
// 2 draw calls : laiton (montants, marches, crochets, rail), fonte (roulettes, galets, pattes du rail).

import * as THREE from "three";
import { buildBlock } from "../../kit/geometry.js";
import { METALS } from "../../kit/palettes.js";
import { PX, beam, createRigidParts, mergeParts, metalMaterial, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const RAILS = { on: "Avec son rail (3 m)", off: "Sans rail" };
const PITCH = 0.3; // pas des marches
const HALF = 0.27; // demi-écart des montants (0,6 m hors tout)
const RAIL_Z = 0.1; // le rail avance de 0,1 m devant la façade (z = 0)
const LADDER = 0;
const FIXED = 255;

const params = {
  seed: seedParam("Change l'inclinaison (9 à 12°), la marche usée, la place de l'échelle sur le rail, la patine du laiton."),
  height: numberParam("Hauteur", 5, 2.4, 5, "Hauteur du haut de l'échelle ; le rail est 0,2 m plus haut (5,2 m pour les rayonnages de 5,5 m).", { step: 0.3, unit: "m" }),
  rail: choiceParam("Rail", RAILS, "Avec son tronçon de rail de 3 m et ses pattes (posé sur la façade du rayonnage), ou l'échelle seule."),
  slide: numberParam("Position", 0, -1.2, 1.2, "Place de l'échelle le long du rail (0 : au milieu ; la graine la décale un peu). Pilotable : group.userData.ladder.setSlide(x).", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "buildings/structure/rolling-ladder",
  name: "Échelle roulante",
  nameEn: "Rolling library ladder",
  category: "buildings",
  subcategory: "structure",
  description:
    "Échelle de bibliothèque des Archives du Complexe : montants de laiton noirci inclinés, marches plates au pas de " +
    "0,30 m, roulettes de fonte au pied, crochets à galet accrochés à un rail de laiton posé sur la façade d'un " +
    "rayonnage. Glisse le long du rail ; donne ses marches pour qu'un personnage y grimpe. Fiche ARC-04.",
  tags: [
    "échelle", "échelle roulante", "bibliothèque", "rail", "laiton", "roulettes", "marches", "archives",
    "le complexe", "complexe", "ancien-tech", "praticable", "pilotable", "intérieur",
    "ladder", "rolling ladder", "library ladder", "guide rail", "brass", "casters", "rungs", "archive room",
    "ancient complex", "ancient-tech", "climbable", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units:
    "1 unité = 1 mètre ; origine au sol au pied de la façade du rayonnage (z = 0), au milieu du rail ; l'échelle " +
    "avance vers +z",
  footprint: { radius: 1.6, height: 5.25 },
  animated: [],
  params,
  variants: [
    { id: "full", name: "Grande, sur son rail", params: {} },
    { id: "short", name: "Courte (2,4 m)", params: { height: 2.4 } },
    { id: "alone", name: "Sans rail", params: { rail: "off" } },
  ],
};

/**
 * Crée l'échelle.
 * @param {{seed?: number, height?: number, rail?: string, slide?: number}} [given]
 * @returns {THREE.Group} `group.userData.ladder` : { foot, top, rungs: [{ y, z }], railY, slide, setSlide(x) }
 *   (repère de l'asset, l'échelle au milieu ; `slide` décale tout en x)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 101);
  const H = p.height;
  const railY = H + 0.2;
  const lean = THREE.MathUtils.degToRad(rng.range(9, 12));
  const wheelR = 0.05;
  // Le haut des montants touche le rail (un peu devant) ; le pied est au sol, plus loin du rayonnage.
  const topZ = RAIL_Z + 0.05;
  const footZ = topZ + (H - wheelR) * Math.tan(lean);
  const zAt = (y) => footZ + ((topZ - footZ) * (y - wheelR)) / (H - wheelR);
  const brass = [], iron = [];

  // --- Montants : un pan de laiton de 0,06 × 0,04, du pied au haut.
  for (const s of [-1, 1]) {
    const upright = beam([s * HALF, wheelR, footZ], [s * HALF, H, topZ], 0.06, 0.04, 0, new THREE.Vector3(1, 0, 0));
    brass.push([withTone(upright, (x, y) => (y < 0.4 ? -0.12 : 0) - 0.12 * THREE.MathUtils.smoothstep(y, 2, H)), LADDER]);
    // Sabot au pied, roulette de fonte de 2 px (axe x), et sa chape.
    brass.push([withTone(buildBlock([0.08, 0.08, 0.1], [s * HALF, wheelR + 0.04, footZ]), -0.2), LADDER]);
    const wheel = plain(new THREE.CylinderGeometry(wheelR, wheelR, 0.035, 8));
    wheel.rotateZ(Math.PI / 2);
    wheel.translate(s * HALF, wheelR, footZ + 0.01);
    iron.push([withTone(wheel, (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.1 : 0.15)), LADDER]);
    // Crochet : monte au-dessus du rail, passe par-dessus, retombe derrière, avec un galet posé sur le rail.
    const a = new THREE.Vector3(s * HALF, H - 0.02, topZ);
    const b = new THREE.Vector3(s * HALF, railY + 0.07, topZ - 0.01);
    const c = new THREE.Vector3(s * HALF, railY + 0.07, RAIL_Z - 0.06);
    const d = new THREE.Vector3(s * HALF, railY - 0.03, RAIL_Z - 0.06);
    for (const [u, v] of [[a, b], [b, c], [c, d]]) brass.push([withTone(beam(u, v, PX * 0.9, PX * 0.9), 0.08), LADDER]);
    const roller = plain(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8));
    roller.rotateZ(Math.PI / 2);
    roller.translate(s * HALF, railY + 0.035 + PX * 0.4, RAIL_Z);
    iron.push([withTone(roller, 0.1), LADDER]);
  }

  // --- Marches plates au pas de 0,30 m ; la graine en use une (plus claire, au milieu de la hauteur).
  const rungs = [];
  for (let y = PITCH; y <= H - 0.12; y += PITCH) rungs.push({ y, z: zAt(y) });
  const worn = rng.int(1, Math.max(1, Math.min(rungs.length - 1, 5)));
  rungs.forEach(({ y, z }, i) => {
    const tread = buildBlock([HALF * 2 - 0.04, PX * 0.8, 0.09], [0, y, z]);
    brass.push([withTone(tread, (px, py, pz, nx, ny) => (ny > 0.5 ? (i === worn ? 0.35 : 0.12) : -0.18)), LADDER]);
  });
  // Entretoise sous la 3e marche (rigidité), en croix d'un pixel.
  const brace = rungs[Math.min(2, rungs.length - 1)];
  brass.push([withTone(beam([-HALF, brace.y - 0.25, zAt(brace.y - 0.25) - 0.01], [HALF, brace.y - 0.02, brace.z - 0.01], PX * 0.6, PX * 0.6), -0.15), LADDER]);

  // --- Rail de 3 m et ses pattes de fonte, fixées à la façade (z = 0).
  if (p.rail === "on") {
    const rail = buildBlock([3, PX, PX], [0, railY, RAIL_Z]);
    brass.push([withTone(rail, (x, y, z, nx, ny) => (ny > 0.5 ? 0.2 : -0.05)), FIXED]);
    for (const x of [-1.4, 0, 1.4]) {
      iron.push([withTone(buildBlock([0.05, 0.05, RAIL_Z + 0.02], [x, railY - PX * 0.4, RAIL_Z / 2 - 0.01]), -0.05), FIXED]);
      iron.push([withTone(buildBlock([0.09, 0.14, 0.02], [x, railY - 0.03, 0.01]), -0.2), FIXED]);
    }
    for (const x of [-1.5, 1.5]) iron.push([withTone(buildBlock([0.04, 0.07, 0.05], [x, railY, RAIL_Z]), 0.1), FIXED]); // butées
  }

  // --- Maillages : l'échelle est une pièce rigide qui glisse en x.
  const group = new THREE.Group();
  group.name = meta.name;
  const brassMerged = mergeParts(brass);
  const ironMerged = mergeParts(iron);
  const brassMesh = new THREE.Mesh(brassMerged.geometry, metalMaterial(METALS.blackenedBrass, { id: 30, tone: true }));
  brassMesh.name = "brass";
  const ironMesh = new THREE.Mesh(ironMerged.geometry, metalMaterial(METALS.castIron, { id: 31, tone: true }));
  ironMesh.name = "iron";
  for (const mesh of [brassMesh, ironMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const rigs = [createRigidParts(brassMerged.geometry, brassMerged.partOf, 1), createRigidParts(ironMerged.geometry, ironMerged.partOf, 1)];
  const ladder = {
    foot: new THREE.Vector3(0, 0, footZ),
    top: new THREE.Vector3(0, H, topZ),
    rungs,
    railY,
    slide: 0,
    setSlide(x) {
      ladder.slide = THREE.MathUtils.clamp(x, -1.2, 1.2);
      for (const rig of rigs) {
        rig.matrices[LADDER].makeTranslation(ladder.slide, 0, 0);
        rig.apply();
      }
    },
  };
  ladder.setSlide(p.slide + rng.range(-0.25, 0.25));

  group.userData.ladder = ladder;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
