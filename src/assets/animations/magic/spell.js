// Lancer un sort : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/magic/spell",
  name: "Lancer un sort",
  nameEn: "Cast a spell",
  description: "Lever la main, concentrer la magie, lancer le sort devant soi, puis relâcher. À marier avec un effet de magie (pixelfx).",
  tags: ["sort", "magie", "lancer", "incantation", "spell", "magic", "cast", "wizard", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    sequence: { label: "Enchaînement", steps: [{ clip: "Spell_Simple_Enter" }, { clip: "Spell_Simple_Idle_Loop", repeat: 1 }, { clip: "Spell_Simple_Shoot", repeat: 1 }, { clip: "Spell_Simple_Exit", repeat: 1, hold: 0.8 }] },
    enter: { label: "Préparer", steps: [{ clip: "Spell_Simple_Enter", repeat: 1, hold: 0.6 }] },
    idle: { label: "Concentrer", steps: [{ clip: "Spell_Simple_Idle_Loop" }] },
    shoot: { label: "Lancer", steps: [{ clip: "Spell_Simple_Shoot", repeat: 1, hold: 0.4 }] },
    exit: { label: "Relâcher", steps: [{ clip: "Spell_Simple_Exit", repeat: 1, hold: 0.6 }] },
  },
  radius: 0.7,
});

export { setWind, tick } from "../../../engine/toon-material.js";
