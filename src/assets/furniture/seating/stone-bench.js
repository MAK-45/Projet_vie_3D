// Banc de pierre du Complexe (fiches SAS-06, GAL-07, ORA-10, E5-02, docs/complexe/) : un bloc de pierre fumée aux
// arêtes usées, l'assise plus claire au centre là où l'on s'est assis des siècles.
// - Sas : 2,2 × 0,55 m, deux accoudoirs de bronze, dossier bas de 0,25 m ceint d'une sangle de cuir ;
// - galerie : 1,2 × 0,4 m, une dalle sur deux pieds de bronze, usure marquée au centre ;
// - méditation (Oracle) : 1,6 × 0,45 × 0,40 m, coussin de cuir noir capitonné, patins de bronze ;
// - maintenance (salle de l'Éveil) : 1,2 × 0,6 m, deux anneaux d'attache de bronze, taches d'huile sombres.
// La graine découpe l'assise en 1 à 3 blocs (joints d'un pixel, hauteurs et tons un peu différents), écorne un
// angle, déplace l'usure, la sangle, les taches. `group.userData.seats` : où un personnage s'assoit.
//
// 3 draw calls au plus : pierre (tons par sommet), bronze, cuir.

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock } from "../../kit/geometry.js";
import { FABRICS, METALS, STONES } from "../../kit/palettes.js";
import { PX, gridBlock, mergeToned, metalMaterial, orient, plain, ring, stoneMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MODELS = {
  sas: "Sas (2,2 m, accoudoirs, dossier sanglé)",
  gallery: "Galerie (1,2 m, pieds de bronze)",
  meditation: "Méditation (1,6 m, coussin de cuir)",
  maintenance: "Maintenance (1,2 m, anneaux, huile)",
};
// Longueur, profondeur, hauteur de l'assise (m).
const SIZES = { sas: [2.2, 0.55, 0.45], gallery: [1.2, 0.4, 0.45], meditation: [1.6, 0.45, 0.4], maintenance: [1.2, 0.6, 0.45] };

const params = {
  seed: seedParam("Change le découpage de l'assise en blocs, l'angle écorné, la place de l'usure, de la sangle et des taches."),
  model: choiceParam("Modèle", MODELS, "Banc du Sas, de galerie, de méditation (Oracle) ou de maintenance (salle de l'Éveil)."),
  stone: stoneParam("Pierre du banc.", { only: ["smoked", "blackBasalt"] }),
};

export const meta = {
  id: "furniture/seating/stone-bench",
  name: "Banc de pierre",
  nameEn: "Stone bench",
  category: "furniture",
  subcategory: "seating",
  description:
    "Banc du Complexe taillé dans la pierre fumée, arêtes usées et assise polie au centre. Quatre modèles : le banc " +
    "du Sas (accoudoirs de bronze, dossier bas sanglé de cuir), le banc de galerie sur pieds de bronze, le banc de " +
    "méditation à coussin de cuir noir, le banc de maintenance à anneaux d'attache et taches d'huile. Fiches SAS-06, " +
    "GAL-07, ORA-10, E5-02.",
  tags: [
    "banc", "assise", "siège", "pierre fumée", "bronze", "cuir", "accoudoirs", "coussin", "usure", "le complexe",
    "complexe", "ancien-tech", "mobilier", "s'asseoir", "intérieur",
    "bench", "seat", "smoked stone", "armrests", "cushion", "wear", "ancient complex", "ancient-tech", "furniture",
    "sit", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units: "1 unité = 1 mètre ; origine au sol, au centre ; le banc est le long de x, on s'y assoit face à +z (dossier côté −z)",
  footprint: { radius: 1.2, height: 0.72 },
  animated: [],
  params,
  variants: variantsOf("model", params.model),
};

/**
 * Crée le banc.
 * @param {{seed?: number, model?: string, stone?: string}} [given]
 * @returns {THREE.Group} `group.userData.seats` : [{ position: Vector3, facing: Vector3 }] (assise, regard)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const rng = createRng(p.seed * 7919 + 31);
  const noise = createNoise3(p.seed + 11);
  const [L, D, H] = SIZES[p.model];
  const stoneParts = [];
  const bronzeParts = [];
  const leatherParts = [];

  // --- Assise : 1 à 3 blocs côte à côte (joint d'un pixel), chacun son ton et un pixel de hauteur en plus ou en moins.
  const seatThick = p.model === "gallery" ? 0.14 : p.model === "meditation" ? H - 0.04 - 0.07 : H - 0.06;
  const seatTop = p.model === "meditation" ? H - 0.07 : H;
  const seatBottom = seatTop - seatThick;
  const count = p.model === "sas" ? rng.int(1, 3) : p.model === "gallery" ? 1 : rng.int(1, 2);
  const cuts = [-L / 2];
  for (let i = 1; i < count; i++) cuts.push(-L / 2 + (L * i) / count + rng.range(-0.12, 0.12));
  cuts.push(L / 2);
  // Usure : centre de l'assise (un peu décalé), plus marquée sur la galerie.
  const wearX = rng.range(-0.2, 0.2) * L;
  const wearForce = p.model === "gallery" ? 0.55 : p.model === "meditation" ? 0 : 0.4;
  const oily = p.model === "maintenance";
  const chipCorner = rng.int(0, 3); // angle écorné : 0..3 (avant gauche, avant droit, arrière droit, arrière gauche)
  for (let i = 0; i < count; i++) {
    const x0 = cuts[i] + (i ? PX / 2 : 0), x1 = cuts[i + 1] - (i < count - 1 ? PX / 2 : 0);
    const lift = (rng.int(-1, 1) * PX) / 4;
    const blockTone = rng.range(-0.07, 0.07);
    const top = seatTop + lift;
    const tone = (x, y, z) => {
      let t = blockTone;
      if (y > top - 0.01) {
        t -= 0.17; // le dessus un cran plus bas : l'usure peut y remonter
        const u = (x - wearX) / (L * 0.32), v = (z - D * 0.05) / (D * 0.45);
        t += wearForce * Math.max(0, 1 - Math.hypot(u, v)) ** 0.8;
      } else if (y < seatBottom + 0.05) t -= 0.12; // le pied, plus sombre (ombre, poussière)
      if (oily) t -= 0.35 * THREE.MathUtils.smoothstep(noise(x * 2.6, y * 2.6 + 4, z * 2.6), 0.64, 0.72);
      return t;
    };
    stoneParts.push(withTone(gridBlock([x1 - x0, seatThick + lift, D], [(x0 + x1) / 2, seatBottom + (seatThick + lift) / 2, 0], { cell: 0.11 }), tone));
  }
  // Cœur en retrait, sombre : il se voit au fond des joints entre blocs.
  if (count > 1) stoneParts.push(withTone(buildBlock([L - 0.04, seatThick - 0.03, D - 0.04], [0, seatBottom + (seatThick - 0.03) / 2, 0]), -0.55));
  // Angle écorné : un éclat de pierre en moins, rendu par un bloc plus clair (la cassure fraîche) un pixel plus bas.
  {
    const sx = chipCorner === 1 || chipCorner === 2 ? 1 : -1;
    const sz = chipCorner < 2 ? 1 : -1;
    const w = rng.range(0.08, 0.16), d = rng.range(0.06, 0.12);
    stoneParts.push(withTone(buildBlock([w, PX * 0.6, d], [sx * (L / 2 - w / 2 + 0.004), seatTop + 0.002, sz * (D / 2 - d / 2 + 0.004)]), 0.35));
  }

  // --- Socle en retrait (le bloc ne touche le sol que par un pied plus sombre), sauf la galerie (pieds de bronze).
  if (p.model !== "gallery") {
    const plinth = p.model === "meditation" ? 0.0 : 0.06;
    if (plinth > 0) stoneParts.push(withTone(buildBlock([L - 0.08, plinth, D - 0.08], [0, plinth / 2, 0]), -0.4));
  }

  // --- Modèles.
  if (p.model === "sas") {
    // Dossier bas : bloc de 0,25 m sur l'arrière, ceint d'une sangle de cuir avec une boucle de bronze.
    const backD = 0.12;
    const zb = -D / 2 + backD / 2;
    stoneParts.push(withTone(gridBlock([L - 0.24, 0.25, backD], [0, seatTop + 0.125, zb], { cell: 0.12 }), (x, y) => (y > seatTop + 0.24 ? 0.12 : -0.05)));
    const strapX = rng.range(-0.35, 0.35) * L;
    const strapW = 0.07;
    leatherParts.push(buildBlock([strapW, 0.26, backD + 0.02], [strapX, seatTop + 0.125, zb]));
    leatherParts.push(buildBlock([strapW, 0.02, backD + 0.02], [strapX, seatTop + 0.255, zb]));
    bronzeParts.push(withTone(buildBlock([strapW + 0.02, 0.05, PX * 0.4], [strapX, seatTop + 0.15, zb + backD / 2 + 0.012]), 0.3));
    // Accoudoirs de bronze : un montant et une crosse arrondie à chaque bout.
    for (const s of [-1, 1]) {
      const x = s * (L / 2 - 0.06);
      bronzeParts.push(withTone(buildBlock([0.08, 0.2, D - 0.08], [x, seatTop + 0.1, 0.02]), -0.05));
      bronzeParts.push(withTone(buildBlock([0.1, 0.04, D - 0.04], [x, seatTop + 0.22, 0.02]), 0.15));
      const scroll = plain(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8));
      bronzeParts.push(orient(scroll, [x, seatTop + 0.19, D / 2 - 0.02], [1, 0, 0]));
      bronzeParts.push(withTone(buildBlock([0.1, PX, PX * 0.5], [x, seatTop + 0.1, D / 2 - 0.02]), -0.6)); // gorge
    }
  } else if (p.model === "gallery") {
    // Deux pieds de bronze en trapèze, semelle et chapeau.
    const legH = seatBottom;
    for (const s of [-1, 1]) {
      const x = s * (L / 2 - 0.2) + rng.range(-0.02, 0.02);
      bronzeParts.push(buildBlock([0.08, legH, D - 0.12], [x, legH / 2, 0], [0, 0, 0], { taper: -0.25 }));
      bronzeParts.push(withTone(buildBlock([0.14, 0.04, D - 0.06], [x, 0.02, 0]), -0.1));
      bronzeParts.push(withTone(buildBlock([0.12, PX * 0.6, D - 0.04], [x, legH - PX * 0.3, 0]), 0.15));
    }
  } else if (p.model === "meditation") {
    // Patins de bronze sous le bloc ; coussin de cuir noir capitonné (boutons sombres).
    for (const s of [-1, 1]) {
      bronzeParts.push(withTone(buildBlock([0.1, 0.04, D - 0.06], [s * (L / 2 - 0.12), 0.02, 0]), 0.05));
    }
    const cw = L - 0.16 - rng.range(0, 0.1), cd = D - 0.06;
    const cx = rng.range(-0.04, 0.04);
    leatherParts.push(withTone(gridBlock([cw, 0.05, cd], [cx, seatTop + 0.025, 0], { cell: 0.1 }), (x, y) => (y > seatTop + 0.04 ? 0.15 : -0.1)));
    leatherParts.push(withTone(buildBlock([cw - PX * 2, 0.025, cd - PX * 2], [cx, seatTop + 0.06, 0]), 0.2));
    const buttons = Math.round(cw / 0.3);
    for (let i = 0; i < buttons; i++) {
      const x = cx - cw / 2 + ((i + 0.5) * cw) / buttons;
      leatherParts.push(withTone(buildBlock([PX * 0.7, 0.006, PX * 0.7], [x, seatTop + 0.074, 0]), -0.9));
    }
  } else {
    // Maintenance : deux anneaux d'attache sur la face avant, chacun sur sa platine.
    for (const s of [-1, 1]) {
      const x = s * (L / 2 - 0.22) + rng.range(-0.04, 0.04);
      const y = seatTop - 0.16;
      bronzeParts.push(withTone(buildBlock([0.1, 0.08, PX * 0.4], [x, y, D / 2 + PX * 0.2]), -0.05));
      const r = ring({ radius: 0.05, height: PX * 0.8, thickness: PX * 0.8, segments: 8 });
      bronzeParts.push(withTone(orient(r, [x, y - 0.06, D / 2 + PX * 0.6], [0, 0, 1]), 0.15));
    }
    // Une coulure d'huile sur la face avant et une flaque au sol, de la couleur du cuir goudronné (presque noire).
    const ox = rng.range(-0.3, 0.3) * L;
    leatherParts.push(withTone(buildBlock([PX, seatTop * 0.6, 0.004], [ox, seatTop * 0.62, D / 2 + 0.002]), -0.2));
    leatherParts.push(withTone(buildBlock([0.22, 0.003, 0.1], [ox + 0.04, 0.0015, D / 2 + 0.06], [0, rng.range(-0.4, 0.4), 0]), -0.2));
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const stoneMesh = new THREE.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: rng.int(0, 96), id: 20, grain: 0.07 }));
  stoneMesh.name = "stone";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);
  if (bronzeParts.length) {
    const bronze = new THREE.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
    bronze.name = "bronze";
    bronze.castShadow = true;
    bronze.receiveShadow = true;
    group.add(bronze);
  }
  if (leatherParts.length) {
    const leather = new THREE.Mesh(
      mergeToned(leatherParts),
      createToonMaterial({ ramp: FABRICS.tarredLeather.ramp, ink: FABRICS.tarredLeather.ink, steps: [0.3, 0.55, 0.8], tone: true, crease: true, id: 31 }),
    );
    leather.name = "leather";
    leather.castShadow = true;
    leather.receiveShadow = true;
    group.add(leather);
  }

  // Places assises : une tous les 0,6 m environ, au bord avant de l'assise, regard vers +z.
  const seatY = p.model === "meditation" ? seatTop + 0.07 : seatTop;
  const places = Math.max(1, Math.floor((L - 0.2) / 0.6));
  group.userData.seats = Array.from({ length: places }, (_, i) => ({
    position: new THREE.Vector3(-L / 2 + ((i + 0.5) * L) / places, seatY, 0.05),
    facing: new THREE.Vector3(0, 0, 1),
  }));
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
