// `npm run artifact:prairie` : assemble l'explorateur de la prairie d'été en une seule page HTML autonome
// (dist-artifact/prairie-ete.html), publiable comme Artifact. Tout est en ligne (styles, code) ; seul three.js
// vient de cdn.jsdelivr.net, à version exacte. Le fichier n'a ni <html> ni <body> : l'Artifact les ajoute.

import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT, THREE_VERSION } from "./catalog-lib.mjs";

const THREE_URL = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;

const bundle = await build({
  entryPoints: [path.join(ROOT, "src/explorer/main.js")],
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

const page = await readFile(path.join(ROOT, "explorer.html"), "utf8");
const title = page.match(/<title>(.*?)<\/title>/)[1];
const fonts = page.match(/<link\s+rel="stylesheet"\s+href="(https:\/\/fonts\.googleapis\.com[^"]+)"/s)[1];
const markup = page.slice(page.indexOf("<!--app:start-->") + "<!--app:start-->".length, page.indexOf("<!--app:end-->")).trim();
const style = await readFile(path.join(ROOT, "src/explorer/style.css"), "utf8");

const html = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="${fonts}">
<style>
${style}
</style>
${markup}
<script type="module">
${script}
</script>
`;

const outDir = path.join(ROOT, "dist-artifact");
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, "prairie-ete.html");
await writeFile(outFile, html);
console.log(`artifact : ${path.relative(ROOT, outFile)} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko, three@${THREE_VERSION} depuis jsDelivr`);
