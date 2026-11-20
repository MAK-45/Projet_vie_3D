// Axes de variation partagés par tous les assets : mêmes noms de paramètres et mêmes valeurs partout, pour qu'un
// monde puisse demander « tout en automne » ou « tout en granit » sans connaître chaque asset.
// Les rampes de couleurs des matières communes sont dans palettes.js.

import { COVERS, GLOWS, METALS, STONES, WOODS } from "./palettes.js";

/** Les quatre saisons, dans l'ordre. Valeurs du paramètre `season`. */
export const SEASONS = ["spring", "summer", "autumn", "winter"];
export const SEASON_LABELS = { spring: "Printemps", summer: "Été", autumn: "Automne", winter: "Hiver" };

/** Paramètre `seed` : présent sur tous les assets. La description dit ce que la graine change pour cet asset. */
export function seedParam(description) {
  return { type: "int", default: 1, min: 0, max: 9999, label: "Graine", description };
}

/** Paramètre `season` : pour tout ce qui est vivant ou posé dehors (végétation, terrain, toits enneigés...). */
export function seasonParam(description, defaultSeason = "summer") {
  return { type: "enum", default: defaultSeason, values: SEASONS, labels: SEASON_LABELS, label: "Saison", description };
}

/**
 * Paramètre à choix (matière, style, modèle, couleur...).
 * @param {string} label nom affiché du paramètre
 * @param {Record<string, string | {label: string}>} options valeur → nom affiché (ou entrée de palette avec `label`)
 * @param {string} description ce que le choix change
 * @param {string} [defaultValue] première option par défaut
 */
export function choiceParam(label, options, description, defaultValue = Object.keys(options)[0]) {
  const labels = {};
  for (const [value, option] of Object.entries(options)) labels[value] = typeof option === "string" ? option : option.label;
  return { type: "enum", default: defaultValue, values: Object.keys(options), labels, label, description };
}

/** Paramètre `stone` : type de pierre (palettes.js). `only` limite le choix aux pierres plausibles pour l'asset. */
export function stoneParam(description, { only, defaultValue } = {}) {
  return choiceParam("Pierre", pick(STONES, only), description, defaultValue);
}

/** Paramètre `wood` : essence de bois (palettes.js). */
export function woodParam(description, { only, defaultValue } = {}) {
  return choiceParam("Bois", pick(WOODS, only), description, defaultValue);
}

/** Paramètre `metal` : métal des garnitures et mécanismes (palettes.js, METALS). */
export function metalParam(description, { only, defaultValue } = {}) {
  return choiceParam("Métal", pick(METALS, only), description, defaultValue);
}

/** Paramètre `glow` : couleur des lueurs (palettes.js, GLOWS) : ambre, cyan, rouge d'alerte. */
export function glowParam(description, { only, defaultValue } = {}) {
  return choiceParam("Lueur", pick(GLOWS, only), description, defaultValue);
}

/** Valeurs du paramètre `cover` : ce qui recouvre le dessus d'une roche ou d'un bâti. */
export const COVERS_LIST = ["bare", "moss", "snow"];

/** Paramètre `cover` : nu, mousse ou neige sur les faces tournées vers le ciel (palettes.js, COVERS). */
export function coverParam(description, defaultValue = "bare") {
  return choiceParam("Couverture", { bare: "Nue", moss: COVERS.moss, snow: COVERS.snow }, description, defaultValue);
}

/** Nombre réglable (hauteur, largeur, densité...). */
export function numberParam(label, defaultValue, min, max, description, { step = 0.1, unit } = {}) {
  return { type: "number", default: defaultValue, min, max, step, ...(unit ? { unit } : {}), label, description };
}

/**
 * Une variante par valeur d'un paramètre à choix : ce sont les formes montrées et mesurées dans le catalogue.
 * La valeur par défaut vient en premier.
 */
export function variantsOf(name, spec) {
  const values = [spec.default, ...spec.values.filter((value) => value !== spec.default)];
  return values.map((value) => ({ id: value, name: spec.labels?.[value] ?? value, params: { [name]: value } }));
}

function pick(table, only) {
  if (!only) return table;
  return Object.fromEntries(only.map((key) => [key, table[key]]));
}
