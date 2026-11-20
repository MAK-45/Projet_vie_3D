// Modèles importés (glTF binaire) : chargement, cache et source des fichiers.
//
// Presque tout le projet est dessiné en code. Les personnages et leurs animations viennent, eux, de fichiers
// glTF optimisés (maillage simplifié, quantifié et compressé Meshopt), rangés dans `public/models/` et publiés à
// côté de la page de la galerie. Un asset importé construit son `THREE.Group` tout de suite, vide, et le remplit
// quand le fichier est chargé : `group.userData.ready` est la promesse de cette fin de chargement.
//
// - Page autonome (Artifact) : les fichiers sont embarqués dans la page, en base64 (scripts/build-artifact.mjs).
// - Navigateur : sinon les fichiers sont lus par `fetch`, relativement à la page (`models/...`) ; une page rangée
//   ailleurs (dev/test.html) donne la bonne base avec `setModelSource({ base: "/models/" })`.
// - Node (catalogue, vérifications) : `setModelSource({ read })` fournit les octets ; les textures, qui demandent
//   un décodeur d'images, sont ignorées (la forme seule est mesurée).

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const source = { base: null, read: null };
const gltfCache = new Map();
const textureCache = new Map();
let loader = null;

/**
 * Règle d'où viennent les fichiers de `public/models/`.
 * @param {{base?: string, read?: (path: string) => Promise<ArrayBuffer | Uint8Array>}} options
 *   base : URL du dossier (défaut : `models/` à côté de la page) ; read : lecteur d'octets (Node)
 */
export function setModelSource({ base, read } = {}) {
  if (base !== undefined) source.base = base;
  if (read !== undefined) source.read = read;
}

const hasDom = () => typeof document !== "undefined";

/** Fichier embarqué dans la page (Artifact : `<script type="text/plain" data-pv3d-model="chemin">base64</script>`). */
function embedded(path) {
  if (!hasDom()) return null;
  for (const script of document.querySelectorAll("script[data-pv3d-model]")) {
    if (script.dataset.pv3dModel === path) return script.textContent.trim();
  }
  return null;
}

function urlOf(path) {
  const base = source.base ?? (hasDom() ? new URL("models/", document.baseURI).href : "models/");
  return hasDom() ? new URL(path, new URL(base, document.baseURI)).href : base + path;
}

async function readBytes(path) {
  const inline = embedded(path);
  if (inline) {
    const binary = atob(inline);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  if (source.read) {
    const data = await source.read(path);
    return data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  }
  const response = await fetch(urlOf(path));
  if (!response.ok) throw new Error(`modèle introuvable : ${path} (${response.status})`);
  return response.arrayBuffer();
}

/**
 * Charge un fichier glTF binaire de `public/models/` (une seule fois par chemin). Le résultat est partagé :
 * le cloner (`SkeletonUtils.clone`) avant de le poser dans une scène.
 * @param {string} path chemin sous `public/models/`, ex. `characters/mannequin.glb`
 */
export function loadGltf(path) {
  if (!gltfCache.has(path)) {
    loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const promise = readBytes(path).then((data) => loader.parseAsync(data, ""));
    promise.catch(() => gltfCache.delete(path));
    gltfCache.set(path, promise);
  }
  return gltfCache.get(path);
}

/**
 * Charge une texture de couleur pour un modèle (une seule fois par chemin) : pixels nets, couleurs brutes (le
 * matériau toon écrit du sRGB tel quel), sens glTF. Résout à `null` hors navigateur.
 * @param {string} path chemin sous `public/models/`
 */
export function loadModelTexture(path) {
  if (!hasDom()) return Promise.resolve(null);
  if (!textureCache.has(path)) {
    const inline = embedded(path);
    const url = inline ? `data:image/png;base64,${inline}` : urlOf(path);
    const promise = new THREE.TextureLoader().loadAsync(url).then((texture) => {
      texture.colorSpace = THREE.NoColorSpace;
      texture.flipY = false;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestMipmapNearestFilter;
      texture.name = path;
      return texture;
    });
    promise.catch(() => textureCache.delete(path));
    textureCache.set(path, promise);
  }
  return textureCache.get(path);
}
