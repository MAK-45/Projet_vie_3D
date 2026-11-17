// Règles de la prairie d'été, partagées par l'île (summer-meadow.js) et la prairie infinie
// (summer-meadow-endless.js) : les modèles semés, où pousse quoi et pourquoi. Tout est calculé en coordonnées du
// monde à partir de la graine, donc une même graine donne les mêmes bosquets et les mêmes nappes de fleurs, que la
// prairie soit semée d'un bloc ou morceau par morceau.

import * as THREE from "three";
import { createNoise3 } from "../assets/kit/rng.js";
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
import { groundNormal } from "./kit/terrain.js";

export const TILE = 16; // côté d'un morceau de sol (m)
export const SEASON = "summer";
export const GROUND_ID = 11; // identifiant de contour du sol (celui de l'asset « Sol de prairie »)
/**
 * Grain du sol peint, en cases par mètre. L'asset en met 16 (un pixel d'art au zoom 1) ; en vue inclinée une case
 * fait alors moins d'un pixel de haut, et les points colorés (fleurs, grain) s'allument et s'éteignent dès que
 * la caméra tourne. À 10, chaque case couvre toujours plus d'un pixel.
 */
export const GROUND_GRAIN = 10;
/** Surface de pré vue (m²) jusqu'à laquelle toutes les herbes et fleurs sont dessinées ; au-delà, elles s'éclaircissent. */
export const FULL_DETAIL_AREA = 380;
/** Pas des grilles de semis (m) : arbres, pelouses, touffes, fleurs. */
export const CELLS = { tree: 4, lawn: 3, tuft: 1, flower: 1.3 };
/** Plus grand espacement entre deux arbres (m) : au-delà, deux arbres ne se gênent pas. */
export const MAX_TREE_SPACING = 7.5;
/** Plus grande couronne d'arbre (m, taille maximale comprise) : au-delà, un arbre ne fait plus d'ombre à l'herbe. */
export const MAX_CROWN = 5.6 * 1.18;

export const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const smoothstep = THREE.MathUtils.smoothstep;

/** Essences d'arbres : hauteur de l'asset, plage de taille des copies, espacement, couronne et tronc (m). */
const SPECIES = {
  oak: { module: oak, seeds: [3, 8], height: 11, scale: [0.82, 1.18], spacing: 7.5, crown: 5.6, trunk: 0.5 },
  linden: { module: linden, seeds: [2, 5], height: 12.5, scale: [0.8, 1.18], spacing: 6.5, crown: 4.4, trunk: 0.42 },
  birch: { module: birch, seeds: [1, 4], height: 9, scale: [0.8, 1.2], spacing: 3.4, crown: 3.2, trunk: 0.24 },
};

/**
 * Fleurs : chaque espèce a ses nappes. Coquelicots et bleuets sur le sec, boutons d'or dans les creux, marguerites
 * partout, lavande en coussins sur les bosses pierreuses.
 */
const FLOWERS = {
  daisy: { count: 5, bias: () => 0, threshold: 0.68, slot: 10, wavelength: 21 },
  poppy: { count: 5, bias: (wet) => (0.5 - wet) * 0.3, threshold: 0.69, slot: 11, wavelength: 25 },
  cornflower: { count: 5, bias: (wet) => (0.5 - wet) * 0.2, threshold: 0.7, slot: 12, wavelength: 19 },
  buttercup: { count: 6, bias: (wet) => (wet - 0.5) * 0.4, threshold: 0.7, slot: 13, wavelength: 17 },
  lavender: { count: 3, bias: (wet) => (0.5 - wet) * 0.45, threshold: 0.82, slot: 14, wavelength: 15 },
};

/**
 * Champs et règles de la prairie pour une graine et des réglages : relief, bosquets, humidité, vigueur de l'herbe,
 * nappes de fleurs. Fonctions pures de (x, z).
 */
export function meadowRules({ seed, relief, trees: treeAmount, flowers: flowerAmount }) {
  const RELIEF = THREE.MathUtils.clamp(relief, 0.2, 3);
  const heightAt = meadowGround.groundHeight(seed, RELIEF);
  const noise = createNoise3(seed * 17 + 3);
  /** Champ lisse 0..1 de longueur d'onde donnée ; `slot` distingue des champs indépendants. */
  const field = (x, z, wavelength, slot) => noise(x / wavelength + slot * 19.7, slot * 3.1 + 0.5, z / wavelength - slot * 7.3);
  const fbm = (x, z, wavelength, slot) => field(x, z, wavelength, slot) * 0.65 + field(x, z, wavelength / 2.7, slot + 50) * 0.35;
  const flowerSpread = (flowerAmount - 1) * 0.05; // plus de fleurs : des nappes plus larges, pas seulement plus serrées

  return {
    RELIEF,
    heightAt,
    field,
    fbm,
    /**
     * Bosquets (0..1) : les arbres se serrent là où le champ est haut, et laissent de grandes clairières ailleurs.
     * Plus d'arbres : des bosquets plus étendus, pas seulement plus serrés.
     */
    grove: (x, z) => smoothstep(fbm(x, z, 44, 1) + (treeAmount - 1) * 0.12, 0.5, 0.68),
    /** Essence d'un arbre ; les arbres isolés sont surtout de grands chênes. */
    treeKind(x, z, grove, pick) {
      if (grove > 0.2) {
        const essence = field(x, z, 75, 2);
        return essence < 0.4 ? "birch" : essence < 0.68 ? "oak" : "linden";
      }
      return pick < 0.55 ? "oak" : pick < 0.85 ? "linden" : "birch";
    },
    /** Creux humides (1) et bosses sèches (0). */
    moisture: (x, z) => (1 - heightAt(x, z) / RELIEF) * 0.55 + field(x, z, 32, 6) * 0.45,
    /** Chance qu'une touffe pousse (avant l'abondance d'herbe), selon l'ombre des couronnes (`open`). */
    tuftChance(x, z, open) {
      const vigor = fbm(x, z, 11, 3) * 0.7 + field(x, z, 48, 4) * 0.3;
      const chance = 0.22 + smoothstep(vigor, 0.36, 0.62);
      return open < 1 ? chance * 0.5 : chance; // à l'ombre des couronnes, l'herbe est plus rare et plus rase
    },
    /** Nappes de hautes herbes à épis (0..1). */
    tallZone: (x, z) => fbm(x, z, 27, 5),
    /** L'espèce de fleur la plus à sa place ici, et de combien elle dépasse son seuil. */
    flowerAt(x, z, wet, flowers) {
      let best = null;
      let bestValue = 0;
      for (const kind of Object.values(flowers)) {
        const value = fbm(x, z, kind.wavelength, kind.slot) + kind.bias(wet) - kind.threshold + flowerSpread;
        if (value > bestValue) {
          best = kind;
          bestValue = value;
        }
      }
      return { best, bestValue };
    },
  };
}

/**
 * Crée les modèles semés de la prairie, dans un ordre fixe, et les déclare comme couches d'un semis.
 * @param {(prototype: THREE.Group, options: object) => object} addLayer `addLayer` d'un semis (ScatterField ou
 *   StreamingScatter)
 */
export function createMeadowLayers(addLayer) {
  /**
   * Couche de végétation fine posée sur le sol : ses matériaux prennent l'identifiant de contour du sol, sinon
   * chaque touffe et chaque tige serait cernée de sombre, et un pré de milliers de touffes deviendrait une
   * résille noire. `outlined` : noms des maillages qui gardent leur contour (pétales).
   */
  const addGroundCover = (prototype, { outlined = [], ...options } = {}) => {
    prototype.traverse((child) => {
      if (child.isMesh && !outlined.includes(child.name)) child.material.uniforms.uId.value = GROUND_ID;
    });
    return addLayer(prototype, { reach: "fine", thin: true, castShadow: false, ...options });
  };

  // Arbres : quelques modèles par essence, chaque copie tournée et à une taille différente.
  const species = {};
  for (const [name, kind] of Object.entries(SPECIES)) {
    species[name] = {
      ...kind,
      layers: kind.seeds.map((treeSeed) =>
        addLayer(kind.module.create({ seed: treeSeed, season: SEASON, height: kind.height, fullness: 0.75 }), { reach: "tall" }),
      ),
    };
  }
  // Rochers : des affleurements (un gros bloc et sa suite) et des roches enterrées isolées.
  const boulders = [
    { seed: 1, size: 1.3 },
    { seed: 4, size: 1.0, cover: "moss" },
    { seed: 7, size: 0.6, roughness: 0.5 },
  ].map((given) => ({ ...given, layer: addLayer(boulder.create({ stone: "granite", ...given }), { reach: "low" }) }));
  const slabs = [
    { seed: 2, size: 2.2 },
    { seed: 5, size: 1.4, cover: "moss" },
  ].map((given) => ({ ...given, layer: addLayer(buriedRock.create({ stone: "granite", ...given }), { reach: "low" }) }));
  // Pelouses : plaques d'herbe drue dans les creux humides, posées sur la pente.
  const lawns = [
    { cut: "wild", seed: 1, size: 2.8 },
    { cut: "wild", seed: 2, size: 2.2 },
    { cut: "long", seed: 3, size: 2.4 },
  ].map((given) => addGroundCover(lawn.create({ season: SEASON, shape: "patch", fullness: 0.5, ...given }), { skip: ["sod"] }));
  // Touffes d'herbe partout ; hautes herbes à épis en nappes dans les zones ouvertes.
  const tufts = [1, 2, 3].map((tuftSeed) =>
    addGroundCover(grassTuft.create({ seed: tuftSeed, season: SEASON, kind: "meadow", height: 0.5, fullness: 0.6 })),
  );
  const tallTufts = [4, 5].map((tuftSeed) =>
    addGroundCover(grassTuft.create({ seed: tuftSeed, season: SEASON, kind: "tall", height: 0.42, fullness: 0.6 })),
  );
  const flowers = {};
  for (const [name, kind] of Object.entries(FLOWERS)) {
    flowers[name] = {
      ...kind,
      layer: addGroundCover(flowerClump.create({ seed: kind.slot, species: name, season: SEASON, count: kind.count }), { outlined: ["petals", "hearts"] }),
    };
  }
  // Mousse au pied des arbres et des rochers ; taupinières en plein pré.
  const moss = addLayer(mossPatch.create({ seed: 3, season: SEASON, size: 1.4, cushions: 7 }), { reach: "low", castShadow: false });
  const molehill = addLayer(dirtMound.create({ seed: 2, soil: "dirt", size: 0.75, height: 0.28 }), { reach: "low", castShadow: false });
  return { species, boulders, slabs, lawns, tufts, tallTufts, flowers, moss, molehill };
}

/**
 * Poseur de copies sur le sol.
 * @param {(x: number, z: number) => number} heightAt
 * @returns {(layer: object, x: number, z: number, options?: {yaw?: number, scale?: number, tilt?: boolean, sink?: number}) => void}
 *   `tilt` : couchée sur la pente (plaques au sol) ; `sink` : enfoncée (m)
 */
export function createPlacer(heightAt) {
  const position = new THREE.Vector3();
  const scaleVector = new THREE.Vector3();
  const yawQuaternion = new THREE.Quaternion();
  const tiltQuaternion = new THREE.Quaternion();
  const normal = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  return (layer, x, z, { yaw = 0, scale = 1, tilt = false, sink = 0 } = {}) => {
    position.set(x, heightAt(x, z) - sink, z);
    yawQuaternion.setFromAxisAngle(UP, yaw);
    if (tilt) tiltQuaternion.setFromUnitVectors(UP, groundNormal(heightAt, x, z, normal)).multiply(yawQuaternion);
    else tiltQuaternion.copy(yawQuaternion);
    layer.add(matrix.compose(position, tiltQuaternion, scaleVector.setScalar(scale)));
  };
}
