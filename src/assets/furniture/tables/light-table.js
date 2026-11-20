// Table à calques lumineuse de l'Atelier du Complexe (fiche ATE-15, docs/complexe/PIECES.md) : 1,5 × 1,0 × 0,90 m.
// Caisson de bronze sur quatre pieds, plateau inclinable (charnière à l'avant, jambe de force à l'arrière), verre dépoli
// éclairé par-dessous en ambre pâle ; la lumière filtre aussi par les fentes du caisson. Dessus : une à quatre
// feuilles de cuivre fin décalées, gravées de trois à cinq traits sombres (plan d'une salle, rouage ou coupe), tenues
// par quatre pinces de laiton ; une règle et un compas posés.
// Allumée ou éteinte (verre gris laiteux) ; halo en option (le verre éclaire le décor dans le noir).
// La graine change les feuilles (nombre, place, dessin), la règle et le compas, les tons du bronze.
//
// 3 draw calls : bronze (bâti, pinces, règle, compas), feuilles de cuivre, verre (lueur ou verre laiteux).

import * as THREE from "three";
import { createGlowLight, createToonMaterial, rgb, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock } from "../../kit/geometry.js";
import { GLOWS, METALS } from "../../kit/palettes.js";
import { beam, glowMaterial, mergeToned, metalMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const STATES = { on: "Allumée", off: "Éteinte" };
const HALOS = { off: "Sans halo", on: "Éclaire le décor (dans le noir)" };
const MILKY = { ramp: ["#45484e", "#6c7074", "#999b98", "#c2c2ba"], ink: "#24262a" };

const params = {
  seed: seedParam("Change les feuilles de cuivre (nombre, place, dessin gravé), la règle et le compas, les tons du bronze."),
  state: choiceParam("Lumière", STATES, "Verre éclairé par-dessous en ambre pâle, ou éteint (gris laiteux)."),
  tilt: numberParam("Inclinaison", 10, 0, 20, "Le plateau se relève vers l'arrière, charnière à l'avant.", { step: 1, unit: "°" }),
  halo: choiceParam("Halo", HALOS, "Allumée, la table éclaire le décor autour d'elle dans le noir (une des 12 lumières de halo de la scène)."),
};

export const meta = {
  id: "furniture/tables/light-table",
  name: "Table à calques lumineuse",
  nameEn: "Light table",
  category: "furniture",
  subcategory: "tables",
  description:
    "Table à calques de l'Atelier du Complexe : caisson de bronze à plateau inclinable, verre dépoli éclairé par-dessous " +
    "en ambre pâle (la lumière filtre par les fentes), feuilles de cuivre fin gravées de plans tenues par quatre pinces, " +
    "règle et compas. Allumée ou éteinte. Fiche ATE-15.",
  tags: [
    "table à calques", "table lumineuse", "plateau inclinable", "verre dépoli", "lumière", "ambre", "feuilles de cuivre",
    "plans", "gravure", "pinces", "règle", "compas", "caisson", "bronze", "dessin", "atelier", "le complexe", "complexe",
    "ancien-tech", "meuble", "intérieur",
    "light table", "tracing table", "drafting table", "tilting top", "frosted glass", "backlight", "amber glow",
    "copper sheets", "blueprints", "engraving", "clips", "ruler", "drafting compass", "bronze fittings", "workshop",
    "ancient complex", "ancient-tech", "furniture", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre ; l'avant (charnière) vers +z",
  footprint: { radius: 0.92, height: 1.25 },
  animated: [],
  params,
  variants: [
    { id: "on", name: "Allumée", params: {} },
    { id: "flat", name: "Plateau à plat", params: { tilt: 0 } },
    { id: "off", name: "Éteinte, relevée", params: { state: "off", tilt: 20 } },
  ],
};

const W = 1.5, D = 1.0, HINGE = 0.9, BOX = 0.16;
const lit = (t = 0) => (x, y, z, nx, ny) => t + (ny > 0.5 ? 0.12 : ny < -0.5 ? -0.3 : 0);

/** Traits d'un dessin gravé sur une feuille (repère de la feuille : x, z dans le plan, centré), en segments [x0,z0,x1,z1]. */
function drawing(rng, w, d) {
  const kind = rng.pick(["plan", "gear", "section"]);
  const s = [];
  const hw = w / 2 - 0.05, hd = d / 2 - 0.05;
  if (kind === "plan") {
    // Plan d'une salle : le contour, un ou deux murs de refend, une porte (le contour coupé).
    const door = rng.range(-hw * 0.5, hw * 0.5);
    s.push([-hw, -hd, door - 0.04, -hd], [door + 0.04, -hd, hw, -hd], [hw, -hd, hw, hd], [hw, hd, -hw, hd], [-hw, hd, -hw, -hd]);
    const x = rng.range(-hw * 0.4, hw * 0.4);
    s.push([x, -hd, x, rng.range(0, hd * 0.6)]);
    if (rng.chance(0.6)) s.push([x, 0, hw, 0]);
  } else if (kind === "gear") {
    // Rouage : un octogone, son moyeu en croix, quatre dents marquées.
    const r = Math.min(hw, hd) * 0.9;
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2, a1 = ((i + 1) / 8) * Math.PI * 2;
      s.push([Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r]);
    }
    s.push([-r * 0.4, 0, r * 0.4, 0], [0, -r * 0.4, 0, r * 0.4]);
  } else {
    // Coupe : un profil en marches, une ligne de cote.
    const n = rng.int(3, 4);
    let x = -hw, z = hd;
    for (let i = 0; i < n; i++) {
      const x1 = x + (2 * hw) / n, z1 = z - rng.range(0.04, (2 * hd) / n);
      s.push([x, z, x1, z], [x1, z, x1, z1]);
      x = x1;
      z = z1;
    }
    s.push([-hw, -hd + 0.03, hw, -hd + 0.03]);
  }
  return s;
}

/**
 * Crée la table.
 * @param {{seed?: number, state?: string, tilt?: number, halo?: string}} [given]
 * @returns {THREE.Group} `userData.surface` : { y, size, tilt } (dessus du verre, à plat) ; `userData.lightPoint`
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 5281 + 443);
  const bronze = [], copper = [], glass = [];
  const tone = rng.range(-0.06, 0.06);
  const a = THREE.MathUtils.degToRad(p.tilt);
  // Le plateau est dessiné à plat, charnière sur l'axe x à l'origine, le dessus à y = 0, l'arrière vers −z ; puis il
  // tourne autour de la charnière (l'arrière monte) et rejoint l'avant des pieds.
  const top = new THREE.Matrix4().makeTranslation(0, HINGE, D / 2).multiply(new THREE.Matrix4().makeRotationX(a));
  const tb = [], tc = [], tg = [];

  // Caisson : quatre parois de bronze, fond sombre, cadre du dessus ; des fentes de lumière sur l'avant et les flancs.
  tb.push(withTone(buildBlock([W, 0.03, 0.05], [0, -0.015, -0.025]), lit(tone - 0.12)));
  tb.push(withTone(buildBlock([W, 0.03, 0.05], [0, -0.015, -D + 0.025]), lit(tone - 0.12)));
  for (const s of [-1, 1]) tb.push(withTone(buildBlock([0.05, 0.03, D - 0.1], [s * (W / 2 - 0.025), -0.015, -D / 2]), lit(tone - 0.12)));
  tb.push(withTone(buildBlock([W, BOX - 0.03, 0.03], [0, -0.03 - (BOX - 0.03) / 2, -0.015]), lit(tone)));
  tb.push(withTone(buildBlock([W, BOX - 0.03, 0.03], [0, -0.03 - (BOX - 0.03) / 2, -D + 0.015]), lit(tone)));
  for (const s of [-1, 1]) tb.push(withTone(buildBlock([0.03, BOX - 0.03, D - 0.06], [s * (W / 2 - 0.015), -0.03 - (BOX - 0.03) / 2, -D / 2]), lit(tone)));
  tb.push(withTone(buildBlock([W - 0.06, 0.02, D - 0.06], [0, -BOX + 0.01, -D / 2]), -0.4));
  const slit = (size, position) => tg.push(buildBlock(size, position));
  for (let i = 0; i < 7; i++) slit([0.1, 0.022, 0.006], [-0.6 + i * 0.2, -0.09, 0.003]);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) slit([0.006, 0.022, 0.1], [s * (W / 2 + 0.003), -0.09, -0.15 - i * 0.23]);
  // Verre dépoli, un pixel sous le cadre.
  tg.push(buildBlock([W - 0.1, 0.012, D - 0.1], [0, -0.012, -D / 2]));

  // Feuilles de cuivre : une à quatre, décalées et un peu tournées, chacune gravée de son dessin.
  const sheets = rng.int(1, 4);
  for (let k = 0; k < sheets; k++) {
    const w = rng.range(0.42, 0.62), d = rng.range(0.32, 0.46);
    const m = new THREE.Matrix4().makeTranslation(rng.range(-0.4, 0.4), 0.002 + k * 0.003, -D / 2 + rng.range(-0.2, 0.2)).multiply(new THREE.Matrix4().makeRotationY(rng.range(-0.25, 0.25)));
    const t = rng.range(-0.08, 0.08);
    tc.push(withTone(buildBlock([w, 0.003, d], [0, 0, 0]).applyMatrix4(m), (x, y, z, nx, ny) => t + (ny > 0.5 ? -0.3 : -0.45)));
    if (k === sheets - 1 || rng.chance(0.5)) {
      for (const [x0, z0, x1, z1] of drawing(rng, w, d)) {
        tc.push(withTone(beam([x0, 0.0025, z0], [x1, 0.0025, z1], 0.022, 0.002).applyMatrix4(m), -0.95));
      }
    }
  }
  // Quatre pinces de laiton : deux à l'avant, deux à l'arrière, mordant sur le cadre.
  for (const z of [-0.03, -D + 0.03]) {
    for (const x of [-0.45 + rng.range(-0.08, 0.08), 0.45 + rng.range(-0.08, 0.08)]) {
      tb.push(withTone(buildBlock([0.06, 0.02, 0.08], [x, 0.012, z]), lit(0.35)));
      tb.push(withTone(buildBlock([0.03, 0.016, 0.04], [x, 0.03, z + (z > -0.5 ? 0.012 : -0.012)]), lit(0.25)));
    }
  }
  // Règle de laiton et compas, posés sur le verre.
  const ruler = new THREE.Matrix4().makeTranslation(rng.range(-0.3, 0.3), 0.006, -0.12 - rng.range(0, 0.12)).multiply(new THREE.Matrix4().makeRotationY(rng.range(-0.3, 0.3)));
  tb.push(withTone(buildBlock([0.7, 0.008, 0.06], [0, 0, 0]).applyMatrix4(ruler), lit(0.35)));
  for (let i = 1; i < 14; i++) tb.push(withTone(buildBlock([0.008, 0.003, i % 2 ? 0.014 : 0.026], [-0.35 + i * 0.05, 0.005, 0.03 - (i % 2 ? 0.007 : 0.013)]).applyMatrix4(ruler), -0.8));
  const cx = rng.range(-0.55, 0.55), cz = -D / 2 + rng.range(-0.25, 0.25), open = rng.range(0.15, 0.4), turn = rng.range(0, Math.PI * 2);
  for (const s of [-1, 1]) {
    const end = [cx + Math.cos(turn + s * open) * 0.2, 0.008, cz + Math.sin(turn + s * open) * 0.2];
    tb.push(withTone(beam([cx, 0.012, cz], end, 0.016, 0.012), lit(0.3)));
  }
  tb.push(withTone(buildBlock([0.04, 0.03, 0.04], [cx, 0.015, cz]), lit(0.4)));

  for (const g of tb) bronze.push(g.applyMatrix4(top));
  for (const g of tc) copper.push(g.applyMatrix4(top));
  for (const g of tg) glass.push(g.applyMatrix4(top));

  // Bâti : quatre pieds, ceinture sous le caisson, traverse basse ; jambe de force jusqu'au fond du caisson.
  const legTop = HINGE - BOX - 0.005;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) bronze.push(withTone(buildBlock([0.05, legTop, 0.05], [sx * 0.66, legTop / 2, sz * 0.42]), lit(tone - 0.05)));
    bronze.push(withTone(buildBlock([0.04, 0.05, 0.84], [sx * 0.66, legTop - 0.03, 0]), lit(tone)));
    bronze.push(withTone(buildBlock([0.03, 0.03, 0.84], [sx * 0.66, 0.16, 0]), lit(tone - 0.1)));
    bronze.push(withTone(buildBlock([0.08, 0.02, 0.08], [sx * 0.66, 0.01, 0.42]), -0.2));
    bronze.push(withTone(buildBlock([0.08, 0.02, 0.08], [sx * 0.66, 0.01, -0.42]), -0.2));
    if (a > 0.01) {
      const foot = new THREE.Vector3(sx * 0.6, legTop - 0.03, -0.4);
      const under = new THREE.Vector3(sx * 0.6, -BOX, -D * 0.8).applyMatrix4(top);
      bronze.push(withTone(beam(foot, under, 0.025, 0.025), lit(0.05)));
    }
  }
  for (const sz of [-1, 1]) bronze.push(withTone(buildBlock([1.32, 0.05, 0.04], [0, legTop - 0.03, sz * 0.42]), lit(tone)));
  bronze.push(withTone(buildBlock([1.32, 0.03, 0.03], [0, 0.16, 0]), lit(tone - 0.1)));
  // Charnières à l'avant.
  for (const x of [-0.5, 0.5]) bronze.push(withTone(buildBlock([0.1, 0.035, 0.035], [x, HINGE - 0.02, D / 2 + 0.005]), lit(0.2)));

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const on = p.state === "on";
  const glassMaterial = on
    ? glowMaterial("amber", { level: 3, id: 40 })
    : createToonMaterial({ ramp: MILKY.ramp, ink: MILKY.ink, steps: [0.25, 0.5, 0.78], id: 40 });
  for (const [name, list, material, shadow] of [
    ["bronze", bronze, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }), true],
    ["sheets", copper, metalMaterial(METALS.copper, { id: 31, tone: true, steps: [0.28, 0.46, 0.68, 0.94] }), false],
    ["glass", glass, glassMaterial, false],
  ]) {
    const mesh = new THREE.Mesh(mergeToned(list), material);
    mesh.name = name;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // Halo : la lumière du verre, au-dessus du milieu du plateau, douce et large.
  const lightPoint = new THREE.Vector3(0, 0.25, -D / 2).applyMatrix4(top);
  const halo = p.halo === "on" && on ? createGlowLight() : null;
  if (halo) {
    glassMaterial.addEventListener("dispose", () => halo.release());
    const color = rgb(GLOWS.amber.light);
    const world = new THREE.Vector3();
    const baseUpdate = group.updateMatrixWorld.bind(group);
    group.updateMatrixWorld = (force) => {
      baseUpdate(force);
      // Un frémissement très léger du tube derrière le verre (1/4 s), pour que la lumière vive.
      const flick = Math.sin(Math.floor(sharedUniforms.uTime.value * 4) * 12.9898 + p.seed) * 0.5 + 0.5;
      halo.set(group.localToWorld(world.copy(lightPoint)), color, 2.6 + flick * 0.15, 0.9);
    };
  }
  group.userData.surface = { y: HINGE, size: [W - 0.1, D - 0.1], tilt: p.tilt };
  group.userData.lightPoint = lightPoint;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
