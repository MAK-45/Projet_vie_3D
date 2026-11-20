// Marcher : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/walk",
  name: "Marcher",
  nameEn: "Walk",
  description: "Marche tranquille, bras ballants : le pas de tous les jours.",
  tags: ["marcher", "marche", "pas", "déplacement", "walk", "walking", "locomotion", "cycle", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "mountain", "interior"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Walk_Loop" }] },
  },
  moves: true,
  radius: 0.9,
});

export { setWind, tick } from "../../../engine/toon-material.js";
