// Sprinter : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/sprint",
  name: "Sprinter",
  nameEn: "Sprint",
  description: "Course à pleine vitesse, bras qui pompent, corps penché en avant.",
  tags: ["sprinter", "sprint", "courir vite", "course", "déplacement", "run", "fast", "locomotion", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "mountain"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Sprint_Loop" }] },
  },
  moves: true,
  radius: 1.4,
});

export { setWind, tick } from "../../../engine/toon-material.js";
