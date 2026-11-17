// Interagir : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/actions/interact",
  name: "Interagir",
  nameEn: "Interact",
  description: "Tendre la main pour actionner quelque chose devant soi : levier, porte, bouton, objet magique.",
  tags: ["interagir", "actionner", "toucher", "bouton", "interact", "use", "press", "action", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    once: { label: "Une fois", steps: [{ clip: "Interact", repeat: 1, hold: 0.6 }] },
  },
  radius: 0.6,
});

export { setWind, tick } from "../../../engine/toon-material.js";
