// Le meuble-catalogue central des Archives du Complexe (fiche ARC-17 ★, docs/complexe/PIECES.md) : Ø 3,4 × 1,1 m.
// Un tambour de bronze sur un socle de pierre fumée, ceint de deux rangs de 24 tiroirs plats (8 secteurs de 3, séparés
// par des pilastres), chacun avec sa plaque d'index de laiton d'un pixel clair ; un plateau rond en 8 dalles de pierre
// fumée, un trait de glyphes ambre sur sa tranche ; au centre, un pupitre octogonal tournant à 8 casiers où dépassent
// les tranches lumineuses des cassettes ; au-dessus, la lampe de lecture articulée (ARC-06), suspendue à une tige.
// États : rangé, consulté (tiroirs tirés, cassettes et carnet sur le plateau), abandonné (poussière, lampe éteinte,
// casiers à moitié vides).
// Vie : le pupitre tourne d'un cran (45°) de temps en temps, un tiroir sort et rentre ; pilotable par le scénario
// (`group.userData.catalogue` : setDrawer, slide, turnTo, consult, setLife).
// La graine change les tiroirs tirés, le contenu des casiers (couleurs, vides), les tons des dalles et des plaques,
// les glyphes, la pose de la lampe, le rythme de la vie.
//
// 3 draw calls (pierre, bronze, lueurs) + 2 pour la lampe (laiton, abat-jour).

import * as THREE from "three";
import { sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildPrism, buildQuads } from "../../kit/geometry.js";
import { DATA_GLOWS, METALS, STONES } from "../../kit/palettes.js";
import {
  PX, bendAroundY, createRigidParts, glowMixMaterial, glyphStrip, mergeParts, metalMaterial, plain, ring, stoneMaterial,
  withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";
import * as articulatedLamp from "../lighting/articulated-lamp.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const STATES = { tidy: "Rangé", consulted: "Consulté (tiroirs tirés, cassettes sur le plateau)", dusty: "Abandonné (poussière)" };
const LAMPS = { lit: "Allumée", dim: "En veille", off: "Éteinte", none: "Sans lampe" };
const HALOS = { off: "Sans halo", on: "Éclaire le décor (dans le noir)" };
const LIVES = { on: "Le pupitre tourne, un tiroir sort de temps en temps", off: "Immobile" };

const SECTORS = 8; // secteurs de 45°, séparés par des pilastres
const PER = 3; // tiroirs par secteur et par rang
const ROWS = [0.34, 0.53]; // bas des deux rangs de tiroirs
const FACE_H = 0.15;
const RD = 1.6; // rayon des façades
const DEPTH = 0.5; // profondeur d'un tiroir
const TRAVEL = 0.42; // course d'un tiroir sorti
const TOP = 0.98; // dessus du plateau
const ROT = SECTORS * PER * ROWS.length; // n° de pièce du pupitre (après les 48 tiroirs)
const FIXED = 255;
// Couleurs des lueurs : glyphes ambre, puis les tranches des cassettes.
const GLOW_COLORS = [["amber", 2], [DATA_GLOWS.amber, 2], [DATA_GLOWS.cyan, 2], [DATA_GLOWS.green, 2], [DATA_GLOWS.red, 2], ["amber", 0]];
const G_GLYPH = 0, G_DIM = 5;

const params = {
  seed: seedParam("Change les tiroirs tirés, le contenu des casiers (couleurs, vides), les tons des dalles et des plaques, les glyphes, la pose de la lampe, le rythme de la vie."),
  state: choiceParam("État", STATES, "Rangé, consulté (deux ou trois tiroirs tirés, cassettes et carnet posés sur le plateau), ou abandonné (poussière, lampe éteinte, glyphes éteints, casiers à moitié vides)."),
  lamp: choiceParam("Lampe", LAMPS, "La lampe de lecture articulée suspendue au-dessus : allumée, en veille, éteinte, ou pas de lampe (le monde en pose une à part)."),
  halo: choiceParam("Halo", HALOS, "La lampe éclaire le décor autour d'elle dans le noir (une des lumières de halo de la scène)."),
  stem: numberParam("Tige", 0.6, 0.2, 4.2, "Longueur de la tige de la lampe, de son attache (2,8 m) au plafond (4,2 m sous la voûte des Archives).", { step: 0.1, unit: "m" }),
  life: choiceParam("Vie", LIVES, "Le pupitre central tourne d'un cran de temps en temps et un tiroir sort puis rentre ; ou immobile (le scénario pilote)."),
};

export const meta = {
  id: "furniture/tables/card-catalogue",
  name: "Meuble-catalogue",
  nameEn: "Card catalogue",
  category: "furniture",
  subcategory: "tables",
  description:
    "Le meuble-catalogue central des Archives du Complexe (★) : table ronde de Ø 3,4 m sur socle de pierre fumée, " +
    "48 tiroirs plats à plaques d'index de laiton, plateau en 8 dalles à trait de glyphes ambre, pupitre central " +
    "tournant à 8 casiers de cassettes lumineuses, lampe de lecture articulée suspendue au-dessus. Rangé, consulté ou " +
    "abandonné ; le pupitre tourne et les tiroirs sortent seuls, ou au gré du scénario. Fiche ARC-17.",
  tags: [
    "catalogue", "meuble-catalogue", "fichier", "tiroirs", "plaques d'index", "pupitre tournant", "casiers", "cassettes",
    "table ronde", "glyphes", "pierre fumée", "bronze", "archives", "le complexe", "complexe", "ancien-tech", "héros",
    "pilotable", "animé", "intérieur",
    "card catalogue", "index drawers", "round table", "rotating lectern", "pigeonholes", "data cassettes", "glyphs",
    "smoked stone", "archive room", "ancient complex", "ancient-tech", "hero asset", "scriptable", "animated", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-19",
  units: "1 unité = 1 mètre ; origine au sol au centre ; plateau à 0,98 m, pupitre à 1,6 m, lampe attachée à 2,8 m",
  footprint: { radius: 2.1, height: 3.2 },
  animated: ["life"],
  params,
  variants: variantsOf("state", params.state),
};

/**
 * Crée le meuble-catalogue.
 * @param {{seed?: number, state?: string, lamp?: string, halo?: string, stem?: number, life?: string}} [given]
 * @returns {THREE.Group} `group.userData.catalogue` : { drawers: 48, drawerFront(i), openness(i), setDrawer(i, u),
 *   slide(i, u, secondes), turnTo(k, secondes), consult(i), setLife(on) } (tiroir i = rang × 24 + colonne, la colonne 0
 *   à droite de +z en tournant vers +x) ; `group.userData.surface` (dessus du plateau) ; `userData.lightPoint`
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 233);
  const dusty = p.state === "dusty";
  const at = (r, a, y) => new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
  const stone = [], bronze = [], glow = [];
  const sector = (Math.PI * 2) / SECTORS;
  const pil = 0.09 / RD; // angle d'un pilastre

  // --- Socle de pierre fumée, en retrait, et anneau de bronze au pied du tambour.
  const socle = plain(new THREE.CylinderGeometry(1.48, 1.52, 0.22, 24));
  socle.translate(0, 0.11, 0);
  stone.push([withTone(socle, (x, y, z, nx, ny) => (ny > 0.5 ? -0.15 : -0.32)), FIXED]);
  bronze.push([withTone(ring({ radius: RD - 0.04, height: 0.1, y: 0.22, thickness: 0.07, segments: 24 }), -0.1), FIXED]);

  // --- Tambour : cœur sombre (on le voit entre les tiroirs et dans le trou d'un tiroir tiré), pilastres, corniche.
  const core = plain(new THREE.CylinderGeometry(RD - 0.035, RD - 0.035, 0.42, 24, 1, true));
  core.translate(0, 0.32 + 0.21, 0);
  bronze.push([withTone(core, -0.75), FIXED]);
  for (let s = 0; s < SECTORS; s++) {
    const a = s * sector;
    const pilaster = buildBlock([0.09, 0.42, 0.07], [0, 0.53, 0]);
    pilaster.rotateY(a).translate(...at(RD + 0.01, a, 0).toArray());
    bronze.push([withTone(pilaster, (x, y, z, nx, ny) => (ny > 0.5 ? 0.1 : 0.02)), FIXED]);
    // Plaque de secteur, au sommet du pilastre : un pixel de laiton.
    const tag = buildBlock([0.05, 0.04, 0.012], [0, 0.69, 0]);
    tag.rotateY(a).translate(...at(RD + 0.05, a, 0).toArray());
    bronze.push([withTone(tag, 0.5), FIXED]);
  }
  bronze.push([withTone(ring({ radius: RD - 0.02, height: 0.16, y: 0.72, thickness: 0.06, segments: 24 }), (x, y, z, nx, ny) => (ny > 0.5 ? 0.15 : -0.02)), FIXED]);

  // --- Plateau : 8 dalles annulaires (une par secteur), joint d'un pixel, tranche à glyphes.
  const slabs = [];
  for (let s = 0; s < SECTORS; s++) {
    const a0 = s * sector + 0.004, a1 = (s + 1) * sector - 0.004;
    const pts = [];
    const segs = 3;
    for (let k = 0; k <= segs; k++) pts.push([Math.sin(a0 + ((a1 - a0) * k) / segs) * 1.72, Math.cos(a0 + ((a1 - a0) * k) / segs) * 1.72]);
    for (let k = segs; k >= 0; k--) pts.push([Math.sin(a0 + ((a1 - a0) * k) / segs) * 0.66, Math.cos(a0 + ((a1 - a0) * k) / segs) * 0.66]);
    // Le contour n'est pas convexe (couronne) : deux moitiés convexes.
    const half = (k0, k1) => [...pts.slice(k0, k1 + 1), ...pts.slice(pts.length - 1 - k1, pts.length - k0)];
    const base = rng.range(-0.08, 0.06) + (dusty ? 0.12 : 0);
    slabs.push(base);
    for (const [k0, k1] of [[0, 1], [1, 2], [2, 3]]) {
      stone.push([withTone(buildPrism(half(k0, k1), TOP - 0.1, () => TOP), (x, y, z, nx, ny) => (ny > 0.5 ? base : base - 0.18)), FIXED]);
    }
  }
  // Rebord intérieur du puits (bronze) et anneau sous le plateau.
  bronze.push([withTone(ring({ radius: 0.6, height: 0.13, y: TOP - 0.11, thickness: 0.06, segments: 16 }), 0.1), FIXED]);
  // Anneau de glyphes ambre couché dans le plateau, près du bord (on le lit de dessus), filets de laiton sur les
  // joints des dalles, cercle de laiton côté puits, liseré de laiton sur la tranche.
  const glyphs = glyphStrip(rng, { length: Math.PI * 2 * 1.56 - 0.1, rows: 2, depth: 0.006 });
  glyphs.rotateX(-Math.PI / 2);
  bendAroundY(glyphs, 1.6, { concave: false });
  glyphs.translate(0, TOP - 0.002, 0);
  glow.push([withShade(glyphs, dusty ? G_DIM : G_GLYPH, GLOW_COLORS.length), FIXED]);
  for (let s = 0; s < SECTORS; s++) {
    const a = s * sector;
    const inlay = buildBlock([PX * 0.6, 0.006, 1.72 - 0.66 - 0.04], [0, TOP + 0.001, (1.72 + 0.66) / 2]);
    inlay.rotateY(a);
    bronze.push([withTone(inlay, 0.4 - (dusty ? 0.2 : 0)), FIXED]);
  }
  bronze.push([withTone(ring({ radius: 0.92, height: 0.006, y: TOP - 0.003, thickness: PX * 0.6, segments: 24 }), 0.35 - (dusty ? 0.2 : 0)), FIXED]);
  bronze.push([withTone(ring({ radius: 1.72, height: PX * 0.6, y: TOP - 0.03, thickness: 0.006, segments: 24 }), 0.3), FIXED]);

  // --- Tiroirs : pièces rigides 0..47, chacune sa caisse, sa plaque d'index et sa poignée.
  const drawerInfo = [];
  const span = (sector - pil) / PER;
  const faceW = 2 * RD * Math.sin(span / 2) - 0.035;
  ROWS.forEach((y0, row) => {
    for (let s = 0; s < SECTORS; s++) {
      for (let i = 0; i < PER; i++) {
        const k = row * SECTORS * PER + s * PER + i;
        const a = s * sector + pil / 2 + (i + 0.5) * span;
        const y = y0 + FACE_H / 2;
        const tone = rng.range(-0.1, 0.04) + (dusty ? 0.08 : 0);
        const parts = [
          withTone(buildBlock([faceW, FACE_H, DEPTH], [0, y, -DEPTH / 2]), (x, py, z, nx, ny, nz) => (nz > 0.5 ? tone : tone - 0.25)),
          withTone(buildBlock([0.1, 0.035, 0.012], [0, y + 0.035, 0.006]), rng.range(0.4, 0.55) - (dusty ? 0.15 : 0)), // plaque
          withTone(buildBlock([0.08, PX * 0.6, 0.03], [0, y - 0.03, 0.015]), 0.1), // poignée
        ];
        for (const g of parts) {
          g.rotateY(a).translate(...at(RD, a, 0).toArray());
          bronze.push([g, k]);
        }
        drawerInfo.push({ angle: a, y, u: 0, tween: null });
      }
    }
  });

  // --- Pupitre central tournant (pièce ROT) : plateau tournant, octogone à 8 casiers, chapeau et pommeau.
  const turntable = plain(new THREE.CylinderGeometry(0.58, 0.58, 0.04, 16));
  turntable.translate(0, TOP + 0.02, 0);
  bronze.push([withTone(turntable, 0.05), ROT]);
  const octo = (r, y0, y1, tone) => {
    const pts = [];
    for (let f = 0; f < 8; f++) pts.push([Math.sin((f + 0.5) * sector) * r, Math.cos((f + 0.5) * sector) * r]);
    bronze.push([withTone(buildPrism(pts, y0, () => y1), tone), ROT]);
  };
  const B0 = TOP + 0.04, B1 = 1.42;
  octo(0.46 / Math.cos(sector / 2), B0, B1, -0.6); // fond des casiers, sombre
  const apo = 0.46;
  const faceWidth = 2 * apo * Math.tan(sector / 2);
  const kinds = [1, 2, 3, 4];
  for (let f = 0; f < 8; f++) {
    const a = f * sector;
    const frame = [
      buildBlock([faceWidth, 0.05, 0.06], [0, B1 - 0.025, 0.03]),
      buildBlock([faceWidth, 0.04, 0.08], [0, B0 + 0.02, 0.04]),
      buildBlock([0.04, B1 - B0, 0.06], [-faceWidth / 2 + 0.02, (B0 + B1) / 2, 0.03]),
      buildBlock([0.04, B1 - B0, 0.06], [faceWidth / 2 - 0.02, (B0 + B1) / 2, 0.03]),
      buildBlock([faceWidth - 0.08, PX * 0.6, 0.04], [0, (B0 + B1) / 2 + 0.02, 0.02]), // tablette du milieu
    ];
    frame.forEach((g, j) => {
      withTone(g, j === 0 ? 0.12 : j === 4 ? -0.15 : 0);
      g.rotateY(a).translate(...at(apo, a, 0).toArray());
      bronze.push([g, ROT]);
    });
    const plate = buildBlock([0.12, 0.03, 0.01], [0, B1 - 0.025, 0.065]);
    plate.rotateY(a).translate(...at(apo, a, 0).toArray());
    bronze.push([withTone(plate, 0.5), ROT]);
    // Cassettes debout dans le casier : leurs tranches lumineuses (deux étages), quelques vides.
    for (const [yb, h] of [[B0 + 0.045, 0.1], [(B0 + B1) / 2 + 0.03, 0.1]]) {
      const n = dusty ? rng.int(0, 3) : rng.int(3, 6);
      const color = rng.pick(kinds);
      const quads = [];
      for (let c = 0; c < n; c++) {
        const x = -faceWidth / 2 + 0.07 + c * PX * 1.6 + (c >= 3 ? 0.03 : 0);
        quads.push({ position: [x, yb + h / 2, 0.012], size: [PX * 0.7, h - rng.range(0, 0.03)] });
      }
      if (!quads.length) continue;
      const g = buildQuads(quads);
      g.rotateY(a).translate(...at(apo, a, 0).toArray());
      glow.push([withShade(g, rng.chance(0.2) ? rng.pick(kinds) : color, GLOW_COLORS.length), ROT]);
    }
  }
  octo(0.52 / Math.cos(sector / 2), B1, B1 + 0.05, 0.12); // chapeau
  octo(0.3 / Math.cos(sector / 2), B1 + 0.05, B1 + 0.09, -0.05);
  const knob = plain(new THREE.SphereGeometry(0.07, 8, 5));
  knob.translate(0, B1 + 0.16, 0);
  bronze.push([withTone(knob, 0.45), ROT]);
  const stemK = plain(new THREE.CylinderGeometry(0.025, 0.035, 0.08, 6));
  stemK.translate(0, B1 + 0.11, 0);
  bronze.push([withTone(stemK, 0.2), ROT]);

  // --- Sur le plateau (consulté) : cassettes couchées et carnet ouvert, près des tiroirs tirés.
  const pulledAtStart = p.state === "consulted" ? [rng.int(0, 47), rng.int(0, 47), ...(rng.chance(0.5) ? [rng.int(0, 47)] : [])] : dusty ? [rng.int(24, 47)] : [];
  if (p.state === "consulted") {
    const near = drawerInfo[pulledAtStart[0]].angle;
    for (let c = 0; c < rng.int(2, 4); c++) {
      const a = near + rng.range(-0.25, 0.25), r = rng.range(1.15, 1.5);
      const cas = buildBlock([0.18, 0.02, 0.1], [0, TOP + 0.01, 0]);
      cas.rotateY(rng.range(0, Math.PI)).translate(...at(r, a, 0).toArray());
      bronze.push([withTone(cas, -0.45), FIXED]);
      const edge = buildBlock([0.18, 0.006, 0.012], [0, TOP + 0.022, 0.045]);
      edge.rotateY(rng.range(0, Math.PI)).translate(...at(r, a, 0).toArray());
      glow.push([withShade(edge, rng.pick(kinds), GLOW_COLORS.length), FIXED]);
    }
    const a = rng.chance(0.5) ? 0.35 : -0.35;
    const book = [
      withTone(buildBlock([0.34, 0.025, 0.24], [0, TOP + 0.0125, 0]), -0.6),
      withTone(buildBlock([0.15, 0.012, 0.21], [-0.08, TOP + 0.031, 0], [0, 0, 0.05]), 0.45),
      withTone(buildBlock([0.15, 0.012, 0.21], [0.08, TOP + 0.031, 0], [0, 0, -0.05]), 0.4),
    ];
    const spin = rng.range(0, Math.PI);
    for (const g of book) {
      g.rotateY(spin).translate(...at(1.3, near + a, 0).toArray());
      bronze.push([g, FIXED]);
    }
  }

  // --- Maillages : les pièces rigides (tiroirs, pupitre) dans le maillage du bronze et des lueurs.
  const group = new THREE.Group();
  group.name = meta.name;
  // Les pièces mobiles en dernier : seule leur plage part au GPU quand elles bougent.
  const order = (list) => [...list.filter(([, k]) => k === FIXED), ...list.filter(([, k]) => k !== FIXED)];
  const stoneMesh = new THREE.Mesh(mergeParts(stone).geometry, stoneMaterial(STONES.smoked, { seed: p.seed, id: 20 }));
  stoneMesh.name = "stone";
  const bronzeMerged = mergeParts(order(bronze));
  const bronzeMesh = new THREE.Mesh(bronzeMerged.geometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronzeMesh.name = "bronze";
  const glowMerged = mergeParts(order(glow));
  const glowMesh = new THREE.Mesh(glowMerged.geometry, glowMixMaterial(GLOW_COLORS, { id: 40 }));
  glowMesh.name = "glow";
  for (const mesh of [stoneMesh, bronzeMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  group.add(stoneMesh, bronzeMesh, glowMesh);
  const rigs = [createRigidParts(bronzeMerged.geometry, bronzeMerged.partOf, ROT + 1), createRigidParts(glowMerged.geometry, glowMerged.partOf, ROT + 1)];

  // --- La lampe de lecture, suspendue au-dessus du plateau.
  let lamp = null;
  if (p.lamp !== "none") {
    lamp = articulatedLamp.create({
      seed: p.seed,
      kind: "reading",
      mount: "hanging",
      state: dusty ? "off" : p.lamp,
      halo: p.halo,
      height: 2.8,
      chain: p.stem,
    });
    lamp.name = "lamp";
    group.add(lamp);
  }

  // --- Pilotage et vie.
  const ease = (x) => x * x * (3 - 2 * x);
  const time = () => sharedUniforms.uTime.value;
  const turn = { k: rng.int(0, 7), from: 0, to: 0, start: 0, seconds: 0 };
  turn.from = turn.to = -turn.k * sector;
  let life = p.life === "on";
  let dirty = true;
  const catalogue = {
    drawers: drawerInfo.length,
    /** Centre de la façade du tiroir i (repère de l'asset), pour qu'un personnage s'y place. */
    drawerFront: (i) => at(RD + 0.05, drawerInfo[i].angle, drawerInfo[i].y),
    openness: (i) => drawerInfo[i]?.u ?? 0,
    setDrawer(i, u) {
      const d = drawerInfo[i];
      if (!d) return;
      d.u = THREE.MathUtils.clamp(u, 0, 1);
      d.tween = null;
      dirty = true;
    },
    slide(i, u, seconds = 1) {
      const d = drawerInfo[i];
      if (!d) return;
      d.tween = { from: d.u, to: THREE.MathUtils.clamp(u, 0, 1), start: time(), seconds, then: null };
    },
    /** Tourne le pupitre jusqu'au casier k (0..7) face à +z. */
    turnTo(k, seconds = 1.2) {
      const cur = turn.from + (turn.to - turn.from) * ease(THREE.MathUtils.clamp((time() - turn.start) / Math.max(1e-3, turn.seconds), 0, 1));
      let target = -(((k % 8) + 8) % 8) * sector;
      while (target - cur > Math.PI) target -= Math.PI * 2;
      while (cur - target > Math.PI) target += Math.PI * 2;
      Object.assign(turn, { k: ((k % 8) + 8) % 8, from: cur, to: target, start: time(), seconds });
    },
    /** La consultation : le pupitre tourne vers le tiroir i, le tiroir sort, reste, puis rentre. */
    consult(i, seconds = 4) {
      const d = drawerInfo[i];
      if (!d) return;
      catalogue.turnTo(Math.round(-d.angle / sector));
      d.tween = { from: d.u, to: 1, start: time(), seconds: 0.9, then: { to: 0, after: seconds, seconds: 0.9 } };
    },
    setLife(on) {
      life = Boolean(on);
    },
  };
  for (const i of pulledAtStart) catalogue.setDrawer(i, rng.chance(0.5) ? 0.55 : 1);

  // Vie : tous les 7 à 11 s, soit le pupitre tourne d'un cran, soit un tiroir sort un moment (choix tiré du temps).
  const period = rng.range(7, 11);
  const phase = rng.range(0, period);
  let lastBeat = -1;
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + p.seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  let lastAngle = NaN;
  const m = new THREE.Matrix4();
  group.updateMatrixWorld = (force) => {
    const now = time();
    if (now !== lastTime || dirty) {
      lastTime = now;
      if (life && !dusty) {
        const beat = Math.floor((now + phase) / period);
        if (beat !== lastBeat) {
          if (lastBeat >= 0) {
            if (hash(beat) < 0.5) catalogue.turnTo(turn.k + (hash(beat + 0.5) < 0.5 ? 1 : -1));
            else {
              const i = Math.floor(hash(beat + 0.25) * drawerInfo.length);
              if (drawerInfo[i].u === 0 && !drawerInfo[i].tween) drawerInfo[i].tween = { from: 0, to: 0.6, start: now, seconds: 0.8, then: { to: 0, after: 2.5, seconds: 0.8 } };
            }
          }
          lastBeat = beat;
        }
      }
      drawerInfo.forEach((d, i) => {
        if (d.tween) {
          const k = THREE.MathUtils.clamp((now - d.tween.start) / d.tween.seconds, 0, 1);
          d.u = d.tween.from + (d.tween.to - d.tween.from) * ease(k);
          if (k >= 1) {
            const then = d.tween.then;
            // Puis il attend `after` secondes avant de rentrer.
            d.tween = then ? { from: d.u, to: then.to, start: now + then.after, seconds: then.seconds, then: null } : null;
          }
          dirty = true;
        }
        const out = at(d.u * TRAVEL, d.angle, 0);
        for (const rig of rigs) rig.matrices[i].makeTranslation(out.x, 0, out.z);
      });
      const tk = THREE.MathUtils.clamp((now - turn.start) / Math.max(1e-3, turn.seconds), 0, 1);
      const angle = turn.from + (turn.to - turn.from) * ease(tk);
      for (const rig of rigs) rig.matrices[ROT].copy(m.makeRotationY(angle));
      if (dirty || angle !== lastAngle) {
        lastAngle = angle;
        for (const rig of rigs) rig.apply();
      }
      dirty = false;
    }
    baseUpdate(force);
  };
  group.updateMatrixWorld(true);

  group.userData.catalogue = catalogue;
  group.userData.surface = { height: TOP, radius: 1.7, inner: 0.66 };
  if (lamp) group.userData.lightPoint = lamp.userData.lightPoint;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
