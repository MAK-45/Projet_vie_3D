// Le promeneur : le personnage qu'on promène dans un monde. Plusieurs corps au choix, chacun avec sa façon d'avancer :
// - la barre rouge de 1,80 m, pour juger des proportions : elle glisse sur le sol, sans inertie ;
// - le blob (la Couveuse) : il lévite. Il prend son élan et freine en douceur, survole le relief en lissant les
//   bosses (il anticipe les montées), se penche en avant quand il accélère et s'incline dans les virages ;
// - les personnages importés (héroïne, héros, mannequins) : ils marchent, pieds au sol, et prennent la pose
//   d'attente à l'arrêt (kit/humanoid.js, createWalkingHumanoid). Pas de course pour l'instant : Maj fait
//   seulement presser le pas.
// Le déplacement (collisions, cap) est commun ; seul le corps et sa conduite changent.

import * as THREE from "three";
import { createToonMaterial, disposeObject } from "../engine/toon-material.js";
import { create as createBlob } from "../assets/creatures/spirits/couveuse-blob.js";
import { CHARACTERS as HUMANOIDS, createWalkingHumanoid } from "../assets/kit/humanoid.js";

export const WALKER_HEIGHT = 1.8;

/** Les personnages proposés dans l'explorateur. */
export const CHARACTERS = {
  bar: { label: "Barre 1,80 m" },
  blob: { label: "Blob" },
  ...Object.fromEntries(Object.entries(HUMANOIDS).map(([id, c]) => [id, { label: c.label, humanoid: true, height: c.height }])),
};

/** Conduite des personnages qui marchent : un peu d'élan pour démarrer et s'arrêter, pieds collés au sol. */
const STRIDE = {
  walk: 1.3, run: 1.8, radius: 0.3, glide: false, stride: true,
  accelerate: 7, // réactivité au démarrage (1/s)
  brake: 9, // et à l'arrêt : il ne glisse pas
  turn: 9, // vitesse à laquelle il se tourne vers sa marche (1/s)
};

const BLOB_CENTER = 1; // hauteur du centre du blob au-dessus de son origine (paramètre « Vol » par défaut)

/** Conduite de chaque corps. */
const STYLES = {
  bar: { walk: 2.6, run: 6, radius: 0.3, look: WALKER_HEIGHT * 0.55, glide: false },
  blob: {
    walk: 2.2, run: 5, radius: 0.45, look: BLOB_CENTER, glide: true,
    accelerate: 2.6, // réactivité quand il prend de la vitesse (1/s)
    brake: 1.8, // plus lent à s'arrêter : il glisse sur son élan
    turn: 4, // vitesse à laquelle son regard rattrape sa course (1/s)
    rise: 3.2, // vitesse à laquelle il suit le relief (1/s)
    anticipate: 0.45, // il lit le sol là où il sera dans 0,45 s
    lean: 0.05, // penché en avant par m/s² d'accélération
    bank: 0.09, // incliné dans un virage, par m/s × rad/s
  },
};

function createBar() {
  const geometry = new THREE.BoxGeometry(0.42, WALKER_HEIGHT, 0.26);
  geometry.translate(0, WALKER_HEIGHT / 2, 0); // origine aux pieds
  const mesh = new THREE.Mesh(
    geometry,
    createToonMaterial({ ramp: ["#5c1228", "#8f1a2a", "#c4282c", "#e8392f"], steps: [0.34, 0.56, 0.8], id: 40, crease: true, shadowLit: 0.3 }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Walker {
  constructor(kind = "bar") {
    this.object = new THREE.Group(); // position au sol et cap
    this.object.name = "walker";
    this.lean = new THREE.Group(); // penché et incliné, autour du centre du corps
    this.object.add(this.lean);
    this.position = this.object.position;
    this.heading = 0;
    /** Vitesse réelle de la dernière image (m/s), obstacles compris. */
    this.speed = 0;
    this.velocity = new THREE.Vector2(); // vitesse au sol (x, z), pour la conduite avec élan
    this._lift = 0; // vitesse verticale du survol
    this._turnRate = 0; // vitesse de rotation lissée (rad/s), pour s'incliner dans les virages
    this._accel = 0; // accélération lissée le long de la course (m/s²)
    this.body = null;
    this.setCharacter(kind);
  }

  /** Change de corps (même place, même cap). */
  setCharacter(kind) {
    if (!(kind in CHARACTERS)) kind = "bar";
    if (kind === this.kind) return;
    if (this.body) {
      this.lean.remove(this.body);
      this._disposeBody();
    }
    this.kind = kind;
    const spec = CHARACTERS[kind];
    this.style = spec.humanoid ? { ...STRIDE, look: spec.height * 0.55 } : STYLES[kind];
    this.radius = this.style.radius;
    this.lookHeight = this.style.look;
    // Le blob regarde vers +Z comme le cap ; son « turn » à 0 pour que le groupe l'oriente.
    this.body = spec.humanoid ? createWalkingHumanoid({ character: kind, seed: 1 }) : kind === "blob" ? createBlob({ turn: 0 }) : createBar();
    // Le penché tourne autour du centre du corps, pas de ses pieds.
    this.lean.position.y = this.style.look;
    this.body.position.y = -this.style.look;
    this.lean.rotation.set(0, 0, 0);
    this.lean.add(this.body);
    this.velocity.set(0, 0);
    this._lift = this._turnRate = this._accel = 0;
  }

  /** Pose le promeneur sur le sol d'un monde. */
  placeAt(world, x, z) {
    this.position.set(x, 0, z);
    world.collide(this.position, this.radius);
    this.position.y = world.heightAt(this.position.x, this.position.z);
    this.velocity.set(0, 0);
    this._lift = 0;
  }

  /**
   * Avance d'une image.
   * @param {number} dt secondes
   * @param {number} dirX direction voulue dans le monde (x), longueur 0..1
   * @param {number} dirZ direction voulue dans le monde (z)
   * @param {boolean} run course
   * @param {object} world monde (heightAt, collide)
   */
  update(dt, dirX, dirZ, run, world) {
    if (this.style.glide) this._glide(dt, dirX, dirZ, run, world);
    else if (this.style.stride) this._stride(dt, dirX, dirZ, run, world);
    else this._walk(dt, dirX, dirZ, run, world);
    this.object.rotation.y = this.heading;
    const body = this.body.userData;
    if (body.setGait) {
      body.setGait(this.speed);
      body.update(dt);
    }
  }

  /** La barre : avance droit à la vitesse voulue, collée au sol. */
  _walk(dt, dirX, dirZ, run, world) {
    const style = this.style;
    const amount = Math.min(1, Math.hypot(dirX, dirZ));
    const fromX = this.position.x;
    const fromZ = this.position.z;
    if (amount > 0.01) {
      const speed = (run ? style.run : style.walk) * amount;
      const length = Math.hypot(dirX, dirZ);
      this.position.x += (dirX / length) * speed * dt;
      this.position.z += (dirZ / length) * speed * dt;
      // Se tourne vers la marche, par le plus court chemin.
      this.heading += wrapAngle(Math.atan2(dirX, dirZ) - this.heading) * Math.min(1, dt * 10);
    }
    world.collide(this.position, this.radius);
    this.position.y = world.heightAt(this.position.x, this.position.z);
    this.speed = dt > 0 ? Math.hypot(this.position.x - fromX, this.position.z - fromZ) / dt : 0;
  }

  /** Les personnages qui marchent : la vitesse rattrape la vitesse voulue en un instant, collés au sol. */
  _stride(dt, dirX, dirZ, run, world) {
    if (dt <= 0) return;
    const style = this.style;
    const velocity = this.velocity;
    const amount = Math.min(1, Math.hypot(dirX, dirZ));
    const speed = (run ? style.run : style.walk) * amount;
    const length = Math.hypot(dirX, dirZ) || 1;
    const wantX = (dirX / length) * speed;
    const wantZ = (dirZ / length) * speed;
    const k = damp(speed > velocity.length() ? style.accelerate : style.brake, dt);
    velocity.x += (wantX - velocity.x) * k;
    velocity.y += (wantZ - velocity.y) * k;
    if (speed === 0 && velocity.length() < 0.05) velocity.set(0, 0);

    const fromX = this.position.x;
    const fromZ = this.position.z;
    this.position.x += velocity.x * dt;
    this.position.z += velocity.y * dt;
    world.collide(this.position, this.radius);
    velocity.set((this.position.x - fromX) / dt, (this.position.z - fromZ) / dt);
    this.speed = velocity.length();
    this.position.y = world.heightAt(this.position.x, this.position.z);
    // Il se tourne vers où il veut aller, même bloqué contre un tronc.
    if (amount > 0.01) this.heading += wrapAngle(Math.atan2(dirX, dirZ) - this.heading) * damp(style.turn, dt);
  }

  /** Le blob : lévite avec élan, survole le relief, se penche et s'incline. */
  _glide(dt, dirX, dirZ, run, world) {
    if (dt <= 0) return;
    const style = this.style;
    const velocity = this.velocity;
    const amount = Math.min(1, Math.hypot(dirX, dirZ));
    const speed = (run ? style.run : style.walk) * amount;
    const length = Math.hypot(dirX, dirZ) || 1;
    const wantX = (dirX / length) * speed;
    const wantZ = (dirZ / length) * speed;
    const before = velocity.length();

    // L'élan : la vitesse rattrape la vitesse voulue, plus vite pour partir que pour s'arrêter.
    const rate = speed > before ? style.accelerate : style.brake;
    const k = damp(rate, dt);
    velocity.x += (wantX - velocity.x) * k;
    velocity.y += (wantZ - velocity.y) * k;

    const fromX = this.position.x;
    const fromZ = this.position.z;
    this.position.x += velocity.x * dt;
    this.position.z += velocity.y * dt;
    world.collide(this.position, this.radius);
    // Contre un obstacle, l'élan se réduit à ce qui passe : il glisse le long, sans s'y entasser.
    const movedX = (this.position.x - fromX) / dt;
    const movedZ = (this.position.z - fromZ) / dt;
    velocity.set(movedX, movedZ);
    this.speed = velocity.length();

    // Le regard suit la course ; on note la vitesse de rotation pour s'incliner.
    const previous = this.heading;
    if (this.speed > 0.15) {
      this.heading += wrapAngle(Math.atan2(velocity.x, velocity.y) - this.heading) * damp(style.turn, dt);
    } else if (amount > 0.01) {
      this.heading += wrapAngle(Math.atan2(dirX, dirZ) - this.heading) * damp(style.turn, dt);
    }
    this._turnRate += (wrapAngle(this.heading - previous) / dt - this._turnRate) * damp(6, dt);
    this._accel += ((this.speed - before) / dt - this._accel) * damp(5, dt);

    // Le survol : ressort amorti vers le plus haut du sol ici et là où il sera bientôt.
    const ahead = style.anticipate;
    const ground = Math.max(
      world.heightAt(this.position.x, this.position.z),
      world.heightAt(this.position.x + velocity.x * ahead, this.position.z + velocity.y * ahead),
    );
    const stiffness = style.rise * style.rise;
    this._lift += ((ground - this.position.y) * stiffness - this._lift * 2 * style.rise) * dt;
    this.position.y += this._lift * dt;
    // Jamais le ventre dans la pente : au pire il frôle le sol.
    const floor = world.heightAt(this.position.x, this.position.z) - 0.25;
    if (this.position.y < floor) {
      this.position.y = floor;
      this._lift = Math.max(0, this._lift);
    }

    // Penché en avant à l'accélération (en arrière au freinage), incliné vers l'intérieur des virages.
    const clamp = THREE.MathUtils.clamp;
    const pitch = clamp(this._accel * style.lean, -0.22, 0.22);
    const roll = clamp(-this._turnRate * this.speed * style.bank, -0.3, 0.3);
    const lean = this.lean.rotation;
    const kl = damp(8, dt);
    lean.x += (pitch - lean.x) * kl;
    lean.z += (roll - lean.z) * kl;
  }

  /** Les personnages importés partagent géométries et textures (cache) : seuls leurs matériaux sont libérés. */
  _disposeBody() {
    if (this.body.userData.dispose) this.body.userData.dispose();
    else disposeObject(this.body);
  }

  dispose() {
    if (this.body) this._disposeBody();
  }
}
