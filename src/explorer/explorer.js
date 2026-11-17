// Explorateur de monde : on configure la prairie d'été puis on s'y promène avec le personnage choisi (barre rouge de 1,80 m, blob en lévitation ou personnage qui marche), la
// caméra isométrique suit. Un seul objet, montable dans n'importe quel bloc : il vit dans la fiche de l'asset
// « Prairie d'été » de l'Atelier, et passe en plein écran pour la balade.

import * as THREE from "three";
import { ChaseCamera } from "../engine/chase-camera.js";
import { IsoCamera, ISO_ELEVATION } from "../engine/iso-camera.js";
import { PixelRenderer, PIXELS_PER_UNIT } from "../engine/pixel-renderer.js";
import { setCurvature, setDarkness, setWind, tick } from "../engine/toon-material.js";
import { createAmbientLife } from "../fx/ambient-life.js";
import { createAtmosphere, MOMENTS, WEATHERS } from "../worlds/kit/atmosphere.js";
import { createSummerMeadow, MEADOW_EXTENTS } from "../worlds/summer-meadow.js";
import { WalkInput } from "./input.js";
import { CHARACTERS, Walker } from "./walker.js";

const STORAGE_KEY = "pv3d-meadow";
const MIN_ELEVATION = THREE.MathUtils.degToRad(11);
/**
 * Prairie infinie : la vue ne recule ni ne se couche autant que sur une île, pour que la caméra ne voie jamais
 * plus loin que les morceaux fabriqués autour du promeneur (et que leur nombre reste petit).
 */
const ENDLESS_MIN_ELEVATION = THREE.MathUtils.degToRad(24);
const ENDLESS_MIN_ZOOM = 0.6;
const MAX_ELEVATION = THREE.MathUtils.degToRad(68);
const STEP = Math.PI / 4; // la caméra ne tourne d'elle-même que par huitièmes de tour
const numberFormat = new Intl.NumberFormat("fr-FR");
const POINTER_EVENTS = ["pointerdown", "pointermove", "pointerup", "pointercancel"];

/**
 * Vue à la 3e personne : portée de la vue (m) et portée du semis par famille. L'herbe et les fleurs (« fine ») ne
 * sont dessinées que de près : au-delà, une touffe ne fait qu'un ou deux pixels d'art.
 *
 * Dans un monde sans bord, pas de brume : le monde est courbé comme une petite planète (rayon THIRD_CURVE_RADIUS,
 * à partir de THIRD_CURVE_START du promeneur). Le sol passe derrière l'horizon vers 53 m (caméra à 3 m), ce qui
 * est ras du sol vers 75 m, les rochers vers 100 m, les plus grands arbres (15 m) vers 160 à 180 m : la vue
 * s'arrête juste après, sans qu'on la voie finir. Au-delà de THIRD_LOD, les arbres sont dessinés allégés (kit/far-tree.js) ; au-delà de
 * THIRD_GROUND_REACH, le sol n'est plus dessiné (il est sous l'horizon). Sur une île (monde fini), la brume reste.
 */
const THIRD_FAR = 185;
const THIRD_CURVE_RADIUS = 400;
const THIRD_CURVE_START = 20;
const THIRD_REACH = { fine: 34, flat: 75, low: 100 };
const THIRD_LOD = { tall: 50 };
const THIRD_GROUND_REACH = 100;
const THIRD_FOG_NEAR = 100; // île seulement
/** Monde sans bord : rayon (m) où tout est gardé prêt quelle que soit la direction de la vue ; au-delà, seuls les
 * morceaux dans le champ sont fabriqués, un peu par image. */
const THIRD_AROUND = 110;
const THIRD_SHADOW_AHEAD = 14; // la carte d'ombre est centrée devant le promeneur, là où l'on regarde (m)
const THIRD_SHADOW_RADIUS = 24; // (+ 14 m de marge dans le monde)
/** Au-delà (m de la caméra), le semis ne projette plus d'ombre : c'est hors de la carte d'ombre. */
const THIRD_SHADOW_REACH = THIRD_SHADOW_AHEAD + THIRD_SHADOW_RADIUS + 14 + 6;

/**
 * Caméras : les trois premières sont isométriques (la maquette vue d'en haut) et ne diffèrent que pendant la balade
 * auto ; la 3e personne est une vraie caméra perspective derrière le promeneur, pour voir le décor devant soi.
 */
export const CAMERAS = {
  fixed: { label: "Fixe" },
  orbit: { label: "Pivote" },
  follow: { label: "Suit" },
  third: { label: "3e pers." },
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
  seed: 1, size: "medium", relief: 1.8, trees: 1, rocks: 1, grass: 1, flowers: 1, moment: "day", weather: "clear", camera: "fixed", character: "bar",
};

const SIZE_NOTES = {
  bar: "La barre rouge mesure 1,80 m.",
  blob: "Le blob lévite à 1 m du sol (0,90 m de diamètre).",
  "superhero-female": "L'héroïne mesure 1,77 m. Elle marche, et attend quand on la laisse.",
  "superhero-male": "Le héros mesure 1,81 m. Il marche, et attend quand on le laisse.",
  mannequin: "Le mannequin mesure 1,80 m. Il marche, et attend quand on le laisse.",
  "magic-mannequin": "Le mannequin magique mesure 1,80 m et éclaire le décor la nuit. Il marche, et attend quand on le laisse.",
};

const choice = (name, label, options) => `
  <div class="x-choice" role="radiogroup" aria-label="${label}" data-choice="${name}">
    ${Object.entries(options).map(([value, option]) => `<button type="button" role="radio" data-value="${value}">${option.label}</button>`).join("")}
  </div>`;

/** Petites icônes en pixels (grille de 16), dessinées en traits pleins comme un sprite. */
const ICONS = {
  menu: '<path d="M2 3h12v2H2zM2 7h12v2H2zM2 11h12v2H2z"/>',
  close: '<path d="M3 3h2v2H3zM5 5h2v2H5zM7 7h2v2H7zM9 5h2v2H9zM11 3h2v2h-2zM5 9h2v2H5zM3 11h2v2H3zM9 9h2v2H9zM11 11h2v2h-2z"/>',
  landscape: '<path d="M1 4h14v8H1zm2 2v4h10V6z"/><path d="M11 7h1v2h-1z"/>',
  fullscreen: '<path d="M1 1h5v2H3v3H1zM10 1h5v5h-2V3h-3zM1 10h2v3h3v2H1zM13 10h2v5h-5v-2h3z"/>',
  hide: '<path d="M5 4h6v2H5zM3 6h2v2H3zM11 6h2v2h-2zM1 8h2v2H1zM13 8h2v2h-2zM3 10h2v2H3zM11 10h2v2h-2zM5 12h6v2H5zM7 8h2v2H7z"/>',
};
const icon = (name) => `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges" fill="currentColor">${ICONS[name]}</svg>`;

/** Un groupe titré dans une page de réglages. */
const group = (title, body) => `<section class="x-group"><h3 class="x-group-title">${title}</h3>${body}</section>`;

/**
 * Pages du panneau de réglages, dans l'ordre des onglets. Pour une nouvelle catégorie (interactions avec le décor,
 * scénario...), ajouter une entrée ici ; pour un nouveau réglage, un groupe dans la page qui lui revient.
 * Les actions du personnage (s'asseoir, cueillir, lancer un sort...) iront dans « Actions ».
 */
const PAGES = [
  {
    id: "world",
    label: "Monde",
    html: () => `
      ${group("Carte", `
        <div class="x-row">
          <label class="x-field"><span>Graine</span>
            <input type="number" min="0" max="9999" step="1" inputmode="numeric" data-ref="seed" /></label>
          <button type="button" class="x-button" data-ref="reroll">Au hasard</button>
        </div>
        ${choice("size", "Taille de la carte", MEADOW_EXTENTS)}
        <p class="x-note" data-ref="note"></p>`)}
      ${group("Décor", `
        <div class="x-sliders">
          ${AMOUNTS.map(([name, label, min, max, step]) => `
            <label class="x-slider"><span>${label}</span>
              <input type="range" min="${min}" max="${max}" step="${step}" data-amount="${name}" />
              <output data-output="${name}"></output></label>`).join("")}
        </div>`)}`,
  },
  {
    id: "sky",
    label: "Ciel",
    html: () => `
      ${group("Moment", choice("moment", "Moment de la journée", MOMENTS))}
      ${group("Météo", choice("weather", "Météo", WEATHERS))}`,
  },
  {
    id: "character",
    label: "Personnage",
    html: () => `
      ${group("Qui se promène", `${choice("character", "Personnage", CHARACTERS)}<p class="x-note" data-ref="sizeNote"></p>`)}`,
  },
  {
    id: "actions",
    label: "Actions",
    html: () => `
      ${group("Se déplacer", `
        <div class="x-row"><button type="button" class="x-button" data-ref="stroll" aria-pressed="false">Balade auto</button></div>
        <p class="x-note">Le personnage choisit seul où aller ; toucher la manette reprend la main.</p>`)}`,
  },
  {
    id: "camera",
    label: "Caméra",
    html: () => `
      ${group("Vue", `
        ${choice("camera", "Caméra", CAMERAS)}
        <div class="x-row"><button type="button" class="x-button" data-ref="recenter">Vue de départ</button></div>`)}
      ${group("Commandes", `
        <p class="x-note x-keys x-iso-only">Flèches ou ZQSD : marcher · Maj : courir · A / E : tourner d'un cran · souris : tourner, incliner · molette : zoom</p>
        <p class="x-note x-touch x-iso-only">Rond rouge : marcher (à fond : courir) · un doigt : tourner, incliner · deux doigts : zoom</p>
        <p class="x-note x-keys x-third-only">Flèches ou ZQSD : marcher · Maj : courir · A / E : tourner la vue · souris : regarder autour · molette : reculer, approcher</p>
        <p class="x-note x-touch x-third-only">Rond rouge : marcher (à fond : courir) · un doigt : regarder autour · deux doigts : reculer, approcher</p>`)}`,
  },
];

const TEMPLATE = `
  <div class="x-stage" data-ref="stage" aria-label="Vue de la prairie"></div>

  <button type="button" class="x-fps" data-ref="fps" aria-label="Images par seconde (toucher pour le détail)">– i/s</button>

  <div class="x-toolbar" role="toolbar" aria-label="Affichage">
    <button type="button" class="x-icon" data-ref="landscape" aria-pressed="false" aria-label="Paysage" title="Paysage">${icon("landscape")}</button>
    <button type="button" class="x-icon" data-ref="immersive" aria-pressed="false" aria-label="Plein écran" title="Plein écran">${icon("fullscreen")}</button>
    <button type="button" class="x-icon" data-ref="hide" aria-label="Masquer l'interface" title="Masquer l'interface">${icon("hide")}</button>
    <button type="button" class="x-icon x-menu" data-ref="menu" aria-expanded="false" aria-controls="x-drawer" title="Réglages">${icon("menu")}<span>Réglages</span></button>
  </div>

  <section class="x-panel x-drawer" data-ref="drawer" hidden aria-label="Réglages">
    <header class="x-drawer-head">
      <span class="x-brand">Prairie d'été</span> <span class="x-summary" data-ref="summary"></span>
      <button type="button" class="x-icon x-close" data-ref="close" aria-label="Fermer les réglages">${icon("close")}</button>
    </header>
    <nav class="x-tabs" role="tablist">
      ${PAGES.map((page) => `<button type="button" role="tab" data-tab="${page.id}">${page.label}</button>`).join("")}
    </nav>
    <div class="x-pages">
      ${PAGES.map((page) => `<div class="x-page" role="tabpanel" data-page="${page.id}">${page.html()}</div>`).join("")}
    </div>
  </section>

  <div class="x-joystick" data-ref="joystick" aria-hidden="true"><span class="x-knob"></span></div>

  <button type="button" class="x-reveal x-icon" data-ref="reveal" aria-label="Afficher l'interface" title="Afficher l'interface">${icon("menu")}</button>
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
      ["stage", "drawer", "menu", "close", "summary", "seed", "reroll", "note", "joystick", "stroll", "recenter", "hide", "immersive", "landscape", "fps", "reveal", "loading", "sizeNote"].map((name) => [name, ref(name)]),
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
    // Vue à la 3e personne : caméra perspective derrière le promeneur, brume de lointain dans le rendu.
    this.chase = new ChaseCamera(this.canvas, { far: THIRD_FAR });
    this.pixel.fog.near = THIRD_FOG_NEAR;
    this.pixel.fog.far = THIRD_FAR * 0.97; // remis à 0 (pas de brume) dans un monde courbé : voir _frame
    this._shadowCenter = new THREE.Vector3();

    this.scene = new THREE.Scene();
    this.walker = new Walker(this.settings.character);
    this.ui.sizeNote.textContent = SIZE_NOTES[this.walker.kind];
    this.scene.add(this.walker.object);
    this.input = new WalkInput(this.ui.joystick, { mapPoint: (x, y) => this._toLocal(x, y) });
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

    this.landscape = false;
    this._rotated = false;
    this._showTab("world");
    this._resize();
    this._rebuild();
    this._applyView();
    this.ui.loading.hidden = true;
    this._updateLoop();
  }

  /** Entre dans le monde (l'explorateur couvre tout l'écran) ou en sort. */
  setImmersive(value) {
    if (value === this.immersive) return;
    this.immersive = value;
    this.root.classList.toggle("is-immersive", value);
    document.documentElement.classList.toggle("pv3d-immersive", value);
    this.ui.immersive.setAttribute("aria-pressed", String(value));
    this.ui.immersive.setAttribute("aria-label", value ? "Quitter le plein écran" : "Plein écran");
    this.ui.immersive.title = this.ui.immersive.getAttribute("aria-label");
    if (!value) {
      this.setClean(false);
      this.setLandscape(false);
    }
    this.onImmersive?.(value);
  }

  /** Masque ou montre toute l'interface, pour regarder le paysage (le compteur d'images reste). */
  setClean(value) {
    this.root.classList.toggle("is-clean", value);
  }

  /** Ouvre ou ferme le panneau de réglages. */
  setMenu(open) {
    this.ui.drawer.hidden = !open;
    this.ui.menu.setAttribute("aria-expanded", String(open));
    this.root.classList.toggle("is-menu-open", open);
  }

  /**
   * Paysage : sur un téléphone tenu droit, l'explorateur passe en plein écran et l'écran se verrouille à
   * l'horizontale (API Screen Orientation). Là où le verrou est refusé (navigateur intégré, iPhone, page dans un
   * cadre), la vue est tournée d'un quart de tour en CSS : on tourne le téléphone et l'image est à l'endroit.
   */
  async setLandscape(value) {
    if (value === this.landscape) return;
    this.landscape = value;
    this.ui.landscape.setAttribute("aria-pressed", String(value));
    if (value) {
      this.setImmersive(true);
      this._locked = false;
      try {
        if (!document.fullscreenElement) await this.root.requestFullscreen?.({ navigationUI: "hide" });
        await screen.orientation.lock("landscape");
        this._locked = true;
      } catch {
        // Verrou refusé : la rotation CSS prend le relais.
      }
    } else {
      if (this._locked) screen.orientation.unlock?.();
      this._locked = false;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }
    this._applyRotation();
  }

  /** Tourne la vue d'un quart de tour quand le paysage est demandé, que l'écran est en hauteur et pas verrouillé. */
  _applyRotation() {
    const rotate = this.landscape && !this._locked && window.innerHeight > window.innerWidth;
    this._rotated = rotate;
    this.root.classList.toggle("is-rotated", rotate);
    const style = this.root.style;
    if (rotate) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      style.width = `${height}px`;
      style.height = `${width}px`;
      style.transform = `translateX(${width}px) rotate(90deg)`; // haut de l'image à droite : téléphone tourné vers la gauche
    } else {
      style.width = style.height = style.transform = "";
    }
  }

  /** Point de l'écran (clientX, clientY) dans le repère de l'explorateur, tourné ou non. */
  _toLocal(x, y) {
    return this._rotated ? [y, window.innerWidth - x] : [x, y];
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

  /** Vue de départ : dans le dos du promeneur (3e personne), ou isométrique, cadrée pour montrer à peu près la même
   * surface de pré sur tous les écrans. */
  resetView() {
    if (this.settings.camera === "third") {
      this.chase.reset(this.walker.heading);
      return;
    }
    const zoom = Math.max(1, Math.round(Math.sqrt((this.view.width * this.view.height) / 390) * 8) / 8);
    this._turn.active = false;
    this.iso.setView({ azimuth: Math.PI / 4, elevation: ISO_ELEVATION, target: this.look, zoom });
  }

  /** Place la vue à la main (captures). Angles en degrés ; en 3e personne, `zoom` est le recul (m). */
  setView({ azimuth, elevation, zoom, x, z }) {
    if (x !== undefined || z !== undefined) {
      this.walker.placeAt(this.world, x ?? this.walker.position.x, z ?? this.walker.position.z);
      this.look.set(this.walker.position.x, this.walker.position.y + this.walker.lookHeight, this.walker.position.z);
      this.iso.follow(this.look);
      this.life.reset(this.world, this.walker.position);
    }
    if (this.settings.camera === "third") {
      const toRad = THREE.MathUtils.degToRad;
      if (azimuth !== undefined) this.walker.heading = toRad(azimuth) + Math.PI; // le promeneur regarde dans le sens de la vue
      this.chase.setAngles({
        yaw: azimuth !== undefined ? toRad(azimuth) : undefined,
        pitch: elevation !== undefined ? toRad(elevation) : undefined,
        distance: zoom,
      });
      return;
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
    window.removeEventListener("resize", this._onViewport);
    document.removeEventListener("fullscreenchange", this._onFullscreen);
    for (const type of POINTER_EVENTS) window.removeEventListener(type, this._onPointer, true);
    this._timer.dispose();
    this.input.dispose();
    this.world?.dispose();
    this.life.dispose();
    this.walker.dispose();
    this.iso.dispose();
    this.chase.dispose();
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
      camera: () => {
        this._applyView();
        this._save();
      },
      character: () => {
        this.walker.setCharacter(settings.character);
        ui.sizeNote.textContent = SIZE_NOTES[this.walker.kind];
        this._save();
      },
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
    ui.landscape.addEventListener("click", () => this.setLandscape(!this.landscape));
    ui.menu.addEventListener("click", () => this.setMenu(ui.drawer.hidden));
    ui.close.addEventListener("click", () => this.setMenu(false));
    ui.fps.addEventListener("click", () => this.root.classList.toggle("is-fps-detail"));
    for (const tab of this.root.querySelectorAll("[data-tab]")) tab.addEventListener("click", () => this._showTab(tab.dataset.tab));

    // Vue tournée en CSS : les gestes sont ramenés dans le repère de l'explorateur avant d'atteindre caméras et
    // manette (capture sur la fenêtre, donc avant tout autre écouteur).
    this._onPointer = (event) => {
      if (!this._rotated || event.__local) return;
      const [x, y] = this._toLocal(event.clientX, event.clientY);
      for (const [name, value] of [["clientX", x], ["clientY", y], ["pageX", x], ["pageY", y]]) {
        Object.defineProperty(event, name, { value, configurable: true });
      }
      event.__local = true;
    };
    for (const type of POINTER_EVENTS) window.addEventListener(type, this._onPointer, true);
    this._onViewport = () => this._applyRotation();
    window.addEventListener("resize", this._onViewport);
    this._onFullscreen = () => {
      // Sortie du plein écran par le geste retour : le verrou d'orientation tombe avec lui.
      if (!document.fullscreenElement && this._locked) {
        this._locked = false;
        this.landscape = false;
        this.ui.landscape.setAttribute("aria-pressed", "false");
        this._applyRotation();
      }
    };
    document.addEventListener("fullscreenchange", this._onFullscreen);
    this.input.onAction = () => {
      if (this.strolling) this.setStrolling(false);
    };
    this._onKey = (event) => {
      if (event.key !== "Escape") return;
      if (!ui.drawer.hidden) this.setMenu(false);
      else if (this.root.classList.contains("is-clean")) this.setClean(false);
      else if (this.immersive) this.setImmersive(false);
    };
    window.addEventListener("keydown", this._onKey);
  }

  /** Affiche une page du panneau de réglages. */
  _showTab(id) {
    for (const tab of this.root.querySelectorAll("[data-tab]")) tab.setAttribute("aria-selected", String(tab.dataset.tab === id));
    for (const page of this.root.querySelectorAll("[data-page]")) page.hidden = page.dataset.page !== id;
  }

  _sanitize() {
    const s = this.settings;
    const clamp = THREE.MathUtils.clamp;
    s.seed = clamp(Math.round(Number(s.seed)) || 0, 0, 9999);
    if (!(s.size in MEADOW_EXTENTS)) s.size = DEFAULT_SETTINGS.size;
    if (!(s.moment in MOMENTS)) s.moment = DEFAULT_SETTINGS.moment;
    if (!(s.weather in WEATHERS)) s.weather = DEFAULT_SETTINGS.weather;
    if (!(s.camera in CAMERAS)) s.camera = DEFAULT_SETTINGS.camera;
    if (!(s.character in CHARACTERS)) s.character = DEFAULT_SETTINGS.character;
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

  /** Passe d'une vue à l'autre : une seule caméra reçoit les gestes. La 3e personne part du dos du promeneur. */
  _applyView() {
    const third = this.settings.camera === "third";
    this.root.classList.toggle("is-third", third);
    this.iso.controls.enabled = !third;
    this.chase.enabled = third;
    this._turn.active = false;
    this.canvas.style.transform = "";
    if (third) this.chase.reset(this.walker.heading);
  }

  _applyMood() {
    this.atmosphere.set(this.settings);
    this._save();
  }

  _describe() {
    const { world, settings, ui } = this;
    const c = world.counts;
    if (world.endless) {
      ui.summary.textContent = `graine ${settings.seed} · infinie`;
      ui.note.textContent =
        "Prairie sans bord : elle se fabrique au fil de la marche, et redonne le même pré quand on revient sur ses pas.";
      return;
    }
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
    this._limitView();
    walker.placeAt(this.world, place?.x ?? this.world.spawn.x, place?.z ?? this.world.spawn.z);
    look.set(walker.position.x, walker.position.y + walker.lookHeight, walker.position.z);
    this.iso.follow(look);
    if (!place) {
      this.resetView();
      this._pickStrollTarget();
    }
    this.life.reset(this.world, walker.position);
    this._describe();
    this._save();
  }

  /** Bornes du zoom et de l'inclinaison selon le monde (une prairie infinie ne se regarde pas de si loin). */
  _limitView() {
    const controls = this.iso.controls;
    const endless = Boolean(this.world.endless);
    controls.minZoom = endless ? ENDLESS_MIN_ZOOM : 0.5;
    controls.maxPolarAngle = Math.PI / 2 - (endless ? ENDLESS_MIN_ELEVATION : MIN_ELEVATION);
    const camera = this.iso.camera;
    if (camera.zoom < controls.minZoom) {
      camera.zoom = controls.minZoom;
      camera.updateProjectionMatrix();
    }
    controls.update();
  }

  _pickStrollTarget() {
    const { bounds } = this.world;
    if (this.world.endless) {
      // Sans bord : un but à quelques dizaines de mètres, dans une direction proche de la précédente, pour que la
      // balade avance au lieu de tourner en rond.
      const walker = this.walker.position;
      const heading = (this._stroll.heading ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 1.6;
      const distance = 15 + Math.random() * 30;
      this._stroll.heading = heading;
      this._stroll.x = walker.x + Math.cos(heading) * distance;
      this._stroll.z = walker.z + Math.sin(heading) * distance;
      this._stroll.stuck = 0;
      return;
    }
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
    this.chase.setViewport(size.width, size.height);
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
    const { iso, chase, input, walker, world, look, view, pixel, atmosphere } = this;
    const third = this.settings.camera === "third";
    this._timer.update();
    const dt = Math.min(this._timer.getDelta(), 0.1);
    const elapsed = this._timer.getElapsed();
    tick(elapsed);
    input.update();

    // Direction de marche dans le monde : relative à la caméra, ou vers le but de la balade automatique.
    const azimuth = third ? chase.azimuth : iso.azimuth;
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
    const height = walker.position.y + walker.lookHeight;
    look.set(walker.position.x, look.y + (height - look.y) * Math.min(1, dt * 5), walker.position.z);
    iso.follow(look);
    let camera;
    let reach = null;
    let shadowCenter = look;
    if (third) {
      chase.update(dt, { target: look, heading: walker.heading, speed: walker.speed, turn: input.turn, world, lead: this.strolling });
      camera = chase.camera;
      // L'herbe garde toute sa densité : c'est sa portée (THIRD_REACH) qui borne son coût.
      view.area = 1;
      view.radius = THIRD_SHADOW_RADIUS;
      reach = THIRD_REACH;
      const curved = Boolean(this.world.endless);
      setCurvature(camera.position.x, camera.position.z, curved ? THIRD_CURVE_RADIUS : 0, THIRD_CURVE_START);
      this.pixel.fog.far = curved ? 0 : THIRD_FAR * 0.97; // 0 : pas de brume
      // Ombres là où l'on regarde : un disque devant le promeneur, dans le sens de la vue.
      shadowCenter = this._shadowCenter.set(
        look.x - Math.sin(chase.yaw) * THIRD_SHADOW_AHEAD,
        look.y,
        look.z - Math.cos(chase.yaw) * THIRD_SHADOW_AHEAD,
      );
    } else {
      setCurvature(0, 0, 0);
      this._steerCamera(dt, walker.speed > 0.5);
      iso.update();
      camera = iso.camera;
      const elevation = Math.PI / 2 - iso.controls.getPolarAngle();
      const width = view.width / camera.zoom;
      const depth = view.height / camera.zoom / Math.max(0.15, Math.sin(elevation));
      view.area = width * depth;
      view.radius = Math.hypot(width, depth) / 2;
    }

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
    world.update({
      camera, target: look, dt, viewArea: view.area, viewRadius: view.radius, shadows, reach, shadowCenter,
      shadowReach: third ? THIRD_SHADOW_REACH : Infinity,
      around: third ? THIRD_AROUND : 0,
      lod: third ? THIRD_LOD : null,
      groundReach: third ? THIRD_GROUND_REACH : Infinity, // monde sans bord : tout autour est prêt, la vue peut se retourner
    });
    pixel.renderer.shadowMap.needsUpdate = shadows;
    this.life.update(dt, elapsed, walker.position, view.radius);

    pixel.render(this.scene, camera);
    if (!third) this.canvas.style.transform = `translate(${iso.subPixel.x * this._artPixel}px, ${-iso.subPixel.y * this._artPixel}px)`;
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
    // En haut à gauche, en direct ; le détail (draw calls, triangles) au toucher.
    this.ui.fps.textContent = this.root.classList.contains("is-fps-detail")
      ? `${this.stats.fps} i/s · ${this.stats.calls} dc · ${numberFormat.format(Math.round(this.stats.triangles / 1000))} k tri.`
      : `${this.stats.fps} i/s`;
  }
}
