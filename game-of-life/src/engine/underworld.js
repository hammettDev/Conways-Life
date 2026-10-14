import { COLS, ROWS } from './constants.js';

const SIZE = COLS * ROWS;

export const SOUP_DENSITY = 0.12;
export const RESCUE_BELOW = 20;

// Acorn: a tiny methuselah that explodes outward for ~5,000 generations,
// so the Hot Zones stay lively through a whole match without any top-ups.
const ACORN = [[1, 0], [3, 1], [0, 2], [1, 2], [4, 2], [5, 2], [6, 2]];
const ACORN_W = 7;
const ACORN_H = 3;
const CLEAR_RADIUS = 8;

// Sparse random soup on the outskirts with an acorn bloom in the middle.
export function seedUnderworld(rng, soupDensity = SOUP_DENSITY) {
  const g = new Uint8Array(SIZE);
  for (let i = 0; i < SIZE; i++) g[i] = rng() < soupDensity ? 1 : 0;

  const cx = COLS >> 1;
  const cy = ROWS >> 1;
  for (let y = cy - CLEAR_RADIUS; y < cy + CLEAR_RADIUS; y++) {
    for (let x = cx - CLEAR_RADIUS; x < cx + CLEAR_RADIUS; x++) g[y * COLS + x] = 0;
  }
  const ox = cx - (ACORN_W >> 1);
  const oy = cy - (ACORN_H >> 1);
  for (const [x, y] of ACORN) g[(oy + y) * COLS + ox + x] = 1;
  return g;
}

// Safety net only: if the layer is almost empty, scatter fresh soup.
export function rescueUnderworld(hot, rng, soupDensity = SOUP_DENSITY) {
  let live = 0;
  for (let i = 0; i < SIZE; i++) live += hot[i];
  if (live >= RESCUE_BELOW) return false;
  for (let i = 0; i < SIZE; i++) if (rng() < soupDensity) hot[i] = 1;
  return true;
}
