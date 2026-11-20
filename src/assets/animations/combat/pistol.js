// Pistolet : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/combat/pistol",
  name: "Pistolet",
  nameEn: "Pistol",
  description: "Arme de poing : en attente, viser haut, droit ou bas, tirer, recharger.",
  tags: ["pistolet", "viser", "tirer", "recharger", "pistol", "aim", "shoot", "reload", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "interior"],
  phases: {
    sequence: { label: "Enchaînement", steps: [{ clip: "Pistol_Idle_Loop", repeat: 1 }, { clip: "Pistol_Aim_Neutral", repeat: 1, hold: 0.6 }, { clip: "Pistol_Shoot", repeat: 2 }, { clip: "Pistol_Reload", repeat: 1 }] },
    idle: { label: "En attente", steps: [{ clip: "Pistol_Idle_Loop" }] },
    aimUp: { label: "Viser haut", steps: [{ clip: "Pistol_Aim_Up", repeat: 1, hold: 1 }] },
    aim: { label: "Viser droit", steps: [{ clip: "Pistol_Aim_Neutral", repeat: 1, hold: 1 }] },
    aimDown: { label: "Viser bas", steps: [{ clip: "Pistol_Aim_Down", repeat: 1, hold: 1 }] },
    shoot: { label: "Tirer", steps: [{ clip: "Pistol_Shoot" }] },
    reload: { label: "Recharger", steps: [{ clip: "Pistol_Reload", repeat: 1, hold: 0.4 }] },
  },
  radius: 0.7,
});

export { setWind, tick } from "../../../engine/toon-material.js";
