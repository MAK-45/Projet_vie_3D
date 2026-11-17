// Console de la porte des étoiles : un autel de pierre d'une civilisation ancienne et savante. Un plateau incliné
// en demi-lune, cerclé de bronze, porte autant de tablettes que l'anneau de la porte a de symboles, rangées en
// hémicycle sur trois arcs, chacune incrustée de cristal. Au centre de l'hémicycle, un petit anneau de bronze dressé,
// réplique de la porte, tient un cœur de cristal en lévitation. Design original du projet.
//
// Elle suit la même séquence que la porte (`props/magic/star-portal`, kit/portal.js) : avec la même graine et le même
// nombre de verrous, la tablette du symbole voulu s'enfonce, la porte verrouille, l'incrustation s'allume et reste
// allumée ; quand l'adresse est complète, le cœur s'éveille, puis s'embrase et tourne pendant que le vortex est
// ouvert. La nuit, ce qui est allumé garde son éclat.
//
// 3 draw calls : pierre (autel, plateau), bronze (cerclage, tablettes, anneau), énergie (incrustations, cœur).

import * as THREE from "three";
import { createGlowLight, createToonMaterial, rgb, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildGem, buildLathe, buildPrism, mergeGeometries } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { portalSequence, portalStateAt } from "../../kit/portal.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";
import { ENERGY_EMISSIVE, ENERGY_STEPS, PORTAL_ENERGIES, energyRamp } from "./star-portal.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const STYLES = { altar: "Autel à degrés", pillar: "Colonne", monolith: "Monolithe" };
const STATES = { cycle: "Composition en boucle", dormant: "Endormie", open: "Porte ouverte" };

const params = {
  seed: seedParam(
    "La même graine que la porte : même adresse, mêmes tablettes pressées au même moment. Change aussi les " +
      "proportions de l'autel et de sa tête, l'inclinaison du plateau et les gradins.",
  ),
  style: choiceParam("Forme", STYLES, "Autel à degrés (pyramide tronquée), colonne à chapiteau, ou monolithe au plateau en surplomb."),
  state: choiceParam("État", STATES, "En boucle (synchronisée avec la porte), endormie, ou figée porte ouverte."),
  locks: { type: "int", default: 7, min: 5, max: 9, label: "Verrous", description: "Le nombre de verrous de la porte qu'elle commande : autant de tablettes pressées." },
  energy: choiceParam("Énergie", PORTAL_ENERGIES, "Couleur des cristaux allumés (la même que la porte)."),
  metal: choiceParam("Métal", METALS, "Garnitures, tablettes et petit anneau : bronze, or ou fer."),
  stone: stoneParam("Pierre de l'autel.", { only: ["granite", "slate", "basalt", "sandstone"] }),
};

export const meta = {
  id: "props/magic/star-portal-dial",
  name: "Console de la porte des étoiles",
  nameEn: "Star portal console",
  category: "props",
  subcategory: "magic",
  description:
    "Autel de pierre et de bronze d'une civilisation ancienne qui commande la porte des étoiles : un plateau incliné " +
    "de tablettes incrustées de cristal (une par symbole de la porte) et, au fond, un petit anneau de bronze qui " +
    "tient un cœur de cristal en lévitation. Les tablettes s'enfoncent et s'allument au rythme de la porte de même " +
    "graine ; le cœur s'embrase et tourne à l'ouverture.",
  tags: [
    "console", "autel", "commande", "porte des étoiles", "portail", "tablettes", "cristaux", "adresse", "bronze",
    "civilisation ancienne", "technologie ancienne", "voyage", "magie", "science-fiction", "pierre", "animé",
    "extérieur",
    "dial", "control panel", "altar", "star portal", "portal", "tablets", "crystals", "address", "ancient technology",
    "travel", "magic", "sci-fi", "stone", "animated", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "desert", "snow", "mountain", "cave", "beach", "swamp"],
  version: 3,
  added: "2026-11-17",
  units: "1 unité = 1 mètre ; origine au sol sous l'autel ; le plateau s'incline vers +Z (on se tient côté +Z pour composer)",
  footprint: { radius: 0.95, height: 1.9 },
  animated: ["dial", "glow"],
  params,
  variants: variantsOf("style", params.style),
};

/**
 * Crée la console.
 * @param {{seed?: number, style?: string, state?: string, locks?: number, energy?: string, metal?: string, stone?: string}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; elle s'anime avec `tick(secondes)`
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const metal = METALS[p.metal];
  const ramp = energyRamp(p.energy);
  const shape = createRng(p.seed * 7919 + 17);
  const seq = portalSequence(p.seed, p.locks);
  const G = seq.glyphs;

  // --- Autel.
  const stoneParts = [];
  const metalParts = [];
  const panelW = shape.range(1.2, 1.36);
  const panelD = shape.range(0.68, 0.78);
  const tilt = shape.range(0.48, 0.62);
  let top; // dessus plat du corps, où se pose la tête
  if (p.style === "altar") {
    // Pyramide tronquée à degrés.
    const tiers = shape.int(2, 3);
    let y = 0, w = panelW + 0.3, d = panelD + 0.35;
    for (let t = 0; t < tiers; t++) {
      const h = shape.range(0.11, 0.15);
      stoneParts.push(buildBlock([w, h, d], [0, y + h / 2, 0]));
      y += h;
      w -= shape.range(0.12, 0.18);
      d -= shape.range(0.1, 0.14);
    }
    const body = shape.range(0.55, 0.65);
    stoneParts.push(buildBlock([w, body, d], [0, y + body / 2, 0], [0, 0, 0], { taper: shape.range(0.08, 0.16) }));
    // Bandeau de métal autour du corps.
    metalParts.push(buildBlock([w * 0.94 + 0.02, 0.06, d * 0.94 + 0.02], [0, y + body * 0.55, 0]));
    top = y + body;
  } else if (p.style === "pillar") {
    const h = shape.range(0.82, 0.92);
    const r = shape.range(0.2, 0.26);
    stoneParts.push(buildBlock([0.8, 0.12, 0.7], [0, 0.06, 0]));
    stoneParts.push(buildLathe([[0, 0.12], [r * 1.35, 0.12], [r * 1.35, 0.2], [r, 0.26], [r * 0.9, h * 0.8], [r * 1.6, h - 0.06], [r * 1.6, h], [0, h]], { segments: 8, facets: true, start: Math.PI / 8 }));
    for (const y of [0.3, h * 0.55]) metalParts.push(buildLathe([[r * 0.98, y], [r * 1.1, y], [r * 1.1, y + 0.05], [r * 0.98, y + 0.05]], { segments: 8, facets: true, start: Math.PI / 8 }));
    // Abaque : une dalle carrée sur le chapiteau, qui porte la tête.
    stoneParts.push(buildBlock([panelW * 0.62, 0.1, panelD * 0.62], [0, h + 0.05, 0]));
    top = h + 0.1;
  } else {
    const h = shape.range(0.8, 0.9);
    const w = panelW * shape.range(0.78, 0.9);
    stoneParts.push(buildBlock([w + 0.2, 0.1, panelD * 0.7 + 0.2], [0, 0.05, 0]));
    stoneParts.push(buildBlock([w, h - 0.1, panelD * 0.66], [0, 0.1 + (h - 0.1) / 2, 0], [0, 0, 0], { taper: -0.06 }));
    // Rainures verticales de métal sur la face avant.
    for (const sx of [-0.28, 0, 0.28]) metalParts.push(buildBlock([0.05, h * 0.6, 0.04], [sx * w, h * 0.45, panelD * 0.33 + 0.01]));
    top = h;
  }

  // --- Tête du pupitre : un bloc de pierre en demi-lune taillé en pente, posé à plat sur le corps ; son dessus
  // incliné vers +Z est le plateau. Le petit anneau se dresse au milieu du bord droit (au fond), les tablettes
  // l'entourent en hémicycle, sur trois arcs. Cerclage de métal sur l'arête du plateau.
  const seat = top; // dessus plat du corps
  const radiusP = panelW / 2;
  const backZ = -panelD * 0.42; // centre de l'hémicycle, dans le repère du plateau
  const cosT = Math.cos(tilt), tanT = Math.tan(tilt);
  const frontEdge = (backZ + radiusP) * cosT; // bord avant du plateau, au sol (z)
  const lip = shape.range(0.12, 0.16); // épaisseur de la tête au bord avant
  const planeAt0 = seat + lip + frontEdge * tanT; // hauteur du plateau en z = 0
  const plate = new THREE.Object3D();
  plate.position.set(0, planeAt0, 0);
  plate.rotation.x = tilt;
  plate.updateMatrix();
  const onPlate = (geometry) => geometry.applyMatrix4(plate.matrix);
  const outline = [];
  const ARC = 14;
  for (let k = 0; k <= ARC; k++) {
    const a0 = -Math.PI / 2 + (k / ARC) * Math.PI;
    outline.push([Math.sin(a0) * radiusP, (backZ + Math.cos(a0) * radiusP) * cosT]);
  }
  stoneParts.push(buildPrism(outline, seat - 0.02, (x, z) => planeAt0 - z * tanT));
  // Cerclage : plaques de métal à cheval sur l'arête ronde du plateau, barre droite au fond.
  for (let k = 0; k < ARC; k++) {
    const a0 = -Math.PI / 2 + (k + 0.5) * (Math.PI / ARC);
    const len = 2 * radiusP * Math.sin(Math.PI / ARC / 2) + 0.02;
    metalParts.push(onPlate(buildBlock([len, 0.06, 0.06], [Math.sin(a0) * (radiusP - 0.01), 0, backZ + Math.cos(a0) * (radiusP - 0.01)], [0, a0, 0])));
  }
  metalParts.push(onPlate(buildBlock([panelW + 0.04, 0.07, 0.07], [0, 0, backZ + 0.015])));
  // Bandeau de métal au pied de la tête.
  metalParts.push(buildPrism(outline.map(([x, z]) => [x * 1.01, z * 1.01 + (z < 0 ? -0.004 : 0)]), seat - 0.03, () => seat + 0.03));

  // --- Tablettes : G tablettes de métal sur trois arcs concentriques, chacune incrustée de cristal.
  const arcs = [0.36, 0.53, 0.7].map((k) => k * (radiusP - 0.08) / 0.7);
  const totalR = arcs.reduce((n, r) => n + r, 0);
  const perArc = arcs.map((r) => Math.round((G * r) / totalR));
  perArc[2] = G - perArc[0] - perArc[1];
  const tablets = []; // par tablette : plage de sommets dans le métal et dans l'énergie
  let metalVertex = metalParts.reduce((n, g) => n + g.attributes.position.count, 0);
  const energyParts = [];
  let energyVertex = 0;
  const span = Math.PI * 0.86;
  for (let arc = 0, j = 0; arc < 3; arc++) {
    const r = arcs[arc];
    const n = perArc[arc];
    const step = span / n;
    const depthK = (arcs[1] - arcs[0]) * 0.8;
    for (let k = 0; k < n; k++, j++) {
      const a0 = -span / 2 + (k + 0.5) * step;
      const x = Math.sin(a0) * r, z = backZ + Math.cos(a0) * r;
      const w = Math.min(0.13, 2 * r * Math.sin(step / 2) * 0.8);
      const tablet = onPlate(buildBlock([w, 0.05, depthK], [x, 0.025, z], [0, a0, 0], { taper: 0.15 }));
      const inlay = onPlate(buildBlock([w * 0.5, 0.02, depthK * 0.5], [x, 0.052, z], [0, a0, 0]));
      tablets.push({
        metal: [metalVertex, metalVertex + tablet.attributes.position.count],
        energy: [energyVertex, energyVertex + inlay.attributes.position.count],
      });
      metalVertex += tablet.attributes.position.count;
      energyVertex += inlay.attributes.position.count;
      metalParts.push(tablet);
      energyParts.push(inlay);
    }
  }

  // --- Petit anneau de métal dressé au centre de l'hémicycle, sur un socle ; cœur de cristal en lévitation.
  const ringR = shape.range(0.17, 0.21);
  const ringBase = new THREE.Vector3(0, 0, backZ + 0.09).applyMatrix4(plate.matrix);
  const ringCenter = ringBase.clone().add(new THREE.Vector3(0, ringR + 0.06, 0));
  const ring = buildLathe([[ringR - 0.065, -0.045], [ringR, -0.045], [ringR, 0.045], [ringR - 0.065, 0.045]], { segments: 20, axis: "z" });
  ring.translate(ringCenter.x, ringCenter.y, ringCenter.z);
  metalParts.push(ring);
  metalParts.push(buildBlock([ringR * 1.3, 0.1, 0.16], [0, ringBase.y + 0.03, ringCenter.z], [0, 0, 0], { taper: 0.3 }));
  for (const sx of [-1, 1]) metalParts.push(buildBlock([0.05, 0.1, 0.05], [sx * 0.6 * ringR, ringBase.y + 0.08, ringCenter.z + 0.07], [0, 0, 0], { taper: 0.4 }));
  const heart = buildGem({ length: ringR * 1.05, radius: ringR * 0.36, sides: 6, waist: 0.5, position: ringCenter.clone() });
  const heartRange = [energyVertex, energyVertex + heart.attributes.position.count];
  const heartFacets = heart.userData.facet;
  energyParts.push(heart);

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const body = new THREE.Mesh(
    mergeGeometries(stoneParts),
    createToonMaterial({ ramp: stone.ramp, ink: stone.ink, steps: [0.34, 0.56, 0.8], pattern: "speckle", patternParams: [16, 0.05, 0.2, 1], seed: shape.int(0, 96), crease: true, id: 10 }),
  );
  body.name = "altar";
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const metalGeometry = mergeGeometries(metalParts);
  const metalBase = Float32Array.from(metalGeometry.attributes.position.array);
  const metalMesh = new THREE.Mesh(metalGeometry, createToonMaterial({ ramp: metal.ramp, ink: metal.ink, steps: [0.36, 0.58, 0.82], crease: true, id: 13 }));
  metalMesh.name = "metal";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  group.add(metalMesh);

  const energyGeometry = mergeGeometries(energyParts);
  const shadeArray = new Float32Array(energyGeometry.attributes.position.count);
  energyGeometry.setAttribute("aShade", new THREE.BufferAttribute(shadeArray, 1));
  const energyBase = Float32Array.from(energyGeometry.attributes.position.array);
  const energy = new THREE.Mesh(
    energyGeometry,
    createToonMaterial({ ramp, steps: ENERGY_STEPS, unlit: true, shade: true, emissive: ENERGY_EMISSIVE, glow: false, id: 12 }),
  );
  energy.name = "crystals";
  group.add(energy);

  // --- Animation : mêmes instants que la porte.
  const press = new THREE.Vector3(0, -0.03, 0).applyEuler(plate.rotation); // une tablette s'enfonce dans le plateau
  const lockOf = new Map(seq.address.map((g, i) => [g, i]));
  const mp = metalGeometry.attributes.position.array;
  const ep = energyGeometry.attributes.position.array;
  let glowLevel = 0;
  function update(time) {
    const s = portalStateAt(seq, time, p.state);
    for (let j = 0; j < G; j++) {
      const lock = lockOf.get(j);
      const level = lock === undefined ? 0 : s.locked[lock];
      let down = 0;
      if (lock !== undefined && p.state === "cycle") {
        const step = seq.steps[lock];
        if (s.t >= step.spinEnd - 0.5 && s.t < step.lockEnd + 0.15) down = 1; // on appuie, la porte répond
      }
      const shade = level >= 1 ? 0.9 : level > 0 ? 1 : down ? 0.6 : 0.24 + (j % 3 === 0 ? 0.1 : 0);
      const { metal: [m0, m1], energy: [e0, e1] } = tablets[j];
      for (let v = m0; v < m1; v++) for (let a = 0; a < 3; a++) mp[v * 3 + a] = metalBase[v * 3 + a] + press.getComponent(a) * down;
      for (let v = e0; v < e1; v++) {
        for (let a = 0; a < 3; a++) ep[v * 3 + a] = energyBase[v * 3 + a] + press.getComponent(a) * down;
        shadeArray[v] = shade;
      }
    }
    // Cœur : s'éveille quand l'adresse est complète, s'embrase et tourne pendant le vortex.
    let heat = 0;
    if (s.horizon === "burst") heat = 1;
    else if (s.horizon === "open") heat = 0.85 + 0.1 * Math.sin(s.t * 4);
    else if (s.horizon === "closing") heat = 0.85 * (1 - s.k);
    if (s.horizon === "off" && s.locked.length && s.locked.every((l) => l >= 1)) heat = 0.6;
    const spin = heat > 0.7 ? time * 2.2 : 0;
    const bob = Math.sin(time * 2) * 0.015;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    for (let v = heartRange[0]; v < heartRange[1]; v++) {
      const bx = energyBase[v * 3] - ringCenter.x, by = energyBase[v * 3 + 1] - ringCenter.y, bz = energyBase[v * 3 + 2] - ringCenter.z;
      ep[v * 3] = ringCenter.x + bx * cs + bz * sn;
      ep[v * 3 + 1] = ringCenter.y + by + bob;
      ep[v * 3 + 2] = ringCenter.z - bx * sn + bz * cs;
      const facet = heartFacets[v - heartRange[0]] % 2;
      shadeArray[v] = 0.28 + facet * 0.14 + heat * 0.6;
    }
    metalGeometry.attributes.position.needsUpdate = true;
    energyGeometry.attributes.position.needsUpdate = true;
    energyGeometry.attributes.aShade.needsUpdate = true;
    glowLevel = Math.max(heat, s.locked.some((l) => l >= 1) ? 0.3 : 0);
  }

  const light = createGlowLight();
  energy.material.addEventListener("dispose", () => light.release());
  const lightColor = rgb(ramp[3]);
  const lightPosition = new THREE.Vector3();
  let lastTime = -1;
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      update(time);
    }
    baseUpdate(force);
    if (glowLevel > 0) light.set(group.localToWorld(lightPosition.copy(ringCenter)), lightColor, 2.8 * glowLevel, 1.2);
    else light.set(lightPosition.set(0, -999, 0), lightColor, 0, 0);
  };
  update(0);
  lastTime = 0;

  group.userData.asset = { id: meta.id, params: p, tablets: G };
  return group;
}
