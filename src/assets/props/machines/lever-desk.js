// Pupitre à leviers du Complexe (fiches SAS-08, GAL-09, E2-01, docs/complexe/) : un plan incliné sur un piètement,
// des leviers de laiton, des cadrans ronds de 2 px, une plaque gravée.
// - vérification (Sas) : 1,0 × 0,5 × 1,2 m, plan à 20°, 8 leviers de 4 px (un sur deux abaissé selon la graine),
//   4 cadrans, piètement de pierre ;
// - garde (galerie) : registre relié de cuir ouvert sur le plan, 10 voyants ambre d'un pixel (un par salle d'étude,
//   allumés selon les salles ouvertes), 4 leviers ;
// - lecteur (salle 2) : bronze et bois, fente inclinée à 30° (lueur cyan quand la cassette y est), 2 volants,
//   lentille de lecture, 3 galvanomètres.
// Pilotage : `group.userData.desk` (setLever(i, abaissé), setLights(n), setCassette(oui)).
//
// 3 draw calls : piètement (pierre ou bois), laiton/bronze (plan, leviers, cadrans), lueurs (voyants, fente).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildPrism } from "../../kit/geometry.js";
import { FABRICS, METALS, STONES, WOODS } from "../../kit/palettes.js";
import {
  PX, beam, bulb, dial, faceMatrix, glowLevels, glowMixMaterial, glyphStrip, lever, mergeToned, metalMaterial, orient, plain,
  ring, stoneMaterial, withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = { check: "Vérification (Sas)", guard: "Poste de garde (galerie)", reader: "Lecteur d'étude (salle 2)" };
const CASSETTE = { empty: "Fente vide", loaded: "Cassette engagée (lueur cyan)" };

const params = {
  seed: seedParam("Change les leviers abaissés, les aiguilles, les glyphes de la plaque, la page du registre, l'usure."),
  model: choiceParam("Modèle", MODELS, "Pupitre de vérification du Sas, poste de garde de la galerie, ou lecteur de cassette de la salle 2."),
  lights: numberParam("Salles ouvertes", 3, 0, 10, "Poste de garde : nombre de voyants ambre allumés (un par salle d'étude ouverte).", { step: 1 }),
  cassette: choiceParam("Cassette", CASSETTE, "Lecteur : fente vide, ou cassette engagée (la fente luit en cyan)."),
};

export const meta = {
  id: "props/machines/lever-desk",
  name: "Pupitre à leviers",
  nameEn: "Lever desk",
  category: "props",
  subcategory: "machines",
  description:
    "Pupitre incliné du Complexe : leviers de laiton, cadrans ronds, plaque gravée de glyphes, sur un piètement. " +
    "Pupitre de vérification du Sas (8 leviers, 4 cadrans), poste de garde de la galerie (registre de cuir, 10 " +
    "voyants ambre, un par salle ouverte) ou lecteur d'étude de la salle 2 (fente à cassette qui luit en cyan, " +
    "volants, lentille, galvanomètres). Leviers, voyants et fente pilotables. Fiches SAS-08, GAL-09, E2-01.",
  tags: [
    "pupitre", "console", "leviers", "cadrans", "voyants", "registre", "lecteur", "cassette", "galvanomètre", "laiton",
    "le complexe", "complexe", "ancien-tech", "machine", "commande", "pilotable", "intérieur",
    "lever desk", "control desk", "levers", "gauges", "indicator lights", "ledger", "tape reader", "brass",
    "ancient complex", "ancient-tech", "control", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; origine au sol, au centre ; l'opérateur se tient côté +z, face au plan incliné",
  footprint: { radius: 0.7, height: 1.35 },
  animated: ["desk"],
  params,
  variants: variantsOf("model", params.model),
};

/**
 * Crée le pupitre.
 * @param {{seed?: number, model?: string, lights?: number, cassette?: string}} [given]
 * @returns {THREE.Group} `group.userData.desk` : { levers, setLever(i, down), lights, setLights(n), setCassette(on) }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 59);
  const model = p.model;
  const reader = model === "reader";
  const [W, Dp, Ht] = reader ? [0.8, 0.5, 1.0] : model === "guard" ? [1.0, 0.5, 1.1] : [1.0, 0.5, 1.2];
  const tilt = THREE.MathUtils.degToRad(reader ? 25 : 20);
  const baseParts = [];
  const metalParts = [];
  const glowParts = [];

  // --- Piètement : pierre fumée (bloc à gorge) ou bois noirci sur cadre de bronze (lecteur).
  const footH = Ht - 0.25;
  if (!reader) {
    baseParts.push(withTone(buildBlock([W - 0.14, 0.08, Dp - 0.08], [0, 0.04, 0]), -0.25));
    baseParts.push(withTone(buildBlock([W - 0.22, footH - 0.16, Dp - 0.16], [0, 0.08 + (footH - 0.16) / 2, -0.02]), rng.range(-0.06, 0.06)));
    baseParts.push(withTone(buildBlock([W - 0.12, 0.08, Dp - 0.06], [0, footH - 0.04, 0]), 0.1));
    baseParts.push(withTone(buildBlock([W - 0.24, PX, 0.01], [0, footH * 0.5, Dp / 2 - 0.096]), -0.7)); // gorge
  } else {
    baseParts.push(withTone(buildBlock([W - 0.06, footH - 0.1, Dp - 0.1], [0, 0.1 + (footH - 0.1) / 2, 0]), (x, y) => (y > footH - 0.05 ? 0.1 : 0)));
    for (let k = 0; k < 3; k++) baseParts.push(withTone(buildBlock([W - 0.1, PX * 0.4, 0.01], [0, 0.25 + k * 0.17, Dp / 2 - 0.045]), -0.5)); // planches
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) metalParts.push(withTone(buildBlock([0.05, 0.1, 0.05], [sx * (W / 2 - 0.05), 0.05, sz * (Dp / 2 - 0.06)]), -0.1));
    metalParts.push(withTone(buildBlock([W, 0.03, Dp - 0.06], [0, footH - 0.015, 0]), 0.1));
  }

  // --- Plan incliné : un coffre de bronze dont le dessus penche vers l'opérateur (+z).
  // Repère du plan : origine au centre du dessus, normale `n`, `u` le long de x, `v` vers le haut de la pente.
  const deskDepth = Dp + 0.04;
  const backH = deskDepth * Math.sin(tilt) + 0.08;
  const center = new THREE.Vector3(0, footH + 0.04 + backH / 2, 0.02);
  const n = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt));
  const v = new THREE.Vector3(0, Math.sin(tilt), -Math.cos(tilt));
  const at = (u, w, lift = 0) => center.clone().add(new THREE.Vector3(u, 0, 0)).addScaledVector(v, w).addScaledVector(n, lift);
  // Coffre en prisme : flancs trapèzes (bloc avant bas, bloc arrière haut), dessus incliné.
  metalParts.push(withTone(buildBlock([W, 0.08, deskDepth], [0, footH + 0.04, 0.02]), -0.2));
  const slab = buildBlock([W, 0.04, deskDepth / Math.cos(tilt) * 0.98], [0, 0, 0]);
  slab.rotateX(tilt);
  slab.translate(center.x, center.y, center.z);
  metalParts.push(withTone(slab, -0.32)); // plan sombre : cadrans et pommeaux ressortent
  // Coffre sous le plan : un prisme dont le dessus suit la pente (un peu sous la tôle).
  const zf = center.z + deskDepth / 2 - 0.02, zb = center.z - deskDepth / 2 + 0.02, hx = W / 2 - 0.01;
  const fill = plain(buildPrism([[-hx, zb], [hx, zb], [hx, zf], [-hx, zf]], footH + 0.04, (x, z) => center.y + (center.z - z) * Math.tan(tilt) - 0.025));
  metalParts.push(withTone(fill, -0.3));
  const halfV = (deskDepth / Math.cos(tilt)) * 0.47;
  // Rebord d'un pixel tout autour du plan, rivets sur le bord haut.
  for (const s of [-1, 1]) metalParts.push(withTone(beam(at(s * (W / 2 - PX / 2), -halfV, 0.03), at(s * (W / 2 - PX / 2), halfV, 0.03), PX, PX * 0.8, 0, n), 0.2));
  metalParts.push(withTone(beam(at(-W / 2, -halfV, 0.03), at(W / 2, -halfV, 0.03), PX, PX * 0.8, 0, n), 0.3));
  // Plaque gravée de glyphes (en haut du plan).
  const plate = (u, w, width, height) => {
    const m = faceMatrix(at(u, w, 0.021), n);
    const g = buildBlock([width, height, 0.008], [0, 0, 0.004]);
    g.applyMatrix4(m);
    metalParts.push(withTone(g, 0.35));
    const strip = glyphStrip(rng, { length: width - 0.04, rows: 2, pixel: PX * 0.5, depth: 0.004 });
    strip.translate(0, -PX * 0.5, 0.008);
    strip.applyMatrix4(m);
    metalParts.push(withTone(strip, -0.9));
  };

  // Leviers : géométrie à part (une plage de sommets chacun), basculés sur le CPU quand la scène les pilote.
  const leverParts = [];
  const levers = [];
  const addLever = (u, w, length) => {
    const index = levers.length;
    const down = rng.chance(0.5);
    const l = lever({ length, angle: 1.15, position: at(u, w, 0.02), normal: n, width: PX * 0.7 });
    const geometry = mergeToned([withTone(l.rod, 0.1), withTone(l.knob, 0.35)]);
    levers.push({ index, down, pivot: at(u, w, 0.02), geometry });
    leverParts.push(geometry);
    // Fente-guide sous le levier, vers l'opérateur.
    const m = faceMatrix(at(u, w - length * 0.3, 0.021), n);
    const g = buildBlock([PX * 0.8, length * 0.8, 0.004], [0, 0, 0]);
    g.applyMatrix4(m);
    metalParts.push(withTone(g, -0.9));
  };
  const addDial = (u, w, radius, ticks = 6) => {
    const d = dial({ radius, position: at(u, w, 0.02), normal: n, ticks, needle: rng.range(-2.2, 2.2), depth: PX * 0.3 });
    metalParts.push(withTone(d.face, 0.6), withTone(d.marks, -1));
    metalParts.push(withTone(orient(ring({ radius, height: PX * 0.4, thickness: PX * 0.4, segments: 10 }), at(u, w, 0.02), n), -0.2));
  };

  const lights = [];
  let slot = null;
  if (model === "check") {
    plate(0, halfV - 0.07, 0.42, 0.08);
    for (let i = 0; i < 4; i++) addDial(-W * 0.36 + i * W * 0.24, halfV * 0.4, PX * 1.7);
    for (let i = 0; i < 8; i++) addLever(-W * 0.4 + i * (W * 0.8 / 7), -halfV * 0.45, PX * 4);
  } else if (model === "guard") {
    plate(W * 0.25, halfV - 0.06, 0.3, 0.07);
    // Registre relié de cuir, ouvert : deux pages claires sur une couverture sombre, tourné un peu.
    const m = faceMatrix(at(-W * 0.18, 0, 0.02), n, rng.range(-0.15, 0.15));
    const cover = withTone(buildBlock([0.46, 0.32, 0.02], [0, 0, 0.01]), -0.6);
    cover.applyMatrix4(m);
    baseParts.push(cover);
    for (const s of [-1, 1]) {
      // Pages : dans la pierre, au ton le plus clair (papier gris jauni).
      const page = withTone(buildBlock([0.2, 0.28, 0.012], [s * 0.112, 0, 0.025], [0, s * 0.06, 0]), 0.6);
      page.applyMatrix4(m);
      baseParts.push(page);
      const lines = rng.int(4, 7);
      for (let k = 0; k < lines; k++) {
        const ln = withTone(buildBlock([rng.range(0.08, 0.16), PX * 0.4, 0.004], [s * 0.112 - 0.02, 0.1 - k * 0.04, 0.033]), -0.3);
        ln.applyMatrix4(m);
        baseParts.push(ln);
      }
    }
    // 10 voyants ambre d'un pixel en rangée, 4 leviers.
    for (let i = 0; i < 10; i++) {
      const pos = at(W * 0.04 + i * 0.042, halfV * 0.3, 0.03);
      const g = bulb({ radius: PX * 0.75, position: [pos.x, pos.y, pos.z], segments: 4 });
      lights.push({ start: 0, count: g.attributes.position.count, geometry: g });
      glowParts.push(g);
      metalParts.push(withTone(orient(ring({ radius: PX * 0.55, height: PX * 0.3, thickness: PX * 0.3, segments: 6 }), at(W * 0.04 + i * 0.042, halfV * 0.3, 0.02), n), -0.3));
    }
    for (let i = 0; i < 4; i++) addLever(W * 0.1 + i * 0.09, -halfV * 0.45, PX * 4);
  } else {
    // Fente à cassette (0,31 × 0,15 m) : un cadre de bronze en relief, l'intérieur qui luit quand la cassette est là.
    const m = faceMatrix(at(0, halfV * 0.05, 0.02), n);
    for (const [sx, sy, px, py] of [[0.35, PX, 0, 0.085], [0.35, PX, 0, -0.085], [PX, 0.17, 0.175, 0], [PX, 0.17, -0.175, 0]]) {
      const g = withTone(buildBlock([sx, sy, 0.04], [px, py, 0.02]), 0.2);
      g.applyMatrix4(m);
      metalParts.push(g);
    }
    const slotGeometry = buildBlock([0.31, 0.15, 0.01], [0, 0, 0.012]);
    slotGeometry.applyMatrix4(m);
    slot = slotGeometry;
    glowParts.push(slotGeometry);
    // 2 volants (2 px), lentille de lecture, 3 galvanomètres.
    for (const s of [-1, 1]) {
      const c = at(s * 0.3, -halfV * 0.5, 0.03);
      metalParts.push(withTone(orient(ring({ radius: PX * 1.6, height: PX * 0.6, thickness: PX * 0.6, segments: 10 }), c, n), 0.15));
      metalParts.push(withTone(beam(c.clone().addScaledVector(n, -0.02), c.clone().addScaledVector(n, 0.03), PX, PX), 0));
    }
    const lens = at(0, -halfV * 0.55, 0.02);
    metalParts.push(withTone(orient(plain(new THREE.CylinderGeometry(0.05, 0.06, 0.07, 10)), lens.clone().addScaledVector(n, 0.035), n), -0.1));
    const lensGlass = orient(plain(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10)), lens.clone().addScaledVector(n, 0.072), n);
    glowParts.push(lensGlass);
    // Galvanomètres : une petite boîte inclinée vers l'opérateur au-dessus du pupitre.
    const boxCenter = at(0, halfV - 0.04, 0).add(new THREE.Vector3(0, 0.1, 0));
    metalParts.push(withTone(buildBlock([W * 0.7, 0.22, 0.08], [boxCenter.x, boxCenter.y - 0.02, boxCenter.z - 0.02]), -0.45));
    for (let i = 0; i < 3; i++) {
      const d = dial({ radius: PX * 1.5, position: [boxCenter.x - 0.17 + i * 0.17, boxCenter.y + 0.01, boxCenter.z + 0.021], normal: [0, 0.25, 1], ticks: 5, needle: rng.range(-1.2, 1.2), depth: PX * 0.3 });
      metalParts.push(withTone(d.face, 0.6), withTone(d.marks, -1));
    }
  }

  // --- Lueurs : voyants (ambre, 0 éteint / 2 allumé), fente et lentille (cyan, 0 éteinte / 3 vive).
  const glowColors = [...glowLevels("amber").slice(0, 3), glowLevels("cyan")[0], glowLevels("cyan")[3]];
  const AMBER_OFF = 0, AMBER_ON = 2, CYAN_OFF = 3, CYAN_ON = 4;
  let glowGeometry = null;
  if (glowParts.length) {
    for (const g of glowParts) withShade(g, g === slot || glowParts.indexOf(g) >= lights.length ? CYAN_OFF : AMBER_OFF, glowColors.length);
    glowGeometry = mergeToned(glowParts);
  }
  // Plages de sommets des voyants et de la fente dans la géométrie fusionnée.
  let cursor = 0;
  const ranges = glowParts.map((g) => {
    const r = { start: cursor, count: g.attributes.position.count };
    cursor += r.count;
    return r;
  });
  const shade = glowGeometry?.attributes.aShade;
  const setRange = (r, value) => {
    for (let k = r.start; k < r.start + r.count; k++) shade.setX(k, (value + 0.5) / glowColors.length);
    shade.needsUpdate = true;
  };

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const baseMaterial = reader
    ? createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.32, 0.55, 0.8], tone: true, crease: true, id: 20 })
    : stoneMaterial(STONES.smoked, { seed: rng.int(0, 96), id: 20, grain: 0.07 });
  // Le registre (couverture de cuir) va dans le piètement s'il est en pierre : on lui donne le ton sombre du cuir.
  const base = new THREE.Mesh(mergeToned(baseParts), baseMaterial);
  base.name = "base";
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const metalGeometry = mergeToned([...metalParts, ...leverParts]);
  const metal = new THREE.Mesh(metalGeometry, metalMaterial(reader ? METALS.patinatedBronze : METALS.blackenedBrass, { id: 30, tone: true }));
  metal.name = "desk";
  metal.castShadow = true;
  metal.receiveShadow = true;
  group.add(metal);

  if (glowGeometry) {
    const glow = new THREE.Mesh(glowGeometry, glowMixMaterial(glowColors, { id: 40 }));
    glow.name = "lights";
    group.add(glow);
  }

  // --- Leviers pilotables : tige et pommeau tournés autour du pivot, dans le plan (u fixe), vers l'opérateur.
  const position = metalGeometry.attributes.position;
  const normal = metalGeometry.attributes.normal;
  let start = metalParts.reduce((sum, g) => sum + g.attributes.position.count, 0);
  const basePos = position.array.slice();
  const baseNormal = normal.array.slice();
  const axis = new THREE.Vector3(1, 0, 0);
  const rot = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  for (const l of levers) {
    l.start = start;
    l.count = l.geometry.attributes.position.count;
    start += l.count;
  }
  const poseLever = (l) => {
    rot.makeRotationAxis(axis, l.down ? 0.75 : 0); // abaissé : basculé vers l'opérateur
    for (let k = l.start; k < l.start + l.count; k++) {
      tmp.fromArray(basePos, k * 3).sub(l.pivot).applyMatrix4(rot).add(l.pivot);
      position.setXYZ(k, tmp.x, tmp.y, tmp.z);
      tmp.fromArray(baseNormal, k * 3).applyMatrix4(rot);
      normal.setXYZ(k, tmp.x, tmp.y, tmp.z);
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
  };
  for (const l of levers) poseLever(l);

  const desk = {
    levers: levers.map((l) => l.down),
    setLever(i, down) {
      const l = levers[i];
      if (!l) return;
      l.down = !!down;
      desk.levers[i] = l.down;
      poseLever(l);
    },
    lights: 0,
    setLights(count) {
      desk.lights = Math.max(0, Math.min(lights.length, Math.round(count)));
      lights.forEach((_, i) => setRange(ranges[i], i < desk.lights ? AMBER_ON : AMBER_OFF));
    },
    cassette: false,
    setCassette(on) {
      desk.cassette = !!on;
      for (let i = lights.length; i < ranges.length; i++) setRange(ranges[i], on ? CYAN_ON : CYAN_OFF);
    },
  };
  if (lights.length) desk.setLights(p.lights);
  if (reader) desk.setCassette(p.cassette === "loaded");

  group.userData.desk = desk;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
