// Briques du Complexe (docs/complexe/README.md) : les petits morceaux techniques que tous ses assets partagent, à
// l'échelle du pixel d'art (16 px/m au zoom 1, donc 1 px = 6,25 cm).
//
// - Glyphes : bande de « lettres » à traits droits (l'alphabet du Complexe) ou à courbes (celui des artefacts).
// - Rivets en pointillé, bagues, ampoules, cadrans, leviers, chaînes, câbles.
// - Tons par sommet (`withTone`, attribut `aTone` du matériau toon) : la suie en haut des volumes, le ton propre à
//   chaque bloc de pierre, l'usure ; c'est ainsi que le Complexe vieillit sans texture.
// - Matériaux de base : pierre, métal, lueur, réglés une fois pour tout le Complexe.
//
// Toutes les fonctions de géométrie rendent des géométries indexées à deux attributs (position, normal), donc
// fusionnables entre elles et avec `buildBlock` / `buildLathe` / `buildPrism` (kit/geometry.js) ; `mergeToned`
// ajoute le ton là où il manque avant de fusionner.

import * as THREE from "three";
import { createToonMaterial } from "../../engine/toon-material.js";
import { buildBlock, buildLathe, buildTube, mergeGeometries } from "./geometry.js";
import { GLOWS } from "./palettes.js";

/** Un pixel d'art au zoom 1, en mètres. */
export const PX = 1 / 16;

// --- Géométrie : outils ---------------------------------------------------------------------------------------

/** Ne garde que position et normal, et indexe la géométrie si elle ne l'est pas (fusion avec les blocs du kit). */
export function plain(geometry) {
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== "position" && name !== "normal") geometry.deleteAttribute(name);
  }
  if (!geometry.index) {
    const count = geometry.attributes.position.count;
    const index = count > 65535 ? new Uint32Array(count) : new Uint16Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
  }
  geometry.clearGroups();
  return geometry;
}

/**
 * Pose l'attribut `aTone` (décalage de lumière, voir `createToonMaterial({ tone: true })`) : un nombre pour toute la
 * géométrie, ou une fonction (x, y, z) => ton évaluée à chaque sommet (suie qui monte, usure au centre).
 * Les tons s'ajoutent à un ton déjà posé.
 */
export function withTone(geometry, tone) {
  const p = geometry.attributes.position;
  const old = geometry.attributes.aTone;
  const array = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const t = typeof tone === "function" ? tone(p.getX(i), p.getY(i), p.getZ(i)) : tone;
    array[i] = t + (old ? old.getX(i) : 0);
  }
  geometry.setAttribute("aTone", new THREE.BufferAttribute(array, 1));
  return geometry;
}

/** Fusionne des géométries dont certaines portent un ton : les autres reçoivent un ton nul. */
export function mergeToned(geometries) {
  const toned = geometries.some((g) => g.attributes.aTone);
  if (toned) for (const g of geometries) if (!g.attributes.aTone) withTone(g, 0);
  return mergeGeometries(geometries);
}

/** Suie : 0 jusqu'à `from` (m), puis de plus en plus sombre jusqu'à `amount` (négatif) à `to`. */
export function soot(from, to, amount = -0.22) {
  return (x, y) => amount * THREE.MathUtils.smoothstep(y, from, to);
}

const toVector = (v) => (v?.isVector3 ? v : new THREE.Vector3(...(v ?? [0, 0, 0])));

/** Bloc orienté le long d'un segment a → b, de section `w` × `h` (h selon `up`), avec un tour `roll` sur l'axe. */
export function beam(a, b, w, h = w, roll = 0, up = new THREE.Vector3(0, 1, 0)) {
  a = toVector(a);
  b = toVector(b);
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  dir.normalize();
  const geometry = buildBlock([w, h, length]);
  const side = new THREE.Vector3().crossVectors(Math.abs(dir.dot(up)) > 0.99 ? new THREE.Vector3(1, 0, 0) : up, dir).normalize();
  const top = new THREE.Vector3().crossVectors(dir, side);
  const basis = new THREE.Matrix4().makeBasis(side, top, dir);
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationZ(roll));
  geometry.applyMatrix4(basis);
  geometry.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return geometry;
}

// --- Glyphes ----------------------------------------------------------------------------------------------------

/**
 * Dessine les cellules d'une bande de glyphes à traits droits : des « lettres » de 1 à 3 colonnes sur `rows` lignes,
 * faites de segments horizontaux et verticaux d'un pixel, séparées d'une colonne vide (deux entre deux « mots »).
 * Rend la liste des segments [colonne, ligne, longueur] (horizontaux) dans une grille de `columns` colonnes.
 */
export function straightGlyphRuns(rng, columns, rows = 2) {
  const grid = Array.from({ length: rows }, () => new Uint8Array(columns));
  let col = rng.int(0, 1);
  while (col < columns) {
    const width = Math.min(rng.pick([1, 2, 2, 3, 3]), columns - col);
    const cells = Array.from({ length: rows }, () => new Uint8Array(width));
    // Un trait vertical (souvent), puis des traits horizontaux sur des lignes tirées au sort.
    if (width === 1 || rng.next() < 0.7) {
      const c = rng.int(0, width - 1);
      const from = rows > 2 ? rng.int(0, 1) : 0;
      const to = rows > 2 ? rows - 1 - rng.int(0, 1) : rows - 1;
      for (let r = from; r <= to; r++) cells[r][c] = 1;
    }
    for (let r = 0; r < rows; r++) {
      if (width > 1 && rng.next() < 0.5) {
        const a = rng.int(0, width - 2);
        const b = rng.int(a + 1, width - 1);
        for (let c = a; c <= b; c++) cells[r][c] = 1;
      }
    }
    let filled = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < width; c++) filled += cells[r][c];
    if (filled === 0) cells[rng.int(0, rows - 1)][rng.int(0, width - 1)] = 1;
    // Une lettre pleine se lit comme une tache : on y perce un pixel.
    if (filled === rows * width && filled > 2) cells[rng.int(0, rows - 1)][rng.int(0, width - 1)] = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < width; c++) grid[r][col + c] = cells[r][c];
    col += width + (rng.next() < 0.18 ? 2 : 1);
  }
  const runs = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < columns) {
      if (!grid[r][c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < columns && grid[r][c]) c++;
      runs.push([start, r, c - start]);
    }
  }
  return runs;
}

/**
 * Bande de glyphes en relief, posée dans le plan xy, face vers +z : de x = −length/2 à +length/2, de y = 0 à
 * rows × `pixel`, épaisseur `depth` (de z = 0 à z = depth). Le style « straight » est l'alphabet du Complexe ;
 * « curved » celui des artefacts (points, anneaux, arcs, spirales). Rend une géométrie (à poser avec une lueur).
 * @param {{next: () => number, int: Function, pick: Function}} rng
 * @param {object} options
 * @param {number} options.length longueur de la bande (m)
 * @param {number} [options.rows] hauteur en pixels (2 = bandeau de 0,12 m)
 * @param {"straight"|"curved"} [options.style]
 * @param {number} [options.pixel] taille d'un pixel de glyphe (m) ; PX par défaut, moins pour un petit objet
 * @param {number} [options.depth] saillie (m)
 */
export function glyphStrip(rng, { length, rows = 2, style = "straight", pixel = PX, depth = 0.012 }) {
  const parts = [];
  if (style === "straight") {
    const columns = Math.max(1, Math.floor(length / pixel));
    const x0 = -(columns * pixel) / 2;
    for (const [c, r, n] of straightGlyphRuns(rng, columns, rows)) {
      parts.push(buildBlock([n * pixel, pixel, depth], [x0 + (c + n / 2) * pixel, (r + 0.5) * pixel, depth / 2]));
    }
  } else {
    // Courbes : chaque signe tient dans un carré de `rows` pixels, tracé en petits segments.
    const size = rows * pixel;
    const count = Math.max(1, Math.floor(length / (size + pixel)));
    const x0 = -(count * (size + pixel)) / 2 + (size + pixel) / 2;
    const w = pixel * 0.75;
    const seg = (ax, ay, bx, by) => {
      parts.push(beam([ax, ay, depth / 2], [bx, by, depth / 2], w, depth, 0, new THREE.Vector3(0, 0, 1)));
    };
    for (let i = 0; i < count; i++) {
      const cx = x0 + i * (size + pixel);
      const cy = size / 2;
      const kind = rng.pick(["dot", "ring", "arc", "arc", "spiral"]);
      const radius = size / 2 - w / 2;
      if (kind === "dot") {
        parts.push(buildBlock([pixel, pixel, depth], [cx, cy, depth / 2], [0, 0, Math.PI / 4]));
        continue;
      }
      const turns = kind === "spiral" ? 1.6 : kind === "ring" ? 1 : 0.5;
      const steps = Math.max(5, Math.round(10 * turns));
      const start = rng.next() * Math.PI * 2;
      let px = null, py = null;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const a = start + t * turns * Math.PI * 2;
        const r = kind === "spiral" ? radius * (0.2 + 0.8 * t) : radius;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (px !== null) seg(px, py, x, y);
        px = x;
        py = y;
      }
      if (kind === "arc") parts.push(buildBlock([pixel * 0.8, pixel * 0.8, depth], [cx, cy, depth / 2]));
    }
  }
  if (parts.length === 0) parts.push(buildBlock([pixel, pixel, depth], [0, pixel / 2, depth / 2]));
  return mergeGeometries(parts);
}

// --- Petites pièces ---------------------------------------------------------------------------------------------

/** Rivets : rangée de petits plots d'un pixel entre `from` et `to`, espacés d'environ `spacing`. */
export function rivetRow(from, to, { spacing = 0.25, size = PX, depth = PX * 0.6, normal = [0, 0, 1] } = {}) {
  from = toVector(from);
  to = toVector(to);
  const n = toVector(normal).normalize();
  const count = Math.max(1, Math.round(from.distanceTo(to) / spacing) + 1);
  const parts = [];
  const point = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    point.lerpVectors(from, to, count === 1 ? 0.5 : i / (count - 1));
    const a = point.clone().addScaledVector(n, -depth / 2);
    const b = point.clone().addScaledVector(n, depth / 2);
    parts.push(beam(a, b, size, size));
  }
  return mergeGeometries(parts);
}

/** Bague autour d'un fût vertical rond : anneau de rayon intérieur `radius`, de `height` de haut à partir de `y`. */
export function ring({ radius, height = 2 * PX, y = 0, thickness = PX, segments = 16, facets = true }) {
  return buildLathe(
    [[radius, y], [radius + thickness, y], [radius + thickness, y + height], [radius, y + height]],
    { segments, facets },
  );
}

/** Bague autour d'un fût carré de côté `size` : quatre plats, de `height` de haut à partir de `y`. */
export function squareRing({ size, height = 2 * PX, y = 0, thickness = PX }) {
  const s = size / 2 + thickness / 2;
  const L = size + thickness * 2;
  return mergeGeometries([
    buildBlock([L, height, thickness], [0, y + height / 2, s]),
    buildBlock([L, height, thickness], [0, y + height / 2, -s]),
    buildBlock([thickness, height, size], [s, y + height / 2, 0]),
    buildBlock([thickness, height, size], [-s, y + height / 2, 0]),
  ]);
}

/** Ampoule : boule basse définition (lisible de 2 à 4 px), centrée en `position`. */
export function bulb({ radius = PX, position = [0, 0, 0], segments = 6 } = {}) {
  const geometry = plain(new THREE.SphereGeometry(radius, segments, Math.max(3, segments - 2)));
  const p = toVector(position);
  geometry.translate(p.x, p.y, p.z);
  return geometry;
}

/** Repère local d'une pièce posée sur une face : origine `position`, face tournée vers `normal`, `spin` autour d'elle. */
function faceMatrix(position, normal, spin = 0) {
  const z = toVector(normal).clone().normalize();
  const up = Math.abs(z.y) > 0.99 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.multiply(new THREE.Matrix4().makeRotationZ(spin));
  m.setPosition(toVector(position));
  return m;
}

/**
 * Cadran rond posé sur une face : `face` (le disque, en laiton ou en verre) et `marks` (repères tout autour et
 * aiguille, à dessiner d'un ton contrasté ou en lueur). `needle` : angle de l'aiguille (radians, 0 = midi).
 */
export function dial({ radius = 2 * PX, position = [0, 0, 0], normal = [0, 0, 1], ticks = 8, needle = 0, depth = PX * 0.5 } = {}) {
  const m = faceMatrix(position, normal);
  const disc = plain(new THREE.CylinderGeometry(radius, radius, depth, Math.max(8, ticks * 2)));
  disc.rotateX(Math.PI / 2);
  disc.translate(0, 0, depth / 2);
  disc.applyMatrix4(m);
  const marks = [];
  const tick = Math.max(PX * 0.5, radius * 0.22);
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2;
    const r = radius - tick / 2;
    marks.push(buildBlock([tick * 0.6, tick, PX * 0.3], [Math.sin(a) * r, Math.cos(a) * r, depth + PX * 0.15], [0, 0, -a]));
  }
  const l = radius * 0.8;
  marks.push(buildBlock([PX * 0.45, l, PX * 0.3], [(Math.sin(needle) * l) / 2, (Math.cos(needle) * l) / 2, depth + PX * 0.2], [0, 0, -needle]));
  const markGeometry = mergeGeometries(marks);
  markGeometry.applyMatrix4(m);
  return { face: disc, marks: markGeometry };
}

/**
 * Levier : `rod` (tige et pivot) et `knob` (pommeau), tourné de `angle` (radians, 0 = tige droite vers le haut de la
 * face, positif = abaissé vers l'avant). Pivot en `position` sur une face tournée vers `normal`.
 */
export function lever({ length = 4 * PX, angle = 0, position = [0, 0, 0], normal = [0, 0, 1], width = PX * 0.7 } = {}) {
  const m = faceMatrix(position, normal);
  const tip = new THREE.Vector3(0, Math.cos(angle) * length, Math.sin(angle) * length + PX * 0.5);
  const rod = mergeGeometries([
    buildBlock([PX * 1.6, PX * 1.2, PX * 0.8], [0, 0, PX * 0.4]),
    beam([0, 0, PX * 0.5], tip, width, width),
  ]);
  rod.applyMatrix4(m);
  const knob = bulb({ radius: PX * 0.9, position: tip, segments: 6 });
  knob.applyMatrix4(m);
  return { rod, knob };
}

/**
 * Chaîne qui pend de `from` à `to` (flèche `sag` en m) : maillons alternés d'un pixel, chacun tourné d'un quart de
 * tour sur le précédent ; la lumière les prend un sur deux, ce qui dessine le pointillé.
 */
export function chain(from, to, { sag = 0.1, link = 0.07, width = PX * 0.8 } = {}) {
  from = toVector(from);
  to = toVector(to);
  const count = Math.max(2, Math.round(from.distanceTo(to) / link));
  const at = (t) => new THREE.Vector3().lerpVectors(from, to, t).add(new THREE.Vector3(0, -4 * sag * t * (1 - t), 0));
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = at(i / count), b = at((i + 1) / count);
    parts.push(beam(a, b, width, width * 0.5, i % 2 ? Math.PI / 4 : -Math.PI / 4));
  }
  return mergeGeometries(parts);
}

/** Câble (tube facetté) qui passe par `points` ; `radius` d'un demi-pixel par défaut (câble de 6 cm). */
export function cable(points, { radius = PX / 2, sides = 4, segments } = {}) {
  const pts = points.map(toVector);
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += pts[i].distanceTo(pts[i - 1]);
  return plain(buildTube(pts, () => radius, { radialSegments: sides, lengthSegments: segments ?? Math.max(4, Math.ceil(length / 0.25)) }));
}

// --- Matériaux --------------------------------------------------------------------------------------------------

/**
 * Pierre du Complexe (basalte, pierre fumée) : grain fin, arêtes claires (écaillures), tons par sommet.
 * `entry` : une entrée de palette { ramp, ink }.
 */
export function stoneMaterial(entry, { seed = 0, id = 20, grain = 0.06, crease = true } = {}) {
  return createToonMaterial({
    ramp: entry.ramp,
    ink: entry.ink,
    steps: entry.ramp.length === 5 ? [0.3, 0.5, 0.7, 0.9] : [0.32, 0.54, 0.78],
    pattern: "speckle",
    patternParams: [16, grain, 0.2, 1],
    seed,
    crease,
    tone: true,
    id,
  });
}

/**
 * Métal du Complexe (bronze patiné, laiton noirci, cuivre oxydé, fonte) : rampe de 4 ou 5 tons ; avec 5, le dernier
 * ne sort que sur les faces les plus éclairées (arête polie, reflet d'un pixel).
 */
export function metalMaterial(entry, { id = 30, crease = true, grain = 0, seed = 0, tone = false } = {}) {
  const five = entry.ramp.length === 5;
  return createToonMaterial({
    ramp: entry.ramp,
    ink: entry.ink,
    steps: five ? [0.28, 0.46, 0.68, 0.9] : [0.3, 0.52, 0.76],
    pattern: grain > 0 ? "speckle" : "none",
    patternParams: [16, grain, 0.18, 0.5],
    seed,
    crease,
    tone,
    id,
  });
}

/**
 * Lueur : matière qui émet sa propre lumière (glyphes, filaments, voyants), d'un seul ton de la rampe GLOWS
 * (`level` 0 = éteinte à 3 = vive), qui garde son éclat dans le noir. Sans contour : un glyphe d'un pixel serait
 * mangé par son trait d'encre.
 */
export function glowMaterial(name = "amber", { level = 2, id = 40 } = {}) {
  const ramp = (GLOWS[name] ?? GLOWS.amber).ramp;
  const color = ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(level)))];
  return createToonMaterial({
    ramp: [color, color],
    steps: [0.5],
    unlit: true,
    emissive: level > 0 ? 0.01 : 0,
    glow: false,
    outline: false,
    id,
  });
}
