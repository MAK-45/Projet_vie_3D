// Lampe à filament du Complexe (fiches SAS-05 et GAL-05, docs/complexe/PIECES.md) : une ampoule ronde ambre de 2 px
// dans une cage de 8 barreaux de bronze, chapeau conique et pointe en bas ; suspendue à une chaîne en pointillé (Sas)
// ou portée par une console murale (Galerie). Le filament scintille lentement, par paliers. Option `halo` : elle
// éclaire le décor autour d'elle dans le noir (une des 12 lumières de halo du moteur : à réserver aux lampes proches
// de la créature, le monde s'en charge).
//
// 2 draw calls : bronze (cage, chapeau, chaîne ou console), lueur (l'ampoule).

import * as THREE from "three";
import { createGlowLight, rgb, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildLathe } from "../../kit/geometry.js";
import { GLOWS, METALS } from "../../kit/palettes.js";
import {
  PX, beam, bulb, chain, createFlicker, glowLevels, glowMixMaterial, mergeToned, metalMaterial, ring, withShade, withTone,
} from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, glowParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const MOUNTS = { hanging: "Suspendue (chaîne)", wall: "Applique murale" };
const STATES = { lit: "Allumée", dim: "En veille", off: "Éteinte" };
const HALOS = { off: "Sans halo", on: "Éclaire le décor (dans le noir)" };
const BASE = { lit: 2, dim: 1, off: 0 };

const params = {
  seed: seedParam("Change le galbe de la cage, un barreau tordu ou manquant, le ton du bronze, le rythme du scintillement."),
  mount: choiceParam("Pose", MOUNTS, "Suspendue à une chaîne (Sas), ou applique sur une console murale (Galerie, une par travée)."),
  state: choiceParam("État", STATES, "Allumée (scintillement lent), en veille (lueur faible) ou éteinte (verre ambre sombre)."),
  glow: glowParam("Couleur du filament."),
  halo: choiceParam("Halo", HALOS, "Éclaire le décor autour d'elle dans le noir (lumière de halo : 12 pour toute la scène)."),
  height: numberParam("Hauteur", 2.6, 1.2, 12, "Hauteur de l'ampoule au-dessus du sol (2,6 m pour une applique de Galerie).", { step: 0.1, unit: "m" }),
  chain: numberParam("Chaîne", 1.2, 0.2, 4, "Longueur de la chaîne au-dessus de la cage (lampe suspendue).", { step: 0.1, unit: "m" }),
};

export const meta = {
  id: "furniture/lighting/filament-lamp",
  name: "Lampe à filament",
  nameEn: "Filament cage lamp",
  category: "furniture",
  subcategory: "lighting",
  description:
    "Lampe du Complexe : une ampoule ronde ambre dans une cage de huit barreaux de bronze, au chapeau conique ; " +
    "suspendue à une chaîne ou en applique sur une console murale. Le filament scintille lentement par paliers ; " +
    "allumée, en veille ou éteinte ; peut éclairer le décor dans le noir. Fiches SAS-05, GAL-05.",
  tags: [
    "lampe", "ampoule", "filament", "cage", "applique", "suspension", "chaîne", "bronze", "ambre", "scintillement",
    "le complexe", "complexe", "ancien-tech", "éclairage", "lumineux", "animé", "intérieur",
    "lamp", "light bulb", "cage lamp", "wall sconce", "pendant lamp", "amber", "flicker", "ancient complex",
    "ancient-tech", "lighting", "glowing", "animated", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units:
    "1 unité = 1 mètre ; origine au sol, à l'aplomb de l'ampoule (suspendue) ou au pied du mur (applique : le mur " +
    "est en z = 0, la lampe avance vers +z) ; `height` = hauteur de l'ampoule",
  footprint: { radius: 0.5, height: 4.2 },
  animated: ["flicker", "glow"],
  params,
  variants: variantsOf("mount", params.mount),
};

/**
 * Crée la lampe.
 * @param {{seed?: number, mount?: string, state?: string, glow?: string, halo?: string, height?: number, chain?: number}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const shape = createRng(p.seed * 7919 + 17);
  const wall = p.mount === "wall";
  // Centre de l'ampoule.
  const c = new THREE.Vector3(0, p.height, wall ? 0.32 : 0);
  const bronzeParts = [];

  // --- Cage : 8 barreaux galbés entre un anneau bas et le chapeau.
  const bars = 8;
  const bulge = shape.range(0.14, 0.17);
  const r0 = 0.09, y0 = c.y - 0.2, y1 = c.y + 0.18;
  const bent = shape.int(0, bars - 1);
  const missing = shape.chance(0.3) ? (bent + shape.int(2, 5)) % bars : -1;
  const spin = shape.range(0, Math.PI / bars);
  for (let i = 0; i < bars; i++) {
    if (i === missing) continue;
    const a = spin + (i / bars) * Math.PI * 2;
    const dx = Math.cos(a), dz = Math.sin(a);
    const kink = i === bent ? shape.range(0.02, 0.04) : 0;
    const pts = [[r0, y0], [bulge + kink, c.y - 0.06], [bulge, c.y + 0.06], [r0 + 0.02, y1]];
    for (let k = 0; k < pts.length - 1; k++) {
      const [ra, ya] = pts[k], [rb, yb] = pts[k + 1];
      bronzeParts.push(beam([c.x + dx * ra, ya, c.z + dz * ra], [c.x + dx * rb, yb, c.z + dz * rb], PX * 0.6, PX * 0.6));
    }
  }
  // Anneau bas, pointe, chapeau conique, douille (l'ampoule y est vissée), œillet.
  bronzeParts.push(withTone(ring({ radius: r0 - PX * 0.6, y: y0 - PX, height: PX * 1.4, thickness: PX, segments: 8 }).translate(c.x, 0, c.z), 0.1));
  bronzeParts.push(buildLathe([[0, y0 - 0.1], [0.03, y0 - 0.03], [0.03, y0], [0, y0]], { segments: 6, facets: true }).translate(c.x, 0, c.z));
  bronzeParts.push(withTone(buildLathe([[0, y1], [0.17, y1], [0.17, y1 + 0.03], [0.06, y1 + 0.11], [0, y1 + 0.11]], { segments: 10, facets: true }).translate(c.x, 0, c.z), 0.05));
  bronzeParts.push(withTone(buildLathe([[0, c.y + 0.06], [0.04, c.y + 0.06], [0.04, y1], [0, y1]], { segments: 6, facets: true }).translate(c.x, 0, c.z), -0.2));
  const eye = ring({ radius: 0.025, height: PX * 0.7, thickness: PX * 0.7, segments: 6 });
  eye.rotateX(Math.PI / 2);
  eye.translate(c.x, y1 + 0.15, c.z);
  bronzeParts.push(eye);
  const top = y1 + 0.18;

  if (wall) {
    // Console : platine au mur, bras qui avance, crosse qui retombe sur l'œillet.
    const armY = top + 0.08;
    bronzeParts.push(withTone(buildBlock([0.14, 0.24, PX], [0, armY - 0.04, PX / 2]), 0.1));
    bronzeParts.push(beam([0, armY, PX], [0, armY, c.z + 0.02], PX * 1.2, PX * 1.4));
    bronzeParts.push(beam([0, armY - 0.18, PX], [0, armY - 0.02, c.z * 0.55], PX, PX)); // jambe de force
    bronzeParts.push(beam([0, armY, c.z], [0, top - 0.02, c.z], PX * 0.8, PX * 0.8));
  } else {
    // Chaîne jusqu'à la rosace du plafond.
    const end = top + p.chain;
    bronzeParts.push(chain([c.x, top, c.z], [c.x, end, c.z], { sag: 0, link: 0.07 }));
    bronzeParts.push(withTone(buildLathe([[0, end], [0.09, end], [0.09, end + 0.03], [0, end + 0.05]], { segments: 8, facets: true }), 0.1));
  }

  const group = new THREE.Group();
  group.name = meta.name;
  const bronze = new THREE.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 30, tone: true }));
  bronze.name = "cage";
  bronze.castShadow = true;
  group.add(bronze);

  // --- Ampoule : 2 px de diamètre, scintillement par paliers.
  const glass = withShade(bulb({ radius: PX * 1.35, position: c, segments: 6 }), BASE[p.state], 4);
  const glowMaterial = glowMixMaterial(glowLevels(p.glow), { id: 31 });
  const light = new THREE.Mesh(glass, glowMaterial);
  light.name = "bulb";
  group.add(light);
  const flicker = createFlicker(glass, [{ start: 0, count: glass.attributes.position.count, base: BASE[p.state], phase: shape.next() }]);

  // Halo : une lumière de halo du moteur, portée selon l'état et le palier du moment.
  const halo = p.halo === "on" && p.state !== "off" ? createGlowLight() : null;
  if (halo) glowMaterial.addEventListener("dispose", () => halo.release());
  const haloColor = rgb(GLOWS[p.glow].light);
  const haloAt = new THREE.Vector3();
  const reach = p.state === "lit" ? 3 : 1.8;

  const baseUpdate = group.updateMatrixWorld.bind(group);
  let lastTime = -1;
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      flicker(time);
    }
    baseUpdate(force);
    if (halo) {
      const level = glass.attributes.aShade.array[0] * 4 - 0.5;
      halo.set(group.localToWorld(haloAt.copy(c)), haloColor, reach * (0.85 + 0.08 * level), 1.1 + 0.15 * level);
    }
  };

  group.userData.asset = { id: meta.id, params: p };
  group.userData.lightPoint = c.clone(); // centre de l'ampoule (repère de l'asset)
  return group;
}
