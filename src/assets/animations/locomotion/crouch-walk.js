// Avancer accroupi : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/crouch-walk",
  name: "Avancer accroupi",
  nameEn: "Crouch walk",
  description: "Pas lents et feutrés, genoux pliés : se faufiler sans être vu.",
  tags: ["accroupi", "furtif", "discrétion", "déplacement", "crouch", "sneak", "stealth", "locomotion", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "mountain", "cave", "interior"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Crouch_Fwd_Loop" }] },
  },
  moves: true,
  radius: 0.9,
  height: 1.2,
});

export { setWind, tick } from "../../../engine/toon-material.js";
