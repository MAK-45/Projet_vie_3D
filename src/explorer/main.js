// Explorateur de monde : on se promène dans une prairie d'été avec une barre rouge de 1,80 m, la caméra
// isométrique suit. Trois habillages du même terrain à comparer, une graine et une taille au choix.

import * as THREE from "three";
import { IsoCamera, ISO_ELEVATION } from "../engine/iso-camera.js";
import { PixelRenderer, PIXELS_PER_UNIT } from "../engine/pixel-renderer.js";
import { tick } from "../engine/toon-material.js";
import { createAmbientLife } from "../fx/ambient-life.js";
import { createSummerMeadow, MEADOW_SIZES, MEADOW_VARIANTS } from "../worlds/summer-meadow.js";
import { WalkInput } from "./input.js";
import { Walker, WALKER_HEIGHT } from "./walker.js";

const STORAGE_KEY = "pv3d-explorer";
const MIN_ELEVATION = THREE.MathUtils.degToRad(11);
const MAX_ELEVATION = THREE.MathUtils.degToRad(68);
const numberFormat = new Intl.NumberFormat("fr-FR");

const $ = (id) => document.getElementById(id);
const stage = $("stage");
const canvas = document.createElement("canvas");
canvas.style.cssText = "position:absolute;display:block;touch-action:none;";
stage.appendChild(canvas);

// --- Réglages : mémoire locale, puis paramètres d'URL (pour les captures en développement) -------------------------
const settings = { variant: "ready", seed: 1, size: "medium" };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
} catch {
  // Pas de mémoire locale (navigation privée, aperçu) : réglages par défaut.
}
const query = new URLSearchParams(location.search);
for (const name of ["variant", "size"]) if (query.has(name)) settings[name] = query.get(name);
if (query.has("seed")) settings.seed = Number(query.get("seed"));
if (!(settings.variant in MEADOW_VARIANTS)) settings.variant = "ready";
if (!(settings.size in MEADOW_SIZES)) settings.size = "medium";
settings.seed = THREE.MathUtils.clamp(Math.round(Number(settings.seed)) || 0, 0, 9999);

// --- Rendu -----------------------------------------------------------------------------------------------------
const pixel = new PixelRenderer({ canvas });
// La carte d'ombre est refaite une image sur deux : le décor ne bouge qu'à 12 images par seconde.
pixel.renderer.shadowMap.autoUpdate = false;
pixel.setBackground("#dcefe9", "#7fb4e0");
const iso = new IsoCamera(canvas, { distance: 220, far: 520 });
iso.controls.enablePan = false;
iso.controls.minZoom = 0.5;
iso.controls.maxZoom = 4;
iso.controls.minPolarAngle = Math.PI / 2 - MAX_ELEVATION;
iso.controls.maxPolarAngle = Math.PI / 2 - MIN_ELEVATION;
iso.controls.rotateSpeed = 0.6;

const scene = new THREE.Scene();
const walker = new Walker();
scene.add(walker.object);
const input = new WalkInput($("joystick"));
const life = createAmbientLife();
scene.add(life.group);

let world = null;
let artPixel = 0;
let frameIndex = 0;
let strolling = false;
const stroll = { x: 0, z: 0, stuck: 0, pause: 0 };
const look = new THREE.Vector3(); // point suivi par la caméra (le buste du promeneur, lissé en hauteur)
const view = { width: 1, height: 1, area: 1, radius: 1 };
const timer = new THREE.Timer();
timer.connect(document);

function resize() {
  const cssWidth = stage.clientWidth;
  const cssHeight = stage.clientHeight;
  if (!cssWidth || !cssHeight) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  // Environ 560 pixels d'art sur le grand côté : assez fin pour lire une fleur, assez gros pour rester du pixel art.
  pixel.pixelSize = Math.max(1, Math.round((Math.max(cssWidth, cssHeight) * dpr) / 560));
  artPixel = pixel.pixelSize / dpr;
  const size = pixel.setSize(cssWidth + artPixel * 2, cssHeight + artPixel * 2, dpr);
  canvas.style.left = `${-artPixel}px`;
  canvas.style.top = `${-artPixel}px`;
  iso.setViewport(size.width, size.height);
  view.width = size.width / PIXELS_PER_UNIT;
  view.height = size.height / PIXELS_PER_UNIT;
}

/**
 * Vue de départ : isométrique, cadrée pour montrer à peu près la même surface de pré sur un téléphone tenu
 * debout que sur un grand écran (le promeneur fait alors une quarantaine de pixels de haut).
 */
function resetView() {
  const zoom = Math.max(1, Math.round(Math.sqrt((view.width * view.height) / 390) * 8) / 8);
  iso.setView({ azimuth: Math.PI / 4, elevation: ISO_ELEVATION, target: look, zoom });
}

/** (Re)construit le monde selon les réglages. Le promeneur garde sa place si seul l'habillage change. */
function rebuild({ keepPlace = false } = {}) {
  const place = keepPlace && world ? { x: walker.position.x, z: walker.position.z } : null;
  if (world) {
    scene.remove(world.group);
    world.dispose();
  }
  world = createSummerMeadow(settings);
  scene.add(world.group);
  walker.placeAt(world, place?.x ?? world.spawn.x, place?.z ?? world.spawn.z);
  look.set(walker.position.x, walker.position.y + WALKER_HEIGHT * 0.55, walker.position.z);
  iso.follow(look);
  if (!place) {
    resetView();
    pickStrollTarget();
  }
  life.reset(world, walker.position);
  describeWorld();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Sans mémoire locale, les réglages ne sont simplement pas retenus.
  }
}

function pickStrollTarget() {
  const margin = 6;
  stroll.x = THREE.MathUtils.lerp(world.bounds.minX + margin, world.bounds.maxX - margin, Math.random());
  stroll.z = THREE.MathUtils.lerp(world.bounds.minZ + margin, world.bounds.maxZ - margin, Math.random());
  stroll.stuck = 0;
}

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const elapsed = timer.getElapsed();
  tick(elapsed);
  input.update();

  // Direction de marche dans le monde : relative à la caméra, ou vers le but de la balade automatique.
  const azimuth = iso.azimuth;
  let dirX = Math.cos(azimuth) * input.x - Math.sin(azimuth) * input.y;
  let dirZ = -Math.sin(azimuth) * input.x - Math.cos(azimuth) * input.y;
  let run = input.run;
  if (strolling) {
    const dx = stroll.x - walker.position.x;
    const dz = stroll.z - walker.position.z;
    const distance = Math.hypot(dx, dz);
    if (stroll.pause > 0) {
      // Halte pour regarder le paysage.
      stroll.pause -= dt;
      dirX = dirZ = 0;
    } else if (distance < 1.5 || stroll.stuck > 1.5) {
      pickStrollTarget();
      stroll.pause = 2.5;
      dirX = dirZ = 0;
    } else {
      dirX = (dx / distance) * 0.62;
      dirZ = (dz / distance) * 0.62;
      run = false;
    }
  }
  walker.update(dt, dirX, dirZ, run, world);
  if (strolling && stroll.pause <= 0) stroll.stuck = walker.speed < 0.3 ? stroll.stuck + dt : 0;

  // La caméra suit le buste ; sa hauteur est lissée pour ne pas tressauter sur les bosses.
  const height = walker.position.y + WALKER_HEIGHT * 0.55;
  look.set(walker.position.x, look.y + (height - look.y) * Math.min(1, dt * 5), walker.position.z);
  iso.follow(look);
  iso.controls.autoRotate = strolling || input.turn !== 0;
  iso.controls.autoRotateSpeed = input.turn !== 0 ? input.turn * 14 : 0.5;
  iso.update();

  const camera = iso.camera;
  const elevation = Math.PI / 2 - iso.controls.getPolarAngle();
  const width = view.width / camera.zoom;
  const depth = view.height / camera.zoom / Math.max(0.15, Math.sin(elevation));
  view.area = width * depth;
  view.radius = Math.hypot(width, depth) / 2;
  const shadows = frameIndex++ % 2 === 0;
  world.update({ camera, cameraAzimuth: azimuth, target: look, dt, viewRadius: view.radius, shadows });
  pixel.renderer.shadowMap.needsUpdate = shadows;
  life.update(dt, elapsed, walker.position, view.radius);

  pixel.render(scene, camera);
  canvas.style.transform = `translate(${iso.subPixel.x * artPixel}px, ${-iso.subPixel.y * artPixel}px)`;
  measure(dt);
}

// --- Mesures affichées -----------------------------------------------------------------------------------------
// Moyennes par image sur une demi-seconde (la passe d'ombre ne tourne qu'une image sur deux).
const meter = { time: 0, frames: 0, calls: 0, triangles: 0, fps: 0, averageCalls: 0, averageTriangles: 0 };
function measure(dt) {
  meter.time += dt;
  meter.frames += 1;
  meter.calls += pixel.info.calls;
  meter.triangles += pixel.info.triangles;
  if (meter.time < 0.5) return;
  meter.fps = Math.round(meter.frames / meter.time);
  meter.averageCalls = Math.round(meter.calls / meter.frames);
  meter.averageTriangles = Math.round(meter.triangles / meter.frames);
  meter.time = meter.frames = meter.calls = meter.triangles = 0;
  const detail = world.stats().fraction;
  $("stats").textContent =
    `${meter.fps} i/s · ${meter.averageCalls} draw calls · ${numberFormat.format(Math.round(meter.averageTriangles / 1000))} k tri.` +
    (MEADOW_VARIANTS[settings.variant].detail && detail < 1 ? ` · herbe ${Math.round(detail * 100)} %` : "");
}

function describeWorld() {
  const c = world.counts;
  const parts = [`${world.meters} × ${world.meters} m`, `${c.trees} arbres`, `${c.rocks} rochers`];
  if (c.tufts) parts.push(`${numberFormat.format(c.tufts)} touffes d'herbe`, `${numberFormat.format(c.flowers)} massifs de fleurs`, `${c.lawns} pelouses`);
  $("world-note").textContent = `${MEADOW_VARIANTS[settings.variant].note} ${parts.join(" · ")}.`;
  $("terrain-summary").textContent = `graine ${settings.seed} · ${MEADOW_SIZES[settings.size].label.toLowerCase()} (${world.meters} m)`;
}

// --- Interface -------------------------------------------------------------------------------------------------
function bindChoice(container, name, onChange) {
  const buttons = [...container.querySelectorAll("button")];
  const refresh = () => {
    for (const button of buttons) button.setAttribute("aria-checked", String(button.dataset.value === settings[name]));
  };
  for (const button of buttons) {
    button.addEventListener("click", () => {
      if (settings[name] === button.dataset.value) return;
      settings[name] = button.dataset.value;
      refresh();
      onChange();
    });
  }
  refresh();
}

/** Laisse l'écran afficher « Génération… » avant de bloquer le fil le temps de construire le monde. */
function regenerate(options) {
  $("loading").hidden = false;
  requestAnimationFrame(() =>
    setTimeout(() => {
      rebuild(options);
      $("loading").hidden = true;
    }, 0),
  );
}

function setStrolling(value) {
  strolling = value;
  $("stroll").setAttribute("aria-pressed", String(value));
  if (value) {
    stroll.pause = 0;
    pickStrollTarget();
  }
}

bindChoice($("variant"), "variant", () => regenerate({ keepPlace: true }));
bindChoice($("size"), "size", () => regenerate());
const seedInput = $("seed");
seedInput.value = String(settings.seed);
seedInput.addEventListener("change", () => {
  settings.seed = THREE.MathUtils.clamp(Math.round(Number(seedInput.value)) || 0, 0, 9999);
  seedInput.value = String(settings.seed);
  regenerate();
});
$("reroll").addEventListener("click", () => {
  settings.seed = Math.floor(Math.random() * 10000);
  seedInput.value = String(settings.seed);
  regenerate();
});
$("stroll").addEventListener("click", () => setStrolling(!strolling));
$("recenter").addEventListener("click", resetView);
input.onAction = () => {
  if (strolling) setStrolling(false);
};

// Réglages du terrain dépliés d'office là où il y a la place.
$("terrain").open = window.matchMedia("(min-width: 641px)").matches;

new ResizeObserver(resize).observe(stage);
resize();
rebuild();

// Réglages de vue par l'URL, pour les captures : ?az=45&el=30&zoom=1&x=0&z=0&stroll=1
if (query.has("x") || query.has("z")) {
  walker.placeAt(world, Number(query.get("x") ?? world.spawn.x), Number(query.get("z") ?? world.spawn.z));
  look.set(walker.position.x, walker.position.y + WALKER_HEIGHT * 0.55, walker.position.z);
  iso.follow(look);
  life.reset(world, walker.position);
}
if (query.has("az") || query.has("el") || query.has("zoom")) {
  iso.setView({
    azimuth: THREE.MathUtils.degToRad(Number(query.get("az") ?? 45)),
    elevation: query.has("el") ? THREE.MathUtils.degToRad(Number(query.get("el"))) : ISO_ELEVATION,
    target: look,
    zoom: Number(query.get("zoom") ?? iso.camera.zoom),
  });
}
if (query.get("stroll") === "1") setStrolling(true);

$("loading").hidden = true;
pixel.renderer.setAnimationLoop(frame);
window.explorer = { settings, pixel, iso, walker, meter, get world() { return world; }, rebuild, view };
