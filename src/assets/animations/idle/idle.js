// Attendre : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/idle/idle",
  name: "Attendre",
  nameEn: "Idle",
  description: "Debout, au repos : respiration, léger balancement du poids d'une jambe sur l'autre.",
  tags: ["attendre", "debout", "repos", "respiration", "idle", "standing", "rest", "posture", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Idle_Loop" }] },
  },
  radius: 0.6,
});

export { setWind, tick } from "../../../engine/toon-material.js";
