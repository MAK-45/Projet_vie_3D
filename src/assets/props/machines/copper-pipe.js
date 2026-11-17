// Tuyau de cuivre du Complexe (fiches SAS-09 et COE-07, docs/complexe/) : un tube de cuivre oxydé, vert d'oxyde
// avec des coulures plus sombres, frotté de rose là où la lumière le prend. Le tuyau mural (Ø 0,12 m) a des colliers
// de bronze tous les 0,5 m ; le tuyau géant de la salle du Cœur (Ø 0,8 m) a des brides de laiton boulonnées en
// pointillé. Quatre pièces qui s'assemblent sur la grille : droit de 2 m, coude à 90°, raccord en T, bout bouché.
// Posé contre un mur (pattes de fixation) ou sur des berceaux au sol.
//
// 2 draw calls : cuivre (tons par sommet : coulures), bronze (colliers, brides, pattes, berceaux).

import * as THREE from "three";
import { buildBlock, buildTube } from "../../kit/geometry.js";
import { METALS } from "../../kit/palettes.js";
import { PX, beam, mergeToned, metalMaterial, orient, plain, ring, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const PIECES = { straight: "Droit (2 m)", elbow: "Coude à 90°", tee: "Raccord en T", cap: "Bout bouché" };
const SIZES = { wall: "Tuyau mural (Ø 0,12 m)", giant: "Tuyau géant (Ø 0,8 m)" };
const MOUNTS = { wall: "Contre un mur", floor: "Sur des berceaux au sol" };
const SPEC = {
  wall: { r: 0.06, sides: 6, bend: 0.25, gap: 0.08 },
  giant: { r: 0.4, sides: 14, bend: 0.9, gap: 0.12 },
};

const params = {
  seed: seedParam("Change la place des coulures, un collier manquant, un manchon de réparation, les tons du cuivre."),
  piece: choiceParam("Pièce", PIECES, "Droit de 2 m, coude à 90° (qui monte), raccord en T (branche vers le haut) ou bout bouché."),
  size: choiceParam("Taille", SIZES, "Tuyau mural du Sas (colliers de bronze) ou tuyau géant de la salle du Cœur (brides de laiton boulonnées)."),
  mount: choiceParam("Pose", MOUNTS, "Contre un mur (pattes de fixation vers z = 0) ou sur des berceaux au sol."),
  height: numberParam("Hauteur", 1.8, 0.2, 6, "Hauteur de l'axe du tuyau.", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "props/machines/copper-pipe",
  name: "Tuyau de cuivre",
  nameEn: "Copper pipe",
  category: "props",
  subcategory: "machines",
  description:
    "Tuyau de cuivre oxydé du Complexe, vert d'oxyde avec des coulures, en pièces de 2 m qui s'assemblent : droit, " +
    "coude, raccord en T, bout bouché. Tuyau mural à colliers de bronze, ou tuyau géant à brides de laiton " +
    "boulonnées ; contre un mur ou sur des berceaux. Fiches SAS-09, COE-07.",
  tags: [
    "tuyau", "conduite", "canalisation", "cuivre", "oxyde", "coude", "raccord", "bride", "collier", "le complexe",
    "complexe", "ancien-tech", "réseau", "modulaire", "intérieur",
    "pipe", "pipeline", "copper", "verdigris", "elbow", "tee", "flange", "pipe clamp", "ancient complex", "ancient-tech",
    "network", "modular", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units:
    "1 unité = 1 mètre ; origine au sol (au pied du mur pour la pose murale : le mur est en z = 0) ; l'axe court " +
    "selon x de −1 à +1 à la hauteur `height` ; le coude et le T montent vers +y en x = 0",
  footprint: { radius: 1.4, height: 3.3 },
  animated: [],
  params,
  variants: variantsOf("piece", params.piece),
};

/**
 * Crée la pièce de tuyau.
 * @param {{seed?: number, piece?: string, size?: string, mount?: string, height?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const { r, sides, bend, gap } = SPEC[p.size];
  const giant = p.size === "giant";
  const wear = createRng(p.seed * 7919 + 17);
  const H = Math.max(p.height, r + 0.05);
  const zc = p.mount === "wall" ? r + gap : 0;
  const at = (x, y) => new THREE.Vector3(x, H + y, zc);

  // Trajets de l'axe (dans le plan x-y) : des polylignes, le coude décrit en arc.
  const runs = [];
  if (p.piece === "straight") runs.push([at(-1, 0), at(1, 0)]);
  else if (p.piece === "cap") runs.push([at(-1, 0), at(0.2, 0)]);
  else if (p.piece === "tee") runs.push([at(-1, 0), at(1, 0)], [at(0, 0), at(0, 1)]);
  else {
    const arc = [at(-1, 0)];
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * (Math.PI / 2);
      arc.push(at(-bend + Math.sin(a) * bend, bend - Math.cos(a) * bend));
    }
    arc.push(at(0, 1));
    runs.push(arc);
  }

  // --- Cuivre : un tube par trajet, coulures = bandes d'un pixel plus sombres sur le bas et les flancs.
  const copperParts = [];
  const streakSeed = wear.next() * 100;
  for (const points of runs) {
    // Points intermédiaires sur les lignes droites, pour que la spline reste droite.
    const dense = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const n = Math.max(1, Math.round(a.distanceTo(b) / 0.25));
      for (let k = 0; k < n; k++) dense.push(new THREE.Vector3().lerpVectors(a, b, k / n));
    }
    dense.push(points[points.length - 1]);
    let length = 0;
    for (let i = 1; i < dense.length; i++) length += dense[i].distanceTo(dense[i - 1]);
    const tube = buildTube(dense, () => r, { radialSegments: sides, lengthSegments: Math.ceil(length / (PX * 1.5)) });
    const uv = tube.attributes.uv;
    const normal = tube.attributes.normal;
    const tone = new Float32Array(uv.count);
    for (let i = 0; i < uv.count; i++) {
      const band = Math.floor(uv.getY(i) / (PX * 1.5)); // uv.y : distance parcourue (m)
      const s = Math.sin(band * 12.9898 + streakSeed) * 43758.5453;
      const streak = s - Math.floor(s) < 0.22 && normal.getY(i) < 0.35;
      tone[i] = streak ? -0.3 : 0;
    }
    plain(tube);
    tube.setAttribute("aTone", new THREE.BufferAttribute(tone, 1));
    copperParts.push(tube);
  }
  // Bouchon et fonds (bouts ouverts vus de près) : des disques un cran plus sombres.
  const disc = (center, dir, tone) => {
    const g = plain(new THREE.CylinderGeometry(r * 0.98, r * 0.98, PX * 0.4, sides));
    copperParts.push(withTone(orient(g, center, dir), tone));
  };
  if (p.piece === "cap") {
    const dome = plain(new THREE.SphereGeometry(r, sides, 4, 0, Math.PI * 2, 0, Math.PI / 2));
    copperParts.push(withTone(orient(dome, at(0.2, 0), [1, 0, 0]), 0.05));
  }
  disc(at(-1 + PX * 0.3, 0), [1, 0, 0], -0.5);
  if (p.piece === "straight" || p.piece === "tee") disc(at(1 - PX * 0.3, 0), [1, 0, 0], -0.5);
  if (p.piece === "elbow" || p.piece === "tee") disc(at(0, 1 - PX * 0.3), [0, 1, 0], -0.5);

  // --- Bronze : colliers ou brides, manchon de réparation, pattes ou berceaux.
  const bronzeParts = [];
  const ends = [[at(-1, 0), [1, 0, 0]]];
  if (p.piece === "straight" || p.piece === "tee") ends.push([at(1, 0), [1, 0, 0]]);
  if (p.piece === "elbow" || p.piece === "tee") ends.push([at(0, 1), [0, 1, 0]]);
  const collar = (center, dir, { width = PX * 2, thick = PX * 0.8, tone = 0 } = {}) => {
    const g = ring({ radius: r, height: width, y: -width / 2, thickness: thick, segments: sides });
    bronzeParts.push(withTone(orient(g, center, dir), tone));
  };
  // Positions le long des parties droites (pas dans l'arc du coude).
  const straightStations = [];
  const xs = p.piece === "elbow" ? [-0.75, -0.25 - bend * 0.2] : p.piece === "cap" ? [-0.75, -0.25] : [-0.75, -0.25, 0.25, 0.75];
  for (const x of xs) straightStations.push([at(x + wear.range(-0.08, 0.08), 0), [1, 0, 0]]); // colliers posés à la main
  if (p.piece === "elbow") straightStations.push([at(0, 0.75), [0, 1, 0]]);
  if (p.piece === "tee") straightStations.push([at(0, 0.6), [0, 1, 0]]);
  const missing = wear.chance(0.35) ? wear.int(0, straightStations.length - 1) : -1;

  if (giant) {
    // Brides boulonnées aux bouts (laiton : un cran plus clair) et une bride au départ de la branche du T.
    const flange = (center, dir) => {
      collar(center, dir, { width: 0.1, thick: 0.07, tone: 0.25 });
      const d = new THREE.Vector3(...dir);
      const u = new THREE.Vector3(0, 0, 1).cross(d).lengthSq() > 0.01 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const v = new THREE.Vector3().crossVectors(d, u);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const pos = center.clone().addScaledVector(u, Math.cos(a) * (r + 0.05)).addScaledVector(v, Math.sin(a) * (r + 0.05));
        bronzeParts.push(withTone(buildBlock([PX, PX, 0.14], [0, 0, 0]).applyMatrix4(new THREE.Matrix4().makeBasis(u, v, d).setPosition(pos)), 0.4));
      }
    };
    for (const [c, d] of ends) flange(c.clone().addScaledVector(new THREE.Vector3(...d), d[0] && c.x < 0 ? 0.05 : -0.05), d);
    if (p.piece === "tee") flange(at(0, r + 0.08), [0, 1, 0]);
  } else {
    straightStations.forEach(([c, d], i) => {
      if (i !== missing) collar(c, d);
    });
  }
  if (wear.chance(0.4)) {
    // Manchon de réparation : un cran plus clair, plus large.
    const [c, d] = straightStations[wear.int(0, straightStations.length - 1)];
    collar(c.clone().add(new THREE.Vector3(d[1] ? 0 : 0.12, d[1] ? 0.12 : 0, 0)), d, { width: giant ? 0.3 : 0.18, thick: giant ? 0.04 : PX * 0.6, tone: 0.35 });
  }

  // Fixations : pattes au mur, ou berceaux au sol, sous les parties horizontales.
  const supportXs = p.piece === "elbow" ? [-0.6] : p.piece === "cap" ? [-0.6] : [-0.6, 0.6];
  for (const x of supportXs) {
    if (p.mount === "wall") {
      bronzeParts.push(beam([x, H, 0], [x, H, zc], giant ? 0.12 : PX * 1.2, giant ? 0.16 : PX * 1.4));
      bronzeParts.push(withTone(buildBlock([giant ? 0.3 : 0.12, giant ? 0.4 : 0.16, PX], [x, H, PX / 2]), 0.1));
      if (giant) bronzeParts.push(beam([x, H - 0.5, 0], [x, H - r * 0.4, zc * 0.8], 0.08, 0.1));
    } else {
      const w = giant ? 0.22 : PX * 1.6;
      const top = H - r * 0.7;
      bronzeParts.push(withTone(buildBlock([w, top, giant ? r * 1.6 : r * 2.4], [x, top / 2, zc]), -0.15));
      bronzeParts.push(withTone(buildBlock([w + PX, PX, giant ? r * 1.9 : r * 2.8], [x, PX / 2, zc]), -0.25));
    }
  }

  const group = new THREE.Group();
  group.name = meta.name;
  // Le rose des frottements : seulement sur les reflets les plus vifs.
  const copper = new THREE.Mesh(mergeToned(copperParts), metalMaterial(METALS.oxidizedCopper, { id: 30, tone: true, steps: [0.28, 0.46, 0.68, 0.95] }));
  copper.name = "pipe";
  copper.castShadow = true;
  copper.receiveShadow = true;
  group.add(copper);
  const bronze = new THREE.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 31, tone: true }));
  bronze.name = "fittings";
  bronze.castShadow = true;
  group.add(bronze);

  group.userData.asset = { id: meta.id, params: p };
  return group;
}
