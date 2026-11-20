// Tomber : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/actions/death",
  name: "Tomber",
  nameEn: "Fall down",
  description: "Le personnage s'effondre en arrière et reste au sol : évanouissement, défaite, sommeil soudain.",
  tags: ["tomber", "s'effondrer", "mort", "évanouissement", "fall", "death", "collapse", "faint", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    once: { label: "Une fois", steps: [{ clip: "Death01", repeat: 1, hold: 1.6 }] },
  },
  radius: 1.0,
});

export { setWind, tick } from "../../../engine/toon-material.js";
