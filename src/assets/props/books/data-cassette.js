// Cassette de données et rouleau-bande des Archives du Complexe (fiches ARC-03 et ARC-12, docs/complexe/PIECES.md).
// - Cassette : plaquette de verre fumé de 0,18 × 0,10 m sertie de cuivre, dont la tranche avant luit (1 px) d'une des
//   quatre couleurs de classement ; la tranche est coupée en 1 à 3 traits, un code tiré de la graine. Très légère
//   (moins de 50 triangles), faite pour être posée des centaines de fois : couchée, debout sur sa tranche, ou en pile.
// - Rouleau-bande : bobine de bois noirci, bande de cuivre enroulée dont le bout pend jusqu'au sol et s'étale sur
//   0,4 à 0,55 m, gravé de 3 à 5 traits.
// La graine change le code de la tranche, l'éraflure, le désordre d'une pile ; pour le rouleau, la longueur du bout,
// les traits gravés, l'épaisseur de bande restante.
//
// Cassette : 3 draw calls (cuivre, verre, tranche). Rouleau : 2 (bois, cuivre).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads } from "../../kit/geometry.js";
import { DATA_GLOWS, GLASSES, METALS, WOODS } from "../../kit/palettes.js";
import { PX, glowMaterial, mergeToned, metalMaterial, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = { cassette: "Cassette de verre", roll: "Rouleau-bande de cuivre" };
const POSES = { lying: "Couchée", standing: "Debout sur sa tranche", stack: "En pile" };
const WEARS = { used: "Servie", new: "Neuve", worn: "Usée" };
const L = 0.18, Wd = 0.1, T = 0.024; // cassette : longueur, largeur, épaisseur (un peu forcée pour tenir un pixel)

const params = {
  seed: seedParam("Change le code lumineux de la tranche, l'éraflure du verre, le désordre d'une pile ; pour le rouleau, la longueur du bout, les traits gravés, la bande restante."),
  kind: choiceParam("Objet", KINDS, "Cassette de verre sertie de cuivre (ARC-03), ou rouleau-bande de cuivre sur bobine de bois (ARC-12)."),
  color: choiceParam("Tranche", DATA_GLOWS, "Couleur de classement de la tranche lumineuse (cassette)."),
  wear: choiceParam("Usure", WEARS, "Neuve (cuivre vif, tranche vive), servie, ou usée (cuivre terni, verre éraflé, tranche faible)."),
  pose: choiceParam("Pose", POSES, "Couchée à plat, debout sur sa tranche (lueur en haut), ou en pile."),
  count: numberParam("Pile", 5, 2, 8, "Nombre de cassettes dans une pile (pose « En pile »), ou de rouleaux (3 au plus).", { step: 1 }),
};

export const meta = {
  id: "props/books/data-cassette",
  name: "Cassette de données",
  nameEn: "Data cassette",
  category: "props",
  subcategory: "books",
  description:
    "Le livre du Complexe : une plaquette de verre fumé sertie de cuivre dont la tranche luit d'une couleur de " +
    "classement (ambre, cyan, vert, rouge), couchée, debout ou en pile ; très légère, faite pour être posée par " +
    "centaines. Ou un rouleau-bande de cuivre gravé sur sa bobine de bois, le bout déroulé. Fiches ARC-03, ARC-12.",
  tags: [
    "cassette", "données", "mémoire", "archive", "verre fumé", "cuivre", "tranche lumineuse", "rouleau", "bande gravée",
    "bobine", "livre", "le complexe", "complexe", "ancien-tech", "lumineux", "léger", "intérieur",
    "data cassette", "glass tablet", "record", "smoked glass", "copper", "glowing edge", "scroll", "engraved tape",
    "spool", "book", "ancient complex", "ancient-tech", "glowing", "lightweight", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; origine au sol, au centre de l'objet (la tranche lumineuse regarde +z, ou le haut debout)",
  footprint: { radius: 0.32, height: 0.12 },
  animated: [],
  params,
  variants: [
    { id: "lying", name: "Cassette couchée", params: {} },
    { id: "standing", name: "Cassette debout", params: { pose: "standing", color: "cyan" } },
    { id: "stack", name: "Pile de cassettes", params: { pose: "stack", color: "green", wear: "worn" } },
    { id: "roll", name: "Rouleau-bande", params: { kind: "roll" } },
  ],
};

/**
 * Crée la cassette (ou le rouleau).
 * @param {{seed?: number, kind?: string, color?: string, wear?: string, pose?: string, count?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 83);
  const group = new THREE.Group();
  group.name = meta.name;
  if (p.kind === "roll") buildRolls(group, p, rng);
  else buildCassettes(group, p, rng);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

function buildCassettes(group, p, rng) {
  const wear = { new: -0.08, used: -0.2, worn: -0.38 }[p.wear]; // serti plus sombre que la tranche, de la même famille
  // Le code de la tranche : 1 à 3 traits séparés d'un vide, toujours le même pour une graine.
  const marks = rng.int(1, 3);
  const cuts = Array.from({ length: marks - 1 }, () => rng.range(0.2, 0.8)).sort();
  const scratch = p.wear === "worn" || rng.chance(0.3) ? rng.range(-0.4, 0.4) : null;
  const copper = [], glass = [], light = [];
  const count = p.pose === "stack" ? Math.round(p.count) : 1;
  for (let i = 0; i < count; i++) {
    const m = new THREE.Matrix4();
    if (p.pose === "standing") {
      // Debout sur sa tranche arrière : la tranche lumineuse regarde le haut.
      m.makeRotationY(rng.range(-0.3, 0.3)).multiply(new THREE.Matrix4().makeTranslation(0, Wd / 2, 0)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    } else {
      const spin = p.pose === "stack" ? rng.range(-0.12, 0.12) + (rng.chance(0.15) ? Math.PI : 0) : rng.range(-0.3, 0.3);
      m.makeTranslation(p.pose === "stack" ? rng.range(-0.012, 0.012) : 0, T / 2 + i * T, p.pose === "stack" ? rng.range(-0.01, 0.01) : 0);
      m.multiply(new THREE.Matrix4().makeRotationY(spin));
    }
    // Serti de cuivre (le bloc entier), verre posé dessus et dessous en faces plates.
    copper.push(withTone(buildBlock([L, T, Wd]).applyMatrix4(m), wear + (i % 2 ? -0.06 : 0)));
    const faces = [
      { position: [0, T / 2 + 0.001, -0.004], size: [L - 0.03, Wd - 0.032], normal: [0, 1, 0], tone: 0 },
      { position: [0, -T / 2 - 0.001, -0.004], size: [L - 0.03, Wd - 0.032], normal: [0, -1, 0], tone: -0.2 },
    ];
    if (scratch !== null && i === count - 1) faces.push({ position: [scratch * 0.06, T / 2 + 0.002, 0], size: [0.05, PX * 0.4], normal: [0, 1, 0], tone: 0.55 });
    glass.push(buildQuads(faces).applyMatrix4(m));
    // Tranche : la face avant (+z), coupée en traits.
    const bounds = [0, ...cuts, 1];
    const segs = [];
    for (let k = 0; k < bounds.length - 1; k++) {
      const a = -L / 2 + 0.012 + bounds[k] * (L - 0.024) + (k ? 0.008 : 0);
      const b = -L / 2 + 0.012 + bounds[k + 1] * (L - 0.024) - (k < bounds.length - 2 ? 0.008 : 0);
      segs.push({ position: [(a + b) / 2, 0, Wd / 2 + 0.0015], size: [b - a, T * 0.62] });
    }
    light.push(buildQuads(segs).applyMatrix4(m));
  }
  const copperMesh = new THREE.Mesh(mergeToned(copper), metalMaterial(METALS.copper, { id: 30, tone: true }));
  copperMesh.name = "rim";
  const glassMesh = new THREE.Mesh(mergeToned(glass), createToonMaterial({ ramp: GLASSES.smoky.ramp, ink: GLASSES.smoky.ink, steps: [0.3, 0.55, 0.85], tone: true, crease: true, id: 31 }));
  glassMesh.name = "glass";
  const slice = new THREE.Mesh(mergeToned(light), glowMaterial(DATA_GLOWS[p.color], { level: p.wear === "worn" ? 1 : p.wear === "new" ? 3 : 2, id: 40 }));
  slice.name = "slice";
  for (const mesh of [copperMesh, glassMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(copperMesh, glassMesh, slice);
}

function buildRolls(group, p, rng) {
  const wood = [], tape = [];
  const n = p.pose === "stack" ? Math.min(3, Math.round(p.count)) : 1;
  const flange = 0.06, axle = 0.4;
  // Pile : deux rouleaux au sol, un troisième dans le creux ; seul le dernier déroule son bout.
  const spots = [[0, flange, 0], [0, flange, -0.125], [0, flange + 0.104, -0.0625]].slice(0, n);
  if (n === 1) spots[0][2] = -0.12;
  const tarnish = { new: 0.1, used: 0, worn: -0.18 }[p.wear];
  spots.forEach(([x, y, z], i) => {
    const turn = rng.range(0, Math.PI);
    const r = rng.range(0.034, 0.05); // bande restante
    for (const s of [-1, 1]) {
      const g = plain(new THREE.CylinderGeometry(flange, flange, 0.02, 8));
      g.rotateZ(Math.PI / 2);
      g.rotateX(turn);
      g.translate(x + s * (axle / 2 - 0.01), y, z);
      wood.push(withTone(g, (px, py, pz, nx) => (Math.abs(nx) > 0.5 ? 0.05 : -0.1)));
      const hub = plain(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6));
      hub.rotateZ(Math.PI / 2);
      hub.translate(x + s * (axle / 2 + 0.005), y, z);
      wood.push(withTone(hub, 0.2));
    }
    const coil = plain(new THREE.CylinderGeometry(r, r, axle - 0.04, 10));
    coil.rotateZ(Math.PI / 2);
    coil.rotateX(turn);
    coil.translate(x, y, z);
    // Spires : un trait sombre tous les 2 pixels le long de la bande.
    tape.push(withTone(coil, (px) => tarnish + (Math.abs(((px - x) / (PX * 2)) % 1) < 0.18 ? -0.25 : 0)));
    if (i !== n - 1) return;
    // Le bout : part du dessus avant de la bobine, descend jusqu'au sol, s'étale, et se relève un peu au bout.
    const length = rng.range(0.4, 0.55);
    const width = axle - 0.06;
    const pts = [[y + r * 0.6, z + r * 0.85], [y - flange * 0.5, z + r + 0.035], [0.004, z + r + 0.07]];
    let left = length - 0.12;
    let zz = pts[2][1];
    while (left > 0.02) {
      const step = Math.min(0.1, left);
      zz += step;
      left -= step;
      pts.push([0.004 + (left < 0.05 ? 0.012 : 0), zz]);
    }
    const strokes = rng.int(3, 5);
    const at = Array.from({ length: strokes }, (_, k) => 0.2 + (k + rng.range(0.2, 0.8)) * ((length - 0.25) / strokes));
    const engraved = [];
    let run = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [ya, za] = pts[k], [yb, zb] = pts[k + 1];
      const len = Math.hypot(yb - ya, zb - za);
      const angle = Math.atan2(-(yb - ya), zb - za);
      const strip = buildBlock([width, 0.004, len + 0.002], [x, (ya + yb) / 2, (za + zb) / 2], [angle, 0, 0]);
      tape.push(withTone(strip, (px, py, pz, nx, ny) => tarnish + (ny > 0.3 ? -0.12 : -0.3)));
      // Traits gravés : une bande sombre d'un pixel en travers du dessus, un peu plus courte que la bande.
      for (const d of at) {
        if (d < run || d >= run + len) continue;
        const u = (d - run) / len;
        const ny = Math.cos(angle), nz = Math.sin(angle); // normale du dessus de la bande
        engraved.push({
          position: [x + rng.range(-0.02, 0.02), ya + (yb - ya) * u + ny * 0.0025, za + (zb - za) * u + nz * 0.0025],
          size: [width * rng.range(0.55, 0.8), PX * 0.55],
          normal: [0, ny, nz],
          tone: -0.75,
        });
      }
      run += len;
    }
    if (engraved.length) tape.push(buildQuads(engraved));
  });
  const woodEntry = WOODS.blackenedOak;
  const woodMesh = new THREE.Mesh(mergeToned(wood), createToonMaterial({ ramp: woodEntry.ramp, ink: woodEntry.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, id: 20 }));
  woodMesh.name = "spool";
  const tapeMesh = new THREE.Mesh(mergeToned(tape), metalMaterial(METALS.copper, { id: 30, tone: true, steps: [0.34, 0.56, 0.8, 0.97] }));
  tapeMesh.name = "tape";
  for (const mesh of [woodMesh, tapeMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}
