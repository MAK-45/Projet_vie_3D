// Neige, mousse et terre : générateurs partagés par les assets de sol (nature/terrain) et par tout asset qui en
// porte (rochers, murs, toits...). Une plaque de neige posée au sol et la neige d'un rocher sortent du même code,
// avec les mêmes couleurs.
//
// - `snowMound`, `mossMound`, `dirtMound` : une butte au sol (géométrie, origine au sol).
// - `snowCap`, `mossCap` : une couche drapée sur une géométrie existante, au contour organique.
// - `coverMaterial` : le matériau toon qui va avec.

import { createToonMaterial } from "../../engine/toon-material.js";
import { buildDrape, buildMound, buildRock, mergeGeometries } from "./geometry.js";
import { GROUNDS, MOSSES, SNOWS } from "./palettes.js";

/**
 * Plaque de neige : congère bombée, bords lobés, très légère ondulation.
 * @param {object} rng générateur (kit/rng.js) ; `noise` : bruit de `createNoise3`
 * @param {{radius: number[], height: number, offset?: number[], rotation?: number, drifts?: number}} options
 *   drifts : nombre de congères secondaires accolées (0 à 3)
 */
export function snowMound(rng, noise, { radius, height, offset = [0, 0, 0], rotation = 0, drifts = 0 }) {
  const relief = (x, z) => (noise(x * 1.8 + offset[0], 0.5, z * 1.8 + offset[2]) - 0.5) * height * 1.1;
  const parts = [
    buildMound(rng, { radius, height, lobes: 0.4, power: 0.9, relief, rings: 7, sectors: 22, offset, rotation }),
  ];
  for (let i = 0; i < drifts; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const reach = rng.range(0.45, 0.75);
    const k = rng.range(0.4, 0.6);
    parts.push(
      buildMound(rng, {
        radius: [radius[0] * k, radius[1] * k],
        height: height * rng.range(0.7, 1.2),
        lobes: 0.3,
        power: 0.9,
        rings: 4,
        sectors: 14,
        offset: [offset[0] + Math.cos(angle) * radius[0] * reach, offset[1], offset[2] + Math.sin(angle) * radius[1] * reach],
        rotation: rng.range(0, Math.PI * 2),
      }),
    );
  }
  return parts.length === 1 ? parts[0] : mergeGeometries(parts);
}

/**
 * Tapis de mousse : nappe mince au contour très découpé, semée de coussinets ronds.
 * @param {{radius: number[], height?: number, cushions?: number, offset?: number[], rotation?: number}} options
 */
export function mossMound(rng, noise, { radius, height = 0.05, cushions = 6, offset = [0, 0, 0], rotation = 0 }) {
  const relief = (x, z) => (noise(x * 4 + offset[0], 2.5, z * 4 + offset[2]) - 0.5) * 0.05;
  const parts = [buildMound(rng, { radius, height, lobes: 0.4, power: 0.4, relief, rings: 4, sectors: 20, offset, rotation })];
  const size = Math.min(radius[0], radius[1]);
  for (let i = 0; i < cushions; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const reach = Math.sqrt(rng.next()) * 0.62;
    const r = size * rng.range(0.18, 0.34);
    parts.push(
      buildMound(rng, {
        radius: [r, r * rng.range(0.75, 1)],
        height: height + r * rng.range(0.7, 1.0),
        lobes: 0.2,
        power: 0.45,
        rings: 3,
        sectors: 10,
        offset: [offset[0] + Math.cos(angle) * radius[0] * reach, offset[1], offset[2] + Math.sin(angle) * radius[1] * reach],
        rotation: rng.range(0, Math.PI * 2),
      }),
    );
  }
  return mergeGeometries(parts);
}

/**
 * Terre remuée : butte à facettes, bosselée, avec des mottes posées autour.
 * @param {{radius: number[], height: number, clods?: number, offset?: number[], rotation?: number}} options
 */
export function dirtMound(rng, noise, { radius, height, clods = 6, offset = [0, 0, 0], rotation = 0 }) {
  const relief = (x, z) => (noise(x * 2.4 + offset[0], 4.5, z * 2.4 + offset[2]) - 0.5) * height * 0.9;
  const parts = [buildMound(rng, { radius, height, lobes: 0.3, power: 0.9, relief, rings: 5, sectors: 16, flat: true, offset, rotation })];
  for (let i = 0; i < clods; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const reach = rng.range(0.55, 1.08);
    const r = Math.max(0.08, Math.min(radius[0], radius[1]) * rng.range(0.1, 0.2));
    const x = offset[0] + Math.cos(angle) * radius[0] * reach;
    const z = offset[2] + Math.sin(angle) * radius[1] * reach;
    const rest = height * Math.max(0, 1 - reach * reach) * 0.8;
    parts.push(
      buildRock(rng, {
        detail: 0,
        lumps: 2,
        lumpSize: 0.2,
        cuts: 2,
        cutDepth: [0.7, 0.9],
        scale: [r, r * rng.range(0.55, 0.8), r * rng.range(0.8, 1.1)],
        rotation: [rng.range(-0.4, 0.4), rng.range(0, Math.PI * 2), rng.range(-0.4, 0.4)],
        offset: [x, offset[1] + rest + r * 0.3, z],
        floorY: offset[1] - 0.02,
      }),
    );
  }
  return mergeGeometries(parts);
}

/**
 * Neige drapée sur une géométrie : sur les faces tournées vers le ciel, plus épaisse au milieu des plaques.
 * @param {THREE.BufferGeometry} geometry support (non modifié)
 * @param {(x: number, y: number, z: number) => number} noise bruit de `createNoise3`
 * @param {{amount?: number, thickness?: number, minY?: number}} [options]
 *   amount : -1 (quelques plaques) à 1 (tout le dessus) ; thickness : épaisseur au cœur ; minY : rien en dessous
 */
export function snowCap(geometry, noise, { amount = 0, thickness = 0.08, minY = -Infinity } = {}) {
  return buildDrape(
    geometry,
    (p, n) => (p.y < minY ? -1 : (n.y - 0.5 + amount * 0.35) * 2.4 + (noise(p.x * 2.2, p.y * 2.2, p.z * 2.2) - 0.5) * 1.1),
    { subdivisions: 3, lift: (w) => 0.014 + Math.min(1, w * 1.5) * thickness },
  );
}

/**
 * Mousse drapée sur une géométrie : en taches irrégulières sur le dessus et le haut des flancs, bosselée.
 * @param {{amount?: number, minY?: number}} [options] amount : -1 (quelques taches) à 1 (presque tout)
 */
export function mossCap(geometry, noise, { amount = 0, minY = -Infinity } = {}) {
  return buildDrape(
    geometry,
    (p, n) =>
      p.y < minY ? -1 : (n.y - 0.55 + amount * 0.4) * 1.4 + (noise(p.x * 2.6 + 9, p.y * 2.6, p.z * 2.6) - 0.5) * 2.4,
    { subdivisions: 3, lift: (w, p) => 0.012 + Math.min(1, w * 3) * 0.035 * noise(p.x * 8, p.y * 8 + 3, p.z * 8) },
  );
}

/**
 * Matériau toon de la neige, de la mousse ou de la terre.
 * @param {"snow"|"moss"|"dirt"} kind
 * @param {string} [variant] neige : fresh, old ; mousse : une saison ; terre : dirt, clay, mud
 * @param {{seed?: number, id?: number}} [options]
 */
export function coverMaterial(kind, variant, { seed = 0, id = 11 } = {}) {
  if (kind === "snow") {
    const snow = SNOWS[variant ?? "fresh"];
    return createToonMaterial({ ramp: snow.ramp, ink: snow.ink, steps: [0.42, 0.62, 0.8], pattern: "speckle", patternParams: [16, 0.03, 0.15, 0.3], seed, id });
  }
  if (kind === "moss") {
    const moss = MOSSES[variant ?? "summer"];
    return createToonMaterial({ ramp: moss.ramp, ink: moss.ink, steps: [0.36, 0.58, 0.8], pattern: "speckle", patternParams: [16, 0.1, 0.2, 1], seed, id });
  }
  const ground = GROUNDS[variant ?? "dirt"];
  return createToonMaterial({ ramp: ground.ramp, ink: ground.ink, steps: [0.32, 0.55, 0.76], pattern: "speckle", patternParams: [16, 0.07, 0.2, 1], seed, id });
}
