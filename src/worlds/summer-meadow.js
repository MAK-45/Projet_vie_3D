// Prairie d'été : une île de plaine vallonnée qui flotte dans une mer de nuages. Des bosquets, des rochers, un pré
// d'herbes et de fleurs, des ombres de nuages qui passent. Entièrement procédurale à partir d'une graine, en trois
// tailles, et assemblée à partir des assets de la bibliothèque : le sol de prairie (herbe grasse, herbe sèche,
// terre et fleurs peintes dans le sol) donne la couleur et couvre tout ; par-dessus, pelouses, touffes, hautes
// herbes, massifs de fleurs, mousse et taupinières donnent le volume et bougent au vent.
//
// 1 unité = 1 mètre partout ; rien n'est remis à l'échelle hors des plages prévues par chaque asset (un massif de
// fleurs arrive au genou, un chêne fait 9 à 13 m).

import * as THREE from "three";
import { createToonMaterial, disposeObject } from "../engine/toon-material.js";
import { GROUNDS, STONES } from "../assets/kit/palettes.js";
import { createRng } from "../assets/kit/rng.js";
import * as meadowGround from "../assets/nature/terrain/meadow-ground.js";
import { ScatterField } from "./kit/scatter.js";
import { createCloudSea } from "./kit/cloud-sea.js";
import { createCloudShadows, createDaylight } from "./kit/sky.js";
import { buildIslandBand, buildIslandUnderside } from "./kit/terrain.js";
import { createEndlessMeadow } from "./summer-meadow-endless.js";
import { CELLS, createMeadowLayers, createPlacer, FULL_DETAIL_AREA, GROUND_GRAIN, meadowRules, SEASON, TAU, TILE } from "./summer-meadow-rules.js";

export { TILE } from "./summer-meadow-rules.js";

export const MEADOW_SIZES = {
  small: { label: "Petit", meters: 48 },
  medium: { label: "Moyen", meters: 96 },
  large: { label: "Grand", meters: 144 },
};

/** Tailles proposées par l'explorateur : les trois îles, et la prairie infinie (`summer-meadow-endless.js`). */
export const MEADOW_EXTENTS = {
  ...MEADOW_SIZES,
  endless: { label: "Infini", meters: Infinity },
};

const smoothstep = THREE.MathUtils.smoothstep;

/**
 * Crée une prairie d'été.
 * @param {object} [options]
 * @param {number} [options.seed] 0 à 9999 : relief, bosquets, affleurements, nappes de fleurs
 * @param {"small"|"medium"|"large"|"endless"} [options.size] 48, 96 ou 144 m de côté, ou infinie : la prairie se
 *   génère par morceaux autour du promeneur (summer-meadow-endless.js ; pas de diorama)
 * @param {number} [options.relief] hauteur des ondulations (m), 0,6 à 3
 * @param {number} [options.trees] abondance des arbres, 0 (aucun) à 2 (boisé) ; 1 = prairie à bosquets
 * @param {number} [options.rocks] abondance des rochers, 0 à 2
 * @param {number} [options.grass] abondance des herbes et des pelouses, 0 à 2
 * @param {number} [options.flowers] abondance des fleurs, 0 à 2
 * @param {boolean} [options.diorama] vrai : l'île seule, toutes ses copies dessinées, sans lumière, ni ombres de
 *   nuages, ni mer de nuages (fiche et vignette de l'asset) ; `update` devient inutile
 */
export function createSummerMeadow(options = {}) {
  if (options.size === "endless" && !options.diorama) return createEndlessMeadow(options);
  return createIsland(options);
}

/** L'île : la prairie semée d'un bloc sur une carte bornée, qui flotte dans la mer de nuages. */
function createIsland({ seed = 1, size = "medium", relief = 1.8, trees: treeAmount = 1, rocks: rockAmount = 1, grass = 1, flowers: flowerAmount = 1, diorama = false } = {}) {
  seed = THREE.MathUtils.clamp(Math.round(seed) || 0, 0, 9999);
  const meters = (MEADOW_SIZES[size] ?? MEADOW_SIZES.medium).meters;
  const tiles = meters / TILE;
  const firstTile = -Math.floor(tiles / 2);
  // Les morceaux de sol sont centrés sur les multiples de TILE (convention de l'asset « Sol de prairie »).
  const min = (firstTile - 0.5) * TILE;
  const bounds = { minX: min, maxX: min + meters, minZ: min, maxZ: min + meters };
  const center = new THREE.Vector3(min + meters / 2, 0, min + meters / 2);
  const area = meters * meters;

  const rules = meadowRules({ seed, relief, trees: treeAmount, flowers: flowerAmount });
  const { RELIEF, heightAt, field } = rules;

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
      // L'asset tel quel, un morceau par case ; sa tranche est remplacée par celle de l'île.
      const tile = meadowGround.create({ seed, season: SEASON, finish: "pixel", tileX, tileZ, size: TILE, relief: RELIEF, dryness: 0.25 });
      const mesh = tile.getObjectByName("ground");
      disposeObject(tile.getObjectByName("skirt"));
      if (groundMaterial) {
        mesh.material.dispose();
        mesh.material = groundMaterial;
      } else {
        groundMaterial = mesh.material;
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
  groundMaterial.uniforms.uPattern.value.x = GROUND_GRAIN;
  group.add(ground);

  // Tranche de l'île : terre, puis roche au bas déchiqueté.
  const soilBottom = (x, z) => -1.1 - field(x, z, 9, 30) * 0.9;
  // Dans l'explorateur, la falaise est courte : le dessous de l'île prend le relais et s'effile vers les nuages.
  const rockBottom = diorama
    ? (x, z) => -4.5 - field(x, z, 6, 31) * 3.5 - field(x, z, 23, 32) * 3
    : (x, z) => -3 - field(x, z, 6, 31) * 1.8 - field(x, z, 23, 32) * 1.5;
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
  // Dessous de l'île flottante : la roche s'effile en pointe loin sous le pré (explorateur seulement : la fiche
  // garde le diorama compact).
  const keelDepth = THREE.MathUtils.clamp(meters * 0.6, 28, 72);
  let underside = null;
  if (!diorama) {
    underside = new THREE.Mesh(buildIslandUnderside({ bounds, top: rockBottom, depth: keelDepth, noise: (x, z) => field(x, z, 6, 33) }), bedrock.material);
    underside.name = "underside";
    underside.matrixAutoUpdate = false;
    group.add(underside);
  }

  // --- Semis ---------------------------------------------------------------------------------------------------
  const scatter = new ScatterField({ bounds, heightAt });
  const rng = createRng(seed * 9973 + 11);
  const place = createPlacer(heightAt);
  const inside = (x, z, margin) =>
    x > bounds.minX + margin && x < bounds.maxX - margin && z > bounds.minZ + margin && z < bounds.maxZ - margin;
  const { species, boulders, slabs, lawns, tufts, tallTufts, flowers, moss, molehill } = createMeadowLayers((prototype, options) => scatter.addLayer(prototype, options));

  /** Obstacles ronds { x, z, radius } : ce qu'on ne traverse pas (troncs, gros rochers). */
  const colliders = [];
  const trees = [];
  const TREE_CELL = CELLS.tree;
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
      const grove = rules.grove(x, z);
      if (roll > (0.015 + grove * 0.55) * treeAmount) continue;
      const name = rules.treeKind(x, z, grove, pick);
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
  const outcrops = rockAmount > 0 ? Math.max(1, Math.round((area / 1200) * rockAmount)) : 0;
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
  const loners = Math.round((area / 650) * rockAmount);
  for (let n = 0; n < loners; n++) {
    addRock(rng.range(bounds.minX + 3, bounds.maxX - 3), rng.range(bounds.minZ + 3, bounds.maxZ - 3), false);
  }
  counts.rocks = rocks.length;

  // --- Végétation en volume (habillages `assets` et `mixed`) ---------------------------------------------------
  counts.tufts = 0;
  counts.flowers = 0;
  counts.lawns = 0;
  counts.patches = 0;
  {
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
    const { moisture } = rules;

    // Pelouses : plaques d'herbe drue dans les creux humides, posées sur la pente.
    const LAWN_CELL = CELLS.lawn;
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
        if (roll > smoothstep(moisture(x, z), 0.42, 0.66) * 0.45 * grass) continue;
        place(lawns[Math.floor(model * lawns.length)], x, z, { yaw, scale, tilt: true });
        counts.lawns += 1;
      }
    }

    // Touffes d'herbe partout, plus ou moins serrées ; hautes herbes à épis en nappes dans les zones ouvertes.
    const TUFT_CELL = CELLS.tuft;
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
        if (roll > rules.tuftChance(x, z, open) * grass) continue;
        if (open >= 1.1 && tallRoll < smoothstep(rules.tallZone(x, z), 0.56, 0.7) * 0.75) {
          place(tallTufts[Math.floor(model * tallTufts.length)], x, z, { yaw, scale });
        } else {
          place(tufts[Math.floor(model * tufts.length)], x, z, { yaw, scale: scale * (open < 1 ? 0.8 : 1) });
        }
        counts.tufts += 1;
      }
    }

    // Fleurs : chaque espèce a ses nappes (summer-meadow-rules.js).
    const FLOWER_CELL = CELLS.flower;
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
        const { best, bestValue } = rules.flowerAt(x, z, moisture(x, z), flowers);
        if (best && roll < (0.15 + smoothstep(bestValue, 0, 0.1) * 0.5) * Math.min(1.6, flowerAmount)) {
          place(best.layer, x, z, { yaw, scale });
          counts.flowers += 1;
        } else if (stray < 0.01 * flowerAmount) {
          // Quelques fleurs égarées hors des nappes.
          place(stray < 0.006 * flowerAmount ? flowers.daisy.layer : flowers.buttercup.layer, x, z, { yaw, scale: scale * 0.9 });
          counts.flowers += 1;
        }
      }
    }

    // Mousse : au pied des arbres, du côté à l'ombre, et contre les rochers.
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

  // --- Ciel : lumière, ombres de nuages, mer de nuages autour de l'île ------------------------------------------
  let daylight = null;
  let cloudShadows = null;
  let cloudSea = null;
  if (diorama) {
    scatter.showAll();
  } else {
    daylight = createDaylight();
    cloudShadows = createCloudShadows(createRng(seed * 131 + 1), { bounds, count: Math.round(4 + area / 4000) });
    cloudSea = createCloudSea({ bounds, seaLevel: -keelDepth - 30, mistLevel: -keelDepth * 0.82, inset: meters * 0.5 });
    group.add(daylight.light, daylight.light.target, cloudShadows.group, cloudSea.mesh);
  }

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
    meters,
    bounds,
    center,
    spawn,
    counts,
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
     * Applique l'ambiance du moment (kit/atmosphere.js) : position de l'astre, teintes de la mer de nuages.
     * @param {object} mood `values` d'une ambiance
     */
    setMood(mood) {
      if (!daylight) return;
      daylight.setSun(mood.sunAzimuth, mood.sunElevation);
      cloudSea.setLook(mood.sea, mood.skyBottom, daylight.direction);
    },

    /**
     * À appeler à chaque image, caméra à jour, avant le rendu.
     * @param {object} frame
     * @param {THREE.OrthographicCamera} frame.camera
     * @param {THREE.Vector3} frame.target point regardé (le personnage)
     * @param {number} frame.dt secondes depuis l'image précédente
     * @param {number} frame.viewArea surface de sol que couvre la vue (m²) : ne dépend que du zoom et de
     *   l'inclinaison, donc la densité d'herbe ne bouge pas pendant qu'on marche
     * @param {number} frame.viewRadius demi-diagonale de la zone de sol vue (m)
     * @param {boolean} frame.shadows vrai les images où la carte d'ombre est refaite : la lumière ne suit la
     *   vue que ces images-là, sinon les ombres glisseraient sur le sol
     */
    update({ camera, target, dt, viewArea, viewRadius, shadows }) {
      scatter.update(camera, FULL_DETAIL_AREA / viewArea);
      cloudShadows.update(dt);
      if (shadows) daylight.update(target, viewRadius + 14);
    },

    /** Ce qui est dessiné à cet instant par le semis, et la part de végétation fine affichée. */
    stats() {
      return { ...scatter.stats(), fraction: scatter.fraction };
    },

    dispose() {
      scatter.dispose();
      cloudShadows?.dispose();
      cloudSea?.dispose();
      daylight?.dispose();
      for (const mesh of ground.children) mesh.geometry.dispose();
      groundMaterial?.dispose();
      disposeObject(soil);
      disposeObject(bedrock);
      underside?.geometry.dispose(); // matériau partagé avec la roche
      group.clear();
    },
  };
}
