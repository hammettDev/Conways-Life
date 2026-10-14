import { FREE_BUILDS, BOSS_BUILDS } from '../engine/library.js';
import { placeFormation, pickBotSetup } from '../engine/formations.js';
import { RED } from '../engine/constants.js';
import { counterFor } from './audible.js';
import { withItem } from './bosses.js';

// Stakes tables. With even-money bets, a formation that wins just over half the time grows a bankroll
// without limit if the bet can scale with it, and one that is simply repeated can be farmed with
// auto-play. Tables fix both: every table has a bet ceiling (growth becomes linear), a table fee (a
// cash sink), and a bot that gets sharper the higher you play: it counter-picks the formation you used
// last (so repeating one formation loses money) and brings pieces and strong builds.
// A table opens once your bankroll has ever reached `unlock`.
export const TABLES = [
  { id: 'rookie', name: 'Rookie', min: 50, max: 1000, unlock: 0, fee: 0, scout: 0, strong: 0, itemChance: 0, items: [], audible: 0.3,
    blurb: 'Bots pick at random.' },
  { id: 'regular', name: 'Regular', min: 1000, max: 10000, unlock: 5000, fee: 0.02, scout: 0.35, strong: 0, itemChance: 0.3, items: ['block', 'toad', 'glider'], audible: 0.3,
    blurb: 'Sometimes counters your last formation. Small pieces.' },
  { id: 'high', name: 'High Roller', min: 10000, max: 100000, unlock: 50000, fee: 0.04, scout: 0.65, strong: 0.25, itemChance: 0.6, items: ['glider', 'rpent', 'lwss', 'mwss'], audible: 0.5,
    blurb: 'Usually counters your last formation. Spaceships and strong builds.' },
  { id: 'whale', name: 'Whale', min: 100000, max: 1000000, unlock: 500000, fee: 0.06, scout: 1, strong: 0.5, itemChance: 1, items: ['mwss', 'hwss', 'acorn'], audible: 0.7,
    blurb: 'Always counters your last formation, always brings a heavy piece.' },
  { id: 'mogul', name: 'Mogul', min: 1000000, max: 10000000, unlock: 5000000, fee: 0.08, scout: 1, strong: 1, itemChance: 1, items: ['hwss', 'acorn'], audible: 1,
    blurb: 'The strongest builds and pieces, and it answers every audible.' },
];

export const getTable = (id) => TABLES.find((t) => t.id === id) || TABLES[0];
export const tableOpen = (save, t) => (save.peak || 0) >= t.unlock;
export const feeFor = (table, wager) => Math.round(wager * table.fee);

// How far the bet slider moves per notch at this table.
export const betStep = (table) => 10 ** Math.max(1, Math.floor(Math.log10(table.max)) - 2);

// The largest bet you can place: the table's ceiling, or what you can cover with the fee and any piece.
export const maxBetFor = (table, balance, pieceCost) => Math.min(table.max, Math.floor((balance - pieceCost) / (1 + table.fee)));

const asSetup = (formation, rng) => {
  const flip = rng() < 0.5;
  return { formation, flip, cells: placeFormation(formation, RED, { flip }) };
};

// The table's bot lineup. `lastId` is the formation you used last match.
export function pickTableSetup(table, rng, lastId, rng2) {
  const strong = BOSS_BUILDS.length && rng() < table.strong;
  const pool = strong ? BOSS_BUILDS : FREE_BUILDS;
  let setup;
  if (lastId && rng() < table.scout) setup = asSetup(counterFor(lastId, [...FREE_BUILDS, ...(table.strong ? BOSS_BUILDS : [])], rng), rng);
  else setup = pickBotSetup(rng, pool);
  return table.items.length && rng2() < table.itemChance ? withItem({ items: table.items }, setup, rng2) : setup;
}
