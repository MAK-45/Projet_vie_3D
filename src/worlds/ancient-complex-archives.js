// Le Complexe, pièce 2 : les Archives (docs/complexe/PIECES.md), 18 × 12 × 7 m, au nord du Sas. Construite par le
// monde du Complexe (`ancient-complex.js`), qui la montre quand on y est (ou près de la porte qui y mène).
//
// - Mur nord : six rayonnages monumentaux à tiroirs, une mezzanine en caillebotis devant, à 3,4 m, qu'on rejoint par
//   l'escalier à vis du coin nord-ouest. Les rangs bas se lisent du sol, les rangs hauts depuis la mezzanine.
// - Mur sud : cinq rayonnages, deux échelles roulantes sur leur rail ; la porte du Sas au sud-ouest.
// - Mur ouest : deux vitrines de conservation et un rayonnage bas ; mur est : la porte de l'Atelier (fermée : il
//   n'existe pas encore), un rayonnage bas, un chariot.
// - Au centre : le meuble-catalogue et sa lampe, six colonnes cannelées en deux rangs, quatre tables de lecture avec
//   leurs lampes, tabourets, loupes, visionneuse et cassettes, deux lanternes suspendues, un chariot de cassettes.
// - Vie : rouages des rayonnages, un tiroir qui glisse seul de temps en temps sur le rayonnage du milieu, le pupitre
//   du catalogue qui tourne d'un cran, poussière ambre dans la lumière des lampes. Trois appliques au-dessus des
//   rayonnages du nord éclairent la mezzanine.
//
// Praticable : la mezzanine et l'escalier à vis (surfaces de marche à étages, `WalkSurfaces`), les meubles en
// boîtes ; on passe sous la mezzanine.
//
// 1 unité = 1 mètre ; repère du monde du Complexe (x vers l'est, z vers le sud) : la pièce va de x = −3 à 15 et de
// z = −12 à 0 ; murs sur les x impairs et les z pairs.

import * as THREE from "three";
import * as cardCatalogue from "../assets/furniture/tables/card-catalogue.js";
import * as complexDoor from "../assets/buildings/structure/complex-door.js";
import * as glyphColumn from "../assets/buildings/structure/glyph-column.js";
import * as glyphFloorSlab from "../assets/buildings/structure/glyph-floor-slab.js";
import * as glyphWall from "../assets/buildings/structure/glyph-wall.js";
import * as gratingWalkway from "../assets/buildings/structure/grating-walkway.js";
import * as rollingLadder from "../assets/buildings/structure/rolling-ladder.js";
import * as spiralStair from "../assets/buildings/structure/spiral-stair.js";
import * as articulatedLamp from "../assets/furniture/lighting/articulated-lamp.js";
import * as filamentChandelier from "../assets/furniture/lighting/filament-chandelier.js";
import * as filamentLamp from "../assets/furniture/lighting/filament-lamp.js";
import * as bronzeStool from "../assets/furniture/seating/bronze-stool.js";
import * as displayCase from "../assets/furniture/storage/display-case.js";
import * as drawerArchive from "../assets/furniture/storage/drawer-archive.js";
import * as stoneTable from "../assets/furniture/tables/stone-table.js";
import * as dataCassette from "../assets/props/books/data-cassette.js";
import * as complexCart from "../assets/props/machines/complex-cart.js";
import * as crankRecorder from "../assets/props/machines/crank-recorder.js";
import * as armMagnifier from "../assets/props/tools/arm-magnifier.js";
import { GLOWS } from "../assets/kit/palettes.js";
import { createRng } from "../assets/kit/rng.js";
import { InteriorKit } from "./kit/interior.js";

/** La pièce : emprise aux axes des murs, hauteur sous voûte. */
export const ARCHIVES = { name: "Archives", x0: -3, x1: 15, z0: -12, z1: 0, h: 7 };

const HALF_PI = Math.PI / 2;
const AMBER = GLOWS.amber.light;
const WALL_CUT = { rule: "wall", height: -1 };
const CORNER_CUT = { rule: "corner", height: -1 };
const COLUMN_CUT = { rule: "view", height: 1.2 };
const VIEW_HIDE = { rule: "view", height: -1 };
const MEZZANINE = { top: 3.4, width: 1.2 };
const STAIR = { x: -1.4, z: -8.75 }; // centre de l'escalier à vis (palier ouvert vers le nord, sur la mezzanine)
const CATALOGUE = { x: 6, z: -5.4 };
const EAST_DOOR_Z = -7;

/**
 * Construit les Archives.
 * @param {object} o
 * @param {number} o.seed graine du monde
 * @param {"check"|"awake"|"asleep"} o.state état du Sas (endormi : les lampes des tables sont éteintes)
 * @param {import("./kit/interior.js").BoxColliders} o.colliders obstacles du monde (on y ajoute ceux de la pièce)
 * @param {import("./kit/interior.js").WalkSurfaces} o.walk étages du monde (escalier, mezzanine)
 * @param {Array} o.sources lampes du monde (halo, poussière) : on y ajoute celles de la pièce
 * @param {object} o.counts compteurs du monde
 * @param {(object: THREE.Object3D) => void} o.cutObject vue en coupe d'un objet posé seul (porte)
 * @returns {{ group: THREE.Group, objects: THREE.Object3D[], hooks: Set<string>, stair: object, stairAt: object,
 *   mezzanine: object, catalogue: object, east: object, update: (time: number) => void, stats: () => object,
 *   dispose: () => void }}
 */
export function buildArchives({ seed, state, colliders, walk, sources, counts, cutObject }) {
  const rng = createRng(seed * 7919 + 777);
  const r = ARCHIVES;
  const kit = new InteriorKit();
  const group = new THREE.Group();
  group.name = "Archives";
  const objects = [];
  const asleep = state === "asleep";

  const addBox = (x, z, rotY, [w, d, oz = 0], top = Infinity) => {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const swap = Math.abs(s) > 0.5;
    colliders.add(x + s * oz, z + c * oz, (swap ? d : w) / 2, (swap ? w : d) / 2, null, top);
  };
  const put = (key, x, z, rotY = 0, box = null, y = 0) => {
    const index = kit.place(key, x, z, rotY, y);
    if (box) addBox(x, z, rotY, box);
    return index;
  };
  const alone = (object, x, z, rotY = 0, y = 0) => {
    object.position.set(x, y, z);
    object.rotation.y = rotY;
    group.add(object);
    objects.push(object);
    return object;
  };

  // --- Sol : dalles de basalte à rainures sombres, quelques usées et tachées (allées, pied des tables). ------------
  const SLAB = { castShadow: false };
  kit.model("slab", glyphFloorSlab, { variant: "intact", groove: "dark", seed: seed + 101 }, SLAB);
  kit.model("slab-worn", glyphFloorSlab, { variant: "worn", groove: "dark", seed: seed + 102 }, SLAB);
  kit.model("slab-stained", glyphFloorSlab, { variant: "stained", groove: "dark", seed: seed + 103 }, SLAB);
  for (let x = r.x0 + 1; x < r.x1; x += 2) {
    for (let z = r.z0 + 1; z < r.z1; z += 2) {
      const roll = rng.next();
      const turn = rng.int(0, 3) * HALF_PI;
      // L'allée usée : de la porte du Sas au catalogue, puis vers l'escalier.
      const aisle = (x === 0 && z > -6) || (z === -5 && x < 6) || (z === -7 && x < 2);
      const key = aisle && roll < 0.8 ? "slab-worn" : roll < 0.08 ? "slab-stained" : "slab";
      put(key, x, z, turn, null, -0.2);
      counts.slabs += 1;
    }
  }

  // --- Murs de 7 m, glyphes en veille. Le mur sud double celui du Sas (2 cm devant lui, côté Archives) ; au-dessus de
  // la porte du Sas (5 m), un linteau de 4 m posé à 3 m. Porte de l'Atelier au mur est. -----------------------------
  const wallKey = (variant) => {
    const key = `wall-${variant}`;
    kit.model(key, glyphWall, { seed: seed * 13 + 707 + variant.length, variant, height: r.h, width: 2, glyphs: "dim" }, { cut: WALL_CUT, castShadow: true });
    return key;
  };
  kit.model("lintel", glyphWall, { seed: seed * 13 + 711, variant: "plain", height: 4, width: 2, glyphs: "off" }, { cut: WALL_CUT, castShadow: true });
  const plain = wallKey("plain");
  // Le mur sud à part : vu du Sas (porte ouverte), on n'en verrait que le dos, une grande dalle noire ; il ne se
  // montre que quand on est dans les Archives.
  kit.model("wall-south", glyphWall, { seed: seed * 13 + 707 + 5, variant: "plain", height: r.h, width: 2, glyphs: "dim" }, { cut: WALL_CUT, castShadow: true });
  const conduit = wallKey("conduit");
  for (let c = r.x0 + 1; c < r.x1; c += 2) {
    // Nord (z = −12) : derrière les rayonnages ; sud (z = 0) : la porte du Sas en x = 0.
    put(c === 9 ? conduit : plain, c, r.z0, 0);
    colliders.add(c, r.z0, 1, 0.3);
    if (c === 0) put("lintel", c, r.z1 - 0.02, Math.PI, null, 3);
    else {
      put("wall-south", c, r.z1 - 0.02, Math.PI);
      colliders.add(c, r.z1, 1, 0.3);
    }
    counts.walls += 2;
  }
  for (let c = r.z0 + 1; c < r.z1; c += 2) {
    put(plain, r.x0, c, HALF_PI);
    colliders.add(r.x0, c, 0.3, 1);
    if (c !== EAST_DOOR_Z) {
      put(plain, r.x1, c, -HALF_PI);
      colliders.add(r.x1, c, 0.3, 1);
    }
    counts.walls += 2;
  }
  kit.model("pillar", glyphColumn, { seed: seed + 721, shape: "square", height: r.h, diameter: 0.9, glyphs: "dim" }, { cut: CORNER_CUT, castShadow: true });
  for (const [x, z] of [[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]]) put("pillar", x, z, 0, [0.9, 0.9]);

  // La porte de l'Atelier : fermée, verrouillée (l'Atelier viendra au lot 11).
  const eastObject = complexDoor.create({ seed: seed * 31 + 21, model: "standard", height: r.h, state: "closed", glyphs: "dim" });
  alone(eastObject, r.x1, EAST_DOOR_Z, -HALF_PI);
  cutObject(eastObject);
  const eastOpen = eastObject.userData.door.opening.width;
  for (const s of [-1, 1]) colliders.add(r.x1, EAST_DOOR_Z + (s * (1 + eastOpen / 2)) / 2, 0.3, (1 - eastOpen / 2) / 2);
  colliders.add(r.x1, EAST_DOOR_Z, 0.3, eastOpen / 2, () => eastObject.userData.door.blocking);
  counts.doors += 1;

  // --- Rayonnages de 2,65 m : six au nord (sous la mezzanine), cinq au sud (à l'est de la porte). Deux modèles au nord,
  // un au sud (caché avec le mur sud vu du Sas) ; celui du milieu du mur nord est posé seul : ses tiroirs glissent
  // d'eux-mêmes. Contre les murs, leur
  // ombre ne se verrait pas : ils n'en projettent pas (une passe d'ombre de moins par modèle). ------------------------
  const SHELF_CUT = WALL_CUT;
  const SHELF_W = 2.65;
  kit.model("shelf-a", drawerArchive, { seed: seed + 731, width: SHELF_W, drawers: "few" }, { cut: SHELF_CUT, castShadow: false });
  kit.model("shelf-b", drawerArchive, { seed: seed + 732, width: SHELF_W, drawers: "closed" }, { cut: SHELF_CUT, castShadow: false });
  kit.model("shelf-south", drawerArchive, { seed: seed + 733, width: SHELF_W, drawers: "few" }, { cut: SHELF_CUT, castShadow: false });
  kit.model("shelf-low", drawerArchive, { seed: seed + 734, width: 2, height: 2.4, drawers: "many" }, { cut: SHELF_CUT, castShadow: false });
  const northFace = r.z0 + 0.3;
  const south = r.z1 - 0.3;
  let live = null;
  const northPitch = (r.x1 - r.x0 - 0.9) / 6; // entre les piliers d'angle ; un jour de ~20 cm entre deux rayonnages
  for (let i = 0; i < 6; i++) {
    const x = r.x0 + 0.45 + northPitch * (i + 0.5);
    if (i === 3) {
      live = alone(drawerArchive.create({ seed: seed + 735, width: SHELF_W, drawers: "few" }), x, northFace, 0);
      live.traverse((child) => (child.castShadow = false));
      addBox(x, northFace, 0, [SHELF_W, 0.8, 0.4]);
    } else put(i % 2 ? "shelf-b" : "shelf-a", x, northFace, 0, [SHELF_W, 0.8, 0.4]);
  }
  const southXs = [];
  for (let i = 0; i < 5; i++) {
    const x = 1.15 + 1.34 + 2.68 * i;
    southXs.push(x);
    put("shelf-south", x, south, Math.PI, [SHELF_W, 0.8, 0.4]);
  }
  counts.furniture += 11;
  // Échelles roulantes sur les rayonnages 3 et 5 du sud.
  kit.model("ladder", rollingLadder, { seed: seed + 741, height: 5 }, { cut: SHELF_CUT, castShadow: true });
  for (const x of [southXs[2], southXs[4]]) {
    put("ladder", x, south - 0.8, Math.PI, [0.7, 0.95, 0.45]);
    counts.furniture += 1;
  }
  // Rayonnages bas : à l'ouest (entre les vitrines), à l'est (sous la porte de l'Atelier).
  put("shelf-low", r.x0 + 0.3, -4.4, HALF_PI, [2, 0.8, 0.4]);
  put("shelf-low", r.x1 - 0.3, -3.0, -HALF_PI, [2, 0.8, 0.4]);
  counts.furniture += 2;

  // --- La mezzanine et l'escalier à vis (étages praticables). ----------------------------------------------------
  const mezzLength = r.x1 - r.x0 - 0.9;
  const mezzX = (r.x0 + r.x1) / 2;
  const mezzZ = northFace + 0.8 + MEZZANINE.width / 2;
  const stairGap = [STAIR.x - mezzX - 0.55, STAIR.x - mezzX + 0.55];
  const mezz = kit.model("mezzanine", gratingWalkway, {
    seed: seed + 751, model: "mezzanine", shape: "straight", back: "wall", length: mezzLength, width: MEZZANINE.width,
    height: MEZZANINE.top, ends: "open", openings: [stairGap],
  }, { castShadow: true });
  put("mezzanine", mezzX, mezzZ, 0);
  walk.add(mezz.userData.walk, mezzX, mezzZ, 0);
  const stair = kit.model("stair", spiralStair, { seed: seed + 752, model: "stone", height: MEZZANINE.top, turn: "left" }, { castShadow: true });
  put("stair", STAIR.x, STAIR.z, Math.PI);
  walk.add(stair.userData.walk, STAIR.x, STAIR.z, Math.PI);
  counts.furniture += 2;

  // --- Le centre : six colonnes cannelées, le catalogue, quatre tables de lecture. ---------------------------------
  kit.model("column", glyphColumn, { seed: seed + 761, shape: "fluted", height: r.h, diameter: 1, glyphs: "lit" }, { cut: COLUMN_CUT, castShadow: true });
  for (const z of [-8.6, -2.2]) for (const x of [1, 6, 11]) put("column", x, z, 0, [1, 1]);
  const catalogue = alone(cardCatalogue.create({ seed: seed + 771, state: "tidy", lamp: asleep ? "off" : "lit", stem: r.h - 2.8 }), CATALOGUE.x, CATALOGUE.z, rng.range(0, Math.PI * 2));
  addBox(CATALOGUE.x, CATALOGUE.z, 0, [3.3, 1.5]);
  addBox(CATALOGUE.x, CATALOGUE.z, 0, [1.5, 3.3]);
  addBox(CATALOGUE.x, CATALOGUE.z, 0, [2.5, 2.5]);
  if (!asleep) {
    const light = catalogue.userData.lightPoint.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), catalogue.rotation.y);
    sources.push({ position: new THREE.Vector3(CATALOGUE.x + light.x, light.y - 0.4, CATALOGUE.z + light.z), color: AMBER, radius: 3.4, strength: 0.7, dust: 8 });
  }
  counts.furniture += 1;

  // Un modèle par sorte de meuble (les copies tournées se distinguent assez) ; les petits objets posés sur les tables
  // et les tabourets ne projettent pas d'ombre (quelques pixels, une passe d'ombre chacun).
  const SMALL = { castShadow: false };
  kit.model("table", stoneTable, { seed: seed + 781, kind: "reading" }, { castShadow: true });
  kit.model("table-lamp", articulatedLamp, { seed: seed + 783, kind: "reading", mount: "desk", state: asleep ? "off" : "lit" }, SMALL);
  kit.model("stool", bronzeStool, { seed: seed + 784 }, SMALL);
  kit.model("magnifier", armMagnifier, { seed: seed + 786 }, SMALL);
  kit.model("stack", dataCassette, { seed: seed + 787, pose: "stack", count: 5 }, SMALL);
  kit.model("viewer", crankRecorder, { seed: seed + 790, kind: "viewer" }, SMALL);
  const TOP = 0.85;
  // Deux groupes de deux tables, une allée de 1,2 m entre elles (z ≈ −5), tabourets côté extérieur.
  const tables = [[1.6, -6.1], [1.6, -3.9], [10.4, -6.1], [10.4, -3.9]];
  tables.forEach(([x, z], i) => {
    // Le côté des tabourets (+z ou −z) alterne : on lit face au catalogue ou dos à lui.
    const facing = i % 2 ? 0 : Math.PI;
    put("table", x, z, facing, [2.4, 1.0]);
    const side = Math.cos(facing); // +1 : la face avant (tiroir) regarde +z
    put("table-lamp", x + 0.85, z - 0.25 * side, facing - 0.6, null, TOP);
    put("stack", x - 0.5, z - 0.2 * side, rng.range(0, 1), null, TOP);
    if (i === 0 || i === 3) put("magnifier", x - 0.8, z - 0.1 * side, facing + 0.5, null, TOP);
    if (i === 2) put("viewer", x + 0.1, z - 0.15 * side, facing - 0.3, null, TOP);
    for (const dx of [-0.55, 0.45]) {
      put("stool", x + dx, z + 0.95 * side, facing + Math.PI + rng.range(-0.3, 0.3), [0.45, 0.45]);
    }
    if (!asleep) {
      sources.push({ position: new THREE.Vector3(x + 0.85 - 0.2, TOP + 0.35, z - 0.25 * side + 0.2 * side), color: AMBER, radius: 2.2, strength: 0.55, dust: 3 });
    }
    counts.furniture += 5;
  });

  // --- Le long des murs : vitrines à l'ouest, chariots de cassettes. ----------------------------------------------
  kit.model("case", displayCase, { seed: seed + 801, model: "conservation", content: "tablet" }, { castShadow: true });
  put("case", -1.9, -6.2, HALF_PI, [1.2, 0.8]);
  put("case", -1.9, -2.6, HALF_PI + Math.PI, [1.2, 0.8]);
  kit.model("cart", complexCart, { seed: seed + 803, model: "cassettes", load: "full" }, { castShadow: true });
  put("cart", 13.0, -4.6, HALF_PI + 0.25, [1.1, 0.7]);
  put("cart", 8.9, -2.85, 0.15, [1.1, 0.7]);
  counts.furniture += 4;

  // --- Lanternes suspendues au-dessus des deux groupes de tables (allumées, sauf Sas endormi). -----------------------
  const lantern = kit.model("lantern", filamentChandelier, { seed: seed + 811, model: "lantern", state: asleep ? "off" : "lit", height: 3.4, chain: r.h - 3.4 }, { cut: VIEW_HIDE });
  // Au centre d'une case de 2 m : la voûte au-dessus porte le crochet.
  const hooks = new Set();
  for (const x of [2, 10]) {
    const z = -5;
    put("lantern", x, z, 0);
    hooks.add(`${x},${z}`);
    const light = lantern.userData.lightPoint ?? new THREE.Vector3(0, 3.4, 0);
    if (!asleep) sources.push({ position: new THREE.Vector3(x + light.x, light.y - 0.8, z + light.z), color: AMBER, radius: 4.2, strength: 0.62, dust: 8 });
    counts.lamps += 1;
  }

  // Trois appliques au-dessus des rayonnages du nord (6 m) : la lumière de la mezzanine et des rangs hauts.
  kit.model("sconce", filamentLamp, { seed: seed + 812, mount: "wall", height: 6, state: asleep ? "off" : "lit" }, { cut: WALL_CUT });
  const sconce = kit.models.get("sconce").prototype;
  for (const x of [1.3, 7.0, 12.7]) {
    put("sconce", x, northFace, 0);
    const light = sconce.userData.lightPoint ?? new THREE.Vector3(0, 6, 0.2);
    if (!asleep) sources.push({ position: new THREE.Vector3(x + light.x, light.y - 1.6, northFace + light.z + 0.9), color: AMBER, radius: 3.8, strength: 0.6, dust: 4 });
    counts.lamps += 1;
  }

  kit.build();
  group.add(kit.group);

  // --- Vie : un tiroir du rayonnage du milieu glisse de temps en temps (sorti un moment, puis rentré). -------------
  let nextSlide = 4 + rng.range(0, 3);
  let slid = null;
  const archive = live.userData.archive;

  const update = (time) => {
    kit.update();
    if (time >= nextSlide) {
      if (slid) {
        archive.slide(slid[0], slid[1], 0, 1.1);
        slid = null;
        nextSlide = time + 4 + rng.range(0, 5);
      } else {
        slid = [rng.int(0, archive.cols - 1), rng.int(1, 9)];
        archive.slide(slid[0], slid[1], 1, 1.1);
        nextSlide = time + 3 + rng.range(0, 2);
      }
    }
  };

  return {
    group,
    objects,
    kit,
    hooks,
    stair: stair.userData.stair,
    stairAt: { ...STAIR, rotY: Math.PI },
    mezzanine: { x: mezzX, z: mezzZ, length: mezzLength, width: MEZZANINE.width, top: MEZZANINE.top },
    catalogue: catalogue.userData.catalogue,
    east: eastObject.userData.door,
    update,
    /**
     * Montre ou cache le côté sud (mur, linteau de la porte du Sas, rayonnages et échelles) : vu du Sas, porte
     * ouverte, on n'en verrait que les dos.
     */
    setSouthWall(visible) {
      for (const key of ["wall-south", "lintel", "shelf-south", "ladder"]) {
        for (const mesh of kit.models.get(key)?.meshes ?? []) mesh.visible = visible;
      }
    },
    stats: () => kit.stats(),
    dispose() {
      kit.dispose();
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
