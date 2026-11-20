// Rester accroupi : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/idle/crouch",
  name: "Rester accroupi",
  nameEn: "Crouch idle",
  description: "Accroupi sur place, aux aguets ou en train d'observer le sol.",
  tags: ["accroupi", "aux aguets", "observer", "posture", "crouch", "crouching", "idle", "watch", "animation", "personnage", "character"],
  biomes: ["meadow", "forest", "village", "garden", "mountain", "cave"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Crouch_Idle_Loop" }] },
  },
  radius: 0.6,
  height: 1.2,
});

export { setWind, tick } from "../../../engine/toon-material.js";
