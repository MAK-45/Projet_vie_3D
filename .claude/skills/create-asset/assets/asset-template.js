// <Nom> : <ce qu'on voit, en une phrase — les traits qui le font reconnaître>.
// Entièrement procédural, <n> draw calls.
//
// Modèle de module d'asset : copier vers src/assets/<catégorie>/<sous-catégorie>/<nom>.js, remplir, puis ajouter
// le module à src/assets/index.js. Exemple complet : src/assets/nature/trees/birch.js.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildTube, mergeGeometries } from "../../kit/geometry.js";
import { STONES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { numberParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

// Paramètres : toujours `seed`, puis les axes de la famille (saison, pierre, bois, modèle...), puis les réglages.
const params = {
  seed: seedParam("Change <ce que la graine change, visible de loin>."),
  stone: stoneParam("Type de pierre : couleur et grain."),
  size: numberParam("Taille", 1, 0.5, 2, "Hauteur de l'objet.", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "<catégorie>/<sous-catégorie>/<nom>", // = chemin du fichier sous src/assets/, sans .js
  name: "<Nom français>",
  nameEn: "<English name>",
  category: "<catégorie>", // clés de src/assets/taxonomy.js
  subcategory: "<sous-catégorie>",
  description: "<Une ou deux phrases : ce qu'on voit, ce qui varie.>",
  tags: [
    // français : précis → général, ce qui le distingue, ce qu'il sait faire, intérieur/extérieur
    // anglais : les mêmes
  ],
  biomes: [], // parmi `biomes` de src/assets/taxonomy.js
  version: 1,
  added: "<AAAA-MM-JJ>",
  units: "1 unité = 1 mètre ; l'origine est au sol, au centre de l'emprise",
  footprint: { radius: 1, height: 1 }, // encombrement réel aux réglages par défaut (npm run check le vérifie)
  animated: [], // ["wind"] si le matériau a un `sway`
  params,
  variants: variantsOf("stone", params.stone), // les formes montrées et mesurées dans le catalogue
};

/**
 * Crée <l'objet>.
 * @param {{seed?: number, stone?: string, size?: number}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.asset` décrit l'asset créé
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  // Un générateur par aspect : ajouter un détail plus tard ne rebat pas les cartes de la silhouette.
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const stone = STONES[p.stone];

  const parts = []; // géométries d'un même matériau, fusionnées en un seul maillage
  // ... construire les formes ici, en mètres, origine au sol ...
  parts.push(buildTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, p.size, 0)], () => 0.3 * shape.range(0.8, 1.2)));

  const group = new THREE.Group();
  group.name = meta.name;

  const mesh = new THREE.Mesh(
    mergeGeometries(parts),
    createToonMaterial({
      ramp: stone.ramp,
      ink: stone.ink,
      pattern: "speckle",
      seed: detail.int(0, 96),
      id: 10, // identifiant de contour : un par partie à cerner séparément (10, 11, 12...)
    }),
  );
  mesh.name = "body";
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  group.userData.asset = { id: meta.id, params: p };
  return group;
}
