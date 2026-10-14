import { COUNTERS } from '../engine/counters.js';
import { BOT_AUDIBLE_CHANCE } from '../engine/constants.js';

// After the player pays for an audible, the bot may answer with its own hidden
// one: with probability BOT_AUDIBLE_CHANCE it swaps to a formation that counters
// what the player just switched to.
export const botAnswers = (rng, chance = BOT_AUDIBLE_CHANCE) => rng() < chance;

// A counter for the player's new formation, chosen from the best counters found by
// simulation (scripts/counters.mjs). Falls back to any other formation in the pool.
export function counterFor(playerBuildId, pool, rng) {
  const ids = new Set(pool.map((b) => b.id));
  const best = (COUNTERS[playerBuildId] || []).filter((id) => ids.has(id));
  const options = best.length ? best : [...ids].filter((id) => id !== playerBuildId);
  const id = options[Math.floor(rng() * options.length)];
  return pool.find((b) => b.id === id);
}
