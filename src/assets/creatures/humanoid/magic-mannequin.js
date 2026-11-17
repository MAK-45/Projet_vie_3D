// Mannequin magique : la version humaine du blob Couveuse. Le corps du mannequin (même squelette, donc toutes les
// animations) dans la matière de lumière du blob — ses palettes, son liseré clair, ses courants, sa lumière de
// halo dans le noir — avec ses yeux sombres qui clignent sur un visage lisse (kit/humanoid.js, `magic-mannequin`).

import { characterAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = characterAsset({
  id: "creatures/humanoid/magic-mannequin",
  name: "Mannequin magique",
  nameEn: "Magic mannequin",
  description:
    "La version humaine du blob Couveuse : le corps du mannequin fait de lumière de glace, liseré de clair, traversé de " +
    "courants, aux articulations plus vives, avec les yeux du blob qui clignent. Il éclaire le décor la nuit. Les neuf " +
    "palettes du blob ; joue n'importe quelle animation de la catégorie « Animations ».",
  tags: [
    "mannequin magique", "mannequin", "couveuse", "blob", "esprit", "lumière", "glace", "magie", "personnage", "humanoïde",
    "yeux", "clignement", "lumineux", "magic mannequin", "spirit", "light", "ice", "magic", "glowing", "character",
    "humanoid", "rigged", "animé", "animated",
  ],
  character: "magic-mannequin",
  variantsBy: "palette",
});

export { setWind, tick } from "../../../engine/toon-material.js";
