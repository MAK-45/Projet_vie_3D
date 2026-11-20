// Sauter : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/jump",
  name: "Sauter",
  nameEn: "Jump",
  description: "Un saut sur place en trois temps : l'élan, la suspension en l'air, la réception.",
  tags: ["sauter", "saut", "bond", "élan", "jump", "leap", "landing", "locomotion", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "mountain"],
  phases: {
    sequence: { label: "Enchaînement", steps: [{ clip: "Jump_Start" }, { clip: "Jump_Loop", repeat: 1 }, { clip: "Jump_Land", repeat: 1, hold: 0.6 }] },
    start: { label: "Élan", steps: [{ clip: "Jump_Start", repeat: 1, hold: 0.6 }] },
    air: { label: "En l'air", steps: [{ clip: "Jump_Loop" }] },
    land: { label: "Réception", steps: [{ clip: "Jump_Land", repeat: 1, hold: 0.6 }] },
  },
  radius: 0.8,
});

export { setWind, tick } from "../../../engine/toon-material.js";
