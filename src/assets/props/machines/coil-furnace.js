// Four à bobines de l'Atelier du Complexe (fiche ATE-03, docs/complexe/PIECES.md) : 1,4 × 1,4 × 1,8 m.
// Cuve de brique réfractaire (rangs de briques en tons alternés, décalés d'un demi-bloc, quelques briques écornées),
// bouche orange devant ; au-dessus, la chambre de chauffe ceinte d'une bobine de cuivre de Ø 0,8 m (12 spires = 12
// anneaux d'un pixel), qui laisse voir entre ses spires la chambre portée au rouge ; hotte noircie de suie sur quatre
// montants ; cadran de 2 px dont l'aiguille suit la chaleur ; creuset et pince posés au pied, lingots selon la graine.
// États : éteint, en veille (braises sourdes), à plein feu (la bouche palpite par paliers, la chambre luit).
// Option halo : la bouche éclaire le décor en orange dans le noir (la lumière de halo réservée au four).
// `group.userData.furnace.setHeat("off" | "standby" | "full")`.
//
// 3 draw calls : brique, métal (cuivre de la bobine, hotte et fers en tons sombres), lueur du feu.

import * as THREE from "three";
import { createGlowLight, createToonMaterial, rgb, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe, buildPrism, buildQuads } from "../../kit/geometry.js";
import { FORGE_GLOW, METALS } from "../../kit/palettes.js";
import {
  PX, beam, createRigidParts, dial, glowMixMaterial, mergeParts, metalMaterial, plain, ring, withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const STATES = { full: "À plein feu", standby: "En veille (braises)", off: "Éteint" };
const HALOS = { off: "Sans halo", on: "Éclaire le décor (dans le noir)" };
// Brique réfractaire : chamois chaud, ombre brun-violet.
const FIREBRICK = { ramp: ["#3a2524", "#6e4734", "#a07250", "#cfa474"], ink: "#21141a" };
const FIXED = 255;
const NEEDLE = 0;
const HEAT = { off: 0, standby: 1, full: 2 };

const params = {
  seed: seedParam("Change les tons et les écornures des briques, la suie, le côté de la pince et du creuset, les lingots au pied."),
  state: choiceParam("État", STATES, "À plein feu (bouche qui palpite, chambre portée au rouge), en veille (braises sourdes), ou éteint."),
  halo: choiceParam("Halo", HALOS, "La bouche éclaire le décor en orange dans le noir (une des 12 lumières de halo de la scène)."),
};

export const meta = {
  id: "props/machines/coil-furnace",
  name: "Four à bobines",
  nameEn: "Coil furnace",
  category: "props",
  subcategory: "machines",
  description:
    "Four de l'Atelier du Complexe : cuve de brique réfractaire à bouche orange, chambre de chauffe ceinte d'une " +
    "bobine de cuivre à 12 spires qui laisse voir le rouge entre elles, hotte noircie de suie, cadran à aiguille, " +
    "creuset et pince au pied. À plein feu la bouche palpite ; en veille, des braises ; éteint, froid. Fiche ATE-03.",
  tags: [
    "four", "four à bobines", "forge", "fonderie", "brique réfractaire", "bobine", "spires", "cuivre", "bouche",
    "feu", "braises", "hotte", "suie", "creuset", "pince", "lingots", "cadran", "atelier", "le complexe", "complexe",
    "ancien-tech", "machine", "lumière", "animé", "pilotable", "intérieur",
    "furnace", "coil furnace", "smithy", "foundry", "firebrick", "coil", "windings", "copper", "fire mouth", "fire",
    "embers", "hood", "soot", "crucible", "tongs", "ingots", "gauge", "workshop", "ancient complex", "ancient-tech",
    "heating", "light", "animated", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre de la cuve ; la bouche regarde +z",
  footprint: { radius: 1.1, height: 1.8 },
  animated: ["fire"],
  params,
  variants: [
    { id: "full", name: "À plein feu", params: {} },
    { id: "standby", name: "En veille", params: { state: "standby" } },
    { id: "off", name: "Éteint", params: { state: "off" } },
  ],
};

/**
 * Crée le four.
 * @param {{seed?: number, state?: string, halo?: string}} [given]
 * @returns {THREE.Group} `group.userData.furnace` : { heat, setHeat(état), mouth: Vector3 } ;
 *   `group.userData.lightPoint` : le centre de la bouche (repère de l'asset)
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 977);
  const brick = [], metal = [], fire = [];
  const S = 1.4, baseH = 0.8; // cuve carrée de 1,4 m, haute de 0,9 m
  const half = S / 2;

  // --- Cuve : un cœur sombre en retrait (il fait les joints), et devant, une façade par brique (2 triangles), un ton
  // par brique ; un rang sur deux décalé d'un demi-bloc. Bouche de 0,44 × 0,32 m au milieu de la face avant.
  const mouth = { w: 0.44, y0: 0.22, y1: 0.52, depth: 0.22 };
  const rowH = 0.1, brickL = 0.25;
  // Cœur : plein derrière la bouche, et devant elle quatre blocs qui laissent son creux ouvert.
  const inner = half - 0.015, back = half - mouth.depth;
  brick.push([withTone(buildBlock([2 * inner, baseH, back + inner], [0, baseH / 2, (back - inner) / 2]), -0.75), FIXED]);
  const frontD = inner - back, frontZ = (inner + back) / 2;
  const sideW = inner - mouth.w / 2 - 0.03;
  for (const s of [-1, 1]) brick.push([withTone(buildBlock([sideW, baseH, frontD], [s * (inner - sideW / 2), baseH / 2, frontZ]), -0.75), FIXED]);
  brick.push([withTone(buildBlock([mouth.w + 0.06, mouth.y0, frontD], [0, mouth.y0 / 2, frontZ]), -0.75), FIXED]);
  brick.push([withTone(buildBlock([mouth.w + 0.06, baseH - mouth.y1 - 0.03, frontD], [0, (baseH + mouth.y1 + 0.03) / 2, frontZ]), -0.75), FIXED]);
  const faces = [];
  const sootFrom = 0.45;
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2; // 0 : face +z, puis +x, −z, −x
    const n = [Math.sin(a), 0, Math.cos(a)];
    const t = [Math.cos(a), 0, -Math.sin(a)]; // le long de la face
    for (let r = 0; r * rowH < baseH - 0.001; r++) {
      const y = r * rowH + rowH / 2;
      const shift = r % 2 ? brickL / 2 : 0;
      for (let u = -half - shift; u < half; u += brickL) {
        const u0 = Math.max(-half, u), u1 = Math.min(half, u + brickL);
        if (u1 - u0 < 0.04) continue;
        const c = (u0 + u1) / 2;
        // La bouche : pas de brique devant elle.
        if (side === 0 && y > mouth.y0 && y < mouth.y1 && Math.abs(c) < mouth.w / 2 + brickL * 0.3) {
          if (u1 > -mouth.w / 2 && u0 < mouth.w / 2) {
            // Morceaux de brique de part et d'autre de la bouche.
            for (const [b0, b1] of [[u0, -mouth.w / 2], [mouth.w / 2, u1]]) {
              if (b1 - b0 < 0.03) continue;
              const cc = (b0 + b1) / 2;
              faces.push({ position: [t[0] * cc + n[0] * half, y, t[2] * cc + n[2] * half], size: [b1 - b0 - PX * 0.5, rowH - PX * 0.5], normal: n, tone: rng.range(-0.1, 0.1) });
            }
            continue;
          }
        }
        let tone = rng.range(-0.12, 0.12) + (r % 2 ? 0.04 : -0.04);
        if (y > sootFrom) tone -= 0.4 * Math.min(1, (y - sootFrom) / (baseH - sootFrom)) * (side === 0 && Math.abs(c) < 0.35 ? 1.3 : 0.6);
        if (rng.chance(0.06)) tone -= 0.35; // brique écornée, plus sombre
        faces.push({ position: [t[0] * c + n[0] * half, y, t[2] * c + n[2] * half], size: [u1 - u0 - PX * 0.5, rowH - PX * 0.5], normal: n, tone });
      }
    }
  }
  brick.push([buildQuads(faces), FIXED]);
  // Dessus de la cuve : une dalle de briques posées à plat, un rebord ; le linteau de la bouche en saillie.
  brick.push([withTone(buildBlock([S + 0.04, 0.06, S + 0.04], [0, baseH + 0.03, 0]), (x, y, z, nx, ny) => (ny > 0.5 ? -0.25 : -0.1)), FIXED]);
  brick.push([withTone(buildBlock([mouth.w + 0.24, 0.1, 0.08], [0, mouth.y1 + 0.05, half + 0.03]), (x, y, z, nx, ny) => (ny > 0.5 ? -0.3 : 0.12)), FIXED]);
  brick.push([withTone(buildBlock([mouth.w + 0.24, 0.06, 0.12], [0, mouth.y0 - 0.03, half + 0.05]), (x, y, z, nx, ny) => (ny > 0.5 ? -0.2 : 0.05)), FIXED]); // seuil
  // Le creux de la bouche : parois sombres, et au fond le feu.
  for (const s of [-1, 1]) brick.push([withTone(buildBlock([0.03, mouth.y1 - mouth.y0, mouth.depth], [s * (mouth.w / 2 + 0.015), (mouth.y0 + mouth.y1) / 2, half - mouth.depth / 2]), -0.55), FIXED]);
  brick.push([withTone(buildBlock([mouth.w, 0.03, mouth.depth], [0, mouth.y1 + 0.015, half - mouth.depth / 2]), -0.8), FIXED]);
  const mouthCenter = new THREE.Vector3(0, (mouth.y0 + mouth.y1) / 2, half - mouth.depth + 0.02);
  fire.push([withShade(buildQuads([{ position: [0, mouthCenter.y, half - mouth.depth + 0.006], size: [mouth.w, mouth.y1 - mouth.y0], normal: [0, 0, 1] }]), 0, 2), 0]);
  // Lit de braises : un plan au bas de la bouche, plus clair au fond.
  fire.push([withShade(buildQuads([{ position: [0, mouth.y0 + 0.01, half - mouth.depth / 2], size: [mouth.w, mouth.depth], normal: [0, 1, 0] }]), 0, 2), 1]);

  // --- Chambre de chauffe et bobine : un cylindre de lueur (Ø 0,62 m) vu entre 12 spires de cuivre (Ø 0,8 m).
  const coilY0 = baseH + 0.1, coilY1 = baseH + 0.6, coilR = 0.4;
  fire.push([withShade(plain(new THREE.CylinderGeometry(0.31, 0.31, coilY1 - coilY0 + 0.04, 12, 1, true)).translate(0, (coilY0 + coilY1) / 2, 0), 0, 2), 2]);
  brick.push([withTone(buildLathe([[0.33, coilY0 - 0.12], [0.46, coilY0 - 0.12], [0.46, coilY0 - 0.06], [0.33, coilY0 - 0.06]], { segments: 12, facets: true }), (x, y, z, nx, ny) => (ny > 0.5 ? -0.05 : 0.08)), FIXED]); // assise de la bobine
  for (let k = 0; k < 12; k++) {
    const y = coilY0 + (k / 11) * (coilY1 - coilY0);
    metal.push([withTone(ring({ radius: coilR - 0.025, height: 0.028, y: y - 0.014, thickness: 0.035, segments: 16 }), (x, yy, z, nx, ny) => (ny > 0.5 ? 0.25 : ny < -0.5 ? -0.5 : (k % 2 ? 0.08 : -0.06))), FIXED]);
  }
  // Couvercle de la chambre, au-dessus : une couronne de brique et un tampon de fonte (dessus sombre).
  brick.push([withTone(buildLathe([[0.0, coilY1 + 0.02], [0.44, coilY1 + 0.02], [0.44, coilY1 + 0.09], [0.0, coilY1 + 0.09]], { segments: 12, facets: true }), (x, y, z, nx, ny) => (ny > 0.5 ? -0.5 : -0.15)), FIXED]);
  // Les deux bornes de la bobine, qui descendent vers deux isolateurs sur le dessus de la cuve (côté +x).
  for (const s of [-1, 1]) {
    const z = s * 0.08;
    metal.push([withTone(beam([coilR + 0.01, s > 0 ? coilY1 : coilY0, z], [0.58, baseH + 0.22, z], PX * 0.6, PX * 0.6), 0.2), FIXED]);
    metal.push([withTone(plain(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 6)).translate(0.58, baseH + 0.14, z), -0.65), FIXED]); // isolateur sombre
  }

  // --- Hotte sur quatre montants : pyramide tronquée en tôle, plus noire en haut, et l'amorce du conduit.
  const hoodY0 = coilY1 + 0.14, hoodY1 = 1.74;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) metal.push([withTone(beam([sx * 0.56, baseH + 0.06, sz * 0.56], [sx * 0.5, hoodY0 + 0.02, sz * 0.5], 0.04, 0.04), (x, y) => -0.45 - 0.25 * THREE.MathUtils.smoothstep(y, 1.2, 1.5)), FIXED]);
  metal.push([withTone(buildPrism([[-0.58, -0.58], [0.58, -0.58], [0.58, 0.58], [-0.58, 0.58]], hoodY0, () => hoodY0 + 0.05), (x, y, z, nx, ny) => (ny < -0.5 ? -0.9 : -0.35)), FIXED]); // bord de la hotte
  const hood = buildLathe([[0.82, hoodY0 + 0.05], [0.25, hoodY1 - 0.08], [0.15, hoodY1 - 0.08], [0.15, hoodY0 + 0.02]], { segments: 4, facets: true, start: Math.PI / 4 });
  metal.push([withTone(hood, (x, y) => -0.35 - 0.45 * THREE.MathUtils.smoothstep(y, hoodY0, hoodY1)), FIXED]);
  metal.push([withTone(buildLathe([[0.16, hoodY1 - 0.1], [0.19, hoodY1 - 0.1], [0.19, 1.8], [0.16, 1.8]], { segments: 8, facets: true }), -0.85), FIXED]); // conduit

  // --- Cadran de 2 px sur la face avant, à droite de la bouche ; aiguille (pièce NEEDLE) en dernier.
  const dialAt = [0.42, 0.64, half + 0.012];
  const gauge = dial({ radius: 0.07, position: dialAt, normal: [0, 0, 1], ticks: 8, needle: null, depth: 0.02 });
  metal.push([withTone(gauge.face, (x, y, z, nx, ny, nz) => (nz > 0.5 ? 0.55 : 0.1)), FIXED]);
  metal.push([withTone(gauge.marks, -0.8), FIXED]);
  metal.push([withTone(buildBlock([0.11, 0.16, 0.012], [dialAt[0], dialAt[1] - 0.03, half + 0.006]), -0.3), FIXED]); // platine
  const needleAt = new THREE.Vector3(dialAt[0], dialAt[1], half + 0.036);
  metal.push([withTone(buildBlock([PX * 0.45, 0.055, 0.006], [needleAt.x, needleAt.y + 0.0275, needleAt.z]), -0.95), NEEDLE]);

  // --- Au pied : un creuset (pot de terre cuite cerclé) et une pince à long bec, d'un côté ; des lingots de l'autre.
  const side = rng.chance(0.5) ? 1 : -1;
  const cx = side * 0.95, cz = rng.range(0.1, 0.45);
  brick.push([withTone(buildLathe([[0, 0], [0.09, 0], [0.12, 0.2], [0.105, 0.2], [0.08, 0.04], [0, 0.04]], { segments: 8, facets: true }).translate(cx, 0, cz), (x, y, z, nx, ny) => (ny > 0.5 ? -0.6 : 0.05 - 0.4 * (y / 0.2))), FIXED]);
  metal.push([withTone(ring({ radius: 0.11, height: 0.025, y: 0.14, thickness: 0.018, segments: 8 }).translate(cx, 0, cz), -0.5), FIXED]);
  // Pince appuyée contre la cuve : deux longues branches en V qui se croisent près du bec.
  const tz = rng.range(-0.4, -0.05);
  for (const s of [-1, 1]) metal.push([withTone(beam([side * (half + 0.18), 0.02, tz + s * 0.07], [side * (half + 0.03), 0.95, tz - s * 0.015], PX * 0.5, PX * 0.5), -0.55), FIXED]);
  const ingots = rng.int(0, 3);
  for (let i = 0; i < ingots; i++) {
    metal.push([withTone(buildBlock([0.2, 0.05, 0.08], [-side * 0.92 + rng.range(-0.04, 0.04), 0.025 + (i > 1 ? 0.05 : 0), 0.3 + (i % 2) * 0.1 - (i > 1 ? 0.05 : 0)], [0, rng.range(-0.3, 0.3) + (i > 1 ? Math.PI / 2 : 0), 0], { taper: 0.15 }), (x, y, z, nx, ny) => (ny > 0.5 ? 0.35 : 0.1)), FIXED]);
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const brickMesh = new THREE.Mesh(mergeParts(brick).geometry, createToonMaterial({
    ramp: FIREBRICK.ramp, ink: FIREBRICK.ink, steps: [0.28, 0.5, 0.76], tone: true, crease: true,
    pattern: "speckle", patternParams: [16, 0.06, 0.18, 1], seed: p.seed % 97, id: 20,
  }));
  brickMesh.name = "brick";
  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE.Mesh(metalMerged.geometry, metalMaterial(METALS.copper, { id: 30, tone: true, steps: [0.28, 0.46, 0.68, 0.95] }));
  metalMesh.name = "metal";
  for (const mesh of [brickMesh, metalMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const fireMerged = mergeParts(fire.map(([g]) => [g, FIXED]));
  const fireGeometry = fireMerged.geometry;
  const fireMaterial = glowMixMaterial([0, 1, 2, 3].map((level) => [FORGE_GLOW, level]), { id: 40 });
  const fireMesh = new THREE.Mesh(fireGeometry, fireMaterial);
  fireMesh.name = "fire";
  group.add(fireMesh);
  // Plages de sommets du feu : bouche, braises, chambre.
  const ranges = [];
  {
    let o = 0;
    for (const [g] of fire) {
      ranges.push([o, g.attributes.position.count]);
      o += g.attributes.position.count;
    }
  }
  const rig = createRigidParts(metalMerged.geometry, metalMerged.partOf, 1);

  // --- Chaleur : niveaux de la bouche, des braises et de la chambre ; l'aiguille suit ; le halo palpite.
  const halo = p.halo === "on" ? createGlowLight() : null;
  if (halo) fireMaterial.addEventListener("dispose", () => halo.release());
  const haloColor = rgb(FORGE_GLOW.light);
  const haloAt = new THREE.Vector3(0, mouthCenter.y, half + 0.25);
  const shade = fireGeometry.attributes.aShade;
  const tmp = new THREE.Matrix4();
  const furnace = {
    heat: p.state,
    mouth: haloAt.clone(),
    setHeat(state) {
      furnace.heat = HEAT[state] === undefined ? "full" : state;
      const h = HEAT[furnace.heat];
      // Aiguille : de −110° (froid) à +60° (plein feu), autour de son axe.
      const a = [-1.9, -0.6, 1.05][h];
      rig.matrices[NEEDLE].makeTranslation(needleAt.x, needleAt.y, needleAt.z).multiply(tmp.makeRotationZ(-a)).multiply(tmp.makeTranslation(-needleAt.x, -needleAt.y, -needleAt.z));
      rig.apply();
      shown = -1;
      update(sharedUniforms.uTime.value);
    },
  };
  const hash = (a, b) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  let shown = -1;
  let pulse = 0;
  const levels = [0, 0, 0];
  function update(time) {
    const h = HEAT[furnace.heat];
    // Palpitation : un palier toutes les 1/6 s ; à plein feu la bouche passe de 2 à 3, en veille les braises de 0 à 1.
    const step = Math.floor(time * 6);
    const r = hash(step, p.seed);
    pulse = r;
    if (h === 2) {
      levels[0] = r > 0.55 ? 3 : 2;
      levels[1] = r > 0.3 ? 3 : 2;
      levels[2] = r > 0.8 ? 2 : 1;
    } else if (h === 1) {
      levels[0] = r > 0.7 ? 1 : 0;
      levels[1] = r > 0.4 ? 2 : 1;
      levels[2] = 0;
    } else {
      levels[0] = levels[1] = levels[2] = 0;
    }
    const key = levels[0] * 16 + levels[1] * 4 + levels[2];
    if (key === shown) return;
    shown = key;
    ranges.forEach(([start, count], i) => shade.array.fill((levels[i] + 0.5) / 4, start, start + count));
    shade.needsUpdate = true;
  }
  furnace.setHeat(p.state);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let last = -1;
  const haloWorld = new THREE.Vector3();
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== last) {
      last = time;
      update(time);
    }
    baseUpdate(force);
    if (halo) {
      const h = HEAT[furnace.heat];
      if (h === 0) halo.set(haloWorld.set(0, -100, 0), haloColor, 0, 0);
      else halo.set(group.localToWorld(haloWorld.copy(haloAt)), haloColor, h === 2 ? 3.6 + pulse * 0.5 : 1.6, h === 2 ? 1.3 + pulse * 0.25 : 0.8);
    }
  };

  group.userData.furnace = furnace;
  group.userData.lightPoint = haloAt.clone();
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
