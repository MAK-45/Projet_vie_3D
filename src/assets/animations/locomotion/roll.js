// Roulade : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/roll",
  name: "Roulade",
  nameEn: "Roll",
  description: "Roulade avant au sol, pour esquiver ou franchir un obstacle.",
  tags: ["roulade", "rouler", "esquive", "acrobatie", "roll", "dodge", "tumble", "locomotion", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "mountain"],
  phases: {
    once: { label: "Une roulade", steps: [{ clip: "Roll", repeat: 1, hold: 0.5 }] },
  },
  moves: true,
  radius: 1.4,
});

export { setWind, tick } from "../../../engine/toon-material.js";
