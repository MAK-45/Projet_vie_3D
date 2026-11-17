// Porte des étoiles : un grand anneau de pierre debout sur son socle, qui ouvre un passage vers un autre monde.
// Design original du projet : un anneau extérieur fixe portant des verrous de cristal tenus par des griffes (sur
// tout l'anneau sauf le bas, où il repose), un anneau intérieur gravé de symboles inventés (tirés de la graine) qui
// tourne pour composer une adresse, et un vortex d'énergie qui jaillit vers l'avant puis se stabilise en surface
// d'eau lumineuse.
//
// Séquence (`state: "cycle"`, boucle d'environ 30 s, horloge partagée avec le pupitre `star-portal-dial`) :
// l'anneau intérieur tourne, alterne de sens, s'arrête quand le symbole voulu est en face du verrou suivant ; le
// verrou s'enfonce et s'allume avec son symbole ; quand tout est verrouillé, le vortex jaillit, ondule 9 s, se
// referme ; tout s'éteint et l'anneau revient en place.
//
// 3 draw calls : pierre de la porte et du socle, anneau intérieur (tourne), énergie (vortex, cristaux, symboles).

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

const BASES = { stairs: "Escalier", dais: "Estrade ronde", ruin: "Ruine" };
const STATES = { cycle: "Composition en boucle", dormant: "Endormie", open: "Ouverte" };

const params = {
  seed: seedParam(
    "Change l'adresse composée et le rythme de la séquence, le nombre de symboles (24 à 36) et leur dessin, les " +
      "griffes des verrous, et le socle : marches, largeur, dalles et pierres tombées.",
  ),
  base: choiceParam("Socle", BASES, "Escalier en façade, estrade ronde à deux gradins, ou ruine aux dalles disjointes (la porte penche un peu)."),
  state: choiceParam("État", STATES, "En boucle : l'anneau tourne, les verrous s'enclenchent, le vortex jaillit puis se referme. Endormie ou ouverte : figée."),
  locks: { type: "int", default: 7, min: 5, max: 9, label: "Verrous", description: "Nombre de verrous de cristal, donc de symboles dans une adresse (le pupitre doit avoir le même)." },
  energy: choiceParam("Énergie", PORTAL_ENERGIES, "Couleur du vortex, des cristaux et des symboles allumés."),
  stone: stoneParam("Pierre de l'anneau et du socle.", { only: ["granite", "slate", "basalt", "sandstone"] }),
};

export const meta = {
  id: "props/magic/star-portal",
  name: "Porte des étoiles",
  nameEn: "Star portal",
  category: "props",
  subcategory: "magic",
  description:
    "Grand anneau de pierre de 6,7 m qui compose une adresse : son anneau intérieur gravé de symboles tourne, ses " +
    "verrous de cristal s'enclenchent un à un, puis un vortex d'énergie jaillit et ondule avant de se refermer. " +
    "Socle en escalier, estrade ou ruine ; la graine change l'adresse, les symboles et le socle. Se commande avec " +
    "le pupitre (même graine, même nombre de verrous).",
  tags: [
    "porte des étoiles", "portail", "anneau", "porte", "vortex", "symboles", "glyphes", "verrous", "cristaux",
    "voyage", "passage entre les mondes", "magie", "science-fiction", "pierre", "animé", "extérieur",
    "star portal", "portal", "gate", "ring", "wormhole", "glyphs", "symbols", "locks", "crystals", "travel",
    "world gate", "magic", "sci-fi", "stone", "animated", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "desert", "snow", "mountain", "cave", "beach", "swamp"],
  version: 1,
  added: "2026-11-17",
  units: "1 unité = 1 mètre ; origine au sol au centre du socle ; l'anneau fait face à +Z (le vortex jaillit vers +Z)",
  footprint: { radius: 4.6, height: 8.6 },
  animated: ["dial", "glow"],
  params,
  variants: variantsOf("base", params.base),
};

const TAU = Math.PI * 2;

// Mesures de l'anneau (mètres).
const R_APERTURE = 2.2; // bord du vortex (caché sous la lèvre)
const LIP = [2.16, 2.34, 0.36]; // lèvre fixe : rayon intérieur, extérieur, demi-épaisseur
const INNER = [2.34, 2.84, 0.27]; // anneau intérieur qui tourne
const OUTER = [2.84, 3.35, 0.42]; // anneau extérieur
const GLYPH_DEPTH = INNER[2] + 0.025; // les symboles affleurent des deux faces

/**
 * Crée la porte.
 * @param {{seed?: number, base?: string, state?: string, locks?: number, energy?: string, stone?: string}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; il s'anime avec `tick(secondes)`
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const ramp = energyRamp(p.energy);
  const baseRng = createRng(p.seed * 7919 + 17);
  const glyphRng = createRng(p.seed * 104729 + 71);
  const clawRng = createRng(p.seed * 15485863 + 5);
  const seq = portalSequence(p.seed, p.locks);
  const noise = createNoise3(p.seed * 31 + 7);

  const group = new THREE.Group();
  group.name = meta.name;

  // --- Socle : la porte repose sur un berceau, lui-même posé sur un escalier, une estrade ou une ruine.
  const stoneParts = [];
  let top = 0; // hauteur du dessus du socle
  let tilt = 0;
  if (p.base === "stairs") {
    const steps = baseRng.int(2, 4);
    const rise = baseRng.range(0.16, 0.2);
    top = steps * rise;
    const width = baseRng.range(7.2, 8.4);
    const depth = baseRng.range(2.6, 3.2);
    stoneParts.push(buildBlock([width, top, depth], [0, top / 2, 0]));
    // Marches en façade (et parfois au dos), plus étroites que la plateforme.
    const stairWidth = baseRng.range(3.4, 5);
    const tread = baseRng.range(0.38, 0.48);
    for (const side of baseRng.chance(0.45) ? [1, -1] : [1]) {
      for (let s = 1; s < steps + 1; s++) {
        const h = top - s * rise + rise; // la marche s, de haut en bas
        const z = side * (depth / 2 + tread * (s - 0.5));
        stoneParts.push(buildBlock([stairWidth + s * 0.25, h, tread], [0, h / 2, z]));
      }
    }
    // Bornes aux angles de la plateforme.
    if (baseRng.chance(0.6)) {
      const bh = baseRng.range(0.5, 0.9);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) stoneParts.push(buildBlock([0.45, bh, 0.45], [sx * (width / 2 - 0.3), top + bh / 2, sz * (depth / 2 - 0.3)], [0, 0, 0], { taper: 0.25 }));
      }
    }
  } else if (p.base === "dais") {
    const radius = baseRng.range(3.9, 4.6);
    const h1 = baseRng.range(0.2, 0.28);
    const h2 = baseRng.range(0.2, 0.28);
    const sides = baseRng.pick([8, 10, 12]);
    top = h1 + h2;
    stoneParts.push(
      buildLathe([[0, 0], [radius, 0], [radius, h1], [0, h1]], { segments: sides, facets: true, start: Math.PI / sides }),
      buildLathe([[0, h1], [radius * 0.72, h1], [radius * 0.72, top], [0, top]], { segments: sides, facets: true, start: Math.PI / sides }),
    );
  } else {
    // Ruine : dalles disjointes de hauteurs et d'inclinaisons différentes, pierres tombées autour.
    top = 0.3;
    tilt = baseRng.range(0.025, 0.05) * (baseRng.chance(0.5) ? 1 : -1);
    const slabs = baseRng.int(5, 7);
    for (let i = 0; i < slabs; i++) {
      const x = -3.6 + (i + 0.5) * (7.2 / slabs) + baseRng.range(-0.15, 0.15);
      const h = baseRng.range(0.18, 0.42);
      const w = (7.2 / slabs) * baseRng.range(0.82, 0.98);
      const d = baseRng.range(2.4, 3.4);
      stoneParts.push(buildBlock([w, h, d], [x, h / 2 - 0.02, baseRng.range(-0.3, 0.3)], [baseRng.range(-0.06, 0.06), baseRng.range(-0.12, 0.12), baseRng.range(-0.05, 0.05)]));
    }
    const rubble = baseRng.int(5, 9);
    for (let i = 0; i < rubble; i++) {
      const a = baseRng.range(0, TAU);
      const d = baseRng.range(3.2, 4.6);
      const s = baseRng.range(0.25, 0.6);
      stoneParts.push(buildBlock([s * baseRng.range(1, 1.8), s, s * baseRng.range(0.8, 1.4)], [Math.cos(a) * d, s * 0.42, Math.sin(a) * d * 0.7], [baseRng.range(-0.25, 0.25), baseRng.range(0, TAU), baseRng.range(-0.25, 0.25)]));
    }
  }
  // Berceau : deux contreforts qui serrent le bas de l'anneau, et une semelle.
  const cradleW = baseRng.range(2.2, 2.8);
  stoneParts.push(buildBlock([cradleW + 1.2, 0.35, OUTER[2] * 2 + 0.7], [0, top + 0.175, 0]));
  for (const sx of [-1, 1]) {
    stoneParts.push(buildBlock([0.7, 1.0, OUTER[2] * 2 + 0.4], [sx * (cradleW / 2 + 0.15), top + 0.5, 0], [0, 0, sx * 0.35], { taper: 0.2 }));
  }

  // --- Anneau extérieur et lèvre (fixes), dans le repère du centre de l'anneau.
  const center = new THREE.Vector3(0, top + 0.12 + OUTER[1], 0);
  const ringParts = [];
  const [ro1, ro2, dO] = OUTER;
  const c = 0.12; // chanfreins
  ringParts.push(
    buildLathe([[ro1, -dO], [ro2 - c, -dO], [ro2, -dO + c], [ro2, dO - c], [ro2 - c, dO], [ro1, dO]], { segments: 48, axis: "z" }),
    buildLathe([[LIP[0], -LIP[2]], [LIP[1], -LIP[2]], [LIP[1], LIP[2]], [LIP[0] + 0.06, LIP[2]], [LIP[0], LIP[2] - 0.06]], { segments: 48, axis: "z" }),
  );
  // Verrous : un logement sur le bord de l'anneau et deux griffes qui tiennent le cristal.
  const clawSpread = clawRng.range(0.24, 0.32);
  const clawLength = clawRng.range(0.65, 0.9);
  const clawLean = clawRng.range(0.08, 0.25);
  const clawShape = clawRng.pick(["claw", "fin"]);
  for (let i = 0; i < p.locks; i++) {
    const a = lockAngle(i, p.locks);
    const radial = [Math.cos(a), Math.sin(a)];
    const at = (r, t, z = 0) => [radial[0] * r - radial[1] * t, radial[1] * r + radial[0] * t, z];
    ringParts.push(buildBlock([0.34, 0.66, dO * 2 + 0.12], at(ro2 + 0.02, 0), [0, 0, a]));
    for (const side of [-1, 1]) {
      const len = clawShape === "claw" ? clawLength : clawLength * 0.8;
      ringParts.push(
        buildBlock(
          [len, clawShape === "claw" ? 0.16 : 0.12, clawShape === "claw" ? 0.34 : dO * 2 + 0.1],
          at(ro2 + 0.05 + len / 2, side * clawSpread),
          [0, 0, a - side * clawLean],
          { taper: 0 },
        ),
      );
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

  // Tout ce qui appartient à l'anneau penche avec lui (ruine) : on tourne autour du pied.
  const tilted = new THREE.Group();
  tilted.rotation.z = tilt;
  group.add(tilted);
  tilted.add(frame);

  // --- Anneau intérieur : bande, séparations entre les symboles. Il tourne autour de son centre.
  const G = seq.glyphs;
  const [ri1, ri2, dI] = INNER;
  const innerParts = [buildLathe([[ri1, -dI], [ri2, -dI], [ri2, dI], [ri1, dI]], { segments: 48, axis: "z" })];
  for (let j = 0; j < G; j++) {
    const a = glyphAngle(j + 0.5, G);
    const rm = (ri1 + ri2) / 2;
    innerParts.push(buildBlock([ri2 - ri1, 0.07, dI * 2 + 0.05], [Math.cos(a) * rm, Math.sin(a) * rm, 0], [0, 0, a]));
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
  tilted.add(innerRing);

  // --- Énergie : symboles (tournent avec l'anneau), cristaux des verrous, vortex. Un seul maillage, mis à jour
  // sur le CPU à chaque cran du temps partagé (12 images/s).
  const positions = [];
  const shades = [];
  const index = [];
  const pushQuad = (corners, z, shade) => {
    const first = positions.length / 3;
    for (const [x, y] of corners) positions.push(x, y, z), shades.push(shade);
    if (z > 0) index.push(first, first + 1, first + 2, first, first + 2, first + 3);
    else index.push(first, first + 2, first + 1, first, first + 3, first + 2);
  };
  const normalsOf = []; // normales, parallèles aux positions

  // Symboles : chaque symbole est 3 à 5 traits d'un pixel de large sur une grille de 3 × 4 points, gravés sur les
  // deux faces de l'anneau. Dessin tiré de la graine, propre à chaque symbole.
  const glyphRanges = [];
  const STROKE = 0.075;
  const gridU = [-0.11, 0, 0.11];
  const gridV = [-0.17, -0.06, 0.06, 0.17];
  for (let j = 0; j < G; j++) {
    const start = positions.length / 3;
    const a = glyphAngle(j, G);
    const rm = (ri1 + ri2) / 2;
    const rad = [Math.cos(a), Math.sin(a)];
    const tan = [-Math.sin(a), Math.cos(a)];
    const toRing = (u, v) => [rad[0] * (rm + v) + tan[0] * u, rad[1] * (rm + v) + tan[1] * u];
    // Traits : on part d'un point et on marche vers des voisins, parfois on recommence ailleurs.
    const strokes = [];
    let pu = glyphRng.int(0, 2), pv = glyphRng.int(0, 3);
    const count = glyphRng.int(3, 5);
    for (let s = 0; s < count; s++) {
      if (s > 0 && glyphRng.chance(0.25)) (pu = glyphRng.int(0, 2)), (pv = glyphRng.int(0, 3));
      let nu, nv, tries = 0;
      do {
        nu = THREE.MathUtils.clamp(pu + glyphRng.int(-1, 1), 0, 2);
        nv = THREE.MathUtils.clamp(pv + glyphRng.int(-1, 1) * (glyphRng.chance(0.4) ? 2 : 1), 0, 3);
      } while ((nu === pu && nv === pv) && ++tries < 8);
      if (nu !== pu || nv !== pv) strokes.push([gridU[pu], gridV[pv], gridU[nu], gridV[nv]]);
      pu = nu;
      pv = nv;
    }
    if (glyphRng.chance(0.35)) strokes.push([gridU[glyphRng.int(0, 2)], 0.235, null, null]); // point au-dessus
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
      // Sens trigonométrique vu de face pour la face avant.
      const ring = corners.map(([u, v]) => toRing(u, v));
      const area = ring.reduce((s, [x, y], k) => s + x * ring[(k + 1) % 4][1] - ring[(k + 1) % 4][0] * y, 0);
      if (area < 0) ring.reverse();
      for (const z of [GLYPH_DEPTH, -GLYPH_DEPTH]) {
        pushQuad(ring, z, 0.1);
        for (let k = 0; k < 4; k++) normalsOf.push(0, 0, Math.sign(z));
      }
    }
    glyphRanges.push([start, positions.length / 3]);
  }
  const glyphEnd = positions.length / 3;

  // Cristaux : un grand cristal couché dans chaque verrou (dépasse de l'anneau, s'enfonce en verrouillant) et deux
  // dents sur les faces, qui mordent l'anneau intérieur.
  const gemGeometries = [];
  const crystals = []; // par verrou : [premier sommet, dernier], direction
  let gemVertex = glyphEnd;
  for (let i = 0; i < p.locks; i++) {
    const a = lockAngle(i, p.locks);
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const first = gemVertex;
    const pieces = [
      buildGem({ length: 0.95, radius: 0.2, sides: 6, waist: 0.4, position: dir.clone().multiplyScalar(ro2 + 0.48), direction: dir, spin: Math.PI / 6 }),
    ];
    for (const z of [dO + 0.05, -dO - 0.05]) {
      pieces.push(buildGem({ length: 0.4, radius: 0.11, sides: 4, waist: 0.6, position: dir.clone().multiplyScalar(ro1 + 0.1).setZ(z), direction: dir.clone().negate(), spin: Math.PI / 4 }));
    }
    for (const piece of pieces) gemVertex += piece.attributes.position.count;
    crystals.push({ first, last: gemVertex, dir, facets: pieces.flatMap((g) => g.userData.facet) });
    gemGeometries.push(...pieces);
  }
  // Vortex : un disque en anneaux concentriques.
  const RINGS = 14, SEG = 48;
  const discFirst = gemVertex;

  // Assemblage : symboles (quads), cristaux, disque.
  const glyphGeometry = new THREE.BufferGeometry();
  glyphGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  glyphGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normalsOf), 3));
  glyphGeometry.setIndex(index);
  const disc = buildDisc(RINGS, SEG);
  const energyGeometry = mergeGeometries([glyphGeometry, ...gemGeometries, disc]);
  const vertexCount = energyGeometry.attributes.position.count;
  const shadeArray = new Float32Array(vertexCount);
  energyGeometry.setAttribute("aShade", new THREE.BufferAttribute(shadeArray, 1));
  energyGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 1.5), 5.5);
  const basePositions = Float32Array.from(energyGeometry.attributes.position.array);

  const energy = new THREE.Mesh(
    energyGeometry,
    createToonMaterial({
      ramp,
      steps: [0.22, 0.45, 0.66, 0.85],
      unlit: true,
      shade: true,
      glow: false,
      side: THREE.DoubleSide,
      id: 12,
    }),
  );
  energy.name = "energy";
  energy.position.copy(center);
  tilted.add(energy);

  // --- Animation.
  const pos = energyGeometry.attributes.position;
  const pa = pos.array;
  const lockedGlyph = new Map(seq.address.map((g, i) => [g, i]));
  function update(time) {
    const s = portalStateAt(seq, time, p.state);
    innerRing.rotation.z = s.ring;
    const cos = Math.cos(s.ring), sin = Math.sin(s.ring);
    // Symboles : tournent avec l'anneau ; ceux de l'adresse s'allument quand leur verrou s'enclenche.
    for (let j = 0; j < G; j++) {
      const lock = lockedGlyph.get(j);
      const lit = lock === undefined ? 0 : s.locked[lock];
      const shade = lit >= 1 ? 0.9 : lit > 0 ? 1 : 0.12;
      for (let v = glyphRanges[j][0]; v < glyphRanges[j][1]; v++) {
        const x = basePositions[v * 3], y = basePositions[v * 3 + 1];
        pa[v * 3] = x * cos - y * sin;
        pa[v * 3 + 1] = x * sin + y * cos;
        shadeArray[v] = shade;
      }
    }
    // Cristaux : s'enfoncent de 22 cm en verrouillant, s'allument (éclair au moment du choc).
    const open = s.horizon === "open" || s.horizon === "burst";
    for (let i = 0; i < p.locks; i++) {
      const c = crystals[i];
      const k = s.locked[i];
      const push = -0.22 * k;
      const flash = k > 0 && k < 1;
      for (let v = c.first; v < c.last; v++) {
        pa[v * 3] = basePositions[v * 3] + c.dir.x * push;
        pa[v * 3 + 1] = basePositions[v * 3 + 1] + c.dir.y * push;
        const facet = c.facets[v - c.first] % 2;
        shadeArray[v] = flash ? 0.95 : k >= 1 ? (open ? 0.78 : 0.7) + facet * 0.12 : 0.34 + facet * 0.16;
      }
    }
    // Vortex.
    let radius = 0, surge = 0, boost = 0;
    if (s.horizon === "burst") {
      radius = smooth(Math.min(1, s.k / 0.12));
      surge = s.k < 0.3 ? Math.sin((s.k / 0.3) * Math.PI / 2) : 1 - smooth(Math.min(1, (s.k - 0.3) / 0.55));
      boost = 0.3 * (1 - s.k);
    } else if (s.horizon === "open") {
      radius = 1;
    } else if (s.horizon === "closing") {
      radius = 1 - smooth(s.k);
      boost = 0.35 * s.k;
    }
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
        const sparkle = Math.max(0, n2 - 0.66) * 2.4;
        let shade = 0.24 + 0.28 * (1 - r) ** 2 + 0.46 * ridge + sparkle - 0.1 * r ** 6;
        shade += 0.06 * Math.sin(r * 14 - t * 2.6);
        // Jaillissement : le centre part vers l'avant en cône bouillonnant.
        const bulge = surge * 3.1 * Math.pow(Math.max(0, 1 - r * r), 0.7) * (0.8 + 0.4 * n2);
        const R = R_APERTURE * radius * (1 + surge * 0.04);
        pa[v * 3] = x * R;
        pa[v * 3 + 1] = y * R;
        pa[v * 3 + 2] = radius > 0 ? bulge + 0.04 * Math.sin(r * 9 - t * 3) * (1 - r) : 0;
        shadeArray[v] = shade + boost;
        v++;
      }
    }
    pos.needsUpdate = true;
    energyGeometry.attributes.aShade.needsUpdate = true;
    glowLevel = radius;
  }

  // Lumière : le vortex éclaire le décor proche dans le noir.
  let glowLevel = 0;
  const light = createGlowLight();
  energy.material.addEventListener("dispose", () => light.release());
  const lightColor = rgb(ramp[3]);
  const lightPosition = new THREE.Vector3();
  const lightOffset = new THREE.Vector3(0, 0, 0.6);

  let lastTime = -1;
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      update(time);
    }
    baseUpdate(force);
    if (glowLevel > 0) light.set(energy.localToWorld(lightPosition.copy(lightOffset)), lightColor, 7 * glowLevel, 1.3);
    else light.set(lightPosition.set(0, -999, 0), lightColor, 0, 0);
  };
  update(0);
  lastTime = 0;

  group.userData.asset = { id: meta.id, params: p, address: seq.address, glyphs: G, duration: seq.duration };
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
