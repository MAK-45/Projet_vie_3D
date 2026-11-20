// Le Complexe (docs/complexe/) : le monde intérieur ancien-technologique, assemblé pièce par pièce au fil des lots.
// Lot 5 : le Sas de Scellement et le vestibule d'où l'on arrive ; lot 8 : les Archives et leur mezzanine ; lot 11 :
// l'Atelier de l'Artisan. Ici,
// `create()` rend la maquette d'une pièce ; la visite (vue en coupe, Porte-Iris qui s'ouvre puis se scelle,
// vérification au pupitre, vague de glyphes, Archives, escalier à vis et mezzanine, Atelier) se fait dans l'explorateur.

import { COMPLEX_ROOMS, createAncientComplex, SAS_STATES } from "../../../worlds/ancient-complex.js";
import { resolveParams } from "../../kit/params.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Usure et variantes des dalles (trappe, fissure), place de la niche, leviers, lampe de veille, contenu de la malle."),
  room: choiceParam("Pièce", Object.fromEntries(Object.entries(COMPLEX_ROOMS).map(([id, r]) => [id, r.label])), "La pièce montrée (et celle où l'on commence la visite) : le Sas, les Archives ou l'Atelier ; la Galerie et les salles d'étude viendront."),
  state: choiceParam("État du Sas", SAS_STATES, "Vérification (on entre, l'Iris se scelle, le pupitre vérifie et la lueur gagne tout le Sas), éveillé (tout allumé) ou endormi (glyphes éteints, une lampe sur deux).", "awake"),
};

export const meta = {
  id: "worlds/interiors/ancient-complex",
  name: "Le Complexe",
  nameEn: "The Ancient Complex",
  category: "worlds",
  subcategory: "interiors",
  description:
    "Le lieu ancien-technologique, vu en coupe, une pièce à la fois. Le Sas de Scellement (10 × 6 × 5 m) et son " +
    "vestibule : Porte-Iris qui s'ouvre à l'approche puis se scelle derrière soi, pupitre de vérification dont la " +
    "lueur ambre gagne en vague glyphes, rainures et lampes jusqu'à la porte nord. Derrière elle, les Archives " +
    "(18 × 12 × 7 m) : rayonnages monumentaux à tiroirs et rouages, mezzanine en caillebotis à 3,4 m qu'on rejoint par " +
    "un escalier à vis, meuble-catalogue central au pupitre tournant, colonnes cannelées, tables de lecture, " +
    "échelles roulantes, vitrines, poussière dans la lumière des lampes. À l'est, l'Atelier de l'Artisan (12 × 10 × " +
    "5,5 m) : poutres rivetées, four à bobines à la lueur orange, portique roulant dont la caisse monte et descend, " +
    "palan sur poutre-rail, tour à métaux, établis, râtelier, table à calques, fûts et touret. Praticable par tous les " +
    "personnages, étages compris.",
  tags: [
    "monde", "carte", "intérieur", "le complexe", "complexe", "ancien-tech", "sas", "sas de scellement", "porte-iris",
    "vérification", "archives", "mezzanine", "escalier à vis", "catalogue", "glyphes", "vue en coupe", "à explorer",
    "atelier", "four", "portique",
    "assemblage", "scénario",
    "world", "map", "interior", "ancient complex", "ancient-tech", "airlock", "iris door", "verification",
    "archive room", "upper floor", "spiral staircase", "card catalogue", "glyphs", "cutaway", "explorable",
    "workshop", "furnace", "gantry crane",
    "composition", "procedural",
  ],
  biomes: ["interior"],
  version: 4,
  added: "2026-11-18",
  units:
    "1 unité = 1 mètre ; sol en y = 0 (dessus des dalles) ; x vers l'est, z vers le sud ; le Sas de z = 0 à 6, le " +
    "vestibule de z = 6 à 10, les Archives de z = −12 à 0 (x de −3 à 15), mezzanine à 3,4 m ; l'Atelier de x = 15 à 27 " +
    "(z de −12 à −2)",
  footprint: { radius: 29, height: 7.8 },
  animated: ["door", "glow"],
  pedestal: false,
  composite: true,
  experience: "explorer",
  params,
  variants: [
    ...Object.entries(SAS_STATES).map(([id, s]) => ({ id, name: `Le Sas : ${s.label.toLowerCase()}`, params: { state: id } })),
    { id: "archives", name: "Les Archives", params: { room: "archives" } },
    { id: "atelier", name: "L'Atelier", params: { room: "atelier" } },
  ],
};

/**
 * Crée la maquette du Complexe.
 * @param {{seed?: number, room?: "sas"|"archives"|"atelier", state?: "check"|"awake"|"asleep"}} [given]
 * @returns {THREE.Group} `group.userData.world` : le monde (bounds, counts, collide...)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const world = createAncientComplex({ ...p, diorama: true });
  world.group.userData.asset = { id: meta.id, params: p, counts: world.counts };
  world.group.userData.world = world;
  return world.group;
}

/** Libère la maquette. */
export function dispose(group) {
  group.userData.world?.dispose();
}
