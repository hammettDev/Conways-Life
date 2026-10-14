import { FREE_BUILDS, BOSS_BUILDS } from '../engine/library.js';
import { placeFormation, pickBotSetup } from '../engine/formations.js';
import { RED, BOSS_UNLOCK_WINS, BOSS_MULTIPLIERS, SCOUT_BOSS_AUDIBLE_CHANCE } from '../engine/constants.js';
import { counterFor } from './audible.js';

// Boss fights are the regular match with a tougher bot and a hidden payout:
// beat one and your winnings are multiplied by a number you only see afterwards.
// Each boss unlocks once you have beaten the one before it, and a fight opens
// after BOSS_UNLOCK_WINS ordinary wins.
export const BOSSES = [
  {
    id: 'scout', name: 'The Scout', audible: SCOUT_BOSS_AUDIBLE_CHANCE,
    blurb: 'Studies your last formation and picks the counter. Answers every audible, so out-vary it instead.',
  },
  {
    id: 'coach', name: 'The Coach', audible: 0.3,
    blurb: 'Runs a strong playbook the regular bots never use.',
  },
  {
    id: 'champion', name: 'The Champion', audible: 0.5,
    blurb: 'Counter-picks your last formation from the strong playbook too.',
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

// The hidden payout multiplier, from the weighted table.
export function rollMultiplier(rng) {
  const total = BOSS_MULTIPLIERS.reduce((n, [, w]) => n + w, 0);
  let r = rng() * total;
  for (const [m, w] of BOSS_MULTIPLIERS) { r -= w; if (r < 0) return m; }
  return BOSS_MULTIPLIERS[0][0];
}
