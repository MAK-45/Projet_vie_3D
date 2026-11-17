// Tenir une torche : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/idle/torch",
  name: "Tenir une torche",
  nameEn: "Hold a torch",
  description: "Debout, un bras levé qui tient une torche ou une lanterne pour éclairer devant soi.",
  tags: ["torche", "lanterne", "éclairer", "nuit", "torch", "lantern", "light", "posture", "animation", "personnage", "character"],
  biomes: ["cave", "forest", "village", "interior"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Idle_Torch_Loop" }] },
  },
  radius: 0.6,
});

export { setWind, tick } from "../../../engine/toon-material.js";
