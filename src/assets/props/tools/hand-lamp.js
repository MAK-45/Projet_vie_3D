// Lampe portative du Complexe (docs/complexe/PIECES.md, SAS-16) : un objet de main de 25 cm, manche gainé de cuir
// (bandes d'un ton), bague et tête de laiton, lentille de 2 px qui luit, petit crochet au talon. Lisible au zoom 3–4.
// Posée debout (lentille vers le haut), couchée au sol, ou « en main » (origine au milieu du manche, faisceau vers +z,
// pour la fixer à la main d'un personnage : `userData.grip`, `userData.beamDirection`).
// Allumée ou éteinte, lueur ambre ou cyan. Options : halo (elle éclaire le décor dans le noir : une des lumières de
// halo du moteur) et faisceau (un cône tramé qui s'efface au loin, coupé par défaut).
// La graine change la longueur du manche, les bandes de cuir et leur usure, une bague de plus, le crochet.
//
// 2 draw calls (3 avec le faisceau) : laiton et cuir (une seule rampe, le cuir en tons sombres), lentille, faisceau.

import * as THREE from "three";
import { createGlowLight, createToonMaterial, rgb } from "../../../engine/toon-material.js";
import { buildLathe } from "../../kit/geometry.js";
import { GLOWS, METALS } from "../../kit/palettes.js";
import { PX, glowMaterial, mergeToned, metalMaterial, plain, ring, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, glowParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const POSES = { standing: "Debout (lentille en haut)", lying: "Couchée au sol", hand: "En main (origine au manche)" };
const STATES = { lit: "Allumée", off: "Éteinte" };
const BEAM_LENGTH = 2.6;

const params = {
  seed: seedParam("Change la longueur du manche, les bandes de cuir et leur usure, une bague de plus, le crochet du talon."),
  pose: choiceParam("Pose", POSES, "Debout, couchée au sol, ou en main : origine au milieu du manche et faisceau vers +z (userData.grip, userData.beamDirection)."),
  state: choiceParam("État", STATES, "Allumée (lentille vive) ou éteinte (verre sombre)."),
  glow: glowParam("Couleur de la lentille et de sa lumière.", { only: ["amber", "cyan"] }),
  halo: choiceParam("Halo", { off: "Sans halo", on: "Éclaire le décor (dans le noir)" }, "Allumée : éclaire le décor devant elle dans le noir (une des lumières de halo du moteur)."),
  beam: choiceParam("Faisceau", { off: "Sans faisceau", on: "Cône tramé" }, "Allumée : un cône de lumière tramé de 2,6 m, qui s'efface au loin."),
};

export const meta = {
  id: "props/tools/hand-lamp",
  name: "Lampe portative",
  nameEn: "Hand lamp",
  category: "props",
  subcategory: "tools",
  description:
    "Lampe à main du Complexe : manche gainé de cuir, bague et tête de laiton, lentille qui luit en ambre ou en cyan, " +
    "crochet au talon. Debout, couchée ou en main (point de prise fourni) ; halo qui éclaire le décor dans le noir, " +
    "faisceau tramé en option. Fiche SAS-16.",
  tags: [
    "lampe portative", "lampe torche", "lampe", "lanterne de main", "lentille", "faisceau", "cuir", "laiton", "outil",
    "le complexe", "complexe", "ancien-tech", "objet de main", "lumière", "intérieur",
    "hand lamp", "flashlight", "lamp", "hand lantern", "lens", "light beam", "leather", "brass", "tool",
    "ancient complex", "ancient-tech", "handheld", "light source", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; debout et couchée : origine au sol ; en main : origine au milieu du manche, faisceau vers +z",
  footprint: { radius: 0.14, height: 0.26 },
  animated: ["glow"],
  params,
  variants: variantsOf("pose", params.pose),
};

/**
 * Crée la lampe.
 * @param {{seed?: number, pose?: string, state?: string, glow?: string, halo?: string, beam?: string}} [given]
 * @returns {THREE.Group} `userData.grip` (point de prise), `userData.beamDirection`, `userData.lightPoint`
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 67);
  const lit = p.state === "lit";
  const parts = [];

  // Construite le long de +z, talon en z = 0.
  const handle = rng.range(0.14, 0.18);
  const r = 0.02;
  const tube = (r0, r1, z0, z1, tone, sides = 6) => {
    const g = buildLathe([[0, z0], [r0, z0], [r1, z1], [0, z1]], { segments: sides, axis: "z", facets: true });
    parts.push(withTone(g, tone));
  };
  // Talon : capuchon de laiton et crochet.
  tube(0.022, 0.022, 0, 0.016, 0.1);
  const hook = ring({ radius: 0.012, height: PX * 0.5, thickness: PX * 0.4, segments: 6 });
  hook.rotateZ(Math.PI / 2);
  hook.rotateY(rng.range(-0.5, 0.5));
  hook.translate(0, 0, -0.012);
  parts.push(withTone(plain(hook), 0.2));
  // Manche gainé : bandes de cuir alternées, l'usure éclaircit une bande ou deux.
  const bands = rng.int(5, 7);
  const leather = -0.62;
  for (let i = 0; i < bands; i++) {
    const z0 = 0.016 + (handle * i) / bands, z1 = 0.016 + (handle * (i + 1)) / bands;
    const wear = rng.chance(0.25) ? 0.12 : 0;
    tube(r, r, z0, z1, leather + (i % 2 ? 0.1 : 0) + wear);
  }
  // Bague (une deuxième selon la graine), tête évasée, couronne de la lentille.
  const z = 0.016 + handle;
  tube(0.026, 0.026, z, z + 0.02, 0.25, 8);
  if (rng.chance(0.5)) {
    const zb = 0.016 + handle * rng.range(0.3, 0.6);
    tube(0.024, 0.024, zb, zb + 0.012, 0.18, 8);
  }
  tube(0.028, 0.05, z + 0.02, z + 0.065, 0.05, 8);
  tube(0.053, 0.053, z + 0.065, z + 0.08, 0.3, 8);
  const lensZ = z + 0.078;
  const total = lensZ + 0.006;

  // Lentille : 2 px de diamètre, en retrait d'un rien dans la couronne.
  const lens = buildLathe([[0, lensZ - 0.004], [0.042, lensZ - 0.004], [0.042, lensZ + 0.004], [0, lensZ + 0.004]], { segments: 8, axis: "z", facets: true });

  // Faisceau : cône ouvert, de la lentille jusqu'à 2,6 m ; la part des pixels dessinés baisse avec la distance.
  let beamGeometry = null;
  if (lit && p.beam === "on") {
    const g = plain(new THREE.CylinderGeometry(0.62, 0.045, BEAM_LENGTH, 10, 6, true));
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, lensZ + BEAM_LENGTH / 2);
    const pos = g.attributes.position;
    const cover = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) cover[i] = 0.42 * Math.max(0, 1 - (pos.getZ(i) - lensZ) / BEAM_LENGTH) ** 1.4;
    g.setAttribute("aCover", new THREE.BufferAttribute(cover, 1));
    beamGeometry = g;
  }

  // --- Pose : matrice qui place la lampe construite le long de +z.
  const place = new THREE.Matrix4();
  if (p.pose === "standing") {
    place.makeRotationX(-Math.PI / 2); // +z → +y, talon au sol
  } else if (p.pose === "lying") {
    // Couchée : la tête (rayon 5,3 cm) et le talon (2,2 cm) touchent le sol ; elle regarde un peu vers le haut.
    const tilt = Math.atan2(0.053 - 0.022, total);
    place.makeRotationX(-tilt).premultiply(new THREE.Matrix4().makeTranslation(0, 0.022, -total / 2));
  } else {
    place.makeTranslation(0, 0, -(0.016 + handle / 2)); // origine au milieu du manche
  }

  const group = new THREE.Group();
  group.name = meta.name;
  const bodyGeometry = mergeToned(parts);
  bodyGeometry.applyMatrix4(place);
  const body = new THREE.Mesh(bodyGeometry, metalMaterial(METALS.blackenedBrass, { id: 21, tone: true }));
  body.name = "body";
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  lens.applyMatrix4(place);
  const lensMaterial = glowMaterial(p.glow, { level: lit ? 3 : 0, id: 22 });
  const lensMesh = new THREE.Mesh(lens, lensMaterial);
  lensMesh.name = "lens";
  group.add(lensMesh);

  if (beamGeometry) {
    beamGeometry.applyMatrix4(place);
    const color = GLOWS[p.glow].ramp[2];
    const beamMesh = new THREE.Mesh(beamGeometry, createToonMaterial({ ramp: [color, color], steps: [0.5], unlit: true, emissive: 0.01, glow: false, outline: false, dither: true, id: 23 }));
    beamMesh.name = "beam";
    group.add(beamMesh);
  }

  const toPlaced = (v) => v.applyMatrix4(place);
  const lightPoint = toPlaced(new THREE.Vector3(0, 0, lensZ));
  const beamDirection = toPlaced(new THREE.Vector3(0, 0, lensZ + 1)).sub(lightPoint).normalize();
  group.userData.grip = toPlaced(new THREE.Vector3(0, 0, 0.016 + handle / 2));
  group.userData.beamDirection = beamDirection;
  group.userData.lightPoint = lightPoint;

  // Halo : posé un peu devant la lentille, pour éclairer ce que la lampe regarde.
  if (lit && p.halo === "on") {
    const halo = createGlowLight();
    lensMaterial.addEventListener("dispose", () => halo.release());
    const color = rgb(GLOWS[p.glow].light);
    const at = lightPoint.clone().addScaledVector(beamDirection, 0.6);
    const world = new THREE.Vector3();
    const baseUpdate = group.updateMatrixWorld.bind(group);
    group.updateMatrixWorld = (force) => {
      baseUpdate(force);
      halo.set(group.localToWorld(world.copy(at)), color, 2.4, 1.2);
    };
  }

  group.userData.asset = { id: meta.id, params: p };
  return group;
}
