// Visionneuse d'asset : une scène de présentation (socle, soleil, ombre) rendue par le pipeline pixel art,
// avec caméra isométrique orbitale. Sert à la fiche d'un asset et aux vignettes du catalogue.

import * as THREE from "three";
import { IsoCamera, ISO_ELEVATION } from "../engine/iso-camera.js";
import { PixelRenderer, PIXELS_PER_UNIT } from "../engine/pixel-renderer.js";
import { createToonMaterial, disposeObject, setWind, tick } from "../engine/toon-material.js";

const SUN_ELEVATION = THREE.MathUtils.degToRad(52);
const SUN_AZIMUTH_OFFSET = THREE.MathUtils.degToRad(-62); // le soleil vient de la gauche de l'écran

export class Viewer {
  /**
   * @param {HTMLElement} container bloc qui accueille le canvas (position: relative ; overflow: hidden)
   * @param {{interactive?: boolean}} [options]
   */
  constructor(container, { interactive = true } = {}) {
    this.container = container;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;display:block;touch-action:none;";
    container.appendChild(this.canvas);

    this.pixel = new PixelRenderer({ canvas: this.canvas });
    this.iso = new IsoCamera(this.canvas);
    this.iso.controls.enabled = interactive;
    this.scene = new THREE.Scene();

    this.options = {
      pixelArt: true,
      outline: true,
      wireframe: false,
      wind: true,
      ground: true,
      autoRotate: false,
      pixelSize: 0, // 0 = automatique
    };

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.bias = -0.0015;
    this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun, this.sun.target);

    this.ground = new THREE.Group();
    this.scene.add(this.ground);
    this.asset = null;
    this.assetModule = null;
    this.footprint = { radius: 2, height: 4 };

    this.stats = { triangles: 0, calls: 0, width: 0, height: 0 };
    this.assetStats = { triangles: 0, drawCalls: 0 };
    this.onStats = null;
    this._cssSize = { width: 1, height: 1 };
    this._running = false;
    this._visible = true;
    this._timer = new THREE.Timer();
    this._timer.connect(document);
    this._frame = this._frame.bind(this);

    this.pixel.setBackground("#cfe6ea", "#8db6d8");

    if (interactive) {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(container);
      this._intersectionObserver = new IntersectionObserver(([entry]) => {
        this._visible = entry.isIntersecting;
        this._updateLoop();
      });
      this._intersectionObserver.observe(container);
      this.canvas.addEventListener("pointerdown", () => {
        if (this.options.autoRotate) this.setOption("autoRotate", false, true);
      });
    }
  }

  /** Affiche un asset (module avec `meta` et `create`). Recadre la vue si l'asset change. */
  setAsset(module, params = {}) {
    const changed = module !== this.assetModule;
    if (this.asset) {
      this.scene.remove(this.asset);
      disposeObject(this.asset);
    }
    this.assetModule = module;
    this.asset = module.create(params);
    this.scene.add(this.asset);
    this._applyWireframe();

    // Mesures de l'asset seul (sans socle ni passe d'ombre).
    this.assetStats = { triangles: 0, drawCalls: 0 };
    this.asset.traverse((child) => {
      if (!child.isMesh) return;
      const geometry = child.geometry;
      this.assetStats.drawCalls += 1;
      this.assetStats.triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    });

    if (changed) {
      this.footprint = module.meta.footprint ?? { radius: 2, height: 4 };
      this._buildGround();
      // Sans taille connue (conteneur masqué), le cadrage attend le prochain resize().
      this._needsFit = this.stats.width <= 1;
      if (!this._needsFit) this.resetView();
    }
  }

  setOption(name, value, notify = false) {
    this.options[name] = value;
    if (name === "pixelArt" || name === "pixelSize") this.resize();
    if (name === "wireframe") this._applyWireframe();
    if (name === "ground") {
      this.ground.visible = value;
      this.resetView();
    }
    if (name === "wind") setWind(value ? 1 : 0);
    if (name === "autoRotate") this.iso.controls.autoRotate = value;
    if (notify) this.onOptionChange?.(name, value);
  }

  /** Recadre : "iso" (défaut), "front", "side", "top". */
  resetView(preset = "iso") {
    const { radius, height } = this.footprint;
    const half = this.options.ground ? Math.max(radius, this._groundSize() / 2) : radius;
    const bottom = this.options.ground ? -0.9 : 0;
    const views = {
      iso: { azimuth: Math.PI / 4, elevation: ISO_ELEVATION },
      front: { azimuth: 0, elevation: THREE.MathUtils.degToRad(12) },
      side: { azimuth: Math.PI / 2, elevation: THREE.MathUtils.degToRad(12) },
      top: { azimuth: Math.PI / 4, elevation: THREE.MathUtils.degToRad(80) },
    };
    const target = new THREE.Vector3(0, height / 2, 0);
    this.iso.setView({ ...views[preset], target, zoom: 1 });

    // Cadre la boîte englobante (asset + socle) telle qu'elle apparaît à l'écran.
    const camera = this.iso.camera;
    camera.updateMatrixWorld();
    const e = camera.matrixWorld.elements;
    const right = new THREE.Vector3(e[0], e[1], e[2]);
    const up = new THREE.Vector3(e[4], e[5], e[6]);
    const corner = new THREE.Vector3();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const x of [-half, half]) {
      for (const z of [-half, half]) {
        for (const y of [bottom, height]) {
          corner.set(x, y, z).sub(target);
          minX = Math.min(minX, corner.dot(right));
          maxX = Math.max(maxX, corner.dot(right));
          minY = Math.min(minY, corner.dot(up));
          maxY = Math.max(maxY, corner.dot(up));
        }
      }
    }
    target.addScaledVector(right, (minX + maxX) / 2).addScaledVector(up, (minY + maxY) / 2);
    const zoom = this.iso.fitZoom(maxX - minX, maxY - minY, 1.06);
    this.iso.setView({ ...views[preset], target, zoom: Math.max(0.4, Math.floor(zoom * 8) / 8) });
  }

  /** Adapte le rendu à la taille du conteneur (ou à une taille donnée, pour les vignettes). */
  resize(cssWidth = this.container.clientWidth, cssHeight = this.container.clientHeight, dpr = window.devicePixelRatio || 1) {
    if (!cssWidth || !cssHeight) return;
    this._cssSize = { width: cssWidth, height: cssHeight };
    const previousHeight = this.pixel.height;
    const auto = Math.max(1, Math.round((Math.min(cssWidth, cssHeight) * Math.min(dpr, 3)) / 250));
    this.pixel.pixelSize = this.options.pixelSize || auto;
    this.pixel.pixelArt = this.options.pixelArt;
    this.iso.snap = this.options.pixelArt;

    // Un pixel d'art de marge de chaque côté : la compensation sous-pixel ne découvre jamais le bord.
    const artPixel = this.pixel.pixelArt ? this.pixel.pixelSize / Math.min(dpr, 3) : 0;
    const size = this.pixel.setSize(cssWidth + artPixel * 2, cssHeight + artPixel * 2, dpr);
    this._artPixel = artPixel;
    this.canvas.style.left = `${-artPixel}px`;
    this.canvas.style.top = `${-artPixel}px`;
    this.iso.setViewport(size.width, size.height);
    this.stats.width = size.width;
    this.stats.height = size.height;

    // Garde le même cadrage quand la taille des pixels change.
    if (previousHeight > 1 && this._lastPixelSize && this._lastPixelSize !== this.pixel.pixelSize) {
      this.iso.camera.zoom *= size.height / previousHeight;
      this.iso.camera.updateProjectionMatrix();
    }
    this._lastPixelSize = this.pixel.pixelSize;

    if (this._needsFit && this.assetModule) {
      this._needsFit = false;
      this.resetView();
    }
  }

  start() {
    this._running = true;
    this._updateLoop();
  }

  stop() {
    this._running = false;
    this._updateLoop();
  }

  /** Rend une seule image (vignettes). */
  renderOnce(time = 0) {
    tick(time);
    this._render();
  }

  dispose() {
    this.stop();
    this._resizeObserver?.disconnect();
    this._intersectionObserver?.disconnect();
    this._timer.dispose();
    if (this.asset) disposeObject(this.asset);
    disposeObject(this.ground);
    this.sun.shadow.map?.dispose();
    this.iso.dispose();
    this.pixel.dispose();
    this.canvas.remove();
  }

  _updateLoop() {
    this.pixel.renderer.setAnimationLoop(this._running && this._visible ? this._frame : null);
  }

  _frame() {
    this._timer.update();
    tick(this._timer.getElapsed());
    this._render();
    this.stats.triangles = this.pixel.info.triangles;
    this.stats.calls = this.pixel.info.calls;
    this.onStats?.(this.stats);
  }

  _render() {
    this.iso.update();

    // Le soleil suit la caméra : l'asset reste éclairé de la même façon quand on tourne autour.
    const azimuth = this.iso.azimuth + SUN_AZIMUTH_OFFSET;
    const cosE = Math.cos(SUN_ELEVATION);
    this.sun.target.position.set(0, this.footprint.height * 0.4, 0);
    this.sun.position
      .set(Math.sin(azimuth) * cosE, Math.sin(SUN_ELEVATION), Math.cos(azimuth) * cosE)
      .multiplyScalar(30)
      .add(this.sun.target.position);

    this.pixel.outline = this.options.outline;
    this.pixel.render(this.scene, this.iso.camera);

    const scale = this._artPixel ?? 0;
    this.canvas.style.transform = `translate(${this.iso.subPixel.x * scale}px, ${-this.iso.subPixel.y * scale}px)`;
  }

  _groundSize() {
    // Un peu plus étroit que l'asset : une couronne d'arbre déborde du socle.
    return Math.round((this.footprint.radius * 1.6 + 0.6) * 2) / 2;
  }

  _buildGround() {
    disposeObject(this.ground);
    this.ground.clear();
    const size = this._groundSize();

    const grass = new THREE.Mesh(
      new THREE.BoxGeometry(size, 0.2, size),
      createToonMaterial({
        ramp: ["#2c6a4c", "#43894b", "#62a74e", "#86c257"],
        steps: [0.3, 0.5, 0.74],
        pattern: "speckle",
        patternParams: [PIXELS_PER_UNIT / 2, 0.07, 0.3, 0.6],
        id: 2,
        crease: true,
      }),
    );
    grass.position.y = -0.1;
    grass.receiveShadow = true;

    const earth = new THREE.Mesh(
      new THREE.BoxGeometry(size, 0.7, size),
      createToonMaterial({
        ramp: ["#4b2f3a", "#6e4539", "#8d5d3e", "#a9794d"],
        steps: [0.3, 0.5, 0.74],
        pattern: "speckle",
        patternParams: [PIXELS_PER_UNIT / 2, 0.1, 0.24, 1],
        seed: 4,
        id: 3,
        crease: true,
      }),
    );
    earth.position.y = -0.55;
    earth.receiveShadow = true;

    this.ground.add(grass, earth);
    this.ground.visible = this.options.ground;

    const reach = size * 0.75 + this.footprint.height * 0.6;
    const camera = this.sun.shadow.camera;
    camera.left = -reach;
    camera.right = reach;
    camera.top = reach;
    camera.bottom = -reach;
    camera.near = 1;
    camera.far = 70;
    camera.updateProjectionMatrix();
  }

  _applyWireframe() {
    this.asset?.traverse((child) => {
      if (child.material) child.material.wireframe = this.options.wireframe;
    });
  }
}
