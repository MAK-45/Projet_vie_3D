// La Porte-Iris (docs/complexe/PIECES.md, SAS-17) : l'entrée du Sas, une mécanique antique dans un mur de pierre,
// activée par la lumière. Un anneau de basalte encastré dans le mur (Ø 4,4 m, voussoirs à glyphes, liseré de bronze),
// un anneau de bronze qui tourne (Ø 3,8 m, crénelé sur sa face intérieure, noir d'huile entre les créneaux), douze
// lames de bronze en recouvrement qui ferment l'ouverture en moulinet, chacune avec son glyphe, et au centre un
// médaillon de laiton à aiguille entouré d'une couronne de points qui « respire » en ambre. Quatre verrous radiaux.
//
// Mesures : centre à 1,40 m du sol, bas de l'anneau enterré de 0,80 m, ouverture de Ø 2,80 m posée sur un seuil de
// 0,20 m (la bible dit centre à 1,5 m et ouverture de 2,6 m : on garde le cadre et l'anneau, et on agrandit un peu
// l'ouverture pour que le seuil soit praticable sur 1,4 m de large, et qu'elle culmine à 2,80 m comme les portes).
//
// Séquence (réglage `state`, et pilotage `group.userData.door` : open(), close(), setOpen(t), openness, blocking) :
// verrous rétractés (0,6 s), anneau tourné de 15° (0,6 s), lames écartées en cascade (4 s) pendant que les glyphes
// s'allument de l'extérieur vers le centre ; ouverte, les lames sont repliées en couronne derrière l'anneau ;
// la fermeture est l'inverse, plus rapide (3,2 s).
//
// 3 draw calls : pierre (mur, cadre, seuil, voussoirs), bronze (fixe et pièces mobiles dans un seul maillage, réécrit
// sur le CPU seulement pendant le mouvement), lueurs (glyphes, couronne du médaillon, elles aussi portées par les lames).

import * as THREE from "three";
import { sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import {
  PX, arcBlock, beam, buildMasonry, createRigidParts, glowLevels, glowMixMaterial, glyphStrip, mergeParts,
  mergeToned, metalMaterial, plain, slantPlate, soot, stoneMaterial, straightGlyphRuns, withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, glowParam, numberParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const DEG = Math.PI / 180;
const CY = 1.4; // hauteur du centre
const R_OPEN = 1.4; // ouverture
const R_RING = 1.9; // anneau rotatif (1,4 à 1,9 m)
const R_BAND = 2.05; // liseré de bronze (1,9 à 2,05 m)
const R_FRAME = 2.3; // voussoirs (2,05 à 2,3 m)
const HALF = 2.25; // demi-largeur du bloc de cadre encastré dans le mur
const TOP = 3.65; // haut du bloc de cadre
const SILL = 0.2; // seuil
const WALL = 6; // largeur du module de mur
const DEPTH = 0.6;
const BAND = { y0: 1.0, y1: 1.25 };
const BLADES = 12;
const RING = 12; // n° de pièce de l'anneau (les lames sont 0 à 11)
const LOCK0 = 13; // verrous : 13 à 16
const FIXED = 255;
const OPEN_ANGLE = -54 * DEG; // lames repliées : rotation autour de leur pivot
const RING_TURN = 15 * DEG;
const LOCK_TRAVEL = 0.6;
const OPEN_TIME = 5.2; // s
const CLOSE_TIME = 3.2;

const STATES = { closed: "Fermée", open: "Ouverte", cycle: "S'ouvre et se ferme en boucle" };
const WEAR = { patinated: "Patinée", heavy: "Très usée (suie, lames ternies)" };

const params = {
  seed: seedParam("Change les glyphes des lames et des voussoirs, l'ordre et le sens de la cascade, l'appareil du mur, les tons des lames et des pierres."),
  state: choiceParam("État", STATES, "Fermée (glyphes éteints, médaillon qui respire), ouverte (lames repliées en couronne), ou en boucle pour regarder la séquence. Pilotable : group.userData.door."),
  glow: glowParam("Couleur des glyphes et du médaillon.", { only: ["amber", "cyan"] }),
  wear: choiceParam("Usure", WEAR, "Patinée, ou très usée : plus de suie sur le mur et le cadre, lames plus ternies et inégales."),
  wall: choiceParam("Mur", { on: "Avec son pan de mur (6 m)", off: "Cadre seul" }, "La porte livrée avec son pan de mur de 6 m, ou le seul bloc du cadre (pour l'encastrer ailleurs)."),
  height: numberParam("Hauteur du mur", 5, 4, 8, "Hauteur du pan de mur autour de la porte.", { step: 0.5, unit: "m" }),
  stone: stoneParam("Pierre du mur et du cadre.", { only: ["blackBasalt", "smoked"] }),
};

export const meta = {
  id: "buildings/structure/iris-door",
  name: "Porte-Iris",
  nameEn: "Iris door",
  category: "buildings",
  subcategory: "structure",
  description:
    "L'entrée du Sas du Complexe : anneau de basalte à voussoirs gravés encastré dans un pan de mur de 6 m, anneau de " +
    "bronze crénelé qui tourne, douze lames de bronze en moulinet qui s'écartent en cascade pendant que leurs glyphes " +
    "s'allument, médaillon de laiton à couronne de points qui respire, quatre verrous. Fermée, ouverte, ou pilotée " +
    "par le scénario.",
  tags: [
    "porte-iris", "iris", "porte", "diaphragme", "lames", "anneau rotatif", "verrous", "médaillon", "voussoirs", "glyphes",
    "le complexe", "complexe", "ancien-tech", "entrée", "héros", "animé", "pilotable", "intérieur",
    "iris door", "aperture", "doorway", "blades", "rotating ring", "bolts", "medallion", "arch stones", "glyph marks",
    "ancient complex", "ancient-tech", "entrance", "hero asset", "animated", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-18",
  units:
    "1 unité = 1 mètre ; origine au sol, au centre de l'ouverture ; le mur suit l'axe x (6 m), face avant en +z ; " +
    "centre de l'iris à 1,40 m, seuil à 0,20 m, bas de l'anneau sous le sol",
  footprint: { radius: 3.05, height: 5 },
  animated: ["door", "glow"],
  params,
  variants: variantsOf("state", params.state),
};

const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const ease = (t) => t * t * (3 - 2 * t);

/**
 * Crée la Porte-Iris dans son pan de mur.
 * @param {{seed?: number, state?: string, glow?: string, wear?: string, wall?: string, height?: number,
 *   stone?: string}} [given]
 * @returns {THREE.Group} `group.userData.door` : { open(), close(), setOpen(t), openness, blocking, opening }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const rng = createRng(p.seed * 7919 + 23);
  const masonryRng = createRng(p.seed * 104729 + 41);
  const glyphRng = createRng(p.seed * 15485863 + 11);
  const heavy = p.wear === "heavy";
  const H = Math.max(p.height, TOP + 0.35);
  const front = DEPTH / 2;
  const sootAt = soot(H * 0.45, H, heavy ? -0.38 : -0.24);

  const stoneParts = [];
  const metal = []; // [géométrie, n° de pièce]
  const glow = []; // [géométrie, n° de pièce]
  const glowGroups = []; // { start, count, kind, index }
  let glowCount = 0;
  const addGlow = (g, part, kind, index) => {
    const count = g.attributes.position.count;
    glow.push([withShade(g, 0, 4), part]);
    glowGroups.push({ start: glowCount, count, kind, index });
    glowCount += count;
  };

  // --- Pierre : le pan de mur percé du bloc de cadre, le cadre, le seuil, les voussoirs.
  let bandFace = front - PX;
  if (p.wall === "on") {
    const masonry = buildMasonry(masonryRng, {
      width: WALL, height: H, depth: DEPTH, band: BAND, soot: heavy ? -0.36 : -0.24,
      holes: [{ x0: -HALF, x1: HALF, y0: 0, y1: TOP }],
    });
    stoneParts.push(...masonry.parts);
    bandFace = masonry.bandFace;
  }

  // Bloc du cadre : un pavé percé de l'ouverture de l'anneau (cercle de 1,9 m coupé au seuil).
  const shape = new THREE.Shape();
  shape.moveTo(-HALF, 0);
  shape.lineTo(HALF, 0);
  shape.lineTo(HALF, TOP);
  shape.lineTo(-HALF, TOP);
  shape.lineTo(-HALF, 0);
  const hole = new THREE.Path();
  const a0 = Math.asin((SILL - CY) / R_RING);
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((Math.PI - 2 * a0) * i) / steps;
    const [x, y] = polar(R_RING, a);
    if (i === 0) hole.moveTo(x, y + CY);
    else hole.lineTo(x, y + CY);
  }
  hole.closePath();
  shape.holes.push(hole);
  const frame = plain(new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, curveSegments: 1 }));
  frame.translate(0, 0, -DEPTH / 2);
  stoneParts.push(withTone(frame, (x, y) => 0.02 + sootAt(x, y)));

  // Seuil : une marche de pierre usée, débordant d'un pixel devant et derrière.
  const chord = Math.sqrt(R_RING * R_RING - (CY - SILL) ** 2);
  stoneParts.push(withTone(buildBlock([chord * 2 + 0.06, SILL + 0.01, DEPTH + PX * 2], [0, (SILL + 0.01) / 2, 0]), (x, y, z, nx, ny) => (ny > 0.9 ? 0.16 - 0.1 * Math.min(1, Math.abs(x) / chord) : 0.04)));

  // Voussoirs : 16 pierres rayonnantes, un ton plus clair, en saillie de 4 cm ; chacune porte un glyphe.
  const VOUSSOIRS = 16;
  for (let i = 0; i < VOUSSOIRS; i++) {
    const span = (Math.PI * 2) / VOUSSOIRS;
    const mid = Math.PI / 2 + i * span; // le premier à midi
    if (CY + Math.sin(mid) * (R_BAND + R_FRAME) / 2 < -0.1) continue; // sous le sol
    const gap = PX / R_FRAME;
    const g = arcBlock({ r0: R_BAND, r1: R_FRAME, a0: mid - span / 2 + gap / 2, a1: mid + span / 2 - gap / 2, z0: front - 0.02, z1: front + 0.06, segments: 2 });
    g.translate(0, CY, 0);
    const tone = 0.3 + rng.range(-0.1, 0.06);
    stoneParts.push(withTone(g, (x, y) => tone + sootAt(x, y) * 0.6));
    // Glyphe : 2 lignes, couché le long de l'arc (on ne grave pas ceux qui touchent le sol).
    if (CY + Math.sin(mid) * R_FRAME < 0.35) continue;
    const strip = glyphStrip(glyphRng, { length: 0.42, rows: 2 });
    strip.translate(0, -PX, 0);
    strip.rotateZ(mid - Math.PI / 2);
    const [gx, gy] = polar((R_BAND + R_FRAME) / 2, mid);
    strip.translate(gx, gy + CY, front + 0.06);
    // Ordre d'allumage : depuis midi, des deux côtés à la fois.
    const order = Math.min(i, VOUSSOIRS - i);
    addGlow(strip, FIXED, "frame", order / (VOUSSOIRS / 2));
  }

  // Bandeau de glyphes du mur, de part et d'autre du cadre (raccord avec les modules de mur).
  if (p.wall === "on") {
    for (const s of [-1, 1]) {
      const strip = glyphStrip(glyphRng, { length: WALL / 2 - HALF - 0.16, rows: 2 });
      strip.translate(s * (WALL / 2 + HALF) / 2, 1.1 - PX, bandFace);
      addGlow(strip, FIXED, "band", 0);
    }
  }

  // --- Bronze fixe : liseré, ses rivets, les boîtiers des verrous.
  const band = arcBlock({ r0: R_RING, r1: R_BAND, a0: 0, a1: Math.PI * 2, z0: front - 0.04, z1: front + 0.03, segments: 40 });
  band.translate(0, CY, 0);
  metal.push([withTone(band, 0.2), FIXED]);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2 + Math.PI / 24;
    const [x, y] = polar((R_RING + R_BAND) / 2, a);
    if (y + CY < 0.05) continue;
    metal.push([withTone(buildBlock([PX, PX, PX], [x, y + CY, front + 0.03 + PX / 2]), 0.3), FIXED]);
  }

  // --- Anneau rotatif (pièce RING) : deux plaques (devant, derrière) entre lesquelles glissent les lames.
  const SEG = 24;
  for (const [z0, z1] of [[0.09, 0.22], [-0.22, -0.09]]) {
    const isFront = z0 > 0;
    for (let i = 0; i < SEG; i++) {
      const a = (i / SEG) * Math.PI * 2;
      const g = arcBlock({ r0: R_OPEN, r1: R_RING, a0: a, a1: a + (Math.PI * 2) / SEG, z0, z1, segments: 1 });
      const tone = (i % 2 ? -0.12 : -0.24) + rng.range(-0.03, 0.03) - (heavy ? 0.06 : 0);
      // Face intérieure de l'anneau : noir d'huile entre les créneaux.
      withTone(g, (x, y, z, nx, ny) => (nx * x + ny * y < -0.8 * Math.hypot(x, y) ? -0.75 : tone));
      g.translate(0, CY, 0);
      metal.push([g, RING]);
      // Créneau : une dent d'un pixel sur la face intérieure, une case sur deux.
      const ta = a + (Math.PI * 2) / SEG / 4;
      const tooth = arcBlock({ r0: R_OPEN - PX, r1: R_OPEN + 0.01, a0: ta, a1: ta + (Math.PI * 2) / SEG / 2, z0: z0 + 0.01, z1: z1 - 0.01, segments: 1 });
      tooth.translate(0, CY, 0);
      metal.push([withTone(tooth, 0.14), RING]);
      if (isFront) {
        const [x, y] = polar(R_RING - 0.1, a + Math.PI / SEG);
        metal.push([withTone(buildBlock([PX, PX, PX * 0.6], [x, y + CY, z1 + PX * 0.3]), 0.32), RING]);
      }
    }
  }

  // --- Verrous (pièces 13 à 16) : barres radiales à 12 h, 3 h, 6 h et 9 h, devant l'anneau, pointe sur les lames.
  const locks = [];
  for (let m = 0; m < 4; m++) {
    const a = Math.PI / 2 - (m * Math.PI) / 2;
    const dir = new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
    const z = 0.25;
    const from = new THREE.Vector3(0, CY, z).addScaledVector(dir, R_OPEN - 0.18);
    const to = new THREE.Vector3(0, CY, z).addScaledVector(dir, R_RING + 0.1);
    metal.push([withTone(beam(from, to, 0.1, 0.06, 0, new THREE.Vector3(0, 0, 1)), 0.1), LOCK0 + m]);
    const head = new THREE.Vector3(0, CY, z + 0.01).addScaledVector(dir, R_OPEN - 0.14);
    metal.push([withTone(buildBlock([0.14, 0.14, 0.08], [head.x, head.y, head.z]), 0.22), LOCK0 + m]);
    // Boîtier sur le liseré, où la barre rentre.
    const box = new THREE.Vector3(0, CY, front + 0.05).addScaledVector(dir, (R_RING + R_BAND) / 2);
    metal.push([withTone(beam(box.clone().addScaledVector(dir, -0.09), box.clone().addScaledVector(dir, 0.09), 0.2, 0.06, 0, new THREE.Vector3(0, 0, 1)), 0.0), FIXED]);
    locks.push(dir);
  }

  // --- Lames (pièces 0 à 11) : moulinet de 12 lames en recouvrement de 20 %, chacune pivotant sur son coin arrière.
  const bladeOutline = [polar(1.62, -18 * DEG), polar(1.62, 0), polar(1.62, 18 * DEG), polar(0.14, 100 * DEG), polar(0.1, 40 * DEG)];
  const trailA = new THREE.Vector2(...bladeOutline[0]);
  const trailB = new THREE.Vector2(...bladeOutline[4]);
  const trailDir = trailB.clone().sub(trailA).normalize();
  // Face avant en biseau : basse au bord arrière (sous la lame précédente), haute au bord d'attaque.
  const bladeFront = (x, y) => {
    const d = (x - trailA.x) * -trailDir.y + (y - trailA.y) * trailDir.x; // distance au bord arrière
    return 0.03 + 0.045 * clamp01(Math.abs(d) / 0.95);
  };
  const pivots = [];
  const bladeTone = Array.from({ length: BLADES }, (_, k) => (k % 2 ? 0.05 : -0.04) + rng.range(-0.05, 0.05) - (heavy ? rng.range(0, 0.12) : 0));
  for (let k = 0; k < BLADES; k++) {
    const ak = Math.PI / 2 + (k * Math.PI * 2) / BLADES;
    const place = (g) => {
      g.rotateZ(ak);
      g.translate(0, CY, 0);
      return g;
    };
    const back = k % 2 ? -0.045 : -0.035;
    const plate = slantPlate(bladeOutline, back, bladeFront);
    const tone = bladeTone[k];
    // Usure : la face plus claire vers le centre (frottée), le bord extérieur plus sombre (huile de l'anneau).
    withTone(plate, (x, y, z, nx, ny, nz) => tone + (nz > 0.5 ? 0.14 * (1 - Math.min(1, Math.hypot(x, y) / 1.5)) : -0.1));
    metal.push([place(plate), k]);
    // Bord biseauté d'un ton plus clair, le long du bord d'attaque.
    const la = new THREE.Vector2(...polar(1.5, 18 * DEG));
    const lb = new THREE.Vector2(...polar(0.32, 92 * DEG));
    const inset = new THREE.Vector2(...polar(PX * 0.5, 18 * DEG - Math.PI / 2));
    const a3 = new THREE.Vector3(la.x + inset.x, la.y + inset.y, 0);
    const b3 = new THREE.Vector3(lb.x + inset.x, lb.y + inset.y, 0);
    a3.z = bladeFront(a3.x, a3.y) + 0.004;
    b3.z = bladeFront(b3.x, b3.y) + 0.004;
    metal.push([place(withTone(beam(a3, b3, PX, 0.012, 0, new THREE.Vector3(0, 0, 1)), tone + 0.32)), k]);

    // Glyphe de la lame : 3 colonnes × 3 lignes de traits droits, couché sur la lame, « haut » vers l'extérieur.
    const runs = straightGlyphRuns(glyphRng, 3, 3);
    const cells = [];
    const gc = new THREE.Vector2(...polar(1.05, 10 * DEG));
    const radial = gc.clone().normalize();
    const tangent = new THREE.Vector2(-radial.y, radial.x);
    for (const [c, r, n] of runs) {
      const u = (c + n / 2 - 1.5) * PX, v = (1.5 - r - 0.5) * PX;
      const x = gc.x + tangent.x * u + radial.x * v, y = gc.y + tangent.y * u + radial.y * v;
      const cell = buildBlock([n * PX, PX, 0.016], [0, 0, 0]);
      cell.rotateZ(Math.atan2(tangent.y, tangent.x));
      cell.translate(x, y, bladeFront(x, y) + 0.006);
      cells.push(cell);
    }
    if (cells.length) addGlow(place(mergeToned(cells)), k, "blade", k);

    // Médaillon : un secteur de laiton par lame (le disque s'ouvre en douze), et un point de la couronne.
    const sa = 60 * DEG;
    const sector = slantPlate([[0, 0], polar(0.32, sa - 15 * DEG), polar(0.32, sa), polar(0.32, sa + 15 * DEG)], 0.08, () => 0.125);
    metal.push([place(withTone(sector, (x, y, z, nx, ny, nz) => (nz > 0.5 ? 0.34 : 0.1))), k]);
    if (k === 0) {
      // L'aiguille et le moyeu, portés par le premier secteur.
      const needle = beam(new THREE.Vector3(...polar(0.07, sa), 0.13), new THREE.Vector3(...polar(0.28, sa), 0.13), PX * 0.8, 0.012, 0, new THREE.Vector3(0, 0, 1));
      metal.push([place(withTone(needle, -0.85)), k]);
      // Moyeu : une pierre de lueur de 2 pixels, qui respire avec la couronne.
      addGlow(place(buildBlock([PX * 1.6, PX * 1.6, 0.03], [0, 0, 0.135])), k, "crown", k);
    }
    const [dx, dy] = polar(0.42, sa);
    addGlow(place(buildBlock([PX * 1.2, PX * 1.2, 0.02], [dx, dy, bladeFront(dx, dy) + 0.01])), k, "crown", k);

    pivots.push(new THREE.Vector3(...polar(1.6, ak - 18 * DEG), 0).add(new THREE.Vector3(0, CY, 0)));
  }

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const stoneMesh = new THREE.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: rng.int(0, 96), id: 20, grain: 0.06 }));
  stoneMesh.name = "stone";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);

  const metalMerged = mergeParts(metal);
  const metalMesh = new THREE.Mesh(metalMerged.geometry, metalMaterial(METALS.patinatedBronze, { id: 21, tone: true }));
  metalMesh.name = "bronze";
  metalMesh.castShadow = true;
  metalMesh.receiveShadow = true;
  group.add(metalMesh);

  const glowMerged = mergeParts(glow);
  const glowMesh = new THREE.Mesh(glowMerged.geometry, glowMixMaterial(glowLevels(p.glow), { id: 22 }));
  glowMesh.name = "glow";
  group.add(glowMesh);

  const metalRig = createRigidParts(metalMerged.geometry, metalMerged.partOf, LOCK0 + 4);
  const glowRig = createRigidParts(glowMerged.geometry, glowMerged.partOf, LOCK0 + 4);
  const shade = glowMerged.geometry.attributes.aShade;

  // Cascade : une lame de départ et un sens tirés de la graine.
  const firstBlade = rng.int(0, BLADES - 1);
  const sense = rng.chance(0.5) ? 1 : -1;
  const bladeStart = Array.from({ length: BLADES }, (_, k) => 0.24 + (((k - firstBlade) * sense + BLADES) % BLADES) * 0.042);
  const BLADE_SPAN = 0.3;

  // --- Pose : tout ce qui bouge, pour une avancée s de 0 (fermée) à 1 (ouverte) le long de la séquence.
  const center = new THREE.Vector3(0, CY, 0);
  const tmp = new THREE.Matrix4();
  const aroundZ = (m, pivot, angle) => {
    m.makeTranslation(pivot.x, pivot.y, 0);
    m.multiply(tmp.makeRotationZ(angle));
    m.multiply(tmp.makeTranslation(-pivot.x, -pivot.y, 0));
  };
  let shownPose = -1;
  const pose = (s) => {
    if (Math.abs(s - shownPose) < 1e-4) return;
    shownPose = s;
    const lockT = ease(clamp01(s / 0.11));
    const ringT = ease(clamp01((s - 0.11) / 0.12));
    for (const rig of [metalRig, glowRig]) {
      for (let k = 0; k < BLADES; k++) aroundZ(rig.matrices[k], pivots[k], OPEN_ANGLE * ease(clamp01((s - bladeStart[k]) / BLADE_SPAN)));
      aroundZ(rig.matrices[RING], center, -RING_TURN * ringT);
      locks.forEach((dir, m) => rig.matrices[LOCK0 + m].makeTranslation(dir.x * LOCK_TRAVEL * lockT, dir.y * LOCK_TRAVEL * lockT, 0));
      rig.apply();
    }
  };

  // Lueurs : niveau de chaque groupe (0 éteint à 3 vif) selon l'avancée et l'heure (respiration du médaillon).
  const levels = glowGroups.map(() => -1);
  const light = (s, time) => {
    const breath = Math.sin((time * Math.PI * 2) / 3.2) > 0.2 ? 2 : 1;
    let changed = false;
    glowGroups.forEach((g, i) => {
      let level;
      if (g.kind === "band") level = s > 0.5 ? 2 : 1;
      else if (g.kind === "frame") level = s > 0.01 + 0.2 * g.index ? 2 : 0;
      else if (g.kind === "blade") level = s > bladeStart[g.index] ? (s >= 1 ? 2 : 3) : 0;
      else level = s <= 0 ? breath : s < 0.24 ? 3 : 2; // couronne du médaillon
      if (heavy && g.kind === "frame" && g.index > 0.85) level = Math.min(level, 1); // un glyphe usé, qui reste faible
      if (level === levels[i]) return;
      levels[i] = level;
      shade.array.fill((level + 0.5) / 4, g.start, g.start + g.count);
      changed = true;
    });
    if (changed) shade.needsUpdate = true;
  };

  // --- Pilotage : l'état de départ vient du réglage ; open()/close() lancent la séquence depuis l'heure partagée.
  let tween = null;
  let cycling = p.state === "cycle";
  const door = {
    opening: { width: 2 * Math.sqrt(R_OPEN * R_OPEN - (CY - SILL) ** 2), height: CY + R_OPEN, x0: -R_OPEN, x1: R_OPEN, sill: SILL, radius: R_OPEN, center: CY },
    openness: p.state === "open" ? 1 : 0,
    get blocking() {
      return this.openness < 0.9;
    },
    open() {
      tween = { from: door.openness, to: 1, start: sharedUniforms.uTime.value };
    },
    close() {
      tween = { from: door.openness, to: 0, start: sharedUniforms.uTime.value };
    },
    setOpen(t) {
      tween = null;
      cycling = false;
      door.openness = clamp01(t);
      pose(door.openness);
      light(door.openness, sharedUniforms.uTime.value);
    },
  };
  pose(door.openness);
  light(door.openness, 0);

  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      if (tween) {
        cycling = false;
        const duration = (tween.to > tween.from ? OPEN_TIME : CLOSE_TIME) * Math.abs(tween.to - tween.from) || 1;
        const k = Math.min(1, (time - tween.start) / duration);
        door.openness = tween.from + (tween.to - tween.from) * k;
        if (k >= 1) tween = null;
      } else if (cycling) {
        // Boucle de 15 s : fermée 3 s, s'ouvre en 5,2 s, ouverte 3,6 s, se ferme en 3,2 s.
        const u = time % 15;
        door.openness = u < 3 ? 0 : u < 8.2 ? (u - 3) / OPEN_TIME : u < 11.8 ? 1 : 1 - (u - 11.8) / CLOSE_TIME;
      }
      pose(door.openness);
      light(door.openness, time);
    }
    baseUpdate(force);
  };

  group.userData.door = door;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
