// Fabrique des assets d'animation (catégorie « Animations ») et des assets de personnage (Créatures › Humanoïde).
//
// Un asset d'animation est un mouvement (marcher, s'asseoir, lancer un sort...) joué par un personnage au
// choix : le paramètre `character` change le corps, pas le mouvement. Un mouvement en plusieurs temps
// (s'asseoir : se baisser, rester assis, se relever) a un paramètre `phase` : l'enchaînement complet ou un temps
// seul. Les fichiers de chaque asset ne contiennent que la fiche et la liste des animations jouées.

import { choiceParam, seedParam, variantsOf } from "./variation.js";
import { CHARACTERS, cadenceParam, characterParam, createHumanoid, disposeHumanoid, speedParam } from "./humanoid.js";

const GOLDEN = 0.6180339887;
const ADDED = "2026-11-17";

/** Fraction de départ dans le cycle tirée de la graine : dix personnages qui marchent ne marchent pas au pas. */
const offsetOf = (seed) => (((Number(seed) || 0) * GOLDEN) % 1 + 1) % 1;

const tallest = Math.max(...Object.values(CHARACTERS).map((c) => c.height));

/**
 * @param {object} definition
 * @param {string} definition.id `animations/<sous-catégorie>/<nom>`
 * @param {string} definition.name nom affiché (français)
 * @param {string} definition.nameEn
 * @param {string} definition.description
 * @param {string[]} definition.tags
 * @param {string[]} definition.biomes
 * @param {Record<string, {label: string, steps: Array<{clip: string, repeat?: number, hold?: number}>}>} definition.phases
 *   la première est la phase par défaut ; une seule phase : pas de paramètre `phase`
 * @param {boolean} [definition.moves] l'animation fait avancer le personnage : paramètre `path` (sur place / avance)
 * @param {number} [definition.radius] emprise au sol en mouvement (m)
 * @param {boolean} [definition.pedestal] faux : pas de socle dans la galerie (nage : l'origine est la surface de l'eau)
 * @param {number} [definition.height] hauteur atteinte (m) si le mouvement ne se tient pas debout (accroupi, nage)
 * @param {number} [definition.version]
 */
export function animationAsset({ id, name, nameEn, description, tags, biomes, phases, moves = false, radius = 0.7, height, pedestal = true, version = 1 }) {
  const [category, subcategory] = id.split("/");
  const params = {
    seed: seedParam("Moment du cycle où l'animation commence : plusieurs personnages ne bougent pas en même temps."),
    character: characterParam("Le personnage qui joue le mouvement. Tous partagent le même squelette."),
  };
  const phaseIds = Object.keys(phases);
  if (phaseIds.length > 1) {
    params.phase = choiceParam(
      "Temps",
      Object.fromEntries(phaseIds.map((phase) => [phase, phases[phase].label])),
      "Le mouvement complet, enchaîné, ou l'un de ses temps joué seul.",
    );
  }
  if (moves) {
    params.path = choiceParam(
      "Trajet",
      { inPlace: "Sur place", forward: "Avance" },
      "« Sur place » : le personnage reste au centre, comme sur un tapis roulant ; « Avance » : il se déplace et revient au départ à chaque boucle.",
    );
  }
  params.speed = speedParam();
  params.cadence = cadenceParam();

  const clips = [...new Set(Object.values(phases).flatMap((phase) => phase.steps.map((step) => step.clip)))];
  const meta = {
    id,
    name,
    nameEn,
    category,
    subcategory,
    description,
    tags,
    biomes,
    version,
    added: ADDED,
    imported: true,
    units: "mètres ; personnages de 1,77 à 1,81 m, origine entre les pieds, regard vers +Z",
    footprint: { radius, height: height ?? Math.ceil(tallest * 10) / 10 },
    animated: ["skeleton"],
    ...(pedestal ? {} : { pedestal: false }),
    clips,
    files: ["animations/ual-standard.glb", ...Object.values(CHARACTERS).map((c) => c.file)],
    params,
    variants: variantsOf("character", params.character),
  };

  function create(options = {}) {
    const p = Object.fromEntries(Object.entries(params).map(([key, spec]) => [key, options[key] ?? spec.default]));
    const phase = phases[p.phase] ?? phases[phaseIds[0]];
    return createHumanoid({
      id,
      params: p,
      character: p.character,
      steps: phase.steps,
      inPlace: p.path !== "forward",
      speed: Number(p.speed),
      cadence: p.cadence,
      offset: offsetOf(p.seed),
    });
  }

  return { meta, create, dispose: disposeHumanoid };
}

/** Ce que chaque personnage fait dans sa propre fiche (paramètre `animation`). */
const SHOWCASE = {
  idle: { label: "Attente", clip: "Idle_Loop" },
  walk: { label: "Marche", clip: "Walk_Loop" },
  talk: { label: "Parle", clip: "Idle_Talking_Loop" },
  dance: { label: "Danse", clip: "Dance_Loop" },
  sit: { label: "Assis", clip: "Sitting_Idle_Loop" },
  spell: { label: "Sort", clip: "Spell_Simple_Idle_Loop" },
};

/**
 * Asset de personnage : le corps seul, qui joue une animation de démonstration.
 * @param {object} definition fiche (id, name, nameEn, description, tags) et `character` (clé de CHARACTERS)
 */
export function characterAsset({ id, name, nameEn, description, tags, character, version = 1 }) {
  const [category, subcategory] = id.split("/");
  const params = {
    seed: seedParam("Moment du cycle où l'animation commence."),
    animation: choiceParam(
      "Animation",
      Object.fromEntries(Object.entries(SHOWCASE).map(([key, value]) => [key, value.label])),
      "Le mouvement joué dans la fiche. Les 43 animations sont dans la catégorie « Animations », avec ce personnage au choix.",
    ),
    cadence: cadenceParam(),
  };
  const meta = {
    id,
    name,
    nameEn,
    category,
    subcategory,
    description,
    tags,
    biomes: ["meadow", "forest", "village", "interior", "beach"],
    version,
    added: ADDED,
    imported: true,
    units: `mètres ; ${String(CHARACTERS[character].height).replace(".", ",")} m, origine entre les pieds, regard vers +Z`,
    footprint: { radius: 0.5, height: Math.ceil(CHARACTERS[character].height * 10) / 10 },
    animated: ["skeleton"],
    files: [CHARACTERS[character].file, "animations/ual-standard.glb"],
    params,
    variants: variantsOf("animation", params.animation),
  };

  function create(options = {}) {
    const p = Object.fromEntries(Object.entries(params).map(([key, spec]) => [key, options[key] ?? spec.default]));
    return createHumanoid({
      id,
      params: p,
      character,
      steps: [{ clip: (SHOWCASE[p.animation] ?? SHOWCASE.idle).clip }],
      cadence: p.cadence,
      offset: offsetOf(p.seed),
    });
  }

  return { meta, create, dispose: disposeHumanoid };
}
