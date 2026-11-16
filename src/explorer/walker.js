// Le promeneur : une simple barre rouge de 1,80 m, pour parcourir un monde et juger des proportions. Pas
// d'animation : elle glisse sur le sol, se tourne dans le sens de la marche et contourne les obstacles.

import * as THREE from "three";
import { createToonMaterial, disposeObject } from "../engine/toon-material.js";

export const WALKER_HEIGHT = 1.8;
const WALK_SPEED = 2.6; // m/s : pas vif
const RUN_SPEED = 6; // m/s : course

export class Walker {
  constructor() {
    const geometry = new THREE.BoxGeometry(0.42, WALKER_HEIGHT, 0.26);
    geometry.translate(0, WALKER_HEIGHT / 2, 0); // origine aux pieds
    this.object = new THREE.Mesh(
      geometry,
      createToonMaterial({ ramp: ["#5c1228", "#8f1a2a", "#c4282c", "#e8392f"], steps: [0.34, 0.56, 0.8], id: 40, crease: true, shadowLit: 0.3 }),
    );
    this.object.name = "walker";
    this.object.castShadow = true;
    this.object.receiveShadow = true;
    this.position = this.object.position;
    this.radius = 0.3;
    this.heading = 0;
    /** Vitesse réelle de la dernière image (m/s), obstacles compris. */
    this.speed = 0;
  }

  /** Pose le promeneur sur le sol d'un monde. */
  placeAt(world, x, z) {
    this.position.set(x, 0, z);
    world.collide(this.position, this.radius);
    this.position.y = world.heightAt(this.position.x, this.position.z);
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
    const amount = Math.min(1, Math.hypot(dirX, dirZ));
    const fromX = this.position.x;
    const fromZ = this.position.z;
    if (amount > 0.01) {
      const speed = (run ? RUN_SPEED : WALK_SPEED) * amount;
      const length = Math.hypot(dirX, dirZ);
      this.position.x += (dirX / length) * speed * dt;
      this.position.z += (dirZ / length) * speed * dt;
      // Se tourne vers la marche, par le plus court chemin.
      const wanted = Math.atan2(dirX, dirZ);
      const delta = Math.atan2(Math.sin(wanted - this.heading), Math.cos(wanted - this.heading));
      this.heading += delta * Math.min(1, dt * 10);
      this.object.rotation.y = this.heading;
    }
    world.collide(this.position, this.radius);
    this.position.y = world.heightAt(this.position.x, this.position.z);
    this.speed = dt > 0 ? Math.hypot(this.position.x - fromX, this.position.z - fromZ) / dt : 0;
  }

  dispose() {
    disposeObject(this.object);
  }
}
