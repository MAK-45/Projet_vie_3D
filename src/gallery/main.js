// Galerie des assets : catalogue rangé par catégorie, fiche d'un asset avec visionneuse 3D, code et métadonnées.
// Le catalogue (fiches + code) est lu dans la balise <script type="application/json" id="pv3d-catalog"> de la
// page : c'est aussi là que les agents IA le trouvent.

import { assets, getAsset, taxonomy } from "../assets/index.js";
import { Explorer } from "../explorer/explorer.js";
import { highlight } from "./highlight.js";
import { Viewer } from "./viewer.js";

const catalog = JSON.parse(document.getElementById("pv3d-catalog").textContent);
const entries = new Map(catalog.assets.map((entry) => [entry.id, entry]));
const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const app = document.getElementById("app");
const cataloguePane = document.getElementById("catalogue");
const sheetPane = document.getElementById("sheet");

const state = {
  assetId: null,
  params: {},
  tab: "code",
  codeMode: "source",
  query: "",
  category: "all",
  view: "iso",
};

let viewer = null;
let explorer = null;
const thumbnails = new Map();

// ---------- petits outils ----------

/** Crée un élément : h("button", { class: "chip", onclick }, "texte", enfant...) */
function h(tag, attributes = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === false || value === null || value === undefined) continue;
    if (name.startsWith("on")) element.addEventListener(name.slice(2), value);
    else if (name === "html") element.innerHTML = value;
    else element.setAttribute(name, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return element;
}

const formatNumber = (value) => new Intl.NumberFormat("fr-FR").format(value);
const formatKb = (bytes) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(bytes / 1024)} Ko`;
const plural = (count, one, many) => `${formatNumber(count)} ${count > 1 ? many : one}`;

function categoryLabel(entry) {
  const category = taxonomy[entry.category];
  return [category?.label ?? entry.category, category?.subcategories[entry.subcategory]?.label ?? entry.subcategory];
}

async function copyText(text, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copié";
  } catch {
    // Presse-papiers refusé : on sélectionne le texte pour une copie manuelle.
    const area = h("textarea", { style: "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0" });
    area.value = text;
    document.body.append(area);
    area.select();
    const done = document.execCommand?.("copy");
    area.remove();
    button.textContent = done ? "Copié" : "Copie refusée par le navigateur";
  }
  setTimeout(() => (button.textContent = original), 1600);
}

// ---------- catalogue ----------

function matches(entry) {
  if (state.category !== "all" && entry.category !== state.category) return false;
  const words = state.query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [entry.id, entry.name, entry.nameEn, entry.description, ...entry.tags, ...categoryLabel(entry)]
    .join(" ")
    .toLowerCase();
  return words.every((word) => haystack.includes(word));
}

function renderCatalogue() {
  const counts = new Map();
  for (const entry of catalog.assets) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);

  const search = h("input", {
    id: "search",
    type: "search",
    placeholder: "bouleau, arbre, forêt…",
    value: state.query,
    autocomplete: "off",
    oninput: (event) => {
      state.query = event.target.value;
      renderGroups();
    },
  });

  const chips = h(
    "div",
    { class: "chips", role: "group", "aria-label": "Catégories" },
    h("button", { class: "chip", type: "button", "data-category": "all", onclick: () => setCategory("all") }, "Tout ", h("span", { class: "n" }, catalog.assets.length)),
    [...counts].map(([id, count]) =>
      h("button", { class: "chip", type: "button", "data-category": id, onclick: () => setCategory(id) }, `${taxonomy[id]?.label ?? id} `, h("span", { class: "n" }, count)),
    ),
  );

  cataloguePane.replaceChildren(
    h("div", { class: "search" }, h("label", { class: "label", for: "search" }, "Chercher un dessin"), search),
    chips,
    h("div", { id: "groups", class: "catalogue" }),
  );
  renderGroups();
}

function setCategory(category) {
  state.category = category;
  renderGroups();
}

function renderGroups() {
  for (const chip of cataloguePane.querySelectorAll("[data-category]")) {
    chip.setAttribute("aria-pressed", String(chip.dataset.category === state.category));
  }
  const groups = new Map();
  for (const entry of catalog.assets.filter(matches)) {
    const key = `${entry.category}/${entry.subcategory}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  const container = document.getElementById("groups");
  if (groups.size === 0) {
    container.replaceChildren(h("p", { class: "empty" }, "Aucun dessin ne correspond à cette recherche."));
    return;
  }
  container.replaceChildren(
    ...[...groups.values()].map((group) => {
      const [category, subcategory] = categoryLabel(group[0]);
      return h(
        "section",
        { class: "group" },
        h("h2", {}, category, h("span", {}, `${subcategory} · ${group.length}`)),
        h("div", { class: "cards" }, group.map(renderCard)),
      );
    }),
  );
}

function renderCard(entry) {
  const image = h("img", { class: "thumb", alt: "", width: 144, height: 168, "data-thumb": entry.id });
  if (thumbnails.has(entry.id)) image.src = thumbnails.get(entry.id);
  return h(
    "a",
    { class: "card", href: `#${entry.slug}`, "aria-current": entry.id === state.assetId ? "true" : null },
    image,
    h("span", { class: "card-text" }, h("span", { class: "card-name" }, entry.name), h("span", { class: "card-tags" }, entry.tags.slice(0, 3).join(" · "))),
  );
}

/** Vignettes : chaque asset est rendu une fois par une visionneuse hors écran, en pixel art. */
function renderThumbnails() {
  const pending = catalog.assets.filter((entry) => !thumbnails.has(entry.id));
  if (pending.length === 0) return;
  const thumbViewer = new Viewer(document.createElement("div"), { interactive: false });
  thumbViewer.setOption("pixelSize", 1);
  thumbViewer.resize(144, 168, 1);
  for (const entry of pending) {
    thumbViewer.setAsset(getAsset(entry.id), {});
    thumbViewer.resetView();
    thumbViewer.renderOnce(0);
    thumbnails.set(entry.id, thumbViewer.canvas.toDataURL("image/png"));
  }
  thumbViewer.dispose();
  for (const image of document.querySelectorAll("[data-thumb]")) {
    image.src = thumbnails.get(image.dataset.thumb) ?? "";
  }
}

// ---------- fiche ----------

function renderSheet() {
  const entry = entries.get(state.assetId);
  const [category, subcategory] = categoryLabel(entry);
  explorer?.dispose();
  explorer = null;
  if (entry.experience === "explorer") {
    renderWorldSheet(entry, category, subcategory);
    return;
  }

  const viewerBox = h("div", { class: "viewer", id: "viewer" });
  const stats = h("span", { class: "stats", id: "stats" }, "…");

  const viewButtons = [
    ["iso", "Iso"],
    ["front", "Face"],
    ["side", "Côté"],
    ["top", "Dessus"],
  ].map(([id, label]) =>
    h("button", { class: "chip", type: "button", "data-view": id, "aria-pressed": String(state.view === id), onclick: () => setView(id) }, label),
  );
  const rotateButton = h(
    "button",
    { class: "chip", type: "button", id: "toggle-autoRotate", "aria-pressed": "false", onclick: () => toggleOption("autoRotate") },
    "Rotation auto",
  );

  sheetPane.replaceChildren(
    h("nav", { class: "crumbs", "aria-label": "Fil d'Ariane" }, h("a", { class: "back", href: "#catalogue" }, "‹ Catalogue"), h("span", {}, `${category} › ${subcategory}`)),
    h("header", { class: "sheet-head" }, h("h1", {}, entry.name), h("p", { class: "lede" }, entry.description)),
    h(
      "div",
      { class: "sheet-body" },
      h(
        "div",
        { class: "stage" },
        viewerBox,
        h("div", { class: "stage-bar" }, h("div", { class: "seg", role: "group", "aria-label": "Point de vue" }, viewButtons), h("div", { class: "seg" }, rotateButton)),
        h("div", { class: "stage-foot" }, stats, h("span", { id: "scene-stats" }), h("span", {}, "Glisser : tourner · pincer ou molette : zoomer · deux doigts ou clic droit : déplacer")),
      ),
      h("div", { class: "side" }, renderShapesPanel(entry), h("section", { class: "tabs", id: "tabs" })),
    ),
  );

  viewer?.dispose();
  viewer = new Viewer(viewerBox);
  if (reducedMotion) viewer.setOption("wind", false);
  viewer.onOptionChange = syncToggles;
  viewer.onStats = (() => {
    let last = "";
    return (s) => {
      const own = viewer.assetStats;
      const text = `${formatNumber(own.triangles)} triangles · ${own.drawCalls} draw calls · image ${s.width}×${s.height} px`;
      if (text !== last) {
        stats.textContent = last = text;
        document.getElementById("scene-stats").textContent = `Scène entière, socle et ombres compris : ${formatNumber(s.triangles)} triangles, ${s.calls} draw calls`;
      }
    };
  })();
  viewer.resize();
  viewer.setAsset(getAsset(entry.id), state.params);
  viewer.start();
  syncToggles();
  renderTabs();
}

/**
 * Fiche d'un monde : à la place de la visionneuse, l'explorateur. On y règle le monde (graine, taille, abondance
 * de chaque élément, heure, météo) et on s'y promène, dans la fiche ou en plein écran.
 */
function renderWorldSheet(entry, category, subcategory) {
  viewer?.dispose();
  viewer = null;
  const box = h("div", { class: "world-stage" });
  sheetPane.replaceChildren(
    h("nav", { class: "crumbs", "aria-label": "Fil d'Ariane" }, h("a", { class: "back", href: "#catalogue" }, "‹ Catalogue"), h("span", {}, `${category} › ${subcategory}`)),
    h("header", { class: "sheet-head" }, h("h1", {}, entry.name), h("p", { class: "lede" }, entry.description)),
    h(
      "div",
      { class: "stage world" },
      box,
      h(
        "div",
        { class: "stage-foot" },
        h("span", {}, "Réglez le monde dans le panneau, puis « Plein écran » pour vous y promener ; « Masquer l'interface » pour ne garder que le paysage."),
      ),
    ),
    h("section", { class: "tabs", id: "tabs" }),
  );
  explorer = new Explorer(box);
  renderTabs();
}

function setView(id) {
  state.view = id;
  viewer.resetView(id);
  for (const button of sheetPane.querySelectorAll("[data-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.view === id));
  }
}

function toggleOption(name) {
  viewer.setOption(name, !viewer.options[name]);
  syncToggles();
}

function syncToggles() {
  for (const name of Object.keys(viewer.options)) {
    document.getElementById(`toggle-${name}`)?.setAttribute("aria-pressed", String(Boolean(viewer.options[name])));
  }
}

function setParam(name, value) {
  state.params = { ...state.params, [name]: value };
  viewer.setAsset(getAsset(state.assetId), state.params);
  for (const chip of sheetPane.querySelectorAll(`[data-param="${name}"]`)) {
    chip.setAttribute("aria-pressed", String(chip.dataset.value === String(value)));
  }
  const input = document.getElementById(`param-${name}`);
  if (input && input.value !== String(value)) input.value = value;
  const output = document.getElementById(`param-${name}-value`);
  if (output) output.textContent = value;
  if (state.tab === "agents") renderTabs();
}

/** Panneau « Formes » : un contrôle par paramètre de l'asset, puis les options de rendu. */
function renderShapesPanel(entry) {
  const fields = Object.entries(entry.params).map(([name, spec]) => {
    const value = state.params[name] ?? spec.default;
    let control;
    if (spec.type === "enum") {
      control = h(
        "div",
        { class: "chips", role: "group", "aria-label": spec.label },
        spec.values.map((option) =>
          h(
            "button",
            { class: "chip", type: "button", "data-param": name, "data-value": option, "aria-pressed": String(option === value), onclick: () => setParam(name, option) },
            spec.labels?.[option] ?? option,
          ),
        ),
      );
    } else if (spec.type === "int") {
      const input = h("input", {
        id: `param-${name}`,
        type: "number",
        min: spec.min,
        max: spec.max,
        step: 1,
        value,
        onchange: (event) => setParam(name, Math.round(Number(event.target.value) || 0)),
      });
      const step = (delta) => setParam(name, Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, (state.params[name] ?? spec.default) + delta)));
      control = h(
        "div",
        { class: "field-row" },
        h("button", { class: "chip", type: "button", "aria-label": `${spec.label} précédente`, onclick: () => step(-1) }, "−"),
        input,
        h("button", { class: "chip", type: "button", "aria-label": `${spec.label} suivante`, onclick: () => step(1) }, "+"),
        h("button", { class: "chip", type: "button", onclick: () => setParam(name, Math.floor(Math.random() * ((spec.max ?? 9999) + 1))) }, "Au hasard"),
      );
    } else if (spec.type === "number") {
      control = h(
        "div",
        { class: "field-row" },
        h("input", {
          id: `param-${name}`,
          type: "range",
          min: spec.min,
          max: spec.max,
          step: spec.step ?? 0.1,
          value,
          "aria-label": spec.label,
          oninput: (event) => setParam(name, Number(event.target.value)),
        }),
        h("output", { id: `param-${name}-value`, for: `param-${name}` }, value),
        spec.unit ? h("span", { class: "hint" }, spec.unit) : null,
      );
    }
    return h("div", { class: "field" }, h("label", { class: "label", for: spec.type === "enum" ? null : `param-${name}` }, spec.label ?? name), control, h("p", { class: "hint" }, spec.description));
  });

  const toggles = [
    ["pixelArt", "Pixel art"],
    ["outline", "Contours"],
    ["wireframe", "Fil de fer"],
    ["wind", "Vent"],
    ["ground", "Socle"],
  ].map(([name, label]) => h("button", { class: "chip", type: "button", id: `toggle-${name}`, "aria-pressed": "false", onclick: () => toggleOption(name) }, label));

  const pixelSize = h(
    "select",
    { id: "pixel-size", onchange: (event) => viewer.setOption("pixelSize", Number(event.target.value)) },
    h("option", { value: 0 }, "Automatique"),
    [2, 3, 4, 5, 6, 8].map((size) => h("option", { value: size }, `× ${size}`)),
  );

  return h(
    "section",
    { class: "panel", "aria-label": "Formes et rendu" },
    h("h2", {}, "Formes"),
    fields,
    h("hr", { class: "rule" }),
    h("h2", {}, "Rendu"),
    h("div", { class: "chips", role: "group", "aria-label": "Options de rendu" }, toggles),
    h("p", { class: "hint" }, "Désactiver « Pixel art » montre le modèle 3D brut, en pleine résolution."),
    h("div", { class: "field" }, h("label", { class: "label", for: "pixel-size" }, "Taille des pixels"), h("div", { class: "field-row" }, pixelSize)),
  );
}

// ---------- onglets ----------

const TABS = [
  ["code", "Code"],
  ["facts", "Fiche"],
  ["agents", "Pour les IA"],
];

function renderTabs() {
  const entry = entries.get(state.assetId);
  const panels = { code: renderCodeTab, facts: renderFactsTab, agents: renderAgentsTab };
  document.getElementById("tabs").replaceChildren(
    h(
      "div",
      { class: "tablist", role: "tablist" },
      TABS.map(([id, label]) =>
        h(
          "button",
          {
            class: "tab",
            type: "button",
            role: "tab",
            id: `tab-${id}`,
            "aria-selected": String(state.tab === id),
            onclick: () => {
              state.tab = id;
              renderTabs();
            },
          },
          label,
        ),
      ),
    ),
    h("div", { class: "tabpanel", role: "tabpanel", "aria-labelledby": `tab-${state.tab}` }, panels[state.tab](entry)),
  );
}

function codeBlock(code, short = false) {
  return h("pre", { class: short ? "code short" : "code", tabindex: 0 }, h("code", { html: highlight(code) }));
}

function renderCodeTab(entry) {
  const standalone = state.codeMode === "standalone";
  const code = standalone ? entry.standalone : entry.source;
  const mode = (id, label) =>
    h(
      "button",
      {
        class: "chip",
        type: "button",
        "aria-pressed": String(state.codeMode === id),
        onclick: () => {
          state.codeMode = id;
          renderTabs();
        },
      },
      label,
    );
  return [
    h(
      "div",
      { class: "toolbar" },
      h("div", { class: "seg", role: "group", "aria-label": "Version du code" }, mode("source", "Source"), mode("standalone", "Module autonome")),
      h("button", { class: "btn", type: "button", onclick: (event) => copyText(code, event.currentTarget) }, "Copier le code"),
    ),
    standalone
      ? h("p", { class: "hint" }, `Un seul fichier, dépendances incluses (${formatKb(entry.bytes.standalone)}) : il ne reste que `, h("code", { class: "inline" }, 'import "three"'), ` à fournir (three ${catalog.three}).`)
      : h("p", { class: "hint" }, h("span", { class: "path" }, entry.path), ` · ${formatKb(entry.bytes.source)} · importe `, entry.dependencies.map((path, index) => [index ? ", " : "", h("span", { class: "path" }, path.replace("src/", ""))])),
    codeBlock(code),
  ];
}

function renderFactsTab(entry) {
  const [category, subcategory] = categoryLabel(entry);
  const tag = (text) =>
    h(
      "button",
      {
        class: "tag",
        type: "button",
        title: `Chercher « ${text} » dans le catalogue`,
        onclick: () => {
          state.query = text;
          state.category = "all";
          renderCatalogue();
          location.hash = "catalogue";
        },
      },
      text,
    );

  const paramRows = Object.entries(entry.params).map(([name, spec]) =>
    h(
      "tr",
      {},
      h("td", {}, h("code", { class: "inline" }, name)),
      h("td", {}, spec.type),
      h("td", {}, String(spec.default)),
      h("td", {}, spec.type === "enum" ? spec.values.join(", ") : `${spec.min} – ${spec.max}${spec.unit ? ` ${spec.unit}` : ""}`),
      h("td", {}, spec.description),
    ),
  );

  const variantName = (id) => (id === "default" ? "Par défaut" : (entry.variants.find((variant) => variant.id === id)?.name ?? id));
  const statRows = Object.entries(entry.stats)
    .filter(([id]) => id !== "default" || !entry.variants?.length)
    .map(([id, s]) => h("tr", {}, h("td", {}, variantName(id)), h("td", { class: "num" }, formatNumber(s.triangles)), h("td", { class: "num" }, formatNumber(s.vertices)), h("td", { class: "num" }, s.drawCalls)));

  return [
    h(
      "dl",
      { class: "facts" },
      h("dt", {}, "Identifiant"),
      h("dd", {}, h("code", { class: "inline" }, entry.id)),
      h("dt", {}, "Catégorie"),
      h("dd", {}, `${category} › ${subcategory}`),
      h("dt", {}, "Nom anglais"),
      h("dd", {}, entry.nameEn),
      h("dt", {}, "Tags"),
      h("dd", {}, h("div", { class: "tags" }, entry.tags.map(tag))),
      h("dt", {}, "Biomes"),
      h("dd", {}, h("div", { class: "tags" }, entry.biomes.map(tag))),
      h("dt", {}, "Emprise"),
      h("dd", {}, `rayon ${entry.footprint.radius} m · hauteur ${entry.footprint.height} m`),
      h("dt", {}, "Animation"),
      h("dd", {}, entry.animated?.length ? entry.animated.join(", ") : "aucune"),
      h("dt", {}, "Fichier"),
      h("dd", {}, h("span", { class: "path" }, entry.path)),
      h("dt", {}, "Poids"),
      h("dd", {}, `source ${formatKb(entry.bytes.source)} · module autonome ${formatKb(entry.bytes.standalone)} · aucune texture, aucun fichier à charger`),
      h("dt", {}, "Version"),
      h("dd", {}, `${entry.version} · ajouté le ${new Date(entry.added).toLocaleDateString("fr-FR")}`),
    ),
    h("h2", {}, "Paramètres"),
    h("div", { class: "table-wrap" }, h("table", {}, h("thead", {}, h("tr", {}, ["Nom", "Type", "Défaut", "Valeurs", "Effet"].map((label) => h("th", {}, label)))), h("tbody", {}, paramRows))),
    h("h2", {}, "Mesures"),
    h(
      "div",
      { class: "table-wrap" },
      h("table", {}, h("thead", {}, h("tr", {}, h("th", {}, "Forme"), h("th", { class: "num" }, "Triangles"), h("th", { class: "num" }, "Sommets"), h("th", { class: "num" }, "Draw calls"))), h("tbody", {}, statRows)),
    ),
  ];
}

function renderAgentsTab(entry) {
  const given = Object.entries(state.params).filter(([name, value]) => value !== entry.params[name]?.default);
  const args = given.length ? `{ ${given.map(([name, value]) => `${name}: ${JSON.stringify(value)}`).join(", ")} }` : "";
  const usage = `import * as THREE from "three"; // three@${catalog.three}
import { create, tick, dispose } from "./${entry.slug}.js";

const object = create(${args}); // THREE.Group, origine au sol
scene.add(object);

// à chaque image : fait avancer le vent
tick(elapsedSeconds);

// quand l'objet n'est plus utile
scene.remove(object);
dispose(object);`;

  const lookup = `// Dans cette page
const catalog = JSON.parse(document.getElementById("pv3d-catalog").textContent);
const asset = catalog.assets.find((a) => a.id === "${entry.id}");
asset.standalone; // le module autonome, en texte
asset.source;     // le fichier source

// Ou par l'API de la page
PV3D.find({ category: "${entry.category}", text: "${entry.tags[0]}" });
PV3D.getModule("${entry.id}");
PV3D.create("${entry.id}"${args ? `, ${args}` : ""});`;

  const { source: _source, standalone: _standalone, ...card } = entry;

  return [
    h(
      "ol",
      { class: "steps" },
      h("li", {}, h("b", {}, "1"), h("span", {}, "Dans cette page, tout le catalogue (fiches, tags, paramètres et code de chaque asset) est dans la balise ", h("code", { class: "inline" }, '<script type="application/json" id="pv3d-catalog">'), ".")),
      h("li", {}, h("b", {}, "2"), h("span", {}, "Dans le dépôt, lire ", h("code", { class: "inline" }, "public/catalog/catalog.json"), ", puis prendre le module de l'asset : ", h("code", { class: "inline" }, entry.module), ".")),
      h("li", {}, h("b", {}, "3"), h("span", {}, "Dans le code du projet, importer ", h("code", { class: "inline" }, "src/assets/index.js"), " et appeler ", h("code", { class: "inline" }, "findAssets({ category, subcategory, biome, text })"), ".")),
    ),
    h(
      "div",
      { class: "toolbar" },
      h("h2", {}, "Utiliser le module"),
      h("div", { class: "field-row" }, h("button", { class: "btn", type: "button", onclick: (event) => copyText(entry.standalone, event.currentTarget) }, "Copier le module autonome"), h("button", { class: "btn quiet", type: "button", onclick: (event) => copyText(JSON.stringify(card, null, 2), event.currentTarget) }, "Copier la fiche JSON")),
    ),
    codeBlock(usage, true),
    h("p", { class: "hint" }, "Les matériaux attendent une lumière directionnelle dans la scène. Pour le rendu pixel art avec contours, passer par ", h("code", { class: "inline" }, "PixelRenderer"), " et ", h("code", { class: "inline" }, "IsoCamera"), " (", h("span", { class: "path" }, "src/engine/"), ", fournis dans le catalogue sous ", h("code", { class: "inline" }, "engine"), ")."),
    h("div", { class: "toolbar" }, h("h2", {}, "Retrouver un asset"), h("button", { class: "btn quiet", type: "button", onclick: (event) => copyText(JSON.stringify(catalog), event.currentTarget) }, "Copier tout le catalogue JSON")),
    codeBlock(lookup, true),
  ];
}

// ---------- navigation ----------

function latestAsset() {
  return [...catalog.assets].sort((a, b) => (a.added < b.added ? 1 : -1))[0];
}

function route() {
  const slug = decodeURIComponent(location.hash.slice(1));
  const entry = catalog.assets.find((candidate) => candidate.slug === slug);

  if (slug === "catalogue") {
    app.dataset.view = "catalogue";
  } else {
    app.dataset.view = "sheet";
  }

  const target = entry ?? (state.assetId ? entries.get(state.assetId) : latestAsset());
  if (target.id !== state.assetId) {
    state.assetId = target.id;
    state.params = {};
    state.view = "iso";
    renderSheet();
    for (const card of cataloguePane.querySelectorAll(".card")) {
      card.setAttribute("aria-current", String(card.getAttribute("href") === `#${target.slug}`));
    }
  }
  if (entry) window.scrollTo({ top: 0 });
}

// API pour les agents IA et la console.
window.PV3D = {
  catalog,
  /** Fiches de tous les assets. */
  list: () => catalog.assets.map(({ source, standalone, ...card }) => card),
  /** Recherche par catégorie, sous-catégorie, biome et mots (nom, description, tags). */
  find: ({ category, subcategory, biome, text = "" } = {}) => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return catalog.assets
      .filter((entry) => {
        if (category && entry.category !== category) return false;
        if (subcategory && entry.subcategory !== subcategory) return false;
        if (biome && !entry.biomes.includes(biome)) return false;
        const haystack = [entry.id, entry.name, entry.nameEn, entry.description, ...entry.tags].join(" ").toLowerCase();
        return words.every((word) => haystack.includes(word));
      })
      .map(({ source, standalone, ...card }) => card);
  },
  /** Code du module autonome (texte JavaScript, seule dépendance : three). */
  getModule: (id) => entries.get(id)?.standalone,
  /** Code source du fichier de l'asset. */
  getSource: (id) => entries.get(id)?.source,
  /** Crée l'objet three.js de l'asset. */
  create: (id, params) => getAsset(id)?.create(params),
};

document.getElementById("asset-count").textContent =
  `${plural(assets.length, "dessin", "dessins")} · ${plural(new Set(catalog.assets.map((entry) => entry.category)).size, "catégorie", "catégories")} · three ${catalog.three}`;

renderCatalogue();
route();
window.addEventListener("hashchange", route);
setTimeout(renderThumbnails, 50);
