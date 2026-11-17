// Module de voûte à caissons du Complexe (fiche SAS-04, docs/complexe/PIECES.md ; aussi le plafond de la salle de
// l'Arbre) : une dalle de pierre fumée de 2 × 2 m creusée de 4 caissons de 0,4 m à ressaut, un plot de bronze au
// fond de chacun, et au croisement des nervures un crochet de bronze pour suspendre une lampe. C'est le relief qui
// fait l'ombre ; la suie noircit le fond des caissons.
//
// Posée au plafond, elle est masquée par la vue en coupe et se voit en plan cadré depuis l'intérieur. Réglage
// `display` : « au plafond » (caissons vers le bas, origine sous les nervures) ou « retournée » pour la regarder
// dans l'Atelier (caissons vers le haut, posée au sol).
//
// 2 draw calls : pierre (tons par sommet), bronze.

import * as THREE from "three";
import { buildBlock, buildLathe } from "../../kit/geometry.js";
import { METALS, STONES } from "../../kit/palettes.js";
import { PX, mergeToned, metalMaterial, ring, stoneMaterial, withTone } from "../../kit/complex-parts.js";
import { resolveParams } from "../../kit/params.js";
import { createRng } from "../../kit/rng.js";
import { choiceParam, seedParam, stoneParam, variantsOf } from "../../kit/variation.js";

export { disposeObject as dispose, setWind, tick } from "../../../engine/toon-material.js";

const SIZE = 2;
const HEIGHT = 0.6;
const DEPTH = 0.4; // profondeur des caissons
const DISPLAYS = { inspect: "Retournée (pour la regarder)", ceiling: "Au plafond" };
const HOOKS = { hook: "Avec crochet de lampe", none: "Sans crochet" };

const params = {
  seed: seedParam("Change les tons de chaque caisson, les plots manquants ou décalés, les écaillures des nervures."),
  display: choiceParam("Pose", DISPLAYS, "Au plafond (caissons vers le bas, origine sous les nervures) ou retournée au sol, pour la regarder."),
  hook: choiceParam("Crochet", HOOKS, "Un crochet de bronze au croisement des nervures, où pend une lampe à filament."),
  stone: stoneParam("Pierre de la voûte.", { only: ["smoked", "blackBasalt"] }),
};

export const meta = {
  id: "buildings/structure/coffered-vault",
  name: "Voûte à caissons",
  nameEn: "Coffered vault",
  category: "buildings",
  subcategory: "structure",
  description:
    "Module de plafond du Complexe de 2 × 2 m : quatre caissons de 0,4 m à ressaut, un plot de bronze au fond de " +
    "chacun, un crochet de lampe au croisement des nervures ; suie au fond des caissons. Au plafond ou retournée pour " +
    "la regarder. Fiche SAS-04.",
  tags: [
    "voûte", "plafond", "caissons", "nervures", "crochet", "bronze", "pierre fumée", "le complexe", "complexe",
    "ancien-tech", "modulaire", "grille de 2 m", "intérieur",
    "vault", "ceiling", "coffers", "coffered ceiling", "ribs", "lamp hook", "smoked stone", "ancient complex", "ancient-tech",
    "modular", "2 m grid", "indoor", "procedural",
  ],
  biomes: ["interior"],
  version: 1,
  added: "2026-11-17",
  units:
    "1 unité = 1 mètre ; au plafond : origine sous les nervures, au centre, le module monte de 0,6 m (le monde le " +
    "pose à la hauteur du plafond) ; retournée : origine au sol",
  footprint: { radius: 1.42, height: 0.78 },
  animated: [],
  params,
  variants: variantsOf("display", params.display),
};

/**
 * Crée le module de voûte.
 * @param {{seed?: number, display?: string, hook?: string, stone?: string}} [given]
 * @returns {THREE.Group}
 */
export function create(given = {}) {
  const p = resolveParams(meta.params, given);
  const stone = STONES[p.stone];
  const shape = createRng(p.seed * 7919 + 17);
  const half = (SIZE - PX) / 2; // un pixel de joint entre deux modules voisins
  const rib = 0.1; // demi-nervure de bord (deux modules voisins font une nervure de 0,2 m)
  const cell = (SIZE - PX - rib * 4) / 2; // ouverture d'un caisson

  // Construit à l'endroit du plafond : y = 0 sous les nervures, le fond des caissons à y = DEPTH.
  // Suie : plus on monte dans le caisson, plus c'est sombre (vu d'en bas).
  const sootIn = (y) => -0.28 * THREE.MathUtils.smoothstep(y, 0.05, DEPTH);
  const stoneParts = [];
  const add = (g, tone = 0) => stoneParts.push(withTone(g, (x, y) => tone + sootIn(y)));

  add(buildBlock([half * 2, HEIGHT - DEPTH, half * 2], [0, DEPTH + (HEIGHT - DEPTH) / 2, 0]));
  // Nervures : pourtour et croix centrale.
  add(buildBlock([half * 2, DEPTH, rib], [0, DEPTH / 2, -half + rib / 2]));
  add(buildBlock([half * 2, DEPTH, rib], [0, DEPTH / 2, half - rib / 2]));
  add(buildBlock([rib, DEPTH, half * 2 - rib * 2], [-half + rib / 2, DEPTH / 2, 0]));
  add(buildBlock([rib, DEPTH, half * 2 - rib * 2], [half - rib / 2, DEPTH / 2, 0]));
  add(buildBlock([rib * 2, DEPTH, half * 2 - rib * 2], [0, DEPTH / 2, 0]));
  add(buildBlock([cell, DEPTH, rib * 2], [-(rib + cell / 2), DEPTH / 2, 0]));
  add(buildBlock([cell, DEPTH, rib * 2], [rib + cell / 2, DEPTH / 2, 0]));

  const bronzeParts = [];
  const step = 0.07; // ressaut : un cadre de 1 px de large à mi-profondeur
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * (rib + cell / 2), cz = sz * (rib + cell / 2);
      const tone = shape.range(-0.08, 0.06);
      // Ressaut : un cadre intérieur qui réduit le fond du caisson d'un pas tout autour.
      const y0 = DEPTH * 0.55;
      const inner = cell - step * 2;
      add(buildBlock([cell, DEPTH - y0, step], [cx, (y0 + DEPTH) / 2, cz - cell / 2 + step / 2]), tone);
      add(buildBlock([cell, DEPTH - y0, step], [cx, (y0 + DEPTH) / 2, cz + cell / 2 - step / 2]), tone);
      add(buildBlock([step, DEPTH - y0, inner], [cx - cell / 2 + step / 2, (y0 + DEPTH) / 2, cz]), tone);
      add(buildBlock([step, DEPTH - y0, inner], [cx + cell / 2 - step / 2, (y0 + DEPTH) / 2, cz]), tone);
      // Plot de bronze au fond : un dôme qui pend de 0,08 m (parfois tombé, parfois décalé).
      if (shape.chance(0.85)) {
        const ox = shape.chance(0.2) ? shape.range(-0.06, 0.06) : 0;
        const boss = buildLathe([[0, DEPTH - 0.09], [0.05, DEPTH - 0.07], [0.08, DEPTH - 0.02], [0.08, DEPTH], [0, DEPTH]], { segments: 8, facets: true });
        boss.translate(cx + ox, 0, cz);
        bronzeParts.push(boss);
      }
    }
  }
  // Écaillures : éclats plus clairs sur le dessous des nervures.
  for (let i = 0; i < 4; i++) {
    const along = shape.range(-half + 0.15, half - 0.15);
    const onX = shape.chance(0.5);
    const x = onX ? along : shape.pick([-half + rib / 2, 0, half - rib / 2]);
    const z = onX ? shape.pick([-half + rib / 2, 0, half - rib / 2]) : along;
    stoneParts.push(withTone(buildBlock([PX * shape.int(1, 3), PX * 0.6, PX * shape.int(1, 2)], [x, -PX * 0.25, z]), 0.3));
  }

  // Crochet de lampe : platine carrée sous le croisement et anneau vertical.
  if (p.hook === "hook") {
    bronzeParts.push(buildBlock([0.16, PX * 0.8, 0.16], [0, -PX * 0.4, 0]));
    bronzeParts.push(buildBlock([PX, 0.06, PX], [0, -0.03 - PX * 0.8, 0]));
    const loop = ring({ radius: 0.035, height: PX * 0.8, thickness: PX * 0.8, segments: 8 });
    loop.rotateX(Math.PI / 2);
    loop.translate(0, -0.12, 0);
    bronzeParts.push(loop);
  }

  const group = new THREE.Group();
  group.name = meta.name;
  const body = new THREE.Group();
  group.add(body);

  const stoneMesh = new THREE.Mesh(mergeToned(stoneParts), stoneMaterial(stone, { seed: shape.int(0, 96), id: 20, grain: 0.06 }));
  stoneMesh.name = "vault";
  stoneMesh.castShadow = true;
  stoneMesh.receiveShadow = true;
  body.add(stoneMesh);
  const bronze = new THREE.Mesh(mergeToned(bronzeParts), metalMaterial(METALS.patinatedBronze, { id: 21 }));
  bronze.name = "bronze";
  bronze.castShadow = true;
  body.add(bronze);

  if (p.display === "inspect") {
    // Retournée : caissons vers le haut, dessus de la dalle au sol (le crochet dépasse vers le haut).
    body.rotation.x = Math.PI;
    body.position.y = HEIGHT;
  }

  group.userData.asset = { id: meta.id, params: p };
  group.userData.hookPoint = new THREE.Vector3(0, -0.15, 0); // au plafond : où accrocher la chaîne d'une lampe
  return group;
}
