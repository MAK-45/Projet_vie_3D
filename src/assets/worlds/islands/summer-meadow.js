// Prairie d'été : un monde entier rangé dans la bibliothèque comme un asset. Il n'a pas de dessin propre : c'est
// un assemblage d'autres assets (sol de prairie, chêne, tilleul, bouleau, rochers, pelouse, touffes d'herbe,
// massifs de fleurs, mousse, terre), semés par une graine sur une île vallonnée. Ici, `create()` rend l'île seule,
// immobile, comme une maquette. Le monde vivant (lumière du jour, ombres de nuages, mer de nuages, heure, météo,
// promeneur) se règle et se visite dans l'explorateur, que l'Atelier ouvre à la place de la visionneuse.

import { createSummerMeadow, MEADOW_SIZES } from "../../../worlds/summer-meadow.js";
import { resolveParams } from "../../kit/params.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { setWind, tick } from "../../../engine/toon-material.js";

const amount = (label, description) => numberParam(label, 1, 0, 2, description, { step: 0.25 });

const params = {
  seed: seedParam("Graine du monde : relief, place des bosquets et des clairières, affleurements de rochers, nappes de fleurs."),
  size: choiceParam("Taille", MEADOW_SIZES, "Côté de l'île : petit 48 m, moyen 96 m, grand 144 m."),
  relief: numberParam("Relief", 1.8, 0.6, 3, "Hauteur des ondulations du pré.", { step: 0.2, unit: "m" }),
  trees: amount("Arbres", "Abondance des arbres : 0 = pré nu, 1 = prairie à bosquets, 2 = bois clair."),
  rocks: amount("Rochers", "Abondance des affleurements et des roches isolées."),
  grass: amount("Herbe", "Abondance des touffes, des hautes herbes et des pelouses."),
  flowers: amount("Fleurs", "Abondance et étendue des nappes de fleurs."),
};

export const meta = {
  id: "worlds/islands/summer-meadow",
  name: "Prairie d'été",
  nameEn: "Summer meadow",
  category: "worlds",
  subcategory: "islands",
  description:
    "Un monde entier : une île de prairie vallonnée qui flotte dans une mer de nuages, assemblée à partir des " +
    "assets de la bibliothèque (sol de prairie, arbres, rochers, herbes, fleurs). La graine change le relief, les " +
    "bosquets et les nappes de fleurs ; on règle sa taille et l'abondance de chaque élément, puis on s'y promène.",
  tags: [
    "monde", "carte", "île", "prairie", "plaine", "été", "pré", "bosquets", "mer de nuages", "assemblage", "à explorer",
    "extérieur",
    "world", "map", "island", "meadow", "plain", "summer", "groves", "sea of clouds", "composition", "explorable",
    "outdoor", "procedural",
  ],
  biomes: ["meadow", "forest"],
  version: 2,
  added: "2026-11-16",
  units:
    "1 unité = 1 mètre ; origine au centre de l'île (taille « petit »), au niveau le plus bas du pré. La tranche de " +
    "l'île descend sous l'origine : dans le monde vivant, elle plonge dans la mer de nuages.",
  footprint: { radius: 35, height: 15 },
  animated: ["wind"],
  pedestal: false, // l'île est son propre socle
  /** Asset composé d'autres assets : son poids est celui d'un monde, pas d'un objet (voir docs/WORLDS.md). */
  composite: true,
  /** Interface qui remplace la visionneuse dans la galerie. */
  experience: "explorer",
  params,
  variants: Object.entries(MEADOW_SIZES).map(([id, size]) => ({ id, name: `${size.label} — ${size.meters} m`, params: { size: id } })),
};

/**
 * Crée l'île en maquette : toutes ses copies dessinées, sans lumière ni ciel.
 * @param {{seed?: number, size?: "small"|"medium"|"large", relief?: number, trees?: number, rocks?: number, grass?: number, flowers?: number}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.world` donne `heightAt`, `bounds`, `counts`
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const world = createSummerMeadow({ ...p, diorama: true });
  world.group.userData.asset = { id: meta.id, params: p, counts: world.counts };
  world.group.userData.world = world;
  return world.group;
}

/** Libère l'île et tous les assets qu'elle a semés. */
export function dispose(group) {
  group.userData.world?.dispose();
}
