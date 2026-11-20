// Four à bobines de l'Atelier du Complexe (fiche ATE-03, docs/complexe/) : 1,4 × 1,4 × 1,8 m. Cuve de brique
// réfractaire (rangs de briques en tons alternés, joints décalés), bobine de cuivre Ø 0,8 m en 12 spires qui
// plonge dans la cuve, creuset dans la bouche, hotte de 0,5 m par-dessus, cadran de 2 px. La bouche émissive
// orange palpite (au cran de 12 images/s) et le creuset y chauffe ; la bobine passe du cuivre terni au cuivre vif.
// Réglage `heat` : braise sourde, chaleur, pleine chaleur. La graine change l'inclinaison des spires, l'aiguille
// du cadran, le ton des briques, les coulures de suie.
//
// 3 draw calls : brique réfractaire (cuve et hotte), métal (bobine en cuivre, garnitures sombres), lueur
// orange de la bouche.

import * as THREE from "three";
import { createToonMaterial, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildQuads } from "../../kit/geometry.js";
import { METALS } from "../../kit/palettes.js";
import { PX, dial, glowMixMaterial, mergeToned, metalMaterial, plain, soot, withShade, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const HEATS = { embers: "Braise sourde", warm: "Chaleur", blaze: "Pleine chaleur" };
// Brique réfractaire : rouge-brun sale, joints sombres.
const BRICK = { ramp: ["#43262a", "#6b4038", "#8f5c46", "#b07c5c"], ink: "#2a1517" };
// Feu de la bouche : lueur orange, de l'éteint au plus vif.
const FIRE = ["#431006", "#a83a0e", "#ff7a1e", "#ffd27a"];

const params = {
  seed: seedParam("Change l'inclinaison des spires, le ton des briques, l'aiguille du cadran, les coulures de suie, les briques écaillées près de la bouche."),
  heat: choiceParam("Chaleur", HEATS, "Braise sourde : bouche à peine lisible. Chaleur : creuset lisible. Pleine chaleur : bouche vive, bobine cuivre vif."),
};

export const meta = {
  id: "props/machines/coil-furnace",
  name: "Four à bobines",
  nameEn: "Coil furnace",
  category: "props",
  subcategory: "machines",
  description:
    "Four de l'Atelier du Complexe : cuve de brique réfractaire cerclée de bronze, bobine de cuivre en douze " +
    "spires qui plonge dedans, creuset dans la bouche, hotte et cadran. La bouche émissive orange palpite ; la " +
    "chaleur monte la bobine vers le cuivre vif. Fiche ATE-03.",
  tags: [
    "four", "forge", "bobine", "cuivre", "brique réfractaire", "creuset", "hotte", "cadran", "braise",
    "le complexe", "complexe", "ancien-tech", "machine", "animé", "intérieur",
    "furnace", "coil", "copper", "refractory brick", "crucible", "hood", "gauge", "embers", "smelter",
    "ancient complex", "ancient-tech", "animated", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre de la cuve ; bouche vers +z",
  footprint: { radius: 1.0, height: 1.8 },
  animated: ["pulsing mouth"],
  params,
  variants: variantsOf("heat", params.heat),
};

/**
 * Crée le four.
 * @param {{seed?: number, heat?: string}} [given]
 * @returns {THREE.Group} `group.userData.furnace` : { heat, setHeat(niveau 0 à 2) }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 907);
  const brick = [], metal = [], glow = [];
  const heatLevel = { embers: 0, warm: 1, blaze: 2 }[p.heat];
  const coilTone = heatLevel === 2 ? 0.4 : 0.02;
  const half = 0.7;
  const brickTone = rng.range(-0.05, 0.06);
  const sootAt = soot(0.55, 1.85, -0.4);

  // Rangs de briques en tons alternés, joints décalés d'un rang à l'autre.
  const brickFace = (g, extra = 0) => withTone(g, (x, y, z, nx, ny, nz) => {
    const row = Math.floor(y / 0.09);
    const u = Math.abs(nx) > 0.5 ? z : x;
    const course = Math.abs((((u + (row % 2 ? 0.11 : 0)) + half) / 0.22) % 1 - 0.5);
    let t = brickTone + (row % 2 ? -0.05 : 0.05) + (course > 0.42 ? -0.3 : 0) + sootAt(x, y) + extra;
    if (nz > 0.5 && Math.abs(x) < 0.42 && y > 0.55) t -= 0.3; // suie au-dessus de la bouche
    return t;
  });

  // --- Cuve, bouche ébrasée sur +z ; les briques qui l'encadrent rentrent d'un cran vers le feu.
  const tank = buildBlock([2 * half, 1.2, 2 * half], [0, 0.6, 0], [0, 0, 0], { taper: 0.07 });
  brick.push(brickFace(tank, (x, y, z, nx, ny, nz) => (nz > 0.5 && Math.abs(x) < 0.26 && Math.abs(y - 0.62) < 0.19 ? -1.5 : 0)));
  // Lèvre de bronze du gueulard, cerclage au pied et deux robinets de coulée.
  metal.push(withTone(buildBlock([2 * half + 0.06, 0.05, 2 * half + 0.06], [0, 0.025, 0]), -0.45));
  metal.push(withTone(buildBlock([2 * half + 0.05, 0.04, 2 * half + 0.05], [0, 1.185, 0]), -0.4));
  for (const y of [0.28, 0.45]) {
    metal.push(withTone(plain(new THREE.CylinderGeometry(0.03, 0.04, 0.07, 6)).rotateZ(Math.PI / 2).translate(half + 0.035, y, 0), -0.3));
  }

  // --- Bobine de cuivre : 12 spires Ø 0,8 m descendues dans la cuve ; les deux montants et la traverse.
  for (let i = 0; i < 12; i++) {
    const y = 0.16 + i * 0.098;
    const r = 0.42 + rng.range(-0.006, 0.006);
    const ring = plain(new THREE.TorusGeometry(r, 0.022, 5, 16)).rotateX(Math.PI / 2).translate(0, y, 0);
    ring.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.sin(i * 1.3) * 0.02));
    metal.push(withTone(ring, (x, yy, z, nx, ny, nz) => coilTone + (ny < -0.3 ? -0.25 : 0.12) + Math.sin(i * 2.1) * 0.04));
  }
  for (const s of [-1, 1]) {
    metal.push(withTone(buildBlock([0.045, 1.25, 0.045], [s * 0.56, 0.62, -0.15], [0, 0, 0], { taper: 0.2 }), -0.25));
  }
  const crossbar = plain(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8)).rotateX(Math.PI / 2).translate(0.42, 1.19, -0.15);
  metal.push(withTone(crossbar, 0.05));

  // --- Hotte : tronc de pyramide de briques sur le gueulard, débouché sombre dessus.
  brick.push(brickFace(buildBlock([1.3, 0.5, 1.3], [0, 1.45, 0], [0, 0, 0], { taper: 0.45 }), -0.1));
  brick.push(buildQuads([{ position: [0, 1.701, 0], size: [1.24, 1.24], normal: [0, 1, 0], tone: -1 }]));

  // --- Bouche : lueur orange, encadrement en retrait, creuset posé sur une dalle en retrait.
  glow.push(buildQuads([
    { position: [0, 0.6, half + 0.004], size: [0.5, 0.37], normal: [0, 0, 1] },
  ]));
  metal.push(withTone(buildBlock([0.42, 0.05, 0.15], [0, 0.41, half - 0.03]), -0.5)); // dalle du creuset
  metal.push(withTone(buildBlock([0.06, 0.03, 0.05], [-0.25, 0.585, half - 0.02]), -0.35)); // butée de la dalle
  const crucible = plain(new THREE.CylinderGeometry(0.072, 0.058, 0.12, 10)).translate(0, 0.5, half - 0.08);
  metal.push(withTone(crucible, x => 0.15 + heatLevel * 0.08));
  const lip = plain(new THREE.TorusGeometry(0.074, 0.014, 4, 10)).rotateX(Math.PI / 2).translate(0, 0.55, half - 0.08);
  metal.push(withTone(lip, 0.25 + heatLevel * 0.1));

  // --- Cadran au-dessus de la bouche, aiguille levée selon la chaleur, à demi noirci de suie.
  const gauge = dial({ radius: 0.055, position: [0, 0.92, half + 0.004], normal: [0, 0, 1], ticks: 5, needle: -0.6 + heatLevel * 0.55, depth: PX * 0.5 });
  metal.push(withTone(gauge.face, (x, y) => 0.2 + sootAt(x, y) * 0.5));
  metal.push(withTone(gauge.marks, (x, y) => 0.35 + sootAt(x, y) * 0.5));

  // --- Maillages.
  const group = new THREE.Group();
  group.name = meta.name;
  const brickMesh = new THREE.Mesh(
    mergeToned(brick),
    createToonMaterial({ ramp: BRICK.ramp, ink: BRICK.ink, steps: [0.3, 0.52, 0.78], tone: true, crease: true, id: 20 })
  );
  brickMesh.name = "brick";
  const metalMesh = new THREE.Mesh(
    mergeToned(metal),
    metalMaterial(METALS.copper, { id: 30, tone: true, steps: [0.26, 0.42, 0.6, 0.85] })
  );
  metalMesh.name = "metal";
  const glowMesh = new THREE.Mesh(mergeToned(glow.map((g) => withShade(g, 1, 4))), glowMixMaterial(FIRE, { id: 40 }));
  glowMesh.name = "mouth";
  for (const mesh of [brickMesh, metalMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.add(glowMesh);

  // --- Palpitement : la bouche alterne son niveau de lueur au cran de 12 images/s, selon la chaleur.
  let shown = heatLevel;
  const setLevel = (v) => {
    const clamped = Math.max(0, Math.min(3, Math.round(v)));
    if (clamped === shown) return;
    shown = clamped;
    const shade = glowMesh.geometry.getAttribute("aShade");
    shade.array.fill((clamped + 0.5) / 4);
    shade.needsUpdate = true;
  };
  setLevel(heatLevel);
  const baseUpdate = group.updateMatrixWorld.bind(group);
  let last = -1;
  group.updateMatrixWorld = (force) => {
    const time = Math.floor(sharedUniforms.uTime.value * 12) / 12;
    if (time !== last) {
      const beat = Math.sin(time * (1.4 + heatLevel * 0.8)) * 0.6 + Math.sin(time * 3.7) * 0.4;
      setLevel(1 + heatLevel + beat * (0.5 + heatLevel * 0.3));
      last = time;
    }
    baseUpdate(force);
  };

  const furnace = {
    heat: heatLevel,
    setHeat(v) {
      furnace.heat = Math.max(0, Math.min(2, v));
      setLevel(1 + furnace.heat);
    },
  };
  group.userData.furnace = furnace;
  group.userData.asset = { id: meta.id, params: p };
  return group;
}
