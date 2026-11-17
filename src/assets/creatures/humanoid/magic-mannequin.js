// Mannequin magique : la version humaine du blob Couveuse. Le corps du mannequin (même squelette, donc toutes les
// animations) dans la matière de lumière du blob — ses palettes, son liseré clair, ses courants, sa lumière de
// halo dans le noir — dont chaque partie ondule comme le blob sans perdre sa forme humaine (kit/humanoid.js,
// `magic-mannequin`). Sans visage, comme le mannequin.

import { characterAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = characterAsset({
  id: "creatures/humanoid/magic-mannequin",
  name: "Mannequin magique",
  nameEn: "Magic mannequin",
  description:
    "La version humaine du blob Couveuse : le corps lisse du mannequin fait de lumière de glace, liseré de clair, traversé " +
    "de courants, dont chaque partie ondule comme le blob tout en gardant sa forme humaine. Étincelles et poussières " +
    "de lumière autour de lui ; il éclaire le décor la nuit. Les neuf palettes du blob ; joue n'importe quelle " +
    "animation de la catégorie « Animations ».",
  tags: [
    "mannequin magique", "mannequin", "couveuse", "blob", "esprit", "lumière", "glace", "magie", "personnage", "humanoïde",
    "ondulation", "gelée", "lumineux", "magic mannequin", "spirit", "light", "ice", "magic", "glowing", "wobbly", "jelly", "character",
    "humanoid", "rigged", "animé", "animated",
  ],
  character: "magic-mannequin",
  variantsBy: "palette",
  version: 2,
});

export { setWind, tick } from "../../../engine/toon-material.js";
