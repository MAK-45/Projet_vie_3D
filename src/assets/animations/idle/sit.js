// S'asseoir : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/idle/sit",
  name: "S'asseoir",
  nameEn: "Sit",
  description: "S'asseoir, rester assis puis se relever. Le personnage s'assoit sur un siège invisible de 45 cm : poser une chaise, un banc ou une souche derrière lui.",
  tags: ["s'asseoir", "assis", "chaise", "banc", "sit", "sitting", "seat", "posture", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    sequence: { label: "Enchaînement", steps: [{ clip: "Sitting_Enter" }, { clip: "Sitting_Idle_Loop", repeat: 3 }, { clip: "Sitting_Talking_Loop", repeat: 1 }, { clip: "Sitting_Exit", repeat: 1, hold: 0.8 }] },
    enter: { label: "S'asseoir", steps: [{ clip: "Sitting_Enter", repeat: 1, hold: 0.8 }] },
    idle: { label: "Assis", steps: [{ clip: "Sitting_Idle_Loop" }] },
    talk: { label: "Assis, parle", steps: [{ clip: "Sitting_Talking_Loop" }] },
    exit: { label: "Se relever", steps: [{ clip: "Sitting_Exit", repeat: 1, hold: 0.8 }] },
  },
  radius: 0.6,
});

export { setWind, tick } from "../../../engine/toon-material.js";
