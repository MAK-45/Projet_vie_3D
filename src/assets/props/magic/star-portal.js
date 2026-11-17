// Porte des étoiles : un grand anneau de pierre debout, enfoncé d'un quart dans une plateforme, qui ouvre un passage
// vers un autre monde. On monte l'escalier (ou la rampe) et on traverse l'ouverture de plain-pied : la passerelle
// passe au ras du bas de l'ouverture.
//
// Mesures : 6,70 m de diamètre extérieur, 4,76 m d'ouverture. L'anneau extérieur fixe porte des verrous de cristal
// sur ses deux faces, tournés vers le centre, posés au-dessus de l'anneau intérieur gravé de symboles (inventés,
// tirés de la graine) qui tourne pour composer une adresse.
//
// Séquence (`state: "cycle"`, boucle d'environ 40 s, horloge partagée avec la console `star-portal-dial`) :
// l'anneau intérieur tourne, alterne de sens, s'arrête quand le symbole voulu est sous le verrou suivant ; le verrou
// glisse vers le centre, mord l'anneau et s'allume avec son symbole (et reste allumé) ; quand tout est verrouillé,
// le vortex jaillit vers l'avant, ondule comme une eau lumineuse, se referme ; tout s'éteint, l'anneau revient.
//
// Traversée : tout objet de la scène qui franchit la surface du vortex (ou une sonde de démonstration) y fait une
// onde : éclat au point de passage, cercles de lumière qui s'élargissent, surface qui se creuse dans le sens du
// passage. `group.userData.touch(x, y, sens)` déclenche la même onde à la demande (scénario).
//
// 3 draw calls : pierre (anneau, verrous, plateforme), anneau intérieur (tourne), énergie (vortex, cristaux,
// symboles, sonde). La nuit, le vortex et les cristaux allumés gardent leur éclat (`emissive`).

import * as THREE from "three";
import { createGlowLight, createToonMaterial, rgb, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildGem, buildLathe, mergeGeometries } from "../../kit/geometry.js";
import { MAGIC_PALETTES, STONES, fitRamp } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { glyphAngle, lockAngle, portalSequence, portalStateAt } from "../../kit/portal.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

/** Couleurs du vortex et des cristaux : les matières de lumière magique, de l'ombre au reflet (5 tons). */
export const PORTAL_ENERGIES = {
  ice: { label: "Azur", from: MAGIC_PALETTES.ice },
  lagoon: { label: "Lagon", from: MAGIC_PALETTES.lagoon },
  arcane: { label: "Arcane", from: MAGIC_PALETTES.arcane },
  sap: { label: "Sève", from: MAGIC_PALETTES.sap },
  ember: { label: "Braise", from: MAGIC_PALETTES.ember },
};
/** Rampe de 5 tons d'une énergie : du bleu nuit du vortex au blanc des reflets. */
export function energyRamp(key) {
  return fitRamp(PORTAL_ENERGIES[key].from.colors.slice(1, 8), 5);
}
/** Seuils de la rampe d'énergie, et seuil au-dessus duquel elle garde son éclat la nuit. */
export const ENERGY_STEPS = [0.22, 0.45, 0.66, 0.85];
export const ENERGY_EMISSIVE = 0.44;

const BASES = { stairs: "Escaliers", ramp: "Rampes", ruin: "Ruine" };
const STATES = { cycle: "Composition en boucle", dormant: "Endormie", open: "Ouverte" };

const params = {
  seed: seedParam(
    "Change l'adresse composée et le rythme de la séquence, le nombre de symboles (24 à 36) et leur dessin, la " +
      "forme des verrous, et la plateforme : hauteur, nombre de marches, dallage, bornes, pierres tombées.",
  ),
  base: choiceParam(
    "Plateforme",
    BASES,
    "Escaliers devant et derrière, longues rampes en pente douce, ou ruine (marches cassées, dalles disjointes, " +
      "pierres tombées). La passerelle passe toujours au ras du bas de l'ouverture.",
  ),
  state: choiceParam("État", STATES, "En boucle : l'anneau tourne, les verrous s'enclenchent, le vortex jaillit, ondule puis se referme. Endormie ou ouverte : figée."),
  probe: choiceParam("Sonde", { on: "Une sonde traverse", off: "Aucune" }, "Une petite sonde de cristal traverse le vortex ouvert, aller et retour, pour montrer l'onde de passage."),
  locks: { type: "int", default: 7, min: 5, max: 9, label: "Verrous", description: "Nombre de verrous de cristal, donc de symboles dans une adresse (la console doit avoir le même)." },
  energy: choiceParam("Énergie", PORTAL_ENERGIES, "Couleur du vortex, des cristaux et des symboles allumés."),
  stone: stoneParam("Pierre de l'anneau et de la plateforme.", { only: ["granite", "slate", "basalt", "sandstone"] }),
};

export const meta = {
  id: "props/magic/star-portal",
  name: "Porte des étoiles",
  nameEn: "Star portal",
  category: "props",
  subcategory: "magic",
  description:
    "Anneau de pierre de 6,70 m (ouverture de 4,76 m) enfoncé d'un quart dans une plateforme qu'on traverse de " +
    "plain-pied. Son anneau intérieur gravé de symboles tourne, ses verrous de cristal se referment un à un et " +
    "restent allumés, puis le vortex jaillit et ondule ; tout ce qui le traverse y fait une onde. Escaliers, rampes " +
    "ou ruine ; se commande avec la console (même graine, même nombre de verrous).",
  tags: [
    "porte des étoiles", "portail", "anneau", "porte", "vortex", "symboles", "glyphes", "verrous", "cristaux",
    "voyage", "passage entre les mondes", "escalier", "rampe", "magie", "science-fiction", "pierre", "animé",
    "extérieur",
    "star portal", "portal", "gate", "ring", "wormhole", "glyphs", "symbols", "locks", "crystals", "travel",
    "world gate", "stairs", "ramp", "magic", "sci-fi", "stone", "animated", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "desert", "snow", "mountain", "cave", "beach", "swamp"],
  version: 2,
  added: "2026-11-17",
  units:
    "1 unité = 1 mètre ; origine au sol au centre de la plateforme ; l'anneau fait face à +Z (le vortex jaillit " +
    "vers +Z) ; la passerelle (dessus de la plateforme) est à `group.userData.walkway` m",
  footprint: { radius: 6.9, height: 7.1 },
  animated: ["dial", "glow", "ripple"],
  params,
  variants: variantsOf("base", params.base),
};

const TAU = Math.PI * 2;

// Mesures de l'anneau (mètres).
const R_APERTURE = 2.38; // bord de l'ouverture : 4,76 m de diamètre
const LIP = [2.34, 2.5, 0.34]; // lèvre fixe : rayon intérieur, extérieur, demi-épaisseur (cache le bord du vortex)
const INNER = [2.5, 2.93, 0.25]; // anneau intérieur qui tourne
const OUTER = [2.93, 3.35, 0.4]; // anneau extérieur : 6,70 m de diamètre
const GLYPH_DEPTH = INNER[2] + 0.02; // les symboles affleurent des deux faces

/**
 * Crée la porte.
 * @param {{seed?: number, base?: string, state?: string, probe?: string, locks?: number, energy?: string, stone?: string}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; il s'anime avec `tick(secondes)`
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const ramp = energyRamp(p.energy);
  const baseRng = createRng(p.seed * 7919 + 17);
  const glyphRng = createRng(p.seed * 104729 + 71);
  const lockRng = createRng(p.seed * 15485863 + 5);
  const seq = portalSequence(p.seed, p.locks);
  const noise = createNoise3(p.seed * 31 + 7);

  const group = new THREE.Group();
  group.name = meta.name;

  // --- Plateforme : la passerelle (son dessus) est au ras du bas de l'ouverture ; le quart bas de l'anneau y est
  // enfoncé. Escaliers ou rampes devant (+Z) et derrière (−Z), pour la traverser.
  const stoneParts = [];
  const rise = baseRng.range(0.16, 0.19);
  const steps = p.base === "ramp" ? 0 : baseRng.int(5, 7);
  const walkway = p.base === "ramp" ? baseRng.range(0.9, 1.15) : steps * rise;
  const width = baseRng.range(7.6, 8.4);
  const depth = baseRng.range(2.8, 3.4);
  const ruin = p.base === "ruin";
  stoneParts.push(buildBlock([width, walkway - 0.08, depth], [0, (walkway - 0.08) / 2, 0]));
  // Dallage du dessus : dalles d'environ 1 m séparées d'un joint ; en ruine, certaines penchent ou manquent.
  const cols = Math.round(width / 1.05), rows = Math.max(2, Math.round(depth / 1.05));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const w = width / cols, d = depth / rows;
      const x = -width / 2 + (i + 0.5) * w, z = -depth / 2 + (j + 0.5) * d;
      if (ruin && Math.abs(x) > R_APERTURE && baseRng.chance(0.18)) continue;
      const tilt = ruin && Math.abs(x) > 1.2 ? [baseRng.range(-0.05, 0.05), 0, baseRng.range(-0.05, 0.05)] : [0, 0, 0];
      stoneParts.push(buildBlock([w - 0.06, 0.1, d - 0.06], [x, walkway - 0.05, z], tilt));
    }
  }
  const stairWidth = baseRng.range(3.6, 4.4);
  const tread = baseRng.range(0.36, 0.44);
  let reach = depth / 2;
  for (const side of [1, -1]) {
    if (p.base === "ramp") {
      // Rampe en pente douce avec ses deux bordures.
      const length = walkway / baseRng.range(0.22, 0.27);
      const slope = Math.atan2(walkway, length);
      const hyp = Math.hypot(length, walkway);
      const mid = side * (depth / 2 + length / 2);
      stoneParts.push(buildBlock([stairWidth, 0.24, hyp], [0, walkway / 2 - 0.1, mid], [side * slope, 0, 0]));
      for (const sx of [-1, 1]) stoneParts.push(buildBlock([0.28, 0.42, hyp], [sx * (stairWidth / 2 + 0.14), walkway / 2 + 0.05, mid], [side * slope, 0, 0]));
      reach = Math.max(reach, depth / 2 + length);
    } else {
      for (let s = 0; s < steps; s++) {
        const h = walkway - s * rise; // marche s, de haut en bas
        if (ruin && s > 0 && baseRng.chance(0.25)) continue; // marche emportée
        const z = side * (depth / 2 + tread * (s + 0.5));
        const tilt = ruin ? [baseRng.range(-0.04, 0.04), baseRng.range(-0.04, 0.04), baseRng.range(-0.04, 0.04)] : [0, 0, 0];
        stoneParts.push(buildBlock([stairWidth + s * 0.12, h, tread + 0.02], [0, h / 2, z], tilt));
      }
      // Murets de chaque côté de l'escalier.
      if (!ruin) {
        for (const sx of [-1, 1]) {
          const l = tread * steps;
          stoneParts.push(buildBlock([0.3, walkway, l], [sx * (stairWidth / 2 + steps * 0.06 + 0.15), walkway / 2, side * (depth / 2 + l / 2)], [0, 0, 0], { taper: 0 }));
        }
      }
      reach = Math.max(reach, depth / 2 + tread * steps);
    }
  }
  // Bornes aux angles, contreforts qui serrent l'anneau au-dessus de la passerelle.
  if (baseRng.chance(0.65) && !ruin) {
    const bh = baseRng.range(0.6, 1.0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) stoneParts.push(buildBlock([0.5, bh, 0.5], [sx * (width / 2 - 0.35), walkway + bh / 2, sz * (depth / 2 - 0.35)], [0, 0, 0], { taper: 0.3 }));
  }
  const buttress = baseRng.range(0.7, 1.1);
  for (const sx of [-1, 1]) {
    stoneParts.push(buildBlock([0.75, buttress, OUTER[2] * 2 + 0.5], [sx * (OUTER[1] + 0.05), walkway + buttress / 2 - 0.05, 0], [0, 0, 0], { taper: 0.25 }));
  }
  if (ruin) {
    const rubble = baseRng.int(6, 10);
    for (let i = 0; i < rubble; i++) {
      const a = baseRng.range(0, TAU);
      const d = baseRng.range(4.4, 5.8);
      const s = baseRng.range(0.25, 0.6);
      stoneParts.push(buildBlock([s * baseRng.range(1, 1.8), s, s * baseRng.range(0.8, 1.4)], [Math.cos(a) * d * 0.9, s * 0.42, Math.sin(a) * d], [baseRng.range(-0.25, 0.25), baseRng.range(0, TAU), baseRng.range(-0.25, 0.25)]));
    }
  }

  // --- Anneau extérieur, lèvre et verrous (fixes), dans le repère du centre de l'anneau.
  const center = new THREE.Vector3(0, walkway - 0.04 + R_APERTURE, 0); // bas de l'ouverture au ras de la passerelle
  const ringParts = [];
  const [ro1, ro2, dO] = OUTER;
  const c = 0.1; // chanfreins
  ringParts.push(
    buildLathe([[ro1, -dO], [ro2 - c, -dO], [ro2, -dO + c], [ro2, dO - c], [ro2 - c, dO], [ro1, dO]], { segments: 48, axis: "z" }),
    buildLathe([[LIP[0], -LIP[2]], [LIP[1], -LIP[2]], [LIP[1], LIP[2]], [LIP[0], LIP[2]]], { segments: 48, axis: "z" }),
  );
  // Verrous : sur chaque face, un sabot de pierre en trapèze posé sur l'anneau extérieur, deux mâchoires, et un
  // cristal couché qui pointe vers le centre et glisse au-dessus de l'anneau intérieur pour le bloquer.
  const shoeWide = lockRng.range(0.5, 0.6), shoeNarrow = lockRng.range(0.26, 0.34);
  const jawLean = lockRng.range(0.12, 0.28);
  const crystalLength = lockRng.range(0.56, 0.66);
  for (let i = 0; i < p.locks; i++) {
    const a = lockAngle(i, p.locks);
    const radial = [Math.cos(a), Math.sin(a)];
    const at = (r, t, z) => [radial[0] * r - radial[1] * t, radial[1] * r + radial[0] * t, z];
    for (const face of [1, -1]) {
      const z = face * (dO + 0.05);
      // Sabot : deux blocs, large dehors, étroit dedans (trapèze vu de face).
      ringParts.push(buildBlock([ro2 - ro1 - 0.06, (shoeWide + shoeNarrow) / 2, 0.12], at((ro1 + ro2) / 2, 0, z), [0, 0, a]));
      for (const side of [-1, 1]) {
        ringParts.push(buildBlock([0.42, 0.09, 0.2], at(ro1 + 0.16, side * (shoeNarrow / 2 + 0.07), face * (dO + 0.1)), [0, 0, a + side * jawLean]));
      }
    }
  }
  for (const geometry of ringParts) geometry.translate(center.x, center.y, center.z);
  stoneParts.push(...ringParts);

  const stoneMaterial = createToonMaterial({
    ramp: stone.ramp,
    ink: stone.ink,
    steps: [0.34, 0.56, 0.8],
    pattern: "speckle",
    patternParams: [16, 0.05, 0.2, 1],
    seed: baseRng.int(0, 96),
    crease: true,
    id: 10,
  });
  const frame = new THREE.Mesh(mergeGeometries(stoneParts), stoneMaterial);
  frame.name = "frame";
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  // --- Anneau intérieur : bande et séparations entre les symboles. Il tourne autour de son centre.
  const G = seq.glyphs;
  const [ri1, ri2, dI] = INNER;
  const innerParts = [buildLathe([[ri1, -dI], [ri2, -dI], [ri2, dI], [ri1, dI]], { segments: 48, axis: "z" })];
  for (let j = 0; j < G; j++) {
    const a = glyphAngle(j + 0.5, G);
    const rm = (ri1 + ri2) / 2;
    innerParts.push(buildBlock([ri2 - ri1, 0.06, dI * 2 + 0.04], [Math.cos(a) * rm, Math.sin(a) * rm, 0], [0, 0, a]));
  }
  const innerRing = new THREE.Mesh(
    mergeGeometries(innerParts),
    createToonMaterial({
      // Un cran plus sombre que l'anneau extérieur : la bande qui tourne se détache.
      ramp: [stone.ink, stone.ramp[0], stone.ramp[1], stone.ramp[2]],
      ink: stone.ink,
      steps: [0.3, 0.52, 0.78],
      pattern: "speckle",
      patternParams: [16, 0.04, 0.2, 1],
      seed: baseRng.int(0, 96),
      crease: true,
      id: 11,
    }),
  );
  innerRing.name = "inner-ring";
  innerRing.position.copy(center);
  innerRing.castShadow = true;
  innerRing.receiveShadow = true;
  group.add(innerRing);

  // --- Énergie : symboles (tournent avec l'anneau), cristaux des verrous, sonde, vortex. Un seul maillage, mis à
  // jour sur le CPU à chaque cran du temps partagé (12 images/s).
  const positions = [];
  const normalsOf = [];
  const index = [];
  const pushQuad = (corners, z) => {
    const first = positions.length / 3;
    for (const [x, y] of corners) positions.push(x, y, z), normalsOf.push(0, 0, Math.sign(z));
    if (z > 0) index.push(first, first + 1, first + 2, first, first + 2, first + 3);
    else index.push(first, first + 2, first + 1, first, first + 3, first + 2);
  };

  // Symboles : 3 à 5 traits d'un pixel sur une grille de 3 × 4 points, gravés sur les deux faces.
  const glyphRanges = [];
  const STROKE = 0.07;
  const gridU = [-0.1, 0, 0.1];
  const gridV = [-0.14, -0.05, 0.05, 0.14];
  for (let j = 0; j < G; j++) {
    const start = positions.length / 3;
    const a = glyphAngle(j, G);
    const rm = (ri1 + ri2) / 2;
    const rad = [Math.cos(a), Math.sin(a)];
    const tan = [-Math.sin(a), Math.cos(a)];
    const toRing = (u, v) => [rad[0] * (rm + v) + tan[0] * u, rad[1] * (rm + v) + tan[1] * u];
    const strokes = [];
    let pu = glyphRng.int(0, 2), pv = glyphRng.int(0, 3);
    const count = glyphRng.int(3, 5);
    for (let s = 0; s < count; s++) {
      if (s > 0 && glyphRng.chance(0.25)) (pu = glyphRng.int(0, 2)), (pv = glyphRng.int(0, 3));
      let nu, nv, tries = 0;
      do {
        nu = THREE.MathUtils.clamp(pu + glyphRng.int(-1, 1), 0, 2);
        nv = THREE.MathUtils.clamp(pv + glyphRng.int(-1, 1) * (glyphRng.chance(0.4) ? 2 : 1), 0, 3);
      } while (nu === pu && nv === pv && ++tries < 8);
      if (nu !== pu || nv !== pv) strokes.push([gridU[pu], gridV[pv], gridU[nu], gridV[nv]]);
      pu = nu;
      pv = nv;
    }
    if (glyphRng.chance(0.35)) strokes.push([gridU[glyphRng.int(0, 2)], 0.19, null, null]); // point au-dessus
    for (const [u1, v1, u2, v2] of strokes) {
      let corners;
      if (u2 === null) {
        const h = STROKE / 2;
        corners = [[u1 - h, v1 - h], [u1 + h, v1 - h], [u1 + h, v1 + h], [u1 - h, v1 + h]];
      } else {
        const du = u2 - u1, dv = v2 - v1, len = Math.hypot(du, dv);
        const ou = (-dv / len) * (STROKE / 2), ov = (du / len) * (STROKE / 2);
        const eu = (du / len) * (STROKE / 2), ev = (dv / len) * (STROKE / 2);
        corners = [[u1 - eu + ou, v1 - ev + ov], [u1 - eu - ou, v1 - ev - ov], [u2 + eu - ou, v2 + ev - ov], [u2 + eu + ou, v2 + ev + ov]];
      }
      const ring = corners.map(([u, v]) => toRing(u, v));
      const area = ring.reduce((s, [x, y], k) => s + x * ring[(k + 1) % 4][1] - ring[(k + 1) % 4][0] * y, 0);
      if (area < 0) ring.reverse();
      for (const z of [GLYPH_DEPTH, -GLYPH_DEPTH]) pushQuad(ring, z);
    }
    glyphRanges.push([start, positions.length / 3]);
  }
  const glyphGeometry = new THREE.BufferGeometry();
  glyphGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  glyphGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normalsOf), 3));
  glyphGeometry.setIndex(index);
  let vertex = positions.length / 3;

  // Cristaux des verrous : un par face, couché sur le sabot, pointe vers le centre.
  const gemGeometries = [];
  const crystals = [];
  for (let i = 0; i < p.locks; i++) {
    const a = lockAngle(i, p.locks);
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const first = vertex;
    const pieces = [];
    for (const face of [1, -1]) {
      const position = dir.clone().multiplyScalar(ro1 + 0.06).setZ(face * (dO + 0.17));
      pieces.push(buildGem({ length: crystalLength, radius: 0.13, sides: 4, waist: 0.62, position, direction: dir.clone().negate(), spin: Math.PI / 4 }));
    }
    for (const piece of pieces) vertex += piece.attributes.position.count;
    crystals.push({ first, last: vertex, dir, facets: pieces.flatMap((g) => g.userData.facet) });
    gemGeometries.push(...pieces);
  }
  // Sonde de démonstration : un cristal à huit faces qui traverse le vortex.
  const probeGeometry = buildGem({ length: 0.5, radius: 0.2, sides: 6, waist: 0.5 });
  const probeRange = [vertex, vertex + probeGeometry.attributes.position.count];
  const probeFacets = probeGeometry.userData.facet;
  vertex = probeRange[1];
  // Vortex : un disque en anneaux concentriques.
  const RINGS = 13, SEG = 44;
  const discFirst = vertex;
  const disc = buildDisc(RINGS, SEG);

  const energyGeometry = mergeGeometries([glyphGeometry, ...gemGeometries, probeGeometry, disc]);
  const shadeArray = new Float32Array(energyGeometry.attributes.position.count);
  energyGeometry.setAttribute("aShade", new THREE.BufferAttribute(shadeArray, 1));
  energyGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 7);
  const basePositions = Float32Array.from(energyGeometry.attributes.position.array);

  const energy = new THREE.Mesh(
    energyGeometry,
    createToonMaterial({ ramp, steps: ENERGY_STEPS, unlit: true, shade: true, emissive: ENERGY_EMISSIVE, glow: false, side: THREE.DoubleSide, id: 12 }),
  );
  energy.name = "energy";
  energy.position.copy(center);
  group.add(energy);

  // --- Ondes de traversée (point de passage dans le plan du vortex, sens, instant).
  const ripples = [];
  const RIPPLE_LIFE = 1.6;
  let now = 0;
  function touch(x, y, direction = 1) {
    // Deux passages presque au même endroit au même moment ne font qu'une onde (un corps et son maillage).
    if (ripples.some((r) => now - r.born < 0.25 && Math.hypot(r.x - x, r.y - y) < 0.4)) return;
    ripples.push({ x, y, dir: Math.sign(direction) || 1, born: now });
    if (ripples.length > 6) ripples.shift();
  }

  // --- Animation.
  const pos = energyGeometry.attributes.position;
  const pa = pos.array;
  const lockedGlyph = new Map(seq.address.map((g, i) => [g, i]));
  let glowLevel = 0;
  let horizonOpen = false;
  let probeZ = null;
  function update(time) {
    const s = portalStateAt(seq, time, p.state);
    now = time;
    innerRing.rotation.z = s.ring;
    const cos = Math.cos(s.ring), sin = Math.sin(s.ring);
    // Symboles : tournent avec l'anneau ; ceux de l'adresse s'allument quand leur verrou s'enclenche.
    for (let j = 0; j < G; j++) {
      const lock = lockedGlyph.get(j);
      const lit = lock === undefined ? 0 : s.locked[lock];
      const shade = lit >= 1 ? 0.92 : lit > 0 ? 1 : 0.1;
      for (let v = glyphRanges[j][0]; v < glyphRanges[j][1]; v++) {
        const x = basePositions[v * 3], y = basePositions[v * 3 + 1];
        pa[v * 3] = x * cos - y * sin;
        pa[v * 3 + 1] = x * sin + y * cos;
        shadeArray[v] = shade;
      }
    }
    // Cristaux : glissent de 14 cm vers le centre en verrouillant, s'allument (éclair au moment du choc) et restent
    // allumés jusqu'à la fermeture du vortex.
    const open = s.horizon === "open" || s.horizon === "burst";
    for (let i = 0; i < p.locks; i++) {
      const cr = crystals[i];
      const k = s.locked[i];
      const push = -0.14 * smooth(k);
      const flash = k > 0 && k < 1;
      for (let v = cr.first; v < cr.last; v++) {
        pa[v * 3] = basePositions[v * 3] + cr.dir.x * push;
        pa[v * 3 + 1] = basePositions[v * 3 + 1] + cr.dir.y * push;
        const facet = cr.facets[v - cr.first] % 2;
        shadeArray[v] = flash ? 1 : k >= 1 ? (open ? 0.8 : 0.72) + facet * 0.14 : 0.26 + facet * 0.14;
      }
    }

    // Vortex.
    let radius = 0, surge = 0, boost = 0;
    if (s.horizon === "burst") {
      radius = smooth(Math.min(1, s.k / 0.12));
      surge = s.k < 0.3 ? Math.sin(((s.k / 0.3) * Math.PI) / 2) : 1 - smooth(Math.min(1, (s.k - 0.3) / 0.55));
      boost = 0.3 * (1 - s.k);
    } else if (s.horizon === "open") {
      radius = 1;
    } else if (s.horizon === "closing") {
      radius = 1 - smooth(s.k);
      boost = 0.35 * s.k;
    }
    horizonOpen = radius > 0.9 && s.horizon !== "burst";
    if (!horizonOpen) ripples.length = 0;

    // Sonde : pendant le vortex ouvert, elle entre par l'avant, ressort, puis repart (deux passages par sens).
    let probe = null;
    if (p.probe === "on" && horizonOpen) {
      const k = s.horizon === "open" && p.state === "cycle" ? s.k : (s.t / 9) % 1;
      const leg = (from, to) => (k >= from && k < to ? (k - from) / (to - from) : null);
      const go = leg(0.12, 0.42), back = leg(0.55, 0.85);
      const u = go ?? back;
      if (u !== null) {
        const z = go !== null ? 4.5 - 9 * u : -4.5 + 9 * u;
        probe = { x: Math.sin(u * 5) * 0.3, y: -R_APERTURE + 1.25 + Math.sin(u * TAU) * 0.15, z };
      }
    }
    if (probe) {
      if (probeZ !== null && Math.sign(probeZ) !== Math.sign(probe.z)) touch(probe.x, probe.y, probe.z - probeZ);
      probeZ = probe.z;
    } else probeZ = null;
    for (let v = probeRange[0]; v < probeRange[1]; v++) {
      const f = probeFacets[v - probeRange[0]];
      if (!probe) {
        pa[v * 3] = pa[v * 3 + 1] = pa[v * 3 + 2] = 0;
        continue;
      }
      // Elle tourne sur elle-même en avançant.
      const bx = basePositions[v * 3], by = basePositions[v * 3 + 1], bz = basePositions[v * 3 + 2];
      const spin = time * 2.5;
      pa[v * 3] = probe.x + bx * Math.cos(spin) + bz * Math.sin(spin);
      pa[v * 3 + 1] = probe.y + by;
      pa[v * 3 + 2] = probe.z - bx * Math.sin(spin) + bz * Math.cos(spin);
      shadeArray[v] = 0.62 + (f % 3) * 0.14;
    }

    // Ondes actives.
    for (let r = ripples.length - 1; r >= 0; r--) if (time - ripples[r].born > RIPPLE_LIFE) ripples.splice(r, 1);

    const t = s.t;
    let v = discFirst;
    for (let ring = 0; ring <= RINGS; ring++) {
      const r = ring / RINGS;
      const count = ring === 0 ? 1 : SEG;
      for (let k = 0; k < count; k++) {
        const a = (k / SEG) * TAU + (ring % 2) * (Math.PI / SEG);
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        // Reflets en filaments (crêtes d'un bruit lent) et éclats (pics d'un bruit fin), comme une eau éclairée.
        const n1 = noise(x * 3.1 + t * 0.3 + 5, y * 3.1 - t * 0.2, t * 0.4);
        const n2 = noise(x * 6.5 - t * 0.45, y * 6.5 + t * 0.3 + 9, 20 + t * 0.7);
        const ridge = Math.pow(1 - Math.abs(n1 * 2 - 1), 5);
        const sparkle = Math.max(0, n2 - 0.7) * 2.4;
        let shade = 0.26 + 0.24 * (1 - r) ** 2 + 0.4 * ridge + sparkle - 0.1 * r ** 6;
        shade += 0.06 * Math.sin(r * 14 - t * 2.6);
        let z = 0.04 * Math.sin(r * 9 - t * 3) * (1 - r);
        // Ondes de passage : un creux au point d'entrée, puis des cercles de lumière qui s'élargissent.
        const px = x * R_APERTURE, py = y * R_APERTURE;
        for (const rp of ripples) {
          const age = time - rp.born;
          const d = Math.hypot(px - rp.x, py - rp.y);
          const fade = 1 - age / RIPPLE_LIFE;
          const front = 0.25 + age * 2.2;
          // Crête blanche, creux sombre juste derrière, deuxième crête plus faible ; éclair au point de passage
          // puis creux qui se referme.
          const crest = Math.exp(-(((d - front) / 0.2) ** 2)) * fade;
          const trough = Math.exp(-(((d - front + 0.38) / 0.16) ** 2)) * fade;
          const crest2 = Math.exp(-(((d - front + 0.8) / 0.16) ** 2)) * fade * 0.7;
          const flash = Math.exp(-((d / 0.5) ** 2)) * Math.max(0, 1 - age / 0.35);
          const hollow = Math.exp(-((d / 0.4) ** 2)) * Math.max(0, Math.min(1, (age - 0.2) * 4)) * fade;
          shade += 0.9 * crest - 0.55 * trough + 0.6 * crest2 + 1.2 * flash - 0.5 * hollow;
          z += rp.dir * (0.5 * flash + 0.25 * hollow + 0.15 * (crest - trough));
        }
        // Jaillissement : le centre part vers l'avant en cône bouillonnant.
        const bulge = surge * 3.1 * Math.pow(Math.max(0, 1 - r * r), 0.7) * (0.8 + 0.4 * n2);
        const R = R_APERTURE * radius * (1 + surge * 0.04);
        pa[v * 3] = x * R;
        pa[v * 3 + 1] = y * R;
        pa[v * 3 + 2] = radius > 0 ? bulge + z * (1 - r * r * 0.6) : 0;
        shadeArray[v] = shade + boost;
        v++;
      }
    }
    pos.needsUpdate = true;
    energyGeometry.attributes.aShade.needsUpdate = true;
    glowLevel = Math.max(radius, s.locked.some((l) => l >= 1) ? 0.35 : 0);
  }

  // --- Traversée par n'importe quel objet de la scène : on suit la position de chaque objet (hors os et maillages
  // instanciés) dans le repère du vortex ; un changement de côté dans l'ouverture fait une onde.
  const previous = new WeakMap();
  const local = new THREE.Vector3();
  const inverse = new THREE.Matrix4();
  function watchScene() {
    let root = group;
    while (root.parent) root = root.parent;
    if (root === group) return;
    inverse.copy(energy.matrixWorld).invert();
    const visit = (object) => {
      if (object === group) return;
      if (!object.isBone && !object.isInstancedMesh && !object.isLight && !object.isCamera && object !== root) {
        local.setFromMatrixPosition(object.matrixWorld).applyMatrix4(inverse);
        const before = previous.get(object);
        if (before !== undefined && horizonOpen && Math.sign(before.z) !== Math.sign(local.z) && Math.abs(local.z - before.z) < 3) {
          if (Math.hypot(local.x, local.y) < R_APERTURE - 0.1) touch(local.x, local.y, local.z - before.z);
        }
        if (before) before.copy(local);
        else previous.set(object, local.clone());
      }
      for (const child of object.children) visit(child);
    };
    visit(root);
  }

  // Lumière : le vortex éclaire le décor proche dans le noir (un peu dès que les verrous s'allument).
  const light = createGlowLight();
  energy.material.addEventListener("dispose", () => light.release());
  const lightColor = rgb(ramp[3]);
  const lightPosition = new THREE.Vector3();
  const lightOffset = new THREE.Vector3(0, 0, 0.8);

  let lastTime = -1;
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    const changed = time !== lastTime;
    if (changed) {
      lastTime = time;
      update(time);
    }
    baseUpdate(force);
    if (changed) watchScene();
    if (glowLevel > 0) light.set(energy.localToWorld(lightPosition.copy(lightOffset)), lightColor, 8 * glowLevel, 1.4);
    else light.set(lightPosition.set(0, -999, 0), lightColor, 0, 0);
  };
  update(0);
  lastTime = 0;

  group.userData.walkway = walkway;
  group.userData.touch = (x, y, direction) => touch(x, y - center.y, direction);
  group.userData.asset = { id: meta.id, params: p, address: seq.address, glyphs: G, duration: seq.duration, walkway };
  return group;
}

const smooth = (k) => k * k * (3 - 2 * k);

/** Disque plat (plan XY, face +Z) en anneaux concentriques : centre + `rings` anneaux de `segments` sommets. */
function buildDisc(rings, segments) {
  const count = 1 + rings * segments;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) normals[i * 3 + 2] = 1;
  const index = [];
  for (let k = 0; k < segments; k++) index.push(0, 1 + k, 1 + ((k + 1) % segments));
  for (let ring = 1; ring < rings; ring++) {
    const a = 1 + (ring - 1) * segments, b = 1 + ring * segments;
    for (let k = 0; k < segments; k++) {
      const k1 = (k + 1) % segments;
      // Les anneaux impairs sont décalés d'un demi-pas : triangles en quinconce.
      if (ring % 2 === 1) index.push(a + k, b + k, a + k1, a + k1, b + k, b + k1);
      else index.push(a + k, b + k, b + k1, a + k, b + k1, a + k1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setIndex(index);
  return geometry;
}
