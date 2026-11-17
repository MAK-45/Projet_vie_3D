// Construit le catalogue des assets : la fiche de chaque asset (identifiant, catégorie, tags, paramètres),
// ses mesures (triangles, draw calls), son code source et un module autonome (dépendances incluses, seul
// `three` reste à fournir). Utilisé par le serveur de dev, la construction de l'artifact et `npm run catalog`.

import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Les assets importés (personnages, animations) lisent leurs fichiers glTF dans public/models/.
const { setModelSource } = await import(pathToFileURL(path.join(ROOT, "src/assets/kit/model.js")).href);
setModelSource({ read: (file) => readFile(path.join(ROOT, "public/models", file)) });
export const THREE_VERSION = JSON.parse(await readFile(path.join(ROOT, "node_modules/three/package.json"), "utf8")).version;

const ENGINE_FILES = [
  { path: "src/engine/pixel-renderer.js", role: "Pipeline pixel art : rendu basse résolution + passe de contours." },
  { path: "src/engine/iso-camera.js", role: "Caméra isométrique orbitale alignée sur la grille de pixels." },
  { path: "src/engine/toon-material.js", role: "Matériau toon à palette (déjà inclus dans chaque module autonome)." },
];

/** `nature/trees/birch` → `nature-trees-birch` (nom de fichier, ancre d'URL). */
export const slugOf = (id) => id.replaceAll("/", "-");

function measure(object) {
  let triangles = 0;
  let vertices = 0;
  let drawCalls = 0;
  object.traverse((child) => {
    if (!child.isMesh) return;
    const geometry = child.geometry;
    drawCalls += 1;
    vertices += geometry.attributes.position.count;
    triangles += (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  });
  return { triangles, vertices, drawCalls };
}

/**
 * @param {{withSources?: boolean}} [options] withSources : inclut le code (source + module autonome) de chaque asset
 */
export async function buildCatalog({ withSources = true } = {}) {
  const bust = `?v=${Date.now()}`;
  const registry = await import(pathToFileURL(path.join(ROOT, "src/assets/index.js")).href + bust);
  const assets = [];

  for (const module of registry.assets) {
    const meta = module.meta;
    const file = `src/assets/${meta.id}.js`;
    const source = await readFile(path.join(ROOT, file), "utf8");

    const bundle = await build({
      entryPoints: [path.join(ROOT, file)],
      bundle: true,
      format: "esm",
      target: "es2022",
      // three et ses addons (chargeur glTF des assets importés) restent à fournir.
      external: ["three", "three/addons/*"],
      write: false,
      metafile: true,
      legalComments: "none",
      banner: {
        js:
          `// Projet Vie 3D — ${meta.name} (${meta.id}), version ${meta.version}\n` +
          `// Module autonome : seule dépendance, three@${THREE_VERSION} (import "three" et, pour les assets importés, "three/addons/...").\n` +
          `// Exports : meta, create(params) → THREE.Group, tick(secondes), setWind(force), dispose(objet).`,
      },
    });
    const standalone = bundle.outputFiles[0].text;
    const dependencies = Object.keys(bundle.metafile.inputs)
      .map((input) => path.relative(ROOT, path.resolve(ROOT, input)).replaceAll(path.sep, "/"))
      .filter((input) => input !== file && !input.startsWith("node_modules"));

    const stats = {};
    const cases = [{ id: "default", params: {} }, ...(meta.variants ?? [])];
    for (const variant of cases) {
      const object = module.create(variant.params);
      await object.userData.ready; // assets importés : le modèle arrive après create()
      stats[variant.id] = measure(object);
      module.dispose?.(object);
    }

    assets.push({
      ...meta,
      slug: slugOf(meta.id),
      path: file,
      module: `public/catalog/modules/${slugOf(meta.id)}.js`,
      dependencies,
      stats,
      bytes: { source: Buffer.byteLength(source), standalone: Buffer.byteLength(standalone) },
      ...(withSources ? { source, standalone } : {}),
    });
  }

  const engine = [];
  for (const entry of ENGINE_FILES) {
    const source = await readFile(path.join(ROOT, entry.path), "utf8");
    engine.push({ ...entry, bytes: Buffer.byteLength(source), ...(withSources ? { source } : {}) });
  }

  return {
    schema: "pv3d-catalog/1",
    project: "Projet Vie 3D",
    three: THREE_VERSION,
    conventions: {
      units: "1 unité = 1 mètre ; Y vers le haut ; l'origine d'un asset est au sol, au centre de son emprise",
      pixelsPerUnit: 16,
      id: "<catégorie>/<sous-catégorie>/<nom> = chemin du module sous src/assets/, sans .js",
      module:
        "chaque module exporte meta, create(params) → THREE.Group, tick(secondes) pour le vent, " +
        "setWind(force) et dispose(objet)",
      rendering:
        "les matériaux écrivent des couleurs sRGB brutes et une 2e sortie (normales + identifiants) : " +
        "pour le rendu pixel art avec contours, utiliser PixelRenderer et IsoCamera (voir engine)",
    },
    taxonomy: registry.taxonomy,
    biomes: registry.biomes,
    engine,
    assets,
  };
}

/** JSON sûr à placer dans une balise <script type="application/json">. */
export function toScriptJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
