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
// Shop pieces cost `itemMult` times their base price at each table. A table opens once your bankroll
// has ever reached `unlock`.
export const TABLES = [
  { id: 'rookie', name: 'Rookie', min: 50, max: 1000, unlock: 0, itemMult: 1, fee: 0, scout: 0, strong: 0, itemChance: 0, items: [], audible: 0.3,
    blurb: 'Bots pick at random.' },
  { id: 'regular', name: 'Regular', min: 1000, max: 10000, unlock: 5000, itemMult: 5, fee: 0.01, scout: 0.15, strong: 0, itemChance: 0.1, items: ['block', 'toad'], audible: 0.3,
    blurb: 'Now and then counters your last formation. Small pieces.' },
  { id: 'high', name: 'High Roller', min: 10000, max: 100000, unlock: 50000, itemMult: 25, fee: 0.02, scout: 0.3, strong: 0.1, itemChance: 0.25, items: ['toad', 'glider', 'rpent', 'lwss'], audible: 0.5,
    blurb: 'Often counters your last formation. Small pieces, some strong builds.' },
  { id: 'whale', name: 'Whale', min: 100000, max: 1000000, unlock: 500000, itemMult: 125, fee: 0.03, scout: 0.5, strong: 0.2, itemChance: 0.45, items: ['glider', 'rpent', 'lwss', 'mwss'], audible: 0.7,
    blurb: 'Half the time it counters your last formation. Often brings a piece.' },
  { id: 'mogul', name: 'Mogul', min: 1000000, max: 10000000, unlock: 5000000, itemMult: 500, fee: 0.04, scout: 0.7, strong: 0.4, itemChance: 0.7, items: ['mwss', 'hwss', 'acorn'], audible: 1,
    blurb: 'Often counters you, brings strong builds and heavy pieces, and answers every audible.' },
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
