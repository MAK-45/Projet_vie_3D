// Enclume sur souche de l'Atelier du Complexe (fiche ATE-04) et bloc d'enclume d'essai des salles d'étude
// (fiche E4-01) : le même module, deux métiers.
// - Enclume (ATE-04) : 0,75 × 0,25 × 0,45 m de fonte sur une souche Ø 0,5 × 0,6 m fendue (trait sombre) et
//   cerclée de fer ; table rectangulaire, bec conique, trou carré d'un pixel, taille polie plus claire à un ton.
//   La graine change le tour du bec, la fente de la souche, l'usure de la face.
// - Bloc d'essai (E4-01) : bloc d'acier gris 0,6 × 0,6 × 0,5 m sur une dalle de pierre 1,2 × 1,2 × 0,4 m, huit
//   capteurs piézo (points de quartz clair) sur le pourtour du bloc, fins câbles en bouquet vers la dalle.
//   La graine change la disposition des capteurs et la longueur des câbles.
//
// 2 ou 3 draw calls : fonte (ou pierre), bois de la souche (ou rien), capteurs dans le même maillage (tons).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads } from "../../kit/geometry.js";
import { METALS, STONES, WOODS } from "../../kit/palettes.js";
import { PX, beam, cable, mergeToned, metalMaterial, plain, stoneMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = {
  smith: "Enclume sur souche",
  testBlock: "Bloc d'enclume d'essai",
};

const params = {
  seed: seedParam("Change le tour du bec, la fente de la souche, l'usure de la face ; sur le bloc d'essai, la place des capteurs et la longueur des câbles."),
  kind: choiceParam("Modèle", KINDS, "Enclume de forge sur sa souche fendue (Atelier), ou bloc d'acier d'essai sur sa dalle, ceinturé de capteurs piézo (salle du Marteau)."),
};

export const meta = {
  id: "props/tools/anvil",
  name: "Enclume",
  nameEn: "Anvil",
  category: "props",
  subcategory: "tools",
  description:
    "Enclume de fonte de l'Atelier du Complexe, sur sa souche de chêne fendue et cerclée de fer : table, bec, " +
    "trou carré, taille polie plus claire. Variante bloc d'essai des salles d'étude : bloc d'acier gris sur " +
    "dalle de pierre, huit capteurs piézo de quartz et leurs câbles. Fiches ATE-04, E4-01.",
  tags: [
    "enclume", "souche", "forge", "fonte", "bec", "marteau", "acier", "capteurs", "bloc d'essai",
    "le complexe", "complexe", "ancien-tech", "outil", "intérieur",
    "anvil", "stump", "forging", "cast iron", "horn", "hammer", "steel", "sensors", "test block",
    "ancient complex", "ancient-tech", "tool", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre de la souche (ou de la dalle) ; bec vers +x",
  footprint: { radius: 1.15, height: 0.95 },
  animated: [],
  params,
  variants: variantsOf("kind", params.kind),
};

/**
 * Crée l'enclume.
 * @param {{seed?: number, kind?: string}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 1103);
  const metal = [], wood = [], stone = [];

  if (p.kind === "smith") {
    const aim = rng.range(0.02, 0.1); // angle du bec : l'enclume tombe légèrement du côté opposé
    // --- Corps de fonte : table plate de 0,2 × 0,45 m, taille, pieds évasés, trou carré d'un pixel.
    const bodyTop = buildBlock([0.72, 0.09, 0.24], [0, 0.75, 0], [0, 0, aim]);
    metal.push(withTone(bodyTop, (x, y, z, nx, ny) => (ny > 0.5 ? 0.35 : -0.15))); // taille polie plus claire
    const waist = buildBlock([0.6, 0.1, 0.12], [0, 0.655, 0], [0, 0, aim]);
    metal.push(withTone(waist, -0.35));
    for (const sx of [-1, 1]) {
      const foot = buildBlock([0.16, 0.11, 0.2], [sx * 0.28, 0.57, 0], [0, 0, -aim]);
      metal.push(withTone(foot, (x, y, z, nx, ny) => (ny > 0.5 ? 0.05 : -0.4)));
    }
    // --- Bec conique qui rentre dans la table.
    const hornM = plain(new THREE.CylinderGeometry(0.028, 0.105, 0.22, 8));
    hornM.rotateZ(-Math.PI / 2 + aim);
    hornM.translate(0.45, 0.75 - aim * 0.22, 0);
    metal.push(withTone(hornM, (x, y, z, nx, ny) => (ny > 0.4 ? 0.42 : -0.2)));
    // Trou carré d'un pixel dans la table, côté opposé au bec.
    metal.push(buildQuads([{ position: [-0.28, 0.796, 0], size: [PX, PX], normal: [0, 1, 0], tone: -1 }]));
    // --- Souche : billot fendu (trait sombre descendant), deux cerclages de fer, un éclat d'écorce.
    const stumpTone = rng.range(-0.06, 0.08);
    const stump = plain(new THREE.CylinderGeometry(0.25, 0.27, 0.55, 12)).translate(0, 0.275, 0);
    wood.push(withTone(stump, (x, y, z, nx, ny) => stumpTone + (ny > 0.5 ? 0.12 : 0) + (Math.abs(nx) > 0.5 && Math.sin(x * 6) > 0.7 ? -0.1 : 0)));
    const crack = rng.range(0.15, 0.45);
    wood.push(buildQuads([{ position: [rng.range(-0.1, 0.1), 0.02, 0], size: [PX * 0.7, crack], normal: [0, 0, 1], tone: -1 }]));
    wood.push(buildQuads([{ position: [rng.range(-0.12, 0.12), 0.02, 0], size: [PX * 0.7, 0.55 - crack], normal: [0, 0, -1], tone: -1 }]));
    for (const y of [0.14, 0.44]) {
      metal.push(withTone(plain(new THREE.CylinderGeometry(0.272, 0.272, 0.04, 12)).translate(0, y, 0), 0.05));
    }
    // Un vieux marteau à manche cassé posé à côté sur le sol, du même métal.
    if (rng.chance(0.5)) {
      const a = rng.range(0, 6);
      metal.push(withTone(beam([Math.cos(a) * 0.4, 0.03, Math.sin(a) * 0.4], [Math.cos(a) * 0.55, 0.03, Math.sin(a) * 0.55], 0.03, 0.025), -0.55));
      metal.push(withTone(buildBlock([0.05, 0.05, 0.09], [Math.cos(a) * 0.58, 0.038, Math.sin(a) * 0.58], [0, -a, 0]), (x, y, z, nx, ny) => (ny > 0.5 ? 0.3 : -0.1)));
    }
  } else {
    // --- Dalle de pierre (1,2 × 1,2 × 0,4 m), chanfreinée, gravée d'un cercle de glyphes côtières.
    const slab = buildBlock([1.2, 0.4, 1.2], [0, 0.2, 0], [0, 0, 0], { taper: 0.06 });
    stone.push(withTone(slab, (x, y, z, nx, ny) => (ny > 0.5 ? -0.08 : 0.04)));
    // Bloc d'acier gris (0,6 × 0,6 × 0,5 m), taille claire, chanfrein coupé.
    const blockTop = buildBlock([0.6, 0.5, 0.6], [0, 0.65, 0], [0, 0, 0], { taper: -0.07 });
    metal.push(withTone(blockTop, (x, y, z, nx, ny) => (ny > 0.5 ? 0.35 : 0.02)));
    metal.push(buildQuads([{ position: [0, 0.901, 0], size: [0.34, 0.34], normal: [0, 1, 0], tone: -1 }])); // plaque d'appui sombre (un seul pixel au centre).
    // --- Huit capteurs piézo : points de quartz clair sur le pourtour, câbles fins en bouquet vers la dalle.
    const cables = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rng.range(-0.1, 0.1);
      const x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.3;
      metal.push(withTone(plain(new THREE.CylinderGeometry(PX * 0.45, PX * 0.45, 0.012, 5)).translate(x, 0.905, z), (i % 2 ? 0.55 : 0.45)));
      const drop = [x * 1.35, 0.41 + rng.range(0, 0.05), z * 1.35];
      cables.push([new THREE.Vector3(x, 0.9, z), new THREE.Vector3(drop[0] + 0.05, drop[1] + 0.12, drop[2]), new THREE.Vector3(drop[0], drop[1], drop[2])]);
    }
    let k = 0;
    for (const run of cables) {
      metal.push(withTone(cable([run[0], run[1], run[2]], { radius: PX * 0.35 }), -0.4 + (k % 2) * 0.08));
      k++;
    }
    // Un câble plus épais part du plateau vers l'extérieur de la dalle.
    metal.push(withTone(cable([new THREE.Vector3(0.2, 0.41, 0.4), new THREE.Vector3(0.45, 0.405, 0.62), new THREE.Vector3(0.75, 0.4, 0.75)], { radius: PX * 0.5 }), -0.3));
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const metalMesh = new THREE.Mesh(
    mergeToned(metal),
    p.kind === "smith"
      ? metalMaterial(METALS.castIron, { id: 30, tone: true, steps: [0.3, 0.52, 0.76] })
      : metalMaterial(METALS.iron, { id: 30, tone: true })
  );
  metalMesh.name = "metal";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  group.add(metalMesh);
  const softer = wood.length ? wood : stone;
  if (softer.length) {
    const softerMesh = new THREE.Mesh(
      mergeToned(softer),
      wood.length
        ? createToonMaterial({ ramp: WOODS.oak.ramp, ink: WOODS.oak.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, pattern: "speckle", patternParams: [10, 0.05, 0.12, 1], seed: p.seed % 89, id: 20 })
        : stoneMaterial(STONES.blackBasalt, { seed: p.seed % 89, id: 20 })
    );
    softerMesh.name = wood.length ? "wood" : "stone";
    softerMesh.castShadow = true;
    softerMesh.receiveShadow = true;
    group.add(softerMesh);
  }

  group.userData.asset = { id: meta.id, params: p };
  return group;
}
