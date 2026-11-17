// Séquence d'un portail en anneau : composition d'une adresse (l'anneau intérieur tourne, chaque verrou s'enclenche
// quand son symbole arrive en face), ouverture du vortex, vortex stable, fermeture, repos. Partagée par la porte
// (`props/magic/star-portal`) et son pupitre (`props/magic/star-portal-dial`) : avec la même graine et le même
// nombre de verrous, les deux suivent exactement la même horloge (le temps partagé du moteur, `tick`), donc le
// pupitre allume ses touches au moment où la porte verrouille.
//
// Tout est tiré de la graine : nombre de symboles de l'anneau, adresse, durée de chaque rotation, sens.

import { createRng } from "./rng.js";

const TAU = Math.PI * 2;

/** Arc couvert par les verrous : tout l'anneau sauf le bas (70°), où il repose sur son socle. */
export const LOCK_ARC = (290 / 180) * Math.PI;

/**
 * Angle (radians, 0 = droite, sens trigonométrique, vu de face) du verrou i parmi n : répartis sur l'arc, du bas à
 * gauche au bas à droite en passant par le haut, dans le sens des aiguilles d'une montre.
 */
export function lockAngle(i, n) {
  return Math.PI / 2 + LOCK_ARC / 2 - (i / (n - 1)) * LOCK_ARC;
}

/** Angle de repos du symbole j parmi `glyphs` sur l'anneau intérieur. */
export function glyphAngle(j, glyphs) {
  return Math.PI / 2 + (j / glyphs) * TAU;
}

/**
 * Prépare la séquence complète d'un portail.
 * @param {number} seed graine de l'adresse (celle de la porte)
 * @param {number} locks nombre de verrous (5 à 9)
 * @returns {{glyphs: number, address: number[], steps: object[], burst: number, open: number, close: number,
 *   end: number, duration: number}}
 */
export function portalSequence(seed, locks) {
  const rng = createRng(seed * 4241 + 913);
  const glyphs = 24 + 2 * rng.int(0, 6); // 24 à 36 symboles
  const address = [];
  while (address.length < locks) {
    const j = rng.int(0, glyphs - 1);
    if (!address.includes(j)) address.push(j);
  }
  const steps = [];
  let t = 1.2; // repos avant la composition
  let angle = 0;
  for (let i = 0; i < locks; i++) {
    const target = lockAngle(i, locks) - glyphAngle(address[i], glyphs);
    // Sens alterné ; au moins un quart de tour pour que la rotation se voie.
    const dir = i % 2 === 0 ? -1 : 1;
    let delta = (((target - angle) * dir) % TAU + TAU) % TAU;
    if (delta < Math.PI / 2) delta += TAU;
    const to = angle + delta * dir;
    const spin = 0.9 + (delta / TAU) * 1.5 + rng.range(0, 0.4);
    steps.push({ start: t, spinEnd: t + spin, lockEnd: t + spin + 0.55, from: angle, to });
    angle = to;
    t += spin + 0.55 + rng.range(0.25, 0.5);
  }
  const burst = t + 0.3;
  const open = burst + 1.5; // le jaillissement dure 1,5 s
  const close = open + 9;
  const end = close + 1;
  return { glyphs, address, steps, burst, open, close, end, duration: end + 2.5 };
}

const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.min(1, Math.max(0, k));

/**
 * État du portail à l'instant t.
 * @param {ReturnType<typeof portalSequence>} seq
 * @param {number} time secondes (temps partagé du moteur)
 * @param {"cycle"|"dormant"|"open"} mode
 * @returns {{ring: number, locked: number[], horizon: "off"|"burst"|"open"|"closing", k: number, t: number}}
 *   ring : angle de l'anneau intérieur ; locked[i] : 0 libre → 1 verrouillé et allumé ; k : avancement de la phase
 *   du vortex (0..1) ; t : temps dans la boucle
 */
export function portalStateAt(seq, time, mode = "cycle") {
  const n = seq.steps.length;
  if (mode === "dormant") return { ring: 0, locked: new Array(n).fill(0), horizon: "off", k: 0, t: 0 };
  if (mode === "open") {
    return { ring: seq.steps[n - 1].to, locked: new Array(n).fill(1), horizon: "open", k: 0.5, t: time };
  }
  const t = ((time % seq.duration) + seq.duration) % seq.duration;
  let ring = 0;
  const locked = [];
  for (const step of seq.steps) {
    if (t >= step.start) ring = step.from + (step.to - step.from) * smooth(clamp01((t - step.start) / (step.spinEnd - step.start)));
    locked.push(t >= seq.end ? 0 : clamp01((t - step.spinEnd) / (step.lockEnd - step.spinEnd)));
  }
  // Après la fermeture, l'anneau revient en place pendant le repos.
  if (t >= seq.end) ring = seq.steps[n - 1].to * (1 - smooth(clamp01((t - seq.end) / 2)));
  let horizon = "off", k = 0;
  if (t >= seq.burst && t < seq.open) (horizon = "burst"), (k = (t - seq.burst) / (seq.open - seq.burst));
  else if (t >= seq.open && t < seq.close) (horizon = "open"), (k = (t - seq.open) / (seq.close - seq.open));
  else if (t >= seq.close && t < seq.end) (horizon = "closing"), (k = (t - seq.close) / (seq.end - seq.close));
  return { ring, locked, horizon, k, t };
}

/**
 * Touches du pupitre pressées pour une adresse : une touche différente par verrou, tirée de la graine, parmi `keys`.
 * @returns {number[]} pour chaque verrou, le numéro de la touche
 */
export function dialKeys(seq, keys) {
  const rng = createRng(seq.address.reduce((s, g) => s * 37 + g, 11));
  const order = Array.from({ length: keys }, (_, i) => i);
  for (let i = keys - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return seq.address.map((_, i) => order[i % keys]);
}
