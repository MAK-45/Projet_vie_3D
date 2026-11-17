// Coups de poing : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/combat/punch",
  name: "Coups de poing",
  nameEn: "Punches",
  description: "Garde haute, un direct du bras avant puis un crochet du bras arrière.",
  tags: ["poing", "boxe", "frapper", "combat", "punch", "jab", "cross", "fight", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    sequence: { label: "Enchaînement", steps: [{ clip: "Punch_Jab" }, { clip: "Punch_Cross" }] },
    jab: { label: "Direct", steps: [{ clip: "Punch_Jab" }] },
    cross: { label: "Crochet", steps: [{ clip: "Punch_Cross" }] },
  },
  radius: 0.7,
});

export { setWind, tick } from "../../../engine/toon-material.js";
