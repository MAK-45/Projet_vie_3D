// Nager : animation de la bibliothèque UAL, jouée par le personnage choisi (kit/animation-asset.js).

import { animationAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = animationAsset({
  id: "animations/locomotion/swim",
  name: "Nager",
  nameEn: "Swim",
  description: "Brasse à la surface de l'eau, le corps à l'horizontale (l'origine est la surface de l'eau : le corps flotte juste dessous).",
  tags: ["nager", "nage", "brasse", "eau", "swim", "swimming", "water", "locomotion", "animation", "personnage", "character"],
  biomes: ["beach", "swamp"],
  phases: {
    loop: { label: "Boucle", steps: [{ clip: "Swim_Fwd_Loop" }] },
  },
  moves: true,
  radius: 1.2,
  height: 0.4,
  pedestal: false,
});

export { setWind, tick } from "../../../engine/toon-material.js";
