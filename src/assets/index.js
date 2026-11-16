// Registre des assets : la liste de tout ce qui est dessiné. Ajouter ici chaque nouvel asset.
// Chaque module exporte `meta` (fiche : id, catégorie, tags, paramètres...) et `create(params)`.

import * as boulder from "./nature/rocks/boulder.js";
import * as buriedRock from "./nature/rocks/buried-rock.js";
import * as dirtMound from "./nature/terrain/dirt-mound.js";
import * as mossPatch from "./nature/terrain/moss-patch.js";
import * as snowPatch from "./nature/terrain/snow-patch.js";
import * as birch from "./nature/trees/birch.js";

export { taxonomy, biomes } from "./taxonomy.js";

/** @type {Array<{meta: object, create: (params?: object) => import("three").Group}>} */
export const assets = [birch, boulder, buriedRock, snowPatch, mossPatch, dirtMound];

/** Retrouve un asset par son identifiant (`nature/trees/birch`). */
export function getAsset(id) {
  return assets.find((asset) => asset.meta.id === id);
}

/**
 * Cherche des assets par catégorie, sous-catégorie, biome ou mots (nom, description, tags).
 * @param {{category?: string, subcategory?: string, biome?: string, text?: string}} [query]
 */
export function findAssets({ category, subcategory, biome, text } = {}) {
  const words = (text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return assets.filter(({ meta }) => {
    if (category && meta.category !== category) return false;
    if (subcategory && meta.subcategory !== subcategory) return false;
    if (biome && !meta.biomes?.includes(biome)) return false;
    const haystack = [meta.id, meta.name, meta.nameEn, meta.description, ...meta.tags].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
