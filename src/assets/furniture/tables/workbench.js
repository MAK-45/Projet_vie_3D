// Établis de l'Atelier du Complexe (fiches ATE-01 et ATE-14, docs/complexe/) : le meuble où l'on fabrique.
// - Établi central (ATE-01) : 2,6 × 0,9 × 0,92 m ; plateau de chêne noirci de 0,08 m, plaque de bronze encastrée
//   (1,0 × 0,6 m) avec ses rivets, étau de laiton bien visible (mâchoires de 2 px) sur le bord avant, 2 tiroirs à
//   poignée d'un pixel, quatre pieds avec traverse basse. La graine ajoute ce qui traîne : ébauches de bronze,
//   morceaux de cuivre, outils couchés (lot 10 pour les vrais outils).
// - Établi d'horloger (ATE-14) : 1,2 × 0,7 × 0,95 m ; plateau en U échancré, deux rangées de 12 mini-tiroirs
//   (façades de 1 × 2 px, quelques-unes ouvertes), place nette pour la loupe binoculaire (l'asset du lot 7 que le
//   monde pose dessus). La graine change l'angle de l'échancrure, les tiroirs ouverts, les tons du bois.
// `group.userData.surface` : hauteur et taille du plateau, pour y poser des objets (loupe, lampe...).
//
// 3 draw calls : bois noirci, laiton, petits objets du plateau (ébauches de cuivre vif).

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
  central: "Établi central",
  clockmaker: "Établi d'horloger",
};
// largeur, profondeur, hauteur du dessus
const SIZES = {
  central: [2.6, 0.9, 0.92],
  clockmaker: [1.2, 0.7, 0.95],
};
const TOP = 0.08;

const params = {
  seed: seedParam("Change les outils couchés et les ébauches du plateau, l'étau, les tiroirs sortis, les tons du bois, l'angle de l'échancrure."),
  kind: choiceParam("Modèle", KINDS, "Établi central de l'Atelier (plaque de bronze, étau, tiroirs) ou établi d'horloger (plateau en U, mini-tiroirs, place pour la loupe)."),
  vintage: choiceParam("L'étau", { mounted: "Monté", packed: "Rangé" }, "L'étau est monté sur le bord de l'établi central, ou rangé (l'emplacement reste nu)."),
};

export const meta = {
  id: "furniture/tables/workbench",
  name: "Établi",
  nameEn: "Workbench",
  category: "furniture",
  subcategory: "tables",
  description:
    "Établi de l'Atelier du Complexe : le grand établi central au plateau de chêne noirci, plaque de bronze " +
    "encastrée et étau de laiton, deux tiroirs, pieds à traverse basse ; et l'établi d'horloger au plateau en U " +
    "échancré, avec ses rangées de mini-tiroirs et sa place pour la loupe binoculaire. Fiches ATE-01, ATE-14.",
  tags: [
    "établi", "table de travail", "atelier", "forge", "étau", "plaque de bronze", "tiroirs", "horloger",
    "chêne noirci", "laiton", "cuivre", "le complexe", "complexe", "ancien-tech", "mobilier", "intérieur",
    "workbench", "bench", "workshop", "vise", "brass plate", "drawers", "watchmaker", "blackened oak",
    "copper", "ancient complex", "ancient-tech", "furniture", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre de l'établi (les tiroirs regardent +z)",
  footprint: { radius: 1.45, height: 1.0 },
  animated: [],
  params,
  variants: variantsOf("kind", params.kind),
};

/**
 * Crée l'établi.
 * @param {{seed?: number, kind?: string, vintage?: string}} [given]
 * @returns {THREE.Group} `group.userData.surface` : { y, size: [largeur, profondeur] } (dessus du plateau)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 601);
  const [W, D, H] = SIZES[p.kind];
  const wood = [], brass = [], copper = [];
  const y0 = H - TOP;
  const woodTone = rng.range(-0.06, 0.08);

  // --- Plateau : planches jointives de chêne noirci, liseré de laiton sur le tour, usure au centre.
  const topGeo = plain(new THREE.BoxGeometry(W, TOP, D, Math.max(2, Math.round(W / 0.4)), 1, 1));
  withTone(topGeo, (x, y, z, nx, ny) => {
    let t = woodTone + (ny > 0.5 ? 0.08 : 0);
    if (ny > 0.5) {
      const seg = Math.floor(((x + W / 2) / W) * Math.max(2, Math.round(W / 0.4)));
      t += (seg % 2 ? -0.06 : 0.02); // planches alternées
      const d = Math.abs(x) / (W * 0.4) + Math.abs(z) / (D * 0.9);
      if (d < 0.9) t -= 0.08; // usure du centre
    }
    return t;
  });
  topGeo.translate(0, y0 + TOP / 2, 0);
  wood.push(topGeo);
  for (const s of [-1, 1]) {
    brass.push(withTone(buildBlock([PX * 0.7, 0.045, D + 0.012], [s * (W / 2 + PX * 0.35), H - TOP / 2, 0]), 0.1));
    brass.push(withTone(buildBlock([W + 0.012, 0.045, PX * 0.7], [0, H - TOP / 2, s * (D / 2 + PX * 0.35)]), 0.05));
  }

  // --- Pieds : quatre montants sectionnés, traverse basse, raidisseur sous le plateau.
  const legX = W / 2 - 0.09, legZ = D / 2 - 0.09;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    wood.push(withTone(buildBlock([0.09, y0, 0.09], [sx * legX, y0 / 2, sz * legZ]), woodTone + 0.02));
    brass.push(withTone(buildBlock([0.11, 0.03, 0.11], [sx * legX, 0.015, sz * legZ]), -0.1));
  }
  wood.push(withTone(beam([-legX + 0.08, 0.16, legZ], [legX - 0.08, 0.16, legZ], 0.07, 0.06), woodTone - 0.05));
  wood.push(withTone(beam([-legX + 0.08, 0.16, -legZ], [legX - 0.08, 0.16, -legZ], 0.07, 0.06), woodTone - 0.05));
  wood.push(withTone(buildBlock([W - 0.3, 0.06, 0.08], [0, y0 - 0.06, 0]), woodTone - 0.08));

  if (p.kind === "central") {
    // --- Plaque de bronze encastrée (1,0 × 0,6 m), rivets en coin, un coup d'ébauchoir gravé dessus.
    const pw = 1.0, pd = 0.6;
    brass.push(withTone(buildBlock([pw, 0.016, pd], [rng.range(-0.15, 0.15), H + 0.004, -0.04]), (x, y, z, nx, ny) => (ny > 0.5 ? 0.18 : 0.05)));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      brass.push(withTone(plain(new THREE.CylinderGeometry(PX * 0.5, PX * 0.5, 0.006, 6)).translate(sx * (pw / 2 - 0.05), H + 0.013, -0.04 + sz * (pd / 2 - 0.05)), 0.5));
    }
    const marks = [];
    for (let i = 0; i < 3; i++) marks.push({ position: [-0.2 + i * 0.06, H + 0.0125, -0.04 + rng.range(-0.18, 0.18)], size: [PX * 0.6, PX * 0.4], normal: [0, 1, 0], tone: 0.45 });
    brass.push(buildQuads(marks));

    // --- Étau de laiton sur le bord avant : semelle, deux mâchoires de 2 px, vis et son volant.
    if (p.vintage === "mounted") {
      const ex = W / 2 - 0.32;
      brass.push(withTone(buildBlock([0.16, 0.025, 0.2], [ex, H + 0.012, D / 2 - 0.1]), -0.05));
      const gap = PX;
      for (const s of [-1, 1]) {
        brass.push(withTone(buildBlock([0.05, 0.1, 0.06 + s * 0.01], [ex + s * (0.036 + gap / 2), H + 0.075, D / 2 - 0.1]), s > 0 ? 0.28 : 0.18));
      }
      brass.push(withTone(beam([ex - 0.05, 0, D / 2 - 0.1], [ex + 0.09, 0, D / 2 - 0.1], 0.012, 0.012), 0.3));
      const screwEnd = new THREE.Vector3(ex + 0.1, H + 0.075, D / 2 - 0.1);
      brass.push(withTone(plain(new THREE.TorusGeometry(0.05, 0.012, 5, 10)).rotateY(Math.PI / 2).translate(screwEnd.x + 0.02, screwEnd.y, screwEnd.z), 0.15));
      brass.push(withTone(beam([ex, 0, D / 2 - 0.28], [ex, 0, D / 2 - 0.02], 0.022, 0.016, 0, new THREE.Vector3(1, 0, 0)), -0.2)); // manivelle
    }

    // --- Deux tiroirs sous le plateau, l'un peut sortir d'un cran ; poignée claire d'un pixel.
    for (const s of [-1, 1]) {
      const dw = W * 0.22, dy = y0 - 0.075, dx = s * (W * 0.2), out = rng.chance(0.35) ? 0.045 : 0;
      wood.push(withTone(buildBlock([dw, 0.1, D * 0.72], [dx, dy, out]), woodTone - 0.1));
      brass.push(withTone(buildBlock([dw - 0.025, 0.075, 0.012], [dx, dy, out + D * 0.36 + 0.006]), 0.12));
      brass.push(buildQuads([{ position: [dx, dy, out + D * 0.36 + 0.015], size: [PX * 1.6, PX * 0.5], normal: [0, 0, 1], tone: 0.5 }]));
    }

    // --- Ce qui traîne (la graine) : ébauches de bronze, bouts de cuivre vif, outil couché.
    const items = rng.int(2, 5);
    for (let i = 0; i < items; i++) {
      const x = rng.range(-W * 0.42, W * 0.42), z = rng.range(-D * 0.3, D * 0.28);
      if (Math.abs(x - (W / 2 - 0.32)) < 0.22 && z > D * 0.05) continue; // la place de l'étau
      const length = rng.range(0.08, 0.24), thin = rng.range(0.015, 0.03);
      const a = rng.range(0, Math.PI * 2);
      if (rng.chance(0.45)) {
        copper.push(withTone(beam([x, H + thin / 2, z], [x + Math.cos(a) * length, H + thin / 2, z + Math.sin(a) * length], thin, thin), 0.1));
      } else if (rng.chance(0.5)) {
        brass.push(withTone(buildBlock([length, 0.035, 0.05], [x, H + 0.02, z], [0, a, 0]), 0.05));
      } else {
        brass.push(withTone(plain(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 6)).rotateY(a).rotateZ(0.1).translate(x, H + 0.026, z), 0.25));
      }
    }
  } else {
    // --- Établi d'horloger : plateau en U échancré au fond ; le creux gagne le rangement dessous.
    const notch = rng.range(0.28, 0.44);
    wood.push(withTone(buildBlock([W, TOP, D], [0, y0 + TOP / 2, (D - notch) / 2 - 0.02]), woodTone + 0.02)); // avant
    wood.push(withTone(buildBlock([(W - notch) / 2, TOP, notch], [-((notch + (W - notch) / 2) / 2 - 0.02), y0 + TOP / 2, D - notch / 2 - 0.02]), woodTone));
    wood.push(withTone(buildBlock([(W - notch) / 2, TOP, notch], [((notch + (W - notch) / 2) / 2 + 0.02), y0 + TOP / 2, D - notch / 2 - 0.02]), woodTone));
    // La place de la loupe binoculaire : un feutrine sombre carré, côté gauche du plateau.
    brass.push(buildQuads([{ position: [-W * 0.25, H + 0.002, -0.02], size: [0.34, 0.26], normal: [0, 1, 0], tone: -0.7 }]));

    // --- Deux rangées de 12 mini-tiroirs, façades de 1 × 2 px, quelques poignées vides (ouverts).
    const bank = [W - 0.08, 0.34, D * 0.3];
    wood.push(withTone(buildBlock(bank, [0, y0 - 0.235, -D * 0.14]), woodTone - 0.06));
    const faces = [];
    for (let r = 0; r < 2; r++) for (let c = 0; c < 12; c++) {
      const x = -bank[0] / 2 + 0.045 + c * ((bank[0] - 0.09) / 11);
      const y = y0 - 0.29 + r * 0.14;
      faces.push({ position: [x, y, -D * 0.14 - bank[2] / 2 - 0.002], size: [PX * 0.9, PX * 1.8], normal: [0, 0, -1], tone: rng.chance(0.3) ? -0.35 : 0.12 });
    }
    brass.push(buildQuads(faces));

    // --- Discret au sol : deux petits tiroirs larges, utiles, fermés.
    for (const s of [-1, 1]) {
      const dw = W * 0.26, dy = 0.22;
      wood.push(withTone(buildBlock([dw, 0.11, D * 0.5], [s * W * 0.22, dy, -D * 0.08]), woodTone - 0.12));
      brass.push(buildQuads([{ position: [s * W * 0.22, dy, -D * 0.08 - D * 0.25 - 0.005], size: [PX * 1.4, PX * 0.4], normal: [0, 0, -1], tone: 0.5 }]));
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
  const brassMesh = new THREE.Mesh(mergeToned(brass), metalMaterial(METALS.blackenedBrass, { id: 30, tone: true }));
  brassMesh.name = "brass";
  for (const mesh of [woodMesh, brassMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  if (copper.length) {
    const copperMesh = new THREE.Mesh(mergeToned(copper), metalMaterial(METALS.copper, { id: 31, tone: true }));
    copperMesh.name = "copper";
    copperMesh.castShadow = true;
    copperMesh.receiveShadow = true;
    group.add(copperMesh);
  }

  group.userData.surface = { y: H, size: [W, D] };
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
