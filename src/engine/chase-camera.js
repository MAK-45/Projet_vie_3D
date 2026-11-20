// Caméra à la 3e personne : perspective, placée derrière le promeneur et un peu au-dessus de lui, pour voir le
// décor devant soi comme si on y marchait. Elle se replace d'elle-même dans le dos du promeneur quand il avance ;
// on peut regarder autour (souris ou un doigt), reculer ou approcher (molette ou deux doigts).
//
// Pas d'alignement sur la grille des pixels ici : en perspective, chaque pas redessine le décor (c'est le prix de
// l'immersion). Le rendu pixel art (basse résolution, contours) reste le même ; voir PixelRenderer, qui linéarise la
// profondeur et ajoute une brume de lointain pour une caméra perspective.

import * as THREE from "three";

const clamp = THREE.MathUtils.clamp;
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const MIN_PITCH = THREE.MathUtils.degToRad(-12); // on peut regarder un peu vers le ciel
const MAX_PITCH = THREE.MathUtils.degToRad(62);
const DEFAULT_PITCH = THREE.MathUtils.degToRad(11);
const MIN_DISTANCE = 2.2;
const MAX_DISTANCE = 11;
const DEFAULT_DISTANCE = 5;
/** Champ horizontal visé ; le champ vertical en découle, borné (un téléphone en hauteur voit moins large). */
const HORIZONTAL_FOV = THREE.MathUtils.degToRad(66);
const MIN_VERTICAL_FOV = 46;
const MAX_VERTICAL_FOV = 74;
const RECENTER_DELAY = 1.6; // secondes sans geste avant que la caméra ne revienne d'elle-même dans le dos
const RECENTER_RATE = 2.4; // vitesse de ce retour (1/s), en pleine marche droit devant
const GROUND_CLEARANCE = 0.45; // la caméra ne descend jamais plus près du sol (m)

const _offset = new THREE.Vector3();
const _probe = new THREE.Vector3();

export class ChaseCamera {
  /**
   * @param {HTMLElement} domElement élément qui reçoit les gestes (souris, doigts)
   * @param {{far?: number}} [options] portée de la vue (m) : au-delà, rien n'est dessiné (la brume y mène)
   */
  constructor(domElement, { far = 100 } = {}) {
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.15, far);
    this.domElement = domElement;
    /** Angle de la caméra autour du promeneur, même convention que l'azimut d'OrbitControls. */
    this.yaw = 0;
    this.pitch = DEFAULT_PITCH;
    this.distance = DEFAULT_DISTANCE;
    this.enabled = false;
    /** Point regardé (au-dessus de la tête du promeneur). */
    this.pivot = new THREE.Vector3();

    this._distance = DEFAULT_DISTANCE; // recul réel, raccourci quand le sol ou un tronc gêne
    this._idle = RECENTER_DELAY; // temps depuis le dernier geste
    this._pointers = new Map();
    this._pinch = 0;

    this._onPointerDown = (event) => {
      if (!this.enabled) return;
      this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      domElement.setPointerCapture?.(event.pointerId);
      if (this._pointers.size === 2) this._pinch = this._pinchLength();
    };
    this._onPointerMove = (event) => {
      const pointer = this._pointers.get(event.pointerId);
      if (!this.enabled || !pointer) return;
      if (this._pointers.size >= 2) {
        const length = this._pinchLength();
        if (this._pinch > 0 && length > 0) this.distance = clamp(this.distance * (this._pinch / length), MIN_DISTANCE, MAX_DISTANCE);
        this._pinch = length;
      } else {
        // Un écran de large = un peu plus d'un demi-tour ; on garde le même geste qu'en vue isométrique.
        const size = Math.max(200, domElement.clientHeight || 600);
        this.yaw -= ((event.clientX - pointer.x) / size) * Math.PI * 1.4;
        this.pitch = clamp(this.pitch + ((event.clientY - pointer.y) / size) * Math.PI * 0.8, MIN_PITCH, MAX_PITCH);
        this._idle = 0;
      }
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    this._onPointerUp = (event) => {
      this._pointers.delete(event.pointerId);
      this._pinch = this._pointers.size === 2 ? this._pinchLength() : 0;
    };
    this._onWheel = (event) => {
      if (!this.enabled) return;
      event.preventDefault();
      this.distance = clamp(this.distance * Math.exp(event.deltaY * 0.0012), MIN_DISTANCE, MAX_DISTANCE);
    };
    domElement.addEventListener("pointerdown", this._onPointerDown);
    domElement.addEventListener("pointermove", this._onPointerMove);
    domElement.addEventListener("pointerup", this._onPointerUp);
    domElement.addEventListener("pointercancel", this._onPointerUp);
    domElement.addEventListener("wheel", this._onWheel, { passive: false });
  }

  /** Azimut de la caméra (radians) : sert à rendre la marche relative à l'écran. */
  get azimuth() {
    return this.yaw;
  }

  /** Champ horizontal (radians), pour estimer la surface de sol vue. */
  get horizontalFov() {
    const camera = this.camera;
    return 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.aspect);
  }

  /** Taille de l'image (en pixels d'art) : ratio et champ de vue. */
  setViewport(width, height) {
    const camera = this.camera;
    camera.aspect = width / height;
    const vertical = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(HORIZONTAL_FOV / 2) / camera.aspect));
    camera.fov = clamp(vertical, MIN_VERTICAL_FOV, MAX_VERTICAL_FOV);
    camera.updateProjectionMatrix();
  }

  /** Se place dans le dos d'un promeneur de cap `heading`, au recul et à l'inclinaison de départ. */
  reset(heading) {
    this.yaw = heading + Math.PI;
    this.pitch = DEFAULT_PITCH;
    this.distance = this._distance = DEFAULT_DISTANCE;
    this._idle = RECENTER_DELAY;
  }

  /** Pose les angles à la main (captures). Radians. */
  setAngles({ yaw, pitch, distance }) {
    if (yaw !== undefined) this.yaw = yaw;
    if (pitch !== undefined) this.pitch = clamp(pitch, MIN_PITCH, MAX_PITCH);
    if (distance !== undefined) this.distance = this._distance = clamp(distance, MIN_DISTANCE, MAX_DISTANCE);
    this._idle = 0;
  }

  /**
   * À appeler à chaque image, avant le rendu.
   * @param {number} dt secondes
   * @param {object} frame
   * @param {THREE.Vector3} frame.target point suivi (le buste du promeneur, lissé en hauteur)
   * @param {number} frame.heading cap du promeneur (radians)
   * @param {number} frame.speed vitesse du promeneur (m/s)
   * @param {number} frame.turn rotation demandée au clavier (-1, 0, 1)
   * @param {{heightAt: Function, collide: Function}} frame.world sol et obstacles
   * @param {boolean} [frame.lead] le promeneur va seul (balade auto) : la caméra revient toujours dans son dos
   */
  update(dt, { target, heading, speed, turn, world, lead = false }) {
    this._idle += dt;
    if (turn) {
      this.yaw -= turn * 1.9 * dt;
      this._idle = 0;
    }
    // Retour dans le dos : seulement quand il avance vers le fond de l'image. De côté, il longe l'écran sans que la
    // caméra tourne ; vers la caméra, elle recule devant lui au lieu de faire demi-tour.
    if (this._idle > RECENTER_DELAY && speed > 0.4) {
      const off = wrapAngle(heading + Math.PI - this.yaw);
      const facing = lead ? 0.6 : Math.max(0, Math.cos(off));
      this.yaw += off * damp(RECENTER_RATE * facing * Math.min(1, speed / 1.5), dt);
    }
    this.yaw = wrapAngle(this.yaw);

    // Le pivot : un peu au-dessus de la tête, pour que le promeneur occupe le bas de l'image et le décor le reste.
    this.pivot.set(target.x, target.y + 0.75, target.z);
    const cosP = Math.cos(this.pitch);
    _offset.set(Math.sin(this.yaw) * cosP, Math.sin(this.pitch), Math.cos(this.yaw) * cosP);

    // Recul : raccourci si un tronc est sur le chemin (on cherche la première place libre, du promeneur vers la
    // caméra), puis lissé pour ne pas sauter.
    // Par pas courts (40 cm au plus) : un mur de 60 cm ne doit pas passer entre deux sondes.
    let reach = this.distance;
    const steps = Math.max(4, Math.ceil(this.distance / 0.4));
    for (let step = 1; step <= steps; step++) {
      const d = (this.distance * step) / steps;
      _probe.copy(this.pivot).addScaledVector(_offset, d);
      const x = _probe.x;
      const z = _probe.z;
      world.collide(_probe, 0.35);
      if (Math.abs(_probe.x - x) + Math.abs(_probe.z - z) > 1e-4) {
        reach = Math.max(MIN_DISTANCE * 0.6, d - this.distance / steps);
        break;
      }
    }
    this._distance += (reach - this._distance) * damp(reach < this._distance ? 14 : 3, dt);

    const camera = this.camera;
    camera.position.copy(this.pivot).addScaledVector(_offset, this._distance);
    // Jamais sous le sol : on remonte la caméra (une bosse derrière le promeneur), le regard reste sur lui.
    const ground = world.heightAt(camera.position.x, camera.position.z) + GROUND_CLEARANCE;
    if (camera.position.y < ground) camera.position.y = ground;
    // Sous le plafond d'un intérieur.
    const ceiling = world.ceilingAt?.(camera.position.x, camera.position.z) ?? Infinity;
    if (camera.position.y > ceiling - 0.35) camera.position.y = ceiling - 0.35;
    // Le regard vise un point devant le pivot (et un peu plus bas), pour voir loin devant soi.
    _probe.copy(this.pivot).addScaledVector(_offset, -2.5);
    _probe.y = this.pivot.y - 0.45;
    camera.lookAt(_probe);
    camera.updateMatrixWorld();
  }

  dispose() {
    const element = this.domElement;
    element.removeEventListener("pointerdown", this._onPointerDown);
    element.removeEventListener("pointermove", this._onPointerMove);
    element.removeEventListener("pointerup", this._onPointerUp);
    element.removeEventListener("pointercancel", this._onPointerUp);
    element.removeEventListener("wheel", this._onWheel);
  }

  _pinchLength() {
    const [a, b] = [...this._pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
