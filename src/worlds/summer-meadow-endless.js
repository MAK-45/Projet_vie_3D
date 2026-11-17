// Prairie d'été infinie : la même prairie que l'île (mêmes assets, mêmes règles, summer-meadow-rules.js), mais sans
// bord. Le monde est découpé en morceaux de 16 m (un morceau de sol de l'asset « Sol de prairie ») ; le contenu de
// chaque morceau est tiré de (graine, morceau), donc revenir sur ses pas redonne exactement le même pré. Les
// morceaux sont fabriqués un peu avant d'entrer dans le champ de la caméra, un par image au plus, et libérés quand
// ils en sont loin. Le coût d'une image reste celui de ce qui est à l'écran : mêmes couches instanciées, mêmes
// draw calls que l'île.
//
// Pas de mer de nuages ni de falaise : la caméra ne voit jamais assez loin pour trouver un bord (l'explorateur
// borne le zoom arrière et la vue rasante dans ce mode).

import * as THREE from "three";
import { disposeObject } from "../engine/toon-material.js";
import { createRng } from "../assets/kit/rng.js";
import * as meadowGround from "../assets/nature/terrain/meadow-ground.js";
import { createCloudShadows, createDaylight } from "./kit/sky.js";
import { StreamingScatter } from "./kit/streaming-scatter.js";
import { buildGroundPatch } from "./kit/terrain.js";
import {
  CELLS, createMeadowLayers, createPlacer, FULL_DETAIL_AREA, GROUND_GRAIN, MAX_CROWN, MAX_TREE_SPACING, meadowRules, SEASON, TAU, TILE,
} from "./summer-meadow-rules.js";

const HALF = TILE / 2;
const smoothstep = THREE.MathUtils.smoothstep;
/** Rayon (en morceaux) de la fenêtre où l'on cherche les morceaux vus : ±120 m autour du promeneur en isométrique,
 * ±272 m à la 3e personne (`around` donné), dont la vue porte à 250 m. */
const WINDOW = 7;
const WINDOW_AROUND = 17;
/** Débord des morceaux nécessaires tout de suite (m) : couronnes et ombres portées venues de hors champ. */
const NEED_MARGIN = 9;
/** Débord des morceaux préparés d'avance (m), un par image au plus. */
const PREFETCH_MARGIN = 20;
/** Débord au-delà duquel un morceau chargé est libéré (m) : plus large que la préparation, pour ne pas osciller. */
const KEEP_MARGIN = 36;
/**
 * Temps de calcul par image pour préparer d'avance (ms) : un morceau passe toujours, un suivant seulement s'il
 * tient encore dans ce temps (d'après la durée moyenne d'un morceau).
 */
const PREFETCH_BUDGET = 4;

const _frustum = new THREE.Frustum();
const _viewProjection = new THREE.Matrix4();
const _box = new THREE.Box3();

/** Clé numérique d'un morceau (pas de chaîne : rien à ramasser pour le ramasse-miettes). */
const keyOf = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);

/** Entier mélangé à partir de quelques entiers : graine d'un générateur propre à un morceau ou une case. */
function hash(...values) {
  let h = 0x811c9dc5;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 0x01000193);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    h ^= h >>> 12;
  }
  return (h >>> 0) % 2147483647;
}

/**
 * Crée une prairie d'été infinie (mêmes réglages que `createSummerMeadow`, sans taille ni diorama).
 * @param {object} [options]
 * @param {number} [options.seed]
 * @param {number} [options.relief]
 * @param {number} [options.trees]
 * @param {number} [options.rocks]
 * @param {number} [options.grass]
 * @param {number} [options.flowers]
 */
export function createEndlessMeadow({ seed = 1, relief = 1.8, trees: treeAmount = 1, rocks: rockAmount = 1, grass = 1, flowers: flowerAmount = 1 } = {}) {
  seed = THREE.MathUtils.clamp(Math.round(seed) || 0, 0, 9999);
  const rules = meadowRules({ seed, relief, trees: treeAmount, flowers: flowerAmount });
  const { RELIEF, heightAt } = rules;

  const group = new THREE.Group();
  group.name = "Prairie d'été (infinie)";
  const counts = { trees: 0, rocks: 0, tufts: 0, flowers: 0, lawns: 0, patches: 0 };

  // Matériau du sol : celui de l'asset « Sol de prairie », partagé par tous les morceaux.
  const sample = meadowGround.create({ seed, season: SEASON, finish: "pixel", tileX: 0, tileZ: 0, size: TILE, relief: RELIEF, dryness: 0.25 });
  const groundMaterial = sample.getObjectByName("ground").material;
  sample.getObjectByName("ground").geometry.dispose();
  disposeObject(sample.getObjectByName("skirt"));
  groundMaterial.uniforms.uSelfEdge.value = 4;
  groundMaterial.uniforms.uPattern.value.x = GROUND_GRAIN;
  const ground = new THREE.Group();
  ground.name = "ground";
  group.add(ground);

  const scatter = new StreamingScatter({ chunkSize: TILE, heightAt });
  const { species, boulders, slabs, lawns, tufts, tallTufts, flowers, moss, molehill } = createMeadowLayers((prototype, options) => scatter.addLayer(prototype, options));
  group.add(scatter.group);
  const place = createPlacer(heightAt);

  const daylight = createDaylight();
  // Les nuages dérivent dans un carré qui accompagne le promeneur.
  const cloudShadows = createCloudShadows(createRng(seed * 131 + 1), { bounds: { minX: -60, maxX: 60, minZ: -60, maxZ: 60 }, count: 8 });
  group.add(daylight.light, daylight.light.target, cloudShadows.group);

  // --- Arbres : tirés par case de 4 m, d'après (graine, case) seulement ----------------------------------------
  // Sur l'île, un arbre trop proche d'un arbre déjà posé est écarté, dans l'ordre de la carte. Sans bord, il n'y a
  // pas d'ordre : chaque candidat tire une priorité, et cède la place à tout candidat voisin plus prioritaire.
  // La décision ne dépend que des morceaux voisins, donc chaque morceau se fabrique seul.
  const TREE_CELLS = TILE / CELLS.tree;
  const candidateMemo = new Map();
  const treeMemo = new Map();
  const candidatesOf = (cx, cz) => {
    const key = keyOf(cx, cz);
    let list = candidateMemo.get(key);
    if (list) return list;
    list = [];
    for (let j = 0; j < TREE_CELLS; j++) {
      for (let i = 0; i < TREE_CELLS; i++) {
        const rng = createRng(hash(seed, 1, cx * TREE_CELLS + i, cz * TREE_CELLS + j));
        const x = cx * TILE - HALF + (i + rng.next()) * CELLS.tree;
        const z = cz * TILE - HALF + (j + rng.next()) * CELLS.tree;
        const roll = rng.next();
        const pick = rng.next();
        const model = rng.next();
        const size = rng.next();
        const yaw = rng.range(0, TAU);
        const priority = rng.next();
        const grove = rules.grove(x, z);
        if (roll > (0.015 + grove * 0.55) * treeAmount) continue;
        const name = rules.treeKind(x, z, grove, pick);
        const kind = species[name];
        const scale = THREE.MathUtils.lerp(kind.scale[0], kind.scale[1], size);
        list.push({ x, z, kind, name, scale, yaw, priority, layer: kind.layers[Math.floor(model * kind.layers.length)], crown: kind.crown * scale });
      }
    }
    candidateMemo.set(key, list);
    return list;
  };
  const treesOf = (cx, cz) => {
    const key = keyOf(cx, cz);
    let list = treeMemo.get(key);
    if (list) return list;
    const rivals = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) rivals.push(...candidatesOf(cx + dx, cz + dz));
    list = candidatesOf(cx, cz).filter((tree) =>
      !rivals.some((other) =>
        other !== tree && other.priority > tree.priority &&
        Math.hypot(other.x - tree.x, other.z - tree.z) < (other.kind.spacing + tree.kind.spacing) / 2),
    );
    treeMemo.set(key, list);
    return list;
  };
  if (MAX_TREE_SPACING > TILE) throw new Error("summer-meadow-endless : espacement des arbres plus grand qu'un morceau");

  // --- Un morceau ---------------------------------------------------------------------------------------------
  const loaded = new Map();

  const loadChunk = (cx, cz) => {
    const minX = cx * TILE - HALF;
    const minZ = cz * TILE - HALF;
    const maxX = minX + TILE;
    const maxZ = minZ + TILE;
    const inside = (x, z, margin) => x >= minX + margin && x < maxX - margin && z >= minZ + margin && z < maxZ - margin;
    const rng = createRng(hash(seed, 2, cx, cz));
    const detail = createRng(hash(seed, 3, cx, cz));
    const local = { trees: 0, rocks: 0, tufts: 0, flowers: 0, lawns: 0, patches: 0 };
    const colliders = [];
    scatter.beginChunk(minX, minZ);

    // Arbres du morceau ; ceux des voisins comptent pour l'ombre et l'écart des rochers.
    const own = treesOf(cx, cz);
    for (const tree of own) {
      place(tree.layer, tree.x, tree.z, { yaw: tree.yaw, scale: tree.scale, sink: 0.12 });
      colliders.push({ x: tree.x, z: tree.z, radius: tree.kind.trunk * tree.scale });
    }
    local.trees = own.length;
    const near = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const tree of treesOf(cx + dx, cz + dz)) {
          if (tree.x > minX - MAX_CROWN && tree.x < maxX + MAX_CROWN && tree.z > minZ - MAX_CROWN && tree.z < maxZ + MAX_CROWN) near.push(tree);
        }
      }
    }

    // Rochers : affleurements et roches isolées, gardés loin du bord du morceau pour ne pas gêner le voisin.
    const rocks = [];
    const addRock = (x, z, big) => {
      if (!inside(x, z, 3)) return;
      if (near.some((tree) => Math.hypot(tree.x - x, tree.z - z) < 1.6)) return;
      const yaw = rng.range(0, TAU);
      if (big || rng.chance(0.55)) {
        const model = big ? boulders[rng.int(0, 1)] : rng.pick(boulders);
        const scale = big ? rng.range(1.05, 1.5) : rng.range(0.6, 1.1);
        place(model.layer, x, z, { yaw, scale, sink: 0.06 * model.size * scale });
        const height = model.size * scale;
        rocks.push({ x, z, radius: height * 1.05 });
        if (height > 0.75) colliders.push({ x, z, radius: height * 0.55 });
      } else {
        const model = rng.pick(slabs);
        const scale = rng.range(0.7, 1.25);
        place(model.layer, x, z, { yaw, scale, sink: 0.02 });
        rocks.push({ x, z, radius: model.size * scale * 0.6 });
      }
    };
    // Autant d'affleurements et de roches qu'une île au mètre carré près, en moyenne.
    const outcrops = Math.floor((TILE * TILE / 1200) * rockAmount + rng.next());
    for (let n = 0; n < outcrops; n++) {
      let site = null;
      for (let t = 0; t < 3; t++) {
        const x = rng.range(minX + 4, maxX - 4);
        const z = rng.range(minZ + 4, maxZ - 4);
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
    const loners = Math.floor((TILE * TILE / 650) * rockAmount + rng.next());
    for (let n = 0; n < loners; n++) addRock(rng.range(minX, maxX), rng.range(minZ, maxZ), false);
    local.rocks = rocks.length;

    const openness = (x, z) => {
      let open = 2;
      for (const tree of near) open = Math.min(open, Math.hypot(tree.x - x, tree.z - z) / tree.crown);
      return open;
    };
    const onRock = (x, z, margin = 0) => rocks.some((rock) => Math.hypot(rock.x - x, rock.z - z) < rock.radius + margin);
    const { moisture } = rules;

    // Pelouses dans les creux humides.
    const lawnCells = Math.ceil(TILE / CELLS.lawn);
    for (let j = 0; j < lawnCells; j++) {
      for (let i = 0; i < lawnCells; i++) {
        const x = minX + (i + detail.next()) * CELLS.lawn;
        const z = minZ + (j + detail.next()) * CELLS.lawn;
        const roll = detail.next();
        const model = detail.next();
        const yaw = detail.range(0, TAU);
        const scale = detail.range(0.85, 1.15);
        if (!inside(x, z, 0) || onRock(x, z, 0.8) || openness(x, z) < 0.3) continue;
        if (roll > smoothstep(moisture(x, z), 0.42, 0.66) * 0.45 * grass) continue;
        place(lawns[Math.floor(model * lawns.length)], x, z, { yaw, scale, tilt: true });
        local.lawns += 1;
      }
    }

    // Touffes et hautes herbes.
    const tuftCells = TILE / CELLS.tuft;
    for (let j = 0; j < tuftCells; j++) {
      for (let i = 0; i < tuftCells; i++) {
        const x = minX + (i + detail.next()) * CELLS.tuft;
        const z = minZ + (j + detail.next()) * CELLS.tuft;
        const roll = detail.next();
        const tallRoll = detail.next();
        const model = detail.next();
        const yaw = detail.range(0, TAU);
        const scale = detail.range(0.75, 1.25);
        if (onRock(x, z, 0.15)) continue;
        const open = openness(x, z);
        if (open < 0.14) continue;
        if (roll > rules.tuftChance(x, z, open) * grass) continue;
        if (open >= 1.1 && tallRoll < smoothstep(rules.tallZone(x, z), 0.56, 0.7) * 0.75) {
          place(tallTufts[Math.floor(model * tallTufts.length)], x, z, { yaw, scale });
        } else {
          place(tufts[Math.floor(model * tufts.length)], x, z, { yaw, scale: scale * (open < 1 ? 0.8 : 1) });
        }
        local.tufts += 1;
      }
    }

    // Fleurs en nappes.
    const flowerCells = Math.ceil(TILE / CELLS.flower);
    for (let j = 0; j < flowerCells; j++) {
      for (let i = 0; i < flowerCells; i++) {
        const x = minX + (i + detail.next()) * CELLS.flower;
        const z = minZ + (j + detail.next()) * CELLS.flower;
        const roll = detail.next();
        const stray = detail.next();
        const yaw = detail.range(0, TAU);
        const scale = detail.range(0.85, 1.08);
        if (!inside(x, z, 0) || onRock(x, z, 0.2)) continue;
        if (openness(x, z) < 0.75) continue;
        const { best, bestValue } = rules.flowerAt(x, z, moisture(x, z), flowers);
        if (best && roll < (0.15 + smoothstep(bestValue, 0, 0.1) * 0.5) * Math.min(1.6, flowerAmount)) {
          place(best.layer, x, z, { yaw, scale });
          local.flowers += 1;
        } else if (stray < 0.01 * flowerAmount) {
          place(stray < 0.006 * flowerAmount ? flowers.daisy.layer : flowers.buttercup.layer, x, z, { yaw, scale: scale * 0.9 });
          local.flowers += 1;
        }
      }
    }

    // Mousse au pied des arbres du morceau (côté ombre) et contre ses rochers.
    for (const tree of own) {
      if (!detail.chance(0.6)) continue;
      const angle = Math.PI + detail.range(-0.9, 0.9);
      const distance = tree.kind.trunk * 1.2 + detail.range(0.3, 0.9);
      place(moss, tree.x + Math.sin(angle) * distance, tree.z + Math.cos(angle) * distance, { yaw: detail.range(0, TAU), scale: detail.range(0.7, 1.2), tilt: true });
      local.patches += 1;
    }
    for (const rock of rocks) {
      if (!detail.chance(0.3)) continue;
      const angle = detail.range(0, TAU);
      const x = rock.x + Math.cos(angle) * (rock.radius + 0.3);
      const z = rock.z + Math.sin(angle) * (rock.radius + 0.3);
      place(moss, x, z, { yaw: detail.range(0, TAU), scale: detail.range(0.5, 0.9), tilt: true });
      local.patches += 1;
    }

    // Taupinières : une colonie tous les 1 500 m² environ.
    if (detail.next() < (TILE * TILE) / 1500) {
      const colonyX = detail.range(minX + 3, maxX - 3);
      const colonyZ = detail.range(minZ + 3, maxZ - 3);
      const hills = detail.int(3, 6);
      for (let k = 0; k < hills; k++) {
        const angle = detail.range(0, TAU);
        const distance = detail.range(0.4, 3.2);
        const x = colonyX + Math.cos(angle) * distance;
        const z = colonyZ + Math.sin(angle) * distance;
        if (openness(x, z) < 1.1 || onRock(x, z, 0.4)) continue;
        place(molehill, x, z, { yaw: detail.range(0, TAU), scale: detail.range(0.7, 1.15), tilt: true });
        local.patches += 1;
      }
    }

    const scattered = scatter.endChunk(createRng(hash(seed, 4, cx, cz)));

    // Sol : le maillage de l'asset « Sol de prairie », sans jupe (les voisins le prolongent sans couture).
    const mesh = new THREE.Mesh(buildGroundPatch({ size: TILE, spacing: 0.5, origin: [cx * TILE, cz * TILE], height: heightAt }), groundMaterial);
    mesh.name = "ground";
    mesh.receiveShadow = true;
    mesh.position.set(cx * TILE, 0, cz * TILE);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    ground.add(mesh);

    for (const name in counts) counts[name] += local[name];
    loaded.set(keyOf(cx, cz), { cx, cz, scattered, mesh, colliders, counts: local });
  };

  const unloadChunk = (key, chunk) => {
    scatter.removeChunk(chunk.scattered);
    ground.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();
    for (const name in counts) counts[name] -= chunk.counts[name];
    loaded.delete(key);
  };

  /** Boîte d'un morceau, élargie de `margin` mètres. */
  const chunkBox = (cx, cz, margin) => {
    _box.min.set(cx * TILE - HALF - margin, -0.5, cz * TILE - HALF - margin);
    _box.max.set(cx * TILE + HALF + margin, RELIEF + 15, cz * TILE + HALF + margin);
    return _box;
  };

  let frameIndex = 0;
  /**
   * Disque autour du promeneur gardé prêt quelle que soit la direction de la vue (carré du rayon, en morceaux) :
   * en 3e personne, la caméra peut faire demi-tour d'un geste, et tout ce qui entrerait alors dans le champ
   * serait fabriqué d'un coup, en saccade. 0 : rien que le champ (vue isométrique).
   */
  let win = WINDOW;
  let ringSq = 0;
  const inRing = (dx, dz) => dx * dx + dz * dz <= ringSq;
  /** Fabrique ce que la caméra voit (tout de suite) ou va voir (d'avance, un peu par image) ; libère le reste. */
  const stream = (camera, target) => {
    _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_viewProjection);
    const tx = Math.round(target.x / TILE);
    const tz = Math.round(target.z / TILE);
    let bestKey = -1;
    let bestDistance = Infinity;
    let bestX = 0;
    let bestZ = 0;
    for (let dz = -win; dz <= win; dz++) {
      for (let dx = -win; dx <= win; dx++) {
        const cx = tx + dx;
        const cz = tz + dz;
        const key = keyOf(cx, cz);
        if (loaded.has(key)) continue;
        // Dans le champ : sans attendre, sinon il apparaîtrait au milieu de l'image ; sauf en 3e personne au-delà du
        // disque gardé prêt (`around`) : là, il est dans la brume et se prépare d'avance, sans saccade au demi-tour.
        if ((ringSq === 0 || inRing(dx, dz)) && _frustum.intersectsBox(chunkBox(cx, cz, NEED_MARGIN))) {
          loadChunk(cx, cz);
        } else if (inRing(dx, dz) || _frustum.intersectsBox(chunkBox(cx, cz, PREFETCH_MARGIN))) {
          const distance = dx * dx + dz * dz;
          if (distance < bestDistance) {
            bestDistance = distance;
            bestKey = key;
            bestX = cx;
            bestZ = cz;
          }
        }
      }
    }
    // Préparation d'avance : le plus proche d'abord, et d'autres tant que le budget de l'image le permet.
    if (bestKey >= 0) {
      const start = performance.now();
      timedLoad(bestX, bestZ);
      while (performance.now() - start + chunkTime < PREFETCH_BUDGET) {
        if (!loadNearestPending(tx, tz)) break;
      }
    }
    // Libération, de temps en temps : les morceaux loin du champ, et les arbres mémorisés loin du promeneur.
    if (frameIndex++ % 30 === 0) {
      for (const [key, chunk] of loaded) {
        const far = Math.abs(chunk.cx - tx) > win + 1 || Math.abs(chunk.cz - tz) > win + 1;
        const kept = inRing(chunk.cx - tx, chunk.cz - tz) || _frustum.intersectsBox(chunkBox(chunk.cx, chunk.cz, KEEP_MARGIN));
        if (far || !kept) unloadChunk(key, chunk);
      }
      for (const memo of [candidateMemo, treeMemo]) {
        for (const key of memo.keys()) {
          const cx = Math.floor(key / 65536) - 32768;
          const cz = (key % 65536) - 32768;
          if (Math.abs(cx - tx) > win + 3 || Math.abs(cz - tz) > win + 3) memo.delete(key);
        }
      }
    }
  };

  /** Prépare le morceau d'avance le plus proche qui manque encore ; faux s'il n'y en a plus. */
  const loadNearestPending = (tx, tz) => {
    let best = null;
    let bestDistance = Infinity;
    for (let dz = -win; dz <= win; dz++) {
      for (let dx = -win; dx <= win; dx++) {
        const distance = dx * dx + dz * dz;
        if (distance >= bestDistance || loaded.has(keyOf(tx + dx, tz + dz))) continue;
        if (inRing(dx, dz) || _frustum.intersectsBox(chunkBox(tx + dx, tz + dz, PREFETCH_MARGIN))) {
          best = [tx + dx, tz + dz];
          bestDistance = distance;
        }
      }
    }
    if (!best) return false;
    timedLoad(best[0], best[1]);
    return true;
  };

  /** Durée moyenne de fabrication d'un morceau (ms), pour savoir si un de plus tient dans l'image. */
  let chunkTime = 3;
  const timedLoad = (cx, cz) => {
    const start = performance.now();
    loadChunk(cx, cz);
    chunkTime += (performance.now() - start - chunkTime) * 0.2;
  };

  // --- Point de départ : près de l'origine, à l'écart des troncs et des rochers -----------------------------------
  for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) loadChunk(cx, cz);
  const nearbyColliders = (x, z, visit) => {
    const cx = Math.round(x / TILE);
    const cz = Math.round(z / TILE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = loaded.get(keyOf(cx + dx, cz + dz));
        if (chunk) for (const collider of chunk.colliders) visit(collider);
      }
    }
  };
  const spawn = new THREE.Vector3();
  search: for (let ring = 0; ring < 12; ring++) {
    for (let k = 0; k < Math.max(1, ring * 6); k++) {
      const angle = (k / Math.max(1, ring * 6)) * TAU;
      const x = Math.cos(angle) * ring * 2;
      const z = Math.sin(angle) * ring * 2;
      let free = true;
      nearbyColliders(x, z, (collider) => {
        if (Math.hypot(collider.x - x, collider.z - z) <= collider.radius + 2.5) free = false;
      });
      if (free) {
        spawn.set(x, 0, z);
        break search;
      }
    }
  }
  spawn.y = heightAt(spawn.x, spawn.z);

  let pushX = 0;
  let pushZ = 0;
  let pushRadius = 0;
  const push = (collider) => {
    const dx = pushX - collider.x;
    const dz = pushZ - collider.z;
    const reach = collider.radius + pushRadius;
    const distance = Math.hypot(dx, dz);
    if (distance < reach && distance > 1e-4) {
      pushX = collider.x + (dx / distance) * reach;
      pushZ = collider.z + (dz / distance) * reach;
    }
  };

  return {
    group,
    seed,
    size: "endless",
    endless: true,
    meters: Infinity,
    bounds: { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity },
    center: new THREE.Vector3(),
    spawn,
    counts,
    heightAt,

    /** Empêche de traverser les troncs et les gros rochers des morceaux chargés : corrige `position` (x, z). */
    collide(position, radius) {
      pushX = position.x;
      pushZ = position.z;
      pushRadius = radius;
      nearbyColliders(position.x, position.z, push);
      position.x = pushX;
      position.z = pushZ;
    },

    /** Position de l'astre (heure du jour). */
    setMood(mood) {
      daylight.setSun(mood.sunAzimuth, mood.sunElevation);
    },

    /** À appeler à chaque image, caméra à jour, avant le rendu (même contrat que l'île). */
    update({ camera, target, dt, viewArea, viewRadius, shadows, reach, shadowReach, shadowCenter, around = 0 }) {
      // Fenêtre de recherche plus large à la 3e personne ; le disque `around` y reste.
      win = around > 0 ? WINDOW_AROUND : WINDOW;
      ringSq = Math.min((around + HALF) / TILE, win) ** 2 * (around > 0 ? 1 : 0);
      stream(camera, target);
      scatter.update(camera, FULL_DETAIL_AREA / viewArea, { reach, shadowReach });
      cloudShadows.update(dt, target);
      if (shadows) daylight.update(shadowCenter ?? target, viewRadius + 14);
    },

    /** Ce qui est dessiné par le semis, la part de végétation fine affichée, les morceaux chargés et le temps moyen
     * de fabrication d'un morceau (ms). */
    stats() {
      return { ...scatter.stats(), fraction: scatter.fraction, chunks: loaded.size, chunkTime };
    },

    dispose() {
      for (const [key, chunk] of loaded) unloadChunk(key, chunk);
      scatter.dispose();
      cloudShadows.dispose();
      daylight.dispose();
      groundMaterial.dispose();
      group.clear();
    },
  };
}
