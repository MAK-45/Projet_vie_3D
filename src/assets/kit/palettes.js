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
