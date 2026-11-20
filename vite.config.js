import { defineConfig } from "vite";
import { buildCatalog, toScriptJson } from "./scripts/catalog-lib.mjs";

// Injecte le catalogue des assets dans index.html (balise <script type="application/json" id="pv3d-catalog">),
// reconstruit à chaque chargement de page en dev.
function catalogPlugin() {
  return {
    name: "pv3d-catalog",
    async transformIndexHtml(html) {
      if (!html.includes("<!--pv3d-catalog-->")) return html;
      const catalog = await buildCatalog({ withSources: true });
      return html.replace(
        "<!--pv3d-catalog-->",
        `<script type="application/json" id="pv3d-catalog">${toScriptJson(catalog)}</script>`,
      );
    },
  };
}

export default defineConfig({
  plugins: [catalogPlugin()],
  server: { host: "127.0.0.1", port: 5173 },
});
