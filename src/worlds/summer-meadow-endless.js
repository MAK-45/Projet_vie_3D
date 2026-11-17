// Prairie d'été sans bord : la même prairie que les îles (summer-meadow.js), avec les mêmes assets et les mêmes
// règles de pousse, mais qui n'a pas de bord. Elle se fabrique autour du promeneur, par morceaux carrés de 32 m,
// au fil de la marche, et oublie ce qu'il a laissé loin derrière lui.
//
// - Tout ce qu'un morceau contient se tire de (graine, position du morceau) : revenir sur ses pas redonne
//   exactement les mêmes arbres, rochers et fleurs, quel que soit le chemin pris.
// - Au loin, le pré ondule en collines (jusqu'à 13 m) et, à partir de soixante mètres du départ, se
//   soulève par endroits en montagnes de roche nue (jusqu'à 90 m) où les arbres se raréfient. Pas de brume :
//   ce qu'on voit au loin est le vrai terrain, où l'on peut aller.
// - Un morceau se fabrique en plusieurs petites étapes réparties sur plusieurs images (quelques millisecondes
//   par image) et n'apparaît qu'une fois fini, avant d'entrer dans la vue : rien ne pousse sous les yeux.
//
// 1 unité = 1 mètre ; départ en (0, 0), en plein pré.

import * as THREE from "three";
import { createToonMaterial, disposeObject } from "../engine/toon-material.js";
import { STONES } from "../assets/kit/palettes.js";
import { createNoise3, createRng } from "../assets/kit/rng.js";
import * as meadowGround from "../assets/nature/terrain/meadow-ground.js";
import { ScatterStream } from "./kit/scatter-stream.js";
import { createCloudShadows, createDaylight } from "./kit/sky.js";
import { buildGroundPatchSteps, groundNormal } from "./kit/terrain.js";
import { createMeadowModels, FULL_DETAIL_AREA, GROUND_GRAIN, SEASON, TILE } from "./summer-meadow-models.js";

const CHUNK = 32; // côté d'un morceau (m) : multiple des cases du semis (4 et 8 m) et du sol (16 m)
const TREE_CELL = 4;
const NEAR_DETAIL = 60; // en deçà (m, du centre du morceau au promeneur) : sol fin à 0,5 m ; au-delà : 1 m
const FAR_DETAIL = 76; // hystérésis : un morceau ne change de finesse qu'en franchissant l'écart
const REACH = 280; // morceaux examinés autour du promeneur (m)
const PRELOAD = 24; // marge autour de la vue : un morceau est prêt avant d'y entrer (m)
const SPARE = 40; // morceaux finis gardés hors de la vue (retour en arrière sans rien refaire)
const BUDGET_MS = 4 / (globalThis.__slow ?? 1); // SIM
const HILLS = 13; // hauteur des collines (m)
const PEAKS = 82; // hauteur des montagnes au-dessus de leur piémont (m)

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = THREE.MathUtils.smoothstep;
const clamp = THREE.MathUtils.clamp;
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _yaw = new THREE.Quaternion();
const _tilt = new THREE.Quaternion();
const _normal = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _viewProjection = new THREE.Matrix4();
const _box = new THREE.Box3();

/** Générateur propre à une case d'une grille (entiers) : la même case redonne toujours les mêmes tirages. */
function cellRng(seed, i, j, salt) {
  let h = (Math.imul(i, 0x8da6b343) ^ Math.imul(j, 0xd8163841) ^ Math.imul(seed * 131 + salt, 0xcb1ab31f)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return createRng((h ^ (h >>> 15)) >>> 0);
}

/**
 * Relief sans bord : les ondulations du pré (celles de l'asset « Sol de prairie »), des collines larges, et des
 * massifs de montagnes en crêtes, posés par un champ très lent et tenus à l'écart du départ.
 */
export function createEndlessRelief(seed, relief) {
  const meadow = meadowGround.groundHeight(seed, relief);
  const noise = createNoise3(seed * 53 + 19);
  const field = (x, z, wavelength, slot) => noise(x / wavelength + slot * 19.7, slot * 3.1 + 0.5, z / wavelength - slot * 7.3);
  const ridge = (x, z, wavelength, slot) => {
    const v = 1 - Math.abs(field(x, z, wavelength, slot) * 2 - 1);
    return v * v;
  };
  /** 0 en plaine, 1 au cœur d'un massif. */
  const mountains = (x, z) => {
    const distance = Math.hypot(x, z);
    if (distance < 60) return 0;
    const region = field(x, z, 760, 3) * 0.75 + field(x, z, 330, 4) * 0.25 + 0.05 * smoothstep(distance, 300, 900);
    return smoothstep(region, 0.56, 0.7) * smoothstep(distance, 60, 160);
  };
  const hills = (x, z) => {
    const t = clamp((field(x, z, 230, 1) * 0.7 + field(x, z, 97, 2) * 0.3 - 0.3) / 0.5, 0, 1);
    return HILLS * t * t * (3 - 2 * t);
  };
  const heightAt = (x, z) => {
    const mask = mountains(x, z);
    let h = meadow(x, z) * (1 - mask * 0.6) + hills(x, z);
    if (mask > 0) {
      const crest = ridge(x, z, 300, 5) * 0.55 + ridge(x, z, 130, 6) * 0.3 + ridge(x, z, 52, 7) * 0.15;
      // Des éboulis, des ressauts et des ravines : sans eux, une crête de bruit lisse fait une pyramide lisse.
      const crag = (field(x, z, 21, 8) - 0.5) * 7 + (field(x, z, 8.5, 9) - 0.5) * 2.6 + (field(x, z, 3.4, 10) - 0.5) * 0.9;
      const steep = Math.pow(crest, 1.5);
      h += mask * (6 + PEAKS * steep + crag * smoothstep(steep, 0.05, 0.35));
    }
    return h;
  };
  /**
   * Roche nue (plus de 0,5) : les pentes fortes et les sommets des massifs, avec un bord irrégulier.
   * @param {number} h hauteur du sol au point ; @param {number} slope pente (tangente)
   */
  const rockiness = (x, z, h, slope) => {
    const mask = mountains(x, z);
    if (mask < 0.02) return 0;
    const r = smoothstep(slope, 0.55, 0.95) + smoothstep(h, 50, 72) * 0.8 + (field(x, z, 6, 40) - 0.5) * 0.6;
    return r * smoothstep(mask, 0.02, 0.15);
  };
  return { heightAt, meadow, mountains, rockiness, field };
}

/**
 * Crée la prairie d'été sans bord.
 * @param {{seed?: number, relief?: number, trees?: number, rocks?: number, grass?: number, flowers?: number}} [options]
 *   mêmes réglages que les îles (summer-meadow.js), sauf la taille
 */
export function createEndlessMeadow({ seed = 1, relief = 1.8, trees: treeAmount = 1, rocks: rockAmount = 1, grass = 1, flowers: flowerAmount = 1 } = {}) {
  const RELIEF = clamp(relief, 0.2, 3);
  seed = clamp(Math.round(seed) || 0, 0, 9999);
  const terrain = createEndlessRelief(seed, RELIEF);
  const { heightAt, field } = terrain;
  const fbm = (x, z, wavelength, slot) => field(x, z, wavelength, slot) * 0.65 + field(x, z, wavelength / 2.7, slot + 50) * 0.35;
  const slopeAt = (x, z, e = 0.6) => Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);

  const group = new THREE.Group();
  group.name = "Prairie d'été (sans bord)";

  // --- Matériaux du sol : ceux de l'asset « Sol de prairie », et la roche des îles pour les montagnes ----------
  const sample = meadowGround.create({ seed, season: SEASON, finish: "pixel", size: TILE, relief: RELIEF, dryness: 0.25 });
  const groundMaterial = sample.getObjectByName("ground").material;
  sample.getObjectByName("ground").geometry.dispose();
  disposeObject(sample.getObjectByName("skirt"));
  groundMaterial.uniforms.uSelfEdge.value = 4; // le sol ne se cerne lui-même que sur un vrai décroché
  groundMaterial.uniforms.uPattern.value.x = GROUND_GRAIN;
  // Crans de lumière décalés vers les tons moyens : la face au soleil ne blanchit pas d'un seul aplat.
  const rockMaterial = createToonMaterial({ ramp: STONES.granite.ramp, ink: STONES.granite.ink, steps: [0.42, 0.66, 0.9], pattern: "speckle", patternParams: [10, 0.16, 0.22, 1], seed: 9, id: 13 });
  rockMaterial.uniforms.uSelfEdge.value = 4;
  const groundMaterials = [groundMaterial, rockMaterial];
  const groundGroup = new THREE.Group();
  groundGroup.name = "ground";
  group.add(groundGroup);

  // --- Semis --------------------------------------------------------------------------------------------------
  const stream = new ScatterStream();
  const { species, boulders, slabs, lawns, tufts, tallTufts, flowers, moss, molehill } = createMeadowModels(stream);
  group.add(stream.group);

  const place = (chunk, layer, x, z, { yaw = 0, scale = 1, tilt = false, sink = 0 } = {}) => {
    _position.set(x, heightAt(x, z) - sink, z);
    _yaw.setFromAxisAngle(UP, yaw);
    if (tilt) _tilt.setFromUnitVectors(UP, groundNormal(heightAt, x, z, _normal)).multiply(_yaw);
    else _tilt.copy(_yaw);
    chunk.add(layer, _matrix.compose(_position, _tilt, _scale.setScalar(scale)));
  };

  /** Pousse possible (0..1) : rien sur la roche, de moins en moins sur les pentes fortes et en altitude. */
  const growth = (x, z) => {
    const h = heightAt(x, z);
    const slope = slopeAt(x, z);
    if (terrain.rockiness(x, z, h, slope) > 0.5) return 0;
    return (1 - smoothstep(slope, 0.4, 0.75)) * (1 - smoothstep(h, 40, 62));
  };

  // --- Arbres : une candidate par case de 4 m, tirée de la case seule -----------------------------------------
  const candidates = new Map();
  /** Clé numérique d'une case de 4 m (sans chaîne créée à chaque appel : la règle de l'ombre en fait beaucoup). */
  const cellKey = (ci, cj) => (ci + 50000) * 100000 + (cj + 50000);
  const candidate = (ci, cj) => {
    const key = cellKey(ci, cj);
    let c = candidates.get(key);
    if (c !== undefined) return c;
    const rng = cellRng(seed, ci, cj, 1);
    const x = (ci + rng.next()) * TREE_CELL;
    const z = (cj + rng.next()) * TREE_CELL;
    const roll = rng.next();
    const pick = rng.next();
    const model = rng.next();
    const size = rng.next();
    const yaw = rng.range(0, TAU);
    const priority = rng.next();
    c = null;
    // Bosquets là où le champ est haut, grandes clairières ailleurs ; plus d'arbres : des bosquets plus étendus.
    const grove = smoothstep(fbm(x, z, 44, 1) + (treeAmount - 1) * 0.12, 0.5, 0.68);
    if (roll < (0.015 + grove * 0.55) * treeAmount) {
      const suit = growth(x, z);
      if (roll < (0.015 + grove * 0.55) * treeAmount * suit) {
        const essence = field(x, z, 75, 2);
        const name = grove > 0.2
          ? (essence < 0.4 ? "birch" : essence < 0.68 ? "oak" : "linden")
          : (pick < 0.55 ? "oak" : pick < 0.85 ? "linden" : "birch"); // arbres isolés : surtout de grands chênes
        const kind = species[name];
        // Près de la limite des arbres, ils rapetissent.
        const scale = THREE.MathUtils.lerp(kind.scale[0], kind.scale[1], size) * (0.8 + 0.2 * suit);
        c = { x, z, kind, name, scale, yaw, priority, layer: kind.layers[Math.floor(model * kind.layers.length)], crown: kind.crown * scale };
      }
    }
    candidates.set(key, c);
    return c;
  };
  const accepted = new Map();
  /** L'arbre de la case, s'il pousse : une candidate cède sa place à une voisine trop proche et prioritaire. */
  const treeAt = (ci, cj) => {
    const key = cellKey(ci, cj);
    let tree = accepted.get(key);
    if (tree !== undefined) return tree;
    tree = candidate(ci, cj);
    for (let dj = -2; tree && dj <= 2; dj++) {
      for (let di = -2; tree && di <= 2; di++) {
        if (di === 0 && dj === 0) continue;
        const other = candidate(ci + di, cj + dj);
        if (other && other.priority > tree.priority && Math.hypot(other.x - tree.x, other.z - tree.z) < (other.kind.spacing + tree.kind.spacing) / 2) tree = null;
      }
    }
    accepted.set(key, tree);
    return tree;
  };
  /** 0 au pied d'un tronc, 1 au bord de sa couronne, 2 en plein champ. */
  const openness = (x, z) => {
    let open = 2;
    const ci = Math.floor(x / TREE_CELL);
    const cj = Math.floor(z / TREE_CELL);
    for (let dj = -2; dj <= 2; dj++) {
      for (let di = -2; di <= 2; di++) {
        const tree = treeAt(ci + di, cj + dj);
        if (tree) open = Math.min(open, Math.hypot(tree.x - x, tree.z - z) / tree.crown);
      }
    }
    return open;
  };

  // --- Plan d'un morceau : ses arbres, ses rochers, ses obstacles (léger, gardé même quand le morceau est oublié)
  const plans = new Map();
  const planOf = (i, j) => {
    const key = `${i},${j}`;
    let plan = plans.get(key);
    if (plan) return plan;
    const x0 = i * CHUNK;
    const z0 = j * CHUNK;
    plan = { key, i, j, trees: [], rocks: [], colliders: [], x: x0 + CHUNK / 2, z: z0 + CHUNK / 2 };
    const cells = CHUNK / TREE_CELL;
    for (let cj = j * cells; cj < (j + 1) * cells; cj++) {
      for (let ci = i * cells; ci < (i + 1) * cells; ci++) {
        const tree = treeAt(ci, cj);
        if (!tree) continue;
        plan.trees.push(tree);
        plan.colliders.push({ x: tree.x, z: tree.z, radius: tree.kind.trunk * tree.scale });
      }
    }

    // Rochers : des affleurements (un gros bloc et sa suite), plus nombreux en montagne, et des roches isolées.
    const rng = cellRng(seed, i, j, 2);
    const ruggedness = terrain.mountains(plan.x, plan.z);
    const nearTree = (x, z, distance) => {
      const ci = Math.floor(x / TREE_CELL);
      const cj = Math.floor(z / TREE_CELL);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const tree = treeAt(ci + di, cj + dj);
          if (tree && Math.hypot(tree.x - x, tree.z - z) < distance) return true;
        }
      }
      return false;
    };
    const addRock = (x, z, big) => {
      const yaw = rng.range(0, TAU);
      const kind = rng.next();
      const pick = rng.next();
      const size = rng.next();
      if (x < x0 || x >= x0 + CHUNK || z < z0 || z >= z0 + CHUNK || nearTree(x, z, 1.6)) return;
      if (big || kind < 0.55) {
        const model = big ? boulders[Math.floor(pick * 2)] : boulders[Math.floor(pick * boulders.length)];
        const scale = big ? 1.05 + size * 0.45 : 0.6 + size * 0.5;
        const height = model.size * scale;
        plan.rocks.push({ x, z, yaw, scale, layer: model.layer, sink: 0.06 * height, tilt: false, radius: height * 1.05 });
        if (height > 0.75) plan.colliders.push({ x, z, radius: height * 0.55 });
      } else {
        const model = slabs[Math.floor(pick * slabs.length)];
        const scale = 0.7 + size * 0.55;
        plan.rocks.push({ x, z, yaw, scale, layer: model.layer, sink: 0.02, tilt: false, radius: model.size * scale * 0.6 });
      }
    };
    const outcrops = Math.floor(((CHUNK * CHUNK) / 1200) * rockAmount * (1 + ruggedness * 2.5) + rng.next());
    for (let n = 0; n < outcrops; n++) {
      // Les affleurements percent sur les hauteurs : on garde le plus haut de trois tirages.
      let site = null;
      for (let t = 0; t < 3; t++) {
        const x = x0 + rng.range(2, CHUNK - 2);
        const z = z0 + rng.range(2, CHUNK - 2);
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
    const loners = Math.floor(((CHUNK * CHUNK) / 650) * rockAmount * (1 + ruggedness * 1.5) + rng.next());
    for (let n = 0; n < loners; n++) addRock(x0 + rng.range(0, CHUNK), z0 + rng.range(0, CHUNK), false);
    plans.set(key, plan);
    return plan;
  };
  /** Les plans des morceaux qui touchent un point (le sien, et ses voisins s'il est près d'un bord). */
  const forPlansNear = (x, z, reach, visit) => {
    const i0 = Math.floor((x - reach) / CHUNK);
    const i1 = Math.floor((x + reach) / CHUNK);
    const j0 = Math.floor((z - reach) / CHUNK);
    const j1 = Math.floor((z + reach) / CHUNK);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) visit(planOf(i, j));
  };
  const onRock = (x, z, margin = 0) => {
    let hit = false;
    forPlansNear(x, z, 3.5, (plan) => {
      for (const rock of plan.rocks) if (!hit && Math.hypot(rock.x - x, rock.z - z) < rock.radius + margin) hit = true;
    });
    return hit;
  };
  /** Creux humides (1) et bosses sèches (0) du pré. */
  const moisture = (x, z) => (1 - terrain.meadow(x, z) / RELIEF) * 0.55 + field(x, z, 32, 6) * 0.45;

  // --- Fabrication d'un morceau, en petites étapes ----------------------------------------------------------
  /**
   * Le sol d'un morceau, d'un seul maillage (un draw call, deux avec la roche) : un sommet tous les 0,5 m près du
   * promeneur, tous les mètres au loin. En étapes : quelques rangées de sommets par étape.
   */
  function* buildGroundTile(chunk, detail) {
    const cx = (chunk.i + 0.5) * CHUNK;
    const cz = (chunk.j + 0.5) * CHUNK;
    const { geometry, rock } = yield* buildGroundPatchSteps({ size: CHUNK, spacing: detail === 0 ? 0.5 : 1, origin: [cx, cz], height: heightAt, rockiness: terrain.rockiness, edgeSpacing: 1 });
    const mesh = new THREE.Mesh(geometry, rock ? groundMaterials : groundMaterial);
    mesh.name = "ground";
    mesh.receiveShadow = true;
    mesh.position.set(cx, 0, cz);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }
  const setGround = (chunk, meshes) => {
    for (const mesh of chunk.ground) {
      groundGroup.remove(mesh);
      mesh.geometry.dispose();
    }
    chunk.ground = meshes;
    for (const mesh of meshes) groundGroup.add(mesh);
  };

  function* buildChunk(chunk) {
    const detail = chunk.wanted;
    const meshes = [yield* buildGroundTile(chunk, detail)];
    if (chunk.content) {
      setGround(chunk, meshes);
      chunk.detail = detail;
      return;
    }

    // Le plan des voisins sert aux règles (ombre des couronnes, rochers proches) : chacun sa propre étape.
    for (let j = chunk.j - 1; j <= chunk.j + 1; j++) {
      for (let i = chunk.i - 1; i <= chunk.i + 1; i++) {
        if (plans.has(`${i},${j}`)) continue;
        planOf(i, j);
        yield;
      }
    }
    const plan = planOf(chunk.i, chunk.j);
    const builder = stream.beginChunk(chunk.key);
    const counts = { trees: plan.trees.length, rocks: plan.rocks.length, tufts: 0, flowers: 0, lawns: 0, patches: 0 };
    for (const tree of plan.trees) place(builder, tree.layer, tree.x, tree.z, { yaw: tree.yaw, scale: tree.scale, sink: 0.12 });
    for (const rock of plan.rocks) place(builder, rock.layer, rock.x, rock.z, { yaw: rock.yaw, scale: rock.scale, sink: rock.sink });
    yield;

    const x0 = chunk.i * CHUNK;
    const z0 = chunk.j * CHUNK;
    const detailRng = cellRng(seed, chunk.i, chunk.j, 3);
    // Pousse possible, échantillonnée tous les 2 m sur le morceau (et un peu au-delà, pour les copies qui débordent).
    const GRID = 2;
    const span = CHUNK / GRID + 4;
    const suit = new Float32Array(span * span);
    const heights = new Float32Array(span * span);
    for (let gj = 0; gj < span; gj++) {
      for (let gi = 0; gi < span; gi++) {
        const x = x0 + (gi - 2) * GRID;
        const z = z0 + (gj - 2) * GRID;
        heights[gj * span + gi] = heightAt(x, z);
        suit[gj * span + gi] = growth(x, z);
      }
      if (gj % 5 === 4) yield;
    }
    const sampled = (grid) => (x, z) => {
      const u = clamp((x - x0) / GRID + 2, 0, span - 1.001);
      const v = clamp((z - z0) / GRID + 2, 0, span - 1.001);
      const gi = Math.floor(u);
      const gj = Math.floor(v);
      const fu = u - gi;
      const fv = v - gj;
      const a = grid[gj * span + gi] * (1 - fu) + grid[gj * span + gi + 1] * fu;
      const b = grid[(gj + 1) * span + gi] * (1 - fu) + grid[(gj + 1) * span + gi + 1] * fu;
      return a * (1 - fv) + b * fv;
    };
    const growthAt = sampled(suit);
    // Hauteur approchée (grille de 2 m), assez juste pour borner les cases du semis contre la vue.
    const sampledHeight = sampled(heights);
    /** Les cases d'une grille dont l'origine tombe dans le morceau : chacune appartient à un seul morceau. */
    const forCells = (size, visit) => {
      for (let cj = Math.ceil(z0 / size); cj * size < z0 + CHUNK; cj++) {
        for (let ci = Math.ceil(x0 / size); ci * size < x0 + CHUNK; ci++) visit(ci * size, cj * size);
      }
    };
    yield;

    // Pelouses : plaques d'herbe drue dans les creux humides, posées sur la pente.
    forCells(3, (cx, cz) => {
      const x = cx + detailRng.next() * 3;
      const z = cz + detailRng.next() * 3;
      const roll = detailRng.next();
      const model = detailRng.next();
      const yaw = detailRng.range(0, TAU);
      const scale = detailRng.range(0.85, 1.15);
      if (roll > smoothstep(moisture(x, z), 0.42, 0.66) * 0.45 * grass * growthAt(x, z)) return;
      if (onRock(x, z, 0.8) || openness(x, z) < 0.3) return;
      place(builder, lawns[Math.floor(model * lawns.length)], x, z, { yaw, scale, tilt: true });
      counts.lawns += 1;
    });
    yield;

    // Touffes d'herbe partout, plus ou moins serrées ; hautes herbes à épis en nappes dans les zones ouvertes.
    for (let slice = 0; slice < 8; slice++) {
      for (let cj = z0 + slice * (CHUNK / 8); cj < z0 + (slice + 1) * (CHUNK / 8); cj++) {
        for (let ci = x0; ci < x0 + CHUNK; ci++) {
          const x = ci + detailRng.next();
          const z = cj + detailRng.next();
          const roll = detailRng.next();
          const tallRoll = detailRng.next();
          const model = detailRng.next();
          const yaw = detailRng.range(0, TAU);
          const scale = detailRng.range(0.75, 1.25);
          const vigor = fbm(x, z, 11, 3) * 0.7 + field(x, z, 48, 4) * 0.3;
          let chance = (0.22 + smoothstep(vigor, 0.36, 0.62)) * growthAt(x, z);
          if (roll > chance * grass) continue;
          const open = openness(x, z);
          if (open < 0.14 || onRock(x, z, 0.15)) continue; // terre battue au pied des troncs
          if (open < 1) {
            chance *= 0.5; // à l'ombre des couronnes, l'herbe est plus rare et plus rase
            if (roll > chance * grass) continue;
          }
          const tallZone = fbm(x, z, 27, 5);
          if (open >= 1.1 && tallRoll < smoothstep(tallZone, 0.56, 0.7) * 0.75) {
            place(builder, tallTufts[Math.floor(model * tallTufts.length)], x, z, { yaw, scale });
          } else {
            place(builder, tufts[Math.floor(model * tufts.length)], x, z, { yaw, scale: scale * (open < 1 ? 0.8 : 1) });
          }
          counts.tufts += 1;
        }
      }
      yield;
    }

    // Fleurs : chaque espèce a ses nappes ; quelques fleurs égarées hors des nappes.
    const flowerSpread = (flowerAmount - 1) * 0.05;
    let flowerRows = 0;
    const flowerCell = (cx, cz) => {
      const x = cx + detailRng.next() * 1.3;
      const z = cz + detailRng.next() * 1.3;
      const roll = detailRng.next();
      const stray = detailRng.next();
      const yaw = detailRng.range(0, TAU);
      const scale = detailRng.range(0.85, 1.08);
      const suitHere = growthAt(x, z);
      if (suitHere < 0.05) return;
      const wet = moisture(x, z);
      let best = null;
      let bestValue = 0;
      for (const kind of Object.values(flowers)) {
        const value = fbm(x, z, kind.wavelength, kind.slot) + kind.bias(wet) - kind.threshold + flowerSpread;
        if (value > bestValue) {
          best = kind;
          bestValue = value;
        }
      }
      const inPatch = best && roll < (0.15 + smoothstep(bestValue, 0, 0.1) * 0.5) * Math.min(1.6, flowerAmount) * suitHere;
      const strayFlower = !inPatch && stray < 0.01 * flowerAmount * suitHere;
      if (!inPatch && !strayFlower) return;
      if (openness(x, z) < 0.75 || onRock(x, z, 0.2)) return; // les fleurs des champs veulent le soleil
      if (inPatch) place(builder, best.layer, x, z, { yaw, scale });
      else place(builder, stray < 0.006 * flowerAmount ? flowers.daisy.layer : flowers.buttercup.layer, x, z, { yaw, scale: scale * 0.9 });
      counts.flowers += 1;
    };
    for (let cj = Math.ceil(z0 / 1.3); cj * 1.3 < z0 + CHUNK; cj++) {
      for (let ci = Math.ceil(x0 / 1.3); ci * 1.3 < x0 + CHUNK; ci++) flowerCell(ci * 1.3, cj * 1.3);
      if (++flowerRows % 6 === 0) yield;
    }
    yield;

    // Mousse au pied des arbres, du côté à l'ombre, et contre les rochers ; taupinières par colonies.
    for (const tree of plan.trees) {
      if (!detailRng.chance(0.6)) continue;
      const angle = Math.PI + detailRng.range(-0.9, 0.9);
      const distance = tree.kind.trunk * 1.2 + detailRng.range(0.3, 0.9);
      place(builder, moss, tree.x + Math.sin(angle) * distance, tree.z + Math.cos(angle) * distance, { yaw: detailRng.range(0, TAU), scale: detailRng.range(0.7, 1.2), tilt: true });
      counts.patches += 1;
    }
    for (const rock of plan.rocks) {
      if (!detailRng.chance(0.3)) continue;
      const angle = detailRng.range(0, TAU);
      place(builder, moss, rock.x + Math.cos(angle) * (rock.radius + 0.3), rock.z + Math.sin(angle) * (rock.radius + 0.3), { yaw: detailRng.range(0, TAU), scale: detailRng.range(0.5, 0.9), tilt: true });
      counts.patches += 1;
    }
    const colonies = Math.floor((CHUNK * CHUNK) / 1500 + detailRng.next());
    for (let n = 0; n < colonies; n++) {
      const cx = x0 + detailRng.range(2, CHUNK - 2);
      const cz = z0 + detailRng.range(2, CHUNK - 2);
      const hills = detailRng.int(3, 6);
      for (let k = 0; k < hills; k++) {
        const angle = detailRng.range(0, TAU);
        const distance = detailRng.range(0.4, 3.2);
        const x = cx + Math.cos(angle) * distance;
        const z = cz + Math.sin(angle) * distance;
        const yaw = detailRng.range(0, TAU);
        const scale = detailRng.range(0.7, 1.15);
        if (growthAt(x, z) < 0.5 || openness(x, z) < 1.1 || onRock(x, z, 0.4)) continue;
        place(builder, molehill, x, z, { yaw, scale, tilt: true });
        counts.patches += 1;
      }
    }
    yield;

    // Tout apparaît d'un coup : le sol et ce qui pousse dessus.
    stream.commitChunk(builder, sampledHeight, cellRng(seed, chunk.i, chunk.j, 4), 1);
    setGround(chunk, meshes);
    chunk.detail = detail;
    chunk.content = true;
    chunk.counts = counts;
  }

  // --- Morceaux : lesquels faut-il, dans quel ordre, lesquels oublier ------------------------------------------
  const chunks = new Map(); // morceaux en cours ou finis
  const bounds = new Map(); // hauteurs basse et haute d'un morceau (échantillonnées), pour le tri contre la vue
  const boundsOf = (i, j) => {
    const key = `${i},${j}`;
    let b = bounds.get(key);
    if (b) return b;
    let low = Infinity;
    let high = -Infinity;
    for (let k = 0; k < 25; k++) {
      const h = heightAt((i + (k % 5) / 4) * CHUNK, (j + Math.floor(k / 5) / 4) * CHUNK);
      low = Math.min(low, h);
      high = Math.max(high, h);
    }
    // Entre deux échantillons, une crête peut dépasser : marge en montagne.
    const rugged = high - low > 6 ? 6 : 1;
    b = { low: low - rugged, high: high + rugged + 15 };
    bounds.set(key, b);
    return b;
  };
  const chunkBox = (i, j, margin, target) => {
    const b = boundsOf(i, j);
    target.min.set(i * CHUNK - margin, b.low, j * CHUNK - margin);
    target.max.set((i + 1) * CHUNK + margin, b.high, (j + 1) * CHUNK + margin);
    return target;
  };
  let clock = 0;
  let queue = [];
  const inView = []; // morceaux dans la vue qui n'étaient pas prêts au début de l'image
  const stats = { built: 0, buildMs: 0, pending: 0, missing: 0 };

  const cancel = (chunk) => {
    if (chunk.content) stream.removeChunk(chunk.key);
    setGround(chunk, []);
    chunks.delete(chunk.key);
  };

  /** Fait avancer les fabrications jusqu'à épuiser le temps donné (ou toutes, `limit` infini). */
  const work = (limit) => {
    const start = performance.now();
    while (queue.length > 0 && performance.now() - start < limit) {
      const chunk = queue[0];
      chunk.job ??= buildChunk(chunk);
      if (chunk.job.next().done) {
        chunk.job = null;
        queue.shift();
        stats.built += 1;
      }
    }
    stats.buildMs = performance.now() - start;
  };

  /**
   * Choisit les morceaux utiles pour cette vue et lance leur fabrication.
   * @param {THREE.Camera} camera
   * @param {THREE.Vector3} target le promeneur
   * @returns {boolean} vrai si un morceau qui est dans la vue n'est pas encore prêt
   */
  const plan = (camera, target) => {
    _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_viewProjection);
    const ti = Math.floor(target.x / CHUNK);
    const tj = Math.floor(target.z / CHUNK);
    const range = Math.ceil(REACH / CHUNK);
    const wanted = [];
    let missing = false;
    inView.length = 0;
    for (let j = tj - range; j <= tj + range; j++) {
      for (let i = ti - range; i <= ti + range; i++) {
        const cx = (i + 0.5) * CHUNK;
        const cz = (j + 0.5) * CHUNK;
        const distance = Math.hypot(cx - target.x, cz - target.z);
        if (distance > REACH) continue;
        const near = Math.abs(i - ti) <= 1 && Math.abs(j - tj) <= 1; // autour du promeneur, toujours
        if (!near && !_frustum.intersectsBox(chunkBox(i, j, PRELOAD, _box))) continue;
        const key = `${i},${j}`;
        let chunk = chunks.get(key);
        if (!chunk) {
          chunk = { key, i, j, ground: [], content: false, detail: -1, wanted: 0, job: null, seen: 0, counts: null };
          chunks.set(key, chunk);
        }
        chunk.seen = clock;
        chunk.distance = distance;
        const current = chunk.job ? chunk.wanted : chunk.detail;
        chunk.wanted = current === 0 ? (distance > FAR_DETAIL ? 1 : 0) : current === 1 ? (distance < NEAR_DETAIL ? 0 : 1) : distance < NEAR_DETAIL ? 0 : 1;
        if (!chunk.content && _frustum.intersectsBox(chunkBox(i, j, 0, _box))) {
          missing = true;
          inView.push(chunk);
        }
        if (!chunk.job && (!chunk.content || chunk.detail !== chunk.wanted)) wanted.push(chunk);
        else if (chunk.job) wanted.push(chunk);
      }
    }
    // Les plus proches d'abord ; ceux qui n'ont rien encore avant un simple changement de finesse du sol.
    wanted.sort((a, b) => (a.content - b.content) || (a.distance - b.distance));
    // Une fabrication commencée se finit avant d'en entamer une autre.
    const running = queue[0]?.job ? queue[0] : null;
    queue = running ? [running, ...wanted.filter((chunk) => chunk !== running)] : wanted;
    stats.pending = queue.length;

    // Oubli : les morceaux hors de la vue depuis le plus longtemps, au-delà d'une réserve.
    const idle = [...chunks.values()].filter((chunk) => chunk.seen !== clock && !chunk.job);
    if (idle.length > SPARE) {
      idle.sort((a, b) => a.seen - b.seen);
      for (const chunk of idle.slice(0, idle.length - SPARE)) cancel(chunk);
    }
    return missing;
  };

  /** Ménage des caches de plans et de candidats, loin derrière le promeneur. */
  const prune = (target) => {
    if (candidates.size < 60000 && plans.size < 3000) return;
    const far = (x, z) => Math.hypot(x - target.x, z - target.z) > REACH * 1.6;
    for (const [key, c] of candidates) if (c && far(c.x, c.z)) candidates.delete(key);
    for (const [key, tree] of accepted) if (tree && far(tree.x, tree.z)) accepted.delete(key);
    if (candidates.size > 60000) {
      candidates.clear();
      accepted.clear();
    }
    for (const [key, p] of plans) if (far(p.x, p.z) && !chunks.has(key)) plans.delete(key);
    for (const key of bounds.keys()) {
      const [i, j] = key.split(",").map(Number);
      if (far((i + 0.5) * CHUNK, (j + 0.5) * CHUNK)) bounds.delete(key);
    }
  };

  // --- Ciel : lumière et ombres de nuages qui suivent le promeneur ----------------------------------------------
  const daylight = createDaylight();
  const cloudShadows = createCloudShadows(createRng(seed * 131 + 1), { bounds: { minX: -75, maxX: 75, minZ: -75, maxZ: 75 }, count: 9 });
  group.add(daylight.light, daylight.light.target, cloudShadows.group);

  // --- Départ : en plein pré, près de l'origine, hors des couronnes et à l'écart des rochers --------------------
  const collidersAround = (x, z, visit) => forPlansNear(x, z, 4, (p) => p.colliders.forEach(visit));
  const treeTowardCamera = (x, z) => {
    for (let dj = -1; dj <= 6; dj++) {
      for (let di = -1; di <= 6; di++) {
        const tree = treeAt(Math.floor(x / TREE_CELL) + di, Math.floor(z / TREE_CELL) + dj);
        if (!tree) continue;
        const dx = tree.x - x;
        const dz = tree.z - z;
        const along = (dx + dz) * Math.SQRT1_2; // vers la caméra
        const across = Math.abs(dx - dz) * Math.SQRT1_2;
        if (along > -2 && along < 18 && across < tree.crown + 1) return true;
      }
    }
    return false;
  };
  const spawn = new THREE.Vector3();
  search: for (let ring = 0; ring < 40; ring++) {
    for (let k = 0; k < Math.max(1, ring * 6); k++) {
      const angle = (k / Math.max(1, ring * 6)) * TAU;
      const x = Math.cos(angle) * ring * 2;
      const z = Math.sin(angle) * ring * 2;
      // Hors des couronnes, et sans arbre entre lui et la caméra de départ (azimut 45° : du côté +x, +z) : en vue
      // isométrique, un arbre de 11 m cache ce qui est jusqu'à 16 m derrière lui.
      let free = openness(x, z) > 1.3 && growth(x, z) > 0.8 && !treeTowardCamera(x, z);
      collidersAround(x, z, (collider) => {
        if (Math.hypot(collider.x - x, collider.z - z) <= collider.radius + 2.5) free = false;
      });
      if (free) {
        spawn.set(x, 0, z);
        break search;
      }
    }
  }
  spawn.y = heightAt(spawn.x, spawn.z);

  /** Emprise « courante » : une fenêtre qui suit le promeneur (ce qui borne la vie d'ambiance). */
  const windowBounds = { minX: -400, maxX: 400, minZ: -400, maxZ: 400 };
  const lastTarget = new THREE.Vector3(Infinity, 0, 0);

  return {
    group,
    seed,
    size: "infinite",
    endless: true,
    meters: Infinity,
    bounds: windowBounds,
    center: new THREE.Vector3(0, 0, 0),
    spawn,
    heightAt,
    /** Nombres sur les morceaux finis en mémoire. */
    get counts() {
      const total = { trees: 0, rocks: 0, tufts: 0, flowers: 0, lawns: 0, patches: 0, chunks: 0 };
      for (const chunk of chunks.values()) {
        if (!chunk.counts) continue;
        total.chunks += 1;
        for (const name in chunk.counts) total[name] += chunk.counts[name];
      }
      return total;
    },

    /** Empêche de traverser les troncs et les gros rochers : corrige `position` (x, z). */
    collide(position, radius) {
      collidersAround(position.x, position.z, (collider) => {
        const dx = position.x - collider.x;
        const dz = position.z - collider.z;
        const reach = collider.radius + radius;
        const distance = Math.hypot(dx, dz);
        if (distance < reach && distance > 1e-4) {
          position.x = collider.x + (dx / distance) * reach;
          position.z = collider.z + (dz / distance) * reach;
        }
      });
    },

    /**
     * But de la balade automatique : un peu plus loin, à peu près droit devant, par le chemin le plus doux (la
     * balade contourne les montagnes plutôt que de les gravir).
     * @param {THREE.Vector3} from position du promeneur
     * @param {number} heading cap actuel (radians, 0 = +Z)
     */
    pickStrollTarget(from, heading) {
      const here = heightAt(from.x, from.z);
      let best = null;
      for (let k = 0; k < 9; k++) {
        const angle = heading + (Math.random() - 0.5) * 2.4;
        const distance = 14 + Math.random() * 22;
        const x = from.x + Math.sin(angle) * distance;
        const z = from.z + Math.cos(angle) * distance;
        const h = heightAt(x, z);
        const climb = Math.abs(h - here) / distance;
        const score = climb * 6 + terrain.mountains(x, z) * 2 + slopeAt(x, z) * 2 + Math.random() * 0.3;
        if (!best || score < best.score) best = { x, z, score };
      }
      return best;
    },

    setMood(mood) {
      daylight.setSun(mood.sunAzimuth, mood.sunElevation);
    },

    /** À appeler à chaque image, caméra à jour, avant le rendu (même contrat que les îles). */
    update({ camera, target, dt, viewArea, viewRadius, shadows }) {
      clock += 1;
      // Après un saut (départ, téléportation), ce qui est dans la vue se fabrique tout de suite.
      const jumped = target.distanceTo(lastTarget) > 24;
      lastTarget.copy(target);
      const missing = plan(camera, target);
      work(jumped ? Infinity : missing ? BUDGET_MS * 3 : BUDGET_MS);
      // Images où un morceau de la vue n'était pas prêt (après un saut, tout est fait d'un coup : ne compte pas).
      if (!jumped && inView.some((chunk) => !chunk.content)) stats.missing += 1;
      if (clock % 300 === 0) prune(target);
      windowBounds.minX = target.x - 400;
      windowBounds.maxX = target.x + 400;
      windowBounds.minZ = target.z - 400;
      windowBounds.maxZ = target.z + 400;

      stream.update(camera, FULL_DETAIL_AREA / viewArea);
      cloudShadows.follow(target.x, target.z);
      cloudShadows.update(dt);
      if (shadows) daylight.update(target, viewRadius + 14);
    },

    stats() {
      return { ...stream.stats(), fraction: stream.fraction, pending: stats.pending, buildMs: stats.buildMs, built: stats.built, missing: stats.missing };
    },

    dispose() {
      for (const chunk of [...chunks.values()]) cancel(chunk);
      stream.dispose();
      cloudShadows.dispose();
      daylight.dispose();
      groundMaterial.dispose();
      rockMaterial.dispose();
      group.clear();
    },
  };
}
