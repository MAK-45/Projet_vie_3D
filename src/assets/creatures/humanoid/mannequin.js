// Mannequin : personnage importé (glTF), squelette commun à toutes les animations (kit/humanoid.js).

import { characterAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = characterAsset({
  id: "creatures/humanoid/mannequin",
  name: "Mannequin",
  nameEn: "Mannequin",
  description: "Le mannequin de la bibliothèque d'animations : un corps neutre orange aux articulations violettes, sans visage. Pour régler une scène ou juger un mouvement sans distraction.",
  tags: ["mannequin", "personnage", "neutre", "articulations", "humanoïde", "dummy", "character", "neutral", "humanoid", "rigged", "animé", "animated"],
  character: "mannequin",
});

export { setWind, tick } from "../../../engine/toon-material.js";
