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
import { createToonMaterial } from "../../engine/toon-material.js";
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
};

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

function partStyle(character, mesh) {
  const parts = CHARACTERS[character].parts;
  return parts[mesh.material?.name] ?? parts[mesh.name] ?? parts[mesh.parent?.name] ?? Object.values(parts)[0];
}

async function loadCharacter(character) {
  const spec = CHARACTERS[character];
  const gltf = await loadGltf(spec.file);
  const textures = {};
  await Promise.all(
    Object.values(spec.parts)
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

function buildBody(character, { gltf, textures }) {
  const body = cloneSkinned(gltf.scene);
  body.traverse((child) => {
    if (!child.isMesh) return;
    const style = partStyle(character, child);
    child.material = createToonMaterial({
      ramp: style.ramp,
      steps: style.steps,
      map: style.texture ? (textures[style.texture] ?? null) : null,
      id: CHARACTER_ID,
      shadowLit: 0.4,
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
 */
export function createHumanoid({ id, params, character = "superhero-female", steps = [{ clip: "Idle_Loop" }], inPlace = true, speed = 1, cadence = "sprite", offset = 0 }) {
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
    const body = buildBody(character, loaded);
    group.add(body);
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

/** Arrête l'animation et libère les matériaux (les géométries et textures sont partagées par le cache). */
export function disposeHumanoid(group) {
  group.userData.mixer?.stopAllAction();
  group.traverse((child) => {
    if (child.isMesh) child.material.dispose();
  });
}
