// Marche posée : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/walk-formal",
  name: "Marche posée",
  nameEn: "Formal walk",
  description: "Marche droite et mesurée, épaules tenues : pour une entrée solennelle ou une visite.",
  tags: ["marcher", "marche posée", "solennel", "déplacement", "walk", "formal walk", "locomotion", "cycle", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Walk_Formal_Loop" }] },
  },
  moves: true,
  radius: 0.9,
});

export { setWind, tick } from "../../../engine/toon-material.js";
