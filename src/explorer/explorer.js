// Explorateur de monde : on configure la prairie d'été puis on s'y promène avec une barre rouge de 1,80 m, la
// caméra isométrique suit. Un seul objet, montable dans n'importe quel bloc : il vit dans la fiche de l'asset
// « Prairie d'été » de l'Atelier, et passe en plein écran pour la balade.

import * as THREE from "three";
import { IsoCamera, ISO_ELEVATION } from "../engine/iso-camera.js";
import { PixelRenderer, PIXELS_PER_UNIT } from "../engine/pixel-renderer.js";
import { setDarkness, setWind, tick } from "../engine/toon-material.js";
import { createAmbientLife } from "../fx/ambient-life.js";
import { createAtmosphere, MOMENTS, WEATHERS } from "../worlds/kit/atmosphere.js";
import { createSummerMeadow, MEADOW_SIZES } from "../worlds/summer-meadow.js";
import { WalkInput } from "./input.js";
import { Walker, WALKER_HEIGHT } from "./walker.js";

const STORAGE_KEY = "pv3d-meadow";
const MIN_ELEVATION = THREE.MathUtils.degToRad(11);
const MAX_ELEVATION = THREE.MathUtils.degToRad(68);
const STEP = Math.PI / 4; // la caméra ne tourne d'elle-même que par huitièmes de tour
const numberFormat = new Intl.NumberFormat("fr-FR");

export const CAMERAS = {
  fixed: { label: "Fixe" },
  orbit: { label: "Pivote" },
  follow: { label: "Suit" },
};

/** Curseurs d'abondance : nom du réglage, libellé, bornes. */
const AMOUNTS = [
  ["trees", "Arbres", 0, 2, 0.25],
  ["rocks", "Rochers", 0, 2, 0.25],
  ["grass", "Herbe", 0, 2, 0.25],
  ["flowers", "Fleurs", 0, 2, 0.25],
  ["relief", "Relief", 0.6, 3, 0.2],
];

export const DEFAULT_SETTINGS = {
  seed: 1, size: "medium", relief: 1.8, trees: 1, rocks: 1, grass: 1, flowers: 1, moment: "day", weather: "clear", camera: "fixed",
};

const choice = (name, label, options) => `
  <div class="x-choice" role="radiogroup" aria-label="${label}" data-choice="${name}">
    ${Object.entries(options).map(([value, option]) => `<button type="button" role="radio" data-value="${value}">${option.label}</button>`).join("")}
  </div>`;

const TEMPLATE = `
  <div class="x-stage" data-ref="stage" aria-label="Vue de la prairie"></div>

  <details class="x-panel x-settings" data-ref="settings">
    <summary><span class="x-brand">Prairie d'été</span> <span class="x-summary" data-ref="summary"></span></summary>
    <div class="x-fields">
      <div class="x-row">
        <label class="x-field"><span>Graine</span>
          <input type="number" min="0" max="9999" step="1" inputmode="numeric" data-ref="seed" /></label>
        <button type="button" class="x-button" data-ref="reroll">Au hasard</button>
        ${choice("size", "Taille de la carte", MEADOW_SIZES)}
      </div>
      <div class="x-sliders">
        ${AMOUNTS.map(([name, label, min, max, step]) => `
          <label class="x-slider"><span>${label}</span>
            <input type="range" min="${min}" max="${max}" step="${step}" data-amount="${name}" />
            <output data-output="${name}"></output></label>`).join("")}
      </div>
      <div class="x-row"><span class="x-label">Moment</span>${choice("moment", "Moment de la journée", MOMENTS)}</div>
      <div class="x-row"><span class="x-label">Météo</span>${choice("weather", "Météo", WEATHERS)}</div>
      <p class="x-note" data-ref="note"></p>
    </div>
  </details>

  <div class="x-joystick" data-ref="joystick" aria-hidden="true"><span class="x-knob"></span></div>

  <div class="x-panel x-actions">
    <div class="x-row">
      <button type="button" class="x-button" data-ref="stroll" aria-pressed="false">Balade auto</button>
      <span class="x-label">Caméra</span>${choice("camera", "Caméra pendant la balade", CAMERAS)}
    </div>
    <div class="x-row">
      <button type="button" class="x-button" data-ref="recenter">Vue de départ</button>
      <button type="button" class="x-button" data-ref="hide">Masquer l'interface</button>
      <button type="button" class="x-button x-primary" data-ref="immersive">Plein écran</button>
    </div>
    <p class="x-stats" data-ref="stats"></p>
  </div>

  <p class="x-hint">
    <span class="x-hint-keys">Flèches ou ZQSD : marcher · Maj : courir · A / E : tourner d'un cran · souris : tourner, incliner · molette : zoom</span>
    <span class="x-hint-touch">Rond rouge : marcher (à fond : courir) · un doigt : tourner, incliner · deux doigts : zoom</span>
    <span>La barre rouge mesure 1,80 m.</span>
  </p>

  <button type="button" class="x-reveal" data-ref="reveal" aria-label="Afficher l'interface">Interface</button>
  <div class="x-loading" data-ref="loading">Génération de la prairie…</div>
`;

export class Explorer {
  /**
   * @param {HTMLElement} container bloc qui accueille l'explorateur (il en prend toute la place)
   * @param {object} [options]
   * @param {object} [options.settings] réglages de départ (complétés par la mémoire locale et les défauts)
   * @param {boolean} [options.remember] retenir les réglages dans le navigateur
   * @param {(immersive: boolean) => void} [options.onImmersive] appelé quand on entre ou sort du plein écran
   */
  constructor(container, { settings = {}, remember = true, onImmersive } = {}) {
    this.root = document.createElement("div");
    this.root.className = "explorer";
    this.root.innerHTML = TEMPLATE;
    container.appendChild(this.root);
    this.onImmersive = onImmersive;
    this.remember = remember;
    this.immersive = false;

    this.settings = { ...DEFAULT_SETTINGS };
    if (remember) {
      try {
        Object.assign(this.settings, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
      } catch {
        // Pas de mémoire locale (navigation privée, aperçu) : réglages par défaut.
      }
    }
    Object.assign(this.settings, settings);
    this._sanitize();

    const ref = (name) => this.root.querySelector(`[data-ref="${name}"]`);
    this.ui = Object.fromEntries(
      ["stage", "settings", "summary", "seed", "reroll", "note", "joystick", "stroll", "recenter", "hide", "immersive", "stats", "reveal", "loading"].map((name) => [name, ref(name)]),
    );

    // --- Rendu
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;display:block;touch-action:none;";
    this.ui.stage.appendChild(this.canvas);
    this.pixel = new PixelRenderer({ canvas: this.canvas });
    // La carte d'ombre est refaite une image sur deux : le décor ne bouge qu'à 12 images par seconde.
    this.pixel.renderer.shadowMap.autoUpdate = false;
    this.iso = new IsoCamera(this.canvas, { distance: 220, far: 560 });
    const controls = this.iso.controls;
    controls.enablePan = false;
    controls.minZoom = 0.5;
    controls.maxZoom = 4;
    controls.minPolarAngle = Math.PI / 2 - MAX_ELEVATION;
    controls.maxPolarAngle = Math.PI / 2 - MIN_ELEVATION;
    controls.rotateSpeed = 0.6;

    this.scene = new THREE.Scene();
    this.walker = new Walker();
    this.scene.add(this.walker.object);
    this.input = new WalkInput(this.ui.joystick);
    this.life = createAmbientLife();
    this.scene.add(this.life.group);
    this.atmosphere = createAtmosphere();
    this.atmosphere.set(this.settings);

    this.world = null;
    this.look = new THREE.Vector3(); // point suivi par la caméra (le buste du promeneur, lissé en hauteur)
    this.view = { width: 1, height: 1, area: 1, radius: 1 };
    this.strolling = false;
    this._stroll = { x: 0, z: 0, stuck: 0, pause: 0 };
    this._turn = { active: false, from: 0, delta: 0, time: 0, wait: 6, held: 0 };
    this._meter = { time: 0, frames: 0, calls: 0, triangles: 0 };
    this._artPixel = 0;
    this._frameIndex = 0;
    this._visible = true;
    this._timer = new THREE.Timer();
    this._timer.connect(document);
    this._frame = this._frame.bind(this);

    this._bind();
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.ui.stage);
    this._intersectionObserver = new IntersectionObserver(([entry]) => {
      this._visible = entry.isIntersecting;
      this._updateLoop();
    });
    this._intersectionObserver.observe(this.root);

    // Réglages dépliés d'office là où il y a la place.
    this.ui.settings.open = container.clientWidth > 720;
    this._resize();
    this._rebuild();
    this.ui.loading.hidden = true;
    this._updateLoop();
  }

  /** Entre dans le monde (l'explorateur couvre tout l'écran) ou en sort. */
  setImmersive(value) {
    if (value === this.immersive) return;
    this.immersive = value;
    this.root.classList.toggle("is-immersive", value);
    document.documentElement.classList.toggle("pv3d-immersive", value);
    this.ui.immersive.textContent = value ? "Quitter" : "Plein écran";
    if (!value) this.setClean(false);
    this.onImmersive?.(value);
  }

  /** Masque ou montre toute l'interface, pour regarder le paysage. */
  setClean(value) {
    this.root.classList.toggle("is-clean", value);
  }

  setStrolling(value) {
    this.strolling = value;
    this.ui.stroll.setAttribute("aria-pressed", String(value));
    if (value) {
      this._stroll.pause = 0;
      this._turn.wait = 5;
      this._pickStrollTarget();
    }
  }

  /** Vue de départ : isométrique, cadrée pour montrer à peu près la même surface de pré sur tous les écrans. */
  resetView() {
    const zoom = Math.max(1, Math.round(Math.sqrt((this.view.width * this.view.height) / 390) * 8) / 8);
    this._turn.active = false;
    this.iso.setView({ azimuth: Math.PI / 4, elevation: ISO_ELEVATION, target: this.look, zoom });
  }

  /** Place la vue à la main (captures). Angles en degrés. */
  setView({ azimuth, elevation, zoom, x, z }) {
    if (x !== undefined || z !== undefined) {
      this.walker.placeAt(this.world, x ?? this.walker.position.x, z ?? this.walker.position.z);
      this.look.set(this.walker.position.x, this.walker.position.y + WALKER_HEIGHT * 0.55, this.walker.position.z);
      this.iso.follow(this.look);
      this.life.reset(this.world, this.walker.position);
    }
    this.iso.setView({
      azimuth: azimuth !== undefined ? THREE.MathUtils.degToRad(azimuth) : this.iso.azimuth,
      elevation: elevation !== undefined ? THREE.MathUtils.degToRad(elevation) : Math.PI / 2 - this.iso.controls.getPolarAngle(),
      target: this.look,
      zoom: zoom ?? this.iso.camera.zoom,
    });
  }

  dispose() {
    this.setImmersive(false);
    this.pixel.renderer.setAnimationLoop(null);
    this._resizeObserver.disconnect();
    this._intersectionObserver.disconnect();
    window.removeEventListener("keydown", this._onKey);
    this._timer.dispose();
    this.input.dispose();
    this.world?.dispose();
    this.life.dispose();
    this.walker.dispose();
    this.iso.dispose();
    this.pixel.dispose();
    this.root.remove();
  }

  // --- Interface -----------------------------------------------------------------------------------------------

  _bind() {
    const { ui, settings } = this;
    const regenerate = (options) => {
      ui.loading.hidden = false;
      // Laisse l'écran afficher « Génération… » avant de bloquer le fil le temps de construire le monde.
      requestAnimationFrame(() => setTimeout(() => {
        this._rebuild(options);
        ui.loading.hidden = true;
      }, 0));
    };
    const onChoice = {
      size: () => regenerate(),
      moment: () => this._applyMood(),
      weather: () => this._applyMood(),
      camera: () => this._save(),
    };
    for (const group of this.root.querySelectorAll("[data-choice]")) {
      const name = group.dataset.choice;
      const buttons = [...group.querySelectorAll("button")];
      const refresh = () => buttons.forEach((button) => button.setAttribute("aria-checked", String(button.dataset.value === settings[name])));
      for (const button of buttons) {
        button.addEventListener("click", () => {
          if (settings[name] === button.dataset.value) return;
          settings[name] = button.dataset.value;
          refresh();
          onChoice[name]();
        });
      }
      refresh();
    }

    ui.seed.value = String(settings.seed);
    ui.seed.addEventListener("change", () => {
      settings.seed = Number(ui.seed.value);
      this._sanitize();
      ui.seed.value = String(settings.seed);
      regenerate();
    });
    ui.reroll.addEventListener("click", () => {
      settings.seed = Math.floor(Math.random() * 10000);
      ui.seed.value = String(settings.seed);
      regenerate();
    });
    for (const slider of this.root.querySelectorAll("[data-amount]")) {
      const name = slider.dataset.amount;
      const output = this.root.querySelector(`[data-output="${name}"]`);
      const show = () => (output.textContent = name === "relief" ? `${Number(slider.value).toFixed(1)} m` : `× ${Number(slider.value)}`);
      slider.value = String(settings[name]);
      show();
      slider.addEventListener("input", show);
      // Le monde n'est refait qu'au relâchement du curseur, et le promeneur garde sa place.
      slider.addEventListener("change", () => {
        settings[name] = Number(slider.value);
        regenerate({ keepPlace: true });
      });
    }

    ui.stroll.addEventListener("click", () => this.setStrolling(!this.strolling));
    ui.recenter.addEventListener("click", () => this.resetView());
    ui.hide.addEventListener("click", () => this.setClean(true));
    ui.reveal.addEventListener("click", () => this.setClean(false));
    ui.immersive.addEventListener("click", () => this.setImmersive(!this.immersive));
    this.input.onAction = () => {
      if (this.strolling) this.setStrolling(false);
    };
    this._onKey = (event) => {
      if (event.key !== "Escape") return;
      if (this.root.classList.contains("is-clean")) this.setClean(false);
      else if (this.immersive) this.setImmersive(false);
    };
    window.addEventListener("keydown", this._onKey);
  }

  _sanitize() {
    const s = this.settings;
    const clamp = THREE.MathUtils.clamp;
    s.seed = clamp(Math.round(Number(s.seed)) || 0, 0, 9999);
    if (!(s.size in MEADOW_SIZES)) s.size = DEFAULT_SETTINGS.size;
    if (!(s.moment in MOMENTS)) s.moment = DEFAULT_SETTINGS.moment;
    if (!(s.weather in WEATHERS)) s.weather = DEFAULT_SETTINGS.weather;
    if (!(s.camera in CAMERAS)) s.camera = DEFAULT_SETTINGS.camera;
    for (const [name, , min, max] of AMOUNTS) {
      const value = Number(s[name]);
      s[name] = Number.isFinite(value) ? clamp(value, min, max) : DEFAULT_SETTINGS[name];
    }
  }

  _save() {
    if (!this.remember) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Sans mémoire locale, les réglages ne sont simplement pas retenus.
    }
  }

  _applyMood() {
    this.atmosphere.set(this.settings);
    this._save();
  }

  _describe() {
    const { world, settings, ui } = this;
    const c = world.counts;
    ui.summary.textContent = `graine ${settings.seed} · ${world.meters} m`;
    ui.note.textContent =
      `${world.meters} × ${world.meters} m · ${c.trees} arbres · ${c.rocks} rochers · ${numberFormat.format(c.tufts)} touffes d'herbe · ` +
      `${numberFormat.format(c.flowers)} massifs de fleurs · ${c.lawns} pelouses.`;
  }

  // --- Monde ---------------------------------------------------------------------------------------------------

  /** (Re)construit le monde selon les réglages. `keepPlace` : le promeneur reste où il est. */
  _rebuild({ keepPlace = false } = {}) {
    const { walker, look } = this;
    const place = keepPlace && this.world ? { x: walker.position.x, z: walker.position.z } : null;
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.world = createSummerMeadow(this.settings);
    this.scene.add(this.world.group);
    walker.placeAt(this.world, place?.x ?? this.world.spawn.x, place?.z ?? this.world.spawn.z);
    look.set(walker.position.x, walker.position.y + WALKER_HEIGHT * 0.55, walker.position.z);
    this.iso.follow(look);
    if (!place) {
      this.resetView();
      this._pickStrollTarget();
    }
    this.life.reset(this.world, walker.position);
    this._describe();
    this._save();
  }

  _pickStrollTarget() {
    const { bounds } = this.world;
    const margin = 9; // la balade reste hors de la brume du bord
    this._stroll.x = THREE.MathUtils.lerp(bounds.minX + margin, bounds.maxX - margin, Math.random());
    this._stroll.z = THREE.MathUtils.lerp(bounds.minZ + margin, bounds.maxZ - margin, Math.random());
    this._stroll.stuck = 0;
  }

  _resize() {
    const stage = this.ui.stage;
    const cssWidth = stage.clientWidth;
    const cssHeight = stage.clientHeight;
    if (!cssWidth || !cssHeight) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    // Environ 560 pixels d'art sur le grand côté : assez fin pour lire une fleur, assez gros pour rester du pixel art.
    this.pixel.pixelSize = Math.max(1, Math.round((Math.max(cssWidth, cssHeight) * dpr) / 560));
    this._artPixel = this.pixel.pixelSize / dpr;
    const size = this.pixel.setSize(cssWidth + this._artPixel * 2, cssHeight + this._artPixel * 2, dpr);
    this.canvas.style.left = `${-this._artPixel}px`;
    this.canvas.style.top = `${-this._artPixel}px`;
    this.iso.setViewport(size.width, size.height);
    this.view.width = size.width / PIXELS_PER_UNIT;
    this.view.height = size.height / PIXELS_PER_UNIT;
  }

  _updateLoop() {
    this.pixel.renderer.setAnimationLoop(this._visible ? this._frame : null);
  }

  /** Lance un quart de tour franc de la caméra vers l'azimut voulu (par le plus court chemin). */
  _turnTo(azimuth) {
    const turn = this._turn;
    turn.from = this.iso.azimuth;
    turn.delta = Math.atan2(Math.sin(azimuth - turn.from), Math.cos(azimuth - turn.from));
    if (Math.abs(turn.delta) < 0.01) return;
    turn.time = 0;
    turn.active = true;
  }

  /**
   * La caméra ne tourne jamais lentement d'elle-même : en pixel art, chaque image d'une rotation redessine tous
   * les pixels autrement, et une rotation lente fait fourmiller le sol sans arrêt. Elle tourne par crans de 45°,
   * d'un geste bref, puis reste immobile.
   */
  _steerCamera(dt, moving) {
    const turn = this._turn;
    const input = this.input;
    // Clavier : un appui = un cran.
    if (input.turn !== 0 && turn.held === 0 && !turn.active) this._turnTo(Math.round(this.iso.azimuth / STEP) * STEP - input.turn * STEP);
    turn.held = input.turn;

    if (this.strolling && !turn.active) {
      turn.wait -= dt;
      const mode = this.settings.camera;
      if (mode === "orbit" && turn.wait <= 0) {
        this._turnTo(Math.round(this.iso.azimuth / STEP) * STEP + STEP);
        turn.wait = 9;
      } else if (mode === "follow" && turn.wait <= 0 && moving) {
        // Derrière le promeneur : la caméra regarde dans le sens de sa marche.
        const behind = Math.round((this.walker.heading + Math.PI) / STEP) * STEP;
        const off = Math.atan2(Math.sin(behind - this.iso.azimuth), Math.cos(behind - this.iso.azimuth));
        if (Math.abs(off) > STEP * 1.2) {
          this._turnTo(behind);
          turn.wait = 2.5;
        }
      }
    }

    if (turn.active) {
      turn.time = Math.min(1, turn.time + dt / 0.8);
      const eased = turn.time * turn.time * (3 - 2 * turn.time);
      this.iso.setView({
        azimuth: turn.from + turn.delta * eased,
        elevation: Math.PI / 2 - this.iso.controls.getPolarAngle(),
        target: this.look,
      });
      if (turn.time >= 1) turn.active = false;
    }
  }

  _frame() {
    const { iso, input, walker, world, look, view, pixel, atmosphere } = this;
    this._timer.update();
    const dt = Math.min(this._timer.getDelta(), 0.1);
    const elapsed = this._timer.getElapsed();
    tick(elapsed);
    input.update();

    // Direction de marche dans le monde : relative à la caméra, ou vers le but de la balade automatique.
    const azimuth = iso.azimuth;
    let dirX = Math.cos(azimuth) * input.x - Math.sin(azimuth) * input.y;
    let dirZ = -Math.sin(azimuth) * input.x - Math.cos(azimuth) * input.y;
    let run = input.run;
    if (this.strolling) {
      const stroll = this._stroll;
      const dx = stroll.x - walker.position.x;
      const dz = stroll.z - walker.position.z;
      const distance = Math.hypot(dx, dz);
      run = false;
      if (stroll.pause > 0) {
        stroll.pause -= dt; // halte pour regarder le paysage
        dirX = dirZ = 0;
      } else if (distance < 1.5 || stroll.stuck > 1.5) {
        this._pickStrollTarget();
        stroll.pause = 2.5;
        dirX = dirZ = 0;
      } else {
        dirX = (dx / distance) * 0.62;
        dirZ = (dz / distance) * 0.62;
      }
    }
    walker.update(dt, dirX, dirZ, run, world);
    if (this.strolling && this._stroll.pause <= 0) this._stroll.stuck = walker.speed < 0.3 ? this._stroll.stuck + dt : 0;

    // La caméra suit le buste ; sa hauteur est lissée pour ne pas tressauter sur les bosses.
    const height = walker.position.y + WALKER_HEIGHT * 0.55;
    look.set(walker.position.x, look.y + (height - look.y) * Math.min(1, dt * 5), walker.position.z);
    iso.follow(look);
    this._steerCamera(dt, walker.speed > 0.5);
    iso.update();

    const camera = iso.camera;
    const elevation = Math.PI / 2 - iso.controls.getPolarAngle();
    const width = view.width / camera.zoom;
    const depth = view.height / camera.zoom / Math.max(0.15, Math.sin(elevation));
    view.area = width * depth;
    view.radius = Math.hypot(width, depth) / 2;

    // Heure et météo.
    atmosphere.update(dt);
    const mood = atmosphere.values;
    pixel.setMood({ grade: mood.grade, saturation: mood.saturation, rain: mood.rain, time: elapsed });
    pixel.setBackground(mood.skyBottom, mood.skyTop);
    setWind(mood.wind);
    setDarkness(mood.night);
    world.setMood(mood);
    this.life.setMood(mood.night, mood.rain);

    const shadows = this._frameIndex++ % 2 === 0;
    world.update({ camera, target: look, dt, viewArea: view.area, viewRadius: view.radius, shadows });
    pixel.renderer.shadowMap.needsUpdate = shadows;
    this.life.update(dt, elapsed, walker.position, view.radius);

    pixel.render(this.scene, camera);
    this.canvas.style.transform = `translate(${iso.subPixel.x * this._artPixel}px, ${-iso.subPixel.y * this._artPixel}px)`;
    this._measure(dt);
  }

  /** Moyennes par image sur une demi-seconde (la passe d'ombre ne tourne qu'une image sur deux). */
  _measure(dt) {
    const meter = this._meter;
    meter.time += dt;
    meter.frames += 1;
    meter.calls += this.pixel.info.calls;
    meter.triangles += this.pixel.info.triangles;
    if (meter.time < 0.5) return;
    this.stats = {
      fps: Math.round(meter.frames / meter.time),
      calls: Math.round(meter.calls / meter.frames),
      triangles: Math.round(meter.triangles / meter.frames),
    };
    meter.time = meter.frames = meter.calls = meter.triangles = 0;
    this.ui.stats.textContent =
      `${this.stats.fps} i/s · ${this.stats.calls} draw calls · ${numberFormat.format(Math.round(this.stats.triangles / 1000))} k tri.`;
  }
}
