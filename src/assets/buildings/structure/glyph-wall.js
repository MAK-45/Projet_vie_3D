// Module de mur du Complexe (fiche SAS-02, docs/complexe/PIECES.md ; tous les murs du lieu) : un pan de basalte de
// 2 m sur 0,6 m d'épaisseur, en blocs appareillés aux joints d'un pixel, la suie qui monte vers le haut, et à 1,10 m
// le bandeau creusé où brille une ligne de glyphes ambre à traits droits. Variantes : plein, avec niche, avec
// conduit encastré (tuyau de cuivre) ; hauteur de 4 à 14 m, largeur réglable, cintré pour les salles rondes,
// doublé de cuivre (salle de la Cassette).
//
// 2 draw calls (3 avec le cuivre) : pierre (tons par sommet), lueur des glyphes, cuivre.

import * as THREE from "three";
import { buildBlock } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import {
  PX, bendAroundY, buildMasonry, glowMaterial, glyphStrip, mergeToned, metalMaterial, ring, rivetRow, stoneMaterial, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, glowParam, numberParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const DEPTH = 0.6;
const BAND = { y0: 1.0, y1: 1.25 }; // assise du bandeau : glyphes de 2 px centrés à 1,10 m
const VARIANTS = { plain: "Plein", niche: "Avec niche", conduit: "Avec conduit encastré" };
const LININGS = { stone: "Pierre nue", copper: "Doublage de cuivre" };
const GLYPHS = { lit: "Allumés", dim: "En veille", off: "Éteints" };
const LEVELS = { lit: 2, dim: 1, off: 0 };

const params = {
  seed: seedParam("Change l'appareil (hauteur des assises, longueur des blocs, tons), les glyphes du bandeau, la place de la niche ou du conduit."),
  variant: choiceParam("Forme", VARIANTS, "Plein, avec une niche de 0,6 × 1,2 m, ou avec un conduit vertical où passe un tuyau de cuivre."),
  height: numberParam("Hauteur", 5, 4, 14, "Hauteur du mur (5 m dans le Sas, jusqu'à 14 m dans les grandes salles).", { step: 0.5, unit: "m" }),
  width: numberParam("Largeur", 2, 1, 4, "Largeur du module (2 m sur la grille du Complexe).", { step: 0.5, unit: "m" }),
  curve: numberParam("Cintrage", 0, 0, 20, "Rayon de la salle ronde où le mur s'inscrit, face vers le centre ; 0 = droit.", { step: 0.5, unit: "m" }),
  lining: choiceParam("Parement", LININGS, "Pierre nue, ou doublage de plaques de cuivre rivetées (salle de la Cassette)."),
  glyphs: choiceParam("Glyphes", GLYPHS, "Le bandeau de glyphes : allumé, en veille (lueur faible) ou éteint."),
  glow: glowParam("Couleur des glyphes (ambre partout ; cyan près des artefacts ; rouge en alerte)."),
  stone: stoneParam("Pierre du mur.", { only: ["blackBasalt", "smoked"] }),
};

export const meta = {
  id: "buildings/structure/glyph-wall",
  name: "Mur à bandeau de glyphes",
  nameEn: "Glyph band wall",
  category: "buildings",
  subcategory: "structure",
  description:
    "Module de mur du Complexe : basalte en blocs appareillés, suie vers le haut, bandeau creusé à 1,10 m où " +
    "s'allume une ligne de glyphes ambre à traits droits. Plein, à niche ou à conduit encastré ; de 4 à 14 m de " +
    "haut ; droit ou cintré pour les salles rondes ; nu ou doublé de cuivre. Fiche SAS-02.",
  tags: [
    "mur", "muraille", "basalte", "glyphes", "bandeau", "niche", "conduit", "tuyau", "cuivre", "salle ronde", "le complexe",
    "complexe", "ancien-tech", "modulaire", "grille de 2 m", "lumineux", "intérieur",
    "wall", "basalt", "glyphs", "glyph band", "wall niche", "duct", "pipe", "copper", "curved wall", "ancient complex",
    "ancient-tech", "modular", "2 m grid", "glowing", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units:
    "1 unité = 1 mètre ; origine au sol, au milieu du mur ; le mur suit l'axe x, la face appareillée (bandeau, " +
    "niche) regarde +z ; cintré, le centre de la salle est en z = +rayon",
  footprint: { radius: 1.05, height: 5 },
  animated: [],
  params,
  variants: variantsOf("variant", params.variant),
};

/**
 * Crée le module de mur.
 * @param {{seed?: number, variant?: string, height?: number, width?: number, curve?: number, lining?: string,
 *   glyphs?: string, glow?: string, stone?: string}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const layout = createRng(p.seed * 7919 + 17);
  const masonryRng = createRng(p.seed * 104729 + 71);
  const glyphRng = createRng(p.seed * 15485863 + 3);
  const W = p.width, H = p.height;
  const front = DEPTH / 2;
  const curved = p.curve > 0;
  const copper = p.lining === "copper";

  // --- Ouvertures : niche (au-dessus du bandeau) ou conduit (toute la hauteur).
  const holes = [];
  const snapX = (x) => Math.round(x / PX) * PX;
  if (p.variant === "niche") {
    const x = snapX(layout.range(-(W - 0.9) / 2, (W - 0.9) / 2) * 0.6);
    holes.push({ x0: x - 0.3, x1: x + 0.3, y0: 1.5, y1: 2.7, depth: 0.3 });
  } else if (p.variant === "conduit") {
    const x = snapX(layout.range(-(W - 0.7) / 2, (W - 0.7) / 2) * 0.7);
    holes.push({ x0: x - 0.16, x1: x + 0.16, y0: 0, y1: H, depth: 0.24 });
  }

  // --- Pierre : appareil, bandeau creusé, fond de niche ou de conduit.
  const masonry = buildMasonry(masonryRng, {
    width: W, height: H, depth: DEPTH, holes, band: BAND, split: curved ? 0.5 : Infinity, facing: !copper,
  });
  const stoneParts = masonry.parts;
  const metalParts = [];
  const glowParts = [];

  for (const h of holes) {
    if (p.variant === "niche") {
      // Appui : une tablette qui déborde d'un pixel sous la niche, un cran plus claire (usée par les mains).
      stoneParts.push(withTone(buildBlock([h.x1 - h.x0 + PX * 2, PX * 1.5, h.depth + PX], [(h.x0 + h.x1) / 2, h.y0 + PX * 0.75, front - h.depth / 2 + PX / 2]), 0.12));
    } else {
      // Conduit : tuyau de cuivre de 0,12 m, colliers de bronze tous les 0,5 m (dans la même matière).
      const cx = (h.x0 + h.x1) / 2, cz = front - h.depth / 2;
      for (let y = 0; y < H - 0.01; y += 0.5) {
        const len = Math.min(0.5, H - y);
        const pipe = new THREE.CylinderGeometry(0.06, 0.06, len, 6, 1, true);
        pipe.deleteAttribute("uv");
        pipe.translate(cx, y + len / 2, cz);
        // Coulures vertes : un pan sur deux d'un cran plus sombre, au hasard.
        const streak = layout.range(-0.5, 0.5); // coulure verte : un pan plus sombre, d'un tronçon à l'autre
        metalParts.push(withTone(pipe, (x, yy, z, nx, ny, nz) => (Math.abs(Math.atan2(nx, nz) - streak) < 0.6 ? -0.28 : 0)));
        const collar = ring({ radius: 0.06, height: PX * 1.5, y: y + 0.2, thickness: PX * 0.6, segments: 6 });
        collar.translate(cx, 0, cz);
        metalParts.push(withTone(collar, 0.2));
      }
    }
  }

  // --- Doublage de cuivre : plaques de 1 m (une par assise du bandeau en bas, une au-dessus), rivets aux bords.
  if (copper) {
    const z0 = masonry.coreFace, z1 = front;
    const spans = (y) => {
      let list = [[-W / 2, W / 2]];
      for (const h of holes) {
        if (y < h.y0 || y > h.y1) continue;
        list = list.flatMap(([a, b]) => (h.x1 <= a || h.x0 >= b ? [[a, b]] : [...(h.x0 > a ? [[a, h.x0]] : []), ...(h.x1 < b ? [[h.x1, b]] : [])]));
      }
      return list;
    };
    const rows = [[0, BAND.y0], [BAND.y1, Math.min(H, BAND.y1 + 2.2)], [Math.min(H, BAND.y1 + 2.2), H]].filter(([a, b]) => b - a > 0.2);
    const plates = (a, b, ya, yb) => {
      const n = Math.max(1, Math.round((b - a) / 1));
      for (let k = 0; k < n; k++) {
        const xa = a + ((b - a) * k) / n + PX / 2, xb = a + ((b - a) * (k + 1)) / n - PX / 2;
        if (xb - xa < 0.05 || yb - ya < 0.1) continue;
        const plate = buildBlock([xb - xa, yb - ya - PX, z1 - z0], [(xa + xb) / 2, (ya + yb) / 2, (z0 + z1) / 2]);
        metalParts.push(withTone(plate, layout.range(-0.12, 0.08) + (yb > H * 0.6 ? -0.1 : 0)));
        for (const yy of [ya + PX * 1.5, yb - PX * 1.5]) {
          metalParts.push(withTone(rivetRow([xa + 0.08, yy, z1], [xb - 0.08, yy, z1], { spacing: 0.2 }), 0.35));
        }
      }
    };
    for (const [y0, y1] of rows) {
      for (const [a, b] of spans((y0 + y1) / 2)) plates(a, b, y0, y1);
      // Une niche prise dans la rangée : des plaques au-dessus et au-dessous d'elle.
      for (const h of holes) {
        if (h.depth == null || h.y0 <= y0 || h.y1 >= y1) continue;
        plates(h.x0, h.x1, y0, h.y0);
        plates(h.x0, h.x1, h.y1, y1);
      }
    }
  }

  // --- Glyphes : une ligne de 2 px dans le bandeau creusé, coupée par les ouvertures.
  let bandSpans = [[-W / 2, W / 2]];
  for (const h of holes) {
    const y = (BAND.y0 + BAND.y1) / 2;
    if (y < h.y0 || y > h.y1) continue;
    bandSpans = bandSpans.flatMap(([a, b]) => (h.x1 <= a || h.x0 >= b ? [[a, b]] : [...(h.x0 > a ? [[a, h.x0]] : []), ...(h.x1 < b ? [[h.x1, b]] : [])]));
  }
  for (const [a, b] of bandSpans) {
    if (b - a < 0.3) continue;
    const strip = glyphStrip(glyphRng, { length: b - a - 0.16, rows: 2 });
    strip.translate((a + b) / 2, 1.1 - PX, masonry.bandFace);
    glowParts.push(strip);
  }

  const group = new THREE.Group();
  group.name = meta.name;
  const bend = (g) => (curved ? bendAroundY(g, p.curve, { concave: true }) : g);

  const stoneMesh = new THREE.Mesh(bend(mergeToned(stoneParts)), stoneMaterial(stone, { seed: layout.int(0, 96), id: 20, grain: 0.06 }));
  stoneMesh.name = "wall";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  group.add(stoneMesh);

  if (glowParts.length) {
    const glyphs = new THREE.Mesh(bend(mergeToned(glowParts)), glowMaterial(p.glow, { level: LEVELS[p.glyphs], id: 21 }));
    glyphs.name = "glyphs";
    group.add(glyphs);
  }

  if (metalParts.length) {
    const metal = new THREE.Mesh(bend(mergeToned(metalParts)), metalMaterial(METALS.oxidizedCopper, { id: 22, tone: true }));
    metal.name = copper ? "copper-lining" : "pipe";
    metal.castShadow = true;
    metal.receiveShadow = true;
    group.add(metal);
  }

  group.userData.asset = { id: meta.id, params: p };
  return group;
}
