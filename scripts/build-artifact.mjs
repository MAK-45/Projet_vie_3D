// `npm run artifact` : assemble la galerie en une seule page HTML autonome (dist-artifact/atelier-vie-3d.html),
// publiable comme Artifact. Tout est en ligne (styles, code, catalogue) ; seul three.js vient de
// cdn.jsdelivr.net, à version exacte. Le fichier n'a ni <html> ni <body> : l'Artifact les ajoute.

import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
console.log(`artifact : ${path.relative(ROOT, outFile)} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko, ${catalog.assets.length} asset(s), three@${THREE_VERSION} depuis jsDelivr`);
