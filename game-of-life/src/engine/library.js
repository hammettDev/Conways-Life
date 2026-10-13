import { WAGER } from './constants.js';
import { FOOTBALL } from './builds/football.js';
import { SOCCER } from './builds/soccer.js';
import { BASKETBALL } from './builds/basketball.js';
import { BASEBALL } from './builds/baseball.js';
import { HOCKEY } from './builds/hockey.js';
import { ARSENAL } from './builds/arsenal.js';
import { RATINGS } from './ratings.js';
import { ROSTER } from './roster.js';
import { reserveUnits } from './builds/helpers.js';
import { UNIT_TILES } from './shapes.js';

// A build is free while its measured win rate (against the free pool) stays
// within this ceiling. Anything stronger must be bought.
export const FREE_MAX = 0.58;
const PRICE_STEP = 5;

// Even-money price that cancels a build's edge: a build that wins 70% of the
// time earns +40% of the wager on average, so it costs 40% of the wager.
export function priceFor(winRate) {
  if (winRate == null || winRate <= FREE_MAX) return 0;
  const edge = (2 * winRate - 1) * WAGER;
  return Math.max(PRICE_STEP, Math.ceil(edge / PRICE_STEP) * PRICE_STEP);
}

// Every free build is topped up to exactly this many tiles.
export const TARGET_TILES = 60;

export const footprintOf = (players) => players.reduce((n, p) => n + UNIT_TILES[p.shape], 0);

const withReserves = (b) => {
  if (b.sport === 'arsenal') return b;
  const reserves = reserveUnits(TARGET_TILES - footprintOf(b.players));
  return reserves.length ? { ...b, players: [...b.players, ...reserves] } : b;
};

export const CANDIDATES = [
  ...FOOTBALL, ...SOCCER, ...BASKETBALL, ...BASEBALL, ...HOCKEY, ...ARSENAL,
].map(withReserves);

// Candidates that made the cut after balance testing (see scripts/cull.mjs).
const chosen = new Set([...ROSTER.free, ...ROSTER.premium, ...ROSTER.arsenal]);
export const BASE_BUILDS = CANDIDATES.filter((b) => chosen.has(b.id));

export const BUILDS = BASE_BUILDS.map((b) => {
  const winRate = RATINGS[b.id] ?? null;
  return { ...b, winRate, cost: priceFor(winRate) };
});

export const FREE_BUILDS = BUILDS.filter((b) => b.cost === 0 && b.sport !== 'arsenal');
export const PAID_BUILDS = BUILDS.filter((b) => b.cost > 0);

export const getBuild = (id) => BUILDS.find((b) => b.id === id);
