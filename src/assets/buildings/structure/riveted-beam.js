// Poutre rivetée du Complexe (fiche ATE-16, docs/complexe/PIECES.md ; aussi les rails de laiton du pont roulant de la
// salle 10, E10-05, et de la potence à sonde, ETU-08) : profil en I de bronze patiné, 0,2 × 0,4 m, de 2 à 24 m.
// Les deux ailes un ton plus clair que l'âme en retrait (le I se lit de loin), des rangées de rivets d'un pixel sur le
// dessus et sur l'âme, des raidisseurs verticaux réguliers, des éclisses rivetées aux joints des tronçons (tous les 3 à
// 4,5 m), quelques coulures de vert-de-gris.
// Modèles : poutre, poutre-rail (aile basse élargie, polie par les galets d'un palan), rail de laiton (profil en T).
// Appuis : corbeaux de pierre ou consoles de bronze aux deux bouts, consoles le long d'un mur, suspentes au plafond,
// posée au sol, ou rien.
// La graine change la place des joints et des éclisses, le pas des raidisseurs, le ton de chaque tronçon, les coulures,
// quelques rivets manquants.
//
// 2 draw calls : métal (profil, éclisses, rivets, consoles), pierre (corbeaux ; absente sans corbeaux).
// `group.userData.rail` : { start, end, running, underside, top, length, wall } pour poser un palan ou un pont roulant.

import * as THREE from "three";
import { buildBlock, buildPrism, buildQuads } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import { PX, beam, metalMaterial, mergeToned, stoneMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = { beam: "Poutre en I", "beam-rail": "Poutre-rail (aile basse pour un palan)", rail: "Rail de laiton (profil en T)" };
const SUPPORTS = {
  corbels: "Corbeaux de pierre aux bouts",
  brackets: "Consoles de bronze aux bouts",
  consoles: "Consoles le long d'un mur",
  hangers: "Suspentes au plafond",
  floor: "Posée au sol",
  none: "Sans appui",
};
const PATINAS = { new: "Neuve", patinated: "Patinée", verdigris: "Vert-de-gris" };
// Rampes par patine : bronze pour les poutres, laiton pour le rail.
const BEAM_METAL = { new: METALS.bronze, patinated: METALS.patinatedBronze, verdigris: METALS.oxidizedCopper };
const RAIL_METAL = { new: METALS.gold, patinated: METALS.blackenedBrass, verdigris: METALS.oxidizedCopper };
// Le mur des consoles est derrière la poutre (−z), à cette distance de son axe.
const WALL = 0.42;
// Suspentes : le plafond est à cette hauteur au-dessus du dessus du profil.
const HANG = 0.5;

const params = {
  seed: seedParam("Change la place des joints et des éclisses, le pas des raidisseurs, le ton de chaque tronçon, les coulures de vert-de-gris, quelques rivets manquants."),
  model: choiceParam("Modèle", MODELS, "Poutre en I de 0,2 × 0,4 m, poutre-rail à aile basse élargie et polie (un palan y roule), ou rail de laiton en T de 0,12 m (pont roulant, potence à sonde)."),
  length: numberParam("Longueur", 12, 2, 24, "Longueur de la poutre ou du rail.", { step: 0.5, unit: "m" }),
  height: numberParam("Hauteur", 5, 0, 14, "Hauteur du dessous du profil (ignorée posée au sol). Plafond de l'Atelier : 5,5 m, poutres à 5,0 m.", { step: 0.1, unit: "m" }),
  support: choiceParam("Appui", SUPPORTS, "Corbeaux de pierre ou consoles de bronze aux deux bouts (les bouts entrent dans le mur), consoles tous les 2 m le long d'un mur (derrière, à 0,42 m de l'axe), suspentes de 0,5 m sous un plafond, posée au sol, ou rien."),
  patina: choiceParam("Patine", PATINAS, "Bronze ou laiton neuf, patiné (vert-de-gris dans l'ombre), ou couvert de vert-de-gris.", "patinated"),
};

export const meta = {
  id: "buildings/structure/riveted-beam",
  name: "Poutre rivetée",
  nameEn: "Riveted beam",
  category: "buildings",
  subcategory: "structure",
  description:
    "Poutre de plafond du Complexe : profil en I de bronze patiné à rangées de rivets d'un pixel, raidisseurs et " +
    "éclisses rivetées, de 2 à 24 m. Poutre-rail à aile basse polie pour un palan, ou rail de laiton en T pour le pont " +
    "roulant et la potence à sonde ; sur corbeaux, consoles, suspentes ou au sol. Fiche ATE-16 (rails de E10-05, ETU-08).",
  tags: [
    "poutre", "poutre rivetée", "profil en i", "rivets", "éclisse", "raidisseur", "rail", "rail de palan", "laiton",
    "corbeau", "console", "suspente", "plafond", "charpente", "atelier", "le complexe", "complexe", "ancien-tech",
    "intérieur",
    "beam", "riveted beam", "i-beam", "girder", "rivet rows", "splice plate", "stiffener", "runway rail", "brass rail",
    "corbel", "wall bracket", "hanger rod", "ceiling", "framework", "workshop", "ancient complex", "ancient-tech",
    "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units:
    "1 unité = 1 mètre ; origine au sol sous le milieu de la poutre, qui suit x ; `height` = dessous du profil ; les " +
    "bouts (corbeaux, consoles de bout) entrent dans des murs en x = ±longueur/2 ; le mur des consoles est en z = −0,42",
  footprint: { radius: 6.1, height: 5.6 },
  animated: [],
  params,
  variants: [
    { id: "beam", name: "Poutre sur corbeaux", params: {} },
    { id: "beam-rail", name: "Poutre-rail, consoles", params: { model: "beam-rail", length: 8, support: "brackets" } },
    { id: "rail-wall", name: "Rail de laiton sur consoles", params: { model: "rail", length: 8, support: "consoles", patina: "new" } },
    { id: "rail-floor", name: "Rail au sol", params: { model: "rail", length: 4, support: "floor" } },
    { id: "hung", name: "Suspendue, vert-de-gris", params: { length: 6, support: "hangers", patina: "verdigris" } },
  ],
};

/**
 * Crée la poutre ou le rail.
 * @param {{seed?: number, model?: string, length?: number, height?: number, support?: string, patina?: string}} [given]
 * @returns {THREE.Group} `group.userData.rail` : { start, end (Vector3, sur la surface de roulement), running (hauteur
 *   de la surface de roulement : dessus de l'aile basse d'une poutre-rail, dessus du champignon d'un rail), underside,
 *   top, length, wall (z du mur des consoles) }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 6151 + 433);
  const L = p.length;
  const y0 = p.support === "floor" ? 0 : p.height;
  const rail = p.model === "rail";
  const metal = [];
  const stone = [];
  const rivets = []; // quads d'un pixel : { position, size, normal, tone }

  // --- Le profil, en tronçons de 3 à 4,5 m (joints tirés de la graine, jamais à moins de 1 m d'un bout). -----------
  const joints = [];
  for (let x = -L / 2 + rng.range(3, 4.5); x < L / 2 - 1; x += rng.range(3, 4.5)) joints.push(x);
  const cuts = [-L / 2, ...joints, L / 2];
  const sectionTone = cuts.slice(1).map(() => rng.range(-0.08, 0.08));

  let top, running, flangeW;
  if (rail) {
    // Rail en T : patin de 0,12 × 0,02, âme de 0,025, champignon de 0,07 × 0,05 au dessus poli.
    top = y0 + 0.12;
    running = top;
    flangeW = 0.12;
    cuts.slice(1).forEach((x1, i) => {
      const x0 = cuts[i], l = x1 - x0 - 0.004, cx = (x0 + x1) / 2, t = sectionTone[i];
      metal.push(withTone(buildBlock([l, 0.02, 0.12], [cx, y0 + 0.01, 0]), t - 0.1));
      metal.push(withTone(buildBlock([l, 0.05, 0.03], [cx, y0 + 0.045, 0]), t - 0.3));
      metal.push(withTone(buildBlock([l, 0.05, 0.07], [cx, y0 + 0.095, 0]), (x, y, z, nx, ny) => t + (ny > 0.5 ? 0.35 : 0.05)));
      // Éclisse de rail aux joints : deux plaques de part et d'autre de l'âme, deux boulons chacune.
      if (i > 0) for (const s of [-1, 1]) {
        metal.push(withTone(buildBlock([0.24, 0.045, 0.012], [x0, y0 + 0.045, s * 0.022]), 0.1));
        for (const dx of [-0.07, 0.07]) rivets.push({ position: [x0 + dx, y0 + 0.045, s * 0.029], size: [PX * 0.8, PX * 0.8], normal: [0, 0, s], tone: 0.4 });
      }
    });
  } else {
    // Poutre en I : ailes de 0,06, âme de 0,05 en retrait (−0,3) ; la poutre-rail a l'aile basse élargie (0,28).
    const H = 0.4, tf = 0.06, tw = 0.05, W = 0.2;
    const Wb = p.model === "beam-rail" ? 0.28 : W;
    const tb = p.model === "beam-rail" ? 0.07 : tf;
    top = y0 + H;
    running = y0 + tb;
    flangeW = Wb;
    const webY0 = y0 + tb, webY1 = top - tf, webH = webY1 - webY0, webY = (webY0 + webY1) / 2;
    cuts.slice(1).forEach((x1, i) => {
      const x0 = cuts[i], l = x1 - x0 - 0.006, cx = (x0 + x1) / 2, t = sectionTone[i];
      // Aile haute : le dessus un cran plus bas (−0,17) pour que ses rivets puissent être plus clairs.
      metal.push(withTone(buildBlock([l, tf, W], [cx, top - tf / 2, 0]), (x, y, z, nx, ny) => t + (ny > 0.5 ? -0.17 : 0.08)));
      metal.push(withTone(buildBlock([l, webH, tw], [cx, webY, 0]), t - 0.3));
      metal.push(withTone(buildBlock([l, tb, Wb], [cx, y0 + tb / 2, 0]), (x, y, z, nx, ny) => t + (ny > 0.5 ? -0.12 : 0.05)));
      // Poutre-rail : deux bandes polies par les galets sur le dessus de l'aile basse, de part et d'autre de l'âme.
      if (p.model === "beam-rail") {
        for (const s of [-1, 1]) metal.push(withTone(buildBlock([l, 0.004, 0.05], [cx, running + 0.002, s * (tw / 2 + 0.045)]), 0.55));
      }
    });
    // Raidisseurs : plaques verticales de part et d'autre de l'âme, au pas de 1,1 à 1,6 m (graine), pas sur un joint.
    const pitch = rng.range(1.1, 1.6);
    const stiffeners = [];
    for (let x = -L / 2 + pitch / 2 + rng.range(0, 0.3); x < L / 2 - 0.2; x += pitch) {
      if (joints.some((j) => Math.abs(j - x) < 0.3)) continue;
      stiffeners.push(x);
      for (const s of [-1, 1]) {
        const d = (Math.min(W, Wb) - tw) / 2 - 0.01;
        metal.push(withTone(buildBlock([0.025, webH, d], [x, webY, s * (tw / 2 + d / 2)]), 0.12));
      }
    }
    // Éclisses aux joints : une plaque sur chaque face de l'âme et un couvre-joint sur l'aile haute, rivetés.
    for (const x of joints) {
      for (const s of [-1, 1]) {
        metal.push(withTone(buildBlock([0.34, webH - 0.03, 0.014], [x, webY, s * (tw / 2 + 0.007)]), 0.15));
        for (const dx of [-0.11, 0, 0.11]) for (const dy of [-1, 1]) {
          rivets.push({ position: [x + dx, webY + dy * webH * 0.26, s * (tw / 2 + 0.018)], size: [PX, PX], normal: [0, 0, s], tone: 0.45 });
        }
      }
      metal.push(withTone(buildBlock([0.36, 0.012, W - 0.02], [x, top + 0.006, 0]), -0.05));
      for (const dx of [-0.12, -0.04, 0.04, 0.12]) for (const dz of [-1, 1]) {
        rivets.push({ position: [x + dx, top + 0.0135, dz * 0.05], size: [PX * 0.9, PX * 0.9], normal: [0, 1, 0], tone: 0.35 });
      }
    }
    // Rivets en rangées : deux sur le dessus de l'aile haute, une sur chaque face de l'âme ; quelques-uns manquent.
    const near = (x, list, d) => list.some((j) => Math.abs(j - x) < d);
    for (let x = -L / 2 + 0.125; x < L / 2 - 0.05; x += 0.25) {
      if (near(x, joints, 0.22)) continue;
      for (const s of [-1, 1]) {
        if (rng.next() > 0.05) rivets.push({ position: [x + s * 0.0625, top + 0.002, s * 0.055], size: [PX * 0.9, PX * 0.9], normal: [0, 1, 0], tone: 0.3 });
        if (near(x, stiffeners, 0.06)) continue;
        if (rng.next() > 0.05) rivets.push({ position: [x, webY + 0.08, s * (tw / 2 + 0.003)], size: [PX * 0.9, PX * 0.9], normal: [0, 0, s], tone: 0.5 });
      }
    }
    // Coulures de vert-de-gris sur l'âme et le flanc des ailes (plus nombreuses avec la patine).
    const streaks = { new: 2, patinated: 6, verdigris: 12 }[p.patina] + rng.int(0, 3);
    for (let k = 0; k < streaks; k++) {
      const x = rng.range(-L / 2 + 0.2, L / 2 - 0.2), s = rng.next() < 0.5 ? -1 : 1;
      const h = rng.range(0.08, webH - 0.02);
      rivets.push({ position: [x, webY1 - h / 2, s * (tw / 2 + 0.002)], size: [PX * 0.7, h], normal: [0, 0, s], tone: -0.55 });
    }
    // Appuis aux bouts.
    if (p.support === "corbels") {
      // Corbeau de pierre fumée : sort du mur de 0,55 m, dessous en biseau, plaque d'appui de bronze dessus.
      for (const s of [-1, 1]) {
        const xw = s * L / 2, xi = s * (L / 2 - 0.55);
        // Profil dans le plan xy (d : profondeur sous la poutre), extrudé en z : buildPrism dans un repère tourné.
        const outline = [[xw, 0], [xi, 0], [xi, 0.12], [s * (L / 2 - 0.22), 0.38], [xw, 0.38]];
        const g = buildPrism(outline, -0.17, () => 0.17);
        g.rotateX(Math.PI / 2);
        g.translate(0, y0 - 0.015, 0);
        const t = rng.range(-0.06, 0.06);
        stone.push(withTone(g, (x, y, z, nx, ny) => t + (ny > 0.5 ? 0.1 : 0)));
        metal.push(withTone(buildBlock([0.5, 0.015, Wb + 0.06], [s * (L / 2 - 0.26), y0 - 0.0075, 0]), -0.05));
      }
    } else if (p.support === "brackets") {
      for (const s of [-1, 1]) endBracket(metal, rivets, s, L, y0, top, Wb);
    }
  }

  // --- Appuis réguliers (poutre ou rail). ----------------------------------------------------------------------
  const along = (step) => {
    const n = Math.max(2, Math.round(L / step) + 1);
    return Array.from({ length: n }, (_, i) => -L / 2 + 0.3 + (i * (L - 0.6)) / (n - 1));
  };
  if (p.support === "consoles") {
    // Consoles de bronze tous les 2 m : platine contre le mur (z = −0,42), bras sous le profil, jambe de force.
    for (const x of along(2)) {
      const arm = y0 - 0.06;
      metal.push(withTone(buildBlock([0.16, 0.5, 0.025], [x, arm - 0.18, -WALL + 0.0125]), -0.1));
      metal.push(withTone(beam([x, arm + 0.03, -WALL + 0.02], [x, arm + 0.03, flangeW / 2 + 0.03], 0.08, 0.06), 0.05));
      metal.push(withTone(beam([x, arm - 0.4, -WALL + 0.03], [x, arm, -0.02], 0.05, 0.04), -0.05));
      for (const dy of [0.02, -0.36]) rivets.push({ position: [x, arm + dy, -WALL + 0.027], size: [PX, PX], normal: [0, 0, 1], tone: 0.4 });
    }
  } else if (p.support === "hangers") {
    // Suspentes : tige ronde montant à une platine de plafond, chape sur le dessus du profil.
    for (const x of along(2)) {
      metal.push(withTone(buildBlock([0.03, HANG, 0.03], [x, top + HANG / 2, 0]), 0.05));
      metal.push(withTone(buildBlock([0.08, 0.05, flangeW + 0.04], [x, top + 0.025, 0]), 0.1));
      metal.push(withTone(buildBlock([0.14, 0.02, 0.14], [x, top + HANG - 0.01, 0]), -0.25));
      metal.push(withTone(buildBlock([0.07, 0.05, 0.07], [x, top + HANG * 0.55, 0]), 0.2));
    }
  } else if (p.support === "floor" && rail) {
    // Rail au sol : selles de bronze boulonnées tous les 0,6 m.
    for (const x of along(0.6)) {
      metal.push(withTone(buildBlock([0.08, 0.014, 0.22], [x, 0.007, 0]), -0.15));
      for (const s of [-1, 1]) rivets.push({ position: [x, 0.0145, s * 0.085], size: [PX * 0.8, PX * 0.8], normal: [0, 1, 0], tone: 0.4 });
    }
  } else if (p.support === "floor") {
    // Poutre en réserve, posée au sol sur deux cales de bois sombre (dans le bronze, ton très bas).
    for (const s of [-1, 1]) metal.push(withTone(buildBlock([0.12, 0.08, 0.5], [s * L * 0.32, 0.04, 0]), -0.7));
  } else if (rail && (p.support === "corbels" || p.support === "brackets")) {
    for (const s of [-1, 1]) endBracket(metal, rivets, s, L, y0, top, flangeW);
  }
  // Posée au sol, la poutre en réserve repose sur ses cales.
  const lift = p.support === "floor" && !rail ? 0.08 : 0;

  // --- Maillages. ---------------------------------------------------------------------------------------------
  if (rivets.length) metal.push(buildQuads(rivets));
  const ramp = (rail ? RAIL_METAL : BEAM_METAL)[p.patina];
  const group = new THREE.Group();
  group.name = meta.name;
  const add = (name, geometries, material) => {
    if (!geometries.length) return;
    const geometry = mergeToned(geometries);
    if (lift) geometry.translate(0, lift, 0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add("metal", metal, metalMaterial(ramp, { id: 30, tone: true }));
  add("stone", stone, stoneMaterial(STONES.smoked, { seed: p.seed % 97, id: 20 }));

  const y = running + lift;
  group.userData.rail = {
    start: new THREE.Vector3(-L / 2, y, 0),
    end: new THREE.Vector3(L / 2, y, 0),
    running: y,
    underside: y0 + lift,
    top: top + lift,
    length: L,
    wall: -WALL,
  };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

// Console de bout : platine de bronze contre le mur du bout (x = ±L/2), assise sous le profil, jambe de force.
function endBracket(metal, rivets, s, L, y0, top, w) {
  const xw = s * L / 2;
  metal.push(withTone(buildBlock([0.025, 0.8, w + 0.12], [xw - s * 0.0125, y0 - 0.2, 0]), -0.1));
  metal.push(withTone(buildBlock([0.5, 0.025, w + 0.04], [xw - s * 0.25, y0 - 0.0125, 0]), 0.05));
  for (const dz of [-1, 1]) {
    metal.push(withTone(beam([xw - s * 0.02, y0 - 0.55, dz * (w / 2 - 0.01)], [xw - s * 0.45, y0 - 0.02, dz * (w / 2 - 0.01)], 0.04, 0.03), -0.05));
  }
  for (const dy of [-0.08, -0.5]) for (const dz of [-1, 1]) {
    rivets.push({ position: [xw - s * 0.027, y0 + dy, dz * (w / 2 + 0.02)], size: [PX, PX], normal: [-s, 0, 0], tone: 0.4 });
  }
  void top;
}
