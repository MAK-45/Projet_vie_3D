// Prairie d'été : les modèles d'assets semés par le monde, communs aux cartes bornées (summer-meadow.js) et à la
// carte infinie (summer-meadow-endless.js). Chaque modèle devient une couche du semis (`ScatterField` ou
// `ScatterStream`, même `addLayer`) : peu de modèles, beaucoup de copies.

import * as flowerClump from "../assets/nature/plants/flower-clump.js";
import * as grassTuft from "../assets/nature/plants/grass-tuft.js";
import * as boulder from "../assets/nature/rocks/boulder.js";
import * as buriedRock from "../assets/nature/rocks/buried-rock.js";
import * as dirtMound from "../assets/nature/terrain/dirt-mound.js";
import * as lawn from "../assets/nature/terrain/lawn.js";
import * as mossPatch from "../assets/nature/terrain/moss-patch.js";
import * as birch from "../assets/nature/trees/birch.js";
import * as linden from "../assets/nature/trees/linden.js";
import * as oak from "../assets/nature/trees/oak.js";

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

/**
 * Couche de végétation fine posée sur le sol : ses matériaux prennent l'identifiant de contour du sol, sinon
 * chaque touffe et chaque tige serait cernée de sombre, et un pré de milliers de touffes deviendrait une
 * résille noire. `outlined` : noms des maillages qui gardent leur contour (pétales).
 */
function addGroundCover(scatter, prototype, { outlined = [], ...options } = {}) {
  prototype.traverse((child) => {
    if (child.isMesh && !outlined.includes(child.name)) child.material.uniforms.uId.value = GROUND_ID;
  });
  return scatter.addLayer(prototype, { reach: "fine", thin: true, castShadow: false, ...options });
}

/**
 * Déclare toutes les couches de la prairie, toujours dans le même ordre (l'ordre fixe l'arrondi de l'éclaircie
 * de chaque couche, donc l'image).
 * @param {{addLayer: Function}} scatter semis (`ScatterField` ou `ScatterStream`)
 */
export function createMeadowModels(scatter) {
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

  // Rochers : gros blocs (affleurements) et roches enterrées.
  const boulders = [
    { seed: 1, size: 1.3 },
    { seed: 4, size: 1.0, cover: "moss" },
    { seed: 7, size: 0.6, roughness: 0.5 },
  ].map((given) => ({ ...given, layer: scatter.addLayer(boulder.create({ stone: "granite", ...given }), { reach: "low" }) }));
  const slabs = [
    { seed: 2, size: 2.2 },
    { seed: 5, size: 1.4, cover: "moss" },
  ].map((given) => ({ ...given, layer: scatter.addLayer(buriedRock.create({ stone: "granite", ...given }), { reach: "low" }) }));

  // Pelouses : plaques d'herbe drue (la motte sombre est retirée : sur un pré, elle ferait des disques sombres).
  const lawns = [
    { cut: "wild", seed: 1, size: 2.8 },
    { cut: "wild", seed: 2, size: 2.2 },
    { cut: "long", seed: 3, size: 2.4 },
  ].map((given) => addGroundCover(scatter, lawn.create({ season: SEASON, shape: "patch", fullness: 0.5, ...given }), { skip: ["sod"] }));

  // Touffes d'herbe et hautes herbes à épis.
  const tufts = [1, 2, 3].map((tuftSeed) =>
    addGroundCover(scatter, grassTuft.create({ seed: tuftSeed, season: SEASON, kind: "meadow", height: 0.5, fullness: 0.6 })),
  );
  const tallTufts = [4, 5].map((tuftSeed) =>
    addGroundCover(scatter, grassTuft.create({ seed: tuftSeed, season: SEASON, kind: "tall", height: 0.42, fullness: 0.6 })),
  );

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
    kind.layer = addGroundCover(scatter, flowerClump.create({ seed: kind.slot, species: name, season: SEASON, count: kind.count }), { outlined: ["petals", "hearts"] });
  }

  // Mousse au pied des arbres et contre les rochers ; taupinières en plein pré.
  const moss = scatter.addLayer(mossPatch.create({ seed: 3, season: SEASON, size: 1.4, cushions: 7 }), { reach: "low", castShadow: false });
  const molehill = scatter.addLayer(dirtMound.create({ seed: 2, soil: "dirt", size: 0.75, height: 0.28 }), { reach: "low", castShadow: false });

  return { species, boulders, slabs, lawns, tufts, tallTufts, flowers, moss, molehill };
}
