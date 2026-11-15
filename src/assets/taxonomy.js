// Classement des assets. L'identifiant d'un asset est son chemin : `<catégorie>/<sous-catégorie>/<nom>`,
// par exemple `nature/trees/birch` pour `src/assets/nature/trees/birch.js`.
// Un nouvel asset va dans une sous-catégorie existante ; on n'en ajoute une que si aucune ne convient.

export const taxonomy = {
  nature: {
    label: "Nature",
    description: "Végétation, minéraux et terrain des mondes extérieurs.",
    subcategories: {
      trees: { label: "Arbres", description: "Arbres entiers, feuillus et conifères." },
      plants: { label: "Plantes", description: "Buissons, fleurs, herbes, champignons, plantes en pot." },
      rocks: { label: "Roches", description: "Rochers, pierres, falaises." },
      terrain: { label: "Terrain", description: "Sols, îlots, chemins, eau." },
    },
  },
  buildings: {
    label: "Bâtiments",
    description: "Constructions et leurs éléments.",
    subcategories: {
      houses: { label: "Maisons", description: "Bâtiments entiers." },
      structure: { label: "Structure", description: "Murs, toits, portes, fenêtres, escaliers, clôtures." },
    },
  },
  furniture: {
    label: "Mobilier",
    description: "Meubles d'intérieur et d'extérieur.",
    subcategories: {
      seating: { label: "Assises", description: "Chaises, bancs, canapés." },
      tables: { label: "Tables", description: "Tables, bureaux, établis." },
      storage: { label: "Rangements", description: "Étagères, coffres, bibliothèques." },
      beds: { label: "Lits", description: "Lits et couchages." },
      lighting: { label: "Luminaires", description: "Lampes, lanternes, bougies, cheminées." },
    },
  },
  props: {
    label: "Objets",
    description: "Petits objets posés dans le décor ou tenus par la créature.",
    subcategories: {
      books: { label: "Livres", description: "Livres, parchemins, grimoires." },
      tools: { label: "Outils", description: "Outils de construction, de jardin, de cuisine." },
      magic: { label: "Magie", description: "Baguettes, cristaux, chaudrons, portails." },
      decor: { label: "Décoration", description: "Vases, tapis, cadres, pots." },
    },
  },
  creatures: {
    label: "Créatures",
    description: "La créature humanoïde et les animaux d'ambiance.",
    subcategories: {
      humanoid: { label: "Humanoïde", description: "Le personnage principal et ses variantes." },
      critters: { label: "Animaux", description: "Oiseaux, insectes, petits animaux." },
    },
  },
};

/** Étiquettes d'ambiance reconnues pour `meta.biomes`. */
export const biomes = [
  "forest", "meadow", "garden", "village", "desert", "snow", "swamp", "beach", "mountain", "cave", "interior",
];
