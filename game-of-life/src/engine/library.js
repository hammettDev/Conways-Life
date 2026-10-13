import { WAGER } from './constants.js';
import { FOOTBALL } from './builds/football.js';
import { SOCCER } from './builds/soccer.js';
import { BASKETBALL } from './builds/basketball.js';
import { BASEBALL } from './builds/baseball.js';
import { HOCKEY } from './builds/hockey.js';
import { ARSENAL } from './builds/arsenal.js';
import { RATINGS } from './ratings.js';
import { BENCH } from './bench.js';
import { benchUnits } from './builds/helpers.js';

// A build is free while its measured win rate (against the free pool) stays
// within this ceiling. Anything stronger must be bought.
export const FREE_MAX = 0.55;
const PRICE_STEP = 5;

// Even-money price that cancels a build's edge: a build that wins 70% of the
// time earns +40% of the wager on average, so it costs 40% of the wager.
export function priceFor(winRate) {
  if (winRate == null || winRate <= FREE_MAX) return 0;
  const edge = (2 * winRate - 1) * WAGER;
  return Math.max(PRICE_STEP, Math.ceil(edge / PRICE_STEP) * PRICE_STEP);
}

const withBench = (b) => (b.sport === 'arsenal' || !BENCH[b.id]
  ? b
  : { ...b, bench: BENCH[b.id], players: [...b.players, ...benchUnits(BENCH[b.id])] });

export const BASE_BUILDS = [
  ...FOOTBALL, ...SOCCER, ...BASKETBALL, ...BASEBALL, ...HOCKEY, ...ARSENAL,
].map(withBench);

export const BUILDS = BASE_BUILDS.map((b) => {
  const winRate = RATINGS[b.id] ?? null;
  return { ...b, winRate, cost: priceFor(winRate) };
});

export const FREE_BUILDS = BUILDS.filter((b) => b.cost === 0 && b.sport !== 'arsenal');
export const PAID_BUILDS = BUILDS.filter((b) => b.cost > 0);

export const getBuild = (id) => BUILDS.find((b) => b.id === id);
