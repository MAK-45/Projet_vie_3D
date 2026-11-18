// Lustres du Complexe (fiches ARC-16, GAL-12, ORA-13, docs/complexe/) : un cercle de bronze qui porte des ampoules
// ambre de 2 px, pendu à des chaînes en pointillé. Trois modèles :
// - lanterne des Archives : cage de 6 barreaux, 6 ampoules, coupelle de verre ambre au sommet (Ø 0,8 m) ;
// - lustre de la Rotonde : cercle de 3 m portant 24 ampoules, quatre chaînes qui se rejoignent ;
// - anneau de voûte de l'Oracle : 12 ampoules pendues sous un anneau de 1,6 m, trois chaînes.
// Chaque ampoule scintille à son rythme ; la graine en laisse quelques-unes faibles ou mortes. Option `halo`.
//
// 3 draw calls (2 sans la coupelle de verre) : bronze, lueurs, verre.

import * as THREE from "three";
import { createGlowLight, createToonMaterial, rgb, sharedUniforms } from "../../../engine/toon-material.js";
import { buildLathe } from "../../kit/geometry.js";
import { GLASSES, GLOWS, METALS } from "../../kit/palettes.js";
import {
  PX, beam, bulb, chain, createFlicker, glowLevels, glowMixMaterial, mergeToned, metalMaterial, ring, withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, glowParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = { lantern: "Lanterne (Archives)", rotunda: "Grand lustre (Rotonde)", vaultRing: "Anneau de voûte (Oracle)" };
const STATES = { lit: "Allumé", dim: "En veille", off: "Éteint" };
const HALOS = { off: "Sans halo", on: "Éclaire le décor (dans le noir)" };
const BASE = { lit: 2, dim: 1, off: 0 };
const REACH = { lantern: 3.5, rotunda: 6.5, vaultRing: 4.5 };

const params = {
  seed: seedParam("Change les ampoules faibles ou mortes, le rythme des scintillements, la légère gîte du cercle, les tons du bronze."),
  model: choiceParam("Modèle", MODELS, "Lanterne à 6 ampoules et coupelle de verre, grand lustre de 3 m à 24 ampoules, ou anneau de voûte à 12 ampoules."),
  state: choiceParam("État", STATES, "Allumé (scintillement lent), en veille (lueur faible) ou éteint."),
  glow: glowParam("Couleur des filaments."),
  halo: choiceParam("Halo", HALOS, "Éclaire le décor autour de lui dans le noir (lumière de halo : 12 pour toute la scène)."),
  height: numberParam("Hauteur", 3, 2, 12, "Hauteur du cercle d'ampoules au-dessus du sol.", { step: 0.1, unit: "m" }),
  chain: numberParam("Chaîne", 1.5, 0.3, 5, "Longueur de la chaîne principale, jusqu'à la rosace du plafond.", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "furniture/lighting/filament-chandelier",
  name: "Lustre à filaments",
  nameEn: "Filament chandelier",
  category: "furniture",
  subcategory: "lighting",
  description:
    "Lustre du Complexe : un cercle de bronze qui porte des ampoules ambre scintillantes, pendu à des chaînes. " +
    "Lanterne des Archives (6 ampoules, coupelle de verre), grand lustre de la Rotonde (3 m, 24 ampoules) ou anneau " +
    "de voûte de l'Oracle (12 ampoules) ; allumé, en veille ou éteint ; peut éclairer le décor dans le noir. " +
    "Fiches ARC-16, GAL-12, ORA-13.",
  tags: [
    "lustre", "lanterne", "suspension", "ampoules", "filament", "chaînes", "anneau", "bronze", "ambre", "scintillement",
    "le complexe", "complexe", "ancien-tech", "éclairage", "lumineux", "animé", "intérieur",
    "chandelier", "lantern", "pendant light", "light bulbs", "chains", "light ring", "amber", "flicker", "ancient complex",
    "ancient-tech", "lighting", "glowing", "animated", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unité = 1 mètre ; origine au sol, à l'aplomb du centre ; `height` = hauteur du cercle d'ampoules",
  footprint: { radius: 1.6, height: 6.1 },
  animated: ["flicker", "glow"],
  params,
  variants: variantsOf("model", params.model),
};

/**
 * Crée le lustre.
 * @param {{seed?: number, model?: string, state?: string, glow?: string, halo?: string, height?: number, chain?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const bulbsRng = createRng(p.seed * 104729 + 71);
  const h = p.height;
  const bronzeParts = [];
  const glassParts = [];
  const bulbs = []; // positions des ampoules
  let hub; // point où la chaîne principale part vers le plafond

  const add = (g, tone = 0) => bronzeParts.push(tone ? withTone(g, tone) : g);
  const lathe = (profile, segments, tone = 0) => add(buildLathe(profile, { segments, facets: true }), tone);

  if (p.model === "lantern") {
    // Cage de 6 barreaux entre un plateau bas (Ø 0,7) et un anneau haut (Ø 0,56), chapeau, coupelle de verre.
    const yb = h - 0.45, yt = h + 0.42;
    lathe([[0, yb - 0.05], [0.36, yb - 0.05], [0.36, yb], [0, yb]], 12, 0.05);
    lathe([[0, yb - 0.16], [0.05, yb - 0.08], [0.05, yb - 0.05], [0, yb - 0.05]], 6);
    add(ring({ radius: 0.27, y: yt - PX, height: PX * 1.6, thickness: PX, segments: 12 }), 0.1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const [dx, dz] = [Math.cos(a), Math.sin(a)];
      add(beam([dx * 0.34, yb, dz * 0.34], [dx * 0.37, h, dz * 0.37], PX * 0.8, PX * 0.8));
      add(beam([dx * 0.37, h, dz * 0.37], [dx * 0.29, yt, dz * 0.29], PX * 0.8, PX * 0.8));
      // Bras de douille depuis la tige centrale.
      const by = h + (i % 2 ? 0.05 : -0.05);
      add(beam([0, by - 0.06, 0], [dx * 0.15, by - 0.02, dz * 0.15], PX * 0.6, PX * 0.6));
      bulbs.push(new THREE.Vector3(dx * 0.17, by, dz * 0.17));
    }
    add(beam([0, yb, 0], [0, yt, 0], PX, PX), -0.1); // tige centrale
    lathe([[0, yt], [0.32, yt], [0.32, yt + 0.03], [0.1, yt + 0.12], [0, yt + 0.12]], 12, 0.05);
    // Coupelle de verre ambre posée sur le chapeau, et son œillet.
    glassParts.push(buildLathe([[0, yt + 0.12], [0.2, yt + 0.12], [0.2, yt + 0.16], [0.12, yt + 0.27], [0, yt + 0.29]], { segments: 10, facets: true }));
    hub = new THREE.Vector3(0, yt + 0.32, 0);
    add(beam([0, yt + 0.12, 0], hub, PX, PX));
  } else {
    const rotunda = p.model === "rotunda";
    const R = rotunda ? 1.5 : 0.8;
    const count = rotunda ? 24 : 12;
    const chains = rotunda ? 4 : 3;
    // Le cercle : un anneau plat de bronze (et un second, plus fin, à l'intérieur pour la Rotonde).
    add(ring({ radius: R - 0.05, y: h - 0.05, height: 0.1, thickness: 0.07, segments: count * 2 }), 0.05);
    if (rotunda) add(ring({ radius: R - 0.42, y: h - 0.02, height: 0.05, thickness: PX, segments: 24 }), -0.1);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const [dx, dz] = [Math.cos(a), Math.sin(a)];
      const rr = R - 0.015;
      if (rotunda) {
        // Douille debout sur le cercle, ampoule au-dessus.
        add(buildLathe([[0, 0], [0.03, 0], [0.03, 0.07], [0, 0.07]], { segments: 6, facets: true }).translate(dx * rr, h + 0.05, dz * rr), -0.15);
        bulbs.push(new THREE.Vector3(dx * rr, h + 0.17, dz * rr));
      } else {
        // Ampoule pendue sous l'anneau, sur une courte tige.
        add(beam([dx * rr, h - 0.05, dz * rr], [dx * rr, h - 0.13, dz * rr], PX * 0.7, PX * 0.7));
        bulbs.push(new THREE.Vector3(dx * rr, h - 0.21, dz * rr));
      }
    }
    // Rayons (Rotonde) entre les deux cercles.
    if (rotunda) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        add(beam([Math.cos(a) * (R - 0.42), h, Math.sin(a) * (R - 0.42)], [Math.cos(a) * (R - 0.05), h, Math.sin(a) * (R - 0.05)], PX, PX));
      }
    }
    // Chaînes qui se rejoignent au moyeu, au-dessus du centre.
    hub = new THREE.Vector3(0, h + (rotunda ? 1.5 : 0.5), 0);
    for (let k = 0; k < chains; k++) {
      const a = (k / chains) * Math.PI * 2 + Math.PI / 4;
      add(chain([Math.cos(a) * (R - 0.03), h + 0.05, Math.sin(a) * (R - 0.03)], hub, { sag: 0.02, link: 0.08 }));
    }
    lathe([[0, hub.y - 0.06], [0.1, hub.y - 0.06], [0.1, hub.y + 0.02], [0, hub.y + 0.04]], 8, 0.1);
  }

  // Chaîne principale et rosace du plafond.
  const end = hub.y + p.chain;
  add(chain(hub, [0, end, 0], { sag: 0, link: 0.08 }));
  lathe([[0, end], [0.12, end], [0.12, end + 0.03], [0, end + 0.05]], 8, 0.1);

  // Gîte : le cercle penche un peu (une chaîne plus courte), selon la graine.
  const tilt = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(Math.cos(shape.range(0, 6.28)), 0, Math.sin(shape.range(0, 6.28))).normalize(), shape.range(0, 0.035));
  const pivot = new THREE.Matrix4().makeTranslation(0, -end, 0);
  const back = new THREE.Matrix4().makeTranslation(0, end, 0);
  const lean = back.multiply(tilt).multiply(pivot);

  const group = new THREE.Group();
  group.name = meta.name;
  const bronzeGeometry = mergeToned(bronzeParts).applyMatrix4(lean);
  const bronze = new THREE.Mesh(bronzeGeometry, metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronze.name = "frame";
  bronze.castShadow = true;
  group.add(bronze);

  if (glassParts.length) {
    const glass = new THREE.Mesh(mergeToned(glassParts).applyMatrix4(lean), createToonMaterial({ ramp: GLASSES.amber.ramp, ink: GLASSES.amber.ink, steps: [0.3, 0.55, 0.8], crease: true, rim: [0.25, 0.4], id: 32 }));
    glass.name = "glass-cup";
    group.add(glass);
  }

  // Ampoules : une plage de sommets par ampoule, niveau de base tiré de la graine (quelques faibles, de rares mortes).
  const base = BASE[p.state];
  const glowParts = [];
  const flickerBulbs = [];
  let start = 0;
  for (const position of bulbs) {
    let level = base;
    if (base === 2) {
      const r = bulbsRng.next();
      if (r < 0.07) level = 0;
      else if (r < 0.2) level = 1;
    }
    const g = withShade(bulb({ radius: PX * 1.25, position, segments: 6 }), level, 4);
    glowParts.push(g);
    flickerBulbs.push({ start, count: g.attributes.position.count, base: level, phase: bulbsRng.next() });
    start += g.attributes.position.count;
  }
  const glowGeometry = mergeToned(glowParts).applyMatrix4(lean);
  const glowMaterial = glowMixMaterial(glowLevels(p.glow), { id: 31 });
  const lights = new THREE.Mesh(glowGeometry, glowMaterial);
  lights.name = "bulbs";
  group.add(lights);
  const flicker = createFlicker(glowGeometry, flickerBulbs);

  const halo = p.halo === "on" && p.state !== "off" ? createGlowLight() : null;
  if (halo) glowMaterial.addEventListener("dispose", () => halo.release());
  const haloColor = rgb(GLOWS[p.glow].light);
  const center = new THREE.Vector3(0, h, 0).applyMatrix4(lean);
  const haloAt = new THREE.Vector3();
  const reach = REACH[p.model] * (p.state === "lit" ? 1 : 0.6);

  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      flicker(time);
    }
    baseUpdate(force);
    if (halo) halo.set(group.localToWorld(haloAt.copy(center)), haloColor, reach, 1.3);
  };

  group.userData.asset = { id: meta.id, params: p };
  group.userData.lightPoint = center.clone();
  return group;
}
