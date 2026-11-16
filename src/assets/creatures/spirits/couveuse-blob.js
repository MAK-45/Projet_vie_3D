// Couveuse, le blob : la créature de lumière de glace telle qu'elle est née, portée en 3D depuis le blob 2D
// (couveuse-blob.js). Un corps rond qui ne tient jamais en place — il ondule, flotte, s'étire en montant et
// s'écrase en redescendant, respire —, deux yeux sombres qui clignent et regardent autour, des étincelles qui
// tournent autour de lui, des gouttes de lumière qui tombent dessous et des poussières qui montent.
// Mêmes palettes de 8 couleurs que l'original (Glace, Arcane, Braise, Sève, Aurore, Néon, Abysse, Lagon, Sang).
// Entièrement procédural, 3 draw calls : corps, yeux, étincelles et gouttes.
//
// Animation : la forme est recalculée à chaque cran du temps partagé du moteur (`tick`, 12 images/s), juste avant
// le rendu (dans `updateMatrixWorld`), à partir des mêmes bruits lus sur un cercle de temps que le blob 2D : la
// boucle de 4 s ne saute jamais.

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { createToonMaterial, sharedUniforms } from "../../../engine/toon-material.js";
import { buildFanGeometry, buildSpriteGeometry, ellipseOutline, mergeGeometries, starOutline } from "../../kit/geometry.js";
import { resolveParams } from "../../kit/params.js";
import { createNoise3, createRng } from "../../kit/rng.js";
import { choiceParam, numberParam, seedParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

// Les palettes du blob 2D, de l'ombre du corps au reflet (8 couleurs ; celles de 7 sont étirées à 8).
export const BLOB_PALETTES = {
  ice: { label: "Glace", colors: ["#081026", "#102654", "#1a4a90", "#2c7ccc", "#58b6ee", "#9fe0ff", "#dcf8ff", "#ffffff"] },
  arcane: { label: "Arcane", colors: ["#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"] },
  ember: { label: "Braise", colors: ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"] },
  sap: { label: "Sève", colors: ["#08201a", "#0f3f2c", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"] },
  dawn: { label: "Aurore", colors: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"] },
  neon: { label: "Néon", colors: ["#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"] },
  abyss: { label: "Abysse", colors: ["#050308", "#0f0a18", "#1c1230", "#2c1a4a", "#432468", "#5e3290", "#8048b8", "#a970e0"] },
  lagoon: { label: "Lagon", colors: ["#041418", "#08303a", "#0c5260", "#108088", "#18b4b0", "#4ce8d8", "#b4fff0", "#ffffff"] },
  blood: { label: "Sang", colors: ["#14040a", "#3a0a14", "#6a101c", "#a01824", "#d42a30", "#ff5a50", "#ff9a8a"] },
};
const EYE_COLOR = "#0a1430";
const PUPIL_COLOR = "#081026";
const WHITE = "#ffffff";
const DURATION = 4; // une boucle de repos, en secondes
const TAU = Math.PI * 2;
const UP_HALF = new THREE.Vector3(0, 0.5, 0);

/** Rééchantillonne une rampe à n couleurs en gardant ses deux bouts (comme `fit` de pixelfx). */
function fit(colors, n) {
  if (colors.length === n) return colors.slice();
  return Array.from({ length: n }, (_, i) => colors[Math.round((i * (colors.length - 1)) / Math.max(1, n - 1))]);
}

const params = {
  seed: seedParam("Change les vagues du corps et leur rythme, sa dérive, quand il cligne des yeux, où il regarde, ses gouttes et ses poussières."),
  palette: choiceParam("Couleurs", BLOB_PALETTES, "Les palettes du blob : Glace (sa couleur de naissance), Arcane, Braise, Sève, Aurore, Néon, Abysse, Lagon, Sang."),
  size: numberParam("Taille", 0.9, 0.4, 1.4, "Hauteur du corps (son diamètre au repos).", { step: 0.05, unit: "m" }),
  altitude: numberParam("Vol", 1, 0.5, 1.6, "Hauteur du centre du corps au-dessus du sol.", { step: 0.05, unit: "m" }),
  wobble: numberParam("Ondulation", 0.3, 0, 0.8, "Amplitude des vagues qui déforment le corps.", { step: 0.02 }),
  detail: numberParam("Finesse des vagues", 0.85, 0.3, 2.5, "Peu de grands lobes (bas) ou beaucoup de petites vagues (haut).", { step: 0.05 }),
  chaos: numberParam("Instabilité", 0.7, 0, 2, "Combien la forme change au fil de la boucle : 0, elle ondule à peine.", { step: 0.05 }),
  drip: numberParam("Goutte", 0.18, 0, 0.6, "Dessous plus lourd, en goutte qui flotte.", { step: 0.02 }),
  width: numberParam("Largeur", 1, 0.7, 1.4, "Corps plus étroit (bas) ou plus large (haut).", { step: 0.02 }),
  stretch: numberParam("Étirement", 0.6, 0, 1.5, "S'étire en montant, s'écrase en haut et en bas de sa course.", { step: 0.05 }),
  hover: numberParam("Flottement", 0.11, 0, 0.3, "Amplitude de la montée et descente.", { step: 0.01, unit: "m" }),
  wander: numberParam("Dérive", 0.1, 0, 0.3, "Il erre un peu autour de sa place.", { step: 0.01, unit: "m" }),
  currents: numberParam("Courants", 1, 0, 2, "Courants de lumière qui passent dans le corps.", { step: 0.05 }),
  eyes: { type: "int", default: 2, min: 0, max: 3, label: "Yeux", description: "Nombre d'yeux : 0 à 3." },
  eyeShape: choiceParam("Forme des yeux", { round: "Ronds", almond: "En amande", happy: "Heureux" }, "Ronds, en amande, ou plissés de bonheur (arcs)."),
  eyeStyle: choiceParam("Style des yeux", { dark: "Sombres", bright: "Lumineux", pupil: "À pupille" }, "Sombres avec un reflet, lumineux (blancs cernés) ou blancs à pupille qui regarde."),
  eyeSize: numberParam("Taille des yeux", 0.23, 0.08, 0.4, "Rayon d'un œil, en part du rayon du corps.", { step: 0.01 }),
  eyeSpacing: numberParam("Écart des yeux", 0.52, 0.15, 0.8, "Écart entre les yeux, en part du rayon.", { step: 0.01 }),
  eyeHeight: numberParam("Hauteur des yeux", 0.22, -0.2, 0.55, "Hauteur des yeux sur le visage, en part du rayon.", { step: 0.01 }),
  eyeTall: numberParam("Yeux étirés", 1.35, 0.6, 2, "Hauteur des yeux en amande par rapport à leur largeur.", { step: 0.05 }),
  blinks: { type: "int", default: 2, min: 0, max: 6, label: "Clignements", description: "Clignements par boucle de 4 s (parfois doublés)." },
  look: numberParam("Regard", 1, 0, 2, "Combien il regarde autour de lui.", { step: 0.05 }),
  sparks: { type: "int", default: 3, min: 0, max: 8, label: "Étincelles", description: "Étincelles qui tournent autour de lui." },
  drips: { type: "int", default: 6, min: 0, max: 12, label: "Gouttes", description: "Gouttes de lumière qui tombent de son dessous." },
  turn: numberParam("Orientation", 45, -180, 180, "Tourne le blob sur lui-même : 0, il regarde vers +Z ; 45, vers la caméra de l'Atelier.", { step: 5, unit: "°" }),
  motes: { type: "int", default: 18, min: 0, max: 30, label: "Poussières", description: "Poussières de lumière qui montent autour de lui." },
};

export const meta = {
  id: "creatures/spirits/couveuse-blob",
  name: "Couveuse (blob)",
  nameEn: "Couveuse blob",
  category: "creatures",
  subcategory: "spirits",
  description:
    "La Couveuse à sa naissance : un blob de lumière de glace qui flotte, ondule, respire, s'étire et s'écrase, " +
    "cligne des yeux et regarde autour, entouré d'étincelles, de gouttes et de poussières de lumière. Neuf palettes ; " +
    "la graine change ses vagues, sa dérive et son regard ; ondulation et yeux se règlent.",
  tags: [
    "couveuse", "blob", "esprit", "créature", "lumière", "glace", "gelée", "yeux", "clignement", "flottant",
    "magie", "étincelles", "animé", "extérieur", "intérieur",
    "spirit", "creature", "light", "ice", "jelly", "eyes", "blinking", "floating", "magic", "sparks", "animated",
    "procedural",
  ],
  biomes: ["forest", "meadow", "garden", "village", "snow", "swamp", "mountain", "cave", "interior"],
  version: 1,
  added: "2026-11-16",
  units: "1 unité = 1 mètre ; l'origine est au sol sous le blob, qui regarde vers +Z (environ 1,6 m de haut, étincelles comprises)",
  footprint: { radius: 1.2, height: 1.6 },
  animated: ["idle"],
  params,
  variants: variantsOf("palette", params.palette),
};

/**
 * Crée le blob.
 * @param {Partial<Record<keyof typeof params, number|string>>} [given]
 * @returns {THREE.Group} groupe à ajouter à la scène ; il s'anime tout seul avec `tick(secondes)`
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const C = fit(BLOB_PALETTES[p.palette].colors, 8);
  const S = p.size / 2; // rayon du corps
  const center = Math.max(p.altitude, S * (1.25 + p.drip) + p.hover + 0.05);
  const seed = p.seed;

  // Un générateur par aspect : la forme, le mouvement, les yeux, les particules.
  const shapeRng = createRng(seed * 7919 + 17);
  const blinkRng = createRng(seed * 104729 + 71);
  const fxRng = createRng(seed * 15485863 + 5);
  const noiseA = createNoise3(seed * 31 + 9);
  const noiseB = createNoise3(seed * 31 + 19);
  const noiseC = createNoise3(seed * 31 + 23);
  const wanderNoise = createNoise3(seed * 31 + 1);
  const lookNoise = createNoise3(seed * 31 + 51);
  const swayPhase = shapeRng.range(0, TAU);
  const swayPhaseZ = shapeRng.range(0, TAU);
  const shapeOffset = [shapeRng.range(0, 50), shapeRng.range(0, 50), shapeRng.range(0, 50)];

  // Bruit lissé (−1..1) lu sur un cercle de temps de rayon r : la même valeur à u = 0 et u = 1.
  const loop = (noise, x, y, u, r) => noise(x + Math.cos(TAU * u) * r, y + Math.sin(TAU * u) * r, 7.3) * 2 - 1;

  // --- Le corps : une sphère dont chaque direction prend le rayon du blob 2D, r(direction, u).
  function radiusAt(dx, dy, dz, u) {
    const c = Math.cos(TAU * u) * p.chaos, s = Math.sin(TAU * u) * p.chaos;
    const c2 = Math.cos(TAU * u * 2) * p.chaos * 0.6, s2 = Math.sin(TAU * u * 2) * p.chaos * 0.6;
    const k = p.detail;
    const n = noiseA(dx * k + c + shapeOffset[0], dy * k + s + shapeOffset[1], dz * k + shapeOffset[2]) * 2 - 1;
    const n2 = noiseB(dx * k * 2.3 + 40 + c2, dy * k * 2.3 + s2, dz * k * 2.3 + 11) * 2 - 1;
    let r = 1 + p.wobble * (n * 0.9 + n2 * 0.35);
    r += p.drip * Math.max(0, -dy) ** 3; // plus lourd en bas : une goutte qui flotte
    r *= 1 + (p.width - 1) * (dx * dx + dz * dz);
    return Math.max(0.2, r) * S;
  }

  // --- Où il est à la phase u : flottement, balancement et dérive (dans le repère du groupe, en mètres).
  function posAt(u, out) {
    const sway = S * 0.125;
    out.x = Math.sin(TAU * u + swayPhase) * sway + loop(wanderNoise, 3.1, 7.7, u, 0.6) * 1.2 * p.wander;
    out.z = Math.sin(TAU * u + swayPhaseZ) * sway * 0.7 + loop(wanderNoise, 12.6, 4.4, u, 0.6) * 1.2 * p.wander;
    out.y = center + Math.sin(TAU * u * 2) * p.hover + loop(wanderNoise, 9.4, 1.3, u, 0.6) * 0.4 * p.wander;
    return out;
  }

  const a = new THREE.Vector3(), b = new THREE.Vector3();
  /** Pose complète à l'instant t : position, vitesse, étirement, inclinaison. */
  function state(t, out) {
    const u = (((t / DURATION) % 1) + 1) % 1, e = 0.004;
    posAt(u, out.position);
    posAt(u - e, a);
    posAt(u + e, b);
    const dt = 2 * e * DURATION;
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt, vz = (b.z - a.z) / dt;
    // S'étire en montant ou en descendant, s'écrase aux deux bouts de la course ; respire.
    const sv = THREE.MathUtils.clamp(vy / (S * 1.67), -1, 1) * p.stretch;
    const st = 1 + Math.abs(sv) * 0.12 - 0.04 * p.stretch * Math.cos(TAU * u * 4);
    const breath = 1 + 0.03 * Math.sin(TAU * u * 2);
    out.u = u;
    out.vx = vx;
    out.vy = vy;
    out.scale.set(breath / Math.sqrt(st), st * breath, breath / Math.sqrt(st));
    // Il penche dans le sens où il va.
    out.rotation.set(THREE.MathUtils.clamp(vz / (S * 2.5), -0.4, 0.4) * 0.5, 0, THREE.MathUtils.clamp(-vx / (S * 2.5), -0.4, 0.4) * 0.5);
    return out;
  }
  const newState = () => ({ position: new THREE.Vector3(), scale: new THREE.Vector3(), rotation: new THREE.Euler(), u: 0, vx: 0, vy: 0 });

  // Sphère soudée (pas de couture au méridien), sommets = directions unitaires.
  let sphere = new THREE.SphereGeometry(1, 30, 20);
  sphere.deleteAttribute("uv");
  sphere.deleteAttribute("normal");
  const bodyGeometry = mergeVertices(sphere);
  sphere.dispose();
  const directions = Float32Array.from(bodyGeometry.attributes.position.array);
  bodyGeometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(directions.length), 3));
  bodyGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), S * 2);

  const group = new THREE.Group();
  group.name = meta.name;
  const facing = new THREE.Group(); // l'orientation choisie ; tout le blob tourne avec
  facing.rotation.y = THREE.MathUtils.degToRad(p.turn);
  group.add(facing);
  const pivot = new THREE.Group(); // suit le corps : position, étirement, inclinaison
  pivot.name = "pivot";
  facing.add(pivot);

  const body = new THREE.Mesh(
    bodyGeometry,
    createToonMaterial({
      // Comme le blob 2D : le corps prend les couleurs 2 à 7 de la palette, la 7e est le blanc du reflet.
      ramp: [C[2], C[3], C[4], C[5], C[6], WHITE],
      steps: [0.2, 0.45, 0.75, 0.96, 1.1],
      rim: [0.3, 0.5], // le bord de la silhouette brille, même côté ombre
      outline: false, // pas de contour sombre : la lumière fait le bord, comme dans l'original
      shadowLit: 0.55, // il brille : son ombre propre reste claire
      id: 40,
    }),
  );
  body.name = "body";
  body.castShadow = true;
  pivot.add(body);

  // --- Les yeux : formes face caméra posées sur le visage (tons choisis par occlusion dans la rampe).
  const eyeCount = p.eyes;
  const R = p.eyeSize * S;
  const rx = R * (p.eyeShape === "almond" ? 1.25 : 1);
  const ry = R * (p.eyeShape === "round" ? 1 : p.eyeTall) * (p.eyeShape === "almond" ? 0.75 : 1);
  const occ = { eye: 0.1, rim: 0.3, pupil: 0.5, soft: 0.7, white: 0.9 };
  const eyeFans = [];
  const eyeSprites = [];
  const ORIGIN = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const fan = (outline, size, stretch, occlusion, lift, offset) => ({
    position: ORIGIN, outline, size, stretch, normal: UP, phase: 0, variation: 0.5, flex: 0, occlusion, lift, offset,
  });
  const eyeOutline = p.eyeShape === "almond" ? almondOutline(16) : ellipseOutline(16);
  const eyeKinds = []; // par œil : nombre de sommets et rôle (0 forme, 1 pupille)
  for (let i = 0; i < eyeCount; i++) {
    const start = eyeFans.length + eyeSprites.length;
    const kinds = [];
    if (p.eyeShape === "happy") {
      // Plissé de bonheur : un arc sombre (∩).
      eyeSprites.push(arcSprite(rx, ry * 0.6, Math.max(0.065, R * 0.4), p.eyeStyle === "bright" ? occ.rim : occ.eye));
      kinds.push(0);
    } else if (p.eyeStyle === "bright") {
      eyeFans.push(fan(eyeOutline, 1, [rx, ry], occ.rim, 0));
      eyeFans.push(fan(eyeOutline, 1, [Math.max(0.03, rx - 0.065), Math.max(0.03, ry - 0.065)], occ.white, 0.01));
      kinds.push(0, 0);
    } else {
      if (p.eyeStyle === "pupil") {
        eyeFans.push(fan(eyeOutline, 1, [rx, ry], occ.white, 0));
        eyeFans.push(fan(ellipseOutline(12), R * 0.58, [1, 1], occ.eye, 0.01));
        kinds.push(0, 1);
      } else {
        eyeFans.push(fan(eyeOutline, 1, [rx, ry], occ.eye, 0));
        kinds.push(0);
      }
      // Reflets : un gros vers la lumière (en haut à gauche), un petit en bas à droite.
      const glint = Math.max(0.045, R * 0.3);
      eyeFans.push(fan(starOutline(4), glint, [1, 1], occ.white, 0.02, [-rx * 0.35, ry * 0.4]));
      kinds.push(p.eyeStyle === "pupil" ? 1 : 0);
      if (R >= 0.06) {
        eyeFans.push(fan(starOutline(4), glint * 0.7, [1, 1], occ.soft, 0.02, [rx * 0.35, -ry * 0.35]));
        kinds.push(p.eyeStyle === "pupil" ? 1 : 0);
      }
    }
    eyeKinds.push({ start, kinds });
  }
  // Le reflet : une tache claire et son cœur blanc sur l'épaule éclairée, toujours tournée vers la caméra.
  const highlightStart = eyeFans.length;
  eyeFans.push(fan(ellipseOutline(12), S * 0.2, [1, 0.8], occ.soft, 0.005));
  eyeFans.push(fan(ellipseOutline(10), S * 0.13, [1, 0.8], occ.white, 0.01, [-S * 0.03, S * 0.02]));
  eyeFans.push(fan(starOutline(4), Math.max(0.045, S * 0.06), [1, 1], occ.white, 0.01, [S * 0.2, -S * 0.17]));
  // Une géométrie par sorte, puis fusion ; on retrouve pour chaque sommet son œil et son rôle.
  // (rôle 0 : forme de l'œil, 1 : pupille et reflets qui suivent le regard, 2 : reflet du corps)
  const eyeParts = [];
  const vertexEye = [], vertexRole = [];
  const fanSizes = eyeFans.map((f) => f.outline.length + 1);
  const spriteSizes = eyeSprites.map((s) => s.points.length);
  // Ordre de fusion : tous les éventails, puis tous les arcs ; on note le propriétaire de chaque forme.
  const owners = [];
  for (let e = 0, fi = 0, si = 0; e < eyeKinds.length; e++) {
    for (const role of eyeKinds[e].kinds) {
      if (p.eyeShape === "happy") owners.push({ kind: "sprite", index: si++, eye: e, role });
      else owners.push({ kind: "fan", index: fi++, eye: e, role });
    }
  }
  for (let i = highlightStart; i < eyeFans.length; i++) owners.push({ kind: "fan", index: i, eye: eyeCount, role: 2 });
  for (const o of owners.filter((o) => o.kind === "fan")) for (let k = 0; k < fanSizes[o.index]; k++) vertexEye.push(o.eye), vertexRole.push(o.role);
  for (const o of owners.filter((o) => o.kind === "sprite")) for (let k = 0; k < spriteSizes[o.index]; k++) vertexEye.push(o.eye), vertexRole.push(o.role);
  if (eyeFans.length) eyeParts.push(buildFanGeometry(eyeFans));
  if (eyeSprites.length) eyeParts.push(buildSpriteGeometry(eyeSprites));

  let eyes = null, eyeBase = null;
  if (eyeParts.length) {
    const geometry = eyeParts.length > 1 ? mergeGeometries(eyeParts) : eyeParts[0];
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), S * 2);
    eyeBase = Float32Array.from(geometry.attributes.aCorner.array);
    eyes = new THREE.Mesh(
      geometry,
      createToonMaterial({
        ramp: [EYE_COLOR, C[1], PUPIL_COLOR, C[6], WHITE],
        steps: [0.2, 0.4, 0.6, 0.8],
        foliage: true,
        unlit: true,
        leafShade: [0, 1],
        outline: false,
        id: 41,
      }),
    );
    eyes.name = "eyes";
    pivot.add(eyes);
  }

  // Clignements : quelques-uns par boucle, à des instants tirés de la graine, parfois doublés.
  const blinkTimes = [];
  for (let i = 0; i < p.blinks; i++) {
    const c = (i + blinkRng.range(0.2, 0.8)) / p.blinks;
    blinkTimes.push(c);
    if (blinkRng.chance(0.3)) blinkTimes.push(c + (0.12 / DURATION) * 1.6);
  }
  function blinkAt(u) {
    const L = 0.12 / DURATION;
    let shut = 0;
    for (const c of blinkTimes) {
      let d = u - c;
      d -= Math.round(d);
      const k = Math.abs(d) / (L / 2);
      if (k < 1) shut = Math.max(shut, Math.sin((1 - k) * Math.PI * 0.5) ** 0.6);
    }
    return shut;
  }

  // --- Étincelles, gouttes, poussières : petits losanges face caméra, sans contour.
  const particles = [];
  const fxFans = [];
  const addParticle = (kind, data, layers) => {
    const first = fxFans.reduce((n, f) => n + f.outline.length + 1, 0);
    for (const [size, occlusion, lift] of layers) fxFans.push(fan(starOutline(4), size, [1, 1], occlusion, lift));
    const count = layers.length * 5;
    particles.push({ kind, ...data, first, count });
  };
  const fxOcc = { deep: 0.1, mid: 0.4, light: 0.6, white: 0.9 };
  for (let i = 0; i < p.sparks; i++) addParticle("spark", { i }, [[0.09, fxOcc.mid, 0], [0.05, fxOcc.white, 0.01]]);
  for (let i = 0; i < p.drips; i++) {
    const life = Math.min(DURATION * 0.9, fxRng.range(0.9, 1.6));
    addParticle("drip", { i, born: fxRng.next() * DURATION, life, offset: fxRng.range(-0.55, 0.55), azimuth: fxRng.range(0, TAU) }, [
      [0.06, fxOcc.light, 0], [0.04, fxOcc.white, 0.01],
    ]);
  }
  for (let i = 0; i < p.motes; i++) {
    const life = Math.min(DURATION * 0.95, fxRng.range(1.5, 3));
    const white = i % 4 === 0;
    addParticle("mote", {
      i, born: fxRng.next() * DURATION, life, angle: fxRng.range(0, TAU), radius: fxRng.range(1.3, 2.4) * S,
      height: fxRng.range(-0.8, 0.6) * S, wobble: fxRng.range(1, 2), rise: fxRng.range(4, 9) / 24 * S,
    }, [[0.05, white ? fxOcc.white : i % 2 ? fxOcc.light : fxOcc.deep, 0]]);
  }
  let fx = null, fxBase = null;
  if (fxFans.length) {
    const geometry = buildFanGeometry(fxFans);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, center, 0), S * 4);
    fxBase = Float32Array.from(geometry.attributes.aCorner.array);
    fx = new THREE.Mesh(
      geometry,
      createToonMaterial({
        ramp: [C[4], C[5], C[6], WHITE],
        steps: [0.25, 0.5, 0.75],
        foliage: true,
        unlit: true,
        leafShade: [0, 1],
        outline: false,
        id: 42,
      }),
    );
    fx.name = "sparks";
    facing.add(fx);
  }

  // --- Animation : recalculée quand le temps partagé change (ou que la caméra a tourné, pour les yeux).
  const now = newState();
  const then = newState();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const point = new THREE.Vector3();
  const view = new THREE.Vector3(0, 0, 1); // direction vers la caméra, repère du blob
  const right = new THREE.Vector3(1, 0, 0); // droite de l'écran, repère du blob
  const rightProbe = new THREE.Vector3();
  const cameraQuat = new THREE.Quaternion();
  const groupQuat = new THREE.Quaternion();
  let lastTime = NaN;
  let viewDirty = true;

  if (eyes) {
    // La caméra n'est connue qu'au rendu : on la note pour l'image suivante (raccourci des yeux vus de côté).
    eyes.onBeforeRender = (renderer, scene, camera) => {
      camera.getWorldQuaternion(cameraQuat);
      facing.getWorldQuaternion(groupQuat);
      point.set(0, 0, 1).applyQuaternion(cameraQuat).applyQuaternion(groupQuat.invert());
      rightProbe.set(1, 0, 0).applyQuaternion(cameraQuat).applyQuaternion(groupQuat);
      if (point.distanceToSquared(view) > 1e-6) {
        view.copy(point);
        right.copy(rightProbe);
        viewDirty = true;
      }
    };
  }

  function update(t) {
    state(t, now);
    pivot.position.copy(now.position);
    pivot.scale.copy(now.scale);
    pivot.rotation.copy(now.rotation);
    const u = now.u;

    // Le corps : chaque sommet à son rayon, puis les normales ; les courants les font dériver un peu.
    const position = bodyGeometry.attributes.position;
    const pa = position.array;
    for (let i = 0; i < pa.length; i += 3) {
      const dx = directions[i], dy = directions[i + 1], dz = directions[i + 2];
      const r = radiusAt(dx, dy, dz, u);
      pa[i] = dx * r;
      pa[i + 1] = dy * r;
      pa[i + 2] = dz * r;
    }
    position.needsUpdate = true;
    bodyGeometry.computeVertexNormals();
    if (p.currents > 0) {
      const na = bodyGeometry.attributes.normal.array;
      const amount = 0.32 * p.currents;
      const cx = Math.cos(TAU * u) * 1.4, cy = Math.sin(TAU * u) * 1.4;
      for (let i = 0; i < na.length; i += 3) {
        const x = directions[i] * 1.6 + cx, y = directions[i + 1] * 1.6 + cy, z = directions[i + 2] * 1.6;
        let nx = na[i] + (noiseC(x, y, z) - 0.5) * amount;
        let ny = na[i + 1] + (noiseC(x + 31, y, z) - 0.5) * amount;
        let nz = na[i + 2] + (noiseC(x, y + 57, z) - 0.5) * amount;
        const l = Math.hypot(nx, ny, nz) || 1;
        na[i] = nx / l;
        na[i + 1] = ny / l;
        na[i + 2] = nz / l;
      }
    }
    bodyGeometry.attributes.normal.needsUpdate = true;

    // Les yeux : posés sur la surface, raccourcis vus de côté, refermés en clignant, regard qui erre.
    if (eyes) {
      const lookX = loop(lookNoise, 1.7, 4.2, u, 1.1) * p.look;
      const lookY = loop(lookNoise, 6.2, 2.9, u, 1.1) * 0.7 * p.look;
      const fx0 = THREE.MathUtils.clamp(now.vx / (S * 1.25), -1, 1) * S * 0.12 + lookX * S * 0.06;
      const fy0 = THREE.MathUtils.clamp(now.vy / (S * 1.67), -1, 1) * S * 0.05 + lookY * S * 0.04;
      const open = 1 - blinkAt(u);
      const positionE = eyes.geometry.attributes.position;
      const cornerE = eyes.geometry.attributes.aCorner;
      const pe = positionE.array, ce = cornerE.array;
      const xs = [[], [0], [-1, 1], [-1, 0, 1]][eyeCount];
      const placed = xs.map((k) => {
        const ex = k * S * p.eyeSpacing * (eyeCount === 3 ? 1.25 : 1) + fx0;
        const ey = S * p.eyeHeight + fy0 + (eyeCount === 3 && k === 0 ? S * 0.12 : 0);
        const ez = Math.sqrt(Math.max(0.05 * S * S, S * S - ex * ex - ey * ey));
        point.set(ex, ey, ez).normalize();
        const r = radiusAt(point.x, point.y, point.z, u);
        // De face, l'œil est entier ; de côté, il s'aplatit ; de dos, il disparaît (le corps le cache aussi).
        const facing = point.dot(view);
        const squash = facing < 0.3 ? 0 : Math.min(1, facing * 1.1);
        return { x: point.x * (r + 0.01), y: point.y * (r + 0.01), z: point.z * (r + 0.01), squash };
      });
      // Le reflet : sur l'épaule tournée vers la caméra, vers le haut et la gauche de l'écran (côté soleil).
      point.copy(view).multiplyScalar(0.8).addScaledVector(right, -0.42).add(UP_HALF).normalize();
      const rh = radiusAt(point.x, point.y, point.z, u) + 0.02;
      placed.push({ x: point.x * rh, y: point.y * rh, z: point.z * rh, squash: 1 });
      const lift = Math.max(0.12, open);
      for (let v = 0; v < vertexEye.length; v++) {
        const e = placed[vertexEye[v]];
        pe[v * 3] = e.x;
        pe[v * 3 + 1] = e.y;
        pe[v * 3 + 2] = e.z;
        let cx = eyeBase[v * 3], cy = eyeBase[v * 3 + 1];
        if (vertexRole[v] === 2) {
          ce[v * 3] = cx;
          ce[v * 3 + 1] = cy;
          continue;
        }
        if (vertexRole[v] === 1) {
          cx += lookX * rx * 0.45;
          cy += lookY * ry * 0.4;
        }
        // Fermé, l'œil reste une ligne d'un pixel.
        const minHalf = 0.035;
        const sy = p.eyeShape === "happy" ? 1 : Math.max(lift, minHalf / Math.max(ry, 0.001));
        ce[v * 3] = cx * e.squash;
        ce[v * 3 + 1] = cy * Math.min(1, sy) * (e.squash > 0 ? 1 : 0);
      }
      positionE.needsUpdate = true;
      cornerE.needsUpdate = true;
    }

    // Étincelles, gouttes, poussières.
    if (fx) {
      const pf = fx.geometry.attributes.position.array, cf = fx.geometry.attributes.aCorner.array;
      const place = (particle, x, y, z, scale) => {
        for (let v = particle.first; v < particle.first + particle.count; v++) {
          pf[v * 3] = x;
          pf[v * 3 + 1] = y;
          pf[v * 3 + 2] = z;
          cf[v * 3] = fxBase[v * 3] * scale;
          cf[v * 3 + 1] = fxBase[v * 3 + 1] * scale;
        }
      };
      for (const particle of particles) {
        if (particle.kind === "spark") {
          const i = particle.i;
          const th = TAU * (u * (1 + (i % 2)) * (i % 3 === 2 ? -1 : 1) + i / p.sparks);
          const orbit = S * 1.6 * (1 + (i % 2) * 0.15);
          const tiltY = Math.sin(th) * orbit * 0.25;
          place(particle, now.position.x + Math.cos(th) * orbit, now.position.y + tiltY + (i % 2 ? 0.17 : -0.08) * S, now.position.z + Math.sin(th) * orbit, 1);
          continue;
        }
        let age = (((t - particle.born) % DURATION) + DURATION) % DURATION;
        if (age >= particle.life) {
          place(particle, now.position.x, now.position.y, now.position.z, 0);
          continue;
        }
        const k = age / particle.life;
        if (particle.kind === "drip") {
          // Partie du dessous du corps là où il était à sa naissance, puis tombe en s'éteignant.
          const alpha = 1 - k;
          if (alpha < 0.2) {
            place(particle, now.position.x, now.position.y, now.position.z, 0);
            continue;
          }
          state(t - age, then);
          const th = Math.atan2(1, particle.offset);
          const dx = Math.cos(th) * Math.cos(particle.azimuth), dz = Math.cos(th) * Math.sin(particle.azimuth), dy = -Math.sin(th);
          const r = radiusAt(dx, dy, dz, then.u) * 0.95;
          point.set(dx * r, dy * r, dz * r);
          quaternion.setFromEuler(then.rotation);
          matrix.compose(then.position, quaternion, then.scale);
          point.applyMatrix4(matrix);
          const fall = age * age * 1.08 * S;
          place(particle, point.x + Math.sin(age * 3 + particle.i) * 0.03, point.y - fall, point.z, k < 0.5 ? 1 : 0.75);
        } else {
          const alpha = Math.sin(Math.PI * k);
          if (alpha < 0.25) {
            place(particle, now.position.x, now.position.y, now.position.z, 0);
            continue;
          }
          const wob = Math.sin(age * particle.wobble) * 0.1 * S;
          place(
            particle,
            Math.cos(particle.angle) * particle.radius + wob,
            center + particle.height + age * particle.rise,
            Math.sin(particle.angle) * particle.radius - wob,
            1,
          );
        }
      }
      fx.geometry.attributes.position.needsUpdate = true;
      fx.geometry.attributes.aCorner.needsUpdate = true;
    }
  }

  // Le moteur appelle updateMatrixWorld avant chaque rendu (et avant la carte d'ombres) : on anime là.
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    const t = sharedUniforms.uTime.value;
    if (t !== lastTime || viewDirty) {
      lastTime = t;
      viewDirty = false;
      update(t);
    }
    baseUpdate(force);
  };
  update(0);
  lastTime = 0;

  group.userData.asset = { id: meta.id, params: p };
  return group;
}

/** Contour en amande (pointu aux deux bouts) pour un éventail, rayon 1. */
function almondOutline(sides) {
  const outline = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * TAU;
    const x = Math.cos(a);
    outline.push([x, Math.sin(a) * (1 - x * x * 0.45)]);
  }
  return outline;
}

/** Arc ∩ d'épaisseur w (œil plissé de bonheur), demi-largeur rx, hauteur h, pour `buildSpriteGeometry`. */
function arcSprite(rx, h, w, occlusion) {
  const points = [];
  const triangles = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const v = (i / n) * 2 - 1;
    const y = Math.sqrt(Math.max(0, 1 - v * v)) * h - h * 0.4;
    points.push([v * rx, y + w / 2], [v * rx, y - w / 2]);
    if (i < n) {
      const k = i * 2;
      triangles.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  return { position: new THREE.Vector3(), points, triangles, occlusion, flex: 0 };
}
