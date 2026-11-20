// Outils d'artisan du Complexe (fiches ATE-06, ETU-12, E6-07, docs/complexe/) : les outils à main de l'Atelier, la
// mire et la règle du kit d'étude, la sonde d'écoute de la salle 6. Un réglage `tool` choisit l'outil :
// - les 12 outils de l'Atelier (marteau de ciselage, pince coupante, tournevis, clé à molette, fer à souder, burin,
//   lime, mètre pliant, compas, calibre à lames, scie à métaux, pince à dénuder), de 0,2 à 0,45 m, un peu plus gros
//   qu'en vrai pour tenir 2 à 7 pixels : la silhouette (tête en T, mâchoires, lame, éventail) fait l'outil ;
// - la mire (2 m, bandes noires et blanches de 2 px sur une perche de laiton), la règle de laiton (1 m, graduations en
//   pointillé), la sonde d'écoute (tige de 2 m, pavillon, poignée de cuir) ;
// - la trousse : les 12 outils dans une trousse de cuir dépliée, chacun sous sa boucle (à poser sur un établi).
// Couché (sur une surface), debout (mire sur son trépied, règle et sonde appuyées contre un mur) ou en main (origine au
// point de prise, `userData.grip`). La graine change l'usure et les tons, l'ouverture des pinces, du compas et du
// calibre, les plis du mètre, l'angle de pose ; dans la trousse, l'ordre des outils et ceux qui manquent.
//
// 3 draw calls au plus : acier, laiton (garnitures, compas, règle, mire), bois et cuir (manches, trousse) ; la mire
// remplace le bois par sa peinture.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe } from "../../kit/geometry.js";
import { METALS, WOODS } from "../../kit/palettes.js";
import { beam, mergeToned, metalMaterial, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const TOOLS = {
  kit: "Trousse de cuir (les 12 outils)",
  "chasing-hammer": "Marteau de ciselage",
  "side-cutters": "Pince coupante",
  screwdriver: "Tournevis",
  "adjustable-wrench": "Clé à molette",
  "soldering-iron": "Fer à souder",
  chisel: "Burin",
  file: "Lime",
  "folding-rule": "Mètre pliant",
  compass: "Compas",
  "feeler-gauge": "Calibre à lames",
  hacksaw: "Scie à métaux",
  "wire-stripper": "Pince à dénuder",
  "survey-staff": "Mire de 2 m (kit d'étude)",
  "brass-rule": "Règle de laiton (kit d'étude)",
  "listening-rod": "Sonde d'écoute à tige (salle 6)",
};
const KIT = ["chasing-hammer", "side-cutters", "screwdriver", "adjustable-wrench", "soldering-iron", "chisel", "file", "folding-rule", "compass", "feeler-gauge", "hacksaw", "wire-stripper"];
const LONG = new Set(["survey-staff", "brass-rule", "listening-rod"]);
const POSES = {
  lying: "Couché (sur une surface)",
  upright: "Debout (mire sur trépied ; règle et sonde appuyées au mur)",
  hand: "En main (origine au point de prise)",
};
// Peinture de la mire : un blanc cassé et un noir, la même rampe (les bandes noires ont un ton très bas).
const PAINT = { ramp: ["#121117", "#3a3640", "#b9b3a2", "#e6dfc8"], ink: "#0b0a0e" };

const params = {
  seed: seedParam("Change l'usure et les tons, l'ouverture des pinces, du compas et du calibre, les plis du mètre, l'angle de pose ; dans la trousse, l'ordre des outils et ceux qui manquent."),
  tool: choiceParam("Outil", TOOLS, "Un des 12 outils de l'Atelier, la mire, la règle ou la sonde d'écoute, ou la trousse qui range les 12 outils."),
  pose: choiceParam("Pose", POSES, "Couché, debout (mire, règle et sonde ; les petits outils restent couchés) ou en main : origine au point de prise, outil vers +y (userData.grip, userData.tip)."),
};

export const meta = {
  id: "props/tools/artisan-tools",
  name: "Outils d'artisan",
  nameEn: "Artisan tools",
  category: "props",
  subcategory: "tools",
  description:
    "Outils à main de l'Atelier du Complexe : marteau de ciselage, pinces, tournevis, clé à molette, fer à souder, " +
    "burin, lime, mètre pliant, compas, calibre à lames, scie à métaux, un par un ou rangés dans une trousse de cuir ; " +
    "et la mire à bandes, la règle de laiton, la sonde d'écoute à pavillon. Couchés, debout ou en main. Fiches ATE-06, " +
    "ETU-12, E6-07.",
  tags: [
    "outils", "outil à main", "trousse", "marteau", "pince", "tournevis", "clé à molette", "fer à souder", "burin",
    "lime", "mètre pliant", "compas", "calibre", "scie à métaux", "pince à dénuder", "mire", "règle", "sonde d'écoute",
    "pavillon", "acier", "laiton", "cuir", "objet de main", "atelier", "le complexe", "complexe", "ancien-tech",
    "intérieur",
    "tools", "hand tool", "tool roll", "hammer", "pliers", "screwdriver", "adjustable wrench", "soldering iron",
    "cold chisel", "metal file", "folding rule", "drafting compass", "feeler gauge", "hacksaw", "wire stripper",
    "survey staff", "ruler", "listening rod", "ear trumpet", "steel", "brass", "leather", "handheld", "workshop",
    "ancient complex", "ancient-tech", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; couché : origine au sol, au milieu de l'outil (ou de la trousse) ; debout : origine au pied ; en main : origine au point de prise, l'outil vers +y, sa face vers +z",
  footprint: { radius: 1.0, height: 0.2 },
  animated: [],
  params,
  variants: variantsOf("tool", params.tool),
};

// --- Dessin des outils ---------------------------------------------------------------------------------------------
// Chaque outil est dessiné couché, sa longueur le long de +x (manche vers x = 0), à plat sur y = 0, sa face vers +y.
// Il rend { length, grip, tip } : la longueur, le x du point de prise, le x du bout qui travaille.

const lit = (t = 0) => (x, y, z, nx, ny) => t + (ny > 0.5 ? 0.14 : ny < -0.5 ? -0.3 : 0);

/** Cylindre couché le long de x, de x0 à x1 (rayons r0 → r1), à la hauteur y, au z donné. */
function rodX(r0, x0, x1, y = r0, z = 0, sides = 6, r1 = r0) {
  const g = plain(new THREE.CylinderGeometry(r1, r0, x1 - x0, sides));
  g.rotateZ(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, z);
  return g;
}
/** Cylindre debout (pivot, rivet, tête de compas). */
function post(r, h, x, y, z, sides = 8) {
  return plain(new THREE.CylinderGeometry(r, r, h, sides)).translate(x, y, z);
}
const box = (size, position, ry = 0) => buildBlock(size, position, [0, ry, 0]);

const DRAW = {
  "chasing-hammer"(add, rng) {
    // Manche à poire, tête en T : panne ronde d'un côté, boule de l'autre.
    add.wood(withTone(rodX(0.016, 0.0, 0.29, 0.02), lit(0.35 + rng.range(-0.05, 0.05))));
    add.wood(withTone(rodX(0.022, 0.0, 0.075, 0.022, 0, 6, 0.018), lit(0.3)));
    add.steel(withTone(box([0.042, 0.042, 0.11], [0.305, 0.021, 0]), lit(0.05)));
    add.steel(withTone(plain(new THREE.CylinderGeometry(0.026, 0.024, 0.03, 8)).rotateX(Math.PI / 2).translate(0.305, 0.024, 0.065), lit(0.2)));
    add.steel(withTone(plain(new THREE.SphereGeometry(0.024, 6, 4)).translate(0.305, 0.024, -0.065), lit(0.1)));
    return { length: 0.33, grip: 0.07, tip: 0.305 };
  },
  "side-cutters"(add, rng, o) {
    pliers(add, rng, { jaw: 0.065, pointed: true, sleeve: -0.55, stowed: o.stowed });
    return { length: 0.23, grip: 0.06, tip: 0.225 };
  },
  "wire-stripper"(add, rng, o) {
    pliers(add, rng, { jaw: 0.08, pointed: false, sleeve: 0.15, stowed: o.stowed });
    return { length: 0.24, grip: 0.06, tip: 0.235 };
  },
  screwdriver(add, rng) {
    add.wood(withTone(rodX(0.026, 0.0, 0.12, 0.026, 0, 6, 0.022), lit(0.3 + rng.range(-0.08, 0.05))));
    add.brass(withTone(rodX(0.019, 0.12, 0.138, 0.026), lit(0.1)));
    add.steel(withTone(rodX(0.012, 0.138, 0.29, 0.026, 0, 6), lit(0.15)));
    add.steel(withTone(box([0.022, 0.008, 0.03], [0.298, 0.026, 0]), lit(0.25)));
    return { length: 0.31, grip: 0.06, tip: 0.305 };
  },
  "adjustable-wrench"(add, rng) {
    const open = rng.range(0.012, 0.03);
    add.steel(withTone(box([0.22, 0.016, 0.038], [0.11, 0.008, 0]), lit(0.0)));
    add.steel(withTone(box([0.016, 0.005, 0.016], [0.03, 0.017, 0]), lit(-0.7))); // trou de suspension
    add.steel(withTone(box([0.07, 0.02, 0.07], [0.245, 0.01, 0.01]), lit(0.05)));
    add.steel(withTone(box([0.055, 0.02, 0.02], [0.3, 0.01, 0.034]), lit(0.15))); // mâchoire fixe
    add.steel(withTone(box([0.05, 0.02, 0.02], [0.298, 0.01, 0.024 - open - 0.02]), lit(0.15))); // mâchoire mobile
    add.brass(withTone(rodX(0.013, 0.225, 0.262, 0.012, -0.03, 6), lit(0.2))); // molette
    return { length: 0.33, grip: 0.08, tip: 0.31 };
  },
  "soldering-iron"(add, rng) {
    add.wood(withTone(rodX(0.022, 0.0, 0.13, 0.024, 0, 6, 0.024), lit(0.25 + rng.range(-0.05, 0.08))));
    add.brass(withTone(rodX(0.017, 0.13, 0.145, 0.024), lit(0.15)));
    add.steel(withTone(rodX(0.01, 0.145, 0.27, 0.024, 0, 5), lit(0.1)));
    // Panne de cuivre en hachette (bronze rougi).
    add.brass(withTone(box([0.075, 0.03, 0.03], [0.3, 0.024, 0]), lit(-0.2)));
    add.brass(withTone(box([0.02, 0.016, 0.03], [0.345, 0.024, 0]), lit(-0.05)));
    return { length: 0.36, grip: 0.065, tip: 0.35 };
  },
  chisel(add, rng) {
    add.steel(withTone(plain(new THREE.CylinderGeometry(0.022, 0.018, 0.02, 8)).rotateZ(-Math.PI / 2).translate(0.01, 0.019, 0), lit(-0.25 + rng.range(-0.05, 0.05)))); // tête matée
    add.steel(withTone(rodX(0.017, 0.02, 0.2, 0.019, 0, 8), lit(0.05)));
    add.steel(withTone(box([0.055, 0.012, 0.034], [0.225, 0.019, 0]), lit(0.25)));
    return { length: 0.25, grip: 0.1, tip: 0.25 };
  },
  file(add, rng) {
    add.wood(withTone(rodX(0.022, 0.0, 0.1, 0.022, 0, 6, 0.019), lit(0.3 + rng.range(-0.05, 0.05))));
    add.brass(withTone(rodX(0.017, 0.1, 0.114, 0.022), lit(0.1)));
    // Lame : des tronçons à tons alternés, qui dessinent la taille de la lime ; elle s'effile vers la pointe.
    const n = 10;
    for (let i = 0; i < n; i++) {
      const w = 0.036 - (i / n) * 0.014;
      add.steel(withTone(box([0.02, 0.012, w], [0.124 + i * 0.02, 0.022, 0]), lit(i % 2 ? 0.12 : -0.15)));
    }
    return { length: 0.32, grip: 0.05, tip: 0.31 };
  },
  "folding-rule"(add, rng, { stowed }) {
    // Quatre à six branches de buis jaune, articulées par des rivets de laiton, en zigzag plus ou moins déplié.
    const n = rng.int(4, 6);
    const L = 0.15;
    let x = 0, z = 0, a = rng.range(-0.2, 0.2);
    const points = [[x, z]];
    for (let i = 0; i < n; i++) {
      const x1 = x + Math.cos(a) * L, z1 = z + Math.sin(a) * L;
      const y = 0.006 + (stowed ? i : i % 2) * 0.009;
      const seg = box([L + 0.012, 0.01, 0.032], [0, 0, 0]);
      seg.rotateY(-a);
      seg.translate((x + x1) / 2, y, (z + z1) / 2);
      add.wood(withTone(seg, lit(0.55)));
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        const tick = box([0.008, 0.004, 0.012], [0, 0, 0]);
        tick.rotateY(-a);
        tick.translate(x + (x1 - x) * t + Math.sin(a) * 0.009, y + 0.006, z + (z1 - z) * t - Math.cos(a) * 0.009);
        add.wood(withTone(tick, -0.7));
      }
      if (i > 0) add.brass(withTone(post(0.012, 0.026, x, 0.013, z, 6), lit(0.2)));
      x = x1;
      z = z1;
      points.push([x, z]);
      a += stowed ? (i % 2 ? -1 : 1) * (Math.PI - 0.06) : (i % 2 ? 1 : -1) * rng.range(0.4, 2.4) * (rng.chance(0.5) ? 1 : -1);
    }
    // Recentre le zigzag sur l'origine (le point de prise est la première branche).
    const cx = points.reduce((s, q) => s + q[0], 0) / points.length;
    const cz = points.reduce((s, q) => s + q[1], 0) / points.length;
    add.shift(-cx + 0.0, -cz);
    return { length: L * n, grip: 0.07 - cx, tip: points[points.length - 1][0] - cx };
  },
  compass(add, rng, { stowed }) {
    // Tête ronde à bouton, deux branches de laiton à pointes d'acier, ouverture de la graine.
    const half = stowed ? 0.07 : rng.range(0.08, 0.32);
    add.brass(withTone(post(0.024, 0.022, 0, 0.011, 0, 8), lit(0.2)));
    add.brass(withTone(post(0.009, 0.03, -0.025, 0.012, 0, 6), lit(0.1)));
    const L = 0.2;
    for (const s of [-1, 1]) {
      const end = [Math.cos(half) * L, 0.01, s * Math.sin(half) * L];
      const mid = [end[0] * 0.85, 0.01, end[2] * 0.85];
      add.brass(withTone(beam([0.01, 0.01, s * 0.008], mid, 0.016, 0.014), lit(0.1)));
      add.steel(withTone(beam(mid, [end[0] + 0.02, 0.008, end[2] + s * 0.003], 0.009, 0.009), lit(0.2)));
    }
    // Quart de cercle qui règle l'ouverture.
    const r = L * 0.55;
    add.brass(withTone(beam([Math.cos(half) * r, 0.016, Math.sin(half) * r], [Math.cos(-half) * r, 0.016, Math.sin(-half) * r], 0.008, 0.006), lit(0.0)));
    return { length: L + 0.03, grip: 0.0, tip: L };
  },
  "feeler-gauge"(add, rng, { stowed }) {
    // Boîtier de laiton, sept lames d'acier en éventail autour d'un rivet.
    const spread = stowed ? 0.08 : rng.range(0.0, 1.1);
    add.brass(withTone(box([0.13, 0.014, 0.034], [0.06, 0.007, 0]), lit(0.0)));
    add.brass(withTone(post(0.011, 0.04, 0.008, 0.02, 0, 6), lit(0.25)));
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = (k / (n - 1) - 0.5) * spread + spread * 0.25;
      const leaf = box([0.13, 0.003, 0.02 - k * 0.0015], [0.075, 0, 0]);
      leaf.rotateY(a);
      leaf.translate(0.008, 0.016 + k * 0.0032, 0);
      add.steel(withTone(leaf, lit(k % 2 ? 0.18 : 0.0)));
    }
    return { length: 0.16, grip: 0.05, tip: 0.14 };
  },
  hacksaw(add, rng) {
    // Arc d'acier en U, lame fine en bas, papillon de tension, poignée-pistolet de bois.
    const y = 0.012;
    add.steel(withTone(box([0.36, 0.018, 0.018], [0.24, y, 0.06]), lit(0.05)));
    for (const x of [0.065, 0.415]) add.steel(withTone(box([0.018, 0.018, 0.11], [x, y, 0.014]), lit(0.05)));
    add.steel(withTone(box([0.34, 0.006, 0.024], [0.24, 0.006, -0.036]), lit(0.3)));
    add.brass(withTone(box([0.03, 0.016, 0.03], [0.44, y, -0.036]), lit(0.2)));
    add.wood(withTone(beam([0.065, 0.016, -0.03], [0.0, 0.016, -0.085], 0.04, 0.032), lit(0.3 + rng.range(-0.05, 0.05))));
    return { length: 0.46, grip: 0.03, tip: 0.24 };
  },
  "survey-staff"(add, rng, { upright = false }) {
    // Perche de laiton de 2 m, lame à bandes de 2 px (0,125 m) noires et blanches, sabot et chapeau de laiton.
    add.brass(withTone(rodX(0.018, 0.0, 2.0, 0.018, -0.05, 6), lit(0.05)));
    add.brass(withTone(rodX(0.024, 0.0, 0.06, 0.024, -0.05, 6), lit(0.2)));
    add.brass(withTone(box([0.05, 0.03, 0.11], [1.975, 0.022, -0.01]), lit(0.15)));
    const start = 0.3;
    const worn = rng.range(-0.08, 0.04);
    for (let i = 0; i < 13; i++) {
      const dark = i % 2 === 1;
      add.paint(withTone(box([0.125, 0.022, 0.09], [start + 0.0625 + i * 0.125, 0.022, 0.0]), dark ? -1.2 : lit(worn + (rng.chance(0.15) ? -0.12 : 0))));
    }
    // Trépied de laiton replié contre la perche (couchée), déployé (debout).
    for (let k = 0; k < 3; k++) {
      if (upright) {
        const a = (k / 3) * Math.PI * 2 + 0.4;
        // Debout, x devient la hauteur et y la profondeur : les pieds partent à 0,55 m et touchent le sol.
        add.brass(withTone(beam([0.55, 0.018, -0.05], [0.0, 0.018 + Math.cos(a) * 0.32, -0.05 + Math.sin(a) * 0.32], 0.014, 0.014), 0.05));
      } else {
        add.brass(withTone(rodX(0.007, 0.05, 0.55, 0.008 + k * 0.012, -0.08 - k * 0.006, 4), 0.0));
      }
    }
    return { length: 2.0, grip: 1.15, tip: 2.0 };
  },
  "brass-rule"(add, rng) {
    // Règle de laiton de 1 m, graduations en pointillé (long tous les 10 cm, court tous les 5 cm), numéros en glyphes.
    add.brass(withTone(box([1.0, 0.012, 0.1], [0.5, 0.006, 0]), (x, y, z, nx, ny) => (ny > 0.5 ? 0.08 + rng.range(-0.02, 0.02) : -0.2)));
    for (let i = 1; i < 20; i++) {
      const long = i % 2 === 0;
      add.brass(withTone(box([0.012, 0.004, long ? 0.034 : 0.018], [i * 0.05, 0.013, 0.05 - (long ? 0.017 : 0.009) - 0.004]), -0.85));
      if (long && i % 4 === 0) add.brass(withTone(box([0.014, 0.004, 0.014], [i * 0.05, 0.013, -0.02]), -0.7));
    }
    return { length: 1.0, grip: 0.5, tip: 1.0 };
  },
  "listening-rod"(add, rng) {
    // Tige de laiton de 2 m à pointe d'acier, poignée de cuir, pavillon d'écoute au bout.
    add.steel(withTone(rodX(0.004, 0.0, 0.06, 0.018, 0, 5, 0.016), lit(0.2)));
    add.brass(withTone(rodX(0.016, 0.06, 1.88, 0.018, 0, 6), lit(0.05 + rng.range(-0.04, 0.04))));
    add.wood(withTone(rodX(0.026, 0.92, 1.18, 0.026, 0, 6), lit(-0.5)));
    for (const x of [0.92, 1.18]) add.brass(withTone(rodX(0.03, x - 0.008, x + 0.008, 0.026, 0, 6), lit(0.2)));
    const horn = plain(buildLathe([[0.016, 0], [0.024, 0.06], [0.045, 0.12], [0.075, 0.16], [0.075, 0.17], [0.012, 0.17]], { segments: 8, facets: true }));
    horn.rotateZ(-Math.PI / 2);
    horn.translate(1.84, 0.075, 0);
    add.brass(withTone(horn, (x, y, z, nx, ny, nz) => (nx > 0.6 ? -0.7 : ny > 0.4 ? 0.2 : 0)));
    return { length: 2.01, grip: 1.05, tip: 2.0 };
  },
};

/** Pinces : deux branches qui se croisent à un rivet, gaines aux manches, mâchoires pointues (coupante) ou plates à encoches (à dénuder). */
function pliers(add, rng, { jaw, pointed, sleeve, stowed }) {
  const pivot = 0.15;
  const open = stowed ? 0.008 : rng.range(0.02, 0.06);
  const y = 0.01;
  for (const s of [-1, 1]) {
    const end = [0.0, y, s * (0.022 + open)];
    add.steel(withTone(beam([pivot, y, 0], end, 0.014, 0.016), lit(0.05)));
    add.wood(withTone(beam([0.115, y + 0.002, s * (0.022 + open) * (0.115 / pivot) * 0.75 + s * 0.006], [0.0, y + 0.002, s * (0.025 + open)], 0.024, 0.022), lit(sleeve)));
    if (pointed) add.steel(withTone(beam([pivot, y, s * 0.006], [pivot + jaw, y, s * 0.002], 0.016, 0.016), lit(0.15)));
    else {
      add.steel(withTone(box([jaw, 0.016, 0.014], [pivot + jaw / 2, y, s * 0.008]), lit(0.15)));
    }
  }
  if (!pointed) add.steel(withTone(box([0.012, 0.004, 0.03], [pivot + jaw * 0.45, y + 0.009, 0]), -0.8)); // encoches
  if (!pointed) add.brass(withTone(beam([0.09, y, 0.03 + open * 0.5], [0.09, y, -0.03 - open * 0.5], 0.008, 0.008), 0.1)); // ressort
  add.brass(withTone(post(0.013, 0.03, pivot, y, 0, 8), lit(0.25)));
}

// --- Le module ---------------------------------------------------------------------------------------------------

/** Dessine un outil couché dans des listes par matière ; rend ses mesures et ses géométries. */
function drawTool(name, rng, options = {}) {
  const lists = { steel: [], brass: [], wood: [], paint: [] };
  const add = {};
  for (const key of Object.keys(lists)) add[key] = (g) => lists[key].push(g);
  let shift = null;
  add.shift = (dx, dz) => (shift = [dx, dz]);
  const info = DRAW[name](add, rng, options);
  if (shift) for (const list of Object.values(lists)) for (const g of list) g.translate(shift[0], 0, shift[1]);
  return { lists, info };
}

/** Bornes (x, z) et dessus (y) d'un outil couché. */
function bounds(lists) {
  const b = new THREE.Box3();
  for (const list of Object.values(lists)) for (const g of list) {
    g.computeBoundingBox();
    b.union(g.boundingBox);
  }
  return b;
}

/**
 * Crée l'outil.
 * @param {{seed?: number, tool?: string, pose?: string}} [given]
 * @returns {THREE.Group} `userData.grip` (point de prise), `userData.tip` (bout qui travaille), repère de l'asset ;
 *   pour la trousse, `userData.kit.slots` : [{ tool, present, position }]
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 4111 + 59);
  const all = { steel: [], brass: [], wood: [], paint: [] };
  const merge = (lists, m) => {
    for (const [key, list] of Object.entries(lists)) for (const g of list) all[key].push(m ? g.applyMatrix4(m) : g);
  };
  const group = new THREE.Group();
  group.name = meta.name;
  let grip = new THREE.Vector3(), tip = new THREE.Vector3();

  if (p.tool === "kit") {
    // Trousse de cuir dépliée, rabat roulé au fond, deux colonnes de six outils rangés (pinces fermées, mètre replié)
    // sous leurs boucles ; la profondeur suit la colonne la plus chargée.
    const W = 0.92;
    const order = KIT.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const missing = new Set();
    const nMissing = rng.int(0, 2);
    while (missing.size < nMissing) missing.add(rng.int(0, 11));
    const columns = [order.slice(0, 6), order.slice(6)].map((names) => {
      const drawn = names.map((name) => drawTool(name, rng, { stowed: true }));
      const extents = drawn.map((d) => bounds(d.lists));
      return { names, drawn, extents, total: extents.reduce((s, b) => s + (b.max.z - b.min.z), 0) };
    });
    const D = Math.max(0.6, Math.max(...columns.map((c) => c.total)) + 5 * 0.025 + 0.1);
    all.wood.push(withTone(buildBlock([W, 0.01, D], [0, 0.005, 0]), (x, y, z, nx, ny) => (ny > 0.5 ? -0.55 + (Math.abs(x) < 0.02 ? -0.15 : 0) : -0.8)));
    all.wood.push(withTone(rodX(0.03, -W / 2, W / 2, 0.03, -D / 2 - 0.005, 8), lit(-0.45)));
    all.wood.push(withTone(beam([0.25, 0.012, D / 2 - 0.03], [0.5, 0.004, D / 2 + 0.08 + rng.range(0, 0.06)], 0.022, 0.006), lit(-0.5))); // lacet
    const slots = [];
    columns.forEach(({ names, drawn, extents, total }, c) => {
      const gap = (D - 0.1 - total) / 5;
      let z = -D / 2 + 0.05;
      drawn.forEach((d, i) => {
        const b = extents[i];
        const index = c * 6 + i;
        const x0 = (c === 0 ? -W / 2 + 0.025 : 0.015) + (0.43 - (b.max.x - b.min.x)) / 2;
        const m = new THREE.Matrix4().makeTranslation(x0 - b.min.x, 0.01, z - b.min.z);
        const zc = z + (b.max.z - b.min.z) / 2;
        const present = !missing.has(index);
        if (present) merge(d.lists, m);
        else for (const list of Object.values(d.lists)) for (const g of list) g.dispose();
        // Boucle de cuir au point de prise : par-dessus l'outil, ou aplatie s'il manque.
        const gx = x0 + (d.info.grip - b.min.x);
        const top = present ? 0.01 + b.max.y + 0.003 : 0.016;
        all.wood.push(withTone(buildBlock([0.03, 0.006, b.max.z - b.min.z + 0.02], [gx, top, zc]), lit(-0.62)));
        slots.push({ tool: names[i], present, position: new THREE.Vector3(gx, 0.01, zc) });
        z += b.max.z - b.min.z + gap;
      });
    });
    group.userData.kit = { slots };
    grip.set(0, 0.02, 0);
    tip.set(0, 0.02, 0);
  } else {
    const upright = p.pose === "upright" && LONG.has(p.tool);
    const { lists, info } = drawTool(p.tool, rng, { upright });
    const m = new THREE.Matrix4();
    // Debout et en main : la longueur (x) monte vers +y, la face (y) regarde +z.
    const stand = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
    if (p.pose === "hand") {
      m.copy(stand).multiply(new THREE.Matrix4().makeTranslation(-info.grip, -0.02, 0));
      grip.set(0, 0, 0);
      tip.set(0, info.tip - info.grip, 0);
    } else if (upright) {
      const lean = p.tool === "survey-staff" ? 0 : -0.14 - rng.range(0, 0.05);
      m.makeRotationX(lean).multiply(stand);
      grip.set(0, info.grip, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(lean));
      tip.set(0, info.tip, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(lean));
    } else {
      const yaw = rng.range(-0.45, 0.45);
      const center = (info.length / 2) * (p.tool === "folding-rule" ? 0 : 1);
      m.makeRotationY(yaw).multiply(new THREE.Matrix4().makeTranslation(-center, 0, 0));
      grip.set(info.grip, 0.02, 0).applyMatrix4(m);
      tip.set(info.tip, 0.02, 0).applyMatrix4(m);
    }
    merge(lists, m);
  }

  const wood = p.tool === "survey-staff" ? null : WOODS.oak;
  const materials = {
    steel: () => metalMaterial(METALS.iron, { id: 30, tone: true }),
    brass: () => metalMaterial(METALS.bronze, { id: 31, tone: true }),
    wood: () => createToonMaterial({ ramp: wood.ramp, ink: wood.ink, steps: [0.26, 0.48, 0.74], tone: true, crease: true, id: 20 }),
    paint: () => createToonMaterial({ ramp: PAINT.ramp, ink: PAINT.ink, steps: [0.25, 0.45, 0.7], tone: true, crease: true, id: 21 }),
  };
  for (const key of ["wood", "paint", "brass", "steel"]) {
    if (all[key].length === 0) continue;
    const mesh = new THREE.Mesh(mergeToned(all[key]), materials[key]());
    mesh.name = key;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.grip = grip;
  group.userData.tip = tip;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
