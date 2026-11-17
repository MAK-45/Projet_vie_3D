// Personnages humanoïdes importés et leurs animations.
//
// Tous partagent le même squelette (65 os, nommés comme le mannequin d'Unreal : root, pelvis, spine_01...,
// hand_l...) : n'importe quelle animation de la bibliothèque se joue sur n'importe quel personnage. Seules les
// rotations des os voyagent d'un corps à l'autre ; le bassin (hauteur) et la racine (déplacement) sont mis à
// l'échelle de la jambe du personnage, pour que les pieds ne glissent pas.
//
// Fichiers (public/models/) :
//   characters/<personnage>.glb (+ .png)  maillage simplifié (~5 000 triangles), texture de couleur 256 px
//   animations/ual-standard.glb           43 animations, sans maillage (Universal Animation Library)

import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { createGlowLight, createToonMaterial, rgb, sharedUniforms } from "../../engine/toon-material.js";
import { buildFanGeometry, ellipseOutline, starOutline } from "./geometry.js";
import { MAGIC_PALETTES, fitRamp } from "./palettes.js";
import { createRng } from "./rng.js";
import { choiceParam, numberParam } from "./variation.js";
import { loadGltf, loadModelTexture } from "./model.js";

export const ANIMATION_LIBRARY = "animations/ual-standard.glb";

// Filtres de lumière posés sur les textures : ombre froide (bleu-violet) → pleine lumière (couleur peinte).
const SKIN_LIGHT = ["#6d6aa6", "#b2a8cc", "#e9e1ea", "#ffffff"];
const SKIN_STEPS = [0.3, 0.52, 0.76];
const CHARACTER_ID = 44; // identifiant de contour : le corps entier est cerné d'un seul trait

/**
 * Les personnages : nom, fichier et matières de chaque partie (par nom de maillage ou de matériau).
 * `height` : taille réelle (m), pour l'emprise.
 */
export const CHARACTERS = {
  "superhero-female": {
    label: "Héroïne",
    labelEn: "Heroine",
    file: "characters/superhero-female.glb",
    height: 1.77,
    parts: {
      body: { texture: "characters/superhero-female.png", ramp: SKIN_LIGHT, steps: SKIN_STEPS },
      eyes: { texture: "characters/eye-brown.png", ramp: ["#c9c2dc", "#ffffff"], steps: [0.35] },
      brows: { ramp: ["#22161e", "#3a2420", "#523528"], steps: [0.4, 0.7] },
    },
  },
  "superhero-male": {
    label: "Héros",
    labelEn: "Hero",
    file: "characters/superhero-male.glb",
    height: 1.81,
    parts: {
      body: { texture: "characters/superhero-male.png", ramp: SKIN_LIGHT, steps: SKIN_STEPS },
      eyes: { texture: "characters/eye-brown.png", ramp: ["#c9c2dc", "#ffffff"], steps: [0.35] },
      brows: { ramp: ["#22161e", "#3a2420", "#523528"], steps: [0.4, 0.7] },
    },
  },
  mannequin: {
    label: "Mannequin",
    labelEn: "Mannequin",
    file: "characters/mannequin.glb",
    height: 1.8,
    parts: {
      M_Main: { ramp: ["#6b3546", "#b0573f", "#de8e3c", "#f2c262"], steps: SKIN_STEPS },
      M_Joints: { ramp: ["#2f2559", "#5a3a8e", "#8a58c4", "#b585e4"], steps: SKIN_STEPS },
    },
  },
  // La version humaine du blob : le corps du mannequin dans la matière de lumière de la Couveuse. Ses matières
  // dépendent de la palette choisie (`magicParts`) ; il éclaire le décor et porte les yeux du blob.
  "magic-mannequin": {
    label: "Mannequin magique",
    labelEn: "Magic mannequin",
    file: "characters/mannequin.glb",
    height: 1.8,
    magic: true,
    parts: null,
  },
};

// --- Le mannequin magique : matière, lumière et yeux du blob Couveuse.

/** Réglages par défaut de l'apparence magique (paramètres `magicParams`). */
export const MAGIC_LOOK = { palette: "ice", glow: 3, glowStrength: 1.4, currents: 1, eyes: "dark", sparks: 3, motes: 14 };
const MAGIC_EYES = { dark: "Sombres", bright: "Lumineux", none: "Aucun" };
const EYE_COLOR = "#0a1430";
const WHITE = "#ffffff";

/** Paramètres de l'apparence magique, pour la fiche du personnage. */
export function magicParams() {
  return {
    palette: choiceParam("Couleurs", MAGIC_PALETTES, "Les palettes du blob : Glace (sa couleur de naissance), Arcane, Braise, Sève, Aurore, Néon, Abysse, Lagon, Sang."),
    currents: numberParam("Courants", MAGIC_LOOK.currents, 0, 2, "Courants de lumière qui passent dans le corps.", { step: 0.05 }),
    glow: numberParam("Lumière", MAGIC_LOOK.glow, 0, 6, "Portée de la lumière qu'il répand dans le noir, dans la couleur de son corps (0 : aucune).", { step: 0.25, unit: "m" }),
    glowStrength: numberParam("Éclat", MAGIC_LOOK.glowStrength, 0.3, 2.5, "Force de cette lumière.", { step: 0.05 }),
    eyes: choiceParam("Yeux", MAGIC_EYES, "Les yeux du blob sur son visage : sombres, lumineux (blancs) ou aucun (le mannequin lisse)."),
    sparks: { type: "int", default: MAGIC_LOOK.sparks, min: 0, max: 8, label: "Étincelles", description: "Étincelles qui tournent autour de son torse." },
    motes: { type: "int", default: MAGIC_LOOK.motes, min: 0, max: 30, label: "Poussières", description: "Poussières de lumière qui montent autour de lui." },
  };
}

/**
 * Matières du corps magique : le corps prend la rampe du blob (couleurs 2 à 7 et le blanc du reflet), les
 * articulations sont des nœuds plus clairs ; liseré de lumière, pas de contour sombre, ombre propre claire.
 */
function magicParts(look) {
  const C = fitRamp((MAGIC_PALETTES[look.palette] ?? MAGIC_PALETTES.ice).colors, 8);
  const currents = look.currents > 0 ? [0.32 * look.currents, 3.2] : null;
  const light = { rim: [0.3, 0.5], outline: false, shadowLit: 0.55, glow: false, currents };
  return {
    colors: C,
    M_Main: { ramp: [C[2], C[3], C[4], C[5], C[6], WHITE], steps: [0.2, 0.45, 0.75, 0.96, 1.1], ...light },
    M_Joints: { ramp: [C[4], C[5], C[6], WHITE], steps: [0.25, 0.55, 0.85], ...light },
  };
}

/** Paramètre `character` : le corps qui joue l'animation. */
export function characterParam(description, defaultValue = "superhero-female") {
  return choiceParam("Personnage", Object.fromEntries(Object.entries(CHARACTERS).map(([id, c]) => [id, c.label])), description, defaultValue);
}

/** Paramètre `cadence` : images par seconde de l'animation (12 = saccadé façon sprite, comme le décor). */
export function cadenceParam() {
  return choiceParam(
    "Cadence",
    { sprite: "12 images/s", smooth: "Fluide" },
    "« 12 images/s » : la pose change par à-coups, comme un sprite dessiné ; « Fluide » : à chaque image.",
  );
}

/** Paramètre `speed` : vitesse de lecture. */
export function speedParam() {
  return numberParam("Vitesse", 1, 0.25, 2, "Vitesse de lecture de l'animation.", { step: 0.05, unit: "×" });
}

// --- Chargement et préparation

function partStyle(parts, mesh) {
  return parts[mesh.material?.name] ?? parts[mesh.name] ?? parts[mesh.parent?.name] ?? Object.values(parts)[0];
}

async function loadCharacter(character) {
  const spec = CHARACTERS[character];
  const gltf = await loadGltf(spec.file);
  const textures = {};
  await Promise.all(
    Object.values(spec.parts ?? {})
      .filter((part) => part.texture)
      .map(async (part) => (textures[part.texture] = await loadModelTexture(part.texture))),
  );
  return { gltf, textures };
}

/** Os de référence d'un modèle : position de repos du bassin (sa hauteur fixe l'échelle des jambes). */
function pelvisHeight(scene) {
  const pelvis = scene.getObjectByName("pelvis");
  return pelvis ? pelvis.position.length() : 1;
}

const clipCache = new Map();

/**
 * Animation prête pour un personnage : rotations telles quelles, bassin et racine à l'échelle de ses jambes,
 * déplacement de la racine annulé si `inPlace`.
 */
async function clipFor(name, character, inPlace) {
  const key = `${name}|${character}|${inPlace}`;
  if (!clipCache.has(key)) {
    clipCache.set(
      key,
      (async () => {
        const [library, body] = await Promise.all([loadGltf(ANIMATION_LIBRARY), loadGltf(CHARACTERS[character].file)]);
        const source = library.animations.find((clip) => clip.name === name);
        if (!source) throw new Error(`animation inconnue : ${name}`);
        const ratio = pelvisHeight(body.scene) / pelvisHeight(library.scene);
        const clip = source.clone();
        for (const track of clip.tracks) {
          if (!track.name.endsWith(".position")) continue;
          const values = track.values;
          for (let i = 0; i < values.length; i++) values[i] *= ratio;
          if (inPlace && track.name.startsWith("root.")) {
            for (let i = 0; i < values.length; i += 3) {
              values[i] = 0;
              values[i + 2] = 0;
            }
          }
        }
        return clip;
      })(),
    );
  }
  return clipCache.get(key);
}

/** Durée (s) d'une animation de la bibliothèque, une fois chargée ; sinon `null`. */
export async function clipDuration(name) {
  const library = await loadGltf(ANIMATION_LIBRARY);
  return library.animations.find((clip) => clip.name === name)?.duration ?? null;
}

function buildBody(parts, { gltf, textures }) {
  const body = cloneSkinned(gltf.scene);
  body.traverse((child) => {
    if (!child.isMesh) return;
    const style = partStyle(parts, child);
    child.material = createToonMaterial({
      ramp: style.ramp,
      steps: style.steps,
      map: style.texture ? (textures[style.texture] ?? null) : null,
      id: CHARACTER_ID,
      shadowLit: style.shadowLit ?? 0.4,
      rim: style.rim,
      outline: style.outline,
      glow: style.glow,
      currents: style.currents,
    });
    child.castShadow = true;
    child.receiveShadow = true;
    // Le corps sort de sa boîte de repos dès qu'il bouge : pas d'élimination hors champ.
    child.frustumCulled = false;
  });
  return body;
}

/**
 * Crée un personnage animé. Le groupe est rendu tout de suite, vide ; le corps et l'animation arrivent quand les
 * fichiers sont chargés (`group.userData.ready`). À chaque image : `group.userData.update(secondes écoulées)`.
 *
 * @param {object} options
 * @param {string} options.id identifiant de l'asset (userData.asset)
 * @param {object} options.params réglages de l'asset (userData.asset)
 * @param {keyof CHARACTERS} [options.character]
 * @param {Array<{clip: string, repeat?: number, hold?: number}>} [options.steps] enchaînement d'animations :
 *   chacune jouée `repeat` fois (1 par défaut), puis figée `hold` secondes ; l'enchaînement recommence à la fin.
 *   Une seule étape sans `hold` : boucle simple.
 * @param {boolean} [options.inPlace] annule le déplacement de la racine (marcher sur place)
 * @param {number} [options.speed] vitesse de lecture
 * @param {"sprite"|"smooth"} [options.cadence] 12 images/s ou fluide
 * @param {number} [options.offset] décalage de départ, en fraction de la première étape (0..1)
 * @param {object} [options.look] personnage magique : palette, currents, glow, glowStrength, eyes (voir MAGIC_LOOK)
 * @param {number} [options.seed] graine (clignements du personnage magique)
 */
export function createHumanoid({ id, params, character = "superhero-female", steps = [{ clip: "Idle_Loop" }], inPlace = true, speed = 1, cadence = "sprite", offset = 0, look = {}, seed = 0 }) {
  if (!(character in CHARACTERS)) character = "superhero-female";
  const group = new THREE.Group();
  group.name = id;
  group.userData.asset = { id, params };

  let mixer = null;
  let actions = [];
  let index = 0;
  let holding = 0;
  let pending = 0;
  const fps = cadence === "smooth" ? 0 : 12;
  const fade = fps ? 0 : 0.12;

  const play = (next) => {
    const previous = actions[index];
    index = next;
    const action = actions[index];
    action.reset();
    action.play();
    if (previous && previous !== action && fade > 0) previous.crossFadeTo(action, fade, false);
    else if (previous && previous !== action) previous.stop();
  };

  const advance = (seconds) => {
    if (!mixer) return;
    if (holding > 0) {
      holding -= seconds;
      if (holding <= 0) play((index + 1) % actions.length);
      return;
    }
    mixer.update(seconds);
  };

  group.userData.update = (delta) => {
    const seconds = delta * speed;
    if (!fps) return advance(seconds);
    pending += seconds;
    const frames = Math.floor(pending * fps);
    if (frames > 0) {
      pending -= frames / fps;
      advance(frames / fps);
    }
  };

  group.userData.ready = (async () => {
    const [loaded, clips] = await Promise.all([loadCharacter(character), Promise.all(steps.map((step) => clipFor(step.clip, character, inPlace)))]);
    const spec = CHARACTERS[character];
    const magic = spec.magic ? magicParts({ ...MAGIC_LOOK, ...look }) : null;
    const body = buildBody(magic ?? spec.parts, loaded);
    group.add(body);
    if (magic) addMagic(group, body, { ...MAGIC_LOOK, ...look }, magic.colors, seed);
    mixer = new THREE.AnimationMixer(body);
    const single = steps.length === 1 && !steps[0].hold;
    actions = steps.map((step, i) => {
      const action = mixer.clipAction(clips[i]);
      if (single) action.setLoop(THREE.LoopRepeat, Infinity);
      else {
        action.setLoop(THREE.LoopRepeat, step.repeat ?? 1);
        action.clampWhenFinished = true;
      }
      return action;
    });
    mixer.addEventListener("finished", () => {
      const step = steps[index];
      if (step.hold) holding = step.hold;
      else play((index + 1) % actions.length);
    });
    play(0);
    mixer.update(THREE.MathUtils.clamp(offset, 0, 0.999) * clips[0].duration);
    group.userData.mixer = mixer;
    return group;
  })();
  group.userData.ready.catch((error) => console.error(`${id} : ${error.message}`));
  return group;
}

/**
 * Ce que le mannequin magique a de plus que son corps, en un seul maillage de formes face caméra (un draw call) :
 * - les yeux du blob sur le visage, accrochés à l'os de la tête : ils suivent chaque mouvement, rapetissent de
 *   profil, disparaissent de dos et clignent ;
 * - des étincelles qui tournent autour du torse et des poussières de lumière qui montent autour de lui.
 * Et une lumière de halo au cœur du torse, qui éclaire le décor dans le noir.
 */
function addMagic(group, body, look, C, seed) {
  body.updateMatrixWorld(true);
  const meshes = [];
  body.traverse((child) => child.isSkinnedMesh && meshes.push(child));
  const chest = body.getObjectByName("spine_03") ?? body;
  const head = body.getObjectByName("Head");
  const rng = createRng(Number(seed) * 15485863 + 5);
  const ORIGIN = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  const fans = [];
  const shapes = []; // par forme : premier sommet, nombre de sommets, à qui elle appartient
  const add = (owner, outline, size, stretch, occlusion, lift, offset) => {
    const first = fans.reduce((n, f) => n + f.outline.length + 1, 0);
    fans.push({ position: ORIGIN, outline, size, stretch, normal: UP, phase: 0, variation: 0.5, flex: 0, occlusion, lift, offset });
    shapes.push({ owner, first, count: outline.length + 1 });
  };
  // Occlusion → couleur de la rampe [œil, corps clair, reflet, blanc].
  const occ = { eye: 0.1, mid: 0.4, light: 0.6, white: 0.9 };

  // --- Les yeux : le visage est trouvé dans la pose de repos, à partir des sommets portés par l'os de la tête.
  const eyes = [];
  let forward = null;
  if (head && look.eyes !== "none") {
    const points = [];
    const v = new THREE.Vector3();
    for (const mesh of meshes) {
      const bone = mesh.skeleton.bones.indexOf(head);
      if (bone < 0) continue;
      const skinIndex = mesh.geometry.attributes.skinIndex;
      const skinWeight = mesh.geometry.attributes.skinWeight;
      for (let i = 0; i < skinIndex.count; i++) {
        for (let k = 0; k < 4; k++) {
          if (skinIndex.getComponent(i, k) === bone && skinWeight.getComponent(i, k) > 0.5) {
            mesh.getVertexPosition(i, v);
            points.push(head.worldToLocal(mesh.localToWorld(v.clone())));
          }
        }
      }
    }
    if (points.length) {
      // Repère du visage dans l'os de la tête : devant = +Z du personnage, haut = +Y.
      const inverse = head.getWorldQuaternion(new THREE.Quaternion()).invert();
      forward = new THREE.Vector3(0, 0, 1).applyQuaternion(inverse);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(inverse);
      const side = new THREE.Vector3().crossVectors(up, forward);
      let upMin = Infinity, upMax = -Infinity, sideMin = Infinity, sideMax = -Infinity;
      for (const q of points) {
        upMin = Math.min(upMin, q.dot(up));
        upMax = Math.max(upMax, q.dot(up));
        sideMin = Math.min(sideMin, q.dot(side));
        sideMax = Math.max(sideMax, q.dot(side));
      }
      const height = upMax - upMin, width = sideMax - sideMin;
      const eyeUp = upMin + height * 0.52;
      const radius = width * 0.15;
      for (const k of [-1, 1]) {
        const eyeSide = (sideMin + sideMax) / 2 + k * width * 0.22;
        // Le devant du visage à cet endroit : le sommet le plus avancé autour du point.
        let front = -Infinity;
        for (const q of points) {
          if (Math.abs(q.dot(up) - eyeUp) < height * 0.2 && Math.abs(q.dot(side) - eyeSide) < width * 0.2) front = Math.max(front, q.dot(forward));
        }
        if (!Number.isFinite(front)) front = Math.max(...points.map((q) => q.dot(forward)));
        const eye = { at: new THREE.Vector3().addScaledVector(up, eyeUp).addScaledVector(side, eyeSide).addScaledVector(forward, front + 0.004) };
        eyes.push(eye);
        if (look.eyes === "bright") {
          add(eye, ellipseOutline(12), radius, [1, 1.3], occ.eye, 0);
          add(eye, ellipseOutline(12), radius * 0.62, [1, 1.3], occ.white, 0.004);
        } else {
          add(eye, ellipseOutline(12), radius, [1, 1.3], occ.eye, 0);
          add(eye, starOutline(4), radius * 0.4, [1, 1], occ.white, 0.004, [-radius * 0.35, radius * 0.45]);
        }
      }
    }
  }

  // --- Étincelles (tournent autour du torse et le suivent) et poussières (montent du sol autour de lui).
  for (let i = 0; i < look.sparks; i++) {
    const spark = {
      kind: "spark", angle: (i / look.sparks) * Math.PI * 2 + rng.range(-0.4, 0.4), radius: rng.range(0.38, 0.5),
      height: rng.range(-0.35, 0.25), speed: rng.range(0.6, 1) * (rng.chance(0.5) ? 1 : -1), bob: rng.range(0, 6.3),
    };
    add(spark, starOutline(4), 0.05, [1, 1], occ.light, 0);
    add(spark, starOutline(4), 0.032, [1, 1], occ.white, 0.01);
  }
  for (let i = 0; i < look.motes; i++) {
    const mote = {
      kind: "mote", born: rng.next() * 4, life: rng.range(1.5, 3), angle: rng.range(0, Math.PI * 2), radius: rng.range(0.3, 0.6),
      height: rng.range(0.1, 1.2), rise: rng.range(0.15, 0.35), wobble: rng.range(1, 2),
    };
    add(mote, starOutline(4), 0.035, [1, 1], i % 4 === 0 ? occ.white : i % 2 ? occ.light : occ.mid, 0);
  }

  let fx = null;
  if (fans.length) {
    fx = new THREE.Mesh(
      buildFanGeometry(fans),
      createToonMaterial({ ramp: ["#0a1430", C[5], C[6], WHITE], steps: [0.25, 0.5, 0.75], foliage: true, unlit: true, leafShade: [0, 1], outline: false, glow: false, id: 42 }),
    );
    fx.name = "magic";
    fx.frustumCulled = false;
    group.add(fx);
  }
  const position = fx?.geometry.attributes.position;
  const corner = fx?.geometry.attributes.aCorner;
  const cornerBase = corner ? Float32Array.from(corner.array) : null;

  // Clignements : deux par boucle de 4 s, à des instants tirés de la graine, parfois doublés.
  const blinkRng = createRng(Number(seed) * 104729 + 71);
  const blinks = [];
  for (let i = 0; i < 2; i++) {
    const c = (i + blinkRng.range(0.2, 0.8)) / 2;
    blinks.push(c);
    if (blinkRng.chance(0.3)) blinks.push(c + 0.05);
  }

  // La caméra n'est connue qu'au rendu : on note sa direction pour l'image suivante (yeux de profil, de dos).
  const toCamera = new THREE.Vector3(0, 0.6, 0.8);
  if (fx) fx.onBeforeRender = (renderer, scene, camera) => camera.getWorldDirection(toCamera).negate();

  const light = look.glow > 0 ? createGlowLight() : null;
  const lightColor = rgb(C[5]);
  const chestWorld = new THREE.Vector3();
  const chestLocal = new THREE.Vector3();
  const headQuaternion = new THREE.Quaternion();
  const worldForward = new THREE.Vector3();

  function place(shape, x, y, z, scale) {
    const a = position.array, c = corner.array;
    for (let k = 0; k < shape.count; k++) {
      const i = (shape.first + k) * 3;
      a[i] = x;
      a[i + 1] = y;
      a[i + 2] = z;
      c[i] = cornerBase[i] * scale;
      c[i + 1] = cornerBase[i + 1] * scale;
    }
  }

  function update() {
    const t = sharedUniforms.uTime.value;
    chest.getWorldPosition(chestWorld);
    group.worldToLocal(chestLocal.copy(chestWorld));
    // Yeux : entiers de face, plus petits de profil, absents de dos ou paupières closes.
    let eyeScale = 0;
    if (eyes.length) {
      worldForward.copy(forward).applyQuaternion(head.getWorldQuaternion(headQuaternion));
      const facing = worldForward.dot(toCamera);
      const u = ((t / 4) % 1 + 1) % 1;
      const shut = blinks.some((c) => Math.abs(u - c - Math.round(u - c)) < 0.015);
      eyeScale = shut || facing < 0.25 ? 0 : Math.min(1, facing * 1.15);
      for (const eye of eyes) group.worldToLocal(head.localToWorld((eye.local ??= new THREE.Vector3()).copy(eye.at)));
    }
    for (const shape of shapes) {
      const q = shape.owner;
      if (q.kind === "spark") {
        const angle = q.angle + t * q.speed * 1.6;
        place(shape, chestLocal.x + Math.cos(angle) * q.radius, chestLocal.y + q.height + Math.sin(t * 2.1 + q.bob) * 0.06, chestLocal.z + Math.sin(angle) * q.radius, 1);
      } else if (q.kind === "mote") {
        const age = (((t - q.born) % 4) + 4) % 4;
        const wob = Math.sin(age * q.wobble * 2) * 0.05;
        // Éteinte : réduite à un point au cœur du torse, caché par le corps.
        if (age >= q.life) place(shape, chestLocal.x, chestLocal.y, chestLocal.z, 0);
        else place(shape, chestLocal.x + Math.cos(q.angle) * q.radius + wob, q.height + age * q.rise, chestLocal.z + Math.sin(q.angle) * q.radius - wob, 1);
      } else {
        place(shape, q.local.x, q.local.y, q.local.z, eyeScale);
      }
    }
    position.needsUpdate = true;
    corner.needsUpdate = true;
  }

  // Le moteur appelle updateMatrixWorld avant chaque rendu : la lumière suit le torse, yeux et particules suivent
  // le corps (à chaque image : les os bougent aussi en cadence fluide).
  const baseUpdate = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = (force) => {
    baseUpdate(force);
    if (fx) update();
    if (light) light.set(chestWorld.setFromMatrixPosition(chest.matrixWorld), lightColor, look.glow, look.glowStrength);
  };

  const release = [];
  if (light) release.push(() => light.release());
  if (fx) release.push(() => fx.geometry.dispose());
  const first = meshes[0]?.material;
  if (first) first.addEventListener("dispose", () => release.forEach((fn) => fn()));
}

/** Arrête l'animation et libère les matériaux (les géométries et textures sont partagées par le cache). */
export function disposeHumanoid(group) {
  group.userData.mixer?.stopAllAction();
  group.traverse((child) => {
    if (child.isMesh) child.material.dispose();
  });
}
