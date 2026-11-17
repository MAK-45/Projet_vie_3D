// Générateur pseudo-aléatoire déterministe : la même graine redonne toujours le même asset.

/**
 * @param {number} seed entier
 */
export function createRng(seed) {
  let state = (Math.floor(seed) ^ 0x9e3779b9) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    /** nombre dans [0, 1[ */
    next,
    /** nombre dans [min, max[ */
    range: (min, max) => min + (max - min) * next(),
    /** entier dans [min, max] */
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    /** vrai avec la probabilité donnée */
    chance: (probability) => next() < probability,
    /** élément au hasard */
    pick: (items) => items[Math.floor(next() * items.length)],
  };
}

/**
 * Bruit de valeur 3D lisse et déterministe (0..1), pour des taches organiques (mousse, neige, terre).
 * @param {number} seed entier
 * @returns {(x: number, y: number, z: number) => number}
 */
export function createNoise3(seed) {
  const salt = Math.imul(Math.floor(seed) + 1, 0x27d4eb2d);
  const hash = (x, y, z) => {
    let h = (Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f) ^ salt) | 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };
  // Sans fonction créée à chaque appel : ce bruit est évalué des centaines de milliers de fois par monde.
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const fx = x - xi, fy = y - yi, fz = z - zi;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const c000 = hash(xi, yi, zi), c100 = hash(xi + 1, yi, zi), c010 = hash(xi, yi + 1, zi), c110 = hash(xi + 1, yi + 1, zi);
    const c001 = hash(xi, yi, zi + 1), c101 = hash(xi + 1, yi, zi + 1), c011 = hash(xi, yi + 1, zi + 1), c111 = hash(xi + 1, yi + 1, zi + 1);
    const a0 = c000 + (c100 - c000) * u, a1 = c010 + (c110 - c010) * u;
    const b0 = c001 + (c101 - c001) * u, b1 = c011 + (c111 - c011) * u;
    const a = a0 + (a1 - a0) * v;
    const b = b0 + (b1 - b0) * v;
    return a + (b - a) * w;
  };
}
