// Conduire : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/idle/drive",
  name: "Conduire",
  nameEn: "Drive",
  description: "Assis, les mains sur un volant invisible, qui tournent au rythme de la route.",
  tags: ["conduire", "volant", "voiture", "assis", "drive", "driving", "car", "vehicle", "animation", "personnage", "character"],
  biomes: ["village", "meadow"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Driving_Loop" }] },
  },
  radius: 0.6,
});

export { setWind, tick } from "../../../engine/toon-material.js";
