// Les mondes que l'explorateur sait ouvrir : une fiche par monde (identifiant de l'asset de la catégorie « Mondes »).
// Chaque fiche dit comment fabriquer le monde, ses tailles, ses curseurs de décor, ses réglages par défaut et s'il
// est intérieur (pas de pluie, de vent ni de papillons ; vue en coupe ; fond sombre).

import { createComplexTest, COMPLEX_TEST_SIZES } from "../worlds/complex-test.js";
import { createSummerMeadow, MEADOW_EXTENTS } from "../worlds/summer-meadow.js";

const numberFormat = new Intl.NumberFormat("fr-FR");

export const WORLD_PROFILES = {
  "worlds/islands/summer-meadow": {
    title: "Prairie d'été",
    storageKey: "pv3d-meadow",
    loading: "Génération de la prairie…",
    create: createSummerMeadow,
    sizes: MEADOW_EXTENTS,
    /** Curseurs du décor : nom du réglage, libellé, bornes, pas, unité (« m » : valeur en mètres, sinon « × »). */
    amounts: [
      ["trees", "Arbres", 0, 2, 0.25],
      ["rocks", "Rochers", 0, 2, 0.25],
      ["grass", "Herbe", 0, 2, 0.25],
      ["flowers", "Fleurs", 0, 2, 0.25],
      ["relief", "Relief", 0.6, 3, 0.2, "m"],
    ],
    defaults: { seed: 1, size: "medium", relief: 1.8, trees: 1, rocks: 1, grass: 1, flowers: 1 },
    interior: false,
    describe(world, settings) {
      if (world.endless) {
        return {
          summary: `graine ${settings.seed} · infinie`,
          note: "Prairie sans bord : elle se fabrique au fil de la marche, et redonne le même pré quand on revient sur ses pas.",
        };
      }
      const c = world.counts;
      return {
        summary: `graine ${settings.seed} · ${world.meters} m`,
        note:
          `${world.meters} × ${world.meters} m · ${c.trees} arbres · ${c.rocks} rochers · ${numberFormat.format(c.tufts)} touffes d'herbe · ` +
          `${numberFormat.format(c.flowers)} massifs de fleurs · ${c.lawns} pelouses.`,
      };
    },
  },
  "worlds/interiors/complex-test": {
    title: "Complexe (essai)",
    storageKey: "pv3d-complex-test",
    loading: "Assemblage du Complexe…",
    create: createComplexTest,
    sizes: COMPLEX_TEST_SIZES,
    amounts: [
      ["furniture", "Mobilier", 0, 2, 0.5],
      ["lamps", "Lampes", 0, 2, 0.5],
    ],
    defaults: { seed: 1, size: "full", furniture: 1, lamps: 1, moment: "dusk" },
    interior: true,
    describe(world, settings) {
      const c = world.counts;
      return {
        summary: `graine ${settings.seed} · ${c.rooms} pièces`,
        note:
          `${c.rooms} pièces · ${c.slabs} dalles · ${c.walls} modules de mur · ${c.doors} portes · ${c.furniture} meubles et machines · ` +
          `${c.lamps} lampes. Les murs entre le personnage et la caméra s'abaissent ; les portes s'ouvrent à son approche.`,
      };
    },
  },
};

export const DEFAULT_WORLD = "worlds/islands/summer-meadow";
