// Capture d'écran avec Playwright (Chromium préinstallé dans les sessions cloud), pour vérifier un rendu à l'œil.
// usage : node scripts/capture.cjs <url> <sortie.png> [largeur] [hauteur] [dpr] [attente ms]
// exemple (avec `npm run dev` lancé) :
//   node scripts/capture.cjs "http://127.0.0.1:5173/dev/test.html?season=autumn" /tmp/bouleau.png 412 915 2
const { chromium } = require("playwright");

(async () => {
  const [url, out, width = 900, height = 700, dpr = 1, wait = 2000] = process.argv.slice(2);
  if (!url || !out) {
    console.error("usage : node scripts/capture.cjs <url> <sortie.png> [largeur] [hauteur] [dpr] [attente ms]");
    process.exit(1);
  }
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage({ viewport: { width: +width, height: +height }, deviceScaleFactor: +dpr });
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") console.log(`[${message.type()}]`, message.text());
  });
  page.on("pageerror", (error) => console.log("[erreur]", error.message));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(+wait);
  await page.screenshot({ path: out });
  await browser.close();
})();
