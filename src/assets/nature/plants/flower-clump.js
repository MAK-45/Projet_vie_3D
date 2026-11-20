// Massif de fleurs : des tiges fines dressées au-dessus d'une rosette de feuilles, chacune portant une corolle
// face à la caméra avec son cœur. Marguerite, coquelicot, bleuet, bouton d'or ou lavande ; boutons au printemps,
// têtes fanées en automne, tiges sèches en hiver. 3 draw calls (tiges et feuilles, pétales, cœurs).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBladeGeometry, buildFanGeometry, starOutline } from "../../kit/geometry.js";
import { FLOWERS, GRASSES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seasonParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const params = {
  seed: seedParam("Change le bouquet : nombre et hauteur des tiges, inclinaison, place des fleurs et des feuilles."),
  species: choiceParam(
    "Fleur",
    FLOWERS,
    "Marguerite blanche à cœur jaune, coquelicot rouge à cœur noir, bleuet bleu, bouton d'or, ou épis de lavande.",
  ),
  season: seasonParam("Printemps : boutons et fleurs mêlés. Été : pleine floraison. Automne : têtes fanées. Hiver : tiges sèches."),
  count: numberParam("Tiges", 7, 3, 15, "Nombre de tiges fleuries (triplé pour la lavande).", { step: 1 }),
  height: numberParam("Hauteur", 1, 0.6, 1.5, "Hauteur relative à la taille naturelle de la fleur (35 à 55 cm)."),
};

export const meta = {
  id: "nature/plants/flower-clump",
  name: "Massif de fleurs",
  nameEn: "Flower clump",
  category: "nature",
  subcategory: "plants",
  description:
    "Petit massif de fleurs des champs : tiges fines au-dessus d'une rosette de feuilles, corolles et cœurs qui " +
    "ondulent au vent. Cinq fleurs (marguerite, coquelicot, bleuet, bouton d'or, lavande) et quatre saisons.",
  tags: [
    "fleurs", "massif de fleurs", "marguerite", "coquelicot", "bleuet", "bouton d'or", "lavande", "fleur des champs",
    "plante", "végétation", "jardin", "vent", "saisons", "extérieur",
    "flowers", "flower clump", "daisy", "poppy", "cornflower", "buttercup", "lavender", "wildflower", "plant",
    "vegetation", "garden", "wind", "seasons", "outdoor", "procedural",
  ],
  biomes: ["meadow", "garden", "village", "forest", "mountain"],
  version: 2,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol, au cœur du massif",
  footprint: { radius: 0.7, height: 0.68 },
  animated: ["wind"],
  params,
  variants: variantsOf("species", params.species),
};

const TAU = Math.PI * 2;
// Souplesse au vent du haut des tiges ; la tête reprend la même souplesse et la même phase que sa tige, pour rester
// accrochée au bout au lieu de trembler à côté.
const FLEX = 0.3;
// Avancée du cœur vers la caméra : il passe devant sa corolle (au même point) sans traverser les fleurs voisines.
const HEART_LIFT = 0.03;
const HEART = starOutline(8);
const UP = new THREE.Vector3(0, 1, 0);

// Port de chaque fleur : hauteur (m), taille de la corolle et du cœur (rayon, m), contour, feuilles de la rosette,
// courbure des tiges, ramification.
const SPECIES = {
  daisy: { height: 0.45, head: 0.12, heart: 0.05, outline: starOutline(12, 0.8), leaves: 7, curve: 0.08, stretch: [1, 0.85] },
  poppy: { height: 0.55, head: 0.12, heart: 0.045, outline: starOutline(5, 0.86), leaves: 6, curve: 0.18, stretch: [1, 0.8] },
  cornflower: { height: 0.5, head: 0.1, heart: 0.04, outline: starOutline(8, 0.62), leaves: 5, curve: 0.1, stretch: [1, 0.9] },
  buttercup: { height: 0.35, head: 0.085, heart: 0.032, outline: starOutline(5, 0.86), leaves: 8, curve: 0.12, stretch: [1, 0.85] },
  lavender: { height: 0.5, head: 0.042, heart: 0, outline: starOutline(5), leaves: 12, curve: 0.05, stretch: [1, 1.3], spike: 5 },
};

// Feuillage gris-vert de la lavande (persistant) ; les autres fleurs prennent l'herbe de la saison.
const LAVENDER_LEAVES = ["#2e3f4a", "#455a5a", "#647a6a", "#8ea084", "#bfc8a6"];

/**
 * Crée un massif de fleurs.
 * @param {{seed?: number, species?: string, season?: string, count?: number, height?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const detail = createRng(p.seed * 104729 + 71);
  const kind = SPECIES[p.species];
  const colors = FLOWERS[p.species];
  const lavender = p.species === "lavender";
  const H = kind.height * p.height;
  const season = p.season;

  // Bouquet (graine) : plus ou moins ouvert, penché d'un côté, tiges de hauteurs inégales.
  const spread = shape.range(0.35, 0.6) * (lavender ? 1.2 : 1);
  const leanAngle = shape.range(0, TAU);
  const lean = new THREE.Vector3(Math.cos(leanAngle), 0, Math.sin(leanAngle)).multiplyScalar(shape.range(0, 0.18) * H);
  const unevenness = shape.range(0.15, 0.4);
  const footRadius = shape.range(0.06, 0.13) * (lavender ? 1.4 : 1);

  const blades = [];
  const petals = [];
  const hearts = [];
  const stemCount = Math.round(p.count * (lavender ? 3 : 1) * shape.range(0.85, 1.15));
  const blade = (base, bend, tip, width, tipWidth, normal, flex, baseOcclusion = 0, phase = detail.next()) => {
    blades.push({ base, bend, tip, width, tipWidth, normal, phase, variation: detail.next(), flex, baseOcclusion });
  };

  for (let i = 0; i < stemCount; i++) {
    const azimuth = i * 2.39996 + shape.range(-0.5, 0.5);
    const out = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const reach = Math.sqrt(shape.next());
    const base = out.clone().multiplyScalar(footRadius * reach);
    const h = H * (1 - unevenness * shape.next()) * (season === "winter" ? 0.85 : 1);
    const side = new THREE.Vector3(-out.z, 0, out.x).multiplyScalar(shape.range(-1, 1) * kind.curve * h);
    const tip = base.clone()
      .addScaledVector(out, spread * h * (0.4 + reach))
      .addScaledVector(UP, h)
      .addScaledVector(lean, h / H);
    const bend = base.clone().addScaledVector(UP, h * 0.6).add(side).addScaledVector(lean, 0.3 * (h / H));
    const normal = out.clone().addScaledVector(UP, 1.2).normalize();
    const stemPhase = detail.next();
    blade(base, bend, tip, 0.05, 0.035, normal, FLEX, 0.1, stemPhase);

    const headNormal = out.clone().multiplyScalar(0.4).addScaledVector(UP, 1).normalize();
    const direction = tip.clone().sub(bend).normalize();

    if (lavender) {
      // Épi : des grains violets empilés sur le haut de la tige.
      if (season === "winter" && detail.chance(0.4)) continue;
      for (let k = 0; k < kind.spike; k++) {
        const t = k / (kind.spike - 1);
        petals.push({
          position: tip.clone().addScaledVector(direction, -0.14 * H * (1 - t) + 0.02),
          outline: kind.outline,
          size: kind.head * (1 - 0.35 * t) * detail.range(0.9, 1.1),
          stretch: kind.stretch,
          rotation: detail.range(-0.4, 0.4),
          normal: headNormal,
          phase: detail.next(),
          variation: detail.next(),
          flex: FLEX,
          occlusion: 0.75 + 0.25 * t,
        });
      }
      continue;
    }

    // Une fleur au bout de chaque tige : ouverte, en bouton ou fanée selon la saison.
    const roll = detail.next();
    const state =
      season === "spring" ? (roll < 0.45 ? "bud" : "open")
        : season === "summer" ? (roll < 0.1 ? "bud" : "open")
          : season === "autumn" ? (roll < 0.35 ? "open" : "seed")
            : roll < 0.6 ? "seed" : "none";
    const head = tip.clone().addScaledVector(direction, 0.02);
    const size = kind.head * detail.range(0.85, 1.15);
    if (state === "open") {
      petals.push({
        position: head, outline: kind.outline, size, stretch: kind.stretch, rotation: detail.range(0, TAU),
        normal: headNormal, phase: stemPhase, variation: detail.next(), flex: FLEX,
      });
      hearts.push({
        position: head.clone(), outline: HEART, lift: HEART_LIFT, size: kind.heart, stretch: [1, 0.85], rotation: 0,
        normal: headNormal, phase: stemPhase, variation: detail.next(), flex: FLEX,
      });
    } else if (state === "bud") {
      petals.push({
        position: head, outline: starOutline(5, 0.8), size: size * 0.45, stretch: [0.8, 1.1], rotation: 0,
        normal: headNormal, phase: stemPhase, variation: detail.next(), flex: FLEX, occlusion: 0.35,
      });
    } else if (state === "seed") {
      hearts.push({
        position: head, outline: starOutline(6, 0.8), size: Math.max(0.04, kind.heart * 1.3), stretch: [1, 1], rotation: 0,
        normal: headNormal, phase: stemPhase, variation: detail.next(), flex: FLEX,
      });
    }

    // Les fleurs ramifiées (bouton d'or, marguerite) portent parfois une petite tige secondaire.
    if ((p.species === "buttercup" || p.species === "daisy") && state === "open" && detail.chance(0.4)) {
      const from = base.clone().lerp(tip, 0.55);
      const twigTip = from.clone().addScaledVector(out, 0.1 * H).addScaledVector(UP, 0.3 * h);
      const twigPhase = detail.next();
      blade(from, from.clone().addScaledVector(UP, 0.15 * h), twigTip, 0.045, 0.035, normal, FLEX, 0.6, twigPhase);
      petals.push({
        position: twigTip.clone().addScaledVector(UP, 0.015), outline: kind.outline, size: size * 0.8, stretch: kind.stretch,
        rotation: detail.range(0, TAU), normal: headNormal, phase: twigPhase, variation: detail.next(), flex: FLEX,
      });
      hearts.push({
        position: twigTip.clone().addScaledVector(UP, 0.015), outline: HEART, lift: HEART_LIFT, size: kind.heart * 0.85, stretch: [1, 0.85],
        rotation: 0, normal: headNormal, phase: twigPhase, variation: detail.next(), flex: FLEX,
      });
    }
  }

  // Rosette de feuilles au pied (rare en hiver, sauf pour la lavande qui est persistante).
  const leafCount = Math.round(kind.leaves * (season === "winter" && !lavender ? 0.4 : 1) * shape.range(0.8, 1.25));
  for (let i = 0; i < leafCount; i++) {
    const azimuth = shape.range(0, TAU);
    const out = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth));
    const base = out.clone().multiplyScalar(footRadius * shape.range(0, 0.7));
    const length = (lavender ? 0.22 : 0.18) * shape.range(0.7, 1.2) * p.height;
    const rise = lavender ? shape.range(0.5, 0.9) : shape.range(0.25, 0.55);
    const tip = base.clone().addScaledVector(out, length * (1 - rise * 0.5)).addScaledVector(UP, length * rise);
    const bend = base.clone().addScaledVector(out, length * 0.3).addScaledVector(UP, length * rise * 0.9);
    blade(base, bend, tip, lavender ? 0.065 : 0.09, 0, out.clone().addScaledVector(UP, 1.2).normalize(), 0.3, 0.1);
  }

  // --- Maillages : tiges et feuilles, pétales, cœurs.
  const sway = { amplitude: 0.07 * H, height: H };
  const group = new THREE.Group();
  group.name = meta.name;
  const addMesh = (name, geometry, material) => {
    geometry.computeBoundingSphere();
    geometry.boundingSphere.radius += 0.15; // vent et taille des formes face caméra
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.customDepthMaterial = material.userData.depthMaterial;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const stemRamp = lavender ? LAVENDER_LEAVES : GRASSES[season].ramp;
  addMesh(
    "stems",
    buildBladeGeometry(blades, { segments: 2 }),
    createToonMaterial({ ramp: stemRamp, steps: [0.3, 0.5, 0.7, 0.9], foliage: true, leafShade: [0.12, 0.4], id: 12, sway }),
  );

  const faded = season === "winter" || (lavender && season === "autumn");
  if (petals.length) {
    addMesh(
      "petals",
      buildFanGeometry(petals),
      createToonMaterial({
        ramp: faded ? colors.dry : colors.petals,
        steps: [0.3, 0.5, 0.7],
        foliage: true,
        leafShade: [0.1, 0.5],
        id: 13,
        sway,
      }),
    );
  }
  if (hearts.length) {
    const heartMaterial = createToonMaterial({
      ramp: season === "autumn" || season === "winter" ? colors.dry : colors.heart,
      steps: [0.3, 0.5, 0.7],
      foliage: true,
      leafShade: [0.08, 0],
      id: 13, // même identifiant que les pétales : pas de contour entre le cœur et sa corolle
      sway,
    });
    addMesh("hearts", buildFanGeometry(hearts), heartMaterial);
  }

  group.userData.asset = { id: meta.id, params: p, stems: stemCount, flowers: petals.length };
  return group;
}
