// Plaque à glyphes du Complexe (fiches SAS-14, GAL-06, ORA-12 et la plaque de COE-15, docs/complexe/) : une plaque
// de métal tenue par 4 plots, gravée de glyphes en creux (traits d'un pixel, vert-de-gris au fond).
// - inscription (Sas) : bronze, 1,2 × 0,8 m, 5 à 7 lignes de glyphes ;
// - direction (galerie) : laiton, 0,6 × 0,3 m, une flèche de 5 px et le « numéro » de la salle en traits
//   (un trait couché vaut 5, un trait debout vaut 1) ;
// - dédicace (Oracle) : bronze, 1,0 × 0,6 m, inclinée sur un socle scellé au sol ;
// - avertissement (Cœur) : laiton, 0,3 × 0,2 m, un glyphe rouge qui luit.
// La graine écrit le texte (glyphes, longueur des lignes), use la plaque, fait parfois tomber un plot.
//
// 2 draw calls : métal (plaque, plots, gravure par tons), lueur rouge (avertissement seulement).

import * as THREE from "three";
import { buildBlock, buildPrism } from "../../kit/geometry.js";
import { METALS } from "../../kit/palettes.js";
import { PX, faceMatrix, glowMaterial, glyphStrip, mergeToned, metalMaterial, orient, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = {
  inscription: "Inscription (1,2 × 0,8 m)",
  direction: "Direction (flèche et numéro de salle)",
  dedication: "Dédicace (inclinée, au sol)",
  warning: "Avertissement (glyphe rouge)",
};
const SIZES = { inscription: [1.2, 0.8], direction: [0.6, 0.3], dedication: [1.0, 0.6], warning: [0.3, 0.2] };
const ARROWS = { right: "Vers la droite", left: "Vers la gauche", none: "Sans flèche" };

const params = {
  seed: seedParam("Change le texte en glyphes et la longueur des lignes, l'usure, le plot qui manque."),
  model: choiceParam("Modèle", MODELS, "Plaque d'inscription du Sas, de direction (galerie), de dédicace (Oracle) ou d'avertissement (Cœur)."),
  room: numberParam("Salle", 1, 1, 10, "Plaque de direction : numéro de la salle d'étude (traits : couché = 5, debout = 1).", { step: 1 }),
  arrow: choiceParam("Flèche", ARROWS, "Plaque de direction : sens de la flèche."),
  height: numberParam("Hauteur", 1.6, 0.3, 4, "Plaques murales : hauteur du centre de la plaque.", { step: 0.05, unit: "m" }),
};

export const meta = {
  id: "props/decor/glyph-plaque",
  name: "Plaque à glyphes",
  nameEn: "Glyph plaque",
  category: "props",
  subcategory: "decor",
  description:
    "Plaque de métal du Complexe tenue par quatre plots, gravée de glyphes en creux (vert-de-gris au fond des traits). " +
    "Inscription de bronze du Sas (5 à 7 lignes), plaque de direction en laiton (flèche et numéro de salle en traits), " +
    "plaque de dédicace inclinée au pied de l'Oracle, ou plaque d'avertissement au glyphe rouge lumineux. " +
    "Fiches SAS-14, GAL-06, ORA-12, COE-15.",
  tags: [
    "plaque", "inscription", "glyphes", "gravure", "signalétique", "direction", "flèche", "dédicace", "avertissement",
    "bronze", "laiton", "le complexe", "complexe", "ancien-tech", "décoration", "intérieur",
    "plaque sign", "engraved glyphs", "signage", "wayfinding", "arrow", "dedication", "warning sign", "brass",
    "ancient complex", "ancient-tech", "decoration", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units:
    "1 unité = 1 mètre ; plaques murales : origine au sol au pied du mur (mur en z = 0, la plaque regarde +z), centre à " +
    "`height` ; dédicace : origine au sol, au centre du socle, la plaque penche vers +z",
  footprint: { radius: 0.75, height: 2.0 },
  animated: [],
  params,
  variants: variantsOf("model", params.model),
};

/**
 * Crée la plaque.
 * @param {{seed?: number, model?: string, room?: number, arrow?: string, height?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 83);
  const [W, H] = SIZES[p.model];
  const T = p.model === "warning" || p.model === "direction" ? 0.02 : 0.03;
  const parts = []; // dans le repère de la plaque : face avant en z = T, centre en (0, 0)
  const glowParts = [];
  const engrave = -0.95; // fond des traits : le ton le plus sombre (vert-de-gris pour le bronze)

  // Plaque : un pixel de biseau plus clair tout autour, la face un cran plus bas (l'usure y remonte par endroits).
  parts.push(withTone(buildBlock([W, H, T - 0.006], [0, 0, (T - 0.006) / 2]), 0.15));
  const face = plain(new THREE.PlaneGeometry(W - PX, H - PX, Math.max(2, Math.round(W / 0.1)), Math.max(2, Math.round(H / 0.1))));
  face.translate(0, 0, T - 0.003);
  const wearX = rng.range(-0.3, 0.3) * W, wearY = rng.range(-0.3, 0.3) * H;
  parts.push(withTone(face, (x, y) => -0.15 + 0.3 * Math.max(0, 1 - Math.hypot((x - wearX) / (W * 0.4), (y - wearY) / (H * 0.5)))));
  const zf = T + 0.001;

  // Plots aux 4 angles ; parfois un manquant (son trou sombre reste).
  const inset = Math.min(0.06, H * 0.15);
  const missing = p.model !== "warning" && rng.chance(0.3) ? rng.int(0, 3) : -1;
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], k) => {
    const x = sx * (W / 2 - inset), y = sy * (H / 2 - inset);
    if (k === missing) parts.push(withTone(buildBlock([PX * 0.7, PX * 0.7, 0.003], [x, y, zf]), -1));
    else parts.push(withTone(orient(plain(new THREE.CylinderGeometry(Math.min(PX * 0.6, H * 0.07), Math.min(PX * 0.7, H * 0.08), 0.02, 6)), [x, y, zf + 0.008], [0, 0, 1]), 0.4));
  });

  // Une ligne de glyphes gravés : bande de glyphes à plat, au ton du fond des traits.
  const line = (length, y, pixel) => {
    const strip = glyphStrip(rng, { length, rows: 2, pixel, depth: 0.002 });
    strip.translate(rng.range(-0.02, 0.02) * W, y - pixel, zf - 0.001);
    parts.push(withTone(strip, engrave));
  };

  if (p.model === "inscription" || p.model === "dedication") {
    const lines = p.model === "inscription" ? rng.int(5, 7) : rng.int(3, 4);
    const pixel = PX * 0.5;
    const usable = H - 2 * inset - 0.06;
    const gap = Math.min(0.12, usable / lines);
    for (let i = 0; i < lines; i++) {
      const y = usable / 2 - gap * (i + 0.5);
      const full = W - 2 * inset - 0.12;
      const length = i === 0 ? full * rng.range(0.4, 0.6) : i === lines - 1 ? full * rng.range(0.3, 0.7) : full * rng.range(0.8, 1);
      line(length, y, pixel);
      if (i === 0) parts.push( // filet gravé sous le titre
        withTone(buildBlock([full, PX * 0.4, 0.002], [0, y - gap * 0.5, zf - 0.001]), engrave));
    }
  } else if (p.model === "direction") {
    // Flèche de 5 px (hampe et pointe) et numéro de salle en traits.
    const sign = p.arrow === "left" ? -1 : 1;
    const ax = p.arrow === "none" ? 0 : -sign * W * 0.18;
    if (p.arrow !== "none") {
      parts.push(withTone(buildBlock([PX * 5, PX, 0.002], [ax, 0, zf]), engrave));
      for (let k = 1; k <= 2; k++) {
        for (const s of [-1, 1]) parts.push(withTone(buildBlock([PX, PX, 0.002], [ax + sign * (PX * 2.5 - k * PX), s * k * PX, zf]), engrave));
      }
    }
    const nx = p.arrow === "none" ? 0 : sign * W * 0.2;
    const room = Math.round(p.room);
    const fives = Math.floor(room / 5), ones = room % 5;
    let y = PX * 1.5;
    for (let i = 0; i < fives; i++, y -= PX * 1.5) parts.push(withTone(buildBlock([PX * 4, PX * 0.8, 0.002], [nx, y, zf]), engrave));
    if (ones) {
      const top = fives ? y + PX * 0.5 : PX * 1.5;
      const h = fives ? PX * 2 : PX * 4;
      for (let i = 0; i < ones; i++) parts.push(withTone(buildBlock([PX * 0.8, h, 0.002], [nx + (i - (ones - 1) / 2) * PX * 1.5, top - h / 2, zf]), engrave));
    }
    // Petite ligne de glyphes en bas (le nom de la salle).
    line(W * 0.5, -H / 2 + inset + PX * 0.6, PX * 0.35);
  } else {
    // Avertissement : glyphe rouge lumineux (la plaque ne fait que 5 × 3 pixels : un trait coudé et un point, cerclés
    // d'un cadre gravé).
    const g = [];
    const s = H / 9;
    g.push(buildBlock([s, s * 3.2, 0.004], [-s * 0.5, s * 1.4, zf + 0.001]));
    g.push(buildBlock([s * 2, s, 0.004], [0, 0, zf + 0.001]));
    g.push(buildBlock([s, s * 1.6, 0.004], [s * 0.5, -s * 1.3, zf + 0.001]));
    g.push(buildBlock([s, s, 0.004], [s * 2.2, -s * 2.6, zf + 0.001]));
    parts.push(withTone(buildBlock([W - inset * 2.4, PX * 0.3, 0.002], [0, H / 2 - inset * 0.6, zf]), engrave));
    parts.push(withTone(buildBlock([W - inset * 2.4, PX * 0.3, 0.002], [0, -H / 2 + inset * 0.6, zf]), engrave));
    glowParts.push(...g);
  }

  // Pose de la plaque : au mur, ou inclinée sur un socle (dédicace).
  const group = new THREE.Group();
  group.name = meta.name;
  let frame;
  if (p.model === "dedication") {
    // Plaque inclinée à 35° de l'horizontale, face vers le haut et vers +z, sur un socle en coin de bronze sombre.
    const tilt = THREE.MathUtils.degToRad(35);
    const base = 0.22;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    frame = faceMatrix(new THREE.Vector3(0, base + (H / 2) * s, 0), new THREE.Vector3(0, c, s));
    for (const g of parts) g.applyMatrix4(frame);
    const hx = W / 2 - 0.02, zf0 = (H / 2) * c - 0.02, zb0 = -(H / 2) * c + 0.02;
    const top = (x, z) => base + (H / 2) * s - z * Math.tan(tilt) - 0.012 / c;
    parts.push(withTone(plain(buildPrism([[-hx, zb0], [hx, zb0], [hx, zf0], [-hx, zf0]], 0.04, top)), -0.25));
    parts.push(withTone(buildBlock([W + 0.1, 0.04, H * c + 0.1], [0, 0.02, 0]), -0.45)); // semelle scellée
  } else {
    frame = new THREE.Matrix4().makeTranslation(0, p.height, 0.004);
    for (const g of parts) g.applyMatrix4(frame);
  }
  for (const g of glowParts) g.applyMatrix4(frame);

  const metalEntry = p.model === "direction" || p.model === "warning" ? METALS.blackenedBrass : METALS.patinatedBronze;
  const metal = new THREE.Mesh(mergeToned(parts), metalMaterial(metalEntry, { id: 30, tone: true }));
  metal.name = "plaque";
  metal.castShadow = true;
  metal.receiveShadow = true;
  group.add(metal);
  if (glowParts.length) {
    const glow = new THREE.Mesh(mergeToned(glowParts), glowMaterial("alarm", { level: 3, id: 40 }));
    glow.name = "glyph";
    group.add(glow);
  }
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
