// Enclumes du Complexe (fiches ATE-04 et E4-01, docs/complexe/).
// - Sur souche (Atelier) : enclume de fonte de 0,75 × 0,25 × 0,45 m, table polie au plus clair, bec en cône, talon
//   avec son trou carré d'un pixel, pied évasé à quatre pattes ; posée sur une souche de Ø 0,5 × 0,6 m fendue d'un trait
//   sombre et cerclée de deux cercles de fer, cernes clairs sur le dessus. Un marteau appuyé contre la souche (graine).
// - Bloc d'essai (salle 4) : bloc d'acier gris de 0,6 × 0,6 × 0,5 m, dessus marqué de coups, sur une dalle de pierre de
//   1,2 × 1,2 × 0,4 m ; 8 capteurs piézo (points de quartz clair) sur le pourtour, et leurs câbles fins qui se
//   rejoignent en bouquet et partent vers une console.
// La graine change l'orientation de l'enclume, la hauteur et les cernes de la souche, la fente, les écaillures, le
// marteau ; pour le bloc, les marques de coups et le départ du bouquet de câbles.
//
// 2 draw calls (bois, fonte) ou 3 (pierre, acier, quartz et câbles).

import * as THREE from "three";
import { createToonMaterial } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe, buildPrism, buildQuads } from "../../kit/geometry.js";
import { GLASSES, METALS, STONES, WOODS } from "../../kit/palettes.js";
import {
  PX, beam, cable, gridBlock, mergeToned, metalMaterial, plain, ring, stoneMaterial, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const KINDS = {
  stump: "Enclume sur souche (Atelier)",
  "test-block": "Bloc d'essai (salle 4, capteurs)",
};

const params = {
  seed: seedParam("Change l'orientation de l'enclume, la souche (hauteur, cernes, fente), les écaillures, le marteau ; pour le bloc, les marques de coups et le bouquet de câbles."),
  kind: choiceParam("Modèle", KINDS, "Enclume de forge sur sa souche, ou bloc d'enclume d'essai sur dalle, bardé de capteurs (salle 4)."),
};

export const meta = {
  id: "props/tools/anvil",
  name: "Enclume",
  nameEn: "Anvil",
  category: "props",
  subcategory: "tools",
  description:
    "Enclume du Complexe : enclume de fonte à bec et talon, table polie, trou carré, posée sur une souche fendue " +
    "cerclée de fer (Atelier) ; ou bloc d'acier d'essai sur dalle de pierre, bardé de 8 capteurs de quartz dont les " +
    "câbles fins partent en bouquet (salle 4). Fiches ATE-04, E4-01.",
  tags: [
    "enclume", "souche", "bec", "talon", "table", "trou carré", "fonte", "cercles de fer", "marteau", "bloc d'essai",
    "acier", "capteurs", "quartz", "câbles", "dalle", "forge", "atelier", "le complexe", "complexe", "ancien-tech",
    "outil", "intérieur",
    "anvil", "stump", "horn", "heel", "face", "hardy hole", "cast iron", "iron hoops", "hammer", "test block", "steel",
    "sensors", "quartz crystal", "cables", "stone slab", "smithy", "workshop", "ancient complex", "ancient-tech", "tool",
    "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-20",
  units: "1 unité = 1 mètre ; origine au sol, au centre de la souche (ou de la dalle) ; le bec de l'enclume pointe vers +x avant la rotation de la graine",
  footprint: { radius: 1.05, height: 1.05 },
  animated: [],
  params,
  variants: [
    { id: "stump", name: "Sur souche", params: {} },
    { id: "test-block", name: "Bloc d'essai", params: { kind: "test-block" } },
  ],
};

/**
 * Crée l'enclume.
 * @param {{seed?: number, kind?: string}} [given]
 * @returns {THREE.Group} `group.userData.strike` : point de frappe sur le dessus (repère de l'asset), pour le marteau
 *   d'un personnage ; `group.userData.surface` : { y, size }
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const rng = createRng(p.seed * 7919 + 449);
  const group = new THREE.Group();
  group.name = meta.name;
  if (p.kind === "test-block") buildTestBlock(group, rng, p);
  else buildStump(group, rng, p);
  group.userData.asset = { id: meta.id, params: p };
  return group;
}

/** Le corps de l'enclume (fonte), pied au sol en y = 0, bec vers +x. Rend { parts, top } (dessus de la table). */
function anvilBody(rng) {
  const parts = [];
  const iron = (top, side) => (x, y, z, nx, ny) => (ny > 0.5 ? top : ny < -0.5 ? -0.35 : side);
  // Pied évasé : une semelle et quatre pattes basses aux angles.
  parts.push(withTone(buildBlock([0.34, 0.06, 0.22], [-0.02, 0.03, 0]), iron(-0.1, -0.15)));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(withTone(buildBlock([0.08, 0.05, 0.06], [-0.02 + sx * 0.15, 0.025, sz * 0.12]), -0.2));
  // Taille : un tronc qui se resserre vers le haut.
  parts.push(withTone(buildBlock([0.26, 0.28, 0.16], [-0.02, 0.2, 0], [0, 0, 0], { taper: 0.3 }), iron(0, -0.05)));
  // Table : le corps du haut, 0,5 m de long, dessus poli (au plus clair) quadrillé pour les écaillures.
  const top = 0.45;
  const face = gridBlock([0.5, 0.13, 0.14], [-0.05, top - 0.065, 0], { cell: 0.06 });
  const chips = Array.from({ length: rng.int(1, 3) }, () => [rng.range(-0.28, 0.18), rng.chance(0.5) ? 0.07 : -0.07]);
  parts.push(withTone(face, (x, y, z, nx, ny) => {
    if (ny > 0.5) return 0.42 + (Math.abs(x + 0.05) < 0.12 ? 0.08 : 0);
    let t = ny < -0.5 ? -0.35 : 0.0;
    for (const [cx, cz] of chips) if (Math.abs(x - cx) < 0.04 && Math.sign(z) === Math.sign(cz) && y > top - 0.03) t += 0.3; // arête écaillée claire
    return t;
  }));
  // Marche (le « plat » entre table et bec), un cran plus bas, et le bec en cône vers +x.
  parts.push(withTone(buildBlock([0.08, 0.1, 0.12], [0.24, top - 0.07, 0]), iron(0.15, -0.02)));
  const horn = buildLathe([[0, 0], [0.065, 0], [0.004, 0.22], [0, 0.22]], { segments: 6, facets: true, start: Math.PI / 6 });
  horn.rotateZ(-Math.PI / 2).translate(0.28, top - 0.065, 0);
  parts.push(withTone(horn, (x, y, z, nx, ny) => (ny > 0.4 ? 0.28 : -0.05)));
  // Talon : le bout −x s'amincit ; trou carré (hardy) et petit trou rond, sombres, sur le dessus.
  parts.push(withTone(buildBlock([0.06, 0.08, 0.1], [-0.33, top - 0.04, 0]), iron(0.35, -0.02)));
  parts.push(buildQuads([
    { position: [-0.24, top + 0.0015, 0], size: [PX * 0.9, PX * 0.9], normal: [0, 1, 0], tone: -1.1 },
    { position: [-0.16, top + 0.0015, 0.0], size: [PX * 0.5, PX * 0.5], normal: [0, 1, 0], tone: -1.0 },
  ]));
  return { parts, top };
}

function buildStump(group, rng, p) {
  const wood = [], iron = [];
  const H = rng.range(0.55, 0.64), R = rng.range(0.23, 0.26);
  // Souche : un fût à 9 pans, un peu plus large en bas ; une fente sombre qui descend du dessus ; dessus en bois de bout
  // (plus clair) avec trois cernes.
  const sides = 9;
  const spin = rng.range(0, Math.PI);
  wood.push(withTone(buildLathe([[0, 0], [R + 0.03, 0], [R + 0.01, 0.12], [R, H], [0, H]], { segments: sides, facets: true, start: spin }), (x, y, z, nx, ny) => (ny > 0.5 ? 0.25 : -0.05 - 0.15 * (1 - Math.min(1, y / 0.15)))));
  // Cernes : trois anneaux plats d'un demi-pixel posés sur le dessus.
  for (let k = 1; k <= 3; k++) {
    const r = R * (k / 4) + rng.range(-0.012, 0.012);
    wood.push(withTone(ring({ radius: r, height: 0.002, y: H, thickness: PX * 0.4, segments: sides }), -0.32));
  }
  const crackA = rng.range(0, Math.PI * 2), crackL = rng.range(0.2, 0.42);
  const cn = [Math.cos(crackA), 0, Math.sin(crackA)];
  wood.push(buildQuads([
    { position: [cn[0] * (R + 0.003), H - crackL / 2, cn[2] * (R + 0.003)], size: [PX * 0.45, crackL], normal: cn, tone: -1.0 },
    { position: [cn[0] * R * 0.55, H + 0.002, cn[2] * R * 0.55], size: [R * 0.9, PX * 0.4], normal: [0, 1, 0], tone: -0.9 },
  ]));
  // Deux cercles de fer, un en haut, un en bas.
  for (const y of [0.1, H - 0.08]) iron.push(withTone(ring({ radius: R + 0.006 + (y < 0.2 ? 0.012 : 0), height: 0.04, y, thickness: 0.016, segments: sides }), (x, yy, z, nx, ny) => (ny > 0.5 ? 0.2 : 0.02)));

  // L'enclume, posée sur la souche, tournée selon la graine.
  const body = anvilBody(rng);
  const yaw = rng.range(-0.35, 0.35);
  const m = new THREE.Matrix4().makeRotationY(yaw).setPosition(0, H, 0);
  for (const g of body.parts) iron.push(g.applyMatrix4(m));
  group.userData.strike = new THREE.Vector3(-0.05, H + body.top, 0).applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
  group.userData.surface = { y: H + body.top, size: [0.5, 0.14] };

  // Marteau de forge appuyé contre la souche (manche de bois clair, tête de fonte au sol), selon la graine.
  if (rng.chance(0.7)) {
    const a = rng.range(0, Math.PI * 2);
    const foot = new THREE.Vector3(Math.cos(a) * (R + 0.22), 0, Math.sin(a) * (R + 0.22));
    const lean = new THREE.Vector3(Math.cos(a) * (R + 0.02), H - 0.08, Math.sin(a) * (R + 0.02));
    wood.push(withTone(beam(foot.clone().add(new THREE.Vector3(0, 0.06, 0)), lean, 0.035, 0.03), 0.45));
    const head = buildBlock([0.15, 0.06, 0.06], [0, 0, 0]);
    head.applyMatrix4(new THREE.Matrix4().makeRotationY(-a + Math.PI / 2).setPosition(foot.x, 0.04, foot.z));
    iron.push(withTone(head, (x, y, z, nx, ny) => (ny > 0.5 ? 0.25 : -0.1)));
  }

  const woodMesh = new THREE.Mesh(mergeToned(wood), createToonMaterial({
    ramp: ["#2a1a17", "#4a2f24", "#71492f", "#9a6a42"], ink: WOODS.walnut.ink, steps: [0.28, 0.5, 0.76], tone: true, crease: true,
    pattern: "speckle", patternParams: [16, 0.06, 0.14, 1], seed: p.seed % 97, id: 20,
  }));
  woodMesh.name = "stump";
  const ironMesh = new THREE.Mesh(mergeToned(iron), metalMaterial(METALS.castIron, { id: 30, tone: true, grain: 0.04, seed: p.seed % 97 }));
  ironMesh.name = "anvil";
  for (const mesh of [woodMesh, ironMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

function buildTestBlock(group, rng, p) {
  const stone = [], steel = [], quartz = [];
  // Dalle de pierre fumée de 1,2 × 1,2 × 0,4 m, arêtes un peu écornées, un filet sombre à 5 cm du bord du dessus.
  const SH = 0.4, S = 1.2;
  const slab = gridBlock([S, SH, S], [0, SH / 2, 0], { cell: 0.15 });
  stone.push(withTone(slab, (x, y, z, nx, ny) => (ny > 0.5 ? -0.05 + (Math.max(Math.abs(x), Math.abs(z)) > S / 2 - 0.07 ? 0.12 : 0) : -0.08 - 0.15 * (1 - y / SH))));
  stone.push(buildQuads([
    { position: [0, SH + 0.001, S / 2 - 0.09], size: [S - 0.18, PX * 0.4], normal: [0, 1, 0], tone: -0.6 },
    { position: [0, SH + 0.001, -S / 2 + 0.09], size: [S - 0.18, PX * 0.4], normal: [0, 1, 0], tone: -0.6 },
    { position: [S / 2 - 0.09, SH + 0.001, 0], size: [PX * 0.4, S - 0.18], normal: [0, 1, 0], tone: -0.6 },
    { position: [-S / 2 + 0.09, SH + 0.001, 0], size: [PX * 0.4, S - 0.18], normal: [0, 1, 0], tone: -0.6 },
  ]));
  // Bloc d'acier de 0,6 × 0,6 × 0,5 m, chanfrein clair sur les arêtes du dessus, marques de coups sombres au centre.
  const B = 0.6, BH = 0.5, top = SH + BH;
  steel.push(withTone(gridBlock([B, BH, B], [0, SH + BH / 2, 0], { cell: 0.075 }), (x, y, z, nx, ny) => {
    if (ny > 0.5) return 0.12 + (Math.max(Math.abs(x), Math.abs(z)) > B / 2 - 0.05 ? 0.2 : 0);
    return -0.05 - 0.2 * (1 - (y - SH) / BH);
  }));
  const dents = [];
  for (let i = 0; i < rng.int(4, 8); i++) {
    const r = rng.range(0, 0.12), a = rng.range(0, Math.PI * 2);
    dents.push({ position: [Math.cos(a) * r, top + 0.0015, Math.sin(a) * r], size: [PX * rng.range(0.6, 1.1), PX * rng.range(0.6, 1.1)], normal: [0, 1, 0], tone: rng.range(-0.55, -0.3) });
  }
  steel.push(buildQuads(dents));
  // Semelle : un cadre sombre où le bloc entre dans la dalle.
  steel.push(withTone(buildBlock([B + 0.06, 0.04, B + 0.06], [0, SH + 0.02, 0]), -0.45));
  // 8 capteurs piézo : deux par face, à mi-hauteur ; une pastille de laiton sombre et un point de quartz clair.
  const sensors = [];
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2;
    const n = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const t = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    for (const u of [-0.15, 0.15]) {
      const c = new THREE.Vector3().addScaledVector(t, u).addScaledVector(n, B / 2).setY(SH + BH * (side % 2 ? 0.58 : 0.42));
      sensors.push({ c, n });
      steel.push(withTone(beam(c, c.clone().addScaledVector(n, 0.025), 0.07, 0.07), -0.35));
      quartz.push(withTone(beam(c.clone().addScaledVector(n, 0.02), c.clone().addScaledVector(n, 0.05), 0.05, 0.05), 0.9));
    }
  }
  // Câbles fins : de chaque capteur, ils descendent sur la dalle, courent vers un coin et se rejoignent en bouquet
  // qui part vers la console (au sol, vers −x ou +z selon la graine).
  const out = rng.chance(0.5) ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const knot = out.clone().multiplyScalar(S / 2 - 0.12).add(new THREE.Vector3(out.z ? 0.3 : 0, SH + 0.03, out.x ? -0.3 : 0));
  const exit = knot.clone().addScaledVector(out, 0.16).setY(SH - 0.02);
  const floor = exit.clone().addScaledVector(out, 0.18).setY(0.02);
  sensors.forEach(({ c, n }, i) => {
    const tip = c.clone().addScaledVector(n, 0.05);
    const down = tip.clone().addScaledVector(n, 0.06).setY(SH + 0.02);
    const spread = (i - 3.5) * 0.012;
    const k = knot.clone().add(new THREE.Vector3(out.z ? spread : 0, 0, out.x ? spread : 0));
    quartz.push(withTone(cable([tip, tip.clone().addScaledVector(n, 0.05).setY(tip.y - 0.05), down, down.clone().lerp(k, 0.5), k], { radius: 0.012, sides: 3 }), -0.95));
  });
  quartz.push(withTone(cable([knot, exit, floor, floor.clone().addScaledVector(out, 0.12)], { radius: 0.035, sides: 5 }), -0.85));
  steel.push(withTone(ring({ radius: 0.036, height: 0.05, thickness: 0.012, segments: 6 }).translate(knot.x, knot.y - 0.025, knot.z), 0.1)); // collier du bouquet

  const stoneMesh = new THREE.Mesh(mergeToned(stone), stoneMaterial(STONES.smoked, { seed: p.seed % 97, id: 20 }));
  stoneMesh.name = "slab";
  const steelMesh = new THREE.Mesh(mergeToned(steel), metalMaterial(METALS.iron, { id: 30, tone: true, grain: 0.03, seed: p.seed % 97 }));
  steelMesh.name = "block";
  const quartzMesh = new THREE.Mesh(mergeToned(quartz), createToonMaterial({ ramp: GLASSES.clear.ramp, ink: GLASSES.clear.ink, steps: [0.25, 0.5, 0.78], tone: true, crease: true, id: 31 }));
  quartzMesh.name = "sensors";
  for (const mesh of [stoneMesh, steelMesh, quartzMesh]) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.strike = new THREE.Vector3(0, top, 0);
  group.userData.surface = { y: top, size: [B, B] };
  group.userData.sensors = sensors.map(({ c, n }) => c.clone().addScaledVector(n, 0.05));
}
