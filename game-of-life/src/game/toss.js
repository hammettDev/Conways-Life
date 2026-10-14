// Who gets the ball first: a quick game of Conway's Takeover on a fixed rock-paper-scissors of three formations.
// Pistol beats 4-3 Over, 4-3 Over beats Prevent, Prevent beats Pistol (found by scripts/toss-search.mjs: all three
// are decisive and each sits near 50% overall). You pick one, the opponent picks one, the board decides.
import { FREE_BUILDS } from '../engine/library.js';
import { placeFormation } from '../engine/formations.js';
import { createEngine } from '../engine/engine.js';
import { DEFAULT_FORTUNE_RULES } from '../engine/fortuneRules.js';
import { createRng } from '../engine/rng.js';
import { BLUE, RED } from '../engine/constants.js';

export const TOSS_IDS = ['fb-pistol', 'fb-4-3-over', 'fb-prevent'];
export const TOSS_BEATS = { 'fb-pistol': 'fb-4-3-over', 'fb-4-3-over': 'fb-prevent', 'fb-prevent': 'fb-pistol' };
export const tossBuilds = () => TOSS_IDS.map((id) => FREE_BUILDS.find((b) => b.id === id));

// Returns { botId, outcome: 'win' | 'lose' | 'push', winner: 'you' | 'them' }. A push (a drawn board) goes to the seed.
export function playToss(seed, pickId) {
  const rng = createRng(seed ^ 0x70559);
  const botId = TOSS_IDS[Math.floor(rng() * TOSS_IDS.length)];
  const byId = (id) => FREE_BUILDS.find((b) => b.id === id);
  const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
  e.loadTeams([...placeFormation(byId(pickId), BLUE), ...placeFormation(byId(botId), RED, { flip: seed % 2 === 0 })]);
  const r = e.runToEnd();
  const outcome = r.outcome;
  const winner = outcome === 'win' ? 'you' : outcome === 'lose' ? 'them' : (seed % 2 === 0 ? 'you' : 'them');
  return { botId, outcome, winner };
}
