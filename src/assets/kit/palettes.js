// Matières communes : une rampe de couleurs par matière, de l'ombre vers la lumière (ombres froides, lumières
// chaudes), plus une couleur d'encre pour les joints et les marques. Un asset en « granit » utilise cette rampe :
// le granit est le même partout. Ajouter une matière ici la première fois qu'un asset en a besoin, puis la
// réutiliser ; les clés sont les valeurs des paramètres `stone` et `wood` (kit/variation.js).

/** Pierres. */
export const STONES = {
  granite: { label: "Granit", ramp: ["#4a4658", "#6f6c7c", "#9a98a3", "#c9c7c8"], ink: "#2b2836" },
  sandstone: { label: "Grès", ramp: ["#6b4438", "#9a6a48", "#c59760", "#e8c88a"], ink: "#43272a" },
  limestone: { label: "Calcaire", ramp: ["#746a6e", "#a59a8f", "#d3c8b0", "#f1e8cf"], ink: "#4a4148" },
  basalt: { label: "Basalte", ramp: ["#23222f", "#383846", "#55566a", "#7b7e90"], ink: "#15141d" },
  slate: { label: "Ardoise", ramp: ["#2c3a48", "#44586a", "#66808f", "#96adb5"], ink: "#1a232e" },
  // Le Complexe (docs/complexe/README.md) : basalte noir-bleu des murs et des sols, pierre fumée des voûtes et piliers.
  blackBasalt: { label: "Basalte noir-bleu", ramp: ["#13161d", "#1e2228", "#2f353e", "#4c5560"], ink: "#0a0c11" },
  smoked: { label: "Pierre fumée", ramp: ["#211d1b", "#3a3631", "#575049", "#7d7467"], ink: "#13100f" },
};

/** Bois (planches, poutres, meubles). */
export const WOODS = {
  oak: { label: "Chêne", ramp: ["#4a2c2a", "#75492f", "#a26b3c", "#cd9552"], ink: "#2c181b" },
  pine: { label: "Pin", ramp: ["#6b4630", "#a0713f", "#cf9f58", "#efc98a"], ink: "#43291f" },
  walnut: { label: "Noyer", ramp: ["#2e1c22", "#4a2d2a", "#6d4433", "#946144"], ink: "#1b1015" },
  birch: { label: "Bouleau", ramp: ["#8a6f5e", "#b89a7a", "#dcc49c", "#f3e6c4"], ink: "#5a4439" },
  blackenedOak: { label: "Chêne noirci", ramp: ["#1c1312", "#2e1f1a", "#463024", "#664633"], ink: "#100a0a" },
};

/** Métaux (garnitures, mécanismes d'une technologie ancienne). */
export const METALS = {
  bronze: { label: "Bronze", ramp: ["#3a2622", "#6b4527", "#a5702f", "#dcae58"], ink: "#22140f" },
  gold: { label: "Or", ramp: ["#5a3418", "#9a6320", "#d39a2c", "#f6d878"], ink: "#341c0e" },
  iron: { label: "Fer", ramp: ["#262833", "#40434f", "#666a74", "#9a9ca2"], ink: "#16171e" },
  // Le Complexe : métaux vieillis. Le bronze patiné verdit dans l'ombre (vert-de-gris) ; le dernier ton des rampes
  // à 5 couleurs est l'arête polie ou le reflet d'un pixel (seuil haut dans `steps`).
  patinatedBronze: { label: "Bronze patiné", ramp: ["#263732", "#4a7366", "#8a6a3b", "#b48a4c", "#e2c47e"], ink: "#16130f" },
  blackenedBrass: { label: "Laiton noirci", ramp: ["#221b11", "#3b2f1a", "#5e4a26", "#857036", "#d6c27c"], ink: "#120e08" },
  oxidizedCopper: { label: "Cuivre oxydé", ramp: ["#1c3532", "#2c5a51", "#3f7f6e", "#68a58b", "#c98b6b"], ink: "#0f1d1c" },
  castIron: { label: "Fonte", ramp: ["#16171c", "#25272e", "#3a3d45", "#5c6069"], ink: "#0b0c0f" },
  // Cuivre resté vif (bandes gravées des rouleaux, fils neufs) : rose-orangé, ombre brun-violet.
  copper: { label: "Cuivre", ramp: ["#3a1f22", "#6e3a2c", "#a85f3c", "#d8935c", "#f4c79a"], ink: "#1f1013" },
};

/**
 * Verres (le Complexe) : ampoules éteintes, cuves, hublots, cristaux. Rampe claire et froide ; ce qui luit prend
 * plutôt une rampe de GLOWS.
 */
export const GLASSES = {
  amber: { label: "Verre ambre", ramp: ["#4a2410", "#8a4a1c", "#c97a2e", "#f2b764"], ink: "#2a1408" },
  cyan: { label: "Verre cyan", ramp: ["#0e2f38", "#1d6672", "#3fa9b8", "#a6e6ee"], ink: "#071a20" },
  smoky: { label: "Verre fumé", ramp: ["#1a2026", "#2b363e", "#4a5a64", "#8fa3ac"], ink: "#0d1115" },
  // Verre clair un peu jauni par l'âge : lentilles des loupes, caissons des vitrines.
  clear: { label: "Verre clair jauni", ramp: ["#4f5650", "#7f8a78", "#b9bd98", "#ece6c4"], ink: "#262a26" },
};

/** Cuirs et tissus (le Complexe) : gaines de câbles, sangles, courroies, panneaux et rideaux des chambres noires. */
export const FABRICS = {
  tarredLeather: { label: "Cuir goudronné", ramp: ["#17110c", "#2b2118", "#43342a", "#5f4b3c"], ink: "#0c0806" },
  felt: { label: "Feutre noir", ramp: ["#0e0d11", "#16141a", "#1f1c24", "#2a2630"], ink: "#08070a" },
};

/**
 * Lueurs (le Complexe) : couleurs des matières qui émettent leur propre lumière, de l'éteint (0) au plus vif (3).
 * Ambre : filaments (≈ 2000 K) et glyphes de la pierre, l'éclairage ancien et humain. Cyan : artefacts et zones
 * d'énergie, là où l'œil doit aller. Rouge : alerte, rare. `light` : couleur des lumières de halo qu'elles portent.
 */
export const GLOWS = {
  amber: { label: "Ambre", ramp: ["#5a2a12", "#b8581c", "#ff9a3c", "#ffd796"], light: "#ff9a3c" },
  cyan: { label: "Cyan", ramp: ["#12505e", "#2a9bb0", "#5fd4e6", "#d6fbff"], light: "#5fd4e6" },
  alarm: { label: "Rouge d'alerte", ramp: ["#3a0d0c", "#6e1815", "#a3261f", "#e0574a"], light: "#c8302a" },
};

/**
 * Tranches des cassettes de données (le Complexe, ARC-03) : quatre couleurs de classement. Ambre, cyan et rouge
 * reprennent les lueurs du Complexe ; le vert ne sert qu'aux cassettes (il n'est pas une lueur des murs ni des lampes).
 */
export const DATA_GLOWS = {
  amber: GLOWS.amber,
  cyan: GLOWS.cyan,
  green: { label: "Vert", ramp: ["#123f22", "#2a8a45", "#5fd07a", "#c8f7cf"], light: "#5fd07a" },
  red: { label: "Rouge", ramp: GLOWS.alarm.ramp, light: GLOWS.alarm.light },
};

/** Couvertures posées sur une surface (dessus d'un rocher, d'un mur, d'un toit). Clés du paramètre `cover`. */
export const COVERS = {
  moss: { label: "Mousse", ramp: ["#22473c", "#33663e", "#4f8a3f", "#86b44a"], ink: "#142a26" },
  snow: { label: "Neige", ramp: ["#8a97b8", "#b9c3dc", "#e2e8f2", "#fbfbf6"], ink: "#5a6584" },
};

/** Sols (terre remuée autour d'un objet enterré, chemins). */
export const GROUNDS = {
  dirt: { label: "Terre", ramp: ["#3e2a2c", "#5d3f33", "#7f5a3f", "#a07a52"], ink: "#24181b" },
};

/** Neige au sol : fraîche (poudreuse, bleutée à l'ombre) ou tassée (grisée, ternie). */
export const SNOWS = {
  fresh: { label: "Fraîche", ramp: COVERS.snow.ramp, ink: COVERS.snow.ink },
  old: { label: "Tassée", ramp: ["#6b7390", "#959db4", "#bfc4d0", "#dddcd4"], ink: "#454b63" },
};

/** Mousse selon la saison (l'été est la mousse de référence, celle de COVERS). */
export const MOSSES = {
  spring: { label: "Printemps", ramp: ["#285640", "#3f7d40", "#69a645", "#a6cf60"], ink: "#16302a" },
  summer: { label: "Été", ramp: COVERS.moss.ramp, ink: COVERS.moss.ink },
  autumn: { label: "Automne", ramp: ["#45452c", "#68652f", "#93863a", "#bfa854"], ink: "#29281b" },
  winter: { label: "Hiver", ramp: ["#2a3c43", "#3f574f", "#5d775b", "#8ba283"], ink: "#18242a" },
};

GROUNDS.clay = { label: "Argile", ramp: ["#4a2724", "#7a3e2c", "#a65b39", "#c98552"], ink: "#2a1517" };
GROUNDS.mud = { label: "Boue", ramp: ["#2a2026", "#3e2f2f", "#574236", "#735a44"], ink: "#18121a" };

/**
 * Herbe selon la saison (brins, tiges, gazon) : 5 couleurs, du pied à l'ombre jusqu'à la pointe au soleil.
 * `sod` : la motte sous les brins d'une pelouse, plus sombre.
 */
export const GRASSES = {
  spring: {
    label: "Printemps",
    ramp: ["#22504a", "#327a4c", "#55a24c", "#8fca56", "#d3ec86"],
    sod: ["#1e4140", "#2b5d45", "#3f7c47", "#5d9b4b"],
  },
  summer: {
    label: "Été",
    ramp: ["#1b3f40", "#285f43", "#3f8442", "#73ab45", "#bfd862"],
    sod: ["#18363a", "#22503f", "#356c40", "#518a43"],
  },
  autumn: {
    label: "Automne",
    ramp: ["#3c3a2e", "#5e5a32", "#8a7f38", "#b9a34a", "#e3cf82"],
    sod: ["#33322b", "#4a4a30", "#646235", "#827d3e"],
  },
  winter: {
    label: "Hiver",
    ramp: ["#3e4352", "#5d6159", "#857f68", "#ada185", "#dad3b8"],
    sod: ["#363b48", "#4a5050", "#625f56", "#7d7664"],
  },
};

/**
 * Fleurs : rampe des pétales (ombre → lumière) et rampe du cœur. Clés du paramètre `species` des fleurs.
 * `dry` : couleur des têtes fanées (automne, hiver).
 */
export const FLOWERS = {
  daisy: {
    label: "Marguerite",
    petals: ["#9b9cbd", "#d4d6e6", "#f4f3ee", "#fffdf4"],
    heart: ["#c27a1c", "#e6a823", "#f6cf3c", "#ffe676"],
    dry: ["#4f3a2c", "#6e5134", "#8d6b3f", "#ad8a52"],
  },
  poppy: {
    label: "Coquelicot",
    petals: ["#7a1f2e", "#b8282c", "#e2412f", "#ff7b52"],
    heart: ["#16121e", "#231b2b", "#33283a", "#4a3c4a"],
    dry: ["#3f4a3c", "#5a6a4c", "#7b8a5e", "#a1ab7c"],
  },
  cornflower: {
    label: "Bleuet",
    petals: ["#283a8a", "#3557c2", "#4e82e6", "#8ab8ff"],
    heart: ["#2a1f5a", "#3d2a78", "#553a94", "#7454ad"],
    dry: ["#4a4038", "#665746", "#857257", "#a48f6e"],
  },
  buttercup: {
    label: "Bouton d'or",
    petals: ["#b07214", "#e0a41a", "#f8d331", "#fff38a"],
    heart: ["#7d6a1e", "#a08a22", "#c4ac2e", "#e3cc4a"],
    dry: ["#4b4230", "#6a5c3a", "#8a7846", "#a99656"],
  },
  lavender: {
    label: "Lavande",
    petals: ["#3c2f6e", "#5a46a0", "#8068c8", "#b49ae8"],
    heart: ["#3c2f6e", "#5a46a0", "#8068c8", "#b49ae8"],
    dry: ["#4a4252", "#655c68", "#857a80", "#a59a9a"],
  },
};

/**
 * Sols de prairie (grands morceaux de terrain), par saison : 4 couleurs par rampe, ombre → lumière.
 * `grass` : l'herbe de fond ; `lush` : herbe grasse, plus sombre et bleutée (creux humides) ; `dry` : herbe
 * sèche, paille ; `bare` : sol nu (terre en été, neige en hiver) ; `skirt` : la tranche du morceau posé seul ;
 * `flowers` : deux couleurs semées en pixels.
 */
export const MEADOW_GROUNDS = {
  spring: {
    label: "Printemps",
    grass: ["#2a5b43", "#3d7f46", "#5ea44b", "#8dc65a"],
    lush: ["#1f4a40", "#2c6644", "#438746", "#68a94c"],
    dry: ["#4f6a3c", "#6f8a42", "#94ab52", "#bdcb6e"],
    bare: ["#4a3330", "#6a4a39", "#8a6646", "#a98459"],
    flowers: ["#fffbe8", "#f6d43a"],
    flowerDensity: 0.1,
  },
  summer: {
    label: "Été",
    grass: ["#2a5440", "#3b7343", "#559446", "#80b450"],
    lush: ["#1d4540", "#285d42", "#3a7a43", "#5a9a47"],
    dry: ["#59603a", "#7f8040", "#a8a050", "#cdc06c"],
    bare: ["#4a3230", "#6b4a3a", "#8d6847", "#ad895c"],
    flowers: ["#fdf8ea", "#f2c935"],
    flowerDensity: 0.055,
  },
  autumn: {
    label: "Automne",
    grass: ["#3f4a34", "#5c6738", "#7f853f", "#a6a24e"],
    lush: ["#2f4136", "#435a3a", "#5d743d", "#7d9145"],
    dry: ["#5e4a34", "#85683c", "#ad8a48", "#d0ae62"],
    bare: ["#433031", "#62453a", "#835f45", "#a27c57"],
    flowers: ["#d9733a", "#e8b04a"],
    flowerDensity: 0.03,
  },
  winter: {
    label: "Hiver",
    grass: ["#3d4552", "#58605d", "#7b7c6c", "#9e9884"],
    lush: ["#334050", "#4a585c", "#666f68", "#888c7c"],
    dry: ["#4e4a4c", "#6e6557", "#928466", "#b4a57e"],
    bare: ["#8a97b8", "#b9c3dc", "#e2e8f2", "#fbfbf6"],
    flowers: null,
    flowerDensity: 0,
  },
  skirt: ["#3e2a2c", "#5d3f33", "#7f5a3f", "#a07a52"],
};

// Matières de lumière magique (le blob Couveuse, le mannequin magique), de l'ombre du corps au reflet : 8 couleurs
// (celles de 7 sont étirées à 8 par `fitRamp`).
export const MAGIC_PALETTES = {
  ice: { label: "Glace", colors: ["#081026", "#102654", "#1a4a90", "#2c7ccc", "#58b6ee", "#9fe0ff", "#dcf8ff", "#ffffff"] },
  arcane: { label: "Arcane", colors: ["#140a26", "#2b1252", "#481c88", "#6b2cc0", "#9a48ec", "#c684ff", "#ecc8ff", "#ffffff"] },
  ember: { label: "Braise", colors: ["#1f0b10", "#4a1118", "#8c1d1c", "#cc3a1a", "#f2701f", "#ffae35", "#ffe27a", "#fff8d6"] },
  sap: { label: "Sève", colors: ["#08201a", "#0f3f2c", "#17663e", "#24924e", "#3ec466", "#7ee88a", "#c8ffc4", "#ffffff"] },
  dawn: { label: "Aurore", colors: ["#2a1c08", "#5a3e10", "#9a6c18", "#d8a428", "#ffd84a", "#fff09a", "#fffbe6", "#ffffff"] },
  neon: { label: "Néon", colors: ["#1a0516", "#3d0a33", "#701560", "#b0228f", "#f53cd1", "#ff86e6", "#ffd2f6", "#ffffff"] },
  abyss: { label: "Abysse", colors: ["#050308", "#0f0a18", "#1c1230", "#2c1a4a", "#432468", "#5e3290", "#8048b8", "#a970e0"] },
  lagoon: { label: "Lagon", colors: ["#041418", "#08303a", "#0c5260", "#108088", "#18b4b0", "#4ce8d8", "#b4fff0", "#ffffff"] },
  blood: { label: "Sang", colors: ["#14040a", "#3a0a14", "#6a101c", "#a01824", "#d42a30", "#ff5a50", "#ff9a8a"] },
};

/** Rééchantillonne une rampe à n couleurs en gardant ses deux bouts. */
export function fitRamp(colors, n) {
  if (colors.length === n) return colors.slice();
  return Array.from({ length: n }, (_, i) => colors[Math.round((i * (colors.length - 1)) / Math.max(1, n - 1))]);
}
