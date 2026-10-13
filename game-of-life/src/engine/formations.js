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

// Shapes in (du, dv): du along the depth axis (+ = away from the enemy),
// dv along the lateral axis.
const SHAPES = {
  bar: [[0, -1], [0, 0], [0, 1]], // across the line: a blinker wall
  dart: [[-1, 0], [0, 0], [1, 0]], // pointed at the enemy: flips across the line
  ell: [[0, 0], [1, 0], [0, 1]], // L-tromino: becomes a block
};

const p = (role, depth, lat, shape) => ({ role, depth, lat, shape });

// Seven on the line (5 OL + 2 TE), then four spread across the backfield/wings.
const offenseLine = [-15, -10, -5, 0, 5, 10, 15].map((lat, i) =>
  p(i === 0 || i === 6 ? 'TE' : 'OL', 0, lat, 'bar'));

// Seven on the front (4 DL + 3 rushing LB), then four in the secondary.
const defenseLine = [-15, -10, -5, 0, 5, 10, 15].map((lat, i) =>
  p([0, 2, 4, 6].includes(i) ? 'DL' : 'LB', 0, lat, 'bar'));

export const OFFENSE = [
  {
    id: 'shotgun-spread', name: 'Shotgun Spread',
    players: [...offenseLine, p('QB', 7, 0, 'ell'), p('RB', 7, 5, 'ell'), p('WR', 3, -18, 'dart'), p('WR', 3, 18, 'dart')],
  },
  {
    id: 'i-formation', name: 'I-Formation',
    players: [...offenseLine, p('QB', 3, 0, 'ell'), p('FB', 8, 0, 'ell'), p('RB', 13, 0, 'ell'), p('WR', 3, 18, 'dart')],
  },
  {
    id: 'trips-right', name: 'Trips Right',
    players: [...offenseLine, p('QB', 7, 0, 'ell'), p('WR', 3, 18, 'dart'), p('WR', 8, 12, 'dart'), p('WR', 3, 6, 'dart')],
  },
  {
    id: 'empty-set', name: 'Empty Set',
    players: [...offenseLine, p('WR', 3, -18, 'dart'), p('WR', 8, -12, 'dart'), p('WR', 8, 12, 'dart'), p('WR', 3, 18, 'dart')],
  },
  {
    id: 'bunch', name: 'Bunch Left',
    players: [...offenseLine, p('QB', 7, 0, 'ell'), p('WR', 3, -18, 'dart'), p('WR', 6, -15, 'dart'), p('WR', 3, -12, 'dart')],
  },
];

export const DEFENSE = [
  {
    id: 'cover-2', name: 'Cover 2',
    players: [...defenseLine, p('CB', 3, -18, 'dart'), p('CB', 3, 18, 'dart'), p('S', 12, -8, 'ell'), p('S', 12, 8, 'ell')],
  },
  {
    id: 'cover-3', name: 'Cover 3',
    players: [...defenseLine, p('CB', 4, -18, 'dart'), p('CB', 4, 18, 'dart'), p('S', 12, 0, 'ell'), p('S', 8, 10, 'ell')],
  },
  {
    id: 'blitz', name: 'All-Out Blitz',
    players: [...defenseLine, p('CB', 2, -18, 'dart'), p('CB', 2, 18, 'dart'), p('S', 5, -6, 'ell'), p('S', 5, 6, 'ell')],
  },
  {
    id: 'dime', name: 'Dime Shell',
    players: [...defenseLine, p('CB', 5, -18, 'dart'), p('CB', 5, 18, 'dart'), p('S', 10, -12, 'dart'), p('S', 10, 12, 'dart')],
  },
  {
    id: 'cover-0', name: 'Man Press',
    players: [...defenseLine, p('CB', 1, -18, 'dart'), p('CB', 1, 18, 'dart'), p('S', 7, -4, 'ell'), p('S', 7, 4, 'ell')],
  },
];

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

// Bot setup: random defensive formation, randomly flipped.
export function pickBotSetup(rng) {
  const formation = DEFENSE[Math.floor(rng() * DEFENSE.length)];
  const flip = rng() < 0.5;
  return { formation, flip, cells: placeFormation(formation, RED, { flip }) };
}
