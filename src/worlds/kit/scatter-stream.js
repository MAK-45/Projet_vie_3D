// Semis en flux, pour un monde sans bord : comme `ScatterField` (scatter.js), chaque asset modèle devient une
// couche (un `InstancedMesh` par maillage du modèle, donc autant de draw calls que le modèle seul) et les copies
// sont rangées par cases que l'on trie contre la vue. La différence : les cases arrivent et repartent par
// morceaux (`commitChunk`, `removeChunk`) au fil de la marche, au lieu d'être toutes semées d'avance.
//
// - Une case appartient à un morceau ; deux morceaux peuvent avoir chacun une case au même endroit (une copie
//   qui déborde un peu de son morceau), chacune avec ses copies : aucune n'est jamais perdue ni doublée.
// - Les couches fines (herbe, fleurs) s'éclaircissent quand la vue couvre beaucoup de terrain, case par case,
//   avec un arrondi tiré une fois pour toutes d'après la position de la case : rien ne clignote en marchant.
// - Les tampons de matrices ne grandissent que quand il le faut (par doublement), jamais à chaque image.

import * as THREE from "three";
import { disposeObject } from "../../engine/toon-material.js";

const _frustum = new THREE.Frustum();
const _viewProjection = new THREE.Matrix4();
const _identity = new THREE.Matrix4();

export class ScatterStream {
  /**
   * @param {object} [options]
   * @param {Record<string, {cellSize: number, height: number, margin: number}>} [options.classes] familles de
   *   couches : côté des cases (doit diviser le côté des morceaux), hauteur de ce qui y pousse, marge autour de
   *   la case (débord des couronnes, ombres portées venues de hors champ)
   */
  constructor({
    classes = {
      fine: { cellSize: 4, height: 1.6, margin: 1.6 },
      low: { cellSize: 8, height: 3, margin: 3.5 },
      tall: { cellSize: 4, height: 15, margin: 8.5 },
    },
  } = {}) {
    this.group = new THREE.Group();
    this.group.name = "scatter";
    this.classes = classes;
    this.layers = [];
    /** @type {Map<string, {key: string, box: THREE.Box3, cells: object[]}>} */
    this.chunks = new Map();
    this.fraction = 1;
    this._dirty = true;
    /** Cases vues à l'image précédente, par famille. */
    this._visible = Object.fromEntries(Object.keys(classes).map((name) => [name, { list: [], previous: [] }]));
  }

  /**
   * Déclare une couche à partir d'un asset modèle (même contrat que `ScatterField.addLayer`). Le groupe est
   * absorbé : ses géométries et matériaux servent aux copies, et sont libérés par `dispose()`.
   * @param {THREE.Group} prototype
   * @param {{reach?: string, thin?: boolean, castShadow?: boolean, skip?: string[]}} [options]
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
    const layer = { name: prototype.name, reach, thin, index: this.layers.length, meshes: [], triangles: 0, capacity: 0, matrices: null };
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
      if (!part.matrixWorld.equals(_identity)) mesh.matrix.copy(part.matrixWorld);
      layer.meshes.push(mesh);
      this.group.add(mesh);
    }
    this._grow(layer, 256);
    this.layers.push(layer);
    return layer;
  }

  /**
   * Commence un morceau : on y ajoute des copies avec `add(layer, matrix)`, puis on le confie au semis avec
   * `commitChunk`. Rien n'est dessiné avant.
   * @param {string} key identifiant du morceau
   */
  beginChunk(key) {
    const pending = new Map();
    return {
      key,
      count: 0,
      add: (layer, matrix) => {
        const e = matrix.elements;
        const size = this.classes[layer.reach].cellSize;
        const col = Math.floor(e[12] / size);
        const row = Math.floor(e[14] / size);
        const cellKey = `${layer.reach}:${col}:${row}`;
        let cell = pending.get(cellKey);
        if (!cell) pending.set(cellKey, (cell = { reach: layer.reach, col, row, lists: [] }));
        (cell.lists[layer.index] ??= []).push(...e);
      },
      pending,
    };
  }

  /**
   * Fige un morceau commencé par `beginChunk` et l'ajoute au semis.
   * @param {ReturnType<ScatterStream["beginChunk"]>} chunk
   * @param {(x: number, z: number) => number} heightAt hauteur du sol, pour borner chaque case au plus juste
   * @param {{next: () => number}} rng pour mélanger l'ordre des copies des couches fines
   * @param {number} [slack] marge de hauteur en plus (m), quand `heightAt` n'est qu'une approximation
   */
  commitChunk(chunk, heightAt, rng, slack = 0) {
    const cells = [];
    const box = new THREE.Box3();
    for (const pending of chunk.pending.values()) {
      const { cellSize, height, margin } = this.classes[pending.reach];
      const x = pending.col * cellSize;
      const z = pending.row * cellSize;
      let low = Infinity;
      let high = -Infinity;
      for (let k = 0; k < 9; k++) {
        const h = heightAt(x + ((k % 3) / 2) * cellSize, z + (Math.floor(k / 3) / 2) * cellSize);
        low = Math.min(low, h);
        high = Math.max(high, h);
      }
      const cell = {
        reach: pending.reach,
        box: new THREE.Box3(
          new THREE.Vector3(x - margin, low - 0.3 - slack, z - margin),
          new THREE.Vector3(x + cellSize + margin, high + 0.2 + height + slack, z + cellSize + margin),
        ),
        data: [],
        dither: hash2(pending.col, pending.row),
      };
      for (let i = 0; i < pending.lists.length; i++) {
        const list = pending.lists[i];
        if (!list) continue;
        const array = new Float32Array(list);
        if (this.layers[i].thin) shuffleMatrices(array, rng);
        cell.data[i] = array;
        chunk.count += array.length / 16;
      }
      box.union(cell.box);
      cells.push(cell);
    }
    this.removeChunk(chunk.key);
    this.chunks.set(chunk.key, { key: chunk.key, box, cells, count: chunk.count });
    this._dirty = true;
  }

  /** Retire un morceau et ses copies. */
  removeChunk(key) {
    if (this.chunks.delete(key)) this._dirty = true;
  }

  /**
   * À appeler à chaque image avant le rendu : met à jour les copies dessinées si la vue ou les morceaux ont changé.
   * `fraction` ne doit dépendre que du cadrage (voir `ScatterField.update`).
   * @param {THREE.Camera} camera
   * @param {number} [fraction] part des copies dessinées dans les couches fines (0..1)
   */
  update(camera, fraction = 1) {
    _viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_viewProjection);
    const step = Math.round(THREE.MathUtils.clamp(fraction, 0.1, 1) * 20) / 20;
    let changed = step !== this.fraction || this._dirty;
    this.fraction = step;
    this._dirty = false;

    for (const visible of Object.values(this._visible)) {
      [visible.previous, visible.list] = [visible.list, visible.previous];
      visible.list.length = 0;
    }
    for (const chunk of this.chunks.values()) {
      if (!_frustum.intersectsBox(chunk.box)) continue;
      for (const cell of chunk.cells) {
        if (_frustum.intersectsBox(cell.box)) this._visible[cell.reach].list.push(cell);
      }
    }
    for (const { list, previous } of Object.values(this._visible)) {
      if (changed) break;
      if (list.length !== previous.length) changed = true;
      for (let i = 0; !changed && i < list.length; i++) changed = list[i] !== previous[i];
    }
    if (changed) this._refill(step);
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
    return { instances, triangles, drawCalls, chunks: this.chunks.size };
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
    this.chunks.clear();
  }

  /** Agrandit le tampon de matrices d'une couche (par doublement : rare). */
  _grow(layer, needed) {
    if (needed <= layer.capacity) return;
    let capacity = Math.max(256, layer.capacity);
    while (capacity < needed) capacity *= 2;
    const matrices = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
    matrices.setUsage(THREE.DynamicDrawUsage);
    for (const mesh of layer.meshes) mesh.instanceMatrix = matrices;
    layer.matrices = matrices;
    layer.capacity = capacity;
  }

  _refill(fraction) {
    const counts = new Array(this.layers.length).fill(0);
    // Combien de copies de chaque couche dans les cases vues, pour savoir s'il faut agrandir un tampon.
    for (const { list } of Object.values(this._visible)) {
      for (const cell of list) {
        for (let i = 0; i < cell.data.length; i++) {
          const data = cell.data[i];
          if (data) counts[i] += visibleCount(this.layers[i], cell, data, fraction);
        }
      }
    }
    for (const layer of this.layers) this._grow(layer, counts[layer.index]);

    const offsets = new Array(this.layers.length).fill(0);
    for (const { list } of Object.values(this._visible)) {
      for (const cell of list) {
        for (let i = 0; i < cell.data.length; i++) {
          const data = cell.data[i];
          if (!data) continue;
          const count = visibleCount(this.layers[i], cell, data, fraction);
          if (count === 0) continue;
          this.layers[i].matrices.array.set(count * 16 === data.length ? data : data.subarray(0, count * 16), offsets[i]);
          offsets[i] += count * 16;
        }
      }
    }
    for (const layer of this.layers) {
      const offset = offsets[layer.index];
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

/** Copies dessinées d'une couche dans une case : toutes, ou une part fixe pour les couches fines. */
function visibleCount(layer, cell, data, fraction) {
  const total = data.length / 16;
  if (!layer.thin || fraction >= 1) return total;
  const dither = cell.dither + layer.index * 0.618034;
  return Math.floor(total * fraction + (dither - Math.floor(dither)));
}

/** Nombre fixe dans [0, 1[ propre à une case de la grille du monde. */
function hash2(col, row) {
  let h = (Math.imul(col, 0x8da6b343) ^ Math.imul(row, 0xd8163841)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
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
