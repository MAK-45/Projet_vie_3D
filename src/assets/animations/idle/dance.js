// Danser : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/idle/dance",
  name: "Danser",
  nameEn: "Dance",
  description: "Une petite danse joyeuse sur place, en rythme.",
  tags: ["danser", "danse", "fête", "joie", "dance", "dancing", "party", "happy", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Dance_Loop" }] },
  },
  radius: 0.7,
});

export { setWind, tick } from "../../../engine/toon-material.js";
