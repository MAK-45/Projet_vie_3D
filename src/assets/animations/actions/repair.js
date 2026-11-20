// Réparer à genoux : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/actions/repair",
  name: "Réparer à genoux",
  nameEn: "Repair kneeling",
  description: "À genoux, les mains au ras du sol : réparer, construire, planter, fouiller.",
  tags: ["réparer", "construire", "bricoler", "à genoux", "jardiner", "repair", "build", "kneel", "fix", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Fixing_Kneeling" }] },
  },
  radius: 0.7,
});

export { setWind, tick } from "../../../engine/toon-material.js";
