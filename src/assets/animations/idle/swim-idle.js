// Faire du surplace : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/idle/swim-idle",
  name: "Faire du surplace",
  nameEn: "Tread water",
  description: "Dans l'eau jusqu'aux épaules, bras et jambes qui battent doucement pour rester à la surface. L'origine est la surface de l'eau : les jambes pendent dessous.",
  tags: ["nager", "surplace", "flotter", "eau", "swim", "tread water", "float", "water", "animation", "personnage", "character"],
  biomes: ["beach", "swamp"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Swim_Idle_Loop" }] },
  },
  radius: 0.7,
  height: 0.6,
  pedestal: false,
});

export { setWind, tick } from "../../../engine/toon-material.js";
