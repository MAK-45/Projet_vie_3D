// Le Complexe, pièce 3 : l'Atelier de l'Artisan (docs/complexe/PIECES.md), 12 × 10 × 5,5 m, à l'est des Archives.
// Construit par le monde du Complexe (`ancient-complex.js`), qui le montre quand on y est (ou près de la porte qui y
// mène, au mur est des Archives).
//
// - Plafond : quatre poutres rivetées de bronze à 5,0 m sur corbeaux de pierre, au pas de 2,5 m ; celle du nord est une
//   poutre-rail, un palan y roule au-dessus du four, des lingots de cuivre à son crochet.
// - Nord-ouest : le four à bobines et sa lueur orange (la lumière de halo orange lui est réservée), l'enclume devant
//   sa bouche, un touret de câble. Nord : la grande baie ouverte sur le couloir de la Galerie (fermé par une barrière
//   à bandes ambre : la Galerie viendra au lot 12), le tour à métaux, le trio de fûts sur palette dans l'angle.
// - Centre : le portique roulant et sa caisse qui monte et redescend, l'établi central et sa lampe d'atelier.
// - Mur est : râtelier à outils, étagère à tirages, table à calques lumineuse. Coin sud-est : l'établi d'horloger et
//   l'étagère à pièces. Sud-ouest : le chariot à pièces lourdes.
// - Chemins de câbles muraux à 2,6 m qui filent vers le nord ; sol de basalte taché d'huile et de limaille autour du
//   four, du tour et du chariot.
//
// États : endormi (four en veille, tour et portique à l'arrêt, lampes éteintes) ; sinon tout tourne.
// Praticable : meubles en boîtes, la caisse du portique bloque tant qu'elle est basse ; on entre dans le couloir
// jusqu'à la barrière.
//
// 1 unité = 1 mètre ; repère du monde du Complexe (x vers l'est, z vers le sud) : la pièce va de x = 15 à 27 et de
// z = −12 à −2 ; murs sur les x impairs et les z pairs, dalles au centre des cases de 2 m.

import * as THREE from "three";
import { disposeObject, enableCutaway } from "../engine/toon-material.js";
import * as complexDoor from "../assets/buildings/structure/complex-door.js";
import * as bronzeRailing from "../assets/buildings/structure/bronze-railing.js";
import * as glyphColumn from "../assets/buildings/structure/glyph-column.js";
import * as glyphFloorSlab from "../assets/buildings/structure/glyph-floor-slab.js";
import * as glyphWall from "../assets/buildings/structure/glyph-wall.js";
import * as rivetedBeam from "../assets/buildings/structure/riveted-beam.js";
import * as articulatedLamp from "../assets/furniture/lighting/articulated-lamp.js";
import * as filamentLamp from "../assets/furniture/lighting/filament-lamp.js";
import * as bronzeStool from "../assets/furniture/seating/bronze-stool.js";
import * as partsShelf from "../assets/furniture/storage/parts-shelf.js";
import * as toolRack from "../assets/furniture/storage/tool-rack.js";
import * as lightTable from "../assets/furniture/tables/light-table.js";
import * as workbench from "../assets/furniture/tables/workbench.js";
import * as cableReel from "../assets/props/machines/cable-reel.js";
import * as cableTray from "../assets/props/machines/cable-tray.js";
import * as coilFurnace from "../assets/props/machines/coil-furnace.js";
import * as complexCart from "../assets/props/machines/complex-cart.js";
import * as hoistGantry from "../assets/props/machines/hoist-gantry.js";
import * as metalLathe from "../assets/props/machines/metal-lathe.js";
import * as oilDrum from "../assets/props/machines/oil-drum.js";
import * as anvil from "../assets/props/tools/anvil.js";
import { FORGE_GLOW, GLOWS } from "../assets/kit/palettes.js";
import { mergeToned } from "../assets/kit/complex-parts.js";
import { createRng } from "../assets/kit/rng.js";
import { InteriorKit } from "./kit/interior.js";

/** La pièce : emprise aux axes des murs, hauteur sous plafond. */
export const ATELIER = { name: "Atelier", x0: 15, x1: 27, z0: -12, z1: -2, h: 5.5 };
/** Le couloir de la Galerie (fermé par une barrière au lot 11) : la partie praticable, jusqu'à la barrière. */
export const ATELIER_CORRIDOR = { minX: 19.8, maxX: 22.2, minZ: -13.35, maxZ: -11.4 };

const HALF_PI = Math.PI / 2;
const AMBER = GLOWS.amber.light;
const WALL_CUT = { rule: "wall", height: -1 };
const CORNER_CUT = { rule: "corner", height: -1 };
const VIEW_HIDE = { rule: "view", height: -1 };
const WEST_H = 7; // le mur ouest est celui des Archives (7 m), doublé côté Atelier
const BEAM_Y = 5.0;
const BEAMS_Z = [-10.75, -8.25, -5.75, -3.25]; // la première est la poutre-rail du palan
const NORTH_BAY = 21; // milieu de la grande baie nord
const CORRIDOR = { x0: 19.5, x1: 22.5, z1: -16.3, h: 4.5 };

/**
 * Construit l'Atelier.
 * @param {object} o
 * @param {number} o.seed graine du monde
 * @param {"check"|"awake"|"asleep"} o.state état du Complexe (endormi : four en veille, machines à l'arrêt)
 * @param {import("./kit/interior.js").BoxColliders} o.colliders obstacles du monde
 * @param {Array} o.sources lampes du monde (halo, poussière)
 * @param {object} o.counts compteurs du monde
 * @param {(object: THREE.Object3D) => void} o.cutObject vue en coupe d'un objet posé seul
 * @returns {{ group: THREE.Group, hooks: Set<string>, gantry: object, hoist: object, update: (time: number) => void,
 *   setWestWall: (visible: boolean) => void, stats: () => object, dispose: () => void }}
 */
export function buildAtelier({ seed, state, colliders, sources, counts, cutObject }) {
  const rng = createRng(seed * 4241 + 919);
  const r = ATELIER;
  const kit = new InteriorKit();
  const group = new THREE.Group();
  group.name = "Atelier";
  const objects = [];
  const asleep = state === "asleep";
  const turnY = new THREE.Vector3(0, 1, 0);

  const addBox = (x, z, rotY, [w, d, oz = 0], active = null) => {
    const c = Math.cos(rotY), s = Math.sin(rotY);
    const swap = Math.abs(s) > 0.5;
    colliders.add(x + s * oz, z + c * oz, (swap ? d : w) / 2, (swap ? w : d) / 2, active);
  };
  const put = (key, x, z, rotY = 0, box = null, y = 0) => {
    const index = kit.place(key, x, z, rotY, y);
    if (box) addBox(x, z, rotY, box);
    return index;
  };
  // Point d'un modèle (repère local) une fois posé en (x, y, z), tourné de rotY.
  const worldPoint = (local, x, z, rotY, y = 0) => local.clone().applyAxisAngle(turnY, rotY).add(new THREE.Vector3(x, y, z));
  const light = (position, color, radius, strength, dust = 4) => sources.push({ position, color, radius, strength, dust });
  // Petits objets et machines basses : pas d'ombre portée (une passe d'ombre de moins par modèle) ; le four, l'établi,
  // le portique et les poutres gardent la leur.
  const SMALL = { castShadow: false };

  // --- Sol : dalles de basalte ; taches d'huile et de limaille autour du four, du tour et du chariot ; une allée usée
  // de la porte des Archives vers le centre. ------------------------------------------------------------------------
  const SLAB = { castShadow: false };
  kit.model("slab", glyphFloorSlab, { variant: "intact", groove: "dark", seed: seed + 201 }, SLAB);
  kit.model("slab-worn", glyphFloorSlab, { variant: "worn", groove: "dark", seed: seed + 202 }, SLAB);
  kit.model("slab-stained", glyphFloorSlab, { variant: "stained", groove: "dark", seed: seed + 203 }, SLAB);
  const oily = new Set(["16,-11", "18,-11", "18,-9", "20,-9", "24,-11", "26,-11", "24,-9", "16,-3", "18,-3"]);
  for (let x = r.x0 + 1; x < r.x1; x += 2) {
    for (let z = r.z0 + 1; z < r.z1; z += 2) {
      const roll = rng.next();
      const turn = rng.int(0, 3) * HALF_PI;
      const aisle = z === -7 && x < 21;
      const key = oily.has(`${x},${z}`) ? (roll < 0.85 ? "slab-stained" : "slab-worn") : aisle ? "slab-worn" : "slab";
      put(key, x, z, turn, null, -0.2);
      counts.slabs += 1;
    }
  }
  // Le couloir : quatre dalles (3 m de large, sous les murs), usées.
  for (const x of [20, 22]) for (const z of [-13, -15]) put(rng.next() < 0.5 ? "slab-worn" : "slab", x, z, rng.int(0, 3) * HALF_PI, null, -0.2);

  // --- Murs de 5,5 m, glyphes en veille. Le mur ouest double celui des Archives (7 m, 2 cm devant, côté Atelier) et ne
  // se montre que dans l'Atelier ; la porte des Archives (z = −7) est posée par les Archives. -------------------------
  const wall = (key, variant, h, glyphs = "dim", cut = WALL_CUT) => {
    kit.model(key, glyphWall, { seed: seed * 13 + 901 + key.length, variant, height: h, width: 2, glyphs }, { cut, castShadow: true });
    return key;
  };
  wall("wall", "plain", r.h);
  wall("wall-west", "plain", WEST_H);
  // Les murs du couloir regardent de côté : ils se cachent quand ils sont entre la caméra et le promeneur (vue du nord).
  wall("corridor-wall", "plain", CORRIDOR.h, "off", VIEW_HIDE);
  for (let c = r.x0 + 1; c < r.x1; c += 2) {
    // Nord : la grande baie occupe les modules 20 et 22.
    if (c !== 20 && c !== 22) {
      put("wall", c, r.z0, 0);
      colliders.add(c, r.z0, 1, 0.3);
    }
    put("wall", c, r.z1, Math.PI);
    colliders.add(c, r.z1, 1, 0.3);
    counts.walls += 2;
  }
  for (let c = r.z0 + 1; c < r.z1; c += 2) {
    put("wall", r.x1, c, -HALF_PI);
    colliders.add(r.x1, c, 0.3, 1);
    if (c !== -7) put("wall-west", r.x0 + 0.02, c, HALF_PI);
    counts.walls += 2;
  }
  // Piliers d'angle : à l'ouest, ceux des Archives (7 m), redoublés pour l'Atelier ; à l'est, à sa hauteur.
  kit.model("pillar-west", glyphColumn, { seed: seed + 911, shape: "square", height: WEST_H, diameter: 0.92, glyphs: "dim" }, { cut: CORNER_CUT, castShadow: true });
  kit.model("pillar", glyphColumn, { seed: seed + 912, shape: "square", height: r.h, diameter: 0.9, glyphs: "dim" }, { cut: CORNER_CUT, castShadow: true });
  for (const z of [r.z0, r.z1]) {
    put("pillar-west", r.x0, z, 0);
    put("pillar", r.x1, z, 0, [0.9, 0.9]);
  }

  // La grande baie nord : la porte double, ouverte pour de bon (ses battants rabattus contre le couloir), puis le
  // couloir de 3 m, sombre, fermé par une barrière à bandes ambre.
  const bay = complexDoor.create({ seed: seed * 31 + 41, model: "double", height: r.h, state: "open", glyphs: "dim" });
  bay.position.set(NORTH_BAY, 0, r.z0);
  group.add(bay);
  objects.push(bay);
  cutObject(bay);
  const bayOpen = bay.userData.door.opening.width;
  for (const s of [-1, 1]) colliders.add(NORTH_BAY + s * (2 + bayOpen / 2) / 2, r.z0, (2 - bayOpen / 2) / 2, 0.3);
  counts.doors += 1;
  for (const z of [-13.3, -15.3]) {
    put("corridor-wall", CORRIDOR.x0 - 0.3, z, HALF_PI);
    put("corridor-wall", CORRIDOR.x1 + 0.3, z, -HALF_PI);
    colliders.add(CORRIDOR.x0 - 0.3, z, 0.3, 1);
    colliders.add(CORRIDOR.x1 + 0.3, z, 0.3, 1);
  }
  kit.model("barrier", bronzeRailing, { seed: seed + 921, kind: "barrier", segments: 1, span: 2.8 });
  put("barrier", NORTH_BAY, -13.65, 0);
  colliders.add(NORTH_BAY, -13.65, 1.6, 0.15);

  // --- Plafond : quatre poutres rivetées à 5,0 m sur corbeaux, la première en poutre-rail. Une poutre entre la caméra
  // et le promeneur se cache, comme un mur (et le palan avec la sienne). ---------------------------------------------
  const beamLength = r.x1 - r.x0 - 0.6;
  const BEAM = { cut: VIEW_HIDE, castShadow: true };
  kit.model("beam", rivetedBeam, { seed: seed + 931, model: "beam", length: beamLength, height: BEAM_Y, support: "corbels" }, BEAM);
  const railBeam = kit.model("beam-rail", rivetedBeam, { seed: seed + 932, model: "beam-rail", length: beamLength, height: BEAM_Y, support: "corbels" }, BEAM);
  BEAMS_Z.forEach((z, i) => put(i === 0 ? "beam-rail" : "beam", (r.x0 + r.x1) / 2, z, 0));
  counts.furniture += 4;

  // --- Nord-ouest : le four, l'enclume devant sa bouche, le palan au-dessus, le touret. -----------------------------
  const FURNACE = { x: 18.0, z: -10.6 };
  const furnace = kit.model("furnace", coilFurnace, { seed: seed + 941, state: asleep ? "standby" : "full" }, { castShadow: true });
  put("furnace", FURNACE.x, FURNACE.z, 0, [1.5, 1.5]);
  const mouth = worldPoint(furnace.userData.lightPoint ?? new THREE.Vector3(0, 0.6, 0.8), FURNACE.x, FURNACE.z, 0);
  light(mouth, FORGE_GLOW.light, asleep ? 1.8 : 3.8, asleep ? 0.5 : 0.85, asleep ? 2 : 8);
  kit.model("anvil", anvil, { seed: seed + 942, kind: "stump" }, SMALL);
  put("anvil", 18.3, -8.7, 0.35, [0.9, 0.7]);
  const hoistObject = hoistGantry.create({
    seed: seed + 943, model: "beam-hoist", rails: "off", railHeight: railBeam.userData.rail.running, load: "ingots", lift: 0.85, trolley: 0.5,
  });
  hoistObject.position.set(19.05, 0, BEAMS_Z[0]);
  hoistObject.traverse((child) => {
    if (!child.isMesh || !child.material.uniforms?.uRamp) return;
    child.castShadow = false; // petit et haut : son ombre ne se verrait guère (trois passes d'ombre de moins)
    enableCutaway(child.material, VIEW_HIDE.rule, VIEW_HIDE.height);
    child.customDepthMaterial = child.material.userData.depthMaterial;
  });
  group.add(hoistObject);
  objects.push(hoistObject);
  kit.model("reel", cableReel, { seed: seed + 944, fill: "half" }, SMALL);
  put("reel", 16.3, -10.9, 0, [0.8, 1.3]);
  counts.furniture += 4;

  // --- Nord-est : le tour à métaux contre le mur, le trio de fûts sur palette dans l'angle. -------------------------
  kit.model("lathe", metalLathe, { seed: seed + 951, state: asleep ? "idle" : "running", work: "bar" }, SMALL);
  put("lathe", 23.9, -11.15, 0, [1.7, 0.8]);
  kit.model("drums", oilDrum, { seed: seed + 952, pose: "pallet" }, SMALL);
  put("drums", 26.0, -10.95, 0.25, [1.3, 1.3]);
  counts.furniture += 2;

  // --- Centre : le portique et sa caisse ; l'établi central, sa lampe, ses outils, un tabouret. ---------------------
  const GANTRY = { x: 22.6, z: -8.0 };
  const gantryObject = hoistGantry.create({ seed: seed + 961, model: "gantry", load: "crate", lift: 0.25, trolley: 0.5, state: asleep ? "idle" : "loop" });
  gantryObject.position.set(GANTRY.x, 0, GANTRY.z);
  group.add(gantryObject);
  objects.push(gantryObject);
  const gantry = gantryObject.userData.hoist;
  // Les chevalets (semelles au sol) et la caisse, qui bloque tant qu'elle pend sous 1,7 m.
  for (const s of [-1, 1]) colliders.add(GANTRY.x + s * 1.42, GANTRY.z, 0.12, 1.25);
  colliders.add(GANTRY.x + gantry.hook.x, GANTRY.z, 0.38, 0.33, () => gantry.bottom < 1.7);
  counts.furniture += 1;

  const BENCH = { x: 21.4, z: -4.6 };
  const bench = kit.model("bench", workbench, { seed: seed + 971, kind: "central", clutter: "used" }, { castShadow: true });
  put("bench", BENCH.x, BENCH.z, 0, [2.7, 1.0]);
  const top = bench.userData.surface?.y ?? 0.92;
  const lamp = kit.model("bench-lamp", articulatedLamp, { seed: seed + 972, kind: "workshop", mount: "clamp", state: asleep ? "off" : "lit" }, { castShadow: false });
  put("bench-lamp", BENCH.x + 1.0, BENCH.z - 0.43, Math.PI, null, top);
  if (!asleep) light(worldPoint(lamp.userData.lightPoint ?? new THREE.Vector3(0, 0.6, 0.3), BENCH.x + 1.0, BENCH.z - 0.43, Math.PI, top).add(new THREE.Vector3(0, -0.35, 0)), AMBER, 2.6, 0.6, 3);
  kit.model("stool", bronzeStool, { seed: seed + 974, model: "workshop" }, SMALL);
  // Le tabouret, rangé au bout est de l'établi (le passage devant reste libre).
  put("stool", BENCH.x + 1.6, BENCH.z + 0.3, rng.range(0, 1), [0.45, 0.45]);
  counts.furniture += 3;

  // --- Mur est : râtelier, étagère à tirages, table à calques ; coin sud-est : l'horloger et l'étagère à pièces. ------
  const east = r.x1 - 0.3;
  kit.model("rack", toolRack, { seed: seed + 981, fill: "some" }, { cut: WALL_CUT, castShadow: false });
  put("rack", east, -9.2, -HALF_PI, [2.0, 0.35, 0.17]);
  kit.model("prints", partsShelf, { seed: seed + 982, model: "prints", fill: "some" }, { cut: WALL_CUT, castShadow: false });
  put("prints", east, -7.0, -HALF_PI, [2.0, 0.55, 0.27]);
  const table = kit.model("light-table", lightTable, { seed: seed + 983, state: asleep ? "off" : "on", tilt: 12 }, SMALL);
  put("light-table", east - 0.55, -4.9, -HALF_PI, [1.5, 1.0]);
  if (!asleep) light(worldPoint(table.userData.lightPoint ?? new THREE.Vector3(0, 1.0, 0), east - 0.55, -4.9, -HALF_PI), GLOWS.amber.ramp[3], 2.0, 0.45, 2);
  kit.model("watchmaker", workbench, { seed: seed + 984, kind: "watchmaker" }, SMALL);
  put("watchmaker", east - 0.4, -3.05, -HALF_PI, [1.2, 0.75]);
  put("stool", east - 1.3, -3.0, HALF_PI + rng.range(-0.3, 0.3), [0.45, 0.45]);
  kit.model("parts", partsShelf, { seed: seed + 985, model: "parts", fill: "full" }, { cut: WALL_CUT, castShadow: false });
  put("parts", 23.2, r.z1 - 0.3, Math.PI, [2.0, 0.55, 0.27]);
  counts.furniture += 6;

  // --- Sud-ouest : le chariot à pièces lourdes. ----------------------------------------------------------------------
  kit.model("cart", complexCart, { seed: seed + 991, model: "heavy", load: "half" }, SMALL);
  put("cart", 17.6, -3.3, 0.05, [2.0, 0.95]);
  counts.furniture += 1;

  // --- Chemins de câbles muraux à 2,6 m : à l'ouest de la baie, et de la baie vers l'angle nord-est puis le mur est. ---
  const TRAY_H = 2.6;
  // Les deux parcours ne font qu'un modèle (leurs maillages fusionnés par matière : 2 draw calls en tout).
  const face = r.z0 + 0.3;
  const runs = [[[r.x0 + 0.3, face], [19.4, face]], [[22.6, face], [r.x1 - 0.3, face], [r.x1 - 0.3, -10.2]]];
  kit.model("trays", { create: (p) => mergeRuns(runs.map((points) => cableTray.createRun(points, p))) }, { seed: seed + 995, mount: "wall", height: TRAY_H }, { cut: WALL_CUT, castShadow: false });
  put("trays", 0, 0, 0);

  // --- Lampes : deux suspendues entre les poutres (allumées, sauf endormi). -----------------------------------------
  const hooks = new Set();
  const hanging = kit.model("lamp", filamentLamp, { seed: seed + 997, height: 3.2, chain: r.h - 3.2, state: asleep ? "off" : "lit" }, { cut: VIEW_HIDE });
  for (const [x, z] of [[18, -7], [24, -5]]) {
    put("lamp", x, z, 0);
    hooks.add(`${x},${z}`);
    const p = hanging.userData.lightPoint ?? new THREE.Vector3(0, 3.2, 0);
    if (!asleep) light(new THREE.Vector3(x + p.x, p.y - 0.8, z + p.z), AMBER, 4.4, 0.6, 6);
    counts.lamps += 1;
  }

  kit.build();
  group.add(kit.group);

  const update = () => {
    kit.update();
  };

  return {
    group,
    hooks,
    gantry,
    hoist: hoistObject.userData.hoist,
    update,
    /** Montre ou cache le doublage du mur ouest (vu des Archives, il passerait devant leur mur est). */
    setWestWall(visible) {
      for (const key of ["wall-west", "pillar-west"]) for (const mesh of kit.models.get(key)?.meshes ?? []) mesh.visible = visible;
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

// Fusionne des parcours de chemin de câbles (mêmes réglages, donc mêmes matières) : un maillage par matière.
function mergeRuns(groups) {
  const [first, ...rest] = groups;
  for (const mesh of first.children) {
    const others = rest.map((g) => g.getObjectByName(mesh.name)).filter(Boolean);
    if (!others.length) continue;
    const merged = mergeToned([mesh.geometry, ...others.map((o) => o.geometry)]);
    mesh.geometry.dispose();
    mesh.geometry = merged;
  }
  for (const g of rest) disposeObject(g);
  return first;
}
