// `npm run catalog` : écrit public/catalog/catalog.json (fiches de tous les assets) et un module autonome par
// asset dans public/catalog/modules/. Ces fichiers sont versionnés : un agent IA peut les lire directement
// dans le dépôt, sans rien construire.

import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCatalog, ROOT } from "./catalog-lib.mjs";

const catalog = await buildCatalog({ withSources: true });
const outDir = path.join(ROOT, "public/catalog");
await rm(outDir, { recursive: true, force: true });
await mkdir(path.join(outDir, "modules"), { recursive: true });

for (const asset of catalog.assets) {
  await writeFile(path.join(ROOT, asset.module), asset.standalone);
  delete asset.source;
  delete asset.standalone;
}
for (const entry of catalog.engine) delete entry.source;

await writeFile(path.join(outDir, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
console.log(`catalogue : ${catalog.assets.length} asset(s) → public/catalog/`);
for (const asset of catalog.assets) {
  const s = asset.stats.default;
  console.log(`  ${asset.id}  ${s.triangles} triangles, ${s.drawCalls} draw calls, module ${(asset.bytes.standalone / 1024).toFixed(1)} Ko`);
}
