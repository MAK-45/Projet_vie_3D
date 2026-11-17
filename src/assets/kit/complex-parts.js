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
 * géométrie, ou une fonction (x, y, z, nx, ny, nz) => ton évaluée à chaque sommet (suie qui monte, usure au centre,
 * une face sur deux d'un fût cannelé). Les tons s'ajoutent à un ton déjà posé.
 */
export function withTone(geometry, tone) {
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  const old = geometry.attributes.aTone;
  const array = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const t = typeof tone === "function" ? tone(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)) : tone;
    array[i] = t + (old ? old.getX(i) : 0);
  }
  geometry.setAttribute("aTone", new THREE.BufferAttribute(array, 1));
  return geometry;
}

/** Fusionne des géométries dont certaines portent un ton (`aTone`) ou une teinte (`aShade`) : les autres reçoivent 0. */
export function mergeToned(geometries) {
  for (const name of ["aTone", "aShade"]) {
    if (!geometries.some((g) => g.attributes[name])) continue;
    for (const g of geometries) {
      if (!g.attributes[name]) g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(g.attributes.position.count), 1));
    }
  }
  return mergeGeometries(geometries);
}

/**
 * Pose sur toute une géométrie la couleur n° `index` (0, 1, 2...) d'un `glowMixMaterial` à `count` couleurs
 * (attribut `aShade`).
 */
export function withShade(geometry, index, count = 2) {
  const array = new Float32Array(geometry.attributes.position.count).fill((index + 0.5) / count);
  geometry.setAttribute("aShade", new THREE.BufferAttribute(array, 1));
  return geometry;
}

/**
 * Cintre une géométrie autour de l'axe vertical : x devient un arc de rayon `radius` (longueur conservée), z la
 * distance au mur. `concave` (mur d'une salle ronde, face +z tournée vers le centre) : le centre est en z = +radius ;
 * sinon (fût, objet rond) le centre est l'origine et z pousse vers l'extérieur. Les pièces doivent être assez
 * courtes (≤ 0,5 m) pour que leurs faces suivent la courbe.
 */
export function bendAroundY(geometry, radius, { concave = true } = {}) {
  const p = geometry.attributes.position;
  const n = geometry.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const theta = p.getX(i) / radius;
    const c = Math.cos(theta), s = Math.sin(theta);
    const r = concave ? radius - p.getZ(i) : radius + p.getZ(i);
    if (concave) p.setXYZ(i, s * r, p.getY(i), radius - c * r);
    else p.setXYZ(i, s * r, p.getY(i), c * r);
    if (n) {
      const nx = n.getX(i), nz = n.getZ(i);
      // Rotation de la normale du même angle que la tangente (−θ autour de y, mur concave ou fût).
      n.setXYZ(i, nx * c + nz * s, n.getY(i), -nx * s + nz * c);
    }
  }
  p.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Fût cannelé : prisme vertical à `flutes` cannelures en creux (un sommet sur deux rentré de `depth`), de `y0` à
 * `y1`, de rayon `radius`. Faces planes : la lumière prend chaque pan différemment, ce qui dessine les cannelures.
 * `arc` [a0, a1] (radians, 0 = +z) : seulement une partie du tour (demi-colonne engagée), refermée par un plat.
 */
export function fluteShaft({ radius, flutes = 16, depth = PX, y0 = 0, y1 = 1, arc = null }) {
  const outline = [];
  const full = !arc;
  const [a0, a1] = arc ?? [0, Math.PI * 2];
  const count = full ? flutes * 2 : Math.max(2, Math.round((flutes * 2 * (a1 - a0)) / (Math.PI * 2)));
  for (let i = 0; i < count + (full ? 0 : 1); i++) {
    const a = a0 + ((a1 - a0) * i) / count;
    const r = i % 2 ? radius - depth : radius;
    outline.push([Math.sin(a) * r, Math.cos(a) * r]);
  }
  const positions = [];
  const normals = [];
  const index = [];
  const quad = (a, b, c, d, nx, ny, nz) => {
    const first = positions.length / 3;
    for (const v of [a, b, c, d]) positions.push(...v), normals.push(nx, ny, nz);
    index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  };
  const m = outline.length;
  const edges = full ? m : m - 1;
  for (let i = 0; i < edges; i++) {
    const [x1, z1] = outline[i];
    const [x2, z2] = outline[(i + 1) % m];
    const len = Math.hypot(x2 - x1, z2 - z1) || 1;
    // Normale extérieure du pan.
    const nx = -(z2 - z1) / len, nz = (x2 - x1) / len;
    quad([x1, y0, z1], [x2, y0, z2], [x2, y1, z2], [x1, y1, z1], nx, 0, nz);
  }
  if (!full) {
    // Le plat contre le mur, entre les deux bouts de l'arc.
    const [xa, za] = outline[m - 1];
    const [xb, zb] = outline[0];
    const len = Math.hypot(xb - xa, zb - za) || 1;
    quad([xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za], -(zb - za) / len, 0, (xb - xa) / len);
  }
  // Dessus et dessous en éventail depuis le centre (le contour est étoilé autour de lui).
  for (const [y, ny] of [[y1, 1], [y0, -1]]) {
    const center = positions.length / 3;
    positions.push(0, y, full ? 0 : (outline[0][1] + outline[m - 1][1]) / 2), normals.push(0, ny, 0);
    for (const [x, z] of outline) positions.push(x, y, z), normals.push(0, ny, 0);
    for (let i = 0; i < (full ? m : m - 1); i++) {
      const a = center + 1 + i, b = center + 1 + ((i + 1) % m);
      if (ny > 0) index.push(center, a, b);
      else index.push(center, b, a);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(normals), 3));
  geometry.setIndex(index);
  return geometry;
}

// --- Maçonnerie -------------------------------------------------------------------------------------------------

const snap = (v) => Math.round(v / PX) * PX;

/**
 * Pan de mur en blocs de pierre appareillés : assises de hauteur et blocs de longueur tirés de la graine, joints
 * d'un pixel plus sombres (le cœur du mur, en retrait, se voit entre les blocs), suie en haut, ton propre à chaque
 * bloc. Le mur suit l'axe x (de −width/2 à +width/2), du sol à `height`, épaisseur `depth` centrée sur z = 0 ; la
 * face appareillée est en +z (le dos est lisse, sauf `bothSides`).
 *
 * @param {object} rng générateur (createRng)
 * @param {object} o
 * @param {number} o.width
 * @param {number} o.height
 * @param {number} [o.depth]
 * @param {Array<{x0:number,x1:number,y0:number,y1:number}>} [o.holes] ouvertures (porte, niche, conduit) : traversent
 *   le mur, sauf `depth` donné dans le trou (niche : profondeur en m depuis la face avant)
 * @param {{y0:number,y1:number}} [o.band] assise du bandeau : creusée d'un pixel, sans joints (les glyphes y sont posés)
 * @param {number[]} [o.course] hauteur d'une assise [min, max]
 * @param {number[]} [o.block] longueur d'un bloc [min, max]
 * @param {boolean} [o.bothSides] appareiller aussi le dos
 * @param {boolean} [o.facing] faux : pas de blocs devant (le cœur seul, en retrait : un doublage de métal s'y pose)
 * @param {number} [o.soot] force de la suie en haut du mur (ton, négatif)
 * @param {number} [o.split] longueur maximale d'une pièce (pour cintrer le mur ensuite)
 * @returns {{parts: THREE.BufferGeometry[], courses: number[], bandFace: number}} géométries tonées de la pierre ;
 *   `courses` : hauteurs des joints d'assise ; `bandFace` : z de la face creusée du bandeau
 */
export function buildMasonry(rng, o) {
  const {
    width, height, depth = 0.6, holes = [], band = null,
    course = [0.42, 0.66], block = [0.5, 1.1], bothSides = false, soot: sootAmount = -0.24, split = Infinity,
    facing = true,
  } = o;
  const relief = 0.09; // saillie des blocs sur le cœur : le joint fait un pixel et demi de profondeur
  const front = depth / 2;
  const core = front - relief;
  const back = -depth / 2;
  const backCore = bothSides ? back + relief : back;
  const sootAt = soot(height * 0.55, height, sootAmount);
  const parts = [];

  // Hauteurs d'assise : bornes imposées (bandeau, haut et bas des ouvertures), comblées d'assises régulières.
  const fixed = new Set([0, snap(height)]);
  if (band) fixed.add(snap(band.y0)).add(snap(band.y1));
  for (const h of holes) {
    if (h.y0 > 0.01) fixed.add(snap(h.y0));
    if (h.y1 < height - 0.01) fixed.add(snap(h.y1));
  }
  const bounds = [...fixed].filter((y) => y >= 0 && y <= height + 1e-6).sort((a, b) => a - b);
  const courses = [0];
  for (let i = 0; i < bounds.length - 1; i++) {
    const gap = bounds[i + 1] - bounds[i];
    const n = Math.max(1, Math.round(gap / rng.range(course[0], course[1])));
    for (let k = 1; k <= n; k++) courses.push(k === n ? bounds[i + 1] : snap(bounds[i] + (gap * k) / n));
  }

  const box = (x0, x1, y0, y1, z0, z1, tone) => {
    // Coupée en morceaux de `split` au plus (cintrage).
    const n = Math.max(1, Math.ceil((x1 - x0) / split - 1e-6));
    for (let k = 0; k < n; k++) {
      const a = x0 + ((x1 - x0) * k) / n, b = x0 + ((x1 - x0) * (k + 1)) / n;
      const g = buildBlock([b - a, y1 - y0, z1 - z0], [(a + b) / 2, (y0 + y1) / 2, (z0 + z1) / 2]);
      parts.push(withTone(g, (x, y, z) => tone + sootAt(x, y)));
    }
  };

  for (let c = 0; c < courses.length - 1; c++) {
    const y0 = courses[c], y1 = courses[c + 1];
    const mid = (y0 + y1) / 2;
    const isBand = band && Math.abs(y0 - snap(band.y0)) < 1e-6 && Math.abs(y1 - snap(band.y1)) < 1e-6;
    // Intervalles en x de cette assise, ouvertures retirées.
    let spans = [[-width / 2, width / 2]];
    const cut = [];
    for (const h of holes) {
      if (mid < h.y0 || mid > h.y1) continue;
      cut.push(h);
      spans = spans.flatMap(([a, b]) => {
        if (h.x1 <= a || h.x0 >= b) return [[a, b]];
        const out = [];
        if (h.x0 > a) out.push([a, h.x0]);
        if (h.x1 < b) out.push([h.x1, b]);
        return out;
      });
    }
    // Fond des niches : le cœur continue derrière, en retrait de la profondeur de la niche.
    for (const h of cut) {
      if (h.depth == null) continue;
      box(h.x0, h.x1, y0, y1, backCore, front - h.depth, -0.32);
    }
    for (const [a, b] of spans) {
      if (b - a < 1e-3) continue;
      if (isBand) {
        // Bandeau : une seule pierre creusée d'un pixel, un cran plus sombre.
        box(a, b, y0, y1, back, front - PX, -0.12);
        continue;
      }
      box(a, b, y0, y1, backCore, core, -0.34); // cœur : sa face avant fait les joints
      if (!facing) continue;
      let x = a;
      while (b - x > 1e-3) {
        let len = rng.range(block[0], block[1]);
        if (b - (x + len) < block[0] * 0.6) len = b - x; // pas de chute trop courte en bout d'assise
        const x1 = Math.min(b, snap(x + len) || b);
        const end = x1 <= x ? b : x1;
        const tone = rng.range(-0.08, 0.08);
        box(x + PX / 2, end - PX / 2, y0 + PX / 2, y1 - PX / 2, core - 0.01, front, tone);
        if (bothSides) box(x + PX / 2, end - PX / 2, y0 + PX / 2, y1 - PX / 2, back, backCore + 0.01, rng.range(-0.08, 0.08));
        x = end;
      }
    }
  }
  return { parts, courses, bandFace: front - PX, coreFace: core };
}

/**
 * Lueurs à plusieurs couleurs dans un seul maillage (un seul draw call) : chaque pièce dit sa couleur avec
 * `withShade(géométrie, n°, nombre de couleurs)`. Chaque couleur est une entrée `[nom GLOWS, niveau 0..3]`. Garde son
 * éclat dans le noir, sans contour.
 */
export function glowMixMaterial(colors, { id = 40 } = {}) {
  const ramp = colors.map(([name, level]) => {
    const r = (GLOWS[name] ?? GLOWS.amber).ramp;
    return r[Math.max(0, Math.min(r.length - 1, Math.round(level)))];
  });
  if (ramp.length === 1) ramp.push(ramp[0]);
  const steps = ramp.slice(1).map((_, i) => (i + 1) / ramp.length);
  return createToonMaterial({ ramp, steps, unlit: true, shade: true, emissive: 0.001, glow: false, outline: false, id });
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
export function faceMatrix(position, normal, spin = 0) {
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
 * aiguille, à dessiner d'un ton contrasté ou en lueur). `needle` : angle de l'aiguille (radians, 0 = midi) ; `null` :
 * pas d'aiguille (l'asset la dessine et l'anime lui-même).
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
  if (needle !== null) marks.push(buildBlock([PX * 0.45, l, PX * 0.3], [(Math.sin(needle) * l) / 2, (Math.cos(needle) * l) / 2, depth + PX * 0.2], [0, 0, -needle]));
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
export function metalMaterial(entry, { id = 30, crease = true, grain = 0, seed = 0, tone = false, steps } = {}) {
  const five = entry.ramp.length === 5;
  return createToonMaterial({
    ramp: entry.ramp,
    ink: entry.ink,
    steps: steps ?? (five ? [0.28, 0.46, 0.68, 0.9] : [0.3, 0.52, 0.76]),
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

// --- Pièces orientées, lumières qui vivent ------------------------------------------------------------------------

/** Tourne une géométrie construite autour de l'axe +y pour qu'elle suive `direction`, puis la pose en `position`. */
export function orient(geometry, position, direction) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), toVector(direction).clone().normalize());
  geometry.applyQuaternion(q);
  const p = toVector(position);
  geometry.translate(p.x, p.y, p.z);
  return geometry;
}

const hash2 = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Scintillement par paliers d'ampoules à filament, dans un maillage de lueurs `glowMixMaterial` à 4 couleurs (les
 * niveaux 0 à 3 d'une rampe GLOWS) : chaque ampoule occupe une plage de sommets et a son niveau de base (0 éteinte,
 * 1 faible, 2 allumée) ; de temps en temps elle baisse d'un cran ou s'avive. Rend `update(temps)` : à appeler quand
 * le temps partagé change (12 images/s) ; rend vrai si un niveau a changé.
 * @param {THREE.BufferGeometry} geometry géométrie qui porte `aShade`
 * @param {Array<{start: number, count: number, base: number, phase: number}>} bulbs
 */
export function createFlicker(geometry, bulbs) {
  const shade = geometry.attributes.aShade;
  const current = bulbs.map(() => -1);
  const update = (time) => {
    let changed = false;
    bulbs.forEach((b, i) => {
      let level = b.base;
      if (b.base > 0) {
        // Paliers lents (≈ 4 par seconde), décalés d'une ampoule à l'autre ; une baisse brève est plus rare qu'un éclat.
        const r = hash2(Math.floor(time * 4 + b.phase * 13), b.phase * 91 + i);
        if (r < 0.07) level = b.base - 1;
        else if (r > 0.86) level = Math.min(3, b.base + 1);
      }
      if (level === current[i]) return;
      current[i] = level;
      changed = true;
      shade.array.fill((level + 0.5) / 4, b.start, b.start + b.count);
    });
    if (changed) shade.needsUpdate = true;
    return changed;
  };
  update(0);
  return update;
}

/** Les quatre niveaux (0 éteint à 3 vif) d'une lueur GLOWS, pour `glowMixMaterial` et `createFlicker`. */
export function glowLevels(name) {
  return [0, 1, 2, 3].map((level) => [name, level]);
}
