// Prairie d'été : une île de plaine vallonnée, des bosquets, des rochers, un ciel de beau temps. Entièrement
// procédurale à partir d'une graine, en trois tailles, et en trois habillages pour comparer :
//
// - `ready`  : le sol de prairie de la bibliothèque (herbe grasse, herbe sèche, terre et fleurs peintes dans le
//              sol) + arbres, rochers, ciel. Aucune herbe ni fleur en volume.
// - `assets` : un sol uni vert + tous les assets : pelouses, touffes d'herbe, hautes herbes, massifs de fleurs,
//              mousse, taupinières, en plus des arbres, des rochers et du ciel.
// - `mixed`  : le sol de prairie ET la végétation en volume.
//
// Les trois habillages d'une même graine partagent le relief, les arbres, les rochers et les nuages : seule la
// façon de couvrir le sol change. 1 unité = 1 mètre partout ; rien n'est remis à l'échelle hors des plages prévues
// par chaque asset (un massif de fleurs arrive au genou, un chêne fait 9 à 13 m).

import * as THREE from "three";
import { createToonMaterial, disposeObject } from "../engine/toon-material.js";
import { buildTerrainChunk } from "../assets/kit/geometry.js";
import { GROUNDS, MEADOW_GROUNDS, STONES } from "../assets/kit/palettes.js";
import { createNoise3, createRng } from "../assets/kit/rng.js";
import * as flowerClump from "../assets/nature/plants/flower-clump.js";
import * as grassTuft from "../assets/nature/plants/grass-tuft.js";
import * as boulder from "../assets/nature/rocks/boulder.js";
import * as buriedRock from "../assets/nature/rocks/buried-rock.js";
import * as dirtMound from "../assets/nature/terrain/dirt-mound.js";
import * as lawn from "../assets/nature/terrain/lawn.js";
import * as meadowGround from "../assets/nature/terrain/meadow-ground.js";
import * as mossPatch from "../assets/nature/terrain/moss-patch.js";
import * as birch from "../assets/nature/trees/birch.js";
import * as linden from "../assets/nature/trees/linden.js";
import * as oak from "../assets/nature/trees/oak.js";
import { ScatterField } from "./kit/scatter.js";
import { createClouds, createDaylight, createSunDisc } from "./kit/sky.js";
import { buildIslandBand, groundNormal } from "./kit/terrain.js";

export const MEADOW_SIZES = {
  small: { label: "Petit", meters: 48 },
  medium: { label: "Moyen", meters: 96 },
  large: { label: "Grand", meters: 144 },
};

export const MEADOW_VARIANTS = {
  ready: { label: "A · Sol prêt", ground: "meadow", detail: false, note: "Sol de prairie de la bibliothèque, arbres, rochers, ciel." },
  assets: { label: "B · Tout en assets", ground: "plain", detail: true, note: "Sol vert uni, et toute la végétation posée en volume." },
  mixed: { label: "A + B", ground: "meadow", detail: true, note: "Sol de prairie et végétation en volume par-dessus." },
};

const TILE = 16; // côté d'un morceau de sol (m)
const RELIEF = 1.8; // hauteur des ondulations (m)
const SEASON = "summer";
const GROUND_ID = 11; // identifiant de contour du sol (celui de l'asset « Sol de prairie »)
/**
 * Triangles que le semis peut coûter par image, ombres comprises (le sol en prend une vingtaine de milliers de
 * plus). Les arbres et les rochers passent d'abord ; herbes et fleurs s'éclaircissent pour tenir dans ce qu'il
 * reste, sans descendre sous FINE_TRIANGLE_FLOOR : dans un bosquet, l'herbe est plus rare qu'en plein pré.
 */
const SCATTER_TRIANGLE_BUDGET = 170000;
const FINE_TRIANGLE_FLOOR = 60000;
/** La carte d'ombre est refaite une image sur deux : un triangle qui projette une ombre coûte 1,5 fois. */
const SHADOW_COST = 1.5;

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = THREE.MathUtils.smoothstep;
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _yaw = new THREE.Quaternion();
const _tilt = new THREE.Quaternion();
const _normal = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

/**
 * Crée une prairie d'été.
 * @param {{seed?: number, size?: "small"|"medium"|"large", variant?: "ready"|"assets"|"mixed"}} [options]
 */
export function createSummerMeadow({ seed = 1, size = "medium", variant = "ready" } = {}) {
  seed = THREE.MathUtils.clamp(Math.round(seed) || 0, 0, 9999);
  const meters = (MEADOW_SIZES[size] ?? MEADOW_SIZES.medium).meters;
  const look = MEADOW_VARIANTS[variant] ?? MEADOW_VARIANTS.ready;
  const tiles = meters / TILE;
  const firstTile = -Math.floor(tiles / 2);
  // Les morceaux de sol sont centrés sur les multiples de TILE (convention de l'asset « Sol de prairie »).
  const min = (firstTile - 0.5) * TILE;
  const bounds = { minX: min, maxX: min + meters, minZ: min, maxZ: min + meters };
  const center = new THREE.Vector3(min + meters / 2, 0, min + meters / 2);
  const area = meters * meters;

  const heightAt = meadowGround.groundHeight(seed, RELIEF);
  const noise = createNoise3(seed * 17 + 3);
  /** Champ lisse 0..1 de longueur d'onde donnée ; `slot` distingue des champs indépendants. */
  const field = (x, z, wavelength, slot) => noise(x / wavelength + slot * 19.7, slot * 3.1 + 0.5, z / wavelength - slot * 7.3);
  const fbm = (x, z, wavelength, slot) => field(x, z, wavelength, slot) * 0.65 + field(x, z, wavelength / 2.7, slot + 50) * 0.35;

  const group = new THREE.Group();
  group.name = "Prairie d'été";
  const counts = {};

  // --- Sol -----------------------------------------------------------------------------------------------------
  const ground = new THREE.Group();
  ground.name = "ground";
  let groundMaterial = null;
  for (let j = 0; j < tiles; j++) {
    for (let i = 0; i < tiles; i++) {
      const tileX = firstTile + i;
      const tileZ = firstTile + j;
      let mesh;
      if (look.ground === "meadow") {
        // L'asset tel quel, un morceau par case ; sa tranche est remplacée par celle de l'île.
        const tile = meadowGround.create({ seed, season: SEASON, finish: "pixel", tileX, tileZ, size: TILE, relief: RELIEF, dryness: 0.25 });
        mesh = tile.getObjectByName("ground");
        disposeObject(tile.getObjectByName("skirt"));
        if (groundMaterial) {
          mesh.material.dispose();
          mesh.material = groundMaterial;
        } else {
          groundMaterial = mesh.material;
        }
      } else {
        // Sol uni : même relief, même vert de base, aucun motif.
        const { top, skirt } = buildTerrainChunk({ size: TILE, spacing: 0.5, origin: [tileX * TILE, tileZ * TILE], height: heightAt });
        skirt.dispose();
        groundMaterial ??= createToonMaterial({ ramp: MEADOW_GROUNDS[SEASON].grass, steps: [0.62, 0.8, 0.935], id: GROUND_ID, shadowLit: 0.7 });
        mesh = new THREE.Mesh(top, groundMaterial);
        mesh.name = "ground";
        mesh.receiveShadow = true;
      }
      mesh.position.set(tileX * TILE, 0, tileZ * TILE);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      ground.add(mesh);
    }
  }
  // Vu presque à l'horizontale, chaque bosse du pré cache un peu de sol derrière elle, et la passe de contours y
  // traçait un trait sombre en travers de l'herbe : le sol ne se cerne lui-même que sur un vrai décroché (4 m).
  groundMaterial.uniforms.uSelfEdge.value = 4;
  group.add(ground);

  // Tranche de l'île : terre, puis roche au bas déchiqueté.
  const soilBottom = (x, z) => -1.1 - field(x, z, 9, 30) * 0.9;
  const rockBottom = (x, z) => -4.5 - field(x, z, 6, 31) * 3.5 - field(x, z, 23, 32) * 3;
  const soil = new THREE.Mesh(
    buildIslandBand({ bounds, top: heightAt, bottom: soilBottom }),
    createToonMaterial({ ramp: GROUNDS.dirt.ramp, steps: [0.3, 0.5, 0.74], pattern: "speckle", patternParams: [16, 0.08, 0.2, 1], seed: 5, id: 12 }),
  );
  const bedrock = new THREE.Mesh(
    buildIslandBand({ bounds, top: (x, z) => soilBottom(x, z) + 0.02, bottom: rockBottom }),
    createToonMaterial({ ramp: STONES.granite.ramp, ink: STONES.granite.ink, steps: [0.3, 0.5, 0.74], pattern: "speckle", patternParams: [8, 0.1, 0.2, 1], seed: 9, id: 13 }),
  );
  soil.name = "soil";
  bedrock.name = "bedrock";
  group.add(soil, bedrock);

  // --- Semis ---------------------------------------------------------------------------------------------------
  const scatter = new ScatterField({ bounds, heightAt });
  /**
   * Couche de végétation fine posée sur le sol : ses matériaux prennent l'identifiant de contour du sol, sinon
   * chaque touffe et chaque tige serait cernée de sombre, et un pré de milliers de touffes deviendrait une
   * résille noire. `outlined` : noms des maillages qui gardent leur contour (pétales).
   */
  const addGroundCover = (prototype, { outlined = [], ...options } = {}) => {
    prototype.traverse((child) => {
      if (child.isMesh && !outlined.includes(child.name)) child.material.uniforms.uId.value = GROUND_ID;
    });
    return scatter.addLayer(prototype, { reach: "fine", thin: true, castShadow: false, ...options });
  };
  const rng = createRng(seed * 9973 + 11);

  /** Ajoute une copie posée sur le sol. `tilt` : couchée sur la pente (plaques au sol) ; `sink` : enfoncée (m). */
  const place = (layer, x, z, { yaw = 0, scale = 1, tilt = false, sink = 0 } = {}) => {
    _position.set(x, heightAt(x, z) - sink, z);
    _yaw.setFromAxisAngle(UP, yaw);
    if (tilt) _tilt.setFromUnitVectors(UP, groundNormal(heightAt, x, z, _normal)).multiply(_yaw);
    else _tilt.copy(_yaw);
    layer.add(_matrix.compose(_position, _tilt, _scale.setScalar(scale)));
  };
  const inside = (x, z, margin) =>
    x > bounds.minX + margin && x < bounds.maxX - margin && z > bounds.minZ + margin && z < bounds.maxZ - margin;

  // Arbres : quelques modèles par essence, chaque copie tournée et à une taille différente.
  const species = {
    oak: { module: oak, seeds: [3, 8], height: 11, scale: [0.82, 1.18], spacing: 7.5, crown: 5.6, trunk: 0.5 },
    linden: { module: linden, seeds: [2, 5], height: 12.5, scale: [0.8, 1.18], spacing: 6.5, crown: 4.4, trunk: 0.42 },
    birch: { module: birch, seeds: [1, 4], height: 9, scale: [0.8, 1.2], spacing: 3.4, crown: 3.2, trunk: 0.24 },
  };
  for (const kind of Object.values(species)) {
    kind.layers = kind.seeds.map((treeSeed) =>
      scatter.addLayer(kind.module.create({ seed: treeSeed, season: SEASON, height: kind.height, fullness: 0.75 }), { reach: "tall" }),
    );
  }

  /** Obstacles ronds { x, z, radius } : ce qu'on ne traverse pas (troncs, gros rochers). */
  const colliders = [];
  const trees = [];
  const TREE_CELL = 4;
  const treeCells = Math.ceil(meters / TREE_CELL);
  for (let j = 0; j < treeCells; j++) {
    for (let i = 0; i < treeCells; i++) {
      const x = bounds.minX + (i + rng.next()) * TREE_CELL;
      const z = bounds.minZ + (j + rng.next()) * TREE_CELL;
      const roll = rng.next();
      const pick = rng.next();
      const model = rng.next();
      const size = rng.next();
      const yaw = rng.range(0, TAU);
      if (!inside(x, z, 3.5)) continue;
      // Bosquets : les arbres se serrent là où le champ est haut, et laissent de grandes clairières ailleurs.
      const grove = smoothstep(fbm(x, z, 44, 1), 0.5, 0.68);
      if (roll > 0.015 + grove * 0.55) continue;
      const essence = field(x, z, 75, 2);
      const name = grove > 0.2
        ? (essence < 0.4 ? "birch" : essence < 0.68 ? "oak" : "linden")
        : (pick < 0.55 ? "oak" : pick < 0.85 ? "linden" : "birch"); // arbres isolés : surtout de grands chênes
      const kind = species[name];
      if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < (tree.kind.spacing + kind.spacing) / 2)) continue;
      const scale = THREE.MathUtils.lerp(kind.scale[0], kind.scale[1], size);
      place(kind.layers[Math.floor(model * kind.layers.length)], x, z, { yaw, scale, sink: 0.12 });
      trees.push({ x, z, kind, name, crown: kind.crown * scale });
      colliders.push({ x, z, radius: kind.trunk * scale });
    }
  }
  counts.trees = trees.length;

  // Rochers : des affleurements (un gros bloc et sa suite) et des roches enterrées isolées.
  const boulders = [
    { seed: 1, size: 1.3 },
    { seed: 4, size: 1.0, cover: "moss" },
    { seed: 7, size: 0.6, roughness: 0.5 },
  ].map((given) => ({ ...given, layer: scatter.addLayer(boulder.create({ stone: "granite", ...given }), { reach: "low" }) }));
  const slabs = [
    { seed: 2, size: 2.2 },
    { seed: 5, size: 1.4, cover: "moss" },
  ].map((given) => ({ ...given, layer: scatter.addLayer(buriedRock.create({ stone: "granite", ...given }), { reach: "low" }) }));

  const rocks = [];
  const addRock = (x, z, big) => {
    if (!inside(x, z, 2)) return;
    if (trees.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 1.6)) return;
    const yaw = rng.range(0, TAU);
    if (big || rng.chance(0.55)) {
      const model = big ? boulders[rng.int(0, 1)] : rng.pick(boulders);
      const scale = big ? rng.range(1.05, 1.5) : rng.range(0.6, 1.1);
      place(model.layer, x, z, { yaw, scale, sink: 0.06 * model.size * scale });
      const height = model.size * scale;
      rocks.push({ x, z, radius: height * 1.05 }); // un bloc est plus large que haut
      if (height > 0.75) colliders.push({ x, z, radius: height * 0.55 });
    } else {
      const model = rng.pick(slabs);
      const scale = rng.range(0.7, 1.25);
      place(model.layer, x, z, { yaw, scale, sink: 0.02 });
      rocks.push({ x, z, radius: model.size * scale * 0.6 });
    }
  };
  const outcrops = Math.max(2, Math.round(area / 1200));
  for (let n = 0; n < outcrops; n++) {
    // Les affleurements percent sur les hauteurs : on garde le plus haut de trois tirages.
    let site = null;
    for (let t = 0; t < 3; t++) {
      const x = rng.range(bounds.minX + 6, bounds.maxX - 6);
      const z = rng.range(bounds.minZ + 6, bounds.maxZ - 6);
      const h = heightAt(x, z);
      if (!site || h > site.h) site = { x, z, h };
    }
    addRock(site.x, site.z, true);
    const followers = rng.int(2, 6);
    for (let k = 0; k < followers; k++) {
      const angle = rng.range(0, TAU);
      const distance = 1.2 + Math.sqrt(rng.next()) * 4;
      addRock(site.x + Math.cos(angle) * distance, site.z + Math.sin(angle) * distance, false);
    }
  }
  const loners = Math.round(area / 650);
  for (let n = 0; n < loners; n++) {
    addRock(rng.range(bounds.minX + 3, bounds.maxX - 3), rng.range(bounds.minZ + 3, bounds.maxZ - 3), false);
  }
  counts.rocks = rocks.length;

  // --- Végétation en volume (habillages `assets` et `mixed`) ---------------------------------------------------
  counts.tufts = 0;
  counts.flowers = 0;
  counts.lawns = 0;
  counts.patches = 0;
  if (look.detail) {
    const detail = createRng(seed * 7477 + 29);
    // Recherche rapide des arbres et rochers voisins.
    const BUCKET = 8;
    const buckets = new Map();
    const bucketKey = (x, z) => Math.floor(x / BUCKET) * 4096 + Math.floor(z / BUCKET);
    const register = (item, kind, radius) => {
      for (let bx = Math.floor((item.x - radius) / BUCKET); bx <= Math.floor((item.x + radius) / BUCKET); bx++) {
        for (let bz = Math.floor((item.z - radius) / BUCKET); bz <= Math.floor((item.z + radius) / BUCKET); bz++) {
          const key = bx * 4096 + bz;
          if (!buckets.has(key)) buckets.set(key, { trees: [], rocks: [] });
          buckets.get(key)[kind].push(item);
        }
      }
    };
    for (const tree of trees) register(tree, "trees", tree.crown);
    for (const rock of rocks) register(rock, "rocks", rock.radius);
    /** 0 au pied d'un tronc, 1 au bord de sa couronne, 2 en plein champ. */
    const openness = (x, z) => {
      let open = 2;
      for (const tree of buckets.get(bucketKey(x, z))?.trees ?? []) {
        open = Math.min(open, Math.hypot(tree.x - x, tree.z - z) / tree.crown);
      }
      return open;
    };
    const onRock = (x, z, margin = 0) =>
      (buckets.get(bucketKey(x, z))?.rocks ?? []).some((rock) => Math.hypot(rock.x - x, rock.z - z) < rock.radius + margin);
    /** Creux humides (1) et bosses sèches (0). */
    const moisture = (x, z) => (1 - heightAt(x, z) / RELIEF) * 0.55 + field(x, z, 32, 6) * 0.45;

    // Pelouses : plaques d'herbe drue dans les creux humides, posées sur la pente.
    const lawns = [
      { cut: "wild", seed: 1, size: 2.8 },
      { cut: "wild", seed: 2, size: 2.2 },
      { cut: "long", seed: 3, size: 2.4 },
    ].map((given) => addGroundCover(lawn.create({ season: SEASON, shape: "patch", fullness: 0.5, ...given }), { skip: ["sod"] }));
    const LAWN_CELL = 3;
    const lawnCells = Math.ceil(meters / LAWN_CELL);
    for (let j = 0; j < lawnCells; j++) {
      for (let i = 0; i < lawnCells; i++) {
        const x = bounds.minX + (i + detail.next()) * LAWN_CELL;
        const z = bounds.minZ + (j + detail.next()) * LAWN_CELL;
        const roll = detail.next();
        const model = detail.next();
        const yaw = detail.range(0, TAU);
        const scale = detail.range(0.85, 1.15);
        if (!inside(x, z, 1.8) || onRock(x, z, 0.8) || openness(x, z) < 0.3) continue;
        if (roll > smoothstep(moisture(x, z), 0.42, 0.66) * 0.45) continue;
        place(lawns[Math.floor(model * lawns.length)], x, z, { yaw, scale, tilt: true });
        counts.lawns += 1;
      }
    }

    // Touffes d'herbe partout, plus ou moins serrées ; hautes herbes à épis en nappes dans les zones ouvertes.
    const tufts = [1, 2, 3].map((tuftSeed) =>
      addGroundCover(grassTuft.create({ seed: tuftSeed, season: SEASON, kind: "meadow", height: 0.5, fullness: 0.6 })),
    );
    const tallTufts = [4, 5].map((tuftSeed) =>
      addGroundCover(grassTuft.create({ seed: tuftSeed, season: SEASON, kind: "tall", height: 0.42, fullness: 0.6 })),
    );
    const TUFT_CELL = 1;
    const tuftCells = Math.ceil(meters / TUFT_CELL);
    for (let j = 0; j < tuftCells; j++) {
      for (let i = 0; i < tuftCells; i++) {
        const x = bounds.minX + (i + detail.next()) * TUFT_CELL;
        const z = bounds.minZ + (j + detail.next()) * TUFT_CELL;
        const roll = detail.next();
        const tallRoll = detail.next();
        const model = detail.next();
        const yaw = detail.range(0, TAU);
        const scale = detail.range(0.75, 1.25);
        if (!inside(x, z, 0.5) || onRock(x, z, 0.15)) continue;
        const open = openness(x, z);
        if (open < 0.14) continue; // terre battue au pied des troncs
        const vigor = fbm(x, z, 11, 3) * 0.7 + field(x, z, 48, 4) * 0.3;
        let chance = 0.22 + smoothstep(vigor, 0.36, 0.62);
        if (open < 1) chance *= 0.5; // à l'ombre des couronnes, l'herbe est plus rare et plus rase
        if (roll > chance) continue;
        const tallZone = fbm(x, z, 27, 5);
        if (open >= 1.1 && tallRoll < smoothstep(tallZone, 0.56, 0.7) * 0.75) {
          place(tallTufts[Math.floor(model * tallTufts.length)], x, z, { yaw, scale });
        } else {
          place(tufts[Math.floor(model * tufts.length)], x, z, { yaw, scale: scale * (open < 1 ? 0.8 : 1) });
        }
        counts.tufts += 1;
      }
    }

    // Fleurs : chaque espèce a ses nappes. Coquelicots et bleuets sur le sec, boutons d'or dans les creux,
    // marguerites partout, lavande en coussins sur les bosses pierreuses.
    const flowers = {
      daisy: { count: 5, bias: () => 0, threshold: 0.68, slot: 10, wavelength: 21 },
      poppy: { count: 5, bias: (wet) => (0.5 - wet) * 0.3, threshold: 0.69, slot: 11, wavelength: 25 },
      cornflower: { count: 5, bias: (wet) => (0.5 - wet) * 0.2, threshold: 0.7, slot: 12, wavelength: 19 },
      buttercup: { count: 6, bias: (wet) => (wet - 0.5) * 0.4, threshold: 0.7, slot: 13, wavelength: 17 },
      lavender: { count: 3, bias: (wet) => (0.5 - wet) * 0.45, threshold: 0.82, slot: 14, wavelength: 15 },
    };
    for (const [name, kind] of Object.entries(flowers)) {
      kind.layer = addGroundCover(flowerClump.create({ seed: kind.slot, species: name, season: SEASON, count: kind.count }), { outlined: ["petals", "hearts"] });
    }
    const FLOWER_CELL = 1.3;
    const flowerCells = Math.ceil(meters / FLOWER_CELL);
    for (let j = 0; j < flowerCells; j++) {
      for (let i = 0; i < flowerCells; i++) {
        const x = bounds.minX + (i + detail.next()) * FLOWER_CELL;
        const z = bounds.minZ + (j + detail.next()) * FLOWER_CELL;
        const roll = detail.next();
        const stray = detail.next();
        const yaw = detail.range(0, TAU);
        const scale = detail.range(0.85, 1.08);
        if (!inside(x, z, 0.6) || onRock(x, z, 0.2)) continue;
        const open = openness(x, z);
        if (open < 0.75) continue; // les fleurs des champs veulent le soleil
        const wet = moisture(x, z);
        let best = null;
        let bestValue = 0;
        for (const kind of Object.values(flowers)) {
          const value = fbm(x, z, kind.wavelength, kind.slot) + kind.bias(wet) - kind.threshold;
          if (value > bestValue) {
            best = kind;
            bestValue = value;
          }
        }
        if (best && roll < 0.15 + smoothstep(bestValue, 0, 0.1) * 0.5) {
          place(best.layer, x, z, { yaw, scale });
          counts.flowers += 1;
        } else if (stray < 0.01) {
          // Quelques fleurs égarées hors des nappes.
          place(stray < 0.006 ? flowers.daisy.layer : flowers.buttercup.layer, x, z, { yaw, scale: scale * 0.9 });
          counts.flowers += 1;
        }
      }
    }

    // Mousse : au pied des arbres, du côté à l'ombre, et contre les rochers.
    const moss = scatter.addLayer(mossPatch.create({ seed: 3, season: SEASON, size: 1.4, cushions: 7 }), { reach: "low", castShadow: false });
    for (const tree of trees) {
      if (!detail.chance(0.6)) continue;
      const angle = Math.PI + detail.range(-0.9, 0.9); // vers -z : à l'opposé du soleil
      const distance = tree.kind.trunk * 1.2 + detail.range(0.3, 0.9);
      const x = tree.x + Math.sin(angle) * distance;
      const z = tree.z + Math.cos(angle) * distance;
      if (inside(x, z, 1)) {
        place(moss, x, z, { yaw: detail.range(0, TAU), scale: detail.range(0.7, 1.2), tilt: true });
        counts.patches += 1;
      }
    }
    for (const rock of rocks) {
      if (!detail.chance(0.3)) continue;
      const angle = detail.range(0, TAU);
      const x = rock.x + Math.cos(angle) * (rock.radius + 0.3);
      const z = rock.z + Math.sin(angle) * (rock.radius + 0.3);
      if (inside(x, z, 1)) {
        place(moss, x, z, { yaw: detail.range(0, TAU), scale: detail.range(0.5, 0.9), tilt: true });
        counts.patches += 1;
      }
    }

    // Taupinières : de petites buttes de terre fraîche, par groupes, en plein pré.
    const molehill = scatter.addLayer(dirtMound.create({ seed: 2, soil: "dirt", size: 0.75, height: 0.28 }), { reach: "low", castShadow: false });
    const colonies = Math.max(1, Math.round(area / 1500));
    for (let n = 0; n < colonies; n++) {
      const cx = detail.range(bounds.minX + 5, bounds.maxX - 5);
      const cz = detail.range(bounds.minZ + 5, bounds.maxZ - 5);
      const hills = detail.int(3, 6);
      for (let k = 0; k < hills; k++) {
        const angle = detail.range(0, TAU);
        const distance = detail.range(0.4, 3.2);
        const x = cx + Math.cos(angle) * distance;
        const z = cz + Math.sin(angle) * distance;
        if (!inside(x, z, 1) || openness(x, z) < 1.1 || onRock(x, z, 0.4)) continue;
        place(molehill, x, z, { yaw: detail.range(0, TAU), scale: detail.range(0.7, 1.15), tilt: true });
        counts.patches += 1;
      }
    }
  }

  scatter.build(createRng(seed * 31 + 7));
  group.add(scatter.group);

  // --- Ciel ----------------------------------------------------------------------------------------------------
  const daylight = createDaylight();
  const sunDisc = createSunDisc(daylight, { seed: seed % 50 });
  const clouds = createClouds(createRng(seed * 131 + 1), { bounds, drifting: Math.round(4 + area / 4000), horizon: 7 });
  group.add(daylight.light, daylight.light.target, sunDisc.group, clouds.group);
  counts.clouds = clouds.group.children.length;

  // --- Point de départ : près du centre, à l'écart des troncs et des rochers --------------------------------------
  const spawn = new THREE.Vector3(center.x, 0, center.z);
  search: for (let ring = 0; ring < 12; ring++) {
    for (let k = 0; k < Math.max(1, ring * 6); k++) {
      const angle = (k / Math.max(1, ring * 6)) * TAU;
      const x = center.x + Math.cos(angle) * ring * 2;
      const z = center.z + Math.sin(angle) * ring * 2;
      if (colliders.every((collider) => Math.hypot(collider.x - x, collider.z - z) > collider.radius + 2.5)) {
        spawn.set(x, 0, z);
        break search;
      }
    }
  }
  spawn.y = heightAt(spawn.x, spawn.z);


  return {
    group,
    seed,
    size,
    variant,
    meters,
    bounds,
    center,
    spawn,
    counts,
    daylight,
    heightAt,

    /**
     * Empêche de traverser les troncs et les gros rochers, et de sortir de la carte : corrige `position` (x, z).
     * @param {THREE.Vector3} position
     * @param {number} radius rayon du personnage (m)
     */
    collide(position, radius) {
      for (const collider of colliders) {
        const dx = position.x - collider.x;
        const dz = position.z - collider.z;
        const reach = collider.radius + radius;
        const distance = Math.hypot(dx, dz);
        if (distance < reach && distance > 1e-4) {
          position.x = collider.x + (dx / distance) * reach;
          position.z = collider.z + (dz / distance) * reach;
        }
      }
      position.x = THREE.MathUtils.clamp(position.x, bounds.minX + 0.6, bounds.maxX - 0.6);
      position.z = THREE.MathUtils.clamp(position.z, bounds.minZ + 0.6, bounds.maxZ - 0.6);
    },

    /**
     * À appeler à chaque image, caméra à jour, avant le rendu.
     * @param {object} frame
     * @param {THREE.OrthographicCamera} frame.camera
     * @param {number} frame.cameraAzimuth azimut de la caméra (rad)
     * @param {THREE.Vector3} frame.target point regardé (le personnage)
     * @param {number} frame.dt secondes depuis l'image précédente
     * @param {number} frame.viewRadius demi-diagonale de la zone de sol vue (m)
     * @param {boolean} frame.shadows vrai les images où la carte d'ombre est refaite : la lumière ne suit la
     *   vue que ces images-là, sinon les ombres glisseraient sur le sol
     */
    update({ camera, cameraAzimuth, target, dt, viewRadius, shadows }) {
      scatter.update(camera, { budget: SCATTER_TRIANGLE_BUDGET, shadowCost: SHADOW_COST, minThin: FINE_TRIANGLE_FLOOR });
      clouds.update(dt);
      sunDisc.update(camera, cameraAzimuth);
      if (shadows) daylight.update(target, viewRadius + 10);
    },

    /** Ce qui est dessiné à cet instant par le semis, et la part de végétation fine affichée. */
    stats() {
      return { ...scatter.stats(), fraction: scatter.fraction };
    },

    dispose() {
      scatter.dispose();
      clouds.dispose();
      sunDisc.dispose();
      daylight.dispose();
      for (const mesh of ground.children) mesh.geometry.dispose();
      groundMaterial?.dispose();
      disposeObject(soil);
      disposeObject(bedrock);
      group.clear();
    },
  };
}
