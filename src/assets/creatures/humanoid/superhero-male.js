// Héros : personnage importé (glTF), squelette commun à toutes les animations (kit/humanoid.js).

import { characterAsset } from "../../kit/animation-asset.js";

export const { meta, create, dispose } = characterAsset({
  id: "creatures/humanoid/superhero-male",
  name: "Héros",
  nameEn: "Hero",
  description: "Un homme musclé en short sombre, peau mate, barbe naissante, yeux marron. Joue n'importe quelle animation de la catégorie « Animations ».",
  tags: ["héros", "homme", "personnage", "humain", "humanoïde", "musclé", "hero", "man", "character", "human", "humanoid", "rigged", "animé", "animated"],
  character: "superhero-male",
});

export { setWind, tick } from "../../../engine/toon-material.js";
