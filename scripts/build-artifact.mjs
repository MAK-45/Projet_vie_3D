// `npm run artifact` : assemble la galerie en une seule page HTML autonome (dist-artifact/atelier-vie-3d.html),
// publiable comme Artifact. Tout est en ligne (styles, code, catalogue) ; seul three.js vient de
// cdn.jsdelivr.net, à version exacte. Le fichier n'a ni <html> ni <body> : l'Artifact les ajoute.
// Seule exception au « tout en ligne » : les modèles importés (personnages, animations) de public/models/, copiés
// dans dist-artifact/models/ et publiés comme fichiers de l'Artifact, à côté de la page (`files`).

import { build } from "esbuild";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCatalog, ROOT, THREE_VERSION, toScriptJson } from "./catalog-lib.mjs";

const THREE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

const bundle = await build({
  entryPoints: [path.join(ROOT, "src/gallery/main.js")],
  bundle: true,
  format: "esm",
  target: "es2022",
  minify: true,
  write: false,
  legalComments: "none",
  plugins: [
    {
      // `three` est chargé depuis le CDN ; les addons (OrbitControls) sont inclus et pointent vers le même three.
      name: "three-cdn",
      setup(context) {
        context.onResolve({ filter: /^three$/ }, () => ({ path: THREE_URL, external: true }));
      },
    },
  ],
});
const script = bundle.outputFiles[0].text.replaceAll("</script", "<\\/script");

const index = await readFile(path.join(ROOT, "index.html"), "utf8");
const title = index.match(/<title>(.*?)<\/title>/)[1];
const fonts = index.match(/<link\s+rel="stylesheet"\s+href="(https:\/\/fonts\.googleapis\.com[^"]+)"/s)[1];
const markup = index.slice(index.indexOf("<!--app:start-->") + "<!--app:start-->".length, index.indexOf("<!--app:end-->")).trim();
const style =
  (await readFile(path.join(ROOT, "src/gallery/style.css"), "utf8")) + "\n" + (await readFile(path.join(ROOT, "src/explorer/style.css"), "utf8"));
const catalog = await buildCatalog({ withSources: true });

const html = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="pv3d-model-format" content="gltf-json">
<link rel="stylesheet" href="${fonts}">
<style>
${style}
</style>
${markup}
<script type="application/json" id="pv3d-catalog">${toScriptJson(catalog)}</script>
<script type="module">
${script}
</script>
`;

const outDir = path.join(ROOT, "dist-artifact");
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, "atelier-vie-3d.html");
await writeFile(outFile, html);
// Modèles importés : à publier avec la page, aux mêmes chemins (`files` de l'outil Artifact).
const modelsOut = path.join(outDir, "models");
await rm(modelsOut, { recursive: true, force: true });
await cp(path.join(ROOT, "public/models"), modelsOut, { recursive: true });
// Les Artifacts ne servent pas le type .glb : chaque modèle y est publié en glTF texte (`.gltf.json`, données en
// base64 dans le fichier), que GLTFLoader lit tel quel ; la page le sait par <meta name="pv3d-model-format">.
for (const entry of await readdir(modelsOut, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".glb")) continue;
  const file = path.join(entry.parentPath, entry.name);
  await writeFile(file.replace(/\.glb$/, ".gltf.json"), glbToGltfJson(await readFile(file)));
  await rm(file);
}
const models = (await readdir(modelsOut, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile())
  .map((entry) => path.relative(outDir, path.join(entry.parentPath, entry.name)).replaceAll(path.sep, "/"))
  .sort();
await writeFile(path.join(outDir, "models.json"), JSON.stringify(Object.fromEntries(models.map((file) => [file, `dist-artifact/${file}`])), null, 2) + "\n");
console.log(`fichiers à publier avec la page (files) : dist-artifact/models.json — ${models.join(", ")}`);
console.log(`artifact : ${path.relative(ROOT, outFile)} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko, ${catalog.assets.length} asset(s), three@${THREE_VERSION} depuis jsDelivr`);

/** GLB → glTF JSON autonome : le bloc binaire devient le premier tampon, en data URI base64. */
function glbToGltfJson(glb) {
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  const binStart = 20 + jsonLength;
  if (binStart < glb.length) {
    const binLength = glb.readUInt32LE(binStart);
    const bin = glb.subarray(binStart + 8, binStart + 8 + binLength);
    json.buffers[0].uri = `data:application/octet-stream;base64,${bin.toString("base64")}`;
  }
  return JSON.stringify(json);
}
