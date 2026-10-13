import { SHAPES } from './shapes.js';
import {
  FIELD_X0, FIELD_X1, FIELD_Y0, FIELD_Y1, BLUE, RED, MAX_DRAFT,
} from './constants.js';

// Football on a Life grid. Every player is a 3-cell unit.
// Blue (offense) lines up on the left half facing right; Red (defense) on the
// right half facing left. The line of scrimmage runs vertically down the
// middle, so "lateral" is the y axis and "depth" is distance behind the line.

export const CENTER_Y = (FIELD_Y0 + FIELD_Y1) >> 1;
export const HALF_X = (FIELD_X0 + FIELD_X1) >> 1; // first column of Red's half
export const LOS_GAP = 3; // columns between the two front lines
export const BLUE_LOS_X = HALF_X - 2;
export const RED_LOS_X = BLUE_LOS_X + LOS_GAP;

// Expand a formation into team cells. `flip` mirrors it top-to-bottom.
export function placeFormation(formation, team, { flip = false } = {}) {
  const sign = team === BLUE ? -1 : 1;
  const losX = team === BLUE ? BLUE_LOS_X : RED_LOS_X;
  const cells = [];
  for (const pl of formation.players) {
    for (const [du, dv] of SHAPES[pl.shape]) {
      const x = losX + sign * (pl.depth + du);
      const y = CENTER_Y + (flip ? -1 : 1) * (pl.lat + dv);
      cells.push({ x, y, team });
    }
  }
  return cells;
}

// Rules for a drafted team: own half only, inside the field, no stacking
// cells on one tile, at most MAX_DRAFT cells.
export function validateDraft(cells, team) {
  if (cells.length > MAX_DRAFT) return { ok: false, reason: `max ${MAX_DRAFT} cells` };
  const xMin = team === BLUE ? FIELD_X0 : HALF_X;
  const xMax = team === BLUE ? HALF_X : FIELD_X1;
  const seen = new Set();
  for (const c of cells) {
    if (c.team !== team) return { ok: false, reason: 'wrong team' };
    if (c.x < xMin || c.x >= xMax || c.y < FIELD_Y0 || c.y >= FIELD_Y1) {
      return { ok: false, reason: 'outside your half' };
    }
    const k = c.y * 1000 + c.x;
    if (seen.has(k)) return { ok: false, reason: 'duplicate tile' };
    seen.add(k);
  }
  return { ok: true };
}

// Bot setup: random build from `pool` (the free builds), randomly flipped.
export function pickBotSetup(rng, pool) {
  const formation = pool[Math.floor(rng() * pool.length)];
  const flip = rng() < 0.5;
  return { formation, flip, cells: placeFormation(formation, RED, { flip }) };
}
