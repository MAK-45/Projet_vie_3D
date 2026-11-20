// Le Complexe (docs/complexe/) : le monde intérieur assemblé pièce par pièce, au fil des lots. Lot 5 : le Sas de
// Scellement, fidèle à la bible (docs/complexe/PIECES.md, pièce 1), et le vestibule d'où l'on arrive. Lot 8 : les
// Archives au nord du Sas (pièce 2, construite par `ancient-complex-archives.js`), avec leur mezzanine praticable.
//
// Une pièce à la fois : les Archives ne se montrent que quand on y est, ou près de la porte nord ouverte (et le Sas
// de même vu des Archives) ; derrière un mur, le noir.
//
// - Le vestibule (6 × 4 m, 4 m sous plafond) : un bout de galerie de basalte aux glyphes éteints, une lampe portative
//   laissée allumée. On y part, face à la Porte-Iris.
// - Le Sas (10 × 6 × 5 m) : la Porte-Iris au centre du mur sud, la porte standard au centre du mur nord (vers les
//   Archives), quatre piliers d'angle, le bandeau de glyphes à 1,10 m.
//   Sol en dalles de 2 m dont les diagonales forment des chevrons pointés vers la porte nord ; une allée usée de
//   l'Iris à la porte. Pupitre de vérification contre le mur ouest (plaque gravée au-dessus), deux casiers à l'est
//   sous le tuyau, deux bancs de part et d'autre de la porte nord, deux malles dans les coins sud, une file
//   d'attente de poteaux à chaîne qui mène de l'Iris vers le pupitre.
//
// États (réglage `state`) :
// - endormi : glyphes et rainures éteints, une lampe sur deux ;
// - éveillé : tout allumé ;
// - vérification : comme endormi au départ. L'Iris s'ouvre à l'approche puis se referme derrière soi et reste scellée.
//   Devant le pupitre, les leviers basculent un à un, puis la lueur part du pupitre en vague : glyphes des murs,
//   rainures du sol, lampes qui s'allument au passage, jusqu'à la porte nord qui se déverrouille. Revenir au vestibule
//   rendort le Sas (on peut rejouer la scène). La balade automatique joue ce parcours.
//
// Praticable : sol à étages (`heightAt(x, z, y)` : le seuil de l'Iris est une marche de 0,20 m ; l'escalier à vis et la
// mezzanine des Archives), obstacles en boîtes, portes qui s'ouvrent à l'approche (celle de l'Atelier reste fermée :
// il n'existe pas encore) ; on ne sort pas des pièces.
//
// 1 unité = 1 mètre ; sol en y = 0 (dessus des dalles) ; x vers l'est, z vers le sud ; grille de 2 m (murs sur les x
// impairs et les z pairs, dalles au centre des cases).

import * as THREE from "three";
import { enableCutaway, enableReveal, rgb } from "../engine/toon-material.js";
import { GLOWS, STONES } from "../assets/kit/palettes.js";
import { createRng } from "../assets/kit/rng.js";
import * as bronzeRailing from "../assets/buildings/structure/bronze-railing.js";
import * as cofferedVault from "../assets/buildings/structure/coffered-vault.js";
import * as complexDoor from "../assets/buildings/structure/complex-door.js";
import * as glyphColumn from "../assets/buildings/structure/glyph-column.js";
import * as glyphFloorSlab from "../assets/buildings/structure/glyph-floor-slab.js";
import * as glyphWall from "../assets/buildings/structure/glyph-wall.js";
import * as irisDoor from "../assets/buildings/structure/iris-door.js";
import * as ventGrate from "../assets/buildings/structure/vent-grate.js";
import * as filamentLamp from "../assets/furniture/lighting/filament-lamp.js";
import * as stoneBench from "../assets/furniture/seating/stone-bench.js";
import * as equipmentLocker from "../assets/furniture/storage/equipment-locker.js";
import * as travelTrunk from "../assets/furniture/storage/travel-trunk.js";
import * as glyphPlaque from "../assets/props/decor/glyph-plaque.js";
import * as braidedCable from "../assets/props/machines/braided-cable.js";
import * as copperPipe from "../assets/props/machines/copper-pipe.js";
import * as leverDesk from "../assets/props/machines/lever-desk.js";
import * as wheelValve from "../assets/props/machines/wheel-valve.js";
import * as handLamp from "../assets/props/tools/hand-lamp.js";
import { createLampDust } from "../fx/lamp-dust.js";
import { createDaylight } from "./kit/sky.js";
import { BoxColliders, createHaloPool, InteriorKit, WalkSurfaces } from "./kit/interior.js";
import { ARCHIVES, buildArchives } from "./ancient-complex-archives.js";

/** Pièces que le réglage `room` sait montrer (les suivantes s'ajoutent au fil des lots). */
export const COMPLEX_ROOMS = {
  sas: { label: "Le Sas", meters: 10 },
  archives: { label: "Les Archives", meters: 18 },
};

/** États du Sas. */
export const SAS_STATES = {
  check: { label: "Vérification" },
  awake: { label: "Éveillé" },
  asleep: { label: "Endormi" },
};

/** Pièces : emprise aux axes des murs (m), hauteur sous plafond. */
const ROOMS = {
  sas: { name: "Sas de Scellement", x0: -5, x1: 5, z0: 0, z1: 6, h: 5 },
  vestibule: { name: "Vestibule", x0: -3, x1: 3, z0: 6, z1: 10, h: 4 },
  archives: ARCHIVES,
};

// Vue en coupe : les murs, portes et piliers d'angle entre le promeneur et la caméra sont masqués en entier (un mur
// coupé à mi-hauteur laissait un moignon disgracieux en vue isométrique).
const WALL_CUT = { rule: "wall", height: -1 };
const HIDE_ON_WALL = { rule: "wall", height: -1 };
const CORNER_CUT = { rule: "corner", height: -1 };
const VIEW_HIDE = { rule: "view", height: -1 };
const AMBER = GLOWS.amber.light;
const HALF_PI = Math.PI / 2;
const STEP_UP = 0.4; // plus haute marche qu'on monte en marchant (m)

// La vérification : place de l'opérateur devant le pupitre, vitesse de la vague, portée.
const DESK = { x: -4.4, z: 3 };
const OPERATOR = { x: -3.45, z: 3, radius: 1.0 };
const LEVER_STEP = 0.22; // s entre deux leviers
const WAVE_SPEED = 3.4; // m/s
const WAVE_REACH = 13; // m : tout le Sas est allumé

/**
 * Crée le Complexe.
 * @param {object} [options]
 * @param {number} [options.seed] usure et variantes des dalles, niche du mur ouest, leviers, lampe éteinte, malles
 * @param {"sas"|"archives"} [options.room] pièce où l'on commence (le Sas : dans le vestibule ; les Archives : à la
 *   porte du Sas, la vérification déjà faite)
 * @param {"check"|"awake"|"asleep"} [options.state] état du Sas
 * @param {boolean} [options.diorama] sans lumière (fiche et vignette de l'asset)
 */
export function createAncientComplex({ seed = 1, room = "sas", state = "check", diorama = false } = {}) {
  seed = THREE.MathUtils.clamp(Math.round(seed) || 0, 0, 9999);
  if (!(room in COMPLEX_ROOMS)) room = "sas";
  if (!(state in SAS_STATES)) state = "check";
  const rng = createRng(seed * 7919 + 501);
  const rooms = ["sas", "vestibule"].map((id) => ({ id, ...ROOMS[id] }));
  const allRooms = [...rooms, { id: "archives", ...ROOMS.archives }];
  const R = Object.fromEntries(allRooms.map((r) => [r.id, r]));
  const kit = new InteriorKit();
  const colliders = new BoxColliders();
  const walk = new WalkSurfaces({ stepUp: STEP_UP });
  const group = new THREE.Group();
  group.name = "Le Complexe";
  const counts = { rooms: allRooms.length, slabs: 0, walls: 0, doors: 0, furniture: 0, lamps: 0 };
  const sources = []; // lampes : halo et poussière
  const objects = []; // objets posés seuls (portes, pupitre) : à libérer

  // La vague de la vérification : une sphère centrée sur le pupitre (rayon 0 : tout éteint).
  const reveal = { value: new THREE.Vector4(DESK.x, 1.1, DESK.z, state === "awake" ? WAVE_REACH : 0) };
  const GLYPH_OFF = GLOWS.amber.ramp[0];
  const GROOVE_OFF = STONES.blackBasalt.ink;
  const GROOVE_ON = "#7c3a16";

  const roomAt = (x, z) => allRooms.find((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  const bounds = { minX: -6, maxX: 16, minZ: -13, maxZ: 11 };

  // Pose d'une copie avec, en option, une emprise au sol : largeur × profondeur dans le repère de l'objet, décalée
  // de `oz` vers son +z (meubles muraux : l'origine est au mur).
  const put = (key, x, z, rotY = 0, box = null, y = 0) => {
    const index = kit.place(key, x, z, rotY, y);
    if (box) addBox(x, z, rotY, box);
    return index;
  };
  const addBox = (x, z, rotY, [w, d, oz = 0]) => {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const swap = Math.abs(s) > 0.5;
    colliders.add(x + s * oz, z + c * oz, (swap ? d : w) / 2, (swap ? w : d) / 2);
  };
  // Pose contre un mur : `side` n, s, e, w ; `t` coordonnée le long du mur ; `inset` distance au nu du mur.
  const onWall = (r, side, t, inset = 0) => {
    const face = 0.3 + inset;
    if (side === "n") return [t, r.z0 + face, 0];
    if (side === "s") return [t, r.z1 - face, Math.PI];
    if (side === "w") return [r.x0 + face, t, HALF_PI];
    return [r.x1 - face, t, -HALF_PI];
  };
  const wallItem = (key, r, side, t, inset, box = null) => {
    const [x, z, turn] = onWall(r, side, t, inset);
    counts.furniture += 1;
    return put(key, x, z, turn, box);
  };

  // --- Sols ------------------------------------------------------------------------------------------------------
  // Le Sas : rainures ambre (éteintes jusqu'à la vague), diagonales tournées pour pointer vers la porte nord (0, 0) :
  // des chevrons. L'allée du milieu est usée. Le vestibule : rainures sombres, dalles usées et fissurées.
  const SLAB = { castShadow: false };
  const grooveReveal = { mesh: "groove", uniform: reveal, off: GROOVE_OFF };
  kit.model("slab", glyphFloorSlab, { variant: "intact", groove: "amber", seed: seed + 1 }, { ...SLAB, reveal: grooveReveal });
  kit.model("slab-worn", glyphFloorSlab, { variant: "worn", groove: "amber", seed: seed + 2 }, { ...SLAB, reveal: grooveReveal });
  kit.model("slab-cracked", glyphFloorSlab, { variant: "cracked", groove: "amber", seed: seed + 3 }, { ...SLAB, reveal: grooveReveal });
  kit.model("slab-trapdoor", glyphFloorSlab, { variant: "trapdoor", groove: "amber", seed: seed + 4 }, { ...SLAB, reveal: grooveReveal });
  // Allumées, les rainures restent à peine plus claires que la pierre (« émissive très faible », bible SAS-01) : un
  // ton d'ambre sourd, sinon le sol entier devient un quadrillage orange.
  for (const key of ["slab", "slab-worn", "slab-cracked", "slab-trapdoor"]) {
    kit.models.get(key).prototype.traverse((child) => {
      if (child.isMesh && child.name === "groove") child.material.uniforms.uRamp.value.forEach((c) => c.copy(rgb(GROOVE_ON)));
    });
  }
  kit.model("slab-out", glyphFloorSlab, { variant: "worn", groove: "dark", seed: seed + 5 }, SLAB);
  kit.model("slab-out-cracked", glyphFloorSlab, { variant: "cracked", groove: "dark", seed: seed + 6 }, SLAB);
  // Une trappe et une fissure, hors de l'allée et des meubles, selon la graine.
  const spots = [[-2, 1], [2, 1], [-2, 5], [2, 5], [-4, 3], [4, 1]];
  const trap = spots[rng.int(0, 3)];
  const crack = spots[(spots.indexOf(trap) + 1 + rng.int(0, 3)) % spots.length];
  for (const r of rooms) {
    for (let x = r.x0 + 1; x < r.x1; x += 2) {
      for (let z = r.z0 + 1; z < r.z1; z += 2) {
        const flip = rng.chance(0.5) ? Math.PI : 0; // tirer d'abord, décider ensuite
        const roll = rng.next();
        let key;
        let turn;
        if (r.id === "sas") {
          // Diagonale (1, 1) à 0 ou π, (1, −1) à ±π/2 : celle qui pointe le mieux vers la porte.
          const toward = Math.abs(-x - z) >= Math.abs(-x + z) ? 0 : HALF_PI;
          turn = toward + flip;
          key = x === 0 ? "slab-worn" : trap[0] === x && trap[1] === z ? "slab-trapdoor" : crack[0] === x && crack[1] === z ? "slab-cracked" : "slab";
        } else {
          turn = rng.int(0, 3) * HALF_PI;
          key = roll < 0.35 ? "slab-out-cracked" : "slab-out";
        }
        put(key, x, z, turn, null, -0.2);
        counts.slabs += 1;
      }
    }
  }

  // --- Murs et portes --------------------------------------------------------------------------------------------
  // Chaque bord de pièce est découpé en modules de 2 m ; un module commun à deux pièces n'est posé qu'une fois.
  const pieces = new Map();
  const addEdge = (r, axis, line, from, to, inward) => {
    for (let c = from + 1; c < to; c += 2) {
      const key = `${axis}:${line}:${c}`;
      const piece = pieces.get(key);
      if (piece) piece.shared = true;
      else pieces.set(key, { axis, line, c, inward, room: r, shared: false });
    }
  };
  for (const r of rooms) {
    addEdge(r, "x", r.z0, r.x0, r.x1, +1); // mur nord : la pièce est vers +z
    addEdge(r, "x", r.z1, r.x0, r.x1, -1);
    addEdge(r, "z", r.x0, r.z0, r.z1, +1);
    addEdge(r, "z", r.x1, r.z0, r.z1, -1);
  }
  const wallTurn = (axis, inward) => (axis === "x" ? (inward > 0 ? 0 : Math.PI) : inward > 0 ? HALF_PI : -HALF_PI);
  const wallXZ = (axis, line, c) => (axis === "x" ? [c, line] : [line, c]);
  const cutObject = (object) => {
    object.traverse((child) => {
      if (!child.isMesh || !child.material.uniforms?.uRamp) return;
      enableCutaway(child.material, WALL_CUT.rule, WALL_CUT.height);
      child.customDepthMaterial = child.material.userData.depthMaterial;
    });
  };

  // La Porte-Iris (6 m de mur, face décorée vers le Sas) et la porte nord (glyphes du chambranle dans la vague).
  const doors = [];
  const addDoor = ({ axis, line, at, width, object, role }) => {
    const centers = width === 6 ? [at - 2, at, at + 2] : [at];
    const first = pieces.get(`${axis}:${line}:${centers[0]}`);
    for (const c of centers) pieces.delete(`${axis}:${line}:${c}`);
    const [x, z] = wallXZ(axis, line, at);
    object.position.set(x, 0, z);
    object.rotation.y = wallTurn(axis, first.inward);
    cutObject(object);
    group.add(object);
    objects.push(object);
    const door = object.userData.door;
    const open = door.opening.width;
    // Emprise : les jambages toujours, la baie tant que la porte bloque.
    for (const s of [-1, 1]) colliders.add(x + (s * (width / 2 + open / 2)) / 2, z, (width / 2 - open / 2) / 2, 0.3);
    colliders.add(x, z, open / 2, 0.3, () => door.blocking);
    const entry = { object, door, x, z, role, opening: false };
    doors.push(entry);
    counts.doors += 1;
    return entry;
  };
  const iris = addDoor({
    axis: "x", line: 6, at: 0, width: 6, role: "iris",
    object: irisDoor.create({ seed: seed * 31 + 11, height: R.sas.h, state: "closed" }),
  });
  const northObject = complexDoor.create({ seed: seed * 31 + 12, model: "standard", height: R.sas.h, state: "closed", glyphs: "lit" });
  northObject.traverse((child) => {
    if (child.isMesh && child.name === "glow") enableReveal(child.material, reveal, GLYPH_OFF);
  });
  const north = addDoor({ axis: "x", line: 0, at: 0, width: 2, role: "north", object: northObject });

  // Seuil de l'Iris : une marche de 0,20 m (surface de marche), praticable sur la largeur de l'ouverture.
  const sill = iris.door.opening;
  const surfaces = [{ minX: -sill.width / 2, maxX: sill.width / 2, minZ: 5.66, maxZ: 6.34, top: sill.sill }];

  // Modules de mur : le Sas (5 m, glyphes dans la vague), le vestibule (4 m, glyphes éteints). Une niche au mur
  // ouest, au nord ou au sud du pupitre selon la graine.
  const nicheAt = rng.chance(0.5) ? 1 : 5;
  const wallModel = (h, variant, glyphs) => {
    const key = `wall-${h}-${variant}-${glyphs}`;
    kit.model(key, glyphWall, { seed: seed * 13 + h * 7 + variant.length, variant, height: h, width: 2, glyphs }, {
      cut: WALL_CUT,
      castShadow: true,
      reveal: glyphs === "lit" ? { mesh: "glyphs", uniform: reveal, off: GLYPH_OFF } : null,
    });
    return key;
  };
  for (const piece of pieces.values()) {
    const [x, z] = wallXZ(piece.axis, piece.line, piece.c);
    const sas = piece.room.id === "sas";
    const variant = sas && piece.axis === "z" && piece.line === R.sas.x0 && piece.c === nicheAt ? "niche" : "plain";
    put(wallModel(piece.room.h, variant, sas ? "lit" : "off"), x, z, wallTurn(piece.axis, piece.inward));
    if (piece.axis === "x") colliders.add(x, z, 1, 0.3);
    else colliders.add(x, z, 0.3, 1);
    counts.walls += 1;
  }

  // Piliers d'angle carrés (ils cachent la jonction des murs) ; ceux du vestibule à sa hauteur.
  const corners = new Map();
  for (const r of rooms) {
    for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) {
      const key = `${x},${z}`;
      corners.set(key, Math.max(corners.get(key) ?? 0, r.h));
    }
  }
  for (const [key, h] of corners) {
    const [x, z] = key.split(",").map(Number);
    const model = `pillar-${h}`;
    kit.model(model, glyphColumn, { seed: seed + h, shape: "square", height: h, diameter: 0.9 }, { cut: CORNER_CUT, castShadow: true });
    put(model, x, z, 0, [0.9, 0.9]);
  }

  // --- Mobilier du Sas ---------------------------------------------------------------------------------------------
  const sas = R.sas;
  kit.model("bench", stoneBench, { seed: seed + 21, model: "sas" });
  kit.model("locker", equipmentLocker, { seed: seed + 24, model: "locker" }, { cut: HIDE_ON_WALL });
  kit.model("grate", ventGrate, { seed: seed + 31, model: "wall", height: 0.5, light: "standby" }, { cut: HIDE_ON_WALL });
  kit.model("plaque", glyphPlaque, { seed: seed + 32, model: "inscription", height: 2.15 }, { cut: HIDE_ON_WALL });
  kit.model("plaque-archives", glyphPlaque, { seed: seed + 33, model: "direction", room: 1, arrow: "none", height: 2.05 }, { cut: HIDE_ON_WALL });
  kit.model("pipe", copperPipe, { seed: seed + 35, piece: "straight", height: 3.4 }, { cut: HIDE_ON_WALL });
  kit.model("valve", wheelValve, { seed: seed + 37, height: 1.3 }, { cut: HIDE_ON_WALL });
  kit.model("cable", braidedCable, { seed: seed + 40, layout: "floor", gauge: "study", length: 2 });
  kit.model("trunk-open", travelTrunk, { seed: seed + 42, state: "open", content: rng.chance(0.6) ? "cassettes" : "tools" });
  kit.model("trunk-closed", travelTrunk, { seed: seed + 43, state: "closed", size: "large" });
  kit.model("hand-lamp", handLamp, { seed: seed + 44, pose: "standing", state: "lit" });
  const posts = kit.model("posts", bronzeRailing, { seed: seed + 45, kind: "chain", segments: 2, span: 1.1 });
  // Emprise d'une rambarde : une boîte fine par segment (tracés tournés d'un quart de tour au plus).
  const railing = (x, z, rotY) => {
    put("posts", x, z, rotY);
    const c = Math.cos(rotY), s = Math.sin(rotY);
    for (const [x1, z1, x2, z2] of posts.userData.blocking) {
      const ax = x + x1 * c + z1 * s, az = z - x1 * s + z1 * c;
      const bx = x + x2 * c + z2 * s, bz = z - x2 * s + z2 * c;
      colliders.add((ax + bx) / 2, (az + bz) / 2, Math.abs(bx - ax) / 2 + 0.08, Math.abs(bz - az) / 2 + 0.08);
    }
    counts.furniture += 1;
  };

  // Ouest : le pupitre (posé seul : ses leviers bougent), la plaque gravée au-dessus, la grille basse sous la niche
  // opposée, un câble au sol qui longe le mur.
  const deskObject = leverDesk.create({ seed: seed + 27, model: "check" });
  deskObject.position.set(DESK.x, 0, DESK.z);
  deskObject.rotation.y = HALF_PI;
  group.add(deskObject);
  objects.push(deskObject);
  addBox(DESK.x, DESK.z, HALF_PI, [1.0, 0.55]);
  counts.furniture += 1;
  const desk = deskObject.userData.desk;
  const restLevers = desk.levers.slice();
  wallItem("plaque", sas, "w", 3, 0.01);
  wallItem("grate", sas, "w", nicheAt === 1 ? 5 : 1, 0);
  put("cable", sas.x0 + 0.5, nicheAt === 1 ? 1.3 : 4.7, HALF_PI);
  // Est : deux casiers sous le tuyau ; nord : les bancs de part et d'autre de la porte, la plaque des Archives, la
  // valve près de l'angle et le tuyau qui en part.
  for (const t of [2, 4]) wallItem("locker", sas, "e", t, 0, [1.8, 0.4, 0.2]);
  for (const t of [2, 4]) wallItem("pipe", sas, "e", t, 0);
  wallItem("pipe", sas, "n", 3, 0);
  wallItem("valve", sas, "n", 4.1, 0, [0.4, 0.3, 0.15]);
  for (const t of [-2.6, 2.6]) wallItem("bench", sas, "n", t, 0.3, [2.2, 0.55]);
  wallItem("plaque-archives", sas, "n", 1.45, 0.01);
  // Sud : les malles dans les coins, de part et d'autre de l'Iris.
  put("trunk-open", -3.8, 5.15, Math.PI - 0.12, [0.8, 0.5]);
  put("trunk-closed", 3.75, 5.2, Math.PI + 0.08, [0.95, 0.6]);
  counts.furniture += 2;
  // La file d'attente : deux lignes de poteaux qui mènent de l'Iris vers le milieu du Sas, puis le pupitre.
  railing(-1.6, 4.15, HALF_PI);
  railing(1.6, 4.15, HALF_PI);
  // Vestibule : la lampe portative, laissée allumée près de l'Iris.
  put("hand-lamp", 1.85, 7.0, -0.6);
  sources.push({ position: new THREE.Vector3(1.85, 0.55, 7.0), color: AMBER, radius: 2.6, strength: 0.75, dust: 6 });
  counts.furniture += 1;

  // --- Lampes ------------------------------------------------------------------------------------------------------
  // Chaque lampe est posée deux fois, allumée et éteinte : une seule des deux copies se voit (elle s'allume au
  // passage de la vague). Deux suspendues au milieu du Sas, une applique au-dessus des casiers, une à l'ouest.
  const lampModels = {
    hanging: { asset: filamentLamp, params: { height: 3, chain: 1.5 }, cut: VIEW_HIDE, radius: 4.4, drop: 0.8 },
    wall: { asset: filamentLamp, params: { mount: "wall", height: 2.6 }, cut: HIDE_ON_WALL, radius: 3.6, drop: 0 },
  };
  const lamps = [];
  const hooks = new Set();
  const _v = new THREE.Vector3();
  const lamp = (kind, x, z, turn, lit) => {
    const spec = lampModels[kind];
    const onKey = `lamp-${kind}-on`;
    const offKey = `lamp-${kind}-off`;
    const proto = kit.model(onKey, spec.asset, { seed: seed + 70, ...spec.params, state: "lit" }, { cut: spec.cut });
    kit.model(offKey, spec.asset, { seed: seed + 70, ...spec.params, state: "off" }, { cut: spec.cut });
    const on = kit.place(onKey, x, z, turn);
    const off = kit.place(offKey, x, z, turn);
    if (kind === "hanging") hooks.add(`${x},${z}`);
    _v.copy(proto.userData.lightPoint ?? new THREE.Vector3(0, 2.5, 0)).applyAxisAngle(new THREE.Vector3(0, 1, 0), turn);
    // Suspendue : la source est un peu sous l'ampoule, pour que la flaque de lumière tombe sur le sol.
    const source = { position: new THREE.Vector3(x + _v.x, _v.y - spec.drop, z + _v.z), color: AMBER, radius: spec.radius, strength: 0.62, on: lit };
    sources.push(source);
    lamps.push({ onKey, offKey, on, off, source, rest: lit, distance: source.position.distanceTo(_v.set(reveal.value.x, reveal.value.y, reveal.value.z)) });
    counts.lamps += 1;
  };
  // Endormi : une des deux suspendues (selon la graine) reste allumée.
  const keep = rng.chance(0.5) ? -2 : 2;
  const awake = state === "awake";
  lamp("hanging", -2, 3, 0, awake || keep === -2);
  lamp("hanging", 2, 3, 0, awake || keep === 2);
  {
    const [x, z, turn] = onWall(sas, "e", 3, 0);
    lamp("wall", x, z, turn, awake);
  }
  {
    const [x, z, turn] = onWall(sas, "w", nicheAt === 1 ? 4.8 : 1.2, 0);
    lamp("wall", x, z, turn, awake);
  }

  kit.build();
  group.add(kit.group);
  for (const l of lamps) {
    kit.setVisible(l.onKey, l.on, l.source.on);
    kit.setVisible(l.offKey, l.off, !l.source.on);
  }

  // --- Les Archives (pièce 2), au nord : leur propre jeu de modèles, montré quand on y est. -------------------------
  const archives = buildArchives({ seed, state, colliders, walk, sources, counts, cutObject });
  group.add(archives.group);

  // --- Plafond : voûtes à caissons sur chaque case, vues seulement à la 3e personne, sans ombre portée. ---------------
  const makeCeiling = (list, hookSet, key) => {
    const ceilingKit = new InteriorKit();
    ceilingKit.model("vault", cofferedVault, { seed: seed + 80 + key, display: "ceiling", hook: "none" }, { castShadow: false });
    ceilingKit.model("vault-hook", cofferedVault, { seed: seed + 81 + key, display: "ceiling", hook: "hook" }, { castShadow: false });
    for (const r of list) {
      for (let x = r.x0 + 1; x < r.x1; x += 2) {
        for (let z = r.z0 + 1; z < r.z1; z += 2) ceilingKit.place(hookSet.has(`${x},${z}`) ? "vault-hook" : "vault", x, z, 0, r.h);
      }
    }
    ceilingKit.build();
    ceilingKit.group.visible = false;
    group.add(ceilingKit.group);
    return ceilingKit;
  };
  const ceiling = makeCeiling(rooms, hooks, 0);
  const archivesCeiling = makeCeiling([R.archives], archives.hooks, 10);

  // Une pièce à la fois : ce qui appartient au Sas (et au vestibule), ce qui appartient aux Archives.
  const zones = {
    sas: { parts: [kit.group, deskObject, iris.object], ceiling: ceiling.group, visible: true },
    archives: { parts: [archives.group], ceiling: archivesCeiling.group, visible: true },
  };
  let thirdPerson = false;
  const showZones = (sasOn, archivesOn) => {
    for (const [zone, on] of [[zones.sas, sasOn], [zones.archives, archivesOn]]) {
      zone.visible = on;
      for (const part of zone.parts) part.visible = on;
      zone.ceiling.visible = on && thirdPerson;
    }
  };
  showZones(room !== "archives", room === "archives");
  let southShown = true;

  // --- Lumière : lumière de service venue d'en haut, halos des lampes, poussière dans leur cône ---------------------
  let daylight = null;
  let halos = null;
  let dust = null;
  if (!diorama) {
    daylight = createDaylight({ azimuth: THREE.MathUtils.degToRad(160), elevation: THREE.MathUtils.degToRad(62) });
    daylight.setSun(THREE.MathUtils.degToRad(160), THREE.MathUtils.degToRad(62));
    group.add(daylight.light, daylight.light.target);
    halos = createHaloPool(sources);
    dust = createLampDust(sources, { perLamp: 10, lamps: 5 });
    group.add(dust.mesh);
  }

  // --- Vérification ------------------------------------------------------------------------------------------------
  const checking = state === "check";
  // Départ dans les Archives : la vérification du Sas est déjà faite (on en vient).
  const startRoom = room;
  if (startRoom === "archives" && checking) reveal.value.w = WAVE_REACH;
  const sequence = { phase: checking && startRoom !== "archives" ? "idle" : "done", start: 0, lever: 0, radius: reveal.value.w };
  // Leviers vérifiés : alternés, un sur deux abaissé (l'inverse de la graine là où elle les avait laissés).
  const verifiedLevers = desk.levers.map((_, i) => i % 2 === 0);
  const setLamp = (l, lit) => {
    if (l.source.on === lit) return;
    l.source.on = lit;
    kit.setVisible(l.onKey, l.on, lit);
    kit.setVisible(l.offKey, l.off, !lit);
    halos?.refresh();
    dust?.refresh();
  };
  const sleep = () => {
    sequence.phase = "sleeping";
    sequence.start = time;
  };

  let time = 0;
  const _focus = new THREE.Vector3();
  const inside = (p) => p.z < R.sas.z1 - 1.4; // bien entré : l'Iris peut se refermer derrière
  const near = (p, x, z, d) => Math.hypot(p.x - x, p.z - z) < d;

  const updateSequence = (target, dt) => {
    const s = sequence;
    if (s.phase === "idle" && near(target, OPERATOR.x, OPERATOR.z, OPERATOR.radius)) {
      s.phase = "levers";
      s.start = time;
      s.lever = 0;
    }
    if (s.phase === "levers") {
      // Les leviers basculent un à un vers la position vérifiée, puis la lueur part du pupitre.
      while (s.lever < desk.levers.length && time - s.start >= (s.lever + 1) * LEVER_STEP) {
        desk.setLever(s.lever, verifiedLevers[s.lever]);
        s.lever += 1;
      }
      if (s.lever >= desk.levers.length && time - s.start >= (desk.levers.length + 2) * LEVER_STEP) {
        s.phase = "wave";
        s.start = time;
      }
    }
    if (s.phase === "wave") {
      s.radius = Math.min(WAVE_REACH, (time - s.start) * WAVE_SPEED);
      if (s.radius >= WAVE_REACH) s.phase = "done";
    }
    if (s.phase === "sleeping") {
      // Retour au vestibule : le Sas se rendort (vague inverse, plus rapide) pour qu'on puisse rejouer la scène.
      s.radius = Math.max(0, s.radius - 2 * WAVE_SPEED * dt);
      if (s.radius <= 0) {
        s.phase = "idle";
        desk.levers.forEach((_, i) => desk.setLever(i, restLevers[i]));
      }
    }
    if (checking && s.phase === "done" && !inside(target) && target.z > R.vestibule.z0 + 1.2) sleep();
    reveal.value.w = s.radius;
    // Les lampes s'allument quand la vague les atteint ; en se rendormant, seule la lampe de veille reste.
    for (const l of lamps) setLamp(l, l.rest || s.radius > l.distance);
  };

  const unlocked = () => !checking || sequence.phase === "done";
  const updateDoors = (target) => {
    for (const d of doors) {
      const distance = Math.hypot(target.x - d.x, target.z - d.z);
      // L'Iris : scellée derrière soi tant que la vérification n'est pas faite.
      const locked = d.role === "iris" ? checking && inside(target) && !unlocked() : !unlocked();
      if (distance < 2.4 && !locked && !d.opening) {
        d.door.open();
        d.opening = true;
      } else if ((distance > 3.6 || locked) && d.opening) {
        d.door.close();
        d.opening = false;
      }
    }
  };

  // --- Où l'on peut marcher : les pièces, et la baie de l'Iris quand elle est ouverte. -----------------------------
  const passage = { minX: -sill.width / 2 + 0.25, maxX: sill.width / 2 - 0.25, minZ: 5.4, maxZ: 6.6 };
  const northPassage = { minX: -0.5, maxX: 0.5, minZ: -0.7, maxZ: 0.7 };
  const inRect = (x, z, b) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
  const walkable = (x, z) =>
    Boolean(roomAt(x, z)) || (!iris.door.blocking && inRect(x, z, passage)) || (!north.door.blocking && inRect(x, z, northPassage));

  // Balade automatique : le parcours de la scène. Une étape gardée (`gate`) attend à `wait` que sa porte s'ouvre
  // (ou que la vérification soit faite) ; l'explorateur y fait halte, puis redemande.
  // (Une étape `pass` est atteinte à 0,6 m et sans halte ; une halte, à 1,5 m : la balade s'y arrête 2,5 s.)
  const route = [
    { x: 0.4, z: 8.7 },
    { x: 0, z: 7.6, pass: true },
    { x: 0, z: 4.6, pass: true, gate: () => !iris.door.blocking, wait: [0, 7.7] },
    { x: 0, z: 2.0, pass: true },
    { x: -3.3, z: 2.6, pass: true },
    { x: -3.35, z: 2.6 }, // devant le pupitre : la vérification commence
    { x: -0.3, z: 1.8, pass: true, gate: () => unlocked(), wait: [-3.35, 2.6] },
    { x: 0, z: 1.7 }, // devant la porte nord, qui s'ouvre
    { x: 0, z: 0.3, pass: true, gate: () => !north.door.blocking, wait: [0, 1.7] },
    ...archivesTour(),
    { x: 0, z: -0.3, pass: true, gate: () => !north.door.blocking, wait: [0, -1.6] },
    { x: 0, z: 2.0, pass: true },
    { x: 0, z: 4.8, pass: true },
    { x: 0, z: 7.4, pass: true, gate: () => !iris.door.blocking, wait: [0, 4.6] },
  ];
  let routeIndex = startRoom === "archives" ? route.findIndex((step) => step.archives) : 0;

  // Le tour des Archives : le catalogue, l'escalier à vis (on entre sous le palier, puis on monte marche à marche),
  // la mezzanine d'un bout à l'autre, la descente, les tables et les échelles, le retour à la porte du Sas.
  function archivesTour() {
    const st = archives.stair;
    const at = archives.stairAt;
    const c = Math.cos(at.rotY), sn = Math.sin(at.rotY);
    // Point du repère de l'escalier (rayon, angle de montée depuis +z, sens « left ») vers le monde.
    const point = (radius, t, extra = {}) => {
      const lx = Math.sin(t) * radius, lz = Math.cos(t) * radius;
      return { x: at.x + c * lx + sn * lz, z: at.z - sn * lx + c * lz, pass: true, ...extra };
    };
    const step = st.treads[1].a0 - st.treads[0].a0;
    const enter = st.landing.a0 - 2 * step; // sous les dernières marches, assez haut pour passer dessous
    // Dans l'escalier, une étape par marche, atteinte à 0,25 m : la balade suit l'hélice sans couper vers le noyau.
    const tight = { reach: 0.25 };
    const below = [point(1.75, enter), point(0.66, enter, tight), point(0.66, st.landing.a0 + 0.2, tight), point(0.66, st.landing.a1 - 0.15, tight)];
    const up = st.treads.map((tr) => point(0.66, (tr.a0 + tr.a1) / 2, tight));
    const landing = [point(0.66, 0, tight), point(1.6, 0, tight)];
    const m = archives.mezzanine;
    return [
      { x: 0, z: -1.6, pass: true, archives: true },
      { x: 0, z: -5.0, pass: true }, // l'allée entre les tables de l'ouest
      { x: 3.6, z: -5.0, pass: true },
      { x: 4.0, z: -7.5, pass: true },
      { x: 6, z: -7.5 }, // face au catalogue
      { x: 2.0, z: -7.7, pass: true },
      { x: 0, z: -7.7, pass: true },
      ...below,
      ...up,
      ...landing,
      { x: m.x - 2, z: m.z, pass: true },
      { x: m.x + 4, z: m.z }, // sur la mezzanine, devant les rangs hauts
      { x: at.x + 0.6, z: m.z, pass: true },
      ...landing.slice().reverse(),
      ...up.slice().reverse(),
      ...below.slice().reverse(),
      { x: 0, z: -7.7, pass: true },
      { x: 3.6, z: -7.7, pass: true },
      { x: 3.6, z: -3.2, pass: true },
      { x: 7.3, z: -3.3 }, // au pied d'une échelle roulante
      { x: 3.6, z: -3.2, pass: true },
      { x: 3.6, z: -5.0, pass: true },
      { x: 0, z: -5.0, pass: true },
      { x: 0, z: -1.6, pass: true },
    ];
  }

  const first = startRoom === "archives" ? new THREE.Vector3(0, 0, -1.6) : new THREE.Vector3(0, 0, 8.6);

  return {
    group,
    seed,
    room,
    state,
    size: room,
    meters: COMPLEX_ROOMS[room].meters,
    bounds,
    center: startRoom === "archives" ? new THREE.Vector3(6, 0, -6) : new THREE.Vector3(0, 0, 5),
    spawn: first,
    counts,
    rooms,
    interior: true,
    /** Face au nord au départ : la Porte-Iris. */
    spawnHeading: Math.PI,
    /** On ne recule pas jusqu'à voir le vide autour des pièces, ni ne se couche au ras du sol. */
    viewLimits: { minZoom: 0.8, minElevation: THREE.MathUtils.degToRad(22) },
    /** Brume : un voile sombre tramé au fond de la pièce (isométrique : compté depuis le point regardé). */
    fog: { iso: { near: 2, far: 14, max: 0.5 }, third: { near: 3, far: 16, max: 0.55 } },
    /** État de la vérification (lecture, captures). */
    sequence,

    /**
     * Hauteur du sol sous (x, z) : la plus haute surface de marche qu'on atteint d'un pas depuis la hauteur `y`
     * (le seuil de l'Iris : 0,20 m) ; sans `y`, depuis le sol.
     */
    heightAt(x, z, y = 0) {
      let h = 0;
      for (const s of surfaces) {
        if (x > s.minX && x < s.maxX && z > s.minZ && z < s.maxZ && s.top <= y + STEP_UP) h = Math.max(h, s.top);
      }
      return walk.heightAt(x, z, y, h);
    },

    /** Hauteur du plafond (la caméra à la 3e personne reste dessous). */
    ceilingAt(x, z) {
      return roomAt(x, z)?.h ?? Math.min(R.sas.h, R.vestibule.h);
    },

    /** Vue à la 3e personne : le plafond se ferme au-dessus de la tête. */
    setThirdPerson(value) {
      thirdPerson = value;
      for (const zone of Object.values(zones)) zone.ceiling.visible = value && zone.visible;
    },

    /**
     * Murs, piliers, meubles, portes fermées, garde-corps et marches selon l'étage (`y` : hauteur des pieds) ; pas de
     * chute par-dessus un bord ; et on ne sort pas des pièces.
     */
    collide(position, radius, y) {
      if (y === undefined) {
        walk.forget(position); // posé ailleurs (départ) : pas de pas d'avant
        y = 0;
      }
      colliders.collide(position, radius, y);
      walk.collide(position, radius, y, (x, z, yy) => this.heightAt(x, z, yy));
      if (walkable(position.x, position.z)) return;
      let best = null, bestDistance = Infinity;
      for (const r of allRooms) {
        const x = THREE.MathUtils.clamp(position.x, r.x0 + 0.35, r.x1 - 0.35);
        const z = THREE.MathUtils.clamp(position.z, r.z0 + 0.35, r.z1 - 0.35);
        const d = Math.hypot(x - position.x, z - position.z);
        if (d < bestDistance) [best, bestDistance] = [[x, z], d];
      }
      position.x = best[0];
      position.z = best[1];
    },

    strollTarget() {
      for (let guard = 0; guard < route.length; guard++) {
        const step = route[routeIndex];
        if (step.gate && !step.gate()) return { x: step.wait[0], z: step.wait[1] };
        routeIndex = (routeIndex + 1) % route.length;
        return { x: step.x, z: step.z, pass: Boolean(step.pass), reach: step.reach };
      }
      return { x: first.x, z: first.z };
    },

    setMood() {},

    update({ camera, target, dt, viewRadius, shadows }) {
      time += dt;
      updateSequence(target, dt);
      updateDoors(target);
      archives.update(time);
      kit.update();
      // Une pièce à la fois : celle où l'on est, et la voisine quand on est près de la porte nord ouverte.
      const inArchives = target.z < R.sas.z0;
      const nearNorth = !north.door.blocking && Math.hypot(target.x - north.x, target.z - north.z) < 3;
      const sasOn = !inArchives || nearNorth, archivesOn = inArchives || nearNorth;
      if (sasOn !== zones.sas.visible || archivesOn !== zones.archives.visible) showZones(sasOn, archivesOn);
      if (inArchives !== southShown) archives.setSouthWall((southShown = inArchives));
      // Les lampes allumées sont celles près du point regardé : devant la caméra en 3e personne.
      if (ceiling.group.visible && camera) {
        camera.getWorldDirection(_focus);
        _focus.y = 0;
        _focus.normalize().multiplyScalar(4).add(target);
      } else {
        _focus.copy(target);
      }
      halos?.update(_focus, time, camera);
      dust?.update(_focus, camera);
      if (shadows && daylight) daylight.update(target, Math.min(viewRadius + 6, 30));
    },

    stats() {
      const a = kit.stats(), b = archives.stats();
      return { meshes: a.meshes + b.meshes, triangles: a.triangles + b.triangles, models: a.models + b.models, fraction: 1 };
    },

    dispose() {
      halos?.dispose();
      dust?.dispose();
      daylight?.dispose();
      kit.dispose();
      ceiling.dispose();
      archives.dispose();
      archivesCeiling.dispose();
      for (const object of objects) {
        object.traverse((child) => {
          child.geometry?.dispose();
          child.material?.userData?.depthMaterial?.dispose();
          child.material?.dispose?.();
        });
      }
      group.clear();
    },
  };
}
