// Page de développement de l'explorateur (explorer.html) : un monde en plein écran (?world=worlds/interiors/complex-test
// pour le Complexe ; la prairie d'été par défaut). Dans l'Atelier,
// l'explorateur est monté par la fiche de l'asset « Prairie d'été » (src/gallery/main.js).
// L'URL accepte ?seed=1&size=small|medium|large|endless&moment=day|dusk|night|cycle&weather=clear|rain|variable
// &camera=fixed|orbit|follow|third&character=bar|blob|superhero-female|superhero-male|mannequin|magic-mannequin&trees=1&rocks=1&grass=1&flowers=1&relief=1.8&az=45&el=35&zoom=1.5&x=0&z=0&y=0&stroll=1&clean=1
// En 3e personne (camera=third) : az = direction de la vue, el = inclinaison, zoom = recul derrière le promeneur (m).
// y : étage où poser le promeneur dans un monde à étages (la mezzanine des Archives : y=3.4).

import { defaultSettings, Explorer } from "./explorer.js";
import { DEFAULT_WORLD } from "./worlds.js";

const query = new URLSearchParams(location.search);
const world = query.get("world") ?? DEFAULT_WORLD;
const defaults = defaultSettings(world);
const settings = {};
for (const name of Object.keys(defaults)) {
  if (query.has(name)) settings[name] = typeof defaults[name] === "number" ? Number(query.get(name)) : query.get(name);
}
const explorer = new Explorer(document.getElementById("explorer"), { world, settings, remember: query.size === 0 });
explorer.setImmersive(true);

const number = (name) => (query.has(name) ? Number(query.get(name)) : undefined);
if (["az", "el", "zoom", "x", "z"].some((name) => query.has(name))) {
  explorer.setView({ azimuth: number("az"), elevation: number("el"), zoom: number("zoom"), x: number("x"), z: number("z"), y: number("y") });
}
if (query.get("stroll") === "1") explorer.setStrolling(true);
if (query.get("clean") === "1") explorer.setClean(true);
window.explorer = explorer;
