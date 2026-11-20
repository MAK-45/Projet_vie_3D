// Appareils à manivelle du Complexe (fiches ARC-11, ETU-05 et E4-06, docs/complexe/).
// - Visionneuse (Archives) : 0,5 × 0,4 × 0,6 m, boîtier de bois noirci cerclé de bronze, deux oculaires d'un pixel sur
//   le capot, deux bobines au dos, et sur la face avant une petite fenêtre ambre où défilent les traits d'une bande.
// - Enregistreur à tambour (kit d'étude) : 0,6 × 0,4 × 0,5 m, tambour de papier enfumé (gris clair) de Ø 0,20 × 0,30 m
//   où court une trace sombre, stylet à contrepoids posé dessus.
// - Enregistreur à cylindre (salle 4) : 0,5 × 0,35 × 0,4 m, cylindre de cire brun clair rayé de sillons, stylet sous
//   un pavillon de laiton, socle de bois.
// Chacun a sa manivelle, qui tourne avec le mécanisme quand l'appareil est en marche (à 12 images/s).
// La graine change la trace du tambour, l'orientation du pavillon, la place du stylet, les traits de la bande, la
// position de la manivelle à l'arrêt, les tons du bois. `group.userData.recorder.setRunning(vrai | faux)`.
//
// 2 ou 3 draw calls : métal ; bois, papier ou cire ; lueur de la fenêtre (visionneuse).

import * as THREE from "three";
import { createToonMaterial, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe, buildQuads, buildRibbon } from "../../kit/geometry.js";
import { METALS, WOODS } from "../../kit/palettes.js";
import {
  PX, beam, createRigidParts, glowLevels, glowMixMaterial, mergeParts, metalMaterial, plain, withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = {
  viewer: "Visionneuse (fenêtre ambre, oculaires)",
  drum: "Enregistreur à tambour (papier enfumé)",
  cylinder: "Enregistreur à cylindre (cire, pavillon)",
};
const STATES = { idle: "À l'arrêt", running: "En marche" };
// Papier enfumé (gris clair, ombre bleutée) et cire (brun clair) : propres à ces appareils.
const PAPER = { ramp: ["#2c2d36", "#8a8c96", "#b8b8bc", "#e2e0d8"], ink: "#24252c" };
const WAX = { ramp: ["#4e3020", "#86562f", "#b88447", "#e0b778"], ink: "#2a180f" };
const FIXED = 255;
const TURN = Math.PI * 2 / 1.6; // un tour de manivelle en 1,6 s

const params = {
  seed: seedParam("Change la trace du tambour, les traits de la bande, l'orientation du pavillon, la place du stylet, la manivelle à l'arrêt, les tons du bois."),
  kind: choiceParam("Appareil", KINDS, "Visionneuse des Archives, enregistreur à tambour du kit d'étude, ou enregistreur à cylindre de la salle 4."),
  state: choiceParam("État", STATES, "À l'arrêt, ou en marche : la manivelle tourne, le tambour ou le cylindre aussi, la bande défile."),
};

export const meta = {
  id: "props/machines/crank-recorder",
  name: "Appareil à manivelle",
  nameEn: "Crank recorder",
  category: "props",
  subcategory: "machines",
  description:
    "Petit appareil à manivelle du Complexe, à poser sur une table : visionneuse de bois et de bronze à deux " +
    "oculaires, dont la fenêtre ambre fait défiler une bande ; enregistreur à tambour de papier enfumé où un stylet " +
    "trace une ligne sombre ; enregistreur à cylindre de cire sous un pavillon de laiton. En marche, la manivelle et " +
    "le mécanisme tournent. Fiches ARC-11, ETU-05, E4-06.",
  tags: [
    "visionneuse", "enregistreur", "manivelle", "tambour", "cylindre", "cire", "papier enfumé", "stylet", "pavillon",
    "oculaires", "bande", "bobines", "bois noirci", "bronze", "laiton", "le complexe", "complexe", "ancien-tech",
    "instrument", "animé", "pilotable", "intérieur",
    "viewer", "recorder", "crank", "drum", "wax cylinder", "smoked paper", "stylus", "horn", "eyepieces", "film strip",
    "reels", "blackened wood", "brass", "ancient complex", "ancient-tech", "device", "animated", "scriptable", "indoor",
    "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unité = 1 mètre ; origine au centre du dessous (à poser sur un plateau) ; face avant vers +z, manivelle côté +x",
  footprint: { radius: 0.42, height: 0.6 },
  animated: ["crank"],
  params,
  variants: [
    { id: "viewer", name: "Visionneuse", params: {} },
    { id: "drum", name: "Tambour", params: { kind: "drum" } },
    { id: "cylinder", name: "Cylindre", params: { kind: "cylinder" } },
  ],
};

/**
 * Crée l'appareil.
 * @param {{seed?: number, kind?: string, state?: string}} [given]
 * @returns {THREE.Group} `group.userData.recorder` : { running, angle, setRunning(bool) }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 503);
  const metal = [], body = [], wax = [], glow = [];
  // Pièces : 0 = rotor (tambour ou cylindre), 1 à 4 = traits de la bande, 5 et 6 = bobines, 7 = manivelle.
  const rotor = new THREE.Vector3();
  const crank = new THREE.Vector3(); // moyeu de la manivelle, sur le flanc +x
  const reels = [];
  const stripes = [];
  let strip = null; // fenêtre de la visionneuse

  // Manivelle : moyeu, bras de 0,15 m, poignée qui dépasse vers +x. Construite bras vers le bas.
  const addCrank = (at, arm = 0.15, part = 7) => {
    crank.copy(at);
    const hub = plain(new THREE.CylinderGeometry(0.026, 0.026, 0.03, 8)).rotateZ(Math.PI / 2).translate(at.x + 0.015, at.y, at.z);
    metal.push([withTone(hub, 0.2), part]);
    metal.push([withTone(beam([at.x + 0.032, at.y, at.z], [at.x + 0.032, at.y - arm, at.z], 0.02, 0.018), 0.05), part]);
    const knob = plain(new THREE.CylinderGeometry(0.016, 0.018, 0.06, 6)).rotateZ(Math.PI / 2).translate(at.x + 0.07, at.y - arm, at.z);
    metal.push([withTone(knob, -0.55), part]); // poignée de bois sombre
  };

  if (p.kind === "viewer") {
    // --- Socle de bronze, boîtier de bois cerclé aux angles, capot et oculaires, bobines au dos.
    metal.push([withTone(buildBlock([0.5, 0.04, 0.4], [0, 0.02, 0]), (x, y, z, nx, ny) => (ny > 0.5 ? 0.05 : -0.15)), FIXED]);
    const woodTone = rng.range(-0.06, 0.08);
    body.push([withTone(buildBlock([0.4, 0.34, 0.3], [0, 0.21, 0]), (x, y, z, nx, ny) => woodTone + (ny > 0.5 ? 0.1 : 0) + (Math.abs(x) < 0.12 && nx === 0 && ny === 0 ? 0 : -0.05)), FIXED]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      metal.push([withTone(buildBlock([0.035, 0.345, 0.035], [sx * 0.19, 0.21, sz * 0.14]), 0.05), FIXED]);
    }
    metal.push([withTone(buildBlock([0.41, 0.025, 0.31], [0, 0.39, 0]), 0.1), FIXED]); // bandeau du haut
    // Capot : un bloc plus étroit, un peu en arrière, avec les deux oculaires inclinés vers l'avant.
    body.push([withTone(buildBlock([0.3, 0.07, 0.19], [0, 0.437, 0.02]), woodTone + 0.05), FIXED]);
    const eyeDir = new THREE.Vector3(0, 0.55, 0.83).normalize();
    for (const s of [-1, 1]) {
      const base = new THREE.Vector3(s * 0.055, 0.46, 0.085);
      const tip = base.clone().addScaledVector(eyeDir, 0.09);
      metal.push([withTone(beam(base, tip, 0.05, 0.05), 0.15), FIXED]);
      const cup = plain(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 8));
      cup.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), eyeDir)).translate(tip.x, tip.y, tip.z);
      metal.push([withTone(cup, (x, y, z, nx, ny, nz) => (nx * eyeDir.x + ny * eyeDir.y + nz * eyeDir.z > 0.7 ? -0.95 : -0.2)), FIXED]); // œilleton noir
    }
    // Bobines au dos : disques sur axe z, trois trous sombres pour les voir tourner.
    [-1, 1].forEach((s, k) => {
      const c = new THREE.Vector3(s * 0.1, 0.5, -0.1);
      reels.push(c);
      const disc = plain(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 12)).rotateX(Math.PI / 2).translate(c.x, c.y, c.z);
      metal.push([withTone(disc, (x, y, z, nx, ny, nz) => (Math.abs(nz) > 0.5 ? -0.05 : 0.1)), 5 + k]);
      const holes = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + k;
        holes.push({ position: [c.x + Math.cos(a) * 0.042, c.y + Math.sin(a) * 0.042, c.z + 0.0135], size: [PX * 0.55, PX * 0.55], normal: [0, 0, 1], tone: -0.9 });
      }
      metal.push([buildQuads(holes), 5 + k]);
      metal.push([withTone(beam([c.x, 0.39, c.z], [c.x, c.y - 0.03, c.z], 0.02, 0.02), -0.1), FIXED]);
    });
    // Fenêtre avant : lueur ambre dans un cadre de bronze, quatre traits sombres qui défilent devant.
    const wy = 0.255, ww = 0.22, wh = 0.09, wz = 0.15;
    glow.push(buildQuads([{ position: [0, wy, wz + 0.002], size: [ww, wh], normal: [0, 0, 1] }]));
    for (const [w, h, x, y] of [[ww + 0.04, 0.02, 0, wy + wh / 2 + 0.01], [ww + 0.04, 0.02, 0, wy - wh / 2 - 0.01], [0.02, wh, ww / 2 + 0.01, wy], [0.02, wh, -ww / 2 - 0.01, wy]]) {
      metal.push([withTone(buildBlock([w, h, 0.012], [x, y, wz + 0.006]), 0.25), FIXED]);
    }
    strip = { width: ww, y: wy, z: wz };
    for (let i = 0; i < 4; i++) {
      const offset = (i + rng.range(-0.2, 0.2)) / 4;
      stripes.push(offset);
      metal.push([withTone(buildBlock([PX * (rng.chance(0.4) ? 0.7 : 0.35), wh - 0.012, 0.004], [0, wy, wz + 0.005]), -0.95), 1 + i]);
    }
    // Plaque sous la fenêtre (deux traits gravés) et manivelle sur le flanc.
    metal.push([withTone(buildBlock([0.12, 0.035, 0.008], [0, 0.14, wz + 0.004]), 0.2), FIXED]);
    addCrank(new THREE.Vector3(0.2, 0.26, 0.02), 0.13);
  } else if (p.kind === "drum") {
    // --- Platine de bronze sur patins, deux paliers, tambour de papier sur axe x, stylet à contrepoids.
    metal.push([withTone(buildBlock([0.6, 0.04, 0.36], [0, 0.03, 0]), (x, y, z, nx, ny) => (ny > 0.5 ? 0 : -0.15)), FIXED]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) metal.push([withTone(buildBlock([0.06, 0.012, 0.06], [sx * 0.26, 0.006, sz * 0.14]), -0.3), FIXED]);
    const ay = 0.28, R = 0.1, half = 0.15;
    rotor.set(0, ay, 0);
    for (const sx of [-1, 1]) {
      metal.push([withTone(buildBlock([0.03, ay - 0.05 + 0.03, 0.07], [sx * 0.2, (ay + 0.05) / 2 + 0.01, 0], [0, 0, 0], { taper: 0.3 }), -0.05), FIXED]);
      metal.push([withTone(plain(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 8)).rotateZ(Math.PI / 2).translate(sx * 0.2, ay, 0), 0.15), FIXED]);
    }
    // Tambour (papier) et ses joues de bronze, l'axe ; une trace qui fait deux tours en hélice et tremble.
    const drum = plain(new THREE.CylinderGeometry(R, R, 2 * half, 20, 1, true)).rotateZ(Math.PI / 2).translate(0, ay, 0);
    body.push([withTone(drum, 0.1), 0]); // le papier un cran plus clair : son ombre ne tombe pas dans le ton de la trace
    for (const sx of [-1, 1]) {
      const cheek = plain(new THREE.CylinderGeometry(R + 0.008, R + 0.008, 0.016, 20)).rotateZ(Math.PI / 2).translate(sx * (half + 0.008), ay, 0);
      metal.push([withTone(cheek, (x, y, z, nx) => (Math.abs(nx) > 0.5 ? 0.12 : 0.2)), 0]);
    }
    metal.push([withTone(beam([-0.24, ay, 0], [0.22, ay, 0], 0.018, 0.018, Math.PI / 4), 0.1), 0]);
    const turns = 1.6, steps = 90;
    const f1 = rng.int(5, 11), f2 = rng.int(13, 23), ph = rng.range(0, 6);
    const spikes = Array.from({ length: rng.int(2, 5) }, () => [rng.range(0, turns * Math.PI * 2), rng.range(0.03, 0.05) * (rng.chance(0.5) ? 1 : -1)]);
    const at = (t) => {
      const a = t * turns * Math.PI * 2;
      let w = 0.018 * Math.sin(a * f1 / turns + ph) + 0.01 * Math.sin(a * f2 / turns);
      for (const [sa, h] of spikes) w += h * Math.max(0, 1 - Math.abs(a - sa) / 0.12);
      const x = -half + 0.03 + t * (2 * half - 0.06) + w;
      return new THREE.Vector3(x, ay + Math.cos(a) * (R + 0.002), Math.sin(a) * (R + 0.002));
    };
    // Un ruban plat collé au papier (des petits blocs se couvraient chacun de son contour) ; au plus sombre.
    const pts = [], nrm = [];
    for (let i = 0; i <= steps; i++) {
      const q = at(i / steps);
      pts.push(q);
      nrm.push(new THREE.Vector3(0, q.y - ay, q.z).normalize());
    }
    body.push([withTone(buildRibbon(pts, nrm, 0.03), -1.2), 0]);
    // Stylet : potence à l'arrière, bras au-dessus du tambour, pointe posée sur le papier ; contrepoids derrière.
    const sx = rng.range(-0.08, 0.08);
    const pivot = new THREE.Vector3(sx, ay + R + 0.07, -0.17);
    metal.push([withTone(beam([sx, 0.05, -0.17], [sx, pivot.y + 0.02, -0.17], 0.03, 0.03), 0), FIXED]);
    const tipPoint = new THREE.Vector3(sx, ay + R + 0.008, 0.012);
    metal.push([withTone(beam(pivot, tipPoint.clone().add(new THREE.Vector3(0, 0.012, -0.01)), 0.014, 0.012), 0.3), FIXED]);
    metal.push([withTone(beam(tipPoint.clone().add(new THREE.Vector3(0, 0.02, -0.012)), tipPoint, PX * 0.3, PX * 0.3), 0.5), FIXED]);
    metal.push([withTone(beam(pivot, [sx, pivot.y + 0.02, -0.26], 0.014, 0.012), 0.2), FIXED]);
    metal.push([withTone(plain(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8)).rotateX(Math.PI / 2).translate(sx, pivot.y + 0.025, -0.27), -0.6), FIXED]);
    addCrank(new THREE.Vector3(0.235, ay, 0), 0.15);
  } else {
    // --- Socle de bois, cylindre de cire sur un mandrin, stylet sous un pavillon de laiton.
    const woodTone = rng.range(-0.06, 0.08);
    body.push([withTone(buildBlock([0.45, 0.11, 0.3], [0, 0.055, 0]), (x, y, z, nx, ny) => woodTone + (ny > 0.5 ? 0.12 : 0)), FIXED]);
    metal.push([withTone(buildBlock([0.46, 0.02, 0.31], [0, 0.01, 0]), -0.25), FIXED]);
    const ay = 0.2, R = 0.06, half = 0.1;
    rotor.set(0, ay, 0.02);
    for (const sx of [-1, 1]) {
      metal.push([withTone(buildBlock([0.025, ay - 0.11 + 0.02, 0.05], [sx * 0.15, (ay + 0.11) / 2 + 0.01, rotor.z]), 0), FIXED]);
    }
    metal.push([withTone(beam([-0.16, ay, rotor.z], [0.16, ay, rotor.z], 0.016, 0.016, Math.PI / 4), 0.15), 0]);
    const cylinder = plain(new THREE.CylinderGeometry(R, R, 2 * half, 14, 12)).rotateZ(Math.PI / 2).translate(0, ay, rotor.z);
    // Sillons : une bande sombre tous les 3 cm ; une étiquette claire d'un côté (on la voit tourner).
    wax.push([withTone(cylinder, (x, y, z, nx) => (Math.abs(nx) > 0.5 ? -0.15 : (Math.abs(((x + half) / 0.033) % 1 - 0.5) < 0.17 ? -0.3 : 0.05))), 0]);
    wax.push([buildQuads([{ position: [-half + 0.04, ay + R + 0.002, rotor.z], size: [0.05, PX * 0.6], normal: [0, 1, 0], tone: 0.5 }]), 0]);
    // Bras du stylet depuis l'arrière, tête ronde posée sur la cire, pavillon qui monte en s'évasant.
    const hx = rng.range(-0.05, 0.05);
    const head = new THREE.Vector3(hx, ay + R + 0.025, rotor.z);
    metal.push([withTone(beam([hx, 0.11, -0.12], [hx, head.y + 0.01, -0.12], 0.025, 0.025), 0), FIXED]);
    metal.push([withTone(beam([hx, head.y + 0.01, -0.12], [hx, head.y + 0.01, head.z - 0.02], 0.02, 0.018), 0.1), FIXED]);
    metal.push([withTone(plain(new THREE.CylinderGeometry(0.035, 0.035, 0.022, 10)).translate(head.x, head.y, head.z), 0.2), FIXED]);
    const horn = buildLathe([[0.012, 0], [0.018, 0.08], [0.03, 0.15], [0.06, 0.21], [0.095, 0.24], [0.088, 0.245], [0.052, 0.215], [0.022, 0.15], [0.006, 0.08], [0.004, 0]], { segments: 12, facets: true });
    horn.applyMatrix4(new THREE.Matrix4().makeRotationX(-0.75).premultiply(new THREE.Matrix4().makeRotationY(rng.range(-0.6, 0.6))));
    horn.translate(head.x, head.y + 0.01, head.z);
    metal.push([withTone(horn, (x, y, z, nx, ny) => (ny < -0.2 ? -0.5 : 0.1)), FIXED]);
    addCrank(new THREE.Vector3(0.225, 0.06, 0.02), 0.11);
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const metalMerged = mergeParts(metal);
  const metalEntry = p.kind === "cylinder" ? METALS.blackenedBrass : METALS.patinatedBronze;
  const metalMesh = new THREE.Mesh(metalMerged.geometry, metalMaterial(metalEntry, { id: 30, tone: true }));
  metalMesh.name = "metal";
  const rigs = [createRigidParts(metalMerged.geometry, metalMerged.partOf, 8)];
  const meshes = [metalMesh];
  const bodyMerged = mergeParts(body);
  const bodyMaterial = p.kind === "drum"
    ? createToonMaterial({ ramp: PAPER.ramp, ink: PAPER.ink, steps: [0.3, 0.52, 0.78], tone: true, id: 31 })
    : createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.28, 0.5, 0.76], tone: true, crease: true, id: 31 });
  const bodyMesh = new THREE.Mesh(bodyMerged.geometry, bodyMaterial);
  bodyMesh.name = p.kind === "drum" ? "paper" : "wood";
  meshes.push(bodyMesh);
  rigs.push(createRigidParts(bodyMerged.geometry, bodyMerged.partOf, 8));
  if (wax.length) {
    const waxMerged = mergeParts(wax);
    const waxMesh = new THREE.Mesh(waxMerged.geometry, createToonMaterial({ ramp: WAX.ramp, ink: WAX.ink, steps: [0.28, 0.5, 0.78], tone: true, id: 32 }));
    waxMesh.name = "wax";
    meshes.push(waxMesh);
    rigs.push(createRigidParts(waxMerged.geometry, waxMerged.partOf, 8));
  }
  let glowGeometry = null;
  if (glow.length) {
    glowGeometry = mergeParts(glow.map((g) => [withShade(g, 1, 4), FIXED])).geometry;
    const glowMesh = new THREE.Mesh(glowGeometry, glowMixMaterial(glowLevels("amber"), { id: 40 }));
    glowMesh.name = "window";
    meshes.push(glowMesh);
  }
  for (const mesh of meshes) {
    if (mesh.name !== "window") {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    group.add(mesh);
  }

  // --- Marche : la manivelle (et le tambour, le cylindre) tourne autour de x, la bande défile, les bobines tournent.
  const tmp = new THREE.Matrix4();
  const turnAbout = (m, point, rotation) => m.identity().multiply(tmp.makeTranslation(point.x, point.y, point.z)).multiply(rotation).multiply(tmp.makeTranslation(-point.x, -point.y, -point.z));
  const rot = new THREE.Matrix4();
  const recorder = {
    running: p.state === "running",
    angle: rng.range(0, Math.PI * 2),
    setRunning(on) {
      recorder.running = !!on;
      setWindow();
    },
  };
  function pose() {
    const a = recorder.angle;
    for (const rig of rigs) {
      // Manivelle et rotor tournent chacun autour de son axe x ; le cylindre, démultiplié, tourne plus vite.
      turnAbout(rig.matrices[7], crank, rot.makeRotationX(-a));
      turnAbout(rig.matrices[0], rotor, rot.makeRotationX(-a * (p.kind === "cylinder" ? 2 : 1)));
      stripes.forEach((o, i) => {
        const u = (((o + a / (Math.PI * 2) * 0.8) % 1) + 1) % 1;
        rig.matrices[1 + i].makeTranslation(-strip.width / 2 + 0.01 + u * (strip.width - 0.02), 0, 0);
      });
      reels.forEach((c, k) => turnAbout(rig.matrices[5 + k], c, rot.makeRotationZ((k ? -1 : 1) * a * 0.7)));
      rig.apply();
    }
  }
  let shown = -1;
  const setLevel = (level) => {
    if (!glowGeometry || level === shown) return;
    shown = level;
    const shade = glowGeometry.attributes.aShade;
    shade.array.fill((level + 0.5) / 4);
    shade.needsUpdate = true;
  };
  const setWindow = () => setLevel(2);
  setWindow();
  pose();
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let last = -1;
  group.updateMatrixWorld = (force) => {
    const time = Math.floor(sharedUniforms.uTime.value * 12) / 12;
    if (time !== last) {
      if (last >= 0 && recorder.running) {
        recorder.angle += Math.min(0.25, time - last) * TURN;
        pose();
        if (glowGeometry) {
          // La lueur de la fenêtre bat un peu, comme une lampe derrière une bande.
          setLevel(Math.floor(time * 6) % 7 === 0 ? 3 : 2);
        }
      }
      last = time;
    }
    baseUpdate(force);
  };

  group.userData.recorder = recorder;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
