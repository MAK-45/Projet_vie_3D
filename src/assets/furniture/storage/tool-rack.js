// Râtelier à outils mural de l'Atelier du Complexe (fiche ATE-05, docs/complexe/) : 2,0 × 0,15 × 1,2 m. Planche de
// chêne noirci, crochets de bronze, et les emplacements marqués par des silhouettes d'outils peintes en blanc usé
// (un pixel de trait clair) — certaines vides. Quelques outils simples y pendent : clés, pinces, lime (les vrais
// outils à main viennent de `artisan-tools`, lot 10, posés par le monde sur l'établi). Une étaglière en bas
// accueille un vrai dé (couche de bois posée en travers).
//
// La graine change l'ordre des silhouettes, les crochets vides, les tons du bois.
//
// 2 draw calls : bois noirci, bronze (crochets, outils, silhouettes en ton clair usé).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads } from "../../kit/geometry.js";
import { METALS, WOODS } from "../../kit/palettes.js";
import { PX, beam, mergeToned, metalMaterial, plain, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = {
  full: "Bien garni",
  sparse: "Mal servi",
  empty: "Vide (silhouettes seules)",
};

const params = {
  seed: seedParam("Change l'ordre des silhouettes, les crochets vides, les outils pendus, les tons du bois."),
  wear: choiceParam("Garniture", KINDS, "Bien garni (le râtelier de l'Atelier), mal servi (la moitié des places), ou vidé — les silhouettes peintes marquent ce qui manque."),
};

export const meta = {
  id: "furniture/storage/tool-rack",
  name: "Râtelier à outils mural",
  nameEn: "Wall tool rack",
  category: "furniture",
  subcategory: "storage",
  description:
    "Planche de chêne noirci de l'Atelier du Complexe : crochets de bronze, emplacements d'outils marqués de " +
    "silhouettes peintes en blanc usé, certaines vides. Les outils simples y pendent ; bien garni, mal servi " +
    "ou vidé de son outillage. Fiche ATE-05.",
  tags: [
    "râtelier", "outils", "portemanteau", "murale", "crochets", "silhouettes", "chêne noirci", "laiton",
    "atelier", "le complexe", "complexe", "ancien-tech", "mobilier", "rangement", "intérieur",
    "tool rack", "pegboard", "wall-mounted", "hooks", "painted silhouettes", "blackened oak", "brass",
    "workshop", "ancient complex", "ancient-tech", "furniture", "storage", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre, dos plaqué au mur (le mur serait en z = −0,075) ; face vers +z",
  footprint: { radius: 1.05, height: 1.2 },
  animated: [],
  params,
  variants: variantsOf("wear", params.wear),
};

// Silhouettes d'outils : rectangle posé face au mur, en ton clair usé (un pixel d'épaisseur).
const TOOL_NAMES = ["clé à molette", "pince", "lime", "burin", "marteau", "tournevis", "scie", "compas"];

/**
 * Crée le râtelier.
 * @param {{seed?: number, wear?: string}} [given]
 * @returns {THREE.Group} `group.userData.hooks` : [{ x, y, tool }] place et outil attendu de chaque crochet
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 1301);
  const wood = [], brass = [];
  const W = 2.0, D = 0.15, H = 1.2;
  const occupancy = { full: 1, sparse: 0.5, empty: 0 }[p.wear];
  const woodTone = rng.range(-0.06, 0.08);

  // --- La planche : bord épais, chants verticaux avec deux pentures de bronze en bas.
  wood.push(withTone(buildBlock([W, H, D], [0, H / 2, -D / 2]), (x, y, z, nx) => woodTone + (nx > 0.5 ? 0.08 : 0) + (Math.sin(x * 9) > 0.6 ? -0.06 : 0)));
  for (const s of [-1, 1]) brass.push(withTone(buildBlock([0.08, 0.1, 0.02], [s * (W / 2 - 0.06), 0.05, -D / 2 - 0.01]), 0.1));

  // --- Crochets et silhouettes : huit places, la graine en mélange l'ordre ; les silhouettes restent même
  // quand l'outil manque (le rez-de-chaussée du râtelier raconte l'usage).
  const order = TOOL_NAMES.map((name, i) => ({ name, r: rng.range(0, 1) })).sort((a, b) => a.r - b.r);
  const hooks = [];
  order.forEach((entry, i) => {
    const x = -W / 2 + 0.16 + (i * (W - 0.32)) / (order.length - 1);
    const y = H - 0.18 - (i % 2) * 0.1 - Math.floor(i / 4) * 0.08; // deux hauteurs de place
    const home = rng.chance(0.65);
    const hung = home && rng.chance(Math.min(1, occupancy + (occupancy ? 0.15 : 0)));
    hooks.push({ x, y, tool: hung ? entry.name : null, toolName: entry.name });
    buildTool(entry.name, x, y, hung);
  });
  function buildTool(toolName, x, y, hung) {
    // Le crochet tient au mur même quand l'outil est parti.
    brass.push(withTone(beam([x, y, -D / 2 + 0.01], [x, y - 0.045, -D / 2 + 0.05], 0.008, 0.008), 0.25));
    const tone = hung ? 0.4 : 0.75; // l'outil pend en bronze ; sa silhouette est un ton presque blanc usé
    const quads = [];
    if (toolName === "clé à molette") {
      if (hung) {
        brass.push(withTone(buildBlock([0.05, 0.28, 0.025], [x, y - 0.2, -D / 2 + 0.055]), tone));
        brass.push(withTone(buildBlock([0.012, 0.1, 0.012], [x, y - 0.345, -D / 2 + 0.06]), 0.2));
      } else quads.push({ position: [x, y - 0.22, -D / 2 + 0.003], size: [0.05, 0.36], normal: [0, 0, 1], tone });
    } else if (toolName === "pince") {
      if (hung) {
        brass.push(withTone(buildBlock([0.05, 0.16, 0.02], [x, y - 0.1, -D / 2 + 0.055]), tone));
        brass.push(withTone(buildBlock([0.055, 0.05, 0.02], [x + 0.01, y - 0.2, -D / 2 + 0.05]), tone));
      } else quads.push({ position: [x, y - 0.12, -D / 2 + 0.003], size: [0.04, 0.3], normal: [0, 0, 1], tone });
    } else if (toolName === "lime") {
      if (hung) brass.push(withTone(plain(new THREE.CylinderGeometry(0.01, 0.012, 0.32, 6)).translate(x, y - 0.2, -D / 2 + 0.055), tone));
      else quads.push({ position: [x, y - 0.2, -D / 2 + 0.003], size: [0.02, 0.42], normal: [0, 0, 1], tone });
    } else if (toolName === "burin" || toolName === "tournevis") {
      if (hung) brass.push(withTone(buildBlock([0.02, (toolName === "burin" ? 0.24 : 0.28), 0.02], [x, y - 0.16, -D / 2 + 0.055]), tone));
      else quads.push({ position: [x, y - 0.16, -D / 2 + 0.003], size: [0.025, 0.34], normal: [0, 0, 1], tone });
    } else if (toolName === "marteau") {
      if (hung) {
        brass.push(withTone(buildBlock([0.025, 0.26, 0.025], [x, y - 0.17, -D / 2 + 0.055]), tone));
        brass.push(withTone(buildBlock([0.07, 0.045, 0.045], [x, y - 0.32, -D / 2 + 0.055]), tone));
      } else quads.push({ position: [x, y - 0.18, -D / 2 + 0.003], size: [0.07, 0.4], normal: [0, 0, 1], tone });
    } else if (toolName === "scie") {
      if (hung) {
        brass.push(withTone(buildBlock([0.025, 0.3, 0.12], [x, y - 0.2, -D / 2 + 0.11]), tone));
      } else quads.push({ position: [x, y - 0.22, -D / 2 + 0.003], size: [0.03, 0.44], normal: [0, 0, 1], tone });
    } else {
      // compas : deux bras écartés
      const spread = hung ? 0.07 : 0.055;
      for (const s of [-1, 1]) {
        if (hung) brass.push(withTone(beam([x, y - 0.05, -D / 2 + 0.05], [x + s * spread, y - 0.32, -D / 2 + 0.05], 0.008, 0.008), tone));
        else quads.push({ position: [x, y - 0.18, -D / 2 + 0.003], size: [Math.abs(spread) * 1.6, PX * 0.7], normal: [0, 0, 1], tone });
      }
    }
    if (quads.length) brass.push(buildQuads(quads));
  }

  // --- Étaglière d'appoint : une traverse en bas où se posent deux ou trois boîtes plates.
  if (rng.chance(0.8)) {
    wood.push(withTone(buildBlock([W - 0.1, 0.035, D + 0.28], [0, 0.35, 0.06]), woodTone - 0.05));
    for (const s of [-1, 1]) wood.push(withTone(buildBlock([0.035, 0.32, 0.02], [s * (W / 2 - 0.08), 0.19, -D / 2]), woodTone - 0.02));
    const boxes = rng.int(1, 3);
    for (let i = 0; i < boxes; i++) {
      const bx = rng.range(-W * 0.36, W * 0.36), bw = rng.range(0.16, 0.3), bh = rng.range(0.05, 0.09);
      brass.push(withTone(buildBlock([bw, bh, 0.24], [bx, 0.367 + bh / 2, 0.06]), 0.15));
    }
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const woodMesh = new THREE.Mesh(
    mergeToned(wood),
    createToonMaterial({ ramp: WOODS.blackenedOak.ramp, ink: WOODS.blackenedOak.ink, steps: [0.26, 0.48, 0.72], tone: true, crease: true, pattern: "speckle", patternParams: [14, 0.04, 0.1, 1], seed: p.seed % 97, id: 20 })
  );
  woodMesh.name = "wood";
  const brassMesh = new THREE.Mesh(
    mergeToned(brass),
    metalMaterial(METALS.blackenedBrass, { id: 30, tone: true, steps: [0.24, 0.42, 0.62, 0.86] })
  );
  brassMesh.name = "brass";
  for (const mesh of [woodMesh, brassMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  group.userData.hooks = hooks.map((h) => ({ x: h.x, y: h.y, tool: h.tool }));
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
