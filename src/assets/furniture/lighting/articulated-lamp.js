// Lampe articulée du Complexe (fiches ARC-06 et ATE-09, docs/complexe/PIECES.md).
// - Lecture (Archives) : socle rond de Ø 0,15 m, trois segments de laiton de 0,35 m, articulations en plots de 2 px,
//   abat-jour en cloche de verre ambre qui luit (3 px).
// - Atelier : deux bras de 0,6 m, contrepoids de fonte au bout du bras haut (qui dépasse derrière le coude), ressort
//   le long du bras bas, abat-jour conique noir dont l'intérieur et l'ampoule luisent jaune pâle.
// Posée sur un plateau, serrée par un étau sur le bord d'une table, ou suspendue sous une tige (au-dessus du
// meuble-catalogue). Allumée (scintillement lent), en veille ou éteinte ; option halo comme les lampes du lot 2.
// La graine change la pose du bras (plié autrement à chaque fois), son orientation, la patine.
// `group.userData.arm.setPose({ yaw, angles })` replie le bras ; `lightPoint` suit l'abat-jour.
//
// 2 draw calls : métal (socle, segments, articulations, abat-jour de l'atelier), lueur (cloche ou intérieur).

import * as THREE from "three";
import { createGlowLight, rgb, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe } from "../../kit/geometry.js";
import { GLOWS, METALS } from "../../kit/palettes.js";
import {
  PX, beam, bulb, createFlicker, createRigidParts, glowLevels, glowMixMaterial, mergeParts, metalMaterial, plain, ring,
  withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = { reading: "Lecture (cloche ambre, 3 segments)", workshop: "Atelier (cône noir, contrepoids)" };
const MOUNTS = { desk: "Posée sur un socle", clamp: "Serrée par un étau (bord de table)", hanging: "Suspendue sous une tige" };
const STATES = { lit: "Allumée", dim: "En veille", off: "Éteinte" };
const HALOS = { off: "Sans halo", on: "Éclaire le décor (dans le noir)" };
const BASE = { lit: 2, dim: 1, off: 0 };
const FIXED = 255;
// Pâle de l'atelier : un jaune presque blanc (ampoule claire derrière un cône noir).
const PALE = { ramp: ["#4a3f22", "#a08c4a", "#f2e2a0", "#fff8dc"], light: "#ffe9a8" };

const params = {
  seed: seedParam("Change la pose du bras (angles des articulations), son orientation, la patine, le rythme du scintillement."),
  kind: choiceParam("Modèle", KINDS, "Lampe de lecture des Archives (3 segments, cloche ambre) ou lampe d'atelier (2 bras, contrepoids, cône noir)."),
  mount: choiceParam("Pose", MOUNTS, "Sur un socle, serrée par un étau au bord d'une table (origine au ras du plateau), ou suspendue sous une tige (au-dessus du catalogue)."),
  state: choiceParam("État", STATES, "Allumée (scintillement lent), en veille (lueur faible) ou éteinte."),
  halo: choiceParam("Halo", HALOS, "Éclaire le décor autour d'elle dans le noir (une des 12 lumières de halo de la scène)."),
  height: numberParam("Hauteur", 1.8, 1, 4, "Lampe suspendue : hauteur du point d'attache du bras au-dessus du sol (la tige monte au-dessus).", { step: 0.1, unit: "m" }),
  chain: numberParam("Tige", 1, 0.2, 4, "Lampe suspendue : longueur de la tige jusqu'au plafond.", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "furniture/lighting/articulated-lamp",
  name: "Lampe articulée",
  nameEn: "Articulated lamp",
  category: "furniture",
  subcategory: "lighting",
  description:
    "Lampe à bras articulé du Complexe : lampe de lecture des Archives (socle rond, trois segments de laiton, plots " +
    "d'articulation, cloche de verre ambre qui luit) ou lampe d'atelier (deux bras, contrepoids, cône noir à " +
    "l'intérieur jaune pâle). Posée, serrée à un étau ou suspendue ; allumée, en veille ou éteinte ; le bras se " +
    "replie à la demande. Fiches ARC-06, ATE-09.",
  tags: [
    "lampe", "lampe de bureau", "lampe articulée", "bras", "abat-jour", "cloche", "contrepoids", "étau", "laiton",
    "ambre", "lecture", "atelier", "le complexe", "complexe", "ancien-tech", "éclairage", "lumineux", "pilotable",
    "intérieur",
    "desk lamp", "articulated lamp", "task lamp", "arm", "lampshade", "bell shade", "counterweight", "clamp", "brass",
    "amber", "reading", "workshop", "ancient complex", "ancient-tech", "lighting", "glowing", "scriptable", "indoor",
    "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units:
    "1 unité = 1 mètre ; origine sous le socle (sur le plateau), au ras du bord de la table pour l'étau (le plateau " +
    "est en y = 0, z < 0), ou au sol à l'aplomb de la tige pour la lampe suspendue",
  footprint: { radius: 0.9, height: 2.8 },
  animated: ["flicker", "arm"],
  params,
  variants: [
    { id: "reading", name: "Lecture, posée", params: {} },
    { id: "workshop", name: "Atelier, à l'étau", params: { kind: "workshop", mount: "clamp" } },
    { id: "hanging", name: "Lecture, suspendue", params: { mount: "hanging" } },
    { id: "off", name: "Atelier éteinte", params: { kind: "workshop", state: "off" } },
  ],
};

/**
 * Crée la lampe.
 * @param {{seed?: number, kind?: string, mount?: string, state?: string, halo?: string, height?: number, chain?: number}} [given]
 * @returns {THREE.Group} `group.userData.arm` : { yaw, angles, setPose({ yaw?, angles? }), lightPoint }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 151);
  const reading = p.kind === "reading";
  const hanging = p.mount === "hanging";
  const lengths = reading ? [0.35, 0.35, 0.35] : [0.6, 0.6];
  const metal = [], glow = [];
  const rod = PX * (reading ? 0.6 : 0.75);

  // --- Pied (fixe) ; le bras part du pivot P0, construit droit vers +y.
  let p0y;
  if (p.mount === "clamp") {
    // Étau : mâchoire sur le plateau, vis sous le plateau, au ras du bord (le plateau est en y = 0, côté z < 0).
    metal.push([withTone(buildBlock([0.07, 0.04, 0.1], [0, 0.02, -0.04]), 0.05), FIXED]);
    metal.push([withTone(buildBlock([0.07, 0.17, 0.04], [0, -0.045, 0.02]), -0.1), FIXED]);
    metal.push([withTone(buildBlock([0.07, 0.03, 0.08], [0, -0.115, -0.02]), -0.05), FIXED]);
    metal.push([withTone(beam([0, -0.17, -0.04], [0, -0.1, -0.04], PX * 0.5, PX * 0.5), 0.3), FIXED]); // vis
    metal.push([withTone(beam([-0.04, -0.17, -0.04], [0.04, -0.17, -0.04], PX * 0.5, PX * 0.5), 0.2), FIXED]); // tige de serrage
    p0y = 0.07;
    metal.push([withTone(buildBlock([0.05, 0.04, 0.05], [0, 0.055, -0.04]), 0.15), FIXED]);
  } else if (hanging) {
    p0y = 0;
  } else {
    const r = reading ? 0.075 : 0.11;
    metal.push([withTone(buildLathe([[0, 0], [r, 0], [r, 0.022], [r * 0.6, 0.04], [0.02, 0.05], [0, 0.05]], { segments: 10, facets: true }), (x, y, z, nx, ny) => (ny > 0.5 ? 0.1 : -0.1)), FIXED]);
    p0y = 0.06;
  }
  const P = [new THREE.Vector3(0, p0y, 0)];
  for (const l of lengths) P.push(P[P.length - 1].clone().add(new THREE.Vector3(0, l, 0)));

  // --- Segments : une pièce rigide chacun, avec le plot d'articulation à leur pied (2 px, axe x).
  lengths.forEach((l, k) => {
    const a = P[k], b = P[k + 1];
    const tone = (k % 2 ? 0.05 : -0.05);
    if (reading) {
      metal.push([withTone(beam([0, a.y + 0.03, 0], [0, b.y - 0.02, 0], rod, rod), tone), k]);
    } else {
      // Bras d'atelier : deux tiges parallèles d'un pixel d'écart (on voit le jour entre elles), ressort sur le bas.
      for (const s of [-1, 1]) metal.push([withTone(beam([s * 0.025, a.y + 0.03, 0], [s * 0.025, b.y - 0.02, 0], rod * 0.7, rod), tone), k]);
      if (k === 0) metal.push([withTone(beam([0, a.y + 0.12, 0.035], [0, b.y - 0.12, 0.035], PX * 0.45, PX * 0.45), 0.35), k]);
      if (k === 1) {
        // Le bras haut dépasse derrière le coude : contrepoids de fonte au bout.
        for (const s of [-1, 1]) metal.push([withTone(beam([s * 0.025, a.y - 0.24, 0], [s * 0.025, a.y, 0], rod * 0.7, rod), tone), k]);
        const weight = plain(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 8));
        weight.translate(0, a.y - 0.3, 0);
        metal.push([withTone(weight, -0.55), k]);
      }
    }
    const knuckle = plain(new THREE.CylinderGeometry(PX * 0.9, PX * 0.9, reading ? 0.05 : 0.08, 8));
    knuckle.rotateZ(Math.PI / 2);
    knuckle.translate(0, a.y, 0);
    metal.push([withTone(knuckle, 0.25), k]);
  });

  // --- Abat-jour au bout du dernier segment, ouverture dans l'axe du segment (+y en construction).
  const last = lengths.length - 1;
  const end = P[P.length - 1];
  const lightLocal = new THREE.Vector3();
  if (reading) {
    // Cloche de verre ambre (la lueur) sous un chapeau de laiton.
    const y = end.y;
    metal.push([withTone(buildLathe([[0, y - 0.02], [0.035, y - 0.02], [0.035, y + 0.02], [0, y + 0.02]], { segments: 8, facets: true }), 0.1), last]);
    const bell = buildLathe([[0.03, y + 0.015], [0.055, y + 0.05], [0.08, y + 0.11], [0.095, y + 0.135], [0, y + 0.135]], { segments: 10, facets: true });
    glow.push([bell, last]);
    metal.push([withTone(ring({ radius: 0.093, height: PX * 0.4, y: y + 0.13, thickness: PX * 0.4, segments: 10 }), 0.3), last]);
    lightLocal.set(0, y + 0.1, 0);
  } else {
    const y = end.y;
    const cone = buildLathe([[0.03, y], [0.05, y + 0.04], [0.14, y + 0.17], [0.175, y + 0.22], [0.165, y + 0.22], [0.13, y + 0.17], [0.04, y + 0.05], [0.02, y + 0.04]], { segments: 10, facets: true });
    metal.push([withTone(cone, -0.7), last]);
    metal.push([withTone(ring({ radius: 0.172, height: PX * 0.5, y: y + 0.215, thickness: PX * 0.35, segments: 10 }), 0.1), last]);
    // Intérieur pâle (un disque juste dans l'ouverture) et ampoule.
    const inner = buildLathe([[0.04, y + 0.06], [0.125, y + 0.17], [0.155, y + 0.205], [0, y + 0.205]], { segments: 10, facets: true });
    glow.push([inner, last]);
    glow.push([bulb({ radius: PX * 0.9, position: [0, y + 0.15, 0], segments: 6 }), last]);
    lightLocal.set(0, y + 0.18, 0);
  }

  // --- Suspendue : une tige monte jusqu'au plafond, une rosace ; le bras est retourné (il descend).
  if (hanging) {
    metal.push([withTone(beam([0, 0.04, 0], [0, p.chain, 0], PX * 0.6, PX * 0.6), 0.05), FIXED]);
    metal.push([withTone(buildLathe([[0, p.chain], [0.08, p.chain], [0.08, p.chain + 0.03], [0, p.chain + 0.04]], { segments: 8, facets: true }), 0.1), FIXED]);
    metal.push([withTone(buildBlock([0.06, 0.05, 0.06], [0, 0.03, 0]), 0.15), FIXED]);
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const metalMerged = mergeParts(metal);
  const entry = reading ? METALS.blackenedBrass : METALS.castIron;
  const metalMesh = new THREE.Mesh(metalMerged.geometry, metalMaterial(entry, { id: 30, tone: true }));
  metalMesh.name = "arm";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  const glowMerged = mergeParts(glow);
  withShade(glowMerged.geometry, BASE[p.state], 4);
  const light = reading ? GLOWS.amber : PALE;
  const glowMat = glowMixMaterial(reading ? glowLevels("amber") : [0, 1, 2, 3].map((l) => [PALE, l]), { id: 31 });
  const glowMesh = new THREE.Mesh(glowMerged.geometry, glowMat);
  glowMesh.name = "shade";
  const holder = new THREE.Group(); // retourné pour la lampe suspendue
  holder.add(metalMesh, glowMesh);
  if (hanging) {
    holder.position.y = p.height;
    holder.rotation.z = Math.PI;
  }
  group.add(holder);
  const flicker = createFlicker(glowMerged.geometry, [{ start: 0, count: glowMerged.geometry.attributes.position.count, base: BASE[p.state], phase: rng.next() }]);

  // --- Pose du bras : de proche en proche, chaque articulation tourne autour de x à son pivot, après le lacet.
  const rigs = [createRigidParts(metalMerged.geometry, metalMerged.partOf, lengths.length), createRigidParts(glowMerged.geometry, glowMerged.partOf, lengths.length)];
  const tmp = new THREE.Matrix4();
  const arm = {
    yaw: 0,
    angles: [],
    lightPoint: new THREE.Vector3(),
    setPose({ yaw = arm.yaw, angles = arm.angles } = {}) {
      arm.yaw = yaw;
      arm.angles = angles.slice(0, lengths.length);
      const m = new THREE.Matrix4().makeRotationY(yaw);
      arm.angles.forEach((a, k) => {
        m.multiply(tmp.makeTranslation(0, P[k].y, 0)).multiply(tmp.makeRotationX(a)).multiply(tmp.makeTranslation(0, -P[k].y, 0));
        for (const rig of rigs) rig.matrices[k].copy(m);
      });
      for (const rig of rigs) rig.apply();
      arm.lightPoint.copy(lightLocal).applyMatrix4(rigs[0].matrices[last]);
      if (hanging) arm.lightPoint.set(-arm.lightPoint.x, p.height - arm.lightPoint.y, arm.lightPoint.z);
    },
  };
  // Pose tirée de la graine : l'abat-jour regarde vers le bas et l'avant (vers le bas tout droit, suspendue).
  const yaw = rng.range(-0.8, 0.8);
  let angles;
  if (hanging) {
    const a1 = rng.range(-0.35, 0.35), a2 = rng.range(0.6, 1.1) * (rng.chance(0.5) ? 1 : -1);
    angles = reading ? [a1, a2, -(a1 + a2) + rng.range(-0.15, 0.15)] : [a1, -a1 + rng.range(-0.2, 0.2)];
  } else if (reading) {
    const a1 = rng.range(-0.25, 0.08), a2 = rng.range(0.65, 1.05);
    angles = [a1, a2, rng.range(1.9, 2.35) - a1 - a2];
  } else {
    const a1 = rng.range(-0.35, 0.05);
    angles = [a1, rng.range(1.55, 1.85) - a1];
  }
  arm.setPose({ yaw, angles });

  // --- Scintillement et halo.
  const halo = p.halo === "on" && p.state !== "off" ? createGlowLight() : null;
  if (halo) glowMat.addEventListener("dispose", () => halo.release());
  const haloColor = rgb(light.light);
  const haloAt = new THREE.Vector3();
  const reach = (p.state === "lit" ? 2.2 : 1.3) * (reading ? 1 : 1.3);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      flicker(time);
    }
    baseUpdate(force);
    if (halo) {
      const level = glowMerged.geometry.attributes.aShade.array[0] * 4 - 0.5;
      halo.set(group.localToWorld(haloAt.copy(arm.lightPoint)), haloColor, reach * (0.85 + 0.08 * level), 1 + 0.15 * level);
    }
  };

  group.userData.arm = arm;
  group.userData.lightPoint = arm.lightPoint;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
