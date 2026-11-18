// Le Complexe (docs/complexe/) : le monde intérieur ancien-technologique, assemblé pièce par pièce au fil des lots.
// Lot 5 : le Sas de Scellement et le vestibule d'où l'on arrive. Ici, `create()` rend la maquette (le Sas éveillé) ;
// la visite (vue en coupe, Porte-Iris qui s'ouvre puis se scelle, vérification au pupitre, vague de glyphes) se fait
// dans l'explorateur.

import { COMPLEX_ROOMS, createAncientComplex, SAS_STATES } from "../../../worlds/ancient-complex.js";
import { resolveParams } from "../../kit/params.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Usure et variantes des dalles (trappe, fissure), place de la niche, leviers, lampe de veille, contenu de la malle."),
  room: choiceParam("Pièce", Object.fromEntries(Object.entries(COMPLEX_ROOMS).map(([id, r]) => [id, r.label])), "La pièce montrée (le Sas pour l'instant ; les Archives, l'Atelier et les salles d'étude viendront)."),
  state: choiceParam("État du Sas", SAS_STATES, "Vérification (on entre, l'Iris se scelle, le pupitre vérifie et la lueur gagne tout le Sas), éveillé (tout allumé) ou endormi (glyphes éteints, une lampe sur deux).", "awake"),
};

export const meta = {
  id: "worlds/interiors/ancient-complex",
  name: "Le Complexe",
  nameEn: "The Ancient Complex",
  category: "worlds",
  subcategory: "interiors",
  description:
    "Le lieu ancien-technologique, vu en coupe : pour l'instant le Sas de Scellement (10 × 6 × 5 m) et son vestibule. " +
    "Porte-Iris au sud, qui s'ouvre à l'approche puis se scelle derrière soi ; pupitre de vérification à l'ouest : " +
    "ses leviers basculent, et la lueur ambre part de lui en vague (glyphes des murs, rainures du sol en chevrons, " +
    "lampes) jusqu'à la porte nord, qui se déverrouille. Casiers, bancs, malles, file d'attente à chaînes, poussière " +
    "dans la lumière des lampes. Praticable par tous les personnages.",
  tags: [
    "monde", "carte", "intérieur", "le complexe", "complexe", "ancien-tech", "sas", "sas de scellement", "porte-iris",
    "vérification", "glyphes", "vue en coupe", "à explorer", "assemblage", "scénario",
    "world", "map", "interior", "ancient complex", "ancient-tech", "airlock", "iris door", "verification", "glyphs",
    "cutaway", "explorable", "composition", "procedural",
  ],
  biomes: ["interior"],
  version: 2,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; sol en y = 0 (dessus des dalles) ; x vers l'est, z vers le sud ; le Sas de z = 0 à 6, le vestibule de z = 6 à 10",
  footprint: { radius: 8, height: 5 },
  animated: ["door", "glow"],
  pedestal: false,
  composite: true,
  experience: "explorer",
  params,
  variants: Object.entries(SAS_STATES).map(([id, s]) => ({ id, name: s.label, params: { state: id } })),
};

/**
 * Crée la maquette du Complexe.
 * @param {{seed?: number, room?: "sas", state?: "check"|"awake"|"asleep"}} [given]
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
