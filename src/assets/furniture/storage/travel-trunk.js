// Malle de transport du Complexe (docs/complexe/PIECES.md, SAS-13) : un coffre de bois noirci en planches, au
// couvercle bombé, cerclé de laiton (cornières aux coins, deux sangles, poignées sur les flancs), fermé par une serrure
// de 2 px, avec une étiquette de métal gravée. Ouverte, on voit son fond de feutre sombre, un casier, et ce qu'elle
// contient : des cassettes de verre, ou des outils (une lampe portative, une clé, un rouleau de toile).
// Trois tailles : coffret, malle (0,80 × 0,50 × 0,45 m), grande malle.
// Couvercle fermé, entrouvert ou ouvert (110°) ; pilotable : `group.userData.trunk.setOpen(t)` (0 fermé, 1 ouvert).
// La graine change le nombre de planches et leurs tons, l'usure des arêtes, la place et le glyphe de l'étiquette, une
// sangle détachée de temps en temps, et ce qui manque dans le contenu.
//
// 3 draw calls : bois (caisse et couvercle), laiton (garnitures, outils), contenu (cassettes ou toile).

import * as THREE from "three";
import { createToonMaterial, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock } from "../../kit/geometry.js";
import { FABRICS, GLASSES, METALS, WOODS } from "../../kit/palettes.js";
import {
  PX, beam, createRigidParts, mergeParts, metalMaterial, plain, ring, straightGlyphRuns, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const SIZES = { standard: "Malle (0,80 m)", small: "Coffret (0,50 m)", large: "Grande malle (1,10 m)" };
const DIMS = { small: [0.5, 0.32, 0.3], standard: [0.8, 0.5, 0.45], large: [1.1, 0.62, 0.6] }; // largeur, profondeur, hauteur
const STATES = { closed: "Fermée", ajar: "Entrouverte", open: "Ouverte" };
const OPENNESS = { closed: 0, ajar: 0.22, open: 1 };
const CONTENTS = { cassettes: "Cassettes de verre", tools: "Outils (lampe, clé, toile)", empty: "Vide" };
const OPEN_ANGLE = 110 * Math.PI / 180;
const LID = 0;
const FIXED = 255;
// Toile huilée (plus claire que le cuir goudronné : elle se lit sur le feutre).
const OILCLOTH = { ramp: ["#2a2117", "#4f3f2a", "#77623f", "#a08756"], ink: "#140f0a" };

const params = {
  seed: seedParam("Change les planches et leurs tons, l'usure, l'étiquette (place et glyphe), une sangle détachée, ce qui manque dans le contenu."),
  state: choiceParam("Couvercle", STATES, "Fermé, entrouvert ou ouvert à 110°. Pilotable : group.userData.trunk.setOpen(t)."),
  size: choiceParam("Taille", SIZES, "Coffret (0,50 × 0,32 × 0,30 m), malle (0,80 × 0,50 × 0,45 m) ou grande malle (1,10 × 0,62 × 0,60 m)."),
  content: choiceParam("Contenu", CONTENTS, "Ce qu'on voit quand elle est ouverte : des cassettes de verre rangées, des outils (lampe portative, clé, rouleau de toile), ou rien."),
};

export const meta = {
  id: "furniture/storage/travel-trunk",
  name: "Malle de transport",
  nameEn: "Travel trunk",
  category: "furniture",
  subcategory: "storage",
  description:
    "Malle du Complexe en bois noirci à couvercle bombé, cornières et sangles de laiton, serrure et étiquette gravée. " +
    "Fermée, entrouverte ou ouverte sur son feutre et son casier, avec des cassettes de verre ou des outils. Coffret, " +
    "malle ou grande malle. Fiche SAS-13.",
  tags: [
    "malle", "coffre", "bagage", "couvercle", "bois noirci", "laiton", "sangles", "serrure", "étiquette", "cassettes",
    "le complexe", "complexe", "ancien-tech", "rangement", "pilotable", "intérieur",
    "trunk", "chest", "luggage", "lid", "blackened wood", "brass", "straps", "lock", "tag", "data cassettes",
    "ancient complex", "ancient-tech", "storage", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; origine au sol, au centre ; la serrure regarde +z, les charnières sont derrière (−z)",
  footprint: { radius: 0.6, height: 0.9 },
  animated: ["trunk"],
  params,
  variants: variantsOf("state", params.state),
};

/**
 * Crée la malle.
 * @param {{seed?: number, state?: string, size?: string, content?: string}} [given]
 * @returns {THREE.Group} `group.userData.trunk` : { openness, setOpen(t), open(), close() }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 59);
  const [W, D, H] = DIMS[p.size];
  const bodyH = H * 0.7;
  const lidH = H - bodyH;
  const skirt = lidH * rng.range(0.4, 0.62); // bord droit du couvercle (la graine bombe plus ou moins)
  const rise = lidH - skirt; // bombé
  const t = 0.035; // épaisseur des planches
  const s = W / 0.8; // échelle des garnitures (le coffret a des garnitures plus fines)
  const wood = []; // [géométrie, pièce]
  const metal = [];
  const content = [];
  const hinge = new THREE.Vector3(0, bodyH, -D / 2);

  // --- Caisse : quatre parois de planches horizontales, fond de feutre (les faces intérieures sont sombres).
  const planks = rng.int(3, 4);
  const inward = (cx, cz) => (x, y, z, nx, ny, nz) => (nx * (x - cx) + nz * (z - cz) < -0.01 ? -0.42 : 0);
  const plankTone = () => rng.range(-0.09, 0.09);
  for (let i = 0; i < planks; i++) {
    const y0 = (bodyH * i) / planks, y1 = (bodyH * (i + 1)) / planks;
    const h = y1 - y0 - 0.006;
    const y = (y0 + y1) / 2;
    for (const side of [-1, 1]) {
      const front = buildBlock([W, h, t], [0, y, side * (D / 2 - t / 2)]);
      const toneF = plankTone();
      wood.push([withTone(front, (x, yy, z, nx, ny, nz) => toneF + inward(0, 0)(x, yy, z, nx, ny, nz)), FIXED]);
      const end = buildBlock([t, h, D - 2 * t], [side * (W / 2 - t / 2), y, 0]);
      const toneE = plankTone();
      wood.push([withTone(end, (x, yy, z, nx, ny, nz) => toneE + inward(0, 0)(x, yy, z, nx, ny, nz)), FIXED]);
    }
  }
  wood.push([withTone(buildBlock([W - 2 * t, 0.03, D - 2 * t], [0, 0.03, 0]), -0.48), FIXED]); // fond (feutre)
  // Casier : une cloison basse au tiers gauche.
  const wall = -W / 2 + t + (W - 2 * t) * 0.32;
  wood.push([withTone(buildBlock([0.02, bodyH * 0.55, D - 2 * t], [wall, 0.03 + bodyH * 0.275, 0]), -0.2), FIXED]);

  // --- Couvercle (pièce LID) : jupe droite, lattes qui suivent le bombé, flancs en arc, doublure sombre dessous.
  const archY = (z) => bodyH + skirt + rise * (1 - (2 * z / D) ** 2);
  for (const side of [-1, 1]) {
    wood.push([withTone(buildBlock([W, skirt, t], [0, bodyH + skirt / 2, side * (D / 2 - t / 2)]), plankTone()), LID]);
  }
  const slats = p.size === "small" ? 4 : 6;
  for (let i = 0; i < slats; i++) {
    const z0 = -D / 2 + (D * i) / slats, z1 = -D / 2 + (D * (i + 1)) / slats;
    const a = new THREE.Vector3(0, archY(z0), z0), b = new THREE.Vector3(0, archY(z1), z1);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const slat = buildBlock([W, t, len + 0.004], [0, 0, 0], [Math.atan2(-dir.y, dir.z), 0, 0]);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    // Posée sous la courbe, pour que le dessus suive l'arc.
    const n = new THREE.Vector3(0, dir.z, -dir.y).normalize();
    slat.translate(mid.x, mid.y - n.y * t / 2, mid.z - n.z * t / 2);
    const tone = plankTone() + (Math.abs(z0 + z1) < D * 0.4 ? 0.05 : 0); // le haut, plus frotté
    wood.push([withTone(slat, (x, y, z, nx, ny) => (ny < -0.5 ? -0.45 : tone)), LID]);
  }
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-D / 2 + t, 0);
    shape.lineTo(D / 2 - t, 0);
    for (let k = 0; k <= 8; k++) {
      const z = D / 2 - t - ((D - 2 * t) * k) / 8;
      shape.lineTo(z, archY(z) - bodyH - t * 0.8);
    }
    shape.closePath();
    const cap = plain(new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 1 }));
    cap.rotateY(-Math.PI / 2);
    cap.translate(side > 0 ? W / 2 : -W / 2 + t, bodyH, 0);
    wood.push([withTone(cap, plankTone()), LID]);
  }
  wood.push([withTone(buildBlock([W - 2 * t, 0.012, D - 2 * t], [0, bodyH + 0.008, 0]), -0.45), LID]); // doublure

  // --- Laiton : cornières, sangles, serrure, étiquette, poignées, charnières.
  const c = 0.06 * s; // côté d'une cornière
  const brass = (g, tone, part = FIXED) => metal.push([withTone(g, tone), part]);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      brass(buildBlock([c + 0.012, c, c + 0.012], [sx * (W / 2 - c / 2 + 0.006), c / 2, sz * (D / 2 - c / 2 + 0.006)]), 0.12);
      brass(buildBlock([c + 0.012, c, c + 0.012], [sx * (W / 2 - c / 2 + 0.006), bodyH - c / 2, sz * (D / 2 - c / 2 + 0.006)]), 0.12);
      brass(buildBlock([c + 0.012, skirt + 0.006, c + 0.012], [sx * (W / 2 - c / 2 + 0.006), bodyH + skirt / 2, sz * (D / 2 - c / 2 + 0.006)]), 0.18, LID);
    }
  }
  // Sangles : sur la caisse (devant, derrière) et par-dessus le couvercle.
  const detached = rng.chance(0.3) ? rng.int(0, 1) : -1;
  const strapW = 0.05 * s, strapT = 0.012;
  const strapU = rng.range(0.2, 0.32);
  [-strapU, strapU].forEach((u, i) => {
    const x = u * W;
    brass(buildBlock([strapW, bodyH - 0.02, strapT], [x, bodyH / 2, -D / 2 - strapT / 2]), -0.05);
    if (i !== detached) {
      brass(buildBlock([strapW, bodyH - 0.02, strapT], [x, bodyH / 2, D / 2 + strapT / 2]), -0.05);
      // Boucle : un cadre d'un pixel sous le bord du couvercle.
      const buckle = ring({ radius: 0.025 * s, height: strapT * 1.5, thickness: PX * 0.6, segments: 4 });
      buckle.rotateX(Math.PI / 2);
      buckle.rotateZ(Math.PI / 4);
      buckle.translate(x, bodyH - 0.07 * s, D / 2 + strapT * 1.2);
      brass(buckle, 0.3);
    }
    // Par-dessus le couvercle : de la charnière à la face avant.
    const pts = [[-D / 2, bodyH], [-D / 2, bodyH + skirt]];
    for (let k = 0; k <= 8; k++) {
      const z = -D / 2 + (D * k) / 8;
      pts.push([z, archY(z)]);
    }
    pts.push([D / 2, bodyH + skirt]);
    if (i !== detached) pts.push([D / 2, bodyH]);
    for (let k = 0; k < pts.length - 1; k++) {
      const a = pts[k], b = pts[k + 1];
      const dz = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dz, dy) || 1;
      const nz = -dy / l, ny = dz / l; // normale extérieure, dans le plan yz
      const off = (pt) => new THREE.Vector3(x, pt[1] + ny * strapT / 2, pt[0] + nz * strapT / 2);
      brass(beam(off(a), off(b), strapT, strapW, 0, new THREE.Vector3(1, 0, 0)), -0.05, LID);
    }
    if (i === detached) {
      // Le bout détaché pend devant, un peu de travers.
      brass(beam(new THREE.Vector3(x, bodyH + 0.01, D / 2 + strapT), new THREE.Vector3(x + 0.05, bodyH - 0.16 * s, D / 2 + 0.05), strapT, strapW, 0, new THREE.Vector3(1, 0, 0)), -0.12, LID);
    }
  });
  // Serrure : platine et trou (2 px) sur la caisse, moraillon sur le couvercle.
  brass(buildBlock([0.09 * s, 0.1 * s, 0.014], [0, bodyH - 0.06 * s, D / 2 + 0.007]), 0.28);
  brass(buildBlock([PX * 0.6, PX * 1.1, 0.006], [0, bodyH - 0.07 * s, D / 2 + 0.016]), -0.9);
  brass(buildBlock([0.045 * s, skirt * 0.9 + 0.03 * s, 0.014], [0, bodyH + skirt * 0.45 - 0.015 * s, D / 2 + 0.009]), 0.22, LID);
  // Étiquette gravée : sur la face avant, à gauche ou à droite de la serrure, ou sur un flanc.
  const labelAt = rng.pick(["left", "right", "end"]);
  const lw = 0.13 * s, lh = 0.075 * s;
  const glyph = straightGlyphRuns(rng, 5, 2);
  const label = (cx, cy, cz, rotY) => {
    const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(cx, cy, cz);
    brass(buildBlock([lw, lh, 0.008], [0, 0, 0]).applyMatrix4(m), 0.32);
    const cell = (lw - 0.02) / 5;
    for (const [col, row, n] of glyph) {
      brass(buildBlock([n * cell, cell * 0.8, 0.004], [-lw / 2 + 0.01 + (col + n / 2) * cell, (0.5 - row) * cell, 0.005]).applyMatrix4(m), -0.85);
    }
  };
  if (labelAt === "end") label(W / 2 + 0.005, bodyH * 0.5, 0, Math.PI / 2);
  else label((labelAt === "left" ? -1 : 1) * W * 0.15, bodyH * 0.5, D / 2 + 0.005, 0);
  // Poignées de flanc (pas sur la face qui porte l'étiquette) et charnières.
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.012);
    if (labelAt === "end" && sx > 0) continue;
    for (const sz of [-1, 1]) brass(buildBlock([0.025, 0.04, 0.025], [x, bodyH * 0.72, sz * 0.07 * s]), 0.1);
    brass(beam(new THREE.Vector3(x + sx * 0.02, bodyH * 0.72 - 0.02, -0.08 * s), new THREE.Vector3(x + sx * 0.02, bodyH * 0.72 - 0.02, 0.08 * s), PX * 0.7, PX * 0.7), 0.25);
  }
  // Renfort : un feuillard de laiton autour de la caisse, à mi-hauteur (une malle sur deux).
  if (rng.chance(0.5)) {
    const y = bodyH * rng.range(0.38, 0.5);
    for (const side of [-1, 1]) {
      brass(buildBlock([W + 0.008, 0.03 * s, 0.008], [0, y, side * (D / 2 + 0.004)]), 0.02);
      brass(buildBlock([0.008, 0.03 * s, D + 0.008], [side * (W / 2 + 0.004), y, 0]), 0.02);
    }
  }
  for (const u of [-0.36, 0.36]) brass(buildBlock([0.07 * s, 0.06, 0.016], [u * W, bodyH, -D / 2 - 0.009]), 0.05);

  // --- Contenu.
  let contentRamp = null;
  if (p.content === "cassettes") {
    // Cassettes de verre couchées en rangs dans le grand compartiment ; la graine en retire quelques-unes.
    contentRamp = GLASSES.cyan;
    const x0 = wall + 0.02, x1 = W / 2 - t - 0.01;
    const cw = 0.11 * Math.min(1, s), cd = 0.15 * Math.min(1, s);
    const cols = Math.max(1, Math.floor((x1 - x0) / (cw + 0.012)));
    const rows = Math.max(1, Math.floor((D - 2 * t - 0.02) / (cd + 0.012)));
    for (let r = 0; r < rows; r++) {
      for (let q = 0; q < cols; q++) {
        if (rng.chance(0.15)) continue;
        const x = x0 + (q + 0.5) * ((x1 - x0) / cols);
        const z = -D / 2 + t + 0.01 + (r + 0.5) * ((D - 2 * t - 0.02) / rows);
        const stack = rng.int(1, 2);
        for (let k = 0; k < stack; k++) {
          content.push([withTone(buildBlock([cw, 0.028, cd], [x, 0.045 + 0.014 + k * 0.03, z]), rng.range(-0.15, 0.15)), FIXED]);
          brass(buildBlock([cw * 0.4, 0.006, PX * 0.8], [x, 0.045 + 0.03 + k * 0.03, z + cd / 2 - PX]), 0.2); // étiquette de laiton
        }
      }
    }
    // Petit compartiment : deux cassettes debout.
    for (let k = 0; k < 2; k++) content.push([withTone(buildBlock([0.03, 0.12 * s, cd], [-W / 2 + t + 0.03 + k * 0.045, 0.045 + 0.06 * s, 0]), 0.1 - k * 0.2), FIXED]);
  } else if (p.content === "tools") {
    contentRamp = OILCLOTH;
    // Rouleau de toile dans le grand compartiment, lampe portative et clé posées à côté.
    const roll = plain(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, (W / 2 - wall) * 0.8, 6));
    roll.rotateZ(Math.PI / 2);
    roll.translate((wall + W / 2) / 2, 0.045 + 0.05 * s, -D * 0.22);
    content.push([withTone(roll, (x) => (Math.abs(x - (wall + W / 2) / 2) % 0.12 < 0.02 ? -0.4 : 0)), FIXED]);
    const lamp = plain(new THREE.CylinderGeometry(0.022, 0.022, 0.2 * s, 6));
    lamp.rotateZ(Math.PI / 2);
    lamp.rotateY(rng.range(-0.4, 0.4));
    lamp.translate((wall + W / 2) / 2, 0.06, D * 0.12);
    brass(lamp, -0.3);
    const head = plain(new THREE.CylinderGeometry(0.045, 0.035, 0.06, 8));
    head.rotateZ(Math.PI / 2);
    head.translate((wall + W / 2) / 2 + 0.12 * s, 0.07, D * 0.12);
    brass(head, 0.3);
    const wx = -W / 2 + t + 0.06;
    brass(beam(new THREE.Vector3(wx, 0.055, -D * 0.25), new THREE.Vector3(wx + 0.02, 0.055, D * 0.2), PX * 0.8, PX * 0.6), 0.05);
    const jaw = ring({ radius: 0.025, height: PX * 0.6, thickness: PX * 0.7, segments: 6 });
    jaw.translate(wx + 0.02, 0.05, D * 0.22);
    brass(jaw, 0.15);
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const woodMerged = mergeParts(wood);
  const woodMat = createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, pattern: "speckle", patternParams: [16, 0.05, 0.12, 1], seed: rng.int(0, 96), id: 20 });
  const woodMesh = new THREE.Mesh(woodMerged.geometry, woodMat);
  woodMesh.name = "wood";
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE.Mesh(metalMerged.geometry, metalMaterial(METALS.blackenedBrass, { id: 21, tone: true }));
  metalMesh.name = "brass";
  for (const mesh of [woodMesh, metalMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (content.length) {
    const ramp = contentRamp ?? FABRICS.felt;
    const contentMesh = new THREE.Mesh(mergeParts(content).geometry, createToonMaterial({ ramp: ramp.ramp, ink: ramp.ink, tone: true, crease: true, id: 22 }));
    contentMesh.name = "content";
    contentMesh.castShadow = true;
    contentMesh.receiveShadow = true;
    group.add(contentMesh);
  }

  // --- Couvercle : rotation autour de la charnière (axe x, à l'arrière du bord de la caisse).
  const rigs = [createRigidParts(woodMerged.geometry, woodMerged.partOf, 1), createRigidParts(metalMerged.geometry, metalMerged.partOf, 1)];
  const tmp = new THREE.Matrix4();
  let shown = -1;
  const pose = (u) => {
    if (Math.abs(u - shown) < 1e-4) return;
    shown = u;
    for (const rig of rigs) {
      const m = rig.matrices[LID];
      m.makeTranslation(0, hinge.y, hinge.z);
      m.multiply(tmp.makeRotationX(-OPEN_ANGLE * u));
      m.multiply(tmp.makeTranslation(0, -hinge.y, -hinge.z));
      rig.apply();
    }
  };
  const ease = (x) => x * x * (3 - 2 * x);
  let tween = null;
  const trunk = {
    openness: OPENNESS[p.state],
    setOpen(u) {
      tween = null;
      trunk.openness = THREE.MathUtils.clamp(u, 0, 1);
      pose(trunk.openness);
    },
    open() {
      tween = { from: trunk.openness, to: 1, start: sharedUniforms.uTime.value };
    },
    close() {
      tween = { from: trunk.openness, to: 0, start: sharedUniforms.uTime.value };
    },
  };
  pose(trunk.openness);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    if (tween) {
      const k = Math.min(1, (sharedUniforms.uTime.value - tween.start) / (1.2 * Math.abs(tween.to - tween.from) || 1));
      trunk.openness = tween.from + (tween.to - tween.from) * ease(k);
      if (k >= 1) tween = null;
      pose(trunk.openness);
    }
    baseUpdate(force);
  };

  group.userData.trunk = trunk;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
