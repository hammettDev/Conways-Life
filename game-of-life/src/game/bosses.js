import { FREE_BUILDS, BOSS_BUILDS } from '../engine/library.js';
import { placeFormation, pickBotSetup, HALF_X } from '../engine/formations.js';
import { getObject, cellsWithObject } from '../engine/objects.js';
import { RED, FIELD_X1, FIELD_Y0, FIELD_Y1, BOSS_UNLOCK_WINS, BOSS_MULTIPLIERS, SCOUT_BOSS_AUDIBLE_CHANCE } from '../engine/constants.js';
import { counterFor } from './audible.js';

// Boss fights are the regular match with a tougher bot and a hidden payout:
// beat one and your winnings are multiplied by a number you only see afterwards.
// Each boss unlocks once you have beaten the one before it, and a fight opens
// after BOSS_UNLOCK_WINS ordinary wins.
export const BOSSES = [
  {
    id: 'scout', name: 'The Scout', audible: SCOUT_BOSS_AUDIBLE_CHANCE,
    items: ['glider', 'rpent'],
    blurb: 'Studies your last formation and picks the counter. Answers every audible, so out-vary it instead. Brings a cheap piece.',
  },
  {
    id: 'coach', name: 'The Coach', audible: 0.3,
    items: ['lwss', 'mwss', 'rpent'],
    blurb: 'Runs a strong playbook the regular bots never use, and brings a spaceship.',
  },
  {
    id: 'champion', name: 'The Champion', audible: 0.5,
    items: ['mwss', 'hwss', 'acorn'],
    blurb: 'Counter-picks your last formation from the strong playbook too, with the heaviest pieces.',
  },
];

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
export function pickBossSetup(boss, rng, lastId) {
  const strong = BOSS_BUILDS.length ? BOSS_BUILDS : FREE_BUILDS;
  if (boss.id === 'coach') return pickBotSetup(rng, strong);
  const pool = boss.id === 'champion' ? [...strong, ...FREE_BUILDS] : FREE_BUILDS;
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
export function rollMultiplier(rng) {
  const total = BOSS_MULTIPLIERS.reduce((n, [, w]) => n + w, 0);
  let r = rng() * total;
  for (const [m, w] of BOSS_MULTIPLIERS) { r -= w; if (r < 0) return m; }
  return BOSS_MULTIPLIERS[0][0];
}
