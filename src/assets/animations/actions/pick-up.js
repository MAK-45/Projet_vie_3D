// Ramasser : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/actions/pick-up",
  name: "Ramasser",
  nameEn: "Pick up",
  description: "Se pencher pour prendre un objet posé sur une table ou un plan de travail, puis se redresser.",
  tags: ["ramasser", "prendre", "objet", "table", "pick up", "grab", "take", "action", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    once: { label: "Une fois", steps: [{ clip: "PickUp_Table", repeat: 1, hold: 0.6 }] },
  },
  radius: 0.6,
});

export { setWind, tick } from "../../../engine/toon-material.js";
