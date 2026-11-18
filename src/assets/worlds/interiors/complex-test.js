// Le Complexe, monde d'essai : les assets du Complexe déjà dessinés (lots 1 à 3 : ossature, lumière et réseaux,
// mobilier du Sas) assemblés en quatre pièces praticables — Sas, Archives, Atelier, tronçon de la Grande Galerie —
// pour juger le rendu d'ensemble avant le vrai monde du Complexe (lot 5). Ici, `create()` rend la maquette entière ;
// la visite (vue en coupe, portes qui s'ouvrent, lampes dans le noir) se fait dans l'explorateur.

import { COMPLEX_TEST_SIZES, createComplexTest } from "../../../worlds/complex-test.js";
import { resolveParams } from "../../kit/params.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Variantes des dalles (usées, fissurées, tachées), des murs (niches, conduits), des lampes faibles."),
  size: choiceParam("Pièces", Object.fromEntries(Object.entries(COMPLEX_TEST_SIZES).map(([id, s]) => [id, s.label])), "Le Sas seul, le Sas et les Archives, ou les quatre pièces (Sas, Archives, Atelier, Galerie).", "full"),
  furniture: numberParam("Mobilier", 1, 0, 2, "0 = pièces nues, 1 = meublées, 2 = encombrées.", { step: 0.5 }),
  lamps: numberParam("Lampes", 1, 0, 2, "0 = aucune (le noir), 1 = éclairage du plan, 2 = plus d'appliques.", { step: 0.5 }),
};

export const meta = {
  id: "worlds/interiors/complex-test",
  name: "Complexe (essai)",
  nameEn: "Ancient complex (test)",
  category: "worlds",
  subcategory: "interiors",
  description:
    "Monde d'essai du Complexe : les assets déjà dessinés (dalles, murs, piliers, portes, lampes, tuyaux, câbles, " +
    "bancs, casiers, pupitres, grilles, plaques) assemblés en quatre pièces praticables — le Sas, les Archives à " +
    "colonnade, l'Atelier et sa tranchée sous caillebotis, un tronçon de la Grande Galerie. Vue en coupe (les murs " +
    "entre le personnage et la caméra s'abaissent), portes qui s'ouvrent à l'approche, lampes qui éclairent le noir.",
  tags: [
    "monde", "carte", "intérieur", "le complexe", "complexe", "ancien-tech", "essai", "sas", "archives", "atelier",
    "galerie", "vue en coupe", "à explorer", "assemblage",
    "world", "map", "interior", "ancient complex", "ancient-tech", "test", "airlock", "workshop", "gallery", "cutaway",
    "explorable", "composition", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; sol en y = 0 (dessus des dalles) ; x vers l'est, z vers le sud ; le Sas est au sud (z de 0 à 6)",
  footprint: { radius: 36, height: 7 },
  animated: ["door", "glow"],
  pedestal: false,
  composite: true,
  experience: "explorer",
  params,
  variants: Object.entries(COMPLEX_TEST_SIZES).map(([id, size]) => ({ id, name: size.label, params: { size: id } })),
};

/**
 * Crée la maquette du Complexe d'essai.
 * @param {{seed?: number, size?: "sas"|"wing"|"full", furniture?: number, lamps?: number}} [given]
 * @returns {THREE.Group} `group.userData.world` : le monde (bounds, counts, collide...)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const world = createComplexTest({ ...p, diorama: true });
  world.group.userData.asset = { id: meta.id, params: p, counts: world.counts };
  world.group.userData.world = world;
  return world.group;
}

/** Libère la maquette. */
export function dispose(group) {
  group.userData.world?.dispose();
}
