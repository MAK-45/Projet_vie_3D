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
};

/** Bois (planches, poutres, meubles). */
export const WOODS = {
  oak: { label: "Chêne", ramp: ["#4a2c2a", "#75492f", "#a26b3c", "#cd9552"], ink: "#2c181b" },
  pine: { label: "Pin", ramp: ["#6b4630", "#a0713f", "#cf9f58", "#efc98a"], ink: "#43291f" },
  walnut: { label: "Noyer", ramp: ["#2e1c22", "#4a2d2a", "#6d4433", "#946144"], ink: "#1b1015" },
  birch: { label: "Bouleau", ramp: ["#8a6f5e", "#b89a7a", "#dcc49c", "#f3e6c4"], ink: "#5a4439" },
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
