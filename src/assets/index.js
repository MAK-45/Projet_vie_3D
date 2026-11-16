// Registre des assets : la liste de tout ce qui est dessiné. Ajouter ici chaque nouvel asset.
// Chaque module exporte `meta` (fiche : id, catégorie, tags, paramètres...) et `create(params)`.

import * as boulder from "./nature/rocks/boulder.js";
import * as buriedRock from "./nature/rocks/buried-rock.js";
import * as dirtMound from "./nature/terrain/dirt-mound.js";
import * as mossPatch from "./nature/terrain/moss-patch.js";
import * as snowPatch from "./nature/terrain/snow-patch.js";
import * as birch from "./nature/trees/birch.js";
import * as oak from "./nature/trees/oak.js";
import * as linden from "./nature/trees/linden.js";

import * as flowerClump from "./nature/plants/flower-clump.js";
import * as grassTuft from "./nature/plants/grass-tuft.js";
import * as lawn from "./nature/terrain/lawn.js";
import * as meadowGround from "./nature/terrain/meadow-ground.js";
import * as sun from "./nature/sky/sun.js";
import * as moon from "./nature/sky/moon.js";
import * as cloud from "./nature/sky/cloud.js";
import * as star from "./nature/sky/star.js";
import * as couveuseBlob from "./creatures/spirits/couveuse-blob.js";
import * as summerMeadow from "./worlds/islands/summer-meadow.js";

export { taxonomy, biomes } from "./taxonomy.js";

/** @type {Array<{meta: object, create: (params?: object) => import("three").Group}>} */
export const assets = [birch, oak, linden, boulder, buriedRock, snowPatch, mossPatch, dirtMound, grassTuft, lawn, meadowGround, flowerClump, sun, moon, cloud, star, couveuseBlob, summerMeadow];

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
