import { FREE_BUILDS } from './library.js';
import { placeFormation } from './formations.js';
import { createEngine } from './engine.js';
import { DEFAULT_FORTUNE_RULES } from './fortuneRules.js';
import { RED } from './constants.js';
import { checkCustom, buildCustom } from './custom.js';

// How strong is a formation? Its win rate as the player (blue) against every formation in
// the bot pool, on a fixed set of seeds, under the shipped rules. The seeds are fixed, so a
// design always gets the same rating. The custom formation designer refuses designs above
// CUSTOM_RATING_CAP; this is the same measure the built-in formations are balanced with.
// 12 runs per opponent: half against the bot as built, half against it flipped (the bots are
// flipped at random in play), so a design cannot be tuned to one orientation or a few seeds.
export const RATING_RUNS = Array.from({ length: 12 }, (_, i) => ({ seed: 201 + i, flip: i % 2 === 1 }));

export function rateCells(mine, onProgress, runs = RATING_RUNS) {
  let pts = 0;
  let n = 0;
  FREE_BUILDS.forEach((opp, i) => {
    const reds = [placeFormation(opp, RED), placeFormation(opp, RED, { flip: true })];
    for (const { seed, flip } of runs) {
      const red = reds[flip ? 1 : 0];
      const e = createEngine({ seed, fortune: DEFAULT_FORTUNE_RULES });
      e.loadTeams([...mine, ...red]);
      const r = e.runToEnd();
      pts += r.outcome === 'win' ? 1 : r.outcome === 'push' ? 0.5 : 0;
      n++;
    }
    if (onProgress) onProgress(i + 1, FREE_BUILDS.length);
  });
  return pts / n;
}

// Rate a custom design (units as placed). Returns null if the design is not legal.
export function ratePlayers(players, onProgress, runs) {
  const spec = { id: 'rate', name: 'rate', players };
  if (!checkCustom(spec).ok) return null;
  return rateCells(placeFormation(buildCustom(spec), 1), onProgress, runs);
}

// A checksum over the design and its rating, stored with a saved formation so that a
// hand-edited save cannot claim a better rating. (Like the save code, a typo guard and a
// speed bump, not security: the game runs in the player's own browser.)
export function designHash(players, rating) {
  const body = JSON.stringify([...players].map((p) => [p.shape, p.depth, p.lat]).sort()) + `|${Math.round(rating * 1000)}|gcw2`;
  let h = 0x811c9dc5;
  for (let i = 0; i < body.length; i++) { h ^= body.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
