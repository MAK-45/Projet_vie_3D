// `npm run site` : assemble dist-site/, le site publié sur GitHub Pages (.github/workflows/pages.yml).
// - index.html : l'Atelier Vie 3D, la page autonome de `npm run artifact`, habillée en document HTML complet
//   (doctype, encodage, viewport mobile) ;
// - le reste : les pages statiques écrites à la main dans site/ (une par dossier, site/<nom>/index.html).
// À lancer après `npm run artifact` (le script npm `site` enchaîne les deux).

import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./catalog-lib.mjs";

const outDir = path.join(ROOT, "dist-site");
const siteDir = path.join(ROOT, "site");
const atelier = path.join(ROOT, "dist-artifact/atelier-vie-3d.html");

const exists = (file) => stat(file).then(() => true, () => false);

if (!(await exists(atelier))) {
  console.error("site : dist-artifact/atelier-vie-3d.html manque, lancer d'abord `npm run artifact`.");
  process.exit(1);
}
if (await exists(path.join(siteDir, "index.html"))) {
  console.error("site : site/index.html est réservé à l'Atelier ; mettre la page dans site/<nom>/index.html.");
  process.exit(1);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
if (await exists(siteDir)) await cp(siteDir, outDir, { recursive: true });

// La page autonome n'a ni <html> ni <body> : le navigateur crée <head> et <body> autour de son contenu.
const fragment = await readFile(atelier, "utf8");
const html = `<!doctype html>
<html lang="fr">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${fragment}</html>
`;
await writeFile(path.join(outDir, "index.html"), html);
await writeFile(path.join(outDir, ".nojekyll"), "");

console.log(`site : ${path.relative(ROOT, outDir)}/ — index.html (Atelier, ${(Buffer.byteLength(html) / 1024).toFixed(0)} Ko)${(await exists(siteDir)) ? " + site/" : ""}`);
