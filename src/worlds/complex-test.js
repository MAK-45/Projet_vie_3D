// Le Complexe, monde d'essai : les assets déjà dessinés (lots 1 à 3) assemblés en quatre pièces praticables, pour voir
// le rendu d'ensemble avant le vrai monde (`worlds/interiors/ancient-complex`, lot 5 du plan, docs/complexe/PLAN.md).
//
// Le plan suit la bible (docs/complexe/README.md), en plus petit :
// - le Sas (10 × 6 × 5 m) : la Porte-Iris au sud (elle joue sa séquence quand on approche), piliers d'angle, bancs,
//   casiers, pupitre de vérification, tuyau et valve, malles, lampe portative, poteaux de balisage ;
// - les Archives (18 × 12 × 6 m), au nord du Sas : une colonnade, un lustre, des pupitres de lecture, des casiers
//   en attendant les meubles à tiroirs ;
// - l'Atelier (12 × 10 × 6 m), à l'est des Archives : dalles tachées, tranchée de service sous caillebotis éclairé,
//   armoires à fusibles, tuyaux géants, établis en attendant ;
// - un tronçon de la Grande Galerie (4 × 20 m), au nord de l'Atelier : appliques, bancs, portes des salles d'étude
//   (fermées), grande porte de liaison au bout.
//
// Murs, dalles, piliers et meubles sont posés en copies instanciées (kit/interior.js) : quelques draw calls par
// modèle, quel que soit le nombre de copies. Vue en coupe : ce qui est entre le promeneur et la caméra disparaît
// en entier (murs, portes, piliers d'angle, ce qui est accroché à ces murs, lampes) ; les colonnes isolées sont
// coupées à 1,20 m. Les portes entre deux pièces
// s'ouvrent quand on approche ; fermées, elles bloquent.
//
// 1 unité = 1 mètre ; le sol est en y = 0 (dessus des dalles) ; x vers l'est, z vers le sud ; grille de 2 m.

import * as THREE from "three";
import { enableCutaway } from "../engine/toon-material.js";
import { GLOWS } from "../assets/kit/palettes.js";
import { createRng } from "../assets/kit/rng.js";
import * as bronzeRailing from "../assets/buildings/structure/bronze-railing.js";
import * as handLamp from "../assets/props/tools/hand-lamp.js";
import * as irisDoor from "../assets/buildings/structure/iris-door.js";
import * as travelTrunk from "../assets/furniture/storage/travel-trunk.js";
import * as braidedCable from "../assets/props/machines/braided-cable.js";
import * as cofferedVault from "../assets/buildings/structure/coffered-vault.js";
import * as complexDoor from "../assets/buildings/structure/complex-door.js";
import * as copperPipe from "../assets/props/machines/copper-pipe.js";
import * as equipmentLocker from "../assets/furniture/storage/equipment-locker.js";
import * as filamentChandelier from "../assets/furniture/lighting/filament-chandelier.js";
import * as filamentLamp from "../assets/furniture/lighting/filament-lamp.js";
import * as glyphColumn from "../assets/buildings/structure/glyph-column.js";
import * as glyphFloorSlab from "../assets/buildings/structure/glyph-floor-slab.js";
import * as glyphPlaque from "../assets/props/decor/glyph-plaque.js";
import * as glyphWall from "../assets/buildings/structure/glyph-wall.js";
import * as leverDesk from "../assets/props/machines/lever-desk.js";
import * as stoneBench from "../assets/furniture/seating/stone-bench.js";
import * as ventGrate from "../assets/buildings/structure/vent-grate.js";
import * as wheelValve from "../assets/props/machines/wheel-valve.js";
import { createDaylight } from "./kit/sky.js";
import { BoxColliders, createHaloPool, InteriorKit } from "./kit/interior.js";

export const COMPLEX_TEST_SIZES = {
  sas: { label: "Le Sas", meters: 10 },
  wing: { label: "Sas et Archives", meters: 18 },
  full: { label: "Les quatre pièces", meters: 36 },
};

/** Pièces : emprise aux axes des murs (m), hauteur sous plafond. */
const ROOMS = {
  sas: { name: "Sas", x0: -5, x1: 5, z0: 0, z1: 6, h: 5 },
  archives: { name: "Archives", x0: -9, x1: 9, z0: -12, z1: 0, h: 6 },
  atelier: { name: "Atelier", x0: 9, x1: 21, z0: -10, z1: 0, h: 6 },
  gallery: { name: "Grande Galerie", x0: 13, x1: 17, z0: -30, z1: -10, h: 6 },
};
const LAYOUTS = { sas: ["sas"], wing: ["sas", "archives"], full: ["sas", "archives", "atelier", "gallery"] };

/**
 * Portes : mur (`axis` x : le mur suit l'axe x en z = `line` ; z : il suit z en x = `line`), centre de la baie, modèle.
 * `auto` : s'ouvre à l'approche quand une pièce est de chaque côté ; `show` : s'ouvre à l'approche sans mener nulle
 * part (l'entrée : on la regarde s'ouvrir, on ne sort pas).
 */
const DOORS = [
  { axis: "x", line: 6, at: 0, model: "iris", auto: false, show: true, seed: 11 }, // entrée : s'ouvre pour qu'on la voie
  { axis: "x", line: 0, at: 0, model: "standard", auto: true, seed: 12 },
  { axis: "z", line: 9, at: -5, model: "standard", auto: true, seed: 13 },
  { axis: "x", line: -10, at: 15, model: "link", auto: true, seed: 14 },
  { axis: "z", line: 13, at: -15, model: "study", number: 1, auto: false, seed: 15 },
  { axis: "z", line: 13, at: -25, model: "study", number: 2, auto: false, seed: 16 },
  { axis: "z", line: 17, at: -19, model: "study", number: 4, auto: false, seed: 17 },
  { axis: "z", line: 17, at: -27, model: "study", number: 5, auto: false, seed: 18 },
  { axis: "x", line: -30, at: 15, model: "link", auto: false, seed: 19 },
];

// Vue en coupe : les murs, portes et piliers d'angle entre le promeneur et la caméra sont masqués en entier (un mur
// coupé à mi-hauteur laissait un moignon disgracieux en vue isométrique).
const WALL_CUT = { rule: "wall", height: -1 };
const HIDE_ON_WALL = { rule: "wall", height: -1 };
const CORNER_CUT = { rule: "corner", height: -1 };
const VIEW_CUT = { rule: "view", height: 1.2 };
const VIEW_HIDE = { rule: "view", height: -1 };
const AMBER = GLOWS.amber.light;
const HALF_PI = Math.PI / 2;

/**
 * Crée le Complexe d'essai.
 * @param {object} [options]
 * @param {number} [options.seed] variantes des dalles, des murs, du mobilier, lampes faibles
 * @param {"sas"|"wing"|"full"} [options.size] pièces assemblées
 * @param {number} [options.furniture] mobilier, 0 (pièces nues) à 2 (encombré)
 * @param {number} [options.lamps] lampes, 0 (aucune : le noir) à 2
 * @param {boolean} [options.diorama] sans lumière (fiche et vignette de l'asset)
 */
export function createComplexTest({ seed = 1, size = "full", furniture = 1, lamps = 1, diorama = false } = {}) {
  seed = THREE.MathUtils.clamp(Math.round(seed) || 0, 0, 9999);
  const roomIds = LAYOUTS[size] ?? LAYOUTS.full;
  const rooms = roomIds.map((id) => ({ id, ...ROOMS[id] }));
  const rng = createRng(seed * 7919 + 101);
  const kit = new InteriorKit();
  const colliders = new BoxColliders();
  const group = new THREE.Group();
  group.name = "Complexe (essai)";
  const counts = { rooms: rooms.length, slabs: 0, walls: 0, doors: 0, furniture: 0, lamps: 0 };
  const lightSources = [];

  const roomAt = (x, z) => rooms.find((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  const bounds = {
    minX: Math.min(...rooms.map((r) => r.x0)) - 1,
    maxX: Math.max(...rooms.map((r) => r.x1)) + 1,
    minZ: Math.min(...rooms.map((r) => r.z0)) - 1,
    maxZ: Math.max(...rooms.map((r) => r.z1)) + 1,
  };

  // --- Modèles ---------------------------------------------------------------------------------------------------
  const slabModels = {
    intact: { variant: "intact", seed: seed + 1 },
    worn: { variant: "worn", seed: seed + 3 },
    cracked: { variant: "cracked", seed: seed + 4 },
    trapdoor: { variant: "trapdoor", seed: seed + 5 },
    stained: { variant: "stained", seed: seed + 6 },
  };
  for (const [key, params] of Object.entries(slabModels)) kit.model(`slab-${key}`, glyphFloorSlab, params, { castShadow: false });

  // Pose d'un objet (copie instanciée) avec, en option, une emprise au sol : largeur × profondeur dans le repère de
  // l'objet, décalée de `oz` vers son +z (meubles muraux : l'origine est au mur).
  const put = (key, x, z, rotY = 0, box = null, y = 0) => {
    kit.place(key, x, z, rotY, y);
    if (box) {
      const [w, d, oz = 0] = box;
      const c = Math.cos(rotY), s = Math.sin(rotY);
      const cx = x + s * oz, cz = z + c * oz;
      const swap = Math.abs(s) > 0.5;
      colliders.add(cx, cz, (swap ? d : w) / 2, (swap ? w : d) / 2);
    }
  };

  // --- Sols ------------------------------------------------------------------------------------------------------
  // Dalles de 2 × 2 m centrées sur les x pairs et les z impairs (les murs sont sur les x impairs et les z pairs).
  const trench = new Set(); // Atelier : tranchée de service sous caillebotis
  if (roomIds.includes("atelier")) for (const x of [12, 14, 16, 18]) trench.add(`${x},-5`);
  kit.model("grating", ventGrate, { model: "floor", light: "standby", glow: "amber", seed: seed + 7 }, { castShadow: false });
  for (const room of rooms) {
    for (let x = room.x0 + 1; x < room.x1; x += 2) {
      for (let z = room.z0 + 1; z < room.z1; z += 2) {
        if (trench.has(`${x},${z}`)) {
          put("grating", x, z, 0, null, -0.06);
          continue;
        }
        const roll = rng.next();
        const turn = rng.int(0, 3) * HALF_PI;
        let key;
        if (room.id === "sas") key = x === 0 ? "worn" : "intact";
        else if (room.id === "atelier") key = roll < 0.55 ? "stained" : roll < 0.8 ? "intact" : "cracked";
        else if (room.id === "gallery") key = roll < 0.45 ? "worn" : roll < 0.6 ? "cracked" : "intact";
        else key = roll < 0.12 ? "cracked" : roll < 0.3 ? "worn" : "intact";
        if (room.id === "sas" && x === 2 && z === 1) key = "trapdoor";
        put(`slab-${key}`, x, z, turn, null, -0.2);
        counts.slabs += 1;
      }
    }
  }

  // --- Murs et portes --------------------------------------------------------------------------------------------
  // Chaque bord de pièce est découpé en modules de 2 m ; un module commun à deux pièces n'est posé qu'une fois.
  const pieces = new Map();
  const addEdge = (room, axis, line, from, to, inward) => {
    for (let c = from + 1; c < to; c += 2) {
      const key = `${axis}:${line}:${c}`;
      const piece = pieces.get(key);
      if (piece) {
        piece.h = Math.max(piece.h, room.h);
        piece.shared = true;
      } else {
        pieces.set(key, { axis, line, c, h: room.h, inward, room, shared: false });
      }
    }
  };
  for (const room of rooms) {
    addEdge(room, "x", room.z0, room.x0, room.x1, +1); // mur nord : la pièce est vers +z
    addEdge(room, "x", room.z1, room.x0, room.x1, -1);
    addEdge(room, "z", room.x0, room.z0, room.z1, +1);
    addEdge(room, "z", room.x1, room.z0, room.z1, -1);
  }
  // Rotation d'un module : sa face +z vers l'intérieur de la pièce.
  const wallTurn = (axis, inward) => (axis === "x" ? (inward > 0 ? 0 : Math.PI) : inward > 0 ? HALF_PI : -HALF_PI);
  const wallXZ = (axis, line, c) => (axis === "x" ? [c, line] : [line, c]);

  const doors = [];
  for (const spec of DOORS) {
    const width = spec.model === "iris" ? 6 : spec.model === "link" || spec.model === "double" ? 4 : 2;
    const centers = width === 6 ? [spec.at - 2, spec.at, spec.at + 2] : width === 4 ? [spec.at - 1, spec.at + 1] : [spec.at];
    const keys = centers.map((c) => `${spec.axis}:${spec.line}:${c}`);
    if (!keys.every((key) => pieces.has(key))) continue;
    const piece = pieces.get(keys[0]);
    for (const key of keys) pieces.delete(key);
    const [x, z] = wallXZ(spec.axis, spec.line, spec.at);
    // De quel côté sont les pièces ? Une porte ne s'ouvre seule que si elle mène quelque part.
    const [ax, az] = spec.axis === "x" ? [x, z - 1] : [x - 1, z];
    const [bx, bz] = spec.axis === "x" ? [x, z + 1] : [x + 1, z];
    const both = roomAt(ax, az) && roomAt(bx, bz);
    const object = spec.model === "iris"
      ? irisDoor.create({ seed: seed * 31 + spec.seed, height: piece.h, state: "closed" })
      : complexDoor.create({ seed: seed * 31 + spec.seed, model: spec.model, number: spec.number ?? 1, height: piece.h, state: "closed" });
    object.position.set(x, 0, z);
    object.rotation.y = wallTurn(spec.axis, piece.inward);
    object.traverse((child) => {
      if (!child.isMesh || !child.material.uniforms?.uRamp) return;
      enableCutaway(child.material, WALL_CUT.rule, WALL_CUT.height);
      child.customDepthMaterial = child.material.userData.depthMaterial;
    });
    group.add(object);
    const door = object.userData.door;
    const open = door.opening.width;
    // Emprise : les deux jambages toujours, la baie tant que la porte bloque.
    const along = spec.axis === "x";
    for (const s of [-1, 1]) {
      const mid = s * (width / 2 + open / 2) / 2;
      const half = (width / 2 - open / 2) / 2;
      if (along) colliders.add(x + mid, z, half, 0.3);
      else colliders.add(x, z + mid, 0.3, half);
    }
    if (along) colliders.add(x, z, open / 2, 0.3, () => door.blocking);
    else colliders.add(x, z, 0.3, open / 2, () => door.blocking);
    doors.push({ object, door, x, z, auto: spec.auto && both, show: !!spec.show });
    counts.doors += 1;
  }

  // Modules de mur : plein surtout, une niche ou un conduit par endroits (pas sur les murs partagés).
  const wallModel = (h, variant) => {
    const key = `wall-${h}-${variant}`;
    kit.model(key, glyphWall, { seed: seed * 13 + h * 7 + variant.length, variant, height: h, width: 2 }, { cut: WALL_CUT, castShadow: true });
    return key;
  };
  for (const piece of pieces.values()) {
    const roll = rng.next();
    const variant = piece.shared || piece.h < 6 ? "plain" : roll < 0.1 ? "niche" : roll < 0.16 ? "conduit" : "plain";
    const [x, z] = wallXZ(piece.axis, piece.line, piece.c);
    const turn = wallTurn(piece.axis, piece.inward);
    put(wallModel(piece.h, variant), x, z, turn);
    if (piece.axis === "x") colliders.add(x, z, 1, 0.3);
    else colliders.add(x, z, 0.3, 1);
    counts.walls += 1;
  }

  // Piliers d'angle carrés aux coins de chaque pièce (ils cachent aussi la jonction des murs).
  const corners = new Map();
  for (const room of rooms) {
    for (const [x, z] of [[room.x0, room.z0], [room.x1, room.z0], [room.x0, room.z1], [room.x1, room.z1]]) {
      const key = `${x},${z}`;
      corners.set(key, Math.max(corners.get(key) ?? 0, room.h));
    }
  }
  for (const [key, h] of corners) {
    const [x, z] = key.split(",").map(Number);
    const model = `pillar-${h}`;
    kit.model(model, glyphColumn, { seed: seed + h, shape: "square", height: h, diameter: 0.9 }, { cut: CORNER_CUT, castShadow: true });
    put(model, x, z, 0, [0.9, 0.9]);
  }

  // --- Mobilier --------------------------------------------------------------------------------------------------
  // Une pose contre un mur : `side` n, s, e, w ; `t` coordonnée le long du mur ; `inset` distance au nu du mur.
  const onWall = (room, side, t, inset = 0) => {
    const face = 0.3 + inset;
    if (side === "n") return [t, room.z0 + face, 0];
    if (side === "s") return [t, room.z1 - face, Math.PI];
    if (side === "w") return [room.x0 + face, t, HALF_PI];
    return [room.x1 - face, t, -HALF_PI];
  };
  const wallItem = (key, room, side, t, inset, box = null) => {
    const [x, z, turn] = onWall(room, side, t, inset);
    put(key, x, z, turn, box);
    counts.furniture += 1;
  };
  const has = (id) => roomIds.includes(id);
  const R = Object.fromEntries(rooms.map((room) => [room.id, room]));
  const lots = furniture >= 0.5;
  const many = furniture >= 1.5;

  // Modèles du mobilier.
  kit.model("bench-sas", stoneBench, { seed: seed + 21, model: "sas" });
  kit.model("bench-gallery", stoneBench, { seed: seed + 22, model: "gallery" });
  kit.model("bench-maint", stoneBench, { seed: seed + 23, model: "maintenance" });
  kit.model("locker", equipmentLocker, { seed: seed + 24, model: "locker" }, { cut: HIDE_ON_WALL });
  kit.model("fuse", equipmentLocker, { seed: seed + 26, model: "fuse-box" }, { cut: HIDE_ON_WALL });
  kit.model("desk-check", leverDesk, { seed: seed + 27, model: "check" });
  kit.model("desk-guard", leverDesk, { seed: seed + 28, model: "guard", lights: 3 });
  kit.model("desk-reader", leverDesk, { seed: seed + 29, model: "reader", cassette: "empty" });
  kit.model("desk-reader-on", leverDesk, { seed: seed + 30, model: "reader", cassette: "loaded" });
  kit.model("grate-wall", ventGrate, { seed: seed + 31, model: "wall", height: 0.5, light: "standby" }, { cut: HIDE_ON_WALL });
  kit.model("plaque", glyphPlaque, { seed: seed + 32, model: "inscription", height: 1.9 }, { cut: HIDE_ON_WALL });
  kit.model("plaque-archives", glyphPlaque, { seed: seed + 33, model: "direction", room: 1, arrow: "none", height: 2.0 }, { cut: HIDE_ON_WALL });
  kit.model("warning", glyphPlaque, { seed: seed + 34, model: "warning", height: 1.6 }, { cut: HIDE_ON_WALL });
  kit.model("pipe", copperPipe, { seed: seed + 35, piece: "straight", height: 3.4 }, { cut: HIDE_ON_WALL });
  kit.model("pipe-low", copperPipe, { seed: seed + 36, piece: "straight", height: 0.5 }, { cut: HIDE_ON_WALL });
  kit.model("valve", wheelValve, { seed: seed + 37, height: 1.2 }, { cut: HIDE_ON_WALL });
  kit.model("pipe-giant", copperPipe, { seed: seed + 38, piece: "straight", size: "giant", mount: "floor", height: 0.9 });
  kit.model("valve-giant", wheelValve, { seed: seed + 39, size: "giant" });
  kit.model("cables", braidedCable, { seed: seed + 40, layout: "bundle", gauge: "study", length: 3 });
  kit.model("cable-floor", braidedCable, { seed: seed + 41, layout: "floor", gauge: "main", length: 4 });
  kit.model("trunk-open", travelTrunk, { seed: seed + 42, state: "open", content: "cassettes" });
  kit.model("trunk-closed", travelTrunk, { seed: seed + 43, state: "closed", size: "large" });
  kit.model("hand-lamp", handLamp, { seed: seed + 44, pose: "lying", state: "lit" });
  const railings = {
    "posts-chain": kit.model("posts-chain", bronzeRailing, { seed: seed + 45, kind: "chain", segments: 2, span: 1.1 }),
    barrier: kit.model("barrier", bronzeRailing, { seed: seed + 46, kind: "barrier", segments: 2, span: 1.25 }),
  };
  // Emprise d'une rambarde : une boîte fine par segment (tracés en ligne, tournés d'un quart de tour au plus).
  const railing = (key, x, z, rotY) => {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    for (const [x1, z1, x2, z2] of railings[key].userData.blocking) {
      const ax = x + x1 * c + z1 * s, az = z - x1 * s + z1 * c;
      const bx = x + x2 * c + z2 * s, bz = z - x2 * s + z2 * c;
      colliders.add((ax + bx) / 2, (az + bz) / 2, Math.abs(bx - ax) / 2 + 0.08, Math.abs(bz - az) / 2 + 0.08);
    }
  };

  if (lots) {
    // Le Sas : deux bancs de part et d'autre de l'entrée, deux casiers à l'est, le pupitre de vérification à l'ouest,
    // l'inscription au-dessus, la grille d'aération basse, le tuyau et sa valve au nord.
    if (has("sas")) {
      const sas = R.sas;
      // Les bancs encadrent la Porte-Iris (son cadre fait 4,5 m de large).
      wallItem("bench-sas", sas, "s", -3.55, 0.3, [2.2, 0.55]);
      wallItem("bench-sas", sas, "s", 3.55, 0.3, [2.2, 0.55]);
      wallItem("locker", sas, "e", 2, 0, [1.8, 0.4, 0.2]);
      wallItem("locker", sas, "e", 4, 0, [1.8, 0.4, 0.2]);
      wallItem("desk-check", sas, "w", 3, 0.3, [1.0, 0.55]);
      wallItem("plaque", sas, "w", 4.6, 0.01);
      wallItem("grate-wall", sas, "w", 1.2, 0);
      for (const t of [-3.5, -1.8]) wallItem("pipe", sas, "n", t, 0);
      wallItem("valve", sas, "n", -2.6, 0);
      wallItem("plaque-archives", sas, "n", 1.4, 0.01);
      put("cables", -2.6, 2.2, 0.4);
      // Lot 4 : une malle ouverte (cassettes) et une fermée près des casiers, la lampe portative posée sur le banc
      // ouest, une ligne de poteaux à chaîne qui mène au pupitre de vérification.
      put("trunk-open", 3.5, 1.1, -HALF_PI + 0.15, [0.8, 0.5]);
      put("trunk-closed", 3.55, 2.3, -HALF_PI - 0.1, [0.8, 0.5]);
      put("hand-lamp", -3.2, 5.35, 0.5, null, 0.45);
      lightSources.push({ position: new THREE.Vector3(-3.0, 0.7, 5.0), color: AMBER, radius: 1.6, strength: 0.5 });
      put("posts-chain", -1.7, 3.5, HALF_PI);
      railing("posts-chain", -1.7, 3.5, HALF_PI);
      counts.furniture += 4;
    }
    // Les Archives : colonnade de 2 × 3 colonnes, pupitres de lecture contre le mur nord, poste de garde près du Sas,
    // casiers à l'ouest (en attendant les meubles à tiroirs), bancs entre les colonnes.
    if (has("archives")) {
      const a = R.archives;
      kit.model("column", glyphColumn, { seed: seed + 50, shape: "fluted", height: a.h, diameter: 0.9 }, { cut: VIEW_CUT });
      for (const x of [-4, 4]) for (const z of [-3, -6.5, -10]) put("column", x, z, 0, [0.9, 0.9]);
      for (const t of [-2.5, 0, 2.5]) wallItem(t === 0 ? "desk-reader-on" : "desk-reader", a, "n", t, 0.35, [0.8, 0.5]);
      wallItem("plaque", a, "n", 0, 0.01);
      wallItem("desk-guard", a, "s", 3, 0.35, [1.0, 0.55]);
      for (const t of [-2.5, -5, -7.5, -10]) wallItem("locker", a, "w", t, 0, [1.8, 0.4, 0.2]);
      put("bench-gallery", 0, -4.8, 0, [1.2, 0.4]);
      put("bench-gallery", 0, -8.2, Math.PI, [1.2, 0.4]);
      counts.furniture += 8;
      wallItem("grate-wall", a, "e", -1.2, 0);
      if (many) {
        put("bench-gallery", -6.5, -6.5, HALF_PI, [1.2, 0.4]);
        put("bench-gallery", 6.5, -6.5, -HALF_PI, [1.2, 0.4]);
        put("cables", -1.5, -10.4, 0.1);
        counts.furniture += 3;
      }
    }
    // L'Atelier : tranchée de service éclairée au milieu, tuyaux géants et valve à l'est, armoires à fusibles au sud,
    // bancs de maintenance, pupitres, câbles au sol.
    if (has("atelier")) {
      const w = R.atelier;
      for (const z of [-7.5, -2.5]) put("pipe-giant", 19.6, z, HALF_PI, [0.9, 2.0]);
      put("valve-giant", 19.4, -5, 0, [1.0, 0.8]);
      wallItem("fuse", w, "s", 11, 0, [0.8, 0.3, 0.15]);
      wallItem("fuse", w, "s", 12.2, 0, [0.8, 0.3, 0.15]);
      wallItem("warning", w, "s", 13.4, 0.01);
      put("barrier", 11.6, -1.25, 0);
      railing("barrier", 11.6, -1.25, 0);
      wallItem("bench-maint", w, "n", 11.5, 0.35, [1.2, 0.6]);
      wallItem("desk-check", w, "w", -8, 0.3, [1.0, 0.55]);
      wallItem("locker", w, "s", 17.5, 0, [1.8, 0.4, 0.2]);
      put("cable-floor", 15, -7.3, 0);
      put("cables", 14, -2.6, 0.2);
      for (const t of [-8.5, -6.5]) wallItem("pipe-low", w, "e", t, 0);
      counts.furniture += 3;
      if (many) {
        put("bench-maint", 15, -3, 0, [1.2, 0.6]);
        put("desk-guard", 11, -6.5, HALF_PI, [1.0, 0.55]);
        counts.furniture += 2;
      }
    }
    // La Galerie : bancs le long des murs entre les portes, plaques de direction près des portes d'étude.
    if (has("gallery")) {
      const g = R.gallery;
      for (const [side, t] of [["w", -20], ["e", -14], ["e", -23]]) wallItem("bench-gallery", g, side, t, 0.25, [1.2, 0.4]);
      for (const [side, t, n] of [["w", -13.2, 1], ["w", -23.2, 2], ["e", -17.2, 4], ["e", -25.2, 5]]) {
        const key = `plaque-room-${n}`;
        kit.model(key, glyphPlaque, { seed: seed + 60 + n, model: "direction", room: n, arrow: side === "w" ? "left" : "right", height: 1.7 }, { cut: HIDE_ON_WALL });
        wallItem(key, g, side, t, 0.01);
      }
      if (many) wallItem("bench-gallery", g, "w", -28, 0.25, [1.2, 0.4]);
    }
  }

  // --- Lampes ----------------------------------------------------------------------------------------------------
  const lampOn = lamps >= 0.5;
  const lampMany = lamps >= 1.5;
  const lampModel = (key, asset, params, cut) => {
    const prototype = kit.model(key, asset, params, { cut });
    return prototype.userData.lightPoint ?? new THREE.Vector3(0, 2.5, 0);
  };
  const _v = new THREE.Vector3();
  const hooks = new Set(); // cases de voûte où pend une lampe (crochet)
  const lamp = (key, point, x, z, turn, radius) => {
    put(key, x, z, turn);
    if (key !== "lamp-wall") hooks.add(`${x},${z}`);
    _v.copy(point).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    // Suspendue : la source est posée un peu sous l'ampoule, pour que la flaque de lumière tombe sur le sol.
    if (key !== "lamp-wall") _v.y -= 0.8;
    lightSources.push({ position: new THREE.Vector3(x + _v.x, _v.y, z + _v.z), color: AMBER, radius, strength: 0.62 });
    counts.lamps += 1;
  };
  if (lampOn) {
    // Suspendues : la chaîne monte jusqu'au crochet de la voûte (plafond à 5 m au Sas, 6 m ailleurs).
    const hanging = lampModel("lamp-hanging", filamentLamp, { seed: seed + 70, height: 3, chain: 1.5 }, VIEW_HIDE);
    const hangingHigh = lampModel("lamp-high", filamentLamp, { seed: seed + 71, height: 3.4, chain: 2.1 }, VIEW_HIDE);
    const sconce = lampModel("lamp-wall", filamentLamp, { seed: seed + 72, mount: "wall", height: 2.6 }, HIDE_ON_WALL);
    const chandelier = lampModel("chandelier", filamentChandelier, { seed: seed + 74, model: "lantern", height: 3.6, chain: 1.6 }, VIEW_HIDE);
    const wall = (room, side, t, dim = false) => {
      const [x, z, turn] = onWall(room, side, t, 0);
      lamp("lamp-wall", sconce, x, z, turn, dim ? 2.8 : 3.6); // une applique faible n'éclaire que de près
    };
    if (has("sas")) {
      lamp("lamp-hanging", hanging, -2, 3, 0, 4.4);
      lamp("lamp-hanging", hanging, 2, 3, 0, 4.4);
      if (lampMany) wall(R.sas, "w", 1.9);
    }
    if (has("archives")) {
      lamp("chandelier", chandelier, 0, -7, 0, 5.4);
      for (const z of [-3, -11]) lamp("lamp-high", hangingHigh, 0, z, 0, 4.7);
      wall(R.archives, "e", -8, rng.chance(0.4));
      wall(R.archives, "w", -1.2);
      if (lampMany) for (const z of [-4.5, -8.5]) wall(R.archives, "e", z);
    }
    if (has("atelier")) {
      for (const [x, z] of [[12, -3], [16, -7], [12, -9]]) lamp("lamp-high", hangingHigh, x, z, 0, 4.7);
      wall(R.atelier, "n", 18, true);
      if (lampMany) lamp("lamp-high", hangingHigh, 18, -3, 0, 4.7);
    }
    if (has("gallery")) {
      for (const [side, t] of [["w", -11.5], ["e", -12.5], ["w", -17.5], ["e", -21], ["w", -21.5], ["e", -29], ["w", -28.5]]) {
        wall(R.gallery, side, t, rng.chance(0.3));
      }
    }
  }

  kit.build();
  group.add(kit.group);

  // --- Plafond : voûtes à caissons de 2 × 2 m sur chaque case, à la hauteur de la pièce. Vu seulement à la 3e
  // personne (en vue isométrique, la maquette est ouverte) ; il ne projette pas d'ombre (la lumière de service
  // vient d'en haut).
  const ceiling = new InteriorKit();
  ceiling.model("vault", cofferedVault, { seed: seed + 80, display: "ceiling", hook: "none" }, { castShadow: false });
  ceiling.model("vault-hook", cofferedVault, { seed: seed + 81, display: "ceiling", hook: "hook" }, { castShadow: false });
  for (const room of rooms) {
    for (let x = room.x0 + 1; x < room.x1; x += 2) {
      for (let z = room.z0 + 1; z < room.z1; z += 2) ceiling.place(hooks.has(`${x},${z}`) ? "vault-hook" : "vault", x, z, 0, room.h);
    }
  }
  ceiling.build();
  ceiling.group.visible = false;
  group.add(ceiling.group);

  // --- Lumière : une lumière de service venue d'en haut (les ombres restent courtes), et les halos des lampes ------
  let daylight = null;
  let halos = null;
  if (!diorama) {
    daylight = createDaylight({ azimuth: THREE.MathUtils.degToRad(160), elevation: THREE.MathUtils.degToRad(62) });
    daylight.setSun(THREE.MathUtils.degToRad(160), THREE.MathUtils.degToRad(62));
    group.add(daylight.light, daylight.light.target);
    if (lightSources.length) halos = createHaloPool(lightSources);
  }

  const first = rooms[0];
  const spawn = new THREE.Vector3((first.x0 + first.x1) / 2, 0, (first.z0 + first.z1) / 2 + (first.id === "sas" ? 0.5 : 0));
  let time = 0;
  const _focus = new THREE.Vector3();
  const route = [];
  // Liaisons entre pièces : les portes qui s'ouvrent, avec un point de passage de chaque côté (1,3 m de la baie).
  const links = doors.filter((d) => d.auto).map((d) => {
    const axisX = Math.abs(Math.sin(d.object.rotation.y)) < 0.5; // le mur suit x
    const [ax, az] = axisX ? [d.x, d.z - 1.3] : [d.x - 1.3, d.z];
    const [bx, bz] = axisX ? [d.x, d.z + 1.3] : [d.x + 1.3, d.z];
    return { a: roomAt(ax, az).id, b: roomAt(bx, bz).id, side: { a: [ax, az], b: [bx, bz] } };
  });

  return {
    group,
    seed,
    size,
    meters: COMPLEX_TEST_SIZES[size]?.meters ?? 36,
    bounds,
    center: new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2),
    spawn,
    counts,
    rooms,
    interior: true,
    heightAt: () => 0,
    /** Face au nord au départ : la porte des Archives, pas l'entrée fermée. */
    spawnHeading: Math.PI,

    /** Hauteur du plafond (la caméra à la 3e personne reste dessous). */
    ceilingAt(x, z) {
      return roomAt(x, z)?.h ?? Infinity;
    },

    /** Vue à la 3e personne : le plafond se ferme au-dessus de la tête. */
    setThirdPerson(value) {
      ceiling.group.visible = value;
    },

    /** Murs, piliers, meubles, portes fermées ; et on ne sort pas des pièces. */
    collide(position, radius) {
      colliders.collide(position, radius);
      if (!roomAt(position.x, position.z)) {
        // Hors des pièces (par une porte d'entrée ouverte...) : ramené dans la plus proche.
        let best = null, bestDistance = Infinity;
        for (const room of rooms) {
          const x = THREE.MathUtils.clamp(position.x, room.x0 + 0.35, room.x1 - 0.35);
          const z = THREE.MathUtils.clamp(position.z, room.z0 + 0.35, room.z1 - 0.35);
          const d = Math.hypot(x - position.x, z - position.z);
          if (d < bestDistance) [best, bestDistance] = [[x, z], d];
        }
        position.x = best[0];
        position.z = best[1];
      }
    },

    /**
     * Balade automatique : un but au hasard dans une pièce, atteint en passant par les portes (les étapes de
     * passage ont `pass: true`, sans halte). Appelé à chaque but atteint, ou quand le promeneur est bloqué.
     */
    strollTarget(random, from) {
      if (route.length) return route.shift();
      const here = (from && roomAt(from.x, from.z)) ?? rooms[0];
      const destination = rooms[Math.floor(random() * rooms.length)];
      // Chemin de pièce en pièce (parcours en largeur sur les portes qui s'ouvrent).
      const previous = new Map([[here.id, null]]);
      const queue = [here.id];
      while (queue.length) {
        const id = queue.shift();
        for (const link of links) {
          const next = link.a === id ? link.b : link.b === id ? link.a : null;
          if (next && !previous.has(next)) {
            previous.set(next, { id, link });
            queue.push(next);
          }
        }
      }
      const steps = [];
      for (let id = destination.id; previous.get(id); id = previous.get(id).id) steps.unshift({ ...previous.get(id), to: id });
      for (const { link, to } of steps) {
        const [inX, inZ] = link.side[link.a === to ? "b" : "a"];
        const [outX, outZ] = link.side[to === link.a ? "a" : "b"];
        route.push({ x: inX, z: inZ, pass: true }, { x: outX, z: outZ, pass: true });
      }
      const target = previous.has(destination.id) ? destination : here;
      for (let k = 0; k < 20; k++) {
        const x = THREE.MathUtils.lerp(target.x0 + 1.2, target.x1 - 1.2, random());
        const z = THREE.MathUtils.lerp(target.z0 + 1.2, target.z1 - 1.2, random());
        if (!colliders.blocked(x, z, 0.6)) {
          route.push({ x, z });
          break;
        }
      }
      return route.shift() ?? { x: spawn.x, z: spawn.z };
    },

    setMood() {},

    update({ camera, target, dt, viewRadius, shadows }) {
      time += dt;
      for (const d of doors) {
        if (!d.auto && !d.show) continue;
        const distance = Math.hypot(target.x - d.x, target.z - d.z);
        if (distance < 2.4 && d.door.openness < 0.99 && !d.opening) {
          d.door.open();
          d.opening = true;
        } else if (distance > 3.6 && d.opening) {
          d.door.close();
          d.opening = false;
        }
      }
      // Les lampes allumées sont celles près du point regardé : devant la caméra en 3e personne.
      if (halos) {
        if (ceiling.group.visible && camera) {
          camera.getWorldDirection(_focus);
          _focus.y = 0;
          _focus.normalize().multiplyScalar(6).add(target);
        } else {
          _focus.copy(target);
        }
        halos.update(_focus, time, camera);
      }
      if (shadows && daylight) daylight.update(target, Math.min(viewRadius + 6, 40));
    },

    stats() {
      return { ...kit.stats(), fraction: 1 };
    },

    dispose() {
      halos?.dispose();
      daylight?.dispose();
      kit.dispose();
      ceiling.dispose();
      for (const d of doors) {
        d.object.traverse((child) => {
          child.geometry?.dispose();
          child.material?.dispose?.();
        });
      }
      group.clear();
    },
  };
}
