// `npm run check` (tous les assets) ou `npm run check -- nature/trees/birch` : vérifie qu'un asset respecte le
// contrat de docs/ASSETS.md — fiche complète, rangement, graine déterministe, variantes, matériaux, budget,
// emprise. Sort en erreur (code 1) s'il reste un ✗ ; les ⚠ sont à regarder mais ne bloquent pas.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT } from "./catalog-lib.mjs";

const registry = await import(pathToFileURL(path.join(ROOT, "src/assets/index.js")).href);
const only = process.argv[2];
const BUDGET = { triangles: 5000, drawCalls: 3 };

const catalogFile = path.join(ROOT, "public/catalog/catalog.json");
const published = existsSync(catalogFile) ? JSON.parse(readFileSync(catalogFile, "utf8")).assets : [];

function measure(object) {
  const result = { triangles: 0, drawCalls: 0, radius: 0, top: -Infinity, bottom: Infinity, hash: 0, nan: false, materials: new Set() };
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if (!child.isMesh) return;
    const geometry = child.geometry;
    const position = geometry.attributes.position;
    result.drawCalls += 1;
    result.triangles += (geometry.index ? geometry.index.count : position.count) / 3;
    for (const material of [child.material].flat()) result.materials.add(`${material.type}:${material.name}`);
    const e = child.matrixWorld.elements;
    for (let i = 0; i < position.count; i++) {
      const x0 = position.getX(i), y0 = position.getY(i), z0 = position.getZ(i);
      const x = e[0] * x0 + e[4] * y0 + e[8] * z0 + e[12];
      const y = e[1] * x0 + e[5] * y0 + e[9] * z0 + e[13];
      const z = e[2] * x0 + e[6] * y0 + e[10] * z0 + e[14];
      if (!Number.isFinite(x + y + z)) result.nan = true;
      result.radius = Math.max(result.radius, Math.hypot(x, z));
      result.top = Math.max(result.top, y);
      result.bottom = Math.min(result.bottom, y);
      // empreinte de la forme : change dès qu'un sommet bouge
      result.hash = (Math.imul(result.hash, 31) + Math.round(x * 1000) * 7 + Math.round(y * 1000) * 13 + Math.round(z * 1000) * 17) | 0;
    }
  });
  return result;
}

function checkAsset(module) {
  const errors = [];
  const warnings = [];
  const meta = module.meta;
  const error = (text) => errors.push(text);
  const warn = (text) => warnings.push(text);

  // --- Fiche
  for (const field of ["id", "name", "nameEn", "category", "subcategory", "description", "tags", "biomes", "version", "added", "footprint", "params", "animated"]) {
    if (meta[field] === undefined) error(`meta.${field} manque`);
  }
  if (errors.length) return { errors, warnings };

  const file = `src/assets/${meta.id}.js`;
  if (!existsSync(path.join(ROOT, file))) error(`meta.id ne correspond à aucun fichier : ${file}`);
  if (!/^[a-z0-9-]+(\/[a-z0-9-]+){2}$/.test(meta.id)) error("meta.id : <catégorie>/<sous-catégorie>/<nom>, en minuscules et tirets");
  if (!meta.id.startsWith(`${meta.category}/${meta.subcategory}/`)) error("meta.id ne commence pas par catégorie/sous-catégorie");
  const category = registry.taxonomy[meta.category];
  if (!category) error(`catégorie inconnue : ${meta.category} (voir src/assets/taxonomy.js)`);
  else if (!category.subcategories[meta.subcategory]) error(`sous-catégorie inconnue : ${meta.category}/${meta.subcategory}`);
  for (const biome of meta.biomes) if (!registry.biomes.includes(biome)) error(`biome inconnu : ${biome}`);
  if (meta.biomes.length === 0) warn("aucun biome : où cet asset a-t-il sa place ?");

  if (meta.tags.length < 8) warn(`seulement ${meta.tags.length} tags : viser au moins 8, en français et en anglais`);
  if (new Set(meta.tags).size !== meta.tags.length) error("tags en double");
  for (const tag of meta.tags) if (tag !== tag.toLowerCase()) error(`tag pas en minuscules : ${tag}`);
  if (meta.description.length < 40) warn("description trop courte : dire ce qu'on voit et ce qui varie");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.added)) error("meta.added : date AAAA-MM-JJ");

  // --- Paramètres
  if (meta.params.seed?.type !== "int") error("paramètre `seed` (int) obligatoire : utiliser seedParam() de kit/variation.js");
  for (const [name, spec] of Object.entries(meta.params)) {
    if (!spec.label || !spec.description) error(`params.${name} : label et description obligatoires`);
    if (spec.type === "enum") {
      if (!spec.values?.includes(spec.default)) error(`params.${name} : défaut absent des valeurs`);
      for (const value of spec.values ?? []) if (!spec.labels?.[value]) error(`params.${name} : nom affiché manquant pour ${value}`);
    } else if (spec.type === "int" || spec.type === "number") {
      if (spec.min === undefined || spec.max === undefined) error(`params.${name} : min et max obligatoires`);
    } else if (spec.type !== "boolean") {
      error(`params.${name} : type inconnu ${spec.type}`);
    }
  }
  const variants = meta.variants ?? [];
  if (new Set(variants.map((variant) => variant.id)).size !== variants.length) error("variantes : identifiants en double");
  for (const variant of variants) {
    for (const [name, value] of Object.entries(variant.params)) {
      const spec = meta.params[name];
      if (!spec) error(`variante ${variant.id} : paramètre inconnu ${name}`);
      else if (spec.type === "enum" && !spec.values.includes(value)) error(`variante ${variant.id} : ${name}=${value} n'existe pas`);
    }
  }
  const enums = Object.entries(meta.params).filter(([, spec]) => spec.type === "enum");
  if (enums.length && variants.length === 0) warn("paramètre à choix sans variantes : utiliser variantsOf() pour les montrer dans le catalogue");

  // --- Module
  for (const name of ["create", "dispose", "tick", "setWind"]) {
    if (typeof module[name] !== "function") error(`export manquant : ${name}`);
  }
  if (errors.length) return { errors, warnings };

  // --- Formes : défaut, déterminisme, graine, chaque valeur de chaque choix
  let base;
  try {
    const object = module.create({});
    base = measure(object);
    if (object.userData.asset?.id !== meta.id) error("group.userData.asset.id doit valoir meta.id");
    const again = measure(module.create({}));
    if (again.hash !== base.hash) error("non déterministe : deux create() identiques donnent deux formes (Math.random ? Date ?)");
    module.dispose(object);
  } catch (failure) {
    error(`create() échoue : ${failure.message}`);
    return { errors, warnings };
  }
  if (base.drawCalls === 0) error("create() ne contient aucun maillage");

  const seeds = [1, 2, 3, 4, 5].map((seed) => measure(module.create({ seed })));
  const distinct = new Set(seeds.map((shape) => shape.hash)).size;
  if (distinct === 1) error("la graine ne change rien : seed 1 à 5 donnent la même forme");
  else if (distinct < 5) warn(`seulement ${distinct} formes différentes pour 5 graines`);

  const shapes = [base, ...seeds];
  for (const [name, spec] of enums) {
    for (const value of spec.values) {
      try {
        shapes.push(measure(module.create({ [name]: value })));
      } catch (failure) {
        error(`create({ ${name}: "${value}" }) échoue : ${failure.message}`);
      }
    }
  }
  // Les réglages poussés au minimum et au maximum doivent marcher ; le budget et l'emprise, eux, se jugent
  // sur les réglages par défaut.
  const extremes = [];
  for (const [name, spec] of Object.entries(meta.params)) {
    if (spec.type !== "number" && !(spec.type === "int" && name !== "seed")) continue;
    for (const value of [spec.min, spec.max]) {
      try {
        extremes.push(measure(module.create({ [name]: value })));
      } catch (failure) {
        error(`create({ ${name}: ${value} }) échoue : ${failure.message}`);
      }
    }
  }

  if ([...shapes, ...extremes].some((shape) => shape.nan)) error("sommets invalides (NaN ou infini)");
  for (const material of new Set([...shapes, ...extremes].flatMap((shape) => [...shape.materials]))) {
    if (!material.startsWith("ShaderMaterial:Toon")) error(`matériau interdit : ${material} — utiliser createToonMaterial`);
  }

  // --- Budget et emprise
  const triangles = Math.max(...shapes.map((shape) => shape.triangles));
  const drawCalls = Math.max(...shapes.map((shape) => shape.drawCalls));
  if (triangles > BUDGET.triangles * 2) error(`${triangles} triangles : plus du double du budget (${BUDGET.triangles})`);
  else if (triangles > BUDGET.triangles) warn(`${triangles} triangles : au-dessus du budget (${BUDGET.triangles})`);
  if (drawCalls > BUDGET.drawCalls) warn(`${drawCalls} draw calls : viser ${BUDGET.drawCalls} au plus (fusionner par matériau)`);

  const radius = Math.max(...shapes.map((shape) => shape.radius));
  const top = Math.max(...shapes.map((shape) => shape.top));
  const bottom = Math.min(...shapes.map((shape) => shape.bottom));
  const round = (value) => Math.round(value * 10) / 10;
  if (radius > meta.footprint.radius * 1.08) warn(`emprise : l'asset atteint ${round(radius)} m de rayon, footprint.radius = ${meta.footprint.radius}`);
  if (top > meta.footprint.height * 1.08) warn(`emprise : l'asset monte à ${round(top)} m, footprint.height = ${meta.footprint.height}`);
  if (radius < meta.footprint.radius * 0.6) warn(`emprise trop large : rayon réel ${round(radius)} m pour footprint.radius = ${meta.footprint.radius}`);
  if (top < meta.footprint.height * 0.6) warn(`emprise trop haute : hauteur réelle ${round(top)} m pour footprint.height = ${meta.footprint.height}`);
  if (bottom < -0.3) warn(`l'asset descend à ${round(bottom)} m sous le sol : l'origine doit être au niveau du sol`);

  // --- Catalogue publié
  const entry = published.find((candidate) => candidate.id === meta.id);
  if (!entry) warn("absent de public/catalog/ : lancer `npm run artifact`");
  else if (entry.version !== meta.version) warn("public/catalog/ n'est pas à jour : lancer `npm run artifact`");

  const worst = Math.max(triangles, ...extremes.map((shape) => shape.triangles));
  if (worst > BUDGET.triangles * 2) warn(`réglages au maximum : ${worst} triangles — resserrer les bornes des paramètres`);

  const summary =
    `${triangles} triangles (${worst} réglages au maximum), ${drawCalls} draw calls, ` +
    `rayon ${round(radius)} m, hauteur ${round(top)} m, ${distinct}/5 graines distinctes`;
  return { errors, warnings, summary };
}

const modules = registry.assets.filter((module) => !only || module.meta.id === only);
if (modules.length === 0) {
  console.error(`aucun asset « ${only} » dans src/assets/index.js (l'a-t-on ajouté au registre ?)`);
  process.exit(1);
}

let failed = 0;
for (const module of modules) {
  const { errors, warnings, summary } = checkAsset(module);
  console.log(`${errors.length ? "✗" : "✓"} ${module.meta.id ?? "(sans id)"}${summary ? ` — ${summary}` : ""}`);
  for (const text of errors) console.log(`    ✗ ${text}`);
  for (const text of warnings) console.log(`    ⚠ ${text}`);
  if (errors.length) failed += 1;
}
process.exit(failed ? 1 : 0);
