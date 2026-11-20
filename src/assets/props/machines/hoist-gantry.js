// Levage du Complexe : portique roulant de l'Atelier (fiche ATE-12, 3,2 × 2,4 × 3,8 m), palan suspendu à une
// poutre-rail (la poutre rivetée, ATE-16) et pont roulant de la salle de la Porte (E10-05, portée jusqu'à 18 m sur des
// rails de laiton).
// - Portique : deux chevalets en A de bronze à goussets rivetés, sur quatre roulettes de fonte, une poutre haute dont
//   l'aile basse porte un chariot à galets ; sous le chariot, un palan à chaîne : carter de fonte, volant de manœuvre
//   et sa chaîne de commande qui pend en boucle, chaîne de charge en pointillé jusqu'au moufle et au crochet.
// - Palan sur poutre : le même chariot et le même palan, sous un tronçon de 2,4 m de poutre-rail (ou sous la poutre du
//   monde : `rails: "off"`).
// - Pont roulant : deux poutres rivetées jumelles posées sur deux sommiers à galets qui roulent sur les rails, un
//   chariot à treuil (tambour de fonte, moteur à bobines de cuivre) sur les poutres, la chaîne qui descend entre elles.
// Charge au crochet : rien, une caisse, des lingots de cuivre en élingue, une ébauche de roue dentée.
// La graine change l'usure (tons), la place de repos du chariot et du crochet (± un peu autour des réglages), la
// plaque de charge à glyphes, la boucle de la chaîne de commande.
//
// 3 draw calls au plus : bronze (ossature, chariot, moufle, roue), fonte (roulettes, carter, chaînes, crochet),
// charge (caisse de bois ou lingots de cuivre ; absent sinon).
// `group.userData.hoist` : setLift(0..1), liftTo(v), setTrolley(0..1), trolleyTo(v), roll(d), hook (point du crochet),
// feet (appuis au sol, pour les collisions du monde), loop.

import * as THREE from "three";
import { createToonMaterial, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads } from "../../kit/geometry.js";
import { METALS, WOODS } from "../../kit/palettes.js";
import { PX, beam, createRigidParts, gearWheel, mergeParts, metalMaterial, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = { gantry: "Portique roulant (3,2 m)", "beam-hoist": "Palan sur poutre-rail", crane: "Pont roulant" };
const LOADS = { none: "Rien", crate: "Caisse", ingots: "Lingots de cuivre", gear: "Ébauche de roue dentée" };
const STATES = { idle: "Immobile", loop: "En boucle (le crochet monte, attend, redescend)" };
const RAILS = { on: "Avec (tronçon de poutre ou de rails)", off: "Sans (posé sous ceux du monde)" };

const params = {
  seed: seedParam("Change l'usure, la place de repos du chariot et du crochet (un peu autour des réglages), la plaque de charge, la boucle de la chaîne de commande."),
  model: choiceParam("Modèle", MODELS, "Portique de l'Atelier sur roulettes, palan qui roule sous une poutre-rail, ou pont roulant sur deux rails (salle de la Porte)."),
  load: choiceParam("Charge", LOADS, "Ce qui pend au crochet.", "crate"),
  lift: numberParam("Crochet", 0.4, 0, 1, "Hauteur du crochet : 0 en bas (la charge frôle le sol), 1 tout en haut. Pilotable : userData.hoist.setLift(v), liftTo(v).", { step: 0.05 }),
  trolley: numberParam("Chariot", 0.5, 0, 1, "Place du chariot le long de la poutre (0 à 1). Pilotable : setTrolley(v), trolleyTo(v).", { step: 0.05 }),
  state: choiceParam("État", STATES, "Immobile, ou en boucle : le crochet monte en 4 s, attend 2 s, redescend en 4 s."),
  span: numberParam("Portée", 10, 6, 18, "Pont roulant : écart entre les deux rails (17,4 m dans la salle de la Porte).", { step: 0.2, unit: "m" }),
  railHeight: numberParam("Hauteur du rail", 5, 2.5, 14, "Palan sur poutre : dessus de l'aile basse de la poutre-rail (poutre rivetée à 5,0 m : 5,07) ; pont roulant : dessus des rails (10 m dans la salle de la Porte). Le portique a sa propre hauteur (3,8 m).", { step: 0.1, unit: "m" }),
  rails: choiceParam("Poutre ou rails", RAILS, "Palan sur poutre et pont roulant : dessiner le tronçon de poutre-rail ou les rails (vitrine), ou non (le monde pose les siens)."),
};

export const meta = {
  id: "props/machines/hoist-gantry",
  name: "Portique et pont roulant",
  nameEn: "Hoist gantry and overhead crane",
  category: "props",
  subcategory: "machines",
  description:
    "Levage du Complexe : portique roulant de bronze à chevalets en A sur roulettes, palan à chaîne sous une " +
    "poutre-rail, ou pont roulant à poutres rivetées jumelles sur rails de laiton. Chaîne en pointillé, volant de " +
    "manœuvre, moufle et crochet qui montent et descendent avec leur charge (caisse, lingots, roue dentée). " +
    "Fiches ATE-12, E10-05.",
  tags: [
    "portique", "palan", "pont roulant", "levage", "crochet", "chaîne", "moufle", "volant", "chariot", "roulettes",
    "poutre-rail", "treuil", "caisse", "lingots", "roue dentée", "atelier", "le complexe", "complexe", "ancien-tech",
    "animé", "pilotable", "intérieur",
    "gantry", "chain hoist", "overhead crane", "lifting", "hook", "load chain", "hook block", "hand wheel", "trolley",
    "casters", "runway beam", "winch", "crate", "copper ingots", "gear blank", "workshop", "ancient complex",
    "ancient-tech", "animated", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units:
    "1 unité = 1 mètre ; origine au sol sous le milieu de la poutre (portique, palan) ou du pont, qui suit x ; le " +
    "pont roule le long de z sur des rails en x = ±portée/2",
  footprint: { radius: 5.3, height: 6.5 },
  animated: ["hook"],
  params,
  variants: [
    { id: "gantry", name: "Portique, caisse", params: {} },
    { id: "gantry-gear", name: "Portique, roue dentée", params: { load: "gear", lift: 0.6 } },
    { id: "beam-hoist", name: "Palan sur poutre", params: { model: "beam-hoist", load: "ingots", railHeight: 4 } },
    { id: "crane", name: "Pont roulant", params: { model: "crane", span: 8, railHeight: 5, load: "none", lift: 0.3 } },
  ],
};

const TROLLEY = 0, HOOK = 1, WHEEL = 2, ROLLERS = 3; // pièces rigides ; les maillons suivent à partir de LINKS
const LINKS = 7;
const FIXED = 255;

// Maillon : un barreau sans bouts (8 triangles), tourné d'un quart de tour sur le précédent.
function link(a, b, w, k) {
  const g = beam(a, b, w, w * 0.5, k % 2 ? Math.PI / 4 : -Math.PI / 4);
  g.setIndex(Array.from(g.index.array.slice(0, 24)));
  return g;
}
// Chaîne fixe (commande, élingues) de `from` à `to`, en maillons d'environ `pitch`.
function chainLinks(from, to, pitch = 0.085, w = PX * 0.75) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const n = Math.max(1, Math.round(a.distanceTo(b) / pitch));
  const out = [];
  for (let i = 0; i < n; i++) out.push(link(a.clone().lerp(b, i / n), a.clone().lerp(b, (i + 1) / n), w, i));
  return out;
}
// Profil en I le long de x (de x0 à x1), dessous de l'aile basse en y0.
function iProfile(out, rivets, x0, x1, y0, { H = 0.4, W = 0.2, Wb = W, tf = 0.06, tb = tf, tw = 0.05, tone = 0, stiff = 0.8, z = 0 } = {}) {
  const l = x1 - x0, cx = (x0 + x1) / 2, top = y0 + H;
  const first = out.length;
  out.push(withTone(buildBlock([l, tf, W], [cx, top - tf / 2, 0]), (x, y, z, nx, ny) => tone + (ny > 0.5 ? -0.17 : 0.08)));
  out.push(withTone(buildBlock([l, H - tf - tb, tw], [cx, y0 + tb + (H - tf - tb) / 2, 0]), tone - 0.3));
  out.push(withTone(buildBlock([l, tb, Wb], [cx, y0 + tb / 2, 0]), (x, y, z, nx, ny) => tone + (ny > 0.5 ? 0.3 : 0.05)));
  const webH = H - tf - tb, webY = y0 + tb + webH / 2;
  const n = Math.max(1, Math.round(l / stiff));
  for (let i = 1; i < n; i++) {
    const x = x0 + (i * l) / n;
    for (const s of [-1, 1]) out.push(withTone(buildBlock([0.025, webH, (W - tw) / 2 - 0.01], [x, webY, s * (tw / 2 + (W - tw) / 4)]), tone + 0.12));
  }
  for (let x = x0 + 0.125; x < x1 - 0.05; x += 0.25) {
    for (const s of [-1, 1]) rivets.push({ position: [x + s * 0.06, top + 0.002, z + s * W * 0.27], size: [PX * 0.9, PX * 0.9], normal: [0, 1, 0], tone: tone + 0.3 });
  }
  if (z) for (let i = first; i < out.length; i++) out[i].translate(0, 0, z);
  return top;
}

/**
 * Crée le portique, le palan ou le pont roulant.
 * @param {object} [given] voir `meta.params`
 * @returns {THREE.Group} `group.userData.hoist` : { model, lift, trolley, setLift(v), liftTo(v), setTrolley(v),
 *   trolleyTo(v), roll(d), hook: Vector3 (bout du crochet, repère de l'asset), bottom (hauteur du bas de la charge),
 *   feet: [[x, z, rayon]], loop }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 5521 + 77);
  const crane = p.model === "crane", gantry = p.model === "gantry";
  const showRails = p.rails === "on";
  const bronze = []; // [géométrie, pièce]
  const iron = [];
  const load = [];
  const rivets = []; // quads de bronze (rivets, plaque), fixes
  const add = (list, g, part = FIXED) => list.push([g, part]);
  const fixedBronze = [], fixedIron = [];
  const wear = rng.range(-0.06, 0.06);

  // --- Ossature fixe : chemin du chariot (de xMin à xMax), surface de roulement, haut de la chaîne. ---------------
  let running, travel, chainTopOffset, wheelR = 0, feet = [];
  const rollers = []; // { center: [x, y, z], axis: "x" | "z", r, part }
  if (gantry) {
    // Poutre haute : I de 0,25 m, aile basse de 0,22 ; dessus à 3,80 m.
    running = 3.55 + 0.05;
    iProfile(fixedBronze, rivets, -1.6, 1.6, 3.55, { H: 0.25, W: 0.2, Wb: 0.22, tf: 0.045, tb: 0.05, tw: 0.045, tone: wear, stiff: 0.55 });
    travel = 1.05;
    // Chevalets en A aux deux bouts : deux jambes, une semelle, une traverse, des goussets rivetés.
    for (const sx of [-1, 1]) {
      const x = sx * 1.42;
      const foot = 1.1, sill = 0.3;
      for (const sz of [-1, 1]) {
        fixedBronze.push(withTone(beam([x, sill + 0.07, sz * foot], [x, 3.5, sz * 0.13], 0.15, 0.13), wear + 0.02));
        feet.push([x, sz * foot, 0.22]);
      }
      fixedBronze.push(withTone(buildBlock([0.17, 0.14, 2 * foot + 0.3], [x, sill, 0]), wear - 0.05));
      fixedBronze.push(withTone(buildBlock([0.13, 0.11, 1.15], [x, 1.85, 0]), wear));
      // Tête : platine sous la poutre, goussets triangulaires de part et d'autre.
      fixedBronze.push(withTone(buildBlock([0.3, 0.05, 0.42], [x, 3.525, 0]), wear + 0.1));
      for (const sz of [-1, 1]) {
        fixedBronze.push(withTone(beam([x, 3.47, sz * 0.18], [x, 3.12, sz * 0.32], 0.02, 0.26), wear + 0.15));
        fixedBronze.push(withTone(beam([x, sill + 0.12, sz * (foot - 0.15)], [x, sill + 0.36, sz * (foot - 0.33)], 0.02, 0.22), wear + 0.15));
        for (const [y, z] of [[3.36, 0.24], [3.2, 0.28], [0.52, foot - 0.3], [0.62, foot - 0.36]]) {
          for (const s of [-1, 1]) rivets.push({ position: [x + s * 0.012, y, sz * z], size: [PX, PX], normal: [s, 0, 0], tone: 0.45 });
        }
      }
      // Roulettes : chape boulonnée sous la semelle, roue de fonte de Ø 0,2 m (roule le long de z).
      for (const sz of [-1, 1]) {
        const z = sz * foot;
        fixedIron.push(withTone(buildBlock([0.2, 0.025, 0.2], [x, sill - 0.08, z]), 0.05));
        for (const s of [-1, 1]) fixedIron.push(withTone(buildBlock([0.02, 0.13, 0.12], [x + s * 0.06, 0.15, z]), -0.05));
        rollers.push({ center: [x, 0.1, z], axis: "x", r: 0.1, width: 0.07, part: ROLLERS + rollers.length });
      }
    }
    // Plaque de charge rivetée au flanc de la poutre (glyphes clairs tirés de la graine).
    plate(rivets, rng, [rng.range(-0.8, 0.8), 3.69, 0.0235], [0, 0, 1]);
    chainTopOffset = -0.62;
  } else if (!crane) {
    // Palan sur poutre-rail : tronçon de 2,4 m (profil de la poutre rivetée, aile basse de 0,28 polie).
    running = p.railHeight;
    if (showRails) {
      iProfile(fixedBronze, rivets, -1.2, 1.2, running - 0.07, { H: 0.4, W: 0.2, Wb: 0.28, tf: 0.06, tb: 0.07, tw: 0.05, tone: wear, stiff: 1.2 });
      for (const s of [-1, 1]) fixedBronze.push(withTone(buildBlock([2.4, 0.004, 0.05], [0, running + 0.002, s * 0.07]), 0.55));
      plate(rivets, rng, [rng.range(-0.6, 0.6), running + 0.17, 0.0285], [0, 0, 1]);
    }
    travel = 0.9;
    chainTopOffset = -0.62;
  } else {
    // Pont roulant : sommiers sur les rails (x = ±portée/2), deux poutres rivetées jumelles (z = ±0,45).
    const H = p.railHeight, half = p.span / 2;
    wheelR = 0.12;
    for (const sx of [-1, 1]) {
      const x = sx * half;
      fixedBronze.push(withTone(buildBlock([0.34, 0.36, 2.4], [x, H + 0.3, 0]), wear - 0.04));
      fixedBronze.push(withTone(buildBlock([0.36, 0.03, 2.44], [x, H + 0.495, 0]), wear + 0.1));
      for (const sz of [-1, 1]) {
        rollers.push({ center: [x, H + wheelR, sz * 0.8], axis: "x", r: wheelR, width: 0.36, part: ROLLERS + rollers.length });
        // Butoirs de bout de sommier.
        fixedIron.push(withTone(buildBlock([0.2, 0.16, 0.08], [x, H + 0.3, sz * 1.24]), -0.1));
      }
      for (let k = -4; k <= 4; k++) for (const s of [-1, 1]) {
        rivets.push({ position: [x + s * 0.172, H + 0.42, k * 0.25], size: [PX, PX], normal: [s, 0, 0], tone: 0.4 });
      }
      if (showRails) {
        // Rail de laiton sous le sommier (3 m), au ton du bronze le plus clair.
        fixedBronze.push(withTone(buildBlock([0.12, 0.02, 3], [x, H - 0.11, 0]), 0.2));
        fixedBronze.push(withTone(buildBlock([0.03, 0.05, 3], [x, H - 0.075, 0]), -0.1));
        fixedBronze.push(withTone(buildBlock([0.07, 0.05, 3], [x, H - 0.025, 0]), (xx, y, z, nx, ny) => (ny > 0.5 ? 0.6 : 0.25)));
      }
    }
    for (const sz of [-1, 1]) {
      iProfile(fixedBronze, rivets, -half + 0.17, half - 0.17, H + 0.2, { H: 0.7, W: 0.22, tf: 0.07, tw: 0.05, tone: wear + sz * 0.03, stiff: 1.0, z: sz * 0.45 });
      fixedBronze.push(withTone(buildBlock([2 * half - 0.4, 0.006, 0.05], [0, H + 0.903, sz * 0.45]), 0.6));
    }
    plate(rivets, rng, [rng.range(-half * 0.5, half * 0.5), H + 0.6, 0.45 + 0.111], [0, 0, 1]);
    running = H + 0.9;
    travel = half - 1.0;
    chainTopOffset = 0.05;
  }

  // --- Chariot (pièce TROLLEY, construit en x = 0) et palan. ---------------------------------------------------
  let chainTop;
  let wheelCenter = null, wheelRadius = 0;
  if (!crane) {
    // Chariot sous l'aile basse : deux flasques de part et d'autre, quatre galets posés sur l'aile, entretoise dessous.
    const fw = gantry ? 0.11 : 0.14;
    for (const s of [-1, 1]) {
      add(bronze, withTone(buildBlock([0.3, 0.2, 0.02], [0, running - 0.02, s * (fw + 0.04)]), wear + 0.05), TROLLEY);
      for (const dx of [-0.08, 0.08]) {
        // Galets posés sur l'aile (ils ne tournent pas : trop petits pour se voir tourner).
        add(iron, withTone(plain(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 8)).rotateX(Math.PI / 2).translate(dx, running + 0.035, s * (fw - 0.01)), 0.1), TROLLEY);
      }
    }
    add(bronze, withTone(buildBlock([0.12, 0.05, 2 * fw + 0.1], [0, running - 0.14, 0]), wear), TROLLEY);
    // Palan : manille, carter de fonte (boîte arrondie), couvercle d'engrenage côté volant.
    const yb = running - 0.17;
    add(iron, withTone(buildBlock([0.05, 0.08, 0.05], [0, yb - 0.04, 0]), 0.1), TROLLEY);
    add(iron, withTone(plain(new THREE.CylinderGeometry(0.13, 0.13, 0.2, 10)).rotateX(Math.PI / 2).translate(0, yb - 0.22, 0), (x, y, z, nx, ny) => (ny > 0.5 ? 0.15 : -0.05)), TROLLEY);
    add(iron, withTone(buildBlock([0.2, 0.12, 0.2], [0, yb - 0.36, 0]), -0.1), TROLLEY);
    add(bronze, withTone(plain(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10)).rotateX(Math.PI / 2).translate(0, yb - 0.22, -0.115), 0.2), TROLLEY);
    // Volant de manœuvre (pièce WHEEL) : jante, 4 rais, moyeu ; plan xy, côté +z.
    wheelCenter = new THREE.Vector3(0, yb - 0.22, 0.17);
    wheelRadius = 0.16;
    add(bronze, withTone(plain(new THREE.TorusGeometry(wheelRadius, 0.016, 4, 14)).translate(wheelCenter.x, wheelCenter.y, wheelCenter.z), 0.25), WHEEL);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      add(bronze, withTone(beam(wheelCenter, wheelCenter.clone().add(new THREE.Vector3(Math.cos(a) * wheelRadius, Math.sin(a) * wheelRadius, 0)), 0.025, 0.02), 0.05), WHEEL);
    }
    add(iron, withTone(buildBlock([0.05, 0.05, 0.05], wheelCenter.toArray()), 0.2), WHEEL);
    // Chaîne de commande : deux brins qui pendent du volant jusqu'à une boucle à ~1,1 m du sol.
    const bottom = rng.range(0.95, 1.25);
    const sway = rng.range(-0.06, 0.06);
    for (const s of [-1, 1]) {
      for (const g of chainLinks([s * wheelRadius, wheelCenter.y, wheelCenter.z], [s * 0.05 + sway, bottom + 0.06, wheelCenter.z + 0.02], 0.09)) add(iron, withTone(g, (x, y) => (Math.round(y / 0.09) % 2 ? 0.1 : -0.15)), TROLLEY);
    }
    for (const g of chainLinks([-0.05 + sway, bottom + 0.06, wheelCenter.z + 0.02], [0.05 + sway, bottom + 0.06, wheelCenter.z + 0.02], 0.05)) add(iron, g, TROLLEY);
    chainTop = yb - 0.42;
  } else {
    // Chariot du pont : cadre sur quatre galets posés sur les poutres, tambour de fonte, moteur à bobines de cuivre.
    const y = running;
    add(bronze, withTone(buildBlock([1.0, 0.1, 1.15], [0, y + 0.13, 0]), wear + 0.08), TROLLEY);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(iron, withTone(plain(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10)).rotateX(Math.PI / 2).translate(sx * 0.38, y + 0.07, sz * 0.45), 0.1), TROLLEY);
    }
    // Trappe ouverte au milieu du cadre : la chaîne y passe (bord sombre).
    add(bronze, withTone(buildBlock([0.24, 0.012, 0.24], [0, y + 0.185, 0]), -0.9), TROLLEY);
    // Tambour sur deux paliers, à droite ; moteur à gauche : 5 bobines de cuivre (bronze clair) sur un carter.
    add(iron, withTone(plain(new THREE.CylinderGeometry(0.2, 0.2, 0.62, 12)).rotateX(Math.PI / 2).translate(0.2, y + 0.42, 0), (x, yy, z, nx, ny) => (ny > 0.4 ? 0.15 : -0.1)), TROLLEY);
    for (let k = -3; k <= 3; k++) add(iron, withTone(plain(new THREE.TorusGeometry(0.2, 0.012, 3, 12)).translate(0.2, y + 0.42, k * 0.08), 0.35), TROLLEY);
    for (const s of [-1, 1]) add(bronze, withTone(buildBlock([0.12, 0.3, 0.06], [0.2, y + 0.33, s * 0.36]), wear), TROLLEY);
    add(bronze, withTone(buildBlock([0.34, 0.3, 0.42], [-0.3, y + 0.33, 0]), wear - 0.08), TROLLEY);
    for (let k = 0; k < 5; k++) add(bronze, withTone(plain(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 12)).rotateZ(Math.PI / 2).translate(-0.42 + k * 0.06, y + 0.37, 0), k % 2 ? 0.55 : 0.35), TROLLEY);
    add(iron, withTone(buildBlock([0.3, 0.06, 0.06], [-0.05, y + 0.42, 0]), 0), TROLLEY);
    chainTop = y + chainTopOffset;
  }

  // --- Moufle, crochet et charge (pièce HOOK), construits avec le point d'attache en y = 0. ---------------------
  const k = crane ? 1.45 : 1;
  const hook = [];
  hook.push([iron, withTone(buildBlock([0.06 * k, 0.07 * k, 0.06 * k], [0, -0.035 * k, 0]), 0.1)]);
  hook.push([bronze, withTone(buildBlock([0.15 * k, 0.16 * k, 0.1 * k], [0, -0.15 * k, 0]), (x, y, z, nx, ny) => wear + (ny > 0.5 ? 0.25 : 0.05))]);
  hook.push([iron, withTone(plain(new THREE.CylinderGeometry(0.055 * k, 0.055 * k, 0.11 * k, 8)).rotateX(Math.PI / 2).translate(0, -0.15 * k, 0), 0.25)]);
  hook.push([iron, withTone(buildBlock([0.04 * k, 0.07 * k, 0.04 * k], [0, -0.265 * k, 0]), 0)]);
  // Crochet en C ouvert vers +x : arc de rayon 0,06 sous la tige, pointe relevée.
  const c = new THREE.Vector3(0.05 * k, -0.37 * k, 0), r = 0.055 * k;
  const arc = [];
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI + (i / 6) * (Math.PI + 0.9);
    arc.push(c.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)));
  }
  hook.push([iron, withTone(beam([0, -0.3 * k, 0], arc[0], 0.045 * k, 0.04 * k), 0.3)]);
  for (let i = 0; i < 6; i++) hook.push([iron, withTone(beam(arc[i], arc[i + 1], 0.045 * k, 0.04 * k), i < 3 ? 0.35 : 0.5)]);
  const bite = new THREE.Vector3(c.x, c.y - r + 0.02 * k, 0); // le fond du crochet, où passe l'élingue
  let drop = -bite.y + 0.02; // de l'attache au bas de la charge
  const slings = (corners) => {
    for (const q of corners) for (const g of chainLinks(bite.toArray(), q, 0.08, PX * 0.6)) hook.push([iron, withTone(g, -0.05)]);
  };
  if (p.load === "crate") {
    const s = crane ? 0.9 : 0.62, h = crane ? 0.7 : 0.48, y1 = bite.y - (crane ? 0.75 : 0.45);
    const top = y1 - 0.02;
    hook.push([load, withTone(buildBlock([s, h, s * 0.85], [bite.x, top - h / 2, 0]), 0)]);
    // Planches (joints sombres), deux ceintures et les coins de fer.
    const planks = [];
    for (let i = 1; i < 4; i++) {
      for (const sz of [-1, 1]) planks.push({ position: [bite.x, top - (i * h) / 4, sz * (s * 0.425 + 0.002)], size: [s - 0.02, PX * 0.5], normal: [0, 0, sz], tone: -0.7 });
      for (const sx of [-1, 1]) planks.push({ position: [bite.x + sx * (s / 2 + 0.002), top - (i * h) / 4, 0], size: [s * 0.85 - 0.02, PX * 0.5], normal: [sx, 0, 0], tone: -0.7 });
    }
    for (let i = 1; i < 4; i++) planks.push({ position: [bite.x - s / 2 + (i * s) / 4, top + 0.002, 0], size: [PX * 0.5, s * 0.85 - 0.02], normal: [0, 1, 0], tone: -0.6 });
    hook.push([load, buildQuads(planks)]);
    for (const yy of [top - h * 0.2, top - h * 0.8]) hook.push([iron, withTone(buildBlock([s + 0.02, 0.05, s * 0.85 + 0.02], [bite.x, yy, 0]), -0.05)]);
    slings([[bite.x - s * 0.42, top, -s * 0.36], [bite.x + s * 0.42, top, -s * 0.36], [bite.x - s * 0.42, top, s * 0.36], [bite.x + s * 0.42, top, s * 0.36]]);
    drop = -(top - h) + 0.02;
  } else if (p.load === "ingots") {
    // Six lingots de cuivre en deux rangs croisés sur une palonnière de fonte, quatre brins.
    const top = bite.y - 0.4;
    for (const sz of [-1, 1]) hook.push([iron, withTone(buildBlock([0.5, 0.04, 0.04], [bite.x, top - 0.02, sz * 0.16]), -0.05)]);
    for (let i = 0; i < 3; i++) {
      hook.push([load, withTone(buildBlock([0.4, 0.07, 0.1], [bite.x, top - 0.075, (i - 1) * 0.115], [0, 0, 0], { taper: 0.15 }), rng.range(-0.1, 0.1))]);
      hook.push([load, withTone(buildBlock([0.1, 0.07, 0.3], [bite.x + (i - 1) * 0.13, top - 0.145, 0], [0, 0, 0], { taper: 0.15 }), rng.range(-0.1, 0.1))]);
    }
    hook.push([iron, withTone(buildBlock([0.48, 0.03, 0.34], [bite.x, top - 0.195, 0]), -0.1)]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) hook.push([iron, withTone(buildBlock([0.025, 0.2, 0.025], [bite.x + sx * 0.23, top - 0.1, sz * 0.16]), 0)]);
    slings([[bite.x - 0.23, top, -0.16], [bite.x + 0.23, top, -0.16], [bite.x - 0.23, top, 0.16], [bite.x + 0.23, top, 0.16]]);
    drop = -(top - 0.21) + 0.02;
  } else if (p.load === "gear") {
    // Ébauche de roue dentée (Ø 0,7 m) pendue debout par son moyeu, face vers +z.
    const g = gearWheel({ teeth: 18, module: 0.036, depth: 0.08, spokes: 5, hub: 0.25 });
    const R = g.userData.radius + 0.036;
    const cy = bite.y - 0.22 - R;
    g.translate(bite.x, cy, -0.04);
    hook.push([bronze, withTone(g, (x, y, z, nx, ny, nz) => wear + (Math.abs(nz) > 0.5 ? 0.15 : -0.1))]);
    hook.push([iron, withTone(buildBlock([0.05, 0.05, 0.16], [bite.x, cy, 0]), 0.1)]);
    slings([[bite.x - 0.03, cy + 0.02, -0.06], [bite.x + 0.03, cy + 0.02, 0.06]]);
    drop = -(cy - R) + 0.02;
  } else {
    drop = -(c.y - r) + 0.02;
  }

  // --- Plage du crochet et chaîne de charge (maillons LINKS.., construits sous le chariot). -----------------------
  const low = drop + 0.06;
  const high = chainTop - 0.08;
  const pitch = crane ? 0.095 : 0.075;
  const nLinks = Math.min(240, Math.ceil((high - low) / pitch) + 1);
  const lift0 = THREE.MathUtils.clamp(p.lift + rng.range(-0.06, 0.06), 0, 1);
  const trolley0 = THREE.MathUtils.clamp(p.trolley + rng.range(-0.08, 0.08), 0, 1);
  const buildY = low; // le crochet est construit en bas : les maillons montent au-dessus de lui
  for (const [list, g] of hook) {
    g.translate(0, buildY, 0);
    add(list, g, HOOK);
  }
  const chainW = crane ? PX * 1.05 : PX * 0.85;
  for (let i = 0; i < nLinks; i++) {
    const g = link([0, buildY + i * pitch, 0], [0, buildY + (i + 1) * pitch, 0], chainW, i);
    add(iron, withTone(g, i % 2 ? 0.15 : -0.1), LINKS + i);
  }
  // Roulettes et galets du pont : une pièce par roue (jante, toile, boulon décalé pour voir le tour).
  for (const w of rollers) {
    const [x, y, z] = w.center;
    const geo = plain(new THREE.CylinderGeometry(w.r, w.r, w.width, 10)).rotateZ(Math.PI / 2).translate(x, y, z);
    add(iron, withTone(geo, (xx, yy, zz, nx) => (Math.abs(nx) > 0.5 ? -0.1 : 0.1)), w.part);
    for (const s of [-1, 1]) add(iron, withTone(buildBlock([0.012, w.r * 0.35, w.r * 0.35], [x + s * (w.width / 2 + 0.006), y + w.r * 0.45, z]), 0.4), w.part);
  }

  // --- Maillages : le fixe d'abord, les pièces mobiles ensuite (seule leur plage est renvoyée au GPU). -----------
  if (rivets.length) fixedBronze.push(buildQuads(rivets));
  const order = (fixed, list) => [...fixed.map((g) => [g, FIXED]), ...list.slice().sort((a, b) => a[1] - b[1])];
  const count = LINKS + nLinks;
  const group = new THREE.Group();
  group.name = meta.name;
  const rigs = [];
  const make = (name, entries, material) => {
    if (!entries.length) return;
    const parts = mergeParts(entries);
    const mesh = new THREE.Mesh(parts.geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    rigs.push(createRigidParts(mesh.geometry, parts.partOf, count));
  };
  make("bronze", order(fixedBronze, bronze), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  make("iron", order(fixedIron, iron), metalMaterial(METALS.castIron, { id: 31, tone: true }));
  if (load.length) {
    const material = p.load === "crate"
      ? createToonMaterial({ ramp: WOODS.oak.ramp, ink: WOODS.oak.ink, steps: [0.26, 0.48, 0.74], tone: true, crease: true, id: 21 })
      : metalMaterial(METALS.copper, { id: 32, tone: true, steps: [0.28, 0.46, 0.68, 0.95] });
    make("load", order([], load), material);
  }

  // --- Pilotage. -------------------------------------------------------------------------------------------------
  const M = Array.from({ length: count }, () => new THREE.Matrix4());
  const tmp = new THREE.Matrix4();
  const back = new THREE.Matrix4();
  const hide = new THREE.Matrix4();
  const hookPoint = new THREE.Vector3();
  const hoist = {
    model: p.model,
    lift: lift0,
    trolley: trolley0,
    distance: 0,
    loop: p.state === "loop",
    hook: hookPoint,
    feet,
    targetLift: null,
    targetTrolley: null,
  };
  const pose = () => {
    const tx = (hoist.trolley * 2 - 1) * travel;
    const hookY = THREE.MathUtils.lerp(low, high, hoist.lift);
    M[TROLLEY].makeTranslation(tx, 0, 0);
    M[HOOK].makeTranslation(tx, hookY - buildY, 0);
    if (wheelCenter) {
      // Le volant tourne avec la chaîne : un tour pour 1 m de chaîne.
      const a = -hookY * Math.PI * 2;
      M[WHEEL].makeTranslation(tx + wheelCenter.x, wheelCenter.y, wheelCenter.z)
        .multiply(tmp.makeRotationZ(a))
        .multiply(back.makeTranslation(-wheelCenter.x, -wheelCenter.y, -wheelCenter.z));
    }
    for (const w of rollers) {
      const [x, y, z] = w.center;
      M[w.part].makeTranslation(x, y, z).multiply(tmp.makeRotationX(hoist.distance / w.r)).multiply(back.makeTranslation(-x, -y, -z));
    }
    // Maillons : ceux qui dépassent le haut de la chaîne rentrent dans le palan (écrasés en un point).
    hide.makeScale(0, 0, 0).setPosition(tx, chainTop, 0);
    for (let i = 0; i < nLinks; i++) {
      const top = hookY + (i + 1) * pitch;
      M[LINKS + i].copy(top <= chainTop + 0.01 ? M[HOOK] : hide);
    }
    hookPoint.set(tx + bite.x, hookY + bite.y, 0);
    hoist.bottom = hookY - drop + 0.02;
    for (const rig of rigs) {
      for (let j = 0; j < count; j++) rig.matrices[j].copy(M[j]);
      rig.apply();
    }
  };
  hoist.setLift = (v) => { hoist.lift = THREE.MathUtils.clamp(v, 0, 1); hoist.targetLift = null; pose(); };
  hoist.setTrolley = (v) => { hoist.trolley = THREE.MathUtils.clamp(v, 0, 1); hoist.targetTrolley = null; pose(); };
  hoist.liftTo = (v) => { hoist.targetLift = THREE.MathUtils.clamp(v, 0, 1); hoist.loop = false; };
  hoist.trolleyTo = (v) => { hoist.targetTrolley = THREE.MathUtils.clamp(v, 0, 1); };
  hoist.roll = (d) => { hoist.distance += d; pose(); };
  pose();

  // Animation au cran de 12 images/s : boucle (bas 2 s, montée 4 s, haut 2 s, descente 4 s) ou déplacement demandé.
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let last = -1;
  const liftSpeed = crane ? 0.12 : 0.2, trolleySpeed = 0.15;
  const loopPhase = rng.range(0, 12);
  group.updateMatrixWorld = (force) => {
    const time = Math.floor(sharedUniforms.uTime.value * 12) / 12;
    if (time !== last) {
      const dt = last < 0 ? 0 : Math.min(0.25, time - last);
      last = time;
      let moved = false;
      if (hoist.loop) {
        const t = (time + loopPhase) % 12;
        const s = t < 2 ? 0 : t < 6 ? (t - 2) / 4 : t < 8 ? 1 : 1 - (t - 8) / 4;
        const v = THREE.MathUtils.lerp(0.1, 0.85, THREE.MathUtils.smoothstep(s, 0, 1));
        if (Math.abs(v - hoist.lift) > 1e-4) { hoist.lift = v; moved = true; }
      }
      for (const [key, target, speed] of [["lift", "targetLift", liftSpeed], ["trolley", "targetTrolley", trolleySpeed]]) {
        if (hoist[target] === null || !dt) continue;
        const d = hoist[target] - hoist[key];
        const step = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
        hoist[key] += step;
        moved = true;
        if (Math.abs(d) < 1e-4) hoist[target] = null;
      }
      if (moved) pose();
    }
    baseUpdate(force);
  };

  group.userData.hoist = hoist;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

// Plaque de charge rivetée : rectangle de laiton clair, 3 à 5 traits de glyphes sombres, 4 rivets.
function plate(rivets, rng, [x, y, z], normal) {
  rivets.push({ position: [x, y, z], size: [0.26, 0.12], normal, tone: 0.5 });
  const n = rng.int(3, 5);
  for (let i = 0; i < n; i++) {
    const h = rng.next() < 0.5 ? 0.06 : 0.035;
    rivets.push({ position: [x - 0.08 + i * (0.16 / (n - 1)), y + (0.06 - h) / 2 - 0.005, z + 0.002], size: [PX * 0.6, h], normal, tone: -0.6 });
  }
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) rivets.push({ position: [x + sx * 0.11, y + sy * 0.045, z + 0.002], size: [PX * 0.5, PX * 0.5], normal, tone: 0.1 });
}
