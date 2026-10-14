import { FREE_BUILDS, BOSS_BUILDS } from '../engine/library.js';
import { placeFormation, pickBotSetup, HALF_X } from '../engine/formations.js';
import { getObject, cellsWithObject } from '../engine/objects.js';
import { RED, FIELD_X1, FIELD_Y0, FIELD_Y1, BOSS_UNLOCK_WINS, BOSS_CHANCE_BASE, BOSS_CHANCE_STEP, BOSS_CHANCE_MAX, BOSS_MULTIPLIERS, SCOUT_BOSS_AUDIBLE_CHANCE } from '../engine/constants.js';
import { counterFor } from './audible.js';

// Boss fights are the regular match with a tougher bot and a hidden payout:
// beat one and your winnings are multiplied by a number you only see afterwards.
// Each boss unlocks once you have beaten the one before it, and a fight opens
// after BOSS_UNLOCK_WINS ordinary wins.
export const BOSSES = [
  {
    id: 'scout', name: 'The Scout', audible: SCOUT_BOSS_AUDIBLE_CHANCE, rolls: 1,
    items: ['glider', 'rpent'],
    blurb: 'Studies your last formation and picks the counter. Answers every audible, so out-vary it instead. Brings a cheap piece.',
  },
  {
    id: 'coach', name: 'The Coach', audible: 0.3, rolls: 1,
    items: ['lwss', 'mwss', 'rpent'],
    blurb: 'Runs a strong playbook the regular bots never use, and brings a spaceship.',
  },
  {
    id: 'champion', name: 'The Champion', audible: 0.5, rolls: 2,
    items: ['mwss', 'hwss', 'acorn'],
    blurb: 'Counter-picks your last formation from the strong playbook too, with the heaviest pieces. Pays the better of two rolls.',
  },
  {
    id: 'blitzer', name: 'The Blitzer', audible: 0.4, rolls: 2,
    items: ['lwss', 'mwss', 'rpent'],
    blurb: 'Only ever lines up in an aggressive front and charges with a spaceship. Pays the better of two rolls.',
  },
  {
    id: 'fortress', name: 'The Fortress', audible: 0.3, rolls: 2,
    items: ['block', 'toad', 'acorn'],
    blurb: 'Counter-picks your last formation, but only from its tightest, most defensive looks. Hard to crack. Pays the better of two rolls.',
  },
  {
    id: 'mirror', name: 'The Mirror', audible: 0.5, rolls: 2,
    items: ['glider', 'mwss', 'hwss'],
    blurb: 'Fields the same formation you used last match, flipped, with a piece of its own. Pays the better of two rolls.',
  },
  {
    id: 'dealer', name: 'The Dealer', audible: 1, rolls: 3,
    items: ['hwss', 'acorn', 'rpent'],
    blurb: 'Counter-picks from everything it owns, answers every audible and deals the heaviest pieces. Pays the best of three rolls.',
  },
];

// Which bosses can turn up at each table: the higher you play, the more of them.
const TIERS = {
  rookie: ['scout', 'coach'],
  regular: ['scout', 'coach', 'champion'],
  high: ['scout', 'coach', 'champion', 'blitzer', 'fortress'],
  whale: ['coach', 'champion', 'blitzer', 'fortress', 'mirror'],
  mogul: ['champion', 'blitzer', 'fortress', 'mirror', 'dealer'],
};

export const encounterChance = (save) => Math.min(BOSS_CHANCE_MAX, BOSS_CHANCE_BASE + BOSS_CHANCE_STEP * (save.boss.since || 0));

// Does a boss show up this match, and which? Seeded by the match, so cancelling and locking in again
// (or reloading) meets the same one; it cannot be rerolled.
export function rollEncounter(save, table, rng) {
  if (rng() >= encounterChance(save)) return null;
  const ids = TIERS[table.id] || TIERS.rookie;
  return BOSSES.find((b) => b.id === ids[Math.floor(rng() * ids.length)]) || null;
}

export const getBoss = (id) => BOSSES.find((b) => b.id === id) || null;

// Bosses you may fight now: the first not yet beaten, plus every one you have beaten.
export function unlockedBosses(save) {
  const beaten = save.boss.beaten;
  const next = BOSSES.findIndex((b) => !beaten.includes(b.id));
  return BOSSES.filter((b, i) => beaten.includes(b.id) || i === next);
}

export const bossReady = (save) => save.boss.wins >= BOSS_UNLOCK_WINS;
export const winsToBoss = (save) => Math.max(0, BOSS_UNLOCK_WINS - save.boss.wins);

const asSetup = (formation, rng) => {
  const flip = rng() < 0.5;
  return { formation, flip, cells: placeFormation(formation, RED, { flip }) };
};

// The boss's formation for this match. `lastId` is the formation you used last match.
const AGGRESSIVE = ['fb-46-bear', 'fb-cover-0', 'fb-dime', 'fb-goal-line-d', 'fb-4-3-over', 'sc-2-3-5'];
const TIGHT = ['fb-goal-line-d', 'fb-goal-line', 'fb-prevent', 'fb-bunch', 'fb-46-bear', 'fb-4-3-under', 'fb-full-house'];

export function pickBossSetup(boss, rng, lastId) {
  const strong = BOSS_BUILDS.length ? BOSS_BUILDS : FREE_BUILDS;
  const everything = [...strong, ...FREE_BUILDS];
  const only = (ids, pool) => { const f = pool.filter((b) => ids.includes(b.id)); return f.length ? f : pool; };
  if (boss.id === 'coach') return pickBotSetup(rng, strong);
  if (boss.id === 'blitzer') return pickBotSetup(rng, only(AGGRESSIVE, everything));
  if (boss.id === 'mirror') {
    const same = lastId && everything.find((b) => b.id === lastId);
    return same ? asSetup(same, rng) : pickBotSetup(rng, FREE_BUILDS);
  }
  const pool = boss.id === 'champion' || boss.id === 'dealer' ? everything
    : boss.id === 'fortress' ? only(TIGHT, everything) : FREE_BUILDS;
  if (!lastId) return pickBotSetup(rng, pool);
  return asSetup(counterFor(lastId, pool, rng), rng);
}

// A boss brings one bought piece too (it replaces its reserves, like yours). It
// goes where it fits on the boss's half without overlapping the formation. The
// piece is revealed with the formation, so you can see what you are up against.
export function withItem(boss, setup, rng) {
  const ids = boss.items || [];
  if (!ids.length) return setup;
  const object = getObject(ids[Math.floor(rng() * ids.length)]);
  for (let tries = 0; tries < 60; tries++) {
    const drop = { depth: 8 + Math.floor(rng() * 14), lat: Math.floor(rng() * 25) - 12 };
    const cells = cellsWithObject(setup.formation, RED, object, drop, { flip: setup.flip });
    const seen = new Set();
    const ok = cells.every((c) => {
      const k = c.y * 1000 + c.x;
      if (seen.has(k)) return false;
      seen.add(k);
      return c.x >= HALF_X && c.x < FIELD_X1 && c.y >= FIELD_Y0 && c.y < FIELD_Y1;
    });
    if (ok) return { ...setup, cells, item: object };
  }
  return setup; // nowhere to put it: fight without
}

// The hidden payout multiplier, from the weighted table.
// Tougher bosses roll more times and pay the best roll.
export function rollMultiplier(rng, rolls = 1) {
  const total = BOSS_MULTIPLIERS.reduce((n, [, w]) => n + w, 0);
  const once = () => {
    let r = rng() * total;
    for (const [m, w] of BOSS_MULTIPLIERS) { r -= w; if (r < 0) return m; }
    return BOSS_MULTIPLIERS[0][0];
  };
  let best = once();
  for (let i = 1; i < rolls; i++) best = Math.max(best, once());
  return best;
}
