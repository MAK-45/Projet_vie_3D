// Épée : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/combat/sword",
  name: "Épée",
  nameEn: "Sword",
  description: "En garde, épée en main, puis une attaque en avant.",
  tags: ["épée", "lame", "attaque", "combat", "sword", "blade", "attack", "fight", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    sequence: { label: "Enchaînement", steps: [{ clip: "Sword_Idle", repeat: 2 }, { clip: "Sword_Attack", repeat: 1 }] },
    guard: { label: "En garde", steps: [{ clip: "Sword_Idle" }] },
    attack: { label: "Attaque", steps: [{ clip: "Sword_Attack", repeat: 1, hold: 0.4 }] },
  },
  moves: true,
  radius: 1.2,
});

export { setWind, tick } from "../../../engine/toon-material.js";
