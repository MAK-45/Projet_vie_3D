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
