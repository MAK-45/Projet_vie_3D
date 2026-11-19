// Vitrine du Complexe (fiches ARC-15 et E6-06, docs/complexe/).
// - De conservation (Archives) : 1,2 × 0,8 × 1,0 m, piètement de pierre fumée, caisson de verre au dessus bombé (en
//   quatre pans), arêtes de bronze, joint noirci au pied du verre, cadran d'hygrométrie de 2 px sur la tranche avant.
//   Dedans, sur un feutre : une tablette gravée sur son lutrin, des rouleaux-bandes, ou rien.
// - À échantillon (salle 6) : cuve de verre de Ø 0,25 × 0,6 m sur socle de bronze, un fruit de cristal qui luit dans
//   un liquide clair, une étiquette ; seule ou en rang de 2 à 4 (sur la table « support »).
// Le verre est tramé (une part des pixels dessinée, sans transparence ni tri) : on voit au travers sur un téléphone
// sans rien coûter de plus. La graine change le contenu et sa disposition, le niveau du liquide, la forme du fruit,
// l'aiguille du cadran, les tons de la pierre.
//
// 3 draw calls : pierre ou lueur (fruits), métal, verre tramé.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildGem, buildQuads } from "../../kit/geometry.js";
import { GLASSES, METALS, STONES } from "../../kit/palettes.js";
import {
  PX, beam, dial, glowMaterial, gridBlock, mergeToned, metalMaterial, plain, stoneMaterial, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = {
  conservation: "De conservation (Archives, 1,2 m)",
  specimen: "Cuve à échantillon (salle 6)",
};
const CONTENTS = { tablet: "Tablette gravée", rolls: "Rouleaux-bandes", empty: "Vide" };
const WALL = 0.36; // part des pixels dessinés sur le verre
const LIQUID = 0.48;

const params = {
  seed: seedParam("Change le contenu et sa disposition, les glyphes de la tablette, le niveau du liquide, la forme du fruit, l'aiguille du cadran, les tons de la pierre."),
  model: choiceParam("Modèle", MODELS, "Vitrine de conservation des Archives, ou cuve à échantillon de la salle de l'Arbre de Mémoire."),
  content: choiceParam("Contenu", CONTENTS, "Vitrine de conservation : une tablette gravée sur son lutrin, des rouleaux-bandes, ou rien."),
  count: numberParam("Cuves", 1, 1, 4, "Cuve à échantillon : nombre de cuves en rang (4 sur la table de la salle 6).", { step: 1 }),
};

export const meta = {
  id: "furniture/storage/display-case",
  name: "Vitrine",
  nameEn: "Display case",
  category: "furniture",
  subcategory: "storage",
  description:
    "Vitrine du Complexe au verre tramé (on voit au travers) : vitrine de conservation des Archives sur piètement de " +
    "pierre fumée, caisson au dessus bombé cerclé de bronze, cadran d'hygrométrie, tablette gravée ou rouleaux-bandes " +
    "sur un feutre ; ou cuve à échantillon de la salle 6, un fruit de cristal qui luit dans un liquide clair, seule ou " +
    "en rang. Fiches ARC-15, E6-06.",
  tags: [
    "vitrine", "cuve", "bocal", "verre", "verre tramé", "caisson bombé", "pierre fumée", "bronze", "cadran",
    "hygrométrie", "tablette gravée", "rouleaux", "échantillon", "fruit de cristal", "liquide", "musée",
    "le complexe", "complexe", "ancien-tech", "rangement", "lumineux", "intérieur",
    "display case", "showcase", "specimen jar", "glass", "dithered glass", "domed lid", "smoked stone", "dial",
    "hygrometer", "engraved tablet", "scrolls", "crystal fruit", "liquid", "museum", "ancient complex", "ancient-tech",
    "storage", "glowing", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units:
    "1 unité = 1 mètre ; origine au sol, au centre (vitrine) ou sous le rang de cuves (à poser sur une table) ; face " +
    "avant vers +z",
  footprint: { radius: 0.75, height: 1.0 },
  animated: [],
  params,
  variants: [
    { id: "tablet", name: "Conservation, tablette", params: {} },
    { id: "rolls", name: "Conservation, rouleaux", params: { content: "rolls" } },
    { id: "specimen", name: "Cuve à échantillon", params: { model: "specimen" } },
    { id: "specimens", name: "Rang de 4 cuves", params: { model: "specimen", count: 4 } },
  ],
};

/** Pose la part de pixels dessinés (`aCover`) sur une géométrie de verre. */
function cover(geometry, value) {
  const n = geometry.attributes.position.count;
  geometry.setAttribute("aCover", new THREE.BufferAttribute(new Float32Array(n).fill(value), 1));
  return geometry;
}

/**
 * Crée la vitrine.
 * @param {{seed?: number, model?: string, content?: string, count?: number}} [given]
 * @returns {THREE.Group} vitrine : `group.userData.surface` = le feutre sous le verre ({ y, size })
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 607);
  const group = new THREE.Group();
  group.name = meta.name;
  if (p.model === "specimen") buildSpecimens(group, p, rng);
  else buildConservation(group, p, rng);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

function buildConservation(group, p, rng) {
  const stone = [], metal = [], glass = [];
  const W = 1.2, D = 0.8;
  const tray = 0.62; // dessus du plateau de pierre (le feutre)
  // --- Piètement : socle en retrait, deux jambages, plateau à corniche.
  const t = rng.range(-0.06, 0.06);
  stone.push(withTone(buildBlock([W - 0.16, 0.08, D - 0.16], [0, 0.04, 0]), t - 0.35));
  for (const s of [-1, 1]) {
    stone.push(withTone(gridBlock([0.22, tray - 0.18, D - 0.22], [s * (W / 2 - 0.2), 0.08 + (tray - 0.18) / 2, 0], { cell: 0.12 }), (x, y) => t - 0.08 + (y < 0.2 ? -0.1 : 0)));
  }
  stone.push(withTone(buildBlock([W - 0.5, 0.06, 0.1], [0, 0.26, 0]), t - 0.2)); // entretoise
  stone.push(withTone(gridBlock([W, 0.1, D], [0, tray - 0.05, 0], { cell: 0.12 }), (x, y, z, nx, ny) => t + (ny > 0.5 ? -0.1 : 0.05)));
  // Feutre : un tapis sombre sous le verre.
  stone.push(withTone(buildBlock([W - 0.14, 0.012, D - 0.14], [0, tray + 0.006, 0]), -0.8));
  // Cadran d'hygrométrie sur la tranche avant, un peu décalé.
  const dx = rng.range(0.25, 0.4) * (rng.chance(0.5) ? 1 : -1);
  const d = dial({ radius: PX * 1.1, position: [dx, tray - 0.05, D / 2 + 0.002], normal: [0, 0, 1], ticks: 6, needle: rng.range(-1.4, 1.4) });
  metal.push(withTone(d.face, 0.45), withTone(d.marks, -0.8));
  metal.push(withTone(buildBlock([0.16, 0.02, 0.006], [dx, tray - 0.085, D / 2 + 0.003]), 0.2)); // plaque sous le cadran

  // --- Caisson : joint noirci au pied, montants d'angle, dessus bombé en quatre pans, arceaux de bronze aux bouts.
  const gw = W - 0.1, gd = D - 0.1;
  const wallH = 0.2, sag = 0.14;
  const y0 = tray + 0.012, y1 = y0 + wallH;
  for (const s of [-1, 1]) {
    metal.push(withTone(buildBlock([gw + 0.03, 0.035, 0.03], [0, y0 + 0.0175, s * gd / 2]), -0.55));
    metal.push(withTone(buildBlock([0.03, 0.035, gd + 0.03], [s * gw / 2, y0 + 0.0175, 0]), -0.55));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) metal.push(withTone(buildBlock([0.028, wallH, 0.028], [sx * gw / 2, y0 + wallH / 2, sz * gd / 2]), 0.05));
  // Profil du dessus : arc de flèche `sag` sur la largeur, en quatre pans plats.
  const facets = 4;
  const R = (sag * sag + (gd / 2) ** 2) / (2 * sag);
  const half = Math.asin(gd / 2 / R);
  const arc = [];
  for (let i = 0; i <= facets; i++) {
    const a = -half + (2 * half * i) / facets;
    arc.push([Math.sin(a) * R, y1 - (R - sag) + Math.cos(a) * R - (Math.cos(half) * R - (R - sag))]);
  }
  // arc[i] = [z, y] ; arc[0] et arc[facets] sont en haut des parois (y1).
  for (let i = 0; i < facets; i++) {
    const [za, ya] = arc[i], [zb, yb] = arc[i + 1];
    const len = Math.hypot(zb - za, yb - ya);
    const angle = Math.atan2(yb - ya, zb - za);
    const pane = buildBlock([gw, 0.006, len], [0, (ya + yb) / 2, (za + zb) / 2], [-angle, 0, 0]);
    glass.push(cover(pane, WALL));
    // Arceaux : un bout de cornière de bronze à chaque extrémité, et une nervure au milieu.
    for (const x of [-gw / 2, 0, gw / 2]) {
      if (x === 0 && i % 2) continue;
      metal.push(withTone(beam([x, ya + 0.008, za], [x, yb + 0.008, zb], 0.024, 0.02), x === 0 ? -0.05 : 0.15));
    }
  }
  metal.push(withTone(beam([-gw / 2, arc[facets / 2][1] + 0.012, 0], [gw / 2, arc[facets / 2][1] + 0.012, 0], 0.022, 0.022), 0.3)); // faîte
  // Pignons bombés aux deux bouts : un éventail de triangles, en verre.
  for (const s of [-1, 1]) {
    const pts = [];
    const pos = [];
    for (let i = 0; i < facets; i++) {
      const [za, ya] = arc[i], [zb, yb] = arc[i + 1];
      pts.push([s * gw / 2, y1, 0], [s * gw / 2, ya, za], [s * gw / 2, yb, zb]);
    }
    for (const q of pts) pos.push(...q);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(pos.length).map((_, k) => (k % 3 === 0 ? s : 0)), 3));
    plain(g);
    if (s < 0) g.index.array.reverse();
    glass.push(cover(g, WALL));
  }
  // Parois droites.
  glass.push(cover(buildQuads([
    { position: [0, y0 + wallH / 2, gd / 2], size: [gw, wallH], normal: [0, 0, 1] },
    { position: [0, y0 + wallH / 2, -gd / 2], size: [gw, wallH], normal: [0, 0, -1] },
    { position: [gw / 2, y0 + wallH / 2, 0], size: [gd, wallH], normal: [1, 0, 0] },
    { position: [-gw / 2, y0 + wallH / 2, 0], size: [gd, wallH], normal: [-1, 0, 0] },
  ]), WALL));

  // --- Contenu, posé sur le feutre.
  const floor = tray + 0.012;
  if (p.content === "tablet") {
    // Lutrin de bronze incliné, tablette de pierre claire gravée de glyphes (traits sombres d'un pixel).
    const tx = rng.range(-0.15, 0.15), yaw = rng.range(-0.25, 0.25);
    const tilt = 0.55;
    const tw = rng.range(0.38, 0.48), th = rng.range(0.24, 0.3);
    const m = new THREE.Matrix4().makeTranslation(tx, floor, 0).multiply(new THREE.Matrix4().makeRotationY(yaw));
    const stand = [buildBlock([tw * 0.7, 0.03, 0.2], [0, 0.015, -0.02]), beam([0, 0.03, -0.1], [0, 0.03 + Math.cos(tilt) * th * 0.6, -0.1 - Math.sin(tilt) * th * 0.3], 0.04, 0.03)];
    for (const g of stand) metal.push(withTone(g.applyMatrix4(m), -0.1));
    const pose = new THREE.Matrix4().makeTranslation(0, 0.03 + (Math.cos(tilt) * th) / 2, 0.02 - (Math.sin(tilt) * th) / 2).multiply(new THREE.Matrix4().makeRotationX(-tilt));
    const slab = buildBlock([tw, th, 0.035]).applyMatrix4(pose).applyMatrix4(m);
    stone.push(withTone(slab, (x, y, z, nx, ny, nz) => 0.35 + (nz > 0.3 ? 0.1 : -0.15)));
    // Glyphes : 3 lignes de traits droits, tirés de la graine.
    const marks = [];
    for (let row = 0; row < 3; row++) {
      let x = -tw / 2 + 0.05;
      while (x < tw / 2 - 0.06) {
        const w = rng.chance(0.3) ? PX * 0.4 : rng.range(0.03, 0.07);
        if (rng.chance(0.85)) marks.push({ position: [x + w / 2, th / 2 - 0.06 - row * 0.075, 0.0185], size: [w, rng.chance(0.4) ? PX * 0.8 : PX * 0.4], normal: [0, 0, 1], tone: -1 });
        x += w + 0.025;
      }
    }
    stone.push(buildQuads(marks).applyMatrix4(pose).applyMatrix4(m));
  } else if (p.content === "rolls") {
    // Rouleaux-bandes couchés sur le feutre, chacun sur deux cales ; un bout déroulé.
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const z = -gd / 2 + 0.12 + (i * (gd - 0.24)) / Math.max(1, n - 1) + rng.range(-0.02, 0.02);
      const x = rng.range(-0.15, 0.15), r = rng.range(0.035, 0.05), len = rng.range(0.32, 0.42);
      const coil = plain(new THREE.CylinderGeometry(r, r, len, 10)).rotateZ(Math.PI / 2).translate(x, floor + 0.02 + r, z);
      metal.push(withTone(coil, (xx) => 0.2 + (Math.abs(((xx - x) / (PX * 2)) % 1) < 0.2 ? -0.3 : 0)));
      for (const s of [-1, 1]) {
        const cap = plain(new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.016, 8)).rotateZ(Math.PI / 2).translate(x + s * (len / 2 + 0.008), floor + 0.02 + r, z);
        stone.push(withTone(cap, -0.3));
        stone.push(withTone(buildBlock([0.05, 0.02, 0.06], [x + s * len * 0.3, floor + 0.01, z]), -0.45)); // cale
      }
      if (i === 0) {
        const tail = rng.range(0.15, 0.25);
        metal.push(withTone(buildBlock([len - 0.04, 0.004, tail], [x, floor + 0.004, z + r + tail / 2]), 0.1));
        const strokes = [];
        for (let k = 0; k < 3; k++) strokes.push({ position: [x + rng.range(-0.05, 0.05), floor + 0.0065, z + r + 0.04 + k * (tail - 0.06) / 3], size: [len * 0.5, PX * 0.45], normal: [0, 1, 0], tone: -0.9 });
        metal.push(buildQuads(strokes));
      }
    }
  }

  // --- Maillages.
  const stoneMesh = new THREE.Mesh(mergeToned(stone), stoneMaterial(STONES.smoked, { seed: rng.int(0, 96), id: 20 }));
  stoneMesh.name = "stone";
  const metalMesh = new THREE.Mesh(mergeToned(metal), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  metalMesh.name = "bronze";
  for (const mesh of [stoneMesh, metalMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.add(glassMesh(glass));
  group.userData.surface = { y: floor, size: [gw - 0.06, gd - 0.06] };
}

function buildSpecimens(group, p, rng) {
  const metal = [], glass = [], glow = [];
  const n = Math.round(p.count);
  const spacing = 0.3;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * spacing;
    const r = 0.12, base = 0.05, h = 0.48;
    // Socle et couvercle de bronze, bouton ; étiquette claire sur le socle.
    const foot = plain(new THREE.CylinderGeometry(r + 0.02, r + 0.03, base, 12)).translate(x, base / 2, 0);
    metal.push(withTone(foot, (xx, y, z, nx, ny) => (ny > 0.5 ? 0.1 : -0.1)));
    const lid = plain(new THREE.CylinderGeometry(r + 0.015, r + 0.015, 0.035, 12)).translate(x, base + h + 0.0175, 0);
    metal.push(withTone(lid, (xx, y, z, nx, ny) => (ny > 0.5 ? 0.15 : 0)));
    metal.push(withTone(plain(new THREE.CylinderGeometry(0.02, 0.025, 0.03, 6)).translate(x, base + h + 0.05, 0), 0.3));
    metal.push(withTone(buildQuads([{ position: [x, base * 0.5, r + 0.026], size: [0.1, 0.03], normal: [0, 0.2, 1] }]), 0.7));
    // Liquide : une colonne plus dense que le verre, jusqu'à un niveau tiré de la graine.
    const level = rng.range(0.55, 0.85) * h;
    const liquid = plain(new THREE.CylinderGeometry(r - 0.008, r - 0.008, level, 12)).translate(x, base + level / 2, 0);
    glass.push(cover(withTone(liquid, (xx, y, z, nx, ny) => (ny > 0.5 ? 0.25 : -0.2)), LIQUID));
    const wall = plain(new THREE.CylinderGeometry(r, r, h, 14, 1, true)).translate(x, base + h / 2, 0);
    glass.push(cover(withTone(wall, 0.1), WALL));
    // Fruit de cristal : une gemme à 5 ou 6 pans, un peu penchée, sur une tige de bronze ; parfois un second, petit.
    const fy = base + rng.range(0.16, 0.24);
    const len = rng.range(0.12, 0.17);
    const dir = new THREE.Vector3(rng.range(-0.25, 0.25), 1, rng.range(-0.25, 0.25)).normalize();
    glow.push(plain(buildGem({ length: len, radius: len * rng.range(0.32, 0.42), sides: rng.int(5, 6), waist: rng.range(0.38, 0.5), position: new THREE.Vector3(x, fy, 0), direction: dir, spin: rng.range(0, 1) })));
    if (rng.chance(0.4)) {
      const l2 = len * 0.5;
      glow.push(plain(buildGem({ length: l2, radius: l2 * 0.4, sides: 5, position: new THREE.Vector3(x + rng.range(-0.05, 0.05), fy + len * 0.5, rng.range(-0.04, 0.04)), direction: new THREE.Vector3(rng.range(-0.6, 0.6), 1, 0.2).normalize() })));
    }
    metal.push(withTone(beam([x, base, 0], [x, fy - len * 0.4, 0], 0.016, 0.016), -0.2));
  }
  const metalMesh = new THREE.Mesh(mergeToned(metal), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  metalMesh.name = "bronze";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  const fruit = new THREE.Mesh(mergeToned(glow), glowMaterial("cyan", { level: 3, id: 40 }));
  fruit.name = "fruit";
  group.add(metalMesh, fruit, glassMesh(glass));
  group.userData.surface = null;
}

/** Verre tramé : la rampe du verre clair, sans contour (chaque trou de la trame en aurait un), ni ombre portée. */
function glassMesh(parts) {
  const mesh = new THREE.Mesh(
    mergeToned(parts),
    createToonMaterial({ ramp: GLASSES.clear.ramp, ink: GLASSES.clear.ink, steps: [0.25, 0.5, 0.8], tone: true, dither: true, outline: false, id: 32 }),
  );
  mesh.name = "glass";
  mesh.receiveShadow = true;
  return mesh;
}
