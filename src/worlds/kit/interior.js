// Outils des mondes intérieurs (le Complexe) : pose instanciée des modules, vue en coupe, halos des lampes,
// collisions en boîtes.
//
// - `InteriorKit` : chaque asset « modèle » (identifiant + réglages) est créé une fois ; ses copies posées deviennent
//   un `InstancedMesh` par maillage du modèle. Cent dalles ou quarante murs du même modèle coûtent les draw calls
//   d'une seule. Chaque modèle dit comment il se coupe (vue en coupe : `enableCutaway` du moteur).
// - `createHaloPool` : des dizaines de lampes, mais 12 lumières de halo dans le moteur ; on prête les places libres
//   aux lampes les plus proches du promeneur.
// - `BoxColliders` : murs, piliers et meubles en boîtes alignées sur les axes (le Complexe est orthogonal), portes
//   qui ne bloquent que fermées.

import * as THREE from "three";
import { createGlowLight, disposeObject, enableCutaway, GLOW_LIGHT_COUNT, rgb } from "../../engine/toon-material.js";

const _matrix = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const IDENTITY = new THREE.Matrix4();

export class InteriorKit {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "interior";
    /** @type {Map<string, {prototype: THREE.Group, matrices: number[], cut: object|null, castShadow: boolean}>} */
    this.models = new Map();
    this.meshes = [];
  }

  /**
   * Déclare un modèle (créé une seule fois).
   * @param {string} key nom du modèle dans le monde
   * @param {{create: (params: object) => THREE.Group}} asset module de l'asset
   * @param {object} params réglages de l'asset
   * @param {object} [options]
   * @param {{rule: "wall"|"view", height: number}|null} [options.cut] vue en coupe
   * @param {boolean} [options.castShadow] faux : la copie ne projette pas d'ombre (dalles) ; par défaut, ce qui se
   *   cache avec la coupe (accroché aux murs, lampes) n'en projette pas : elle ne se verrait pas sur le mur
   * @returns {THREE.Group} le modèle (pour lire ses `userData`)
   */
  model(key, asset, params, { cut = null, castShadow = !(cut && cut.height < 0) } = {}) {
    if (this.models.has(key)) return this.models.get(key).prototype;
    const prototype = asset.create(params);
    this.models.set(key, { prototype, matrices: [], cut, castShadow });
    return prototype;
  }

  /** Pose une copie du modèle `key` en (x, y, z), tournée de `rotY` (radians). */
  place(key, x, z, rotY = 0, y = 0) {
    const model = this.models.get(key);
    if (!model) throw new Error(`modèle non déclaré : ${key}`);
    _q.setFromAxisAngle(_up, rotY);
    _matrix.compose(_p.set(x, y, z), _q, _s);
    model.matrices.push(..._matrix.elements);
  }

  /** Construit les maillages instanciés. À appeler une fois tout posé. */
  build() {
    for (const [key, model] of this.models) {
      const count = model.matrices.length / 16;
      const parts = [];
      model.prototype.updateMatrixWorld(true);
      model.prototype.traverse((child) => {
        if (child.isMesh) parts.push(child);
      });
      if (count === 0) {
        disposeObject(model.prototype);
        continue;
      }
      const matrices = new THREE.InstancedBufferAttribute(new Float32Array(model.matrices), 16);
      for (const part of parts) {
        const material = part.material;
        if (model.cut && material.isShaderMaterial && material.uniforms?.uRamp) enableCutaway(material, model.cut.rule, model.cut.height);
        const mesh = new THREE.InstancedMesh(part.geometry, material, count);
        mesh.name = `${key} / ${part.name}`;
        mesh.instanceMatrix = matrices;
        // Un maillage décalé dans son modèle garde son décalage.
        if (!part.matrixWorld.equals(IDENTITY)) {
          const array = new Float32Array(count * 16);
          for (let i = 0; i < count; i++) _matrix.fromArray(model.matrices, i * 16).multiply(part.matrixWorld).toArray(array, i * 16);
          mesh.instanceMatrix = new THREE.InstancedBufferAttribute(array, 16);
        }
        mesh.customDepthMaterial = material.userData.depthMaterial ?? part.customDepthMaterial;
        mesh.castShadow = model.castShadow && part.castShadow;
        mesh.receiveShadow = part.receiveShadow;
        mesh.matrixAutoUpdate = false;
        mesh.computeBoundingSphere();
        this.meshes.push(mesh);
        this.group.add(mesh);
      }
    }
  }

  /** Draw calls et triangles si tout était dans le champ. */
  stats() {
    let triangles = 0;
    for (const mesh of this.meshes) {
      const g = mesh.geometry;
      triangles += ((g.index ? g.index.count : g.attributes.position.count) / 3) * mesh.count;
    }
    return { meshes: this.meshes.length, triangles, models: this.models.size };
  }

  dispose() {
    for (const mesh of this.meshes) {
      disposeObject(mesh);
      mesh.dispose();
    }
    for (const model of this.models.values()) disposeObject(model.prototype);
    this.group.clear();
    this.meshes = [];
    this.models.clear();
  }
}

/**
 * Prête les lumières de halo du moteur aux lampes les plus utiles : celles près du point regardé (devant la caméra
 * en 3e personne), et, à distance égale, celles qui sont dans le champ.
 * @param {Array<{position: THREE.Vector3, color: string, radius: number, strength?: number}>} sources
 * @param {number} [slots] places prises (en laisser une aux personnages qui brillent)
 */
export function createHaloPool(sources, slots = GLOW_LIGHT_COUNT - 1) {
  const lights = Array.from({ length: Math.min(slots, sources.length) }, () => createGlowLight());
  const colors = sources.map((source) => rgb(source.color));
  const score = new Float32Array(sources.length);
  const order = sources.map((_, i) => i);
  const frustum = new THREE.Frustum();
  const viewProjection = new THREE.Matrix4();
  const sphere = new THREE.Sphere();
  let last = -1;
  return {
    /**
     * Réattribue les places (4 fois par seconde) autour de `focus`.
     * @param {THREE.Vector3} focus point regardé
     * @param {number} time secondes
     * @param {THREE.Camera} [camera] pour préférer les lampes dans le champ
     */
    update(focus, time, camera) {
      if (Math.floor(time * 4) === last) return;
      last = Math.floor(time * 4);
      if (camera) {
        viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(viewProjection);
      }
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        const seen = !camera || frustum.intersectsSphere(sphere.set(source.position, source.radius));
        score[i] = source.position.distanceTo(focus) + (seen ? 0 : 30);
      }
      order.sort((a, b) => score[a] - score[b]);
      lights.forEach((light, k) => {
        const source = sources[order[k]];
        light.set(source.position, colors[order[k]], source.radius, source.strength ?? 1.1);
      });
    },
    dispose() {
      for (const light of lights) light.release();
    },
  };
}

/** Obstacles en boîtes alignées sur les axes ; une boîte peut dépendre d'une condition (porte fermée). */
export class BoxColliders {
  constructor() {
    this.boxes = [];
  }

  /** Boîte de centre (x, z) et de demi-côtés (hx, hz) ; `active()` : la boîte ne bloque que si vrai. */
  add(x, z, hx, hz, active = null) {
    this.boxes.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz, active });
  }

  /** Repousse un disque de rayon `radius` hors des boîtes. */
  collide(position, radius) {
    for (let pass = 0; pass < 2; pass++) {
      for (const box of this.boxes) {
        if (box.active && !box.active()) continue;
        const cx = THREE.MathUtils.clamp(position.x, box.minX, box.maxX);
        const cz = THREE.MathUtils.clamp(position.z, box.minZ, box.maxZ);
        const dx = position.x - cx;
        const dz = position.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= radius * radius) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          position.x = cx + (dx / d) * radius;
          position.z = cz + (dz / d) * radius;
        } else {
          // Centre dans la boîte : sortir par le côté le plus proche.
          const exits = [position.x - box.minX, box.maxX - position.x, position.z - box.minZ, box.maxZ - position.z];
          const k = exits.indexOf(Math.min(...exits));
          if (k === 0) position.x = box.minX - radius;
          else if (k === 1) position.x = box.maxX + radius;
          else if (k === 2) position.z = box.minZ - radius;
          else position.z = box.maxZ + radius;
        }
      }
    }
  }

  /** Vrai si le point (x, z), avec une marge, touche une boîte active. */
  blocked(x, z, margin = 0) {
    return this.boxes.some((box) => (!box.active || box.active()) && x > box.minX - margin && x < box.maxX + margin && z > box.minZ - margin && z < box.maxZ + margin);
  }
}
