// Valve à volant du Complexe (fiches SAS-10 et COE-08, docs/complexe/) : un volant de fonte à rayons au bout d'une
// tige filetée, sur un corps de bronze traversé par un tuyau de cuivre, avec un petit cadran à aiguille.
// - murale (Sas) : volant de Ø 0,22 m à 5 rayons tourné vers la pièce, corps 0,35 × 0,20 × 0,30 m sur un bout de
//   tuyau tenu au mur ;
// - géante (salle du Cœur) : roue de Ø 0,9 m à 6 rayons et jante de bronze, couchée en haut d'une tige filetée
//   entre deux montants, corps 0,7 × 0,5 × 0,8 m sur un socle, gros tuyau à brides, plaque numérotée.
// On la fait tourner : réglage `turn` (0 fermée, 1 ouverte), `state` « en boucle » pour la regarder, et pilotage par
// le scénario avec `group.userData.valve.setTurn(t)` ou `.turnTo(t)` ; l'aiguille du cadran suit.
//
// 3 draw calls : bronze (corps, cadran, aiguille animée sur le CPU), fonte (volant, qui tourne), cuivre (tuyau).

import * as THREE from "three";
import { sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe } from "../../kit/geometry.js";
import { METALS } from "../../kit/palettes.js";
import {
  PX, beam, dial, faceMatrix, mergeToned, metalMaterial, orient, plain, ring, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const SIZES = { wall: "Murale (Ø 0,22 m)", giant: "Géante (roue de Ø 0,9 m)" };
const STATES = { still: "Immobile", cycle: "Tourne en boucle" };
const TURNS = 2; // tours de volant entre fermée et ouverte
const NEEDLE = 2.2; // débattement de l'aiguille de part et d'autre de midi (radians)

const params = {
  seed: seedParam("Change l'angle de repos du volant, l'aiguille, l'usure de la poignée, le numéro de la plaque, les tons."),
  size: choiceParam("Taille", SIZES, "Valve murale du Sas, ou valve géante de la salle du Cœur."),
  turn: numberParam("Ouverture", 0, 0, 1, "0 = fermée, 1 = ouverte (deux tours de volant) ; l'aiguille du cadran suit.", { step: 0.05 }),
  state: choiceParam("Mouvement", STATES, "Immobile, ou s'ouvre et se ferme en boucle (pour la regarder)."),
  height: numberParam("Hauteur", 1.2, 0.6, 3, "Valve murale : hauteur de l'axe du tuyau (commandes à 1,10–1,30 m).", { step: 0.05, unit: "m" }),
};

export const meta = {
  id: "props/machines/wheel-valve",
  name: "Valve à volant",
  nameEn: "Wheel valve",
  category: "props",
  subcategory: "machines",
  description:
    "Valve du Complexe : volant de fonte à rayons sur une tige filetée, corps de bronze traversé par un tuyau de " +
    "cuivre, petit cadran à aiguille. Murale (volant de 0,22 m) ou géante (roue de 0,9 m à jante de bronze, plaque " +
    "numérotée). Le volant tourne et l'aiguille suit : réglage, boucle ou pilotage par le scénario. Fiches SAS-10, COE-08.",
  tags: [
    "valve", "vanne", "volant", "roue", "tige filetée", "cadran", "aiguille", "fonte", "bronze", "tuyau", "le complexe",
    "complexe", "ancien-tech", "machine", "commande", "animé", "pilotable", "intérieur",
    "wheel valve", "gate valve", "handwheel", "threaded stem", "gauge", "needle", "cast iron", "pipe", "ancient complex",
    "ancient-tech", "control", "animated", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units:
    "1 unité = 1 mètre ; origine au sol ; murale : au pied du mur (le mur est en z = 0, le volant regarde +z) ; " +
    "géante : au centre du socle, le tuyau suit l'axe x",
  footprint: { radius: 0.95, height: 1.85 },
  animated: ["valve"],
  params,
  variants: variantsOf("size", params.size),
};

/**
 * Crée la valve.
 * @param {{seed?: number, size?: string, turn?: number, state?: string, height?: number}} [given]
 * @returns {THREE.Group} `group.userData.valve` : { turn, setTurn(t), turnTo(t, secondes) }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const giant = p.size === "giant";
  const wear = createRng(p.seed * 7919 + 17);
  const bronzeParts = [];
  const ironParts = [];
  const copperParts = [];

  // Repères : le volant tourne autour de `stemAxis` passant par `wheelCenter` ; le cadran est en `dialAt`.
  let wheelCenter, stemAxis, dialAt, dialNormal, dialRadius;
  const wheelR = giant ? 0.45 : 0.11;
  const spokes = giant ? 6 : 5;

  if (!giant) {
    const h = p.height;
    const zc = 0.12; // axe du tuyau, devant le mur
    // Bout de tuyau tenu au mur par deux pattes, et ses deux colliers.
    const pipe = plain(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 6));
    copperParts.push(orient(pipe, [0, h, zc], [1, 0, 0]));
    for (const x of [-0.32, 0.32]) {
      bronzeParts.push(beam([x, h, 0], [x, h, zc], PX * 1.2, PX * 1.4));
      bronzeParts.push(orient(ring({ radius: 0.06, height: PX * 2, y: -PX, thickness: PX * 0.8, segments: 6 }), [x, h, zc], [1, 0, 0]));
    }
    // Corps : bloc à brides, chapeau vers la pièce, presse-étoupe.
    bronzeParts.push(withTone(buildBlock([0.35, 0.3, 0.2], [0, h, zc]), wear.range(-0.06, 0.04)));
    for (const s of [-1, 1]) bronzeParts.push(orient(ring({ radius: 0.06, height: 0.04, y: -0.02, thickness: 0.03, segments: 8 }), [s * 0.2, h, zc], [1, 0, 0]));
    bronzeParts.push(orient(buildLathe([[0, 0], [0.07, 0], [0.07, 0.05], [0.04, 0.09], [0, 0.09]], { segments: 8, facets: true }), [0, h, zc + 0.1], [0, 0, 1]));
    stemAxis = new THREE.Vector3(0, 0, 1);
    wheelCenter = new THREE.Vector3(0, h, zc + 0.3);
    // Tige filetée : anneaux alternés entre le chapeau et le volant.
    for (let k = 0; k < 5; k++) {
      const g = plain(new THREE.CylinderGeometry(0.018, 0.018, 0.022, 6));
      bronzeParts.push(withTone(orient(g, [0, h, zc + 0.19 + k * 0.022], [0, 0, 1]), k % 2 ? -0.35 : 0.1));
    }
    dialAt = new THREE.Vector3(0.09, h + 0.15 + PX * 0.3, zc);
    dialNormal = new THREE.Vector3(0, 1, 0.55).normalize();
    dialRadius = 0.055;
    bronzeParts.push(withTone(orient(buildLathe([[0, 0], [0.065, 0], [0.065, 0.03], [0, 0.03]], { segments: 10, facets: true }), dialAt.clone().addScaledVector(dialNormal, -0.03), dialNormal), -0.1));
  } else {
    const yPipe = 0.55;
    // Socle de pierre de bronze sombre, corps, gros tuyau traversant à brides.
    bronzeParts.push(withTone(buildBlock([0.95, 0.15, 0.75], [0, 0.075, 0]), -0.25));
    bronzeParts.push(withTone(buildBlock([0.7, 0.8, 0.5], [0, 0.15 + 0.4, 0]), wear.range(-0.06, 0.04)));
    const pipe = plain(new THREE.CylinderGeometry(0.15, 0.15, 1.8, 12));
    copperParts.push(orient(pipe, [0, yPipe, 0], [1, 0, 0]));
    for (const s of [-1, 1]) {
      bronzeParts.push(withTone(orient(ring({ radius: 0.15, height: 0.06, y: -0.03, thickness: 0.06, segments: 12 }), [s * 0.4, yPipe, 0], [1, 0, 0]), 0.2));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        bronzeParts.push(withTone(buildBlock([0.09, PX, PX], [s * 0.4, yPipe + Math.cos(a) * 0.19, Math.sin(a) * 0.19]), 0.4));
      }
    }
    // Chapeau, deux montants (la lanterne), traverse, tige filetée visible entre les montants.
    const top = 0.95;
    bronzeParts.push(buildLathe([[0, top], [0.2, top], [0.2, top + 0.08], [0.1, top + 0.16], [0, top + 0.16]], { segments: 12, facets: true }));
    for (const s of [-1, 1]) bronzeParts.push(beam([s * 0.14, top + 0.1, 0], [s * 0.14, 1.45, 0], 0.06, 0.08));
    bronzeParts.push(withTone(buildBlock([0.4, 0.08, 0.1], [0, 1.45, 0]), 0.1));
    for (let k = 0; k < 14; k++) {
      const g = plain(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8));
      bronzeParts.push(withTone(orient(g, [0, top + 0.17 + k * 0.03, 0], [0, 1, 0]), k % 2 ? -0.35 : 0.12));
    }
    stemAxis = new THREE.Vector3(0, 1, 0);
    wheelCenter = new THREE.Vector3(0, 1.62, 0);
    bronzeParts.push(beam([0, 1.45, 0], [0, 1.6, 0], 0.05, 0.05));
    // Jante de bronze (ronde : elle ne change pas en tournant, elle reste dans le corps).
    bronzeParts.push(withTone(ring({ radius: wheelR - 0.04, y: wheelCenter.y - 0.035, height: 0.07, thickness: 0.06, segments: 24 }), 0.15));
    // Plaque numérotée sur la face avant : 1 à 6 traits gravés.
    bronzeParts.push(withTone(buildBlock([0.3, 0.16, PX * 0.4], [0, 0.35, 0.25 + PX * 0.2]), 0.3));
    const number = wear.int(1, 6);
    for (let i = 0; i < number; i++) bronzeParts.push(withTone(buildBlock([PX, 0.1, 0.004], [(i - (number - 1) / 2) * PX * 2, 0.35, 0.25 + PX * 0.4]), -0.9));
    dialAt = new THREE.Vector3(0.36 + PX * 0.3, 0.75, 0);
    dialNormal = new THREE.Vector3(1, 0, 0);
    dialRadius = 0.1;
    bronzeParts.push(withTone(orient(buildLathe([[0, 0], [0.12, 0], [0.12, 0.03], [0, 0.03]], { segments: 12, facets: true }), dialAt.clone().addScaledVector(dialNormal, -0.03), dialNormal), -0.1));
  }

  // Cadran : fond clair (le bronze poli), repères gravés ; l'aiguille est ajoutée à part pour tourner.
  const d = dial({ radius: dialRadius, position: dialAt, normal: dialNormal, ticks: giant ? 10 : 6, needle: null, depth: PX * 0.3 });
  bronzeParts.push(withTone(d.face, 0.55), withTone(d.marks, -0.9));
  const needleLength = dialRadius * 0.8;
  const needleLocal = withTone(buildBlock([PX * 0.5, needleLength, PX * 0.3], [0, needleLength / 2, PX * 0.6]), -1.1);
  const needleCount = needleLocal.attributes.position.count;
  const needleBase = needleLocal.attributes.position.array.slice();
  const needleNormals = needleLocal.attributes.normal.array.slice();
  bronzeParts.push(needleLocal); // en dernier : ses sommets sont à la fin du maillage
  const dialFrame = faceMatrix(dialAt, dialNormal);

  // --- Volant (fonte) : jante (murale), moyeu, rayons, une poignée qui montre qu'il tourne.
  const wheelLocal = [];
  if (!giant) wheelLocal.push(ring({ radius: wheelR - PX * 0.5, y: -PX * 0.5, height: PX, thickness: PX, segments: 14 }));
  wheelLocal.push(buildLathe([[0, -0.03], [giant ? 0.07 : 0.025, -0.03], [giant ? 0.07 : 0.025, 0.03], [0, 0.03]], { segments: 8, facets: true }));
  const spokeStart = wear.range(0, Math.PI * 2);
  for (let k = 0; k < spokes; k++) {
    const a = spokeStart + (k / spokes) * Math.PI * 2;
    const reach = giant ? wheelR - 0.06 : wheelR - PX * 0.5;
    wheelLocal.push(beam([0, 0, 0], [Math.cos(a) * reach, 0, Math.sin(a) * reach], giant ? 0.045 : PX * 0.7, giant ? 0.035 : PX * 0.7));
  }
  const knobA = spokeStart + Math.PI / spokes;
  const knob = buildLathe([[0, 0], [giant ? 0.03 : 0.012, 0], [giant ? 0.03 : 0.012, giant ? 0.14 : 0.05], [0, giant ? 0.16 : 0.06]], { segments: 6, facets: true });
  knob.translate(Math.cos(knobA) * (wheelR - 0.02), 0, Math.sin(knobA) * (wheelR - 0.02));
  wheelLocal.push(withTone(knob, wear.chance(0.5) ? 0.35 : 0.15)); // poignée polie par les mains
  const wheelGeometry = mergeToned(wheelLocal.map((g) => (g.attributes.aTone ? g : withTone(g, 0))));

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const bronzeGeometry = mergeToned(bronzeParts);
  const body = new THREE.Mesh(bronzeGeometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  body.name = "body";
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const copper = new THREE.Mesh(mergeToned(copperParts), metalMaterial(METALS.oxidizedCopper, { id: 31, steps: [0.28, 0.46, 0.68, 0.95] }));
  copper.name = "pipe";
  copper.castShadow = true;
  group.add(copper);

  const wheelPivot = new THREE.Group();
  wheelPivot.position.copy(wheelCenter);
  wheelPivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), stemAxis);
  const wheel = new THREE.Mesh(wheelGeometry, metalMaterial(METALS.castIron, { id: 32, tone: true }));
  wheel.name = "wheel";
  wheel.castShadow = true;
  wheelPivot.add(wheel);
  group.add(wheelPivot);

  // --- Mouvement : le volant tourne de deux tours, l'aiguille balaie son cadran.
  const rest = wear.range(0, Math.PI * 2);
  const position = bronzeGeometry.attributes.position;
  const normal = bronzeGeometry.attributes.normal;
  const first = position.count - needleCount;
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  let shown = -1;
  const pose = (t) => {
    if (Math.abs(t - shown) < 1e-4) return;
    shown = t;
    wheel.rotation.y = rest - t * TURNS * Math.PI * 2;
    m.copy(dialFrame).multiply(new THREE.Matrix4().makeRotationZ(-(-NEEDLE + 2 * NEEDLE * t)));
    nm.getNormalMatrix(m);
    for (let i = 0; i < needleCount; i++) {
      v.fromArray(needleBase, i * 3).applyMatrix4(m);
      position.setXYZ(first + i, v.x, v.y, v.z);
      v.fromArray(needleNormals, i * 3).applyMatrix3(nm).normalize();
      normal.setXYZ(first + i, v.x, v.y, v.z);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
  };

  const valve = {
    turn: p.turn,
    setTurn(t) {
      tween = null;
      cycling = false;
      valve.turn = THREE.MathUtils.clamp(t, 0, 1);
      pose(valve.turn);
    },
    turnTo(t, seconds = 3) {
      tween = { from: valve.turn, to: THREE.MathUtils.clamp(t, 0, 1), start: sharedUniforms.uTime.value, seconds };
    },
  };
  let tween = null;
  let cycling = p.state === "cycle";
  pose(valve.turn);

  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      if (tween) {
        cycling = false;
        const k = Math.min(1, (time - tween.start) / Math.max(0.01, tween.seconds));
        valve.turn = tween.from + (tween.to - tween.from) * k;
        if (k >= 1) tween = null;
      } else if (cycling) {
        const u = (time % 8) / 8; // 8 s : s'ouvre, reste, se ferme, reste
        valve.turn = u < 0.4 ? u / 0.4 : u < 0.5 ? 1 : u < 0.9 ? 1 - (u - 0.5) / 0.4 : 0;
      }
      pose(valve.turn);
    }
    baseUpdate(force);
  };

  group.userData.valve = valve;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
