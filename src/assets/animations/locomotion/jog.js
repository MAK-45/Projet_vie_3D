// Trottiner : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/jog",
  name: "Trottiner",
  nameEn: "Jog",
  description: "Petite course régulière, buste droit, foulées souples : le rythme d'un footing ou d'une course pressée.",
  tags: ["trottiner", "courir", "course", "déplacement", "jog", "jogging", "run", "locomotion", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "mountain"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Jog_Fwd_Loop" }] },
  },
  moves: true,
  radius: 1.2,
});

export { setWind, tick } from "../../../engine/toon-material.js";
