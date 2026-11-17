// Être touché : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/actions/hit",
  name: "Être touché",
  nameEn: "Get hit",
  description: "Le personnage encaisse un coup et vacille : à la poitrine ou à la tête.",
  tags: ["touché", "coup", "choc", "douleur", "hit", "hurt", "impact", "reaction", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    chest: { label: "À la poitrine", steps: [{ clip: "Hit_Chest", repeat: 1, hold: 0.8 }] },
    head: { label: "À la tête", steps: [{ clip: "Hit_Head", repeat: 1, hold: 0.8 }] },
  },
  radius: 0.6,
});

export { setWind, tick } from "../../../engine/toon-material.js";
