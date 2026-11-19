// Loupe sur bras du Complexe (fiche ARC-07, et les loupes de ATE-14 et ETU-10, docs/complexe/).
// - Lecture (Archives) : lentille de Ø 0,20 m (3 px) en verre clair jauni avec un reflet d'un pixel, monture de laiton,
//   bras de 0,6 m sur un fût, contrepoids de fonte au bout arrière du bras.
// - Binoculaire (établi d'horloger) : deux petites lentilles côte à côte sous un pont, deux oculaires au-dessus, bras
//   de 0,4 m.
// - Observation (table ETU-10) : lentille de Ø 0,15 m sur un bras court.
// Posée sur un socle lesté, ou serrée par un étau au bord d'une table (comme la lampe articulée).
// La graine change l'orientation et la plongée du bras, l'inclinaison de la lentille, le jaunissement du verre, la
// patine de la monture. `group.userData.arm.setPose({ yaw, pitch, tilt })` ; `group.userData.lens` : centre et axe
// de la lentille (pour cadrer ce qu'on regarde au travers).
//
// 2 draw calls : laiton (socle, fût, bras, contrepoids, monture), verre.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe, buildQuads } from "../../kit/geometry.js";
import { GLASSES, METALS } from "../../kit/palettes.js";
import { PX, beam, createRigidParts, mergeParts, metalMaterial, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = {
  reading: "Lecture (Ø 0,20 m, bras de 0,6 m)",
  binocular: "Binoculaire (horloger, bras de 0,4 m)",
  observation: "Observation (Ø 0,15 m, bras court)",
};
const MOUNTS = { desk: "Posée sur un socle lesté", clamp: "Serrée par un étau (bord de table)" };
// Fût, bras, rayon de la lentille, recul du contrepoids (m).
const SIZES = {
  reading: { post: 0.3, boom: 0.6, lens: 0.1, back: 0.2 },
  binocular: { post: 0.24, boom: 0.4, lens: 0.042, back: 0.14 },
  observation: { post: 0.22, boom: 0.35, lens: 0.075, back: 0.13 },
};
const FIXED = 255;

const params = {
  seed: seedParam("Change l'orientation et la plongée du bras, l'inclinaison de la lentille, le jaunissement du verre, la patine de la monture."),
  kind: choiceParam("Modèle", KINDS, "Loupe de lecture des Archives, loupe binoculaire de l'établi d'horloger, ou loupe de la table d'observation."),
  mount: choiceParam("Pose", MOUNTS, "Sur un socle lesté, ou serrée par un étau au bord d'une table (origine au ras du plateau, le plateau du côté z < 0)."),
};

export const meta = {
  id: "props/tools/arm-magnifier",
  name: "Loupe sur bras",
  nameEn: "Arm magnifier",
  category: "props",
  subcategory: "tools",
  description:
    "Loupe du Complexe montée sur un bras de laiton à contrepoids : lentille de verre clair jauni à reflet d'un pixel, " +
    "dans une monture de laiton. Loupe de lecture des Archives, loupe binoculaire de l'horloger (deux lentilles, deux " +
    "oculaires), ou loupe de table d'observation ; sur socle ou à l'étau ; le bras se règle à la demande. Fiches " +
    "ARC-07, ATE-14, ETU-10.",
  tags: [
    "loupe", "lentille", "verre", "bras", "contrepoids", "laiton", "binoculaire", "oculaires", "étau", "lecture",
    "observation", "horloger", "le complexe", "complexe", "ancien-tech", "outil", "pilotable", "intérieur",
    "magnifier", "magnifying glass", "lens", "glass", "arm", "counterweight", "brass", "binocular", "eyepieces",
    "clamp", "reading", "inspection", "watchmaker", "ancient complex", "ancient-tech", "tool", "scriptable", "indoor",
    "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units:
    "1 unité = 1 mètre ; origine sous le socle (sur le plateau), ou au ras du bord de la table pour l'étau (le " +
    "plateau est en y = 0, côté z < 0) ; le bras part vers +z avant la rotation de la graine",
  footprint: { radius: 0.8, height: 0.5 },
  animated: ["arm"],
  params,
  variants: [
    { id: "reading", name: "Lecture, sur socle", params: {} },
    { id: "binocular", name: "Binoculaire, à l'étau", params: { kind: "binocular", mount: "clamp" } },
    { id: "observation", name: "Observation, à l'étau", params: { kind: "observation", mount: "clamp" } },
  ],
};

/**
 * Crée la loupe.
 * @param {{seed?: number, kind?: string, mount?: string}} [given]
 * @returns {THREE.Group} `group.userData.arm` : { yaw, pitch, tilt, setPose({ yaw?, pitch?, tilt? }) } ;
 *   `group.userData.lens` : { center: Vector3, normal: Vector3 } (repère de l'asset, mis à jour par setPose)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 307);
  const S = SIZES[p.kind];
  const metal = [], glass = [];
  const rod = PX * 0.55;

  // --- Pied (fixe).
  let p0y;
  if (p.mount === "clamp") {
    metal.push([withTone(buildBlock([0.07, 0.04, 0.1], [0, 0.02, -0.04]), 0.05), FIXED]);
    metal.push([withTone(buildBlock([0.07, 0.17, 0.04], [0, -0.045, 0.02]), -0.1), FIXED]);
    metal.push([withTone(buildBlock([0.07, 0.03, 0.08], [0, -0.115, -0.02]), -0.05), FIXED]);
    metal.push([withTone(beam([0, -0.17, -0.04], [0, -0.1, -0.04], PX * 0.5, PX * 0.5), 0.3), FIXED]);
    metal.push([withTone(beam([-0.04, -0.17, -0.04], [0.04, -0.17, -0.04], PX * 0.5, PX * 0.5), 0.2), FIXED]);
    p0y = 0.04;
  } else {
    // Socle lesté : galette de fonte (laiton très sombre), collerette claire.
    const r = p.kind === "reading" ? 0.11 : 0.085;
    metal.push([withTone(buildLathe([[0, 0], [r, 0], [r, 0.03], [r * 0.7, 0.05], [0, 0.05]], { segments: 10, facets: true }), (x, y, z, nx, ny) => (ny > 0.5 ? -0.35 : -0.55)), FIXED]);
    metal.push([withTone(plain(new THREE.CylinderGeometry(0.03, 0.035, 0.03, 8)).translate(0, 0.06, 0), 0.15), FIXED]);
    p0y = 0.07;
  }
  // Fût jusqu'au pivot du bras.
  const Q = new THREE.Vector3(0, p0y + S.post, 0);
  metal.push([withTone(beam([0, p0y - 0.01, 0], [0, Q.y - 0.02, 0], PX * 0.7, PX * 0.7), 0), FIXED]);
  metal.push([withTone(plain(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8)).translate(0, Q.y - 0.03, 0), 0.25), FIXED]); // bague de serrage

  // --- Bras (pièce 0) : construit le long de +z depuis le pivot, contrepoids derrière.
  const end = new THREE.Vector3(0, Q.y, S.boom);
  const knuckle = plain(new THREE.CylinderGeometry(PX * 0.75, PX * 0.75, 0.06, 8));
  knuckle.rotateZ(Math.PI / 2);
  knuckle.translate(0, Q.y, 0);
  metal.push([withTone(knuckle, 0.2), 0]);
  metal.push([withTone(beam([0, Q.y, -S.back + 0.03], [0, Q.y, S.boom - 0.02], rod, rod), 0.05), 0]);
  const weight = plain(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8));
  weight.rotateX(Math.PI / 2);
  weight.translate(0, Q.y, -S.back);
  metal.push([withTone(weight, -0.6), 0]); // fonte : le laiton noirci au plus sombre
  metal.push([withTone(plain(new THREE.CylinderGeometry(0.043, 0.043, 0.012, 8)).rotateX(Math.PI / 2).translate(0, Q.y, -S.back + 0.05), 0.1), 0]);

  // --- Tête (pièce 1) : chape au bout du bras, monture et lentille, plan horizontal avant l'inclinaison.
  const head = 1;
  const yoke = plain(new THREE.CylinderGeometry(PX * 0.65, PX * 0.65, 0.05, 8));
  yoke.rotateZ(Math.PI / 2);
  yoke.translate(end.x, end.y, end.z);
  metal.push([withTone(yoke, 0.25), head]);
  const lensCenter = new THREE.Vector3();
  const rim = (cx, cz, r, t, d) => {
    metal.push([withTone(buildLathe([[r, -d / 2], [r + t, -d / 2], [r + t, d / 2], [r, d / 2]], { segments: r > 0.06 ? 14 : 10, facets: true }).translate(cx, end.y, cz), (x, y) => (y > end.y ? 0.25 : -0.15)), head]);
  };
  const lens = (cx, cz, r) => {
    const disc = plain(new THREE.CylinderGeometry(r, r, 0.012, r > 0.06 ? 14 : 10));
    disc.translate(cx, end.y, cz);
    glass.push([withTone(disc, (x, y, z) => -0.25 * Math.hypot(x - cx, z - cz) / r), head]);
    // Reflet d'un pixel, en haut à gauche de la lentille (vers −x, −z).
    glass.push([buildQuads([{ position: [cx - r * 0.38, end.y + 0.0065, cz - r * 0.38], size: [PX * 0.75, PX * 0.75], normal: [0, 1, 0], tone: 0.9 }]), head]);
  };
  if (p.kind === "binocular") {
    // Pont de laiton, deux lentilles dessous, deux oculaires dessus.
    const cz = end.z + 0.06;
    metal.push([withTone(beam([0, end.y, end.z], [0, end.y, cz - 0.02], rod, rod), 0.05), head]);
    metal.push([withTone(buildBlock([0.2, 0.025, 0.05], [0, end.y + 0.02, cz]), 0.1), head]);
    for (const s of [-1, 1]) {
      const x = s * 0.052;
      rim(x, cz, S.lens, 0.012, 0.02);
      lens(x, cz, S.lens);
      const eye = plain(new THREE.CylinderGeometry(0.02, 0.024, 0.07, 8));
      eye.translate(x, end.y + 0.065, cz);
      metal.push([withTone(eye, (xx, y) => (y > end.y + 0.09 ? 0.3 : -0.1)), head]);
      metal.push([withTone(plain(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 8)).translate(x, end.y + 0.1, cz), -0.85), head]); // œil sombre
    }
    lensCenter.set(0, end.y, cz);
  } else {
    // Une lentille ronde au bout d'une courte queue, monture de 2 cm.
    const r = S.lens, t = 0.022;
    const cz = end.z + r + t + 0.03;
    metal.push([withTone(beam([0, end.y, end.z], [0, end.y, cz - r - t * 0.5], rod, rod * 0.8), 0.05), head]);
    rim(0, cz, r, t, 0.026);
    lens(0, cz, r);
    lensCenter.set(0, end.y, cz);
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE.Mesh(metalMerged.geometry, metalMaterial(METALS.blackenedBrass, { id: 30, tone: true }));
  metalMesh.name = "arm";
  // Verre : la graine le jaunit plus ou moins (décalage de toute la lentille).
  const yellow = rng.range(-0.08, 0.1);
  const glassMerged = mergeParts(glass.map(([g, k]) => [withTone(g, yellow), k]));
  const glassMesh = new THREE.Mesh(glassMerged.geometry, createToonMaterial({ ramp: GLASSES.clear.ramp, ink: GLASSES.clear.ink, steps: [0.25, 0.5, 0.8], tone: true, crease: true, id: 31 }));
  glassMesh.name = "lens";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  glassMesh.receiveShadow = true;
  group.add(metalMesh, glassMesh);

  // --- Pose : lacet et plongée du bras autour du pivot, puis inclinaison de la tête autour de la chape.
  const rigs = [createRigidParts(metalMerged.geometry, metalMerged.partOf, 2), createRigidParts(glassMerged.geometry, glassMerged.partOf, 2)];
  const tmp = new THREE.Matrix4();
  const lensInfo = { center: new THREE.Vector3(), normal: new THREE.Vector3() };
  const arm = {
    yaw: 0,
    pitch: 0,
    tilt: 0,
    setPose({ yaw = arm.yaw, pitch = arm.pitch, tilt = arm.tilt } = {}) {
      Object.assign(arm, { yaw, pitch, tilt });
      const boom = new THREE.Matrix4().makeTranslation(Q.x, Q.y, Q.z).multiply(tmp.makeRotationY(yaw)).multiply(tmp.makeRotationX(pitch)).multiply(tmp.makeTranslation(-Q.x, -Q.y, -Q.z));
      const tip = boom.clone().multiply(tmp.makeTranslation(end.x, end.y, end.z)).multiply(tmp.makeRotationX(tilt)).multiply(tmp.makeTranslation(-end.x, -end.y, -end.z));
      for (const rig of rigs) {
        rig.matrices[0].copy(boom);
        rig.matrices[1].copy(tip);
        rig.apply();
      }
      lensInfo.center.copy(lensCenter).applyMatrix4(tip);
      lensInfo.normal.set(0, -1, 0).transformDirection(tip);
    },
  };
  // Pose de la graine : le bras plonge vers le plateau, la lentille reste à peu près à plat (un peu tournée vers le lecteur).
  const pitch = rng.range(0.18, 0.42);
  arm.setPose({ yaw: rng.range(-0.9, 0.9), pitch, tilt: -pitch + rng.range(-0.45, 0.15) });

  group.userData.arm = arm;
  group.userData.lens = lensInfo;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
