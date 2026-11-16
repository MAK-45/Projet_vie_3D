// Semis d'un monde : poser des milliers de copies d'assets (arbres, rochers, touffes, fleurs) sans payer un draw call
// par copie ni dessiner ce qui est hors champ.
//
// - Chaque asset « modèle » (un groupe sorti de `create()`) devient une couche : un `InstancedMesh` par maillage du
//   modèle, donc autant de draw calls que le modèle seul, quel que soit le nombre de copies.
// - Le monde est découpé en cases. À chaque image, on cherche les cases que la caméra voit ; quand cette liste
//   change, on recopie dans chaque couche les matrices des seules cases visibles. Rien n'est recalculé entre-temps.
// - Un plafond de triangles éclaircit les couches « fines » (herbe, fleurs) quand la vue couvre beaucoup de
//   terrain : on ne dessine que les premières copies de chaque case, rangées dans un ordre mélangé, donc
//   réparties partout.

import * as THREE from "three";
import { disposeObject } from "../../engine/toon-material.js";

const _frustum = new THREE.Frustum();
const _viewProjection = new THREE.Matrix4();
const _child = new THREE.Matrix4();

export class ScatterField {
  /**
   * @param {object} options
   * @param {{minX: number, maxX: number, minZ: number, maxZ: number}} options.bounds emprise du monde (m)
   * @param {(x: number, z: number) => number} [options.heightAt] hauteur du sol : chaque case est bornée au plus
   *   juste (une case trop haute est « vue » de loin, et ses copies dessinées pour rien)
   * @param {Record<string, {cellSize: number, height: number, margin: number}>} [options.classes] familles de
   *   couches : côté des cases (petit pour ce qui est dense, le tri est plus serré), hauteur de ce qui y pousse et
   *   marge autour de la case (débord des couronnes, ombres portées venues de hors champ)
   */
  constructor({
    bounds,
    heightAt = () => 0,
    classes = {
      fine: { cellSize: 4, height: 1.5, margin: 0.9 },
      low: { cellSize: 6, height: 3, margin: 2.5 },
      tall: { cellSize: 3, height: 15, margin: 6.5 }, // à peu près un arbre par case : tri arbre par arbre
    },
  }) {
    this.bounds = bounds;
    this.group = new THREE.Group();
    this.group.name = "scatter";
    this.layers = [];
    this.classes = {};
    /** Part des copies fines dessinées (1 = toutes). */
    this.fraction = 1;
    this._budget = -1;

    for (const [name, { cellSize, height, margin }] of Object.entries(classes)) {
      const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / cellSize));
      const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / cellSize));
      const count = cols * rows;
      const boxes = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = bounds.minX + col * cellSize;
          const z = bounds.minZ + row * cellSize;
          let low = Infinity;
          let high = -Infinity;
          for (let k = 0; k < 9; k++) {
            const h = heightAt(x + ((k % 3) / 2) * cellSize, z + (Math.floor(k / 3) / 2) * cellSize);
            low = Math.min(low, h);
            high = Math.max(high, h);
          }
          boxes.push(new THREE.Box3(
            new THREE.Vector3(x - margin, low - 0.3, z - margin),
            new THREE.Vector3(x + cellSize + margin, high + 0.2 + height, z + cellSize + margin),
          ));
        }
      }
      this.classes[name] = {
        cellSize, cols, rows, boxes,
        active: [], // cases qui contiennent quelque chose (remplies par build)
        visible: new Int16Array(count), length: 0, previous: new Int16Array(count), previousLength: -1,
      };
    }
  }

  /**
   * Déclare une couche à partir d'un asset modèle. Le groupe est absorbé : ses géométries et matériaux servent aux
   * copies, et sont libérés par `dispose()`.
   *
   * @param {THREE.Group} prototype groupe sorti de `create()` d'un asset
   * @param {object} [options]
   * @param {"fine"|"low"|"tall"} [options.reach] famille de la couche : herbes et fleurs, rochers et plaques, arbres
   * @param {boolean} [options.thin] couche éclaircie quand la vue est large (herbe, fleurs)
   * @param {boolean} [options.castShadow] force ou coupe l'ombre portée de toute la couche
   * @param {string[]} [options.skip] noms des maillages du modèle à ne pas reprendre
   * @returns {{add: (matrix: THREE.Matrix4) => void, count: number, triangles: number}}
   */
  addLayer(prototype, { reach = "low", thin = false, castShadow, skip = [] } = {}) {
    const parts = [];
    prototype.updateMatrixWorld(true);
    prototype.traverse((child) => {
      if (!child.isMesh) return;
      if (skip.includes(child.name)) {
        disposeObject(child);
        return;
      }
      parts.push(child);
    });
    const layer = {
      name: prototype.name,
      reach,
      thin,
      parts,
      castShadow,
      castsShadow: castShadow ?? parts.some((part) => part.castShadow),
      index: this.layers.length,
      pending: Array.from({ length: this.classes[reach].boxes.length }, () => null),
      cells: null,
      meshes: [],
      count: 0,
      triangles: 0,
      add: (matrix) => {
        const e = matrix.elements;
        const index = this._cellIndex(this.classes[reach], e[12], e[14]);
        (layer.pending[index] ??= []).push(...e);
        layer.count += 1;
      },
    };
    for (const part of parts) {
      const geometry = part.geometry;
      layer.triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
    }
    this.layers.push(layer);
    return layer;
  }

  /**
   * Fige le semis : construit les `InstancedMesh`. À appeler une fois toutes les copies ajoutées.
   * @param {{next: () => number}} rng générateur (kit/rng.js) pour mélanger l'ordre des copies de chaque case
   */
  build(rng) {
    for (const layer of this.layers) {
      layer.cells = layer.pending.map((list) => {
        if (!list) return null;
        const cell = new Float32Array(list);
        if (layer.thin) shuffleMatrices(cell, rng);
        return cell;
      });
      layer.pending = null;
      if (layer.count === 0) {
        for (const part of layer.parts) disposeObject(part);
        continue;
      }
      const matrices = new THREE.InstancedBufferAttribute(new Float32Array(layer.count * 16), 16);
      matrices.setUsage(THREE.DynamicDrawUsage);
      layer.matrices = matrices;
      for (const part of layer.parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, 0);
        mesh.name = `${layer.name} / ${part.name}`;
        mesh.instanceMatrix = matrices;
        mesh.customDepthMaterial = part.customDepthMaterial;
        mesh.castShadow = layer.castShadow ?? part.castShadow;
        mesh.receiveShadow = part.receiveShadow;
        mesh.frustumCulled = false; // le tri se fait par case, ici
        mesh.visible = false;
        mesh.matrixAutoUpdate = false;
        // Un maillage décalé dans son modèle garde son décalage (rare : les assets fusionnent à l'origine).
        mesh.userData.offset = part.matrixWorld.equals(_child.identity()) ? null : part.matrixWorld.clone();
        if (mesh.userData.offset) mesh.matrix.copy(mesh.userData.offset);
        layer.meshes.push(mesh);
        this.group.add(mesh);
      }
    }
    this.layers = this.layers.filter((layer) => layer.count > 0);
    for (const [name, cls] of Object.entries(this.classes)) {
      const layers = this.layers.filter((layer) => layer.reach === name);
      cls.active = cls.boxes.map((_, index) => index).filter((index) => layers.some((layer) => layer.cells[index]));
    }
  }

  /**
   * À appeler à chaque image avant le rendu : met à jour les copies dessinées si la vue a changé.
   * @param {THREE.Camera} camera caméra de la vue (matrices à jour)
   * @param {object} [limits]
   * @param {number} [limits.budget] triangles que le semis peut coûter par image, ombres comprises
   * @param {number} [limits.shadowCost] coût d'un triangle qui projette une ombre (2 si la carte d'ombre est
   *   refaite à chaque image, 1,5 une image sur deux)
   * @param {number} [limits.minThin] triangles laissés aux couches fines même quand les arbres prennent tout
   * @returns {boolean} vrai si les copies ont été recopiées
   */
  update(camera, { budget = Infinity, shadowCost = 2, minThin = 30000 } = {}) {
    _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_viewProjection);
    let changed = budget !== this._budget;
    this._budget = budget;

    for (const cls of Object.values(this.classes)) {
      let length = 0;
      for (let i = 0; i < cls.active.length; i++) {
        const index = cls.active[i];
        if (_frustum.intersectsBox(cls.boxes[index])) cls.visible[length++] = index;
      }
      let same = length === cls.previousLength;
      for (let i = 0; same && i < length; i++) same = cls.visible[i] === cls.previous[i];
      cls.length = length;
      if (!same) {
        cls.previous.set(cls.visible);
        cls.previousLength = length;
        changed = true;
      }
    }
    if (!changed) return false;

    // Ce que coûtent les couches pleines (arbres, rochers) fixe ce qu'il reste aux couches fines ; on en dessine
    // la part qui tient dans ce reste, par crans de 5 %, jamais moins de 20 %.
    let wanted = 0;
    let fixed = 0;
    for (const layer of this.layers) {
      const cls = this.classes[layer.reach];
      let floats = 0;
      for (let i = 0; i < cls.length; i++) floats += layer.cells[cls.visible[i]]?.length ?? 0;
      if (layer.thin) wanted += (floats / 16) * layer.triangles;
      else fixed += (floats / 16) * layer.triangles * (layer.castsShadow ? shadowCost : 1);
    }
    const thinBudget = Math.max(minThin, budget - fixed);
    this.fraction = wanted > thinBudget ? Math.max(0.2, Math.floor((thinBudget / wanted) * 20) / 20) : 1;
    this._refill(this.fraction);
    return true;
  }

  /** Copies et triangles dessinés à cet instant (hors passe d'ombre). */
  stats() {
    let instances = 0;
    let triangles = 0;
    let drawCalls = 0;
    for (const layer of this.layers) {
      const count = layer.meshes[0]?.count ?? 0;
      instances += count;
      triangles += count * layer.triangles;
      if (count > 0) drawCalls += layer.meshes.length;
    }
    return { instances, triangles, drawCalls };
  }


  dispose() {
    for (const layer of this.layers) {
      for (const mesh of layer.meshes) {
        disposeObject(mesh);
        mesh.dispose();
      }
    }
    this.group.clear();
    this.layers = [];
  }

  _cellIndex(cls, x, z) {
    const col = THREE.MathUtils.clamp(Math.floor((x - this.bounds.minX) / cls.cellSize), 0, cls.cols - 1);
    const row = THREE.MathUtils.clamp(Math.floor((z - this.bounds.minZ) / cls.cellSize), 0, cls.rows - 1);
    return row * cls.cols + col;
  }

  _refill(fraction) {
    for (const layer of this.layers) {
      const cls = this.classes[layer.reach];
      const array = layer.matrices.array;
      let offset = 0;
      for (let i = 0; i < cls.length; i++) {
        const cell = layer.cells[cls.visible[i]];
        if (!cell) continue;
        const total = cell.length / 16;
        // Arrondi tiré une fois pour toutes par case : en moyenne exactement `fraction`, sans clignotement.
        const count = layer.thin && fraction < 1 ? Math.floor(total * fraction + cellDither(cls.visible[i], layer.index)) : total;
        if (count === 0) continue;
        array.set(count === total ? cell : cell.subarray(0, count * 16), offset);
        offset += count * 16;
      }
      layer.matrices.clearUpdateRanges();
      if (offset > 0) {
        layer.matrices.addUpdateRange(0, offset);
        layer.matrices.needsUpdate = true;
      }
      for (const mesh of layer.meshes) {
        mesh.count = offset / 16;
        mesh.visible = offset > 0;
      }
    }
  }
}

/** Nombre fixe dans [0, 1[ propre à une case et à une couche. */
function cellDither(cell, layer) {
  const value = Math.sin(cell * 12.9898 + layer * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Mélange (Fisher-Yates) des matrices 4 × 4 rangées bout à bout. */
function shuffleMatrices(array, rng) {
  const count = array.length / 16;
  const swap = new Float32Array(16);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    if (i === j) continue;
    swap.set(array.subarray(i * 16, i * 16 + 16));
    array.copyWithin(i * 16, j * 16, j * 16 + 16);
    array.set(swap, j * 16);
  }
}
