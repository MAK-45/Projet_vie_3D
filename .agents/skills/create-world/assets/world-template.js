// MODÈLE — copier vers src/worlds/<nom>.js et remplir. Lire d'abord src/worlds/summer-meadow.js, le monde de
// référence, dont ce fichier reprend l'ossature.
//
// <Nom du monde> : <le lieu en une phrase, ce qui le fait reconnaître>. Entièrement procédural à partir d'une
// graine, assemblé à partir des assets de la bibliothèque. 1 unité = 1 mètre.

import * as THREE from "three";
import { createToonMaterial, disposeObject } from "../engine/toon-material.js";
import { GROUNDS, STONES } from "../assets/kit/palettes.js";
import { createNoise3, createRng } from "../assets/kit/rng.js";
// TODO importer les assets du lieu : import * as oak from "../assets/nature/trees/oak.js"; ...
import * as meadowGround from "../assets/nature/terrain/meadow-ground.js"; // TODO l'asset de sol du lieu
import { createCloudSea } from "./kit/cloud-sea.js";
import { ScatterField } from "./kit/scatter.js";
import { createCloudShadows, createDaylight } from "./kit/sky.js";
import { buildIslandBand, groundNormal } from "./kit/terrain.js";

export const WORLD_SIZES = {
  small: { label: "Petit", meters: 48 },
  medium: { label: "Moyen", meters: 96 },
  large: { label: "Grand", meters: 144 },
};

const TILE = 16; // côté d'un morceau de sol (m) : les tailles sont des multiples de 16
const GROUND_ID = 11; // identifiant de contour du sol : la végétation fine le reprend
const GROUND_GRAIN = 10; // cases du sol peint par mètre (16 clignote en vue inclinée)
/** Surface de sol vue (m²) jusqu'à laquelle toutes les herbes sont dessinées ; au-delà, elles s'éclaircissent. */
const FULL_DETAIL_AREA = 380;

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
 * @param {object} [options]
 * @param {number} [options.seed] 0 à 9999
 * @param {"small"|"medium"|"large"} [options.size]
 * @param {number} [options.relief] hauteur des ondulations (m)
 * @param {number} [options.trees] abondance de 0 à 2 — TODO une abondance par famille d'éléments du lieu
 * @param {boolean} [options.diorama] l'île seule, toutes copies dessinées, sans lumière ni ciel (fiche d'asset)
 */
export function createWorld({ seed = 1, size = "medium", relief = 1.8, trees: treeAmount = 1, diorama = false } = {}) {
  seed = THREE.MathUtils.clamp(Math.round(seed) || 0, 0, 9999);
  const meters = (WORLD_SIZES[size] ?? WORLD_SIZES.medium).meters;
  const tiles = meters / TILE;
  const firstTile = -Math.floor(tiles / 2);
  const min = (firstTile - 0.5) * TILE;
  const bounds = { minX: min, maxX: min + meters, minZ: min, maxZ: min + meters };
  const center = new THREE.Vector3(min + meters / 2, 0, min + meters / 2);
  const area = meters * meters;

  // Relief : UNE fonction de hauteur en coordonnées du monde, pour le sol, le semis et le promeneur.
  const heightAt = meadowGround.groundHeight(seed, relief);
  // Champs lisses 0..1 : `slot` distingue des champs indépendants (bosquets, essences, humidité, une fleur...).
  const noise = createNoise3(seed * 17 + 3);
  const field = (x, z, wavelength, slot) => noise(x / wavelength + slot * 19.7, slot * 3.1 + 0.5, z / wavelength - slot * 7.3);
  const fbm = (x, z, wavelength, slot) => field(x, z, wavelength, slot) * 0.65 + field(x, z, wavelength / 2.7, slot + 50) * 0.35;

  const group = new THREE.Group();
  group.name = "TODO nom du monde";
  const counts = {};

  // --- Sol : l'asset de sol tel quel, un morceau par case, un seul matériau partagé ------------------------------
  const ground = new THREE.Group();
  let groundMaterial = null;
  for (let j = 0; j < tiles; j++) {
    for (let i = 0; i < tiles; i++) {
      const tileX = firstTile + i;
      const tileZ = firstTile + j;
      const tile = meadowGround.create({ seed, tileX, tileZ, size: TILE, relief });
      const mesh = tile.getObjectByName("ground");
      disposeObject(tile.getObjectByName("skirt")); // la tranche de l'île la remplace
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
  groundMaterial.uniforms.uSelfEdge.value = 4; // pas de trait sombre sur chaque bosse en vue rasante
  groundMaterial.uniforms.uPattern.value.x = GROUND_GRAIN;
  group.add(ground);

  // Tranche de l'île : terre, puis roche.
  const soilBottom = (x, z) => -1.1 - field(x, z, 9, 30) * 0.9;
  const soil = new THREE.Mesh(
    buildIslandBand({ bounds, top: heightAt, bottom: soilBottom }),
    createToonMaterial({ ramp: GROUNDS.dirt.ramp, steps: [0.3, 0.5, 0.74], pattern: "speckle", id: 12 }),
  );
  const bedrock = new THREE.Mesh(
    buildIslandBand({ bounds, top: (x, z) => soilBottom(x, z) + 0.02, bottom: () => -9 }),
    createToonMaterial({ ramp: STONES.granite.ramp, ink: STONES.granite.ink, steps: [0.3, 0.5, 0.74], pattern: "speckle", id: 13 }),
  );
  group.add(soil, bedrock);

  // --- Semis -----------------------------------------------------------------------------------------------------
  const scatter = new ScatterField({ bounds, heightAt });
  const rng = createRng(seed * 9973 + 11);
  /** Couche de végétation fine : identifiant de contour du sol, éclaircie quand la vue s'élargit, sans ombre. */
  const addGroundCover = (prototype, { outlined = [], ...options } = {}) => {
    prototype.traverse((child) => {
      if (child.isMesh && !outlined.includes(child.name)) child.material.uniforms.uId.value = GROUND_ID;
    });
    return scatter.addLayer(prototype, { reach: "fine", thin: true, castShadow: false, ...options });
  };
  /** Pose une copie sur le sol. `tilt` : couchée sur la pente (plaques) ; `sink` : enfoncée (m). */
  const place = (layer, x, z, { yaw = 0, scale = 1, tilt = false, sink = 0 } = {}) => {
    _position.set(x, heightAt(x, z) - sink, z);
    _yaw.setFromAxisAngle(UP, yaw);
    if (tilt) _tilt.setFromUnitVectors(UP, groundNormal(heightAt, x, z, _normal)).multiply(_yaw);
    else _tilt.copy(_yaw);
    layer.add(_matrix.compose(_position, _tilt, _scale.setScalar(scale)));
  };
  const inside = (x, z, margin) =>
    x > bounds.minX + margin && x < bounds.maxX - margin && z > bounds.minZ + margin && z < bounds.maxZ - margin;

  /** Obstacles ronds { x, z, radius } : ce que le promeneur ne traverse pas. */
  const colliders = [];

  // TODO Grands éléments (arbres) : 2 modèles par essence, `reach: "tall"`.
  //   const layers = [3, 8].map((s) => scatter.addLayer(oak.create({ seed: s, height: 11, fullness: 0.75 }), { reach: "tall" }));
  //   Grille de cases de 4 m : dans chaque case, TIRER D'ABORD tous les nombres (position, tirages, rotation,
  //   taille), TESTER ENSUITE. Bosquets : smoothstep(fbm(x, z, 44, 1) + (treeAmount - 1) * 0.12, 0.5, 0.68).
  //   Distance minimale entre troncs. colliders.push({ x, z, radius }).
  counts.trees = 0;

  // TODO Éléments moyens (rochers, buissons) : `reach: "low"`, par sites plutôt qu'un par un.
  // TODO Végétation fine avec addGroundCover : herbes, fleurs en nappes (un champ de bruit par espèce),
  //   rares à l'ombre, absentes sur les rochers. Plaques au sol avec `tilt: true`.

  scatter.build(createRng(seed * 31 + 7));
  group.add(scatter.group);

  // --- Ciel : lumière, ombres de nuages, mer de nuages ----------------------------------------------------------
  let daylight = null;
  let cloudShadows = null;
  let cloudSea = null;
  if (diorama) {
    scatter.showAll();
  } else {
    daylight = createDaylight();
    cloudShadows = createCloudShadows(createRng(seed * 131 + 1), { bounds, count: Math.round(4 + area / 4000) });
    cloudSea = createCloudSea({ bounds, mistLevel: relief + 0.5 });
    group.add(daylight.light, daylight.light.target, cloudShadows.group, cloudSea.mesh);
  }

  // Point de départ : près du centre, à l'écart des obstacles.
  const spawn = new THREE.Vector3(center.x, 0, center.z);
  search: for (let ring = 0; ring < 12; ring++) {
    for (let k = 0; k < Math.max(1, ring * 6); k++) {
      const angle = (k / Math.max(1, ring * 6)) * TAU;
      const x = center.x + Math.cos(angle) * ring * 2;
      const z = center.z + Math.sin(angle) * ring * 2;
      if (colliders.every((c) => Math.hypot(c.x - x, c.z - z) > c.radius + 2.5)) {
        spawn.set(x, 0, z);
        break search;
      }
    }
  }
  spawn.y = heightAt(spawn.x, spawn.z);

  return {
    group, seed, size, meters, bounds, center, spawn, counts, heightAt,

    collide(position, radius) {
      for (const c of colliders) {
        const dx = position.x - c.x;
        const dz = position.z - c.z;
        const reach = c.radius + radius;
        const distance = Math.hypot(dx, dz);
        if (distance < reach && distance > 1e-4) {
          position.x = c.x + (dx / distance) * reach;
          position.z = c.z + (dz / distance) * reach;
        }
      }
      position.x = THREE.MathUtils.clamp(position.x, bounds.minX + 0.6, bounds.maxX - 0.6);
      position.z = THREE.MathUtils.clamp(position.z, bounds.minZ + 0.6, bounds.maxZ - 0.6);
    },

    /** Heure et météo (kit/atmosphere.js). */
    setMood(mood) {
      if (!daylight) return;
      daylight.setSun(mood.sunAzimuth, mood.sunElevation);
      cloudSea.setLook(mood.sea, mood.skyBottom, daylight.direction);
    },

    /** À chaque image, caméra à jour. La densité d'herbe ne dépend que du cadrage : rien ne clignote en marchant. */
    update({ camera, target, dt, viewArea, viewRadius, shadows }) {
      scatter.update(camera, FULL_DETAIL_AREA / viewArea);
      cloudShadows.update(dt);
      if (shadows) daylight.update(target, viewRadius + 14);
    },

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
      group.clear();
    },
  };
}
