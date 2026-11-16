// Sol de prairie : un grand morceau de terrain (12 m par défaut) qui se raccorde sans couture à ses voisins pour
// faire le sol d'une carte. Relief doux et taches (herbe grasse, herbe sèche, terre nue, fleurs) calculés en
// coordonnées du monde : le morceau (tileX, tileZ) d'une graine prolonge exactement le morceau (tileX + 1, tileZ).
// Aplats nets tramés (pixel art) ou dégradés lisses. 2 draw calls.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildTerrainChunk, mergeGeometries } from "../../kit/geometry.js";
import { MEADOW_GROUNDS } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3 } from "../../kit/rng.js";
import { choiceParam, numberParam, seasonParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const tileParam = (label, description) => ({ type: "int", default: 0, min: -500, max: 500, label, description });

const params = {
  seed: seedParam(
    "Graine du monde : relief et place des taches. Tous les morceaux d'une même carte prennent la même graine.",
  ),
  season: seasonParam("Vert franc en été, tendre et fleuri au printemps, blondi en automne, gris et enneigé l'hiver."),
  finish: choiceParam(
    "Rendu",
    { pixel: "Pixel art (aplats)", smooth: "Lisse (dégradés)" },
    "Aplats nets avec un grain de pixels et des bords de taches tramés, ou couleurs fondues en dégradés doux.",
  ),
  tileX: tileParam("Case X", "Colonne du morceau sur la carte : le morceau X + 1 se pose à X + Largeur mètres."),
  tileZ: tileParam("Case Z", "Rangée du morceau sur la carte."),
  size: numberParam("Largeur", 12, 4, 24, "Côté du morceau carré. Tous les morceaux d'une carte ont la même largeur.", {
    step: 1,
    unit: "m",
  }),
  relief: numberParam("Relief", 1.4, 0, 3, "Hauteur des ondulations du terrain.", { step: 0.1, unit: "m" }),
  dryness: numberParam("Sécheresse", 0.2, 0, 1, "Part d'herbe sèche et de terre nue."),
  preview: choiceParam(
    "Aperçu",
    { single: "Un morceau", grid: "4 morceaux raccordés" },
    "Un morceau seul, ou les 4 morceaux (X, Z) à (X + 1, Z + 1) posés côte à côte, pour voir le raccord.",
  ),
};

export const meta = {
  id: "nature/terrain/meadow-ground",
  name: "Sol de prairie",
  nameEn: "Meadow ground",
  category: "nature",
  subcategory: "terrain",
  description:
    "Grand morceau de sol de prairie qui se raccorde sans couture à ses voisins pour couvrir une carte : relief " +
    "doux, herbe grasse, herbe sèche, terre nue et fleurs semées, en aplats pixel art ou en dégradés lisses. " +
    "Quatre saisons.",
  tags: [
    "sol", "terrain", "prairie", "plaine", "herbe", "pré", "tuile", "raccordable", "sans couture", "carte",
    "relief", "saisons", "extérieur",
    "ground", "land", "meadow", "plain", "grass", "field", "tile", "tileable", "seamless", "map", "heightmap",
    "seasons", "outdoor", "procedural",
  ],
  biomes: ["meadow", "garden", "village", "forest"],
  version: 1,
  added: "2026-11-16",
  units:
    "1 unité = 1 mètre ; origine au centre du morceau, au niveau le plus bas du relief. Poser le morceau " +
    "(tileX, tileZ) à (tileX × size, 0, tileZ × size).",
  footprint: { radius: 8.5, height: 1.4 },
  animated: [],
  pedestal: false, // la visionneuse ne pose pas de socle : le morceau est lui-même un sol
  params,
  variants: [
    { id: "summer", name: "Été — pixel art", params: { season: "summer", finish: "pixel" } },
    { id: "summer-smooth", name: "Été — lisse", params: { season: "summer", finish: "smooth" } },
    { id: "spring", name: "Printemps", params: { season: "spring" } },
    { id: "autumn", name: "Automne", params: { season: "autumn" } },
    { id: "winter", name: "Hiver", params: { season: "winter" } },
  ],
};

/**
 * Hauteur du sol en un point du monde, pour une graine et un relief donnés. Exportée pour poser des objets sur
 * le terrain (arbres, rochers, créature) : `groundHeight(seed, relief)(X, Z)`.
 * @returns {(X: number, Z: number) => number} hauteur en mètres, de 0 à `relief`
 */
export function groundHeight(seed = 1, relief = 1.4) {
  const noise = createNoise3(seed * 31 + 7);
  return (X, Z) => {
    const broad = noise(X * 0.045, 0.5, Z * 0.045);
    const swell = noise(X * 0.12 + 40, 3.5, Z * 0.12 - 17);
    const bump = noise(X * 0.33 - 9, 6.5, Z * 0.33 + 5);
    const h = broad * 0.62 + swell * 0.28 + bump * 0.1;
    // Étire le bruit (surtout entre 0,3 et 0,7) vers 0..1, adouci : collines rondes, creux plats.
    const t = THREE.MathUtils.clamp((h - 0.28) / 0.44, 0, 1);
    return relief * t * t * (3 - 2 * t);
  };
}

/**
 * Crée un morceau de sol de prairie.
 * @param {{seed?: number, season?: string, finish?: "pixel"|"smooth", tileX?: number, tileZ?: number, size?: number,
 *   relief?: number, dryness?: number, preview?: "single"|"grid"}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const palette = MEADOW_GROUNDS[p.season];
  const height = groundHeight(p.seed, p.relief);
  const winter = p.season === "winter";

  // Morceaux à construire : (0, 0) seul, ou un carré 2 × 2 centré sur l'origine.
  const offsets = p.preview === "grid" ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]];
  const shift = p.preview === "grid" ? -0.5 : 0;
  const tops = [];
  const skirts = [];
  for (const [dx, dz] of offsets) {
    const origin = [(p.tileX + dx) * p.size, (p.tileZ + dz) * p.size];
    const { top, skirt } = buildTerrainChunk({ size: p.size, spacing: 0.5, origin, height, skirtBottom: -0.25 });
    const local = [(dx + shift) * p.size, 0, (dz + shift) * p.size];
    top.translate(...local);
    skirt.translate(...local);
    tops.push(top);
    skirts.push(skirt);
  }

  const dry = p.dryness;
  const topMaterial = createToonMaterial({
    ramp: palette.grass,
    steps: [0.62, 0.8, 0.935],
    pattern: "ground",
    patternParams: [16, 0.05, 0.055, 1],
    seed: p.seed % 97,
    id: 11,
    shadowLit: 0.7,
    ground: {
      smooth: p.finish === "smooth",
      driftScale: 0.03,
      fringe: 0.05,
      flowers: palette.flowers ?? undefined,
      flowerDensity: palette.flowerDensity,
      layers: [
        // Herbe grasse : grandes nappes sombres, qui reculent dans les zones sèches.
        { ramp: palette.lush, scale: 0.13, threshold: 0.56 + dry * 0.12, seed: 1, drift: -0.5 },
        // Herbe sèche : nappes blondes, plus nombreuses dans les grandes zones sèches.
        { ramp: palette.dry, scale: 0.11, threshold: 0.82 - dry * 0.24, seed: 2, drift: 0.4 },
        // Terre nue (neige l'hiver) : petites plaques.
        { ramp: palette.bare, scale: winter ? 0.16 : 0.42, threshold: winter ? 0.5 : 0.9 - dry * 0.14, seed: 3, drift: winter ? 0 : 0.3 },
      ],
    },
  });

  const group = new THREE.Group();
  group.name = meta.name;

  const top = new THREE.Mesh(tops.length > 1 ? mergeGeometries(tops) : tops[0], topMaterial);
  top.name = "ground";
  top.receiveShadow = true;
  group.add(top);

  const skirt = new THREE.Mesh(
    skirts.length > 1 ? mergeGeometries(skirts) : skirts[0],
    createToonMaterial({
      ramp: MEADOW_GROUNDS.skirt,
      steps: [0.3, 0.5, 0.74],
      pattern: "speckle",
      patternParams: [16, 0.08, 0.2, 1],
      seed: 5,
      id: 12,
    }),
  );
  skirt.name = "skirt";
  skirt.receiveShadow = true;
  group.add(skirt);

  group.userData.asset = { id: meta.id, params: p };
  return group;
}
