// Portes du Complexe (docs/complexe/PIECES.md : porte standard, GAL-02, GAL-13, ORA-07, issue de secours de la salle
// du Cœur) : un module de mur de basalte percé d'une baie haute, un chambranle de pierre plus claire où court une
// ligne de glyphes, et un ou deux vantaux de bronze qui pivotent sur leurs charnières.
// - standard : 1,40 × 2,80 m (volontairement haute), vantail à panneaux, anneau de tirage ;
// - étude : la même avec un hublot rond à 1,6 m, une plaque numérotée (1 à 5 traits), un voyant au-dessus ;
// - double : grande porte de 3,0 × 5,0 m à deux battants, cinq charnières et trois verrous par battant, anneaux ;
// - liaison : la double, gravée d'un grand glyphe propre à chaque salle (graine), voyant à 3 m ;
// - secours : vantail de fonte à barre de poussée, voyant rouge.
// Elle s'ouvre (vers −z, l'arrière) : réglage `state` (fermée, ouverte, en boucle) et pilotage par le scénario ou le
// monde avec `group.userData.door` (open(), close(), setOpen(t), openness, blocking).
//
// 3 draw calls : pierre (mur et chambranle, tons par sommet), métal des vantaux (les deux battants dans un seul
// maillage, tournés sur le CPU à 12 images/s pendant le mouvement), lueurs (glyphes, voyant).

import * as THREE from "three";
import { sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import {
  PX, bulb, buildMasonry, glowMixMaterial, glyphStrip, mergeToned, metalMaterial, ring, rivetRow, stoneMaterial,
  straightGlyphRuns, withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const DEPTH = 0.6;
const BAND = { y0: 1.0, y1: 1.25 }; // même assise de bandeau que le mur : les lignes de glyphes se raccordent
const MODELS = {
  standard: "Porte standard",
  study: "Porte d'étude (hublot, voyant)",
  double: "Grande porte à deux battants",
  link: "Grande porte de liaison (gravée)",
  emergency: "Issue de secours",
};
const SPECS = {
  standard: { w: 1.4, h: 2.8, module: 2, leaves: 1 },
  study: { w: 1.4, h: 2.8, module: 2, leaves: 1 },
  emergency: { w: 1.4, h: 2.8, module: 2, leaves: 1 },
  double: { w: 3.0, h: 5.0, module: 4, leaves: 2 },
  link: { w: 3.0, h: 5.0, module: 4, leaves: 2 },
};
const STATES = { closed: "Fermée", open: "Ouverte", cycle: "S'ouvre et se ferme en boucle" };
const GLYPHS = { lit: "Allumés", dim: "En veille", off: "Éteints" };
const LEVELS = { lit: 2, dim: 1, off: 0 };
const SWING = 1.4; // durée d'une ouverture ou d'une fermeture (s)

const params = {
  seed: seedParam("Change l'appareil du mur, les glyphes du chambranle, les tons des panneaux, la gravure de la porte de liaison."),
  model: choiceParam("Modèle", MODELS, "Standard (1,4 × 2,8 m), d'étude (hublot, plaque, voyant), grande porte double ou de liaison (3 × 5 m), issue de secours."),
  state: choiceParam("État", STATES, "Fermée, ouverte, ou qui s'ouvre et se ferme en boucle (pour la regarder). Pilotable : group.userData.door."),
  number: { type: "int", default: 1, min: 1, max: 5, label: "Numéro", description: "Porte d'étude : le numéro de la salle, en traits sur la plaque (1 à 5)." },
  light: choiceParam("Voyant", { auto: "Selon le modèle", amber: "Ambre", alarm: "Rouge d'alerte", cyan: "Cyan" }, "Couleur du voyant (portes d'étude, de liaison, de secours) ; « selon le modèle » : rouge pour l'issue de secours, ambre sinon."),
  glyphs: choiceParam("Glyphes", GLYPHS, "La ligne de glyphes du chambranle et du bandeau : allumée, en veille ou éteinte."),
  height: numberParam("Hauteur du mur", 5, 4, 8, "Hauteur du module de mur autour de la porte (au moins 5,7 m pour une grande porte).", { step: 0.5, unit: "m" }),
  stone: stoneParam("Pierre du mur et du chambranle.", { only: ["blackBasalt", "smoked"] }),
};

export const meta = {
  id: "buildings/structure/complex-door",
  name: "Porte du Complexe",
  nameEn: "Ancient complex door",
  category: "buildings",
  subcategory: "structure",
  description:
    "Module de mur percé d'une porte haute du Complexe : chambranle de pierre à glyphes, vantaux de bronze à panneaux " +
    "qui pivotent sur leurs charnières. Porte standard, d'étude (hublot, plaque numérotée, voyant), grande porte à " +
    "deux battants, porte de liaison gravée, issue de secours en fonte. Fermée, ouverte, ou pilotée par le scénario.",
  tags: [
    "porte", "vantail", "battants", "grande porte", "hublot", "voyant", "chambranle", "bronze", "glyphes", "issue de secours",
    "le complexe", "complexe", "ancien-tech", "modulaire", "animé", "pilotable", "intérieur",
    "door", "door leaf", "double door", "porthole", "status light", "door frame", "glyphs", "emergency exit",
    "ancient complex", "ancient-tech", "modular", "animated", "scriptable", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units:
    "1 unité = 1 mètre ; origine au sol, au milieu de la baie ; le mur suit l'axe x (2 m de large, 4 m pour les " +
    "grandes portes), face avant en +z ; les vantaux s'ouvrent vers −z",
  footprint: { radius: 2.15, height: 5.7 },
  animated: ["door", "glow"],
  params,
  variants: variantsOf("model", params.model),
};

/**
 * Crée la porte dans son module de mur.
 * @param {{seed?: number, model?: string, state?: string, number?: number, light?: string, glyphs?: string,
 *   height?: number, stone?: string}} [given]
 * @returns {THREE.Group} `group.userData.door` : { open(), close(), setOpen(t), openness, blocking, opening }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const spec = SPECS[p.model];
  const stone = STONES[p.stone];
  const layout = createRng(p.seed * 7919 + 17);
  const masonryRng = createRng(p.seed * 104729 + 71);
  const glyphRng = createRng(p.seed * 15485863 + 3);
  const W = spec.module;
  const H = Math.max(p.height, spec.h + 0.7);
  const ow = spec.w, oh = spec.h;
  const jamb = 0.2, lintel = 0.3;
  const fw = ow + jamb * 2, fh = oh + lintel;
  const front = DEPTH / 2;
  const big = spec.leaves === 2;
  const level = LEVELS[p.glyphs];

  // --- Mur : appareil percé d'une baie de la taille du chambranle.
  const masonry = buildMasonry(masonryRng, {
    width: W, height: H, depth: DEPTH, band: BAND, holes: [{ x0: -fw / 2, x1: fw / 2, y0: 0, y1: fh }],
  });
  const stoneParts = masonry.parts;
  const glowParts = [];

  // Chambranle : pierre un cran plus claire, qui déborde d'un demi-pixel devant et derrière.
  const frameTone = (x, y) => 0.14 + (y > H * 0.55 ? -0.18 * Math.min(1, (y - H * 0.55) / (H * 0.45)) : 0);
  const fd = DEPTH + 0.06;
  for (const s of [-1, 1]) stoneParts.push(withTone(buildBlock([jamb, oh, fd], [s * (ow / 2 + jamb / 2), oh / 2, 0]), frameTone));
  stoneParts.push(withTone(buildBlock([fw + 0.08, lintel, fd + 0.02], [0, oh + lintel / 2, 0]), frameTone));
  stoneParts.push(withTone(buildBlock([ow, PX * 1.2, DEPTH], [0, PX * 0.6, 0]), -0.05)); // seuil

  // Glyphes : bandeau du mur de part et d'autre, ligne du linteau (sauf l'issue de secours).
  for (const s of [-1, 1]) {
    const a = s < 0 ? -W / 2 : fw / 2, b = s < 0 ? -fw / 2 : W / 2;
    if (b - a < 0.3) continue;
    const strip = glyphStrip(glyphRng, { length: b - a - 0.12, rows: 2 });
    strip.translate((a + b) / 2, 1.1 - PX, masonry.bandFace);
    glowParts.push(withShade(strip, 0));
  }
  if (p.model !== "emergency") {
    const strip = glyphStrip(glyphRng, { length: fw - 0.3, rows: 2 });
    strip.translate(0, oh + lintel / 2 - PX, fd / 2 + 0.01);
    glowParts.push(withShade(strip, 0));
  }

  // Voyant : au-dessus de la porte (étude, secours), ou à 3 m sur le chambranle (liaison).
  if (p.model === "study" || p.model === "emergency" || p.model === "link") {
    const at = p.model === "link" ? [ow / 2 + jamb / 2, 3.0, fd / 2 + 0.05] : [0, fh + 0.16, front + 0.06];
    stoneParts.push(withTone(buildBlock([0.2, 0.2, 0.1], [at[0], at[1], at[2] - 0.05]), 0.05));
    glowParts.push(withShade(bulb({ radius: PX * 1.2, position: at }), 1));
  }

  // --- Vantaux : construits fermés, dans le plan z = 0 ; chaque sommet sait à quel battant il appartient.
  const metal = p.model === "emergency" ? METALS.castIron : METALS.patinatedBronze;
  const thick = big ? 0.14 : 0.1;
  const leafW = ow / spec.leaves - 0.01;
  const leafH = oh - 0.02;
  const pivots = [];
  const leafGeometries = [];
  const motif = big ? straightGlyphRuns(createRng(p.seed * 31 + 7), 5, 7) : null;

  for (let k = 0; k < spec.leaves; k++) {
    const dir = k === 0 ? 1 : -1; // le battant s'étend de son pivot vers le centre
    const px = k === 0 ? -ow / 2 : ow / 2;
    pivots.push({ x: px, sign: dir });
    const cx = px + (dir * leafW) / 2;
    const parts = [];
    const panelTone = layout.range(-0.06, 0.06);
    parts.push(withTone(buildBlock([leafW, leafH, thick], [cx, 0.01 + leafH / 2, 0]), panelTone));

    // Panneaux en creux (un cran plus sombres), sur les deux faces ; montants rivetés.
    const rows = big ? 3 : 2;
    const margin = big ? 0.2 : 0.14;
    const ph = (leafH - margin * 2 - (rows - 1) * margin * 0.6) / rows;
    // Porte d'étude : un panneau sous la plaque, un au-dessus du hublot ; ailleurs des panneaux réguliers.
    const panels = p.model === "study"
      ? [[margin, 1.2], [1.86, leafH - margin]]
      : Array.from({ length: rows }, (_, r) => [margin + r * (ph + margin * 0.6), margin + r * (ph + margin * 0.6) + ph]);
    for (const [y0, y1] of panels) {
      for (const face of [1, -1]) {
        parts.push(withTone(buildBlock([leafW - margin * 2, y1 - y0, PX * 0.3], [cx, (y0 + y1) / 2, face * (thick / 2 + PX * 0.15)]), panelTone - 0.24));
      }
    }
    for (const face of [1, -1]) {
      for (const ex of [cx - leafW / 2 + margin / 2, cx + leafW / 2 - margin / 2]) {
        parts.push(withTone(rivetRow([ex, 0.15, face * (thick / 2 + PX * 0.2)], [ex, leafH - 0.15, face * (thick / 2 + PX * 0.2)], { spacing: big ? 0.35 : 0.3, normal: [0, 0, face] }), 0.3));
      }
    }

    // Charnières sur le bord du pivot.
    const hinges = big ? 5 : 3;
    for (let i = 0; i < hinges; i++) {
      const y = 0.3 + ((leafH - 0.6) * i) / (hinges - 1);
      parts.push(withTone(buildBlock([0.1, big ? 0.24 : 0.16, thick + 0.06], [px + dir * 0.04, y, 0]), 0.18));
    }

    // Anneau de tirage (ou barre de poussée), sur les deux faces, près du bord libre.
    const freeX = px + dir * (leafW - (big ? 0.35 : 0.18));
    if (p.model === "emergency") {
      for (const face of [1, -1]) {
        parts.push(withTone(buildBlock([leafW - 0.3, 0.08, 0.05], [cx, 1.0, face * (thick / 2 + 0.05)]), 0.25));
        for (const ex of [cx - leafW / 2 + 0.2, cx + leafW / 2 - 0.2]) parts.push(withTone(buildBlock([0.05, 0.08, 0.05], [ex, 1.0, face * (thick / 2 + 0.025)]), 0.1));
      }
    } else {
      const rr = big ? 0.17 : 0.07;
      for (const face of [1, -1]) {
        const loop = ring({ radius: rr, height: PX * 0.8, thickness: PX, segments: big ? 12 : 8 });
        loop.rotateX(Math.PI / 2);
        loop.translate(freeX, (big ? 1.2 : 1.05) - rr, face * (thick / 2 + PX * 0.5));
        parts.push(withTone(loop, 0.2));
        parts.push(withTone(buildBlock([0.08, 0.08, PX], [freeX, big ? 1.2 : 1.05, face * (thick / 2 + PX * 0.5)]), 0.05));
      }
    }

    if (p.model === "study") {
      // Hublot de 5 px à 1,6 m : cerclage, verre épais très sombre, un reflet d'un pixel.
      const hx = cx, hy = 1.6;
      const rim = ring({ radius: 0.15, height: thick + 0.04, thickness: PX, segments: 12 });
      rim.rotateX(Math.PI / 2);
      rim.translate(hx, hy, (thick + 0.04) / 2);
      parts.push(withTone(rim, 0.2));
      const glass = new THREE.CylinderGeometry(0.15, 0.15, thick + 0.01, 12);
      glass.deleteAttribute("uv");
      glass.rotateX(Math.PI / 2);
      glass.translate(hx, hy, 0);
      parts.push(withTone(glass, -0.8));
      for (const face of [1, -1]) parts.push(withTone(buildBlock([PX, PX, 0.004], [hx - 0.06, hy + 0.06, face * ((thick + 0.01) / 2)]), 0.9));
      // Plaque numérotée : 1 à 5 traits gravés.
      const plate = buildBlock([0.26, 0.14, PX * 0.4], [hx, 1.33, thick / 2 + PX * 0.2]);
      parts.push(withTone(plate, 0.28));
      for (let i = 0; i < p.number; i++) {
        const x = hx + (i - (p.number - 1) / 2) * PX * 2;
        parts.push(withTone(buildBlock([PX, 0.08, 0.004], [x, 1.33, thick / 2 + PX * 0.4]), -0.9));
      }
    }

    if (big) {
      // Trois verrous par battant, le long du bord libre.
      for (const y of [0.45, leafH / 2, leafH - 0.45]) {
        for (const face of [1, -1]) parts.push(withTone(buildBlock([0.06, 0.42, 0.04], [px + dir * (leafW - 0.09), y, face * (thick / 2 + 0.02)]), 0.12));
      }
      // Liaison : un grand glyphe gravé (5 × 7 pixels de 0,12 m), en miroir sur les deux battants.
      if (p.model === "link") {
        const cell = 0.12;
        for (const [c, r, n] of motif) {
          const x0 = (c + n / 2) * cell; // depuis le bord libre, vers le pivot
          const xx = px + dir * (leafW - 0.25 - x0);
          const yy = 2.1 + (6 - r) * cell + cell / 2;
          for (const face of [1, -1]) parts.push(withTone(buildBlock([n * cell - PX, cell - PX, PX * 0.4], [xx, yy, face * (thick / 2 + PX * 0.2)]), -0.55));
        }
      }
    }
    leafGeometries.push(mergeToned(parts));
  }

  const counts = leafGeometries.map((g) => g.attributes.position.count);
  const leafGeometry = mergeToned(leafGeometries);

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const wall = new THREE.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: layout.int(0, 96), id: 20, grain: 0.06 }));
  wall.name = "wall";
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  const leaves = new THREE.Mesh(leafGeometry, metalMaterial(metal, { id: 21, tone: true }));
  leaves.name = "leaves";
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  group.add(leaves);

  const light = p.light === "auto" ? (p.model === "emergency" ? "alarm" : "amber") : p.light;
  const glow = new THREE.Mesh(mergeToned(glowParts), glowMixMaterial([["amber", level], [light, 3]], { id: 22 }));
  glow.name = "glow";
  group.add(glow);

  // --- Ouverture : rotation des sommets de chaque battant autour de son pivot (vertical, en x = pivot, z = 0).
  const position = leafGeometry.attributes.position;
  const normal = leafGeometry.attributes.normal;
  const basePosition = position.array.slice();
  const baseNormal = normal.array.slice();
  const leafOf = new Uint8Array(position.count);
  let offset = 0;
  counts.forEach((count, k) => {
    leafOf.fill(k, offset, offset + count);
    offset += count;
  });
  let shown = -1;
  const pose = (t) => {
    if (Math.abs(t - shown) < 1e-4) return;
    shown = t;
    const theta = (Math.PI / 2) * 0.96 * t;
    const cs = pivots.map(({ sign }) => [Math.cos(theta * sign), Math.sin(theta * sign)]);
    for (let i = 0; i < position.count; i++) {
      const [c, s] = cs[leafOf[i]];
      const px = pivots[leafOf[i]].x;
      const x = basePosition[i * 3] - px, z = basePosition[i * 3 + 2];
      position.array[i * 3] = px + x * c + z * s;
      position.array[i * 3 + 2] = -x * s + z * c;
      const nx = baseNormal[i * 3], nz = baseNormal[i * 3 + 2];
      normal.array[i * 3] = nx * c + nz * s;
      normal.array[i * 3 + 2] = -nx * s + nz * c;
    }
    position.needsUpdate = true;
    normal.needsUpdate = true;
    leafGeometry.computeBoundingSphere();
  };
  const ease = (t) => t * t * (3 - 2 * t);

  // Pilotage : l'état de départ vient du réglage ; open()/close() lancent le mouvement depuis l'heure partagée.
  const door = {
    opening: { width: ow, height: oh, x0: -ow / 2, x1: ow / 2 },
    openness: p.state === "open" ? 1 : 0,
    get blocking() {
      return this.openness < 0.85;
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
      door.openness = THREE.MathUtils.clamp(t, 0, 1);
      pose(ease(door.openness));
    },
  };
  let tween = null;
  let cycling = p.state === "cycle";
  pose(ease(door.openness));

  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      if (tween) {
        cycling = false;
        const k = Math.min(1, (time - tween.start) / (SWING * Math.abs(tween.to - tween.from) || 1));
        door.openness = tween.from + (tween.to - tween.from) * k;
        if (k >= 1) tween = null;
      } else if (cycling) {
        // Boucle de 6 s : fermée, s'ouvre, ouverte, se ferme.
        const u = (time % 6) / 6;
        door.openness = u < 0.25 ? 0 : u < 0.5 ? (u - 0.25) * 4 : u < 0.75 ? 1 : 1 - (u - 0.75) * 4;
      }
      pose(ease(door.openness));
    }
    baseUpdate(force);
  };

  group.userData.door = door;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
