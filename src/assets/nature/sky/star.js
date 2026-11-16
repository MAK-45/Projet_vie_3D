// Étoile : scintillement à quatre branches, étoile à cinq branches ou petit amas d'étoiles, en couches de couleur
// (bord, corps, cœur) qui pulsent doucement. Toujours face à la caméra, lumineuse par elle-même. Entièrement
// procédurale, 1 draw call.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildFanGeometry, starOutline } from "../../kit/geometry.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const SHAPES = {
  sparkle: { label: "Scintillement" },
  star: { label: "Étoile à cinq branches" },
  cluster: { label: "Amas" },
};

// Contour, bord, corps, cœur : rampes de 4 couleurs, ombres froides et lumières chaudes.
const TINTS = {
  white: { label: "Blanche", ramp: ["#4a5596", "#9fb0e2", "#e3e9ff", "#fffef2"] },
  gold: { label: "Dorée", ramp: ["#8c4627", "#e8a03c", "#ffd968", "#fffbe2"] },
  blue: { label: "Bleue", ramp: ["#283a8a", "#5a8ae0", "#acd8ff", "#f4fcff"] },
};

const params = {
  seed: seedParam("Change la forme : longueur et finesse des branches, inclinaison, petites étoiles autour, disposition de l'amas."),
  shape: choiceParam("Forme", SHAPES, "Scintillement à quatre branches, étoile à cinq branches, ou amas de petites étoiles."),
  tint: choiceParam("Couleur", TINTS, "Blanche, dorée ou bleue."),
  size: numberParam("Taille", 1.4, 0.6, 2.4, "Hauteur de l'étoile principale, d'une pointe à l'autre.", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "nature/sky/star",
  name: "Étoile",
  nameEn: "Star",
  category: "nature",
  subcategory: "sky",
  description:
    "Étoile en pixel art qui scintille : quatre branches, cinq branches ou petit amas, blanche, dorée ou bleue. " +
    "Toujours face à la caméra ; la graine change les branches et les petites étoiles autour.",
  tags: [
    "étoile", "astre", "ciel", "nuit", "scintillement", "amas", "lumineux", "magie", "extérieur",
    "star", "celestial", "sky", "night", "sparkle", "twinkle", "cluster", "glowing", "magic", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "garden", "village", "desert", "snow", "swamp", "beach", "mountain"],
  version: 1,
  added: "2026-11-16",
  units:
    "1 unité = 1 mètre (taille de présentation : un monde l'agrandit et le place loin) ; l'origine est au sol, " +
    "l'étoile flotte juste au-dessus",
  footprint: { radius: 1.2, height: 2.5 },
  animated: ["twinkle"],
  params,
  variants: variantsOf("shape", params.shape),
};

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Une étoile en trois couches empilées vers la caméra : bord (ton 1), corps (ton 2), cœur (ton 3).
 * @returns {object[]} éventails pour `buildFanGeometry`
 */
function layeredStar(rng, { position, size, points, inner, rotation, stretch, phase, flex }) {
  const outline = starOutline(points, inner);
  const layers = [
    { scale: 1, occlusion: 0.4, lift: 0 },
    { scale: 0.62, occlusion: 0.62, lift: 0.01 },
    { scale: points === 4 ? 0.26 : 0.3, occlusion: 0.9, lift: 0.02, round: true },
  ];
  return layers.map((layer) => ({
    position,
    outline: layer.round ? starOutline(points === 4 ? 4 : 5) : outline,
    size: size * layer.scale,
    rotation,
    stretch: layer.round ? [1, 1] : stretch,
    normal: UP,
    phase,
    variation: 0.5,
    flex,
    occlusion: layer.occlusion,
    lift: layer.lift,
  }));
}

/** Petite étoile : un losange clair d'au moins un pixel et demi de rayon. */
function dot(rng, position, size, phase) {
  return {
    position,
    outline: starOutline(4),
    size: Math.max(0.09, size),
    rotation: 0,
    normal: UP,
    phase,
    variation: 0.5,
    flex: 0.35,
    occlusion: 0.75,
    lift: 0.005,
  };
}

/**
 * Crée une étoile.
 * @param {{seed?: number, shape?: "sparkle"|"star"|"cluster", tint?: "white"|"gold"|"blue", size?: number}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; `group.userData.asset` décrit l'asset créé
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 17);
  const half = p.size / 2;
  const center = new THREE.Vector3(0, (p.shape === "cluster" ? p.size * 0.6 : half) + 1, 0);
  const fans = [];

  const main = (position, size, phase) => {
    if (p.shape === "star") {
      return layeredStar(rng, {
        position, size, points: 5, inner: rng.range(0.4, 0.52), rotation: rng.range(-0.3, 0.3),
        stretch: [1, 1], phase, flex: 0.1,
      });
    }
    return layeredStar(rng, {
      position, size, points: 4, inner: rng.range(0.27, 0.36), rotation: rng.range(-0.12, 0.12),
      stretch: [rng.range(0.7, 0.95), 1], phase, flex: 0.18,
    });
  };

  if (p.shape === "cluster") {
    // Une étoile vive et des petites, dispersées en volume (l'amas change d'allure quand on tourne).
    fans.push(...main(center, half * 0.75, 0));
    const count = rng.int(6, 10);
    for (let i = 0; i < count; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const distance = rng.range(0.35, 1) * p.size * 0.75;
      const position = center.clone().add(
        new THREE.Vector3(Math.cos(angle) * distance, rng.range(-0.6, 0.6) * p.size * 0.7, Math.sin(angle) * distance),
      );
      position.y = Math.max(position.y, 0.9);
      if (i < 2) fans.push(...main(position, half * rng.range(0.3, 0.42), rng.next()));
      else fans.push(dot(rng, position, half * rng.range(0.09, 0.16), rng.next()));
    }
  } else {
    fans.push(...main(center, half, 0));
    // Une à trois petites étoiles compagnes, à côté de l'étoile, dans le plan de l'écran.
    const companions = rng.int(1, 3);
    for (let i = 0; i < companions; i++) {
      const angle = rng.range(0, Math.PI * 2);
      const distance = half * rng.range(0.85, 1.25);
      fans.push({ ...dot(rng, center, half * rng.range(0.1, 0.16), rng.next()), offset: [Math.cos(angle) * distance, Math.sin(angle) * distance] });
    }
  }

  const group = new THREE.Group();
  group.name = meta.name;
  const material = createToonMaterial({
    ramp: TINTS[p.tint].ramp,
    steps: [0.3, 0.52, 0.8],
    foliage: true,
    unlit: true,
    leafShade: [0, 1],
    twinkle: 1,
    id: 23,
  });
  const mesh = new THREE.Mesh(buildFanGeometry(fans), material);
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.boundingSphere.radius += p.size;
  mesh.name = "star";
  group.add(mesh);

  group.userData.asset = { id: meta.id, params: p, stars: fans.length };
  return group;
}
