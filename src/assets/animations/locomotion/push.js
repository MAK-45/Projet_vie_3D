// Pousser : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/push",
  name: "Pousser",
  nameEn: "Push",
  description: "Pousser une lourde charge à deux mains, appuyé de tout son poids.",
  tags: ["pousser", "effort", "charge", "caisse", "push", "pushing", "heavy", "locomotion", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Push_Loop" }] },
  },
  moves: true,
  radius: 0.9,
});

export { setWind, tick } from "../../../engine/toon-material.js";
