// Ambiance d'un monde : le moment de la journée (jour, crépuscule, nuit, ou le cycle des trois) et le temps qu'il
// fait (beau, pluie, ou variable). Elle ne dessine rien : elle tient à jour une poignée de valeurs (position de
// l'astre, teinte de l'image, couleurs du ciel et de la mer de nuages, pluie, vent) que la page applique au
// rendu, au monde et aux effets. Les changements sont toujours fondus, jamais brusques.

import * as THREE from "three";
import { rgb } from "../../engine/toon-material.js";

const deg = THREE.MathUtils.degToRad;

export const MOMENTS = {
  day: { label: "Jour" },
  dusk: { label: "Crépuscule" },
  night: { label: "Nuit" },
  cycle: { label: "Cycle" },
};
export const WEATHERS = {
  clear: { label: "Beau" },
  rain: { label: "Pluie" },
  variable: { label: "Variable" },
};

// Par moment : astre (azimut, hauteur), teinte de l'image, saturation, ciel (bas, haut), mer de nuages (ombre →
// sommet), part de nuit (lucioles).
const LOOKS = {
  day: {
    sun: [deg(-17), deg(44)], grade: [1, 1, 1], saturation: 1, night: 0,
    sky: ["#dcefe9", "#7fb4e0"], sea: ["#8fa5d6", "#bccbea", "#dde6f5", "#f5f8fc"],
  },
  dusk: {
    sun: [deg(-72), deg(13)], grade: [1.0, 0.8, 0.66], saturation: 0.95, night: 0.25,
    sky: ["#ffc59a", "#7d72b8"], sea: ["#7a5f9a", "#c9829a", "#f6b08c", "#ffe2b8"],
  },
  night: {
    sun: [deg(-108), deg(46)], grade: [0.46, 0.56, 0.9], saturation: 0.8, night: 1,
    sky: ["#27356e", "#0d1230"], sea: ["#141b44", "#24306a", "#3d4c92", "#6f80c4"],
  },
};
const RAIN_LOOK = { grade: [0.7, 0.76, 0.86], saturation: 0.55, sky: ["#8f99a8", "#5c6677"], sea: ["#4f5a70", "#6f7b90", "#939fb0", "#b9c2ce"], sunElevation: deg(76) };
const CYCLE = [["day", 55], ["dusk", 28], ["night", 45], ["dusk", 22]]; // moment, durée (s)

function flatten(look) {
  return [...look.sun, ...look.grade, look.saturation, look.night, ...look.sky.flatMap((hex) => rgb(hex).toArray()), ...look.sea.flatMap((hex) => rgb(hex).toArray())];
}
const TARGETS = Object.fromEntries(Object.entries(LOOKS).map(([name, look]) => [name, flatten(look)]));
const RAIN_SKY = RAIN_LOOK.sky.map(rgb);
const RAIN_SEA = RAIN_LOOK.sea.map(rgb);

export function createAtmosphere() {
  const state = TARGETS.day.slice();
  let moment = "day";
  let weather = "clear";
  let showing = "day"; // moment affiché (suit le cycle)
  let wet = 0;
  let raining = false;
  let cycleIndex = 0;
  let cycleLeft = CYCLE[0][1];
  let weatherLeft = 40;
  let instant = true;

  const values = {
    sunAzimuth: 0,
    sunElevation: 0,
    grade: new THREE.Vector3(1, 1, 1),
    saturation: 1,
    skyBottom: new THREE.Vector3(),
    skyTop: new THREE.Vector3(),
    sea: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()],
    /** 0 en plein jour, 1 en pleine nuit. */
    night: 0,
    /** 0 par beau temps, 1 sous la pluie. */
    rain: 0,
    wind: 1,
  };

  const publish = () => {
    values.sunAzimuth = state[0];
    values.sunElevation = THREE.MathUtils.lerp(state[1], RAIN_LOOK.sunElevation, wet);
    // La pluie assombrit moins la nuit, déjà sombre : le promeneur doit rester visible.
    const gloom = wet * (1 - 0.65 * state[6]);
    values.grade.set(state[2], state[3], state[4]);
    values.grade.x *= THREE.MathUtils.lerp(1, RAIN_LOOK.grade[0], gloom);
    values.grade.y *= THREE.MathUtils.lerp(1, RAIN_LOOK.grade[1], gloom);
    values.grade.z *= THREE.MathUtils.lerp(1, RAIN_LOOK.grade[2], gloom);
    values.saturation = state[5] * THREE.MathUtils.lerp(1, RAIN_LOOK.saturation, wet);
    values.night = state[6];
    // Sous la pluie, ciel et nuages tirent vers le gris, assombri la nuit.
    const dim = THREE.MathUtils.lerp(1, 0.45, state[6]);
    values.skyBottom.fromArray(state, 7).lerp(RAIN_SKY[0], wet * 0.8).multiplyScalar(THREE.MathUtils.lerp(1, dim, wet));
    values.skyTop.fromArray(state, 10).lerp(RAIN_SKY[1], wet * 0.8).multiplyScalar(THREE.MathUtils.lerp(1, dim, wet));
    for (let i = 0; i < 4; i++) {
      values.sea[i].fromArray(state, 13 + i * 3).lerp(RAIN_SEA[i], wet * 0.75).multiplyScalar(THREE.MathUtils.lerp(1, dim, wet));
    }
    values.rain = wet;
    values.wind = 1 + 1.3 * wet;
  };
  publish();

  return {
    values,
    get moment() {
      return moment;
    },
    get weather() {
      return weather;
    },
    /** @param {{moment?: string, weather?: string}} choice clés de MOMENTS et de WEATHERS */
    set(choice) {
      if (choice.moment in MOMENTS && choice.moment !== moment) {
        moment = choice.moment;
        if (moment === "cycle") {
          cycleIndex = Math.max(0, CYCLE.findIndex(([name]) => name === showing));
          cycleLeft = CYCLE[cycleIndex][1];
        } else {
          showing = moment;
        }
      }
      if (choice.weather in WEATHERS && choice.weather !== weather) {
        weather = choice.weather;
        raining = weather === "rain";
        weatherLeft = 35;
      }
    },
    /** @param {number} dt secondes depuis l'image précédente */
    update(dt) {
      if (moment === "cycle") {
        cycleLeft -= dt;
        if (cycleLeft <= 0) {
          cycleIndex = (cycleIndex + 1) % CYCLE.length;
          cycleLeft = CYCLE[cycleIndex][1];
        }
        showing = CYCLE[cycleIndex][0];
      }
      if (weather === "variable") {
        weatherLeft -= dt;
        if (weatherLeft <= 0) {
          raining = !raining;
          weatherLeft = raining ? 30 + Math.random() * 25 : 45 + Math.random() * 45;
        }
      }
      // Fondu : rapide quand on choisit soi-même, lent dans le cycle.
      const ease = instant ? 1 : 1 - Math.exp(-dt / (moment === "cycle" ? 5 : 1.1));
      const target = TARGETS[showing];
      for (let i = 0; i < state.length; i++) state[i] += (target[i] - state[i]) * ease;
      wet += ((raining ? 1 : 0) - wet) * (instant ? 1 : 1 - Math.exp(-dt / 2.5));
      instant = false;
      publish();
    },
  };
}
