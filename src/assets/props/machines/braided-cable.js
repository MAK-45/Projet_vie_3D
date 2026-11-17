// Câbles tressés du Complexe (fiches SAS-11, ETU-07, COE-14, ORA-11, docs/complexe/) : un tube de tissu goudronné,
// presque noir, terminé par des connecteurs de bronze. Quatre calibres : fin (Ø 6 cm), d'étude (Ø 12 cm, étiquettes
// claires d'un pixel), ombilical (Ø 18 cm, manchons de laiton tous les 0,8 m), principal (Ø 25 cm, colliers de bronze
// tous les 0,6 m). Trois tracés : pendu en chaînette entre deux points, posé au sol en serpentin, ou en faisceau de
// 3 à 5 câbles sanglés, l'un finissant en boucle de rangement.
// `createRoute(points, réglages)` (exporté) trace un câble par des points de passage : le monde s'en sert pour relier
// un artefact à sa console.
//
// 2 draw calls : tissu goudronné, bronze (connecteurs, manchons, colliers, sangles, étiquettes).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock } from "../../kit/geometry.js";
import { FABRICS, METALS } from "../../kit/palettes.js";
import { PX, beam, cable, mergeToned, metalMaterial, orient, ring, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const GAUGES = {
  fine: "Fin (Ø 6 cm)",
  study: "D'étude (Ø 12 cm, étiquettes)",
  umbilical: "Ombilical (Ø 18 cm, manchons de laiton)",
  main: "Principal (Ø 25 cm, colliers de bronze)",
};
const SPEC = {
  fine: { r: 0.03, sides: 4 },
  study: { r: 0.06, sides: 5 },
  umbilical: { r: 0.09, sides: 6 },
  main: { r: 0.125, sides: 8 },
};
const LAYOUTS = { hanging: "Pendu en chaînette", floor: "Posé au sol", bundle: "Faisceau au sol" };

const params = {
  seed: seedParam("Change le tracé (serpentin, flèche), le nombre de câbles du faisceau, la boucle de rangement, la place des étiquettes."),
  gauge: choiceParam("Calibre", GAUGES, "Câble fin du Sas, câble d'étude, câble ombilical de l'Oracle ou câble principal du Cœur."),
  layout: choiceParam("Tracé", LAYOUTS, "Pendu entre deux points d'accroche, posé au sol, ou faisceau de 3 à 5 câbles sanglés."),
  length: numberParam("Longueur", 3, 1, 10, "Distance entre les deux bouts.", { step: 0.5, unit: "m" }),
  height: numberParam("Accroche", 2.2, 0.6, 6, "Câble pendu : hauteur des deux points d'accroche.", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "props/machines/braided-cable",
  name: "Câbles tressés",
  nameEn: "Braided cables",
  category: "props",
  subcategory: "machines",
  description:
    "Câbles de tissu goudronné du Complexe, à connecteurs de bronze : fin, d'étude (étiquettes claires), ombilical " +
    "(manchons de laiton) ou principal (colliers de bronze) ; pendus en chaînette, posés au sol ou en faisceau sanglé " +
    "avec une boucle de rangement. Traçables par points de passage (createRoute). Fiches SAS-11, ETU-07, COE-14, ORA-11.",
  tags: [
    "câble", "câbles", "faisceau", "gaine", "tissu goudronné", "connecteur", "manchon", "étiquette", "le complexe",
    "complexe", "ancien-tech", "réseau", "instruments", "intérieur",
    "cable", "cables", "cable bundle", "braided", "tarred cloth", "connector", "sleeve", "label", "ancient complex",
    "ancient-tech", "network", "wiring", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units: "1 unité = 1 mètre ; origine au sol, au milieu du tracé ; les bouts sont en x = ±longueur/2",
  footprint: { radius: 1.9, height: 2.6 },
  animated: [],
  params,
  variants: variantsOf("layout", params.layout),
};

/** Construit les maillages de câbles qui suivent `paths` (listes de THREE.Vector3). */
function buildCables(paths, p, rng, { coil = false } = {}) {
  const { r, sides } = SPEC[p.gauge];
  const fabricParts = [];
  const bronzeParts = [];

  paths.forEach((points, index) => {
    let pts = points;
    // Boucle de rangement : le premier câble finit en une spire et demie couchée au sol.
    if (coil && index === 0) {
      const end = pts[pts.length - 1];
      const dir = new THREE.Vector3().subVectors(end, pts[pts.length - 2]).setY(0).normalize();
      const side = new THREE.Vector3(-dir.z, 0, dir.x);
      const R = 0.22 + r * 2;
      const center = end.clone().addScaledVector(side, R);
      const a0 = Math.atan2(end.z - center.z, end.x - center.x);
      pts = pts.slice(0, -1);
      for (let k = 0; k <= 18; k++) {
        const a = a0 + (k / 18) * Math.PI * 3;
        const rr = R * (1 - k * 0.012);
        pts.push(new THREE.Vector3(center.x + Math.cos(a) * rr, r + (k > 10 ? r * 1.6 : 0), center.z + Math.sin(a) * rr));
      }
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const length = curve.getLength();
    const samples = Math.max(8, Math.ceil(length / 0.12));
    const along = curve.getSpacedPoints(samples);
    fabricParts.push(withTone(cable(along, { radius: r, sides, segments: samples }), (x, y, z, nx, ny) => (ny < -0.2 ? -0.08 : 0)));

    // Connecteurs aux deux bouts (pas au bout enroulé : la boucle finit sur elle-même).
    const ends = coil && index === 0 ? [0] : [0, 1];
    for (const t of ends) {
      const at = curve.getPointAt(t);
      const tangent = curve.getTangentAt(t).multiplyScalar(t === 0 ? -1 : 1);
      const L = Math.max(0.1, r * 2.5);
      const body = buildBlock([r * 2 + PX, L, r * 2 + PX], [0, L / 2, 0]);
      bronzeParts.push(orient(body, at, tangent));
      const pin = buildBlock([r, PX * 2, r], [0, L + PX, 0]);
      bronzeParts.push(withTone(orient(pin, at, tangent), -0.2));
      bronzeParts.push(withTone(orient(ring({ radius: r, height: PX * 1.2, y: -PX, thickness: PX * 0.7, segments: Math.max(6, sides) }), at, tangent), 0.15));
    }

    // Garnitures le long du câble, selon le calibre.
    const every = p.gauge === "umbilical" ? 0.8 : p.gauge === "main" ? 0.6 : p.gauge === "study" ? 1.1 : 0;
    if (every > 0) {
      const offset = rng.range(0.2, every);
      for (let s = offset; s < length - 0.25; s += every) {
        const t = s / length;
        const at = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        if (p.gauge === "study") {
          // Étiquette : une plaquette claire d'un pixel nouée autour du câble.
          const label = buildBlock([PX * 1.6, PX * 2, PX * 0.6], [0, 0, r + PX * 0.3]);
          label.applyMatrix4(new THREE.Matrix4().lookAt(new THREE.Vector3(), tangent, new THREE.Vector3(0, 1, 0)));
          label.translate(at.x, at.y + r * 0.4, at.z);
          bronzeParts.push(withTone(label, 0.7));
        } else {
          const brass = p.gauge === "umbilical";
          const g = ring({ radius: r, height: brass ? 0.1 : PX * 2, y: brass ? -0.05 : -PX, thickness: brass ? PX * 0.9 : PX * 0.8, segments: Math.max(6, sides) });
          bronzeParts.push(withTone(orient(g, at, tangent), brass ? 0.3 : 0));
        }
      }
    }
  });
  return { fabricParts, bronzeParts };
}

function assemble(fabricParts, bronzeParts, p) {
  const group = new THREE.Group();
  group.name = meta.name;
  const fabric = new THREE.Mesh(
    mergeToned(fabricParts),
    createToonMaterial({ ramp: FABRICS.tarredLeather.ramp, ink: FABRICS.tarredLeather.ink, steps: [0.3, 0.55, 0.8], pattern: "speckle", patternParams: [16, 0.06, 0.18, 0.5], tone: true, id: 30 }),
  );
  fabric.name = "cables";
  fabric.castShadow = true;
  fabric.receiveShadow = true;
  group.add(fabric);
  if (bronzeParts.length) {
    const bronze = new THREE.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 31, tone: true }));
    bronze.name = "fittings";
    bronze.castShadow = true;
    group.add(bronze);
  }
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

/**
 * Trace un câble par des points de passage (repère de l'appelant, en mètres) : pour relier un artefact à sa console.
 * @param {Array<THREE.Vector3 | number[]>} points au moins deux points ; le câble passe par chacun
 * @param {{seed?: number, gauge?: string}} [given] calibre et graine (garnitures)
 * @returns {THREE.Group}
 */
export function createRoute(points, given = {}) {
  const p = resolveParams(meta.params, given);
  const pts = points.map((v) => (v.isVector3 ? v.clone() : new THREE.Vector3(...v)));
  const { fabricParts, bronzeParts } = buildCables([pts], p, createRng(p.seed * 104729 + 71));
  return assemble(fabricParts, bronzeParts, p);
}

/**
 * Crée le câble (ou le faisceau).
 * @param {{seed?: number, gauge?: string, layout?: string, length?: number, height?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const fittings = createRng(p.seed * 104729 + 71);
  const { r } = SPEC[p.gauge];
  const L = p.length;
  const paths = [];
  let coil = false;
  let straps = [];

  if (p.layout === "hanging") {
    const sag = L * shape.range(0.12, 0.22);
    const lean = shape.range(-0.15, 0.15); // un bout un peu plus haut que l'autre
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push(new THREE.Vector3(-L / 2 + L * t, p.height + lean * (t - 0.5) - 4 * sag * t * (1 - t), 0));
    }
    paths.push(pts);
  } else {
    // Serpentin au sol : deux ondulations de la graine.
    const a1 = shape.range(0.12, 0.3), f1 = shape.range(0.6, 1.4), ph1 = shape.range(0, 6.28);
    const a2 = shape.range(0.03, 0.1), f2 = shape.range(2, 3.5), ph2 = shape.range(0, 6.28);
    const wave = (x) => a1 * Math.sin(x * f1 + ph1) + a2 * Math.sin(x * f2 + ph2);
    const count = p.layout === "bundle" ? shape.int(3, 5) : 1;
    const gap = r * 2 + PX * 0.5;
    const steps = Math.max(8, Math.ceil(L / 0.25));
    for (let c = 0; c < count; c++) {
      const offset = (c - (count - 1) / 2) * gap;
      const jitter = shape.range(-1, 1) * 0.04;
      const pts = [];
      for (let k = 0; k <= steps; k++) {
        const x = -L / 2 + (L * k) / steps;
        const lift = c % 2 && count > 3 ? r * 0.8 : 0; // un câble à cheval sur les autres
        pts.push(new THREE.Vector3(x, r + lift, wave(x) + offset + jitter * Math.sin(x * 3 + c)));
      }
      paths.push(pts);
    }
    if (p.layout === "bundle") {
      coil = shape.chance(0.75);
      straps = [];
      for (let s = -L / 2 + 0.5; s < L / 2 - 0.4; s += 0.8) straps.push(s);
      // Sangles : un collier plat qui ceinture le faisceau.
      const width = count * gap + PX;
      for (const x of straps) {
        const z = wave(x);
        const slope = Math.atan2(wave(x + 0.05) - wave(x - 0.05), 0.1);
        const band = buildBlock([PX * 1.5, r * 2 + PX * 1.5 + (count > 3 ? r * 0.8 : 0), width], [0, 0, 0]);
        band.rotateY(-slope);
        band.translate(x, r + (count > 3 ? r * 0.4 : 0), z);
        paths.straps = paths.straps ?? [];
        paths.straps.push(band);
      }
    }
  }

  const { fabricParts, bronzeParts } = buildCables(paths, p, fittings, { coil });
  for (const band of paths.straps ?? []) fabricParts.push(withTone(band, 0.12)); // sangles de cuir, un cran plus claires
  return assemble(fabricParts, bronzeParts, p);
}
