// MODÈLE — copier vers src/assets/worlds/<sous-catégorie>/<nom>.js : le monde rangé dans la bibliothèque comme
// un asset. Modèle rempli : src/assets/worlds/islands/summer-meadow.js.
//
// <Nom du monde> : un monde entier, assemblé à partir d'autres assets. `create()` rend l'île seule, immobile,
// comme une maquette ; le monde vivant se règle et se visite dans l'explorateur, que l'Atelier ouvre à la place
// de la visionneuse.

import { createWorld, WORLD_SIZES } from "../../../worlds/TODO-nom.js";
import { resolveParams } from "../../kit/params.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { setWind, tick } from "../../../engine/toon-material.js";

const amount = (label, description) => numberParam(label, 1, 0, 2, description, { step: 0.25 });

const params = {
  seed: seedParam("Graine du monde : TODO ce qu'elle change, visible de loin."),
  size: choiceParam("Taille", WORLD_SIZES, "Côté de l'île : petit 48 m, moyen 96 m, grand 144 m."),
  relief: numberParam("Relief", 1.8, 0.6, 3, "Hauteur des ondulations.", { step: 0.2, unit: "m" }),
  trees: amount("Arbres", "TODO ce que valent 0, 1 et 2."),
  // TODO une abondance par famille d'éléments du lieu
};

export const meta = {
  id: "worlds/TODO-sous-categorie/TODO-nom", // = chemin du fichier
  name: "TODO",
  nameEn: "TODO",
  category: "worlds",
  subcategory: "TODO", // clé de taxonomy.worlds.subcategories
  description: "TODO : le lieu, de quoi il est assemblé, ce que change la graine, ce qu'on règle.",
  tags: ["monde", "carte", "TODO", "à explorer", "extérieur", "world", "map", "TODO", "explorable", "outdoor", "procedural"],
  biomes: ["TODO"],
  version: 1,
  added: "TODO AAAA-MM-JJ",
  units: "1 unité = 1 mètre ; origine au centre de l'île (taille « petit »), au niveau le plus bas du sol.",
  footprint: { radius: 35, height: 15 }, // île de 48 m : demi-diagonale, hauteur du plus grand arbre
  animated: ["wind"],
  pedestal: false,
  composite: true, // assemblage d'assets : pas de budget d'objet, le poids se mesure dans l'explorateur
  experience: "explorer", // la fiche ouvre l'explorateur
  params,
  variants: Object.entries(WORLD_SIZES).map(([id, size]) => ({ id, name: `${size.label} — ${size.meters} m`, params: { size: id } })),
};

/** Crée l'île en maquette : toutes ses copies dessinées, sans lumière ni ciel. */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const world = createWorld({ ...p, diorama: true });
  world.group.userData.asset = { id: meta.id, params: p, counts: world.counts };
  world.group.userData.world = world;
  return world.group;
}

/** Libère l'île et tous les assets qu'elle a semés. */
export function dispose(group) {
  group.userData.world?.dispose();
}
