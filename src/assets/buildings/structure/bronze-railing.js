// Rambarde de bronze du Complexe (docs/complexe/ : SAS-15, ETU-15, COE-03, barrière de COE-15) : une rangée de
// poteaux de bronze reliés entre eux, en ligne droite ou en cercle autour de ce qu'il ne faut pas approcher.
// - balisage (SAS-15, ETU-15) : poteaux d'un pixel de 0,90 m sur un disque de 0,25 m, chaîne en pointillé qui pend ;
// - garde-corps (COE-03, la fosse du Cœur) : poteaux scellés de 1,00 m, lisse de laiton, chaîne lourde au milieu ;
// - barrière (COE-15) : poteaux à pied, traverse haute peinte de bandes ambre usées, traverse basse.
// En cercle, un passage peut rester ouvert (face à +z). Les segments bloquants sont dans `group.userData.blocking`
// (liste de [x1, z1, x2, z2] dans le repère de l'asset), pour que le monde fasse contourner les personnages.
// La graine change l'affaissement de chaque chaîne, un poteau un peu penché, l'usure des bandes et des lisses.
//
// 2 draw calls (3 pour la barrière) : bronze (poteaux, chaînes), laiton (lisses, pieds), peinture ambre (bandes).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe } from "../../kit/geometry.js";
import { METALS } from "../../kit/palettes.js";
import { PX, beam, chain, mergeToned, metalMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = {
  chain: "Balisage (poteaux et chaîne)",
  rail: "Garde-corps (lisse et chaîne lourde)",
  barrier: "Barrière (bandes ambre)",
};
const LAYOUTS = { line: "En ligne", circle: "En cercle" };
const OPENINGS = { closed: "Fermé", open: "Un passage ouvert (face à +z)" };
const HEIGHTS = { chain: 0.9, rail: 1.0, barrier: 1.0 };
// Peinture ambre des barrières (pas une lueur : elle s'use, elle prend la lumière).
const AMBER_PAINT = { ramp: ["#4a2412", "#8a4a1c", "#c8782c", "#eaa850"], ink: "#24120a" };

const params = {
  seed: seedParam("Change l'affaissement des chaînes, le poteau penché, l'usure des bandes et des lisses, les tons du bronze."),
  kind: choiceParam("Sorte", KINDS, "Balisage (poteaux de 0,9 m et chaîne pendante), garde-corps de fosse (lisse de laiton et chaîne lourde), ou barrière à bandes ambre."),
  layout: choiceParam("Tracé", LAYOUTS, "En ligne droite (centrée sur l'origine, le long de x), ou en cercle autour de l'origine."),
  segments: { type: "int", default: 3, min: 1, max: 16, label: "Segments", description: "Nombre d'intervalles entre deux poteaux (en cercle : tout le tour, passage compris)." },
  span: numberParam("Écart des poteaux", 2, 0.8, 2.5, "En ligne : la distance entre deux poteaux.", { step: 0.05, unit: "m" }),
  radius: numberParam("Rayon", 3.2, 1, 8, "En cercle : le rayon du cercle des poteaux (3,2 m autour de la fosse du Cœur, 2,75 m pour un périmètre d'étude).", { step: 0.05, unit: "m" }),
  opening: choiceParam("Passage", OPENINGS, "En cercle : tout fermé, ou un intervalle laissé ouvert face à +z."),
};

export const meta = {
  id: "buildings/structure/bronze-railing",
  name: "Rambarde de bronze",
  nameEn: "Bronze railing",
  category: "buildings",
  subcategory: "structure",
  description:
    "Poteaux de bronze du Complexe reliés en ligne ou en cercle : balisage à chaîne pendante sur disques, garde-corps " +
    "de fosse à lisse de laiton et chaîne lourde, barrière à bandes ambre usées. Passage ouvert possible ; segments " +
    "bloquants fournis au monde. Fiches SAS-15, ETU-15, COE-03, COE-15.",
  tags: [
    "rambarde", "balisage", "poteau", "chaîne", "garde-corps", "barrière", "lisse", "périmètre", "bronze", "bandes ambre",
    "le complexe", "complexe", "ancien-tech", "modulaire", "obstacle", "intérieur",
    "railing", "stanchion", "post", "chain", "guard rail", "barrier", "handrail", "perimeter", "brass", "amber stripes",
    "ancient complex", "ancient-tech", "modular", "barricade", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; origine au sol, au milieu de la ligne ou au centre du cercle",
  footprint: { radius: 3.1, height: 1 },
  animated: [],
  params,
  variants: variantsOf("kind", params.kind),
};

/**
 * Crée la rambarde.
 * @param {{seed?: number, kind?: string, layout?: string, segments?: number, span?: number, radius?: number,
 *   opening?: string}} [given]
 * @returns {THREE.Group} `group.userData.blocking` : segments [x1, z1, x2, z2] ; `group.userData.posts` : [x, z]
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 61);
  const H = HEIGHTS[p.kind];
  const bronze = [];
  const brass = [];
  const paint = [];

  // --- Poteaux : position au sol, et sommet (un poteau penché tiré de la graine).
  const posts = [];
  const links = []; // paires d'indices de poteaux reliés
  if (p.layout === "circle") {
    const n = Math.max(3, p.segments);
    for (let i = 0; i < n; i++) {
      const a = Math.PI / 2 + Math.PI / n + (i * Math.PI * 2) / n;
      posts.push(new THREE.Vector3(Math.cos(a) * p.radius, 0, Math.sin(a) * p.radius));
    }
    for (let i = 0; i < n; i++) if (!(p.opening === "open" && i === n - 1)) links.push([i, (i + 1) % n]);
  } else {
    const length = p.segments * p.span;
    for (let i = 0; i <= p.segments; i++) posts.push(new THREE.Vector3(-length / 2 + i * p.span, 0, 0));
    for (let i = 0; i < p.segments; i++) links.push([i, i + 1]);
  }
  const leaning = rng.chance(0.6) ? rng.int(0, posts.length - 1) : -1;
  const tops = posts.map((base, i) => {
    const top = base.clone().setY(H);
    if (i === leaning) {
      const lean = rng.range(0.04, 0.08); // 3 à 5° de travers
      const a = rng.range(0, Math.PI * 2);
      top.x += Math.cos(a) * lean;
      top.z += Math.sin(a) * lean;
    }
    return top;
  });
  const at = (i, y) => posts[i].clone().lerp(tops[i], y / H); // point du poteau i à la hauteur y

  posts.forEach((base, i) => {
    const top = tops[i];
    const tone = rng.range(-0.06, 0.06);
    if (p.kind === "chain") {
      // Disque de 0,25 m, fût d'un pixel, bague et pommeau.
      const disc = buildLathe([[0, 0], [0.125, 0], [0.12, 0.025], [0.05, 0.05], [0, 0.05]], { segments: 10, facets: true });
      disc.translate(base.x, 0, base.z);
      bronze.push(withTone(disc, tone - 0.05));
      bronze.push(withTone(beam(base.clone().setY(0.04), top, PX * 1.1, PX * 1.1), tone));
      const knob = buildLathe([[0, 0], [0.04, 0], [0.05, 0.035], [0.03, 0.07], [0, 0.075]], { segments: 6, facets: true });
      knob.translate(top.x, top.y - 0.01, top.z);
      brass.push(withTone(knob, 0.15));
      const ringAt = at(i, H - 0.08);
      brass.push(withTone(buildBlock([PX * 1.6, PX * 0.8, PX * 1.6], [ringAt.x, ringAt.y, ringAt.z]), 0.05));
    } else {
      // Poteau carré scellé (garde-corps) ou sur un pied (barrière), chapeau plat.
      const w = p.kind === "rail" ? PX * 1.2 : PX * 1.4;
      const foot = p.kind === "rail" ? [0.16, 0.02, 0.16] : [0.22, 0.05, 0.22];
      brass.push(withTone(buildBlock(foot, [base.x, foot[1] / 2, base.z], [0, rng.range(0, 0.3), 0]), -0.15));
      bronze.push(withTone(beam(base.clone().setY(foot[1]), top, w, w), tone));
      bronze.push(withTone(buildBlock([w + 0.03, 0.03, w + 0.03], [top.x, top.y + 0.01, top.z]), tone + 0.12));
      const collar = at(i, 0.25);
      bronze.push(withTone(buildBlock([w + 0.02, PX, w + 0.02], [collar.x, collar.y, collar.z]), tone + 0.05));
    }
  });

  // --- Liaisons.
  for (const [i, j] of links) {
    const a = tops[i], b = tops[j];
    const length = a.distanceTo(b);
    if (p.kind === "chain") {
      // Chaîne d'un poteau à l'autre, accrochée à la bague, flèche tirée de la graine.
      const sag = length * rng.range(0.07, 0.13);
      bronze.push(withTone(chain(at(i, H - 0.08), at(j, H - 0.08), { sag, link: 0.075, width: PX * 0.85 }), 0.12));
    } else if (p.kind === "rail") {
      // Lisse de laiton posée sur les chapeaux, chaîne lourde au milieu.
      const lisse = beam(a.clone().setY(a.y + 0.04), b.clone().setY(b.y + 0.04), PX * 1.4, PX, 0);
      brass.push(withTone(lisse, (x, y, z, nx, ny) => (ny > 0.5 ? 0.18 : 0) + rng.range(-0.03, 0.03)));
      const sag = 0.06 + length * rng.range(0.03, 0.06);
      bronze.push(withTone(chain(at(i, 0.58), at(j, 0.58), { sag, link: 0.1, width: PX * 1.15 }), 0.05));
    } else {
      // Barrière : traverse haute à bandes ambre usées, traverse basse nue.
      const y0 = H - 0.1;
      const da = at(i, y0), db = at(j, y0);
      const dir = db.clone().sub(da);
      const len = dir.length();
      dir.normalize();
      bronze.push(withTone(beam(da, db, 0.035, 0.15), -0.3));
      const bands = Math.max(2, Math.round(len / 0.12));
      for (let k = 0; k < bands; k += 2) {
        if (rng.chance(0.12)) continue; // bande écaillée
        const worn = rng.chance(0.25) ? rng.range(0.55, 0.85) : 1; // usée : plus courte
        const c = da.clone().addScaledVector(dir, ((k + 0.5) / bands) * len);
        const band = beam(c.clone().addScaledVector(dir, -len / bands / 2), c.clone().addScaledVector(dir, len / bands / 2), 0.042, 0.15 * worn);
        band.translate(0, -0.075 * (1 - worn), 0);
        paint.push(withTone(band, rng.range(-0.08, 0.06)));
      }
      bronze.push(withTone(beam(at(i, 0.42), at(j, 0.42), PX, PX * 1.2), 0));
    }
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const add = (parts, material, name) => {
    if (!parts.length) return;
    const mesh = new THREE.Mesh(mergeToned(parts), material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  add(bronze, metalMaterial(METALS.patinatedBronze, { id: 21, tone: true }), "bronze");
  add(brass, metalMaterial(METALS.blackenedBrass, { id: 22, tone: true }), "brass");
  add(paint, createToonMaterial({ ramp: AMBER_PAINT.ramp, ink: AMBER_PAINT.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, id: 23 }), "paint");

  group.userData.blocking = links.map(([i, j]) => [posts[i].x, posts[i].z, posts[j].x, posts[j].z]);
  group.userData.posts = posts.map((v) => [v.x, v.z]);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
