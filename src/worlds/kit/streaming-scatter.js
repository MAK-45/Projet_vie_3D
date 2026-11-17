// Semis d'un monde sans bord : comme `ScatterField` (scatter.js), un asset modèle = une couche = un `InstancedMesh`
// par maillage du modèle, donc autant de draw calls que le modèle seul. Mais les cases ne sont pas posées d'avance
// sur une carte : elles arrivent et partent par morceaux (`beginChunk` / `endChunk` / `removeChunk`), au fil de la
// marche. Le coût d'une image reste celui de ce qui est dans le champ ; la mémoire, celui des morceaux chargés.

import * as THREE from "three";
import { disposeObject } from "../../engine/toon-material.js";
import { limitShadowCopies } from "./scatter.js";

const _frustum = new THREE.Frustum();
const _viewProjection = new THREE.Matrix4();
const _identity = new THREE.Matrix4();

export class StreamingScatter {
  /**
   * @param {object} options
   * @param {number} options.chunkSize côté d'un morceau (m), multiple du côté des cases de chaque famille
   * @param {(x: number, z: number) => number} [options.heightAt] hauteur du sol (bornes des cases au plus juste)
   * @param {Record<string, {cellSize: number, height: number, margin: number}>} [options.classes] familles de
   *   couches, comme pour `ScatterField`
   */
  constructor({
    chunkSize,
    heightAt = () => 0,
    classes = {
      fine: { cellSize: 4, height: 1.6, margin: 1.6 },
      low: { cellSize: 8, height: 3, margin: 3.5 },
      tall: { cellSize: 4, height: 15, margin: 8.5 },
    },
  }) {
    this.chunkSize = chunkSize;
    this.heightAt = heightAt;
    this.group = new THREE.Group();
    this.group.name = "streaming scatter";
    this.layers = [];
    this.classes = {};
    /** Part des copies fines dessinées (1 = toutes). */
    this.fraction = 1;
    this._dirty = true;
    this._chunk = null; // morceau en cours de remplissage
    for (const [name, { cellSize, height, margin }] of Object.entries(classes)) {
      const per = Math.round(chunkSize / cellSize);
      if (Math.abs(per * cellSize - chunkSize) > 1e-6) throw new Error(`streaming-scatter : ${chunkSize} m n'est pas un multiple de ${cellSize} m`);
      this.classes[name] = { name, cellSize, per, height, margin, cells: [], visible: [], previous: [] };
    }
  }

  /**
   * Déclare une couche à partir d'un asset modèle (même contrat que `ScatterField.addLayer`).
   * @returns {{add: (matrix: THREE.Matrix4) => void, index: number, triangles: number}}
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
    const cls = this.classes[reach];
    const layer = {
      name: prototype.name,
      reach,
      thin,
      index: this.layers.length,
      meshes: [],
      matrices: null,
      capacity: 0,
      triangles: 0,
      add: (matrix) => {
        const chunk = this._chunk;
        const e = matrix.elements;
        const col = THREE.MathUtils.clamp(Math.floor((e[12] - chunk.minX) / cls.cellSize), 0, cls.per - 1);
        const row = THREE.MathUtils.clamp(Math.floor((e[14] - chunk.minZ) / cls.cellSize), 0, cls.per - 1);
        const lists = chunk.pending[reach][row * cls.per + col];
        (lists[layer.index] ??= []).push(...e);
      },
    };
    for (const part of parts) {
      const geometry = part.geometry;
      layer.triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
      const mesh = new THREE.InstancedMesh(geometry, part.material, 0);
      mesh.name = `${layer.name} / ${part.name}`;
      mesh.customDepthMaterial = part.customDepthMaterial;
      mesh.castShadow = castShadow ?? part.castShadow;
      mesh.receiveShadow = part.receiveShadow;
      mesh.frustumCulled = false; // le tri se fait par case, ici
      mesh.visible = false;
      mesh.matrixAutoUpdate = false;
      limitShadowCopies(mesh);
      if (!part.matrixWorld.equals(_identity)) mesh.matrix.copy(part.matrixWorld);
      layer.meshes.push(mesh);
      this.group.add(mesh);
    }
    this._grow(layer, 256);
    this.layers.push(layer);
    return layer;
  }

  /**
   * Commence un morceau : les `add` qui suivent lui appartiennent, jusqu'à `endChunk`.
   * @param {number} minX coin du morceau (m)
   * @param {number} minZ
   */
  beginChunk(minX, minZ) {
    const pending = {};
    for (const [name, cls] of Object.entries(this.classes)) {
      pending[name] = Array.from({ length: cls.per * cls.per }, () => []);
    }
    this._chunk = { minX, minZ, pending };
  }

  /**
   * Fige le morceau en cours et le met en jeu.
   * @param {{next: () => number}} rng mélange l'ordre des copies fines de chaque case
   * @returns {object} le morceau, à rendre à `removeChunk`
   */
  endChunk(rng) {
    const { minX, minZ, pending } = this._chunk;
    this._chunk = null;
    const chunk = { cells: [] };
    for (const [name, cls] of Object.entries(this.classes)) {
      pending[name].forEach((lists, index) => {
        if (!lists.some(Boolean)) return;
        const x = minX + (index % cls.per) * cls.cellSize;
        const z = minZ + Math.floor(index / cls.per) * cls.cellSize;
        let low = Infinity;
        let high = -Infinity;
        for (let k = 0; k < 9; k++) {
          const h = this.heightAt(x + ((k % 3) / 2) * cls.cellSize, z + (Math.floor(k / 3) / 2) * cls.cellSize);
          low = Math.min(low, h);
          high = Math.max(high, h);
        }
        const cell = {
          cls,
          box: new THREE.Box3(
            new THREE.Vector3(x - cls.margin, low - 0.3, z - cls.margin),
            new THREE.Vector3(x + cls.cellSize + cls.margin, high + 0.2 + cls.height, z + cls.cellSize + cls.margin),
          ),
          // Une liste de matrices par couche (null : rien de cette couche dans la case).
          data: lists.map((list, layerIndex) => {
            if (!list) return null;
            const array = new Float32Array(list);
            if (this.layers[layerIndex].thin) shuffleMatrices(array, rng);
            return array;
          }),
          dither: cellDither(x, z),
          distance: 0, // à la caméra, à la dernière image (tri des ombres)
        };
        cls.cells.push(cell);
        chunk.cells.push(cell);
      });
    }
    this._dirty = true;
    return chunk;
  }

  /** Retire un morceau : ses copies ne sont plus dessinées, ses matrices sont libérées. */
  removeChunk(chunk) {
    const gone = new Set(chunk.cells);
    for (const cls of Object.values(this.classes)) {
      if (cls.cells.some((cell) => gone.has(cell))) cls.cells = cls.cells.filter((cell) => !gone.has(cell));
    }
    chunk.cells.length = 0;
    this._dirty = true;
  }

  /**
   * À appeler à chaque image avant le rendu (mêmes règles que `ScatterField.update`) : `fraction` ne dépend que
   * du cadrage, jamais de ce qui est dans la vue, sinon l'herbe clignoterait pendant la marche.
   * @param {THREE.Camera} camera
   * @param {number} [fraction] part des copies dessinées dans les couches fines (0..1)
   * @param {object} [options] pour une caméra perspective (vue à la 3e personne)
   * @param {Record<string, number>} [options.reach] portée par famille (m) : au-delà de cette distance à la
   *   caméra, les cases de la famille ne sont pas dessinées (l'herbe lointaine ne fait qu'un pixel)
   * @param {number} [options.shadowReach] seules les copies à moins de cette distance de la caméra (m) projettent
   *   leur ombre : les copies sont alors rangées de la plus proche à la plus lointaine
   */
  update(camera, fraction = 1, { reach = null, shadowReach = Infinity } = {}) {
    _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_viewProjection);
    const step = Math.round(THREE.MathUtils.clamp(fraction, 0.1, 1) * 20) / 20;
    let changed = step !== this.fraction || this._dirty;
    this._dirty = false;
    this.fraction = step;
    for (const [name, cls] of Object.entries(this.classes)) {
      const { cells, visible, previous } = cls;
      const limit = reach?.[name] ?? Infinity;
      let length = 0;
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!_frustum.intersectsBox(cell.box)) continue;
        const distance = limit === Infinity && shadowReach === Infinity ? 0 : cell.box.distanceToPoint(camera.position);
        if (distance >= limit) continue;
        cell.distance = distance;
        visible[length++] = cell;
      }
      visible.length = length;
      let same = length === previous.length;
      for (let i = 0; same && i < length; i++) same = visible[i] === previous[i];
      if (!same) {
        previous.length = length;
        for (let i = 0; i < length; i++) previous[i] = visible[i];
        changed = true;
      }
    }
    if (changed || shadowReach !== this._shadowReach) this._refill(step, shadowReach);
    this._shadowReach = shadowReach;
    return changed;
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
    let cells = 0;
    for (const cls of Object.values(this.classes)) cells += cls.cells.length;
    return { instances, triangles, drawCalls, cells };
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
    for (const cls of Object.values(this.classes)) cls.cells = cls.visible = cls.previous = [];
  }

  /** Agrandit le tampon de matrices d'une couche (rare : la place gagnée sert aux morceaux suivants). */
  _grow(layer, capacity) {
    const matrices = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
    matrices.setUsage(THREE.DynamicDrawUsage);
    for (const mesh of layer.meshes) {
      // `dispose` libère le tampon GPU de l'ancien attribut ; le moteur réabonne le maillage au prochain rendu.
      if (layer.matrices) mesh.dispose();
      mesh.instanceMatrix = matrices;
    }
    layer.matrices = matrices;
    layer.capacity = capacity;
  }

  _refill(fraction, shadowReach = Infinity) {
    const trim = shadowReach !== Infinity;
    // Du plus proche au plus lointain : les copies qui projettent une ombre viennent en tête.
    if (trim) for (const cls of Object.values(this.classes)) cls.visible.sort(byDistance);
    for (const layer of this.layers) {
      const cls = this.classes[layer.reach];
      const visible = cls.visible;
      const thinned = layer.thin && fraction < 1;
      // Combien de copies, pour savoir si le tampon suffit.
      let needed = 0;
      for (let i = 0; i < visible.length; i++) {
        const cell = visible[i].data[layer.index];
        if (!cell) continue;
        const total = cell.length / 16;
        needed += thinned ? Math.floor(total * fraction + ditherFor(visible[i], layer.index)) : total;
      }
      if (needed > layer.capacity) this._grow(layer, Math.ceil(needed * 1.5));
      const array = layer.matrices.array;
      let offset = 0;
      let shadowOffset = trim ? -1 : -16;
      for (let i = 0; i < visible.length; i++) {
        if (shadowOffset === -1 && visible[i].distance > shadowReach) shadowOffset = offset;
        const cell = visible[i].data[layer.index];
        if (!cell) continue;
        const total = cell.length / 16;
        // Arrondi tiré une fois pour toutes par case : en moyenne exactement `fraction`, sans clignotement.
        const count = thinned ? Math.floor(total * fraction + ditherFor(visible[i], layer.index)) : total;
        if (count === 0) continue;
        array.set(count === total ? cell : cell.subarray(0, count * 16), offset);
        offset += count * 16;
      }
      layer.matrices.clearUpdateRanges();
      if (offset > 0) {
        layer.matrices.addUpdateRange(0, offset);
        layer.matrices.needsUpdate = true;
      }
      if (shadowOffset === -1) shadowOffset = offset;
      for (const mesh of layer.meshes) {
        mesh.count = offset / 16;
        mesh.visible = offset > 0;
        mesh.userData.shadowCount = shadowOffset / 16;
      }
    }
  }
}

const byDistance = (a, b) => a.distance - b.distance;

/** Nombre fixe dans [0, 1[ propre à une case (par sa place dans le monde). */
function cellDither(x, z) {
  const value = Math.sin(x * 12.9898 + z * 4.1414) * 43758.5453;
  return value - Math.floor(value);
}

/** Nombre fixe dans [0, 1[ propre à une case et à une couche. */
function ditherFor(cell, layerIndex) {
  const value = Math.sin(cell.dither * 91.7 + layerIndex * 78.233) * 43758.5453;
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
