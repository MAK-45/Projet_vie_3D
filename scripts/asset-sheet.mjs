// `npm run sheet -- <id> [sortie.png] [graines]` : planche de contrôle d'un asset en une image — chaque variante
// sur une ligne, plusieurs graines en colonnes, plus les vues de face et de dessus. Lance son propre serveur Vite.
// exemple : npm run sheet -- nature/trees/birch /tmp/bouleau.png 1,2,3

import { createRequire } from "node:module";
import path from "node:path";
import { createServer } from "vite";
import { ROOT, slugOf } from "./catalog-lib.mjs";

const [id, out = path.join(ROOT, "dist-artifact", `planche-${slugOf(process.argv[2] ?? "asset")}.png`), seeds = "1,2,3"] = process.argv.slice(2);
if (!id) {
  console.error("usage : npm run sheet -- <id de l'asset> [sortie.png] [graines, ex. 1,2,3]");
  process.exit(1);
}

const { chromium } = createRequire(import.meta.url)("playwright");
const server = await createServer({ root: ROOT, logLevel: "error", server: { port: 5183, strictPort: false } });
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 1700, height: 900 }, deviceScaleFactor: 1 });
  page.on("console", (message) => {
    if (message.type() === "error") {
      failed = true;
      console.log("[erreur]", message.text().slice(0, 1500));
    }
  });
  page.on("pageerror", (error) => {
    failed = true;
    console.log("[erreur]", error.message);
  });
  await page.goto(`${base}dev/sheet.html?asset=${encodeURIComponent(id)}&seeds=${seeds}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.sheetReady === true, null, { timeout: 60000 });
  await page.screenshot({ path: out, fullPage: true });
  console.log(`planche : ${out}`);
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
