// Commandes du promeneur : clavier (flèches ou ZQSD/WASD selon la position des touches, Maj pour courir, A/E pour
// tourner la vue) et manette tactile (un rond à faire glisser sous le pouce).

export class WalkInput {
  /**
   * @param {HTMLElement} joystick socle de la manette tactile ; son premier enfant est le bouton qui suit le doigt
   * @param {object} [options]
   * @param {(x: number, y: number) => number[]} [options.mapPoint] point de l'écran dans le repère de l'explorateur
   *   (vue tournée d'un quart de tour en paysage forcé) ; les gestes reçus y sont déjà ramenés
   */
  constructor(joystick, { mapPoint = (x, y) => [x, y] } = {}) {
    this._mapPoint = mapPoint;
    /** Déplacement voulu, relatif à l'écran : x vers la droite, y vers le fond. Longueur 0..1. */
    this.x = 0;
    this.y = 0;
    this.run = false;
    /** Rotation de la vue demandée au clavier : -1, 0 ou 1. */
    this.turn = 0;
    /** Appelé à la première action du joueur après une pause (pour couper la balade automatique). */
    this.onAction = null;

    this._keys = new Set();
    this._turnPulse = 0;
    this._stick = { x: 0, y: 0, pointer: null };
    this._joystick = joystick;
    this._knob = joystick.firstElementChild;

    this._onKeyDown = (event) => {
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!(event.code in KEYS)) return;
      event.preventDefault();
      this._keys.add(event.code);
      // Un appui bref peut commencer et finir entre deux images : la rotation est retenue jusqu'à la suivante.
      if (KEYS[event.code].turn && !event.repeat) this._turnPulse = KEYS[event.code].turn;
      this.onAction?.();
    };
    this._onKeyUp = (event) => this._keys.delete(event.code);
    this._onBlur = () => this._keys.clear();
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("blur", this._onBlur);

    this._onStickDown = (event) => {
      if (this._stick.pointer !== null) return;
      this._stick.pointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      joystick.classList.add("is-held");
      this._moveStick(event);
      this.onAction?.();
    };
    this._onStickMove = (event) => {
      if (event.pointerId === this._stick.pointer) this._moveStick(event);
    };
    this._onStickUp = (event) => {
      if (event.pointerId !== this._stick.pointer) return;
      this._stick.pointer = null;
      this._stick.x = 0;
      this._stick.y = 0;
      joystick.classList.remove("is-held");
      this._knob.style.transform = "";
    };
    joystick.addEventListener("pointerdown", this._onStickDown);
    joystick.addEventListener("pointermove", this._onStickMove);
    joystick.addEventListener("pointerup", this._onStickUp);
    joystick.addEventListener("pointercancel", this._onStickUp);
  }

  /** À appeler à chaque image : met à jour x, y, run, turn. */
  update() {
    let x = this._stick.x;
    let y = this._stick.y;
    let turn = 0;
    for (const code of this._keys) {
      const key = KEYS[code];
      x += key.x ?? 0;
      y += key.y ?? 0;
      turn += key.turn ?? 0;
    }
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    this.x = x;
    this.y = y;
    this.turn = Math.sign(turn) || this._turnPulse;
    this._turnPulse = 0;
    // À la manette, la course vient en poussant le bouton à fond.
    this.run = this._keys.has("ShiftLeft") || this._keys.has("ShiftRight") || Math.hypot(this._stick.x, this._stick.y) > 0.92;
  }

  dispose() {
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    window.removeEventListener("blur", this._onBlur);
    this._joystick.removeEventListener("pointerdown", this._onStickDown);
    this._joystick.removeEventListener("pointermove", this._onStickMove);
    this._joystick.removeEventListener("pointerup", this._onStickUp);
    this._joystick.removeEventListener("pointercancel", this._onStickUp);
  }

  _moveStick(event) {
    const rect = this._joystick.getBoundingClientRect();
    const radius = rect.width / 2;
    const [centerX, centerY] = this._mapPoint(rect.left + radius, rect.top + radius);
    let x = (event.clientX - centerX) / (radius * 0.62);
    let y = (event.clientY - centerY) / (radius * 0.62);
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    this._stick.x = x;
    this._stick.y = -y;
    this._knob.style.transform = `translate(${x * radius * 0.62}px, ${y * radius * 0.62}px)`;
  }
}

// Touches repérées par leur position (event.code) : ZQSD sur un clavier français, WASD sur un clavier américain.
const KEYS = {
  ArrowUp: { y: 1 },
  ArrowDown: { y: -1 },
  ArrowLeft: { x: -1 },
  ArrowRight: { x: 1 },
  KeyW: { y: 1 },
  KeyS: { y: -1 },
  KeyA: { x: -1 },
  KeyD: { x: 1 },
  KeyQ: { turn: -1 },
  KeyE: { turn: 1 },
  ShiftLeft: {},
  ShiftRight: {},
};

function isTyping(target) {
  return target instanceof HTMLElement && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
}
