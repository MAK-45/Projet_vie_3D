// Caméra isométrique : orthographique, orbitale (rotation libre, zoom, déplacement), alignée sur la grille des
// pixels d'art pour éviter le scintillement quand elle se déplace.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PIXELS_PER_UNIT } from "./pixel-renderer.js";

const DISTANCE = 60;
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/** Élévation de la vue isométrique « vraie » : atan(1/√2) ≈ 35,26°. */
export const ISO_ELEVATION = Math.atan(1 / Math.SQRT2);

export class IsoCamera {
  /**
   * @param {HTMLElement} domElement élément qui reçoit les gestes (souris, doigts)
   */
  constructor(domElement) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 160);
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minZoom = 0.4;
    this.controls.maxZoom = 8;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(8);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(88);
    this.controls.zoomSpeed = 1.2;
    this.controls.rotateSpeed = 0.8;

    /** Décalage sous-pixel de la dernière image, en pixels d'art (à compenser à l'affichage). */
    this.subPixel = new THREE.Vector2();
    this.snap = true;
    this._truePosition = new THREE.Vector3();
    this._hasTruePosition = false;
    this._viewHeight = 1;

    this.setView({});
  }

  /** Taille de l'image en pixels d'art (donnée par PixelRenderer.setSize). */
  setViewport(width, height) {
    const halfW = width / PIXELS_PER_UNIT / 2;
    const halfH = height / PIXELS_PER_UNIT / 2;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
    this._viewHeight = height;
  }

  /**
   * Place la caméra. Angles en radians ; azimut 45° et élévation ~35° = vue isométrique classique.
   */
  setView({ azimuth = Math.PI / 4, elevation = ISO_ELEVATION, target, zoom }) {
    if (target) this.controls.target.copy(target);
    if (zoom) {
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }
    const cosE = Math.cos(elevation);
    this.camera.position.set(
      this.controls.target.x + Math.sin(azimuth) * cosE * DISTANCE,
      this.controls.target.y + Math.sin(elevation) * DISTANCE,
      this.controls.target.z + Math.cos(azimuth) * cosE * DISTANCE,
    );
    this.camera.lookAt(this.controls.target);
    this._hasTruePosition = false;
    this.controls.update();
  }

  /** Zoom qui fait tenir une boîte de `width` × `height` unités dans la vue (marge comprise). */
  fitZoom(width, height, margin = 1.12) {
    const viewW = (this.camera.right - this.camera.left) / margin;
    const viewH = (this.camera.top - this.camera.bottom) / margin;
    return Math.min(viewW / width, viewH / height);
  }

  /** À appeler à chaque image, avant le rendu. */
  update() {
    const camera = this.camera;
    if (this._hasTruePosition) camera.position.copy(this._truePosition);
    this.controls.update();
    this._truePosition.copy(camera.position);
    this._hasTruePosition = true;

    this.subPixel.set(0, 0);
    if (this.snap) {
      camera.updateMatrixWorld();
      const e = camera.matrixWorld.elements;
      _right.set(e[0], e[1], e[2]);
      _up.set(e[4], e[5], e[6]);
      const texel = 1 / (PIXELS_PER_UNIT * camera.zoom);
      const x = camera.position.dot(_right);
      const y = camera.position.dot(_up);
      const dx = Math.round(x / texel) * texel - x;
      const dy = Math.round(y / texel) * texel - y;
      camera.position.addScaledVector(_right, dx).addScaledVector(_up, dy);
      this.subPixel.set(dx / texel, dy / texel);
    }
    camera.updateMatrixWorld();
  }

  get azimuth() {
    return this.controls.getAzimuthalAngle();
  }

  dispose() {
    this.controls.dispose();
  }
}
