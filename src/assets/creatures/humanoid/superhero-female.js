// Héroïne : personnage importé (glTF), squelette commun à toutes les animations (kit/humanoid.js).

import { characterAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = characterAsset({
  id: "creatures/humanoid/superhero-female",
  name: "Héroïne",
  nameEn: "Heroine",
  description: "Une femme athlétique en tenue de sport sombre (brassière et short), peau mate, yeux marron. Joue n'importe quelle animation de la catégorie « Animations ».",
  tags: ["héroïne", "femme", "personnage", "humain", "humanoïde", "athlétique", "heroine", "woman", "character", "human", "humanoid", "rigged", "animé", "animated"],
  character: "superhero-female",
});

export { setWind, tick } from "../../../engine/toon-material.js";
