// Pupitre de la porte des étoiles : un pied de pierre taillée portant un plateau incliné, avec une couronne de
// touches de cristal hexagonales autour d'un grand cristal central. Design original du projet.
//
// Il suit la même séquence que la porte (`props/magic/star-portal`, kit/portal.js) : avec la même graine et le même
// nombre de verrous, chaque touche s'enfonce et s'allume au moment où la porte enclenche le verrou correspondant,
// et le cristal central s'embrase quand le vortex jaillit, puis s'éteint à la fermeture.
//
// 2 draw calls : pierre (pied et plateau), énergie (touches et cristal).

import * as THREE from "three";
import { createGlowLight, createToonMaterial, rgb, sharedUniforms } from "../../../engine/toon-material.js";
import { buildBlock, buildGem, buildLathe, mergeGeometries } from "../../kit/geometry.js";
import { STONES } from "../../kit/palettes.js";
import { resolveParams } from "../../kit/params.js";
import { dialKeys, portalSequence, portalStateAt } from "../../kit/portal.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";
import { PORTAL_ENERGIES, energyRamp } from "./star-portal.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const STYLES = { pillar: "Colonne", lectern: "Lutrin", altar: "Autel" };
const STATES = { cycle: "Composition en boucle", dormant: "Endormi", open: "Porte ouverte" };

const params = {
  seed: seedParam(
    "La même graine que la porte : même adresse, mêmes touches pressées au même moment. Change aussi le pied " +
      "(facettes, galbe), l'inclinaison du plateau et le nombre de touches (12 à 16).",
  ),
  style: choiceParam("Forme", STYLES, "Colonne galbée, lutrin penché en bloc, ou autel bas et large."),
  state: choiceParam("État", STATES, "En boucle (synchronisé avec la porte), endormi, ou figé porte ouverte."),
  locks: { type: "int", default: 7, min: 5, max: 9, label: "Verrous", description: "Le nombre de verrous de la porte qu'il commande : autant de touches pressées." },
  energy: choiceParam("Énergie", PORTAL_ENERGIES, "Couleur des cristaux allumés (la même que la porte)."),
  stone: stoneParam("Pierre du pied et du plateau.", { only: ["granite", "slate", "basalt", "sandstone"] }),
};

export const meta = {
  id: "props/magic/star-portal-dial",
  name: "Pupitre de la porte des étoiles",
  nameEn: "Star portal dial",
  category: "props",
  subcategory: "magic",
  description:
    "Pupitre de pierre qui commande la porte des étoiles : une couronne de touches de cristal autour d'un grand " +
    "cristal, sur un plateau incliné. Les touches s'allument une à une pendant la composition, le cristal s'embrase " +
    "à l'ouverture, en même temps que la porte de même graine. Colonne, lutrin ou autel.",
  tags: [
    "pupitre", "console", "commande", "porte des étoiles", "portail", "touches", "cristaux", "adresse", "voyage",
    "magie", "science-fiction", "pierre", "animé", "extérieur",
    "dial", "control panel", "star portal", "portal", "keys", "crystals", "address", "travel", "magic", "sci-fi",
    "stone", "animated", "outdoor", "procedural",
  ],
  biomes: ["forest", "meadow", "desert", "snow", "mountain", "cave", "beach", "swamp"],
  version: 1,
  added: "2026-11-17",
  units: "1 unité = 1 mètre ; origine au sol sous le pied ; le plateau s'incline vers +Z (on se tient côté +Z pour composer)",
  footprint: { radius: 0.8, height: 1.5 },
  animated: ["dial", "glow"],
  params,
  variants: variantsOf("style", params.style),
};

/**
 * Crée le pupitre.
 * @param {{seed?: number, style?: string, state?: string, locks?: number, energy?: string, stone?: string}} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; il s'anime avec `tick(secondes)`
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const ramp = energyRamp(p.energy);
  const shape = createRng(p.seed * 7919 + 17);
  const seq = portalSequence(p.seed, p.locks);
  const keyCount = shape.int(12, 16);
  const pressOf = dialKeys(seq, keyCount); // pour chaque verrou, sa touche

  // --- Pied.
  const stoneParts = [];
  const sides = shape.pick([6, 8]);
  const start = Math.PI / sides;
  let height, plateRadius, tiltAngle;
  if (p.style === "pillar") {
    height = shape.range(0.95, 1.08);
    plateRadius = shape.range(0.56, 0.64);
    tiltAngle = shape.range(0.3, 0.42);
    const foot = shape.range(0.42, 0.52), waist = shape.range(0.17, 0.24), neck = shape.range(0.26, 0.34);
    const swell = shape.range(0.35, 0.55);
    stoneParts.push(
      buildLathe(
        [[0, 0], [foot, 0], [foot, 0.1], [foot * 0.75, 0.18], [waist, 0.3], [waist * (1 + swell * 0.3), height * swell], [waist, height * 0.78], [neck, height - 0.12], [neck, height - 0.06], [0, height - 0.06]],
        { segments: sides, facets: true, start },
      ),
    );
  } else if (p.style === "lectern") {
    height = shape.range(1.0, 1.12);
    plateRadius = shape.range(0.52, 0.6);
    tiltAngle = shape.range(0.45, 0.6);
    const w = shape.range(0.5, 0.62);
    stoneParts.push(buildBlock([w + 0.3, 0.14, w + 0.2], [0, 0.07, 0]));
    stoneParts.push(buildBlock([w, height - 0.2, w * 0.7], [0, 0.14 + (height - 0.2) / 2, -0.04], [0, 0, 0], { taper: shape.range(0.1, 0.25) }));
    // Joues du lutrin : deux ailes de pierre de chaque côté du plateau.
    for (const sx of [-1, 1]) stoneParts.push(buildBlock([0.1, 0.42, 0.5], [sx * (plateRadius + 0.02), height - 0.12, 0], [-tiltAngle, 0, 0]));
  } else {
    height = shape.range(0.72, 0.84);
    plateRadius = shape.range(0.66, 0.74);
    tiltAngle = shape.range(0.16, 0.26);
    const r = shape.range(0.7, 0.8);
    stoneParts.push(
      buildLathe([[0, 0], [r, 0], [r, 0.12], [r * 0.82, 0.2], [r * 0.82, height - 0.16], [r * 0.9, height - 0.1], [r * 0.9, height - 0.06], [0, height - 0.06]], {
        segments: sides,
        facets: true,
        start,
      }),
    );
  }

  // --- Plateau incliné vers +Z : un disque à facettes, avec un rebord.
  const plate = new THREE.Object3D();
  plate.position.set(0, height, 0);
  plate.rotation.x = tiltAngle; // le haut du plateau penche vers +Z
  plate.updateMatrix();
  const thick = 0.12;
  const plateGeometry = buildLathe(
    [[0, -thick], [plateRadius, -thick], [plateRadius + 0.05, -thick * 0.4], [plateRadius + 0.05, 0.03], [plateRadius - 0.04, 0.05], [plateRadius - 0.06, 0], [0, 0]],
    { segments: sides * 2, facets: true, start: start / 2 },
  );
  plateGeometry.applyMatrix4(plate.matrix);
  stoneParts.push(plateGeometry);

  const group = new THREE.Group();
  group.name = meta.name;
  const body = new THREE.Mesh(
    mergeGeometries(stoneParts),
    createToonMaterial({
      ramp: stone.ramp,
      ink: stone.ink,
      steps: [0.34, 0.56, 0.8],
      pattern: "speckle",
      patternParams: [16, 0.05, 0.2, 1],
      seed: shape.int(0, 96),
      crease: true,
      id: 10,
    }),
  );
  body.name = "body";
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // --- Touches de cristal (hexagones bombés) en couronne, cristal central à facettes.
  const pieces = [];
  const keys = [];
  let vertex = 0;
  const keyRing = plateRadius * 0.7;
  const keySize = Math.min(0.1, ((Math.PI * 2 * keyRing) / keyCount) * 0.38);
  for (let k = 0; k < keyCount; k++) {
    const a = Math.PI / 2 + (k / keyCount) * Math.PI * 2;
    const g = buildLathe([[0, 0], [keySize, 0], [keySize, 0.035], [keySize * 0.6, 0.06], [0, 0.065]], { segments: 6, facets: true, start: a });
    g.translate(Math.cos(a) * keyRing, 0, -Math.sin(a) * keyRing);
    g.applyMatrix4(plate.matrix);
    keys.push({ first: vertex, last: vertex + g.attributes.position.count });
    vertex += g.attributes.position.count;
    pieces.push(g);
  }
  const heartRadius = plateRadius * 0.3;
  const heart = buildGem({ length: heartRadius * 1.9, radius: heartRadius, sides: 8, waist: 0.32, position: new THREE.Vector3(0, 0, 0), spin: Math.PI / 8 });
  heart.applyMatrix4(plate.matrix);
  const heartRange = [vertex, vertex + heart.attributes.position.count];
  const heartFacets = heart.userData.facet;
  pieces.push(heart);

  const geometry = mergeGeometries(pieces);
  const shadeArray = new Float32Array(geometry.attributes.position.count);
  geometry.setAttribute("aShade", new THREE.BufferAttribute(shadeArray, 1));
  const basePositions = Float32Array.from(geometry.attributes.position.array);
  const press = new THREE.Vector3(0, -0.025, 0).applyEuler(plate.rotation); // une touche s'enfonce dans le plateau
  const energy = new THREE.Mesh(
    geometry,
    createToonMaterial({ ramp, steps: [0.22, 0.45, 0.66, 0.85], unlit: true, shade: true, glow: false, id: 12 }),
  );
  energy.name = "crystals";
  energy.castShadow = true;
  group.add(energy);

  // --- Animation : mêmes instants que la porte.
  const keyLock = new Map(pressOf.map((key, lock) => [key, lock]));
  const pa = geometry.attributes.position.array;
  let glowLevel = 0;
  function update(time) {
    const s = portalStateAt(seq, time, p.state);
    for (let k = 0; k < keyCount; k++) {
      const lock = keyLock.get(k);
      const level = lock === undefined ? 0 : s.locked[lock];
      // La touche s'enfonce un peu avant que le verrou ne s'enclenche (on appuie, la porte répond).
      const down = lock === undefined ? 0 : Math.max(level, pressing(seq, s.t, lock, p.state));
      const shade = level >= 1 ? 0.88 : level > 0 ? 1 : down > 0 ? 0.7 : 0.3 + (k % 2) * 0.05;
      for (let v = keys[k].first; v < keys[k].last; v++) {
        pa[v * 3] = basePositions[v * 3] + press.x * down;
        pa[v * 3 + 1] = basePositions[v * 3 + 1] + press.y * down;
        pa[v * 3 + 2] = basePositions[v * 3 + 2] + press.z * down;
        shadeArray[v] = shade + (v % 3 === 0 ? 0.06 : 0);
      }
    }
    let heat = 0;
    if (s.horizon === "burst") heat = 1;
    else if (s.horizon === "open") heat = 0.8 + 0.12 * Math.sin(s.t * 4);
    else if (s.horizon === "closing") heat = 0.8 * (1 - s.k);
    const lockedAll = s.locked.every((l) => l >= 1) && s.horizon === "off" ? 0.55 : 0;
    heat = Math.max(heat, lockedAll);
    for (let v = heartRange[0]; v < heartRange[1]; v++) {
      const facet = heartFacets[v - heartRange[0]] % 2;
      shadeArray[v] = 0.3 + facet * 0.2 + heat * 0.6;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aShade.needsUpdate = true;
    glowLevel = heat;
  }

  const light = createGlowLight();
  energy.material.addEventListener("dispose", () => light.release());
  const lightColor = rgb(ramp[3]);
  const lightPosition = new THREE.Vector3();
  const lightOffset = new THREE.Vector3(0, height + 0.25, 0);
  let lastTime = -1;
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    const time = sharedUniforms.uTime.value;
    if (time !== lastTime) {
      lastTime = time;
      update(time);
    }
    baseUpdate(force);
    if (glowLevel > 0) light.set(group.localToWorld(lightPosition.copy(lightOffset)), lightColor, 2.6 * glowLevel, 1.2);
    else light.set(lightPosition.set(0, -999, 0), lightColor, 0, 0);
  };
  update(0);
  lastTime = 0;

  group.userData.asset = { id: meta.id, params: p, keys: keyCount, pressed: pressOf };
  return group;
}

/** Appui sur la touche du verrou `lock` : 0,4 s avant la fin de la rotation de l'anneau, jusqu'au verrouillage. */
function pressing(seq, t, lock, mode) {
  if (mode !== "cycle") return 0;
  const step = seq.steps[lock];
  return t >= step.spinEnd - 0.4 && t < step.lockEnd ? 1 : 0;
}
