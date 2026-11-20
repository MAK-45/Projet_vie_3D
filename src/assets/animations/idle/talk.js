// Parler : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/idle/talk",
  name: "Parler",
  nameEn: "Talk",
  description: "Debout, en pleine conversation : les mains accompagnent les mots.",
  tags: ["parler", "discuter", "conversation", "gestes", "talk", "talking", "chat", "posture", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Idle_Talking_Loop" }] },
  },
  radius: 0.6,
});

export { setWind, tick } from "../../../engine/toon-material.js";
